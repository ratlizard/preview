/* The map renderer: terrain, faux props, roofs, lighting, exits, sitting, the square you clicked.

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
   last of these. File 5 of 14. */

// --- Full Map + Prop visual renderer ---------------------------------
// Renders an actual top-down picture of a Map resource (0x80xx), with
// props drawn on top using the same tile-sheet decoding this viewer
// already uses for Tile Sheets / Composite Tiles. Ported logic sources:
// delv/library.py (load_tiles/load_props tile-id math), delv/tile.py
// (Tile/CompoundTile), delv/prop.py (Prop.get_tile/get_offset).

function extractFullTile(sheetImg, tileInSheet) {
  const {W,H,image} = sheetImg;
  const out = new Uint8Array(32*32);
  const sy = tileInSheet * 32;
  for (let y=0;y<32;y++) for (let x=0;x<32;x++) {
    const gy = sy+y, gx = x;
    out[y*32+x] = (gx<W && gy<H) ? (image[gy*W+gx]||0) : 0;
  }
  return out;
}

let _propTileListCache = null, _propOffXCache = null, _propOffYCache = null, _compTableCache = null;
function getPropTileList() {
  if (_propTileListCache) return _propTileListCache;
  const data = getResourceBytes(ARCHIVE, 0xF000);
  if (!data) { _propTileListCache = []; return _propTileListCache; }
  const arr = [];
  for (let i=0;i+1<data.length;i+=2) arr.push(u16be(data, i));
  _propTileListCache = arr;
  return arr;
}
/* Where a prop type's base tile was read from: 0xF000 is one halfword a
   prop type, so the figure opens its own two bytes. Every page that prints
   a base tile uses this. */
function propTileSrc(pt) { return { resid: 0xF000, byte: pt * 2, stride: 2, what: 'the base tile of prop type ' + pt }; }
function getPropOffsets() {
  if (_propOffXCache && _propOffYCache) return [_propOffXCache, _propOffYCache];
  _propOffXCache = getResourceBytes(ARCHIVE, 0xF011) || new Uint8Array(0);
  _propOffYCache = getResourceBytes(ARCHIVE, 0xF012) || new Uint8Array(0);
  return [_propOffXCache, _propOffYCache];
}
// A prop's draw offset, in source pixels, ready to be SUBTRACTED from the
// square's top-left corner -- which is what delvmod's draw_tile() does
// (`x*32-xo, y*32-yo`). This viewer used to add it, so the eight offset
// statues, the candlestands and Land King Hall's rope all sat 8-13px down and
// right of where the game puts them. When the record's rotate bit is set the
// pair is transposed with the image (delvmod: `offset[::-1] if rotated`).
//
// The bytes are read UNSIGNED, as delvmod's store.ByteList does. Exactly one
// of the 32768 entries exceeds 127 -- prop type 381 ("cavern") aspect 13, at
// 232 -- and it is reachable by nothing: no prop record, no faux prop on any
// map's terrain and no character record uses that type-and-aspect pair. So
// whether it means 232 or -24 is unobservable in this archive, and matching
// the reference implementation beats guessing.
function propOffsetFor(proptype, aspect, rotated) {
  const [offX, offY] = getPropOffsets();
  const oi = ((proptype & 0x3FF) << 5) + (aspect & 0x1F);
  let ox = offX[oi] || 0, oy = offY[oi] || 0;
  if (rotated) { const t = ox; ox = oy; oy = t; }
  return [ox, oy];
}

// --- Faux props ------------------------------------------------------------
// 0xF010 gives every TILE an optional prop to draw on top of it: one uint16
// per tile holding proptype (0x3FF), aspect (bits 10-14) and a rotate bit.
// delvmod's draw_tile() draws it straight after the tile itself, so it sits
// under anything the prop list places on the same square. 114 tiles carry one.
// This is not decoration that could be left out: Land King Hall's cave mouths
// are terrain tiles whose faux prop is the "cavern" sprite, so without this
// the caves had no walls at all, and the world map's trees, shrubs, mountains
// and snowcaps are all faux props too.
let _fauxPropCache = null;
/* THE ENGINE'S DRAW ORDER, off TViewer::Render (22 September 2026).
   Render draws the whole view in six passes, and in each draws the props
   whose record flags and tile attributes match that pass's masks, read from
   four halfword and two word tables beside the TOC:

     pass  flags & mask == value   attributes & mask == value
      0    & 0x9E == 0             & 0x100000 == 0x100000   flat: floors, rugs, blood, runes, mountains
      1    & 0x9E == 0             & 0x100210 == 0x200
      2    the living, from their own list
      3    & 0x9E == 0             & 0x100210 == 0
      4    & 0x44 == 4             anything                 records flagged 4 or 0x24
      5    & 0x9E == 0             & 0x10 == 0x10           arches, walls, the tall

   so a pass is a layer over the whole map. The attributes are tested a
   square at a time, against each square's own tile, so a prop of several
   squares can be in two passes: a pillar's foot blocks and its top is tall
   (propPieceList). Within a pass Render walks its list from the end, and the
   list is the faux props then the records in the file's order, so the
   records go LAST FIRST and the faux props after them, row by row (23
   September 2026; until then the page drew each prop whole in its corner's
   pass and the records first first, which put Cademia's pool at (61,58)
   over its pillar). This page drew the records in list order
   and the terrain's own props after them all, which put a carpet over the
   arch it runs under in Land King Hall (42,18) and the world's mountains
   over the arch into it at (163,20) (the maintainer, 22 September 2026).
   A flat tile with 0x10 is drawn in pass 0 and again in 5, which comes to
   the same pixels as drawing it once in 5. Pass 2's flag is set by a loop
   this reading did not follow; the living are put there because nothing
   else in the passes takes them; Render's own test for pass 2 can never
   match a prop on its list. TViewer::SetStage also gives every prop a
   layer from the class's flags (the table FillIntfCache builds), and that
   is not a draw order: it picks the one prop a square answers with to a
   look, a search, a use or a click (GetBestProp, GetBestTile), and Render
   never reads it. */
function enginePass(tileId, flags, living) {
  if ((flags & 0x44) === 4) return 4;
  if (living) return 2;
  const a = getTileAttributes(ARCHIVE)[tileId] || 0;
  if (a & 0x10) return 5;
  if (a & 0x100000) return 0;
  if (a & 0x200) return 1;
  return 3;
}
function getFauxProps() {
  if (_fauxPropCache) return _fauxPropCache;
  const out = new Map();
  try {
    const b = getResourceBytes(ARCHIVE, 0xF010);
    if (b) for (let i = 0; i + 1 < b.length; i += 2) {
      const w = u16be(b, i);
      const pt = w & 0x3FF;
      if (pt) out.set(i >> 1, { proptype: pt, aspect: (w >> 10) & 0x1F, rotated: w >> 15 });
    }
  } catch (e) { quiet(e); }
  return (_fauxPropCache = out);
}

// Draw one prop sprite -- its own tile plus whatever extra squares the tile
// attributes say it spans -- at a map square. Returns the squares it covered.
function drawPropAt(ctx, TS, gx, gy, tileId, rotated, ox, oy, mw, mh, frame) {
  const scale = TS / 32;
  const dx = -ox * scale, dy = -oy * scale;
  const cells = [[gx, gy]];
  const extra = multiTilePieces(tileId, rotated);
  if (extra) {
    for (const p of extra) {
      const ex = gx + p.dx, ey = gy + p.dy;
      if (ex < 0 || ey < 0 || ex >= mw || ey >= mh) continue;
      drawTileAt(ctx, p.tile, ex*TS + dx, ey*TS + dy, true, TS, frame || 0, rotated);
      cells.push([ex, ey]);
    }
  }
  drawTileAt(ctx, tileId, gx*TS + dx, gy*TS + dy, true, TS, frame || 0, rotated);
  return cells;
}

function getCompositionTableCached() {
  if (_compTableCache) return _compTableCache;
  _compTableCache = loadCompositionTable();
  return _compTableCache;
}

// Resolve any tile ID (base terrain tile or composite tile >= 0x1000)
// to a decoded 32x32 indexed-color image, or null if unresolvable.
const _tileImageCache = {};
function resolveTileImage(tileId) {
  if (_tileImageCache[tileId] !== undefined) return _tileImageCache[tileId];
  let result = null;
  try {
    if (tileId >= 0x1000) {
      const comp = getCompositionTableCached();
      const entry = comp[tileId - 0x1000];
      if (entry) {
        const {image} = buildCompositeTile(entry);
        result = image;
      }
    } else {
      const sheetResid = 0x8E00 + ((tileId >> 4) & 0xFF);
      const tileInSheet = tileId & 0x0F;
      const sheetImg = getTileSheetImage(sheetResid);
      if (sheetImg) result = extractFullTile(sheetImg, tileInSheet);
    }
  } catch(e) { result = null; }
  _tileImageCache[tileId] = result;
  return result;
}

// Cache of per-tile offscreen canvases. Using drawImage (rather than
// putImageData) matters for two reasons: putImageData ignores any scaling,
// and it *overwrites* the destination pixels including their alpha, so a
// prop's transparent pixels used to erase the terrain tile underneath
// instead of letting it show through.
const tileCanvasCache = derivedMap('tileCanvasCache');
// Which tiles contain palette-animated indices (0xE0-0xFB). Cached per tile.
const tileAnimCache = derivedMap('tileAnimCache');
function tileIsAnimated(tileId) {
  if (tileAnimCache.has(tileId)) return tileAnimCache.get(tileId);
  const img = resolveTileImage(tileId);
  let anim = tileAnimTable().has(tileId);
  if (img) for (let i = 0; i < img.length; i++) {
    if (img[i] >= 0xE0 && img[i] <= 0xFB) { anim = true; break; }
  }
  tileAnimCache.set(tileId, anim);
  return anim;
}

/* The game's own tile animation, 0xF001 (23 September 2026). LoadGlobals
   builds eight tables of tile pictures, one for each phase of the clock
   that also cycles the palette (the viewer's byte 0xBA, which
   TMapWindow::AnimThread steps modulo 8), and points every tile at its own
   picture in all eight; then it reads 0xF001, eight bytes an entry until a
   tile of 0 -- the tile, its first frame, how many frames, and how many
   phases each frame lasts -- and points the tile at frame
   first + (phase / divisor) mod count in phase `phase`. MaskAnyTile draws
   every tile through the table of the current phase. The shipped list is
   eight tiles: the fountain, four flags, the burning incense, the distiller
   and a button that blinks. No script touches it (the syscall that could,
   cbanimatetiles, is called by none), and nothing else animates a sprite:
   the units whose layout AdjustAspect maps to aspect 0 stand still. */
function tileAnimTable() {
  if (DERIVED.TILE_ANIM) return DERIVED.TILE_ANIM;
  const out = new Map();
  try {
    const b = getResourceBytes(ARCHIVE, 0xF001);
    const s16 = o => ((b[o] << 8 | b[o + 1]) << 16) >> 16;
    for (let o = 0; b && o + 8 <= b.length; o += 8) {
      const t = s16(o);
      if (!t) break;
      const count = s16(o + 4), div = s16(o + 6);
      if (count > 0 && div > 0) out.set(t, { first: s16(o + 2), count, div, at: o });
    }
  } catch (e) { quiet(e, 'the tile animation table'); }
  return (DERIVED.TILE_ANIM = out);
}
// The picture a tile shows at a phase of the clock. A draw with no phase --
// a gallery, a still render -- is the tile's own art.
function animatedTile(tileId, frame) {
  if (!frame) return tileId;
  const a = tileAnimTable().get(tileId);
  return a ? a.first + (Math.floor((frame % 8) / a.div) % a.count) : tileId;
}

// delvmod's Tile.rotate(): row y of the result is column y of the source, a
// transpose across the main diagonal. The prop record's 0x20 bit selects it,
// and the viewer used to ignore the bit entirely -- which is why Land King
// Hall's rope barricade lay across the corridor instead of running down it,
// and why several fences, wall runs and one corpse were drawn on the wrong
// axis. The offset pair is transposed with the image (delvmod: `offset[::-1]
// if rotated`), so the two have to travel together.
function rotateTileImage(img) {
  const out = new Uint8Array(32*32);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 32; x++) out[y*32 + x] = img[x*32 + y];
  return out;
}

function getTileCanvas(tileId, transparent, frame, rotated) {
  const key = tileId + ':t' + (frame ? ':' + frame : '') + (rotated ? ':r' : '');
  if (tileCanvasCache.has(key)) return tileCanvasCache.get(key);
  let img = resolveTileImage(tileId);
  if (!img) { tileCanvasCache.set(key, null); return null; }
  if (rotated) img = rotateTileImage(img);
  // `const PAL_RGB` at module scope is not a window property, so this must
  // not shadow it by name.
  const PAL = frame ? cycledPalette(frame) : PAL_RGB;
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const cx = c.getContext('2d');
  const imgData = cx.createImageData(32,32);
  for (let i=0;i<32*32;i++) {
    const col = PAL[img[i]] || [0,0,0];
    imgData.data[i*4]=col[0]; imgData.data[i*4+1]=col[1]; imgData.data[i*4+2]=col[2];
    // Palette index 0 is the engine's void marker, not a real color. Of the
    // 459 distinct tiles actually used on maps, 405 contain almost none of
    // it, while the handful that are mostly index 0 are exactly the void
    // tiles -- "Nothing" (0x0000) and the Expanse starfields (0xFC-0xFE).
    // Rendering it opaque painted those white; leaving it transparent over
    // the black map background gives the intended black space with stars.
    imgData.data[i*4+3] = (img[i]===0) ? 0 : 255;
  }
  cx.putImageData(imgData,0,0);
  tileCanvasCache.set(key, c);
  return c;
}
// Draw a single terrain tile into its own canvas (used by the composite
// drill-down to show each source fragment).
function drawTileToCanvas(canvas, tileId, size, rotated) {
  size = size || 32;
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  // No forced fill: index 0 is the engine's real transparent marker (see
  // getTileCanvas), and painting a slab behind it here is what made sprites
  // look like they had a solid black background instead of being cut out.
  // Callers that want a panel behind the sprite set that via CSS.
  drawTileAt(ctx, tileId, 0, 0, false, size, 0, rotated);
}

function drawTileAt(ctx, tileId, px, py, transparent, size, frame, rotated) {
  const TS = size || 32;
  // While renderMapVisual is drawing its faux-prop and prop passes it sets
  // this log, so the animation loop can later REPLAY exactly the blits that
  // overlap animated water -- see the animReplay comment there. Everything
  // else (galleries, sprites, the character layer) runs with the log unset.
  if (window.__MAP_BLIT_LOG) window.__MAP_BLIT_LOG.push([tileId, px, py, transparent, TS, rotated]);
  const c = getTileCanvas(animatedTile(tileId, frame), transparent, frame, rotated);
  if (!c) return;
  ctx.drawImage(c, px, py, TS, TS);
}

// Verified against delvmod's own draw_tile() (the actual game renderer, not
// a guess): a prop tile whose attribute byte3 bits 0xC0 are set is the
// bottom-right corner of a multi-square sprite. The 2x2 case (0xC0) was
// WRONG here -- the left piece and the top piece had tile-1 and tile-2
// swapped, which is exactly what produced the scrambled pillars and the
// four-separate-corners pool: each source tile is authored knowing which
// corner it occupies (border only on its outer edges), so putting the wrong
// tile in the wrong corner puts a border down the middle of what should be
// one seamless 2x2 image.
//   0x40 -> extra piece above (x,y-1)      0x80 -> extra piece to the left (x-1,y)
//   0xC0 -> three extra pieces; non-rotated: (x-1,y-1,tile-3) (x,y-1,tile-2) (x-1,y,tile-1)
//                                rotated:     (x-1,y-1,tile-3) (x-1,y,tile-2) (x,y-1,tile-1)
function multiTilePieces(tileId, rotated) {
  const attrs = getTileAttributes(ARCHIVE);
  const attr = attrs[tileId] || 0;
  const span = attr & 0xC0;
  if (!span) return null;
  if (span === 0x40) {
    return rotated ? [{dx:-1, dy:0, tile:tileId-1}] : [{dx:0, dy:-1, tile:tileId-1}];
  }
  if (span === 0x80) {
    return rotated ? [{dx:0, dy:-1, tile:tileId-1}] : [{dx:-1, dy:0, tile:tileId-1}];
  }
  // 0xC0 -- full 2x2 block
  return rotated ? [
    {dx:-1, dy:-1, tile:tileId-3},
    {dx:-1, dy:0,  tile:tileId-2},
    {dx:0,  dy:-1, tile:tileId-1}
  ] : [
    {dx:-1, dy:-1, tile:tileId-3},
    {dx:0,  dy:-1, tile:tileId-2},
    {dx:-1, dy:0,  tile:tileId-1}
  ];
}
/* A prop as the engine draws it: square by square, the corner first and
   then the pieces from the tile before it backwards (TViewer::Render). Each
   square goes in the pass of its own tile, so a pillar's foot is drawn with
   the things that block and its top with the tall, over a pool beside it
   whatever the order of the two records (the maintainer, 23 September
   2026). 107 of the 200 tiles that anchor a prop of more than one square
   have a piece in another pass than the corner. */
function propPieceList(tileId, rotated) {
  const extra = multiTilePieces(tileId, rotated) || [];
  return [{ dx: 0, dy: 0, tile: tileId }].concat(extra.slice().sort((a, b) => b.tile - a.tile));
}
function drawPropPiece(ctx, TS, x, y, tile, rotated, ox, oy, frame) {
  const s = TS / 32;
  drawTileAt(ctx, tile, x * TS - ox * s, y * TS - oy * s, true, TS, frame || 0, rotated);
}

// ===================== inhabitants =====================
// Three tables combine to say who stands where and what they look like:
//   0xF00B Schedules  - per character, a list of (hour, mode, script, level, x, y)
//   0xF009 Characters - 512 x 32-byte records; the u16 at +4 packs
//                       aspect<<10 | proptype&0x3FF (the packing delvmod
//                       documents for prop-list entries)
//   0xF000 Prop-Tile  - proptype -> base tile; tile>>4 is the sprite sheet and
//                       the low nibble picks one of its 16 frames
// Verified end to end: character 2 -> proptype 34 -> tile 0x710 -> sheet 113
// (Alaric), character 3 -> sheet 114 (Magpie). The three generic guards all
// resolve to one shared sprite, which nothing in the derivation forced.
DERIVED.SCHEDULES = null;
function loadSchedules() {
  if (DERIVED.SCHEDULES) return DERIVED.SCHEDULES;
  const raw = getResourceBytes(ARCHIVE, 0xF00B);
  if (!raw) return (DERIVED.SCHEDULES = []);
  const lengths = [];
  for (let i = 0; i < 0x100; i++) lengths.push(u16be(raw, i*2));
  let p = 512;
  const all = [];
  for (const len of lengths) {
    const entries = [];
    for (let k = 0; k < len && p + 8 <= raw.length; k++) {
      const xy = (raw[p+5] << 16) | u16be(raw, p+6);
      // `at` is where the entry sits in 0xF00B, so a figure read off it
      // can open the bytes it came from.
      // Bytes 2 and 3 are a condition and its argument (scheduleCondition);
      // `script` keeps the two as one word for what read it that way.
      entries.push({ hour: raw[p], mode: raw[p+1],
                     script: u16be(raw, p+2), cond: raw[p+2], arg: raw[p+3], level: raw[p+4],
                     x: xy >> 12, y: xy & 0xFFF, at: p });
      p += 8;
    }
    all.push(entries);
  }
  return (DERIVED.SCHEDULES = all);
}

/* A character's day as the game would walk it from the start of a new
   game (24 September 2026). A schedule is a program (scheduleCondition in
   js/page-rules.js has the format): ScheduleOne takes the segments whose
   conditions hold, in the file's order, and a stop ends the walk once one
   has been taken. So the posts drawn on the map are those, under a new
   game's state: every quest value 0 and quest flag clear, and each
   character's flags as their record in 0xF009 starts them -- the table the
   application schedules from is those records, 32 bytes each, the flags in
   byte 8 (0 to 7), the halfword at 6 (8 to 23) and byte 26 (24 to 31). A
   roll counts as holding when at least half the numbers it can come up
   pass, so the picture does not change from one drawing to the next. A
   schedule with no conditions is its posts, as before. */
/* A save's quest state, read out of its 0x0400 segment: the stream's first
   block is tagged Char, and from the tag the 32 quest values are one byte
   each at +16 and the 256 quest flags eight big-endian longs at +48
   (save-format.md, *The Char block, in full*). With it, the save's own
   character table, whose records carry the character flags a schedule may
   test and the party, alive and waiting bytes the hour tests. Null when
   the segment or the tag is not there. */
function saveQuestState(spec) {
  const seg = spec && spec.resources.find(r => r.resid === 0x0400);
  const b = seg && seg.data;
  if (!b || b.length < 80 || String.fromCharCode(b[0], b[1], b[2], b[3]) !== 'Char') return null;
  const values = Array.from(b.subarray(16, 48));
  const flags = [];
  for (let n = 0; n < 256; n++) flags.push(!!((b[48 + (n >> 5) * 4 + 3 - ((n & 31) >> 3)] >> (n & 7)) & 1));
  let chars = null;
  try { const t = spec.resources.find(r => r.resid === 0xF009); if (t) chars = parseDelverCharacterRecords(t.data); } catch (e) { quiet(e, 'the save’s character table'); chars = null; }
  return { values, flags, chars, flagsSet: flags.filter(Boolean).length, valuesSet: values.filter(v => v).length };
}
/* The state the day is judged under: the save beside the file, when the
   map's Save mark is on and the save has a Char block; otherwise a new
   game's, which is what every walker of the day drew until 25 September
   2026. Turning the mark on is what says "the save's day", so the map,
   the path and the dossier agree on whose day it is. */
function scheduleState() {
  const sb = window.SAVE_BESIDE;
  return window.MAP_MARKS && window.MAP_MARKS.save && sb && sb.quest ? sb.quest : null;
}
function scheduleHoldsAtStart(e, state) {
  const k = e.cond, a = e.arg;
  if (!k) return true;
  if (k === 1) return false;
  if (k === 2) return state ? !!state.flags[a] : false;   // a quest flag set: none is, at the start
  if (k === 3) return state ? !state.flags[a] : true;     // clear
  const cmp = (v, op) => op === 0 ? v === a : op === 1 ? v >= a : op === 2 ? v !== a : v < a;
  if (k >= 0x20 && k < 0x40) {
    const n = k & 7, top = n ? (1 << (n + 1)) - 1 : 0;
    let pass = 0;
    for (let v = 0; v <= top; v++) if (cmp(v, (k >> 3) & 3)) pass++;
    return pass * 2 >= top + 1;
  }
  if (k >= 0x40 && k < 0x80) {
    const f = k & 0x1F;
    const rec = state && state.chars && state.chars[a] ? state.chars[a].raw : null;
    const raw = rec || getResourceBytes(ARCHIVE, 0xF009), p = rec ? 0 : a * 32;
    let on = false;
    if (raw && p + 32 <= raw.length)
      on = f < 8 ? !!(raw[p + 8] & (1 << f)) : f < 24 ? !!(u16be(raw, p + 6) & (1 << (f - 8))) : !!(raw[p + 26] & (1 << (f - 24)));
    return (k & 0x60) === 0x60 ? !on : on;
  }
  if (k >= 0x80) return cmp(state ? (state.values[k & 0x1F] || 0) : 0, (k >> 5) & 3);
  return false;
}
/* A segment whose place is nothing (level, x and y all 0) is not a post
   but the head of a block, which runs to its matching stop: ScheduleOne
   (0x006B00 on) skips the whole block when the head's condition fails,
   counting a nested head up and a stop down, and walks into it when the
   condition holds. Philinus, Timon and Eudoxus open with one. */
