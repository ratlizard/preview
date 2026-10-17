/* delv-graphics.js -- Cythera's palette, its compressed-graphics decoder, and
 * the undither filter, from bytes to pixels and no further.
 *
 * Nothing in here touches the DOM. decompressDCG() and decodeResource() return
 * a plain Uint8Array of palette indices; undither() takes and returns RGBA
 * arrays. Drawing those onto a canvas is the page's job and stays there, which
 * is what makes this file checkable: utilities/delv_graphics_check.mjs runs
 * delvmod's independent decoder over every image in the archive and compares
 * pixel for pixel, and utilities/decoder_snapshot.mjs hashes the output so a
 * refactor that changes a byte is visible. Keep new code here on the same side
 * of that line -- a decoder that needs a canvas cannot be compared against a
 * Python one.
 *
 * See delv-archive.js for why these are classic scripts and why this is
 * organisation rather than a library. LOAD ORDER: after delv-archive.js, whose
 * bit readers decodeResource() uses; before the page.
 *
 * ABOUT THE PALETTE, before anyone corrects it: this table differs from the
 * application's own `clut` 256 at exactly two entries, index 0 and index 247,
 * and both differences are absorbed by the `>> 2` in scale6to8 -- the rendered
 * pixels are identical either way. The comment above scale6to8 explains why
 * the widening is done by scaling rather than the shift the original used.
 *
 * The undither block is the settled result of a long tuning exercise, and
 * The retired mobile shell (ratlizard/alchemy) carried a port of it as three GPU passes because this
 * implementation costs 5.8 s for a 640x480 frame. utilities/
 * its mobile_undither_check.mjs read UD and the detector's constants back out of
 * this file and fails if the two have drifted, so a tuning change made here
 * without touching that port was caught rather than discovered later.
 */

const PALETTE = ["ffffff","0000a8","00a800","00a8a8","a80000","a800a8","a85400","a8a8a8","545454","5454fc","54fc54","54fcfc","fc5454","fc54fc","fcfc54","fcfcfc","fcfcfc","ececec","d8d8d8","c8c8c8","b8b8b8","a8a8a8","989898","848484","747474","646464","545454","444444","343434","202020","101010","080808","fcf400","f8c800","f4a400","ec8000","e86000","e44000","e02000","dc0000","c80000","b40000","a00000","8c0000","7c0000","680000","540000","400000","fcfcfc","fcf4c0","fcec84","fce448","fcdc38","fcd024","fcc814","fcb800","e89000","d07000","bc5400","a83c00","942800","7c1800","680800","540000","e8905c","dc7848","d0603c","c04c2c","b4381c","a82414","9c1008","900000","800000","6c0000","5c0000","480000","380000","240000","100000","000000","f8fcd8","f4fcb8","e8fc9c","e0fc7c","d0fc5c","c4fc40","b4fc20","a0fc00","90e400","80cc00","74b400","609c00","508400","447000","345800","284000","d8fcd8","bcfcb8","9cfc9c","80fc7c","60fc5c","40fc40","20fc20","00fc00","00e400","04cc00","04b400","049c00","088400","047000","045800","044000","d8ecfc","b8dcfc","9cd0fc","7cbcfc","5cacfc","4094fc","2084fc","0070fc","0068e4","005ccc","0058b4","00509c","004484","003c70","003058","002440","fcc87c","f0b870","e8a868","dc9c60","d09058","c88450","bc784c","b46c44","a0643c","906034","80542c","6c4c24","5c401c","483818","382c10","28200c","fcd8fc","fcb8fc","fc9cfc","fc7cfc","fc5cfc","fc40fc","fc20fc","fc00fc","e000e4","c800cc","b400b4","9c009c","840084","6c0070","580058","400040","fce8dc","fce0d0","fcd8c4","fcd4bc","fcccb0","fcc4a4","fcbc9c","fcb890","e8a47c","d0946c","bc8458","a8744c","94643c","805830","684824","543c1c","fce8dc","f4c8b4","e8b090","e09470","d47850","cc6034","c44818","bc3400","a82800","981c00","881400","781000","680800","580400","480000","380000","fcf46c","f0f060","dce454","ccdc48","b8d040","a8c434","94b82c","84b024","749820","64841c","506c14","405810","30400c","202c08","101404","000000","fcfcfc","e8e8f0","d4d4e8","c0c4dc","b4b4d0","a0a0c8","9494bc","8484b4","74749c","646484","505470","404058","303044","20202c","101018","000000","fc0000","fc1c00","fc4000","fc6000","fc7c00","fc9800","fcbc00","fcdc00","0010fc","1028fc","1c44fc","2c5cfc","3874fc","4484fc","5498fc","60a8fc","d02094","dc34c0","ec48e8","ec60fc","704820","84542c","9c6038","b56d45","24a800","1cbc00","10d000","00e400","000000","000000","fcf4c0","000000"];
// The CLUT above is a 6-bit-per-channel Mac clut that was widened to 8 bits
// by a left shift (v6 << 2). That is why 254 of the 256 entries have all three
// channels a multiple of 4, and why the top of every ramp lands 3 short of
// full range: white comes out 0xFC/252 instead of 255.
//
// Shifting is wrong twice over. It compresses the whole gamut to 0-252, and it
// splits one colour into two: index 0 is stored 255,255,255 while indices 15,
// 16 and 48 -- the same intended white -- are stored 252,252,252. An undither
// pass then sees a 3-level step between two whites and treats it as signal.
//
// Scaling instead of shifting maps 63 -> 255 exactly and keeps every
// intermediate step proportional: round(v6 * 255/63). All four whites collapse
// onto 255,255,255 and the 252/255 split disappears. The two entries that are
// not multiples of 4 (index 0, already full range, and index 247) round back
// to within one level of themselves, so nothing else moves meaningfully.
function scale6to8(v8) { return Math.round(((v8 >> 2) * 255) / 63); }
function hexToRgb(h) {
  return [scale6to8(parseInt(h.substr(0,2),16)),
          scale6to8(parseInt(h.substr(2,2),16)),
          scale6to8(parseInt(h.substr(4,2),16))];
}
const PAL_RGB = PALETTE.map(hexToRgb);
const CANONICAL_SIZE = { 135: [64,64], 137: [32,16], 141: [32,512], 131: [288,32], 142: [256,256] };
const HAS_HEADER = { 135:false, 137:false, 141:false, 131:false, 142:true };
const UNCOMPRESSED = { 137:true };
/* Delver Compressed Graphics.
 *
 * VERIFIED against delvmod's DelvImage.decompress (delv/graphics.py), which is
 * an independent implementation of this format by the people who worked it out:
 * all 441 images in the shipped archive decode to identical pixels. Re-run it
 * with utilities/delv_graphics_check.mjs after touching anything in here --
 * decoder_snapshot.mjs only proves this function is *unchanged*, which a
 * decoder that has been wrong since it was written also passes.
 *
 * The two implementations differ deliberately in four places, all opcodes
 * delvmod treats as fatal or undefined (0xD4-0xDF, 0xF1-0xF7, 0xFE, 0xF8-0xFD;
 * each is commented at its branch below). That check walks every opcode stream
 * and confirms this archive reaches none of them -- which is the other half of
 * the argument, because identical pixels would equally be explained by a
 * divergent branch that never fires. */
function decompressDCG(data, width, height) {
  const image = new Uint8Array(width*height);
  let cursor = 0, dcursor = 0; const len = data.length;
  function run(length, color) { const maxc = cursor+length; while (cursor < maxc && cursor < image.length) { image[cursor]=color; cursor++; } }
  function copy(length, origin) {
    const absOrigin = cursor+origin; const copyWidth = -origin;
    for (let n=0; n<length && cursor<image.length; n++) {
      const src = absOrigin + (n % copyWidth);
      image[cursor] = (src>=0 && src<image.length) ? image[src] : 0;
      cursor++;
    }
  }
  function cdata(bytes) { for (let i=0; i<bytes.length && cursor<image.length; i++) { image[cursor]=bytes[i]; cursor++; } }
  let iterations = 0;
  decompressDCG.lastWarning = null;
  while (dcursor < len) {
    if (++iterations > 300000) {
      decompressDCG.lastWarning = 'Stopped after 300000 opcodes; image may be incomplete.';
      break;
    }
    const opcode = data[dcursor];
    if (opcode < 0x80) {
      const op = data.slice(dcursor, dcursor+2); dcursor+=2;
      const index = -(ncbitsOf(op, [[3,8],[7,1]]) + 1);
      const length = bitsOfSingle(op, 3, 13) + 3; const literals = bitsOfSingle(op, 2, 11);
      cdata(data.slice(dcursor, dcursor+literals)); dcursor += literals;
      copy(length, index);
    } else if (opcode < 0xC0) {
      const op = data.slice(dcursor, dcursor+3); dcursor+=3;
      const index = -(ncbitsOf(op, [[6,16],[3,8],[6,2]]) + 1);
      const length = bitsOfSingle(op, 5, 11) + 3; const literals = bitsOfSingle(op, 2, 22);
      cdata(data.slice(dcursor, dcursor+literals)); dcursor += literals;
      copy(length, index);
    } else if (opcode < 0xD0) {
      const op = data.slice(dcursor, dcursor+1); dcursor+=1;
      const size = (bitsOfSingle(op,4,4)+1)*4;
      cdata(data.slice(dcursor, dcursor+size)); dcursor += size;
    } else if (opcode < 0xE0) {
      // 0xD0-0xDF: Short Data. The wiki splits the low nibble as 0b1101 BB CC
      // -- two UNKNOWN bits then two literal bits -- so the literal count is
      // the low 2 bits only, not the whole nibble. The two readings agree for
      // 0xD0-0xD3 and diverge above that; only 0xD1 and 0xD2 appear in the
      // Cythera corpus, so the wiki's split is untested but is what we follow.
      // (Before either reading, this was a 2-byte no-op, which dropped pixels
      // and desynced the stream: 0x8E14, 0x8401 and 0x8F04 failed to decode.)
      const op = data.slice(dcursor, dcursor+1); dcursor += 1;
      const literals = opcode & 0x03;
      if (opcode & 0x0C) {
        decompressDCG.lastWarning = 'Short Data opcode 0x' + opcode.toString(16) +
          ' at 0x' + (dcursor-1).toString(16) + ' sets the two undocumented bits; ' +
          'literal count read as ' + literals + ' (low 2 bits only).';
      }
      cdata(data.slice(dcursor, dcursor+literals)); dcursor += literals;
    } else if (opcode < 0xF0) {
      const op = data.slice(dcursor, dcursor+2); dcursor+=2;
      const length = bitsOfSingle(op,4,4)+3; const color = op[1];
      run(length,color);
    } else if (opcode < 0xF8) {
      // Long Run is the prefix 0b11110***, i.e. the whole range 0xF0-0xF7.
      // Only 0xF0 occurs in the Cythera corpus and the three low bits do not
      // appear to affect anything, but 0xF1 is known to be interpreted as
      // Long Run, so treating 0xF1-0xF7 as fatal was wrong.
      const op = data.slice(dcursor, dcursor+3); dcursor+=3;
      const length = op[1]+3; const color = op[2];
      run(length,color);
    } else if (opcode === 0xFF || opcode === 0xFE) {
      // Terminate is the prefix 0b1111111*: 0xFE terminates as well as 0xFF.
      dcursor += 1; break;
    }
    else {
      // 0xF8-0xFD remain genuinely unknown -- they are not covered by any
      // prefix in the wiki's command table and have not been seen in the
      // corpus, so they may simply be unimplemented.
      // Return what decoded successfully rather than discarding the whole
      // image; a single bad byte used to blank the entire resource.
      decompressDCG.lastWarning = 'Unknown opcode 0x' + opcode.toString(16) +
        ' at 0x' + dcursor.toString(16) + '; showing partial image.';
      break;
    }
  }
  return image;
}

/* One resource in subindex 141 is not a tile sheet at all.
   ---------------------------------------------------------------------------
   0x8EFF -- the wiki's "Tombstone" -- was being decompressed as the fixed
   32x512 strip every other 0x8Exx resource is, which produced a sheared mess:
   its rows are 196 pixels long, so reading them 32 at a time walks diagonally
   through the picture. It is a SIZED resource, the same 4-byte {width, height}
   header subindex 142 uses, and it decodes to a 194x127 tombstone slab -- the
   panel the game lays a gravestone inscription on.

   Two things have to hold before the header reading is used, and across all
   160 tile sheets in the archive only 0x8EFF passes both:

     * the header parses to a plausible picture (every other sheet's first four
       bytes read as sizes like 61693x128 or 20x61185 -- they are compression
       opcodes, not a header; only 0x8E8D at 272x46 and 0x8EFF at 194x127 are
       even arguable), and
     * none of the sixteen tile ids the sheet would occupy carries any tile
       attribute in 0xF002. 0x8E8D's sixteen are all attributed and all named
       ("earthen wall", "small hole", "fine wire"...) and all referenced by
       maps; 0x8EFF's sixteen are attributed nowhere and referenced by nothing.

   Row-to-row self-similarity confirms the reading: 0.58 flat against 0.82 at
   the header's width. */
