/* delv-apppatch.js -- the fixes of js/delv-appfixes.js, applied to the program.

   applyAppFixes({ data, rsrc }, fixes) -> { data, rsrc, applied, grownBy, caveAt }

   `data` and `rsrc` are the application's two forks; `fixes` is a list of
   entries from APP_FIXES (any subset, in any order). The answer is the two
   forks patched, and for each fix what it changed. Anything that does not
   match what a fix expects throws, naming the fix and the place, and
   nothing is returned: a patch applied in part is a program nobody has
   read.

   WHAT IT DOES, in order:

   1. Holds the data fork to APP_FIXES_TARGET: a PEF container whose code
      section begins and ends where 1.0.4's does and whose data section
      follows it at once. That is the layout step 4 grows; a program laid
      out otherwise is refused rather than grown by a rule written for
      another.
   2. Places the caves. Every chosen fix's cave, one after another, from
      the end of the code section, each label at its word. A branch in a
      site to `@cave` or a label reaches its own fix's cave, never
      another's.
   3. Writes each site's words, after checking every word the site
      replaces is the word the fix says is there now. Two fixes that change
      one word are refused together.
   4. Grows the code section by the caves' length rounded up to 16 (the
      sections' alignment) and moves everything after it by that much: the
      data section's container offset in the section header, the code
      section's three sizes, and, since the second fragment in the fork
      moves too, the offsets and lengths `cfrg 0` gives each fragment in
      the data fork. The loader's relocations, imports, exports and entry
      point are all relative to their sections and do not move. The
      traceback tables between routines would have held the code instead,
      at the price of the names every tool here reads from them; nothing
      at run time reads them, but the tools do.
   5. Rewrites the text: each `data` edit where the string sits, written in
      place at its own length or shorter, the rest NUL. Cythera's strings
      are in the code section, after the routines, where CodeWarrior put
      its constant data, so they neither move nor pass through the data
      section's packing; one in the data section's packed stream would be
      stored literally too, and the check holds the unpacked section to
      exactly the letters changed either way.
   6. Rewrites the resources: a string in a STR#, or a whole resource, and
      the cfrg of step 4, through writeResourceFork.

   C STRINGS, AND ONE THAT GROWS (29 September 2026, for the program in
   another language). A fix's `cstrings` are text in the code section, where
   CodeWarrior pooled the program's constant strings: each gives the code
   address, the bytes it expects there up to the NUL (`was`), the bytes that
   replace them (`now`), and, where the program points into the middle of
   the string as well (the compiler shares a string's tail with another
   that ends the same), the offsets of those points in each (`inner`,
   `nowInner`). One no longer than it was, with its inner points where they
   were, is written in place and NUL-filled. One that grows is placed after
   the caves, NUL-terminated, and every load of a pointer to it is sent
   there: each string the program uses has its own word in the TOC, set by
   the loader to the string's address and loaded by `lwz rD, d(r2)`, so
   that one instruction becomes a branch to four new ones, the same `lwz`,
   `addis` and `addi` adding the distance from the old string to the new
   (both in the code section, so the distance is the same wherever the
   loader puts it), and a branch back. The TOC, which the loader's
   relocations fill and which sits in the data section's packed stream, is
   not touched. Refused: a string that is not what the fix expects, one
   that grows while some word of the data section points at it or into it
   and no instruction loads that word (a table of pointers, which only an
   edit of the packed stream could change). A load into r0, which `addis`
   and `addi` would read as 0, adds the distance with `addic` instead, in
   steps of at most 32767; it sets the carry, which nothing compiled keeps
   across a load of a pointer.

   A string marked `pascal` is a length byte and its text, with no NUL,
   often run straight into the next string: `at` is the length byte and
   `was` and `now` the text. In place it is its new length and text, and
   the bytes after the new text are left as they were, since they may be
   the start of the next string; moved, it is the length and the text, and
   the loads are sent to the length byte.

   Nothing here knows which fixes exist: that is js/delv-appfixes.js. The
   assembler is js/mac-ppc-asm.js; the reader of what comes out,
   js/mac-pef.js and js/mac-ppc.js. */

function appPatchError(fix, why) { return new Error((fix ? fix.id + ': ' : '') + why); }