function scheduleIsHead(e) { return e.level === 0 && e.x === 0 && e.y === 0 && e.cond !== 1; }
/* Why ScheduleTime would not schedule a character at all, from the record
   as the file has it and the tests read off the routine (exeScheduleWho):
   in the party, dead, or waiting. Null when the character is scheduled,
   and null with no application open, since the tests are the program's
   and the page states nothing of them without it. The fourth test, the
   active monster's word, is the game's runtime and has no reading here. */
function scheduleSkipReason(i) {
  const state = scheduleState();
  const c = state && state.chars && state.chars[i] ? state.chars[i] : loadCharacterTable()[i];
  const who = c && appImage() ? exeScheduleWho() : null;
  if (!who) return null;
  const raw = c.raw;
  if (raw[who.partyBit.byte.v] & who.partyBit.bit.v) return 'in the party';
  const hw = (raw[who.aliveBit.byte.v] << 8) | raw[who.aliveBit.byte.v + 1];
  if (!(hw & who.aliveBit.mask.v)) return 'dead';
  if (raw[who.waiting.byte.v] === who.waiting.value.v) return 'waiting';
  return null;
}

function scheduleDay(i) {
  const segs = loadSchedules()[i] || [];
  // A character the hour never schedules stands where the record puts
  // them all day, as one whose segments never hold does; `why` says which.
  const why = scheduleSkipReason(i);
  if (why) {
    const c = loadCharacterTable()[i];
    return c && c.zone ? [{ hour: 0, mode: 0x86, cond: 0, arg: 0, script: 0, level: c.zone, x: c.x, y: c.y, at: null, fromRecord: true, why }] : [];
  }
  if (!segs.some(e => e.cond)) return segs;
  const state = scheduleState();
  const out = [];
  for (let k = 0; k < segs.length; k++) {
    const e = segs[k];
    if (e.cond === 1) { if (out.length) break; continue; }
    const ok = scheduleHoldsAtStart(e, state);
    if (scheduleIsHead(e)) {
      if (!ok) for (let depth = 1; depth && k + 1 < segs.length; ) { k++; if (segs[k].cond === 1) depth--; else if (scheduleIsHead(segs[k])) depth++; }
      continue;
    }
    if (ok) out.push(e);
  }
  // Nothing holds: ScheduleOne moves no one, so the character stands where
  // the record puts them, which is a post of its own for all day.
  if (!out.length) {
    const c = loadCharacterTable()[i];
    if (c && c.zone) out.push({ hour: 0, mode: 0x86, cond: 0, arg: 0, script: 0, level: c.zone, x: c.x, y: c.y, at: null, fromRecord: true });
  }
  return out;
}

DERIVED.CHAR_TABLE = null;
// Proptypes that some character record uses as its sprite.
DERIVED._CHAR_PROPTYPES = null;
function characterProptypes() {
  if (DERIVED._CHAR_PROPTYPES) return DERIVED._CHAR_PROPTYPES;
  const s = new Set();
  for (const c of loadCharacterTable()) if (c && c.proptype) s.add(c.proptype);
  return (DERIVED._CHAR_PROPTYPES = s);
}

/* The field map lives in `js/delv-archive.js` now, with the writer that is
   its exact inverse -- the records are what a saved game is made of, and
   editing one needs both halves (see parseDelverCharacterRecords). This is
   the memoised read of the open archive's copy. It is deliberately NOT
   decrypted through smartDecrypt's fallback path: 0xF009 is in delvmod's
   known-clear table, so the verdict is a table lookup in both files that
   have one. */
function loadCharacterTable() {
  if (DERIVED.CHAR_TABLE) return DERIVED.CHAR_TABLE;
  const raw = getResourceBytes(ARCHIVE, 0xF009);
  if (!raw) return (DERIVED.CHAR_TABLE = []);
  return (DERIVED.CHAR_TABLE = parseDelverCharacterRecords(smartDecrypt(raw, 0xF009).data));
}

function characterName(i) {
  const t = nameTable();
  const nm = (t && t[i] ? String(t[i]).trim() : '');
  return (nm && nm !== '???' && nm !== 'x') ? nm : ('Character ' + i);
}

window.SHOW_CHARACTERS = true;
window.SHOW_CHAR_NAMES = true;
window.MAP_HOUR = 12;

// The inhabitants live on their own canvas stacked over the terrain, so moving
// the hour slider only repaints them instead of re-rendering the whole map.
function buildCharacterLayer() {
  const wrap = document.getElementById('mapCanvasWrap');
  const cm = window.CUR_MAP;
  if (!wrap || !cm) return;
  let ov = document.getElementById('charLayer');
  if (!ov) {
    ov = document.createElement('canvas');
    ov.id = 'charLayer';
    ov.style.cssText = 'position:absolute; top:0; left:0; image-rendering:pixelated; pointer-events:none; z-index:2;';
    wrap.appendChild(ov);
  } else if (ov.parentNode !== wrap) {
    wrap.appendChild(ov);
  }
  { const L = layerGeom(cm); ov.width = L.w; ov.height = L.h; }
  ov.style.width = cm.width + 'px'; ov.style.height = cm.height + 'px';
  drawCharacterLayer();
  drawLighting();
}

// Nudge characters that land on the exact same tile apart by a small,
// deterministic offset so two sprites never draw fully overlapped. This is a
// rendering fix only -- it does not change where the pathfinder is willing to
// route someone, so it doesn't fully prevent a walking route from crossing an
// occupied tile, only the visible full-overlap case.
function deconflictPositions(people) {
  const byTile = new Map();
  for (const c of people) {
    const key = c.x + ',' + c.y;
    if (!byTile.has(key)) byTile.set(key, []);
    byTile.get(key).push(c);
  }
  for (const group of byTile.values()) {
    if (group.length < 2) continue;
    const n = group.length;
    group.forEach((c, i) => {
      const ang = (i / n) * Math.PI * 2;
      c.nudgeX = Math.cos(ang) * 0.22;
      c.nudgeY = Math.sin(ang) * 0.22;
    });
  }
}

function drawCharacterLayer(lensCtx, lensTS) {
  const cm = window.CUR_MAP;
  if (!cm) return;
  let ctx, TS;
  const lbl = lensCtx ? null : document.getElementById('charCount');
  if (lensCtx) {
    if (!window.SHOW_CHARACTERS) return;
    ctx = lensCtx; TS = lensTS;
  } else {
    const ov = document.getElementById('charLayer');
    if (!ov) return;
    if (!window.SHOW_CHARACTERS) {
      ov.width = 0; ov.height = 0;          // deflate, see drawRoofLayer
      if (lbl) lbl.textContent = '';
      scheduleLensPaint();
      return;
    }
    const L0 = layerGeom(cm);
    if (ov.width !== L0.w || ov.height !== L0.h) {
      ov.width = L0.w; ov.height = L0.h;
      ov.style.width = cm.width + 'px'; ov.style.height = cm.height + 'px';
    }
    ctx = ov.getContext('2d');
    ctx.clearRect(0, 0, ov.width, ov.height);
    TS = layerGeom(cm).TS;   // the layer canvas is capped; draw at its own scale
  }
  const people = charactersOnLevel(cm.level, window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR);
  deconflictPositions(people);
  drawOpenDoors(ctx, TS, people);
  const scale = TS / 32;
  for (const c of people) {
    const [pox, poy] = propOffsetFor(c.proptype, c.aspect, 0);
    const dx = -pox * scale, dy = -poy * scale;
    // Large props span several squares, flagged by bits 0xC0 of attribute
    // byte 3. Characters do NOT: Alaric's frames 0x0710-0x071F all carry
    // byte3 = 0x00, so this call returns null for every character in the
    // game and nothing below it runs. Kept because a modded archive could
    // author a multi-square character, but it is not why characters draw
    // correctly today.
    const nx = (c.nudgeX || 0) * TS, ny = (c.nudgeY || 0) * TS;
    // Square-aligned, seated or not. A seated figure used to be pushed half
    // a tile down on the theory that the sitting pose sat in the top half of
    // its cell; it does not (Alaric's frame 0x713 inks rows 5-26 of 32), so
    // the shift put Magpie in the square BELOW her chair. The pose already
    // shows the legs folded; the game draws it on the chair's own square.
    const sy = 0;
    const extra = multiTilePieces(c.tile, 0);
    const cx = c.fx !== undefined ? c.fx : c.x, cy = c.fy !== undefined ? c.fy : c.y;
    if (extra) {
      for (const pc of extra) {
        const ex = cx + pc.dx, ey = cy + pc.dy;
        if (ex < 0 || ey < 0) continue;
        drawTileAt(ctx, pc.tile, ex*TS + dx + nx, ey*TS + dy + ny + sy, true, TS);
      }
    }
    drawTileAt(ctx, c.tile, cx*TS + dx + nx, cy*TS + dy + ny + sy, true, TS);
  }
  if (window.SHOW_CHAR_NAMES) {
    ctx.font = Math.max(10, Math.round(TS * 0.42)) + 'px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const c of people) {
      const cx = c.fx !== undefined ? c.fx : c.x, cy = c.fy !== undefined ? c.fy : c.y;
      /* Whole pixels. A name drawn at a fractional y -- and every one was,
         through the 0.18 lift and the deconfliction nudges -- is rasterised
         across two device pixels, which is the blur that reads as
         antialiasing even at full zoom (the maintainer, 13 September 2026).
         Canvas has no switch for text antialiasing; rounding the position is
         the whole of what can be done about it, and it is worth doing. */
      const px = Math.round(cx*TS + TS/2 + (c.nudgeX||0)*TS);
      const py = Math.round(cy*TS - TS*0.18 + (c.nudgeY||0)*TS);
      ctx.lineWidth = Math.max(2, TS*0.12);
      ctx.strokeStyle = 'rgba(0,0,0,.85)';
      ctx.strokeText(c.name, px, py);
      ctx.fillStyle = (window.FOCUS_CHARACTER === c.index) ? '#ff6b4a' : '#f9f86f';
      ctx.fillText(c.name, px, py);
    }
  }
  if (window.SHOW_BARKS) drawBarks(ctx, people, TS, 0, 0);
  if (lbl) {
    lbl.textContent = people.length + (people.length === 1 ? ' inhabitant' : ' inhabitants');
  }
  const back = document.getElementById('charBackLink');
  if (back) {
    if (window.FOCUS_CHARACTER != null) {
      back.style.display = '';
      back.textContent = 'Back to ' + characterName(window.FOCUS_CHARACTER) + '\u2019s dossier';
      back.onclick = () => {
        window.FOCUS_CHARACTER = null;
        document.getElementById('categorySelect').value = 'CHARACTERS';
        onCategoryChange();
        showCharacterDetail(back.dataset.idx | 0);
      };
      back.dataset.idx = window.FOCUS_CHARACTER;
    } else back.style.display = 'none';
  }
  if (!lensCtx) scheduleLensPaint();
}

let paletteTimer = null;
function stopPaletteAnimation() {
  if (paletteTimer) { clearInterval(paletteTimer); paletteTimer = null; }
  const el = document.getElementById('animNote');
  if (el) el.style.display = 'none';
}
// Palette cycling is a property of the TILE SHEETS -- the engine rotates
// indices 0xE0-0xFB to animate lava and water in the world. Portraits, skill
// icons and general graphics that happen to contain a byte in that range are
// not animated by the game, so cycling them was inventing motion that does
// not exist. Restricted to subindex 141, plus the map view which drives its
// own cycle through startMapAnimation().
const PALETTE_CYCLE_SUBN = new Set([141]);
function startPaletteAnimation(canvas, W, H, image, transparentIndex) {
  stopPaletteAnimation();
  // Cycling redraws several times a second and each redraw would queue a fresh
  // reconstruction, so the two are mutually exclusive. Undithering wins while
  // it is on; turning it off restores the cycle on the next render.
  if (unditherOn() && (window.UNDITHER_ALL || String(window.CUR_SUBN) === '135' || window.UNDITHER_PREVIEW !== null)) return;
  if (!PALETTE_CYCLE_SUBN.has(window.CUR_SUBN)) return;
  if (!window.PALETTE_ANIM || !imageUsesAnimatedColors(image)) return;
  const el = document.getElementById('animNote');
  if (el) el.style.display = '';
  let frame = 0;
  paletteTimer = setInterval(() => {
    frame = (frame + 1) % 8;
    drawToCanvas(canvas, W, H, image, transparentIndex, cycledPalette(frame));
  }, 140);
}

let mapAnimTimer = null;
window.MAP_ANIM = window.ANIM_MODE === 'all';
window.MAP_WALK = false;
window.MAP_TIME = 12;          // continuous hours, so people can be mid-stride
let mapAnimFrame = 0;

function stopMapAnimation() {
  if (mapAnimTimer) { clearInterval(mapAnimTimer); mapAnimTimer = null; }
}
/* The squares of a map that are on screen, in its own coordinates, with a
   margin so a small pan does not immediately expose an unrepainted edge.
   Null when the viewport has not been laid out, which means "all of them". */
function animWindow(cm) {
  const vp = document.getElementById('mapViewport');
  if (!vp || !cm || !cm.TS) return null;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  if (vw < 40 || vh < 40) return null;
  const spt = cm.TS * mapView.scale;
  if (!(spt > 0)) return null;
  return {
    x0: Math.max(0, Math.floor(-mapView.x / spt) - 3),
    y0: Math.max(0, Math.floor(-mapView.y / spt) - 3),
    x1: Math.min(cm.tilesW - 1, Math.ceil((vw - mapView.x) / spt) + 3),
    y1: Math.min(cm.tilesH - 1, Math.ceil((vh - mapView.y) / spt) + 3)
  };
}

function startMapAnimation() {
  stopMapAnimation();
  const cm = window.CUR_MAP;
  if (!cm || !cm.canvas) return;
  const info = document.getElementById('mapAnimNote');
  if (info) {
    const props = cm.animReplay ? cm.animReplay.filter(b => tileIsAnimated(b[0])).length : 0;
    info.textContent = (cm.animCells ? cm.animCells.length : 0) + ' animated tiles' +
      (props ? ', ' + props + ' animated props' : '');
  }
  // 35ms ticks: the palette advances every fourth tick (140ms a frame, as
  // it always was) and the walkers move every tick, which is the four
  // sub-steps a square that make them slide rather than jump.
  let subTick = 0, lastBarks = barkBucket();
  mapAnimTimer = setInterval(() => {
    let painted = false;
    // The next line of every speaker, when the last has been up its time.
    if (window.SHOW_BARKS && !window.MAP_WALK && barkBucket() !== lastBarks) { lastBarks = barkBucket(); drawCharacterLayer(); }
    subTick = (subTick + 1) & 3;
    if (subTick === 0 && window.MAP_ANIM && ((cm.animCells && cm.animCells.length) || (cm.animReplay && cm.animReplay.length))) {
      mapAnimFrame = (mapAnimFrame + 1) % 8;
      const ctx = cm.canvas.getContext('2d');
      const TS = cm.TS;
      /* Only the squares on screen.

         The world map has 41,631 animated tiles -- it is mostly sea -- and
         this loop repainted every one of them seven times a second whether or
         not it was anywhere near the viewport. At the budgeted TS=8 that is
         41,631 blits a frame for a few hundred visible ones; at the native 32
         it is 42 megapixels a frame, which is not affordable at all and is
         what stood between full resolution and being usable.

         A pan reveals squares that missed the last frame, and they are
         repainted on the next one 140ms later, which is not a thing anybody
         can see. Nothing else changes: the whole map is still animated, just
         not the parts of it nobody is looking at. */
      const win = animWindow(cm);
      const inWin = (tx, ty) => !win || (tx >= win.x0 && tx <= win.x1 && ty >= win.y0 && ty <= win.y1);
      for (const [tx, ty, t] of cm.animCells) {
        if (!inWin(tx, ty)) continue;
        drawTileAt(ctx, t, tx*TS, ty*TS, false, TS, mapAnimFrame || 8);
      }
      // The backdrop behind the void: two frames of wavy space, swapped
      // every eight palette frames, repainted only under the transparent
      // squares that show it. The props over those squares are in the
      // replay below, so they come back on top.
      if (cm.backdrop && cm.backdropCells && cm.backdropCells.length && mapAnimFrame === 0) {
        cm.backdropFrame = ((cm.backdropFrame || 0) + 1) % cm.backdrop.length;
        const pat = backdropPattern(ctx, cm.backdrop[cm.backdropFrame], TS);
        if (pat) {
          for (const [tx, ty, t] of cm.backdropCells) {
            if (!inWin(tx, ty)) continue;
            ctx.fillStyle = '#000';
            ctx.fillRect(tx*TS, ty*TS, TS, TS);   // the pattern has holes; the old frame must not show through them
            ctx.fillStyle = pat;
            ctx.fillRect(tx*TS, ty*TS, TS, TS);
            drawTileAt(ctx, t, tx*TS, ty*TS, true, TS, mapAnimFrame || 8);
          }
        }
      }
      // Put back whatever was drawn over the water (see animReplay above),
      // at the same palette frame so shore art with animated colours cycles
      // with the water instead of being erased by it.
      if (cm.animReplay)
        for (const [t, px, py, tr, sz, rot] of cm.animReplay) {
          // These carry base-canvas pixels rather than squares, so the window
          // is applied to the square they land on.
          if (!inWin(Math.floor(px / TS), Math.floor(py / TS))) continue;
          drawTileAt(ctx, t, px, py, tr, sz, mapAnimFrame || 8, rot);
        }
      // The base is what was just repainted, and whenever the detail lens is
      // showing the base is not what anyone is looking at -- so the water
      // stood still until a drag forced the lens to repaint, which is exactly
      // how it was reported. Only the animated squares are redone, so this is
      // a fraction of a settle repaint.
      repaintLensAnim(mapAnimFrame || 8);
      painted = true;
    }
    if (window.MAP_WALK) {
      advanceMapClock();
      drawCharacterLayer();
      drawLighting();
    } else if (painted) {
      // The terrain repaint sits under the character layer, so there is
      // nothing to redo for it. A flickering light is another matter: it
      // re-rolls its cone every repaint the way the engine re-rolls it every
      // redraw, and the palette frame is the cadence that gives.
      if (window.SHOW_LIGHTING && window.LIGHT_FLICKER) drawLighting();
    }
  }, 35);
}
function setMapHourLabel(t) {
  const h = Math.floor(t) % 24, mnt = Math.floor((t - Math.floor(t)) * 60);
  const ampm = h === 0 ? 12 : h > 12 ? h - 12 : h;
  for (const id of MAP_TIME_IDS.label) {
    const el = document.getElementById(id);
    if (el) el.textContent = ampm + ':' + String(mnt).padStart(2,'0') + (h < 12 ? ' am' : ' pm');
  }
}
/* The clock has two sets of controls, the Zones view's and the World tab's,
   and one clock behind them: the hour carries from one tab to the other, and
   a walk started on either is the same walk. Every change goes through the
   setters below, which write both sets, so neither can show a box unticked
   while the day is walking. */
const MAP_TIME_IDS = { walk: ['chkWalk'], speed: ['walkSpeed'],
                       slider: ['mapHourSlider', 'atlasHourSlider'], label: ['mapHourLabel', 'atlasHourLabel'] };
function syncMapTimeControls() {
  const set = (ids, f) => { for (const id of ids) { const el = document.getElementById(id); if (el) f(el); } };
  set(MAP_TIME_IDS.walk, el => { el.checked = !!window.MAP_WALK; });
  set(MAP_TIME_IDS.speed, el => { el.value = String(window.MAP_WALK_SPEED || 1); });
  const t = window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR;
  set(MAP_TIME_IDS.slider, el => { el.value = Math.floor(t); });
  setMapHourLabel(t);
}
/* One tick of a walking day, for whichever view is ticking: a quarter of a
   square's walk at 1x (MAP_TICK_HOURS), which is what lets a walker slide
   between squares rather than jump. */
function advanceMapClock() {
  window.MAP_TIME = (window.MAP_TIME + MAP_TICK_HOURS / 4 * (window.MAP_WALK_SPEED || 1)) % 24;
  syncMapTimeControls();
}
function toggleMapWalk(on) {
  window.MAP_WALK = !!on;
  // Stopping leaves the people at the hour the slider shows, rather than at
  // whatever hour was last chosen before the walk began.
  if (!on) window.MAP_HOUR = Math.floor(window.MAP_TIME);
  syncMapTimeControls();
  drawCharacterLayer();
  if (typeof atlasPaintFolk === 'function' && window.CUR_SUBN === 'WORLD') atlasPaintFolk();
}
function setMapWalkSpeed(v) { window.MAP_WALK_SPEED = +v || 1; syncMapTimeControls(); }

// Props block movement too. Terrain-only walkability is why characters walked
// through walls: in Land King Hall the interior walls are props sitting on
// passable floor tiles, so 0xF002 alone says the whole interior is open.
DERIVED.PROP_BLOCK = null;
DERIVED.LIGHT_SOURCES = null;
function buildLightSources(resid, m) {
  const key = resid + ':' + m.width;
  if (DERIVED.LIGHT_SOURCES && DERIVED.LIGHT_SOURCES.key === key) return DERIVED.LIGHT_SOURCES.list;
  const list = [];
  const attrs = getTileAttributes(ARCHIVE);
  // Terrain tiles that are themselves lit (braziers baked into the floor).
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) {
    const t = mapTileAt(m, x, y);
    /* 0x10000 is the flicker, and the archive really does carry it. The
       engine tests exactly this bit -- `rlwinm. 0,0,0,15,15`, bit 15 in the
       PowerPC's numbering -- and a light that has it goes through Random to
       choose between the two cones of its level. It varies across the lit
       tiles (0x410001 has it, 0x400001 does not), so which lights gutter and
       which burn steady is the file's, not a guess made here. */
    const a = attrs[t] || 0, lvl = a & 0x03;
    if (lvl) list.push({ x, y, lvl, flicker: !!(a & 0x10000) });
  }
  // Lit props (wall torches, lanterns, braziers).
  try {
    const praw = getResourceBytes(ARCHIVE, resid + 0x100);
    if (praw) {
      const recs = parseDelverPropList(smartDecrypt(praw, resid + 0x100).data);
      const tiles = getPropTileList();
      for (const r of recs) {
        if (r.flags === 0xFF || r.x >= m.width || r.y >= m.height) continue;
        const base = tiles[r.proptype];
        if (base === undefined) continue;
        const a = attrs[base + r.aspect] || 0, lvl = a & 0x03;
        if (lvl) list.push({ x: r.x, y: r.y, lvl, flicker: !!(a & 0x10000) });
      }
    }
  } catch (e) { quiet(e); }
  // Whether anything on this map gutters at all decides whether the animation
  // tick has to repaint the lighting layer; on a map of steady lights it
  // would be redrawing an identical picture seven times a second.
  window.LIGHT_FLICKER = list.some(s => s.flicker);
  DERIVED.LIGHT_SOURCES = { key, list };
  return list;
}

/* How dark a zone is, read off the file and then measured in the game.

   Each zone's entry script calls `sys SetAmbientLighting` once on arrival.
   That number is the base light value of EVERY square of the level -- one
   number for the whole map, memset into the light buffer -- and
   `TViewer::ApplyLight` leaves a square at 32 completely undarkened and
   paints one at 0 black, so it is a 0..32 scale of how lit the place is.

   The rule, read off the branches and then confirmed field by field in a
   running game (six saves warped to chosen squares under the fork's headless
   runner, the viewer's own fields read out of a RAM dump):

     v    = value < 0 ? -value : max(value, daylight)
     v    = max(v, sum / 3)          sum = the light sources in the 11x11 view
     base = min(32, v / 5)

   Measured: the Volcano's viewer held v = 48 and a base of 9; the Tomb 5 and
   1; Land King Hall 128 and 25 -- each the absolute value of its own script
   operand, and each base exactly min(32, v/5).

   THE OPERAND IS SIGNED, which this file had wrong until the game was asked.
   The Tomb writes `byte 0xFB`, and the interpreter sign-extends it: -5, a
   base of 1 of 32, the darkest place in the scenario. Read as 251 it came out
   over the threshold, so the Tomb, the Temple, the Cove and the Kosha Grotto
   -- four of the darkest zones in the game -- were drawn as needing no
   darkening at all. Screenshots of exactly those four, taken on a real Mac,
   are what caught it.

   Two departures, both deliberate. The page has no `GetBrightness`, so its
   own clock stands in for the daylight term, which reaches 800 at noon and 0
   at night as the routine's does. And the `sum` term is the viewer's, not the
   map's: it is computed from the eleven-by-eleven window around wherever the
   player is standing, so it has no value for a whole-map render and is left
   out of this layer. It belongs to one square at a time, and the map
   inspector reports it there. It can only make a level lighter, never darker.

   The workbench's GRIMOIRE-NOTES.md has the six measurements. */