function tileSheetIsSized(arc, resid, resData) {
  const memo = derivedTable(arc, 'sizedSheets', () => new Map());
  if (memo.has(resid)) return memo.get(resid);
  let ok = false;
  try {
    if (resData && resData.length >= 8) {
      const h = resData.slice(0, 4);
      const w2 = bitsOf(h, 14, 0) << 2, fl = bitsOf(h, 2, 14);
      const h2 = bitsOf(h, 15, 16) << 1, fl2 = bitsOf(h, 1, 31);
      const lw = w2 + (fl ? 4 : 0), lh = h2 + fl2;
      if (lw >= 8 && lw <= 1024 && lh >= 8 && lh <= 1024 && lw * lh >= 1024) {
        const attrs = getTileAttributes(arc);
        const first = (resid & 0xFF) << 4;
        let used = false;
        for (let t = first; t < first + 16; t++) if (attrs[t]) { used = true; break; }
        ok = !used;
      }
    }
  } catch (e) { quiet(e); }
  memo.set(resid, ok);
  return ok;
}

function decodeResource(arc, resData, subn, resid) {
  let W, H, logW, logH, image;
  if (UNCOMPRESSED[subn]) { [W,H] = CANONICAL_SIZE[subn]; image = resData.slice(0, W*H); return {W,H,image}; }
  if (subn === 141 && resid !== undefined && tileSheetIsSized(arc, resid, resData)) subn = 142;
  if (HAS_HEADER[subn] && resData.length >= 4) {
    const header = resData.slice(0,4);
    let W2 = bitsOf(header, 14, 0) << 2;
    const flags = bitsOf(header, 2, 14);
    let H2 = bitsOf(header, 15, 16) << 1;
    const flags2 = bitsOf(header, 1, 31);
    // logH2 must include flags2. delv computes logical_height = height + flags2
    // BEFORE adding flags2 to height, so the two end up equal and the decode
    // buffer holds every row. Taking logH2 from the pre-adjustment height
    // decoded one row short, and the crop below then read past the end of the
    // buffer and filled the last row with the `|| 0` fallback -- 28 of the 59
    // sized resources have flags2 set and were losing their bottom row.
    let logW2 = W2, logH2 = H2 + flags2;
    if (flags) { logW2 += 4; W2 += flags; }
    if (flags2) { H2 += flags2; }
    resData = resData.slice(4);
    const fullImage = decompressDCG(resData, logW2, logH2);
    let image = fullImage;
    if (W2 !== logW2 || H2 !== logH2) {
      image = new Uint8Array(W2*H2);
      for (let y=0;y<H2;y++) {
        for (let x=0;x<W2;x++) image[y*W2+x] = fullImage[y*logW2+x] || 0;
      }
    }
    return {W:W2, H:H2, image};
  }
  [W,H] = CANONICAL_SIZE[subn];
  image = decompressDCG(resData, W, H);
  return {W,H,image};
}

function reshapeTileSheetGrid(W, H, image) {
  if (W !== 32 || H !== 512) return {W,H,image};
  const gridW = 128, gridH = 128;
  const out = new Uint8Array(gridW*gridH);
  for (let t=0; t<16; t++) {
    const gx = (t % 4) * 32, gy = Math.floor(t / 4) * 32;
    for (let y=0;y<32;y++) for (let x=0;x<32;x++) {
      out[(gy+y)*gridW + (gx+x)] = image[(t*32+y)*32 + x];
    }
  }
  return {W:gridW, H:gridH, image:out};
}

// Palette index 0 is Delver's transparent slot. Portraits are cut-outs on
// index 0, so forcing alpha 255 painted a white box behind every face.
// Cythera animates water, lava and magic by palette cycling rather than by
// swapping frames: the wiki records that "colors 0xE0-0xFB inclusive are
// subject to palette animation", and Glenn Andreas describes the engine
// iterating those indices for "the lava, or waves in the water". The Andreas
// quote and the 0xE0-0xFB range are the wiki's. Where the ramps divide is no
// longer a guess: the engine masks with 0xF8 below 0xF0 and with 0xFC above
// it, which is the 8, 8, 4, 4, 4 below, and it leaves 0xFC-0xFF alone. What
// each ramp is FOR is still this tool's own reading and appears nowhere in
// the wiki:
//   E0-E7 fire/lava   E8-EF water   F0-F3 magic (the void sparkle)
//   F4-F7 earth       F8-FB nature
//
// The direction is NOT a guess and was wrong here until 14 September 2026,
// which is why the rivers ran upstream. The engine does not animate the CLUT
// at all: it builds eight 256-byte translation tables once, counts a phase
// 0..7 up by one per animation tick, and passes every pixel of the finished
// frame through the table for the current phase. The tables are built as
//   index -> (index & 0xF8) | ((index - phase) & 7)   for E0-EF
//   index -> (index & 0xFC) | ((index - phase) & 3)   for F0-FB
// and everything outside E0-FB maps to itself. So a pixel drawn as E0 shows
// E7 at phase 1, not E1: the ramp is walked DOWNWARDS as the phase rises.
// This tool had it upwards, and so does delvmod's panimate, which the two
// having been written separately had made look like agreement.
const PALETTE_CYCLES = [[0xE0,8],[0xE8,8],[0xF0,4],[0xF4,4],[0xF8,4]];
function cycledPalette(frame) {
  const pal = PAL_RGB.slice();
  for (const [start, len] of PALETTE_CYCLES) {
    for (let i = 0; i < len; i++) pal[start + i] = PAL_RGB[start + ((i - frame) % len + len) % len];
  }
  return pal;
}
function imageUsesAnimatedColors(image) {
  for (let i = 0; i < image.length; i++) if (image[i] >= 0xE0 && image[i] <= 0xFB) return true;
  return false;
}

// The in-app dedither is gone. It was a 3x3 box blur that pushed pixels off
// the palette, which meant the canvas no longer matched its palette indices
// and PNG export had to fall back to RGBA. Undithering now happens in the
// separate tool, fed by the indexed PNGs this viewer writes.


// ===================== Undither =========================================
// Tone reconstruction for the quantised photographs behind the portrait and
// graphic resources. Lifted verbatim from cythera_graphics_undither.html and
// checked byte-for-byte against it on eight resources; the only edits were to
// collapse the settings this page does not expose. Those settings are:
//
//   pattern scale 1, sensitivity 0.67, strength 67%, edge threshold 64,
//   3 refinement passes, detail recovery 50%, checkerboard-notch smoother,
//   stray-colour repair at 40 (inside dithered areas only, 0.65),
//   2x structure-guided upscale resampled back to native size.
//
// Specks, denoise and palette requantisation are not offered and their code is
// not carried over. The tuning page remains the place to explore; this is the
// settled result of that exploration.
const UD = {
  radius:1, sens:0.67, lock:true, diagonals:false, strength:0.67, edge:64, passes:3,
  detail:0.5, speck:0, speckPasses:2, speckLiterals:false, stray:40, strayRegion:0.65,
  nlm:0, nlmPatch:2, nlmSearch:4, upscale:2, supersample:true, scaler:"guided",
  filter:"notch", quantise:"off", quantiseK:2, lockAnimated:true, protectCutout:true,
  lockSharedArt:true
};

/* A second set of settings, and why there are two.
 *
 * UD above was tuned by eye and by a cleaning-versus-detail-loss ratio over
 * six portraits. Both are real measures and neither is "is this the picture
 * the artist drew", because the continuous-tone original is not in the
 * archive and never was.
 *
 * utilities/undither_check.mjs makes one. ditherToCytheraPalette is the
 * forward process this repository already carries, so an image put through it
 * has a KNOWN original and the filter can be scored against the thing it is
 * trying to recover. Over four sources -- a smooth ramp, a grey-to-warm hue
 * sweep at constant lightness, fine linework, and a lit sphere -- the settings
 * above come 34th of the 36 combinations tried. These come first: RMSE 10.81
 * against 11.95, a tenth better, for 3% more error at edges.
 *
 * Both are offered rather than one replacing the other, because the two
 * measures disagree honestly. The ground truth here is recovery from THIS
 * dither; Ambrosia's artwork was made by another, and the portraits the
 * original was tuned on are the class with least dither in them (3.4% of
 * pixels textured, against 17.9% for the misc graphics). Which looks right on
 * the real art is a question for the person looking at it, so the page asks.
 *
 * passes is 1 here and that is not a compromise: checkerNotch takes a `guide`
 * argument and never reads it, so every pass after the first recomputes an
 * identical result. The sweep shows it exactly -- 11.945 for one pass, two,
 * three and four. UD keeps 3 so that its output is the byte-for-byte thing it
 * always was; this one does the same work once.
 */
const UD_MEASURED = Object.assign({}, UD, {
  strength: 0.9, sens: 0.8, passes: 1
});

const UD_PRESETS = { original: UD, measured: UD_MEASURED };
// The page sets this; anything else loading these files gets the settled one.
function activeUD() {
  const p = (typeof window !== 'undefined' && window.UNDITHER_PRESET) || 'original';
  return UD_PRESETS[p] || UD;
}
const LINE_REACH = 3;
const AXES_STRAIGHT = [[1,0],[0,1]];
const AXES_ALL      = [[1,0],[0,1],[1,1],[1,-1]];

function isAnimatedIndex(n){ return n >= 0xE0 && n < 0xFC; }

/* ------------------------------------------------------------
   Shared art: the frame around a portrait is not dithered.

   Every Cythera portrait is a face inside a frame, and the two
   are different kinds of picture. The face is continuous tone
   put into 256 colours by dithering, which is exactly what this
   filter exists to undo. The frame is pixel art -- masonry,
   gems, crossed swords, a vine with grape clusters -- drawn a
   pixel at a time, and where it alternates two colours it is
   doing so deliberately, as a pattern. Averaging that is not
   reconstruction, it is damage: the vintner's grapes came out
   as two flat magenta blobs.

   Nothing in a pixel tells you which it is, and every local
   test tried confuses them -- a checkerboard of two magentas is
   a checkerboard of two magentas whether a hand or a dither put
   it there. So the evidence is taken from the archive instead:
   a frame is DRAWN ONCE AND REUSED across the portraits that
   share it, and a face never is. Ambrosia's artists worked that
   way, and the file still shows it.

   The test is therefore whether a pixel's whole neighbourhood
   appears identically, at the same coordinates, in some other
   portrait. 5x5 rather than 3x3, which was tried first and is
   too weak: flat highlights on two different faces agree over
   3x3 by coincidence often enough to lock parts of a cheek. At
   5x5 that stops, and what is left is the frame, the vine and
   the grapes, with the face untouched.

   It is measured from the corpus rather than listed, so a
   modded archive gets its own frames and nothing here has a
   table to go stale. A portrait whose frame is unique to it
   locks nothing, which is the right answer: there is then no
   evidence, and the filter's old behaviour is what it gets.
   ------------------------------------------------------------ */
const SHARED_ART_R = 2;              /* the 5x5 above */
const PORTRAIT_SUBN = 135;

/* Every portrait in the archive, decoded once per archive: the corpus IS
   the open archive. With no archive -- a harness handing bytes straight to
   the decoders -- the corpus is empty and nothing is locked. */
function portraitCorpus(arc){
  if (!arc) return [];
  return derivedTable(arc, 'portraitCorpus', () => {
    const corpus = [];
    try {
      const mi = arc.index[PORTRAIT_SUBN];
      if (!mi || !mi[0]) return corpus;
      const cnt = mi[1] | 0;
      for (let i = 0; i < cnt / 8; i++) {
        const resid = ((PORTRAIT_SUBN + 1) << 8) | i;
        try {
          const b = getResourceBytes(arc, resid); if (!b) continue;
          const d = decodeResource(arc, b, PORTRAIT_SUBN, resid);
          if (d && d.image) corpus.push(d);
        } catch (e) { quiet(e); }
      }
    } catch (e) { corpus.length = 0; }
    return corpus;
  });
}

function sharedArtMask(arc, image, W, H){
  const corpus = portraitCorpus(arc);
  if (!corpus.length) return null;
  const R = SHARED_ART_R, N = W * H;
  const m = new Uint8Array(N), eq = new Uint8Array(N);
  let any = 0;
  for (const q of corpus) {
    if (q.W !== W || q.H !== H || q.image === image) continue;
    let same = 0;
    for (let i = 0; i < N; i++) { const e = q.image[i] === image[i] ? 1 : 0; eq[i] = e; same += e; }
    /* A portrait cannot be evidence about itself, and a duplicate resource
       would otherwise lock the whole picture. */
    if (same === N) continue;
    for (let y = R; y < H - R; y++) for (let x = R; x < W - R; x++) {
      const i = y * W + x; if (m[i]) continue;
      let ok = 1;
      for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R; dx++)
        if (!eq[i + dy * W + dx]) { ok = 0; break; }
      if (ok) { m[i] = 1; any++; }
    }
  }
  return any ? m : null;
}

