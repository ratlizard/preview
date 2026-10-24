/* delv-app68k.js -- the 68K half of the program's fixes, applied.

   applyApp68kFixes(spec, ids) -> [{ id, inPlace, caves, values, data0 }]

   `spec` is resourceForkSpec of the application's resource fork, changed in
   place: its CODE resources and DATA 0 are rewritten and nothing else; the
   caller writes the fork back (writeResourceFork). `ids` are the chosen
   fixes' names; a fix with no entry in APP_FIXES_68K (js/delv-appfixes68k.js)
   changes nothing here. Anything that is not what a fix expects throws,
   naming the fix, and the spec is left as it was.

   WHY A SECOND HALF. Cythera's application is fat: the PowerPC program is the
   data fork, a PEF container (js/delv-apppatch.js patches it), and the 68K
   program is CODE 0 to 8 of the resource fork, with its globals' initial
   values compressed in DATA 0. A Mac with a 68K processor, the fork's default
   route and the browser player run the second, so a fix reaches them only
   through it. The fixes were read again in the 68K code, one by one, and are
   played in the fork; the workbench's tools/app68k/ has them, and
   js/delv-appfixes68k.js is written from its tables.

   WHAT IT DOES, in the order the workbench's build68k.py does it, so that
   the bytes come out the same:
   1. The in-place edits: each site's bytes checked, then written. Two fixes
      that change one byte are rejected together.
   2. The relocated values: a long the loader relocates, given another value
      (it is checked to hold the old one). CODE 0's long at 0, the size of the
      A5 world above A5, is grown instead to the largest any chosen fix needs:
      hood-size and menu-items each move something to the world's end, at
      places that do not overlap, so either may be chosen alone.
   3. DATA 0's bytes, checked and written.
   4. The caves, in the order of js/delv-appfixes68k.js. A cave goes
      at CODE 1's end rounded up to four (CODE 1's relocations are kept in
      DATA 0, so nothing follows its code), or, in any other segment, where
      its relocation table begins: the table moves up by the cave's length
      and the segment's header (the long at 8) records where it now is. The
      table's entries count from the segment's start and all lie below the
      table, so none of them moves. The site becomes `bra.l` to the cave,
      then `nop`s. A cave never has a long the loader relocates: it reaches
      the jump table as `jsr d16(a5)` and CODE 1 through a relocated long of
      its segment read PC-relative (the `pcrel` part), so moving a
      segment's table needs no new entry in it.

   The parts of a cave: 'hex' bytes; ':name' a label; 'bXX name' a short
   branch, XX its opcode byte (60 bra, 66 bne, 67 beq, 6c bge, 6d blt...), to
   a label; 'bra.l 0x..' and 'bsr.l 0x..' a 32-bit branch to an offset in the
   segment; 'pcrel 0x.. k' a long holding that offset less its place plus
   k (the operand of a `move.l #d,d0` that a `move.l (0,pc,d0.l)` six bytes
   on reads from). These are the forms the caves use and no more; the 68K
   instructions themselves are bytes, with capstone's reading beside them in
   the data file. */

function app68kError(id, why) { return new Error((id ? id + ': ' : '') + why); }

function app68kHex(s) {
  const h = String(s).replace(/\s+/g, '');
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(2 * i, 2), 16);
  return out;
}

