/* The resource fork's sheets: the game's font, the Seldane strikes, the dialogue box, the rest of the fork.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at its own section banners and
   nowhere else, so every function is where it was in the one file. This
   tier knows the page's furniture: js/mac-*.js know nothing of Cythera,
   js/delv-*.js know the formats but not the page, and these know both.
   They are classic scripts, never modules, because the page has to work
   from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order only decides
   what has run when a statement runs at load time; the one such statement
   that needed a later file, the brand line, stayed in the page after the
   last of these. File 3 of 14. */

/* ---------------------------------------------------------------------------
   Swapping the game's own font.

   The first thing this page does that changes how the GAME looks rather than
   reporting on it, and the last thing on the feature list that was waiting on
   somebody else: it needed a resource-fork writer, which arrived on
   6 September 2026.

   The game draws its text with `sfnt` 7289, which `FOND` 1046 names
   "ArgosANouveau". Replacing the sfnt's bytes and leaving both ids alone
   leaves every reference in the file pointing at the same place, so the game
   asks for the same family and gets different outlines. The incoming font is
   put through trueTypeToSfnt first, which is what gives it the Mac Roman
   character map the game addresses glyphs by; without that the game draws
   nothing at all.

   The new fork replaces window.CYTHERA_RSRC_RAW, which is what the disk image
   and the MacBinary export already carry, so the swapped font leaves the page
   by the paths that were already there. Nothing is written to disk here and
   the archive on the server is untouched: this is the copy in the browser.
--------------------------------------------------------------------------- */
window.FONT_SWAP = null;      // {name, mapped, format, from, bytes} once swapped
function gameFontResource() {
  const fork = window.CYTHERA_RSRC;
  const list = fork && fork.resourcesByType && fork.resourcesByType['sfnt'];
  if (!list || !list.length) return null;
  return list.find(e => e.id === 7289) || list[0];
}
function swapGameFont(bytes, filename) {
  const fork = window.CYTHERA_RSRC;
  const target = gameFontResource();
  if (!fork) throw new Error('no resource fork is open, so there is no font to replace');
  if (!target) throw new Error('this fork has no sfnt resource');
  const made = trueTypeToSfnt(bytes);
  const spec = resourceForkSpec(fork);
  let hit = 0;
  for (const r of spec.resources)
    if (r.type === 'sfnt' && r.id === target.id) { r.data = made.bytes; hit++; }
  if (!hit) throw new Error('could not find sfnt ' + target.id + ' to replace');
  const raw = writeResourceFork(spec);
  const reopened = openResourceFork(raw);     // it must read back, or it is not written
  window.CYTHERA_RSRC_RAW = raw;
  window.CYTHERA_RSRC = reopened;
  DERIVED.EDITOR_ZONE_NAMES = null;            // named out of the fork
  DERIVED.AI_HOOK_NAMES = null;
  window.FONT_SWAP = { name: filename || 'a font', mapped: made.mapped, format: made.format,
                       from: target.id, bytes: made.bytes.length, was: bytes.length };
  // The page is set in the game's font, so it now shows the new one: the
  // preview is the whole site, which is as close to seeing it in the game as
  // a browser gets.
  try { installGameFont(); } catch (e) { quiet(e); }
  try { installDialogueBox(); } catch (e) { quiet(e); }
  return window.FONT_SWAP;
}
function fontSwapPanel() {
  const box = document.createElement('div');
  box.className = 'mechView';
  const target = gameFontResource();
  const sw = window.FONT_SWAP;
  box.innerHTML = '<section class="mechSec"><div class="mechHead"><h3>Put Another Font in the Game</h3></div>' +
    (target
      ? '<p class="mechLede">Choose a TrueType font (<b>.ttf</b>) to replace the game’s font, ' + svEsc(target.name || 'ArgosANouveau') + ' (<b>sfnt ' + target.id + '</b>), in the copy of the file in this browser.</p>' +
        '<ul class="ruleList"><li>To play with it, export <b>Data file › the disk image</b> and run the game from it in an emulator.</li>' +
        '<li>An <b>.otf</b> font cannot be used, because a classic Mac cannot draw it.</li></ul>' +
        '<div class="mechStats"><input type="file" id="fontSwapFile" accept=".ttf,font/ttf,application/font-sfnt,application/x-font-ttf">' +
        (sw ? '<button class="secondary" style="width:auto;margin:0;padding:6px 12px" onclick="undoFontSwap()">Restore the game’s font</button>' : '') +
        '</div>' +
        (sw ? '<blockquote class="mechQuote">' + svEsc(sw.name) + ' is in the file as sfnt ' + sw.from + '. ' +
              sw.mapped + ' of the characters the game uses are in it, in a format ' + sw.format + ' character map, ' +
              (sw.bytes / 1024).toFixed(0) + ' KB of outlines.</blockquote>' : '') +
        '<div id="fontSwapNote" class="mechSub"></div>'
      : '<p class="mechLede">No font resource is open. Open Cythera Data from a file that includes its resource fork: a .hqx, MacBinary or AppleSingle file.</p>') +
    '</section>';
  setTimeout(() => {
    const f = document.getElementById('fontSwapFile');
    if (!f) return;
    // The verifier reads "async () =>" as a call to a function named async,
    // so the read is done with a promise instead.
    f.onchange = function () {
      const file = f.files && f.files[0];
      const note = document.getElementById('fontSwapNote');
      if (!file) return;
      const fail = e => {
        if (note) note.textContent = 'That font could not be used: ' + e.message;
        setStatus('That font could not be used: ' + e.message, true);
      };
      file.arrayBuffer().then(buf => {
        const r = swapGameFont(new Uint8Array(buf), file.name);
        setStatus(file.name + ' is the game’s font in this copy. ' + r.mapped + ' characters mapped.');
        renderMacRsrcSheet();
      }).catch(fail);
    };
  }, 0);
  return box;
}
function undoFontSwap() {
  const rec = window.ARCHIVE_ORIGINAL_RSRC;
  if (!rec) { setStatus('The page did not keep the original resource fork; open the file again to get it back.', true); return; }
  window.CYTHERA_RSRC_RAW = rec;
  window.CYTHERA_RSRC = openResourceFork(rec);
  window.FONT_SWAP = null;
  DERIVED.EDITOR_ZONE_NAMES = null;
  try { installGameFont(); } catch (e) { quiet(e); }
  try { installDialogueBox(); } catch (e) { quiet(e); }
  setStatus('Restored the game’s font.');
  renderMacRsrcSheet();
}

