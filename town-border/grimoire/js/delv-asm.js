/* ===========================================================================
   delv-asm.js -- writing Delver VM code: the other half of dvmDisassemble.

   Started 24 September 2026 at the maintainer's word, so that a script can be
   changed on the page rather than assembled elsewhere and pasted in as hex.
   The page was already the patch generator (Edit Bytes, the comparison
   section's export through writeDelverPatch); what it lacked was a way to
   author a script resource's new bytes, which the fixes to Aethon's "Ask
   About" and Paris's and Diomede's names need, because they add code.

   Three pieces, each held to the archive by utilities/asm_check.mjs:

   dvmOffsetSites(b, resid)
     Every place in a script resource that holds an offset into that same
     resource. Branch targets, a conditional's `then`, a switch's cases, a
     call_subroutine, a conversation response's resume point, and the near
     words all count from the resource's start (dvmConversation's header
     says the same); so do the header's table offset, the object table's
     entries, and a pointer word -- a `word` operand, an array or table
     entry, a far word, or a word inside a data block -- whose resource id
     is this one. Survey of the shipped file, 24 September 2026: 40
     call_subroutines, 4 near words, 173 data blocks of which 109 carry such
     pointers.

   dvmRelink(b, resid, at, removeLen, insert, opts)
     Splices `insert` in at `at` in place of `removeLen` bytes and moves every
     site that points past the splice by the difference. A site that points
     exactly at `at` stays there -- a jump to the statement new code is put in
     front of runs the new code -- unless opts.shiftAt, which is for padding
     put in front of a whole object. A site that points into the bytes taken
     out is an error. The result is checked by finding the sites again in it
     and comparing them with where they should have gone; an edit that does
     not come out exact is refused rather than written.

   dvmAssemble(text, resid)
     One instruction per line, in the raw listing's own words: a line copied
     out of the listing -- its offset, its indent and a `// note` included --
     assembles to the bytes it was read from, which is the round trip the
     check runs over every instruction of every function in the archive.
     Symbolic names are delvmod's (DVM_SYM) or, for a syscall, the program's
     (dvmSyscallShown). New code may use local labels, `name:` on a line of
     its own and `-> name` or `branch name` as a target; a numeric target is
     an offset in the resource as it stood before the edit, and moves with
     everything else. `data` takes its bytes as hex, since the listing does
     not print them.

   The tier's rule holds: bytes in, bytes out, no DOM. The editor on the
   script page is in js/page-views.js.
   =========================================================================== */

// Is a 32-bit word a pointer into resource `resid`, and to where.
function dvmSelfRef(v, resid) {
  v = v >>> 0;
  return (v & 0x80000000) && ((v & 0x7FFF0000) >>> 16) === resid ? (v & 0xFFFF) : null;
}

// The sites inside a serialized array (0x9n) or table (0xAn) starting at `p`,
// and, when `all`, inside whatever follows it up to `end`: a data block is a
// small object graph laid end to end -- containers and NUL-terminated strings,
// the containers pointing at the strings and at one another (0x1802's block
// at 0x0F4C is an array of three, then three one-element arrays each followed
// by the string it points at, "Mind", "Body", "Reflex").
function dvmContainerSites(b, p, end, resid, out, kind, all) {
  while (p + 2 <= end) {
    const tag = b[p] & 0xF0;
    if (tag !== 0x90 && tag !== 0xA0) {
      if (!all) return;
      while (p < end && b[p] !== 0) p++;
      p++;
      continue;
    }
    const n = u16be(b, p) & 0x0FFF, stride = tag === 0xA0 ? 6 : 4;
    let q = p + 2;
    for (let i = 0; i < n && q + 4 <= end; i++, q += stride) {
      const o = dvmSelfRef(u32be(b, q), resid);
      if (o !== null) out.push({ at: q, size: 4, value: o, kind });
    }
    if (!all) return;
    p = p + 2 + n * stride;
  }
}

