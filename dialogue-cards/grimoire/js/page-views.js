/* The executable's sheet, Tools, parts and uses, monsters, the text and conversation views, and editing.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at the section banners it had and
   nowhere else, so every function is where it was in the one file. The
   page's furniture is in this tier: js/mac-*.js have nothing of Cythera in
   them, js/delv-*.js cover the formats but not the page, and these cover
   both. They are classic scripts, never modules, because the page has to
   work from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order matters only to
   a statement that runs at load time, which sees what loaded before it; the
   one such statement that needed a later file, the brand line, stayed in
   the page after the last of these. File 12 of 14. */

/* ---- Data > Cythera (App) > Data Fork ------------------------------------
   The PowerPC executable, read with js/mac-pef.js: the container's sections,
   the loader's imported libraries and symbols (the host API the game needs,
   498 of its 563 imports from InterfaceLib), its two exports, and every
   routine the code section names for itself in its traceback tables --
   1,992 in 1.0.4, grouped by class. The sheets that cite a routine
   ("read from the program") show a chip here (pefChip), which opens
   this sheet filtered to the name. Addresses are offsets into the code
   section, the convention the workbench's traces use, except that a trace
   written down as 0x0437BC points at the word after the entry: the entry
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
// A routine cited by name opens on its listing; a name that is not in the
// program filters the list to it, and the empty list states that.
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
   archive's scripts, and each is printed as a link to the instruction it is
   in (srcNum with an `exe` address, jumpToExeAt). Until 11 September
   2026 they were typed in from traces made outside the site
   (cythera-workbench's doc/game-clock.md and doc/talk-balloons.md), which is
   a copy of the program nobody could follow back and an edited program would
   contradict in silence.

   The instructions are js/mac-ppc.js's, the sections and relocations
   js/mac-pef.js's (pefLoad). A routine is found by the name its traceback
   table gives, its instructions decoded once (exeOpsOf), and a call
   resolved to what it reaches: another routine, or through a glue stub --
   `lwz 12, d(2)`, `stw 2, 20(1)`, `lwz 0, 0(12)`, `lwz 2, 4(12)`, `mtctr 0`,
   `bctr` -- to the import whose transition vector is in the TOC slot. An
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
// readers below were calling it a thousand times a render.
function exeRoutineNamed(name) {
  const pef = appPef(); if (!pef || !pef.routines) return null;
  const memo = pef.namedMemo || (pef.namedMemo = new Map());
  if (memo.has(name)) return memo.get(name);
  const r = pef.routines.find(r => r.name === name) || pef.routines.find(r => r.name.startsWith(name + '(')) || pef.routines.find(r => r.mangled === name) || null;
  memo.set(name, r);
  return r;
}
/* A reader's answer, kept with the program it was read from, for a reader
   called once per prop type. The first was exeMonsterKinds: spriteBlockSize
   calls unitArmsFrames, which calls unitArmClass for every prop type, which
   called exeMonsterKinds each time, and the hero's sprite section drew
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
  // One decode an address for the program: the helpers exeEntryAt makes
  // overlap each other and the routines.
  const cache = img.opCache || (img.opCache = new Array(img.code.length >> 2));
  const ops = [];
  for (let at = r.offset; at < r.offset + r.length && at + 4 <= img.code.length; at += 4) {
    let o = cache[at >> 2];
    if (!o) {
      const w = pefU32(img.code, at), d = ppcDecode(w);
      o = cache[at >> 2] = { at, word: w, d, mn: d ? d.mn : '', text: d ? d.text : '.long 0x' + w.toString(16).toUpperCase(),
                             to: d && d.branch && !d.indirect && !d.aa ? at + d.disp : null };
    }
    ops.push(o);
  }
  return (r.ops = ops);
}
// The import a glue stub at `at` calls, or null.
function exeGlueImport(at) {
  const img = appImage(); if (!img || !img.toc) return null;
  const memo = img.glueAt || (img.glueAt = new Map());
  if (memo.has(at)) return memo.get(at);
  const d = [0, 1, 2, 3, 4, 5].map(k => { const w = exeWord(at + 4 * k); return w === null ? null : ppcDecode(w); });
  let name = null;
  if (d[0] && d[0].mn === 'lwz' && d[0].rt === 12 && d[0].ra === 2 && d[5] && d[5].mn === 'bctr') {
    const p = pefPointerAt(img, img.toc.section, img.toc.offset + d[0].d);
    name = p && p.name ? p.name : null;
  }
  memo.set(at, name);
  return name;
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
  const target = exeRoutineNamed(name); if (!target) return [];
  return exeCallSitesOf(target.offset).map(at => { const r = exeRoutineAt(at); const ops = exeOpsOf(r); return { routine: r, ops, i: ops.findIndex(o => o.at === at) }; }).filter(c => c.routine && c.i >= 0);
}
// The addresses of every bl that reaches an offset. By offset, since two
// overloads share a name and exeRoutineNamed finds the first.
function exeCallSitesOf(offset) {
  const img = appImage(), pef = appPef(); if (!img) return [];
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
  return pef.callIndex.get(offset) || [];
}
// A number in an instruction, with its address: { v, exe }.
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

/* Open the application's code at an address: the routine it is in,
   listed, with that instruction ringed. */
window.PEF_VIEW = null;
/* `why` is the words of the link that was followed. A figure's link lands
   on one PowerPC instruction in a listing of hundreds, which the
   maintainer called a line of random text (6 October 2026): the ring showed
   where and nothing explained what. So the listing repeats the link's words
   under the ringed line and describes that instruction in plain
   words (exePlainLines). The words are the ones the click left
   in SRC_CLICKED (srcNum); a jump inside a listing leaves none. */
