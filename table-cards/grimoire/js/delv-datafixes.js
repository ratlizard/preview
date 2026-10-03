/* delv-datafixes.js -- fixes to Cythera Data, as data.

   Every change this project makes to the scenario to fix it, one entry a
   fix, in the form js/delv-datapatch.js applies, the Patches section offers
   one by one, and the builders in `utilities/` write out as the patches
   they always made. This is the file to edit: add an entry, change an
   edit, drop one. Nothing here is the file's bytes except the text and the
   instructions each edit expects to find, which is what makes a wrong file,
   or one patched already, refuse rather than patch. The causes are in the
   workbench's doc/bugs.md, under the title each entry's comment names.

   They were eleven Node builders from 24 to 28 September 2026, each writing
   its own Magpie patch, and a twelfth, combined_patch.mjs, chaining seven of
   them into "Cythera All Fixes". They moved here on 28 September 2026 so
   that a visitor can choose them one at a time; each builder now names its
   stage here and writes the same patched file it wrote before (compared
   byte for byte on the day).

   AN ENTRY.
     id, title   a name that does not change, and one line of what it does,
                 as the player would see it
     group       which list the Patches section shows it in (DATA_FIX_GROUPS)
     stage       when it is applied (DATA_FIX_STAGES, below)
     edits, dataEdits, textEdits
                 js/delv-datapatch.js's three kinds of edit
     plan(s, ctx)
                 in place of the lists, for edits found in the file rather
                 than given: returns { edits, dataEdits, textEdits }, read
                 off the session `s` as the stage finds it; ctx.chosen is the
                 set of fixes chosen
     parts       [{ stage, edits, ... }]: a fix whose edits were built in two
                 stages (the keywords typed with a space)
     parent      an option of another fix, in effect only with it (the text's)
     choice      options sharing a choice exclude each other (the spelling)
     played      where and how the fix was seen working in the game, the
                 shipped file beside it showing the bug; with none the
                 Patches section marks it "(untested)" (the maintainer, 30
                 September 2026). "In part" leaves the mark off: the text,
                 some of whose lines he has read in play.

   THE STAGES, AND WHY THIS ORDER (combined_patch.mjs's, 25 September 2026).
   A Magpie patch carries whole resources, so two patches that touch one
   script cannot both apply: the second replaces the first's copy of it. The
   stages are applied one after another to the same file instead, and the
   order is the point. The three code stages go first, because their edits
   are anchored to offsets and say what they expect to find there; every
   edit checks those expectations, so a stage that found its script moved
   stops the build rather than write something wrong. Bryce's six come after
   the community's fixes because both change Aethon's script, his edit near
   its start (0x0078) and theirs further on (0x0765): only in that order does
   the earlier edit leave the later one's offsets where it expects them. The
   further fixes come after the three, because they share scripts with all of
   them (Crito, Apis and Parium with the community's, Demodocus with the
   found, Paris with Bryce's) and find each place by its instructions rather
   than by an offset, so they can follow any of them; put first, they would
   move the offsets the others expect. The two text stages go last because
   they find their words rather than their offsets. The community's typo list
   comes after this project's text fixes: where both fix one sentence, the
   text stage's wording stands and the list finds the place fixed already or
   not at all (three places when this was written: "take the road" in Kosha,
   "quaters" in Pnyx, "kind looking" in Bryaxis's description). The spelling
   comes after the list (28 September 2026; it was part of the text stage
   before): the list finds each typo by the words around it as the game has
   them, and the British spelling changed a word beside Bryaxis's "ones",
   which was then not found. The American spelling changes none, so "All
   Fixes" came out the same either way. The map stage
   could come anywhere: it changes two maps, 0x8006 and 0x801F, which no
   other stage touches, and it finds its squares by the tiles on them. The
   three larger changes were patches of their own at the maintainer's word,
   each touching one resource no other fix does (the kill helper, the spell,
   the character table), and came after everything until 29 September 2026;
   they come before the text now, since the olde spelling's "ye" changes
   words in the kill helper's and the spell's own lines, which moved the
   offsets Resurrection's edit is anchored to. No text stage touches their
   code, so with any other spelling the file is the same either way.

   Any subset of the fixes applies, because every edit checks what it
   expects: an edit that depends on another stops the build by name rather
   than guess. utilities/data_fix_check.mjs holds that to every fix alone,
   every fix together, and each left out.

   NOT HERE. The program's own fixes (js/delv-appfixes.js), which no Magpie
   patch reaches: Magpie imports one Resource Manager call and it is a read.
   "Beserk", "celstial" and the rest of the program's strings, for the same
   reason. The jokes and the recastings (Sour Grapes, the Voices of the Hall,
   the Strine opening), which are builders of their own and no fix. */

const DATA_FIX_STAGES = ['found', 'community', 'bugfix', 'further', 'apart', 'text', 'community-text', 'spelling', 'map'];
// The stages whose edits are found in the file, and so are sorted before
// they are applied (js/delv-datapatch.js).
const DATA_FIX_STAGE_SORTED = ['further'];

// The Patches section's lists, in its order. By what a fix touches since
// 1 October 2026, at the maintainer's word; until then they were by who
// found each fix, which the stages and the comments below still record.
// The three larger changes (the stage "apart") went into the lists the
// same day.
const DATA_FIX_GROUPS = [
  { id: 'talk', title: 'Conversations' },
  { id: 'quests', title: 'Quests and the To Do list' },
  { id: 'rules', title: 'Spells, skills and fighting' },
  { id: 'items', title: 'Items' },
  { id: 'world', title: 'People and places' },
  { id: 'text', title: 'Text' },
  // The larger changes, each a design call rather than a mended slip, in a
  // list of their own below the rest (the maintainer, 1 October 2026).
  { id: 'design', title: 'Design Changes', note: 'These are not bug fixes: each changes how the game’s design has it behave.' },
];

// The text's choices, by the name their options share, as the Patches
// section labels each row of buttons, in its order.
const DATA_FIX_CHOICES = [
  { id: 'spelling', title: 'Spelling' },
  { id: 'two-taled', title: 'The Two-Taled Rat' },
  { id: 'land-king', title: 'Land King' },
  { id: 'areithous', title: 'Areithous' },
  { id: 'hyphens', title: 'Hyphens' },
];

function dataFixKeyword(what, resid, at, kw, target) {
  return { what, resid, at, replaceOp: true, expect: { [at]: 'conversation_response' }, code: `conversation_response "${kw}" -> ${target}` };
}
function dataFixTalk(who, slot) { return `sys TalkParticipant\n${who}\nbyte 0x0${slot}\nend`; }
function dataFixT(what, resid, find, replace, count) {
  const e = { what, resid, find, replace };
  if (count !== undefined) e.count = count;
  return e;
}
// A plan's edits, found by the run of instructions around each place.
function dataFixReplaceOp(s, what, resid, seq, k, code) {
  const p = dataPatchPlace(s, what, resid, seq);
  return { what, resid, at: p.at(k), replaceOp: true, expect: p.expect, code };
}
function dataFixInsert(s, what, resid, seq, k, code, shiftAt) {
  const p = dataPatchPlace(s, what, resid, seq);
  const e = { what, resid, at: p.at(k), expect: p.expect, code };
  if (shiftAt) e.shiftAt = true;
  return e;
}
function dataFixRekey(s, what, resid, from, to, after) {
  const p = dataPatchPlace(s, what, resid, ['conversation_response "' + from + '" ->'].concat(after || []));
  return { what, resid, at: p.at(0), replaceOp: true, expect: p.expect, code: p.text(0).replace('"' + from + '"', '"' + to + '"') };
}
function dataFixTarget(t) { return parseInt(/-> (0x[0-9A-F]+)$/i.exec(t)[1], 16); }
function dataFixHex(v) { return '0x' + v.toString(16).toUpperCase(); }
// A function's locals are the third byte of its header: the function
// holding `containing`, as the stage found it, given more.
function dataFixLocals(s, what, resid, containing, from, to) {
  const f = dataPatchListing(s, resid).fns.find(f => containing >= f.st && containing < f.en);
  if (!f || f.locals !== from) throw new Error(what + ': the function has ' + (f && f.locals) + ' locals, not ' + from);
  const at = f.st + 2;
  return { what, resid, fn: (b) => { if (b[at] !== from) throw new Error('the header is not what the page read'); b[at] = to; return 'locals ' + from + ' to ' + to; } };
}
// A line that waits for a click: a `*` after it.
function dataFixClick(what, resid, line) { return { what, resid, find: line, replace: line + '*', count: 1 }; }

// The resurrection fix's edits, as the shipped file has them; the fix's
// plan moves them to where an earlier stage left the code.
const DATA_FIX_RESURRECTION = {
  edits: (() => {
      // Hector, Meleager, Ariadne, Timon, Aethon, Dryas.
      const JOINERS = [0x06, 0x22, 0x35, 0x4A, 0x61, 0x62];
      const isJoiner = JOINERS.map((c, k) => ['arg Arg01', 'get_field data1 (0x6)', 'byte 0x' + c.toString(16).toUpperCase().padStart(2, '0'), 'eq'].concat(k ? ['or'] : [])).flat();
      const setField = (field, target, value) => ['set_field ' + field, target, 'end'].concat(value, ['end']);
      return [{
        what: 'the raised stand where the corpse lay, sacks packed, companions back in the party',
        resid: 0x1A2F, at: 0x0112, to: 0x014B,
        expect: { 0x0112: 'set_local 0x01', 0x0114: 'sys RecursiveContainerIterator', 0x011C: 'arg Arg01',
                  0x012C: 'set_field container', 0x0132: 'set_field flags', 0x0136: 'byte 0x10',
                  0x0145: 'branch', 0x0148: 'sys Delete', 0x0149: 'arg Arg01', 0x014B: 'branch' },
        code: [
          // 1: one level of the corpse.
          'set_local 0x01', 'sys ContainerIterator', 'word &Var1', 'byte 0x00', 'arg Arg01', 'end', 'end',
          'next:',
          'if', 'sys ContainerIterator', 'word &Var1', 'byte 0x01', 'end', 'then -> packed',
          ...setField('container (0xB)', 'local Var01', ['local Var00']),
          ...setField('flags (0x0)', 'local Var01', ['byte 0x10']),
          'set_local 0x01', 'sys ContainerIterator', 'word &Var1', 'byte 0x02', 'end', 'end',
          'branch next',
          'packed:',
          // 2: the map record on the corpse's square, waiting to be drawn.
          'set_local 0x04', 'local Var00', 'cast Prop (0x0)', 'end',
          ...setField('x (0x1)', 'local Var04', ['arg Arg01', 'get_field x (0x1)']),
          ...setField('y (0x2)', 'local Var04', ['arg Arg01', 'get_field y (0x2)']),
          ...setField('flags (0x0)', 'local Var04', ['byte 0x42']),
          ...setField('x (0x1)', 'local Var00', ['arg Arg01', 'get_field x (0x1)']),
          ...setField('y (0x2)', 'local Var00', ['arg Arg01', 'get_field y (0x2)']),
          // 3: a companion who died in the party rejoins it.
          'if_not', ...isJoiner,
          'local Var00', 'get_field behavior (0x15)', 'byte 0x01', 'ge', 'and',
          'local Var00', 'get_field behavior (0x15)', 'byte 0x0D', 'le', 'and',
          'then -> gone',
          'sys JoinParty', 'local Var00', 'end',
          'gone:',
          'sys Delete', 'arg Arg01', 'end',
        ].join('\n'),
      }];
    })(),
    dataEdits: [{ what: 'UseOn has a fifth local', resid: 0x1A2F, fn: (b) => {
      if (b[0xA2] !== 4) throw new Error('UseOn has ' + b[0xA2] + ' locals, not 4');
      b[0xA2] = 5; return 'locals 4 to 5';
    } }] };

