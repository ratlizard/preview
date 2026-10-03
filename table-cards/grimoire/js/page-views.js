/* The executable's sheet, Tools, parts and uses, monsters, the text and conversation views, and editing.

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
   last of these. File 12 of 14. */

/* ---- Data > Cythera (App) > Data Fork ------------------------------------
   The PowerPC executable, read with js/mac-pef.js: the container's sections,
   the loader's imported libraries and symbols (the host API the game needs,
   498 of its 563 imports from InterfaceLib), its two exports, and every
   routine the code section names for itself in its traceback tables --
   1,992 in 1.0.4, grouped by class. The sheets that cite a routine
   ("read from the program") carry a chip here (pefChip), which opens
   this sheet filtered to the name. Addresses are offsets into the code
   section, the convention the workbench's traces use, except that a trace
   written down as 0x0437BC names the word after the entry: the entry
   TMapWindow::KeyRoutine is 0x0437B8, four bytes earlier, which is where a
   `bl` lands. */
window.PEF_FILTER = '';
function appPef() {
  if (window.APP_PEF) return window.APP_PEF;
  if (!window.APP_DATA) return null;
  let pef = null;
  try { pef = parsePEF(window.APP_DATA); } catch (e) { pef = null; }
  if (!pef) return null;
  try { pef.routines = pefTracebacks(pef, window.APP_DATA); } catch (e) { pef.routines = []; }
  return (window.APP_PEF = pef);
}
function pefFilter(v) { window.PEF_FILTER = String(v || ''); window.PEF_VIEW = null; renderAppPefSheet(); }
// A routine cited by name opens on its own listing; a name the program
// does not have filters the list to it, which says so.
function openPefRoutine(name) {
  const r = exeRoutineNamed(name);
  if (r) return jumpToExeAt(r.offset);
  window.PEF_FILTER = name; window.PEF_VIEW = null;
  showCategory('APPPEF');
}
// A chip to a routine of the executable, wherever a sheet cites one.
function pefChip(name) {
  return relChip({ js: 'openPefRoutine(\'' + name.replace(/'/g, '\\\'') + '\')', main: name, sub: 'routine', title: 'Data › Cythera (App) › Data Fork' });
}

/* ---- a number read off the program, and where ------------------------------
   The executable's figures -- the clock's hour, how often a fed character
   heals, how long a balloon stays up, the costs of the commands -- are read
   out of its PowerPC code on the spot, the way the Mechanics sheet reads the
   archive's scripts, and each is printed as a link to the instruction that
   holds it (srcNum with an `exe` address, jumpToExeAt). Until 11 September
   2026 they were typed in from traces made outside the site
   (cythera-workbench's doc/game-clock.md and doc/talk-balloons.md), which is
   a copy of the program nobody could follow back and an edited program would
   contradict in silence.

   The instructions are js/mac-ppc.js's, the sections and relocations
   js/mac-pef.js's (pefLoad). A routine is found by the name its traceback
   table gives, its instructions decoded once (exeOpsOf), and a call
   resolved to what it reaches: another routine, or through a glue stub --
   `lwz 12, d(2)`, `stw 2, 20(1)`, `lwz 0, 0(12)`, `lwz 2, 4(12)`, `mtctr 0`,
   `bctr` -- to the import whose transition vector the TOC slot holds. An
   address is an offset into the code section, as everywhere on the site.
   Without the application open none of this answers, and the sentences
   that need it say what to open instead of stating a number. */
function appImage() {
  const pef = appPef();
  if (!pef) return null;
  if (pef.image === undefined) {
    try { pef.image = pefLoad(window.APP_DATA); } catch (e) { pef.image = null; }
    if (pef.image) {
      pef.image.codeIndex = pef.image.pef.sections.findIndex(x => x.kind === 0);
      pef.image.code = pef.image.contents[pef.image.codeIndex] ? pef.image.contents[pef.image.codeIndex].bytes : null;
    }
  }
  return pef.image && pef.image.code ? pef.image : null;
}
function exeWord(at) { const img = appImage(); return img && at >= 0 && at + 4 <= img.code.length ? pefU32(img.code, at) : null; }
// The routine an address is inside, by the traceback tables.
function exeRoutineAt(at) {
  const pef = appPef(); if (!pef || !pef.routines) return null;
  const rs = pef.routines; let lo = 0, hi = rs.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rs[m].offset <= at) { best = rs[m]; lo = m + 1; } else hi = m - 1; }
  return best && at < best.offset + best.length ? best : null;
}
// A routine by its name, with or without its argument list. Kept with the
// program once found: it is a walk of two thousand routines, and the unit
// readers below were asking it a thousand times a render.
function exeRoutineNamed(name) {
  const pef = appPef(); if (!pef || !pef.routines) return null;
  const memo = pef.namedMemo || (pef.namedMemo = new Map());
  if (memo.has(name)) return memo.get(name);
  const r = pef.routines.find(r => r.name === name) || pef.routines.find(r => r.name.startsWith(name + '(')) || pef.routines.find(r => r.mangled === name) || null;
  memo.set(name, r);
  return r;
}
/* A reader's answer, kept with the program it was read from, for a reader
   asked once a prop type. The first was exeMonsterKinds: spriteBlockSize
   asks unitArmsFrames, which asks unitArmClass of every prop type, which
   asked exeMonsterKinds each time, and the hero's sprite section drew
   through that for four and a half of the Tools tab's six and a half
   seconds (the maintainer, 27 September 2026: "Tools tab takes a long time
   to load now"). A new program is a new appPef object, so what is kept goes
   with the one it came from. */
function exeMemo(key, build) {
  const pef = appPef(); if (!pef) return build();
  const memo = pef.readerMemo || (pef.readerMemo = new Map());
  if (!memo.has(key)) memo.set(key, build());
  return memo.get(key);
}
// A routine's instructions: address, word, the decode, and where a branch goes.
function exeOpsOf(r) {
  if (!r) return [];
  if (r.ops) return r.ops;
  const img = appImage(); if (!img) return [];
  const ops = [];
  for (let at = r.offset; at < r.offset + r.length && at + 4 <= img.code.length; at += 4) {
    const w = pefU32(img.code, at), d = ppcDecode(w);
    ops.push({ at, word: w, d, mn: d ? d.mn : '', text: d ? d.text : '.long 0x' + w.toString(16).toUpperCase(),
               to: d && d.branch && !d.indirect && !d.aa ? at + d.disp : null });
  }
  return (r.ops = ops);
}
// The import a glue stub at `at` calls, or null.
function exeGlueImport(at) {
  const img = appImage(); if (!img || !img.toc) return null;
  const d = [0, 1, 2, 3, 4, 5].map(k => { const w = exeWord(at + 4 * k); return w === null ? null : ppcDecode(w); });
  if (!d[0] || d[0].mn !== 'lwz' || d[0].rt !== 12 || d[0].ra !== 2 || !d[5] || d[5].mn !== 'bctr') return null;
  const p = pefPointerAt(img, img.toc.section, img.toc.offset + d[0].d);
  return p && p.name ? p.name : null;
}
// What a branch reaches, by name: a routine (with its offset inside it) or an import.
function exeTargetName(to) {
  if (to === null || to === undefined) return '';
  const r = exeRoutineAt(to);
  if (r) return r.name + (to !== r.offset ? '+0x' + (to - r.offset).toString(16).toUpperCase() : '');
  const g = exeGlueImport(to);
  return g ? g : '0x' + to.toString(16).toUpperCase();
}
// Does op call `name` -- a routine's name without its arguments, or an import?
function exeCalls(op, name) {
  if (!op || op.mn !== 'bl' || op.to === null) return false;
  const r = exeRoutineAt(op.to);
  if (r) return r.offset === op.to && (r.name === name || r.name.startsWith(name + '('));
  return exeGlueImport(op.to) === name;
}
// Every call of a routine anywhere in the code, by one scan kept with the program.
function exeCallersOf(name) {
  const img = appImage(), pef = appPef(); if (!img) return [];
  const target = exeRoutineNamed(name); if (!target) return [];
  if (!pef.callIndex) {
    pef.callIndex = new Map();
    for (let at = 0; at + 4 <= img.code.length; at += 4) {
      const w = pefU32(img.code, at);
      if ((w >>> 26) !== 18 || (w & 3) !== 1) continue;            // bl
      let li = w & 0x03FFFFFC; if (li & 0x02000000) li -= 0x04000000;
      const to = at + li;
      (pef.callIndex.get(to) || pef.callIndex.set(to, []).get(to)).push(at);
    }
  }
  return (pef.callIndex.get(target.offset) || []).map(at => { const r = exeRoutineAt(at); const ops = exeOpsOf(r); return { routine: r, ops, i: ops.findIndex(o => o.at === at) }; }).filter(c => c.routine && c.i >= 0);
}
// A number an instruction holds, with where: { v, exe }.
function exeVal(op, v) { return op ? { v, exe: op.at } : null; }
// A word of the TOC's section at a displacement from the TOC.
function exeTocOffset(d) { const img = appImage(); return img && img.toc ? img.toc.offset + d : null; }
function exeDataWords(off, n) {
  const img = appImage(); if (!img || !img.toc) return null;
  const sec = img.contents[img.toc.section]; if (!sec || off < 0 || off + 4 * n > sec.bytes.length) return null;
  const out = []; for (let k = 0; k < n; k++) out.push(pefI32(sec.bytes, off + 4 * k));
  return out;
}
// A C string a pointer reaches, when it is one.
function exeStringAt(p) {
  const img = appImage(); if (!img || !p || p.section === undefined) return null;
  const sec = img.contents[p.section]; if (!sec) return null;
  let e = p.offset, s = '';
  while (e < sec.bytes.length && sec.bytes[e] && s.length < 200) { const ch = sec.bytes[e++]; if (ch < 0x20 && ch !== 0x0A && ch !== 0x0D) return null; s += String.fromCharCode(ch); }
  return s.length >= 2 ? decodeMacRoman(sec.bytes.subarray(p.offset, e)) : null;
}
// The ops of a routine by name, for the readers below.
function exeOpsNamed(name) { return exeOpsOf(exeRoutineNamed(name)); }
// The first op at or after `from` satisfying `test`, within `span` ops.
function exeFind(ops, from, span, test) {
  for (let i = Math.max(0, from); i < Math.min(ops.length, from + span); i++) if (ops[i].d && test(ops[i].d, ops[i])) return i;
  return -1;
}
function exeFindBack(ops, from, span, test) {
  for (let i = Math.min(ops.length - 1, from); i >= Math.max(0, from - span); i--) if (ops[i].d && test(ops[i].d, ops[i])) return i;
  return -1;
}

/* Open the application's code at an address: the routine that holds it,
   listed, with that instruction ringed. */
