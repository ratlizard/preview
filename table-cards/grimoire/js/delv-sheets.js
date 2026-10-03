/* The rules sheets: how a section of one is built, and what the Mechanics
   sheet is divided into.

   WHY THIS FILE EXISTS. index.html had grown to some 24,000 lines with every
   sheet, gallery and card inside it, and the parts that are not tied to the
   document had no reason to be there (the maintainer, 13 September 2026).
   The rule in CLAUDE.md draws its line at the DOM -- bytes-to-bytes goes in
   js/, bytes-to-screen stays in the page -- and that rule is about keeping
   the decoders checkable against delvmod, not about keeping the page one
   file. What is here is the sheet scaffolding and the tables that say how a
   sheet is arranged: no archive reading, and only the shallow bit of DOM a
   section needs to exist.

   THE TIER. js/mac-*.js know nothing of Cythera; js/delv-*.js know the
   formats but not the page. This file knows the page's furniture, so it sits
   last in the load order, after delv-mechanics.js. It is still a classic
   script -- no module, no import -- because these pages have to work from a
   file:// origin, and it may call functions the inline script declares:
   classic scripts share one global scope and nothing here runs at load time.

   WHAT BELONGS HERE. A builder that turns already-read figures into a card,
   and the tables that order them. What does NOT belong here is anything that
   reads the archive: those readers stay in the page beside the sheets that
   call them, until there is a reason to move them too. */

/* A section of a rules sheet, built anywhere.

   These were closures inside renderMechanicsSheet, which meant a section
   could only ever appear on the Mechanics sheet. Five of them belong
   elsewhere -- the balloons with the Barks, the writing with the Writings,
   the spells and the skills with their own tabs, and who answers as whom
   with the Dialogue -- and a real move needs the builder reachable from
   those renderers.

   The id stays `mech-<id>`: mechGo and eleven mechLink call sites resolve a
   section by it, so a move must not rename one. */
function mechSectionEl(id, title, icon, from, lede, rules, html, chips) {
  const sec = foldCard('mech-' + id, '', false);
  const head = document.createElement('summary');
  head.className = 'mechHead';
  const iconURL = icon ? relIconURL(icon) : '';
  head.innerHTML = (iconURL ? '<img class="skillIcon skillIconTile" src="' + iconURL + '" alt="" width="16" height="16">' : '') +
    '<h3>' + svEsc(title) + '</h3>' + (from ? '<span class="mechFrom">' + from + '</span>' : '');
  sec.appendChild(head);
  if (lede) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = lede; sec.appendChild(p); }
  if (rules && rules.length) { const ul = document.createElement('ul'); ul.className = 'ruleList'; ul.innerHTML = rules.map(r => '<li>' + r + '</li>').join(''); sec.appendChild(ul); }
  if (html) { const d = document.createElement('div'); d.className = 'mechBody'; d.innerHTML = html; sec.appendChild(d); }
  if (chips) { const d = document.createElement('div'); d.className = 'partsStrip'; d.innerHTML = chips; sec.appendChild(d); }
  return sec;
}

