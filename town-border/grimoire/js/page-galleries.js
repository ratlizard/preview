/* The galleries: bulk export, arrangement, the sprite zoom, text editing, the ditherizer, locks, lazy tiles, the keyboard, and the boot.

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
   last of these. File 14 of 14. */

/* ---------------------------------------------------------------------------
   Bulk export
   ---------------------------------------------------------------------------
   Everything decoded here could be saved one resource at a time and only one
   resource at a time: 160 tile sheets meant 160 clicks. This writes the whole
   open gallery as a .zip -- PNG for art, WAV for sound, MIDI for music, the
   decoded listing plus the raw bytes for everything else, and an index.txt
   that says what each file is.

   Store-only (no compression): the PNGs and WAVs are already compressed or
   near-incompressible, a stored archive needs no deflate implementation, and
   the CRC-32 it does need is the one the PNG writer above already has.
--------------------------------------------------------------------------- */
// buildZip, dlBlob and safeFileName are in js/mac-export.js: the resource
// fork browser grew the same store-only ZIP writer, field for field.

function galleryIsExportable() {
  return !!(window.CUR_RESIDS && window.CUR_RESIDS.length &&
            typeof window.CUR_SUBN === 'number');
}

const utf8 = s => new TextEncoder().encode(s);

async function exportGallery() {
  if (!galleryIsExportable()) return;
  const subn = window.CUR_SUBN;
  const resids = window.CUR_RESIDS;
  const btn = document.getElementById('exportBtn');
  const note = document.getElementById('exportNote');
  const say = m => { if (note) note.textContent = m; };
  if (btn) { btn.disabled = true; }
  const isText = (subn === 0 || subn === 1 || subn === 128 || subn === 239 ||
                  (!CANONICAL_SIZE[subn] && !HAS_HEADER[subn] && !UNCOMPRESSED[subn] && !SOUND_CATEGORIES.has(subn)));
  const folder = safeFileName((CATEGORY_NAMES[subn] || ('subindex ' + subn))) + '/';
  const files = [];
  const index = ['Cythera Data, ' + (CATEGORY_NAMES[subn] || ('subindex ' + subn)),
                 'subindex ' + subn + ', ' + resids.length + ' resources', ''];
  let failed = 0;

  for (let i = 0; i < resids.length; i++) {
    const [resid, roff, rlen] = resids[i];
    const hex = '0x' + resid.toString(16).toUpperCase();
    const lbl = labelFor(resid);
    const stem = folder + safeFileName(hex + (lbl ? ' ' + lbl : ''));
    const raw = ARCHIVE.bytes.slice(roff, roff + rlen);
    const wrote = [];
    try {
      if (SOUND_CATEGORIES.has(subn)) {
        const snd = decodeSound(raw);
        files.push({ name: stem + '.wav', bytes: samplesToWav(snd.rate, snd.samples) });
        wrote.push('wav');
      } else if (subn === 143) {
        const m = qtmaToMidi(raw);
        files.push({ name: stem + '.mid', bytes: m.midi });
        wrote.push('midi (' + m.noteCount + ' notes)');
      } else if (!isText && subn !== 127) {
        let { W, H, image } = decodeResource(ARCHIVE, raw, subn, resid);
        if (subn === 141) ({ W, H, image } = reshapeTileSheetGrid(W, H, image));
        files.push({ name: stem + '.png',
                     bytes: await encodeIndexedPNG(W, H, image, PAL_RGB, transparentIndexFor(subn)) });
        wrote.push(W + '×' + H + ' png');
      } else {
        const d = smartDecrypt(raw, resid).data;
        let text = '';
        try { text = dvmRender(ARCHIVE, d, resid) || ''; } catch (e) { text = ''; }
        if (!text) { try { text = extractReadableStrings(ARCHIVE, d, resid) || ''; } catch (e) { text = ''; } }
        if (text) { files.push({ name: stem + '.txt', bytes: utf8(text) }); wrote.push('txt'); }
        files.push({ name: stem + '.bin', bytes: raw });
        wrote.push('raw');
      }
    } catch (err) {
      files.push({ name: stem + '.bin', bytes: raw });
      wrote.push('raw only, ' + err.message);
      failed++;
    }
    index.push(hex + '  ' + (lbl || '(no label)') + '  ' + rlen + ' bytes  [' + wrote.join(', ') + ']');
    if ((i & 7) === 0) {
      say('Packing ' + (i + 1) + ' of ' + resids.length + '…');
      await new Promise(r => setTimeout(r, 0));   // keep the page responsive
    }
  }

  index.push('', 'Written by index.html. Labels marked in the gallery with † are',
             'supplied by the page and are not in the file.');
  files.push({ name: folder + 'index.txt', bytes: utf8(index.join('\n')) });

  const blob = buildZip(files);
  dlBlob(blob, safeFileName('cythera ' + (CATEGORY_NAMES[subn] || ('subindex ' + subn))) + '.zip');
  say(files.length + ' files, ' + fmtBytes(blob.size) + (failed ? ', ' + failed + ' undecodable' : ''));
  if (btn) btn.disabled = false;
}

/* ---------------------------------------------------------------------------
   Gallery arrangement
   ---------------------------------------------------------------------------
   Every gallery in this file -- resources, characters, prop types, items,
   monsters, fork resources, composites -- builds the same thing: a run of
   .cell elements inside #sheetGrid, each carrying a .lbl name and a .resid
   line. So the list view and the sort are one pair of controls applied to the
   grid afterwards rather than a variant of seven different renderers.

   A tile is the right shape for artwork and the wrong shape for a hundred
   near-identical rows of text, which is what the script and dialogue galleries
   are. The list gives each entry a line, the name at reading size and its id
   and facts beside it.
--------------------------------------------------------------------------- */
window.GALLERY_SORT = 'archive';

function setGallerySort(v) {
  window.GALLERY_SORT = v;
  const ss = document.getElementById('gallerySortSel');
  if (ss && ss.value !== v) ss.value = v;
  applyGalleryArrangement();
}

// The size of a resource, for the "largest first" sort. Only resource-backed
// galleries have one; the synthetic ones sort to the end of that ordering.
function cellSortKeys(cell) {
  // .lblText, where a caption has one, is the name without the provenance tag
  // printed beside it -- otherwise every wiki-named cell would sort and filter
  // on the word "wiki" as well as on its name.
  const lbl = cell.querySelector('.lblText') || cell.querySelector('.lbl');
  const rid = cell.querySelector('.resid');
  const name = (lbl ? lbl.textContent : '').trim();
  const idText = (rid ? rid.textContent : '').trim();
  const m = /0x([0-9A-Fa-f]+)/.exec(idText);
  const id = m ? parseInt(m[1], 16) : Number.MAX_SAFE_INTEGER;
  let size = -1;
  for (const [r, , len] of (window.CUR_RESIDS || [])) if (r === id) { size = len; break; }
  return { name, id, size };
}

function applyGalleryArrangement() {
  const grid = document.getElementById('sheetGrid');
  if (!grid) return;

  const cells = Array.from(grid.children).filter(c => c.classList && c.classList.contains('cell'));
  if (!cells.length) return;
  // The order the gallery built, captured once so "as the file has them"
  // can be restored exactly, headings and all.
  if (!grid._origOrder || grid._origOrder.length !== grid.children.length ||
      grid._origOrder[0] !== grid.children[0]) {
    grid._origOrder = Array.from(grid.children);
  }
  const heads = Array.from(grid.querySelectorAll('.propHead'));
  // Hide whatever the filter box excludes. The rebuilding galleries have
  // already dropped their non-matches, so this is a no-op there.
  const q = REBUILDING_GALLERIES.has(window.CUR_SUBN)
    ? '' : (window.PROP_FILTER || '').trim().toLowerCase();
  let shown = cells.length;
  if (q) {
    shown = 0;
    for (const c of cells) {
      const k = cellSortKeys(c);
      const hex = Number.isFinite(k.id) && k.id !== Number.MAX_SAFE_INTEGER
        ? '0x' + k.id.toString(16).toLowerCase() : '';
      const hit = (k.name || '').toLowerCase().includes(q) || (hex && hex.includes(q)) ||
                  (c.textContent || '').toLowerCase().includes(q);
      c.style.display = hit ? '' : 'none';
      if (hit) shown++;
    }
  } else {
    for (const c of cells) c.style.display = '';
  }
  const fnote = document.getElementById('filterNote');
  if (fnote) fnote.textContent = q ? (shown + ' of ' + cells.length + ' shown') : '';
  const key = window.GALLERY_SORT;
  if (key === 'archive') {
    for (const el of grid._origOrder) grid.appendChild(el);
    // A heading whose whole run is filtered out has nothing left to head.
    for (const h of heads) h.style.display = q ? 'none' : '';
    return;
  }
  // A sort cuts across the groupings the prop and item galleries print, so
  // their headings go away rather than sitting over the wrong run.
  for (const h of heads) h.style.display = 'none';
  const keyed = cells.map((c, i) => ({ c, i, k: cellSortKeys(c) }));
  const cmp = {
    name: (a, b) => (a.k.name || '\uffff').localeCompare(b.k.name || '\uffff') || a.i - b.i,
    id:   (a, b) => a.k.id - b.k.id || a.i - b.i,
    size: (a, b) => b.k.size - a.k.size || a.i - b.i,
  }[key];
  if (!cmp) return;
  keyed.sort(cmp);
  for (const e of keyed) grid.appendChild(e.c);
}