window.PEF_VIEW = null;
function jumpToExeAt(at) {
  if (window.CUR_SUBN === 'MECHANICS' || MECH_GROUP_BY_VALUE[window.CUR_SUBN]) mechKeepPlace();
  window.PEF_VIEW = { at };
  if (window.CUR_SUBN === 'APPPEF') renderAppPefSheet();
  else openVia('APPPEF', () => {});
  setTimeout(() => {
    const hit = document.getElementById('listingHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 40);
  return true;
}
function pefBackToList() { window.PEF_VIEW = null; renderAppPefSheet(); }
// One routine, instruction by instruction: calls and branches named and
// followable, TOC slots said as what they hold.
function exeListingHTML(r, ringAt) {
  const img = appImage();
  const hex = (n, w) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w || 6, '0');
  const lines = exeOpsOf(r).map(o => {
    let t = svEsc(o.text);
    const d = o.d;
    if (o.to !== null) {
      const nm = exeTargetName(o.to);
      const inside = o.to >= r.offset && o.to < r.offset + r.length;
      t += '   ' + (exeRoutineAt(o.to) ? svLink(inside ? '+0x' + (o.to - r.offset).toString(16).toUpperCase() : nm, 'jumpToExeAt(' + o.to + ')') : '<span class="refnote">' + svEsc(nm) + '</span>');
    }
    if (d && d.ra === 2 && img.toc) {
      if (d.d !== undefined) {
        const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
        const str = p && p.section !== undefined ? exeStringAt(p) : null;
        t += '   <span class="refnote">; TOC ' + (d.d >= 0 ? '+' : '') + d.d + (p ? (p.name ? ', ' + svEsc(p.name) : str ? ', “' + svEsc(str.replace(/\n/g, ' ')) + '”' : ', ' + (img.pef.sections[p.section] ? img.pef.sections[p.section].kindName : 'section ' + p.section) + ' ' + hex(p.offset)) : '') + '</span>';
      } else if (d.mn === 'addi') t += '   <span class="refnote">; data ' + hex(img.toc.offset + d.imm) + '</span>';
    }
    const line = hex(o.at) + '  ' + o.word.toString(16).toUpperCase().padStart(8, '0') + '  ' + t;
    return o.at === ringAt ? '<span id="listingHit" class="listingHit">' + line + '</span>' : line;
  });
  return '<pre class="pane exeListing" style="max-height:none">' + lines.join('\n') + '</pre>';
}
function renderAppPefSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const pef = appPef();
  if (!pef) { renderPlaceholderSheet(PLACEHOLDER_TABS.APPPEF + (window.APP_DATA ? ' This data fork is not a PEF container.' : NO_INSTALLER_HINT)); return; }
  const view = window.PEF_VIEW && exeRoutineAt(window.PEF_VIEW.at);
  if (view && appImage()) {
    const box = document.createElement('div');
    box.className = 'mechView';
    const hexv = n => '0x' + (n >>> 0).toString(16).toUpperCase();
    box.innerHTML = '<div class="foldAll" style="justify-content:flex-start">' + svLink('All routines', 'pefBackToList()') + '</div>' +
      '<div class="changesHead">' + svEsc(view.name) + '</div>' +
      '<p class="mechLede">At ' + hexv(view.offset) + ' in the code section, ' + view.length.toLocaleString() + ' bytes, ' + (view.length / 4) + ' instructions' +
      (view.mangled !== view.name ? ' <span class="inspDim">(' + svEsc(view.mangled) + ')</span>' : '') + '. A jump or a call links to where it goes, and a slot in the program’s table of addresses shows what the game stores there when it starts.</p>' +
      exeListingHTML(view, window.PEF_VIEW.at);
    grid.appendChild(box);
    out.textContent = view.name + ', ' + (view.length / 4) + ' instructions';
    return;
  }
  const hex = n => '0x' + (n >>> 0).toString(16).toUpperCase();
  const num = v => '<td class="num">' + svEsc(String(v)) + '</td>';
  const box = document.createElement('div');
  box.className = 'mechView';
  const ld = pef.loader;
  const code = pef.sections.find(x => x.kind === 0);
  let h = '<div class="changesHead">The program’s data fork: a PEF container, ' + svEsc(pef.arch === 'pwpc' ? 'PowerPC' : pef.arch) + '</div>';
  h += '<p class="mechLede">The program’s PowerPC code' + (pef.routines.length ? ': ' + pef.routines.length.toLocaleString() + ' routines, named from notes the compiler left in it' : '') +
    (ld ? ', and the ' + ld.symbols.length + ' system calls it uses from ' + ld.libraries.length + ' libraries' : '') + '.</p>';
  h += '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>no.</th><th>section</th><th class="num">unpacked</th><th class="num">packed</th><th class="num">at</th></tr></thead><tbody>' +
    pef.sections.map(x => '<tr>' + num(x.index) + '<td>' + svEsc(x.kindName) + (x.name ? ' ' + svEsc(x.name) : '') + '</td>' + num(x.unpackedSize.toLocaleString()) + num(x.packedSize.toLocaleString()) + num(hex(x.containerOffset)) + '</tr>').join('') + '</tbody></table></div>';
  if (ld) {
    h += '<div class="mechSub">Imported libraries</div>';
    h += ld.libraries.map(L => '<details class="mechSec"><summary class="mechHead"><h3>' + svEsc(L.name) + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + L.importedSymbolCount + '</b> symbol' + (L.importedSymbolCount === 1 ? '' : 's') + '</span>' + (L.weak ? '<span class="mechStat">weak</span>' : '') + '</span></summary>' +
      '<div class="mechBody"><div class="partsStrip">' + L.symbols.map(y => '<span class="navChip" style="cursor:default">' + svEsc(y.name) + '</span>').join('') + '</div></div></details>').join('');
    if (ld.exports.length) h += '<div class="mechSub">Exports</div><div class="partsStrip">' + ld.exports.map(e => '<span class="navChip" style="cursor:default" title="' + svEsc(e.className) + ', section ' + e.sectionIndex + ' at ' + hex(e.value) + '">' + svEsc(e.name) + '</span>').join('') + '</div>';
  }
  const q = (window.PEF_FILTER || '').trim().toLowerCase();
  h += '<div class="mechSub">Routines</div>' +
    '<input type="search" id="pefFilterBox" value="' + svEsc(window.PEF_FILTER || '') + '" placeholder="a routine or a class" oninput="pefFilter(this.value)" style="width:100%;box-sizing:border-box;margin:4px 0 8px">';
  const rs = pef.routines.filter(r => !q || r.name.toLowerCase().includes(q) || r.mangled.toLowerCase().includes(q));
  const byClass = new Map();
  for (const r of rs) { const c = r.name.includes('::') ? r.name.slice(0, r.name.lastIndexOf('::', r.name.indexOf('(') < 0 ? undefined : r.name.indexOf('('))) : ''; (byClass.get(c) || byClass.set(c, []).get(c)).push(r); }
  const row = r => '<tr>' + num(hex(r.offset)) + num(r.length.toLocaleString()) + '<td title="' + svEsc(r.mangled) + '">' + svLink(r.name, 'jumpToExeAt(' + r.offset + ')') + '</td></tr>';
  const table = list => '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th class="num">at</th><th class="num">bytes</th><th>routine</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>';
  if (q) h += rs.length ? table(rs) : '<div class="changesNote">No routine matches.</div>';
  else h += [...byClass.entries()].sort((a, b) => (a[0] || '~').localeCompare(b[0] || '~')).map(([c, list]) =>
    '<details class="mechSec"><summary class="mechHead"><h3>' + svEsc(c || 'functions outside a class') + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + list.length + '</b></span></span></summary><div class="mechBody">' + table(list) + '</div></details>').join('');
  h += '<p class="mechLede" style="margin-top:10px">The page decodes each name from the compiler’s shorthand, and leaves it as written where it cannot.</p>';
  box.innerHTML = h;
  grid.appendChild(box);
  out.textContent = pef.routines.length.toLocaleString() + ' routines named in the program' + (q ? ', ' + rs.length + ' matching “' + window.PEF_FILTER.trim() + '”' : ', by class') + '; ' + (ld ? ld.symbols.length + ' imports from ' + ld.libraries.length + ' libraries.' : '');
}

/* Cythera Preferences, the file the game keeps its settings in, on a tab of
   its own under Data beside the other files (the maintainer, 27 September
   2026; it was a section of the Tools tab). It is the only thing on the page
   that changes how the GAME behaves rather than how the page reads it: the
   smooth movement Cythera has always had and gates on a preference, the
   gate on the cheat keys, which nothing in the game ever sets, and the rest
   of the record and the file's other keys. The long comment above
   buildCytheraPreferences in js/page-export.js says where each came from.

   One row per setting, in four groups (the maintainer, 1 October 2026: one
   paragraph above two rows of controls was "messy"). A row's name is the
   game's own label, read with the layout as before, and the line under it is
   ours, written from the manual's Preferences page and from what the code
   that reads each bit does (doc/cheats.md, doc/preferences-file.md in the
   workbench). PREF_HELP keys a line by the option, key or choice it
   describes; a setting a patched build adds that PREF_HELP does not know
   still gets a row, without the line, in the last group. The tag beside a
   name says where the game itself changes it, which is the question the
   maintainer could not answer from the labels alone. Element ids are what
   prefsOptionsFromUI and the smokes read, and are unchanged. */
const PREF_HELP = {
  Volume: ['sound', 'Preferences dialog', 'How loud the sound effects are, from 0, silent, to 8. At −1 the game leaves the Mac’s volume alone.'],
  Music: ['sound', 'Preferences dialog', 'How loud the music is, in eighths of full volume: 8 is full, 0 is silent.'],
  Ambient: ['sound', 'Preferences dialog', 'Background sounds, such as animals and ocean waves.'],
  movement: ['movement', 'Preferences dialog', 'How the game draws a step from one square to the next: in four stages (Smoother), in two (Faster), or as one jump (Fastest). It takes the same game time in all three. The dialog’s Graphics Quality slider sets the same thing.'],
  frameRate: ['movement', 'Hidden menu', 'The most frames the game draws in a second; these three come from the game’s hidden Preferences menu. The file can hold others, down to no limit at all. A higher limit plays each step’s animation faster; holding a key still walks at the pace of the Mac’s key repeat.'],
  motionFilters: ['movement', 'Preferences dialog', 'Leaves blowing on the trees and waves rippling across the ocean.'],
  walkAround: ['movement', 'Preferences dialog', 'The hero steps around things in the way rather than stopping at them.'],
  liveDrag: ['windows', 'Preferences dialog', 'Lets you drag the game’s windows around the screen.'],
  manualContainers: ['windows', 'Preferences dialog', 'Opening a container lets you choose where its window goes. Off, the game places it for you.'],
  zoomRects: ['windows', 'Preferences dialog', 'Windows open with a zooming outline.'],
  Backdrop: ['windows', 'Not in the game', 'The pattern that fills the screen behind every window. Nothing in the game sets it.'],
  switch256: ['startup', 'Asked at startup', 'On a screen set to more than 256 colors, the game switches it to 256 when it starts. Off, it runs in the colors the screen already has.'],
  dontAsk: ['startup', 'Asked at startup', 'The game does not ask about 256 colors when it starts. Off, it asks on a screen set to more than 256 colors, and the answer replaces the switch above.'],
  cheats: ['startup', 'Not in the game', null],
  mouseButtons: ['mouse', 'Not in the game', 'For a mouse with more than one button: the second button clicks as if you held Command, the third Control, the fourth Option and the fifth Shift. In this game Control-click opens the contextual menu at once and Option-click does the double-click action, so the middle button opens the menu; the right-click fix on the Patches tab puts it on the right button. Infinite Mac passes only one button to the Mac, so it does nothing there.'],
};
const PREF_GROUPS = [['sound', 'Sound'], ['movement', 'Game control'], ['windows', 'Windows'], ['startup', 'Starting the game'], ['mouse', 'Mouse'], ['other', 'Other settings']];
function renderPrefsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'changesView';
  const layout = cytheraPrefsLayout();
  if (!layout) {
    /* Nothing can be offered here without the application. Every bit position,
       every key and every choice in this section is read out of its code as
       the page opens, which is what keeps them right for the build in hand --
       so with only the data file open there is no file to write, and the one
       thing worth saying is how to get one. Said first, and short: the
       sentence that used to carry it put the action last and read as a
       description of a tool that was not there (the maintainer, 23 September
       2026). */
    const d = document.createElement('div');
    d.className = 'changesGroup';
    d.innerHTML = '<div class="changesGroupTitle">' + svEsc('Cythera’s preferences file') + '</div>' +
      '<div class="changesNote" style="margin-left:0"><b>' + svEsc('Open the game itself (Data › Installer, or drop the program on the page) and the settings appear here.') + '</b><br>' +
      svEsc('This writes Cythera’s preferences file, which holds the settings the game keeps in the Preferences folder of the System Folder, including the switch that makes its cheat keys work. ' +
            'The page reads every switch in it from the program’s code, so the game has to be open for there to be anything to write.') + '</div>';
    box.appendChild(d);
    grid.appendChild(box);
    out.textContent = PREFS_FILE_NAME + ', the file the game keeps its settings in.';
    return;
  }
  const sheet = document.createElement('div');
  sheet.className = 'prefSheet';
  sheet.innerHTML = '<p class="prefLede">' + svEsc('Choose the settings, then download the file and put it in the Preferences folder of the System Folder, replacing the one there. ' +
      'Each setting starts as a new copy of the game has it.') + '</p>' +
    '<p class="prefFrom">' + svEsc(layout.from === 'shipped'
      ? 'The settings are the same in all four releases, so nothing needs to be open. Open the game to read them from your own copy instead.'
      : 'The page reads the settings from the program open here.') + '</p>';
  /* The two presets (cytheraPrefsPreset): each sets every row, the switches
     by their ids and the choosers by their values. Built with createElement,
     since the smokes' DOM stub does not parse innerHTML into elements. */
  const presets = document.createElement('div');
  presets.className = 'prefPresets';
  for (const [label, name, title] of [['Default', 'default', 'A new copy of the game'],
                                      ['Optimized', 'optimized', 'Smoother Movement, 256 colors without asking and the cheat keys']]) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = label;
    b.title = title;
    b.onclick = () => applyPrefsPreset(name);
    presets.appendChild(b);
  }
  const presetNote = document.createElement('span');
  presetNote.className = 'prefPresetNote';
  presetNote.textContent = 'Default is a new copy of the game. Optimized adds Smoother Movement, 256 colors without asking and the cheat keys.';
  presets.appendChild(presetNote);
  sheet.appendChild(presets);
  const rows = new Map(PREF_GROUPS.map(([g]) => [g, []]));
  // Within a group, rows go in PREF_HELP's order, which is the order of the
  // game's own dialog where it has them (Volume, Music, Ambient), not the
  // order the program's keys happen to be read in.
  const order = Object.keys(PREF_HELP);
  const help = k => PREF_HELP[k] || ['other', null, null];
  const text = (name, where, desc) => '<span class="prefName">' + svEsc(name) + '</span>' +
    (where ? '<span class="prefWhere">' + svEsc(where) + '</span>' : '') +
    (desc ? '<span class="prefDesc">' + desc + '</span>' : '');
  // A switch: the row is its label. `checked` straight after the id, which
  // is the order smoke_installer's pattern for the 256-colour answer reads.
  const sw = (key, id, name, on, descHTML) => {
    const [g, where, desc] = help(key);
    rows.get(g).push([order.indexOf(key), '<label class="prefRow"><span class="prefText">' + text(name, where, descHTML || (desc && svEsc(desc))) + '</span>' +
      '<span class="prefCtl"><input type="checkbox" id="' + svEsc(id) + '"' + (on ? ' checked' : '') + '><span class="prefSwitch" aria-hidden="true"></span></span></label>']);
  };
  // A chooser: the select's id first in its tag, as smoke_rules reads it.
  const ch = (key, id, name, opts, chosen) => {
    const [g, where, desc] = help(key);
    rows.get(g).push([order.indexOf(key), '<div class="prefRow"><label class="prefText" for="' + svEsc(id) + '">' + text(name, where, desc && svEsc(desc)) + '</label>' +
      '<span class="prefCtl"><select id="' + svEsc(id) + '">' + opts.map(o => '<option value="' + svEsc(String(o.v)) + '"' +
        (o.v === chosen ? ' selected' : '') + '>' + svEsc(o.t) + '</option>').join('') + '</select></span></div>']);
  };
  const idOf = opt => 'pref' + opt[0].toUpperCase() + opt.slice(1);
  const field = (byte, lo, hi) => (((layout.base >>> (24 - 8 * byte)) & 255) >> lo) & ((1 << (hi - lo + 1)) - 1);
  // A choice's label is what its options say in common ("Movement", "FPS"),
  // so it is the game's words as the row of controls had them.
  const affix = texts => {
    const w = texts.map(t => t.split(/\s+/).filter(Boolean)), n = Math.min(...w.map(x => x.length));
    const tail = [];
    for (let i = 1; i <= n; i++) { const last = w.map(x => x[x.length - i]); if (last.every(x => x === last[0])) tail.unshift(last[0]); else break; }
    if (tail.length) return tail.join(' ');
    const head = [];
    for (let i = 0; i < n; i++) { const first = w.map(x => x[i]); if (first.every(x => x === first[0])) head.push(first[0]); else break; }
    return head.join(' ');
  };
  /* The record's multi-value fields first: the movement stops (the field
     "Smoother Movement" writes) and the frame-rate cap (the other one). Each
     option is the menu item that writes it. */
  for (const c of layout.choices) {
    const cur = c.options.find(op => op.sets.every(x => field(x.byte, x.lo, x.hi) === x.value));
    const key = c.options.some(o => o.text === layout.smoothLabel) ? 'movement' : layout.choices.length === 2 ? 'frameRate' : null;
    /* The menu's own options only (the maintainer, 1 October 2026: "just use
       the game's own three options for FPS, but can note that technically
       others possible"). v1.228.0 offered every frame-rate value from none
       to the menu's slowest; the record writer still takes them as `raw:n`
       (cytheraPrefsRecord), and the row's line says they exist. */
    ch(key, 'pref_' + c.opt, affix(c.options.map(o => o.text)) || 'Setting', c.options.map(o => ({ v: o.text, t: o.text })), cur ? cur.text : null);
  }
  for (const c of layout.controls) sw(c.opt, idOf(c.opt), c.label, !!((layout.base >>> (24 - 8 * c.byte)) & (1 << c.bit)));
  /* The file's other keys. A flag (a range of 0 to 1) is a switch whose
     value prefsOptionsFromUI reads as 1 or 0; the volumes are choosers; the
     backdrop's options are its own list. Each starts at what a fresh
     install reads, which is what keeps a row left alone out of the file. */
  for (const o of layout.ordinals) {
    const r = PREF_ORDINAL_RANGE[o.key], id = 'prefOrd_' + o.key.replace(/\W/g, '');
    if (r && r.min === 0 && r.max === 1) { sw(o.key, id, o.key, o.dflt === 1); continue; }
    let opts = null;
    if (r) { opts = []; for (let v = r.min; v <= r.max; v++) opts.push({ v, t: String(v) }); }
    else if (layout.backdrop) opts = layout.backdrop.map(b => ({ v: b.value, t: b.label }));
    if (!opts || !opts.some(x => x.v === o.dflt)) continue;
    ch(o.key, id, o.key, opts, o.dflt);
  }
  // The startup question's answer and its "don't ask" as two switches, each
  // wearing the dialog's own text, so every pairing can be written. Both
  // start on: the game's own recommendation, and no question in the way.
  (layout.startup || []).forEach((x, i) => { if (PREF_STARTUP_IDS[i]) sw(['switch256', 'dontAsk'][i], PREF_STARTUP_IDS[i], x.text, true); });
  sw('cheats', 'prefCheats', 'Allow the cheat keys', true,
     svEsc('Lets the cheat keys work after you type ' + layout.gate.word + '. Nothing in the game turns this on, so a copy as released cannot enter cheat mode.'));
  // No label anywhere in the game, so the row's name is the page's own.
  if (layout.buttons) sw('mouseButtons', 'prefMouseButtons', 'Extra mouse buttons', false);
  for (const [g, title] of PREF_GROUPS) {
    const list = rows.get(g);
    if (!list.length) continue;
    const sec = document.createElement('div');
    sec.className = 'prefGroup';
    const html = list.map((r, i) => [r[0] < 0 ? 1e9 + i : r[0], r[1]]).sort((x, y) => x[0] - y[0]).map(r => r[1]).join('');
    sec.innerHTML = '<h3>' + svEsc(title) + '</h3><div class="prefRows">' + html + '</div>';
    sheet.appendChild(sec);
  }
  // Built with createElement rather than read back out of innerHTML, which
  // the smokes' DOM stub does not parse into elements.
  const save = document.createElement('div');
  save.className = 'prefGroup';
  save.innerHTML = '<h3>' + svEsc('Download') + '</h3>';
  const saveBox = document.createElement('div');
  saveBox.className = 'prefRows';
  const pbtns = document.createElement('div');
  pbtns.className = 'prefSave';
  const saveNote = document.createElement('div');
  saveNote.className = 'prefSaveNote';
  saveNote.textContent = 'Tested in the game: the game read a file this page wrote, and cheat mode activated.';
  saveBox.appendChild(pbtns);
  saveBox.appendChild(saveNote);
  save.appendChild(saveBox);
  for (const [label, kind, title] of [
    ['Disk image, for an emulator', 'dsk', 'Mounts as “' + PREFS_VOLUME_NAME + '” with an ' + PREFS_SCRIPT_NAME + ' script beside the file'],
    ['MacBinary, for a real Mac', 'bin', 'Decode it and drag the file into System Folder ▸ Preferences']]) {
    const btn = document.createElement('button');
    btn.className = 'secondary';
    btn.textContent = label;
    btn.title = title;
    btn.onclick = () => downloadCytheraPrefs(kind);
    pbtns.appendChild(btn);
  }
  sheet.appendChild(save);
  box.appendChild(sheet);
  grid.appendChild(box);
  out.textContent = PREFS_FILE_NAME + ', the file the game keeps its settings in.';
}

// Sets every row of the Preferences tab to a preset's options.
function applyPrefsPreset(name) {
  const o = cytheraPrefsPreset(name); if (!o) return;
  const L = cytheraPrefsLayout();
  const sw = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined) e.checked = !!v; };
  const sel = (id, v) => { const e = document.getElementById(id); if (e && v !== undefined) e.value = String(v); };
  sw('prefCheats', o.cheats); sw('prefMouseButtons', o.mouseButtons);
  for (const [opt] of PREF_OPTIONS) sw('pref' + opt[0].toUpperCase() + opt.slice(1), o[opt]);
  (L.startup || []).forEach((x, i) => sw(PREF_STARTUP_IDS[i], o.startup[x.text]));
  for (const c of L.choices) sel('pref_' + c.opt, o[c.opt]);
  for (const x of L.ordinals || []) {
    const e = document.getElementById('prefOrd_' + x.key.replace(/\W/g, ''));
    if (e && e.type === 'checkbox') e.checked = o[x.key] === 1; else sel('prefOrd_' + x.key.replace(/\W/g, ''), o[x.key]);
  }
  setStatus((name === 'optimized' ? 'Optimized' : 'Default') + ' preferences: ' + prefsSummary(o) + '.');
}

/* Data › Patches: a patch read and applied, a sprite or a gremlin made into
   one, and one file compared with another, the sections of MECH_TOOL_GROUP,
   which the rules renderer builds because the reading they share lives
   there. The tab wears Magpie's own icon for a patch while a patch rather
   than Cythera Data is the file open (openFileIsPatch, magpieIcon). */
function renderPatchesSheet() { renderMechanicsSheet(MECH_TOOL_GROUP.value); }

/* ---- Tools -------------------------------------------------------------------
   The page's own switches and its sister pages, which are not part of the
   archive and so have no place under the other three tabs. The undither
   switch moved here from every gallery that had one: it is one setting for
   every image, and the galleries keep only a preview the other way. */
function renderToolsSheet() {
  /* The file tools -- a patch read, a sprite or a gremlin made into one, the
     comparison -- were drawn here through the rules renderer until
     27 September 2026 and are Data › Patches now (renderPatchesSheet), which
     also spares this tab building every rule of the sheet to show four. */
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  out.textContent = 'The ditherizer, the other pages, and the font this page uses.';
  const box = document.createElement('div');
  box.className = 'changesView';
  const sec = (title, note) => {
    const d = document.createElement('div');
    d.className = 'changesGroup';
    d.innerHTML = '<div class="changesGroupTitle">' + svEsc(title) + '</div>' +
      (note ? '<div class="changesNote" style="margin-left:0">' + svEsc(note) + '</div>' : '');
    box.appendChild(d);
    return d;
  };
  const d = sec('Ditherizer', 'Turns any image into checkerboard art in Cythera’s palette. It opens on the Portraits ' +
    'gallery, so a result can go straight into a portrait.');
  const db = document.createElement('button');
  db.className = 'secondary';
  db.textContent = 'Open the ditherizer';
  db.onclick = () => { showCategory('135'); openDitherTool(); };
  d.appendChild(db);

  const pages = sec('The other pages', '');
  for (const [href, label, note] of [
    ['canvas.html', 'Color-cycling canvas', 'a paint studio for the palette animation Cythera uses for water and fire'],
    ['https://github.com/ratlizard/grimoire', 'The repository', 'where this page and its tests live']]) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:6px 6px 0 0';
    b.textContent = label;
    b.title = note;
    b.onclick = () => window.open(href, '_blank', 'noopener');
    pages.appendChild(b);
  }
  // Which face the page is actually drawing in: the open file's own sfnt,
  // Chicago, or this device's. A person can tell in a glance here what no
  // harness can, which is whether the font on the screen is the one out of
  // the file. Chosen under Settings; this only reports.
  const font = sec('The font this page uses', '');
  const fn = document.createElement('div');
  fn.className = 'amNote';
  fn.textContent = window.FACE_IN_USE === 'game' && window.GAME_FONT
    ? 'Argos A Nouveau, from the open file: ' + window.GAME_FONT + ' in Cythera Data’s resource fork, converted into a TrueType font the browser can use.'
    : window.FACE_IN_USE === 'system'
      ? 'This device’s font, chosen under Settings.'
      : 'Chicago, Susan Kare’s 1984 font for the Macintosh, recreated by Duane King and included with this page. ' +
        (window.GAME_FONT ? 'The game’s font is loaded; choose it under Settings.'
          : window.GAME_FONT_STATE === 'loading' ? 'The file’s font is still loading.'
          : window.GAME_FONT_STATE ? 'The page could not use the file’s font: ' + window.GAME_FONT_STATE + '.'
          : 'Open a file to use the game’s font.');
  font.appendChild(fn);
  grid.insertBefore(box, grid.firstChild);
  /* What fell back without saying so. Every optional decode that failed
     since the page loaded, kept by quiet() in js/mac-bytes.js, so a
     missing picture or an empty sheet has a reason a visitor can find. At
     the foot of the sheet and folded, one grey line (the maintainer, 19
     September 2026: it was the second thing on the page); the count is in
     the line, so a fault still shows without the list being open. */
  {
    const q = document.createElement('details');
    q.className = 'quietLog';
    const n = QUIET_FAILURES.size;
    const line = n ? n + (n === 1 ? ' thing' : ' things') + ' fell back quietly since the page loaded' : 'Nothing has fallen back quietly since the page loaded';
    q.innerHTML = '<summary>' + line + '</summary>';
    if (n) {
      const ul = document.createElement('div');
      ul.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.6;color:#b5b2a8;white-space:pre-wrap;margin-top:6px';
      // The file and line, not the origin it was served from.
      ul.textContent = [...QUIET_FAILURES].map(([m, v]) => (v.count > 1 ? v.count + '\u00d7 ' : '') + m + (v.where ? '\n    ' + v.where.replace(/https?:\/\/[^/\s]+\//g, '') : '')).join('\n');
      q.appendChild(ul);
    } else q.innerHTML += '<div class="changesNote" style="margin:6px 0 0">Everything the page has tried to read has worked. Anything the page could not read or draw would appear here, one line each, with how many times it happened.</div>';
    box.appendChild(q);
  }
  out.textContent = 'Settings and links; nothing here comes from the file except the font.';
}

/* ---- A tile on a sheet opens on its own ---------------------------------------
   The sheet is drawn at whatever shape the gallery tools chose, so the click
   is mapped back through that shape to a tile index, and the tile opens in
   the sprite zoom: the picture at sixteen times, what it was cut from, and
   every class that is drawn by it -- the class whose base it is, and each
   one that reaches it at an aspect -- each a chip to that class's page.

   A tap used to leave the sheet. Until 16 September 2026 it went to the prop
   type whose block held the tile, so the hatchet, the tile after the spear,
   opened the spear's page, which does not show it. That was narrowed to a
   prop type's own frames, which left the same gesture doing two different
   things -- a named frame navigated, anything else opened the zoom. Since
   20 September 2026 it always opens the zoom (the maintainer), and the
   chips there are the way on. */
/* An image of one resource opens that resource when tapped: the portrait
   on a character's page, a frame on a prop's, the sprite an item leaves
   behind. The maintainer's ask of 18 September 2026: every isolated image
   links to the graphical resource it was drawn from. A tile's resource is
   its sheet, sixteen tiles a sheet. */
function sheetOfTile(tileId) { return 0x8E00 + (tileId >> 4); }
function imageOpens(el, resid, what) {
  el.style.cursor = 'pointer';
  el.title = (what ? what + ' ' : '') + '0x' + resid.toString(16).toUpperCase() + ', tap to open';
  el.onclick = e => { e.stopPropagation(); jumpToResource(resid); };
  return el;
}
function tileSheetClick(ev, resid) {
  const canvas = ev.currentTarget;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const px = (ev.clientX - rect.left) / rect.width * canvas.width;
  const py = (ev.clientY - rect.top) / rect.height * canvas.height;
  const shape = window.SHEET_SHAPE || 'grid';
  let idx;
  if (shape === 'column') idx = Math.floor(py / 32);
  else if (shape === 'row') idx = Math.floor(px / 32);
  else if (shape === 'tiles') idx = Math.floor(py / 35) * 4 + Math.floor(px / 35);   // 32px tiles, 3px gutters
  else idx = Math.floor(py / 32) * 4 + Math.floor(px / 32);
  if (!(idx >= 0 && idx < 16)) return;
  const tileId = ((resid - 0x8E00) << 4) | idx;
  // The tile on its own, and nowhere else. A tap used to leave the sheet
  // for the prop type that wears the tile, where a tile whose prop could
  // not be named stayed and opened the zoom -- so the same gesture did two
  // different things depending on the tile. The zoom names the prop type
  // and links to it (tileFactsHTML), which is the route out for anyone who
  // wants it (the maintainer, 20 September 2026).
  showSpriteZoom(tileId, terrainNameFor(tileId) || '');
}

/* ---- What a window shows -----------------------------------------------------
   A container, a sign, a book or an instrument opens a window its class script
   builds with `gui Create`. With six operands that is the prop, the picture,
   and four numbers placing it; with two it is a plain window of a size (the
   shops, the bed, the inkwell), which shows no picture. The picture n is
   resource 0x8F00 + n: TPixCacheFromCachedSegFiles::GetData adds 0x8F00 to
   the number it is given, and nothing else in the application builds that id.

   Most classes go through a helper that takes the picture as an argument
   (0xE64, 0xE65, 0xE66 and 0xE67 in the shipped file), so a helper is read for
   which argument it passes, and the number is taken at each call. A poster and
   a sheet of paper pass their own Data2, so the picture is whatever each
   placed one carries.

   This replaced a table that matched prop names to pictures. The scripts
   disagree with it twice: the bookshelf shows its text on the scroll (0x8F03)
   rather than the open book, and the lute class opens 0x8F12, the pipes, the
   same picture as the panpipes. Nothing opens 0x8F15, the lute. That is the
   scenario as shipped, and it is shown as the script has it. */
DERIVED.SCRIPTED_WINDOWS = null;
function buildScriptedWindows() {
  if (DERIVED.SCRIPTED_WINDOWS) return DERIVED.SCRIPTED_WINDOWS;
  const byScript = new Map(), byPicture = new Map();
  const add = (resid, n) => {
    const pic = 0x8F00 + n;
    if (!(n >= 0) || !refExists(pic)) return;
    if (!byScript.has(resid)) byScript.set(resid, new Set());
    byScript.get(resid).add(pic);
    if (!byPicture.has(pic)) byPicture.set(pic, new Set());
    byPicture.get(pic).add(resid);
  };
  let index = [];
  try { index = buildScriptTextIndex(); } catch (e) { index = []; }
  const helpers = new Map(), fromData2 = new Set();
  for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      if (!/^gui Create\b/.test(o.text)) return;
      const v = dvmCallValues(ops, i);
      if (v.length !== 6) return;
      const n = dvmValueNum(v[1]), a = dvmValueArg(v[1]);
      if (n !== null) add(e.resid, n);
      else if (a !== null) helpers.set(e.resid, a);
      else if (v[1].length === 2 && dvmValueArg([v[1][0]]) === 0 && /^get_field data2\b/.test(v[1][1].text)) fromData2.add(e.resid);
    });
  }
  if (helpers.size) for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      const m = /^call_resource 0x([0-9A-F]+)\b/.exec(o.text);
      if (!m || !helpers.has(parseInt(m[1], 16))) return;
      const n = dvmValueNum(dvmCallValues(ops, i)[helpers.get(parseInt(m[1], 16))]);
      if (n !== null) add(e.resid, n);
    });
  }
  if (fromData2.size) for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    let list;
    try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
    // Each class tests the prop before it builds this window -- the poster
    // wants a Data1 of 0 and a Data2, the paper a Data1 of 255 -- and opens
    // the helper's picture otherwise. Every placed one in the shipped file
    // that carries a Data2 passes its class's test, so a Data2 is the test
    // this reads.
    for (const r of list) if (r.flags !== 0xFF && r.d2 && fromData2.has(0x1000 + r.proptype)) add(0x1000 + r.proptype, r.d2);
  }
  return (DERIVED.SCRIPTED_WINDOWS = { byScript, byPicture });
}
function containerWindowsFor(pt) {
  let w = null;
  try { w = buildScriptedWindows().byScript.get(0x1000 + pt); } catch (e) { w = null; }
  return w ? [...w].sort((a, b) => a - b) : [];
}