/* ---------------------------------------------------------------------------
   The Seldane script, rewritten.

   The game's outline font can be swapped since v1.22.0; the other face in the
   file could not be touched. Seldane is a bitmap font, not an outline one:
   FOND 128 names NFNT 25740 at 12 point and NFNT 25746 at 18, each a single
   wide bit image with a location table saying where each letter starts in it.
   The resource-fork writer has been able to put a resource back since
   6 September, so what was missing was only the font half, and the evidence
   that it is right is in utilities/nfnt_write_check.mjs: both shipped strikes
   read through nfntSpec and back through writeNFNT byte for byte.

   Rasterising is the easy half to get wrong, so what it does is stated plainly
   on the panel: each glyph the strike already has an image for is drawn from
   the chosen font with its capitals as tall as the strike's letters and its
   feet where theirs are (strikeFit), thresholded to one bit, and packed back
   in with the face's own advance and overhang (rebuildStrike). Fed the
   strike's own TrueType it gives the strike back, which browser_check.mjs
   holds. A glyph the strike has no image for
   stays without one -- the strike draws 24 letters, with no L and no O
   (at 18 point each has an entry one pixel wide and empty), and its 25th
   image is the missing-character box, carried through as it is; inventing
   the missing letters would put letters in the game that Ambrosia never
   drew.

   Both strikes are rewritten together, because a family whose two sizes are
   different alphabets would be worse than either.
--------------------------------------------------------------------------- */
window.STRIKE_SWAP = null;
function seldaneStrikes() {
  const fork = window.CYTHERA_RSRC;
  const list = fork && fork.resourcesByType && fork.resourcesByType['NFNT'];
  return list && list.length ? list.slice().sort((a, b) => a.id - b.id) : null;
}
// One glyph, drawn from the loaded family into a column of `height` rows and
// returned as the set bits of each row. Threshold on alpha: the rasteriser is
// antialiasing and a bitmap strike has no grey.
function rasteriseGlyph(ch, family, px, height, ascent) {
  // Room on both sides of the pen for ink that overhangs it: the image is
  // the ink from the leftmost of the pen and its first inked column to its
  // last inked column, and `left` is where that starts against the pen,
  // which is what an NFNT's offset records (Seldane's R starts one column
  // left of it). The advance is the face's own, which may be wider than
  // the ink.
  const pad = Math.ceil(px) + 4;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(px) * 3 + pad * 2); c.height = height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.font = px + 'px "' + family + '"';
  ctx.textBaseline = 'alphabetic';
  const adv = Math.max(1, Math.round(ctx.measureText(ch).width));
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#000';
  ctx.fillText(ch, pad, ascent);
  const im = ctx.getImageData(0, 0, c.width, c.height);
  const on = (x, y) => im.data[(y * c.width + x) * 4 + 3] > 128;
  let lo = c.width, hi = -1;
  for (let x = 0; x < c.width; x++)
    for (let y = 0; y < height; y++) if (on(x, y)) { if (x < lo) lo = x; if (x > hi) hi = x; break; }
  if (hi < 0) return { rows: [], width: 0, left: 0, advance: adv };
  const x0 = Math.min(pad, lo), x1 = hi + 1;
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = x0; x < x1; x++) row.push(on(x, y) ? 1 : 0);
    rows.push(row);
  }
  return { rows, width: x1 - x0, left: x0 - pad, advance: adv };
}
// One glyph out of the strike as it stands, in the same shape rasteriseGlyph
// returns, so a slot can be carried through a rewrite untouched.
function copyStrikeGlyph(spec, i) {
  const rowBytes = spec.rowWords * 2, w = spec.loc[i + 1] - spec.loc[i], rows = [];
  for (let y = 0; y < spec.fRectHeight; y++) {
    const row = [];
    for (let k = 0; k < w; k++) {
      const x = spec.loc[i] + k;
      row.push((spec.strike[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1);
    }
    rows.push(row);
  }
  return { rows, width: w };
}
/* How big to draw the chosen face, and where its baseline goes, read off the
   strike's own letters and the face's own capital. Until 26 September 2026
   the face was drawn with its em at the cell less the descent (12 and 18
   px) on the strike's nominal baseline, and that is wrong twice over for
   Seldane: its letters fill the whole cell, descent rows included (14 and
   21 rows, feet on the last row), and a face's capitals are some 0.7 of its
   em, so every letter came out two thirds of the height of the one it
   replaced and two rows too high. The control was Cythera Guides' own
   Seldane TrueType, traced from these strikes: drawn the old way it
   overlapped the strike's letters by 0.14 of their ink, and sized so its
   capitals matched them, by 0.7 (the workbench's GRIMOIRE-NOTES.md has the
   sweep). So the size is the letters' median height over the height of
   the face's capital H per pixel, measured by the canvas, and the baseline
   is set so that the H's foot lands on the letters' median foot. A face
   whose H draws nothing falls back to the old sizing. The panel's own
   TrueType of a strike, fed back in, gives the strike back pixel for pixel
   (browser_check.mjs holds that). */
function strikeFit(spec, family) {
  const n = spec.nGlyphs, heights = [], feet = [];
  for (let i = 0; i < n - 1; i++) {
    if (spec.loc[i + 1] - spec.loc[i] <= 0) continue;
    const g = copyStrikeGlyph(spec, i);
    let t = -1, b = -1;
    g.rows.forEach((row, y) => { if (row.some(v => v)) { if (t < 0) t = y; b = y; } });
    if (t >= 0) { heights.push(b - t + 1); feet.push(b); }
  }
  const median = a => a.slice().sort((x, y) => x - y)[a.length >> 1];
  const old = { px: spec.fRectHeight - spec.descent, base: spec.ascent };
  if (!heights.length) return old;
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx || !ctx.measureText) return old;
  ctx.font = '100px "' + family + '"';
  // The H's whole ink, above the baseline and below it: Seldane's own letters
  // hang two rows under theirs, so a face made from the strike (the panel's
  // own TrueType export) would be sized wrong by its ascent alone.
  const m = ctx.measureText('H');
  const up = m ? m.actualBoundingBoxAscent : 0, down = (m && m.actualBoundingBoxDescent) || 0;
  const tall = (up + down) / 100;
  if (!(up > 0 && tall > 0)) return old;
  const px = median(heights) / tall;
  return { px, base: Math.round(median(feet) + 1 - down / 100 * px) };
}
function rebuildStrike(spec, family) {
  const n = spec.nGlyphs;
  // Which codes carry an image today. The last index is the missing symbol.
  const had = [];
  for (let i = 0; i < n; i++) had.push(spec.loc[i + 1] - spec.loc[i] > 0);
  const fit = strikeFit(spec, family);
  // Each entry is either drawn from the face (`g`, with its own left and
  // advance) or carried through as it stands: its image, if it has one,
  // and its offset/width word. Carried through are the missing symbol, and
  // every code that has a width and no image -- the tab and the return
  // (advance 4) and code 98 (advance 1) in both Seldane strikes. Those were
  // written as 0xFFFF, "no character", until 26 September 2026, which would
  // have had the game draw its missing box for a tab.
  const entries = [];
  for (let i = 0; i < n; i++) {
    // The last index is the missing symbol rather than a character, and
    // firstChar + i is then the code one past lastChar -- 'c' in both Seldane
    // strikes, whose box was being replaced by whatever the chosen face draws
    // for a lowercase c. It is carried through as it stands.
    if (!had[i] || i === n - 1) { entries.push({ keep: spec.ow[i], img: had[i] ? copyStrikeGlyph(spec, i) : null }); continue; }
    const g = rasteriseGlyph(String.fromCharCode(spec.firstChar + i), family, fit.px, spec.fRectHeight, fit.base);
    entries.push(g && g.width > 0 ? { g, img: g } : { keep: spec.ow[i], img: copyStrikeGlyph(spec, i) });
  }
  /* The offset is counted from kernMax: an image starts at the pen plus
     kernMax plus the offset. Both strikes have kernMax -1 and an offset of 1
     on an ordinary letter, and every drawn letter was written with offset 0,
     so each came out one column left of its pen. kernMax is lowered if a
     drawn letter overhangs further left than the strike's own, and the
     entries carried through keep their place by the same amount. */
  let kernMax = spec.kernMax;
  for (const e of entries) if (e.g && e.g.left < kernMax) kernMax = e.g.left;
  const shift = spec.kernMax - kernMax;
  let total = 0;
  for (const e of entries) total += e.img ? e.img.width : 0;
  const rowWords = Math.max(1, Math.ceil(total / 16));
  const rowBytes = rowWords * 2;
  const strike = new Uint8Array(rowBytes * spec.fRectHeight);
  const loc = [], ow = [];
  let x = 0, widMax = 0, rectMax = 0;
  for (const e of entries) {
    loc.push(x);
    const img = e.img;
    if (img) for (let y = 0; y < spec.fRectHeight; y++)
      for (let k = 0; k < img.width; k++)
        if (img.rows[y][k]) strike[y * rowBytes + ((x + k) >> 3)] |= 0x80 >> ((x + k) & 7);
    let word;
    if (e.g) word = (Math.min(255, e.g.left - kernMax) << 8) | Math.min(255, e.g.advance);
    else word = e.keep === 0xFFFF ? 0xFFFF : ((((e.keep >> 8) + shift) & 0xFF) << 8) | (e.keep & 0xFF);
    ow.push(word);
    if (word !== 0xFFFF && (word & 0xFF) > widMax) widMax = word & 0xFF;
    if (img && img.width > rectMax) rectMax = img.width;
    x += img ? img.width : 0;
  }
  loc.push(x);                                      // the sentinel
  const strikeBytes = strike.length;
  const owOff = 26 + strikeBytes + (loc.length) * 2;
  return Object.assign({}, spec, {
    strike, strikeBytes, rowWords, loc, ow, kernMax,
    widMax: widMax || spec.widMax,
    fRectWidth: Math.max(widMax, rectMax) || spec.fRectWidth,
    owTLoc: (owOff - 16) / 2,
    owOff, tail: new Uint8Array(0)
  });
}
function swapSeldane(bytes, filename) {
  const fork = window.CYTHERA_RSRC;
  const strikes = seldaneStrikes();
  if (!fork) throw new Error('no resource fork is open, so there is no font to rewrite');
  if (!strikes) throw new Error('this fork has no NFNT resource');
  const family = 'StrikeSource' + Date.now();
  const face = new FontFace(family, bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length));
  return face.load().then(loaded => {
    document.fonts.add(loaded);
    const spec = resourceForkSpec(fork);
    let done = 0;
    for (const e of strikes) {
      const built = rebuildStrike(nfntSpec(fork.dataOf('NFNT', e)), family);
      const made = writeNFNT(built);
      for (const r of spec.resources)
        if (r.type === 'NFNT' && r.id === e.id) { r.data = made; done++; }
    }
    if (!done) throw new Error('could not find the strikes to replace');
    const raw = writeResourceFork(spec);
    const reopened = openResourceFork(raw);        // it must read back, or it is not written
    window.CYTHERA_RSRC_RAW = raw;
    window.CYTHERA_RSRC = reopened;
    window.STRIKE_SWAP = { name: filename || 'a font', strikes: done };
    return window.STRIKE_SWAP;
  });
}
function undoStrikeSwap() {
  const rec = window.ARCHIVE_ORIGINAL_RSRC;
  if (!rec) { setStatus('The page did not keep the original resource fork; open the file again to get it back.', true); return; }
  window.CYTHERA_RSRC_RAW = rec;
  window.CYTHERA_RSRC = openResourceFork(rec);
  window.STRIKE_SWAP = null;
  setStatus('Restored the file’s Seldane script.');
  renderMacRsrcSheet();
}
/* The strike, out.

   The swap above puts a modern face into the game's bitmap font. This is the
   other direction and it leaves the file alone: the strike as a TrueType,
   saved to disk, for a phone or a word processor to set Seldane in.
   `nfntToTrueType` does the work and says how; here is only the naming.

   A font per strike, not one font for both, because the two strikes are two
   designs and not two sizes of one -- which is what Cythera Guides concluded
   too, distributing Seldane Medium and Seldane Large as separate suitcases.
   The name comes from the family record, so it is "Seldane 12" and "Seldane
   18" for this file and the right thing for any other Delver archive whose
   FOND names its strikes. */
function strikeFamilyOf(id) {
  const fork = window.CYTHERA_RSRC;
  const fonds = (fork && fork.resourcesByType && fork.resourcesByType['FOND']) || [];
  for (const e of fonds) {
    let d;
    try { d = decodeFOND(fork.dataOf('FOND', e)); } catch (err) { continue; }
    const hit = d.entries.find(x => x.id === id && x.size);
    if (hit) return (e.name || 'Bitmap font') + ' ' + hit.size;
  }
  return 'NFNT ' + id;
}
function exportStrikeTrueType(id) {
  const fork = window.CYTHERA_RSRC;
  const e = ((fork && fork.resourcesByType && fork.resourcesByType['NFNT']) || []).find(x => x.id === id);
  if (!e) { setStatus('That font size is not in this resource fork.', true); return; }
  const family = strikeFamilyOf(id);
  try {
    const spec = nfntSpec(fork.dataOf('NFNT', e));
    const ttf = nfntToTrueType(spec, { family: family,
      note: 'Drawn from NFNT ' + id + ', a bitmap strike in a Delver archive. ' +
            'Cythera is copyright Ambrosia Software, Inc. and Glenn Andreas.' });
    downloadBlob(ttf, family + '.ttf');
    setStatus(family + '.ttf written: ' + (spec.ascent + spec.descent) + ' pixels to the em, ' +
              'so it draws these pixels at ' + (spec.ascent + spec.descent) + 'px and at every multiple of it.');
  } catch (err) {
    setStatus('The page could not save that size as a TrueType font: ' + err.message, true);
  }
}
function strikeSwapPanel() {
  const box = document.createElement('div');
  box.className = 'mechView';
  const strikes = seldaneStrikes();
  const sw = window.STRIKE_SWAP;
  box.innerHTML = '<section class="mechSec"><div class="mechHead"><h3>Rewrite the Seldane Script</h3></div>' +
    (strikes
      ? '<p class="mechLede">Choose a TrueType font to redraw the Seldane script (' + strikes.map(e => 'NFNT ' + e.id).join(' and ') + ') at both its sizes, in the copy of the file in this browser.</p>' +
        '<ul class="ruleList">' +
        '<li>The page replaces only the 24 letters Seldane has. It has no L and no O.</li>' +
        '<li>A thin font may come out broken up at the small size.</li></ul>' +
        '<div class="mechStats"><input type="file" id="strikeSwapFile" accept=".ttf,font/ttf,application/font-sfnt,application/x-font-ttf">' +
        (sw ? '<button class="secondary" style="width:auto;margin:0;padding:6px 12px" onclick="undoStrikeSwap()">Restore the file’s script</button>' : '') +
        '</div>' +
        '<p class="mechLede">Or save each size of the Seldane script as a TrueType font, which draws exactly these pixels at that size.</p>' +
        '<div class="mechStats">' +
        strikes.map(e => '<button class="secondary" style="width:auto;margin:0;padding:6px 12px" onclick="exportStrikeTrueType(' +
          e.id + ')">Save ' + svEsc(strikeFamilyOf(e.id)) + ' as a TrueType</button>').join('') +
        '</div>' +
        (sw ? '<blockquote class="mechQuote">' + svEsc(sw.name) + ' is the Seldane script in this copy, in ' + sw.strikes + ' sizes.</blockquote>' : '') +
        '<div id="strikeSwapNote" class="mechSub"></div>'
      : '<p class="mechLede">No bitmap font is open. Open Cythera Data from a file that includes its resource fork.</p>') +
    '</section>';
  setTimeout(() => {
    const f = document.getElementById('strikeSwapFile');
    if (!f) return;
    f.onchange = function () {
      const file = f.files && f.files[0];
      const note = document.getElementById('strikeSwapNote');
      if (!file) return;
      const fail = e => {
        if (note) note.textContent = 'That font could not be used: ' + e.message;
        setStatus('That font could not be used: ' + e.message, true);
      };
      file.arrayBuffer().then(buf => swapSeldane(new Uint8Array(buf), file.name)).then(r => {
        setStatus(file.name + ' is the Seldane script in this copy, in ' + r.strikes + ' sizes.');
        renderMacRsrcSheet();
      }).catch(fail);
    };
  }, 0);
  return box;
}

/* THE DIALOGUE BOX, from the file (10 September 2026) and, since 11
   September, with every constant read out of the application. Two routines
   draw it (the workbench's doc/dialogue-box.md has the first reading):

   - TInteraction::MyCopyBitsBevel: CopyBits the scene into the box;
     PenMode(1); RGBForeColor(colour); PenPat(qd.gray); PaintRect(box); then
     two polygons in white and black for the bevelled edge. The colour is
     read out of a global colour table handle, dereferenced twice, at a
     fixed offset (`lwz 0, 18(r)`, `lhz 0, 22(r)`: ColorSpec 1's rgb); the
     global is the one CreateGlobals fills with GetCTable(n). The data file's
     clut n gives the colour: 0x0000 0x0000 0xA800, rgb(0,0,168), so the box
     is a 50% dither of that blue over whatever is under it.
   - FrameBox, which TBorderWDEF::DrawUnhilited calls for every bordered
     window: SubTilePat(tile, rect) cuts pixel patterns out of a game tile
     through rects built with SetRect -- a top band (left, 0, right, h), a
     side band (0, top, w, bottom) and their mirrors -- and FillCRect fills
     the frame with them. That is a CSS border-image of the tile sliced h w.

   exeDialogueBox reads the tile, the two band sizes, the colour table's id
   and the colour's offset; this sets --boxBlue and the border-image on
   .tabSheet from them and the open file, and leaves the stylesheet's own
   look (the res/ frame, the blue it was drawn with) when the application
   or the file lacks any part. */