// --- Tile-sheet shapes and grid lines ---------------------------------
// The sheet is stored as one 32x512 column; the 4x4 grid the gallery draws
// is already a presentation choice, so the choice is now the reader's:
// grid, the native column, one row, or the sixteen tiles set apart.
window.SHEET_SHAPE = 'grid';
window.SHEET_GRIDLINES = false;
function setSheetShape(v) {
  window.SHEET_SHAPE = v;
  if (currentMode === 'sheet') renderContactSheet(); else renderImage();
}
function setSheetGridlines(on) {
  window.SHEET_GRIDLINES = on;
  if (currentMode === 'sheet') renderContactSheet(); else renderImage();
}
function drawSheetGridlines(canvas, W, H, mode) {
  if (!window.SHEET_GRIDLINES || mode === 'tiles') return;
  if (W % 32 && H % 32) return;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 32; x < W; x += 32) { ctx.moveTo(x - 0.5, 0); ctx.lineTo(x - 0.5, H); }
  for (let y = 32; y < H; y += 32) { ctx.moveTo(0, y - 0.5); ctx.lineTo(W, y - 0.5); }
  ctx.stroke();
  ctx.restore();
}

// --- One sprite, up close ---------------------------------------------
// Click any frame in a prop or item panel and get it big: 8x, pixelated,
// with its own indexed-PNG download. The overlay is one div; clicking
// anywhere on it, or Escape, puts it away.
/* What a tile is to the file, under its picture: the sheet it is cut from,
   the prop type whose base it is, and every class that draws it at an aspect
   -- a class at aspect n draws its base tile + n, on its own sheet -- with how
   often the file places that class at that aspect. A chip opens the item at
   that aspect, where the prop record shows the picture, or the prop type's
   page. A picture no class owns (orphanItemArt) says so. */
function tileFactsHTML(tileId) {
  const rows = [];
  const sheet = 0x8E00 + (tileId >> 4);
  if (refExists(sheet)) rows.push(partsStrip('Cut from', [partChip('Sheet', sheet)]));
  const tiles = getPropTileList();
  const worn = (buildItemIndex(), DERIVED.ITEM_WORN || new Map());
  const baseOf = [], atAspect = [];
  for (let pt = 1; pt < tiles.length; pt++) {
    const b = tiles[pt];
    if (!b || b > tileId || (b >> 4) !== (tileId >> 4)) continue;
    if (b === tileId) baseOf.push({ pt, n: 0 }); else atAspect.push({ pt, n: tileId - b });
  }
  const chip = ({ pt, n }) => {
    const item = isInventoryItem(pt);
    const placed = n ? worn.get((pt << 5) | n) || 0 : 0;
    return relChip({ js: item ? 'openItem(' + pt + (n ? ',' + n : '') + ')' : 'openPropType(' + pt + ')',
                     main: propDisplayName(pt) || 'prop type ' + pt,
                     sub: (n ? 'aspect ' + n : item ? 'item' : 'prop type') + (placed ? ', placed ' + placed : ''),
                     icon: relIconURL({ icon: pt }), title: tabTrail(TAB_LEAF_FOR.get(item ? 'ITEMS' : 'PROPS')) });
  };
  if (baseOf.length) rows.push(partsStrip('Base of', baseOf.map(chip)));
  atAspect.sort((a, b) => a.n - b.n);
  if (atAspect.length) rows.push(partsStrip('Drawn by', atAspect.map(chip)));
  let orphan = false;
  try { orphan = orphanItemArt().some(o => o.tile === tileId); } catch (e) { orphan = false; }
  if (orphan) rows.push('<div class="partsNote" style="color:#b5b2a8">No class owns this picture, and nothing in the file places it.</div>');
  return linksFold(rows.join(''));
}

function showSpriteZoom(tileId, label) {
  let ov = document.getElementById('spriteZoom');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'spriteZoom';
  ov.style.cssText = 'position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.75);' +
    'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;cursor:zoom-out';
  const c = document.createElement('canvas');
  try { drawTileToCanvas(c, tileId, 32); } catch (e) { ov.remove(); return; }
  c.style.cssText = 'width:256px;height:256px;image-rendering:pixelated;background:' +
    'repeating-conic-gradient(#2a2a2a 0% 25%, #1c1c1c 0% 50%) 0 0/16px 16px;cursor:default';
  const cap = document.createElement('div');
  cap.style.cssText = 'color:#e8dcb8;font-size:0.875rem';
  cap.innerHTML = (label ? svEsc(label) + ', ' : '') + 'tile 0x' + tileId.toString(16).toUpperCase();
  const dl = document.createElement('button');
  dl.className = 'secondary';
  dl.textContent = 'Download PNG';
  dl.onclick = (e) => {
    e.stopPropagation();
    triggerPNGDownload(c, 'cythera_tile_0x' + tileId.toString(16).toUpperCase() + '.png');
  };
  ov.appendChild(c); ov.appendChild(cap);
  let facts = '';
  try { facts = tileFactsHTML(tileId); } catch (e) { facts = ''; }
  if (facts) {
    const f = document.createElement('div');
    f.className = 'tileFacts';
    f.style.cssText = 'max-width:560px;padding:0 16px;cursor:default';
    f.innerHTML = facts;
    ov.appendChild(f);
  }
  const gif = document.createElement('button');
  gif.className = 'secondary';
  gif.textContent = 'Download GIF';
  gif.onclick = (e) => { e.stopPropagation(); downloadPropGIF(tileId, [0]); };
  const saves = document.createElement('div');
  saves.style.cssText = 'display:flex;gap:8px';
  saves.appendChild(dl); saves.appendChild(gif);
  ov.appendChild(saves);
  ov.onclick = (e) => { if (e.target !== dl && e.target !== gif) ov.remove(); };
  const esc = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } };
  document.addEventListener('keydown', esc);
  document.body.appendChild(ov);
}

// --- Direct text editing ------------------------------------------------
// Dialogue and prose are Pascal strings inside script containers, and every
// byte after one is addressed by absolute offset -- so an in-place edit must
// not move anything. The rule here: the new text is padded with spaces to
// EXACTLY the stored length, the length byte stays untouched, and nothing
// shifts. Growing a string means reassembling the container, which is the
// script editor's future job, so a longer text is refused with that
// explanation rather than half-done.
function locatePascalString(data, approxOffset) {
  // Delver text is a run of printable ASCII ended by a non-printing byte
  // (see dvmImplicitString) -- there is no length prefix, so the editable
  // slot is the run itself: from the recorded offset to the terminator.
  // For strings harvested out of bytecode the recorded offset is the
  // opcode, so skip forward over any non-printing lead-in first.
  let a = approxOffset;
  while (a < data.length && !(data[a] >= 0x20 && data[a] < 0x7F)) a++;
  if (a >= data.length) return null;
  let q = a;
  while (q < data.length && data[q] >= 0x20 && data[q] < 0x7F) q++;
  if (q - a < 4) return null;
  return { textOffset: a, cap: q - a };
}

function editStringAt(resid, approxOffset) {
  const raw = getResourceBytes(ARCHIVE, resid);
  if (!raw) return;
  const data = smartDecrypt(raw, resid).data;
  const loc = locatePascalString(data, approxOffset);
  if (!loc) { setStatus('There is no text string at that position, so you cannot edit it in place.', true); return; }
  const oldText = decodeMacRoman(data.subarray(loc.textOffset, loc.textOffset + loc.cap));
  let ov = document.getElementById('textEdit');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'textEdit';
  ov.innerHTML = '<div class="dtPanel">' +
    '<div class="dtHead">Edit text in 0x' + resid.toString(16).toUpperCase() +
      '<button class="linkbtn" onclick="document.getElementById(\'textEdit\').remove()">close</button></div>' +
    '<textarea id="teText" spellcheck="false"></textarea>' +
    '<div class="inspDim"><span id="teCount"></span>, the stored space is fixed at ' + loc.cap +
      ' bytes; the page pads shorter text with spaces, and longer text would move every ' +
      'byte after it, which this editor does not do. * separates alternative ' +
      'lines; @word marks a conversation keyword.</div>' +
    '<div><button onclick="applyStringEdit(' + resid + ',' + loc.textOffset + ',' + loc.cap + ')">Apply and rebuild the file</button></div>' +
    '</div>';
  document.body.appendChild(ov);
  const ta = document.getElementById('teText');
  ta.value = oldText;
  const count = () => {
    const n = encodeMacRoman(ta.value).length;
    const el = document.getElementById('teCount');
    el.textContent = n + ' / ' + loc.cap + ' bytes';
    el.style.color = n > loc.cap ? '#ff8080' : '';
  };
  ta.oninput = count;
  count();
}

function applyStringEdit(resid, textOffset, cap) {
  const ta = document.getElementById('teText');
  if (!ta) return;
  const enc = encodeMacRoman(ta.value);
  if (enc.length > cap) {
    setStatus('That text is ' + enc.length + ' bytes; the slot holds ' + cap + '. Shorten it.', true);
    return;
  }
  const data = smartDecrypt(getResourceBytes(ARCHIVE, resid), resid).data;
  const out = Uint8Array.from(data);
  out.set(enc, textOffset);
  for (let i = textOffset + enc.length; i < textOffset + cap; i++) out[i] = 0x20;
  if (applyResourceEdit(resid, out)) {
    const ov = document.getElementById('textEdit');
    if (ov) ov.remove();
  }
}

// --- The ditherizer ----------------------------------------------------
// The undither run backwards, as a tool: any image in, Cythera-palette
// checkerboard art out (ditherToCytheraPalette in js/delv-graphics.js does
// the pixels; this is only the panel around it). In portrait mode the result
// is exactly a portrait resource -- 64x64, palette-indexed, cut out on slot
// 0 -- and one button DCG-encodes it and hands it to applyResourceEdit, so
// your own face lands in the archive through the same rebuild every other
// edit uses, ready for "Download edited archive".
let _ditherSrc = null;      // the loaded Image, kept so sliders re-render
/* To the canvas page and back. The picture on screen goes over as a PNG
   through localStorage under one key, and canvas.html opens it on load;
   its file menu's "Send back to Grimoire" puts the result under another,
   which the storage event delivers here and the ditherizer takes as its
   source, aimed at the resource it came from. Two pages of one origin,
   no server, no clipboard. A portrait comes back into its resource; any
   other picture comes back into the ditherizer, which writes portraits
   only. */