/* ------------------------------------------------------------
   The frames themselves, one per family of portraits.

   The same evidence, the other way round: sharedArtMask asks which
   of one portrait's pixels some other portrait also has, and this
   asks which portraits share a frame and what the frame is. The
   maintainer asked for every shared frame to be offered in the
   ditherizer, as the grape frame of Ariethous, Dares and Diomede had
   been drawn out by hand for the sour grapes (27 September 2026).

   Two portraits are linked when at least SHARED_LINK_MIN of their
   pixels have their whole 5x5 neighbourhood alike, the lock's rule.
   Grouping is greedy from the strongest link down, and a merge is
   kept only while the group's frame stays SHARED_FRAME_MIN pixels:
   linked in chains alone, the fountain, the door and a flowering
   bush joined twenty portraits through a white margin and left a
   frame of 292 pixels, and at a strict link the twenty-five mages
   fell apart into pairs. The frame is what every member has alike
   AND reaches the picture's edge through such pixels, so a
   coincidence inside the faces is not taken for it; the rest is
   the hole. A frame shared by nobody is no family. Returns
   [{ members: [resid], image, frame }], image each pixel's commonest
   index among the members and frame a 0/1 mask with its gaps filled
   (offered, below), largest family first.
   ------------------------------------------------------------ */
const SHARED_LINK_MIN = 300, SHARED_FRAME_MIN = 1200;
function sharedPortraitFrames(arc){
  if (!arc) return [];
  return derivedTable(arc, 'sharedPortraitFrames', () => {
    const ps = [];
    for (let n = 0; n < 256; n++) {
      const resid = ((PORTRAIT_SUBN + 1) << 8) | n;
      try {
        const b = getResourceBytes(arc, resid); if (!b) continue;
        const d = decodeResource(arc, b, PORTRAIT_SUBN, resid);
        if (d && d.image && d.W === 64 && d.H === 64) ps.push({ resid, image: d.image });
      } catch (e) { quiet(e); }
    }
    const W = 64, N = W * W, R = SHARED_ART_R, eq = new Uint8Array(N), links = [];
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i].image, b = ps[j].image; let same = 0;
      for (let k = 0; k < N; k++) { eq[k] = a[k] === b[k] ? 1 : 0; same += eq[k]; }
      if (same === N || same < 2 * SHARED_LINK_MIN) continue;
      let lock = 0;
      for (let y = R; y < W - R; y++) for (let x = R; x < W - R; x++) {
        let ok = 1;
        for (let dy = -R; dy <= R && ok; dy++) for (let dx = -R; dx <= R; dx++) if (!eq[(y + dy) * W + x + dx]) { ok = 0; break; }
        lock += ok;
      }
      if (lock >= SHARED_LINK_MIN) links.push([i, j, lock]);
    }
    const frameOf = members => {
      const first = ps[members[0]].image, agree = new Uint8Array(N), frame = new Uint8Array(N), stack = [];
      for (let k = 0; k < N; k++) agree[k] = members.every(m => ps[m].image[k] === first[k]) ? 1 : 0;
      for (let k = 0; k < N; k++) { const x = k % W, y = (k - x) / W; if ((x === 0 || y === 0 || x === W - 1 || y === W - 1) && agree[k]) { frame[k] = 1; stack.push(k); } }
      while (stack.length) {
        const k = stack.pop(), x = k % W;
        for (const j of [k - 1, k + 1, k - W, k + W]) {
          if (j < 0 || j >= N || frame[j] || !agree[j]) continue;
          if ((j === k - 1 && x === 0) || (j === k + 1 && x === W - 1)) continue;
          frame[j] = 1; stack.push(j);
        }
      }
      let n = 0; for (let k = 0; k < N; k++) n += frame[k];
      return { frame, n };
    };
    const groups = ps.map((_, i) => [i]), of = ps.map((_, i) => i);
    links.sort((x, y) => y[2] - x[2]);
    for (const [i, j] of links) {
      const gi = of[i], gj = of[j]; if (gi === gj) continue;
      const merged = groups[gi].concat(groups[gj]);
      if (frameOf(merged).n < SHARED_FRAME_MIN) continue;
      for (const m of groups[gj]) of[m] = gi;
      groups[gi] = merged; groups[gj] = [];
    }
    /* The frame as offered: what frameOf finds, with its gaps filled. A
       pixel where one member's hair or shoulder crosses the border is not
       alike in all of them, so it fell out of the frame and left a hole
       in it, the picture showing through the border (the Seldane's, the
       maintainer, 3 October 2026). The hole proper is the largest region
       the frame leaves; every smaller one is a gap in the border and is
       filled, with the colour most members have there, which is also
       what the frame is painted in everywhere, so no one member's
       crossing art is carried into it. Grouping above still decides on
       the strict frame. */
    const offered = g => {
      const { frame } = frameOf(g), out = new Uint8Array(frame), img = new Uint8Array(N), seen = new Int32Array(N).fill(-1);
      const count = new Uint16Array(256);
      for (let k = 0; k < N; k++) {
        count.fill(0); let best = ps[g[0]].image[k];
        for (const m of g) { const v = ps[m].image[k]; if (++count[v] > count[best]) best = v; }
        img[k] = best;
      }
      const regions = [];
      for (let k0 = 0; k0 < N; k0++) {
        if (out[k0] || seen[k0] >= 0) continue;
        const list = [k0], id = regions.length; seen[k0] = id;
        for (let q = 0; q < list.length; q++) {
          const k = list[q], x = k % W;
          for (const j of [k - 1, k + 1, k - W, k + W]) {
            if (j < 0 || j >= N || out[j] || seen[j] >= 0) continue;
            if ((j === k - 1 && x === 0) || (j === k + 1 && x === W - 1)) continue;
            seen[j] = id; list.push(j);
          }
        }
        regions.push(list);
      }
      let hole = -1; regions.forEach((r, i) => { if (hole < 0 || r.length > regions[hole].length) hole = i; });
      regions.forEach((r, i) => { if (i !== hole) for (const k of r) out[k] = 1; });
      return { image: img, frame: out };
    };
    return groups.filter(g => g.length > 1)
      .map(g => { g.sort((x, y) => ps[x].resid - ps[y].resid); const o = offered(g); return { members: g.map(m => ps[m].resid), image: o.image, frame: o.frame }; })
      .sort((x, y) => y.members.length - x.members.length || x.members[0] - y.members[0]);
  });
}

/* ------------------------------------------------------------
   A frame made of items.

   Meleager's family's frame is items: the axe (tile 0x203) at the
   top-left corner with its drawn pixels flush to the picture's
   corner, the same axe mirrored at the top-right, a shield at each
   foot, and swords along the top and bottom and turned along the
   sides. The maintainer asked for frames like it to be built from
   any item (27 September 2026) and chose corners and edges: one
   item at the four corners, mirrored so that each faces out as the
   axes do, and one along the four edges, as drawn along the top,
   flipped for the bottom and turned for the sides. Turned is the
   top's rows made the left side's columns, so what faces out at
   the top faces out at the side; the right side and the bottom are
   mirrors of the left and the top. An edge item lies along its
   edge, so one taller than wide is turned before any of that.

   Each item is its tile's drawn pixels cropped to their box, at
   their own size. An edge takes as many as fit between the
   corners, evenly spaced, and at least one, centred; the corners
   go on last. Index 0 is a tile's transparency and is the frame's
   too: where the result is 0 the picture shows. Takes two 32x32
   tile images, either of which may be null, and returns a W x H
   array of indices.
   ------------------------------------------------------------ */
function itemFramePixels(corner, edge, W, H) {
  const out = new Uint8Array(W * H);
  const crop = im => {
    if (!im) return null;
    let x0 = 32, y0 = 32, x1 = -1, y1 = -1;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (im[y * 32 + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const w = x1 - x0 + 1, h = y1 - y0 + 1, px = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = im[(y0 + y) * 32 + x0 + x];
    return { w, h, px };
  };
  const put = (it, ox, oy, flipX, flipY, turn) => {
    const w = turn ? it.h : it.w, h = turn ? it.w : it.h;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let sx = flipX ? w - 1 - x : x, sy = flipY ? h - 1 - y : y;
      if (turn) { const t = sx; sx = sy; sy = t; }
      const v = it.px[sy * it.w + sx], X = ox + x, Y = oy + y;
      if (v && X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = v;
    }
  };
  // Where n items of length len go in the span from a to a + span.
  const spread = (a, span, len) => {
    const n = Math.max(1, Math.floor(span / len)), gap = (span - n * len) / (n + 1), at = [];
    for (let k = 0; k < n; k++) at.push(Math.round(a + gap + k * (len + gap)));
    return at;
  };
  const c = crop(corner);
  let e = crop(edge);
  // An edge item lies along its edge, as Meleager's swords do: one taller
  // than it is wide is turned first, or an arrow would stand across the
  // top like a fence and take a third of the picture.
  if (e && e.h > e.w) {
    const px = new Uint8Array(e.w * e.h);
    for (let y = 0; y < e.w; y++) for (let x = 0; x < e.h; x++) px[y * e.h + x] = e.px[x * e.w + y];
    e = { w: e.h, h: e.w, px };
  }
  if (e) {
    const cw = c ? c.w : 0, ch = c ? c.h : 0;
    for (const x of spread(cw, W - 2 * cw, e.w)) { put(e, x, 0, false, false, false); put(e, x, H - e.h, false, true, false); }
    for (const y of spread(ch, H - 2 * ch, e.w)) { put(e, 0, y, false, false, true); put(e, W - e.h, y, true, false, true); }
  }
  if (c) {
    put(c, 0, 0, false, false, false); put(c, W - c.w, 0, true, false, false);
    put(c, 0, H - c.h, false, true, false); put(c, W - c.w, H - c.h, true, true, false);
  }
  return out;
}

/* ------------------------------------------------------------
   Protected pixels.

   Two things are never touched by any stage:

     transparency, so the cut-out can never be dragged into the
     artwork or the artwork smeared out past its own silhouette;

     palette-animated indices E0-FB, whose exact values are chosen
     for their position in a runtime colour cycle and so carry
     meaning that averaging would destroy.

   There used to be a third: pixels the encoder emitted as a long
   run or a distant copy were treated as deliberate structure and
   locked. That was wrong, and measurably so. In dithered artwork
   the dither is itself what compresses into long copies — the
   encoder is matching one patch of noise against another — so
   trusting copies pinned the dither in place instead of the
   drawing. It locked 48% of one portrait and 89% of a texture,
   and scored worse on every resource class tried. Removed.
   ------------------------------------------------------------ */
function buildLockedMask(arc, indexPlane, opt, rgba, W, H){
  const N = rgba ? rgba.length/4 : (indexPlane ? indexPlane.length : 0);
  const locked = new Uint8Array(N);
  for(let i=0;i<N;i++){
    if(opt.protectCutout!==false && rgba && rgba[i*4+3]===0){ locked[i]=1; continue; }
    if(opt.lockAnimated && indexPlane && isAnimatedIndex(indexPlane[i])){ locked[i]=1; continue; }
  }
  /* Third, and the only one that has to look outside this picture: art this
     portrait shares with another, which is its frame. See the block above
     buildLockedMask's neighbour, sharedArtMask. Memoised on the pixels and
     on the archive, since a gallery redraws constantly and the answer depends
     on nothing but the two. */
  if(opt.lockSharedArt!==false && arc && indexPlane && W && H && indexPlane.length===W*H){
    const k = W + 'x' + H + ':' + hashIndices(indexPlane);
    const memo = derivedTable(arc, 'sharedArt', () => new Map());
    let m;
    if(memo.has(k)) m = memo.get(k);
    else { m = sharedArtMask(arc, indexPlane, W, H); memo.set(k, m); }
    if(m) for(let i=0;i<N;i++) if(m[i]) locked[i]=1;
  }
  return locked;
}

function boxMean(src, out, W, H, r, alpha, stride, off){
  const N=W*H;
  const hNum=new Float32Array(N), hDen=new Float32Array(N);
  const pv=new Float64Array(W+1), pm=new Float64Array(W+1);
  for(let y=0;y<H;y++){
    pv[0]=0; pm[0]=0;
    for(let x=0;x<W;x++){
      const i=y*W+x;
      const m=(alpha && alpha[i]===0) ? 0 : 1;
      pv[x+1]=pv[x] + (m ? src[i*stride+off] : 0);
      pm[x+1]=pm[x] + m;
    }
    for(let x=0;x<W;x++){
      const lo=x-r>0?x-r:0, hi=x+r<W-1?x+r:W-1, i=y*W+x;
      hNum[i]=pv[hi+1]-pv[lo];
      hDen[i]=pm[hi+1]-pm[lo];
    }
  }
  const qv=new Float64Array(H+1), qm=new Float64Array(H+1);
  for(let x=0;x<W;x++){
    qv[0]=0; qm[0]=0;
    for(let y=0;y<H;y++){ const i=y*W+x; qv[y+1]=qv[y]+hNum[i]; qm[y+1]=qm[y]+hDen[i]; }
    for(let y=0;y<H;y++){
      const lo=y-r>0?y-r:0, hi=y+r<H-1?y+r:H-1;
      const sm=qm[hi+1]-qm[lo], i=y*W+x;
      out[i*stride+off] = sm>0 ? (qv[hi+1]-qv[lo])/sm : src[i*stride+off];
    }
  }
}

function boxBlur3(src, out, W, H, r, alpha){
  boxMean(src,out,W,H,r,alpha,3,0);
  boxMean(src,out,W,H,r,alpha,3,1);
  boxMean(src,out,W,H,r,alpha,3,2);
}

function boxBlur1(src, out, W, H, r, alpha){ boxMean(src,out,W,H,r,alpha,1,0); }

function smoothstep(a,b,x){
  let t=(x-a)/(b-a); t=t<0?0:t>1?1:t;
  return t*t*(3-2*t);
}

function toFloat3(rgba, N){
  const src=new Float32Array(N*3);
  for(let i=0;i<N;i++){ src[i*3]=rgba[i*4]; src[i*3+1]=rgba[i*4+1]; src[i*3+2]=rgba[i*4+2]; }
  return src;
}

function alphaOf(rgba, N){
  const a=new Uint8Array(N);
  for(let i=0;i<N;i++) a[i] = rgba[i*4+3]===0 ? 0 : 1;
  return a;
}

function detect(src, mean, W, H, thr, diagonals, locked, alpha){
  const N=W*H;
  const res=new Float32Array(N*3), mag=new Float32Array(N), d=new Float32Array(N);
  for(let i=0;i<N*3;i++) res[i]=src[i]-mean[i];
  for(let i=0;i<N;i++){
    const a=res[i*3], b=res[i*3+1], c=res[i*3+2];
    mag[i]=Math.sqrt(a*a+b*b+c*c);
  }
  const AX = diagonals ? AXES_ALL : AXES_STRAIGHT;
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const i=y*W+x;
      if(alpha && alpha[i]===0){ d[i]=0; continue; }
      if(locked && locked[i]){ d[i]=0; continue; }
      const m=mag[i];
      if(m<0.5){ d[i]=0; continue; }
      let best=-2;
      for(let a=0;a<AX.length;a++){
        const ax=AX[a][0], ay=AX[a][1];
        let sum=0, cnt=0;
        for(let k=1;k<=LINE_REACH;k++){
          for(let sg=-1; sg<=1; sg+=2){
            const nx=x+ax*k*sg, ny=y+ay*k*sg;
            if(nx<0||ny<0||nx>=W||ny>=H) continue;
            const j=ny*W+nx;
            if(alpha && alpha[j]===0) continue;
            const mj=mag[j];
            cnt++;
            if(mj<0.5) continue;           /* flat neighbour votes neutral */
            sum += (res[i*3]*res[j*3] + res[i*3+1]*res[j*3+1] + res[i*3+2]*res[j*3+2])/(m*mj);
          }
        }
        if(cnt){ const s=sum/cnt; if(s>best) best=s; }
      }
      const coh = best<-1 ? 1 : best;      /* no support at all: treat as coherent */
      let v = (thr-coh)*8;
      v = v<0?0:v>1?1:v;
      d[i] = v * smoothstep(1.5, 5.0, m);  /* ignore imperceptible wobble */
    }
  }
  return {d, mag};
}

