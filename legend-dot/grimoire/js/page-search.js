/* The search box: one query over every text the site shows.

   Until 27 October 2026 the box searched the decoded scripts alone, read a
   query with `|` or `[` in it as a pattern, offered seven preset patterns
   ("Fire" was fire|burn|flame|lava|scorch) and nine question shapes ("who
   teaches axe") that answered from a table before any text was searched.
   The maintainer asked for a plain search instead, over all the text on
   the site, the page's and the file's alike, with boolean words and
   quoted phrases, and for the examples to go. This file has three parts:
   a query language small enough to state in a placeholder, an index of
   everything a visitor can read, and the panel that shows what matched.

   THE QUERY. Words are all required, in any order and anywhere in one
   page; OR between two words or groups matches either; NOT, or a minus
   sign before a word, excludes it; "a quoted phrase" must appear as it
   is; brackets group. Matching is by substring and ignores case and the
   difference between curly and straight quotes, so `damage` finds
   TakeDamage and `don't` finds "don’t". The operators are written in
   capitals because "or" and "not" are words the game's text uses, and a
   search for a line of dialogue must not turn into logic. A bare
   0x-prefixed id still opens that resource, which no text search can do.

   THE INDEX, in three parts:
   - Names: every prop type, character, zone and terrain tile, as chips.
   - Scripts: every decoded resource's listing (buildScriptTextIndex), with
     the program's names for the syscalls beside delvmod's, a hit opening
     the script ringed at its line.
   - Pages: every tab, every detail page a gallery opens, the routine notes,
     and the Settings, Credits and opening panels. The sheets are written as
     code that draws them -- the text of the Mechanics sheet exists nowhere
     until renderMechanicsSheet runs -- so a page's text is read by drawing
     the page and reading the result (siteSearchStep). That is the crawl.

   THE CRAWL draws into the live page, because every renderer writes to
   #sheetGrid and the elements beside it by id, and none can be pointed
   elsewhere. It runs only while the search panel is open, in slices of a
   few milliseconds, with the tabs hidden and a still copy of them shown in
   their place (siteSearchCover), so the visitor never sees a page flash
   past. Until 28 October 2026 the tabs were hidden with nothing in their
   place, and the maintainer saw the page go blank under the panel; NAV_SUPPRESS leaves the
   hash and the back trail alone. When it finishes, or the panel closes,
   the view the visitor was on is drawn again from the same description the
   deep link uses (siteSearchRestore), and the next opening of the panel
   resumes where the crawl stopped. Detail pages are found by reading each
   gallery: a cell's onclick is a call of an opener, written either as text
   (`showItemDetail(12)`) or as a closure (`() => showItemDetail(e.pt)`),
   and the closures are called with the openers swapped for recorders, so
   nothing is drawn twice and no handler but an opener's ever runs.

   What the crawl cannot see: text drawn on a canvas (the World map's
   place names are found through Names instead), a fold whose contents are
   drawn only when it opens (the save's byte map, whose parts each have a
   .searchOnly line of their fields' names for it, byteMapSearchLine), and
   the World tab, which is skipped because drawing it starts the whole
   atlas for no text. */

function searchFold(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[‘’ʼ]/g, '\'').replace(/[“”]/g, '"');
}

/* A query as a tree: {op:'term', s}, {op:'and'|'or', a:[...]}, {op:'not', a}.
   Null when there is no term. Stray operators and an unclosed bracket or
   quote are forgiven rather than reported, since the box searches as the
   visitor types and every half-typed query passes through here. */