const DATA_FIXES = [

  /* ---- Found in the files (the stage "found"; found_fixes_patch.mjs,
     "Cythera Found Fixes") ------------------------------------------------
     The bugs this project found in the scripts and tables itself, whose
     cause and intended behaviour are both clear (24 September 2026, at the
     maintainer's word). */

  // Ake's To Do line (0x1820): her Comana errand added line 114, "Ask
  // Thuria about Iron Mine"; it adds 113, "Ask Halos about Comana", the line
  // Propontis adds for the same errand. (bugs.md, *Ake's To Do line names
  // the wrong informant*.)
  { id: 'ake-todo', group: 'quests', stage: 'found', title: 'Ake\u2019s errand now adds the To Do line that names Halos, instead of the one that names Thuria',
    edits: [
      { what: 'Ake’s To Do line', resid: 0x1820, at: 0x0109, replaceOp: true, expect: { 0x0101: 'sys AddQuest', 0x0102: 'byte 0x0A', 0x0109: 'byte 0x72' }, code: 'byte 0x71' },
    ] },
  // Sleep's magic bonus (0xE93): the guard and the cap both read full
  // health where full magic is meant; both now read full magic.
  { id: 'sleep-magic', group: 'rules', stage: 'found', title: 'Sleep now restores magic up to full magic, instead of up to full health',
    edits: [
      { what: 'sleep’s magic cap', resid: 0xE93, at: 0x0248, replaceOp: true, expect: { 0x0248: 'get_field full_health', 0x024E: 'set_field magic' }, code: 'get_field full_magic (0x1F)' },
      { what: 'sleep’s magic guard', resid: 0xE93, at: 0x0219, replaceOp: true, expect: { 0x0216: 'get_field magic', 0x0219: 'get_field full_health', 0x021B: 'lt' }, code: 'get_field full_magic (0x1F)' },
    ] },
  // The bartenders' rumours (0x813): the choice between the town's own
  // rumours and the general ones rolled Random(0, 1), which is always 0; it
  // rolls Random(0, 2), so both are heard.
  { id: 'rumours', group: 'talk', stage: 'found', title: 'Bartenders now tell the general rumours as well as their town\u2019s, instead of their town\u2019s alone',
    edits: [
      { what: 'the bartenders’ rumours', resid: 0x813, at: 0x02AB, replaceOp: true, expect: { 0x02A8: 'sys Random', 0x02A9: 'byte 0x00', 0x02AB: 'byte 0x01' }, code: 'byte 0x02' },
    ] },
  // Eating (0xE46): the nutrition's jitter, Random(0, 1) - Random(0, 1), was
  // always 0; it rolls Random(0, 2) twice, so it is -1, 0 or 1.
  { id: 'eating', group: 'items', stage: 'found', title: 'What a meal is worth now varies by one either way, as written, instead of never varying',
    edits: [
      { what: 'eating, second roll', resid: 0xE46, at: 0x0040, replaceOp: true, expect: { 0x003D: 'sys Random', 0x0040: 'byte 0x01' }, code: 'byte 0x02' },
      { what: 'eating, first roll', resid: 0xE46, at: 0x0039, replaceOp: true, expect: { 0x0036: 'sys Random', 0x0039: 'byte 0x01' }, code: 'byte 0x02' },
    ] },
  // The Gate Guard's speaker (0x1864): one reply was given to character 54,
  // the Odemia Guard; it is given to himself. The two share a portrait, so
  // nothing changes on screen, but the number is right.
  { id: 'gate-guard', group: 'talk', stage: 'found', title: 'A reply of the Gate Guard\u2019s is now spoken by him, instead of by the Odemia Guard',
    edits: [
      { what: 'the Gate Guard speaks', resid: 0x1864, at: 0x058D, replaceOp: true, expect: { 0x058C: 'sys TalkParticipant', 0x058D: 'short 0x0036', 0x0590: 'byte 0x00' }, code: 'arg Arg00' },
    ] },
  // Water into a full pitcher (0xE0A): the water helper printed "The
  // pitcher is already full." and ran on to "You can't use water there...",
  // having no return after the line; it returns False there, as the milk
  // (0xE0B) and wine (0xE0D) helpers do after the same line. (27 September
  // 2026, found while reading every UseOn that deletes one of its
  // arguments; 0xE0A is the one helper among them that does.)
  { id: 'water-full-pitcher', group: 'items', stage: 'found', title: 'Water poured into a full pitcher now stops at \u201cThe pitcher is already full.\u201d, instead of going on to \u201cYou can\u2019t use water there...\u201d',
    edits: [
      { what: 'water into a full pitcher', resid: 0xE0A, at: 0x00EA, expect: { 0x00CD: 'string(implicit) "The pitcher is already full.', 0x00EA: 'branch 0x0121', 0x00ED: 'string(implicit) "The pitcher is now filled with water' },
        code: 'return\nword False\nend' },
    ] },
  // A pitcher dipped in the wine urn (0x10A0): an empty pitcher used on a
  // fountain, a pool or the water urn fills with water, and on anything else
  // but a well or a goat said "The pitcher is empty.", the wine urn (217)
  // included, though the urn used on the pitcher fills it. It fills with wine
  // now, Data1 3, the pitcher's own number for wine, with a line shaped like
  // its water line. The test goes where the goat test's "no" already lands,
  // so the rest of the chain is untouched. (The maintainer's word, 27
  // September 2026.)
  { id: 'pitcher-in-wine', group: 'items', stage: 'found', title: 'An empty pitcher dipped in the wine urn now fills with wine, instead of saying \u201cThe pitcher is empty.\u201d',
    edits: [
      { what: 'a pitcher dipped in wine', resid: 0x10A0, at: 0x01FD,
        expect: { 0x01B9: 'then -> 0x01FD', 0x01FA: 'branch 0x0213', 0x01FD: 'string(implicit) "The pitcher is empty.', 0x0213: 'return' },
        code: ['if_not', 'arg Arg01', 'get_field obj_type (0x4)', 'short 0x00D9', 'eq', 'then -> empty',
          'set_field data1 (0x6)', 'arg Arg00', 'end', 'byte 0x03', 'end',
          'string(implicit) "The pitcher is now full of wine.\\n"', 'branch 0x0213', 'empty:'].join('\n') },
    ] },

  /* ---- Reported by players (the stage "community";
     community_fixes_patch.mjs, "Cythera Community Fixes") ------------------
     The bugs the community reported that Bryce Schroeder's patch does not
     touch, whose cause and intended behaviour are both clear from the files
     (24 September 2026, at the maintainer's word; more on the 27th and 28th,
     the last from the compendium's entries the bug list had not taken in). */

  // Sword, Axe and Mace training (0xE87). The melee resolver adds the
  // weapon's skill twice, and both reads take the skill off the shield
  // loop's leftover variable; each now reads it off the weapon (Arg02).
  { id: 'weapon-skill', group: 'rules', stage: 'community', title: 'Sword, Axe and Mace skill now counts in a fight, instead of counting for nothing',
    edits: [
      { what: 'weapon skill, damage', resid: 0xE87, at: 0x0096, replaceOp: true, expect: { 0x0096: 'local Var02', 0x0097: 'class_member 0x2A03' }, code: 'arg Arg02' },
      { what: 'weapon skill, margin', resid: 0xE87, at: 0x0088, replaceOp: true, expect: { 0x0088: 'local Var02', 0x0089: 'class_member 0x2A03' }, code: 'arg Arg02' },
    ] },
  // "Indeed I am." was drawn as the hero's (0x1804): the string is split and
  // Hadrian named between the halves.
  { id: 'hadrian-indeed', group: 'talk', stage: 'community', title: '\u201cIndeed I am.\u201d is now spoken by Hadrian, instead of by the hero',
    edits: [
      { what: '"Indeed I am." is Hadrian’s', resid: 0x1804, at: 0x02A9, to: 0x02E0,
        expect: { 0x02A9: 'string(implicit) "\\"Yes, you should be quite proud.\\"*\\"Indeed I am.\\""', 0x02D9: 'sys TalkParticipant', 0x02E0: 'branch' },
        code: `string(implicit) "\\"Yes, you should be quite proud.\\"*"\n${dataFixTalk('short 0x0004', 0)}\nstring(implicit) "\\"Indeed I am.\\""` },
    ] },
  // Hadrian asks after Hector (0x1804): his "son" topic tested his own alive
  // bit; it tests Hector's.
  { id: 'hadrian-hector', group: 'talk', stage: 'community', title: 'Hadrian now learns that Hector has died, instead of always speaking of him as alive',
    edits: [
      { what: 'Hadrian tests Hector', resid: 0x1804, at: 0x0299, replaceOp: true, expect: { 0x0299: 'word Character.Hadrian', 0x029F: 'if_not' }, code: 'word Character.Hector' },
    ] },
  // Aethon told to leave (0x1861): "Maybe it is time for me to catch some
  // rats for myself..." is followed by LeaveParty, as Hector's is.
  { id: 'aethon-leaves', group: 'talk', stage: 'community', title: 'Aethon now leaves the party when he says he will, instead of staying',
    edits: [
      { what: 'Aethon leaves', resid: 0x1861, at: 0x0765, replaceOp: true, expect: { 0x072B: 'string(implicit) "\\"Maybe it is time', 0x0765: 'branch' },
        code: 'sys LeaveParty\narg Arg00\nend\nreturn\nbyte 0x00\nend' },
    ] },
  // Alaric forgets 201 (0x1802): the "hist" topic's test of his flag 2 was
  // the wrong way round; a `not` turns it.
  { id: 'alaric-201', group: 'talk', stage: 'community', title: 'Alaric now remembers 201 after recalling it, instead of forgetting it straight away',
    edits: [
      { what: 'Alaric remembers 201', resid: 0x1802, at: 0x1F3B, expect: { 0x1F34: 'call_resource 0xF02', 0x1F3B: 'then' }, code: 'not' },
    ] },
  // Awakening's blank conversation (0x1A13): the sleeper and the hero are
  // named as speakers before the sleeper's Talk, as the game's own Talk
  // command names them.
  { id: 'awakening', group: 'rules', stage: 'community', title: 'You can now talk to someone woken by Awakening, instead of getting a blank conversation',
    edits: [
      { what: 'Awakening names its speakers', resid: 0x1A13, at: 0x00D7, expect: { 0x00D5: 'sys OpenConversation', 0x00D7: 'method Talk' },
        code: dataFixTalk('arg Arg01', 0) + '\n' + dataFixTalk('global PlayerCharacter (0x5)', 2) },
    ] },
  // Niobe's answers drawn as Helen's (0x1859): Niobe is named again after
  // Helen's interruption.
  { id: 'niobe', group: 'talk', stage: 'community', title: 'Niobe\u2019s answers after Helen interrupts are now drawn as hers, instead of as Helen\u2019s',
    edits: [
      { what: 'Niobe speaks for herself', resid: 0x1859, at: 0x013F, expect: { 0x0127: 'string(implicit) "man with your nonsense', 0x013F: 'exit' }, code: dataFixTalk('arg Arg00', 0) },
    ] },
  // Lindus nags for ever (0x1850): the training route that hands over the
  // grimoire now sets quest flag 1 and strikes the To Do line, as accepting
  // at the first meeting does.
  { id: 'lindus', group: 'quests', stage: 'community', title: 'Lindus now stops nagging once he has handed over the grimoire, instead of nagging for ever',
    edits: [
      { what: 'Lindus’s training route', resid: 0x1850, at: 0x05C9, expect: { 0x05C6: 'then', 0x05C9: 'string(implicit) "*\\"The most prized possession' },
        code: 'sys SetStateFlag\nbyte 0x01\nword True\nend\nsys CompleteQuest\nbyte 0x02\nend' },
    ] },
  // Keywords typed with a space: "inn, pari" and its kind lose the space
  // after the comma, so the word after it answers without a space typed
  // first. Five lists the board reported (0x1828, 0x1829, 0x182A, 0x1818,
  // 0x080F), and two this project found (0x186D Demodocus's "fish, tlep",
  // 0x1878 Sabinate's "form, shap"), which were built in the found stage.
  { id: 'keyword-spaces', group: 'talk', title: 'Seven keywords now answer without a space typed first, instead of only after one',
    parts: [
      { stage: 'found', edits: [
        dataFixKeyword('Demodocus’s "tlep"', 0x186D, 0x155F, 'fish,tlep', '0x15E0'),
        dataFixKeyword('Sabinate’s "shap"', 0x1878, 0x0975, 'form,shap', '0x0A11'),
      ] },
      { stage: 'community', edits: [
        dataFixKeyword('Apis’s name', 0x182A, 0x0596, 'inn,apis', '0x0628'),
        dataFixKeyword('Parium’s name', 0x1828, 0x03A0, 'inn,pari', '0x0442'),
        dataFixKeyword('Crito’s name', 0x1829, 0x05F3, 'inn,crit', '0x0695'),
        dataFixKeyword('Eurybates’s name', 0x1818, 0x009E, 'name,eury', '0x00C6'),
        dataFixKeyword('the Seldane’s "corruption"', 0x080F, 0x00C6, 'crol,corr', '0x0140'),
      ] },
    ] },
  // Sabinate's mushroom every time (0x1878): his flag 4 is set when the
  // mushroom is given.
  { id: 'sabinate-mushroom', group: 'quests', stage: 'community', title: 'Sabinate now hands over his mushroom once, instead of every time',
    edits: [
      { what: 'Sabinate remembers the mushroom', resid: 0x1878, at: 0x0966, expect: { 0x0966: 'sys Create', 0x096A: 'short 0x010F' },
        code: 'call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x04\nend' },
    ] },
  // The rolling pin vanishing (0x10A3): the dough is deleted, not the pin.
  { id: 'rolling-pin', group: 'items', stage: 'community', title: 'Kneading now uses up the dough, instead of the rolling pin',
    edits: [
      { what: 'the rolling pin', resid: 0x10A3, at: 0x0162, replaceOp: true, expect: { 0x0131: 'string(implicit) "You end up kneading', 0x0161: 'sys Delete', 0x0162: 'arg Arg00' }, code: 'arg Arg01' },
    ] },
  // The wine urn's empty pitcher (0xE0D): the pitcher's Data1 is set to 3,
  // as the water helper sets 1 and the milk helper 2. The pitcher (0x10A0)
  // reads 0 to 3 as empty, water, milk and wine, in its Examine and Use
  // tables and in its UseOn, which pours wine through this helper only at 3.
  // This edit set 1 until 27 September 2026, which filled the pitcher with
  // water.
  { id: 'wine-urn', group: 'items', stage: 'community', title: 'The wine urn now fills a pitcher with wine, instead of leaving it empty',
    edits: [
      { what: 'the wine urn', resid: 0xE0D, at: 0x0061, expect: { 0x003C: 'string(implicit) "The pitcher is now filled with wine', 0x0061: 'return' },
        code: 'set_field data1 (0x6)\narg Arg00\nend\nbyte 0x03\nend' },
    ] },
  // "You can't stuff the carcass!" on every check (0x10D2): the inventory
  // window asks member 23 of the thing under the cursor each time it checks
  // a drop, and the carcass's answer printed the line; the refusal no longer
  // prints.
  { id: 'carcass', group: 'items', stage: 'community', title: 'Dragging something over a carcass is now quiet, instead of printing \u201cYou can\u2019t stuff the carcass!\u201d at every check',
    edits: [
      { what: 'the carcass', resid: 0x10D2, at: 0x0049, to: 0x0066, expect: { 0x0049: 'string(implicit) "You can\'t stuff the carcass', 0x0066: 'return' }, code: '' },
    ] },
  // A thrown weapon lost on a hit (0x3042): flags 0x10 with an inventory
  // square and PutInside, as Bryce's Fetch fix places a thing, in place of
  // flags 9. The least certain edit here: it follows Fetch's pattern and was
  // not tried in play.
  // A corpse of nobody raised (0x1A2F, the spell; 0x10F4, the Land King
  // Amulet; 30 September 2026, the maintainer's word of 28 September). Both
  // take the corpse's Data1 as the character to raise, and a corpse whose
  // Data1 is 0 names nobody: every killed creature's (Die writes 0 into the
  // map record it turns into the corpse), and the Land King Hall spy's body,
  // which the board took for Aeneas [453@t2023]. Character(0) is character
  // 0, a real record, so the "Nothing happens." the scripts keep for no
  // character was never reached: the corpse was deleted, its things handed
  // to character 0 and character 0 "raised". Now a corpse of Data1 0 says
  // "Nothing happens." and is left as it lay with its things. The spell's
  // mana is spent in Use before this runs, as for any other target; the
  // amulet returns before its charge is taken (a rock still costs one, as
  // shipped). Kept in "All Fixes" and in "Cythera Resurrection Fix" both,
  // which is why the resurrection fix finds its place rather than assuming it.
  { id: 'nobody-corpse', group: 'rules', stage: 'community', title: 'Raising a corpse that belongs to nobody now does nothing, instead of taking its things away',
    edits: [
      { what: 'the spell, a corpse of nobody', resid: 0x1A2F, at: 0x00D5,
        expect: { 0x00CD: 'set_local 0x00', 0x00D0: 'get_field data1', 0x00D2: 'cast Character', 0x00D5: 'if_not', 0x00D6: 'local Var00', 0x014E: 'string(implicit) "Nothing happens.' },
        code: ['if', 'arg Arg01', 'get_field data1 (0x6)', 'then -> someone',
          'string(implicit) "Nothing happens.\\n"', 'return', 'byte 0x00', 'end', 'someone:'].join('\n') },
      { what: 'the amulet, a corpse of nobody', resid: 0x10F4, at: 0x018F,
        expect: { 0x0187: 'set_local 0x00', 0x018A: 'get_field data1', 0x018C: 'cast Character', 0x018F: 'if_not', 0x0190: 'local Var00', 0x023C: 'string(implicit) "Nothing happens.' },
        code: ['if', 'arg Arg01', 'get_field data1 (0x6)', 'then -> someone',
          'string(implicit) "Nothing happens.\\n"', 'return', 'byte 0x00', 'end', 'someone:'].join('\n') },
    ] },
  { id: 'thrown-weapon', group: 'rules', stage: 'community', title: 'A thrown dagger or spear that kills is now kept, instead of lost',
    edits: [
      { what: 'a thrown weapon, placed', resid: 0x3042, at: 0x0158, expect: { 0x0150: 'set_field container', 0x0158: 'branch' },
        code: 'set_field x (0x1)\nlocal Var03\nend\nbyte 0x00\nend\nset_field y (0x2)\nlocal Var03\nend\nbyte 0x01\nend\nmethod PutInside (0x10)\nlocal Var03\nend' },
      { what: 'a thrown weapon, carried', resid: 0x3042, at: 0x014D, replaceOp: true, expect: { 0x0149: 'set_field flags', 0x014D: 'byte 0x09' }, code: 'byte 0x10' },
    ] },
  // The Pelagon ending's black screen (0x180D; 27 September 2026):
  // SpecialView(3) is the program's GammaFadeOut and SpecialView(4) its
  // GammaFadeIn (cbScreenFX's switch), and the other three endings fade out,
  // show the first slide, then fade back in; this one never fades in, so its
  // four slides are clicked through at black. SpecialView(4) goes after the
  // first slide, where Alaric's endings have it; a jump to the loop after it
  // still lands on the loop.
  { id: 'pelagon-ending', group: 'quests', stage: 'community', title: 'The Pelagon ending now fades in, instead of playing at black',
    edits: [
      { what: 'the Pelagon ending fades in', resid: 0x180D, at: 0x011B, shiftAt: true,
        expect: { 0x0109: 'sys SpecialView', 0x010A: 'byte 0x03', 0x010F: 'sys Slideshow', 0x011A: 'end', 0x011B: 'set_local 0x00' },
        code: 'sys SpecialView\nbyte 0x04\nend' },
    ] },
  // Eteocles's "kesh" (0x1838): the test reads quest flag 4 (Guild
  // membership), as his other five tests do, not quest value 4, which is
  // where Demodocus is and is never 0.
  { id: 'eteocles-kesh', group: 'talk', stage: 'community', title: 'Eteocles now answers \u201ckesh\u201d by whether you are in the Guild, instead of always the same way',
    edits: [
      { what: 'Eteocles’s "kesh"', resid: 0x1838, at: 0x01ED, replaceOp: true, expect: { 0x01E4: 'conversation_response "kesh"', 0x01ED: 'sys GetState', 0x01EE: 'byte 0x04' }, code: 'sys GetStateFlag' },
    ] },
  // The strange device left open across a zone change (0x1175; 28 September
  // 2026). A scripted window's buttons call back with the owner the window
  // had when each was made: the widget constructor copies the window's owner
  // number into its own word at 4, and TWidget::RenumberParent is an empty
  // routine. Moving the party between zones gives every carried thing a new
  // number (ShuffleUpPartyInventory, then the two moves in LoadLevelProps),
  // and RenumberProp moves the window's owner with it but not the buttons'
  // copies, so each click after it worked the storage of whatever thing now
  // held the old number and changed nothing. The routine the three buttons
  // share now checks that it was handed a strange device with its window
  // open (HasWindow, which is the program's ShowWindow) and otherwise walks
  // the party's things for the one that is, as Divide Food walks them; if
  // there is none it does nothing. Four more locals for the two loops. The
  // type is tested before HasWindow, since HasWindow brings a found window
  // to the front and an open sack's should stay where it is.
  { id: 'strange-device', group: 'items', stage: 'community', title: 'The strange device\u2019s buttons now work after a change of zone, instead of doing nothing',
    edits: [
      { what: 'the strange device finds itself', resid: 0x1175, at: 0x00C1,
        expect: { 0x00C1: 'set_local 0x00', 0x00C3: 'arg Arg00', 0x00C4: 'get_field storage', 0x00C6: 'word 256' },
        code: [
          'if_not', 'arg Arg00', 'get_field obj_type (0x4)', 'short 0x0175', 'eq', 'then -> search',
          'if', 'sys HasWindow', 'arg Arg00', 'end', 'then -> found',
          'search:',
          'set_local 0x05', 'sys PartyIterator', 'word &Var5', 'byte 0x00', 'word True', 'end', 'end',
          'party:',
          'if', 'sys PartyIterator', 'word &Var5', 'byte 0x01', 'end', 'then -> lost',
          'set_local 0x07', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x00', 'local Var05', 'end', 'end',
          'thing:',
          'if', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x01', 'end', 'then -> nextparty',
          'if_not', 'local Var07', 'get_field obj_type (0x4)', 'short 0x0175', 'eq', 'then -> nextthing',
          'if_not', 'sys HasWindow', 'local Var07', 'end', 'then -> nextthing',
          'set_local 0x30', 'local Var07', 'end',
          'branch found',
          'nextthing:',
          'set_local 0x07', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x02', 'end', 'end',
          'branch thing',
          'nextparty:',
          'set_local 0x05', 'sys PartyIterator', 'word &Var5', 'byte 0x02', 'end', 'end',
          'branch party',
          'lost:',
          'return', 'byte 0x00', 'end',
          'found:'].join('\n') },
    ],
    // The header of 0x00BE, the buttons' routine; its third byte is the
    // count of locals, and the loops above use locals 5 to 8.
    dataEdits: [
      { what: 'the strange device’s locals', resid: 0x1175, fn: (b) => {
          if (b[0xC0] !== 5) throw new Error('0x00BE has ' + b[0xC0] + ' locals, not 5');
          b[0xC0] = 9; return 'locals 5 to 9';
      } },
    ] },
  // People gone from the zone after a sleep (the sleep helper, 0xE93; 28
  // September 2026). A night is PassTime(1024) an hour, and DoTicks
  // schedules an hour passed in more than 100 ticks as instant:
  // RepositionChar then leaves anyone not yet hatched whose new post is out
  // of sight hidden (255) rather than an egg (66), which is what the draw
  // loop hatches; one already hatched is moved to the post. (This said on
  // first writing that the creature was taken off the map as well; the call
  // that would do it sits behind a test its branch has already failed and
  // never runs.) They came back only when a later hour, schedule while
  // awake, or a new visit to the zone put them there. The helper now runs
  // Reschedule (0xE0, ScheduleTime for the current hour, not instant) when
  // the night ends, and when an owner kicks the hero out of bed, so the
  // hidden are placed as eggs and hatch as the party comes near: the pass
  // the next waking hour would have run, run at once. The loop's exit lands
  // on the first, and nothing jumps to the second.
  { id: 'sleep-reschedule', group: 'world', stage: 'community', title: 'People are now back around the zone after a night\u2019s sleep, instead of missing until a later hour',
    edits: [
      { what: 'the sleepers rescheduled after a night', resid: 0xE93, at: 0x0160,
        expect: { 0x0151: 'set_local 0x03', 0x015D: 'branch', 0x0160: 'if_not', 0x0161: 'arg Arg03' },
        code: 'sys UnknownE0\nend' },
      { what: 'the sleepers rescheduled after a waking', resid: 0xE93, at: 0x013A,
        expect: { 0x0113: 'string(implicit) "You get kicked out of bed', 0x013A: 'sys SpecialView', 0x013B: 'byte 0x04' },
        code: 'sys UnknownE0\nend' },
    ] },
  // Rune of Warding says nothing (0x10F5; 28 September 2026). The spell
  // (0x1A16) makes the rune with New(33, x, y, 0, 245, CurrentCharacter, 0),
  // and cbcreateprop stores the sixth argument's low byte as Data1, so a
  // rune's Data1 is its caster's character number: 1 for the hero, 6 for
  // Hector. The rune's UseOn, which what steps on it runs (the default
  // StepOn, 0x301F), prints "Something has triggered one of your runes of
  // warding." only when Data1 is 32, which is Ake, so no rune the party
  // casts ever says it; the rune is deleted in silence, and the spell's own
  // description is "signals the caster when something steps on it". No map
  // places a rune and no shipped AI script casts one, so every rune is the
  // party's, and the test goes: the line always prints.
  { id: 'rune-of-warding', group: 'rules', stage: 'community', title: 'A rune of warding now says when something steps on it, instead of vanishing in silence',
    edits: [
      { what: 'the rune of warding signals', resid: 0x10F5, at: 0x0017, to: 0x0022,
        expect: { 0x0017: 'if_not', 0x0019: 'get_field data1', 0x001B: 'short 0x0020', 0x001E: 'eq', 0x001F: 'then',
                  0x0022: 'string(implicit) "Something has triggered one of your runes of warding' },
        code: '' },
    ] },
  // Pelagon back in the kesh lab (0xF00B): his schedule's flag-0 pair (off
  // every map) is moved in front of its quest-value pair.
  { id: 'pelagon-lab', group: 'world', stage: 'community', title: 'Pelagon now stays away from the kesh lab, instead of coming back to it',
    dataEdits: [
      { what: 'Pelagon’s schedule', resid: 0xF00B, fn: (b) => {
          const u16 = (b, o) => (b[o] << 8) | b[o + 1];
          let p = 512; for (let i = 0; i < 13; i++) p += 8 * u16(b, i * 2);
          if (u16(b, 26) !== 5) throw new Error('Pelagon has ' + u16(b, 26) + ' segments, not 5');
          const seg = k => Array.from(b.subarray(p + 8 * k, p + 8 * k + 8));
          const s = [0, 1, 2, 3, 4].map(seg);
          if (!(s[0][2] === 0x83 && s[0][3] === 3 && s[1][2] === 1 && s[2][2] === 0x40 && s[2][3] === 13 && s[2][4] === 255 && s[3][2] === 1)) throw new Error('Pelagon’s segments are not the shape expected');
          const order = [2, 3, 0, 1, 4];
          order.forEach((k, j) => b.set(s[k], p + 8 * j));
          return 'his flag-0 pair now comes before his quest-value pair';
      } },
    ] },
  // Only Philinus's panpipes work (0x8108): the two placed sets get Data1 1,
  // the set that can play PHJMD.
  { id: 'panpipes', group: 'items', stage: 'community', title: 'Every set of panpipes can now play the tune, instead of Philinus\u2019s alone',
    dataEdits: [
      { what: 'the placed panpipes', resid: 0x8108, fn: (b) => {
          let n = 0;
          for (const i of [402, 498]) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 153 || r[6] !== 0) throw new Error('record ' + i + ' is not a panpipes with Data1 0'); r[6] = 1; n++; }
          return n + ' sets given Data1 1';
      } },
    ] },
  // The magic arrow drawn as a stack (0x8103, and two Cademia stacks in
  // 0x8108): the count moves from Data1 to Data2.
  { id: 'arrow-stacks', group: 'items', stage: 'community', title: 'The magic arrow in Land King Hall now looks like one arrow, instead of a stack, and two stacks in Cademia look right',
    dataEdits: [
      { what: 'the Cademia arrow stacks', resid: 0x8108, fn: (b) => {
          const want = { 1155: 30, 1174: 20 }; let n = 0;
          for (const [i, c] of Object.entries(want)) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 102 || r[6] !== c || r[7] !== 0) throw new Error('record ' + i + ' is not an arrow with ' + c + ' in Data1'); r[6] = 0; r[7] = c; n++; }
          return n + ' stacks’ counts moved to Data2';
      } },
      { what: 'the Land King Hall magic arrow', resid: 0x8103, fn: (b) => {
          const r = b.subarray(632 * 16, 632 * 16 + 16);
          if (((r[4] << 8 | r[5]) & 0x3FF) !== 101 || r[6] !== 7 || r[7] !== 0) throw new Error('record 632 is not the magic arrow with 7 in Data1');
          r[6] = 0; r[7] = 7; return 'record 632’s count moved to Data2';
      } },
    ] },
  // Sacas's kesh on Eudoxus (0x8104): the five vials in the Abandoned
  // Farmhouse coffer get Data1 2, the value his line waits for.
  { id: 'eudoxus-kesh', group: 'quests', stage: 'community', title: 'You can now tell Sacas of the kesh on Eudoxus, instead of the vials never counting',
    dataEdits: [
      { what: 'Eudoxus’s kesh', resid: 0x8104, fn: (b) => {
          let n = 0;
          for (let i = 34; i <= 38; i++) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 298 || r[6] !== 0 || (r[0] & 0x08) === 0) throw new Error('record ' + i + ' is not a contained liquid with Data1 0'); r[6] = 2; n++; }
          return n + ' vials given Data1 2';
      } },
    ] },
  // Kilts inside kilts (0x810D): the four kilts inside record 676 go into
  // the dresser, record 673.
  { id: 'kilts', group: 'items', stage: 'community', title: 'The kilts in a Kosha dresser are now in the dresser, instead of inside a kilt',
    dataEdits: [
      { what: 'the kilts', resid: 0x810D, fn: (b) => {
          let n = 0;
          for (let i = 677; i <= 680; i++) { const r = b.subarray(i * 16, i * 16 + 16); const raw = (r[1] << 16) | (r[2] << 8) | r[3]; if (((r[4] << 8 | r[5]) & 0x3FF) !== 284 || r[0] !== 8 || (raw & 0xFFFF) !== 932) throw new Error('record ' + i + ' is not a kilt inside record 676'); r[2] = (929 >> 8) & 0xFF; r[3] = 929 & 0xFF; n++; }
          return n + ' kilts moved into record 673';
      } },
    ] },
  // The spent staff's light (0xF002): tile 0x88B's light level goes to 0.
  { id: 'spent-staff', group: 'items', stage: 'community', title: 'A spent staff now gives no light, instead of still giving light',
    dataEdits: [
      { what: 'the spent staff’s tile', resid: 0xF002, fn: (b) => {
          const o = 0x88B * 4; if ((b[o + 3] & 3) !== 1) throw new Error('tile 0x88B has light level ' + (b[o + 3] & 3) + ', not 1');
          b[o + 3] &= ~3; return 'tile 0x88B’s light level 1 cleared';
      } },
    ] },
  // The dead turning into other things (0xF008; 28 September 2026). A
  // creature's unit is ObjToMonst of its map record's prop type, read once,
  // when the creature is made (the TActiveMonster constructors and
  // HatchEgg), and ObjToMonst answers null for a type with no record here;
  // nothing checks. Two types a creature is made in have none: 264, "person
  // sleeping", which the default EveryTurn (0x3020) gives a sleeper in bed,
  // so anyone made while asleep -- a zone entered or a game loaded at night
  // -- is made without a unit; and 229, the Odemia night guard (its class
  // has member 55, so HatchEgg makes a creature of it). Die takes the
  // corpse's type and aspect from the unit's word at 14, so such a death made
  // a thing of whatever type the word at address 14 held, with Data1 the dead
  // one's number: the same wrong thing all session, a portal now and then,
  // which is every report on the board. Its flags and alignment came from
  // low memory the same way (a creature's stats come from its unit only
  // when it is built new; a named character keeps its own, and a creature
  // loaded from a save has its saved record back). Two records go in the
  // table's free slots, 50 and 51: 264 as a copy of the man's (a man's
  // corpse, a person's flags) and 229 as a copy of the guard's. No class
  // script sits at 0x1932 or 0x1933, which a unit's index would name. A
  // table can give every sleeper only the one unit, so a guard or a woman
  // made while asleep leaves a man's body and carries a man's flags; the
  // program fix sleeper-unit (js/delv-appfixes.js) looks up the sleeper's
  // own type instead, and this record is what is left for anything it
  // cannot name (30 September 2026).
  { id: 'sleeping-units', group: 'world', stage: 'community', title: 'People killed asleep, and the Odemia night guard, now leave a body, instead of turning into some other thing',
    played: 'fork, PowerPC, 30 September 2026: a sleeping guard killed leaves a man’s body and a night guard a guard’s, where the shipped file left none',
    dataEdits: [
      { what: 'units for the sleeping and the night guard', resid: 0xF008, fn: (b) => {
          const key = i => (b[i * 16 + 12] << 8) | b[i * 16 + 13];
          const word = (i, o) => (b[i * 16 + o] << 8) | b[i * 16 + o + 1];
          let n = 0; while (n < 128 && key(n)) n++;
          if (n !== 50) throw new Error('0xF008 has ' + n + ' units, not 50');
          const at = t => { for (let i = 0; i < n; i++) if (key(i) === t) return i; return -1; };
          if (at(264) >= 0 || at(229) >= 0) throw new Error('264 or 229 already has a unit');
          const man = at(48), guard = at(46);
          if (man < 0 || word(man, 14) !== 0x104E) throw new Error('the man’s unit is not where the page read it');
          if (guard < 0 || word(guard, 14) !== 0x004E) throw new Error('the guard’s unit is not where the page read it');
          for (let i = n * 16; i < (n + 2) * 16; i++) if (b[i]) throw new Error('slots ' + n + ' and ' + (n + 1) + ' are not empty');
          b.copyWithin(n * 16, man * 16, man * 16 + 16); b[n * 16 + 12] = 264 >> 8; b[n * 16 + 13] = 264 & 0xFF;
          b.copyWithin((n + 1) * 16, guard * 16, guard * 16 + 16); b[(n + 1) * 16 + 12] = 0; b[(n + 1) * 16 + 13] = 229;
          return 'units ' + n + ' (264, as the man) and ' + (n + 1) + ' (229, as the guard)';
      } },
    ] },
  // The Mining Camp's sign cannot be read (0x8118; 28 September 2026). A
  // sign's Examine (0x10C3) shows entry Data1 of 0x0218 and nothing when
  // Data1 is 0; the camp's sign, record 14, has Data1 0 and Data2 15, and
  // entry 15 is "Iron Mines". It is the only sign of the 27 with anything in
  // Data2; the number moves to Data1.
  { id: 'mining-camp-sign', group: 'world', stage: 'community', title: 'You can now read the Mining Camp\u2019s sign, instead of it showing nothing',
    played: 'fork, 28 September 2026: the sign reads Iron Mines',
    dataEdits: [
      { what: 'the Mining Camp’s sign', resid: 0x8118, fn: (b) => {
          const r = b.subarray(14 * 16, 14 * 16 + 16);
          if (((r[4] << 8 | r[5]) & 0x3FF) !== 195 || r[6] !== 0 || r[7] !== 15) throw new Error('record 14 is not a sign with 15 in Data2');
          r[6] = 15; r[7] = 0; return 'record 14’s text number moved to Data1';
      } },
    ] },

  /* ---- Bryce Schroeder's fixes (the stage "bugfix"; bugfix_patch.mjs,
     "Cythera Bugfix Patch") ------------------------------------------------
     The six fixes of Bryce Schroeder's unofficial bugfix patch, rebuilt with
     the page's own code writer (24 September 2026, at the maintainer's
     word). The causes are in bugs.md under *Fixed in Bryce Schroeder's
     unofficial patch*. */

  // Fetch (0x1A28). Bryce's patched UseOn, from his published source
  // (delvmod's wiki, "1A28 Patched", GPL, Bryce Schroeder 2016), put into
  // the listing's words: an item already carried "won't come free", one not
  // lying loose is "too large and heavy", one with no Weight cannot be
  // retrieved, one too heavy for the caster falls at their feet, and
  // anything else is carried -- flags 0x10, an inventory square, PutInside
  // -- where the shipped spell set flags 9 and lost it.
  { id: 'fetch', group: 'rules', stage: 'bugfix', title: 'Fetch now brings the thing to the caster, instead of losing it',
    played: 'the maintainer, 21 September 2026',
    edits: [
      { what: 'Fetch', resid: 0x1A28, at: 0x00B2, to: 0x00F3,
        expect: { 0x00B2: 'if_not', 0x00C7: 'byte 0x09', 0x00F3: 'return' },
        code: `
      if
      arg Arg01
      get_field flags (0x0)
      byte 0x10
      eq
      arg Arg01
      get_field flags (0x0)
      byte 0x08
      bitwise_and
      or
      then -> AlreadyInInventory
      if_not
      arg Arg01
      get_field flags (0x0)
      byte 0x00
      eq
      arg Arg01
      get_field flags (0x0)
      byte 0x01
      eq
      or
      then -> TooLargeAndHeavy
      if_not
      arg Arg01
      has_member Weight (0x24)
      then -> TooSticky
      if_not
      sys GetWeight
      arg Arg01
      get_field aspect_and_proptype (0x5)
      arg Arg01
      get_field quantity (0x9)
      end
      sys WeightCapacity
      global CurrentCharacter (0x9)
      end
      le
      then -> InventoryFull
      set_field flags (0x0)
      arg Arg01
      end
      byte 0x10
      end
      set_field x (0x1)
      arg Arg01
      end
      byte 0x00
      end
      set_field y (0x2)
      arg Arg01
      end
      byte 0x01
      end
      set_field container (0xB)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      end
      method PutInside (0x10)
      arg Arg01
      end
      sys RefreshView
      byte 0x01
      end
      branch Success
      InventoryFull:
      string(implicit) "The item falls to your feet.\\n"
      set_field x (0x1)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      get_field x (0x1)
      end
      set_field y (0x2)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      get_field y (0x2)
      end
      branch Success
      TooLargeAndHeavy:
      string(implicit) "It is too large and heavy.\\n"
      branch 0x00F3
      TooSticky:
      string(implicit) "It doesn't seem possible to retrieve that.\\n"
      branch 0x00F3
      AlreadyInInventory:
      string(implicit) "It won't come free.\\n"
      branch 0x00F3
      Success:
      sys RefreshView
      byte 0x01
      end` },
    ] },
  // Fishing (0x1091). His source's one change: the map word the pole reads
  // carries the automap's seen bit, which it masks off (word 0x7FFF,
  // bitwise_and) before testing for deep water.
  { id: 'fishing', group: 'rules', stage: 'bugfix', title: 'Fishing now finds deep water on squares already seen, instead of only on unseen ones',
    edits: [
      { what: 'fishing', resid: 0x1091, at: 0x00C7, expect: { 0x00C3: 'sys GetMapTile', 0x00C7: 'end' },
        code: `word 0x7FFF\nbitwise_and` },
    ] },
  // Aethon's lock picking (0x0C4E, 0x0C4F, 0x0C50). Not his fix -- his source
  // was never published and he called PickLock directly -- but the cause
  // read since: the task scripts cast their item argument into a local and
  // then send the method to the argument, a bare number, which the
  // interpreter ignores. Each sends it to the local.
  { id: 'aethon-locks', group: 'rules', stage: 'bugfix', title: 'Aethon now picks a lock when told to, instead of ignoring the order',
    edits: [[0x0C4E, 'Use'], [0x0C4F, 'UseOn'], [0x0C50, 'UseAt']].map(([resid, m]) => ({
      what: 'lock picking ' + m, resid, at: 0x000B, to: 0x000C,
      expect: { 0x0003: 'set_local 0x00', 0x0009: 'method', 0x000B: 'arg Arg01' },
      code: `local Var00` })) },
  // Aethon's "Ask About" (0x1861). His GetMessage answers skills only; the
  // block Hector's has for a thing asked about is put in front of it,
  // without Hector's weapon remarks: open the talk, both portraits, the
  // AskAbout helper (0xEB6), and "Looks like ..." when it has nothing.
  { id: 'aethon-ask-about', group: 'talk', stage: 'bugfix', title: 'Aethon now answers when asked about a thing, instead of answering only about skills',
    edits: [
      { what: 'Aethon asked about a thing', resid: 0x1861, at: 0x0078,
        expect: { 0x0078: 'if_not', 0x007A: 'is_type Skill' },
        code: `
      if_not
      arg Arg01
      is_type Prop (0x0)
      then -> NotAThing
      sys OpenConversation
      end
      sys TalkParticipant
      short 0x0001
      byte 0x02
      end
      sys TalkParticipant
      arg Arg00
      byte 0x00
      end
      if_not
      call_resource AskAbout (0xEB6)
      arg Arg00
      arg Arg01
      end
      not
      then -> Done
      string(implicit) "\\"Looks like "
      print
      arg Arg01
      end
      string(implicit) ".\\""
      Done:
      sys FinishConversation
      end
      return
      byte 0x00
      end
      NotAThing:` },
    ] },
  // Paris's and Diomede's names (0x1857, 0x182E). Their "name" topics set
  // their own character flag 7, as every other character's does, so the
  // scripts that test it use their names.
  { id: 'paris-diomede-names', group: 'talk', stage: 'bugfix', title: 'Paris and Diomede are now called by name once they have given it, instead of never',
    edits: [
      { what: 'Paris keeps his name', resid: 0x1857, at: 0x013D,
        expect: { 0x0114: 'conversation_response "name"', 0x013D: 'branch' },
        code: `call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x07\nend` },
      { what: 'Diomede keeps her name', resid: 0x182E, at: 0x0161,
        expect: { 0x013D: 'conversation_response "name"', 0x0161: 'branch' },
        code: `call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x07\nend` },
    ] },
  // Darius and Sardis's chair (0xF00B). Sardis's two posts at the Green
  // Goat's table, (22,16), are moved to the chair on the table's other side,
  // (23,15), which no schedule uses. Two schedule posts, bytes 5 to 7 of each
  // (x << 12 | y).
  { id: 'green-goat-chair', group: 'world', stage: 'bugfix', title: 'Darius and Sardis now sit in a chair each at the Green Goat, instead of sharing one',
    dataEdits: [
      { what: 'the chair', resid: 0xF00B, fn: (b) => {
          const S = (() => { const t = []; let p = 512; for (let i = 0; i < 256; i++) { const len = u16be(b, i * 2); const segs = []; for (let k = 0; k < len; k++, p += 8) segs.push(p); t.push(segs); } return t; })();
          let moved = 0;
          for (const p of S[31]) {
            const xy = (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7];
            if (b[p + 4] === 6 && (xy >> 12) === 22 && (xy & 0xFFF) === 16) { const v = (23 << 12) | 15; b[p + 5] = (v >> 16) & 0xFF; b[p + 6] = (v >> 8) & 0xFF; b[p + 7] = v & 0xFF; moved++; }
          }
          if (moved !== 2) throw new Error('the chair: expected two of Sardis\u2019s posts at (22,16), found ' + moved);
          return 'Sardis\u2019s two posts at (22,16) moved to (23,15)';
      } },
    ] },

  /* ---- Further fixes (the stage "further"; further_fixes_patch.mjs,
     "Cythera Further Fixes") ------------------------------------------------
     The bugs held back until the maintainer said what was meant (27
     September 2026, for the patch he means to share). What settled the
     intent is said beside each; where the files themselves settle it, that
     is the reason given.

     EVERY PLACE IS FOUND, NOT GIVEN. The other code stages name their edits
     by offset in the shipped file, which holds only while they run first or
     on resources nobody else touches. Several of these share a script with an
     earlier stage (Crito, Apis and Parium with the community's keywords,
     Demodocus with the found fixes, Paris with Bryce's six), so each reads
     the file as the stage finds it, finds each place by the run of
     instructions around it, and hands the applier the offsets it finds
     there. It runs the same alone on the shipped file and after the others,
     and a place that is not there exactly once stops the build.

     Left as shipped, at the maintainer's word or by the files: the Wine
     Contract (Ambrosia called it a red herring), Magpie's flag 1 (it guards
     the half disk), the sixth password, thread and cloth, the stairs, and
     "Beserker", which the text fixes. The last save's gender was in this
     list until 2 October 2026 and is `gender` below. */

  // The Books of Wisdom (0x1851): the task is struck at ten books, not five.
  // The eleventh To Do line, the one AddQuest shows at ten, reads "All ten of
  // the Sapphire Books of Wisdom have been retrieved".
  { id: 'books-of-wisdom', group: 'quests', stage: 'further', title: 'The Books of Wisdom task is now struck off at ten books, instead of five',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'the Books of Wisdom struck at ten', 0x1851,
        ['if_not', 'sys GetState', 'byte 0x05', 'end', 'byte 0x05', 'eq', 'then ->', 'sys CompleteQuest', 'byte 0x12'], 4, 'byte 0x0A'),
    ] }) },
  // The same script's thanks: "I see you found ", the count's word, " Book",
  // then the "s" only when the count is greater than 2, so two books read
  // "two Book" [sic]. Seen in the fork on 30 September 2026, handing in two.
  // The test is greater than 1.
  { id: 'books-plural', group: 'talk', stage: 'further', title: 'Selinus now thanks the party for \u201ctwo Books\u201d, instead of \u201ctwo Book\u201d',
    played: 'fork, PowerPC, 30 September 2026: two books handed in',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'the Books of Wisdom counted as more than one', 0x1851,
        ['string(implicit) " Book"', 'if_not', 'local Var00', 'byte 0x02', 'gt', 'then ->'], 3, 'byte 0x01'),
    ] }) },
  // Timon on the Seldane (0x184A): "we've met them" tests his own character
  // flag 1 where it tested quest flag 2, which nothing sets. Sabinate sets
  // Timon's flag 1 on meeting him ("It is a living Seldane!"), and Timon's
  // own talk with Larisa reads it for "meeting a real Seldane".
  { id: 'timon-seldane', group: 'talk', stage: 'further', title: 'Timon now speaks of having met a Seldane once he has, instead of never',
    plan: (s) => {
      const what = 'Timon has met the Seldane', p = dataPatchPlace(s, what, 0x184A,
        ['if_not', 'sys GetStateFlag', 'byte 0x02', 'end', 'then ->', 'string(implicit) "\\"Of course you all know that']);
      return { edits: [{ what, resid: 0x184A, at: p.at(1), to: p.at(4), expect: p.expect, code: 'call_resource 0xF02\narg Arg00\nbyte 0x01\nend' }] };
    } },
  // Timon fretting about Larisa (the room, 0x1C2D): the second branch tests
  // his flag 3 and set flag 2, so he fretted on every entry; it sets flag 3.
  { id: 'timon-frets', group: 'talk', stage: 'further', title: 'Timon now frets about Larisa once, instead of every time he comes in',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Timon frets once', 0x1C2D, ['call_resource SetCharacterFlag', 'short 0x004A', 'byte 0x02', 'end', 'return'], 2, 'byte 0x03'),
    ] }) },
  // Halos's "stop by my office" (0x183E's helper): `behaviour != 144 and
  // behaviour == 138` is redundant as written, and the line fits only away
  // from the office; the second test is `!=`.
  { id: 'halos-office', group: 'talk', stage: 'further', title: 'Halos now says \u201cstop by my office\u201d when he is away from it, instead of never',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Halos away from his office', 0x183E,
        ['arg Arg00', 'get_field behavior', 'word 144', 'ne', 'arg Arg00', 'get_field behavior', 'word 138', 'eq', 'and', 'sys GetSkill'], 7, 'ne'),
    ] }) },
  // Thoas's "Please come again" (0x1844): the local it waits on is set once
  // his shop has been opened.
  { id: 'thoas-farewell', group: 'talk', stage: 'further', title: 'Thoas now says \u201cPlease come again\u201d after you have shopped, instead of never',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'Thoas after his shop', 0x1844, ['conversation_response "buy" ->', 'set_field 0x27'], 1, 'set_local 0x00\nword True\nend'),
    ] }) },
  // Paris and Parium (the family group, 0x0805): "pari" took Parium's answer
  // first, so Paris's could not be given; Parium's is keyed "pariu".
  { id: 'paris-parium', group: 'talk', stage: 'further', title: '\u201cParis\u201d now gets the answer about Paris, instead of the one about Parium',
    plan: (s) => ({ edits: [
      dataFixRekey(s, 'Parium keyed apart from Paris', 0x0805, 'pari', 'pariu', ['string(implicit) "\\"My cousin Parium']),
    ] }) },
  // Thuria's mine task (0x1814): "You've heard first hand" is said only once
  // she has given the task, so hearing Amphidamas first no longer shuts it
  // out; her report greeting already has a line for that order.
  { id: 'thuria-mine', group: 'quests', stage: 'further', title: 'Thuria now still gives the mine task after you have been to the mine, instead of never giving it',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'Thuria gives the mine task', 0x1814,
        ['conversation_response "rumo" ->', 'if_not', 'call_resource 0xF02', 'short 0x0017', 'byte 0x01', 'end', 'then ->'], 6,
        'call_resource 0xF02\narg Arg00\nbyte 0x01\nend\nand'),
    ] }) },
  // The Comana brothers (Kosha Grotto, 0x1417): the one-time signal that
  // kills them and puts Pelagon in Magpie's figure waits for quest value 3 to
  // be 3, the visit on which Pelagon says "House Comana is no more".
  { id: 'comana-brothers', group: 'quests', stage: 'further', title: 'You now find the Comana brothers dead only once someone tells of their end, instead of before',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'the Comana brothers’ signal', 0x1417,
        ['if_not', 'sys GetStateFlag', 'byte 0x0F', 'end', 'not', 'then ->', 'sys SetStateFlag', 'byte 0x0F'], 5,
        'sys GetState\nbyte 0x03\nend\nbyte 0x03\neq\nand'),
    ] }) },
  // Lines that run on or flash past (grimoire's answersThatRunOn and
  // linesReplacedAtOnce, which find every one). A return after the mage
  // group's "history" (0x0808) and the House Atussa group's "atus" (0x0807),
  // and a branch to the end after each of the wishing fountain's four wishes
  // (0x1036), so "Your wish is found elsewhere..." no longer follows each.
  // Antenor (0x1824) and Pheres (0x184E): a "no" that got its own answer and
  // then the answer to an earlier question's "no" gets only its own. The
  // bartenders (0x0812): a hero with no oboloi is refused and no longer
  // asked "Do you need instructions?" straight after. And a click after the
  // line the next one replaced before it could be read: Ennomus, the
  // bartenders, Ake, Parium, Crito (three), Apis (three), Paris, Niobe
  // (two), Borus and Sabinate; a `*` after the closing quote, as the game's
  // own lines wait ("Yes, I was a bit puzzled."*).
  { id: 'lines-run-on', group: 'talk', stage: 'further', title: 'Answers now wait for you to read them, instead of running into the next one or flashing past',
    plan: (s) => {
      const edits = [];
      const RETURN_TRUE = 'return\nword True\nend';
      edits.push(dataFixInsert(s, 'the mage group’s "history"', 0x0808, ['conversation_response "hist" ->', 'string(implicit)', 'conversation_response "anis" ->'], 2, RETURN_TRUE, true));
      edits.push(dataFixInsert(s, 'the House Atussa group’s "atus"', 0x0807, ['conversation_response "atus" ->', 'string(implicit)', 'conversation_response "ake" ->'], 2, RETURN_TRUE, true));
      { // The fountain: four branches to where the catch-all answer ends, put
        // in from the last up, so each earlier one's target has moved by the
        // three bytes of every branch already put in ahead of it.
        const end = dataPatchPlace(s, 'the fountain’s end', 0x1036, ['conversation_response "*" ->', 'string(implicit) "\\"Your wish is found elsewhere', 'sys FinishConversation']).at(2);
        const wishes = [['coff', 'tequ'], ['3,thre', 'coff'], ['pony', '3,thre']];
        const tequ = dataPatchPlace(s, 'the fountain’s "tequ"', 0x1036, ['conversation_response "tequ" ->', 'string(implicit)', 'conversation_response "*" ->']);
        edits.push({ what: 'the fountain’s "tequ"', resid: 0x1036, at: tequ.at(2), expect: tequ.expect, code: 'branch ' + dataFixHex(end), shiftAt: true });
        wishes.forEach(([w, next], k) => {
          const p = dataPatchPlace(s, 'the fountain’s "' + w + '"', 0x1036, ['conversation_response "' + w + '" ->', 'string(implicit)', 'conversation_response "' + next + '" ->']);
          edits.push({ what: 'the fountain’s "' + w + '"', resid: 0x1036, at: p.at(2), expect: p.expect, code: 'branch ' + dataFixHex(end + 3 * (k + 1)), shiftAt: true });
        });
      }
      for (const [what, resid, line] of [['Antenor’s "no"', 0x1824, '"\\"I understand - no many'], ['Pheres’s "no"', 0x184E, '"\\"In my studies']]) {
        // The branch goes where the second "no" answer's own test would have gone.
        const second = resid === 0x1824
          ? dataPatchPlace(s, what, resid, ['conversation_response "n" ->', 'string(implicit) ' + line, 'conversation_response "n" ->'])
          : dataPatchPlace(s, what, resid, ['sys AddQuest', 'byte 0x1D', 'word 0x021A[0]', 'byte 0x1D', 'add', 'end', 'conversation_response "n" ->']);
        const k = resid === 0x1824 ? 2 : 6;
        edits.push({ what, resid, at: second.at(k), expect: second.expect, code: 'branch ' + dataFixHex(dataFixTarget(second.text(k))), shiftAt: true });
      }
      { // The refusal and the offer shared one string, the offer's half
        // reached by a jump into its middle; a return between them.
        const what = 'the bartenders refuse credit', p = dataPatchPlace(s, what, 0x0812,
          ['if_not', 'local Var00', 'byte 0x00', 'eq', 'then ->', 'string(implicit) "\\"I\'m sorry, but we don\'t give credit here']);
        edits.push({ what, resid: 0x0812, at: dataFixTarget(p.text(4)), expect: p.expect, code: 'return\nbyte 0x00\nend', shiftAt: true });
      }
      const textEdits = [
        dataFixClick('Ennomus', 0x1811, 'where da Tyrants used to live."'),
        dataFixClick('the bartenders', 0x0812, 'let\'s get on with it then."'),
        dataFixClick('Ake', 0x1820, 'after my husband goes to bed"'),
        dataFixClick('Parium', 0x1828, 'Now what can I do for you?"'),
        dataFixClick('Crito, a tab paid', 0x1829, 'Now what can I do for you?"'),
        dataFixClick('Crito, "Don\'t forget!"', 0x1829, '"Don\'t forget!"'),
        dataFixClick('Crito on Hebe', 0x1829, 'talk to Hebe about me?"'),
        dataFixClick('Apis, "Don\'t forget!"', 0x182A, '"Don\'t forget!"'),
        dataFixClick('Apis on the contract', 0x182A, 'go over it again?"'),
        dataFixClick('Apis, keep working', 0x182A, 'if you get a chance."'),
        dataFixClick('Paris', 0x1857, 'during business hours..."'),
        dataFixClick('Niobe', 0x1859, 'not to talk to strangers."'),
        dataFixClick('Helen to Niobe', 0x1859, '"It\'s OK, Niobe."'),
        dataFixClick('Borus', 0x1867, 'if you ask me."'),
        // Said twice in his script, and replaced only in the greeting, where
        // the "In due time" line follows it; the answer's copy waits already.
        (() => { const line = 'the @troubles of Alaric."', p = dataPatchPlace(s, 'Sabinate', 0x1878, ['call_resource 0xF01', 'short 0x0078', 'byte 0x01', 'end', 'string(implicit)']);
                 const said = JSON.parse(p.text(4).slice('string(implicit) '.length));
                 return { what: 'Sabinate', resid: 0x1878, at: p.at(4) + said.indexOf(line), find: line, replace: line + '*' }; })(),
      ];
      return { edits, textEdits };
    } },
  // Demodocus's "Would you like to @hear it?" leads to his song, keyed
  // "song,meti", whose "meti" the question itself takes first; it is keyed
  // "song,hear".
  { id: 'demodocus-song', group: 'talk', stage: 'further', title: 'Demodocus now sings when you ask to hear his song, instead of not answering',
    plan: (s) => ({ edits: [dataFixRekey(s, 'Demodocus’s song on "hear"', 0x186D, 'song,meti', 'song,hear')] }) },
  // Glaucus's "North Shore @Vineyard" and the family group's answer are
  // keyed "viny", which "vineyard" can never match; "vine".
  { id: 'glaucus-vineyard', group: 'talk', stage: 'further', title: '\u201cVineyard\u201d now gets an answer from Glaucus and his family, instead of none',
    plan: (s) => ({ edits: [
      dataFixRekey(s, 'Glaucus’s vineyard', 0x1866, 'viny', 'vine'),
      dataFixRekey(s, 'the family group’s vineyard', 0x0805, 'viny', 'vine'),
    ] }) },
  // The Directed Nexus scroll (0x104B): the scroll's Use deleted the spell it
  // cast and itself by number after the spell had moved the party to Land
  // King Hall, where those numbers name two of the hall's things. It notes
  // the zone and the spell first; if the zone or the spell's own record is
  // not what it was, it deletes nothing by number and takes one scroll of
  // that spell from whoever carries it (RemoveItem, as Selinus takes a
  // book). Directed Nexus is the one spell that changes zone. The scroll's
  // Use, from the cast to its return, and two more locals.
  { id: 'nexus-scroll', group: 'rules', stage: 'further', title: 'A Directed Nexus scroll now leaves Land King Hall\u2019s things alone, instead of destroying two of them',
    plan: (s) => {
      const what = 'the scroll deletes nothing it has left behind', p = dataPatchPlace(s, what, 0x104B,
        ['set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end', 'sys Delete', 'local Var00', 'end',
         'if_not', 'local Var01', 'word None', 'eq', 'local Var01', 'byte 0x00', 'eq', 'or', 'then ->',
         'sys Delete', 'arg Arg00', 'end', 'return', 'local Var01']);
      const edit = { what, resid: 0x104B, at: p.at(0), to: p.at(20), expect: p.expect, code: [
        'set_local 0x02', 'global CurrentZone (0x10)', 'end',
        'set_local 0x03', 'arg Arg00', 'get_field data1 (0x6)', 'end',
        'set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end',
        'if_not', 'global CurrentZone (0x10)', 'local Var02', 'eq', 'local Var00', 'get_field obj_type (0x4)', 'local Var03', 'eq', 'and', 'then -> moved',
        'sys Delete', 'local Var00', 'end',
        'if_not', 'local Var01', 'word None', 'eq', 'local Var01', 'byte 0x00', 'eq', 'or', 'then -> done',
        'sys Delete', 'arg Arg00', 'end',
        'branch done',
        'moved:',
        'set_local 0x02', 'sys WhoHasItem', 'short 0x004B', 'local Var03', 'end', 'end',
        'if_not', 'local Var02', 'byte 0x00', 'gt', 'then -> done',
        'sys RemoveItem', 'local Var02', 'short 0x004B', 'local Var03', 'byte 0x01', 'end',
        'done:'].join('\n') };
      return { edits: [edit], dataEdits: [dataFixLocals(s, 'the scroll’s Use has two more locals', 0x104B, edit.at, 2, 4)] };
    } },
  // Detect Traps (0x1A04) and Deactivate Trap (0x1AF2) look inside each thing
  // they pass, one level, with the ContainerIterator the bash helper
  // (0x0E49) uses to spring a container's trap: all five poison traps and
  // both blast traps in the game are inside crates and chests. Detect Traps
  // also finds an armed fine wire, as Deactivate Trap and Detect Secrets
  // already do. One level inside each thing, in a pair of locals the
  // function did not have (item, then the iterator's own slot), which the
  // header is given.
  { id: 'traps', group: 'rules', stage: 'further', title: 'Detect Traps and Deactivate Trap now find traps inside chests, and armed wires, instead of missing them',
    plan: (s) => {
      const TRAP_TEST = v => ['short 0x0160', 'short 0x0161', 'short 0x0163', 'short 0x00E6']
        .map((t, k) => ['local ' + v, 'get_field obj_type (0x4)', t, 'eq'].concat(k ? ['or'] : [])).flat();
      const inside = (v, slot, body) => [
        'set_local ' + slot, 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x00', 'local ' + ({ Var06: 'Var02', Var08: 'Var01' })[v], 'end', 'end',
        'test_' + v + ':',
        'if', 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x01', 'end', 'then -> done_' + v,
        'if_not'].concat(TRAP_TEST(v), ['then -> next_' + v], body, [
        'next_' + v + ':',
        'set_local ' + slot, 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x02', 'end', 'end',
        'branch test_' + v,
        'done_' + v + ':']).join('\n');
      const edits = [
        dataFixInsert(s, 'Detect Traps finds an armed wire', 0x1A04,
          ['if_not', 'local Var02', 'get_field obj_type (0x4)', 'short 0x00E6', 'eq', 'then ->'], 5,
          'local Var02\nget_field obj_type (0x4)\nshort 0x0165\neq\nlocal Var02\nget_field flags (0x0)\nbyte 0x02\nbitwise_and\nand\nor'),
        dataFixInsert(s, 'Detect Traps looks inside', 0x1A04,
          ['sys NearbyIterator', 'word &Var2', 'byte 0x01', 'end', 'then ->', 'set_local 0x05'], 5,
          inside('Var06', '0x06', ['sys MagicAuraEffect', 'local Var02', 'word 244', 'end',
            'if_not', 'global CurrentCharacter (0x9)', 'global PlayerCharacter (0x5)', 'eq', 'then -> next_Var06',
            'string(implicit) "You detect "', 'print', 'local Var06', 'end', 'string(implicit) "!\\n"',
            'set_local 0x01', 'word True', 'end'])),
        dataFixInsert(s, 'Deactivate Trap looks inside', 0x1AF2,
          ['sys LocationIterator', 'word &Var1', 'byte 0x01', 'end', 'then ->', 'set_local 0x04'], 5,
          inside('Var08', '0x08', ['set_local 0x00', 'word True', 'end',
            'string(implicit) "^"', 'print', 'local Var08', 'end', 'string(implicit) " destroyed.\\n"',
            'sys Delete', 'local Var08', 'end'])),
      ];
      // The builder found each function by the first of its edits after
      // sorting, the highest offset; both of Detect Traps' are in one.
      const last = resid => edits.filter(e => e.resid === resid).sort((a, b) => b.at - a.at)[0].at;
      return { edits, dataEdits: [
        dataFixLocals(s, 'Detect Traps has two more locals', 0x1A04, last(0x1A04), 6, 8),
        dataFixLocals(s, 'Deactivate Trap has two more locals', 0x1AF2, last(0x1AF2), 8, 10),
      ] };
    } },
  // Magpie's west standing frame (tile 0x72D, sheet 0x8E72): every other west
  // frame of his is the north frame transposed, to the pixel, and this one
  // is the transposed north sitting frame; it becomes the transposed north
  // standing frame, so he no longer drops into his seat whenever he stops
  // walking left.
  { id: 'magpie-west', group: 'world', stage: 'further', title: 'Magpie now stands when he stops walking west, instead of sitting',
    dataEdits: [
      { what: 'Magpie’s west standing frame', resid: 0x8E72, fn: (b) => {
          const col = decompressDCG(b, 32, 512);
          const tile = t => col.slice(t * 1024, t * 1024 + 1024);
          const tr = a => { const o = new Uint8Array(1024); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) o[y * 32 + x] = a[x * 32 + y]; return o; };
          const diff = (a, c) => { let n = 0; for (let i = 0; i < 1024; i++) if (a[i] !== c[i]) n++; return n; };
          if (diff(tr(tile(0)), tile(12)) || diff(tr(tile(3)), tile(15))) throw new Error('Magpie’s west frames are not his north frames transposed');
          if (diff(tr(tile(3)), tile(13)) > 2) throw new Error('Magpie’s west standing frame is not his sitting one');
          col.set(tr(tile(1)), 13 * 1024);
          const out = encodeDCGLiterals(col);
          const back = decompressDCG(out, 32, 512);
          for (let i = 0; i < col.length; i++) if (back[i] !== col[i]) throw new Error('the sheet does not decode back');
          return out;
      } },
    ] },
  // Divide Food (0x1AFB) gathers the party's food by prop type alone -- 69,
  // 231 and 213 -- over RecursiveContainerIterator, which returns a
  // character's skills too: a skill is a record held by the character with
  // flags 28 and the skill's number for its type, and Lock Picking is skill
  // 213, the mushroom steak's type. So the hero's Lock Picking was taken for
  // food, deleted, and dealt out as a type-213 thing at the skill's aspect
  // (16, an aptitude, draws as the strange device; 0 as the steak). The
  // gather now also asks that the thing's flags are not 28, the test
  // FindSkill and RecalcSkills use for a skill. Nothing else in the game
  // places or makes a type-213 thing, so with this the mushroom steak cannot
  // be had (the maintainer's choice, 27 September 2026).
  { id: 'divide-food', group: 'rules', stage: 'further', title: 'Divide Food now leaves Lock Picking alone, instead of eating it (which was the only way to a mushroom steak)',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'Divide Food leaves skills alone', 0x1AFB,
        ['if_not', 'local Var04', 'get_field obj_type (0x4)', 'short 0x0045', 'eq', 'local Var04', 'get_field obj_type (0x4)', 'short 0x00E7', 'eq', 'or',
         'local Var04', 'get_field obj_type (0x4)', 'short 0x00D5', 'eq', 'or', 'then ->'], 15,
        'local Var04\nget_field flags (0x0)\nbyte 0x1C\nne\nand'),
    ] }) },
  // The last save's gender (2 October 2026, the maintainer's word: it was
  // marked left as shipped on 27 September, which was not his choice).
  // Creating the hero (0x1801) writes the choice into word 0x10 of resource
  // 0x0500 with write_far_word, and 25 scripts read it back there wherever
  // they pick a word by gender ("ma'am" or "sir", "heroine" or "hero"). That
  // word lands in a file the scenario opening adds, which outlives every
  // game, and no save holds resource 0x0500, so a loaded game reads whatever
  // the last hero created wrote (the workbench's executable-fixes.md, *The
  // last save's gender*). The creation also writes the choice into the
  // hero's figure, field 0x25: 33 for a heroine, 32 for a hero. The
  // character record travels with the save. No other script writes field
  // 0x25: a character asleep in a bed (0x3020) changes 0x24 and the type,
  // and 0x3020 puts them back from 0x25. So each read becomes
  // `PlayerCharacter.0x25 == 33`. The fix leaves two places alone: the
  // creation's write, which nothing reads once this applies, and the
  // creation's read just after it, which comes before field 0x25 holds
  // anything.
  { id: 'gender', group: 'talk', stage: 'further', title: 'People now speak to the hero as the gender chosen for this game, instead of the one chosen for the last hero created',
    plan: (s) => {
      const edits = [];
      for (const resid of dataPatchScriptResids(s.spec)) {
        const ops = dataPatchListing(s, resid).ops;
        ops.forEach((op, i) => {
          if (!op.text.startsWith('load_far_word 0x05000010')) return;
          if (ops.slice(Math.max(0, i - 4), i).some(o => o.text.startsWith('write_far_word 0x05000010'))) return;
          edits.push({ what: 'the hero’s gender read off the hero', resid, at: op.at, replaceOp: true,
            expect: { [op.at]: 'load_far_word 0x05000010' }, code: 'global PlayerCharacter\nget_field 0x25\nbyte 0x21\neq' });
        });
      }
      if (edits.length !== 29) throw new Error('the hero’s gender: ' + edits.length + ' reads of the stored word found, not 29');
      return { edits };
    } },

  /* ---- Maps (the stage "map"; map_fixes_patch.mjs, "Cythera Map Fixes")
     The two faults in the scenario's maps that the board reported and this
     project confirmed (26 September 2026, the Citadel's at the maintainer's
     choice). A map square is two bytes, and writeDelverMapTiles changes
     those and nothing else in the resource. Each edit reads the square and
     its neighbour first and stops the build if either is not the tile the
     reading found. */

  // The first Stronghold's kitchen (map 0x801F): the metal door at (22,18)
  // stands on tile 145, "wall", which blocks, so opening it shows a wall and
  // the step is refused; the seven squares behind it are reached by nothing
  // else. The square takes the floor tile of the door beside it at (20,18),
  // 210.
  { id: 'stronghold-door', group: 'world', stage: 'map', title: 'The first Stronghold\u2019s kitchen door now opens onto floor, instead of wall',
    played: 'fork, 26 September 2026: through the door into the kitchen',
    dataEdits: [
      { what: 'the Stronghold’s kitchen door', resid: 0x801F, fn: (b) => {
          const m = parseDelverMap(b); m.raw = b;
          const at = (x, y) => u16be(b, m.mapDataOffset + (x + y * m.width) * 2);
          if (at(22, 18) !== 145 || at(20, 18) !== 210) throw new Error('(22,18) is ' + at(22, 18) + ' and (20,18) is ' + at(20, 18) + ', not 145 and 210');
          b.set(writeDelverMapTiles(b, m, [{ x: 22, y: 18, tile: 210 }])); return '(22,18) given floor tile 210';
      } },
    ] },
  // The shore under the Citadel (map 0x8006, Catamarca): the passage from the
  // Underground lands on (25,54), in a pocket of shore closed at both ends by
  // a bush beside water, and the way back, the secret passage and its egg at
  // (25,53), stands on embankment tile 100, which blocks, so the party cannot
  // step onto it. Of the game's three secret passages it is the only one on
  // a blocking tile, and every embankment tile blocks, so the square takes
  // the grass of its neighbour to the north at (25,52), 52. That reads as a
  // notch in the embankment. It opens no other way: (25,52) holds a tree,
  // which blocks, so the notch leads only onto the passage.
  { id: 'citadel-passage', group: 'world', stage: 'map', title: 'You can now step on the secret passage on the shore under the Citadel, instead of it blocking',
    played: 'fork, 26 September 2026: a step north reaches the Underground',
    dataEdits: [
      { what: 'the passage under the Citadel', resid: 0x8006, fn: (b) => {
          const m = parseDelverMap(b); m.raw = b;
          const at = (x, y) => u16be(b, m.mapDataOffset + (x + y * m.width) * 2);
          if (at(25, 53) !== 100 || at(25, 52) !== 52) throw new Error('(25,53) is ' + at(25, 53) + ' and (25,52) is ' + at(25, 52) + ', not 100 and 52');
          b.set(writeDelverMapTiles(b, m, [{ x: 25, y: 53, tile: 52 }])); return '(25,53) given grass tile 52';
      } },
    ] },

  /* ---- Text (the stages "text", "community-text" and "spelling";
     text_fixes_patch.mjs, "Cythera Text Fixes", and
     community_text_patch.mjs, "Cythera Community Text Fixes") --------------
     One fix with options, at the maintainer's word of 28 September 2026:
     the misspellings and slips this project found and he reviewed, and the
     typos the community marked in its dialogue collection, together; the
     spelling as the game has it, American or British; and apart, the
     corrections someone could fairly disagree with. The lists are below the
     fixes (DATA_FIX_TEXT, DATA_FIX_COMMUNITY_TYPOS). */

  { id: 'text', group: 'text', title: 'Misspellings, slips and typos in the text, with the community\u2019s list',
    played: 'in part: the maintainer, some lines in Land King Hall',
    parts: [
      { stage: 'text', plan: (s, ctx) => ({ textEdits: dataFixTextEdits(ctx.chosen) }) },
      { stage: 'community-text', plan: (s, ctx) => !ctx.chosen.has('text') ? {} : ({ textEdits: dataFixCommunityTypoEdits(dataPatchTexts(s), ctx.communityTypos || DATA_FIX_COMMUNITY_TYPOS,
          ctx.chosen.has('spelling-us') ? 'us' : ctx.chosen.has('spelling-uk') ? 'uk' : null).textEdits }) },
      { stage: 'spelling', plan: (s, ctx) => ({ textEdits: dataFixSpellingEdits(ctx.chosen) }) },
    ] },
  { id: 'spelling-us', parent: 'text', choice: 'spelling', group: 'text', short: 'US spellings', title: 'Standardize to US spellings' },
  { id: 'spelling-uk', parent: 'text', choice: 'spelling', group: 'text', short: 'UK spellings', title: 'Standardize to UK spellings' },
  /* The four that follow each go one way or the other, or neither (the
     maintainer, 1 October 2026): a pair shares a choice, drawn as a row of
     buttons with "don't" as the third, and the first of each pair, the
     maintainer's preference, is chosen when the page opens. */
  { id: 'text-two-taled', parent: 'text', choice: 'two-taled', group: 'text', short: '\u201cTwo-Taled Rat\u201d, as on its sign', title: 'Standardize to \u201cTwo-Taled Rat\u201d, as on its sign' },
  { id: 'text-two-tailed', parent: 'text', choice: 'two-taled', group: 'text', short: '\u201cTwo-Tailed Rat\u201d', title: 'Standardize to \u201cTwo-Tailed Rat\u201d' },
  { id: 'text-land-king', parent: 'text', choice: 'land-king', group: 'text', short: '\u201cLand King\u201d, as in the manuals', title: 'Standardize to \u201cLand King\u201d, as in the manuals' },
  { id: 'text-landking', parent: 'text', choice: 'land-king', group: 'text', short: '\u201cLandKing\u201d', title: 'Standardize to \u201cLandKing\u201d' },
  { id: 'text-areithous', parent: 'text', choice: 'areithous', group: 'text', short: '\u201cAreithous\u201d, as in the Hintbook', title: 'Standardize to \u201cAreithous\u201d, as in the Hintbook' },
  { id: 'text-ariethous', parent: 'text', choice: 'areithous', group: 'text', short: '\u201cAriethous\u201d', title: 'Standardize to \u201cAriethous\u201d' },
  { id: 'text-hyphens', parent: 'text', choice: 'hyphens', group: 'text', short: 'hyphenated, \u201ckind-looking\u201d', title: 'Standardize to hyphenated: \u201ckind-looking\u201d, \u201cdour-faced\u201d and the like' },
  { id: 'text-no-hyphens', parent: 'text', choice: 'hyphens', group: 'text', short: 'unhyphenated, \u201ckind hearted\u201d', title: 'Standardize to unhyphenated: \u201ckind-hearted\u201d, \u201crat-faced\u201d and the like lose theirs' },

  /* ---- Larger changes (the stage "apart"; karma_patch.mjs,
     resurrection_patch.mjs, peirithous_patch.mjs) --------------------------
     Each a patch of its own at the maintainer's word, and kept out of "All
     Fixes", since each is a design call rather than a slip anyone can point
     to. Each touches one resource no other fix does. */

  // Killing a townsperson costs karma (0xE8D; 27 September 2026, "Cythera
  // Karma Fix"). THE SHIPPED RULE: the kill helper adds [+1, +4, -10, 0] to
  // karma, indexed by the victim's alignment (neutral 0, evil 1, good 2,
  // feral 3, the combat AI's own names for them, STR# 9301), when the hero
  // lands the blow. Every one of the game's named people but the hero,
  // Aeneas and Eudoxus is neutral, so killing a townsperson raised karma by
  // one (bugs.md, *Killing NPCs raises karma*). THE CHANGE: a neutral victim
  // costs one karma instead, unless it is an animal or a spirit: the bird
  // (89), the goat (90), the chicken (228), the ghost (289), the fire spirit
  // (290) and the sylph (292), the six neutral units in 0xF008 that are not
  // people, which keep the shipped +1. One is the size of the game's one
  // other karma loss for a deed, "Your deeds stain your soul" in the hero's
  // script. Evil, good and feral are unchanged. WHY BY TYPE AND NOT BY
  // NUMBER: the first idea was the named characters only, the character
  // records below 256 (a created creature takes one from 256 up). The script
  // cannot ask that: the victim arrives as a reference, a class tag in the
  // top bits over the number, and the interpreter's bitwise_and
  // (TInterp::DoExpr's case for 0x56) masks two plain numbers only, taking
  // another path for a tagged word. The victim's type it can read, as the
  // helper already reads its square. So a hatched guard costs karma too,
  // being a person, and a hatched chicken does not.
  { id: 'karma', group: 'design', stage: 'apart', title: 'Killing a townsperson now costs one karma, instead of adding one',
    edits: (() => {
      const NOT_PEOPLE = ['byte 0x59', 'byte 0x5A', 'short 0x00E4', 'short 0x0121', 'short 0x0122', 'short 0x0124'];
      return [{
        what: 'a neutral person killed costs karma', resid: 0xE8D, at: 0x00C9, to: 0x00D4,
        expect: { 0x00A5: 'if_not', 0x00A6: 'global CurrentCharacter', 0x00A8: 'word Character.Hero', 0x00B1: 'set_local 0x05',
                  0x00C9: 'set_global Karma', 0x00CB: 'global Karma', 0x00CD: 'local Var05', 0x00CE: 'local Var00',
                  0x00CF: 'get_field alignment', 0x00D1: 'index', 0x00D2: 'add', 0x00D3: 'end', 0x00D4: 'return' },
        code: ['if_not', 'local Var00', 'get_field alignment (0x35)', 'byte 0x00', 'eq']
          .concat(NOT_PEOPLE.map(t => ['arg Arg00', 'get_field obj_type (0x4)', t, 'ne', 'and']).flat(), [
          'then -> table',
          'set_global Karma (0xC)', 'global Karma (0xC)', 'byte 0x01', 'sub', 'end',
          'branch done',
          'table:',
          'set_global Karma (0xC)', 'global Karma (0xC)', 'local Var05', 'local Var00', 'get_field alignment (0x35)', 'index', 'add', 'end',
          'done:']).join('\n'),
      }];
    })() },
  // A curse that weakened armour by 1 to 4, the reverse of Resist Blows,
  // was offered here on 1 October 2026 and withdrawn the same day at the
  // maintainer's word, since nothing in the game gives a curse (commit
  // c5b25b9 has the edit to 0xE81; what flag 19 is and what reads it is
  // in SYSTEMLESS-NOTES.md under systemless/alaric-flag-0k92h2).
  // Resurrection (0x1A2F's UseOn; 27 September 2026, "Cythera Resurrection
  // Fix"; bugs.md, *Resurrected characters vanish or reappear at home*).
  // THE SHIPPED SPELL: on a corpse whose Data1 names a character it sets the
  // alive bit, a quarter of full health plus one, gives the character every
  // record inside the corpse at any depth with flags 16, and deletes the
  // corpse. Death (TActiveMonster::Die) had taken them out of the party and
  // hidden their map record (flags 255), and the spell undoes neither, so a
  // raised person is nowhere until the next hour's schedule (ScheduleOne,
  // RepositionChar) puts them back at their post. And since death put only
  // what they held directly into the corpse, a sack went in with its
  // contents inside it, and the walk to any depth brings the sack back empty
  // and its contents loose. THE CHANGE, three parts, all in the spell's
  // UseOn: 1. The corpse is walked one level (ContainerIterator for
  // RecursiveContainerIterator), so a sack comes back with what is in it.
  // 2. The person's map record, the prop of their own number, is put on the
  // corpse's square with flags 66, and their character record's square set
  // to match. 66 is the state RepositionChar leaves a character in when it
  // puts them at a post nobody is watching: the draw loop
  // (TGameViewer::DrawRoutine) hands any character below 256 whose record is
  // 66 and near the party straight to TActiveMonster::HatchEgg, which makes
  // their creature there. Setting a record's square or flags resets the
  // neighbourhood (THood::ForceReset), so it is found on the next draw. The
  // corpse's square is read with `x` and `y`, which for a thing inside
  // another give its holder's square, so a corpse carried in a pack raises
  // its person beside whoever carries it. 3. A person who can join the party
  // -- the six JoinParty is ever called for: Hector 6, Meleager 34, Ariadne
  // 53, Timon 74, Aethon 97, Dryas 98 -- and whose behaviour when they died
  // was a party one, 1 to 13, is put back in it with JoinParty, whose
  // RebuildParty hatches them at once. Death does not touch the behaviour
  // byte (neither Die nor CharEntry::DeathRites writes it), and with no
  // creature on the map the `behavior` field reads it straight from the
  // record. The party writes 1 (following) and 2 (leading) when it rebuilds,
  // the Attack-target and Regroup commands 13, 1 and 2, and the combat AI's
  // tasks others below 14; leaving the party writes 143, being told to wait
  // 112, and the schedules use 0, 12, 15, 16 and 134 to 150. So a companion
  // dismissed or told to wait before they died is not taken back in, and one
  // killed in the party is. The one overlap: Dryas has a post at behaviour
  // 12, so Dryas killed while standing at it would rejoin. JoinParty refuses
  // a ninth member; then the person stands where the corpse lay, out of the
  // party, until the hour takes them home. NOT CHANGED: the Land King Amulet
  // used on a corpse (0x10F4), which runs the same code, and the hero's own
  // return to Land King Hall when the amulet is worn at death (0x1801), both
  // left as shipped at the maintainer's word, but for the corpse of nobody,
  // which nobody-corpse turns away in both. The map record wants a fifth
  // local; a function's locals are the third byte of its header, and UseOn's
  // header is at 0xA0.
  { id: 'resurrection', group: 'design', stage: 'apart', title: 'Resurrection now brings the person back where the corpse lay, with their belongings and in the party, instead of nowhere until a later hour',
    // Its offsets are the shipped file's; nobody-corpse, an earlier stage,
    // inserts before them, so the plan measures where the corpse's things
    // are now walked and moves every offset by the difference.
    plan: (s) => {
      const d = dataPatchPlace(s, 'the corpse\u2019s things', 0x1A2F, ['set_local 0x01', 'sys RecursiveContainerIterator', 'word &Var1', 'byte 0x00']).at(0) - 0x0112;
      const move = e => Object.assign({}, e, { at: e.at + d, to: e.to + d,
        expect: Object.fromEntries(Object.entries(e.expect).map(([k, v]) => [+k + d, v])) });
      return { edits: DATA_FIX_RESURRECTION.edits.map(move), dataEdits: DATA_FIX_RESURRECTION.dataEdits };
    } },
  // Peirithous, Judge Sacas's majordomo, alive (0xF009; 28 September 2026,
  // "Cythera Peirithous Fix", a separate patch since it puts a person into
  // the game that no release has shown). THE SHIPPED STATE: character 96 is
  // Peirithous, a record in Odemia with a man's look, stats and his bed for a
  // square, a full day in the schedules (0xF00B: up at seven, about the house
  // and town, in bed at nine), his own conversation (0x1860, "I am the
  // majordomo of Judge Sacas."), a line in Sacas's (0x1846), a portrait
  // (0x885F), and the hintbook's "Peirithous, servant" in Odemia. His Alive
  // bit is clear: bit 0 of the record's status word, byte 7 (the character
  // record's bytes 6 and 7 are field 20, status_flags, whose bit 0 is
  // Alive). ScheduleTime schedules the living only, so he is never placed,
  // and in a save his map record lies empty at (0,0) of whatever zone the
  // party is in, which is the body the board calls "Nothing" (bugs.md, the
  // "Nothing" entry: a Look there in the fork opened a window named Nothing
  // wearing his portrait). Of the scenario's placed characters only he and
  // the empty character 0 start without the bit; the unused slots have it
  // set. Every release from 1.0.1 is the same. THE CHANGE: the one bit, set.
  // A saved game carries its own character table, so this reaches new games
  // only.
  { id: 'peirithous', group: 'design', stage: 'apart', title: 'Peirithous, Judge Sacas\u2019s majordomo, is now alive in a new game, instead of dead',
    dataEdits: [
      { what: 'Peirithous alive', resid: 0xF009, fn: (b) => {
          const p = 96 * 32;
          // Zone 2 (Odemia), a man (prop type 82) at aspect 9, the status word 0.
          const zone = b[p], look = (b[p + 4] << 8) | b[p + 5];
          if (zone !== 2 || (look & 0x3FF) !== 82 || (look >> 10) !== 9 || b[p + 6] !== 0 || b[p + 7] !== 0)
            throw new Error('record 96 is not the dead Peirithous in Odemia this fix expects');
          b[p + 7] |= 1;
          return 'record 96, byte 7: the Alive bit set';
      } },
    ] },
];