/* ------------------------------------------------------------
   Checkerboard notch.

   Where this artwork is dithered, the dither is usually a checkerboard — but
   not in brightness, which is why it hides from a luminance analysis. It is a
   checkerboard in WHICH RAMP each pixel is taken from: neutral greys
   interleaved with warm browns to make a desaturated skin tone. The two are
   close in lightness and far apart in hue, so the pattern is loud to the eye
   and nearly invisible to any measurement of luma.

   Measured on the choice itself, as a grey-or-brown indicator, 56% of the
   mixed patches in 0x8809 and 45% in Pelagon peak at exactly the checkerboard
   frequency. Others, like 0x8801, have almost none — it varies by resource.

   A checkerboard is the single frequency (pi,pi), so it can be removed by a
   filter that is zero there and one at DC instead of by a blur that attenuates
   everything. Half the centre plus half the mean of the four orthogonal
   neighbours does exactly that: the neighbours are all of opposite phase, so
   they cancel the pattern precisely, while a flat area passes through
   untouched. Diagonal neighbours are deliberately excluded — they share the
   centre's phase and would reinforce what we are trying to null.

   On its own it removes a third of the local variation on every portrait
   tried. It cannot tell a one-pixel pupil from one square of a checkerboard,
   so like the other smoothers it is applied through the dither detector rather
   than everywhere.
   ------------------------------------------------------------ */
function checkerNotch(src, guide, out, W, H, r, edge, alpha){
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const i=y*W+x, o=i*3;
      if(alpha && alpha[i]===0){ out[o]=src[o]; out[o+1]=src[o+1]; out[o+2]=src[o+2]; continue; }
      let s0=0,s1=0,s2=0,n=0;
      for(let k=0;k<4;k++){
        const nx=x+(k===0?1:k===1?-1:0), ny=y+(k===2?1:k===3?-1:0);
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const j=ny*W+nx;
        if(alpha && alpha[j]===0) continue;
        const jo=j*3; s0+=src[jo]; s1+=src[jo+1]; s2+=src[jo+2]; n++;
      }
      if(!n){ out[o]=src[o]; out[o+1]=src[o+1]; out[o+2]=src[o+2]; continue; }
      out[o]  =0.5*src[o]  +0.5*(s0/n);
      out[o+1]=0.5*src[o+1]+0.5*(s1/n);
      out[o+2]=0.5*src[o+2]+0.5*(s2/n);
    }
  }
}

/* ------------------------------------------------------------
   Stray colour repair.

   Some resources carry isolated pixels in a wildly wrong hue — Erechtheus has
   69 magenta ones scattered over his face, from palette index 5 and the far
   end of the magenta ramp. They are quantisation accidents, not paint, and
   they are the most visually offensive thing left in the output because the
   eye finds an out-of-gamut dot instantly.

   Despeckle above will not do the job. It flags a pixel that is isolated and
   far from its neighbours in FULL COLOUR, and that is also an exact
   description of a pupil, which is why it takes the detail you wanted with it.

   The distinction that actually holds is hue. A pupil is extreme in
   brightness but its chroma matches its surroundings — it is a neutral dot in
   a neutral socket. A stray is extreme in chroma: it points somewhere in
   colour space that nothing near it points. Measured on Erechtheus, the
   magenta pixels sit 40 to 160 from their neighbourhood's median chroma;
   Pelagon's and Magpie's pupils sit at 0 to 15. The two populations do not
   overlap anywhere, so a threshold between them separates them completely.

   The isolation test is kept as a second condition so that a small but
   deliberate patch of colour — a gem, a coloured highlight — survives: only a
   pixel with no neighbour of its own hue is treated as an accident.
   ------------------------------------------------------------ */
function fixStrayColours(src, W, H, rgba, T, locked, dLocal, dMin){
  const N=W*H, out=new Float32Array(src), fixed=new Uint8Array(N);
  const cr=new Float32Array(N), cb=new Float32Array(N);
  for(let i=0;i<N;i++){
    const Y=0.299*src[i*3]+0.587*src[i*3+1]+0.114*src[i*3+2];
    cr[i]=src[i*3]-Y; cb[i]=src[i*3+2]-Y;
  }
  const nr=[], nb=[], nbi=[];
  for(let y=0;y<H;y++){
    for(let x=0;x<W;x++){
      const i=y*W+x;
      if(rgba[i*4+3]===0) continue;
      if(locked && locked[i]) continue;
      /* Only inside dithered content. A stray reads as incoherent wherever it
         sits, so the pixel's own detector value cannot tell a magenta accident
         on a cheek from an odd pixel in a drawn frame — both score about 1.
         What separates them is the company they keep: averaged over a
         neighbourhood, a face runs 0.67-0.89 and a drawn frame 0.24-0.59. */
      if(dLocal && dLocal[i] < dMin) continue;
      nr.length=0; nb.length=0; nbi.length=0;
      for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
        if(!dx && !dy) continue;
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const j=ny*W+nx;
        if(rgba[j*4+3]===0) continue;
        nr.push(cr[j]); nb.push(cb[j]); nbi.push(j);
      }
      if(nbi.length<4) continue;
      const sr=nr.slice().sort((a,b)=>a-b), sb=nb.slice().sort((a,b)=>a-b);
      const mr=sr[sr.length>>1], mb=sb[sb.length>>1];
      if(Math.hypot(cr[i]-mr, cb[i]-mb) <= T) continue;      /* hue fits: leave it */
      let kin=false;
      for(let k=0;k<nbi.length;k++)
        if(Math.hypot(cr[i]-nr[k], cb[i]-nb[k]) <= T){ kin=true; break; }
      if(kin) continue;                                      /* part of a coloured patch */
      /* vector median of the neighbours, so the replacement is a colour that
         actually occurs next door rather than an average of several */
      let best=nbi[0], bs=Infinity;
      for(const a of nbi){
        let t=0;
        for(const b of nbi){
          if(a===b) continue;
          t+=Math.hypot(src[a*3]-src[b*3], src[a*3+1]-src[b*3+1], src[a*3+2]-src[b*3+2]);
        }
        if(t<bs){ bs=t; best=a; }
      }
      out[i*3]=src[best*3]; out[i*3+1]=src[best*3+1]; out[i*3+2]=src[best*3+2];
      fixed[i]=1;
    }
  }
  let n=0; for(let i=0;i<N;i++) n+=fixed[i];
  return {out, count:n};
}

/* ------------------------------------------------------------
   Structure-guided upscale.

   Ordinary interpolation has no idea which neighbours belong
   together, so it rounds off exactly the edges the artist drew.
   Here the lock mask is available, and it already knows: a pixel
   the encoder wrote as a long run is on one side of a boundary,
   its unlocked neighbour is on the other. Refusing to mix across
   that boundary keeps silhouettes crisp at 4x while flat interiors
   still interpolate smoothly.
   ------------------------------------------------------------ */
function guidedUpscale(src, W, H, S, locked, alpha, edgeThr){
  const oW=W*S, oH=H*S, N2=oW*oH;
  const out=new Float32Array(N2*3), outAlpha=new Uint8Array(N2);
  const invSr = 1/(2*edgeThr*edgeThr);
  for(let y=0;y<oH;y++){
    for(let x=0;x<oW;x++){
      const lx=(x+0.5)/S-0.5, ly=(y+0.5)/S-0.5;
      const bx=Math.round(lx), by=Math.round(ly);
      const cIdx = Math.max(0,Math.min(H-1,by))*W + Math.max(0,Math.min(W-1,bx));
      const baseLocked = locked ? locked[cIdx] : 0;
      const oIdx = y*oW+x;
      outAlpha[oIdx] = alpha ? alpha[cIdx] : 1;
      if(outAlpha[oIdx]===0) continue;
      let r=0,g=0,b=0,wsum=0;
      for(let dy=-1;dy<=1;dy++){
        for(let dx=-1;dx<=1;dx++){
          const nx=bx+dx, ny=by+dy;
          if(nx<0||ny<0||nx>=W||ny>=H) continue;
          const nIdx=ny*W+nx;
          if(alpha && alpha[nIdx]===0) continue;
          if(locked && locked[nIdx]!==baseLocked) continue;   /* never blend across structure */
          const sdx=nx-lx, sdy=ny-ly;
          const spatial=Math.exp(-(sdx*sdx+sdy*sdy)*2.0);
          const n3=nIdx*3, c3=cIdx*3;
          const c0=src[n3]-src[c3], c1=src[n3+1]-src[c3+1], c2=src[n3+2]-src[c3+2];
          const w = spatial*Math.exp(-(c0*c0+c1*c1+c2*c2)*invSr);
          r+=src[n3]*w; g+=src[n3+1]*w; b+=src[n3+2]*w; wsum+=w;
        }
      }
      const o3=oIdx*3;
      if(wsum>0){ out[o3]=r/wsum; out[o3+1]=g/wsum; out[o3+2]=b/wsum; }
      else { const c3=cIdx*3; out[o3]=src[c3]; out[o3+1]=src[c3+1]; out[o3+2]=src[c3+2]; }
    }
  }
  return {out, outAlpha};
}