function jumpToExeAt(at, why) {
  if (window.CUR_SUBN === 'MECHANICS' || MECH_GROUP_BY_VALUE[window.CUR_SUBN]) mechKeepPlace();
  window.PEF_VIEW = { at, why: why || window.SRC_CLICKED || '' };
  window.SRC_CLICKED = '';
  if (window.CUR_SUBN === 'APPPEF') { renderAppPefSheet(); syncDeepLink(); }
  else openVia('APPPEF', () => {});
  setTimeout(() => {
    const hit = document.getElementById('listingHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 40);
  return true;
}
function pefBackToList() { window.PEF_VIEW = null; renderAppPefSheet(); syncDeepLink(); }
// One routine, instruction by instruction: calls and branches named and
// followable, TOC slots shown as their contents.
/* A routine in plain words, a sentence an instruction (6 October 2026).

   A figure's link lands on one PowerPC instruction in a listing of
   hundreds, which the maintainer called a line of random text, and then
   asked whether it had to be machine code at all. So the listing opens in
   words, and the code is another view (EXE_VIEW, exeSetView). Each
   sentence describes its instruction and no more: nothing here
   follows a value from one line to the next, so a sentence reads "a value"
   where a reader of the code would know which. The one thing carried
   forward is what the last test was, so that a branch can say "if that
   switch is off" or "if they are equal" rather than name a condition bit:
   a test of bits (andi., rlwinm.), a comparison, or any other instruction
   that sets the flags from its result. An instruction with no sentence
   is shown as code, dimmed. '' entries are those.

   A mask is written as the page writes a flag, in hex; an offset and a
   count in decimal, as the code view's operands are. */
function exePlainLines(r) {
  if (r.plain) return r.plain;
  const hex = v => '0x' + (v >>> 0).toString(16).toUpperCase().padStart(4, '0');
  const SIZE = { b: 'byte', h: 'two bytes', w: 'four bytes' };
  let last = '';                       // 'switch', 'cmp', 'value' or ''
  const out = exeOpsOf(r).map(o => {
    const d = o.d;
    if (!d) return '';
    const mn = d.mn, bare = mn.replace(/\.$/, '');
    const dot = /\.$/.test(mn);
    let s = '';
    const mem = /^(l|st)(b|h|w)(z|a)?(u)?(x)?$/.exec(mn);
    if (d.branch) {
      const to = o.to !== null ? '\u0001' : 'a fixed address';
      if (d.indirect) s = d.lk ? 'Call a routine through an address.' : d.indirect === 'lr' ? (d.conditional || d.bo !== 20 ? 'Return on a condition.' : 'Return.') : 'Go to one of several places that a number picks.';
      else if (d.conditional && /^b[tf]/.test(mn)) {
        const yes = mn[1] === 't', which = d.bi & 3;
        const cond = last === 'switch' ? (which === 2 ? (yes ? 'that switch is off' : 'that switch is on') : '')
          : last === 'cmp' ? [yes ? 'it is less' : 'it is not less', yes ? 'it is more' : 'it is not more', yes ? 'they are equal' : 'they are not equal'][which]
          : [yes ? 'the value is below zero' : 'the value is not below zero', yes ? 'the value is above zero' : 'the value is not above zero', yes ? 'the value is zero' : 'the value is not zero'][which];
        s = cond ? 'If ' + cond + ', go to ' + to + '.' : '';
      } else if (d.conditional) s = /^bdnz/.test(mn) ? 'Count down and go around again to ' + to + ' until the count runs out.' : '';
      else s = d.lk ? 'Call ' + to + '.' : 'Go to ' + to + '.';
    } else if (mn === 'nop') s = 'Do nothing.';
    else if (mem && d.ra === 2 && !mem[5]) s = mem[1] === 'l' ? 'Fetch an address from the program’s table of addresses.' : '';
    else if (mem && d.ra === 1 && !mem[5]) s = mn === 'stwu' ? 'Make room for this routine’s working values.' : mem[1] === 'l' ? 'Take back a value set aside earlier.' : 'Set a value aside.';
    else if (mem && mem[5]) s = (mem[1] === 'l' ? 'Read an entry of a table (' : 'Write an entry of a table (') + SIZE[mem[2]] + ').';
    else if (mem) s = (mem[1] === 'l' ? 'Read the ' : 'Write the ') + SIZE[mem[2]] + ' at offset ' + d.d + ' of a record.';
    else if (mn === 'stmw') s = 'Save the values this routine will reuse.';
    else if (mn === 'lmw') s = 'Put the saved values back.';
    else if (mn === 'mflr') s = 'Note the return address.';
    else if (mn === 'mtlr') s = 'Get ready to return.';
    else if (mn === 'mtctr') s = 'Get ready to go somewhere through an address.';
    else if (mn === 'li') s = 'Take the number ' + d.imm + '.';
    else if (mn === 'lis') s = 'Take the number ' + hex(d.imm << 16) + '.';
    else if (mn === 'cmpwi' || mn === 'cmplwi') s = 'Compare a value with ' + d.imm + '.';
    else if (mn === 'cmpw' || mn === 'cmplw') s = 'Compare two values.';
    else if (mn === 'mulli') s = 'Multiply a value by ' + d.imm + '.';
    else if (/^addi[sc]?$/.test(bare) && d.ra === 2) s = 'Find a place in the program’s data.';
    else if (bare === 'addi' && d.ra === 1 && d.rd === 1) s = 'Give back the room for working values.';
    else if (bare === 'addi' && d.ra === 1) s = 'Find one of this routine’s working values.';
    else if (bare === 'addi' && d.imm === 0) s = 'Copy a value.';
    else if (bare === 'addi' || bare === 'addic') s = d.imm < 0 ? 'Take ' + (-d.imm) + ' from a value.' : 'Add ' + d.imm + ' to a value.';
    else if (bare === 'addis') s = d.imm < 0 ? 'Take ' + hex(-d.imm << 16) + ' from a value.' : 'Add ' + hex(d.imm << 16) + ' to a value.';
    else if (bare === 'andi') s = 'Check the switch ' + hex(d.imm) + ' of a value.';
    else if (bare === 'andis') s = 'Check the switch ' + hex(d.imm << 16) + ' of a value.';
    else if (mn === 'ori') s = 'Turn on the switch ' + hex(d.imm) + ' of a value.';
    else if (mn === 'oris') s = 'Turn on the switch ' + hex(d.imm << 16) + ' of a value.';
    else if ((bare === 'rlwinm' || bare === 'clrlwi') && d.sh === 0) {
      const mask = ((0xFFFFFFFF >>> d.mb) & (0xFFFFFFFF << (31 - d.me))) >>> 0;
      s = (dot ? 'Check the switch ' : 'Keep only the bits ') + hex(mask) + ' of a value.';
    } else if (mn === 'slwi') s = 'Multiply a value by ' + Math.pow(2, d.sh) + '.';
    else if (mn === 'srwi') s = 'Divide a value by ' + Math.pow(2, d.mb) + '.';
    else if (bare === 'srawi') s = 'Divide a value by ' + Math.pow(2, d.sh) + '.';
    else if (bare === 'addze') s = 'Round that division toward zero.';
    else if (bare === 'rlwinm' || bare === 'rlwimi') s = bare === 'rlwimi' ? 'Put one field into a packed value.' : 'Take one field out of a packed value.';
    else if (bare === 'mr') s = 'Copy a value.';
    else if (bare === 'extsh') s = 'Read a value as a two-byte number.';
    else if (bare === 'extsb') s = 'Read a value as a one-byte number.';
    else if (bare === 'add') s = 'Add two values.';
    else if (bare === 'sub' || bare === 'subf' || bare === 'subc') s = 'Take one value from another.';
    else if (bare === 'subfic') s = 'Take a value from ' + d.imm + '.';
    else if (bare === 'neg') s = 'Turn a value to its negative.';
    else if (bare === 'mullw') s = 'Multiply two values.';
    else if (bare === 'divw' || bare === 'divwu') s = 'Divide one value by another.';
    else if (bare === 'and') s = 'Keep the switches two values share.';
    else if (bare === 'or') s = 'Join the switches of two values.';
    else if (bare === 'xor') s = 'Keep the switches on which two values differ.';
    else if (bare === 'andc') s = 'Turn off in one value the switches another has on.';
    else if (bare === 'not') s = 'Flip every switch of a value.';
    else if (bare === 'cntlzw') s = 'Count the off switches at the top of a value.';
    // What a branch after this one would test.
    if (/^cmp/.test(mn)) last = 'cmp';
    else if (dot) last = /^(andis?|rlwinm|clrlwi|and|andc)$/.test(bare) ? 'switch' : 'value';
    return s;
  });
  return (r.plain = out);
}
// The listing's three views: 'pseudo', 'words' and 'code'. A routine opens
// in pseudo-code, the maintainer's choice.
window.EXE_VIEW = 'pseudo';
function exeSetView(v) {
  window.EXE_VIEW = v;
  renderAppPefSheet();
  setTimeout(() => { const hit = document.getElementById('listingHit'); if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' }); }, 40);
}
/* A routine as pseudo-code (6 October 2026), the third view of a listing.

   The plain-words view describes what each instruction does and cannot show
   what it acts on: "check the switch 0x0080 of a value". This one follows the
   values. Each register has an expression, built up as the instructions run,
   and a line is written only where something happens that outlasts a register:
   a store to memory, a call, a jump, a return, or a value put in a register
   the routine preserves (r13 to r31). So `lbz 0, 6(30)`, `rlwinm. 0, 0, 0, 24,
   24`, `bf 2, ...` is one line, `if ((byte[r30 + 6] & 0x80) != 0) goto ...`.

   What makes it trustworthy, since a wrong expression reads as well as a right
   one:
   - Expressions are followed inside a block only: a stretch with one way in
     and one way out. At a block's start every register is shown by its name.
   - When an instruction after a block reads a scratch register (r0, r3 to
     r12), the register is written out as `rN = ...` at the block's end.
     Which registers are read later is found by ordinary liveness analysis
     over the routine's blocks (exeFlow). A call reads one register for each
     argument of the routine it calls (exeArgCount), and a call into another
     library as many as most of its call sites set (exeImportArgs). A call
     through an address is counted as reading all eight, so some lines
     before one of those are a value nothing reads.
   - Before a line changes a register, a stack slot or memory, any pending
     expression that mentions it is written out first, so no expression is
     ever printed after what it reads has changed.
   - A call is printed with one value for each argument of the routine it
     calls. A call into another library, or to a routine with `...`, is
     printed with what its call site sets (exeImportSiteArgs). A call
     through an address is printed with the argument registers set in its
     block since the last call, from r3 up, which is right when the
     arguments are set where the call is made.

   What it leaves as the code has it: registers keep their numbers (r3 to
   r10 are arg1 to arg8 until the routine moves them), a stack slot is
   localN by its offset, memory is byte[...], half[...] or word[...] by the
   width read, and a global is the name the program's table of addresses
   gives its slot. The sign extensions (extsh, extsb) are dropped: they
   change no value the routine goes on to use as written. The entry and
   exit bookkeeping (the link register, stmw, the stack pointer) is left
   out. An instruction it has no rule for is printed as code, after
   everything pending is written out.

   These lines are flat, a jump a line. The view prints them with the
   jumps made into blocks (exePseudoBlocks, below). A field of a prop, a
   character or a monster is printed by its name where the bits read are
   exactly a field GetField reads (exeRecordFields, below). */
/* The routine a call goes to, when it is one of this program's routines
   entered at its start, and the number of its arguments. Null for a call
   through an address or into another library, whose count nothing here
   reads. */
function exeCalleeArgs(o) {
  const d = o.d;
  if (!d || !d.branch || !d.lk || d.indirect || o.to === null) return null;
  const e = exeOpEntry(o);
  return e ? exeArgCount(e) : exeArgsAt(o.to);
}
/* The number of arguments of the code a call reaches at an address. A
   routine's start has its count. An import's glue has the count its call
   sites set (exeImportArgs). Any other address is a helper the traceback
   tables give no routine, laid out after the routine before it. It counts
   as a routine running from there to the end of that one, since the
   liveness follows only the code the address reaches and what lies after
   the helper's return does not count. Null where nothing is known. */
function exeArgsAt(to) {
  const e = exeEntryAt(to);
  if (e) return exeArgCount(e);
  if (to !== null && exeGlueImport(to) !== null) { const n = exeImportArgs().get(to); return n === undefined ? null : n; }
  return null;
}
/* A routine's blocks for exeArgCount, kept with it: the blocks' shape
   does not depend on any count, so each block is reduced once to the
   registers its instructions read before writing and write, between its
   calls, and a count is then a few bit operations a block (exeCountOnce).
   It reads as exeFlow reads with `forCount`: a call through a pointer
   reads nothing, a return reads nothing, a jump to another routine's start
   reads that routine's arguments and writes nothing. */
function exeCountFlow(x) {
  if (x.countFlow) return x.countFlow;
  const f = exeFlow(x, true, true);
  const blocks = f.B.map(b => {
    const items = [];
    let u = 0, w = 0;
    for (let i = b.s; i <= b.e; i++) {
      const o = f.ops[i], d = o.d;
      if (!d) continue;
      if (!d.branch) {
        // The instruction's two masks, kept on it (exeOpsOf shares it).
        if (!o.regMask) {
          const x2 = exeRegUse(d);
          let mu = 0, mw = 0;
          for (const q of x2.u) mu |= 1 << q;
          for (const q of x2.w) mw |= 1 << q;
          o.regMask = [mu >>> 0, mw >>> 0];
        }
        u |= o.regMask[0] & ~w; w |= o.regMask[1];
        continue;
      }
      const tail = !d.lk && !d.indirect && o.to !== null && !f.inside(o.to);
      if (!d.lk && !tail) continue;
      let e = d.indirect ? null : exeOpEntry(o);
      let fixed = 0;
      if (exeVarargs(e)) { fixed = exeSiteArgs(8, w); e = null; }
      else if (!e && !d.indirect && o.to !== null) { const n = exeImportSiteArgs(o.to, w); fixed = n === null ? 0 : n; }
      items.push({ u: u >>> 0, w: w >>> 0 });
      items.push({ call: true, lk: !!d.lk, e, fixed, site: w >>> 0 });
      u = 0; w = 0;
    }
    items.push({ u: u >>> 0, w: w >>> 0 });
    return { items, succ: b.succ, wild: b.wild };
  });
  return (x.countFlow = blocks);
}
function exeCountOnce(x, all) {
  const blocks = exeCountFlow(x);
  const use = new Uint32Array(blocks.length), def = new Uint32Array(blocks.length), out = new Uint32Array(blocks.length);
  blocks.forEach((b, k) => {
    let u = 0, w = 0;
    for (const it of b.items) {
      if (!it.call) { u |= it.u & ~w; w |= it.w; continue; }
      let n = it.e ? (all.has(it.e) ? all.get(it.e) : exeArgCount(it.e)) : it.fixed;
      if (n === 8 && it.e) n = exeSiteArgs(8, it.site);
      const reads = n ? ((1 << (3 + n)) - 8) : 0;               // r3 to r(2+n)
      u |= reads & ~w;
      if (it.lk) w |= 0x1FF9;
    }
    use[k] = u >>> 0; def[k] = w >>> 0;
  });
  const inOf = k => ((out[k] & ~def[k]) | use[k]) >>> 0;
  for (let again = true; again;) {
    again = false;
    for (let k = blocks.length - 1; k >= 0; k--) {
      let o = blocks[k].wild ? 0x1FF9 : 0;
      for (const q of blocks[k].succ) o |= inOf(q);
      o >>>= 0;
      if (o !== out[k]) { out[k] = o; again = true; }
    }
  }
  const live = blocks.length ? inOf(0) : 0;
  let n = 0;
  for (let q = 3; q <= 10; q++) if (live >>> q & 1) n = q - 2;
  return n;
}
// exeEntryAt for a branch's target, kept on the instruction.
function exeOpEntry(o) {
  if (o.entry === undefined) o.entry = exeEntryAt(o.to);
  return o.entry;
}
/* The routine whose arguments a call to `to` passes: a routine's start, or
   a helper the traceback tables give no routine, as a routine object kept
   with the program. Null for an import's glue and for the glue of a call
   through a pointer (the routine's address in r12), which reaches a
   different routine at each call. */
function exeEntryAt(to) {
  const pef = appPef(), img = appImage();
  if (!pef || !img || to === null || to < 0 || to >= img.code.length) return null;
  const memo = pef.entryAt || (pef.entryAt = new Map());
  if (memo.has(to)) return memo.get(to);
  let e = null;
  const c = exeRoutineAt(to);
  if (c && c.offset === to) e = c;
  else if (exeGlueImport(to) === null) {
    const g0 = ppcDecode(exeWord(to) || 0), g4 = ppcDecode(exeWord(to + 16) || 0);
    if (!(g0 && g0.mn === 'lwz' && g0.rt === 0 && g0.ra === 12 && g4 && g4.mn === 'bctr')) {
      // To the end of the routine it is in or the next routine's start, and
      // before the next address a call goes to, which starts another helper:
      // these are laid out one after another, and a jump from one into the
      // next is a call that returns for it, not a jump inside the first.
      let end = c ? c.offset + c.length : Math.min(img.code.length, to + 0x1000);
      if (!c) for (const r of pef.routines || []) if (r.offset > to) { end = Math.min(end, r.offset); break; }
      exeCallSitesOf(to);
      const starts = pef.callStarts || (pef.callStarts = [...pef.callIndex.keys()].sort((a, b) => a - b));
      let lo = 0, hi = starts.length;
      while (lo < hi) { const m = (lo + hi) >> 1; if (starts[m] <= to) lo = m + 1; else hi = m; }
      if (lo < starts.length) end = Math.min(end, starts[lo]);
      e = { offset: to, length: end - to, name: '0x' + to.toString(16).toUpperCase() };
      // A helper inside a routine reads the routine's decoded instructions.
      if (c && c.ops) e.ops = c.ops.slice((to - c.offset) >> 2);
    }
  }
  memo.set(to, e);
  return e;
}
/* The number of arguments of each routine of another library (the Toolbox,
   the C library), by its glue. The program has no list of them, so each
   call site counts the argument registers set from r3 up between the
   block's start or the last call and this call. A routine's count is the
   one most of its call sites set (the larger, on a tie). The most a site
   sets is no good: a register set for later use before a call counts as
   one of its arguments, and gave TickCount two. A site that passes a value
   it was handed, unchanged, counts it as unset. Worked out once for the
   program. */
function exeImportArgs() {
  const pef = appPef();
  if (pef.importArgs) return pef.importArgs;
  const tally = new Map();
  for (const r of pef.routines || []) {
    let set = 0;
    for (const o of exeOpsOf(r)) {
      const d = o.d;
      if (!d) continue;
      if (d.branch && d.lk) {
        if (!d.indirect && o.to !== null && exeGlueImport(o.to) !== null) {
          let n = 0;
          while (n < 8 && (set >>> (3 + n) & 1)) n++;
          const t = tally.get(o.to) || tally.set(o.to, new Array(9).fill(0)).get(o.to);
          t[n]++;
        }
        set = 0;
      } else if (d.branch) set = 0;
      else for (const q of exeRegUse(d).w) set |= 1 << q;
    }
  }
  const out = new Map();
  for (const [to, t] of tally) { let best = 0; for (let n = 1; n <= 8; n++) if (t[n] >= t[best]) best = n; out.set(to, best); }
  return (pef.importArgs = out);
}
/* Where a `bctr` at ops[i] can go, when it is a switch's jump through a
   table: `addi rB, 2, D` puts the table's address in rB (the table is in
   the data, at D from the TOC), `lwzx rX, rB, rI` reads an entry, and
   `mtctr rX` sets the jump. Each entry is a relocated pointer into the code.
   The entries are read while each is an address in this routine; a word
   past the table is data or another table and stops it. Null for any other
   `bctr` (a call through a pointer that returns for its caller).
   page-rules.js has exeJumpTable, which finds a table by its shape for the
   readers that name its cases.
 *
 * The `cmplwi` that sends a number past the last case elsewhere gives the
 * table's length, and the entries stop there. Two tables can lie end to
 * end, both into the same routine: GetField's for a prop's fields at
 * TOC+0xA1A4 runs straight into the one for a character's at TOC+0xA1F0,
 * and read to the first word outside the routine the first gave 41 cases
 * where the code has 19. */
function exeSwitchTargets(r, ops, i) {
  const img = appImage();
  if (!img || !img.toc) return null;
  let x = -1, b = -1, k = i - 1;
  for (; k >= Math.max(0, i - 6); k--) { const d = ops[k].d; if (d && d.mn === 'mtctr') { x = d.rd; break; } }
  if (x < 0) return null;
  for (k--; k >= Math.max(0, i - 10); k--) { const d = ops[k].d; if (d && d.mn === 'lwzx' && d.rt === x) { b = d.ra; break; } }
  if (b < 0) return null;
  let base = null;
  for (k--; k >= Math.max(0, i - 16); k--) {
    const d = ops[k].d;
    if (d && d.mn === 'addi' && d.rd === b && d.ra === 2) { base = img.toc.offset + d.imm; break; }
    if (d && exeRegUse(d).w.includes(b)) break;
  }
  if (base === null) return null;
  let cases = 256;
  for (let j = i - 1; j >= Math.max(0, i - 16); j--) { const d = ops[j].d; if (d && d.mn === 'cmplwi') { cases = d.imm + 1; break; } }
  const out = [];
  for (let e = 0; e < cases; e++) {
    const p = pefPointerAt(img, img.toc.section, base + 4 * e);
    if (!p || p.section !== img.codeIndex || p.offset < r.offset || p.offset >= r.offset + r.length) break;
    out.push(p.offset);
  }
  return out.length ? out : null;
}
/* The arguments one call to an import passes, from `setMask`, the registers
   set since the block's start or the last call. The import's count
   (exeImportArgs) is what most of its call sites set, and some imports take
   a varying number (CallUniversalProc, which most sites call with five and
   one helper with three), so a site that sets r3 up passes as many as it
   sets, up to that count. A site that sets none of them is passing on the
   values it was handed, and passes the count. Null for no import there. */
function exeImportSiteArgs(to, setMask) {
  const k = exeImportArgs().get(to);
  return k === undefined ? null : exeSiteArgs(k, setMask);
}
function exeSiteArgs(k, setMask) {
  let n = 0;
  while (n < 8 && (setMask >>> (3 + n) & 1)) n++;
  return n === 0 ? k : Math.min(n, k);
}
/* A routine of this program with `...` in its arguments (myprintf,
   MyMoveTo, and the helper at 0xB6A80, which has no name) stores all eight
   argument registers and counts eight, and a call to it passes what the
   call site sets, as a call to an import with a varying count does. A
   routine at eight is read that way whatever its name: one with eight real
   arguments has all eight set where it is called. */
function exeVarargs(e) { return !!e && /\.\.\.\)$/.test(e.name || ''); }
/* The registers an instruction other than a branch reads and writes. */
const EXE_MEM = /^(l|st)(b|h|w|mw)(z|a)?(u)?(x)?$/;
function exeRegUse(d) {
  const u = [], w = [];
  // An operation of a register with itself whose result does not depend on
  // it reads nothing: `subfe 6, 6, 6` is -1 or 0 by the XER's CA bit, and
  // `xor`, `andc` and `subf` of a register with itself give 0. Counted as a
  // read, `subfe 6, 6, 6` at the head of a loop gave the tree's find an
  // argument too many, and every routine that calls it.
  const bare = d.mn.replace(/\.$/, '');
  if (/^subf[ce]?$/.test(bare) && d.ra === d.rb) { w.push(d.rd); return { u, w }; }
  if (/^(xor|andc|eqv)$/.test(bare) && d.rs === d.rb) { w.push(d.ra); return { u, w }; }
  const m = EXE_MEM.exec(d.mn);
  if (m && m[2] !== 'mw') {
    if (d.ra) u.push(d.ra);
    if (m[5]) u.push(d.rb);
    if (m[1] === 'l') w.push(d.rt); else u.push(d.rt);
  } else if (d.mn === 'li' || d.mn === 'lis' || /^mf/.test(d.mn)) { if (d.rd !== undefined) w.push(d.rd); }
  else if (/^mt/.test(d.mn)) { if (d.rd !== undefined) u.push(d.rd); }
  else if (/^cmp/.test(d.mn)) { u.push(d.ra); if (d.rb !== undefined) u.push(d.rb); }
  else if (d.rs !== undefined) { u.push(d.rs); if (d.rb !== undefined) u.push(d.rb); if (/^rlwimi/.test(d.mn)) u.push(d.ra); w.push(d.ra); }
  else if (d.rd !== undefined) { if (d.ra !== undefined) u.push(d.ra); if (d.rb !== undefined) u.push(d.rb); w.push(d.rd); }
  return { u, w };
}
/* The number of a routine's arguments: the highest of r3 to r10 that it
   reads before it sets it (the liveness at its entry), minus two. An
   argument the routine never reads is counted when a later one is read,
   since a caller sets the registers in order. The return counts as reading
   nothing here, or a routine that hands back no value would count r3 as an
   argument, which is the only place this differs from the liveness
   exePseudo uses. A call inside the routine reads one register for each
   argument of the routine it calls, counted the same way.
 *
 * Routines call each other in cycles (the interpreter's VAddrToPtr and
 * DoInterp), so a routine's count is worked out together with the count of
 * every routine a chain of calls from it reaches, and of nothing else,
 * since a count depends on its callees alone: each starts at 0 and all of
 * them are counted again until no count changes. A count only grows as its
 * callees' counts grow, and stops at eight, so the rounds end. A count
 * worked out one routine at a time, with a routine in a cycle counting
 * eight, left 268 routines at eight. The whole program in one solve took
 * nearly four seconds on a desktop, so it is solved by the routines shown.
 *
 * The traceback tables' fixedparms, which would give the count directly,
 * are 0 in every routine of this program.
 *
 * The check is utilities/pseudo_check.mjs: against the demangled names,
 * where a name lists only whole-number and pointer arguments, the count is
 * never more than the list plus `this` and one hidden argument (a
 * destructor's flag, or the address a struct is returned to). */
function exeArgCount(r) {
  const pef = appPef();
  if (!pef) return 0;
  const all = pef.argCounts || (pef.argCounts = new Map());
  if (all.has(r)) return all.get(r);
  if (pef.argSolving) { all.set(r, 0); return 0; }
  // The routines a chain of calls from r reaches, not yet counted, and
  // which of them call which.
  const todo = [r], seen = new Set([r]), callers = new Map([[r, new Set()]]);
  for (let k = 0; k < todo.length; k++) {
    const x = todo[k];
    for (const o of exeOpsOf(x)) {
      const d = o.d;
      if (!d || !d.branch || d.indirect || o.to === null) continue;
      if (!d.lk && o.to >= x.offset && o.to < x.offset + x.length) continue;
      const e = exeOpEntry(o);
      if (!e || all.has(e)) continue;
      if (!seen.has(e)) { seen.add(e); todo.push(e); callers.set(e, new Set()); }
      callers.get(e).add(x);
    }
  }
  for (const x of todo) all.set(x, 0);
  // Callees first, so most counts are right the first time; a routine is
  // counted again when a count it reads grows.
  const queue = todo.slice().reverse(), queued = new Set(queue);
  pef.argSolving = true;
  try {
    for (const x of todo) exeCountFlow(x);
    for (let guard = 0; queue.length && guard < todo.length * 16; guard++) {
      const x = queue.shift(); queued.delete(x);
      const n = exeCountOnce(x, all);
      if (n > all.get(x)) {
        all.set(x, n);
        for (const c of callers.get(x)) if (!queued.has(c)) { queued.add(c); queue.push(c); }
      }
    }
  } finally { pef.argSolving = false; }
  return all.get(r);
}
/* A routine's instructions as blocks (a stretch with one way in and one way
   out) and which registers are read after each block, by ordinary liveness
   analysis. With `forCount`, for exeArgCount, the return reads nothing.
   With `shapeOnly`, for exeCountFlow, the blocks come without the liveness. */
/* Whether a jump can fall through to the next instruction. The decoder
   marks a `bc` that tests a condition; a `bclr` or `bcctr` whose options
   are not "always" (0x14) is the same, and 18 such returns in the program
   (`bclr 12, 2`, a return when equal) had no way on, which dropped what
   the code after them reads from the liveness. */
function exeConditional(d) { return !!d && !!d.branch && (!!d.conditional || (!!d.indirect && d.bo !== undefined && (d.bo & 0x14) !== 0x14)); }
function exeFlow(r, forCount, shapeOnly) {
  const ops = exeOpsOf(r), N = ops.length;
  const idx = at => (at - r.offset) >> 2;
  const inside = at => at !== null && at >= r.offset && at < r.offset + r.length;
  // ---- what each instruction reads and writes, for the liveness ----
  // A call whose count is unknown (through an address) reads all eight
  // argument registers, so no value it might be handed is dropped; for the
  // count it reads none, since its arguments are set beside it.
  /* A call whose count is unknown, through an address (`bctrl`) or the
     glue that calls through a pointer (`bl` to 0xC50E8), reads what its
     site sets from r3 up: the registers from r3 on, without a gap, that
     something writes after the last branch or call before it. That is what
     the pseudo-code prints as its arguments, and until 11 November 2026 it
     was taken to read all eight, which kept every register line before such
     a call whether the call read it or not (`grimoire/listing-hl26zm`). */
  const siteReads = o => {
    let mask = 0;
    for (let j = idx(o.at) - 1; j >= 0; j--) {
      const p = ops[j].d;
      if (!p || p.branch) break;
      for (const q of exeRegUse(p).w) mask |= 1 << q;
    }
    let n = 0;
    while (n < 8 && (mask >>> (3 + n) & 1)) n++;
    return n;
  };
  const callReads = (n, o) => n === null ? (forCount ? 0 : o ? siteReads(o) : 8) : n;
  const ud = o => {
    const d = o.d;
    if (!d) return { u: [], w: [] };
    if (!d.branch) return exeRegUse(d);
    const u = [], w = [];
    if (d.lk) {
      const n = callReads(exeCalleeArgs(o), o);
      for (let i = 3; i <= 2 + n; i++) u.push(i);
      w.push(0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12);
    }
    else if (d.indirect === 'lr' && !forCount) u.push(3);
    // A jump into another routine's start is a call that returns for it.
    else if (!d.indirect && o.to !== null && !inside(o.to)) {
      const e = exeOpEntry(o);
      const n = callReads(e ? exeArgCount(e) : exeArgsAt(o.to));
      for (let i = 3; i <= 2 + n; i++) u.push(i);
    }
    return { u, w };
  };
  const MEM = EXE_MEM;
  // ---- blocks ----
  const leader = new Uint8Array(N + 1), target = new Uint8Array(N + 1);
  leader[0] = 1;
  const tables = new Map();
  ops.forEach((o, i) => {
    const d = o.d;
    if (!d || !d.branch || d.lk) return;
    leader[i + 1] = 1;
    if (inside(o.to)) { leader[idx(o.to)] = 1; target[idx(o.to)] = 1; }
    if (d.indirect === 'ctr') {
      const t = exeSwitchTargets(r, ops, i);
      if (t) { tables.set(i, t); for (const a of t) { leader[idx(a)] = 1; target[idx(a)] = 1; } }
    }
  });
  const starts = []; for (let i = 0; i < N; i++) if (leader[i]) starts.push(i);
  const blockOf = new Int32Array(N); starts.forEach((s, b) => { for (let i = s; i < (b + 1 < starts.length ? starts[b + 1] : N); i++) blockOf[i] = b; });
  const B = starts.map((s, b) => {
    const e = (b + 1 < starts.length ? starts[b + 1] : N) - 1, o = ops[e], d = o.d;
    let use = 0, def = 0;
    if (!shapeOnly) for (let i = s; i <= e; i++) { const x = ud(ops[i]); for (const q of x.u) if (!(def >>> q & 1)) use |= 1 << q; for (const q of x.w) def |= 1 << q; }
    const succ = []; let wild = false;
    if (d && d.branch && !d.lk) {
      if (tables.has(e)) for (const a of tables.get(e)) { const q = blockOf[idx(a)]; if (!succ.includes(q)) succ.push(q); }
      else if (d.indirect) { wild = d.indirect === 'ctr'; if (exeConditional(d) && e + 1 < N) succ.push(blockOf[e + 1]); }
      else { if (inside(o.to)) succ.push(blockOf[idx(o.to)]); if (d.conditional && e + 1 < N) succ.push(blockOf[e + 1]); }
    } else if (e + 1 < N) succ.push(blockOf[e + 1]);
    return { s, e, use: use >>> 0, def: def >>> 0, succ, wild, out: 0 };
  });
  const inOf = b => ((b.out & ~b.def) | b.use) >>> 0;
  for (let again = !shapeOnly; again;) {
    again = false;
    for (let b = B.length - 1; b >= 0; b--) {
      let out = B[b].wild ? 0x1FF9 : 0;                       // a jump through a table: r0, r3 to r12 all live
      for (const q of B[b].succ) out |= inOf(B[q]);
      out >>>= 0;
      if (out !== B[b].out) { B[b].out = out; again = true; }
    }
  }
  return { ops, N, idx, inside, ud, target, B, inOf, MEM, tables };
}
/* ---- a record's fields by name ---------------------------------------------
 * The pseudo-code printed a field of a prop as `(byte[toc_m30268 + (r29 <<
 * 4) + 4] >> 2) & 0x1F`. No file has a record's fields by name. The
 * interpreter does read them by number: the scripts' get_field and
 * set_field call GetField(short, short, short), which reads field n of a
 * prop, a character or a monster in a switch on n, one case a field, each
 * case loading the field out of the kind's table of records. delvmod names
 * those numbers (DVM_SYM.field: 3 aspect, 21 behavior), so a case's value,
 * read bit for bit, is the field of that name, and the same bits read
 * anywhere else in the program are that field too. Nothing is typed in:
 * the tables, their strides, the offsets and bits come out of GetField's
 * code, and the names from delvmod, the one outside source the listings use.
 *
 * WHICH VALUES ARE RECORDS. A register's fact (exeRecStep) follows the
 * shape the program indexes a table with: a pointer loaded from the TOC (a
 * table's address) or through it (a global pointing at a table), an index
 * shifted or multiplied by the record size, and the two added; an `addi`
 * moves the pointer within the record. The facts are carried across the
 * blocks (exeRecFacts): a register is a record pointer at a block's start
 * when it is the same one at the end of every block that leads there. An
 * argument whose type in the routine's name is a record's (PropItem*,
 * CharEntry*) starts as one; GetField gives each type its table, by the
 * routines it hands a record to (GetItemCount(PropItem*)).
 *
 * WHICH BITS. A value read out of a record is followed bit by bit
 * (exeCellBits and exeBitsStep): each bit of the value is a bit of the
 * record or a zero, through shifts, rotates, masks, sign extensions and an
 * `or` of two pieces. A field is named where the bits are exactly the bits
 * GetField's case reads for it, so `(byte[r30 + 4] >> 2) & 0x1F` is the
 * aspect, `byte[r30 + 4] & 0x80` is not (the rotate bit, not shifted down),
 * and a value read some other way is printed as code.
 *
 * WHICH KIND. GetField picks the table by the object's type first, a test
 * `type == 72` and so on; the kind of a table is delvmod's name for the
 * lowest type whose test leads to the switch that reads it (DVM_SYM.objtype:
 * 0 Prop, 64 Character, 72 Monster). A record is printed `Prop[i].aspect`
 * where the pointer is worked out in view, and `r30->aspect` where the
 * pointer is in a register or an argument. */
function exeRecTable(f) { return typeof f === 'string' && /^(toc|glob|data):/.test(f); }
function exeRecOf(f) { if (typeof f !== 'string' || f.slice(0, 4) !== 'rec|') return null; const p = f.split('|'); return { table: p[1], stride: +p[2], off: +p[3] }; }
function exeRecFact(table, stride, off) { return 'rec|' + table + '|' + stride + '|' + off; }
// A table's address: a table, or its first record where the stride is known.
function exeRecBase(f) { if (exeRecTable(f)) return { table: f, stride: 0 }; const r = exeRecOf(f); return r && r.off === 0 ? { table: r.table, stride: r.stride } : null; }
// An index scaled by a stride, with a byte offset added: `scaled:16:4`.
function exeScaledOf(f) { if (typeof f !== 'string' || f.slice(0, 7) !== 'scaled:') return null; const p = f.split(':'); return { stride: +p[1], off: +p[2] }; }
/* One instruction's change to the facts `st`, a fact a register.
   `strideOf` gives a table's stride where GetField reads it with one, so
   the table's address plus a constant is a record: `toc_m30268 + 4096` is
   Prop 256. A record pointer moved by a whole record is still one, so a
   pointer a loop steps by 16 through the props is a record pointer
   throughout. */
function exeRecStep(st, d, strideOf) {
  if (!d) return;
  if (d.branch) { if (d.lk) for (const q of [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) st[q] = null; return; }
  const m = EXE_MEM.exec(d.mn);
  if (m) {
    if (m[2] === 'mw') { if (m[1] === 'l') for (let q = d.rt; q < 32; q++) st[q] = null; return; }
    if (m[1] === 'l') {
      let v = null;
      if (!m[5] && d.ra === 2) v = 'toc:' + d.d;
      else if (!m[5] && d.d === 0 && m[2] === 'w' && /^toc:/.test(st[d.ra] || '')) v = 'glob:' + st[d.ra].slice(4);
      if (m[4] && d.ra) st[d.ra] = null;
      st[d.rt] = v;
    } else if (m[4] && d.ra) st[d.ra] = null;
    return;
  }
  const bare = d.mn.replace(/\.$/, '');
  let q = -1, v = null;
  if (bare === 'addi' || bare === 'addic' || bare === 'addis') {
    q = d.rd;
    const imm = bare === 'addis' ? d.imm << 16 : d.imm;
    const r = exeRecOf(st[d.ra]), s = exeScaledOf(st[d.ra]), stride = exeRecTable(st[d.ra]) && strideOf ? strideOf(st[d.ra]) : 0;
    if (d.ra === 2 && bare === 'addi') v = 'data:' + imm;
    else if (r) v = exeRecFact(r.table, r.stride, ((r.off + imm) % r.stride + r.stride) % r.stride);
    else if (s) v = 'scaled:' + s.stride + ':' + (s.off + imm);
    else if (stride) v = exeRecFact(st[d.ra], stride, (imm % stride + stride) % stride);
  } else if (bare === 'mr') { q = d.ra; v = st[d.rs]; }
  else if (/^(rlwinm|slwi)$/.test(bare) && d.sh > 0 && d.sh < 16 && d.me === 31 - d.sh) { q = d.ra; v = 'scaled:' + (1 << d.sh) + ':0'; }
  else if (bare === 'mulli' && d.imm > 1) { q = d.rd; v = 'scaled:' + d.imm + ':0'; }
  else if (bare === 'add') {
    q = d.rd;
    const a = exeRecBase(st[d.ra]), b = exeRecBase(st[d.rb]), sa = exeScaledOf(st[d.ra]), sb = exeScaledOf(st[d.rb]);
    if (a && sb && (!a.stride || a.stride === sb.stride)) v = exeRecFact(a.table, sb.stride, sb.off);
    else if (b && sa && (!b.stride || b.stride === sa.stride)) v = exeRecFact(b.table, sa.stride, sa.off);
  }
  if (q >= 0) { st[q] = v; return; }
  for (const w of exeRegUse(d).w) st[w] = null;
}
// Each table's stride, where GetField reads it with one and the fields are learned.
function exeRecStrides(RF) {
  if (!RF || RF.learning) return null;
  if (RF.strideOf) return RF.strideOf;
  const by = new Map();
  for (const k of RF.tables.keys()) { const [t, s] = k.split('|'); by.set(t, by.has(t) ? 0 : +s); }
  return (RF.strideOf = t => by.get(t) || 0);
}
/* The facts at the start of each block of `flow` (exeFlow's), by the
   block's first instruction: a register has a fact where every block
   leading there ends with it. Block 0 starts with the record arguments. */
function exeRecFacts(r, flow, RF) {
  const { ops, B } = flow, strideOf = exeRecStrides(RF);
  const start = new Array(32).fill(null);
  if (RF && RF.types.size) {
    const list = exeArgList(r.name), n = list ? exeArgCount(r) : 0;
    const cls = /^([A-Za-z_]\w*)::/.exec(r.name);
    if (list && n >= list.length && n <= list.length + 1) {
      const skip = n - list.length;
      if (skip && cls && RF.types.has(cls[1] + '*')) start[3] = RF.types.get(cls[1] + '*');
      list.forEach((t, i) => { const k = RF.types.get(t.replace(/^const /, '').replace(/&$/, '*')); if (k && 3 + skip + i <= 10) start[3 + skip + i] = k; });
    }
  }
  const at = new Map([[0, start]]);
  const preds = B.map(() => []);
  B.forEach((b, i) => { for (const q of b.succ) preds[q].push(i); });
  const out = B.map(() => null);
  for (let round = 0, again = true; again && round < 32; round++) {
    again = false;
    B.forEach((b, i) => {
      let st;
      if (i === 0) st = start.slice();
      else {
        // Where a loop starts a pointer at a table and steps it a record at
        // a time, the table meets a record pointer: both are a record then.
        const norm = f => exeRecTable(f) && strideOf && strideOf(f) ? exeRecFact(f, strideOf(f), 0) : f;
        // A block none of whose ways in has been read yet waits for one.
        // Taken as knowing nothing, it cleared every fact in every loop.
        const ins = preds[i].map(p => out[p]).filter(Boolean);
        if (!ins.length) return;
        st = ins[0].map((f, q) => ins.every(x => x[q] === f) ? f : ins.every(x => norm(x[q]) === norm(f)) ? norm(f) : null);
      }
      at.set(b.s, st.slice());
      for (let k = b.s; k <= b.e; k++) exeRecStep(st, ops[k].d, strideOf);
      if (!out[i] || out[i].some((f, q) => f !== st[q])) { out[i] = st; again = true; }
    });
  }
  return at;
}
// A demangled name's argument list, split at its top-level commas.
function exeArgList(name) {
  const open = name.indexOf('(');
  if (open < 0) return null;
  let depth = 0, cur = '';
  const out = [];
  for (let i = open + 1; i < name.length; i++) {
    const c = name[i];
    if (c === '(' || c === '<') depth++;
    if (c === ')' || c === '>') { if (depth === 0) { if (cur.trim()) out.push(cur.trim()); return out; } depth--; }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return null;
}
/* A value's bits as the record has them: entry p is the bit of the record
   (counted from its first byte's top bit) at bit p of the value, bit 0 the
   lowest, or -1 for a zero. */
function exeCellBits(off, size, signed) {
  const n = size * 8, out = new Array(32).fill(-1);
  for (let p = 0; p < n; p++) out[p] = off * 8 + n - 1 - p;
  if (signed) for (let p = n; p < 32; p++) out[p] = out[n - 1];
  return out;
}
// The bits a transform of a record's value leaves, or null.
function exeBitsStep(d, reg) {
  const bare = d.mn.replace(/\.$/, '');
  const mask = (mb, me) => ((0xFFFFFFFF >>> mb) & (0xFFFFFFFF << (31 - me))) >>> 0;
  const keep = (b, m) => b.map((x, p) => (m >>> p) & 1 ? x : -1);
  const rotl = (b, n) => { const o = new Array(32); for (let p = 0; p < 32; p++) o[(p + n) & 31] = b[p]; return o; };
  let b = null;
  if (/^(rlwinm|clrlwi|slwi|srwi|rotlwi)$/.test(bare)) { const s = reg[d.rs].bits; if (s) b = keep(rotl(s, d.sh), mask(d.mb, d.me)); }
  else if (bare === 'andi' || bare === 'andis') { const s = reg[d.rs].bits; if (s) b = keep(s, bare === 'andi' ? d.imm : (d.imm << 16) >>> 0); }
  else if (bare === 'srawi') { const s = reg[d.rs].bits; if (s) b = s.map((x, p) => p + d.sh <= 31 ? s[p + d.sh] : s[31]); }
  else if (bare === 'mr') b = reg[d.rs].bits || null;
  else if (bare === 'extsh' || bare === 'extsb') { const s = reg[d.rs].bits, top = bare === 'extsh' ? 15 : 7; if (s) b = s.map((x, p) => p > top ? s[top] : x); }
  else if (bare === 'or' || bare === 'rlwimi') {
    const m = bare === 'rlwimi' ? mask(d.mb, d.me) : 0;
    const a = bare === 'rlwimi' ? (reg[d.ra].bits ? keep(reg[d.ra].bits, ~m >>> 0) : reg[d.ra].k === 0 ? new Array(32).fill(-1) : null) : reg[d.rs].bits;
    const c = bare === 'rlwimi' ? (reg[d.rs].bits ? keep(rotl(reg[d.rs].bits, d.sh), m) : null) : reg[d.rb].bits;
    const fa = bare === 'rlwimi' ? reg[d.ra].fld : reg[d.rs].fld, fc = bare === 'rlwimi' ? reg[d.rs].fld : reg[d.rb].fld;
    if (a && c && (!fa || !fc || fa.key === fc.key)) { b = a.map((x, p) => x !== -1 && c[p] !== -1 ? null : x !== -1 ? x : c[p]); if (b.includes(null)) b = null; }
  }
  return b && b.some(x => x !== -1) ? b : null;
}
/* The fields GetField reads, learned once for the program: for each table
   (`toc:D` the TOC slot with its address, `glob:D` the global it points
   at, `data:D` data at D from the TOC) and stride, its kind's name and a
   map from a field's bits to its name; and the record types the program's
   routine names give a table. */
function exeRecordFields() {
  const pef = appPef();
  if (!pef) return null;
  if (pef.recordFields) return pef.recordFields;
  const RF = pef.recordFields = { tables: new Map(), types: new Map(), learning: true };
  try {
    const g = exeRoutineNamed('GetField(short, short, short)');
    if (!g || typeof DVM_SYM === 'undefined') return RF;
    const flow = exeFlow(g, false, true), { ops, B, tables } = flow;
    const facts = exeRecFacts(g, flow, null);
    // The types: a record handed to a routine whose name gives the argument's type.
    for (const b of B) {
      const st = (facts.get(b.s) || new Array(32).fill(null)).slice();
      for (let k = b.s; k <= b.e; k++) {
        const o = ops[k], d = o.d;
        if (d && d.branch && d.lk && !d.indirect && o.to !== null) {
          const e = exeOpEntry(o), list = e ? exeArgList(e.name) : null;
          if (list) {
            const skip = exeArgCount(e) - list.length;
            list.forEach((t, i) => { const q = 3 + skip + i, rf = exeRecOf(st[q]); if (q <= 10 && rf && rf.off === 0 && /\*$/.test(t)) RF.types.set(t, exeRecFact(rf.table, rf.stride, 0)); });
          }
        }
        exeRecStep(st, d);
      }
    }
    // The kind of each switch on a field: the lowest object type whose
    // test (`== N` jumping to a block) leads to it first.
    const blockAt = new Map(B.map((b, i) => [b.s, i]));
    const switchOf = from => {
      const seen = new Set([from]), queue = [from];
      for (let h = 0; h < queue.length && h < 64; h++) {
        const b = B[queue[h]];
        if (tables.has(b.e)) return b.e;
        for (const q of b.succ) if (!seen.has(q)) { seen.add(q); queue.push(q); }
      }
      return null;
    };
    const kindOf = new Map();
    ops.forEach((o, k) => {
      const d = o.d;
      if (!d || d.mn !== 'cmpwi' || !DVM_SYM.objtype[d.imm]) return;
      const br = ops[k + 1] && ops[k + 1].d;
      if (!br || br.mn !== 'bt' || (br.bi & 3) !== 2 || !blockAt.has((ops[k + 1].to - g.offset) >> 2)) return;
      const sw = switchOf(blockAt.get((ops[k + 1].to - g.offset) >> 2));
      if (sw !== null && (!kindOf.has(sw) || d.imm < kindOf.get(sw).type)) kindOf.set(sw, { type: d.imm, name: DVM_SYM.objtype[d.imm] });
    });
    // Each case's value: the first value read out of a record that the case
    // stores, from its first line to the next case.
    const L = exePseudoLines(g, RF);
    for (const [sw, kind] of kindOf) {
      let low = 0, bound = -1;
      for (let j = sw - 1; j >= Math.max(0, sw - 16); j--) { const d = ops[j].d; if (d && d.mn === 'cmplwi') { bound = j; break; } }
      if (bound < 0) continue;
      const by = ops[bound].d.ra;
      for (let j = bound - 1; j >= 0; j--) { const d = ops[j].d; if (d && exeRegUse(d).w.includes(by)) { if (d.mn === 'addi' && d.ra) low = -d.imm; break; } }
      const deflt = ops[bound + 1] && ops[bound + 1].to;
      const cases = tables.get(sw), starts = [...new Set(cases)].filter(a => a !== deflt).sort((a, b) => a - b);
      cases.forEach((a, k) => {
        if (a === deflt) return;
        const name = DVM_SYM.field[low + k];
        if (!name) return;
        const end = starts.find(x => x > a) || g.offset + g.length;
        const l = L.find(x => x.at >= a && x.at < end && x.val && x.val.bits && x.val.fld);
        if (!l) return;
        const key = l.val.fld.key;
        if (!RF.tables.has(key)) RF.tables.set(key, { kind: kind.name, fields: new Map() });
        const t = RF.tables.get(key);
        if (t.kind === kind.name && !t.fields.has(l.val.bits.join(','))) t.fields.set(l.val.bits.join(','), name);
      });
    }
    // Each field's bits by the place each has in the field's value, for a
    // value that is part of one field (exePseudoLines' fieldName). Smallest
    // first, so a bit in two fields is printed by the narrower.
    for (const t of RF.tables.values()) {
      t.parts = [];
      for (const [key, name] of t.fields) {
        const at = new Map();
        key.split(',').map(Number).forEach((x, p) => { if (x !== -1 && !at.has(x)) at.set(x, p); });
        t.parts.push({ name, at });
      }
      t.parts.sort((a, b) => a.at.size - b.at.size);
      // A field made of whole smaller fields (aspect_and_proptype is the
      // rotate bit, the aspect and the type) is the same bits under another
      // name. One that only shares bits with them (a prop's container, the
      // low 16 bits of its location, where its y is the low 12) is another
      // reading of them.
      for (const P of t.parts) {
        const union = new Set();
        for (const Q of t.parts) if (Q !== P && Q.at.size < P.at.size && [...Q.at.keys()].every(x => P.at.has(x))) for (const x of Q.at.keys()) union.add(x);
        P.composite = union.size === P.at.size;
      }
    }
  } finally { RF.learning = false; }
  return RF;
}
function exePseudo(r) {
  if (r.pseudo) return r.pseudo;
  const lines = exePseudoLines(r, exeRecordFields());
  // The line an instruction's work ends up on: the first written at or after it.
  const ops = exeOpsOf(r), stmtOf = new Int32Array(ops.length).fill(-1);
  let li = 0;
  for (let i = 0; i < ops.length; i++) { while (li < lines.length - 1 && lines[li].at < ops[i].at) li++; stmtOf[i] = lines.length ? li : -1; }
  return (r.pseudo = { lines, stmtOf });
}
function exePseudoLines(r, RF) {
  const img = appImage();
  const flow = exeFlow(r, false), { ops, N, ud, target, B, MEM, tables, inside } = flow;
  const facts = exeRecFacts(r, flow, RF);
  const vol = n => n === 0 || (n >= 3 && n <= 12);
  // ---- expressions ----
  const hexOf = v => '0x' + (v >>> 0).toString(16).toUpperCase();
  const num = (v, hexy) => { v |= 0; return hexy || v > 0xFFFF || v < -0xFFFF ? (hexy && v >= 0 && v < 10 ? String(v) : hexOf(v)) : String(v); };
  const atom = s => ({ s, p: 0 });
  const konst = v => ({ s: null, p: 0, k: v | 0 });
  const str = (e, hexy) => e.k !== undefined ? num(e.k, hexy) : e.s;
  // Brackets where the operand binds looser, and always where shifts and
  // the bitwise operators meet, whose order nobody reads unaided.
  const wrap = (e, p, hexy, same) => e.k === undefined && e.p > 0 && (e.p > p || (e.p === p && !same) || (e.p >= 4 && e.p !== p)) ? '(' + e.s + ')' : str(e, hexy);
  const bin = (op, a, b, p, hexy) => ({ s: wrap(a, p, hexy, true) + ' ' + op + ' ' + wrap(b, p, hexy, /[&|+*^]/.test(op)), p, mem: a.mem || b.mem });
  const add = (a, v) => a.k !== undefined ? konst(a.k + v) : v === 0 ? a : v < 0 ? bin('-', a, konst(-v), 3) : bin('+', a, konst(v), 3);
  const and = (a, m) => a.k !== undefined ? konst(a.k & m) : bin('&', a, konst(m), 5, true);
  const WIDTH = { b: 'byte', h: 'half', w: 'word' };
  const tocName = dsp => {
    const p = img.toc ? pefPointerAt(img, img.toc.section, img.toc.offset + dsp) : null;
    const s = p && p.section !== undefined ? exeStringAt(p) : null;
    if (p && p.name) return '&' + p.name.replace(/[^A-Za-z0-9_:~]/g, '_');
    if (s) return JSON.stringify(s.replace(/\n/g, ' ').slice(0, 40));
    return '&toc_' + (dsp < 0 ? 'm' + (-dsp) : dsp);
  };
  const memOf = (wd, base, dsp) => {
    const loc = base.k === undefined ? /^&local(-?\d+)$/.exec(base.s) : null;
    if (loc) return atom('local' + (parseInt(loc[1], 10) + dsp));
    if (base.k === undefined && base.p === 0 && base.s[0] === '&' && dsp === 0) return { s: base.s.slice(1), p: 0, mem: true };
    return { s: WIDTH[wd] + '[' + str(add(base, dsp)) + ']', p: 0, mem: true };
  };
  const lines = [];
  // A load or store through a record pointer (the facts before the
  // instruction, `st`): the record's table, stride and the bits read, and
  // how the record is printed, `Prop[i].` where the pointer was worked out
  // in view (`recOf`) and `r30->` where a register or an argument has it.
  let st = null, reg = null;
  // A table and an index in registers a and b, either way round: the
  // record's table, stride and offset, and `Prop[i]` where the table's kind
  // is known and the index before its scaling is in view. An index with no
  // scaling reads a table of bytes, one record a byte.
  const strideOf = exeRecStrides(RF);
  /* A record worked out in view, `recOf` on its expression: the kind, the
     index (an expression, or a number for a constant one), how many whole
     records were added to it, and the byte offset into the record. */
  const recRef = (kind, stride, idx, num, k, off) => {
    k += Math.floor(off / stride); off = ((off % stride) + stride) % stride;
    if (num !== null) { num += k; k = 0; }
    const txt = kind + '[' + (num !== null ? num : k ? wrap(idx, 3, false, true) + (k > 0 ? ' + ' + k : ' - ' + -k) : str(idx)) + ']';
    return { kind, stride, idx, num, k, off, txt };
  };
  const recExpr = ro => ({ s: '&' + ro.txt + (ro.off ? ' + ' + ro.off : ''), p: ro.off ? 3 : 0, recOf: ro });
  // A table's address loaded, where its stride and kind are known: `&Prop[0]`.
  const tableStart = t => {
    const s = strideOf ? strideOf(t) : 0, known = s && RF.tables.get(t + '|' + s);
    return known ? recExpr(recRef(known.kind, s, null, 0, 0, 0)) : null;
  };
  // A table and an index in registers a and b, either way round: the
  // record's table, stride and offset, and the record where the table's
  // kind is known and the index before its scaling is in view. An index
  // with no scaling reads a table of bytes, one record a byte.
  const recIndex = (a, b) => {
    for (const [t, i] of [[a, b], [b, a]]) {
      const base = exeRecBase(st[t]);
      if (!base) continue;
      const s = exeScaledOf(st[i]);
      if (!s && st[i]) continue;
      const stride = s ? s.stride : 1, off = s ? s.off : 0;
      if (base.stride && base.stride !== stride) continue;
      // The index is printed only against the table's start: a record
      // pointer that is not known to be record 0 gives the sum no name.
      const x = reg[t], start = !base.stride || (x.recOf && x.recOf.num === 0 && x.recOf.off === 0);
      const known = RF && RF.tables.get(base.table + '|' + stride);
      const idx = s ? reg[i].unscaled : reg[i];
      const ro = known && idx && start ? recRef(known.kind, stride, idx, null, 0, off) : null;
      return { table: base.table, stride, off: ro ? ro.off : off, ro };
    }
    return null;
  };
  /* A load or store through a record pointer: its bits, the table's key,
     and how the record is printed (`rt`), `Prop[i].` where it was worked
     out in view and `r30->` where a register or an argument has it; with
     `plain`, the cell printed against the record where no field matches. */
  const recCell = (d, m) => {
    if (!RF) return null;
    const size = { b: 1, h: 2, w: 4 }[m[2]];
    let rec = null, ro = null, rt = null;
    if (!m[5]) {
      // Through a table's address itself, record 0.
      const f = exeRecOf(st[d.ra]) || (exeRecTable(st[d.ra]) && strideOf && strideOf(st[d.ra]) ? { table: st[d.ra], stride: strideOf(st[d.ra]), off: 0 } : null), x = reg[d.ra];
      if (f) {
        rec = { table: f.table, stride: f.stride, off: f.off + d.d };
        if (x.recOf && x.recOf.off === f.off) ro = x.recOf;
        else if (f.off === 0 && /^(r|arg)\d+$/.test(x.s || '')) rt = x.s + '->';
      }
    } else {
      const ri = recIndex(d.ra, d.rb);
      if (ri) { rec = ri; ro = ri.ro; }
    }
    if (!rec || rec.off < 0 || rec.off + size > rec.stride) return null;
    const key = rec.table + '|' + rec.stride;
    if (!RF.learning && !RF.tables.has(key)) return null;
    if (ro) rt = ro.txt + '.';
    const plain = ro ? WIDTH[m[2]] + '[&' + ro.txt + (rec.off ? ' + ' + rec.off : '') + ']' : null;
    return { bits: exeCellBits(rec.off, size, m[3] === 'a'), fld: { key, rt }, plain };
  };
  // A value as a field, where its bits are exactly a field's, or a field's
  // shifted left: `(r30->obj_type << 2)` indexes a table of words by the
  // prop's type.
  /* Where the bits are part of one field, in its order and moved together
     (a flag tested in place, `byte[r30 + 4] & 0x80`), the field with a
     mask and a shift: `r30->rotate << 7`. `unshift` is the same without
     the shift, which a test of equality with 0 prints, since moving the
     bits does not change whether any is set. */
  // A cell read or written whole is named only where it is a whole field
  // (`partial` false): a byte that is part of a field prints as the byte.
  const fieldName = (f, bits, partial) => {
    if (!f || !f.rt || !RF || RF.learning) return null;
    const t = RF.tables.get(f.key);
    if (!t) return null;
    const nm = t.fields.get(bits.join(','));
    if (nm) return { s: f.rt + nm, p: 0 };
    const set = bits.map((x, p) => [x, p]).filter(e => e[0] !== -1);
    if (new Set(set.map(e => e[0])).size !== set.length) return null;
    // The bits are named only where they have one reading: every field
    // holding them but the narrowest is made of whole smaller fields.
    if (!partial) return null;
    const holding = t.parts.filter(P => set.every(e => P.at.has(e[0])));
    if (!holding.length || holding.slice(1).some(P => !P.composite)) return null;
    for (const part of holding.slice(0, 1)) {
      let k = null, m = 0, ok = true;
      for (const [x, p] of set) {
        const q = part.at.get(x);
        if (q === undefined || (k !== null && p - q !== k)) { ok = false; break; }
        k = p - q; m |= 1 << q;
      }
      if (!ok || k === null) continue;
      const whole = (m >>> 0) === (part.at.size >= 32 ? 0xFFFFFFFF : ((1 << part.at.size) - 1) >>> 0);
      const base = whole ? { s: f.rt + part.name, p: 0 } : { s: f.rt + part.name + ' & ' + hexOf(m), p: 5 };
      if (!k) return base;
      return { s: (base.p ? '(' + base.s + ')' : base.s) + (k > 0 ? ' << ' + k : ' >> ' + -k), p: 4, unshift: base };
    }
    return null;
  };
  // A test carried into the next block. A block that only a conditional
  // jump falls into, and nothing jumps to, sees the comparison that jump
  // tested: `cmpwi`, `beq`, `bge` is two blocks, and the second jump read
  // "an earlier test >= 0" in 338 places.
  let carry = null;
  for (const blk of B) {
    reg = [];
    st = (facts.get(blk.s) || new Array(32).fill(null)).slice();
    for (let i = 0; i < 32; i++) reg.push(atom('r' + i));
    if (blk.s === 0) for (let i = 3; i <= 10; i++) reg[i] = atom('arg' + (i - 2));
    const fresh = new Set();
    let cond = blk.s > 0 && !target[blk.s] ? carry : null, at = 0, to = null;
    carry = null;
    // `flow` is what the line does to the order the code runs in, for
    // exePseudoBlocks: a test that jumps (`cond`, with the test as written
    // and its opposite), a jump in the routine, a switch, or an end.
    // `val` is the value a store writes, which exeRecordFields reads.
    const addLine = (text, link, flow, val) => lines.push({ at, text, to: link === undefined ? null : link, flow: flow || null, val: val || null });
    const name = q => 'r' + q;
    const settle = q => { if (reg[q].k === undefined && reg[q].s === name(q)) return; addLine(name(q) + ' = ' + str(reg[q])); reg[q] = atom(name(q)); };
    // Whether a register's value is read from instruction `from` on: later
    // in the block before it is replaced, or after the block.
    const isUsedLater = (q, from) => {
      for (let j = from; j <= blk.e; j++) { const x = ud(ops[j]); if (x.u.includes(q)) return true; if (x.w.includes(q)) return false; }
      return !!(blk.out >>> q & 1);
    };
    // Before something changes, each pending expression that reads it is
    // written out if a later instruction reads its register, and otherwise
    // dropped.
    let now = blk.s;
    const before = (test, self) => { for (let q = 0; q < 32; q++) if (vol(q) && reg[q].k === undefined && reg[q].s !== name(q) && test(reg[q])) { if (isUsedLater(q, self ? now : now + 1)) settle(q); else reg[q] = atom(name(q)); } };
    // A test whose operands have since changed is printed as it stood.
    const stale = test => { if (cond && !cond.old && ((cond.a.k === undefined && test(cond.a)) || (cond.b.k === undefined && test(cond.b)))) cond.old = true; };
    const mentions = word => e => new RegExp('(^|[^A-Za-z0-9_])' + word + '($|[^A-Za-z0-9_])').test(e.s);
    const set = (q, e) => {
      if (q === 1 || q === 2) return;
      before(mentions(name(q)));
      stale(mentions(name(q)));
      // An expression that reads the register it is going into is written out
      // immediately.
      if (!vol(q) || (e.k === undefined && (mentions(name(q))(e) || e.s.length > 64))) {
        if (!(e.k === undefined && e.s === name(q))) addLine(name(q) + ' = ' + str(e));
        reg[q] = atom(name(q));
      } else reg[q] = e;
      fresh.add(q);
    };
    if (target[blk.s]) { at = ops[blk.s].at; addLine('\u0002'); }
    for (let i = blk.s; i <= blk.e; i++) {
      const o = ops[i], d = o.d;
      at = o.at; now = i;
      const raw = () => { before(() => true, true); addLine('\u0003' + o.text); };
      if (!d) raw();
      else {
        const mn = d.mn, bare = mn.replace(/\.$/, ''), dot = bare !== mn;
        const m = MEM.exec(mn);
        let res = null, dest = -1;
        if (d.branch) {
          if (d.lk) {
            let freshMask = 0;
            for (const q of fresh) freshMask |= 1 << q;
            const entry = !d.indirect && o.to !== null ? exeOpEntry(o) : null;
            const imp = entry && (exeVarargs(entry) || exeArgCount(entry) === 8) ? exeSiteArgs(8, freshMask)
              : !d.indirect && o.to !== null && !entry ? exeImportSiteArgs(o.to, freshMask) : null;
            const n = imp !== null ? imp : exeCalleeArgs(o), args = [];
            if (n !== null) for (let q = 3; q <= 2 + n; q++) args.push(str(reg[q]));
            else for (let q = 3; q <= 10 && fresh.has(q); q++) args.push(str(reg[q]));
            const callee = d.indirect ? '(*' + (d.indirect === 'ctr' ? 'address' : 'return address') + ')' : '\u0001';
            addLine('r3 = ' + callee + '(' + args.join(', ') + ')', d.indirect ? null : o.to);
            for (const q of [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) reg[q] = atom(name(q));
            fresh.clear(); cond = null;
          } else {
            const iffy = exeConditional(d);
            for (let q = 0; q < 32; q++) if (vol(q) && (blk.out >>> q & 1) && !(d.indirect === 'lr' && !iffy && q === 3)) settle(q);
            // The test a conditional jump makes, as written and its opposite.
            const testOf = () => {
              const yes = (d.bo & 8) !== 0, which = d.bi & 3;
              const opn = [yes ? '<' : '>=', yes ? '>' : '<=', yes ? '==' : '!='][which];
              const not = [yes ? '>=' : '<', yes ? '<=' : '>', yes ? '!=' : '=='][which];
              // Part of a field shifted, tested for equality with 0, is
              // printed unshifted (fieldName's `unshift`).
              const a = cond && which === 2 && cond.b.k === 0 && cond.a.unshift ? cond.a.unshift : cond && cond.a;
              const test = op => cond ? (cond.old ? 'earlier: ' : '') + wrap(a, 3, cond.hexy, true) + ' ' + op + ' ' + wrap(cond.b, 3, cond.hexy, true) : 'an earlier test ' + op + ' 0';
              return { taken: test(opn), fall: test(not) };
            };
            // r3 is what a routine hands back; named where the routine ever sets it.
            const back = 'return' + (reg[3].k !== undefined || reg[3].s !== 'r3' ? ' ' + str(reg[3]) : B.some(x => x.def >>> 3 & 1) ? ' r3' : '');
            // A return that tests a condition goes on to the next line when
            // the test fails, so for the blocks it is a plain statement.
            if (d.indirect === 'lr' && iffy) addLine((d.bi & 3) === 3 || (d.bo & 0x4) === 0 ? '\u0003' + o.text : 'if (' + testOf().taken + ') ' + back);
            else if (d.indirect === 'lr') addLine(back, undefined, { kind: 'end' });
            else if (d.indirect && tables.has(i)) {
              // The number a switch goes by is what the `cmplwi` before it
              // held to the table's length, while nothing has changed it.
              const t = tables.get(i), cases = new Map();
              t.forEach((a, k) => { if (!cases.has(a)) cases.set(a, []); cases.get(a).push(k); });
              const by = cond && !cond.old && cond.b.k !== undefined && cond.b.k + 1 === t.length ? str(cond.a) : null;
              addLine(by !== null ? 'switch (' + by + ')' : 'goto one of several places by a number', undefined, { kind: 'switch', targets: [...cases.keys()], cases });
            } else if (d.indirect) addLine('goto one of several places by a number', undefined, { kind: 'end' });
            else if (d.conditional && /^b[tf]/.test(mn) && (d.bi & 3) !== 3) {
              const t = testOf();
              addLine('if (' + t.taken + ') goto \u0001', o.to, { kind: 'cond', taken: t.taken, fall: t.fall });
            } else if (mn === 'bdnz') addLine('if (--ctr != 0) goto \u0001', o.to, { kind: 'cond', taken: '--ctr != 0', fall: '--ctr == 0' });
            else if (d.conditional) addLine('\u0003' + o.text + ' \u0001', o.to, { kind: 'cond', taken: o.text, fall: '!(' + o.text + ')' });
            else addLine('goto \u0001', o.to, inside(o.to) ? { kind: 'jump' } : { kind: 'end' });
          }
        } else if (mn === 'mtctr' && !(ops[blk.e].d && ops[blk.e].d.indirect === 'ctr')) {
          // The count a `bdnz` loop goes round, which the loop's test reads.
          addLine('ctr = ' + str(reg[d.rd]));
        } else if (mn === 'nop' || mn === 'stmw' || mn === 'lmw' || mn === 'mflr' || mn === 'mtlr' || mn === 'mtctr') {
          if (mn === 'mflr') reg[d.rd] = atom('return address');
        } else if (m && d.ra === 1 && !m[5]) {
          // The stack: a slot is a local, and the frame's bookkeeping is left out.
          if (mn === 'stwu') { /* the frame */ }
          // Below the stack pointer the routine saves the registers it must hand back, and restores them.
          else if (d.d < 0) { if (m[1] === 'l') reg[d.rt] = atom(name(d.rt)); }
          else if (m[1] === 'l') { dest = d.rt; res = atom('local' + d.d); }
          else if (reg[d.rt].s !== 'return address') { const v = str(reg[d.rt]); before(mentions('local' + d.d)); stale(mentions('local' + d.d)); addLine('local' + d.d + ' = ' + v, undefined, undefined, reg[d.rt]); }
        } else if (m && d.ra === 2 && !m[5] && m[1] === 'l') { dest = d.rt; res = tableStart('toc:' + d.d) || atom(tocName(d.d)); }
        else if (m && m[2] !== 'mw') {
          const base = m[5] ? bin('+', reg[d.ra], reg[d.rb], 3) : reg[d.ra];
          let cell = memOf(m[2], base, m[5] ? 0 : d.d);
          const rf = recCell(d, m);
          if (rf) cell = Object.assign(cell, { bits: rf.bits, fld: rf.fld }, rf.plain ? { s: rf.plain } : {}, fieldName(rf.fld, rf.bits) || {});
          if (m[1] === 'l') { dest = d.rt; res = (!m[5] && d.d === 0 && m[2] === 'w' && /^toc:/.test(st[d.ra] || '') && tableStart('glob:' + st[d.ra].slice(4))) || cell; }
          else { const v = str(reg[d.rt]); before(e => e.mem); stale(e => e.mem); addLine(cell.s + ' = ' + v, undefined, undefined, reg[d.rt]); }
        } else if (mn === 'li') { dest = d.rd; res = konst(d.imm); }
        else if (mn === 'lis') { dest = d.rd; res = konst(d.imm << 16); }
        else if (/^addi[cs]?$/.test(bare) && d.ra === 1) { if (d.rd !== 1) { dest = d.rd; res = atom('&local' + d.imm); } }
        else if (bare === 'addi' && d.ra === 2) { dest = d.rd; res = atom('&data_' + (img.toc.offset + d.imm).toString(16).toUpperCase()); }
        else if (bare === 'addi' || bare === 'addic' || bare === 'addis') {
          const imm = bare === 'addis' ? d.imm << 16 : d.imm;
          dest = d.rd; res = add(reg[d.ra], imm);
          // A scaled index or a record moved by a constant is still one.
          const x = reg[d.ra];
          if (x.unscaled) res = Object.assign({}, res, { unscaled: x.unscaled });
          const ro = x.recOf, stride = !ro && exeRecTable(st[d.ra]) && strideOf ? strideOf(st[d.ra]) : 0;
          if (ro) res = recExpr(recRef(ro.kind, ro.stride, ro.idx, ro.num, ro.k, ro.off + imm));
          // A table's address plus a constant: a record of a constant index.
          else if (stride) res = recExpr(recRef(RF.tables.get(st[d.ra] + '|' + stride).kind, stride, null, 0, 0, imm));
        }
        else if (bare === 'mulli') { dest = d.rd; res = Object.assign(bin('*', reg[d.ra], konst(d.imm), 2), { unscaled: reg[d.ra] }); }
        else if (bare === 'subfic') { dest = d.rd; res = bin('-', konst(d.imm), reg[d.ra], 3); }
        else if (bare === 'andi') { dest = d.ra; res = and(reg[d.rs], d.imm); }
        else if (bare === 'andis') { dest = d.ra; res = and(reg[d.rs], d.imm << 16); }
        else if (mn === 'ori' || mn === 'oris' || mn === 'xori' || mn === 'xoris') {
          const v = /s$/.test(mn) ? d.imm << 16 : d.imm, x = reg[d.rs];
          dest = d.ra; res = x.k !== undefined ? konst(mn[0] === 'o' ? x.k | v : x.k ^ v) : bin(mn[0] === 'o' ? '|' : '^', x, konst(v), 6, true);
        } else if (/^(rlwinm|clrlwi|slwi|srwi|rotlwi)$/.test(bare)) {
          const mask = ((0xFFFFFFFF >>> d.mb) & (0xFFFFFFFF << (31 - d.me))) >>> 0, x = reg[d.rs];
          let e = x;
          if (d.sh) e = d.me <= 31 - d.sh ? bin('<<', x, konst(d.sh), 4) : d.mb >= 32 - d.sh ? bin('>>', x, konst(32 - d.sh), 4) : { s: 'rotl(' + str(x) + ', ' + d.sh + ')', p: 0, mem: x.mem };
          const whole = d.sh ? (d.me <= 31 - d.sh ? (0xFFFFFFFF << d.sh) >>> 0 : d.mb >= 32 - d.sh ? 0xFFFFFFFF >>> (32 - d.sh) : 0xFFFFFFFF) : 0xFFFFFFFF;
          dest = d.ra; res = (mask & whole) >>> 0 === whole ? e : and(e, mask);
          // An index scaled to a table's stride (exeRecStep), and the index
          // before the shift: the bits under the mask, shifted back down.
          if (d.sh > 0 && d.sh < 16 && d.me === 31 - d.sh) res = Object.assign({}, res, { unscaled: mask >>> d.sh === 0xFFFFFFFF >>> d.sh ? x : and(x, mask >>> d.sh) });
        } else if (bare === 'rlwimi') {
          const mask = ((0xFFFFFFFF >>> d.mb) & (0xFFFFFFFF << (31 - d.me))) >>> 0, x = reg[d.rs];
          const e = d.sh ? bin('<<', x, konst(d.sh), 4) : x;
          dest = d.ra; res = bin('|', and(reg[d.ra], ~mask), and(e, mask), 6, true);
        } else if (bare === 'srawi') { dest = d.ra; res = d.sh ? bin('/', reg[d.rs], konst(Math.pow(2, d.sh)), 2) : reg[d.rs]; }
        else if (bare === 'mr' || bare === 'extsh' || bare === 'extsb' || bare === 'addze') { dest = bare === 'addze' ? d.rd : d.ra; res = reg[bare === 'addze' ? d.ra : d.rs]; }
        else if (bare === 'not') { dest = d.ra; res = { s: '~' + wrap(reg[d.rs], 1), p: 1, mem: reg[d.rs].mem }; }
        else if (bare === 'neg') { dest = d.rd; res = { s: '-' + wrap(reg[d.ra], 1), p: 1, mem: reg[d.ra].mem }; }
        else if (bare === 'add') {
          dest = d.rd; res = bin('+', reg[d.ra], reg[d.rb], 3);
          // A table's address and an index scaled by its stride: a record,
          // `&Prop[i]`, where the table is one GetField reads.
          const rec = recIndex(d.ra, d.rb);
          if (rec && rec.ro) res = recExpr(rec.ro);
        }
        else if (bare === 'sub') { dest = d.rd; res = bin('-', reg[d.rb], reg[d.ra], 3); }
        else if (bare === 'subf' || bare === 'subc') { dest = d.rd; res = bin('-', reg[d.rb], reg[d.ra], 3); }
        else if (bare === 'mullw') { dest = d.rd; res = bin('*', reg[d.ra], reg[d.rb], 2); }
        else if (bare === 'divw' || bare === 'divwu') { dest = d.rd; res = bin('/', reg[d.ra], reg[d.rb], 2); }
        else if (bare === 'and') { dest = d.ra; res = bin('&', reg[d.rs], reg[d.rb], 5, true); }
        else if (bare === 'or') { dest = d.ra; res = bin('|', reg[d.rs], reg[d.rb], 6, true); }
        else if (bare === 'xor') { dest = d.ra; res = bin('^', reg[d.rs], reg[d.rb], 6, true); }
        else if (bare === 'andc') { dest = d.ra; res = bin('&', reg[d.rs], { s: '~' + wrap(reg[d.rb], 1), p: 1 }, 5, true); }
        else if (bare === 'slw') { dest = d.ra; res = bin('<<', reg[d.rs], reg[d.rb], 4); }
        else if (bare === 'srw' || bare === 'sraw') { dest = d.ra; res = bin('>>', reg[d.rs], reg[d.rb], 4); }
        else if (mn === 'cmpwi' || mn === 'cmplwi') cond = { a: reg[d.ra], b: konst(d.imm) };
        else if (mn === 'cmpw' || mn === 'cmplw') cond = { a: reg[d.ra], b: reg[d.rb] };
        else raw();
        if (dest >= 0 && res && RF) {
          // A value out of a record, shifted or masked, has its bits
          // followed, and where they are a field's it is printed by the
          // field's name.
          const bits = exeBitsStep(d, reg);
          if (bits) {
            const f = bare === 'or' ? reg[d.rs].fld || reg[d.rb].fld : reg[d.rs].fld;
            res = Object.assign({}, res, { bits, fld: f });
            const nm = f ? fieldName(f, bits, true) : null;
            if (nm) res = { s: nm.s, p: nm.p, mem: true, bits, fld: f, unshift: nm.unshift };
          }
        }
        if (dest >= 0 && res) {
          set(dest, res);
          // The test is of what is now in the register: its name, if the value was written out.
          if (dot) cond = { a: reg[dest].k === undefined && reg[dest].s === name(dest) ? reg[dest] : res, b: konst(0), hexy: /&|\|/.test(res.s || '') };
        }
      }
      exeRecStep(st, d, strideOf);
      // A block that runs on into the next writes out every register read after it.
      if (i === blk.e && !(d && d.branch && !d.lk)) for (let q = 0; q < 32; q++) if (vol(q) && (blk.out >>> q & 1)) settle(q);
    }
    const last = ops[blk.e].d;
    if (exeConditional(last) && !last.lk) carry = cond;
  }
  return lines;
}
/* The pseudo-code with its jumps made into blocks: `if (...) { }`, `else`,
   `while`, `do ... while`, `loop`, with `break`, `continue` and a jump to
   the routine's return printed as the return.

   The recovery is the scripts' (dvmRecoverStructure and dvmLoopExits in
   js/delv-fold.js), which builds a block only where its region has one way
   in and one way out and leaves every other jump as a goto.
   utilities/structure_check.mjs compares it with the scripts' jumps. It
   reads a list of statements in order, each a test that jumps, a jump, a
   switch, an end or a plain statement, with the places each can go to;
   here each line of exePseudo is one, by the `flow` exePseudo gives it, and
   a place is the index of the first line written at or after a jump's
   target address. This view leaves out the labels exePseudo writes at each
   target and prints a label only where a goto to it is left.

   Every test here jumps when its comparison is true (`if (r3 == 0) goto
   L`), so a block that runs when the jump is not taken prints the opposite
   test, which exePseudo writes beside it (`fall`) by swapping the operator
   rather than wrapping the test in `!( )`. Two tests in a row that jump to
   one place merge into one condition: `if (A) goto L; if (B) goto L` jumps
   when A || B, and the code after it runs when not-A && not-B.

   CodeWarrior compiles a `while` as a jump to the test at the loop's end,
   which jumps back to the loop's first line: `goto T; L: body; T: if (C)
   goto L`. The recovery reads that as a goto and a `do ... while (C)`,
   which is the same program, and the view prints it as `while (C)` when
   nothing else jumps to the test.

   utilities/pseudo_check.mjs compares the result with exePseudo's jumps
   over the whole program: the same edges, every block a region, every
   statement once, each printed test's operator against its branch's, each
   break and continue against its loop, and a label for every goto. */
/* A routine's blocks with its trees of compares as switches, and without
   them, and the one with fewer gotos left, the switches on a tie. A small
   tree whose places each go on to one exit reads as nested ifs with no
   goto, where a switch leaves a goto at the end of each case
   (TMapWindow::MoveKeyTarget, six of them), so a switch is printed only
   where it leaves no more than the tests do. */
function exePseudoBlocks(r) {
  if (r.pseudoBlocks) return r.pseudoBlocks;
  const a = exePseudoBlocksAs(r, true);
  if (!a.trees.length) return (r.pseudoBlocks = a);
  const b = exePseudoBlocksAs(r, false);
  return (r.pseudoBlocks = a.gotos <= b.gotos ? a : b);
}
function exePseudoBlocksAs(r, useTrees) {
  const ps = exePseudo(r), L = ps.lines;
  const keep = [];
  for (let k = 0; k < L.length; k++) if (L[k].text !== '\u0002') keep.push(k);
  // The statement an address starts: the first kept line at or after it.
  const firstAt = a => {
    let lo = 0, hi = keep.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (L[keep[m]].at < a) lo = m + 1; else hi = m; }
    return lo < keep.length ? keep[lo] : null;
  };
  // A label is the lowest address that lands on its line.
  const labelOf = new Map(), caseOf = new Map();
  const place = a => { const k = firstAt(a); if (k !== null && (!labelOf.has(k) || a < labelOf.get(k))) labelOf.set(k, a); return k; };
  const stmts = keep.map(k => {
    const l = L[k], f = l.flow, node = { mn: 'ppc', k };
    if (!f) return { abs: k, node, kind: 'plain', targets: [], negated: false };
    if (f.kind === 'end') return { abs: k, node, kind: 'end', targets: [], negated: false };
    if (f.kind === 'switch') {
      const targets = [];
      for (const a of f.targets) {
        const t = place(a);
        if (t === null) continue;
        if (!targets.includes(t)) targets.push(t);
        caseOf.set(t, (caseOf.get(t) || []).concat(f.cases.get(a)));
      }
      return { abs: k, node, kind: 'switch', targets, negated: false };
    }
    const t = place(l.to);
    if (t === null) return { abs: k, node, kind: f.kind === 'jump' ? 'end' : 'plain', targets: [], negated: false };
    return { abs: k, node, kind: f.kind, targets: [t], negated: f.kind === 'cond' };
  });
  /* A jump to the statement that comes next anyway does nothing, and is a
     plain statement with no line. Once register lines that nothing reads
     left the pseudo-code (11 November 2026), TDelverApp::DoSaveAs had
     `if (c) { goto +0x78 }` with +0x78 the next line, where the lines
     between had hidden that the jump goes nowhere. */
  stmts.forEach((s, i) => {
    if (s.kind === 'jump' && i + 1 < stmts.length && s.targets[0] === stmts[i + 1].abs)
      stmts[i] = { abs: s.abs, node: s.node, kind: 'plain', targets: [], negated: false, noop: true };
  });
  /* A switch compiled as a tree of compares (the handoff's
     `grimoire/listing-hl26zm`, 10 November 2026). CodeWarrior writes a
     sparse switch as a binary search: `cmpwi r0,189; beq case; bge upper`
     and so on down to each case, so KeyRoutine's key was 50 lines of tests
     and gotos before any case, and such trees were most of the gotos left.
     A tree here is a test of one register against a constant, and every
     test and plain jump it leads to that does the same, entered from
     nothing outside the tree. The register is the one in the compare
     (cmpwi or cmplwi, read back from the branch, with no jump landing
     between the two), or the register copied into it just before the tree
     ("r0 = r27"). The tree is run for every value at which a test can
     change its answer, which gives each place it ends at a set of runs of
     values. The place with the most values is `default`, every other place
     must have at most 4,096, and a tree with fewer than three tests or
     three places stays as it is. The tree becomes one switch statement
     whose targets are its places, each labeled with its values (caseOf),
     and its other tests and jumps leave the list. `trees` has each one for
     utilities/pseudo_blocks_check.mjs, which runs the instructions
     themselves for the same values. */
  const trees = [];
  let flat = stmts;
  if (useTrees) {
    const ops = exeOpsOf(r), opAt = new Map(ops.map((o, i) => [o.at, i]));
    const landed = new Set();
    for (const o of ops) if (o.d && o.d.branch && !o.d.lk && o.to !== null && o.to !== undefined) landed.add(o.to);
    const cmpOf = k => {
      const i = opAt.get(L[k].at), o = i === undefined ? null : ops[i];
      if (!o || !o.d || !/^b[tf]$/.test(o.d.mn)) return null;
      const crf = o.d.bi >> 2;
      for (let j = i - 1; j >= 0 && j >= i - 8; j--) {
        if (landed.has(ops[j + 1].at)) return null;
        const p = ops[j].d;
        if (!p) return null;
        if ((p.mn === 'cmpwi' || p.mn === 'cmplwi') && p.crf === crf)
          return { reg: p.ra, k: p.imm, unsigned: p.mn === 'cmplwi', bit: o.d.bi & 3, yes: o.d.mn === 'bt' };
        if (/^cmp/.test(p.mn) || (crf === 0 && /\.$/.test(p.mn)) || /^m[tc]crf|^mcrf|^cr/.test(p.mn)) return null;
        if (p.branch && !p.conditional) return null;
      }
      return null;
    };
    const holds = (t, v) => {
      const a = t.unsigned ? v >>> 0 : v | 0, b = t.unsigned ? t.k >>> 0 : t.k | 0;
      return [a < b, a > b, a === b][t.bit] === t.yes;
    };
    const idx = new Map(stmts.map((s, i) => [s.abs, i]));
    const falls = s => s.kind === 'plain' || s.kind === 'cond';
    const outs = j => { const s = stmts[j]; return s.targets.map(t => idx.get(t)).concat(falls(s) && j + 1 < stmts.length ? [j + 1] : []).filter(x => x !== undefined); };
    const preds = new Map();
    stmts.forEach((s, j) => { for (const o of outs(j)) (preds.get(o) || preds.set(o, []).get(o)).push(j); });
    /* A test or jump past the first is in a tree only when its straight run
       of instructions is compares and the branch alone: a run that loads
       the value again (`lha 0, 286(31)` before each test of
       T7LabelWidget::DrawRoutine) is an if-else chain, which reads as
       nested ifs already, and the value it tests is not shown to be the
       first one. */
    const bare = j => {
      let i = opAt.get(L[stmts[j].node.k].at);
      if (i === undefined) return false;
      for (i--; i >= 0 && ops[i].d && (ops[i].d.mn === 'cmpwi' || ops[i].d.mn === 'cmplwi') && !landed.has(ops[i + 1].at); i--);
      return i < 0 || landed.has(ops[i + 1].at) || !!(ops[i].d && ops[i].d.branch && !ops[i].d.lk);
    };
    const test = new Map(), used = new Set(), drop = new Set(), replace = new Map();
    const testAt = j => { if (!test.has(j)) test.set(j, stmts[j].kind === 'cond' ? cmpOf(stmts[j].node.k) : null); return test.get(j); };
    for (let i = 0; i < stmts.length; i++) {
      if (used.has(i) || stmts[i].kind !== 'cond' || !testAt(i)) continue;
      const regs = new Set([testAt(i).reg]);
      const copy = i > 0 && stmts[i - 1].kind === 'plain' ? /^r(\d+) = r(\d+)$/.exec(L[stmts[i - 1].node.k].text || '') : null;
      if (copy && (regs.has(+copy[1]) || regs.has(+copy[2]))) { regs.add(+copy[1]); regs.add(+copy[2]); }
      const isNode = j => !used.has(j) && bare(j) && (stmts[j].kind === 'jump' || (stmts[j].kind === 'cond' && testAt(j) && regs.has(testAt(j).reg)));
      let M = null;
      for (let pass = 0; pass < 32; pass++) {
        const reach = new Set([i]), q = [i];
        while (q.length) for (const o of outs(q.pop())) if (!reach.has(o) && isNode(o) && (!M || M.has(o))) { reach.add(o); q.push(o); }
        const next = new Set([...reach].filter(j => j === i || (preds.get(j) || []).every(p => reach.has(p))));
        const same = M && next.size === M.size;
        M = next;
        if (same) break;
      }
      const conds = [...M].filter(j => stmts[j].kind === 'cond');
      if (conds.length < 3) continue;
      const pts = new Set([0, 0x80000000]);
      for (const j of conds) { const t = testAt(j); pts.add(t.k >>> 0); pts.add((t.k + 1) >>> 0); }
      const P = [...pts].sort((a, b) => a - b);
      const endOf = v => {
        let j = i;
        for (let g = 0; M.has(j) && g < 512; g++) {
          const s = stmts[j];
          j = s.kind === 'jump' || holds(testAt(j), v) ? idx.get(s.targets[0]) : j + 1;
          if (j === undefined) return null;
        }
        return M.has(j) ? null : j;
      };
      const runs = [];
      let ok = true;
      for (let q = 0; q < P.length; q++) {
        const lo = P[q], hi = q + 1 < P.length ? P[q + 1] - 1 : 0xFFFFFFFF, end = endOf(lo);
        if (end === null) { ok = false; break; }
        if (runs.length && runs[runs.length - 1].end === end) runs[runs.length - 1].hi = hi; else runs.push({ lo, hi, end });
      }
      if (!ok) continue;
      const size = new Map();
      for (const u of runs) size.set(u.end, (size.get(u.end) || 0) + (u.hi - u.lo + 1));
      // A place at or before the tree is a jump back into a loop. The
      // recovery reads one from a test (`continue`) and not from a switch.
      if (size.size < 3 || [...size.keys()].some(e => e <= i)) continue;
      const def = [...size.entries()].sort((a, b) => b[1] - a[1])[0][0];
      if ([...size.entries()].some(([e, n]) => e !== def && n > 4096)) continue;
      const unsigned = conds.every(j => testAt(j).unsigned);
      const val = v => unsigned ? v >>> 0 : v | 0;
      const placed = runs.filter(u => u.end !== def).sort((a, b) => val(a.lo) - val(b.lo));
      const order = [...new Set(placed.map(u => u.end))].concat([def]);
      for (const e of order) {
        const labels = e === def ? ['default'] : placed.filter(u => u.end === e).map(u => u.lo === u.hi ? String(val(u.lo)) : val(u.lo) + ' to ' + val(u.hi));
        const k = stmts[e].abs;
        caseOf.set(k, (caseOf.get(k) || []).concat(labels));
      }
      const m = /^(.*) (?:==|!=|>=|<=|<|>) \S+$/.exec(L[stmts[i].node.k].flow.taken.replace(/^earlier: /, ''));
      replace.set(i, { abs: stmts[i].abs, node: { mn: 'ppc', k: stmts[i].node.k, text: 'switch (' + (m ? m[1] : 'r' + testAt(i).reg) + ')' },
                       kind: 'switch', targets: order.map(e => stmts[e].abs), negated: false, exhaustive: true });
      for (const j of M) { used.add(j); if (j !== i) drop.add(j); }
      trees.push({ root: stmts[i].abs, members: [...M].map(j => stmts[j].abs), unsigned,
                   runs: runs.map(u => ({ lo: u.lo, hi: u.hi, end: stmts[u.end].abs })), def: stmts[def].abs });
    }
    if (trees.length) flat = stmts.map((s, i) => replace.get(i) || s).filter((s, i) => !drop.has(i));
  }
  /* Tests in a row, each jumping to one of two places, are one condition.
     C's `if (A || B) { X } Y` compiles to `if (A) goto X; if (!B) goto Y;
     X: ...`: the first test jumps past the second to where the block
     starts, which the scripts' merge (tests in a row with one target) does
     not take, and the block was left with a goto into its first line.
     A run of tests c1 ... cn merges where each jumps either to E, where the
     last one jumps, or to T, the statement after the last, and nothing
     else jumps to the second test or a later one. Read from the end, the
     run reaches E when cn is true. A test before that jumping to E reaches
     E when it is true or the rest is, and a test jumping to T reaches E
     when it is false and the rest is true (exeJoinTests).
     The join runs again over its result until nothing more joins, which
     is how `(A || B || C) && D` comes out: the first round joins A, B and
     C, whose jumps past D to its block go to that run's T, and the second
     joins the run with D. A joined test's parts are kept (`joined`), each
     a line or a joined test of an earlier round, for the texts and for
     utilities/pseudo_blocks_check.mjs. */
  const joined = new Map();
  const testText = (s, toward) => s.joined ? (toward ? s.node.taken : s.node.fall) : (toward ? L[s.node.k].flow.taken : L[s.node.k].flow.fall);
  let list = flat;
  for (let round = 0; round < 8; round++) {
    const jumpedTo = new Set();
    for (const s of list) for (const t of s.targets) jumpedTo.add(t);
    const next = [];
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      let last = -1;
      if (s.kind === 'cond')
        for (let j = i + 1; j + 1 < list.length && list[j].kind === 'cond' && !jumpedTo.has(list[j].abs); j++) {
          const T = list[j + 1].abs, E = list[j].targets[0];
          if (E !== T && list.slice(i, j + 1).every(p => p.targets[0] === T || p.targets[0] === E)) last = j;
        }
      if (last < 0) { next.push(s); continue; }
      const parts = list.slice(i, last + 1), T = list[last + 1].abs, E = list[last].targets[0];
      const toE = parts.map(p => p.targets[0] === E);
      const taken = parts.map(p => testText(p, true)), fall = parts.map(p => testText(p, false));
      const node = { mn: 'ppc', k: s.node.k, taken: exeJoinTests(toE, taken, fall, true), fall: exeJoinTests(toE, taken, fall, false) };
      next.push({ abs: s.abs, node, kind: 'cond', targets: [E], negated: true, joined: parts, toE, follow: T });
      for (const p of parts.slice(1)) joined.set(p.abs, s.abs);
      i = last;
    }
    if (next.length === list.length) break;
    list = next;
  }
  const rec = dvmRecoverStructure(list);
  const loops = dvmLoopExits(rec.tree, {});
  const labels = dvmRemainingLabels(rec.tree, loops.exits);
  // The rotated `while`: a jump to a do-while's test from just before it,
  // where nothing jumps to the test but that jump and the loop's `continue`s.
  const sources = new Map(), nextOf = new Map();
  list.forEach((s, i) => { if (i + 1 < list.length) nextOf.set(s.abs, list[i + 1].abs); });
  for (const s of list) for (const t of s.targets) sources.set(t, (sources.get(t) || 0) + 1);
  const rotated = new Set();
  const findRotated = list => {
    for (let i = 0; i + 1 < list.length; i++) {
      const a = list[i], b = list[i + 1];
      if (a.kind === 'stmt' && a.stmt.kind === 'jump' && a.goes === undefined && !loops.exits.has(a.stmt) &&
          b.kind === 'dowhile' && !b.cond.parts && a.stmt.targets[0] === b.cond.abs && b.body.length &&
          dvmFirstAbs(b.body[0]) === nextOf.get(a.stmt.abs)) {
        const continues = [...loops.exits.keys()].filter(s => s.targets[0] === b.cond.abs).length;
        if (sources.get(b.cond.abs) === 1 + continues) { rotated.add(a); rotated.add(b); }
      }
    }
    for (const n of list) for (const q of ['then', 'els', 'body']) if (n[q]) findRotated(n[q]);
  };
  findRotated(rec.tree);
  const out = [];
  // A test's text, as written (`taken`) or its opposite (`fall`). Tests the
  // scripts' merge joins (`parts`, one target) jump when any part is true.
  const textOf = (s, k) => {
    if (s.parts) { const op = k === 'fall' ? '&&' : '||'; return s.parts.map(p => exeJoinPart(textOf(p, k), op)).join(' ' + op + ' '); }
    return testText(s, k === 'taken');
  };
  const line = (at, depth, text, to) => out.push({ at, depth, text, to: to === undefined ? null : to });
  const atOf = s => L[s.abs].at;
  const goTo = k => labelOf.has(k) ? labelOf.get(k) : L[k].at;
  const label = (k, depth) => {
    if (k === null || !labels.has(k)) return;
    let cases = caseOf.get(k) || null;
    if (cases && exitDefaults.has(k)) { const at = cases.indexOf('default'); cases = cases.filter((c, n) => n !== at); if (!cases.length) cases = null; }
    if (!cases && quietLabels.has(k)) return;
    out.push({ at: goTo(k), depth, text: '\u0002', to: null, cases });
  };
  /* A switch printed as a block (the handoff's `grimoire/listing-hl26zm`,
     11 November 2026). A switch's cases each ended in a goto to the place
     after the last case, which a reader of C writes as `break`, and those
     were most of the gotos left. The blocks are the recovery's, and a
     switch has none there, so the block is drawn here: the statements after
     the switch, up to the first one some case jumps to past the last place
     (the exit), print inside `switch (x) { ... }`, and a jump to the exit
     from inside, but from no loop inside, prints as `break`. A switch is
     drawn so only where every place is inside the block, nothing outside
     jumps into it but the switch to its places (dvmStructureEdges), and no
     `break` of a loop around the switch is inside it, since inside the
     braces that `break` would read as leaving the switch.
     utilities/pseudo_blocks_check.mjs reads the braces back and sends a
     `break` to the statement after its innermost loop or switch. */
  const flowEdges = dvmStructureEdges(rec.tree, null);
  const absIn = nodes => {
    const out = new Set();
    (function walk(list) { for (const n of list) { if (n.kind === 'stmt') out.add(n.stmt.abs); if (n.cond) out.add(n.cond.abs); for (const q of ['then', 'els', 'body']) if (n[q]) walk(n[q]); } })(nodes);
    return out;
  };
  const SWITCH_BREAK = 'break';
  let switchBreaks = 0, switchBlocks = 0;
  const exitDefaults = new Set(), quietLabels = new Set();
  const switchBlock = (list, i) => {
    const s = list[i].stmt;
    if (!s || s.kind !== 'switch' || !/^switch \(/.test(s.node.text || L[s.node.k].text)) return null;
    const places = new Set(s.targets);
    /* A switch with no default case compiles with its default going to
       the code after the switch, where the cases' breaks go too
       (ObjIDToSegmentID). So the place labeled `default` alone may be the
       exit, and every other place is inside. */
    const onlyDefault = p => { const c = caseOf.get(p); return !!c && c.length === 1 && c[0] === 'default'; };
    let last = -1;
    for (let j = i + 1; j < list.length; j++) { const ins = absIn([list[j]]); for (const p of places) if (ins.has(p) && !onlyDefault(p)) last = j; }
    if (last < 0) return null;
    const inside = absIn(list.slice(i + 1, last + 1));
    for (const p of places) if (!inside.has(p) && !onlyDefault(p)) return null;
    for (let j = last + 1; j < list.length; j++) {
      const E = dvmFirstAbs(list[j]), R = absIn(list.slice(i + 1, j));
      if ([...places].some(p => !R.has(p) && p !== E)) continue;
      let hits = 0, loopBreak = false;
      (function walk(nodes, inLoop) {
        for (const n of nodes) {
          if (n.kind === 'stmt') {
            const w = loops.exits.get(n.stmt), where = n.stmt.targets.length === 1 ? (n.goes !== undefined ? n.goes : n.stmt.targets[0]) : null;
            if (w === 'break' && !inLoop) loopBreak = true;
            if (!w && !inLoop && where === E && (n.stmt.kind === 'jump' || n.stmt.kind === 'cond')) hits++;
          }
          const loopy = n.kind === 'while' || n.kind === 'dowhile' || n.kind === 'loop';
          for (const q of ['then', 'els', 'body']) if (n[q]) walk(n[q], inLoop || loopy);
        }
      })(list.slice(i + 1, j), false);
      if (loopBreak) return null;
      if (!hits) continue;
      const first = dvmFirstAbs(list[i + 1]);
      for (const e of flowEdges) {
        const [f, t] = e.split('>').map(Number);
        if (R.has(t) && !R.has(f) && !(f === s.abs && (places.has(t) || t === first))) return null;
      }
      // A goto from outside the block to the exit needs the exit's label.
      let outside = 0;
      (function walk(nodes) {
        for (const n of nodes) {
          if (n.kind === 'stmt' && !R.has(n.stmt.abs) && n.stmt.abs !== s.abs && !loops.exits.get(n.stmt) && (n.stmt.kind === 'jump' || n.stmt.kind === 'cond')) {
            const where = n.stmt.targets.length === 1 ? (n.goes !== undefined ? n.goes : n.stmt.targets[0]) : null;
            if (where === E) outside++;
          }
          for (const q of ['then', 'els', 'body']) if (n[q]) walk(n[q]);
        }
      })(rec.tree);
      return { end: j, exit: E, exitIsDefault: places.has(E), quiet: outside === 0 };
    }
    return null;
  };
  const render = (list, depth, sw = null) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (rotated.has(n) && n.kind === 'stmt') continue;
      if (n.kind !== 'dowhile' && n.kind !== 'loop') label(dvmFirstAbs(n), depth);
      switch (n.kind) {
        case 'stmt': {
          const s = n.stmt;
          const blk = s.kind === 'switch' ? switchBlock(list, i) : null;
          if (blk) {
            line(atOf(s), depth, (s.node.text || L[s.node.k].text) + ' {');
            render(list.slice(i + 1, blk.end), depth + 1, blk.exit);
            line(null, depth, '}');
            // The exit after the braces is where the switch goes on, not a
            // case, so its label drops the word `default` there.
            if (blk.exitIsDefault) exitDefaults.add(blk.exit);
            if (blk.quiet) quietLabels.add(blk.exit);
            switchBlocks++;
            i = blk.end - 1;
            break;
          }
          let word = loops.exits.get(s);
          const where = s.targets.length === 1 ? (n.goes !== undefined ? n.goes : s.targets[0]) : null;
          if (s.noop) break;
          if (!word && sw !== null && where === sw && (s.kind === 'jump' || s.kind === 'cond')) { word = SWITCH_BREAK; switchBreaks++; }
          if (s.kind === 'cond') line(atOf(s), depth, 'if (' + textOf(s, 'taken') + ') ' + (word || 'goto \u0001'), word ? null : goTo(where));
          else if (s.kind === 'jump') line(atOf(s), depth, word || 'goto \u0001', word ? null : goTo(where));
          else { const t = L[s.node.k]; line(atOf(s), depth, s.node.text || t.text, s.node.text ? null : t.to); }
          break;
        }
        case 'if':
          line(atOf(n.cond), depth, 'if (' + textOf(n.cond, 'fall') + ') {');
          render(n.then, depth + 1, sw);
          line(null, depth, '}');
          break;
        case 'ifelse':
          if (!n.then.length) {
            line(atOf(n.cond), depth, 'if (' + textOf(n.cond, 'taken') + ') {');
            render(n.els, depth + 1, sw);
            line(null, depth, '}');
            break;
          }
          line(atOf(n.cond), depth, 'if (' + textOf(n.cond, 'fall') + ') {');
          render(n.then, depth + 1, sw);
          line(null, depth, '} else {');
          render(n.els, depth + 1, sw);
          line(null, depth, '}');
          break;
        case 'while':
          line(atOf(n.cond), depth, 'while (' + textOf(n.cond, 'fall') + ') {');
          render(n.body, depth + 1);
          line(null, depth, '}');
          break;
        case 'dowhile':
          if (rotated.has(n)) {
            line(atOf(n.cond), depth, 'while (' + textOf(n.cond, 'taken') + ') {');
            render(n.body, depth + 1);
            line(null, depth, '}');
            break;
          }
          line(null, depth, 'do {');
          render(n.body, depth + 1);
          // A jump to the test from outside the loop lands here.
          label(n.cond.abs, depth + 1);
          line(atOf(n.cond), depth, '} while (' + textOf(n.cond, 'taken') + ')');
          break;
        case 'loop':
          line(null, depth, 'loop {');
          render(n.body, depth + 1);
          line(null, depth, '}');
          break;
      }
    }
  };
  render(rec.tree, 0);
  // The line an instruction's work ends up on: the first line, by address,
  // written at or after it.
  const ops = exeOpsOf(r);
  const byAt = out.map((l, i) => i).filter(i => out[i].at !== null && out[i].text !== '\u0002').sort((a, b) => out[a].at - out[b].at || a - b);
  const stmtOf = new Int32Array(ops.length).fill(-1);
  let j = 0;
  for (let i = 0; i < ops.length; i++) { while (j < byAt.length - 1 && out[byAt[j]].at < ops[i].at) j++; stmtOf[i] = byAt.length ? byAt[j] : -1; }
  return ({ lines: out, stmtOf, stmts, list, joined, trees, rec, loops, labels, rotated, gotos: rec.gotos - loops.exits.size - rotated.size / 2 - switchBreaks, switchBlocks, switchBreaks });
}
/* A run of tests as one condition (exePseudoBlocks): `toE[i]` is whether
   test i jumps to E, the place the last one jumps to, rather than to T,
   the statement after the run. With `toward` true it is the condition for
   reaching E, and with it false the condition for reaching T. Built from
   the last test back; a part whose operator differs from the one joining
   it is bracketed. */
function exeJoinTests(toE, taken, fall, toward) {
  const n = toE.length;
  let e = toward ? taken[n - 1] : fall[n - 1];
  for (let i = n - 2; i >= 0; i--) {
    // Toward E: a test jumping to E reaches it when the test is true or
    // the rest is; one jumping to T, when the test is false and the rest
    // is true. Toward T, the opposite of each.
    const op = toE[i] === toward ? '||' : '&&';
    const head = toE[i] ? (toward ? taken[i] : fall[i]) : (toward ? fall[i] : taken[i]);
    e = exeJoinPart(head, op) + ' ' + op + ' ' + exeJoinPart(e, op);
  }
  return e;
}
// A part of a joined condition, bracketed when an `&&` or `||` outside
// every bracket in it differs from `op`. A part from an earlier round of
// the join has them, and a single test has neither.
function exeJoinPart(s, op) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && (s.startsWith(' && ', i) || s.startsWith(' || ', i)) && s.slice(i + 1, i + 3) !== op) return '(' + s + ')';
  }
  return s;
}
// A target as a link: a place in this routine by its offset, another routine by name.
function exeTargetHTML(r, to) {
  const nm = exeTargetName(to);
  const inside = to >= r.offset && to < r.offset + r.length;
  return exeRoutineAt(to) ? codeLink(inside ? '+0x' + (to - r.offset).toString(16).toUpperCase() : nm, 'jumpToExeAt(' + to + ')') : '<span class="refnote">' + svEsc(nm) + '</span>';
}
function exePseudoHTML(r, ringAt, why) {
  const ps = exePseudoBlocks(r), ops = exeOpsOf(r);
  const ringLine = ringAt >= r.offset && ringAt < r.offset + r.length ? ps.stmtOf[(ringAt - r.offset) >> 2] : -1;
  const off = at => (at === null ? '' : '+0x' + (at - r.offset).toString(16).toUpperCase()).padEnd(7) + ' ';
  const lines = ps.lines.map((l, i) => {
    let line;
    const pad = '    '.repeat(l.depth);
    // A switch's case is the label of the line it jumps to, with its numbers.
    if (l.text === '\u0002') line = '<span class="refnote">' + off(l.at).trim() + ':' + (l.cases ? ' ' + [l.cases.filter(c => c !== 'default').join(', ')].filter(x => x).map(x => 'case ' + x).concat(l.cases.includes('default') ? ['default'] : []).join(', ') : '') + '</span>';
    else if (l.text[0] === '\u0003') line = off(l.at) + '  ' + pad + '<span class="refnote">' + svEsc(l.text.slice(1)).replace('\u0001', l.to !== null ? exeTargetHTML(r, l.to) : '') + '</span>';
    else line = off(l.at) + '  ' + pad + svEsc(l.text).replace('\u0001', l.to !== null ? exeTargetHTML(r, l.to) : '');
    if (i !== ringLine) return line;
    const o = ops[(ringAt - r.offset) >> 2];
    const note = (why ? 'The link \u201c' + svEsc(why) + '\u201d leads here. ' : '') + 'The line above has the instruction at +0x' + (ringAt - r.offset).toString(16).toUpperCase() +
      (o && exePlainLines(r)[(ringAt - r.offset) >> 2] ? ': ' + svEsc(exePlainLines(r)[(ringAt - r.offset) >> 2]).replace('\u0001', 'there').replace(/^./, c => c.toLowerCase()) : '.');
    return '<span id="listingHit" class="listingHit">' + line + '</span><span class="listingNote">' + note + '</span>';
  });
  return '<pre class="pane exeListing" style="max-height:none;white-space:pre-wrap">' + lines.join('\n') + '</pre>';
}
function exeListingHTML(r, ringAt, why) {
  if (window.EXE_VIEW === 'pseudo') return exePseudoHTML(r, ringAt, why);
  const img = appImage();
  const hex = (n, w) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w || 6, '0');
  const plainOn = window.EXE_VIEW !== 'code', plain = exePlainLines(r);
  const lines = exeOpsOf(r).map((o, i) => {
    let t = svEsc(o.text), where = '', toc = '';
    const d = o.d;
    if (o.to !== null) {
      const nm = exeTargetName(o.to);
      const inside = o.to >= r.offset && o.to < r.offset + r.length;
      where = exeRoutineAt(o.to) ? codeLink(inside ? '+0x' + (o.to - r.offset).toString(16).toUpperCase() : nm, 'jumpToExeAt(' + o.to + ')') : '<span class="refnote">' + svEsc(nm) + '</span>';
      t += '   ' + where;
    }
    if (d && d.ra === 2 && img.toc) {
      if (d.d !== undefined) {
        const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
        const str = p && p.section !== undefined ? exeStringAt(p) : null;
        toc = '   <span class="refnote">; TOC ' + (d.d >= 0 ? '+' : '') + d.d + (p ? (p.name ? ', ' + svEsc(p.name) : str ? ', “' + svEsc(str.replace(/\n/g, ' ')) + '”' : ', ' + (img.pef.sections[p.section] ? img.pef.sections[p.section].kindName : 'section ' + p.section) + ' ' + hex(p.offset)) : '') + '</span>';
      } else if (d.mn === 'addi') toc = '   <span class="refnote">; data ' + hex(img.toc.offset + d.imm) + '</span>';
      t += toc;
    }
    // In words: the place in the routine, as a jump's link names it, then
    // the sentence, with the jump's link standing in for the place.
    const shownText = plain[i] ? svEsc(plain[i]).replace('\u0001', where) + toc : '<span class="refnote">' + t + '</span>';
    const line = plainOn ? ('+0x' + (o.at - r.offset).toString(16).toUpperCase()).padEnd(7) + ' ' + shownText
      : hex(o.at) + '  ' + o.word.toString(16).toUpperCase().padStart(8, '0') + '  ' + t;
    if (o.at !== ringAt) return line;
    const note = [why ? 'The link “' + svEsc(why) + '” leads here. The program sets it on the line above.' : '',
                  plainOn ? '' : plain[i]].filter(Boolean).join(' ');
    return '<span id="listingHit" class="listingHit">' + line + '</span>' + (note ? '<span class="listingNote">' + note + '</span>' : '');
  });
  return '<pre class="pane exeListing" style="max-height:none' + (plainOn ? ';white-space:pre-wrap' : '') + '">' + lines.join('\n') + '</pre>';
}
/* What a routine and its class do, in plain words: ROUTINE_NOTES
   (js/delv-routinenotes.js), written in the workbench from the
   instructions, read twice and compared, every claim citing the
   instructions that show it. A text is found by the routine's entry, never
   its name, which two overloads share. In a text an address in backticks
   is a link that rings that instruction in the visitor's copy of the program
   (jumpToExeAt), so a claim is checked against the code it cites in one
   click; a routine's name in backticks is a link to it; any other name is
   set as code. *Stars* are a title, and lines starting "- " a list. */
