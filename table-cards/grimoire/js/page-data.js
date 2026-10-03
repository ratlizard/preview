/* The Data sheets: the zone backdrops, the executable's keys and preferences record, cheats, the saved game, the installer, the combat AI, changes.

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
   last of these. File 9 of 14. */

/* ---- The backdrop behind a zone -----------------------------------------------
   Every zone's entry script calls SetLandscapeImage once, with a literal.
   Zero and up is a landscape strip (0x84xx); the negative numbers are the
   engine's own backdrops, and -1 -- Land King Hall, and only Land King Hall
   in the shipped archive -- is the wavy space drawn behind the ethereal
   void, whose tiles are three-quarters transparent. That backdrop is the
   pair 0x8F50/0x8F51, 144x144 each and the only two general graphics in
   that range, alternating. The other negatives (-9, -12, -13, -15, -16) have
   no image in the archive at all, so they are taken to be solid colours the
   engine keeps, and nothing is drawn for them. This is a reading of the
   scripts plus the one image pair that fits, not a documented rule.

   CORRECTION, 22 September 2026, from the program: that reading of the
   number is wrong. SetLandscapeImage is cbSetZonePic, which negates a
   negative argument and clears the outdoor flag, so -1 is landscape strip 1
   with no sky, and the strip is the picture in the status window, not
   anything behind the map (landscapeSetters, below). Nothing in that path
   touches 0x8F50/0x8F51. The void backdrop below is still keyed on -1 and
   still drawn, because what the game draws through Land King Hall's
   transparent void tiles was not read; the key is a coincidence of the one
   zone, not the rule it was taken for. */