function undither(rgba, W, H, p, locked, cls){
  const N=W*H;
  let src=toFloat3(rgba,N);
  const alpha=alphaOf(rgba,N);

  const speck=null, speckCount=0;   /* despeckle is not offered here */

  let strayCount=0;


  const mean=new Float32Array(N*3);
  boxBlur3(src, mean, W, H, p.radius, alpha);

  const d = detect(src, mean, W, H, p.sens, p.diagonals, locked, alpha).d;

  /* How dithered is the NEIGHBOURHOOD, as opposed to the pixel. Drawn artwork
     — a frame, a border pattern, hard linework — is coherent, so this stays
     low across it; a quantised photograph does not, so it runs high. */
  const dLocal=new Float32Array(N);
  boxBlur1(d, dLocal, W, H, 3, alpha);

  if(p.stray>0){
    const sf=fixStrayColours(src, W, H, rgba, p.stray, locked, dLocal, p.strayRegion);
    src=sf.out; strayCount=sf.count;
  }

  if(p.lock){
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const i=y*W+x;
      if(d[i]===0) continue;
      let same=true;
      for(let dy=-1;dy<=1 && same;dy++) for(let dx=-1;dx<=1;dx++){
        if(!dx && !dy) continue;
        const nx=x+dx, ny=y+dy;
        if(nx<0||ny<0||nx>=W||ny>=H) continue;
        const nj=ny*W+nx;
        if(alpha[nj]===0) continue;
        const j=nj*3, o=i*3;
        if(src[j]!==src[o]||src[j+1]!==src[o+1]||src[j+2]!==src[o+2]){ same=false; break; }
      }
      if(same) d[i]=0;
    }
  }

  /* Ping-pong the guide and the output buffer so no pass ever reads
     the array it is writing. `mean` must survive as pass 0's guide,
     which is why the first swap allocates a spare instead of reusing
     it as scratch. */
  /* Only one smoother runs. Combining them was tried and does not pay.

     In sequence, the notch's whole virtue — that it touches exactly one
     frequency and leaves the rest alone — is discarded by whatever general
     filter runs after it: notch-then-guided cleaned 13.3% against guided's
     12.8% and cost proportionally more detail, which is the same point on the
     same curve, slightly further along.

     Mixing them per region does no better. The idea was sound — the local size
     of what the notch removes IS the local checkerboard energy, so you can
     measure which tool suits where — but the blend never rose above the line
     joining the two. Where the detector wants smoothing at all, the
     checkerboard is present, so there is no territory for the general filter
     to win that the notch was losing.

     Cleaning per unit of detail lost, over six portraits: notch 0.56,
     guided 0.40, bilateral 0.37, chained 0.38, mixed 0.38-0.54. The notch is
     the efficient choice and the guided filter the thorough one, and that is a
     real either/or rather than a missing feature. */
  const smooth = checkerNotch;   /* fixed here: the viewer offers no choice */
  let guide=mean, filt=new Float32Array(N*3), spare=null;
  for(let pass=0; pass<p.passes; pass++){
    smooth(src, guide, filt, W, H, p.radius, p.edge, alpha);
    if(pass < p.passes-1){
      if(guide===mean){ spare=spare||new Float32Array(N*3); guide=filt; filt=spare; }
      else { const t=guide; guide=filt; filt=t; }
    }
  }

  let res=new Float32Array(N*3);
  for(let i=0;i<N;i++){
    const isLocked = (locked && locked[i]) || alpha[i]===0;
    const w = isLocked ? 0 : d[i]*p.strength;
    const o=i*3;
    res[o]  =src[o]  +w*(filt[o]  -src[o]);
    res[o+1]=src[o+1]+w*(filt[o+1]-src[o+1]);
    res[o+2]=src[o+2]+w*(filt[o+2]-src[o+2]);
  }

  /* Detail recovery re-sharpens what averaging softened. It only
     makes sense when the dither pattern carried reconstruction
     information (error diffusion). For random-threshold dither
     the pattern is pure noise, so this just re-amplifies what
     was removed — hence the default of zero. */
  if(p.detail>0){
    const b1=new Float32Array(N*3);
    boxBlur3(res, b1, W, H, 1, alpha);
    for(let i=0;i<N;i++){
      if((locked && locked[i]) || alpha[i]===0) continue;
      const w=d[i]*p.strength*p.detail, o=i*3;
      res[o]  +=w*(res[o]  -b1[o]);
      res[o+1]+=w*(res[o+1]-b1[o+1]);
      res[o+2]+=w*(res[o+2]-b1[o+2]);
    }
  }

  /* Dither coverage is a property of the source, so measure it in
     source space before any upscale changes the pixel count. */
  let dsum=0, dcount=0;
  for(let i=0;i<N;i++) if(alpha[i]){ dsum+=d[i]; dcount++; }

  /* Captured before any resampling touches it: the restore below pulls
     undithered pixels back to exactly this. */
  const resNative = res;
  let outW=W, outH=H, outAlpha=alpha, S=p.upscale|0 || 1;
  if(S>1){
    /* Unlike the smoothers, these two are estimators of the same unknown — the
       colour of a sub-pixel that was never recorded — so averaging them has a
       reason to work, and it half does.

       Tested against known truth (take a reconstruction as the answer,
       halve it, upscale back, measure the error) xBR is the most accurate at
       32.62 RMSE, the average second at 32.82 and the guided upscale third at
       33.30. The average won on three of the six resources and was never the
       worst on any, so it is a fair hedge — but it never beat simply picking
       xBR, so it is not free accuracy.

       The guided upscale stays the default despite coming third, because that
       ranking is about edges and gradients and this artwork's hardest content
       is one-pixel features. At the shipped settings xBR lifts Magpie's pupils
       to 25 and 29 where the guided upscale holds them at 16: a lone pupil has
       no edge direction for xBR to commit to, so it gets averaged along a
       direction that is not there. */
    const up = guidedUpscale(res, W, H, S, locked, alpha, p.edge);
    res=up.out; outAlpha=up.outAlpha; outW=W*S; outH=H*S;

    /* Supersampling. Interpolate with the structure guide, then average each
       SxS block back down to one pixel. The point is not resolution — you end
       up the size you started — it is tonal depth. The guided upscale invents
       intermediate samples along each edge, and averaging them produces
       colours that were not in the palette at all, so a two-tone dithered
       ramp comes back as a genuine gradient instead of two flat steps.
       Transparency is decided by majority so the silhouette stays hard. */
    if(p.supersample){
      const down=new Float32Array(W*H*3), downA=new Uint8Array(W*H);
      const n=S*S;
      for(let y=0;y<H;y++){
        for(let x=0;x<W;x++){
          let s0=0,s1=0,s2=0,cnt=0;
          for(let dy=0;dy<S;dy++) for(let dx=0;dx<S;dx++){
            const j=(y*S+dy)*outW + (x*S+dx);
            if(!up.outAlpha[j]) continue;
            const o=j*3; s0+=res[o]; s1+=res[o+1]; s2+=res[o+2]; cnt++;
          }
          const i=y*W+x, o=i*3;
          downA[i] = cnt*2 >= n ? 1 : 0;
          if(cnt){ down[o]=s0/cnt; down[o+1]=s1/cnt; down[o+2]=s2/cnt; }
        }
      }
      res=down; outAlpha=downA; outW=W; outH=H; S=1;
    }
  }

  /* Undo the drift that resampling adds to pixels the filter deliberately
     left alone.

     Zero blend weight is not enough by itself. A pixel the detector scored at
     zero comes out of the filter untouched, but the upscaler still resamples
     it and the downsample averages it with its neighbours, so it moves anyway.
     That is what was softening the Greek key on Erechtheus and turning the
     cream mat black on Pelagon.

     The weight to undo it by is the one already in hand: w = d * strength is
     exactly how much of this pixel was meant to change, so pulling the output
     back toward the pre-upscale result by (1 - w) restores an undithered pixel
     exactly, leaves a fully dithered one entirely alone, and slides smoothly
     between. No geometry, no threshold, and it follows the frame's real shape
     rather than a rectangle that would eat the face wherever the face reaches
     the edge. */
  const M=outW*outH;
  const out=new Uint8ClampedArray(M*4), map=new Uint8ClampedArray(M*4);
  const seen=new Set();
  for(let y=0;y<outH;y++){
    for(let x=0;x<outW;x++){
      const i=y*outW+x, o=i*3;
      /* Nearest source pixel — the map and the restore below both need it. */
      const sx = S===1 ? x : (x/S)|0, sy = S===1 ? y : (y/S)|0;
      const sIdx = sy*W + sx;

      let r0=res[o], r1=res[o+1], r2=res[o+2];
      if(res !== resNative){
        const w = Math.min(1, d[sIdx]*p.strength);
        if(w < 1){
          const n3=sIdx*3, kk=1-w;
          r0 += kk*(resNative[n3]  -r0);
          r1 += kk*(resNative[n3+1]-r1);
          r2 += kk*(resNative[n3+2]-r2);
        }
      }
      out[i*4]=r0; out[i*4+1]=r1; out[i*4+2]=r2;
      const a = out[i*4+3] = outAlpha[i] ? 255 : 0;
      if(a>0 && seen.size<300000) seen.add((out[i*4]<<16)|(out[i*4+1]<<8)|out[i*4+2]);

      const lum=(rgba[sIdx*4]*0.299+rgba[sIdx*4+1]*0.587+rgba[sIdx*4+2]*0.114)*0.22;
      if(speck && speck[sIdx]){ map[i*4]=lum; map[i*4+1]=lum+220; map[i*4+2]=lum+90; }
      else { map[i*4]=lum+208*d[sIdx]; map[i*4+1]=lum; map[i*4+2]=lum+212*d[sIdx]; }
      map[i*4+3]=alpha[sIdx]?255:0;
    }
  }
  return {out, map, pct: dcount?dsum/dcount:0, colors: seen.size, specks: speckCount, strays: strayCount, outW, outH};
}

// Indexed resource in, undithered ImageData out. Cached per archive: a
// gallery redraws constantly (hover, palette cycling, mode changes) and this
// is far too much work to repeat for a picture that has not changed. The
// archive is part of what the answer depends on, through the frame lock,
// which reads every other portrait in it.
function unditherIndexed(arc, W, H, image, transparentIndex, palette, key) {
  // The preset belongs in the key: the same pixels under the other settings
  // are a different picture, and a gallery that switched would show the one
  // it had already made.
  if (key) key = ((typeof window !== 'undefined' && window.UNDITHER_PRESET) || 'original') + ':' + key;
  const cache = derivedTable(arc, 'undithered', () => new Map());
  if (key && cache.has(key)) return cache.get(key);
  const P = palette || PAL_RGB;
  const t = (transparentIndex === undefined || transparentIndex === null) ? -1 : transparentIndex;
  const N = W * H;
  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const v = image[i];
    if (v === t) continue;
    const c = P[v] || [0,0,0];
    rgba[i*4]=c[0]; rgba[i*4+1]=c[1]; rgba[i*4+2]=c[2]; rgba[i*4+3]=255;
  }
  const P2 = activeUD();
  const locked = buildLockedMask(arc, image, P2, rgba, W, H);
  const r = undither(rgba, W, H, P2, locked, null);
  const out = new ImageData(new Uint8ClampedArray(r.out), r.outW, r.outH);
  if (key) {
    if (cache.size > 400) cache.clear();
    cache.set(key, out);
  }
  return out;
}
function hashIndices(image) {
  let h = 2166136261;
  for (let i = 0; i < image.length; i++) { h ^= image[i]; h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
// Categories drawn as cut-outs rather than full-bleed images.
// Palette index 0 is Delver's transparent slot across the board, not just for
// portraits: skill icons, tile sheets and general graphics are all cut-outs
// drawn over a background. Maps and landscapes are full-bleed and keep it.
// Skill icons (137) are full-bleed 32x16 buttons, not cut-outs: index 0 is a
// real colour in them, and treating it as the void punched holes through the
// middle of every icon.
const TRANSPARENT_SUBN = new Set([135, 141, 142, 143]);
function transparentIndexFor(subn) { return TRANSPARENT_SUBN.has(subn) ? 0 : null; }

// Renders the currently-selected Map resource (subindex 127) plus its
// matching Prop List (subindex 128, same low byte, resid+0x0100) onto
// a canvas, showing an actual top-down picture instead of a data table.
// --- Tile attributes (resource 0xF002) -----------------------------------
// 8192 4-byte big-endian records: the first 0x1000 describe simple tiles,
// the last 0x1000 describe composed tiles. Bits 0xC0 encode how many map
// squares a prop's sprite spans, which is how large creatures and big
// objects (beds, tables, trees) are drawn across more than one tile.
function getTileAttributes(arc) {
  return derivedTable(arc, 'tileAttributes', () => {
    const data = getResourceBytes(arc, 0xF002);
    if (!data) return [];
    const n = Math.floor(data.length / 4);
    const arr = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      arr[i] = u32be(data, i*4);
    }
    return arr;
  });
}
function isCompletelyWhite(image) {
  let nonwhite=0;
  for (let i=0; i<image.length; i++) { const v=image[i]; if (v!==0 && v!==15 && v!==16 && v!==48 && v!==255) { nonwhite++; if(nonwhite>2) return false; } }
  return image.length > 0;
}

/* The other shapes a 16-tile sheet can be shown in. reshapeTileSheetGrid
 * above is the 4x4 the gallery always drew; these are the native column the
 * archive actually stores (identity), the transposed single row, and the
 * 4x4 with gutters so each tile reads separately. All return indexed pixels
 * like every decoder here, so they stay checkable; the gutters are palette
 * index 0, the transparent slot. */
function reshapeTileSheetRow(W, H, image) {
  if (W !== 32 || H !== 512) return {W, H, image};
  const out = new Uint8Array(512 * 32);
  for (let t = 0; t < 16; t++)
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        out[y * 512 + t * 32 + x] = image[(t * 32 + y) * 32 + x];
  return {W: 512, H: 32, image: out};
}
function reshapeTileSheetTiles(W, H, image, gap) {
  if (W !== 32 || H !== 512) return {W, H, image};
  const g = gap || 3;
  const side = 4 * 32 + 3 * g;
  const out = new Uint8Array(side * side);
  for (let t = 0; t < 16; t++) {
    const gx = (t % 4) * (32 + g), gy = Math.floor(t / 4) * (32 + g);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++)
        out[(gy + y) * side + (gx + x)] = image[(t * 32 + y) * 32 + x];
  }
  return {W: side, H: side, image: out};
}
function reshapeTileSheet(W, H, image, mode) {
  if (mode === 'column') return {W, H, image};
  if (mode === 'row') return reshapeTileSheetRow(W, H, image);
  if (mode === 'tiles') return reshapeTileSheetTiles(W, H, image);
  return reshapeTileSheetGrid(W, H, image);
}