function sendToCanvas() {
  const canvas = document.getElementById('canvas');
  const resid = currentResid;
  if (!canvas || !resid) return;
  try {
    const st = document.createElement('canvas'); st.width = canvas.width; st.height = canvas.height;
    st.getContext('2d').drawImage(canvas, 0, 0);
    localStorage.setItem('grimoire.handoff', JSON.stringify({ resid, subn: window.CUR_SUBN, name: labelFor(resid) || ('0x' + resid.toString(16).toUpperCase()), png: st.toDataURL('image/png'), at: Date.now() }));
  } catch (e) { setStatus('The page could not hand the picture over: ' + e.message, true); return; }
  window.open('canvas.html', 'colorcyclecanvas');
}
function receiveFromCanvas() {
  let back = null;
  try { const raw = localStorage.getItem('grimoire.return'); if (raw) { back = JSON.parse(raw); localStorage.removeItem('grimoire.return'); } } catch (e) { back = null; }
  if (!back || !back.png) return;
  const img = new Image();
  img.onload = () => {
    openDitherTool();
    _ditherSrc = img;
    const mode = document.getElementById('dtMode'), tgt = document.getElementById('dtTarget');
    const kinds = { 135: 'portrait', 131: 'landscape', 137: 'icon', 141: 'sheet', 142: 'free' };
    if (mode) mode.value = kinds[String(back.subn)] || 'free';
    ditherFillTargets();
    if (tgt && back.resid && [...tgt.options].some(o => +o.value === +back.resid)) tgt.value = String(back.resid);
    renderDither();
    setStatus('Back from ColorCycleCanvas: ' + (back.name || '') + '. Replace writes it into its resource.');
  };
  img.src = back.png;
}
if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', e => { if (e.key === 'grimoire.return') receiveFromCanvas(); });

/* Whether a picture keeps off the colour-cycling ramps. Only a tile sheet
   does, and only by choice (a tile is where water and lava are drawn on
   purpose); on by default, and the last choice holds for the rest of the
   visit (the maintainer, 22 September 2026). Every other kind used to keep
   off them too, on the reasoning that a portrait on a cycling ramp would
   shimmer with the sea; the maintainer said on 3 October 2026 that only a
   tile sheet needs to, so a portrait, a strip, an icon or a free graphic
   has the whole palette. */
window.DITHER_SUBST = true;
function ditherAllowAnimated() { return ditherKind() !== 'sheet' || !window.DITHER_SUBST; }
function openDitherTool() {
  let ov = document.getElementById('ditherTool');
  if (ov) ov.remove();
  ov = document.createElement('div');
  ov.id = 'ditherTool';
  const portraits = [];
  for (let n = 0; n < 256; n++) {
    const rid = 0x8800 + n;
    try { if (getResourceBytes(ARCHIVE, rid)) portraits.push(rid); } catch (e) { quiet(e); }
  }
  ov.innerHTML =
    '<div class="dtPanel">' +
    '<div class="dtHead">Ditherize an image' +
      '<button class="linkbtn" onclick="document.getElementById(\'ditherTool\').remove()">close</button></div>' +
    '<input type="file" id="dtFile" accept="image/*">' +
    '<div class="dtRow"><label>Mode <select id="dtMode">' +
      '<option value="portrait">64×64 portrait (cover crop)</option>' +
      '<option value="frame:88A2">64×64 in the frame of 0x88A2</option>' +
      '<option value="frame:88F2">64×64 in the frame of 0x88F2</option>' +
      ditherSharedFrames().map(f => '<option value="frame:' + f.members[0].toString(16).toUpperCase() + '">64×64 in the frame of ' + svEsc(ditherFrameOwners(f.members)) + '</option>').join('') +
      '<option value="items">64×64 in a frame of items</option>' +
      '<option value="landscape">288×32 landscape strip (cover crop)</option>' +
      '<option value="icon">32×16 icon (cover crop)</option>' +
      '<option value="sheet">128×128 tile sheet, sixteen tiles (cover crop)</option>' +
      '<option value="free">original size (up to 512px), a sized graphic</option></select></label>' +
    '<label>Checker <input type="range" id="dtChecker" min="0" max="100" value="60"></label>' +
    '<label id="dtSubstWrap"><input type="checkbox" id="dtSubst"' + (window.DITHER_SUBST ? ' checked' : '') + '> Automatically substitute out color-cycling colors</label></div>' +
    '<div class="dtRow" id="dtItemsRow" style="display:none">' +
    '<label>Corners <select id="dtCorner">' + ditherItemOptions('axe') + '</select></label>' +
    '<label>Edges <select id="dtEdge">' + ditherItemOptions('sword') + '</select></label></div>' +
    '<div class="dtRow">' +
    '<label><input type="checkbox" id="dtSeldane"> Seldane colors only <span class="inspDim">(the blues and cyans of portraits 0x8877 to 0x887B, by lightness)</span></label></div>' +
    '<div class="dtRow"><canvas id="dtSrc" width="64" height="64"></canvas>' +
    '<canvas id="dtOut" width="64" height="64"></canvas></div>' +
    '<div class="dtRow">' +
    '<button class="secondary" onclick="ditherDownloadPNG()">Download indexed PNG</button>' +
    '<button class="secondary" onclick="ditherDownloadGIF()">Download GIF</button>' +
    '<label>into <select id="dtTarget"></select></label>' +
    '<button class="secondary" onclick="ditherReplace()">Replace in archive</button>' +
    '</div>' +
    '<div class="inspDim">Each mode writes a real resource of its kind: a portrait, a landscape strip, an icon, a ' +
    'sixteen-tile sheet or a sized graphic. Transparent pixels stay the cut-out slot, animated palette ramps are ' +
    'avoided so nothing shimmers, and Replace rebuilds the file in memory; the Changes tab is where it leaves the page.</div>' +
    '</div>';
  document.body.appendChild(ov);
  ditherFillTargets();
  document.getElementById('dtFile').onchange = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const img = new Image();
    img.onload = () => { _ditherSrc = img; renderDither(); };
    img.src = URL.createObjectURL(f);
  };
  document.getElementById('dtMode').onchange = () => { ditherFillTargets(); renderDither(); };
  document.getElementById('dtChecker').oninput = renderDither;
  document.getElementById('dtSubst').onchange = e => { window.DITHER_SUBST = e.target.checked; renderDither(); };
  document.getElementById('dtSeldane').onchange = renderDither;
  document.getElementById('dtCorner').onchange = renderDither;
  document.getElementById('dtEdge').onchange = renderDither;
}

/* The items a frame can be built of (itemFramePixels in
   js/delv-graphics.js lays them out): every tile of every item the
   Items sheet lists, from its prop type's base tile to the next type's,
   the first tile of each name the tile-name table gives them, so the
   food type offers its bread, cheese and grapes and a creature its
   first frame. Named as the file names them, with the tile, since three
   swords share a name. */
DERIVED.DITHER_ITEM_TILES = null;
function ditherItemTiles() {
  if (DERIVED.DITHER_ITEM_TILES) return DERIVED.DITHER_ITEM_TILES;
  const tiles = getPropTileList(), bases = [...new Set(tiles.filter(t => t))].sort((a, b) => a - b), seen = new Set(), out = [];
  for (const e of inventoryItemList()) {
    const b = tiles[e.pt], next = bases.find(t => t > b) || b + 1, names = new Set();
    for (let t = b; t < Math.min(next, b + 32); t++) {
      const name = terrainNameFor(t);
      if (!name || names.has(name) || seen.has(t)) continue;
      names.add(name); seen.add(t);
      const im = resolveTileImage(t);
      if (im && im.some(v => v)) out.push({ tile: t, name });
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name) || a.tile - b.tile);
  return (DERIVED.DITHER_ITEM_TILES = out);
}
// A picker's options, the first item of the given name chosen.
function ditherItemOptions(pick) {
  let list = [];
  try { list = ditherItemTiles(); } catch (e) { quiet(e, 'listing the items a frame can be built of'); }
  const chosen = list.find(t => t.name === pick);
  return '<option value="">none</option>' + list.map(t => '<option value="' + t.tile + '"' + (t === chosen ? ' selected' : '') + '>' +
    svEsc(t.name) + ' (0x' + t.tile.toString(16).toUpperCase() + ')</option>').join('');
}

/* The frames the portraits share, as the ditherizer offers them
   (sharedPortraitFrames in js/delv-graphics.js finds them): every family
   but the two the list above names with their own rule for the hole
   (0x88A2, 0x88F2, frames drawn empty), and not a family whose shared pixels are mostly
   index 0, the white field the fountain, the door and two pictures that are
   not faces have in common rather than a frame. */
const DITHER_OWN_FRAMES = [0x88A2, 0x88F2];
function ditherSharedFrames() {
  return sharedPortraitFrames(ARCHIVE).filter(f => {
    if (f.members.some(r => DITHER_OWN_FRAMES.includes(r))) return false;
    let n = 0, white = 0;
    for (let i = 0; i < f.frame.length; i++) if (f.frame[i]) { n++; if (!f.image[i]) white++; }
    return white < n * 0.6;
  });
}
// Whose portraits wear a frame, by the names the file gives them.
function ditherFrameOwners(members) {
  const names = members.map(r => characterName(r - 0x87FF) || ('0x' + r.toString(16).toUpperCase()));
  if (names.length > 4) return names.slice(0, 2).join(', ') + ' and ' + (names.length - 2) + ' more';
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
}
/* A frame from the archive to set a picture in. 0x88A2 and 0x88F2 are
   frames drawn empty: the hole is the run of index 0 (white, the cut-out
   slot) that does not touch the outside. 0x887E, Ur-Sylph's framed
   portrait, had a rule of its own until 3 October 2026, its middle cleared
   from the first ring of background colour in; it is one of a family with
   Ignae and Omen, whose shared frame is found by comparing the three like
   every other family's, which the maintainer asked for. The picture is
   cover-cropped into the hole's box and the frame painted over it. */