function zoneLandscapeArg(level) {
  if (!DERIVED.ZONE_BACKDROPS) DERIVED.ZONE_BACKDROPS = Object.create(null);
  if (level in DERIVED.ZONE_BACKDROPS) return DERIVED.ZONE_BACKDROPS[level];
  let found = null;
  try {
    const resid = 0x1400 + level;
    const raw = getResourceBytes(ARCHIVE, resid);
    const data = raw && raw.length ? smartDecrypt(raw, resid).data : null;
    const disc = data ? dvmDiscover(data, resid) : null;
    if (disc && disc.tableOffset !== null) {
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (found !== null || disc.kinds[off] !== 'function') continue;
        let end = data.length;
        for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops;
        try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        for (let k = 0; k < ops.length; k++) {
          if (String(ops[k][2]) !== 'sys SetLandscapeImage') continue;
          const nx = ops[k + 1];
          if (!nx) break;
          const v = String(nx[3]);
          if (nx[2] === 'byte') found = parseInt(v, 16);
          else if (/^-?\d+$/.test(v)) found = parseInt(v, 10);
          break;
        }
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.ZONE_BACKDROPS[level] = found);
}
/* Who sets landscape strip n, and with or without a sky.

   SetLandscapeImage is the program's cbSetZonePic, and it is two things in
   one number: a negative argument is negated and the outdoor flag cleared,
   so -9 is strip 9 with no sky and 9 is strip 9 over the sky. It stores the
   strip in the one global TStatusWindow::ChangeOutdoor reads, and that
   routine draws 0x8400 plus it into the 288 by 32 picture in the status
   window, over DrawSky's sky of the hour when the flag is set and over a
   plain fill when it is not. Nothing else writes the global.

   So every strip a negative number names is used, which this page missed
   until 22 September 2026: it matched the signed argument against the
   strip number, so -1 (Land King Hall), -9 (the caves and cellars), -10,
   -12, -13, -15 and -16 were read as "set by no zone" and the strips they
   name as unused. And it read only the zones' entry scripts; three sub-zone
   scripts and one room script set a strip too. */
function landscapeSetters() {
  if (DERIVED.LANDSCAPE_SETTERS) return DERIVED.LANDSCAPE_SETTERS;
  const out = [];
  try {
    for (const e of buildScriptTextIndex()) {
      const ops = dvmOpsOf(e);
      for (let i = 0; i + 1 < ops.length; i++) {
        if (ops[i].text !== 'sys SetLandscapeImage') continue;
        const lit = /^(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(ops[i + 1].text);
        if (!lit) continue;
        const v = lit[1].replace('-', '').startsWith('0x') ? (lit[1][0] === '-' ? -1 : 1) * parseInt(lit[1].replace('-', ''), 16) : parseInt(lit[1], 10);
        out.push({ resid: e.resid, at: ops[i + 1].at, v, n: Math.abs(v), sky: v >= 0 });
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.LANDSCAPE_SETTERS = out);
}
// What names the script that sets it: the zone for an entry script, the
// resource's own label otherwise.
function landscapeSetterName(resid) {
  const hex = '0x' + resid.toString(16).toUpperCase();
  const hi = resid >> 8;
  if (hi === 0x14) return zoneNameFor(0x8000 + (resid & 0xFF)) || labelFor(resid) || hex;
  // A room's script: the room, in the zone whose egg places it.
  if (hi === 0x1B || hi === 0x1C || hi === 0x1E) {
    const eggs = roomEggIndex().get(resid - 0x1B00) || [];
    const zones = [...new Set(eggs.map(e => zoneLabel(e.zone)))];
    return 'room ' + (resid - 0x1B00) + (zones.length ? ' in ' + zones.join(', ') : '');
  }
  return labelFor(resid) || ('sub-zone script ' + hex);
}
// The setters of landscape strip `resid` (0x8400 + n).
function landscapeZones(resid) {
  const n = resid - 0x8400;
  return landscapeSetters().filter(s => s.n === n);
}
function zoneBackdrop(level) {
  return zoneLandscapeArg(level) === -1 && refExists(0x8F50) && refExists(0x8F51) ? [0x8F50, 0x8F51] : null;
}
const _backdropCanvases = derivedMap('_backdropCanvases');
function backdropPattern(ctx, resid, TS) {
  try {
    let c = _backdropCanvases.get(resid);
    if (!c) {
      const d = decodeResource(ARCHIVE, getResourceBytes(ARCHIVE, resid), 142, resid);
      c = document.createElement('canvas');
      // Index 0 is the transparent slot, and in the game the void behind it
      // is black; drawn opaque it came out as white with black waves.
      drawToCanvas(c, d.W, d.H, d.image, 0);
      _backdropCanvases.set(resid, c);
    }
    const pat = ctx.createPattern(c, 'repeat');
    const M = window.DOMMatrix;
    if (pat && pat.setTransform && TS !== 32 && typeof M === 'function') pat.setTransform(new M().scale(TS / 32));
    return pat;
  } catch (e) { return null; }
}
const _tileClearCache = derivedMap('_tileClearCache');
function tileHasTransparency(t) {
  if (_tileClearCache.has(t)) return _tileClearCache.get(t);
  let clear = false;
  try { const img = resolveTileImage(t); if (img) for (const v of img) if (!v) { clear = true; break; } } catch (e) { quiet(e); }
  _tileClearCache.set(t, clear);
  return clear;
}

/* ---- Data > Cythera Data > Data Fork ------------------------------------
   The file as it is: one row per subindex the master index points at, with
   the count and the bytes behind it and, for each one this page shows
   somewhere, the tab it shows it under. This is the map from the archive's
   own structure to the tree above it, and it is the view to start from when
   a subindex is not where you expected. */
/* THE KEYS, off the program. TMapWindow::KeyRoutine(short) is the map
   window's key handler, and what the Cheats sheet says about a key is read
   out of it here rather than kept in a table:

   - THE ROLLING WORD. The key's low byte is shifted into a global word
     (`clrlwi 0, key, 24` then `rlwimi 0, word, 8, 0, 23`), and the word is
     tested against constants as an `addis`/`cmplwi` pair, the compiler's way
     of comparing 32 bits: the constant is the `cmplwi` operand less the
     `addis` operand shifted up 16. The first such test is the cheat code,
     the others the CD words.
   - THE GATE. After the code's test the routine takes the address of a
     global record (`addi r, 2, d`), loads one byte of it and tests one bit;
     then it flips a byte (`lbz`, `cntlzw`, `srwi 5`, `stb`, a logical not)
     and prints one of two strings. The flipped byte's base register is the
     cheat flag the gated cases test first.
   - THE SWITCH. The key is sign-extended and searched by a binary tree of
     `cmpwi` and `bt`/`bf` on the less-than and equal bits. Rather than
     trusting the tree's shape, every key from -128 to 511 is run through it
     by an interpreter of those instructions; the address most keys reach is
     the default and every other address a case, with the keys that reach it
     and the compare that sent each there.
   - A CASE is the instructions from its address to the next case's: whether
     it begins by testing the cheat flag, the strings it loads through the
     TOC, the routines it calls with the constants loaded into r3 to r10
     just before, the bytes it flips, and whether it runs on into the next
     case without a branch.

   Every figure is { v, exe }, so the sheet links it to its instruction. */
function exeKeyRoutine() {
  const r = exeRoutineNamed('TMapWindow::KeyRoutine');
  const ops = exeOpsOf(r), img = appImage();
  if (!r || !ops.length || !img || !img.toc) return null;
  const index = a => { const k = (a - r.offset) / 4; return k >= 0 && k < ops.length && k === Math.floor(k) ? k : -1; };
  const string = o => {
    const d = o && o.d; if (!d || d.mn !== 'lwz' || d.ra !== 2) return null;
    const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
    const t = p && p.section !== undefined ? exeStringAt(p) : null;
    return t === null ? null : { v: t, exe: o.at };
  };
  const wordAt = i => {
    const a = ops[i] && ops[i].d, b = ops[i + 1] && ops[i + 1].d;
    return a && b && a.mn === 'addis' && b.mn === 'cmplwi' && b.ra === a.rd ? ((b.imm - (a.imm * 65536)) >>> 0) : null;
  };
  const out = { routine: r, gate: null, words: [], cases: [], volume: [], defaultAt: null, keyReg: null };
  const roll = exeFind(ops, 0, ops.length, d => d.mn === 'rlwimi' && d.sh === 8 && d.mb === 0 && d.me === 23);
  if (roll < 0) return null;
  out.shift = exeVal(ops[roll], ops[roll].d.sh);
  for (let i = roll; i + 1 < ops.length; i++) {
    const w = wordAt(i); if (w === null) continue;
    out.words.push({ v: decodeMacRoman(new Uint8Array([w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255])), word: w, exe: ops[i + 1].at, i });
  }
  if (!out.words.length) return null;
  // The gate: the record, its byte and bit, the flag flipped, the two lines.
  {
    const g = out.words[0], i = g.i + 2;
    const rec = exeFind(ops, i, 4, d => d.mn === 'addi' && d.ra === 2);
    const byte = rec >= 0 ? exeFind(ops, rec + 1, 2, d => d.mn === 'lbz' && d.ra === ops[rec].d.rd) : -1;
    const bit = byte >= 0 ? exeFind(ops, byte + 1, 2, d => /^(rlwinm|clrlwi)\.$/.test(d.mn) && d.mb === d.me && d.rs === ops[byte].d.rt) : -1;
    const flip = exeFind(ops, i, 16, d => d.mn === 'cntlzw');
    const load = flip >= 0 ? exeFindBack(ops, flip, 3, d => d.mn === 'lbz' && d.d === 0) : -1;
    const lines = [];
    for (let k = flip; k >= 0 && k < flip + 16 && lines.length < 2; k++) { const t = string(ops[k]); if (t) lines.push(t); }
    out.gate = {
      word: g, recordTocD: rec >= 0 ? ops[rec].d.imm : null,
      byte: byte >= 0 ? exeVal(ops[byte], ops[byte].d.d) : null,
      bit: bit >= 0 ? exeVal(ops[bit], ((31 - ops[bit].d.me) - ops[bit].d.sh + 32) % 32) : null,
      flagReg: load >= 0 ? ops[load].d.ra : null, flip: flip >= 0 ? exeVal(ops[flip], null) : null,
      on: lines[0] || null, off: lines[1] || null
    };
  }
  // The CD words: each with the key code that does the same, and the call.
  for (const w of out.words.slice(1)) {
    const alt = exeFind(ops, w.i + 2, 4, d => d.mn === 'cmpwi');
    const call = exeFind(ops, w.i + 2, 12, d => d.mn === 'bl');
    w.key = alt >= 0 ? exeVal(ops[alt], ops[alt].d.imm) : null;
    w.call = call >= 0 ? exeVal(ops[call], exeTargetName(ops[call].to)) : null;
  }
  // The switch.
  let root = -1;
  for (let k = 0; k + 3 < ops.length && root < 0; k++) {
    const d = ops[k].d, c = ops[k + 1].d, t = ops[k + 2].d, f = ops[k + 3].d;
    if (d && d.mn === 'extsh' && c && c.mn === 'cmpwi' && c.ra === d.ra && t && t.mn === 'bt' && t.bi === 2 && f && f.mn === 'bf' && f.bi === 0) root = k;
  }
  if (root < 0) return out;
  const reg = ops[root].d.ra;
  out.keyReg = ops[root].d.rs;
  const walk = key => {
    let i = root + 1, cr = 0, last = -1;
    for (let steps = 0; steps < 64 && i >= 0; steps++) {
      const d = ops[i].d;
      if (d && d.mn === 'cmpwi' && d.ra === reg) { cr = key < d.imm ? 8 : key > d.imm ? 4 : 2; last = i; i++; continue; }
      if (d && (d.mn === 'bt' || d.mn === 'bf') && d.bi <= 2) { const set = (cr & [8, 4, 2][d.bi]) !== 0; i = (d.mn === 'bt' ? set : !set) ? index(ops[i].at + d.disp) : i + 1; continue; }
      if (d && d.mn === 'b' && !d.aa) { i = index(ops[i].at + d.disp); continue; }
      return { i, last };
    }
    return null;
  };
  const reach = new Map();
  for (let key = -128; key < 512; key++) {
    const w = walk(key); if (!w) continue;
    if (!reach.has(w.i)) reach.set(w.i, { i: w.i, keys: [] });
    reach.get(w.i).keys.push({ v: key, exe: w.last >= 0 ? ops[w.last].at : null });
  }
  const groups = [...reach.values()].sort((a, b) => b.keys.length - a.keys.length);
  if (!groups.length) return out;
  out.defaultAt = ops[groups[0].i].at;
  const starts = groups.map(g => g.i).sort((a, b) => a - b);
  for (const g of groups.slice(1).sort((a, b) => a.keys[0].v - b.keys[0].v)) {
    const next = starts.find(k => k > g.i);
    const end = next === undefined ? ops.length : next;
    const body = ops.slice(g.i, end);
    const d0 = body[0] && body[0].d, d1 = body[1] && body[1].d, d2 = body[2] && body[2].d;
    const calls = [];
    body.forEach((o, k) => {
      if (o.mn !== 'bl' || o.to === null) return;
      const args = {};
      for (let j = k - 1; j >= Math.max(0, k - 8); j--) {
        const d = body[j].d; if (!d) continue;
        if (d.mn === 'bl') break;
        if (d.mn === 'li' && d.rd >= 3 && d.rd <= 10 && !(d.rd in args)) args[d.rd] = exeVal(body[j], d.imm);
      }
      calls.push({ v: exeTargetName(o.to).replace(/\(.*$/, ''), exe: o.at, args });
    });
    const tail = body[body.length - 1].d;
    out.cases.push({
      at: ops[g.i].at, keys: g.keys, ops: body,
      gated: d0 && d0.mn === 'lbz' && d0.ra === out.gate.flagReg && d0.d === 0 && d1 && d1.mn === 'cmplwi' && d1.imm === 0 && d2 && d2.mn === 'bt' ? exeVal(body[0], true) : null,
      strings: body.map(string).filter(Boolean), calls,
      flips: body.filter(o => o.mn === 'cntlzw').map(o => exeVal(o, null)),
      fallsInto: tail && tail.mn !== 'b' && tail.mn !== 'blr' && next !== undefined ? ops[next].at : null
    });
  }
  // The volume keys, tested before the switch: the step each adds and the
  // bound it is held to.
  for (let k = 0; k < root; k++) {
    const d = ops[k].d;
    if (!d || d.mn !== 'cmpwi' || !ops[k - 1] || !ops[k - 1].d || ops[k - 1].d.mn !== 'extsh' || ops[k - 1].d.rs !== out.keyReg) continue;
    const step = exeFind(ops, k + 1, 14, e => e.mn === 'addi' && e.ra === e.rd && e.ra !== 1 && e.ra !== 2 && (e.imm === 10 || e.imm === -10 || Math.abs(e.imm) < 64) && e.imm !== 0);
    if (step < 0 || ops[step].at - ops[k].at > 60) continue;
    const bound = exeFind(ops, step + 1, 6, e => e.mn === 'cmpwi');
    out.volume.push({ key: exeVal(ops[k], d.imm), step: exeVal(ops[step], ops[step].d.imm), bound: bound >= 0 ? exeVal(ops[bound], ops[bound].d.imm) : null });
  }
  return out;
}

/* The wall bitmap's test, off TGameViewer::MakeBitMap: the tile word masked
   to an index into the attribute table (`rlwinm r, tile, 2, mb, me`, the
   index shifted up two for the word table), then the attributes `andi.`-ed
   with a mask and compared with the same mask. */
function exeWallMask() {
  const ops = exeOpsNamed('TGameViewer::MakeBitMap');
  const t = exeFind(ops, 0, ops.length, d => d.mn === 'andi.' && d.imm);
  if (t < 0 || !ops[t + 1] || !ops[t + 1].d || ops[t + 1].d.mn !== 'cmpwi' || ops[t + 1].d.imm !== ops[t].d.imm) return null;
  const ix = exeFindBack(ops, t, 4, d => d.mn === 'rlwinm' && d.sh === 2);
  const tiles = ix >= 0 ? ((1 << (ops[ix].d.me - ops[ix].d.mb + 1)) - 1) : null;
  return tiles ? { mask: exeVal(ops[t], ops[t].d.imm), tiles: exeVal(ops[ix], tiles) } : null;
}
// Every C string a routine loads through the TOC, in order.
function exeStringsOf(name) {
  const img = appImage(); if (!img || !img.toc) return [];
  return exeOpsNamed(name).map(o => {
    const d = o.d; if (!d || d.mn !== 'lwz' || d.ra !== 2) return null;
    const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
    const t = p && p.section !== undefined ? exeStringAt(p) : null;
    return t === null ? null : { v: t, exe: o.at };
  }).filter(Boolean);
}

/* THE PREFERENCES RECORD, every use of it in the program. The record is the
   global the key routine's gate tests (its TOC displacement is read there),
   and every routine that takes its address (`addi r, 2, d`) is scanned for
   what it does with it:

   - a READ is a `lbz` of one of its bytes followed, within a few
     instructions and on the same register, by an extraction of some of the
     byte's bits -- a rotate-and-mask (`rlwinm`, `clrlwi`, `srwi`) or an
     `andi.` -- which says which bits the routine wants;
   - a WRITE is a `stb` into it preceded by an `rlwimi` (bits inserted, with
     the value when it was loaded by `li` just before, or "toggled" when it
     came out of a `cntlzw`) or an `ori`;
   - what CHOOSES a write is the compare tree it sits under (exeCaseValues:
     a menu item, a dialog item, a slider's position), and the routine's own
     menu or dialog (the constant it hands GetMenuHandle or GetNewDialog,
     and the item it hands GetDialogItem), so the page can name the item out
     of the application's MENU and DITL resources;
   - a Pascal string loaded after reads that initialise a control is that
     control's LABEL, for every read since the previous label.

   A byte loaded and not masked is not counted, so a field is only named by
   a routine that tests it. The scan runs once per program and is kept. */
function exePrefsAccess() {
  const pef = appPef(), img = appImage();
  if (!pef || !img || !img.toc || !pef.routines) return null;
  if (pef.prefsAccess !== undefined) return pef.prefsAccess;
  const keys = exeKeyRoutine();
  const recD = keys && keys.gate ? keys.gate.recordTocD : null;
  if (recD === null) return (pef.prefsAccess = null);
  const range = d => {
    if (d.mn === 'andi.') { const m = d.imm & 0xFF; if (!m) return null; const lo = 31 - Math.clz32(m & -m), hi = 31 - Math.clz32(m); return ((1 << (hi + 1)) - (1 << lo)) === m ? [lo, hi] : null; }
    if (!/^(rlwinm|clrlwi|rotlwi|srwi)\.?$/.test(d.mn) || d.mb === undefined || d.mb > d.me) return null;
    const lo = ((31 - d.me) - d.sh + 32) % 32, hi = ((31 - d.mb) - d.sh + 32) % 32;
    return lo <= hi && hi < 8 ? [lo, hi] : null;
  };
  const out = { recordTocD: recD, reads: [], writes: [], passes: [] };
  const lo16 = recD & 0xFFFF;
  for (const r of pef.routines) {
    // A cheap look before decoding: an addi from r2 whose low half is the
    // record's displacement.
    let seen = false;
    for (let a = r.offset; a + 4 <= r.offset + r.length && !seen; a += 4)
      if ((img.code[a] >> 2) === 14 && ((img.code[a + 1] & 31) === 2) && ((img.code[a + 2] << 8) | img.code[a + 3]) === lo16) seen = true;
    if (!seen) continue;
    const ops = exeOpsOf(r);
    const holds = new Set();
    const reads = [], labels = [];
    // The routine's own menu, dialog and dialog items, by the calls' constants.
    const callArg = (name, reg) => ops.map((o, k) => exeCalls(o, name) ? exeArgOf(ops, k, reg) : null).filter(Boolean);
    const menu = callArg('GetMenuHandle', 3)[0] || null, dialog = callArg('GetNewDialog', 3)[0] || null, items = callArg('GetDialogItem', 4);
    ops.forEach((o, i) => {
      const d = o.d; if (!d) return;
      const lab = exePascalAt(o); if (lab) labels.push({ i, lab });
      if (d.mn === 'addi' && d.ra === 2 && d.imm === recD) { holds.add(d.rd); return; }
      if (d.mn === 'lbz' && holds.has(d.ra)) {
        for (let j = i + 1; j < Math.min(ops.length, i + 9); j++) {
          const e = ops[j].d; if (!e) continue;
          const f = e.rs === d.rt ? range(e) : null;
          if (f) { reads.push({ i, routine: r, byte: exeVal(o, d.d), bits: exeVal(ops[j], f), label: null }); break; }
          if ((e.rd === d.rt || e.rt === d.rt) && e.mn !== 'rlwimi') break;
        }
      }
      if (d.mn === 'stb' && holds.has(d.ra)) {
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const e = ops[j].d; if (!e) continue;
          if ((e.mn === 'rlwimi' || e.mn === 'ori') && e.ra === d.rt) {
            let f = null, value = null;
            if (e.mn === 'ori') { f = range({ mn: 'andi.', imm: e.imm }); value = f ? exeVal(ops[j], (1 << (f[1] - f[0] + 1)) - 1) : null; }
            else {
              f = e.mb <= e.me && 31 - e.mb < 8 ? [31 - e.me, 31 - e.mb] : null;
              for (let k = j - 1; k >= Math.max(0, j - 8); k--) {
                const g = ops[k].d; if (!g) continue;
                if (g.mn === 'li' && g.rd === e.rs) { value = exeVal(ops[k], g.imm); break; }
                if (g.mn === 'cntlzw' && g.ra === e.rs) { value = exeVal(ops[k], 'toggled'); break; }
                if (g.rd === e.rs || g.rt === e.rs || (g.ra === e.rs && g.rs !== undefined)) break;
              }
            }
            if (!f) break;
            out.writes.push({ routine: r, byte: exeVal(o, d.d), bits: exeVal(ops[j], f), value, chosen: exeCaseValues(ops, i, 0, 300), menu, dialog, items });
            break;
          }
        }
      }
      if (d.mn === 'addi' && d.imm === 0 && holds.has(d.ra)) out.passes.push({ routine: r, exe: o.at });
      const dest = d.rd !== undefined ? d.rd : d.mn.startsWith('l') && d.rt !== undefined ? d.rt : undefined;
      if (dest !== undefined && holds.has(dest) && !(d.mn === 'addi' && d.ra === 2)) holds.delete(dest);
    });
    // Each label names the reads since the one before it, in a routine that
    // builds several controls that way (a dialog), and nowhere else.
    let prev = -1;
    const named = [];
    for (const { i, lab } of labels) { const got = reads.filter(x => x.i < i && x.i > prev && !x.label && i - x.i < 40); if (got.length) named.push({ lab, got }); prev = i; }
    if (new Set(named.map(n => n.got[0].byte.v + ':' + n.got[0].bits.v.join())).size >= 3) for (const n of named) for (const x of n.got) x.label = n.lab;
    out.reads.push(...reads);
  }
  return (pef.prefsAccess = out);
}

/* The record as fields: every run of bits some routine reads or writes, with
   who reads it, who writes it and what chooses each write, named from the
   application's own MENU, DLOG and DITL resources where a menu or a dialog
   chooses it and from the preferences dialog's labels where a control
   does. */
function exePrefFields() {
  const acc = exePrefsAccess(); if (!acc) return null;
  const fork = window.APP_RSRC;
  const res = (t, id) => { try { const e = fork && (fork.resourcesByType[t] || []).find(x => x.id === id); return e ? fork.dataOf(t, e) : null; } catch (e) { return null; } };
  const rows = new Map();
  const row = (byte, f) => { const k = byte + ':' + f[0] + ':' + f[1]; if (!rows.has(k)) rows.set(k, { byte, lo: f[0], hi: f[1], readers: [], writers: [] }); return rows.get(k); };
  for (const x of acc.reads) row(x.byte.v, x.bits.v).readers.push(x);
  for (const w of acc.writes) {
    const f = w.bits.v, r = row(w.byte.v, f);
    // The control this bit belongs to in a dialog that reads it with a label.
    const lab = acc.reads.find(x => x.label && x.byte.v === w.byte.v && x.bits.v[0] <= f[0] && x.bits.v[1] >= f[1]);
    let item = null;
    if (w.menu && w.chosen) {
      const m = res('MENU', w.menu.v), texts = m ? menuItemTexts(m) : [];
      item = { menu: w.menu, title: m ? pstr(m, 14).s : null, values: w.chosen.values, texts: w.chosen.values.map(v => texts[v - 1]).filter(Boolean), exe: w.chosen.exe };
    } else if (w.dialog) {
      const dl = res('DLOG', w.dialog.v), ditlId = dl && dl.length >= 20 ? ((dl[18] << 8) | dl[19]) : w.dialog.v;
      const texts = ditlItemTexts(res('DITL', ditlId));
      const values = w.value === null ? w.items.map(x => x.v) : w.chosen ? w.chosen.values : [];
      item = { dialog: w.dialog, ditl: ditlId, values, texts: values.map(v => texts[v - 1]).filter(Boolean), exe: w.value === null && w.items[0] ? w.items[0].exe : w.chosen ? w.chosen.exe : null };
    }
    r.writers.push(Object.assign({}, w, { label: lab ? lab.label : null, item }));
  }
  return [...rows.values()].sort((a, b) => a.byte - b.byte || b.hi - a.hi);
}

/* What the game stores when there are no preferences: TDelverApp::PostInitMac
   writes the whole record once for each processor class, each word loaded
   from the data section (`addi r, 2, d`, `lwz 0, 0(r)`, `stw 0, 0(record)`),
   and the compare tree above each write, over the answer Gestalt gave less
   one, says which processors get it. The selectors are the `lis`/`addi`
   pairs handed to Gestalt. */
function exePrefDefaults() {
  const acc = exePrefsAccess(); if (!acc) return null;
  const r = exeRoutineNamed('TDelverApp::PostInitMac'); const ops = exeOpsOf(r); if (!ops.length) return null;
  let rec = -1;
  for (let k = 0; k < ops.length && rec < 0; k++) if (ops[k].d && ops[k].d.mn === 'addi' && ops[k].d.ra === 2 && ops[k].d.imm === acc.recordTocD) rec = ops[k].d.rd;
  const out = { selectors: [], words: [] };
  ops.forEach((o, k) => {
    if (exeCalls(o, 'Gestalt')) {
      const hi = exeFindBack(ops, k, 6, d => d.mn === 'lis' && d.rd === 3), lo = hi >= 0 ? exeFind(ops, hi + 1, 3, d => d.mn === 'addi' && d.ra === 3) : -1;
      if (hi >= 0 && lo >= 0) { const w = ((ops[hi].d.imm * 65536) + ops[lo].d.imm) >>> 0; out.selectors.push({ v: String.fromCharCode(w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255), exe: ops[hi].at }); }
    }
    const d = o.d;
    if (d && d.mn === 'stw' && d.ra === rec && d.d === 0) {
      const load = exeFindBack(ops, k - 1, 5, e => e.mn === 'lwz' && e.rt === d.rt && e.d === 0);
      const src = load >= 0 ? exeFindBack(ops, load, 5, e => e.mn === 'addi' && e.ra === 2 && e.rd === ops[load].d.ra) : -1;
      // CodeWarrior may copy through the stack first: follow one hop.
      let base = src;
      if (base < 0 && load >= 0) {
        const stack = exeFindBack(ops, load, 4, e => e.mn === 'stw' && e.ra === 1);
        const l2 = stack >= 0 ? exeFindBack(ops, stack, 4, e => e.mn === 'lwz' && e.rt === ops[stack].d.rt && e.ra !== 1) : -1;
        base = l2 >= 0 ? exeFindBack(ops, l2, 4, e => e.mn === 'addi' && e.ra === 2 && e.rd === ops[l2].d.ra) : -1;
      }
      if (base < 0) return;
      const words = exeDataWords(exeTocOffset(ops[base].d.imm), 1);
      if (!words) return;
      out.words.push({ v: words[0] >>> 0, exe: ops[base].at, chosen: exeCaseValues(ops, k, -1, 300) });
    }
  });
  return out.words.length ? out : null;
}

/* The backdrop, read out of TBackdropWind::LoadPattern. The window behind
   every other window fills itself with one pattern, and which pattern is the
   only setting in the game that no menu item and no dialog control writes --
   the `Backdrop` ordinal, which nothing in the program stores at all.

   LoadPattern branches on the stored long. Below a constant it is a general
   graphic, whose resource id is the long plus a base the code adds with an
   `addis`/`addi` pair; at or above it, and for every negative, it is a
   'ppat' whose id is a base MINUS the long, made with `neg` and an `addi`.
   All three numbers are read here, so a build that moved any of them moves
   the choices with it. Which ids actually exist is then a question for the
   files rather than for the program: the graphics are the archive's, the
   pixel patterns the application fork's. */
function exeBackdropChoices() {
  const ops = exeOpsNamed('TBackdropWind::LoadPattern');
  if (!ops.length) return null;
  const get = ops.findIndex(o => exeCalls(o, 'GetPixPat'));
  const neg = get >= 0 ? exeFindBack(ops, get, 8, d => d.mn === 'neg') : -1;
  const sub = neg >= 0 ? exeFind(ops, neg + 1, 4, d => d.mn === 'addi' && d.ra === ops[neg].d.rd) : -1;
  const hi = ops.findIndex(o => o.d && o.d.mn === 'addis' && o.d.imm === 1 && o.d.ra !== 0);
  const lo = hi >= 0 ? exeFind(ops, hi + 1, 4, d => d.mn === 'addi' && d.ra === ops[hi].d.rd) : -1;
  const cmp = ops.findIndex(o => o.d && o.d.mn === 'cmpwi');
  if (sub < 0 || lo < 0 || cmp < 0) return null;
  return { limit: exeVal(ops[cmp], ops[cmp].d.imm),
           pixPat: exeVal(ops[sub], ops[sub].d.imm),
           graphic: exeVal(ops[lo], (0x10000 + ops[lo].d.imm) >>> 0) };
}

/* The startup wait: main tests the gate's bit and, when it is set, spins on
   TickCount until the tick count it started at plus a constant. */
function exeStartupWait(gate) {
  const ops = exeOpsNamed('main'); if (!ops.length || !gate || !gate.byte || !gate.bit) return null;
  const acc = exePrefsAccess();
  const read = acc && acc.reads.find(x => x.routine.name === 'main' && x.byte.v === gate.byte.v && x.bits.v[0] === gate.bit.v);
  if (!read) return null;
  const k = ops.findIndex(o => o.at === read.bits.exe);
  const tick = ops.findIndex((o, j) => j > k && exeCalls(o, 'TickCount'));
  const add = tick >= 0 ? exeFind(ops, tick + 1, 4, d => d.mn === 'addi' && d.ra === 3) : -1;
  return add >= 0 ? { read, ticks: exeVal(ops[add], ops[add].d.imm) } : null;
}

/* The preferences file's keys: every call of TPrefs's store and fetch
   routines, the key it passes in r4 (a Pascal string through the TOC, or a
   register loaded from one earlier) and, for SavePrefs and LoadPrefs, the
   length in r6. */
function exePrefKeys() {
  const kinds = { SavePrefs: 'write', SetFile: 'write', SetOrdinal: 'write', LoadPrefs: 'read', GetFile: 'read', GetOrdinal: 'read' };
  const out = new Map();
  for (const [name, dir] of Object.entries(kinds)) {
    for (const c of exeCallersOf('TPrefs::' + name)) {
      const ops = c.ops;
      let key = null, len = null;
      for (let j = c.i - 1; j >= Math.max(0, c.i - 12) && !key; j--) {
        const d = ops[j].d; if (!d) continue;
        if (d.mn === 'lwz' && d.rt === 4 && d.ra === 2) key = exePascalAt(ops[j]);
        else if ((d.mn === 'addi' || d.mn === 'mr') && d.rd === 4 && d.imm === 0 || (d.mn === 'mr' && d.ra === 4)) {
          const from = d.mn === 'mr' ? d.rs : d.ra;
          for (let k = j - 1; k >= 0 && !key; k--) { const e = ops[k].d; if (e && e.mn === 'lwz' && e.rt === from && e.ra === 2) key = exePascalAt(ops[k]); }
        }
      }
      if (name === 'SavePrefs' || name === 'LoadPrefs') len = exeArgOf(ops, c.i, 6);
      // An ordinal is a long inside the key's resource, picked by a short:
      // GetOrdinal(key, index, default) takes the fallback in r6 as well, and
      // that fallback is the only statement of a setting's default the
      // program makes.
      let index = null, dflt = null;
      if (name === 'GetOrdinal') { index = exeArgOf(ops, c.i, 5); dflt = exeArgOf(ops, c.i, 6); }
      else if (name === 'SetOrdinal') index = exeArgOf(ops, c.i, 5);
      if (!key) continue;
      if (!out.has(key.v)) out.set(key.v, { key, kind: name.replace(/^(Save|Load)Prefs$/, 'Prefs').replace(/^(Set|Get)/, ''), len: null, index: null, dflt: null, writers: [], readers: [] });
      const e = out.get(key.v);
      if (len && !e.len) e.len = len;
      if (index && e.index === null) e.index = index;
      if (dflt && e.dflt === null) e.dflt = dflt;
      e[dir === 'write' ? 'writers' : 'readers'].push({ routine: c.routine, exe: ops[c.i].at });
    }
  }
  return [...out.values()];
}

/* A COMPARE TREE, run for a value. A switch compiles to compares of one
   register against constants and branches on the less-than and equal bits,
   sometimes a chain (load, test, branch to the next load and test, body),
   sometimes a binary tree; either way which body a value reaches is what
   running the compares says. exeCaseValues finds the tree the instruction
   at `i` sits under -- the nearest compare before it, the compares,
   branches and reloads of the same register above that, and then back
   along the chain while an earlier identical test branches to this one's
   load -- runs every value from `lo` to `hi` through it, and answers the
   values that arrive at the body holding `i`, with the tested compare's
   address, and `all` when every value arrives (nothing chooses it). An
   instruction the compiler put between a compare and its branch that sets
   no flags is stepped over. */
function exeCaseValues(ops, i, lo, hi) {
  const at0 = ops.length ? ops[0].at : 0;
  const index = a => { const k = (a - at0) / 4; return k >= 0 && k < ops.length && k === Math.floor(k) ? k : -1; };
  let c = -1;
  for (let k = i - 1; k >= Math.max(0, i - 40) && c < 0; k--) { const d = ops[k].d; if (d && (d.mn === 'cmpwi' || d.mn === 'cmplwi')) c = k; }
  if (c < 0) return null;
  const reg = ops[c].d.ra;
  const isCmp = d => d && (d.mn === 'cmpwi' || d.mn === 'cmplwi') && d.ra === reg;
  const isBranch = d => d && (d.mn === 'bt' || d.mn === 'bf' || (d.mn === 'b' && !d.aa));
  const quietOp = (k) => { const d = ops[k] && ops[k].d, n = ops[k + 1] && ops[k + 1].d; return d && n && (n.mn === 'bt' || n.mn === 'bf') && !/\.$|^cmp|^b/.test(d.mn); };
  let root = c;
  while (root > 0 && (isCmp(ops[root - 1].d) || isBranch(ops[root - 1].d) || quietOp(root - 1))) root--;
  let load = root > 0 && ops[root - 1].d && (ops[root - 1].d.ra === reg || ops[root - 1].d.rt === reg || ops[root - 1].d.rd === reg) ? root - 1 : -1;
  // Back along a chain: an earlier identical load and test whose branch
  // lands on this load.
  for (let guard = 0; load >= 0 && guard < 64; guard++) {
    const word = ops[load].d.word, target = ops[load].at;
    let found = -1;
    for (let k = load - 1; k >= Math.max(0, load - 160) && found < 0; k--) {
      if (!ops[k].d || ops[k].d.word !== word) continue;
      for (let j = k + 1; j < Math.min(ops.length, k + 8); j++) {
        const d = ops[j].d;
        if (d && (d.mn === 'bt' || d.mn === 'bf') && ops[j].at + d.disp === target) { found = k; break; }
        if (d && (d.mn === 'bl' || d.mn === 'blr' || (d.mn === 'b' && !d.aa))) break;
      }
    }
    if (found < 0) break;
    load = found;
  }
  const loadWord = load >= 0 ? ops[load].d.word : null;
  const run = v => {
    let k = load >= 0 ? load : root, cr = 0;
    for (let steps = 0; steps < 128 && k >= 0; steps++) {
      const d = ops[k].d;
      if (d && d.word === loadWord) { k++; continue; }
      if (isCmp(d)) {
        const x = d.mn === 'cmplwi' ? v >>> 0 : v, y = d.mn === 'cmplwi' ? d.imm >>> 0 : d.imm;
        cr = x < y ? 8 : x > y ? 4 : 2; k++; continue;
      }
      if (d && (d.mn === 'bt' || d.mn === 'bf') && d.bi <= 2) { const set = (cr & [8, 4, 2][d.bi]) !== 0; k = (d.mn === 'bt' ? set : !set) ? index(ops[k].at + d.disp) : k + 1; continue; }
      if (d && d.mn === 'b' && !d.aa) { k = index(ops[k].at + d.disp); continue; }
      if (quietOp(k)) { k++; continue; }
      return k;
    }
    return -1;
  };
  const arrive = new Map();
  for (let v = lo; v <= hi; v++) { const t = run(v); if (t < 0) continue; if (!arrive.has(t)) arrive.set(t, []); arrive.get(t).push(v); }
  let best = -1;
  for (const t of arrive.keys()) if (t <= i && t > best) best = t;
  if (best < 0) return null;
  // A branch between the body's start and `i` that leaves the body means
  // `i` is not in it.
  for (let k = best; k < i; k++) { const d = ops[k].d; if (d && (d.mn === 'blr' || (d.mn === 'b' && !d.aa && index(ops[k].at + d.disp) > i))) return null; }
  const values = arrive.get(best);
  return { values, all: values.length === hi - lo + 1, exe: ops[c].at, root: ops[load >= 0 ? load : root].at };
}

// The constant a call is handed in r3 (or `reg`), loaded just before it.
function exeArgOf(ops, callIndex, reg) {
  for (let j = callIndex - 1; j >= Math.max(0, callIndex - 8); j--) {
    const d = ops[j].d; if (!d) continue;
    if (d.mn === 'bl') return null;
    if (d.mn === 'li' && d.rd === (reg || 3)) return exeVal(ops[j], d.imm);
  }
  return null;
}
// A Pascal string a TOC slot points at, or null.
function exePascalAt(op) {
  const img = appImage(), d = op && op.d;
  if (!img || !d || d.mn !== 'lwz' || d.ra !== 2) return null;
  const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
  if (!p || p.section === undefined) return null;
  const b = img.contents[p.section] && img.contents[p.section].bytes; if (!b) return null;
  const n = b[p.offset]; if (!n || p.offset + n >= b.length) return null;
  for (let k = 1; k <= n; k++) if (b[p.offset + k] < 0x20) return null;
  return { v: decodeMacRoman(b.subarray(p.offset + 1, p.offset + 1 + n)), exe: op.at };
}

/* THE FILES BESIDE THE GAME, and the two ways besides Magpie that a patch
   reaches it. Read 1 October 2026 (cythera-workbench's
   doc/engine-patch-list.md has the whole reading and the runs that showed it
   in the fork and on Mac OS 8.5); the Patches tab's first section says it.

   - TDelverApp::PostInitMac makes a spec in the application's own folder
     for the name in one STR resource, and opens it (Cythera Data); then
     for another, opened as a resource file when it is there (Cythera
     Patch). Two GetString calls, each after `li 3, id`; the names are those
     resources of the application's fork.
   - TDelverApp::OpenScenFile reads a string list with GetIndString (`li 4,
     id`) in a loop whose index is set by a `li` before it and stopped by a
     `cmpwi` after, and opens each name it finds in the same folder as a
     patch archive. The list is in no shipped file, so the resource file of
     the second name is where it would come from.
   - Then it makes a spec for a name a TOC slot holds (User Custom Data) and
     opens it, the last file the game loads, with no check of its header.

   Each part is a figure with the instruction that holds it, or null when the
   shape is not found, so an edited program drops the sentence rather than
   stating the shipped one. */
function exePatchFiles() {
  return exeMemo('patchFiles', () => {
    if (!appImage()) return null;
    const fork = window.APP_RSRC;
    const str = id => {
      try {
        const e = fork && (fork.resourcesByType['STR '] || []).find(x => x.id === id);
        const b = e ? fork.dataOf('STR ', e) : null;
        return b && b.length > 1 ? decodeMacRoman(b.subarray(1, 1 + b[0])) : null;
      } catch (err) { quiet(err, 'reading a STR resource of the program'); return null; }
    };
    const named = (val) => val ? { id: val, name: str(val.v) } : null;
    const init = exeOpsNamed('TDelverApp::PostInitMac');
    const gets = [];
    init.forEach((o, i) => { if (exeCalls(o, 'GetString')) gets.push(exeArgOf(init, i, 3)); });
    const scen = exeOpsNamed('TDelverApp::OpenScenFile');
    const gi = scen.findIndex(o => exeCalls(o, 'GetIndString'));
    let list = null, first = null, bound = null, custom = null;
    if (gi >= 0) {
      list = exeArgOf(scen, gi, 4);
      // The index is the register `addi 5, rX, 0` hands GetIndString; the
      // loop sets it with a `li` before and compares it after.
      const ai = exeFindBack(scen, gi, 8, d => d.mn === 'addi' && d.rd === 5 && d.imm === 0);
      const reg = ai >= 0 ? scen[ai].d.ra : null;
      if (reg !== null) {
        const li = exeFindBack(scen, ai, 16, d => d.mn === 'li' && d.rd === reg);
        if (li >= 0) first = exeVal(scen[li], scen[li].d.imm);
        const cmp = exeFind(scen, gi, 140, (d, o) => d.mn === 'cmpwi' && scen[scen.indexOf(o) - 1] && scen[scen.indexOf(o) - 1].d && scen[scen.indexOf(o) - 1].d.rs === reg);
        if (cmp >= 0) bound = exeVal(scen[cmp], scen[cmp].d.imm);
      }
      // The spec made from a name a TOC slot holds, after the loop.
      for (let i = gi; i < scen.length && !custom; i++) {
        if (!exeCalls(scen[i], 'FSMakeFSSpec')) continue;
        const l = exeFindBack(scen, i, 6, d => d.mn === 'lwz' && d.rt === 5 && d.ra === 2);
        if (l >= 0) custom = exePascalAt(scen[l]);
      }
    }
    const count = first && bound ? { v: bound.v - first.v, exe: bound.exe } : null;
    return { data: named(gets[0]), patch: named(gets[1]), list, count, custom };
  });
}

/* ---- Data > Cythera (App) > Cheats ---------------------------------------
   Cythera has a cheat mode, and until 5 September 2026 nobody could reach it.
   The Cutting Room Floor lists a "potential cheat mode" and stops there; this
   is why it stayed potential, and what is behind it.

   EVERYTHING ABOUT THE KEYS IS READ OUT OF THE PROGRAM as the sheet opens:
   exeKeyRoutine walks TMapWindow::KeyRoutine for the gate, the cases and the
   CD words, exePrefFields scans the whole program for the preferences
   record, exePrefDefaults and exeStartupWait read what the game stores and
   waits on. What is typed here is only what the program cannot say: the
   title of each key, a sentence around the figures, and which option-key a
   Mac Roman character is on a US keyboard. Until 11 September 2026 the
   tables themselves were typed from a trace made outside the page; reading
   them corrected three things: the speed limiter is $C2 (option-l), which
   the typed table gave as $C1; the frame-rate cap is a four-bit field that
   the Preferences menu sets to 4, 6 or 8, not two bits; and byte 1's bits 4
   and 5 are written, by the startup dialog that offers to switch to 256
   colours, where the typed table called them written by nothing.

   The gate is why this page can offer the mode at all: `writeResourceFork`
   arrived in v1.18.0 and the Preferences tab writes a `Cythera Preferences` file
   with that bit set. Verified once in systemless on 5 September 2026, the
   code typed, "Cheat mode activated." printed, and option-shift-/ answering
   with the player's position in hex.

   `myprintf` writes to the status window and `mygetnum` reads a number typed
   there, in the base the call is handed. */
// The option layer of a US keyboard, by Mac Roman code: which keys make the
// characters the key routine tests. Layout knowledge, not the program's.
const US_OPTION_KEYS = { 0xA9: 'option-g', 0xC6: 'option-j', 0xEF: 'option-shift-j', 0xA7: 'option-s', 0xB9: 'option-p',
  0xC0: 'option-shift-/', 0xFF: 'option-shift-t', 0xA0: 'option-t', 0xC3: 'option-v', 0xBD: 'option-z', 0xB5: 'option-m',
  0xB7: 'option-w', 0xFA: 'option-h', 0xFE: 'option-shift-x', 0xA8: 'option-r', 0xC5: 'option-x', 0xCA: 'option-space',
  0xC2: 'option-l', 0xC1: 'option-1' };
// What each case is, by the key that reaches it: a title, and a sentence
// built from what the case was read to do (`x`, the helpers in
// renderCheatsSheet). A key the program does not have is not listed.
const CHEAT_KEY_WORDS = {
  0xC6: ['Jump', x => 'Shows ' + x.q(0) + ' with where you are, asks ' + x.prompts(1).join(', ') + ' ' + x.base() + ', then ' + x.via('GoToLocation', 'takes you there') + ': anywhere in the game.'],
  0xEF: ['Take teleporter', x => 'Asks ' + x.q(0) + ' ' + x.base() + ', then ' + x.via('TeleportTo', 'sends you') + ' where that teleporter goes.'],
  0xA7: ['Create a prop', x => 'Asks ' + x.asks() + ', then ' + x.via('NewProp', 'puts the thing') + ' in the hero’s pack. ' +
    'The number is the type plus 1,024 times the aspect: 0x0064 is a spear, and 0x0864 a spear at aspect 2, which takes the picture and name two tiles along but fights as a spear. Each item’s page under Entities › Items shows its number.'],
  0xB9: ['What prop is this?', x => 'Asks ' + x.q(0) + ' ' + x.base() + ' and prints the record: class, state, position, Data1 and Data2.' +
    (x.fallsInto ? ' Then, because of a missing jump, it carries on into ' + x.fallsInto + '.' : '')],
  0xC0: ['Where am I?', x => 'Prints your x and y as ' + x.q(0) + '.'],
  0xFF: ['What time is it?', x => 'Prints ' + x.q(0) + ', the clock and the day.'],
  0xA0: ['Pass the time', x => x.via('DoTicks', 'Passes') + ' ' + x.arg('DoTicks', 4) + ' clock units' + x.clockWords('DoTicks', 4) + '.'],
  0x3C: ['Darken', x => x.via('DarkenLight', 'Darkens') + ' the level’s light a step.'],
  0x3E: ['Brighten', x => x.via('BrightenLight', 'Brightens') + ' the level’s light a step.'],
  0xC3: ['Magic map', x => 'Shows the ' + x.via('MagicMap', 'magic map') + ' around you until you click.'],
  0xBD: ['Show the room you are in', x => x.via('CopyBits', 'Shows') + ' the ground you can reach from where you stand, until you click. The magic map starts from it.'],
  0xB5: ['Show the walls', x => x.walls()],
  0xB7: ['Walk through anything', x => 'Nothing blocks you while it is on (' + x.flip() + ').'],
  0xFA: ['Nobody is anybody’s enemy', x => x.peace()],
  0xFE: ['See in the dark', x => 'Switches flag ' + x.flag() + ' on and off for you.'],
  0xA8: ['Regenerate', x => 'Switches flag ' + x.flag() + ' on and off for you: the healing every six minutes that Omen’s ring gives.'],
  0xC5: ['Swamp protection (broken)', x => x.broken()],
  0xCA: ['Turn-based movement', x => 'Switches it on and off (' + x.flip() + ') and prints ' + x.q(1) + ' or ' + x.q(0) + '.'],
  0xC2: ['Speed limiter', x => 'Switches the ' + x.via('SLEnable', 'speed limit') + ' on and off (' + x.flip() + ').'],
  0x31: ['A party member’s window', x => 'Opens a party member’s window by number, 1 for the first, or ' + x.via('FindInventory', 'brings it to the front') + '.'],
  0x5A: ['Z stats', x => 'Prints ' + x.zstats() + '.'],
  0x100: ['Macros', x => 'Keys that type no character run a ' + x.via('PerformMacro', 'macro') + '.']
};

/* The menu bars the application ships, off its own fork: TApp::ChangeMenuBar
   builds the bar from MBAR n (deleted) and MBAR n + 1 (inserted), so the
   menus a player can reach are the ids those two resources list. Every MENU
   the fork defines that neither names is unreachable; on the shipped copy
   that is Edit, Audio and Preferences, and add-on 612 is the seven-byte
   patch that appends them to MBAR 128. Null without the application's fork. */
function shippedMenuBars() {
  const fork = window.APP_RSRC;
  if (!fork) return null;
  const titles = new Map();
  for (const e of (fork.resourcesByType['MENU'] || [])) {
    try { const d = fork.dataOf('MENU', e); titles.set(u16be(d, 0), pstr(d, 14).s); } catch (err) { quiet(err); }
  }
  const bars = [];
  const listed = new Set();
  for (const e of (fork.resourcesByType['MBAR'] || [])) {
    let d; try { d = fork.dataOf('MBAR', e); } catch (err) { continue; }
    const ids = [];
    for (let i = 0, p = 2; i < u16be(d, 0) && p + 2 <= d.length; i++, p += 2) ids.push(u16be(d, p));
    ids.forEach(id => listed.add(id));
    bars.push({ id: e.id, menus: ids.map(id => ({ id, title: titles.get(id) || null })) });
  }
  const unlisted = [...titles].filter(([id]) => !listed.has(id)).map(([id, title]) => ({ id, title })).sort((a, b) => a.id - b.id);
  return { bars, unlisted };
}

/* The numbers the jump and teleporter keys ask for, read off the archive. A
   level is the low byte of a map resource id, so the table is every 0x80xx
   the file holds; a teleporter is an index into 0xF00C, the zoneport table
   loadZoneports already reads for the World tab, and the last index with a
   destination in it is the last number that goes anywhere. Above it every
   entry is map 0 at (0,0), which is where the community found BF and above
   landing (web board topic 1830). */
function cheatLevels() {
  const out = [];
  for (let n = 0; n < 0x100; n++) {
    const resid = 0x8000 + n;
    if (!refExists(resid)) continue;
    const script = zoneNameFor(resid), editor = editorZoneName(resid);
    out.push({ n, resid, name: script || editor || labelFor(resid) || ('0x' + resid.toString(16).toUpperCase()), editor, script });
  }
  return out;
}
function cheatTeleporters() {
  const z = loadZoneports();
  let last = 0;
  for (let i = 1; i < z.length; i++) if (z[i].map !== 0x8000 || z[i].x || z[i].y) last = i;
  const byMap = new Map();
  for (let i = 1; i <= last; i++) {
    const t = z[i];
    if (!byMap.has(t.map)) byMap.set(t.map, []);
    byMap.get(t.map).push({ n: i, x: t.x, y: t.y });
  }
  return { last, total: z.length, byMap };
}

/* LEVEL 0 IS THE NOTHING MAP, and its grid is a heap snapshot. The map has a
   header (32 by 32, no roof, no exits) and no prop list; every one of its
   tile words has a zero high byte, so the grid is 1,024 bytes of memory
   widened to words. Those bytes are allocator blocks laid end to end, each
   opening with a 16-byte header: a pointer 0x02C6xxxx, a tag 0xAB0000nn, the
   block's size (0x20 to 0x50), a back-pointer. The size field is the
   distance to the next header, and that is the test: add it to a header's
   position and you land on the next header, 18 times of 19 on the shipped
   file, where the same test on a real map finds no header at all (the
   workbench's own control, matching on each map's commonest byte pair,
   scored 0 of 101, 0 of 110, 0 of 219 and 0 of 49). Two tests that look
   decisive and are not, so they are not tried again: every word below 256
   is true of six real maps too, and adjacent-tile agreement is 39% here
   against 40% and 41% on real maps. The reading is the workbench's
   (doc/cheats.md); this computes it off whatever file is open. */
function nothingMapHeap(resid) {
  const m = getResourceBytes(ARCHIVE, resid);
  if (!m || m.length < 48) return null;
  const words = [];
  for (let i = 32; i + 1 < m.length; i += 2) words.push((m[i] << 8) | m[i + 1]);
  const high = words.filter(w => w > 255).length;
  const b = words.map(w => w & 255);
  const heads = [];
  for (let p = 0; p + 12 <= b.length; p++)
    if (b[p] === 0x02 && b[p + 1] === 0xC6 && b[p + 4] === 0xAB && b[p + 5] === 0 && b[p + 6] === 0 &&
        b[p + 8] === 0 && b[p + 9] === 0 && b[p + 10] === 0) heads.push(p);
  let hits = 0;
  for (const p of heads) if (heads.includes(p + b[p + 11])) hits++;
  return { words: words.length, high, heads: heads.length, hits, w: u16be(m, 0), h: u16be(m, 2) };
}

/* Every prop class some character record wears, named from the archive. This
   is the trick the community did with Pandora's Box, search the running
   game for the short 32, change it, and be a chicken, turned into a field:
   the Saved Game sheet edits `sprite class` on any record, and these are the
   numbers that mean somebody. BreadWorldMercy453's 1999 list was gathered by
   trying values; this one is read off 0xF009, so it cannot drift. */
function cheatSpriteClasses() {
  const seen = new Map();
  const add = (pt, kind) => {
    if (!pt || seen.has(pt)) return;
    let nm = null;
    try { nm = propDisplayName(pt); } catch (e) { quiet(e); }
    if (nm) seen.set(pt, { pt, name: nm, kind });
  };
  // The people first, then the monsters: 0xF009 says which classes a named
  // character wears, 0xF008 which ones a monster does.
  try { for (const pt of [...characterProptypes()].sort((a, b) => a - b)) add(pt, 'person'); } catch (e) { quiet(e); }
  try { for (const m of parseMonsterStats()) if (!m.blank) add(m.proptype, 'monster'); } catch (e) { quiet(e); }
  return [...seen.values()].sort((a, b) => a.pt - b.pt);
}

function renderCheatsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const key = k => k ? '<kbd class="cheatKey">' + svEsc(k) + '</kbd>' : '';
  const kr = appImage() ? exeKeyRoutine() : null;
  const noApp = 'Open the game from its installer, under Settings, to read the program’s code here.';
  let h = '<h3 class="cheatH">Cheat Mode</h3>' +
    '<div class="mechLede">Cythera has a cheat mode that no released copy can switch on: its code works only with a preference set that nothing in the game sets.' +
    (kr ? '' : ' ' + noApp) + '</div>';

  // The helpers a key's sentence is built with, over one case.
  const chars = w => [...w].map(ch => { const b = encodeMacRoman(ch)[0]; return US_OPTION_KEYS[b] || ch; });
  const comboOf = (k, last) => k < 256 ? (US_OPTION_KEYS[k] || (last && last !== k ? decodeMacRoman(new Uint8Array([k])) + ' to ' + decodeMacRoman(new Uint8Array([last])) : decodeMacRoman(new Uint8Array([k])))) : 'codes ' + k + (last && last !== k ? ' to ' + last : '');
  const caseAt = at => kr && kr.cases.find(c => c.at === at);
  const facts = c => {
    const strip = t => t.v.replace(/^\n+|\n+$/g, '');
    const q = i => c.strings[i] ? '“' + srcNum(c.strings[i], strip(c.strings[i])) + '”' : '';
    const callOf = name => c.calls.find(x => x.v === name || x.v.endsWith('::' + name));
    const bases = c.calls.filter(x => /mygetnum$/.test(x.v)).map(x => x.args[4]).filter(Boolean);
    const baseWord = b => srcNum(b, b.v === 16 ? 'in hex' : b.v === 10 ? 'in decimal' : 'in base ' + b.v);
    const opFact = (test, v) => { const o = c.ops.find(x => x.d && test(x.d)); return o ? exeVal(o, v(o.d)) : null; };
    const enemy = exeEnemyTable();
    const x = {
      q, call: name => { const k = callOf(name); return k ? srcNum(k, name) : svEsc(name); },
      // A call linked under plain words rather than the routine's name.
      via: (name, text) => { const k = callOf(name); return k ? srcNum(k, text) : svEsc(text); },
      arg: (name, reg) => { const k = callOf(name); return k && k.args[reg] ? srcNum(k.args[reg]) : '?'; },
      prompts: from => c.strings.slice(from).map((t, i) => ({ t, i: i + from })).filter(o => !/^[\n]*%[-#0-9.]*[a-z][\n]*$/.test(o.t.v)).map(o => q(o.i)),
      base: () => bases[0] ? baseWord(bases[0]) : '',
      bases: () => bases.map(baseWord).join(', '),
      // Each prompt with the base of the number read after it.
      asks: () => { const ps = c.strings.map((t, i) => ({ t, i })).filter(o => !/^[\n]*%[-#0-9.]*[a-z][\n]*$/.test(o.t.v)); const parts = ps.map((o, k) => q(o.i) + (bases[k] ? ' ' + baseWord(bases[k]) : '')); return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts.join(''); },
      ori: () => { const f = opFact(d => d.mn === 'ori' && d.imm > 0, d => d.imm); return f ? srcNum(f) : '?'; },
      less: () => { const f = opFact(d => d.mn === 'addi' && d.ra === kr.keyReg && d.imm < 0, d => -d.imm); return f ? srcNum(f) : '?'; },
      flip: () => c.flips[0] ? srcNum(c.flips[0], 'here') : '',
      flag: () => { const k = callOf('AddAbility'); const f = k && k.args[4]; return f ? srcNum(f) + (dvmFlagName(f.v) ? ' (' + svEsc(dvmFlagName(f.v)) + ')' : '') : '?'; },
      statusBit: () => {
        const k = callOf('AddAbility'), f = k && k.args[4]; if (!f) return '';
        const m = exeAbilityMap().find(r => r.word && r.below.v > f.v && r.sub.v <= f.v);
        return m ? ', which ' + srcNum(m.sub, 'AddAbility') + ' keeps as bit ' + (f.v - m.sub.v) + ' of the status word' : '';
      },
      clockWords: (name, reg) => { const k = callOf(name), clk = exeClockRules(); return k && k.args[reg] && clk && clk.unitsPerHour ? ', ' + exeClockWords(k.args[reg].v, clk.unitsPerHour.v) : ''; },
      fallsInto: c.fallsInto && caseAt(c.fallsInto) ? comboOf(caseAt(c.fallsInto).keys[0].v) : null,
      walls: () => {
        const w = exeWallMask(); if (!w) return 'Marks each wall on every square of the level (MakeBitMap).';
        const attrs = getTileAttributes(ARCHIVE), names = new Set(); let n = 0;
        for (let t = 0; t <= w.tiles.v && t < attrs.length; t++) if ((attrs[t] & w.mask.v) === w.mask.v) { n++; const nm = terrainNameFor(t); if (nm) names.add(nm); }
        return 'Shows the walls the room view stops at, until you click: every square of ' + srcNum(w.mask, n + ' kinds of terrain') + ', ' + [...names].map(svEsc).join(', ') + '.';
      },
      peace: () => {
        if (!enemy || !enemy.peace || !enemy.peaceKey) return 'Switches a byte that the enemy check reads first.';
        const callers = exeCallersOf('TActiveMonster::GetEnemyStatus');
        const zero = callers.filter(k => { const n = exeFind(k.ops, k.i + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3); return n >= 0 && k.ops[n].d.imm === 0; });
        const names = [...new Map(zero.map(k => [k.routine.name, k])).values()].map(k => srcNum(exeVal(k.ops[k.i], null), k.routine.name.replace(/\(.*$/, '').replace(/^.*::/, '')));
        return srcNum(enemy.peaceKey, 'Switches') + ' a setting that makes ' + srcNum(enemy.peace, 'no pair enemies') + ': monsters stop finding targets, and an “every enemy” spell finds nobody.';
      },
      peaceShort: () => {
        if (!enemy || !enemy.peace) return '';
        const callers = exeCallersOf('TActiveMonster::GetEnemyStatus');
        const zero = callers.filter(k => { const n = exeFind(k.ops, k.i + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3); return n >= 0 && k.ops[n].d.imm === 0; });
        return 'It makes ' + srcNum(enemy.peace, 'no pair enemies') + ', so monsters stop finding targets.';
      },
      brokenShort: () => {
        const k = callOf('AddAbility'), who = k && k.args[3], test = opFact(d => d.mn === 'lbz' && d.d > 0, d => d.d);
        return 'It checks byte ' + (test ? srcNum(test) : '?') + ' of character ' + (who ? srcNum(who) : '?') + '’s record instead of the player’s, so it protects no one.';
      },
      broken: () => {
        const k = callOf('AddAbility'), f = k && k.args[4], who = k && k.args[3];
        const test = opFact(d => d.mn === 'lbz' && d.d > 0, d => d.d);
        return 'Meant to switch flag ' + (f ? srcNum(f) + (dvmFlagName(f.v) ? ', ' + svEsc(dvmFlagName(f.v)) : '') : '?') + ' on and off, but it ' + (who ? srcNum(who, 'acts on an empty record') : 'acts on an empty record') + ' instead of yours, so it does nothing.';
      },
      zstats: () => { const z = exeStringsOf('PrintZStats'); return z.length ? z.map(t => '“' + srcNum(t, t.v.replace(/\n+$/, '')) + '”').join(', ') : 'the build’s statistics'; }
    };
    return x;
  };
  const caseRow = c => {
    const k0 = c.keys[0].v, words = CHEAT_KEY_WORDS[k0];
    if (!words) return '';
    const glyph = k0 < 256 && US_OPTION_KEYS[k0] ? decodeMacRoman(new Uint8Array([k0])) : '';
    const last = c.keys[c.keys.length - 1].v;
    const code = k0 < 256 ? srcNum(c.keys[0], '$' + k0.toString(16).toUpperCase().padStart(2, '0') + (c.keys.length > 1 ? ' to $' + last.toString(16).toUpperCase().padStart(2, '0') : '')) : srcNum(c.keys[0], '$' + k0.toString(16).toUpperCase() + ' to $' + last.toString(16).toUpperCase());
    let does = '';
    try { does = words[1](facts(c)); } catch (e) { does = ''; }
    return '<tr><td class="cheatCombo">' + key(comboOf(k0, last)) + (glyph ? ' <span class="cheatGlyph">' + svEsc(glyph) + '</span>' : '') + '<span class="cheatCode">' + code + '</span></td>' +
      '<td><b>' + svEsc(words[0]) + '</b><div class="cheatDoes">' + does + '</div></td></tr>';
  };
  const acc = kr ? exePrefsAccess() : null;
  const fields = kr ? exePrefFields() : null;
  const defaults = kr ? exePrefDefaults() : null;
  const prefKeys = kr ? exePrefKeys() : [];
  const g = kr && kr.gate;

  if (g && g.byte && g.bit) {
    const recKey = prefKeys.find(e => e.kind === 'Prefs' && e.writers.some(w => acc && acc.passes.some(p2 => p2.routine === w.routine)));
    const gateRow = fields && fields.find(f => f.byte === g.byte.v && f.lo <= g.bit.v && f.hi >= g.bit.v);
    const setters = gateRow ? gateRow.writers : [];
    const others = gateRow ? [...new Map(gateRow.readers.filter(r2 => r2.routine !== kr.routine).map(r2 => [r2.routine.name, r2])).values()] : [];
    const wait = exeStartupWait(g);
    const distinct = defaults ? [...new Set(defaults.words.map(w => w.v))] : [];
    const clear = distinct.every(v => !((v >>> (24 - 8 * g.byte.v)) & (1 << g.bit.v)));
    const letters = chars(g.word.v);
    h += '<div class="mechSec"><h4 class="cheatH4">The Gate (How It Switches On)</h4><ul class="ruleList">' +
      '<li>Type <b>' + srcNum(g.word, g.word.v) + '</b> (' + letters.map(t => '<b>' + svEsc(t) + '</b>').join(', then ') + ' on a US layout) in the map window. With ' +
      srcNum(g.bit, 'the preference') + ' set, cheat mode ' + srcNum(g.flip, 'switches') + ' and the ' +
      'status window prints ' + (g.on ? '“' + srcNum(g.on, g.on.v.replace(/\n+$/, '')) + '”' : 'that it is on') + (g.on && /[.!?]\s*$/.test(g.on.v) ? '' : '.') + '</li>' +
      (setters.length ? '<li>Written by ' + setters.map(w => srcNum(w.bits, w.routine.name.replace(/\(.*$/, ''))).join(', ') + '.</li>'
        : '<li><b>Nothing in the game sets it</b>' + (defaults && !clear ? ', though a record the game stores at first run has it set' : '') + ', so on a copy as released typing the code does nothing.</li>') +
      (others.length && wait ? '<li>The preference also adds a ' + srcNum(wait.ticks, (wait.ticks.v / 60) + '-second') + ' pause at startup.</li>' : '') +
      '<li>Typing the letters of the code also switches on targeting modes, so the tab reads ATTACK afterward until you press <b>M</b>.</li></ul>' +
      '<div class="cheatNote">To set it, write the preferences file from ' +
      actionChip('Data › Preferences', "showCategory('PREFS')") +
      ', as a MacBinary for a real Mac or a disk image for an emulator.</div></div>';
  }

  // The record, the file's keys, and the menu bars off the program's fork.
  if (fields) {
    const name = r2 => r2.name.replace(/\(.*$/, '');
    const bitsText = f => f.lo === f.hi ? String(f.lo) : f.lo + ' to ' + f.hi;
    const quoted = t => '“' + svEsc(t) + '”';
    const setBy = f => {
      const by = new Map();
      for (const w of f.writers) { if (!by.has(w.routine.name)) by.set(w.routine.name, []); by.get(w.routine.name).push(w); }
      return [...by.values()].map(ws => {
        const w0 = ws[0], menus = [], dialog = [], labels = new Map(), plain = [];
        for (const w of ws) {
          const val = w.value ? (w.value.v === 'toggled' ? 'toggles it' : 'sets ' + srcNum(w.value)) : '';
          if (w.item && w.item.texts.length && w.item.title) menus.push(w.item.texts.map(quoted).join(', ') + (val ? ' ' + val : ''));
          else if (w.item && w.item.texts.length) dialog.push(w.item.texts.map(quoted).join(', ') + (val ? ' ' + val : ''));
          else if (w.label) { if (!labels.has(w.label.v)) labels.set(w.label.v, []); if (w.chosen && !w.chosen.all && val) labels.get(w.label.v).push('at ' + w.chosen.values.join(', ') + ' ' + val); }
          else if (val) plain.push(val + (w.chosen && !w.chosen.all ? '' : ' before it asks'));
        }
        const parts = [];
        if (plain.length) parts.push(plain.join('; '));
        if (menus.length) parts.push('menu “' + svEsc(ws.find(w => w.item && w.item.title).item.title) + '”, ' + menus.join('; '));
        if (dialog.length) parts.push(dialog.join('; '));
        for (const [lab, how] of labels) parts.push('the dialog’s ' + quoted(lab) + (how.length ? ', ' + how.join('; ') : ''));
        return srcNum(w0.bits, name(w0.routine)) + (parts.length ? ': ' + parts.join('; ') : '');
      }).join('<br>');
    };
    const readBy = f => [...new Map(f.readers.map(r2 => [r2.routine.name, r2])).values()].map(r2 => srcNum(r2.bits, name(r2.routine).replace(/^.*::/, ''))).join(', ');
    const rec = prefKeys.find(e => e.kind === 'Prefs' && e.writers.some(w => acc.passes.some(p2 => p2.routine === w.routine)));
    const bytes = rec && rec.len ? rec.len.v : 4;
    const unused = []; for (let b = 0; b < bytes; b++) if (!fields.some(f => f.byte === b)) unused.push(b);
    const hex8 = v => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
    const ranges = vals => { const out2 = []; let a = null, b = null; for (const v of vals) { if (a === null) { a = b = v; } else if (v === b + 1) b = v; else { out2.push([a, b]); a = b = v; } } if (a !== null) out2.push([a, b]); return out2.map(([x0, x1]) => x0 === x1 ? String(x0) : x0 + ' to ' + x1).join(', '); };
    h += '<div class="mechSec"><h4 class="cheatH4">The Preferences Record</h4>' +
      '<div class="cheatNote">' + (rec ? srcNum(rec.len || rec.key, bytes + ' bytes') + ', stored under “' + srcNum(rec.key, rec.key.v) + '”, and' : 'The record’s fields and') +
      ' what reads and writes each part' + (unused.length ? '. Byte' + (unused.length > 1 ? 's ' : ' ') + unused.join(' and ') + (unused.length > 1 ? ' are' : ' is') + ' unused' : '') + '.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">byte</th><th class="num">bits</th><th>set by</th><th>read by</th></tr></thead><tbody>' +
      fields.map(f => '<tr><td class="num">' + f.byte + '</td><td class="num">' + bitsText(f) + '</td><td>' + (f.writers.length ? setBy(f) : 'nothing') + '</td><td>' + readBy(f) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (defaults ? '<div class="cheatNote">With nothing stored, the game ' + srcNum(defaults.selectors[0], 'picks a default by processor') + ': ' + [...new Map(defaults.words.map(w => [w.v, w])).values()].map(w => {
          const vals = [].concat(...defaults.words.filter(x => x.v === w.v).map(x => x.chosen && !x.chosen.all ? x.chosen.values : [])).sort((a2, b2) => a2 - b2);
          const top = vals.length && vals[vals.length - 1] === 300 ? vals.filter(v => v < 300) : vals;
          let text = ranges(top.filter(v => v >= 0 || !vals.includes(300)));
          if (vals.includes(300)) text = text.replace(/(\d+) to 299$/, '$1 and above');
          return '<b>' + srcNum(w, hex8(w.v)) + '</b>' + (text ? ' at ' + text : '');
        }).join(', ') + '.</div>' : '') +
      '<div class="cheatNote">Cythera Preferences, in the System Folder’s Preferences folder, keeps each setting as a ‘Pref’ resource under its name.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th>key</th><th>holds</th><th>written by</th><th>read by</th></tr></thead><tbody>' +
      prefKeys.map(e => '<tr><td><b>' + srcNum(e.key, e.key.v) + '</b></td><td>' + (e.kind === 'Prefs' ? (e.len ? srcNum(e.len) + ' bytes' : 'bytes') : e.kind === 'File' ? 'a file' : 'a number') + '</td><td>' +
        ([...new Map(e.writers.map(w => [w.routine.name, w])).values()].map(w => srcNum(exeVal({ at: w.exe }, null), name(w.routine))).join(', ') || 'nothing') + '</td><td>' +
        ([...new Map(e.readers.map(w => [w.routine.name, w])).values()].map(w => srcNum(exeVal({ at: w.exe }, null), name(w.routine))).join(', ') || 'nothing') + '</td></tr>').join('') +
      '</tbody></table></div>';
    const bars = shippedMenuBars();
    if (bars && bars.bars.length) {
      const menuName = m => (m.title ? svEsc(m.title) : 'MENU ' + m.id);
      h += '<div class="cheatNote">' +
        (bars.unlisted.length
          ? bars.unlisted.map(menuName).join(', ') + (bars.unlisted.length > 1 ? ' are menus that work' : ' is a menu that works') + ' but ' + (bars.unlisted.length > 1 ? 'are' : 'is') + ' in no menu bar, so you cannot reach the Preferences menu or the frame-rate limit. ' +
            'Add-on 612, the Cythera menu patch, adds three of them; add-on 613 takes them out again.'
          : 'Every menu the game defines is in its menu bar.') + '</div>';
    }
    h += '</div>';
  }

  if (kr && kr.cases.length) {
    const gated = kr.cases.filter(c => c.gated), open = kr.cases.filter(c => !c.gated);
    const cd = kr.words.slice(1), vol = kr.volume;
    h += '<div class="mechSec"><h4 class="cheatH4">With the Cheat Flag On</h4>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><tbody>' + gated.map(caseRow).join('') +
      '</tbody></table></div></div>';
    h += '<div class="mechSec"><h4 class="cheatH4">Keys That Work Without Cheat Mode</h4>' +
      '<div class="cheatNote">These work in any copy of the game, cheat mode or not.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><tbody>' + open.map(caseRow).join('') +
      (vol.length >= 2 ? '<tr><td class="cheatCombo">' + key(vol.map(v => decodeMacRoman(new Uint8Array([v.key.v]))).join(' ')) + '<span class="cheatCode">' + vol.map(v => srcNum(v.key, '$' + v.key.v.toString(16).toUpperCase())).join(' ') + '</span></td>' +
        '<td><b>CD volume</b><div class="cheatDoes">' + vol.map(v => (v.step.v < 0 ? 'down' : 'up') + ' by ' + srcNum(v.step, Math.abs(v.step.v)) + (v.bound ? ' and held at ' + srcNum(v.bound) : '')).join('; ') + '.</div></td></tr>' : '') +
      (cd.length ? '<tr><td class="cheatCombo">' + key(cd.map(w => w.v).join(' ')) + '</td>' +
        '<td><b>CD controls</b><div class="cheatDoes">Typed like the cheat code, when a CD is present: ' + cd.map(w => '“' + srcNum(w, w.v) + '”').join(', ') + '. What each does is a guess from the word.</div></td></tr>' : '') +
      '</tbody></table></div></div>';
  }

  // The numbers the keys ask for, off the file.
  const levels = cheatLevels();
  if (levels.length) {
    h += '<div class="mechSec"><h4 class="cheatH4">Levels, for Option-J</h4>' +
      '<div class="cheatNote">Enter the level in hex, and X and Y in squares. Where the editor names a map differently, its name is beside the game’s.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">hex</th><th class="num">dec</th><th>map</th></tr></thead><tbody>' +
      levels.map(l => '<tr><td class="num">' + l.n.toString(16).toUpperCase().padStart(2, '0') + '</td><td class="num">' + l.n + '</td><td>' +
        (l.n === 0 ? svLink(svEsc(l.name), 'jumpToResource(' + l.resid + ')') + ' <span class="cheatDoes">the nothing map, below</span>'
                   : svLink(svEsc(l.name), 'jumpToResource(' + l.resid + ')') + svEsc(editorNameSuffix(l.resid, l.name))) +
        '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }
  const tp = cheatTeleporters();
  if (tp.last) {
    const mapOrder = [...tp.byMap.keys()].sort((a, b) => a - b);
    const mapName = resid => { const l = levels.find(x => x.resid === resid); return l ? l.name : (labelFor(resid) || ('0x' + resid.toString(16).toUpperCase())); };
    h += '<div class="mechSec"><h4 class="cheatH4">Teleporters, for Option-Shift-J</h4>' +
      '<div class="cheatNote">' + tp.last + ' destinations, 1 to ' + tp.last + ' in decimal; any higher number leads to the nothing map. Click one to open the map there. ' +
      'The community’s Zone list (add-on 620) calls Timon Ruins Headwater Ruins, Swamp Ruins Seldane Maayti Ruins, and Crypts Pnyx Upstairs.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">level</th><th>map</th><th class="num">no.</th><th>teleporter, and the square it reaches</th></tr></thead><tbody>' +
      mapOrder.map(resid => {
        const list = tp.byMap.get(resid);
        return '<tr><td class="num">' + (resid & 0xFF).toString(16).toUpperCase().padStart(2, '0') + '</td><td>' + svEsc(mapName(resid)) + '</td><td class="num">' + list.length + '</td><td>' +
          list.map(t => svLink(String(t.n), 'atlasOpenSquare(' + resid + ',' + t.x + ',' + t.y + ')', t.x + ',' + t.y)).join(' ') + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }
  let heap = null;
  try { heap = refExists(0x8000) ? nothingMapHeap(0x8000) : null; } catch (e) { heap = null; }
  if (heap) {
    h += '<div class="mechSec"><h4 class="cheatH4">Level 0, the Nothing Map</h4><ul class="ruleList">' +
      '<li>Map 0 is ' + heap.w + ' by ' + heap.h + ', with no roof, no exits, ' + (refExists(0x8100) ? 'a prop list' : 'no prop list') + ' and no name. The map window’s title reads Untitled there.</li>' +
      '<li><b>Its grid is not tiles</b> but leftover bytes of the program’s memory: the program made the map and never filled it in.</li>' +
      '<li>Players have reached it by accident, from a bed in Cademia and from beneath Pnyx, ' +
      'and found a figure with a guard’s sprite called Nothing, or Omen if killed twice. ' +
      'That figure is character record 0, which is empty, and is the record option-x writes to. ' +
      actionChip('Saved Game', "showCategory('SAVEGAME')") + '</li></ul></div>';
  }

  const sprites = cheatSpriteClasses();
  if (sprites.length) {
    h += '<div class="mechSec"><h4 class="cheatH4">Be Somebody Else</h4>' +
      '<div class="cheatNote">The oldest Cythera cheat: use Pandora’s Box to find ' +
      'the number <b>32</b>, the hero’s sprite, in the running game and write another number over it. ' +
      'The Saved Game page does the same with the <b>sprite class</b> field. ' +
      'These are the ' + sprites.length + ' sprites someone in the game uses. ' +
      actionChip('Saved Game', "showCategory('SAVEGAME')") + '</div>' +
      '<div class="cheatSprites">' + sprites.map(s =>
        '<span class="cheatSprite' + (s.kind === 'monster' ? ' isMonster' : '') + '"><b>' + s.pt +
        '</b> ' + svEsc(s.name) + '</span>').join('') +
      '</div></div>';
  }

  h += '<div class="mechSec"><h4 class="cheatH4">Cheats That Need No Cheat Mode</h4>' +
    '<div class="cheatNote">Changes this page can make to a file the game will open.' +
    '</div><ul class="ruleList">' +
    '<li><b>The party’s records.</b> Where they stand, how strong and how well fed they are, and how many training ' +
    'points they have. ' + actionChip('Saved Game', "showCategory('SAVEGAME')") + '</li>' +
    '<li><b>Any resource, as hex</b>, through Edit Bytes on the resource itself.</li>' +
    '<li><b>Where to download the changed file.</b> ' + actionChip('Changes', "showCategory('CHANGES')") + '</li></ul></div>';

  if (kr && kr.cases.length) {
    const find = k => kr.cases.find(c => c.keys.some(x => x.v === k));
    const cx = find(0xC5), cp = find(0xB9), cl = find(0xC2), c1 = kr.cases.find(c => c.keys.some(x => x.v === 0xC1));
    const items = [];
    if (cx) items.push('<li><b>option-x is broken.</b> ' + facts(cx).brokenShort() + '</li>');
    if (cp && cp.fallsInto && caseAt(cp.fallsInto)) items.push('<li><b>option-p carries on</b> into ' + comboOf(caseAt(cp.fallsInto).keys[0].v) + '’s code (' + srcNum(exeVal({ at: cp.fallsInto }, null), 'here') + '): a missing jump means asking what a prop is also switches that setting.</li>');
    const fh = find(0xFA);
    if (fh) items.push('<li><b>option-h empties the enemy list.</b> ' + facts(fh).peaceShort() + '</li>');
    if (cl && !c1) items.push('<li><b>The speed limiter is ' + srcNum(cl.keys[0], 'option-l') + '</b>, not option-1.</li>');
    if (items.length) h += '<div class="mechSec"><h4 class="cheatH4">Things Read from the Code</h4><ul class="ruleList">' + items.join('') + '</ul></div>';
  }

  grid.innerHTML = '<div class="changesView">' + h + '</div>';
  out.textContent = (kr ? 'Cheat mode: ' + kr.cases.filter(c => c.gated).length + ' keys behind the gate, ' + kr.cases.filter(c => !c.gated).length + ' in the same routine without it' : 'Cheat mode') +
    (levels.length ? ', ' + levels.length + ' levels' : '') + (tp.last ? ' and ' + tp.last + ' teleporters' : '') + '.';
}

/* ---- Data > Saved Game ----------------------------------------------------
   A Cythera player file read as what it is, and edited a field at a time.

   The page has opened saves since September 2026 and then had almost nothing
   to say about one: a `DelP` file landed on the Data Fork sheet, which listed
   its six subindexes and left the reader to open a 16 KB hex dump. Everything
   a player would want to change is in one of those subindexes -- 0xF009, the
   character records -- and the format of that table has been public on
   delvmod's wiki for years. This sheet is that table with the names on it.

   IT IS THE SAME EDIT SEAM AS EVERYTHING ELSE. Apply re-parses 0xF009,
   changes the fields the form names, re-serializes the whole table with
   `writeDelverCharacterRecords` -- proven the exact inverse of its parser
   over both real tables by `delv_write_check.mjs` -- and hands the bytes to
   `applyResourceEdit`, which rebuilds the archive and re-enters
   `parseArchiveBytes`. So what the sheet shows after an edit is read back out
   of the rebuilt file, and Data > Cythera Data > Changes is where the edited
   save leaves the page: a MacBinary for a real Mac, a disk image for the
   emulator, or the bare data fork.

   IT ALSO OPENS ON `Cythera Data`, where the same table is where everybody
   STARTS rather than where they are. That is not a courtesy: it is how the
   sheet is testable without a saved game in the checkout, and the difference
   between the two files -- Alaric at 9,600 experience in both, the hero's
   health 0 in the scenario and 25 in a played game -- is the clearest
   statement of what a save actually is.

   THE NAMES ARE BORROWED AND THE SHEET SAYS SO. A save holds no 0x0201, so
   without the scenario opened earlier in the session every row would read
   "Character 12"; see the comment above SCENARIO_NAMES for why carrying two
   string tables is not the same as holding two archives open. */
window.SAVE_EDIT_OPEN = null;   // the record whose form is unfolded, kept across a rebuild
window.SAVE_SHOW_ALL = false;   // slots that are marked but hold nobody

/* The parts of a player file, and what each is, traced through the
   executable rather than guessed: every one of these is written by a named
   routine in Cythera's own save path (`TDelverApp::SaveToFile` and what it
   calls), which is also where the comment above DELV_PLAYER_CLEAR_SUBN gets
   its rule that none of them is encrypted. Only the ones the open file
   actually has are listed. */
function savedGameParts() {
  const out = [];
  const add = (rid, what) => { if (refExists(rid)) out.push({ rid, what }); };
  add(0xF009, 'the character records, everybody’s position, stats and condition (SaveGlobals)');
  add(0xF00E, 'two bytes for each of 1,024 rooms; the game sets the first switch in them once the party enters a room and sees its description (SaveGlobals)');
  const hero = loadCharacterTable()[1];
  if (hero && hero.zone) {
    add(0x8100 | hero.zone, 'the props of the zone the player stands in, from record 256 up (SaveLevelProps)');
    add(0x8200 | hero.zone, 'what the player has seen of that zone, one switch for each square: width ÷ 8, rounded up, times the height, in bytes (SaveLevelProps)');
  }
  add(0xF306, 'the first 256 prop records, the characters as they stand on that zone (SaveLevelProps)');
  add(0x8800, 'the player’s portrait, which the game writes when you make the character (CreatePlayer)');
  add(0x0400, 'the live game, five tagged chunks: the quest values and flags, the active monsters with their queued activities, the spell effects in flight, the open windows, and the 256 gremlin frames (SaveToFile)');
  add(0x0401, 'the To Do list (SaveToDo)');
  add(0x0404, 'the twenty macro slots; 0xFF is unassigned (SaveMacros)');
  add(0xF307, 'the store the scripts keep things in between sessions, 256 KB: each block starts with eight bytes giving its number and its kind, and an empty store is one free block (THeap::Save)');
  add(0xF308, '4,096 two-byte entries, one for each thing that has something in that store, each giving where in the store to find it (THeap::Save)');
  for (let n = 0; n < 256; n++) add(0xE000 | n, 'a page of the journal, 8 KB; each entry is its length, the day, what kind of entry it is, who spoke and the text (TJournalSegment::Flush)');
  return out;
}

/* ---------------------------------------------------------------------------
   A saved game, every byte of it (v1.197.0, 26 September 2026)
   ---------------------------------------------------------------------------
   The maintainer asked for every byte of a save labelled. The format was
   nearly all read already (the workbench's save-format.md); what the page
   lacked was a place that shows it byte by byte. saveByteMap() cuts the open
   save into parts -- the data fork's own structure, each resource, and the
   resource fork -- and each part into fields that cover it exactly: an
   offset, a length, what it is, and its value. A field whose meaning is not
   read is still a field, with `unread` set and the reason in its name, so
   "every byte labelled" is true and the page still says which labels are
   only structure. A record (a character, a prop, a monster) is a field
   with `kids` covering it, which the view folds.

   The coverage is the check: saveByteMapGaps() lists every byte of a part
   that no leaf field covers or two cover, and utilities/smoke_saves.mjs
   holds every save on the disk to none. The readings each parser follows
   are cited in its comment; the addresses are in save-format.md. */

// A field list over one run of bytes, offsets from the part's start.
function byteMapPart(key, title, bytes, extra) {
  const p = Object.assign({ key, title, bytes, size: bytes ? bytes.length : 0, fields: [] }, extra || {});
  p.f = (at, len, name, o) => { const x = Object.assign({ at, len, name }, o || {}); p.fields.push(x); return x; };
  return p;
}
// A record: a field whose kids cover it, built with the same f(at, len,
// name, o) but offsets from the record's own start.
function byteMapRecord(p, at, len, name, o) {
  const rec = Object.assign({ at, len, name, kids: [] }, o || {});
  rec.f = (off, n, nm, oo) => { const x = Object.assign({ at: at + off, len: n, name: nm }, oo || {}); rec.kids.push(x); return x; };
  p.fields.push(rec);
  return rec;
}
function byteMapHex(b, at, len, max) {
  const n = Math.min(len, max || 8), out = [];
  for (let k = 0; k < n && at + k < b.length; k++) out.push(b[at + k].toString(16).padStart(2, '0').toUpperCase());
  return out.join(' ') + (len > n ? ' …' : '');
}
function byteMapAllZero(b, at, len) { for (let k = 0; k < len; k++) if (b[at + k]) return false; return true; }
// The leaves of a part, in order.
function byteMapLeaves(p) {
  const out = [];
  const walk = list => { for (const x of list) { if (x.kids) walk(x.kids); else out.push(x); } };
  walk(p.fields);
  return out.sort((a, b) => a.at - b.at);
}
// Every byte no leaf covers, or two do: [{ at, len, kind }]. Empty is right.
function saveByteMapGaps(p) {
  const leaves = byteMapLeaves(p), out = [];
  let pos = 0;
  for (const x of leaves) {
    if (x.len <= 0) { out.push({ at: x.at, len: x.len, kind: 'empty field ' + x.name }); continue; }
    if (x.at > pos) out.push({ at: pos, len: x.at - pos, kind: 'unlabelled' });
    else if (x.at < pos) out.push({ at: x.at, len: Math.min(pos, x.at + x.len) - x.at, kind: 'labeled twice: ' + x.name });
    pos = Math.max(pos, x.at + x.len);
  }
  if (pos < p.size) out.push({ at: pos, len: p.size - pos, kind: 'unlabelled' });
  if (pos > p.size) out.push({ at: p.size, len: pos - p.size, kind: 'past the end' });
  return out;
}
// Fill each stretch of [from, to) that no field covers with one field
// saying what it is: all zero, or bytes the file keeps there without any
// index pointing to them (an older copy of a resource, in cp1-intro-done a
// stream beginning with the tag Char).
function byteMapFillGaps(p, from, to, name) {
  const covered = byteMapLeaves(p).filter(x => x.at < to && x.at + x.len > from);
  let pos = from;
  const fill = (a, e) => { if (e > a) p.f(a, e - a, name, { value: byteMapAllZero(p.bytes, a, e - a) ? 'all zero' : (e - a) + ' bytes, starting ' + byteMapHex(p.bytes, a, e - a) }); };
  for (const x of covered) { if (x.at > pos) fill(pos, x.at); pos = Math.max(pos, x.at + x.len); }
  fill(pos, to);
}

// The 32 bytes of a character record, named as the record form names them
// (CHAR_GROUPS), with the three flag bytes the form shows as boxes.
function charRecordLayout() {
  if (charRecordLayout.cache) return charRecordLayout.cache;
  const L = new Map();
  for (const g of CHAR_GROUPS) for (const it of g.items || []) {
    const off = it.raw ? it.raw[0] : it.off, w = it.raw ? it.raw[1] : (it.width || 1);
    if (off === undefined) continue;
    const prev = L.get(off);
    L.set(off, prev ? [Math.max(prev[0], w), prev[1] + ' and ' + it.label] : [w, it.label]);
  }
  L.set(6, [2, 'character flags 8 to 23']); L.set(8, [1, 'character flags 0 to 7']); L.set(26, [1, 'character flags 24 to 31']);
  return (charRecordLayout.cache = [...L.entries()].sort((a, b) => a[0] - b[0]).map(([off, [w, name]]) => ({ off, w, name })));
}
function byteMapCharRecord(p, at, name) {
  const b = p.bytes, rec = byteMapRecord(p, at, 32, name, { empty: byteMapAllZero(b, at, 32) });
  for (const l of charRecordLayout()) rec.f(l.off, l.w, l.name, { value: byteMapHex(b, at + l.off, l.w) });
  return rec;
}
/* A 16-byte prop record (parseDelverPropList). Bytes 8 to 15 read off
   GetField's cases for a prop and the routines behind them (26 September
   2026): 8 and 9 are field 14, the prop's slot in the frame table, and 12
   and 13 its frame's heap reference, both as PropItem::AllocateFrame uses
   them; 10 and 11 are field 15, which nothing else found reads; byte 14's
   low six bits, signed, are field 16, which TViewer::Render multiplies by
   four and adds to both draw offsets; byte 15 is read by nothing found.
   delvmod's `propref`, `storeref` (a long at 10) and `u` do not match. */
function byteMapPropRecord(p, at, name) {
  const b = p.bytes, rec = byteMapRecord(p, at, 16, name, { empty: byteMapAllZero(b, at, 16) });
  const flags = b[at], loc = (b[at + 1] << 16) | u16be(b, at + 2), aw = u16be(b, at + 4);
  rec.f(0, 1, 'flags: 0x01 may be taken, 0x08 inside another prop, 0x10 carried by a character, 0xFF deleted; an egg is 0x42 armed and 0xC2 tried', { value: '0x' + flags.toString(16).toUpperCase().padStart(2, '0') });
  rec.f(1, 3, (flags & 0x18) ? 'who or what holds it: the low 16 bits are the holder' : 'where it lies: x in the top twelve bits, y in the bottom twelve',
        { value: (flags & 0x18) ? 'holder ' + (loc & 0xFFFF) : '(' + (loc >> 12) + ', ' + (loc & 0xFFF) + ')' });
  rec.f(4, 2, 'its class and frame: the class in the low ten bits, the aspect above', { value: 'class ' + (aw & 0x3FF) + ', aspect ' + ((aw >> 10) & 0x3F) });
  rec.f(6, 1, 'Data1', { value: String(b[at + 6]) });
  rec.f(7, 1, 'Data2', { value: String(b[at + 7]) });
  const s6 = ((b[at + 14] & 0x3F) << 26) >> 26;
  rec.f(8, 2, 'its slot in the frame table (0xF308), where AllocateFrame copies its frame’s reference; field 14', { value: String(u16be(b, at + 8)) });
  rec.f(10, 2, 'field 15, a spare field a script could read and set; none does, and nothing else found in the program uses it', { value: String(u16be(b, at + 10)) });
  rec.f(12, 2, 'the heap reference of its frame, a dict AllocateFrame makes the first time a script stores something on it (has_storage, storage)', { value: String(u16be(b, at + 12)) });
  rec.f(14, 1, 'how far the game shifts it along the diagonal when drawing it, four pixels a step: the low six bits, signed, which TViewer::Render adds to both draw offsets (field 16); every reader masks off the top two', { value: String(s6) + (b[at + 14] & 0xC0 ? ', top bits ' + (b[at + 14] >> 6) : '') });
  rec.f(15, 1, 'a spare byte: nothing found in the program reads or writes it', { value: String(b[at + 15]) });
  return rec;
}

/* The data fork's own structure (delvmod's load_header and load_index):
   the title at 0 and the player's name at 0x20, each a Pascal string in
   32 bytes; three single bytes delvmod keeps and does not name, at 0x40,
   0x42 and 0x48; the master index's offset and length at 0x80, where the
   index begins with that same pair; then the index's entries, the
   subindexes', and each resource's bytes, which are parts of their own. */
function byteMapDataFork(arc) {
  const b = arc.bytes, p = byteMapPart('file', 'the data fork’s structure: header, indexes and where each resource sits', b);
  p.f(0, 32, 'the scenario’s title, a Pascal string', { value: pstring(b, 0) });
  p.f(0x20, 32, 'the player’s name, a Pascal string', { value: pstring(b, 0x20) });
  // Halfwords, not the bytes delvmod keeps: OpenScenFile, CheckPlayerFile,
  // NewGame and InitWorld read them (save-format.md, the header).
  const ver = v => (v >> 8) + '.' + (v & 0xFF);
  p.f(0x40, 2, 'the Delver file format’s version, major and minor: the program opens a file whose major version matches the program’s and whose minor is no higher (SegFileHeader::CompatibleVersions, against 0x1300)', { value: ver(u16be(b, 0x40)) });
  p.f(0x42, 2, 'the scenario’s version: a save copies it from its scenario when the game begins, and the program opens the save only with a scenario it is compatible with', { value: ver(u16be(b, 0x42)) });
  p.f(0x48, 2, 'the side, in squares, of the map buffer the program sets aside for a level (CreateGlobals; 1,024 when 0)', { value: String(u16be(b, 0x48)) });
  const mi = delverMasterIndexExtent(b);
  if (mi) {
    p.f(mi.off, 8, 'the offset and length of the master index', { value: '0x' + mi.off.toString(16).toUpperCase() + ', ' + mi.len + ' bytes' });
    for (let i = 0; i < mi.count; i++) {
      const at = mi.first + i * 8, off = u32be(b, at), len = u32be(b, at + 4);
      p.f(at, 8, off ? 'where subindex ' + i + ' (resources 0x' + (i + 1).toString(16).toUpperCase().padStart(2, '0') + 'xx) is, and its length' : 'subindex ' + i + ', empty',
          { value: off ? '0x' + off.toString(16).toUpperCase() + ', ' + len + ' bytes' : '0', empty: !off });
      if (!off) continue;
      for (let k = 0; k < Math.min(256, len / 8); k++) {
        const e = off + k * 8, roff = u32be(b, e), rlen = u32be(b, e + 4), rid = ((i + 1) << 8) | k;
        p.f(e, 8, roff ? 'where resource 0x' + rid.toString(16).toUpperCase().padStart(4, '0') + ' is, and its length' : 'resource 0x' + rid.toString(16).toUpperCase().padStart(4, '0') + ', none',
            { value: roff ? '0x' + roff.toString(16).toUpperCase() + ', ' + rlen + ' bytes' : '0', empty: !roff });
        if (roff && rlen) p.f(roff, rlen, 'resource 0x' + rid.toString(16).toUpperCase().padStart(4, '0') + ', listed as a part below', { part: rid });
      }
    }
  }
  // What lies between: the header's other bytes and any space between
  // resources. None of it is read by delvmod.
  byteMapFillGaps(p, 0, 0x80, 'zero, and nothing found reads it');
  byteMapFillGaps(p, 0x80, b.length, 'free space: no index entry points here');
  p.fields.sort((x, y) => x.at - y.at);
  return p;
}

/* 0x0400: five chunks, each a four-character tag and a length that counts
   itself (TStream::BeginChunk), in the order SaveToFile writes them. */
function byteMapStream(p) {
  const b = p.bytes;
  let pos = 0;
  while (pos + 8 <= b.length) {
    const tag = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]), len = u32be(b, pos + 4), end = Math.min(b.length, pos + 4 + len);
    const chunk = byteMapRecord(p, pos, end - pos, 'the ' + tag.trim() + ' block');
    chunk.f(0, 4, 'the block’s tag', { value: tag });
    chunk.f(4, 4, 'the block’s length, counting itself', { value: String(len) });
    const body = pos + 8;
    const leaf = (at, n, name, o) => chunk.f(at - pos, n, name, o);
    let q = body;
    if (tag === 'Char') {
      const shortNames = ['the party’s karma (the scripts’ global 12, Karma)', 'the languages the party knows (global 14, LanguagesKnown, which the text drawer also reads)',
                          'the range the game picks a created creature’s size from (2 is 50 to 149 percent)', 'the next number the scripts’ NewUniqueName call hands out (it returns this and adds one)'];
      for (let k = 0; k < 4; k++) leaf(body + 2 * k, 2, shortNames[k], { value: String(u16be(b, body + 2 * k)) });
      for (let v = 0; v < 32; v++) leaf(pos + 16 + v, 1, 'quest value ' + v, { value: String(b[pos + 16 + v]) });
      for (let w = 0; w < 8; w++) leaf(pos + 48 + 4 * w, 4, 'quest flags ' + (32 * w) + ' to ' + (32 * w + 31) + ', one bit each, the first in the lowest bit', { value: byteMapHex(b, pos + 48 + 4 * w, 4) });
      leaf(pos + 80, 4, 'the game clock, 4,096 units an hour', { value: String(u32be(b, pos + 80)) });
      leaf(pos + 84, 2, 'the day (the scripts’ GameDay)', { value: String(u16be(b, pos + 84)) });
      leaf(pos + 86, 1, 'whether the automap is on: the byte the scripts’ SetAutomapping call sets (cbEnableAutoMap)', { value: String(b[pos + 86]) });
      leaf(pos + 87, 4, 'real time played, in seconds: each save adds the time since the last look at the Mac’s clock (SaveToFile, GetDateTime)', { value: String(u32be(b, pos + 87)) });
      if (end > pos + 91) leaf(pos + 91, end - (pos + 91), 'zeros that fill the block (SaveToFile)', { value: byteMapAllZero(b, pos + 91, end - pos - 91) ? 'all zero' : byteMapHex(b, pos + 91, end - pos - 91) });
      q = end;
    } else if (tag === 'Mons') {
      // TActiveMonster::SaveMonsters and ::Save. The first byte is property
      // 55 of the monster's class, and LoadMonsters rebuilds 9 and 10 as a
      // crawling monster, 11 a dragon, 12 an octo, anything else an
      // ordinary one; each of the three writes more after the record
      // (TCrawlMonster::Save a count and its segments, TDragonMonster::Save
      // four parts, TOctoMonster::Save eight arms, all prop indices).
      let m = 0;
      while (q < end) {
        const kind = b[q];
        if (q + 7 > end) break;
        const id = u16be(b, q + 1);
        let n = 7 + (id >= 256 ? 34 : 0) + 9 + 2;
        if (q + n > end) break;
        const cnt = u16be(b, q + n - 2);
        n += cnt * 9;
        const extra = kind === 9 || kind === 10 ? (q + n + 2 <= end ? 2 + 2 * u16be(b, q + n) : 0) : kind === 11 ? 8 : kind === 12 ? 16 : 0;
        n += extra;
        if (q + n > end) break;
        const who = id < 256 ? characterName(id) || ('character ' + id) : 'prop ' + id;
        const rec = byteMapRecord({ fields: chunk.kids, bytes: b }, q, n, 'monster ' + m + ': ' + who);
        rec.f(0, 1, 'property 55 of its class: 9 or 10 make it a crawling monster, 11 a dragon, 12 an octo, anything else an ordinary one (0xFF when the class has none)', { value: String(kind) });
        rec.f(1, 2, 'the monster’s object: a character below 256, a prop of the level from 256', { value: String(id) });
        rec.f(3, 2, 'the frame it is showing, which changes as it turns and walks (AdjustAspect)', { value: String(u16be(b, q + 3)) });
        rec.f(5, 2, 'the way it faces, set from the direction of each step (HandleMove, DxDyToFace)', { value: String(u16be(b, q + 5)) });
        let o = 7;
        if (id >= 256) {
          rec.f(o, 2, 'its index in the level’s list', { value: String(u16be(b, q + o)) }); o += 2;
          const cr = byteMapRecord({ fields: rec.kids, bytes: b }, q + o, 32, 'a separate character-shaped record, since it has no 0xF009 row');
          for (const l of charRecordLayout()) cr.f(l.off, l.w, l.name, { value: byteMapHex(b, q + o + l.off, l.w) });
          o += 32;
        }
        rec.f(o, 1, '1 while it has a waypoint to walk to (SetWaypoint)', { value: String(b[q + o]) }); o += 1;
        rec.f(o, 4, 'where it is going: x and y (SetWaypoint; 0xA5A5 when nothing has ever sent it anywhere)', { value: '(' + u16be(b, q + o) + ', ' + u16be(b, q + o + 2) + ')' }); o += 4;
        rec.f(o, 4, 'the next waypoint on the way there: x and y (TPathFinder::FindWaypoint)', { value: '(' + u16be(b, q + o) + ', ' + u16be(b, q + o + 2) + ')' }); o += 4;
        rec.f(o, 2, 'how many activities it has queued', { value: String(cnt) }); o += 2;
        for (let a = 0; a < cnt; a++) {
          const ar = byteMapRecord({ fields: rec.kids, bytes: b }, q + o, 9, 'queued activity ' + a);
          // DoMove switches on the first queued entry's code in place of
          // the character's own behaviour (byte 22), so a code is a
          // behaviour; scripts queue them (cbQueueAction, the one caller).
          const beh = b[q + o];
          const said = String(behaviourWordHTML(beh)).replace(/<[^>]+>/g, '');
          ar.f(0, 1, 'the behavior it carries out first, in place of the one in the character’s byte 22 (TActiveMonster::DoMove)', { value: String(beh) + (said ? ', ' + said : '') });
          ar.f(1, 2, 'the behavior’s first argument', { value: String(u16be(b, q + o + 1)) });
          ar.f(3, 2, 'its second argument', { value: String(u16be(b, q + o + 3)) });
          ar.f(5, 4, 'what it is about: a reference in the scripts’ form (0x5000FFFF is none)', { value: '0x' + u32be(b, q + o + 5).toString(16).toUpperCase().padStart(8, '0') });
          o += 9;
        }
        if (kind === 9 || kind === 10) {
          const segs = u16be(b, q + o);
          rec.f(o, 2, 'how many body segments it has (TCrawlMonster::Save)', { value: String(segs) }); o += 2;
          for (let k = 0; k < segs; k++, o += 2) rec.f(o, 2, 'body segment ' + k + ', a prop of the level', { value: String(u16be(b, q + o)) });
        } else if (kind === 11 || kind === 12) {
          for (let k = 0; k < (kind === 11 ? 4 : 8); k++, o += 2) rec.f(o, 2, (kind === 11 ? 'part ' : 'arm ') + k + ', a prop of the level (' + (kind === 11 ? 'TDragonMonster' : 'TOctoMonster') + '::Save)', { value: String(u16be(b, q + o)) });
        }
        q += n; m++;
      }
      if (q < end) { leaf(q, end - q, 'the rest of the block, which does not parse as a monster', { value: byteMapHex(b, q, end - q), unread: true }); q = end; }
    } else if (tag === 'FXQ ') {
      // TSpellFX::WriteFXQueue: each entry of the effects map, a character
      // and a flag and when it wears off, which TSpellFX::PassTime reads.
      for (let e = 0; body + 6 * (e + 1) <= end; e++, q += 6) {
        const who = u16be(b, q), flag = u16be(b, q + 2), until = u16be(b, q + 4);
        const r = byteMapRecord({ fields: chunk.kids, bytes: b }, q, 6, 'spell effect ' + e + ': ' + (characterName(who) || 'character ' + who) + ', flag ' + flag);
        r.f(0, 2, 'the character it is on', { value: String(who) });
        r.f(2, 2, 'the character flag it applies: flags below 8 are in byte 8, flags below 24 in the status flags, and the rest in byte 26', { value: String(flag) });
        r.f(4, 2, 'when it wears off: the effect ends once the time passes this, and at 0xF000 or more it never ends (PassTime)', { value: until >= 0xF000 ? 'never (' + until + ')' : String(until) });
      }
    } else if (tag === 'Grem') {
      // TGremlin::SaveGremlins: 256 frames of a state and a heap reference.
      for (let g = 0; g < 256 && q + 4 <= end; g++, q += 4) {
        const r = byteMapRecord({ fields: chunk.kids, bytes: b }, q, 4, 'gremlin ' + g, { empty: u32be(b, q) === 0x00020000 });
        r.f(0, 2, 'its state, which a script reads and sets as field 20: 0 hears the party enter and the zone’s signals (OnEnter, OnSignal), 1 and below 0 do not, and 2 is no gremlin, set for every number without a script, which is all of them in the shipped game (ClearGremlins)', { value: String((u16be(b, q) << 16) >> 16) });
        r.f(2, 2, 'the heap reference of its frame, 0 for none', { value: String(u16be(b, q + 2)) });
      }
    } else if (tag === 'Wind') {
      // TInventoryWindow::MarshalAll, last window first; a character
      // window (TCharacterWindow::Marshal) is its class code, its base
      // class's short (TInventoryWindow::Marshal, from +16), and its left,
      // top and a short from +134. Another class is left whole.
      for (let w = 0; q + 12 <= end && String.fromCharCode(b[q], b[q + 1], b[q + 2], b[q + 3]) === 'ChrW'; w++, q += 12) {
        const r = byteMapRecord({ fields: chunk.kids, bytes: b }, q, 12, 'open window ' + w + ', a character’s');
        r.f(0, 4, 'the window’s class code', { value: 'ChrW' });
        r.f(4, 2, 'whose things it shows (+16, which the inventory window’s constructor sets and RenumberParent moves)', { value: String(u16be(b, q + 4)) });
        r.f(6, 2, 'the window’s left edge', { value: String(u16be(b, q + 6)) });
        r.f(8, 2, 'its top edge', { value: String(u16be(b, q + 8)) });
        r.f(10, 2, 'which pane it shows (+134, TCharacterWindow::ChangePane)', { value: String(u16be(b, q + 10)) });
      }
    }
    // Anything a block holds past what is read above.
    if (q < end) leaf(q, end - q, tag === 'Wind' ? 'an open window of a class whose record the page does not read' : 'the rest of the block', { value: byteMapHex(b, q, end - q), unread: true });
    pos += 4 + len;
    if (len < 4) break;
  }
  if (pos < b.length) p.f(pos, b.length - pos, 'bytes after the last block', { value: byteMapHex(b, pos, b.length - pos), unread: true });
}

// The To Do list (TToDo::SaveToDo, DoneToDo, the add opcode): 256 of 8 bytes.
function byteMapToDo(p) {
  const b = p.bytes;
  for (let s = 0; s * 8 + 8 <= b.length; s++) {
    const at = s * 8, ref = u32be(b, at + 4);
    const r = byteMapRecord(p, at, 8, 'slot ' + s, { empty: ref === 0x5000FFFF && !b[at] && !b[at + 1] && !u16be(b, at + 2) });
    r.f(0, 1, '1 once a script strikes the line off (DoneToDo)', { value: String(b[at]) });
    r.f(1, 1, 'padding: nothing in the program writes it (AddToDo and DoneToDo write byte 0)', { value: String(b[at + 1]) });
    r.f(2, 2, 'the day the line went on the list', { value: String(u16be(b, at + 2)) });
    r.f(4, 4, 'the line: the To Do text resource in the low half and the line’s number in the high twelve bits, 0x5000FFFF for none', { value: ref === 0x5000FFFF ? 'none' : 'line ' + ((ref >>> 16) & 0xFFF) + ' of 0x' + (ref & 0xFFFF).toString(16).toUpperCase().padStart(4, '0') });
  }
}
/* The macro slots (TStatusWindow::SaveMacros): ten halfwords, not twenty
   bytes. DefineFKey puts a skill number in a slot (SetMacro), and a key
   whose code is 256 plus the slot's number runs it (PerformMacro): FindSkill
   on the current character, then TTaskMaster::ScheduleSkill. −1 is none. */
function byteMapMacros(p) {
  const b = p.bytes;
  for (let s = 0; s * 2 + 2 <= b.length; s++) {
    const v = (u16be(b, s * 2) << 16) >> 16;
    p.f(s * 2, 2, 'macro slot ' + s + ', the key with code ' + (256 + s) + ': the skill it runs, −1 for none', { value: v === -1 ? 'none' : 'skill ' + v, empty: v === -1 });
  }
  if (b.length & 1) p.f(b.length - 1, 1, 'a last byte past the slots', { value: String(b[b.length - 1]), unread: true });
}
// The rooms (SaveGlobals, GetField for a Room): 1,024 halfwords.
function byteMapRooms(p) {
  const b = p.bytes;
  for (let n = 0; n * 2 + 2 <= b.length; n++) {
    const v = u16be(b, n * 2);
    p.f(n * 2, 2, 'room ' + n + ': the game sets bit 0 the first time the party enters it, when its description runs (TGameSys::HeartBeat); nothing in the program or the scripts sets another bit', { value: '0x' + v.toString(16).toUpperCase().padStart(4, '0'), empty: !v, unread: !!(v & 0xFFFE) });
  }
}
// A zone's map memory (SaveLevelProps): one bit a square, LSB first, rows of
// ⌈width ÷ 8⌉ bytes. The width is the scenario's; without it, one field.
function byteMapAutomap(p, zone) {
  const b = p.bytes, m = zoneMapSize(zone);
  if (!m || Math.ceil(m.width / 8) * m.height !== b.length) { p.f(0, b.length, 'what the player has seen of zone ' + zone + ', one bit per square, least significant bit first', { value: byteMapAllZero(b, 0, b.length) ? 'nothing seen' : 'some squares seen' }); return; }
  const row = Math.ceil(m.width / 8);
  for (let y = 0; y < m.height; y++) p.f(y * row, row, 'row ' + y + ', squares 0 to ' + (m.width - 1) + ', one bit per square, least significant bit first',
    { value: byteMapAllZero(b, y * row, row) ? 'nothing seen' : byteMapHex(b, y * row, row), empty: byteMapAllZero(b, y * row, row) });
}
function zoneMapSize(zone) {
  try {
    const rid = 0x8000 | zone, raw = getResourceBytes(ARCHIVE, rid);
    if (raw) { let m = parseDelverMap(smartDecrypt(raw, rid).data); if (!m) m = parseDelverMap(decryptResource(raw, rid)); if (m) return m; }
    const kept = window.SCENARIO_MAP_SIZES;
    return kept && kept[zone] ? kept[zone] : null;
  } catch (e) { quiet(e); return null; }
}
/* The heap (THeap): blocks of an 8-byte header and their data. +0 the
   data's length, +4 the reference number (0 for a free block), +6 the kind
   in bits 4 to 6 of its first byte (1 a list, 2 a dict) and the reference
   count in the low ten bits (THeapObj::IncRef adds one). The add-on saves
   that hold blocks lay them end to end with the data rounded to four and
   no more: the Tree save's are at 0 and 36. save-format.md read THeap::Next
   as adding four more when a header's address has bit 2 set, which is an
   address in memory, not in the file; that rule is the fallback here, for
   either parity of the heap's base, when the plain chain does not end at
   the heap's end.
   A dict's data (THeapDict::CalcSize, lookup) is a count and the table's
   size, then that many eight-byte entries: a short key, two bytes the
   lookup does not read, and the value, a script value, or the program's
   empty mark (0x5000FFFE in every save here) for an empty entry. A list's
   (THeapList::CalcSize, GetItem) is its length, two bytes GetItem does not
   read, and four-byte items. */
function byteMapHeapChain(b, pad) {
  const out = [];
  let q = 0;
  while (q + 8 <= b.length && out.length < 70000) {
    const len = u32be(b, q);
    let step = 8 + ((len + 3) & ~3);
    if (pad !== null && ((q + pad) & 4)) step += 4;
    if (len > b.length || q + step > b.length) return null;
    out.push({ q, len, step });
    q += step;
  }
  return q === b.length ? out : null;
}
function byteMapHeap(p) {
  const b = p.bytes;
  const chain = byteMapHeapChain(b, null) || byteMapHeapChain(b, 0) || byteMapHeapChain(b, 4);
  if (!chain) { p.f(0, b.length, 'the heap, which does not parse as a chain of blocks', { value: byteMapHex(b, 0, b.length), unread: true }); return; }
  for (const { q, len, step } of chain) {
    const ref = u16be(b, q + 4), kind = (b[q + 6] >> 4) & 7, count = u16be(b, q + 6) & 0x3FF, free = !ref && !kind;
    const r = byteMapRecord(p, q, step, free ? 'a free block' : 'block ' + ref + (kind === 1 ? ', a list' : kind === 2 ? ', a dict' : ', kind ' + kind));
    r.f(0, 4, 'the data’s length', { value: String(len) });
    r.f(4, 2, 'the block’s reference number, 0 for a free block', { value: String(ref) });
    r.f(6, 2, 'its kind (bits 4 to 6 of the first byte: 1 a list, 2 a dict) and its reference count (the low ten bits)', { value: 'kind ' + kind + ', count ' + count });
    let o = 8;
    const d = q + 8;
    if (!free && kind === 2 && len >= 4) {
      const n = u16be(b, d), size = u16be(b, d + 2);
      r.f(o, 2, 'how many entries are in use', { value: String(n) }); r.f(o + 2, 2, 'how many the table holds', { value: String(size) }); o += 4;
      for (let k = 0; k < size && o + 8 <= 8 + len; k++, o += 8) {
        const v = u32be(b, q + o + 4), empty = v === 0x5000FFFE;
        const e = byteMapRecord({ fields: r.kids }, q + o, 8, empty ? 'entry ' + k + ', empty' : 'entry ' + k);
        e.f(0, 2, 'its key', { value: String(u16be(b, q + o)) });
        e.f(2, 2, 'two bytes the lookup does not read', { value: byteMapHex(b, q + o + 2, 2) });
        e.f(4, 4, empty ? 'the empty mark' : 'its value, a script value', { value: '0x' + v.toString(16).toUpperCase().padStart(8, '0') });
      }
    } else if (!free && kind === 1 && len >= 4) {
      const n = u16be(b, d);
      r.f(o, 2, 'the list’s length', { value: String(n) }); r.f(o + 2, 2, 'two bytes the game does not read (GetItem)', { value: byteMapHex(b, d + 2, 2) }); o += 4;
      for (let k = 0; o + 4 <= 8 + len; k++, o += 4) r.f(o, 4, k < n ? 'item ' + k + ', a script value' : 'room for another item', { value: '0x' + u32be(b, q + o).toString(16).toUpperCase().padStart(8, '0') });
    }
    if (o < step) r.f(o, step - o, free ? 'free space' + (byteMapAllZero(b, q + o, step - o) ? '' : ', holding what a freed block left') : o < 8 + len ? 'the block’s data, not read' : 'rounding to four',
                      { value: byteMapAllZero(b, q + o, step - o) ? 'all zero' : byteMapHex(b, q + o, step - o), unread: !free && o < 8 + len });
  }
}
// The prop frame table (THeap::Save, PropItem::AllocateFrame): 4,096 shorts.
function byteMapFrames(p) {
  const b = p.bytes;
  for (let n = 0; n * 2 + 2 <= b.length; n++) { const v = u16be(b, n * 2); p.f(n * 2, 2, 'the heap reference of the frame of the prop whose frame index is ' + n, { value: String(v), empty: !v }); }
}
/* A journal page (TJournalSegment, TJournal::MakeEntry): the journal is one
   byte stream over the pages from 0xE000, so an entry can run on into the
   next page. Each entry: its length (6 plus the text's), the day's low
   byte, its kind (0 said, 1 added, 2 a note), the speaker's low byte, a
   zero, and the text. `carry` is how much of an entry the previous page
   left to this one. */
function byteMapJournalPage(p, carry) {
  const b = p.bytes;
  let q = 0;
  if (carry > 0) { const n = Math.min(carry, b.length); p.f(0, n, 'the rest of an entry begun on the page before', { value: decodeMacRoman(b.subarray(0, Math.min(n, 60))) }); q = n; carry -= n; }
  while (q + 2 <= b.length) {
    const len = u16be(b, q);
    if (!len) { p.f(q, b.length - q, 'the rest of the page, after the last entry', { value: byteMapAllZero(b, q, b.length - q) ? 'all zero' : byteMapHex(b, q, b.length - q), unread: !byteMapAllZero(b, q, b.length - q) }); q = b.length; break; }
    const n = Math.min(len, b.length - q);
    const r = byteMapRecord(p, q, n, 'an entry');
    const hdr = [[2, 'the entry’s length: 6 plus the length of the text'], [1, 'the low byte of the day'], [1, 'its kind: 0 something said, 1 a line added, 2 a note'], [1, 'for something said, the low byte of the speaker'], [1, 'a zero']];
    let o = 0;
    for (const [w, nm] of hdr) { if (o + w > n) break; r.f(o, w, nm, { value: w === 2 ? String(u16be(b, q + o)) : String(b[q + o]) }); o += w; }
    if (n > o) r.f(o, n - o, 'the text', { value: decodeMacRoman(b.subarray(q + o, q + Math.min(n, o + 80))) });
    carry = len - n; q += n;
  }
  return carry;
}

/* The resource fork (Resource Manager format; save-format.md, The resource
   fork): a 16-byte header, a data area of length-prefixed resources, and the
   map. The resources a save's fork holds: SCEN 128, an alias record to the
   scenario; pnot 0, the preview note; PICT, the preview picture. */
function byteMapResourceFork(raw) {
  const p = byteMapPart('rsrc', 'the resource fork: which scenario the save belongs to, and its preview picture', raw);
  let fork = null;
  try { fork = openResourceFork(raw); } catch (e) { quiet(e); }
  if (!fork) { p.f(0, raw.length, 'a resource fork that does not parse', { value: byteMapHex(raw, 0, raw.length), unread: true }); return p; }
  const b = raw, map = fork.mapOff;
  p.f(0, 4, 'where the data area starts', { value: String(fork.dataOff) });
  p.f(4, 4, 'where the map starts', { value: String(map) });
  p.f(8, 4, 'the data area’s length', { value: String(fork.dataLen) });
  p.f(12, 4, 'the map’s length', { value: String(fork.mapLen) });
  if (fork.dataOff > 16) p.f(16, fork.dataOff - 16, 'the room the format leaves between the header and the first resource (More Macintosh Toolbox, figure 1-11)',
                             { value: byteMapAllZero(b, 16, fork.dataOff - 16) ? 'all zero' : byteMapHex(b, 16, fork.dataOff - 16) });
  const tl = map + u16be(b, map + 24), nl = map + u16be(b, map + 26);
  p.f(map, 16, 'the map’s copy of the header (or zeros)', { value: byteMapHex(b, map, 16) });
  p.f(map + 16, 4, 'room for the Resource Manager’s handle to the next map', { value: byteMapHex(b, map + 16, 4) });
  p.f(map + 20, 2, 'room for the file’s reference number', { value: byteMapHex(b, map + 20, 2) });
  p.f(map + 22, 2, 'the fork’s attributes', { value: byteMapHex(b, map + 22, 2) });
  p.f(map + 24, 2, 'where the type list is, from the map', { value: String(tl - map) });
  p.f(map + 26, 2, 'where the name list is, from the map', { value: String(nl - map) });
  p.f(tl, 2, 'the number of types, less one', { value: String(u16be(b, tl)) });
  fork.typeList.forEach((t, i) => {
    const e = tl + 2 + i * 8;
    p.f(e, 4, 'a type', { value: t.type });
    p.f(e + 4, 2, 'how many ' + t.type + ' resources, less one', { value: String(t.count - 1) });
    p.f(e + 6, 2, 'where its reference list is, from the type list', { value: String(t.refListOff) });
    (fork.resourcesByType[t.type] || []).forEach((r, k) => {
      const rp = tl + t.refListOff + k * 12, d = fork.dataOff + r.dataOffRel, len = u32be(b, d);
      p.f(rp, 2, t.type + ' ' + r.id + ': its id', { value: String(r.id) });
      p.f(rp + 2, 2, t.type + ' ' + r.id + ': where its name is, −1 for none', { value: String(r.nameOff) });
      p.f(rp + 4, 1, t.type + ' ' + r.id + ': its attributes', { value: '0x' + r.attrs.toString(16).toUpperCase() });
      p.f(rp + 5, 3, t.type + ' ' + r.id + ': where its data is, from the data area', { value: String(r.dataOffRel) });
      p.f(rp + 8, 4, t.type + ' ' + r.id + ': room for its handle', { value: byteMapHex(b, rp + 8, 4) });
      if (r.name !== null && r.nameOff >= 0) p.f(nl + r.nameOff, 1 + b[nl + r.nameOff], t.type + ' ' + r.id + ': its name', { value: r.name });
      p.f(d, 4, t.type + ' ' + r.id + ': its length', { value: String(len) });
      byteMapForkResource(p, t.type, r.id, d + 4, len);
    });
  });
  byteMapFillGaps(p, 0, b.length, 'space between the parts of the fork');
  p.fields.sort((x, y) => x.at - y.at);
  return p;
}
function byteMapForkResource(p, type, id, at, len) {
  const b = p.bytes, nm = type + ' ' + id;
  if (type === 'pnot' && len === 12) {
    p.f(at, 4, nm + ': when the game made the preview', { value: String(u32be(b, at)) });
    p.f(at + 4, 2, nm + ': version', { value: String(u16be(b, at + 4)) });
    p.f(at + 6, 4, nm + ': the preview’s type', { value: String.fromCharCode(b[at + 6], b[at + 7], b[at + 8], b[at + 9]) });
    p.f(at + 10, 2, nm + ': the preview’s id', { value: String(u16be(b, at + 10)) });
  } else if (type === 'PICT' && len >= 10) {
    p.f(at, 2, nm + ': the picture’s size (low word)', { value: String(u16be(b, at)) });
    p.f(at + 2, 8, nm + ': its frame, top, left, bottom and right', { value: [0, 2, 4, 6].map(k => u16be(b, at + 2 + k)).join(', ') });
    if (len > 10) p.f(at + 10, len - 10, nm + ': the picture, as QuickDraw opcodes', { value: len - 10 + ' bytes' });
  } else if (type === 'SCEN' && len >= 6) {
    p.f(at, 4, nm + ': the alias’s user type', { value: byteMapHex(b, at, 4) });
    p.f(at + 4, 2, nm + ': the alias’s length', { value: String(u16be(b, at + 4)) });
    if (len > 6) p.f(at + 6, len - 6, nm + ': the rest of the alias record, which Apple keeps private; it names the scenario file and its folder', { value: len - 6 + ' bytes' });
  } else if (len) {
    p.f(at, len, nm + ': a resource no save here has shown', { value: byteMapHex(b, at, len), unread: true });
  }
}

/* The whole save, a part for the data fork's structure, one for each
   resource, one for the resource fork. Built once per open file. */
function saveByteMap() {
  if (DERIVED.SAVE_BYTE_MAP !== undefined) return DERIVED.SAVE_BYTE_MAP;
  let out = null;
  try {
    const arc = ARCHIVE;
    if (!arc) return (DERIVED.SAVE_BYTE_MAP = null);
    const parts = [byteMapDataFork(arc)];
    let carry = 0;
    for (let s = 0; s < 256; s++) {
      if (!arc.index[s] || !arc.index[s][0]) continue;
      for (let k = 0; k < 256; k++) {
        const rid = ((s + 1) << 8) | k;
        let raw = null; try { raw = getResourceBytes(arc, rid); } catch (e) { quiet(e); }
        if (!raw || !raw.length) continue;
        const b = new Uint8Array(smartDecrypt(raw, rid).data);
        const hex = '0x' + rid.toString(16).toUpperCase().padStart(4, '0');
        const hi = rid >> 8, what = (savedGameParts().find(x => x.rid === rid) || {}).what;
        const p = byteMapPart(rid, hex + (what ? ', ' + what : ''), b, { rid });
        if (rid === 0x0400) byteMapStream(p);
        else if (rid === 0x0401) byteMapToDo(p);
        else if (rid === 0x0404) byteMapMacros(p);
        else if (rid === 0xF009) for (let n = 0; n * 32 + 32 <= b.length; n++) byteMapCharRecord(p, n * 32, 'character ' + n + (n ? ', ' + (characterName(n) || '') : ', slot 0'));
        else if (rid === 0xF00E) byteMapRooms(p);
        else if (rid === 0xF306) for (let n = 0; n * 16 + 16 <= b.length; n++) byteMapPropRecord(p, n * 16, 'prop ' + n);
        else if (hi === 0x81) for (let n = 0; n * 16 + 16 <= b.length; n++) byteMapPropRecord(p, n * 16, 'prop ' + (256 + n));
        else if (hi === 0x82) byteMapAutomap(p, rid & 0xFF);
        else if (rid === 0xF307) byteMapHeap(p);
        else if (rid === 0xF308) byteMapFrames(p);
        else if (hi === 0x88) p.f(0, b.length, 'the portrait, as the game’s compressed image opcodes (decompressDCG)', { value: b.length + ' bytes' });
        else if (hi >= 0xE0 && hi <= 0xEF) carry = byteMapJournalPage(p, carry);
        else if (hi >= 0x10 && hi < 0x40) p.f(0, b.length, 'a script the interpreter wrote back (the one encrypted kind of resource in a save)', { value: b.length + ' bytes' });
        else p.f(0, b.length, 'a resource no save here has shown', { value: byteMapHex(b, 0, b.length), unread: true });
        // Anything a parser stopped short of is still a field.
        const leaves = byteMapLeaves(p), last = leaves.length ? Math.max(...leaves.map(x => x.at + x.len)) : 0;
        if (last < b.length) p.f(last, b.length - last, 'bytes after what the reading above covers', { value: byteMapHex(b, last, b.length - last), unread: true });
        parts.push(p);
      }
    }
    const rsrc = window.CYTHERA_RSRC_RAW;
    if (rsrc && rsrc.length) parts.push(byteMapResourceFork(new Uint8Array(rsrc)));
    let total = 0, unread = 0;
    for (const p of parts) for (const x of byteMapLeaves(p)) { if (x.part) continue; total += x.len; if (x.unread) unread += x.len; }
    // The resources' bytes are counted in their own parts, not again in the
    // data fork's, where each is one field pointing to its part.
    out = { parts, total, unread, files: arc.bytes.length + (rsrc ? rsrc.length : 0) };
  } catch (e) { quiet(e, 'the save’s byte map'); out = null; }
  return (DERIVED.SAVE_BYTE_MAP = out);
}

/* The view: a line of totals and one closed <details> a part, whose table
   is built when it is opened. Runs of empty records fold into one row. */
function saveByteMapHTML() {
  const m = saveByteMap();
  if (!m) return '';
  const gaps = m.parts.reduce((n, p) => n + saveByteMapGaps(p).length, 0);
  return '<h4 class="saveH4">Every Byte</h4><div class="saveNote">' + m.files.toLocaleString('en-US') + ' bytes in ' + m.parts.length + ' parts, every byte in a labeled field' +
    (gaps ? ' except for ' + gaps + ' stretches (a fault in this page’s reading)' : '') +
    (m.unread ? '; ' + m.unread.toLocaleString('en-US') + ' of them in fields nobody has worked out yet, marked <span class="byteUnread">not read</span>.'
              : ', and every field’s meaning is known.') + '</div>' +
    m.parts.map(p => '<details class="byteMapPart" ontoggle="openSaveBytePart(this, ' + JSON.stringify(String(p.key)).replace(/"/g, '&quot;') + ')"><summary>' +
      svEsc(p.title) + ' <span class="byteMapSize">' + fmtBytes(p.size) + '</span></summary><div class="byteMapBody"></div></details>').join('');
}
function openSaveBytePart(el, key) {
  if (!el.open) return;
  const body = el.querySelector('.byteMapBody');
  if (!body || body.dataset.filled) return;
  const m = saveByteMap(), p = m && m.parts.find(x => String(x.key) === String(key));
  if (!p) return;
  body.innerHTML = byteMapTableHTML(p.fields);
  body.dataset.filled = '1';
}
function byteMapTableHTML(fields) {
  const rows = [];
  const hex = n => '0x' + n.toString(16).toUpperCase();
  for (let i = 0; i < fields.length; i++) {
    const x = fields[i];
    if (x.empty) {
      let j = i; while (j + 1 < fields.length && fields[j + 1].empty) j++;
      if (j > i) {
        const y = fields[j];
        rows.push('<tr><td class="num">' + hex(x.at) + '</td><td class="num">' + (y.at + y.len - x.at).toLocaleString('en-US') + '</td><td>' +
          svEsc(x.name) + ' to ' + svEsc(y.name) + ': ' + (j - i + 1) + ' empty</td><td></td></tr>');
        i = j; continue;
      }
    }
    const what = x.kids
      ? '<details class="byteMapRec"><summary>' + svEsc(x.name) + '</summary>' + byteMapTableHTML(x.kids) + '</details>'
      : svEsc(x.name) + (x.unread ? ' <span class="byteUnread">not read</span>' : '');
    rows.push('<tr><td class="num">' + hex(x.at) + '</td><td class="num">' + x.len.toLocaleString('en-US') + '</td><td>' + what + '</td><td>' +
      (x.kids ? '' : svEsc(x.value === undefined ? '' : String(x.value))) + '</td></tr>');
  }
  return '<div class="tableScroll"><table class="forkTable byteMapTable"><thead><tr><th class="num">at</th><th class="num">bytes</th><th>what</th><th>value</th></tr></thead><tbody>' +
    rows.join('') + '</tbody></table></div>';
}

function renderSaveSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const recs = loadCharacterTable();
  if (!recs.length) {
    grid.innerHTML = '<div class="changesView"><p>This file has no 0xF009 character table, ' +
      'so there is nothing to show here. A Cythera player file always has one, and so does ' +
      'Cythera Data.</p></div>';
    out.textContent = 'No character records in this file.';
    return;
  }
  const isSave = (window.ARCHIVE_FINDER || {}).type === 'DelP';
  const hero = recs[1];
  // Built as one markup string into the grid rather than into a detached
  // node: ids inside innerHTML only become findable once the element they are
  // set on is in the document, and the edit form is found by id.
  let h = '';

  // Who and where.
  const face = characterFace(1);
  h += '<div class="saveHead">' +
    (face ? '<img class="saveFace" src="' + face.url + '" alt="">' : '') +
    '<div><h3>Saved Game</h3>' +
    '<div class="mechLede">' +
    (isSave
      ? svEsc(window.ARCHIVE_FINDER.name || 'This saved game') + '. ' +
        (hero && hero.zone
          ? svEsc(characterName(1)) + ' is in ' + svEsc(zoneDisplayName(hero.zone)) +
            ' at (' + hero.x + ', ' + hero.y + '), with ' + hero.health + ' of ' + hero.healthMax + ' health.'
          : 'The hero is in no zone.')
      : 'This is Cythera Data, not a saved game: these are the characters as a new game starts.') +
    '</div></div></div>';

  if (namesAreBorrowed())
    h += '<div class="saveNote">The names here come from the scenario opened earlier in this ' +
      'session, not from this file. A saved game has no table of names, but a character number ' +
      'means the same person in every Cythera file.</div>';

  // What the file holds.
  const parts = savedGameParts();
  if (parts.length) {
    h += '<h4 class="saveH4">What This File Holds</h4><div class="tableScroll"><table class="forkTable cardTable">' +
      '<thead><tr><th>resource</th><th>what it is</th><th>bytes</th></tr></thead><tbody>' +
      parts.map(p => {
        let n = 0; try { n = (getResourceBytes(ARCHIVE, p.rid) || []).length; } catch (e) { quiet(e); }
        return '<tr><td class="num">0x' + p.rid.toString(16).toUpperCase().padStart(4, '0') + '</td>' +
          '<td>' + svEsc(p.what) + '</td><td class="num">' + fmtBytes(n) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Everybody.
  const inUse = recs.filter(delverCharacterInUse);
  const marked = recs.filter(r => !delverCharacterInUse(r) && (r.zone || r.raw.some(b => b))).length;
  const shown = window.SAVE_SHOW_ALL ? recs.filter(r => r.zone || r.raw.some(b => b)) : inUse;
  h += '<h4 class="saveH4">The Records</h4>' +
    '<div class="saveNote">' + inUse.length + ' of the 512 character slots are in use' +
    (marked ? ', and ' + marked + ' more hold only a zone' : '') +
    '. Slot 0 is the figure called Nothing on the nothing map. ' + actionChip('Cheats', "showCategory('CHEATS')") + ' ' +
    actionChip(window.SAVE_SHOW_ALL ? 'Only the ones in use' : 'Show every marked slot',
               'toggleSaveShowAll()') + '</div>';
  h += '<div class="tableScroll"><table class="forkTable"><thead><tr>' +
    '<th class="num">no.</th><th>who</th><th>where</th><th class="num">lv</th><th class="num">xp</th>' +
    '<th class="num">health</th><th class="num">magic</th>' +
    '<th class="num">food</th><th class="num">train</th><th></th></tr></thead><tbody>';
  for (const r of shown) {
    const i = r.index;
    h += '<tr' + (i === 1 ? ' class="saveHero"' : '') + '>' +
      '<td class="num">' + i + '</td>' +
      '<td class="who">' + svEsc(i ? characterName(i) : 'slot 0, not a character') + '</td>' +
      '<td class="where">' + svEsc(r.zone ? zoneDisplayName(r.zone) + ' (' + r.x + ', ' + r.y + ')' : 'nowhere') + '</td>' +
      '<td class="num">' + r.level + '</td><td class="num">' + r.xp + '</td>' +
      '<td class="num">' + r.health + '/' + r.healthMax + '</td>' +
      '<td class="num">' + r.magic + '/' + r.magicMax + '</td>' +
      '<td class="num">' + r.nutrition + '</td><td class="num">' + r.training + '</td>' +
      '<td>' + actionChip('Edit', 'toggleCharEdit(' + i + ')') + '</td></tr>' +
      '<tr class="saveEditRow"><td colspan="10"><div class="propEdit" id="charEdit-' + i + '" style="display:none"></div></td></tr>';
  }
  h += '</tbody></table></div>';
  // The rest of a save, each where the file has it (the scenario has none).
  const words = saveWords();
  h += questStateHTML(words) + roomsEnteredHTML(words) + gremlinsHTML(words) + todoHTML(words);
  if (isSave) h += saveByteMapHTML();
  h += '<div class="saveNote">Edit shows all 32 bytes of a record and what each one is. ' +
    'Edits change only the copy in this browser. To download the edited file, go to ' +
    actionChip('Changes', "showCategory('CHANGES')") + '.</div>';
  grid.innerHTML = '<div class="changesView">' + h + '</div>';
  out.textContent = (isSave ? 'Saved game' : 'Character records') + ': ' +
    inUse.length + ' of 512 slots in use' + (hero && hero.zone ? ', the player in ' + zoneDisplayName(hero.zone) : '') + '.';
  // An edit's rebuild redraws this sheet; put the reader back at the row they
  // were working in rather than folding it away under them.
  if (window.SAVE_EDIT_OPEN != null) {
    const keep = window.SAVE_EDIT_OPEN;
    window.SAVE_EDIT_OPEN = null;
    toggleCharEdit(keep);
  }
}

function toggleSaveShowAll() { window.SAVE_SHOW_ALL = !window.SAVE_SHOW_ALL; renderSaveSheet(); }

/* One record's form, every byte of it (25 September 2026, at the
   maintainer's asking what the party and state bytes were and whether the
   eleven unnamed bytes could be named). All 32 are, now, from three
   readings that already existed: GetField's table of the character's fields
   19 to 40 (exeCharacterFields, which gives each field's byte and the
   handler that loads it), the routines that use the bytes the table does
   not serve (TActiveMonster::DoTick's move countdown and sub-move counter,
   DoMove's behaviour switch, the unit constructor's alignment), and the
   scripts that read a field (0xE95, the defence helper's stand-in). The
   form groups them by what they are for, and each says what it is, links
   to its own byte of 0xF009, and with the application open to the handler
   that serves it. What was wrong before: byte 8, called the "state byte"
   and described as movement and orientation, is the character's first
   eight flags (bit 6 is in the party); byte 18, called the "party byte"
   and "0 before Hector joins and 5 after", is the countdown to the next
   move, which is why it changed on every step in the saves. Byte 23 and
   byte 31 were the two left, and were read on 26 September 2026: 23 is a
   merchant's price (shopPriceRule) and 31 the size a created creature was
   made at (exeCreatureSize). */
/* A merchant's price, byte 23, which GetField serves as field 39. Every
   shop script hands the merchant's field 39 to the buying helper 0xEA5 or
   the selling helper 0xEA9 and stores back what it returns
   (`Arg00.0x27 = 0xEA5(greeting, stock, Arg00.0x27, ...)`). 0xEA5 prices a
   thing at its worth times the factor over ten, starts a factor under 9 at
   20, and haggling takes it down a tenth at a time; 0xEA9 pays the worth
   times ten over the factor and starts a 0 at 10. One byte serves both, so
   a merchant who has sold at double buys at half. The two starting values
   are the first `set_local 0x32` (the third argument) of each helper. */
function shopPriceRule() {
  if (DERIVED.SHOP_PRICE !== undefined) return DERIVED.SHOP_PRICE;
  let out = null;
  try {
    const start = rid => { const e = dvmScriptEntry(rid), g = e ? dvmSeqFirst(dvmOpsOf(e), [/^set_local 0x32$/, DVM_NUM]) : null; return g ? dvmVal(rid, g[1]) : null; };
    const buy = start(0xEA5), sell = start(0xEA9);
    if (buy && sell) out = { buy, sell };
  } catch (e) { quiet(e); }
  return (DERIVED.SHOP_PRICE = out);
}
/* The size a created creature was made at, byte 31. A creature from a
   map's list gets a character record of its own, the first free one from
   256 on, and TActiveMonster::TActiveMonster(short) draws a percentage,
   stores it in byte 31 and makes the unit's body, reflex, mind and health
   (0xF008 bytes 0, 1, 2 and 5) that percentage of themselves, rounded and
   at least 1. The band it is drawn from is picked by the third short of the
   save's Char block (TOC+8562, which only SaveToFile and RestoreModel touch
   besides): 0 to 4 give 10 to 49, 25 to 99, 50 to 149, 100 to 199 and 150
   to 299, anything else 100, and the program starts it at 2, which every
   save on this disk carries. The 64 created creatures in the playthrough
   saves all match: stats equal to the unit's times byte 31 over 100, byte
   31 from 63 to 135, and none with byte 30, byte 23 or a flat 100 in its
   place. Named characters (0 to 255) keep their own stats and are not
   given it. The reader finds the `stb` of byte 31 in the constructor, to
   link to. */
function exeCreatureSize() {
  if (!appImage()) return null;
  if (DERIVED.CREATURE_SIZE !== undefined) return DERIVED.CREATURE_SIZE;
  let out = null;
  try {
    const ops = exeOpsNamed('TActiveMonster::TActiveMonster(short)');
    const k = exeFind(ops, 0, ops.length, d => d.mn === 'stb' && d.d === 31);
    if (k >= 0) out = exeVal(ops[k], 31);
  } catch (e) { quiet(e); }
  return (DERIVED.CREATURE_SIZE = out);
}
function charFieldAt(offset) {
  const cf = appImage() ? exeCharacterFields() : null;
  return cf ? cf.fields.find(f => f.offset && f.offset.v === offset) || null : null;
}
function charFieldNumbered(n) {
  const cf = appImage() ? exeCharacterFields() : null;
  return cf ? cf.fields.find(f => f.field === n) || null : null;
}
// "byte 9, field 23": the byte a link to 0xF009 at that record, the field a
// link to its handler in the program.
function charWhere(index, off, width, fieldNo) {
  const f = fieldNo !== undefined ? charFieldNumbered(fieldNo) : charFieldAt(off);
  const bytes = srcNum({ resid: 0xF009, byte: index * 32 + off, stride: 32 }, width > 2 ? 'bytes ' + off + ' to ' + (off + width - 1) : width > 1 ? 'bytes ' + off + ' and ' + (off + width - 1) : 'byte ' + off);
  return bytes + (f ? ', ' + srcNum({ exe: f.at }, 'field ' + f.field) + (f.name ? ' <span class="charName">' + svEsc(f.name) + '</span>' : '') : '');
}
const u16raw = (r, o) => (r.raw[o] << 8) | r.raw[o + 1];
const CHAR_GROUPS = [
  { head: 'Where', items: [
    { id: 'zone', key: 'zone', label: 'zone', off: 0, max: 0xFF,
      what: (r, v) => v ? svEsc(zoneDisplayName(v)) + ', map 0x' + (0x8000 | v).toString(16).toUpperCase() : 'placed in no zone' },
    { id: 'x', key: 'x', label: 'x', off: 1, width: 3, max: 0xFFF, what: () => 'squares from the left' },
    { id: 'y', key: 'y', label: 'y', off: 1, width: 3, max: 0xFFF, what: () => 'squares from the top' },
  ]},
  { head: 'Looks', items: [
    { id: 'proptype', key: 'proptype', label: 'sprite class', off: 4, width: 2, fieldNo: 36, max: 0x3FF,
      what: (r, v) => { const n = propDisplayName(v, (getPropTileList()[v] || 0)); return (n ? svEsc(n) + ', ' : '') + 'the prop class the game draws them as'; } },
    { id: 'aspect', key: 'aspect', label: 'aspect', off: 4, width: 2, fieldNo: 36, max: 0x3F, what: () => 'the frame of that sprite' },
    { id: 'look2', raw: [20, 2], label: 'second look', base: 16, max: 0xFFFF, fieldNo: 37,
      what: r => 'a second sprite and frame, ' + (u16raw(r, 20) === u16raw(r, 4) ? 'the same as the first here' : 'different from the first here') + '; no script uses it' },
  ]},
  { head: 'Stats', items: [
    { id: 'body', key: 'body', label: 'body', off: 9, max: 0xFF },
    { id: 'reflex', key: 'reflex', label: 'reflex', off: 10, max: 0xFF },
    { id: 'mind', key: 'mind', label: 'mind', off: 11, max: 0xFF },
    { id: 'level', key: 'level', label: 'level', off: 19, max: 0xFF },
    { id: 'xp', key: 'xp', label: 'experience', off: 12, width: 2, max: 0xFFFF,
      what: () => { const r = experienceRules().rule; return r && r.cap ? 'the experience script caps it at ' + r.cap.v.toLocaleString('en-US') : ''; } },
    { id: 'health', key: 'health', label: 'health', off: 14, max: 0xFF },
    { id: 'healthMax', key: 'healthMax', label: 'full health', off: 15, max: 0xFF },
    { id: 'magic', key: 'magic', label: 'magic', off: 16, max: 0xFF },
    { id: 'magicMax', key: 'magicMax', label: 'full magic', off: 17, max: 0xFF },
    { id: 'nutrition', key: 'nutrition', label: 'food', off: 27, max: 0xFF, what: () => {
      const clk = appImage() ? exeClockRules() : null, full = fullStomach();
      return [clk && clk.model ? clk.fall.v + ' comes off each time the clock passes ' + exeClockWords(clk.table.v[clk.model.hungerIndex], clk.unitsPerHour.v) : '',
              full ? 'the ' + svEsc(full.potion) + ' sets it to ' + full.v : ''].filter(Boolean).join('; ');
    } },
    { id: 'training', key: 'training', label: 'training points', off: 28, max: 0xFF,
      what: () => { const t = trainingRules().points; return t && t.perLessonVal && t.masteryVal ? 'a lesson costs ' + t.perLessonVal.v + ', a mastery ' + t.masteryVal.v : ''; } },
  ]},
  { head: 'Behavior', items: [
    { id: 'behaviour', raw: [22, 1], label: 'behavior', fieldNo: 21, max: 0xFF,
      what: (r, v) => { const w = behaviourWordHTML(v);
        return (w ? '<b>' + w + '</b>, ' : '') + 'what they do each turn; 112 is waiting where they stand'; } },
    { id: 'behaviour2', raw: [30, 1], label: 'second behavior', max: 0xFF, what: () => 'a second behavior the scripts read and set' },
    { id: 'timing', key: 'party', label: 'move countdown', off: 18, max: 0xFF,
      what: () => 'ticks before their next move, so it changes on every step' },
    { id: 'submove', raw: [24, 1], label: 'sub-move counter', max: 0xFF, what: () => 'the parts of a move still to take' },
    { id: 'alignment', raw: [25, 1], label: 'alignment', max: 0xFF,
      what: (r, v) => { const a = appImage() ? exeAlignmentNames() : null, n = a && a.byValue[v];
        return (n ? '<b>' + srcNum(n.at, n.name) + '</b>, ' : '') + 'which side they are on, which decides who their enemies are'; } },
    { id: 'rating', raw: [29, 1], label: 'defense stand-in', max: 0xFF,
      what: (r, v) => 'for a character without the Defense skill, their defense is ' +
        ['none', 'half their level', 'their level', 'twice their level'][v & 3] },
    { id: 'b23', raw: [23, 1], label: 'price', max: 0xFF,
      what: () => { const p = shopPriceRule();
        return 'a merchant’s price, in tenths of a thing’s worth' +
               (p ? ': shops start at ' + srcNum(p.buy, String(p.buy.v)) + ' to sell to you and ' + srcNum(p.sell, String(p.sell.v)) + ' to buy from you, and keep what haggling leaves' : ''); } },
    { id: 'b31', raw: [31, 1], label: 'size', max: 0xFF,
      what: () => { const c = exeCreatureSize();
        return 'for a creature made from a map’s list, the percentage of its kind’s stats it was ' + (c ? srcNum({ exe: c.exe }, 'made at') : 'made at') +
               '; named characters ignore it'; } },
  ]},
];
// Flags 0 to 7 are byte 8, 8 to 23 the halfword at 6, 24 to 31 byte 26:
// the order AddAbility and the schedules test them in (scheduleHoldsAtStart).
function charFlagOn(r, f) { return f < 8 ? !!(r.raw[8] & (1 << f)) : f < 24 ? !!(u16raw(r, 6) & (1 << (f - 8))) : !!(r.raw[26] & (1 << (f - 24))); }
function charFlagName(f) { return f < 8 ? dvmBitFlagName(f) : dvmFlagName(f); }
function charItemValue(r, it) {
  if (it.key) return r[it.key];
  return it.raw[1] === 2 ? u16raw(r, it.raw[0]) : r.raw[it.raw[0]];
}
function toggleCharEdit(index) {
  const host = document.getElementById('charEdit-' + index);
  if (!host) return;
  if (host.style.display !== 'none') {
    host.style.display = 'none'; host.innerHTML = '';
    if (window.SAVE_EDIT_OPEN === index) window.SAVE_EDIT_OPEN = null;
    return;
  }
  const html = charEditHTML(index);
  if (!html) return;
  host.innerHTML = html;
  host.style.display = '';
  // As wide as the part of the table that shows, not as the table: the
  // records table scrolls sideways on a phone, and the form in its row
  // would otherwise run off the right with it.
  const box = typeof host.closest === 'function' ? host.closest('.tableScroll') : null;
  if (box && box.clientWidth) host.style.maxWidth = Math.max(240, box.clientWidth - 12) + 'px';
  window.SAVE_EDIT_OPEN = index;
}
// The form's markup, apart from where it is put, so the smoke can read it.
function charEditHTML(index) {
  const rec = loadCharacterTable()[index];
  if (!rec) return '';
  const whatOf = (it, v) => { if (!it.what) return ''; try { return it.what(rec, v) || ''; } catch (e) { quiet(e); return ''; } };
  let h = '';
  for (const g of CHAR_GROUPS) {
    h += '<div class="charGroup"><div class="charGroupHead">' + svEsc(g.head) + '</div>';
    for (const it of g.items) {
      const v = charItemValue(rec, it), hex = it.base === 16;
      const off = it.raw ? it.raw[0] : it.off, width = it.raw ? it.raw[1] : (it.width || 1);
      h += '<div class="charRow"><label>' + svEsc(it.label) + ' ' + (hex ? '0x' : '') +
        '<input id="ce-' + index + '-' + it.id + '" value="' + (hex ? v.toString(16).toUpperCase().padStart(width * 2, '0') : v) +
        '" size="' + (it.max > 0xFF ? 5 : 4) + '" spellcheck="false"></label> <span class="charWhere">' + charWhere(index, off, width, it.fieldNo) + '</span>' +
        (whatOf(it, v) ? '<div class="charWhat">' + whatOf(it, v) + '</div>' : '') + '</div>';
    }
    h += '</div>';
  }
  h += '<div class="charGroup"><div class="charGroupHead">Flags</div><div class="charWhat">The character flags that the scripts set, clear and check by number. ' +
    'Flags 0 to 7 are ' + charWhere(index, 8, 1) + ', 8 to 23 ' + charWhere(index, 6, 2) + ' and 24 to 31 ' + charWhere(index, 26, 1) +
    '. The names are the program’s' + (appImage() ? '' : ', and appear only when the program is open') + '.</div><div class="charFlags">';
  for (let f = 0; f < 32; f++) {
    const nm = appImage() ? charFlagName(f) : null;
    h += '<label><input type="checkbox" id="ce-' + index + '-flag' + f + '"' + (charFlagOn(rec, f) ? ' checked' : '') + '> ' + f + (nm ? ' ' + svEsc(nm.replace(/^Is/, '').replace(/([a-z])([A-Z])/g, '$1 $2')) : '') + '</label>';
  }
  h += '</div></div>';
  return h +
    '<div class="charActions"><button class="sv-chip" onclick="applyCharEditForm(' + index + ')">Apply</button>' +
    (index === 1 ? actionChip('Make them well', 'healCharacterRecord(1)', fullStomach() ? 'health, magic and a full stomach' : 'health and magic') : '') + '</div>' +
    '<div class="inspDim">All 32 bytes are above. Apply rebuilds the whole file.</div>' +
    ((window.ARCHIVE_FINDER || {}).type === 'DelP' ? giveFormHTML(index) : '');
}

function applyCharEditForm(index) {
  const rec = loadCharacterTable()[index];
  if (!rec) return;
  const fields = {}, raw = {};
  for (const g of CHAR_GROUPS) for (const it of g.items) {
    const el = document.getElementById('ce-' + index + '-' + it.id);
    if (!el) return;
    const v = parseInt(el.value, it.base || 10);
    if (!Number.isInteger(v) || v < 0 || v > it.max) { setStatus('Bad value for ' + it.label + ', nothing changed.', true); return; }
    if (it.key) fields[it.key] = v;
    else if (it.raw[1] === 2) { raw[it.raw[0]] = v >> 8; raw[it.raw[0] + 1] = v & 0xFF; }
    else raw[it.raw[0]] = v;
  }
  // The flags into bytes 8, 6 and 7, and 26; byte 8 goes by its field, which
  // the writer lays over the raw bytes.
  let b8 = 0, w6 = 0, b26 = 0;
  for (let f = 0; f < 32; f++) {
    const el = document.getElementById('ce-' + index + '-flag' + f);
    if (!el || !el.checked) continue;
    if (f < 8) b8 |= 1 << f; else if (f < 24) w6 |= 1 << (f - 8); else b26 |= 1 << (f - 24);
  }
  fields.state = b8; raw[6] = w6 >> 8; raw[7] = w6 & 0xFF; raw[26] = b26;
  applyCharacterRecordEdit(index, fields, raw);
}

// Health, magic and a full stomach: the one convenience offered, because it
// is the three fields anybody opening a save is here to change. Health and
// magic have a maximum the record states; a full stomach is what the potion
// that sets nutrition sets it to, read off its script (fullStomach), and
// left alone when no script says.
function healCharacterRecord(index) {
  const rec = loadCharacterTable()[index];
  if (!rec) return;
  const full = fullStomach();
  applyCharacterRecordEdit(index, Object.assign({ health: rec.healthMax, magic: rec.magicMax }, full ? { nutrition: full.v } : {}));
}
/* What a full stomach is: the value the potion that sets nutrition sets it
   to (foodRules, off the potion scripts). A saved game carries no scripts,
   so the scenario's, read when it was opened, is kept and borrowed, the way
   the character names are. */
window.SCENARIO_FULL_STOMACH = null;
function fullStomach() {
  let found = null;
  try {
    for (const p of foodRules().potions) { const e = (p.effects || []).find(x => x.field === 'nutrition'); if (e) { found = { v: e.set, potion: p.name, src: e.src }; break; } }
  } catch (e) { found = null; }
  if (found) window.SCENARIO_FULL_STOMACH = found;
  return found || window.SCENARIO_FULL_STOMACH;
}

function applyCharacterRecordEdit(index, fields, rawBytes) {
  const raw = getResourceBytes(ARCHIVE, 0xF009);
  if (!raw) { setStatus('This file has no character table.', true); return false; }
  const records = parseDelverCharacterRecords(smartDecrypt(raw, 0xF009).data);
  if (!records[index]) return false;
  // Bytes no field of the parser carries, written into the record's raw
  // bytes, which the writer lays down before the fields.
  for (const [o, v] of Object.entries(rawBytes || {})) records[index].raw[+o] = v & 0xFF;
  Object.assign(records[index], fields);
  const ok = applyResourceEdit(0xF009, writeDelverCharacterRecords(records));
  /* A placed character stands in two places in a saved game: this record,
     and prop record `index` of 0xF306, the characters' prop list, which is
     what the game places them from when the file loads. Moved here alone
     the hero loaded where the prop record said and was saved back there,
     the edit gone -- which is how utilities/game_check.mjs first failed,
     19 September 2026, the first time a save this page wrote was put in
     front of the game. So a square edited here moves the prop record too.
     A zone is not carried across: a character in another zone belongs in
     that zone's list, which is a move this form does not make. */
  if (ok && (fields.x !== undefined || fields.y !== undefined) && getResourceBytes(ARCHIVE, 0xF306)) {
    const props = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0xF306), 0xF306).data);
    if (props[index]) {
      const move = {};
      if (fields.x !== undefined) move.x = fields.x;
      if (fields.y !== undefined) move.y = fields.y;
      applyPropRecordEdit(0xF306, index, move);
    }
  }
  if (ok) setStatus('Record ' + index + ' (' + characterName(index) + ') rewritten.');
  return ok;
}

/* ---- The rest of a save, a form each (25 September 2026) -----------------
   The character records were the only part of a player file the sheet
   edited. Four more are small and fully read, so each has a form here on
   the same seam as the records: read the segment, change the bytes the form
   names, hand the whole segment to applyResourceEdit, and let the sheet
   redraw from the rebuilt file.

   - The quest values and flags, in the Char block at the head of 0x0400:
     32 value bytes at +16, then 256 flags as eight big-endian longs at +48,
     flag n being bit n & 31 of long n >> 5 counted from the least
     significant (saveQuestState reads them the same way; the writer below
     is its inverse and the smoke holds the two together).
   - The rooms entered, 0xF00E: a halfword a room, and bit 0 is "entered
     once, description shown" (TGameSys::HeartBeat sets it and runs the
     room's LookAt only while it is clear). Only bit 0 is ever set by the
     game, and the form touches no other.
   - The To Do list, 0x0401: 256 entries of eight bytes. +0 is the struck-off
     byte (TToDo::DoneToDo writes 1 there and nothing else), +2 a halfword
     TToDo::AddToDo takes from the global at r2 - 5220, which is also the
     Char block's short at +84 (1 in every save on the disk, and the stamp
     on the one live entry any of them holds), and +4 the text reference.
     An empty slot reads 00 00 00 00 50 00 FF FF. The reference for line n
     is the line-0 word with n in bits 16 to 27, because that is what the
     interpreter's add does to a resource reference: TInterp::DoExpr's
     handler for opcode 0x4A, when the left operand's top nibble is 3 and the
     right one is a plain number, adds the number to the low twelve bits of
     the high halfword and keeps the tag (0x07F364 on). So a script's
     `0x021A[0] + 114` is 0x3072021A. Adding to a slot that holds a line
     changes only the reference, as AddToDo does.
   - A thing given to a character: a sixteen-byte record appended to the
     prop list of the zone the character stands in, flags 0x10 and the
     character's number in the low sixteen bits of the location word, which
     is how every carried thing in a played save sits (the hero's amulet in
     cp1-intro-done is record 1121 of 0x8103, flags 0x10). A skill or spell
     is the same record with flags 0x1C, which is what the game writes when
     a scroll teaches one. Equipping is not offered: 0x18 on a record the
     character does not wear-check is a state the game never made.

   Two loads were tried in the fork on the same day, which is what decides
   the gating: a hero moved into a zone the save holds no list for loads,
   and the game reads the scenario's list for it and writes it into the save
   on the next save; but a thing can only be given where a list exists,
   since there is nothing to append to otherwise. And a save whose Mons
   chunk has lost the hero's entry loads and then halts the game when it
   next saves, so nothing here touches Mons.

   WHAT THE ROWS ARE CALLED. A save carries no scripts, no To Do text and no
   room descriptions, so those are taken from the scenario at the moment a
   save replaces it (keepScenarioSaveWords, called from parseArchiveBytes),
   the way the character names are. Opened with no scenario before it, the
   forms still work and say numbers. */
window.SCENARIO_SAVE_WORDS = null;
function scenarioSaveWords() {
  const le = looseEnds(), td = todoRules();
  const sites = m => {
    const o = {};
    for (const [k, v] of m) {
      const seen = new Map();
      for (const s of v.values()) if (!seen.has(s.resid)) seen.set(s.resid, { resid: s.resid, at: s.at, name: labelFor(s.resid) || propWordHex(s.resid) });
      o[k] = [...seen.values()];
    }
    return o;
  };
  const rooms = [];
  for (const [n, eggs] of roomEggIndex()) {
    const rid = 0x1B00 + n;
    if (!refExists(rid)) continue;
    let text = '';
    const e = buildScriptTextIndex().find(x => x.resid === rid);
    const m = e && /"((?:[^"\\]|\\.)*)"/.exec(e.text);
    if (m) { try { text = JSON.parse('"' + m[1] + '"').trim(); } catch (err) { text = ''; } }
    rooms.push({ n, zones: [...new Set(eggs.map(g => g.zone))], text });
  }
  rooms.sort((a, b) => a.n - b.n);
  // Every line a script can put in a slot: the pairs the scripts state, and
  // for the one computed site (slot 18, the Books of Wisdom) each line its
  // count can reach that the text array holds.
  const pairs = new Map();
  for (const a of td.adds) {
    if (!a.slot || !a.line) continue;
    const top = a.state === null ? 0 : 31;
    for (let k = 0; k <= top; k++) {
      const line = a.line.v + k;
      if (k && !(td.lines && td.lines.has(line))) continue;
      pairs.set(a.slot.v + ':' + line, { slot: a.slot.v, line });
    }
  }
  return { values: { writes: sites(le.writes), reads: sites(le.reads) }, flags: { writes: sites(le.flagWrites), reads: sites(le.flagReads) },
           todo: { textResid: td.textResid, lines: td.lines ? [...td.lines] : [], pairs: [...pairs.values()].sort((a, b) => a.slot - b.slot || a.line - b.line) },
           rooms, gremlins: Array.from({ length: 256 }, (_, n) => n).filter(n => refExists(0x1F00 + n)) };
}
// Called by parseArchiveBytes while the scenario is still the open file and
// a save is about to replace it.
function keepScenarioSaveWords() {
  try { window.SCENARIO_SAVE_WORDS = scenarioSaveWords(); } catch (e) { quiet(e, 'the scenario’s words for the save forms'); }
  // Each zone's width and height, which a save's map memory is laid out by
  // and a save does not hold (saveByteMap).
  try {
    const sizes = {};
    for (let n = 0; n < subindexCount(ARCHIVE, 127); n++) {
      const rid = 0x8000 + n, raw = getResourceBytes(ARCHIVE, rid);
      if (!raw) continue;
      let m = parseDelverMap(smartDecrypt(raw, rid).data);
      if (!m) m = parseDelverMap(decryptResource(raw, rid));
      if (m) sizes[n] = { width: m.width, height: m.height };
    }
    window.SCENARIO_MAP_SIZES = sizes;
  } catch (e) { quiet(e, 'the scenario’s map sizes for a save’s byte map'); }
}
// The open file's own words when it has scripts, else the kept ones.
function saveWords() {
  if (refExists(0x1802) || refExists(0x021A)) {
    try { return scenarioSaveWords(); } catch (e) { quiet(e, 'the open file’s words for the save forms'); }
  }
  return window.SCENARIO_SAVE_WORDS;
}
// A script named as a site: a link when the open file has the script, its
// name alone when the name was kept from the scenario.
function saveSiteList(list) {
  if (!list || !list.length) return '';
  return list.map(s => refExists(s.resid) ? srcNum(s, s.name) : svEsc(s.name)).join(', ');
}
function saveSegment(rid) {
  const raw = getResourceBytes(ARCHIVE, rid);
  return raw ? new Uint8Array(smartDecrypt(raw, rid).data) : null;
}
function saveCharBlock() {
  const b = saveSegment(0x0400);
  return b && b.length >= 90 && String.fromCharCode(b[0], b[1], b[2], b[3]) === 'Char' ? b : null;
}
// Where flag n lives in the Char block: the inverse of saveQuestState.
function questFlagSpot(n) { return { byte: 48 + (n >> 5) * 4 + 3 - ((n & 31) >> 3), bit: n & 7 }; }
function questFlagOf(b, n) { const s = questFlagSpot(n); return !!((b[s.byte] >> s.bit) & 1); }

/* The quest block's form. Rows are the values and flags some script sets or
   tests, and any the save has set; the rest keep what they hold. */
function questStateHTML(words) {
  const b = saveCharBlock();
  if (!b) return '';
  const vw = words ? words.values : null, fw = words ? words.flags : null;
  const valueRows = [], flagRows = [];
  for (let n = 0; n < 32; n++) {
    const used = vw && (vw.writes[n] || vw.reads[n]);
    if (!used && !b[16 + n] && vw) continue;
    valueRows.push('<tr><td class="num">' + n + '</td><td><input id="qv-' + n + '" value="' + b[16 + n] + '" size="4" spellcheck="false"></td>' +
      '<td>' + saveSiteList(vw && vw.writes[n]) + '</td><td>' + saveSiteList(vw && vw.reads[n]) + '</td></tr>');
  }
  for (let n = 0; n < 256; n++) {
    const on = questFlagOf(b, n), used = fw && (fw.writes[n] || fw.reads[n]);
    if (!used && !on) continue;
    flagRows.push('<tr><td class="num">' + n + '</td><td><input type="checkbox" id="qf-' + n + '"' + (on ? ' checked' : '') + '></td>' +
      '<td>' + saveSiteList(fw && fw.writes[n]) + '</td><td>' + saveSiteList(fw && fw.reads[n]) + '</td></tr>');
  }
  const head = '<thead><tr><th class="num">no.</th><th>value</th><th>set by</th><th>tested by</th></tr></thead>';
  let h = '<h4 class="saveH4">Quest Values and Flags</h4>' +
    '<div class="saveNote">The 32 quest values and 256 quest flags in which the scripts record the story, from the start of 0x0400. ' +
    (words ? 'These are the ones a script sets or checks, and any that this save has set; the rest are unchanged. The files do not say what each one means, so they appear as numbers.'
           : 'No scenario was open before this save, so the page cannot tell which scripts use each one, and lists every value.') + '</div>' +
    '<div class="tableScroll"><table class="forkTable">' + head + '<tbody>' + valueRows.join('') + '</tbody></table></div>' +
    '<div class="tableScroll"><table class="forkTable">' + head.replace('<th>value</th>', '<th>set</th>') + '<tbody>' + flagRows.join('') + '</tbody></table></div>' +
    '<div class="propEdit"><button class="sv-chip" onclick="applyQuestStateForm()">Apply</button>' +
    '<label>any other flag <input id="qf-other" value="" size="4" spellcheck="false"></label>' +
    actionChip('Set it', 'setQuestFlagByNumber(true)') + actionChip('Clear it', 'setQuestFlagByNumber(false)') + '</div>';
  return h;
}
function writeQuestState(values, flags) {
  const b = saveCharBlock();
  if (!b) { setStatus('This file has no quest block.', true); return false; }
  for (const [n, v] of Object.entries(values || {})) b[16 + +n] = v;
  for (const [n, on] of Object.entries(flags || {})) {
    const s = questFlagSpot(+n);
    b[s.byte] = on ? (b[s.byte] | (1 << s.bit)) : (b[s.byte] & ~(1 << s.bit));
  }
  const ok = applyResourceEdit(0x0400, b);
  if (ok) setStatus('The quest values and flags rewritten.');
  return ok;
}
function applyQuestStateForm() {
  const values = {}, flags = {};
  for (let n = 0; n < 32; n++) {
    const el = document.getElementById('qv-' + n);
    if (!el) continue;
    const v = parseInt(el.value, 10);
    if (!Number.isInteger(v) || v < 0 || v > 255) { setStatus('Bad value for quest value ' + n + ', nothing changed.', true); return; }
    values[n] = v;
  }
  for (let n = 0; n < 256; n++) { const el = document.getElementById('qf-' + n); if (el) flags[n] = !!el.checked; }
  writeQuestState(values, flags);
}
function setQuestFlagByNumber(on) {
  const el = document.getElementById('qf-other');
  const n = el ? parseInt(el.value, 10) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 255) { setStatus('A quest flag is a number from 0 to 255; nothing changed.', true); return; }
  writeQuestState({}, { [n]: on });
}

/* The rooms entered. */
function roomsEnteredHTML(words) {
  const b = saveSegment(0xF00E);
  if (!b) return '';
  const known = new Map((words ? words.rooms : []).map(r => [r.n, r]));
  const count = b.length >> 1;
  for (let n = 0; n < count; n++) if ((b[2 * n + 1] & 1) && !known.has(n)) known.set(n, { n, zones: [], text: '' });
  const rows = [...known.values()].sort((a, c) => a.n - c.n);
  const entered = rows.filter(r => b[2 * r.n + 1] & 1).length;
  return '<h4 class="saveH4">Rooms Entered</h4>' +
    '<div class="saveNote">0xF00E has a switch for each room, set the first time the player walks in. A room whose switch is clear shows its description when the player enters it. ' +
    'The party has entered ' + entered + ' of the ' + rows.length + ' rooms listed.' + (words ? '' : ' No scenario was open before this save, so the list holds only the rooms the party has entered.') + '</div>' +
    '<details><summary>Every room</summary><div class="tableScroll"><table class="forkTable">' +
    '<thead><tr><th class="num">room</th><th>entered</th><th>where</th><th>its description</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td class="num">' + r.n + '</td><td><input type="checkbox" id="rm-' + r.n + '"' + ((b[2 * r.n + 1] & 1) ? ' checked' : '') + '></td>' +
      '<td>' + svEsc(r.zones.map(zoneDisplayName).join(', ')) + '</td><td>' + svEsc(r.text) + '</td></tr>').join('') +
    '</tbody></table></div><div class="propEdit"><button class="sv-chip" onclick="applyRoomsForm()">Apply</button></div></details>';
}
/* The gremlins a save holds (TGremlin::SaveGremlins): a state for each of
   the 256, four bytes apiece in the Grem block of 0x0400, the second two a
   heap reference. 0 hears the party enter and the zone's signals, 1 does
   not, and 2 is no gremlin. A save keeps the states it was made with --
   LoadGremlins puts them back and nothing checks them against the scenario
   -- so a gremlin added to Cythera Data afterwards is 2 in an older save, and
   switching it to 0 here is what lets that save run it (run in the fork,
   26 September 2026: a save with 2 left the gremlin silent, one with 0 ran
   it). The table lists every gremlin a save has on or off, and every one
   the scenario opened before it has a script for. */
function saveGremlinBlock(b) {
  let pos = 0;
  while (b && pos + 8 <= b.length) {
    const tag = String.fromCharCode(b[pos], b[pos + 1], b[pos + 2], b[pos + 3]), len = u32be(b, pos + 4);
    if (tag === 'Grem') return { at: pos + 8, end: Math.min(b.length, pos + 4 + len) };
    if (len < 4) break;
    pos += 4 + len;
  }
  return null;
}
const SAVE_GREMLIN_STATES = [[0, 'on'], [1, 'off'], [2, 'none']];
// A state's options, the one it has selected; a state the three do not name is kept as its number.
function gremlinStateOptions(state) {
  const known = SAVE_GREMLIN_STATES.some(([v]) => v === state);
  return (known ? '' : '<option value="' + state + '" selected>' + state + '</option>') +
    SAVE_GREMLIN_STATES.map(([v, t]) => '<option value="' + v + '"' + (v === state ? ' selected' : '') + '>' + t + '</option>').join('');
}
function gremlinsHTML(words) {
  const b = saveSegment(0x0400), g = saveGremlinBlock(b);
  if (!g) return '';
  const scripted = new Set(words && words.gremlins ? words.gremlins : []);
  const rows = [];
  for (let n = 0; n < 256 && g.at + 4 * n + 2 <= g.end; n++) {
    const st = (u16be(b, g.at + 4 * n) << 16) >> 16;
    if (st !== 2 || scripted.has(n)) rows.push({ n, st });
  }
  return '<h4 class="saveH4">Gremlins</h4>' +
    '<div class="saveNote">A gremlin is a script the game runs when the party enters a room or a zone, and when a script sends a signal. ' +
    'A save keeps each gremlin as on, off or none, as it was at the moment of saving, so a gremlin added to Cythera Data later shows as none here until you switch it on. ' +
    (words ? (scripted.size ? 'The scenario opened before this save has ' + scripted.size + ' gremlin' + (scripted.size === 1 ? '' : 's') + '.' : 'The scenario opened before this save has no gremlins.')
           : 'No scenario was open before this save, so the list holds only the gremlins it has on or off.') + '</div>' +
    '<div class="tableScroll"><table class="forkTable"><thead><tr><th class="num">gremlin</th><th>state</th><th>in the scenario</th></tr></thead><tbody>' +
    rows.map(r => '<tr><td class="num">' + r.n + '</td><td><select id="grem-' + r.n + '">' + gremlinStateOptions(r.st) + '</select></td><td>' +
      (!words ? '' : scripted.has(r.n) ? 'has a script' : 'no script') + '</td></tr>').join('') +
    '<tr><td class="num"><input type="text" id="gremAddN" size="4" placeholder="number"></td><td><select id="gremAddState">' + gremlinStateOptions(0) + '</select></td><td>another gremlin</td></tr>' +
    '</tbody></table></div><div class="propEdit"><button class="sv-chip" onclick="applyGremlinsForm()">Apply</button></div>';
}
function applyGremlinsForm() {
  const want = new Map();
  for (let n = 0; n < 256; n++) {
    const sel = document.getElementById('grem-' + n);
    if (sel) want.set(n, +sel.value);
  }
  const add = document.getElementById('gremAddN'), addState = document.getElementById('gremAddState');
  if (add && add.value.trim() !== '') {
    const t = add.value.trim();
    if (!/^\d+$/.test(t) || +t > 255) { setStatus('A gremlin is numbered 0 to 255.', true); return false; }
    want.set(+t, addState ? +addState.value : 0);
  }
  return writeGremlinStates(want);
}
// Each gremlin named, set to the state given, in the save's Grem block.
function writeGremlinStates(changes) {
  const b = saveSegment(0x0400), g = saveGremlinBlock(b);
  if (!g) { setStatus('This file has no gremlins block.', true); return false; }
  const want = changes instanceof Map ? changes : new Map(Object.entries(changes).map(([n, v]) => [+n, +v]));
  let changed = 0;
  for (const [n, v] of want) {
    const p = g.at + 4 * n;
    if (p + 2 > g.end || ((u16be(b, p) << 16) >> 16) === v) continue;
    b[p] = (v >> 8) & 0xFF; b[p + 1] = v & 0xFF; changed++;
  }
  if (!changed) { setStatus('No gremlin changed.'); return false; }
  const ok = applyResourceEdit(0x0400, b);
  if (ok) setStatus(changed + ' gremlin' + (changed === 1 ? '' : 's') + ' rewritten.');
  return ok;
}
function writeRoomsEntered(changes) {
  const b = saveSegment(0xF00E);
  if (!b) { setStatus('This file has no rooms table.', true); return false; }
  for (const [n, on] of Object.entries(changes)) {
    const p = 2 * +n + 1;
    if (p >= b.length) continue;
    b[p] = on ? (b[p] | 1) : (b[p] & ~1);
  }
  const ok = applyResourceEdit(0xF00E, b);
  if (ok) setStatus('The rooms entered rewritten.');
  return ok;
}
function applyRoomsForm() {
  const b = saveSegment(0xF00E), changes = {};
  if (!b) return;
  for (let n = 0; n < b.length >> 1; n++) { const el = document.getElementById('rm-' + n); if (el) changes[n] = !!el.checked; }
  writeRoomsEntered(changes);
}

/* The To Do list. */
const TODO_EMPTY = [0, 0, 0, 0, 0x50, 0x00, 0xFF, 0xFF];
function todoEntries() {
  const b = saveSegment(0x0401);
  if (!b) return null;
  const out = [];
  for (let s = 0; s < b.length >> 3; s++) {
    const p = s * 8, ref = u32be(b, p + 4);
    if (ref === 0x5000FFFF) continue;
    out.push({ slot: s, struck: b[p] !== 0, day: u16be(b, p + 2), ref, resid: ref & 0xFFFF, line: (ref >>> 16) & 0x0FFF });
  }
  return out;
}
function todoHTML(words) {
  const live = todoEntries();
  if (!live) return '';
  const lines = new Map(words ? words.todo.lines : []);
  const lineText = (resid, line) => (words && resid === words.todo.textResid && lines.has(line)) ? lines.get(line) : 'line ' + line + ' of 0x' + resid.toString(16).toUpperCase();
  let h = '<h4 class="saveH4">The To Do List</h4><div class="saveNote">0x0401 has one entry for each of 256 slots: the line, whether it is struck off, and the day it went on the list.</div>';
  if (live.length)
    h += '<div class="tableScroll"><table class="forkTable"><thead><tr><th class="num">slot</th><th>line</th><th class="num">day</th><th></th></tr></thead><tbody>' +
      live.map(e => '<tr><td class="num">' + e.slot + '</td><td>' + (e.struck ? '<s>' : '') + svEsc(lineText(e.resid, e.line)) + (e.struck ? '</s>' : '') + '</td>' +
        '<td class="num">' + e.day + '</td><td>' + actionChip(e.struck ? 'Reopen' : 'Strike off', 'setTodoStruck(' + e.slot + ',' + !e.struck + ')') +
        actionChip('Remove', 'removeTodoEntry(' + e.slot + ')') + '</td></tr>').join('') + '</tbody></table></div>';
  else h += '<div class="saveNote">The list is empty.</div>';
  if (words && words.todo.textResid !== null && words.todo.pairs.length) {
    h += '<div class="propEdit"><label>add <select id="todo-add">' +
      words.todo.pairs.map(p => '<option value="' + p.slot + ':' + p.line + '">' + svEsc('slot ' + p.slot + ': ' + (lines.get(p.line) || 'line ' + p.line)) + '</option>').join('') +
      '</select></label>' + actionChip('Add', 'addTodoFromForm()') + '</div>' +
      '<div class="inspDim">The lines offered are the ones that some script adds, in the slot it adds them to. A slot that already holds a line takes the new wording and keeps its day and whether it is struck off, as the game does.</div>';
  }
  return h;
}
function writeTodoEntry(slot, fn) {
  const b = saveSegment(0x0401);
  if (!b || slot < 0 || slot * 8 + 8 > b.length) { setStatus('This file has no such To Do slot.', true); return false; }
  fn(b, slot * 8);
  return applyResourceEdit(0x0401, b);
}
function setTodoStruck(slot, struck) {
  if (writeTodoEntry(slot, (b, p) => { b[p] = struck ? 1 : 0; })) setStatus('To Do slot ' + slot + (struck ? ' struck off.' : ' reopened.'));
}
function removeTodoEntry(slot) {
  if (writeTodoEntry(slot, (b, p) => b.set(TODO_EMPTY, p))) setStatus('To Do slot ' + slot + ' emptied.');
}
function addTodoLine(slot, line, textResid) {
  const q = saveCharBlock();
  const day = q ? u16be(q, 84) : 1;
  const ref = (0x30000000 | ((line & 0x0FFF) << 16) | (textResid & 0xFFFF)) >>> 0;
  return writeTodoEntry(slot, (b, p) => {
    if (u32be(b, p + 4) === 0x5000FFFF) { b[p] = 0; b[p + 1] = 0; b[p + 2] = (day >> 8) & 0xFF; b[p + 3] = day & 0xFF; }
    b[p + 4] = ref >>> 24; b[p + 5] = (ref >> 16) & 0xFF; b[p + 6] = (ref >> 8) & 0xFF; b[p + 7] = ref & 0xFF;
  });
}
function addTodoFromForm() {
  const el = document.getElementById('todo-add'), w = saveWords();
  if (!el || !w || w.todo.textResid === null) return;
  const [slot, line] = el.value.split(':').map(Number);
  if (addTodoLine(slot, line, w.todo.textResid)) setStatus('Line ' + line + ' added to To Do slot ' + slot + '.');
}

/* Giving a character a thing. */
function giveListFor(index) {
  const rec = loadCharacterTable()[index];
  return rec && rec.zone && getResourceBytes(ARCHIVE, 0x8100 | rec.zone) ? 0x8100 | rec.zone : null;
}
function giveFormHTML(index) {
  const rid = giveListFor(index);
  if (!rid) return '<div class="inspDim">Nothing can be given here: the character is not in a zone whose prop list is in this file.</div>';
  const f = (id, label, val, size) => '<label>' + label + ' <input id="gv-' + index + '-' + id + '" value="' + val + '" size="' + size + '" spellcheck="false"></label>';
  return '<div class="propEdit"><b>Give</b> ' + f('pt', 'prop type', '', 5) + f('aspect', 'aspect', 0, 3) + f('d3', 'data 0x', '0000', 5) +
    '<label>as <select id="gv-' + index + '-kind"><option value="16">a thing carried</option><option value="28">a skill or spell</option></select></label>' +
    '<button class="sv-chip" onclick="applyGiveForm(' + index + ')">Give</button>' +
    '<div class="inspDim">A record is added to the end of 0x' + rid.toString(16).toUpperCase() + ', the prop list of the zone they are in, as something they hold. ' +
    'A skill or spell is a record of the same kind, whose prop type is the skill’s number and whose aspect is its level.</div></div>';
}
function giveToCharacter(index, fields) {
  const rid = giveListFor(index);
  if (!rid) { setStatus('Nothing can be given: the character is not in a zone whose prop list is in this file.', true); return false; }
  const records = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, rid), rid).data);
  records.push({ flags: fields.flags, x: 0, y: index, aspect: fields.aspect & 0x1F, rotated: 0, proptype: fields.proptype,
                 d3: fields.d3 || 0, storeref: 0, tail: '000000000000' });
  const ok = applyResourceEdit(rid, writeDelverPropList(records));
  if (ok) setStatus('Prop type ' + fields.proptype + ' given to ' + characterName(index) + ', record ' + (records.length - 1) + ' of 0x' + rid.toString(16).toUpperCase() + '.');
  return ok;
}
function applyGiveForm(index) {
  const get = id => document.getElementById('gv-' + index + '-' + id);
  const pt = parseInt(get('pt').value, 10), aspect = parseInt(get('aspect').value, 10), d3 = parseInt(get('d3').value, 16), flags = parseInt(get('kind').value, 10);
  if (!Number.isInteger(pt) || pt < 1 || pt > 0x3FF) { setStatus('A prop type is a number from 1 to 1023; nothing given.', true); return; }
  if (!Number.isInteger(aspect) || aspect < 0 || aspect > 31) { setStatus('An aspect is a number from 0 to 31; nothing given.', true); return; }
  if (!Number.isInteger(d3) || d3 < 0 || d3 > 0xFFFF) { setStatus('Bad data word; nothing given.', true); return; }
  window.SAVE_EDIT_OPEN = index;
  giveToCharacter(index, { proptype: pt, aspect, d3, flags });
}

function renderDataForkSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const r = new BinReader(ARCHIVE.bytes);
  const rows = [];
  let total = 0, totalBytes = 0;
  for (let subn = 0; subn < 256; subn++) {
    const [off, len] = ARCHIVE.index[subn] || [0, 0];
    if (!off) continue;
    r.seek(off);
    let count = 0, bytes = 0;
    for (let n = 0; n < Math.floor(len / 8); n++) {
      const roff = r.u32(), rlen = r.u32();
      if (roff) { count++; bytes += rlen; }
    }
    rows.push({ subn, count, bytes });
    total += count;
    totalBytes += bytes;
  }
  const table = document.createElement('table');
  table.className = 'forkTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>subindex</th><th>ids</th><th class="num">resources</th>' +
    '<th class="num">bytes</th><th>named</th><th>shown under</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const v = String(row.subn);
    const leaf = TAB_LEAF_FOR.get(v);
    const idTd = '<td class="num">' + row.subn + '</td>' +
      '<td class="num">0x' + ((row.subn + 1) << 8).toString(16).toUpperCase().padStart(4, '0') + 'xx</td>';
    tr.innerHTML = idTd +
      '<td class="num">' + row.count + '</td><td class="num">' + fmtBytes(row.bytes) + '</td>' +
      '<td>' + svEsc(CATEGORY_NAMES[row.subn] || '') + '</td>' +
      '<td>' + (leaf ? '<button class="navChip" onclick="showCategory(\'' + v + '\')">' +
                       svEsc(tabTrail(leaf)) + '</button>' : '') + '</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  // Six columns do not fit a phone; the table scrolls sideways inside its
  // own box rather than pushing the sheet off the right edge.
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.appendChild(table);
  grid.appendChild(scroll);
  const rsrc = window.CYTHERA_RSRC_RAW;
  out.textContent = (window.ARCHIVE_SOURCE_NAME || 'The data fork') + ': ' + fmtBytes(ARCHIVE.bytes.length) +
    ', ' + rows.length + ' subindexes, ' + total + ' resources (' + fmtBytes(totalBytes) + ' of payload)' +
    (rsrc && rsrc.length ? '; a resource fork of ' + fmtBytes(rsrc.length) + ' beside it'
                         : '; no resource fork came with it') + '.';
}

/* ---- Data > Installer -----------------------------------------------------
   Every file the installer carries, as the Finder would list them: path,
   type and creator, both fork sizes. Each row can be read (the text files,
   inline) or taken away as a MacBinary carrying both forks under its own
   name -- the form a real Mac wants, and the one the page already writes
   for an edited archive. The two files the rest of the page is built on are
   marked; opening them again from here is pointless and not offered.

   The bytes come out of the installer on demand, through viseExtract, and
   are not kept: the installer itself is what the page remembers (see
   adoptArchive), and a decoded stream is cached on it for the session. */
function installerTextOf(entry) {
  const got = viseExtract(window.INSTALLER.archive, entry);
  return decodeMacRoman(got.data);
}
function installerIsText(entry) {
  return entry.dataLen > 0 && (entry.type === 'TEXT' || entry.type === 'URL ' || entry.type === 'LINK');
}
function downloadInstallerFile(index) {
  const inst = window.INSTALLER;
  if (!inst) return;
  const entry = inst.archive.entries[index];
  if (!entry) return;
  const got = viseExtract(inst.archive, entry);
  if (!got.crcOk) setStatus('Warning: the installer’s checksum for ' + entry.name + ' does not match what came out.', true);
  downloadBlob(writeMacBinary({ name: entry.name, type: entry.type, creator: entry.creator, data: got.data, rsrc: got.rsrc }),
               safeFileName(entry.name) + '.bin');
}
function showInstallerText(index) {
  const inst = window.INSTALLER;
  const entry = inst && inst.archive.entries[index];
  const grid = document.getElementById('sheetGrid');
  if (!entry || !grid) return;
  let pre = document.getElementById('installerText');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'installerText';
    pre.className = 'installerText';
    grid.appendChild(pre);
  }
  let text;
  try { text = installerTextOf(entry); }
  catch (e) { text = 'The page could not read ' + entry.name + ': ' + e.message; }
  pre.textContent = entry.path + '\n' + '─'.repeat(Math.min(entry.path.length, 60)) + '\n' + text.replace(/\r\n?/g, '\n');
  pre.scrollIntoView({ block: 'nearest' });
}
// A file holding several installers (archive.org's "Cythera installers.sit"
// has all four releases) is re-opened at another one from the bytes already
// in hand. Everything archive-keyed resets through parseArchiveBytes as for
// any other open, and the remembered copy learns the choice.
function switchInstaller(name) {
  const inst = window.INSTALLER;
  if (!inst || !inst.raw || name === inst.picked) return;
  setStatus('Opening ' + name + '…');
  if (!adoptArchive(inst.raw, inst.sourceName, { pick: name, store: true, url: inst.url || undefined }))
    setStatus('The page could not open ' + name + ': ' + lastArchiveError, true);
  else showCategory('INSTALLER');
}
/* The icon the Finder shows for a file of this type, from the owning
   application's bundle: a BNDL maps local ids to FREF and ICN# resources, each
   FREF names a file type and a local icon id, and the icon families (icl8,
   icl4, ICN#) share the ICN# id. Cythera's bundle has four: the application
   (APPL), the data file (DelS), a saved game (DelP) and the scratch file
   (Temp). A Magpie patch is a DelP too and is told apart by its creator, so
   the bundle has no icon of its own for one. Anything else gets no icon rather
   than a wrong one. */
function bundleIconMap(fork, cacheKey) {
  const cache = DERIVED._BUNDLE_ICONS || (DERIVED._BUNDLE_ICONS = {});
  if (cache[cacheKey]) return cache[cacheKey];
  const map = {};
  try {
    const bndl = (fork.resourcesByType['BNDL'] || [])[0];
    const b = bndl ? fork.dataOf('BNDL', bndl) : null;
    const arrays = {};
    if (b) {
      let p = 6; const n = u16be(b, p) + 1; p += 2;
      for (let i = 0; i < n; i++) {
        const t = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]); p += 4;
        const cnt = u16be(b, p) + 1; p += 2;
        arrays[t] = {};
        for (let k = 0; k < cnt; k++) { arrays[t][u16be(b, p)] = u16be(b, p + 2); p += 4; }
      }
    }
    for (const [local, frefId] of Object.entries(arrays['FREF'] || {})) {
      const fe = (fork.resourcesByType['FREF'] || []).find(e => e.id === frefId);
      if (!fe) continue;
      const d = fork.dataOf('FREF', fe);
      const ftype = String.fromCharCode(d[0], d[1], d[2], d[3]);
      const iconLocal = u16be(d, 4);
      const iconId = (arrays['ICN#'] || {})[iconLocal];
      if (iconId !== undefined) map[ftype] = iconId;
    }
  } catch (e) { quiet(e); }
  cache[cacheKey] = map;
  return map;
}
function iconFromFork(fork, id) {
  for (const t of ['icl8', 'icl4', 'ICN#']) {
    const e = (fork.resourcesByType[t] || []).find(x => x.id === id);
    if (!e) continue;
    const pic = rsrcArtifacts(fork, t, e).find(a => a.canvas && a.canvas.width);
    if (pic) return pic.canvas;
  }
  return null;
}
function finderIconFor(type) {
  const fork = window.APP_RSRC;
  if (!fork) return null;
  const id = bundleIconMap(fork, 'app')[type];
  return id === undefined ? null : iconFromFork(fork, id);
}

/* Magpie's icon for a patch. A Magpie patch is a DelP file with Magpie's
   creator, Delp, so Cythera's bundle has nothing for one; Magpie's own
   bundle does, a FREF for DelP whose icon is the Delver document frame with
   a square patched into its corner. Magpie is Glenn Andreas's, not ours to
   ship, and the one copy there is comes inside the Pumpkin Patch archive
   (614_MagpiePumpkinPatch.sit.hqx). So when an archive opened here holds a
   program with Magpie's creator, its resource fork is kept, and remembered
   in this browser, which is the only place it goes: from then on the
   Patches tab can wear the icon, when a patch is the file open, without the
   archive being opened again.
   Asked for by the maintainer, 27 September 2026. */
const MAGPIE_FORK_KEY = 'grimoire.magpieFork';
function noteMagpieFrom(raw) {
  try {
    let buf = raw;
    const c = sniffMacContainer(raw);
    if (c && c.data && c.data.length) buf = c.data;
    if (typeof looksLikeStuffIt !== 'function' || !looksLikeStuffIt(buf)) return false;
    const e = parseStuffItArchive(buf).entries.find(x => !x.isFolder && x.type === 'APPL' && x.creator === DELV_PATCH_CREATOR && x.rsrcLen);
    if (!e) return false;
    const rsrc = stuffItFork(buf, e, 'rsrc');
    const fork = openResourceFork(rsrc);
    if (bundleIconMap(fork, 'magpie:' + rsrc.length)['DelP'] === undefined) return false;
    window.MAGPIE_FORK = fork;
    try {
      let s = '';
      for (let i = 0; i < rsrc.length; i += 0x8000) s += String.fromCharCode.apply(null, rsrc.subarray(i, i + 0x8000));
      localStorage.setItem(MAGPIE_FORK_KEY, window.btoa(s));
    } catch (err) { quiet(err, 'remembering Magpie\u2019s icons'); }
    try { syncTabsTo(document.getElementById('categorySelect').value); } catch (err) { quiet(err); }
    return true;
  } catch (err) { quiet(err, 'looking for Magpie in an archive'); return false; }
}
function magpieFork() {
  if (window.MAGPIE_FORK !== undefined) return window.MAGPIE_FORK;
  let fork = null;
  try {
    const s = localStorage.getItem(MAGPIE_FORK_KEY);
    if (s) fork = openResourceFork(Uint8Array.from(window.atob(s), ch => ch.charCodeAt(0)));
  } catch (err) { quiet(err, 'reading Magpie\u2019s remembered icons'); fork = null; }
  return (window.MAGPIE_FORK = fork);
}
// Whether the file open is a Magpie patch rather than Cythera Data, which is
// when the Patches tab wears a patch's Finder icon. Once a file.
function openFileIsPatch() {
  if (!ARCHIVE) return false;
  if (DERIVED.OPEN_IS_PATCH === undefined) {
    let p = false;
    try { p = !!delverArchivePatchPeek(ARCHIVE.bytes); } catch (e) { quiet(e, 'asking whether the open file is a patch'); }
    DERIVED.OPEN_IS_PATCH = p;
  }
  return DERIVED.OPEN_IS_PATCH;
}
function magpieIcon(type) {
  const fork = magpieFork();
  if (!fork) return null;
  const id = bundleIconMap(fork, 'magpie')[type];
  return id === undefined ? null : iconFromFork(fork, id);
}

/* Two icons that are not the game's, and are not in the game's fork either.

   The installer is a Macintosh file like any other and carries two kinds of
   icon the tab row can use. Its own application icon is in the fork it
   arrived in, through a VIS3 bundle with the same shape as Cythera's; that is
   the VISE mark, and it belongs on the Installer tab, which had been wearing
   a game tile because "the installer is a container rather than a Delver file
   type, so there is no icon of its own to take" -- true of the Delver bundle,
   and the installer has a bundle of its own.

   The other kind is a folder's custom icon, which on a classic Mac is an
   invisible file called `Icon\r` inside the folder, holding an icon family at
   id -16455. The installer's catalog carries five of them -- the game folder,
   CombatAI, Documentation, Screenshots and Web Site urls -- and CombatAI's is
   a folder with an axe across it, drawn for those files and no others.

   Both are null until a file is open, like every other icon from a fork, so
   each tab keeps the game tile named beside it as the fallback. */
function installerIcon(which) {
  const inst = window.INSTALLER;
  if (!inst) return null;
  const cache = DERIVED._INSTALLER_ICONS || (DERIVED._INSTALLER_ICONS = {});
  if (which in cache) return cache[which];
  let art = null;
  try {
    if (which === 'vise') {
      const raw = inst.container && inst.container.rsrc;
      if (raw && raw.length) {
        const fork = openResourceFork(raw);
        const id = bundleIconMap(fork, 'vise')['APPL'];
        if (id !== undefined) art = iconFromFork(fork, id);
      }
    } else {
      // The folder's own icon file, by the path the catalog gives it. The
      // name ends in a carriage return, which is what makes it invisible.
      // Matched on the tail of the path, not the whole of it: the top folder
      // is named for the release ("Cythera 1.0.4 \u0192"), and all four
      // releases open here.
      const tail = '/' + which + '/Icon\r';
      const e = inst.archive.entries.find(x => x.path.slice(-tail.length) === tail);
      if (e) {
        const got = viseExtract(inst.archive, e);
        if (got.rsrc && got.rsrc.length) art = iconFromFork(openResourceFork(got.rsrc), -16455);
      }
    }
  } catch (e) { art = null; }
  cache[which] = art;
  return art;
}

function renderInstallerSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const inst = window.INSTALLER;
  if (!inst) {
    out.textContent = 'This file did not come from the installer, so there is nothing else here.' + NO_INSTALLER_HINT;
    return;
  }
  const arc = inst.archive;
  const head = document.createElement('div');
  head.className = 'installerOpen';
  head.innerHTML = '<span class="propHead" style="margin-top:0">Open now</span>' +
    '<span class="installerOpenName">' + svEsc((inst.container && inst.container.name) || inst.sourceName) + '</span>' +
    (inst.container && inst.container.name && inst.container.name !== inst.sourceName
      ? '<span class="amNote">from ' + svEsc(inst.sourceName) + '</span>' : '');
  grid.appendChild(head);
  {
    const v = installerVersion();
    const line = document.createElement('div');
    line.className = 'amNote';
    line.style.cssText = 'grid-column:1/-1;text-align:left;margin:0 0 6px';
    line.textContent = (v ? 'Cythera ' + v + ' is the release this page is reading. ' : '') +
      (inst.installers && inst.installers.length > 1 ? 'The file also holds ' + inst.installers.filter(it => it.name !== inst.picked).map(it => it.name.replace(/ Installer$/, '')).join(', ') + '; choose one below to read it instead.' : 'It is the only release in this file.');
    grid.appendChild(line);
  }
  if (inst.installers && inst.installers.length > 1) {
    const row = document.createElement('div');
    row.className = 'sv-chips installerVersions';
    const label = document.createElement('span');
    label.className = 'amNote';
    label.textContent = 'This file holds ' + inst.installers.length + ' releases, the open one marked:';
    row.appendChild(label);
    for (const it of inst.installers) {
      const b = document.createElement('button');
      b.className = 'navChip' + (it.name === inst.picked ? ' active' : '');
      b.textContent = it.name.replace(/ Installer$/, '');
      b.title = it.path + ', ' + fmtBytes(it.dataLen);
      b.onclick = () => switchInstaller(it.name);
      row.appendChild(b);
    }
    grid.appendChild(row);
  }
  const table = document.createElement('table');
  table.className = 'forkTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th></th><th>file</th><th>type</th><th>creator</th>' +
    '<th class="num">data fork</th><th class="num">resource fork</th><th></th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  let total = 0;
  for (const e of arc.entries) {
    total += e.dataLen + e.rsrcLen;
    const tr = document.createElement('tr');
    const isArchive = e === inst.entry;
    const isApp = e.type === 'APPL' && e.creator === 'Delv';
    const role = isArchive ? ' <span class="amNote">, the file this page is showing</span>'
               : isApp ? ' <span class="amNote">, its resource fork is Cythera (App) › Resource Fork</span>' : '';
    const acts = [];
    if (installerIsText(e)) acts.push('<button class="navChip" onclick="showInstallerText(' + e.index + ')">Read</button>');
    acts.push('<button class="navChip" onclick="downloadInstallerFile(' + e.index + ')">.bin</button>');
    // The Finder's icon for the file's type, out of the application's
    // bundle (finderIconFor); an <img> so the row is one string.
    const ic = finderIconFor(e.type);
    tr.innerHTML = '<td class="icon">' + (ic ? '<img src="' + ic.toDataURL('image/png') + '" alt="" width="32" height="32">' : '') + '</td>' +
      '<td>' + svEsc(e.path).replace(/\r/g, '¬') + role + '</td>' +
      '<td class="num">' + svEsc(e.type.replace(/\0/g, '·')) + '</td><td class="num">' + svEsc(e.creator.replace(/\0/g, '·')) + '</td>' +
      '<td class="num">' + (e.dataLen ? fmtBytes(e.dataLen) : '') + '</td>' +
      '<td class="num">' + (e.rsrcLen ? fmtBytes(e.rsrcLen) : '') + '</td>' +
      '<td>' + acts.join(' ') + '</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.appendChild(table);
  grid.appendChild(scroll);
  const c = inst.container;
  out.textContent = (c && c.name ? '“' + c.name + '”' : inst.sourceName) +
    (c && c.name && c.name !== inst.sourceName ? ' from ' + inst.sourceName : '') + ', ' + arc.versionName +
    ', ' + arc.entries.length + ' files in ' + arc.dirs.length + ' folders, ' + fmtBytes(total) +
    ' once unpacked' + (c ? ', from a ' + c.kind + ' file (' + fmtBytes(arc.bytes.length) + ' of it the installer)' : '') +
    '. A .bin here is the file itself with both forks, the form a real Mac needs' +
    (inst.crcOk ? '' : '. The checksum the installer gives for the file did NOT match, so treat the data with suspicion') + '.';
}

/* ---- Data > Combat AI > Scripts / Rules ----------------------------------
   The nine .ai files and the AI Scripting Document that came with the
   installer, shown as they are: they are plain text, a few hundred bytes
   each, and the point of them is to be read beside subindex 3, the compiled
   form the engine actually runs. */
function renderCombatAISheet(which) {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  // The words the combat AI is written in are string lists in the
  // application's resource fork -- the objects, groups, tests, actions and
  // modifiers the .ai files and the compiled scripts both use -- so the
  // Rules tab draws them first, from the fork, and the document after, from
  // the installer, and has the tables even when the installer is not here.
  if (which === 'AIRULES') {
    const app = window.APP_RSRC;
    const lists = [[9300, 'Objects'], [9301, 'Groups'], [9304, 'Tests'], [9305, 'Actions'], [9303, 'Modifiers'],
                   [9307, 'Scenario AI tests'], [9308, 'Scenario AI actions'], [9320, 'Health states'],
                   [9321, 'Object flags'], [502, 'Strategies'], [500, 'Combat buttons']];
    const rows = [];
    for (const [id, what] of lists) {
      const l = forkStringList(app, id);
      if (l && l.length) rows.push('<tr><th>' + svEsc(what) + ' <span class="amNote">STR# ' + id + '</span></th><td>' +
        l.map(svEsc).join(', ') + '</td></tr>');
    }
    const box = document.createElement('div');
    box.style.cssText = 'grid-column:1/-1';
    // Which of the words are the executable's and which are this file's:
    // the Tests and Actions lists are native, and the Scenario lists are
    // Delver scripts, one resource per word, in the order the lists give.
    const tests = [], actions = [];
    for (let i = 0; i < 6; i++) if (refExists(0x901 + i)) tests.push(svChip(0x901 + i));
    for (let i = 0; i < 13; i++) if (refExists(0x981 + i)) actions.push(svChip(0x981 + i));
    const split = (tests.length || actions.length)
      ? '<div class="changesNote" style="margin-left:0">To use a script in the game, open a companion’s character window, then its Strategy tab, the pop-up menu at the bottom left, Edit User Strategies…, and Import. ' +
        'It goes into one of 31 user slots, 176 to 206. The same dialog’s Debug button marks a slot, and a companion using a marked slot opens the game’s AI debugger every time it evaluates the strategy.</div>' +
        '<div class="changesNote" style="margin-left:0">The Tests list and the two Actions lists come from the program. The Scenario lists are scripts in this file' +
        (tests.length ? ': the tests ' + tests.join(' ') : '') + (actions.length ? (tests.length ? ', the actions ' : ': the actions ') + actions.join(' ') : '') +
        '. Calling CastSpell with a spell the character does not know casts nothing, and Debug(#) only prints its number.</div>'
      : '';
    box.innerHTML = '<div class="propHead">The Vocabulary' +
      (rows.length ? '' : (app ? '; none of the lists is in this resource fork' :
        (window.APP_RSRC_STATE === 'loading' ? ', loading the program…' :
         ', ' + (window.APP_RSRC_STATE || 'the program’s fork is not open')))) + '</div>' +
      (rows.length ? '<div class="tableScroll"><table class="vocabTable">' + rows.join('') + '</table></div>' : '') + split;
    grid.appendChild(box);
  }
  const arc = window.INSTALLER ? window.INSTALLER.archive : null;
  const want = which === 'AIRULES'
    ? e => /AI Scripting Document/i.test(e.name)
    : e => /\.ai$/i.test(e.name);
  const files = arc ? arc.entries.filter(e => e.type === 'TEXT' && want(e)) : [];
  for (const e of files) {
    const pre = document.createElement('pre');
    pre.className = 'installerText';
    let text;
    try { text = installerTextOf(e); } catch (err) { text = 'The page could not read it: ' + err.message; }
    pre.textContent = e.name + '\n' + '─'.repeat(Math.min(e.name.length, 60)) + '\n' + text.replace(/\r\n?/g, '\n');
    grid.appendChild(pre);
  }
  out.textContent = files.length
    ? (which === 'AIRULES'
        ? 'The words of the script language, from the program’s resource fork, followed by the AI Scripting Document from the installer’s CombatAI folder, which sets out the rules for writing .ai scripts.'
        : files.length + ' Combat AI scripts from the installer’s CombatAI folder. The compiled versions the game runs are subindex 3, under Components › Functions › Actions.')
    : (which === 'AIRULES' && !arc)
      ? 'The words of the script language, from the program’s resource fork. The AI Scripting Document comes with the game as a separate file.' + NO_INSTALLER_HINT
      : 'The installer has no ' + (which === 'AIRULES' ? 'AI Scripting Document' : '.ai scripts') + ' in it.';
}

/* ---- Data > Cythera Data > Changes --------------------------------------
   What was edited this session, and the ways it leaves the page, grouped by
   where the file is going rather than by format. Edits live in memory only
   (see applyResourceEdit); this is the one place they are listed.

   The typed patch leads on a phone because it is the only route that works
   there unassisted -- no picker, no drag, no disk -- and it was offered only
   while every edit kept its resource the same length, the rule of the
   byte-run patch writer that a Magpie patch replaced (deleted 25 September
   2026). On a computer the file routes lead. The
   missing-resource-fork warning the exports already raise is printed here
   under the file routes, since a disk without the fork installs perfectly and
   then will not open. */
function renderChangesSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'changesView';
  const edited = Array.from(window.EDITED_RESIDS || []).sort((a, b) => a - b);
  const head = document.createElement('div');
  head.className = 'changesHead';
  if (!edited.length) {
    head.textContent = 'Nothing changed yet.';
    const p = document.createElement('div');
    p.className = 'changesNote';
    p.style.margin = '0';
    p.textContent = 'Edits you make anywhere on the site, with Edit bytes on a resource or Edit on a ' +
      'map square, appear here to download. Reloading the page loses them.';
    box.appendChild(head);
    box.appendChild(p);
    grid.appendChild(box);
    out.textContent = 'No edits this session.';
    return;
  }
  head.textContent = edited.length + ' resource' + (edited.length === 1 ? '' : 's') +
    ' changed this session · in memory only';
  box.appendChild(head);
  let before = null;
  try {
    before = new Map(delverArchiveSpec(window.PRISTINE_BYTES).resources.map(x => [x.resid, x.data.length]));
  } catch (e) { quiet(e); }
  for (const resid of edited) {
    const row = document.createElement('div');
    row.className = 'changesRow';
    const b = document.createElement('button');
    b.className = 'navChip';
    b.textContent = '0x' + resid.toString(16).toUpperCase();
    b.onclick = () => jumpToResource(resid);
    row.appendChild(b);
    const raw = getResourceBytes(ARCHIVE, resid);
    const was = before && before.has(resid) ? before.get(resid) : null;
    const lbl = labelFor(resid);
    const t = document.createElement('span');
    t.textContent = (lbl ? lbl + ' · ' : '') +
      (!raw ? 'removed'
       : was === null ? raw.length + ' bytes'
       : was === raw.length ? raw.length + ' bytes, same length'
       : was + ' bytes, now ' + raw.length);
    row.appendChild(t);
    box.appendChild(row);
  }
  const groups = [
    { title: 'to an emulator', routes: [
        { label: 'Download the disk image', fn: () => downloadEditedDiskImage(),
          note: '.dsk, which mounts in an emulated Mac and includes an installer; infinitemac.org accepts it by drag and drop' },
        { label: 'Download the zip', fn: () => downloadEditedForkZip(),
          note: '.zip, with both forks in the layout Basilisk II and infinitemac.org unpack, about half the size of the disk image' } ] },
    { title: 'to a real Mac, or another tool', routes: [
        { label: 'Download as MacBinary', fn: () => downloadEditedMacBinary(),
          note: '.bin, with both forks and the file’s Finder type and creator; an emulator would need StuffIt Expander to open it' },
        { label: 'Download the data fork', fn: () => downloadEditedArchive(),
          note: '.data, the data fork alone; delvmod and this page can read it, but the game also needs the resource fork' } ] }
  ];
  for (const g of groups) {
    const sec = document.createElement('div');
    sec.className = 'changesGroup';
    const tt = document.createElement('div');
    tt.className = 'changesGroupTitle';
    tt.textContent = g.title;
    sec.appendChild(tt);
    for (const route of g.routes) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = route.label;
      b.disabled = !!route.off;
      b.onclick = route.fn;
      sec.appendChild(b);
      const n = document.createElement('div');
      n.className = 'changesNote';
      n.textContent = route.note;
      sec.appendChild(n);
    }
    box.appendChild(sec);
  }
  const warn = missingForkWarning(window.CYTHERA_RSRC_RAW || new Uint8Array(0));
  if (warn) {
    const w = document.createElement('div');
    w.className = 'changesWarn';
    w.textContent = warn;
    box.appendChild(w);
  }
  grid.appendChild(box);
  out.textContent = edited.length + ' edited resource' + (edited.length === 1 ? '' : 's') +
    '; every download below writes the rebuilt file shown on screen.';
}