function routineNoteAt(offset) {
  if (typeof ROUTINE_NOTES === 'undefined') return null;
  if (!routineNoteAt.byEntry) {
    routineNoteAt.byEntry = new Map();
    for (const cls of Object.keys(ROUTINE_NOTES)) for (const r of ROUTINE_NOTES[cls].routines) routineNoteAt.byEntry.set(r.entry, r);
  }
  return routineNoteAt.byEntry.get(offset) || null;
}
function routineNoteHTML(text) {
  const inline = line => line.split('`').map((part, k) => {
    if (k % 2 === 0) return svEsc(part).replace(/\*([^*]+)\*/g, '<i>$1</i>');
    if (/^0x[0-9A-F]{6}$/.test(part)) return codeLink(part, 'jumpToExeAt(' + parseInt(part, 16) + ')');
    if (/^[A-Za-z_]\w*::~?\w+$/.test(part) && exeRoutineNamed(part)) return codeLink(part, 'openPefRoutine(\'' + part + '\')');
    return '<code>' + svEsc(part) + '</code>';
  }).join('');
  return text.split(/\n\s*\n/).map(block => {
    const lines = block.split('\n');
    if (!/^- /.test(lines[0])) return '<p class="mechLede">' + inline(lines.join(' ')) + '</p>';
    const items = [];
    for (const l of lines) { if (/^- /.test(l)) items.push(l.slice(2)); else items[items.length - 1] += ' ' + l.trim(); }
    return '<ul class="mechLede">' + items.map(i => '<li>' + inline(i) + '</li>').join('') + '</ul>';
  }).join('');
}
// Where a routine is called from, read from the visitor's program: each
// caller once, a link to the call.
function routineCallersHTML(r) {
  const seen = new Map();
  for (const at of exeCallSitesOf(r.offset)) { const c = exeRoutineAt(at); if (c && !seen.has(c.offset)) seen.set(c.offset, { c, at }); }
  if (!seen.size) return '<p class="mechLede">No call in the program reaches it directly. A routine called through a table of addresses (as a virtual routine is) has no direct call.</p>';
  return '<p class="mechLede">' + [...seen.values()].map(x => codeLink(x.c.name, 'jumpToExeAt(' + x.at + ')')).join(', ') + '.</p>';
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
    const note = routineNoteAt(view.offset);
    box.innerHTML = '<div class="foldAll" style="justify-content:flex-start">' + svLink('All routines', 'pefBackToList()') + ' ' +
      [['pseudo', 'Pseudo-code'], ['words', 'Plain Words'], ['code', 'Code']].map(v => window.EXE_VIEW === v[0]
        ? '<span class="inspDim">' + v[1] + '</span>' : svLink(v[1], 'exeSetView(\'' + v[0] + '\')')).join(' ') + '</div>' +
      '<div class="changesHead">' + codeWord(view.name) + '</div>' +
      '<p class="mechLede">At ' + codeWord(hexv(view.offset)) + ' in the code section, ' + view.length.toLocaleString() + ' bytes, ' + (view.length / 4) + ' instructions' +
      (view.mangled !== view.name ? ' <span class="inspDim">(' + codeWord(view.mangled) + ')</span>' : '') + '. A jump or a call links to where it goes. A slot in the program’s table of addresses shows what the game stores there when it starts.</p>' +
      (note ? '<div class="mechSub">Description</div>' + routineNoteHTML(note.text) : '') +
      '<div class="mechSub">Callers</div>' + routineCallersHTML(view) +
      '<div class="mechSub">Instructions</div>' +
      exeListingHTML(view, window.PEF_VIEW.at, window.PEF_VIEW.why);
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
  let h = '<div class="changesHead">The program’s data fork: a PEF container for ' + svEsc(pef.arch === 'pwpc' ? 'PowerPC' : pef.arch) + '</div>';
  h += '<p class="mechLede">The program’s PowerPC code' + (pef.routines.length ? ' has ' + pef.routines.length.toLocaleString() + ' routines (named from notes the compiler left in it)' : '') +
    (ld ? '. It uses ' + ld.symbols.length + ' system calls from ' + ld.libraries.length + ' libraries' : '') + '.</p>';
  h += '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>no.</th><th>section</th><th class="num">unpacked</th><th class="num">packed</th><th class="num">at</th></tr></thead><tbody>' +
    pef.sections.map(x => '<tr>' + num(x.index) + '<td>' + svEsc(x.kindName) + (x.name ? ' ' + svEsc(x.name) : '') + '</td>' + num(x.unpackedSize.toLocaleString()) + num(x.packedSize.toLocaleString()) + num(hex(x.containerOffset)) + '</tr>').join('') + '</tbody></table></div>';
  if (ld) {
    h += '<div class="mechSub">Imported libraries</div>';
    h += ld.libraries.map(L => '<details class="mechSec"><summary class="mechHead"><h3>' + codeWord(L.name) + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + L.importedSymbolCount + '</b> symbol' + (L.importedSymbolCount === 1 ? '' : 's') + '</span>' + (L.weak ? '<span class="mechStat">weak</span>' : '') + '</span></summary>' +
      '<div class="mechBody"><div class="partsStrip">' + L.symbols.map(y => '<span class="navChip" style="cursor:default">' + codeWord(y.name) + '</span>').join('') + '</div></div></details>').join('');
    if (ld.exports.length) h += '<div class="mechSub">Exports</div><div class="partsStrip">' + ld.exports.map(e => '<span class="navChip" style="cursor:default" title="' + svEsc(e.className) + ', section ' + e.sectionIndex + ' at ' + hex(e.value) + '">' + codeWord(e.name) + '</span>').join('') + '</div>';
  }
  const q = (window.PEF_FILTER || '').trim().toLowerCase();
  h += '<div class="mechSub">Routines</div>' +
    '<input type="search" id="pefFilterBox" value="' + svEsc(window.PEF_FILTER || '') + '" placeholder="a routine or a class" oninput="pefFilter(this.value)" style="width:100%;box-sizing:border-box;margin:4px 0 8px">';
  const rs = pef.routines.filter(r => !q || r.name.toLowerCase().includes(q) || r.mangled.toLowerCase().includes(q));
  const byClass = new Map();
  for (const r of rs) { const c = r.name.includes('::') ? r.name.slice(0, r.name.lastIndexOf('::', r.name.indexOf('(') < 0 ? undefined : r.name.indexOf('('))) : ''; (byClass.get(c) || byClass.set(c, []).get(c)).push(r); }
  const row = r => '<tr>' + num(hex(r.offset)) + num(r.length.toLocaleString()) + '<td title="' + svEsc(r.mangled) + '">' + codeLink(r.name, 'jumpToExeAt(' + r.offset + ')') + '</td></tr>';
  const table = list => '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th class="num">at</th><th class="num">bytes</th><th>routine</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>';
  if (q) h += rs.length ? table(rs) : '<div class="changesNote">No routine matches.</div>';
  else h += [...byClass.entries()].sort((a, b) => (a[0] || '~').localeCompare(b[0] || '~')).map(([c, list]) => {
    const words = typeof ROUTINE_NOTES !== 'undefined' && ROUTINE_NOTES[c];
    const told = list.filter(r => routineNoteAt(r.offset)).length;
    return '<details class="mechSec"><summary class="mechHead"><h3>' + (c ? codeWord(c) : 'functions outside a class') + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + list.length + '</b></span>' +
      (told ? '<span class="mechStat"><b>' + told + '</b> described</span>' : '') + '</span></summary><div class="mechBody">' + (words ? routineNoteHTML(words.opening) : '') + table(list) + '</div></details>';
  }).join('');
  h += '<p class="mechLede" style="margin-top:10px">The page decodes each name from the compiler’s shorthand. It leaves a name it cannot decode as written.</p>';
  box.innerHTML = h;
  grid.appendChild(box);
  out.textContent = pef.routines.length.toLocaleString() + ' routines named in the program' + (q ? ' with ' + rs.length + ' matching “' + window.PEF_FILTER.trim() + '”' : ' by class') + '. ' + (ld ? ld.symbols.length + ' imports from ' + ld.libraries.length + ' libraries.' : '');
}