/* ---- The text: this project's list ----------------------------------------
   The misspellings and slips in Cythera's text that the pass of 24 September
   2026 found beyond the community's proofreading (bugs.md, *The text:
   misspellings, slips and facts that disagree*), after the maintainer's
   review of the list. Each is a find-and-replace on the resource's bytes,
   which moves the offsets past the change and corrects a data block's size
   where the text sits inside one.

   An entry with `opt` is one of the text's options, in effect only when that
   option is chosen; they stay in the list where they were so that the edits
   to one resource keep their order whichever are chosen. "Two-Taled Rat" is
   the inn's name, the maintainer confirms: the three "Two Tailed" in the
   Cademia directions are the slip, and the community's list, which would
   make the inn "Two-Tailed" everywhere, is not followed there. */
const DATA_FIX_TEXT = [
  // dialogue
  dataFixT('Helen, "Yery"', 0x1858, 'Yery well', 'Very well', 1),
  dataFixT('Helen, "daugther"', 0x1858, 'daugther', 'daughter', 1),
  dataFixT('Alaric, "discoved"', 0x1802, 'discoved', 'discovered', 1),
  // Five spoken lines break the line inside their closing quote, so the quote
  // stands alone on the next line of the conversation box. No other spoken
  // line has a break inside its quotes (they end `."`, the narration with
  // the break after the text), each of the five is the last thing printed,
  // and 0x187A's farewell, the same shape, has none: a slip (29 September
  // 2026, found in the Spanish, whose five lines close the quote too).
  dataFixT('Alaric, the quote alone on a line', 0x1802, 'how rude of me.\n"', 'how rude of me."', 1),
  ...[0x1878, 0x187A, 0x187B, 0x187C].map(r => dataFixT('the Seldane’s "Be gone.", the quote alone on a line', r, 'Be gone.\n"', 'Be gone."', 1)),
  dataFixT('Meleager, "disrepest"', 0x1822, 'disrepest', 'disrespect', 1),
  dataFixT('Apis, "oportunity"', 0x182A, 'oportunity', 'opportunity', 1),
  dataFixT('Charax, "elimating"', 0x184F, 'elimating', 'eliminating', 1),
  dataFixT('Charax, "possbilities"', 0x184F, 'possbilities', 'possibilities', 1),
  dataFixT('Jhiaxus, "leige"', 0x1879, 'leige', 'liege', 1),
  dataFixT('Ignae, "streches"', 0x187D, 'streches', 'stretches', 1),
  dataFixT('Ascalon, "to to"', 0x1834, 'talk to to the', 'talk to the', 1),
  dataFixT('Sardis, "Attusa" and "Attusan"', 0x181F, 'Attusa', 'Atussa', 3),
  dataFixT('Thersites, "enscription"', 0x1865, 'enscription', 'inscription', 1),
  dataFixT('Thersites, "embarassed"', 0x1865, 'embarassed', 'embarrassed', 1),
  dataFixT('Berossus, "Halso"', 0x1848, 'Halso', 'Halos', 1),
  dataFixT('Anisa, "Atusa"', 0x184D, 'Founder Atusa', 'Founder Atussa', 1),
  dataFixT('Magpie, "Jhaixus"', 0x1803, 'Jhaixus', 'Jhiaxus', 1),
  dataFixT('Ignae, "Jhaixus"', 0x187D, 'Jhaixus', 'Jhiaxus', 3),
  dataFixT('Lindus, "Eigth"', 0x1850, 'Eigth', 'Eighth', 1),
  ...[0x0204, 0x1803, 0x184D, 0x1853, 0x1869, 0x186D, 0x1878].map(r => dataFixT('"knowlege"', r, 'knowlege', 'knowledge')),
  // skills and spells
  ...[0x1AC0, 0x1AC1, 0x1AC2, 0x1AC3].map(r => dataFixT('training, "techinques"', r, 'techinques', 'techniques')),
  dataFixT('Death Strike, "grevious"', 0x1A06, 'grevious', 'grievous', 1),
  dataFixT('Mass Terrorisation, "shreaks"', 0x1A26, 'shreaks', 'shrieks', 1),
  dataFixT('the spell "Acertainment"', 0x1A07, 'Acertainment', 'Ascertainment', 1),
  // items and rooms
  dataFixT('the grimoire, "correspondances"', 0x104C, 'correspondances', 'correspondences', 1),
  dataFixT('a room, "cinammon"', 0x1BD6, 'cinammon', 'cinnamon', 1),
  dataFixT('a room, "libary"', 0x1BB0, 'libary', 'library', 1),
  dataFixT('a room, "the the forge"', 0x1B3A, 'the the forge', 'the forge', 1),
  dataFixT('the shop, "Its nothing special"', 0x0EA5, '- Its nothing special.', "- It's nothing special.", 1),
  dataFixT('the onlooker, "your doing"', 0x0D06, 'What do you think your doing?', "What do you think you're doing?", 1),
  dataFixT('the fountain, "obolio"', 0x1036, 'obolio', 'oboloi', 1),
  // books
  dataFixT('"City of Mistery"', 0x021D, 'City of Mistery', 'City of Mystery', 1),
  dataFixT('"diverisified"', 0x021D, 'diverisified', 'diversified', 1),
  dataFixT('"percieve"', 0x021D, 'percieve', 'perceive', 1),
  dataFixT('"wreack"', 0x021D, 'wreack', 'wreak', 1),
  dataFixT('"live live"', 0x021D, 'live live', 'live', 1),
  dataFixT('"A expedition"', 0x021D, 'A expedition', 'An expedition', 1),
  dataFixT('"it wasn\'t 174"', 0x021D, "it wasn't 174 when", "it wasn't until 174 when", 1),
  Object.assign(dataFixT('"Alaric, Landking"', 0x021B, 'Alaric, Landking', 'Alaric, Land King', 1), { opt: 'text-land-king' }),
  // the To Do lines
  dataFixT('To Do, "has be kidnapped"', 0x021A, 'has be kidnapped', 'has been kidnapped', 1),
  dataFixT('To Do, "suggest taking"', 0x021A, 'Metopes suggest taking', 'Metopes suggests taking', 1),
  dataFixT('To Do, "nees"', 0x021A, 'nees some', 'needs some', 1),
  dataFixT('To Do, "possible has"', 0x021A, 'which possible has', 'which possibly has', 1),
  dataFixT('To Do, four books', 0x021A, 'Four of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find it and return it', 'Four of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  dataFixT('To Do, three books', 0x021A, 'Three of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find them and return it', 'Three of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  dataFixT('To Do, two books', 0x021A, 'Two of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find them and return it', 'Two of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  dataFixT('To Do, "sharpens"', 0x021A, 'the sharpens of weapons', 'the sharpness of weapons', 1),
  dataFixT('To Do, "for research the"', 0x021A, 'In return for research the', 'In return for researching the', 1),
  dataFixT('To Do, "enscription"', 0x021A, 'enscription', 'inscription', 1),
  dataFixT('To Do, "embarassed"', 0x021A, 'embarassed', 'embarrassed', 1),
  dataFixT('To Do, "Berosus"', 0x021A, 'Judge Berosus', 'Judge Berossus', 1),
  dataFixT('To Do, "shading dealing"', 0x021A, 'the shading dealing of', 'the shady dealings of', 1),
  dataFixT('To Do, "Matro"', 0x021A, 'Matro Thuria', 'Matron Thuria', 1),
  dataFixT('To Do, "too her"', 0x021A, 'take it too her', 'take it to her', 1),
  // notes, signs, the character sheet
  dataFixT('the letter, "Berrosus"', 0x0219, '--Berrosus', '--Berossus', 1),
  dataFixT('Tavara’s note, "once chance"', 0x0219, 'but once chance', 'but one chance', 1),
  dataFixT('the sign "Eight Degree Hall"', 0x0218, 'Eight Degree Hall', 'Eighth Degree Hall', 1),
  dataFixT('archetypes, "A explorer"', 0x0204, 'A explorer', 'An explorer', 1),
  dataFixT('archetypes, "Beserker"', 0x0203, 'Beserker', 'Berserker', 1),
  // the opening and endings
  dataFixT('opening, "a might oak"', 0x0240, 'a might oak', 'a mighty oak', 1),
  dataFixT('ending, "momemt"', 0x0242, 'momemt', 'moment', 1),
  dataFixT('ending, "don\'t not know"', 0x0242, "You don't not know", 'You do not know', 1),
  dataFixT('ending, "beginning crying"', 0x0242, 'beginning crying', 'begins crying', 1),
  dataFixT('ending, "flys away"', 0x0243, 'flys away', 'flies away', 1),
  // the "Where Is" answers and the general group
  dataFixT('Land King Hall, "quaters"', 0x0809, 'quaters', 'quarters', 1),
  dataFixT('Land King Hall, "Its the first city"', 0x0809, "Its the first city", "It's the first city", 1),
  dataFixT('Odemia, "Milcon"', 0x080A, 'Milcon', 'Milcom', 1),
  dataFixT('Catamarca, the hall’s bearing', 0x080B, 'LandKing Hall north east through', 'LandKing Hall lies north west through', 1),
  dataFixT('Catamarca, the town to the north', 0x080B, 'Catamarca lies north up the coast', 'Odemia lies north up the coast', 1),
  dataFixT('Pnyx, "Selinus has quaters are"', 0x080C, 'Selinus has quaters are ', "Selinus' quarters are ", 1),
  dataFixT('Pnyx, "quaters"', 0x080C, 'quaters', 'quarters', 2),
  dataFixT('Pnyx, the hall without a verb', 0x080C, 'The secondary lecture hall downstairs, northeast', 'The secondary lecture hall is downstairs, northeast', 1),
  dataFixT('Pnyx, the road to the hall', 0x080C, 'northwest, past Odemia', 'northeast, past Odemia', 1),
  dataFixT('Pnyx, the road to Odemia', 0x080C, 'then northwest along the road', 'then northeast along the road', 1),
  dataFixT('Kosha, "Odemia north of"', 0x080D, 'Odemia north of Catamarca', 'Odemia lies north of Catamarca', 1),
  dataFixT('Kosha, "Catamarca northeast of here"', 0x080D, 'Catamarca northeast of here', 'Catamarca lies northeast of here', 1),
  dataFixT('Kosha, "take the road ... is the safest"', 0x080D, 'take the road west from Cademia is the safest', 'the road west from Cademia is the safest', 1),
  dataFixT('Cademia, "Your standing"', 0x080E, 'Your standing in them.', "You're standing in them.", 1),
  Object.assign(dataFixT('Cademia, "Two Tailed Rat"', 0x080E, 'Two Tailed Rat', 'Two-Taled Rat', 3), { opt: 'text-two-taled' }),
  dataFixT('Cademia, "Opheltuis"', 0x080E, 'Opheltuis', 'Opheltius', 1),
  dataFixT('the mine, "He\'s quarters"', 0x0811, "He's quarters are", 'His quarters are', 1),
  dataFixT('the general group, Pnyx’s coast', 0x0801, 'on the eastern coast of Cythera', 'on the western coast of Cythera', 1),
  // Areithous: the Hintbook spells him so, twice, as do his own "I'm called
  // Areithous", Laodice's three, the Kosha group and the community; the
  // name table, Atreus and one of Laodice's are the odd ones out (settled
  // 24 September 2026, and one of the options since the 28th, being a name).
  Object.assign(dataFixT('the name table, "Ariethous"', 0x0201, 'Ariethous', 'Areithous', 1), { opt: 'text-areithous' }),
  Object.assign(dataFixT('Atreus, "Ariethous"', 0x1810, 'Ariethous', 'Areithous', 1), { opt: 'text-areithous' }),
  Object.assign(dataFixT('Laodice, "Ariethous"', 0x1813, 'Ariethous', 'Areithous', 1), { opt: 'text-areithous' }),
  // Meleager: a typo the collection mis-transcribed ("I am use to"), placed
  // by hand. His "travelling" is the spelling's to change, below.
  dataFixT('Meleager, "use to"', 0x1822, "I'm use to travelling", "I'm used to travelling", 1),
  // Compound modifiers before a noun, hyphenated as the game does elsewhere
  // ("rat-faced", "round-faced", "wide-eyed", "kind-hearted"): every "X
  // looking", "X faced" and "X eyed" it left open, 46 places. One of the
  // options since 28 September 2026, being a matter of style.
  ...[
    dataFixT('"strange looking"', 0x0219, 'strange looking', 'strange-looking', 1),
    dataFixT('"disgusting looking"', 0x021D, 'disgusting looking', 'disgusting-looking', 1),
    dataFixT('"serious looking"', 0x102E, 'serious looking', 'serious-looking', 1),
    dataFixT('"wicked looking"', 0x1119, 'wicked looking', 'wicked-looking', 1),
    dataFixT('"vacant eyed"', 0x1121, 'vacant eyed', 'vacant-eyed', 1),
    dataFixT('"strange looking"', 0x1174, 'strange looking', 'strange-looking', 1),
    dataFixT('"impressive looking"', 0x1176, 'impressive looking', 'impressive-looking', 1),
    dataFixT('"impressive looking"', 0x1177, 'impressive looking', 'impressive-looking', 1),
    dataFixT('"odd looking"', 0x1187, 'odd looking', 'odd-looking', 1),
    dataFixT('"strange looking"', 0x1801, 'strange looking', 'strange-looking', 1),
    dataFixT('"serious looking"', 0x1807, 'serious looking', 'serious-looking', 1),
    dataFixT('"serious looking"', 0x1808, 'serious looking', 'serious-looking', 1),
    dataFixT('"mean looking"', 0x180E, 'mean looking', 'mean-looking', 1),
    dataFixT('"serious looking"', 0x180F, 'serious looking', 'serious-looking', 1),
    dataFixT('"vain looking"', 0x1812, 'vain looking', 'vain-looking', 1),
    dataFixT('"stern looking"', 0x181E, 'stern looking', 'stern-looking', 1),
    dataFixT('"slight looking"', 0x181F, 'slight looking', 'slight-looking', 1),
    dataFixT('"confused looking"', 0x182D, 'confused looking', 'confused-looking', 1),
    dataFixT('"grandmotherly looking"', 0x182E, 'grandmotherly looking', 'grandmotherly-looking', 1),
    dataFixT('"dour faced"', 0x1830, 'dour faced', 'dour-faced', 1),
    dataFixT('"dour faced"', 0x1831, 'dour faced', 'dour-faced', 1),
    dataFixT('"ordinary looking"', 0x1833, 'ordinary looking', 'ordinary-looking', 1),
    dataFixT('"serious looking"', 0x1836, 'serious looking', 'serious-looking', 1),
    dataFixT('"hesitant looking"', 0x183A, 'hesitant looking', 'hesitant-looking', 1),
    dataFixT('"stoic looking"', 0x183B, 'stoic looking', 'stoic-looking', 1),
    dataFixT('"serious looking"', 0x183F, 'serious looking', 'serious-looking', 1),
    dataFixT('"friendly looking"', 0x1844, 'friendly looking', 'friendly-looking', 1),
    dataFixT('"funny looking"', 0x1845, 'funny looking', 'funny-looking', 2),
    dataFixT('"kind looking"', 0x184C, 'kind looking', 'kind-looking', 1),
    dataFixT('"peaceful looking"', 0x184E, 'peaceful looking', 'peaceful-looking', 1),
    dataFixT('"pinch faced"', 0x1852, 'pinch faced', 'pinch-faced', 1),
    dataFixT('"ordinary looking"', 0x1853, 'ordinary looking', 'ordinary-looking', 1),
    dataFixT('"serious looking"', 0x1854, 'serious looking', 'serious-looking', 1),
    dataFixT('"handsome looking"', 0x1857, 'handsome looking', 'handsome-looking', 1),
    dataFixT('"narrow eyed"', 0x185B, 'narrow eyed', 'narrow-eyed', 1),
    dataFixT('"dirty looking"', 0x185C, 'dirty looking', 'dirty-looking', 1),
    dataFixT('"dour faced"', 0x1860, 'dour faced', 'dour-faced', 1),
    dataFixT('"rat faced"', 0x1861, 'rat faced', 'rat-faced', 1),
    dataFixT('"broken looking"', 0x1866, 'broken looking', 'broken-looking', 1),
    dataFixT('"round faced"', 0x1868, 'round faced', 'round-faced', 1),
    dataFixT('"content looking"', 0x1869, 'content looking', 'content-looking', 1),
    dataFixT('"content looking"', 0x186A, 'content looking', 'content-looking', 1),
    dataFixT('"strange looking"', 0x1878, 'strange looking', 'strange-looking', 1),
    dataFixT('"bare looking"', 0x1B36, 'bare looking', 'bare-looking', 1),
    dataFixT('"sly looking,"', 0x1818, 'sly looking,', 'sly-looking,', 1),
  ].map(e => Object.assign(e, { opt: 'text-hyphens' })),
  // Helen's "wearly looking": the misspelling is a fix, the hyphen an option.
  dataFixT('Helen, "wearly"', 0x1858, 'wearly looking', 'weary looking', 1),
  Object.assign(dataFixT('Helen, "weary looking"', 0x1858, 'weary looking', 'weary-looking', 1), { opt: 'text-hyphens' }),
  // Two keywords that matched only the misspelling they answered: Sardis's
  // "attu" for House Atussa, Ignae's "jhai" for Jhiaxus. With the words
  // corrected above, the keywords follow them (the same length, so no
  // offset moves).
  dataFixT('Sardis\u2019s keyword "attu"', 0x181F, 'attu', 'atus', 1),
  dataFixT('Ignae\u2019s keyword "jhai"', 0x187D, 'jhai', 'jhia', 1),
  // "LandKing" to "Land King" (24 September 2026, at the maintainer's word;
  // one of the options since the 28th): the author's own unit table names
  // Alaric's unit "Land King", both manuals write it so 39 times and
  // "LandKing" never, the zone is titled "Land King Hall", and the dialogue
  // itself says "the Land King's side" beside its forty "LandKing"s. The
  // keywords are "land" and "king", which the two words still match.
  ...[0x021A, 0x021B, 0x0242, 0x0801, 0x0804, 0x0809, 0x080A, 0x080B, 0x080C, 0x080D, 0x080E, 0x0811,
      0x1801, 0x1802, 0x1803, 0x1804, 0x1807, 0x180D, 0x1846, 0x1A00]
    .map(r => Object.assign(dataFixT('"LandKing"', r, 'LandKing', 'Land King'), { opt: 'text-land-king' })),
  /* The other way, each of the four (1 October 2026): every place the game
     has the spelling the options above change away from, found by reading
     every resource for it on the day. "Two-Tailed" takes both the sign's
     "Two-Taled" and the directions' "Two Tailed". "LandKing" leaves the
     LandKing Amulet, a thing's name, as "Land King" does. "Ariethous"
     takes the four keyword lists that answer to "arei" with it, as
     Sardis's "attu" follows his spelling above, so a highlighted
     @Ariethous still answers; the name table has "Ariethous" already.
     Unhyphenated takes the five compounds the game hyphenated itself,
     which the hyphenated option leaves. */
  ...[[0x0218, 1], [0x021A, 3], [0x0805, 1], [0x182A, 2]]
    .map(([r, n]) => Object.assign(dataFixT('"Two-Taled Rat"', r, 'Two-Taled Rat', 'Two-Tailed Rat', n), { opt: 'text-two-tailed' })),
  Object.assign(dataFixT('Cademia, "Two Tailed Rat"', 0x080E, 'Two Tailed Rat', 'Two-Tailed Rat', 3), { opt: 'text-two-tailed' }),
  ...[[0x1403, 1], [0x1805, 2], [0x1806, 1], [0x1832, 2], [0x186D, 2], [0x1B11, 1], [0x1B12, 1]]
    .map(([r, n]) => Object.assign(dataFixT('"Land King"', r, 'Land King', 'LandKing', n), { opt: 'text-landking' })),
  Object.assign(dataFixT('"Alaric, Landking"', 0x021B, 'Alaric, Landking', 'Alaric, LandKing', 1), { opt: 'text-landking' }),
  ...[[0x080D, 1], [0x1812, 1], [0x1813, 3]]
    .map(([r, n]) => Object.assign(dataFixT('"Areithous"', r, 'Areithous', 'Ariethous', n), { opt: 'text-ariethous' })),
  ...[0x080D, 0x1810, 0x1812, 0x1813]
    .map(r => Object.assign(dataFixT('the keyword "arei"', r, 'arei', 'arie', 1), { opt: 'text-ariethous' })),
  ...[['kind-hearted', 0x1806], ['Dark-hearted', 0x1806], ['rat-faced', 0x1810], ['round-faced', 0x1867], ['wide-eyed', 0x186C]]
    .map(([w, r]) => Object.assign(dataFixT('"' + w + '"', r, w, w.replace('-', ' '), 1), { opt: 'text-no-hyphens' })),
  // tab bytes
  Object.assign(dataFixT('Tavara’s tabs', 0x1CC3, '\t', '', 10), { mid: true }),
  Object.assign(dataFixT('a rumour’s tab', 0x0813, '\t', '', 1), { mid: true }),
];

/* The spelling. British spellings in a game whose text, and whose Hintbook
   ("traveling", "Terrorization"), are otherwise American: changed to
   American, leaving the quoted passages in the books ("many colours", "shall
   be burnt") as their authors wrote them. Or, at the maintainer's word of 24
   September 2026 (the "UK English" variant), the game's American forms made
   British throughout, stem by stem over every script: honour, colour,
   centre, -ise, Paralyse, mummy, with Niobe's keywords following. */
const DATA_FIX_TEXT_AMERICAN = [
  dataFixT('"travelling"', 0x0801, 'travelling', 'traveling', 1),
  dataFixT('"travelling"', 0x1805, 'travelling', 'traveling', 1),
  dataFixT('"travelling"', 0x186D, 'travelling', 'traveling', 2),
  dataFixT('"travelling"', 0x1822, 'travelling', 'traveling', 1),
  dataFixT('"traveller"', 0x021D, 'traveller', 'traveler'),
  dataFixT('"traveller"', 0x0813, 'traveller', 'traveler', 1),
  dataFixT('"judgement"', 0x021B, 'judgement', 'judgment'),
  dataFixT('"judgement"', 0x1801, 'judgement', 'judgment'),
  dataFixT('"judgement"', 0x1848, 'judgement', 'judgment', 1),
  dataFixT('"saviour"', 0x0240, 'saviour', 'savior', 1),
  dataFixT('"saviour"', 0x1864, 'saviour', 'savior', 1),
  dataFixT('"Terrorisation"', 0x1A0E, 'Terrorisation', 'Terrorization', 1),
  dataFixT('"Mass Terrorisation"', 0x1A26, 'Terrorisation', 'Terrorization', 1),
  dataFixT('"grey slime"', 0x021D, 'grey slime', 'gray slime', 1),
];
const DATA_FIX_TEXT_BRITISH = (() => {
  // Both cases of a stem; a form that may not occur is allowed to match nothing.
  const both = (what, resid, stem, to) => [
    Object.assign(dataFixT(what, resid, stem, to), { optional: true }),
    Object.assign(dataFixT(what, resid, stem[0].toUpperCase() + stem.slice(1), to[0].toUpperCase() + to.slice(1)), { optional: true }) ];
  const STEMS = [['centered', 'centred'], ['honor', 'honour'], ['rumor', 'rumour'], ['favor', 'favour'], ['color', 'colour'], ['savior', 'saviour'],
    ['gray', 'grey'], ['defense', 'defence'], ['offense', 'offence'], ['center', 'centre'], ['odor', 'odour'],
    ['artifact', 'artefact'], ['mommy', 'mummy'], ['recogniz', 'recognis'], ['organiz', 'organis'], ['specializ', 'specialis'],
    ['neutraliz', 'neutralis'], ['harmoniz', 'harmonis'], ['realiz', 'realis'], ['paralyz', 'paralys'], ['fiber', 'fibre'],
    ['plow', 'plough'], ['mold', 'mould'], ['sulfur', 'sulphur'], ['armor', 'armour']];
  const out = [];
  for (const [st, to] of STEMS) out.push(...both('UK "' + st + '"', null, st, to));
  // Niobe's keywords answer "mom" and "momm"; with her "@mommy" now "@mummy" they follow it.
  out.push(dataFixT('Niobe\u2019s keywords "mom,momm"', 0x1859, 'mom,momm', 'mum,mumm', 1));
  return out;
})();

/* Ye olde spelling, a third choice from 29 September 2026 ("ye towne, ye
   shoppe, magick and musick"), was taken off the page on 1 October 2026 at
   the maintainer's word, as a test rather than a fix; its word list is in
   the history. The `prose` and `except` filters it needed stay in
   js/delv-datapatch.js, unused. */

// The text stage's edits for the options chosen: the list, less the options
// not chosen, each keeping the option it belongs to for the list of changes
// (dataFixTextChanges). And the spelling stage's, for the spelling chosen.
function dataFixTextEdits(chosen) {
  return DATA_FIX_TEXT.filter(e => e.opt ? chosen.has(e.opt) : chosen.has('text')).map(e => Object.assign({}, e));
}
function dataFixSpellingEdits(chosen) {
  return chosen.has('spelling-us') ? DATA_FIX_TEXT_AMERICAN.slice() : chosen.has('spelling-uk') ? DATA_FIX_TEXT_BRITISH.slice() : [];
}

/* ---- The text: the community's list -----------------------------------------
   The typos the community marked in its own dialogue collection
   (cytheraguides.com's dialogue set, collected in play by BreadWorldMercy453
   and reformatted by Wizard), which marks each as <original,fix>. (24
   September 2026, at the maintainer's word.) DATA_FIX_COMMUNITY_TYPOS, at the
   foot of this file, is every pair in the collection with the words around
   it, as utilities/community_text_patch.mjs reads them out of it; the page
   cannot read the collection, which is in no repository, and
   utilities/data_fix_check.mjs fails if the list and the collection part.

   This takes each pair, resolves the words around it to the game's own
   wording, and looks for those words in the game's text as it stands with
   the collection's markup allowed between them -- the game's strings carry
   quotes, the click marks (*) and the @ of a highlighted word where the
   collection does not. A pair found once, or the same number of times as the
   game holds the phrase, is an edit; one found nowhere is tried with fewer
   words around it, then with the misspelt word alone when the game holds it
   exactly once; what is still not found is reported and left. Found with the
   corrected wording in the same place instead, it is the collection's own
   slip in transcribing, and the game is right already. So the edits are the
   collection's, found in the file, not typed in here; and since they are
   found in the text as the earlier stages left it, they follow whatever
   options were chosen.

   Left out on purpose (LEAVE): the collection's own slips that the search
   would not catch (bugs.md, *The community's list, checked*); "travelling",
   a spelling and not a typo; "Two-Taled Rat", which the maintainer confirms
   is the inn's name; "Ariethous", an option of the text's; and the pairs
   this project's list already applies, so that the two do not both claim a
   change. */
function dataFixCommunityTypoEdits(texts, typos, spelling) {
  const LEAVE = new Set(['travelling', '@travelling', 'Two-Taled', 'Ariethous',
    // applied by this project's list
    'Halso', 'Opheltuis', 'Jhaixus', 'Atusa', 'Eigth', 'knowlege', 'enscription', 'embarassed',
    'Catamarca', 'east', 'northwest', 'eastern', 'Your', 'wearly']);
  // One place this project's list already changes, under a word other places need.
  const LEAVE_IN = new Set(['Its|Emesa', 'Its|Generic Land King Hall', "He's|Generic Iron Mine", "He's|Eurybates"]);
  // Where the collection's fix is itself wrong: "Perhaps I'm not strong
  // enough" is the device, so "it's", not the collection's "its". And its
  // "endeavour" is American with the American spelling chosen.
  const OVERRIDE = { "I'm|its": "it's" };
  if (spelling === 'us') OVERRIDE['endevour|endeavour'] = 'endeavor';

  const occurrences = typos.map(([file, orig, fix, before, after]) =>
    ({ file, orig, fix, before: before ? before.split(' ') : [], after: after ? after.split(' ') : [] }));
  const SEP = '[ \\t\\n"*@]*', GAP = '[ \\t\\n"*@]+';   // between words; inside a phrase at least one
  const esc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const word = w => esc(w.replace(/^@/, ''));
  const pattern = (before, orig, after) => new RegExp(
    (before.length ? before.map(word).join(SEP) + SEP : '') + '(' + orig.trim().split(/\s+/).map(word).join(GAP) + ')' + (after.length ? SEP + after.map(word).join(SEP) : ''), 'g');
  const findAll = re => { const hits = []; for (const [resid, t] of Object.entries(texts)) { re.lastIndex = 0; let m; while ((m = re.exec(t))) { hits.push({ resid: +resid, find: m[0], orig: m[1], index: m.index }); if (!m[0].length) re.lastIndex++; } } return hits; };

  const hitsByResid = new Map();   // resid -> [{ index, find, orig, fix, what }]
  const unmatched = [], skipped = [], slips = [];
  const seen = new Set();
  for (const o of occurrences) {
    if (LEAVE.has(o.orig) || LEAVE.has(o.orig.replace(/^@/, '')) || LEAVE_IN.has(o.orig + '|' + o.file)) { skipped.push(o); continue; }
    const fix = OVERRIDE[o.orig + '|' + o.fix] || o.fix;
    const key = [o.before.join(' '), o.orig, o.after.join(' ')].join('|');
    if (seen.has(key)) continue;         // the same line in another branch of the same conversation
    seen.add(key);
    // With the words around it, the original first; failing that, the
    // corrected wording in the same place, which means the "original" is the
    // collection's own slip in transcribing and not the game's ("Sealed it
    // within", "quite interesting", "neutralize it"); then fewer words.
    let hits = [], slip = false;
    for (const n of [2, 1, 0]) {
      const b = n ? o.before.slice(-n) : [], a = o.after.slice(0, n);
      hits = findAll(pattern(b, o.orig, a));
      if (n === 0 && hits.length !== 1) hits = [];
      if (hits.length) break;
      if (n && findAll(pattern(b, fix, a)).length) { slip = true; break; }
    }
    if (slip) { slips.push(o); continue; }
    if (!hits.length) { unmatched.push(o); continue; }
    for (const h of hits) {
      const list = hitsByResid.get(h.resid) || [];
      // The words around it found the place; the edit is the word alone,
      // since the game splits its text at jump targets and a wider span can
      // cross one.
      const index = h.index + h.find.lastIndexOf(h.orig);
      if (list.some(x => x.index === index && x.find === h.orig)) continue;   // the same place, marked twice
      list.push({ index, find: h.orig, orig: h.orig, fix: fix.replace(/^@/, ''), what: o.orig + ' \u2192 ' + fix + ' (' + o.file + ')' });
      hitsByResid.set(h.resid, list);
    }
  }
  // Each hit is anchored to where it was found. Two hits whose text overlaps
  // (a typo beside another, "Execellent.  I'm am looking") become one edit
  // over the span of both, each misspelt word replaced at its own place.
  const textEdits = [];
  for (const [resid, list] of hitsByResid) {
    list.sort((a, b) => a.index - b.index);
    let i = 0;
    while (i < list.length) {
      let j = i, end = list[i].index + list[i].find.length;
      while (j + 1 < list.length && list[j + 1].index < end) { j++; end = Math.max(end, list[j].index + list[j].find.length); }
      const start = list[i].index, group = list.slice(i, j + 1);
      const text = texts[resid].slice(start, end);
      // Replace from the right so earlier positions stay true.
      const words = group.map(h => ({ at: h.index - start + h.find.lastIndexOf(h.orig), orig: h.orig, fix: h.fix })).sort((a, b) => b.at - a.at);
      let out = text;
      for (const w of words) out = out.slice(0, w.at) + w.fix + out.slice(w.at + w.orig.length);
      textEdits.push({ what: group.map(h => h.what).join(' + '), resid: +resid, at: start, find: text, replace: out, count: 1 });
      i = j + 1;
    }
  }
  return { textEdits, occurrences: occurrences.length, skipped, slips, unmatched };
}

/* ---- DATA_FIX_COMMUNITY_TYPOS ---------------------------------------------
   Written by `node utilities/community_text_patch.mjs --write-js <collection
   dir>`, never by hand: [file, original, fix, the two words before, the two
   after], every pair in the collection, its files in name order. */
// @@COMMUNITY-TYPOS-BEGIN
const DATA_FIX_COMMUNITY_TYPOS = [
  ["Aethon","mischevious","mischievous","with a","grin."],
  ["Aethon","be","me","just ask","about @missiles."],
  ["Aethon","Your","You're","","standing in"],
  ["Alastor","propisition","proposition","have a","that might"],
  ["Alastor","Execellent","Excellent","",". I'm"],
  ["Alastor","I'm am","I am","Execellent.","looking for"],
  ["Alastor","carcas","carcass","or whole",", of"],
  ["Alcestris","dimished","diminished","ancient woman,","by age,"],
  ["Alcestris","dimished","diminished","ancient woman,","by age,"],
  ["Anisa","everbody","everybody","they discovered","gone from"],
  ["Anisa","Atusa","Atussa","Founder","was originally"],
  ["Anisa","I why","why","which is","I live"],
  ["Anisa","attempt","attempts","of these","was by"],
  ["Anisa","Cademiain","Cademia in","here in","742 A.T."],
  ["Anisa","decendants","descendants","were the","of the"],
  ["Anisa","year","years","camp for","."],
  ["Anisa","Execellent","Excellent","","! I've"],
  ["Anisa","learn","learned","Alaric and","some interesting"],
  ["Anisa","is","his","ever meeting","father, he"],
  ["Anisa","endevour","endeavour","I shall","to find"],
  ["Anisa","facinating","fascinating","Hm,",". I"],
  ["Anisa","disappears","disappeared","'Golem Hunter',","here in"],
  ["Anisa","Your","You're","","standing in"],
  ["Antenor","no","not","understand -","many can"],
  ["Antenor","forgive","forgives","that she","you."],
  ["Antenor","Your","You're","","standing in"],
  ["Apis","Two-Taled","Two-Tailed","@inn, the","Rat."],
  ["Apis","Two-Taled","Two-Tailed","frequent the","Rat."],
  ["Atymnius","sudden","suddenly","tunnels, and","I feel"],
  ["Atymnius","to","too","strange dream,","- something"],
  ["Atymnius","collapse","collapsed","it's been",", and"],
  ["Berossus","Trues","Truth","or abilities?","knows no"],
  ["Berossus","Halso","Halos","she was","."],
  ["Berossus","germaine","germane","details not","to the"],
  ["Berossus","lieing","lying","somebody is",", which"],
  ["Berossus","unknow","unknown","race, walking","amongst us."],
  ["Berossus","truely","truly","Did he","see Pelagon,"],
  ["Berossus","Halso","Halos","she was","."],
  ["Berossus","germaine","germane","details not","to the"],
  ["Berossus","lieing","lying","somebody is",", which"],
  ["Berossus","unknow","unknown","race, walking","amongst us."],
  ["Berossus","madnes","madness","form of","or drunkness."],
  ["Berossus","drunkness","drunkenness","madnes or",". Be"],
  ["Berossus","truely","truly","Did he","see Pelagon,"],
  ["Berossus","truely","truly","Did he","see Pelagon,"],
  ["Berossus","Your","You're","","standing in"],
  ["Bias","man girl","young man","was a","."],
  ["Bryaxis","king","kind","see a","looking elderly"],
  ["Bryaxis","surene","serene","with a","expression."],
  ["Bryaxis","king","kind","see a","looking elderly"],
  ["Bryaxis","surene","serene","with a","expression."],
  ["Bryaxis","usefull","useful","it is","when combined"],
  ["Bryaxis","ones","one's","simple, perhaps","favorite song."],
  ["Bryaxis","Your","You're","","standing in"],
  ["Dares","Your","You're","","standing in"],
  ["Dryas","Your","You're","","standing in"],
  ["Dymas","to","too","I'm much","young for"],
  ["Eteocles","It's","Its","da stuff.","effects could"],
  ["Halos","seems","seem","That does","to corroborate"],
  ["Halos","Opheltuis","Opheltius","","represents House"],
  ["Halos","bezerk","beserk","have gone","."],
  ["Naxos","I and","and I","saw -","still say"],
  ["Neoptolemus","a","an","You see","old man,"],
  ["Neoptolemus","a","an","You see","old man,"],
  ["Oeneus","Your","You're","","standing in"],
  ["Opheltius","incompetant","incompetent","be that","twit responsible"],
  ["Opheltius","Your","You're","","standing in"],
  ["Stentor","know","known","I've been","to have"],
  ["Stentor","burries","buries","Stentor","his head"],
  ["Stentor","Now","No","saw him.","way I"],
  ["Thoas","Your","You're","","standing in"],
  ["Darius","doing","going","you are","to forge"],
  ["Darius","doing","going","you are","to forge"],
  ["Darius","east","west","Hall north","through the"],
  ["Darius","Catamarca","Odemia","","lies north"],
  ["Mantinea","husbands","husband's","share my","distrust of"],
  ["Mantinea","hi","him","even saw","meeting with"],
  ["Metopes","it's","its","as to","origin and"],
  ["Metopes","know","known","Catamarca is","for the"],
  ["Polydamas","spasm","spasms","Coughing","wrack his"],
  ["Polydamas","Andyou","And you","is Polydamas.","are?"],
  ["Polydamas","Andyou","And you","is Polydamas.","are?"],
  ["Polydamas","spasm","spasms","Coughing","wrack his"],
  ["Polydamas","shortlived","short-lived","were a","ruling family"],
  ["Propontis","delerious","delirious","who appears","."],
  ["Sardis","impecably","impeccably","man, dressed","."],
  ["Sardis","impecably","impeccably","man, dressed","."],
  ["Sardis","east","west","Hall north","through the"],
  ["Sardis","Catamarca","Odemia","","lies north"],
  ["Generic Cademia","Opheltuis","Opheltius","","represents House"],
  ["Generic Cademia","Your","You're","","standing in"],
  ["Generic Catamarca","east","west","Hall north","through the"],
  ["Generic Catamarca","Catamarca","Odemia","","lies north"],
  ["Generic Iron Mine","He's","His","","quarters are"],
  ["Generic Kosha","take","taken","to have","up the"],
  ["Generic Kosha","take","taking","Mountains -","the road"],
  ["Generic Land King Hall","quaters","quarters","Magpie's","are ."],
  ["Generic Land King Hall","Its","It's","road south-southeast.","the first"],
  ["Generic Pnyx","quaters","quarters","Selinus has","are ,"],
  ["Generic Pnyx","quaters","quarters","Selinus has","downstairs, but"],
  ["Generic Pnyx","quaters","quarters","His","are ,"],
  ["Generic Pnyx","northwest","northeast","past Cademia,",", past"],
  ["Generic Pnyx","northwest","northeast","and then","along the"],
  ["Generic Human","penisula","peninsula","on a","east of"],
  ["Generic Human","travelling","traveling","the famous","bard."],
  ["Generic Human","Hosue","House","","Comana is"],
  ["Generic Human","eastern","western","on the","coast of"],
  ["Generic Judge","happens","happened","that has",", he"],
  ["Generic Judge","weaking","weakening","With Alaric's",", however,"],
  ["Generic Judge","lieing","lying","detect people","to me,"],
  ["Generic Mage","Unfortunely","Unfortunately","and destruction.",", there"],
  ["Generic Mage","existance","existence","few in","today."],
  ["Generic Student","Unfortunely","Unfortunately","and destruction.",", there"],
  ["Generic Student","existance","existence","few in","today."],
  ["Generic Student","prision","prison","sort of","where all"],
  ["Generic Attis","villany","villainy","house of","and deceit."],
  ["Generic Attis","villian","villain","That","kills Opheltius,"],
  ["Generic Attis","villian","villain","still a","."],
  ["Generic Attis","villian","villain","That","kills Opheltius,"],
  ["Generic Dodona","Two-Taled","Two-Tailed","runs the","Rat in"],
  ["Generic Dodona","Dares","Dares'","Dares runs","Eatery, one"],
  ["Atreus","Ariethous","Areithous","involvement with",". I"],
  ["Atreus","take","taking","Mountains -","the road"],
  ["Ennomus","a","an","You see","old, dirty,"],
  ["Ennomus","a","an","You see","old, dirty,"],
  ["Itanos","take","taking","Mountains -","the road"],
  ["Laodice","Ariethous","Areithous","the reasons","and I"],
  ["Myus","take","taking","Mountains -","the road"],
  ["Pelagon","emperil","imperil","- you","the world"],
  ["Pelagon","obstinance","obstinacy","continue this","."],
  ["Alaric","you","you've","you until","registered this"],
  ["Emesa","mericifully","mercifully","quickly and","..."],
  ["Emesa","travelling","traveling","you'll be","far and"],
  ["Emesa","quaters","quarters","Magpie's","are ."],
  ["Emesa","Its","It's","road south-southeast.","the first"],
  ["Hector","rapant","rampant","@criminals roaming",", and"],
  ["Magpie","Kind","King","The","is Alaric"],
  ["Magpie","knowlege","knowledge","for that","."],
  ["Magpie","Jhaixus","Jhiaxus","","is one."],
  ["Antiphus","dottering","doddering","is a","old fool,"],
  ["Ariadne","families","family's","have my","eternal gratitude!"],
  ["Ascalon","incompetant","incompetent","distain, you","twit."],
  ["Ascalon","you","your","pleased with","rescuing Ariadne."],
  ["Ascalon","on","one","we @captured","of the"],
  ["Ascalon","you","your","pleased with","rescuing Ariadne,"],
  ["Crito","though","thought","but I","maybe... well,"],
  ["Crito","you","your","I'm","humble host,"],
  ["Gate Guard","Euoxus'","Eudoxus'","member of","gang is"],
  ["Gate Guard","villian","villain","a foul","who has"],
  ["Philinus","am I","I am","am sorry,","too distraught"],
  ["Philinus","vaction","vacation","visit on",", were"],
  ["Philinus","vaction","vacation","visit on",", were"],
  ["Philinus","or","for","thank you","re-uniting old"],
  ["Sacas","specificly","specifically","should ask","about the"],
  ["Sacas","infomation","information","for the",", though."],
  ["Sacas","youfailed","you failed","know that","to rescued"],
  ["Sacas","rescued","rescue","youfailed to","Ariadne -"],
  ["Sacas","possiblity","possibility","a definite","."],
  ["Sacas","alredy","already","what I've","told you."],
  ["Sacas","facinating","fascinating","Well,",". Looks"],
  ["Sacas","facinating","fascinating","Well,",". Looks"],
  ["Thersites","ad","and","the sea","then fished"],
  ["Thersites","it's","its","I'd appreciate","return..."],
  ["Thersites","Its","It's","","a ring"],
  ["Thersites","enscription","inscription","with the","\"To Hapede"],
  ["Thersites","Its","It's","","a ring"],
  ["Thersites","enscription","inscription","with the","\"To Hapede"],
  ["Thersites","mages","mages'","If the","justice system"],
  ["Thersites","mages","mages'","If the","justice system"],
  ["Thersites","our","out","can find","more than"],
  ["Tlepolemus","satifying","satisfying","much more","than @fishing..."],
  ["Sabinate","You're","Your","not pure.","very presense"],
  ["Sabinate","presense","presence","You're very","offends us."],
  ["Sabinate","@essense","@essence","bear the","of corruption!"],
  ["Sabinate","@essense","@essence","bear the","of corruption!"],
  ["Sabinate","@essense","@essence","bear the","of corruption!"],
  ["Sabinate","You're","Your","not pure.","very presense"],
  ["Sabinate","presense","presence","You're very","offends us."],
  ["Sabinate","knowlege","knowledge","That","is beyond"],
  ["Sabinate","knowlege","knowledge","That","is beyond"],
  ["Sabinate","with","within","Sealed it",", we"],
  ["Sabinate","is it's","its","land. And","@troubles, so"],
  ["Seqedher","phoneme","phonemes","of the","I've assigned"],
  ["Unhayt","phoneme","phonemes","of the","I've assigned"],
  ["Uset","phoneme","phonemes","of the","I've assigned"],
  ["Asteropaeus","shys","shies","boy, who","away when"],
  ["Pelops","knowlege","knowledge","Sorry, my","doesn't go"],
  ["Pelops","you","your","Pelops. And","name is?"],
  ["Eurybates","He's","His","","quarters are"],
  ["Jhiaxus","phoneme","phonemes","of the","I've assigned"],
  ["Jhiaxus","phoneme","phonemes","of the","I've assigned"],
  ["Jhiaxus","bear","bears","that one","the key"],
  ["Larisa","interested","interesting","All quite",", but"],
  ["Larisa","wehose","whose","a building","doors refuse"],
  ["Larisa","me","my","to give","report to"],
  ["Larisa","might","mighty","once a","Seldane city,"],
  ["Borus","years","year's","including this","must, all"],
  ["Borus","years","year's","including this","must, all"],
  ["Charax","anway","anyway","I'm doing",", so"],
  ["Charax","anway","anyway","I'm doing",", so"],
  ["Charax","it","I","Yes -","was taught"],
  ["Charax","thank","thanks","find some,","."],
  ["Charax","Execellent","Excellent","","! That"],
  ["Charax","Execellent","Excellent","","! That"],
  ["Charax","elimating","eliminating","matter of","possibilities."],
  ["Charax","essense","essence","captured the",", but..."],
  ["Charax","I'm","its","Perhaps","not strong"],
  ["Charax","essense","essence","Sea polarity","and neutralizing"],
  ["Charax","neutralizing","neutralize","essense and","it with"],
  ["Charax","facinating","fascinating","is quite",", actually"],
  ["Charax","image","imagine","you can","that this"],
  ["Charax","facinating","fascinating","is quite","indeed."],
  ["Charax","bring","bringing","you for","up such"],
  ["Charax","facinating","fascinating","such a","issue..."],
  ["Charax","though","thought","but I","you said"],
  ["Charax","along","alone","leave me","with my"],
  ["Demodocus","knowlege","knowledge","much antisocial",", and"],
  ["Demodocus","@travelling","@traveling","despite the","."],
  ["Demodocus","wanning","waning","has been",", and"],
  ["Demodocus","travelling","traveling","my time",", and"],
  ["Eioneus","it's","its","and with","alchemical properties,"],
  ["Ghosts","jestures","gestures","The figure","about."],
  ["Glaucus","vacently","vacantly","man, staring","."],
  ["Glaucus","vacently","vacantly","man, staring","."],
  ["Glaucus","transfered","transferred","is then","to small"],
  ["Glaucus","years","year's","as this","@must."],
  ["Glaucus","get's","gets","guess @Borus","the profits"],
  ["Ignae","trancend","transcend","their powers","the axis,"],
  ["Ignae","Jhaixus","Jhiaxus","","attempted to"],
  ["Ignae","Jhaixus","Jhiaxus","downfall of",", and"],
  ["Ignae","Jhaixus","Jhiaxus","case of","and Jinrai,"],
  ["Jinrai","yo","you","appears before","."],
  ["Meleager","be","me","just ask","about @awareness."],
  ["Meleager","be","me","just ask","about @awareness."],
  ["Meleager","use","used","I am","to travelling"],
  ["Meleager","travelling","traveling","use to","out in"],
  ["Omen","appear","appears","Omen suddenly","."],
  ["Timon","facinating","fascinating","Really, how",". I"],
  ["Timon","our","out","she isn't","exporing. She"],
  ["Timon","exporing","exploring","isn't our",". She"],
  ["Timon","swap","swamp","in this","and all,"],
  ["Timon","assistent","assistant","is her","Joppa."],
  ["Timon","swap","swamp","in this","and all,"],
  ["Timon","assistent","assistant","is her","Joppa."],
  ["Timon","facinating","fascinating","them. Most","."],
  ["UrSylph","whisp","wisp","see a","of air,"],
  ["UrSylph","@imprisionment","@imprisonment","Our","has finally"],
  ["UrSylph","smited","smitten","would have","any who"],
  ["UrSylph","whisp","wisp","see a","of air,"],
  ["UrSylph","existance","existence","@sense your",", and"],
  ["UrSylph","Pityful","Pitiful","","beings. Though"],
  ["Helen","wearly","weary","tired and","looking woman."],
  ["Lindus","matter","matters","you have","more pressing."],
  ["Lindus","matter","matters","you have","more pressing."],
  ["Lindus","eventuallities","eventualities","for all",", but"],
  ["Lindus","secret","secrets","<,the> greatest",". A"],
  ["Lindus","Eigth","Eighth","in the","Degree Hall."],
  ["Lindus","Metic","Metics","","are a"],
  ["Lindus","inqusitive","inquisitive","to overly","students."],
  ["Lindus","quaters","quarters","Selinus has","are ,"],
  ["Lindus","quaters","quarters","Selinus has","downstairs, but"],
  ["Lindus","quaters","quarters","His","are ,"],
  ["Lindus","northwest","northeast","past Cademia,",", past"],
  ["Lindus","northwest","northeast","and then","along the"],
  ["Palaestra","it's","its","to grasp","higher concepts."],
  ["Palaestra","our","out","vital essence","of the"],
  ["Palaestra","quaters","quarters","Selinus has","are ,"],
  ["Palaestra","quaters","quarters","Selinus has","downstairs, but"],
  ["Palaestra","quaters","quarters","His","are ,"],
  ["Palaestra","northwest","northeast","past Cademia,",", past"],
  ["Palaestra","northwest","northeast","and then","along the"],
  ["Paris","interest","interests","are your","?"],
  ["Paris","quaters","quarters","Selinus has","are ,"],
  ["Paris","quaters","quarters","Selinus has","downstairs, but"],
  ["Paris","quaters","quarters","His","are ,"],
  ["Paris","northwest","northeast","past Cademia,",", past"],
  ["Paris","northwest","northeast","and then","along the"],
  ["Pheres","rythm","rhythm","\"...a natural","...\"%"],
  ["Pheres","execellent","excellent","Ah,","! You've"],
  ["Pheres","execellent","excellent","Ah,","! You've"],
  ["Pheres","retreive","retrieve","you please","it for"],
  ["Pheres","retreive","retrieve","you please","it for"],
  ["Pheres","essense","essence","If some","can be"],
  ["Pheres","my","mind","detailed study,","you."],
  ["Pheres","damaged","damage","involves repairing","done to"],
  ["Pheres","undamage","undamaged","with the","body."],
  ["Pheres","Once","One","","could either"],
  ["Pheres","step","steps","take small","to repair"],
  ["Pheres","apple","apply","phases, or","an external"],
  ["Pheres","quaters","quarters","Selinus has","are ,"],
  ["Pheres","quaters","quarters","Selinus has","downstairs, but"],
  ["Pheres","northwest","northeast","past Cademia,",", past"],
  ["Pheres","northwest","northeast","and then","along the"],
  ["Selinus","nor","not","I'm","sure where"],
  ["Selinus","your","yours","- what's","?"],
  ["Selinus","Eigth","Eighth","to the","Degree Hall"],
  ["Selinus","quaters","quarters","His","are ,"],
  ["Selinus","northwest","northeast","past Cademia,",", past"],
  ["Selinus","northwest","northeast","and then","along the"],
  ["Tros","You're","Your","","experience isn't"],
  ["Tros","knowlege","knowledge","gain this","."],
  ["Tros","advance","advanced","for more","material."],
  ["Tros","though","thought","can be","of as"],
  ["Tros","enscribed","inscribed","rune is","..."],
  ["Tros","quaters","quarters","Selinus has","are ,"],
  ["Tros","quaters","quarters","Selinus has","downstairs, but"],
  ["Tros","quaters","quarters","His","are ,"],
  ["Tros","northwest","northeast","past Cademia,",", past"],
  ["Tros","northwest","northeast","and then","along the"],
];
// @@COMMUNITY-TYPOS-END
