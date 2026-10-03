/* delv-translate.js -- Cythera Data in another language.

   translateCytheraData(data, rsrc, T) -> { data, rsrc, log, report }

   `data` and `rsrc` are Cythera Data's two forks as shipped; `T` is a
   translation table (js/delv-es.js is the Spanish one, loaded only when it is
   asked for). The answer is both forks with the text replaced, a line for
   each resource changed, and a report of what the table did and did not
   reach. Begun 29 September 2026 at the maintainer's word, "a full Spanish
   localization option for Cythera, starting with Cythera Data".

   WHY BOTH FORKS. A Magpie patch carries data-fork resources and nothing
   else (GRIMOIRE-NOTES, "A Magpie patch reaches the data fork"), and three
   things a translation needs are in the resource fork: the conversation
   font, `sfnt` 7289 Argos A Nouveau, which has no accented letters; the
   conversation window's buttons, STR# 128 ("Bye", "Name", "Job", "Where
   Is..."); and the text styles, TxSt, which say the message pane is Geneva
   10. So this writes the whole file, and the Patches section hands it out
   as a MacBinary or a disk image, as it does the program with its fixes.

   WHY CONTROL CODES. Script text is seven-bit: a byte of 0x80 up is an
   opcode wherever the interpreter reads text, so "á" cannot be its Mac Roman
   byte. The text drawer passes a control byte to QuickDraw, and QuickDraw's
   TrueType scaler draws it by the font's cmap, so the patched Argos carries
   the accented letters at codes 0x01 to 0x13 (less the tab, the line feed
   and the return). That was proved on Mac OS 8.5 in Infinite Mac on 24 and
   25 September 2026 with the opening of the game; the proof images and
   scripts are beside the other images in cythera-reference
   (`cythera_infinitemac_es-opening*.dsk`, `spanish-opening*-proof.mjs`,
   `mkfont-es3-proof.py`), and GRIMOIRE-NOTES has the account under
   `grimoire/fixable-bugs-1adxav`. What the proofs settled and this keeps:
   a highlighted word ends at its first accent (the application's "@" scan
   takes A to Z and a to z only), so a highlighted word is written without
   one until the program's highlighter is patched; a byte of 0x80 up in a
   keyword list is fatal, not merely unmatched (the list is read by the same
   seven-bit scanner, and every entry after the byte is misread), so no
   keyword carries one; and a typed accent can only be met by a stem cut
   before it.

   WHAT A TABLE IS KEYED BY. Each piece of text by its resource and a hash of
   its English bytes, never by the English itself, so that the table, which
   is public in this repository, holds no text of the game's: the builder
   reads the English out of the visitor's own file, hashes it, and looks the
   hash up. A piece the table does not know is left in English and reported,
   which is also what happens to a release whose text differs from the one
   the table was written against. Two pieces with the same English in one
   resource take one translation; `text['*']` holds what is the same in
   every resource ("Farewell.", "Cancel").

   WHAT A PIECE IS. The runs `dvmTextSites` finds, which is every place a
   script keeps text: a direct run of text in code (delvmod's direct mode,
   dvmImplicitString), a NUL-terminated string operand, a prompt, a string in
   a `data` block or a serialized array, and a string object. A run is cut
   wherever an offset in the resource lands inside it, because the compiler
   shares the tails of strings ("A text run split where a jump lands in it",
   v1.183.0): the jump lands on the tail, so the tail is its own piece, and
   its translation has to read after either head.

   THE SPLICE. Every piece of a resource is replaced at once
   (dataPatchReplaceMany): the resource's offsets are read once, every place
   is spliced, each offset moves by the places before what it points at, a
   `data` block's size word takes the change inside it, and the result is
   read back and compared, as js/delv-datapatch.js does for one text edit.
   One edit at a time through that applier would read every site of a
   resource twice per piece, which for five thousand pieces is most of a
   minute; this is two reads per resource. */

/* ---- where the text is ---------------------------------------------------- */

// Every place a script resource keeps text, and every keyword list.
// text: [{ at, len, text, kind, fn, split }], `text` the bytes as a string
// (every byte below 0x80, since script text is seven-bit, and kept with any
// NUL inside it); keys: [{ at, len, words, fn }].
function dvmTextSites(b, resid) {
  const out = [], keys = [];
  const { tableOffset } = dvmDiscover(b, resid);
  if (tableOffset === null) return { text: out, keys };
  dvmContextResid = resid;
  const targets = new Set();
  for (const s of dvmOffsetSites(b, resid)) targets.add(s.value);
  const push = (at, len, kind, fn) => {
    if (len <= 0) return;
    const cuts = [...targets].filter(t => t > at && t < at + len).sort((x, y) => x - y);
    let from = at;
    for (const t of cuts.concat([at + len])) {
      out.push({ at: from, len: t - from, kind, fn, text: String.fromCharCode.apply(null, b.subarray(from, t)), split: cuts.length > 0 });
      from = t;
    }
  };
  // A data block, or a serialized array with what follows it, is containers
  // and NUL-terminated strings laid end to end (dvmContainerSites); a
  // container's tag is 0x9n or 0xAn, which no text byte can be.
  const blockStrings = (p, end, fn) => {
    while (p < end) {
      const tag = b[p] & 0xF0;
      if ((tag === 0x90 || tag === 0xA0) && p + 2 <= end) {
        const n = u16be(b, p) & 0x0FFF, stride = tag === 0xA0 ? 6 : 4;
        p = p + 2 + n * stride;
        continue;
      }
      let z = p; while (z < end && b[z] !== 0) z++;
      push(p, z - p, 'block', fn);
      p = z + 1;
    }
  };
  for (const [st, en, kind] of dvmExtents(b, resid)) {
    if (kind === 'array' || kind === 'table') { blockStrings(st, en, st); continue; }
    if (kind !== 'function') {
      let z = st; while (z < en && b[z] !== 0) z++;
      push(st, z - st, 'object', st);
      continue;
    }
    let r;
    try { r = dvmDisassemble(b.subarray(st, en), 3); } catch (e) { quiet(e, 'text sites of 0x' + resid.toString(16)); continue; }
    for (const op of r.ops) {
      const a = st + op[0], mn = op[2];
      if (mn === 'string(implicit)') push(a, JSON.parse(op[3]).length, 'implicit', st);
      else if (mn === 'string' || mn === 'conversation_prompt') {
        let z = a + 1; while (z < b.length && b[z] !== 0) z++;
        push(a + 1, z - a - 1, mn === 'string' ? 'operand' : 'prompt', st);
      } else if (mn === 'conversation_response') {
        let z = a + 1; while (z < b.length && b[z] !== 0) z++;
        keys.push({ at: a + 1, len: z - a - 1, words: String.fromCharCode.apply(null, b.subarray(a + 1, z)), fn: st });
      } else if (mn === 'data') blockStrings(a + 3, Math.min(a + 3 + u16be(b, a + 1), b.length), st);
    }
  }
  return { text: out, keys };
}

// A piece worth a translation: two letters in a row. What is left is
// punctuation and spacing ('"*', '  '), which stays as it is.
function translateWants(text) { return /[A-Za-z]{2}/.test(text); }

/* ---- keys ------------------------------------------------------------------ */