/* ---- Records: the tables the scenario is built from -----------------------
   A figure on a Scenario page is read out of a table, and a table is a
   component of the scenario in the same way a sprite sheet or a script is:
   the thing that holds the fact, where the fork is the file that holds the
   bytes. So the tables have a leaf of their own under Components and a
   figure's link lands here, on its own record, laid out field by field with
   the byte it came from ringed. The Data Fork is one more step down and
   every record links to it.

   The maintainer's ask, 20 September 2026: a link out of Scenario should go
   through its component before it reaches the file. Anything read off a
   script already did -- it lands on the script under Functions -- and the
   record tables were the ones jumping straight to the hex.

   The field maps are read where the file or the program says them.
   0xF008's offsets and field numbers come from GetField's second jump table
   (exeMonsterFields); its names are this page's, and the page says which
   are which. 0xF009's are delvmod's, worked out by diffing saves, with
   nutrition read out of the executable. A prop list's are
   parseDelverPropList's. 0xF000 is one halfword a prop type and needs no
   map. */
function recordTables() {
  const out = [];
  const has = id => { try { return !!getResourceBytes(ARCHIVE, id); } catch (e) { return false; } };
  if (has(0xF008)) out.push({ resid: 0xF008, stride: 16, label: 'Unit statistics',
    note: 'One record per unit: what it is made of, what it does and what it leaves behind.' });
  if (has(0xF009)) out.push({ resid: 0xF009, stride: 32, label: 'Characters',
    note: 'One record per character, and in a saved game the current state of the world.' });
  if (has(0xF000)) out.push({ resid: 0xF000, stride: 2, label: 'Prop tiles',
    note: 'One two-byte value per prop type: the tile its frames begin at.' });
  for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    out.push({ resid: 0x8100 + z, stride: 16, label: 'Prop list, ' + (zoneDisplayName(z) || ('zone ' + z)),
      note: 'Everything placed in this zone, and everything carried or contained in it.', zone: z });
  }
  return out;
}