/* ---- Parts and uses --------------------------------------------------------
   The joins between the two halves of the tree. An entity page carries a
   "Made of" row: the components it is assembled from, each chip a jump to
   that resource under Components. A component's page carries the reverse --
   "Worn by", "Spoken by", "Played by", "Referenced by" -- so that from a
   portrait you reach the person and from a sound you reach the scripts that
   play it. Nothing here is guessed from names: each join is a resource-id
   rule the archive itself follows (character i's dialogue is 0x1800+i, its
   portrait 0x8800+i-1, zone n's entry script 0x1400+n), or a call read out
   of disassembled code. Where a join does not hold -- a sound no script
   names -- the row says so rather than staying silent. */
function trailForResid(resid) {
  const leaf = TAB_LEAF_FOR.get(String((resid >> 8) - 1));
  return leaf ? tabTrail(leaf) : '';
}

// A part of a thing: the relation first ("Portrait"), then what the part is
// called, then its id.
function partChip(label, resid) {
  const lbl = labelFor(resid);
  return relChip({ resid, main: label, sub: lbl || '', title: trailForResid(resid) });
}

// A link in text: see .svLink.
function svLink(label, js, note) {
  return '<button class="svLink" onclick="' + js + '">' + svEsc(label) + (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}

function actionChip(label, js, note) {
  return '<button class="sv-chip" onclick="' + js + '">' + svEsc(label) +
    (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}

/* The links a detail page carries to other resources -- what it is made of,
   what it belongs to, who plays or opens or references it -- folded shut
   under one line with their count (the maintainer, 22 September 2026: the
   chips were the bulk of every page and the thing itself came below them).
   Opening one opens them all for the rest of the visit, since a reader who
   wants the links on one page wants them on the next. */
window.LINKS_OPEN = false;
function linksFold(html) {
  if (!html) return '';
  const n = (html.match(/<button/g) || []).length;
  // Where they lead, when every one leads into the same top tab: each chip's
  // title is its tab trail, "Components › Items" (the maintainer, 2 October
  // 2026: "Links to Components" if all components, "Links to Data" if all
  // data). A chip with no trail (an action chip, "every frame") does not
  // decide it; two tabs among the rest, or none at all, keep plain "Links".
  const tops = new Set();
  html.replace(/<button\b[^>]*>/g, b => { const t = /\btitle="([^"›]+?)\s*(?:›|")/.exec(b); if (t) tops.add(t[1].trim()); return b; });
  const only = tops.size === 1 ? [...tops][0] : '';
  const where = only ? ' to ' + only : '';
  return '<details class="linksFold"' + (window.LINKS_OPEN ? ' open' : '') + ' ontoggle="linksFoldToggle(this)">' +
    '<summary>Links' + where + (n ? ' (' + n + ')' : '') + '</summary>' + html + '</details>';
}
function linksFoldToggle(el) { window.LINKS_OPEN = !!el.open; }

function partsStrip(title, chips, note) {
  if (!chips.length && !note) return '';
  return '<div class="partsStrip"><span class="partsTitle">' + svEsc(title) + '</span>' +
    chips.join('') + (note ? '<span class="partsNote">' + svEsc(note) + '</span>' : '') + '</div>';
}

// A dossier opened from a component's page lands under Entities > Characters,
// tabs and deep link included, rather than inside whatever gallery was open.
/* Open a detail view that lives under another category, as one step: the
   category switch is made with the history silent (syncDeepLink), the view
   is opened, and then the hash is written once. Every "Open X in Y" link
   from the World tab comes through here, which is also what makes them work
   from there at all: the atlas panel hides the sheet, and a detail drawn
   into the hidden sheet without the switch was the "Open cloth in Items does
   nothing" of 10 September 2026. */
window.NAV_SUPPRESS = false;
function openVia(cat, fn) {
  window.NAV_SUPPRESS = true;
  try { showCategory(cat); } finally { window.NAV_SUPPRESS = false; }
  fn();
  syncDeepLink();
}
function openCharacter(i) { openVia('CHARACTERS', () => showCharacterDetail(i)); }

/* One character's day, on the Schedules sheet under Components.

   A dossier used to chip its schedule straight at 0xF00B, the raw table
   under Data, which is the jump the maintainer asked to stop: a component
   should be reached through the Components tab that shows it, and the table
   underneath from there. Schedules became such a tab on 13 September 2026.

   The card's own id is what renderSchedulesSheet gives it. The open is
   deferred a tick because the sheet is built by the category switch and the
   card does not exist until it has run, the same reason mechLink waits. */
function openSchedule(i) {
  openVia('SCHEDULES', () => {
    setTimeout(() => {
      const el = document.getElementById('sched-' + i);
      if (!el) return;
      el.open = true;
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
}

// A person, wearing their portrait -- the face names the person where the
// sprite only names a class (the maintainer, 8 September 2026: a portrait is
// the better way to identify a character wherever one is cited). The sprite
// stands in where there is no portrait, the tab's tile where there is neither.
// `terse` names the record and not the person, for a row whose title is
// already the person's name (the schedules list).
function characterChip(i, terse) {
  let icon = '', face = false;
  try { const f = characterFace(i); if (f && f.url) { icon = f.url; face = true; } } catch (e) { icon = ''; }
  if (!icon) try {
    const c = loadCharacterTable()[i];
    const base = c ? getPropTileList()[c.proptype] : undefined;
    if (base !== undefined) icon = relIconURL({ tile: base + (c.aspect || 0) });
  } catch (e) { icon = ''; }
  if (!icon) { const leaf = TAB_BY_ID.get('characters'); icon = leaf ? relIconURL({ tile: leaf.tile }) : ''; }
  return relChip({ js: 'openCharacter(' + i + ')', main: terse ? 'character ' + i : characterName(i), sub: terse ? '' : 'character ' + i, icon, face,
                   title: 'Scenario › Characters' });
}

// What a person says over their head, from the bark catalogue: their own
// lines, and the shared idle script's where their dialogue hands off to it.
function characterSays(i) {
  let mine = [];
  try { mine = buildBarkCatalogue().filter(b => b.who === i); } catch (e) { mine = []; }
  if (!mine.length) return '';
  const lines = mine.flatMap(b => b.words).map(w => '“' + svEsc(w) + '”');
  return partsStrip('Says', ['<button class="navChip" onclick="showCategory(\'BARKS\')">Barks</button>'],
    lines.join(', '));
}

const HERO_CLASS_TEXT = [['Class names', 0x203], ['Class descriptions', 0x204], ['Class stats', 0x205], ['Class skills', 0x206]];

function characterParts(i, d) {
  const chips = [];
  const talk = 0x1800 + i;
  if (refExists(talk)) chips.push(partChip('Talk', talk));
  const portrait = 0x8800 + (i - 1);
  if (refExists(portrait)) chips.push(partChip('Portrait', portrait));
  if (d.tile) {
    const sheet = 0x8E00 + (d.tile >> 4);
    if (refExists(sheet)) chips.push(partChip('Sprite sheet', sheet));
  }
  const cls = 0x1000 + d.rec.proptype;
  if (d.rec.proptype && refExists(cls)) chips.push(partChip('Class script', cls));
  // The name itself is a component: character n is entry n+1 of the string
  // table 0x0201, which is what derivedCharacterName reads and what makes a
  // person the same person in every Cythera file.
  if (refExists(0x0201)) chips.push(partChip('Name label', 0x0201));
  // The hero is the one character the player makes, and what is offered at
  // creation is these four lists: the classes, what each is, and each one's
  // attributes and skills as text. Character 1 is the hero wherever the
  // scripts address characters by number (see the Creates in page-rules.js).
  if (i === 1) for (const [label, r] of HERO_CLASS_TEXT) if (refExists(r)) chips.push(partChip(label, r));
  if (refExists(0xF009)) chips.push(partChip('Record', 0xF009));
  // Through the Schedules sheet, not at the raw table: a component is
  // reached by the Components tab that shows it, and the bytes from there.
  if (d.schedule.length) chips.push(actionChip('Schedule', 'openSchedule(' + i + ')', d.notScheduled ? 'not scheduled, ' + d.notScheduled : 'their day'));
  return chips;
}

// A zone is a map, its prop list, and the scripts numbered like it: all 42
// entry scripts (0x14xx) and the three region scripts (0x15xx) in the
// shipped archive share their index with a map.
function mapParts(resid, propResid) {
  const level = resid & 0xFF;
  const chips = [];
  if (propResid && refExists(propResid)) chips.push(partChip('Prop list', propResid));
  if (refExists(0x1400 + level)) chips.push(partChip('Entry script', 0x1400 + level));
  if (refExists(0x1500 + level)) chips.push(partChip('Sub-zone script', 0x1500 + level));
  /* The backdrop the zone is drawn against is a component like the rest of
     them, and the page has read it all along without ever showing it: the
     entry script's one SetLandscapeImage call, which zoneLandscapeArg picks
     out. Zero and up is a strip at 0x8400 + n. The negatives are the
     engine's own backdrops and have no resource to chip at -- -1 is the
     wavy void behind Land King Hall, drawn from the pair 0x8F50/0x8F51 --
     so those are named rather than linked, because a chip that opens
     nothing is worse than a word. */
  try {
    const land = zoneLandscapeArg(level);
    if (land !== null && land >= 0 && refExists(0x8400 + land)) chips.push(partChip('Landscape', 0x8400 + land));
    else if (land === -1) chips.push(actionChip('Landscape', "showCategory('142')", 'the ethereal void'));
    else if (land !== null && land < 0) chips.push(actionChip('Landscape', "showCategory('131')", 'one the engine keeps'));
  } catch (e) { quiet(e); }
  return chips;
}

/* Who plays a sound, by every route the game has.

   The application reaches the archive's sounds through four routines, and all
   four add 0x9100 to a number: TAudio::PlaySound, PlayAmbientSound,
   BeginSpotSound and CalcAmbient (read 16 September 2026). Their callers are
   where the numbers come from:
     - the scripts' own calls: PlaySound, PlaySoundSync (slot 0xD4, which
       delvmod's table calls UnknownD4; the binary's routine there is
       cbPlaySoundSync) and PlayAmbientSound;
     - ShootEffect (cbMissileFX), whose eighth operand TGameViewer::DoMissile
       hands to the TSoundTracker that follows a thrown or shot thing;
     - TViewer::SetStage, for every loose prop whose class's SoundEffects
       begins with a number (FillIntfCache keeps that word per prop type),
       and for every kind-3 egg, whose prop-type field is the sound.
   PlayIFSound, the only other, plays the application's own snd resources.

   So a sound is a constant in one of those calls, or it reaches one as
     - an argument of a helper, named where the helper is called or queued as
       a task: AddTask's task n runs helper 0xC00 + n, which the helpers bear
       out (0xC44 sets the talk balloon for task 0x44, 0xC4F uses one thing on
       another for 0x4F, 0xC42 waits for 0x42);
     - a word of the table of the class the call reads, `class_member 0xKKWW`,
       or an entry of an array that word points at, by index: a weapon's miss
       and hit sounds, a bow's shot, a creature's cries;
     - an entry of a list the script builds in place, which is how 0x3041
       gives anyone without cries of their own the default ones;
     - the first word of a prop's SoundEffects, played where the prop stands;
     - an egg.
   Each is read from the shape of the instructions, following a local back to
   what was stored in it; nothing here names a routine's address or a class.
   The scripts are read through buildScriptTextIndex, whose listings hold only
   the functions dvmDiscover found: the archive's data blocks decode into
   thousands of false PlaySound calls if bytes are walked as code. Sound n is
   0x9100 + n, music n is 0x9000 + n. */
const SOUND_CALLS = { 'sys PlaySound': 0, 'sys UnknownD4': 0, 'sys PlayAmbientSound': 0, 'sys ShootEffect': 7 };

// Where a sound value in a listing comes from: {num}, {arg}, {key, word},
// {data}, each with a `slot` when an array is indexed.
function soundValueSources(ops, v, depth) {
  if (!v || !v.length || depth > 4) return [];
  const n = dvmValueNum(v);
  if (n !== null) return [{ num: n }];
  const a = dvmValueArg(v);
  if (a !== null) return [{ arg: a }];
  const last = v[v.length - 1];
  if (last.mn === 'index' && v.length >= 3) {
    const slot = dvmNum(v[v.length - 2]);
    if (slot === null) return [];
    return soundValueSources(ops, v.slice(0, -2), depth + 1)
      .filter(s => (s.key !== undefined && s.slot === undefined) || s.data !== undefined)
      .map(s => Object.assign({}, s, { slot }));
  }
  let m = /^class_member 0x([0-9A-F]{2})([0-9A-F]{2})$/.exec(last.text);
  if (m) return [{ key: parseInt(m[1], 16), word: parseInt(m[2], 16) }];
  if (v.length === 1 && last.mn === 'data') return [{ data: last.at }];
  m = v.length === 1 && /^local Var([0-9A-F]{2})$/.exec(last.text);
  if (m) {
    const out = [], set = 'set_local 0x' + m[1];
    ops.forEach((o, j) => { if (o.obj === last.obj && o.text === set) out.push(...soundValueSources(ops, dvmCallValues(ops, j)[0], depth + 1)); });
    return out;
  }
  return [];
}

DERIVED.SOUND_USAGE = null;
function buildSoundUsage() {
  if (DERIVED.SOUND_USAGE) return DERIVED.SOUND_USAGE;
  const u = { scripts: new Map(), classes: new Map(), lists: new Map(), props: new Map(), eggs: new Map(), music: new Map() };
  const put = (map, n, v) => { if (!(n > 0)) return; if (!map.has(n)) map.set(n, []); map.get(n).push(v); };
  const count = (map, n, resid) => {
    if (!(n > 0)) return;
    if (!map.has(n)) map.set(n, new Map());
    map.get(n).set(resid, (map.get(n).get(resid) || 0) + 1);
  };
  let index = [];
  try { index = buildScriptTextIndex(); } catch (e) { index = []; }
  const helpers = new Map(), fields = new Map();
  for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      if (o.text === 'sys PlayMusic') { count(u.music, dvmValueNum(dvmCallValues(ops, i)[0]), e.resid); return; }
      if (!(o.text in SOUND_CALLS)) return;
      for (const s of soundValueSources(ops, dvmCallValues(ops, i)[SOUND_CALLS[o.text]], 0)) {
        if (s.num !== undefined) count(u.scripts, s.num, e.resid);
        else if (s.arg !== undefined) helpers.set(e.resid, s.arg);
        else if (s.key !== undefined) {
          const tag = s.key + ':' + s.word + ':' + s.slot;
          if (!fields.has(tag)) fields.set(tag, { key: s.key, word: s.word, slot: s.slot, via: new Set() });
          fields.get(tag).via.add(e.resid);
        } else if (s.data !== undefined && s.slot !== undefined) {
          let list = null;
          try { list = dvmDataValue(smartDecrypt(getResourceBytes(ARCHIVE, e.resid), e.resid).data, s.data + 3); } catch (err) { quiet(err); }
          if (Array.isArray(list) && typeof list[s.slot] === 'number') put(u.lists, list[s.slot], e.resid);
        }
      }
    });
  }
  // A helper's sound is named by whoever calls it or queues it: for a call,
  // argument k is value k; for AddTask, value 0 is who and value 1 the task.
  if (helpers.size) for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      let k = null;
      const m = /^call_resource 0x([0-9A-F]+)\b/.exec(o.text);
      if (m && helpers.has(parseInt(m[1], 16))) k = helpers.get(parseInt(m[1], 16));
      else if (o.text === 'sys AddTask') {
        const t = dvmValueNum(dvmCallValues(ops, i)[1]);
        if (t !== null && helpers.has(0xC00 + t)) k = helpers.get(0xC00 + t) + 1;
      }
      if (k !== null) count(u.scripts, dvmValueNum(dvmCallValues(ops, i)[k]), e.resid);
    });
  }
  const soundEffects = Number(Object.keys(DVM_SYM.method).find(k => DVM_SYM.method[k] === 'SoundEffects'));
  for (let resid = 0x1000; resid < 0x2000; resid++) {
    const kind = dvmClassName(resid);
    if ((kind !== 'Item' && kind !== 'Monster') || !refExists(resid)) continue;
    let cls = null;
    try { cls = parseClassTable(resid); } catch (e) { cls = null; }
    if (!cls) continue;
    for (const f of fields.values()) {
      const n = classFieldNumber(cls, f.key, f.word, f.slot);
      if (n > 0) put(u.classes, n, { resid, key: f.key, word: f.word, slot: f.slot, via: [...f.via] });
    }
    const own = classFieldNumber(cls, soundEffects, 0);
    if (own > 0) put(u.props, own, resid);
  }
  for (const [n, eggs] of eggsOfKind(3)) for (const g of eggs) put(u.eggs, n, g);
  return (DERIVED.SOUND_USAGE = u);
}

// The sounds a class names, for its owner's parts strip.
function classSounds(resid) {
  const u = buildSoundUsage(), out = new Set();
  for (const [n, list] of u.classes) if (list.some(c => c.resid === resid)) out.add(n);
  for (const [n, list] of u.props) if (list.includes(resid)) out.add(n);
  return [...out].sort((a, b) => a - b).filter(n => refExists(0x9100 + n));
}

function soundUsageRows(resid, subn) {
  const u = buildSoundUsage();
  const rows = [];
  // A bare 0x0812 says little; refDescription turns it into "object script".
  const chipsFor = counts => [...(counts || new Map())].sort((a, b) => a[0] - b[0])
    .map(([r, c]) => svChip(r, (refDescription(r) || '') + (c > 1 ? ' ×' + c : '')));
  if (subn === 144) {
    const n = resid - 0x9100;
    const scripts = chipsFor(u.scripts.get(n));
    if (scripts.length) rows.push(['Played by', scripts, '']);
    const owners = [];
    const byClass = new Map();
    for (const c of u.classes.get(n) || []) if (!byClass.has(c.resid)) byClass.set(c.resid, itemFieldLabel(c.key));
    for (const r of u.props.get(n) || []) if (!byClass.has(r)) byClass.set(r, 'where it stands');
    for (const [r, what] of byClass) owners.push(...classOwnerChips(r, what));
    if (owners.length) rows.push(['Sound of', owners, '']);
    const lists = [...new Set(u.lists.get(n) || [])];
    if (lists.length) rows.push(['Default in', lists.map(r => svChip(r, 'for anyone with no sounds set')), '']);
    const eggs = u.eggs.get(n) || [];
    if (eggs.length) rows.push(['Heard in', zoneSquareChips(eggs), '']);
    if (!rows.length) rows.push(['Played by', [], 'Nothing plays this sound: no script, class, list or egg in the file names it.']);
  } else if (subn === 143) {
    const chips = chipsFor(u.music.get(resid - 0x9000));
    rows.push(['Played by', chips, chips.length ? '' :
      'No script names this music by number; the program starts some music itself.']);
  }
  return rows;
}

/* ---- What a component belongs to -------------------------------------------
   The maintainer's rule (13 September 2026): tapping almost anything should
   take you somewhere. A walk over every page under Components on 16 September
   found most of them led nowhere but back -- every landscape, every skill
   icon, most class scripts and nearly every room script -- because the joins
   existed in one direction only. A character chipped at its class script and
   the class script never named the character; a zone chipped at its
   landscape and the landscape never named a zone.

   These are the reverse of those chips, and they keep the rule the section
   comment above sets: each is a numbering the archive follows, never a name.

     0x1000 + prop type   the class of that prop type (dvmClassName's Item)
     0x1900 + n           the class of monster record n in 0xF008. The engine
                          numbers Monster objects as it numbers characters
                          (0x1800 + i is record i of 0xF009), and the file
                          bears it out: all 29 of the shipped 0x19xx scripts
                          land on a filled record, and the only one with a
                          line of its own, 0x191A's "Something smells bad.",
                          lands on the ooze.
     0x1A00 | n           skill or spell n, and 0x8A00 | n its icon
     0x1B00 + room        the room a kind-8 egg carries as its prop type,
                          which eggKinds already checks resolves
     0x8400 + n           the landscape a zone's entry script sets with n
     0xA00 + aspect       the potion the class 0x101F calls it for

     0x8Fxx               the window a class's script opens with it, read
                          by buildScriptedWindows

   The shared helpers and the default methods at 0x30xx are left out on
   purpose: they belong to no one thing, and "Referenced by" is already the
   honest row for them. */

// Where a class leads. Through openVia, so the tabs light and the deep link
// is written once, as a dossier opened from a component already does.
function openItem(pt, aspect) {
  openVia('ITEMS', () => { if (aspect === undefined) showItemDetail(pt); else propWordOpen(pt, aspect); });
}
function openUnit(idx) { openVia('MONSTERS', () => showMonsterDetail(idx)); }
function openPropType(pt) { openVia('PROPS', () => showPropTypeDetail(pt)); }

// A skill or a spell is a card on its sheet, not a page of its own, so this
// opens the sheet and then the card, deferred a tick for the reason
// openSchedule gives. A command has no card; the sheet is where it is listed.
function openClassCard(resid) {
  let spell = false;
  try { spell = spellRules().spells.some(s => s.resid === resid); } catch (e) { quiet(e); }
  openVia(spell ? 'SPELLS' : 'SKILLS', () => {
    setTimeout(() => {
      const el = document.getElementById((spell ? 'spell-' : 'skill-') + resid.toString(16));
      if (!el) return;
      el.open = true;
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
}

// A thing on a Scenario tab, wearing its own sprite where it has one.
function ownerChip(cat, js, main, sub, pt) {
  const leaf = TAB_LEAF_FOR.get(cat);
  let icon = '';
  if (pt !== undefined) icon = relIconURL({ icon: pt });
  if (!icon && leaf) icon = relIconURL({ tile: leaf.tile });
  return relChip({ js, main, sub, icon, title: leaf ? tabTrail(leaf) : '' });
}

// The thing a class is the class of: the units wearing a living prop type,
// else the item, else the prop type; a monster class's unit. `sub` says what
// the chip is for where the caller knows better than "unit" or "item".
function classOwnerChips(resid, sub) {
  const kind = dvmClassName(resid);
  if (kind === 'Monster') {
    const m = parseMonsterStats()[resid - 0x1900];
    return m && !m.blank ? [ownerChip('MONSTERS', 'openUnit(' + m.index + ')', propDisplayName(m.proptype) || 'record ' + m.index, sub || 'unit', m.proptype)] : [];
  }
  if (kind !== 'Item') return [svChip(resid)];
  const pt = resid - 0x1000;
  const units = parseMonsterStats().filter(m => !m.blank && m.proptype === pt);
  if (units.length) return units.map(m => ownerChip('MONSTERS', 'openUnit(' + m.index + ')', propDisplayName(pt) || 'record ' + m.index, sub || 'unit', pt));
  if (isInventoryItem(pt)) return [ownerChip('ITEMS', 'openItem(' + pt + ')', propDisplayName(pt) || 'prop type ' + pt, sub || 'item', pt)];
  if (getPropTileList()[pt] !== undefined) return [ownerChip('PROPS', 'openPropType(' + pt + ')', propDisplayName(pt) || 'prop type ' + pt, sub || 'prop type', pt)];
  return [];
}

// A zone's name, including the map numbered 0, which zoneDisplayName reads as
// "not placed in a zone".
function zoneLabel(z) { return z ? zoneDisplayName(z) : (labelFor(0x8000) || 'zone 0'); }

// Squares on the maps, a chip a zone: the first square opens, and the count
// says how many more there are.
function zoneSquareChips(spots) {
  const byZone = new Map();
  for (const s of spots) { if (!byZone.has(s.zone)) byZone.set(s.zone, []); byZone.get(s.zone).push(s); }
  return [...byZone].sort((a, b) => a[0] - b[0]).map(([z, list]) => relChip({
    js: 'showSquareOnMap(' + (0x8000 + z) + ',' + list[0].x + ',' + list[0].y + ')',
    main: zoneLabel(z), sub: 'at ' + list[0].x + ', ' + list[0].y,
    note: list.length > 1 ? '×' + list.length : '',
    title: trailForResid(0x8000 + z) }));
}

// Every egg in the file, by kind and then by its argument (the prop-type
// field): the zone and the square. A room is kind 8, an ambient sound kind 3.
DERIVED.EGGS = null;
function eggsOfKind(kind) {
  if (!DERIVED.EGGS) {
    const all = new Map();
    for (let z = 0; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      let list;
      try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
      for (const r of list) {
        if (r.flags !== 0x42) continue;
        if (!all.has(r.aspect)) all.set(r.aspect, new Map());
        const byArg = all.get(r.aspect);
        if (!byArg.has(r.proptype)) byArg.set(r.proptype, []);
        byArg.get(r.proptype).push({ zone: z, x: r.x, y: r.y });
      }
    }
    DERIVED.EGGS = all;
  }
  return DERIVED.EGGS.get(kind) || new Map();
}
function roomEggIndex() { return eggsOfKind(8); }

// The Combat AI section, on whichever Mechanics tab holds it.
function combatAiRuleChip() {
  const g = mechGroupOf('combatai');
  return relChip({ js: "showCategory('" + (g ? g.value : 'MECH_COMBAT') + "'); setTimeout(function(){ mechGo('combatai'); }, 60)",
                   main: 'Combat AI', sub: 'Mechanics' + (g ? ' › ' + g.title : ''), icon: g ? relIconURL({ tile: g.tile }) : '' });
}

function ownerRows(resid, subn) {
  const rows = [];
  if (subn === 15 || subn === 16 || subn === 24) {
    // A living prop type is a unit, and the unit's page lists the characters
    // who wear it; anything else is an item or, failing that, a prop type.
    const chips = classOwnerChips(resid);
    if (chips.length) rows.push(['Class of', chips, '']);
  }
  if (subn === 142) {
    // A picture a class's script opens as its window, read by buildScriptedWindows.
    let scripts = [];
    try { scripts = [...(buildScriptedWindows().byPicture.get(resid) || [])].sort((a, b) => a - b); } catch (e) { scripts = []; }
    const chips = scripts.flatMap(r => classOwnerChips(r));
    if (chips.length) rows.push(['Window of', chips, '']);
  }
  if (subn === 25 || subn === 137) {
    const cls = 0x1A00 | (resid & 0xFF);
    if (refExists(cls)) {
      let spell = false;
      try { spell = spellRules().spells.some(s => s.resid === cls); } catch (e) { quiet(e); }
      const kind = spell ? 'spell' : skillKind(cls) === 'command' ? 'command' : 'skill';
      const chip = ownerChip(spell ? 'SPELLS' : 'SKILLS', 'openClassCard(' + cls + ')',
                             selfNameFor(cls) || labelFor(cls) || kind, kind);
      rows.push([subn === 137 ? 'Icon of' : 'Script of', [chip], '']);
    }
  }
  if (subn === 26 || subn === 27 || subn === 29) {
    const eggs = roomEggIndex().get(resid - 0x1B00) || [];
    rows.push(['Room in', eggs.map(e => relChip({
      js: 'showSquareOnMap(' + (0x8000 + e.zone) + ',' + e.x + ',' + e.y + ')',
      main: zoneLabel(e.zone), sub: 'at ' + e.x + ', ' + e.y,
      title: trailForResid(0x8000 + e.zone) })),
      eggs.length ? '' : 'No zone places this room.']);
  }
  if (subn === 131) {
    // Every script that names this strip, the zone's own where it is an
    // entry script; a negative number is the strip with no sky
    // (landscapeSetters).
    const chips = [], said = new Set();
    for (const st of landscapeZones(resid)) {
      const key = st.resid + (st.sky ? '' : '-');
      if (said.has(key)) continue;
      said.add(key);
      chips.push(relChip({ js: 'jumpToScriptAt(' + st.resid + ',' + st.at + ')',
        main: landscapeSetterName(st.resid), sub: st.sky ? 'over the sky' : 'no sky',
        title: trailForResid(st.resid) }));
    }
    rows.push(['Set by', chips, chips.length ? '' : 'No script sets this landscape.']);
  }
  if (subn === 1 && HERO_CLASS_TEXT.some(([, r]) => r === resid) && loadCharacterTable()[1])
    rows.push(['Offered to', [characterChip(1)], '']);
  // The compiled combat AI and the scenario's own tests and actions are what
  // the Combat AI section on Mechanics describes; neither belongs to one unit.
  if (subn === 3 || subn === 8) rows.push(['Rules on', [combatAiRuleChip()], '']);
  if (subn === 9 && refExists(0x101F)) {
    let potion = null;
    try { potion = foodRules().potions.find(p => p.resid === resid); } catch (e) { quiet(e); }
    if (potion) rows.push(['Drunk as', [ownerChip('ITEMS', 'openItem(' + 0x1F + ',' + (resid - 0xA00) + ')', potion.name, 'aspect ' + (resid - 0xA00), 0x1F)], '']);
  }
  return rows;
}

function renderUsage(resid, subn) {
  const rows = [];
  const chars = loadCharacterTable();
  if (subn === 135) {
    const i = resid - 0x8800 + 1;
    if (chars[i]) rows.push(['Worn by', [characterChip(i)], '']);
  }
  if (subn === 23) {
    const i = resid - 0x1800;
    if (chars[i]) rows.push(['Spoken by', [characterChip(i)], '']);
  }
  if (subn === 19 || subn === 20) {
    const map = 0x8000 + (resid & 0xFF);
    if (refExists(map)) rows.push(['Runs for', [partChip(subn === 19 ? 'Zone' : 'Sub-zone of', map)], '']);
  }
  try { for (const r of ownerRows(resid, subn)) rows.push(r); } catch (e) { quiet(e); }
  if (subn === 144 || subn === 143) for (const r of soundUsageRows(resid, subn)) rows.push(r);
  let ins = [];
  try { ins = buildXrefIndex().inbound[resid] || []; } catch (e) { quiet(e); }
  if (ins.length) {
    const shown = ins.slice(0, 24);
    // A reference made by code opens that script ringed at the line that makes
    // it; one held in an array or a table opens the script, since a listing
    // prints an array as one line with no offset to ring.
    rows.push(['Referenced by', shown.map(e => svChip(e.from, (refDescription(e.from) || e.via) + (e.count > 1 ? ' ×' + e.count : ''),
      e.via === 'code' && Number.isFinite(e.at) ? 'jumpToScriptAt(' + e.from + ',' + e.at + ')' : undefined)),
               ins.length > shown.length ? 'and ' + (ins.length - shown.length) + ' more' : '']);
  }
  return rows.map(([t, c, n]) => partsStrip(t, c, n)).join('');
}

// --- Monster stats (0xF008) ------------------------------------------------
// 128 records of 16 bytes. The field map was the wiki's F008 page, and it holds
// up against this archive: record 22 is prop type 0x5A, which the prop-type
// list names "goat", and the wiki's own note says the goat is entry 0x16 = 22.
// Records 21/23/24 line up with bird, crab and ratlizard the same way.
//
// The useful part is that prop_type joins this table to everything else -- the
// sprite, the name, and any character wearing it -- so a monster stops being a
// row of hex and becomes a creature. corpse_type is packed the same way a prop
// record's aspect/proptype word is (6 bits aspect, 10 bits type), which is
// what says a dead goat is a goat at aspect 2 while an undead leaves "bones".

/* The 0xF008 flags word, decoded. Neither delvmod (monster.py is a stub) nor
   the wiki ever worked these out. They fell to a cross-reference: gandreas
   posted the authoritative monster attribute list on the old board (t1217;
   preserved at forums.cytheraguides.com/post/11047, tabulated on the
   cytheraguides Monster Stats page), and solving his labels against the
   archive's flag words gives every attribute exactly one bit, uniquely,
   with zero contradictions across 32 monsters. 0x4000 = bleeds is Bryce's
   (delvmod's rdasm header), confirmed by the same solve: every human and
   animal has it, no undead, construct, spirit or ooze does.

   Two bits remain unnamed. 0x1000 is bird + harpy + sea monster; 0x2000 is
   ghost, golem, harpy and the oozes. Do not guess labels for them here --
   an unlabeled bit prints as hex below, which is honest. 0x0004, on every
   humanoid, was a third until 26 September 2026: the program opens doors
   with it (exeUnitMoveRules, below).

   How the engine consumes these is not a guess: the default ResistDamage
   is a script in the archive, at 0x3040 -- default methods live at
   0x3000|method_id (subindex 47; the wiki's Object page pointed there).
   Its rules, in order: fire flag 0x0080 zeroes type-0x08 damage; electric
   flag 0x8000 zeroes type-0x20; resist-magic 0x0800 HALVES type-0x40;
   vulnerable-to-fire 0x0200 DOUBLES type-0x08; character status flag 23
   (Resist Fire, gator boots) zeroes type-0x08; resist-non-blunt 0x0400
   halves edged/piercing (type&0x03 without 0x04); and resist-non-magical
   0x0100 returns ZERO for any damage type with no magic bit (type&0xC0
   empty) -- total immunity, not a reduction. Armor then subtracts
   stochastically. So the lich, with 0x0100 and no fire bit, shrugs off
   bombs AND Fireball (both are pure type 0x08), exactly as in-game
   testing has confirmed -- while gandreas's published list stays
   correct that it has no fire immunity. 0x3040 contains no
   check for death-immunity 0x0020, so that flag must be tested by each
   spell -- which is where "Death Strike hurts demons despite Immune to
   Death" lives. */
/* Since 23 September 2026 a bit is named only where a script shows what it
   does, and the words say that (the maintainer had the typed names give way
   to the game's; the files name none of these bits). gandreas's list named
   0x0001 swim, 0x0002 fly, 0x0010 sleep and 0x0020 death immunity too, but no
   script tests those four. 0x0100, which the list called resisting
   non-magical weapons, returns zero damage in 0x3040. The program tests
   0x0001 and 0x0002 as a creature moves, and those names are read out of
   it (exeUnitMoveRules); 0x0002 turns out not to be flight. */
const MONSTER_FLAG_NAMES = [
  [0x0040, 'immune to poison'],          // 0x301F, 0x3041
  [0x0080, 'immune to fire'],            // 0x3040: type 0x08 returns 0; 0x301F
  [0x0100, 'immune to non-magical damage'], // 0x3040: no 0xC0 bit returns 0
  [0x0200, 'vulnerable to fire'],        // 0x3040: type 0x08 doubled
  [0x0400, 'resists non-blunt weapons'], // 0x3040: types 1 and 2 without 4 halved
  [0x0800, 'resists magic'],             // 0x3040: type 0x40 halved
  [0x2000, 'fades away with its parts when it dies'], // 0xE8D: each part (MonsterIterator) eroded, then hidden (flag 0x02)
  [0x4000, 'bleeds'],                    // 0xE8D leaves blood (prop type 77)
  [0x8000, 'immune to electricity'],     // 0x3040: type 0x20 returns 0 (Lightning)
];
/* The top half of the word is a field of its own, 0x33: GetField serves it
   by shifting the long at 8 right sixteen (exeMonsterFields reads which
   field that is). delvmod never named it, so the listings print `get_field
   0x33`, and the scan below for monster_flags could not see its tests;
   until 28 September 2026 the page called the half unidentified. Its bits
   are named here as the low half's are, from what the script that tests
   each does, and only where that test is found (monsterTopFlagSites). The
   bits are the field's; in the word they are these shifted up sixteen. */
const MONSTER_TOP_FLAG_NAMES = [
  [0x0001, 'fights with its body for its reflex'], // 0xE88: the margin starts from body
  [0x0002, 'takes no damage'],                     // 0x3040 returns 0 before anything else
  [0x0004, 'takes no edged damage'],               // 0x3040: type 0x01 returns 0
  [0x0008, 'poisons with its blows'],              // 0xE87 adds 0x100 to the type; 0x3041 sets flag 9 for it
];
function monsterFlagsText(f) {
  const bits = [];
  let rest = f >>> 0;
  for (const [bit, name] of MONSTER_FLAG_NAMES)
    if (f & bit) { bits.push(name); rest = (rest & ~bit) >>> 0; }
  const tops = monsterTopFlagSites();
  for (const [bit, name] of MONSTER_TOP_FLAG_NAMES) {
    const w = (bit << 16) >>> 0;
    if (tops.has(bit) && (f & w)) { bits.push(name); rest = (rest & ~w) >>> 0; }
  }
  if (rest) bits.push('+0x' + rest.toString(16).toUpperCase() + ' (' + monsterRestWord() + ')');
  return bits.length ? bits.join(' · ') : 'none set';
}
/* What the bits left over are called. With the program open every bit
   anything tests has its name, so what is left is read by nothing: the
   workbench's tools/unitflags_scan.mjs followed the word bit by bit from
   every load of it through the program and found no other test (two
   planted tests found, 1 October 2026), and no script reads fields 0x32 or
   0x33 but through a mask named here. On the shipped units that is 0x0010,
   0x0020 and 0x1000. Without the program the move rules and the top half
   are unnamed, so the rest is only unidentified. */
function monsterRestWord() { return appImage() ? 'read by nothing' : 'unidentified'; }

/* Where a script tests each flag bit: the `word N` that follows a
   `get_field monster_flags`, with its offset, so a flag on a monster's page
   opens the line that reads it. The default ResistDamage (0x3040) first,
   since most of the names say what it does; then every other script that
   tests the field, which is where poison (0x301F, 0x3041), bleeding and the
   parts that fade (0xE8D, the death script) are tested. Until 1 October
   2026 only 0x3040 was scanned and those three had no link. */
function monsterFlagSites() {
  if (DERIVED.MONSTER_FLAG_SITES) return DERIVED.MONSTER_FLAG_SITES;
  const out = new Map();
  try {
    const all = buildScriptTextIndex().filter(x => /get_field monster_flags\b/.test(x.text));
    all.sort((a, b) => (b.resid === 0x3040) - (a.resid === 0x3040));
    for (const e of all) {
      const ops = dvmOpsOf(e);
      for (let i = 0; i + 1 < ops.length; i++) {
        if (!/^get_field monster_flags\b/.test(ops[i].text)) continue;
        const m = /^(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(ops[i + 1].text);
        if (!m) continue;
        const mask = parseInt(m[1]);
        if (!out.has(mask)) out.set(mask, { resid: e.resid, at: ops[i + 1].at });
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_FLAG_SITES = out);
}
/* Where a script tests each bit of field 0x33, the top half: a `get_field`
   of the field the program serves that half with, a number, `bitwise_and`.
   The field's number is the program's (the handler with `srawi 16`), so
   with no application open nothing is found and the bits stay numbers, as
   a figure that is not read drops its sentence. Kept only once found. */
function monsterTopFlagSites() {
  if (!appImage()) return new Map();
  if (DERIVED.MONSTER_TOP_FLAG_SITES) return DERIVED.MONSTER_TOP_FLAG_SITES;
  const out = new Map();
  let mf = null;
  try { mf = appImage() ? exeMonsterFields() : null; } catch (e) { quiet(e, 'the unit fields, for the top half of the flags'); }
  const f = mf && mf.fields.find(x => x.half === 'high');
  if (!f) return out;
  try {
    const named = DVM_SYM.field[String(f.field)];
    const spelt = '(?:0x' + f.field.toString(16).toUpperCase() + '\\b' + (named ? '|' + named + '\\b' : '') + ')';
    const hint = new RegExp('get_field ' + spelt), get = new RegExp('^get_field ' + spelt);
    for (const e of buildScriptTextIndex()) {
      if (!hint.test(e.text)) continue;
      const ops = dvmOpsOf(e);
      for (let i = 0; i + 2 < ops.length; i++) {
        if (!get.test(ops[i].text) || !/^bitwise_and$/.test(ops[i + 2].text)) continue;
        const m = /^(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(ops[i + 1].text);
        if (m && !out.has(parseInt(m[1]))) out.set(parseInt(m[1]), { resid: e.resid, at: ops[i + 1].at });
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_TOP_FLAG_SITES = out);
}
// The units whose field 0x33 has a bit, by the unit table: for the combat
// section's count of who fights with the body. Empty with no program open.
function unitsWithTopFlag(bit) {
  if (!monsterTopFlagSites().has(bit)) return [];
  return parseMonsterStats().filter(m => m && !m.blank && ((m.flags >>> 16) & bit));
}
/* What the program does with a unit's flags as the creature moves, read on
   26 September 2026, when the maintainer's list asked what gandreas's "Can
   Fly" does (until then nothing here was to say a creature flies).
   TActiveMonster::GetMonstAttrs hands TGameSys::CanMove the word at 8 of
   the unit the monster points to (its field at 4, set from ObjToMonst),
   with 0x80000000 for a party member and 0x80 from its character, and
   TGameSys::TryMove passes it through unchanged. The square's word is the
   attribute words of its tile and of every thing on it ORed together
   (TViewer::SetStage fills the grid, BuildStageEntry copies a square out).
   So each place CanMove tests one of the unit's bits beside one of the
   square's, with a result straight after, is a rule:

   - square, then unit: a unit with the bit may go where the rest may not.
     Inside the stretch that runs only for a square that blocks (0x200, the
     bit tilePassable walks by), 0x0001 and 0x0002 get onto water and pools
     (0x100) and 0x40000000 onto a mousehole (0x80000000); outside it, lava
     (0x10000 with 0x800, tested whole) is closed to a unit without 0x0080.
   - unit, then square, then `li 3, 0`: the unit is kept to the squares with
     the bit (`bf`: 0x20000000, the tentacle and the sea monster, to water,
     pool and shore) or off them (`bt`: 0x10000000, the child, the gator,
     the goat, the unicorn and the titan, off rope and fence).

   A rule wanting two of the unit's bits at once (a door, for 0x0C with
   0x08000000, which no unit carries) has a third test where the result
   would be and is left out. Two single tests read the word through the
   monster's own pointer: TActiveMonster::HandleMove, on a square carrying
   0x800, skips the ground's method for a unit with 0x0002 (StepOn, 31,
   which no class defines, so the default 0x301F: the swamp, lava, a rune's
   UseOn), and TActiveMonster::CanMove, when its way is shut, runs a door's
   Use for a unit with 0x0004. So 0x0002, gandreas's "Can Fly", is water and
   a step that sets nothing off; nothing in the program is flight.

   The kinds ('onto', 'only', 'off', 'steps', 'doors') are this reading's;
   the bits, both sides of each rule, and the instructions are read. */
function exeUnitMoveRules() {
  if (!appImage()) return null;
  if (DERIVED.UNIT_MOVE_RULES !== undefined) return DERIVED.UNIT_MOVE_RULES;
  const out = [];
  const bits = (mb, me) => { let x = 0; for (let b = mb; b <= me; b++) x |= 1 << (31 - b); return x >>> 0; };
  try {
    const ops = exeOpsNamed('TGameSys::CanMove');
    // The unit's word is the third argument, copied out of r6 at the top;
    // the square's is the first word of the entry BuildStageEntry fills,
    // loaded back from the stack slot handed to it in r4.
    const argAt = exeFind(ops, 0, 16, d => d.mn === 'addi' && d.ra === 6 && d.imm === 0);
    const bse = ops.findIndex(o => exeCalls(o, 'TViewer::BuildStageEntry'));
    const slotAt = bse >= 0 ? exeFindBack(ops, bse - 1, 24, d => d.mn === 'addi' && d.rd === 4 && d.ra === 1) : -1;
    const sqAt = slotAt >= 0 ? exeFind(ops, bse + 1, 8, d => d.mn === 'lwz' && d.ra === 1 && d.d === ops[slotAt].d.imm) : -1;
    const unitReg = argAt >= 0 ? ops[argAt].d.rd : null, sqReg = sqAt >= 0 ? ops[sqAt].d.rt : null;
    // A constant built by `lis r, hi` and `addi r, r, lo` just before op i.
    const constBefore = (i, r) => {
      const a = ops[i - 2] && ops[i - 2].d, b = ops[i - 1] && ops[i - 1].d;
      return a && b && a.mn === 'lis' && a.rd === r && b.mn === 'addi' && b.rd === r && b.ra === r ? ((a.imm << 16) + b.imm) >>> 0 : null;
    };
    // A bit test at op i: its register and mask, whether the code goes on
    // when the bits are set, where it starts and the op after its branch.
    const testAt = i => {
      const d = ops[i] && ops[i].d; if (!d) return null;
      let reg = null, mask = null, from = i, br = i + 1, whole = false;
      if (d.mn === 'rlwinm.' && d.sh === 0) { reg = d.rs; mask = bits(d.mb, d.me); }
      else if (d.mn === 'andi.') { reg = d.rs; mask = d.imm >>> 0; }
      else if (d.mn === 'and.') { reg = d.rs; mask = constBefore(i, d.rb); from = i - 2; }
      else if (d.mn === 'and') {
        // `and t, reg, c`, `addis 0, t, -hi`, `cmplwi 0, lo`: all of c set.
        const c = constBefore(i, d.rb), e = ops[i + 1] && ops[i + 1].d, f = ops[i + 2] && ops[i + 2].d;
        if (c !== null && e && f && e.mn === 'addis' && e.ra === d.ra && f.mn === 'cmplwi' && (((-e.imm << 16) + f.imm) >>> 0) === c) {
          reg = d.rs; mask = c; from = i - 2; br = i + 3; whole = true;
        }
      }
      const b = ops[br] && ops[br].d;
      if (mask === null || !b || !b.conditional || b.bi !== 2 || (b.mn !== 'bt' && b.mn !== 'bf')) return null;
      return { reg, mask, from, at: ops[i].at, next: br + 1, target: ops[br].to, onSet: whole ? b.mn === 'bf' : b.mn === 'bt' };
    };
    const result = i => { const d = ops[i] && ops[i].d; return d && d.mn === 'li' && d.rd === 3 ? d.imm : null; };
    if (unitReg !== null && sqReg !== null) {
      const tests = [];
      for (let i = 0; i < ops.length; i++) { const t = testAt(i); if (t && (t.reg === unitReg || t.reg === sqReg)) tests.push(t); }
      for (let k = 0; k + 1 < tests.length; k++) {
        const a = tests[k], b = tests[k + 1], res = result(b.next);
        if (b.from !== a.next || res === null) continue;
        if (a.reg === sqReg && b.reg === unitReg && a.onSet && ((b.onSet && res === 1) || (!b.onSet && res === 0))) {
          // The square bits of every stretch this rule sits inside.
          const within = tests.filter(h => h.reg === sqReg && h.onSet && h.at < a.at && h.target !== null && h.target > a.at)
                              .reduce((m, h) => (m | h.mask) >>> 0, 0);
          out.push({ kind: 'onto', unit: b.mask, square: (a.mask | within) >>> 0, only: a.mask, at: b.at });
        } else if (a.reg === unitReg && b.reg === sqReg && a.onSet && res === 0) {
          out.push({ kind: b.onSet ? 'off' : 'only', unit: a.mask, square: b.mask, at: a.at });
        }
      }
    }
    // The two tests of the word through the monster's pointer to its unit:
    // `lwz u, 4(m)`, `lwz w, 8(u)`, `rlwinm. _, w, 0, b, b`.
    for (const [name, kind] of [['TActiveMonster::HandleMove', 'steps'], ['TActiveMonster::CanMove', 'doors']]) {
      const hops = exeOpsNamed(name);
      for (let i = 0; i + 2 < hops.length; i++) {
        const a = hops[i].d, b = hops[i + 1].d, c = hops[i + 2].d;
        if (a && b && c && a.mn === 'lwz' && a.d === 4 && b.mn === 'lwz' && b.d === 8 && b.ra === a.rt &&
            c.mn === 'rlwinm.' && c.sh === 0 && c.rs === b.rt) out.push({ kind, unit: bits(c.mb, c.me), at: hops[i + 2].at });
      }
    }
    // The party's mark, 0x80000000, which GetMonstAttrs ORs in for a party
    // member and the king's unit carries itself (Alaric is drawn with it).
    // CanMove tests it twice: first beside the walk-through-walls byte
    // option-w flips with cheats on, answering 1 at once, then, on a square
    // that blocks, before letting the mover onto it when what blocks it is
    // a character with the party bit (0x40 of its byte 8). The name says the
    // second, which is all it does in play; it said "moves as a party
    // member" for an hour on 1 October 2026, which the maintainer read as
    // walking through walls, and that needs cheats.
    // The rule is the last test of the unit's word for that bit alone.
    if (unitReg !== null) {
      let last = null;
      for (let i = 0; i < ops.length; i++) { const t = testAt(i); if (t && t.reg === unitReg && t.mask === 0x80000000) last = t; }
      if (last) out.push({ kind: 'party', unit: 0x80000000, at: last.at });
    }
  } catch (e) { quiet(e); }
  return (DERIVED.UNIT_MOVE_RULES = out.length ? out : null);
}
// How many squares of all the maps hold each tile.
function mapTileCensus() {
  if (DERIVED.MAP_TILE_CENSUS) return DERIVED.MAP_TILE_CENSUS;
  const n = new Uint32Array(0x2000);
  for (let k = 0; k < subindexCount(ARCHIVE, 127); k++) {
    const resid = 0x8000 + k;
    try {
      const raw = getResourceBytes(ARCHIVE, resid);
      if (!raw) continue;
      let data = smartDecrypt(raw, resid).data, m = parseDelverMap(data);
      if (!m) { data = decryptResource(raw, resid); m = parseDelverMap(data); }
      if (!m) continue;
      for (let s = 0; s < m.width * m.height; s++) n[u16be(data, m.mapDataOffset + 2 * s) & 0x1FFF]++;
    } catch (e) { quiet(e); }
  }
  return (DERIVED.MAP_TILE_CENSUS = n);
}
/* The 0xF004 names of the tiles whose attribute words carry all of `bits`:
   the ones the maps place, most-placed first, or where the maps place none,
   the art of the things that carry them (the mousehole, rope and fence are
   things), which then take "a". */
function tileNamesCarrying(bits) {
  const attrs = getTileAttributes(ARCHIVE);
  if (!attrs || !attrs.length) return null;
  const placed = mapTileCensus(), count = new Map();
  const has = t => ((attrs[t] & bits) >>> 0) === (bits >>> 0);
  for (let t = 0; t < attrs.length; t++) if (placed[t] && has(t)) { const nm = terrainNameFor(t); if (nm) count.set(nm, (count.get(nm) || 0) + placed[t]); }
  const onMaps = count.size > 0;
  if (!onMaps) for (let t = 0; t < attrs.length; t++) if (has(t)) { const nm = terrainNameFor(t); if (nm && !count.has(nm)) count.set(nm, 1); }
  if (!count.size) return null;
  const names = [...count.entries()].sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const list = names.length < 2 ? names[0] : names.slice(0, -1).join(', ') + ' or ' + names[names.length - 1];
  return onMaps ? list : 'a ' + list;
}
/* The names the program's movement rules give a unit's bits, each with the
   instruction that tests it: [{ mask, name, site }], or none with no
   application open. A bit the rule reads that no unit carries (0x0008) is
   named on no page, since only a unit's own bits are looked up. */
function monsterMoveNames() {
  if (DERIVED.MONSTER_MOVE_NAMES !== undefined) return DERIVED.MONSTER_MOVE_NAMES;
  const rules = exeUnitMoveRules(), out = [];
  for (const r of rules || []) {
    let name = null;
    if (r.kind === 'steps') name = 'sets off nothing it steps on';
    else if (r.kind === 'doors') name = 'opens doors';
    else if (r.kind === 'party') name = 'can move onto a party member\u2019s square';
    else {
      const where = tileNamesCarrying(r.square) || (r.only !== undefined ? tileNamesCarrying(r.only) : null);
      if (where) name = (r.kind === 'onto' ? 'can move onto ' : r.kind === 'only' ? 'moves only onto ' : 'cannot move onto ') + where;
    }
    if (name) out.push({ mask: r.unit, name, site: { v: r.unit, exe: r.at } });
  }
  return (DERIVED.MONSTER_MOVE_NAMES = out);
}
function monsterFlagsHTML(f) {
  const sites = monsterFlagSites();
  const named = [];
  let rest = f >>> 0;
  for (const [bit, name] of MONSTER_FLAG_NAMES)
    if (f & bit) { const s = sites.get(bit); named.push({ low: bit, html: s ? srcNum(s, name) : svEsc(name) }); rest = (rest & ~bit) >>> 0; }
  // The program's names only with the program open: without it the bits
  // stay numbers, as a figure that is not read drops its sentence.
  if (appImage())
    for (const m of monsterMoveNames())
      if (f & m.mask) { named.push({ low: (f & m.mask & -(f & m.mask)) >>> 0, html: srcNum(m.site, m.name) }); rest = (rest & ~m.mask) >>> 0; }
  const tops = monsterTopFlagSites();
  for (const [bit, name] of MONSTER_TOP_FLAG_NAMES) {
    const w = (bit << 16) >>> 0, site = tops.get(bit);
    if (site && (f & w)) { named.push({ low: w, html: srcNum(site, name) }); rest = (rest & ~w) >>> 0; }
  }
  named.sort((a, b) => a.low - b.low);
  const bits = named.map(x => x.html);
  if (rest) bits.push('+0x' + rest.toString(16).toUpperCase() + ' (' + monsterRestWord() + ')');
  return bits.length ? bits.join(' · ') : 'none set';
}

function parseMonsterStats() {
  if (DERIVED.MONSTER_STATS) return DERIVED.MONSTER_STATS;
  const out = [];
  try {
    const d = getResourceBytes(ARCHIVE, 0xF008);
    if (d) {
      for (let i = 0; i * 16 + 16 <= d.length; i++) {
        const p = i * 16, r = d.subarray(p, p + 16);
        let blank = true;
        for (const v of r) if (v) { blank = false; break; }
        const cw = u16be(r, 14);
        // The layout is GetField's second jump table (exeMonsterFields),
        // not a guess: field 44 reads byte 0 and so on down to field 54,
        // the halfword at 14. Two corrections came out of reading it. The
        // special flags are the WORD at 8, and this parsed the halfword at
        // 10, so the top half -- set on eleven of the fifty -- was never
        // shown. And byte 6 is delvmod's `alignment`, which used to be
        // swallowed by an "unknown2" spanning bytes 6 to 9, a field that
        // straddled the alignment and half the flags and meant nothing.
        out.push({
          index: i, blank, raw: r,
          body: r[0], reflex: r[1], mind: r[2], armor: r[3], damage: r[4], hp: r[5],
          alignment: r[6], unknown7: r[7],
          flags: u32be(r, 8),
          proptype: u16be(r, 12),
          corpseWord: cw, corpseType: cw & 0x03FF, corpseAspect: (cw >> 10) & 0x3F
        });
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_STATS = out);
}

function renderMonsterSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const recs = parseMonsterStats().filter(r => !r.blank);
  const tiles = getPropTileList();
  for (const r of recs) {
    const cell = document.createElement('div');
    cell.className = 'cell propCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    const base = tiles[r.proptype];
    if (base !== undefined) {
      // Assembled the way the program builds it, facing the reader.
      // Every unit at the same pixels a square, and the cell grows to hold
      // it: the hydra covers nine squares and the crab one, and they are
      // drawn at one scale so the two can be compared.
      const spr = drawUnitSprite(r.proptype, GALLERY_TILE_PX);
      fitGalleryCell(cell, wrap, spr);
      if (spr) { wrap.appendChild(spr.canvas); animateUnitSprite(spr); }
    }
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = unitNameHTML(r.proptype);
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    sub.textContent = 'B' + r.body + ' R' + r.reflex + ' M' + r.mind +
                      ' \u00b7 ' + r.hp + ' hp' + (r.armor ? ' \u00b7 ' + r.armor + ' armor' : '');
    cell.appendChild(sub);
    cell.onclick = () => showMonsterDetail(r.index);
    grid.appendChild(cell);
  }
  out.textContent = recs.length + ' units defined in 0xF008 (of ' +
                    parseMonsterStats().length + ' record slots).';
}

/* ---- byte 4 of a unit's record ------------------------------------------
   The delvmod wiki's field table calls it "unknown1, probably size" (the
   page used to say that was gandreas's list, which has no such field and
   never prints this byte), and the guess was wrong: nothing in the
   application reads it. What does
   read it is a script, through GetField -- the field whose handler loads
   byte 4 (exeMonsterFields) -- and exactly one script in the shipped file
   asks for that field. It builds a blow as the byte plus a random amount
   drawn from the attacker's Body and hands the sum to the damage helper,
   so the byte is the fixed part of what a blow does.

   The figures agree with that and not with size: a bird 1, a child 2, a
   crab 8, a gator 10, and the king 100 beside 255 health and 30 armor.
   That corroboration is in GRIMOIRE-NOTES.md and not in the sentence the
   page prints, which says what the script does and stops.

   The site is found rather than written down: the field number comes from
   the executable and the line from the script that names it. Null with no
   application open, and then the page says only that the byte is byte 4. */
DERIVED.MONSTER_DAMAGE_SITE = undefined;
function monsterDamageSite() {
  if (DERIVED.MONSTER_DAMAGE_SITE !== undefined) return DERIVED.MONSTER_DAMAGE_SITE;
  let out = null;
  try {
    const mf = appImage() ? exeMonsterFields() : null;
    const f = mf && mf.fields.find(x => x.offset && x.offset.v === 4);
    if (f) {
      const named = DVM_SYM.field[String(f.field)];
      const tag = new RegExp('^\\s*([0-9A-Fa-f]{4})\\s+get_field\\s+(?:0x' +
        f.field.toString(16).toUpperCase() + '\\b|' + (named ? named + '\\b' : '(?!)') + ')', 'm');
      for (const e of buildScriptTextIndex()) {
        const m = tag.exec(e.text);
        if (m) { out = { resid: e.resid, at: parseInt(m[1], 16), field: f.field }; break; }
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_DAMAGE_SITE = out);
}
function monsterByteNote() {
  const site = monsterDamageSite();
  if (!site) return 'The damage of the creature’s blow.';
  return 'A blow does this damage plus a random amount based on Body (' +
    srcNum({ resid: site.resid, at: site.at }, 'the script') + ').';
}

function showMonsterDetail(idx) {
  stopSpriteAnimations();
  markDetailView('monster', idx);
  const grid = document.getElementById('sheetGrid');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All units';
  back.onclick = renderMonsterSheet;
  grid.appendChild(back);

  const r = parseMonsterStats()[idx];
  if (!r) return;
  const tiles = getPropTileList();
  const nm = unitDisplayName(r.proptype) || ('prop type 0x' + r.proptype.toString(16).toUpperCase());
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:560px;margin:12px auto;text-align:left';

  let h = '<div style="font-size:1.25rem;color:#fff">' + svEsc(nm) +
          '</div><div style="font-size:0.75rem;color:#b5b2a8;margin-bottom:10px">' +
          'record ' + srcNum({ resid: 0xF008, byte: r.index * 16, stride: 16, what: 'the whole record' }, String(r.index)) +
          ' of 0xF008 \u00b7 prop type ' +
          srcNum({ resid: 0xF008, byte: r.index * 16 + 12, stride: 16, what: 'the prop type ObjToMonst searches on' },
                 '0x' + r.proptype.toString(16).toUpperCase()) + '</div>';
  // Every figure opens the instruction that reads its byte: the handler
  // GetField jumps to for the field a script asks for. `stat` takes the
  // byte's offset in the record and finds the field whose handler loads it.
  const mf = appImage() ? exeMonsterFields() : null;
  const fieldAt = off => mf ? mf.fields.find(f => f.offset && f.offset.v === off) : null;
  const stride = mf && mf.stride ? mf.stride.v : 16;
  // The byte it was read from, always; the field that reads it named in
  // the title where the application is open.
  const stat = (off, v) => {
    const f = fieldAt(off);
    return srcNum({ resid: 0xF008, byte: r.index * stride + off, stride,
                    what: f ? 'field ' + f.field + ' reads it' : null }, String(v));
  };
  // Which character stat each of the first three bytes becomes, read off the
  // constructor that copies them (exeMonsterStatCopy); each name opens the
  // store. With no application open, the names the record has always had.
  const copy = appImage() ? exeMonsterStatCopy() : null;
  const statNames = ['Body', 'Reflex', 'Mind'].map((dflt, k) => {
    const c = copy && copy[k];
    return c && c.name ? srcNum(c.to, c.name.charAt(0).toUpperCase() + c.name.slice(1)) : dflt;
  }).join(' / ');
  h += '<div class="sv-facts">' +
    '<div><b>' + statNames + '</b>' + stat(0, r.body) + ' \u00b7 ' + stat(1, r.reflex) + ' \u00b7 ' + stat(2, r.mind) + '</div>' +
    '<div><b>Health</b>' + stat(5, r.hp) + (r.armor ? ' &nbsp; <b>Armor</b> ' + stat(3, r.armor) : '') +
      (r.damage ? ' &nbsp; <b>Damage</b> ' + stat(4, r.damage) : '') +
      ' &nbsp; <b>Alignment</b> ' + stat(6, r.alignment) + alignmentNameHTML(r.alignment) +
      '<br><span style="font-size:0.6875rem;color:#8c8980">' + monsterByteNote() + '</span></div>' +
    '<div><b>Special flags</b>' + srcNum({ resid: 0xF008, byte: r.index * stride + 8, stride, what: 'the special flags' },
      '0x' + r.flags.toString(16).toUpperCase().padStart(8, '0')) +
      ' <span style="font-size:0.6875rem;color:#b5b2a8">' + monsterFlagsHTML(r.flags) + '</span>' +
      '<br><span style="font-size:0.6875rem;color:#8c8980">Click a flag to see the line that checks it.</span></div>' +
    '</div>';
  panel.innerHTML = h;

  // The unit as the program builds it, then every frame of its own.
  const base = tiles[r.proptype];
  if (base !== undefined) {
    const whole = drawUnitSprite(r.proptype, 48);
    if (whole && whole.unit) {
      const u = whole.unit;
      const box = document.createElement('div');
      box.style.cssText = 'display:flex;gap:14px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap';
      const holder = document.createElement('div');
      holder.style.cssText = 'padding:6px;background:#1c1913;border:1px solid #33302a';
      holder.appendChild(whole.canvas);
      animateUnitSprite(whole);
      box.appendChild(holder);
      const how = document.createElement('div');
      how.style.cssText = 'font-size:0.75rem;color:#b5b2a8;line-height:1.5;max-width:380px';
      const lay = u.layout ? 'Layout ' + srcNum({ resid: u.layout.resid, at: u.layout.at }, String(u.layout.code)) : 'No layout';
      const app = appImage();
      if (u.kind === 'octo') how.innerHTML = lay + ': <b>a body with ' + (u.rule ? srcNum(u.rule.arms, u.rule.arms.v + ' arms') : '8 arms') + '</b> of ' +
        (u.arm !== null ? svLink(propDisplayName(u.arm) || ('prop ' + u.arm), 'showMonsterDetail(' + (parseMonsterStats().findIndex(m => m.proptype === u.arm)) + ')') : 'no class') +
        ', the class named by its key 54, with arm <i>i</i> at aspect <i>i</i> \u00d7 ' +
        (u.rule && u.rule.aspectStep ? srcNum(u.rule.aspectStep, String(u.step)) : String(u.step)) +
        ' (the frames for one direction) on the ' + (u.rule ? srcNum(u.rule.dx, 'eight squares') : 'eight squares') + ' around it' +
        '.' + (app ? ' ' + pefChip('TOctoMonster::TOctoMonster') : '');
      else if (u.kind === 'crawl') how.innerHTML = lay + ': <b>a head with its tail behind it</b>; the tail is a second record at the head’s aspect plus ' + (u.rule ? srcNum(u.rule.tailOffset, '8') : '8') +
        '. The layout decides which kind it is.' + (app ? ' ' + pefChip('TCrawlMonster::TCrawlMonster') + pefChip('TActiveMonster::CreateMonster') : '');
      else if (u.kind === 'span') how.innerHTML = lay + ': one record, and <b>its tiles span ' + whole.cols + ' by ' + whole.rows + '</b> according to their attributes, as a thing placed in the world does.';
      else how.innerHTML = lay + ': one record, one tile; the layout decides the frame.' + (app ? ' ' + pefChip('TActiveMonster::AdjustAspect') : '');
      box.appendChild(how);
      panel.appendChild(box);
    }
    const info = spriteFrameInfo(0, r.proptype);
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:12px';
    for (const f of info.present.slice(0, 16)) {
      const holder = document.createElement('div');
      holder.style.cssText = 'width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#1c1913;border:1px solid #33302a;overflow:hidden';
      const spr = drawPropSprite(base + f, 20);
      if (spr) holder.appendChild(spr.canvas);
      imageOpens(holder, sheetOfTile(base + f), 'frame ' + f + ', sheet');
      strip.appendChild(holder);
    }
    panel.appendChild(strip);
  }

  // What it leaves behind. This is the field that makes the table worth
  // reading: an undead leaves bones, a goat leaves a goat at aspect 2.
  const cd = document.createElement('div');
  cd.style.cssText = 'font-size:0.8125rem;line-height:1.7;margin-bottom:10px';
  if (r.corpseWord) {
    const cnm = propDisplayName(r.corpseType) || ('0x' + r.corpseType.toString(16).toUpperCase());
    const cSrc = { resid: 0xF008, byte: r.index * 16 + 14, stride: 16, what: 'the corpse word' };
    cd.innerHTML = '<b style="color:#b5b2a8">Leaves behind</b> ' + svEsc(cnm) +
                   ' at aspect ' + srcNum(cSrc, String(r.corpseAspect)) +
                   ' <span style="font-size:0.6875rem;color:#8c8980">(' +
                   srcNum(cSrc, '0x' + r.corpseWord.toString(16).toUpperCase().padStart(4, '0')) + ')</span>';
    const cbase = tiles[r.corpseType];
    if (cbase !== undefined) {
      const spr = drawPropSprite(cbase + r.corpseAspect, 40);
      if (spr) { spr.canvas.style.marginTop = '6px'; imageOpens(spr.canvas, sheetOfTile(cbase + r.corpseAspect), 'sheet'); cd.appendChild(spr.canvas); }
    }
  } else {
    cd.innerHTML = '<b style="color:#b5b2a8">Leaves behind</b> nothing.';
  }
  panel.appendChild(cd);
  // The components: its class script, the sheet its sprite is cut from, and
  // the stats table this record is a row of.
  {
    const chips = [];
    const cls = 0x1000 + r.proptype;
    if (r.proptype && refExists(cls)) chips.push(partChip('Class script', cls));
    const base = tiles[r.proptype];
    if (base !== undefined && refExists(0x8E00 + (base >> 4))) chips.push(partChip('Sprite sheet', 0x8E00 + (base >> 4)));
    for (const n of classSounds(0x1900 + r.index)) chips.push(partChip('Sound', 0x9100 + n));
    if (refExists(0xF008)) chips.push(partChip('Stats table', 0xF008));
    chips.push(actionChip('Prop type', 'showPropTypeDetail(' + r.proptype + ')', 'every frame'));
    const made = document.createElement('div');
    made.innerHTML = linksFold(partsStrip('Made of', chips));
    panel.appendChild(made);
  }

  // Named characters wearing this sprite.
  const users = [];
  try {
    const chars = loadCharacterTable();
    for (let i = 1; i < chars.length; i++) if (chars[i].proptype === r.proptype) users.push(i);
  } catch (e) { quiet(e); }
  if (users.length) {
    const u = document.createElement('div');
    u.style.cssText = 'font-size:0.8125rem;line-height:1.9;margin-bottom:10px';
    u.innerHTML = '<b style="color:#b5b2a8">Characters using this sprite</b><br>' +
      users.slice(0, 30).map(i => '<button class="sv-chip" onclick="showCharacterDetail(' + i + ')">' +
        svEsc(characterName(i)) + '</button>').join(' ');
    panel.appendChild(u);
  }

  // The record itself, a byte at a time, each one opening its own byte in
  // the table. This is the bottom of the chain: below it there is only the
  // file.
  const raw = document.createElement('div');
  raw.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.6875rem;color:#b5b2a8';
  raw.innerHTML = 'raw: ' + Array.from(r.raw).map((b, k) =>
      srcNum({ resid: 0xF008, byte: r.index * 16 + k, stride: 16, what: 'byte ' + k },
             b.toString(16).padStart(2, '0'))).join(' ') +
    (r.unknown7 ? '<br><span style="color:#8c8980">byte 7 is ' + r.unknown7 + ', which no field reads</span>' : '');
  panel.appendChild(raw);
  grid.appendChild(panel);
  document.getElementById('output').textContent = nm + ', record ' + r.index + ' of 0xF008';
}

// --- Record-width inspector ------------------------------------------------
// For the F0xx tables that genuinely have no field map. Guessing a stride is
// the first step in reading any of them, so let the stride be chosen and show
// the consequences: rows as raw bytes and as big-endian words, with the
// leftover tail called out, since a stride that divides evenly is usually the
// right one.
window.TABLE_WIDTH = 16;
function setTableWidth(w) { window.TABLE_WIDTH = +w; renderTableInspector(window.CUR_TABLE_RESID); }

function renderTableInspector(resid) {
  const host = document.getElementById('tableInspector');
  if (!host) return;
  window.CUR_TABLE_RESID = resid;
  let d = null;
  try { d = smartDecrypt(getResourceBytes(ARCHIVE, resid), resid).data; } catch (e) { quiet(e); }
  if (!d || !d.length) { host.style.display = 'none'; return; }
  host.style.display = '';
  const w = window.TABLE_WIDTH || 16;
  const widths = [2, 4, 6, 8, 12, 16, 24, 32];
  let h = '<details class="sv" open><summary>Read as fixed-width records</summary><div style="padding:0 10px 10px">';
  h += '<div class="sv-note" style="margin-bottom:8px">' + d.length + ' bytes. ' +
       'A stride that divides evenly is usually the right one.</div>';
  h += '<div class="sv-chips" style="margin-bottom:8px">' + widths.map(x =>
        '<button class="navChip' + (x === w ? ' active' : '') + '" onclick="setTableWidth(' + x + ')">' +
        x + ' \u00d7 ' + Math.floor(d.length / x) + (d.length % x ? ' +' + (d.length % x) : '') +
        '</button>').join('') + '</div>';
  // A byte ringed by jumpToTableAt, the way a script line is by
  // jumpToScriptAt. The record it is in is brought into view whether or
  // not it is inside the first four hundred.
  const hitByte = window.TABLE_AT && window.TABLE_AT.resid === resid ? window.TABLE_AT.byte : null;
  const hitRow = hitByte === null ? -1 : Math.floor(hitByte / w);
  const from = hitRow > 380 ? hitRow - 190 : 0;
  const rows = Math.min(Math.floor(d.length / w), from + 400);
  h += '<pre class="pane" style="max-height:340px;font-size:0.6875rem;white-space:pre">';
  let body = '';
  if (from) body += '... ' + from + ' earlier records\n';
  for (let i = from; i < rows; i++) {
    const p = i * w;
    let hexs = '', words = '';
    for (let k = 0; k < w; k++) {
      const one = d[p + k].toString(16).padStart(2, '0') + ' ';
      hexs += (p + k === hitByte) ? '\u0001' + one.trimEnd() + '\u0002 ' : one;
    }
    for (let k = 0; k + 1 < w; k += 2) words += (u16be(d, p+k) + '').padStart(6) + ' ';
    body += String(i).padStart(4) + '  ' + hexs + ' |' + words + '\n';
  }
  if (Math.floor(d.length / w) > rows) body += '... ' + (Math.floor(d.length / w) - rows) + ' more records\n';
  if (d.length % w) {
    let tail = '';
    for (let k = d.length - (d.length % w); k < d.length; k++) tail += d[k].toString(16).padStart(2, '0') + ' ';
    body += '\ntail (' + (d.length % w) + ' bytes): ' + tail + '\n';
  }
  h += svEsc(body).replace(/\u0001/g, '<span id="tableHit" class="listingHit">').replace(/\u0002/g, '</span>') +
       '</pre></div></details>';
  host.innerHTML = h;
}

/* Which listing the script views show: 'structured' or false for the raw one.
   Structured is what a script opens on, since 23 September 2026 at the
   maintainer's word; the raw listing is one tap away and is still what
   everything else in this repository reads (the snapshot, the search, the
   rule matchers), since a listing on screen is a view, not a reading.

   The folded listing had a button of its own between the two until the same
   day, and was taken off the row when the maintainer asked whether it was
   needed: it is the structured listing without the braces, every function
   the one renders the other renders too (structure_check), and where a jump
   cannot be proven a block the structured listing already leaves the goto
   the folded one would show. dvmFoldRender stays, since the structured
   listing and the gallery's outlines are built on it, and 'folded' still
   selects it for a caller that asks.

   Kept on `window` because the row's buttons are inline handlers, and
   remembered in the browser so a reader who prefers raw is not asked again
   on every visit. */
window.SCRIPT_FOLD = 'structured';
try {
  const v = localStorage.getItem('cythera.listing');
  if (v === 'raw') window.SCRIPT_FOLD = false;
} catch (e) { quiet(e); }
function setScriptFold(on) {
  window.SCRIPT_FOLD = on === true ? 'folded' : (on || false);
  setScriptPane('code');
  try { localStorage.setItem('cythera.listing', window.SCRIPT_FOLD || 'raw'); } catch (e) { quiet(e); }
  try { renderText(true); } catch (e) { quiet(e); }
}

/* What a script is there for where it is being read. Under Components > Text
   it is there for its words -- a book, a sign, a conversation -- and under
   Functions, and anywhere else, for its code. Until 22 September 2026 every
   script whose subindex can hold dialogue opened on its words, which is
   nearly all of them, so the Functions tab showed a list of strings and hid
   the code it is named for behind a button. */
function scriptPaneFor(value) {
  for (let n = TAB_LEAF_FOR.get(value); n; n = n.parent) if (n.id === 'text') return 'text';
  return 'code';
}

// The subindexes that hold Delver VM containers, which renderText
// disassembles and the gallery outlines. At top level since 22 September
// 2026, when the gallery needed it too; the reasoning is in renderText.
const SCRIPT_SUBN = new Set([0,1,2,3,4,7,8,9,10,11,12,13,14,15,16,19,20,23,24,25,26,27,29,47]);

// `sameResource` is a re-render of what is already open (a listing chosen),
// which keeps the view the reader is on rather than choosing afresh.
function renderText(sameResource) {
  const out = document.getElementById('output');
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid, roff, rlen] = window.CUR_RESIDS[idx];
  // An open editor holds the PREVIOUS resource's bytes; left open across
  // navigation, Apply would write them into whatever is showing now.
  cancelResourceEdit();
  try {
    const resDataRaw = ARCHIVE.bytes.slice(roff, roff+rlen);
    const { data: resData, wasDecrypted, rawEntropy, decEntropy, shape, allZero, known } = smartDecrypt(resDataRaw, resid);

    document.getElementById('textPreview').style.display = 'block';
    document.getElementById('zoomControls').style.display = 'none';
    document.getElementById('resourceNav').style.display = 'flex';
    document.getElementById('backToSheet').style.display = 'block';

    // The identity of the resource is now the job of the script view's header,
    // so this line carries only what that panel does not: the decision the
    // decryptor made, and how close it was.
    const readNote =
      (wasDecrypted ? 'decrypted' : 'read as stored') +
      (known ? "  (from delvmod's tables)"
             : shape ? '  (by its shape: ' + shape + ')'
             : rawEntropy || decEntropy
               ? '  (entropy ' + Math.min(rawEntropy, decEntropy).toFixed(2) +
                 ' against ' + Math.max(rawEntropy, decEntropy).toFixed(2) + ')'
               : '  (all zero bytes)');
    document.getElementById('textLabel').textContent = readNote;
    updateUsagePanel(resid, window.CUR_SUBN);

    // Three separate views rather than one concatenated blob.
    let content = '', stringsText = '', hexText = '';
    const subn = window.CUR_SUBN;

    // Prop Lists (0x81xx) -- structured 16-byte records, ported from delv/level.py PropList
    if (subn === 128) {
      const recs = parseDelverPropList(resData);
      content += "--- PROP LIST (parsed as delv.level.PropList, " + recs.length + " records) ---\n";
      content += recs.map(r =>
        '#' + r.index + '  flags=0x' + r.flags.toString(16).padStart(2,'0') +
        // Same reading as delvmod's textual_location: the location word is a
        // containment link, not coordinates, once the flags say so.
        '  ' + (r.carriedBy !== null
                  ? (r.equipped ? 'equipped by #' : 'carried by #') + r.carriedBy
                  : r.container !== null
                      ? 'inside prop #' + r.container
                      : '(' + r.x + ',' + r.y + ')') +
        '  proptype=0x' + r.proptype.toString(16).padStart(3,'0') +
        '  aspect=' + r.aspect + (r.rotated ? '(rot)' : '') +
        '  d1=' + r.d1 + ' d2=' + r.d2 +
        '  storeref=0x' + r.storeref.toString(16).padStart(4,'0') +
        (storeSymbol(r.storeref) ? ' (' + storeSymbol(r.storeref) + ')' : '') +
        '  otherprop32=0x' + r.otherprop.toString(16).padStart(8,'0') +
        '  tail=' + r.tail +
        '  u=0x' + r.u.toString(16).padStart(4,'0')
      ).join('\n') + '\n\n';
    }
    // Schedule List (resource 0xF00B specifically) -- ported from delv/schedule.py
    else if (resid === 0xF00B) {
      const sched = parseDelverScheduleList(resData);
      if (sched && sched.length) {
        content += "--- SCHEDULE LIST (parsed as delv.schedule.ScheduleList, " + sched.length + " characters with entries) ---\n";
        content += sched.map(s =>
          'Character #' + s.character + ':\n' + s.entries.map(e =>
            '  hour=' + e.hour + '  mode=0x' + e.mode.toString(16).padStart(2,'0') +
            '  scripting=0x' + e.scripting.toString(16).padStart(4,'0') +
            '  level=' + e.level + '  (' + e.x + ',' + e.y + ')'
          ).join('\n')
        ).join('\n') + '\n\n';
      } else {
        content += "--- SCHEDULE LIST ---\n(Resource too short to parse)\n\n";
      }
    }
    // Known "Delver atom array" text resources -- ported from delv/script.py
    else {
      const structured = DELVER_TEXT_ARRAY_RESIDS.has(resid) ? parseDelverTextArray(resData) : null;
      if (structured && structured.length) {
        content += "Delver atom array, " + structured.length + " entries:\n\n";
        content += structured.map(e =>
          '#' + e.index + '  (offset 0x' + e.offset.toString(16).padStart(4,'0') + ')  "' + e.str + '"'
        ).join('\n') + '\n';
      }
    }

    // The strings pane is built for every category, not just the ones that
    // fall through to it -- a prop list or a map header can still carry text.
    stringsText = extractReadableStrings(ARCHIVE, resData, resid) || '(No readable strings in this resource.)';
    hexText = hexDump(resData);

    const midiBtn = document.getElementById('midiBtn');
    if (midiBtn) midiBtn.style.display = 'none';
    if (subn === 143) {
      let head = "--- QTMA TUNE (decoded) ---\n";
      try {
        const info = qtmaToMidi(resDataRaw);
        const gm = Object.keys(info.noteRequests).sort((a,b)=>a-b)
          .map(p => "  part " + p + " -> MIDI ch " + ((info.chanOf[p]|0)+1) +
                    ", GM program " + info.noteRequests[p] + " (" +
                    (GM_NAMES[info.noteRequests[p]-1] || "?") + ")").join("\n");
        head += "Notes: " + info.noteCount + "   Events: " + info.eventCount +
                "   Length: " + info.durationSec.toFixed(1) + "s\n" +
                "Parts:\n" + (gm || "  (none declared)") + "\n\n" +
                "Use \"Download as MIDI\" below, then render with any General MIDI\n" +
                "synth (e.g. fluidsynth -F out.wav SoundFont.sf2 file.mid).\n\n";
        if (midiBtn) midiBtn.style.display = '';
      } catch(e) {
        head += "(could not decode as a QTMA tune: " + e.message + ")\n\n";
      }
      content = head + content;
    }

    // Every non-media subindex holds Delver VM containers, so every one of
    // them gets a real disassembly instead of a byte dump. Subindexes 1, 2, 4,
    // 10 and 29 were missing from this list, which is the whole reason 27
    // resources -- 0x0301 among them -- rendered as anonymous hex. They were
    // decrypting correctly the entire time and the disassembler could already
    // read them; it was simply never called. 0x0301 is `[2, 3, 1, 1]`.
    let scriptText = '', rawText = '';
    const listingExtra = {};
    if (SCRIPT_SUBN.has(subn)) {
      try {
        const named = dvmNamedScript(resData);
        if (named) {
          // Name the thing, then be honest about the body. Running the VM
          // disassembler over it produces a plausible-looking stream that is
          // entirely wrong -- 0x0410 "decodes" as PlayNote followed by thirty
          // Var00 pushes -- so it is not shown. The bytes fall into short
          // repeating groups and look like a condition/action table, but that
          // is a hunch, not a format.
          scriptText = 'name: "' + named.name + '"\n\n' +
                       'The body starts at +0x' + named.bodyOffset.toString(16).toUpperCase() +
                       ' and runs ' + (resData.length - named.bodyOffset) + ' bytes.\n' +
                       'It is not Delver script code; running the disassembler over it\n' +
                       'produces meaningless output, and its real format is unknown.\n' +
                       'The bytes are in the raw dump below.';
        } else {
          /* Two renderers over one decoder. `dvmRender` is the raw listing and
             is what the decoder snapshot, the search index and the rule
             matchers in js/page-rules.js all read, so it never varies; the
             folded view in js/delv-fold.js is a second reading of the same
             disassembly and is the visitor's choice, remembered in
             SCRIPT_FOLD. */
          const render =
            (window.SCRIPT_FOLD === 'structured' && typeof dvmStructureRender === 'function') ? dvmStructureRender :
            (window.SCRIPT_FOLD && typeof dvmFoldRender === 'function') ? dvmFoldRender :
            dvmRender;
          const dis = render(ARCHIVE, resData, resid, listingExtra);
          if (dis && dis.split('\n').length > 2) scriptText = dis;
          // The folded views name a call without its id; the links in them
          // are learned from this (paintDecodedPane, renderLinked).
          if (render !== dvmRender) rawText = dvmRender(ARCHIVE, resData, resid) || '';
        }
      } catch (e) {
        scriptText = '// disassembly failed: ' + e.message;
      }
    }
    const sv = document.getElementById('scriptView');
    const isScript = SCRIPT_SUBN.has(subn);
    // The script's head carries the decryption note; the centred line above
    // it would say it twice.
    document.getElementById('textLabel').style.display = isScript ? 'none' : '';
    if (isScript) {
      buildScriptView({ resid, subn, byteLength: rlen, readNote: readNote.replace(/\s+/g, ' '), resData });
      content = (scriptText ? scriptText + '\n\n' : '') + content;
      if (!scriptText && !content.trim()) content = 'Nothing in this resource reads as Delver script code.';
    } else if (sv) {
      sv.style.display = 'none'; sv.innerHTML = '';
      const refs = document.getElementById('scriptRefs');
      if (refs) { refs.style.display = 'none'; refs.innerHTML = ''; }
    }
    window.LAST_DECODED = { resid, text: content || '(nothing decoded)', raw: rawText, isScript,
                            exits: listingExtra.exits || null, resData };
    // The view the reader last chose where scripts are read for the same
    // thing (SCRIPT_PANE_FOR), not the one this resource would choose.
    if (!sameResource) window.SCRIPT_PANE = window.SCRIPT_PANE_FOR[scriptPaneFor(document.getElementById('categorySelect').value)];
    paintDecodedPane();
    // The F0xx tables are the ones with no field map, so they get the stride
    // explorer. Everything else keeps a plain hex pane.
    const insp = document.getElementById('tableInspector');
    if (subn === 239) renderTableInspector(resid);
    else if (insp) { insp.style.display = 'none'; insp.innerHTML = ''; }
    document.getElementById('paneStrings').textContent = stringsText;
    document.getElementById('paneHex').textContent = hexText;
    if (isScript) {
      // Its words first, then the row that chooses between them and the code.
      renderDialoguePane(resData, subn, resid);
      paintDecodedPane();
    } else {
      document.getElementById('dlgWrap').style.display = 'none';
      document.getElementById('viewTabs').style.display = '';
      document.getElementById('tabDecoded').classList.toggle('empty', !content.trim());
      document.getElementById('tabStrings').classList.toggle('empty', stringsText.charAt(0) === '(');
      showPane('textContent');
    }
    out.textContent = "Rendered resource 0x" + resid.toString(16).toUpperCase() +
      (wasDecrypted ? " (auto-decrypted)" : " (no decryption applied)");
    currentResid = resid;
    window.CUR_RAW_BYTES = resDataRaw;
  } catch(err) { out.textContent = "Text render error: " + err.message; }
}

// --- Readable dialogue pane -------------------------------------------
// Cythera stores dialogue as many short Pascal strings emitted by compiled
// Delver bytecode, so a single spoken line is usually split across several
// consecutive fragments. Adjacent fragments are stitched back together
// (a fragment that does not end in sentence punctuation continues into the
// next one), '*' separates alternate responses, and '@word' marks a
// conversation keyword the player can ask about.
const DIALOGUE_SUBN = new Set([0,1,3,4,7,8,9,11,12,13,15,16,19,20,23,24,25,26,27,29,47]);

function escHtml(t){ return t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function stitchDialogue(strs) {
  const lines = [];
  let cur = null;
  for (const e of strs) {
    if (cur && e.offset === cur.end) {
      cur.text += e.str; cur.end = e.offset + e.str.length + 1;
    } else {
      if (cur) lines.push(cur);
      cur = { offset: e.offset, text: e.str, end: e.offset + e.str.length + 1 };
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------------------------------------------------------------------------
   The conversation view
   ---------------------------------------------------------------------------
   dvmConversation reads the topics straight out of the script's
   conversation_response chain (see the long note above it in delv-script.js).
   This renderer turns that structure into what the community spent 2016
   collecting by hand: keywords, responses, follow-ups, and the inheritance
   chain -- with the difference that the conditions and side effects come from
   the code, and every line still carries its in-place edit link.

   The group names below are NOT stored in the archive: subindex 8 resources
   are anonymous functions. They were identified empirically, by matching each
   resource's text against the community's verified per-group dialogue files
   (cytheraguides.com/dialogue, collected in play by BreadWorldMercy453), and
   utilities/dialogue_check.mjs re-verifies character->group chains against
   that same collection. 0x813 is the pool of tavern rumors the bartenders
   draw from. 0x803 is House Atussa: a 14-byte stub with no prompts, because
   the House is defunct -- but Sardis, Ake and Milcom (all tied to Atussa)
   still call it, which is how it was identified. 0x814 is an empty stub.
--------------------------------------------------------------------------- */
// Empty since 23 September 2026: the files name no group, and the names the
// community gave them (above) went with the other typed names at the
// maintainer's word. A group is shown by its id; utilities/dialogue_check.mjs
// keeps the community's names to find each group in its collection.
const DIALOGUE_GROUP_NAMES = {};

function conversationFor(resid) {
  if (!DERIVED.CONV_CACHE) DERIVED.CONV_CACHE = new Map();
  if (DERIVED.CONV_CACHE.has(resid)) return DERIVED.CONV_CACHE.get(resid);
  let conv = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (raw) conv = dvmConversation(smartDecrypt(raw, resid).data, resid);
  } catch (e) { quiet(e); }
  DERIVED.CONV_CACHE.set(resid, conv);
  return conv;
}

// The engine's own rule: the first four letters of the first word typed,
// prefix-matched against the stored keyword (which may itself be shorter --
// "bye" -- or carry comma-separated alternatives -- "iron,mine").
function convKwMatches(kw, word) {
  const t = String(word || '').toLowerCase();
  return String(kw || '').toLowerCase().split(',').some(k =>
    k && (t.startsWith(k) || k.startsWith(t.slice(0, 4))));
}

function convFindEntry(entries, word) {
  for (const e of entries) {
    if (e.kw && e.kw !== '*' && convKwMatches(e.kw, word)) return e;
    const s = convFindEntry(e.sub, word);
    if (s) return s;
  }
  return null;
}

// An @word in a response is the game marking a blue keyword. Resolve it the
// way the engine would: this character first, then the groups in chain order.
function convJumpWord(resid, word) {
  const conv = conversationFor(resid);
  if (conv) {
    const hit = convFindEntry(conv.entries, word);
    if (hit) return convScrollTo(resid, hit.at);
    for (const gid of conv.groups) {
      const g = conversationFor(gid);
      const gh = g && convFindEntry(g.entries, word);
      if (gh) {
        // The character's view carries its groups' topics too.
        if (document.getElementById('conv-' + gid + '-' + gh.at)) return convScrollTo(gid, gh.at);
        window.PENDING_CONV_WORD = word;
        return jumpToResource(gid);
      }
    }
  }
}

function convScrollTo(resid, at) {
  const el = document.getElementById('conv-' + resid + '-' + at);
  if (!el) return;
  document.querySelectorAll('.convCard.convHit').forEach(c => c.classList.remove('convHit'));
  el.classList.add('convHit');
  el.scrollIntoView({ block: 'center' });
}

function convBadgeFor(a) {
  if (a.call !== undefined) {
    if (a.call === 0xF00) return 'learns your name';
    if (a.call === 0xE86) return 'training';
    if (a.call === 0x813) return 'a rumor from the pool';
    if ((a.call >> 8) === 8) return null;              // chain calls render in the header
    const d = typeof refDescription === 'function' ? refDescription(a.call) : null;
    return 'calls ' + (d || ('0x' + a.call.toString(16).toUpperCase()));
  }
  // AddQuest and CompleteQuest are delvmod's names for cbAddToDo and
  // cbDoneToDo: they write and strike off a line in the To Do window and
  // touch no other state, so they are not said here as "a quest".
  const M = { JoinParty: 'can join the party', LeaveParty: 'leaves the party',
    Create: 'gives something', New: 'makes something', AddQuest: 'adds a line to the To Do list',
    CompleteQuest: 'strikes a line off the To Do list', ChangeZone: 'travel', Delete: 'removes something',
    SetFlag: 'sets a status flag', SetStateFlag: 'sets a game flag',
    AddTask: null, FinishTasks: null, TakeItem: 'takes something',
    AddConversationKeyword: 'unlocks a keyword', GameOver: 'ends the game' };
  let label = M[a.sys] !== undefined ? M[a.sys] : dvmSyscallShown(a.sys);
  if (!label) return null;
  if (a.note && (a.sys === 'Create' || a.sys === 'New'))
    label = 'gives: ' + a.note.replace(/^.*proptype \d+ (, )?/, '').replace(/^proptype, /, '');
  return label;
}

function convTextHtml(resid, e) {
  let html = '';
  // Which conditions pick each line: the Read clause at or before the
  // string's offset, within this prompt (convReadConds). Said when it
  // changes from the line before, so a run under one test reads once.
  const lines = e.kw && e.kw !== '*' ? (convReadConds(resid).lines.get(e.at) || []) : [];
  let prev = '';
  for (const t of e.text) {
    let chain = [];
    for (const l of lines) { if (l.at > t.off) break; chain = l.chain; }
    const said = chain.join(' and ');
    const lead = said && said !== prev ? '<span class="inspDim">if ' + escHtml(said) + ':</span> ' : '';
    prev = said;
    const body = escHtml(t.str)
      .replace(/@([A-Za-z][A-Za-z'-]*)/g,
        '<span class="convLink" onclick="convJumpWord(' + resid + ',\'$1\')">$1</span>');
    html += '<p class="dlgLine">' + lead + body +
      ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + t.off + ')">edit</button></p>';
  }
  return html;
}

/* What the player means by a prompt (the maintainer, 23 September 2026:
   the "real" four letters and the "intended" word, both at once). The code
   stores only what it matches -- "demo", "eteo", "job" -- and the words
   those stand for are in the game's own text: every @word in every response
   is a word the player can ask about, spelt in full. So a stored keyword's
   intended words are the @words the engine's four-letter rule would send to
   it, most used first; one no response names stays as it is stored. */
function convIntendedWords() {
  if (DERIVED.CONV_WORDS) return DERIVED.CONV_WORDS;
  const words = new Map();
  const walk = es => { for (const e of es || []) {
    for (const t of e.text || []) for (const m of String(t.str).matchAll(/@([A-Za-z][A-Za-z'-]*)/g)) {
      const k = m[1].toLowerCase(), o = words.get(k) || { text: m[1], n: 0 };
      o.n++; words.set(k, o);
    }
    walk(e.sub);
  } };
  for (const [subn, base] of [[23, 0x1800], [7, 0x800]]) {
    const count = subindexCount(ARCHIVE, subn);
    for (let i = 0; i < count; i++) {
      const c = conversationFor(base + i);
      if (c) { walk(c.entries); if (c.preamble) walk([c.preamble]); }
    }
  }
  return (DERIVED.CONV_WORDS = words);
}
function convIntendedFor(stub) {
  // Only a stub of exactly four letters is a word cut short; a shorter one
  // ("job", "bye", the "y" and "n" of a question) is the whole word, and a
  // longer one ("very easy") is spelt out already.
  if (!/^[a-z]{4}$/i.test(stub)) return [];
  const out = [];
  for (const [k, o] of convIntendedWords()) if (convKwMatches(stub, k)) out.push(o);
  return out.sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)).map(o => o.text);
}
// A prompt as the player types it, and as the code stores it.
function convPromptHtml(e) {
  if (e.kw === '*') return '<span class="convKw">anything else</span>';
  return String(e.kw).split(',').map(k => {
    const w = convIntendedFor(k);
    return '<span class="convAsk">' + svEsc((w[0] || k).toUpperCase()) + '</span>' +
      (w.length > 1 ? '<span class="convAlso">or ' + w.slice(1, 3).map(x => svEsc(x.toUpperCase())).join(', ') + '</span>' : '') +
      '<span class="convKw" title="what the game matches">' + svEsc(k) + '</span>';
  }).join(' ');
}

/* What a prompt's answer depends on, as the Read view says it: for each
   "when asked about" clause of the conversation's Read (dvmReadRender), the
   conditions of the ifs inside it, down to but not into a nested prompt,
   which is a card of its own. Keyed by the prompt's offset, which the Read
   clause and the conversation entry share. Until 24 September 2026 a card
   said only which tests it called ("depends on: GetQV"), and missed a test
   made through a helper altogether: Aethon's "demo" asks 0xF13 whether he
   is in the party and its card said nothing. */
// "not (x)" of a condition, without doubling a not: a test the Read view
// already said as "not (x)" or "not x" is turned back to x when x is one
// clause (no "and" or "or" at its top).
function convNegate(k) {
  const top = t => { let d = 0; for (let i = 0; i < t.length; i++) { const ch = t[i]; if (ch === '(') d++; else if (ch === ')') { d--; if (d < 0) return false; } else if (d === 0 && (t.startsWith(' and ', i) || t.startsWith(' or ', i))) return false; } return d === 0; };
  const m = /^not \((.*)\)$/.exec(k);
  if (m && top(m[1]) !== false && (() => { let d = 0; for (const ch of m[1]) { if (ch === '(') d++; else if (ch === ')' && --d < 0) return false; } return d === 0; })()) return m[1];
  if (/^not /.test(k) && top(k.slice(4))) return k.slice(4);
  return 'not (' + k + ')';
}
function convReadConds(resid) {
  if (!DERIVED.CONV_READ_CONDS) DERIVED.CONV_READ_CONDS = new Map();
  if (DERIVED.CONV_READ_CONDS.has(resid)) return DERIVED.CONV_READ_CONDS.get(resid);
  const out = new Map();
  out.lines = new Map();
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    const fns = raw ? dvmReadRender(ARCHIVE, smartDecrypt(raw, resid).data, resid) : [];
    const cond = t => { const m = /^(?:otherwise )?if (.*?):(?: .*)?$/.exec(t); return m ? m[1] : null; };
    // Every clause under a prompt, with the conditions it sits under there:
    // an if's own, and "not (...)" of the if before an "otherwise".
    const inside = (kids, chain, into, lines) => {
      let last = null;
      for (const c of kids || []) {
        if (/^when asked about /.test(c.text)) { last = null; continue; }
        const k = cond(c.text);
        let sub = chain;
        if (k) { if (into.indexOf(k) < 0) into.push(k); sub = chain.concat([k]); last = k; }
        else if (/^otherwise:/.test(c.text) && last) { sub = chain.concat([convNegate(last)]); last = null; }
        else last = null;
        if (c.at != null && !k) lines.push({ at: c.at, chain });
        inside(c.kids, sub, into, lines);
      }
    };
    const walk = cl => {
      for (const c of cl || []) {
        if (/^when asked about /.test(c.text) && c.at != null) {
          const into = [], lines = [];
          inside(c.kids, [], into, lines);
          if (into.length) out.set(c.at, into);
          out.lines.set(c.at, lines.sort((x, y) => x.at - y.at));
        }
        walk(c.kids);
      }
    };
    for (const f of fns) walk(f.clauses);
  } catch (err) { quiet(err, 'reading a conversation\u2019s conditions'); }
  DERIVED.CONV_READ_CONDS.set(resid, out);
  return out;
}
function convCardHtml(resid, e, depth) {
  const kws = convPromptHtml(e);
  const badges = [];
  const said = e.kw === '*' ? null : convReadConds(resid).get(e.at);
  if (said) for (const c of said.slice(0, 3)) badges.push('if ' + c);
  else if (e.conds.length) badges.push('depends on: ' + e.conds.map(dvmSyscallShown).join(', '));
  // A character helper (0xF00 up) the condition already reads through is
  // not said a second time as a call.
  for (const a of e.actions) {
    if (said && a.call !== undefined && (a.call >> 8) === 0x0F) continue;
    const b = convBadgeFor(a); if (b) badges.push(b);
  }
  let html = '<div class="convCard' + (depth ? ' convSub' : '') + '" id="conv-' + resid + '-' + e.at + '">' +
    kws + badges.map(b => '<span class="convBadge">' + svEsc(b) + '</span>').join('') +
    convTextHtml(resid, e);
  for (const s of e.sub) html += convCardHtml(resid, s, depth + 1);
  return html + '</div>';
}

/* A character's conversation, everything at once: the person as the
   window shows them -- the portrait, the name, and the line the window
   opens with -- then every topic they answer, their own first and then each
   group they fall through to in the order the catch-all calls them (the
   engine's lookup), each group's topics that nobody earlier answers. A
   group topic the character or an earlier group already answers is not
   repeated; the group's heading says how many. The catch-all's own words
   come last, after the groups, which is when the engine reaches them. */
function convWhoHtml(resid, conv) {
  const ci = resid - 0x1800;
  let face = null;
  try { face = typeof characterFace === 'function' ? characterFace(ci) : null; } catch (e) { face = null; }
  const name = (typeof characterName === 'function' && characterName(ci)) || ('0x' + resid.toString(16).toUpperCase());
  const greet = conv.preamble ? convTextHtml(resid, conv.preamble) : '';
  return '<div class="convWho">' +
    (face && face.url ? '<img class="convFace" alt="" src="' + face.url + '">' : '') +
    '<div><b>' + svEsc(name) + '</b>' + greet + '</div></div>';
}
function convEverythingHtml(resid, conv, ordered) {
  const layers = [{ resid, entries: ordered.filter(e => e.kw !== '*'), own: true }];
  for (const g of conv.groups) {
    const gc = conversationFor(g);
    if (gc) layers.push({ resid: g, entries: gc.entries.filter(e => e.kw !== '*') });
  }
  const answered = [];
  let html = '';
  for (const L of layers) {
    const shown = [], hidden = [];
    for (const e of L.entries) {
      const stubs = String(e.kw).split(',');
      (!L.own && stubs.every(k => answered.some(a => convKwMatches(a, k))) ? hidden : shown).push(e);
    }
    const nm = L.own ? null : ((window.SHOW_BUILTIN_LABELS && DIALOGUE_GROUP_NAMES[L.resid]) || ('0x' + L.resid.toString(16).toUpperCase()));
    if (!L.own) html += '<div class="convAs">Answers as <button class="sv-chip" onclick="jumpToResource(' + L.resid + ')">' + svEsc(nm) + '</button>' +
      (hidden.length ? ' <span class="inspDim">' + hidden.length + ' of its topics answered above</span>' : '') + '</div>';
    for (const e of shown) html += convCardHtml(L.resid, e, 0);
    for (const e of L.entries) answered.push(...String(e.kw).split(','));
  }
  for (const e of ordered.filter(x => x.kw === '*')) html += convCardHtml(resid, e, 0);
  return html;
}

function renderConversationPane(data, subn, resid) {
  let conv = null;
  try { conv = dvmConversation(data, resid); } catch (e) { quiet(e); }
  if (!conv || !conv.entries.length) return false;
  const wrap = document.getElementById('dlgWrap');
  if (!wrap) return false;
  let head = '';
  if (subn === 8) {
    const nm = window.SHOW_BUILTIN_LABELS ? DIALOGUE_GROUP_NAMES[resid] : null;
    head = nm ? 'Generic <b>' + svEsc(nm) + '</b> topics, shared by everyone who uses this group'
              : 'Generic prompts';
  } else {
    const chain = conv.groups.map(g =>
      '<button class="sv-chip" onclick="jumpToResource(' + g + ')">' +
      svEsc((window.SHOW_BUILTIN_LABELS && DIALOGUE_GROUP_NAMES[g]) || ('0x' + g.toString(16).toUpperCase())) + '</button>').join(' ');
    head = conv.entries.length + ' topic' + (conv.entries.length === 1 ? '' : 's') +
      ', read from the code' + (chain ? ' · also answers as: ' + chain : '');
  }
  let html = '<div class="convHead">' + head + '</div>';
  if (subn !== 8) html += convWhoHtml(resid, conv);
  // The catch-all last, whatever order the chain tests it in.
  const ordered = conv.entries.filter(e => e.kw !== '*').concat(conv.entries.filter(e => e.kw === '*'));
  if (subn === 8) for (const e of ordered) html += convCardHtml(resid, e, 0);
  else html += convEverythingHtml(resid, conv, ordered);
  wrap.innerHTML = html;
  wrap.style.display = '';
  if (window.PENDING_CONV_WORD) {
    const hit = convFindEntry(conv.entries, window.PENDING_CONV_WORD);
    window.PENDING_CONV_WORD = null;
    if (hit) setTimeout(() => convScrollTo(resid, hit.at), 0);
  }
  return true;
}

/* A script's words, into #dlgWrap: the conversation's topic cards for a
   dialogue script, or its strings one to a line with an edit button each.
   Whether they are what is showing is paintDecodedPane's to decide; this only
   fills the pane, or empties it when there are none, and an empty pane is
   what takes the Text button off the row. */
function renderDialoguePane(data, subn, resid) {
  const wrap = document.getElementById('dlgWrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  // Dialogue scripts (0x18xx) and the generic-prompt archetypes (0x08xx) get
  // the structured conversation view when the extractor finds topics; the
  // twelve one-liner characters and anything the disassembler cannot follow
  // fall through to the flat string list below. Keyed off the resid, not
  // subn: this function's subn parameter is the master-index slot, which
  // runs one below the resid's high byte.
  const convSub = resid !== undefined ? (resid >> 8) : -1;
  if ((convSub === 0x18 || convSub === 0x08) && renderConversationPane(data, convSub, resid)) return;
  if (!DIALOGUE_SUBN.has(subn)) return;
  // Container strings are already whole -- they do not need stitching, and
  // stitching them would glue unrelated lines together. Only the fragmentary
  // Pascal fallback gets stitched.
  let lines;
  const owned = (resid !== undefined) ? dvmStringObjects(ARCHIVE, data, resid) : [];
  if (owned.length) {
    lines = owned.filter(e => /[A-Za-z]{2}/.test(e.str))
                 .map(e => ({ offset: e.offset, text: e.str }));
  } else {
    lines = stitchDialogue(extractPascalStrings(data).filter(e => /[A-Za-z]{2}/.test(e.str)));
  }
  if (!lines.length) return;
  let html = '';
  for (const ln of lines) {
    // '*' separates alternate/among-many responses in the same block.
    const parts = ln.text.split('*').filter(p => p.trim().length);
    parts.forEach((part, i) => {
      const body = escHtml(part)
        .replace(/@([A-Za-z][A-Za-z'-]*)/g, '<span class="dlgKw">$1</span>');
      const tag = i === 0
        ? '<span class="dlgOff">0x' + ln.offset.toString(16).padStart(4,'0') + '</span>'
        : '<span class="dlgSep">&#8226; </span>';
      // Whole stored strings are editable in place; the offset carried here
      // is where editStringAt goes looking for the Pascal length byte.
      const edit = i === 0
        ? ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + ln.offset + ')">edit</button>'
        : '';
      html += '<p class="dlgLine">' + tag + body + edit + '</p>';
    });
  }
  wrap.innerHTML = html;
}

// One pane visible at a time; a tab with nothing behind it is dimmed rather
// than hidden, so the set of views does not shift around between resources.
function showPane(id) {
  const panes = { textContent: 'tabDecoded', paneStrings: 'tabStrings', paneHex: 'tabHex' };
  for (const pid of Object.keys(panes)) {
    const pane = document.getElementById(pid), tab = document.getElementById(panes[pid]);
    if (!pane || !tab) continue;
    const on = (pid === id);
    pane.style.display = on ? '' : 'none';
    tab.classList.toggle('active', on);
  }
}

function downloadCurrentRawBytes() {  const bytes = window.CUR_RAW_BYTES;
  if (!bytes || currentResid == null) return;
  const subn = window.CUR_SUBN;
  const ext = (subn === 143) ? 'qtma' : 'bin';
  downloadBlob(bytes, 'cythera_0x' + currentResid.toString(16).toUpperCase() + '.' + ext);
}

// --- Editing ----------------------------------------------------------
// The first edit path this page has ever had, and deliberately the narrowest
// one that is real end to end: hex-edit one resource's plaintext, rebuild the
// ENTIRE archive through writeDelverArchive (the writer delv_write_check.mjs
// holds byte-identical to delvmod's), and re-enter through parseArchiveBytes
// as if the rebuilt file had just been opened. Rebuilding wholesale instead
// of patching ARCHIVE.bytes in place costs ~none (a 5.6 MB archive re-serializes
// in milliseconds) and buys everything: every derived cache resets, every
// gallery and map redraws from the edited bytes, and the thing on screen is
// provably the thing a download produces -- there is no second, edited-but-
// unserialized state to drift.
//
// Edits live only in ARCHIVE.bytes. The IndexedDB copy is deliberately NOT
// updated -- a reload restores the original, and "Download edited archive"
// is the way to keep work. The download is the bare data fork (.data):
// delvmod, mag.py and this page all read it directly; the resource fork the
// .hqx carried is untouched by data-fork edits and still in the original.
window.EDITED_RESIDS = new Set();

function startResourceEdit() {
  if (currentResid == null || !ARCHIVE) return;
  const raw = getResourceBytes(ARCHIVE, currentResid);
  if (!raw) { setStatus('This resource has no bytes to edit.', true); return; }
  const dec = smartDecrypt(raw, currentResid);
  let hex = '';
  for (let i = 0; i < dec.data.length; i++) {
    hex += dec.data[i].toString(16).padStart(2, '0');
    hex += (i % 16 === 15) ? '\n' : ' ';
  }
  document.getElementById('editBytesText').value = hex.trimEnd();
  document.getElementById('editBytesNote').textContent =
    'Plaintext bytes of 0x' + currentResid.toString(16).toUpperCase() +
    (dec.wasDecrypted ? ' (stored encrypted; re-encrypted on rebuild)' : '') +
    '. The page ignores spaces and the length may change; emptying it removes the ' +
    'resource from the file.';
  document.getElementById('editBytesWrap').style.display = '';
}

/* ---- Changing a script's code (24 September 2026) ------------------------
   New instructions, in the listing's own words, put in at an instruction of
   the raw listing -- the line last ringed, when there is one -- in place of
   the instructions up to "Take out up to", and the resource relinked round
   them (dvmAssemble, dvmRelink in js/delv-asm.js), which refuses an edit
   whose offsets do not read back. Apply goes through applyResourceEdit, the
   same rebuild Edit bytes uses, so the change is in the comparison section's
   export as a Magpie patch like any other. Offsets are the raw listing's,
   from the start of the resource. */
function codeEditBytes() {
  const resid = currentResid;
  const raw = getResourceBytes(ARCHIVE, resid);
  if (!raw) throw new Error('this resource has no bytes');
  const b = smartDecrypt(raw, resid).data;
  const num = id => { const v = document.getElementById(id).value.trim(); if (!v) return null; const n = /^0x/i.test(v) ? parseInt(v, 16) : parseInt(v, 16); if (!Number.isFinite(n)) throw new Error(v + ' is not an offset'); return n; };
  const at = num('editCodeAt'), to = num('editCodeTo');
  if (at === null) throw new Error('say where the new code goes');
  // Both ends must be where an instruction starts, in one function.
  const fn = dvmExtents(b, resid).find(([st, en, kind]) => kind === 'function' && at >= st && at < en);
  if (!fn) throw new Error('0x' + at.toString(16).toUpperCase() + ' is not in a function');
  const starts = new Set(dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops.map(o => fn[0] + o[0]));
  starts.add(fn[1]);
  if (!starts.has(at)) throw new Error('0x' + at.toString(16).toUpperCase() + ' is not where an instruction starts');
  if (to !== null && (to < at || to > fn[1] || !starts.has(to))) throw new Error('0x' + to.toString(16).toUpperCase() + ' is not where an instruction starts, after the first, in the same function');
  const asm = dvmAssemble(document.getElementById('editCodeText').value, resid);
  const rl = dvmRelink(b, resid, at, to === null ? 0 : to - at, asm);
  return { resid, at, fn, asm, rl };
}
function startCodeEdit() {
  if (currentResid == null || !ARCHIVE) return;
  const ring = window.LISTING_AT && window.LISTING_AT.resid === currentResid ? window.LISTING_AT.at : null;
  document.getElementById('editCodeAt').value = ring !== null ? '0x' + ring.toString(16).toUpperCase().padStart(4, '0') : '';
  document.getElementById('editCodeTo').value = '';
  document.getElementById('editCodePreview').textContent = '';
  document.getElementById('editCodeNote').textContent = 'Instructions for 0x' + currentResid.toString(16).toUpperCase() +
    ', one per line, as the raw listing prints them. The page inserts them at the offset given, replacing the instructions up to the second offset if there is one, and adjusts every other offset in the resource around them. A label is a name followed by a colon on its own line, and a jump to it reads "then -> name" or "branch name".';
  document.getElementById('editCodeWrap').style.display = '';
}
function cancelCodeEdit() { document.getElementById('editCodeWrap').style.display = 'none'; }
function previewCodeEdit() {
  const pre = document.getElementById('editCodePreview');
  try {
    const e = codeEditBytes();
    const b = e.rl.bytes, st = e.fn[0];
    const fn = dvmExtents(b, e.resid).find(([s0, en, kind]) => kind === 'function' && s0 === st);
    const ops = fn ? dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops : [];
    const lo = e.at - 24, hi = e.at + e.asm.bytes.length + 24;
    const lines = ops.filter(o => fn[0] + o[0] >= lo && fn[0] + o[0] < hi).map(o => {
      const a = fn[0] + o[0], mark = a >= e.at && a < e.at + e.asm.bytes.length ? '+ ' : '  ';
      return mark + a.toString(16).toUpperCase().padStart(4, '0') + '  ' + o[2] + (o[3] ? ' ' + o[3] : '');
    });
    pre.textContent = (e.rl.delta >= 0 ? '+' : '') + e.rl.delta + ' bytes, ' + e.rl.moved + ' offsets moved. A + marks the new lines.\n\n' + lines.join('\n');
  } catch (err) { pre.textContent = err.message; }
}
function applyCodeEdit() {
  try {
    const e = codeEditBytes();
    if (applyResourceEdit(e.resid, e.rl.bytes)) cancelCodeEdit();
  } catch (err) { document.getElementById('editCodePreview').textContent = err.message; }
}

function cancelResourceEdit() {
  document.getElementById('editBytesWrap').style.display = 'none';
}

function parseHexBytes(text) {
  const clean = text.replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) return null;
  if (clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function applyResourceEditFromText() {
  const bytes = parseHexBytes(document.getElementById('editBytesText').value);
  if (!bytes) { setStatus('That is not hex. Enter pairs of 0–9 and a–f; the page ignores spaces, and the count must be even.', true); return; }
  if (applyResourceEdit(currentResid, bytes)) cancelResourceEdit();
}

function applyResourceEdit(resid, newData) {
  const spec = delverArchiveSpec(ARCHIVE.bytes);
  if (!spec) { setStatus('The page could not read the open file again after the change, so nothing changed.', true); return false; }
  const entry = spec.resources.find(r => r.resid === resid);
  if (!entry) { setStatus('0x' + resid.toString(16).toUpperCase() + ' is not in the file.', true); return false; }
  if (newData.length) entry.data = newData;
  else spec.resources.splice(spec.resources.indexOf(entry), 1);
  // resetDerivedCaches clears EDITED_RESIDS along with everything else keyed
  // to the open file -- correctly, since parseArchiveBytes is also how a
  // DIFFERENT archive arrives. Carry the dirty list across this rebuild by
  // hand; it is user state, not a derived table.
  const dirty = new Set(window.EDITED_RESIDS);
  dirty.add(resid);
  const name = window.ARCHIVE_SOURCE_NAME || 'archive';
  parseArchiveBytes(writeDelverArchive(spec), name, { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  refreshChangesBadge();
  setStatus('Rebuilt the file with 0x' + resid.toString(16).toUpperCase() +
    (newData.length ? ' edited' : ' removed') + ', ' + dirty.size +
    ' resource(s) changed this session. The page keeps edits in memory only; to download the edited file, go to ' +
    'Data › Cythera Data › Changes.');
  showEditNotice(resid, newData.length ? 'edited' : 'removed', dirty.size);
  return true;
}
/* The status line lives in the Settings panel, so an edit made from a page
   said where it went to nobody. This line under the top row says it on the
   page, with the Changes tab a link, and goes away on its own. */
let _editNoticeTimer = null;
function showEditNotice(resid, what, count) {
  const el = document.getElementById('editNotice');
  if (!el) return;
  el.innerHTML = '0x' + resid.toString(16).toUpperCase() + ' ' + what + ' in memory, ' + count + ' resource' + (count === 1 ? '' : 's') +
    ' changed this session. ' + svLink('Changes', "showCategory('CHANGES')", 'is where to download an edited file');
  el.style.display = '';
  if (_editNoticeTimer) clearTimeout(_editNoticeTimer);
  _editNoticeTimer = setTimeout(() => { el.style.display = 'none'; }, 15000);
}

function downloadEditedArchive() {
  if (!ARCHIVE) return;
  const base = (window.ARCHIVE_SOURCE_NAME || 'Cythera Data')
    .replace(/\.(hqx|data|bin)$/i, '');
  dlBlob(new Blob([ARCHIVE.bytes], { type: 'application/octet-stream' }),
         safeFileName(base + ' (edited)') + '.data');
}

// --- Structured prop editing ------------------------------------------
// The first field-level editor, sitting on the seam applyResourceEdit
// opened: the map inspector's Edit chip unfolds a small form over one prop
// record, and Apply re-parses the prop list, changes just those fields,
// re-serializes it with writeDelverPropList -- which delv_write_check.mjs
// proves is the exact inverse of the parser over every record in the
// shipped archive -- and hands the bytes to applyResourceEdit. The map
// redraws from the rebuilt archive, so a moved prop visibly moves.
function togglePropEdit(propResid, index) {
  const host = document.getElementById('propEdit-' + index);
  if (!host) return;
  if (host.style.display !== 'none') { host.style.display = 'none'; host.innerHTML = ''; return; }
  const raw = getResourceBytes(ARCHIVE, propResid);
  if (!raw) { setStatus('Prop list 0x' + propResid.toString(16).toUpperCase() + ' is not readable.', true); return; }
  const rec = parseDelverPropList(smartDecrypt(raw, propResid).data)[index];
  if (!rec) return;
  const fld = (label, id, val, size) =>
    '<label>' + label + ' <input id="pe-' + index + '-' + id + '" value="' + val +
    '" size="' + (size || 5) + '" spellcheck="false"></label>';
  host.innerHTML =
    fld('type 0x', 'proptype', rec.proptype.toString(16).toUpperCase()) +
    fld('aspect', 'aspect', rec.aspect, 3) +
    '<label>rotated <input type="checkbox" id="pe-' + index + '-rotated"' + (rec.rotated ? ' checked' : '') + '></label>' +
    fld('x', 'x', rec.x, 4) + fld('y', 'y', rec.y, 4) +
    fld('flags 0x', 'flags', rec.flags.toString(16).padStart(2, '0').toUpperCase(), 3) +
    fld('d3 0x', 'd3', rec.d3.toString(16).padStart(4, '0').toUpperCase()) +
    fld('ref 0x', 'storeref', rec.storeref.toString(16).padStart(4, '0').toUpperCase()) +
    '<button class="sv-chip" onclick="applyPropEditForm(' + propResid + ',' + index + ')">Apply</button>' +
    '<div class="inspDim">x and y are the location in the file: for a prop that is carried or inside something, ' +
    'they give the holder, not a square. Apply rebuilds the whole file.</div>';
  host.style.display = '';
}

function applyPropEditForm(propResid, index) {
  const get = id => document.getElementById('pe-' + index + '-' + id);
  const num = (id, base, max) => {
    const v = parseInt(get(id).value, base);
    return (Number.isInteger(v) && v >= 0 && v <= max) ? v : null;
  };
  const fields = {
    proptype: num('proptype', 16, 0x3FF), aspect: num('aspect', 10, 31),
    rotated: get('rotated').checked ? 0x20 : 0,
    x: num('x', 10, 0xFFF), y: num('y', 10, 0xFFF),
    flags: num('flags', 16, 0xFF), d3: num('d3', 16, 0xFFFF),
    storeref: num('storeref', 16, 0xFFFF)
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) { setStatus('Bad value for ' + k + ', nothing changed.', true); return; }
  }
  applyPropRecordEdit(propResid, index, fields);
}

function applyPropRecordEdit(propResid, index, fields) {
  const raw = getResourceBytes(ARCHIVE, propResid);
  if (!raw) return false;
  const records = parseDelverPropList(smartDecrypt(raw, propResid).data);
  if (!records[index]) return false;
  Object.assign(records[index], fields);
  return applyResourceEdit(propResid, writeDelverPropList(records));
}

function downloadEditedMacBinary() {
  if (!ARCHIVE) return;
  // Both forks in one emulator-ready file: the edited data fork, and the
  // resource fork exactly as it arrived -- data-fork edits never touch it.
  // The Finder identity is whatever the container that brought the archive
  // declared (kept in ARCHIVE_FINDER), so the game recognises its own file.
  const f = window.ARCHIVE_FINDER || { name: 'Cythera Data', type: 'DelS', creator: 'Delv' };
  const bin = writeMacBinary({
    name: f.name, type: f.type, creator: f.creator,
    data: ARCHIVE.bytes, rsrc: window.CYTHERA_RSRC_RAW || new Uint8Array(0)
  });
  const base = (window.ARCHIVE_SOURCE_NAME || f.name || 'Cythera Data')
    .replace(/\.(hqx|data|bin)$/i, '');
  dlBlob(new Blob([bin], { type: 'application/macbinary' }),
         safeFileName(base + ' (edited)') + '.bin');
  const forkWarning = missingForkWarning(window.CYTHERA_RSRC_RAW);
  if (forkWarning) setStatus('Wrote the MacBinary copy, but ' + forkWarning, true);
}

/* The names on the exported disk, and the script that uses them.
   ==========================================================================

   These three constants are a contract with the retired mobile shell, which types the disk
   and the script's names at the emulated Finder to select them -- so they are
   named here rather than spelled inline, and `mobile_install_check.mjs`
   fails if the two pages stop agreeing about them.

   The script itself is the answer to "how do you install a mod without
   knowing where any window is". The Finder cannot copy a file from the
   keyboard -- there is no Copy and Paste for files in System 7 -- and every
   drag needs coordinates, which depend on the screen, the resolution and
   wherever the user last left a window. AppleScript needs none of that, and
   Mac OS 7.6 has it: a TEXT file whose creator is `ToyS` opens in Script
   Editor, and Command-R runs it.

   So the whole install is five keystroke groups with no pointer at all, which
   is what the retired mobile shell's Install button sends. It was worked out against a
   real Mac OS 7.6 and every line of the script below was compiled by it;
   three things it taught, so they are not rediscovered:

     - `try ... end try` does not compile in this AppleScript. It wants the
       `on error` clause, and says "Expected "on" but found "end"".
     - `duplicate ... with replacing` does the replace with no confirmation,
       which is what makes this one step rather than an interactive one.
     - `display dialog` compiles, so the Dialogs scripting addition is there
       and the not-found case can say so.

   The game is *found*, not named: the folder holding an application called
   "Cythera" is the one whose data gets replaced, so this works whatever the
   disk is called and whatever version folder the game sits in. */
const DISK_VOLUME_NAME = 'Cythera Export';
const DISK_SCRIPT_NAME = 'Install and Play';
const DISK_ARCHIVE_NAME = 'Cythera Data';
/* The folder the zip's contents land in inside the emulated Mac. infinite-mac
   names it after the zip itself (`parentName = file.name.slice(0, -4)`), and
   the installer this page's sibling types searches every disk for a folder of
   this name -- so the two have to agree, and
   utilities/mobile_handoff_check.mjs fails if they drift. */
const ZIP_FOLDER_NAME = 'Cythera Patch';

/* A Delver scenario without its resource fork is not a scenario the game will
   open, and nothing about the file says so until Cythera refuses it.

   Measured, in the emulator, against the real 1.0.4 Cythera Data: with its
   1,247,331-byte fork the game starts; with the identical data fork and no
   resource fork it dies on launch with

       Sorry - there has been a fatal error:Unable to open RT

   -- which names nothing a person could connect back to this page. So the
   export says it here instead.

   The fork goes missing whenever the archive arrived without one: a bare
   `.data` file dropped or picked, a `?src=` pointing at one, or a remembered
   copy saved from either. A `.hqx`, MacBinary or AppleSingle carries both,
   which is why index.html fetches the `.hqx` and not the data fork. */
function missingForkWarning(rsrc) {
  if (rsrc && rsrc.length) return null;
  return 'You opened this file without its resource fork, so the disk will not ' +
         'work in the game: Cythera refuses it with “Unable to open RT”. Open the ' +
         '.hqx (or a MacBinary copy) instead of the data fork alone, and export again.';
}
