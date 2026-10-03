/* delv-datapatch.js -- edits to Cythera Data's resources, and the fixes of
   js/delv-datafixes.js applied through them.

   applyDataFixes(bytes, ids, opts) -> { spec, changed, log, fixes }

   `bytes` is a Delver archive (the scenario, Cythera Data's data fork);
   `ids` the fixes chosen from DATA_FIXES, by id, in any order. The answer
   is the archive's writer spec with every changed resource in it, the
   resources that differ from the file given, and a line for each edit.
   Anything that does not match what an edit expects throws, naming the fix
   and the place, and nothing is returned: a patch applied in part is a
   file nobody has read. writeDelverPatch(spec, changed, ...) is then the
   Magpie patch, which is what the Patches section hands out.

   This was the inside of utilities/patch_build.mjs, which ran it in the
   page's own sandbox for the Node builders of 24 to 28 September 2026. It
   moved here on 28 September 2026 so that the page could build a patch
   from the fixes a visitor chooses, and patch_build.mjs runs this now; the
   builders' outputs were compared byte for byte, before and after, on the
   patched data file (the patch itself carries a fresh identity each time).

   THE THREE KINDS OF EDIT, one stage's worth at a time (applyDataEdits):
     edits: [{ what, resid, at, to?, expect: {offset: 'listing text'},
               code }]  -- code in the raw listing's own words; `to`
             omitted means insert at `at`, otherwise replace at..to. The
             offsets are the resource's as it stands when the edit is
             applied, so edits to one resource are applied in the order
             given: put the higher offsets first, or keep the earlier
             edits the same length. `shiftAt: true` sends a jump that
             lands exactly at `at` past the new code rather than into it
             (dvmRelink's opts.shiftAt): what a `return` put after an
             answer wants, since the jump there is the previous keyword
             test skipping to the next one, and must still reach it.
             `replaceOp: true` replaces the one instruction at `at`.
     dataEdits: [{ what, resid, fn }] -- fn (b) => string | Uint8Array,
             run on the decrypted bytes (a copy); it edits b in place and
             returns a log line, or returns a new array to replace the
             resource, or throws when the bytes are not what it expects.
     textEdits: [{ what, resid, find, replace, count?, mid?, at?, optional? }]
             -- every occurrence of the text `find` in the resource (count
             says how many there must be; omitted means at least one) is
             replaced by `replace`, right to left, each through dvmRelink's
             splice with the new bytes, so the offsets past it move; and
             where the text sits inside a `data` block (the direction lists,
             the shop's lines, a rumour) the block's size word is corrected
             by the difference, which the relinker does not know to do. Text
             is bytes below 0x80 wherever it is -- an implicit string, a
             NUL-terminated string operand, an array entry, a data block --
             so this is the same edit for all of them. `resid: null` is the
             same edit over every script resource, each allowed to match
             nothing (the British spellings, which are not tied to a place),
             less the resources `except` names. `prose: true` takes a whole
             word of running text only: not a word's part, not a
             highlighted word (after an @), and nothing in a keyword list,
             which a spelling that changed a word's start would stop
             answering (the olde spelling's "ye" for "the"; 29 September
             2026).
   Within a stage the code edits go first, then the data edits, then the
   text: a resource laid out afresh by a data edit (the name table) must be
   whole before a text edit looks for a word in it.

   STAGES. The fixes were built as separate patches, and the order they were
   chained in when made one (combined_patch.mjs, 25 September 2026) is
   DATA_FIX_STAGES; js/delv-datafixes.js says why it is that order. A stage's
   plans all read the file as the stage finds it, before any of its edits,
   and a session carries every stage's edits on to the next, which is what
   writing the file out and opening it again between stages did. */

// The scenario's script resources by delvmod's hints: subindexes 0..14 and
// 47 direct, 15..125 class, less the graphics, map, prop and sound ones.
function dataPatchScriptResids(spec) {
  const NON = new Set([127, 128, 131, 135, 137, 141, 142, 144]);
  return spec.resources.map(r => r.resid).filter(id => { const si = (id >> 8) - 1; return !NON.has(si) && si !== 3 && ((si >= 0 && si <= 14) || si === 47 || (si >= 15 && si <= 125)); });
}