/* ------------------------------------------------------------
   The other direction: full colour IN, Cythera OUT.

   ditherToCytheraPalette is the deliberate inverse of the undither above.
   The undither's own analysis (see the checkerboard-notch comment) found
   that this artwork's dither is a checkerboard in WHICH RAMP each pixel is
   taken from -- greys interleaved with warm browns for skin, close in
   lightness, far in hue -- the single frequency (pi,pi). So the way to make
   an arbitrary image look like this artwork is to produce exactly that
   pattern: for each pixel, either the one palette entry nearest the target
   colour, or the better of a PAIR of entries laid out on the global
   checkerboard phase, whichever approximates it best. Pairs are ordered by
   luminance before the phase is applied, so a region that chooses the same
   pair renders as one coherent checker rather than pixel noise.

   Palette slots 0 (the transparent cut-out slot -- portraits sit on it) and
   0xE0-0xFB (the palette-cycling ramps the engine animates for lava, water
   and magic) are never chosen for opaque pixels unless asked; a portrait
   that borrowed an animated slot would shimmer with the sea.

   checker (0..1, default 0.6) sets how eagerly a pair beats a flat pixel:
   at 0 the result is plain nearest-colour quantisation; at 1 any pair that
   is at all better wins and everything shimmers with pattern.
   ------------------------------------------------------------ */
function ditherToCytheraPalette(rgba, W, H, opts) {
  const o = opts || {};
  const checker = o.checker === undefined ? 0.6 : Math.max(0, Math.min(1, o.checker));
  const allowAnimated = !!o.allowAnimated;
  // The checker setting is the most contrast a pair may have, from none at
  // 0 to black beside white at 1, in the weighted distance below (whose
  // square root runs 0 to 765). A pair is used when it beats the flat
  // colour and stays under that contrast. It used to be a factor the pair
  // had to beat the flat error by, 0.4 at the first notch, which most pairs
  // beat, so the slider went from nothing to everything in its first
  // notch (the maintainer, 9 September 2026). The undither merges a checker
  // whatever its contrast, so this is the perceptual half of the inverse:
  // a low-contrast pair reads as a mixed colour, a high one as noise.
  // Squared, so the first third of the slider admits only neighbours on a
  // ramp and the top opens up quickly: linear was most of the way at 0.1.
  const maxContrast = checker * checker * 765;
  // opts.usable: the only palette indices to draw with, when given -- the
  // Seldane portraits' colours, say -- and animated ramps still excluded
  // unless allowed.
  const usable = [];
  for (const i of (o.usable && o.usable.length ? o.usable : Array.from({ length: 255 }, (_, k) => k + 1))) {
    if (i < 1 || i > 255) continue;
    if (!allowAnimated && i >= 0xE0 && i <= 0xFB) continue;
    usable.push(i);
  }
  if (!usable.length) usable.push(255);
  /* opts.tones: an ordered ramp of indices, darkest first, to draw by
     LIGHTNESS alone -- the Seldane portraits, which are one teal-blue ramp
     whatever the colour of the thing they show. Matching a photograph's
     colours to a handful of greens and blues by distance put each pixel on
     whichever hue happened to be nearest, so a smooth cheek broke into
     bands of unrelated colours (the maintainer, 22 September 2026: "too
     stepped"). Here a pixel's lightness is placed on the ramp and drawn as
     the nearest step or as a checker of the two steps either side of it,
     under the same contrast limit the slider sets for pairs. */
  if (o.tones && o.tones.length) return ditherByTone(rgba, W, H, o.tones, maxContrast);
  const dist = (r, g, b, c) =>
    2 * (r - c[0]) * (r - c[0]) + 4 * (g - c[1]) * (g - c[1]) + 3 * (b - c[2]) * (b - c[2]);
  const luma = i => PAL_RGB[i][0] * 3 + PAL_RGB[i][1] * 6 + PAL_RGB[i][2];
  const K = 12;
  const out = new Uint8Array(W * H);
  // Memoise per quantised colour: photographs repeat colours constantly, and
  // the pair search over the shortlist is the expensive part.
  const memo = new Map();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (rgba[p + 3] < 128) { out[y * W + x] = 0; continue; }
      const r = rgba[p], g = rgba[p + 1], b = rgba[p + 2];
      const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
      let sol = memo.get(key);
      if (!sol) {
        const short = usable.map(i => [dist(r, g, b, PAL_RGB[i]), i])
          .sort((a, c) => a[0] - c[0]).slice(0, K);
        const flatErr = short[0][0], flat = short[0][1];
        let best = null, bestErr = Infinity;
        if (maxContrast > 0) for (let a = 0; a < short.length; a++)
          for (let c = a + 1; c < short.length; c++) {
            const A = PAL_RGB[short[a][1]], B = PAL_RGB[short[c][1]];
            if (Math.sqrt(dist(A[0], A[1], A[2], B)) > maxContrast) continue;
            const e = dist(r, g, b, [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2]);
            if (e < bestErr) { bestErr = e; best = [short[a][1], short[c][1]]; }
          }
        if (best && bestErr < flatErr) {
          if (luma(best[0]) > luma(best[1])) best = [best[1], best[0]];
          sol = { pair: best };
        } else sol = { flat };
        memo.set(key, sol);
      }
      out[y * W + x] = sol.pair ? sol.pair[(x + y) & 1] : sol.flat;
    }
  }
  return out;
}

function ditherByTone(rgba, W, H, tones, maxContrast) {
  const Y = i => 0.3 * PAL_RGB[i][0] + 0.59 * PAL_RGB[i][1] + 0.11 * PAL_RGB[i][2];
  const ramp = tones.slice().sort((a, b) => Y(a) - Y(b));
  const ys = ramp.map(Y);
  // The contrast limit is in the weighted RGB distance's units (0 to 765);
  // a lightness step of d is about d * 3 of those for a grey.
  const maxStep = maxContrast / 3;
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = (y * W + x) * 4;
      if (rgba[p + 3] < 128) { out[y * W + x] = 0; continue; }
      const t = 0.3 * rgba[p] + 0.59 * rgba[p + 1] + 0.11 * rgba[p + 2];
      let k = 0;
      while (k + 1 < ys.length && ys[k + 1] <= t) k++;
      // Nearest single step.
      let best = ramp[k], err = Math.abs(ys[k] - t);
      if (k + 1 < ys.length && Math.abs(ys[k + 1] - t) < err) { best = ramp[k + 1]; err = Math.abs(ys[k + 1] - t); }
      // The checker of the steps either side, where it is closer and within
      // the contrast the slider allows.
      if (k + 1 < ys.length && ys[k + 1] - ys[k] <= maxStep && Math.abs((ys[k] + ys[k + 1]) / 2 - t) < err)
        best = ((x + y) & 1) ? ramp[k + 1] : ramp[k];
      out[y * W + x] = best;
    }
  }
  return out;
}

/* Indexed pixels -> Delver Compressed Graphics, using only the literal-data
 * opcodes: 0xC0-0xCF chunks of 4..64 pixels, a 0xD0-0xDF nibble chunk for a
 * sub-4 remainder, 0xFF to terminate. The same store-only trade the ZIP
 * writer makes: bigger than DelvEd's output and byte-for-byte decodable by
 * every decompressor in sight -- delvmod's own literal emitter (the 0xC0
 * chunker at the end of graphics.py compress) is the model.
 * delv_write_check.mjs proves decompressDCG AND delvmod's DelvImage both
 * decode this encoding back to the exact input. */
function encodeDCGLiterals(indexed) {
  const out = new Uint8Array(indexed.length + Math.ceil(indexed.length / 64) + 2);
  let p = 0, i = 0;
  while (indexed.length - i >= 4) {
    const chunk = Math.min(64, (indexed.length - i) & ~3);
    out[p++] = 0xC0 + (chunk >> 2) - 1;
    out.set(indexed.subarray(i, i + chunk), p);
    p += chunk; i += chunk;
  }
  const rem = indexed.length - i;
  if (rem) {
    out[p++] = 0xD0 | rem;
    out.set(indexed.subarray(i), p);
    p += rem;
  }
  out[p++] = 0xFF;
  return out.subarray(0, p);
}

/* Indexed pixels -> Delver Compressed Graphics with runs as well as
 * literals (8 October 2026): a run of three or more of one index is a Short
 * Run (0xE0 + length - 3, the index; to 18) or a Long Run (0xF0, length - 3,
 * the index; to 258), and what lies between runs goes out as
 * encodeDCGLiterals writes it. No back-copies. It is for pictures made of
 * flat blocks (redrawDelverArt, below), which literals alone would write
 * at a byte a pixel: the 59 full pictures would come to several megabytes.
 * The decoder is the check: redrawDelverArt decodes every stream it writes
 * and keeps the literal encoding where the two differ. */
function encodeDCGRuns(indexed) {
  const out = [];
  const literals = (from, to) => {
    let i = from;
    while (to - i >= 4) {
      const chunk = Math.min(64, (to - i) & ~3);
      out.push(0xC0 + (chunk >> 2) - 1);
      for (let k = 0; k < chunk; k++) out.push(indexed[i + k]);
      i += chunk;
    }
    if (to - i) { out.push(0xD0 | (to - i)); for (; i < to; i++) out.push(indexed[i]); }
  };
  let i = 0, lit = 0;
  while (i < indexed.length) {
    let n = 1;
    while (i + n < indexed.length && indexed[i + n] === indexed[i] && n < 258) n++;
    if (n < 3) { i += n; continue; }
    literals(lit, i);
    if (n <= 18) out.push(0xE0 + n - 3, indexed[i]); else out.push(0xF0, n - 3, indexed[i]);
    i += n; lit = i;
  }
  literals(lit, indexed.length);
  out.push(0xFF);
  return Uint8Array.from(out);
}

/* EVERY PICTURE REDRAWN, BADLY (8 October 2026), for a scenario made on the
   page. The maintainer asked for a version of the game with none of its
   art, the stand-ins "hilariously bad", and, shown a first try that cut
   each picture into flat blocks, said what he meant: a complete
   replacement at full resolution, a black and white stick man for the
   hero, the look of a Flash game. So nothing of a picture survives here
   but its size, where it was see-through, and the colour it had most of,
   which is what keeps grass green and water (a cycling index) moving.

     a figure   a tile the caller names (`figures`: tile id to 'hero',
                'person' or 'beast', with the frame's place in its run): a
                stick man in thick black lines with a white head, wearing
                a shirt of the old tile's colour unless he is the hero; a
                beast is a bar on four legs. The frame number moves the
                legs and arms and turns the figure round, so a walk still
                flickers.
     a thing    any other tile with see-through pixels: one black-rimmed
                blob of its colour, filling the box the old art filled
     ground     a tile with none: its colour flat, and a few strokes of its
                second colour where the tile's number puts them
     a portrait a round face on the old background, eyes looking different
                ways, a mouth and hair that the resource's number chooses
     a landscape, an icon, a picture: flat colour with a sun, a rim, or a
                few dots

   Index 0 is see-through in a sheet and is kept exactly where the new
   drawing leaves a gap. Black, white, red and yellow are found in the
   palette by nearness, not typed as indices. A picture that does not
   decode is left as it is. The pictures in the application and in the
   resource forks are not touched: this is the data fork's art only. Bytes
   in, bytes out. */