/* Cythera Preferences, the file the game stores its settings in, on a
   separate tab under Data beside the other files (the maintainer, 27 September
   2026; it was a section of the Tools tab). It is the only thing on the page
   that changes how the GAME behaves rather than how the page reads it: the
   smooth movement Cythera has always had and gates on a preference, the
   gate on the cheat keys, which nothing in the game ever sets, and the rest
   of the record and the file's other keys. The long comment above
   buildCytheraPreferences in js/page-export.js gives the source of each.

   One row per setting, in four groups (the maintainer, 1 October 2026: one
   paragraph above two rows of controls was "messy"). A row's name is the
   game's label, read with the layout as before, and the line under it is
   ours, written from the manual's Preferences page and from what the code
   that reads each bit does (doc/cheats.md, doc/preferences-file.md in the
   workbench). PREF_HELP keys a line by the option, key or choice it
   describes; a setting a patched build adds that is not in PREF_HELP
   still has a row, without the line, in the last group. The tag beside a
   name shows where the game itself changes it, which is the question the
   maintainer could not answer from the labels alone. Element ids are what
   prefsOptionsFromUI and the smokes read, and are unchanged. */
const PREF_HELP = {
  Volume: ['sound', 'Preferences dialog', 'How loud the sound effects are on a scale from 0 (silent) to 8. At −1 the game leaves the Mac’s volume alone.'],
  Music: ['sound', 'Preferences dialog', 'How loud the music is in eighths of full volume. 8 is full and 0 is silent.'],
  Ambient: ['sound', 'Preferences dialog', 'Background sounds such as animals and ocean waves.'],
  movement: ['movement', 'Preferences dialog', 'How the game draws a step from one square to the next: in four stages (Smoother), in two (Faster), or as one jump (Fastest). It takes the same game time in all three. The dialog’s Graphics Quality slider sets the same thing.'],
  frameRate: ['movement', 'Hidden menu', 'The most frames the game draws in a second. These three come from the game’s hidden Preferences menu. The file can hold others (down to no limit at all). A higher limit plays each step’s animation faster. Holding a key still walks at the pace of the Mac’s key repeat.'],
  motionFilters: ['movement', 'Preferences dialog', 'Leaves blowing on the trees and waves rippling across the ocean.'],
  walkAround: ['movement', 'Preferences dialog', 'The hero steps around things in the way rather than stopping at them.'],
  liveDrag: ['windows', 'Preferences dialog', 'The player can drag the game’s windows around the screen.'],
  manualContainers: ['windows', 'Preferences dialog', 'Opening a container lets the player choose where its window goes. When it is off the game places it.'],
  zoomRects: ['windows', 'Preferences dialog', 'Windows open with a zooming outline.'],
  Backdrop: ['windows', 'Not in the game', 'The pattern that fills the screen behind every window. Nothing in the game sets it.'],
  switch256: ['startup', 'Startup prompt', 'The game switches a screen set to more than 256 colors to 256 when it starts. When this is off it runs in the colors the screen already has.'],
  noPrompt: ['startup', 'Startup prompt', 'The game shows no 256-color prompt when it starts. Off, it shows the prompt on a screen set to more than 256 colors, and the answer replaces the switch above.'],
  cheats: ['startup', 'Not in the game', null],
  mouseButtons: ['mouse', 'Not in the game', 'For a mouse with more than one button. The second button clicks with Command held, the third with Control, the fourth with Option, and the fifth with Shift. In this game Control-click opens the contextual menu immediately and Option-click does the double-click action. So the middle button opens the menu. The right-click fix in the Patch Generator puts it on the right button. Infinite Mac passes only one button to the Mac. The setting does nothing there.'],
};
/* The License tab, a stub by the maintainer's word (6 October 2026): what
   the file is, where it goes, a link to the thing that makes one, and a
   picker that reads the name out of one. The link is to Macintosh
   Repository's entry for Decoder Ring, which Andrew Welch, Ambrosia's
   founder, released on 1 October 2023 for free distribution; the workbench's
   doc/infinite-mac-disk.md has that looked up, with the release thread. The
   page fetches nothing from there and makes no licence itself. */