// Every routine's code address by its mangled name, a name two routines
// share left out so that `@name` can never mean the wrong one.
function appRoutineAddresses(pef, data) {
  const byName = new Map(), twice = new Set();
  for (const r of pefTracebacks(pef, data)) {
    if (byName.has(r.mangled)) twice.add(r.mangled);
    byName.set(r.mangled, r.offset);
  }
  for (const n of twice) byName.delete(n);
  return byName;
}

// The strings of a STR#, and the resource written back from them.
function appStrList(bytes) {
  const n = (bytes[0] << 8) | bytes[1], out = [];
  let p = 2;
  for (let i = 0; i < n; i++) { const len = bytes[p]; out.push(bytes.slice(p + 1, p + 1 + len)); p += 1 + len; }
  return out;
}
function appStrListBytes(list) {
  const total = 2 + list.reduce((s, b) => s + 1 + b.length, 0);
  const out = new Uint8Array(total);
  out[0] = list.length >> 8; out[1] = list.length & 0xFF;
  let p = 2;
  for (const b of list) { if (b.length > 255) throw new Error('a string of ' + b.length + ' bytes will not fit a STR#'); out[p] = b.length; out.set(b, p + 1); p += 1 + b.length; }
  return out;
}
function appFindBytes(hay, needle) {
  const at = [];
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    at.push(i);
  }
  return at;
}

/* The program's pooled strings: every word of the data section that the
   loader points into the code section at a string, read as a C string to
   its NUL or, where the byte pointed at is a length that many bytes of text
   follow, as a Pascal string; with the places another pointer reaches
   inside it, and whether an instruction loads any pointer to it (one only a
   table reaches can change in place alone). For a translation of the
   program, which reads its English here and writes its `cstrings`. */
function appPooledStrings(data) {
  const img = pefLoad(data);
  if (!img || !img.toc) return [];
  const pef = img.pef, codeIx = pef.sections.findIndex(s => s.kind === 0), code = img.contents[codeIx].bytes;
  const tocSec = img.toc.section, tocOff = img.toc.offset, dsec = img.contents[tocSec].bytes;
  const pointers = new Map(), loaded = new Set();
  for (const [off, t] of img.relocs.bySection.get(tocSec) || []) if (t.section === codeIx) {
    const to = pefU32(dsec, off); (pointers.get(to) || pointers.set(to, []).get(to)).push(off);
  }
  for (let a = 0; a + 4 <= code.length; a += 4) {
    const w = pefU32(code, a);
    if ((w >>> 26) === 32 && ((w >>> 16) & 31) === 2) loaded.add(tocOff + ((w << 16) >> 16));
  }
  const text = s => s.length >= 1 && [...s].every(c => c === 9 || c === 10 || c === 13 || (c >= 0x20 && c < 0x7F) || c >= 0x80);
  const out = [];
  for (const at of [...pointers.keys()].sort((x, y) => x - y)) {
    const L = code[at], ps = code.subarray(at + 1, at + 1 + L);
    let pascal = false, bytes, end;
    if (L >= 1 && L < 0x20 && text(ps) && /[A-Za-z]/.test(String.fromCharCode(...ps))) { pascal = true; bytes = ps; end = at + 1 + L; }
    else { let e = at; while (e < code.length && code[e]) e++; bytes = code.subarray(at, e); end = e; if (!bytes.length || !text(bytes)) continue; }
    const inner = [];
    if (!pascal) for (let k = at + 1; k < end; k++) if (pointers.has(k)) inner.push(k - at);
    out.push({ at, pascal, bytes: Uint8Array.from(bytes), inner, loaded: pointers.get(at).some(o => loaded.has(o)) });
  }
  return out;
}

