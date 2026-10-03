/* The rules, read out of the scripts and the executable: what the Mechanics, Skills, Spells and Barks sheets state.

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
   last of these. File 10 of 14. */

/* ---- Entities > Mechanics ---------------------------------------------------
   The rules the scripts imply, read out of them rather than listed. Two so
   far, both worked out on 5 September 2026: the talk balloons, and the dice
   game.
   Each section is built from the open archive on the spot, so a modded file
   shows its own words and its own rules or says that it has none.

   TALK BALLOONS. A character record has a field at 0x26, delvmod's
   `talk_balloon`; a script assigns a string to it and the engine draws the
   words over the character's head, in a 128x32 rounded balloon with a tail
   (TBark in the executable). The catalogue below is every `set_field
   talk_balloon` in every script, with the string that follows it, plus
   every call of the two tavern helpers 0xC84 and 0xC85, which take a list
   of shouts and a list of replies and pick one of each. A list is a `data`
   block the disassembler does not open, so its words are the printable runs
   of its bytes -- which is what they are, length-prefixed. Who says it is
   the character whose dialogue script it is in; a line in a shared or an
   object script is anyone's. */
function buildBarkCatalogue() {
  if (DERIVED.BARKS) return DERIVED.BARKS;
  const out = [];
  const runsOf = bytes => {
    const r = []; let cur = '';
    for (const b of bytes) { if (b >= 0x20 && b < 0x7F) cur += String.fromCharCode(b); else { if (cur.length >= 3) r.push(cur); cur = ''; } }
    if (cur.length >= 3) r.push(cur);
    return r;
  };
  if (!ARCHIVE) return (DERIVED.BARKS = out);
  for (let subn = 0; subn < 256; subn++) {
    const mi = ARCHIVE.index[subn];
    if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
    const count = subindexCount(ARCHIVE, subn);
    for (let ri = 0; ri < count; ri++) {
      const resid = ((subn + 1) << 8) | ri;
      let data;
      try {
        const raw = getResourceBytes(ARCHIVE, resid);
        if (!raw || !raw.length) continue;
        data = smartDecrypt(raw, resid).data;
        if (dvmNamedScript(data)) continue;
      } catch (e) { continue; }
      let disc;
      try { disc = dvmDiscover(data, resid); } catch (e) { continue; }
      if (disc.tableOffset === null) continue;
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (disc.kinds[off] !== 'function') continue;
        let end = data.length;
        for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops;
        try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        // The words in the data block at ops[k]. A block is 0x45, a 16-bit
        // length, then an array header 0x90 and a count, then one 4-byte
        // entry per element whose last two bytes are the offset, within the
        // resource, of a NUL-terminated string. Read that way the words come
        // out exact; a block of another shape falls back to its printable
        // runs, which is what they are minus the odd length byte.
        const dataWords = k => {
          const at = off + ops[k][0];
          const len = u16be(data, at + 1), body = at + 3;
          if (data[body] === 0x90 && body + 2 + data[body + 1] * 4 <= at + 3 + len) {
            const n = data[body + 1], words = [];
            for (let i = 0; i < n; i++) {
              const so = u16be(data, body + 2 + i * 4 + 2);
              if (so >= data.length) continue;
              let e = so; while (e < data.length && data[e] !== 0) e++;
              const w = decodeMacRoman(data.subarray(so, e));
              if (w) words.push(w);
            }
            if (words.length) return words;
          }
          return runsOf(data.subarray(at + 1, Math.min(data.length, at + 1 + 2 + len)));
        };
        const who = subn === 23 ? ri : null;
        for (let k = 0; k < ops.length; k++) {
          const [, depth, mn, txt] = ops[k];
          if (mn === 'set_field' && /talk_balloon/.test(String(txt))) {
            // The value is the first string after the target's `end`; a
            // list is a local set from a data block a little earlier.
            // The first operand is the character; the value is what comes
            // after that operand's `end`. A leaf target (arg, local) is one
            // op and an end; a cast is two.
            let words = null, how = 'says';
            for (let j = k + 2; j < Math.min(ops.length, k + 12); j++) {
              if (ops[j - 1][2] !== 'end') continue;
              if (ops[j][2] === 'string' || ops[j][2] === 'string(implicit)') { words = [JSON.parse(ops[j][3])]; break; }
              if (ops[j][2] === 'local') {
                for (let m = k; m >= Math.max(0, k - 60); m--) if (ops[m][2] === 'data') { words = dataWords(m); how = 'one of'; break; }
              }
              break;
            }
            if (words && words.length) out.push({ resid, who, how, words });
          } else if (mn === 'call_resource' && /0xC8[45]\b|\(0xC8[45]\)/i.test(String(txt))) {
            const lists = [];
            for (let j = k + 1; j < ops.length; j++) {
              if (ops[j][1] <= depth && ops[j][2] === 'end') break;
              if (ops[j][2] === 'data') lists.push(dataWords(j));
            }
            if (lists[0] && lists[0].length) out.push({ resid, who, how: 'one of', words: lists[0], then: lists[1] || null,
              helper: /C84/i.test(String(txt)) ? 'wine' : 'food' });
          }
        }
      }
    }
  }
  return (DERIVED.BARKS = out);
}

/* THE DICE GAME. Innkeepers offer it (Parium, Crito, Apis: "a game of
   @dice"), and the game is one function in the inn's shared dialogue,
   0x812. The rules below are read from that function, and the section
   quotes the innkeeper's own explanation from the same script beside them,
   so the two can be compared. The expected value is enumerated here over
   all 216 rolls, with and without the Gambling skill (0xCF). */
/* The dice game, with its numbers read off the script rather than typed
   in. The maintainer asked what to edit to change the odds, and the answer
   is five bytes and two branch targets of 0x812, all found here from the
   listing so the sheet can name them: the three Random(0, n) ranges the
   dice are thrown with (the operand byte after each `byte 0x06`), the
   skill's own roll, the payout after "You've got a match" (`set_local 0x06`
   then `byte 0x02`), and the two `then ->` targets that gate the skill's
   fix-up -- the first on having Gambling at all, the second on the roll
   matching. A target rewritten to the next instruction turns a test into
   a fall-through, which is how "always" is spelt in bytecode. An `at` is
   an offset into the resource's plaintext, which is what Edit Bytes shows.
   The figures come from mechDiceExact over the numbers read, so an edited
   archive's sheet says what that archive pays. */
function diceGame() {
  const R = 0x812;
  const e = dvmScriptEntry(R);
  if (!e || !/three dice/.test(e.text)) return null;
  const m = /string\(implicit\) ("\\"It's very simple[^\n]*)/.exec(e.text);
  let explain = '';
  try { explain = m ? JSON.parse(m[1]) : ''; } catch (err) { explain = ''; }
  const ops = dvmOpsOf(e);
  const hex4 = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  // Every Random(0, n) in the script, with the op that holds the n. A
  // byte's operand is the byte after its opcode, which is what Edit Bytes
  // writes at; the link goes to the instruction.
  const rolls = dvmSeqAll(ops, [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM]).map(g => ({ i: ops.indexOf(g[0]), val: dvmVal(R, g[2]) }));
  // The Gambling question is GetSkill of skill 0xCF.
  const g = ops.findIndex((o, i) => o.text === 'sys GetSkill' && ops[i + 2] && /^short (?:0x00CF|207)$/i.test(ops[i + 2].text));
  const before = rolls.filter(r => g < 0 || r.i < g).slice(-3);
  const after = g < 0 ? null : rolls.find(r => r.i > g) || null;
  if (before.length < 3) return null;
  const faces = before.map(r => r.val.v);
  const byte = (what, val) => ({ what, at: val.at + 1, now: val.v, val });
  const bytes = [
    byte('faces on the innkeeper’s first die', before[0].val),
    byte('faces on your die', before[1].val),
    byte('faces on the innkeeper’s second die', before[2].val)
  ];
  // The branch that needs the skill: `then -> T` after GetSkill's `end`.
  // T equal to the next instruction's offset means no skill is needed.
  let skillFree = false, skillAlways = false;
  const branch = (from, span) => {
    for (let k = from; k < Math.min(ops.length - 1, from + span); k++) {
      const t = /^then -> (0x[0-9A-F]+)$/.exec(ops[k].text);
      if (t) return { k, target: parseInt(t[1]) };
    }
    return null;
  };
  if (g >= 0) {
    const b = branch(g, 6);
    if (b) {
      skillFree = b.target === ops[b.k + 1].at;
      bytes.push({ what: 'the test for the Gambling skill', at: ops[b.k].at + 1, now: hex4(b.target), target: true, next: ops[b.k + 1].at, val: { v: b.target, resid: R, at: ops[b.k].at } });
    }
  }
  if (after) {
    bytes.push(byte('faces on the skill’s roll', after.val));
    // `if_not (Random == Var03) then -> T`, then `set_local 0x04`: T equal
    // to the set_local's offset means the fix-up runs whatever was rolled.
    const b = branch(after.i, 8);
    if (b) {
      const set = ops.slice(b.k + 1, b.k + 3).find(o => o.text === 'set_local 0x04');
      skillAlways = !!set && b.target === set.at;
      bytes.push({ what: 'the test that the skill’s roll matched', at: ops[b.k].at + 1, now: hex4(b.target), target: true, next: set ? set.at : null, val: { v: b.target, resid: R, at: ops[b.k].at } });
    }
  }
  // What a match pays: the number set into local 6 after the line that
  // announces it. No figure is supplied when it is not found; the game is
  // not modelled from a guess.
  const mi = ops.findIndex(o => /You've got a match/.test(o.text));
  const pay = mi < 0 ? null : dvmSeqFirst(ops.slice(mi, mi + 6), [/^set_local 0x06$/, DVM_NUM]);
  if (!pay) return null;
  const matchPay = dvmVal(R, pay[1]);
  bytes.push(byte('what a match pays', matchPay));
  const opts = { faces, matchPay: matchPay.v, skillFaces: after ? after.val.v : null, skillAlways };
  const plain = mechDiceExact(opts), skilled = mechDiceExact(Object.assign({ gambling: true }, opts));
  const total = plain.total;
  return { explain, faces, matchPay: matchPay.v, skillFaces: opts.skillFaces, skillAlways, skillFree, total, bytes, opts,
           vals: { faces: before.map(r => r.val), matchPay, skillFaces: after ? after.val : null },
           fair: plain.mean, skilled: skilled.mean,
           wins: Math.round(plain.wins * total), pushes: Math.round(plain.pushes * total), losses: Math.round(plain.losses * total) };
}
// The script's numbers for the simulator and the figures, {} when there is
// no game in the archive.
function diceOpts() { try { return (diceGame() || {}).opts || {}; } catch (e) { return {}; } }

/* ---- Components > Text > Barks ------------------------------------------
   The catalogue buildBarkCatalogue makes, as a table: who says it, the
   words, and the script it is in. A person is a chip to their dossier; a
   line in a shared or an object script is anyone's and is a chip to the
   script. The rule the lines obey is under Entities > Mechanics. */
/* ---------------------------------------------------------------------------
   Entities > Skills and Entities > Spells: each one a unit.

   The 0x1A00 block holds the spells (0x1A00-0x1A30) and, from 0x1AC0, the
   skills (Attack to Thievery) and the Do menu's commands (Estimate Time to
   Pass). A gallery of those resources was a row of script icons under
   subindex headings, which the maintainer found no way to read a skill from.
   Each card here gathers what the file says about the one thing: its own
   description (the script's text, with the game's inline "aptitude /
   training" alternative shown as one), the lines a teacher says lesson by
   lesson, who teaches it, which scripts ask whether you have it, the weapons
   swung with it, and the rule on the Mechanics sheet it takes part in.
   Spells the same way: level, cost, what it does to health, the status it
   applies. Nothing here is typed in; it is all read on the spot.
--------------------------------------------------------------------------- */
function dvmCleanText(t) {
  // The game's inline codes: 0x10 opens an alternative, 0x02+letter marks
  // each branch; the rest is style bytes. "[aptitude / training]" keeps
  // both branches visible, since which the player sees depends on level.
  let x = String(t || '');
  // The renderer writes control bytes as \uXXXX; put them back first.
  x = x.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  x = x.replace(/\x10[^\x02]*\x02.([^\x02]*)\x02.(\S+)/g, '[$1 / $2]');
  x = x.replace(/.?0b\x03A/g, '');            // a style code: printable bytes around a control
  x = x.replace(/[^\x20-\x7E\n‘’“”—–]/g, '');
  x = x.replace(/\\+$/, '').replace(/\s*A$/, '').trim();
  return x;
}
// The description a skill or spell script returns: the strings of the
// function whose first string starts "This skill" / "This spell", or the
// one data string that does.
function dvmDescriptionOf(resid) {
  const e = buildScriptTextIndex().find(x => x.resid === resid);
  if (!e) return '';
  const ls = e.text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, '')).filter(Boolean);
  for (let i = 0; i < ls.length; i++) {
    const m = /^(?:string(?:\(implicit\))?|obj_[0-9A-F]+ =) "((?:This (?:skill|spell))[^"]*)"/.exec(ls[i]);
    if (!m) continue;
    if (/^obj_/.test(ls[i])) return dvmCleanText(m[1].replace(/\\n/g, ' '));
    const parts = [m[1]];
    let alt = null;   // the string after a 0x10, waiting for the string it is an alternative to
    for (let j = i + 1; j < ls.length; j++) {
      const l = ls[j];
      if (/^byte (?:0x10|16)$/.test(l)) { alt = ''; continue; }
      const sm = /^string(?:\(implicit\))? "([^"]*)"/.exec(l);
      if (sm) {
        if (alt === '') { alt = sm[1]; continue; }
        if (alt) {
          // "[aptitude / ability] to use a sword": the alternative is to the
          // first word of what follows, and the rest of it is common
          const w = /^(\S+)([\s\S]*)$/.exec(sm[1]) || [null, sm[1], ''];
          parts.push('[' + alt + ' / ' + w[1] + ']' + w[2]); alt = null; continue;
        }
        parts.push(sm[1]); continue;
      }
      if (/^(byte 0x00|end|\}|return)/.test(l)) break;
    }
    if (alt) parts.push('[' + alt + ']');
    return dvmCleanText(parts.join('').replace(/\\n/g, ' '));
  }
  return '';
}
// The other quoted strings of a skill script, in order: what a teacher says
// at each lesson, "*"-separated in the file, here as one line a lesson.
function dvmLessonLines(resid) {
  const e = buildScriptTextIndex().find(x => x.resid === resid);
  if (!e) return [];
  const out = [];
  for (const m of e.text.matchAll(/obj_[0-9A-F]+ = "((?:[^"\\]|\\.)*)"/g)) {
    const t = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    if (/^This (?:skill|spell)/.test(t) || t === '*' || !t.trim()) continue;
    out.push(dvmCleanText(t));
  }
  return out;
}
const SKILL_KINDS = [[0x1AC0, 0x1AC3, 'attribute'], [0x1AC4, 0x1AC9, 'weapon'], [0x1ACA, 0x1AEF, 'special'], [0x1AF0, 0x1AFF, 'command']];
function skillKind(resid) { const k = SKILL_KINDS.find(k => resid >= k[0] && resid <= k[1]); return k ? k[2] : 'skill'; }
// Which Mechanics section a skill takes part in, by what its rule is read from.
const SKILL_RULES = { Attack: 'combat', Defense: 'combat', Sword: 'combat', Axe: 'combat', Mace: 'combat', Barehand: 'combat', Missile: 'combat', Shield: 'combat',
  Mana: 'experience', Casting: 'spells', Gambling: 'dice', Haggling: 'shops', 'Lock Picking': 'locks' };
function skillCatalogue() {
  const out = [];
  const tr = trainingRules(), sk = skillConsultations(), gear = gearTable();
  for (let r = 0x1AC0; r < 0x1B00; r++) {
    if (!refExists(r)) continue;
    const name = selfNameFor(r) || ('0x' + r.toString(16).toUpperCase());
    const id = r - 0x1A00;
    out.push({ resid: r, id, name, kind: skillKind(r),
      description: dvmDescriptionOf(r),
      lessons: dvmLessonLines(r),
      teachers: tr.teachers.filter(t => t.skills.has(id)).map(t => ({ who: t.who, resid: t.resid, mastery: !!t.skills.get(id) })),
      askedBy: [...(sk.by.get(id) || [])].sort((a, b) => a - b),
      weapons: gear.filter(g => g.skill === name) });
  }
  return out;
}
/* A link to a rules section, wherever that section's tab now is.

   Every one of these named MECHANICS until 14 September 2026, when the sheet
   became seven tabs. The id is still the target -- mechGo resolves
   `mech-<id>` -- so the only thing that had to change is which category is
   opened first, and mechGroupOf answers that off MECH_GROUPS rather than from
   a second table that could drift from it. */
function mechLink(id, label) {
  const g = mechGroupOf(id);
  const v = g ? g.value : MECH_GROUPS[0].value;
  return '<button class="navChip" onclick="showCategory(\'' + v + '\'); setTimeout(function(){ mechGo(\'' + id + '\'); }, 60)">' + svEsc(label) + '</button>';
}
/* The picture a skill or a spell wears in the game. Subindex 137 is one
   32x16 icon per class in subindex 25: icon n belongs to class 0x1A00|n,
   the same join skillNameForIcon makes the other way. Drawn once into a
   data URL per resource, like the relation chips' tile icons, and dropped
   with the other archive-keyed caches. A class with no icon gets the tab's
   own tile, so a card never goes without a picture. */
const _skillIconURLs = derivedMap('_skillIconURLs');
function skillIconURL(resid) {
  const icon = 0x8A00 | (resid & 0xFF);
  if (_skillIconURLs.has(icon)) return _skillIconURLs.get(icon);
  let url = '';
  try {
    const raw = refExists(icon) ? getResourceBytes(ARCHIVE, icon) : null;
    const dec = raw ? decodeResource(ARCHIVE, raw, 137, icon) : null;
    if (dec && dec.W) {
      const c = document.createElement('canvas');
      drawToCanvas(c, dec.W, dec.H, dec.image, 0);
      url = c.toDataURL('image/png');
    }
  } catch (e) { url = ''; }
  _skillIconURLs.set(icon, url);
  return url;
}
function skillIconHTML(resid, tabId) {
  const url = skillIconURL(resid);
  if (url) return '<img class="skillIcon" src="' + url + '" alt="" width="32" height="16">';
  // No icon where the file has none: the tab's tile stood in until 9
  // September 2026, and it meant nothing about the skill.
  return '';
}
/* A card on the Skills, Spells and Mechanics sheets is a <details>: the
   head is its summary and the rest opens under it. They open closed, a
   filter opens what it matched, and a link into one (mechGo) opens it
   before scrolling. The chips in a head are buttons of their own, and a
   click on one runs the chip and not the toggle. */
function foldCard(id, cls, open) {
  const sec = document.createElement('details');
  sec.className = cls ? 'mechSec ' + cls : 'mechSec';
  sec.id = id;
  if (open) sec.open = true;
  return sec;
}
function renderSkillsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const all = skillCatalogue();
  const shown = all.filter(x => !q || x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
  const box = document.createElement('div');
  box.className = 'mechView';
  // What a script asks about a skill, above the skills it asks about. This
  // was a section of the Mechanics sheet until 13 September 2026.
  try { box.appendChild(skillsMechSection()); } catch (e) { quiet(e); }
  const kinds = [['attribute', 'Attributes', 'The four figures every character has.'],
                 ['weapon', 'Weapon Skills', 'One for each kind of weapon.'],
                 ['special', 'Special Skills', 'Learned from a teacher.'],
                 ['command', 'Commands', 'The Do menu. Each command is a name and a script.']];
  const propChip = (pt, name) => '<button class="relChip" onclick="showPropTypeDetail(' + pt + ')"><span class="relText"><span class="relMain">' + svEsc(name) + '</span></span></button>';
  let count = 0;
  for (const [kind, title, note] of kinds) {
    const list = shown.filter(x => x.kind === kind);
    if (!list.length) continue;
    const h = document.createElement('div'); h.className = 'propHead'; h.innerHTML = '<span class="groupTitle">' + svEsc(title) + '</span><span class="groupNote">' + svEsc(note) + '</span>';
    box.appendChild(h);
    if (kind === 'command') {
      // A command has no lessons, no teacher and no description: a fold
      // would open on nothing, so they are one line of names.
      count += list.length;
      const d = document.createElement('div'); d.className = 'mechLede';
      d.innerHTML = list.map(x => partChip(x.name, x.resid)).join(', ');
      box.appendChild(d);
      continue;
    }
    for (const x of list) {
      count++;
      const sec = foldCard('skill-' + x.resid.toString(16), 'skillCard', !!q);
      const head = document.createElement('summary'); head.className = 'mechHead';
      head.innerHTML = skillIconHTML(x.resid, 'skills') + '<h3>' + svEsc(x.name) + '</h3><span class="mechFrom">' + partChip('the script', x.resid) + '</span>';
      sec.appendChild(head);
      if (x.description) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = svEsc(x.description); sec.appendChild(p); }
      const rows = [];
      if (kind !== 'command') {
        rows.push(['Taught by', x.teachers.length ? x.teachers.map(t => (t.who !== null && loadCharacterTable()[t.who] ? characterChip(t.who) : svChip(t.resid)) + (t.mastery ? ' <span class="inspDim">to mastery</span>' : '')).join(' ') : '<span class="inspDim">no teacher in this file</span>']);
        if (x.askedBy.length) rows.push(['Asked about by', x.askedBy.map(r => svChip(r)).join(' ')]);
        if (x.weapons.length) rows.push(['Swung with it', x.weapons.map(w => propChip(w.pt, w.name)).join(' ')]);
        const rule = SKILL_RULES[x.name];
        rows.push(['The rule', (rule ? ruleLink(rule) + ' ' : '') + mechLink('training', 'Mechanics › Training')]);
      }
      if (rows.length) {
        const d = document.createElement('div'); d.className = 'mechBody';
        d.innerHTML = '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><tbody>' + rows.map(r => '<tr><td class="skillKey">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table></div>';
        sec.appendChild(d);
      }
      // What it is made of, beside what it does. The script is already named
      // on the summary, so the strip carries the icon it wears.
      {
        const chips = skillSpellParts(x.resid);
        if (chips.length) { const p = document.createElement('div'); p.innerHTML = linksFold(partsStrip('Made of', chips)); sec.appendChild(p); }
      }
      if (x.lessons.length) {
        const sub = document.createElement('div'); sub.className = 'mechSub'; sub.textContent = kind === 'command' ? 'What it says' : 'What a teacher says, lesson by lesson';
        sec.appendChild(sub);
        const ol = document.createElement('ol'); ol.className = 'ruleList lessonList';
        ol.innerHTML = x.lessons.map(l => '<li>' + svEsc(l) + '</li>').join('');
        sec.appendChild(ol);
      }
      box.appendChild(sec);
    }
  }
  grid.appendChild(box);
  out.textContent = count + ' of ' + all.length + ' in the file’s skill block' + (q ? ' matching “' + q + '”' : '') + '.';
}
/* SCHEDULES. The table 0xF00B, one list per character: an hour, a byte the
   engine copies into the character's `behavior` field, a script id, a zone
   and a square. The dossier shows one character's day; this sheet shows
   everybody's, a folding card each, and every square opens the zone there.
   The behaviour byte is shown as it is stored: the scripts test it against
   small numbers (0xEA3 asks for 4, 6 and 7), and most entries are 128 or
   more. 0x80 is not a flag on a small number: TActiveMonster::DoMove
   switches on the whole byte through a table of 171 cases, and 128 to 170
   have handlers of their own, distinct from 0 to 42 (read 1 October 2026);
   the Look helper names some of them (144 working, 145 sleeping). The
   script field is nearly always 0; the few that are not name a resource. */
/* ---- who ScheduleTime schedules, read off the routine ----------------------
   Each hour ScheduleTime walks the 256 character records, 32 bytes each,
   and runs ScheduleOne for a character unless one of four tests says not
   to: bit 0x40 of byte 8 is set (JoinParty sets it; the InParty helper
   tests it), bit 1 of the halfword at byte 6 is clear (what a script's
   test of status_flags for being alive reads), byte 22 -- the behaviour --
   is 112, or TActiveMonster::GetCharacter finds an active monster for the
   character whose word at 28 is not zero. Read here as the loads through
   the table register at a displacement from the record and the test that
   follows each, and the load after the call; nothing is typed but the
   shapes. 112 is the behaviour the Wait command and a companion's "wait"
   answer set and "Follow" lifts (behaviorSetSites), which is why a
   companion told to wait stays where they stood: the hour does not move
   them. The active monster's word at 28 is its current target, a pointer
   to another TActiveMonster (read 1 October 2026): DoAttack does nothing
   while it is 0 and otherwise loads the target's record through it, and
   DoDefend stores the attacker there before striking back; so the hour
   leaves anyone in a fight where they are. Null with no application open
   or when the shape is not found. */
function exeScheduleWho() {
  const ops = exeOpsNamed('ScheduleTime');
  if (!ops.length) return null;
  const out = {};
  for (let i = 0; i + 1 < ops.length; i++) {
    const d = ops[i].d, n = ops[i + 1].d;
    if (!d || !n) continue;
    if ((d.mn === 'lbzx' || d.mn === 'lhzx') && out.monsterWord === undefined) {
      const add = exeFindBack(ops, i, 2, e => e.mn === 'addi' && e.imm !== undefined);
      if (add < 0) continue;
      const byte = exeVal(ops[add], ops[add].d.imm);
      if (n.mn === 'rlwinm.' && n.sh === 0 && n.mb === n.me && !out.partyBit) out.partyBit = { byte, bit: exeVal(ops[i + 1], 1 << (31 - n.mb)) };
      else if (n.mn === 'clrlwi.' && !out.aliveBit) out.aliveBit = { byte, mask: exeVal(ops[i + 1], (1 << (32 - n.mb)) - 1) };
      else if (n.mn === 'cmplwi' && !out.waiting) out.waiting = { byte, value: exeVal(ops[i + 1], n.imm) };
    }
    if (d.mn === 'bl' && exeCalls(ops[i], 'TActiveMonster::GetCharacter')) {
      const lw = exeFind(ops, i + 1, 6, e => e.mn === 'lwz' && e.ra !== 1 && e.ra !== 2);
      if (lw >= 0) out.monsterWord = { call: exeVal(ops[i], 'TActiveMonster::GetCharacter'), disp: exeVal(ops[lw], ops[lw].d.d) };
    }
  }
  return out.partyBit && out.aliveBit && out.waiting && out.monsterWord ? out : null;
}
/* WHAT EACH BEHAVIOUR DOES, off the program (2 October 2026; the whole
   reading is the workbench's doc/behaviours.md). TActiveMonster::DoMove
   switches on a character's behaviour, byte 22 of its record (or the kind
   of the task at the front of its queue), through a jump table beside the
   TOC whose bound is the larger of the routine's two tables (the other,
   bounded at 10, is the task kinds 160 to 170). Each case's handler runs to
   the next handler's address; what it does is read off what it calls, by
   the routines' own names, and the wait it stores into the record's byte
   18 (`li`, then `stb` at 18). The words for each routine are this
   reading's, as the movement rules' kinds are; the routines, the waits and
   the instructions are the program's. A value past the table, or a case
   that lands on the default, does nothing of its own, except 176 to 255,
   which the default hands to PerformAI as a combat program. Null with no
   application open. */
function exeBehaviours() {
  if (!appImage()) return null;
  if (DERIVED.BEHAVIOURS !== undefined) return DERIVED.BEHAVIOURS;
  let out = null;
  try {
    const ops = exeOpsNamed('TActiveMonster::DoMove'), img = appImage();
    let jt = null;
    for (let from = 0, t; (t = exeJumpTable(ops, from)); from = t.at + 1)
      if (t.bound >= 0 && (!jt || ops[t.bound].d.imm > ops[jt.bound].d.imm)) jt = t;
    if (jt && ops[jt.bound].d.imm >= 128) {
      const count = ops[jt.bound].d.imm + 1, off = exeTocOffset(ops[jt.at].d.imm);
      const after = ops[jt.bound + 1];
      const dflt = after && after.d && after.d.conditional ? after.to : null;
      const starts = [];
      for (let v = 0; v < count; v++) {
        let p = null;
        try { p = pefPointerAt(img, img.toc.section, off + 4 * v); } catch (e) { quiet(e); }
        starts.push(p && p.section === img.codeIndex ? p.offset : null);
      }
      const bounds = [...new Set(starts.concat(dflt).filter(s => s !== null))].sort((a, b) => a - b);
      const index = a => ops.findIndex(o => o.at === a);
      const read = at => {
        const i = index(at), next = bounds.find(b => b > at), j = next !== undefined ? index(next) : ops.length;
        const body = i >= 0 ? ops.slice(i, j < 0 ? ops.length : j) : [];
        const calls = body.filter(o => o.mn === 'bl').map(o => exeTargetName(o.to).replace(/\(.*$/, ''));
        const storeOf = disp => {
          const k = body.findIndex(o => o.d && o.d.mn === 'stb' && o.d.d === disp && o.d.ra !== 1);
          const l = k >= 0 ? body.slice(0, k).reverse().find(o => o.d && o.d.mn === 'li' && o.d.rd === body[k].d.rt) : null;
          return l ? exeVal(l, l.d.imm) : null;
        };
        // A facing: the direction in r5 for the indirect call (AdjustAspect
        // through the object's table) that follows it, with 1 in r4.
        const faceAt = body.findIndex((o, k) => o.d && o.d.mn === 'li' && o.d.rd === 5 && o.d.imm >= 0 && o.d.imm <= 3 &&
          // the call through r12, the shape of a call through a table
          body.slice(k + 1, k + 8).some(x => x.d && x.d.mn === 'lwz' && x.d.rt === 12 && x.d.ra === 12) &&
          body.slice(k + 1, k + 8).some(x => x.mn === 'bl') &&
          body.slice(Math.max(0, k - 6), k).some(x => x.d && x.d.mn === 'li' && x.d.rd === 4 && x.d.imm === 1));
        return { at: exeVal(body[0] || null, null), calls, wait: storeOf(18), food: storeOf(27),
                 face: !calls.some(c => /^TActiveMonster::|^TGameSys::|^TPathFinder::/.test(c)) && faceAt >= 0 ? body[faceAt].d.imm : null };
      };
      const byStart = new Map();
      out = { count, dflt, cases: starts.map(s => {
        if (s === null || s === dflt) return null;
        if (!byStart.has(s)) byStart.set(s, read(s));
        return byStart.get(s);
      }) };
    }
  } catch (e) { quiet(e, 'the behaviors, off DoMove'); }
  return (DERIVED.BEHAVIOURS = out);
}
// What behaviour v does, in this page's words for the routines its
// handler calls; null where the program is not open.
function behaviourDoes(v) {
  const b = exeBehaviours();
  if (!b) return null;
  if (v >= 176 && v <= 255) return { does: 'fights by combat program ' + v, at: null };
  const c = v < b.count ? b.cases[v] : null;
  if (!c) return { does: 'nothing of its own', at: null };
  const has = n => c.calls.some(x => x === n);
  const fight = has('PerformAI__FP14TActiveMonsters') || c.calls.some(x => /PerformAI/.test(x));
  let does;
  if (has('TGameSys::TalkCommand')) does = 'comes to the party leader and talks';
  else if (has('TPathFinder::FindPath') && has('TActiveMonster::GetCharacter')) does = 'follows the party leader';
  else if (has('TActiveMonster::FindStrongest')) does = 'fights, attacking the strongest';
  else if (has('TActiveMonster::FindWeakest')) does = 'fights, attacking the weakest';
  else if (has('TActiveMonster::FindNearest')) does = 'fights, attacking the nearest';
  else if (has('TActiveMonster::DoDefend')) does = 'fights, defending';
  else if (has('TActiveMonster::DoRetreat')) does = 'retreats';
  else if (has('TActiveMonster::DoAttack')) does = fight ? 'fights' : 'attacks its target';
  else if (has('ScheduleOne')) does = 'goes back to its usual behavior';
  else if (has('TActiveMonster::DoRoam')) does = 'wanders';
  else if (has('TActiveMonster::PaceNS') && c.calls.some(x => /Random/.test(x))) does = 'paces north and south, now and then turning';
  else if (has('TActiveMonster::PaceNS')) does = 'paces north and south';
  else if (has('TActiveMonster::PaceEW')) does = 'paces east and west';
  else if (has('TActiveMonster::SetWaypoint')) does = 'walks to a place';
  else if (has('TActiveMonster::GoTowards')) does = 'steps toward a thing';
  else if (c.face !== null) does = 'stands facing ' + ['north', 'east', 'south', 'west'][c.face];
  else if (c.food) does = 'eats';
  else if (c.wait) does = 'stands still';
  else does = 'nothing of its own';
  return { does, at: c.at, wait: c.wait };
}
// A behaviour's words as a sheet shows them: the game's own word for it
// (dvmBehaviourWords) or else what the handler does; the other, and the
// wait, in the title. Empty when neither is known.
function behaviourWordHTML(v) {
  let word = null;
  try { word = ARCHIVE && refExists(0x3007) ? dvmBehaviourWords(ARCHIVE).get(v) : null; } catch (e) { quiet(e); }
  const d = behaviourDoes(v);
  const shown = word || (d && d.does);
  const title = [word && d ? d.does : null, d && d.wait ? 'waits ' + d.wait.v + ' between turns' : null].filter(Boolean).join(', ');
  return shown ? '<span' + (title ? ' title="' + svEsc(title) + '"' : '') + '>' + svEsc(shown) + '</span>' : '';
}
// The number too, linked to its handler where the program is open.
function behaviourHTML(v) {
  const d = behaviourDoes(v), w = behaviourWordHTML(v);
  return (d && d.at ? srcNum({ v, exe: d.at.exe }, String(v)) : svEsc(String(v))) + (w ? ' ' + w : '');
}
// Every script site that sets a character's behaviour to `value`: a
// set_field of the behaviour key followed, within its operands, by that
// number. One site a script, the first.
function behaviorSetSites(value) {
  const cache = DERIVED.BEHAVIOR_SET || (DERIVED.BEHAVIOR_SET = {});
  if (cache[value]) return cache[value];
  const out = [], seen = new Set();
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i < ops.length; i++) {
      if (!/^set_field behavior\b/.test(ops[i].text) || seen.has(e.resid)) continue;
      for (let k = i + 1; k < Math.min(ops.length, i + 6); k++) {
        const m = /^(?:byte|short) (0x[0-9A-F]+|\d+)$/.exec(ops[k].text);
        if (m && parseInt(m[1], m[1].startsWith('0x') ? 16 : 10) === value) { out.push({ resid: e.resid, at: ops[i].at }); seen.add(e.resid); break; }
      }
    }
  }
  return (cache[value] = out);
}

function renderSchedulesSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const scheds = loadSchedules();
  const box = document.createElement('div');
  box.className = 'mechView';
  // Who is scheduled at all, read off ScheduleTime (exeScheduleWho); with
  // no application open the sheet says where the rule comes from and
  // states none of it.
  {
    const who = appImage() ? exeScheduleWho() : null;
    const lede = document.createElement('p');
    lede.className = 'mechLede';
    if (who) {
      const waits = behaviorSetSites(who.waiting.value.v);
      lede.innerHTML = 'Each hour, everyone goes to their next place except ' + srcNum(who.partyBit.bit, 'the party') + ', ' +
        srcNum(who.aliveBit.mask, 'the dead') + ', companions ' + srcNum(who.waiting.value, 'told to wait') +
        (waits.length ? ' (by ' + waits.map(w => srcNum({ resid: w.resid, at: w.at }, labelFor(w.resid) || propWordHex(w.resid))).join(', ') + ')' : '') +
        ', and anyone ' + srcNum(who.monsterWord.disp, 'in a fight') + '. ' + pefChip('ScheduleTime');
    } else lede.innerHTML = 'The program is not open, so the page cannot show who each hour skips. The days below come from the file.';
    box.appendChild(lede);
  }
  const ampm = h => h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
  const people = [];
  for (let i = 0; i < scheds.length; i++) {
    // A post with a behaviour, or a segment that is part of the program:
    // a condition, a stop, or a place off every map (level 255).
    const real = scheds[i].filter(e => e.mode !== 0 || e.cond !== 0);
    if (!real.length) continue;
    const name = characterName(i) || ('Character ' + i);
    if (q && !name.toLowerCase().includes(q)) continue;
    people.push({ i, name, real });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  let entries = 0;
  for (const p of people) {
    entries += p.real.length;
    const sec = foldCard('sched-' + p.i, 'skillCard', !!q);
    const head = document.createElement('summary'); head.className = 'mechHead';
    head.innerHTML = '<h3>' + svEsc(p.name) + '</h3><span class="foldGist">' + p.real.length + ' post' + (p.real.length === 1 ? '' : 's') +
      ', ' + [...new Set(p.real.filter(e => e.level !== 255 && !(scheduleCondition(e) || {}).stop).map(e => zoneDisplayName(e.level)))].slice(0, 3).map(svEsc).join(', ') + '</span>' +
      '<span class="mechFrom">' + characterChip(p.i, true) + '</span>';
    sec.appendChild(head);
    // A day with no conditions reads by the clock; a program keeps the
    // file's order, which is the order the game tests it in.
    const programmed = p.real.some(e => e.cond);
    const rows = (programmed ? p.real : p.real.slice().sort((a, b) => a.hour - b.hour)).map(e => {
      const c = scheduleCondition(e);
      if (c && c.stop) return '<tr><td></td><td colspan="3" class="inspDim">' + svEsc(c.text) + '</td></tr>';
      if (scheduleIsHead(e)) return '<tr><td></td><td colspan="3">' + svEsc((c ? c.text : 'always') + ', the posts below up to the matching stop; otherwise skip them') + '</td></tr>';
      const where = e.level === 255 ? '<span class="inspDim">off every map</span>'
        : svLink(zoneDisplayName(e.level) || ('zone ' + e.level), 'atlasOpenSquare(' + (0x8000 + e.level) + ',' + e.x + ',' + e.y + ')', e.x + ', ' + e.y);
      return '<tr><td class="num">' + ampm(e.hour) + '</td><td>' + where + '</td><td>' + (c ? svEsc(c.text) : '') + '</td>' +
        '<td>' + behaviourHTML(e.mode) + '</td></tr>';
    }).join('');
    const d = document.createElement('div'); d.className = 'mechBody';
    d.innerHTML = '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th class="num">from</th><th>where</th><th>when</th><th>behavior</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    sec.appendChild(d);
    box.appendChild(sec);
  }
  const all = document.createElement('div');
  all.className = 'foldAll';
  all.innerHTML = svLink('Open all', 'mechOpenAll(true)') + svLink('Close all', 'mechOpenAll(false)');
  box.insertBefore(all, box.firstChild);
  grid.appendChild(box);
  out.textContent = people.length + ' characters with a day in 0xF00B, ' + entries + ' posts' + (q ? ' matching “' + q + '”' : '') + '. A post applies from its hour until the next one. A post with a condition is an alternative the game uses when the condition is met, checked in the order listed. The square opens the zone at that point.';
}
/* A SCHEDULE IS A PROGRAM (read 24 September 2026). ScheduleOne walks a
   character's segments in the file's order and EvalCondition tests each
   segment's condition byte against its argument byte: the first segment
   that passes is taken, a later passing one replaces it once its hour has
   come, and a segment of condition 1 ends the walk once one has been taken.
   ScheduleTime runs it for every character alive and not flagged 0x40 in
   byte 8. The condition byte, by EvalCondition's branches and its jump
   table: 0 always; 1 the stop; 2 and 3 a quest flag set or clear; 0x20 to
   0x3F a roll of 0 to 2^(n+1) - 1 (n its low three bits; none when n is 0)
   set against the argument; 0x40 to 0x7F the argument character's flag
   (its low five bits), 0x60 up negated; 0x80 up a quest value (low five
   bits) against the argument. The four comparisons are the same for a roll
   and a quest value, by bits 3-4 and 5-6 respectively: equal, at least, not
   equal, less than. Any other byte is never true. GRIMOIRE-NOTES.md, *Code
   reached by call_subroutine*, has the reading; Pelagon's schedule (13) is
   the worked case. Null for a segment that holds always. */
const SCHED_COMPARE = ['is', 'is at least', 'is not', 'is less than'];
function scheduleCondition(e) {
  const k = e.cond, a = e.arg;
  if (!k) return null;
  if (k === 1) return { stop: true, text: 'stop if the schedule took one above' };
  if (k === 2 || k === 3) return { text: 'if quest flag ' + a + (k === 2 ? ' is set' : ' is clear') };
  if (k >= 0x20 && k < 0x40) {
    const n = k & 7, top = n ? (1 << (n + 1)) - 1 : 0;
    return { text: 'if a random number from 0 to ' + top + ' ' + SCHED_COMPARE[(k >> 3) & 3] + ' ' + a };
  }
  if (k >= 0x40 && k < 0x80) {
    const f = k & 0x1F, nm = dvmFlagName(f);
    return { text: 'if ' + (characterName(a) || ('character ' + a)) + ((k & 0x60) === 0x60 ? ' has not' : ' has') + ' flag ' + f + (nm ? ' (' + nm + ')' : '') };
  }
  if (k >= 0x80) return { text: 'if quest value ' + (k & 0x1F) + ' ' + SCHED_COMPARE[(k >> 5) & 3] + ' ' + a };
  return { text: 'never (condition ' + propWordHex(k) + ')' };
}
function renderSpellsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const sp = spellRules();
  const fx = spellEffects();
  const st = statusRules();
  const applies = new Map();
  for (const [nm, arr] of st.applies) for (const a of arr) (applies.get(a.resid) || applies.set(a.resid, []).get(a.resid)).push(svEsc(nm) + (a.duration !== null ? ' for ' + srcNum(a.durationVal, a.duration) : ''));
  const tgt = new Map(targetRules().map(t => [t.resid, t]));
  const spells = sp.spells.map(x => Object.assign({}, x, { description: dvmDescriptionOf(x.resid), fx: fx.get(x.resid), status: applies.get(x.resid) || [], target: tgt.get(x.resid) }))
    .sort((a, b) => a.level - b.level || a.cost - b.cost || a.name.localeCompare(b.name));
  const shown = spells.filter(x => !q || x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
  const clockNow = appImage() ? exeClockRules() : null;
  const unitsNote = clockNow && clockNow.unitsPerHour ? '; ' + srcNum(clockNow.unitsPerHour) + ' is an hour' : '';
  const box = document.createElement('div');
  box.className = 'mechView';
  const intro = document.createElement('p'); intro.className = 'mechLede';
  // The count is a link to what it counts: a spell is a script that calls
  // CastSpell (spellRules), so the number opens the search for those calls,
  // which lists exactly the same scripts (the maintainer, 2 October 2026: a
  // count is linked to data; CastSpell's own page held one script, not the
  // forty-nine).
  intro.innerHTML = svLink(spells.length + ' spells', "searchFor('call_resource CastSpell')") + ' by level, after ' + cardLink('spells', 'the rules for casting') + '.';
  box.appendChild(intro);
  // How a cast works, above the spells it works on. This was a section of the
  // Mechanics sheet until 13 September 2026.
  try { box.appendChild(spellsMechSection()); } catch (e) { quiet(e); }
  let level = null, count = 0;
  for (const x of shown) {
    if (x.level !== level) { level = x.level; const h = document.createElement('div'); h.className = 'propHead'; h.innerHTML = 'Level ' + level; box.appendChild(h); }
    count++;
    const sec = foldCard('spell-' + x.resid.toString(16), 'skillCard', !!q);
    const head = document.createElement('summary'); head.className = 'mechHead';
    head.innerHTML = skillIconHTML(x.resid, 'spells') + '<h3>' + svEsc(x.name) + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + srcNum(x.levelVal) + '</b> level</span><span class="mechStat"><b>' + srcNum(x.costVal) + '</b> magic</span></span><span class="mechFrom">' + partChip('the script', x.resid) + '</span>';
    sec.appendChild(head);
    if (x.description) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = svEsc(x.description); sec.appendChild(p); }
    const rows = [];
    if (x.fx) {
      for (const d of x.fx.damage) rows.push(['Damage', '<b>' + srcNum({ resid: x.resid, at: d.at }, amountWords(d.amount) || 'an amount the script works out') + '</b> ' + (d.type !== null ? damageTypeName(d.type) : '') + ' to ' + d.who]);
      for (const h of x.fx.heals) rows.push(['Heals', '<b>' + srcNum({ resid: x.resid, at: h.at }, h.text) + '</b>']);
    }
    if (x.status.length) rows.push(['Applies', x.status.join(', ') + ' <span class="inspDim">(clock units' + (unitsNote || '') + ')</span>']);
    if (x.target) rows.push(['Cast on', targetWordWords(x.target.word).map(svEsc).join(', ') + ' ' + srcNum(x.target.val, propWordHex(x.target.word)) +
      ((x.target.word & 0x8000) ? ' <span class="inspDim">(a neighbor)</span>' : '')]);
    if (!rows.length) rows.push(['Does', '<span class="inspDim">something other than health: the light, a lock, a rune, the map, or a look</span>']);
    const d = document.createElement('div'); d.className = 'mechBody';
    d.innerHTML = '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><tbody>' + rows.map(r => '<tr><td class="skillKey">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table></div>';
    sec.appendChild(d);
    // The same strip the skills carry: the icon it wears, the script being
    // already named on the summary.
    {
      const chips = skillSpellParts(x.resid);
      if (chips.length) { const p = document.createElement('div'); p.innerHTML = linksFold(partsStrip('Made of', chips)); sec.appendChild(p); }
    }
    box.appendChild(sec);
  }
  grid.appendChild(box);
  out.textContent = count + ' of ' + spells.length + ' spells' + (q ? ' matching “' + q + '”' : '') + '.';
}

function renderBarksSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const barks = buildBarkCatalogue();
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const shown = barks.filter(b => !q || b.words.concat(b.then || []).some(w => w.toLowerCase().includes(q)) ||
    (b.who !== null && characterName(b.who).toLowerCase().includes(q)));
  const rows = [];
  for (const b of shown) {
    const who = b.who !== null && loadCharacterTable()[b.who] ? characterChip(b.who)
      : '<span class="inspDim">anyone, </span>' + svChip(b.resid);
    const words = b.words.map(w => '“' + svEsc(w) + '”').join(', ');
    rows.push('<tr><td>' + who + '</td><td>' + (b.how === 'one of' ? '<span class="inspDim">one of</span> ' : '') + words +
      (b.then && b.then.length ? '<div class="inspDim">then, when the ' + b.helper + ' comes: ' + b.then.map(w => '“' + svEsc(w) + '”').join(', ') + '</div>' : '') +
      '</td><td>' + (b.who !== null ? svChip(b.resid) : '') + '</td></tr>');
  }
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.innerHTML = rows.length
    ? '<table class="vocabTable barkTable"><thead><tr><th>who</th><th>says</th><th>where</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'
    : '<div class="changesNote">' + (barks.length ? 'Nothing matches the filter.' : 'No script in this file sets a talk balloon.') + '</div>';
  // How a balloon works, above the lines themselves. This was a section of
  // the Mechanics sheet until 13 September 2026.
  mechCardAboveGallery(grid, balloonsMechSection);
  grid.appendChild(scroll);
  const distinct = new Set(barks.flatMap(b => b.words.concat(b.then || []))).size;
  out.textContent = barks.length
    ? barks.length + ' places in the scripts put a line over a character’s head, ' + distinct + ' distinct lines' +
      (q ? '; ' + shown.length + ' shown' : '') + '. How the balloon works is in the card above.'
    : 'No script in this file sets a talk balloon.';
}

/* WEAPONS AND ARMOUR. Every item class script carries a keyed table
   (parseItemClass, ITEM_FIELD_INFO), and the combat keys 0x2A-0x2F are
   the weapon, ammunition, armour and shield parameters. Armour's one
   number is points of protection, which the wiki establishes; the others
   are not published anywhere, so the table shows them as stored and says
   the one thing the data itself shows: the first melee number orders the
   weapons as their damage would. */
function gearTable() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    const cls = parseItemClass(pt);
    if (!cls) continue;
    const f = k => { const e = cls.data.find(x => x.key === k); return e ? e.words.map(w => (w & 0xF0000000) ? null : (w & 0x0FFFFFFF)) : null; };
    // Where each entry sits in the class script, for the table's links.
    const at = k => { const e = cls.data.find(x => x.key === k); return e ? { resid: cls.resid, at: e.off } : null; };
    const melee = f(0x2A), thrown = f(0x2B), armour = f(0x2C), ammo = f(0x2D), ranged = f(0x2E), shield = f(0x2F);
    if (!(melee || thrown || armour || ammo || ranged || shield)) continue;
    const skillName = id => (id !== null && id !== undefined && refExists(0x1A00 + id) && selfNameFor(0x1A00 + id)) || (id !== null && id !== undefined ? 'skill ' + id : '');
    rows.push({ pt, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)), weight: itemWeight(pt),
      melee, thrown, armour, ammo, ranged, shield,
      damage: melee ? melee[0] : thrown ? thrown[0] : ammo ? ammo[1] : null,
      thrownDamage: thrown ? thrown[0] : null, thrownRange: thrown ? thrown[1] : null,
      reach: melee ? melee[1] : thrown ? thrown[1] : ranged ? ranged[1] : null,
      type: melee ? melee[2] : ammo ? ammo[2] : null,
      skill: melee ? skillName(melee[3]) : shield ? skillName(shield[1]) : '',
      ammoClass: ranged ? ranged[0] : ammo ? ammo[0] : null,
      block: shield ? shield[0] : null, protection: armour ? armour[0] : null,
      src: { weight: at(0x24), damage: melee ? at(0x2A) : thrown ? at(0x2B) : ammo ? at(0x2D) : null, thrown: at(0x2B),
             reach: melee ? at(0x2A) : thrown ? at(0x2B) : ranged ? at(0x2E) : null, type: melee ? at(0x2A) : ammo ? at(0x2D) : null,
             ammoClass: ranged ? at(0x2E) : ammo ? at(0x2D) : null, block: at(0x2F), protection: at(0x2C) } });
  }
  return rows;
}

/* WHAT EACH SKILL IS CONSULTED FOR. A script asks `GetSkill(who, skill)`;
   where the skill is a constant the question is about that skill -- the
   dice game asks about Gambling -- and where it is an argument the script
   is a helper that checks whichever skill it is handed. Skill n's own
   script is 0x1A00 + n, which is where its name comes from. */
function skillConsultations() {
  const by = new Map(); let generic = 0;
  const genericIn = new Set();   // the scripts those checks are in, for the count's list
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/sys GetSkill\b/.test(lines[i])) continue;
      // Either spelling: the listing renders a plain number in decimal now,
      // and did so in hex before. Matching one alone would quietly stop
      // finding skills the day the other is used.
      const m = /short (?:0x([0-9A-F]{4})|(\d+))\b/i.exec((lines[i + 1] || '') + ' ' + (lines[i + 2] || ''));
      if (!m) { generic++; genericIn.add(e.resid); continue; }
      const id = m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10);
      if (!by.has(id)) by.set(id, new Set());
      by.get(id).add(e.resid);
    }
  }
  return { by, generic, genericIn };
}

/* KARMA. A global the scripts add to and subtract from, read here as
   every write: a literal step, a call of the two helpers 0xF11 (down) and
   0xF12 (up), the assignment at creation, and one table of steps by the
   victim's alignment when something is killed (0xE8D: a data block of
   28-bit words, read as signed). The reads are the thresholds. */
function karmaRules() {
  const writes = [], reads = [];
  const val = t => { const m = /(byte|short|word) (0x[0-9A-F]+|\d+)/i.exec(t || ''); return m ? parseInt(m[2]) : null; };
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    // The occasion: the nearest line the script prints, looking back first
    // (the deed is usually said before its price) and then ahead.
    const near = i => {
      const grab = j => { const m = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j] || ''); return m ? m[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim() : ''; };
      for (let j = i - 1; j >= Math.max(0, i - 7); j--) { const t = grab(j); if (t) return t; }
      for (let j = i; j < Math.min(lines.length, i + 8); j++) { const t = grab(j); if (t) return t; }
      return '';
    };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/set_global Karma/.test(l)) {
        const a = lines[i + 1] || '', b = lines[i + 2] || '', c = lines[i + 3] || '';
        if (/global Karma/.test(a) && /\b(add|sub)\b/.test(c)) {
          const n = val(b);
          if (n !== null) writes.push({ resid: e.resid, change: (/sub/.test(c) ? -n : n), val: dvmValAtLine(e, i + 2), note: near(i + 4) });
          else if (/local|index/.test(b) || /index/.test(c)) writes.push({ resid: e.resid, change: null, note: near(i + 4), why: 'by an amount the script works out' });
        } else if (val(a) !== null && !/global Karma/.test(a)) writes.push({ resid: e.resid, set: val(a), val: dvmValAtLine(e, i + 1), note: near(i + 2) });
      } else if (/call_resource 0xF1[12]\b/.test(l)) {
        const n = val(lines[i + 1]); const down = /0xF11/.test(l);
        writes.push({ resid: e.resid, change: n === null ? null : (down ? -n : n), val: n === null ? null : dvmValAtLine(e, i + 1), note: near(i + 2), why: n === null ? (down ? 'down by an amount the script works out' : 'up by an amount the script works out') : '' });
      } else if (/global Karma/.test(l) && !/set_global/.test(l) && /(lt|gt|le|ge|eq)\b/.test(lines[i + 2] || '')) {
        const n = val(lines[i + 1]);
        if (n !== null) reads.push({ resid: e.resid, test: (/lt|le/.test(lines[i + 2]) ? 'below ' : 'above ') + n, below: /lt|le/.test(lines[i + 2]), n, val: dvmValAtLine(e, i + 1), note: near(i + 3) });
      }
    }
  }
  // The kill table: 0xE8D's data block, indexed by the victim's alignment.
  let byAlignment = null, byAlignmentSrc = null;
  try {
    const raw = getResourceBytes(ARCHIVE, 0xE8D);
    const d = raw ? smartDecrypt(raw, 0xE8D).data : null;
    if (d) for (let i = 0; i + 5 < d.length; i++) {
      if (d[i] === 0x45 && d[i + 3] === 0x90 && d[i + 4] >= 2 && d[i + 4] <= 8 && u16be(d, i + 1) === 2 + d[i + 4] * 4) {
        byAlignment = [];
        for (let k = 0; k < d[i + 4]; k++) { let w = u32be(d, i + 5 + k * 4) & 0x0FFFFFFF; if (w & 0x08000000) w -= 0x10000000; byAlignment.push(w); }
        byAlignmentSrc = { resid: 0xE8D, at: i };   // the data block's own line
        break;
      }
    }
  } catch (e) { byAlignment = null; }
  return { writes, reads, byAlignment, byAlignmentSrc };
}

/* EXPERIENCE AND LEVELS. One helper, GainExp (0xE8B), takes every award:
   it adds, caps at 65535, and raises the level by one when experience
   passes 100 x 2^(level-1). AdjCharLevel (0xE86) then recomputes full
   health -- body + reflex/2 + level, plus Defense x 5 x reflex / 15, Defense
   being the skill where the character has it and otherwise a class figure
   of nothing, half the level, the level or twice it (0xE95) -- and full
   magic as mind + Mana the same way (0xE83, 0xE96). The damage helper
   0xEB8 awards the attacker the damage dealt, up to the victim's level
   above theirs plus one; a shared award (0xE8E) is split across the party.
   The fixed awards are every GainExp with a constant. */
function experienceRules() {
  const idx = buildScriptTextIndex();
  const gain = dvmScriptEntry(0xE8B);
  let rule = null;
  if (gain) {
    const go = dvmOpsOf(gain);
    // exp + award < cap, and exp > (1 << (level - less)) * base.
    const cap = dvmSeqFirst(go, [/^add$/, DVM_NUM, /^lt$/]);
    const dbl = dvmSeqFirst(go, [DVM_NUM, /^arg Arg00$/, /^get_field level/, DVM_NUM, /^sub$/, /^left_shift$/, DVM_NUM, /^mul$/]);
    // Full health off 0xE82: body + reflex / a + level + skill x b x reflex / c.
    const fh = dvmScriptEntry(0xE82) ? dvmOpsOf(dvmScriptEntry(0xE82)) : [];
    const half = dvmSeqFirst(fh, [/^get_field reflex/, DVM_NUM, /^div$/]);
    const def = dvmSeqFirst(fh, [/^local Var\w+$/, DVM_NUM, /^mul$/, /^arg Arg00$/, /^get_field reflex/, /^mul$/, DVM_NUM, /^div$/]);
    // What a blow earns, off the damage helper 0xEB8: the level gap plus
    // this, and this for a blow past the gap the other way.
    const eb = dvmScriptEntry(0xEB8) ? dvmOpsOf(dvmScriptEntry(0xEB8)) : [];
    const gap = dvmSeqFirst(eb, [/^get_field level/, /^local Var\w+$/, /^get_field level/, /^sub$/, DVM_NUM, /^add$/]);
    const past = dvmSeqAll(eb, [/^call_resource GainExp\b/, /^local Var\w+$/, DVM_NUM, /^end$/])[0] || null;
    rule = { cap: cap ? dvmVal(0xE8B, cap[1]) : null, doubling: !!dbl, base: dbl ? dvmVal(0xE8B, dbl[6]) : null, less: dbl ? dvmVal(0xE8B, dbl[3]) : null,
             healthReflexDiv: half ? dvmVal(0xE82, half[1]) : null, healthMul: def ? dvmVal(0xE82, def[1]) : null, healthDiv: def ? dvmVal(0xE82, def[6]) : null,
             gapAdd: gap ? dvmVal(0xEB8, gap[4]) : null, pastGap: past ? dvmVal(0xEB8, past[2]) : null };
  }
  const awards = [];
  for (const e of idx) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/call_resource GainExp\b/.test(lines[i])) continue;
      const m = /(byte|short|word) (0x[0-9A-F]+|\d+)/i.exec(lines[i + 2] || '');
      if (!m) continue;
      let note = '';
      for (let j = i - 1; j >= Math.max(0, i - 8) && !note; j--) { const t = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j]); if (t) note = t[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim(); }
      for (let j = i + 3; j < Math.min(lines.length, i + 10) && !note; j++) { const t = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j]); if (t) note = t[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim(); }
      awards.push({ resid: e.resid, amount: parseInt(m[2]), note, val: dvmValAtLine(e, i + 2) });
    }
  }
  return { rule, awards };
}

/* FOOD AND POTIONS. A potion's aspect picks its effect: the potion class
   (0x101F) calls 0xA00 + aspect, and its own text names the eight, so the
   names line up with the eight effect scripts, each read for what it sets,
   clears or applies. A food's Use method adds to nutrition: a constant,
   or for the general foodstuff class a value per variant from a data
   block, the variant being named by its tile. */
// `entry` is a script's index entry. Each thing done carries the offset of
// the instruction that does it, so the table can link it (`effects`);
// `does` is the same words as plain strings.
function effectSummary(entry) {
  const text = entry.text, ops = dvmOpsOf(entry);
  const out = [];
  const lines = text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, ''));   // offsets off, so runs of ops match
  const at = i => { const o = dvmOpAtLine(entry, i); return o ? { resid: entry.resid, at: o.at } : null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], next = lines.slice(i + 1, i + 12).join(' ');
    if (/set_field nutrition/.test(l)) { const m = /byte (0x[0-9A-F]+)/i.exec(next); if (m) out.push({ text: 'nutrition set to ' + parseInt(m[1]), src: at(i), field: 'nutrition', set: parseInt(m[1]) }); }
    else if (/set_field health/.test(l)) { const m = /byte (0x[0-9A-F]+)[\s\S]*?add[\s\S]*?sys Random\s+byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)/i.exec(next); out.push({ text: m ? 'health +' + parseInt(m[1]) + ' plus ' + rollWords([parseInt(m[2]), parseInt(m[3])]) : 'health changed', src: at(i) }); }
    else if (/set_field magic \(/.test(l) && !/full_magic/.test(l)) out.push({ text: 'magic restored', src: at(i) });
    else if (/sys ClearFlag/.test(l)) { const nm = dvmFlagNameOfLine(lines[i + 2]); if (nm) out.push({ text: 'clears ' + nm, src: at(i) }); }
    else if (/sys StatusEffect/.test(l)) {
      const fnm = dvmFlagNameOfLine(lines[i + 2]);
      const c = /byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)\s+sys Random\s+byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)/i.exec(lines.slice(i + 3, i + 9).join(' '));
      out.push({ text: (fnm || 'a status') + (c ? ' for ' + parseInt(c[1]) + ' plus ' + parseInt(c[2]) + ' times ' + rollWords([parseInt(c[3]), parseInt(c[4])]) : ''), src: at(i) });
    }
    else if (/sys SpecialView/.test(l)) { const m = /byte (0x[0-9A-F]+)/i.exec(next); out.push({ text: 'a special view' + (m ? ' (' + parseInt(m[1]) + ')' : ''), src: at(i) }); }
  }
  const said = /string\(implicit\) "([^"\\]{3,80})/.exec(text);
  const effects = out.filter((x, i) => out.findIndex(y => y.text === x.text) === i);
  return { does: effects.map(x => x.text), effects, says: said ? said[1] : '' };
}
function foodRules() {
  const idx = buildScriptTextIndex();
  const potion = idx.find(e => e.resid === 0x101F);
  const names = potion ? [...potion.text.matchAll(/\/\/\s+\+0x[0-9A-F]+: "([^"]+ Potion)"/g)].map(m => m[1]) : [];
  const potions = [];
  for (let n = 0; n < 8; n++) {
    const fx = idx.find(e => e.resid === 0xA00 + n);
    if (!fx) continue;
    potions.push(Object.assign({ resid: 0xA00 + n, name: names[n] || ('potion ' + n) }, effectSummary(fx)));
  }
  // Foods: every item class whose code sets nutrition.
  const foods = [];
  const tiles = getPropTileList();
  for (const e of idx.filter(e => e.subn === 15)) {
    if (!/set_field nutrition/.test(e.text)) continue;
    const pt = e.resid - 0x1000;
    const name = propDisplayName(pt) || ('prop 0x' + pt.toString(16));
    const lines = e.text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, ''));
    const i = lines.findIndex(l => /set_field nutrition/.test(l));
    const after = lines.slice(i, i + 14).join(' ');
    const flat = /byte (0x[0-9A-F]+)\s+add/i.exec(after);
    if (flat && !/index/.test(after)) {
      // The number's own line: the first constant then `add` after the write.
      const fo = dvmOpsOf(e), wi = fo.findIndex(o => /^set_field nutrition/.test(o.text));
      const g = wi < 0 ? null : dvmSeqFirst(fo.slice(wi, wi + 14), [DVM_NUM, /^add$/]);
      foods.push({ pt, name, plus: parseInt(flat[1]), val: g ? dvmVal(e.resid, g[0]) : null });
      continue;
    }
    if (/index[\s\S]*?byte (0x[0-9A-F]+)\s+mul/i.test(after)) {
      // A value per variant, from the data block: 0x45, length, 0x90, count, then 4-byte words.
      const mul = parseInt(/index[\s\S]*?byte (0x[0-9A-F]+)\s+mul/i.exec(after)[1]);
      let table = null, tableSrc = null;
      try {
        const raw = getResourceBytes(ARCHIVE, e.resid); const d = smartDecrypt(raw, e.resid).data;
        for (let k = 0; k + 5 < d.length; k++) if (d[k] === 0x45 && d[k + 3] === 0x90 && u16be(d, k + 1) === 2 + d[k + 4] * 4) {
          table = []; for (let q = 0; q < d[k + 4]; q++) table.push(u32be(d, k + 5 + q * 4) & 0x0FFFFFFF);
          tableSrc = { resid: e.resid, at: k };   // the data block's line
          break;
        }
      } catch (err) { table = null; }
      const base = tiles[pt];
      // The line the eater says: one string for every variant, or a table
      // of strings indexed by the aspect like the nutrition is.
      let says = '', saysPer = null;
      const balloon = /set_field talk_balloon[\s\S]{0,160}?(?=set_field nutrition)/.exec(lines.join(' '));
      if (balloon) {
        const c = /string "([^"]*)"/.exec(balloon[0]);
        if (/get_field aspect(?: \(0x[0-9A-F]+\))?\s+index/.test(balloon[0])) {
          try {
            const raw = getResourceBytes(ARCHIVE, e.resid); const d = smartDecrypt(raw, e.resid).data;
            // The block is 0x45, a length, 0x90, a count, then drefs
            // (0x80000000 | resid << 16 | offset) back into this resource,
            // each at a string.
            for (let k = 0; k + 6 < d.length && !saysPer; k++) {
              if (d[k] !== 0x45 || d[k + 3] !== 0x90) continue;
              const n = d[k + 4], strs = [];
              for (let q = 0; q < n; q++) { const p = k + 5 + q * 4; if (p + 4 > d.length) break; const wv = u32be(d, p); if (!(wv & 0x80000000) || ((wv & 0x7FFF0000) >>> 16) !== e.resid) break; const v = dvmDataValue(d, wv & 0xFFFF); if (typeof v !== 'string') break; strs.push(v); }
              if (n && strs.length === n) saysPer = strs;
            }
          } catch (err) { saysPer = null; }
        } else if (c) says = c[1];
      }
      const variants = table ? table.map((v, a) => ({ aspect: a, name: base !== undefined ? (terrainNameFor(base + a) || '') : '', plus: v * mul, src: tableSrc, says: saysPer ? (saysPer[a] || '') : says })) : [];
      foods.push({ pt, name, variants, mul, says, saysPer: !!saysPer });
      continue;
    }
    foods.push({ pt, name, plus: null });
  }
  return { potions, foods };
}

/* STATUS EFFECTS. Every StatusEffect call, by flag -- the disassembler
   names the flags (dvmFlagName) -- with the duration the call gives and
   who gives it: a spell, a trap, a potion, a place. And every ClearFlag,
   which is what cures. The unit of a duration is the engine's; only the
   numbers are the scripts'. */
function statusRules() {
  const applies = new Map(), cures = new Map();
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/sys StatusEffect/.test(l)) {
        const fnm = dvmFlagNameOfLine(lines[i + 2]);
        const nm = fnm ? fnm : (/byte (0x[0-9A-F]+)/i.exec(lines[i + 2] || '') ? 'flag ' + parseInt(/byte (0x[0-9A-F]+)/i.exec(lines[i + 2])[1]) : 'a status');
        const d = /(?:word|short|byte) (0x[0-9A-F]+|\d+)/i.exec(lines[i + 3] || '');
        // A duration with a roll in it is reported as computed, not as its base.
        const dur = d && !/sys Random/.test(lines.slice(i + 4, i + 9).join(' ')) ? parseInt(d[1]) : null;
        if (!applies.has(nm)) applies.set(nm, []);
        applies.get(nm).push({ resid: e.resid, duration: dur, durationVal: dur !== null ? dvmValAtLine(e, i + 3) : null,
                               at: (dvmOpAtLine(e, i) || {}).at });
      } else if (/sys ClearFlag/.test(l)) {
        const nm = dvmFlagNameOfLine(lines[i + 2]);
        if (!nm) continue;
        if (!cures.has(nm)) cures.set(nm, new Set());
        cures.get(nm).add(e.resid);
      }
    }
  }
  return { applies, cures };
}

/* ---- a number read off a script, and where it was read -------------------
   The Mechanics sheet states rules with numbers in them, and until
   11 September 2026 most of those numbers were typed into the sentence
   behind a pattern that checked the script still said them: "capped at
   65,535" was printed because /word 65535/ matched. A number the code keeps
   its own copy of is one an edited archive silently contradicts and one a
   reader has no way to check, so the numbers are read now, each with the
   offset of the instruction that holds it, and the sheet prints each as a
   link that opens the script ringed at that line (srcNum, jumpToScriptAt).

   The listing is dvmRender's, as buildScriptTextIndex caches it. A line's
   offset there counts from the start of its object -- dvmDisassemble is
   handed the object's own bytes -- while a branch target is the resource's,
   so the object's start, from its `function obj_XXXX(` header, is added
   back. `at` is then an offset in the resource's plaintext, which is what a
   branch, Edit Bytes and the link all mean by one. */
let _dvmEntryIndex = { src: null, byId: new Map() };
function dvmScriptEntry(resid) {
  const all = buildScriptTextIndex();
  if (_dvmEntryIndex.src !== all) _dvmEntryIndex = { src: all, byId: new Map(all.map(e => [e.resid, e])) };
  return _dvmEntryIndex.byId.get(resid) || null;
}
// Every instruction line of a listing: its resource offset, its object's
// start, its nesting, and its text without the offset (`byte 0x04`).
function dvmOpsOf(entry) {
  if (!entry) return [];
  if (entry.ops) return entry.ops;
  const ops = [];
  let base = 0;
  const lines = entry.text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(lines[li]);
    if (h) { base = parseInt(h[1], 16); continue; }
    const m = /^  ([0-9A-F]{4})  ((?:    )*)(\S+)(?: (.*))?$/.exec(lines[li]);
    if (!m) continue;
    // The disassembler's annotations (`byte 0x09  // flag: poison`) are kept
    // apart, so an operand with one still reads as a number. A quoted
    // string cannot hold one: the `//` would be inside the quotes.
    const whole = m[3] + (m[4] !== undefined ? ' ' + m[4] : '');
    const c = /^string/.test(m[3]) ? null : /^(.*?)\s+\/\/\s*(.*)$/.exec(whole);
    ops.push({ at: base + parseInt(m[1], 16), obj: base, line: li, depth: m[2].length / 4,
               mn: m[3], text: c ? c[1] : whole, note: c ? c[2] : '' });
  }
  return (entry.ops = ops);
}
// The instruction on line `li` of a listing, for a reader that walks the
// text by line: its number with where it was read, or null.
function dvmOpAtLine(entry, li) {
  if (!entry) return null;
  if (!entry.opByLine) entry.opByLine = new Map(dvmOpsOf(entry).map(o => [o.line, o]));
  return entry.opByLine.get(li) || null;
}
function dvmValAtLine(entry, li) {
  const op = dvmOpAtLine(entry, li);
  return op ? dvmVal(entry.resid, op) : null;
}
// A constant operand as a number, or null (`word True` is not one).
const DVM_NUM = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;
function dvmNum(op) {
  const m = op && /^(byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(op.text);
  if (!m) return null;
  let v = parseInt(m[2]);
  // `word` already arrives signed, through dvmWord's 28-bit reading. A byte
  // and a short do not: they are shown as the bytes they are, and the
  // interpreter sign-extends both before using them (see the literal branch
  // of dvmDisassemble). 49 byte and 2 short literals in the shipped archive
  // have the high bit set, across 39 script resources; the zone light levels
  // are eighteen of them.
  const w = m[1].toLowerCase();
  if (w === 'byte' && v > 0x7F) v -= 0x100;
  if (w === 'short' && v > 0x7FFF) v -= 0x10000;
  return v;
}
// The number an instruction pushes, with where: { v, resid, at }.
/* A flag's name from the program (dvmFlagName), by the number on a
   listing line or an op, asked at the moment it is said. The listing's own
   `flag:` note is written when the text is built and cached, which on the
   page is before the application has been adopted, so the rule readers do
   not read it back. */
function dvmFlagNameOfLine(line) {
  const m = /\b(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)/i.exec(line || '');
  return m ? dvmFlagName(parseInt(m[1])) : null;
}
function dvmFlagNameOfOp(op) { const v = dvmNum(op); return v === null ? null : dvmFlagName(v); }
function dvmVal(resid, op) {
  const v = dvmNum(op);
  return v === null ? null : { v, resid, at: op.at };
}
// The ops from `i` that match `pat` one for one: each element a RegExp
// tested against an op's text, or null for any single op. The matched ops,
// or null.
function dvmSeq(ops, i, pat) {
  if (i < 0 || i + pat.length > ops.length) return null;
  const got = [];
  for (let k = 0; k < pat.length; k++) {
    const op = ops[i + k];
    if (pat[k] && !pat[k].test(op.text)) return null;
    got.push(op);
  }
  return got;
}
function dvmSeqFirst(ops, pat, from) {
  for (let i = from || 0; i < ops.length; i++) { const g = dvmSeq(ops, i, pat); if (g) return g; }
  return null;
}
function dvmSeqAll(ops, pat) {
  const out = [];
  for (let i = 0; i < ops.length; i++) { const g = dvmSeq(ops, i, pat); if (g) out.push(g); }
  return out;
}
// The first match in a script, by resource id, as a convenience.
function dvmSeqIn(resid, pat) { return dvmSeqFirst(dvmOpsOf(dvmScriptEntry(resid)), pat); }

/* A number the sheet read, as a link to the line that holds it. `text` is
   what is printed when that is not the operand itself -- "29" for a
   `Random(0, 30)`, "65,535" for `word 65535`. A value that was not read
   prints as plain text, so a sentence never shows a link to nowhere. */
function srcNum(val, text) {
  const shown = text === undefined || text === null ? (val ? String(val.v) : '') : String(text);
  // A figure read out of the application's code opens its routine instead.
  if (val && typeof val.exe === 'number') {
    const r = exeRoutineAt(val.exe);
    return '<button class="svLink srcNum" onclick="jumpToExeAt(' + val.exe + ')" title="' + svEsc((r ? r.name + ', ' : '') + 'code 0x' + val.exe.toString(16).toUpperCase().padStart(6, '0')) + '">' + svEsc(shown) + '</button>';
  }
  /* A figure read out of a record opens the bytes it was read from: the
     resource in the Data Fork, its table inspector set to the record's
     stride, with that byte ringed. This is the link that always works.
     The executable's is better where it exists -- it says what the program
     does with the byte, not only where the byte is -- but the application
     is open only when the visit came through the installer, and most do
     not, so every figure linked to a routine and to nothing else read as
     a page with no links at all (the maintainer, 20 September 2026). */
  if (val && typeof val.resid === 'number' && typeof val.byte === 'number') {
    const t = propWordHex(val.resid) + ' byte ' + val.byte + (val.what ? ', ' + val.what : '');
    return '<button class="svLink srcNum" onclick="jumpToTableAt(' + val.resid + ',' + val.byte + ',' + (val.stride || 16) + ')" title="' + svEsc(t) + '">' + svEsc(shown) + '</button>';
  }
  if (!val || typeof val.resid !== 'number' || typeof val.at !== 'number') return svEsc(shown);
  return '<button class="svLink srcNum" onclick="jumpToScriptAt(' + val.resid + ',' + val.at + ')" title="' +
    propWordHex(val.resid) + ' at ' + propWordHex(val.at) + '">' + svEsc(shown) + '</button>';
}
// A table cell holding one.
function srcCell(val, text) {
  return '<td class="num">' + (val || (text !== undefined && text !== null && text !== '') ? srcNum(val, text) : '') + '</td>';
}

/* Open a script with one line ringed and in view. The resource view is
   jumpToResource's; a conversation opens on its dialogue, so the listing
   is brought out from behind the toggle. The ring is painted by
   paintDecodedPane from LISTING_AT, which jumpToResource clears, so it
   belongs to this one jump and to no later visit of the same script. The
   scroll waits a beat because setMode puts a detail view at the top of
   the page on a timeout of its own. */
/* Open a resource's bytes with one of them ringed, at the stride the
   record it belongs to is read at. The ring is painted by
   renderTableInspector from TABLE_AT, the way a script line's is painted
   from LISTING_AT. */
window.TABLE_AT = null;
/* A figure lands on its own record under Components > Records where the
   table is one this page knows, and in the Data Fork's hex where it is
   not. The record page carries the step down to the same bytes
   (jumpToForkBytes), so the chain reads Scenario, Components, Data rather
   than Scenario, Data. */
function jumpToTableAt(resid, byte, stride) {
  let known = false;
  try { known = recordTables().some(t => t.resid === resid); } catch (e) { known = false; }
  if (known) {
    window.RECORD_AT = { resid, byte };
    if (!showCategory('RECORDS')) return false;
    showRecordDetail(resid, byte);
    window.scrollTo(0, 0);
    return true;
  }
  return jumpToForkBytes(resid, byte, stride);
}
function jumpToForkBytes(resid, byte, stride) {
  window.TABLE_AT = { resid, byte };
  if (stride) window.TABLE_WIDTH = stride;
  if (!jumpToResource(resid)) { window.TABLE_AT = null; return false; }
  setTimeout(() => {
    try { renderTableInspector(resid); } catch (e) { quiet(e); }
    const hit = document.getElementById('tableHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 60);
  return true;
}
window.LISTING_AT = null;
function jumpToScriptAt(resid, at) {
  // The Patches tab too, whose list of the text's changes links every place
  // (29 September 2026), so that back finds the list where it was left.
  if (window.CUR_SUBN === 'MECHANICS' || MECH_GROUP_BY_VALUE[window.CUR_SUBN] || window.CUR_SUBN === MECH_TOOL_GROUP.value) mechKeepPlace();
  if (!jumpToResource(resid)) return false;
  window.LISTING_AT = { resid, at };
  // A script under Text opens on its words; a jump to a line wants the code.
  window.SCRIPT_PANE = 'code';
  paintDecodedPane();
  setTimeout(() => {
    const hit = document.getElementById('listingHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 40);
  return true;
}
// The line of a listing an offset falls on: the last instruction at or
// before it, within the object that holds it.
//
// The raw listing's gutter counts from the object's start, two spaces in,
// under an `obj_NNNN` or `function obj_NNNN` header. The folded and
// structured listings print the resource's own offset four spaces in, and
// name a function where the dispatch table names it, so their header says
// nothing about the base; there the line is simply the one whose offset is
// the greatest at or before `at`. Until 22 September 2026 only the first was
// read, so a figure's link opened a folded listing with nothing ringed.
function listingLineFor(text, at) {
  const lines = String(text).split('\n');
  let base = -1, best = -1;
  const folded = /^    [0-9A-F]{4}  /m.test(text) && !/^  [0-9A-F]{4}  /m.test(text);
  if (folded) {
    let bestAt = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = /^    ([0-9A-F]{4})  /.exec(lines[i]);
      if (!m) continue;
      const o = parseInt(m[1], 16);
      if (o <= at && o > bestAt) { bestAt = o; best = i; }
    }
    return best;
  }
  for (let i = 0; i < lines.length; i++) {
    const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(lines[i]);
    if (h) {
      base = parseInt(h[1], 16);
      if (base > at) break;
      best = i;
      continue;
    }
    const m = base >= 0 && /^  ([0-9A-F]{4})  /.exec(lines[i]);
    if (!m) continue;
    if (base + parseInt(m[1], 16) > at) break;
    best = i;
  }
  return best;
}
function listingRing(html, text, at) {
  const i = listingLineFor(text, at);
  if (i < 0) return html;
  const hl = html.split('\n');
  if (i >= hl.length) return html;
  hl[i] = '<span id="listingHit" class="listingHit">' + hl[i] + '</span>';
  return hl.join('\n');
}

// The arguments of a call at ops[i]: the ops one level inside it, up to
// its `end`.
function dvmCallArgs(ops, i) {
  const out = [], d = ops[i].depth;
  for (let j = i + 1; j < ops.length && ops[j].obj === ops[i].obj; j++) {
    if (ops[j].depth <= d) break;
    if (ops[j].depth === d + 1) out.push(ops[j]);
  }
  return out;
}
/* A call's operands as values. dvmCallArgs gives the ops one level inside a
   call, but the listing is postfix, so one operand can take several ops:
   `word 0x021D[0]`, `arg Arg00`, `get_field data1`, `add` is the text table
   plus the prop's Data1, a single value. Grouped by what each op takes off
   the stack, value k is the k-th thing the call receives, which is what a
   reader means by "the second argument". A nested call is one value: its
   own operands sit a level deeper, and its `end` closes it. */
const DVM_BINARY_OPS = new Set(['add', 'sub', 'mul', 'div', 'mod', 'lt', 'le', 'gt', 'ge', 'ne', 'eq',
  'bitwise_and', 'bitwise_or', 'bitwise_xor', 'left_shift', 'right_shift', 'and', 'or', 'index']);
const DVM_UNARY_OPS = new Set(['neg', 'bitwise_not', 'not', 'len', 'has_member', 'class_member', 'get_field', 'cast', 'is_type']);
function dvmCallValues(ops, i) {
  const st = [];
  for (const o of dvmCallArgs(ops, i)) {
    if (o.mn === 'end') continue;
    if (DVM_BINARY_OPS.has(o.mn)) { const b = st.pop() || [], a = st.pop() || []; st.push(a.concat(b, [o])); }
    else if (DVM_UNARY_OPS.has(o.mn)) st.push((st.pop() || []).concat([o]));
    else st.push([o]);
  }
  return st;
}
// A value that is one constant, as a number; one argument, as its index.
function dvmValueNum(v) { return v && v.length === 1 ? dvmNum(v[0]) : null; }
function dvmValueArg(v) {
  const m = v && v.length === 1 && /^arg Arg([0-9A-F]{2})$/.exec(v[0].text);
  return m ? parseInt(m[1], 16) : null;
}
// A quoted string an op pushes, as the game has it.
function dvmOpString(op) {
  const m = op && /^string(?:\(implicit\))? ("(?:[^"\\]|\\.)*")/.exec(op.text);
  if (!m) return null;
  try { return JSON.parse(m[1]).replace(/\n$/, ''); } catch (e) { return null; }
}

/* DAMAGE TO THINGS. Every blow and every damaging spell ends in the
   target's TakeDamage method (0x41), handed the damage and its type: the
   combat outcome 0xE87 calls it after ResistDamage, the damage helper
   0xEB8 for a spell, 0xE8F for a weapon's roll. A character takes it as
   health through the default method 0x3041. An item class can carry a
   TakeDamage of its own, and the metal door's -- blunt doubled, edged
   halved, piercing quartered, then the door helper 0xE49 -- was written up
   on 9 September 2026 from that one class and kept off the sheet until
   every class that has one had been read (asked for on 11 September).
   They have been, and the arithmetic is the doors', the chest's, the
   coffer's and the crate's alike; the rest do something of their own.

   So this reads each class's method for its parts rather than naming
   classes: the type table (`if (type & M) damage op= K`, tested in turn,
   the first bit that matches deciding), a guard (a type equal to N, a
   Data1 below N, a damage above N), where the damage goes (0xE49 with the
   door's aspects, 0xE4A with the chest's and a strength, or a lock of the
   class's own against Data2), and what follows (the thing deleted, turned
   into another prop type, given an aspect, experience awarded, a line
   said). The two helpers are read once, by bashRule. */
function bashRule(resid) {
  const ops = dvmOpsOf(dvmScriptEntry(resid));
  if (!ops.length) return null;
  const v = g => g ? dvmVal(resid, g.find(o => DVM_NUM.test(o.text))) : null;
  const byClass = dvmSeqFirst(ops, [/^class_member 0x3400$/, DVM_NUM, /^mul$/, /^gt$/]);
  const byArg = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg\d+$/, DVM_NUM, /^mul$/, /^gt$/]);
  const destroy = byClass ? { factor: dvmVal(resid, byClass[1]), strength: 'class' } : byArg ? { factor: dvmVal(resid, byArg[2]), strength: 'argument' } : null;
  const opens = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, /^gt$/]);
  const wear = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^div$/, /^gt$/]);
  const step = dvmSeqFirst(ops, [/^set_field data2/, /^arg Arg00$/, /^end$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^sub$/]);
  // The destroying blow is tested inside the locked branch for a door, so
  // only a locked or magically locked door can be destroyed, and a
  // magically locked one only that way: the condition is
  // locked || (magically locked && damage > strength x factor).
  const magicOnlyDestroyed = !!dvmSeqFirst(ops, [/^eq$/, /^or$/, /^arg Arg01$/, /^arg Arg00$/, /^class_member 0x3400$/, DVM_NUM, /^mul$/, /^gt$/, /^and$/, /^or$/]);
  const says = ops.map(dvmOpString).filter(Boolean);
  const spills = ops.some(o => o.text === 'call_resource 0xE48');
  // Anything inside it flagged 2 is used on the one attacking and removed
  // before the blow is judged.
  const setsOff = !!dvmSeqFirst(ops, [/^get_field flags/, /^byte (?:0x02|2)$/, /^bitwise_and$/]) && ops.some(o => /^method UseOn/.test(o.text));
  // The line each outcome says: the first string with words in it after
  // the test that leads to it, and the one after that for the blow that
  // does nothing. Chosen by where it sits, so an edited line is quoted as
  // edited.
  const lineAfter = (g, skip) => {
    if (!g) return null;
    let n = skip || 0;
    for (let i = ops.indexOf(g[g.length - 1]) + 1; i < ops.length; i++) {
      const s = dvmOpString(ops[i]);
      if (s && /[A-Za-z]{2}/.test(s) && ops[i].text !== 'string "It contained"' && n-- === 0) return s;
    }
    return null;
  };
  const destroyG = byClass || byArg;
  return { resid, destroy, opens: opens ? { resid, at: opens[0].at } : null,
           wear: wear ? dvmVal(resid, wear[3]) : null, step: step ? dvmVal(resid, step[5]) : null,
           magicOnlyDestroyed, says, spills, setsOff,
           saysDestroyed: lineAfter(destroyG), saysOpened: lineAfter(opens), saysWorn: lineAfter(wear), saysHeld: lineAfter(wear, 1) };
}
// The weapons whose damage type passes `test`, off their classes, and a
// bare hand where the outcome routine's type for one passes it too.
function damageTypeCarriers(test) {
  const names = [];
  const bare = dvmSeqIn(0xE87, [/^class_member 0x2D02$/, /^end$/, /^branch /, /^set_local /, DVM_NUM, /^end$/]);
  if (bare && test(dvmNum(bare[4]))) names.push('a bare hand');
  for (const g of gearTable()) if (g.type !== null && test(g.type)) names.push(g.name);
  const u = [...new Set(names)];
  return u.length ? u.slice(0, 4).join(', ') + (u.length > 4 ? ' and ' + (u.length - 4) + ' more' : '') : '';
}
// What a class does when struck, in words with its numbers as links: the
// cell of the Mechanics table and the item page's line.
function damageRowWords(r) {
  const bits = [];
  const carried = t => { const c = damageTypeCarriers(t); return c ? ' <span class="inspDim">(' + svEsc(c) + ')</span>' : ''; };
  if (r.onlyType) bits.push('only a blow of type ' + srcNum(r.onlyType) + carried(t => t === r.onlyType.v));
  if (r.data1Below) bits.push('only while its Data1 is below ' + srcNum(r.data1Below));
  if (r.overDamage) bits.push('any blow above ' + srcNum(r.overDamage));
  if (r.types.length) bits.push('the damage changed by its type');
  if (r.rule === 'door') bits.push('bashed as a door' + (r.strength ? ' of strength ' + srcNum(r.strength) : ''));
  else if (r.rule === 'chest') bits.push('bashed as a chest' + (r.strength ? ' of strength ' + srcNum(r.strength) : ''));
  else if (r.rule === 'lock') bits.push('a lock of strength ' + srcNum(r.strength) + ', which a blow above what is left opens' + (r.wear ? ' and loses one to a blow above what is left ÷ ' + srcNum(r.wear) : '') + (r.deletes ? '; destroyed when struck closed and unlocked' : ''));
  else if (r.rule === 'data2') bits.push('breaks when a blow is above its Data2' + (r.data2Default ? ', ' + srcNum(r.data2Default) + ' until set' : ''));
  if (r.becomes) bits.push('becomes ' + svEsc(propDisplayName(r.becomes.v) || 'prop type') + ' (prop type ' + srcNum(r.becomes) + ')');
  else if (r.aspects.length && r.rule !== 'lock') bits.push('shows aspect ' + r.aspects.filter((a, i, all) => all.findIndex(b => b.v === a.v) === i).map(a => srcNum(a)).join(' or '));
  if (r.deletes && r.rule !== 'lock') bits.push('destroyed');
  if (r.spills !== null) bits.push('drops what it held');
  if (r.xp) bits.push('checks for a hit and gives ' + srcNum(r.xp) + ' experience for one' + (r.xpWhileBelow ? ', until its Data1 counts to ' + srcNum(r.xpWhileBelow) : ''));
  return bits.join('; ');
}
function damageTakers() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    const take = cls && cls.code.find(c => c.key === 0x41);
    if (!take) continue;
    const r = cls.resid;
    const ops = dvmOpsOf(dvmScriptEntry(r)).filter(o => o.obj === take.off);
    if (!ops.length) continue;
    const val = op => dvmVal(r, op);
    const types = dvmSeqAll(ops, [/^if_not$/, /^arg Arg02$/, DVM_NUM, /^bitwise_and$/, /^then /, /^set_local 0x31$/, /^arg Arg01$/, DVM_NUM, /^(mul|div)$/])
      .map(g => ({ mask: val(g[2]), k: val(g[7]), op: g[8].mn }));
    const onlyType = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg02$/, DVM_NUM, /^eq$/]);
    const overDamage = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg01$/, DVM_NUM, /^gt$/]);
    // A Data1 test is a guard where nothing follows it but the damage, and
    // a count where experience is awarded under it (the practice targets).
    const d1 = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg00$/, /^get_field data1/, DVM_NUM, /^lt$/]);
    const xpAt = ops.findIndex(o => /^call_resource GainExp\b/.test(o.text));
    const d1Idx = d1 ? ops.indexOf(d1[0]) : -1;
    const counts = d1 && xpAt > d1Idx && xpAt - d1Idx < 10;
    let xp = null;
    if (xpAt >= 0) { const a = dvmCallArgs(ops, xpAt).find(o => DVM_NUM.test(o.text)); xp = a ? val(a) : null; }
    const hand = (target) => {
      const i = ops.findIndex(o => o.text === 'call_resource ' + target);
      return i < 0 ? null : dvmCallArgs(ops, i).filter(o => DVM_NUM.test(o.text)).map(val);
    };
    const door = hand('0xE49'), chest = hand('0xE4A');
    // A lock of the class's own, as the trapdoor has: Data2 starts at the
    // class's lock figure and the damage is tested against what is left.
    const ownLock = !!dvmSeqFirst(ops, [/^set_field data2/, /^arg Arg00$/, /^end$/, /^arg Arg00$/, /^class_member 0x3400$/]);
    const dataDefault = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^eq$/, /^then /, /^set_field data2/, /^arg Arg00$/, /^end$/, DVM_NUM]);
    const overData2 = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, /^gt$/]);
    const wear = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^div$/, /^gt$/]);
    const becomes = dvmSeqFirst(ops, [/^set_field obj_type/, /^arg Arg00$/, /^end$/, DVM_NUM]);
    const aspects = dvmSeqAll(ops, [/^set_field aspect/, /^arg Arg00$/, /^end$/, DVM_NUM]).map(g => val(g[3]));
    const deletes = !!dvmSeqFirst(ops, [/^sys Delete$/, /^arg Arg00$/]);
    const spillAt = ops.findIndex(o => o.text === 'call_resource 0xE48');
    const says = ops.map(dvmOpString).filter(Boolean);
    let strength = null;
    if (door || ownLock) {
      const lk = cls.data.find(x => x.key === 0x34);
      if (lk && lk.words.length) strength = { v: lk.words[0] & 0x0FFFFFFF, resid: r, at: lk.off };
    } else if (chest && chest.length) strength = chest[chest.length - 1];
    rows.push({ pt, resid: r, at: ops[0].at, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)),
      types, onlyType: onlyType ? val(onlyType[2]) : null, overDamage: overDamage ? val(overDamage[2]) : null,
      data1Below: d1 && !counts ? val(d1[3]) : null, xp, xpWhileBelow: counts ? val(d1[3]) : null,
      rule: door ? 'door' : chest ? 'chest' : ownLock ? 'lock' : dataDefault || overData2 ? 'data2' : 'own',
      strength, data2Default: dataDefault ? val(dataDefault[9]) : null, wear: wear ? val(wear[3]) : null,
      becomes: becomes ? val(becomes[3]) : null, aspects, deletes, spills: spillAt >= 0 ? dvmOpString(dvmCallArgs(ops, spillAt).find(o => /^string/.test(o.mn))) || '' : null,
      says });
  }
  return { rows, door: bashRule(0xE49), chest: bashRule(0xE4A) };
}

/* A data value in a script, read as JavaScript. A `data` block (0x45, a
   16-bit length) holds an array: 0x90, a count, then 4-byte entries, each
   either a pointer (0x98, a byte, a 16-bit offset into the same resource)
   to a C string or to another array, or a 28-bit number. The shops' goods
   lists, the trainers' menus and the bark lists are all this shape; read
   here once so each reader gets the same strings, numbers and nesting. */
function dvmDataValue(d, at, depth) {
  depth = depth || 0;
  if (depth > 6 || at + 2 > d.length) return null;
  if (d[at] === 0x90) {
    const n = d[at + 1], out = [];
    for (let k = 0; k < n; k++) {
      const p = at + 2 + k * 4;
      if (p + 4 > d.length) break;
      if (d[p] === 0x98) out.push(dvmDataValue(d, u16be(d, p + 2), depth + 1));
      else { let w = u32be(d, p) & 0x0FFFFFFF; if (w & 0x08000000) w -= 0x10000000; out.push(w); }
    }
    return out;
  }
  let e = at; while (e < d.length && d[e] !== 0) e++;
  return decodeMacRoman(d.subarray(at, e));
}
// The data blocks in the operands of a call at ops[k], as values, and the
// blocks in the ops before it (a menu built into a local), for a caller
// that wants either.
function dvmCallData(d, off, ops, k, before) {
  const out = [];
  if (before) { for (let j = Math.max(0, k - 60); j < k; j++) if (ops[j][2] === 'data') out.push(dvmDataValue(d, off + ops[j][0] + 3)); }
  else for (let j = k + 1; j < Math.min(ops.length, k + 14); j++) {
    if (ops[j][2] === 'end' && ops[j][1] <= ops[k][1]) break;
    if (ops[j][2] === 'data') out.push(dvmDataValue(d, off + ops[j][0] + 3));
  }
  return out;
}
// The same, each block with the offset of its `data` instruction in the
// resource, for a table that links a value to where it was read.
function dvmCallDataAt(d, off, ops, k, before) {
  const out = [];
  const one = j => ({ value: dvmDataValue(d, off + ops[j][0] + 3), at: off + ops[j][0] });
  if (before) { for (let j = Math.max(0, k - 60); j < k; j++) if (ops[j][2] === 'data') out.push(one(j)); }
  else for (let j = k + 1; j < Math.min(ops.length, k + 14); j++) {
    if (ops[j][2] === 'end' && ops[j][1] <= ops[k][1]) break;
    if (ops[j][2] === 'data') out.push(one(j));
  }
  return out;
}
// Every call of `resid` in every script, with the caller and the ops around it.
function dvmCallSites(target) {
  const out = [];
  if (!ARCHIVE) return out;
  for (let subn = 0; subn < 256; subn++) {
    const mi = ARCHIVE.index[subn];
    if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
    const count = subindexCount(ARCHIVE, subn);
    for (let ri = 0; ri < count; ri++) {
      const resid = ((subn + 1) << 8) | ri;
      let data;
      try { const raw = getResourceBytes(ARCHIVE, resid); if (!raw || !raw.length) continue; data = smartDecrypt(raw, resid).data; if (dvmNamedScript(data)) continue; } catch (e) { continue; }
      let disc; try { disc = dvmDiscover(data, resid); } catch (e) { continue; }
      if (disc.tableOffset === null) continue;
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (disc.kinds[off] !== 'function') continue;
        let end = data.length; for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops; try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        const want = new RegExp('0x' + target.toString(16).toUpperCase().padStart(3, '0') + '\\b|\\(0x' + target.toString(16).toUpperCase() + '\\)', 'i');
        ops.forEach((op, k) => { if (op[2] === 'call_resource' && want.test(String(op[3]))) out.push({ resid, subn, data, off, ops, k }); });
      }
    }
  }
  return out;
}

/* LOCKPICKING. One helper, PickLock (0xE43), takes a key or a pick, a key
   number (255 for a pick) and the lock. A key fits when the lock's number
   is the key's plus the number given. A pick succeeds when the picker's
   reflex plus a roll of 0 to 19 is at least 20 plus another roll of 0 to
   19 plus 5 for every 20 of the lock's difficulty, and breaks otherwise;
   the lockpick item refuses to be used at all without the Lock Picking
   skill (0x1109). The difficulty is the placed lock's own data1; the
   classes carry a lock parameter of their own, shown as stored. */
function lockRules() {
  const idx = buildScriptTextIndex();
  const pick = idx.find(e => e.resid === 0xE43);
  const item = idx.find(e => e.resid === 0x1109);
  // reflex + Random(0, pickRoll) >= base + Random(0, lockRoll) + (data1 + addend) / per * step
  const f = pick ? dvmSeqFirst(dvmOpsOf(pick), [/^local Var\w+$/, /^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/, /^add$/, DVM_NUM, /^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/, /^add$/,
    /^arg Arg\d+$/, /^get_field data1/, DVM_NUM, /^add$/, DVM_NUM, /^div$/, DVM_NUM, /^mul$/, /^add$/, /^lt$/]) : null;
  const v = k => dvmVal(0xE43, f[k]);
  const numbers = f ? { pickRoll: v(3), base: v(6), lockRoll: v(9), addend: v(14), per: v(16), step: v(18) } : null;
  const rule = pick ? { breaks: /The lockpick broke/.test(pick.text), keyFits: /The key doesn't fit/.test(pick.text),
    formula: !!(f && /get_field reflex/.test(pick.text)), numbers,
    lk: numbers ? { pickRoll: numbers.pickRoll.v, base: numbers.base.v, lockRoll: numbers.lockRoll.v, addend: numbers.addend.v, per: numbers.per.v, step: numbers.step.v } : null } : null;
  const needsSkill = !!(item && /GetSkill[\s\S]{0,140}short 0x00D5/.test(item.text));
  const classes = [];
  for (let pt = 1; pt < 512; pt++) {
    const cls = parseItemClass(pt); if (!cls) continue;
    const f = cls.data.find(x => x.key === 0x34);
    if (f) classes.push({ pt, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)), words: f.words.map(w => w & 0x0FFFFFFF), src: { resid: cls.resid, at: f.off } });
  }
  return { rule, needsSkill, classes };
}

/* SHOPS. Every vendor calls one helper, 0xEA5, with a name for the shop, a
   list of goods -- each a prop word, a name, a price and a count -- and
   four bargaining figures of its own. The helper's arithmetic is the
   game's; what is shown is what each vendor lists and at what price, and
   that the Haggling skill (0xCC) takes a further roll of 0 to 5 off the
   vendor's figure, which the helper's own code says. */
function shopRules() {
  const shops = [];
  for (const site of dvmCallSites(0xEA5)) {
    const { resid, subn, data, off, ops, k } = site;
    const title = ops[k + 1] && ops[k + 1][2] === 'string' ? (() => { try { return JSON.parse(ops[k + 1][3]); } catch (e) { return ''; } })() : '';
    const blocks = dvmCallDataAt(data, off, ops, k, false);
    const gb = blocks.find(b => Array.isArray(b.value) && b.value.length && Array.isArray(b.value[0]));
    const goods = (gb ? gb.value : []).filter(g => Array.isArray(g) && g.length >= 3)
      .map(g => ({ word: g[0], name: String(g[1]), price: g[2], count: g[3], src: { resid, at: gb.at } }));
    const tb = blocks.find(b => Array.isArray(b.value) && b.value.length === 4 && b.value.every(x => typeof x === 'number')) || null;
    if (goods.length) shops.push({ resid, who: subn === 23 ? resid & 0xFF : null, title, goods, terms: tb ? tb.value : null, termsSrc: tb ? { resid, at: tb.at } : null });
  }
  // Haggling: after GetSkill of skill 0xCC, a Random(0, n) taken off the figure.
  const ho = dvmOpsOf(dvmScriptEntry(0xEA5));
  const hi = ho.findIndex(o => /^short (?:0x00CC|204)$/i.test(o.text));
  const hg = hi < 0 ? null : dvmSeqFirst(ho.slice(hi, hi + 12), [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM]);
  const haggling = hg ? dvmVal(0xEA5, hg[2]) : null;
  return { shops, haggling };
}

/* TRAINING. Every teacher calls one helper, 0xEB1, with the pupil, their
   own name, a skill and whether they teach it to mastery; a skill named as
   a constant is one lesson on offer, and a menu of them is a data list of
   name-and-skill pairs built just before the call. A lesson costs one
   training point (0xEAF): a character is made with 4 (the hero's script),
   gains 6 less the difficulty level with each level (0xE86), and a skill
   is mastered at level 15. */
function trainingRules() {
  const byTeacher = new Map();
  for (const site of dvmCallSites(0xEB1)) {
    const { resid, subn, data, off, ops, k } = site;
    const who = subn === 23 ? resid & 0xFF : null;
    const key = resid;
    if (!byTeacher.has(key)) byTeacher.set(key, { resid, who, skills: new Map() });
    const t = byTeacher.get(key);
    const args = ops.slice(k + 1, k + 8);
    const mastery = args.some(o => o[2] === 'word' && /True/.test(String(o[3])));
    const constant = args.find(o => o[2] === 'short');
    if (constant) { const id = parseInt(constant[3], 16); if (id >= 0xC0 && id <= 0xD6) t.skills.set(id, mastery || t.skills.get(id) || false); continue; }
    for (const b of dvmCallData(data, off, ops, k, true)) {
      if (!Array.isArray(b)) continue;
      for (const e of b) if (Array.isArray(e) && e.length === 2 && typeof e[1] === 'number' && e[1] >= 0xC0 && e[1] <= 0xD6) t.skills.set(e[1], mastery || t.skills.get(e[1]) || false);
    }
  }
  // The points, each off its own line: gained with a level (0xE86, n less
  // the difficulty level), given at creation (the hero's script), taken by a
  // lesson and the aspect that is mastery (0xEAF).
  const at = (resid, pat, k) => { const g = dvmSeqIn(resid, pat); return g ? dvmVal(resid, g[k]) : null; };
  const perLevel = at(0xE86, [/^get_field training/, DVM_NUM, /^global DifficultyLevel/, /^sub$/], 1);
  const atStartVal = at(0x1801, [/^set_field training/, /^arg Arg00$/, /^end$/, DVM_NUM], 3);
  const perLessonVal = at(0xEAF, [/^get_field training/, DVM_NUM, /^sub$/], 1);
  const masteryVal = at(0xEAF, [/^get_field aspect/, DVM_NUM, /^eq$/], 1);
  const points = {
    perLevel, atStart: atStartVal ? atStartVal.v : null, atStartVal,
    perLesson: perLessonVal ? perLessonVal.v : null, perLessonVal,
    mastery: masteryVal ? masteryVal.v : null, masteryVal
  };
  return { teachers: [...byTeacher.values()], points };
}

/* COMBAT. Three routines. 0xE88 (melee) and 0xE89 (missile) work out the
   attacker's margin: reflex -- body, for a monster flagged so -- plus the
   weapon's skill (Barehand for no weapon, Missile for a launcher) plus a
   roll of 0 to 29, less the defender's reflex plus a roll of 0 to 29, plus
   the attacker's Attack skill less the defender's Defence (0xE84, each a
   class figure where the skill is absent). 0xE87 resolves it: every shield
   the defender wears blocks a roll of 0 to its block plus the Shield skill,
   and a margin under that is parried; the weapon's enchantment and skill
   are added to the margin and the skill to the damage; a margin of nothing
   or less misses; a hit does a roll of 0 to the damage figure plus the
   enchantment, named grazed, hit, hit hard, very hard, extremely hard,
   crushed, smashed, ground to dust or shredded by thresholds of 3, 6, 9,
   12, 16, 20, 25 and 35; ResistDamage takes the type; experience follows. */
function combatRules() {
  const melee = dvmScriptEntry(0xE88), missile = dvmScriptEntry(0xE89), resolve = dvmScriptEntry(0xE87);
  if (!melee || !missile || !resolve) return null;
  const mo = dvmOpsOf(melee), so = dvmOpsOf(missile), ro = dvmOpsOf(resolve);
  // Each side's roll, attacker's first: `Random(0, n)` in the blow's margin.
  const rolls = (ops, r) => dvmSeqAll(ops, [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/]).map(g => dvmVal(r, g[2]));
  const mr = rolls(mo, 0xE88), sr = rolls(so, 0xE89);
  const roll = mr[0] || null, rollDefender = mr[1] || null;
  const barehand = /short (?:0x00C7|199)\b/.test(melee.text), missileSkill = /short (?:0x00C8|200)\b/.test(missile.text);
  const parry = /parries/.test(resolve.text) && /class_member 0x2F00/.test(resolve.text) && /class_member 0x2F01/.test(resolve.text);
  // The damage: Random(0, the figure) plus this, then the enchantment.
  const add = dvmSeqFirst(ro, [/^sys Random$/, /^byte (?:0x00|0)$/, /^arg Arg04$/, /^end$/, DVM_NUM, /^add$/]);
  // The blow words: `if (roll < n) word = "..."`, with the suffix a second
  // local takes where there is one (" hard", " to dust"), then the word for
  // everything past the last threshold.
  const words = [];
  let lastIdx = -1;
  for (const g of dvmSeqAll(ro, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^lt$/, /^then /, /^set_local /, /^string /, /^end$/])) {
    const w = dvmOpString(g[6]);
    if (w === null || !/^[a-z]/.test(w)) continue;
    const i = ro.indexOf(g[7]);
    const suf = dvmSeq(ro, i + 1, [/^set_local /, /^string /, /^end$/]);
    words.push({ below: dvmNum(g[2]), word: w + (suf ? dvmOpString(suf[1]) || '' : ''), val: dvmVal(0xE87, g[2]) });
    lastIdx = suf ? i + 3 : i;
  }
  let last = null;
  if (lastIdx >= 0) {
    const g = dvmSeqFirst(ro, [/^branch /, /^set_local /, /^string /, /^end$/], lastIdx + 1);
    if (g) {
      const i = ro.indexOf(g[3]);
      const suf = dvmSeq(ro, i + 1, [/^set_local /, /^string /, /^end$/]);
      last = { word: dvmOpString(g[2]) + (suf ? dvmOpString(suf[1]) || '' : ''), resid: 0xE87, at: g[2].at };
    }
  }
  /* The weapon's skill, as the resolver actually reads it. It adds
     `0xEAC(attacker, <thing>.MeleeWeapon[3])` to the margin and to the damage
     figure, and the thing is meant to be the weapon, Arg02. In the shipped
     0xE87 it is not: both terms read the local the shield loop above them
     assigns from EquipmentIterator. Traced through the interpreter on
     17 September 2026 rather than guessed: every exit from that loop follows
     an iterator call that ran off the end and returned None (cbWorn), the
     class_member opcode answers None for anything that is not a prop, and
     cbGetSkill passes None's low half, -1, to FindSkill, which matches no
     skill, so 0xEAC returns 0. An armed blow therefore gets nothing from
     Sword, Axe or Mace; Barehand is added in 0xE88 and Missile in 0xE89, and
     both work. That is what 453 measured on the board (topic 2044). Read as
     a shape, so a resolver that reads Arg02 finds nothing here. */
  const iterSet = dvmSeqAll(ro, [/^set_local 0x[0-9A-F]+$/i, /^sys EquipmentIterator$/]).map(g => parseInt(g[0].text.split(' ')[1], 16));
  const skillOffLoop = dvmSeqAll(ro, [/^call_resource 0xEAC$/, /^arg Arg00$/, /^local Var[0-9A-F]+$/i, /^class_member 0x2A03$/])
    .filter(g => iterSet.includes(parseInt(g[2].text.slice('local Var'.length), 16)))
    .map(g => ({ resid: 0xE87, at: g[2].at }));
  /* Body for reflex. 0xE88 starts the attacker's side from its reflex and
     puts its body there instead when a bit of its unit's field 0x33 is set:
     `get_field 0x33`, the bit, `bitwise_and`, and in the branch `get_field
     body`. Only the attacker's: the defender's side is always its reflex.
     Field 0x33 is the top half of the unit's flag word (exeMonsterFields),
     so the bit is 0x10000 of the word; which units carry it is the unit
     table's (monsterTopFlagSites). Counted in the fork on 27 September
     2026: a fighter's blows missed 16.9% of 496 times, against 17.0% with
     his body and 25.7% with his reflex. */
  const bfr = dvmSeqFirst(mo, [/^get_field 0x33$/, DVM_NUM, /^bitwise_and$/, /^then /, /^set_local 0x[0-9A-F]+$/i, /^arg Arg00$/, /^get_field body\b/]);
  return { d30: !!(roll && rollDefender && sr.length >= 2), roll, rollDefender, missileRolls: sr.slice(0, 2),
           barehand, missileSkill, parry, dmgAdd: add ? dvmVal(0xE87, add[4]) : null, words, last,
           skillOffLoop: skillOffLoop.length ? skillOffLoop : null, bodyForReflex: bfr ? dvmVal(0xE88, bfr[1]) : null };
}

/* THE ATTACK ITSELF. Before a blow or a missile is resolved, one routine
   (0x3042, called by nothing in the archive, so the executable's, and the
   only caller of 0xE88 and 0xE89) decides what is swung or thrown. It takes
   the squared distance from 0xE8C (dx² + dy²) less one, and walks the
   attacker's equipment for the first melee entry whose reach squared is at
   least that; that weapon swings, its damage figure plus a roll of 0 to
   (body − 12) / 4 (0xE90). Only when nothing reached, the target is beyond
   the adjacent squares and in sight, does it walk again for a thrown entry
   whose range squared covers the distance: the item's own tile flies
   (ShootEffect), the missile margin resolves it with the Missile skill and a
   roll of 0 to (reflex − 12) / 4, and then the item is moved -- into the
   target's inventory (flags 9, container the target) when the outcome
   routine answered true, which it does for a hit and for a parry, or onto
   the target's square (flags 1) when it missed. A launcher is the same
   branch with its ammunition spent one a shot. Read 9 September 2026 after
   the maintainer's mystic spear flew at a target that had stepped away.
   Every number here is read off the listing rather than typed, so an edited
   archive states its own rule, and a pattern that stops matching drops the
   sentence instead of misstating it. */
function attackRules() {
  const idx = buildScriptTextIndex();
  const atk = idx.find(e => e.resid === 0x3042), dist = idx.find(e => e.resid === 0xE8C), scale = idx.find(e => e.resid === 0xE90);
  if (!atk) return null;
  const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
  const a = strip(atk.text), d = dist ? strip(dist.text) : '', sc = scale ? strip(scale.text) : '';
  const squared = /get_field x \(0x1\)[\s\S]{0,60}sub[\s\S]{0,60}mul[\s\S]{0,80}get_field y \(0x2\)[\s\S]{0,60}sub[\s\S]{0,60}mul[\s\S]{0,60}add/.test(d);
  const lessOne = /call_resource 0xE8C[\s\S]{0,60}?end\s+end\s+set_local 0x02\s+local Var02\s+byte 0x01\s+sub/.test(a);
  const test = k => new RegExp('class_member 0x' + k + '01\\s+local Var03\\s+class_member 0x' + k + '01\\s+mul\\s+local Var02\\s+ge').test(a);
  const reach = test('2A'), range = test('2B'), launcher = test('2E');
  const meleeAt = a.indexOf('call_resource 0xE88'), thrownAt = a.indexOf('has_member ThrownWeapon');
  const meleeFirst = meleeAt >= 0 && thrownAt > meleeAt;
  const beyondAdjacent = /local Var02\s+byte 0x01\s+gt/.test(a) && /sys HasSightLine/.test(a);
  const flies = /sys ShootEffect[\s\S]{0,240}get_field tile \(0xA\)[\s\S]{0,160}call_resource 0xE89/.test(a);
  const lodges = /call_resource 0xE89[\s\S]{0,400}?then -> 0x[0-9A-F]+\s+set_field flags \(0x0\)\s+local Var03\s+end\s+byte 0x09\s+end\s+set_field container \(0xB\)/.test(a);
  const drops = /set_field flags \(0x0\)\s+local Var03\s+end\s+byte 0x01\s+end\s+set_field x \(0x1\)/.test(a);
  const bodyRoll = /call_resource 0xE88[\s\S]{0,160}class_member 0x2A00\s+sys Random\s+byte 0x00\s+call_resource 0xE90\s+arg Arg00\s+get_field body/.test(a);
  const reflexRoll = /class_member 0x2B00\s+sys Random\s+byte 0x00\s+call_resource 0xE90\s+arg Arg00\s+get_field reflex/.test(a);
  // (stat - n) / m, with the two numbers' lines.
  const scm = sc ? dvmSeqIn(0xE90, [DVM_NUM, /^sub$/, DVM_NUM, /^div$/]) : null;
  const one = dvmSeqIn(0x3042, [/^set_local 0x02$/, /^local Var02$/, DVM_NUM, /^sub$/]);
  // The + 1 after the scale, which is what makes the body roll's top
  // inclusive: Random(0, 0xE90(body) + 1). The combat figure needs it as a
  // number, to know how many values the roll takes.
  const bodyAdd = dvmSeqIn(0x3042, [/^call_resource 0xE90$/, /^arg Arg00$/, /^get_field body\b/, /^end$/, DVM_NUM, /^add$/]);
  const ammoSpent = /set_field quantity \(0x9\)[\s\S]{0,60}byte 0x01[\s\S]{0,500}sys Delete/.test(a);
  return { squared, lessOne, reach, range, launcher, meleeFirst, beyondAdjacent, flies, lodges, drops, bodyRoll, reflexRoll,
    scale: scm ? { sub: dvmNum(scm[0]), div: dvmNum(scm[2]), subVal: dvmVal(0xE90, scm[0]), divVal: dvmVal(0xE90, scm[2]) } : null,
    lessOneVal: one ? dvmVal(0x3042, one[2]) : null, bodyAddVal: bodyAdd ? dvmVal(0x3042, bodyAdd[4]) : null, ammoSpent };
}

/* WHAT A SPELL OR A USE CAN BE AIMED AT. A script that wants a target says
   so by what it returns: it prints its question ("Cast 'Healing' on whom?",
   "Use lock pick on what?") and returns a word, which the application keeps
   until the next click and tests bit by bit before it accepts the square or
   the thing under the pointer. So the word is read off each script here,
   with the line that holds it, and the bits are named below.

   The names come from the application's own tests, read there rather than
   guessed: TDroppableWindow::NeedsTarget stores the word, and
   MouseRoutine tests it -- 0x8000 against CanSearch, which is the same
   within-reach test that decides whether an item can be dragged (the three
   by three squares around the character), 0x4000 against
   TViewer::IsStraightAbs, and the low bits against what is under the
   pointer. Bit 8 is left unnamed on purpose: its four users are the things
   you hand to a person, and what the application tests for it is a flag on
   the character whose meaning is not established, so it prints as hex.

   Why it is worth a section: it is the difference between a spell you can
   cast across the room and one that needs a neighbour, which no other part
   of the file states. */
const TARGET_BIT_NAMES = [
  [0x8000, 'within reach'],
  [0x4000, 'in a straight line'],
  [0x0004, 'a character'],
  [0x0002, 'a square'],
  [0x0001, 'a thing']
];
function targetWordWords(word) {
  const bits = [];
  let left = word;
  for (const [mask, name] of TARGET_BIT_NAMES) if (word & mask) { bits.push(name); left &= ~mask; }
  for (let b = 1; b <= 0x8000; b <<= 1) if (left & b) bits.push('bit ' + propWordHex(b));
  return bits;
}
function targetRules() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    // The prompt, then the return and its constant. Every match is looked
    // at rather than the first, because a class's Examine prints its own
    // lines and returns 0 from the same shape earlier in the resource --
    // the unguent's does, and taking the first match dropped it entirely.
    // A question mark is what marks the prompt, and a word of 0 is a script
    // that wants no target.
    let g = null, prompt = null;
    for (const cand of dvmSeqAll(ops, [/^string(?:\(implicit\))? "/, /^return$/, DVM_NUM])) {
      const s = dvmOpString(cand[0]);
      if (s && /\?$/.test(s.trim()) && dvmNum(cand[2])) { g = cand; prompt = s; break; }
    }
    if (!g) continue;
    const val = dvmVal(e.resid, g[2]);
    if (!val || !val.v) continue;
    const pt = e.resid >= 0x1000 && e.resid < 0x1200 ? e.resid - 0x1000 : null;
    out.push({ resid: e.resid, pt, prompt: prompt.trim(), word: val.v, val,
               name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (selfNameFor(e.resid) || labelFor(e.resid) || ('0x' + e.resid.toString(16).toUpperCase())),
               kind: pt !== null ? 'item' : 'spell' });
  }
  out.sort((a, b) => (b.word & 0x8000) - (a.word & 0x8000) || a.word - b.word || a.name.localeCompare(b.name));
  return out;
}
// The target word one script returns, for that item's or spell's own page.
function targetOf(resid) {
  try { return targetRules().find(t => t.resid === resid) || null; } catch (e) { return null; }
}
/* The walk that would close the distance. With a target out of reach the
   click handler calls TGameSys::WalkToLocation, and in the shipped program
   that routine is two instructions: it answers false and does nothing, so
   the click is refused instead. Read rather than stated: a build where it
   was implemented would have a body and this returns null. */
function exeWalkStub() {
  const ops = exeOpsNamed('TGameSys::WalkToLocation');
  if (!ops.length || ops.length > 4) return null;
  const li = ops.findIndex(o => o.d && o.d.mn === 'li' && o.d.rd === 3 && o.d.imm === 0);
  const ret = ops.findIndex(o => o.d && /^blr$/.test(o.d.mn));
  return li >= 0 && ret > li ? { at: exeVal(ops[li], 0), ops: ops.length } : null;
}

/* WHAT THE GROUND DOES. Walking is the application's, but the damage a
   square does is a script: the default method 0x301F takes the character
   and a code for what they stepped on. Two codes do something -- a range
   for the swamp, one value for lava -- and everything else is a prop, whose
   UseOn runs with the character on it, which is how a rune goes off.

   Both are guarded by a character flag (the disassembler names them) and by
   a monster's own immunity, and both hand their damage to TakeDamage
   directly rather than through ResistDamage, so armour takes nothing off
   either. Read after a Discord conversation about a game played without
   magic, where the swamp and the Lake of Fire were the two things that
   could not be avoided. */
function terrainRules() {
  const e = dvmScriptEntry(0x301F);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x301F, op);
  const flagName = dvmFlagNameOfOp;
  // The swamp: a code between two bounds, a flag, an immunity, a roll.
  const band = dvmSeqFirst(ops, [DVM_NUM, /^arg Arg01$/, /^le$/, /^arg Arg01$/, DVM_NUM, /^le$/, /^and$/]);
  const guard = k => dvmSeqFirst(ops, [/^sys TestFlag$/, /^arg Arg00$/, DVM_NUM, /^end$/, /^not$/], k);
  const swampGuard = band ? guard(ops.indexOf(band[6])) : null;
  const chance = dvmSeqFirst(ops, [/^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/]);
  const bite = dvmSeqFirst(ops, [/^method TakeDamage/, /^arg Arg00$/, DVM_NUM, DVM_NUM]);
  const poison = dvmSeqFirst(ops, [/^sys SetFlag$/, /^arg Arg00$/, DVM_NUM]);
  const saysBit = ops.map(dvmOpString).filter(Boolean);
  // Lava: one code, its own flag, and a roll for the damage.
  const lavaAt = dvmSeqFirst(ops, [/^arg Arg01$/, DVM_NUM, /^eq$/]);
  const lavaGuard = lavaAt ? guard(ops.indexOf(lavaAt[2])) : null;
  const burn = dvmSeqFirst(ops, [/^method TakeDamage/, /^arg Arg00$/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^add$/, DVM_NUM]);
  const onProp = /method UseOn/.test(e.text);
  return {
    resid: 0x301F,
    swamp: band && bite ? {
      from: val(band[0]), to: val(band[4]),
      flag: swampGuard ? val(swampGuard[2]) : null, flagName: swampGuard ? flagName(swampGuard[2]) : null,
      chance: chance ? { lo: val(chance[1]), hi: val(chance[2]), is: val(chance[4]) } : null,
      damage: val(bite[2]), type: val(bite[3]),
      poison: poison ? val(poison[2]) : null, poisonName: poison ? flagName(poison[2]) : null,
      says: saysBit[0] || ''
    } : null,
    lava: lavaAt && burn ? {
      code: val(lavaAt[1]),
      flag: lavaGuard ? val(lavaGuard[2]) : null, flagName: lavaGuard ? flagName(lavaGuard[2]) : null,
      roll: { lo: val(burn[3]), hi: val(burn[4]) }, plus: val(burn[6]), type: val(burn[8]),
      says: saysBit[1] || ''
    } : null,
    onProp
  };
}

/* THE WATER. One class (0x1036) is every fountain and spring in the game,
   and the placed prop's Data1 picks which water it is: the plain kinds say
   something and do nothing, one poisons, one heals, one is a wishing well,
   and one clears four statuses at once. Read as a list of kinds because
   that is how the script is written -- a chain of tests on the Data1 -- so
   each kind's words and effects are what lies between its test and the
   next. The census underneath is the placed props, so an edited archive
   shows its own.

   One kind is not a constant at all: it asks the game's own state and
   answers with another kind, which is how Catamarca's water turns from
   brackish to fresh over the course of the game. */
function springRules() {
  const e = dvmScriptEntry(0x1036);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x1036, op);
  const flagName = dvmFlagNameOfOp;
  // Each kind's test: `if_not (the Data1 local == n)`, in the order written.
  const tests = dvmSeqAll(ops, [/^if_not$/, /^local Var00$/, DVM_NUM, /^eq$/]).map(g => ({ at: ops.indexOf(g[0]), kind: dvmNum(g[2]), val: val(g[2]) }));
  if (!tests.length) return null;
  const kinds = [];
  for (let i = 0; i < tests.length; i++) {
    const from = tests[i].at, to = i + 1 < tests.length ? tests[i + 1].at : ops.length;
    const span = ops.slice(from, to);
    const says = span.map(dvmOpString).filter(Boolean);
    const heal = dvmSeqFirst(span, [/^set_field health/, /^local Var\w+$/, /^end$/, /^local Var\w+$/, /^get_field health/, /^sys Random$/, DVM_NUM, DVM_NUM]);
    const food = dvmSeqFirst(span, [/^set_field nutrition/, /^local Var\w+$/, /^end$/, /^local Var\w+$/, /^get_field nutrition/, DVM_NUM, /^add$/]);
    const cap = dvmSeqFirst(span, [/^get_field nutrition/, DVM_NUM, /^lt$/]);
    const sets = dvmSeqAll(span, [/^sys SetFlag$/, /^global CurrentCharacter/, DVM_NUM]).map(g => ({ val: val(g[2]), name: flagName(g[2]) }));
    const clears = dvmSeqAll(span, [/^sys ClearFlag$/, /^local Var\w+$/, DVM_NUM]).map(g => ({ val: val(g[2]), name: flagName(g[2]) }));
    const hurt = dvmSeqFirst(span, [/^call_resource 0x3041$/, /^global CurrentCharacter/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^add$/, DVM_NUM]);
    const wish = span.some(o => /^sys OpenConversation$/.test(o.text));
    const chance = wish ? dvmSeqFirst(span, [/^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/]) : null;
    kinds.push({ kind: tests[i].kind, val: tests[i].val, says,
      heal: heal ? { lo: val(heal[6]), hi: val(heal[7]) } : null,
      food: food ? { plus: val(food[5]), below: cap ? val(cap[1]) : null } : null,
      sets, clears, wish,
      hurt: hurt ? { lo: val(hurt[3]), hi: val(hurt[4]), plus: val(hurt[6]), type: val(hurt[8]) } : null,
      chance: chance ? { lo: val(chance[1]), hi: val(chance[2]), is: val(chance[4]) } : null });
  }
  // The kind that asks the game's state, and what sets that state.
  const gate = dvmSeqFirst(ops, [/^sys GetState$/, DVM_NUM, /^end$/, DVM_NUM, /^lt$/]);
  let setter = null;
  if (gate) {
    const which = dvmNum(gate[1]);
    for (const en of buildScriptTextIndex()) {
      const g = dvmSeqFirst(dvmOpsOf(en), [/^sys SetState$/, DVM_NUM, DVM_NUM]);
      if (g && dvmNum(g[1]) === which && en.resid !== 0x1036) {
        const pt = en.resid >= 0x1000 && en.resid < 0x1200 ? en.resid - 0x1000 : null;
        setter = { resid: en.resid, pt, name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (labelFor(en.resid) || ''), to: dvmVal(en.resid, g[2]) };
        break;
      }
    }
  }
  // Where they are, by kind: the placed records of this class.
  const placed = new Map();
  try {
    for (let z = 1; z < 0x100; z++) {
      const praw = refExists(0x8100 + z) ? getResourceBytes(ARCHIVE, 0x8100 + z) : null;
      if (!praw) continue;
      for (const r of parseDelverPropList(smartDecrypt(praw, 0x8100 + z).data)) {
        if (r.proptype !== 0x36 || !r.onMap || r.flags === 0xFF || (r.flags & 0x40)) continue;
        if (!placed.has(r.d1)) placed.set(r.d1, []);
        placed.get(r.d1).push({ zone: 0x8000 + z, x: r.x, y: r.y });
      }
    }
  } catch (err) { /* an archive with no prop lists says nothing about where */ }
  return { kinds, gate: gate ? { state: val(gate[1]), below: val(gate[3]) } : null, setter, placed };
}

/* A CURE THAT MIGHT NOT WORK. A script that clears a status behind a roll
   is a cure with a chance, and the unguent is the one the game has: it
   heals a little and, if the character is poisoned, takes the poison away
   one time in five. Read as the roll it is, because the chance is what a
   player wants to know and it is nowhere in the interface. */
function chanceCures() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    const g = dvmSeqFirst(ops, [/^sys TestFlag$/, /^local Var\w+$/, DVM_NUM, /^end$/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/, /^and$/]);
    if (!g) continue;
    const clear = dvmSeqFirst(ops, [/^sys ClearFlag$/, /^local Var\w+$/, DVM_NUM], ops.indexOf(g[10]));
    if (!clear) continue;
    const flag = dvmFlagNameOfOp(g[2]);
    const pt = e.resid >= 0x1000 && e.resid < 0x1200 ? e.resid - 0x1000 : null;
    out.push({ resid: e.resid, pt, name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (labelFor(e.resid) || ''),
               flag, lo: dvmVal(e.resid, g[5]), hi: dvmVal(e.resid, g[6]), is: dvmVal(e.resid, g[8]) });
  }
  return out;
}

/* WHAT WEARING IT DOES. A few classes set a character flag in their Wear
   method and clear it again when the thing comes off: that is the whole of
   what protective clothing is in this game, and it is not in any field the
   item page shows. Read per class and per method, so the page can say it
   on the item's own page and in one table. */
function grantRules() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    if (!cls || !cls.code.length) continue;
    const ops = dvmOpsOf(dvmScriptEntry(cls.resid));
    for (const m of cls.code) {
      const mine = ops.filter(o => o.obj === m.off);
      if (!mine.length) continue;
      const sets = dvmSeqAll(mine, [/^sys SetFlag$/, /^arg Arg\d+$/, DVM_NUM]).map(g => g[2]);
      if (!sets.length) continue;
      for (const op of sets) {
        const name = dvmFlagNameOfOp(op);
        // The method that takes it away again, where the class has one: the
        // same flag cleared in another of its methods. Without this the page
        // would have to say "while worn" on faith.
        let clearedBy = null;
        for (const other of cls.code) {
          if (other.key === m.key) continue;
          const theirs = ops.filter(o => o.obj === other.off);
          if (dvmSeqAll(theirs, [/^sys ClearFlag$/, /^arg Arg\d+$/, DVM_NUM]).some(g => dvmNum(g[2]) === dvmNum(op))) { clearedBy = itemFieldLabel(other.key); break; }
        }
        rows.push({ pt, resid: cls.resid, key: m.key, method: itemFieldLabel(m.key), clearedBy,
                    name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)),
                    flag: dvmVal(cls.resid, op), flagName: name });
      }
    }
  }
  return rows;
}

/* WHAT A BOMB DOES. The one thing in the game that damages a square rather
   than a target: when its fuse runs out it walks the three by three around
   itself and hands each square a figure, the biggest on its own square. The
   three figures and the damage type are read off the script; which figure
   belongs to which ring is read off the guards, so a changed script says
   what it now does rather than what this one did. */
function blastRules() {
  const e = dvmScriptEntry(0x1142);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x1142, op);
  const both = dvmSeqFirst(ops, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^and$/, /^then /, /^set_local 0x08$/, DVM_NUM]);
  const either = dvmSeqFirst(ops, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^or$/, /^then /, /^set_local 0x08$/, DVM_NUM]);
  const rest = dvmSeqAll(ops, [/^set_local 0x08$/, DVM_NUM]).map(g => g[1])
    .filter(op => (!both || op !== both[10]) && (!either || op !== either[10]));
  const hit = dvmSeqFirst(ops, [/^call_resource 0xEB8$/, /^local Var\w+$/, /^local Var\w+$/, DVM_NUM]);
  const span = dvmSeqFirst(ops, [/^sys RangeIterator$/, /^word &Var\w+$/, DVM_NUM, DVM_NUM, DVM_NUM]);
  if (!both || !hit) return null;
  return { resid: 0x1142, centre: val(both[10]), edge: either ? val(either[10]) : null, corner: rest.length ? val(rest[0]) : null,
           type: val(hit[3]), side: span ? val(span[4]) : null,
           fuse: (dvmSeqFirst(ops, [/^set_field data1/, /^arg Arg00$/, /^end$/, DVM_NUM]) || [])[3] ? val(dvmSeqFirst(ops, [/^set_field data1/, /^arg Arg00$/, /^end$/, DVM_NUM])[3]) : null };
}

/* THE TO DO LIST. A character's script appends a line with the syscall
   delvmod names AddQuest, which the application calls cbAddToDo and which
   reaches TToDo::AddToDo. Its first operand is the slot, and the slot is
   used as handed -- the entry is base + slot * 8 -- so the number in the
   script is the number in the saved game. Its second operand is a reference
   into a text array, written `0x021A[0] + n`, and n is the line.

   Slot and line are usually the same number. Six sites pass a different
   line, so one slot reads differently depending on who told you, and one
   site composes the line from a quest value, which is how the ten lines
   counting the Books of Wisdom are reached when no script names them. The
   text array is joined by its own index field, which is not its position in
   the array beyond entry 37. Nothing here is a "quest": these calls touch
   neither the quest values nor the quest flags. */
function todoRules() {
  const adds = [], dones = [];
  let textResid = null;
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    for (let i = 0; i < ops.length; i++) {
      const t = ops[i].text;
      if (/^sys CompleteQuest$/.test(t) && ops[i + 1] && DVM_NUM.test(ops[i + 1].text)) {
        dones.push({ resid: e.resid, slot: dvmVal(e.resid, ops[i + 1]) });
        continue;
      }
      if (!/^sys AddQuest$/.test(t)) continue;
      const slotOp = ops[i + 1], refOp = ops[i + 2], idxOp = ops[i + 3];
      if (!slotOp || !refOp || !idxOp || !DVM_NUM.test(slotOp.text) || !DVM_NUM.test(idxOp.text)) continue;
      // The text reference renders as the resource and an index; the array
      // is read off whichever resource the scripts themselves name.
      const m = /(0x[0-9A-Fa-f]+)\[(\d+)\]\s*$/.exec(refOp.text);
      if (!m) continue;
      if (textResid === null) textResid = parseInt(m[1], 16);
      const state = ops[i + 4] && /^sys GetState$/.test(ops[i + 4].text) && ops[i + 5] && DVM_NUM.test(ops[i + 5].text)
        ? dvmVal(e.resid, ops[i + 5]) : null;
      adds.push({ resid: e.resid, slot: dvmVal(e.resid, slotOp), line: dvmVal(e.resid, idxOp), base: +m[2], state });
    }
  }
  let lines = null;
  if (textResid !== null && refExists(textResid)) {
    try {
      const d = smartDecrypt(getResourceBytes(ARCHIVE, textResid), textResid);
      lines = new Map(parseDelverTextArray(d.data).map(x => [x.index, x.str]));
    } catch (err) { lines = null; }
  }
  return { adds, dones, textResid, lines };
}

/* EGGS. A prop record with flags 0x42 is not a thing standing on a square
   but a trigger: its aspect is the kind and its low ten bits the kind's
   argument. The file says neither, so the names below are this page's, from
   the eleven handlers TGameViewer::DrawRoutine dispatches through (the
   workbench's save-format.md has each handler's address and what it does).
   Everything stated on the sheet -- which kinds are used, their arguments,
   how many of each -- is counted off the archive here, so an archive that
   places eggs differently says so. Flags 0x44 is ROOF and is not an egg. */
const EGG_KIND_NAMES = [
  { what: 'hatches a monster' },
  { what: 'a way to another place', arg: 'zoneport' },
  { what: 'signals the zone’s script when stood on', arg: 'signal' },
  { what: 'an ambient sound', arg: 'sound' },
  { what: 'changes zone', arg: 'zone' },
  { what: 'plays music', arg: 'tune' },
  { what: 'signals the zone’s script from anywhere inside it', arg: 'signal' },
  { what: 'brings neighbors in when a condition holds' },
  { what: 'a room', arg: 'room' },
  { what: 'nothing' },
  { what: 'counts down' }
];

/* What one egg does, in full. The kind is the aspect and the argument is the
   bits a thing would keep its prop type in; past that, each kind reads its
   own fields, and two of them are worth saying out loud.

   A HATCHING egg holds its monsters as contained records, the way a chest
   holds what it holds, and TActiveMonster::HatchEgg reads the conditions off
   the egg's own Data1 and Data2. The chance is a roll of rand modulo 100
   compared against Data2, and it passes when the roll is less than or equal,
   so the odds are Data2 PLUS ONE in a hundred: a Data2 of zero is one in a
   hundred rather than never, and 100 is always. Data1 bit 0x10 holds it to
   daylight and 0x20 to the night, the clock being compared against 24576 and
   73728, which at 4096 units an hour are six in the morning and six at night.
   Bit 0x01 writes 101 into the egg's own chance when it hatches, and since
   the roll passes at or under the chance, every later roll passes: the egg
   hatches on every visit after its first. It was read on 12 September 2026
   as "only once" off the same instruction, which the comparison beside it
   contradicts; it matters for the four such eggs whose chance is not
   already 100, the unicorn's, a polyp's and two of wolflizards.

   Bit 0x04 is read on one branch alone. For each record it hatches, the
   routine asks TInterp::HasProperty for the class's property 55: a class
   that has it is a creature, made through CreateMonster, taken off the
   record's count (Data2) and turned to a facing its property 55 picks from
   a jump table; a class without it is a thing, placed as a plain prop, and
   there bit 0x04 skips taking it off the count, so the egg makes as many
   again on its next visit. 63 of the 67 eggs that hold things carry it:
   the herbs, seedpods, beans, obsidian, sulfur, webs and eggs. It was read
   on 12 September 2026 as keeping the creature's facing, which is the other
   branch. Bit 0x08 is set on a few eggs and is read nowhere in the hatching
   path, so nothing is claimed for it.

   An AMBIENT SOUND egg names a sound resource, 0x9100 plus the argument, and
   these are placed by terrain rather than by event: every one of the hundred
   carrying 0x9106, Waves / Seashore Loop, stands on water, and the frogs
   stand in the swamps. That is why the draw loop's dispatch does nothing with
   them; the audio side registers them through TAudio::Ambient, which keeps
   the nearest emitter of each sound and pans it with CalcStereo. */
/* What an egg does, in words, and where `linked` is set as chips to the
   things it names: the creatures it hatches, the sound it plays, the room
   or the place it leads to.

   The flag is not decoration. Both hover cards are `pointer-events:none`,
   so a link drawn in one could never be clicked; the inspector's card is
   what a tap opens and what can hold them. So the sentence is built once
   and each piece is wrapped by `one`, which is a chip in the inspector and
   escaped text in the card. */
/* The hours a hatching egg keeps, off TActiveMonster::HatchEgg: its day and
   night bits compare the clock with two constants, a `cmpwi` for the dawn
   and a `lis`/`addi` pair for the dusk, and the clock's units an hour
   (exeClockRules) make them hours. Null with no application open, and then
   the egg says only "by day" or "by night". */
function exeHatchHours() {
  if (!appImage()) return null;
  if (DERIVED.HATCH_HOURS !== undefined) return DERIVED.HATCH_HOURS;
  let out = null;
  try {
    const ops = exeOpsNamed('TActiveMonster::HatchEgg');
    const clk = exeClockRules();
    const per = clk && clk.model && clk.model.unitsPerHour;
    const i = ops.findIndex(o => o.d && o.d.mn === 'cmpwi' && o.d.imm > 0 && per && o.d.imm % per === 0);
    const j = i >= 0 ? exeFind(ops, i + 1, 6, d => d.mn === 'lis') : -1;
    const k = j >= 0 ? exeFind(ops, j + 1, 3, d => d.mn === 'addi' && d.ra === ops[j].d.rd) : -1;
    if (k >= 0) {
      const dusk = (ops[j].d.imm << 16) + ops[k].d.imm;
      out = { dawn: exeVal(ops[i], ops[i].d.imm / per), dusk: exeVal(ops[k], dusk / per) };
    }
  } catch (e) { quiet(e); }
  return (DERIVED.HATCH_HOURS = out);
}
/* How near an egg must be to be tried, off TViewer::SetStage: an armed
   egg that is not kind 10 joins the viewer's list only if it lies within a
   window of so many squares each side of the stage's centre, which
   TGameViewer::DrawRoutine passes as the party's square. Tested as a
   `cmplwi` against 10 for the kind and then an `addi` of minus the reach.
   The same window re-arms a tried egg that has left it. Null with no
   application open, and then the card says only "near". */
function exeEggReach() {
  if (!appImage()) return null;
  if (DERIVED.EGG_REACH !== undefined) return DERIVED.EGG_REACH;
  let out = null;
  try {
    const ops = exeOpsNamed('TViewer::SetStage');
    for (let i = 0; i < ops.length && !out; i++) {
      const d = ops[i].d;
      if (!d || d.mn !== 'cmplwi' || d.imm !== 10) continue;
      const k = exeFind(ops, i + 1, 6, e => e.mn === 'addi' && e.imm < 0);
      if (k >= 0) out = exeVal(ops[k], -ops[k].d.imm);
    }
  } catch (e) { quiet(e); }
  return (DERIVED.EGG_REACH = out);
}
function clockHourText(h) { return h === 0 ? 'midnight' : h === 12 ? 'noon' : (h % 12) + (h < 12 ? ' am' : ' pm'); }
function eggDetail(g, allProps, linked) {
  const k = EGG_KIND_NAMES[g.aspect];
  const one = (text, js) => linked && js ? svLink(String(text), js) : svEsc(String(text));
  if (g.aspect === 3) {
    const rid = 0x9100 + g.proptype;
    const nm = refExists(rid) ? labelFor(rid) : null;
    return 'an ambient sound, ' + (nm ? one(String(nm).replace(/^Sound /, 'sound '), 'jumpToResource(' + rid + ')')
                                      : one(propWordHex(rid), refExists(rid) ? 'jumpToResource(' + rid + ')' : null));
  }
  if (g.aspect === 0) {
    /* What sets it off, which the line did not say (the maintainer,
       22 September 2026, asking what the trigger is and what night is).
       TGameViewer::DrawRoutine calls TViewer::SetStage on each draw, which
       lists the eggs within 15 squares of the party's square on both axes
       (exeEggReach reads the 15), and hatches a listed egg only where
       TGameViewer::InZone says its square is in the area MakeZone made:
       SeedFill over a bitmap of the map's wall tiles (MakeBitMap sets a
       square whose tile carries both 0x200 and 0x004 of its attribute
       word), grown one square all round. MakeZone is called with the
       party's square when the party comes into the zone (GoToLocation),
       when a game begins or is loaded (BeginPlay) and when a magic map is
       drawn (MagicMap, from a script's screen effect or the cheat key), and
       at no other time; but every tile in the bitmap also carries 0x200,
       which blocks a step (TGameSys::CanMove), so a party on foot cannot
       leave the area it was filled in, and in play it is the ground the
       party can reach on foot with every door counted open. A door placed
       as a thing is not in the bitmap: Odemia's walls have such doors in
       all their gaps, and from its barracks the area is the whole map. The
       card said "in the same walled area" until 26 September 2026, which
       read as a room. "Hatch" is the program's own word, HatchEgg.

       It is tried only while its first byte is exactly 0x42. Out of its
       hours HatchEgg returns and the egg waits, tried again on the next
       draw; in its hours it rolls, and a miss and a hatch both set 0x80 on
       that byte. SetStage turns a 0xC2 back to 0x42 once it lies beyond the
       same 15 squares, ChainFreeProps (from LoadLevelProps) turns every
       one back when the zone loads, and THood::ResetHood does it for one
       beyond 32 squares in a level of 1,536 records or more. Hence
       "visits": the chance is a chance each time the party comes within
       reach, which the card said was rolled again on every draw until
       25 September 2026. The eggs are read in the workbench's
       save-format.md, which has the addresses.

       A hatch makes the whole of each record's count (its Data2) at once:
       one of Odemia's chicken eggs six, the sea monster's eight
       tentacles. Nothing that compares the clock with the eggs' hours
       removes what hatched, so a creature hatched by day is still there
       when the night egg beside it hatches at six. */
    const held = containerContents(g, allProps || []);
    const chance = g.d2 >= 99 ? 'on every visit' : 'on ' + (g.d2 + 1) + (g.d2 === 0 ? ' visit in 100' : ' visits in 100');
    const hrs = exeHatchHours(), reach = exeEggReach();
    const hour = v => linked ? srcNum(v, clockHourText(v.v)) : svEsc(clockHourText(v.v));
    const when = [];
    if (g.d1 & 0x10) when.push(hrs ? 'only between ' + hour(hrs.dawn) + ' and ' + hour(hrs.dusk) : 'by day');
    if (g.d1 & 0x20) when.push(hrs ? 'only between ' + hour(hrs.dusk) + ' and ' + hour(hrs.dawn) : 'by night');
    /* Bit 0x08 is set on some eggs (Odemia's chickens carry 0x18, its goat
       0x0A) and the program never reads it: TActiveMonster::HatchEgg, the
       one routine that hatches, tests Data1 for 0x20, 0x10, 0x04 and 0x01
       only, and DrawRoutine hands the egg to it untested (read 1 October
       2026). So it is said nowhere; until then the zone page called it a
       condition not worked out. */
    // Bit 0x01 makes the chance certain once it has hatched, which says
    // nothing new where the chance is certain already.
    if ((g.d1 & 0x01) && g.d2 < 99) when.push('on every visit once it has hatched');
    // Bit 0x04 is read only for a thing (a class without property 55), and
    // only an egg holding one with a count to keep is told of it.
    if ((g.d1 & 0x04) && held.some(h => h.d2 > 0 && !classHasMember(h.proptype, 55)))
      when.push('without running out');
    // Each creature by name, and in the inspector each one opens its own
    // page, with the record's count beside it when it is not one: that many
    // hatch at once. An egg holding no records says "something" because the
    // file gives it nothing to hatch, which is worth seeing rather than
    // hiding.
    const names = held.map(h => one(propDisplayName(h.proptype) || ('prop ' + h.proptype),
                                    'showItemDetail(' + h.proptype + ')') +
                                (h.d2 !== 1 ? svEsc(' ×' + h.d2) : ''));
    return 'hatches ' + (names.length ? names.join(' and ') : 'something') +
           ' when the party comes ' + (reach ? 'within ' + (linked ? srcNum(reach, String(reach.v)) : svEsc(String(reach.v))) + ' squares of it'
                                             : 'near it') + ', unless walls cut it off from the party, ' + svEsc(chance) +
           (when.length ? ', ' + when.join(', ') : '');
  }
  if (g.aspect === 1) {
    // A way somewhere: name where it lands rather than the number alone.
    let z = null;
    try { z = zoneportInfo(g.proptype); } catch (e) { z = null; }
    return z ? 'a way to ' + one(z.name, 'jumpToResource(' + z.resid + ')') +
               svEsc(', square ' + z.x + ', ' + z.y)
             : 'a way to another place, zoneport ' + svEsc(String(g.proptype));
  }
  if (g.aspect === 8) {
    const rid = 0x1B00 + g.proptype;
    return 'a room, ' + one('room ' + g.proptype, refExists(rid) ? 'jumpToResource(' + rid + ')' : null);
  }
  if (g.aspect === 4) {
    const rid = 0x8000 + g.proptype;
    return 'changes zone to ' + one(labelFor(rid) || propWordHex(rid),
                                    refExists(rid) ? 'jumpToResource(' + rid + ')' : null);
  }
  return svEsc(k ? k.what : 'kind ' + g.aspect) + (k && k.arg ? ', ' + svEsc(k.arg + ' ' + g.proptype) : '');
}
/* WHERE A ROOM IS. A kind-8 egg is a room, and the room is not the egg's
   square: it is a rectangle around it, which the application computes in
   IsInArea__FssP8PropItem and CharEntry::GetRoom with the same arithmetic
   inlined. d1 and d2 are the size, and the rectangle is inclusive and
   centred on the egg, biased one square left and up when the size is even:

     left = ex - floor((d1 + 1) / 2)   right  = left + d1
     top  = ey - floor((d2 + 1) / 2)   bottom = top + d2

   so it is d1 + 1 squares wide and d2 + 1 tall. The workbench's
   save-format.md has the reading and the addresses; the figure to check this
   against is room 1 of Land King Hall, published there from a saved game as
   x 15..23, y 18..29 from the egg at (19,24) sized 8 by 11, which this
   reproduces. The un-biased formula gives y 19 and does not.

   Not one of the archive's 170 room eggs is a single square -- the smallest
   is 2 by 2 and the largest 22 by 22 -- so a ring on the trigger square
   misdrew every one of them. */
function eggRect(g) {
  const left = g.x - Math.floor((g.d1 + 1) / 2), top = g.y - Math.floor((g.d2 + 1) / 2);
  return { left, top, right: left + g.d1, bottom: top + g.d2, w: g.d1 + 1, h: g.d2 + 1 };
}
function eggCovers(g, tx, ty) {
  const r = eggRect(g);
  return tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom;
}
function eggKinds() {
  const kinds = new Map();
  let zones = 0, roofs = 0;
  /* What the kind-0 eggs hatch, counted while the lists are open.
     A hatching egg does not name its creatures: they are records in the same
     zone list that name the egg as their container (flags & 0x08, container =
     holder - 0x100), which is the join containerContents makes for one egg in
     the inspector. The kinds walk already has every list in its hands and
     threw the records away, so the tally rides it rather than reading the
     archive a second time. Counted by prop type, with the zones each is
     found in, and separately the eggs that hold nothing at all -- which the
     file does leave, and which is worth seeing rather than rounding away. */
  const hatch = new Map();
  let emptyEggs = 0;
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      zones++;
      const list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data);
      for (const r of list) {
        if (r.flags === 0x44) { roofs++; continue; }
        if (r.flags !== 0x42) continue;
        if (!kinds.has(r.aspect)) kinds.set(r.aspect, { kind: r.aspect, n: 0, args: new Set() });
        const k = kinds.get(r.aspect);
        k.n++;
        k.args.add(r.proptype);
        if (r.aspect !== 0) continue;
        const held = containerContents(r, list);
        if (!held.length) { emptyEggs++; continue; }
        for (const h of held) {
          if (!hatch.has(h.proptype)) hatch.set(h.proptype, { proptype: h.proptype, n: 0, zones: new Set() });
          const e = hatch.get(h.proptype);
          e.n++;
          e.zones.add(z);
        }
      }
    }
  } catch (err) { return null; }
  if (!kinds.size) return null;
  // The rooms are checkable: a kind-8 egg's argument is a room number, and
  // a room number has a script at 0x1B00 + it. Anything else would mean the
  // kind has been read wrongly, so the sheet says how many resolve.
  const rooms = kinds.get(8);
  const scripted = rooms ? [...rooms.args].filter(a => refExists(0x1B00 + a)).map(a => 0x1B00 + a) : [];
  const named = scripted.length;
  return { kinds: [...kinds.values()].sort((a, b) => a.kind - b.kind), zones, roofs,
           rooms: rooms ? { total: rooms.args.size, named, scripted } : null,
           hatch: [...hatch.values()].sort((a, b) => b.n - a.n || a.proptype - b.proptype),
           emptyEggs };
}

/* THE LIBRARY. Cythera's own writing is in the archive: the histories and
   bestiaries on its bookshelves, the three prophecies, the scrolls and
   letters, the signs over its doors, the words on its gravestones and
   inside its rings. Each lives in a text array of the 0x02xx range, and a
   prop shows one passage of one array: the class calls the document helper
   (0xE64 or 0xE65) with the array and the prop's own Data1 added to it, so
   a bookshelf's Data1 is which book it holds. The pairs are read off the
   classes rather than listed here, so an archive wired differently says so.

   Two questions fall out of that and the file answers both. A passage no
   placed prop and no script points at is written and never shown; a Data1
   with no passage behind it is a prop pointing at nothing. The first list
   was wrong twice while it had only placed props in it: three Sapphire
   volumes are handed over by Itanos, Prusa and Unhayt rather than placed,
   and the Wine Contract is handed over by Apis, so all four read as
   unreachable until `sys Create` was counted as a second source. */
/* sys Create's recipient is not always a register. Thirteen of the file's
   twenty-seven flat Creates address it as a plain number, character 1 being
   the hero, so a pattern that insists on `global`/`arg`/`local` cannot see any
   of them. Both readers of Create below match on this one shape, so they
   cannot drift apart about what a Create looks like. */
const CREATE_RECIPIENT = /^(?:global|arg|local) |^(?:byte|short|word) /;
function libraryRules() {
  // Memoised: Loose ends and the Writings sheet both read this, and it is a
  // walk over every item class, every prop list and every script. A gallery
  // redraws far more often than the Mechanics sheet ever did.
  if (DERIVED.LIBRARY_RULES) return DERIVED.LIBRARY_RULES;
  const docs = new Map();
  const want = new Map();
  const sent = new Map();
  const doc = tid => {
    if (!docs.has(tid)) docs.set(tid, { resid: tid, readers: [], entries: [], placed: new Map(), made: new Map() });
    return docs.get(tid);
  };
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    if (!cls || !cls.code.length) continue;
    let ops = [];
    try { ops = dvmOpsOf(dvmScriptEntry(cls.resid)); } catch (e) { continue; }
    // Two shapes say the same thing. A document opens in a window through
    // the helper; a caption is printed where it stands. Paper does both: a
    // scroll by Data1, and, when Data1 is the sentinel below, a picture whose
    // caption comes from another array by Data2.
    const wire = (g, refIdx, fieldIdx) => {
      const m = /(0x[0-9A-Fa-f]+)\[\d+\]\s*$/.exec(g[refIdx].text);
      if (!m) return;
      const field = /data2/.test(g[fieldIdx].text) ? 'd2' : 'd1';
      const d = doc(parseInt(m[1], 16));
      if (d.readers.some(r => r.pt === pt && r.field === field)) return;
      d.readers.push({ pt, resid: cls.resid, field, at: g[0].at,
                       name: propDisplayName(pt) || ('prop ' + pt) });
      if (!want.has(pt)) want.set(pt, []);
      want.get(pt).push({ d, field });
    };
    for (const g of dvmSeqAll(ops, [/^call_resource 0xE6[45]$/, /^arg Arg\d+$/, /\[\d+\]\s*$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^add$/])) wire(g, 2, 4);
    for (const g of dvmSeqAll(ops, [/^print$/, /\[\d+\]\s*$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^add$/])) wire(g, 1, 3);
    // A number the class tests its own Data against is a sentinel choosing a
    // path, not a passage: paper's 255 means "a picture, not a scroll". Left
    // in, it would be reported as a thing pointing at a passage that is not
    // there, which is the opposite of what it is.
    for (const g of dvmSeqAll(ops, [/^get_field data[12]\b/, VAL_ANY, /^eq$/])) {
      if (!sent.has(pt)) sent.set(pt, new Set());
      sent.get(pt).add(dvmNum(g[1]));
    }
    // The other way a class says "there is nothing here" is a bare truth test
    // on the field, with no number in it at all. The ring does that, and its
    // Data1 of 0 means a ring with no inscription rather than a ring pointing
    // at a passage that is missing.
    for (const g of dvmSeqAll(ops, [/^if_not$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^then /])) {
      if (!sent.has(pt)) sent.set(pt, new Set());
      sent.get(pt).add(0);
    }
  }
  if (!docs.size) return null;
  for (const d of docs.values()) {
    try { d.entries = parseDelverTextArray(smartDecrypt(getResourceBytes(ARCHIVE, d.resid), d.resid).data); }
    catch (e) { d.entries = []; }
  }
  // Where each passage is shown: every placed record of a reading class.
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      for (const r of parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data)) {
        const ws = want.get(r.proptype);
        if (!ws || r.flags === 0xFF || (r.flags & 0x40)) continue;
        for (const w of ws) {
          const k = w.field === 'd2' ? r.d2 : r.d1;
          if (!w.d.placed.has(k)) w.d.placed.set(k, []);
          w.d.placed.get(k).push({ zone: 0x8000 + z, x: r.x, y: r.y, onMap: r.onMap });
        }
      }
    }
  } catch (e) { /* an archive with no prop lists says nothing about where */ }
  // The second source: a prop a script hands over rather than places. Create
  // takes the packed type, whose low ten bits are the prop type, and then
  // the value that lands in Data1.
  for (const e of buildScriptTextIndex()) {
    let ops = [];
    try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const g of dvmSeqAll(ops, [/^sys Create$/, CREATE_RECIPIENT, DVM_NUM, DVM_NUM])) {
      const ws = want.get(dvmNum(g[2]) & 0x3FF);
      if (!ws) continue;
      const d1 = dvmNum(g[3]);
      for (const w of ws) {
        if (w.field !== 'd1') continue;
        if (!w.d.made.has(d1)) w.d.made.set(d1, []);
        w.d.made.get(d1).push({ resid: e.resid, at: g[3].at, name: labelFor(e.resid) || propWordHex(e.resid) });
      }
    }
  }
  for (const d of docs.values()) {
    const shown = new Set([...d.placed.keys(), ...d.made.keys()]);
    const have = new Set(d.entries.map(x => x.index));
    d.unshown = d.entries.filter(x => !shown.has(x.index) && String(x.str).trim());
    d.dangling = [...shown].filter(k => !have.has(k) &&
      !d.readers.some(r => (sent.get(r.pt) || new Set()).has(k))).sort((a, b) => a - b);
    d.shownCount = d.entries.length - d.unshown.length;
  }
  return DERIVED.LIBRARY_RULES = [...docs.values()].sort((a, b) => a.resid - b.resid);
}

/* LOOSE ENDS. Things the scenario's own scripts get wrong, each read off
   the line that causes it rather than collected from anywhere. Four kinds,
   and every one of them is a question the file can settle: a To Do line
   nothing ever strikes off; a line that shows another line's words; a quest
   value compared against a number no script ever assigns it, so the branch
   behind it cannot be taken; and a quest value or flag written and never
   read, or read and never written. The library's two lists join them. */
function looseEnds() {
  const VAL = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;
  const asg = new Map(), tst = new Map(), reads = new Map(), writes = new Map();
  const flagAsg = new Map(), flagRead = new Map();
  const computed = new Set();
  const exact = [], unusedCast = [], queued = new Map();
  const cfTests = new Map(), cfSets = new Set(), cfWild = new Set(), cfHelperSelf = new Map(), cfHelperTask = new Map(), cfCalls = [];
  const put = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  // Every finding carries WHERE it was found, the same way `tst` below
  // already does: the resource and the offset of the instruction. Keeping
  // only the resource is what left half the Loose ends table unable to link
  // to anything, so the sheet had to render those rows as plain labels while
  // the rest were links. Deduped on resource and offset together, since one
  // script can touch the same value in several places.
  const putSite = (m, k, resid, at) => {
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(resid + ':' + at, { resid, at });
  };
  for (const e of buildScriptTextIndex()) {
    let ops = [];
    try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const g of dvmSeqAll(ops, [/^sys SetState$/, VAL, VAL])) {
      put(asg, dvmNum(g[1]), dvmNum(g[2])); putSite(writes, dvmNum(g[1]), e.resid, g[0].at);
    }
    // A value the script computes rather than states -- Selinus counting the
    // Sapphire volumes does SetState(5, GetState(5) + 1) -- can hold anything,
    // so nothing may be concluded about which numbers it reaches. Without
    // this the Books counter came out as "a test nothing can satisfy", which
    // is the opposite of true: it is the one value that counts up.
    for (const g of dvmSeqAll(ops, [/^sys SetState$/, VAL])) {
      putSite(writes, dvmNum(g[1]), e.resid, g[0].at);
      const after = ops[ops.indexOf(g[1]) + 1];
      if (after && !VAL.test(after.text)) computed.add(dvmNum(g[1]));
    }
    for (const g of dvmSeqAll(ops, [/^sys GetState$/, VAL])) putSite(reads, dvmNum(g[1]), e.resid, g[0].at);
    for (const g of dvmSeqAll(ops, [/^sys GetState$/, VAL, /^end$/, VAL, /^eq$/])) {
      const v = dvmVal(e.resid, g[3]);
      if (v) put(tst, dvmNum(g[1]), JSON.stringify({ v: v.v, resid: e.resid, at: g[3].at }));
    }
    for (const g of dvmSeqAll(ops, [/^sys SetStateFlag$/, VAL])) putSite(flagAsg, dvmNum(g[1]), e.resid, g[0].at);
    for (const g of dvmSeqAll(ops, [/^sys GetStateFlag$/, VAL])) putSite(flagRead, dvmNum(g[1]), e.resid, g[0].at);
    /* A flag is also set and tested through a queued task, not only by the
       two syscalls. TActiveMonster::DoMove dispatches task types 160 to 170
       through a jump table, and two of its cases work on the flag array:
       164 tests the flag in the task's first argument (and clears it when
       the second is 0), 165 sets it or clears it by the second. Alaric, a
       ruins guard, Charax and the Regroup action queue these on flags 253 to
       255, so a reader that saw only the syscalls would call 254 and 255 read
       and never written. Only 165 is counted as a write: 164 clears, which
       is not what "set" asks. Nothing else in the application writes the
       flag array but the save and the load, which was checked against every
       load of its TOC slot rather than assumed. */
    for (const g of dvmSeqAll(ops, [/^sys AddTask$/, null, /^(?:byte|short|word) (?:165|0xA5)$/i, VAL])) putSite(flagAsg, dvmNum(g[3]), e.resid, g[3].at);
    for (const g of dvmSeqAll(ops, [/^sys AddTask$/, null, /^(?:byte|short|word) (?:164|0xA4)$/i, VAL])) putSite(flagRead, dvmNum(g[3]), e.resid, g[3].at);
    /* A line struck off only when a counted value equals a number exactly.
       Selinus counts the Sapphire volumes into quest value 5 and strikes the
       Books of Wisdom line only when it IS 5 after a visit, so a visit that
       takes the count from 4 to 6 steps over the one value that strikes it.
       Collected here and filtered below against `computed`, since a value a
       script only ever assigns cannot step over anything. */
    for (const g of dvmSeqAll(ops, [/^sys GetState$/, VAL, /^end$/, VAL, /^eq$/, /^then /, /^sys CompleteQuest$/, VAL]))
      exact.push({ state: dvmNum(g[1]), n: dvmVal(e.resid, g[3]), slot: dvmVal(e.resid, g[7]) });
    /* The type of every queued task, for the task scripts below. The
       receiver comes first and is one op -- a literal character, an arg, a
       local or a global -- with any number of field reads after it. */
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].text !== 'sys AddTask') continue;
      let j = i + 1;
      if (ops[j] && (VAL.test(ops[j].text) || /^(?:arg|local|global) /.test(ops[j].text))) j++;
      while (ops[j] && /^get_field /.test(ops[j].text)) j++;
      const t = dvmNum(ops[j]);
      if (t !== null) putSite(queued, t, e.resid, ops[j].at);
    }
    /* A task script that converts its item and then does not use the
       conversion. A queued task reaches its script through DefaultMethods
       0x3021, `call_index 0x0C00 + type`, with the item as a plain number:
       TActiveMonster::QueueActivity keeps the task's first argument in a
       short, and DoMove hands it on with the tag cleared. So 0xC4E, 0xC4F
       and 0xC50 each `cast Prop` the item into a local, and then send Use,
       UseOn or UseAt to the argument itself. The interpreter's method call
       dispatches only on a prop or a heap object and does nothing at all
       for a number, so the three "use a thing" tasks never act: Aethon's
       lock picking (Lock Picking queues 0x4F) and the blacksmiths' tasker
       (0xC86 queues 0x4E) stop at the point of use. Traced 17 September
       2026. Kept to the task range because elsewhere the same shape is
       harmless -- a spell's target already is a prop, so a redundant cast
       beside it changes nothing -- and a reader over every script reported
       Awaken and two default methods for exactly that reason. */
    /* Character flags: bit_flags, byte 8 of a character record, which
       SetCharacterFlag (0xF00) sets, 0xF01 clears and 0xF02 tests. Collected
       here and joined after the loop, because a flag is set three ways and a
       reader that saw only the first would publish tests that do pass:
       directly, with the character named by the call; by a helper that sets
       the flag on its own first argument, as 0xC84 and 0xC85 do for the
       characters that call them; and by queued task 167, which
       TActiveMonster::DoMove carries out by setting a bit on the character the
       task names -- 0xC80 queues it over an array its caller hands in, and
       Crito and Dares hand in their customers. A set this cannot resolve
       makes its bit wild, and a wild bit is never reported. The application
       writes the byte only through those (a scan for every store at offset 8:
       DoMove's task, and death clearing bit 6). */
    {
      const own = op => {
        if (!op) return null;
        if (/^arg Arg00$/.test(op.text)) return e.resid >= 0x1800 && e.resid < 0x1900 ? [e.resid - 0x1800] : null;
        if (/^global PlayerCharacter\b/.test(op.text)) return [1];
        const n = VAL.test(op.text) ? dvmNum(op) : null;
        return n === null ? null : [n];
      };
      const isHelper = !(e.resid >= 0x1800 && e.resid < 0x1900);
      for (const g of dvmSeqAll(ops, [/^call_resource 0xF02$/, null, VAL])) {
        const who = own(g[1]);
        if (who) for (const c of who) putSite(cfTests, c + ':' + dvmNum(g[2]), e.resid, g[2].at);
      }
      for (const g of dvmSeqAll(ops, [/^call_resource (?:SetCharacterFlag \(0xF00\)|0xF00)$/, null, VAL])) {
        const who = own(g[1]), bit = dvmNum(g[2]);
        if (who) who.forEach(c => cfSets.add(c + ':' + bit));
        else if (isHelper && /^arg Arg00$/.test(g[1].text)) { if (!cfHelperSelf.has(e.resid)) cfHelperSelf.set(e.resid, new Set()); cfHelperSelf.get(e.resid).add(bit); }
        else cfWild.add(bit);
      }
      for (const g of dvmSeqAll(ops, [/^sys AddTask$/, null, /^(?:byte|short|word) (?:167|0xA7)$/i, null, VAL])) {
        const who = own(g[3]), bit = dvmNum(g[4]);
        if (who) { who.forEach(c => cfSets.add(c + ':' + bit)); continue; }
        const lv = /^local Var([0-9A-F]+)$/i.exec(g[3].text);
        const it = lv && dvmSeqFirst(ops, [new RegExp('^set_local 0x' + lv[1] + '$', 'i'), /^sys ArrayIterator$/, null, VAL, /^arg Arg\w+$/]);
        if (isHelper && it) {
          const k = parseInt(it[4].text.slice('arg Arg'.length), 16);
          if (!cfHelperTask.has(e.resid)) cfHelperTask.set(e.resid, []);
          cfHelperTask.get(e.resid).push({ k, bit });
        } else cfWild.add(bit);
      }
      // Every call of a resource, with its first few operands when each is a
      // single op, for the joins after the loop.
      for (let i = 0; i < ops.length; i++) {
        const m = /^call_resource (?:\w+ \()?0x([0-9A-F]+)\)?$/i.exec(ops[i].text);
        if (!m) continue;
        const args = [];
        for (let j = i + 1; j < ops.length && ops[j].text !== 'end' && args.length < 6; j++) args.push(ops[j]);
        cfCalls.push({ helper: parseInt(m[1], 16), caller: e.resid, args, ops });
      }
    }
    if (e.resid >= 0x0C00 && e.resid < 0x0D00) {
      for (const g of dvmSeqAll(ops, [/^set_local 0x[0-9A-F]+$/i, /^arg Arg\w+$/, /^cast Prop\b/, /^end$/])) {
        const local = 'local Var' + g[0].text.split(' ')[1].slice(2).toUpperCase().padStart(2, '0');
        if (ops.some(o => o.text === local)) continue;
        for (let i = 0; i + 1 < ops.length; i++)
          if (/^method /.test(ops[i].text) && ops[i + 1].text === g[1].text)
            unusedCast.push({ resid: e.resid, at: ops[i + 1].at, method: ops[i].text.replace(/^method /, '').replace(/ \(0x[0-9A-F]+\)$/i, ''), task: e.resid - 0x0C00 });
      }
    }
  }
  // A comparison nothing can satisfy. Zero is every value's starting state,
  // so a test against it is always reachable and is not counted.
  const unreachable = [];
  for (const [k, set] of tst) {
    if (computed.has(k)) continue;
    const made = asg.get(k) || new Set();
    if (!made.size) continue;
    for (const s of set) {
      const t = JSON.parse(s);
      if (t.v !== 0 && !made.has(t.v)) unreachable.push({ state: k, want: t, assigned: [...made].sort((a, b) => a - b) });
    }
  }
  const only = (a, b) => [...a.keys()].filter(k => !b.has(k)).sort((x, y) => x - y);
  // The joins for character flags: helpers that set their caller's flag, and
  // task 167 over an array the caller hands in.
  for (const call of cfCalls) {
    const self = cfHelperSelf.get(call.helper);
    if (self) {
      const a0 = call.args[0];
      const who = a0 && /^arg Arg00$/.test(a0.text) && call.caller >= 0x1800 && call.caller < 0x1900 ? [call.caller - 0x1800]
                : a0 && VAL.test(a0.text) ? [dvmNum(a0)] : null;
      if (who) for (const c of who) for (const b of self) cfSets.add(c + ':' + b);
      else for (const b of self) cfWild.add(b);
    }
    for (const t of cfHelperTask.get(call.helper) || []) {
      const a = call.args[t.k];
      const lv = a && /^local Var([0-9A-F]+)$/i.exec(a.text);
      const g = lv && dvmSeqFirst(call.ops, [new RegExp('^set_local 0x' + lv[1] + '$', 'i'), /^data </]);
      let words = null;
      if (g) { try { words = dvmArrayWords(smartDecrypt(getResourceBytes(ARCHIVE, call.caller), call.caller).data, g[1].at + 3); } catch (err) { words = null; } }
      if (words && words.every(w => w >= 0 && w < 512)) words.forEach(c => cfSets.add(c + ':' + t.bit));
      else cfWild.add(t.bit);
    }
  }
  // A flag already set in the shipped character table is not "never set".
  try { loadCharacterTable().forEach((c, i) => { if (c && c.raw) for (let b = 0; b < 8; b++) if ((c.raw[8] >> b) & 1) cfSets.add(i + ':' + b); }); } catch (err) { quiet(err); }
  /* A quest value that only a thing with a given Data1 sets, when no such
     thing exists. An item class that branches `data1 == v` and sets quest
     value k there is counted against every record of that class in every
     prop list and in the monsters' inventory list, plus any Data1 a script
     writes after turning something into that class (the strange staff makes
     kesh of Data1 3 that way). A value some other script also sets, or no
     script reads, is not reported. It finds one: Eudoxus's coffer carries
     five kesh vials of Data1 0, the vial sets quest value 13 only at Data1 2,
     and Sacas's "I found some on the band leader himself" waits on 13.
     The wider question -- any Data1 case nothing carries -- was measured and
     is mostly runtime state (lit lamps, full pitchers, a charged distiller),
     which is why the reader asks only about quest values. */
  const dataCaseNoThing = [];
  try {
    const have = new Map(), created = new Set();
    const add = (pt, v) => { if (!have.has(pt)) have.set(pt, new Set()); have.get(pt).add(v); };
    for (let rid = 0x8100; rid < 0x8200; rid++) {
      if (!refExists(rid)) continue;
      let l; try { l = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, rid), rid).data); } catch (err) { continue; }
      for (const r of l) if (r.flags !== 0xFF && !(r.flags & 0x40)) add(r.proptype, r.d1);
    }
    // 0xF306 is a saved game's list; the scenario has none, and asking for
    // it was the one failure the Tools sheet listed on every visit.
    if (refExists(0xF306)) try { for (const r of parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0xF306), 0xF306).data)) if (r.flags !== 0xFF && !(r.flags & 0x40)) add(r.proptype, r.d1); } catch (err) { quiet(err); }
    for (const e of buildScriptTextIndex()) {
      let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
      for (let i = 0; i < ops.length; i++) {
        if (/^sys (?:Create|New)$/.test(ops[i].text)) for (let j = i + 1; j < Math.min(i + 6, ops.length); j++) { const n = dvmNum(ops[j]); if (n !== null) created.add(n & 0x3FF); }
        if (/^set_field obj_type\b/.test(ops[i].text) && ops[i + 3] && VAL.test(ops[i + 3].text)) {
          const pt = dvmNum(ops[i + 3]);
          for (let j = i + 4; j < Math.min(i + 12, ops.length - 3); j++)
            if (/^set_field data1\b/.test(ops[j].text) && VAL.test(ops[j + 3].text)) { add(pt, dvmNum(ops[j + 3])); break; }
        }
      }
    }
    for (const e of buildScriptTextIndex()) {
      if (e.resid < 0x1000 || e.resid >= 0x1400) continue;
      const pt = e.resid - 0x1000;
      if (created.has(pt)) continue;
      let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
      for (const g of dvmSeqAll(ops, [/^if_not$/, /^arg Arg00$/, /^get_field data1\b/, VAL, /^eq$/, /^then /])) {
        const v = dvmNum(g[3]), i = ops.indexOf(g[5]);
        for (let j = i + 1; j < Math.min(i + 14, ops.length - 1); j++) {
          if (ops[j].text !== 'sys SetState' || !VAL.test(ops[j + 1].text)) continue;
          const k = dvmNum(ops[j + 1]);
          const readers = [...(reads.get(k) || new Map()).values()].filter(x => x.resid !== e.resid);
          const others = [...(writes.get(k) || new Map()).values()].filter(x => x.resid !== e.resid);
          if (!(have.get(pt) || new Set()).has(v) && readers.length && !others.length)
            dataCaseNoThing.push({ pt, v: dvmVal(e.resid, g[3]), state: k, readers });
          break;
        }
      }
    }
  } catch (err) { quiet(err); }
  /* A keyword list with a space after a comma. The conversation_response
     handler in TInterp::DoInterpAt copies a keyword up to the next comma,
     NUL or byte of 0x80 and above, skipping nothing, and compares it with
     the start of what was typed. So in "inn, pari" the second keyword is
     " pari", and only an answer typed with a leading space reaches it --
     which is the board's "for Parium, Crito, Apis and Eurybates the correct
     response is reachable only by typing a space before the name", and
     453's Seldane "corruption" that needs a space. */
  const spacedKeywords = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const o of ops) {
      const m = /^conversation_response "([^"]*)"/.exec(o.text);
      if (!m || !/, /.test(m[1])) continue;
      spacedKeywords.push({ resid: e.resid, at: o.at, list: m[1], spaced: m[1].split(',').filter(k => /^ /.test(k)).map(k => k.trim()) });
    }
  }
  /* A quest value tested as true or false where the script means the quest
     flag of the same number. Reported only when the value's truth is fixed:
     every assignment to it anywhere is a nonzero number, and some script
     gives it a default when it is 0, so once that has run the test always
     passes. Eteocles tests quest value 4 -- where Demodocus is, which the
     World script starts at 7 -- in his kesh topic, while all five of his
     other tests use quest flag 4, Guild membership; so "Youse is awful
     nosy." is never said. Philinus and Ascalon test quest value 3 bare
     beside flag 3 as well, and theirs is the murder thread, which starts at
     0 and is set under a condition, so they are not reported. */
  const valueForFlag = [];
  {
    const assigned = new Map(), defaulted = new Set();
    for (const e of buildScriptTextIndex()) {
      let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
      for (const g of dvmSeqAll(ops, [/^sys SetState$/, VAL, null])) {
        const k = dvmNum(g[1]); if (!assigned.has(k)) assigned.set(k, []);
        assigned.get(k).push(VAL.test(g[2].text) ? dvmNum(g[2]) : null);
      }
      for (const g of dvmSeqAll(ops, [/^if_not$/, /^sys GetState$/, VAL, /^end$/, VAL, /^eq$/, /^then /, /^sys SetState$/, VAL, VAL]))
        if (dvmNum(g[4]) === 0 && dvmNum(g[2]) === dvmNum(g[8]) && dvmNum(g[9]) !== 0) defaulted.add(dvmNum(g[2]));
    }
    for (const e of buildScriptTextIndex()) {
      let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
      const flagTests = new Set(dvmSeqAll(ops, [/^sys GetStateFlag$/, VAL]).map(g => dvmNum(g[1])));
      for (const g of dvmSeqAll(ops, [/^if_not$/, /^sys GetState$/, VAL, /^end$/, /^then /])) {
        const k = dvmNum(g[2]), a = assigned.get(k) || [];
        if (flagTests.has(k) && defaulted.has(k) && a.length && a.every(v => v !== null && v !== 0))
          valueForFlag.push({ resid: e.resid, at: g[2].at, k });
      }
    }
  }
  /* An answer every keyword of which an earlier answer in the same list
     already takes. A character's or a group's topics are a chain: each
     conversation_response jumps, when the typed word does not match, to the
     next, and the first match wins. So a later response whose keywords all
     appear earlier is never given. Keywords match on four letters, which is
     how Paris is lost to Parium ("pari" twice in 0x805), and 0x80E answers
     "brya" twice, the second time more fully. A later response that keeps
     one keyword of its own ("alar,king" after "alar") is still reachable
     and is not reported. The jump target is already an offset in the
     resource, as dvmConversation takes it; the first version of this reader
     added the object's start again, which is 0 for a dialogue group and 2
     for a character, and so walked no character's chain at all. */
  const shadowed = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    let objs = null;
    try { objs = dvmExtents(smartDecrypt(getResourceBytes(ARCHIVE, e.resid), e.resid).data, e.resid); } catch (err) { objs = null; }
    if (!objs) continue;
    const startOf = at => { for (const [st, en] of objs) if (at >= st && at < en) return st; return null; };
    const resp = [];
    for (const o of ops) {
      const m = /^conversation_response "([^"]*)" -> 0x([0-9A-F]+)$/i.exec(o.text);
      const st = m ? startOf(o.at) : null;
      if (m && st !== null) resp.push({ at: o.at, keys: m[1].split(','), next: parseInt(m[2], 16), list: m[1] });
    }
    if (!resp.length) continue;
    const byAt = new Map(resp.map(r => [r.at, r]));
    const heads = resp.filter(r => !resp.some(q => q.next === r.at));
    for (const h of heads) {
      const seen = new Set(), walked = new Set();
      for (let r = h; r && !walked.has(r.at); r = byAt.get(r.next)) {
        walked.add(r.at);
        const keys = r.keys.filter(k => k && k !== '*' && k !== 'y' && k !== 'n');
        if (keys.length && keys.every(k => seen.has(k))) shadowed.push({ resid: e.resid, at: r.at, list: r.list });
        keys.forEach(k => seen.add(k));
      }
    }
  }
  /* A local tested as true or false that its function only ever sets to
     false. Thoas says "Farewell.  Please come again." when a local is true
     and "Farewell." otherwise, and the one assignment to that local is
     False; nothing in the buy topic sets it. Scoped per function, since a
     local belongs to one; an argument (0x30 and up) is not a local. */
  const localOnlyFalse = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    let objs = null;
    try { objs = dvmExtents(smartDecrypt(getResourceBytes(ARCHIVE, e.resid), e.resid).data, e.resid); } catch (err) { objs = null; }
    if (!objs) continue;
    for (const [st, en, kind] of objs) {
      if (kind !== 'function') continue;
      const fo = ops.filter(o => o.at >= st && o.at < en);
      const sets = new Map();
      for (let i = 0; i + 1 < fo.length; i++) {
        const m = /^set_local 0x([0-9A-F]+)$/i.exec(fo[i].text);
        if (!m) continue;
        const n = parseInt(m[1], 16);
        if (n >= 0x30) continue;
        if (!sets.has(n)) sets.set(n, []);
        sets.get(n).push(fo[i + 1].text);
      }
      for (let i = 0; i + 2 < fo.length; i++) {
        const m = fo[i].text === 'if_not' && /^local Var([0-9A-F]+)$/i.exec(fo[i + 1].text);
        if (!m || !/^then /.test(fo[i + 2].text)) continue;
        const got = sets.get(parseInt(m[1], 16)) || [];
        if (got.length && got.every(t => /^(?:word False|word None|byte 0x00)$/.test(t))) localOnlyFalse.push({ resid: e.resid, at: fo[i + 1].at });
      }
    }
  }
  /* A character asking whether they themselves are alive. Status bit 0 is
     alive (the LandKing Amulet's revive tests it and says "They aren't
     dead!", and 0xF07 sets it), and a character's own script runs only
     while that character talks, so the test always passes. Hadrian's
     "How's my son doing?" loads Character.Hadrian where Hector is meant,
     so "I regret to tell you that Hector has died in my service" is never
     said. Read directly or through the one local the character is put in. */
  const selfAlive = [];
  for (const e of buildScriptTextIndex()) {
    if (e.resid < 0x1800 || e.resid >= 0x1900) continue;
    const selfName = DVM_SYM.character && DVM_SYM.character[String(e.resid - 0x1800)];
    if (!selfName) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const alive = j => ops[j + 2] && /^get_field status_flags\b/.test(ops[j + 1].text) && /^byte (?:0x01|1)$/.test(ops[j + 2].text);
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].text !== 'word Character.' + selfName) continue;
      if (alive(i)) { selfAlive.push({ resid: e.resid, at: ops[i].at, who: e.resid - 0x1800 }); continue; }
      const m = i > 0 && /^set_local 0x([0-9A-F]+)$/i.exec(ops[i - 1].text);
      if (!m) continue;
      const local = 'local Var' + m[1].toUpperCase().padStart(2, '0');
      for (let j = i + 1; j < ops.length; j++) {
        if (ops[j].text === 'set_local 0x' + m[1]) break;
        if (ops[j].text === local && alive(j)) { selfAlive.push({ resid: e.resid, at: ops[i].at, who: e.resid - 0x1800 }); break; }
      }
    }
  }
  const charFlagNeverSet = [...cfTests.keys()].filter(k => !cfSets.has(k) && !cfWild.has(+k.split(':')[1]))
    .map(k => ({ character: +k.split(':')[0], bit: +k.split(':')[1], sites: [...cfTests.get(k).values()] }))
    .sort((a, b) => a.character - b.character || a.bit - b.bit);
  return { unreachable,
           writtenNeverRead: only(writes, reads), readNeverWritten: only(reads, writes),
           flagWrittenNeverRead: only(flagAsg, flagRead), flagReadNeverWritten: only(flagRead, flagAsg),
           exactStrikes: exact.filter(x => computed.has(x.state) && x.n && x.slot),
           charFlagNeverSet, dataCaseNoThing, spacedKeywords, valueForFlag, shadowed, localOnlyFalse, selfAlive,
           unusedCast: unusedCast.map(u => Object.assign(u, { queuedBy: queued.has(u.task) ? [...queued.get(u.task).values()] : [] })),
           writes, reads, flagWrites: flagAsg, flagReads: flagRead };
}

/* SPRITE FRAMES THAT REPEAT ANOTHER POSE. A character's sheet is sixteen
   tiles, four facings (north, east, south, west) by four poses (left foot,
   standing, right foot, sitting), which is how the map draws a walker and a
   sitter. Within a sheet two frames are a few hundred pixels apart; one
   that is within a couple of pixels of another pose is a copy. Found on
   17 September 2026 when the maintainer noticed Magpie sitting as he walks
   left: the fool's west standing frame is the west sitting frame with one
   pixel changed, and the walk cycle passes through the standing frame
   between steps. The fire spirit's south standing and right-foot frames are
   identical as well, which in a creature that does not stride may be meant;
   the row says what the pixels say and no more. */
function spriteRepeats() {
  if (DERIVED.SPRITE_REPEATS) return DERIVED.SPRITE_REPEATS;
  const out = [];
  const facing = ['north', 'east', 'south', 'west'], pose = ['left foot', 'standing', 'right foot', 'sitting'];
  let props = null;
  try { props = getPropTileList(); } catch (e) { props = null; }
  if (!props) return (DERIVED.SPRITE_REPEATS = out);
  for (const pt of [...characterProptypes()].sort((a, b) => a - b)) {
    const base = props[pt];
    if (base === undefined) continue;
    const frames = [];
    for (let k = 0; k < 16; k++) { let im = null; try { im = resolveTileImage(base + k); } catch (e) { im = null; } frames.push(im); }
    if (frames.some(f => !f)) continue;
    for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) {
      let d = 0;
      for (let p = 0; p < frames[i].length && d <= 2; p++) if (frames[i][p] !== frames[j][p]) d++;
      if (d <= 2) out.push({ pt, a: base + i, b: base + j, aName: facing[i >> 2] + ' ' + pose[i & 3], bName: facing[j >> 2] + ' ' + pose[j & 3], pixels: d });
    }
  }
  return (DERIVED.SPRITE_REPEATS = out);
}

/* FOUR MORE KINDS OF LOOSE END, 17 September 2026, each off an entry of the
   bug list and each read rather than listed.

   goesDarkStillLit: an item class that says its light has gone and moves to
   an aspect whose tile still carries a light level. A thing's light is its
   tile's attribute (buildLightSources), so the torch, the lamp and the candle
   all go to tiles of level 0 when they burn out; the staff says "stops
   glowing, turning gray" and goes to aspect 3, whose tile is level 1 like the
   lit ones. The three that go dark properly are the reader's control. */
function goesDarkStillLit() {
  const VAL = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;
  const SAYS_DARK = /stops glowing|goes out|burn(?:s|ed)? out|extinguish|snuff|turning gr[ae]y|goes dark|put out/i;
  const out = [];
  let attrs = null, props = null;
  try { attrs = getTileAttributes(ARCHIVE); props = getPropTileList(); } catch (e) { return out; }
  for (const e of buildScriptTextIndex()) {
    if (e.resid < 0x1000 || e.resid >= 0x1400) continue;
    const pt = e.resid - 0x1000, base = props[pt];
    if (base === undefined) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i + 3 < ops.length; i++) {
      if (!/^set_field aspect\b/.test(ops[i].text) || !VAL.test(ops[i + 3].text)) continue;
      const said = ops.slice(Math.max(0, i - 8), i).map(o => dvmOpString(o)).filter(Boolean).join(' ');
      if (!SAYS_DARK.test(said)) continue;
      const k = dvmNum(ops[i + 3]);
      out.push({ pt, aspect: dvmVal(e.resid, ops[i + 3]), tile: base + k, light: (attrs[base + k] || 0) & 3, said });
    }
  }
  return out;
}

/* scheduleCollisions: two characters the schedule table puts on one square,
   at the same hours, in the same mode. A character's list is cut into
   segments where the hour runs backwards -- Demodocus's whereabouts and
   Darius's jail stay are further segments, chosen by the game's state -- and
   only entries within one segment are compared with each other, so two
   segments that may never be live together are not set against each other.
   Darius and Sardis share the Green Goat's (22,16) at noon and from five to
   ten, which is the board's "same chair" and Bryce Schroeder's fix. */
function scheduleCollisions() {
  const spans = [];
  let s = [];
  try { s = loadSchedules(); } catch (e) { return []; }
  s.forEach((list, i) => {
    if (!i || !list || !list.length) return;
    const segs = [[]];
    let last = -1;
    for (const e of list) { if (e.hour < last) segs.push([]); segs[segs.length - 1].push(e); last = e.hour; }
    for (const seg of segs) {
      const real = seg.filter(e => e.mode !== 0);
      real.forEach((e, k) => { const end = k + 1 < real.length ? real[k + 1].hour : 24; if (end > e.hour) spans.push({ who: i, level: e.level, x: e.x, y: e.y, mode: e.mode, from: e.hour, to: end }); });
    }
  });
  const out = [];
  for (let a = 0; a < spans.length; a++) for (let b = a + 1; b < spans.length; b++) {
    const p = spans[a], q = spans[b];
    if (p.who === q.who || p.level !== q.level || p.x !== q.x || p.y !== q.y || p.mode !== q.mode) continue;
    const from = Math.max(p.from, q.from), to = Math.min(p.to, q.to);
    if (from < to) out.push({ a: p.who, b: q.who, level: p.level, x: p.x, y: p.y, from, to });
  }
  return out;
}

/* nameNeverKept: a character who says their name and never sets their own
   character flag 7, the flag every other name topic sets (by its first
   argument or by its own number) and the scripts test before calling
   someone by name rather than "man" or "woman". Paris and Diomede, the
   board's bug and Bryce Schroeder's fix. */
function nameNeverKept() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    if (e.resid < 0x1800 || e.resid >= 0x1900) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const self = e.resid - 0x1800;
    const name = ops.find(o => /^conversation_response "(?:[^"]*,)?name[,"]/.test(o.text));
    if (!name) continue;
    const kept = ops.some((o, i) => /^call_resource (?:SetCharacterFlag \(0xF00\)|0xF00)$/.test(o.text) && ops[i + 2] && /^byte (?:0x07|7)$/.test(ops[i + 2].text) &&
      (/^arg Arg00$/.test(ops[i + 1].text) || dvmNum(ops[i + 1]) === self));
    if (!kept) out.push({ who: self, resid: e.resid, at: name.at });
  }
  return out;
}

/* askedOfNobody: answers an item class writes for a character, in its
   AskedAbout member, when that character's script never hands a question to
   the AskAbout helper (0xEB6) -- the NPC "Ask About" action sends GetMessage
   to the character, and only a character whose script answers it through
   that helper ever gives an item's answer. Aethon has fifteen written for him
   and no such call, which is the board's "Aethon does not respond to Ask
   About" and Bryce Schroeder's fix. */
function askedOfNobody() {
  const written = new Map();
  for (let pt = 1; pt < 1024; pt++) {
    const c = parseItemClass(pt);
    if (!c) continue;
    const a = c.data.find(x => x.key === 0x33);
    if (!a || a.words.length < 2 || ((a.words[1] >>> 28) & 0xF) !== 0x9) continue;
    const arr = dvmArrayWords(c.bytes, a.words[1] & 0xFFFF);
    if (!arr) continue;
    for (const w of arr) { const who = w & 0xFFFF; if (!written.has(who)) written.set(who, []); written.get(who).push(pt); }
  }
  const out = [];
  for (const [who, pts] of written) {
    const e = dvmScriptEntry(0x1800 + who);
    if (!e) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    if (ops.some(o => /^call_resource (?:AskAbout \()?0xEB6\)?$/.test(o.text))) continue;
    out.push({ who, items: pts, resid: 0x1800 + who });
  }
  return out;
}

/* answersThatRunOn: a keyword answer that says something and has no return
   after it, so the chain runs on into the next keyword's test. When nothing
   further matches, the character's "don't understand" answer follows the one
   just given, which is the board's "flashes then reverts to the
   unrecognised-prompt response". The mage group (0x0808) does it after
   "history", which is how twelve mages came to be listed, and the House
   Atussa group (0x0807) after "atus". The wishing fountain (0x1036) does it
   after each of its four wishes, so every wish is followed at once by "Your
   wish is found elsewhere...", which the board lists among the lines that
   flash past. Magpie's "baho" and "jhia" do it too, inside the block his
   flag 1 guards, which nothing reaches.

   A yes-or-no answer runs on by design as a rule ("y" falls through to the
   "n" test, and in the bartenders' dice game, 0x0812, "y" runs on into the
   game itself), and is listed only when the chain, walked with its own
   reply, comes to a second answer to that same reply: Ennomus (0x1811) says
   "You know - where da Tyrants used to live." and then "Built by the
   Tyrants, it was.", Antenor (0x1824) "I understand - no many can afford
   such prime real estate." and then "Well, that's probably for the best",
   and Pheres (0x184E) asks for the harpy egg and then says "I understand,
   but if you change your mind, please get back to me.", each for one "n",
   the first line replaced before it can be read. All three are on the
   board's list of lines that flash past. `then` is that second answer where
   the walk finds one.

   The answer's end is where it stops, not its jump target: the writers jump
   into the middle of a string to share its tail (Ennomus's castle, Pheres's
   harpies), so the target can fall inside the answer. An answer stops at a
   branch, or at a return no earlier test jumps past. One that runs on having
   only set something, and finds no second answer, is left out: Neoptolemus
   (0x1821) sets a local after "demo" that the chain reads further on.

   The first version measured the answer to its jump target and linked the
   chain through the object's start as well, which the target already is,
   and so found only the two groups. */
function answersThatRunOn() {
  const out = [];
  const RESP = /^conversation_response "([^"]*)" -> 0x([0-9A-F]+)$/i;
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const index = new Map(ops.map((o, k) => [o.at, k]));
    // Walk the chain from op k as the interpreter would for the reply kw: a
    // list that holds kw or "*" is entered, any other jumps to its target.
    const answerFor = (k, kw) => {
      for (let steps = 0; k !== undefined && k < ops.length && steps < 256; steps++) {
        const n = RESP.exec(ops[k].text);
        if (!n) return null;
        if (n[1].split(',').some(x => x === '*' || x === kw)) return { at: ops[k].at, list: n[1] };
        k = index.get(parseInt(n[2], 16));
      }
      return null;
    };
    for (let i = 0; i < ops.length; i++) {
      const m = RESP.exec(ops[i].text);
      if (!m) continue;
      let reach = 0, says = false, stops = false, j = i + 1;
      for (; j < ops.length && !RESP.test(ops[j].text); j++) {
        const t = ops[j].text;
        const th = /^then -> 0x([0-9A-F]+)$/i.exec(t);
        if (th) reach = Math.max(reach, parseInt(th[1], 16));
        if (/^string/.test(t)) says = true;
        if (/^(?:branch |exit|conversation_prompt)/.test(t) || (/^return/.test(t) && reach <= ops[j].at)) { stops = true; break; }
      }
      if (stops || j >= ops.length || !says) continue;
      let then = null;
      for (const kw of m[1].split(',')) if ((then = answerFor(j, kw))) break;
      if (!then && (m[1] === 'y' || m[1] === 'n' || !/^string/.test(ops[j - 1].text))) continue;
      out.push({ resid: e.resid, at: ops[i].at, list: m[1], then });
    }
  }
  return out;
}

/* linesReplacedAtOnce: a spoken line with no click to wait on, followed by
   another spoken line before anything waits. The conversation window keeps
   one speech balloon. A closing quote draws it, a * inside the quotes draws
   it and waits for a click, and the next quoted text replaces the balloon's
   contents; so a line that ends on its closing quote is replaced as soon as
   the next one is drawn, whoever says it. This is the board's list of lines
   that "flash by too quickly to read": Crito's "Did you talk to Hebe about
   me?" (0x1829), Borus's "Glaucus is a good man..." (0x1867), Niobe's first
   two lines when Helen interrupts (0x1859), Ake's "meet me in our @garden
   after dark" for a hero with Persuasion (0x1820), and the bartenders' "Good
   - let's get on with it then." (0x0812). The walk follows the line's own
   path: through branches, past tests (their fall-through), and along an
   answer chain with the reply that led to the line, stopping at anything
   that prompts, returns, prints or calls out, and at a test of a local,
   which the scripts use to steer their own paths. Where the chain comes to
   a second answer for the same reply, the row is answersThatRunOn's. Also
   listed: two quoted lines back to back inside one string, which is how the
   bartenders' "we don't give credit here" is followed at once by "Do you
   need instructions?" for a hero with no oboloi. */
function linesReplacedAtOnce() {
  const out = [];
  const said = t => { const m = /^string(?:\(implicit\))? "(.*)"$/s.exec(t); if (!m) return null; try { return JSON.parse('"' + m[1] + '"'); } catch (err) { return null; } };
  const RESP = /^conversation_response "([^"]*)" -> 0x([0-9A-F]+)$/i;
  const STOP = /^(?:conversation_prompt|return|exit|print|gui_|method |local Var|sys (?!TalkParticipant|SetFlag|ClearFlag|TestFlag|AddQuest|CompleteQuest|Random|GetState|SetState|IsInParty|WhoHasItem|GetSkill)|call_resource (?!SetCharacterFlag|0xF0[12]\b|CountMoneyInParty))/;
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const index = new Map(ops.map((o, k) => [o.at, k]));
    for (let i = 0; i < ops.length; i++) {
      const a = said(ops[i].text);
      if (a === null) continue;
      const pair = /"\s*"/.exec(a);
      if (pair && (a.slice(0, pair.index).split('"').length - 1) % 2 === 1)
        out.push({ resid: e.resid, at: ops[i].at, line: a.slice(0, pair.index + 1), next: a.slice(pair.index + pair[0].length - 1), oneString: true, speaker: false });
      if (!a.endsWith('"') || (a.split('"').length - 1) % 2) continue;
      let reply = null;
      for (let k = i - 1; k >= 0; k--) {
        if (/^(?:conversation_prompt|return|exit|branch )/.test(ops[k].text)) break;
        const r = RESP.exec(ops[k].text);
        if (r) { reply = r[1].split(','); break; }
      }
      let speaker = false;
      for (let j = i + 1, steps = 0; j !== undefined && j < ops.length && steps < 400; steps++) {
        const t = ops[j].text;
        const b = said(t);
        if (b !== null) {
          if (b.startsWith('"')) out.push({ resid: e.resid, at: ops[i].at, line: a, next: b, nextAt: ops[j].at, oneString: false, speaker });
          break;
        }
        const r = RESP.exec(t);
        if (r) {
          if (!reply || r[1].split(',').some(x => x === '*' || reply.includes(x))) break;
          j = index.get(parseInt(r[2], 16));
          continue;
        }
        if (STOP.test(t)) break;
        if (t === 'sys TalkParticipant') speaker = true;
        const br = /^branch 0x([0-9A-F]+)$/i.exec(t);
        j = br ? index.get(parseInt(br[1], 16)) : j + 1;
      }
    }
  }
  return out;
}

/* selfToldByGroup: a character with no answer of their own for their own
   name, so the question falls to a dialogue group their script calls, and
   the group answers about them as about anyone else. Halos asked "Halos" in
   jail says "Hard to say if he did it or not" (the Cademia group, 0x080E);
   Eioneus, Charax, Milcom, Philinus, Propontis and Helen are the rest of the
   board's list that this covers, and Sabinate (the Seldane group, "Sabinate
   is our leader.") is one nobody listed. A keyword kept with a space in
   front of it counts as the character's own, because that is
   spacedKeywords' row; Demodocus on "music" and Alaric on "king" are not a
   name and are not looked for. Only a one-word name is tried, which leaves
   out the guards, whose names are a town and a job. */
function selfToldByGroup() {
  const RESP = /^conversation_response "([^"]*)" -> /;
  const opsOf = resid => { const e = dvmScriptEntry(resid); if (!e) return null; try { return dvmOpsOf(e); } catch (err) { return null; } };
  const out = [];
  for (let n = 1; n < 256; n++) {
    const ops = opsOf(0x1800 + n);
    const name = characterName(n) || '';
    if (!ops || !/^[A-Z][a-z]{3,}$/.test(name)) continue;
    const k = name.slice(0, 4).toLowerCase();
    if (ops.some(o => { const m = RESP.exec(o.text); return m && m[1].split(',').some(x => x.trim() === k); })) continue;
    for (const o of ops) {
      const g = /^call_resource (?:\w+ \()?0x(8[0-9A-F]{2})\)?$/i.exec(o.text);
      if (!g) continue;
      const group = parseInt(g[1], 16);
      const gops = opsOf(group);
      if (!gops) continue;
      const i = gops.findIndex(x => { const m = RESP.exec(x.text); return m && m[1].split(',').includes(k); });
      if (i < 0) continue;
      const said = [];
      for (let j = i + 1; j < gops.length && !RESP.test(gops[j].text); j++) { const t = dvmOpString(gops[j]); if (t) said.push(t); }
      // The group's answer has to be about this character, by name; Paris
      // asked "Paris" is told about his cousin Parium, which is shadowed's.
      if (said.some(t => t.includes(name))) out.push({ who: n, key: k, resid: group, at: gops[i].at, said: said[0] });
      break;
    }
  }
  return out;
}

/* containedUnseen: a script that looks only at things lying loose -- its
   test is that a thing's flags have no bit above the low two, so nothing
   carried (0x10) or inside a prop (0x08) -- for prop types every one of
   which the world places inside something. Detect Traps (0x1A04) asks for
   the poison trap, the blast trap and two more; the five poison traps are in
   crates and the two blast traps in chests, so it never finds either, which
   is the board's "does not detect traps on containers". */
function containedUnseen() {
  const places = new Map();
  for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    let list; try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
    for (const r of list) {
      if (r.flags === 0xFF || (r.flags & 0x40)) continue;
      if (!places.has(r.proptype)) places.set(r.proptype, { loose: 0, inside: 0, hosts: new Set() });
      const p = places.get(r.proptype);
      if (r.onMap) p.loose++;
      else if (r.container !== null) { p.inside++; if (list[r.container]) p.hosts.add(list[r.container].proptype); }
    }
  }
  const out = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const test = dvmSeqFirst(ops, [/^get_field flags\b/, DVM_NUM, /^bitwise_or$/, DVM_NUM, /^eq$/]);
    if (!test || dvmNum(test[1]) !== 3 || dvmNum(test[3]) !== 3) continue;
    for (const g of dvmSeqAll(ops, [/^get_field obj_type\b/, DVM_NUM, /^eq$/])) {
      const pt = dvmNum(g[1]);
      const p = places.get(pt);
      if (p && p.inside && !p.loose) out.push({ resid: e.resid, at: test[1].at, pt, inside: p.inside, hosts: [...p.hosts] });
    }
  }
  return out;
}

/* refusalOnEveryCheck: an item class whose answer to "can this go inside?"
   (member 23) prints a line. The inventory window asks that of the thing
   under the cursor each time it checks a drop (TWInvent::CanDrop), so the
   line is printed for every check, which is the board's "You can't stuff
   the carcass!" repeated many times. Every other class answers without a
   word. */
function refusalOnEveryCheck() {
  const out = [];
  for (let pt = 1; pt < 1024; pt++) {
    const c = parseItemClass(pt);
    const m = c && c.code.find(x => x.key === 23);
    if (!m) continue;
    let ext; try { ext = dvmExtents(c.bytes, 0x1000 + pt); } catch (err) { continue; }
    const span = ext && ext.find(x => x[0] === m.off && x[2] === 'function');
    if (!span) continue;
    // The carcass's is a line and a bare return, which the listing shows as
    // the line alone (dvmProseHead), so it has no ops to find.
    const ph = dvmProseHead(c.bytes.subarray(span[0] + 3, span[1]));
    if (ph && ph.bare) { out.push({ pt, resid: 0x1000 + pt, at: span[0] + 3, said: decodeMacRoman(ph.head) }); continue; }
    const e = dvmScriptEntry(0x1000 + pt);
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const said = ops.find(o => o.at >= span[0] && o.at < span[1] && dvmOpString(o));
    if (said) out.push({ pt, resid: 0x1000 + pt, at: said.at, said: dvmOpString(said) });
  }
  return out;
}

/* highlightsUnanswered: a word marked with @ in a line, which the game
   draws highlighted and lets the player click to ask, that no answer list
   reachable by a character who says the line will match. A character's
   reachable answers are their own script's and those of every dialogue group
   (0x0800 to 0x08FF) it calls, and the groups those call; a list matches a
   typed word when the word begins with one of its keywords. The general
   group's (0x0801) "Pnyx is a city on the eastern coast of Cythera, home of
   the @Magisterium" is said by 66 characters who cannot answer it; Alaric's
   "@join you on your quest" and Demodocus's "Would you like to @hear it?"
   are the two the board half-remembered. Returned one entry per line and
   word, with the characters who say it and cannot answer. */
function highlightsUnanswered() {
  const RESP = /^conversation_response "([^"]*)" -> /;
  const opsOf = resid => { const e = dvmScriptEntry(resid); if (!e) return null; try { return dvmOpsOf(e); } catch (err) { return null; } };
  const lines = new Map();
  for (let n = 1; n < 256; n++) {
    const own = opsOf(0x1800 + n);
    if (!own) continue;
    const scripts = [[0x1800 + n, own]];
    const seen = new Set([0x1800 + n]);
    for (let q = 0; q < scripts.length; q++) for (const o of scripts[q][1]) {
      const g = /^call_resource (?:\w+ \()?0x([0-9A-F]{3,4})\)?$/i.exec(o.text);
      if (!g) continue;
      const r = parseInt(g[1], 16);
      if (r < 0x800 || r >= 0x900 || seen.has(r)) continue;
      seen.add(r);
      const go = opsOf(r);
      if (go) scripts.push([r, go]);
    }
    const keys = [];
    for (const [, ops] of scripts) for (const o of ops) {
      const m = RESP.exec(o.text);
      if (m) keys.push(...m[1].split(',').filter(k => k && k !== '*').map(k => k.toLowerCase()));
    }
    for (const [r, ops] of scripts) for (const o of ops) {
      const t = dvmOpString(o);
      if (!t) continue;
      for (const m of t.matchAll(/@([A-Za-z][A-Za-z']*)/g)) {
        const w = m[1].toLowerCase();
        if (keys.some(k => w.startsWith(k))) continue;
        const id = r + ':' + o.at + ':' + w;
        if (!lines.has(id)) lines.set(id, { resid: r, at: o.at, word: m[1], who: [] });
        const l = lines.get(id);
        if (!l.who.includes(n)) l.who.push(n);
      }
    }
  }
  return [...lines.values()];
}

/* deletedAcrossZoneChange: an item whose Use makes a spell from its Data1,
   casts it, and then deletes the spell it made and itself, where the spell
   moves the party to another zone. A deletion names a thing by its number in
   the zone's prop list, and by then the list is the new zone's, so the two
   numbers name two things there and the item is left. The scroll (0x104B)
   and Directed Nexus (0x1A00), which goes to Land King Hall: the board's
   "something in Landking hall usually gets destroyed" and "the scroll never
   vanished". Cast as a learned spell nothing is deleted, which is why only
   the scroll does it. */
function deletedAcrossZoneChange() {
  const moves = new Map();
  for (const e of buildScriptTextIndex()) {
    if (e.resid < 0x1A00 || e.resid >= 0x1C00) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const z = ops.find(o => o.text === 'sys ChangeZone');
    if (z) moves.set(e.resid - 0x1800, { resid: e.resid, at: z.at });
  }
  if (!moves.size) return [];
  const out = [];
  for (let pt = 1; pt < 1024; pt++) {
    const e = dvmScriptEntry(0x1000 + pt);
    if (!e) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].text !== 'sys New') continue;
      // The type New is given is the item's own Data1: the fifth argument.
      const typeOp = ops.slice(i + 1, i + 14).find((o, k, a) => /^get_field data1\b/.test(o.text) && k > 0 && /^arg Arg00$/.test(a[k - 1].text));
      if (!typeOp) continue;
      const use = ops.slice(i, i + 40).findIndex(o => /^method (?:Use|UseOn|UseAt)\b/.test(o.text));
      if (use < 0) continue;
      const selfDelete = ops.slice(i + use, i + use + 40).find((o, k, a) => o.text === 'sys Delete' && a[k + 1] && a[k + 1].text === 'arg Arg00');
      if (!selfDelete) continue;
      const places = new Map();
      for (let zn = 0; zn < 0x100; zn++) {
        if (!refExists(0x8100 + zn)) continue;
        let list; try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + zn), 0x8100 + zn).data); } catch (err) { continue; }
        for (const r of list) if (r.proptype === pt && r.flags !== 0xFF && !(r.flags & 0x40) && moves.has(r.d3)) places.set(r.d3, (places.get(r.d3) || []).concat(zn));
      }
      for (const [skill, zones] of places) out.push({ pt, resid: 0x1000 + pt, at: selfDelete.at, skill: moves.get(skill).resid, skillAt: moves.get(skill).at, zones });
      break;
    }
  }
  return out;
}

/* stateNoSaveKeeps: a word a script writes into a script resource with
   write_far_word, and the scripts that read it back. A saved game holds the
   To Do list, the macros, the live game, each visited zone's things and map
   memory, the portrait, the character records and the script heap, and no
   script resource: two saves made from a new game hold none (checked
   17 September 2026 against the playthrough kit's). So such a word is
   whatever the last game to write it wrote. Creating the hero writes the
   hero's gender to word 0x10 of resource 0x0500, which is the board's "If you
   start a game as a male, then start another game as a female, and go back
   to the male-character game, NPCs will refer to you as 'she'"; the inns
   write the room paid for to word 0x16 of 0x0301, which a bed checks. */
function stateNoSaveKeeps() {
  const words = new Map();
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const o of ops) {
      const m = /^(write|load)_far_word 0x([0-9A-F]{8})$/i.exec(o.text);
      if (!m) continue;
      const w = parseInt(m[2], 16);
      if (!words.has(w)) words.set(w, { resource: w >>> 16, offset: w & 0xFFFF, writers: [], readers: [] });
      words.get(w)[m[1].toLowerCase() === 'write' ? 'writers' : 'readers'].push({ resid: e.resid, at: o.at });
    }
  }
  return [...words.values()].filter(w => w.writers.length && w.readers.length);
}

/* leaveNeverLeaves: a character who can join the party, answers "leave",
   and never calls LeaveParty anywhere in their script. Hector, Meleager,
   Timon and Dryas each call it in theirs; Aethon says "Maybe it is time for
   me to catch some rats for myself..." and stays. */
function leaveNeverLeaves() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    if (e.resid < 0x1800 || e.resid >= 0x1900) continue;
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    const leave = ops.find(o => /^conversation_response "(?:[^"]*,)?leav/.test(o.text));
    if (leave && ops.some(o => o.text === 'sys JoinParty') && !ops.some(o => o.text === 'sys LeaveParty'))
      out.push({ who: e.resid - 0x1800, resid: e.resid, at: leave.at });
  }
  return out;
}

/* tileReadWithSeenBit: a script that compares GetMapTile's answer with tile
   numbers and never masks it. A map word in memory carries the automap's
   "seen" bit, 0x8000: TViewer::Render and TGameViewer::MagicMap set it on
   every square they draw, LoadLevelMap restores it from the saved automap and
   SaveLevelProps reads it back out, and TActiveMonster::HandleMove masks it
   off (0x7FFF) before it tests the terrain. A square the player can click is
   a square that has been drawn, so an unmasked read is always 0x8000 above
   the tile. The fishing pole is the one script that reads the map, and it
   wants tiles 8 to 15, the water; it therefore always says "You need to cast
   into deep water." Bryce Schroeder's bugfix patch adds exactly the missing
   `word 0x7FFF bitwise_and`, and says so in its comment. */
function tileReadWithSeenBit() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].text !== 'sys GetMapTile') continue;
      const after = ops.slice(i, i + 16);
      if (after.some(o => o.text === 'bitwise_and')) continue;
      const nums = after.map(o => dvmNum(o)).filter(v => v !== null && v >= 0 && v < 0x8000);
      if (after.some(o => /^(?:lt|gt|le|ge|eq)$/.test(o.text)) && nums.length) out.push({ resid: e.resid, at: ops[i].at, compared: nums });
    }
  }
  return out;
}

/* wrongCarryFlags: a script that puts a thing into a character by setting
   its flags to 9 and its container to the character. Every carried record in
   the shipped prop lists has flag 0x10 (16, or 24 equipped), the shops give
   what they sell with 24, and Bryce Schroeder's fix to Fetch sets 0x10; 9 is
   inside-a-prop, so the thing ends inside whatever prop carries the
   character's number and is gone. Fetch does it to whatever it fetches, and
   the attack routine (0x3042) does it to a thrown weapon that hits or is
   parried, which is the board's dagger that vanishes with the killing blow. */
function wrongCarryFlags() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i + 3 < ops.length; i++) {
      if (!/^set_field flags\b/.test(ops[i].text) || dvmNum(ops[i + 3]) !== 9) continue;
      for (let j = i + 4; j < Math.min(i + 14, ops.length - 3); j++) {
        if (!/^set_field container\b/.test(ops[j].text)) continue;
        if (/^(?:global (?:CurrentCharacter|PlayerCharacter)|arg Arg)/.test(ops[j + 3].text)) out.push({ resid: e.resid, at: ops[i + 3].at, into: ops[j + 3].text });
        break;
      }
    }
  }
  return out;
}

/* speechWithNoSpeaker: a script that opens a conversation of its own and
   has someone speak in it without naming a speaker with TalkParticipant.
   The game's own Talk command names two (the hero in the third place, the
   one spoken to in the first) before it calls Talk; a new conversation
   window starts with no speaker, number -1, and draws a speaker's quoted
   words in a balloon placed 88 pixels down for each place, so with none
   named they are drawn above the window's top and are not seen, while
   unquoted narration, which goes to the message line, is. Every other script
   that opens a conversation names both first. Awaken (0x1A13) names neither
   and calls the sleeper's Talk, which is the board's "lets you talk to
   sleepers but their words are invisible". */
function speechWithNoSpeaker() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i < ops.length; i++) {
      if (ops[i].text !== 'sys OpenConversation') continue;
      let named = false, speaks = null;
      for (let j = i + 1; j < ops.length && ops[j].text !== 'sys FinishConversation' && ops[j].text !== 'sys OpenConversation'; j++) {
        if (ops[j].text === 'sys TalkParticipant') { named = true; break; }
        if (!speaks && (/^method Talk\b/.test(ops[j].text) || /^string(?:\(implicit\))? "\\"/.test(ops[j].text))) speaks = ops[j];
      }
      if (!named && speaks) out.push({ resid: e.resid, at: ops[i].at, talk: /^method Talk\b/.test(speaks.text) });
    }
  }
  return out;
}

const VAL_ANY = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;

/* PUZZLES. Two the file answers completely. The braziers in Alaric's void
   room keep the sequence in a quest value: each brazier's Data1 is its
   place in the order, lighting one whose place is the next after the value
   advances it, lighting any other resets the value to zero, and the last
   one prints its line. The Maayti buttons are a lookup table and nothing
   else: a button's Data1 and Data2 each carry a panel offset in the low
   nibble and, in the high nibble, which of seven arrays to use; pressing it
   takes each panel's aspect, reads it through the array, and stores the
   result, then signals when the two panels agree. The arrays are a blob in
   the class: seven pointers, then sixteen entries each. */
/* THE STRANGE DEVICE (24 September 2026), 0x1175, the Think-a-Dot the
   handoff carried: readable since v1.170.0, when its window's callbacks
   stopped being read as array data. Its Use builds eight dots (a list of
   eight literals is the starting state, kept in storage 256) and three
   buttons; a button drops a marble in at dot 0, 1 or 2 (the callbacks at
   0x01FB, 0x0209 and 0x0217). The marble flips the dot it is on and moves on
   through one of two tables -- the one stored in local 2 when the dot is
   now lit, the one in local 3 when it is dark -- until a table says None.
   Then the eight dots are compared with three patterns, each passed with
   the signal it sends. A signal reaches the props of the zone whose Data1
   is the signal and whose class answers one (TGameSys::SendSignal), so the
   doors are found that way. Every number is read off the script, and the
   shortest presses to each pattern are worked out here from the rule. Null
   when the shape is not found. */
function thinkADotRules() {
  const e = dvmScriptEntry(0x1175);
  if (!e) return null;
  let bytes = null;
  try { bytes = smartDecrypt(getResourceBytes(ARCHIVE, 0x1175), 0x1175).data; } catch (err) { return null; }
  const ops = dvmOpsOf(e);
  const arr = o => {
    const v = dvmArrayContents(bytes.subarray(o.at + 3, o.at + 3 + 2 + 8 * 4));
    return v && v.length === 8 ? v.map(x => /^-?\d+$/.test(String(x)) ? +x : null) : null;
  };
  const tableAfter = slot => { const i = ops.findIndex((o, k) => o.text === 'set_local ' + slot && ops[k + 1] && /^data </.test(ops[k + 1].text)); return i >= 0 ? { at: ops[i + 1].at, v: arr(ops[i + 1]) } : null; };
  const lit = tableAfter('0x02'), dark = tableAfter('0x03');
  const patterns = [];
  ops.forEach((o, k) => {
    if (!/^data </.test(o.text) || !ops[k + 1] || !DVM_NUM.test(ops[k + 1].text)) return;
    const v = arr(o);
    if (v) patterns.push({ v, at: o.at, signal: dvmNum(ops[k + 1]), sigAt: dvmVal(0x1175, ops[k + 1]) });
  });
  const gi = ops.findIndex((o, k) => /^gui 0x01$/.test(o.text) && ops.slice(k + 1, k + 9).every(x => DVM_NUM.test(x.text)));
  const start = gi >= 0 ? ops.slice(gi + 1, gi + 9).map(dvmNum) : null;
  if (!lit || !dark || !lit.v || !dark.v || !start || patterns.length < 1) return null;
  // The rule, and the fewest presses from the start to each pattern.
  const press = (st, col) => { const d = st.slice(); for (let p = col, n = 0; p !== null && p !== undefined && n < 16; n++) { d[p] ^= 1; p = d[p] ? lit.v[p] : dark.v[p]; } return d; };
  const key = st => st.join('');
  const prev = new Map([[key(start), null]]), queue = [start];
  while (queue.length) { const st = queue.shift(); for (let c = 0; c < 3; c++) { const nx = press(st, c); if (!prev.has(key(nx))) { prev.set(key(nx), [key(st), c]); queue.push(nx); } } }
  const path = st => { const out = []; for (let k = key(st); prev.get(k); k = prev.get(k)[0]) out.unshift(prev.get(k)[1]); return prev.has(key(st)) ? out : null; };
  // The doors: a placed prop whose Data1 is the signal, of a class with a
  // GetMessage of its own.
  const doors = new Map(), listens = new Map();
  const answers = pt => {
    if (!listens.has(pt)) {
      let yes = false;
      try { const raw = getResourceBytes(ARCHIVE, 0x1000 + pt); if (raw) yes = dvmReadRender(ARCHIVE, smartDecrypt(raw, 0x1000 + pt).data, 0x1000 + pt).some(f => f.name === 'GetMessage'); } catch (err) { quiet(err); }
      listens.set(pt, yes);
    }
    return listens.get(pt);
  };
  for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    let list; try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (err) { continue; }
    for (const r of list) {
      if (r.flags === 0x42 || r.flags === 0x44 || !patterns.some(p => p.signal === r.d1)) continue;
      if (!answers(r.proptype)) continue;
      if (!doors.has(r.d1)) doors.set(r.d1, []);
      doors.get(r.d1).push({ zone: z, x: r.x, y: r.y, pt: r.proptype });
    }
  }
  for (const p of patterns) { p.presses = path(p.v); p.doors = doors.get(p.signal) || []; }
  // Where the device itself lies in the shipped file.
  const placed = [];
  for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    let list; try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (err) { continue; }
    for (const r of list) if (r.proptype === 0x175 && r.flags !== 0x42) placed.push({ zone: z, x: r.x, y: r.y, onMap: !!r.onMap });
  }
  return { resid: 0x1175, start, startAt: ops[gi].at, lit, dark, patterns, placed, reachable: prev.size };
}
function puzzleRules() {
  const out = { braziers: null, buttons: null };
  const bz = dvmScriptEntry(0x113F);
  if (bz) {
    const ops = dvmOpsOf(bz);
    const val = op => dvmVal(0x113F, op);
    const step = dvmSeqFirst(ops, [/^get_field data1/, /^sys GetState$/, VAL_ANY, /^end$/, VAL_ANY, /^add$/, /^eq$/]);
    const last = dvmSeqFirst(ops, [/^get_field data1/, VAL_ANY, /^eq$/]);
    const says = ops.map(dvmOpString).filter(Boolean);
    if (step) out.braziers = { resid: 0x113F, state: val(step[2]), plus: val(step[4]),
                               last: last ? val(last[1]) : null,
                               say: says.filter(s => s.length > 60)[0] || null,
                               lit: says.filter(s => /lit|extinguish/i.test(s)) };
  }
  const bt = dvmScriptEntry(0x1104);
  if (bt) {
    let bytes = null;
    try { bytes = smartDecrypt(getResourceBytes(ARCHIVE, 0x1104), 0x1104).data; } catch (e) { bytes = null; }
    const ops = dvmOpsOf(bt);
    const blob = ops.find(o => /^data </.test(o.text));
    let arrays = null;
    if (bytes && blob) {
      // The operand is an opcode byte, a two byte length, then the outer
      // array; each of its words carries the offset of one table in its low
      // half. Read rather than assumed: a table that does not decode is left
      // out rather than guessed at.
      const outer = dvmArrayWords(bytes, blob.at + 3);
      if (outer) {
        arrays = [];
        for (const w of outer) {
          const sub = dvmArrayWords(bytes, w & 0xFFFF);
          if (sub) arrays.push(sub);
        }
      }
    }
    const pt = 0x104;
    const buttons = [];
    let zone = null, records = null;
    try {
      for (let z = 1; z < 0x100; z++) {
        if (!refExists(0x8100 + z)) continue;
        const list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data);
        const here = list.filter(r => r.proptype === pt && r.flags !== 0xFF && !(r.flags & 0x40));
        if (!here.length) continue;
        zone = 0x8000 + z;
        records = list;
        // The panel a button drives is its OWN RECORD INDEX plus the low
        // nibble, not its position in this filtered list: the class does
        // `arg Arg00 + (data1 & 15)` and casts the result to a Prop. The two
        // agree only if the buttons run from record 0 with nothing between
        // them, and here they are records 82 to 157 with panels and doors
        // interleaved, so counting from the list printed panels that do not
        // exist. Resolve the record and keep it.
        const byIndex = new Map(list.map(r => [r.index, r]));
        for (const r of here)
          buttons.push({ x: r.x, y: r.y, d1: r.d1, d2: r.d2, index: r.index,
                         a: { panel: r.index + (r.d1 & 15), table: r.d1 >> 4, rec: byIndex.get(r.index + (r.d1 & 15)) || null },
                         b: { panel: r.index + (r.d2 & 15), table: r.d2 >> 4, rec: byIndex.get(r.index + (r.d2 & 15)) || null } });
        break;
      }
    } catch (e) { /* no prop lists, no buttons */ }
    // The rooms. Both panels a button drives carry the same door number in
    // their Data1, and a door with that number stands between them, so the
    // five rooms fall out of the records rather than being described here.
    const rooms = new Map();
    if (records) for (const b of buttons) for (const side of [b.a, b.b]) {
      if (!side.rec || !side.rec.d1) continue;
      if (!rooms.has(side.rec.d1)) rooms.set(side.rec.d1, { door: side.rec.d1, panels: new Map(), buttons: new Set(), doorRec: null });
      const rm = rooms.get(side.rec.d1);
      rm.panels.set(side.rec.index, side.rec);
      rm.buttons.add(b);
    }
    if (records) for (const r of records) {
      if (r.flags === 0xFF || (r.flags & 0x40)) continue;
      const rm = rooms.get(r.d1);
      if (rm && r.proptype !== 0x104 && !rm.panels.has(r.index) && !rm.doorRec) rm.doorRec = r;
    }
    if (arrays || buttons.length) out.buttons = { resid: 0x1104, blobAt: blob ? blob.at : null, arrays, buttons, zone, pt,
      rooms: [...rooms.values()].map(rm => ({ door: rm.door, doorRec: rm.doorRec,
        panels: [...rm.panels.values()].sort((a, b) => a.x - b.x), buttons: [...rm.buttons] })).sort((a, b) => a.door - b.door) };
  }
  out.riddles = riddleRules();
  out.tunes = tuneRules();
  return out;
}

/* TUNES. Three locks in the scenario are opened by playing or ringing things
   in an order, and all three encode the order the same way: as a base-16
   number, one nibble per note, compared against a single constant.

   The bells in the Tyrant's Tomb accumulate into a near word,
   near[8] = (near[8] * 0x10 + data1) & 0xFFFF, so only the LAST FOUR rings
   count and a misring can be rung out rather than restarting. The four bells
   carry 1 to 4 in Data1, ascending west to east, which settles a numbering
   the board had to adjudicate between two conventions.

   The instruments are handed an accumulator by the Instrument widget and mask
   it to the length of their tune: three nibbles for the lyre, five for the
   panpipes. Each instrument's gui Instrument call carries a list of the notes
   it can play, and a note n is the letter at 65 + n -- which is how the
   file's 0xF79C3 is the PHJMD players write down, and 0xFC6 is PMG. That
   mapping is derived, not assumed: it spells both of the community's strings,
   and a mapping shifted by one spells neither.

   A tune's signal opens the prop carrying it in Data1, the same mechanism the
   Hall of Truth buttons use. */
function tuneRules() {
  const out = { bells: null, instruments: [] };
  const letter = n => String.fromCharCode(65 + n);
  const nibbles = (v, n) => v.toString(16).toUpperCase().padStart(n, '0').split('').map(c => parseInt(c, 16));
  /* What a signal opens is NOT in the archive, and the first version of this
     reader claimed it was. It matched every prop whose Data1 equalled the
     signal, archive wide, and reported that the bells open a plaque in
     Cademia, a torch in Kosha, three bookshelves in Pnyx and a Hall of Truth
     button. Two separate errors: these are small integers reused everywhere
     as an ordinary field, and on a door Data1 is not a signal at all -- the
     door class tests `data1 < 128` and hands eight aspect values to 0xE40,
     which is the opening helper, comparing the door's ASPECT against them for
     "Locked!" and "Magically Locked!".

     EmitSignal is opcode 0xC5, cbSendSignal, and the eggs reach the same
     thing as TGameSys::SendSignal (the workbench's save-format.md). Delivery
     is the engine's: no class in the archive has a handler, the stone door
     that demonstrably answers the Hall of Truth buttons included. So the
     sheet states the signal a tune emits and stops there. */

  // ---- the bells -----------------------------------------------------
  const bellEntry = dvmScriptEntry(0x10C1);
  if (bellEntry) {
    const ops = dvmOpsOf(bellEntry);
    // the shift is `load_near_word, byte, mul, ..., add, word, bitwise_and`
    const shift = dvmSeqFirst(ops, [/^load_near_word/, DVM_NUM, /^mul$/]);
    const orders = [];
    for (const m of dvmSeqAll(ops, [/^load_near_word/, DVM_NUM, /^eq$/, /^then/, /^sys EmitSignal$/, DVM_NUM])) {
      const tune = dvmVal(0x10C1, m[1]), sig = dvmVal(0x10C1, m[5]);
      if (!tune || !sig) continue;
      orders.push({ tune, signal: sig, rings: nibbles(tune.v, 4) });
    }
    const bells = [];
    let zone = null;
    try {
      for (let z = 1; z < 0x100; z++) {
        if (!refExists(0x8100 + z)) continue;
        const here = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data)
          .filter(r => r.proptype === 0xC1 && r.flags !== 0xFF && !(r.flags & 0x40) && r.d1);
        if (here.length < 2) continue;
        zone = 0x8000 + z;
        for (const r of here.sort((a, b) => a.x - b.x)) bells.push({ x: r.x, y: r.y, number: r.d1 });
        break;
      }
    } catch (e) { /* no prop lists */ }
    if (orders.length) out.bells = { resid: 0x10C1, base: shift ? dvmVal(0x10C1, shift[1]) : null, orders, bells, zone };
  }

  // ---- the instruments -----------------------------------------------
  for (const [resid, what] of [[0x1099, 'panpipes'], [0x109A, 'lyre']]) {
    const entry = dvmScriptEntry(resid);
    if (!entry) continue;
    let bytes = null;
    try { bytes = smartDecrypt(getResourceBytes(ARCHIVE, resid), resid).data; } catch (e) { continue; }
    const ops = dvmOpsOf(entry);
    // the test is `arg, word mask, bitwise_and, word tune, eq`
    const m = dvmSeqFirst(ops, [/^arg /, DVM_NUM, /^bitwise_and$/, DVM_NUM, /^eq$/]);
    if (!m) continue;
    const mask = dvmVal(resid, m[1]), tune = dvmVal(resid, m[3]);
    const emit = dvmSeqFirst(ops, [/^sys EmitSignal$/, DVM_NUM]);
    const sig = emit ? dvmVal(resid, emit[1]) : null;
    if (!mask || !tune) continue;
    const len = Math.round(Math.log2(mask.v + 1) / 4);
    const notes = nibbles(tune.v, len);
    // Each gui Instrument call carries the notes that instrument can play.
    const lists = [];
    for (const o of ops.filter(o => /^data </.test(o.text))) {
      const words = dvmArrayWords(bytes, o.at + 3);
      if (words) lists.push({ at: o.at, notes: words, spelled: words.map(letter).join('') });
    }
    // Only a prop whose Data1 matches can be the working one, where the class
    // tests it. Read the test rather than stating which instrument it is.
    const gate = dvmSeqFirst(ops, [/^get_field data1/, DVM_NUM, /^eq$/]);
    out.instruments.push({ resid, what, mask, tune, signal: sig,
      notes, spelled: notes.map(letter).join(''),
      gate: gate ? dvmVal(resid, gate[1]) : null, lists,
      given: createsOf(resid === 0x1099 ? 0x99 : 0x9A) });
  }
  return out;
}

/* WHAT A SIGNAL REACHES. Scripts emit signals all over the scenario -- the
   bells, both music locks, the Hall of Truth buttons, every lever -- and
   nothing in the ARCHIVE says what answers one. No class has a handler, not
   even the stone door that demonstrably opens when a Hall of Truth button is
   pressed. The answer is in the application, in TGameSys::SendSignal, and
   this reads it there rather than guessing from the records.

   The order, from the routine itself: a signal of zero returns at once;
   otherwise GetMessage (method 21) goes to the ZONE, then to the ROOM; then,
   only when the signal is below 256, to every prop of the level whose flags
   pass a mask, whose class carries a flag bit, and WHOSE DATA1 EQUALS THE
   SIGNAL; then to all 512 character slots; then TGremlin::OnSignal.

   The mask is worth stating carefully. The instruction is `li 0, -163`, which
   is 0xFFFFFF5D, and it is ANDed with a byte, so the test is `flags & 0x5D`
   being 0 or 1. Against the archive's own conventions that excludes eggs
   (0x42 -> 0x40), roofs (0x44 -> 0x44) and contained props (0x09), and admits
   a plain placed prop, which is what the rule should do.

   One thing this deliberately does NOT say is which classes carry the flag.
   That table is *(r2-30424), one long per class indexed by prop type times
   four -- the same table the workbench's item-dragging-spec.md documents from
   the 68K side at A5+$21488, where $200000 is slidable and $100000 droppable
   and the signal bit is $10000. It cannot be read out of the program image:
   the pointer resolves into the data section and every long there is zero, so
   it is built at load time. The control that established that, rather than
   leaving "no class listens" on the page, was counting the slidable and
   droppable classes: both came back zero, which is impossible for a shipped
   game and proved the read empty rather than the table. */
function signalRules() {
  const r = exeRoutineNamed('TGameSys::SendSignal');
  if (!r) return null;
  const ops = exeOpsOf(r);
  if (!ops.length) return null;
  const imm = o => (o && o.d && typeof o.d.imm === 'number') ? o.d.imm : null;
  // Matched by the SHAPE of the instructions, never by address, so a
  // differently built application still reads or else says nothing.
  const first = (mn, v) => ops.find(o => o.mn === mn && imm(o) === v) || null;
  const method = first('li', 21);
  const under = first('cmpwi', 256);
  const slots = first('cmpwi', 512);
  const mask = first('li', -163);
  const stride = ops.find(o => o.mn === 'addi' && o.d && o.d.rd === o.d.ra && imm(o) === 16) || null;
  const calls = ops.filter(o => o.mn === 'bl' && o.to !== null && o.to !== undefined)
                   .map(o => ({ at: o.at, name: exeTargetName(o.to) }));
  const sends = calls.filter(c => /DoInterp/.test(c.name));
  const gremlin = calls.find(c => /OnSignal/.test(c.name)) || null;
  if (!method || !under || !slots) return null;
  return {
    name: r.name, at: r.offset, length: r.length,
    method: exeVal(method, 21), under: exeVal(under, 256), slots: exeVal(slots, 512),
    mask: mask ? exeVal(mask, 0x5D) : null, stride: stride ? exeVal(stride, 16) : null,
    sends: sends.length, sendAt: sends.length ? exeVal({ at: sends[0].at }, sends.length) : null,
    gremlin: gremlin ? { name: gremlin.name, val: exeVal({ at: gremlin.at }, 0) } : null
  };
}

/* Who hands a prop over. sys Create is (recipient, aspect<<10|proptype,
   data1, data2), a signature delv-script.js records from the board and
   confirms against call sites -- Ennomus's tomb key is Create(you, 3<<10|66,
   5, 0), and the archive has exactly that.

   The recipient is NOT always a register. Thirteen of the archive's
   twenty-seven flat Creates address it as a plain number, character 1 being
   the hero, and a pattern that insists on `global`/`arg`/`local` cannot see
   any of them. libraryRules carried that narrower pattern until 14 September
   2026: it cost nothing on this archive, because every document handed over
   goes through `global PlayerCharacter`, but it would have under-counted in a
   modded one. Both read CREATE_RECIPIENT now. */
function createsOf(proptype) {
  const out = [];
  const RECIPIENT = CREATE_RECIPIENT;
  try {
    for (let subn = 0; subn < 256; subn++) {
      const mi = ARCHIVE && ARCHIVE.index[subn];
      if (!mi || !mi[0]) continue;
      for (let ri = 0, n = subindexCount(ARCHIVE, subn); ri < n; ri++) {
        const resid = ((subn + 1) << 8) | ri;
        if (!refExists(resid)) continue;
        let ops = null;
        try { ops = dvmOpsOf(dvmScriptEntry(resid)); } catch (e) { continue; }
        if (!ops) continue;
        for (const m of dvmSeqAll(ops, [/^sys Create$/, RECIPIENT, DVM_NUM, DVM_NUM])) {
          const ap = dvmNum(m[2]);
          if (ap === null || (ap & 0x3FF) !== proptype) continue;
          out.push({ resid, name: labelFor(resid) || null, at: m[0].at, data1: dvmVal(resid, m[3]) });
        }
      }
    }
  } catch (e) { /* no archive */ }
  return out;
}

/* THE RIDDLES. The five buttons in the Hall of Truth each speak a riddle and
   take a spoken answer: 0x1110 opens a conversation, prints one of five
   strings chosen by the button's own Data1, and accepts one keyword. Get it
   right and it emits the button's Data2 as a signal; a stone door carrying
   that number in its Data1 is what opens.

   The five strings are reached through a table of DREFS. A dref is
   0x80000000 | resid << 16 | offset (js/delv-script.js), so the entries read
   0x91100068 and the rest, every one of them pointing back into 0x1110
   itself, and the text at each offset runs to a NUL.

   That last detail took three readings and the two wrong ones are worth
   recording, because the first looked right. Reading a length byte at the
   offset gives " am always hungry," -- the byte there is 'I', 73, a perfectly
   plausible length, so the string comes out long and almost correct with its
   first character eaten. Reading a length byte before the offset gives
   "I am al". Neither is a Pascal string; there is no length anywhere. The
   same mistake, a swallowed leading byte, once produced a false claim in this
   project that a hundred dialogues held unrendered text, so the smoke pins
   the first riddle whole and pins what the wrong reading would give.

   dvmStringObjects finds this prose too, but as separate lines, because it
   sweeps regions the disassembler could not reach rather than following the
   table. Whole riddles need the table. */
function riddleRules() {
  const entry = dvmScriptEntry(0x1110);
  if (!entry) return null;
  let bytes = null;
  try { bytes = smartDecrypt(getResourceBytes(ARCHIVE, 0x1110), 0x1110).data; } catch (e) { return null; }
  const ops = dvmOpsOf(entry);
  const blob = ops.find(o => /^data </.test(o.text));
  const table = blob ? dvmArrayWords(bytes, blob.at + 3) : null;
  const text = [];
  if (table) for (const w of table) {
    if (!(w & 0x80000000) || ((w & 0x7FFF0000) >>> 16) !== 0x1110) { text.push(null); continue; }
    const off = w & 0xFFFF;
    let end = off;
    while (end < bytes.length && bytes[end]) end++;
    text.push(decodeMacRoman(bytes.slice(off, end)));
  }
  // The answers, in the order the script tests them, read off the opcodes
  // rather than listed here. A keyword with a comma is two spellings of one
  // answer, which is how "sound" also takes "noise".
  const answers = ops.map(o => {
    const m = /^conversation_response "([^"]*)"/.exec(o.text);
    return m ? m[1] : null;
  }).filter(Boolean);
  const buttons = [], doors = [];
  let zone = null;
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      const list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data);
      const here = list.filter(r => r.proptype === 0x110 && r.flags !== 0xFF && !(r.flags & 0x40));
      if (!here.length) continue;
      zone = 0x8000 + z;
      for (const r of here) {
        const door = list.find(d => d.d1 === r.d2 && d.proptype !== 0x110 && d.flags !== 0xFF && !(d.flags & 0x40));
        buttons.push({ x: r.x, y: r.y, which: r.d1, signal: r.d2, door: door || null });
      }
      // The lone button of its own class, which emits from both its fields.
      for (const r of list.filter(r => r.proptype === 0x107 && r.flags !== 0xFF && !(r.flags & 0x40))) {
        const door = list.find(d => d.d1 === r.d1 && d.proptype !== 0x107 && d.flags !== 0xFF && !(d.flags & 0x40));
        doors.push({ x: r.x, y: r.y, signal: r.d1, second: r.d2, door: door || null });
      }
      break;
    }
  } catch (e) { /* no prop lists */ }
  buttons.sort((a, b) => a.which - b.which);
  return { resid: 0x1110, blobAt: blob ? blob.at : null, text, answers, buttons, zone, lone: doors };
}

/* WHO ANSWERS AS WHOM. A character's conversation is their own topics and
   then, for most of them, a generic set they fall through to: Naxos answers
   as House Comana, then as Cademia, then as Human. The chain is in the "*"
   catch-all, and dvmConversation already returns it as `groups`.

   The distinction that matters here, and that cost a rewrite of this reader:
   `groups` is INHERITANCE, the catch-all chain, while `groupsAll` also sweeps
   calls made from a single topic. Those are different things. The Student
   group answers "golem" by calling the Mage group, and eight groups answer
   "where is" by calling GiveDirections (0x816), which is not a group at all
   but a routine that opens with AddConversationKeyword "Where Is". Counting
   groupsAll as inheritance inflates every number and invents a hierarchy on
   top of routines; this reads `groups` and reports the calls separately.

   Three of the 0x8xx resources are not groups: 0x813 (Tavern rumors) and
   0x816 are routines with no topic list, and 0x803 (House Atussa, defunct)
   and 0x814 are stubs of 14 and 11 bytes. They are labelled as such rather
   than shown as groups with nothing in them. */
function convRules() {
  // Memoised for the same reason as libraryRules: the Dialogue gallery shows
  // this card, and building it walks all 256 conversation resources.
  if (DERIVED.CONV_RULES) return DERIVED.CONV_RULES;
  const chars = [];
  for (let rid = 0x1800; rid <= 0x18FF; rid++) {
    if (!refExists(rid)) continue;
    let c = null;
    try { c = conversationFor(rid); } catch (e) { c = null; }
    if (!c || !c.entries || !c.entries.length) continue;
    const chain = c.groups || [], all = c.groupsAll || [];
    chars.push({ rid, name: labelFor(rid) || propWordHex(rid), topics: c.entries.length,
                 deeper: c.entries.filter(e => e.sub && e.sub.length).length,
                 chain, calls: all.filter(g => chain.indexOf(g) < 0) });
  }
  const groups = [];
  for (let rid = 0x800; rid <= 0x8FF; rid++) {
    if (!refExists(rid)) continue;
    let c = null;
    try { c = conversationFor(rid); } catch (e) { c = null; }
    let bytes = 0;
    try { bytes = getResourceBytes(ARCHIVE, rid).length; } catch (e) { bytes = 0; }
    const topics = c && c.entries ? c.entries.length : 0;
    groups.push({ rid, topics, bytes,
                  name: (typeof DIALOGUE_GROUP_NAMES === 'object' && DIALOGUE_GROUP_NAMES[rid]) || null,
                  kind: topics ? 'group' : (bytes < 40 ? 'stub' : 'a routine, not a topic list'),
                  inherited: chars.filter(ch => ch.chain.indexOf(rid) >= 0).length,
                  called: chars.filter(ch => ch.calls.indexOf(rid) >= 0).length });
  }
  const gname = rid => {
    const g = groups.find(q => q.rid === rid);
    return (g && g.name) || labelFor(rid) || propWordHex(rid);
  };
  const shapes = new Map();
  for (const ch of chars) {
    const key = ch.chain.length ? ch.chain.map(gname).join(' > ') : '';
    if (!shapes.has(key)) shapes.set(key, []);
    shapes.get(key).push(ch);
  }
  return DERIVED.CONV_RULES = { chars, groups, gname,
           shapes: [...shapes.entries()].map(([k, who]) => ({ shape: k, who }))
                     .sort((a, b) => b.who.length - a.who.length) };
}

/* WHAT THE SCRIPTS LEAN ON. The archive's call graph is small and lopsided:
   most resources call nothing at all, and the few that are called are called
   by nearly everything. buildXrefIndex already computes it in both
   directions and is memoised, so this is a reading rather than an analysis.
   It counts four kinds of reference, and the difference shows: a text array
   like the To Do lines is referenced by two dozen scripts and called by
   none, because they name it in a `word` operand rather than calling it.

   The second half needs writing carefully, and the care is the point.
   "Referenced by nothing" is true of most of the archive and means nothing
   on its own: an item class is reached by its prop type, a dialogue by its
   character index, a room script by its room number, a skill by its skill
   number. Saying so as a headline would be the same mistake as calling the
   ambient-sound eggs "nothing". The cut that carries information is a
   resource unreferenced among siblings that ARE referenced: a helper nobody
   calls standing beside one with a hundred callers.

   Even then, the usual answer is that the application calls it by a
   hardcoded id, not that it is dead, and two ranges here prove it rather
   than assume it: the combat-AI hooks in 0x9xx are invoked by the compiled
   .ai rules that ship beside the game, and the 0x2xx arrays are the
   character-creation tables the dialog reads. So the card says "no script in
   this archive calls it", which is what was measured, and never "dead". */
function leanRules() {
  let idx = null;
  try { idx = buildXrefIndex(); } catch (e) { return null; }
  const inb = idx.inbound, outb = idx.outbound;
  let edges = 0;
  const kinds = {};
  for (const k of Object.keys(outb)) for (const e of outb[k]) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; edges++; }
  const ranked = Object.keys(inb).map(Number).map(rid => ({
    rid, refs: inb[rid].length, calls: inb[rid].filter(e => e.kind === 'call').length
  })).sort((a, b) => b.refs - a.refs);
  const ranges = [];
  try {
    for (let subn = 0; subn < 256; subn++) {
      const mi = ARCHIVE && ARCHIVE.index[subn];
      if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
      let live = 0;
      const dead = [];
      const count = subindexCount(ARCHIVE, subn);
      for (let ri = 0; ri < count; ri++) {
        const rid = ((subn + 1) << 8) | ri;
        let raw = null;
        try { raw = getResourceBytes(ARCHIVE, rid); } catch (e) { raw = null; }
        if (!raw || !raw.length) continue;
        if (inb[rid]) live++; else dead.push({ rid, name: labelFor(rid) || null });
      }
      const total = live + dead.length;
      // A range nothing references at all is structural, not interesting.
      if (!total || !live || dead.length / total > 0.9) continue;
      const purpose = SUBINDEX_PURPOSE[subn];
      ranges.push({ subn, total, live, dead,
                    label: '0x' + (subn + 1).toString(16).toUpperCase() + 'xx',
                    what: purpose ? purpose[0] : '' });
    }
  } catch (e) { /* no archive open, and then there are no ranges to show */ }
  return { edges, kinds, ranked, ranges,
           referencing: Object.keys(outb).length, referenced: Object.keys(inb).length };
}

/* SPELLS. Every spell script casts through one helper, CastSpell (0xEA1),
   with the spell's level and its cost in magic points, so the two are read
   off each script's call. The helper says the rest: a cost above the
   caster's magic fails with "The spell requires more power than you
   currently have"; the cost is taken, the caster's timing rises by 10 plus
   twice the level, and the casting fails when two rolls of 0 to the
   caster's Casting figure (the skill, else a class figure) together fall
   short of a roll of 0 to the level. Nothing else about a spell -- what
   it does -- is a rule; that is the spell's own script. */
function spellRules() {
  const idx = buildScriptTextIndex();
  const helper = dvmScriptEntry(0xEA1);
  // The time a cast takes: timing + (base + mult x level).
  const tg = helper ? dvmSeqFirst(dvmOpsOf(helper), [/^get_field timing/, DVM_NUM, DVM_NUM, /^arg Arg01$/, /^mul$/, /^add$/]) : null;
  const rule = helper ? { power: /requires more power/.test(helper.text), failure: /You failed to cast/.test(helper.text),
    timing: !!tg, timeBase: tg ? dvmVal(0xEA1, tg[1]) : null, timeMult: tg ? dvmVal(0xEA1, tg[2]) : null,
    casting: /short (?:0x00C3|195)\b/.test((dvmScriptEntry(0xE85) || { text: '' }).text) } : null;
  const spells = [];
  for (const e of idx.filter(e => e.subn === 25)) {
    const ops = dvmOpsOf(e);
    for (let i = 0; i < ops.length; i++) {
      if (!/^call_resource CastSpell\b/.test(ops[i].text)) continue;
      const a = ops[i + 3], b = ops[i + 4];
      if (!(a && b && /^byte /.test(a.text) && /^byte /.test(b.text))) continue;
      spells.push({ resid: e.resid, name: selfNameFor(e.resid) || labelFor(e.resid) || ('0x' + e.resid.toString(16)),
                    level: dvmNum(a), cost: dvmNum(b), levelVal: dvmVal(e.resid, a), costVal: dvmVal(e.resid, b) });
      break;
    }
  }
  spells.sort((x, y) => x.level - y.level || x.cost - y.cost || x.name.localeCompare(y.name));
  return { rule, spells };
}

/* HUNGER. Nothing in the scripts lowers nutrition; the fall is the
   engine's. The scripts read it: the idle script complains below 4, the
   fountain and Nutrient add up to a ceiling of 100. */
function hungerNotes() {
  const idx = buildScriptTextIndex();
  const falls = idx.some(e => /set_field nutrition[\s\S]{0,120}sub/.test(e.text));
  // Every `nutrition < n`: the idle script's is the complaint, and the
  // largest anywhere else is the ceiling what adds to it stops at.
  const tests = [];
  for (const e of idx) {
    if (!/get_field nutrition/.test(e.text)) continue;
    for (const g of dvmSeqAll(dvmOpsOf(e), [/^get_field nutrition/, DVM_NUM, /^lt$/])) tests.push(dvmVal(e.resid, g[1]));
  }
  const complainsVal = tests.find(t => t.resid === 0x3020) || null;
  const others = tests.filter(t => t.resid !== 0x3020);
  const top = others.length ? Math.max.apply(null, others.map(t => t.v)) : null;
  const ceilingVal = top === null ? null : others.find(t => t.v === top);
  const ceilingBy = top === null ? [] : [...new Set(others.filter(t => t.v === top).map(t => t.resid))];
  return { falls, complains: complainsVal ? complainsVal.v : null, complainsVal, ceiling: top, ceilingVal, ceilingBy };
}

/* THE CLOCK, HUNGER, HEALING AND POISON, off the application's code. One
   routine, TGameViewer::DoTicks, advances the clock and does all four, and
   this reads it the way the trace in the workbench's doc/game-clock.md did,
   instruction by instruction:

   - the table of periods: an `addi r, 2, d` the counting loop indexes with
     `lwzx`, as many words as the loop's `cmpwi 0, n` bound, and the stack
     array the counts go into (`addi r, 1, base` before the `stwx`);
   - the hour and the quarter hour: the `srawi` that shifts the clock word
     before the call of ScheduleTime, and the one before DayTimeChanged;
   - the day: the `lis`/`addi` pair the roll-over loop compares against;
   - hunger: `lbz r, n(31)`, `addi 0, r, -k`, `stb 0, n(31)` -- the first
     byte of the record taken down -- and the count it is gated on;
   - healing: the level byte shifted (`srawi`) and capped (`cmpwi`, `li`),
     the counts indexed by it, gated on nutrition not being 0, and the two
     byte pairs it raises and caps (health against full health, magic
     against full magic);
   - poison and regeneration: the count the six-minute loop runs on, the two
     status bits it tests (`rlwinm.` to one bit each), the coin toss when
     both are set (a call of Random), and the `cmplwi 0, n` before the call
     of CharEntry::DeathRites.

   Each figure comes back as { v, exe } with the address of the instruction
   that holds it. A pattern that does not match leaves its figure null and
   the sheet drops the sentence that needed it. */
function exeClockRules() {
  const ops = exeOpsNamed('TGameViewer::DoTicks');
  if (!ops.length) return null;
  const val = (i, v) => i >= 0 ? exeVal(ops[i], v) : null;
  const r = {};
  // The period table and the counts.
  const ti = exeFind(ops, 0, 40, d => d.mn === 'addi' && d.ra === 2 && ops.some(o => o.d && o.d.mn === 'lwzx' && o.d.ra === d.rd));
  if (ti < 0) return null;
  const use = exeFind(ops, ti + 1, 200, d => d.mn === 'lwzx' && d.ra === ops[ti].d.rd);
  const store = exeFind(ops, use, 24, d => d.mn === 'stwx');
  const baseI = exeFindBack(ops, store, 4, d => d.mn === 'addi' && d.ra === 1);
  const boundI = exeFind(ops, store, 8, d => d.mn === 'cmpwi');
  if (use < 0 || store < 0 || baseI < 0 || boundI < 0) return null;
  const n = ops[boundI].d.imm, base = ops[baseI].d.imm;
  const periods = exeDataWords(exeTocOffset(ops[ti].d.imm), n);
  if (!periods) return null;
  r.table = val(ti, periods); r.count = val(boundI, n); r.countBase = base;
  const countIndex = d => d && d.mn === 'lwz' && d.ra === 1 && d.d >= base && d.d < base + 4 * n && (d.d - base) % 4 === 0 ? (d.d - base) / 4 : -1;
  // The hour and the quarter hour, by what each change calls.
  const sched = ops.findIndex(o => exeCalls(o, 'ScheduleTime'));
  const light = ops.findIndex(o => exeCalls(o, 'TGameViewer::DayTimeChanged'));
  const hs = sched >= 0 ? exeFindBack(ops, sched, 14, d => d.mn === 'srawi') : -1;
  const qs = light >= 0 ? exeFindBack(ops, light, 14, d => d.mn === 'srawi') : -1;
  r.hourShift = hs >= 0 ? val(hs, ops[hs].d.sh) : null;
  r.quarterShift = qs >= 0 ? val(qs, ops[qs].d.sh) : null;
  r.schedules = sched >= 0 ? val(sched, exeTargetName(ops[sched].to)) : null;
  r.lighting = light >= 0 ? val(light, exeTargetName(ops[light].to)) : null;
  // The day: the roll-over loop's limit.
  for (let i = 0; i < ops.length && !r.day; i++) {
    const a = ops[i].d; if (!a || a.mn !== 'lis') continue;
    const j = exeFind(ops, i + 1, 3, d => d.mn === 'addi' && d.ra === a.rd && d.rd === a.rd);
    if (j < 0) continue;
    const k = exeFind(ops, j + 1, 2, d => d.mn === 'cmpw' && d.rb === a.rd);
    if (k < 0 || !ops[k + 1] || !ops[k + 1].d || ops[k + 1].d.mn !== 'bf' || ops[k + 1].d.disp >= 0) continue;
    r.day = val(i, a.imm * 65536 + ops[j].d.imm);
  }
  // Hunger: the first record byte taken down by a constant.
  const fi = ops.findIndex((o, i) => o.d && o.d.mn === 'addi' && o.d.imm < 0 && o.d.ra === (ops[i - 1] && ops[i - 1].d && ops[i - 1].d.rt) &&
    ops[i - 1].d.mn === 'lbz' && ops[i - 1].d.ra === 31 && ops[i + 1] && ops[i + 1].d && ops[i + 1].d.mn === 'stb' && ops[i + 1].d.d === ops[i - 1].d.d);
  if (fi >= 0) {
    r.nutritionByte = val(fi - 1, ops[fi - 1].d.d);
    r.fall = val(fi, -ops[fi].d.imm);
    const ci = exeFindBack(ops, fi, 16, d => countIndex(d) >= 0);
    r.hungerIndex = ci >= 0 ? val(ci, countIndex(ops[ci].d)) : null;
  }
  // Healing: the level shifted and capped picks the count.
  const si = fi >= 0 ? exeFind(ops, fi, 16, d => d.mn === 'srawi') : -1;
  if (si >= 0 && ops[si - 1] && ops[si - 1].d && ops[si - 1].d.mn === 'lbz') {
    r.levelByte = val(si - 1, ops[si - 1].d.d);
    r.levelShift = val(si, ops[si].d.sh);
    const capI = exeFind(ops, si, 8, d => d.mn === 'cmpwi');
    r.levelCap = capI >= 0 ? val(capI, ops[capI].d.imm) : null;
    // Gated on nutrition: the nutrition byte tested against 0.
    const fed = exeFind(ops, si, 24, d => d.mn === 'lbz' && r.nutritionByte && d.d === r.nutritionByte.v);
    r.fedGate = fed >= 0 ? val(fed, 0) : null;
    const cmp1 = exeFind(ops, si, 30, d => d.mn === 'cmplw');
    const cmp2 = cmp1 >= 0 ? exeFind(ops, cmp1 + 1, 40, d => d.mn === 'cmplw') : -1;
    const pair = i => i >= 2 && ops[i - 1].d && ops[i - 2].d && ops[i - 1].d.mn === 'lbz' && ops[i - 2].d.mn === 'lbz' ? [val(i - 2, ops[i - 2].d.d), val(i - 1, ops[i - 1].d.d)] : null;
    r.healthBytes = cmp1 >= 0 ? pair(cmp1) : null;
    r.magicBytes = cmp2 >= 0 ? pair(cmp2) : null;
  }
  // Poison and regeneration: the six-minute loop.
  const rnd = ops.findIndex(o => exeCalls(o, 'Random'));
  if (rnd >= 0) {
    const bits = [];
    for (let i = exeFindBack(ops, rnd, 20, d => countIndex(d) >= 0); i >= 0 && i < rnd; i++) {
      const d = ops[i].d;
      if (d && d.mn === 'rlwinm.' && d.sh === 0 && d.mb === d.me && bits.length < 2 && !bits.some(b => b.v === 31 - d.mb)) {
        bits.push(val(i, 31 - d.mb));
        // The word the bits are of: the record word loaded just before.
        const w = ops[i - 1] && ops[i - 1].d;
        if (!r.statusWord && w && w.mn === 'lhz' && w.rt === d.rs && w.ra === 31) r.statusWord = val(i - 1, w.d);
      }
    }
    const pi = exeFindBack(ops, rnd, 20, d => countIndex(d) >= 0);
    r.poisonIndex = pi >= 0 ? val(pi, countIndex(ops[pi].d)) : null;
    r.poisonBit = bits[0] || null; r.regenBit = bits[1] || null;
    r.coinToss = val(rnd, 'Random');
    const death = ops.findIndex(o => exeCalls(o, 'CharEntry::DeathRites'));
    const dt = death >= 0 ? exeFindBack(ops, death, 6, d => d.mn === 'cmplwi') : -1;
    r.deathAt = dt >= 0 ? val(dt, ops[dt].d.imm) : null;
    // What a pass takes off a poisoned character's health and gives a
    // regenerating one: the health byte loaded, a constant added, stored back.
    const hb = r.healthBytes ? r.healthBytes[0].v : null;
    const step = (from, sign) => exeFind(ops, from, 40, (d, o) => d.mn === 'addi' && Math.sign(d.imm) === sign && d.imm !== 0 &&
      ops[ops.indexOf(o) - 1] && ops[ops.indexOf(o) - 1].d && ops[ops.indexOf(o) - 1].d.mn === 'lbz' && ops[ops.indexOf(o) - 1].d.d === hb);
    const ps = death >= 0 && hb !== null ? step(death, -1) : -1;
    const gs = ps >= 0 ? step(ps + 1, 1) : -1;
    r.poisonStep = ps >= 0 ? val(ps, -ops[ps].d.imm) : null;
    r.regenStep = gs >= 0 ? val(gs, ops[gs].d.imm) : null;
  }
  if (r.hourShift) r.unitsPerHour = { v: 1 << r.hourShift.v, exe: r.hourShift.exe };
  // The model's parameters, when everything it needs was read.
  const need = [r.unitsPerHour, r.levelShift, r.levelCap, r.hungerIndex, r.poisonIndex, r.fall, r.deathAt, r.poisonStep, r.regenStep];
  r.model = need.every(Boolean) ? { unitsPerHour: r.unitsPerHour.v, periods, levelShift: r.levelShift.v, levelCap: r.levelCap.v,
    hungerIndex: r.hungerIndex.v, poisonIndex: r.poisonIndex.v, fall: r.fall.v, deathAt: r.deathAt.v,
    poisonStep: r.poisonStep.v, regenStep: r.regenStep.v } : null;
  return r;
}
// A period of the table as a length of game time, in words.
function exeClockWords(units, perHour) {
  if (!perHour) return units + ' units';
  const min = units * 60 / perHour;
  if (Math.abs(min - 60) < 0.01) return 'an hour';
  if (min > 60 && Math.abs(min % 60) < 0.01) return (min / 60) + ' hours';
  if (min >= 1) { const m = Math.round(min); return (Math.abs(min - m) < 0.02 ? m : min.toFixed(1)) + ' minutes'; }
  return Math.round(min * 60) + ' seconds';
}

/* THE TALK BALLOON, off TBark: SetBark returns what TickCount answered plus
   a constant, the expiry ShowBarks tests each frame, and the constructor
   hands SetRect the balloon's width and height. */
/* THE SKY OF THE HOUR (23 September 2026). TStatusWindow::ChangeOutdoor
   draws a zone's landscape strip over DrawSky's sky when the strip was named
   with a positive number, and over a black fill when negative. DrawSky:

   - BackColor with an old QuickDraw colour constant (cyanColor, 273), then
     FillRect of the strip with one of QuickDraw's standard patterns chosen
     by the hour from a 24-entry table it builds once: the pattern's set bits
     are the foreground, black, and its clear bits that cyan. The patterns
     are fields of the QuickDraw globals (dkGray 162, ltGray 170, gray 178,
     black 186, white 194, Inside Macintosh's QDGlobals), so night is solid
     black, the day solid cyan, and the hours round sunrise and sunset
     dithered between. Sunrise and sunset are two words in the data section,
     in the game clock's units (4,096 an hour, srawi 12).
   - The sun, a 32-pixel tile, and then each "moon" CalcLocations places,
     each a tile, CopyBits'd transparent at x = gXPos(quarter hour) and
     y = 16 - height[quarter], clipped to the strip. CalcLocations turns the
     day and the quarter into a moon's quarter-hour position and phase from
     four small tables (speed, offset, phases, first tile).

   Everything below is read off those three routines by the shape of the
   instructions, so a program edited elsewhere draws its own sky. */
const QD_PATTERN_FIELDS = { 162: 'dkGray', 170: 'ltGray', 178: 'gray', 186: 'black', 194: 'white' };
// QuickDraw's eight old-style colours (Inside Macintosh: Imaging With
// QuickDraw, "Color QuickDraw" constants), as RGB.
const QD_OLD_COLOURS = { 33: [0, 0, 0], 30: [255, 255, 255], 205: [255, 0, 0], 341: [0, 255, 0],
                         409: [0, 0, 255], 273: [0, 255, 255], 137: [255, 0, 255], 69: [255, 255, 0] };
// The standard patterns' eight rows, set bit = foreground (Inside Macintosh).
const QD_PATTERNS = { white: [0,0,0,0,0,0,0,0], black: [255,255,255,255,255,255,255,255],
                      gray: [0xAA,0x55,0xAA,0x55,0xAA,0x55,0xAA,0x55], ltGray: [0x88,0x22,0x88,0x22,0x88,0x22,0x88,0x22],
                      dkGray: [0x77,0xDD,0x77,0xDD,0x77,0xDD,0x77,0xDD] };
let _skyRules = { app: undefined, r: null };
function exeSkyRules() {
  const app = window.APP_PEF || (typeof appPef === 'function' ? appPef() : null);
  if (_skyRules.app === app) return _skyRules.r;
  let r = null;
  try { r = readSkyRules(); } catch (e) { quiet(e, 'the sky rules'); }
  _skyRules = { app, r };
  return r;
}
function readSkyRules() {
  const ds = exeOpsNamed('DrawSky'), cl = exeOpsNamed('CalcLocations'), gx = exeOpsNamed('gXPos');
  if (!ds.length || !cl.length || !gx.length) return null;
  const s16 = w => (w << 16) >> 16;
  // A halfword or a word at an offset from the TOC, where the data tables are.
  const tocH = off => { const a = exeTocOffset(off); const w = a === null ? null : exeDataWords(a & ~3, 1); return w ? (a & 2 ? s16(w[0]) : w[0] >> 16) : null; };
  const tocW = off => { const a = exeTocOffset(off); const w = a === null ? null : exeDataWords(a, 1); return w ? (w[0] | 0) : null; };
  const out = {};
  // The background colour, the first BackColor's constant.
  const bc = ds.findIndex(o => exeCalls(o, 'BackColor'));
  const bl = bc >= 0 ? exeFindBack(ds, bc, 16, d => d.mn === 'li' && d.rd === 3) : -1;
  if (bl < 0) return null;
  out.back = exeVal(ds[bl], ds[bl].d.imm);
  // The hour table: a walk of the straight code up to the FillRect, tracking
  // what each register holds -- a data word's address, a sunrise or sunset
  // time and an offset from it, or a pattern field.
  const fill = ds.findIndex(o => exeCalls(o, 'FillRect'));
  const reg = {}, cmps = [], loopPats = [], sets = [];
  let qdReg = null, hourShift = null, quarterShift = null;
  for (let i = 0; i < fill; i++) {
    const o = ds[i], d = o.d;
    if (!d) continue;
    if (d.mn === 'lwz' && d.ra === 2) { reg[d.rt] = { tocSlot: d.d }; continue; }
    if (d.mn === 'addi' && d.ra === 2) { reg[d.rd] = { toc: d.imm, op: o }; continue; }
    if (d.mn === 'lwz' && d.d === 0 && reg[d.ra] && reg[d.ra].toc !== undefined) { reg[d.rt] = { time: reg[d.ra], delta: 0 }; continue; }
    if (d.mn === 'addi' && reg[d.ra] && reg[d.ra].time) { reg[d.rd] = { time: reg[d.ra].time, delta: d.imm, op: o }; continue; }
    if (d.mn === 'addi' && reg[d.ra] && reg[d.ra].tocSlot !== undefined) { qdReg = d.ra; reg[d.rd] = { pat: d.imm, op: o }; continue; }
    if (d.mn === 'srawi' && reg[d.rs] && reg[d.rs].time) { hourShift = hourShift || exeVal(o, d.sh); reg[d.ra] = reg[d.rs]; continue; }
    if (d.mn === 'srawi' && d.ra === d.rs && d.sh === 10 && quarterShift === null) { quarterShift = exeVal(o, d.sh); reg[d.ra] = {}; continue; }
    if (d.mn === 'cmpw' && reg[d.rb] && reg[d.rb].time) { cmps.push(reg[d.rb]); continue; }
    if (d.mn === 'stwx' && d.rb === 0) {
      const v = reg[d.rt];
      if (v && v.pat !== undefined) (reg[0] && reg[0].time ? sets.push({ at: reg[0], pat: v }) : loopPats.push(v));
      continue;
    }
    if (d.mn === 'slwi' && reg[d.rs] && reg[d.rs].time) { reg[d.ra] = reg[d.rs]; continue; }
    // Anything else that writes a register leaves it holding nothing known.
    if (/^(cmp|st|b)/.test(d.mn)) continue;
    const dest = /^l[bhw]/.test(d.mn) ? d.rt : d.rd !== undefined ? d.rd : d.rs !== undefined ? d.ra : undefined;
    if (dest !== undefined) reg[dest] = {};
  }
  if (cmps.length < 2 || loopPats.length < 3 || !hourShift || !sets.length) return null;
  // Sunrise and sunset: the two data words the compares and the fixed hours
  // are counted from.
  out.times = {};
  for (const x of [...cmps, ...sets.map(z => z.at)]) out.times[x.time.toc] = out.times[x.time.toc] || exeVal(x.time.op, tocW(x.time.toc));
  const tv = Object.values(out.times).sort((a, b) => a.v - b.v);
  if (tv.length !== 2 || tv.some(t => t.v === null)) return null;
  out.sunrise = tv[0]; out.sunset = tv[1];
  const unit = 1 << hourShift.v;
  out.hourUnit = hourShift;
  // Hours before the first compare's hour and after the second's take the
  // loop's first and second pattern; the rest its third; then the fixed
  // hours round sunrise and sunset are overwritten.
  const hourOf = at => Math.floor((out.times[at.time.toc].v + at.delta) / unit);
  const pats = new Array(24);
  const before = hourOf(cmps[0]), after = hourOf(cmps[1]);
  for (let h = 0; h < 24; h++) pats[h] = h < before ? loopPats[0] : h > after ? loopPats[1] : loopPats[2];
  for (const st of sets) { const h = hourOf(st.at); if (h >= 0 && h < 24) pats[h] = st.pat; }
  out.hours = pats.map(p => ({ field: p.pat, name: QD_PATTERN_FIELDS[p.pat] || null, op: p.op }));
  if (out.hours.some(h => !h.name)) return null;
  out.quarterShift = quarterShift;
  // The sun: a tile address built as (hi << 16) + lo from the tile images.
  const sunHi = ds.findIndex((o, i) => i > fill && o.d && o.d.mn === 'addis' && o.d.ra === o.d.rd);
  const sunLo = sunHi >= 0 ? exeFind(ds, sunHi + 1, 2, d => d.mn === 'addi') : -1;
  if (sunLo < 0) return null;
  out.sunTile = exeVal(ds[sunHi], ((ds[sunHi].d.imm << 16) + ds[sunLo].d.imm) >> 10);
  // The height table, indexed by the quarter hour: the halfword table the
  // placement reads with lhax after gXPos.
  const firstX = ds.findIndex(o => exeCalls(o, 'gXPos'));
  const lh = exeFind(ds, firstX + 1, 4, d => d.mn === 'lhax');
  const hReg = lh >= 0 ? ds[lh].d.ra : null;
  const hAddr = ds.find(o => o.d && o.d.mn === 'addi' && o.d.ra === 2 && o.d.rd === hReg);
  // A day of quarter hours, from CalcLocations' modulus.
  const mq = cl.find(o => o.d && o.d.mn === 'mulli' && o.d.imm > 24);
  if (!hAddr || !mq) return null;
  out.quarters = exeVal(mq, mq.d.imm);
  out.heights = { exe: hAddr.at, v: Array.from({ length: mq.d.imm }, (_, i) => tocH(hAddr.d.imm + 2 * i)), toc: hAddr.d.imm };
  // gXPos(q) = right - trunc((q + c) * scale / div), off its five constants.
  const g = (mn, test) => gx.find(o => o.d && o.d.mn === mn && (!test || test(o.d)));
  const gAdd = g('addi', d => d.imm < 0), gShl = g('slwi'), gMag = g('addi', d => d.imm !== gAdd.d.imm), gShr = g('srawi'), gRt = g('subfic');
  const gLis = g('lis');
  if (!gAdd || !gShl || !gMag || !gShr || !gRt || !gLis) return null;
  const magic = ((gLis.d.imm << 16) + gMag.d.imm) >>> 0;
  const divBy = Math.round(Math.pow(2, 32) / magic) * (1 << gShr.d.sh);
  out.xpos = { add: exeVal(gAdd, gAdd.d.imm), scale: exeVal(gShl, 1 << gShl.d.sh), div: exeVal(gShr, divBy), right: exeVal(gRt, gRt.d.imm) };
  // The moons: CalcLocations' count and four tables, and DrawSky's first
  // tiles, by the data addresses each routine takes.
  const tocAt = ops => ops.filter(o => o.d && o.d.mn === 'addi' && o.d.ra === 2).map(o => ({ op: o, off: o.d.imm }));
  const clT = tocAt(cl).sort((a, b) => a.off - b.off);
  if (clT.length < 6) return null;
  const [cnt, speed, offset, phases] = clT;
  const n = tocH(cnt.off);
  const tileT = tocAt(ds).find(t => t.off > phases.off && t.off < clT[4].off);
  if (!tileT || !(n > 0 && n <= 8)) return null;
  const add = cl.find(o => o.d && o.d.mn === 'addi' && o.d.ra !== 2 && o.d.imm > out.quarters.v);
  const half = cl.find(o => o.d && o.d.mn === 'addi' && o.d.ra !== 2 && o.d.imm === out.quarters.v / 2);
  out.moons = Array.from({ length: n }, (_, i) => ({
    speed: exeVal(speed.op, tocH(speed.off + 2 * i)), offset: exeVal(offset.op, tocH(offset.off + 2 * i)),
    phases: exeVal(phases.op, tocH(phases.off + 2 * i)), tile: exeVal(tileT.op, tocH(tileT.off + 2 * i)) }));
  out.moonCount = exeVal(cnt.op, n);
  out.moonBias = add ? exeVal(add, add.d.imm) : null;
  out.moonRound = half ? exeVal(half, half.d.imm) : null;
  if (!out.moonBias || !out.moonRound) return null;
  return out;
}
// What the strip's sky holds at a quarter hour of a day: the fill pattern,
// and the sun and moons as tiles at their places (CalcLocations, gXPos).
function skyScene(rules, day, quarter) {
  const Q = rules.quarters.v, q = ((quarter % Q) + Q) % Q;
  const x = p => rules.xpos.right.v - Math.trunc((p + rules.xpos.add.v) * rules.xpos.scale.v / rules.xpos.div.v);
  const y = p => 16 - rules.heights.v[p];
  const hour = q >> (rules.hourUnit.v - rules.quarterShift.v);
  const bodies = [{ tile: rules.sunTile.v, x: x(q), y: y(q), what: 'sun' }];
  const t = day * Q + q;
  for (const m of rules.moons) {
    let pos = (m.offset.v + Math.trunc(t * m.speed.v / Q) + rules.moonBias.v) % Q;
    const P = m.phases.v;
    let ph = Math.trunc((pos * P + rules.moonRound.v) / Q) % P;
    ph = (P - ph) % P;
    pos = (q + pos) % Q;
    bodies.push({ tile: m.tile.v + ph, x: x(pos), y: y(pos), what: 'moon' });
  }
  return { hour, pattern: rules.hours[hour], bodies };
}

function exeBarkRules() {
  const sb = exeOpsNamed('TBark::SetBark'), ct = exeOpsNamed('TBark::TBark');
  const r = {};
  const tc = sb.findIndex(o => exeCalls(o, 'TickCount'));
  const ai = tc >= 0 ? exeFind(sb, tc + 1, 3, d => d.mn === 'addi' && d.rd === 3 && d.ra === 3) : -1;
  r.ticks = ai >= 0 ? exeVal(sb[ai], sb[ai].d.imm) : null;
  const sr = ct.findIndex(o => exeCalls(o, 'SetRect'));
  const wi = sr >= 0 ? exeFindBack(ct, sr, 12, d => d.mn === 'li' && d.rd === 6) : -1;
  const hi = sr >= 0 ? exeFindBack(ct, sr, 12, d => d.mn === 'li' && d.rd === 7) : -1;
  r.width = wi >= 0 ? exeVal(ct[wi], ct[wi].d.imm) : null;
  r.height = hi >= 0 ? exeVal(ct[hi], ct[hi].d.imm) : null;
  return r.ticks || r.width ? r : null;
}

/* WHERE THE HERO'S PORTRAIT COMES FROM. The scenario's 0x8800 is never
   seen in play. CreatePlayer takes the dialog's pick as a slot number --
   TCreatePlayerDialog::GetPortrait answers 240 plus six a column plus the
   row, off the left and top of the picker list's visible rect (the ListRec's
   shorts at 22 and 20; exePortraitsOffered below) -- reads the resource that many
   past 0x87FF (addis 4, 27, 1 then addi 4, 4, -30721) and writes its bytes
   into the player file as 0x8800 (lis 4, 1 then addi 4, 4, -30720). So a
   saved game's 0x8800 is one of the shipped 0x88EF.. byte for byte, which
   the cheater save bears out: its portrait is 0x88F0. Read here by the
   shape of the instructions; the maintainer asked how the chosen portrait
   reaches the hero, 18 September 2026. */
function exePortraitChoice() {
  const gp = exeOpsNamed('TCreatePlayerDialog::GetPortrait'), cp = exeOpsNamed('CreatePlayer');
  const mi = gp.findIndex(o => o.d && o.d.mn === 'mulli' && o.d.rd === 4);
  const fi = mi >= 0 ? exeFind(gp, mi + 1, 4, d => d.mn === 'addi' && d.rd === 3 && d.ra === 4) : -1;
  const hi = cp.findIndex(o => o.d && o.d.mn === 'addis' && o.d.rd === 4 && o.d.imm === 1);
  const bi = hi >= 0 ? exeFind(cp, hi + 1, 2, d => d.mn === 'addi' && d.rd === 4 && d.ra === 4) : -1;
  const li = cp.findIndex(o => o.d && o.d.mn === 'lis' && o.d.rd === 4 && o.d.imm === 1);
  const di = li >= 0 ? exeFind(cp, li + 1, 6, d => d.mn === 'addi' && d.rd === 4 && d.ra === 4) : -1;
  if (mi < 0 || fi < 0 || bi < 0 || di < 0) return null;
  return { perRow: exeVal(gp[mi], gp[mi].d.imm), first: exeVal(gp[fi], gp[fi].d.imm),
           base: exeVal(cp[bi], (0x10000 + cp[bi].d.imm) & 0xFFFF),
           writes: exeVal(cp[di], (0x10000 + cp[di].d.imm) & 0xFFFF),
           offered: exePortraitsOffered() };
}
/* HOW MANY PORTRAITS THE DIALOG OFFERS. The picker is a List Manager list,
   TPortraitList, and the dialog's constructor builds its data bounds on the
   stack just before calling that class's constructor with them in r5: a
   rect whose top and left are copied from a constant beside the TOC and
   whose bottom and right are then stored from two `li`s, 3 and 2. So the
   list has three rows and two columns, six cells. TPortraitList::LDEFDraw
   draws a cell as the resource 0x88EF plus six times its column (the
   Point's h, `mulli 0, 0, 6`) plus its row, the stride GetPortrait uses too.
   With three rows a column shows three of each six, so 0x88F2 to 0x88F4 and
   0x88F8 to 0x88FA, the six copies of one blank face, are never drawn: the
   maintainer's reading of the card, 1 October 2026, checked here. Null
   where the shape is not found. */
function exePortraitsOffered() {
  const ct = exeOpsNamed('TCreatePlayerDialog::TCreatePlayerDialog');
  const call = ct.findIndex(o => exeCalls(o, 'TPortraitList::TPortraitList'));
  const rect = call >= 0 ? exeFindBack(ct, call - 1, 12, d => d.mn === 'addi' && d.rd === 5 && d.ra === 1) : -1;
  if (rect < 0) return null;
  const at = ct[rect].d.imm;
  // A short of the rect: the `sth` that writes it, and the `li` it stores.
  const half = off => {
    const s = exeFindBack(ct, call - 1, 48, d => d.mn === 'sth' && d.ra === 1 && d.d === at + off);
    const l = s >= 0 ? exeFindBack(ct, s - 1, 16, d => d.mn === 'li' && d.rd === ct[s].d.rt) : -1;
    return l >= 0 ? exeVal(ct[l], ct[l].d.imm) : null;
  };
  // Top and left: the first word of the constant the rect is copied from.
  const src = exeFindBack(ct, call - 1, 48, d => d.mn === 'stw' && d.ra === 1 && d.d === at);
  const ld = src >= 0 ? exeFindBack(ct, src - 1, 8, d => d.mn === 'lwz' && d.rt === ct[src].d.rt && d.d === 0) : -1;
  const base = ld >= 0 ? exeFindBack(ct, ld - 1, 8, d => d.mn === 'addi' && d.rd === ct[ld].d.ra && d.ra === 2) : -1;
  const word = base >= 0 ? exeDataWords(exeTocOffset(ct[base].d.imm), 1) : null;
  const bottom = half(4), right = half(6);
  const dr = exeOpsNamed('TPortraitList::LDEFDraw');
  const mul = dr.findIndex(o => o.d && o.d.mn === 'mulli');
  if (!word || !bottom || !right || mul < 0) return null;
  const rows = bottom.v - (word[0] >> 16), cols = right.v - (word[0] << 16 >> 16);
  if (!(rows > 0 && cols > 0)) return null;
  return { rows, cols, count: { v: rows * cols, exe: bottom.exe }, stride: exeVal(dr[mul], dr[mul].d.imm) };
}

/* WHAT A COMMAND COSTS IN TIME. TGameSys::HeartBeat(n) is how a command
   spends the player's time, so every call of it with a constant in r4 is a
   cost, named by the routine that makes the call. A call whose r4 is worked
   out (an attack's, the slide's) has no one number and says so. */
function exeActionCosts() {
  return exeCallersOf('TGameSys::HeartBeat').map(c => {
    const k = exeFindBack(c.ops, c.i - 1, 3, d => d.rd === 4 || d.ra === 4);
    const d = k >= 0 ? c.ops[k].d : null;
    return { routine: c.routine, call: exeVal(c.ops[c.i], null), cost: d && d.mn === 'li' && d.rd === 4 ? exeVal(c.ops[k], d.imm) : null };
  });
}

/* WHO IS WHOSE ENEMY. TActiveMonster::GetEnemyStatus copies a table of
   words from the TOC onto the stack and answers the entry for one side's
   alignment byte times four plus the other's; a byte it tests first answers
   a constant for every pair when set (option-h). */
function exeEnemyTable() {
  const ops = exeOpsNamed('TActiveMonster::GetEnemyStatus');
  const ti = exeFind(ops, 0, 4, d => d.mn === 'addi' && d.ra === 2);
  if (ti < 0) return null;
  const reg = ops[ti].d.rd;
  const words = ops.filter(o => o.d && o.d.mn === 'lwz' && o.d.ra === reg).length;
  const table = exeDataWords(exeTocOffset(ops[ti].d.imm), words);
  const side = Math.round(Math.sqrt(words));
  if (!table || side * side !== words) return null;
  const ab = exeFind(ops, ti, 80, d => d.mn === 'lbz' && d.d > 0 && d.ra !== 5);
  const peace = exeFind(ops, ti, 60, d => d.mn === 'li' && d.rd === 3);
  // The byte tested first is a TOC slot; the key routine flips it with a
  // logical not (cntlzw, then the shift by 5).
  const slot = exeFind(ops, ti, 4, d => d.mn === 'lwz' && d.ra === 2);
  const keys = slot >= 0 ? exeOpsNamed('TMapWindow::KeyRoutine') : [];
  const load = keys.findIndex(o => o.d && o.d.mn === 'lwz' && o.d.ra === 2 && o.d.d === ops[slot].d.d);
  const flip = load >= 0 ? exeFind(keys, load, 5, d => d.mn === 'cntlzw') : -1;
  // The answer the enemy iterator keeps: cbEnemies compares r3 with it
  // straight after the call.
  const cb = exeOpsNamed('cbEnemies');
  const call = cb.findIndex(o => exeCalls(o, 'TActiveMonster::GetEnemyStatus'));
  const test = call >= 0 ? exeFind(cb, call + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3) : -1;
  return { table: exeVal(ops[ti], table), side, alignmentByte: ab >= 0 ? exeVal(ops[ab], ops[ab].d.d) : null,
           peace: peace >= 0 ? exeVal(ops[peace], ops[peace].d.imm) : null, peaceKey: flip >= 0 ? exeVal(keys[flip], 'KeyRoutine') : null,
           enemy: test >= 0 ? exeVal(cb[test], cb[test].d.imm) : null };
}

/* WHERE A FLAG LIVES. TSpellFX::AddAbility sets a character flag by its
   number: below one bound a bit of one record byte, below the next a bit of
   the status word, below the last a bit of another byte, the range's first
   flag taken off the number to make the bit. So a status bit the tick
   routine tests is a flag number the scripts use: the bit plus that range's
   subtrahend. */
function exeAbilityMap() {
  const ops = exeOpsNamed('TSpellFX::AddAbility');
  const out = [];
  for (let i = 0; i < ops.length; i++) {
    const d = ops[i].d;
    if (!d || d.mn !== 'cmpwi') continue;
    const load = exeFind(ops, i + 1, 10, e => e.mn === 'lbzx' || e.mn === 'lhzx');
    if (load < 0) continue;
    const off = exeFind(ops, i + 1, load - i, e => e.mn === 'addi' && e.imm > 0 && e.ra !== 1 && e.ra !== 2);
    const sub = exeFind(ops, i + 1, load - i, e => e.mn === 'addi' && e.imm < 0);
    out.push({ below: exeVal(ops[i], d.imm), offset: off >= 0 ? exeVal(ops[off], ops[off].d.imm) : null,
               sub: sub >= 0 ? exeVal(ops[sub], -ops[sub].d.imm) : exeVal(ops[i], 0), word: ops[load].mn === 'lhzx' });
  }
  return out;
}
/* ---- the egg dispatch, read off the program ------------------------------
   TGameViewer::DrawRoutine walks a zone's eggs and dispatches each kind
   through an eleven-entry table of code addresses beside the TOC. The
   table's displacement is read off the `addi r, r2, d` whose register an
   `lwzx` then indexes, and its length off the `cmplwi` bound that guards the
   index, so nothing here names a displacement or a count. Each entry is a
   handler inside DrawRoutine; what it calls is the `bl`s between its start
   and the next handler's, by the traceback names. The words for each kind
   (EGG_KIND_NAMES) remain this page's; the addresses and the calls are the
   file's. Null with no application open, or when the shape is not found. */
// A jump table in a routine: an `addi r, r2, d` whose register an `lwzx`
// indexes within a few instructions and a `bctr` then jumps through, with
// the `cmplwi` just above it as the bound. Null when the routine has none.
/* WHAT AN ALIGNMENT IS CALLED (23 September 2026). A character's byte 25
   is its alignment: the unit constructor fills it from 0xF008 byte 6
   (exeMonsterStatCopy) and GetEnemyStatus looks it up in the enemy table.
   The game names the values in one place, the combat AI: its base groups
   are STR# 9301, which the resource fork itself calls "Groups" -- good,
   evil, neutral, feral, then ally, enemy, bystander, everybody -- and
   SCombatAIEntry::CalculateObject switches on the group's token through a
   jump table, where tokens 1 to 4 each load byte 25 and compare it with a
   constant. So a value is named by the group whose case compares with it:
   2 good, 1 evil, 0 neutral, 3 feral, read here rather than written down.
   (gandreas's monster list calls the same four Good, Chaotic, Neutral and
   Wild, which agrees.) Null without the application. */
function exeAlignmentNames() {
  if (!appImage() || !window.APP_RSRC) return null;
  if (DERIVED.ALIGN_NAMES !== undefined) return DERIVED.ALIGN_NAMES;
  let out = null;
  try {
    const f = window.APP_RSRC;
    const e = (f.resourcesByType['STR#'] || []).find(x => x.name === 'Groups');
    const words = e ? decodeSTRList(f.dataOf('STR#', e)) : null;
    const r = exeRoutineNamed('SCombatAIEntry::CalculateObject');
    const ops = exeOpsOf(r);
    const jt = words && ops.length ? exeJumpTable(ops) : null;
    if (jt) {
      const img = appImage(), off = exeTocOffset(ops[jt.at].d.imm);
      const byValue = {};
      for (let tok = 1; tok <= 4; tok++) {
        const p = pefPointerAt(img, img.toc.section, off + 4 * tok);
        if (!p || p.section !== img.codeIndex) continue;
        const body = exeOpsOf({ offset: p.offset, length: 40, name: 'group ' + tok });
        const li = body.findIndex(o => o.d && o.d.mn === 'lbz' && o.d.d === 25);
        const ci = li >= 0 ? exeFind(body, li + 1, 3, d => d.mn === 'cmplwi' || d.mn === 'cmpwi') : -1;
        if (ci < 0) continue;
        byValue[body[ci].d.imm] = { name: words[tok - 1], at: exeVal(body[ci], body[ci].d.imm) };
      }
      if (Object.keys(byValue).length === 4) out = { byValue, strings: e.id };
    }
  } catch (err) { quiet(err); }
  return (DERIVED.ALIGN_NAMES = out);
}
// The name in brackets after the number, " (evil)", a link to the
// comparison that names it; or nothing without the application. The unit
// page put the name first, "evil 1", until the maintainer asked for
// "1 (evil)", 1 October 2026.
function alignmentNameHTML(v) {
  const an = exeAlignmentNames(), hit = an && an.byValue[v];
  return hit ? ' (' + srcNum(hit.at, hit.name) + ')' : '';
}
// "neutral (0)", a link to the comparison that names it, or the bare number.
function alignmentHTML(v, src) {
  const an = exeAlignmentNames(), hit = an && an.byValue[v];
  return hit ? srcNum(hit.at, hit.name) + ' <span class="inspDim">(' + (src ? srcNum(src, String(v)) : v) + ')</span>'
             : (src ? srcNum(src, String(v)) : String(v));
}
/* Which combat-AI tests read a single bit of a character's byte 8, by the
   program (24 September 2026): SCombatAIEntry::EvaluateCondition switches on
   a test's token through a table beside the TOC, token = position in STR#
   9304 plus one; a case that loads byte 8 and masks one bit is that bit's
   test, and its name is the list's entry without the argument list. What
   dvmBitFlagName says. Null without the application. */
function exeAiBitTests() {
  if (!appImage() || !window.APP_RSRC) return null;
  try {
    const f = window.APP_RSRC, e = (f.resourcesByType['STR#'] || []).find(x => x.name === 'Tests');
    const words = e ? decodeSTRList(f.dataOf('STR#', e)) : null;
    const ops = exeOpsNamed('SCombatAIEntry::EvaluateCondition');
    const jt = words && ops.length ? exeJumpTable(ops) : null;
    if (!jt) return null;
    const img = appImage(), off = exeTocOffset(ops[jt.at].d.imm), out = {};
    for (let tok = 1; tok <= words.length; tok++) {
      const p = pefPointerAt(img, img.toc.section, off + 4 * tok);
      if (!p || p.section !== img.codeIndex) continue;
      const body = exeOpsOf({ offset: p.offset, length: 48, name: 'test ' + tok });
      const li = body.findIndex(o => o.d && o.d.mn === 'lbz' && o.d.d === 8);
      const ri = li >= 0 ? exeFind(body, li + 1, 3, d => d.mn === 'rlwinm' || d.mn === 'rlwinm.') : -1;
      if (ri < 0) continue;
      const d = body[ri].d;
      if (d.mb !== d.me || d.sh !== 0) continue;
      out[31 - d.mb] = { name: String(words[tok - 1]).replace(/\(.*$/, ''), at: exeVal(body[ri], 31 - d.mb) };
    }
    return Object.keys(out).length ? out : null;
  } catch (err) { quiet(err); return null; }
}
/* THE PROGRAM'S NAMES, read out of the application whenever it is open
   (24 September 2026, the maintainer: the program's own words are to be
   derived from the files, which the page has through the installer, not
   kept as a copy). One object per application, rebuilt when a different one
   is adopted:
     syscalls  op to the handler's name, off TInterp::DoExpr's table
               (exeSyscallTable): cbnearby, cbAddAbility;
     flags     character flag to its word in the STR# titled ObjectFlags,
               the bits of the halfword the combat AI's TestFlag reads, placed
               by the range TSpellFX::AddAbility keeps in that halfword
               (exeAbilityMap) -- and only when the two read the same halfword;
     bits      a bit of byte 8 to the AI test that reads it alone
               (exeAiBitTests): InParty, BeenMet.
   The delv tier asks through dvmProgramNames; each part is null when its
   reading fails, and the names then fall back to delvmod's or to numbers. */
let _programNames = { data: null, rsrc: null, v: null };
function programNames() {
  const data = window.APP_DATA, rsrc = window.APP_RSRC;
  if (!data || !rsrc) return null;
  if (_programNames.data === data && _programNames.rsrc === rsrc) return _programNames.v;
  _programNames = { data, rsrc, v: null };
  const v = { syscalls: null, flags: null, bits: null };
  try {
    const st = exeSyscallTable();
    if (st) { v.syscalls = new Map(); for (const x of st.entries) if (x.name) v.syscalls.set(x.op, x.name); }
  } catch (err) { quiet(err, 'reading the syscall handlers\u2019 names'); }
  try {
    const e = (rsrc.resourcesByType['STR#'] || []).find(x => x.name === 'ObjectFlags');
    const words = e ? decodeSTRList(rsrc.dataOf('STR#', e)) : null;
    const half = (exeAbilityMap() || []).find(m => m.word);
    const tf = exeAiFlagHalfword();
    if (words && half && half.offset && tf !== null && half.offset.v === tf) {
      v.flags = {};
      words.forEach((w, i) => { const f = half.sub.v + i; if (w && f < half.below.v) v.flags[f] = w; });
    }
  } catch (err) { quiet(err, 'reading the flag names'); }
  try {
    const b = exeAiBitTests();
    if (b) { v.bits = {}; for (const [bit, x] of Object.entries(b)) v.bits[bit] = x.name; }
  } catch (err) { quiet(err, 'reading the AI\u2019s bit tests'); }
  _programNames.v = v;
  return v;
}
/* The halfword of a character's record the combat AI's TestFlag reads: the
   case of SCombatAIEntry::EvaluateCondition for the token whose entry in
   the AI's list of tests begins "TestFlag", its first halfword load. Null
   without the application or when the shape is not found. */
function exeAiFlagHalfword() {
  if (!appImage() || !window.APP_RSRC) return null;
  const f = window.APP_RSRC, e = (f.resourcesByType['STR#'] || []).find(x => x.name === 'Tests');
  const words = e ? decodeSTRList(f.dataOf('STR#', e)) : null;
  const k = words ? words.findIndex(w => /^TestFlag\b/.test(String(w))) : -1;
  const ops = exeOpsNamed('SCombatAIEntry::EvaluateCondition');
  const jt = k >= 0 && ops.length ? exeJumpTable(ops) : null;
  if (!jt) return null;
  const img = appImage(), p = pefPointerAt(img, img.toc.section, exeTocOffset(ops[jt.at].d.imm) + 4 * (k + 1));
  if (!p || p.section !== img.codeIndex) return null;
  const body = exeOpsOf({ offset: p.offset, length: 120, name: 'TestFlag' });
  const lh = body.find(o => o.d && o.d.mn === 'lhz' && o.d.d > 0);
  return lh ? lh.d.d : null;
}
function exeJumpTable(ops, from) {
  for (let i = from || 0; i < ops.length; i++) {
    const d = ops[i].d;
    if (!d || d.mn !== 'addi' || d.ra !== 2) continue;
    const lw = exeFind(ops, i + 1, 4, e => e.mn === 'lwzx' && (e.ra === d.rd || e.rb === d.rd));
    if (lw < 0) continue;
    const bc = exeFind(ops, lw + 1, 4, e => e.mn === 'bctr');
    if (bc < 0) continue;
    const bi = exeFindBack(ops, i, 8, e => e.mn === 'cmplwi' || e.mn === 'cmpwi');
    return { at: i, bound: bi };
  }
  return null;
}
function exeEggHandlers() {
  const img = appImage();
  if (!img) return null;
  const ops = exeOpsNamed('TGameViewer::DrawRoutine');
  if (!ops.length) return null;
  const jt = exeJumpTable(ops);
  if (!jt) return null;
  const ti = jt.at, bi = jt.bound;
  const count = bi >= 0 ? ops[bi].d.imm + 1 : 11;
  const off = exeTocOffset(ops[ti].d.imm);
  if (off === null) return null;
  const starts = [];
  for (let i = 0; i < count; i++) {
    let p = null;
    try { p = pefPointerAt(img, img.toc.section, off + 4 * i); } catch (e) { p = null; }
    starts.push(p && p.section === img.codeIndex ? p.offset : null);
  }
  const ends = [...new Set(starts.filter(s => s !== null))].sort((a, b) => a - b);
  // The loop's end is where the bound's branch goes when the kind is out of
  // range; a handler that IS the loop's end does nothing, and no handler
  // runs past it.
  const guard = bi >= 0 && ops[bi + 1] && ops[bi + 1].to !== null && ops[bi + 1].to !== undefined ? ops[bi + 1].to : null;
  const last = guard !== null ? guard : ops[ops.length - 1].at + 4;
  const handlers = starts.map((at, kind) => {
    if (at === null) return { kind, at: null, calls: [] };
    if (guard !== null && at >= guard) return { kind, at, calls: [], nothing: true };
    const next = Math.min(ends.find(e => e > at) || last, last);
    const calls = [];
    for (const o of ops) {
      if (o.at < at || o.at >= next || !o.d || o.d.mn !== 'bl' || o.to === null) continue;
      const nm = exeTargetName(o.to).replace(/\(.*$/, '');
      if (nm && !calls.some(c => c.name === nm)) calls.push({ name: nm, at: o.at });
    }
    return { kind, at, calls };
  });
  return { table: exeVal(ops[ti], ops[ti].d.imm), count: bi >= 0 ? exeVal(ops[bi], count) : null, handlers };
}

/* ---- the palette ramps, read off the program ------------------------------
   TViewer::BuildFilters fills eight remap tables, one per phase: for every
   index n it compares n against three bounds in turn and, between the first
   two, keeps the low bits of n minus the phase under the high bits of n --
   which is a ramp of 2^k colours walked backwards. The bounds are the
   `cmpwi` immediates in that loop and the ramp width is the `clrlwi` that
   keeps k bits, both read here; the identity outside the bounds is the
   fall-through. The renderer's own constant, PALETTE_CYCLES, is compared
   against what is read, so a program whose ramps differ says so. Null with
   no application open, or when the loop is not found. */
function exePaletteRamps() {
  const ops = exeOpsNamed('TViewer::BuildFilters');
  if (!ops.length) return null;
  // The phase loop: eight tables (cmpwi 8 with the counter), and inside it
  // the index loop to 256.
  // The index loop is the last one that runs to 256; the lighting ramps
  // earlier in the routine compare against 0xE0 and 0xFF too and are not
  // the animation. Its body runs from the loop's last entry, the `cmpwi 8`
  // of the table loop before it, to that `cmpwi 256`.
  let end = -1;
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].d && ops[i].d.mn === 'cmpwi' && ops[i].d.imm === 256) { end = i; break; }
  if (end < 0) return null;
  const startTables = exeFindBack(ops, end, 120, d => d.mn === 'cmpwi' && d.imm === 8);
  const start = startTables >= 0 ? startTables : Math.max(0, end - 80);
  // Each `cmpwi n, bound` guards a block for the indices BELOW the bound
  // and above the previous one; a clrlwi in the block is the ramp's width
  // in bits, and a block without one leaves the index alone.
  const bands = [];
  for (let i = start; i < end; i++) {
    const d = ops[i].d;
    if (!d || d.mn !== 'cmpwi' || d.imm < 0x80 || d.imm > 0xFF) continue;
    const nextBound = exeFind(ops, i + 1, end - i, e => e.mn === 'cmpwi' && e.imm >= 0x80);
    const stop = nextBound < 0 ? end : nextBound;
    const clr = exeFind(ops, i + 1, stop - i, e => e.mn === 'clrlwi');
    bands.push({ bound: exeVal(ops[i], d.imm), bits: clr >= 0 ? exeVal(ops[clr], 32 - ops[clr].d.mb) : null });
  }
  if (bands.length < 2) return null;
  const ramps = [];
  for (let i = 0; i < bands.length; i++) {
    const b = bands[i], from = i ? bands[i - 1].bound.v : 0;
    if (!b.bits) continue;
    const len = 1 << b.bits.v;
    for (let s = from; s + len <= b.bound.v; s += len) ramps.push({ start: s, len, bound: b.bound, bits: b.bits });
  }
  const phases = exeFind(ops, end, ops.length - end, d => d.mn === 'cmpwi' && d.imm === 8);
  const same = ramps.length === PALETTE_CYCLES.length && ramps.every((r, i) => r.start === PALETTE_CYCLES[i][0] && r.len === PALETTE_CYCLES[i][1]);
  return { bands, ramps, phases: phases >= 0 ? exeVal(ops[phases], 8) : null, agrees: same };
}

/* ---- the character record's fields, read off the program ------------------
   GetField(short, short, short) hands fields 19 to 40 of a Character to a
   jump table beside the TOC, one handler each, and every handler's first
   load through the record pointer says which byte or halfword of the
   32-byte record that field is. The table's displacement and its bound are
   read the way the egg table's are. The scripts' names for the fields are
   delvmod's (DVM_SYM.field), and a field the handler reads through a helper
   rather than a load is reported with no offset. Null with no application
   open. */
function exeCharacterFields() {
  const img = appImage();
  if (!img) return null;
  const r = exeRoutineNamed('GetField(short, short, short)');
  const ops = exeOpsOf(r);
  if (!ops.length) return null;
  const jt = exeJumpTable(ops);
  if (!jt) return null;
  const ti = jt.at, bound = jt.bound;
  const base = exeFindBack(ops, ti, 30, d => d.mn === 'addi' && d.imm < 0 && d.ra !== 1 && d.ra !== 2);
  const first = base >= 0 ? -ops[base].d.imm : 19;
  const count = bound >= 0 ? ops[bound].d.imm + 1 : 22;
  const off = exeTocOffset(ops[ti].d.imm);
  if (off === null) return null;
  const fields = [];
  for (let i = 0; i < count; i++) {
    let p = null;
    try { p = pefPointerAt(img, img.toc.section, off + 4 * i); } catch (e) { p = null; }
    const field = first + i;
    if (!p || p.section !== img.codeIndex) { fields.push({ field, at: null, offset: null, width: 0 }); continue; }
    const hops = exeOpsOf({ offset: p.offset, length: 48, name: 'field ' + field });
    const ld = hops.find(o => o.d && /^(lbz|lhz|lwz|lha)$/.test(o.d.mn) && o.d.ra === 31);
    fields.push({ field, at: p.offset, name: DVM_SYM.field[String(field)] || null,
                  offset: ld ? exeVal(ld, ld.d.d) : null, width: ld ? (ld.d.mn === 'lbz' ? 1 : ld.d.mn === 'lwz' ? 4 : 2) : 0 });
  }
  return { routine: r, first: base >= 0 ? exeVal(ops[base], first) : null, count: bound >= 0 ? exeVal(ops[bound], count) : null, fields };
}

/* ---- the monster-statistics record, off GetField's second table ----------
   `0xF008` is 128 records of 16 bytes, and what each byte means was a
   1999 field list with question marks on it. The application says so
   itself: `GetField` dispatches on the field a script asks for, and it
   has two jump tables -- the first for a character's record (19 to 40,
   exeCharacterFields above) and a second, further down the routine, for
   a unit's. Each handler loads one field out of the record at a fixed
   displacement, so the table is the map from the script's field number to
   the byte, read rather than asserted.

   The record's base comes from the same global `ObjToMonst` walks: the
   handle at TOC-30376, indexed by the record number times sixteen. That
   is also where the count of 128 and the stride of 16 come from, and
   `ObjToMonst` searching on the halfword at +12 is what makes that one
   the prop type.

   Null with no application open, and then the sheet says only what the
   record holds and not what the program does with it. */
function exeMonsterFields() {
  const img = appImage();
  if (!img) return null;
  const r = exeRoutineNamed('GetField(short, short, short)');
  const ops = exeOpsOf(r);
  if (!ops.length) return null;
  // The table is found by its record, not by its position: the one whose
  // base is the global `LoadGlobals` puts 0xF008 in and `ObjToMonst`
  // walks. GetField has several tables and counting them would break the
  // day another is added.
  const globals = exeOpsNamed('ObjToMonst').find(o => o.d && o.d.mn === 'lwz' && o.d.ra === 2);
  if (!globals) return null;
  const disp = globals.d.d;
  let jt = null, rec = -1;
  for (let from = 0; ; from = jt.at + 1) {
    jt = exeJumpTable(ops, from);
    if (!jt) return null;
    const ld = exeFindBack(ops, jt.at, 24, d => d.mn === 'lwz' && d.ra === 2 && d.d === disp);
    if (ld < 0) continue;
    // The record pointer is the base plus the index, so the `add` between
    // that load and the table names the register the handlers read from.
    const ad = exeFindBack(ops, jt.at, 12, d => d.mn === 'add');
    if (ad < 0) continue;
    const a = ops[ad].d;
    rec = a.rt !== undefined ? a.rt : a.rd !== undefined ? a.rd : a.rs;
    break;
  }
  const ti = jt.at, bound = jt.bound;
  // `addi 0, r, -44` just before the bound: the field the table starts at.
  const base = exeFindBack(ops, ti, 30, d => d.mn === 'addi' && d.imm < 0 && d.ra !== 1 && d.ra !== 2);
  const first = base >= 0 ? -ops[base].d.imm : 44;
  const count = bound >= 0 ? ops[bound].d.imm + 1 : 11;
  const off = exeTocOffset(ops[ti].d.imm);
  if (off === null) return null;
  const fields = [];
  for (let i = 0; i < count; i++) {
    let p = null;
    try { p = pefPointerAt(img, img.toc.section, off + 4 * i); } catch (e) { p = null; }
    const field = first + i;
    if (!p || p.section !== img.codeIndex) { fields.push({ field, at: null, offset: null, width: 0 }); continue; }
    const hops = exeOpsOf({ offset: p.offset, length: 48, name: 'field ' + field });
    // The load through the register the index was added into.
    const ld = hops.find(o => o.d && /^(lbz|lhz|lwz|lha)$/.test(o.d.mn) && o.d.ra === rec && o.d.d >= 0 && o.d.d < 16);
    // Two handlers load the same long, at 8, and keep half of it each:
    // `clrlwi 16` the low half (field 50, monster_flags) and `srawi 16` the
    // top half (field 51, 0x33, which delvmod never named). Read on
    // 28 September 2026; until then the page took both for the whole word
    // and called the top half unidentified, though three scripts test it.
    const li = ld ? hops.indexOf(ld) : -1;
    const cut = li >= 0 ? hops.slice(li + 1, li + 4).find(o => o.d && ((o.d.mn === 'clrlwi' && o.d.mb === 16) || (o.d.mn === 'srawi' && o.d.sh === 16))) : null;
    fields.push({ field, at: p.offset, name: DVM_SYM.field[String(field)] || null,
                  offset: ld ? exeVal(ld, ld.d.d) : null, width: ld ? (ld.d.mn === 'lbz' ? 1 : ld.d.mn === 'lwz' ? 4 : 2) : 0,
                  half: cut ? (cut.d.mn === 'clrlwi' ? 'low' : 'high') : null, halfAt: cut ? exeVal(cut, 16) : null });
  }
  // The table itself: where the records are, how many and how wide, off
  // the routine that searches them.
  const walk = exeOpsNamed('ObjToMonst');
  const cnt = walk.find(o => o.d && o.d.mn === 'cmpwi' && o.d.imm > 1);
  const step = walk.find(o => o.d && o.d.mn === 'addi' && o.d.imm === 16);
  const key = walk.find(o => o.d && (o.d.mn === 'lha' || o.d.mn === 'lhz') && o.d.d === 12);
  return { routine: r, first: base >= 0 ? exeVal(ops[base], first) : null, count: bound >= 0 ? exeVal(ops[bound], count) : null,
           fields, records: cnt ? exeVal(cnt, cnt.d.imm) : null, stride: step ? exeVal(step, 16) : null,
           keyOffset: key ? exeVal(key, 12) : null };
}

/* ---- which unit byte becomes which of a character's stats ----------------
   0xF008's first three bytes were labelled Body, Reflex, Mind by the delvmod
   wiki's field table, which then said it was not sure of the order, because
   gandreas's 1999 list does not line up with it: all forty-four of his
   entries print byte 1 as Body, byte 2 as Reflex and byte 0 as both Mind
   and Damage. The program settles it. `TActiveMonster::TActiveMonster(short)`
   builds the live character a unit is: for each stat it loads a byte of the
   0xF008 record, scales it by a percentage, and stores it into a byte of the
   character record -- byte 0 into 9, 1 into 10, 2 into 11, 5 (health) into
   14. GetField's first table says which field serves each of those bytes
   (exeCharacterFields), and delvmod's symbols name the fields: 9 is `body`,
   10 `reflex`, 11 `mind`. So the wiki's order was right and the list is
   shifted, and the unit page's names are read here rather than assumed.

   Found by shape: an `lbz` at 0 to 15 through the register the record
   pointer was loaded into (`lwz rX, 4(this)`), then the first `stb` after it
   before another record load. Null with no application open. */
function exeMonsterStatCopy() {
  if (!appImage()) return null;
  const ops = exeOpsNamed('TActiveMonster::TActiveMonster(short)');
  if (!ops.length) return null;
  const cf = exeCharacterFields();
  const out = {};
  for (let i = 0; i < ops.length; i++) {
    const d = ops[i].d;
    if (!d || d.mn !== 'lbz' || d.d < 0 || d.d > 15) continue;
    // The load's base was fetched as the second word of the object.
    const src = exeFindBack(ops, i - 1, 6, x => x.mn === 'lwz' && exeDestReg(x) === d.ra);
    if (src < 0 || ops[src].d.d !== 4) continue;
    const st = exeFind(ops, i + 1, 12, x => x.mn === 'stb' || x.mn === 'lbz');
    if (st < 0 || ops[st].d.mn !== 'stb' || out[d.d]) continue;
    const to = ops[st].d.d;
    const f = cf && cf.fields ? cf.fields.find(x => x.offset && x.offset.v === to) : null;
    out[d.d] = { from: exeVal(ops[i], d.d), to: exeVal(ops[st], to), field: f ? f.field : null, name: f ? f.name : null };
  }
  return Object.keys(out).length ? out : null;
}

/* ---- where every character flag is set, cleared and tested -----------------
   A character's flags are two things in the record: bits 0 to 7 in one
   byte and 8 up in a halfword and a further byte, which AddAbility maps
   (exeAbilityMap). The scripts reach them through four syscalls with the
   character first and the flag second -- SetFlag, ClearFlag, TestFlag and
   StatusEffect -- and through the three 0x0Fxx helpers that wrap the first
   three. Every site with a literal flag is counted here, by flag and by
   verb, with its offset, so the program's names (dvmFlagName) stand beside
   the sites. */
function characterFlagSites() {
  if (DERIVED.CHAR_FLAG_SITES) return DERIVED.CHAR_FLAG_SITES;
  const by = new Map();
  const VERB = { SetFlag: 'set', ClearFlag: 'clear', TestFlag: 'test', StatusEffect: 'effect' };
  const LIT = /^(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i;
  let unknown = 0;
  for (const e of buildScriptTextIndex()) {
    let ops; try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (let i = 0; i < ops.length; i++) {
      // The three flag helpers by id (their names were a session's, and went).
      const m = /^(?:sys (SetFlag|ClearFlag|TestFlag|StatusEffect)|call_resource (?:\w+ \()?0xF0([012])\)?)$/.exec(ops[i].text);
      if (!m) continue;
      const verb = m[1] ? VERB[m[1]] : ['set', 'clear', 'test'][+m[2]];
      const kids = [];
      for (let j = i + 1; j < ops.length && ops[j].depth > ops[i].depth; j++) if (ops[j].depth === ops[i].depth + 1) kids.push(ops[j]);
      const lit = kids[1] && LIT.exec(kids[1].text);
      if (!lit) { unknown++; continue; }
      const f = parseInt(lit[1]);
      if (!by.has(f)) by.set(f, { flag: f, set: [], clear: [], test: [], effect: [] });
      by.get(f)[verb].push({ resid: e.resid, at: kids[1].at });
    }
  }
  return (DERIVED.CHAR_FLAG_SITES = { flags: [...by.values()].sort((a, b) => a.flag - b.flag), unknown });
}
// The record byte and bit a flag lives in, by the program's own map.
function characterFlagPlace(flag) {
  const map = appImage() ? exeAbilityMap() : [];
  for (const m of map) if (m.below && flag < m.below.v && m.offset) return { offset: m.offset, bit: flag - (m.sub ? m.sub.v : 0), word: m.word };
  return null;
}

/* ---- how a monster is built, read off CreateMonster and the constructors --
   A creature's class carries a layout code as the first word of key 55, and
   TActiveMonster::CreateMonster picks a kind of monster by it: one code is a
   dragon (four extra records copying the head's, a 2x2), a run of codes is
   a crawler (a head with a tail record behind it), one code is an octopus
   (a body with eight arm records of another class around it), and the rest
   are one record. The bounds are the routine's three compares, read here,
   with the constructor each branch calls as the control. Then each
   constructor says the rest: TCrawlMonster compares the code against one
   value (10) for a single tail whose aspect is the head's plus 8, else
   takes the segment count from key 54; TOctoMonster reads the arm class
   from key 54 and places eight arms at the offsets in two tables of
   halfwords beside the TOC, arm i at aspect i. The page assembles a unit's
   picture by these (unitPieces in js/page-props.js), and with no
   application open uses the same constants, which is what a reader here
   returning null means. */
function exeMonsterKinds() {
  return exeMemo('exeMonsterKinds', () => {
    const ops = exeOpsNamed('TActiveMonster::CreateMonster');
    if (!ops.length) return null;
    const cmp = ops.filter(o => o.d && o.d.mn === 'cmpwi');
    const ctor = name => ops.find(o => exeCalls(o, name));
    const crawl = ctor('TCrawlMonster::TCrawlMonster'), dragon = ctor('TDragonMonster::TDragonMonster'), octo = ctor('TOctoMonster::TOctoMonster');
    if (!crawl || !dragon || !octo || cmp.length < 3) return null;
    const a = cmp[0].d.imm, b = cmp[1].d.imm, c = cmp[2].d.imm;
    const range = (lo, hi) => { const r = []; for (let i = lo; i <= hi; i++) r.push(i); return r; };
    return { dragon: range(a, a), crawl: range(b, a - 1), octo: range(a + 1, c - 1),
             bounds: cmp.slice(0, 3).map(o => exeVal(o, o.d.imm)), ctors: { crawl, dragon, octo } };
  });
}
function exeCrawlRule() {
  return exeMemo('exeCrawlRule', () => {
    const ops = exeOpsNamed('TCrawlMonster::TCrawlMonster');
    if (!ops.length) return null;
    const k55 = ops.findIndex(o => o.d && o.d.mn === 'li' && o.d.imm === 55 && (o.d.rt === 4 || o.d.rd === 4));
    const lit = exeFindBack(ops, k55, 30, d => d.mn === 'li' && d.imm > 0 && d.imm < 64 && (d.rt === 0 || d.rd === 0));
    const k54 = exeFind(ops, k55, 60, d => d.mn === 'li' && d.imm === 54);
    const tail = exeFind(ops, k55, 200, d => d.mn === 'addi' && d.imm === 8 && d.ra === 3);
    if (k55 < 0 || lit < 0 || tail < 0) return null;
    return { tailOnly: exeVal(ops[lit], ops[lit].d.imm), tailOffset: exeVal(ops[tail], 8), segmentsKey: k54 >= 0 ? exeVal(ops[k54], 54) : null };
  });
}
function exeOctoRule() {
  return exeMemo('exeOctoRule', () => {
    const img = appImage();
    const ops = exeOpsNamed('TOctoMonster::TOctoMonster');
    if (!img || !ops.length) return null;
    const tabs = ops.filter(o => o.d && o.d.mn === 'addi' && o.d.ra === 2).slice(0, 2);
    const k54 = ops.findIndex(o => o.d && o.d.mn === 'li' && o.d.imm === 54);
    const bound = ops.findIndex(o => o.d && o.d.mn === 'cmpwi' && o.d.imm > 1 && o.d.imm <= 16);
    if (tabs.length < 2 || k54 < 0 || bound < 0) return null;
    const n = ops[bound].d.imm;
    const sec = img.contents[img.toc.section].bytes;
    const read = d => { const o = img.toc.offset + d, a = []; for (let i = 0; i < n; i++) { let v = (sec[o + 2 * i] << 8) | sec[o + 2 * i + 1]; if (v & 0x8000) v -= 0x10000; a.push(v); } return a; };
    // Arm i is not given aspect i. The loop counter is shifted left, the rlwimi
    // that writes the aspect byte rotates it again, and the aspect field sits
    // two bits up in that byte, so the aspect steps by 1 << (sh + sh' - (31-me))
    // -- which is the number of frames one direction of the arm's sheet owns.
    // Reading it as i put seven of the eight arms on a frame of the wrong
    // direction, which is what the assembled hydra looked like.
    const ctr = ops.find(o => o.d && o.d.mn === 'addi' && o.d.imm === 1 && o.d.ra === exeDestReg(o.d));
    let step = null;
    if (ctr) for (const o of ops) {
      if (!o.d || o.d.mn !== 'slwi' || o.d.rs !== ctr.d.ra) continue;
      const m = ops.find(e => e.d && e.d.mn === 'rlwimi' && e.d.rs === o.d.ra && e.d.mb >= 24);
      if (!m) continue;
      const sh = o.d.sh + m.d.sh - (31 - m.d.me);
      if (sh >= 0 && sh < 8) step = exeVal(m, 1 << sh);
      break;
    }
    // The loop adds the first table to x and the second to y.
    return { armKey: exeVal(ops[k54], 54), arms: exeVal(ops[bound], n), aspectStep: step, dx: exeVal(tabs[0], read(tabs[0].d.imm)), dy: exeVal(tabs[1], read(tabs[1].d.imm)) };
  });
}
function exeDestReg(d) { return d.rt !== undefined ? d.rt : d.rd !== undefined ? d.rd : d.rs; }

/* ---- the per-class cache, read off FillIntfCache -------------------------
   At load the application walks every prop type and builds a long per
   class from the class table: the low bits of ClassFlags (key 39) copied or
   moved, a bit for each of several members the class has (GetMessage,
   Mirror, Weight, Equipment, Portal and two unnamed keys), the bits of
   Stacking (key 40), and four side tables of one byte or halfword a class
   (the weight, the Chair word plus one, key 55's word, the first word of
   SoundEffects). This reads the routine rather than stating the map: each
   `li 4, K` names the key the next HasProperty or GetProperty asks about,
   a single-bit test of the value followed by an `ori`/`oris` into the
   cache is a value bit moved to a cache bit, an `ori`/`oris` after a
   HasProperty alone is a has-bit, and a store through a register loaded
   beside the TOC is a side table. Null with no application open. */
function exeIntfCache() {
  const r = exeRoutineNamed('FillIntfCache');
  const ops = exeOpsOf(r);
  if (!ops.length) return null;
  const reg = d => d.rt !== undefined ? d.rt : d.rd !== undefined ? d.rd : d.rs;
  // The cache base is the register a stwx stores through, loaded beside
  // the TOC; the side tables are the other registers so loaded, tracked
  // in program order since one register serves several tables in turn.
  const firstLoads = new Map();
  for (const o of ops) if (o.d && o.d.mn === 'lwz' && o.d.ra === 2 && !firstLoads.has(reg(o.d))) firstLoads.set(reg(o.d), { disp: o.d.d, op: o });
  const cacheReg = (ops.find(o => o.d && o.d.mn === 'stwx' && firstLoads.has(o.d.ra)) || { d: {} }).d.ra;
  const cache = firstLoads.get(cacheReg);
  if (!cache) return null;
  const out = { routine: r, cacheDisp: exeVal(cache.op, cache.disp), bits: [], has: [], tables: [] };
  const tocLoads = new Map();
  let key = null, mode = null, keyOp = null;
  for (let i = 0; i < ops.length; i++) {
    const d = ops[i].d;
    if (!d) continue;
    if (d.mn === 'lwz' && d.ra === 2) { tocLoads.set(reg(d), { disp: d.d, op: ops[i] }); continue; }
    if (d.mn === 'li' && reg(d) === 4) { key = d.imm; keyOp = ops[i]; continue; }
    if (d.mn === 'bl') { if (exeCalls(ops[i], 'TInterp::HasProperty')) mode = 'has'; else if (exeCalls(ops[i], 'TInterp::GetProperty')) mode = 'get'; continue; }
    if (key === null) continue;
    if ((d.mn === 'ori' || d.mn === 'oris') && d.imm !== undefined) {
      // Into the cache: the register was just loaded through the cache base.
      const ld = exeFindBack(ops, i, 3, e => e.mn === 'lwzx' && e.ra === cacheReg);
      if (ld < 0) continue;
      const bit = d.mn === 'oris' ? (d.imm << 16) >>> 0 : d.imm;
      // A single-bit test of the value just before it, or a tag test: the
      // nearest test since the GetProperty call, not only the five
      // instructions before the load. The Weight's tag test sits sixteen
      // instructions before the `oris` it decides, on the far side of the
      // plain-number arm that stores the byte table, and a five-deep look
      // read that bit (0x02000000, a weight that is not a plain number) as
      // a second has-bit of key 36 until 24 September 2026.
      const isTest = e => (e.mn === 'rlwinm.' && e.sh === 0) || e.mn === 'clrlwi.';
      let t = exeFindBack(ops, ld, 5, isTest);
      if (t < 0 && mode === 'get') {
        for (let k = ld - 1; k >= Math.max(0, ld - 40) && t < 0; k--) {
          const e = ops[k].d, br = ops[k + 1] && ops[k + 1].d;
          if (!e || !isTest(e) || !br || !br.conditional || br.aa) continue;
          const to = ops[k + 1].at + br.disp;
          if (to <= ops[ld].at && to >= ops[Math.max(0, ld - 3)].at) t = k;
        }
      }
      if (mode === 'get' && t >= 0) {
        const e = ops[t].d;
        let mask = 0;
        if (e.mn === 'clrlwi.') mask = (1 << (32 - e.mb)) - 1 & 0xFF;
        else for (let b = e.mb; b <= e.me; b++) mask |= 1 << (31 - b);
        if (e.mn === 'rlwinm.' && e.mb === 0) out.bits.push({ key, tag: true, cacheBit: exeVal(ops[i], bit), keyOp });
        else out.bits.push({ key, mask: exeVal(ops[t], mask >>> 0), cacheBit: exeVal(ops[i], bit), keyOp });
      } else out.has.push({ key, cacheBit: exeVal(ops[i], bit), keyOp });
      continue;
    }
    if ((d.mn === 'stbx' || d.mn === 'sthx') && tocLoads.has(d.ra) && tocLoads.get(d.ra).disp !== cache.disp) {
      const plus = exeFindBack(ops, i, 4, e => e.mn === 'addi' && e.imm === 1 && reg(e) === d.rs);
      out.tables.push({ key, disp: exeVal(tocLoads.get(d.ra).op, tocLoads.get(d.ra).disp), width: d.mn === 'stbx' ? 1 : 2, plusOne: plus >= 0, at: ops[i].at, keyOp });
    }
  }
  return out;
}

/* Every routine that loads a pointer kept beside the TOC and tests bits of
   what it finds there: the reader list for the per-class cache and its
   side tables. One pass over the code section finds the loads; then each
   routine that has one is followed register by register -- the pointer,
   any register it is copied into, the word loaded through it, and any
   register that word is copied into -- and a mask tested on the word
   anywhere in the routine is a reader, at that instruction. The first
   version looked only twenty-four instructions past the load and missed
   the tests of four bits that sit further down (LoadLevelProps on 0x200,
   MoveCommand on 0x02, SetStage on the Stacking bits); a routine with no
   mask read the table for a value rather than a bit. Kept on the
   program per displacement. */
function exeTocReaders(disp) {
  const img = appImage(), pef = appPef();
  if (!img || !pef) return [];
  if (!pef._tocReaders) pef._tocReaders = new Map();
  if (pef._tocReaders.has(disp)) return pef._tocReaders.get(disp);
  const code = img.code, out = [];
  const reg = d => d.rt !== undefined ? d.rt : d.rd !== undefined ? d.rd : d.rs;
  const src = d => d.rs !== undefined ? d.rs : (d.args ? d.args[1] : undefined);
  const seen = new Set();
  for (let at = 0; at + 4 <= code.length; at += 4) {
    // lwz is primary opcode 32 with rA in bits 11-15 and the displacement
    // in the low half; the bits are tested before the decoder, which over
    // the whole code section was half a second a displacement.
    const w = pefU32(code, at);
    if ((w >>> 26) !== 32 || ((w >>> 16) & 31) !== 2 || ((w & 0xFFFF) << 16 >> 16) !== disp) continue;
    const d = ppcDecode(w);
    if (!d || d.mn !== 'lwz' || d.ra !== 2 || d.d !== disp) continue;
    const r = exeRoutineAt(at);
    if (!r || /^FillIntfCache\b/.test(r.name) || seen.has(r.offset)) continue;
    seen.add(r.offset);
    const ops = exeOpsOf(r);
    const ptr = new Set(), word = new Set(), masks = [];
    let first = null;
    for (const o of ops) {
      const e = o.d;
      if (!e) continue;
      if (e.mn === 'lwz' && e.ra === 2 && e.d === disp) { ptr.add(reg(e)); if (first === null) first = o.at; continue; }
      if (e.mn === 'mr' && ptr.has(src(e))) { ptr.add(reg(e)); continue; }
      if ((e.mn === 'lwzx' || e.mn === 'lwz' || e.mn === 'lbzx' || e.mn === 'lhzx') && ptr.has(e.ra)) { word.add(reg(e)); continue; }
      if (e.mn === 'mr' && word.has(src(e))) { word.add(reg(e)); continue; }
      let m = null, from = null;
      if ((e.mn === 'rlwinm.' || e.mn === 'rlwinm') && e.sh === 0 && e.mb !== undefined) { m = 0; for (let b = e.mb; b <= e.me; b++) m |= 1 << (31 - b); m >>>= 0; from = e.rs; }
      else if (e.mn === 'andi.') { m = e.imm; from = e.rs; }
      else if (e.mn === 'andis.') { m = (e.imm << 16) >>> 0; from = e.rs; }
      if (m === null || m === 0xFFFFFFFF || !word.has(from)) continue;
      masks.push({ mask: m, at: o.at });
    }
    out.push({ at: first, routine: r.name.replace(/\(.*$/, ''), masks });
  }
  pef._tocReaders.set(disp, out);
  return out;
}

/* ---- how a character is seated, read off InteractProps ---------------------
   TViewer::InteractProps finds each seat by the per-class Chair table
   (FillIntfCache keeps the Chair word plus one there), and for a four-way
   sprite standing on it -- key 55's first word is 4 -- sets the sitter's
   aspect: with a Chair word of 0, the seat's own aspect times four plus
   three, so the seat's aspect is the facing and column three is the seated
   pose; with a word of 1 to 4, a fixed frame, which the routine holds as
   `li` operands of 3, 7, 11 and 15 -- north, east, south and west seated.
   Read here as the switch's four constants and the 'or 3' of the aspect
   case. Null with no application open or when the shape is not found. */
function exeSeatRule() {
  const ops = exeOpsNamed('TViewer::InteractProps');
  if (!ops.length) return null;
  const ic = exeIntfCache();
  const chair = ic && ic.tables.find(t => t.key === 34);
  if (!chair) return null;
  const li = ops.findIndex(o => o.d && o.d.mn === 'lwz' && o.d.ra === 2 && o.d.d === chair.disp.v);
  if (li < 0) return null;
  // The layout test: the sitter's key-55 byte compared against 4.
  const t55 = ic.tables.find(t => t.key === 55);
  const lt = t55 ? ops.findIndex(o => o.at > ops[li].at && o.d && o.d.mn === 'lwz' && o.d.ra === 2 && o.d.d === t55.disp.v) : -1;
  const facings = lt >= 0 ? exeFind(ops, lt, 6, d => d.mn === 'cmplwi') : -1;
  // The fixed frames: the `li` operands inserted into the sitter's aspect
  // after the switch on the Chair word less one.
  const fixed = [];
  const own = exeFind(ops, li, 200, d => d.mn === 'ori' && d.imm === 3);
  for (let i = li; i < Math.min(ops.length, li + 200); i++) {
    const d = ops[i].d;
    if (d && d.mn === 'li' && (d.imm === 3 || d.imm === 7 || d.imm === 11 || d.imm === 15)) {
      const ins = exeFind(ops, i + 1, 3, e => e.mn === 'rlwimi');
      if (ins >= 0) fixed.push(exeVal(ops[i], d.imm));
    }
  }
  if (fixed.length < 4) return null;
  fixed.sort((a, b) => a.v - b.v);
  return { chair, facings: facings >= 0 ? exeVal(ops[facings], ops[facings].d.imm) : null, fixed, ownAspect: own >= 0 ? exeVal(ops[own], 3) : null };
}

/* ---- one class's long in the per-class cache ----------------------------
   What FillIntfCache would build for a class, computed here from the
   class's own table and the map read off the routine (exeIntfCache): a
   has-bit is set when the class has the member at all, in its data, its
   code or its strings; a moved bit when the member's one word is a plain
   number carrying it; a tag bit when the member is there and is not a
   plain number (a class whose weight is not a number, for one); and the
   side tables take the member's word as the routine keeps it. The class is
   read as the file has it and nothing is followed to a parent or a
   default: TInterp::HasProperty is asked about the class script itself,
   which is also how thinkADotRules decides which classes answer a signal.
   Each bit is joined to the routines that test it (exeTocReaders), so a
   bit is named by what reads it and by where it came from, never by a
   guess. Null with no application open or no class table. */
function classCacheWord(pt) {
  const ic = appImage() ? exeIntfCache() : null;
  const cls = ic && parseClassTable(0x1000 + pt);
  if (!cls) return null;
  const has = key => cls.data.some(f => f.key === key) || cls.code.some(f => f.key === key) || cls.text.some(f => f.key === key);
  const plain = key => { const f = cls.data.find(x => x.key === key); return f && f.words.length === 1 && !(f.words[0] & 0xF0000000) ? { v: f.words[0] & 0x0FFFFFFF, off: f.off } : null; };
  const readers = exeTocReaders(ic.cacheDisp.v);
  const testedBy = bit => {
    const hits = [];
    for (const r of readers) for (const m of r.masks) if ((m.mask & bit) === bit && !hits.some(h => h.routine === r.routine)) hits.push({ routine: r.routine, at: m.at });
    return hits;
  };
  let value = 0;
  const bits = [];
  for (const h of ic.has) if (has(h.key)) { value = (value | h.cacheBit.v) >>> 0; bits.push({ bit: h.cacheBit, key: h.key, kind: 'has', testedBy: testedBy(h.cacheBit.v) }); }
  for (const b of ic.bits) {
    const w = plain(b.key);
    if (b.tag ? (has(b.key) && !w) : (w && (w.v & b.mask.v))) {
      value = (value | b.cacheBit.v) >>> 0;
      bits.push({ bit: b.cacheBit, key: b.key, kind: b.tag ? 'tag' : 'moved', mask: b.tag ? null : b.mask, at: w ? { resid: cls.resid, at: w.off } : null, testedBy: testedBy(b.cacheBit.v) });
    }
  }
  bits.sort((x, y) => x.bit.v - y.bit.v);
  const tables = [];
  for (const t of ic.tables) {
    const w = plain(t.key);
    if (!w) continue;
    tables.push({ key: t.key, disp: t.disp, width: t.width, plusOne: t.plusOne, value: (t.plusOne ? w.v + 1 : w.v) & (t.width === 1 ? 0xFF : 0xFFFF), at: { resid: cls.resid, at: w.off },
                  readBy: exeTocReaders(t.disp.v).filter((x, i, a) => a.findIndex(y => y.routine === x.routine) === i) });
  }
  return { pt, resid: cls.resid, value, bits, tables, routine: ic.routine };
}

/* ---- the syscall table, read off the interpreter ----------------------------
   TInterp::DoExpr takes an opcode of 0xA0 or more, subtracts 0xA0, and
   calls through a table of transition vectors beside the TOC; the vector's
   first word is the routine, and the routine has the program's own name
   for the call (cbrnd, cbwhohas). delvmod's names for the same numbers are
   behavioural, from watching scripts; this puts the two side by side. The
   compare against 0xA0 and the table's displacement are read off the
   routine. Null with no application open. */
function exeSyscallTable() {
  const img = appImage();
  if (!img) return null;
  const ops = exeOpsNamed('TInterp::DoExpr');
  const ci = ops.findIndex(o => o.d && o.d.mn === 'cmplwi' && o.d.imm === 160);
  if (ci < 0) return null;
  const ti = exeFind(ops, ci, 60, d => d.mn === 'addi' && d.ra === 2);
  const si = exeFind(ops, ci, 60, d => d.mn === 'addi' && d.imm === -160);
  if (ti < 0) return null;
  const off = exeTocOffset(ops[ti].d.imm);
  const base = si >= 0 ? -ops[si].d.imm : 160;
  const entries = [];
  for (let i = 0; i < 96; i++) {
    let p = null, q = null;
    try { p = pefPointerAt(img, img.toc.section, off + 4 * i); q = p && p.section === img.toc.section ? pefPointerAt(img, p.section, p.offset) : null; } catch (e) { p = null; }
    const r = q && q.section === img.codeIndex ? exeRoutineAt(q.offset) : null;
    entries.push({ op: base + i, at: r && r.offset === q.offset ? r.offset : null, name: r && r.offset === q.offset ? r.name.replace(/\(.*$/, '') : null });
  }
  return { table: exeVal(ops[ti], ops[ti].d.imm), base: exeVal(ops[si >= 0 ? si : ci], base), entries };
}

/* Which syscalls take a character by its number, and in which argument,
   read off each handler. A handler gets the argument array in r4; an
   argument whose number (its tag stripped) is multiplied by 32 and used to
   index the character table (the words at r2-30352, 32 bytes a character,
   the table cbpartyjoin sets the in-party bit in) is a character -- there,
   or in a routine the handler hands it to, two calls deep, which is how
   TalkParticipant (cbsetportrait) reaches it through
   TConversation::ShowPortrait. The reader follows a value through register
   moves, stack slots and the shifts that strip the tag, and forgets a
   register the moment anything else writes it. Map of syscall op to the
   argument indices; null with no application open. */
let _sysCharArgs = { app: undefined, v: null };
function exeSyscallCharacterArgs() {
  const app = window.APP_PEF || (typeof appPef === 'function' ? appPef() : null);
  if (_sysCharArgs.app === app) return _sysCharArgs.v;
  let v = null;
  try {
    const st = app ? exeSyscallTable() : null;
    if (st) {
      v = new Map();
      const reach = (r, reg0, depth) => {
        const reg = Object.assign({}, reg0), stack = {}, hits = new Set();
        for (const o of exeOpsOf(r)) {
          const d = o.d; if (!d) continue; const mn = d.mn;
          if (mn === 'bl' && o.to !== null) {
            const callee = depth > 0 ? exeRoutineAt(o.to) : null;
            if (callee && callee.offset === o.to) {
              const pass = {};
              for (let p = 3; p <= 10; p++) if (reg[p] && reg[p].arg !== undefined && !reg[p].x32) pass[p] = reg[p];
              if (Object.keys(pass).length) for (const h of reach(callee, pass, depth - 1)) hits.add(h);
            }
            for (let p = 0; p <= 12; p++) reg[p] = undefined;
            continue;
          }
          if (mn === 'mr' || (mn === 'addi' && d.imm === 0 && d.ra !== 0)) { reg[mn === 'mr' ? d.ra : d.rd] = reg[mn === 'mr' ? d.rs : d.ra]; continue; }
          if ((mn === 'stw' || mn === 'sth') && d.ra === 1) { stack[d.d] = reg[d.rt]; continue; }
          if ((mn === 'lwz' || mn === 'lha') && d.ra === 1) { reg[d.rt] = stack[d.d] || (mn === 'lha' ? stack[d.d - 2] : undefined); continue; }
          if (mn === 'lwz' && d.ra === 2 && d.d === -30352) { reg[d.rt] = { chars: true }; continue; }
          if (mn === 'lwz' && reg[d.ra] && reg[d.ra].args) { reg[d.rt] = { arg: d.d / 4 }; continue; }
          if ((mn === 'slwi' || mn === 'srawi' || mn === 'extsh' || mn === 'clrlwi') && reg[d.rs] && reg[d.rs].arg !== undefined) {
            reg[d.ra] = { arg: reg[d.rs].arg, x32: mn === 'slwi' && d.sh === 5 ? true : reg[d.rs].x32 }; continue;
          }
          if (mn === 'addi' && reg[d.ra] && reg[d.ra].x32) { reg[d.rd] = reg[d.ra]; continue; }
          if (/^(l|st)[bhw][a-z]*x$/.test(mn) || mn === 'add') {
            const a = reg[d.ra], b = reg[d.rb];
            if (a && a.chars && b && b.x32) hits.add(b.arg);
            if (b && b.chars && a && a.x32) hits.add(a.arg);
          }
          if (/^(cmp|st|b|mt)/.test(mn)) continue;
          const dest = /^l[bhw]/.test(mn) ? d.rt : d.rd !== undefined ? d.rd : d.rs !== undefined ? d.ra : undefined;
          if (dest !== undefined) reg[dest] = undefined;
        }
        return hits;
      };
      for (const e of st.entries) {
        if (!e.at) continue;
        const hits = reach(exeRoutineAt(e.at), { 4: { args: true } }, 2);
        if (hits.size) v.set(e.op, hits);
      }
    }
  } catch (e) { quiet(e, 'the syscalls that take a character'); v = null; }
  _sysCharArgs = { app, v };
  return v;
}

// The flag number of a status-word bit, with where its subtrahend was read.
function exeFlagOfStatusBit(bit, statusOffset) {
  const m = exeAbilityMap().find(x => x.word && x.offset && x.offset.v === statusOffset);
  return m && bit ? { v: bit.v + m.sub.v, exe: m.sub.exe } : null;
}

// What each spell does to health, read off its script: every damage call
// (0xEB8: victim, amount, type, source) and every write to health. The
// amount is a stack expression of constants, Random(a,b) rolls and adds.
function dvmAmountExpr(tokens) {
  const st = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let m;
    if ((m = /^(?:byte|word|short) (-?0x[0-9A-F]+|-?\d+)$/i.exec(t))) { st.push({ base: parseInt(m[1]), rolls: [] }); continue; }
    if (/^sys Random$/.test(t)) {
      const a = /(-?\d+|0x[0-9A-F]+)$/i.exec(tokens[i + 1] || ''), b = /(-?\d+|0x[0-9A-F]+)$/i.exec(tokens[i + 2] || '');
      if (a && b && /^end$/.test(tokens[i + 3] || '')) { st.push({ base: 0, rolls: [[parseInt(a[1]), parseInt(b[1])]] }); i += 3; continue; }
      return null;
    }
    if (/^add$/.test(t)) { const y = st.pop(), x = st.pop(); if (!x || !y) return null; st.push({ base: x.base + y.base, rolls: x.rolls.concat(y.rolls) }); continue; }
    if (/^end$/.test(t)) continue;
    return null;
  }
  return st.length === 1 ? st[0] : null;
}
/* A roll in words. `Random(a, b)` yields a to b MINUS ONE -- `cbrnd` in the
   executable is `a + (rand mod (b - a))`, and 31 places in the archive write
   `Random(0, len(array))` and index that array with it -- so the operands are
   not the ends of the range and printing them as if they were overstates
   every roll on the sheet by a point. It said "a roll of 0 to 10" for
   Fireball's `Random(0, 10)` until 6 September 2026. Where a script passes a
   pair it cannot roll between (`a >= b`, which the routine answers with `a`),
   the one value is printed rather than a backwards range. */
function rollWords(r) {
  const lo = r[0], hi = r[1] - 1;
  return hi <= lo ? 'a fixed ' + lo : 'a random number from ' + lo + ' to ' + hi;
}
function amountWords(a) {
  if (!a) return '';
  const parts = [];
  if (a.base || !a.rolls.length) parts.push(String(a.base));
  const same = a.rolls.length && a.rolls.every(r => r[0] === a.rolls[0][0] && r[1] === a.rolls[0][1]);
  if (a.rolls.length === 1) parts.push(rollWords(a.rolls[0]));
  else if (a.rolls.length > 1 && same) parts.push(['two', 'three', 'four'][a.rolls.length - 2] + ' ' + rollWords(a.rolls[0]).replace(/^a random number/, 'random numbers').replace(/^a fixed/, 'times'));
  else a.rolls.forEach(r => parts.push(rollWords(r)));
  return parts.join(' + ');
}
// The damage type is a bit set: 0x03 edged or piercing, 0x04 blunt, 0x08
// fire, 0x20 electric, 0xC0 magic (Rules › resistance, 0x100 and 0x3040).
function damageTypeName(t) {
  const base = (t & 0x08) ? 'fire' : (t & 0x20) ? 'electric' : (t & 0x04) ? 'blunt' : (t & 0x03) ? 'edged' : 'plain';
  return ((t & 0xC0) ? 'magical ' : '') + base;
}
function spellEffects() {
  const idx = buildScriptTextIndex();
  const out = new Map();
  const strip = l => l.replace(/^\s*[0-9A-F]{4}\s+/, '').replace(/\s+\/\/.*$/, '').trim();
  for (const sp of spellRules().spells) {
    const e = dvmScriptEntry(sp.resid);
    if (!e) continue;
    // The instructions alone, comments off, in step with their offsets so
    // each effect can say where it was read.
    const ops = dvmOpsOf(e);
    const ls = ops.map(o => strip(o.text));
    const fx = { damage: [], heals: [] };
    for (let i = 0; i < ls.length; i++) {
      if (/^call_resource 0xEB8$/.test(ls[i])) {
        // victim token(s), the amount, the type, the source, end
        let j = i + 1; const victim = ls[j++];
        const expr = []; let type = null;
        for (; j < ls.length && !/^(global CurrentCharacter|word None|arg Arg00)/.test(ls[j]); j++) expr.push(ls[j]);
        const tm = /^byte (0x[0-9A-F]+|\d+)$/i.exec(expr[expr.length - 1] || '');
        if (tm) { type = parseInt(tm[1]); expr.pop(); }
        const amount = dvmAmountExpr(expr);
        // a victim from an iterator is everyone the effect reaches, unless
        // the lines before compare its square with the target's (Fireball)
        const before = ls.slice(Math.max(0, i - 14), i).join(' ');
        const area = /^local Var/.test(victim) ? (/get_field x \(0x1\) arg Arg01 eq/.test(before) ? 'the one on the target square' : /EnemyIterator/.test(ls.slice(Math.max(0, i - 40), i).join(' ')) ? 'every enemy' : 'everything in the effect') : 'the target';
        fx.damage.push({ who: area, amount, type, at: ops[i].at });
      }
      if (/^set_field health \(0x1C\)$/.test(ls[i])) {
        const seg = ls.slice(i + 1, i + 14);
        const k = seg.findIndex(l => /^get_field (health|full_health)/.test(l));
        if (k < 0) continue;
        const full = /full_health/.test(seg[k]);
        const rest = seg.slice(k + 1);
        const expr = [];
        for (const l of rest) { if (/^return$/.test(l) || /^set_local/.test(l)) break; expr.push(l); }
        // drop the trailing 'end' that closes the set_field
        while (expr.length && /^end$/.test(expr[expr.length - 1])) expr.pop();
        if (full) {
          const t = expr.join(' ');
          const q = /byte (0x[0-9A-F]+) div byte (0x[0-9A-F]+) add/i.exec(t);
          fx.heals.push({ text: q ? 'health to full ÷ ' + parseInt(q[1]) + ' plus ' + parseInt(q[2]) : !expr.length ? 'health to full' : 'health from full health', at: ops[i].at });
        } else {
          const a = dvmAmountExpr(['byte 0'].concat(expr));   // the current health is the first operand
          if (a) fx.heals.push({ text: 'health + ' + amountWords(a), amount: a, at: ops[i].at });
        }
      }
    }
    if (fx.damage.length || fx.heals.length) out.set(sp.resid, fx);
  }
  return out;
}
// Sleeping: the bed class (0x100E) picks a quality and the sleep helper
// (0xE93) multiplies what the engine healed during the night by it.
function sleepRules() {
  const idx = buildScriptTextIndex();
  const bed = dvmScriptEntry(0x100E), helper = dvmScriptEntry(0xE93);
  if (!bed || !helper) return null;
  const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
  const h = strip(helper.text);
  const bo = dvmOpsOf(bed), ho = dvmOpsOf(helper);
  // Your own bed: in room 2 the quality local is set to this.
  const ownG = dvmSeqFirst(bo, [/^global CurrentRoom/, /^short (?:0x0002|2)$/, /^eq$/, /^then /, /^set_local 0x00$/, DVM_NUM]);
  // The night: PassTime(n) for each of hours x k, then healed x quality / d.
  const qG = dvmSeqFirst(ho, [/^sys PassTime$/, DVM_NUM]);
  const hG = dvmSeqFirst(ho, [/^arg Arg00$/, DVM_NUM, /^mul$/]);
  const dG = dvmSeqFirst(ho, [/^arg Arg03$/, /^mul$/, DVM_NUM, /^div$/]);
  const ownVal = ownG ? dvmVal(0x100E, ownG[5]) : null, quarterVal = qG ? dvmVal(0xE93, qG[1]) : null,
        hoursVal = hG ? dvmVal(0xE93, hG[1]) : null, div = dG ? dvmVal(0xE93, dG[2]) : null;
  const own = ownVal ? ownVal.v : null, quarter = !!quarterVal, hours = !!hoursVal, half = !!div;
  const owner = /Out of my bed/.test(h);
  const toss = /toss and turn/.test(h);
  const soundly = /sleep soundly/.test(h);
  // The inn's quality: the bed reads global resource 0x301's array at a
  // slot the innkeeper's dialogue wrote when the room was paid for.
  const store = dvmScriptEntry(0x301);
  const am = store && /obj_0000 = \[([\d, ]+)\]/.exec(strip(store.text));
  const table = am ? am[1].split(',').map(x => parseInt(x.trim())) : null;
  const inns = [];
  for (const e of idx) {
    if (e.resid < 0x1800 || e.resid >= 0x1A00) continue;
    const g = dvmSeqFirst(dvmOpsOf(e), [/^write_far_word 0x03010016$/i, DVM_NUM]);
    if (g) { const slot = dvmNum(g[1]); inns.push({ who: e.resid - 0x1800, slot, slotVal: dvmVal(e.resid, g[1]), quality: table && table[slot] !== undefined ? table[slot] : null, qualitySrc: table ? { resid: 0x301, at: 0 } : null }); }
  }
  inns.sort((a, b) => a.who - b.who);
  /* The magic half of the bonus reads full HEALTH twice where the health half
     reads it for health: once in the guard (magic under full health, and
     above what it was) and once in the cap, where a figure past full magic
     sets magic to full health. Read here rather than stated, 17 September
     2026, when the sheet's typed sentence was found to say "compares ... in
     two places" of what is one comparison and one assignment. A character
     whose full health is the larger therefore wakes from a good night with
     more magic than full. */
  const guardG = dvmSeqFirst(ho, [/^get_field magic\b/, /^local /, /^get_field full_health\b/, /^lt$/]);
  const capG = dvmSeqFirst(ho, [/^set_field magic\b/, /^local /, /^end$/, /^local /, /^get_field full_health\b/]);
  const magicGuard = guardG ? { resid: 0xE93, at: guardG[2].at } : null;
  const magicCap = capG ? { resid: 0xE93, at: capG[4].at } : null;
  return { own, ownVal, quarter, quarterVal, hours, hoursVal, half, div, owner, toss, soundly, table, inns, magicGuard, magicCap };
}