// FNV-1a over the bytes, as eight hex digits.
function translateHash(text) {
  let h = 0x811C9DC5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i) & 0xFF; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// A resource's own entry first, then what is the same everywhere.
function translateLookup(T, section, resid, hash) {
  const sec = T[section];
  if (!sec) return undefined;
  const own = sec[resid.toString(16).toUpperCase().padStart(4, '0')];
  if (own && own[hash] !== undefined) return own[hash];
  return sec['*'] ? sec['*'][hash] : undefined;
}

/* ---- the encoding ---------------------------------------------------------- */

// The accented letters at the control codes the patched Argos carries them
// at: the proofs' map, unchanged, since that is the one seen on a screen.
const TRANSLATE_CODES = { 'á': 0x01, 'é': 0x02, 'í': 0x03, 'ó': 0x04, 'ú': 0x05, 'ñ': 0x06, 'ü': 0x07, '¿': 0x08,
  '¡': 0x0B, 'Á': 0x0C, 'É': 0x0E, 'Í': 0x0F, 'Ó': 0x10, 'Ú': 0x11, 'Ñ': 0x12, 'Ü': 0x13 };
// A translation's text as script bytes: seven-bit, the accents at their codes.
function translateEncode(s) {
  let out = '';
  for (const c of s) {
    const v = c.charCodeAt(0);
    if (v < 0x80) out += c;
    else if (TRANSLATE_CODES[c] !== undefined) out += String.fromCharCode(TRANSLATE_CODES[c]);
    else throw new Error('the translation has a character the game cannot draw: ' + JSON.stringify(c) + ' in ' + JSON.stringify(s.slice(0, 60)));
  }
  return out;
}

/* ---- keyword lists --------------------------------------------------------- */

// A keyword list with its translation's stems added after its own. The
// interpreter copies each keyword to the next comma and compares it with the
// start of what was said ("A keyword that needs a space typed first",
// v1.101.0), so a stem is a prefix: "nomb" answers "nombre". The English
// stays, so nothing that answered before stops answering; the stems for a
// word come from the resource's own entry, then from what is the same
// everywhere. `*` (the fallback answer) takes nothing.
function translateKeywordList(words, T, resid) {
  if (words === '*') return null;
  const have = words.split(','), add = [];
  const R = T.keys && T.keys[resid.toString(16).toUpperCase().padStart(4, '0')];
  const G = T.keys && T.keys['*'];
  for (const w of have) {
    const k = w.trim();
    const s = (R && R[k] !== undefined) ? R[k] : (G && G[k] !== undefined ? G[k] : '');
    for (const stem of String(s).split(',')) if (stem && have.indexOf(stem) < 0 && add.indexOf(stem) < 0) add.push(stem);
  }
  if (!add.length) return null;
  // A stem may carry a lower-case accent, as its control code: what a click
  // on a button or a highlighted word says is the script's own text, codes
  // and all, so "d\x04nd" answers a button labelled "Dónde" where "dond"
  // would not. It never carries a byte of 0x80 up, which is fatal in a list.
  const enc = add.map(stem => translateEncode(stem));
  for (const stem of enc) if (!/^[a-z \x01-\x07]+$/.test(stem)) throw new Error('a keyword stem may hold lower-case letters, their accents and spaces only, not ' + JSON.stringify(stem));
  return words + ',' + enc.join(',');
}

/* ---- one script resource --------------------------------------------------- */

// The places a translation changes in one resource, each { at, len, bytes },
// and what it found on the way in `report`.
function translatePlaces(b, resid, T, report) {
  const { text, keys } = dvmTextSites(b, resid);
  const places = [];
  const seen = new Set();
  for (const u of text) {
    // A prompt is never text to translate: mygetch shows the program's own
    // two buttons for "yn" and hands back 'y' or 'n' for the keyword lists
    // after it to match, and any other prompt a button per letter, so the
    // letters are what the script tests (TConversation::mygetch).
    if (u.kind === 'prompt') continue;
    const h = translateHash(u.text);
    // A piece without two letters in a row is punctuation and stays, unless
    // the resource's own entry names it: "Ah, there " + "s" + "he is!" makes
    // "she" of a one-letter piece, which Spanish has to empty.
    const ownEntry = T.text && T.text[resid.toString(16).toUpperCase().padStart(4, '0')];
    if (!translateWants(u.text) && !(ownEntry && ownEntry[h] !== undefined)) continue;
    const es = translateLookup(T, 'text', resid, h);
    if (es === undefined || es === null) { report.missing.push({ resid, at: u.at, hash: h, kind: u.kind, len: u.len }); continue; }
    report.done++;
    seen.add(h);
    // '=' is a piece that is the same in the translation, a name alone
    // ("Pnyx", "Kosha") most often: said, so that it is not reported missing.
    if (es === '=') continue;
    const enc = translateEncode(es);
    // A NUL inside a piece is part of how the script reads it (a zone's name
    // ends with one where it is read as a C string); a translation keeps
    // every one, and at the end if the English ends with one.
    const nuls = t => (t.match(/\0/g) || []).length;
    if (nuls(enc) !== nuls(u.text) || (u.text.endsWith('\0') !== enc.endsWith('\0')))
      throw new Error('0x' + resid.toString(16) + ' ' + h + ': the translation must keep the English NULs where they are');
    if (enc !== u.text) places.push({ at: u.at, len: u.len, bytes: enc });
  }
  const own = T.text && T.text[resid.toString(16).toUpperCase().padStart(4, '0')];
  if (own) for (const h of Object.keys(own)) if (!seen.has(h)) report.unused.push({ resid, hash: h });
  for (const k of keys) {
    const n = translateKeywordList(k.words, T, resid);
    if (n) { places.push({ at: k.at, len: k.len, bytes: n }); report.keys++; }
  }
  return places;
}

/* ---- the splice ------------------------------------------------------------ */