function applyAppFixes(app, fixes, opts) {
  opts = opts || {};
  const T = opts.target || APP_FIXES_TARGET;
  const data = app && app.data, rsrc = app && app.rsrc;
  if (!data) throw appPatchError(null, 'no data fork: the fixes are to the PowerPC program, which is in the data fork');
  const pef = parsePEF(data);
  if (!pef) throw appPatchError(null, 'the data fork is not a PEF container');
  const code = pef.sections.find(s => s.kind === 0);
  const after = pef.sections.filter(s => s.kind !== 0 && s.containerOffset >= (code ? code.containerOffset : 0) && s.packedSize > 0);
  if (!code || code.containerOffset !== T.codeOffset || code.totalSize !== T.codeSize || code.packedSize !== T.codeSize)
    throw appPatchError(null, 'this is not ' + T.name + ': its code section is not the one the fixes came from' +
      (code && code.totalSize !== T.codeSize ? ' (it is ' + code.totalSize + ' bytes, and a patched copy is larger)' : ''));
  const codeEnd = code.containerOffset + code.totalSize;
  if (codeEnd !== T.dataOffset || !after.some(s => s.containerOffset === codeEnd))
    throw appPatchError(null, 'the data section does not follow the code section, so the code cannot be grown in place');

  const ids = new Set();
  for (const f of fixes) { if (ids.has(f.id)) throw appPatchError(f, 'chosen twice'); ids.add(f.id); }
  const routines = appRoutineAddresses(pef, data);
  const word = a => pefU32(data, code.containerOffset + a);

  // 2. The caves, laid out and labelled.
  let caveAt = code.totalSize;
  const plan = fixes.map(f => {
    const labels = new Map(), lines = [];
    const start = caveAt;
    let a = start;
    for (const raw of f.cave || []) {
      const t = String(raw).replace(/;.*$/, '').trim();
      if (!t) continue;
      const m = /^([A-Za-z_][\w]*):$/.exec(t);
      if (m) { if (labels.has(m[1])) throw appPatchError(f, 'the label ' + m[1] + ' twice'); labels.set(m[1], a); continue; }
      lines.push({ at: a, text: raw }); a += 4;
    }
    if (lines.length) labels.set('cave', start);
    caveAt = a;
    return { fix: f, labels, lines, start, end: a };
  });
  // 2b. C strings: which are written in place, and for those that grow,
  // a trampoline for every load of a pointer to them and the bytes after.
  const codeWord = a => pefU32(data, code.containerOffset + a);
  const stringPlan = [], r0Steps = 3;
  if (fixes.some(f => (f.cstrings || []).length)) {
    const img = pefLoad(data);
    if (!img || !img.toc) throw appPatchError(null, 'the program has no TOC to find its strings\' pointers by');
    const tocSec = img.toc.section, tocOff = img.toc.offset, dsec = img.contents[tocSec].bytes;
    const pointers = new Map(), loads = new Map();
    for (const [off, t] of img.relocs.bySection.get(tocSec) || []) if (t.section === code.index) {
      const to = pefU32(dsec, off); (pointers.get(to) || pointers.set(to, []).get(to)).push(off);
    }
    for (let a = 0; a + 4 <= code.totalSize; a += 4) {
      const w = codeWord(a);
      if ((w >>> 26) === 32 && ((w >>> 16) & 31) === 2) { const o = tocOff + ((w << 16) >> 16); (loads.get(o) || loads.set(o, []).get(o)).push(a); }
    }
    for (const p of plan) for (const c of p.fix.cstrings || []) {
      const f = p.fix, was = Uint8Array.from(c.was), now = Uint8Array.from(c.now);
      const inner = c.inner || [], nowInner = c.nowInner || [];
      if (inner.length !== nowInner.length) throw appPatchError(f, 'the string at 0x' + c.at.toString(16) + ' has pointers into it at ' + inner.length + ' places and its replacement at ' + nowInner.length);
      const base = code.containerOffset + c.at + (c.pascal ? 1 : 0);
      if (c.pascal && (data[code.containerOffset + c.at] !== was.length || now.length > 255))
        throw appPatchError(f, 'the Pascal string at 0x' + c.at.toString(16).toUpperCase() + ' is not ' + was.length + ' bytes, or its replacement is longer than 255');
      for (let i = 0; i < was.length; i++) if (data[base + i] !== was[i])
        throw appPatchError(f, 'the string at 0x' + c.at.toString(16).toUpperCase() + ' is not the one expected: not ' + T.name + ', or changed already');
      if (!c.pascal && data[base + was.length] !== 0) throw appPatchError(f, 'the string at 0x' + c.at.toString(16).toUpperCase() + ' is longer than the one expected');
      if (c.pascal && inner.length) throw appPatchError(f, 'the Pascal string at 0x' + c.at.toString(16).toUpperCase() + ' has pointers into it');
      const fits = now.length <= was.length && inner.every((o, k) => o === nowInner[k]);
      if (fits) { stringPlan.push({ fix: f, c, was, now, place: 'in' }); continue; }
      const points = [0].concat(inner.map(o => o + (c.pascal ? 1 : 0))).map((o, k) => ({ from: c.at + o, to: k ? nowInner[k - 1] : 0 }));
      const sites = [];
      for (const pt of points) {
        const words = pointers.get(pt.from) || [];
        if (!words.length) throw appPatchError(f, 'nothing points at 0x' + pt.from.toString(16).toUpperCase() + ', so the patch cannot move the string there');
        for (const o of words) {
          const ls = loads.get(o) || [];
          if (!ls.length) throw appPatchError(f, 'a word of the data section points at the string at 0x' + pt.from.toString(16).toUpperCase() + ' and no instruction loads it, so it would keep the old string');
          for (const at of ls) {
            sites.push({ at, to: pt.to, from: pt.from });
          }
        }
      }
      stringPlan.push({ fix: f, c, was, now, place: 'moved', sites });
    }
    // Trampolines first, four words a load; then the strings, each on a word.
    // A load into r0 takes `addic` in steps of up to 32767, since addis and
    // addi read r0 as 0; the distance is bounded by the strings laid after.
    for (const sp of stringPlan) if (sp.place === 'moved') for (const st of sp.sites) {
      st.r0 = ((codeWord(st.at) >>> 21) & 31) === 0;
      st.tramp = caveAt; caveAt += st.r0 ? 4 * (2 + r0Steps) : 16;
    }
    for (const sp of stringPlan) if (sp.place === 'moved') { sp.newAt = caveAt; caveAt += (sp.now.length + 2 + 3) & ~3; }
  }
  const caveBytes = caveAt - code.totalSize;
  const grow = Math.ceil(caveBytes / 16) * 16;

  const resolverFor = p => name => {
    if (p.labels.has(name)) return p.labels.get(name);
    if (routines.has(name)) return routines.get(name);
    return undefined;
  };
  const written = new Map();          // code address -> the fix that wrote it
  const newCode = new Uint8Array(code.totalSize + grow);
  newCode.set(data.subarray(code.containerOffset, codeEnd));
  const put = (a, w) => { newCode[a] = w >>> 24; newCode[a + 1] = (w >>> 16) & 0xFF; newCode[a + 2] = (w >>> 8) & 0xFF; newCode[a + 3] = w & 0xFF; };
  const applied = [];

  // 3. The sites, checked and written; then the caves.
  for (const p of plan) {
    const f = p.fix, resolve = resolverFor(p), words = [];
    for (const s of f.sites || []) {
      if (!Array.isArray(s.was) || !Array.isArray(s.asm) || s.was.length !== s.asm.length)
        throw appPatchError(f, 'the site at 0x' + s.at.toString(16) + ' gives ' + (s.was || []).length + ' words and ' + (s.asm || []).length + ' lines');
      if (s.at < 0 || s.at + 4 * s.was.length > code.totalSize || (s.at & 3)) throw appPatchError(f, 'the site at 0x' + s.at.toString(16) + ' is not in the code');
      s.was.forEach((w, i) => {
        const a = s.at + 4 * i, now = word(a);
        if (now !== (w >>> 0)) throw appPatchError(f, 'expected ' + w.toString(16).toUpperCase().padStart(8, '0') + ' at 0x' + a.toString(16).toUpperCase() +
          ', found ' + now.toString(16).toUpperCase().padStart(8, '0') + ': not ' + T.name + ', or patched already');
        if (written.has(a)) throw appPatchError(f, 'changes the word at 0x' + a.toString(16).toUpperCase() + ', which ' + written.get(a) + ' changes too');
        written.set(a, f.id);
        let nw;
        try { nw = ppcAssemble(s.asm[i], a, resolve); } catch (e) { throw appPatchError(f, e.message); }
        put(a, nw);
        words.push({ at: a, was: now, now: nw, text: s.asm[i] });
      });
    }
    for (const l of p.lines) {
      let nw;
      try { nw = ppcAssemble(l.text, l.at, resolve); } catch (e) { throw appPatchError(f, e.message); }
      put(l.at, nw);
      words.push({ at: l.at, was: null, now: nw, text: l.text });
    }
    applied.push({ id: f.id, words, caveAt: p.lines.length ? p.start : null, caveWords: p.lines.length });
  }

  // 3b. The strings: in place, or moved and their loads sent after them.
  for (const sp of stringPlan) {
    const f = sp.fix, rec = applied.find(x => x.id === f.id), words = rec.words;
    if (sp.place === 'in' && sp.c.pascal) {
      newCode[sp.c.at] = sp.now.length; newCode.set(sp.now, sp.c.at + 1);
    } else if (sp.place === 'in') {
      for (let i = 0; i < sp.was.length; i++) newCode[sp.c.at + i] = i < sp.now.length ? sp.now[i] : 0;
    } else {
      if (sp.c.pascal) { newCode[sp.newAt] = sp.now.length; newCode.set(sp.now, sp.newAt + 1); newCode[sp.newAt + 1 + sp.now.length] = 0; }
      else { newCode.set(sp.now, sp.newAt); newCode[sp.newAt + sp.now.length] = 0; }
      for (const st of sp.sites) {
        if (written.has(st.at)) throw appPatchError(f, 'changes the word at 0x' + st.at.toString(16).toUpperCase() + ', which ' + written.get(st.at) + ' changes too');
        written.set(st.at, f.id);
        const lw = codeWord(st.at), rd = (lw >>> 21) & 31, delta = (sp.newAt + st.to) - st.from;
        let lines;
        if (st.r0) {
          const steps = [];
          for (let left = delta; left; ) { const k = Math.max(-32768, Math.min(32767, left)); steps.push(k); left -= k; }
          if (steps.length > r0Steps) throw appPatchError(f, 'the string for the load into r0 at 0x' + st.at.toString(16).toUpperCase() + ' is too far off');
          while (steps.length < r0Steps) steps.push(0);
          lines = [[st.tramp, lw]].concat(steps.map((k, i) => [st.tramp + 4 + 4 * i, null, 'addic 0, 0, ' + k]), [[st.tramp + 4 + 4 * r0Steps, null, 'b @0x' + (st.at + 4).toString(16)]]);
        } else {
          const ha = (delta + 0x8000) >> 16, lo = delta - (ha << 16);
          lines = [[st.tramp, lw], [st.tramp + 4, null, 'addis ' + rd + ', ' + rd + ', ' + ha], [st.tramp + 8, null, 'addi ' + rd + ', ' + rd + ', ' + lo], [st.tramp + 12, null, 'b @0x' + (st.at + 4).toString(16)]];
        }
        for (const [a, w, text] of lines) {
          let nw = w;
          if (nw === null) { try { nw = ppcAssemble(text, a, () => undefined); } catch (e) { throw appPatchError(f, e.message); } }
          put(a, nw); words.push({ at: a, was: null, now: nw, text: text || 'the load, as it was' });
        }
        let bw;
        try { bw = ppcAssemble('b @0x' + st.tramp.toString(16), st.at, () => undefined); } catch (e) { throw appPatchError(f, e.message); }
        put(st.at, bw); words.push({ at: st.at, was: lw, now: bw, text: 'b to the string moved' });
      }
    }
    (rec.strings = rec.strings || []).push({ at: sp.c.at, place: sp.place, newAt: sp.newAt, loads: sp.sites ? sp.sites.length : 0 });
  }

  // 4. The data fork, grown.
  const out = new Uint8Array(data.length + grow);
  out.set(data.subarray(0, code.containerOffset));
  out.set(newCode, code.containerOffset);
  out.set(data.subarray(codeEnd), codeEnd + grow);
  const w32 = (b, o, v) => { b[o] = v >>> 24; b[o + 1] = (v >>> 16) & 0xFF; b[o + 2] = (v >>> 8) & 0xFF; b[o + 3] = v & 0xFF; };
  for (const s of pef.sections) {
    const h = 40 + s.index * 28;
    if (s === code) { w32(out, h + 8, s.totalSize + grow); w32(out, h + 12, s.unpackedSize + grow); w32(out, h + 16, s.packedSize + grow); }
    else if (s.containerOffset >= codeEnd && (s.packedSize > 0 || s.totalSize > 0)) w32(out, h + 20, s.containerOffset + grow);
  }
  const moved = o => (o >= codeEnd ? o + grow : o);

  // 5. The text in the data fork.
  for (const f of fixes) for (const d of f.data || []) {
    const was = encodeMacRoman(d.was), now = encodeMacRoman(d.now);
    if (now.length > was.length) throw appPatchError(f, '"' + d.now + '" is longer than "' + d.was + '", and a string in the data section cannot grow');
    for (let i = 0; i < was.length; i++)
      if (data[d.at + i] !== was[i]) throw appPatchError(f, 'expected "' + d.was + '" at 0x' + d.at.toString(16).toUpperCase() + ' of the data fork');
    const at = moved(d.at);
    for (let i = 0; i < was.length; i++) out[at + i] = i < now.length ? now[i] : 0;
    const a = applied.find(x => x.id === f.id);
    (a.text = a.text || []).push({ at: d.at, was: d.was, now: d.now });
  }

  // 6. The resources, and the cfrg that says where the fragments are.
  let rsrcOut = rsrc || null;
  const rsrcEdits = fixes.filter(f => (f.rsrc || []).length);
  if (rsrc && (grow || rsrcEdits.length)) {
    const fork = openResourceFork(rsrc), spec = resourceForkSpec(fork);
    const find = (f, type, id) => {
      const r = spec.resources.find(r => r.type === type && r.id === id);
      if (!r) throw appPatchError(f, 'no ' + type + ' ' + id + ' in the resource fork');
      return r;
    };
    const touched = new Map();
    for (const f of rsrcEdits) for (const e of f.rsrc) {
      const r = find(f, e.type, e.id), key = e.type + ' ' + e.id + (e.index ? ' #' + e.index : '');
      if (touched.has(key)) throw appPatchError(f, 'changes ' + key + ', which ' + touched.get(key) + ' changes too');
      touched.set(key, f.id);
      if (e.type === 'STR#' && e.index) {
        const list = appStrList(r.data);
        const s = list[e.index - 1];
        if (!s) throw appPatchError(f, 'STR# ' + e.id + ' has no string ' + e.index);
        const at = appFindBytes(s, encodeMacRoman(e.was));
        if (at.length !== 1) throw appPatchError(f, '"' + e.was + '" is in STR# ' + e.id + ' #' + e.index + ' ' + at.length + ' times, not once');
        const was = encodeMacRoman(e.was), now = encodeMacRoman(e.now);
        const next = new Uint8Array(s.length - was.length + now.length);
        next.set(s.subarray(0, at[0])); next.set(now, at[0]); next.set(s.subarray(at[0] + was.length), at[0] + now.length);
        list[e.index - 1] = next;
        r.data = appStrListBytes(list);
      } else {
        const was = Uint8Array.from(e.was);
        if (r.data.length !== was.length || was.some((b, i) => r.data[i] !== b))
          throw appPatchError(f, e.type + ' ' + e.id + ' is not what the fix expects');
        r.data = Uint8Array.from(e.now);
      }
      const a = applied.find(x => x.id === f.id);
      (a.resources = a.resources || []).push(key);
    }
    if (grow) {
      const r = spec.resources.find(r => r.type === 'cfrg' && r.id === 0);
      if (!r) throw appPatchError(null, 'no cfrg 0, so nothing says where the program is in the data fork');
      const c = Uint8Array.from(r.data), count = pefU32(c, 0x1C);
      let p = 0x20;
      for (let i = 0; i < count; i++) {
        const where = c[p + 0x17], off = pefU32(c, p + 0x18), len = pefU32(c, p + 0x1C), size = pefU16(c, p + 0x28);
        if (where === 1) {                                         // in the data fork
          if (off >= codeEnd) w32(c, p + 0x18, off + grow);
          else if (len === 0 || off + len > codeEnd) { if (len) w32(c, p + 0x1C, len + grow); }
        }
        if (size < 0x2B) throw appPatchError(null, 'cfrg 0 member ' + i + ' is ' + size + ' bytes');
        p += size;
      }
      r.data = c;
    }
    rsrcOut = writeResourceFork(spec);
    openResourceFork(rsrcOut);                                     // it must read back
  } else if (grow && !rsrc) throw appPatchError(null, 'no resource fork, so the patch cannot move its cfrg with the code');

  return { data: out, rsrc: rsrcOut, applied, grownBy: grow, caveAt: code.totalSize, caveBytes };
}