/* `extra`, when given, takes two things the walk sees on the way, so a caller
   that wants them does not disassemble the resource a second time (the text
   edits of js/delv-datapatch.js, which want every `data` block, whose size
   word a change of length inside it must correct, and every keyword list,
   which a spelling must leave alone): extra.blocks gets { a, size } for each
   `data` instruction, and extra.keys [start, end) for each
   conversation_response, its words and its target. */
function dvmOffsetSites(b, resid, extra) {
  const out = [];
  const { tableOffset, kinds } = dvmDiscover(b, resid);
  if (tableOffset === null) return out;
  const head = b[0];
  if (head !== 0x81 && (head & 0xF0) !== 0x90 && (head & 0xF0) !== 0xA0 && b.length >= 2)
    out.push({ at: 0, size: 2, value: u16be(b, 0), kind: 'header' });
  if (tableOffset < b.length) {
    // The object table: six-byte entries, a word then a key.
    const n = u16be(b, tableOffset) & 0x0FFF;
    for (let i = 0, q = tableOffset + 2; i < n && q + 6 <= b.length; i++, q += 6) {
      const o = dvmSelfRef(u32be(b, q), resid);
      if (o !== null) out.push({ at: q, size: 4, value: o, kind: 'table' });
    }
  }
  for (const [st, en, kind] of dvmExtents(b, resid)) {
    if (kind === 'array' || kind === 'table') { dvmContainerSites(b, st, en, resid, out, kind); continue; }
    if (kind !== 'function') continue;
    let r;
    try { r = dvmDisassemble(b.subarray(st, en), 3); } catch (e) { continue; }
    for (let i = 0; i < r.ops.length; i++) {
      const op = r.ops[i], a = st + op[0], mn = op[2];
      if (extra && mn === 'data') extra.blocks.push({ a, size: u16be(b, a + 1) });
      if (extra && mn === 'conversation_response') extra.keys.push([a, i + 1 < r.ops.length ? st + r.ops[i + 1][0] : en]);
      if (mn === 'then' || mn === 'branch' || mn === 'call_subroutine' || mn === 'load_near_word' || mn === 'write_near_word') {
        if (a + 3 <= b.length) out.push({ at: a + 1, size: 2, value: u16be(b, a + 1), kind: mn });
      } else if (mn === 'cases') {
        const n = u16be(b, a + 1);
        for (let i = 0; i < n; i++) out.push({ at: a + 3 + 2 * i, size: 2, value: u16be(b, a + 3 + 2 * i), kind: 'case' });
      } else if (mn === 'conversation_response') {
        let z = a + 1; while (z < b.length && b[z] !== 0) z++;
        if (z + 3 <= b.length) out.push({ at: z + 1, size: 2, value: u16be(b, z + 1), kind: 'response' });
      } else if (mn === 'word' || mn === 'load_far_word' || mn === 'write_far_word') {
        const o = dvmSelfRef(u32be(b, a + 1), resid);
        if (o !== null) out.push({ at: a + 1, size: 4, value: o, kind: mn });
      } else if (mn === 'data') {
        const sz = u16be(b, a + 1);
        dvmContainerSites(b, a + 3, Math.min(a + 3 + sz, b.length), resid, out, 'data', true);
      }
    }
  }
  return out;
}

function dvmWriteSite(b, s, value) {
  if (s.size === 2) { b[s.at] = (value >> 8) & 0xFF; b[s.at + 1] = value & 0xFF; }
  else { b[s.at + 2] = (value >> 8) & 0xFF; b[s.at + 3] = value & 0xFF; }
}

/* insert: { bytes, sites } from dvmAssemble, or plain bytes. Returns
   { bytes, moved } or throws with the reason. */