// Every place in one resource at once. dvmRelink's arithmetic, over many
// places: a site past a place moves by the change in length of every place
// that ends at or before what it points at, so a jump to the start of a
// piece stays at the start of its translation; a site pointing inside a
// piece replaced is refused, since there is nowhere in the translation for
// it to go; a `data` block's size word takes the change of every place
// inside it. The resource is read back and every site compared with where
// it should be, and anything that does not come out exact throws.
function dataPatchReplaceMany(s, resid, places, what) {
  const b = s.bytesOf(resid);
  dvmContextResid = resid;
  const asc = places.slice().sort((x, y) => x.at - y.at);
  for (let k = 1; k < asc.length; k++) if (asc[k].at < asc[k - 1].at + asc[k - 1].len) throw new Error(what + ': two places overlap in 0x' + resid.toString(16) + ' at 0x' + asc[k].at.toString(16));
  const extra = { blocks: [], keys: [] };
  const sites = dvmOffsetSites(b, resid, extra);
  let grow = 0;
  for (const p of asc) grow += p.bytes.length - p.len;
  const out = new Uint8Array(b.length + grow);
  let from = 0, to = 0;
  for (const p of asc) {
    out.set(b.subarray(from, p.at), to); to += p.at - from;
    for (let i = 0; i < p.bytes.length; i++) { const v = p.bytes.charCodeAt(i); if (v >= 0x80) throw new Error(what + ': a byte above 0x7F in 0x' + resid.toString(16)); out[to + i] = v; }
    to += p.bytes.length; from = p.at + p.len;
  }
  out.set(b.subarray(from), to);
  // How far a position moves: the change of every place that ends at or before it.
  const ends = asc.map(p => p.at + p.len), deltas = asc.map(p => p.bytes.length - p.len);
  const shift = pos => { let d = 0; for (let k = 0; k < asc.length && ends[k] <= pos; k++) d += deltas[k]; return d; };
  for (const blk of extra.blocks) {
    let d = 0;
    for (let k = 0; k < asc.length; k++) if (asc[k].at >= blk.a + 3 && asc[k].at < blk.a + 3 + blk.size) d += deltas[k];
    if (!d) continue;
    const size = blk.size + d, at = blk.a + shift(blk.a);
    if (size > 0xFFFF) throw new Error(what + ': a data block in 0x' + resid.toString(16) + ' would be ' + size + ' bytes');
    out[at + 1] = (size >> 8) & 0xFF; out[at + 2] = size & 0xFF;
  }
  const inside = v => asc.some(p => v > p.at && v < p.at + p.len);
  const expect = new Map();
  let moved = 0;
  for (const site of sites) {
    if (asc.some(p => site.at >= p.at && site.at < p.at + p.len)) continue;
    if (inside(site.value)) throw new Error(what + ': 0x' + site.value.toString(16) + ', which a ' + site.kind + ' in 0x' + resid.toString(16) + ' points at, is inside text replaced');
    const at = site.at + shift(site.at), v = site.value + shift(site.value);
    if (v !== site.value) { dvmWriteSite(out, { at, size: site.size }, v); moved++; }
    expect.set(at, v);
  }
  const again = dvmOffsetSites(out, resid);
  const bad = again.filter(site => expect.has(site.at) && expect.get(site.at) !== site.value);
  const lost = [...expect.keys()].filter(q => !again.some(site => site.at === q));
  if (bad.length || lost.length) throw new Error(what + ' in 0x' + resid.toString(16) + ': the resource does not read back, ' + bad.length + ' offsets wrong, ' + lost.length + ' no longer found');
  for (let k = asc.length - 1; k >= 0; k--) dataPatchSplice(s, resid, asc[k].at, asc[k].len, asc[k].bytes.length);
  s.plain.set(resid, out);
  s.log.push(what + ': 0x' + resid.toString(16).toUpperCase() + ', ' + asc.length + ' place' + (asc.length === 1 ? '' : 's') + ', ' + (grow >= 0 ? '+' : '') + grow + ' bytes, ' + moved + ' offsets moved');
  return out;
}

/* ---- the name tables ------------------------------------------------------- */

// gCharNames, 0x0201: an array of 256 whose entries are the tag 0x9165 and
// the offset of a NUL-terminated name. The relinker does not follow the tag
// (GRIMOIRE-NOTES, the casts of the hall), so the table is laid out afresh,
// as utilities/hall_lines.mjs does for a cast.
function translateNameTable(b, T, report) {
  const n = u16be(b, 0) & 0x0FFF;
  if (n !== 256 || (b[0] & 0xF0) !== 0x90) throw new Error('the name table is not an array of 256');
  const tags = [], names = [];
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const q = 2 + 4 * i, tag = u16be(b, q), off = u16be(b, q + 2);
    if (tag !== 0x9165) throw new Error('name table entry ' + i + ' has tag 0x' + tag.toString(16) + ', not 0x9165');
    let e = off; while (e < b.length && b[e] !== 0) e++;
    const en = String.fromCharCode.apply(null, b.subarray(off, e));
    let s = en;
    // A name the table does not give stays as it is and is not reported:
    // nearly every name is a person's, and the rules keep those.
    if (translateWants(en)) {
      const es = translateLookup(T, 'names', 0x0201, translateHash(en));
      if (es !== undefined && es !== '=') { s = translateEncode(es); report.done++; if (s !== en) changed++; }
    }
    tags.push(tag); names.push(s);
  }
  if (!changed) return null;
  const head = [b[0], b[1]], strs = [];
  let off = 2 + 4 * n;
  for (let i = 0; i < n; i++) {
    head.push((tags[i] >> 8) & 0xFF, tags[i] & 0xFF, (off >> 8) & 0xFF, off & 0xFF);
    for (const c of names[i]) strs.push(c.charCodeAt(0));
    strs.push(0); off += names[i].length + 1;
  }
  if (off > 0xFFFF) throw new Error('the name table would be ' + off + ' bytes, past what a 16-bit offset reaches');
  return Uint8Array.from(head.concat(strs));
}

// The tile names, 0xF004: { u16 last tile of the run, NUL-terminated name
// code } records in file order, then a 0x7FFF catch-all and zero padding
// (loadTerrainNames). A name code may carry its plural after a backslash,
// "arrow\s", "obol\s/oi" (delverNameCode), and a translation writes its own
// in the same notation. Nothing points into the table, so it is written out
// again with the padding kept.
/* A name's article, where the program is translated too (T.program): the
   program says a thing with one of four formats its tile's attribute word
   chooses (bits 22 and 23 of its word in 0xF002: none, "a", "an", "the"),
   and Spanish needs the noun's gender as well, which the program does not
   know. So the article goes into the name, and the program's four formats
   all become "%s" (the maintainer's choice, 29 September 2026). Each name
   in T.tileGenders (by the hash of its English) is m, f, fa (a feminine
   noun that takes el and un, as hacha), mp or fp (said in the plural
   only); the English class of each of its tiles says which article, none,
   indefinite (a, an) or definite (the). A record names a run of tiles, up
   to its id, and where the tiles of a run differ in class the run is split
   into records, one a stretch of one class, so every tile keeps the
   article English gives it.

   The article is said in the singular only. The program's name code
   (SingPlur) prints text after a slash for one, after a backslash for more
   than one, and a space ends either and is printed in both, so the
   article's space would begin the plural too: it is TRANSLATE_NBSP
   instead, a code the Spanish faces draw as a space, and the name's first
   word is spelt out in both forms, "/una\u0014espada\\espadas". */