function exeDialogueBox() {
  if (!appImage()) return null;
  const fb = exeOpsNamed('FrameBox');
  const sub = fb.findIndex(o => exeCalls(o, 'SubTilePat'));
  const tile = sub >= 0 ? exeArgOf(fb, sub, 3) : null;
  const rects = fb.map((o, k) => exeCalls(o, 'SetRect') ? k : -1).filter(k => k >= 0)
    .map(k => ({ l: exeArgOf(fb, k, 4), t: exeArgOf(fb, k, 5), r: exeArgOf(fb, k, 6), b: exeArgOf(fb, k, 7) }))
    .filter(x => x.l && x.t && x.r && x.b);
  const top = rects.find(x => x.t.v === 0 && x.l.v > 0), side = rects.find(x => x.l.v === 0 && x.t.v > 0);
  // The colour: the first load at an offset from a handle a TOC slot holds,
  // before RGBForeColor.
  const bb = exeOpsNamed('TInteraction::MyCopyBitsBevel');
  const fore = bb.findIndex(o => exeCalls(o, 'RGBForeColor'));
  let offset = null, slot = null;
  for (let k = fore - 1; k >= Math.max(0, fore - 10) && fore >= 0; k--) {
    const d = bb[k].d;
    if (d && d.mn === 'lwz' && d.d > 0 && d.ra !== 1 && d.ra !== 2) {
      const base = exeFindBack(bb, k - 1, 6, e => e.mn === 'lwz' && e.ra === 2 && e.rt === d.ra);
      if (base >= 0) { offset = exeVal(bb[k], d.d); slot = bb[base].d.d; }
    }
  }
  // The table: the GetCTable whose handle CreateGlobals stores through the same slot.
  const cg = exeOpsNamed('CreateGlobals');
  let clut = null;
  cg.forEach((o, k) => {
    if (clut || !exeCalls(o, 'GetCTable')) return;
    const store = exeFind(cg, k + 1, 4, d => d.mn === 'stw' && d.rt === 3 && d.d === 0);
    if (store < 0) return;
    const base = exeFindBack(cg, store, cg.length, d => d.mn === 'lwz' && d.ra === 2 && d.rt === cg[store].d.ra);
    if (base >= 0 && cg[base].d.d === slot) clut = exeArgOf(cg, k, 3);
  });
  return tile && top && side ? { tile, top: exeVal({ at: top.b.exe }, top.b.v - top.t.v), side: exeVal({ at: side.r.exe }, side.r.v - side.l.v), clut, offset } : null;
}
window.DIALOGUE_BOX = null;

/* The box's figures, for a session with only the data file open.

   The program is the authority and is used whenever it is there. These stand
   in when it is not -- and the frame tile lives in the ARCHIVE (0x19D is
   sheet 0x8E19, slot 13), so a data-only session can draw the real frame
   rather than a placeholder. What the program alone supplies is the band
   widths and which colour table entry the blue is.

   They are not typed-in guesses of the kind this page refuses elsewhere: the
   installer check reads all four back out of the executable and fails if any
   differs, so they cannot drift from what the program does. THE BLUE IS MEANT
   TO BE CHANGED BY HAND -- it is the one figure here a reader might want
   different, and it is the last fallback, used only when the open file's
   colour table does not carry one. */
const DLG_BOX_DEFAULTS = { tile: 0x19D, top: 4, side: 8, clut: 256, offset: 18, blue: [0, 0, 168] };

function installDialogueBox() {
  const read = exeDialogueBox();
  const D = DLG_BOX_DEFAULTS;
  const tile = read ? read.tile.v : D.tile;
  const top = read ? read.top.v : D.top;
  const side = read ? read.side.v : D.side;
  const clutId = (read && read.clut) ? read.clut.v : D.clut;
  const offset = (read && read.offset) ? read.offset.v : D.offset;
  const out = { tile, blue: null, frame: false, read, fromProgram: !!read };
  window.DIALOGUE_BOX = out;
  let style = document.getElementById('gameBoxStyle');
  if (!style) { style = document.createElement('style'); style.id = 'gameBoxStyle'; document.head.appendChild(style); }
  /* The blue runs whatever is open: the stylesheet is already showing the
     default, and this replaces it only when the file carries its own. The
     frame gates itself further down, because its tile has to come out of an
     archive and resolveTileImage answers with nothing when there is none. */
  let rule = '';
  try {
    const fork = window.CYTHERA_RSRC;
    const clut = fork ? (fork.resourcesByType['clut'] || []).find(e => e.id === clutId) : null;
    if (clut) {
      const d = fork.dataOf('clut', clut), n = ((d[6] << 8) | d[7]) + 1, o = offset;
      if (n > 1 && d.length >= o + 6) out.blue = [d[o], d[o + 2], d[o + 4]];
    }
  } catch (e) { out.blue = null; }
  // The open file's colour where it carries one, the documented default
  // where it does not -- and the default is the figure the program gives,
  // which the installer check reads back out of the executable.
  if (!out.blue) { out.blue = D.blue.slice(); out.blueFromDefault = true; }
  rule += '.tabSheet { --boxBlue:rgba(' + out.blue.join(',') + ',.5); }\n';
  style.textContent = out.css = rule;
  /* The frame is drawn whether or not the program is open, because the tile
     is in the ARCHIVE -- 0x19D is sheet 0x8E19, slot 13. Only the band
     widths came from the program, and those have a default too, so a
     data-only session gets the game's real frame rather than a placeholder. */
  let im = null;
  try { im = resolveTileImage(tile); } catch (e) { im = null; }
  if (!im || im.length !== 1024) return;
  encodeIndexedPNG(32, 32, im, PAL_RGB, null).then(png => {
    // base64 by hand: the page has no other need of it and the smoke's
    // sandbox has no btoa.
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let b = '';
    for (let i = 0; i < png.length; i += 3) {
      const n = (png[i] << 16) | ((png[i + 1] || 0) << 8) | (png[i + 2] || 0);
      b += A[n >> 18] + A[(n >> 12) & 63] + (i + 1 < png.length ? A[(n >> 6) & 63] : '=') + (i + 2 < png.length ? A[n & 63] : '=');
    }
    const t = top, w = side;
    const css = rule + '.tabSheet { border-width:' + t + 'px ' + w + 'px; border-image-source:url(data:image/png;base64,' + b + '); border-image-slice:' + t + ' ' + w + '; border-image-repeat:repeat; }\n';
    style.textContent = out.css = css;
    out.frame = true;
  }).catch(() => {});
}

/* Which face the page is set in. Three sources and one rule: the reader's
   choice wins, and without one the game's own face is used when an open file
   has given us one and Chicago Kare when it has not. Every stack ends in the
   system sans because Chicago Kare does not carry a handful of the marks this
   page uses, and those should fall through to what stood beside Chicago on a
   real Macintosh rather than to a serif.

   Kept apart from installGameFont on purpose: that one makes the TrueType out
   of the file's sfnt whatever the page is drawing in, so the game's font can
   be read, shown and exported without being imposed on a reader who asked for
   something else. Before 12 September 2026 there was no choice to make, since
   the stylesheet named the file's family first and a copy of the game's face
   shipped in res/ stood in until the file arrived. */
const FACE_FALLBACK = "-apple-system, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const FACE_STACKS = {
  game: "'ArgosGame', 'ChicagoKare', 'Carthage', " + FACE_FALLBACK,
  chicago: "'ChicagoKare', 'Carthage', " + FACE_FALLBACK,
  // A reader who asked for this device's face gets it, marks and all.
  system: FACE_FALLBACK
};
// The text face, which is Geneva only where the reader has expressed no
// preference: an explicit choice is a choice about the page, not about one
// role in it, so it takes both variables.
const TEXT_STACK = "'Geneva9', 'Carthage', " + FACE_FALLBACK;
function storedFace() {
  let stored = null;
  try { stored = localStorage.getItem('cythera.face'); } catch (e) { stored = null; }
  return (stored && FACE_STACKS[stored]) ? stored : null;
}
function faceChoice() {
  return storedFace() || (window.GAME_FONT ? 'game' : 'chicago');
}
function setFace() {
  const pick = faceChoice();
  const stack = FACE_STACKS[pick] || FACE_STACKS.chicago;
  const text = storedFace() ? stack : TEXT_STACK;
  try {
    document.documentElement.style.setProperty('--face', stack);
    document.documentElement.style.setProperty('--face-text', text);
  } catch (e) { quiet(e); }
  // Published for canvasFace, which is called from the atlas paint loop and
  // must not read the document to find out what it is drawing in.
  window.FACE_STACK_NOW = stack;
  window.FACE_IN_USE = pick;
  const r = document.querySelector('input[name="faceChoice"][value="' + pick + '"]');
  if (r) r.checked = true;
  return pick;
}
function setFaceChoice(v) {
  try { localStorage.setItem('cythera.face', v); } catch (e) { quiet(e); }
  setFace();
}
/* Canvas takes a font string rather than a stack, so the face in use has to be
   read back out of the custom property. Guarded, and not only for tidiness: a
   canvas label is drawn from a paint loop, so anything thrown here takes the
   map with it, and getComputedStyle is exactly the sort of thing a harness or
   an old browser stubs without getPropertyValue. */
function canvasFace(px) {
  // Read from the variable setFace() publishes, never from the document. The
  // first version of this asked getComputedStyle for --face, which is a style
  // flush, and both callers run inside paintAtlas: that put two forced
  // recalculations into every frame of every pan and zoom of the World tab,
  // and the map went jerky within an hour of shipping. The stack is a string
  // this file already knows; there is nothing to ask the document for.
  return px + 'px ' + (window.FACE_STACK_NOW || FACE_STACKS[window.FACE_IN_USE] || FACE_STACKS.chicago);
}
// Settle the face at load, not only when a font arrives: the stylesheet's own
// default covers the first paint, but a reader who chose Chicago or this
// device's face last time would otherwise have that choice ignored until a
// file opened, and the radio would show nothing checked.
try { setFace(); } catch (e) { quiet(e); }
function installGameFont() {
  window.GAME_FONT = null;
  const fork = window.CYTHERA_RSRC;
  if (!fork) { window.GAME_FONT_STATE = 'no resource fork is open'; return; }
  const entry = gameFontResource();
  if (!entry) { window.GAME_FONT_STATE = 'the resource fork holds no sfnt'; return; }
  let ttf;
  try { ttf = sfntToTrueType(fork.dataOf('sfnt', entry)); }
  catch (e) { window.GAME_FONT_STATE = 'sfnt ' + entry.id + ': could not make a TrueType file of it: ' + e.message; return; }
  window.GAME_FONT_TTF = ttf;
  if (typeof FontFace === 'undefined' || !document.fonts) { window.GAME_FONT_STATE = 'this browser cannot load a font from bytes'; return; }
  try {
    // A second face under the same family name would not replace the first,
    // so a re-install after a font swap takes the old one out first.
    try { if (window.GAME_FONT_FACE) document.fonts.delete(window.GAME_FONT_FACE); } catch (e) { quiet(e); }
    window.GAME_FONT_FACE = null;
    const face = new FontFace('ArgosGame', ttf.buffer.slice(ttf.byteOffset, ttf.byteOffset + ttf.byteLength));
    window.GAME_FONT_STATE = 'loading';
    face.load().then(f => { document.fonts.add(f); window.GAME_FONT_FACE = f; window.GAME_FONT = (entry.name || 'sfnt') + ' ' + entry.id; window.GAME_FONT_STATE = '';
                            // The face only becomes choosable once it has
                            // loaded, so the stack is settled here rather
                            // than when the fork was opened.
                            try { setFace(); } catch (e) { quiet(e); } })
               .catch(e => { window.GAME_FONT_STATE = 'the browser refused sfnt ' + entry.id + ': ' + (e && e.message || e); });
  } catch (e) { window.GAME_FONT_STATE = 'FontFace: ' + e.message; }
}

const RSRC_DELVER_TYPES = {
  eSTM: 'editor stamp',
  eBRS: 'editor brush',
  MSta: 'saved game state',
  FILT: 'displacement filter'
};