function dvmRelink(b, resid, at, removeLen, insert, opts) {
  opts = opts || {};
  const ins = insert instanceof Uint8Array || Array.isArray(insert) ? { bytes: Uint8Array.from(insert), sites: [] } : insert;
  const delta = ins.bytes.length - removeLen;
  const cutEnd = at + removeLen;
  const mapPos = p => p < at ? p : p >= cutEnd ? p + delta : null;
  const mapVal = v => {
    if (v < at || (v === at && !opts.shiftAt)) return v;
    if (v > at && v < cutEnd) return null;
    return v + delta;
  };
  const sites = dvmOffsetSites(b, resid);
  const out = new Uint8Array(b.length + delta);
  out.set(b.subarray(0, at), 0);
  out.set(ins.bytes, at);
  out.set(b.subarray(cutEnd), at + ins.bytes.length);
  const expect = new Map();
  let moved = 0;
  for (const s of sites) {
    const p = mapPos(s.at);
    if (p === null) continue;            // the site itself was cut out
    const v = mapVal(s.value);
    if (v === null) throw new Error('0x' + s.value.toString(16).toUpperCase() + ', which a ' + s.kind + ' at 0x' + s.at.toString(16).toUpperCase() + ' points at, is in the bytes taken out');
    if (v > 0xFFFF) throw new Error('the resource would pass 64 KB, past what an offset can hold');
    if (v !== s.value) { dvmWriteSite(out, { at: p, size: s.size }, v); moved++; }
    expect.set(p, v);
  }
  // The new code's own targets: a numeric one is an old offset and moves
  // like any other; a label is already where it is going.
  for (const s of ins.sites || []) {
    const v = s.label ? at + s.value : mapVal(s.value);
    if (v === null) throw new Error('new code points at 0x' + s.value.toString(16).toUpperCase() + ', in the bytes taken out');
    dvmWriteSite(out, { at: at + s.at, size: s.size }, v);
    expect.set(at + s.at, v);
  }
  // Found again in the result, every site must be where it was sent.
  const again = dvmOffsetSites(out, resid);
  const bad = again.filter(s => expect.has(s.at) ? expect.get(s.at) !== s.value : false);
  const lost = [...expect.keys()].filter(p => !again.some(s => s.at === p));
  if (bad.length || lost.length)
    throw new Error('the relinked resource does not read back: ' + bad.length + ' offsets wrong, ' + lost.length + ' no longer found');
  return { bytes: out, moved, delta };
}

// ---- the encoder ----------------------------------------------------------

let _dvmAsmMaps = null;
function dvmAsmMaps() {
  if (_dvmAsmMaps) return _dvmAsmMaps;
  const op = {};
  for (const [k, e] of Object.entries(DVM_OPS)) op[e[0]] = +k;
  const rev = t => { const m = {}; for (const [k, v] of Object.entries(DVM_SYM[t] || {})) m[v] = +k; return m; };
  return (_dvmAsmMaps = { op, syscall: rev('syscall'), method: rev('method'), field: rev('field'), global: rev('global'),
                          gui: rev('gui'), objtype: rev('objtype'), resource: rev('resource'), character: rev('character') });
}