// A cave's parts laid out at `at` of its segment: two passes, as the
// workbench's _asm, every short branch two bytes.
function app68kAssemble(parts, at, id) {
  const kind = p => p[0] === ':' ? 'label' : /^b[0-9a-f]{2} /.test(p) ? 'short' : /^bs?r?a?\.l /.test(p) ? 'long'
    : /^pcrel /.test(p) ? 'pcrel' : 'bytes';
  const labels = new Map();
  let pos = at;
  for (const p of parts) {
    const k = kind(p);
    if (k === 'label') labels.set(p.slice(1), pos);
    else pos += k === 'bytes' ? app68kHex(p).length : k === 'long' ? 6 : k === 'pcrel' ? 4 : 2;
  }
  const out = [];
  const long = v => { out.push((v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF); };
  pos = at;
  for (const p of parts) {
    const k = kind(p);
    if (k === 'label') continue;
    if (k === 'bytes') { const b = app68kHex(p); out.push(...b); pos += b.length; }
    else if (k === 'long') {
      const [op, to] = p.split(/\s+/);
      out.push(0x60 | (op === 'bsr.l' ? 1 : 0), 0xFF); long((parseInt(to, 16) - (pos + 2)) | 0); pos += 6;
    } else if (k === 'pcrel') {
      const [, to, plus] = p.split(/\s+/);
      long((parseInt(to, 16) - (pos + Number(plus))) | 0); pos += 4;
    } else {
      const [op, name] = p.split(/\s+/);
      if (!labels.has(name)) throw app68kError(id, 'no label ' + name + ' in a cave');
      const d = labels.get(name) - (pos + 2);
      if (d < -128 || d > 127 || d === 0) throw app68kError(id, 'a short branch to ' + name + ' cannot reach it');
      out.push(parseInt(op.slice(1), 16), d & 0xFF); pos += 2;
    }
  }
  return Uint8Array.from(out);
}

// Whether a fix has a 68K part at all.
function app68kNames(id) {
  const T = APP_FIXES_68K;
  return T.inPlace.some(e => e.fix === id) || T.values.some(e => e.fix === id) || T.data0.some(e => e.fix === id) || T.caves.some(c => c.fixes.includes(id));
}

function applyApp68kFixes(spec, ids) {
  const chosen = new Set(ids), T = APP_FIXES_68K;
  const res = (type, id) => spec.resources.find(r => r.type === type && r.id === id);
  // Work on copies: nothing is written into the spec until every fix has
  // been checked and placed.
  const seg = new Map(), segOf = n => {
    if (!seg.has(n)) { const r = res('CODE', n); if (!r) throw app68kError(null, 'no CODE ' + n + ' in the resource fork: this is not a 68K program'); seg.set(n, Uint8Array.from(r.data)); }
    return seg.get(n);
  };
  const d0r = res('DATA', 0);
  let data0 = null;
  const report = new Map(), rep = id => report.get(id) || report.set(id, { id, inPlace: [], caves: [], values: [], data0: [] }).get(id);
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const w32 = (b, o, v) => { b[o] = (v >>> 24) & 0xFF; b[o + 1] = (v >>> 16) & 0xFF; b[o + 2] = (v >>> 8) & 0xFF; b[o + 3] = v & 0xFF; };
  const same = (b, o, expected) => expected.every((x, i) => b[o + i] === x);
  const owner = new Map();
  const claim = (id, n, at, len) => {
    for (let i = 0; i < len; i++) {
      const k = n + ':' + (at + i);
      if (owner.has(k) && owner.get(k) !== id) throw app68kError(id, 'changes byte 0x' + (at + i).toString(16).toUpperCase() + ' of CODE ' + n + ', which ' + owner.get(k) + ' changes too');
      owner.set(k, id);
    }
  };

  // 1. In place.
  for (const e of T.inPlace) if (chosen.has(e.fix)) {
    const b = segOf(e.seg), was = app68kHex(e.was), now = app68kHex(e.now);
    if (was.length !== now.length) throw app68kError(e.fix, 'replaces ' + was.length + ' bytes with ' + now.length);
    if (!same(b, e.at, was)) throw app68kError(e.fix, 'CODE ' + e.seg + ' at 0x' + e.at.toString(16).toUpperCase() + ' is not what the fix expects: not the 1.0.4 program, or patched already');
    claim(e.fix, e.seg, e.at, was.length);
    b.set(now, e.at);
    rep(e.fix).inPlace.push({ seg: e.seg, at: e.at, length: now.length });
  }
  // 2. Values.
  let world = null;
  for (const v of T.values) if (chosen.has(v.fix)) {
    const b = segOf(v.seg), cur = u32(b, v.off);
    if (v.seg === 0) {
      if (cur < v.was) throw app68kError(v.fix, 'CODE 0 gives an A5 world of ' + cur + ' bytes, not ' + v.was);
      world = Math.max(world === null ? cur : world, v.now);
    } else {
      if (cur !== v.was) throw app68kError(v.fix, 'the long at 0x' + v.off.toString(16).toUpperCase() + ' of CODE ' + v.seg + ' is not what the fix expects');
      claim(v.fix, v.seg, v.off, 4);
      w32(b, v.off, v.now);
    }
    rep(v.fix).values.push({ seg: v.seg, off: v.off, now: v.now });
  }
  if (world !== null) w32(segOf(0), 0, world);
  // 3. DATA 0.
  for (const e of T.data0) if (chosen.has(e.fix)) {
    if (!d0r) throw app68kError(e.fix, 'no DATA 0 in the resource fork');
    if (!data0) data0 = Uint8Array.from(d0r.data);
    const was = app68kHex(e.was), now = app68kHex(e.now);
    if (!same(data0, e.at, was)) throw app68kError(e.fix, 'DATA 0 at 0x' + e.at.toString(16).toUpperCase() + ' is not what the fix expects');
    claim(e.fix, 'DATA', e.at, was.length);
    data0.set(now, e.at);
    rep(e.fix).data0.push({ at: e.at, length: now.length });
  }
  // 4. Caves.
  const ends = new Map();
  for (const c of T.caves) {
    const these = c.fixes.filter(f => chosen.has(f));
    if (!these.length) continue;
    const key = these.join('+'), parts = c.bodies[key];
    if (!parts) throw app68kError(these[0], 'no cave for ' + key + ' at 0x' + c.site.toString(16));
    let b = segOf(c.seg);
    if (!ends.has(c.seg)) ends.set(c.seg, c.seg === 1 ? (b.length + 3) & ~3 : u32(b, 8));
    const at = ends.get(c.seg), was = app68kHex(c.was);
    if (!same(b, c.site, was)) throw app68kError(these[0], 'CODE ' + c.seg + ' at 0x' + c.site.toString(16).toUpperCase() + ' is not what the fix expects: not the 1.0.4 program, or patched already');
    claim(key, c.seg, c.site, was.length);       // a site two fixes share is theirs together
    const body = app68kAssemble(parts, at, these[0]);
    const site = new Uint8Array(was.length).fill(0x71);
    for (let i = 0; i < site.length; i += 2) site[i] = 0x4E;              // nop
    site[0] = 0x60; site[1] = 0xFF; w32(site, 2, (at - (c.site + 2)) | 0);  // bra.l
    b.set(site, c.site);
    let grown;
    if (c.seg === 1) { grown = new Uint8Array(at + body.length); grown.set(b); grown.set(body, at); }
    else {
      grown = new Uint8Array(b.length + body.length);
      grown.set(b.subarray(0, at)); grown.set(body, at); grown.set(b.subarray(at), at + body.length);
      w32(grown, 8, at + body.length);
    }
    seg.set(c.seg, grown);
    ends.set(c.seg, at + body.length);
    for (const f of these) rep(f).caves.push({ seg: c.seg, site: c.site, at, length: body.length });
  }
  // Every check passed: into the spec.
  for (const [n, b] of seg) res('CODE', n).data = b;
  if (data0) d0r.data = data0;
  return [...report.values()];
}
