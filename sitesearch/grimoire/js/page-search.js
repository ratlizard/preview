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
   few milliseconds, with the tabs hidden under the panel (body.siteReading)
   so the visitor never sees a page flash past; NAV_SUPPRESS leaves the
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
   drawn only when it opens (the save's byte map), and the World tab, which
   is skipped because drawing it starts the whole atlas for no text. */

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
const SITE_BLOCK_TAG = /^(DIV|P|LI|TR|H[1-6]|SECTION|PRE|BR|TABLE|DETAILS|SUMMARY|UL|OL|DT|DD|FIGCAPTION|HEADER|FOOTER|BLOCKQUOTE|BUTTON|LABEL)$/;
const SITE_SKIP_TAG = /^(SCRIPT|STYLE|CANVAS|AUDIO|VIDEO|SELECT|TEXTAREA|SVG|IMG|INPUT)$/i;
/* The text of some elements, a line per block, folds included. Not
   innerText, which leaves out the body of a closed <details>, and every
   card on the Mechanics, Skills and Spells sheets is one. An element with
   display:none in its style attribute is left out; one hidden by the
   stylesheet is not, which is what lets the Settings and Credits panels be
   read while closed. */
function siteTextOf(els) {
  const out = [];
  let cur = '';
  const flush = () => { const t = cur.replace(/\s+/g, ' ').trim(); if (t) out.push(t); cur = ''; };
  const walk = el => {
    for (let n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3) { cur += n.nodeValue; continue; }
      if (n.nodeType !== 1 || SITE_SKIP_TAG.test(n.tagName) || n.hidden) continue;
      if (n.style && n.style.display === 'none') continue;
      const b = SITE_BLOCK_TAG.test(n.tagName);
      if (b) flush();
      else if (n.tagName === 'TD' || n.tagName === 'TH') cur += ' ';
      walk(n);
      if (b) flush();
    }
  };
  for (const el of els) if (el && !(el.style && el.style.display === 'none')) { walk(el); flush(); }
  return out;
}
function siteViewElements() { return SITE_VIEW_ROOTS.map(id => document.getElementById(id)).filter(Boolean); }

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
   starts it again. `jobs` is the crawl's queue: each tab, and each detail
   page put in right after the tab whose gallery led to it, so the tab is
   still the open one when the detail is drawn. */
function siteSearchState() {
  if (DERIVED.SITE_SEARCH) return DERIVED.SITE_SEARCH;
  const S = { pages: [], jobs: [], next: 0, keys: new Set(), texts: new Set(), standing: null, done: false };
  const add = (title, trail, lines, open) => {
    const sig = lines.join('\n');
    if (!sig || S.texts.has(sig)) return;
    S.texts.add(sig);
    S.pages.push({ title, trail, lines, open, hay: searchFold(title + '\n' + sig) });
  };
  S.add = add;
  // The panels written into index.html, read without being opened.
  for (const [id, title, open] of [['archiveMenu', 'Settings', 'toggleArchiveMenu'], ['creditsMenu', 'Credits', 'toggleCredits'], ['landingGate', 'Grimoire', null]]) {
    const el = document.getElementById(id);
    if (el) add(title, '', siteTextOf([el]), { panel: open });
  }
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
  document.body.classList.remove('siteReading');
  if (!st) return;
  const wrap = document.getElementById('searchWrap');
  const open = wrap && wrap.style.display !== 'none';
  window.PEF_VIEW = st.pef;
  window.NAV_SUPPRESS = true;
  try { if (st.q) applyDeepLink(st.q); } catch (e) { quiet(e, 'drawing the view again after the search read the pages'); }
  window.NAV_SUPPRESS = false;
  window.VIEW_TRAIL = st.trail;
  if (open && wrap) wrap.style.display = 'block';
  try { window.scrollTo(0, st.y); } catch (e) { quiet(e); }
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
      DETAIL_OPENERS[kind](STRING_DETAIL_IDS.has(kind) ? id : parseInt(id, 10));
      S.add(siteDetailTitle(kind, id), siteCategoryTitle(job.c), siteTextOf(siteViewElements()), { c: job.c, d: job.d });
    } else {
      showCategory(job.c);
      S.add(siteCategoryTitle(job.c), '', siteTextOf(siteViewElements()), { c: job.c });
      const more = siteDetailsOnView().filter(d => !S.keys.has('d:' + d)).map(d => { S.keys.add('d:' + d); return { c: job.c, d }; });
      S.jobs.splice(S.next, 0, ...more);
    }
  } catch (e) { quiet(e, 'reading a page for the search'); }
  window.loadApplicationFork = loader;
  window.NAV_SUPPRESS = false;
  // showCategory closes the panel; the crawl is not a navigation.
  if (wasOpen && wrap) wrap.style.display = 'block';
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
  if (!S.standing) { S.standing = siteStandingView(); document.body.classList.add('siteReading'); }
  const until = performance.now() + 30;
  while (S.next < S.jobs.length && performance.now() < until) siteSearchStep(S, S.jobs[S.next++]);
  if (S.next >= S.jobs.length) { S.done = true; siteSearchRestore(S); }
  const now = performance.now();
  if (S.done || now - _siteSearchDrawn > 500) { _siteSearchDrawn = now; drawSearchResults(); }
  if (!S.done) _siteSearchTimer = setTimeout(siteSearchRun, 0);
}
function siteSearchPause() {
  if (_siteSearchTimer) { clearTimeout(_siteSearchTimer); _siteSearchTimer = null; }
  const S = window.ARCHIVE && DERIVED.SITE_SEARCH;
  if (S && S.standing) siteSearchRestore(S);
}