function parseSearchQuery(q) {
  const toks = [];
  const s = String(q || '');
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"' || c === '“' || c === '”') {
      let j = i + 1;
      while (j < s.length && !/["“”]/.test(s[j])) j++;
      const t = searchFold(s.slice(i + 1, j)).replace(/\s+/g, ' ').trim();
      if (t) toks.push({ t: 'term', s: t });
      i = j + 1;
      continue;
    }
    if (c === '(' || c === ')') { toks.push({ t: c }); i++; continue; }
    if (c === '-' && i + 1 < s.length && !/\s/.test(s[i + 1]) && (i === 0 || /[\s(]/.test(s[i - 1]))) { toks.push({ t: 'NOT' }); i++; continue; }
    let j = i;
    while (j < s.length && !/[\s()"“”]/.test(s[j])) j++;
    const w = s.slice(i, j);
    if (w === 'OR' || w === '|') toks.push({ t: 'OR' });
    else if (w === 'AND' || w === '&') toks.push({ t: 'AND' });
    else if (w === 'NOT') toks.push({ t: 'NOT' });
    else toks.push({ t: 'term', s: searchFold(w) });
    i = j;
  }
  let p = 0;
  const peek = () => toks[p];
  function orExpr() {
    const parts = [];
    let a = andExpr();
    if (a) parts.push(a);
    while (peek() && peek().t === 'OR') { p++; a = andExpr(); if (a) parts.push(a); }
    return parts.length > 1 ? { op: 'or', a: parts } : parts[0] || null;
  }
  function andExpr() {
    const parts = [];
    while (peek() && peek().t !== 'OR' && peek().t !== ')') {
      if (peek().t === 'AND') { p++; continue; }
      const u = unary();
      if (u) parts.push(u);
    }
    return parts.length > 1 ? { op: 'and', a: parts } : parts[0] || null;
  }
  function unary() {
    const k = toks[p++];
    if (k.t === 'NOT') { const u = peek() && peek().t !== 'OR' && peek().t !== ')' ? unary() : null; return u ? { op: 'not', a: u } : null; }
    if (k.t === '(') { const e = orExpr(); if (peek() && peek().t === ')') p++; return e; }
    if (k.t === 'term') return { op: 'term', s: k.s };
    return null;
  }
  let tree = null;
  while (p < toks.length) {
    const e = orExpr();
    if (e) tree = tree ? { op: 'and', a: [tree, e] } : e;
    if (p < toks.length) p++;   // a ')' with no '(' before it
  }
  return tree;
}
// `hay` is folded already (searchFold).
function searchMatches(node, hay) {
  if (!node) return false;
  if (node.op === 'term') return hay.includes(node.s);
  if (node.op === 'not') return !searchMatches(node.a, hay);
  if (node.op === 'and') return node.a.every(x => searchMatches(x, hay));
  return node.a.some(x => searchMatches(x, hay));
}
// The words a match is shown by: every term not under a NOT, longest first.
function searchPositives(node, out, neg) {
  out = out || [];
  if (!node) return out;
  if (node.op === 'term') { if (!neg && !out.includes(node.s)) out.push(node.s); }
  else if (node.op === 'not') searchPositives(node.a, out, !neg);
  else for (const x of node.a) searchPositives(x, out, neg);
  return out.sort((a, b) => b.length - a.length);
}
/* One line of text with the words bolded, cut to about 170 characters
   around the first of them. A folded string has the length of the string
   it came from for every character the site prints, so a position in the
   folded line is a position in the line. */
function searchSnippet(line, terms) {
  const f = searchFold(line);
  const marks = [];
  for (const t of terms) { let k = f.indexOf(t); while (k >= 0) { marks.push([k, k + t.length]); k = f.indexOf(t, k + t.length); } }
  marks.sort((a, b) => a[0] - b[0]);
  let from = 0, to = line.length;
  if (line.length > 170) {
    from = marks.length ? Math.max(0, marks[0][0] - 60) : 0;
    to = Math.min(line.length, from + 170);
  }
  let h = from > 0 ? '…' : '', at = from;
  for (const [a, b] of marks) {
    if (b <= at || a >= to) continue;
    const s = Math.max(a, at);
    h += svEsc(line.slice(at, s)) + '<b>' + svEsc(line.slice(s, Math.min(b, to))) + '</b>';
    at = Math.min(b, to);
  }
  return h + svEsc(line.slice(at, to)) + (to < line.length ? '…' : '');
}

// --- What a page shows, as lines ------------------------------------------

// The elements a view is drawn in. #navSub is left out: it is the strip of
// the leaf's other sections, the same chips on every page of the leaf.
const SITE_VIEW_ROOTS = ['navSubNote', 'resourceNav', 'singlePreview', 'artUsage', 'mapPreview', 'mapViewport',
  'textPreview', 'soundPreview', 'labelLegend', 'sheetGrid', 'output'];
// A button is not a block: a link in a sentence is a button here, and
// ending the line at it cut "Home Land King Hall at (12, 30)" into pieces.
const SITE_BLOCK_TAG = /^(DIV|P|LI|TR|H[1-6]|SECTION|PRE|BR|TABLE|DETAILS|SUMMARY|UL|OL|DT|DD|FIGCAPTION|HEADER|FOOTER|BLOCKQUOTE)$/;
const SITE_SKIP_TAG = /^(SCRIPT|STYLE|CANVAS|AUDIO|VIDEO|SELECT|TEXTAREA|SVG|IMG|INPUT)$/i;
/* The tags that sit inside a word or a sentence. Every other element is a
   cell, a chip or a label the stylesheet sets apart, and its text met the
   next one's with nothing between: a chart's bars read "Bomb200 obDiamond50
   ob", which neither search could match a word in. SITE_GAP marks such a
   boundary, and siteTextOf makes it a space only where it falls between
   two words, so "the Lockpick." and "Ake’s" stay as written. */
const SITE_PHRASE_TAG = /^(B|I|EM|STRONG|U|S|SUB|SUP|SMALL|MARK|CODE|KBD|ABBR|Q|WBR)$/;
const SITE_GAP = '\u0001';
/* The text of some elements, a line per block, folds included. Not
   innerText, which leaves out the body of a closed <details>, and every
   card on the Mechanics, Skills and Spells sheets is one. An element with
   display:none in its style attribute is left out; one hidden by the
   stylesheet is not, which is what lets the Settings and Credits panels be
   read while closed. */
function siteTextOf(els) {
  const out = [];
  let cur = '';
  const flush = () => {
    const t = cur.replace(/([^\s(\[‘“\u0001])\u0001+(?=[^\s.,;:!?)\]’”\u0001])/g, '$1 ').replace(/\u0001/g, '').replace(/\s+/g, ' ').trim();
    if (t) { if (solo) out.solo.push(out.length); out.push(t); }
    cur = '';
  };
  // The numbers in out.solo are the lines from a .searchOnly block
  // (searchSentences), which search by meaning reads one at a time
  // (meaningPieces).
  let solo = 0;
  out.solo = [];
  const walk = el => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { cur += n.nodeValue; continue; }
      if (n.nodeType !== 1 || SITE_SKIP_TAG.test(n.tagName) || n.hidden) continue;
      if (n.style && n.style.display === 'none') continue;
      const b = SITE_BLOCK_TAG.test(n.tagName), gap = !b && !SITE_PHRASE_TAG.test(n.tagName);
      const only = !!(n.classList && n.classList.contains('searchOnly'));
      if (b) flush();
      else if (n.tagName === 'TD' || n.tagName === 'TH') cur += ' ';
      else if (gap) cur += SITE_GAP;
      if (only) solo++;
      walk(n);
      if (b) flush();
      else if (gap) cur += SITE_GAP;
      if (only) solo--;
    }
  };
  for (const el of els) if (el && !(el.style && el.style.display === 'none')) { walk(el); flush(); }
  return out;
}
function siteViewElements() { return SITE_VIEW_ROOTS.map(id => document.getElementById(id)).filter(Boolean); }

// --- Sentences for the search ---------------------------------------------

/* The facts of a table, written out as sentences the visitor never sees and
   both searches read (the maintainer, 29 October 2026). Search by meaning
   matches a question against prose, and the shop table's "Sword 45 ob"
   beside a chip named Milcom has no word of buying in it, so "where can I
   buy a sword" found the sword's item pages. Each sentence is made here
   from the file, as the table beside it is. No fact is typed in, no
   sentence has anything the table lacks, and nothing of the game's is in
   the repository.

   They are drawn in a .searchOnly block, which the stylesheet hides and
   siteTextOf reads all the same, placed after the table or panel they
   restate, so a search that lands on one outlines that instead
   (searchShownFor). */
function searchSentences(lines) {
  lines = (lines || []).filter(Boolean);
  return lines.length ? '<div class="searchOnly">' + lines.map(s => '<p>' + svEsc(s) + '</p>').join('') + '</div>' : '';
}
function searchShownFor(el) {
  const hid = el && el.closest ? el.closest('.searchOnly') : null;
  return hid ? (hid.previousElementSibling || hid.parentElement) : el;
}
// "Milcom in Odemia", or the name alone for a person with no placement.
function searchPersonAt(i) {
  const d = characterDossier(i);
  if (!d) return null;
  return d.homeZone ? d.name + ' in ' + d.homeZone : d.name;
}
// "a Sword ... for 45 oboloi", or "3 Arrows ... for 5 oboloi", the plural the
// game's text uses.
function searchShopSentences(sh) {
  const out = [], seen = new Set();
  for (const s of sh.shops) {
    const who = s.character !== null ? searchPersonAt(s.character) : (labelFor(s.resid) || null);
    for (const g of s.goods) {
      // No article before a plural or a mass noun ("Ribs", "Sandals", "Bread"),
      // which LanguageTool caught as "a Ribs" (2 November 2026).
      const noArticle = (/s$/i.test(g.name) && !/ss$/i.test(g.name)) || /^(bread|cheese|fish|flax|meat)$/i.test(g.name);
      const line = 'The hero can buy ' + (g.count > 1 ? g.count + ' ' : noArticle ? '' : /^[aeiou]/i.test(g.name) ? 'an ' : 'a ') + g.name + (who ? ' from ' + who : '') + ' for ' + g.price + ' obol' + (g.price === 1 ? '' : 'oi') + '.';
      if (!seen.has(line)) { seen.add(line); out.push(line); }
    }
  }
  return out;
}
function searchTeacherSentences(tr) {
  const out = [];
  for (const t of tr.teachers) {
    const who = t.character !== null ? searchPersonAt(t.character) : (labelFor(t.resid) || null);
    for (const [id, m] of [...t.skills.entries()].sort((a, b) => a[0] - b[0])) {
      const skill = selfNameFor(0x1A00 + id);
      if (skill) out.push('The hero can learn the ' + skill + ' skill' + (who ? ' from ' + who : '') + (m ? ' up to mastery' : '') + '.');
    }
  }
  return out;
}
/* The answers in a person's talk script (0x1800 plus their number) to the
   word "job", as the conversation window shows them: the @ that marks a
   keyword dropped, and the parts a * splits into joined. The words are the
   game's, unchanged. An answer is every string up to the next keyword. A
   test after a first string that leaves its quote open splits the rest
   into versions, each the first string and one ending: Alaric's "I am keeper of the land of
   Cythera," ends "thanks to you." or "though at times I feel like a
   stranger.", by a local his script sets. */
function talkJobAnswers(i) {
  const e = dvmScriptEntry(0x1800 + i);
  if (!e) return [];
  let ops;
  try { ops = dvmOpsOf(e); } catch (err) { quiet(err, 'reading a talk script for its answer to job'); return []; }
  const RESP = /^conversation_response "([^"]*)" -> 0x[0-9A-F]+$/i;
  const clean = t => t.split('*').map(p => p.trim().replace(/^"|"$/g, '').trim()).filter(Boolean).join(' ').replace(/@/g, '');
  for (let k = 0; k < ops.length; k++) {
    const m = RESP.exec(ops[k].text);
    if (!m || !m[1].split(',').includes('job')) continue;
    let head = null, split = false;
    const ends = [];
    for (let j = k + 1; j < ops.length && j < k + 24; j++) {
      const t = ops[j].text;
      if (RESP.test(t) || /^(?:return|exit|conversation_prompt)/.test(t)) break;
      if (/^if/.test(t) && head !== null) { split = true; continue; }
      const s = /^string[^"]*("(?:[^"\\]|\\.)*")$/.exec(t);
      if (!s) continue;
      let str;
      try { str = JSON.parse(s[1]); } catch (err) { quiet(err); continue; }
      if (head === null) head = str;
      else if (split) ends.push(str);
      else head += str;
    }
    if (head === null) return [];
    // A first string that closes its quote is a whole line, and what a
    // test leads to after it is a further line (Borus's wife cutting in),
    // not an ending of it.
    if (/"\s*$/.test(head)) return [clean(head)];
    return (ends.length ? ends.slice(0, 3).map(x => head + x) : [head]).map(clean);
  }
  return [];
}
/* A person's page: their home, the places of their day, their answer to
   "job", and the goods and lessons on offer from them. The shops and
   teachers are read once a file (DERIVED.SEARCH_PEOPLE). */
function searchPersonSentences(i, d) {
  let people = DERIVED.SEARCH_PEOPLE;
  if (!people) {
    people = new Map();
    const of = c => { if (!people.has(c)) people.set(c, []); return people.get(c); };
    try { const sh = shopRules(); for (const s of sh.shops) if (s.character !== null) of(s.character).push(...searchShopSentences({ shops: [s] })); } catch (e) { quiet(e, 'reading the shops for the search'); }
    try { const tr = trainingRules(); for (const t of tr.teachers) if (t.character !== null) of(t.character).push(...searchTeacherSentences({ teachers: [t] })); } catch (e) { quiet(e, 'reading the teachers for the search'); }
    DERIVED.SEARCH_PEOPLE = people;
  }
  const out = [];
  if (d.homeZone) out.push(d.name + ' lives in ' + d.homeZone + '.');
  const places = [...new Set(d.schedule.map(e => e.where).filter(Boolean))];
  if (places.length) out.push('During the day ' + d.name + ' is in ' + (places.length > 1 ? places.slice(0, -1).join(', ') + ' and ' + places[places.length - 1] : places[0]) + '.');
  let jobs = [];
  try { jobs = talkJobAnswers(i); } catch (e) { quiet(e, 'reading a job answer for the search'); }
  if (jobs.length) out.push(d.name + '’s answer to “job” is ' + jobs.map(j => '“' + j + '”').join(' or ') + '.');
  out.push(...new Set(people.get(i) || []));
  return out;
}

// "Components › Text › Labels", and the section after it when the leaf
// has several.
function siteCategoryTitle(v) {
  const leaf = TAB_LEAF_FOR.get(v);
  let t = leaf ? tabTrail(leaf) : optionLabel(v);
  if (leaf && leaf.values && leaf.values.length > 1) {
    const full = optionLabel(v);
    const m = /^(.*?)\s*\((0x[0-9A-Fa-f]+x*)\)\s*$/.exec(full);
    t += ' › ' + ((m ? m[1] : full).replace(/\s+Scripts?$/, '') || full);
  }
  return t;
}

// --- The crawl ------------------------------------------------------------

const SITE_DETAIL_OPENERS = { showCharacterDetail: 'char', showPropTypeDetail: 'prop', showMonsterDetail: 'monster',
  showItemDetail: 'item', showRsrcDetail: 'rsrc', showMacRsrcDetail: 'macrsrc' };
function siteDetailId(kind, args) {
  if (kind === 'rsrc') return args[0] + ':' + args[1];
  if (kind === 'macrsrc') return (args[2] ? args[2] + ':' : '') + args[0] + ':' + args[1];
  return args[0];
}
/* Every detail page the open view links to, as deep-link ids ("item:12").
   An onclick written as text is read, never run; one that is a closure is
   run only when its source is a bare call of an opener, and with the
   openers swapped for recorders while it runs. */
function siteDetailsOnView() {
  const found = new Map();
  const grid = document.getElementById('sheetGrid');
  if (!grid || !grid.querySelectorAll) return [];
  const names = Object.keys(SITE_DETAIL_OPENERS);
  const textRe = new RegExp('\\b(' + names.join('|') + ')\\(([^()]*)\\)', 'g');
  const closureRe = new RegExp('^\\(\\)\\s*=>\\s*(' + names.join('|') + ')\\(');
  const closures = [];
  for (const el of grid.querySelectorAll('*')) {
    const attr = el.getAttribute && el.getAttribute('onclick');
    if (attr) {
      for (const m of attr.matchAll(textRe)) {
        let args = null;
        try { args = JSON.parse('[' + m[2].replace(/'/g, '"') + ']'); } catch (e) { args = null; }
        if (args && args.length && args.every(a => typeof a === 'number' || typeof a === 'string')) {
          const kind = SITE_DETAIL_OPENERS[m[1]];
          found.set(kind + ':' + siteDetailId(kind, args), true);
        }
      }
    } else if (typeof el.onclick === 'function' && closureRe.test(String(el.onclick))) closures.push(el.onclick);
  }
  if (closures.length) {
    const kept = {};
    for (const n of names) {
      kept[n] = window[n];
      window[n] = (...args) => { found.set(SITE_DETAIL_OPENERS[n] + ':' + siteDetailId(SITE_DETAIL_OPENERS[n], args), true); };
    }
    try { for (const f of closures) { try { f(); } catch (e) { quiet(e, 'reading a gallery cell for the search'); } } }
    finally { for (const n of names) window[n] = kept[n]; }
  }
  return [...found.keys()];
}

// A detail page's name in the results: what the page is about, since its
// first line is a back button ("All units").
function siteDetailTitle(kind, id) {
  let name = null;
  try {
    if (kind === 'char') name = characterName(+id);
    else if (kind === 'item' || kind === 'prop') name = propDisplayName(+id) || 'prop type 0x' + (+id).toString(16).toUpperCase();
    else if (kind === 'monster') { const r = parseMonsterStats()[+id]; name = r && (propDisplayName(r.proptype) || 'unit ' + id); }
    else name = String(id).split(':').slice(-2).join(' ');
  } catch (e) { quiet(e, 'naming a page for the search'); }
  return name || kind + ' ' + id;
}

/* The index of pages, on DERIVED so a different file (or an edit's rebuild)
   starts it again. `jobs` is the crawl's queue: every tab first, then the
   detail pages their galleries led to, so the count the panel shows stops
   growing after the tabs (a few seconds) rather than at the last gallery.
   A detail's tab is opened again before it when another tab is open. */
function siteSearchState() {
  if (DERIVED.SITE_SEARCH) return DERIVED.SITE_SEARCH;
  const S = { pages: [], jobs: [], next: 0, keys: new Set(), texts: new Set(), standing: null, done: false };
  const add = (title, trail, lines, open) => {
    const sig = lines.join('\n');
    if (!sig || S.texts.has(sig)) return;
    S.texts.add(sig);
    S.pages.push({ title, trail, lines, open, solo: lines.solo && lines.solo.length ? lines.solo : undefined, hay: searchFold(title + '\n' + sig) });
  };
  S.add = add;
  // The panels written into index.html, read without being opened.
  for (const [id, title, open] of [['archiveMenu', 'Settings', 'toggleArchiveMenu'], ['creditsMenu', 'Credits', 'toggleCredits'], ['landingGate', 'Grimoire', null]]) {
    const el = document.getElementById(id);
    if (el) add(title, '', siteTextOf([el]), { panel: open });
  }
  // The line under the tabs as the file opened ("Title: Cythera: Fate of
  // Alaric, ..."), which the first tab drawn replaces, so no crawl sees it.
  if (DERIVED.OPENED_LINE) add('Open File', '', [DERIVED.OPENED_LINE], { panel: null });
  // What each routine of the program does, from ROUTINE_NOTES.
  try {
    if (typeof ROUTINE_NOTES !== 'undefined' && appPef())
      for (const cls of Object.keys(ROUTINE_NOTES))
        for (const r of ROUTINE_NOTES[cls].routines)
          add(r.name, 'Data › Cythera (App) › Data Fork', r.text.split('\n'), { exe: r.entry });
  } catch (e) { quiet(e, 'the routine notes for the search'); }
  // Every tab but the World and MECHANICS, the whole Mechanics sheet at
  // once, which no tab shows: its six groups are tabs and are read as such.
  const sel = document.getElementById('categorySelect');
  for (const o of (sel ? Array.from(sel.options) : []))
    if (o.value && o.value !== 'WORLD' && o.value !== 'MECHANICS' && !S.keys.has('c:' + o.value)) { S.keys.add('c:' + o.value); S.jobs.push({ c: o.value }); }
  return (DERIVED.SITE_SEARCH = S);
}

// The view the visitor is on, in the form applyDeepLink reads.
function siteStandingView() {
  const cat = document.getElementById('categorySelect');
  const q = cat && cat.value ? { c: cat.value } : null;
  if (q) {
    const d = window.DETAIL_VIEW;
    if (d && DETAIL_OPENERS[d.kind]) q.d = d.kind + ':' + d.id;
    try { const r = currentMode === 'single' ? currentSelectedResid() : null; if (r != null) q.r = r.toString(16).toUpperCase(); } catch (e) { quiet(e); }
  }
  return { q, y: window.scrollY || 0, trail: (window.VIEW_TRAIL || []).slice(), pef: window.PEF_VIEW || null };
}
function siteSearchRestore(S) {
  const st = S.standing;
  S.standing = null;
  siteSearchCover(false);
  if (!st) return;
  const wrap = document.getElementById('searchWrap');
  const open = wrap && wrap.style.display !== 'none';
  window.PEF_VIEW = st.pef;
  window.NAV_SUPPRESS = true;
  try { if (st.q) applyDeepLink(st.q); } catch (e) { quiet(e, 'drawing the view again after the search read the pages'); }
  window.NAV_SUPPRESS = false;
  window.VIEW_TRAIL = st.trail;
  if (open && wrap) wrap.style.display = 'block';
  siteSearchKeepScroll(st.y);
}
/* Where the visitor had scrolled to, put back. Drawing a tab scrolls the
   window to the top, which under the still copy showed as the page jumping
   on a phone; the view drawn again may also grow after this task, so the
   scroll is tried again for a moment until the window is there. */
function siteSearchKeepScroll(y) {
  // Stops when a result is opened meanwhile, which scrolls to its line.
  const gen = _siteScrollGen;
  const go = tries => {
    if (gen !== _siteScrollGen) return;
    try { window.scrollTo(0, y); } catch (e) { quiet(e); return; }
    if (tries > 0 && Math.abs((window.scrollY || 0) - y) > 2) setTimeout(() => go(tries - 1), 60);
  };
  go(10);
}

/* The still copy shown while the pages are read: the tabs and the sheet
   cloned, each canvas painted from the one it copies (a clone of a canvas
   is blank), put after the real ones so that getElementById still finds the
   real element first, and inert. The real ones are hidden until the crawl
   stops. */
function siteSearchCover(on) {
  const real = document.getElementById('tabShell');
  const old = document.querySelector('[data-site-cover]');
  if (old) old.remove();
  if (!real) return;
  if (!on) { real.classList.remove('siteHidden'); return; }
  const shot = real.cloneNode(true);
  shot.setAttribute('data-site-cover', '');
  shot.inert = true;
  const from = real.querySelectorAll('canvas'), to = shot.querySelectorAll('canvas');
  for (let k = 0; k < from.length && k < to.length; k++) {
    try {
      to[k].width = from[k].width; to[k].height = from[k].height;
      if (from[k].width && from[k].height) to[k].getContext('2d').drawImage(from[k], 0, 0);
    } catch (e) { quiet(e, 'copying a canvas for the search’s still page'); }
  }
  real.after(shot);
  real.classList.add('siteHidden');
}

/* One job: draw it, read it, and for a tab queue the details its gallery
   opens. The program's tabs fetch the program when it is not open
   (loadApplicationFork), and reading a page must never start a download,
   so the loader is a no-op while the page is drawn. */
function siteSearchStep(S, job) {
  const wrap = document.getElementById('searchWrap');
  const wasOpen = wrap && wrap.style.display !== 'none';
  const loader = window.loadApplicationFork;
  window.loadApplicationFork = () => null;
  window.NAV_SUPPRESS = true;
  try {
    if (job.d) {
      const [kind, ...rest] = job.d.split(':');
      const id = rest.join(':');
      const sel = document.getElementById('categorySelect');
      if (sel && sel.value !== job.c) showCategory(job.c);
      DETAIL_OPENERS[kind](STRING_DETAIL_IDS.has(kind) ? id : parseInt(id, 10));
      S.add(siteDetailTitle(kind, id), siteCategoryTitle(job.c), siteTextOf(siteViewElements()), { c: job.c, d: job.d });
    } else {
      showCategory(job.c);
      S.add(siteCategoryTitle(job.c), '', siteTextOf(siteViewElements()), { c: job.c });
      const more = siteDetailsOnView().filter(d => !S.keys.has('d:' + d)).map(d => { S.keys.add('d:' + d); return { c: job.c, d }; });
      S.jobs.push(...more);
    }
  } catch (e) { quiet(e, 'reading a page for the search'); }
  window.loadApplicationFork = loader;
  window.NAV_SUPPRESS = false;
  // showCategory closes the panel; the crawl is not a navigation.
  if (wasOpen && wrap) wrap.style.display = 'block';
}

/* The pages read, kept in the browser (IndexedDB) so the reading happens
   once per file: on a phone it is some 40 seconds, which the maintainer
   paid on every visit until 28 October 2026. One record, replaced
   whenever a different key is written. The key is everything a page's
   text depends on: the site's version, the data file's bytes (an edit
   rebuilds them, so an edited file is read again), the program's forks
   when the program is open, whether an installer is open, and the switch
   for names from outside the game's text. A 32-bit FNV-1a over the bytes
   distinguishes two files well enough here and works from file://, where
   crypto.subtle is missing. */
const SEARCH_DB = 'grimoire-search', SEARCH_STORE = 'pages', SEARCH_KEY = 'current';
function siteSearchHash(bytes, h) {
  h = h === undefined ? 0x811c9dc5 : h;
  if (!bytes) return h;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193);
  return h >>> 0;
}
function siteSearchKey() {
  let h = siteSearchHash(ARCHIVE.bytes);
  h = siteSearchHash(window.APP_RSRC_RAW, h);
  h = siteSearchHash(window.APP_DATA, h);
  return [GRIMOIRE_VERSION, h.toString(16), ARCHIVE.bytes.length, window.APP_RSRC_RAW ? 'app' : '',
    window.INSTALLER ? 'installer' : '', window.SHOW_BUILTIN_LABELS ? 'labels' : ''].join('|');
}
function siteSearchDb(mode, fn) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(SEARCH_DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore(SEARCH_STORE);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(SEARCH_STORE, mode);
      const r = fn(tx.objectStore(SEARCH_STORE));
      // Settled when the transaction commits, not when the request
      // succeeds: the hidden reader's frame is removed on the message that
      // follows a write, and a frame unloaded before the commit loses it.
      r.onerror = () => reject(r.error);
      tx.onabort = () => reject(tx.error || new Error('the browser ended the transaction before it committed'));
      tx.oncomplete = () => { db.close(); resolve(r.result); };
    };
  });
}
// Starts the reading from the copy kept in the browser when it matches,
// else from the first page; until it is known which, nothing is drawn.
function siteSearchFromCache(S, onMiss) {
  S.cache = 'checking';
  try { S.key = siteSearchKey(); } catch (e) { quiet(e, 'the key of the search’s kept pages'); S.key = null; }
  const go = () => {
    if (onMiss) onMiss();
    if (!_siteSearchTimer) _siteSearchTimer = setTimeout(siteSearchRun, 0);
  };
  if (!S.key || typeof indexedDB === 'undefined') { S.cache = 'miss'; go(); return; }
  siteSearchDb('readonly', s => s.get(SEARCH_KEY)).then(rec => {
    if (DERIVED.SITE_SEARCH !== S) return;
    if (rec && rec.key === S.key && Array.isArray(rec.pages)) {
      S.pages = rec.pages.map(p => Object.assign({}, p, { hay: searchFold(p.title + '\n' + p.lines.join('\n')) }));
      S.done = true; S.cache = 'hit';
      if (SEARCH_CRAWL) searchCrawlTell({ done: true, key: S.key });
      drawSearchResults();
    } else { S.cache = 'miss'; go(); }
  }).catch(e => { quiet(e, 'reading the search’s kept pages'); S.cache = 'miss'; go(); });
}
function siteSearchToCache(S) {
  if (!S.key || typeof indexedDB === 'undefined') { if (SEARCH_CRAWL) searchCrawlTell({ failed: 'nowhere to store the pages' }); return; }
  const pages = S.pages.map(p => ({ title: p.title, trail: p.trail, lines: p.lines, open: p.open, solo: p.solo }));
  siteSearchDb('readwrite', s => s.put({ key: S.key, pages }, SEARCH_KEY))
    .then(() => { if (SEARCH_CRAWL) searchCrawlTell({ done: true, key: S.key }); })
    .catch(e => { quiet(e, 'keeping the search’s pages'); if (SEARCH_CRAWL) searchCrawlTell({ failed: 'the pages were not stored' }); });
}

/* Read the pages for a few milliseconds, then yield to the browser. Runs
   only while the panel is open; siteSearchPause puts the view back. */
let _siteSearchTimer = null, _siteSearchDrawn = 0;
function siteSearchRun() {
  _siteSearchTimer = null;
  if (!ARCHIVE) return;
  const S = siteSearchState();
  const wrap = document.getElementById('searchWrap');
  if (S.done || !wrap || wrap.style.display === 'none') return;
  if (!S.cache) { siteSearchFromCache(S); drawSearchResults(); return; }
  if (S.cache === 'checking') return;
  // The hidden frame is reading the pages, and its message ends the wait.
  if (_searchFrame) { drawSearchResults(); return; }
  /* Over http(s) the hidden frame reads the pages even when the panel is
     open first, as it does when the panel opens after the file. Reading
     them here draws every tab under the still copy, and closing the panel
     draws the view again (siteSearchRestore). On the maintainer's phone
     (5 November 2026) that redraw, the World tab's whole atlas among
     them, showed as the page loading its data again and again while search
     by meaning loaded. The page reads the pages itself only from file://,
     or after a frame gave up (S.frameGaveUp). */
  if (!SEARCH_CRAWL && !S.frameGaveUp && /^https?:$/.test(location.protocol) && typeof indexedDB !== 'undefined') {
    searchCrawlInFrame(S);
    drawSearchResults();
    return;
  }
  /* In the frame, a step waits while the visitor is using the page: the
     frame shares the page's thread, and one tab's drawing can hold it for
     up to a second (measured in headless Chrome), which a drag or a scroll
     would feel. */
  if (SEARCH_CRAWL) {
    let busy = 0;
    try { busy = window.parent._searchInputAt || 0; } catch (e) { quiet(e); }
    if (Date.now() - busy < SEARCH_FRAME_IDLE) { _siteSearchTimer = setTimeout(siteSearchRun, 400); return; }
  }
  if (!S.standing) { S.standing = siteStandingView(); siteSearchCover(true); }
  const until = performance.now() + 30;
  while (S.next < S.jobs.length && performance.now() < until) siteSearchStep(S, S.jobs[S.next++]);
  if (S.standing) try { window.scrollTo(0, S.standing.y); } catch (e) { quiet(e); }
  // Done, the still copy stays until the panel closes (siteSearchPause):
  // drawing the real page again under the open panel made it jump.
  if (S.next >= S.jobs.length) { S.done = true; siteSearchToCache(S); }
  const now = performance.now();
  if (S.done || now - _siteSearchDrawn > 250) {
    _siteSearchDrawn = now;
    drawSearchResults();
    if (SEARCH_CRAWL && !S.done) searchCrawlTell({ next: S.next, total: S.jobs.length });
  }
  if (!S.done) _siteSearchTimer = setTimeout(siteSearchRun, 0);
}
function siteSearchPause() {
  if (_siteSearchTimer) { clearTimeout(_siteSearchTimer); _siteSearchTimer = null; }
  // ARCHIVE, not window.ARCHIVE: it is a top-level `let`, which is no
  // property of window, and reading it that way left the page hidden under
  // its still copy whenever the search closed before the reading was done.
  const S = ARCHIVE && DERIVED.SITE_SEARCH;
  if (S && S.standing) siteSearchRestore(S);
}

// --- The panel ------------------------------------------------------------

function openSearch() {
  const w = document.getElementById('searchWrap');
  if (!w) return;
  w.style.display = 'block';
  const box = document.getElementById('searchBox');
  if (box) box.focus();
  const meaning = document.getElementById('chkMeaning');
  if (meaning) meaning.checked = !!window.SEARCH_MEANING;
  if (ARCHIVE && !_siteSearchTimer) _siteSearchTimer = setTimeout(siteSearchRun, 0);
  // A reading by meaning stopped when the panel closed goes on.
  if (ARCHIVE && window.SEARCH_MEANING && DERIVED.SITE_SEARCH && DERIVED.SITE_SEARCH.done) drawSearchResults();
}
function closeSearch() {
  const w = document.getElementById('searchWrap');
  if (w) w.style.display = 'none';
  siteSearchPause();
}
/* The search opened on a query, from a link elsewhere on the page: a count
   in a sentence opens the list it counted ("49 spells" is the scripts that
   call CastSpell). After the click that asked for it, since a click outside
   the panel closes it, and with the page at the top, where the panel is. */
function searchFor(q) {
  setTimeout(() => {
    closeTopPanels();
    openSearch();
    const box = document.getElementById('searchBox');
    if (box) box.value = q;
    runSearch();
    try { window.scrollTo(0, 0); } catch (e) { quiet(e); }
  }, 0);
}

let _searchTimer = null;
function queueSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(runSearch, 220);
}
// The scripts' text folded once, with the program's names for the
// syscalls beside delvmod's, so either finds a line.
function scriptSearchHay() {
  if (DERIVED.SCRIPT_HAY) return DERIVED.SCRIPT_HAY;
  return (DERIVED.SCRIPT_HAY = buildScriptTextIndex().map(e => {
    const shown = dvmShowSyscalls(e.text, true);
    return searchFold(shown === e.text ? e.text : e.text + '\n' + shown);
  }));
}