// The fields of one table, as offsets into a record. `src` is where the
// map itself was read, so a name can be checked rather than believed.
function recordFieldMap(resid) {
  if (resid === 0xF008) {
    const mf = appImage() ? exeMonsterFields() : null;
    // The flags are one long to the program, served as two fields: the top
    // half at 8 and 9 (field 51, `srawi 16`) and the low half at 10 and 11
    // (field 50, `clrlwi 16`). Split where the handlers say so; one row, as
    // the long, where the program is not open to say it.
    const top = mf ? mf.fields.find(x => x.half === 'high') : null, low = mf ? mf.fields.find(x => x.half === 'low') : null;
    const split = !!(top && low);
    const named = { 0: 'Body', 1: 'Reflex', 2: 'Mind', 3: 'Armor', 4: 'Damage', 5: 'Health',
                    6: 'Alignment', 8: split ? 'Special flags, top half' : 'Special flags', 10: 'Special flags', 12: 'Prop type', 14: 'Corpse' };
    const width = split ? { 8: 2, 10: 2, 12: 2, 14: 2 } : { 8: 4, 12: 2, 14: 2 };
    const rows = [];
    for (const off of split ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 14]) {
      const f = split && off === 8 ? top : split && off === 10 ? low : mf ? mf.fields.find(x => x.offset && x.offset.v === off) : null;
      rows.push({ off, width: width[off] || 1, name: named[off] || null,
                  field: f ? f.field : null, at: f ? f.at : null,
                  note: off === 7 ? 'no field reads it' : null });
    }
    return rows;
  }
  if (resid === 0xF009) return [
    { off: 0, width: 1, name: 'Zone' }, { off: 1, width: 3, name: 'Level, x and y, packed' },
    { off: 4, width: 2, name: 'Aspect and prop type' }, { off: 6, width: 2, name: null },
    { off: 8, width: 1, name: 'State' }, { off: 9, width: 1, name: 'Body' },
    { off: 10, width: 1, name: 'Reflex' }, { off: 11, width: 1, name: 'Mind' },
    { off: 12, width: 2, name: 'Experience' }, { off: 14, width: 1, name: 'Health' },
    { off: 15, width: 1, name: 'Health at full' }, { off: 16, width: 1, name: 'Magic' },
    { off: 17, width: 1, name: 'Magic at full' }, { off: 18, width: 1, name: 'Party' },
    { off: 19, width: 1, name: 'Level' }, { off: 20, width: 2, name: 'A second appearance word' },
    { off: 22, width: 5, name: null }, { off: 27, width: 1, name: 'Nutrition' },
    { off: 28, width: 1, name: 'Training' }, { off: 29, width: 3, name: null }];
  if (resid >= 0x8100 && resid < 0x8200) return [
    { off: 0, width: 1, name: 'Flags' }, { off: 1, width: 3, name: 'x and y, or what holds it' },
    { off: 4, width: 2, name: 'Aspect and prop type' }, { off: 6, width: 1, name: 'Data1' },
    { off: 7, width: 1, name: 'Data2' }, { off: 8, width: 2, name: 'Store reference' },
    { off: 10, width: 6, name: null }];
  if (resid === 0xF000) return [{ off: 0, width: 2, name: 'Base tile' }];
  return [];
}