/* ---- the displacement filters -----------------------------------------------
   Read on 25 September 2026, off the program rather than guessed: the seven
   FILT resources are the game's, not the editor's. LoadGlobals reads the
   archive's 0xF016 into a byte a tile and calls LoadDisplacementFilters,
   which fetches FILT 0 to 255 and keeps each one's first byte, a period, its
   32 bytes at +4, a bit a palette index, and its body at +36. The tile
   copiers (TViewer::CopyTile, TCopyTile and MaskAnyTile) run
   DisplacementFilterTile over a tile whose 0xF016 byte is nonzero, unless
   the preferences byte turns filters off: for each of the 1,024 pixels, one
   whose colour has its bit in the mask is fetched from the source tile at
   the signed offset the current frame holds for that pixel, the rest copied
   as they are. AdvanceDisplacementFilters steps every filter's frame by 1,024
   bytes each tick, or every other when the period is 1, and back to the
   first past the end. So a filter is a period, a set of colours, and frames
   of per-pixel offsets, and it is water, shore and seaweed rippling, lava
   and the void churning, fire shimmering, and trees and crops swaying. The
   68K slice does the same by GetResource('FILT') in CODE 1. Which tiles a
   filter covers is 0xF016's, read here; the mask's colours are the game's
   own palette. */
function rsrcDisplacementFilters() {
  const fork = window.CYTHERA_RSRC;
  if (!fork) return [];
  let table = null;
  try { const raw = ARCHIVE && getResourceBytes(ARCHIVE, 0xF016); if (raw) table = smartDecrypt(raw, 0xF016).data; } catch (e) { quiet(e, 'the displacement filter table'); table = null; }
  const out = [];
  for (const entry of fork.resourcesByType.FILT || []) {
    let data; try { data = fork.dataOf('FILT', entry); } catch (e) { continue; }
    if (data.length < 36 + 1024) continue;
    const mask = [];
    for (let p = 0; p < 256; p++) if ((data[4 + (p >> 3)] >> (p & 7)) & 1) mask.push(p);
    const frames = Math.floor((data.length - 36) / 1024);
    const tiles = [];
    if (table) for (let t = 0; t < table.length; t++) if (table[t] === entry.id) tiles.push(t);
    out.push({ entry, data, period: data[0], mask, frames, tiles });
  }
  return out;
}
// One frame of a filter as a picture: each pixel's offset by its size, the
// still ones dark, forward offsets warm and backward ones cool.
function drawFilterFrame(canvas, f, frame, px) {
  const size = px || 3;
  canvas.width = 32 * size; canvas.height = 32 * size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const base = 36 + frame * 1024;
  for (let i = 0; i < 1024; i++) {
    let v = f.data[base + i]; if (v > 127) v -= 256;
    const a = Math.min(1, Math.abs(v) / 100);
    ctx.fillStyle = v === 0 ? '#1c1913' : v > 0 ? 'rgba(232,180,90,' + (0.35 + 0.65 * a) + ')' : 'rgba(110,170,232,' + (0.35 + 0.65 * a) + ')';
    ctx.fillRect((i % 32) * size, Math.floor(i / 32) * size, size, size);
  }
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}

/* A stamp declares its own dimensions. A brush is sixteen entries, and they
   are a four by four table rather than a run: every brush in the file holds
   exactly sixteen, and in the ones whose four corners of the diagonal are
   zero the other twelve are the twelve tiles of one sheet -- one terrain
   meeting another, with the diagonal empty because a terrain meeting itself
   needs no transition. The wall brushes carry a tile on the diagonal too and
   have eight distinct tiles rather than twelve. Five of them (the beaches,
   the sand edge, Better Caves, Cave Ridge) point at composite tiles, ids
   above 0x1000, which is the composition table rather than a sheet.

   What the four rows and columns are named is not read: nothing in the fork
   labels them, and the editor that did is not here. So the table is shown as
   a table and nothing is claimed about which terrain is which. */
function rsrcTilePattern(type, data) {
  if (type === 'eSTM') {
    if (data.length < 8) return null;
    const w = u16be(data, 0), h = u16be(data, 2);
    if (w < 1 || h < 1 || w > 64 || h > 64) return null;
    const n = Math.min(w * h, Math.floor((data.length - 4) / 2));
    const tiles = [];
    for (let i = 0; i < n; i++) tiles.push(u16be(data, 4 + i * 2));
    // ID 128 is 164 bytes where the others are 132, so it carries 32 bytes this
    // reading does not account for. The 8x8 grid it declares is complete, so
    // the extra is reported rather than guessed at.
    return { tiles, cols: w, rows: h, extraBytes: data.length - 4 - w * h * 2 };
  }
  const n = Math.floor(data.length / 2);
  if (!n) return null;
  const tiles = [];
  for (let i = 0; i < n; i++) tiles.push(u16be(data, i * 2));
  const cols = n === 16 ? 4 : Math.min(n, 8);
  // A zero entry is an empty cell of the table, not tile 0. Drawing tile 0
  // put a black square in each corner of the diagonal, which read as art
  // that had failed to load.
  return { tiles, cols, rows: Math.ceil(n / cols), extraBytes: data.length - n * 2, table: n === 16, blankZero: true };
}

function drawTilePattern(canvas, pat, px) {
  const size = px || 16;
  canvas.width = pat.cols * size;
  canvas.height = pat.rows * size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < pat.tiles.length; i++) {
    const x = (i % pat.cols) * size, y = Math.floor(i / pat.cols) * size;
    if (!pat.tiles[i] && pat.blankZero) continue;
    try { drawTileAt(ctx, pat.tiles[i], x, y, false, size); } catch (e) { quiet(e); }
  }
  // A table is ruled, so an empty cell reads as a cell rather than a hole.
  if (pat.table) {
    ctx.strokeStyle = 'rgba(232,220,184,.35)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= pat.cols; c++) { ctx.beginPath(); ctx.moveTo(c * size + .5, 0); ctx.lineTo(c * size + .5, canvas.height); ctx.stroke(); }
    for (let r = 0; r <= pat.rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * size + .5); ctx.lineTo(canvas.width, r * size + .5); ctx.stroke(); }
  }
  canvas.style.imageRendering = 'pixelated';
  return canvas;
}

// Everything in the fork, in one list, so a gallery can show the Delver types
// and still say what else is in there.
function rsrcInventory() {
  const fork = window.CYTHERA_RSRC;
  if (!fork) return null;
  const delver = [], other = [];
  let bytes = 0;
  for (const t of fork.typeList) {
    // sizeOf reads the length word without copying the payload, which is the
    // whole reason it is separate from dataOf in js/mac-resfork.js -- summing
    // the fork this way costs nothing.
    let size = 0;
    for (const e of fork.resourcesByType[t.type] || []) {
      try { size += fork.sizeOf(t.type, e); } catch (err) { /* a bad entry costs its own size */ }
    }
    bytes += size;
    const row = { type: t.type, count: t.count, bytes: size };
    (RSRC_DELVER_TYPES[t.type] ? delver : other).push(row);
  }
  return { delver, other, total: fork.total(), types: fork.typeList.length, bytes };
}

function rsrcPatternList() {
  const fork = window.CYTHERA_RSRC;
  if (!fork) return [];
  const out = [];
  for (const type of ['eSTM', 'eBRS']) {
    for (const entry of fork.resourcesByType[type] || []) {
      let pat = null;
      try { pat = rsrcTilePattern(type, fork.dataOf(type, entry)); } catch (e) { pat = null; }
      if (pat) out.push({ type, entry, pat });
    }
  }
  return out;
}

function renderRsrcSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';

  const inv = rsrcInventory();
  if (!inv) {
    out.textContent = 'No resource fork. It comes from the file you opened Cythera Data from: ' +
      'a .hqx, MacBinary or AppleSingle file includes both forks, but the data fork alone does not. ' +
      'Open the file again from "Cythera Data.hqx" to get it.';
    return;
  }
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const list = rsrcPatternList().filter(it =>
    !q || (it.entry.name || '').toLowerCase().includes(q) ||
    it.type.toLowerCase().includes(q) || String(it.entry.id).includes(q));

  for (const it of list) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const imgwrap = document.createElement('div');
    imgwrap.className = 'cellimgwrap';
    const canvas = document.createElement('canvas');
    imgwrap.appendChild(canvas);
    cell.appendChild(imgwrap);

    const lblDiv = document.createElement('div');
    lblDiv.className = it.entry.name ? 'lbl' : 'lbl nolabel';
    lblDiv.textContent = it.entry.name || ('(unnamed ' + it.type + ')');
    cell.appendChild(lblDiv);

    const residDiv = document.createElement('div');
    residDiv.className = 'resid';
    residDiv.textContent = it.type + ' ' + it.entry.id + ' · ' + it.pat.cols + '×' + it.pat.rows +
      (it.pat.table ? ' table' : ' squares');
    cell.appendChild(residDiv);

    // One scale for stamps and brushes alike, and the cell grows to hold
    // what it is given. An eight by eight stamp is 256 pixels square and
    // was being shown at 84, which is ten pixels a square: every meadow
    // looked like the same speckle.
    cell.classList.add('propCell');
    lazyTile(cell, () => {
      drawTilePattern(canvas, it.pat, 24);
      fitGalleryCell(cell, imgwrap, { canvas, cols: it.pat.cols, rows: it.pat.rows }, 24);
    });
    cell.title = 'Click for its tiles';
    cell.onclick = () => showRsrcDetail(it.type, it.entry.id);
    grid.appendChild(cell);
  }
  // The displacement filters, a card each, after the stamps and brushes.
  const filters = rsrcDisplacementFilters().filter(f => !q || 'filt'.includes(q) || String(f.entry.id).includes(q) || f.tiles.some(t => (terrainNameFor(t) || '').toLowerCase().includes(q)));
  if (filters.length) {
    const box = document.createElement('div');
    box.className = 'mechView';
    box.style.cssText = 'grid-column:1/-1';
    box.innerHTML = '<div class="partsTitle">Displacement filters</div>' +
      '<p class="mechSub">The game reads these when it starts (' + pefChip('LoadDisplacementFilters') + ') and runs one over every tile the table 0xF016 names for it (' + pefChip('DisplacementFilterTile') +
      '): the game replaces a pixel whose color is in the filter’s set with the pixel of the tile at the offset the current frame gives for it, and the frame moves on every tick (' + pefChip('AdvanceDisplacementFilters') +
      '), or every other tick when the period is 1. This is how water, shore and seaweed ripple, lava and the void churn, fire shimmers, and trees and crops sway.</p>';
    for (const f of filters) {
      const card = document.createElement('div');
      card.style.cssText = 'margin:8px 0 14px';
      const names = new Map();
      for (const t of f.tiles) { const nm = terrainNameFor(t) || ('tile 0x' + t.toString(16).toUpperCase()); names.set(nm, (names.get(nm) || 0) + 1); }
      const runs = []; let s = null, prev = null;
      for (const p of f.mask.concat([null])) { if (s === null) { s = prev = p; continue; } if (p !== prev + 1) { runs.push([s, prev]); s = p; } prev = p; }
      card.innerHTML = '<div style="color:#fff">FILT ' + f.entry.id + (f.entry.name ? ' “' + svEsc(f.entry.name) + '”' : '') + ': ' + f.frames + ' frames of 32 by 32 offsets, stepped ' + (f.period ? 'every ' + (f.period + 1) + ' ticks' : 'every tick') +
        ', over ' + f.mask.length + ' color' + (f.mask.length === 1 ? '' : 's') + (f.tiles.length ? ', on ' + f.tiles.length + ' tile' + (f.tiles.length === 1 ? '' : 's') + ': ' + svEsc([...names.entries()].map(([k, v]) => k + (v > 1 ? ' ×' + v : '')).join(', ')) : ', on no tile the table names') + '</div>';
      const sw = document.createElement('div');
      sw.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;margin:4px 0';
      for (const p of f.mask) { const d = document.createElement('span'); const c = PAL_RGB[p] || [0, 0, 0]; d.style.cssText = 'width:10px;height:10px;display:inline-block;background:rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; d.title = 'color ' + p; sw.appendChild(d); }
      card.appendChild(sw);
      const strip = document.createElement('div');
      strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end';
      for (let k = 0; k < f.frames; k++) { const c = document.createElement('canvas'); drawFilterFrame(c, f, k, 2); c.title = 'frame ' + k; strip.appendChild(c); }
      for (const t of f.tiles.slice(0, 8)) { const c = document.createElement('canvas'); c.width = 32; c.height = 32; try { drawTileAt(c.getContext('2d'), t, 0, 0, false, 32); } catch (e) { quiet(e); } c.style.cssText = 'width:32px;height:32px;image-rendering:pixelated;border:1px solid #33302a'; c.title = terrainNameFor(t) || ('tile 0x' + t.toString(16)); strip.appendChild(c); }
      card.appendChild(strip);
      box.appendChild(card);
    }
    grid.appendChild(box);
  }
  refreshLabelLegend();

  const kinds = {};
  for (const it of list) kinds[it.type] = (kinds[it.type] || 0) + 1;
  out.textContent =
    'Resource fork: ' + inv.total + ' resources in ' + inv.types + ' types, ' +
    fmtBytes(inv.bytes) + '. Showing ' +
    Object.keys(kinds).map(k => kinds[k] + ' ' + RSRC_DELVER_TYPES[k]).join(' and ') +
    (q ? ' matching “' + q + '”' : '') + '. ' +
    'A stamp is a patch of terrain at the size it states. A brush is sixteen entries, shown here as a four-by-four table of one terrain meeting another; the empty cells are the ones the resource leaves at zero. The resource fork does not record the names of the rows and columns. ' +
    'Also in the fork, under Data › Cythera Data › Resource Fork: ' +
    inv.other.map(r => r.count + ' ' + r.type.trim()).join(', ') + '.';
}