/* One archive being edited: the resources as they stand after every edit so
   far, decrypted, and the log. Sets the disassembler's symbols to this
   archive's, which the expectations are written in (`word Character.Hector`);
   applyDataFixes puts back what the page had. */
function dataPatchSession(bytes) {
  const arc = openDelverArchive(bytes);
  dvmSetResourceSymbols(loadResourceSymbolsFrom(arc));
  const spec = delverArchiveSpec(bytes);
  const plain = new Map();
  return {
    bytes, arc, spec, plain, log: [], listings: new Map(), stage: null, textDone: [],
    // Every splice made in a resource, in order, so that a place in the
    // resource as it stands can be taken back to the file the session began
    // on (dataPatchOrigin); a resource laid out afresh cannot be.
    splices: new Map(), relaid: new Set(),
    bytesOf(resid) { return plain.get(resid) || smartDecrypt(getResourceBytes(arc, resid), resid).data; },
  };
}

// A place in a resource as it stands, in the file the session began on: each
// splice undone, last first; a place inside new bytes goes to where they were
// put, and is `touched`, since the file there says what the edit replaced (a
// hyphen put into a word a fix respelt, a "the" in a To Do line a fix wrote
// afresh). `at` null for a resource laid out afresh.
function dataPatchOrigin(s, resid, at) {
  if (s.relaid.has(resid)) return { at: null, touched: true };
  const list = s.splices.get(resid) || [];
  let touched = false;
  for (let k = list.length - 1; k >= 0; k--) {
    const sp = list[k];
    if (at >= sp.at + sp.inserted) at -= sp.inserted - sp.removed;
    else if (at >= sp.at) { at = sp.at; touched = true; }
  }
  return { at, touched };
}
function dataPatchSplice(s, resid, at, removed, inserted) {
  if (!s.splices.has(resid)) s.splices.set(resid, []);
  s.splices.get(resid).push({ at, removed, inserted });
}

// The instruction at `at` in a resource's bytes, and where the next begins.
function dataPatchOpAt(b, resid, at) {
  const fn = dvmExtents(b, resid).find(([st, en, k]) => k === 'function' && at >= st && at < en);
  if (!fn) return null;
  dvmContextResid = resid;
  const ops = dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops;
  const i = ops.findIndex(o => fn[0] + o[0] === at);
  if (i < 0) return null;
  const op = ops[i];
  return { text: op[2] + (op[3] ? ' ' + op[3] : ''), next: i + 1 < ops.length ? fn[0] + ops[i + 1][0] : fn[1] };
}

/* Every instruction of every function in a resource as it stands, at its
   offset in the resource, and each function's extent and count of locals:
   what a plan that finds its places reads. Kept until the stage's edits
   begin, since every plan of a stage reads the file as the stage found it. */
function dataPatchListing(s, resid) {
  if (s.listings.has(resid)) return s.listings.get(resid);
  const b = s.bytesOf(resid);
  const ops = [], fns = [];
  for (const [st, en, k] of dvmExtents(b, resid)) {
    if (k !== 'function') continue;
    dvmContextResid = resid;
    fns.push({ st, en, locals: b[st + 2] });
    for (const op of dvmDisassemble(b.subarray(st, en), 3).ops) ops.push({ at: st + op[0], text: op[2] + (op[3] ? ' ' + op[3] : '') });
  }
  const out = { ops, fns };
  s.listings.set(resid, out);
  return out;
}

/* The one run of instructions in `resid` whose texts begin as `seq` does,
   with the offset of each and an `expect` that applyDataEdits checks again.
   A run that is not there exactly once stops the build. */
function dataPatchPlace(s, what, resid, seq) {
  const ops = dataPatchListing(s, resid).ops, hits = [];
  for (let i = 0; i + seq.length <= ops.length; i++) if (seq.every((t, k) => ops[i + k].text.startsWith(t))) hits.push(i);
  if (hits.length !== 1) throw new Error(what + ': the instructions looked for are in 0x' + resid.toString(16).toUpperCase() + ' ' + hits.length + ' times, not once');
  const i = hits[0], expect = {};
  seq.forEach((t, k) => { expect[ops[i + k].at] = t; });
  return { at: k => ops[i + k].at, text: k => ops[i + k].text, expect };
}