function ditherFrameMask(resid) {
  // A portrait of a shared family: the family's frame, and the hole all it
  // does not cover.
  if (!DITHER_OWN_FRAMES.includes(resid)) {
    const f = sharedPortraitFrames(ARCHIVE).find(g => g.members.includes(resid));
    if (f) {
      const hole = new Uint8Array(4096);
      let x0 = 64, y0 = 64, x1 = -1, y1 = -1;
      for (let i = 0; i < 4096; i++) if (!f.frame[i]) { hole[i] = 1; const x = i % 64, y = (i - x) / 64; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return { W: 64, H: 64, frame: f.image, hole, box: x1 >= 0 ? { x0, y0, x1, y1 } : null };
    }
  }
  const b = getResourceBytes(ARCHIVE, resid);
  const d = decodeResource(ARCHIVE, b, 135, resid);
  const W = d.W, H = d.H, img = d.image;
  const hole = new Uint8Array(W * H);
  // The hole is the largest run of one colour that does not touch the
  // border: index 0 in 0x88A2, but 0x88F2 fills its window with index 17,
  // and looking for 0 there found nothing (the maintainer, 9 September
  // 2026). Every uniform region is flooded once; the biggest inner one wins.
  const comp = new Int32Array(W * H).fill(-1);
  let best = -1, bestN = 0, id = 0;
  const stack = [];
  for (let s0 = 0; s0 < W * H; s0++) {
    if (comp[s0] >= 0) continue;
    const c = img[s0]; let n = 0, edge = false;
    stack.push(s0); comp[s0] = id;
    while (stack.length) {
      const i = stack.pop(); n++;
      const x = i % W, y = (i - x) / W;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
      for (const j of [i - 1, i + 1, i - W, i + W]) {
        if (j < 0 || j >= W * H || comp[j] >= 0 || img[j] !== c) continue;
        if ((j === i - 1 && x === 0) || (j === i + 1 && x === W - 1)) continue;
        comp[j] = id; stack.push(j);
      }
    }
    if (!edge && n > bestN && n >= 64) { best = id; bestN = n; }
    id++;
  }
  if (best >= 0) for (let i = 0; i < W * H; i++) if (comp[i] === best) hole[i] = 1;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (hole[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { W, H, frame: img, hole, box: x1 >= 0 ? { x0, y0, x1, y1 } : null };
}
/* The ramp the five Seldane portraits are drawn in, read off them.

   Reading every colour they hold brought the frames' browns and the walls'
   greys with it, ninety indices (the maintainer, 9 September 2026), so the
   list was typed in instead: the green and blue ramps with the two cyans,
   matched by colour. That was "too stepped" (22 September 2026), because a
   photograph's colours landed on whichever green or blue was nearest. The
   faces are one ramp of lightness in one family: black, the dark blues and
   the grey-blues in the shadows, cyan 3 in the middle and cyan 11 in the
   light. So the ramp is the colours the five use, inside the frame, in the
   blue-cyan hues (170 to 250 degrees, saturation from a tenth), with black,
   each used at least twenty times; the ditherer places a pixel on it by
   lightness (ditherByTone). */
function seldaneTones() {
  if (DERIVED.SELDANE_TONES) return DERIVED.SELDANE_TONES;
  const count = new Uint32Array(256);
  for (let r = 0x8877; r <= 0x887B; r++) {
    try {
      const d = decodeResource(ARCHIVE, getResourceBytes(ARCHIVE, r), 135, r);
      for (let y = 9; y < d.H - 9; y++) for (let x = 9; x < d.W - 9; x++) count[d.image[y * d.W + x]]++;
    } catch (e) { quiet(e); }
  }
  const tones = [];
  for (let i = 1; i < 256; i++) {
    if (count[i] < 20 || (i >= 0xE0 && i <= 0xFB)) continue;
    const [r, g, b] = PAL_RGB[i];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === 0) { tones.push(i); continue; }                // black
    const l = (mx + mn) / 510, d = (mx - mn) / 255;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let h = 0;
    if (d) h = mx === r ? 60 * (((g - b) / (mx - mn)) % 6) : mx === g ? 60 * ((b - r) / (mx - mn) + 2) : 60 * ((r - g) / (mx - mn) + 4);
    if (h < 0) h += 360;
    if (s >= 0.1 && h >= 170 && h <= 250) tones.push(i);
  }
  return (DERIVED.SELDANE_TONES = tones);
}
function ditherDownloadGIF() {
  const d = window.DITHER_RESULT;
  if (!d) return;
  const anim = ditherAllowAnimated() && imageUsesAnimatedColors(d.indexed);
  const frames = anim ? Array.from({ length: 8 }, (_, f) => ({ indexed: d.indexed, palette: cycledPalette(f) })) : [{ indexed: d.indexed, palette: PAL_RGB }];
  downloadGIF(d.W, d.H, frames, 140, 'cythera_dithered.gif');
}

/* Which resources a mode can write into. The kinds and their pages:
   portrait 135 (0x88xx, 64×64 DCG), landscape 131 (0x84xx, 288×32 DCG),
   icon 137 (0x8Axx, 32×16 raw indices), sheet 141 (0x8Exx, 32×512 DCG,
   sixteen tiles in a column), and a sized graphic 142 (0x8Fxx, a four-byte
   header then DCG at the padded size). Every page's resources are offered,
   named where the file names them. */
const DITHER_KINDS = { portrait: 135, landscape: 131, icon: 137, sheet: 141, free: 142 };
function ditherKind() {
  const mode = (document.getElementById('dtMode') || {}).value || 'portrait';
  return /^frame:/.test(mode) || mode === 'items' ? 'portrait' : mode;
}
function ditherFillTargets() {
  const sel = document.getElementById('dtTarget');
  if (!sel) return;
  const subn = DITHER_KINDS[ditherKind()] || 135;
  const page = (subn + 1) << 8;   // 135 -> 0x8800, 131 -> 0x8400, 137 -> 0x8A00, 141 -> 0x8E00, 142 -> 0x8F00
  const keep = sel.value;
  const opts = [];
  for (let n = 0; n < 256; n++) {
    const rid = page + n;
    try { if (!getResourceBytes(ARCHIVE, rid)) continue; } catch (e) { continue; }
    opts.push('<option value="' + rid + '">0x' + rid.toString(16).toUpperCase() + (labelFor(rid) ? ', ' + svEsc(labelFor(rid)) : '') + '</option>');
  }
  sel.innerHTML = opts.join('');
  if (keep && [...sel.options].some(o => o.value === keep)) sel.value = keep;
}
/* The bytes a kind's resource holds, from the indexed picture. The sized
   header is the decoder's read backwards: fourteen bits of width over four,
   two of the remainder, fifteen of height over two, one of its remainder,
   most significant first, and the DCG buffer is the width rounded up to
   four. A sheet goes back from the 128×128 grid the page shows to the
   32×512 column the file keeps (reshapeTileSheetGrid's inverse). */
function encodeGraphicResource(kind, W, H, indexed) {
  if (kind === 'icon') return indexed.slice(0, 32 * 16);
  if (kind === 'sheet') {
    const col = new Uint8Array(32 * 512);
    for (let t = 0; t < 16; t++) {
      const gx = (t % 4) * 32, gy = Math.floor(t / 4) * 32;
      for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) col[(t * 32 + y) * 32 + x] = indexed[(gy + y) * 128 + (gx + x)];
    }
    return encodeDCGLiterals(col);
  }
  if (kind === 'free') {
    const flags = W & 3, wStored = (W - flags) >> 2, flags2 = H & 1, hStored = (H - flags2) >> 1;
    const logW = wStored * 4 + (flags ? 4 : 0), logH = H;
    const v = ((wStored << 18) | (flags << 16) | (hStored << 1) | flags2) >>> 0;
    const head = new Uint8Array([v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]);
    const buf = new Uint8Array(logW * logH);
    for (let y = 0; y < H; y++) buf.set(indexed.subarray(y * W, y * W + W), y * logW);
    const body = encodeDCGLiterals(buf);
    const out = new Uint8Array(4 + body.length); out.set(head, 0); out.set(body, 4);
    return out;
  }
  return encodeDCGLiterals(indexed);
}
function renderDither() {
  if (!_ditherSrc) return;
  const mode = document.getElementById('dtMode').value;
  const frameMode = /^frame:/.test(mode), itemMode = mode === 'items';
  const portrait = mode === 'portrait' || frameMode || itemMode;
  const kind = ditherKind();
  const FIXED = { landscape: [288, 32], icon: [32, 16], sheet: [128, 128] };
  const substWrap = document.getElementById('dtSubstWrap');
  if (substWrap) substWrap.style.display = kind === 'sheet' ? '' : 'none';
  const itemsRow = document.getElementById('dtItemsRow');
  if (itemsRow) itemsRow.style.display = itemMode ? '' : 'none';
  const img = _ditherSrc;
  let W, H, sx = 0, sy = 0, sw = img.width, sh = img.height;
  let fm = null;
  if (frameMode) {
    try { fm = ditherFrameMask(parseInt(mode.slice(6), 16)); } catch (e) { fm = null; }
  }
  if (portrait) {
    W = H = 64;
    // Cover crop: take the largest centred square.
    const side = Math.min(img.width, img.height);
    sx = (img.width - side) / 2; sy = (img.height - side) / 2;
    sw = sh = side;
  } else if (FIXED[kind]) {
    // Cover crop to the kind's own proportions.
    [W, H] = FIXED[kind];
    const k = Math.max(W / img.width, H / img.height);
    sw = W / k; sh = H / k;
    sx = (img.width - sw) / 2; sy = (img.height - sh) / 2;
  } else {
    const scale = Math.min(1, 512 / Math.max(img.width, img.height));
    W = Math.max(1, Math.round(img.width * scale));
    H = Math.max(1, Math.round(img.height * scale));
  }
  const work = document.createElement('canvas');
  work.width = W; work.height = H;
  const wc = work.getContext('2d', { willReadFrequently: true });
  if (fm && fm.box) {
    // the picture goes into the hole's box, cover-cropped to its shape
    const bw = fm.box.x1 - fm.box.x0 + 1, bh = fm.box.y1 - fm.box.y0 + 1;
    const k = Math.max(bw / img.width, bh / img.height);
    const cw = bw / k, ch = bh / k;
    wc.drawImage(img, (img.width - cw) / 2, (img.height - ch) / 2, cw, ch, fm.box.x0, fm.box.y0, bw, bh);
  } else wc.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  const rgba = wc.getImageData(0, 0, W, H).data;
  let indexed = ditherToCytheraPalette(rgba, W, H, {
    checker: (+document.getElementById('dtChecker').value) / 100,
    allowAnimated: ditherAllowAnimated(),
    tones: document.getElementById('dtSeldane').checked ? seldaneTones() : null
  });
  if (fm) {
    const out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = fm.hole[i] ? indexed[i] : fm.frame[i];
    indexed = out;
  }
  if (itemMode) {
    // the picture fills the square and the items go over its border
    const tileOf = id => { const v = (document.getElementById(id) || {}).value; return v ? resolveTileImage(+v) : null; };
    const items = itemFramePixels(tileOf('dtCorner'), tileOf('dtEdge'), W, H);
    const out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = items[i] || indexed[i];
    indexed = out;
  }
  window.DITHER_RESULT = { indexed, W, H, portrait, kind };
  const srcC = document.getElementById('dtSrc'), outC = document.getElementById('dtOut');
  srcC.width = W; srcC.height = H;
  srcC.getContext('2d').drawImage(work, 0, 0);
  drawToCanvas(outC, W, H, indexed, 0);
  const disp = Math.min(256, W * Math.max(1, Math.floor(256 / W)));
  for (const c of [srcC, outC]) {
    c.style.width = disp + 'px';
    c.style.imageRendering = 'pixelated';
  }
}

async function ditherDownloadPNG() {
  const d = window.DITHER_RESULT;
  if (!d) return;
  const png = await encodeIndexedPNG(d.W, d.H, d.indexed, PAL_RGB, 0);
  dlBlob(new Blob([png], { type: 'image/png' }), 'cythera_dithered.png');
}

function ditherReplace() {
  const d = window.DITHER_RESULT;
  if (!d) { setStatus('Load an image first.', true); return; }
  const resid = +document.getElementById('dtTarget').value;
  if (!resid) { setStatus('No resource of that kind to write into.', true); return; }
  if (applyResourceEdit(resid, encodeGraphicResource(d.kind || 'portrait', d.W, d.H, d.indexed))) {
    const t = document.getElementById('ditherTool');
    if (t) t.remove();
  }
}

// --- Locks and the keys that fit them ---------------------------------
// A door, gate, portcullis, chest or trunk with a nonzero first data byte is
// locked, and that byte is the LOCK ID; a key item (proptype 66) carries the
// id it opens in the same byte. Checked across every prop list in the
// archive: 111 of 408 such props are locked over 62 distinct ids, exactly 8
// key items exist, and all 8 match a lock -- no key opens nothing. The 54
// ids with no key are the lockpick's and the scripts' business, and the UI
// says so instead of hunting for a key that does not exist.
// Lockable is the class's own word for it since 19 September 2026: key 52
// of its table, what `has_member Lockable` answers (classHasMember). A
// name list stood here and disagreed with the file five times.
// The key's prop type is still a number: nothing in a class table says
// "this is a key" -- the lock's side is UseLock (53), and the key class
// carries only ClassFlags 0x08, which it shares with the amulet and the
// grimoire.
const KEY_PROPTYPE = 66;
DERIVED.KEY_LOCK_INDEX = null;
function buildKeyLockIndex() {
  if (DERIVED.KEY_LOCK_INDEX) return DERIVED.KEY_LOCK_INDEX;
  const locks = [], keys = [];
  for (let subN = 0; subN < 256; subN++) {
    const mr = 0x8000 + subN;
    let raw; try { raw = getResourceBytes(ARCHIVE, mr + 0x100); } catch (e) { continue; }
    if (!raw) continue;
    let recs; try { recs = parseDelverPropList(smartDecrypt(raw, mr + 0x100).data); } catch (e) { continue; }
    for (const r of recs) {
      if (r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44) continue;
      if (r.proptype === KEY_PROPTYPE) {
        if (r.d1) keys.push({ map: mr, id: r.d1, rec: r });
      } else if (r.d1 && classHasMember(r.proptype, 52)) {
        locks.push({ map: mr, id: r.d1, rec: r,
                     name: propDisplayName(r.proptype) || ('0x' + r.proptype.toString(16)) });
      }
    }
  }
  return (DERIVED.KEY_LOCK_INDEX = { locks, keys });
}
// A key by the letter it wears in the game, with the lock id it carries.
function keyLabel(k) { const L = itemLetter(k.rec); return 'key ' + (L ? L + ' (' + k.id + ')' : k.id); }
function keysForLock(id) { return buildKeyLockIndex().keys.filter(k => k.id === id); }
function locksForKey(id) { return buildKeyLockIndex().locks.filter(l => l.id === id); }

// Where a key IS, as a chip that goes there: to the square for a loose key,
// to the holder's dossier for a carried one, to the host container's square
// for one inside something.
function keyLocationChip(k) {
  const zone = zoneNameFor(k.map) || ('0x' + k.map.toString(16).toUpperCase());
  if (k.rec.carriedBy !== null)
    return '<button class="sv-chip" onclick="showCharacterDetail(' + k.rec.carriedBy + ')">' + keyLabel(k) +
      ', ' + svEsc(characterName(k.rec.carriedBy)) + (k.rec.equipped ? ' (equipped)' : ' carries it') + '</button>';
  let x = k.rec.x, y = k.rec.y, how = '';
  if (k.rec.container !== null) {
    let host = null;
    try {
      const raw = getResourceBytes(ARCHIVE, k.map + 0x100);
      host = parseDelverPropList(smartDecrypt(raw, k.map + 0x100).data)[k.rec.container];
    } catch (e) { quiet(e); }
    if (!host) return '';
    x = host.x; y = host.y;
    how = ', in a ' + svEsc((propDisplayName(host.proptype) || 'container'));
  }
  return '<button class="sv-chip" onclick="showSquareOnMap(' + k.map + ',' + x + ',' + y + ')">' + keyLabel(k) +
    ', ' + svEsc(zone) + how + '</button>';
}
function lockLocationChip(l) {
  const zone = zoneNameFor(l.map) || ('0x' + l.map.toString(16).toUpperCase());
  return '<button class="sv-chip" onclick="showSquareOnMap(' + l.map + ',' + l.rec.x + ',' + l.rec.y + ')">' +
    svEsc(l.name) + ', ' + svEsc(zone) + ' (' + l.rec.x + ',' + l.rec.y + ')</button>';
}

/* Open a map and land on one square: centred, ringed and inspected.

   Every link that names a coordinate (a schedule's post, a passage's
   destination, a teleporter, a key's door, "where X is") comes here. Two
   of the three copies this replaces waited a fixed time after opening the
   map -- 0 ms for the schedules, 900 ms for the rest -- and then set the
   pan; the map's own opening fit (restoreOrFitMap, on the frame after the
   render) ran after the 0 ms one and undid it, and on a slow phone after
   the 900 ms one too, which is why a link opened the zone and left the
   reader at the fit. Now the opener stamps MAP_SETTLED when its fit or
   restore has run, and the landing waits for that stamp, then zooms in to
   a legible square if the fit left it smaller, centres, rings and
   inspects. */
window.MAP_SETTLED = null;
function whenMapSettled(mapResid, fn, tries) {
  const cm = window.CUR_MAP, vp = document.getElementById('mapViewport');
  const ready = cm && cm.resid === mapResid && vp && vp.clientWidth >= 40;
  // The stamp makes the landing prompt; a map opened by a path that never
  // stamps (already open, or a stub with no animation frame) still lands,
  // after the old fixed wait.
  if (ready && (window.MAP_SETTLED === mapResid || (tries || 0) >= 18)) { fn(cm, vp); return; }
  if ((tries || 0) < 100) setTimeout(() => whenMapSettled(mapResid, fn, (tries || 0) + 1), 50);
}
function showSquareOnMap(mapResid, x, y) {
  if (!(window.CUR_MAP && window.CUR_MAP.resid === mapResid && window.MAP_SETTLED === mapResid)) {
    window.MAP_SETTLED = null;
    jumpToResource(mapResid);
  }
  whenMapSettled(mapResid, (cm, vp) => {
    const need = 20 / cm.TS;   // at least 20 px a square, or the ring is a dot
    if (mapView.scale < need) {
      mapView.scale = need;
      const zs = document.getElementById('mapZoomSlider'), zl = document.getElementById('mapZoomLabel');
      if (zs) zs.value = Math.round(need * 100);
      if (zl) zl.textContent = Math.round(need * 100) + '%';
    }
    mapView.x = vp.clientWidth / 2 - (x + 0.5) * cm.TS * mapView.scale;
    mapView.y = vp.clientHeight / 2 - (y + 0.5) * cm.TS * mapView.scale;
    clampMapPan(); applyMapTransform();
    try { updateMapArrows(); } catch (e) { quiet(e); }
    inspectMapSquare(x, y);
    setMapSelection(x, y);
  });
}

// --- An item's places, on the map itself ------------------------------
// The zone chips on an item's detail used to open the map and leave the
// finding to the reader. Now the map opens with every loose instance of
// the item ringed and the view centred on the first, the same after-load
// settle showCharacterOnMap uses.
/* The squares a prop type is found on in one map's records: its own square
   where it lies loose, and where it is inside something, the square of the
   container it is in (climbing through a pouch in a chest to the chest).
   Carried things have no square of their own and are left to the "Carried
   by" chips. Until 23 September 2026 only the loose ones were found, so a
   zone chip for something kept in a chest opened a map with nothing marked. */
function itemSpotsIn(recs, pt) {
  const out = [], seen = new Set();
  for (const r of recs || []) {
    if (r.proptype !== pt || r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44) continue;
    if (r.carriedBy !== null && r.carriedBy !== undefined) continue;
    let h = r, hops = 0;
    while (h && (h.flags & 0x58) && h.container !== null && h.container !== undefined && recs[h.container] && hops++ < 8) h = recs[h.container];
    if (!h || (h.flags & 0x58) || (h.carriedBy !== null && h.carriedBy !== undefined)) continue;
    const k = h.x + ',' + h.y;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ x: h.x, y: h.y, inside: h !== r ? h : null });
  }
  return out;
}
function showItemOnMap(mapResid, pt, which) {
  window.MAP_SETTLED = null;
  jumpToResource(mapResid);
  whenMapSettled(mapResid, (cm) => {
    const spots = itemSpotsIn(cm.allProps, pt);
    if (!spots.length) return;
    const at = spots[Math.max(0, Math.min(spots.length - 1, which || 0))];
    DERIVED.MAP_ITEM_SPOTS = { resid: mapResid, pt, cells: spots.map(s => [s.x, s.y]) };
    drawMapMarks();
    const vp = document.getElementById('mapViewport');
    if (vp) {
      mapView.x = vp.clientWidth / 2 - at.x * cm.TS * mapView.scale;
      mapView.y = vp.clientHeight / 2 - at.y * cm.TS * mapView.scale;
      clampMapPan(); applyMapTransform();
    }
    inspectMapSquare(at.x, at.y);
    setMapSelection(at.x, at.y);   // the ring, as well as the wash on every spot
  });
}
// The squares of one prop type in one zone, from the zone's prop list.
function itemSpotsInZone(propResid, pt) {
  try { const raw = getResourceBytes(ARCHIVE, propResid); return raw ? itemSpotsIn(parseDelverPropList(smartDecrypt(raw, propResid).data), pt) : []; }
  catch (e) { quiet(e); return []; }
}