// A number the listing prints as hex, decimal or negative.
function dvmAsmNum(s) {
  s = String(s).trim();
  if (/^-?0x[0-9a-f]+$/i.test(s)) return s[0] === '-' ? -parseInt(s.slice(1), 16) : parseInt(s, 16);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  return null;
}
// "Name (0x2A)", "0x2A" or "Name" against a symbol table.
function dvmAsmSym(s, table) {
  const m = /\((0x[0-9a-f]+)\)\s*$/i.exec(s);
  if (m) return parseInt(m[1], 16);
  const n = dvmAsmNum(s);
  if (n !== null) return n;
  const t = dvmAsmMaps()[table];
  if (t && t[s.trim()] !== undefined) return t[s.trim()];
  throw new Error('no ' + table + ' named ' + s.trim());
}
// A resource id as the listing prints one: "PickLock (0xE43)", "0x0E43".
function dvmAsmResource(s) {
  const m = /\((0x[0-9a-f]+)\)\s*$/i.exec(s);
  if (m) return parseInt(m[1], 16);
  const n = dvmAsmNum(s);
  if (n !== null) return n;
  const r = dvmAsmMaps().resource[s.trim()];
  if (r !== undefined) return r;
  throw new Error('no resource named ' + s.trim());
}
// dvmWord in reverse.
function dvmAsmWord(s, resid) {
  s = s.trim();
  if (s === 'False') return 0x50000000;
  if (s === 'True') return 0x50000001;
  if (s === 'None') return 0x5000FFFF;
  if (s === 'Empty') return 0x5000FFFE;
  let m;
  if ((m = /^&Var(\d+)$/.exec(s))) return (0x10000000 | (parseInt(m[1], 10) + 1)) >>> 0;
  if ((m = /^here:(0x[0-9a-f]+)$/i.exec(s))) return (0x80000000 | (resid << 16) | parseInt(m[1], 16)) >>> 0;
  if ((m = /^(.*):(0x[0-9a-f]{4})$/i.exec(s))) return (0x80000000 | (dvmAsmResource(m[1]) << 16) | parseInt(m[2], 16)) >>> 0;
  if ((m = /^(.*)\[(\d+)\]$/.exec(s))) return (0x30000000 | (parseInt(m[2], 10) << 16) | dvmAsmResource(m[1])) >>> 0;
  if ((m = /^Character\.(.+)$/.exec(s))) {
    const w = m[1], n = dvmAsmNum(w);
    const idx = n !== null ? n : dvmAsmMaps().character[w];
    if (idx === undefined) throw new Error('no character named ' + w);
    return (0x40000000 | (0x40 << 16) | idx) >>> 0;
  }
  if ((m = /^(0x[0-9a-f]+)@(.+)$/i.exec(s))) {
    const cls = /^Type\.(.+)$/.exec(m[2]) ? dvmAsmMaps().objtype[/^Type\.(.+)$/.exec(m[2])[1]] : parseInt(m[2], 16);
    return (0x40000000 | ((cls & 0xFF) << 16) | parseInt(m[1], 16)) >>> 0;
  }
  if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16) >>> 0;
  const n = dvmAsmNum(s);
  if (n !== null && n >= -0x08000000 && n <= 0x07FFFFFF) return (n & 0x0FFFFFFF) >>> 0;
  throw new Error('not a word: ' + s);
}
const dvmAsmU16 = v => [(v >> 8) & 0xFF, v & 0xFF];
const dvmAsmU32 = v => [(v >>> 24) & 0xFF, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF];

/* Assembles `text` for resource `resid`. Returns { bytes, sites, labels },
   where a site is a two-byte target inside the new bytes, { at, size: 2,
   value, label }: `value` an old offset, or with `label` a position in the
   new bytes. */