// The text of every script resource as it stands, one latin1 string each,
// keyed by resource id: what a plan that matches words before it edits reads.
function dataPatchTexts(s) {
  const out = {};
  for (const resid of dataPatchScriptResids(s.spec)) {
    const b = s.bytesOf(resid);
    let t = ''; for (let i = 0; i < b.length; i++) t += String.fromCharCode(b[i]);
    out[resid] = t;
  }
  return out;
}

// One stage's edits, applied to the session.
function applyDataEdits(s, { edits = [], dataEdits = [], textEdits = [] }) {
  const log = s.log;
  // An edit a fix brought (applyDataFixes tags it) names the fix when it
  // fails, since its `what` names only the place.
  const named = (e, err) => e.fixTitle ? new Error(e.fixTitle + '. ' + err.message) : err;
  for (const e of edits) try {
    const b = s.bytesOf(e.resid);
    for (const [at, want] of Object.entries(e.expect || {})) {
      const got = dataPatchOpAt(b, e.resid, +at);
      if (!got || !got.text.startsWith(want)) throw new Error(e.what + ': at 0x' + (+at).toString(16) + ' the listing says ' + (got && got.text) + ', not ' + want);
    }
    let to = e.to;
    if (e.replaceOp) { const g = dataPatchOpAt(b, e.resid, e.at); if (!g) throw new Error(e.what + ': no instruction at 0x' + e.at.toString(16)); to = g.next; }
    const asm = dvmAssemble(e.code, e.resid);
    const rl = dvmRelink(b, e.resid, e.at, to === undefined ? 0 : to - e.at, asm, e.shiftAt ? { shiftAt: true } : undefined);
    const removed = to === undefined ? 0 : to - e.at;
    dataPatchSplice(s, e.resid, e.at, removed, removed + rl.delta);
    s.plain.set(e.resid, rl.bytes);
    log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', ' + (rl.delta >= 0 ? '+' : '') + rl.delta + ' bytes, ' + rl.moved + ' offsets moved');
  } catch (err) { throw named(e, err); }
  const toBytes = t => Uint8Array.from(t, c => { const v = c.charCodeAt(0); if (v >= 0x80) throw new Error('text edit has a byte above 0x7F: ' + t); return v; });
  const findAll = (b, needle) => { const out = []; for (let i = 0; i + needle.length <= b.length; i++) { let k = 0; while (k < needle.length && b[i + k] === needle[k]) k++; if (k === needle.length) out.push(i); } return out; };
  // Data edits first: a resource laid out afresh (the name table) must
  // be whole before a text edit looks for a word in it.
  for (const d of dataEdits) try {
    const b = s.bytesOf(d.resid).slice();
    const res = d.fn(b);
    // A data edit may return a new array (a resource laid out afresh) or a
    // line about the array it edited in place.
    const line = res instanceof Uint8Array ? 'laid out again, ' + b.length + ' to ' + res.length + ' bytes' : res;
    s.plain.set(d.resid, res instanceof Uint8Array ? res : b);
    if (res instanceof Uint8Array) s.relaid.add(d.resid);
    log.push(d.what + ': 0x' + d.resid.toString(16).toUpperCase() + ', ' + line);
  } catch (err) { throw named(d, err); }
  // resid null: the same edit over every script resource, each allowed
  // to match nothing (the UK spellings, which are not tied to a place).
  const TEXT = textEdits.slice();
  const scriptResids = dataPatchScriptResids(s.spec);
  for (let k = TEXT.length - 1; k >= 0; k--) if (TEXT[k].resid === null) {
    const e = TEXT[k];
    TEXT.splice(k, 1, ...scriptResids.filter(resid => !(e.except && e.except.indexOf(resid) >= 0)).map(resid => Object.assign({}, e, { resid, optional: true, quiet: true })));
  }
  // An edit anchored to an offset ('at', in the resource as the stage found
  // it) is applied after every anchored edit further on in the same
  // resource, so its offset is still where the text is.
  TEXT.sort((x, y) => x.resid - y.resid || ((y.at === undefined ? -1 : y.at) - (x.at === undefined ? -1 : x.at)));
  for (const e of TEXT) try {
    let b = s.bytesOf(e.resid);
    const needle = toBytes(e.find), repl = toBytes(e.replace);
    if (e.at !== undefined) {
      for (let k = 0; k < needle.length; k++) if (b[e.at + k] !== needle[k]) throw new Error(e.what + ': "' + e.find + '" is not at 0x' + e.at.toString(16) + ' in 0x' + e.resid.toString(16));
    }
    // 'mid': only in the middle of a sentence, a space before and a
    // lower-case letter after, which keeps an operand byte that happens
    // to equal the text (a tab is 9, and 0x813 has three of those between
    // bytes that print as '@' and a digit) out.
    const lower = v => v >= 0x61 && v <= 0x7A;
    // 'prose': a whole word, not after an @, and outside every keyword list.
    const letter = v => (v >= 0x41 && v <= 0x5A) || lower(v);
    const word = i => !(i > 0 && (letter(b[i - 1]) || b[i - 1] === 0x40)) && !(i + needle.length < b.length && letter(b[i + needle.length]));
    let hits = e.at !== undefined ? [e.at] : findAll(b, needle).filter(i => (!e.mid || (i > 0 && b[i - 1] === 0x20 && i + needle.length < b.length && lower(b[i + needle.length]))) && (!e.prose || word(i)));
    // Every site in the resource, and on the way its data blocks and its
    // keyword lists, in one walk; taken only where there is something to
    // change, since an edit made over every script finds most of them empty.
    const extra = { blocks: [], keys: [] };
    const sites = hits.length ? dvmOffsetSites(b, e.resid, extra) : [];
    if (e.prose) hits = hits.filter(i => !extra.keys.some(([a, z]) => i < z && i + needle.length > a));
    if (!hits.length && e.optional) { if (!e.quiet) log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', 0 places'); continue; }
    if (e.count !== undefined ? hits.length !== e.count : hits.length < 1) throw new Error(e.what + ': "' + e.find + '" found ' + hits.length + ' times in 0x' + e.resid.toString(16) + (e.count !== undefined ? ', not ' + e.count : ''));
    // Where each place is in the file the session began on, before this
    // edit's own splices; the list of the text's changes links to it.
    const origin = hits.map(i => dataPatchOrigin(s, e.resid, i));
    /* Every place at once: dvmRelink's splice and check, with one step it
       cannot take put between them, a data block's size word corrected
       before the result is read back, since the block is read by that size
       and a stale one throws every site after it off. Until 29 September
       2026 this took the places one at a time from the right, reading every
       site again before and after each, which is the same arithmetic and
       came out the same bytes (compared); the olde spelling's three
       thousand "the"s took four seconds that way. A site past a place moves
       by the difference in length once for each place before it; a site
       pointing into the text replaced is refused; `moved` counts a site
       once for each place that moved it, as the one-at-a-time loop did. */
    const len = needle.length, delta = repl.length - len;
    const asc = hits.slice().sort((x, y) => x - y);
    for (let k = 1; k < asc.length; k++) if (asc[k] < asc[k - 1] + len) throw new Error(e.what + ': two of its places overlap in 0x' + e.resid.toString(16));
    const out = new Uint8Array(b.length + delta * asc.length);
    let from = 0, to = 0;
    for (const off of asc) { out.set(b.subarray(from, off), to); to += off - from; out.set(repl, to); to += repl.length; from = off + len; }
    out.set(b.subarray(from), to);
    const endedBy = p => { let n = 0; for (const off of asc) if (off + len <= p) n++; return n; };
    if (delta) for (const blk of extra.blocks) {
      const n = asc.filter(off => off >= blk.a + 3 && off < blk.a + 3 + blk.size).length;
      if (!n) continue;
      const size = blk.size + n * delta, at = blk.a + delta * endedBy(blk.a);
      out[at + 1] = (size >> 8) & 0xFF; out[at + 2] = size & 0xFF;
    }
    const expect = new Map();
    let moved = 0;
    for (const site of sites) {
      if (asc.some(off => site.at >= off && site.at < off + len)) continue;
      if (asc.some(off => site.value > off && site.value < off + len)) throw new Error(e.what + ': 0x' + site.value.toString(16) + ', which a ' + site.kind + ' points at, is inside the text replaced');
      const p = site.at + delta * endedBy(site.at), n = endedBy(site.value), v = site.value + delta * n;
      if (delta && n) { dvmWriteSite(out, { at: p, size: site.size }, v); moved += n; }
      expect.set(p, v);
    }
    const again = dvmOffsetSites(out, e.resid);
    const bad = again.filter(site => expect.has(site.at) && expect.get(site.at) !== site.value);
    const lost = [...expect.keys()].filter(q => !again.some(site => site.at === q));
    if (bad.length || lost.length) throw new Error(e.what + ' in 0x' + e.resid.toString(16) + ': the resource does not read back, ' + bad.length + ' offsets wrong, ' + lost.length + ' no longer found');
    // The splices from the right, as they were once made one at a time.
    for (let k = asc.length - 1; k >= 0; k--) dataPatchSplice(s, e.resid, asc[k], len, repl.length);
    b = out;
    s.plain.set(e.resid, b);
    log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', ' + hits.length + ' place' + (hits.length === 1 ? '' : 's') + ', ' + moved + ' offsets moved');
    // What the text now says, edit by edit, for the list of every change
    // the text makes (dataFixTextChanges).
    s.textDone.push({ stage: s.stage, opt: e.opt || null, what: e.what, resid: e.resid, find: e.find, replace: e.replace, places: hits.length, at: origin });
  } catch (err) { throw named(e, err); }
}