function updateGalleryTools() {
  const wrap = document.getElementById('galleryTools');
  if (!wrap) return;
  const grid = document.getElementById('sheetGrid');
  const hasCells = grid && grid.querySelector('.cell');
  // A detail view is drawn into the grid, and it is not a gallery, whatever
  // cells it happens to carry (a portrait strip), so nothing below applies.
  const inGallery = currentMode === 'sheet' && !!hasCells && !window.DETAIL_VIEW;
  const on = ((galleryIsExportable() && currentMode === 'sheet') || inGallery) && !window.DETAIL_VIEW;
  wrap.style.display = on ? 'flex' : 'none';
  const exp = document.getElementById('exportBtn');
  if (exp) exp.style.display = galleryIsExportable() && currentMode === 'sheet' ? '' : 'none';
  const arr = document.getElementById('galleryArrange');
  if (arr) arr.style.display = inGallery ? 'flex' : 'none';
  // Every gallery gets the filter box, not just the three built from tables.
  const pw = document.getElementById('propFilterWrap');
  if (pw) pw.style.display = inGallery ? 'block' : 'none';

  const sw = document.getElementById('sheetShapeWrap');
  if (sw) sw.style.display = (window.CUR_SUBN === 141 && inGallery) ? 'inline-flex' : 'none';
  const db = document.getElementById('ditherBtn');
  if (db) db.style.display = (window.CUR_SUBN === 135 && inGallery) ? '' : 'none';
  // Edit bytes goes with any open resource, whatever it is shown as.
  const eb = document.getElementById('editAnyBtn');
  if (eb) eb.style.display = (currentMode === 'single' && currentResid != null) ? '' : 'none';
  // Change code goes with a script, which is what it can relink.
  const cb = document.getElementById('editCodeBtn');
  if (cb) cb.style.display = (currentMode === 'single' && currentResid != null && window.LAST_DECODED && window.LAST_DECODED.isScript && window.LAST_DECODED.resid === currentResid) ? '' : 'none';
  // The undither preview goes with one picture of a kind the undither
  // reads, and its label says which way the preview would go from here.
  const ub = document.getElementById('unditherBtn');
  if (ub) {
    const can = currentMode === 'single' && UNDITHER_SUBN.has(+window.CUR_SUBN);
    ub.style.display = can ? '' : 'none';
    if (can) ub.textContent = unditherOn() ? 'Preview dithered' : 'Preview undithered';
  }
  const ss = document.getElementById('gallerySortSel');
  if (ss && ss.value !== window.GALLERY_SORT) ss.value = window.GALLERY_SORT;
  const note = document.getElementById('exportNote');
  if (note && galleryIsExportable() && currentMode === 'sheet')
    note.textContent = window.CUR_RESIDS.length + ' resources in this gallery';
  else if (note) note.textContent = '';
  if (inGallery) applyGalleryArrangement();
  refreshLabelLegend();
}