function showRsrcDetail(type, id) {
  markDetailView('rsrc', type + ':' + id);
  stopSpriteAnimations();
  const fork = window.CYTHERA_RSRC;
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = 'block';
  grid.innerHTML = '';
  if (!fork) { out.textContent = 'No resource fork is open.'; return; }
  const entry = (fork.resourcesByType[type] || []).find(e => e.id === id);
  if (!entry) { out.textContent = 'No ' + type + ' ' + id + ' in this fork.'; return; }

  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All stamps & brushes';
  back.onclick = () => { setMode('sheet'); };
  grid.appendChild(back);

  const data = fork.dataOf(type, entry);
  const pat = rsrcTilePattern(type, data);
  const head = document.createElement('div');
  head.style.cssText = 'width:100%;text-align:center;margin:12px 0';
  if (pat) {
    const big = document.createElement('canvas');
    drawTilePattern(big, pat, 32);
    const scale = Math.min(384 / big.width, 384 / big.height, 4);
    big.style.width = Math.round(big.width * scale) + 'px';
    big.style.height = Math.round(big.height * scale) + 'px';
    big.style.border = '1px solid #9b8850';
    head.appendChild(big);
  }
  const cap = document.createElement('div');
  cap.style.cssText = 'color:#fff;margin-top:8px;white-space:pre-line';
  cap.textContent = (entry.name || '(unnamed)') + '\n' +
    type + ' ' + entry.id + ': ' + RSRC_DELVER_TYPES[type] + ', ' + data.length + ' bytes' +
    (pat ? ', ' + pat.tiles.length + ' tiles in a ' + pat.cols + '×' + pat.rows + ' grid' : '') +
    (pat && pat.extraBytes ? '\n' + pat.extraBytes + ' bytes past the end of the grid, unaccounted for' : '') +
    (pat && pat.guessedShape ? '\nThe grid shape is this page’s guess; the file only gives a list of tiles.' : '') +
    '\nUsed only by the editor: according to the wiki, changing or deleting these has no effect on the game.';
  head.appendChild(cap);
  grid.appendChild(head);

  if (pat) {
    const table = document.createElement('div');
    table.style.cssText = 'width:100%;max-width:720px;margin:0 auto;font-size:0.8125rem';
    const rows = [];
    for (let i = 0; i < pat.tiles.length; i++) {
      const t = pat.tiles[i];
      const nm = terrainNameFor(t) || compositeTileName(t) || '';
      rows.push('<tr><td style="color:#b5b2a8;padding:1px 8px">' + i + '</td>' +
        '<td style="font-family:ui-monospace,Menlo,monospace;padding:1px 8px">0x' +
        t.toString(16).toUpperCase().padStart(4, '0') + '</td>' +
        '<td style="padding:1px 8px">' + svEsc(nm) + '</td></tr>');
    }
    table.innerHTML = '<table style="margin:0 auto"><thead><tr>' +
      '<th style="text-align:left;padding:1px 8px">id</th>' +
      '<th style="text-align:left;padding:1px 8px">tile</th>' +
      '<th style="text-align:left;padding:1px 8px">terrain (F004)</th></tr></thead><tbody>' +
      rows.join('') + '</tbody></table>';
    grid.appendChild(table);
  }
  out.textContent = (entry.name || type + ' ' + entry.id) +
    (pat ? ', ' + pat.tiles.length + ' tiles' : '');
}

/* ---------------------------------------------------------------------------
   The rest of the resource fork
   ---------------------------------------------------------------------------
   Above this, the fork is read for the four Delver-only types that need
   Cythera's tile system to draw. Everything else in it -- PICT, NFNT, clut,
   STR#, sfnt, FOND, TMPL -- is an ordinary classic-Mac resource, and until
   now this page sent people to a second tool for those. That tool, the
   resource fork browser, was more general-purpose than this repository
   and is gone; its decoders are js/mac-rsrc-types.js, and this is the view
   that uses them.

   It reads two forks. "Cythera Data" is the one already open, and the
   application's own fork is fetched on demand: 339 resources across 52 types,
   which is where the game's icons, dialogs, menus, sounds and cursors live.
   Neither is the game archive -- nothing here decrypts or disassembles.
--------------------------------------------------------------------------- */
window.RSRC_SOURCE = 'data';        // 'data' = Cythera Data, 'app' = the application
window.APP_RSRC = null;             // the application's fork, once fetched
window.APP_DATA = null;             // and its data fork, the PEF executable, from the same container
window.APP_PEF = null;              // parsePEF over it, with the routines, once asked for
window.APP_RSRC_STATE = '';         // '', 'loading', or an error to show

function rsrcViewFork() {
  return window.RSRC_SOURCE === 'app' ? window.APP_RSRC : window.CYTHERA_RSRC;
}

// When the archive came in through the installer, adoptArchive has already
// opened the application's fork out of it and this is never reached. The
// rest is for an archive opened on its own: the application ships as
// Cythera.hqx, extractDelverArchive() refuses it on purpose -- it is not a
// Delver archive -- so this unwraps the container itself and keeps only the
// resource fork.
// Local candidates by default -- the application is not in the repository --
// but `?app=<url>` names a remote copy, the same way `?src=` does for the
// data archive. The published preview passes both, pointing at the owner's
// own hosted copies, which is what lets the application's 339 resources
// (its icons, dialogs, PICTs, cursors) be browsed from a phone.
const APP_HQX_CANDIDATES = [
  'Cythera.hqx', 'reference/game/Cythera.hqx', 'reference/Cythera.hqx',
  'res/Cythera.hqx'
];
async function loadApplicationFork() {
  if (window.APP_RSRC || window.APP_RSRC_STATE === 'loading') return window.APP_RSRC;
  window.APP_RSRC_STATE = 'loading';
  rerenderForkView();
  let lastErr = '';
  const forcedApp = new URLSearchParams(location.search).get('app');
  const candidates = forcedApp ? [forcedApp].concat(APP_HQX_CANDIDATES) : APP_HQX_CANDIDATES;
  for (const url of candidates) {
    try {
      const raw = await fetchWithProgress(url, 'Downloading the program');
      const c = sniffMacContainer(raw);
      if (!c || !c.rsrc || !c.rsrc.length) { lastErr = 'no resource fork in ' + url; continue; }
      window.APP_RSRC = openResourceFork(c.rsrc);
      // The RAW fork as well as the parsed one. The comparison section needs
      // bytes: describeApplicationDiff opens both sides itself so that it can
      // say the same things about an application this page never opened.
      window.APP_RSRC_RAW = c.rsrc;
      window.APP_DATA = c.data && c.data.length ? c.data : null; window.APP_PEF = null;
      window.APP_RSRC_STATE = '';
      try { installDialogueBox(); } catch (e) { quiet(e); }
      DERIVED.AI_HOOK_NAMES = null;
      syncInstallerTabs();
      syncTabsTo(document.getElementById('categorySelect').value);
      rerenderForkView();
      return window.APP_RSRC;
    } catch (e) { lastErr = e.message; }
  }
  window.APP_RSRC_STATE = 'The page could not load the program: ' + lastErr;
  rerenderForkView();
  return null;
}

// What can this resource become? exportArtifacts() is the one list, so the
// gallery, the detail view and the download buttons cannot disagree about
// which types are decodable.
const _rsrcArtifactCache = new Map();
function rsrcArtifacts(fork, type, entry) {
  const key = (fork === window.APP_RSRC ? 'a:' : 'd:') + type + ':' + entry.id;
  if (_rsrcArtifactCache.has(key)) return _rsrcArtifactCache.get(key);
  let out = [];
  try { out = exportArtifacts(fork, type, entry, fork.dataOf(type, entry)) || []; }
  catch (e) { out = []; }
  _rsrcArtifactCache.set(key, out);
  return out;
}

function macRsrcList(fork) {
  const out = [];
  for (const t of fork.typeList) {
    for (const e of fork.resourcesByType[t.type] || []) out.push({ type: t.type, entry: e });
  }
  return out;
}

function rsrcTypeLabel(type) {
  return (typeof TYPE_BADGES !== 'undefined' && TYPE_BADGES[type]) ||
         (typeof RSRC_DELVER_TYPES !== 'undefined' && RSRC_DELVER_TYPES[type]) || '';
}

// Which fork this gallery shows used to be a pair of buttons at the top of
// it; it is the pair of Resource Fork tabs now, one under Cythera Data and one
// under Cythera, and the category (MACRSRC / APPRSRC) sets RSRC_SOURCE.
// One string list out of a fork, or null when the fork or the list is absent.
function forkStringList(fork, id) {
  if (!fork) return null;
  const entry = (fork.resourcesByType['STR#'] || []).find(e => e.id === id);
  if (!entry) return null;
  try { return decodeSTRList(fork.dataOf('STR#', entry)); } catch (e) { return null; }
}

// Which views re-render when the application's fork arrives, or the filter
// changes: everything drawn from a fork rather than the archive.
function rerenderForkView() {
  const v = window.CUR_SUBN;
  if (currentMode !== 'sheet') return;
  if (v === 'MACRSRC' || FORK_VIEWS[v] || v === 'AIRULES' || v === 'ITEMS' || v === 'INSTALLER') setMode('sheet');
}