// --- The panel ------------------------------------------------------------

function openSearch() {
  const w = document.getElementById('searchWrap');
  if (!w) return;
  w.style.display = 'block';
  const box = document.getElementById('searchBox');
  if (box) box.focus();
  if (ARCHIVE && !_siteSearchTimer) _siteSearchTimer = setTimeout(siteSearchRun, 0);
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
  if (!q) { host.innerHTML = ''; return; }
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
  if (!q || /^0x[0-9a-f]{1,4}$/i.test(q)) return;
  const tree = parseSearchQuery(q);
  if (!tree) { host.innerHTML = ''; return; }
  const terms = searchPositives(tree);
  const cap = window.SEARCH_ALL ? Infinity : 40;
  const S = siteSearchState();
  let h = '';
  let things = '';
  try { things = namedThingsMatching(name => searchMatches(tree, searchFold(name))); } catch (e) { quiet(e); }
  h += things;
  // Pages, a page whose title matches first.
  const titled = p => terms.some(t => searchFold(p.title).includes(t)) ? 1 : 0;
  const pages = S.pages.filter(p => searchMatches(tree, p.hay)).sort((a, b) => titled(b) - titled(a));
  const reading = S.done ? '' : ' <span class="sr-where">Reading the pages, ' + S.next + ' of ' + S.jobs.length + '.</span>';
  h += '<div class="partsTitle sr-head">Pages: ' + pages.length + reading + '</div>';
  for (const p of pages.slice(0, cap)) {
    const i = S.pages.indexOf(p);
    const lines = searchCoveringLines(p.lines, terms, 2);
    h += '<div class="sr-item">' + (p.open.panel === null ? '<span class="sr-title">' + svEsc(p.title) + '</span>'
        : svLink(p.title, 'openSearchPage(' + i + ')')) +
      (p.trail ? ' <span class="sr-where">' + svEsc(p.trail) + '</span>' : '') +
      (lines.length ? '<div class="sr-text">' + lines.map(l => '<div>' + searchSnippet(l, terms) + '</div>').join('') + '</div>' : '') + '</div>';
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
  if (!things && !pages.length && !hits.length) h = '<div class="sv-note">Nothing matches.' + reading + '</div>';
  host.innerHTML = h;
}
function searchShowAll() { window.SEARCH_ALL = true; drawSearchResults(); }

/* The lines of a page to show under its title: each one chosen for the
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
    out.push(lines[best]);
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
   drawn, and the first place a searched word appears in it is opened,
   scrolled to and outlined. */
function openSearchPage(i) {
  const S = DERIVED.SITE_SEARCH;
  const p = S && S.pages[i];
  if (!p) return;
  const terms = searchPositives(parseSearchQuery(document.getElementById('searchBox').value));
  closeTopPanels();
  let roots = null;
  if (p.open.panel) { window[p.open.panel](); roots = [document.getElementById(p.open.panel === 'toggleCredits' ? 'creditsMenu' : 'archiveMenu')]; }
  else if (p.open.exe != null) jumpToExeAt(p.open.exe);
  else if (p.open.d) {
    const [kind, ...rest] = p.open.d.split(':');
    const id = rest.join(':');
    if (showCategory(p.open.c)) DETAIL_OPENERS[kind](STRING_DETAIL_IDS.has(kind) ? id : parseInt(id, 10));
  } else showCategory(p.open.c);
  setTimeout(() => searchRevealText(terms, roots || siteViewElements()), 80);
}
function searchRevealText(terms, roots) {
  if (!terms.length || !document.createTreeWalker) return;
  for (const t of terms) for (const root of roots) {
    if (!root) continue;
    const w = document.createTreeWalker(root, 4);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!searchFold(n.nodeValue).includes(t)) continue;
      const el = n.parentElement;
      if (!el) continue;
      for (let a = el; a; a = a.parentElement) if (a.tagName === 'DETAILS') a.open = true;
      try { el.scrollIntoView({ block: 'center' }); } catch (e) { quiet(e); }
      el.classList.add('searchFound');
      setTimeout(() => el.classList.remove('searchFound'), 2600);
      return;
    }
  }
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