function badArtIndex(r, g, b) {
  let best = 1, err = Infinity;
  for (let i = 1; i < PALETTE_CYCLES[0][0]; i++) {
    const v = parseInt(PALETTE[i], 16), e = ((v >> 16) - r) ** 2 + (((v >> 8) & 255) - g) ** 2 + ((v & 255) - b) ** 2;
    if (e < err) { err = e; best = i; }
  }
  return best;
}
// A canvas of indices with the four things the drawings are made of.
function badArtCanvas(image, W, H) {
  const c = { image, W, H };
  c.px = (x, y, v) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) image[y * W + x] = v; };
  c.box = (x, y, w, h, v) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) c.px(i, j, v); };
  c.disc = (cx, cy, rx, ry, v) => { for (let j = Math.floor(cy - ry); j <= cy + ry; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) if (((i - cx) / (rx || 1)) ** 2 + ((j - cy) / (ry || 1)) ** 2 <= 1) c.px(i, j, v); };
  c.line = (x0, y0, x1, y1, v, t) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k++) c.box(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), t || 1, t || 1, v); };
  return c;
}
// The two indices a region has most of, see-through left out; null when it has none.
function badArtColours(image, W, x0, y0, w, h) {
  const n = new Uint32Array(256);
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) n[image[y * W + x]]++;
  n[0] = 0;
  let a = 0, b = 0;
  for (let i = 1; i < 256; i++) if (n[i] > n[a]) a = i;
  for (let i = 1; i < 256; i++) if (i !== a && n[i] > n[b]) b = i;
  return n[a] ? [a, n[b] ? b : a] : null;
}
function badArtHash(n) { let v = (n + 0x9E3779B9) >>> 0; v = Math.imul(v ^ (v >>> 15), 0x85EBCA6B); v = Math.imul(v ^ (v >>> 13), 0xC2B2AE35); return (v ^ (v >>> 16)) >>> 0; }
function badArtTile(old, tileId, figure, ink) {
  const out = new Uint8Array(1024), c = badArtCanvas(out, 32, 32), cols = badArtColours(old, 32, 0, 0, 32, 32);
  if (!cols) return out;
  const [main, second] = cols, h = badArtHash(tileId);
  if (figure) {
    const f = figure.frame, flip = (f >> 2) & 1 ? -1 : 1, step = f & 1 ? 5 : 2, arm = (f >> 1) & 1 ? -6 : 3;
    if (figure.kind === 'beast') {
      c.line(8, 18, 22, 18, ink.black, 5); c.line(9, 18, 21, 18, main, 3);
      for (const x of [9, 13, 19, 23]) c.line(x, 22, x + (f & 1 ? 2 : -1), 29, ink.black, 2);
      c.disc(16 + flip * 11, 15, 4, 4, ink.black); c.disc(16 + flip * 11, 15, 2.5, 2.5, ink.white);
      c.line(16 - flip * 9, 18, 16 - flip * 13, 12, ink.black, 2);
    } else {
      c.line(16, 11, 16, 21, ink.black, 2);
      if (figure.kind !== 'hero') c.box(13, 12, 8, 8, main);
      c.line(16, 13, 16 - 7, 13 + arm, ink.black, 2); c.line(16, 13, 16 + 7, 13 - arm + 3, ink.black, 2);
      c.line(16, 21, 16 - step, 30, ink.black, 2); c.line(16, 21, 16 + step, 30, ink.black, 2);
      c.disc(16.5, 6, 5, 5, ink.black); c.disc(16.5, 6, 3.5, 3.5, ink.white);
      c.px(16 + flip * 2, 6, ink.black); c.px(17 + flip * 2, 6, ink.black);
    }
    return out;
  }
  if (old.includes(0)) {
    let x0 = 32, y0 = 32, x1 = -1, y1 = -1;
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (old[y * 32 + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = Math.max(2, (x1 - x0) / 2), ry = Math.max(2, (y1 - y0) / 2);
    c.disc(cx, cy, rx, ry, ink.black); c.disc(cx, cy, Math.max(1, rx - 2), Math.max(1, ry - 2), main);
    if (rx > 5 && ry > 5) c.box(Math.round(cx - rx / 3), Math.round(cy - ry / 3), 2, 2, second === main ? ink.white : second);
    return out;
  }
  out.fill(main);
  for (let k = 0; k < 4; k++) { const v = badArtHash(h + k), x = 3 + (v % 24), y = 3 + ((v >> 8) % 24); c.line(x, y + 4, x + 3, y, second === main ? ink.black : second, 1); }
  return out;
}
function badArtPicture(d, subn, resid, ink) {
  const { W, H } = d, cols = badArtColours(d.image, W, 0, 0, W, H);
  if (!cols) return d.image;
  const out = new Uint8Array(W * H).fill(cols[0]), c = badArtCanvas(out, W, H), h = badArtHash(resid);
  if (subn === 135) {
    const r = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2 + 2;
    c.disc(cx, cy, r + 2, r + 2, ink.black); c.disc(cx, cy, r, r, cols[1] === cols[0] ? ink.white : cols[1]);
    for (let k = 0; k < 5 + (h % 6); k++) { const x = cx - r + (badArtHash(h + k) % Math.round(2 * r)); c.line(x, cy - r - 4 + (k % 3), x + ((h >> k) & 1 ? 4 : -4), cy - r * 0.55, ink.black, 2); }
    for (const [sx, look] of [[-1, h & 3], [1, (h >> 2) & 3]]) {
      const ex = cx + sx * r * 0.4, ey = cy - r * 0.2;
      c.disc(ex, ey, 5, 5, ink.black); c.disc(ex, ey, 3.5, 3.5, ink.white); c.box(Math.round(ex + (look & 1 ? 1 : -2)), Math.round(ey + (look & 2 ? 1 : -2)), 2, 2, ink.black);
    }
    const bend = [3, 0, -3][(h >> 4) % 3];
    c.line(cx - r * 0.45, cy + r * 0.45, cx, cy + r * 0.45 + bend, ink.red, 2); c.line(cx, cy + r * 0.45 + bend, cx + r * 0.45, cy + r * 0.45, ink.red, 2);
  } else if (subn === 131) {
    const low = badArtColours(d.image, W, 0, H >> 1, W, H - (H >> 1));
    if (low) c.box(0, H >> 1, W, H - (H >> 1), low[0]);
    c.disc(20 + (h % (W - 40)), 8, 6, 6, ink.yellow);
    for (let k = 0; k < 3; k++) { const x = 30 + (badArtHash(h + k) % (W - 60)); c.line(x, 6, x + 3, 9, ink.black); c.line(x + 3, 9, x + 6, 6, ink.black); }
  } else if (subn === 137) {
    for (let x = 0; x < W; x++) { c.px(x, 0, ink.black); c.px(x, H - 1, ink.black); }
    for (let y = 0; y < H; y++) { c.px(0, y, ink.black); c.px(W - 1, y, ink.black); }
    c.line(8, H - 4, W - 9, 3, cols[1] === cols[0] ? ink.black : cols[1], 2);
  } else {
    for (let k = 0; k < Math.max(4, (W * H) >> 10); k++) { const v = badArtHash(h + k); c.box(v % W, (v >> 10) % H, 2, 2, cols[1]); }
  }
  return out;
}
/* `from`, when given, is asked first: from.tile(id, old, figure) for a
   tile's 1,024 indices, from.portrait(resid, W, H, d) for a portrait's and
   from.picture(subn, resid, d) for any other picture's, d the old picture
   decoded; null from any of them leaves the drawing here to do it. It is
   how an art pack stands in (delv-artpack.js; the page's scenarioPackArt)
   and how the careful set does (delv-fineart.js; scenarioFineArt). */
function redrawDelverArt(bytes, figures, from) {
  const arc = openDelverArchive(bytes), spec = delverArchiveSpec(bytes);
  if (!arc || !spec) return null;
  const ink = { black: badArtIndex(0, 0, 0), white: badArtIndex(255, 255, 255), red: badArtIndex(220, 0, 0), yellow: badArtIndex(252, 220, 0) };
  let drawn = 0;
  const resources = spec.resources.map(r => {
    let subn = (r.resid >> 8) - 1;
    if (!CANONICAL_SIZE[subn]) return r;
    try {
      if (subn === 141 && tileSheetIsSized(arc, r.resid, r.data)) subn = 142;
      const d = decodeResource(arc, r.data, subn, r.resid);
      let image;
      if (subn === 141) {
        // Sixteen tiles of 32 by 32 down a column; the sheet's low byte
        // times sixteen is its first tile's number.
        image = new Uint8Array(d.image.length);
        for (let t = 0; t < 16; t++) {
          const id = ((r.resid & 0xFF) << 4) + t;
          const old = d.image.subarray(t * 1024, t * 1024 + 1024), given = from && from.tile ? from.tile(id, old, figures && figures[id]) : null;
          image.set(given || badArtTile(old, id, figures && figures[id], ink), t * 1024);
        }
      } else image = (subn === 135 && from && from.portrait && from.portrait(r.resid, d.W, d.H, d)) || (subn !== 135 && from && from.picture && from.picture(subn, r.resid, d)) || badArtPicture(d, subn, r.resid, ink);
      let data;
      if (UNCOMPRESSED[subn]) data = image;
      else {
        // The sized header is decodeResource's read backwards, as the
        // page's encodeGraphicResource writes it: the stream holds the
        // width rounded up to four.
        const flags = HAS_HEADER[subn] ? d.W & 3 : 0, logW = d.W - flags + (flags ? 4 : 0);
        let buf = image;
        if (logW !== d.W) { buf = new Uint8Array(logW * d.H); for (let y = 0; y < d.H; y++) buf.set(image.subarray(y * d.W, y * d.W + d.W), y * logW); }
        let body = encodeDCGRuns(buf);
        const back = decompressDCG(body, logW, d.H);
        if (back.length !== buf.length || back.some((v, i) => v !== buf[i])) body = encodeDCGLiterals(buf);
        if (HAS_HEADER[subn]) {
          const v = ((((d.W - flags) >> 2) << 18) | (flags << 16) | ((d.H >> 1) << 1) | (d.H & 1)) >>> 0;
          data = new Uint8Array(4 + body.length);
          data.set([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]); data.set(body, 4);
        } else data = body;
      }
      drawn++;
      return Object.assign({}, r, { data });
    } catch (e) { quiet(e, 'a picture left as it is'); return r; }
  });
  return { bytes: writeDelverArchive(Object.assign({}, spec, { resources })), drawn };
}

/* ---- recolouring the hero ------------------------------------------------
   The hero and the heroine are prop types 32 and 33, and each is drawn from
   one tile sheet of sixteen 32x32 frames that nothing else in the game points
   into. A patch that replaces that one sheet therefore changes how the player
   looks and nothing else, which is what makes it the plainest demonstration
   of what a Magpie patch can do: `HERO_SPRITES` below is the table, and the
   page's section under Hackery (heroSpriteSection in page-mechanics.js) is
   what drives it.

   WHICH PIXEL IS WHICH PART IS NOT IN THE FILE. The art is flat indexed
   pixels with no layer saying "hair" or "shirt", so the table is the one part
   of this that is a judgement rather than a reading, and it was made by
   looking: every index each sheet uses was drawn in false colour, frame by
   frame, on 17 September 2026. Most indices belong to one part outright
   (`sure`). A few are shared, because the artist reached for the same brown
   to shade a forearm and to draw a belt, or the same grey for a halter and a
   boot. Those are settled per connected run of pixels: a run of shared shades
   goes to whichever part its neighbours vote for (`votes`, where a part named
   twice counts twice), and to `otherwise` when nothing it touches has a vote,
   which is what a boot that meets only the black outline and a legging looks
   like. The black outline and the two near-blacks (0x1D, 0x1E) belong to no
   part and are never recoloured, so the silhouette is the shipped one, and
   neither is anything in a figure's `fixed` list.

   The indices are this release's art. A patch or a mod that redraws the
   sheet leaves them describing pixels that are no longer there, which is why
   the page labels the file as it arrived and says what it did not recognise
   rather than recolouring a guess. */
const HERO_SPRITES = [
  { key: 'hero', proptype: 32,
    // Two pixels of 0xDB, one in each of two frames, both in the face between
    // skin and hair: an eye, left as drawn.
    fixed: [0xDB],
    parts: [
      { key: 'hair', label: 'hair', sure: [0x22, 0x35, 0x36, 0x37, 0x38, 0x39] },
      { key: 'skin', label: 'skin', sure: [0xA3, 0xA4, 0xA6, 0xA8, 0xAB, 0xAD, 0xB2, 0xB3, 0xB4] },
      { key: 'shirt', label: 'shirt', sure: [0x76, 0x78, 0x79, 0x7A, 0x7B, 0x7C, 0x7D, 0x7E] },
      { key: 'trousers', label: 'trousers', sure: [0x07, 0x08, 0x12, 0x13, 0x14, 0x16, 0x17, 0x18, 0x19, 0x1B, 0x1C] },
      { key: 'belt', label: 'belt and sandals', sure: [0x46, 0xB5, 0xB6, 0xB8] },
    ],
    // The browns shade the arms and face and also draw the belt; the belt is
    // the run that sits against the trousers.
    shared: [
      { idx: [0x82, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E],
        votes: { skin: ['skin', 'hair', 'shirt'], belt: ['trousers', 'trousers', 'belt'] }, otherwise: 'skin' },
    ] },
  { key: 'heroine', proptype: 33,
    parts: [
      { key: 'hair', label: 'hair', sure: [0x04, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x46, 0xB7] },
      { key: 'skin', label: 'skin', sure: [0xA3, 0xA5, 0xA6, 0xB2, 0xB3] },
      { key: 'shirt', label: 'top', sure: [] },
      { key: 'trousers', label: 'leggings', sure: [0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D] },
      { key: 'belt', label: 'boots and belt', sure: [0x7C] },
    ],
    // The greys are the halter and the boots; a boot is the run that meets
    // only the leggings. The dark browns shade both the arms and the legs.
    shared: [
      { idx: [0x07, 0x08, 0x14, 0x16, 0x17, 0x18, 0x19, 0x1B, 0x1C],
        votes: { shirt: ['hair', 'skin', 'shirt', 'belt'], belt: ['trousers'] }, otherwise: 'belt' },
      { idx: [0xA8, 0xAB, 0xAD, 0xAF],
        votes: { skin: ['skin', 'hair', 'shirt'], trousers: ['trousers'] }, otherwise: 'skin' },
    ] },
];

/* Every pixel of a sheet labelled with the index of the part it belongs to
   in def.parts, or -1 for transparency, the outline, the figure's fixed
   indices, and any index the table does not know. `unknown` counts the last kind, so a caller can tell a sheet
   it recognises from one somebody has redrawn. A run of shared shades is
   4-connected and never crosses from one 32-row frame into the next. */
function heroPartMap(image, W, H, def) {
  const label = new Int8Array(W * H).fill(-1);
  const partIx = {};
  def.parts.forEach((p, i) => { partIx[p.key] = i; });
  const sure = new Int8Array(256).fill(-1);
  def.parts.forEach((p, i) => { for (const v of p.sure) sure[v] = i; });
  const sharedOf = new Int8Array(256).fill(-1);
  def.shared.forEach((s, i) => { for (const v of s.idx) sharedOf[v] = i; });
  const fixed = new Set([0xFF, 0x1D, 0x1E].concat(def.fixed || []));
  let unknown = 0;
  for (let i = 0; i < W * H; i++) {
    const v = image[i];
    label[i] = sure[v];
    if (v && sure[v] < 0 && sharedOf[v] < 0 && !fixed.has(v)) unknown++;
  }
  const seen = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const sh = sharedOf[image[i]];
    if (sh < 0 || seen[i]) continue;
    const frame = Math.floor(i / W / 32);
    const run = [i];
    seen[i] = 1;
    const border = {};
    for (let k = 0; k < run.length; k++) {
      const p = run[k], x = p % W, y = Math.floor(p / W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= W || ny < 0 || ny >= H || Math.floor(ny / 32) !== frame) continue;
        const q = ny * W + nx;
        if (sharedOf[image[q]] === sh) { if (!seen[q]) { seen[q] = 1; run.push(q); } }
        else if (sure[image[q]] >= 0) {
          const key = def.parts[sure[image[q]]].key;
          border[key] = (border[key] || 0) + 1;
        }
      }
    }
    let best = def.shared[sh].otherwise, most = 0;
    for (const [to, voters] of Object.entries(def.shared[sh].votes)) {
      const n = voters.reduce((s, v) => s + (border[v] || 0), 0);
      if (n > most) { best = to; most = n; }
    }
    for (const p of run) label[p] = partIx[best];
  }
  label.unknown = unknown;
  return label;
}