DERIVED.ZONE_AMBIENT = null;
function zoneAmbientLevel(resid) {
  if (!DERIVED.ZONE_AMBIENT) DERIVED.ZONE_AMBIENT = {};
  if (resid in DERIVED.ZONE_AMBIENT) return DERIVED.ZONE_AMBIENT[resid];
  let out = null;
  try {
    const sid = 0x1400 + (resid - 0x8000);
    if (refExists(sid)) {
      const ops = dvmOpsOf(dvmScriptEntry(sid));
      for (let i = 0; i + 1 < ops.length; i++) {
        if (!/^sys SetAmbientLighting\b/.test(ops[i].text.trim())) continue;
        // dvmNum signs a byte and a short the way the interpreter does, so
        // the Tomb's 0xFB arrives as -5 and Land King Hall's 0xFF80 as -128.
        const v = dvmNum(ops[i + 1]);
        if (v === null) continue;
        out = v;
        // Where it was read, for the Light section's link to the line.
        DERIVED.ZONE_AMBIENT_AT = DERIVED.ZONE_AMBIENT_AT || {};
        DERIVED.ZONE_AMBIENT_AT[resid] = { v, resid: sid, at: ops[i + 1].at };
        break;
      }
    }
  } catch (e) { out = null; }
  return (DERIVED.ZONE_AMBIENT[resid] = out);
}
// `sum` is the viewer-relative term and is not passed here; see the comment
// above and lightAtSquare(), which is where it does apply.
function ambientBase(level, hour, sum) {
  const daylight = Math.round((1 - nightAlpha(hour) / 0.74) * 800);
  let v = level < 0 ? -level : Math.max(level, daylight);
  if (sum) v = Math.max(v, Math.floor(sum / 3));
  return Math.min(32, Math.floor(v / 5));
}

/* What the light sources in view are worth, for one square.

   `TViewer::CalcLighting` walks the eleven-by-eleven window around the player
   and, for each lit square in it, adds `1 << (2*level - b)` to a running
   total, where b is 0 within four tiles, 1 within eight and 2 beyond
   (Manhattan). `TViewer::AmbientLight` then uses a third of that total as a
   floor under the zone's own number, so a bright thing near you lifts the
   base of the WHOLE level, not just its own surroundings.

   Two things this cannot do, both said rather than hidden. The engine tests a
   per-square byte before counting a source, and that byte is state a running
   game keeps: of the 121 squares in view it passed 53 at one measured site
   and 58 at another, it is not passability (the best fit over widths 8..40
   and 600 offsets was 77.7%, at an offset that does not line up), and the
   archive does not carry it. So every lit square in the window is counted
   here. And the window is centred on the player, so this is what a player
   STANDING ON THIS SQUARE would see, which is why it is reported per square
   and not painted over the map.

   Measured against the engine at two sites in the Volcano: 96 against the
   game's 96, and 480 against its 512. Close, and not a bound in either
   direction. */
function lightSumAt(resid, m, tx, ty) {
  let sum = 0, n = 0;
  for (const s of buildLightSources(resid, m)) {
    const dx = s.x - tx, dy = s.y - ty;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) continue;
    const d = Math.abs(dx) + Math.abs(dy);
    sum += 1 << (2 * s.lvl - (d < 4 ? 0 : d < 8 ? 1 : 2));
    n++;
  }
  return { sum, n };
}

// Night falls gradually rather than snapping at a fixed hour. Still the
// fallback, for an archive whose zone has no entry script to read.
function nightAlpha(hour) {
  const h = ((hour % 24) + 24) % 24;
  const day = 6, duskStart = 18, duskEnd = 20, dawnStart = 5, dawnEnd = 7;
  if (h >= dawnEnd && h < duskStart) return 0;
  if (h >= duskEnd || h < dawnStart) return 0.74;
  if (h >= duskStart && h < duskEnd) return (h - duskStart) / (duskEnd - duskStart) * 0.74;
  return 0.74 - (h - dawnStart) / (dawnEnd - dawnStart) * 0.74;
}

// --- Map markers -----------------------------------------------------------
// Now that prop types have names, a prop list can be read as a list of THINGS
// rather than numbers. Three overlays fall straight out of that:
//   doors     -- the classes carrying ClassFlags 0x200, which is the bit the
//                level loader tests to put a door's open or shut aspect back
//                as the scenario has it when a zone is entered (its lock is
//                left alone; corrected 1 October 2026, when a run showed a
//                door left open shut again): the six doors, drawn
//                with their lock state. A name test until 25 September 2026,
//                which took the portcullis too; it carries no bit and no
//                lock, and is opened by its lever
//   secret    -- secret doors, and walls that do not block, which is what a
//                hidden passage looks like from the tile attributes
//   chest     -- containers, plus anything carrying a persistence StoreRef,
//                since those are the props that remember what is inside them
// The classification is by name, so it is only as good as the wiki's list and
// is marked as such in the legend. What is NOT guessed: whether a wall blocks
// comes from tile attribute byte 3 bit 0x02, straight out of 0xF002.
window.MAP_MARKS = { doors: false, secret: false, chest: false, exits: false, grid: false, rooms: false, eggs: false, path: false, save: false };
function toggleMapMarks(kind, on) { window.MAP_MARKS[kind] = on; drawMapMarks(); }
// The Path mark's state, its picker and its drawing are in
// js/delv-mapview.js: MAP_PATH_WHO, setMapPathWho, refreshPathPicker and
// drawSchedulePath.

// Prop types that are a way through something rather than a thing: the ones
// the game hides, plus the ones it merely tucks behind other scenery. Matching
// on /wall/ alone -- which is what this used to do -- caught "lit wall torch",
// "wall shelf" and "wall hanging", so Land King Hall reported sixteen torches
// as hidden passages. A wall is a name that ENDS in "wall".
const PASSAGE_PROPS = /^(secret |tight )?(passage|door)$|passthrough|mousehole|trapdoor|mineshaft|^cave$|^hole$|small hole|loose board|loose dirt|^sewer$|^crack$|^ladder$/;
function isWallProp(pt) {
  return /(^|\s)wall$/.test((propTypeName(pt) || '').toLowerCase());
}
// The walls the Walls toggle should take away, which are not the same set as
// the prop-list records whose name ends in "wall".
//
//   * Land King Hall's rock faces are FAUX props (0xF010) -- drawn by the
//     terrain tile itself, prop type "cavern", 277 squares of them -- so
//     "hide the walls" left every wall on that map exactly where it was,
//     which is the reported bug.
//   * Odemia's and Cademia's city walls are the faux prop "crenellation"
//     (226 and 106 squares). Their prop lists contain no wall records at all.
//
// Not everything solid is a wall: trees, fences, pillars, tables and urns all
// block and all stay, because hiding them would not be lifting a wall, it
// would be emptying the map. Terrain that is simply wall-coloured ground stays
// too -- there is no floor underneath it to reveal.
function isWallLikeProp(pt) {
  const nm = (propTypeName(pt) || '').toLowerCase();
  return isWallProp(pt) || nm === 'cavern' || nm === 'crenellation';
}

/* ---------------------------------------------------------------------------
   Ways through, ways out
   ---------------------------------------------------------------------------
   Two questions are asked of every passage prop, and they are independent:

     is it a way OUT of here?   -- a cave mouth, a mineshaft, a stair, a
                                   trapdoor, a ravine you can climb into
     is it CONCEALED?           -- a secret door, a mousehole, a loose board,
                                   or anything the map draws something else on
                                   top of

   A cave mouth answers yes to the first and no to the second, so it is marked
   as an exit and not as a hidden way, even where the only route to it is
   through a secret door. A tunnel with a crate standing over it answers yes to
   both, and gets both rings. Ravines ("crack") are in both lists as well: they
   go somewhere and they are not obvious, and some of them cannot be entered at
   all until a rope has been fixed to them -- which the archive records as a
   rope prop placed on the square, so those are called out separately.
--------------------------------------------------------------------------- */
// A way out is what the class says since 19 September 2026: a Portal
// member, a script that changes zone, or a dug way (classTravels). The
// name list this replaced also named the mousehole, the crack, the loose
// board and the passages, which are concealed ways THROUGH and never
// change zone; concealment beat exit-ness in the marks, so none of those
// was ever ringed as an exit. It named the trapdoor too, whose script
// only locks and unlocks. The kind-1 eggs were laid over the passage
// props to see whether the file marks exits that way: they cover almost
// none (the Land King Hall arch, a secret passage, two tight passages),
// and stand instead on the town entrances of the world and the interior
// doors of Pnyx, so an egg is a way to another place and not a mark on a
// prop.
// "tight passage" joined the hidden list when the marks were reworked: it is a
// squeeze-through gap in cave walls, concealed in exactly the way a crack
// is, and listing it only as an exit was painting Land King Hall's cave
// gaps pink instead of blue.
const HIDDEN_PROPS = /^(secret door|secret passage|passthrough|mousehole|loose board|loose dirt|small hole|fine wire|crack|tight passage)$/;
const ROPE_PROPTYPE = 0x14B;              // "rope" -- 4 records, all on ravines

function classifyProp(pt, tileId) {
  const nm = (propTypeName(pt) || '').toLowerCase();
  if (/secret/.test(nm) || PASSAGE_PROPS.test(nm)) return 'secret';
  // A door is a class whose ClassFlags carry 0x200, the file's own word for
  // it (classCarriesFlag): entering a zone, the loader runs such a door's
  // method 0, which takes the scenario's aspect back. The name test this replaced took a "doorway", the arch a door
  // hangs in, out by its spelling and the portcullis in by its name.
  if (classCarriesFlag(pt, 0x200)) return 'doors';
  // A container is a class with IsContainer (23), the file's own word for
  // it (classHasMember); the name list this replaced marked urns and the
  // bookshelf, which no record is ever inside.
  if (classHasMember(pt, 23)) return 'chest';
  return null;
}
// Is this prop a way off the map or down to another level?
function isExitProp(pt, mapResid) {
  if (!classTravels(pt)) return false;
  return mapResid === undefined || mapResid === WORLD_MAP_RESID || !SETTLEMENT_PROPS.test((propTypeName(pt) || '').toLowerCase());
}
// Is this prop concealed by its own nature (rather than by something drawn
// over it, which drawMapMarks works out from the draw stack)?
function isConcealedProp(pt) { return HIDDEN_PROPS.test((propTypeName(pt) || '').toLowerCase()); }

/* ---------------------------------------------------------------------------
   Gateways: the icons on the world map that are a way into somewhere else
   ---------------------------------------------------------------------------
   The world map (0x8001, 256x256) does not contain the towns. It draws each
   one as a pictogram a few squares across -- Cademia is four `small city`
   props covering 4x4 squares, where Cademia's own map is 128x128 squares of
   streets, houses and interiors. Checked directly before any of this was
   built: sliding every zone map over the world grid at every offset, the best
   tile-for-tile agreement any of them reaches is 44%, and that is the 24x16
   Sitia bridge matching open water and grass. No zone map is embedded in the
   world map, and the pictograms are not their layouts.

   What the archive does carry, exactly, is which pictogram is which town. A
   prop's data2 is a zoneport index (0xF00C), which resolves to a destination
   map and the square you arrive on -- the same field the cave and mineshaft
   props already used for `Leads to`. The settlement icons carry it too, and
   the reading round-trips: of the 26 gateways this finds on the world map,
   19 have a destination whose own edge exits point back at a world zoneport
   within a couple of squares of the icon. Cademia's icon at (171,96)..(173,98)
   has data2 -> zoneport 19 -> Cademia (6,62), and Cademia's four edges ->
   zoneport 18 -> world (169,97), one square from the icon. The other seven
   are maps with sealed edges -- the caves, the Volcano, Land King Hall --
   which are left by a zoneport rather than by walking off the side, so there
   is nothing for them to round-trip against.

   The settlement reading is scoped to the world map, and deliberately. A
   `large city` or `ruins` prop is also an ordinary building on nine other
   maps, where its data2 lands on an unrelated zone (Odemia's ruins claim the
   Abandoned Farmhouse; the Dungeon's claims the Iron Mine) -- the field means
   something else there, and a wrong `Leads to` is worse than none. `arch` is
   trusted everywhere because it pairs both ways with no help: the world's
   arch at (163,20) has data2 -> Land King Hall (62,32), and Land King Hall's
   arch at (63,32) has data2 -> world (164,20).
--------------------------------------------------------------------------- */
const WORLD_MAP_RESID = 0x8001;
// The one name list left in this reading, and it scopes rather than
// decides: the settlement classes are Portal classes like any other, but
// a `ruins` or a `large city` standing on a town map is a building whose
// Data2 is not a zoneport (see above), so their Data2 is read only on the
// world map. Which classes are settlements is this page's word; the file
// does not distinguish them from the other portals.
const SETTLEMENT_PROPS = /^(large city|small city|ruins)$/;

// Where a prop record travels to, or null. mapResid is the map the record was
// read from, which is what scopes the settlement icons.
function propTravelsTo(rec, mapResid) {
  if (!rec || !rec.d2) return null;
  // Since 19 September 2026 the class decides: a Portal member (58), a
  // script that calls ChangeZone, or a Dug class reading its Data3
  // (classTravels), which is the set the application and the scripts
  // actually read Data2 as a zoneport for. The passages the old list also
  // named -- mousehole, crack, loose board -- have no class or no such
  // member, and their zone change is an egg's. The settlement scoping
  // above is the one judgement left.
  const known = classTravels(rec.proptype) &&
                (mapResid === WORLD_MAP_RESID || !SETTLEMENT_PROPS.test((propTypeName(rec.proptype) || '').toLowerCase()));
  return known ? zoneportInfo(rec.d2) : null;
}

/* Every gateway off the world map, as a footprint with a destination.

   Grouped by zoneport, then split into spatial clusters, because a zoneport
   is a destination and not a doorway: two mouths far apart leading to the
   same zone are two gateways, not one with a footprint spanning the ground
   between them. The shipped archive has no such case -- every zoneport here
   yields exactly one cluster -- so this is for a modded archive, and it is
   four lines rather than an assumption that would be silently wrong. Four
   squares is the reach, which keeps Cademia's four adjacent icons together.

   The footprint is the squares the icons actually cover, not the squares the
   records name: a multi-square sprite stores only its bottom-right corner
   (see multiTilePieces), so Cademia's four records at (171,96)..(173,98) draw
   over (170,95)..(173,98). The World tab rings this rectangle, so a footprint
   one square short would draw a ring through the middle of the pictogram. */
function worldGateways() {
  if (DERIVED.WORLD_GATEWAYS) return DERIVED.WORLD_GATEWAYS;
  const out = [];
  try {
    const propResid = WORLD_MAP_RESID + 0x100;
    const raw = getResourceBytes(ARCHIVE, propResid);
    const propTiles = getPropTileList();
    const recs = raw ? parseDelverPropList(smartDecrypt(raw, propResid).data) : [];
    const byPort = new Map();
    for (const r of recs) {
      // The same record filter the prop pass uses: deleted records, carried
      // and contained props, eggs and roof placements are not on the ground.
      if (!r.onMap || r.flags === 0xFF || (r.flags & 0x58)) continue;
      if (r.flags === 0x42 || r.flags === 0x44) continue;
      const dest = propTravelsTo(r, WORLD_MAP_RESID);
      if (!dest || dest.resid === WORLD_MAP_RESID || !refExists(dest.resid)) continue;
      if (!byPort.has(r.d2)) byPort.set(r.d2, []);
      byPort.get(r.d2).push(r);
    }
    for (const [port, group] of byPort) {
      for (const cluster of clusterRecords(group, 4)) {
        const cells = [];
        for (const r of cluster) {
          cells.push([r.x, r.y]);
          const base = propTiles[r.proptype];
          if (base === undefined) continue;
          for (const pc of (multiTilePieces(base + r.aspect, r.rotated) || []))
            cells.push([r.x + pc.dx, r.y + pc.dy]);
        }
        const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
        const dest = zoneportInfo(port);
        out.push({
          port, cluster, cells,
          x0: Math.min(...xs), y0: Math.min(...ys),
          x1: Math.max(...xs), y1: Math.max(...ys),
          destResid: dest.resid, destX: dest.x, destY: dest.y,
          name: zoneNameFor(dest.resid) || dest.name,
          kind: (propDisplayName(cluster[0].proptype) || 'way in').toLowerCase(),
          sealed: mapIsSealed(dest.resid)
        });
      }
    }
    out.sort((a, b) => a.name.localeCompare(b.name) || a.x0 - b.x0);
  } catch (e) { quiet(e); }
  return (DERIVED.WORLD_GATEWAYS = out);
}

// Single-linkage clustering of prop records by Chebyshev distance. n is at
// most a handful per zoneport, so the quadratic sweep is the honest one.
function clusterRecords(recs, reach) {
  const left = recs.slice(), out = [];
  while (left.length) {
    const group = [left.shift()];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = left.length - 1; i >= 0; i--) {
        const r = left[i];
        if (group.some(q => Math.abs(q.x - r.x) <= reach && Math.abs(q.y - r.y) <= reach)) {
          group.push(r); left.splice(i, 1); grew = true;
        }
      }
    }
    out.push(group);
  }
  return out;
}

/* Is this map's edge closed?

   A map header's four edge fields are zoneport indices, and where one is set
   you leave the map by walking far enough that way (see mapExitEdges). A map
   with all four zero cannot be left that way at all, which is exactly the
   difference between somewhere out in the world and somewhere inside
   something: 19 of the world map's 26 gateways lead to a map with open edges
   -- every town, farm, vineyard, ruin and stronghold -- and the other seven
   are Land King Hall, the Volcano and the caves. The World tab uses that
   split rather than a list of names, so a modded archive gets the reading its
   own headers ask for.

   It is what decides whether a place is continuous with the world: an
   open-edged destination is entered by zooming, keeps the world's own scenery
   around it and is left by zooming back out; a sealed one is entered by a
   click and left by the way back. */
function mapIsSealed(resid) {
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (!raw) return true;
    let { data, wasDecrypted } = smartDecrypt(raw, resid);
    let m = parseDelverMap(data);
    if (!m) {
      const alt = wasDecrypted ? raw : decryptResource(raw, resid);
      m = parseDelverMap(alt);
    }
    if (!m) return true;
    return !(m.exitZoneportNorth || m.exitZoneportEast ||
             m.exitZoneportSouth || m.exitZoneportWest);
  } catch (e) { return true; }
}

// The gateway whose footprint holds a square, if any.
function gatewayAtSquare(tx, ty) {
  for (const gw of worldGateways())
    if (tx >= gw.x0 && tx <= gw.x1 && ty >= gw.y0 && ty <= gw.y1) return gw;
  return null;
}

/* ---------------------------------------------------------------------------
   Roofs
   ---------------------------------------------------------------------------
   A roofed map carries a second tile layer. The header declares its size (two
   uint16 fields that are always equal, hence the sum-and-halve in
   parseDelverMap), and the block itself is 0x40 words per unit -- 64 tiles,
   which is an 8x8 square. The wiki's Map page gets this far and stops: "The
   roofs appear to be stored in 8-tile strips. Much is yet to be elucidated."

   What was missing is where each square goes, and the answer is in the prop
   list. delvmod's proptypename_with_flags names flags 0x44 "ROOF" -- it
   declines to read the proptype field for those records, which is the hint.
   That field is a roof-block index, and the location word is where the block
   sits. Checked against the whole archive:

     * the number of DISTINCT indices equals the declared block count on all
       16 roofed maps, and the highest index is always count-1, so every block
       is placed and none is invented (Cademia: 124 records, 102 blocks -- some
       blocks are placed more than once, which is a terrace of identical
       houses),
     * the location is the block's BOTTOM-RIGHT corner, the same convention
       multi-square props use. Anchored that way all 298 blocks land inside
       their map; the other three corners spill 24 to 128 tiles off the edge,
       and on the 16x16 map (Charax's house) top-left anchoring puts the block
       at x=11..18 of a 16-wide map. Bottom-right also puts the most roof over
       walls (33%, against 24-27%), which is what a roof does.

   Charax's house is the whole format in miniature: walls enclosing x=5..11,
   y=4..11, one block anchored at (11,11) covering exactly x=4..11, y=4..11 with
   a one-tile overhang, and a second three-row block above it for the ridge.

   Still unexplained: the aspect field. It is 0 on 127 of the 298 records and
   takes 20 other values on the rest, and nothing here depends on it. Whatever
   it selects, it is not the block.
--------------------------------------------------------------------------- */
window.MAP_ROOFS = false;

// The flags-0x44 records of this map's prop list, as roof placements.
function mapRoofSections(mapResid) {
  const propResid = mapResid + 0x0100;
  let recs = null;
  try {
    const raw = getResourceBytes(ARCHIVE, propResid);
    if (raw) recs = parseDelverPropList(smartDecrypt(raw, propResid).data);
  } catch (e) { return []; }
  if (!recs) return [];
  return recs.filter(r => r.flags === 0x44)
             .map(r => ({ block: r.proptype, x: r.x, y: r.y, aspect: r.aspect }));
}

/* The overlay layers -- characters, roofs, marks, lighting -- are each a
   full-map canvas the size of the base, so a base at 268 MB would be five of
   those. They are capped instead: the canvas is smaller and the CSS box stays
   the base's, so the browser scales it. A sprite drawn at 16 and shown at 32
   is softer than one drawn at 32, and that is the right thing to give up
   here -- the terrain under it is what full resolution was asked for. Below
   the cap, which is every ordinary render, this is 1 and nothing changes. */
const LAYER_MAX_PX = 1.7e7;
function layerGeom(cm) {
  const px = cm.width * cm.height;
  const f = px > LAYER_MAX_PX ? Math.sqrt(LAYER_MAX_PX / px) : 1;
  return { w: Math.max(1, Math.round(cm.width * f)), h: Math.max(1, Math.round(cm.height * f)),
           TS: cm.TS * f };
}

function ensureRoofLayer() {
  const wrap = document.getElementById('mapCanvasWrap');
  if (!wrap) return null;
  let rc = document.getElementById('roofLayer');
  if (!rc) {
    rc = document.createElement('canvas');
    rc.id = 'roofLayer';
    // Above the terrain and the props, below the marks and the characters: a
    // roof hides what is under it, which is the point of being able to lift it.
    rc.style.cssText = 'position:absolute; top:0; left:0; image-rendering:pixelated; pointer-events:none; z-index:3;';
    wrap.appendChild(rc);
  } else if (rc.parentNode !== wrap) wrap.appendChild(rc);
  return rc;
}