const DECODER_RING_URL = 'https://www.macintoshrepository.org/63637-ambrosia-software-decoderring';
function renderLicenseSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'changesView';
  const about = document.createElement('div');
  about.className = 'changesGroup';
  about.innerHTML = '<div class="changesGroupTitle">' + svEsc(LICENSE_FILE_NAME) + '</div>' +
    '<div class="changesNote" style="margin-left:0">' + svEsc('The game stores its registration in this file in the Preferences folder of the System Folder. Choose one to see the registered name.') + '</div>';
  const inp = document.createElement('input');
  inp.type = 'file'; inp.id = 'licenseFile'; inp.accept = '*/*';
  about.appendChild(inp);
  const shownText = document.createElement('div');
  shownText.className = 'changesNote'; shownText.id = 'licenseSaid';
  shownText.style.marginLeft = '0';
  about.appendChild(shownText);
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    f.arrayBuffer().then(buf => { shownText.innerHTML = licenseReportHTML(new Uint8Array(buf)); }, e => quiet(e, 'reading a license file'));
  };
  box.appendChild(about);
  const make = document.createElement('div');
  make.className = 'changesGroup';
  make.innerHTML = '<div class="changesGroupTitle">' + svEsc('Make a License') + '</div>' +
    '<div class="changesNote" style="margin-left:0"><a href="' + DECODER_RING_URL + '" target="_blank" rel="noopener">Decoder Ring</a>' +
    svEsc(' makes a license for any Ambrosia game. Ambrosia’s founder Andrew Welch released it for free distribution.') + '</div>';
  box.appendChild(make);
  grid.appendChild(box);
  out.textContent = LICENSE_FILE_NAME + ', the file where the game stores its registration.';
}
// What the tab shows for a chosen file. The name is the file's, verbatim.
function licenseReportHTML(bytes) {
  const lic = cytheraLicenseRead(bytes);
  if (!lic) return svEsc('This is not a ' + LICENSE_FILE_NAME + ' file. One is ' + LICENSE_FILE_SIZE + ' bytes and this is ' + bytes.length + '.');
  return svEsc('The name in this file is ') + '<b>' + svEsc(lic.name) + '</b>' + svEsc(lic.hasCode ? ' with a code.' : ' with no code.');
}
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
       the page opens, so they are right for the build in hand --
       so with only the data file open there is no file to write, and the one
       useful sentence is how to get one. It comes first, and is short: the
       sentence it replaced put the action last and read as a
       description of a tool that was not there (the maintainer, 23 September
       2026). */
    const d = document.createElement('div');
    d.className = 'changesGroup';
    d.innerHTML = '<div class="changesGroupTitle">' + svEsc('Cythera’s preferences file') + '</div>' +
      '<div class="changesNote" style="margin-left:0"><b>' + svEsc('Open the game itself (Data › Installer or drop the program on the page) and the settings appear here.') + '</b><br>' +
      svEsc('This writes Cythera’s preferences file with the settings the game stores in the Preferences folder of the System Folder. One of them is the switch that makes its cheat keys work. ' +
            'The page reads every switch in it from the program’s code. The game has to be open for there to be anything to write.') + '</div>';
    box.appendChild(d);
    grid.appendChild(box);
    out.textContent = PREFS_FILE_NAME + ' is the file where the game stores its settings.';
    return;
  }
  const sheet = document.createElement('div');
  sheet.className = 'prefSheet';
  sheet.innerHTML = '<p class="prefLede">' + svEsc('Choose the settings. Then download the file and put it in the Preferences folder of the System Folder in place of the one there. ' +
      'Each setting starts as a new copy of the game has it.') + '</p>' +
    '<p class="prefFrom">' + svEsc(layout.from === 'shipped'
      ? 'The settings are the same in all four releases and nothing needs to be open. Open the game to read them from that copy instead.'
      : 'The page reads the settings from the program open here.') + '</p>';
  /* The two presets (cytheraPrefsPreset): each sets every row, the switches
     by their ids and the choosers by their values. Built with createElement,
     since the smokes' DOM stub does not parse innerHTML into elements. */
  const presets = document.createElement('div');
  presets.className = 'prefPresets';
  for (const [label, name, title] of [['Default', 'default', 'A new copy of the game'],
                                      ['Enable Everything', 'everything', 'Every switch on with Smoother Movement and the fastest frame rate']]) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.textContent = label;
    b.title = title;
    b.onclick = () => applyPrefsPreset(name);
    presets.appendChild(b);
  }
  const presetNote = document.createElement('span');
  presetNote.className = 'prefPresetNote';
  presetNote.textContent = 'Default is a new copy of the game. Enable Everything turns every switch on and picks Smoother Movement and the fastest frame rate.';
  presets.appendChild(presetNote);
  sheet.appendChild(presets);
  const rows = new Map(PREF_GROUPS.map(([g]) => [g, []]));
  // Within a group, rows go in PREF_HELP's order, which is the order of the
  // game's dialog where it has them (Volume, Music, Ambient), not the
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
       to the menu's slowest; the record writer still accepts them as `raw:n`
       (cytheraPrefsRecord), and the row's line mentions that they exist. */
    ch(key, 'pref_' + c.opt, affix(c.options.map(o => o.text)) || 'Setting', c.options.map(o => ({ v: o.text, t: o.text })), cur ? cur.text : null);
  }
  for (const c of layout.controls) sw(c.opt, idOf(c.opt), c.label, !!((layout.base >>> (24 - 8 * c.byte)) & (1 << c.bit)));
  /* The file's other keys. A flag (a range of 0 to 1) is a switch whose
     value prefsOptionsFromUI reads as 1 or 0; the volumes are choosers; the
     backdrop's options are a separate list. Each starts at what a fresh
     install reads, so a row left alone stays out of the file. */
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
  // labelled with the dialog's text, so every pairing can be written. Both
  // start on: the game's recommendation, and no question in the way.
  (layout.startup || []).forEach((x, i) => { if (PREF_STARTUP_IDS[i]) sw(['switch256', 'noPrompt'][i], PREF_STARTUP_IDS[i], x.text, true); });
  sw('cheats', 'prefCheats', 'Allow the cheat keys', true,
     svEsc('Lets the cheat keys work after typing ' + layout.gate.word + '. Nothing in the game turns this on. A copy as released cannot enter cheat mode.'));
  // No label anywhere in the game, so the row's name is one the page supplies.
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
  saveNote.textContent = 'Tested in the game. The game read a file this page wrote and cheat mode came on.';
  saveBox.appendChild(pbtns);
  saveBox.appendChild(saveNote);
  save.appendChild(saveBox);
  for (const [label, kind, title] of [
    ['Disk image for an emulator', 'dsk', 'Mounts as “' + PREFS_VOLUME_NAME + '” with an ' + PREFS_SCRIPT_NAME + ' script beside the file'],
    ['MacBinary for a real Mac', 'bin', 'Decode it and drag the file into System Folder ▸ Preferences']]) {
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
  out.textContent = PREFS_FILE_NAME + ' is the file where the game stores its settings.';
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
  setStatus((name === 'everything' ? 'Enable Everything' : 'Default') + ' preferences: ' + prefsSummary(o) + '.');
}