/* sRGB to CIE L*a*b* (D65). The matching below is done here rather than in
   RGB because what a recolour has to keep is lightness -- the shading is
   what makes a sprite read as a body -- and RGB distance trades lightness
   against hue as though they were the same thing. */
function heroLab(rgb) {
  const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const r = lin(rgb[0]), g = lin(rgb[1]), b = lin(rgb[2]);
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const X = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047);
  const Y = f(0.2126 * r + 0.7152 * g + 0.0722 * b);
  const Z = f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883);
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}

/* The indices a recoloured pixel may take: everything but 0, which is the
   sheet's transparency, and 0xE0 up, which is the engine's five cycling
   ramps and the fixed black and white above them. A pixel put on a ramp
   would shimmer as the palette turns (see ramp_patch.mjs, which does that on
   purpose), and 0xFF is the outline. */
const HERO_INKS = (() => { const a = []; for (let i = 0x01; i < 0xE0; i++) a.push(i); return a; })();

/* One remap table per part, shipped index to new index, or null for a part
   left as shipped. `choices` maps a part key to an [r, g, b].

   The part's own shading is kept: each index moves by its lightness away
   from the part's mean, so the chosen colour lands at the part's middle and
   the folds and highlights keep their distance from it. When that would run
   off either end of the scale (a pale skin, a white shirt) the spread is
   compressed rather than clipped, since clipping turns every highlight the
   same flat white. Colour fades towards black and white, as a real shade of
   it would. The weight on lightness is under 1 because the palette is thin
   in the dark purples and a heavier one reached for a blue of the right
   lightness instead. */
function heroRemapTables(image, labels, def, choices) {
  const labOf = new Array(256);
  const lab = i => labOf[i] || (labOf[i] = heroLab(PAL_RGB[i]));
  return def.parts.map((part, pi) => {
    const want = choices && choices[part.key];
    if (!want) return null;
    let sum = 0, n = 0, lo = 100, hi = 0;
    const used = new Set();
    for (let i = 0; i < image.length; i++) if (labels[i] === pi) {
      const L = lab(image[i])[0];
      sum += L; n++; used.add(image[i]);
      if (L < lo) lo = L;
      if (L > hi) hi = L;
    }
    if (!n) return null;
    const mean = sum / n;
    const t = heroLab(want);
    const spread = Math.max(0.35, Math.min(1,
      hi > mean ? (96 - t[0]) / (hi - mean) : 1,
      mean > lo ? (t[0] - 6) / (mean - lo) : 1));
    const tab = new Uint8Array(256);
    for (let i = 0; i < 256; i++) tab[i] = i;
    for (const src of used) {
      const L = Math.max(0, Math.min(100, t[0] + (lab(src)[0] - mean) * spread));
      const k = Math.max(0, Math.min(1, Math.min(L, 100 - L) / 25));
      const a = t[1] * k, b = t[2] * k;
      let best = src, bd = Infinity;
      for (const i of HERO_INKS) {
        const c = lab(i);
        const d = (c[0] - L) * (c[0] - L) * 0.8 + (c[1] - a) * (c[1] - a) + (c[2] - b) * (c[2] - b);
        if (d < bd) { bd = d; best = i; }
      }
      tab[src] = best;
    }
    return tab;
  });
}

/* The sheet with each labelled pixel sent through its part's table. Pixels
   outside every part, and parts with no table, come through unchanged, so
   choosing nothing hands back the shipped sheet byte for byte. */
function heroRecolour(image, labels, tables) {
  const out = Uint8Array.from(image);
  for (let i = 0; i < out.length; i++) {
    const p = labels[i];
    if (p >= 0 && tables[p]) out[i] = tables[p][image[i]];
  }
  return out;
}

/* ---- wearing another body, and recolouring by shade -----------------------
   Two things the hero section does beyond its part table, and both are for
   any sprite rather than for the hero alone.

   WEARING A BODY. The hero is drawn as facing * 4 + pose: four facings, and
   in each the left foot forward, standing, the right foot forward and seated
   (the map view's gait reading, confirmed by Alaric on his throne at frame
   11). Every person in the file is laid out the same way, so their sixteen
   frames go straight onto the hero's. A monster is not: the program sets a
   monster's frame in TActiveMonster::AdjustAspect(facing, step), switching on
   a per-class property, and the layouts it can choose include facing * 2 +
   (step & 1), two strides a facing, and facing alone, one frame a facing,
   both with the same facing number the people use. So an eight-frame
   monster's frames are spread over the hero's four poses by HERO_WEAR_POSE
   (a stride on each foot, the first stride standing and seated, since such
   a body has no frame for either) and a four-frame one shows its one frame
   for all four. Sixteen-frame monsters are not worn: AdjustAspect has more
   than one sixteen-frame layout, the gator's frames visibly change facing
   every two, and which a class uses is the class's property 55, which
   nothing here reads yet. */
const HERO_WEAR_POSE = { 1: [0, 0, 0, 0], 2: [0, 0, 1, 0], 4: [0, 1, 2, 3] };
function heroWearFrames(body, perFacing) {
  const map = HERO_WEAR_POSE[perFacing];
  if (!map) return null;
  const out = new Uint8Array(16 * 1024);
  for (let facing = 0; facing < 4; facing++)
    for (let pose = 0; pose < 4; pose++) {
      const from = facing * perFacing + map[pose];
      out.set(body.subarray(from * 1024, (from + 1) * 1024), (facing * 4 + pose) * 1024);
    }
  return out;
}

/* RECOLOURING BY SHADE. The part table is a judgement made for two sheets;
   this is the version that needs none: it finds the regions a sprite is
   painted in from the art, and a region is replaced as a whole.

   WHAT MAKES A REGION. A painted area is a ramp of shades that touch each
   other all over it, while two areas meet only along a seam. So shades are
   joined strongest contact first -- how many times two shades sit side by
   side, over the smaller one's pixel count -- down to a tenth, and two
   groups join only while they still look like one colour: the same greyness
   (a grey never joins a colour, which is what kept trousers apart from the
   skin they touch), mean hues within 18 degrees, and mean colourfulness
   within 32 in L*a*b* (skin against a vivid red). The means, not the
   members, because a ramp's dark end is less colourful than its bright end
   and the hero's shirt is both.

   TRIED AND DROPPED, all on 18 September 2026 against the fool, the hero,
   the heroine, the demon, the nobleman, a Seldane, the guard, the mage, the
   ruffian, the king, the woman and the golem:
   - the palette's rows, which was the first version: row 0x20 runs from
     yellow to red, so the fool's motley came out as one group holding most
     of him and a handful of scattered yellows (the maintainer's screenshot);
   - hue gaps alone: the warm half of the palette is a continuum, and skin,
     hair, leather and a demon's red became one group;
   - contact alone: the fool's motley is a checkerboard, so his red and
     yellow touch everywhere and joined;
   - a limit on the spread of hues over the members rather than the means:
     it broke every shaded blue in two.
   Nothing is right for every sprite. The guard's armour and his skin are one
   group, and a Seldane's robe is three.

   What is left under a fiftieth of the pixels is folded into the group it
   touches most (a buckle into its belt), or failing that the nearest in
   colour, so the list is the handful of things a person would name. The
   outline and the near-blacks are left out, as they are from the parts.

   The result is a def shaped like a HERO_SPRITES entry, one part per group
   with no shared runs, so heroPartMap and heroRemapTables take it unchanged.
   Parts are ordered by pixel count, most first; `top` is a group's most used
   index, and a group's key is its lowest index, which does not depend on
   the order the joins happened in. */
function heroShadeDef(image, W, frameH, opts) {
  // How alike two touching shades must be to be one family: hue within
  // `hue` degrees and chroma within `chroma`, and two greys within `greyL`
  // of lightness. The defaults are the sprites' readings; a portrait's
  // caller tightens them, since a face's skin, hair and clothes are painted
  // in neighbouring browns that a sprite's smaller art keeps apart.
  const O = Object.assign({ hue: 18, chroma: 32, greyL: 100, small: 50 }, opts || {});
  const skip = new Set([0, 0xFF, 0x1D, 0x1E]);
  const count = new Uint32Array(256);
  const touch = new Map();
  const pair = (a, b) => a < b ? a * 256 + b : b * 256 + a;
  // A sheet is 32 wide in 32-row frames, and a run of touching shades never
  // crosses from one frame into the next; a portrait (64 by 64, since
  // 24 September 2026) is one frame the size of the image.
  W = W || 32; frameH = frameH || 32;
  for (let i = 0; i < image.length; i++) {
    const v = image[i];
    if (skip.has(v)) continue;
    count[v]++;
    const x = i % W, y = Math.floor(i / W);
    const right = x + 1 < W ? image[i + 1] : 0;
    const down = (y + 1) % frameH !== 0 && i + W < image.length ? image[i + W] : 0;
    for (const w of [right, down])
      if (!skip.has(w) && w !== v) touch.set(pair(v, w), (touch.get(pair(v, w)) || 0) + 1);
  }
  const groups = new Map();
  for (let i = 1; i < 256; i++) {
    if (!count[i] || skip.has(i)) continue;
    const [, a, b] = heroLab(PAL_RGB[i]);
    groups.set(i, { members: [i], pixels: count[i], sa: a * count[i], sb: b * count[i], sl: heroLab(PAL_RGB[i])[0] * count[i], grey: Math.hypot(a, b) < 10 });
  }
  const owner = new Map([...groups.keys()].map(k => [k, k]));
  const root = k => { while (owner.get(k) !== k) k = owner.get(k); return k; };
  const meanOf = g => { const a = g.sa / g.pixels, b = g.sb / g.pixels; return { C: Math.hypot(a, b), h: Math.atan2(b, a) * 180 / Math.PI }; };
  const joins = [...touch.entries()].map(([k, n]) => ({ a: k >> 8, b: k & 255, s: n / Math.min(count[k >> 8], count[k & 255]) }))
    .sort((x, y) => y.s - x.s);
  for (const j of joins) {
    if (j.s < 0.1) break;
    const ra = root(j.a), rb = root(j.b);
    if (ra === rb) continue;
    const A = groups.get(ra), B = groups.get(rb);
    if (A.grey !== B.grey) continue;
    if (!A.grey) {
      const ma = meanOf(A), mb = meanOf(B);
      let dh = Math.abs(ma.h - mb.h);
      if (dh > 180) dh = 360 - dh;
      if (dh > O.hue || Math.abs(ma.C - mb.C) > O.chroma) continue;
    } else if (Math.abs(A.sl / A.pixels - B.sl / B.pixels) > O.greyL) continue;
    owner.set(rb, ra);
    A.members.push(...B.members); A.pixels += B.pixels; A.sa += B.sa; A.sb += B.sb; A.sl += B.sl;
    groups.delete(rb);
  }
  const all = [...groups.values()];
  const total = all.reduce((n, g) => n + g.pixels, 0);
  const big = all.filter(g => g.pixels >= total / O.small);
  const keep = big.length ? big : all;
  const topOf = g => g.members.reduce((t, i) => count[i] > count[t] ? i : t, g.members[0]);
  for (const g of all) {
    if (keep.includes(g)) continue;
    let into = null, most = 0;
    for (const k of keep) {
      let n = 0;
      for (const a of g.members) for (const b of k.members) n += touch.get(pair(a, b)) || 0;
      if (n > most) { most = n; into = k; }
    }
    if (!into) {
      const c = heroLab(PAL_RGB[topOf(g)]);
      let bd = Infinity;
      for (const k of keep) {
        const d = heroLab(PAL_RGB[topOf(k)]);
        const e = (c[0] - d[0]) ** 2 + (c[1] - d[1]) ** 2 + (c[2] - d[2]) ** 2;
        if (e < bd) { bd = e; into = k; }
      }
    }
    into.members.push(...g.members);
    into.pixels += g.pixels;
  }
  const parts = keep.map(g => {
    const low = Math.min(...g.members);
    return { key: 'shade' + low.toString(16), label: 'the colors around 0x' + low.toString(16).toUpperCase(),
             sure: g.members.slice().sort((a, b) => a - b), pixels: g.pixels, top: topOf(g) };
  });
  return { key: 'shades', parts: parts.sort((a, b) => b.pixels - a.pixels), shared: [] };
}