function drawRoofLayer(lensCtx, lensTS) {
  const cm = window.CUR_MAP;
  if (!cm) return;
  const active = window.MAP_ROOFS && cm.roofSections && cm.roofSections.length;
  let ctx, TS;
  if (lensCtx) {
    if (!active) return;
    ctx = lensCtx; TS = lensTS;
  } else {
    const rc = ensureRoofLayer();
    if (!rc) return;
    cm.roofTilesDrawn = 0;
    if (!active) {
      // Deflate rather than clear: a cleared canvas keeps its backing store,
      // and on iOS every full-map layer counts against the budget that was
      // crashing the tab. Zero-sized, it costs nothing until toggled back.
      rc.width = 0; rc.height = 0;
      scheduleLensPaint();
      return;
    }
    { const L = layerGeom(cm); rc.width = L.w; rc.height = L.h; }
    rc.style.width = cm.width + 'px'; rc.style.height = cm.height + 'px';
    ctx = rc.getContext('2d');
    ctx.clearRect(0, 0, rc.width, rc.height);
    TS = layerGeom(cm).TS;   // the layer canvas is capped; draw at its own scale
  }
  cm.roofTilesDrawn = paintRoofsInto(ctx, TS, cm.m, cm.roofSections);
  if (!lensCtx) scheduleLensPaint();
}

/* The roof blocks of a map, painted into any context at any tile size.

   Split out of drawRoofLayer, which reads window.CUR_MAP: the World tab draws
   the roofs of maps that are not the open one -- every town's miniature on
   the world map is roofed, because a town seen from above is roofs -- and
   there was no way to ask for that without pretending some other map was
   current. Returns the number of tiles drawn, which is what the roof note
   under the map reports. */
function paintRoofsInto(ctx, TS, m, sections) {
  if (!m || !m.raw || !sections) return 0;
  let drawn = 0;
  // In prop-list order, so a later block laid over an earlier one wins -- which
  // is how the ridge block finishes the roof of Charax's house.
  for (const sec of sections) {
    const base = m.roofDataOffset + sec.block * 64 * 2;
    if (base + 128 > m.raw.length) continue;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const tile = u16be(m.raw, base + (row * 8 + col) * 2);
        if (!tile) continue;                      // 0 is nothing, not a tile
        const gx = sec.x - 7 + col, gy = sec.y - 7 + row;
        if (gx < 0 || gy < 0 || gx >= m.width || gy >= m.height) continue;
        drawTileAt(ctx, tile, gx * TS, gy * TS, true, TS);
        drawn++;
      }
    }
  }
  return drawn;
}
function toggleRoofs(on) {
  window.MAP_ROOFS = on;
  drawRoofLayer();
  const rc = document.getElementById('roofLayer');
  if (rc) rc.style.opacity = '1';
  const note = document.getElementById('roofNote');
  const cm = window.CUR_MAP;
  if (note) {
    note.textContent = !cm || !cm.roofSections || !cm.roofSections.length
      ? 'this map has no roof data'
      : on ? (cm.roofSections.length + ' roof sections, ' + (cm.roofTilesDrawn || 0) + ' tiles')
           : (cm.roofSections.length + ' roof sections hidden');
  }
}

// Walls are baked into the terrain canvas rather than living on a layer of
// their own, so switching them re-renders that one canvas in place. The
// viewport transform, the zoom and every overlay above it are left alone.
window.MAP_WALLS = true;
function rerenderMapTerrain() {
  const cm = window.CUR_MAP;
  if (!cm || !cm.mapData) return;
  const result = renderMapVisual(cm.resid, cm.mapData);
  if (!result) return;
  // The kept render was made under the other setting and its canvas is about
  // to be detached, so it must not be handed to the next visit.
  if (typeof forgetZoneRender === 'function') forgetZoneRender(cm.resid);
  const old = document.getElementById('mapTerrainCanvas');
  result.canvas.id = 'mapTerrainCanvas';
  if (old && old.parentNode) old.parentNode.replaceChild(result.canvas, old);
  cm.canvas = result.canvas;
  cm.props = result.props;
  cm.drawOps = result.drawOps;
  cm.allProps = result.allProps;
  cm.animCells = result.animCells;
  cm.animReplay = result.animReplay;
  cm.wallsHidden = result.wallsHidden;
  startMapAnimation();
  drawMapMarks();
}
function toggleWalls(on) {
  window.MAP_WALLS = on;
  rerenderMapTerrain();
  const note = document.getElementById('wallNote');
  if (note) {
    const n = (window.CUR_MAP && window.CUR_MAP.wallsHidden) || 0;
    note.textContent = on ? '' : (n ? n + ' wall squares hatched, still solid' : 'no walls on this map');
  }
}

function ensureMarkLayer() {
  const wrap = document.getElementById('mapCanvasWrap');
  if (!wrap) return null;
  let mc = document.getElementById('markLayer');
  if (!mc) {
    mc = document.createElement('canvas');
    mc.id = 'markLayer';
    mc.style.cssText = 'position:absolute; top:0; left:0; image-rendering:pixelated; pointer-events:none; z-index:4;';
    wrap.appendChild(mc);
  } else if (mc.parentNode !== wrap) wrap.appendChild(mc);
  return mc;
}

// How much of a tile is opaque, 0..1. Used to tell "a passage with something
// standing over it" from "a passage in plain sight".
const _tileFillCache = derivedMap('_tileFillCache');
function tileOpacity(tileId) {
  if (_tileFillCache.has(tileId)) return _tileFillCache.get(tileId);
  let v = 0;
  try {
    const img = resolveTileImage(tileId);
    if (img) { let n = 0; for (let i = 0; i < img.length; i++) if (img[i]) n++; v = n / img.length; }
  } catch (e) { quiet(e); }
  _tileFillCache.set(tileId, v);
  return v;
}

// Every zoneport that lands on this map. A zoneport is the game's own
// cross-map link (0xF00C), so these are the squares you arrive on and, being
// two-way in practice, the squares you leave from: Land King Hall's door out
// to the world map and the mouths of its tunnels are all here. This replaced
// four "N -> somewhere" buttons that only ever fired on maps whose edges are
// open, which is a minority of them.
function mapExitSquares(resid) {
  const out = [];
  const ports = loadZoneports();
  for (let i = 0; i < ports.length; i++) {
    const z = ports[i];
    if (!z || z.map !== resid) continue;
    // 0xF00C is 4KB of fixed-size records and most of it is zero padding. A
    // padding record reads as map 0x8000 at (0,0), which put 834 phantom
    // "zone exits" on map 0x8000 alone -- the whole tail of the table.
    if (!z.x && !z.y && !(z.map & 0xFF)) continue;
    out.push({ idx: i, x: z.x, y: z.y });
  }
  return out;
}

// The map header's four edge zoneports. Where one is set you leave the map by
// walking far enough that way at ANY row or column -- Odemia's four edges all
// carry zoneport 5, the world map -- so the mark is the whole outermost row or
// column, not a square. Where it is zero the edge is sealed and nothing is
// drawn. (0x8026, the Sitia bridge, has only east and west set, which is what
// a bridge is.)
function mapExitEdges(resid, m) {
  if (!m) return [];
  const sides = [
    ['N', m.exitZoneportNorth], ['E', m.exitZoneportEast],
    ['S', m.exitZoneportSouth], ['W', m.exitZoneportWest]
  ];
  const out = [];
  for (const [side, idx] of sides) {
    if (!idx) continue;
    const cells = [];
    if (side === 'N') for (let x = 0; x < m.width; x++) cells.push([x, 0]);
    if (side === 'S') for (let x = 0; x < m.width; x++) cells.push([x, m.height - 1]);
    if (side === 'W') for (let y = 0; y < m.height; y++) cells.push([0, y]);
    if (side === 'E') for (let y = 0; y < m.height; y++) cells.push([m.width - 1, y]);
    out.push({ side, idx, cells });
  }
  return out;
}

// Squares carrying a rope prop. In the shipped scenario there are four, two in
// Cademia and two in Kosha, and every one of them sits on a ravine: the rope
// is what makes that ravine enterable, so a ravine marked here is one you
// cannot simply walk into.
function ropeSquares(resid) {
  const key = 'rope:' + resid;
  if (DERIVED.MAP_ROPES && DERIVED.MAP_ROPES.key === key) return DERIVED.MAP_ROPES.set;
  const set = new Set();
  try {
    const raw = getResourceBytes(ARCHIVE, resid + 0x100);
    if (raw) for (const r of parseDelverPropList(smartDecrypt(raw, resid + 0x100).data)) {
      if (r.flags === 0xFF || (r.flags & 0x58)) continue;
      if (r.proptype === ROPE_PROPTYPE) set.add(r.x + ',' + r.y);
    }
  } catch (e) { quiet(e); }
  DERIVED.MAP_ROPES = { key, set };
  return set;
}

function drawMapMarks(lensCtx, lensTS) {
  const cm = window.CUR_MAP;
  if (!cm) return;
  const M = window.MAP_MARKS;
  const spots_ = DERIVED.MAP_ITEM_SPOTS;
  const anything = M.doors || M.secret || M.chest || M.exits || M.grid || M.rooms || M.eggs || M.path || M.save || window.MAP_SEL ||
                   (spots_ && spots_.resid === cm.resid && spots_.cells.length);
  let ctx, TS;
  const legend = lensCtx ? null : document.getElementById('markLegend');
  if (lensCtx) {
    if (!anything) return;
    ctx = lensCtx; TS = lensTS;
  } else {
    const mc = ensureMarkLayer();
    if (!mc) return;
    if (!anything) {
      mc.width = 0; mc.height = 0;          // deflate, see drawRoofLayer
      if (legend) legend.innerHTML = '';
      scheduleLensPaint();
      return;
    }
    { const L = layerGeom(cm); mc.width = L.w; mc.height = L.h; }
    mc.style.width = cm.width + 'px'; mc.style.height = cm.height + 'px';
    ctx = mc.getContext('2d');
    ctx.clearRect(0, 0, mc.width, mc.height);
    TS = layerGeom(cm).TS;   // the layer canvas is capped; draw at its own scale
  }
  const colours = { doors: '#ffd166', secret: '#8fd4ff', chest: '#a8e06a', exits: '#ff9ad5', path: '#7ef0c0' };
  // A line on every square's edge, so a coordinate can be counted off the map.
  if (M.grid) {
    const cols = Math.round(cm.width / cm.TS), rows = Math.round(cm.height / cm.TS);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= cols; x++) { ctx.moveTo(x * TS + 0.5, 0); ctx.lineTo(x * TS + 0.5, rows * TS); }
    for (let y = 0; y <= rows; y++) { ctx.moveTo(0, y * TS + 0.5); ctx.lineTo(cols * TS, y * TS + 0.5); }
    ctx.stroke();
    ctx.restore();
  }
  // Ring the SQUARES, not the sprites. This used to subtract the prop's draw
  // offset so the ring followed the artwork, which is wrong twice over: the
  // offsets are up to 24px on a 32px tile, so the ring sat the best part of a
  // square up and left of the thing it marked, and what a reader wants marked
  // is the square they would have to stand on, which is the record's own
  // coordinate whatever the sprite does above it.
  const ring = (cells, col, dashed) => {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, TS / 16);
    if (dashed) ctx.setLineDash([TS / 5, TS / 5]);
    for (const [x, y] of cells)
      ctx.strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
    ctx.restore();
  };
  // A doorway is one record spanning two squares -- the arch is drawn across
  // both -- and ringing only the record's own square marked half a door: the
  // south half of an upright arch, the east half of a flat one, and on Land
  // King Hall's stone doors that read as the wrong square outright. One ring
  // around the union of the record's cells marks the whole opening, still
  // once per record.
  const ringBox = (cells, col) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of cells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (!Number.isFinite(x0)) return;
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, TS / 16);
    ctx.strokeRect(x0 * TS + 1, y0 * TS + 1, (x1 - x0 + 1) * TS - 2, (y1 - y0 + 1) * TS - 2);
    ctx.restore();
  };
  const wash = (cells, col, alpha) => {
    ctx.save();
    ctx.fillStyle = col; ctx.globalAlpha = alpha;
    for (const [x, y] of cells) ctx.fillRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
    ctx.restore();
  };
  // A rope tied to a ravine: a short knotted line across the square, so
  // "you need the rope for this one" reads without a legend.
  const ropeGlyph = (x, y) => {
    ctx.save();
    ctx.strokeStyle = '#f6e7b0'; ctx.lineWidth = Math.max(1, TS / 14);
    ctx.beginPath();
    ctx.moveTo(x * TS + TS * 0.5, y * TS + TS * 0.16);
    ctx.lineTo(x * TS + TS * 0.5, y * TS + TS * 0.84);
    ctx.moveTo(x * TS + TS * 0.32, y * TS + TS * 0.38);
    ctx.lineTo(x * TS + TS * 0.68, y * TS + TS * 0.38);
    ctx.moveTo(x * TS + TS * 0.32, y * TS + TS * 0.62);
    ctx.lineTo(x * TS + TS * 0.68, y * TS + TS * 0.62);
    ctx.stroke();
    ctx.restore();
  };

  /* The rooms of this map, as the rectangles they are.
     A room is a kind-8 egg and it covers an area rather than the square the
     record sits on (eggRect). These were drawn on the World tab when the
     reading was new, which was the wrong place: the world is a picture of an
     island, and a score of outlines tiling a town is clutter at that scale.
     Here one map fills the screen, the outline means something, and it is off
     until asked for, like every other mark. */
  let roomCount = 0;
  if (M.rooms) {
    ctx.save();
    ctx.strokeStyle = '#c9b6ff'; ctx.lineWidth = Math.max(1, TS / 16);
    ctx.setLineDash([TS / 4, TS / 4]);
    ctx.beginPath();
    const boxes = [];
    for (const r of (cm.allProps || [])) {
      if (r.flags !== 0x42 || r.aspect !== 8) continue;
      const q = eggRect(r);
      roomCount++;
      boxes.push({ q, room: r.proptype });
      ctx.rect(q.left * TS + 1, q.top * TS + 1, q.w * TS - 2, q.h * TS - 2);
    }
    ctx.stroke();
    ctx.restore();
    // The number, where the rectangle has room for it. One font for all of
    // them and no per-label state, the lesson of the World tab's judder.
    ctx.save();
    ctx.font = canvasFace(Math.max(9, Math.min(13, Math.round(TS / 2.4))));
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    for (const b of boxes) {
      if (b.q.w * TS < 34 || b.q.h * TS < 18) continue;
      const label = 'room ' + b.room;
      const tw = Math.round(ctx.measureText(label).width);
      ctx.fillStyle = 'rgba(8,7,5,.72)';
      ctx.fillRect(b.q.left * TS + 3, b.q.top * TS + 3, tw + 8, 15);
      ctx.fillStyle = '#c9b6ff';
      ctx.fillText(label, b.q.left * TS + 7, b.q.top * TS + 14);
    }
    ctx.restore();
  }

  /* The eggs of this map: every trigger that is not a room (rooms have their
     own mark and are rectangles), a dotted circle on its square with a
     letter for its kind, counted by kind in the legend. Eggs are drawn
     nowhere else on a map; the square's panel says what each does
     (eggDetail). Off until asked for, like every mark (the maintainer,
     22 September 2026). */
  const eggCounts = new Map();
  if (M.eggs) {
    const LETTER = ['H', 'W', 'S', 'A', 'Z', 'M', 'S', 'N', 'R', '-', 'C'];
    ctx.save();
    ctx.strokeStyle = '#ffb36b'; ctx.lineWidth = Math.max(1, TS / 18);
    ctx.setLineDash([TS / 8, TS / 8]);
    ctx.font = canvasFace(Math.max(8, Math.min(14, Math.round(TS / 2.2))));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const r of (cm.allProps || [])) {
      if (r.flags !== 0x42 || r.aspect === 8) continue;
      eggCounts.set(r.aspect, (eggCounts.get(r.aspect) || 0) + 1);
      const cx = r.x * TS + TS / 2, cy = r.y * TS + TS / 2;
      ctx.beginPath(); ctx.arc(cx, cy, TS * 0.38, 0, Math.PI * 2); ctx.stroke();
      if (TS >= 14) { ctx.fillStyle = '#ffb36b'; ctx.fillText(LETTER[r.aspect] || '?', cx, cy + 1); }
    }
    ctx.restore();
  }

  // One character's day, as the line they walk (drawSchedulePath in
  // js/delv-mapview.js, which says why it is the whole day and not the hour).
  const drawnPath = M.path ? drawSchedulePath(ctx, TS, cm, colours.path) : null;
  const pathStops = drawnPath ? drawnPath.stops : 0;
  const pathName = drawnPath ? drawnPath.name : '';

  const counts = { doors: 0, secret: 0, chest: 0, exits: 0 };
  let occluded = 0, edges = 0, ropes = 0, locked = 0;
  const secretTypes = new Map();
  const ropeDone = new Set();
  const anyMark = M.doors || M.secret || M.chest || M.exits;

  if (M.exits) {
    // The four edge bands: THE zone exits of a map with open edges. The
    // 0xF00C zoneport squares used to be ringed here too, but those are
    // arrival points -- where the map graph lands you, not a door you can
    // see -- and ringing them scattered isolated pink tiles across rooms.
    // The inspector still explains them when their square is clicked.
    for (const e of mapExitEdges(cm.resid, cm.m)) {
      edges++;
      wash(e.cells, colours.exits, 0.18);
      ring(e.cells, colours.exits, true);
    }
  }

  if (anyMark) {
    const attrs = getTileAttributes(ARCHIVE);
    const ropes_ = ropeSquares(cm.resid);
    const markedOnce = new Set();
    // What is drawn on each square, in draw order, so "hidden behind
    // something" can be answered without guessing.
    const stack = new Map();
    for (const op of (cm.drawOps || [])) {
      const k = op.y * 4096 + op.x;
      if (!stack.has(k)) stack.set(k, []);
      stack.get(k).push(op.d);
    }
    for (const d of (cm.props || [])) {
      const r = d.rec;
      let kind = classifyProp(r.proptype, d.tileId);
      // A wall that does not block is a way through it. Bit 0x02 of attribute
      // byte 3 is the same blocking flag the map's own walkability test reads.
      if (!kind && isWallProp(r.proptype)) {
        if (!(((attrs[d.tileId] || 0) >> 8) & 0x02)) kind = 'secret';
      }
      if (!kind && r.storeref) kind = 'chest';
      // Something drawn over a passage hides it as surely as a secret door
      // does, and unlike a secret door nothing in the record says so.
      let buried = false;
      if (kind === 'secret' || isExitProp(r.proptype, cm.resid)) {
        const later = (stack.get(r.y * 4096 + r.x) || []);
        const mine = later.indexOf(d);
        for (let i = mine + 1; i < later.length; i++)
          if (tileOpacity(later[i].tileId) > 0.75) { buried = true; break; }
      }
      // Concealment beats exit-ness: a crack or a mousehole leads somewhere,
      // but what a reader needs marked is that it is HIDDEN -- the hole in
      // the cave floor is a zone exit, the crack that leads to its room is a
      // hidden way, not both, not the other way round. Only unconcealed
      // passages (cave mouths, holes, stairs, ladders) count as exits.
      const isExit = isExitProp(r.proptype, cm.resid) && !isConcealedProp(r.proptype);
      const isHidden = kind === 'secret' && (isConcealedProp(r.proptype) || buried ||
                                             isWallProp(r.proptype));
      const needsRope = ropes_.has(r.x + ',' + r.y);

      // One ring per square per kind, on the record's own square only. A
      // door is doorway + metal door stacked on one square, each spanning
      // two cells: ringing every cell of every record drew four rings for
      // one door, one of them a full square above the opening.
      const base = [[r.x, r.y]];
      const seen = (kind_) => {
        const k = kind_ + ':' + r.x + ',' + r.y;
        if (markedOnce.has(k)) return true;
        markedOnce.add(k);
        return false;
      };
      if (M.exits && isExit && !seen('e')) {
        counts.exits++;
        ring(base, colours.exits, false);
        wash(base, colours.exits, 0.14);
      }
      if (M.secret && isHidden && !seen('s')) {
        counts.secret++;
        if (buried) occluded++;
        // The legend breaks hidden ways down by what they ARE -- a mousehole
        // is entered differently from a crack (polymorph vs. rope or
        // climbing), so the type is the how.
        const tn = (propTypeName(r.proptype) || (buried ? 'buried' : 'other')).toLowerCase();
        secretTypes.set(tn, (secretTypes.get(tn) || 0) + 1);
        ring(base, colours.secret, true);
        if (buried) ring(base, '#ffffff', true);
      }
      if (M.doors && kind === 'doors' && !seen('d')) { counts.doors++; ringBox(d.cells, colours.doors); }
      if (M.chest && kind === 'chest' && !seen('c')) { counts.chest++; ring(base, colours.chest, false); }
      // A locked door or container wears a keyhole over its ring: the lock
      // id is the record's first data byte (see buildKeyLockIndex).
      if (((M.doors && kind === 'doors') || (M.chest && kind === 'chest')) &&
          r.d1 && classHasMember(r.proptype, 52) &&
          !seen('l')) {
        locked++;
        ctx.save();
        ctx.fillStyle = '#111'; ctx.strokeStyle = colours.doors;
        ctx.lineWidth = Math.max(1, TS / 20);
        const cxp = r.x * TS + TS * 0.5, cyp = r.y * TS + TS * 0.32;
        ctx.beginPath(); ctx.arc(cxp, cyp, TS * 0.14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cxp, cyp); ctx.lineTo(cxp, cyp + TS * 0.3);
        ctx.stroke();
        ctx.restore();
      }
      if ((M.exits || M.secret) && needsRope && (isExit || isHidden)) {
        ropes++; ropeGlyph(r.x, r.y); ropeDone.add(r.x + ',' + r.y);
      }
    }
    // A rope square with no passage prop on it is the commoner case: in
    // Cademia and Kosha the drop itself is terrain and the rope prop is the
    // only thing in the file that says you can get down there. Ring it as an
    // exit in its own right rather than letting it go unmarked.
    if (M.exits || M.secret) {
      for (const k of ropes_) {
        if (ropeDone.has(k)) continue;
        const [rx, ry] = k.split(',').map(Number);
        ropes++;
        if (M.exits) { counts.exits++; ring([[rx, ry]], colours.exits, false); wash([[rx, ry]], colours.exits, 0.14); }
        ropeGlyph(rx, ry);
      }
    }
  }

  // The ringed instances of one item, put there by showItemOnMap. Keyed to
  // the map it was asked about, so navigating to another map drops it.
  const spots = DERIVED.MAP_ITEM_SPOTS;
  let itemSpots = 0;
  if (spots && spots.resid === cm.resid && spots.cells.length) {
    itemSpots = spots.cells.length;
    // Gold and thick, and a second ring a square out, so the spots read at
    // any zoom (they were a thin white line, easy to miss on a busy map).
    ctx.save(); ctx.lineWidth = Math.max(2, TS / 8); ctx.strokeStyle = '#f9f86f';
    for (const [x, y] of spots.cells) ctx.strokeRect(x * TS + 1, y * TS + 1, TS - 2, TS - 2);
    ctx.globalAlpha = 0.5; ctx.lineWidth = Math.max(1, TS / 16);
    for (const [x, y] of spots.cells) ctx.strokeRect((x - 1) * TS, (y - 1) * TS, TS * 3, TS * 3);
    ctx.restore();
    wash(spots.cells, '#f9f86f', 0.2);
  }

  /* A save beside the open file (SAVE_BESIDE, from the comparison), its
     records drawn over the scenario's list of this zone (25 September 2026,
     the drawing half of a save against the scenario). By index, as the
     comparison reads them: a record only the save has is washed green and
     ringed, one only the scenario has is ringed red and dashed, one that
     moved is ringed at both squares with a line between, one changed where
     it stands is ringed amber. The save's characters whose record puts them
     in this zone are ringed blue at their square. */
  let saveLegend = null;
  if (M.save) {
    const sb = window.SAVE_BESIDE;
    if (!sb) saveLegend = 'no save open alongside this file; compare one under Tools';
    else {
      const listId = 0x8100 + cm.level;
      const sres = sb.spec.resources.find(r => r.resid === listId);
      let A = [], B = [];
      try { const raw = getResourceBytes(ARCHIVE, listId); if (raw) A = parseDelverPropList(smartDecrypt(raw, listId).data); } catch (e) { quiet(e, 'the zone list under the save mark'); }
      try { if (sres) B = parseDelverPropList(sres.data); } catch (e) { quiet(e, 'the save’s zone list'); }
      /* Only what stands on the map is drawn. A record's location word is a
         square only while the record is on the floor: carried (flags 0x10)
         or inside another prop (0x08) it is the holder's number, and a
         deleted record (0xFF) is nowhere (parseDelverPropList's onMap). Until
         28 September 2026 this compared every record's x and y, and a saved
         game writes everything its characters hold into the list of the zone
         they are in, past the scenario's own records; so a save's inventory
         was washed green as "placed" at squares made of holder numbers,
         along the map's top rows and off its edge. In the maintainer's own
         save of August 2001 that was 234 records in the Seldane Maayti
         Ruins, none of them on the ground. Now a record that left the floor
         is gone from where it stood, one that reached the floor is placed
         where it lies, and one off the floor in both files is not drawn and
         is counted when it differs. A zone the save holds no list of keeps
         the scenario's, as the legend says, so nothing there differs;
         before, the empty list read as every record gone. */
      if (!sres) B = A;
      const differs = (a, b) => a.flags !== b.flags || a.x !== b.x || a.y !== b.y || a.proptype !== b.proptype ||
                                a.aspect !== b.aspect || a.d1 !== b.d1 || a.d2 !== b.d2;
      const placed = [], gone = [], moved = [], changed = [];
      let offMap = 0;
      const n = Math.max(A.length, B.length);
      for (let i = 0; i < n; i++) {
        const a = A[i], b = B[i];
        const aOn = !!(a && a.onMap), bOn = !!(b && b.onMap);
        if (!aOn && !bOn) { if (b && b.flags !== 0xFF && (!a || differs(a, b))) offMap++; continue; }
        if (!aOn) { placed.push([b.x, b.y]); continue; }
        if (!bOn) { gone.push([a.x, a.y]); continue; }
        if (a.x !== b.x || a.y !== b.y) moved.push([[a.x, a.y], [b.x, b.y]]);
        else if (differs(a, b)) changed.push([a.x, a.y]);
      }
      const people = [];
      try {
        const cres = sb.spec.resources.find(r => r.resid === 0xF009);
        if (cres) parseDelverCharacterRecords(cres.data).forEach((c, i) => { if (i && delverCharacterInUse(c) && c.zone === cm.level) people.push([c.x, c.y]); });
      } catch (e) { quiet(e, 'the save’s characters'); }
      wash(placed, '#a8e06a', 0.35); ring(placed, '#a8e06a');
      ring(gone, '#ff7b7b', true);
      ring(changed, '#ffd166');
      if (moved.length) {
        ctx.save();
        ctx.strokeStyle = '#7ec8ff'; ctx.lineWidth = Math.max(1, TS / 12);
        for (const [[x0, y0], [x1, y1]] of moved) { ctx.beginPath(); ctx.moveTo(x0 * TS + TS / 2, y0 * TS + TS / 2); ctx.lineTo(x1 * TS + TS / 2, y1 * TS + TS / 2); ctx.stroke(); }
        ctx.restore();
        ring(moved.map(m => m[0]), '#7ec8ff', true); ring(moved.map(m => m[1]), '#7ec8ff');
      }
      ring(people, '#8fb8ff');
      const bits = [];
      if (!sres) bits.push('no list for this zone in the save, so this is the scenario’s list');
      if (placed.length) bits.push(placed.length + ' placed');
      if (gone.length) bits.push(gone.length + ' gone');
      if (moved.length) bits.push(moved.length + ' moved');
      if (changed.length) bits.push(changed.length + ' changed where it stands');
      if (offMap) bits.push(offMap + ' carried or inside something, not drawn');
      if (people.length) bits.push(people.length + (people.length === 1 ? ' character' : ' characters') + ' here');
      if (sb.quest) bits.push('the day drawn is the save’s, ' + sb.quest.flagsSet + ' quest flag' + (sb.quest.flagsSet === 1 ? '' : 's') + ' set and ' + sb.quest.valuesSet + ' value' + (sb.quest.valuesSet === 1 ? '' : 's') + ' nonzero');
      saveLegend = svEsc(sb.name) + (sb.player ? ' (' + svEsc(sb.player) + ')' : '') + ' over this zone: ' + (bits.length ? bits.join(', ') : 'the same records');
    }
  }

  drawMapSelection(ctx, TS);

  if (legend) {
    const parts = [];
    /* The swatches are drawn rather than typed. They were a box, a dash and a
       double dagger, and none of the page's three faces carries the box or the
       dagger, so they fell through to whatever the device had. The rope one
       is the same three strokes ropeGlyph puts on the map. */
    const BOX = '<span class="legendSwatch box"></span>';
    const LINE = '<span class="legendSwatch line"></span>';
    const ROPE = '<svg class="legendSwatch" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">' +
      '<path d="M5 1.6V8.4M3.2 3.8H6.8M3.2 6.2H6.8" stroke="currentColor" stroke-width="1.3" fill="none"/></svg>';
    const chip = (k, label) => parts.push('<span style="color:' + colours[k] + '">' + BOX + counts[k] + ' ' + label + '</span>');
    if (M.doors) chip('doors', 'doors' + (locked ? ', ' + locked + ' locked' : ''));
    if (M.secret) {
      const breakdown = [...secretTypes.entries()].sort((a, b) => b[1] - a[1])
        .map(([n, c]) => c + ' ' + n).join(', ');
      chip('secret', 'hidden ways' + (breakdown ? ' (' + breakdown + ')' : '') +
        (occluded ? ', ' + occluded + ' buried under scenery' : ''));
    }
    if (M.chest) chip('chest', 'containers');
    if (M.eggs) {
      const LETTER = ['H', 'W', 'S', 'A', 'Z', 'M', 'S', 'N', 'R', '-', 'C'];
      const by = [...eggCounts.entries()].sort((a, b) => a[0] - b[0])
        .map(([k, n]) => LETTER[k] + ' ' + n + ' ' + ((EGG_KIND_NAMES[k] || {}).what || 'kind ' + k));
      parts.push('<span style="color:#ffb36b">' + BOX + (by.length ? 'eggs: ' + svEsc(by.join('; ')) : 'no eggs but rooms') + '</span>');
    }
    if (M.exits) chip('exits', (counts.exits === 1 ? 'zone exit' : 'zone exits') +
      (edges ? ' + ' + edges + (edges === 1 ? ' open edge' : ' open edges') : ''));
    if (M.path && pathStops) parts.push('<span style="color:' + colours.path + '">' + LINE +
      svEsc(pathName) + ', ' + pathStops + (pathStops === 1 ? ' post' : ' posts') +
      ' on this map, joined by the route the game would walk; the color of each part of the route' +
      ' shows the hour it starts, and each part takes its own line where the game' +
      ' walks the same way twice</span>');
    if (ropes) parts.push('<span style="color:#fff">' + ROPE + ropes +
      (ropes === 1 ? ' needs a rope' : ' need a rope') + '</span>');
    if (itemSpots) parts.push('<span style="color:#fff">' + BOX + itemSpots + ' × ' +
      svEsc(propDisplayName(spots.pt) || ('0x' + spots.pt.toString(16).toUpperCase())) + '</span>');
    if (saveLegend) parts.push('<span style="color:#a8e06a">' + BOX + 'save: ' + saveLegend + '</span>');
    legend.innerHTML = parts.length
      ? parts.join(' &nbsp; ') + ' <span style="color:#8c8980">. Doors are the classes whose open or shut state the game sets back to the zone’s setting whenever the party enters the zone, ' +
        'containers are the classes with IsContainer, and the page finds hidden ways by prop-type name. Zone exits are visible ways out (holes, stairs, cave mouths) plus the map’s ' +
        'open edges, which you leave by walking off at any row or column; the page marks concealed passages as ' +
        'hidden ways instead.</span>'
      : '';
  }
  if (!lensCtx) scheduleLensPaint();
}