window.RECORD_AT = null;   // { resid, byte } -- which byte a jump asked for
function renderRecordsSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const tables = recordTables();
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  let shown = 0;
  for (const t of tables) {
    if (q && !t.label.toLowerCase().includes(q) && !('0x' + t.resid.toString(16)).includes(q)) continue;
    shown++;
    let len = 0;
    try { len = (getResourceBytes(ARCHIVE, t.resid) || []).length; } catch (e) { len = 0; }
    const cell = document.createElement('div');
    cell.className = 'cell propCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    const icon = document.createElement('div');
    icon.style.cssText = 'font-size:1.375rem;color:#cfc4a0';
    icon.textContent = Math.floor(len / t.stride) + '';
    wrap.appendChild(icon);
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = t.label;
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    sub.textContent = propWordHex(t.resid) + ' · ' + t.stride + ' bytes a record';
    cell.appendChild(sub);
    cell.onclick = () => showRecordDetail(t.resid, 0);
    grid.appendChild(cell);
  }
  out.textContent = shown + ' of the tables that make up the scenario' +
    (q ? ' matching “' + q + '”' : '') +
    '. A figure on a Scenario page opens its record here, and every record links on to its bytes in the file.';
}

/* One record, field by field, with the byte a jump asked for ringed. The
   chips at the head are the two directions: up to the thing the record
   describes, down to the same bytes in the Data Fork. */