const TRANSLATE_NBSP = 0x14;
const TRANSLATE_ARTICLES = { 1: { m: 'un', f: 'una', fa: 'un', mp: 'unos', fp: 'unas' }, 3: { m: 'el', f: 'la', fa: 'el', mp: 'los', fp: 'las' } };
function translateSingPlur(word, singular) {
  let mode = 0, out = '';
  for (const c of word) {
    if (c === '/') { mode = 1; continue; }
    if (c === '\\') { mode = 2; continue; }
    if (c === ' ') mode = 0;
    if (mode === 0 || (mode === 1 && singular) || (mode === 2 && !singular)) out += c;
  }
  return out;
}
function translateWithArticle(encoded, cls, gender) {
  if (!cls || !gender) return encoded;
  const art = TRANSLATE_ARTICLES[cls === 2 ? 1 : cls][gender];
  if (!art) throw new Error('no article for the gender ' + gender);
  const sp = encoded.indexOf(' '), first = sp < 0 ? encoded : encoded.slice(0, sp), rest = sp < 0 ? '' : encoded.slice(sp);
  return '/' + art + String.fromCharCode(TRANSLATE_NBSP) + translateSingPlur(first, true) + '\\' + translateSingPlur(first, false) + rest;
}
function translateTileNames(b, T, report, attrs) {
  const recs = [];
  let i = 0, prev = -1;
  while (i + 3 <= b.length) {
    const id = u16be(b, i);
    let e = i + 2; while (e < b.length && b[e] !== 0) e++;
    if (id < prev) break;
    recs.push({ id, from: prev + 1, name: String.fromCharCode.apply(null, b.subarray(i + 2, e)) });
    prev = id; i = e + 1;
  }
  const tail = b.subarray(i);
  const articles = !!(T.program && T.tileGenders && attrs);
  const cls = t => attrs && t * 4 + 4 <= attrs.length ? (u32be(attrs, t * 4) >>> 22) & 3 : 0;
  let changed = 0, split = 0;
  const out = [];
  for (const r of recs) {
    let name = r.name, es;
    if (translateWants(r.name)) {
      es = translateLookup(T, 'tiles', 0xF004, translateHash(r.name));
      if (es === undefined) report.missing.push({ resid: 0xF004, at: r.id, hash: translateHash(r.name), kind: 'tile', len: r.name.length });
      else report.done++;
    }
    if (es === undefined || es === '=') { out.push({ id: r.id, name }); continue; }
    const enc = translateEncode(es), gender = articles ? T.tileGenders[translateHash(r.name)] : null;
    if (!gender) { out.push({ id: r.id, name: enc }); if (enc !== r.name) changed++; continue; }
    // One record for each stretch of the run whose tiles share a class.
    const runs = [];
    for (let t = r.from; t <= r.id; t++) { const c = cls(t) === 2 ? 1 : cls(t); if (runs.length && runs[runs.length - 1].c === c) runs[runs.length - 1].to = t; else runs.push({ c, to: t }); }
    split += runs.length - 1;
    for (const run of runs) out.push({ id: run.to, name: translateWithArticle(enc, run.c, gender) });
    changed++;
  }
  if (articles) for (const h of Object.keys(T.tileGenders)) if (!recs.some(r => translateHash(r.name) === h)) report.unused.push({ resid: 0xF004, hash: h });
  if (!changed) return null;
  const bytes = [];
  for (const r of out) { bytes.push((r.id >> 8) & 0xFF, r.id & 0xFF); for (const c of r.name) bytes.push(c.charCodeAt(0)); bytes.push(0); }
  for (const v of tail) bytes.push(v);
  if (split) report.split = split;
  return Uint8Array.from(bytes);
}

/* ---- the resource fork ----------------------------------------------------- */

// STR# as a list of strings, and back.
function translateReadStrList(d) {
  const n = u16be(d, 0), out = [];
  let p = 2;
  for (let i = 0; i < n; i++) { const L = d[p]; out.push(d.subarray(p + 1, p + 1 + L)); p += 1 + L; }
  return out;
}
function translateWriteStrList(list) {
  let len = 2; for (const s of list) len += 1 + s.length;
  const out = new Uint8Array(len);
  out[0] = (list.length >> 8) & 0xFF; out[1] = list.length & 0xFF;
  let p = 2;
  for (const s of list) { if (s.length > 255) throw new Error('a string in a STR# is longer than 255 bytes'); out[p] = s.length; out.set(s, p + 1); p += 1 + s.length; }
  return out;
}

// The data file's resource fork: its STR# strings by hash, as Mac Roman
// (a resource-fork string is not script text, so an accent is its own byte
// there); a TxSt given a new face or size; and the conversation face with
// the letters the translation needs (T.font says which, and how).
function translateResourceFork(rsrc, T, report, log) {
  const spec = resourceForkSpec(openResourceFork(rsrc));
  let changed = false, widths = null, sfntId = null;
  for (const r of spec.resources) {
    if (r.type === 'STR#') {
      const list = translateReadStrList(r.data);
      let n = 0;
      const next = list.map(bytes => {
        const en = decodeMacRoman(bytes);
        if (!translateWants(en)) return bytes;
        const es = translateLookup(T, 'strings', r.id, translateHash(en));
        if (es === undefined) { report.missing.push({ resid: 'STR# ' + r.id, hash: translateHash(en), kind: 'STR#', len: bytes.length }); return bytes; }
        report.done++;
        if (es === '=') return bytes;
        const out = encodeMacRoman(es);
        if (out.length !== bytes.length || out.some((v, i) => v !== bytes[i])) n++;
        return out;
      });
      if (n) { r.data = translateWriteStrList(next); changed = true; log.push('STR# ' + r.id + ': ' + n + ' of ' + list.length + ' strings'); }
    } else if (r.type === 'TxSt' && T.styles && T.styles[r.id]) {
      // Size (a byte), the style bits (a byte), the face's name (a Pascal
      // string): TMPL 128 in the same fork says so.
      const want = T.styles[r.id];
      const size = want.size !== undefined ? want.size : r.data[0], style = want.style !== undefined ? want.style : r.data[1];
      const name = encodeMacRoman(want.font !== undefined ? want.font : decodeMacRoman(r.data.subarray(3, 3 + r.data[2])));
      const out = new Uint8Array(3 + name.length);
      out[0] = size; out[1] = style; out[2] = name.length; out.set(name, 3);
      r.data = out; changed = true;
      log.push('TxSt ' + r.id + ' (' + (r.name || '') + '): ' + decodeMacRoman(name) + ' ' + size);
    } else if (r.type === 'sfnt' && T.font) {
      const got = T.font(r.data);
      r.data = got.bytes; changed = true;
      if (got.widths) { widths = got.widths; sfntId = r.id; }
      log.push('sfnt ' + r.id + ' (' + (r.name || '') + '): ' + got.added + ' glyphs added, ' + got.mapped + ' codes mapped');
    }
  }
  if (widths) {
    const n = translateFamilyWidths(spec, sfntId, widths);
    if (n) log.push('FOND ' + n + ': the family widths of the added letters');
  }
  if (T.strikes) { translateAddStrikes(spec, T.strikes, log); changed = true; }
  return changed ? writeResourceFork(spec) : rsrc;
}

/* The family width table of the conversation face. Argos A Nouveau's FOND
   (1046) has one and its flags clear, so the Font Manager takes a
   character's width from it, and the letters added to the sfnt had none
   there: every accented letter measured nothing while it drew as wide as
   its glyph, so a line with accents was measured short and ran past the
   right edge of the conversation box ("Perdona, qu" under the pause
   button, the maintainer's screenshot of 29 September 2026). A width is
   a fraction of an em in 4.12 fixed point; every table the FOND holds
   (one per style) takes it. */