/* ---------------------------------------------------------------------------
   Decoding a gallery only as far as the eye gets
   ---------------------------------------------------------------------------
   Every tile in a gallery used to be decoded the moment the category changed:
   180 tile sheets, or 142 portraits, decompressed and drawn before anything
   appeared. The retired resource fork browser had solved this with an
   IntersectionObserver, and this is the same pattern with one observer for the
   whole grid rather than one per tile (the map gallery had 42 of them).

   The observer is disconnected by stopAllViewActivity() when a view is torn
   down, so a gallery that is replaced does not leave its old tiles observed.
--------------------------------------------------------------------------- */
let _tileObserver = null;

function lazyTile(host, work) {
  if (typeof IntersectionObserver === 'undefined') { work(); return; }
  if (!_tileObserver) {
    _tileObserver = new IntersectionObserver(entries => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        _tileObserver.unobserve(e.target);
        const fn = e.target._tileWork;
        e.target._tileWork = null;
        if (fn) { try { fn(); } catch (err) { /* reported by the work itself */ } }
      }
    }, { rootMargin: '400px' });   // start a screen ahead of the scroll
  }
  host._tileWork = work;
  _tileObserver.observe(host);
}

function stopLazyTiles() {
  if (_tileObserver) { _tileObserver.disconnect(); _tileObserver = null; }
}

// The gallery tally cannot be printed once and left, now that tiles decode as
// they scroll into view. It says what is known so far, and how much is not.
let sheetStats = null;
function updateSheetSummary() {
  const s = sheetStats;
  const out = document.getElementById('output');
  if (!s || !out) return;
  const pending = s.total - s.ok - s.err - s.blank;
  out.textContent = 'Gallery: ' + s.ok + ' decoded, ' + s.err + ' errors' +
    (s.blank ? ', ' + s.blank + ' blank hidden' : '') +
    (pending > 0 ? ', ' + pending + ' still off screen' : '') +
    ' (' + s.total + ' total) in ' + (CATEGORY_NAMES[s.subn] || 'Unknown Category') + '.' +
    (s.subn === 131 ? ' Each strip is a picture a script chooses for the status window (SetLandscapeImage), drawn over the sky for the time of day, or with no sky where the script gives a negative number. Each cell says which zones and rooms use it.' : '');
}