window.SEARCH_ALL = false;
function runSearch() {
  window.SEARCH_ALL = false;
  const q = document.getElementById('searchBox').value.trim();
  const host = document.getElementById('searchResults');
  if (!host) return;
  if (!q) { host.innerHTML = ''; drawSearchResults(); return; }
  // A 0x-prefixed id opens that resource. The prefix is required: "add",
  // "dead" and "face" are hex and words a visitor might search.
  const hx = q.match(/^0x([0-9a-f]{1,4})$/i);
  if (hx) {
    const rid = parseInt(hx[1], 16);
    const name = '0x' + rid.toString(16).toUpperCase().padStart(4, '0');
    if (refExists(rid)) { host.innerHTML = '<div class="sv-note">Opening resource ' + name + '…</div>'; jumpToResource(rid); }
    else host.innerHTML = '<div class="sv-warn">No resource ' + name + ' in this file.</div>';
    return;
  }
  host.innerHTML = '<div class="sv-note">Searching…</div>';
  // Yield once so the note paints before the first search builds the
  // scripts' index, which is the slow part.
  setTimeout(drawSearchResults, 20);
}

function drawSearchResults() {
  const box = document.getElementById('searchBox'), host = document.getElementById('searchResults');
  if (!box || !host || !ARCHIVE) return;
  const q = box.value.trim();
  if (/^0x[0-9a-f]{1,4}$/i.test(q)) return;
  // Until every page is read the panel shows how far the reading has got
  // and no results, since a list of some of the matches reads as the whole
  // of them.
  const S = siteSearchState();
  if (!S.done) {
    const next = S.frame ? S.frame.next : S.next, total = S.frame ? S.frame.total : S.jobs.length;
    host.innerHTML = '<div class="sv-note">' + (S.cache === 'miss' && next
      ? 'Reading the site’s pages (' + next + ' of ' + total + '). Results appear when the reading finishes. This happens once for each file opened.'
      : 'Loading the search…') + '</div>';
    return;
  }
  if (window.SEARCH_MEANING) { drawMeaningResults(q, S, host); return; }
  if (!q) return;
  const tree = parseSearchQuery(q);
  if (!tree) { host.innerHTML = ''; return; }
  const terms = searchPositives(tree);
  const cap = window.SEARCH_ALL ? Infinity : 40;
  let h = '';
  let things = '';
  try { things = namedThingsMatching(name => searchMatches(tree, searchFold(name))); } catch (e) { quiet(e); }
  h += things;
  // Pages, a page whose title matches first.
  const titled = p => terms.some(t => searchFold(p.title).includes(t)) ? 1 : 0;
  const pages = S.pages.filter(p => searchMatches(tree, p.hay)).sort((a, b) => titled(b) - titled(a));
  h += '<div class="partsTitle sr-head">Pages: ' + pages.length + '</div>';
  for (const p of pages.slice(0, cap)) {
    const i = S.pages.indexOf(p);
    // Each line shown is a link to that line on the page, as a script's
    // lines are; the title opens the page at the first of them.
    const ks = searchCoveringLines(p.lines, terms, 2);
    const live = p.open.panel !== null;
    h += '<div class="sr-item">' + (live ? svLink(p.title, 'openSearchPage(' + i + ',' + (ks.length ? ks[0] : -1) + ')')
        : '<span class="sr-title">' + svEsc(p.title) + '</span>') +
      (p.trail ? ' <span class="sr-where">' + svEsc(p.trail) + '</span>' : '') +
      (ks.length ? '<div class="sr-text">' + ks.map(k => live
        ? '<div><a class="srLine" onclick="openSearchPage(' + i + ',' + k + ')">' + searchSnippet(p.lines[k], terms) + '</a></div>'
        : '<div>' + searchSnippet(p.lines[k], terms) + '</div>').join('') + '</div>' : '') + '</div>';
  }
  if (pages.length > cap) h += '<div class="sv-note">' + (pages.length - cap) + ' more pages. ' + svLink('Show all', 'searchShowAll()') + '</div>';
  // Scripts, each with up to three of its lines, each line a link to it.
  const index = buildScriptTextIndex(), hay = scriptSearchHay();
  const hits = [];
  for (let k = 0; k < index.length; k++) if (searchMatches(tree, hay[k])) hits.push(k);
  h += '<div class="partsTitle sr-head">Scripts: ' + hits.length + '</div>';
  for (const k of hits.slice(0, cap)) {
    const entry = index[k];
    const purpose = SUBINDEX_PURPOSE[entry.subn];
    h += '<div class="sr-item">' + svChip(entry.resid, purpose ? purpose[0] : '') + '<div class="sr-lines">' +
      scriptSearchLines(entry, terms).map(m => {
        const l = searchSnippet(m.text, terms);
        return m.at === null ? '<div>' + l + '</div>' : '<div><a class="srLine" onclick="jumpToScriptAt(' + entry.resid + ',' + m.at + ')">' + l + '</a></div>';
      }).join('') + '</div></div>';
  }
  if (hits.length > cap) h += '<div class="sv-note">' + (hits.length - cap) + ' more scripts. ' + svLink('Show all', 'searchShowAll()') + '</div>';
  if (!things && !pages.length && !hits.length) h = '<div class="sv-note">Nothing matches.</div>';
  host.innerHTML = h;
}
function searchShowAll() { window.SEARCH_ALL = true; drawSearchResults(); }