function translateFamilyWidths(spec, sfntId, widths) {
  for (const r of spec.resources) {
    if (r.type !== 'FOND' || r.data.length < 54) continue;
    const d = r.data, n = u16be(d, 52) + 1;
    let ours = false;
    for (let i = 0; i < n; i++) if (u16be(d, 54 + i * 6) === 0 && u16be(d, 58 + i * 6) === sfntId) ours = true;
    const wOff = u32be(d, 16);
    if (!ours || !wOff) continue;
    const first = u16be(d, 4), last = u16be(d, 6), nw = u16be(d, wOff) + 1, per = 2 + (last - first + 3) * 2;
    const out = d.slice();
    for (let k = 0; k < nw; k++)
      for (const [code, em] of Object.entries(widths)) {
        if (code < first || code > last) continue;
        const at = wOff + 2 + k * per + 2 + (code - first) * 2, v = Math.round(em * 4096);
        out[at] = (v >> 8) & 0xFF; out[at + 1] = v & 0xFF;
      }
    r.data = out;
    return r.id;
  }
  return null;
}

/* The styles drawn in Geneva, with its accented letters. The message pane
   (TxSt 132 "Text", Geneva 10), the labels and the stats (130 and 131,
   Geneva 9) name their face, and Geneva has no glyph at the control codes
   the script text carries its accents at, so those styles drew a box for
   every accent. Setting them in Argos, as the first build did, put the
   conversation face where the game has none (the maintainer: "Argos is
   being used where it shouldn't be"), and Argos has no ">", which the
   message line's "> Talk to " begins with.

   So a family of their own, "Geneva ES", goes into the data file's fork
   and the styles are set in it at their own sizes. Geneva is Apple's and
   cannot be here, so its strikes are made from js/mac-geneva.js: the
   letters of Kelsey Higham's Geneva 9, drawn at both sizes, at the widths
   of Apple's Geneva 9 and 10 (GENEVA_METRICS, Kurrajong's), so every
   string measures as it did and nothing the game lays out moves; the
   10-point strike is Geneva 10's frame and widths with the 9-point
   letters, the maintainer's choice on 29 September 2026 after a 10-point
   drawing derived by adding a row was judged illegible. An accented letter
   is its plain letter with a mark over it, both from the font, and takes
   its plain letter's width and place, as Apple's do; the font's own
   accented letters are not used, being drawn on other bodies (its "á" is a
   single-storey a under the accent). A lowercase mark is what the font
   draws two rows and more above the x-height in é, ñ and ü, a capital's
   what it draws above the cap height in É, Ñ and Ü, each kept where it
   sits against its own letter's centre; í is the i without its dot. Every
   other code draws what the font draws there, at the font's width.

   The Resource Manager finds a font in the data file's fork as it finds
   Argos there. The family's number and its strikes' are ones no font on
   Infinite Mac's System 7.6 or Mac OS 9.0 disk uses, since a font in the
   data file's fork would hide a system font of the same number while the
   game runs. */
function translateGenevaStrike(size) {
  const M = GENEVA_METRICS[size], ttf = geneva9Bytes();
  const { upem, glyphs } = sfntGlyphOutlines(ttf), map = sfntMacRomanGlyphs(ttf), unit = upem / 16;
  const own = code => { const g = glyphs[map[code]]; return map[code] && g ? { px: sfntPixels(g, unit), adv: Math.round(g.adv / unit) } : null; };
  const out = {};
  for (let c = 0; c < 256; c++) { const g = own(c); if (g) out[c] = g; }
  // Printable ASCII at Geneva's widths. A letter sits at Geneva 9's left
  // bearing, and where this size's width differs from Geneva 9's the
  // difference is shared between its two sides: the letters are drawn for
  // Geneva 9's spacing, and Geneva 10's own bearings, which place its wider
  // letters, put all of W's two extra pixels after it ("W elcome", the
  // maintainer, 29 September 2026). An odd pixel goes to the left where
  // Geneva 10 moves the letter right of where Geneva 9 has it (the figures
  // and the straight-stemmed letters), otherwise to the right, so "1.0.3"
  // keeps its stops against the figures. Where Geneva 10 is the narrower (A,
  // the colon, the backslash) this gives its own bearing.
  const M9 = GENEVA_METRICS[9];
  for (let c = 0x20; c < 0x7F; c++) {
    const g = out[c] || { px: [], adv: 0 }, i = c - 0x20, extra = M.adv[i] - M9.adv[i];
    const left = M.lsb[i] > M9.lsb[i] ? Math.ceil(extra / 2) : Math.floor(extra / 2);
    const x0 = g.px.length ? Math.min(...g.px.map(q => q[0])) : 0, dx = M9.lsb[i] + left - x0;
    out[c] = { px: g.px.map(([x, y]) => [x + dx, y]), adv: M.adv[i] };
  }
  const mr = ch => TRANSLATE_MACROMAN[ch], at = ch => ch.charCodeAt(0);
  const mid = px => { const xs = px.map(q => q[0]); return (Math.min(...xs) + Math.max(...xs)) / 2; };
  // A mark: the pixels at or above `from` in the font's accented letter, with the centre of the rest.
  const markOf = (ch, from) => {
    const g = own(mr(ch));
    if (!g) throw new Error('the Geneva font has no ' + ch);
    const m = g.px.filter(q => q[1] >= from), body = g.px.filter(q => q[1] < from);
    return { m, c: mid(body) };
  };
  const low = 4, cap = 6;
  const marks = { acute: markOf('é', low + 2), tilde: markOf('ñ', low + 2), dier: markOf('ü', low + 2),
                  Acute: markOf('É', cap + 2), Tilde: markOf('Ñ', cap + 2), Dier: markOf('Ü', cap + 2) };
  const dotless = { px: out[at('i')].px.filter(q => q[1] <= low), adv: out[at('i')].adv };
  const put = (base, k) => {
    const mk = marks[k], dx = Math.round(mid(base.px) - mk.c);
    return { px: base.px.concat(mk.m.map(([x, y]) => [x + dx, y])), adv: base.adv };
  };
  const made = { 'á': put(out[at('a')], 'acute'), 'é': put(out[at('e')], 'acute'), 'í': put(dotless, 'acute'),
    'ó': put(out[at('o')], 'acute'), 'ú': put(out[at('u')], 'acute'), 'ñ': put(out[at('n')], 'tilde'), 'ü': put(out[at('u')], 'dier'),
    'Á': put(out[at('A')], 'Acute'), 'É': put(out[at('E')], 'Acute'), 'Í': put(out[at('I')], 'Acute'), 'Ó': put(out[at('O')], 'Acute'),
    'Ú': put(out[at('U')], 'Acute'), 'Ñ': put(out[at('N')], 'Tilde'), 'Ü': put(out[at('U')], 'Dier') };
  // ¿ and ¡ are the font's own, at the width of ? and ! and moved to their bearing.
  for (const [ch, base] of [['¿', '?'], ['¡', '!']]) {
    const g = own(mr(ch)), b = out[at(base)], x0 = Math.min(...g.px.map(q => q[0])), bx = Math.min(...b.px.map(q => q[0]));
    made[ch] = { px: g.px.map(([x, y]) => [x + bx - x0, y]), adv: b.adv };
  }
  for (const ch of Object.keys(TRANSLATE_CODES)) { out[TRANSLATE_CODES[ch]] = made[ch]; out[mr(ch)] = made[ch]; }
  out[TRANSLATE_NBSP] = { px: [], adv: out[0x20].adv };     // the no-break space the tile names use
  // The missing symbol: a box as tall as a capital, drawn here.
  const box = [];
  for (let y = 0; y <= cap; y++) for (let x = 0; x < 5; x++) if (y === 0 || y === cap || x === 0 || x === 4) box.push([x, y]);
  const f = { ascent: M.ascent, descent: M.descent, leading: M.leading, glyphs: out, missing: { px: box, adv: 6 } };
  return { bytes: nfntFromPixels(f), f, widMax: Math.max(...Object.values(out).map(g => g.adv), 6) };
}
function translateAddStrikes(spec, S, log) {
  if (typeof GENEVA9_TTF === 'undefined') throw new Error('the Geneva font (js/mac-geneva.js) is not open');
  const entries = [];
  let ten = null;
  for (const size of Object.keys(S.nfnt).map(Number).sort((a, b) => a - b)) {
    const got = translateGenevaStrike(size);
    spec.resources.push({ type: 'NFNT', id: S.nfnt[size], name: null, attrs: 0x20, data: got.bytes });
    entries.push([size, 0, S.nfnt[size]]);
    if (size === 10 || !ten) ten = { size, ascent: got.f.ascent, descent: got.f.descent, leading: got.f.leading, widMax: got.widMax };
  }
  spec.resources.push({ type: 'FOND', id: S.id, name: S.name, attrs: 0x20, data: fondForStrikes(S.id, entries, ten) });
  log.push('FOND ' + S.id + ' (' + S.name + '): Geneva 9\u2019s letters at ' + entries.map(e => e[0]).join(' and ') + ' points, at Geneva\u2019s widths, the accented letters also at their codes');
  const name = encodeMacRoman(S.name);
  for (const r of spec.resources) {
    if (r.type !== 'TxSt' || !S.styles.includes(r.id)) continue;
    const out = new Uint8Array(3 + name.length);
    out[0] = r.data[0]; out[1] = r.data[1]; out[2] = name.length; out.set(name, 3);
    r.data = out;
    log.push('TxSt ' + r.id + ' (' + (r.name || '') + '): ' + S.name + ' ' + out[0]);
  }
}