function renderContactSheet() {
  const out = document.getElementById('output');
  const grid = document.getElementById('sheetGrid');
  grid.innerHTML = '';
  grid.classList.toggle('landscapeGrid', window.CUR_SUBN === 131);
  grid.classList.remove('scriptList');
  const subn = window.CUR_SUBN;
  /* Two galleries carry a rules card above the tiles, which is where the
     rule and the thing it describes finally sit together: the game's own
     writing over the text arrays (Writings, subindex 1) and who answers as
     whom over the conversations (Dialogue, 23). The grid is cleared once at
     the top of this function and never again, so a card put in here survives
     whichever branch below draws the tiles. */
  if (subn === 1) mechCardAboveGallery(grid, libraryMechSection);
  else if (subn === 23) mechCardAboveGallery(grid, talkMechSection);
  const resids = window.CUR_RESIDS || [];
  const isText = (subn === 0 || subn === 1 || subn === 128 || subn === 239 || (!CANONICAL_SIZE[subn] && !HAS_HEADER[subn] && !UNCOMPRESSED[subn] && !SOUND_CATEGORIES.has(subn)));
  let okCount = 0;   // the map/sound/text galleries below still tally directly

  // Maps render as real thumbnails rather than falling through to the
  // generic text branch.
  if (subn === 127) {
    for (const [resid, roff, rlen] of resids) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      const imgwrap = document.createElement('div');
      imgwrap.className = 'cellimgwrap';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:84px;height:84px;background:#12100c;border:1px solid #4a432f;image-rendering:pixelated';
      imgwrap.appendChild(canvas);
      cell.appendChild(imgwrap);
      const lbl = labelFor(resid);
      const lblDiv = document.createElement('div');
      lblDiv.className = 'lbl';
      applyLabel(lblDiv, resid);
      cell.appendChild(lblDiv);
      const residDiv = document.createElement('div');
      residDiv.className = 'resid';
      residDiv.textContent = '0x' + resid.toString(16).toUpperCase();
      cell.appendChild(residDiv);
      attachMapThumb(canvas, resid);
      cell.title = 'Click to open this map';
      cell.onclick = () => {
        openResource(resid);
      };
      grid.appendChild(cell);
      okCount++;
    }
    refreshLabelLegend();
  out.textContent = okCount + " maps.";
    return;
  }

  if (SOUND_CATEGORIES.has(subn)) {
    for (const [resid, roff, rlen] of resids) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.justifyContent = 'center';
      const miniWave = document.createElement('canvas');
      miniWave.width=160; miniWave.height=46; miniWave.style.cssText='width:84px;height:38px;background:#090806;border:1px solid #9b8850;margin-bottom:4px';
      // Decoding 46 sounds to draw 46 waveforms was the slowest gallery here.
      lazyTile(cell, () => {
      try { const snd=decodeSound(ARCHIVE.bytes.slice(roff,roff+rlen)); const c=miniWave.getContext('2d'), s=snd.samples, w=miniWave.width,h=miniWave.height,mid=h/2, step=Math.max(1,Math.ceil(s.length/w)); c.strokeStyle='#f9f86f'; c.beginPath(); for(let x=0;x<w;x++){let lo=32767,hi=-32768;for(let j=x*step;j<Math.min(s.length,(x+1)*step);j++){if(s[j]<lo)lo=s[j];if(s[j]>hi)hi=s[j];}c.moveTo(x,mid-hi/32768*(mid-2));c.lineTo(x,mid-lo/32768*(mid-2));}c.stroke(); } catch (e) { quiet(e); }
      });
      cell.appendChild(miniWave);
      const lbl = labelFor(resid);
      const lblDiv = document.createElement('div');
      lblDiv.className = lbl ? 'lbl' : 'lbl nolabel';
      applyLabel(lblDiv, resid);
      cell.appendChild(lblDiv);
      const residDiv = document.createElement('div');
      residDiv.className = 'resid'; residDiv.textContent = '0x' + resid.toString(16).toUpperCase();
      cell.appendChild(residDiv);
      const metaDiv = document.createElement('div');
      metaDiv.className = 'listMeta'; metaDiv.textContent = fmtBytes(rlen);
      cell.appendChild(metaDiv);
      cell.title = "Click to play/preview this sound";
      cell.onclick = () => {
        openResource(resid);
      };
      grid.appendChild(cell);
      okCount++;
    }
    refreshLabelLegend();
  out.textContent = "Gallery: " + okCount + " sound resources found. Click a tile to play.";
    return;
  } else if (isText) {
    /* A script read for its code (scriptPaneFor) is a row, not a tile: its
       name, id and class, the first of its prose, and what its code calls.
       The tile was 84 px square with the text at 10 or 11 px and cut after
       four lines, and for a script without strings it said "(binary, 153
       bytes)"; a hundred scripts of one class are a list to be read down,
       which is what the maintainer asked for on 23 September 2026. The
       cells keep .lbl and .resid, so the filter, the sort and the keyboard
       work on them as on any gallery. Scripts under Text, whose words are
       the point, keep their tiles. */
    const asCode = SCRIPT_SUBN.has(subn) && scriptPaneFor(String(subn)) === 'code';
    grid.classList.toggle('scriptList', asCode);
    if (asCode) {
      for (const [resid, roff, rlen] of resids) {
        const cell = document.createElement('div');
        cell.className = 'cell scriptRow';
        let o = null;
        try { o = scriptOutline(resid, roff, rlen); } catch (e) { quiet(e, 'the outline of 0x' + resid.toString(16)); }
        // The snippet leads with a skill's own name, which the row has just said.
        let prose = sheetTextSnippet(resid, roff, rlen, 160);
        const nm = labelFor(resid);
        if (nm && prose.startsWith(nm + ' \u00b7 ')) prose = prose.slice(nm.length + 3);
        const head = document.createElement('div');
        head.className = 'srHead';
        const lblDiv = document.createElement('div');
        if (labelFor(resid)) { lblDiv.className = 'lbl'; applyLabel(lblDiv, resid); }
        else { lblDiv.className = 'lbl srUnnamed'; lblDiv.textContent = (o && o.cls) || 'unnamed'; }
        head.appendChild(lblDiv);
        const residDiv = document.createElement('div');
        residDiv.className = 'resid'; residDiv.textContent = '0x' + resid.toString(16).toUpperCase();
        head.appendChild(residDiv);
        if (o && o.cls && labelFor(resid)) {
          const k = document.createElement('div'); k.className = 'srKind'; k.textContent = o.cls; head.appendChild(k);
        }
        cell.appendChild(head);
        if (!/^\(/.test(prose)) {
          const p = document.createElement('div'); p.className = 'srProse'; p.textContent = prose; cell.appendChild(p);
        }
        if (o && o.calls.length) {
          const c = document.createElement('div'); c.className = 'srCalls';
          c.textContent = o.calls.join(', '); cell.appendChild(c);
        }
        cell.onclick = () => { openResource(resid); };
        grid.appendChild(cell);
        okCount++;
      }
      refreshLabelLegend();
      out.textContent = "Gallery: " + okCount + " scripts.";
      return;
    }
    for (const [resid, roff, rlen] of resids) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.justifyContent = 'center';

      // A generic page glyph told you nothing about which resource this is.
      // Show what the bytes actually say, the same way the resource-fork
      // browser previews undecodable types.
      const snip = document.createElement('div');
      const text = sheetTextSnippet(resid, roff, rlen, 110);
      snip.className = 'cellChars' + (/^\(/.test(text) ? ' binary' : '');
      snip.textContent = text;
      snip.title = text;
      cell.appendChild(snip);

      const lbl = labelFor(resid);
      const lblDiv = document.createElement('div');
      lblDiv.className = lbl ? 'lbl' : 'lbl nolabel';
      applyLabel(lblDiv, resid);
      cell.appendChild(lblDiv);
      
      const residDiv = document.createElement('div');
      residDiv.className = 'resid'; residDiv.textContent = '0x' + resid.toString(16).toUpperCase();
      cell.appendChild(residDiv);
      const metaDiv = document.createElement('div');
      metaDiv.className = 'listMeta'; metaDiv.textContent = fmtBytes(rlen);
      cell.appendChild(metaDiv);

      cell.title = "Click to view text/data";
      cell.onclick = () => {
        openResource(resid);
      };
      grid.appendChild(cell);
      okCount++;
    }
    refreshLabelLegend();
  out.textContent = "Gallery: " + okCount + " text/data resources found.";
    return;
  }

  // Seeded before the loop, not after it: the lazy work below writes into this
  // object, and an IntersectionObserver that delivers its first callback
  // promptly would otherwise be counting into the previous gallery's tally.
  sheetStats = { subn, total: resids.length, ok: 0, err: 0, blank: 0 };
  for (const [resid, roff, rlen] of resids) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const imgwrap = document.createElement('div');
    imgwrap.className = 'cellimgwrap';
    const canvas = document.createElement('canvas');
    imgwrap.appendChild(canvas);
    cell.appendChild(imgwrap);
    const lbl = labelFor(resid);
    const lblDiv = document.createElement('div');
    lblDiv.className = lbl ? 'lbl' : 'lbl nolabel';
    applyLabel(lblDiv, resid);
    cell.appendChild(lblDiv);
    const residDiv = document.createElement('div');
    residDiv.className = 'resid'; residDiv.textContent = '0x' + resid.toString(16).toUpperCase();
    cell.appendChild(residDiv);
    // The list view's extra column: size now, pixel dimensions once decoded.
    const metaDiv = document.createElement('div');
    metaDiv.className = 'listMeta'; metaDiv.textContent = fmtBytes(rlen);
    cell.appendChild(metaDiv);
    // A landscape is chosen at run time: a zone's entry script names its
    // strip with SetLandscapeImage, and the game draws it behind the map's
    // edge. The zones that name this one are on the cell.
    if (subn === 131) {
      let zones = [];
      try { zones = landscapeZones(resid); } catch (e) { zones = []; }
      const z = document.createElement('div');
      z.className = 'resid';
      const said = new Set(), names = [];
      for (const st of zones) {
        const nm = landscapeSetterName(st.resid) + (st.sky ? '' : ', no sky');
        if (!said.has(nm)) { said.add(nm); names.push(nm); }
      }
      z.textContent = names.length ? names.join('; ') : 'set by no script';
      cell.appendChild(z);
    }
    // Decoded when the tile is nearly on screen, not now. A blank resource is
    // still hidden, but it can only be found to be blank by decoding it, so
    // the cell is removed at that point instead of never being added.
    lazyTile(cell, () => {
      try {
        const resData = ARCHIVE.bytes.slice(roff, roff+rlen);
        let {W,H,image} = decodeResource(ARCHIVE, resData, subn, resid);
        const shape = window.SHEET_SHAPE || 'grid';
        if (subn === 141) ({W,H,image} = reshapeTileSheet(W,H,image, shape));
        if (isCompletelyWhite(image)) {
          sheetStats.blank++;
          cell.remove();
          updateSheetSummary();
          return;
        }
        drawToCanvas(canvas, W, H, image, transparentIndexFor(subn));
        metaDiv.textContent = fmtBytes(rlen) + ' \u00b7 ' + W + '\u00d7' + H;
        if (subn === 141) drawSheetGridlines(canvas, W, H, shape);
        // The column and row shapes are long: give them a box that lets a
        // 16-tile strip read as one, rather than a thumbnail-sized smear.
        let boxW = subn === 131 ? 320 : 84, boxH = subn === 131 ? 110 : 110;
        if (subn === 141 && shape === 'row') { boxW = 340; boxH = 40; cell.style.minWidth = '360px'; }
        else if (subn === 141 && shape === 'column') { boxW = 40; boxH = 340; }
        else cell.style.minWidth = '';
        const scale = Math.min(boxW / W, boxH / H, 8);
        canvas.style.width = (W * scale) + 'px';
        canvas.style.height = (H * scale) + 'px';
        sheetStats.ok++;
      } catch(err) {
        canvas.width=32; canvas.height=32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#500'; ctx.fillRect(0,0,32,32);
        canvas.style.width = '48px'; canvas.style.height = '48px';
        cell.title = 'Decode error: ' + err.message;
        sheetStats.err++;
      }
      updateSheetSummary();
    });
    cell.onclick = (ev) => {
      if (ev.shiftKey) { downloadCanvasAsPNG(canvas, resid); return; }
      openResource(resid);
    };
    cell.title = "Click to view full size; Shift-click to save a PNG";
    grid.appendChild(cell);
  }
  // Blank resources are hidden on purpose, but the tally has to admit it: the
  // old line read "50 decoded, 0 errors" while 12 tiles had quietly vanished.
  // It now also admits how many have not been decoded yet.
  refreshLabelLegend();
  updateSheetSummary();
}