function dvmAssemble(text, resid) {
  const maps = dvmAsmMaps();
  const bytes = [], sites = [], labels = {}, pending = [];
  const target = (s, where) => {
    s = s.trim();
    const n = dvmAsmNum(s);
    if (n !== null) sites.push({ at: where, size: 2, value: n });
    else { pending.push({ at: where, name: s }); }
    bytes.push(0, 0);
  };
  const lines = String(text).split('\n');
  for (let li = 0; li < lines.length; li++) {
    // A line copied from the listing: drop the gutter offset and the note.
    let line = lines[li].replace(/^\s*[0-9A-F]{4}\s+/, '').replace(/\s+\/\/.*$/, '').trim();
    if (!line || line[0] === ';' || line === '{' || line === '}') continue;
    try {
      let m;
      if ((m = /^([A-Za-z_]\w*):$/.exec(line))) { labels[m[1]] = bytes.length; continue; }
      if ((m = /^local Var([0-9A-F]+)$/i.exec(line))) { bytes.push(parseInt(m[1], 16)); continue; }
      if ((m = /^arg Arg([0-9A-F]+)$/i.exec(line))) { bytes.push(0x30 + parseInt(m[1], 16)); continue; }
      if (line === 'end') { bytes.push(0x40); continue; }
      if ((m = /^then -> (.+)$/.exec(line))) { bytes.push(0x40); target(m[1], bytes.length); continue; }
      if ((m = /^cases \( (.*) \)$/.exec(line))) {
        const cs = m[1].split(',').map(x => x.trim()).filter(Boolean);
        bytes.push(0x40, ...dvmAsmU16(cs.length));
        for (const c of cs) target(c, bytes.length);
        continue;
      }
      if ((m = /^string\(implicit\) (".*")$/.exec(line))) {
        const s = JSON.parse(m[1]);
        for (const ch of s) { const c = ch.charCodeAt(0); if (c >= 0x80) throw new Error('an implicit string is plain ASCII'); bytes.push(c); }
        continue;
      }
      if ((m = /^sys (.+)$/.exec(line))) {
        const w = m[1].trim(), n = dvmAsmNum(w);
        let code = n !== null ? n : maps.syscall[w];
        if (code === undefined) {
          // The program's name (dvmSyscallShown), with or without its "cb".
          for (const [k, v] of Object.entries(DVM_SYM.syscall || {}))
            if (dvmSyscallShown(v) === w || 'cb' + dvmSyscallShown(v) === w) { code = +k; break; }
        }
        if (code === undefined || code < 0xA0) throw new Error('no syscall named ' + w);
        bytes.push(code); continue;
      }
      if ((m = /^data (.*)$/.exec(line))) {
        const hex = m[1].replace(/^<.*>$/, '').replace(/\s+/g, '');
        if (!/^([0-9a-f]{2})+$/i.test(hex)) throw new Error('data takes its bytes as hex');
        const d = hex.match(/../g).map(x => parseInt(x, 16));
        bytes.push(0x45, ...dvmAsmU16(d.length), ...d); continue;
      }
      if ((m = /^branch (.+)$/.exec(line))) { bytes.push(0x88); target(m[1], bytes.length); continue; }
      if ((m = /^call_subroutine (.+)$/.exec(line))) { bytes.push(0x9E); target(m[1], bytes.length); continue; }
      if ((m = /^(load_near_word|write_near_word) (.+)$/.exec(line))) { bytes.push(maps.op[m[1]]); target(m[2], bytes.length); continue; }
      if ((m = /^conversation_response (".*") -> (.+)$/.exec(line))) {
        bytes.push(0x90, ...encodeMacRoman(JSON.parse(m[1])), 0); target(m[2], bytes.length); continue;
      }
      if ((m = /^conversation_prompt (".*")$/.exec(line)) || (m = /^string (".*")$/.exec(line))) {
        bytes.push(line.startsWith('string') ? 0x44 : 0x8F, ...encodeMacRoman(JSON.parse(m[1])), 0); continue;
      }
      m = /^([a-z_]+)(?: (.*))?$/.exec(line);
      if (!m || maps.op[m[1]] === undefined) throw new Error('no instruction ' + line.split(' ')[0]);
      const mn = m[1], arg = m[2] === undefined ? '' : m[2], code = maps.op[mn], spec = DVM_OPS[code][1];
      bytes.push(code);
      if (!spec) { if (arg) throw new Error(mn + ' takes no operand'); continue; }
      if (spec === 1) {
        const table = (mn === 'get_field' || mn === 'set_field') ? 'field' : (mn === 'method' || mn === 'has_member') ? 'method'
          : (mn === 'global' || mn === 'set_global') ? 'global' : mn === 'gui' ? 'gui' : (mn === 'cast' || mn === 'is_type') ? 'objtype' : null;
        const v = table ? dvmAsmSym(arg, table) : dvmAsmNum(arg);
        if (v === null || v < -128 || v > 0xFF) throw new Error(mn + ' takes a byte');
        bytes.push(v & 0xFF); continue;
      }
      if (spec === 2) {
        const v = mn === 'call_resource' ? dvmAsmResource(arg) : dvmAsmNum(arg);
        if (v === null || v < -0x8000 || v > 0xFFFF) throw new Error(mn + ' takes a halfword');
        bytes.push(...dvmAsmU16(v & 0xFFFF)); continue;
      }
      if (spec === 4) { bytes.push(...dvmAsmU32(mn === 'word' ? dvmAsmWord(arg, resid) : (dvmAsmNum(arg) >>> 0))); continue; }
      throw new Error(mn + ' is not one this assembler writes');
    } catch (e) {
      throw new Error('line ' + (li + 1) + ': ' + e.message);
    }
  }
  for (const p of pending) {
    if (labels[p.name] === undefined) throw new Error('no label ' + p.name);
    sites.push({ at: p.at, size: 2, value: labels[p.name], label: true });
  }
  return { bytes: Uint8Array.from(bytes), sites, labels };
}