/* SEARCH BY MEANING (the maintainer, 28 October 2026: "proper semantic
   search", with a model from a CDN, his choice over word lists). A switch
   in the panel. With it on, the search matches a query by meaning: "where
   to buy swords" finds a shop's list where no line has those words.

   THE MODEL is bge-small-en-v1.5 (Xenova's ONNX copy, 8-bit, about 34 MB),
   run by transformers.js, both fetched only when the switch is first turned
   on: the library from jsDelivr (MEANING_LIB, a fixed version) and the
   model's files from Hugging Face, which the browser then caches. This is
   the one thing on the page besides the installer fetched from outside the
   repository, and nothing fetches it until the visitor turns the switch
   on; the plain search needs none of it and works from file:// and
   offline. The library is an ES module, loaded with import(), which a
   classic script may call; the page's scripts stay classic.

   THE PIECES are the pages the plain search reads (siteSearchState),
   each cut into runs of lines of about MEANING_CHUNK characters, the page's
   title before each run. A piece is turned into 384 numbers (an embedding,
   scaled to length 1), so how alike two pieces
   are is the sum of their numbers multiplied pairwise. The site's pages
   make some 6,800 pieces, about fifty minutes in headless Chrome on a
   desktop and longer on a phone, a few pieces at a time in a worker,
   and kept in IndexedDB (MEANING_DB) piece by piece (meaningBuild), so a
   later visit, a new version of the site included, reads only the pieces
   whose words changed.

   A RESULT is a piece, best first, shown as its page's title and the line
   of the piece that shares most words with the query (its first line when
   none does), a link to that line as the plain search's are. */