// The fork gallery. With no view it is one fork, whole, grouped by kind
// (RSRC_KINDS); with a view (FORK_VIEWS[CUR_SUBN]) it is the kinds that view
// names, from one fork or both. Either way a cell is the same cell and opens
// the same detail view, which is what makes a Screens tab cheap: it is this
// gallery filtered, not a second renderer.
function renderMacRsrcSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const view = FORK_VIEWS[window.CUR_SUBN] || null;
  if (window.CUR_SUBN === 'FONTS') { grid.appendChild(fontSwapPanel()); grid.appendChild(strikeSwapPanel()); }
  const kinds = view ? view.kinds.map(id => RSRC_KINDS.find(k => k.id === id)) : null;
  const sources = view ? (view.source === 'both' ? ['data', 'app'] : [view.source]) : [window.RSRC_SOURCE === 'app' ? 'app' : 'data'];
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const forkName = src => src === 'app' ? 'Cythera (application)' : 'Cythera Data';
  let drawable = 0, textual = 0, raw = 0, shown = 0, total = 0;
  const typesSeen = new Set();
  const missing = [];

  for (const src of sources) {
    const fork = src === 'app' ? window.APP_RSRC : window.CYTHERA_RSRC;
    if (!fork) {
      missing.push(src === 'app'
        ? (window.APP_RSRC_STATE === 'loading' ? 'Loading the program…'
           : window.APP_RSRC_STATE || 'The program’s fork is not open yet.')
        : 'No resource fork came with the file. It comes from the file you opened Cythera Data from: a .hqx, MacBinary or AppleSingle file includes both forks, but the data fork alone does not.');
      continue;
    }
    total += fork.total();
    for (const t of fork.typeList) typesSeen.add(t.type);
    // Cells by kind, in the table's order; a type in no kind last.
    const byKind = new Map();
    for (const it of macRsrcList(fork)) {
      if (q && !(it.type.toLowerCase().includes(q) || String(it.entry.id).includes(q) ||
                 (it.entry.name || '').toLowerCase().includes(q) ||
                 rsrcTypeLabel(it.type).toLowerCase().includes(q))) continue;
      const k = RSRC_KIND_OF.get(it.type) || null;
      if (kinds && !kinds.includes(k)) continue;
      const key = k ? k.id : 'other';
      if (!byKind.has(key)) byKind.set(key, []);
      byKind.get(key).push(it);
    }
    const order = (kinds || RSRC_KINDS).map(k => k.id).concat(kinds ? [] : ['other']);
    for (const key of order) {
      const items = byKind.get(key);
      if (!items || !items.length) continue;
      const k = RSRC_KINDS.find(x => x.id === key);
      const h = document.createElement('div');
      h.className = 'propHead';
      h.textContent = (sources.length > 1 ? forkName(src) + ', ' : '') + (k ? k.label : 'Other') + ' (' + items.length + ')';
      if (k && k.note) {
        const note = document.createElement('div');
        note.className = 'kindNote';
        note.textContent = k.note;
        if (k.view && k.view !== window.CUR_SUBN && !view) {
          const leaf = TAB_LEAF_FOR.get(k.view);
          if (leaf) {
            const b = document.createElement('button');
            b.className = 'navChip';
            b.textContent = 'Shown under ' + tabTrail(leaf);
            b.onclick = () => showCategory(k.view);
            note.appendChild(document.createTextNode(' '));
            note.appendChild(b);
          }
        }
        h.appendChild(note);
      }
      grid.appendChild(h);
      for (const it of items) {
        shown++;
        const cell = document.createElement('div');
        cell.className = 'cell';
        const imgwrap = document.createElement('div');
        imgwrap.className = 'cellimgwrap';
        const canvas = document.createElement('canvas');
        imgwrap.appendChild(canvas);
        cell.appendChild(imgwrap);
        const lbl = document.createElement('div');
        lbl.className = it.entry.name ? 'lbl' : 'lbl nolabel';
        lbl.textContent = it.entry.name || rsrcTypeLabel(it.type) || '(unnamed)';
        cell.appendChild(lbl);
        const rid = document.createElement('div');
        rid.className = 'resid';
        rid.textContent = it.type + ' ' + it.entry.id;
        cell.appendChild(rid);
        lazyTile(cell, () => {
          const arts = rsrcArtifacts(fork, it.type, it.entry);
          const pic = arts.find(a => a.canvas && a.canvas.width);
          if (pic) {
            drawable++;
            canvas.width = pic.canvas.width; canvas.height = pic.canvas.height;
            canvas.getContext('2d').drawImage(pic.canvas, 0, 0);
            const scale = Math.min(84 / canvas.width, 96 / canvas.height, 4);
            canvas.style.width = Math.round(canvas.width * scale) + 'px';
            canvas.style.height = Math.round(canvas.height * scale) + 'px';
          } else {
            imgwrap.removeChild(canvas);
            const note = document.createElement('div');
            const txt = arts.find(a => a.text);
            if (txt) { textual++; note.textContent = txt.text.slice(0, 120); }
            else { raw++; note.textContent = fmtBytes(fork.sizeOf(it.type, it.entry)); }
            note.style.cssText = 'font-size:0.6875rem;color:var(--gold);opacity:.72;padding:6px;max-height:96px;overflow:hidden;white-space:pre-wrap';
            imgwrap.appendChild(note);
          }
        });
        cell.title = 'Open ' + it.type + ' ' + it.entry.id;
        cell.onclick = () => showMacRsrcDetail(it.type, it.entry.id, src);
        grid.appendChild(cell);
      }
    }
  }

  if (missing.length && !shown) { out.textContent = missing.join(' '); return; }
  if (view) {
    const label = optionLabel(window.CUR_SUBN).replace(/ \(resource forks?\)$/, '');
    out.textContent = label + ': ' + shown + ' resource' + (shown === 1 ? '' : 's') + ' from ' +
      sources.filter(src => src === 'app' ? window.APP_RSRC : window.CYTHERA_RSRC).map(forkName).join(' and ') +
      (missing.length ? '. ' + missing.join(' ') : '.') +
      (q ? ' (filtered)' : '');
  } else {
    out.textContent = forkName(sources[0]) + ' resource fork: ' + total + ' resources in ' +
      typesSeen.size + ' types' + (q ? ', ' + shown + ' shown' : '') +
      ', grouped by purpose. A kind of resource shown elsewhere on the site says where.';
  }
}

function showMacRsrcDetail(type, id, source) {
  // A view over both forks names the fork in the link; a one-fork view keeps
  // the older `TYPE:id` form, so saved links to it still open.
  const both = FORK_VIEWS[window.CUR_SUBN] && FORK_VIEWS[window.CUR_SUBN].source === 'both';
  if (source) window.RSRC_SOURCE = source === 'app' ? 'app' : 'data';
  markDetailView('macrsrc', (both ? window.RSRC_SOURCE + ':' : '') + type + ':' + id);
  stopAllViewActivity();
  const fork = rsrcViewFork();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = 'block';
  grid.innerHTML = '';
  if (!fork) { out.textContent = 'No resource fork is open.'; return; }
  const entry = (fork.resourcesByType[type] || []).find(e => e.id === id);
  if (!entry) { out.textContent = 'No ' + type + ' ' + id + ' in this fork.'; return; }

  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All resources';
  back.onclick = () => { setMode('sheet'); };
  grid.appendChild(back);

  const data = fork.dataOf(type, entry);
  const head = document.createElement('div');
  head.style.cssText = 'width:100%;text-align:center;margin:12px 0;color:#fff;white-space:pre-line';
  head.textContent = (entry.name || '(unnamed)') + '\n' + type + ' ' + entry.id +
    (rsrcTypeLabel(type) ? ', ' + rsrcTypeLabel(type) : '') + ', ' + fmtBytes(data.length) +
    (entry.attrs ? '\nattributes: ' + (resourceAttrNames(entry.attrs).join(', ') || 'none') : '');
  grid.appendChild(head);

  const arts = rsrcArtifacts(fork, type, entry);
  const base = safeFileName((entry.name || (type.trim() + '_' + entry.id)));

  for (const a of arts) {
    const box = document.createElement('div');
    box.style.cssText = 'width:100%;text-align:center;margin:10px 0';
    if (a.canvas && a.canvas.width) {
      const cv = document.createElement('canvas');
      cv.width = a.canvas.width; cv.height = a.canvas.height;
      cv.getContext('2d').drawImage(a.canvas, 0, 0);
      const scale = Math.min(384 / cv.width, 384 / cv.height, 6);
      cv.style.width = Math.round(cv.width * scale) + 'px';
      cv.style.height = Math.round(cv.height * scale) + 'px';
      cv.style.border = '1px solid #9b8850';
      cv.style.imageRendering = 'pixelated';
      box.appendChild(cv);
      if (a.tag) {
        const t = document.createElement('div');
        t.style.cssText = 'font-size:0.75rem;color:#b5b2a8;margin-top:4px';
        t.textContent = a.tag;
        box.appendChild(t);
      }
      const dl = document.createElement('button');
      dl.className = 'secondary';
      dl.style.marginTop = '6px';
      dl.textContent = 'Save PNG';
      dl.onclick = () => triggerPNGDownload(cv, base + (a.tag ? '_' + safeFileName(a.tag) : '') + '.png');
      box.appendChild(document.createElement('br'));
      box.appendChild(dl);
    } else if (a.text) {
      const pre = document.createElement('pre');
      pre.style.cssText = 'text-align:left;max-width:820px;margin:0 auto;white-space:pre-wrap;' +
        'font-size:0.8125rem;max-height:420px;overflow:auto;border:1px solid #6b6b6b;padding:10px';
      pre.textContent = a.text;
      box.appendChild(pre);
    } else if (a.blob || a.wav) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.src = URL.createObjectURL(a.blob || a.wav);
      box.appendChild(audio);
    }
    grid.appendChild(box);
  }

  // Always the bytes, whatever else was on offer. rsrcHexDump is the classic-Mac
  // one from js/mac-rsrc-types.js -- js/delv-archive.js has a different hexDump
  // for archive resources and the two used to share a name.
  const dump = document.createElement('details');
  dump.style.cssText = 'width:100%;max-width:820px;margin:12px auto';
  const sum = document.createElement('summary');
  sum.textContent = 'Raw bytes';
  sum.style.cursor = 'pointer';
  dump.appendChild(sum);
  const pre = document.createElement('pre');
  pre.style.cssText = 'font-size:0.75rem;overflow:auto;max-height:360px';
  pre.textContent = rsrcHexDump(data, 4096);
  dump.appendChild(pre);
  grid.appendChild(dump);

  out.textContent = arts.length
    ? type + ' ' + entry.id + ': ' + arts.length + ' decoded view' + (arts.length === 1 ? '' : 's') + '.'
    : type + ' ' + entry.id + ': this page cannot decode this type; the bytes are below.';
}


function renderCharacterSheet() {
  stopSpriteAnimations();
  document.getElementById('sheetGrid').style.display = '';
  const out = document.getElementById('output');
  const grid = document.getElementById('sheetGrid');
  grid.innerHTML = '';
  const chars = loadCharacterTable();
  let shown = 0;
  for (let i = 1; i < chars.length; i++) {
    const d = characterDossier(i);
    if (!d) continue;
    // Skip empty slots: no sprite and no name of its own.
    if (!d.rec.proptype && d.name.startsWith('Character ')) continue;
    const cell = document.createElement('div');
    cell.className = 'cell charCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    // portrait if one exists, else the map sprite
    const pc = document.createElement('canvas');
    let drew = false;
    try {
      const praw = getResourceBytes(ARCHIVE, 0x8800 + (i - 1));
      if (praw) {
        const dec = decodeResource(ARCHIVE, praw, 135);
        drawToCanvas(pc, dec.W, dec.H, dec.image, 0);
        pc.style.cssText = 'width:76px;height:76px;image-rendering:pixelated;object-fit:contain;display:block';
        drew = true;
      }
    } catch (e) { quiet(e); }
    if (!drew) {
      try { drawTileToCanvas(pc, d.tile, 32); pc.style.cssText = 'width:76px;height:76px;image-rendering:pixelated'; }
      catch (e) { quiet(e); }
    }
    // Front-facing walk cycle (frames 0-3), overlapping the portrait's
    // bottom-right corner rather than cropping either one.
    // The walker orbits the OUTSIDE of the portrait, so the portrait needs a
    // margin of empty space around it to walk on. Frame counts used to be
    // printed above the portrait; they belong on the detail page, not here.
    wrap.style.position = 'relative';
    const inner = document.createElement('div');
    inner.className = 'portraitBox';
    pc.classList.add('portrait');
    inner.appendChild(pc);
    wrap.appendChild(inner);
    const info = spriteFrameInfo(d.tile, d.rec.proptype);
    /* The hero's record is the player, who is the hero or the heroine; the
       file has a sprite for each (HERO_SPRITES), so both walk round the one
       portrait, half a loop apart (the maintainer, 22 September 2026). */
    const heroine = HERO_SPRITES.find(h => h.key === 'heroine');
    const isHero = d.rec.proptype && d.rec.proptype === (HERO_SPRITES.find(h => h.key === 'hero') || {}).proptype;
    const herInfo = isHero && heroine ? spriteFrameInfo(0, heroine.proptype) : null;
    if (herInfo && !herInfo.none) {
      animateSpriteTile(inner, info, d.rec, { dir: 1, phase: 0 });
      animateSpriteTile(inner, herInfo, d.rec, { dir: 1, phase: 0.5 });
    } else animateSpriteTile(inner, info, d.rec);
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl'; lbl.textContent = d.name;
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    // "Lv 0 - Nowhere" was two facts invented about characters that record
    // neither. Show only what the archive actually holds, and nothing at all
    // when it holds neither.
    const bits = [];
    if (d.rec.level) bits.push('Lv ' + d.rec.level);
    if (d.rec.zone) bits.push(d.homeZone);
    sub.textContent = bits.join(' \u00b7 ');
    if (d.rec.zone) sub.title = d.homeZone;
    cell.appendChild(sub);
    cell.onclick = () => showCharacterDetail(i);
    cell.title = d.name;
    grid.appendChild(cell);
    shown++;
  }
  out.textContent = 'Characters: ' + shown + ' with records. Tap one to see everything about them.';
}