/* Data › Patches: a patch read and applied, a sprite or a gremlin made into
   one, and one file compared with another, the sections of MECH_TOOL_GROUP,
   which the rules renderer builds because the reading they share lives
   there. The tab shows Magpie's icon for a patch while a patch rather
   than Cythera Data is the file open (openFileIsPatch, magpieIcon). */
function renderPatchesSheet() { renderMechanicsSheet(MECH_TOOL_GROUP.value); }

/* A tool where it lives: its tab, then the element it sits in, which is
   drawn a moment after the tab. The Tools rows and the Patch Generator's
   Fonts and Music section both go this way. */
function toolGoTo(cat, id) {
  if (!showCategory(cat) || !id) return;
  setTimeout(() => { const el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
}

/* ---- Tools -------------------------------------------------------------------
   Every tool on the site by name, each a link to where it is, and the
   sister pages, which are not part of the archive and so have no place
   under the other three tabs. */
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
  const box = document.createElement('div');
  box.className = 'changesView';
  /* One row a tool, its name the link. They were three headed sections,
     then (3 October 2026) a name over a line describing it, with a rule
     between each; the maintainer had the lines and the rules go on
     6 October 2026. The line stays as the button's hover title.

     Since 11 October 2026 the rows are every tool on the site and not only
     the three that live nowhere else (the maintainer: "link all the various
     things that could be considered tools"). A tool is what makes or changes
     a file, or works a figure out from numbers a visitor sets; a row for one
     that lives on another tab opens that tab at it. A row is the tool's name,
     a noun ("Graphics Ditherizer", "Save File Generator"), and the
     section it opens is headed by the same name. That is the maintainer's
     choice of 11 October 2026, after a pass that made every row a verb
     phrase and was put back; it sets aside, for a tool's heading, the rule
     of 1 October that a heading naming an action reads as one. smoke_edits
     checks the Patch Generator row against that page. The
     tools stay where they are: each is drawn beside the reading it shares
     with its tab, which is why Patches and Preferences left this sheet. */
  const at = (cat, id) => () => toolGoTo(cat, id);
  /* Five rows since 19 October 2026, in the maintainer's order: Patch
     Generator, Save File Generator, Preferences File Generator, Graphics
     Ditherizer and ColorCycleCanvas. The Font Replacer, the Seldane Script
     Replacer and the MIDI Importer left for a section of the Patch
     Generator (Fonts and Music), since what they change goes into the
     Patch in Progress. The canvas page's row is its name drawn as that page draws it
     (.ccMark). */
  for (const [label, note, go, icon, mark] of [
    ['Patch Generator', 'One download with bugfixes and the tools that make a patch.', () => showCategory('PATCHES'), BUILD_A_PATCH_ICON],
    ['Save File Generator', 'A saved game made from the scenario open here with the hero set on the form.', at('SAVEGAME', 'saveMaker')],
    ['Preferences File Generator', 'The game’s settings file made with the options chosen here.', at('PREFS')],
    ['Graphics Ditherizer', 'Turns any image into checkerboard art in Cythera’s palette. It opens on the Portraits gallery. A result can go straight into a portrait.',
      () => { showCategory('135'); openDitherTool(); }],
    ['ColorCycleCanvas', 'A paint studio for the palette animation Cythera uses for water and fire.', () => window.open('canvas.html', '_blank', 'noopener'), null, true]]) {
    const d = document.createElement('div');
    d.className = 'toolRow';
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0';
    if (mark) {
      const m = document.createElement('span');
      m.className = 'ccMark';
      m.textContent = label;
      b.appendChild(m);
    } else b.textContent = label;
    // A row for a tab that left the tab bar wears that tab's icon.
    if (icon) {
      const c = navIconCanvas(icon, 18);
      c.style.display = 'inline-block'; c.style.verticalAlign = 'middle'; c.style.margin = '0 6px 0 0';
      b.insertBefore(c, b.firstChild);
    }
    b.title = note;
    b.onclick = go;
    d.appendChild(b);
    box.appendChild(d);
  }
  grid.insertBefore(box, grid.firstChild);
  /* What fell back silently. Every optional decode that failed
     since the page loaded, kept by quiet() in js/mac-bytes.js, so a
     missing picture or an empty sheet has a reason a visitor can find. At
     the foot of the sheet and folded, one grey line (the maintainer, 19
     September 2026: it was the second thing on the page); the count is in
     the line, so a fault still shows without the list being open. */
  {
    const q = document.createElement('details');
    q.className = 'quietLog';
    const n = QUIET_FAILURES.size;
    const line = n ? n + (n === 1 ? ' thing' : ' things') + ' have fallen back quietly since the page loaded' : 'Nothing has fallen back quietly since the page loaded';
    q.innerHTML = '<summary>' + line + '</summary>';
    if (n) {
      const ul = document.createElement('div');
      ul.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.6;color:#f0ede4;white-space:pre-wrap;margin-top:6px';
      // The file and line, not the origin it was served from.
      ul.textContent = [...QUIET_FAILURES].map(([m, v]) => (v.count > 1 ? v.count + '\u00d7 ' : '') + m + (v.where ? '\n    ' + v.where.replace(/https?:\/\/[^/\s]+\//g, '') : '')).join('\n');
      q.appendChild(ul);
    } else q.innerHTML += '<div class="changesNote" style="margin:6px 0 0">Everything the page has tried to read has worked. Anything the page could not read or draw would appear here as one line each with a count of the times it happened.</div>';
    box.appendChild(q);
  }
  out.textContent = 'Everything here that makes or changes a file and the other pages.';
}

/* ---- A tile on a sheet opens alone -------------------------------------------
   The sheet is drawn at whatever shape the gallery tools chose, so the click
   is mapped back through that shape to a tile index, and the tile opens in
   the sprite zoom: the picture at sixteen times, what it was cut from, and
   every class that is drawn by it -- the class whose base it is, and each
   one that reaches it at an aspect -- each a chip to that class's page.

   A tap used to leave the sheet. Until 16 September 2026 it went to the prop
   type whose block held the tile, so the hatchet, the tile after the spear,
   opened the spear's page, which does not show it. That was narrowed to a
   prop type's frames alone, which left the same gesture doing two different
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
  // The tile alone, and nowhere else. A tap used to leave the sheet
  // for the prop type that wears the tile, where a tile whose prop could
  // not be named stayed and opened the zoom -- so the same gesture did two
  // different things depending on the tile. The zoom shows the prop type's name
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

   Most classes go through a helper that is given the picture as an argument
   (0xE64, 0xE65, 0xE66 and 0xE67 in the shipped file), so a helper is read for
   which argument it passes, and the number is taken at each call. A poster and
   a sheet of paper pass the placed prop's Data2, so the picture is whatever
   each placed one has there.

   This replaced a table that matched prop names to pictures. The scripts
   differ from it twice: the bookshelf shows its text on the scroll (0x8F03)
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
    // needs a Data1 of 0 and a Data2, the paper a Data1 of 255 -- and opens
    // the helper's picture otherwise. Every placed one in the shipped file
    // that has a Data2 passes its class's test, so a Data2 is the test
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
   The joins between the two halves of the tree. An entity page has a
   "Made of" row: the components it is assembled from, each chip a jump to
   that resource under Components. A component's page has the reverse --
   "Worn by", "Spoken by", "Played by", "Referenced by" -- so that from a
   portrait you reach the person and from a sound you reach the scripts that
   play it. Nothing here is inferred from names: each join is a resource-id
   rule the archive itself follows (character i's dialogue is 0x1800+i, its
   portrait 0x8800+i-1, zone n's entry script 0x1400+n), or a call read out
   of disassembled code. Where a join is missing -- a sound that no script
   plays -- the row states it rather than staying silent. */
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

/* The row of a table that belongs to a thing, as a part of it: the record under
   Components > Records, which steps on down to the bytes. A dossier's and a
   unit's chip opened the whole table in the Data Fork until 16 October
   2026, the one way off a Scenario page that skipped Components (the
   maintainer's rule of 20 September 2026: Scenario, Components, Data;
   utilities/link_census.mjs found these two). jumpToTableAt falls back to the
   fork's hex for a table that is not on the Records sheet. */
function recordChip(label, resid, index, stride) {
  const leaf = TAB_LEAF_FOR.get('RECORDS');
  return relChip({ resid, js: 'jumpToTableAt(' + resid + ',' + index * stride + ',' + stride + ')',
    main: label, sub: 'record ' + index, title: leaf ? tabTrail(leaf) : '' });
}

// A link in text: see .svLink.
function svLink(label, js, note) {
  return '<button class="svLink" onclick="' + js + '">' + svEsc(label) + (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}
/* Code in the code face, never Argos (the maintainer, 10 November 2026:
   "Code like this should NEVER be Argos", of a routine's name heading its
   page). A routine's name, a mangled name, an address and an import are
   code. codeWord sets one in a sentence or a heading, codeLink as a link.
   The button rule sets Argos on every button, so the face goes on a span
   inside it. .aiWord is the code face at 0.9 of the text around it. */
function codeWord(s) { return '<span class="aiWord">' + svEsc(s) + '</span>'; }
function codeLink(label, js) {
  return '<button class="svLink" onclick="' + js + '"><span class="aiWord">' + svEsc(label) + '</span></button>';
}

function actionChip(label, js, note) {
  return '<button class="sv-chip" onclick="' + js + '">' + svEsc(label) +
    (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}

/* The links on a detail page to other resources -- what it is made of,
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
  // count; two tabs among the rest, or none at all, keep plain "Links".
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
   is opened, and then the hash is written a single time. Every "Open X in Y" link
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

   The card's id is what renderSchedulesSheet gives it. The open is
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

// A person, wearing their portrait -- the face identifies the person where the
// sprite identifies only a class (the maintainer, 8 September 2026: a portrait
// is the better way to identify a character wherever one is cited). The sprite
// stands in where there is no portrait, the tab's tile where there is neither.
// `terse` labels the record and not the person, for a row whose title is
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
  let characterBarks = [];
  try { characterBarks = buildBarkCatalog().filter(b => b.character === i); } catch (e) { characterBarks = []; }
  if (!characterBarks.length) return '';
  const lines = characterBarks.flatMap(b => b.words).map(w => '“' + svEsc(w) + '”');
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
  if (refExists(0xF009)) chips.push(recordChip('Record', 0xF009, i, 32));
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
  /* The strip the status window shows for the zone is a component like the
     rest of them: the entry script's one SetLandscapeImage call, which
     zoneLandscapeArg picks out. The strip is 0x8400 plus the number with
     its sign dropped, and a negative number is the same strip with no sky
     (landscapeSetters, in js/page-data.js). Until 6 October 2026 a negative
     number was chipped as "the ethereal void" or "one the engine keeps",
     from the reading the correction of 22 September replaced, so Land King
     Hall, the caves and the cellars linked to no strip. */
  try {
    const land = zoneLandscapeArg(level);
    if (land !== null && refExists(0x8400 + Math.abs(land))) chips.push(partChip(land < 0 ? 'Landscape without sky' : 'Landscape', 0x8400 + Math.abs(land)));
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
       begins with a number (FillIntfCache stores that word per prop type),
       and for every kind-3 egg, whose prop-type field is the sound.
   PlayIFSound, the only other, plays the application's snd resources.

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
   what was stored in it; no routine's address or class is written in here.
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
  // A bare 0x0812 means little; refDescription turns it into "object script".
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
    if (!rows.length) rows.push(['Played by', [], 'Nothing plays this sound. No script, class, list, or egg in the file names it.']);
  } else if (subn === 143) {
    const chips = chipsFor(u.music.get(resid - 0x9000));
    rows.push(['Played by', chips, chips.length ? '' :
      'No script refers to this music by number. The program starts some music itself.']);
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
                          separate line, 0x191A's "Something smells bad.",
                          lands on the ooze.
     0x1A00 | n           skill or spell n, and 0x8A00 | n its icon
     0x1B00 + room        the room a kind-8 egg has in its prop-type field,
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

// A skill or a spell is a card on its sheet, not a separate page, so this
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

// A thing on a Scenario tab, shown with its sprite where it has one.
function ownerChip(cat, js, main, sub, pt) {
  const leaf = TAB_LEAF_FOR.get(cat);
  let icon = '';
  if (pt !== undefined) icon = relIconURL({ icon: pt });
  if (!icon && leaf) icon = relIconURL({ tile: leaf.tile });
  return relChip({ js, main, sub, icon, title: leaf ? tabTrail(leaf) : '' });
}

// The thing a class is the class of: the units wearing a living prop type,
// else the item, else the prop type; a monster class's unit. `sub` labels what
// the chip is for where the caller has a better word than "unit" or "item".
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
// shows how many more there are.
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

// The Combat AI section, on whichever Mechanics tab it is on.
function combatAiRuleChip() {
  const g = mechGroupOf('combatai');
  return relChip({ js: "showCategory('" + (g ? g.value : 'MECH_COMBAT') + "'); setTimeout(function(){ mechGo('combatai'); }, 60)",
                   main: 'Combat AI', sub: 'Mechanics' + (g ? ' › ' + g.title : ''), icon: g ? relIconURL({ tile: g.tile }) : '' });
}

function ownerRows(resid, subn) {
  const rows = [];
  if (subn === 15 || subn === 16 || subn === 24) {
    // A living prop type is a unit, and the characters who wear it are listed
    // on the unit's page; anything else is an item or, failing that, a prop
    // type.
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
    // Every script that refers to this strip, the zone's entry script
    // included where it is one; a negative number is the strip with no sky
    // (landscapeSetters).
    const chips = [], shownText = new Set();
    for (const st of landscapeZones(resid)) {
      const key = st.resid + (st.sky ? '' : '-');
      if (shownText.has(key)) continue;
      shownText.add(key);
      chips.push(relChip({ js: 'jumpToScriptAt(' + st.resid + ',' + st.at + ')',
        main: landscapeSetterName(st.resid), sub: st.sky ? 'over the sky' : 'no sky',
        title: trailForResid(st.resid) }));
    }
    rows.push(['Set by', chips, chips.length ? '' : 'No script sets this landscape.']);
  }
  if (subn === 1 && HERO_CLASS_TEXT.some(([, r]) => r === resid) && loadCharacterTable()[1])
    rows.push(['Offered to', [characterChip(1)], '']);
  // The compiled combat AI and the scenario's tests and actions are what
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
  // A portrait or a conversation belongs to a character by its number alone,
  // so the number points at a slot whether or not anyone is in it; an empty
  // slot is labelled empty rather than offered as a person (characterRecord).
  const chars = loadCharacterTable();
  if (subn === 135) {
    const i = resid - 0x8800 + 1;
    if (characterRecord(i)) rows.push(['Worn by', [characterChip(i)], '']);
    else if (i > 0 && i < chars.length) rows.push(['Worn by', [], 'No one. Character slot ' + i + ' is empty.']);
  }
  if (subn === 23) {
    const i = resid - 0x1800;
    if (characterRecord(i)) rows.push(['Spoken by', [characterChip(i)], '']);
    else if (i > 0 && i < chars.length) rows.push(['Spoken by', [], 'No one. Character slot ' + i + ' is empty.']);
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
    const refChip = e => svChip(e.from, (refDescription(e.from) || e.via) + (e.count > 1 ? ' ×' + e.count : ''),
      e.via === 'code' && Number.isFinite(e.at) ? 'jumpToScriptAt(' + e.from + ',' + e.at + ')' : undefined);
    // The note is escaped where it is drawn, so the "more" that opens the
    // whole list goes in as the strip's last element.
    rows.push(['Referenced by', shown.map(refChip).concat(ins.length > shown.length
      ? ['<span class="partsNote">and ' + countLink((ins.length - shown.length) + ' more', 'The ' + ins.length + ' references to 0x' + resid.toString(16).toUpperCase(), ins.map(refChip)) + '</span>'] : []), '']);
  }
  return rows.map(([t, c, n]) => partsStrip(t, c, n)).join('') + forkEntryStrip(resid);
}

// --- Monster stats (0xF008) ------------------------------------------------
// 128 records of 16 bytes. The field map was the wiki's F008 page, and it
// matches this archive: record 22 is prop type 0x5A, which the prop-type list
// names "goat", and the wiki's note gives the goat as entry 0x16 = 22. Records
// 21/23/24 line up with bird, crab and ratlizard the same way.
//
// The useful part is that prop_type joins this table to everything else -- the
// sprite, the name, and any character wearing it -- so a monster stops being a
// row of hex and becomes a creature. corpse_type is packed the same way a prop
// record's aspect/proptype word is (6 bits aspect, 10 bits type), which is
// how a dead goat is a goat at aspect 2 while an undead leaves "bones".

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

   How the engine consumes these is read, not assumed: the default ResistDamage
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
/* The top half of the word is a separate field, 0x33: GetField serves it
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
  try { mf = appImage() ? exeMonsterFields() : null; } catch (e) { quiet(e, 'the unit fields for the top half of the flags'); }
  const f = mf && mf.fields.find(x => x.half === 'high');
  if (!f) return out;
  try {
    const named = DVM_SYM.field[String(f.field)];
    const spelled = '(?:0x' + f.field.toString(16).toUpperCase() + '\\b' + (named ? '|' + named + '\\b' : '') + ')';
    const hint = new RegExp('get_field ' + spelled), get = new RegExp('^get_field ' + spelled);
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
   26 September 2026, when the maintainer's list raised what gandreas's "Can
   Fly" does (until then nothing here was to say a creature flies).
   TActiveMonster::GetMonstAttrs hands TGameSys::CanMove the word at 8 of
   the unit the monster points to (its field at 4, set from ObjToMonst),
   with 0x80000000 for a party member and 0x80 from its character, and
   TGameSys::TryMove passes it through unchanged. The square's word is the
   attribute words of its tile and of every thing on it ORed together
   (TViewer::SetStage fills the grid, BuildStageEntry copies a square out).
   So each place CanMove tests one of the unit's bits beside one of the
   square's, with a result straight after, is a rule:

   - square, then unit: a unit with the bit may go where the rest are kept
     out.
     Inside the stretch that runs only for a square that blocks (0x200, the
     bit tilePassable walks by), 0x0001 and 0x0002 get onto water and pools
     (0x100) and 0x40000000 onto a mousehole (0x80000000); outside it, lava
     (0x10000 with 0x800, tested whole) is closed to a unit without 0x0080.
   - unit, then square, then `li 3, 0`: the unit is kept to the squares with
     the bit (`bf`: 0x20000000, the tentacle and the sea monster, to water,
     pool and shore) or off them (`bt`: 0x10000000, the child, the gator,
     the goat, the unicorn and the titan, off rope and fence).

   A rule that needs two of the unit's bits together (a door, for 0x0C with
   0x08000000, which no unit has) has a third test where the result
   would be and is left out. Two single tests read the word through the
   monster's pointer: TActiveMonster::HandleMove, on a square with
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
    // member and that is set in the king's unit itself (Alaric is drawn with
    // it). CanMove tests it twice: first beside the walk-through-walls byte
    // option-w flips with cheats on, answering 1 immediately, then, on a square
    // that blocks, before letting the mover onto it when what blocks it is a
    // character with the party bit (0x40 of its byte 8). The name describes
    // the second, which is all it does in play; it read "moves as a party
    // member" for an hour on 1 October 2026, which the maintainer read as
    // walking through walls, and that needs cheats. The rule is the last test
    // of the unit's word for that bit alone.
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
/* The 0xF004 names of the tiles whose attribute words have all of `bits` set:
   the ones the maps place, most-placed first, or where the maps place none,
   the art of the things that have them (the mousehole, rope and fence are
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
/* What the program's movement rules call a unit's bits, each with the
   instruction that tests it: [{ mask, name, site }], or none with no
   application open. A bit the rule reads that no unit has (0x0008) is
   named on no page, since only the bits a unit has are looked up. */
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
/* `each` puts every flag's number after its name (the unit's page,
   6 October 2026: the maintainer read the word printed before the names,
   0x000009F0 on the demon, as one more flag, when it is all of them added
   together). */
function monsterFlagsHTML(f, each) {
  const sites = monsterFlagSites();
  const named = [];
  let rest = f >>> 0;
  // A bit two rules read (0x0080 is fire and lava) is not counted twice.
  let describedBits = 0;
  const own = v => { if (!each) return ''; const again = (describedBits & v) >>> 0 === v >>> 0; describedBits = (describedBits | v) >>> 0;
    return ' <span style="color:#dcd8cc">' + (again ? 'also ' : '') + propWordHex(v >>> 0) + '</span>'; };
  for (const [bit, name] of MONSTER_FLAG_NAMES)
    if (f & bit) { const s = sites.get(bit); named.push({ low: bit, html: (s ? srcNum(s, name) : svEsc(name)) + own(bit) }); rest = (rest & ~bit) >>> 0; }
  // The program's names only with the program open: without it the bits
  // stay numbers, as a figure that is not read drops its sentence.
  if (appImage())
    for (const m of monsterMoveNames())
      if (f & m.mask) { named.push({ low: (f & m.mask & -(f & m.mask)) >>> 0, html: srcNum(m.site, m.name) + own(f & m.mask) }); rest = (rest & ~m.mask) >>> 0; }
  const tops = monsterTopFlagSites();
  for (const [bit, name] of MONSTER_TOP_FLAG_NAMES) {
    const w = (bit << 16) >>> 0, site = tops.get(bit);
    if (site && (f & w)) { named.push({ low: w, html: srcNum(site, name) + own(w) }); rest = (rest & ~w) >>> 0; }
  }
  named.sort((a, b) => a.low - b.low);
  const bits = named.map(x => x.html);
  if (rest) bits.push(each ? monsterRestWord() + own(rest) : '+0x' + rest.toString(16).toUpperCase() + ' (' + monsterRestWord() + ')');
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
        // read, not assumed: field 44 reads byte 0 and so on down to field 54,
        // the halfword at 14. Two corrections came out of reading it. The
        // special flags are the WORD at 8, and this parsed the halfword at
        // 10, so the top half -- set on eleven of the fifty -- was never
        // shown. And byte 6 is delvmod's `alignment`, which an earlier
        // "unknown2" swallowed, spanning bytes 6 to 9, a field that
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
   never prints this byte), and "probably size" was wrong: nothing in the
   application reads it. What does
   read it is a script, through GetField -- the field whose handler loads
   byte 4 (exeMonsterFields) -- and exactly one script in the shipped file
   reads that field. It builds a blow as the byte plus a random amount
   drawn from the attacker's Body and hands the sum to the damage helper,
   so the byte is the fixed part of what a blow does.

   The figures fit that and not size: a bird 1, a child 2, a
   crab 8, a gator 10, and the king 100 beside 255 health and 30 armor.
   That corroboration is in GRIMOIRE-NOTES.md and not in the sentence the
   page prints, which states what the script does and stops.

   The site is found rather than written down: the field number comes from
   the executable and the line from the script that names it. Null with no
   application open, and then the page states only that the byte is byte 4. */
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

// Every record of prop type `pt` that sits in an egg in a zone's prop
// list, grouped by zone, the egg's square and the Data1 it hatches with.
function creatureHatchSites(pt) {
  const out = new Map();
  for (let z = 0; z < 256; z++) {
    const rid = 0x8100 + z;
    let list = null;
    try { if (!refExists(rid)) continue; list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, rid), rid).data); } catch (e) { continue; }
    for (const p of list) {
      if (!p || p.proptype !== pt || p.onMap || p.container === null || p.container === undefined) continue;
      const egg = list[p.container];
      if (!egg) continue;
      const k = z + ':' + egg.x + ':' + egg.y + ':' + p.d1;
      if (out.has(k)) out.get(k).n++;
      else {
        // The editor's name beside the game's where they differ: two zones
        // are "Stronghold" in the game and Inner Brotherhood Hall and
        // Tavara Fortress in the editor's list (STR# 135).
        const game = zoneNameFor(0x8000 + z), ed = editorZoneName(0x8000 + z);
        out.set(k, { zone: (game || 'zone ' + z) + (ed && ed !== game ? ', ' + ed : ''), map: 0x8000 + z, x: egg.x, y: egg.y, beh: p.d1, n: 1 });
      }
    }
  }
  return [...out.values()];
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
          '</div><div style="font-size:0.75rem;color:#f0ede4;margin-bottom:10px">' +
          'record ' + srcNum({ resid: 0xF008, byte: r.index * 16, stride: 16, what: 'the whole record' }, String(r.index)) +
          ' of 0xF008 \u00b7 prop type ' +
          srcNum({ resid: 0xF008, byte: r.index * 16 + 12, stride: 16, what: 'the prop type ObjToMonst searches on' },
                 '0x' + r.proptype.toString(16).toUpperCase()) + '</div>';
  // Every figure opens the instruction that reads its byte: the handler
  // GetField jumps to for the field a script requests. `stat` is given the
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
  // store. With no application open, the record's long-standing names.
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
      '<br><span style="font-size:0.6875rem;color:#dcd8cc">' + monsterByteNote() + '</span></div>' +
    '<div><b>Special flags</b>' +
      ' <span style="font-size:0.6875rem;color:#f0ede4">' + monsterFlagsHTML(r.flags, true) + '</span>' +
      '<br><span style="font-size:0.6875rem;color:#dcd8cc">' + (r.flags ? 'The file stores them added together as one number (' +
        srcNum({ resid: 0xF008, byte: r.index * stride + 8, stride, what: 'the special flags' }, '0x' + r.flags.toString(16).toUpperCase().padStart(8, '0')) + '). ' : '') +
      'Click a flag to see the line that checks it.</span></div>' +
    '</div>';
  // Where it hatches: every record of this type inside an egg, by zone, the
  // egg's square and the behaviour the creature hatches with -- HatchEgg
  // gives it the contained record's Data1 (doc/behaviours.md, in the
  // workbench). The lich shows why: of four, the one in Tavara Fortress
  // hatches standing still and the rest attacking the nearest.
  const sites = creatureHatchSites(r.proptype);
  if (sites.length) {
    h += '<div class="mechSub">Where It Hatches</div><ul class="ruleList">' + sites.map(s =>
      '<li>' + svLink(s.zone + ' (zone ' + (s.map - 0x8000) + ')', 'jumpToResource(' + s.map + ')') + ' at (' + s.x + ', ' + s.y + ')' + (s.n > 1 ? ' (' + s.n + ' of them)' : '') +
      ' hatching ' + behaviorHTML(s.beh) + '</li>').join('') + '</ul>';
    /* The lich who stands still is taken for Tavara, the mage who destroyed
       Abydos; no text names him, and this is the line players read it from,
       quoted from the file. */
    const still = sites.filter(s => s.beh === 0);
    if (r.proptype === 297 && still.length === 1 && sites.length > 1) {
      const shownText = srcQuoteText(0x187F, 'Instead, he just sits in his mountain strongholds, awaiting a death that will never truly come.');
      if (/<button/.test(shownText)) h += '<div class="sv-note">The page identifies the one that stands still as Tavara. Ur-Sylph speaks of the traitor who destroyed a colony: ' + shownText + '</div>';
    }
  }
  panel.innerHTML = h;

  // The unit as the program builds it, then every frame it has.
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
      how.style.cssText = 'font-size:0.75rem;color:#f0ede4;line-height:1.5;max-width:380px';
      const lay = u.layout ? 'Layout ' + srcNum({ resid: u.layout.resid, at: u.layout.at }, String(u.layout.code)) : 'No layout';
      const app = appImage();
      if (u.kind === 'octo') how.innerHTML = lay + ': <b>a body with ' + (u.rule ? srcNum(u.rule.arms, u.rule.arms.v + ' arms') : '8 arms') + '</b> of ' +
        (u.arm !== null ? svLink(propDisplayName(u.arm) || ('prop ' + u.arm), 'showMonsterDetail(' + (parseMonsterStats().findIndex(m => m.proptype === u.arm)) + ')') : 'no class') +
        ' (the class named by its key 54). Arm <i>i</i> is at aspect <i>i</i> \u00d7 ' +
        (u.rule && u.rule.aspectStep ? srcNum(u.rule.aspectStep, String(u.step)) : String(u.step)) +
        ' (the frames for one direction) on the ' + (u.rule ? srcNum(u.rule.dx, 'eight squares') : 'eight squares') + ' around it' +
        '.' + (app ? ' ' + pefChip('TOctoMonster::TOctoMonster') : '');
      else if (u.kind === 'crawl') how.innerHTML = lay + ': <b>a head with its tail behind it</b>. The tail is a second record at the head’s aspect plus ' + (u.rule ? srcNum(u.rule.tailOffset, '8') : '8') +
        '. The layout sets which kind it is.' + (app ? ' ' + pefChip('TCrawlMonster::TCrawlMonster') + pefChip('TActiveMonster::CreateMonster') : '');
      else if (u.kind === 'span') how.innerHTML = lay + ': one record whose <b>tiles span ' + whole.cols + ' by ' + whole.rows + '</b> according to their attributes. A thing placed in the world does the same.';
      else how.innerHTML = lay + ': one record and one tile. The layout sets the frame.' + (app ? ' ' + pefChip('TActiveMonster::AdjustAspect') : '');
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
    cd.innerHTML = '<b style="color:#f0ede4">Leaves behind</b> ' + svEsc(cnm) +
                   ' at aspect ' + srcNum(cSrc, String(r.corpseAspect)) +
                   ' <span style="font-size:0.6875rem;color:#dcd8cc">(' +
                   srcNum(cSrc, '0x' + r.corpseWord.toString(16).toUpperCase().padStart(4, '0')) + ')</span>';
    const cbase = tiles[r.corpseType];
    if (cbase !== undefined) {
      const spr = drawPropSprite(cbase + r.corpseAspect, 40);
      if (spr) { spr.canvas.style.marginTop = '6px'; imageOpens(spr.canvas, sheetOfTile(cbase + r.corpseAspect), 'sheet'); cd.appendChild(spr.canvas); }
    }
  } else {
    cd.innerHTML = '<b style="color:#f0ede4">Leaves behind</b> nothing.';
  }
  panel.appendChild(cd);
  // The components: its class script, the sheet its sprite is cut from, and
  // its row of the stats table.
  {
    const chips = [];
    const cls = 0x1000 + r.proptype;
    if (r.proptype && refExists(cls)) chips.push(partChip('Class script', cls));
    const base = tiles[r.proptype];
    if (base !== undefined && refExists(0x8E00 + (base >> 4))) chips.push(partChip('Sprite sheet', 0x8E00 + (base >> 4)));
    for (const n of classSounds(0x1900 + r.index)) chips.push(partChip('Sound', 0x9100 + n));
    if (refExists(0xF008)) chips.push(recordChip('Record', 0xF008, r.index, 16));
    chips.push(actionChip('Prop type', 'showPropTypeDetail(' + r.proptype + ')', 'every frame'));
    const made = document.createElement('div');
    made.innerHTML = linksFold(partsStrip('Made of', chips));
    panel.appendChild(made);
  }

  // Named characters wearing this sprite.
  const users = [];
  try {
    const chars = loadCharacterTable();
    for (let i = 1; i < chars.length; i++) if (chars[i].proptype === r.proptype && characterRecord(i)) users.push(i);
  } catch (e) { quiet(e); }
  if (users.length) {
    const u = document.createElement('div');
    u.style.cssText = 'font-size:0.8125rem;line-height:1.9;margin-bottom:10px';
    u.innerHTML = '<b style="color:#f0ede4">Characters using this sprite</b><br>' +
      users.slice(0, 30).map(i => '<button class="sv-chip" onclick="showCharacterDetail(' + i + ')">' +
        svEsc(characterName(i)) + '</button>').join(' ');
    panel.appendChild(u);
  }

  // The record itself, a byte at a time, each one opening that byte in
  // the table. This is the bottom of the chain: below it there is only the
  // file.
  const raw = document.createElement('div');
  raw.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.6875rem;color:#f0ede4';
  raw.innerHTML = 'raw: ' + Array.from(r.raw).map((b, k) =>
      srcNum({ resid: 0xF008, byte: r.index * 16 + k, stride: 16, what: 'byte ' + k },
             b.toString(16).padStart(2, '0'))).join(' ') +
    (r.unknown7 ? '<br><span style="color:#dcd8cc">byte 7 is ' + r.unknown7 + ', which no field reads</span>' : '');
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

   The folded listing had a separate button between the two until the same
   day, and was taken off the row when the maintainer asked whether it was
   needed: it is the structured listing without the braces, every function
   the one renders the other renders too (structure_check), and where a jump
   cannot be proven a block the structured listing already leaves the goto
   the folded one would show. dvmFoldRender stays, since the structured
   listing and the gallery's outlines are built on it, and 'folded' still
   selects it for a caller that requests it.

   Kept on `window` because the row's buttons are inline handlers, and
   remembered in the browser so a reader who prefers raw does not have to
   choose it again on every visit. */
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
// which stays on the view the reader is on rather than choosing again.
function renderText(sameResource) {
  const out = document.getElementById('output');
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid, roff, rlen] = window.CUR_RESIDS[idx];
  // An open editor has the PREVIOUS resource's bytes; left open across
  // navigation, Apply would write them into whatever is showing now.
  cancelResourceEdit();
  try {
    const resDataRaw = ARCHIVE.bytes.slice(roff, roff+rlen);
    const { data: resData, wasDecrypted, rawEntropy, decEntropy, shape, allZero, inTables } = smartDecrypt(resDataRaw, resid);

    document.getElementById('textPreview').style.display = 'block';
    document.getElementById('zoomControls').style.display = 'none';
    document.getElementById('resourceNav').style.display = 'flex';
    document.getElementById('backToSheet').style.display = 'block';

    // The identity of the resource is now the job of the script view's header,
    // so this line shows only what that panel leaves out: the decision the
    // decryptor made, and how close it was.
    const readNote =
      (wasDecrypted ? 'decrypted' : 'read as stored') +
      (inTables ? "  (from delvmod's tables)"
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
        // containment link, not coordinates, when the flags mark the record as
        // carried.
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
    // fall through to it -- a prop list or a map header can still contain text.
    stringsText = extractReadableStrings(ARCHIVE, resData, resid) || '(No readable strings in this resource.)';
    hexText = hexDump(resData);

    const midiBtn = document.getElementById('midiBtn');
    const qtPlayBtn = document.getElementById('qtPlayBtn');
    if (midiBtn) midiBtn.style.display = 'none';
    if (qtPlayBtn) qtPlayBtn.style.display = 'none';
    const midiInBtn = document.getElementById('midiInBtn');
    if (midiInBtn) midiInBtn.style.display = 'none';
    const midiAddBtn = document.getElementById('midiAddBtn');
    if (midiAddBtn) midiAddBtn.style.display = 'none';
    const qtPickBtn = document.getElementById('qtPickBtn');
    if (qtPickBtn) qtPickBtn.style.display = 'none';
    if (subn === 143) {
      // A tune played a moment ago stays in the sound panel otherwise.
      document.getElementById('soundPreview').style.display = 'none';
      let head = "--- QTMA TUNE (decoded) ---\n";
      try {
        const info = qtmaToMidi(resDataRaw);
        showTuneRoll(resid, info);
        const gm = Object.keys(info.noteRequests).sort((a,b)=>a-b)
          .map(p => "  part " + p + " -> MIDI ch " + ((info.chanOf[p]|0)+1) +
                    ", GM program " + info.noteRequests[p] + " (" +
                    (GM_NAMES[info.noteRequests[p]-1] || "?") + ")").join("\n");
        head += "Notes: " + info.noteCount + "   Events: " + info.eventCount +
                "   Length: " + info.durationSec.toFixed(1) + "s\n" +
                "Parts:\n" + (gm || "  (none declared)") + "\n\n" +
                "\"Play with QuickTime's Instruments\" plays it through the samples QuickTime 3\n" +
                "shipped. The page fetches them from archive.org (7 MB) the first time.\n\n";
        if (midiBtn) midiBtn.style.display = '';
        if (qtPlayBtn) qtPlayBtn.style.display = '';
        if (midiInBtn) midiInBtn.style.display = '';
        if (midiAddBtn) midiAddBtn.style.display = '';
      } catch(e) {
        head += "(the page could not decode this as a QTMA tune: " + e.message + ")\n\n";
      }
      content = head + content;
    }

    // Every non-media subindex is made of Delver VM containers, so every one
    // of them is given a real disassembly instead of a byte dump. Subindexes
    // 1, 2, 4, 10 and 29 were missing from this list, which is the whole
    // reason 27 resources -- 0x0301 among them -- rendered as anonymous hex.
    // They were decrypting correctly the entire time and the disassembler
    // could already read them; it was simply never called. 0x0301 is `[2, 3,
    // 1, 1]`.
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
                       'It is not Delver script code. Running the disassembler over it\n' +
                       'produces meaningless output. Its real format is unknown.\n' +
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
          const dis = render === dvmRender ? dvmRender(ARCHIVE, resData, resid, { shown: true })
                                           : render(ARCHIVE, resData, resid, listingExtra);
          if (dis && dis.split('\n').length > 2) scriptText = dis;
          // The folded views name a call without its id; the links in them
          // are learned from this (paintDecodedPane, renderLinked).
          if (render !== dvmRender) rawText = dvmRender(ARCHIVE, resData, resid) || '';
        }
      } catch (e) {
        scriptText = '// the page could not disassemble this: ' + e.message;
      }
    }
    const sv = document.getElementById('scriptView');
    const isScript = SCRIPT_SUBN.has(subn);
    // The script's head shows the decryption note; the centred line above
    // it would repeat it.
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
    // explorer. Everything else has a plain hex pane.
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
  } catch(err) { out.textContent = "The page could not show this resource: " + err.message; }
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
   the code, and every line still has its in-place edit link.

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
// Empty since 23 September 2026: the files name no group, and the community's
// names for them (above) went with the other typed names at the
// maintainer's word. A group is shown by its id; utilities/dialogue_check.mjs
// uses the community's names to find each group in its collection.
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

// The engine's rule: the first four letters of the first word typed,
// prefix-matched against the stored keyword (which may itself be shorter --
// "bye" -- or be several alternatives separated by commas -- "iron,mine").
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
    // Another character's card, from a test of their bit, is on their
    // view, which opens first.
    if (hit && !document.getElementById('conv-' + resid + '-' + hit.at)) { window.PENDING_CONV_WORD = word; return jumpToResource(resid); }
    if (hit) return convScrollTo(resid, hit.at);
    for (const gid of conv.groups) {
      const g = conversationFor(gid);
      const gh = g && convFindEntry(g.entries, word);
      if (gh) {
        // The character's view includes its groups' topics too.
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
    if (a.call === 0xF00) return 'learns the hero’s name';
    if (a.call === 0xE86) return 'training';
    if (a.call === 0x813) return 'a rumor from the pool';
    if ((a.call >> 8) === 8) return null;              // chain calls render in the header
    const d = typeof refDescription === 'function' ? refDescription(a.call) : null;
    return 'calls ' + (d || ('0x' + a.call.toString(16).toUpperCase()));
  }
  // AddQuest and CompleteQuest are delvmod's names for cbAddToDo and
  // cbDoneToDo: they write and strike off a line in the To Do window and
  // touch no other state, so they are not called "a quest" here.
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

function convTextHtml(resid, e, seen) {
  let html = '';
  // Which conditions pick each line: the Read clause at or before the
  // string's offset, within this prompt (convReadConds). Shown when it
  // changes from the line before, so a run of lines under one test names it
  // only at the start, and a line under the tests of the line before plus
  // more names only the more ("and if Mantinea ...").
  const lines = e.kw && e.kw !== '*' ? (convReadConds(resid).lines.get(e.at) || []) : [];
  let prev = '', prevChain = [], pending = '';
  const words = s => escHtml(s).replace(/@([A-Za-z][A-Za-z'-]*)/g,
    '<span class="convLink" onclick="convJumpWord(' + resid + ',\'$1\')">$1</span>');
  const edit = t => window.DLG_EDIT ? ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + t.off + ')">edit</button>' : '';
  const paras = [];
  for (const t of e.text) {
    // A string whose start only some players see (dvmConversation's `opt`)
    // continues the line before it when that line stops mid-word, as
    // Naxos's "hero" and "ine" do. The card shows "hero(ine)", and the
    // part in brackets has the test as its hover text.
    if (t.opt) {
      const test = /^load_far_word (0x[0-9A-Fa-f]+)$/.exec(t.optTest || '');
      const hover = 'The game prints this part when ' + (test ? dvmFarWordName(test[1]) + ' is not zero' : 'the test before it passes');
      const part = '<span class="convOpt" title="' + svEsc(hover) + '">(' + words(t.str.slice(0, t.opt)) + ')</span>' + words(t.str.slice(t.opt)) + edit(t);
      const last = paras[paras.length - 1];
      if (last && /[A-Za-z]$/.test(last.str)) { last.html += part; last.str = t.str; continue; }
      paras.push({ str: t.str, html: part });
      continue;
    }
    let chain = [];
    for (const l of lines) { if (l.at > t.off) break; chain = l.chain; }
    const shownText = chain.join(' and ');
    let lead = '';
    if (shownText && shownText !== prev) {
      const more = prevChain.length && prevChain.length < chain.length && prevChain.every((c, i) => chain[i] === c) ? chain.slice(prevChain.length) : null;
      lead = '<span class="inspDim">' + (more ? 'and ' : '') + (more || chain).map(c => convCondHtml(resid, c, seen)).join(' and ').replace(/ and if /g, ' and ') + ':</span> ';
    }
    prev = shownText; prevChain = chain;
    /* A "*" in the game's text is a page break, where the player clicks for
       the next part, and each part is a paragraph here. Until 12 November
       2026 a string such as Halos's account of the kidnapping, five parts,
       was one paragraph with the asterisks in it. A string of page breaks
       alone (Halos's Mantinea branch opens with one) passes its lead on to
       the next part. */
    const parts = String(t.str).split('*').filter(s => s.trim());
    if (!parts.length) { pending = lead || pending; continue; }
    parts.forEach((s, i) => paras.push({ str: s, html: (i ? '' : (lead || pending)) + words(s) + (i === parts.length - 1 ? edit(t) : '') }));
    pending = '';
  }
  for (const p of paras) html += '<p class="dlgLine">' + p.html + '</p>';
  return html;
}

/* What the player means by a prompt (the maintainer, 23 September 2026:
   the "real" four letters and the "intended" word, both shown together). The
   code
   stores only what it matches -- "demo", "eteo", "job" -- and the words
   those stand for are in the game's text: every @word in every response
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
/* `where`, when the caller has it, is the prompt the stub is stored in:
   { resid, kw }, the conversation and the prompt's whole keyword string.
   The last two steps below use it.

   Until 12 November 2026 the last step was any word any conversation
   prints, and the maintainer found the Human group's rude-word prompt
   (fuck, shit, ... damn, ... pric, dick, bitc) reading DAMNED and PRICE:
   the game prints none of those words, so "damn" and "pric" took the
   commonest printed words that start with their letters, Ignae's price
   and a damned from elsewhere. Two rules were measured on every stub that
   step fills (work/curse-words/stub-rules.mjs in the workspace). The
   words of the conversation that stores the prompt are the better match
   where it has one (House Strymon's "andr" is Andromache there and Andra
   in general, Cademia's "pass" password and not passed), so they come
   first. And a prompt of four or more stubs, most of which match nothing
   at all, is a list of words the player is expected to type and the game
   never prints: the rude words, and the weapon skills a trainer lists.
   The whole-game words are not taken for such a prompt. Shorter prompts
   keep that step, since Aethon's "aeth,bali,poda" needs it for Balius and
   Podargus. */
function convIntendedFor(stub, where) {
  // Only a stub of exactly four letters is a word cut short; a shorter one
  // ("job", "bye", the "y" and "n" of a question) is the whole word, and a
  // longer one ("very easy") is spelt out already.
  if (!/^[a-z]{4}$/i.test(stub)) return [];
  const pick = words => {
    const out = [];
    for (const [k, o] of words) if (convKwMatches(stub, k)) out.push(o);
    return out.sort((a, b) => b.n - a.n || a.text.localeCompare(b.text)).map(o => o.text);
  };
  const marked = pick(convIntendedWords());
  if (marked.length) return marked;
  // No response marks the word: Naxos's "glau" is Glaucus, a name the
  // game prints plain. The character names come next, then the words the
  // prompt's conversation prints plain, then any word the responses print
  // plain, most used first.
  const named = pick(convNameWords());
  if (named.length) return named;
  if (where && where.resid != null) {
    const near = pick(convPlainWords(where.resid));
    if (near.length) return near;
  }
  if (where && where.kw != null) {
    const stubs = String(where.kw).split(',');
    if (stubs.length >= 4 && stubs.filter(convStubUnmatched).length * 2 > stubs.length) return [];
  }
  return pick(convPlainWords());
}
// The character names as words, for convIntendedFor. Built on each call, as
// it was inside convIntendedFor, since the name table is not fixed once a
// file opens.
function convNameWords() {
  const names = new Map();
  for (const nm of nameTable() || []) {
    const w = String(nm || '').trim();
    if (/^[A-Za-z][A-Za-z'-]*$/.test(w) && w !== 'x') names.set(w.toLowerCase(), { text: w, n: 1 });
  }
  return names;
}
// The character a note's "Mantinea’s" names, by number, or null when no
// character or more than one has that name (the Gate Guards).
function convSpeakerIndex(poss) {
  if (!DERIVED.CONV_SPEAKERS) {
    const m = new Map();
    for (let i = 1; i < 256; i++) {
      const nm = typeof characterName === 'function' ? characterName(i) : null;
      if (!nm) continue;
      const k = dvmProsePossessive(nm);
      m.set(k, m.has(k) ? 0 : i);
    }
    DERIVED.CONV_SPEAKERS = m;
  }
  return DERIVED.CONV_SPEAKERS.get(poss) || null;
}
// True for a four-letter stub that matches no @word and no name.
function convStubUnmatched(k) {
  if (!/^[a-z]{4}$/i.test(k)) return false;
  for (const words of [convIntendedWords(), convNameWords()]) for (const w of words.keys()) if (convKwMatches(k, w)) return false;
  return true;
}
// Every word the conversations print, @-marked or not, by how often; with a
// resource number, the words of that conversation alone.
function convPlainWords(resid) {
  if (!DERIVED.CONV_PLAIN) DERIVED.CONV_PLAIN = new Map();
  const key = resid == null ? 'all' : resid;
  if (DERIVED.CONV_PLAIN.has(key)) return DERIVED.CONV_PLAIN.get(key);
  const words = new Map();
  const walk = es => { for (const e of es || []) {
    for (const t of e.text || []) for (const m of String(t.str).matchAll(/[A-Za-z][A-Za-z'-]{3,}/g)) {
      const k = m[0].toLowerCase(), o = words.get(k) || { text: m[0], n: 0 };
      o.n++; words.set(k, o);
    }
    walk(e.sub);
  } };
  const add = rid => { const c = conversationFor(rid); if (c) { walk(c.entries); if (c.preamble) walk([c.preamble]); } };
  if (resid != null) add(resid);
  else for (const [subn, base] of [[23, 0x1800], [7, 0x800]]) {
    const count = subindexCount(ARCHIVE, subn);
    for (let i = 0; i < count; i++) add(base + i);
  }
  DERIVED.CONV_PLAIN.set(key, words);
  return words;
}
// A prompt as the player types it, and as the code stores it.
function convPromptHtml(e, resid) {
  if (e.kw === '*') return '<span class="convKw">anything else</span>';
  return String(e.kw).split(',').map(k => {
    const w = convIntendedFor(k, { resid, kw: e.kw });
    return '<span class="convAsk">' + svEsc((w[0] || k).toUpperCase()) + '</span>' +
      (w.length > 1 ? '<span class="convAlso">or ' + w.slice(1, 3).map(x => svEsc(x.toUpperCase())).join(', ') + '</span>' : '') +
      '<span class="convKw" title="what the game matches">' + svEsc(k) + '</span>';
  }).join(' ');
}

/* What a prompt's answer depends on, as the Read view words it: for each
   "when asked about" clause of the conversation's Read (dvmReadRender), the
   conditions of the ifs inside it, down to but not into a nested prompt,
   which is a separate card. Keyed by the prompt's offset, which the Read
   clause and the conversation entry share. Until 24 September 2026 a card
   showed only which tests it called ("depends on: GetQV"), and missed a test
   made through a helper altogether: Aethon's "demo" calls 0xF13 to test
   whether he is in the party and its card showed nothing. */
// "not (x)" of a condition, without a double negative: a test the Read view
// already wrote as "not (x)" or "not x" is turned back to x when x is one
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
  // A condition's note from the Read view, which gives where a flag it tests
  // is set ("Alaric's conversation, asked about CHRY sets bit 2 ..."), kept
  // so the card can say it in those words (convCondHtml).
  out.notes = new Map();
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    const fns = raw ? dvmReadRender(ARCHIVE, smartDecrypt(raw, resid).data, resid) : [];
    // A heading reads "if X, then:" since 9 November 2026; the ", then" is no part of X.
    const cond = t => { const m = /^(?:otherwise )?if (.*?)(?:, then)?:(?: (.*))?$/.exec(t); if (m && m[2]) out.notes.set(m[1], m[2]); return m ? m[1] : null; };
    // Every clause under a prompt, with the conditions it sits under there:
    // those of the if itself, and "not (...)" of the if before an "otherwise".
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
    // Each local's values, from every "set VarNN to ..." in the script.
    out.locals = new Map();
    const sets = cl => { for (const c of cl || []) {
      const m = /^set (Var[0-9A-F]{2}) to (.+)$/.exec(c.text);
      if (m) { if (!out.locals.has(m[1])) out.locals.set(m[1], []); if (out.locals.get(m[1]).indexOf(m[2]) < 0) out.locals.get(m[1]).push(m[2]); }
      sets(c.kids);
    } };
    for (const f of fns) sets(f.clauses);
  } catch (err) { quiet(err, 'reading a conversation\u2019s conditions'); }
  DERIVED.CONV_READ_CONDS.set(resid, out);
  return out;
}
/* A local in a condition, "if Var00", has no meaning of its own: the
   script sets it, and what it is set to is the meaning. Naxos's Var00 is
   "test flag player character, 29". The card writes each local with the
   values the script gives it in brackets, as the Read view words them. */
function convLocalShown(resid, c) {
  const locals = convReadConds(resid).locals;
  if (!locals || !locals.size) return c;
  return c.replace(/\bVar[0-9A-F]{2}\b/g, v => {
    const vals = locals.get(v);
    return vals && vals.length ? v + ' (set to ' + vals.slice(0, 3).join(' or ') + (vals.length > 3 ? ' and more' : '') + ')' : v;
  });
}
/* A condition as the card words it. A test of a flag of the character's
   that the Read view found set by one of that character's topics reads as
   that topic asked about before, the word a link to it (the maintainer,
   17 October 2026: "201 if its bit flags has bit 2 ... There's no way to
   tell what this means, no link even"). Any other note follows the test;
   a test with none is written as the Read view writes it.

   Since 12 November 2026 the same is true of a flag test inside a longer
   condition. The maintainer wanted Halos's kidnapping card to read
   better. Its condition was "get state 1 is more than 0 and its bit flags
   has bit 1 or its bit flags has bit 2 or its bit flags has bit 4", with
   every test's note run together after it, "0xF02;" and all, four times
   over. Now each bit of the character's that one of their prompts sets
   reads as that prompt, all of them as one list ("AKE, PROPONTIS, DEBT or
   NOTE before"). The note retains only what is left, without a helper's
   bare number, and `seen`, one per card, prints a condition's note the
   first time only. Two calls the Read view writes as calls read as what
   they do: the setter a guard calls in place of the test (Halos's "not
   set character flag it, 3", which `halos-kidnapping` fixes), and a
   group's answer. The words of the card are CONV_ASK, on one line. */
const CONV_ASK = { on: 'asked about ', before: ' before', not: 'not yet asked about ' };
// The view cbnearby tests is the square of squares the map window shows.
// TMapWindow::ResizeRoutine sets its size from the window's (an odd count
// across, at most 15), so a smaller window reaches fewer characters.
const CONV_NEARBY = 'True when the character is awake and in sight among the squares the map window shows on the current character’s level. A smaller map window shows fewer squares.';
function convCondHtml(resid, c, seen) {
  const notes = convReadConds(resid).notes;
  const neg = /^not \((.*)\)$/.exec(c), k = neg ? neg[1] : c;
  const note = notes.get(k) || notes.get(c) || '';
  const character = (typeof characterName === 'function' && resid >= 0x1800 && resid < 0x1900) ? characterName(resid - 0x1800) : null;
  // SetCharacterFlag (0xF00) answers 0 whatever it did, so "not" of it
  // passes every time; the setting is what it does.
  const setter = /^not set character flag it, (\d+)$/.exec(c);
  if (setter) return 'sets bit ' + setter[1] + ' of its bit flags (a test that always passes)';
  const group = /^(not )?run (0x8[0-9A-F]{2}) it$/.exec(c);
  if (group) return 'if ' + readLinkHex(group[2]) + (group[1] ? ' has no answer' : ' answers');
  // The note's parts, as the Read view joins them with "; ".
  const pieces = note.replace(/^\(([\s\S]*)\)$/, '$1').split('; ').filter(p => p && !/^\(?0x[0-9A-F]+\)?$/.test(p));
  // The prompts of this character that set each bit of theirs: one prompt
  // and "sets bit 1 of Halos’ bit flags", or a run of prompts and then
  // "set bit 2 of Halos’ bit flags" after the last. A run that ends in
  // anything else goes back into the note as it was, and so does a bit the
  // greeting sets too ("Ake’s conversation; ... MORE set bit 1 of Ake’s bit
  // flags"), since no prompt alone stands for it.
  const bits = new Map(), rest = [];
  let run = [];
  const whose = character ? dvmProsePossessive(character) : null;
  if (whose) {
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const head = '^' + esc(whose) + ' conversation,\\s\\w+ about ';
    const sets = new RegExp(head + '(.+?) sets? bit (\\d+) of ' + esc(whose) + ' bit flags$');
    const bare = new RegExp(head + '(.+)$');
    for (const p of pieces) {
      const s = sets.exec(p), a = !s && bare.exec(p);
      if (s && run.every(r => r.word)) bits.set(s[2], run.map(r => r.word).concat(s[1]).flatMap(w => w.split(' or ')));
      else if (s) rest.push(...run.map(r => r.piece), p);
      else if (a || p === whose + ' conversation') { run.push({ word: a ? a[1] : null, piece: p }); continue; }
      else rest.push(...run.map(r => r.piece), p);
      run = [];
    }
    rest.push(...run.map(r => r.piece));
  } else rest.push(...pieces);
  // Another character's bit that their prompts set, as Mantinea's bit 1 on
  // Halos's kidnapping card, which her COMPANY prompt sets. The note reads
  // as the character's bits do, a run of prompts and then the one that
  // "sets" or "set" the bit, and the speaker of each can be someone else
  // again, as Hector's JOIN sets Hadrian's bit 1. The test "Mantinea (61)’s
  // bit flags has bit 1" becomes those prompts put to their speakers, each
  // word a link to its card. A bit that a greeting, a script or anything but
  // a prompt sets stays as it was, since no prompt alone stands for it.
  const theirs = new Map();
  let lead = [];
  for (const p of pieces) {
    const other = /sets? bit (\d+) of (.+) bit flags$/.exec(p);
    const bare = !other && !/ (?:sets?|clears?) /.test(p) && /^(.+) conversation(?:,\s\w+ about (.+))?$/.exec(p);
    if (bare) { lead.push({ speaker: bare[1], words: bare[2] || null, piece: p }); continue; }
    // On Hadrian's cards the test of his bit has his name in place of
    // "its", so every bit's setters are read here. A run of prompts belongs
    // to the bit when the verb after it is "set". After "sets" the setter
    // is that one prompt alone.
    if (other) {
      const s = /^(.+) conversation,\s\w+ about (.+?) (sets?) bit \d+ of .+ bit flags$/.exec(p);
      const key = other[2] + '|' + other[1];
      const t = theirs.get(key) || { asks: [], pieces: [], ok: true };
      const run = s && s[3] === 'set' ? lead : [];
      const group = run.concat(s ? [{ speaker: s[1], words: s[2], piece: p }] : []);
      if (!s || group.some(g => !g.words || !convSpeakerIndex(g.speaker))) t.ok = false;
      else t.asks.push(...group);
      t.pieces.push(...run.map(g => g.piece), p);
      theirs.set(key, t);
    }
    lead = [];
  }
  // The prompts stand in the text as ⟦WORD⟧, or ⟦WORD@resid⟧ for another
  // character's, until it is escaped.
  const L = '⟦', R = '⟧';
  const words = b => bits.get(b).map(w => L + w + R).join(' or ');
  let txt = convLocalShown(resid, c)
    .replace(/\bits bit flags has bit (\d+)(?: \(\w+\))?/g, (m, b) => bits.has(b) ? CONV_ASK.on + words(b) + CONV_ASK.before : m)
    .replace(/\bits bit flags does not have bit (\d+)(?: \(\w+\))?/g, (m, b) => bits.has(b) ? CONV_ASK.not + words(b) : m);
  const used = new Set();
  for (const n of new Set([...txt.matchAll(/\((\d+)\)’s bit flags/g)].map(m => +m[1]))) {
    const nm = typeof characterName === 'function' ? characterName(n) : null;
    if (!nm) continue;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const test = new RegExp(esc(dvmProsePossessive(nm + ' (' + n + ')')) + ' bit flags (has|does not have) bit (\\d+)(?:\\s\\(\\w+\\))?', 'g');
    txt = txt.replace(test, (m, has, b) => {
      const t = theirs.get(dvmProsePossessive(nm) + '|' + b);
      if (!t || !t.ok || !t.asks.length) return m;
      used.add(t);
      // One phrase for each speaker, in the order the note has them.
      const by = new Map();
      for (const a of t.asks) {
        if (!by.has(a.speaker)) by.set(a.speaker, []);
        by.get(a.speaker).push(...a.words.split(' or '));
      }
      // A prompt of the card's character is written without their name,
      // as the bits above are.
      const asks = [...by].map(([sp, ws]) => {
        const i = convSpeakerIndex(sp);
        const to = i === resid - 0x1800 ? '' : characterName(i) + ' ';
        return { about: to + 'about', list: ws.map(w => L + w + (to ? '@' + (0x1800 + i) : '') + R).join(' or ') };
      });
      if (asks.length === 1) return has === 'has'
        ? CONV_ASK.on.replace('about', asks[0].about) + asks[0].list + CONV_ASK.before
        : CONV_ASK.not.replace('about', asks[0].about) + asks[0].list;
      const any = asks.map(a => CONV_ASK.on.replace('about', a.about) + a.list + CONV_ASK.before).join(' or ');
      return (has === 'has' ? '' : 'not ') + '(' + any + ')';
    });
  }
  // Where the Read view put the test in brackets, one pair of them stays.
  // A pair around the whole stays too, since a card's lines join their
  // tests with "and".
  txt = txt.replace(new RegExp('\\(\\((' + CONV_ASK.on.split(' ')[0] + ' [^()]*)\\)\\)', 'g'), '($1)');
  for (const t of used) for (const p of t.pieces) { const i = rest.indexOf(p); if (i >= 0) rest.splice(i, 1); }
  // Two such tests joined by "or" are one list, and brackets around one alone go.
  const list = '((?:' + L + '[^' + R + ']+' + R + '(?: or )?)+)';
  const pair = new RegExp(CONV_ASK.on + list + CONV_ASK.before + ' or ' + CONV_ASK.on + list + CONV_ASK.before);
  while (pair.test(txt)) txt = txt.replace(pair, CONV_ASK.on + '$1 or $2' + CONV_ASK.before);
  // The same for a test of another character's prompts, with their name
  // before "about", unless the brackets hold two such tests.
  const one = new RegExp('^not \\(' + CONV_ASK.on.replace('about', '([^()⟦]*?)about') + '([^()]*)' + CONV_ASK.before + '\\)$');
  txt = txt.replace(one, (m, who, ws) => ws.includes(CONV_ASK.before) ? m : CONV_ASK.not.replace('about', who + 'about') + ws)
    .replace(new RegExp('\\((' + CONV_ASK.on.replace('about', '[^()⟦]*?about') + '[^()]*' + CONV_ASK.before + ')\\)', 'g'),
      (m, inner) => inner.includes(CONV_ASK.before + ' or ') ? m : inner)
    .replace(new RegExp('(' + L + '[^' + R + ']+' + R + ')((?: or ' + L + '[^' + R + ']+' + R + ')+)', 'g'), (m, first, more) => {
      const ws = [first].concat(more.split(' or ').filter(Boolean));
      return ws.length > 2 ? ws.slice(0, -1).join(', ') + ' or ' + ws[ws.length - 1] : ws.join(' or ');
    });
  // "nearby" is the program's name for the test delvmod calls IsInParty
  // (cbnearby). Its meaning on Ake's card was the maintainer's question of
  // 12 November 2026, and the hover gives what its handler tests
  // (GRIMOIRE-NOTES, *What the disputed syscalls do*).
  const html = readLinkHex(svEsc(txt)).replace(new RegExp(L + '([^' + R + '@]+)(?:@(\\d+))?' + R, 'g'), (m, w, to) =>
    '<span class="convLink" onclick="convJumpWord(' + (to || resid) + ',\'' + svEsc(w.toLowerCase().replace(/'/g, '')) + '\')">' + w + '</span>')
    .replace(/\bnearby\b/g, '<span class="convOpt" title="' + svEsc(CONV_NEARBY) + '">nearby</span>');
  const shownNote = rest.length && !(seen && seen.has(k)) ? '(' + rest.join('; ') + ')' : '';
  if (seen) seen.add(k);
  return 'if ' + html + (shownNote ? ' <span class="inspDim">' + readLinkHex(svEsc(shownNote)) + '</span>' : '');
}
function convCardHtml(resid, e, depth) {
  const kws = convPromptHtml(e, resid);
  const badges = [];
  const shownText = e.kw === '*' ? null : convReadConds(resid).get(e.at);
  // A condition's note goes in the card once, in its badge, and not again
  // before each line under that condition.
  const seen = new Set();
  const condBadges = shownText ? shownText.slice(0, 3).map(c => convCondHtml(resid, c, seen)) : [];
  if (!shownText && e.conds.length) badges.push('depends on: ' + e.conds.map(dvmSyscallShown).join(', '));
  // A character helper (0xF00 up) the condition already reads through is
  // not repeated as a call.
  for (const a of e.actions) {
    if (shownText && a.call !== undefined && (a.call >> 8) === 0x0F) continue;
    const b = convBadgeFor(a); if (b) badges.push(b);
  }
  let html = '<div class="convCard' + (depth ? ' convSub' : '') + '" id="conv-' + resid + '-' + e.at + '">' +
    kws + condBadges.map(b => '<span class="convBadge">' + b + '</span>').join('') +
    badges.map(b => '<span class="convBadge">' + svEsc(b) + '</span>').join('') +
    convTextHtml(resid, e, seen);
  for (const s of e.sub) html += convCardHtml(resid, s, depth + 1);
  return html + '</div>';
}

/* A character's conversation, everything in one view: the person as the
   window shows them -- the portrait, the name, and the line the window
   opens with -- then every topic they answer, their own first and then each
   group they fall through to in the order the catch-all calls them (the
   engine's lookup), each group's topics that nobody earlier answers. A
   group topic the character or an earlier group already answers is not
   repeated; the group's heading shows how many. The catch-all's words
   come last, after the groups, which is when the engine reaches them. */
function convSpeakerHtml(resid, conv) {
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
    head = nm ? 'Generic <b>' + svEsc(nm) + '</b> topics that everyone who uses this group shares'
              : 'Generic prompts';
  } else {
    const chain = conv.groups.map(g =>
      '<button class="sv-chip" onclick="jumpToResource(' + g + ')">' +
      svEsc((window.SHOW_BUILTIN_LABELS && DIALOGUE_GROUP_NAMES[g]) || ('0x' + g.toString(16).toUpperCase())) + '</button>').join(' ');
    head = conv.entries.length + ' topic' + (conv.entries.length === 1 ? '' : 's') +
      ' read from the code' + (chain ? ' · generic topics: ' + chain : '');
  }
  let html = '<div class="convHead">' + head + '</div>' + dlgToolsHtml();
  if (subn !== 8) html += convSpeakerHtml(resid, conv);
  // The catch-all last, whatever order the chain tests it in.
  const ordered = conv.entries.filter(e => e.kw !== '*').concat(conv.entries.filter(e => e.kw === '*'));
  if (subn === 8) for (const e of ordered) html += convCardHtml(resid, e, 0);
  else html += convEverythingHtml(resid, conv, ordered);
  wrap.innerHTML = html;
  wrap.style.display = '';
  window.DLG_LAST = [renderConversationPane, data, subn, resid];
  dlgFilter();
  if (window.PENDING_CONV_WORD) {
    const hit = convFindEntry(conv.entries, window.PENDING_CONV_WORD);
    window.PENDING_CONV_WORD = null;
    if (hit) setTimeout(() => convScrollTo(resid, hit.at), 0);
  }
  return true;
}

/* Over a conversation or a script's lines: a filter and Edit Text (the
   maintainer, 17 October 2026). The filter shows only the lines, and the topics,
   containing every word typed, and a topic whose follow-up matches stays with
   it; it works on the drawn pane, so typing never redraws it. The edit
   links were on every line; they show only while Edit Text is on, which is
   kept for the session. */
window.DLG_EDIT = window.DLG_EDIT || false;
window.DLG_Q = window.DLG_Q || '';
function dlgToolsHtml() {
  return '<div class="dlgTools"><input type="search" class="dlgFilter" placeholder="Filter the lines" aria-label="filter the lines" value="' + svEsc(window.DLG_Q) + '" oninput="window.DLG_Q = this.value; dlgFilter()">' +
    '<button class="linkbtn dlgEditToggle" onclick="dlgEditToggle()">' + (window.DLG_EDIT ? 'Done Editing' : 'Edit Text') + '</button></div>';
}
function dlgEditToggle() {
  window.DLG_EDIT = !window.DLG_EDIT;
  const last = window.DLG_LAST;
  if (last) last[0](last[1], last[2], last[3]);
}
function dlgFilter() {
  const wrap = document.getElementById('dlgWrap');
  if (!wrap || !wrap.querySelectorAll) return;
  const words = String(window.DLG_Q || '').toLowerCase().split(/\s+/).filter(Boolean);
  const has = el => { const t = String(el.textContent || '').toLowerCase(); return words.every(w => t.indexOf(w) >= 0); };
  const cards = [...wrap.querySelectorAll('.convCard')].reverse();
  for (const c of cards) {
    if (!words.length) { c.hidden = false; continue; }
    const kidShown = [...(c.children || [])].some(k => k.classList && k.classList.contains('convCard') && !k.hidden);
    c.hidden = !(has(c) || kidShown);
  }
  // Lines outside a card (a script's strings, the greeting) by their text.
  for (const l of wrap.querySelectorAll('.dlgLine')) {
    if (l.closest && l.closest('.convCard')) { l.hidden = false; continue; }
    l.hidden = words.length > 0 && !has(l);
  }
}
/* A script's words, into #dlgWrap: the conversation's topic cards for a
   dialogue script, or its strings one to a line with an edit button each.
   Whether they are what is showing is up to paintDecodedPane; this only
   fills the pane, or empties it when there are none, and an empty pane is
   what removes the Text button from the row. */
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
  // Pascal fallback is stitched.
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
      const edit = i === 0 && window.DLG_EDIT
        ? ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + ln.offset + ')">edit</button>'
        : '';
      html += '<p class="dlgLine">' + tag + body + edit + '</p>';
    });
  }
  wrap.innerHTML = dlgToolsHtml() + html;
  window.DLG_LAST = [renderDialoguePane, data, subn, resid];
  dlgFilter();
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

// --- Editing ---------------------------------------------------------- The
// first edit path this page has ever had, and deliberately the narrowest one
// that is real end to end: hex-edit one resource's plaintext, rebuild the
// ENTIRE archive through writeDelverArchive (the writer that
// delv_write_check.mjs checks is byte-identical to delvmod's), and re-enter
// through parseArchiveBytes as if the rebuilt file had just been opened.
// Rebuilding wholesale instead of patching ARCHIVE.bytes in place costs ~none
// (a 5.6 MB archive re-serializes in milliseconds) and buys everything: every
// derived cache resets, every gallery and map redraws from the edited bytes,
// and the thing on screen is provably the thing a download produces -- there
// is no second, edited-but- unserialized state to drift.
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
    (dec.wasDecrypted ? ' (the file stores it encrypted and the rebuild encrypts it again)' : '') +
    '. The page ignores spaces and the length may change. Emptying it removes the ' +
    'resource from the file.';
  document.getElementById('editBytesWrap').style.display = '';
}

/* ---- Changing a script's code (24 September 2026) ------------------------
   New instructions, in the listing's notation, put in at an instruction of
   the raw listing -- the line last ringed, when there is one -- in place of
   the instructions up to "Take out up to", and the resource relinked round
   them (dvmAssemble, dvmRelink in js/delv-asm.js), which rejects an edit
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
  if (at === null) throw new Error('give the offset where the new code goes');
  // Both ends must be where an instruction starts, in one function.
  const fn = dvmExtents(b, resid).find(([st, en, kind]) => kind === 'function' && at >= st && at < en);
  if (!fn) throw new Error('0x' + at.toString(16).toUpperCase() + ' is not in a function');
  const starts = new Set(dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops.map(o => fn[0] + o[0]));
  starts.add(fn[1]);
  if (!starts.has(at)) throw new Error('0x' + at.toString(16).toUpperCase() + ' is not where an instruction starts');
  if (to !== null && (to < at || to > fn[1] || !starts.has(to))) throw new Error('0x' + to.toString(16).toUpperCase() + ' is not the start of an instruction after the first in the same function');
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
    ' (one per line as the raw listing prints them). The page inserts them at the offset given. They replace the instructions up to the second offset if there is one. The page adjusts every other offset in the resource around them. A label is a name followed by a colon on its own line. A jump to it reads "then -> name" or "branch name".';
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
    pre.textContent = (e.rl.delta >= 0 ? '+' : '') + e.rl.delta + ' bytes and ' + e.rl.moved + ' offsets moved. A + marks the new lines.\n\n' + lines.join('\n');
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
  if (!bytes) { setStatus('That is not hex. Enter pairs of 0–9 and a–f. The page ignores spaces and the count must be even.', true); return; }
  if (applyResourceEdit(currentResid, bytes)) cancelResourceEdit();
}

/* A resource the open file does not have, added: a tune brought in from a
   MIDI file under a new number (the maintainer, 24 October 2026, after the
   import could only replace a tune). With `encrypted` set the writer stores
   it enciphered, as the rest of its subindex is. It joins the edited set,
   so it is in the Patch in Progress, and a patch can add a resource the game file
   lacks (mergeDelverPatch). A number already in the file returns false,
   with the reason on the status line. */
function addResource(resid, data, encrypted) {
  const spec = delverArchiveSpec(ARCHIVE.bytes);
  if (!spec) { setStatus('The page could not read the open file again. The file is as it was.', true); return false; }
  if (spec.resources.some(r => r.resid === resid)) { setStatus('0x' + resid.toString(16).toUpperCase() + ' is already in the file.', true); return false; }
  spec.resources.push({ resid, data, encrypted: !!encrypted });
  const dirty = new Set(window.EDITED_RESIDS);
  dirty.add(resid);
  const name = window.ARCHIVE_SOURCE_NAME || 'archive';
  parseArchiveBytes(writeDelverArchive(spec), name, { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  refreshChangesBadge();
  showEditNotice(resid, 'added', dirty.size);
  return true;
}

function applyResourceEdit(resid, newData) {
  const spec = delverArchiveSpec(ARCHIVE.bytes);
  if (!spec) { setStatus('The page could not read the open file again after the change. Nothing changed.', true); return false; }
  const entry = spec.resources.find(r => r.resid === resid);
  if (!entry) { setStatus('0x' + resid.toString(16).toUpperCase() + ' is not in the file.', true); return false; }
  if (newData.length) entry.data = newData;
  else spec.resources.splice(spec.resources.indexOf(entry), 1);
  // resetDerivedCaches clears EDITED_RESIDS along with everything else keyed
  // to the open file -- correctly, since parseArchiveBytes is also how a
  // DIFFERENT archive is loaded. Copy the dirty list across this rebuild by
  // hand; it is user state, not a derived table.
  const dirty = new Set(window.EDITED_RESIDS);
  dirty.add(resid);
  const name = window.ARCHIVE_SOURCE_NAME || 'archive';
  parseArchiveBytes(writeDelverArchive(spec), name, { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  refreshChangesBadge();
  setStatus('Rebuilt the file with 0x' + resid.toString(16).toUpperCase() +
    (newData.length ? ' edited' : ' removed') + '. ' + dirty.size +
    ' resource(s) changed this session. Edits stay in the page’s memory only. The Patch in Progress in Tools › Patch Generator ' +
    'downloads the edited file.');
  showEditNotice(resid, newData.length ? 'edited' : 'removed', dirty.size);
  return true;
}
/* The status line lives in the Settings panel, so an edit made from a page
   showed where it went to nobody. This line under the top row shows it on the
   page, with the Patch in Progress a link (the Changes tab until 17 October 2026, the
   Patch Generator's section of that name until the 19th), and goes away by
   itself. */
let _editNoticeTimer = null;
function showEditNotice(resid, what, count) {
  const el = document.getElementById('editNotice');
  if (!el) return;
  el.innerHTML = '0x' + resid.toString(16).toUpperCase() + ' ' + what + ' in memory. ' + count + ' resource' + (count === 1 ? '' : 's') +
    ' changed this session. The ' + svLink('Patch in Progress', "showCategory('CHANGES')", 'is where to download it');
  el.style.display = '';
  if (_editNoticeTimer) clearTimeout(_editNoticeTimer);
  _editNoticeTimer = setTimeout(() => { el.style.display = 'none'; }, 15000);
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
  if (!raw) { setStatus('The page could not read prop list 0x' + propResid.toString(16).toUpperCase() + '.', true); return; }
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
    '<div class="inspDim">x and y are the location in the file. A prop in someone’s pack or inside something ' +
    'has its holder there and not a square. Apply rebuilds the whole file.</div>';
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
    if (v === null) { setStatus('The page cannot use that value for ' + k + '. Nothing changed.', true); return; }
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

/* The names on the exported disk, and the script that uses them.
   ==========================================================================

   These three constants are a contract with the retired mobile shell, which types the disk
   and the script's names at the emulated Finder to select them -- so they are
   named here rather than spelled inline, and `mobile_install_check.mjs`
   fails if the two pages stop matching on them.

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

     - `try ... end try` does not compile in this AppleScript. It needs the
       `on error` clause, and the error is "Expected "on" but found "end"".
     - `duplicate ... with replacing` does the replace with no confirmation,
       which is what makes this one step rather than an interactive one.
     - `display dialog` compiles, so the Dialogs scripting addition is there
       and the not-found case can show a message.

   The game is *found*, not named: the folder holding an application called
   "Cythera" is the one whose data is replaced, so this works whatever the
   disk is called and whatever version folder the game sits in. */
const DISK_VOLUME_NAME = 'Cythera Export';
const DISK_SCRIPT_NAME = 'Install and Play';
const DISK_ARCHIVE_NAME = 'Cythera Data';
/* A Delver scenario without its resource fork is not a scenario the game will
   open, and nothing about the file shows it until Cythera fails to open it.

   Measured, in the emulator, against the real 1.0.4 Cythera Data: with its
   1,247,331-byte fork the game starts; with the identical data fork and no
   resource fork it dies on launch with

       Sorry - there has been a fatal error:Unable to open RT

   -- which names nothing a person could connect back to this page. So the
   export states it here instead.

   The fork goes missing whenever the archive arrived without one: a bare
   `.data` file dropped or picked, a `?src=` pointing at one, or a remembered
   copy saved from either. A `.hqx`, MacBinary or AppleSingle has both,
   which is why index.html fetches the `.hqx` and not the data fork. */
function missingForkWarning(rsrc) {
  if (rsrc && rsrc.length) return null;
  return 'This file opened without its resource fork. The disk will not ' +
         'work in the game. Cythera rejects it with “Unable to open RT”. Open the ' +
         '.hqx (or a MacBinary copy) instead of the data fork alone and export again.';
}