/* ---- the program's own text ------------------------------------------------ */

/* The application's resources in another language: its menus, its dialogs'
   buttons and words, its windows', dialogs' and controls' titles, its
   string lists, and its TEXT with their style runs. Keyed as the data file
   is, by the resource and the FNV-1a hash of the English bytes (here the
   resource's own Mac Roman bytes, so a curly quote hashes as the byte the
   file holds), in T.program under the resource type and the id in four hex
   digits: `T.program.MENU['0081'][hash]`. `=` keeps a piece as it is. The
   Spanish is Mac Roman in the file, so an accent is its own byte: the system
   fonts the menus and dialogs draw in carry them, and so do the game's own
   faces, Argos at the bytes and Geneva ES at the bytes and the codes.

   A dialog's title is not shown (the dialogs are drawn by the program's own
   routine) and is read as its keys, `DelverDialogerRoutine`: groups
   separated by semicolons, one a dialog item from the first, a key pressing
   the item whose group holds it. So a dialog's title is translated as the
   keys of its translated buttons, the English letters kept where they do
   not clash.

   A TEXT with a `styl` of the same id is written as a list of pieces, one a
   style run in order, and the runs' offsets are counted again from them; a
   list of another length is refused. What the table does not reach is
   reported, save the resources T.program.keep names (the combat-AI
   language, whose keywords a player's strategy files are written in; the
   file names the program opens files by; the CD driver's names). */
function translateProgramResources(rsrc, T, report, log) {
  const P = T.program || {};
  const spec = resourceForkSpec(openResourceFork(rsrc));
  const keep = new Set(P.keep || []);
  const hex = id => (id & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  const bin = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return s; };
  const look = (type, id, bytes) => {
    const en = bin(bytes), h = translateHash(en), sec = P[type];
    const got = sec && ((sec[hex(id)] && sec[hex(id)][h] !== undefined) ? sec[hex(id)][h] : (sec['*'] ? sec['*'][h] : undefined));
    if (got === undefined) {
      if (translateWants(en) && !keep.has(type + ' ' + id)) report.missing.push({ resid: type + ' ' + id, hash: h, kind: type, len: bytes.length });
      return bytes;
    }
    report.done++;
    return got === '=' ? bytes : encodeMacRoman(got);
  };
  const pstrAt = (d, o) => d.subarray(o + 1, o + 1 + d[o]);
  const pstr = b => { if (b.length > 255) throw new Error('a string in the program is longer than 255 bytes'); const o = new Uint8Array(1 + b.length); o[0] = b.length; o.set(b, 1); return o; };
  const cat = parts => { let n = 0; for (const p of parts) n += p.length; const o = new Uint8Array(n); let at = 0; for (const p of parts) { o.set(p, at); at += p.length; } return o; };
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const counts = {};
  const changed = (r, data) => { if (!same(data, r.data)) { r.data = data; counts[r.type] = (counts[r.type] || 0) + 1; } };
  const styls = new Map(spec.resources.filter(r => r.type === 'styl').map(r => [r.id, r]));
  for (const r of spec.resources) {
    const d = r.data;
    if (keep.has(r.type + ' ' + r.id)) continue;
    if (r.type === 'MENU') {
      // menuID, width, height, procID, filler, enable flags; the title; each
      // item a string and four bytes (icon, key, mark, style); a zero.
      const parts = [d.subarray(0, 14)];
      let o = 14;
      parts.push(pstr(look('MENU', r.id, pstrAt(d, o)))); o += 1 + d[o];
      while (o < d.length && d[o]) { parts.push(pstr(look('MENU', r.id, pstrAt(d, o)))); o += 1 + d[o]; parts.push(d.subarray(o, o + 4)); o += 4; }
      parts.push(d.subarray(o));
      changed(r, cat(parts));
    } else if (r.type === 'DITL') {
      // Each item: a handle placeholder, its rectangle, its type and the
      // length of its text, the text padded to a word.
      const n = u16be(d, 0) + 1, parts = [d.subarray(0, 2)];
      let o = 2;
      for (let k = 0; k < n; k++) {
        const type = d[o + 12] & 0x7F, len = d[o + 13], text = d.subarray(o + 14, o + 14 + len);
        const now = [4, 5, 6, 8, 16].includes(type) ? look('DITL', r.id, text) : text;
        if (now.length > 255) throw new Error('a dialog item\'s text is longer than 255 bytes');
        const head = Uint8Array.from(d.subarray(o, o + 14)); head[13] = now.length;
        parts.push(head, now, new Uint8Array(now.length & 1));
        o += 14 + len + (len & 1);
      }
      parts.push(d.subarray(o));
      changed(r, cat(parts));
    } else if (r.type === 'WIND' || r.type === 'DLOG' || r.type === 'CNTL') {
      const at = { WIND: 18, DLOG: 20, CNTL: 22 }[r.type];
      if (at >= d.length) continue;
      const title = pstrAt(d, at);
      changed(r, cat([d.subarray(0, at), pstr(look(r.type, r.id, title)), d.subarray(at + 1 + d[at])]));
    } else if (r.type === 'STR#') {
      const list = translateReadStrList(d);
      changed(r, translateWriteStrList(list.map(b => look('STR#', r.id, b))));
    } else if (r.type === 'TEXT') {
      const en = bin(d), h = translateHash(en), sec = P.TEXT && P.TEXT[hex(r.id)], got = sec && sec[h];
      if (got === undefined) { if (translateWants(en)) report.missing.push({ resid: 'TEXT ' + r.id, hash: h, kind: 'TEXT', len: d.length }); continue; }
      report.done++;
      if (got === '=') continue;
      const st = styls.get(r.id), pieces = (Array.isArray(got) ? got : [got]).map(encodeMacRoman);
      if (st) {
        const runs = u16be(st.data, 0);
        if (pieces.length !== runs) throw new Error('TEXT ' + r.id + ' has ' + runs + ' style runs and its translation ' + pieces.length + ' pieces');
        const sd = Uint8Array.from(st.data);
        let off = 0;
        pieces.forEach((p, k) => { const q = 2 + 20 * k; sd[q] = off >>> 24; sd[q + 1] = (off >>> 16) & 0xFF; sd[q + 2] = (off >>> 8) & 0xFF; sd[q + 3] = off & 0xFF; off += p.length; });
        changed(st, sd);
      } else if (pieces.length !== 1) throw new Error('TEXT ' + r.id + ' has no style runs and its translation ' + pieces.length + ' pieces');
      changed(r, cat(pieces));
    }
  }
  const said = Object.keys(counts).sort().map(t => counts[t] + ' ' + t).join(', ');
  if (said) log.push('the program\'s resources: ' + said + ' changed');
  return writeResourceFork(spec);
}