/* ---------------------------------------------------------------------------
   The square you clicked
   ---------------------------------------------------------------------------
   The inspector below the map named the square it was reading, and that was
   the only sign of which one it was: on a 64x64 map, "Square 41, 12" is not
   somewhere you can find again by eye. The selection is drawn on the mark
   layer, which is above the props and below nothing, so it survives the
   character and lighting layers being redrawn.
--------------------------------------------------------------------------- */
window.MAP_SEL = null;
function drawMapSelection(ctx, TS) {
  const sel = window.MAP_SEL;
  if (!sel) return;
  const x = sel.tx * TS, y = sel.ty * TS;
  ctx.save();
  ctx.lineWidth = Math.max(2, TS / 10);
  ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
  ctx.lineWidth = Math.max(1, TS / 16);
  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(x + 1, y + 1, TS - 2, TS - 2);
  // Corner ticks, so the square is still findable when the map is zoomed out
  // far enough that a one-pixel outline disappears.
  const t = Math.max(3, TS * 0.34);
  ctx.lineWidth = Math.max(2, TS / 8);
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [[x, y, 1, 1], [x + TS, y, -1, 1],
                                  [x, y + TS, 1, -1], [x + TS, y + TS, -1, -1]]) {
    ctx.moveTo(cx + dx * t, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + dy * t);
  }
  ctx.stroke();
  ctx.restore();
}
function setMapSelection(tx, ty) {
  window.MAP_SEL = (tx === null) ? null : { tx, ty };
  const cm = window.CUR_MAP;
  if (cm) {
    if (window.MAP_SEL) window.MAP_SEL_MEMORY[cm.resid] = window.MAP_SEL;
    else delete window.MAP_SEL_MEMORY[cm.resid];
  }
  drawMapMarks();
}

window.SHOW_LIGHTING = false;
function toggleLighting(on) { window.SHOW_LIGHTING = on; drawLighting(); }
function ensureLightLayer() {
  const wrap = document.getElementById('mapCanvasWrap');
  if (!wrap) return null;
  let lc = document.getElementById('lightLayer');
  if (!lc) {
    lc = document.createElement('canvas');
    lc.id = 'lightLayer';
    lc.style.cssText = 'position:absolute; top:0; left:0; image-rendering:pixelated; pointer-events:none; z-index:3;';
    wrap.appendChild(lc);
  } else if (lc.parentNode !== wrap) {
    wrap.appendChild(lc);
  }
  return lc;
}
/* The light cones, joined to the map (14 September 2026).

   The 25 `Lite` resources in the application's fork have been drawn in the
   fork gallery since v1.24.0 and used for nothing: the map drew a radial
   gradient of its own, because which cone a light uses was not read. It is
   read now, out of TViewer::CalcLighting, and it is the light's level rather
   than its reach:

     lha/clrlwi   the square's attribute byte, masked with 3 -- the same low
                  two bits buildLightSources already reads
     cmpwi 1      a level of 0 is not a light and is skipped
     slwi 31,31,1 the level doubled
     lis/addi     'Lite'
     addi 4,31,126  the resource id: 126 + 2*level + a flag
     bl           the resource is fetched

   So level 1 asks for Lite 128 or 129, level 2 for 130 or 131, level 3 for
   132 or 133 -- and those six are exactly the first family in the fork, sides
   10, 12, 14, 16, 18 and 22. Level 0 would be 126, which does not exist,
   which is consistent with the compare above never letting it ask. The
   remaining nineteen, 140 to 158 at sides 8 to 120, are some other caller's
   and are not reached from here.

   The flag added to the doubled level is a flicker. The word is tested at bit
   15, and a light that carries it calls Random and takes the low bit of the
   result -- so such a light picks between the two cones of its level every
   time the lighting is recomputed, guttering between 10 and 12 squares at
   level 1, 14 and 16 at level 2, 18 and 22 at level 3. Both calls were named
   from the stubs they go through rather than guessed: the glue at 0xc1f08 is
   GetResource and the one at 0xc3180 is Random, each resolved through its TOC
   slot to the loader's import table.

   A still picture cannot gutter, so this draws the smaller cone of each level
   -- the flag-0 one -- which is the light at its least generous.

   What this changes on screen: the gradient was a radius of 1.1 + 0.85 per
   level, so roughly 2, 3 and 3.6 squares, where the file says 5, 7 and 9. The
   falloff is the file's too -- one byte a square, 0 to 32 -- instead of a
   three-stop gradient. With no application open there is no fork to read and
   the gradient stays, which is also what a visitor who opened only the data
   file sees. */
function lightCone(lvl, variant) {
  const fork = window.APP_RSRC;
  if (!fork) return null;
  // Keyed on the fork object itself, so opening, swapping or closing an
  // application drops the cones with it and nothing else has to remember to.
  if (!window.LIGHT_CONES || window.LIGHT_CONES.fork !== fork)
    window.LIGHT_CONES = { fork, by: {} };
  const by = window.LIGHT_CONES.by;
  const v = variant ? 1 : 0, key = lvl + ':' + v;
  if (key in by) return by[key];
  let out = null;
  try {
    const list = fork.resourcesByType && fork.resourcesByType['Lite'];
    const e = list && list.find(r => r.id === 126 + 2 * lvl + v);
    if (e) {
      const d = fork.dataOf('Lite', e), n = d[0];
      if (n && d.length === 1 + n * n) {
        let mx = 0;
        for (let i = 1; i < d.length; i++) if (d[i] > mx) mx = d[i];
        const c = document.createElement('canvas');
        c.width = n; c.height = n;
        const cx = c.getContext('2d');
        if (cx) {
          const im = cx.createImageData(n, n);
          // Alpha alone: the wash is punched out with destination-out, so the
          // colour never shows and the brightness is the whole of the mask.
          for (let i = 0; i < n * n; i++) {
            const p = i * 4;
            im.data[p] = im.data[p + 1] = im.data[p + 2] = 0;
            im.data[p + 3] = mx ? Math.round(255 * d[1 + i] / mx) : 0;
          }
          cx.putImageData(im, 0, 0);
          out = { canvas: c, side: n, id: e.id };
        }
      }
    }
  } catch (err) { out = null; }
  return (by[key] = out);
}
function drawLighting(lensCtx, lensTS, rect) {
  const cm = window.CUR_MAP;
  if (!cm) return;
  let ctx, TS, washX, washY, washW, washH;
  if (lensCtx) {
    if (!window.SHOW_LIGHTING) return;
    ctx = lensCtx; TS = lensTS;
    washX = (rect.x0 - 1) * TS; washY = (rect.y0 - 1) * TS;
    washW = (rect.x1 - rect.x0 + 3) * TS; washH = (rect.y1 - rect.y0 + 3) * TS;
  } else {
    const lc = ensureLightLayer();
    if (!lc) return;
    if (!window.SHOW_LIGHTING) {
      lc.width = 0; lc.height = 0;          // deflate, see drawRoofLayer
      scheduleLensPaint();
      return;
    }
    { const L = layerGeom(cm); lc.width = L.w; lc.height = L.h; }
    lc.style.width = cm.width + 'px'; lc.style.height = cm.height + 'px';
    ctx = lc.getContext('2d');
    ctx.clearRect(0, 0, lc.width, lc.height);
    TS = layerGeom(cm).TS;   // the layer canvas is capped; draw at its own scale
    washX = 0; washY = 0; washW = lc.width; washH = lc.height;
  }
  const t = window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR;
  // The zone's own level where the file gives one, the hand-written curve
  // where it does not. 32 is the engine's "no darkening at all".
  const lvl = zoneAmbientLevel(cm.resid);
  const alpha = lvl === null ? nightAlpha(t) : (32 - ambientBase(lvl, t)) / 32;
  if (alpha <= 0.02) { if (!lensCtx) scheduleLensPaint(); return; }
  ctx.save();
  ctx.fillStyle = 'rgba(4,3,14,' + alpha + ')';
  ctx.fillRect(washX, washY, washW, washH);
  ctx.globalCompositeOperation = 'destination-out';
  for (const s of buildLightSources(cm.resid, cm.m)) {
    /* The file's own cone, at the file's own falloff, when the application is
       open to read it from. A light the engine flickers re-rolls which of its
       two cones it uses here, as the engine re-rolls it on every redraw; the
       palette frame in the animation tick is what repaints it.

       Without an application open there is no fork to read and the gradient
       below still runs, which is what a visitor who opened only the data file
       sees. */
    const cone = lightCone(s.lvl, s.flicker && Math.random() < 0.5 ? 1 : 0);
    if (cone) {
      // The cone's cells are eighths of a square: the engine's light buffer is
      // 128 cells across for a field of 16 squares, so a level-1 cone of side 10
      // is a pool 1.25 squares wide, which is what the inspector and the light
      // card print. Drawn a square a cell until 16 September 2026, eight times
      // too big.
      const w = cone.side * TS / 8;
      ctx.drawImage(cone.canvas, Math.round(s.x * TS + TS / 2 - w / 2),
                                 Math.round(s.y * TS + TS / 2 - w / 2), w, w);
      continue;
    }
    const cx = s.x * TS + TS / 2, cy = s.y * TS + TS / 2;
    // The same reach as the file's smaller cone of each level: sides 10, 14
    // and 18 cells, an eighth of a square each.
    const r = TS * (3 + 2 * s.lvl) / 8;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.6, 'rgba(0,0,0,.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  if (!lensCtx) scheduleLensPaint();
}

/* WHERE A PERSON CAN WALK, as the engine decides it (22 September 2026).

   TGameSys::CanMove asks TViewer::BuildStageEntry for the square, which is
   every attribute word on it OR'd together -- the terrain tile, the faux
   prop the terrain carries, and every prop standing there -- and for a
   walker with the flags a person has (GetMonstAttrs | 0x08000000, which is
   what TPathFinder::FindPath passes) the square is closed exactly when that
   word has 0x200, byte 2's 0x02. Water carries 0x200 as well; the flag that
   lets a swimmer or a flyer through is not a person's.

   Two things this page got wrong before: it tested the terrain and the
   placed props but not the terrain's faux props (the trees and rocks drawn
   on a square by its tile), and it let a door through only by an aspect
   test. The engine's door is a prop whose tile carries 0x20000000: when a
   step into it is refused, TActiveMonster's move (CanPMove) sends the prop
   Use -- method 9 -- and if its tile changes, as an opened door's does, the
   step is tried again. So a door, a curtain or a passthrough is walkable to
   a person unless it is locked, and a locked one is a wall: Use does
   nothing to it. The lock is the record's first data byte on a class that
   answers Lockable (52), as buildKeyLockIndex reads it.

   `blocked` keeps its old shape, a set of square keys, for the callers that
   read it; `doors` is every use-to-pass square with its frames. */
function buildPropBlockers(resid, m) {
  const key = resid + ':' + m.width;
  if (DERIVED.PROP_BLOCK && DERIVED.PROP_BLOCK.key === key) return DERIVED.PROP_BLOCK.set;
  const W = m.width, H = m.height;
  const word = new Uint32Array(W * H);
  const attrs = getTileAttributes(ARCHIVE) || [];
  const blocked = new Set();
  const doors = new Map();
  const locked = new Map();      // square -> lock id
  try {
    const faux = getFauxProps();
    const tiles = getPropTileList();
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = mapTileAt(m, x, y);
      let w = attrs[t] || 0;
      const fp = faux.get(t);
      if (fp && tiles[fp.proptype] !== undefined) w |= attrs[tiles[fp.proptype] + fp.aspect] || 0;
      word[y * W + x] = w;
    }
    const praw = getResourceBytes(ARCHIVE, resid + 0x100);
    if (praw) {
      const recs = parseDelverPropList(smartDecrypt(praw, resid + 0x100).data);
      const living = characterProptypes();
      for (const r of recs) {
        if (r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44) continue;
        if ((r.flags & 0x58) || living.has(r.proptype)) continue;
        // Only what the engine stages: the records its draw passes take,
        // flags & 0x9E clear or flagged 4 (enginePass). A portcullis raised
        // by its lever is a record with 0x80 set, and it is not there.
        if ((r.flags & 0x9E) && (r.flags & 0x44) !== 4) continue;
        const base = tiles[r.proptype];
        if (base === undefined) continue;
        const t = base + r.aspect;
        // Every square the prop covers, each by its own tile: a large prop
        // anchors bottom-right and its pieces are the tiles before it.
        const cells = [[r.x, r.y, t]];
        for (const pc of (multiTilePieces(t, r.rotated) || [])) cells.push([r.x + pc.dx, r.y + pc.dy, pc.tile]);
        for (const [cx, cy, ct] of cells) {
          if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
          word[cy * W + cx] |= attrs[ct] || 0;
        }
        if ((attrs[t] || 0) & 0x20000000) {
          const k = r.y * W + r.x;
          if (r.d1 && classHasMember(r.proptype, 52)) {
            locked.set(k, r.d1);
            doors.set(k, { placedAspect: r.aspect, openAspect: Math.max(0, r.aspect - 1), tileId: t, lock: r.d1 });
          } else if (r.aspect >= 1) doors.set(k, { placedAspect: r.aspect, openAspect: r.aspect - 1, tileId: t });
          else doors.set(k, { placedAspect: r.aspect, openAspect: r.aspect, tileId: t });
        }
      }
    }
    for (let i = 0; i < W * H; i++) {
      if (!(word[i] & 0x200)) continue;
      if ((word[i] & 0x20000000) && doors.has(i) && !locked.has(i)) continue;
      blocked.add(i);
    }
  } catch (e) { quiet(e); }
  DERIVED.PROP_BLOCK = { key, set: blocked, doors, word, locked };
  return blocked;
}
function propDoors() { return (DERIVED.PROP_BLOCK && DERIVED.PROP_BLOCK.doors) || new Map(); }

// Redraw, on the character overlay, any door someone currently occupies with
// its OPEN frame -- on top of whatever the static base map drew for it
// (always the door's placed/closed state). A door nobody stands in is left
// alone, so it reads as closed again the instant a character moves off it.
// The open frame is placedAspect - 1, matching the Door Script's
// `set_field 1 (field 1 sub 1)`; see buildPropBlockers for the full state
// table and for why the lock state is not knowable from the prop record.
// The World tab passes the doors and the width of the node it is drawing,
// having worked them out while that node's map was lent to the schedules,
// and where on its canvas the node's corner is.
function drawOpenDoors(ctx, TS, people, doors, W, ox = 0, oy = 0) {
  if (!doors) {
    const cm = window.CUR_MAP;
    if (!cm || !cm.m) return;
    doors = propDoors(); W = cm.m.width;
  }
  if (!doors.size || !W) return;
  const occupied = new Set(people.map(p => p.y * W + p.x));
  for (const [posKey, info] of doors) {
    if (!occupied.has(posKey)) continue;
    const dx0 = posKey % W, dy0 = (posKey - dx0) / W;
    const openTile = info.tileId - info.placedAspect + info.openAspect;
    const extra = multiTilePieces(openTile, 0);
    if (extra) for (const pc of extra) {
      drawTileAt(ctx, pc.tile, ox + (dx0 + pc.dx) * TS, oy + (dy0 + pc.dy) * TS, true, TS);
    }
    drawTileAt(ctx, openTile, ox + dx0 * TS, oy + dy0 * TS, true, TS);
  }
}