/* The session's edits written into its spec: the archive as edited, and
   the resources whose bytes now differ from the file the session began on
   (a resource an edit put back as it was is not one). */
function finishDataPatch(s) {
  const changed = [];
  for (const [resid, data] of s.plain) {
    const r = s.spec.resources.find(x => x.resid === resid);
    const was = smartDecrypt(getResourceBytes(s.arc, resid), resid).data;
    r.data = data;
    if (was.length !== data.length || was.some((v, i) => v !== data[i])) changed.push(resid);
  }
  return { spec: s.spec, changed: changed.sort((a, b) => a - b), log: s.log, text: s.textDone };
}

/* The fixes chosen, in DATA_FIX_STAGES order. A fix is chosen by its id,
   and of the fixes sharing a `choice` the first chosen wins. A fix with a
   `parent` (the text's options) counts on its own since 1 October 2026,
   when the maintainer had the text's own box dropped: its edits are in its
   parent's stages, which run for it without the parent's own edits (the
   text's plans ask for 'text' itself).
   opts.stages keeps the parts of those stages only, which is how the
   builders write the patches that were made separately; opts.communityTypos
   stands in for DATA_FIX_COMMUNITY_TYPOS (community_text_patch.mjs hands in
   what it read out of the collection). */
function dataFixesChosen(ids) {
  const want = new Set(ids), out = new Set(), taken = new Set();
  for (const f of DATA_FIXES) {
    if (!want.has(f.id)) continue;
    if (f.choice) { if (taken.has(f.choice)) continue; taken.add(f.choice); }
    out.add(f.id);
  }
  return out;
}
/* Which row of the list of the text's changes an edit is (dataFixTextChanges):
   the part of the fix it came from, and its words before and after. The
   key is what a row left out is remembered by (opts.skip, below). */