/* The program in another language: its resources (above) and the strings
   pooled in its code, each looked up by the hash of its bytes in
   T.program.C (a C string) or T.program.P (a Pascal string): the
   translation, `=` to keep it, or, for a C string the program also points
   into (a tail it shares with another), a list of pieces, one from each
   place it is pointed at. What the table does not name is reported, as the
   data file's pieces are. A C string and its translation carry the same
   printf conversions in the same order, since the program formats with
   them; one that does not is refused. The strings are written by the
   program patcher (applyAppFixes, js/delv-apppatch.js), in place where the
   translation fits and moved to the end of the code where it does not,
   PowerPC only: the 68K program keeps its own copies. */
function translateProgram(data, rsrc, T, fixes) {
  const report = { done: 0, keys: 0, missing: [], unused: [] }, log = [];
  const P = T.program || {};
  const rsrcOut = translateProgramResources(rsrc, T, report, log);
  const bin = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return s; };
  const convs = s => (s.match(/%[-+ #0]*\d*(?:\.\d+)?[a-zA-Z]/g) || []).join(' ');
  const pooled = appPooledStrings(data);
  const ranges = pooled.filter(p => !p.pascal && p.inner.length).map(p => [p.at, p.at + p.bytes.length]);
  const cstrings = [];
  for (const p of pooled) {
    if (!p.pascal && ranges.some(([a, b]) => p.at > a && p.at < b)) continue;   // a tail of another: its pieces say it
    const en = bin(p.bytes), h = translateHash(en), sec = p.pascal ? P.P : P.C, got = sec ? sec[h] : undefined;
    if (got === undefined) { if (translateWants(en)) report.missing.push({ resid: (p.pascal ? 'Pascal' : 'C') + ' 0x' + p.at.toString(16).toUpperCase(), hash: h, kind: p.pascal ? 'P' : 'C', len: p.bytes.length }); continue; }
    report.done++;
    if (got === '=') continue;
    const pieces = (Array.isArray(got) ? got : [got]).map(encodeMacRoman);
    if (pieces.length !== p.inner.length + 1) throw new Error('the program\'s string ' + h + ' has pointers into it at ' + (p.inner.length + 1) + ' places and its translation has ' + pieces.length + ' pieces');
    const now = new Uint8Array(pieces.reduce((n, x) => n + x.length, 0));
    const nowInner = [];
    let off = 0;
    pieces.forEach((x, k) => { if (k) nowInner.push(off); now.set(x, off); off += x.length; });
    if (convs(en) !== convs(bin(now))) throw new Error('the program\'s string ' + h + ' formats "' + convs(en) + '" and its translation "' + convs(bin(now)) + '"');
    cstrings.push({ at: p.at, pascal: p.pascal, was: Array.from(p.bytes), now: Array.from(now), inner: p.inner, nowInner });
  }
  const fix = { id: 'translation-' + (T.lang || 'xx'), kind: 'text', title: 'The program in ' + (T.name || T.lang), cstrings };
  // Program fixes chosen with it are applied in the same pass, since the
  // patcher refuses a program it has grown already.
  const r = applyAppFixes({ data, rsrc: rsrcOut }, [fix].concat(fixes || []));
  const rec = r.applied[0], moved = (rec.strings || []).filter(x => x.place === 'moved').length;
  log.push('the program\'s strings: ' + cstrings.length + ' translated, ' + moved + ' of them moved to the end of the code, which grew by ' + r.grownBy + ' bytes');
  return { data: r.data, rsrc: r.rsrc, log, report };
}

/* ---- the whole file -------------------------------------------------------- */

function translateCytheraData(data, rsrc, T, opts) {
  opts = opts || {};
  const report = { done: 0, keys: 0, missing: [], unused: [] };
  const keepSyms = DVM_RESOURCE_SYMBOLS, keepCtx = dvmContextResid;
  try {
    const s = dataPatchSession(data);
    const what = 'the translation (' + (T.name || T.lang || '?') + ')';
    for (const resid of dataPatchScriptResids(s.spec)) {
      if (resid === 0x0101 || resid === 0x0201) continue;   // the scripts' symbols; the name table, below
      let b;
      try { b = s.bytesOf(resid); } catch (e) { quiet(e, 'translate 0x' + resid.toString(16)); continue; }
      const places = translatePlaces(b, resid, T, report);
      if (places.length) dataPatchReplaceMany(s, resid, places, what);
    }
    const nt = translateNameTable(s.bytesOf(0x0201), T, report);
    if (nt) { s.plain.set(0x0201, nt); s.relaid.add(0x0201); s.log.push(what + ': 0x0201, the name table laid out again'); }
    if (s.spec.resources.some(r => r.resid === 0xF004)) {
      const tn = translateTileNames(s.bytesOf(0xF004), T, report, opts.articles && s.spec.resources.some(r => r.resid === 0xF002) ? s.bytesOf(0xF002) : null);
      if (tn) { s.plain.set(0xF004, tn); s.relaid.add(0xF004); s.log.push(what + ': 0xF004, the tile names written again'); }
    }
    const done = finishDataPatch(s);
    const log = done.log.slice();
    const outRsrc = rsrc && rsrc.length ? translateResourceFork(rsrc, T, report, log) : rsrc;
    return { data: writeDelverArchive(done.spec), rsrc: outRsrc, log, report, changed: done.changed };
  } finally {
    dvmSetResourceSymbols(keepSyms);
    dvmContextResid = keepCtx;
  }
}

/* ---- the letters Spanish needs, in Argos A Nouveau -------------------------- */

/* The acute on the ten vowels, the tilde on n and N, the diaeresis on u and
   U, and the inverted marks, each one flat outline made of the font's own
   letter and a mark drawn here, mapped at the control codes of
   TRANSLATE_CODES and at their Mac Roman bytes too (a resource-fork string,
   such as the conversation window's buttons, carries the real byte). The
   shapes and every proportion are mkfont-es3-proof.py's, the one seen on
   Mac OS 8.5: an acute of the straight quote scaled down was barely visible,
   so it is a drawn wedge; the i loses its dot, the contour that sits
   highest, before it takes the acute; ¿ and ¡ are ? and ! turned half a
   circle and sunk a fifth of an em, or less where that would take them
   below the face's own g. A mark is drawn clockwise, as TrueType
   wants an outer contour, though a mark that overlaps nothing fills either
   way. */
const TRANSLATE_MACROMAN = { 'á': 0x87, 'é': 0x8E, 'í': 0x92, 'ó': 0x97, 'ú': 0x9C, 'ñ': 0x96, 'ü': 0x9F, '¿': 0xC0,
  '¡': 0xC1, 'Á': 0xE7, 'É': 0x83, 'Í': 0xEA, 'Ó': 0xEE, 'Ú': 0xF2, 'Ñ': 0x84, 'Ü': 0x86 };
function translateSpanishGlyphs(sfnt) {
  const { upem, glyphs } = sfntGlyphOutlines(sfnt);
  const cmap = sfntTablesOf(sfnt).cmap;
  let mac = -1;
  for (let i = 0; i < u16be(cmap, 2); i++) { const p = 4 + i * 8; if (u16be(cmap, p) === 1 && u16be(cmap, p + 2) === 0) mac = u32be(cmap, p + 4); }
  if (mac < 0) throw new Error('the conversation font has no Mac Roman cmap');
  const gidOf = ch => { const g = cmap[mac + 6 + ch.charCodeAt(0)]; if (!g || !glyphs[g] || !glyphs[g].contours.length) throw new Error('the conversation font has no ' + ch); return g; };
  const R = Math.round;
  const box = cs => { const p = [].concat(...cs); return [Math.min(...p.map(q => q.x)), Math.min(...p.map(q => q.y)), Math.max(...p.map(q => q.x)), Math.max(...p.map(q => q.y))]; };
  const poly = pts => pts.slice().reverse().map(([x, y]) => ({ x: R(x), y: R(y), on: true }));
  const move = (cs, dx, dy) => cs.map(c => c.map(q => ({ x: R(q.x + dx), y: R(q.y + dy), on: q.on })));
  const gap = upem * 0.05, thick = upem * 0.055;
  const wedge = (len, th) => { const dx = len * 0.55, dy = len; return [poly([[0, 0], [th, 0], [dx + th * 0.6, dy], [dx - th * 0.4, dy]])]; };
  const wave = (w, th, amp, N) => {
    N = N || 16;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { top.push([i / N * w, amp * Math.sin(2 * Math.PI * i / N) + th / 2]); bot.push([i / N * w, amp * Math.sin(2 * Math.PI * i / N) - th / 2]); }
    // along the top to the right and back along the bottom is clockwise already
    return [top.concat(bot.reverse()).map(([x, y]) => ({ x: R(x), y: R(y), on: true }))];
  };
  const dots = (sep, r) => [0, sep].map(cx => { const p = []; for (let k = 0; k < 12; k++) p.push([cx + r * Math.cos(2 * Math.PI * k / 12), r * Math.sin(2 * Math.PI * k / 12)]); return poly(p); });
  const marks = {
    acute: wedge(upem * 0.17, upem * 0.075),
    tilde: wave(upem * 0.36, thick, upem * 0.035),
    tildecap: wave(upem * 0.46, thick, upem * 0.04),
    dieresis: dots(upem * 0.17, upem * 0.045),
  };
  const above = (baseCs, mark) => {
    const b = box(baseCs), m = box(mark);
    return baseCs.concat(move(mark, (b[0] + b[2]) / 2 - (m[0] + m[2]) / 2, b[3] + gap - m[1]));
  };
  const letter = ch => glyphs[gidOf(ch)];
  // The i without its dot: every contour but the one that reaches highest.
  const iCs = letter('i').contours.slice();
  const tops = iCs.map(c => Math.max(...c.map(q => q.y)));
  iCs.splice(tops.indexOf(Math.max(...tops)), 1);
  const made = {};
  for (const [ch, base] of [['á', 'a'], ['é', 'e'], ['ó', 'o'], ['ú', 'u'], ['Á', 'A'], ['É', 'E'], ['Í', 'I'], ['Ó', 'O'], ['Ú', 'U']])
    made[ch] = { contours: above(letter(base).contours, marks.acute), adv: letter(base).adv };
  made['í'] = { contours: above(iCs, marks.acute), adv: letter('i').adv };
  made['ñ'] = { contours: above(letter('n').contours, marks.tilde), adv: letter('n').adv };
  made['Ñ'] = { contours: above(letter('N').contours, marks.tildecap), adv: letter('N').adv };
  made['ü'] = { contours: above(letter('u').contours, marks.dieresis), adv: letter('u').adv };
  made['Ü'] = { contours: above(letter('U').contours, marks.dieresis), adv: letter('U').adv };
  for (const [ch, base] of [['¿', '?'], ['¡', '!']]) {
    const cs = letter(base).contours, b = box(cs);
    // Sunk a fifth of an em as the proofs had them, but never below the
    // lowest the shipped face reaches (its g): the game clears the
    // conversation box by fixed rectangles that the shipped descenders fit,
    // and a mark deeper than any of them was the one glyph of ours that
    // could leave ink below the cleared band (29 September 2026, a stroke
    // left near the bottom of the box).
    const floorY = Math.min(...glyphs.filter(g => g.contours.length).map(g => Math.min(...[].concat(...g.contours).map(q => q.y))));
    const turned = cs.map(c => c.map(q => ({ x: R(-q.x + b[0] + b[2]), y: -q.y + b[1] + b[3] })));
    const low = Math.min(...[].concat(...turned).map(q => q.y));
    const dy = Math.max(-upem * 0.22, floorY - low);
    made[ch] = { contours: turned.map((c, k) => c.map((q, j) => ({ x: q.x, y: R(q.y + dy), on: cs[k][j].on }))), adv: letter(base).adv };
  }
  const order = Object.keys(TRANSLATE_CODES);
  const codes = {};
  order.forEach((ch, i) => { codes[TRANSLATE_CODES[ch]] = i; codes[TRANSLATE_MACROMAN[ch]] = i; });
  // The no-break space the tile names join an article to its noun with
  // (TRANSLATE_NBSP) draws as the font's own space.
  const space = cmap[mac + 6 + 0x20];
  const got = sfntWithGlyphs(sfnt, order.map(ch => made[ch]), codes, { [TRANSLATE_NBSP]: space });
  // Each added letter's width as a fraction of the em, at both its codes,
  // for the family width table (translateFamilyWidths).
  got.widths = {};
  order.forEach(ch => { got.widths[TRANSLATE_CODES[ch]] = made[ch].adv / upem; got.widths[TRANSLATE_MACROMAN[ch]] = made[ch].adv / upem; });
  got.widths[TRANSLATE_NBSP] = glyphs[space].adv / upem;
  return got;
}