const MEANING_LIB = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/dist/transformers.min.js';
const MEANING_MODEL = 'Xenova/bge-small-en-v1.5';
/* bge-small reads a piece from its first token (CLS pooling) and expects a
   query to start with MEANING_QUERY, the words its makers trained it with,
   ending in a colon (built from its code, 58, so the wording scan reads no
   sentence break). On twelve plain questions about the game
   (work/meaningkeep/quality2.mjs in the workspace) it found the right page
   for about five, where all-MiniLM-L6-v2, the model until 29 October 2026,
   found three. It is about twice as slow to read the pieces. */
const MEANING_POOL = 'cls';
const MEANING_QUERY = 'Represent this sentence for searching relevant passages' + String.fromCharCode(58) + ' ';
const MEANING_CHUNK = 500, MEANING_DIM = 384, MEANING_BATCH = 8, MEANING_SHOWN = 30;
const MEANING_DB = 'grimoire-meaning';
window.SEARCH_MEANING = false;
try { window.SEARCH_MEANING = !SEARCH_CRAWL && localStorage.getItem('cythera.searchMeaning') === '1'; } catch (e) { quiet(e); }
const _meaning = { extractor: null, loading: null, error: null, progress: '', vecs: null, pieces: null, key: null, building: false, gen: 0 };
function setSearchMeaning(on) {
  window.SEARCH_MEANING = !!on;
  try { localStorage.setItem('cythera.searchMeaning', on ? '1' : '0'); } catch (e) { quiet(e); }
  const box = document.getElementById('chkMeaning');
  if (box) box.checked = !!on;
  drawSearchResults();
}
/* The model runs in a worker, so its start (some seconds of compiling after
   the download reaches 100 percent, which held the page still) and each
   batch of pieces leave the page free to scroll and click. The worker is a
   module made from MEANING_WORKER as a blob, which the page's scripts can
   start while staying classic. Where a browser has no module workers, or
   the library fails to load inside one (a page opened from file:// in some
   browsers), the model runs on the page instead. */