// Open the character's zone, centre the view on them and flag them so the
// map layer can highlight who you came from.
function showCharacterOnMap(i) {
  const c = loadCharacterTable()[i];
  if (!c || !c.zone) return;
  const resid = 0x8000 | c.zone;
  document.getElementById('categorySelect').value = '127';
  onCategoryChange();
  setMode('single');
  const sel = document.getElementById('residSelect');
  for (let k = 0; k < sel.options.length; k++) {
    if (parseInt(sel.options[k].textContent.slice(2, 6), 16) === resid) { sel.selectedIndex = k; break; }
  }
  window.FOCUS_CHARACTER = i;
  window.MAP_SETTLED = null;
  renderImage();
  whenMapSettled(resid, (cm, vp) => {
    const who = charactersOnLevel(cm.level, window.MAP_HOUR).find(p => p.index === i);
    const tx = who ? who.x : c.x, ty = who ? who.y : c.y;
    mapView.x = vp.clientWidth / 2 - tx * cm.TS * mapView.scale;
    mapView.y = vp.clientHeight / 2 - ty * cm.TS * mapView.scale;
    clampMapPan(); applyMapTransform(); drawCharacterLayer();
    // Ring the square as well as centring on it: on a busy map the centre
    // of the viewport is not a mark anyone can see.
    setMapSelection(tx, ty);
  });
}

// Join only the fields that carry a value, and emit nothing at all if none of
// them do, so an empty row never appears.
// A third element is where the figure was read from, and the figure opens
// it (srcNum). A pair with none prints plain, as it did.
function statLine(pairs) {
  const parts = pairs.filter(p => p[1] !== 0 && p[1] !== undefined && p[1] !== null && p[1] !== '')
                     .map(p => '<b>' + p[0] + '</b> ' + (p[2] ? srcNum(p[2], String(p[1])) : p[1]));
  return parts.length ? parts.join(' &nbsp; ') + '<br>' : '';
}

function showCharacterDetail(i) {
  stopSpriteAnimations();
  markDetailView('char', i);
  // A single wide panel dropped into the gallery's multi-column grid was
  // being squeezed into one ~100px track, which wrapped every button's label
  // onto its own line and made the whole panel look squashed to the left.
  document.getElementById('sheetGrid').style.display = 'block';
  const d = characterDossier(i);
  // A link can name a character this archive does not have -- a saved game
  // holds only what play changed, and a shared link outlives the file it was
  // made from. Say so rather than throwing on the way to the first field.
  if (!d) {
    const g = document.getElementById('sheetGrid');
    g.innerHTML = '';
    const back = document.createElement('button');
    back.className = 'secondary';
    back.textContent = 'All characters';
    back.onclick = renderCharacterSheet;
    g.appendChild(back);
    const note = document.createElement('div');
    note.className = 'sv-warn';
    note.textContent = 'This file has no character ' + i + '. A saved game contains only what play has changed, and a link can outlast the file it came from.';
    g.appendChild(note);
    document.getElementById('output').textContent = 'No character ' + i + ' in this file.';
    return;
  }
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All characters';
  back.onclick = renderCharacterSheet;
  grid.appendChild(back);

  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:560px;margin:12px auto;text-align:left';
  const art = document.createElement('div');
  // Wraps on a phone: the portrait and the 4x4 sheet side by side are 310px,
  // which is wider than the sheet inside its three folders on a 390px screen.
  art.style.cssText = 'display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin-bottom:12px';
  const pc = document.createElement('canvas');
  try {
    const praw = getResourceBytes(ARCHIVE, 0x8800 + (i - 1));
    const dec = decodeResource(ARCHIVE, praw, 135);
    drawToCanvas(pc, dec.W, dec.H, dec.image, 0);
    pc.style.cssText = 'width:128px;height:128px;image-rendering:pixelated';
    imageOpens(pc, 0x8800 + (i - 1), 'portrait');
  } catch (e) { quiet(e); }
  // Every frame of the sheet, laid out 4 facings x 4 poses.
  const sprInfo = spriteFrameInfo(d.tile, d.rec.proptype);
  const sheet = document.createElement('div');
  sheet.style.cssText = 'display:grid;grid-template-columns:repeat(4,40px);gap:2px';
  for (let f = 0; f < Math.max(sprInfo.count ? sprInfo.slots : 1, 1); f++) {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'width:40px;height:40px;image-rendering:pixelated;background:#1c1913;border:1px solid #33302a';
    if (sprInfo.present.indexOf(f) >= 0) { try { drawTileToCanvas(cv, sprInfo.base + f, 32); } catch (e) { quiet(e); } }
    else cv.style.opacity = '0.25';
    cv.title = 'frame ' + f + (sprInfo.present.indexOf(f) >= 0 ? '' : ' (empty)');
    if (sprInfo.present.indexOf(f) >= 0) imageOpens(cv, sheetOfTile(sprInfo.base + f), cv.title + ', sheet');
    sheet.appendChild(cv);
  }
  art.append(pc, sheet);
  // The walk-as-a-GIF button that stood here left on 10 September 2026 at
  // the maintainer's word; the single view's GIF export remains.
  panel.appendChild(art);
  if (i === 1) panel.appendChild(heroPortraitCard());

  const r = d.rec;
  // Every figure below opens the byte of 0xF009 it was read from. The
  // record is 32 bytes and the index is the character's own.
  const cSrc = (off, what) => ({ resid: 0xF009, byte: r.index * 32 + off, stride: 32, what });
  const info = document.createElement('div');
  info.style.cssText = 'font-size:0.875rem;line-height:1.7';
  info.innerHTML =
    '<div style="font-size:1.1875rem;color:#fff;margin-bottom:6px">' + d.name +
      ' <span style="font-size:0.75rem;color:#b5b2a8">character ' +
      srcNum(cSrc(0, 'the whole record'), String(i)) + '</span></div>' +
    // A zero in this table nearly always means "no value recorded", not
    // "zero of it" -- printing "XP 0 Training 0 Magic 0/0" for a farmhand
    // invented three facts about them. Absent fields are simply left out, and
    // a character with no placement gets no location line at all.
    statLine([['Level', r.level, cSrc(19, 'level')], ['XP', r.xp, cSrc(12, 'experience, two bytes')],
              ['Training', r.training, cSrc(28, 'training points')]]) +
    statLine([['Body', r.body, cSrc(9, 'body')], ['Reflex', r.reflex, cSrc(10, 'reflex')],
              ['Mind', r.mind, cSrc(11, 'mind')]]) +
    statLine([['Health', r.healthMax ? srcNum(cSrc(14, 'health'), String(r.health)) + '/' + srcNum(cSrc(15, 'health at full'), String(r.healthMax)) : 0],
              ['Magic', r.magicMax ? srcNum(cSrc(16, 'magic'), String(r.magic)) + '/' + srcNum(cSrc(17, 'magic at full'), String(r.magicMax)) : 0]]) +
    // Byte 25, the alignment, named by the combat AI's own groups
    // (exeAlignmentNames). Zero is a value here, neutral, so it is shown.
    (r.proptype ? '<b>Alignment</b> ' + alignmentHTML(r.raw[25], cSrc(25, 'the alignment')) + '<br>' : '') +
    (r.zone ? '<b>Home</b> ' + d.homeZone + ' at (' +
      srcNum(cSrc(1, 'the packed level, x and y'), String(r.x)) + ', ' +
      srcNum(cSrc(1, 'the packed level, x and y'), String(r.y)) + ')<br>' : '') +
    '<b>Sprite</b> ' + (sprInfo.none ? '<span style="color:#e07a5f">none</span>'
      : (sprInfo.staticKind ? sprInfo.staticKind + ', ' : '') +
        sprInfo.count + ' frame' + (sprInfo.count === 1 ? '' : 's') +
        (sprInfo.rows > 1 ? ' (' + sprInfo.rows + ' facings)' : '')) +
      ' \u00b7 base tile ' + srcNum(propTileSrc(r.proptype), '0x' + sprInfo.base.toString(16).toUpperCase()) +
      ' \u00b7 proptype ' + srcNum(cSrc(4, 'the aspect and prop type, two bytes'), '0x' + r.proptype.toString(16).toUpperCase()) +
      (r.aspect ? ' \u00b7 aspect ' + srcNum(cSrc(4, 'the aspect and prop type, two bytes'), String(r.aspect)) : '');
  panel.appendChild(info);
  // What this person is assembled from, each chip a jump to the component
  // under Components. The dossier used to draw the portrait and the sprite
  // sheet without ever saying which resources they were.
  const parts = document.createElement('div');
  parts.innerHTML = linksFold(partsStrip('Made of', characterParts(i, d)) + characterSays(i));
  panel.appendChild(parts);
  // What they carry, in the open: it is the character, not a link to
  // something else, so it is not folded with the parts.
  {
    const held = carriedByCharacter(i);
    if (held.length) {
      const c = document.createElement('div');
      const chips = [];
      for (const it of held) {
        chips.push(carriedChip(it));
        for (const o of it.inside) chips.push(carriedChip(Object.assign({ equipped: false }, o)).replace('class="relChip"', 'class="relChip carriedInside"'));
      }
      c.innerHTML = partsStrip('Carries', chips);
      panel.appendChild(c);
    }
  }

  const sh = document.createElement('div');
  sh.style.cssText = 'margin-top:14px';
  if (d.schedule.length) {
    sh.innerHTML = '<div style="color:#fff;margin-bottom:4px">Daily schedule</div>' +
      d.schedule.map(e => {
        const h = e.hour, ampm = h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
        // A schedule entry is eight bytes of 0xF00B, and `at` is where this
        // one sits, so each figure opens the bytes it was read from.
        const sSrc = (off, what) => e.at === undefined ? null : { resid: 0xF00B, byte: e.at + off, stride: 8, what };
        return '<div style="font-size:0.8125rem">' + srcNum(sSrc(0, 'the hour'), ampm.padStart(5)) + ', ' + e.where +
               ' (' + srcNum(sSrc(5, 'the packed level, x and y'), String(e.x)) + ', ' +
               srcNum(sSrc(5, 'the packed level, x and y'), String(e.y)) + ')' +
               ' <span style="color:#8c8980">behavior ' + srcNum(sSrc(1, 'the mode'), String(e.mode)) +
               (behaviourWordHTML(e.mode) ? ', ' + behaviourWordHTML(e.mode) : '') + '</span></div>';
      }).join('');
  } else {
    sh.innerHTML = '<div style="color:#8c8980;font-size:0.8125rem">No schedule entries: this character stands in a map\u2019s prop list rather than moving by the clock.</div>';
  }
  // Jump to where this character currently stands.
  if (r.zone) {
    const go = document.createElement('button');
    go.className = 'secondary actionRow';
    go.style.marginTop = '14px';
    go.textContent = 'Show on map: ' + d.homeZone;
    go.onclick = () => showCharacterOnMap(i);
    panel.appendChild(go);
  }
  grid.appendChild(panel);
  out.textContent = d.name + ', character ' + i;
}

/* The hero's portrait: where the one in play comes from. exePortraitChoice
   in js/page-rules.js reads the slot arithmetic and the two ids out of the
   program, so with no application open the card says where the figures
   come from and shows none. What the file holds at those ids is the file's
   own evidence: twelve in the shipped scenario. How many the dialog offers
   is the picker list's rows times its columns, and which it draws is its
   LDEFDraw's stride (exePortraitsOffered); the rest of the run, six copies
   of one blank face, are counted off the file as never displayed, and
   drawn dimmed. A saved game holds the chosen one as its 0x8800 and none
   of the twelve. */