function showRecordDetail(resid, byte) {
  stopSpriteAnimations();
  markDetailView('record', resid + ':' + byte);
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const t = recordTables().find(x => x.resid === resid);
  let d = null;
  try { d = smartDecrypt(getResourceBytes(ARCHIVE, resid), resid).data; } catch (e) { quiet(e); }
  if (!t || !d) { out.textContent = 'No table ' + propWordHex(resid) + ' in this file.'; return; }
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All records';
  back.onclick = () => { window.RECORD_AT = null; renderRecordsSheet(); };
  grid.appendChild(back);

  const n = Math.floor(d.length / t.stride);
  const idx = Math.max(0, Math.min(n - 1, Math.floor(byte / t.stride)));
  const start = idx * t.stride;
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:560px;margin:12px auto;text-align:left';

  let h = '<div style="font-size:1.25rem;color:#fff">' + svEsc(t.label) + '</div>' +
    '<div style="font-size:0.75rem;color:#b5b2a8;margin-bottom:10px">record ' + idx + ' of ' + n +
    ' · ' + propWordHex(resid) + ' · ' + t.stride + ' bytes a record</div>' +
    '<div class="sv-note" style="margin-top:0">' + svEsc(t.note) + '</div>';
  panel.innerHTML = h;

  // Up to what the record describes, and down to the bytes in the fork.
  const ways = [];
  if (resid === 0xF008) {
    const m = parseMonsterStats()[idx];
    if (m && !m.blank) ways.push(relChip({ js: 'openUnit(' + idx + ')', main: propDisplayName(m.proptype) || ('prop type ' + m.proptype),
      sub: 'the unit this describes', icon: relIconURL({ icon: m.proptype }), title: tabTrail(TAB_LEAF_FOR.get('MONSTERS')) }));
  } else if (resid === 0xF009) {
    ways.push(relChip({ js: 'openCharacter(' + idx + ')', main: characterName(idx),
      sub: 'the character this describes', title: tabTrail(TAB_LEAF_FOR.get('CHARACTERS')) }));
  } else if (resid === 0xF000) {
    ways.push(relChip({ js: 'openPropType(' + idx + ')', main: propDisplayName(idx) || ('prop type ' + idx),
      sub: 'the prop type this describes', icon: relIconURL({ icon: idx }), title: tabTrail(TAB_LEAF_FOR.get('PROPS')) }));
  } else if (t.zone !== undefined) {
    ways.push(relChip({ resid: 0x8000 + t.zone, main: zoneDisplayName(t.zone) || ('zone ' + t.zone),
      sub: 'the map these stand on', title: trailForResid(0x8000 + t.zone) }));
  }
  ways.push(relChip({ js: 'jumpToForkBytes(' + resid + ',' + start + ',' + t.stride + ')',
    main: 'The bytes in the fork', sub: propWordHex(resid) + ' at ' + start,
    title: tabTrail(TAB_LEAF_FOR.get('DATAFORK')) }));
  const strip = document.createElement('div');
  strip.innerHTML = linksFold(partsStrip('Leads to', ways));
  panel.appendChild(strip);

  // The record itself.
  const map = recordFieldMap(resid);
  const hex = k => d[start + k] === undefined ? '--' : d[start + k].toString(16).padStart(2, '0');
  const val = (off, w) => { let v = 0; for (let k = 0; k < w; k++) v = (v * 256) + (d[start + off + k] || 0); return v; };
  let rows = '';
  for (const f of map) {
    const bytes = [];
    for (let k = 0; k < f.width; k++) bytes.push(hex(f.off + k));
    const hit = byte >= start + f.off && byte < start + f.off + f.width;
    rows += '<tr' + (hit ? ' class="listingHit"' : '') + '><td class="num">' + f.off + '</td>' +
      '<td>' + (f.name ? svEsc(f.name) : '<span style="color:#8c8980">unnamed</span>') +
      (f.field !== null && f.field !== undefined ? ' <span style="color:#8c8980;font-size:0.6875rem">field ' +
        (f.at ? srcNum({ exe: f.at }, String(f.field)) : f.field) + '</span>' : '') +
      (f.note ? ' <span style="color:#8c8980;font-size:0.6875rem">' + svEsc(f.note) + '</span>' : '') + '</td>' +
      '<td class="num">' + val(f.off, f.width) + '</td>' +
      '<td class="num" style="font-family:ui-monospace,Menlo,monospace">' +
      srcNum({ resid, byte: start + f.off, stride: t.stride, what: f.name || ('byte ' + f.off) }, bytes.join(' ')) + '</td></tr>';
  }
  const tbl = document.createElement('div');
  tbl.innerHTML = '<table class="mechTable" style="margin-top:12px"><thead><tr><th class="num">byte</th><th>field</th><th class="num">value</th><th class="num">hex</th></tr></thead><tbody>' + rows + '</tbody></table>';
  panel.appendChild(tbl);

  // Step to the record either side, so a table can be walked.
  const nav = document.createElement('div');
  nav.style.cssText = 'display:flex;gap:8px;margin-top:12px;flex-wrap:wrap';
  const step = (to, label) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = label;
    b.onclick = () => showRecordDetail(resid, to * t.stride);
    b.disabled = to < 0 || to >= n;
    nav.appendChild(b);
  };
  step(idx - 1, 'Previous record');
  step(idx + 1, 'Next record');
  panel.appendChild(nav);

  grid.appendChild(panel);
  out.textContent = t.label + ', record ' + idx + ' of ' + n;
}