// --- walkability + pathfinding -------------------------------------------
// 0xF002 byte 2: 0x01 is-water, 0x02 blocks terrestrial movement. Verified
// against the archive: 1045 blocking tiles name out as snowcaps, ethereal
// void, Strange Device and creature tiles; 75 water tiles as water/shore.
// The map object carries offsets, not a decoded tile array.
function mapTileAt(m, x, y) {
  const d = m.raw;
  if (!d) return 0;
  const o = m.mapDataOffset + (x + y*m.width)*2;
  return u16be(d, o);
}
// getTileAttributes(ARCHIVE) returns one packed u32 per tile (b0<<24|b1<<16|b2<<8|b3),
// not raw bytes -- indexing it as bytes read only a quarter of the table and
// found almost nothing blocking, which is why characters walked through walls.
function tileAttrByte(tileId, which) {
  const a = getTileAttributes(ARCHIVE);
  if (!a || a[tileId] === undefined) return undefined;
  return (a[tileId] >>> ((3 - which) * 8)) & 0xFF;
}
function tilePassable(tileId) {
  const b2 = tileAttrByte(tileId, 2);
  if (b2 === undefined) return true;
  return !(b2 & 0x02) && !(b2 & 0x01);
}
const pathCache = derivedMap('pathCache');
/* A route, the way TPathFinder::FindPath finds one (22 September 2026).

   Not A*. The engine keeps a list of candidate squares sorted by one number,
   CalcWeight, which is the Manhattan distance from the square to the target
   and nothing else -- no cost of the way already walked -- and always
   expands the nearest. From a candidate it tries the eight directions in the
   engine's order (north first, clockwise), each through TGameSys::TryMove:
   an upright step needs its square open, and a diagonal needs its square
   AND the two squares beside the corner open, so nobody cuts a corner. A
   square is marked with the direction it was reached from and is never
   reached twice. When the target cannot be reached, the route goes to the
   nearest square it did reach, which is FindPath's own answer.

   Kept from the engine: the weight, the order, the corners, the fallback.
   Left out: its 31-square window round the view and its hundred-candidate
   list, both there because the engine walks one step at a time and only
   near the player. A greedy search is quick, so the 4,000-step cap this
   replaced -- after which a route became a straight line through the walls
   -- is gone.

   A locked door is a wall except to a walker carrying its key: the door's
   Use, which the move sends, opens it for the key's holder. `keys` is the
   set of lock ids the walker carries (keysCarriedBy), or nothing.

   Returns the squares from start to end; `.reached` says whether the end is
   the target. */
function findPath(m, x0, y0, x1, y1, keys) {
  const key = ((DERIVED.PROP_BLOCK && DERIVED.PROP_BLOCK.key) || '?') + ':' +
              x0+','+y0+','+x1+','+y1+','+m.width + (keys && keys.size ? ':' + [...keys].join('.') : '');
  if (pathCache.has(key)) return pathCache.get(key);
  const W = m.width, H = m.height, N = W * H;
  const done = r => { pathCache.set(key, r); return r; };
  if (x0 === x1 && y0 === y1) { const r = [[x0, y0]]; r.reached = true; return done(r); }
  // Either end off this map means the leg is not on it: a schedule's two
  // posts on another level were being routed across this one, and a start
  // outside the array never led the walk back to it.
  const inMap = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  if (!inMap(x0, y0) || !inMap(x1, y1)) { const r = [[x0, y0], [x1, y1]]; r.reached = false; return done(r); }
  const pb = (DERIVED.PROP_BLOCK && DERIVED.PROP_BLOCK.set) || new Set();
  const goal = y1 * W + x1;
  // The target itself is always enterable: a post can be a chair, a bed or
  // a counter, and the engine's own check at the end is the move routine's.
  const lk = (DERIVED.PROP_BLOCK && DERIVED.PROP_BLOCK.locked) || new Map();
  const open = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    const i = y * W + x;
    if (i === goal || !pb.has(i)) return true;
    return !!(keys && lk.has(i) && keys.has(lk.get(i)));
  };
  const DIRS = [[0,-1],[1,-1],[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1]];
  const came = new Int32Array(N).fill(-2);   // -2 unvisited, -1 the start
  const weight = (x, y) => Math.abs(x - x1) + Math.abs(y - y1);
  // A binary heap on (weight, order added), which is the engine's sorted
  // list: a new candidate goes after those of equal weight.
  const heap = []; let seq = 0;
  const push = (i, w) => { heap.push([w, seq++, i]); let k = heap.length - 1;
    while (k) { const p = (k - 1) >> 1; if (heap[p][0] < w || (heap[p][0] === w && heap[p][1] < heap[k][1])) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop();
    if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m_ = k;
      const lt = (a, b) => heap[a][0] < heap[b][0] || (heap[a][0] === heap[b][0] && heap[a][1] < heap[b][1]);
      if (l < heap.length && lt(l, m_)) m_ = l; if (r < heap.length && lt(r, m_)) m_ = r;
      if (m_ === k) break; [heap[m_], heap[k]] = [heap[k], heap[m_]]; k = m_; } }
    return top; };
  const start = y0 * W + x0;
  came[start] = -1; push(start, weight(x0, y0));
  let best = start, bestW = weight(x0, y0), reached = false;
  while (heap.length) {
    const [w, , cur] = pop();
    if (w < bestW) { bestW = w; best = cur; }
    if (cur === goal) { reached = true; best = cur; break; }
    const cx = cur % W, cy = (cur - cx) / W;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * W + nx;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H || came[ni] !== -2) continue;
      if (!open(nx, ny)) continue;
      if (dx && dy && (!open(cx + dx, cy) || !open(cx, cy + dy))) continue;
      came[ni] = cur;
      push(ni, weight(nx, ny));
    }
  }
  const path = [];
  for (let c = best; c !== -1; c = came[c]) path.push([c % W, (c - c % W) / W]);
  path.reverse();
  path.reached = reached;
  return done(path);
}

function setMapHour(h) {
  window.MAP_HOUR = ((+h % 24) + 24) % 24;
  window.MAP_TIME = window.MAP_HOUR;
  syncMapTimeControls();
  drawCharacterLayer();
  drawLighting();
  if (typeof atlasPaintFolk === 'function' && window.CUR_SUBN === 'WORLD') atlasPaintFolk();
}
function toggleCharacters(on) { window.SHOW_CHARACTERS = on; drawCharacterLayer(); }
function toggleCharNames(on) { window.SHOW_CHAR_NAMES = on; drawCharacterLayer(); }

/* Barks on the map (the maintainer's list, 22 September 2026).

   A bark is a line a script puts in a character's talk balloon
   (buildBarkCatalogue has every one). The ones drawn here are the lines a
   character's own conversation script gives it -- the vendors' cries,
   Alaric's "Yum", the diners calling for wine -- which is twelve people;
   the shared lines (sleep, hunger, a fight, a theft) are anyone's and wait
   on what happens, so they are not put on anybody. The game says a line
   when its script's condition comes round and keeps it up for the tick
   count TBark::SetBark adds; here each speaker holds one of its lines up
   for that long and then the next, so the map shows what each can say. The
   balloon is the size TBark::TBark makes it and its words the game's face
   at the size TBark uses (Argos at 14 in a 32 pixel square). With no
   application open neither figure is read: the balloon fits its words and
   stays on the first line. */
window.SHOW_BARKS = true;
function barksByCharacter() {
  if (DERIVED.BARKS_BY_CHAR) return DERIVED.BARKS_BY_CHAR;
  const by = new Map();
  try {
    for (const e of buildBarkCatalogue()) {
      if (e.who === null || e.who === undefined) continue;
      if (!by.has(e.who)) by.set(e.who, []);
      for (const w of e.words) if (!by.get(e.who).includes(w)) by.get(e.who).push(w);
    }
  } catch (e) { quiet(e, 'the barks by speaker'); }
  return (DERIVED.BARKS_BY_CHAR = by);
}
let _barkRules = { app: undefined, r: null };
function barkRulesRead() {
  const app = window.APP_PEF || null;
  if (_barkRules.app !== app) {
    let r = null;
    if (app) try { r = exeBarkRules(); } catch (e) { quiet(e, 'the balloon rules'); }
    _barkRules = { app, r };
  }
  return _barkRules.r;
}
// Which of a speaker's lines is up now: a new one every balloon's life.
function barkMillis() { const r = barkRulesRead(); return r && r.ticks ? r.ticks.v / 60 * 1000 : 0; }
function barkBucket() { const ms = barkMillis(); return ms ? Math.floor(Date.now() / ms) : 0; }
function toggleBarks(on) {
  window.SHOW_BARKS = !!on;
  for (const id of ['chkBarks']) { const el = document.getElementById(id); if (el) el.checked = !!on; }
  drawCharacterLayer();
  if (typeof atlasPaintFolk === 'function' && window.CUR_SUBN === 'WORLD') atlasPaintFolk();
}
/* The balloons over everybody in `people` who has lines of their own, on a
   canvas where a square is TS pixels and the map's corner is at (ox, oy).
   A rounded box with a tail down to the speaker, over the name. */
function drawBarks(ctx, people, TS, ox, oy) {
  const by = barksByCharacter();
  if (!by.size) return;
  const rules = barkRulesRead(), s = TS / 32, bucket = barkBucket();
  const fontPx = 14 * s;
  if (fontPx < 7) return;                         // too small to read
  ctx.save();
  ctx.font = canvasFace(Math.round(fontPx));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const c of people) {
    const lines = by.get(c.index);
    if (!lines || !lines.length) continue;
    // Staggered by speaker, so the town does not change its lines at once.
    const text = lines[barkMillis() ? (bucket + c.index) % lines.length : 0];
    // Two lines when one would not fit, broken at the space nearest the middle.
    let rows = [text];
    const maxW = rules && rules.width ? rules.width.v * s - 8 * s : Infinity;
    if (ctx.measureText(text).width > maxW && text.includes(' ')) {
      let best = -1;
      for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - text.length / 2) < Math.abs(best - text.length / 2))) best = i;
      rows = [text.slice(0, best), text.slice(best + 1)];
    }
    const textW = Math.max(...rows.map(t => ctx.measureText(t).width));
    const bw = rules && rules.width ? rules.width.v * s : textW + 12 * s;
    const bh = rules && rules.height ? rules.height.v * s : (rows.length * 12 + 8) * s;
    const cx = ox + ((c.fx !== undefined ? c.fx : c.x) + (c.nudgeX || 0)) * TS + TS / 2;
    const top = oy + ((c.fy !== undefined ? c.fy : c.y) + (c.nudgeY || 0)) * TS - TS * 0.55 - bh;
    const x = Math.round(cx - bw / 2), y = Math.round(top), rr = 8 * s, tail = 5 * s;
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.lineTo(x + bw - rr, y);
    ctx.quadraticCurveTo(x + bw, y, x + bw, y + rr);
    ctx.lineTo(x + bw, y + bh - rr);
    ctx.quadraticCurveTo(x + bw, y + bh, x + bw - rr, y + bh);
    ctx.lineTo(cx + 4 * s, y + bh);
    ctx.lineTo(cx, y + bh + tail);
    ctx.lineTo(cx - 4 * s, y + bh);
    ctx.lineTo(x + rr, y + bh);
    ctx.quadraticCurveTo(x, y + bh, x, y + bh - rr);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.closePath();
    ctx.fillStyle = '#efeade';
    ctx.fill();
    ctx.lineWidth = Math.max(1, s);
    ctx.strokeStyle = '#2a2419';
    ctx.stroke();
    ctx.fillStyle = '#2a2419';
    const lineH = 12 * s, first = y + bh / 2 - (rows.length - 1) * lineH / 2 + fontPx * 0.35;
    rows.forEach((t, i) => ctx.fillText(t, Math.round(cx), Math.round(first + i * lineH)));
  }
  ctx.restore();
}

// Position at a continuous time: characters spend the first stretch of each
// schedule interval walking the A* route to their next post, then stand there.
// One frame of "walk the day" advances the clock by this much at 1x, matching
// the interval in startMapAnimation. A walk is timed off it so that at 1x a
// character advances exactly one square per frame: the route used to be
// squeezed into a fixed half-hour regardless of length, so a forty-square walk
// at 1x teleported the walker a square and a half at a time.
const MAP_TICK_HOURS = 0.02;

// The lock ids a character carries keys to, off the key index.
function keysCarriedBy(ci) {
  if (!DERIVED.KEYS_BY_HOLDER) {
    const by = new Map();
    try { for (const k of buildKeyLockIndex().keys) if (k.rec.carriedBy !== null && k.rec.carriedBy !== undefined) {
      if (!by.has(k.rec.carriedBy)) by.set(k.rec.carriedBy, new Set());
      by.get(k.rec.carriedBy).add(k.id);
    } } catch (e) { quiet(e); }
    DERIVED.KEYS_BY_HOLDER = by;
  }
  return DERIVED.KEYS_BY_HOLDER.get(ci) || null;
}
function walkingPosition(entries, t, m, keys) {
  const real = entries.filter(e => e.mode !== 0);
  if (!real.length) return null;
  let cur = null, curIdx = -1;
  for (let i = 0; i < real.length; i++) if (real[i].hour <= t) { cur = real[i]; curIdx = i; }
  if (!cur) { cur = real[real.length-1]; curIdx = real.length-1; }
  const nxt = real[(curIdx + 1) % real.length];
  if (!nxt || nxt === cur || nxt.level !== cur.level) return { e: cur, x: cur.x, y: cur.y };
  let span = nxt.hour - cur.hour;
  if (span <= 0) span += 24;
  let dt = t - cur.hour;
  if (dt < 0) dt += 24;
  if (!m) return { e: cur, x: cur.x, y: cur.y };
  // Routed only on the map it is on; elsewhere the posts are all that matter.
  if (window.CUR_MAP && window.CUR_MAP.level !== undefined && cur.level !== window.CUR_MAP.level) return { e: cur, x: cur.x, y: cur.y };
  buildPropBlockers(window.CUR_MAP ? window.CUR_MAP.resid : 0, m);
  const path = findPath(m, cur.x, cur.y, nxt.x, nxt.y, keys);   // findPath caches
  const squares = Math.max(1, path.length - 1);
  // Long enough for one square per frame at 1x, and never longer than the
  // interval itself -- so they still arrive at the next post on the hour, and
  // still stand at the old one until it is time to leave.
  // One square per MAP_TICK_HOURS, as before: the smoothing is in the
  // animation timer, which now ticks four times per square and draws the
  // fractional position (fx, fy) below. Making the walk itself four times
  // longer was tried first and broke the seating -- a long walk then filled
  // the whole interval, so Magpie left her chair the moment she reached it.
  const travel = Math.min(span, squares * MAP_TICK_HOURS);
  const startWalk = span - travel;
  if (dt < startWalk) return { e: cur, x: cur.x, y: cur.y };
  const f = Math.min(1, (dt - startWalk) / travel);
  const pos = Math.min(squares, f * squares);
  const i = Math.min(path.length - 1, Math.floor(pos));
  const frac = Math.min(1, pos - i);
  const nxtPt = path[Math.min(path.length - 1, i + 1)];
  const dx = nxtPt[0] - path[i][0], dy = nxtPt[1] - path[i][1];
  // Row layout (confirmed): 0=N, 1=E, 2=S, 3=W. y increases southward.
  let dir = 2;
  if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 1 : 3;
  else if (dy !== 0) dir = dy > 0 ? 2 : 0;
  // x,y stay the square (seats, the inspector and deconfliction key on it);
  // fx,fy are where to draw.
  return { e: cur, x: path[i][0], y: path[i][1],
           fx: path[i][0] + dx * frac, fy: path[i][1] + dy * frac,
           walking: true, dir, step: Math.floor(pos * 2), path, i };
}

/* ---------------------------------------------------------------------------
   Sitting
   ---------------------------------------------------------------------------
   Column 3 of a character's sprite sheet is the seated pose -- the walk cycle
   only uses columns 0-2 -- and it was never drawn, so everyone stood to
   attention on top of the chair they are scheduled to be sitting in.

   Which way the chair faces is read off the aspect, and the mapping is no
   longer read off the artwork -- it is measured, twice, and the two agree.

   1. Chairs are placed with their backs to walls. Over every prop list in the
      archive, taking only the chairs with exactly one blocking neighbour
      (n=180): aspect 0 has a wall to the north 30 times against 2/8/3 for the
      other three sides, aspect 1 has one to the east 26 against 0/2/13,
      aspect 2 to the south 20 against 1/5/1, and aspect 3 to the west 24
      against 10/2/3. Back to the wall means facing away from it, which gives
      aspect 0 -> south, 1 -> west, 2 -> north, 3 -> east.

   2. The wiki's Save Format page prints a saved game taken "standing in
      Alaric's throne room". Alaric's record there is
      `03 02 90 0c 2c 22 ...`: zone 3 (Land King Hall), xy24 02 90 0c =
      (41, 12) -- which is the throne square in this archive's own prop list --
      and the aspect/proptype word 0x2C22, which unpacks to proptype 0x22
      (king) at ASPECT 11. The throne is placed at aspect 0. So aspect 0 seats
      a person in sprite frame 11: row 2, column 3. That single record fixes
      three separate things at once -- that column 3 is the seated pose, that
      row 2 is facing south, and that a chair at aspect 0 faces south -- and
      all three are what this file already computed.

   What the aspect does NOT survive is a seat with fewer than four frames of
   its own. Prop type 227's block holds two, so `aspect & 3` was inventing a
   four-way facing out of a two-way field; and prop type 12's block runs on
   into an end table at frame 4, so an aspect past the chair's own name run is
   not a chair aspect at all. Those fall back to the placement itself: a seat
   with exactly one blocking neighbour faces away from it, and one with none is
   left facing the reader and says so.
--------------------------------------------------------------------------- */
// ...but the throne's single frame turned out to be the exception, not the
// rule. That record proves aspect 0 of a ONE-frame seat means south -- it
// cannot say anything about the cycle order of a four-frame chair, and
// generalising it to [S,W,N,E] sat every four-frame diner with their back to
// their dinner. The chairs themselves settle it: across the five town maps,
// 126 chairs sit beside exactly one table, and a diner faces the table.
// Tallied per aspect (both the wooden pt-12 chair and the red pt-220 one):
// aspect 0 has its table north 32:1, aspect 1 east 41:2, aspect 2 south 40:0,
// aspect 3 west 33:1. Four-frame chair aspects are simply the sprite facing
// order, N/E/S/W -- identity, no table needed.
/* How the program seats a character, read off TViewer::InteractProps on
   19 September 2026 (exeSeatRule, which holds these constants to the
   routine when the application is open): a seat is a class with a Chair
   member, and the sitter's aspect becomes the seat's own aspect times four
   plus three when the Chair word is 0 -- the seat's aspect is the facing
   and column three is the seated pose -- or one of four fixed frames, 3,
   7, 11 and 15, north, east, south and west, when the word is 1 to 4. Only
   a four-way sprite is seated: the sitter's class must carry 4 as the
   first word of key 55. The throne's word is 3, south, which is the
   frame the wiki's saved game shows Alaric in; the two chairs' words are
   0. `CHAIR_FACING`, a tally of one-frame seats against tables, stood here
   and is not needed: no one-frame seat with a word of 0 is placed. */
const SEAT_FIXED = [SPR_N, SPR_E, SPR_S, SPR_W];
function seatChairWord(pt) {
  const cls = parseItemClass(pt);
  const f = cls && cls.data.find(x => x.key === 34);
  return f && f.words.length && (f.words[0] & 0xF0000000) === 0 ? (f.words[0] & 0x0FFFFFFF) : null;
}
// A seat is a class with a Chair member (34), the file's own word; the
// four-entry set this replaced counted prop type 227, which has no class
// table at all, and so is not a chair to the program either.
const isSeatProp = pt => classHasMember(pt, 34);
// How many frames of its own a seat prop has, so an aspect can be told from an
// index that has run off the end of the chair and into the next thing on the
// sheet.
function seatOwnFrames(pt) {
  const base = getPropTileList()[pt];
  if (base === undefined) return 0;
  return framesSharingName(base, spriteFrameInfo(0, pt).present).length;
}

function seatsOnMap(resid, m) {
  const key = resid + ':' + (m ? m.width : 0);
  if (DERIVED.MAP_SEATS && DERIVED.MAP_SEATS.key === key) return DERIVED.MAP_SEATS.map;
  const seats = new Map();
  try {
    const praw = getResourceBytes(ARCHIVE, resid + 0x100);
    if (praw && m) {
      const recs = parseDelverPropList(smartDecrypt(praw, resid + 0x100).data);
      // Blocking squares, for the fallback below. Same test the walkability
      // check uses: attribute byte 2, bit 0x02.
      const tiles = getPropTileList(), attrs = getTileAttributes(ARCHIVE);
      const blocked = new Set();
      for (const r of recs) {
        if (r.flags === 0xFF || (r.flags & 0x58)) continue;
        const b = tiles[r.proptype];
        if (b === undefined) continue;
        if (((attrs[b + r.aspect] || 0) >> 8) & 0x02) blocked.add(r.x + ',' + r.y);
      }
      const solid = (x, y) => (x < 0 || y < 0 || x >= m.width || y >= m.height) ||
        blocked.has(x + ',' + y) || !tilePassable(mapTileAt(m, x, y));
      // Every square a table occupies, pieces included -- tables are
      // multi-square and anchor bottom-right, so testing only the record's
      // square missed a chair beside the table's left half.
      const tableAt = new Set();
      for (const r of recs) {
        if (r.flags === 0xFF || (r.flags & 0x58) || r.flags === 0x42 || r.flags === 0x44) continue;
        if (!/table|desk/.test((propTypeName(r.proptype) || '').toLowerCase())) continue;
        tableAt.add(r.x + ',' + r.y);
        const t = (tiles[r.proptype] || 0) + r.aspect;
        for (const pc of (multiTilePieces(t, r.rotated) || []))
          tableAt.add((r.x + pc.dx) + ',' + (r.y + pc.dy));
      }
      for (const r of recs) {
        if (r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44) continue;
        if (!isSeatProp(r.proptype)) continue;
        const own = seatOwnFrames(r.proptype);
        const word = seatChairWord(r.proptype);
        // The program's rule (see SEAT_FIXED): a Chair word of 1 to 4 is a
        // fixed facing; a word of 0 takes the seat's aspect, which is a
        // facing where the seat has the frames to hold one. An aspect past
        // the seat's own frames is drawn by the program as whatever frame
        // that is, and is left to the placement here.
        const aspectIsFacing = (word >= 1 && word <= 4) || (word === 0 && own >= 4 && r.aspect < own);
        let face = null, why = '';
        if (aspectIsFacing) {
          face = (word >= 1) ? SEAT_FIXED[word - 1] : (r.aspect & 3);
          why = word >= 1 ? 'the class’s Chair word, ' + word : 'aspect ' + r.aspect;
          // A rotated chair is the transposed image, and transposing swaps
          // north with west and south with east.
          if (r.rotated) {
            face = { [SPR_N]: SPR_W, [SPR_W]: SPR_N, [SPR_S]: SPR_E, [SPR_E]: SPR_S }[face];
            why += ', rotated';
          }
        } else {
          // Not a four-way aspect. A chair beside a table faces the TABLE --
          // the old rule treated the table as "a wall behind it" and turned
          // every diner to face away from their dinner. Only when no table
          // is adjacent does the wall-behind rule apply.
          const tables = [[0, -1, SPR_N], [1, 0, SPR_E], [0, 1, SPR_S], [-1, 0, SPR_W]]
            .filter(([dx, dy]) => tableAt.has((r.x + dx) + ',' + (r.y + dy)));
          const walls = [[0, -1, SPR_S], [1, 0, SPR_W], [0, 1, SPR_N], [-1, 0, SPR_E]]
            .filter(([dx, dy]) => solid(r.x + dx, r.y + dy));
          if (tables.length) { face = tables[0][2]; why = 'faces the table beside it'; }
          else if (walls.length === 1) { face = walls[0][2]; why = 'wall behind it'; }
          else { face = SPR_S; why = 'not known, this seat has ' + own +
                   ' frame' + (own === 1 ? '' : 's') + ', so its aspect does not give one of four directions, ' +
                   'and nothing behind it shows which way it faces'; }
        }
        // Two chairs on one square (Cademia's Thuria has one of each class
        // under her): the one whose aspect is a facing says which way she
        // sits, and a guess must not overwrite it (9 September 2026).
        const had = seats.get(r.x + ',' + r.y);
        if (had && had.certain && !aspectIsFacing) continue;
        seats.set(r.x + ',' + r.y, { face, why, proptype: r.proptype, aspect: r.aspect,
                                     certain: aspectIsFacing });
      }
    }
  } catch (e) { quiet(e); }
  DERIVED.MAP_SEATS = { key, map: seats };
  return seats;
}