function dataFixTextPart(stage, e, chosen) {
  if (stage === 'community-text') return 'community';
  if (stage === 'spelling') { const sp = DATA_FIXES.find(f => f.choice === 'spelling' && chosen.has(f.id)); return sp ? sp.id : 'spelling'; }
  return e.opt || 'text';
}
function dataFixTextKey(part, find, replace) { return part + '\u0000' + find + '\u0000' + replace; }
const DATA_FIX_TEXT_STAGES = ['text', 'community-text', 'spelling'];

function applyDataFixes(bytes, ids, opts) {
  opts = opts || {};
  const chosen = dataFixesChosen(ids);
  /* opts.skip: the keys of rows of the text's changes left out, one by one
     (the maintainer, 1 October 2026). With any left out, every other text
     edit may find nothing, since one can follow another's words (Helen's
     "weary looking" is the hyphen's only after "wearly" is mended): it is
     then dropped rather than stopping the build. A count that is found and
     wrong still stops it. */
  const skip = opts.skip && opts.skip.size ? opts.skip : null;
  const keepSyms = DVM_RESOURCE_SYMBOLS, keepCtx = dvmContextResid;
  try {
    const s = dataPatchSession(bytes);
    const ctx = { chosen, communityTypos: opts.communityTypos || null };
    for (const stage of DATA_FIX_STAGES) {
      if (opts.stages && opts.stages.indexOf(stage) < 0) continue;
      const parts = [];
      // A parent's stages run for an option chosen without it.
      for (const f of DATA_FIXES) if (chosen.has(f.id) || DATA_FIXES.some(o => o.parent === f.id && chosen.has(o.id)))
        for (const p of (f.parts || [f])) if (p.stage === stage) parts.push({ f, p });
      if (!parts.length) continue;
      // Every plan of a stage reads the file as the stage found it.
      s.listings = new Map();
      s.stage = stage;
      const all = { edits: [], dataEdits: [], textEdits: [] };
      const tag = (f, list) => (list || []).map(e => Object.assign({}, e, { fixTitle: f.title }));
      for (const { f, p } of parts) {
        let r;
        try { r = p.plan ? p.plan(s, ctx) : p; }
        catch (e) { throw new Error(f.title + '. ' + e.message); }
        all.edits.push(...tag(f, r.edits));
        all.dataEdits.push(...tag(f, r.dataEdits));
        all.textEdits.push(...tag(f, r.textEdits));
      }
      if (skip && DATA_FIX_TEXT_STAGES.indexOf(stage) >= 0)
        all.textEdits = all.textEdits.filter(e => !skip.has(dataFixTextKey(dataFixTextPart(stage, e, chosen), e.find, e.replace)))
          .map(e => Object.assign(e, { optional: true }));
      // A stage whose edits are found rather than given sorts them, each
      // resource from the highest offset down, so every one's offsets are
      // still where they were found when it is applied.
      if (DATA_FIX_STAGE_SORTED.indexOf(stage) >= 0) all.edits.sort((a, b) => a.resid - b.resid || b.at - a.at);
      applyDataEdits(s, all);
    }
    const done = finishDataPatch(s);
    done.fixes = DATA_FIXES.filter(f => chosen.has(f.id));
    return done;
  } finally {
    dvmSetResourceSymbols(keepSyms);
    dvmContextResid = keepCtx;
  }
}