function heroPortraitCard() {
  const card = document.createElement('div');
  card.style.cssText = 'font-size:0.8125rem;line-height:1.7;margin:0 0 12px';
  const isSave = (window.ARCHIVE_FINDER || {}).type === 'DelP';
  const pc = (typeof exePortraitChoice === 'function') ? exePortraitChoice() : null;
  const head = '<b style="color:#b5b2a8">Portrait</b> ';
  if (!pc) {
    card.innerHTML = head + (isSave
      ? 'The portrait above is this file\u2019s 0x8800, chosen when you made the character. '
      : 'The portrait above is the scenario\u2019s 0x8800 and is never shown in play. ') +
      'The program says which portraits the game offers when you make a character, and where it writes the chosen one, and the program is not open.';
    return card;
  }
  const hex = v => '0x' + v.toString(16).toUpperCase();
  const first = pc.base.v + pc.first.v;
  const slots = [];
  for (let r = first; r < first + 64 && getResourceBytes(ARCHIVE, r); r++) slots.push(r);
  let text = head + (isSave
    ? 'The portrait above is the one chosen when you made this character, ' + srcNum(pc.writes, 'saved') + ' in this file. '
    : 'The portrait above is never shown in play; the game uses the one you choose when you make the character, which is ' + srcNum(pc.writes, 'saved') + ' in the saved game file. ');
  const choices = 'The ' + srcNum(pc.first, 'choices') + ' at character creation';
  if (!slots.length) { card.innerHTML = text + choices + ' are not in this file.'; return card; }
  // Which of the run the list draws: column c, row r is the first plus the
  // stride times c plus r.
  const off = pc.offered, shown = new Set();
  if (off) for (let c = 0; c < off.cols; c++) for (let r = 0; r < off.rows; r++) shown.add(first + off.stride.v * c + r);
  const faces = new Map();
  const strip = document.createElement('div');
  strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-top:6px';
  // Only the ones the dialog offers. The rest of the run is copies of one
  // blank face that nothing draws, and nothing found suggests they were
  // meant for anything, so they are left out (the maintainer, 2 October
  // 2026: omit the extras unless they are slots meant for custom portraits).
  for (const r of slots) {
    if (off && !shown.has(r)) continue;
    const c = document.createElement('canvas');
    try {
      const dec = decodeResource(ARCHIVE, getResourceBytes(ARCHIVE, r), 135, r);
      drawToCanvas(c, dec.W, dec.H, dec.image, 0);
      const k = hashIndices(dec.image);
      faces.set(k, (faces.get(k) || 0) + 1);
    } catch (e) { quiet(e); }
    c.style.cssText = 'width:48px;height:48px;image-rendering:pixelated;background:#1c1913;border:1px solid #33302a';
    imageOpens(c, r, 'portrait');
    strip.appendChild(c);
  }
  if (off && slots.filter(r => shown.has(r)).length === off.count.v)
    text += 'There are ' + srcNum(off.count, String(off.count.v)) + ' choices at character creation.';
  else {
    const repeated = [...faces.values()].filter(n => n > 1).reduce((a, b) => a + b, 0);
    text += choices + ': ' + slots.length + ' here, ' + hex(slots[0]) + ' to ' + hex(slots[slots.length - 1]) +
      (repeated ? ', ' + repeated + ' of them one face' : '') + '.';
  }
  card.innerHTML = text;
  card.appendChild(strip);
  return card;
}

function renderCompositeSheet() {
  document.getElementById('sheetGrid').style.display = '';
  const out = document.getElementById('output');
  const grid = document.getElementById('sheetGrid');
  grid.innerHTML = '';
  const entries = loadCompositionTable();
  if (!entries.length) { out.textContent = "No composition table (resource 0xF013) found in this file."; return; }
  let okCount = 0;
  entries.forEach((entry, idx) => {
    const tileId = 0x1000 + idx;
    const cell = document.createElement('div');
    cell.className = 'cell';
    const imgwrap = document.createElement('div');
    imgwrap.className = 'cellimgwrap';
    const canvas = document.createElement('canvas');
    imgwrap.appendChild(canvas);
    cell.appendChild(imgwrap);
    const residDiv = document.createElement('div');
    residDiv.className = 'resid'; residDiv.textContent = 'Tile 0x' + tileId.toString(16).toUpperCase();
    cell.appendChild(residDiv);
    const lblDiv = document.createElement('div');
    lblDiv.className = 'lbl';
    // "16 stitched fragments" was identical on every tile and said nothing.
    // Name the tile from the terrain table (0xF004) where we can.
    const tname = compositeTileName(tileId);
    lblDiv.textContent = tname || 'unnamed';
    if (!tname) lblDiv.classList.add('placeholder');
    cell.appendChild(lblDiv);
    try {
      const {W,H,image,missing} = buildCompositeTile(entry);
      if (isCompletelyWhite(image)) return;
      if (missing >= 12) return;
      drawToCanvas(canvas, W, H, image);
      const scale = Math.min(84/W, 110/H, 8);
      canvas.style.width = (W*scale)+'px'; canvas.style.height = (H*scale)+'px';
      if (missing > 0) lblDiv.textContent = missing + '/16 fragments missing';
      okCount++;
    } catch(err) { return; }
    cell.title = "Click to see its tiles; Shift-click to save a PNG";
    cell.onclick = (ev) => {
      if (ev.shiftKey) { downloadCanvasAsPNG(canvas, tileId); return; }
      showCompositeDetail(tileId, entry, canvas);
    };
    grid.appendChild(cell);
  });
  out.textContent = "Composite tiles: " + okCount + "/" + entries.length + " drawn (hiding entries whose source sheets are mostly missing). Shift-click to save a PNG.";
}

// setMode and onCategoryChange are the two funnels every view change passes
// through, and both have several early returns, so the URL is kept in step by
// wrapping them rather than by sprinkling syncDeepLink() through the branches.
function setMode(m) { setModeImpl(m); syncDeepLink(); updateGalleryTools(); }
function onCategoryChange() { clearPropFilter(); onCategoryChangeImpl(); syncDeepLink(); updateGalleryTools(); }

// Leaving a view has to stop what that view started. Sprite animation was
// only ever stopped by the three sheets that start it, so walking from the
// character gallery to any other category left up to a few dozen intervals
// redrawing canvases that are no longer in the document -- for the life of the
// page. The map cycle and the audio element had the same problem: sound went
// on playing from a panel that was no longer on screen.
function stopAllViewActivity() {
  try { document.body.classList.remove('worldTab'); } catch (e) { quiet(e); }
  stopLazyTiles();
  stopSpriteAnimations();
  stopMapAnimation();
  stopPaletteAnimation();
  if (typeof hideDetailLens === 'function') hideDetailLens(true);
  if (typeof hideMapHover === 'function') hideMapHover();
  if (typeof stopAtlasAnimation === 'function') stopAtlasAnimation();
  const audio = document.getElementById('audioPlayer');
  if (audio && !audio.paused) audio.pause();
}

/* The sheet comes back and the atlas panel goes. Called from setModeImpl and,
   since a numbered gallery never passes through setMode (onCategoryChangeImpl
   draws its contact sheet directly), from the category change as well: with
   only the first, going from the World to any gallery of the archive --
   Functions, Portraits, Music -- lit the new tab and left the world on
   screen, with the gallery drawn out of sight under it (22 September 2026). */
function leaveAtlas() {
  const sheet = document.getElementById('tabSheet');
  if (sheet) sheet.style.display = '';
  const ap = document.getElementById('atlasPanel');
  if (ap) ap.style.display = 'none';
}

function setModeImpl(m) {
  stopAllViewActivity();
  /* Give the panel back before anything decides what to put in it.

     The atlas borrows this panel and hides the furniture it does not use; the
     restore has to happen here rather than inside renderMapResource, because
     by then the caller has already set its own display values and putting the
     saved ones back overwrites them -- which showed up as the resource nav
     vanishing from Entities > Regions after a visit to the World tab. First,
     then whatever this view wants. */
  // Coming back from the atlas: the sheet returns and the atlas panel goes.
  if (window.CUR_SUBN !== 'WORLD') leaveAtlas();
  window.DETAIL_VIEW = null;   // a detail view is what we are leaving
  if (currentMode === 'sheet' && m === 'single') lastSheetScrollY = window.scrollY;
  // A detail view opens at the top of the page, whichever way it was
  // reached (a click, a link, the browser's back), and the gallery comes
  // back to where it was left.
  const wasSingle = currentMode === 'single';
  currentMode = m;
  const go = y => { try { if (typeof window.scrollTo === 'function') window.scrollTo(0, y); } catch (e) { quiet(e); } };
  if (m === 'single') setTimeout(() => go(0), 0);
  else if (wasSingle && m === 'sheet') setTimeout(() => go(lastSheetScrollY || 0), 0);
  // Before the early returns below, so a view without a bar (Tools, the
  // Changes tab, a dossier) does not inherit the last gallery's.
  updateUnditherBar();
  // The dedicated mode buttons are gone: gallery is the only entry point,
  // clicking a tile is what means "single", and #sheetGrid is reset to grid
  // layout by default (detail views that need a single wide column switch it
  // to block and must switch it back -- see returnToSheet()).
  clearSheetGridLayout();
  if (window.CUR_SUBN === 'CHARACTERS') { renderCharacterSheet(); return; }
  if (window.CUR_SUBN === 'PROPS' || window.CUR_SUBN === 'SCENERY') { renderPropTypeSheet(); return; }
  if (window.CUR_SUBN === 'ITEMS') { renderItemSheet(); return; }
  if (window.CUR_SUBN === 'RSRC') {
    renderRsrcSheet();
    return;
  }
  if (window.CUR_SUBN === 'MACRSRC' || FORK_VIEWS[window.CUR_SUBN]) { renderMacRsrcSheet(); return; }
  if (window.CUR_SUBN === 'MONSTERS') { renderMonsterSheet(); return; }
  if (window.CUR_SUBN === 'RECORDS') { renderRecordsSheet(); return; }
  if (window.CUR_SUBN === 'SAVEGAME') { renderSaveSheet(); return; }
  if (window.CUR_SUBN === 'PREFS') { renderPrefsSheet(); return; }
  if (window.CUR_SUBN === 'PATCHES') { renderPatchesSheet(); return; }
  if (window.CUR_SUBN === 'CHEATS') { renderCheatsSheet(); return; }
  if (window.CUR_SUBN === 'DATAFORK') { renderDataForkSheet(); return; }
  if (window.CUR_SUBN === 'CHANGES') { renderChangesSheet(); return; }
  if (window.CUR_SUBN === 'TOOLS') { renderToolsSheet(); return; }
  // One tab per group of the rules sheet, and Hackery, all one renderer.
  if (MECH_GROUP_BY_VALUE[window.CUR_SUBN]) { renderMechanicsSheet(window.CUR_SUBN); return; }
  if (window.CUR_SUBN === 'MECHANICS') { renderMechanicsSheet(); return; }
  if (window.CUR_SUBN === 'SKILLS') { renderSkillsSheet(); return; }
  if (window.CUR_SUBN === 'SCHEDULES') { renderSchedulesSheet(); return; }
  if (window.CUR_SUBN === 'SPELLS') { renderSpellsSheet(); return; }
  if (window.CUR_SUBN === 'BARKS') { renderBarksSheet(); return; }
  if (window.CUR_SUBN === 'WORLD') { renderAtlasView(); return; }
  if (window.CUR_SUBN === 'INSTALLER') { renderInstallerSheet(); return; }
  if ((window.CUR_SUBN === 'AISCRIPTS' && window.INSTALLER) ||
      (window.CUR_SUBN === 'AIRULES' && (window.INSTALLER || window.APP_RSRC))) { renderCombatAISheet(window.CUR_SUBN); return; }
  if (window.CUR_SUBN === 'APPPEF' && window.APP_DATA) { renderAppPefSheet(); return; }
  if (PLACEHOLDER_TABS[window.CUR_SUBN]) { renderPlaceholderSheet(PLACEHOLDER_TABS[window.CUR_SUBN] + NO_INSTALLER_HINT); return; }
  const isComposite = window.CUR_SUBN === 'COMPOSITE';
  // The resource dropdown stays visible in both gallery and detail view now
  // that there's no separate mode toggle -- it's a second way to jump
  // straight to a resource without scrolling the gallery.
  document.getElementById('singleControls').style.display = isComposite ? 'none' : 'block';
  document.getElementById('singlePreview').style.display = 'none';
  document.getElementById('zoomControls').style.display = 'none';
  document.getElementById('resourceNav').style.display = 'none';
  document.getElementById('soundPreview').style.display = 'none';
  document.getElementById('textPreview').style.display = 'none';
  document.getElementById('mapPreview').style.display = 'none';
  document.getElementById('artUsage').style.display = 'none';
  document.getElementById('sheetGrid').innerHTML = '';
  cancelUndither();      // whatever was queued belongs to the view we just left
  updateUnditherBar();
  if (isComposite) { renderCompositeSheet(); return; }
  if (m === 'sheet') { renderContactSheet(); return; }
  if (m === 'single' && window.CUR_RESIDS && window.CUR_RESIDS.length) renderImage();
}