/* ---------------------------------------------------------------------------
   Keyboard
   ---------------------------------------------------------------------------
   The file had no key handlers at all: every gallery tile was a <div> with an
   onclick, so nothing in it could be reached, opened or stepped through
   without a mouse. Rather than edit the seven functions that build tiles, the
   grid is watched and any `.cell` that appears is given the button semantics
   it always behaved like -- which also covers galleries added later.
--------------------------------------------------------------------------- */
function enhanceCellsForKeyboard(root) {
  for (const cell of root.querySelectorAll('.cell')) {
    if (cell.dataset.kbd) continue;
    cell.dataset.kbd = '1';
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    if (!cell.getAttribute('aria-label')) {
      // The name and the caption as two phrases, not run together
      // ("beggar0x32 · 16 frames" was what a screen reader got).
      const parts = Array.from(cell.querySelectorAll('.lbl, .resid')).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
      const t = parts.length ? parts.join(', ') : (cell.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) cell.setAttribute('aria-label', t);
    }
  }
}

/* Something that scrolls sideways says so at its right edge while there is
   more past it: the class is the whole of what the script decides, and the
   stylesheet draws the fade (.ftabRow::after, .tableScroll.moreRight). A tab
   row is watched when it is rendered (renderTabRow); a table wrapper when
   the sheet that built it lands in the grid (the observer at boot). */
function scrollHintUpdate(el) {
  const more = el.scrollWidth - el.clientWidth - el.scrollLeft > 2;
  if (el.classList.toggle('moreRight', more) !== more) el.classList.toggle('moreRight', more);
  // And the left edge, once the row has been slid along (the maintainer,
  // 22 September 2026: the fade was on the right only).
  const back = el.scrollLeft > 2;
  if (el.classList.toggle('moreLeft', back) !== back) el.classList.toggle('moreLeft', back);
}
function scrollHintWatch(el) {
  if (!el) return;
  if (!el.dataset.scrollHint) {
    el.dataset.scrollHint = '1';
    el.addEventListener('scroll', () => scrollHintUpdate(el), { passive: true });
  }
  scrollHintUpdate(el);
}

/* A sheet's table reads as cards on a phone. A wide table used to slide
   sideways, so a bark's line or a rule's note started off the screen and a
   reader scrolled a row at a time to see what a cell belonged to (the
   maintainer, 13 and 22 September and 2 October 2026). This gives each cell
   its column's heading as data-label; the stylesheet, under 641px, sets a
   row out as a card: the first cell its title, every other cell a line of
   "heading  value" (table.asCards in index.html). Only the sheets' tables,
   .mechTable and .vocabTable with a header row, and the Data tab's two of
   prose (.cheatTable, the preferences record, and .cardTable, what a saved
   game holds): the Data tab's other byte and record tables (.forkTable) and
   a table whose columns are mostly figures are read down a column, and keep
   their grid and the sideways scroll. A
   table is labelled once and again when its row count changes, since some
   grow a page at a time. */
function tableCardsLabel(table) {
  const rows = table.tBodies.length ? table.tBodies[0].rows : null;
  if (!rows) return;
  if (table._cardRows === rows.length) return;
  table._cardRows = rows.length;
  if (!table._cardHeads) {
    const head = table.tHead && table.tHead.rows.length ? table.tHead.rows[table.tHead.rows.length - 1] : null;
    if (!head) { table._cardHeads = []; return; }
    const heads = [];
    for (const th of head.cells) {
      const t = (th.textContent || '').replace(/\s+/g, ' ').trim();
      for (let k = 0; k < (th.colSpan || 1); k++) heads.push({ t, num: th.classList.contains('num') });
    }
    table._cardHeads = heads;
    // Mostly figures: a grid, read down its columns.
    if (heads.length < 2 || heads.filter(h => h.num).length * 2 > heads.length) return;
    table.classList.add('asCards');
    if (table.parentElement && table.parentElement.classList.contains('tableScroll')) table.parentElement.classList.add('cardsWrap');
  }
  if (!table.classList.contains('asCards')) return;
  const heads = table._cardHeads;
  for (const tr of rows) {
    let col = 0;
    for (const td of tr.cells) {
      const span = td.colSpan || 1;
      const h = heads[col];
      if (span >= heads.length || !h || !h.t) td.classList.add('cardWide');
      else if (!(td.textContent || '').trim() && !td.querySelector('img, canvas, svg, input, button')) td.classList.add('cardEmpty');
      else {
        td.setAttribute('data-label', h.t);
        // The value goes in one element, so the heading and it are the
        // cell's two grid items: left loose, every run of text and every
        // chip in a cell was an item of its own and they split across the
        // two columns.
        if (col > 0 && !(td.childNodes.length === 1 && td.firstChild.classList && td.firstChild.classList.contains('cardVal'))) {
          const v = document.createElement('span');
          v.className = 'cardVal';
          while (td.firstChild) v.appendChild(td.firstChild);
          td.appendChild(v);
        }
      }
      col += span;
    }
  }
}

function gridColumnCount(grid) {
  const t = getComputedStyle(grid).gridTemplateColumns;
  const n = t && t !== 'none' ? t.trim().split(/\s+/).length : 1;
  return Math.max(1, n);
}

function installKeyboardShortcuts() {
  const grid = document.getElementById('sheetGrid');
  if (grid) {
    enhanceCellsForKeyboard(grid);
    new MutationObserver(() => enhanceCellsForKeyboard(grid))
      .observe(grid, { childList: true, subtree: true });
    grid.addEventListener('keydown', e => {
      const cell = e.target.closest && e.target.closest('.cell');
      if (!cell) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cell.click(); return; }
      const cells = Array.from(grid.querySelectorAll('.cell'));
      const i = cells.indexOf(cell);
      if (i < 0) return;
      const cols = gridColumnCount(grid);
      let j = null;
      if (e.key === 'ArrowRight') j = i + 1;
      else if (e.key === 'ArrowLeft') j = i - 1;
      else if (e.key === 'ArrowDown') j = i + cols;
      else if (e.key === 'ArrowUp') j = i - cols;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = cells.length - 1;
      if (j === null) return;
      e.preventDefault();
      const target = cells[Math.max(0, Math.min(cells.length - 1, j))];
      if (target) { target.focus(); target.scrollIntoView({ block: 'nearest' }); }
    });
  }

}

document.addEventListener('DOMContentLoaded', () => {
  // An error nothing caught used to go to the console and nowhere else, so
  // a click that did nothing had no explanation on a phone. It reaches the
  // status line now and the Tools sheet's list, with everything else that
  // fell back. ?loud=1 also prints each quiet failure to the console, for a
  // headless load that wants to count them (utilities/browser_check.mjs).
  try { window.LOUD_QUIET = /[?&]loud\b/.test(location.search); } catch (e) { quiet(e); }
  window.addEventListener('error', ev => {
    quiet(ev.error || ev.message, 'uncaught');
    try { setStatus('Something went wrong: ' + (ev.message || ev.error) + '. Tools lists what fell back.', true); } catch (e) { quiet(e); }
  });
  window.addEventListener('unhandledrejection', ev => {
    quiet(ev.reason, 'unhandled');
    try { setStatus('Something went wrong: ' + (ev.reason && ev.reason.message || ev.reason) + '. Tools lists what fell back.', true); } catch (e) { quiet(e); }
  });
  const slider=document.getElementById('zoomSlider');
  slider.addEventListener('pointerdown', e => { slider.setPointerCapture?.(e.pointerId); });
  slider.addEventListener('pointermove', e => { if(e.buttons){ const r=slider.getBoundingClientRect(); const min=+slider.min,max=+slider.max; slider.value=Math.round(min+(e.clientX-r.left)/r.width*(max-min)); applyZoom(); } });
  installArchiveDropTarget();
  installKeyboardShortcuts();
  // Every table wrapper a sheet builds gets its edge hint as it lands, and
  // every sheet's table its card labels (tableCardsLabel), and
  // a resize re-measures everything watched. Coalesced to a frame, since a
  // gallery landing is hundreds of insertions.
  try {
    const grid = document.getElementById('sheetGrid');
    let due = false;
    const sweep = () => {
      due = false;
      for (const t of document.querySelectorAll('table.mechTable, table.vocabTable, table.cheatTable, table.cardTable')) { try { tableCardsLabel(t); } catch (e) { quiet(e, 'labelling a table'); } }
      for (const el of document.querySelectorAll('.tableScroll, .ftabRow')) scrollHintWatch(el);
    };
    const queue = () => { if (due) return; due = true; (window.requestAnimationFrame || setTimeout)(sweep); };
    if (grid && typeof MutationObserver === 'function') new MutationObserver(queue).observe(grid, { childList: true, subtree: true });
    window.addEventListener('resize', () => { for (const el of document.querySelectorAll('[data-scroll-hint]')) scrollHintUpdate(el); });
  } catch (e) { quiet(e); }
  try { receiveFromCanvas(); } catch (e) { quiet(e); }
  try { for (const r of document.querySelectorAll('input[name="animMode"]')) r.checked = r.value === window.ANIM_MODE; } catch (e) { quiet(e); }
  window.addEventListener('hashchange', () => {
    if (_hashWrite) return;
    // Back or forward. Back to the trail's top pops it; anywhere else --
    // forward, or a hand-typed hash -- records the view being left, so the
    // crumb always names the previous page whichever button moved us.
    const trail = window.VIEW_TRAIL;
    const arrived = location.hash;
    if (trail.length && trail[trail.length - 1] === arrived) trail.pop();
    else if (_lastHash && _lastHash !== arrived && trail[trail.length - 1] !== _lastHash) trail.push(_lastHash);
    _navBack = true;
    try { applyDeepLink(); } finally { _navBack = false; }
    _lastHash = location.hash;
  });
  window.addEventListener('popstate', () => { _lastHash = _lastHash || location.hash; });
  loadDefaultArchive();
});