function charactersOnLevel(level, hour) {
  const scheds = loadSchedules(), chars = loadCharacterTable();
  const props = getPropTileList();
  const out = [];
  const m = window.CUR_MAP && window.CUR_MAP.m;
  const seats = (window.CUR_MAP && m) ? seatsOnMap(window.CUR_MAP.resid, m) : null;
  for (let i = 0; i < scheds.length; i++) {
    const w = walkingPosition(scheduleDay(i), hour, m, keysCarriedBy(i));
    const e = w && w.e;
    if (!e || e.level !== level) continue;
    const c = chars[i];
    if (!c) continue;
    const base = props[c.proptype];
    if (base === undefined) continue;
    // A sheet is 4 facings x 4 poses. While walking, face the direction of
    // travel and cycle the pose so they stride rather than slide.
    let aspect = c.aspect;
    let sitting = null;
    if (w.walking && w.dir !== undefined) {
      // Column layout: 0=left-foot-forward, 1=standing, 2=right-foot-forward,
      // 3=sitting (not used while walking). Confirmed by the saved game quoted
      // above seatsOnMap: Alaric on the throne is frame 11, row 2 column 3. A real
      // gait alternates contact poses through the neutral stance rather than
      // stepping 0,1,2,3 in order.
      const GAIT = [1, 0, 1, 2];
      const pose = GAIT[w.step % 4];
      aspect = (w.dir & 3) * 4 + pose;
    } else if (seats && seats.size) {
      // Standing still on a chair means sitting in it, facing the way it does.
      const seat = seats.get(w.x + ',' + w.y);
      if (seat) { aspect = seat.face * 4 + SPR_REST; sitting = seat; }
    }
    out.push({ index: i, name: characterName(i), x: w.x, y: w.y, mode: e.mode,
               fx: w.fx !== undefined ? w.fx : w.x, fy: w.fy !== undefined ? w.fy : w.y,
               walking: !!w.walking, dir: w.dir, sitting: !!sitting,
               seat: sitting || null, path: w.path || null, pi: w.i,
               proptype: c.proptype, aspect, base, tile: base + aspect });
  }
  keepApart(out);
  return out;
}
/* Nobody walks into a square somebody is standing in (the maintainer,
   22 September 2026). The engine's stage marks the living, so a step into
   one is refused and the walker tries again next turn. Here the people who
   are standing are placed first; a walker whose square is taken steps back
   along its own route to the last square that is free, and stands there
   facing the way it was going. Two people scheduled to the same post still
   share it, which deconflictPositions draws side by side. */
function keepApart(people) {
  const taken = new Set();
  for (const c of people) if (!c.walking) taken.add(c.x + ',' + c.y);
  for (const c of people) {
    if (!c.walking || !c.path) continue;
    let i = c.pi;
    while (i > 0 && taken.has(c.path[i][0] + ',' + c.path[i][1])) i--;
    if (i !== c.pi) {
      c.x = c.path[i][0]; c.y = c.path[i][1]; c.fx = c.x; c.fy = c.y;
      c.aspect = ((c.dir || 0) & 3) * 4 + 1;
      c.tile = c.base + c.aspect;
    }
    taken.add(c.x + ',' + c.y);
  }
}

// Resource 0x0101 is a `table` of 127 entries whose values are drefs to name
// strings. The keys are NOT resource IDs, whatever they look like: the wiki's
// subindex 0 page rejects that reading directly. There is no resource 0x0200
// (the tile names it claims to name are in F004), 0x0202 does not exist
// either, and the 16xx/17xx keys are not valid resource IDs for Cythera Data
// at all. That page's conclusion is that 0x0101 is stale debugging symbol
// data, out of date with the shipped game -- 0x3028 "Draw" names a resource
// that no longer exists, and the 30xx keys do not match the method keys those
// same methods actually use (UseOn is 0x3004 here but method 0x000A in
// objects). Treated here as a best-effort naming hint, read from the data
// rather than hardcoded, and never as authority about what a resource is.
// The table itself is loadResourceSymbols in js/delv-script.js, built per
// archive and handed to the disassembler by parseArchiveBytes.
/* The render, whole, for every caller that wants it now: the zone panel,
   the hover card, the PNG export. It runs renderMapVisualSteps to the end,
   so what it draws is exactly what the steps draw. */
function renderMapVisual(resid, mapData, opts) {
  const g = renderMapVisualSteps(resid, mapData, opts);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
/* The same render as a generator that pauses after each row of terrain, so
   the World tab can spread a zone's render over several frames
   (atlasRenderStep). The terrain pass is a square at a time and is most of
   the cost: Cademia, 128 squares a side, took about 180 ms in one piece
   in Chrome with the processor slowed fourfold, the jerk the maintainer
   felt as a big town grew past its miniature (25 September 2026, on a
   phone and on an M1 laptop). It pauses after each row of terrain and
   after every 256 pieces of the prop pass. The prop pass logs what it
   draws into window.__MAP_BLIT_LOG, which drawTileAt writes to whoever
   calls it, so at each of its pauses the log is set aside and put back. */
function* renderMapVisualSteps(resid, mapData, opts) {
  const m = parseDelverMap(mapData);
  if (m) m.raw = mapData;
  if (!m) return null;
  // iOS/Safari refuses canvases above roughly 16.7 megapixels (and will
  // tear down the tab when one is then interacted with). A 256x256 world
  // map at the native 32px tile size would be 8192x8192 = 67 MP, which is
  // what crashed the world map. Shrink the per-tile size for large maps so
  // the backing canvas always stays under the limit.
  // iOS tears the tab down well below its nominal canvas ceiling once a big
  // layer is also being transformed, which is what made panning crash.
  //
  // And 6 MP was still too much there: this base canvas is one of up to five
  // full-map layers (characters, roofs, marks, lighting stack over it), so
  // the world map held ~120 MB of backing store and WebKit killed the tab --
  // every iOS browser is WebKit, which is why "Chrome on iOS" crashed too.
  // On iOS the budget drops to 2.2 MP per layer and the layers below deflate
  // to zero when their toggle is off. Detail does not suffer for it: the
  // detail lens (paintDetailLens) re-renders the visible window at the
  // native 32px tile size whenever the map is zoomed in, on every platform
  // -- which is also what finally shows the 256x256 world map at full
  // detail on desktop, where the budget alone had capped it at TS=8.
  /* The canvas budget: the world map at this many pixels fits every browser
     that has been tried. A "full resolution" opt-in that raised it to 70 MP
     on able desktops was offered from 9 to 10 September 2026 and removed
     at the maintainer's word: the mip levels and the render cache fix of
     v1.37.1 made the ordinary budget smooth and sharp without it. */
  const MAX_CANVAS_PX = IS_IOS_WEBKIT ? 2.2e6 : 6e6;
  let TS = 32;
  if (opts && opts.forceTS) TS = opts.forceTS;   // downloadMapPNG: the file, not the screen
  else while (TS > 4 && (m.width * TS) * (m.height * TS) > MAX_CANVAS_PX) TS -= 4;
  const canvas = document.createElement('canvas');
  canvas.width = m.width * TS;
  canvas.height = m.height * TS;
  canvas.style.imageRendering = 'pixelated';
  canvas.style.background = '#333';
  canvas.style.display = 'block';
  // Margin zero, and it has to be. This canvas goes into #mapCanvasWrap as
  // the only child in normal flow; every other layer over it (characters,
  // roofs, marks, lighting), the detail lens, mapSquareFromClient's hit test,
  // clampMapPan and fitMapToView all place tile (tx,ty) at (tx*TS, ty*TS)
  // from the wrap's own origin. A leftover `10px auto` from when maps were
  // rendered inline put the terrain -- and only the terrain -- 10px below
  // that origin, since the wrap is absolutely positioned and so does not let
  // the margin collapse out of it. At 1:1 that is a slightly low map; at the
  // zoom the detail lens engages at it is 10*scale, which is what made the
  // sharp window look shifted against the blurry base underneath it.
  canvas.style.margin = '0';
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // The backdrop, where the zone has one, under everything; the squares
  // that show it are collected so the animation loop can swap its frames.
  const backdrop = zoneBackdrop(resid & 0xFF);
  const backdropCells = [];
  if (backdrop) {
    const pat = backdropPattern(ctx, backdrop[0], TS);
    if (pat) { ctx.fillStyle = pat; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  }

  // Draw base terrain tiles. Always opaque -- see drawTileAt comment. Each
  // one may carry a faux prop (0xF010), drawn immediately on top of it, which
  // is where the cave walls, trees, shrubs and mountains come from.
  const faux = getFauxProps();
  const fauxTiles = getPropTileList();
  const fauxDrawn = [];
  const fauxLate = [];      // drawn after the records: see the draw order below
  // Squares whose wall was suppressed by the Walls toggle. They are hatched at
  // the end so the floor plan is readable without the reader forgetting that
  // nobody can walk there.
  const suppressed = [];
  // Building walls in the towns are TERRAIN, not props -- Odemia's houses
  // are tiles named "wall" and "window" with nothing underneath -- so the
  // Walls toggle used to leave every town building standing. There is no
  // floor to reveal under a terrain wall; a dark placeholder plus the same
  // hatching the prop walls get says "solid, drawn through" honestly.
  const wallTileMemo = new Map();
  const terrainWall = (t) => {
    let v = wallTileMemo.get(t);
    if (v === undefined) {
      const nm = (terrainNameFor(t) || '').toLowerCase();
      v = /(^|\s)wall$|(^|\s)window$/.test(nm);
      wallTileMemo.set(t, v);
    }
    return v;
  };
  for (let y=0; y<m.height; y++) {
    for (let x=0; x<m.width; x++) {
      const off = m.mapDataOffset + (x + y*m.width)*2;
      const tileId = u16be(mapData, off);
      if (!window.MAP_WALLS && terrainWall(tileId)) {
        ctx.fillStyle = '#151515';
        ctx.fillRect(x*TS, y*TS, TS, TS);
        suppressed.push([x, y]);
        continue;
      }
      if (backdrop && tileHasTransparency(tileId)) {
        // Over the backdrop rather than over black, and remembered.
        drawTileAt(ctx, tileId, x*TS, y*TS, true, TS);
        backdropCells.push([x, y, tileId]);
      } else drawTileAt(ctx, tileId, x*TS, y*TS, false, TS);
      const fp = faux.get(tileId);
      if (fp) fauxDrawn.push([x, y, fp]);
    }
    yield;
  }
  // Everything from here to the end of the prop pass is logged, so the
  // animation loop can repaint the art that overlaps animated water. See
  // drawTileAt.
  const blitLog = [];
  window.__MAP_BLIT_LOG = blitLog;
  // In a second pass so a faux prop is never clipped by the terrain tile of
  // the square below it -- the sprites are authored to overhang.
  for (const [x, y, fp] of fauxDrawn) {
    const base = fauxTiles[fp.proptype];
    if (base === undefined) continue;
    // Cave walls are faux props, not prop-list records, which is why turning
    // the walls off used to do nothing at all on Land King Hall: every wall on
    // that map is rock face drawn by the terrain tile. The world map's trees,
    // shrubs and mountains are faux props too and are NOT walls, so the test
    // is on the prop type, not on being a faux prop.
    if (!window.MAP_WALLS && isWallLikeProp(fp.proptype)) { suppressed.push([x, y]); continue; }
    const [ox, oy] = propOffsetFor(fp.proptype, fp.aspect, fp.rotated);
    fauxLate.push([x, y, base + fp.aspect, fp.rotated, ox, oy]);
  }

  // Draw props on top, if the matching Prop List resource exists. Prop
  // Lists are binary structured data and must NOT be run through the
  // speculative decryptor (see DELV_CLEAR_SUBN) -- doing so scrambled
  // the packed 12-bit x/y fields and pushed every prop off the map.
  const propResid = resid + 0x0100;
  const propDataRaw = getResourceBytes(ARCHIVE, propResid);
  let propCount = 0;
  // Every record, drawn or not. The ones that are NOT drawn are the
  // interesting half: 990 of the archive's prop records are inside a chest, a
  // dresser or somebody's pack rather than on the floor.
  let allRecs = [];
  // Which prop ended up on which square, kept so a click on the map can say
  // what it landed on. The prop list is the richest structured data in the
  // archive and it used to be drawn and then thrown away.
  const drawnProps = [];
  let drawOps = [];
  if (propDataRaw) {
    const { data: propData } = smartDecrypt(propDataRaw, propResid);
    const recs = parseDelverPropList(propData);
    allRecs = recs;
    const propTiles = getPropTileList();
    const attrs = getTileAttributes(ARCHIVE);
    const visible = [];
    for (const r of recs) {
      // Ported from delv/level.py PropListEntry.show_in_map(): hide deleted
      // entries (flags==0xFF) and anything with flags & 0x58 set (inside a
      // container/inventory, so not drawn on the map itself).
      if (r.flags === 0xFF) continue;
      // delvmod's show_in_map() is commented "This is probably wrong - many
      // details yet to be determined. FIXME", and it is. Characters are never
      // inventory contents, so the container test is applied only to
      // non-character props. That divergence has now been measured across all
      // 40 maps and 14,485 prop records:
      //
      //   * the two rules agree on 14,370 records,
      //   * 115 are shown here and hidden by delvmod; none goes the other way,
      //     so this rule is a strict superset and can only add people,
      //   * for 111 of those 115, no scheduled character ever stands on or
      //     beside that square at any hour -- the prop record is the only
      //     thing placing them, and delvmod's rule would empty Land King
      //     Hall's throne room (21 records) and 37 spots in Cademia.
      //
      // The 115 carry flags 0x08/0x09 (60 records, never scheduled) or
      // 0x42/0x44 (55 records, 4 of which do coincide with a schedule and may
      // therefore be drawn twice). utilities/delv_crosscheck.mjs re-measures
      // this every run.
      // ...but flags 0x42 and 0x44 are not people at all. delvmod's
      // proptypename_with_flags names them EGG and ROOF and refuses to read
      // their proptype, and it is right to: the 0x44 records are roof-block
      // placements whose "proptype" is a block index (see drawRoofLayer), and
      // 55 of them happened to have an index that also names a character, so
      // this exemption was drawing 28 roofs and 27 eggs as people standing on
      // the map. Roofs now have their own layer and their own toggle.
      if (r.flags === 0x42 || r.flags === 0x44) continue;
      if ((r.flags & 0x58) && !characterProptypes().has(r.proptype)) continue;
      /* What the engine's passes never draw (enginePass): a record with any
         of flags 0x9E set, unless it is flagged 4. On the maps that is 0x02,
         the hidden traps -- loose rock, spikes, fine wire -- and 0x80, what
         is down or not there yet: the twelve raised portcullises, the
         boulders and the stretches of shore, wall and stepping stone a
         script brings in. They were all drawn until 22 September 2026, so a
         raised portcullis stood across its gate. The square's panel still
         lists them. The living are exempt, as above. */
      if ((r.flags & 0x9E) && (r.flags & 0x44) !== 4 && !characterProptypes().has(r.proptype)) continue;
      if (r.x >= m.width || r.y >= m.height) continue;
      // Interior walls are props, not terrain, on most indoor maps. Hiding
      // them is the indoor equivalent of lifting the roof: the floor plan,
      // the furniture and who is standing where all become visible at once.
      if (!window.MAP_WALLS && isWallLikeProp(r.proptype)) { suppressed.push([r.x, r.y]); continue; }
      const baseTile = propTiles[r.proptype];
      if (baseTile === undefined) continue;
      visible.push(r);
    }
    // Draw order: the records in the order the prop list keeps them, which
    // is the order delvmod's draw_order() yields and the one the engine
    // walks; then the faux props the terrain carries, after every record,
    // as the engine adds them to the list at load. It was rows of squares
    // with a priority sort within a square, and faux props before every
    // record, until 9 September 2026, when the maintainer showed two
    // corners of Cademia it got wrong: a pillar at (62,51) drawn over the
    // terrain-tile tree at (63,52), and the pool at (61,58), a later row,
    // drawn over the pillar at (62,57), an earlier record. List order and
    // faux-last put both the way he expects. The priority mask
    // (attributes & 0xBFCDFD1C) that ordered a square is not used now.
    // Since 22 September 2026 that order holds only within one of the
    // engine's passes (enginePass, above): the passes are drawn one after
    // another over the whole map.
    /* Since 23 September 2026, as TViewer::Render does it: every square
       of a prop in the pass of its own tile (propPieceList), and within a
       pass the records LAST FIRST, then the faux props row by row. Render
       walks its list from the end, and the list is the faux props, last
       made first, then the records in the prop array's order, which is the
       file's. Multi-square props (large creatures, beds, tables, trees)
       store only their bottom-right square in the prop record; the
       remaining squares are the immediately preceding tile indices. */
    const living = characterProptypes();
    const ops = [];
    visible.forEach((r, i) => {
      const tileId = propTiles[r.proptype] + r.aspect;
      const alive = living.has(r.proptype);
      const [ox, oy] = propOffsetFor(r.proptype, r.aspect, r.rotated);
      const d = { rec: r, tileId, cells: [], propResid, pass: enginePass(tileId, r.flags, alive), i };
      for (const pc of propPieceList(tileId, r.rotated)) {
        const x = r.x + pc.dx, y = r.y + pc.dy;
        if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
        d.cells.push([x, y]);
        ops.push({ d, x, y, tile: pc.tile, ox, oy, pass: enginePass(pc.tile, r.flags, alive), k: -i });
      }
      drawnProps.push(d);
      propCount++;
    });
    fauxLate.forEach(([fx, fy, t, rot, ox, oy], j) => {
      for (const pc of propPieceList(t, rot)) {
        const x = fx + pc.dx, y = fy + pc.dy;
        if (x < 0 || y < 0 || x >= m.width || y >= m.height) continue;
        ops.push({ x, y, tile: pc.tile, rot, ox, oy, pass: enginePass(pc.tile, 0, false), k: visible.length + j });
      }
    });
    // Stable, so a prop's own squares keep the corner-first order.
    ops.sort((a, b) => (a.pass - b.pass) || (a.k - b.k));
    let drawn = 0;
    for (const op of ops) {
      drawPropPiece(ctx, TS, op.x, op.y, op.tile, op.d ? op.d.rec.rotated : op.rot, op.ox, op.oy);
      // A pause between pieces sets the log aside, so a paint made while
      // this render waits (the world's, the zone panel's) logs nothing into
      // it, and puts it back before the next piece.
      if (++drawn % 256 === 0) { window.__MAP_BLIT_LOG = null; yield; window.__MAP_BLIT_LOG = blitLog; }
    }
    // The records' squares in the order they were drawn, for the region
    // painter and for what a square's marks call hidden.
    drawOps = ops.filter(op => op.d);
    // One entry a prop, in the order its corner was drawn.
    drawnProps.sort((a, b) => (a.pass - b.pass) || (b.i - a.i));
  } else {
    for (const [x, y, t, rot, ox, oy] of fauxLate) drawPropAt(ctx, TS, x, y, t, rot, ox, oy, m.width, m.height);
  }
  // Hatch whatever the Walls toggle took away. Diagonal strokes rather than a
  // flat wash: a wash reads as a highlight, and this is the opposite -- the
  // square is still solid, it is just being drawn through.
  if (suppressed.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,175,130,.42)';
    ctx.lineWidth = Math.max(1, TS / 20);
    for (const [x, y] of suppressed) {
      const px = x * TS, py = y * TS;
      ctx.beginPath();
      for (let k = -TS; k < TS; k += Math.max(3, TS / 4)) {
        ctx.moveTo(px + Math.max(0, k), py + Math.max(0, -k));
        ctx.lineTo(px + Math.min(TS, k + TS), py + Math.min(TS, TS - k));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190,175,130,.22)';
      ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
      ctx.strokeStyle = 'rgba(190,175,130,.42)';
    }
    ctx.restore();
  }

  // Cells whose terrain tile uses palette-animated colours. Only these get
  // repainted each frame, so a 64x64 map animates without re-rendering.
  const animCells = [];
  for (let ty = 0; ty < m.height; ty++) {
    for (let tx = 0; tx < m.width; tx++) {
      const o = m.mapDataOffset + (tx + ty*m.width)*2;
      const t = u16be(mapData, o);
      if (t && tileIsAnimated(t)) animCells.push([tx, ty, t]);
    }
  }
  // The blits (faux props and props, in draw order) that overlap an animated
  // cell. Repainting an animated water tile is opaque, so anything drawn
  // over it -- Land King Hall's tide-pool rim and shore, most visibly -- was
  // being erased 7 times a second and existed only for the one frame after a
  // full re-render. The animation loop replays these after the water, in the
  // same order they were first drawn.
  const blits = window.__MAP_BLIT_LOG || [];
  window.__MAP_BLIT_LOG = null;
  // A square a fountain or a flag stands on is repainted with the water: a
  // frame of it drawn over the last would leave the last showing through
  // its transparent pixels, so the floor goes down first and everything
  // drawn on the square is replayed over it (tileAnimTable).
  const animTable = tileAnimTable();
  if (animTable.size) {
    const have = new Set(animCells.map(([tx, ty]) => ty * 4096 + tx));
    for (const [t, px, py, , sz] of blits) {
      if (!animTable.has(t)) continue;
      for (let cy = Math.floor(py / TS); cy <= Math.floor((py + sz - 1) / TS); cy++)
        for (let cx = Math.floor(px / TS); cx <= Math.floor((px + sz - 1) / TS); cx++) {
          if (cx < 0 || cy < 0 || cx >= m.width || cy >= m.height || have.has(cy * 4096 + cx)) continue;
          have.add(cy * 4096 + cx);
          animCells.push([cx, cy, u16be(mapData, m.mapDataOffset + (cx + cy * m.width) * 2)]);
        }
    }
  }
  const animKey = new Set(animCells.map(([tx, ty]) => ty * 4096 + tx));
  for (const [tx, ty] of backdropCells) animKey.add(ty * 4096 + tx);   // the backdrop swaps under them too
  // A prop whose own art uses the cycling colours -- a fountain, a firepit,
  // the tide pool's rim -- is replayed for the same reason: the replay is
  // drawn at the current palette frame, so it animates, where a prop drawn
  // once at frame 0 stood still while the water around it moved.
  const animReplay = blits.filter(([t, px, py, , sz]) => {
    if (tileIsAnimated(t)) return true;
    const x0 = Math.floor(px / TS), x1 = Math.floor((px + sz - 1) / TS);
    const y0 = Math.floor(py / TS), y1 = Math.floor((py + sz - 1) / TS);
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++)
        if (animKey.has(cy * 4096 + cx)) return true;
    return false;
  });
  return {canvas, width:m.width, height:m.height, propCount, tileSize:TS, m, animCells,
          animReplay, backdrop, backdropCells,
          props: drawnProps, drawOps, propResid, allProps: allRecs, wallsHidden: suppressed.length};
}
/* ---------------------------------------------------------------------------
   The detail lens
   ---------------------------------------------------------------------------
   The base canvas is drawn once per map at whatever tile size fits the
   platform's canvas budget, and pan/zoom is a CSS transform over it -- cheap,
   but it means a large map's native art is simply not there to be seen:
   zooming into the world map scaled TS=8 pixels up, blurry at any budget.

   The lens is one viewport-sized canvas overlaid on the map (pointer-events
   none, so clicks fall through to the same handler as always). Whenever the
   map is zoomed in far enough that a screen tile exceeds the base's native
   size, the visible window -- and only it -- is re-rendered at the native
   32px tile size: terrain, faux props, the props in their recorded draw
   order, then the same layer painters the full-size layers use (characters,
   roofs, marks, lighting), each taking an optional (ctx, TS) so one body
   serves both its own canvas and the lens. Memory is a constant ~1-2 MP
   whatever the map size, which is the whole point.

   Repaints are debounced off applyMapTransform, so a drag hides the lens and
   the settle repaints it; layer toggles, the hour slider and the selection
   repaint it through their own draw functions' tails. Walk mode throttles
   instead (the ticks never stop, so a debounce would hide it forever).
--------------------------------------------------------------------------- */
const IS_IOS_WEBKIT = typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent || '') ||
   (/Macintosh/.test(navigator.userAgent || '') && (navigator.maxTouchPoints || 0) > 1));