/* A class written from its methods, for a script the file does not have yet:
   the gremlin maker's (26 September 2026). The layout is the one shipped
   class in the gremlins' range has, 0x1E20's: a word pointing at the table,
   the functions from offset 2, then the table.

   THE TABLE IS A HASH TABLE, read by `TInterp::At`, and that is the whole
   reason this is not a list. The low twelve bits of its first halfword are
   its size; a key's first slot is the key mod the size; and a probe moves on
   by the first of k*3+1, (k*3+1)*3+1, ... (the low sixteen bits) that is not
   0 mod the size, until a slot holds the key or None. A table of one slot
   never yields a step, and the first gremlin written by hand had one: the
   game froze on the lookup, before any of its code ran. The size here is the
   smallest prime above the number of methods and at least 3, as 0x1E20's
   is, so a slot stays empty and a probe from any key visits every slot: a
   lookup for a method the class lacks ends at None, and the engine runs its
   default instead.

   `methods` is [{ key, text }], each text a listing dvmAssemble takes. A
   label is counted from the method's own first byte and moved here to where
   the method lands, since the engine counts a target from the resource's. */
function dvmWriteClass(resid, methods) {
  const fns = [];
  let where = 2;
  for (const m of methods) {
    let a;
    try { a = dvmAssemble(m.text, resid); }
    catch (e) { throw new Error((DVM_SYM.method[m.key] || 'method ' + m.key) + ', ' + e.message); }
    const b = Array.from(a.bytes);
    for (const site of a.sites) {
      const v = site.label ? site.value + where : site.value;
      b[site.at] = (v >> 8) & 0xFF; b[site.at + 1] = v & 0xFF;
    }
    fns.push({ key: m.key, at: where, bytes: b });
    where += b.length;
  }
  const prime = n => { for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return n >= 2; };
  let size = Math.max(3, fns.length + 1);
  while (!prime(size)) size++;
  const table = new Array(size).fill(null);
  for (const f of fns) {
    if (table.some(t => t && t.key === f.key)) throw new Error('two methods are both ' + (DVM_SYM.method[f.key] || f.key));
    let v = f.key * 3 + 1;
    while ((v & 0xFFFF) % size === 0) v = v * 3 + 1;
    const step = (v & 0xFFFF) % size;
    let slot = f.key % size;
    while (table[slot]) slot = (slot + step) % size;
    table[slot] = f;
  }
  const out = [(where >> 8) & 0xFF, where & 0xFF];
  for (const f of fns) out.push(...f.bytes);
  out.push(0xA0 | (size >> 8), size & 0xFF);
  for (const f of table) {
    const v = f ? (0x80000000 | ((resid & 0x7FFF) << 16) | f.at) >>> 0 : 0x5000FFFF;
    out.push(v >>> 24, (v >>> 16) & 0xFF, (v >>> 8) & 0xFF, v & 0xFF, f ? (f.key >> 8) & 0xFF : 0, f ? f.key & 0xFF : 0);
  }
  return { bytes: Uint8Array.from(out), size, methods: fns.map(f => ({ key: f.key, at: f.at, length: f.bytes.length })) };
}