// The string builders the sections are written with. Pure, so they are here
// rather than rebuilt on every render; the sheets keep short aliases.
const mechTable = (heads, rows, cls) => rows.length
  ? '<div class="tableScroll"><table class="vocabTable barkTable mechTable' + (cls ? ' ' + cls : '') + '"><thead><tr>' +
    heads.map(h => '<th' + (/^#/.test(h) ? ' class="num"' : '') + '>' + h.replace(/^#/, '') + '</th>').join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '';
const mechNum = v => '<td class="num">' + (v === null || v === undefined || v === '' ? '' : svEsc(String(v))) + '</td>';
const mechStat = (n, what) => '<span class="mechStat"><b>' + svEsc(String(n)) + '</b> ' + svEsc(what) + '</span>';
const mechSrc = (label, resid) => refExists(resid) ? partChip(label, resid) : '';
const MECH_NO_APP = 'Open the game from its installer, under Settings, to read the program’s figures here.';

/* The sections that belong on another sheet.

   Each of these was a block inside renderMechanicsSheet, which meant it could
   only ever appear on the Mechanics sheet. Each is now a builder any renderer
   can call, because what it describes belongs beside the thing itself: what a
   skill is asked about with the skills, the spells with the spells, the talk
   balloons with the barks, the game's own writing with the Writings, and who
   answers as whom with the Dialogue.

   They keep their `mech-<id>` ids, so mechGo and the mechLink call sites
   still resolve them wherever they now sit. They read the archive through the
   same global readers the sheet used and build with the shared string
   builders above; nothing in them is Mechanics-specific any more except the
   id. */
function spellsMechSection() {
  const sp = spellRules();
  const fxMap = sp.spells.length ? spellEffects() : new Map();
  const doesCell = x => {
    const fx = fxMap.get(x.resid);
    if (!fx) return '';
    const bits = [];
    for (const d of fx.damage) bits.push('<b>' + srcNum({ resid: x.resid, at: d.at }, amountWords(d.amount) || 'an amount the script works out') + '</b> ' + (d.type !== null ? damageTypeName(d.type) + ' <span class="inspDim">(type ' + d.type + ')</span>' : '') + ' to ' + d.who);
    for (const hh of fx.heals) bits.push('<b>' + srcNum({ resid: x.resid, at: hh.at }, hh.text) + '</b>');
    return bits.join('<br>');
  };
  const fireball = sp.spells.find(x => /^Fireball$/.test(x.name));
  const fbFx = fireball && fxMap.get(fireball.resid);
  return mechSectionEl('spells', 'Spells', null, mechSrc('the casting', 0xEA1) + mechSrc('a hit', 0xEB8),
    // The count and the failure roll were the card's opening line until
    // 2 October 2026; the maintainer had it cut. The sheet's own intro
    // counts the spells, and the chart below states the roll.
    sp.spells.length ? '' : 'No spell in this file is cast through the shared script.',
    sp.spells.length ? [
      sp.rule && sp.rule.power ? 'A cost above the caster’s magic <b>fails outright</b>.' : '',
      sp.rule && sp.rule.timing ? 'The caster pays the cost, and the cast takes <b>' + srcNum(sp.rule.timeBase) + ' plus ' + srcNum(sp.rule.timeMult) + ' times the level</b> in time.' : 'The caster pays the cost.',
      'Spell damage works like a blow’s: the victim’s resistance applies, and the caster earns experience as usual.',
      fbFx && fbFx.damage.some(d => /target square/.test(d.who)) ? '<b>Fireball hurts only the character on the square it targets</b>, although its description says it engulfs all within.' : '',
      (function () { let ms = []; try { ms = parseMonsterStats().filter(r => r.proptype && (r.flags & 0x0100)).map(r => propDisplayName(r.proptype) || ('class ' + r.proptype)); } catch (e) { quiet(e); } return ms.length ? 'Non-magical damage, whether fire, electric, blunt or edged, does <b>nothing at all</b> to monsters that resist non-magical weapons: ' + ms.map(svEsc).join(', ') + '. Only Mystic Arrow and Death Strike count as magical, which is why Tremor and Fireball seem to do nothing late in the game.' : ''; })(),
      'Spell damage prints no message, and <b>every enemy</b> means every hostile character on the loaded map, on screen or not, so Tremor hurts enemies you cannot see.',
      (function () {
        const et = appImage() ? exeEnemyTable() : null;
        if (!et || !et.alignmentByte || !et.enemy) return '';
        const rows = [];
        for (let a = 0; a < et.side; a++) rows.push(a + ': ' + et.table.v.slice(a * et.side, (a + 1) * et.side).join(' '));
        return 'Who is an enemy comes from a ' + srcNum(et.table, et.side + '×' + et.side) + ' table of alignments, the caster’s down the side and the other character’s across, where ' + srcNum(et.enemy) + ' means enemy: <b>' + rows.join('; ') + '</b>.' +
          (et.peace && et.peaceKey ? ' A cheat key ' + srcNum(et.peaceKey, 'makes nobody an enemy') + '.' : '');
      })(),
      'A spell with nothing in the last column changes something other than health: a status, the light, a lock, a rune or the map.',
      (function () {
        let t = [];
        try { t = targetRules().filter(x => x.kind === 'spell'); } catch (e) { t = []; }
        if (!t.length) return '';
        const reach = t.filter(x => x.word & 0x8000);
        return reach.length ? '<b>' + reach.length + ' of the ' + t.length + ' spells that ask for a target must touch it</b>: the target has to be in one of the eight squares around the caster. You can aim the rest anywhere. ' + mechLink('target', 'What a Use Can Be Aimed At') : '';
      })()
    ].filter(Boolean) : [],
    mechSpellFigures(sp) +
    mechTable(['spell', '#level', '#cost', 'does'], sp.spells.map(x => '<tr><td>' + partChip(x.name, x.resid) + '</td>' + srcCell(x.levelVal) + srcCell(x.costVal) + '<td>' + doesCell(x) + '</td></tr>')), '');
}

function skillsMechSection() {
  const sk = skillConsultations();
  return mechSectionEl('skills', 'What Each Skill Is Asked About', null, '',
    sk.by.size ? 'Which scripts check for each skill.' + (sk.generic ? ' ' + countLink(sk.generic + ' more checks', 'The ' + sk.genericIn.size + ' shared scripts that hold ' + sk.generic + ' checks of whichever skill they are given', resChips(sk.genericIn)) + ' are in shared scripts that work for any skill.' : '') : 'No script in this file asks about a skill by name.',
    [], mechSkillsFigure(sk) + mechTable(['skill', 'asked about by'], [...sk.by.entries()].sort((a, b) => a[0] - b[0]).map(([id, resids]) =>
      '<tr><td>' + (refExists(0x1A00 + id) ? partChip(selfNameFor(0x1A00 + id) || ('skill 0x' + id.toString(16).toUpperCase()), 0x1A00 + id) : 'skill 0x' + id.toString(16).toUpperCase()) +
      '</td><td>' + [...resids].sort((a, b) => a - b).map(r => svChip(r)).join(' ') + '</td></tr>')), '');
}

function balloonsMechSection() {
  const barks = buildBarkCatalogue();
  const bark = appImage() ? exeBarkRules() : null;
  return mechSectionEl('balloons', 'Talk Balloons', null, '',
    'The short lines over a character’s head. ' +
      (bark && bark.ticks && bark.width ? 'Each appears in a ' + srcNum(bark.width) + '×' + srcNum(bark.height) + ' balloon and disappears after <b>' + (bark.ticks.v / 60) + ' seconds</b> (' + srcNum(bark.ticks) + ' ticks of a sixtieth of a second).'
        : MECH_NO_APP),
    ['A line is either fixed text or one picked at random from a list.', 'Two shared tavern scripts take a list of shouts, and a list of replies for when the food or wine arrives.',
     barks.length ? barks.length + ' places in this file’s scripts set a line, and the words are below.' : 'No script in this file sets a line.'],
    mechBalloonFigure(barks, bark),
    bark ? '<span class="partsTitle">In the program</span>' + pefChip('TBark::SetBark') + pefChip('TActiveMonster::ShowBarks') : '');
}

/* `lib` is libraryRules(), which the Loose ends section reads too; it is
   passed in where the caller already has it and read here otherwise. */
function libraryMechSection(lib) {
  if (lib === undefined) lib = libraryRules();
  const rows = lib ? lib.map(d => {
    const who = d.readers.map(r => srcNum({ v: '', resid: r.resid, at: r.at }, r.name + (r.field === 'd2' ? ' (Data2)' : ''))).join(', ');
    return '<tr>' + mechNum(d.entries.length) + '<td>' + partChip('0x' + d.resid.toString(16).toUpperCase(), d.resid) + '</td>' +
      '<td>' + who + '</td>' + mechNum(d.shownCount) + mechNum(d.unshown.length) + '</tr>';
  }) : [];
  const unshown = lib ? lib.reduce((a, d) => a.concat(d.unshown.map(e => ({ d, e }))), []) : [];
  const dangling = lib ? lib.reduce((a, d) => a.concat(d.dangling.map(k => ({ d, k }))), []) : [];
  const passages = lib ? lib.reduce((n, d) => n + d.entries.length, 0) : 0;
  return mechSectionEl('library', 'The Game’s Own Writing', null, '',
    lib ? 'The books, prophecies, scrolls, letters, signs and gravestones, and the things in the world that show them. A bookshelf’s Data1 says which book is on it.'
        : 'No class in this file shows a document.',
    lib ? [
      '<b>' + passages + ' passages</b> across <b>' + lib.length + ' arrays</b>, shown by ' + [...new Set(lib.flatMap(d => d.readers.map(r => r.name)))].join(', ') + '.',
      unshown.length ? '<b>' + countLink(String(unshown.length), 'The ' + unshown.length + ' passages that appear nowhere in play',
        unshown.map(u => svLink(String(u.e.str).trim().replace(/\s+/g, ' ').slice(0, 48) + (String(u.e.str).trim().length > 48 ? '…' : ''), 'jumpToResource(' + u.d.resid + ')', '0x' + u.d.resid.toString(16).toUpperCase() + ' ' + u.e.index))) + ' appear nowhere in play</b>: no prop in the world and no script points to them. They exist in the file, but you cannot read them.' : '',
      dangling.length ? '<b>' + dangling.length + '</b> are the other way round: a thing in the world whose Data1 points to no passage.' : ''
    ].filter(Boolean) : [],
    mechTable(['#passages', 'array', 'shown by', '#shown', '#not shown'], rows) +
    (unshown.length ? '<div class="partsTitle">Written, never shown</div>' +
      mechTable(['array', '#no.', 'the passage'], unshown.map(u =>
        '<tr><td>' + propWordHex(u.d.resid) + '</td>' + mechNum(u.e.index) +
        '<td>' + svEsc(String(u.e.str).replace(/\s+/g, ' ').trim().slice(0, 120)) + '</td></tr>')) : ''), '');
}

function talkMechSection() {
  const cv = convRules();
  const real = cv.groups.filter(g => g.kind === 'group');
  const others = cv.groups.filter(g => g.kind !== 'group');
  const alone = cv.shapes.find(s => s.shape === '');
  const topics = cv.chars.reduce((n, c) => n + c.topics, 0);
  const deeper = cv.chars.reduce((n, c) => n + c.deeper, 0);
  /* The group by its name, which is what the card is about; svChip leads
     with the resource's label ("group dialogue, shared by 91 resources")
     and put the name last, so each chip ran to four lines in a phone's
     table (the maintainer, 22 September 2026). */
  const groupChip = (g, note) => relChip({ resid: g.rid, main: g.name || propWordHex(g.rid), note, title: trailForResid(g.rid) });
  const groupRows = real.sort((a, b) => b.inherited - a.inherited).map(g =>
    '<tr><td>' + groupChip(g) + '</td>' + mechNum(g.topics) + mechNum(g.inherited) +
    '<td class="mechSub">' + (g.called ? 'called from a topic by ' + g.called : '') + '</td></tr>');
  const shapeRows = cv.shapes.filter(s => s.shape).map(s =>
    '<tr>' + mechNum(s.who.length) + '<td>' + svEsc(s.shape) + '</td>' +
    '<td class="mechSub">' + svEsc(s.who.slice(0, 5).map(c => c.name).join(', ') +
      (s.who.length > 5 ? ', and ' + (s.who.length - 5) + ' more' : '')) + '</td></tr>');
  return mechSectionEl('talk', 'Who Answers as Whom', null, '',
    cv.chars.length ? 'A character answers from their topics first, then from topics shared with others: Naxos answers as 0x804, then 0x80E, then 0x801.'
                    : 'No conversation in this file.',
    cv.chars.length ? [
      '<b>' + cv.chars.length + ' characters</b> hold <b>' + topics + ' topics</b> between them, of which <b>' + deeper + '</b> open further topics.',
      '<b>' + real.length + ' groups</b> serve more than one character. The longest chains have four steps, and most characters use a House, then a city, then Human.',
      alone ? '<b>' + alone.who.length + ' answer as nobody but themselves</b>: ' + svEsc(alone.who.map(c => c.name).join(', ')) + '.' : '',
      others.length ? 'Not every 0x8xx resource is a group: ' + others.map(g => groupChip(g, g.kind)).join(' ') : ''
    ].filter(Boolean) : [],
    mechTable(['group', '#topics', '#inherit it', ''], groupRows) +
    '<div class="partsTitle">The chains</div>' +
    mechTable(['#how many', 'answers as', 'who'], shapeRows), '');
}

/* Where each moved section now lives, and the links that reach it.

   A section that left the Mechanics sheet cannot be reached by mechLink any
   more: that opens Mechanics and calls mechGo, which would find nothing and
   do nothing. The five entries here are the whole of the move, so a link is
   never left pointing at a section that has gone -- `library` and `talk`
   went to galleries and are named by subindex, the other three by tab. */
const MECH_MOVED = {
  spells:   ['SPELLS', 'Spells'],
  skills:   ['SKILLS', 'Skills'],
  balloons: ['BARKS', 'Barks'],
  library:  ['1', 'Writings'],
  talk:     ['23', 'Dialogue'],
};
// A tab, by the value its gallery is selected with.
function tabLink(value, label) {
  return '<button class="navChip" onclick="showCategory(\'' + value + '\')">' + svEsc(label) + '</button>';
}
// A card on the sheet already showing: open it where it stands.
// In running text, so it is a link and not a chip: the Spells intro ends in
// one, and as a chip it broke the sentence.
function cardLink(id, label) {
  return '<button class="svLink" onclick="mechGo(\'' + id + '\')">' + svEsc(label) + '</button>';
}
// The rule behind a skill, wherever that rule now lives.
function ruleLink(id) {
  const moved = MECH_MOVED[id];
  return moved ? tabLink(moved[0], moved[1]) : mechLink(id, 'Mechanics › ' + id);
}

/* What a skill or a spell is made of.

   Both are a class in subindex 25 -- the script that is the thing itself,
   already named on the card's own summary as "the script" -- plus the 32x16
   icon it wears, which is subindex 137, icon n belonging to class 0x1A00|n.
   The icon is the part that had no way in: until 13 September 2026 no tab
   claimed 137 at all, so nothing could chip at it.

   The strip says what is NOT already on the summary, which is why the script
   is absent from it. */
function classIconResid(resid) { return 0x8A00 | (resid & 0xFF); }

function skillSpellParts(resid) {
  const chips = [];
  const icon = classIconResid(resid);
  if (refExists(icon)) chips.push(partChip('Icon', icon));
  return chips;
}

/* A section built above a gallery, as the Writings and Dialogue tabs do.
   #sheetGrid is a tile grid, so the card goes in a .mechView, which spans
   every column and centres itself the way a sheet does. */
function mechCardAboveGallery(grid, build) {
  let el = null;
  try { el = build(); } catch (e) { return; }
  if (!el) return;
  const box = document.createElement('div');
  box.className = 'mechView';
  box.appendChild(el);
  grid.insertBefore(box, grid.firstChild);
}

/* What the Mechanics sheet is divided into, in the order it is shown.
   The maintainer's grouping, 13 September 2026. Each entry is a title, a
   line saying what the group is, and the section ids in it; a section not
   named here still appears, under Other.

   Hackery is the group for the parts of the scenario that are machinery
   rather than rules: how a record is laid out, what a use can be aimed at,
   what an egg does, what calls what, and the places the file does not add
   up. */
const MECH_GROUPS = [
  { value: 'MECH_PROGRESS', title: 'Progress', tile: 0x240,
    note: 'What a character gains, and what it costs to be taught.',
    ids: ['experience', 'karma', 'training', 'todo'] },
  { value: 'MECH_STATUS', title: 'Status', tile: 0x3CE,
    note: 'Food, healing, potions, sleep, time, swamp, lava and light.',
    ids: ['food', 'hunger', 'potions', 'status', 'clock', 'sleep', 'ground', 'light'] },
  { value: 'MECH_INTERACT', title: 'Interactions', tile: 0x29D,
    note: 'What a thing does when it is used.',
    ids: ['target', 'locks', 'springs'] },
  { value: 'MECH_PUZZLES', title: 'Puzzles', tile: 0x266,
    note: 'How each puzzle works.',
    ids: ['braziers', 'buttons', 'riddles', 'tunes', 'thinkadot', 'signals'] },
  { value: 'MECH_COMBAT', title: 'Combat', tile: 0x21E,
    note: 'What a blow does, who swings it, and what it does to a thing.',
    ids: ['combat', 'combatai', 'damage', 'gear'] },
  { value: 'MECH_ECONOMY', title: 'Economy', tile: 0x82E,
    note: 'What things cost, and what a wager pays.',
    ids: ['shops', 'dice'] },
  { value: 'HACKERY', title: 'Hackery', tile: 0x207,
    note: 'How the scenario works underneath, and the places where it does not add up.',
    ids: ['propword', 'charflags', 'classflags', 'eggs', 'palette', 'syscalls', 'leans', 'loose'] },
];
/* The sections that write a file rather than read a rule: a patch opened
   and applied, a sprite made into one, and one file compared with another.
   They were the tail of Hackery until 22 September 2026, when the maintainer
   moved them to the Tools tab, and every one of them reads or makes a patch,
   so on 27 September 2026 they became Data › Patches, a tab of their own
   among the files (the maintainer). They are still built by
   renderMechanicsSheet, which is where the reading they share lives, and
   drawn only by that tab, so the group is kept apart from MECH_GROUPS: a
   Mechanics tab never lists it and the whole-sheet view does not include
   it. */
const MECH_TOOL_GROUP = { value: 'PATCHES', title: 'Patches',
  note: 'Cythera\u2019s official add-on system is the PowerPC application Magpie. It was released by Glenn Andreas alongside a sample patch \u201cPumpkin Patch\u201d, but specifications to create new patches were never released. The format has been reverse-engineered to make new patches possible, though Magpie is limited to editing the data fork of the Cythera Data file.',
  ids: ['patchkinds', 'patches', 'datafixes', 'herosprite', 'gremlins', 'appfixes', 'spanish', 'compare'] };
// A group by the category value its tab is selected with.
const MECH_GROUP_BY_VALUE = {};
for (const g of MECH_GROUPS) MECH_GROUP_BY_VALUE[g.value] = g;
/* Which tab a section is on now.

   This is the whole of what lets a link keep working across the split: a
   section id never changes, so mechLink asks this which tab to open rather
   than naming one. A section in no group answers null and its link falls back
   to the first tab, which is wrong but visible; the smoke requires every
   built section to be in a group so that never ships. */
function mechGroupOf(id) {
  for (const g of MECH_GROUPS) if (g.ids.indexOf(id) >= 0) return g;
  if (MECH_TOOL_GROUP.ids.indexOf(id) >= 0) return MECH_TOOL_GROUP;
  return null;
}