const LENS_TS = 32;
let lensTimer = null;
let lensLastPaint = 0;

/* How much MORE than the viewport the lens paints, on each side, as a
   fraction of the viewport. Bigger is strictly better to look at -- the
   painted window is what a pan or a pinch slides instead of falling back to
   the blurry base, so the margin is how far the view can move before the
   base shows through -- and strictly worse for memory, which on iOS is not
   a slider but a cliff: the tab is killed rather than slowed (see
   renderMapVisual). So it is not a constant. lensGeometry takes the largest
   margin a device-pixel budget can pay for, and the budget is the only place
   a number is hardcoded.

   The ceiling is a full viewport of margin on each side, i.e. a 3x3 window
   with the viewport in the middle. Past that the paint cost starts to show
   -- the region is redrawn tile by tile at TS=32 -- and the extra is spent
   on ground a finger will rarely reach before the repaint lands anyway. */
const LENS_MAX_MARGIN = 1.0;

function lensGeometry(vw, vh) {
  // Device pixels the lens backing store may occupy: 46 MB, or 34 MB on iOS,
  // where the tab is killed rather than slowed. Lighting halves it, because
  // its destination-out pass needs a scratch canvas of exactly the same size
  // (see paintDetailLens) and two of these is the real allocation.
  const budget = (IS_IOS_WEBKIT ? 9e6 : 12e6) / (window.SHOW_LIGHTING ? 2 : 1);
  let dpr = Math.min((typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1, 2);
  // A viewport big enough that even a marginless lens is over budget has to
  // give up resolution, because the margin has nothing left to give. Without
  // this the budget bounded only the margin and not the allocation, so a large
  // enough window went over it however hard f was clamped. Half a device pixel
  // per CSS pixel is the floor: below that the lens stops being meaningfully
  // sharper than the base canvas it exists to replace.
  while (dpr > 0.5 && vw * vh * dpr * dpr > budget) dpr /= 2;
  // Area is (1 + 2f)^2 times the viewport's, so the largest affordable f
  // falls straight out of the budget rather than being guessed at.
  const base = Math.max(1, vw * vh * dpr * dpr);
  const f = Math.max(0, Math.min(LENS_MAX_MARGIN, (Math.sqrt(budget / base) - 1) / 2));
  return { dpr, f, mx: Math.round(vw * f), my: Math.round(vh * f) };
}

/* When the lens is worth painting: when the base canvas is being MAGNIFIED,
   which is the only condition under which a TS=32 repaint can show anything
   the base cannot.

   This used to be an absolute `screen pixels per tile >= 16`, and that was a
   number for one budget rather than a rule. The base's tile size is chosen to
   fit a per-device canvas budget (see renderMapVisual): the 256x256 world map
   comes back at TS=8 on a desktop, where 16 px a tile is exactly 2x and the
   old test was right -- and at **TS=4 on iOS**, where 16 px a tile is 4x, so
   the reader spent the whole range from 4 to 16 px a tile looking at four
   real pixels stretched over each one with no lens in sight. That is what the
   world map looked like on a phone, and it looked like mush.

   Expressed as the magnification it always meant, it is right at every
   budget: 1.5 is where a stretched pixel starts to show, and on a map whose
   base is already TS=20 it correctly waits much longer than the old rule did
   rather than painting a sharper copy of something already sharp. */
function lensActive() {
  const cm = window.CUR_MAP;
  return !!(cm && cm.m && cm.TS < LENS_TS && mapView.scale >= 1.5);
}

function ensureDetailLens() {
  const vp = document.getElementById('mapViewport');
  if (!vp) return null;
  let lens = document.getElementById('mapDetailLens');
  if (!lens) {
    lens = document.createElement('canvas');
    lens.id = 'mapDetailLens';
    // max-width/max-height are set explicitly, and not idly: the lens is
    // wider and taller than its containing block on purpose (see the
    // #mapViewport canvas rule in the stylesheet), and #appShell's blanket
    // max-width:100% squashed it for months. An inline declaration outranks
    // any bare selector, so the geometry below is now the element's own
    // business whatever the sheet later grows.
    // transform-origin:0 0 because the slide below is not always a pure
    // translate any more -- a pinch scales the painted pixels too, and a
    // scale about the element's centre would swing it off the map.
    // opacity + transition: the lens fades in over the budgeted base and
    // fades out again, rather than the map snapping between two resolutions.
    lens.style.cssText = 'position:absolute; top:0; left:0; pointer-events:none; z-index:5; ' +
                         'display:none; image-rendering:pixelated; max-width:none; max-height:none; ' +
                         'transform-origin:0 0; opacity:0; transition:opacity 1.5s ease;';
    vp.appendChild(lens);
  }
  return lens;
}

/* "Sharpening" -- the badge that says a repaint is on its way.

   The lens repaint is synchronous and, now that the region is as large as the
   budget allows, can take a visible beat on a big map. Worse, the interesting
   case is a pinch: the painted pixels are slid and scaled to stay registered
   (slideLens), which keeps them in the right place but magnifies them, so the
   detail on screen is real but stale until the settle. Without a word from the
   page that reads as the viewer being broken rather than busy.

   Off carries no delay and on carries a small one, so a repaint that lands
   quickly -- the overwhelmingly common case -- never flashes anything. */
function setLensBusy(on) {
  const vp = document.getElementById('mapViewport');
  if (!vp) return;
  let el = document.getElementById('mapLensBusy');
  if (!el) {
    if (!on) return;                      // never create it just to hide it
    el = document.createElement('div');
    el.id = 'mapLensBusy';
    // Deliberately not a live region. This fires on every zoom settle, and a
    // screen reader would be told "sharpening" over and over while saying
    // nothing the map itself does not already say.
    el.setAttribute('aria-hidden', 'true');
    el.textContent = 'sharpening\u2026';
    vp.appendChild(el);
  }
  el.classList.toggle('on', !!on);
}

function hideDetailLens(free) {
  if (lensTimer) { clearTimeout(lensTimer); lensTimer = null; }
  setLensBusy(false);
  const lens = document.getElementById('mapDetailLens');
  if (!lens) return;
  if (free) {
    // Freeing means another map is coming: nothing to fade from, and the
    // stale pixels must not linger over it.
    lens.style.opacity = '0'; lens.style.display = 'none';
    lens.width = 0; lens.height = 0;
    return;
  }
  lens.style.opacity = '0';
  setTimeout(() => { if (lens.style.opacity === '0') lens.style.display = 'none'; }, 1600);
}

// The pan/zoom state the lens was last painted for, and the margin it was
// painted with, so the view can move without the painted pixels going stale
// on screen. Both are needed: the margin is where the lens's own origin sits
// relative to the viewport, and a scale has to be taken about that origin.
let lensView = { x: 0, y: 0, scale: 0 };
let lensBox = { mx: 0, my: 0 };

/* Keep already-painted detail registered with the map while the view moves.

   This used to handle a pan only, and hid the lens outright the moment the
   zoom changed -- which is why pinching reverted to the worst version of the
   map for as long as a finger was down, and why the two versions looked so
   unlike each other when it came back. A zoom is no less transformable than
   a pan: the pixels were painted for lensView, so mapping every screen
   position they were painted at onto the one it should occupy under mapView
   is an ordinary similarity, and a similarity is exactly what a CSS
   transform is.

   A map point p (in base-canvas pixels) was painted at screen lensView.x +
   p*lensView.scale and belongs at mapView.x + p*mapView.scale. With
   r = mapView.scale / lensView.scale that is new = r*old + (mapView.x -
   r*lensView.x); the element's own origin sits at screen -mx, which is where
   the mx*(1-r) term comes from. Stale detail, correctly placed, is a far
   better thing to look at than fresh blur. */
function slideLens(lens) {
  const r = mapView.scale / (lensView.scale || mapView.scale);
  const tx = (mapView.x - r * lensView.x) + lensBox.mx * (1 - r);
  const ty = (mapView.y - r * lensView.y) + lensBox.my * (1 - r);
  lens.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + r + ')';
  // The same rule the base canvas follows in applyMapTransform: nearest
  // neighbour while magnifying, because the art really is pixels, and smooth
  // while minifying, because it is not sampling error the reader wants to see.
  lens.style.imageRendering = r < 0.999 ? 'auto' : 'pixelated';
}

function scheduleLensPaint(delay) {
  if (lensTimer) { clearTimeout(lensTimer); lensTimer = null; }
  const lens = document.getElementById('mapDetailLens');
  if (!lensActive()) { if (lens) hideDetailLens(true); return; }
  // Walk mode ticks continuously; throttle rather than debounce, or the
  // lens would stay hidden for as long as anyone is walking. Slide on every
  // tick regardless: without it the map moved under a lens that only caught
  // up four times a second, which is misregistration rather than staleness
  // and much the more obvious of the two.
  if (window.MAP_WALK && lens && lens.style.display !== 'none') {
    if (lensView.scale) slideLens(lens);
    if (Date.now() - lensLastPaint > 400) paintDetailLens();
    return;
  }
  if (lens && lens.style.display !== 'none' && lensView.scale) {
    slideLens(lens);
    // Only a zoom is worth a badge. A pan slides true detail at true size and
    // is not stale in any sense the reader can see, so saying "sharpening"
    // through every drag would be noise; a zoom leaves the pixels magnified
    // until the repaint lands, and that is worth naming.
    setLensBusy(mapView.scale !== lensView.scale);
  } else {
    // Nothing painted yet -- the base is all there is until the timer fires.
    setLensBusy(true);
  }
  lensTimer = setTimeout(paintDetailLens, delay == null ? 120 : delay);
}

// Terrain, faux props and props for one tile rectangle, at any tile size.
// The props come from cm.props -- the full render already decided visibility
// and draw order (delvmod's per-square priority sort), so repainting them in
// stored order reproduces the exact same stacking.
/* `src` is the map to paint, shaped like CUR_MAP -- m, mapData, props,
   allProps, backdrop. It defaults to the open map, which is what the detail
   lens wants; the World tab passes the world map while a town is open, to
   build the sharp country around it. */
/* `frame` is the palette frame to draw at, or 0 for the resting colours.
   The panel never needed it -- it animates by repainting single squares over
   a base that is already there -- but the atlas repaints the whole scene each
   frame anyway, so passing the frame down is the entire animation. */
function paintMapBaseRegion(ctx, TS, x0, y0, x1, y1, src, frame) {
  const cm = src || window.CUR_MAP;
  if (!cm || !cm.m || !cm.mapData) return;
  const m = cm.m, mapData = cm.mapData;
  const faux = getFauxProps();
  const fauxTiles = getPropTileList();
  const memo = new Map();
  const isTW = t => {
    let v = memo.get(t);
    if (v === undefined) {
      const nm = (terrainNameFor(t) || '').toLowerCase();
      v = /(^|\s)wall$|(^|\s)window$/.test(nm);
      memo.set(t, v);
    }
    return v;
  };
  const suppressed = [];
  const fauxDrawn = [];
  ctx.fillStyle = '#000';
  ctx.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS);
  const backdrop = cm.backdrop ? backdropPattern(ctx, cm.backdrop[cm.backdropFrame || 0], TS) : null;
  if (backdrop) { ctx.fillStyle = backdrop; ctx.fillRect(x0 * TS, y0 * TS, (x1 - x0 + 1) * TS, (y1 - y0 + 1) * TS); }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const t = u16be(mapData, m.mapDataOffset + (x + y * m.width) * 2);
      if (!window.MAP_WALLS && isTW(t)) {
        ctx.fillStyle = '#151515';
        ctx.fillRect(x * TS, y * TS, TS, TS);
        suppressed.push([x, y]);
        continue;
      }
      drawTileAt(ctx, t, x * TS, y * TS, !!(backdrop && tileHasTransparency(t)), TS, frame || 0);
      const fp = faux.get(t);
      if (fp) fauxDrawn.push([x, y, fp]);
    }
  }
  // The engine's passes, square by square, and within a pass the records
  // last first and then the terrain's own props: the order the full render
  // uses (enginePass and renderMapVisual say why). cm.drawOps is already in
  // that order, a record's square at a time, each carrying its pass.
  const margin = 4;                       // sprites overhang their square
  /* Six buckets filled in order rather than a sort: this runs on every frame
     the World tab paints, over thousands of the terrain's own props, and a
     sort there made zooming choppy (23 September 2026). Records go in before
     faux props, so within a pass the order is the full render's. A faux
     tile's pieces and their passes are kept per tile. */
  const buckets = [[], [], [], [], [], []];
  for (const op of (cm.drawOps || [])) {
    if (op.x < x0 - margin || op.x > x1 + margin || op.y < y0 - margin || op.y > y1 + margin) continue;
    buckets[op.pass].push(op);
  }
  const fauxPieces = DERIVED.FAUX_PIECES || (DERIVED.FAUX_PIECES = new Map());
  for (const [x, y, fp] of fauxDrawn) {
    const base = fauxTiles[fp.proptype];
    if (base === undefined) continue;
    if (!window.MAP_WALLS && isWallLikeProp(fp.proptype)) { suppressed.push([x, y]); continue; }
    const t = base + fp.aspect;
    const key = t + (fp.rotated ? 0x10000 : 0);
    let pcs = fauxPieces.get(key);
    if (pcs === undefined) {
      pcs = propPieceList(t, fp.rotated).map(pc => ({ dx: pc.dx, dy: pc.dy, tile: pc.tile, pass: enginePass(pc.tile, 0, false) }));
      fauxPieces.set(key, pcs);
    }
    const [ox, oy] = propOffsetFor(fp.proptype, fp.aspect, fp.rotated);
    for (const pc of pcs) {
      const px = x + pc.dx, py = y + pc.dy;
      if (px < 0 || py < 0 || px >= m.width || py >= m.height) continue;
      buckets[pc.pass].push({ x: px, y: py, tile: pc.tile, rot: fp.rotated, ox, oy });
    }
  }
  for (const bucket of buckets) for (const op of bucket)
    drawPropPiece(ctx, TS, op.x, op.y, op.tile, op.d ? op.d.rec.rotated : op.rot, op.ox, op.oy, frame);
  // The full render dropped wall props before recording cm.props, so the
  // hatching recovers them from the raw records the same way it decided.
  if (!window.MAP_WALLS) {
    for (const r of (cm.allProps || [])) {
      if (r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44) continue;
      if ((r.flags & 0x58) && !characterProptypes().has(r.proptype)) continue;
      if (r.x < x0 || r.x > x1 || r.y < y0 || r.y > y1) continue;
      if (isWallLikeProp(r.proptype)) suppressed.push([r.x, r.y]);
    }
  }
  if (suppressed.length) {
    ctx.save();
    ctx.strokeStyle = 'rgba(190,175,130,.42)';
    ctx.lineWidth = Math.max(1, TS / 20);
    for (const [x, y] of suppressed) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      const px = x * TS, py = y * TS;
      ctx.beginPath();
      for (let k = -TS; k < TS; k += Math.max(3, TS / 4)) {
        ctx.moveTo(px + Math.max(0, k), py + Math.max(0, -k));
        ctx.lineTo(px + Math.min(TS, k + TS), py + Math.min(TS, TS - k));
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(190,175,130,.22)';
      ctx.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
      ctx.strokeStyle = 'rgba(190,175,130,.42)';
    }
    ctx.restore();
  }
}

/* The art that has to be put back over an animated square.

   Water is opaque, so repainting it erases whatever was drawn on top -- the
   shoreline, a jetty, a tree overhanging the bank. The base canvas keeps a
   list of the exact blits for this (animReplay), but those are recorded at
   the base's own tile size and the lens paints at 32, so what the lens needs
   is the prop records rather than the blits. Worked out once per map. */
function lensAnimArt(cm) {
  if (cm._lensAnimArt) return cm._lensAnimArt;
  const key = new Set();
  for (const [x, y] of (cm.animCells || [])) key.add(y * 4096 + x);
  for (const [x, y] of (cm.backdropCells || [])) key.add(y * 4096 + x);
  const out = [];
  for (const d of (cm.props || []))
    if ((d.cells || []).some(([x, y]) => key.has(y * 4096 + x))) out.push(d);
  return (cm._lensAnimArt = out);
}

/* One palette frame, into the lens, over the squares that cycle.

   Skipped while the lens is mid-slide: those pixels are being carried to
   follow a moving map and are about to be replaced by the settle repaint, and
   painting into them at a stale transform would put water in the wrong place. */
function repaintLensAnim(frame) {
  const cm = window.CUR_MAP;
  const lens = document.getElementById('mapDetailLens');
  const vp = document.getElementById('mapViewport');
  if (!cm || !cm.m || !lens || !vp || !lens.width) return;
  if (lens.style.display === 'none' || lens.style.transform) return;
  if (!cm.animCells || !cm.animCells.length) return;
  const ctx = lens.getContext('2d');
  if (!ctx) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const geom = lensGeometry(vw, vh);
  const dpr = geom.dpr, mx = geom.mx, my = geom.my;
  const k = (cm.TS * mapView.scale / LENS_TS) * dpr;
  ctx.setTransform(k, 0, 0, k, (mapView.x + mx) * dpr, (mapView.y + my) * dpr);
  ctx.imageSmoothingEnabled = false;
  const spt = cm.TS * mapView.scale;
  const x0 = Math.max(0, Math.floor(-(mapView.x + mx) / spt) - 2);
  const y0 = Math.max(0, Math.floor(-(mapView.y + my) / spt) - 2);
  const x1 = Math.min(cm.tilesW - 1, Math.ceil((vw + mx - mapView.x) / spt) + 2);
  const y1 = Math.min(cm.tilesH - 1, Math.ceil((vh + my - mapView.y) / spt) + 2);
  const faux = getFauxProps(), fauxTiles = getPropTileList();
  for (const [tx, ty, t] of cm.animCells) {
    if (tx < x0 || tx > x1 || ty < y0 || ty > y1) continue;
    drawTileAt(ctx, t, tx * LENS_TS, ty * LENS_TS, false, LENS_TS, frame);
    const fp = faux.get(t);
    if (!fp) continue;
    const base = fauxTiles[fp.proptype];
    if (base === undefined) continue;
    const [ox, oy] = propOffsetFor(fp.proptype, fp.aspect, fp.rotated);
    drawPropAt(ctx, LENS_TS, tx, ty, base + fp.aspect, fp.rotated, ox, oy, cm.m.width, cm.m.height, frame);
  }
  for (const d of lensAnimArt(cm)) {
    const r = d.rec;
    if (r.x < x0 - 4 || r.x > x1 + 4 || r.y < y0 - 4 || r.y > y1 + 4) continue;
    const [ox, oy] = propOffsetFor(r.proptype, r.aspect, r.rotated);
    drawPropAt(ctx, LENS_TS, r.x, r.y, d.tileId, r.rotated, ox, oy, cm.m.width, cm.m.height, frame);
  }
}

function paintDetailLens() {
  lensTimer = null;
  const cm = window.CUR_MAP;
  const vp = document.getElementById('mapViewport');
  if (!lensActive() || !vp) { hideDetailLens(true); return; }
  const lens = ensureDetailLens();
  if (!lens) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  // Not laid out yet, and nothing is rescheduled from here -- so retract the
  // badge rather than leaving it promising a repaint that is not coming.
  if (vw < 40 || vh < 40) { setLensBusy(false); return; }
  // As much map around the viewport as the memory budget will pay for,
  // painted now so a pan or a pinch can slide it (see slideLens) without
  // exposing the base underneath.
  const geom = lensGeometry(vw, vh);
  const dpr = geom.dpr, mx = geom.mx, my = geom.my;
  const bw = Math.round((vw + 2 * mx) * dpr), bh = Math.round((vh + 2 * my) * dpr);
  // Two separate things, deliberately not one branch. Assigning canvas.width
  // clears the bitmap, so that must only happen when the backing store really
  // has to change size; the CSS box is free to re-assert and is kept its own
  // business, because a CSS box that has silently stopped matching the backing
  // store is exactly the failure this lens shipped with -- crisp pixels
  // squeezed into the wrong number of them.
  if (lens.width !== bw || lens.height !== bh) { lens.width = bw; lens.height = bh; }
  const box = (vw + 2 * mx) + 'x' + (vh + 2 * my) + '@' + mx + ',' + my;
  if (lens.dataset.box !== box) {
    lens.dataset.box = box;
    lens.style.width = (vw + 2 * mx) + 'px'; lens.style.height = (vh + 2 * my) + 'px';
    lens.style.left = (-mx) + 'px'; lens.style.top = (-my) + 'px';
  }
  const ctx = lens.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, bw, bh);
  // Screen position of detail pixel d is mapView + d * (TS*scale/LENS_TS),
  // so one transform lets every painter keep drawing at tile*TS coordinates.
  // The canvas origin sits a margin up-left of the viewport's.
  const k = (cm.TS * mapView.scale / LENS_TS) * dpr;
  ctx.setTransform(k, 0, 0, k, (mapView.x + mx) * dpr, (mapView.y + my) * dpr);
  ctx.imageSmoothingEnabled = false;
  const spt = cm.TS * mapView.scale;
  const x0 = Math.max(0, Math.floor(-(mapView.x + mx) / spt) - 2);
  const y0 = Math.max(0, Math.floor(-(mapView.y + my) / spt) - 2);
  const x1 = Math.min(cm.tilesW - 1, Math.ceil((vw + mx - mapView.x) / spt) + 2);
  const y1 = Math.min(cm.tilesH - 1, Math.ceil((vh + my - mapView.y) / spt) + 2);
  if (x1 < x0 || y1 < y0) { lens.style.display = 'none'; return; }
  paintMapBaseRegion(ctx, LENS_TS, x0, y0, x1, y1);
  // Same stacking as the layers' z-indices: characters under roofs, then
  // lighting, marks and the selection on top.
  drawCharacterLayer(ctx, LENS_TS);
  drawRoofLayer(ctx, LENS_TS);
  // Lighting punches its light circles out of its darkness wash with
  // destination-out, which on the shared lens context would erase the map
  // itself. It gets a scratch canvas with the same transform, composited
  // back as a normal alpha layer.
  if (window.SHOW_LIGHTING) {
    let scratch = window._lensLightScratch;
    if (!scratch) scratch = window._lensLightScratch = document.createElement('canvas');
    if (scratch.width !== bw || scratch.height !== bh) { scratch.width = bw; scratch.height = bh; }
    const sctx = scratch.getContext('2d');
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, bw, bh);
    sctx.setTransform(k, 0, 0, k, (mapView.x + mx) * dpr, (mapView.y + my) * dpr);
    drawLighting(sctx, LENS_TS, { x0, y0, x1, y1 });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(scratch, 0, 0);
    ctx.setTransform(k, 0, 0, k, (mapView.x + mx) * dpr, (mapView.y + my) * dpr);
  } else if (window._lensLightScratch && window._lensLightScratch.width) {
    // Lighting off: give the backing store back rather than holding a second
    // full lens's worth of device pixels for a layer nobody is looking at.
    // lensGeometry hands the margin that memory back as painted map instead.
    window._lensLightScratch.width = 0;
    window._lensLightScratch.height = 0;
  }
  drawMapMarks(ctx, LENS_TS);
  lens.style.transform = '';
  lens.style.imageRendering = 'pixelated';
  lensView = { x: mapView.x, y: mapView.y, scale: mapView.scale };
  lensBox = { mx, my };
  lens.style.display = '';
  // Two frames, not one: display has to have taken effect before opacity
  // changes, or there is nothing for the transition to run from.
  requestAnimationFrame(() => requestAnimationFrame(() => { if (lens.style.display !== 'none') lens.style.opacity = '1'; }));
  lensLastPaint = Date.now();
  setLensBusy(false);
}