/* Every change the text fix makes to a file, with the text's options
   chosen in `ids`, as the Patches section lists them under it: the edits
   applied to the file as a patch would apply them, so the community's list,
   which is found in the text as the earlier stages leave it, is what the
   patch would do and not a guess. One row an edit, in the order applied,
   under the part of the fix it came from ('text', an option's id,
   'community', or the spelling's id); an edit made in several resources (a
   word misspelt in seven, a British stem over every script) is one row with
   the resources it was made in and the places counted. Each row carries
   every place it changes, as offsets in the file given (`at`, null where a
   resource was laid out afresh; `touched` where an earlier edit wrote the
   words there), which the Patches section links to. */
function dataFixTextChanges(bytes, ids) {
  const chosen = dataFixesChosen(['text'].concat(ids || []));
  const done = applyDataFixes(bytes, [...chosen], { stages: ['text', 'community-text', 'spelling'] });
  const rows = [], byKey = new Map();
  for (const t of done.text) {
    const part = dataFixTextPart(t.stage, t, chosen);
    const key = dataFixTextKey(part, t.find, t.replace);
    let r = byKey.get(key);
    if (!r) { r = { part, key, find: t.find, replace: t.replace, resids: [], places: 0, at: [] }; byKey.set(key, r); rows.push(r); }
    if (r.resids.indexOf(t.resid) < 0) r.resids.push(t.resid);
    r.places += t.places;
    // Each place, in the open file, in the order it comes in its resource.
    for (const a of t.at.slice().sort((x, y) => x.at - y.at)) r.at.push({ resid: t.resid, at: a.at, touched: a.touched });
  }
  return rows;
}