const MEANING_WORKER = `
let ready = null;
const load = m => ready || (ready = import(m.lib).then(T => {
  T.env.allowLocalModels = false;
  return T.pipeline('feature-extraction', m.model, { dtype: 'q8', progress_callback: p => {
    if (p && p.status === 'progress' && p.total) self.postMessage({ progress: p.loaded / p.total });
  } });
}));
let sorter = null;
const loadSorter = m => sorter || (sorter = import(m.lib).then(async T => {
  T.env.allowLocalModels = false;
  return [await T.AutoTokenizer.from_pretrained(m.rerank), await T.AutoModelForSequenceClassification.from_pretrained(m.rerank, { dtype: 'q8' })];
}));
self.onmessage = async e => {
  const m = e.data;
  if (m.rerank) {
    try {
      const [tok, model] = await loadSorter(m);
      const inp = tok(new Array(m.docs.length).fill(m.query), { text_pair: m.docs, padding: true, truncation: true, max_length: m.max });
      const data = new Float32Array((await model(inp)).logits.data);
      self.postMessage({ id: m.id, data }, [data.buffer]);
    } catch (err) { sorter = null; self.postMessage({ id: m.id, error: String((err && err.message) || err) }); }
    return;
  }
  try {
    const ex = await load(m);
    if (!m.texts) { self.postMessage({ id: m.id, ready: true }); return; }
    const out = await ex(m.texts, { pooling: m.pool, normalize: true });
    const data = new Float32Array(out.data);
    self.postMessage({ id: m.id, data }, [data.buffer]);
  } catch (err) { ready = null; self.postMessage({ id: m.id, error: String((err && err.message) || err) }); }
};`;
// The download's figure, then a line for the start that follows it.
function meaningProgress(f) {
  _meaning.progress = f >= 1 ? 'Starting the model…' : 'Downloading the model (' + Math.round(100 * f) + ' percent).';
  drawMeaningNote();
}
function meaningWorker() {
  if (_meaning.worker !== undefined) return _meaning.worker;
  _meaning.worker = null;
  if (typeof Worker === 'undefined' || typeof Blob === 'undefined') return null;
  try {
    const w = new Worker(URL.createObjectURL(new Blob([MEANING_WORKER], { type: 'text/javascript' })), { type: 'module' });
    _meaning.calls = new Map(); _meaning.callN = 0;
    w.onmessage = e => {
      const m = e.data;
      if (m.id == null) { if (m.progress != null) meaningProgress(m.progress); return; }
      const call = _meaning.calls.get(m.id);
      if (!call) return;
      _meaning.calls.delete(m.id);
      if (m.error) call.reject(new Error(m.error)); else call.resolve(m.data || true);
    };
    w.onerror = e => {
      quiet(e, 'the worker for search by meaning');
      for (const c of _meaning.calls.values()) c.reject(new Error(e.message || 'the worker stopped'));
      _meaning.calls.clear();
    };
    _meaning.worker = w;
  } catch (e) { quiet(e, 'starting a worker for search by meaning'); }
  return _meaning.worker;
}
function meaningAsk(texts) {
  const w = _meaning.worker;
  return new Promise((resolve, reject) => {
    const id = ++_meaning.callN;
    _meaning.calls.set(id, { resolve, reject });
    w.postMessage({ id, lib: MEANING_LIB, model: MEANING_MODEL, pool: MEANING_POOL, texts });
  });
}
function meaningOnPage() {
  return import(MEANING_LIB).then(T => {
    T.env.allowLocalModels = false;
    return T.pipeline('feature-extraction', MEANING_MODEL, { dtype: 'q8', progress_callback: p => {
      if (p && p.status === 'progress' && p.total) meaningProgress(p.loaded / p.total);
    } });
  });
}
function meaningModel() {
  if (_meaning.extractor) return Promise.resolve(_meaning.extractor);
  if (!_meaning.loading) {
    _meaning.error = null;
    const viaWorker = meaningWorker()
      ? meaningAsk(null).then(() => 'worker', e => {
        quiet(e, 'loading the model in a worker');
        try { _meaning.worker.terminate(); } catch (e2) { quiet(e2); }
        _meaning.worker = null;
        return meaningOnPage();
      })
      : meaningOnPage();
    _meaning.loading = viaWorker.then(x => { _meaning.extractor = x; _meaning.progress = ''; return x; },
      e => { _meaning.error = e; _meaning.loading = null; _meaning.progress = ''; quiet(e, 'loading the model for search by meaning'); throw e; });
  }
  return _meaning.loading;
}
async function meaningEmbed(texts) {
  const ex = await meaningModel();
  if (ex === 'worker') return meaningAsk(texts);
  const out = await ex(texts, { pooling: MEANING_POOL, normalize: true });
  return out.data;
}
/* THE SECOND SORT. A cross-encoder (MEANING_RERANK) reads the query and a
   piece together and gives one score, where the embedding model reads each
   alone. The joint reading separates a piece that answers "where can I buy
   a sword" from a page that only mentions swords. It is too slow for every
   piece, so it scores the first MEANING_RERANK_TOP the embeddings found,
   each cut to MEANING_RERANK_LEN tokens. On the twelve questions
   (work/meaningsentences/rerank.mjs in the workspace) it put the right
   piece first for the sword, Alaric's cure, combat damage and the amulet,
   in about 1.6 seconds a query in headless Chrome. 30 pieces of up to 512
   tokens took 3 to 13 seconds and sorted no better. The results are drawn
   before it runs and drawn again after, in the order of its scores. A
   score is a logit, below 0 for a piece unlikely to answer. */
const MEANING_RERANK = 'Xenova/ms-marco-MiniLM-L-6-v2', MEANING_RERANK_TOP = 20, MEANING_RERANK_LEN = 128;
async function meaningRerank(query, docs) {
  const ex = await meaningModel();
  if (ex === 'worker') {
    const w = _meaning.worker;
    return new Promise((resolve, reject) => {
      const id = ++_meaning.callN;
      _meaning.calls.set(id, { resolve, reject });
      w.postMessage({ id, lib: MEANING_LIB, rerank: MEANING_RERANK, query, docs, max: MEANING_RERANK_LEN });
    });
  }
  if (!_meaning.sorter) _meaning.sorter = import(MEANING_LIB).then(async T => [await T.AutoTokenizer.from_pretrained(MEANING_RERANK),
    await T.AutoModelForSequenceClassification.from_pretrained(MEANING_RERANK, { dtype: 'q8' })]);
  const [tok, model] = await _meaning.sorter;
  const inp = tok(new Array(docs.length).fill(query), { text_pair: docs, padding: true, truncation: true, max_length: MEANING_RERANK_LEN });
  return (await model(inp)).logits.data;
}
function meaningPieces(S) {
  const pieces = [];
  S.pages.forEach((p, i) => {
    let text = '', k0 = -1;
    const push = () => { if (text) pieces.push({ i, k: k0, text: p.title + '. ' + text }); text = ''; k0 = -1; };
    const solo = new Set(p.solo || []);
    p.lines.forEach((l, k) => {
      // A sentence written for the search is one piece, alone, so a
      // question meets one fact and not a run of a dozen.
      if (solo.has(k)) { push(); pieces.push({ i, k, text: p.title + '. ' + l }); return; }
      if (k0 < 0) k0 = k;
      text += (text ? ' ' : '') + l;
      if (text.length >= MEANING_CHUNK) push();
    });
    push();
  });
  return pieces;
}
function meaningDb(mode, fn) {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(MEANING_DB, 1); } catch (e) { reject(e); return; }
    req.onupgradeneeded = () => req.result.createObjectStore('vectors');
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
    req.onsuccess = () => {
      const db = req.result, tx = db.transaction('vectors', mode), r = fn(tx.objectStore('vectors'));
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      tx.oncomplete = () => db.close();
    };
  });
}
/* THE PREBUILT SET (the maintainer, 28 October 2026, who agreed to publish
   numbers made from the game's text). js/meaning-prebuilt.js has the
   embeddings of the pieces of the default file, the archive.org installers,
   as utilities/meaning_prebuild.mjs made them in headless Chrome: each
   piece's numbers under a 64-bit hash of its text, not the text, so no game
   text is in the repository. The numbers are cut to 8 bits, each piece
   with a scale (its largest number over 127), which leaves the order of a
   search's results as it was and makes the file about a megabyte. A
   classic script, loaded by a script tag only when the switch is on,
   because a fetch of a data file fails from file://. A piece whose text
   changed since the set was made has no match and goes to the model as
   before, so the set can lag the site by some versions and still save most
   of the reading. */
const MEANING_PREBUILT_SRC = 'js/meaning-prebuilt.js';
// Two 32-bit FNV-1a hashes of the text's UTF-16 units, from two starts.
function meaningHash(text) {
  let a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 15);
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}
function meaningBase64(s) {
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function meaningPrebuilt() {
  if (_meaning.prebuilt !== undefined) return _meaning.prebuilt;
  _meaning.prebuilt = new Promise(resolve => {
    const use = () => {
      const P = window.MEANING_PREBUILT;
      if (!P || P.model !== MEANING_MODEL || P.chunk !== MEANING_CHUNK || P.dim !== MEANING_DIM) { resolve(null); return; }
      try {
        const vecs = new Int8Array(meaningBase64(P.vecs).buffer), scales = new Float32Array(meaningBase64(P.scales).buffer), at = new Map();
        for (let n = 0; n * 16 < P.ids.length; n++) at.set(P.ids.slice(n * 16, n * 16 + 16), n);
        resolve({ vecs, scales, at });
      } catch (e) { quiet(e, 'reading the prebuilt embeddings'); resolve(null); }
    };
    if (window.MEANING_PREBUILT || window.MEANING_NO_PREBUILT || typeof document === 'undefined') { use(); return; }
    const s = document.createElement('script');
    s.src = MEANING_PREBUILT_SRC;
    s.onload = use;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
  return _meaning.prebuilt;
}
// Writes the prebuilt numbers of the piece with this hash at `to`, if any.
function meaningFromPrebuilt(pre, hash, out, to) {
  const n = pre.at.get(hash);
  if (n === undefined) return false;
  const s = pre.scales[n];
  for (let d = 0; d < MEANING_DIM; d++) out[to + d] = pre.vecs[n * MEANING_DIM + d] * s;
  return true;
}
/* The pieces' embeddings, made a batch at a time while the switch is on,
   the panel open or not, since the worker leaves the page free.

   Kept in IndexedDB by each piece's text, not by the file and the site's
   version. The plain search's key has GRIMOIRE_VERSION in it, so a key for
   the whole set made every release read all the pieces again, some
   minutes each time, though a release changes the words of few pages. A
   piece whose text was read before, under the same model and piece size,
   reuses its kept numbers, and only the rest go to the model. The kept
   record is the last set made, so a different file shares what its pages
   have in common with the one before (the menus, the guides) and reads
   the rest. */
async function meaningBuild(S) {
  const key = (S.key || '') + '|' + MEANING_MODEL + '|' + MEANING_CHUNK;
  const model = MEANING_MODEL + '|' + MEANING_CHUNK;
  if (_meaning.key === key && _meaning.vecs && _meaning.done) return;
  if (_meaning.building) return;
  _meaning.building = true;
  try {
    if (_meaning.key !== key) {
      const pieces = meaningPieces(S);
      _meaning.key = key; _meaning.pieces = pieces; _meaning.vecs = new Float32Array(pieces.length * MEANING_DIM);
      _meaning.todo = pieces.map((p, n) => n); _meaning.made = 0; _meaning.done = false;
      try {
        const rec = typeof indexedDB === 'undefined' ? null : await meaningDb('readonly', s => s.get('current'));
        if (rec && rec.model === model && Array.isArray(rec.texts) && rec.vecs && rec.vecs.byteLength === rec.texts.length * MEANING_DIM * 4) {
          const kept = new Float32Array(rec.vecs), at = new Map(rec.texts.map((t, n) => [t, n]));
          _meaning.todo = [];
          pieces.forEach((p, n) => {
            const k = at.get(p.text);
            if (k === undefined) _meaning.todo.push(n);
            else _meaning.vecs.set(kept.subarray(k * MEANING_DIM, (k + 1) * MEANING_DIM), n * MEANING_DIM);
          });
          _meaning.made = pieces.length - _meaning.todo.length;
        }
      } catch (e) { quiet(e, 'reading the kept embeddings'); }
      if (_meaning.todo.length) {
        const pre = await meaningPrebuilt();
        if (pre) {
          const before = _meaning.todo.length;
          _meaning.todo = _meaning.todo.filter(n => !meaningFromPrebuilt(pre, meaningHash(pieces[n].text), _meaning.vecs, n * MEANING_DIM));
          _meaning.made += before - _meaning.todo.length;
          if (_meaning.todo.length < before) _meaning.fresh = true;
        }
      }
    }
    for (;;) {
      if (!window.SEARCH_MEANING || _meaning.key !== key) return;
      const batch = _meaning.todo.slice(0, MEANING_BATCH);
      if (batch.length) {
        const data = await meaningEmbed(batch.map(n => _meaning.pieces[n].text));
        if (_meaning.key !== key) return;
        batch.forEach((n, k) => _meaning.vecs.set(data.subarray(k * MEANING_DIM, (k + 1) * MEANING_DIM), n * MEANING_DIM));
        _meaning.todo = _meaning.todo.slice(batch.length);
        _meaning.made += batch.length;
        _meaning.fresh = true;
      }
      if (!_meaning.todo.length) {
        _meaning.done = true;
        if (_meaning.fresh) try {
          _meaning.fresh = false;
          if (typeof indexedDB !== 'undefined') await meaningDb('readwrite', s => s.put({ model, texts: _meaning.pieces.map(p => p.text), vecs: _meaning.vecs.buffer.slice(0) }, 'current'));
        } catch (e) { quiet(e, 'keeping the embeddings'); }
        break;
      }
      drawMeaningNote();
    }
  } finally { _meaning.building = false; }
  drawSearchResults();
}
/* A file's opening reads the search's kept pages a moment later, the panel
   closed, so the first search finds them ready; with search by meaning on,
   the embeddings start from them too. When none are kept for this file and
   this version, a hidden copy of the page reads them (searchCrawlInFrame).
   Reading them here draws every tab under a still copy of the view, which
   the visitor would see, so the page itself does that only when the panel
   is open and no frame is reading. */
function searchWarmUp() {
  if (!ARCHIVE || SEARCH_CRAWL) return;
  // Without stored pages or a frame to read them there is nothing to start
  // ahead of the panel, unless search by meaning is on and needs its
  // embeddings. In the harnesses' DOM, which has no IndexedDB, the page
  // list (which reads the program's routines) then stays out of the middle
  // of the views smoke's map steps.
  const served = /^https?:$/.test(location.protocol) && typeof indexedDB !== 'undefined';
  if (!served && !window.SEARCH_MEANING) return;
  const S = siteSearchState();
  if (S.cache) return;
  siteSearchFromCache(S, () => searchCrawlInFrame(S));
}

/* THE HIDDEN READER (the maintainer, 28 October 2026, who chose it over
   shipping the pages, which are the game's text). A frame off the screen
   loads index.html?searchcrawl=1, which opens the file from the IndexedDB
   copy this page left (loadDefaultArchive), reads every page as the panel
   would, stores them under the search's key and posts a message. This page
   then reads them from IndexedDB as a kept copy and removes the frame. The
   frame costs a second page's memory for the reading, some seconds on a
   desktop. It runs only over http(s), where the frame shares the page's
   origin and storage. From file:// the panel reads the pages itself while
   it is open. A frame whose key differs (another file stored since), or
   that fails or goes quiet for SEARCH_FRAME_WAIT ms, is removed, and the
   panel reads the pages itself when it is next open. */
const SEARCH_FRAME_WAIT = 120000, SEARCH_FRAME_IDLE = 1500;
let _searchFrame = null;
// The time of the visitor's last touch, key or scroll, which the frame reads.
function searchNoteInput() { window._searchInputAt = Date.now(); }
/* A PAGE THE READER ENDED. The frame is a second copy of the site with the
   game open in it, and at a phone's size the two take some 0.9 to 1.3 GB
   while it reads (measured in headless Chrome, 8 November 2026). A phone
   that runs out ends the tab and loads it again, which opens the file and
   starts the frame again, round and round: the likely reading of the
   maintainer's report that day of the page reloading over and over. So
   the page notes in localStorage that the frame is reading, and clears the
   note when it finishes, gives up, or the page is left. A page that opens
   to the note finds the last one ended while the frame read, and from then
   on this browser reads the pages in the panel instead, one copy of the
   site. */
const SEARCH_FRAME_MARK = 'cythera.searchFrameReading', SEARCH_FRAME_DIED = 'cythera.searchFrameEnded';
function searchFrameMark(on) {
  try { if (on) localStorage.setItem(SEARCH_FRAME_MARK, String(Date.now())); else localStorage.removeItem(SEARCH_FRAME_MARK); }
  catch (e) { quiet(e, 'noting the search’s hidden reader'); }
}
function searchFrameDied() {
  try { return localStorage.getItem(SEARCH_FRAME_DIED) === '1'; } catch (e) { quiet(e); return false; }
}
// Once a page, before any frame starts: a note left from the last page.
if (!SEARCH_CRAWL) try {
  if (localStorage.getItem(SEARCH_FRAME_MARK)) { localStorage.setItem(SEARCH_FRAME_DIED, '1'); localStorage.removeItem(SEARCH_FRAME_MARK); }
} catch (e) { quiet(e, 'reading the search’s note of its hidden reader'); }
function searchCrawlInFrame(S) {
  if (_searchFrame || S.done || !/^https?:$/.test(location.protocol) || typeof indexedDB === 'undefined') return;
  if (searchFrameDied()) { S.frameGaveUp = true; siteSearchResume(S); return; }
  if (!window._searchInputWatched) {
    window._searchInputWatched = true;
    for (const t of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchmove', 'scroll'])
      window.addEventListener(t, searchNoteInput, { passive: true, capture: true });
  }
  const f = document.createElement('iframe');
  f.setAttribute('aria-hidden', 'true');
  f.tabIndex = -1;
  f.style.cssText = 'position:fixed;left:-20000px;top:0;width:1280px;height:900px;border:0;opacity:0;pointer-events:none';
  const end = () => {
    window.removeEventListener('message', hear);
    window.removeEventListener('pagehide', left);
    searchFrameMark(false);
    clearTimeout(f._quiet);
    f.remove();
    if (_searchFrame === f) _searchFrame = null;
    S.frame = null;
  };
  const quietFor = () => { clearTimeout(f._quiet); f._quiet = setTimeout(() => { end(); S.frameGaveUp = true; siteSearchResume(S); }, SEARCH_FRAME_WAIT); };
  const hear = e => {
    if (e.source !== f.contentWindow || !e.data || !e.data.grimoireSearch) return;
    const m = e.data.grimoireSearch;
    if (m.next !== undefined) { S.frame = { next: m.next, total: m.total }; quietFor(); drawSearchResults(); return; }
    end();
    if (m.done && m.key === S.key && DERIVED.SITE_SEARCH === S) siteSearchFromCache(S);
    else { S.frameGaveUp = true; siteSearchResume(S); }
  };
  window.addEventListener('message', hear);
  // Leaving the page is not the page ending; only an ending leaves the note.
  const left = () => searchFrameMark(false);
  window.addEventListener('pagehide', left);
  searchFrameMark(true);
  f.src = 'index.html?searchcrawl=1';
  _searchFrame = f;
  quietFor();
  document.body.appendChild(f);
}
// After the frame gave up: the panel, if open, reads the pages itself.
function siteSearchResume(S) {
  if (DERIVED.SITE_SEARCH !== S || S.done) return;
  if (!_siteSearchTimer) _siteSearchTimer = setTimeout(siteSearchRun, 0);
}
// In the frame: read the pages as the open panel would.
function searchCrawlStart() {
  if (!ARCHIVE) return;
  window.SEARCH_MEANING = false;
  openSearch();
}
function searchCrawlTell(m) {
  try { window.parent.postMessage({ grimoireSearch: m }, location.origin); } catch (e) { quiet(e, 'posting the search’s progress to the page'); }
}
function drawMeaningNote() {
  const host = document.getElementById('searchResults');
  if (!host || !window.SEARCH_MEANING || _meaning.done) return;
  const n = _meaning.pieces ? _meaning.pieces.length : 0;
  host.innerHTML = '<div class="sv-note">' + (_meaning.progress || (n
    ? 'Reading the pages for their meaning (' + _meaning.made + ' of ' + n + ' pieces). Results appear when it finishes. Later visits read only what changed.'
    : 'Loading the model for search by meaning…')) + '</div>';
}
async function drawMeaningResults(q, S, host) {
  const gen = ++_meaning.gen;
  if (_meaning.error) { host.innerHTML = '<div class="sv-warn">The page could not load the model for search by meaning (' + svEsc(_meaning.error.message || String(_meaning.error)) + '). Turn the switch off to search the words.</div>'; return; }
  if (!_meaning.done) { drawMeaningNote(); meaningBuild(S).catch(e => { _meaning.error = e; drawSearchResults(); }); return; }
  if (!q) { host.innerHTML = ''; return; }
  let qv;
  try { qv = await meaningEmbed([MEANING_QUERY + q]); } catch (e) { _meaning.error = e; drawSearchResults(); return; }
  if (gen !== _meaning.gen) return;
  const { vecs, pieces } = _meaning, scored = [];
  for (let n = 0; n < pieces.length; n++) {
    let dot = 0;
    for (let d = 0, o = n * MEANING_DIM; d < MEANING_DIM; d++) dot += vecs[o + d] * qv[d];
    scored.push([dot, n]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const shown = scored.slice(0, MEANING_SHOWN);
  meaningDrawList(q, S, host, shown, true);
  // The second sort, which redraws the list in its order unless the query
  // changed meanwhile. A failure leaves the first order.
  const top = shown.slice(0, MEANING_RERANK_TOP);
  let r;
  try { r = await meaningRerank(q, top.map(([, n]) => pieces[n].text)); } catch (e) { quiet(e, 'sorting the results of search by meaning'); return; }
  if (gen !== _meaning.gen) return;
  const sorted = top.map((x, j) => [r[j], x[1]]).sort((a, b) => b[0] - a[0]);
  meaningDrawList(q, S, host, sorted.concat(shown.slice(MEANING_RERANK_TOP)), false);
}
// The results, in the given order. The figure beside each is the
// embeddings' likeness, shown only before the second sort reorders them.
function meaningDrawList(q, S, host, list, first) {
  const { pieces } = _meaning;
  const words = searchFold(q).split(/[^a-z0-9']+/).filter(w => w.length > 2);
  let h = '<div class="partsTitle sr-head">Nearest in meaning</div>';
  for (const [score, n] of list) {
    const pc = pieces[n], p = S.pages[pc.i];
    if (!p) continue;
    // The line of the piece with most of the query's words, else its first.
    let best = pc.k, gain = 0;
    for (let k = pc.k; k < p.lines.length && k < pc.k + 40; k++) {
      if (pc.text.indexOf(p.lines[k]) < 0) break;
      const f = searchFold(p.lines[k]), g = words.filter(w => f.includes(w)).length;
      if (g > gain) { gain = g; best = k; }
    }
    const live = p.open.panel !== null;
    const line = searchSnippet(p.lines[best] || '', words);
    h += '<div class="sr-item">' + (live ? svLink(p.title, 'openSearchPage(' + pc.i + ',' + best + ')') : '<span class="sr-title">' + svEsc(p.title) + '</span>') +
      (p.trail ? ' <span class="sr-where">' + svEsc(p.trail) + '</span>' : '') + (first ? ' <span class="sr-where">' + Math.round(score * 100) + '%</span>' : '') +
      '<div class="sr-text"><div>' + (live ? '<a class="srLine" onclick="openSearchPage(' + pc.i + ',' + best + ')">' + line + '</a>' : line) + '</div></div></div>';
  }
  host.innerHTML = h;
}

/* The lines of a page to show under its title, as indexes: each one chosen for the
   searched words it adds to those already shown, first in the page on a
   tie. Every section of a unit's page has "damage", and for "lava damage"
   the second line shown must be "can move onto lava", not another damage. */
function searchCoveringLines(lines, terms, n) {
  const found = lines.map(l => { const f = searchFold(l); return terms.filter(t => f.includes(t)); });
  const out = [], seen = new Set(), used = new Set();
  while (out.length < n) {
    let best = -1, gain = 0;
    for (let k = 0; k < lines.length; k++) {
      if (used.has(k) || !found[k].length) continue;
      const g = found[k].filter(t => !seen.has(t)).length;
      if (best < 0 || g > gain) { best = k; gain = g; }
    }
    if (best < 0) break;
    used.add(best);
    found[best].forEach(t => seen.add(t));
    out.push(best);
  }
  return out;
}

/* Up to three lines of a script that have a searched word, each with the
   offset of its line, read the way listingLineFor reads the raw listing --
   the object's base from its header, the line's offset from its gutter --
   so the hit can open the script ringed there. Printed as the listing
   shows it (dvmShowSyscalls). */
function scriptSearchLines(entry, terms) {
  const out = [];
  let base = -1;
  for (const ln of entry.text.split('\n')) {
    const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(ln);
    if (h) base = parseInt(h[1], 16);
    const shown = dvmShowSyscalls(ln, true);
    const f = searchFold(ln), fs = searchFold(shown);
    if (!terms.some(t => f.includes(t) || fs.includes(t))) continue;
    const g = base >= 0 && /^  ([0-9A-F]{4})  /.exec(ln);
    out.push({ text: shown.trim(), at: g ? base + parseInt(g[1], 16) : null });
    if (out.length >= 3) break;
  }
  return out;
}

/* A page from the results: the search closes (which puts back the view
   the crawl drew over, so the back trail is the visitor's), the page is
   drawn, and the line the result showed (line k of the page as read) is
   found in it, its fold opened, scrolled to and outlined; a searched word
   is looked for instead when the line is not there. Looked for again
   twice, since a page can still be growing after it is drawn, as a gallery
   lays out its cells. */
function openSearchPage(i, k) {
  const S = DERIVED.SITE_SEARCH;
  const p = S && S.pages[i];
  if (!p) return;
  const terms = searchPositives(parseSearchQuery(document.getElementById('searchBox').value));
  const line = k >= 0 ? p.lines[k] : '';
  closeTopPanels();
  _siteScrollGen++;
  let roots = null;
  if (p.open.panel) { window[p.open.panel](); roots = [document.getElementById(p.open.panel === 'toggleCredits' ? 'creditsMenu' : 'archiveMenu')]; }
  else if (p.open.exe != null) jumpToExeAt(p.open.exe);
  else if (p.open.d) {
    const [kind, ...rest] = p.open.d.split(':');
    const id = rest.join(':');
    if (showCategory(p.open.c)) DETAIL_OPENERS[kind](STRING_DETAIL_IDS.has(kind) ? id : parseInt(id, 10));
  } else showCategory(p.open.c);
  const gen = _siteScrollGen;
  let found = null;
  const show = () => {
    if (gen !== _siteScrollGen) return;
    // Found once and still on the page, it is only kept in view.
    const el = found && document.contains(found) ? found : (found = searchShownFor(searchFindLine(line, terms, roots || siteViewElements())));
    if (!el) return;
    for (let a = el; a; a = a.parentElement) if (a.tagName === 'DETAILS') a.open = true;
    const r = el.getBoundingClientRect();
    if (r.top < 60 || r.bottom > (window.innerHeight || 800) - 20) try { el.scrollIntoView({ block: 'center' }); } catch (e) { quiet(e); }
    if (!el.classList.contains('searchFound')) {
      el.classList.add('searchFound');
      setTimeout(() => el.classList.remove('searchFound'), 4000);
    }
  };
  for (const ms of [80, 400, 1000]) setTimeout(show, ms);
}
let _siteScrollGen = 0;
/* The smallest element whose text has the line (its first 80 characters),
   else the first text with a searched word. Spaces are left out of both
   sides, since siteTextOf puts one between a table's cells and textContent
   none. */
function searchFindLine(line, terms, roots) {
  const flat = s => searchFold(s).replace(/\s+/g, '');
  const smallest = (within, want) => {
    let best = null, size = Infinity;
    for (const root of within) {
      if (!root || !root.querySelectorAll) continue;
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const t = el.textContent || '';
        if (t.length >= size || t.length < want.length) continue;
        if (flat(t).includes(want)) { best = el; size = t.length; }
      }
    }
    return best;
  };
  const want = flat(line).slice(0, 80);
  const block = want ? smallest(roots, want) : null;
  // A line read from a label and a value set apart ("Home" and "Land King
  // Hall at (19, 21)" on a dossier) is only whole in the block that has
  // both, so inside a block half as long again as the line the smallest
  // element with a searched word is outlined instead.
  if (block && flat(block.textContent || '').length <= want.length * 1.5 + 8) return block;
  // A dossier's facts are lines of one block between <br>s, so the word
  // itself is wrapped in a span to be outlined when no smaller element
  // has it.
  const within = block ? [block] : roots;
  if (document.createTreeWalker) for (const t of terms) for (const root of within) {
    if (!root) continue;
    const w = document.createTreeWalker(root, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const at = searchFold(n.nodeValue).indexOf(t);
      if (at < 0 || !n.parentNode) continue;
      const word = n.splitText(at);
      word.splitText(t.length);
      const span = document.createElement('span');
      word.parentNode.insertBefore(span, word);
      span.appendChild(word);
      return span;
    }
  }
  for (const t of terms) { const el = smallest(within, flat(t)); if (el) return el; }
  return block;
}

// Everything with a name, matched against the search: prop types (the
// items and units among them), characters, zones, terrain tiles and the
// resources this tool labels. Drawn as chips ahead of the pages.
function namedThingsMatching(test) {
  const groups = [];
  const cap = 24;
  const props = [];
  const tiles = getPropTileList();
  for (let pt = 1; pt < tiles.length && props.length < cap; pt++) {
    const nm = propDisplayName(pt);
    if (nm && test(nm)) props.push(actionChip(nm, (isInventoryItem(pt) ? 'showCategory(\'ITEMS\');showItemDetail(' : 'showCategory(\'PROPS\');showPropTypeDetail(') + pt + ')', 'prop type 0x' + pt.toString(16).toUpperCase()));
  }
  if (props.length) groups.push(['Prop types', props]);
  const chars = [];
  const table = loadCharacterTable();
  for (let i = 1; i < table.length && chars.length < cap; i++) {
    if (!characterRecord(i)) continue;
    const nm = characterName(i);
    if (nm && test(nm)) chars.push(characterChip(i));
  }
  if (chars.length) groups.push(['Characters', chars]);
  const zones = [];
  for (let z = 0; z < 256 && zones.length < cap; z++) {
    if (!refExists(0x8000 + z)) continue;
    const nm = zoneDisplayName(z);
    if (nm && test(nm)) zones.push(partChip(nm, 0x8000 + z));
  }
  if (zones.length) groups.push(['Zones', zones]);
  const tl = [];
  const seenTile = new Set();
  for (let t = 0; t < 0x1000 && tl.length < cap; t++) {
    const nm = terrainNameFor(t);
    if (!nm || seenTile.has(nm) || !test(nm)) continue;
    seenTile.add(nm);
    tl.push(actionChip(nm, 'showSpriteZoom(' + t + ', ' + JSON.stringify(nm) + ')', 'tile 0x' + t.toString(16).toUpperCase()));
  }
  if (tl.length) groups.push(['Tiles', tl]);
  if (!groups.length) return '';
  return groups.map(([t, c]) => partsStrip(t, c)).join('') + '<div style="height:8px"></div>';
}
