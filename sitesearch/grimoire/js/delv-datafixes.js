/* delv-datafixes.js -- fixes to Cythera Data, as data.

   Every change this project makes to the scenario to fix it, one entry a
   fix, in the form js/delv-datapatch.js applies, the Patches section offers
   one by one, and the builders in `utilities/` write out as the patches
   they always made. This is the file to edit: add an entry, change an
   edit, drop one. Nothing here is the file's bytes except the text and the
   instructions each edit expects to find, which is what makes a wrong file,
   or one patched already, stop rather than patch. The causes are in the
   workbench's doc/bugs.md, under the title each entry's comment names.

   They were eleven Node builders from 24 to 28 September 2026, each writing
   a separate Magpie patch, and a twelfth, combined_patch.mjs, chaining seven of
   them into "Cythera All Fixes". They moved here on 28 September 2026 so
   that a visitor can choose them one at a time; each builder now gives its
   stage here and writes the same patched file it wrote before (compared
   byte for byte on the day).

   AN ENTRY.
     id, title   a name that does not change, and one line of what it does,
                 as the player would see it
     name        a few words on a separate line over the title, written by
                 the maintainer, as is the title of a fix that has one
                 (17 October 2026); a fix without one shows its title alone.
                 None has one on main since 20 October 2026: the names
                 are kept on the branch `fix-names`, one commit that puts
                 them back
     group       which list the Patches section shows it in (DATA_FIX_GROUPS),
                 which also places the program's fixes (APP_FIX_GROUP) and
                 DATA_RSRC_FIXES below
     stage       when it is applied (DATA_FIX_STAGES, below)
     by          whose published work the fix is built from, shown beside it
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
                 September 2026). One that begins "in part" is marked
                 "(partially tested)" (13 October 2026): seen working in
                 some of its places and not the rest.

   THE STAGES, AND WHY THIS ORDER (combined_patch.mjs's, 25 September 2026).
   A Magpie patch contains whole resources, so two patches that touch one
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
   comes after the list (28 September 2026; until then it was part of the
   text stage): the list finds each typo by the words around it as the game has
   them, and the British spelling changed a word beside Bryaxis's "ones",
   which was then not found. The American spelling changes none, so "All
   Fixes" came out the same either way. The map stage
   could come anywhere: it changes two maps, 0x8006 and 0x801F, which no
   other stage touches, and it finds its squares by the tiles on them. The
   three larger changes were separate patches at the maintainer's word,
   each touching one resource no other fix does (the kill helper, the spell,
   the character table), and came after everything until 29 September 2026;
   they come before the text now, since the olde spelling's "ye" changes
   words in the kill helper's and the spell's lines, which moved the
   offsets Resurrection's edit is anchored to. No text stage touches their
   code, so with any other spelling the file is the same either way.

   Any subset of the fixes applies, because every edit checks what it
   expects: an edit that depends on another stops the build by name rather
   than assume. utilities/data_fix_check.mjs checks that for every fix alone,
   every fix together, and each left out.

   NOT HERE. The program's fixes (js/delv-appfixes.js), which no Magpie
   patch reaches: Magpie imports one Resource Manager call and it is a read.
   "Beserk", "celstial" and the rest of the program's strings, for the same
   reason. The jokes and the recastings (Sour Grapes, the Pipes of the Deep, the Voices of the Hall,
   the Strine opening), which are separate builders and not fixes. */

const DATA_FIX_STAGES = ['found', 'community', 'bugfix', 'further', 'apart', 'cost', 'text', 'community-text', 'spelling', 'map'];
// The stages whose edits are found in the file, and so are sorted before
// they are applied (js/delv-datapatch.js).
const DATA_FIX_STAGE_SORTED = ['further'];

// The Patches section's lists, in its order. By what a fix touches since
// 1 October 2026, at the maintainer's word; until then they were by who
// found each fix, which the stages and the comments below still record.
// The three larger changes (the stage "apart") went into the lists that the
// same day.
const DATA_FIX_GROUPS = [
  { id: 'talk', title: 'Conversations' },
  { id: 'quests', title: 'Quests and the To Do list' },
  { id: 'rules', title: 'Spells, skills and fighting' },
  { id: 'items', title: 'Items' },
  { id: 'world', title: 'People and places' },
  // Only the program's fixes are here (APP_FIX_GROUP, js/delv-appfixes.js):
  // keys, the mouse, a gamepad, windows, menus and the music.
  { id: 'interface', title: 'Controls, windows and music' },
  { id: 'text', title: 'Text' },
  // Two lists left for a visitor to choose, as Design Changes are (`off`,
  // in neither preset), at the maintainer's word of 21 October 2026: the
  // slips in the books, notes, letters and signs, since a writer in the
  // world could have made them; and wrong names and facts in words that
  // are otherwise right, since a speaker could be mistaken on purpose.
  { id: 'writings', title: 'Books and Notes', off: true, note: 'These correct slips in the books, notes, letters and signs you find in the game, which could be mistakes their writers made.' },
  { id: 'facts', title: 'Factual Errors', off: true, note: 'These correct names and facts that are wrong in lines whose wording is right, which could be mistakes the speaker made.' },
  // Fixes nobody can see in play: the file is put right and the screen is
  // the same either way (the maintainer, 12 October 2026, of the Gate
  // Guard's reply). Named Hidden Bugs on 16 October 2026, his wording. A separate list, so that a mark of "untested" there
  // is read for what it is: there is nothing to see.
  { id: 'hidden', title: 'Hidden Bugs', note: 'These are bugfixes you’d only notice if you made relevant patches to change default gameplay.' },
  // The larger changes, each a design call rather than a mended slip, in a
  // separate list below the rest (the maintainer, 1 October 2026).
  { id: 'design', title: 'Design Changes', off: true, note: 'These are bug fixes for aspects that might actually be intentional, or for which the issue necessitates a creative solution.' },
];

// The text's choices, by the name their options share, as the Patches
// section labels each row of buttons, in its order.
const DATA_FIX_CHOICES = [
  { id: 'spelling', title: 'Spelling' },
  { id: 'two-taled', title: 'The Two-Taled Rat' },
  { id: 'land-king', title: 'Land King' },
  { id: 'areithous', title: 'Areithous' },
  { id: 'hyphens', title: 'Hyphens' },
  // Not a spelling: a figure the creation dialog states and the game does
  // not give. Its third button states that.
  { id: 'beserker', title: 'The Berserker\u2019s Mind', none: 'Leave both as they are' },
  // The set's name: "of Wisdom" in the To Do lines, Itanos and one of
  // Anisa's, "of Knowledge" in her other and in Selinus, whose list has
  // "Wisdom" as the second volume. Knowledge first, at the maintainer's word
  // (21 October 2026), since it leaves "Wisdom" to the one book.
  { id: 'sapphire', title: 'The Sapphire Books' },
  // Neither way is wrong, and the game has both, so none is picked when the
  // page opens (`unpicked`): the maintainer's three buttons, 21 October 2026.
  { id: 'oxford', title: 'Oxford Commas', none: 'Leave them as they are', unpicked: true },
];

function dataFixKeyword(what, resid, at, kw, target) {
  return { what, resid, at, replaceOp: true, expect: { [at]: 'conversation_response' }, code: `conversation_response "${kw}" -> ${target}` };
}
function dataFixTalk(character, slot) { return `sys TalkParticipant\n${character}\nbyte 0x0${slot}\nend`; }
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
// Several instructions of one place replaced, each edit expecting only its
// own, since each is checked after the one before it is made.
function dataFixOneOp(p, what, resid, k, code) {
  return { what, resid, at: p.at(k), replaceOp: true, expect: { [p.at(k)]: p.text(k) }, code };
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
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Ake waiting with her errand (flag 2 and behaviour 151 by an edit), spoken to; the To Do entry saved is line 113, against 114 unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: after Ake’s errand the To Do list reads "Ask Halos about Comana", against "Ask Thuria about Iron Mine" unpatched',
    edits: [
      { what: 'Ake’s To Do line', resid: 0x1820, at: 0x0109, replaceOp: true, expect: { 0x0101: 'sys AddQuest', 0x0102: 'byte 0x0A', 0x0109: 'byte 0x72' }, code: 'byte 0x71' },
    ] },
  // Sleep's magic bonus (0xE93): the guard and the cap both read full
  // health where full magic is meant; both now read full magic.
  { id: 'sleep-magic', group: 'rules', stage: 'found', title: 'Sleep now restores magic up to full magic, instead of up to full health',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: a hero with 28 health and 30 of 60 magic slept until midnight in the bed of Land King Hall’s room 2, "You sleep soundly.", and woke with 60 magic, against 45 unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: 30 of 60 magic, the bed of Land King Hall’s room 2, Until Midnight, "You sleep soundly." and 60 of 60',
    edits: [
      { what: 'sleep’s magic cap', resid: 0xE93, at: 0x0248, replaceOp: true, expect: { 0x0248: 'get_field full_health', 0x024E: 'set_field magic' }, code: 'get_field full_magic (0x1F)' },
      { what: 'sleep’s magic guard', resid: 0xE93, at: 0x0219, replaceOp: true, expect: { 0x0216: 'get_field magic', 0x0219: 'get_field full_health', 0x021B: 'lt' }, code: 'get_field full_magic (0x1F)' },
    ] },
  // The bartenders' rumours (0x813): the choice between the town's
  // rumours and the general ones rolled Random(0, 1), which is always 0; it
  // rolls Random(0, 2), so both are heard.
  { id: 'rumours', group: 'talk', stage: 'found', title: 'Bartenders can now tell Cythera\u2019s general rumors, not just local ones',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: eight rounds bought from Apis in Cademia; alone and on “All Fixes” one of them drew a rumour of the general list, "They say that a bunch of those old ruins were found down in a swamp to the south." alone, against the town’s list only unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: eight rounds bought from Apis, among them "They say that a bunch of those old ruins were found down in a swamp to the south." and four more of the general list, against the town’s list only in eight rounds unpatched',
    edits: [
      { what: 'the bartenders’ rumours', resid: 0x813, at: 0x02AB, replaceOp: true, expect: { 0x02A8: 'sys Random', 0x02A9: 'byte 0x00', 0x02AB: 'byte 0x01' }, code: 'byte 0x02' },
    ] },
  // Eating (0xE46) was a fix here until 9 October 2026: the helper's jitter,
  // Random(0, 1) - Random(0, 1), always 0. No script of any release calls the
  // helper, so the fix changed nothing a player could meet; its two edits
  // are part of the design change `eat-to-heal`, which gives it callers.
  // The Gate Guard's speaker (0x1864): one reply was given to character 54,
  // the Odemia Guard; it is given to himself. The two share a portrait, so
  // nothing changes on screen, but the number is right.
  { id: 'gate-guard', group: 'hidden', stage: 'found', title: 'A reply of the Gate Guard\u2019s is now spoken by him, instead of by the Odemia Guard',
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
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: a pail of water poured on a full pitcher, "The pitcher is already full." alone, against that line and "You can’t use water there..." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "The pitcher is already full." alone',
    edits: [
      { what: 'water into a full pitcher', resid: 0xE0A, at: 0x00EA, expect: { 0x00CD: 'string(implicit) "The pitcher is already full.', 0x00EA: 'branch 0x0121', 0x00ED: 'string(implicit) "The pitcher is now filled with water' },
        code: 'return\nword False\nend' },
    ] },
  // A pitcher dipped in the wine urn (0x10A0): an empty pitcher used on a
  // fountain, a pool or the water urn fills with water, and on anything else
  // but a well or a goat printed "The pitcher is empty.", the wine urn (217)
  // included, though the urn used on the pitcher fills it. It fills with wine
  // now, Data1 3, the pitcher's number for wine, with a line shaped like
  // its water line. The test goes where the goat test's "no" already lands,
  // so the rest of the chain is untouched. (The maintainer's word, 27
  // September 2026.)
  { id: 'pitcher-in-wine', group: 'items', stage: 'found', title: 'Using an empty pitcher on the wine urn now fills it with wine, instead of showing \u201cThe pitcher is empty.\u201d',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: an empty pitcher used on the wine urn, "The pitcher is now full of wine." and the pitcher saved holding wine, against "The pitcher is empty." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "The pitcher is now full of wine.", against "The pitcher is empty." unpatched',
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
  // loop's leftover variable; with the fix each reads it off the weapon (Arg02).
  { id: 'weapon-skill', group: 'rules', stage: 'community', title: 'Sword, Axe and Mace skill now counts in a fight, instead of counting for nothing',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: a hero given a sword in hand and Sword skill 15 by an edit, thirty attacks on Apis, her health set to 255; she is dead within nineteen blows, some of them "ground" and "shredded", against alive at 12 of 255 unpatched with none above "smashed". With the skill at a level the game reads as none, the two fight alike; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the same hero and sword, Apis dead at the sixteenth attack, two blows "ground a woman to dust", against, unpatched there, Apis dead at the twenty-eighth attack and no blow above "smashed"',
    edits: [
      { what: 'weapon skill, damage', resid: 0xE87, at: 0x0096, replaceOp: true, expect: { 0x0096: 'local Var02', 0x0097: 'class_member 0x2A03' }, code: 'arg Arg02' },
      { what: 'weapon skill, margin', resid: 0xE87, at: 0x0088, replaceOp: true, expect: { 0x0088: 'local Var02', 0x0089: 'class_member 0x2A03' }, code: 'arg Arg02' },
    ] },
  // "Indeed I am." was drawn as the hero's (0x1804): the string is split and
  // Hadrian named between the halves.
  { id: 'hadrian-indeed', group: 'talk', stage: 'community', title: 'Hadrian now says \u201cIndeed I am.\u201d instead of you replying to yourself',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: "son" to Hadrian, "Indeed I am." drawn beside his portrait, against beside the hero’s, over the topics, unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Indeed I am." beside Hadrian’s portrait',
    edits: [
      { what: '"Indeed I am." is Hadrian’s', resid: 0x1804, at: 0x02A9, to: 0x02E0,
        expect: { 0x02A9: 'string(implicit) "\\"Yes, you should be quite proud.\\"*\\"Indeed I am.\\""', 0x02D9: 'sys TalkParticipant', 0x02E0: 'branch' },
        code: `string(implicit) "\\"Yes, you should be quite proud.\\"*"\n${dataFixTalk('short 0x0004', 0)}\nstring(implicit) "\\"Indeed I am.\\""` },
    ] },
  // Hadrian asks after Hector (0x1804): his "son" topic tested his own alive
  // bit; it tests Hector's.
  { id: 'hadrian-hector', group: 'talk', stage: 'community', title: 'You can now tell Hadrian that his son Hector has died',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Hector’s flag 0 set and his alive bit cleared by an edit, "son" to Hadrian, "I regret to tell you that Hector has died in my service.", against "Yes, you should be quite proud." unpatched; with Hector alive, that line on both; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: with Hector dead, "I regret to tell you that Hector has died in my service."',
    edits: [
      { what: 'Hadrian tests Hector', resid: 0x1804, at: 0x0299, replaceOp: true, expect: { 0x0299: 'word Character.Hadrian', 0x029F: 'if_not' }, code: 'word Character.Hector' },
    ] },
  // Aethon told to leave (0x1861): "Maybe it is time for me to catch some
  // rats for myself..." is followed by LeaveParty, as Hector's is.
  { id: 'aethon-leaves', group: 'talk', stage: 'community', title: 'Aethon actually leaves the party when he says he will',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: Aethon in the party, "leave", "Maybe it is time for me to catch some rats for myself..." and he is saved out of the party, against the same line and still in it unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "leave" drew "Maybe it is time for me to catch some rats for myself...", the conversation ended and he was gone from the party',
    edits: [
      { what: 'Aethon leaves', resid: 0x1861, at: 0x0765, replaceOp: true, expect: { 0x072B: 'string(implicit) "\\"Maybe it is time', 0x0765: 'branch' },
        code: 'sys LeaveParty\narg Arg00\nend\nreturn\nbyte 0x00\nend' },
    ] },
  // Alaric forgets 201 (0x1802): the "hist" topic's test of his flag 2 was
  // the wrong way round; a `not` turns it.
  { id: 'alaric-201', group: 'talk', stage: 'community', title: 'Alaric no longer re-forgets the year his mother died',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Alaric’s flag 2 set by an edit, "hist", "My history, I remember a few parts...", against "There are days I don’t remember what happened the day before..." unpatched; with the flag clear, the two the other way round; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "My history, I remember a few parts...", against "There are days I don’t remember what happened the day before..." unpatched',
    edits: [
      { what: 'Alaric remembers 201', resid: 0x1802, at: 0x1F3B, expect: { 0x1F34: 'call_resource 0xF02', 0x1F3B: 'then' }, code: 'not' },
    ] },
  // Awakening's blank conversation (0x1A13): the sleeper and the hero are
  // named as speakers before the sleeper's Talk, as the game's Talk
  // command assigns them.
  { id: 'awakening', group: 'rules', stage: 'community', title: 'You can now talk to someone woken by Awakening, instead of getting a blank conversation',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Awaken, given as an ability by an edit, cast on Theano asleep in Cademia, "A person sleeping is awoken." and the conversation opens with her portrait and the hero’s, against a window with neither unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "A person sleeping is awoken." and the conversation opens with both portraits, against a window with neither unpatched',
    edits: [
      { what: 'Awakening shows its speakers’ names', resid: 0x1A13, at: 0x00D7, expect: { 0x00D5: 'sys OpenConversation', 0x00D7: 'method Talk' },
        code: dataFixTalk('arg Arg01', 0) + '\n' + dataFixTalk('global PlayerCharacter (0x5)', 2) },
    ] },
  // Niobe's answers drawn as Helen's (0x1859): Niobe is named again after
  // Helen's interruption.
  { id: 'niobe', group: 'talk', stage: 'community', title: 'Niobe\u2019s answers after Helen interrupts are now drawn as hers, instead of as Helen\u2019s',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Helen in the party by an edit, Niobe spoken to at noon in Pnyx, Helen’s "It’s OK, Niobe.", then "name"; "I’m Niobe." is drawn beside Niobe’s portrait, against beside Helen’s unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: with Helen beside the hero, after her "It’s OK, Niobe.", "I recognize you from my dream!" beside Niobe’s portrait',
    edits: [
      { what: 'Niobe speaks for herself', resid: 0x1859, at: 0x013F, expect: { 0x0127: 'string(implicit) "man with your nonsense', 0x013F: 'exit' }, code: dataFixTalk('arg Arg00', 0) },
    ] },
  // Lindus nags for ever (0x1850): the training route that hands over the
  // grimoire now sets quest flag 1 and strikes the To Do line, as accepting
  // at the first meeting does.
  { id: 'lindus', group: 'quests', stage: 'community', title: 'Lindus now stops nagging once he has handed over the grimoire, instead of nagging for ever',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Lindus’s first offer declined, then "trai" and Mana; he hands over the grimoire and parts with "My door is always open to a student.", quest flag 1 saved set, against "Please come back, there is some training that we can give you..." and the flag clear unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the first offer declined, "trai", Mana, the grimoire, and "My door is always open to a student."',
    edits: [
      { what: 'Lindus’s training route', resid: 0x1850, at: 0x05C9, expect: { 0x05C6: 'then', 0x05C9: 'string(implicit) "*\\"The most prized possession' },
        code: 'sys SetStateFlag\nbyte 0x01\nword True\nend\nsys CompleteQuest\nbyte 0x02\nend' },
    ] },
  // Keywords typed with a space: "inn, pari" and its kind lose the space after
  // the comma, so the word after it answers without a space typed first. Five
  // keyword lists that the board reported (0x1828, 0x1829, 0x182A, 0x1818,
  // 0x080F), and two this project found (0x186D Demodocus's "fish, tlep",
  // 0x1878 Sabinate's "form, shap"), which were built in the found stage.
  { id: 'keyword-spaces', group: 'talk', title: 'The game now recognizes seven keywords without a space before them',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”, in part (Crito and Apis of the seven): "crit" to Crito in Odemia drew his innkeeper’s offer, which opens "Yes - are you interested in a", against "My cousin Crito runs the Titan’s Head in Odemia." unpatched, and "apis" to Apis in Cademia the innkeeper’s offer there, against "My cousin Apis runs the Two-Taled Rat in Cademia."; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "crit" to Crito and "apis" to Apis each drew the innkeeper’s offer; the same save and word with no patch installed, 11 October 2026: "crit" drew "My cousin Crito runs the Titan’s Head in Odemia."',
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
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and “All Fixes”, each installed by Magpie: the hero carrying the Crolna, "esse" to Sabinate twice; the second answer ends "We have given you the spores of the earth - more we can not help.", against the mushroom given again unpatched. Sabinate was made to stand in his hall by an edit. Not played in the fork',
    edits: [
      { what: 'Sabinate remembers the mushroom', resid: 0x1878, at: 0x0966, expect: { 0x0966: 'sys Create', 0x096A: 'short 0x010F' },
        code: 'call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x04\nend' },
    ] },
  // The rolling pin vanishing (0x10A3): the dough is deleted, not the pin.
  { id: 'rolling-pin', group: 'items', stage: 'community', title: 'Kneading now uses up the dough, instead of the rolling pin',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the rolling pin used on dough without Cooking, "You end up kneading the dough into nothingness.", the dough gone and the pin kept, against the pin gone and the dough left unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the same line, the pin kept and the dough gone, against the pin gone and the dough left unpatched',
    edits: [
      { what: 'the rolling pin', resid: 0x10A3, at: 0x0162, replaceOp: true, expect: { 0x0131: 'string(implicit) "You end up kneading', 0x0161: 'sys Delete', 0x0162: 'arg Arg00' }, code: 'arg Arg01' },
    ] },
  // The wine urn's empty pitcher (0xE0D): the pitcher's Data1 is set to 3,
  // as the water helper sets 1 and the milk helper 2. The pitcher (0x10A0)
  // reads 0 to 3 as empty, water, milk and wine, in its Examine and Use
  // tables and in its UseOn, which pours wine through this helper only at 3.
  // This edit set 1 until 27 September 2026, which filled the pitcher with
  // water.
  { id: 'wine-urn', group: 'items', stage: 'community', title: 'Using the wine urn on an empty pitcher now fills it with wine, instead of leaving it empty',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the urn used on an empty pitcher, "The pitcher is now filled with wine." and the pitcher saved holding wine, against the same line and the pitcher saved empty unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the urn used on an empty pitcher, "The pitcher is now filled with wine." and the pitcher saved holding wine. Read from a save copied out of the machine',
    edits: [
      { what: 'the wine urn', resid: 0xE0D, at: 0x0061, expect: { 0x003C: 'string(implicit) "The pitcher is now filled with wine', 0x0061: 'return' },
        code: 'set_field data1 (0x6)\narg Arg00\nend\nbyte 0x03\nend' },
    ] },
  // "You can't stuff the carcass!" on every check (0x10D2): the inventory
  // window calls member 23 on the thing under the cursor each time it checks
  // a drop, and the carcass's answer printed the line; the rejection no longer
  // prints.
  { id: 'carcass', group: 'items', stage: 'community', title: 'Dragging something over a carcass is now quiet, instead of printing \u201cYou can\u2019t stuff the carcass!\u201d at every check',
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and “All Fixes”, each installed by Magpie: a carcass in the pack used, so its window opens, and a dagger dragged from the pack into that window; nothing is printed, against "You can’t stuff the carcass!" five times and more unpatched. Not played in the fork',
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
  // to character 0 and character 0 "raised". Now a corpse of Data1 0 prints
  // "Nothing happens." and is left as it lay with its things. The spell's
  // mana is spent in Use before this runs, as for any other target; the
  // amulet returns before its charge is taken (a rock still costs one, as
  // shipped). Kept in "All Fixes" and in "Cythera Resurrection Fix" both,
  // which is why the resurrection fix finds its place rather than assuming it.
  { id: 'nobody-corpse', group: 'rules', stage: 'community', title: 'Raising a corpse that belongs to nobody does nothing, instead of making the corpse and everything on it vanish',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the Land King Amulet used on a corpse with no owner, "Nothing happens." and the corpse left, against "A cave has been brought back from the brink of death." and the corpse gone unpatched; the spell was not cast; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Nothing happens.", against "A cave has been brought back from the brink of death." unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie, the spell: Resurrection cast on a corpse with no owner, "Nothing happens." and the corpse left, against the corpse gone and no line unpatched',
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
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: a dagger put in the hero’s hand by an edit and thrown at Apis two squares off, her health set to 1; she dies and the dagger is saved in the hero’s pack, against saved inside her, a dead character, unpatched. A spear from three squares was "too far away to attack" on both; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the dagger thrown at Apis two squares off, she dies and the dagger is listed in the hero’s pack, against, unpatched there, she dies and the dagger is saved inside her',
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
    played: 'Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: Pelagon talked to with quest value 3 set to 3 by an edit, the first slide and its text fade in after the fade to black, against a screen left black through the slides unpatched. The fork’s 68K slice shows the first slide on both, so the fork does not show this fix',
    edits: [
      { what: 'the Pelagon ending fades in', resid: 0x180D, at: 0x011B, shiftAt: true,
        expect: { 0x0109: 'sys SpecialView', 0x010A: 'byte 0x03', 0x010F: 'sys Slideshow', 0x011A: 'end', 0x011B: 'set_local 0x00' },
        code: 'sys SpecialView\nbyte 0x04\nend' },
    ] },
  // Eteocles's "kesh" (0x1838): the test reads quest flag 4 (Guild
  // membership), as his other five tests do, not quest value 4, which is
  // where Demodocus is and is never 0.
  { id: 'eteocles-kesh', group: 'talk', stage: 'community', title: 'Eteocles now recognizes if you\u2019re in the Guild when you ask about kesh',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”, the person brought to the hero by the in-party bit: "kesh" to Eteocles from a hero outside the Guild drew "Youse is awful nosy.", against "Yeah, we heard of da stuff." unpatched; a Guild member’s answer was not tried; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "kesh" to Eteocles, where he stands, drew "Youse is awful nosy."',
    edits: [
      { what: 'Eteocles’s "kesh"', resid: 0x1838, at: 0x01ED, replaceOp: true, expect: { 0x01E4: 'conversation_response "kesh"', 0x01ED: 'sys GetState', 0x01EE: 'byte 0x04' }, code: 'sys GetStateFlag' },
    ] },
  // The strange device left open across a zone change (0x1175; 28 September
  // 2026). A scripted window's buttons call back with the owner the window had
  // when each was made: the widget constructor copies the window's owner
  // number into the widget's word at 4, and TWidget::RenumberParent is an
  // empty routine. Moving the party between zones gives every carried thing a
  // new number (ShuffleUpPartyInventory, then the two moves in
  // LoadLevelProps), and RenumberProp moves the window's owner with it but not
  // the buttons' copies, so each click after it worked the storage of whatever
  // thing now held the old number and changed nothing. The routine the three
  // buttons share, with the fix, checks that it was handed a strange device
  // with its window open (HasWindow, which is the program's ShowWindow) and
  // otherwise walks the party's things for the one that is, as Divide Food
  // walks them; if there is none it does nothing. Four more locals for the two
  // loops. The type is tested before HasWindow, since HasWindow brings a found
  // window to the front and an open sack's should stay where it is.
  { id: 'strange-device', group: 'items', stage: 'community', title: 'The strange device puzzle\u2019s buttons now work after a change of zone, instead of needing to be reopened to do anything',
    played: 'Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the device used on the world map and a button pressed, the hero walked into Cademia, two more buttons pressed and the lights change, against no change after Cademia unpatched. On the fork’s 68K slice no button changes a light on either',
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
  // loop hatches; one already hatched is moved to the post. (This read on
  // first writing that the creature was taken off the map as well; the call
  // that would do it sits behind a test its branch has already failed and
  // never runs.) They came back only when a later hour, schedule while
  // awake, or a new visit to the zone put them there. The helper now runs
  // Reschedule (0xE0, ScheduleTime for the current hour, not instant) when
  // the night ends, and when an owner kicks the hero out of bed, so the
  // hidden are placed as eggs and hatch as the party comes near: the pass
  // the next waking hour would have run, run immediately. The loop's exit lands
  // on the first, and nothing jumps to the second.
  { id: 'sleep-reschedule', group: 'world', stage: 'community', title: 'People are now back around the zone after a night\u2019s sleep, instead of missing until a later hour',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: the hero slept until midnight in Land King Hall, "You sleep soundly."; Alaric, Magpie and Hector are saved as waiting to appear and Hadrian and Emesa as present, against all five hidden unpatched. Read from the save, not seen on a screen; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: after the same sleep the five are saved as in the fork with the fix, against all five hidden unpatched there too. Read from a save copied out of the machine',
    edits: [
      { what: 'the sleepers rescheduled after a night', resid: 0xE93, at: 0x0160,
        expect: { 0x0151: 'set_local 0x03', 0x015D: 'branch', 0x0160: 'if_not', 0x0161: 'arg Arg03' },
        code: 'sys UnknownE0\nend' },
      { what: 'the sleepers rescheduled after a waking', resid: 0xE93, at: 0x013A,
        expect: { 0x0113: 'string(implicit) "You get kicked out of bed', 0x013A: 'sys SpecialView', 0x013B: 'byte 0x04' },
        code: 'sys UnknownE0\nend' },
    ] },
  // Rune of Warding prints nothing (0x10F5; 28 September 2026). The spell
  // (0x1A16) makes the rune with New(33, x, y, 0, 245, CurrentCharacter, 0),
  // and cbcreateprop stores the sixth argument's low byte as Data1, so a
  // rune's Data1 is its caster's character number: 1 for the hero, 6 for
  // Hector. The rune's UseOn, which what steps on it runs (the default
  // StepOn, 0x301F), prints "Something has triggered one of your runes of
  // warding." only when Data1 is 32, which is Ake, so no rune the party
  // casts ever prints it; the rune is deleted in silence, and the spell's
  // description is "signals the caster when something steps on it". No map
  // places a rune and no shipped AI script casts one, so every rune is the
  // party's, and the test goes: the line always prints.
  { id: 'rune-of-warding', group: 'rules', stage: 'community', title: 'A rune of warding now shows a message when something steps on it, instead of vanishing in silence',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the hero cast a rune on the next square and stepped on it, "Something has triggered one of your runes of warding.", against no line unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: a rune put on the next square by an edit and stepped on, the same line, against no line unpatched',
    edits: [
      { what: 'the rune of warding signals', resid: 0x10F5, at: 0x0017, to: 0x0022,
        expect: { 0x0017: 'if_not', 0x0019: 'get_field data1', 0x001B: 'short 0x0020', 0x001E: 'eq', 0x001F: 'then',
                  0x0022: 'string(implicit) "Something has triggered one of your runes of warding' },
        code: '' },
    ] },
  // Pelagon back in the kesh lab (0xF00B): his schedule's flag-0 pair (off
  // every map) is moved in front of its quest-value pair.
  { id: 'pelagon-lab', group: 'world', stage: 'community', title: 'Pelagon now stays away from the kesh lab, instead of coming back to it',
    played: 'fork, 68K, 10 October 2026, alone: Pelagon’s flag 0 and quest value 3 at 3 set by edits in a saved Kosha, the clock just before noon so the hour turns as it loads; he is saved off every map, against in the Kosha Grotto at (13,17) unpatched. With his flag clear he is in the Grotto on both. Read from the save, not seen on a screen; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: he is saved off every map, against in the Grotto at (13,17) unpatched. Read from a save copied out of the machine',
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
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the set on the table at (62,24) of Cademia, used, shows the notes P M J H D, against P M J G D unpatched; the tune itself was not played; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the set at (62,24) of Cademia shows P M J H D, its picture drawn as pipes',
    dataEdits: [
      { what: 'the placed panpipes', resid: 0x8108, fn: (b) => {
          let n = 0;
          for (const i of [402, 498]) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 153 || r[6] !== 0) throw new Error('record ' + i + ' is not a panpipes with Data1 0'); r[6] = 1; n++; }
          return n + ' sets given Data1 1';
      } },
    ] },
  // The magic arrow drawn as a stack (0x8103, and two Cademia stacks in
  // 0x8108): the count moves from Data1 to Data2.
  // A click reaches the one thing the viewer stores for a square, and a
  // loose thing outranks a door, so with a dagger lying in a doorway Use
  // finds the dagger, open door or shut, and the door cannot be worked
  // until the dagger is taken away [453@t2023]. A thing with no Use of its
  // own runs the default, 0x3009, which did nothing. It now looks over its
  // own square when it lies on the ground, and hands the Use to a door
  // there (the six classes whose ClassFlags have 0x200). A first try, the
  // door's helper not closing on a thing, could never run: the
  // click does not reach the door.
  { id: 'door-under-thing', group: 'world', stage: 'community', title: 'A door comes first: using a thing that lies in a doorway works the door, which opens and will not close on it, instead of staying stuck',
    played: 'fork, 68K, and Mac OS 8.5 with each patch installed by Magpie, 12 October 2026, the stock file, the fix alone and every fix: a dagger put by an edit on the square of the oak door at (52,21) of Cademia, the hero south of it, Use on that square three times. Unpatched the pane shows "> Use dagger." three times and the door stays shut. With the fix alone and with every fix the first Use opens the door, the room behind it drawn, and the second and third show "Something is in the doorway." and leave it open. In the fork, with no dagger, three Uses open, shut and open the door on all three files. A potion on the same square, the same day, the fork and Mac OS 8.5: unpatched "Whom should quaff potion?" and the door shut; with the fix alone and with every fix the door opens and the next two Uses show "Something is in the doorway." A potion on open floor prompts for whom, on all three files (fork). The kinds another fix also edits, 13 October 2026, the fork, the three files: a fishing pole, a pitcher and the strange device in the doorway each do what they do elsewhere and leave the door shut unpatched, and open it with the fix alone and with every fix; a fishing pole on open floor shows its line on all three. Mac OS 8.5, the same day, the fishing pole in the doorway, each patch installed by Magpie: its line three times and the door shut unpatched; the door opened and "Something is in the doorway." twice with the fix alone and with every fix',
    // With the Use handed on, a door could be shut on the thing and opened
    // again through it, which is one rule for the player and another for
    // the doorway (the maintainer, 12 October 2026: "SHOULD the player be
    // able to close the door with something in the way?"). So the door's
    // helper, 0x0E40, also looks over its square before closing, and with
    // anything there that has a weight it prints a line and stays open.
    // Opening is never rejected, so a door found shut on a thing still opens.
    // A thing whose class has a Use, a torch, a potion, a chest, never came
    // to 0x3009, so a door shut on one stayed stuck (the maintainer, 12
    // October 2026: "can't you have the door use take precedence over the
    // torch?"). Each class that has a Use and a weight now calls 0x3009
    // first, which answers True when it has handed the Use to a door, and
    // only otherwise goes on to the class's Use. So in a doorway the door comes
    // first, whatever lies there; picked up, the thing goes to the class's Use
    // unchanged.
    plan: (s) => {
      const edits = [
      { what: 'a thing with no use hands it to a door on its square', resid: 0x3009, at: 0x0003, expect: { 0x0003: 'return' },
        code: ['if_not', 'arg Arg00', 'get_field flags (0x0)', 'byte 0x18', 'bitwise_and', 'byte 0x00', 'eq', 'then -> out',
          'set_local 0x00', 'sys LocationIterator', 'word &Var0', 'byte 0x00', 'arg Arg00', 'get_field x (0x1)', 'arg Arg00', 'get_field y (0x2)', 'end', 'end',
          'look:',
          'if', 'sys LocationIterator', 'word &Var0', 'byte 0x01', 'end', 'then -> out',
          'if_not', ...[3, 7, 10, 11, 56, 276].map((t, k) => ['local Var00', 'get_field obj_type (0x4)', 'short 0x' + t.toString(16).toUpperCase().padStart(4, '0'), 'eq'].concat(k ? ['or'] : [])).flat(), 'then -> onward',
          'set_local 0x03', 'method Use (0x9)', 'local Var00', 'end', 'end',
          'return', 'word True', 'end',
          'onward:',
          'set_local 0x00', 'sys LocationIterator', 'word &Var0', 'byte 0x02', 'end', 'end',
          'branch look',
          'out:'].join('\n') },
      { what: 'a door looks at its doorway before closing', resid: 0x0E40, at: 0x0081,
        expect: { 0x007E: 'branch 0x00BE', 0x0081: 'if_not', 0x0083: 'arg Arg01', 0x0088: 'set_field aspect', 0x00BE: 'return' },
        code: ['if_not', 'local Var04', 'arg Arg01', 'eq', 'local Var04', 'arg Arg02', 'eq', 'or', 'then -> clear',   // the two open pictures: only a closing looks
          'set_local 0x05', 'sys LocationIterator', 'word &Var5', 'byte 0x00', 'arg Arg00', 'get_field x (0x1)', 'arg Arg00', 'get_field y (0x2)', 'end', 'end',
          'look:',
          'if', 'sys LocationIterator', 'word &Var5', 'byte 0x01', 'end', 'then -> clear',
          'if_not', 'local Var05', 'class_member 0x2400', 'byte 0x00', 'gt', 'local Var05', 'class_member 0x2400', 'short 0x7FFF', 'lt', 'and', 'then -> onward',   // the class's Weight, a number and not None
          'string(implicit) "Something is in the doorway.\\n"', 'branch 0x00BE',
          'onward:',
          'set_local 0x05', 'sys LocationIterator', 'word &Var5', 'byte 0x02', 'end', 'end',
          'branch look',
          'clear:'].join('\n') },
      ];
      // Read from the session, not the page's open file: a build has none.
      // Each is a `late` edit: made after the rest of the stage, and carried
      // past by a later stage's edit that refers to a place in the same class.
      for (let pt = 1; pt < 0x400; pt++) {
        const resid = 0x1000 + pt;
        let b; try { b = s.bytesOf(resid); } catch (e) { continue; }
        if (!b) continue;
        const slots = [...dvmSlotNames(b, resid).entries()];
        const use = slots.find(([, name]) => name === 'Use');
        if (!use || !slots.some(([, name]) => name === 'Weight')) continue;
        const fn = dataPatchListing(s, resid).fns.find(f => f.st === use[0]);
        if (!fn) continue;
        edits.push({ what: 'a door on its square comes before the Use of prop type ' + pt, resid, at: fn.st + 3, late: true,
          code: ['if_not', 'call_resource 0x3009', 'arg Arg00', 'end', 'then -> own', 'return', 'byte 0x00', 'end', 'own:'].join('\n') });
      }
      return { edits, dataEdits: [{ what: 'the door helper has three more locals', resid: 0x0E40, fn: (b) => { if (b[0] !== 0x81 || b[2] !== 5) throw new Error('the header is not what the page read'); b[2] = 8; return 'locals 5 to 8'; } },
      { what: 'the default Use has four locals', resid: 0x3009, fn: (b) => { if (b[0] !== 0x81 || b[2] !== 0) throw new Error('the header is not what the page read'); b[2] = 4; return 'locals 0 to 4'; } }] };
    } },
  // Shake Down (0x1A24) counts everything its target holds, rolls for one
  // and puts it on the target's square with flags 1, a thing on the ground
  // and free to take. What a character holds includes its skills and
  // spells, records flagged 0x1C whose type is the skill's number, and the
  // number of Barehand, 199, is the haystack's as a thing. Meleager is the
  // one companion who holds a skill record, Barehand, so with little else
  // on him the roll finds it, the pane shows "Meleager drops a haystack."
  // [Fletcher@t580], a haystack two squares wide lies where he stands and
  // his Barehand is gone. A pick whose flags have 0x04, the bit a skill
  // or spell has and a thing carried or worn does not, now ends as a
  // failed cast does, "Nothing seems to happen."
  { id: 'shake-down-skills', group: 'rules', stage: 'community', title: 'Shake Down no longer makes someone drop a skill, which fell as a haystack',
    played: 'Mac OS 8.5, 12 October 2026, the fix alone and with every fix, each installed by Magpie: a mid-game save with Meleager holding nothing but his Barehand skill, Shake Down cast on him: "Meleager drops a haystack." and a haystack on his square unpatched; "Nothing seems to happen." twice, and no haystack, with the fix alone and with every fix. That line is also a failed cast\u2019s, and two casts were made each time. Not played in the fork',
    edits: [
      { what: 'Shake Down leaves a skill where it is', resid: 0x1A24, at: 0x0133,
        expect: { 0x012C: 'if_not', 0x0133: 'set_field flags', 0x016D: 'string(implicit) "Nothing seems to happen.' },
        code: ['if_not', 'local Var01', 'get_field flags (0x0)', 'byte 0x04', 'bitwise_and', 'then -> thing', 'branch 0x016D', 'thing:'].join('\n') },
    ] },

  // A thing's picture is its type's first tile plus its aspect, and the
  // chair, the end table and the desk stand side by side in one sheet: the
  // chair's tiles are 770 to 773, the end table's 774, the desk's 775 and
  // 776. Three records are chairs (type 12) at aspect 4, so they draw the
  // end table's tile and are chairs in everything else: a chair has a
  // weight, which is what lets a thing be taken (TGameSys::IsTakable), and
  // an end table has none, so these three "end tables" can be picked up
  // [Buzzzzy@t2023]. One record in Pnyx is an end table (type 13) at aspect
  // 1, so it draws the desk's tile and has no Use, where a desk's opens it:
  // the desk beside Paris that "is immovable and unusable". Each is given
  // the type whose picture it wears, at that type's first aspect.
  { id: 'furniture-types', group: 'items', stage: 'community', title: 'Three end tables that were chairs underneath can no longer be carried off, and a desk in Pnyx that was an end table underneath now opens',
    played: 'Mac OS 8.5, 12 October 2026, the fix alone and with every fix, each installed by Magpie, a save that had never held Catamarca or Pnyx: Take on the end table at (26,37) of Catamarca, "You can\u2019t take an end table!" and the record on the floor in the save, against "Your deeds stain your soul." and the record carried, unpatched; Use on the desk at (16,51) of Pnyx opens its drawer, against nothing unpatched. Fork, 68K, the same day and the same two, the stock file, the fix alone and every fix: the same lines, and the desk\u2019s window. In a save that already has a zone, that zone\u2019s records stay as they were, so the end table in Land King Hall stayed a chair in a save made there; the hall\u2019s and the second of Catamarca\u2019s were not played',
    dataEdits: [[0x8103, 34, 0x100C, 0x000D, 'the end table in Land King Hall'], [0x8106, 46, 0x100C, 0x000D, 'an end table in Catamarca'],
                [0x8106, 48, 0x100C, 0x000D, 'another end table in Catamarca'], [0x810C, 321, 0x040D, 0x0011, 'the desk in Pnyx']].map(([resid, rec, was, now, what]) => (
      { what, resid, fn: new Function('b', `const p = ${rec} * 16; if ((b[p + 4] << 8 | b[p + 5]) !== ${was}) throw new Error('record ${rec} is not the type and aspect the page read'); b[p + 4] = ${now >> 8}; b[p + 5] = ${now & 0xFF}; return 'record ${rec} given the type its picture is of';`) })) },

  { id: 'arrow-stacks', group: 'items', stage: 'community', title: 'The magic arrow in Land King Hall now looks like one arrow, instead of a stack, and two stacks in Cademia look right',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the crate at (103,58) of Cademia, opened, shows its arrows with the count 30, against one arrow and no count unpatched; the Land King Hall arrow and the second Cademia stack were not looked at; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the crate at (103,58) of Cademia shows its arrows with the count 30',
    dataEdits: [
      { what: 'the Cademia arrow stacks', resid: 0x8108, fn: (b) => {
          const expected = { 1155: 30, 1174: 20 }; let n = 0;
          for (const [i, c] of Object.entries(expected)) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 102 || r[6] !== c || r[7] !== 0) throw new Error('record ' + i + ' is not an arrow with ' + c + ' in Data1'); r[6] = 0; r[7] = c; n++; }
          return n + ' stacks’ counts moved to Data2';
      } },
      { what: 'the Land King Hall magic arrow', resid: 0x8103, fn: (b) => {
          const r = b.subarray(632 * 16, 632 * 16 + 16);
          if (((r[4] << 8 | r[5]) & 0x3FF) !== 101 || r[6] !== 7 || r[7] !== 0) throw new Error('record 632 is not the magic arrow with 7 in Data1');
          r[6] = 0; r[7] = 7; return 'record 632’s count moved to Data2';
      } },
    ] },
  // Things left where nobody can go (0x8103, 0x8109; 13 October 2026). A
  // flood of every zone from its entrances, schedule posts and open edges,
  // with every door, gate and passage open and tile 0 closed, leaves
  // fourteen things on tile 0, the void outside the walls, with no reached
  // square beside them. Land King Hall: a dresser at (4,16) and a crystal
  // ball at (4,18), outside the west wall (the board's "white room"). The
  // Underground: a pedestal at (34,57) between a second mystic armor and a
  // second mystic spear, north of the helmet's room (the armor a player
  // finds is in the Caves and the spear in the Cove), and in the north-west
  // corner four standing stones, four force walls and a pedestal. Each
  // record is freed, flags 0xFF, as the list's free records are;
  // ChainFreeProps links them when the zone is loaded. A game already
  // begun keeps the lists it has. Left: the outcropping at (39,96) of the
  // Underground, on void too but numbered as the one at (86,115) is.
  { id: 'castoffs', group: 'hidden', stage: 'community', title: 'Fourteen things left outside the walls of Land King Hall and the Underground are now gone, instead of standing where nobody can go',
    played: 'fork, 68K, 13 October 2026, alone and on “All Fixes”: the hero put on the void beside each group of the Underground; the pedestal, armor and spear at (34,57) and the standing stones, force walls and pedestal of the north-west corner are drawn unpatched and gone with the fix; fork, PowerPC, the fix alone: a new game, saved, has Land King Hall’s dresser and crystal ball as free records, against both on the floor unpatched. Land King Hall was not looked at on “All Fixes”, nor any of it on Mac OS',
    dataEdits: [
      { what: 'Land King Hall’s castoffs', resid: 0x8103, fn: (b) => {
          const expected = { 68: [18, 4, 16], 626: [321, 4, 18] }; let n = 0;
          for (const [i, [t, x, y]] of Object.entries(expected)) { const r = b.subarray(i * 16, i * 16 + 16), xy = (r[1] << 16) | (r[2] << 8) | r[3];
            if (r[0] !== 0 || (((r[4] << 8) | r[5]) & 0x3FF) !== t || (xy >> 12) !== x || (xy & 0xFFF) !== y) throw new Error('record ' + i + ' is not type ' + t + ' on the floor at (' + x + ',' + y + ')');
            r[0] = 0xFF; n++; }
          return n + ' records freed';
      } },
      { what: 'the Underground’s castoffs', resid: 0x8109, fn: (b) => {
          const expected = { 871: [184, 34, 57, 0], 873: [375, 33, 57, 1], 874: [376, 35, 57, 1], 881: [179, 5, 1, 0], 882: [179, 5, 2, 0], 883: [179, 6, 1, 0], 884: [179, 7, 0, 0],
                         887: [255, 4, 4, 0], 888: [255, 4, 8, 0], 889: [255, 4, 11, 0], 890: [255, 3, 5, 0], 893: [184, 5, 3, 0] }; let n = 0;
          for (const [i, [t, x, y, f]] of Object.entries(expected)) { const r = b.subarray(i * 16, i * 16 + 16), xy = (r[1] << 16) | (r[2] << 8) | r[3];
            if (r[0] !== f || (((r[4] << 8) | r[5]) & 0x3FF) !== t || (xy >> 12) !== x || (xy & 0xFFF) !== y) throw new Error('record ' + i + ' is not type ' + t + ' on the floor at (' + x + ',' + y + ')');
            r[0] = 0xFF; n++; }
          return n + ' records freed';
      } },
    ] },
  // Sacas's kesh on Eudoxus (0x8104): the five vials in the Abandoned
  // Farmhouse coffer get Data1 2, the value his line waits for.
  { id: 'eudoxus-kesh', group: 'quests', stage: 'community', title: 'You can now tell Sacas of the kesh on Eudoxus, instead of the vials never counting',
    played: 'fork, 68K, 10 October 2026, alone: a vial as it is in the file (Data1 2, against 0 unpatched) put on the floor by an edit and looked at; the save has quest value 13 set, against unset unpatched. Sacas’s line was not played, nor the vial taken from Eudoxus’s coffer; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the Abandoned Farmhouse’s five vials are loaded with Data1 2, against 0 unpatched. Read from a save copied out of the machine. The same day, a save staged with quest value 1 at 1 and the clock a moment before the hour, which is what posts Eudoxus outside the farmhouse door: killed, his corpse and the coffer in it opened and a vial looked at, the save has quest value 13 set; then, in that save with the hero put beside Sacas and the prisoner’s flags set, Sacas’s “yes” ends in “I found some on the band leader himself.” The same saves and steps with no patch installed: the look leaves quest value 13 unset, and Sacas stops at “this might be an important clue.”',
    dataEdits: [
      { what: 'Eudoxus’s kesh', resid: 0x8104, fn: (b) => {
          let n = 0;
          for (let i = 34; i <= 38; i++) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 298 || r[6] !== 0 || (r[0] & 0x08) === 0) throw new Error('record ' + i + ' is not a contained liquid with Data1 0'); r[6] = 2; n++; }
          return n + ' vials given Data1 2';
      } },
    ] },
  // Kilts inside kilts (0x810D): the dresser at (48,17), record 261, contains
  // one thing, a cape (record 673); the cape contains three tunics (674 to 676)
  // and the last tunic four kilts (677 to 680). A cape and a tunic are no
  // containers, and every other tunic and cape in the towns is in a dresser
  // itself, so all seven go into the dresser. Until 8 October 2026 this moved
  // the four kilts into record 673, taking it for the dresser: they came out
  // of the tunic and into the cape, as far from reach as before, which
  // showed when the fix was first played.
  { id: 'kilts', group: 'items', stage: 'community', title: 'The tunics and kilts in a Kosha dresser are now in the dresser, instead of inside a cape and a tunic',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the dresser at (48,17) of Kosha, opened, contains a cape, three tunics and four kilts, against the cape alone unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the dresser at (48,17) of Kosha contains a cape, three tunics and four kilts',
    dataEdits: [
      { what: 'the tunics and kilts', resid: 0x810D, fn: (b) => {
          const rec = i => b.subarray(i * 16, i * 16 + 16), type = r => ((r[4] << 8) | r[5]) & 0x3FF, holder = r => (r[2] << 8) | r[3];
          const DRESSER = 261, CAPE = 673, TUNIC = 676;
          if (type(rec(DRESSER)) !== 18 || rec(DRESSER)[0] & 0x18) throw new Error('record ' + DRESSER + ' is not a dresser on the floor');
          if (type(rec(CAPE)) !== 285 || rec(CAPE)[0] !== 8 || holder(rec(CAPE)) !== DRESSER + 0x100) throw new Error('record ' + CAPE + ' is not a cape inside the dresser');
          let n = 0;
          for (let i = 674; i <= 680; i++) { const r = rec(i), in_ = i <= TUNIC ? CAPE : TUNIC; if (type(r) !== 284 || r[0] !== 8 || holder(r) !== in_ + 0x100) throw new Error('record ' + i + ' is not a tunic or kilt inside record ' + in_); r[2] = ((DRESSER + 0x100) >> 8) & 0xFF; r[3] = (DRESSER + 0x100) & 0xFF; n++; }
          return n + ' tunics and kilts moved into the dresser, record ' + DRESSER;
      } },
    ] },
  // The spent staff's light (0xF002): tile 0x88B's light level goes to 0.
  { id: 'spent-staff', group: 'items', stage: 'community', title: 'A spent staff now gives no light, instead of still giving light',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: a spent staff equipped at midnight in Omen’s Test leaves the room dim, where unpatched it lit the room as a working staff does; a working staff still lights it; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: a spent staff equipped at midnight in Omen’s Test leaves the room dim, and a working one lights it',
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
  // made while asleep leaves a man's body and has a man's flags; the
  // program fix sleeper-unit (js/delv-appfixes.js) looks up the sleeper's
  // own type instead, and this record is what is left for anything it
  // cannot name (30 September 2026).
  { id: 'sleeping-units', group: 'world', stage: 'community', title: 'People killed asleep, and the Odemia night guard, now leave a body, instead of turning into some other thing',
    played: 'fork, PowerPC, 30 September 2026: a sleeping guard killed leaves a man’s body and a night guard a guard’s, where the shipped file left none; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: a sleeper in the Odemia barracks at night, its health set to 1 by an edit, killed; a corpse is left on the bed, against a thing with no name unpatched. Read from a save copied out of the machine. The night guard was not tried there',
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
  // The Odemia night guard's Talk (0x10E5; 11 October 2026). The class of
  // the guard a night egg hatches (type 229) hands Talk to the Gate Guard
  // with no TalkParticipant before it, where the day guard's class (0x102E)
  // assigns its character to place 0 first. With nobody in that place the
  // conversation has no second portrait, and every line of the guard's is
  // drawn at the hero's, over the row of keywords. The call the day guard's
  // class makes is added. (bugs.md, *The Odemia guards' text overlaps at
  // midnight*.)
  { id: 'night-guard-talk', group: 'talk', stage: 'community', title: 'The Odemia night guard\u2019s words now appear beside his portrait instead of over the hero\u2019s keywords',
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and with every fix, each installed by Magpie: at midnight in Odemia, with Ariadne brought home, a night guard greeted, then "job", a word he does not know and "bye"; each line of his is drawn at the top beside a guard\u2019s portrait, against each line drawn over the row of keywords beside the hero\u2019s portrait with no patch installed, the same save and words. The hero, the hour and the quest value were set by an edit. Not played in the fork',
    edits: [
      { what: 'the night guard names who speaks', resid: 0x10E5, at: 0x0017, expect: { 0x0011: 'word Character.Gate_Guard', 0x0017: 'method Talk', 0x0019: 'local Var00' }, code: dataFixTalk('local Var00', 0) },
    ] },
  // The Mining Camp's sign cannot be read (0x8118; 28 September 2026). A
  // sign's Examine (0x10C3) shows entry Data1 of 0x0218 and nothing when
  // Data1 is 0; the camp's sign, record 14, has Data1 0 and Data2 15, and
  // entry 15 is "Iron Mines". It is the only sign of the 27 with anything in
  // Data2; the number moves to Data1.
  { id: 'mining-camp-sign', group: 'world', stage: 'community', title: 'You can now read the Mining Camp\u2019s sign, instead of it showing nothing',
    played: 'fork, 28 September 2026: the sign reads Iron Mines; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: the sign reads Iron Mines',
    dataEdits: [
      { what: 'the Mining Camp’s sign', resid: 0x8118, fn: (b) => {
          const r = b.subarray(14 * 16, 14 * 16 + 16);
          if (((r[4] << 8 | r[5]) & 0x3FF) !== 195 || r[6] !== 0 || r[7] !== 15) throw new Error('record 14 is not a sign with 15 in Data2');
          r[6] = 15; r[7] = 0; return 'record 14’s text number moved to Data1';
      } },
    ] },
  // The names of `0xF004` are runs: an entry is a tile number and a name, and
  // gives that name to every tile after the entry before it up to that number.
  // The entry 2007 "polyp" covers 2000 to 2007, which is two creatures: the
  // hydra's body (type 279, tiles from 2000) and the polyp (type 277, tiles
  // from 2004). The hydra's arms (type 278, tiles from 1920) are "hydra", so a
  // hydra is looked at as a polyp ringed by hydras and its hits are reported
  // as "A polyp hit". An entry 2003 "hydra" goes in before it; the table is
  // eight bytes longer.
  { id: 'hydra-name', group: 'world', stage: 'community', title: 'A hydra\u2019s body is now called a hydra, instead of a polyp',
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and with every fix, each installed by Magpie: the hero on the shore of the Hall of Truth\u2019s pool, Look at the body two squares west, "> Look - you see a hydra.", and with the fix alone "--A hydra missed Bellerophon.--", against "> Look - you see a polyp." unpatched (and "--A polyp hit Bellerophon very hard.--" in an unpatched run the same day). The polyps of the Cove, the same day and machine, eight turns and a Look at each square beside the hero: "> Look - you see a polyp." and "--A polyp hit Bellerophon.--" with the fix alone and with every fix, as unpatched; fork, 68K, 11 October 2026, a Look at each of the six squares the body moves over, twice: two of twelve read "> Look - you see a polyp." unpatched, none with the fix alone or with every fix, where eight read "> Look - you see a hydra."',
    dataEdits: [
      { what: 'the hydra body’s name', resid: 0xF004, fn: (b) => {
          const at = 4295, expected = [0x07, 0xCF, 0x67, 0x61, 0x74, 0x6F, 0x72, 0, 0x07, 0xD7, 0x70, 0x6F, 0x6C, 0x79, 0x70, 0];
          if (expected.some((v, i) => b[at - 8 + i] !== v)) throw new Error('the entries 1999 "gator" and 2007 "polyp" are not where the page read them');
          const add = [0x07, 0xD3, 0x68, 0x79, 0x64, 0x72, 0x61, 0];
          const out = new Uint8Array(b.length + add.length);
          out.set(b.subarray(0, at)); out.set(add, at); out.set(b.subarray(at), at + add.length);
          return out;
      } },
    ] },

  /* ---- Bryce Schroeder's fixes (the stage "bugfix"; bugfix_patch.mjs,
     "Cythera Bugfix Patch") ------------------------------------------------
     The six fixes of Bryce Schroeder's unofficial bugfix patch, rebuilt with
     the page's code writer (24 September 2026, at the maintainer's
     word). The causes are in bugs.md under *Fixed in Bryce Schroeder's
     unofficial patch*. */

  // Fetch (0x1A28). Bryce's patched UseOn, from his published source
  // (delvmod's wiki, "1A28 Patched", GPL, Bryce Schroeder 2016), put into
  // the listing's words: an item already carried "won't come free", one not
  // lying loose is "too large and heavy", one with no Weight cannot be
  // retrieved, one too heavy for the caster falls at their feet, and
  // anything else is carried -- flags 0x10, an inventory square, PutInside
  // -- where the shipped spell set flags 9 and lost it.
  { id: 'fetch', group: 'rules', stage: 'bugfix', by: 'Bryce Schroeder', title: 'Fetch now brings the thing to the caster, instead of losing it',
    played: 'the maintainer, 21 September 2026; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Fetch cast at a dagger two squares off puts it in the hero’s pack, against the dagger saved on no square and in no pack unpatched',
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
  // has the automap's seen bit, which it masks off (word 0x7FFF,
  // bitwise_and) before testing for deep water.
  { id: 'fishing', group: 'rules', stage: 'bugfix', by: 'Bryce Schroeder', title: 'Fishing now finds deep water on squares already seen, instead of only on unseen ones',
    played: 'fork, 3 October 2026: cast at deep water beside (206,40) on the world map, a fish caught, against "You need to cast into deep water." unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: cast at deep water off (206,40) of the world map, "You fish for a while..." and then "You caught something!"',
    edits: [
      { what: 'fishing', resid: 0x1091, at: 0x00C7, expect: { 0x00C3: 'sys GetMapTile', 0x00C7: 'end' },
        code: `word 0x7FFF\nbitwise_and` },
    ] },
  // Aethon's lock picking (0x0C4E, 0x0C4F, 0x0C50). Not his fix -- his source
  // was never published and he called PickLock directly -- but the cause,
  // found in the scripts afterwards: the task scripts cast their item argument into a local and
  // then send the method to the argument, a bare number, which the
  // interpreter ignores. Each sends it to the local.
  { id: 'aethon-locks', group: 'rules', stage: 'bugfix', title: 'Aethon now picks a lock when told to, instead of ignoring the order',
    played: 'fork, 3 October 2026: Aethon in the party with his lock picks, Pick Lock from his Do menu on a locked oak door, "Work the Lock!" then "It is now unlocked" and the door saved unlocked, against "Work the Lock!" and the door still locked unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Pick Lock from Aethon’s Do menu on a locked oak door, his balloon "Work the Lock!", "The lockpick broke." and on the second try "It is now unlocked", against the balloon and the door saved locked unpatched',
    edits: [[0x0C4E, 'Use'], [0x0C4F, 'UseOn'], [0x0C50, 'UseAt']].map(([resid, m]) => ({
      what: 'lock picking ' + m, resid, at: 0x000B, to: 0x000C,
      expect: { 0x0003: 'set_local 0x00', 0x0009: 'method', 0x000B: 'arg Arg01' },
      code: `local Var00` })) },
  // Aethon's "Ask About" (0x1861). His GetMessage answers skills only; the
  // block Hector's has for a thing asked about is put in front of it,
  // without Hector's weapon remarks: open the talk, both portraits, the
  // AskAbout helper (0xEB6), and "Looks like ..." when it has nothing.
  { id: 'aethon-ask-about', group: 'talk', stage: 'bugfix', title: 'Aethon now answers when you Ask About a thing',
    played: 'fork, 3 October 2026: Ask About from Aethon\u2019s Do menu on the hero\u2019s oboloi drew "Ah, was there ever anything as noble as money!", against "Nothing" unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: Ask About from Aethon’s Do menu on the hero’s oboloi drew "Ah, was there ever anything as noble as money!"',
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
  { id: 'paris-diomede-names', group: 'talk', stage: 'bugfix', title: 'The hero now remembers Paris\u2019s and Diomede\u2019s names once they\u2019ve given them',
    played: 'fork, 3 October 2026: after "name", Diomede in Cademia and Paris in Pnyx were labelled by name in the conversation, and unpatched they stayed unnamed; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: Diomede is labelled by name after "name"; Paris was not played there',
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
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: the clock set just before five in a saved Catamarca by an edit, so the hour turns as it loads; Sardis is saved at (23,15) and Darius at (22,16), and the two are drawn in a chair each, against both saved at (22,16) and one figure drawn there unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Sardis is saved at (23,15) and Darius at (22,16), against both at (22,16) unpatched. Read from a save copied out of the machine',
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
     intent is written beside each; where the files themselves settle it, that
     is the reason given.

     EVERY PLACE IS FOUND, NOT GIVEN. The other code stages name their edits
     by offset in the shipped file, which is valid only while they run first or
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
  { id: 'books-of-wisdom', group: 'quests', stage: 'further', title: 'The Books of Wisdom task now comes off the To Do list at ten books, instead of five',
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and “All Fixes”, each installed by Magpie: five Sapphire Books handed to Selinus leave "Retrieve Books of Wisdom (5/10)" unticked, and ten tick it at (10/10), against ticked at (5/10) unpatched. The books were put in the hero’s pack by an edit. Not played in the fork',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'the Books of Wisdom struck at ten', 0x1851,
        ['if_not', 'sys GetState', 'byte 0x05', 'end', 'byte 0x05', 'eq', 'then ->', 'sys CompleteQuest', 'byte 0x12'], 4, 'byte 0x0A'),
    ] }) },
  // The same script's thanks: "I see you found ", the count's word, " Book",
  // then the "s" only when the count is greater than 2, so two books read
  // "two Book" [sic]. Seen in the fork on 30 September 2026, handing in two.
  // The test is greater than 1.
  { id: 'books-plural', group: 'talk', stage: 'further', title: 'Selinus now thanks the party for \u201ctwo Books\u201d instead of \u201ctwo Book\u201d',
    played: 'fork, PowerPC, 30 September 2026: two books handed in; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: two books handed in, "I see you found two Books - this is good.", against "two Book" unpatched',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'the Books of Wisdom counted as more than one', 0x1851,
        ['string(implicit) " Book"', 'if_not', 'local Var00', 'byte 0x02', 'gt', 'then ->'], 3, 'byte 0x01'),
    ] }) },
  // Timon on the Seldane (0x184A): "we've met them" tests his own character
  // flag 1 where it tested quest flag 2, which nothing sets. Sabinate sets
  // Timon's flag 1 on meeting him ("It is a living Seldane!"), and Timon's
  // own talk with Larisa reads it for "meeting a real Seldane".
  { id: 'timon-seldane', group: 'talk', stage: 'further', title: 'Timon now remembers if he\u2019s met a Seldane',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Timon’s flag 1 and quest value 2 set by edits, "meti" to him at the ruins, "Of course you all know that, we’ve met them, haven’t we...", against "I’d really like to find them someday..." unpatched; with his flag clear, that line on both; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Of course you all know that, we’ve met them, haven’t we..."; the unpatched line was not reached there',
    plan: (s) => {
      const what = 'Timon has met the Seldane', p = dataPatchPlace(s, what, 0x184A,
        ['if_not', 'sys GetStateFlag', 'byte 0x02', 'end', 'then ->', 'string(implicit) "\\"Of course you all know that']);
      return { edits: [{ what, resid: 0x184A, at: p.at(1), to: p.at(4), expect: p.expect, code: 'call_resource 0xF02\narg Arg00\nbyte 0x01\nend' }] };
    } },
  // Timon fretting about Larisa (the room, 0x1C2D): the second branch tests
  // his flag 3 and set flag 2, so he fretted on every entry; it sets flag 3.
  { id: 'timon-frets', group: 'talk', stage: 'further', title: 'Timon now frets about Larisa once instead of every time he comes in',
    played: 'Mac OS 8.5, 11 October 2026, the fix alone and “All Fixes”, each installed by Magpie: Timon in the party by an edit, quest value 7 at 3, the hero walked into Larisa’s dwelling in Kosha twice; "Hm - Larisa should be back by now." on the first entry only, against on both unpatched. Not played in the fork',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Timon frets once', 0x1C2D, ['call_resource SetCharacterFlag', 'short 0x004A', 'byte 0x02', 'end', 'return'], 2, 'byte 0x03'),
    ] }) },
  // Halos's "stop by my office" (0x183E's helper): `behaviour != 144 and
  // behaviour == 138` is redundant as written, and the line fits only away
  // from the office; the second test is `!=`.
  { id: 'halos-office', group: 'talk', stage: 'further', title: 'Halos tells you to stop by his office when he\u2019s away from it',
    played: 'fork, 68K, 9 October 2026, alone and on “All Fixes”: at eleven, when his schedule has taken him from his desk, "ake" to Halos once Ake has sent the hero drew "Lady Ake sent you?" and then "But now is not a good time to talk - please, stop by my office during working hours.", against "So, you came all this way to talk" and no such line unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "ake" to Halos at eleven drew "But now is not a good time to talk - please, stop by my office during working hours."',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Halos away from his office', 0x183E,
        ['arg Arg00', 'get_field behavior', 'word 144', 'ne', 'arg Arg00', 'get_field behavior', 'word 138', 'eq', 'and', 'sys GetSkill'], 7, 'ne'),
    ] }) },
  // Halos on the kidnapping (0x183E, "kidn"; 22 October 2026, bugs.md,
  // *Found outside the compendium's bug section*, from 453@t2044): the 20
  // experience is guarded by `not SetCharacterFlag(Halos, 3)` and then sets
  // flag 3, so the guard is meant to test whether the flag is set already.
  // SetCharacterFlag (0xF00) answers 0 whatever it did, so the guard passed
  // every time and the topic gave 20 more on each visit. 0xF02 beside it is
  // the test, the call every other guard in the scripts makes; this is the
  // one place a setter stands in a guard.
  { id: 'halos-kidnapping', group: 'talk', stage: 'further', title: 'Halos gives experience for his account of the kidnapping once, instead of on every telling',
    played: 'fork, 68K, 22 October 2026, alone and on “All Fixes”: quest value 1 set and the flags of Halos (1) and Mantinea (1) by edits, the clock at eleven, "kidn" to Halos twice in one conversation, the hero’s experience 20 after, against 40 unpatched; both tellings print in full on all three. Not played on Mac OS',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Halos tests his flag 3', 0x183E,
        ['if_not', 'call_resource SetCharacterFlag', 'arg Arg00', 'byte 0x03', 'end', 'not', 'then ->', 'call_resource GainExp'], 1, 'call_resource 0xF02'),
    ] }) },
  // Neoptolemus (0x1821; bugs.md, the same section, from Buzzzzy@t1617):
  // his greeting chooses between his yard (behaviour 146), "Get off my
  // yard!", and anywhere else, where he is "busy eating". Local 0 is the
  // closed conversation, where every topic draws "None of your business!"
  // or the like until "demo" sets his flag 7 and opens it. The yard opens
  // it only with flag 7 set ("Oh, it's you."); the eating branch opened it
  // with no test, so away from his yard every topic of his was open without
  // the Demodocus keyword. The eating branch is given the yard's test.
  { id: 'neoptolemus-eating', group: 'talk', stage: 'further', title: 'Neoptolemus stays closed while eating until you mention Demodocus, as he does in his yard',
    played: 'fork, 68K, 22 October 2026, alone and on “All Fixes”: at six in the evening, at his table at (44,101), "name" drew "None of your business!", then "neop" and "demo" opened him and "name" drew "Neoptolemus - and show a little respect to your elders!", against that line at the first "name" unpatched. Not played on Mac OS',
    plan: (s) => {
      const what = 'Neoptolemus eating, opened by flag 7', p = dataPatchPlace(s, what, 0x1821,
        ['string(implicit) "\\"What do you', 'set_local 0x00', 'word False', 'end', 'exit']);
      return { edits: [{ what, resid: 0x1821, at: p.at(1), to: p.at(4), expect: p.expect, code: [
        'if_not', 'call_resource 0xF02', 'arg Arg00', 'byte 0x07', 'end', 'then -> shut',
        'set_local 0x00', 'word False', 'end',
        'shut:'].join('\n') }] };
    } },
  // Thoas's "Please come again" (0x1844): the local it waits on is set once
  // his shop has been opened.
  { id: 'thoas-farewell', group: 'talk', stage: 'further', title: 'Thoas now says \u201cPlease come again\u201d after you\u2019ve shopped with him',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: "buy", Done, "bye" to Thoas, "Farewell.  Please come again.", against "Farewell." unpatched; with no "buy", "Farewell." on both; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Farewell.  Please come again." after his shop is closed; the unpatched line was not replayed there',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'Thoas after his shop', 0x1844, ['conversation_response "buy" ->', 'set_field 0x27'], 1, 'set_local 0x00\nword True\nend'),
    ] }) },
  // Paris and Parium (the family group, 0x0805): "pari" took Parium's answer
  // first, so Paris's could not be given; Parium's is keyed "pariu".
  { id: 'paris-parium', group: 'talk', stage: 'further', title: 'The game no longer mistakes Paris for Parium when you ask about him',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”, the person brought to the hero by the in-party bit: "paris" to Apis drew "Paris is married to my cousin Helen.", against "My cousin Parium runs the Green Goat Tavern and Inn in Catamarca - fine place." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "paris" to Apis drew "Paris is married to my cousin Helen."',
    plan: (s) => ({ edits: [
      dataFixRekey(s, 'Parium keyed apart from Paris', 0x0805, 'pari', 'pariu', ['string(implicit) "\\"My cousin Parium']),
    ] }) },
  // Characters answer their own name in the third person (the Loose ends
  // row "a character told about by their own group"): asked their own
  // name, eight people had no answer of their own and their dialogue group
  // spoke of them as of someone else, Helen of "my cousin Helen". Each
  // name now reaches the answer they give to "name"; no line is new.
  { id: 'self-names', group: 'talk', stage: 'further', title: 'Eight people now respond to their name as themselves instead of as someone else',
    played: 'fork, 3 October 2026, in part (Milcom and Halos of the eight): "Milcom" to Milcom drew "I am Milcom, technically head of House Atussa." and "Halos" to Halos "I am Halos", against "Milcom was the head of the former House Atussa." and "Halos represents House Strymon in Cademia." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "milcom" to Milcom drew "I am Milcom, technically head of House Atussa." and "halos" to Halos "I am Halos"',
    plan: (s) => ({ edits: [
      ['Milcom', 0x181E, 'name', 'milc', 'I am Milcom'],
      ['Eioneus', 0x1827, 'name', 'eion', 'As I\'ve mentioned before'],
      ['Philinus', 0x1832, 'name', 'phil', 'Why I am Philinus'],
      ['Propontis', 0x183C, 'name', 'prop', 'Propontis, Elder'],
      ['Halos, accused', 0x183E, 'name', 'halo', 'The late Halos'],
      ['Halos', 0x183E, 'name', 'halo', 'I am Halos'],
      ['Charax', 0x184F, 'name', 'char', 'I am Charax'],
      ['Helen', 0x1858, 'name', 'hele', 'I am Helen'],
      ['Sabinate', 0x1878, 'name,job,heir', 'sabi', 'We are Sabinate'],
    ].map(([character, resid, from, add, said]) =>
      dataFixRekey(s, character + ' answers to the name', resid, from, from + ',' + add, ['string(implicit) "\\"' + said])) }) },
  // Tlepolemus never sells his old panpipes (bugs.md): he offers them, a
  // yes draws "Stop by some evening and I'll see if I can find them.", and
  // no script ever sells them. The offer goes (the maintainer, 3 October
  // 2026, who had two versions made): his line ends at "stopped a while
  // back." and the question after it is jumped over, so his "I hope you
  // enjoyed them", which waits on a sale, stays unsaid, as it was in the
  // shipped game. The other
  // version is a separate joke patch, deep_pipes_patch.mjs, in which he sells
  // them; built on a file with this fix, its sale is never reached. Under
  // Design Changes since 17 October 2026, at the maintainer's word: Philinus
  // gives the party a set ("pipe", 0x1832), so the offer may be a path left
  // when the pipes moved to his old friend rather than a slip.
  { id: 'tlepolemus-pipes', group: 'design', stage: 'further', title: 'Tlepolemus now says he stopped playing the pan pipes, instead of offering a set he never sells',
    played: 'fork, 3 October 2026: "pan" to Tlepolemus in Odemia drew "I use to play the pan pipes, but stopped a while back." and no question after it; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "pan" to Tlepolemus drew "I use to play the pan pipes, but stopped a while back." and no question',
    plan: (s) => {
      const p = dataPatchPlace(s, 'Tlepolemus\u2019s offer', 0x1837, ['conversation_prompt "yn"', 'conversation_response "y" ->', 'string(implicit) "\\"Stop by some evening', 'conversation_response "n" ->']);
      return {
        edits: [{ what: 'the question jumped over', resid: 0x1837, at: p.at(0), replaceOp: true, expect: p.expect, code: 'branch ' + dataFixHex(dataFixTarget(p.text(3))) }],
        textEdits: [dataFixT('Tlepolemus\u2019s offer', 0x1837, ' - are you interested in buying an old set?', '.', 1)],
      };
    } },
  // The party roster's figure frame (workbench GRIMOIRE-NOTES,
  // grimoire/roster-art-fnlojp): element 1 of a class's property 55 is the
  // frame of its sheet the party bar draws, and nothing else reads it (the
  // world's readers take element 0). The sylph's class requests frame 4 of
  // a four-frame sheet, the first tile after it, a short sword, so Ur-Sylph
  // was drawn as one; the fire spirit's requests 4 of its four too, which
  // lands on the other fire spirit's sheet and looks right by luck. Both
  // now request frame 0. Only a party that has forced them in shows it.
  { id: 'roster-figures', group: 'world', stage: 'further', title: 'Ur-Sylph is drawn in the party roster as herself, instead of as a short sword',
    played: 'fork, 3 October 2026: Ur-Sylph forced into the party, drawn as her sylph, against a short sword unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Ur-Sylph forced into the party is drawn as her sylph',
    dataEdits: [0x1124, 0x1122].map(resid => ({ what: 'the roster frame of 0x' + resid.toString(16).toUpperCase(), resid, fn: (b) => {
      if (b[2] !== 0x90 || b[3] !== 0x02 || b[8] || b[9] || b[10] || b[11] !== 4) throw new Error('0x' + resid.toString(16) + ' does not open with property 55 requesting frame 4');
      b[11] = 0;
      return 'property 55, element 1: 4 to 0';
    } })) },
  // A highlighted word nobody answers (Loose ends): "Magisterium", in the
  // general group's (0x0801) answers about Pnyx and mages. It now reaches
  // the answer about mages, "Mages are trained at the Magisterium in Pnyx".
  { id: 'magisterium', group: 'talk', stage: 'further', title: '\u201cMagisterium\u201d now gets the answer about mages',
    played: 'fork, 3 October 2026: "Magisterium" to Milcom drew "Mages are trained at the Magisterium in Pnyx", against "I\u2019m sorry, but I don\u2019t understand." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "magisterium" to Milcom drew "Mages are trained at the Magisterium in Pnyx"',
    plan: (s) => ({ edits: [
      dataFixRekey(s, 'the mages answer to "Magisterium"', 0x0801, 'mage', 'mage,magi', ['string(implicit) "\\"Mages are trained']),
    ] }) },
  // Thuria's mine task (0x1814): "You've heard first hand" is said only once
  // she has given the task, so hearing Amphidamas first no longer shuts it
  // out; her report greeting already has a line for that order.
  { id: 'thuria-mine', group: 'quests', stage: 'further', title: 'Thuria now still gives the mine task after you have been to the mine, instead of never giving it',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: Amphidamas’s flag 1 set by an edit, "rumo" to Thuria, her offer, Yes, and the task saved in the To Do list, against "You’ve heard first hand of the issues involved at the mine." and no task unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: her offer, "Perhaps you might be interested investigating this matter more?", against "You’ve heard first hand of the issues involved at the mine." unpatched; Yes was not answered',
    plan: (s) => ({ edits: [
      dataFixInsert(s, 'Thuria gives the mine task', 0x1814,
        ['conversation_response "rumo" ->', 'if_not', 'call_resource 0xF02', 'short 0x0017', 'byte 0x01', 'end', 'then ->'], 6,
        'call_resource 0xF02\narg Arg00\nbyte 0x01\nend\nand'),
    ] }) },
  // The Comana brothers (Kosha Grotto, 0x1417): the one-time signal that
  // kills them and puts Pelagon in Magpie's figure waits for quest value 3 to
  // be 3, the visit on which Pelagon says "House Comana is no more".
  { id: 'comana-brothers', group: 'quests', stage: 'further', title: 'You now find the Comana brothers dead only once someone tells of their end, instead of before',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: the hero put in the Kosha Grotto by an edit with quest value 3 at 0; quest flag 15, set as the signal that kills the brothers is sent, is saved clear, against set unpatched; with the value at 3 it is set on both. The brothers themselves were not looked at; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the three brothers put in the Grotto by an edit with quest value 3 at 2, the hero loaded among them; all three are saved alive and flag 15 clear, against all three dead and the flag set unpatched. Read from a save copied out of the machine',
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
  // Antenor (0x1824) and Pheres (0x184E): a "no" that got its answer and
  // then the answer to an earlier question's "no" gets only the first. The
  // bartenders (0x0812): a hero with no oboloi is refused and no longer
  // asked "Do you need instructions?" straight after. And a click after the
  // line the next one replaced before it could be read: Ennomus, the
  // bartenders, Ake, Parium, Crito (three), Apis (three), Paris, Niobe
  // (two), Borus and Sabinate; a `*` after the closing quote, as the game's
  // own lines wait ("Yes, I was a bit puzzled."*).
  { id: 'lines-run-on', group: 'talk', stage: 'further', title: 'Answers to questions you pose in dialogue no longer disappear too fast to read or run into the next response',
    played: 'in part: fork, 68K, 10 October 2026, alone and on “All Fixes”: "dice" to Apis with no oboloi, the refusal alone, against the refusal and then "Do you need instructions?" unpatched. The other places are not played; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "dice" to Apis with no oboloi drew the refusal alone',
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
        // The branch goes where the second "no" answer's test would have gone.
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
  // Lines that flash past, the opening descriptions (453). A character's
  // description is narration, and it is wiped when a `*` comes after the
  // speech that follows it: TConversation::myprintstr redraws the message
  // line there before it waits. A first line that goes to its prompt with
  // no `*` leaves the description up beside it. So a description is lost
  // only where some first line pauses, which is so for eight of the
  // twenty-three descriptions with no `*` in them, the four 453 named
  // among them: on Mac OS 8.5 each of those four was up for about a quarter
  // of a second (bugs.md, the same title). These get the mark Magpie's
  // description has, a new line and the `*`; with the `*` straight after
  // the full stop Mac OS 8.5 drew Demodocus's description without it
  // (pause-keeps-letter, below). After either of Polydamas's second
  // sentences. On a branch of theirs whose first line does not pause
  // (Paris at his counter, Niobe to a stranger, a second meeting with Myus
  // or Anisa) the fix adds one click. Left as shipped: the ten whose first
  // lines never pause, each seen or read to keep its description (Laodice,
  // Malis, Sardis, Dymas, Alcestris, Antiphus, Dryas, Borus, Briseis,
  // Alcmena; and Ennomus, seen); Cybele, whose second clause branches into
  // the string ".*" for its wait; Mantinea and Itanos, whose description
  // nothing follows; Oeneus, whose one following line begins with a `*`.
  { id: 'descriptions-wait', group: 'talk', stage: 'further', title: 'Descriptions for 8 characters no longer disappear too fast to read',
    played: 'in part: Mac OS 8.5, 13 October 2026, installed by Magpie alone and as \u201cAll Fixes\u201d: Demodocus, Myus, Thersites and Polydamas met for the first time, each description staying with MORE until a click and the greeting following it, against 234 to 305 ms on screen unpatched from the same saves; fork, 68K, the same day, alone and on \u201cAll Fixes\u201d: Demodocus, Alastor and Anisa, each description waiting at the tick where the shipped file shows the greeting alone, and Paris and Niobe on the branch that does not lose it, where the fix adds a click. Not played: the branch of Paris and of Niobe that loses it',
    textEdits: [
      ['Myus', 0x180A, 'with an air of leadership.'],
      ['Alastor', 0x1825, 'with stained hands and arms.'],
      ['Anisa', 0x184D, 'who seems lost in thought.'],
      ['Paris', 0x1857, 'man in his early thirties.'],
      ['Niobe', 0x1859, 'with long blond hair and large blue eyes.'],
      ['Polydamas, coughing', 0x185F, '  Coughing spasm wracks his body.'],
      ['Polydamas, full of life', 0x185F, '  Despite that, he seems full of life.'],
      ['Thersites', 0x1865, 'You see a kindly looking, honorable man.'],
      ['Demodocus', 0x186D, 'with thinning curly hair.'],
    ].map(([character, resid, line]) => ({ what: character + '\u2019s description', resid, find: line, replace: line + '\n*', count: 1 })) },
  // The letter before a pause. TConversation::myprintstr, at a `*`, draws
  // the text up to one character short of it (the length it hands
  // AppendConv or AppendMessage is the `*`'s place less one, less the
  // start), which is right when that character is the new line the writers
  // mostly put there and drops a full stop or a letter when the writers put
  // something else there:
  // "A vision appears before yo", "with a proud demeanor", and "..." as
  // "..". Seen on Mac OS 8.5 (bugs.md, *The character before a pause*). 126
  // places in the shipped file, found here rather than listed: every `*` in
  // a string that follows anything but a new line or a quotation mark is given
  // the new line, but the one string that is ".*" alone (Cybele's), whose
  // `*` a branch jumps to. A `*` after a closing quote is left: the routine has
  // drawn the speech by then and reads nothing from it. Each place is found
  // by as much of the text before it as makes it the only one, or the only
  // ones, in its script.
  { id: 'pause-keeps-letter', group: 'text', stage: 'further', title: 'The game now draws the period or letter before a pause, instead of dropping it',
    played: 'in part: Mac OS 8.5, 13 October 2026, installed by Magpie alone and as \u201cAll Fixes\u201d: Hadrian met for the first time, "You see an older warrior, with a proud demeanor." with its full stop, against the same line without it unpatched from the same save. One place of 126; fork, 68K, 13 October 2026, alone and on \u201cAll Fixes\u201d: the same line, with and without its full stop',
    plan: (s) => {
      const texts = dataPatchTexts(s), textEdits = [];
      const times = (t, f) => { let n = 0; for (let i = t.indexOf(f); i >= 0; i = t.indexOf(f, i + 1)) n++; return n; };
      for (const resid of dataPatchScriptResids(s.spec)) {
        const places = [];
        for (const o of dataPatchListing(s, resid).ops) {
          if (!o.text.startsWith('string(implicit) "')) continue;
          let str; try { str = JSON.parse(o.text.slice('string(implicit) '.length)); } catch (e) { continue; }
          for (let k = 1; k < str.length; k++) if (str[k] === '*' && str[k - 1] !== '\n' && str[k - 1] !== '"' && k >= 2) places.push(str.slice(0, k + 1));
        }
        const done = new Set();
        for (const p of places) {
          let n = 3, find, placeCount;
          for (;;) { find = p.slice(-n); placeCount = places.filter(q => q.endsWith(find)).length; if (placeCount === times(texts[resid], find) || n >= p.length) break; n++; }
          if (done.has(find)) continue;
          done.add(find);
          textEdits.push({ what: 'a pause that drops what is before it', resid, find, replace: find.slice(0, -1) + '\n*', count: placeCount });
        }
      }
      return { textEdits };
    } },
  // The combat script (0xE87) prints a miss as "--^", the attacker,
  // " missed ^", the target, and a parry as "--^", the defender,
  // " parries ^", the attacker. "^" capitalises the article of the next name
  // printed, which is right at the start of the line and wrong after the
  // verb: "--Hector missed A [sic] ruffian.--", against the hit line's
  // "--Hector hit a ruffian.--", which prints its target with no mark. Seen
  // in the 2013 MyshPlays video and the 2025 StormThalion one (bugs.md,
  // *Found checking the 2025 StormThalion video*). The two other "^" in the
  // middle of a line (0x1856, 0x185B) come before the hero's name, which has
  // no article, and are left.
  { id: 'missed-capital', group: 'text', stage: 'further', title: 'Misses and parries in combat now read “missed a ruffian”, instead of “missed A ruffian”',
    plan: () => ({ textEdits: [
      { what: 'the target of a miss in small letters', resid: 0x0E87, find: ' missed ^', replace: ' missed ', count: 1 },
      { what: 'the attacker in a parry in small letters', resid: 0x0E87, find: ' parries ^', replace: ' parries ', count: 1 },
    ] }) },
  // Demodocus's "Would you like to @hear it?" leads to his song, keyed
  // "song,meti", whose "meti" the question itself matches first; it is keyed
  // "song,hear".
  { id: 'demodocus-song', group: 'talk', stage: 'further', title: 'Demodocus now sings you his song if you ask (nicely)',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: "hear" to Demodocus in Land King Hall, "Ah, you’d like to hear a song, then..." and the song, against "I think I once wrote a song about that..." unpatched; "song" sings on both; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Ah, you’d like to hear a song, then..." and the song, against "I think I once wrote a song about that..." unpatched',
    plan: (s) => ({ edits: [dataFixRekey(s, 'Demodocus’s song on "hear"', 0x186D, 'song,meti', 'song,hear')] }) },
  // Glaucus's "North Shore @Vineyard" and the family group's answer are
  // keyed "viny", which "vineyard" can never match; "vine".
  { id: 'glaucus-vineyard', group: 'talk', stage: 'further', title: 'Glaucus the vintner and his family now answer when asked about \u201cvineyard\u201d',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: "vineyard" to Glaucus at his vineyard, "This years crop looks good, but I don’t know if I’ll be able to make...", against "Excuse me?" unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "This years crop looks good, but I don’t know if I’ll be able to make wine..."; the unpatched line was not replayed there',
    plan: (s) => ({ edits: [
      dataFixRekey(s, 'Glaucus’s vineyard', 0x1866, 'viny', 'vine'),
      dataFixRekey(s, 'the family group’s vineyard', 0x0805, 'viny', 'vine'),
    ] }) },
  // The Directed Nexus scroll (0x104B): the scroll's Use deleted the spell it
  // cast and itself by number after the spell had moved the party to Land
  // King Hall, where those numbers name two of the hall's things. It notes
  // the zone and the spell first; if the zone, the spell's record or the
  // scroll's record has changed, it deletes nothing by number and instead
  // removes one scroll of that spell from the inventory it is in
  // (RemoveItem, the call Selinus's script uses to remove a book). The
  // scroll's record is checked as well because a scroll read inside the
  // hall leaves the zone unchanged: the party's things leave and come back
  // after the end, so the scroll's old number then belongs to another of them (the copy, played 20 October 2026, or a companion's
  // thing), while the copy's old slot, freed, still reads the spell's
  // type. Directed Nexus is the one spell that changes zone. The scroll's
  // Use, from the cast to its return, and two more locals.
  { id: 'nexus-scroll', group: 'rules', stage: 'further', title: 'A Directed Nexus scroll now leaves Land King Hall\u2019s things alone, instead of destroying two of them',
    played: 'fork, 68K, 20 October 2026, alone and on “All Fixes”: read after the party came from Omen’s Test, the hall untouched and the scroll used up, against a table and a passthrough deleted and the scroll kept unpatched; read inside Land King Hall, the hero alone and again with the party’s things there, the scroll used up and nothing else lost, against the scroll kept and, with the party, the hero’s Land King Amulet deleted unpatched. The Mac OS 8.5 pass of 10 October 2026 tested the version from before the patch also checked the scroll’s record',
    plan: (s) => {
      const what = 'the scroll deletes nothing it has left behind', p = dataPatchPlace(s, what, 0x104B,
        ['set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end', 'sys Delete', 'local Var00', 'end',
         'if_not', 'local Var01', 'word None', 'eq', 'local Var01', 'byte 0x00', 'eq', 'or', 'then ->',
         'sys Delete', 'arg Arg00', 'end', 'return', 'local Var01']);
      const edit = { what, resid: 0x104B, at: p.at(0), to: p.at(20), expect: p.expect, code: [
        'set_local 0x02', 'global CurrentZone (0x10)', 'end',
        'set_local 0x03', 'arg Arg00', 'get_field data1 (0x6)', 'end',
        'set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end',
        'if_not', 'global CurrentZone (0x10)', 'local Var02', 'eq', 'local Var00', 'get_field obj_type (0x4)', 'local Var03', 'eq', 'and',
        'arg Arg00', 'get_field obj_type (0x4)', 'short 0x004B', 'eq', 'and', 'arg Arg00', 'get_field data1 (0x6)', 'local Var03', 'eq', 'and', 'then -> moved',
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
  // function did not have (item, then the iterator's slot), which the
  // header is given.
  { id: 'traps', group: 'rules', stage: 'further', title: 'Detect Traps and Deactivate Trap now find traps inside chests, and armed wires, instead of missing them',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: a crate with a poison trap inside, Detect Traps cast beside it, "You detect poison trap!", against "You fail to detect anything." unpatched, and Deactivate Trap performed on it, "Poison trap destroyed.", against "There was nothing to deactivate."; a blast trap and a fine wire were not tried; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: Detect Traps beside a crate holding a poison trap, "You detect poison trap!", and Deactivate Trap on it, "Poison trap destroyed."',
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
  // walking left. The title describes the pose and not the stop, at the
  // maintainer's word (6 October 2026): the standing frame is a step of the
  // walk too.
  { id: 'magpie-west', group: 'world', stage: 'further', title: 'Magpie now stands when in standing pose facing west, instead of sitting',
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
  // gather now also tests that the thing's flags are not 28, the test
  // FindSkill and RecalcSkills use for a skill. Nothing else in the game
  // places or makes a type-213 thing, so with this the mushroom steak cannot
  // be had (the maintainer's choice, 27 September 2026).
  { id: 'divide-food', group: 'rules', stage: 'further', title: 'Divide Food now leaves Lock Picking alone, instead of eating it (which was the only way to a mushroom steak)',
    played: 'fork, 68K, 8 October 2026, alone and on “All Fixes”: the hero with Lock Picking and a flatbread, Aethon in the party, Divide Food cast; the hero keeps Lock Picking, where unpatched the skill is deleted and Aethon is dealt a thing of its type; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: Aethon in the party, Divide Food cast, and the hero’s Abilities still list Lock Picking',
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
  // game, and no save has resource 0x0500, so a loaded game reads whatever
  // the last hero created wrote (the workbench's executable-fixes.md, *The
  // last save's gender*). The creation also writes the choice into the
  // hero's figure, field 0x25: 33 for a heroine, 32 for a hero. The
  // character record travels with the save. No other script writes field
  // 0x25: a character asleep in a bed (0x3020) changes 0x24 and the type,
  // and 0x3020 puts them back from 0x25. So each read becomes
  // `PlayerCharacter.0x25 == 33`. The fix leaves two places alone: the
  // creation's write, which nothing reads once this applies, and the
  // creation's read just after it, which comes before field 0x25 has
  // anything.
  { id: 'gender', group: 'talk', stage: 'further', title: 'Characters no longer address you using the gender of the hero you created previously (e.g. in February of last year)',
    played: 'fork, 68K, 10 October 2026, alone and on “All Fixes”: a heroine (the hero’s figure 33) loaded where no hero had been created, "bye" to Hebe, "Ma’am, one last thing...", against "Sir, one last thing..." unpatched; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: "Ma’am, one last thing...", against "Sir, one last thing..." unpatched',
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

  /* Found reading every line of the text (21 October 2026; workbench
     doc/text-read-2026-10.md, which has each by resource). Each is in the
     scripts' code rather than their words, so not a text edit. */

  // Eurybates (0x1818) and Sardis (0x181F) test their flag 7, "met", the
  // wrong way round: Cybele and the rest fall through to "Greetings again"
  // with it set and jump to the first greeting without it, and these two
  // fall through to the first greeting. So a stranger was greeted as an
  // acquaintance and the reverse, and Eurybates, whose first greeting sets
  // the flag, set it only on the second meeting. Each test is made `if`.
  { id: 'greetings-backwards', group: 'talk', stage: 'further', title: 'Eurybates and Sardis introduce themselves at the first meeting and greet you as an acquaintance after, instead of the other way round',
    plan: (s) => ({ edits: [
      dataFixReplaceOp(s, 'Eurybates’s first greeting', 0x1818, ['if_not', 'call_resource 0xF02', 'arg Arg00', 'byte 0x07', 'end', 'then ->', 'string(implicit) "\\"You\'re new around here'], 0, 'if'),
      dataFixReplaceOp(s, 'Sardis’s first greeting', 0x181F, ['if_not', 'call_resource 0xF02', 'arg Arg00', 'byte 0x07', 'end', 'then ->', 'string(implicit) "\\"Hello, "'], 0, 'if'),
    ] }) },
  // Opheltius (0x1833) prints "friend" with his flag 1 set and then
  // "citizen" with flag 7 set, or "stranger" without, with nothing between,
  // so a hero who is both was "friendcitizen". After "friend" a branch goes
  // to the end of the line, ".  What can I do for you?" in the greeting and
  // "." in the farewell, as "citizen" does. Each branch's target is the
  // target of "citizen"'s branch as the file stood before the edit, and the
  // relink moves both past the three bytes put in ahead of them; the
  // farewell's, put in first (the stage sorts from the highest offset
  // down), is moved by the greeting's too.
  { id: 'opheltius-friend', group: 'talk', stage: 'further', title: 'Opheltius addresses you as \u201cfriend\u201d, instead of \u201cfriendcitizen\u201d or \u201cfriendstranger\u201d',
    plan: (s) => {
      const what = k => 'Opheltius’s ' + k + ', "friend" alone';
      return { edits: ['greeting', 'farewell'].map((k, i) => {
        const p = dataPatchPlace(s, what(k), 0x1833, [i ? 'string(implicit) "\\"Farewell, "' : 'string(implicit) ", "', 'if_not', 'call_resource 0xF02', 'arg Arg00', 'byte 0x01', 'end', 'then ->', 'string(implicit) "friend"',
          'if_not', 'call_resource 0xF02', 'arg Arg00', 'byte 0x07', 'end', 'then ->', 'string(implicit) "citizen"', 'branch']);
        const end = parseInt(p.text(15).split(' ')[1], 16);
        return { what: what(k), resid: 0x1833, at: p.at(8), expect: p.expect, code: 'branch ' + dataFixHex(end), shiftAt: true };
      }) };
    } },
  // The bearing a "Where Is" answer computes for a square (0xEAB, called
  // through 0xEAA by GiveDirections): in each quarter it compares the
  // distance along the bearing's first word with five, a half and a third
  // of the other, as northwest does with north against west. North and
  // east of the speaker it compares east where it should compare north, so
  // a place ten squares east and one north was "north". The two locals of
  // each of the four comparisons are swapped.
  { id: 'bearing-northeast', group: 'talk', stage: 'further', title: '\u201cWhere Is\u201d directions give the right bearing for places to the north-east, instead of a mirrored one',
    plan: (s) => {
      const edits = [];
      for (const [line, a, b] of [['north', 1, 2], ['north northeast', 1, 4], ['northeast', 1, 4], ['east northeast', 1, 4]]) {
        const seq = line === 'north' ? ['if_not', 'local Var00', 'local Var01', 'byte 0x05', 'mul', 'gt', 'then ->', 'print', 'string "north"']
          : line === 'north northeast' ? ['if_not', 'local Var00', 'byte 0x0A', 'mul', 'local Var01', 'byte 0x0F', 'mul', 'gt', 'then ->', 'print', 'string "north northeast"']
          : line === 'northeast' ? ['if_not', 'local Var00', 'byte 0x03', 'mul', 'local Var01', 'byte 0x02', 'mul', 'gt', 'then ->', 'print', 'string "northeast"']
          : ['if_not', 'local Var00', 'byte 0x05', 'mul', 'local Var01', 'gt', 'then ->', 'print', 'string "east northeast"'];
        const what = 'the test for "' + line + '"', p = dataPatchPlace(s, what, 0x0EAB, seq);
        edits.push(dataFixOneOp(p, what, 0x0EAB, a, 'local Var01'), dataFixOneOp(p, what, 0x0EAB, b, 'local Var00'));
      }
      return { edits };
    } },
  // Three lines that print a name and end without a full stop, the last
  // part a separate string: Selinus's line with the hero's name in it, and
  // a computer character's cast with no target, "X casts Y" (0xC4B,
  // 0xEA3), where the cast with a target (0xC4C) has one.
  { id: 'printed-name-stops', group: 'text', stage: 'further', title: 'Three lines that end on a name or a spell end with a period, and a potion\u2019s line ends with a line break',
    plan: (s) => ({ edits: [
      // The Mage's Friend Potion's first "Nothing seems to happen." ends
      // without the line break its second has, so the next message runs on
      // after it; a jump lands just past it, so it is not a text edit.
      dataFixReplaceOp(s, 'the potion’s line break', 0x0A02, ['global PlayerCharacter', 'eq', 'then ->', 'string(implicit) "Nothing seems to happen."', 'branch'], 3, 'string(implicit) "Nothing seems to happen.\\n"'),
      dataFixReplaceOp(s, 'Selinus’s line with the hero’s name', 0x1851, ['string(implicit) "\\"I\'ll rem', 'print', 'word 0x2000000A', 'end', 'string(implicit) "\\""'], 4, 'string(implicit) ".\\""'),
      ...[[0x0C4B, 'Var00'], [0x0EA3, 'Var0C']].map(([resid, v]) => dataFixReplaceOp(s, 'a cast with no target', resid,
        ['string(implicit) " casts "', 'print', 'method Look', 'local ' + v, 'end', 'end', 'string(implicit) "\\n"'], 6, 'string(implicit) ".\\n"')),
    ] }) },
  // The bust (0x117F): its Examine tests Data1 for 0, Data2 for 1, and Data3
  // for 2 twice. Data3 is Data1 times 256 plus Data2, so it is 2 only with
  // Data1 0, which the first test has taken: the last two lines can never
  // print. The seventeen busts placed have Data2 0 and Data1 0, 1 or 2, so
  // the twelve with 1 or 2 printed nothing. The four tests read Data1 for 0,
  // 1, 2 and 3. Which line was meant for which number is not in the file:
  // this is a reading, which is why it is a design change. No bust has
  // Data1 3, so the inscription stays unseen.
  { id: 'bust-subjects', group: 'design', stage: 'further', title: 'Every bust has a line when examined, instead of twelve of the seventeen showing nothing',
    note: 'The busts with Data1 1 get the line about poor craftsmanship, and those with Data1 2 the line about Alaric. The file does not say which line belongs to which bust, so the fix works it out from the busts placed.',
    plan: (s) => {
      const what = 'the bust’s tests', seq = ['if_not', 'arg Arg00', 'get_field data2', 'byte 0x01', 'eq', 'then ->', 'string(implicit) "The craftsmanship isn\'t very good',
        'branch', 'if_not', 'arg Arg00', 'get_field data3', 'byte 0x02', 'eq', 'then ->', 'string(implicit) "It is a bust of Alaric',
        'branch', 'if_not', 'arg Arg00', 'get_field data3', 'byte 0x02', 'eq', 'then ->', 'string(implicit) "It has an inscription'];
      const p = dataPatchPlace(s, what, 0x117F, seq);
      return { edits: [[2, 'get_field data1 (0x6)'], [10, 'get_field data1 (0x6)'], [18, 'get_field data1 (0x6)'], [19, 'byte 0x03']]
        .map(([k, code]) => dataFixOneOp(p, what, 0x117F, k, code)) };
    } },

  /* ---- Maps (the stage "map"; map_fixes_patch.mjs, "Cythera Map Fixes")
     The two faults in the scenario's maps that the board reported and this
     project confirmed (26 September 2026, the Citadel's at the maintainer's
     choice). A map square is two bytes, and writeDelverMapTiles changes
     those and nothing else in the resource. Each edit reads the square and
     its neighbour first and stops the build if either is not the tile the
     reading found. */

  // The Hall of Truth's last pattern button (22 October 2026; the
  // maintainer's report, bugs.md, *Found outside the compendium's bug
  // section*). Button 160 at (35,37) of zone 19, the one record of its class
  // (0x1107), sends signal 206, which opens the door on to the riddles; it is
  // meant to be pressed from the room past the fifth pattern door, east of
  // it. It stands in wall tile 225, whose attributes have 0x4000, and the
  // program reads that bit as "what is in this wall can be reached from the
  // west": TDroppableWindow::CanSearch for a click, TDroppableWindow::
  // XDirection for a key, stop a thing in a wall square to the east only
  // when the square lacks it. West is the corridor at x 32 to 34, open once
  // its force walls are broken with the Crolna, so the button could be
  // pressed from there and the five rooms skipped. The tile cannot be
  // changed for one square without changing every wall drawn with it, so
  // with the fix the button's Use does nothing when whoever uses it stands
  // west of it.
  { id: 'hall-button-side', group: 'world', stage: 'found', title: 'The Hall of Truth’s last pattern button works only from the room it faces, instead of also from the corridor behind its wall',
    played: 'fork, 22 October 2026, alone, the hero put in zone 19, on the 68K and PowerPC slices: from the corridor at (34,37), U and the right arrow, or U and a click on the button, leave the door at (28,56) shut, where unpatched both open it; from the room at (36,37), U and the left arrow, or U and a click, open it patched and unpatched. Not played on Mac OS',
    edits: [
      { what: 'the button looks at who presses it', resid: 0x1107, at: 0x003E,
        expect: { 0x003E: 'if_not', 0x003F: 'arg Arg00', 0x0040: 'get_field data1' },
        code: [
          'if_not', 'global CurrentCharacter', 'get_field x (0x1)', 'arg Arg00', 'get_field x (0x1)', 'lt', 'then -> pressed',
          'return', 'byte 0x00', 'end',
          'pressed:'].join('\n') },
    ] },
  // The torch at the end of Omen's Test (0x8128 record 97, in the crate at
  // (56,31); 22 October 2026, bugs.md, from 453 and Selax@t1997, "sometimes
  // spent when its crate is opened"). A torch's Data1 is its burn time:
  // 0 for a fresh one, which lighting sets to 20, and the time left with
  // 0x80 set for one put out. TGameViewer::DoTicks counts Data1 down on
  // every record of a timed class while it is above 0 without 0x80, wherever
  // the record lies, and at 0 sends GetMessage 260, which the torch's class
  // (0x1026) answers by setting aspect 2, spent, whether it is lit or unlit.
  // This one is unlit with Data1 3 and no 0x80, the only one of the game's
  // nine unlit torches not at 0, so it burned down in the crate, and was
  // spent or whole by how long the test had run. It is given 0, as the
  // others have.
  { id: 'omens-torch', group: 'items', stage: 'found', title: 'The torch in the crate at the end of Omen’s Test is no longer spent before you find it',
    played: 'in part: fork, 68K, 22 October 2026, the behaviour in a save from Omen’s Test: with the torch’s Data1 3, as shipped, 110 passed turns leave it saved spent, aspect 2, still unlit in its crate; with Data1 0 set by an edit, saved whole. A save made inside the test already has the zone’s list, so the patched file changes the torch only for a new game, which was not played. Not played on Mac OS',
    dataEdits: [
      { what: 'the torch in Omen’s crate', resid: 0x8128, fn: (b) => {
          const r = b.subarray(97 * 16, 97 * 16 + 16);
          if (((r[4] << 8 | r[5]) & 0x3FF) !== 38 || r[0] !== 0x08 || r[6] !== 3) throw new Error('record 97 is not an unlit torch in a crate with Data1 3');
          r[6] = 0; return 'record 97 given Data1 0';
      } },
    ] },
  // The first Stronghold's kitchen (map 0x801F): the metal door at (22,18)
  // stands on tile 145, "wall", which blocks, so opening it shows a wall and
  // the step is rejected; the seven squares behind it are reached by nothing
  // else. The square is given the floor tile of the door beside it at (20,18),
  // 210.
  { id: 'stronghold-door', group: 'world', stage: 'map', title: 'The first Stronghold\u2019s kitchen door now opens onto floor, instead of wall',
    played: 'fork, 26 September 2026: through the door into the kitchen; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: through the metal door at (22,18) into the kitchen',
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
  // a blocking tile, and every embankment tile blocks, so the square is given
  // the grass of its neighbour to the north at (25,52), 52. That reads as a
  // notch in the embankment. It opens no other way: (25,52) has a tree,
  // which blocks, so the notch leads only onto the passage.
  { id: 'citadel-passage', group: 'world', stage: 'map', title: 'You can now step on the secret passage on the shore under the Citadel, instead of it blocking',
    played: 'fork, 26 September 2026: a step north reaches the Underground; Mac OS 8.5, 10 October 2026, “All Fixes” installed by Magpie: a step north from (25,54) reaches the Underground',
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

  { id: 'text', group: 'text', title: 'Misspellings and typos in the text, with the community\u2019s list',
    played: 'in part: the maintainer, some lines in Land King Hall; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Aethon, "a short, rat-faced man with a mischievous grin", and the lines each choice below names',
    parts: [
      { stage: 'text', plan: (s, ctx) => ({ textEdits: dataFixTextEdits(ctx.chosen) }) },
      { stage: 'community-text', plan: (s, ctx) => !ctx.chosen.has('text') ? {} : ({ textEdits: dataFixCommunityTypoEdits(dataPatchTexts(s), ctx.communityTypos || DATA_FIX_COMMUNITY_TYPOS,
          ctx.chosen.has('spelling-us') ? 'us' : ctx.chosen.has('spelling-uk') ? 'uk' : null).textEdits }) },
      { stage: 'spelling', plan: (s, ctx) => ({ textEdits: dataFixSpellingEdits(ctx.chosen) }) },
      { stage: 'text', plan: (s, ctx) => ({ dataEdits: dataFixArchetypeMind(s, ctx.chosen) }) },
    ] },
  { id: 'spelling-us', parent: 'text', choice: 'spelling', group: 'text', short: 'US spellings', title: 'Standardize to US spellings', played: 'fork, 68K, 10 October 2026, with the text fix: "musi" to Thoas, "the famous traveling bard.", against "travelling" unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Thoas, "the famous traveling bard."' },
  { id: 'spelling-uk', parent: 'text', choice: 'spelling', group: 'text', short: 'UK spellings', title: 'Standardize to UK spellings', played: 'fork, 68K, 10 October 2026, with the text fix: "iron" to Thuria, "despite rumours of troubles", against "rumors" unpatched; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: Thoas, "the famous travelling bard."' },
  /* The four that follow each go one way or the other, or neither (the
     maintainer, 1 October 2026): a pair shares a choice, drawn as a row of
     buttons with "don't" as the third, and the first of each pair, the
     maintainer's preference, is chosen when the page opens. */
  { id: 'text-two-taled', parent: 'text', choice: 'two-taled', group: 'text', short: '\u201cTwo-Taled Rat\u201d, as on its sign', title: 'Standardize to \u201cTwo-Taled Rat\u201d, as on its sign', played: 'fork, 68K, 10 October 2026, with the text fix: Thoas’s directions, "The Two-Taled Rat is at the edge of the Maze", against "The Two Tailed Rat" unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Thoas’s list and answer read "Two-Taled Rat"' },
  { id: 'text-two-tailed', parent: 'text', choice: 'two-taled', group: 'text', short: '\u201cTwo-Tailed Rat\u201d', title: 'Standardize to \u201cTwo-Tailed Rat\u201d', played: 'fork, 68K, 10 October 2026, with the text fix: Thoas’s directions, "The Two-Tailed Rat is at the edge of the Maze", against "The Two Tailed Rat" unpatched; Apis’s "job", "the Two-Tailed Rat.", against "Two-Taled"; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: Thoas’s list and answer read "Two-Tailed Rat"' },
  { id: 'text-land-king', parent: 'text', choice: 'land-king', group: 'text', short: '\u201cLand King\u201d, as in the manuals', title: 'Standardize to \u201cLand King\u201d, as in the manuals', played: 'fork, 68K, 10 October 2026, with the text fix: "alar" to Thoas, "Alaric is the Land King", against "LandKing" unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Thoas, "Alaric is the Land King"' },
  { id: 'text-landking', parent: 'text', choice: 'land-king', group: 'text', short: '\u201cLandKing\u201d', title: 'Standardize to \u201cLandKing\u201d', played: 'fork, 68K, 10 October 2026, with the text fix: "work" to Hector, "the meals for folks in the LandKing Hall", against "Land King Hall" unpatched; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: Thoas, "Alaric is the LandKing", and the zone’s title "LandKing Hall"' },
  { id: 'text-areithous', parent: 'text', choice: 'areithous', group: 'text', short: '\u201cAreithous\u201d, as in the Hintbook', title: 'Standardize to \u201cAreithous\u201d, as in the Hintbook', played: 'fork, 68K, 10 October 2026, with the text fix: "cook" to Laodice, "the reasons Areithous and I are so well suited.", against "Ariethous" unpatched; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the Kosha innkeeper, "I’m called Areithous"' },
  { id: 'text-ariethous', parent: 'text', choice: 'areithous', group: 'text', short: '\u201cAriethous\u201d', title: 'Standardize to \u201cAriethous\u201d', played: 'fork, 68K, 10 October 2026, with the text fix: "name" to the innkeeper of Kosha, "I’m called Ariethous", against "Areithous" unpatched; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: the Kosha innkeeper, "I’m called Ariethous"' },
  { id: 'text-hyphens', parent: 'text', choice: 'hyphens', group: 'text', short: 'hyphenated, \u201ckind-looking\u201d', title: 'Standardize to hyphenated: \u201ckind-looking\u201d, \u201cdour-faced\u201d and the like', played: 'fork, 68K, 10 October 2026, with the text fix: Thetis, "You see a dour-faced older woman", against "dour faced" unpatched; Bryaxis, "kind-looking", against "kind looking"; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: Thetis, "You see a dour-faced older woman"' },
  /* The Beserker's [sic] mind (8 October 2026; bugs.md, *A figure the
     creation dialog states and the game does not give*). The dialog's text
     reads 6 and the table the creation script reads has 12. The first
     option, the maintainer's on asking which made sense, mends the text:
     every archetype's three figures in the table come to 48, the
     Beserker's with its 12, and with the text's 6 they would come to 42.
     The second gives the hero the 6 the screen promises. Both were played
     in the fork: the dialog reading "Mind: 12", and a hero made with mind
     6. */
  { id: 'beserker-text', parent: 'text', choice: 'beserker', group: 'text', short: 'the screen shows 12, as the hero has', title: 'The creation screen gives the Berserker\u2019s mind as 12, which is what the hero has',
    played: 'the creation dialog, PowerPC, 8 October 2026; Mac OS 8.5, 11 October 2026, “All Fixes” installed by Magpie: the dialog reads "Mind: 12"' },
  { id: 'beserker-table', parent: 'text', choice: 'beserker', group: 'text', short: 'the hero has 6, as the screen shows', title: 'A Berserker starts with mind 6, as the creation screen shows',
    played: 'a new game, PowerPC, 8 October 2026; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: a new Berserker has Mind 6' },
  { id: 'text-no-hyphens', parent: 'text', choice: 'hyphens', group: 'text', short: 'unhyphenated, \u201ckind hearted\u201d', title: 'Standardize to unhyphenated: \u201ckind-hearted\u201d, \u201crat-faced\u201d and the like lose theirs', played: 'fork, 68K, 10 October 2026, with the text fix: Stentor, "You see a wide eyed man", against "wide-eyed" unpatched; Mac OS 8.5, 11 October 2026, with the text fix installed by Magpie: Stentor, "You see a wide eyed man"' },
  { id: 'text-sapphire-knowledge', parent: 'text', choice: 'sapphire', group: 'text', short: '“Sapphire Books of Knowledge”', title: 'Standardize to “Sapphire Books of Knowledge”, which leaves “Wisdom” to the second book' },
  { id: 'text-sapphire-wisdom', parent: 'text', choice: 'sapphire', group: 'text', short: '“Sapphire Books of Wisdom”, as in the To Do list', title: 'Standardize to “Sapphire Books of Wisdom”, as in the To Do list' },
  { id: 'text-oxford', parent: 'text', choice: 'oxford', group: 'text', short: 'Use them: “bread, and meat”', title: 'Standardize lists to a comma before the last “and” or “or”' },
  { id: 'text-no-oxford', parent: 'text', choice: 'oxford', group: 'text', short: 'Don’t use them: “bread and meat”', title: 'Standardize lists to no comma before the last “and” or “or”' },
  /* An "&" cuts a text short (24 October 2026; bugs.md, *Found reading the
     program's text and path code*). The program's text layout reads "&" as
     markup, the edge of a section shown only when a bit of the caller's
     flags is 1, and every caller but one passes 0, so nothing after the
     first "&" shows. Two texts use it for "and": in the stock game
     Aloiphos B stops at "lapis lazuli" and Eurybates's answer to "job" at
     "I'm the cook". A program change cannot mend them, since the "&" is
     markup either way. The bow shop's title, "Handcrafted bows & arrows!",
     shows whole in the same game and is left. */
  { id: 'ampersand', group: 'text', stage: 'text', title: 'The book Aloiphos B and Eurybates’s answer to “job” appear in full, instead of stopping at an “&”',
    played: 'fork, PowerPC, 24 October 2026, alone and in “All Fixes”. Aloiphos B, used on its shelf in Pnyx, goes on past "lapis lazuli and jasper are there", and Eurybates answers "job" with "I’m the cook and hunter for the camp.", against "lapis lazuli" and "I’m the cook" unpatched',
    plan: () => ({ textEdits: [
      dataFixT('Aloiphos B, "lapis lazuli & jasper"', 0x021D, 'lapis lazuli & jasper', 'lapis lazuli and jasper', 1),
      dataFixT('Aloiphos B, "jasmine & rose"', 0x021D, 'jasmine  & rose', 'jasmine  and rose', 1),
      dataFixT('Eurybates, "cook & hunter"', 0x1818, 'cook & hunter', 'cook and hunter', 1),
    ] }) },

  /* ---- Books and notes, and factual errors (the stage "text") ------------
     Off unless chosen, as Design Changes are (DATA_FIX_GROUPS). The books'
     slips were part of the text fix until 21 October 2026. */
  { id: 'writings', group: 'writings', stage: 'text', title: 'Misspellings and typos in the books, notes, letters and signs',
    plan: () => ({ textEdits: DATA_FIX_WRITINGS }) },
  // Myus is of House Comana, which rules Kosha (Darius: "youngest brother of
  // House Comana"; the Where Is heading "Myus of Comana"). The words missing
  // from the same line are the text fix's.
  { id: 'bryaxis-comana', group: 'facts', stage: 'text', title: 'Bryaxis sold his last lock to Myus of House Comana, instead of House Kosha',
    plan: () => ({ textEdits: [dataFixT('Bryaxis, "House Kosha"', 0x184C, 'Myus of House Kosha', 'Myus of House Comana', 1)] }) },
  // Magpie's "tale" (0x1803): the tale is Magpie's, and the narration has
  // Alaric laugh and caper as if the joke were his, then "again" beam after
  // Magpie's riddle. Alaric need not be in the room.
  { id: 'magpie-tale', group: 'facts', stage: 'text', title: 'In Magpie’s tale, Magpie laughs, capers and beams, instead of Alaric',
    plan: () => ({ textEdits: [
      dataFixT('Magpie’s tale, "Alaric laughs"', 0x1803, 'Alaric laughs and capers', 'Magpie laughs and capers', 1),
      dataFixT('Magpie’s tale, "Alaric again beams"', 0x1803, 'Alaric again beams', 'Magpie again beams', 1),
    ] }) },

  /* ---- Larger changes (the stage "apart"; karma_patch.mjs,
     resurrection_patch.mjs, peirithous_patch.mjs) --------------------------
     Each a separate patch at the maintainer's word, and kept out of "All
     Fixes", since each is a design call rather than a slip anyone can point
     to. Each touches one resource no other fix does. */

  // Killing a townsperson costs karma (0xE8D; 27 September 2026, "Cythera
  // Karma Fix"). THE SHIPPED RULE: the kill helper adds [+1, +4, -10, 0] to
  // karma, indexed by the victim's alignment (neutral 0, evil 1, good 2,
  // feral 3, the combat AI's names for them, STR# 9301), when the hero
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
  // records below 256 (a created creature is given one from 256 up). The script
  // cannot test that: the victim comes as a reference, a class tag in the
  // top bits over the number, and the interpreter's bitwise_and
  // (TInterp::DoExpr's case for 0x56) masks two plain numbers only, taking
  // another path for a tagged word. The victim's type it can read, as the
  // helper already reads its square. So a hatched guard, being a person,
  // costs karma too, and a hatched chicken costs none.
  { id: 'karma', group: 'design', stage: 'apart', title: 'Killing a townsperson now costs one karma, instead of adding one',
    played: 'fork, 68K, 10 October 2026, alone: Apis, her health set to 1 by an edit, killed by the hero in Cademia; karma saved as 54 from 55, against 56 unpatched; Mac OS 8.5, 11 October 2026, the fix’s patch installed by Magpie over “All Fixes”: Apis killed, karma saved as 54 from 55, against 56 unpatched. Read from a save copied out of the machine',
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
  // THE SHIPPED SPELL: on a corpse whose Data1 points at a character it sets the
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
  // RebuildParty hatches them immediately. Death does not touch the behaviour
  // byte (neither Die nor CharEntry::DeathRites writes it), and with no
  // creature on the map the `behavior` field reads it straight from the
  // record. The party writes 1 (following) and 2 (leading) when it rebuilds,
  // the Attack-target and Regroup commands 13, 1 and 2, and the combat AI's
  // tasks others below 14; leaving the party writes 143, being told to wait
  // 112, and the schedules use 0, 12, 15, 16 and 134 to 150. So a companion
  // dismissed or told to wait before they died is not taken back in, and one
  // killed in the party is. The one overlap: Dryas has a post at behaviour
  // 12, so Dryas killed while standing at it would rejoin. JoinParty rejects
  // a ninth member; then the person stands where the corpse lay, out of the
  // party, until the hour sends them home. NOT CHANGED: the Land King Amulet
  // used on a corpse (0x10F4), which runs the same code, and the hero's own
  // return to Land King Hall when the amulet is worn at death (0x1801), both
  // left as shipped at the maintainer's word, but for the corpse of nobody,
  // which nobody-corpse turns away in both. The map record needs a fifth
  // local; a function's locals are the third byte of its header, and UseOn's
  // header is at 0xA0.
  // The radio button (tile 0x1AC, sheet 0x8E1A, tile 12 of it): DrawCheck
  // in the program shows the tile's top-left quarter for a button not
  // chosen and its top-right for the chosen one, and the art has a dark,
  // empty socket at the top-left and a lit stone at the top-right. So the
  // chosen sex in the character maker is the light one, where a Mac's
  // chosen radio button is the filled, dark one; the maintainer found it
  // read backwards (3 October 2026). Probably drawn so on purpose, a stone
  // set in its socket, hence a design change. The two top quarters swap;
  // the dimmed and pressed quarters below them stay. The check box beside
  // it (tile 0x1AB) is drawn the usual way round and is left alone.
  { id: 'radio-buttons', group: 'design', stage: 'apart', title: 'The chosen radio button is now the dark one, as on a Mac, instead of the light one',
    played: 'fork, PowerPC, 10 October 2026, alone: a new game’s Character Archetype dialog, Male chosen, draws Male dark and Female light, against Male light and Female dark unpatched; Mac OS 8.5, 11 October 2026, a patch of the design changes installed by Magpie over “All Fixes”: the Character Archetype dialog draws Male, chosen, dark and Female light',
    dataEdits: [
      { what: 'the radio button’s two top quarters', resid: 0x8E1A, fn: (b) => {
          const col = decompressDCG(b, 32, 512), base = 12 * 1024;
          const lum = i => { const c = PALETTE[col[i]] || '000000'; return 0.3 * parseInt(c.slice(0, 2), 16) + 0.59 * parseInt(c.slice(2, 4), 16) + 0.11 * parseInt(c.slice(4, 6), 16); };
          let left = 0, right = 0;
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { left += lum(base + y * 32 + x); right += lum(base + y * 32 + 16 + x); }
          if (!(left < right)) throw new Error('the radio button’s top-left quarter is not the darker one; it may be swapped already');
          for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
            const a = base + y * 32 + x, c = a + 16, t = col[a]; col[a] = col[c]; col[c] = t;
          }
          const out = encodeDCGLiterals(col);
          const back = decompressDCG(out, 32, 512);
          for (let i = 0; i < col.length; i++) if (back[i] !== col[i]) throw new Error('the sheet does not decode back');
          return out;
      } },
    ] },
  { id: 'resurrection', group: 'design', stage: 'apart', title: 'Resurrection now brings the person back where the corpse lay, with their belongings and in the party, instead of nowhere until a later hour',
    played: 'Mac OS 8.5, 11 October 2026, the fix’s patch installed by Magpie over “All Fixes”: Hector, dead while in the party, raised from his corpse beside the hero; he is in the party again and stands beside the hero, against saved three squares off and out of the party unpatched. The hero was given Casting 15 by an edit: without it the cast failed about ten times in eleven. His belongings were not looked at; a dagger put inside his corpse is his after the raising, patched and unpatched alike',
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
  // A saved game has a separate character table, so this reaches new games
  // only.
  { id: 'peirithous', group: 'design', stage: 'apart', title: 'Peirithous, Judge Sacas\u2019s majordomo, is now alive in a new game, instead of dead',
    played: 'fork, 10 October 2026, alone: a new game on the PowerPC slice saves character 96 alive in Odemia at (55,40), against dead at (0,0) unpatched; that record put into a saved Odemia by an edit and placed, on the 68K slice, he stands at his post and answers "I am called Peirithous." and "I am the majordomo of Judge Sacas.". He was not met in the new game itself; Mac OS 8.5, 11 October 2026, the fix’s patch installed by Magpie: a new game saves him alive in Odemia at (55,40). Read from a save copied out of the machine; he was not met',
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
  // The Abydos ghost (0x1121), the vision the flatbread offering calls up
  // (0x10E7), the wishing fountain (0x1036), the riddle switch (0x1110) and
  // Omen (126) are named "Nothing" by the conversation box when they speak
  // (seen on the 2019 livestream at 1:17:45, 1:56:30 and 2:09:00; bugs.md,
  // Found checking the 2019 livestream). The first four speak as characters
  // 187, 188, 189 and 191 (TalkParticipant). TConversation::ShowPortrait
  // identifies a speaker through GetCharacterName, which reads the name
  // table (0x0201) only when the character's flag 7, the name known, is set
  // (byte 8, bit 0x80), and otherwise gives the tile name of the record's
  // prop type. These records are empty, prop type 0, whose tile is
  // "Nothing". The Degree Hall door (190, 0x1114) has the flag and the name
  // "Door", and was always right. Omen's record has prop type 0 too; his
  // conversation (0x1801) sets his flag 7 at 0x0639, after his first speech,
  // which ends "I am Omen", so that one box is headed "Nothing".
  // THE CHANGE, in two parts, one fix since 20 October 2026 (they were
  // nobody-speakers and blank-name, and the second alone already headed the
  // four "???"):
  //  - flag 7 set on the four, so the name table speaks: "???" for the
  //    ghost, the vision and the switch, which the maintainer chose to keep
  //    (19 October 2026), and "Fountain". Omen is not given the flag, which
  //    would name him before he is introduced. A saved game has a separate
  //    character table, so this part reaches new games only.
  //  - tile 0, the first entry of 0xF004, renamed "???", the name table's
  //    word for the other unnamed speakers, which heads Omen's first box.
  //    The tile names are read from Cythera Data and not the save, so this
  //    part reaches saved games too, where the four are headed "???" as
  //    well, the fountain included. Nothing else is shown with tile 0's name
  //    once the corner body is gone (the program's fix corner-body): it was
  //    the one thing of type 0 a player could Look at. The table is four
  //    bytes shorter; this comes after hydra-name, whose place it finds by
  //    offset, in the stage order.
  { id: 'nobody-speakers', group: 'talk', stage: 'apart', title: 'The Abydos ghost, the vision, the wishing fountain, the riddle switch and Omen are no longer called \u201cNothing\u201d when they speak',
    dataEdits: [
      { what: 'speakers 187, 188, 189 and 191 known by name', resid: 0xF009, fn: (b) => {
          for (const n of [187, 188, 189, 191]) {
            const r = b.subarray(n * 32, n * 32 + 32);
            if (r.some(x => x !== 0)) throw new Error('record ' + n + ' is not the empty record this fix expects');
          }
          for (const n of [187, 188, 189, 191]) b[n * 32 + 8] |= 0x80;
          return 'records 187, 188, 189 and 191, byte 8: flag 7 set';
      } },
      { what: 'tile 0 named \u201c???\u201d', resid: 0xF004, fn: (b) => {
          const expected = [0, 0, 0x4E, 0x6F, 0x74, 0x68, 0x69, 0x6E, 0x67, 0];
          if (expected.some((v, i) => b[i] !== v)) throw new Error('the first entry is not tile 0 "Nothing"');
          const name = [0, 0, 0x3F, 0x3F, 0x3F, 0];
          const out = new Uint8Array(b.length - expected.length + name.length);
          out.set(name); out.set(b.subarray(expected.length), name.length);
          return out;
      } },
    ] },
  // The manuscript on Semius the Golem Hunter (0x021D) has him buying a
  // lyre and "saying something about the 'key to opening being SGD'". The
  // lyre's lock (signal 131, the sewer's secret door to the room where his
  // bones lie in the cloak the manuscript gives him) needs PMG; SGD can be
  // played and opens nothing [Aventari,Alan Mercury,Croikle@t56]. The
  // letters are made the door's. A design change, at the maintainer's word
  // (12 October 2026): the manuscript calls it a rumour and "nonsense", so
  // the wrong letters may have been meant.
  { id: 'semius-notes', group: 'design', stage: 'apart', title: 'The manuscript on Semius the Golem Hunter now gives the notes that open the door, PMG, instead of SGD',
    played: 'Mac OS 8.5, 12 October 2026, the change alone, installed by Magpie: the bookshelf at (22,42) of Catamarca used and the manuscript scrolled to its end, "the \u2018key to opening being PMG\u2019", against "SGD" unpatched. The door was not played with it; PMG opening it is the board\u2019s and the lock\u2019s constant. Not played in the fork, where the scroll\u2019s window did not scroll',
    textEdits: [dataFixT('the Golem Hunter\u2019s notes', 0x021D, "'key to opening being SGD'", "'key to opening being PMG'", 1)] },
  // Thread and cloth colours differ (bugs.md): spinning makes yellow
  // thread, the loom retains the thread's aspect and changes its type, and the
  // cloth tiles after the thread's on sheet 0x8E2B are blue, red and green
  // where the thread's are yellow, blue and green. The cloth is redrawn to
  // match the thread (the maintainer, 3 October 2026): the blue cloth's
  // picture moves to aspect 1, the red cloth's picture, recoloured yellow,
  // is given aspect 0, and Ake's sale list is renamed to match. Red cloth
  // leaves the game.
  { id: 'cloth-colours', group: 'design', stage: 'apart', title: 'Thread is now woven into cloth of the thread\u2019s color, yellow, blue or green, instead of blue, red or green',
    played: 'fork, 68K, 10 October 2026, alone: cloth of aspects 0, 1 and 2 laid on a floor by an edit draws yellow, blue and green, against blue, red and green unpatched; fork, 68K, 16 October 2026, alone and with the other design changes: yellow thread used on a loom by a hero given the weaving skill makes cloth drawn yellow, against blue unpatched, and blue thread cloth drawn blue, against red; Ake, at her shop at noon, sells “Yellow Cloth”, “Blue Cloth” and “Green Cloth” with yellow, blue and green pictures, against “Blue Cloth”, “Red Cloth” and “Green Cloth” unpatched; Mac OS 8.5, 11 October 2026, a patch of the design changes installed by Magpie over “All Fixes”: cloth of aspects 0, 1 and 2 on a floor draws yellow, blue and green, against blue, red and green unpatched. The loom and Ake’s list were not seen on Mac OS',
    dataEdits: [
      { what: 'the cloth redrawn', resid: 0x8E2B, fn: (b) => {
          const col = decompressDCG(b, 32, 512), BLUE = 8 * 1024, RED = 9 * 1024;
          const count = (base, set) => { let n = 0; for (let i = 0; i < 1024; i++) if (set.includes(col[base + i])) n++; return n; };
          if (count(BLUE, [119, 120, 123]) < 50 || count(RED, [38, 40, 44, 45]) < 50) throw new Error('the cloth tiles are not the blue and red cloth this fix expects; it may be applied already');
          // The red cloth's reds and oranges, light to dark, to the palette's
          // yellow run, which the yellow thread is drawn from.
          const YELLOW = { 34: 51, 35: 53, 38: 54, 40: 55, 4: 56, 43: 57, 44: 58, 45: 59 };
          for (let i = 0; i < 1024; i++) {
            const red = col[RED + i];
            col[RED + i] = col[BLUE + i];
            col[BLUE + i] = YELLOW[red] !== undefined ? YELLOW[red] : red;
          }
          const out = encodeDCGLiterals(col);
          const back = decompressDCG(out, 32, 512);
          for (let i = 0; i < col.length; i++) if (back[i] !== col[i]) throw new Error('the sheet does not decode back');
          return out;
      } },
    ],
    textEdits: [
      dataFixT('Ake’s first cloth', 0x1820, 'Blue Cloth', 'Yellow Cloth', 1),
      dataFixT('Ake’s second cloth', 0x1820, 'Red Cloth', 'Blue Cloth', 1),
    ] },
  // Demodocus at the Bridge (GRIMOIRE-NOTES.md, 3 October 2026): his
  // schedule (character 109, 0xF00B) uses the Bridge while quest value 9 is
  // 2 ahead of his Cademia posts for quest value 4 at 5, and value 9 changes
  // only when the Bridge is entered again, so a bard met there stays there
  // whatever the trail shows. The Cademia posts now come first. A design
  // change at the maintainer's word, since the files do not say which was
  // meant.
  { id: 'demodocus-bridge', group: 'design', stage: 'apart', title: 'Demodocus now goes to Cademia when his trail ends there, instead of staying at the Bridge until you return to it',
    played: 'fork, 68K, 10 October 2026, alone: quest value 9 at 2 and value 4 at 5 set by edits in a saved Land King Hall, the clock just before noon so the hour turns as it loads; Demodocus is saved in Cademia at (18,101), against at the Bridge unpatched. With value 4 alone he is in Cademia on both. Read from the save, not seen on a screen; Mac OS 8.5, 11 October 2026, a patch of the design changes installed by Magpie over “All Fixes”: he is saved in Cademia at (18,101), against zone 38 at (11,9) unpatched. Read from a save copied out of the machine',
    dataEdits: [
      { what: 'Demodocus’s schedule', resid: 0xF00B, fn: (b) => {
          let p = 512;
          for (let i = 0; i < 109; i++) p += 8 * u16be(b, i * 2);
          const n = u16be(b, 109 * 2), seg = k => Array.from(b.subarray(p + 8 * k, p + 8 * k + 8));
          const conds = [...Array(n)].map((_, k) => b[p + 8 * k + 2] + ':' + b[p + 8 * k + 3]).join(' ');
          if (conds !== '132:0 1:0 137:2 1:0 132:5 132:5 132:5 132:5 132:5 132:5 132:5 1:0 0:0')
            throw new Error('Demodocus’s schedule is not the one this fix expects: ' + conds);
          const order = [0, 1, 4, 5, 6, 7, 8, 9, 10, 11, 2, 3, 12], segs = order.map(seg);
          segs.forEach((s, k) => b.set(s, p + 8 * k));
          return 'the Cademia posts moved ahead of the Bridge';
      } },
    ] },
  // A spell's failure roll (0xEA1, CastSpell): the cast fails when
  // Random(0, C) + Random(0, C) < Random(0, level), and Random stops one
  // short of its top, so a level-1 spell rolls Random(0, 1), always 0, and
  // never fails. The same slip left the bartenders with one list of rumours
  // (`rumours`) and eating with no jitter (`eat-to-heal`). Whether the
  // authors meant a first-level spell to be safe is not in the files or the
  // manual, so this is a design change: the roll's top becomes level + 1,
  // and it reaches the level at every level. (The maintainer's word, 13
  // October 2026; bugs.md, *A level-1 spell can never fail*.)
  { id: 'spell-fail-roll', group: 'design', stage: 'apart', title: 'A spell’s failure roll now reaches the spell’s level, so a level-1 spell can fail, instead of stopping one short',
    played: 'fork, 68K, 13 October 2026, alone: Minor Embrightenment, level 1, given as an ability by an edit with Casting at 1, performed ten times in Omen’s Test; "You failed to cast the spell." three times with the fix, never unpatched, and 20 magic spent on both. Not played on Mac OS, nor a spell of another level',
    edits: [
      { what: 'the failure roll', resid: 0xEA1, at: 0x00DB, replaceOp: true, expect: { 0x00D8: 'sys Random', 0x00D9: 'byte 0x00', 0x00DB: 'arg Arg01', 0x00DD: 'lt' }, code: 'arg Arg01\nbyte 0x01\nadd' },
    ] },
  /* A spell's magic taken once its target is chosen (the maintainer,
     30 September and 4 October 2026; the workbench's GRIMOIRE-NOTES.md,
     grimoire/cost-4817rt). Every spell's Use calls CastSpell (0xEA1) first,
     which rejects a cost above the caster's magic, deducts the magic, adds to
     the timing and rolls the failure; a targeted spell's Use then prompts "on
     whom?" or "where?" and answers its targeting word, and its target
     method (the class's fourth function: UseOn, or the square method of the
     runes and Fireball) does the spell. So a cancelled, rejected or mistaken
     target cost the magic. Now Use prompts without the call, and the target
     method begins with it, the same three arguments, returning 0 when it
     answers false: the "more power" message comes after the target, which
     is the maintainer's choice of the two (a check that does not deduct was
     the other, and needed a new helper).

     The 33 are found, not listed: every spell (0x1A00 to 0x1A3F) whose Use
     answers something besides 0. The untargeted spells keep the call where
     it is. A separate stage, after "apart", since Fetch's edit (stage bugfix)
     and Resurrection's locals byte (stage apart) are anchored at the
     shipped offsets of the scripts this shortens and lengthens.

     The computer's casters. 0xC4C, the cast task, calls Use and then UseOn
     on what Use answered; a monster with SpellsKnown casts free, so most
     are unchanged. A caster without it who cannot pay, or whose spell
     fails, now has Use answer and UseOn reject, so the cast task's
     method 0x43 on the target now runs for these failed casts too, as it
     always ran for every cast that succeeded. Not played. */
  // Eating to heal (9 October 2026, at the maintainer's word). The helper
  // 0xE46(thing, worth, quality) is an earlier way of eating that no script
  // of any release calls: the player alone eats, a meal raises health by
  // its worth and prints one of seven lines by its quality ("That was
  // amazingly tasty." at 0 down to retching at 6), a quality of 4 is worth
  // nothing, and at full health it answers "You aren't hungry." and leaves
  // the food. The shipped foods prompt "Feed to whom?" and add to the eater's
  // nutrition instead. This gives the helper its callers, the minimal way:
  //   - the three foods' Use eats at once, through their UseOn with the
  //     player, and their UseOn calls the helper;
  //   - the default EveryTurn (0x3020) never finds a member of the party
  //     hungry, so nobody eats from the pack or complains of hunger (the
  //     maintainer's choice: companions lose eating and hunger with it);
  //     the program still counts nutrition down and the innkeepers' meals,
  //     the fountain and Nutrient still raise it, to no effect on the party;
  //   - the helper's jitter rolls Random(0, 2) twice, so a quality varies
  //     by one either way, which was the fix `eating`.
  // THE FIGURES are this project's, the helper's callers being gone. Worth
  // is the food's figure before the shipped UseOn doubles it into
  // nutrition: flatbread 3, bread 5, cheese 4, grapes 3, pomegranate 2,
  // meat pie 8, kabobs 5, fowl 3, meat 6 and 8, fish 5, sausage 7, steak 10
  // (0x1045's table), hand-baked bread 8 (half its 16), and the mushroom
  // steak's three 5, 4 and 3. Quality: 1 for a worth of 8 or more and 2
  // below it, so the jitter stays among the lines 0 to 3 and never reaches
  // the one step better than 0, which has no line; the mushroom steak's
  // three take the verdicts their script gives them as talk balloons,
  // "Not very good" 3, "Yetch!" 4 and "Not bad" 2.
  { id: 'eat-to-heal', group: 'design', stage: 'apart', title: 'The hero eats food immediately and it restores health, with a line on how it tasted, instead of feeding someone to stave off hunger, and nobody in the party goes hungry',
    played: 'fork, 68K, 9 October 2026, alone and with every other fix: a hero at 10 of 28 health uses a stack of steak, "That was very good." and "That was tasty." and then "You aren\u2019t hungry." at full health with the rest of the stack kept, against "Feed to whom?" unpatched; a pomegranate, hand-baked bread, a mushroom steak and a dried jellyfish ("Yuck, that wasn\u2019t very good.", worth nothing) were eaten the same way; a starving Aethon with five flatbreads ate none and said nothing of hunger in five hundred turns, where unpatched he ate one within sixty; the steak run repeated on PowerPC; Mac OS 8.5, 11 October 2026, a patch of the design changes installed by Magpie over “All Fixes”: a hero at 10 of 28 uses a stack of six steaks four times, a line on the taste and then "You aren’t hungry." twice, 28 of 28 and four steaks left',
    edits: (() => {
      const eat = (worth, quality) => ['call_resource 0xE46', 'arg Arg00', ...worth, quality, 'end'].join('\n');
      const use = 'method UseOn (0xA)\narg Arg00\nglobal PlayerCharacter (0x5)\nend';
      const feed = { 0: 'if_not', 1: 'global IsPlayerTurn', 3: 'then', 6: 'string(implicit) "Feed to whom?' };
      const at = (base, o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [base + +k, v]));
      const byAspect = ['local Var00', 'arg Arg00', 'get_field aspect (0x3)', 'index'];
      return [
        // Nobody in the party is hungry: the default EveryTurn's test,
        // nutrition below 4, under which a member ate from the pack or said
        // "I'm starving", is made a test for below 0, which is never true.
        // (Until 9 October 2026, an hour after it shipped, this took out the
        // eating alone and left the lines; the maintainer had meant both.)
        { what: 'nobody in the party is hungry', resid: 0x3020, at: 0x01B3, replaceOp: true,
          expect: { 0x01AF: 'if_not', 0x01B1: 'get_field nutrition', 0x01B3: 'byte 0x04', 0x01B5: 'lt', 0x01EE: 'method UseOn' }, code: 'byte 0x00' },
        // The helper's two rolls.
        { what: 'eating, second roll', resid: 0xE46, at: 0x0040, replaceOp: true, expect: { 0x003D: 'sys Random', 0x0040: 'byte 0x01' }, code: 'byte 0x02' },
        { what: 'eating, first roll', resid: 0xE46, at: 0x0039, replaceOp: true, expect: { 0x0036: 'sys Random', 0x0039: 'byte 0x01' }, code: 'byte 0x02' },
        // Flatbread and its twelve kin (0x1045): worth by aspect from the table UseOn stores in Var00.
        { what: 'flatbread is eaten', resid: 0x1045, at: 0x013B, to: 0x0179,
          expect: { 0x00FF: 'set_local 0x00', 0x0101: 'data', 0x013B: 'set_local 0x01', 0x014D: 'set_field nutrition', 0x0179: 'return' },
          code: ['if_not', ...byAspect, 'byte 0x08', 'ge', 'then -> plain', eat(byAspect, 'byte 0x01'), 'branch done',
                 'plain:', eat(byAspect, 'byte 0x02'), 'done:'].join('\n') },
        { what: 'flatbread is used on the hero', resid: 0x1045, at: 0x00E0, to: 0x00F8, expect: { ...at(0x00E0, feed), 0x00F5: 'byte 0x08', 0x00F8: 'return' }, code: use },
        // Hand-baked bread (0x10E7): 16 of nutrition, so 8.
        { what: 'hand-baked bread is eaten', resid: 0x10E7, at: 0x007A, to: 0x009A,
          expect: { 0x007A: 'set_local 0x00', 0x008C: 'set_field nutrition', 0x0093: 'byte 0x10', 0x0097: 'sys Delete', 0x009A: 'return' },
          code: eat(['byte 0x08'], 'byte 0x01') },
        { what: 'hand-baked bread is used on the hero', resid: 0x10E7, at: 0x005B, to: 0x0073, expect: { ...at(0x005B, feed), 0x0070: 'byte 0x08', 0x0073: 'return' }, code: use },
        // The mushroom steak and its two kin (0x10D5): worth from its table, quality from its verdicts.
        { what: 'the mushroom steak is eaten', resid: 0x10D5, at: 0x0144, to: 0x0168,
          expect: { 0x00FF: 'set_local 0x00', 0x0113: 'set_local 0x01', 0x0144: 'set_local 0x02', 0x0154: 'set_field nutrition', 0x0165: 'sys Delete', 0x0168: 'return' },
          code: ['if_not', 'arg Arg00', 'get_field aspect (0x3)', 'byte 0x01', 'eq', 'then -> notyetch', eat(byAspect, 'byte 0x04'), 'branch done',
                 'notyetch:', 'if_not', 'arg Arg00', 'get_field aspect (0x3)', 'byte 0x02', 'eq', 'then -> steak', eat(byAspect, 'byte 0x02'), 'branch done',
                 'steak:', eat(byAspect, 'byte 0x03'), 'done:'].join('\n') },
        { what: 'the mushroom steak is used on the hero', resid: 0x10D5, at: 0x00E0, to: 0x00F8, expect: { ...at(0x00E0, feed), 0x00F5: 'byte 0x01', 0x00F8: 'return' }, code: use },
      ];
    })() },
  { id: 'spell-cost-after-target', group: 'design', stage: 'cost', title: 'A targeted spell now takes its magic once you choose the target, so a canceled cast costs nothing, instead of before',
    played: 'fork, 68K, 10 October 2026, alone: Awaken, given as an ability by an edit, performed and cancelled with Escape at "Cast ‘Awaken’ on whom?"; the hero’s magic saved as 30 of 60, untouched, against 29 unpatched; cast on its target, 29 on both. One spell of the 33; Mac OS 8.5, 11 October 2026, a patch of the design changes installed by Magpie over “All Fixes”: Awaken cancelled at its question leaves 30 of 60 magic, against 29 unpatched',
    plan: (s) => {
      const edits = [];
      for (let resid = 0x1A00; resid < 0x1A40; resid++) {
        if (!getResourceBytes(s.arc, resid)) continue;
        const L = dataPatchListing(s, resid);
        const i = L.ops.findIndex(o => o.text.startsWith('call_resource CastSpell'));
        if (i < 0) continue;
        const use = L.fns.findIndex(f => L.ops[i].at >= f.st && L.ops[i].at < f.en);
        const inUse = L.ops.filter(o => o.at >= L.fns[use].st && o.at < L.fns[use].en);
        const targeted = inUse.some((o, k) => o.text === 'return' && inUse[k + 1].text !== 'byte 0x00');
        if (!targeted) continue;
        const name = 'the spell 0x' + resid.toString(16).toUpperCase();
        const seq = ['if_not', 'call_resource CastSpell', 'arg Arg00', 'get_field container', 'byte ', 'byte ', 'end', 'then ->'];
        const p = dataPatchPlace(s, name + '\u2019s cost', resid, seq);
        const target = L.fns[use + 1];
        if (L.fns.length !== use + 2) throw new Error(name + ': the target method is not the last function');
        const first = L.ops.find(o => o.at >= target.st);
        // The target method's first, then Use's: the higher offset first.
        edits.push({ what: name + ' spends its magic on its target', resid, at: first.at, expect: { [first.at]: first.text },
          code: ['if', p.text(1), p.text(2), p.text(3), p.text(4), p.text(5), 'end', 'then -> paid', 'return', 'byte 0x00', 'end', 'paid:'].join('\n') });
        edits.push({ what: name + ' prompts for its target without spending its magic', resid, at: p.at(1), to: p.at(7), expect: p.expect, code: 'word True' });
      }
      if (edits.length !== 66) throw new Error('the targeted spells are ' + edits.length / 2 + ', not 33');
      return { edits };
    } },
  // A door makes its opening sound when it closes (25 October 2026). The
  // metal, windowed and oak doors' Use (0x1003, 0x1007, 0x100B) plays sound
  // 1 for any aspect below 9, the unlocked ones, and 25 for a locked one,
  // then turns the door through the helper 0xE40, which swaps the first and
  // third aspects it is passed and the second and fourth: 1 and 5, 3 and 7.
  // The unlocking helper 0xE44 leaves a door at the third or fourth, 5 or 7,
  // so those are closed and 1 and 3 open. The password door (0x1114, the
  // Degree Hall's) passes 1, 3, 13 and 15, and both copies on the maps start
  // at 13 and 15, closed; it plays sound 1 in two places. So a door used at
  // an aspect below 5 is open and closes, and plays sound 32 here, a short
  // impact nothing else plays, which the maintainer heard as a door closing;
  // any other unlocked door opens and still plays sound 1. Each call to
  // PlaySound is replaced by the choice of the two, the rest of Use as it was.
  // The calls are found by their instructions, not given by offset: with
  // every fix chosen, an earlier stage moves the password door's.
  // workbench doc/bugs.md, *Found tracing the missile sounds*.
  { id: 'door-close-sound', group: 'design', stage: 'apart', title: 'A door now makes a closing sound when it closes, instead of its opening sound',
    plan: (s) => ({ edits: [[0x1003, 1], [0x1007, 1], [0x100B, 1], [0x1114, 2]].flatMap(([resid, n]) => dataFixDoorSounds(s, resid, n)) }) },
  // A thrown or shot missile's flight sound is one the archive lacks (25
  // October 2026). The ranged attack (0x3042) gives the missile a thrown
  // weapon's Thrown element 3 or the ammunition's Ammunition element 1 as
  // the sound that follows it in stereo (ShootEffect, TGameViewer::DoMissile,
  // a TSoundTracker), and the small hole (0x1163) shoots two missiles with
  // sound 13. That is 13 for the arrow, the magic arrow, the sling stone, the
  // spear and the mystic spear, and 14 for the dagger and the cleaver, and
  // 0x910D and 0x910E are not in the archive, so all of them fly in silence.
  // The numbers follow how the missile flies: Thrown element 2, True for the
  // dagger, the cleaver and the rolling pin, makes 0x3042 pass 1 as
  // ShootEffect's sixth value, which cbMissileFX gives DoMissile and which
  // there builds a TMissileSpinner (cmpwi 0, 1 at 0x05F2F0) rather than a
  // straight TMissileThrower. So 13 is the straight fliers' sound, 14 the
  // spinning blades' and 15, the one the archive has, the rolling pin's spin.
  // The straight fliers take sound 34 (0x9122), which nothing plays, a
  // whoosh that swells to its middle (work/sfx-guides/missiles.py in the
  // workbench); the dagger and the cleaver take 15, the spinning sound, at
  // the maintainer's word. workbench doc/bugs.md, *Found tracing the missile sounds*.
  { id: 'missile-flight-sound', group: 'design', stage: 'apart', title: 'Arrows, sling stones and spears now whoosh as they fly, and daggers and cleavers whir as they spin, instead of flying in silence',
    edits: [0x0098, 0x0059].map(at => ({ what: 'the small hole’s missile', resid: 0x1163, at, replaceOp: true, expect: { [at]: 'byte 0x0D' }, code: 'byte 0x22' })),
    dataEdits: [
      [0x105F, 0x2B, 3, 14, 15, 'the dagger'], [0x10AB, 0x2B, 3, 14, 15, 'the cleaver'],
      [0x1064, 0x2B, 3, 13, 34, 'the spear'], [0x1178, 0x2B, 3, 13, 34, 'the mystic spear'],
      [0x1065, 0x2D, 1, 13, 34, 'the magic arrow'], [0x1066, 0x2D, 1, 13, 34, 'the arrow'], [0x1068, 0x2D, 1, 13, 34, 'the sling stone'],
    ].map(([resid, key, el, was, to, what]) => dataFixClassElement(what + '’s flight sound', resid, key, el, was, to)) },
  // The gong is drawn and has a sound, and nothing joins them (25 October
  // 2026). 0xF004 names tiles 0x892 and 0x893 "gong"; they lie at the end of
  // the painting's run (prop type 344, base tile 0x88C), so a painting at
  // aspect 6 or 7 shows the gong. Sound 43 (0x912B), delvmod's "Gong", is
  // played by nothing. No placed painting has aspect 6 or 7 and paintings have
  // no class, so nothing in the shipped game changes: a Hidden Bug, at the
  // maintainer's word. The fix makes the painting a class (0x1158), the
  // bell's class (0x10C1) copied: its table's two far addresses renamed to
  // the new resource, its ClassFlags entry made None so paintings keep the
  // flags they had (none), and its Use, which rings the bell and swings it
  // through eight aspects, replaced by one that plays sound 43 where the
  // painting stands when it shows the gong and otherwise answers as the
  // default Use (0x3009) does for a prop without a class, as every painting
  // did. 0x3009 is the default for method 9, Use, by delvmod's numbering,
  // which the defaults bear out (0x3020 EveryTurn, 0x3041 TakeDamage); the
  // archive's symbol for it, "CanWear", is from a numbering the scripts do
  // not use. workbench doc/bugs.md, *Found tracing the missile sounds*.
  { id: 'gong-sound', group: 'hidden', title: 'A gong, a painting showing the gong’s picture, now sounds when used, instead of doing nothing',
    parts: [
      { stage: 'further', plan: (s) => ({ dataEdits: [{ what: 'the painting’s class, from the bell’s', resid: 0x1158, create: true, fn: b => dataFixGongClass(b, s.bytesOf(0x10C1)) }] }) },
      { stage: 'apart', edits: [{ what: 'the painting’s Use sounds the gong', resid: 0x1158, at: 0x000F, to: 0x0099,
          expect: { 0x000F: 'sys PlaySound', 0x0010: 'byte 0x08', 0x0099: 'return' },
          code: ['if_not', 'arg Arg00', 'get_field aspect (0x3)', 'byte 0x06', 'eq', 'arg Arg00', 'get_field aspect (0x3)', 'byte 0x07', 'eq', 'or', 'then -> painting',
                 'sys PlaySound', 'byte 0x2B', 'arg Arg00', 'get_field x (0x1)', 'arg Arg00', 'get_field y (0x2)', 'end',
                 'branch rung',
                 'painting:',
                 'return', 'call_resource 0x3009', 'arg Arg00', 'end', 'end',
                 'rung:'].join('\n') }] },
    ] },
];
// The painting's class (0x1158) as a copy of the bell's (0x10C1), as the
// session has it: the class table's far addresses, which name the resource
// they point into, renamed, and the ClassFlags entry (key 39) made None.
// Only the bell's Use and its flags are in its table.
function dataFixGongClass(b, bellBytes) {
  if (b.length) throw new Error('0x1158 is made already');
  const bell = bellBytes.slice();
  const d = dvmDiscover(bell, 0x10C1), toff = d ? d.tableOffset : null;
  if (toff === null || (bell[toff] & 0xF0) !== 0xA0) throw new Error('the bell has no class table');
  const count = u16be(bell, toff) & 0x0FFF, keys = [];
  for (let i = 0, p = toff + 2; i < count; i++, p += 6) {
    const val = u32be(bell, p), key = u16be(bell, p + 4);
    if (val === 0x5000FFFF) continue;
    if (((val & 0x7FFF0000) >>> 16) !== 0x10C1) throw new Error('the bell’s key ' + key + ' points outside it');
    keys.push(key);
    if (key === 39) { bell[p] = 0x50; bell[p + 1] = 0x00; bell[p + 2] = 0xFF; bell[p + 3] = 0xFF; continue; }
    const to = (val & 0x8000FFFF) | (0x1158 << 16);
    bell[p] = to >>> 24; bell[p + 1] = (to >>> 16) & 0xFF; bell[p + 2] = (to >>> 8) & 0xFF; bell[p + 3] = to & 0xFF;
  }
  if (keys.sort((x, y) => x - y).join() !== '9,39') throw new Error('the bell’s table has keys ' + keys.join(', ') + ', not Use and ClassFlags');
  return bell;
}
// The sound of a door used: 32 when its aspect is below 5 (open, so it
// closes), 1 otherwise, in place of each call that played 1 alone and is
// followed by the door's turn (0xE40) or the jump past the locked sound. A
// door has `n` of them; any other count stops the build. Highest first, so
// each edit's offsets are still as found.
function dataFixDoorSounds(s, resid, n) {
  const play = k => ['sys PlaySound', 'byte 0x' + k.toString(16).toUpperCase().padStart(2, '0'), 'arg Arg00', 'get_field x (0x1)', 'arg Arg00', 'get_field y (0x2)', 'end'];
  const seq = play(0x01), ops = dataPatchListing(s, resid).ops, what = 'the door 0x' + resid.toString(16).toUpperCase(), out = [];
  for (let i = 0; i + seq.length < ops.length; i++) {
    if (!seq.every((t, k) => ops[i + k].text === t)) continue;
    const next = ops[i + seq.length];
    if (!(next.text === 'call_resource 0xE40' || next.text.startsWith('branch '))) continue;
    const expect = {}; seq.forEach((t, k) => { expect[ops[i + k].at] = t; });
    out.push({ what: what + '’s sound', resid, at: ops[i].at, to: next.at, expect,
      code: ['if_not', 'arg Arg00', 'get_field aspect (0x3)', 'byte 0x05', 'lt', 'then -> opens', ...play(0x20), 'branch played', 'opens:', ...play(0x01), 'played:'].join('\n') });
  }
  if (out.length !== n) throw new Error(what + ' plays its sound ' + out.length + ' times, not ' + n);
  return out.sort((a, b) => b.at - a.at);
}
// Element `el` of a class's data array under `key`, `was` before and `to`
// after, found through the class's table (dvmDiscover) in the bytes as the
// stage has them, so an edit that moved the array still finds it.
function dataFixClassElement(what, resid, key, el, was, to) {
  return { what, resid, fn: b => {
    const d = dvmDiscover(b, resid), toff = d ? d.tableOffset : null;
    if (toff === null || (b[toff] & 0xF0) !== 0xA0) throw new Error('no class table');
    const count = u16be(b, toff) & 0x0FFF;
    for (let i = 0, p = toff + 2; i < count; i++, p += 6) {
      if (u16be(b, p + 4) !== key) continue;
      const off = u32be(b, p) & 0xFFFF, words = dvmArrayWords(b, off);
      if (!words || words.length <= el) throw new Error('key 0x' + key.toString(16) + ' has no element ' + el);
      if (words[el] !== was) throw new Error('key 0x' + key.toString(16) + ' element ' + el + ' is ' + words[el] + ', not ' + was);
      const o = off + 2 + 4 * el;
      b[o] = (to >>> 24) & 0xFF; b[o + 1] = (to >>> 16) & 0xFF; b[o + 2] = (to >>> 8) & 0xFF; b[o + 3] = to & 0xFF;
      return 'key 0x' + key.toString(16).toUpperCase() + ' element ' + el + ', ' + was + ' to ' + to;
    }
    throw new Error('no key 0x' + key.toString(16));
  } };
}

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
  // Found by a grammar check of every line (LanguageTool, 20 October 2026,
  // after the 2013 MyshPlays video showed Metopes's): wrong words a
  // dictionary passes. A character's speech written as dialect is left as it
  // is (Eteocles's "I likes you", Ennomus's "he done told me", Tlepolemus's
  // "Them sea monster stories is true"), but "use to" is a misspelling of
  // the spoken "used to" whoever says it, as Meleager's "I'm use to" was.
  dataFixT('Metopes, "it\'s water" (twice)', 0x1847, "it's @water", 'its @water', 1),
  dataFixT('Metopes, "it\'s water" (twice)', 0x1847, "quality of it's water", 'quality of its water', 1),
  dataFixT('Metopes, "We though"', 0x1847, 'We though it was', 'We thought it was', 1),
  dataFixT('Metopes, "everbody"', 0x1847, 'Nearly everbody', 'Nearly everybody', 1),
  dataFixT('Emesa, "a Alaric\'s"', 0x1805, 'although a Alaric', 'although Alaric', 1),
  dataFixT('Pelagon, "Magpie]s"', 0x180D, 'Magpie]s features', "Magpie's features", 1),
  dataFixT('Laodice, "one the reasons"', 0x1813, 'which is one the reasons', 'which is one of the reasons', 1),
  dataFixT('Amphidamas, "Its a"', 0x1817, 'Its a pretty interesting metal', "It's a pretty interesting metal", 1),
  dataFixT('Pheres, "Its just"', 0x184E, 'Its just a theory', "It's just a theory", 1),
  dataFixT('Berossus, "in anyway"', 0x1848, 'in this in anyway', 'in this in any way', 1),
  dataFixT('Bryaxis, "Please to meet you"', 0x184C, 'Please to meet you', 'Pleased to meet you', 1),
  dataFixT('Larisa, "Please to meet you"', 0x185A, 'Please to meet you', 'Pleased to meet you', 1),
  dataFixT('Anisa, "the their"', 0x184D, 'He ended the their rule', 'He ended their rule', 1),
  dataFixT('Charax, "suppose to"', 0x184F, "isn't suppose to", "isn't supposed to", 1),
  dataFixT('Palaestra, "various element"', 0x1852, 'various @element to', 'various @elements to', 1),
  dataFixT('Glaucus, "This years"', 0x1866, 'This years crop', "This year's crop", 1),
  dataFixT('Neoptolemus, "now a days"', 0x1821, 'now a days', 'nowadays', 1),
  dataFixT('Philinus, "some where"', 0x1832, 'around here some where', 'around here somewhere', 1),
  dataFixT('Ascalon, "no where"', 0x1834, 'no where near', 'nowhere near', 1),
  dataFixT('Ascalon, "distain"', 0x1834, 'You have my distain', 'You have my disdain', 1),
  // The community's list makes it "beserk" [sic]; this comes first.
  dataFixT('Halos, "bezerk"', 0x183E, 'gone bezerk', 'gone berserk', 1),
  dataFixT('Periphas, "nerotic"', 0x1841, 'a nerotic man', 'a neurotic man', 1),
  dataFixT('the golems, "is was"', 0x0808, 'at one time is was common', 'at one time it was common', 1),
  dataFixT('Neoptolemus, "use to"', 0x1821, 'I use to be', 'I used to be', 4),
  dataFixT('Neoptolemus, "use to"', 0x1821, 'they use to have', 'they used to have', 1),
  dataFixT('Neoptolemus, "use to"', 0x1821, 'we use to', 'we used to', 2),
  dataFixT('Tlepolemus, "use to"', 0x1837, '"Use to hunt', '"Used to hunt', 1),
  dataFixT('Tlepolemus, "use to"', 0x1837, 'We use to be', 'We used to be', 1),
  dataFixT('Tlepolemus, "use to"', 0x1837, 'I use to play', 'I used to play', 1),
  dataFixT('Anisa, "use to"', 0x184D, 'He use to have', 'He used to have', 1),
  dataFixT('Polydamas, "use to"', 0x185F, 'what it use to be', 'what it used to be', 1),
  dataFixT('Glaucus, "use to"', 0x1866, 'I use to make', 'I used to make', 1),
  dataFixT('Stentor, "use to"', 0x186C, 'I use to', 'I used to', 3),
  // skills and spells
  ...[0x1AC0, 0x1AC1, 0x1AC2, 0x1AC3].map(r => dataFixT('training, "techinques"', r, 'techinques', 'techniques')),
  dataFixT('Death Strike, "grevious"', 0x1A06, 'grevious', 'grievous', 1),
  dataFixT('Mass Terrorisation, "shreaks"', 0x1A26, 'shreaks', 'shrieks', 1),
  dataFixT('the spell "Acertainment"', 0x1A07, 'Acertainment', 'Ascertainment', 1),
  dataFixT('Rune, "enscribe"', 0x1A16, 'will enscribe a Rune', 'will inscribe a Rune', 1),
  // Found checking the 2025 StormThalion video (bugs.md, under that title).
  ...[0x1A17, 0x1A1A, 0x1A21].map(r => dataFixT('the rune spells, "enscribes"', r, 'This spell enscribes a', 'This spell inscribes a', 1)),
  dataFixT('Directed Nexus, "creates opens"', 0x1A00, 'This spell creates opens a portal', 'This spell opens a portal', 1),
  // items and rooms
  dataFixT('the grimoire, "correspondances"', 0x104C, 'correspondances', 'correspondences', 1),
  dataFixT('a room, "cinammon"', 0x1BD6, 'cinammon', 'cinnamon', 1),
  dataFixT('a room, "libary"', 0x1BB0, 'libary', 'library', 1),
  dataFixT('a room, "the the forge"', 0x1B3A, 'the the forge', 'the forge', 1),
  dataFixT('the shop, "Its nothing special"', 0x0EA5, '- Its nothing special.', "- It's nothing special.", 1),
  dataFixT('the onlooker, "your doing"', 0x0D06, 'What do you think your doing?', "What do you think you're doing?", 1),
  dataFixT('the fountain, "obolio"', 0x1036, 'obolio', 'oboloi', 1),
  dataFixT('waking, "Your are"', 0x0A03, 'Your are wide awake', 'You are wide awake', 1),
  dataFixT('eating, "satifying"', 0x0A04, 'Very good, and satifying', 'Very good, and satisfying', 1),
  dataFixT('a room, "presense"', 0x1B9F, 'the presense of', 'the presence of', 1),
  // An air, or a smell, "of" two things fills, not fill; "A number of cots
  // fill the room" (0x1B33) is right and left.
  dataFixT('a room, "an air ... fill"', 0x1B04, 'power and order fill the room', 'power and order fills the room', 1),
  dataFixT('a room, "the smell ... fill"', 0x1B9B, 'food and wine fill the air', 'food and wine fills the air', 1),
  dataFixT('a room, "the smell ... fill"', 0x1BCA, 'metalwork and sweat fill the air', 'metalwork and sweat fills the air', 1),
  dataFixT('a room, "provisioners shop"', 0x1B9A, 'the provisioners shop', "the provisioner's shop", 1),
  // The books' slips are DATA_FIX_WRITINGS since 21 October 2026; their
  // choices stay here, as every choice applies to the whole text.
  dataFixT('Omen, "In the mean time"', 0x1CC3, 'In the mean time', 'In the meantime', 1),
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
  // the character sheet (the notes and signs are DATA_FIX_WRITINGS)
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
  // The hyphen finds "weary looking" only once the text's "wearly" is mended;
  // chosen without the text it hyphenates the line as the game has it
  // (3 October 2026: chosen alone it stopped the build, "found 0 times").
  Object.assign(dataFixT('Helen, "weary looking"', 0x1858, 'weary looking', 'weary-looking', 1), { opt: 'text-hyphens', withText: true }),
  Object.assign(dataFixT('Helen, "wearly looking"', 0x1858, 'wearly looking', 'wearly-looking', 1), { opt: 'text-hyphens', withText: false }),
  // Two keywords that matched only the misspelling they answered: Sardis's
  // "attu" for House Atussa, Ignae's "jhai" for Jhiaxus. With the words
  // corrected above, the keywords follow them (the same length, so no
  // offset moves).
  dataFixT('Sardis\u2019s keyword "attu"', 0x181F, 'attu', 'atus', 1),
  dataFixT('Ignae\u2019s keyword "jhai"', 0x187D, 'jhai', 'jhia', 1),
  // "LandKing" to "Land King" (24 September 2026, at the maintainer's word;
  // one of the options since the 28th): the author's unit table names
  // Alaric's unit "Land King", both manuals write it so 39 times and
  // "LandKing" never, the zone is titled "Land King Hall", and the dialogue
  // itself says "the Land King's side" beside its forty "LandKing"s. The
  // keywords are "land" and "king", which the two words still match.
  ...[0x021A, 0x021B, 0x0242, 0x0801, 0x0804, 0x0809, 0x080A, 0x080B, 0x080C, 0x080D, 0x080E, 0x0811,
      0x1801, 0x1802, 0x1803, 0x1804, 0x1807, 0x180D, 0x1846, 0x1A00]
    .map(r => Object.assign(dataFixT('"LandKing"', r, 'LandKing', 'Land King'), { opt: 'text-land-king' })),
  /* The other way, each of the four (1 October 2026): every place the game
     has the spelling the options above change away from, found by reading
     every resource for it on the day. "Two-Tailed" covers both the sign's
     "Two-Taled" and the directions' "Two Tailed". "LandKing" leaves the
     LandKing Amulet, a thing's name, as "Land King" does. "Ariethous"
     brings the four keyword lists that answer to "arei" with it, as
     Sardis's "attu" follows his spelling above, so a highlighted
     @Ariethous still answers; the name table has "Ariethous" already.
     Unhyphenated covers the five compounds the game hyphenated itself,
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
  /* Found reading every line of the text in order, code and all (21 October
     2026; workbench doc/text-read-2026-10.md, by resource). After the
     options above in the list, and each found by words none of them
     changes, so that "Two-Taled", "LandKing" and the hyphens can go either
     way under them. Left as the game has them: a question ended with a
     full stop for its tone, a capital that may be emphasis, a character's
     dialect, and lines whose fix would need new code. */
  // the To Do lines and the general topics
  dataFixT('To Do, Charax’s book', 0x021A, 'saw in the library at the Magisterium', 'saw in the library at the Magisterium.', 1),
  dataFixT('To Do, "a miner has"', 0x021A, 'Atymnius, a miner has', 'Atymnius, a miner, has', 1),
  dataFixT('To Do, Apis’s flour', 0x021A, 'Rat needs more flour', 'Rat, needs more flour', 1),
  dataFixT('To Do, Apis’s wine', 0x021A, 'Rat has you negotiating', 'Rat, has you negotiating', 1),
  dataFixT('Cademia, "is oldest city"', 0x0801, 'Cademia is oldest city', 'Cademia is the oldest city', 1),
  dataFixT('the mages, "aren\'t they?"', 0x0804, "great job, aren't they?", 'great job, are they?', 1),
  dataFixT('the mages, "handling out"', 0x0808, 'The handling out of', 'The handing out of', 1),
  ...[0x0808, 0x184D, 0x1851].map(r => dataFixT('"Prophesies"', r, 'Prophesies', 'Prophecies', 1)),
  dataFixT('Anisa, "the first prophesy"', 0x184D, 'the first prophesy', 'the first prophecy', 1),
  ...[0x0808, 0x0817].map(r => dataFixT('"lead us onto prosperity"', r, 'lead us onto prosperity', 'lead us on to prosperity', 1)),
  dataFixT('Land King Hall, "hall"', 0x0809, 'King hall as it used', 'King Hall as it used', 1),
  dataFixT('Pnyx, Demodocus', 0x080C, 'but I believe he left"', 'but I believe he left."', 1),
  dataFixT('Kosha, Demodocus', 0x080D, 'if he is still around"', 'if he is still around."', 1),
  dataFixT('Cademia, "the Tyrant\'s Castle"', 0x080E, "front hall of the Tyrant's Castle", "front hall of the Tyrants' Castle", 1),
  dataFixT('the students, "be Freemage"', 0x0810, 'She should be Freemage soon', 'She should be a Freemage soon', 1),
  dataFixT('the mine, "messhall"', 0x0811, 'serves food in messhall', 'serves food in the mess hall', 1),
  dataFixT('the mine, "messhall"', 0x0811, 'north of the messhall', 'north of the mess hall', 1),
  dataFixT('the dice game, "win 2:1"', 0x0812, 'If they match you win 2:1"', 'If they match you win 2:1."', 1),
  dataFixT('the Judges, "such as change"', 0x0817, 'such as change in House', 'such as a change in House', 1),
  // the helpers and things: a full stop, or a line break where the next
  // message ran on after the line
  dataFixT('locks, "It is now unlocked"', 0x0E44, 'It is now unlocked\n', 'It is now unlocked.\n', 2),
  dataFixT('locks, "It is now locked"', 0x0E44, 'It is now locked\n', 'It is now locked.\n', 2),
  dataFixT('sleep, "by its owner"', 0x0E93, 'by its owner\n', 'by its owner.\n', 1),
  dataFixT('the mirror, "Seven years"', 0x1014, 'Seven years, coming up...', 'Seven years, coming up...\n', 1),
  dataFixT('a potion, "quaff potion"', 0x101F, 'Whom should quaff potion?', 'Whom should quaff the potion?', 1),
  dataFixT('the crystal, "use are"', 0x1025, 'its source or use are beyond', 'its source or use is beyond', 1),
  dataFixT('a door, "It is locked"', 0x102B, 'It is locked\n', 'It is locked.\n', 1),
  dataFixT('a door, "It is magically locked"', 0x102B, 'It is magically locked\n', 'It is magically locked.\n', 2),
  dataFixT('the fountain, "Name your wish"', 0x1036, '"Name your wish"', '"Name your wish."', 1),
  // The quote is closed before the pause, as the game's other lines have
  // it. After the further stage's fix for the letter before a pause, a new
  // line stands before the pause, which a pause after a quote does not need.
  Object.assign(dataFixT('the fountain, the quote after the pause', 0x1036, 'No exceptions.*"', 'No exceptions."*', 1), { optional: true }),
  Object.assign(dataFixT('the fountain, the quote after the pause', 0x1036, 'No exceptions.\n*"', 'No exceptions."*', 1), { optional: true }),
  dataFixT('the dagger, "small, weapon"', 0x105F, 'a nice, small, weapon', 'a nice, small weapon', 1),
  dataFixT('butter, "perfectly good butter"', 0x1084, 'perfectly good butter.', 'perfectly good butter.\n', 1),
  dataFixT('a bed, "good nights rest"', 0x10B0, 'a good nights rest', "a good night's rest", 1),
  dataFixT('Omen, "Earth continue"', 0x10EA, 'forces of Earth continue,', 'forces of Earth continues,', 1),
  dataFixT('the glowing sword, "magical light."', 0x1119, 'with a magical light.', 'with a magical light.\n', 1),
  dataFixT('a kesh vial, "prevents"', 0x112A, 'wrongness prevents you', 'wrongness prevent you', 1),
  dataFixT('the hand mirror, "Seven years"', 0x113B, 'Seven years, coming up...', 'Seven years, coming up...\n', 1),
  dataFixT('the hand mirror, "already broken"', 0x113B, "It's already broken.", "It's already broken.\n", 1),
  dataFixT('the crystal ball, "gazes into"', 0x1141, 'One gazes into and', 'One gazes into it and', 1),
  dataFixT('the dummy, "unphased"', 0x1145, 'It appears unphased', 'It appears unfazed', 1),
  dataFixT('the abyss, "certainly fatal..."', 0x114C, 'and certainly fatal...', 'and certainly fatal...\n', 1),
  dataFixT('the moss, "gives of"', 0x1150, 'gives of nasty', 'gives off nasty', 1),
  dataFixT('boards, "with boards..."', 0x1156, 'with boards...', 'with boards...\n', 1),
  dataFixT('the spent staff, "burned out..."', 0x1157, 'It appears to be burned out...', 'It appears to be burned out...\n', 1),
  dataFixT('unguent, "leeched"', 0x118A, 'poison leeched out', 'poison leached out', 1),
  // Omen's visions, Alaric, Magpie
  dataFixT('Omen, the pause before he fades', 0x1801, 'alone..."Omen fades', 'alone..."*Omen fades', 1),
  dataFixT('Omen, the pause before he fades', 0x1801, 'warned."Omen fades', 'warned."*Omen fades', 1),
  dataFixT('Omen, "especially at night"', 0x1801, 'especially at night"', 'especially at night."', 1),
  dataFixT('Alaric, "the vision Magpie"', 0x1802, 'the vision Magpie appears', 'the vision of Magpie appears', 1),
  dataFixT('Alaric, "Swamp of Khalkis"', 0x1802, 'Swamp of Khalkis"', 'Swamp of Khalkis."', 1),
  dataFixT('Magpie, "called the Land King"', 0x1803, 'King"*"And this place', 'King."*"And this place', 1),
  // Hadrian to Hector
  dataFixT('Hadrian, "Greetings again, stranger"', 0x1804, '"Greetings again, stranger', '"Greetings again, stranger."', 1),
  dataFixT('Hadrian, "is fine lad"', 0x1804, 'Hector is fine lad', 'Hector is a fine lad', 1),
  dataFixT('Hadrian, "my father Lycus"', 0x1804, 'my father Lycus"', 'my father Lycus."', 1),
  dataFixT('Emesa, "Greetings again, stranger."', 0x1805, 'Greetings again, stranger.', 'Greetings again, stranger."', 1),
  dataFixT('Emesa, "a something"', 0x1805, 'get a something to eat', 'get something to eat', 1),
  dataFixT('Emesa, "some food"', 0x1805, 'She gives you some food\n', 'She gives you some food.\n', 1),
  dataFixT('Hector, "agents of evil,"', 0x1806, 'agents of @evil,"', 'agents of @evil."', 1),
  dataFixT('Hector, "and as well as"', 0x1806, 'my @father, and as well as make', 'my @father, as well as make', 1),
  dataFixT('Hector, "honorable profession"', 0x1806, 'honorable profession"', 'honorable profession."', 1),
  dataFixT('Hector, his mother', 0x1806, 'always says"', 'always says."', 1),
  dataFixT('Hector, the earthquake', 0x1806, "@earthquake, I don't know\"", "@earthquake, I don't know...\"", 1),
  // the guards
  ...[[0x1808, 1], [0x180F, 1], [0x1836, 1], [0x183F, 1], [0x1854, 1], [0x1864, 2]]
    .map(([r, n]) => dataFixT('a guard, "talk of such"', r, 'not permitted to talk of such"', 'not permitted to talk of such."', n)),
  // Myus, Naxos, Darius, and Kosha to Odemia
  ...[0x180A, 0x180B, 0x180C].map(r => dataFixT('"accuse me with"', r, 'accuse me with something', 'accuse me of something', 1)),
  dataFixT('Naxos, "a clear a failure"', 0x180B, 'a clear a failure', 'a clear failure', 1),
  dataFixT('Naxos, "Northshore Vineyards"', 0x180B, 'Northshore Vineyards', 'North Shore Vineyard', 1),
  dataFixT('Darius, "House Comana"', 0x180C, '@brother of House @Comana"', '@brother of House @Comana."', 1),
  dataFixT('Atreus, "but cunning smile"', 0x1810, 'but cunning smile', 'but a cunning smile', 1),
  dataFixT('Thuria, "interested investigating"', 0x1814, 'interested investigating', 'interested in investigating', 1),
  dataFixT('Thuria, "so-called ghost"', 0x1814, 'the so-called ghost"', 'the so-called ghost."', 1),
  // "good" and "sir" or "ma'am" are two strings, with no space between.
  dataFixT('Cybele, "goodsir"', 0x1816, '"Greetings again, good', '"Greetings again, good ', 1),
  dataFixT('Cybele, "about Opheltius"', 0x1816, 'anything about Opheltius"', 'anything about Opheltius."', 1),
  dataFixT('Amphidamas, "into ghost story"', 0x1817, 'look into @ghost story', 'look into the @ghost story', 1),
  dataFixT('Atymnius, "torches that hope"', 0x181D, 'spare torches that hope you never need', 'spare torches that you hope you never need', 1),
  dataFixT('Milcom, "use to"', 0x181E, 'I get use to the heat', 'I get used to the heat', 1),
  // The lady's greeting goes on from the space before "how", which this
  // edit starts at, so both have it.
  dataFixT('Sardis, "good man. how"', 0x181F, ' how can I be of service?', '  How can I be of service?', 1),
  dataFixT('Sardis, "Now is it"', 0x181F, 'Now is it ruled', 'Now it is ruled', 1),
  dataFixT('Sardis, "House Atussa"', 0x181F, '@Milcom, of House @Atussa"', '@Milcom, of House @Atussa."', 1),
  dataFixT('Ake, "the there"', 0x1820, 'that the there is', 'that there is', 1),
  dataFixT('Ake, "in Cademia"', 0x1820, 'House Strymon in Cademia"', 'House Strymon in Cademia."', 2),
  dataFixT('Ake, "say anymore"', 0x1820, "I can't say anymore", "I can't say any more", 2),
  dataFixT('Neoptolemus, "what your"', 0x1821, 'what your, dense', 'what are you, dense', 1),
  dataFixT('Meleager, "teach an"', 0x1822, 'Let me teach an important', 'Let me teach you an important', 1),
  dataFixT('Meleager, "with him"', 0x1822, 'anything to do with him"', 'anything to do with him."', 1),
  dataFixT('Meleager, "your service"', 0x1822, 'your @service"', 'your @service."', 1),
  dataFixT('Hebe, "to you your forgiveness"', 0x1823, 'looks to you your forgiveness', 'looks to you for your forgiveness', 1),
  dataFixT('Hebe, "mousey, woman"', 0x1823, 'slight, mousey, woman', 'slight, mousey woman', 1),
  dataFixT('Antenor, "of Odemia"', 0x1824, 'formerly of Odemia"', 'formerly of Odemia."', 1),
  dataFixT('Alastor, "like sort"', 0x1825, 'seem like sort that', 'seem like the sort that', 1),
  dataFixT('Alastor, "here are boots"', 0x1825, 'here are boots', 'here are the boots', 1),
  dataFixT('Alastor, "I will in turn,"', 0x1825, 'I will in turn, make', 'I will, in turn, make', 1),
  dataFixT('Apis, "the Two-Taled Rat"', 0x182A, "Rat'\"", "Rat'.\"", 1),
  dataFixT('Diomede, "truly great meal"', 0x182E, 'serves you truly great', 'serves you a truly great', 1),
  dataFixT('Diomede, "get interest"', 0x182E, 'can I get @interest you', 'can I @interest you', 1),
  dataFixT('Bias, "I am servant"', 0x1831, 'I am servant of', 'I am a servant of', 1),
  dataFixT('Philinus, the pause before the narration', 0x1832, '."Philinus searches', '."*Philinus searches', 1),
  dataFixT('Philinus, the pause before the narration', 0x1832, '."Philinus gives', '."*Philinus gives', 1),
  dataFixT('Philinus, "Catamarca a would"', 0x1832, 'Catamarca a would', 'Catamarca would', 1),
  dataFixT('Philinus, "an agent of the Land King"', 0x1832, 'King"*"That such', 'King."*"That such', 1),
  dataFixT('Ascalon, "man in Odemia"', 0x1834, 'most powerful man in Odemia"', 'most powerful man in Odemia."', 1),
  dataFixT('Ascalon, "working for Strymon"', 0x1834, 'working for @Strymon"', 'working for @Strymon."', 1),
  dataFixT('Eteocles, "key to the sewers"', 0x1838, 'honorary key to the sewers"', 'honorary key to the sewers."', 1),
  dataFixT('Propontis, "need search"', 0x183C, 'You need search elsewhere', 'You need to search elsewhere', 1),
  dataFixT('Halos, "I am Halos"', 0x183E, '"I am Halos"', '"I am Halos."', 1),
  dataFixT('Periphas, "a bag of flour"', 0x1841, '*He gives you a bag of flour', '*He gives you a bag of flour.', 1),
  dataFixT('Hypsenor, "elsewhere friend"', 0x1843, 'seek elsewhere friend.', 'seek elsewhere, friend.', 1),
  dataFixT('Thoas, "at around a forge"', 0x1844, 'working at around a forge', 'working at a forge', 1),
  // Catamarca and Pnyx
  dataFixT('Sacas, "her conscious"', 0x1846, 'her conscious.', 'her conscience.', 1),
  dataFixT('Sacas, "There more"', 0x1846, '"There more, though', '"There\'s more, though', 1),
  dataFixT('Sacas, "There were a gang"', 0x1846, 'There were a gang', 'There was a gang', 1),
  dataFixT('Sacas, "Thersites quarters"', 0x1846, '@Thersites quarters', "@Thersites' quarters", 1),
  dataFixT('Sacas, "find something"', 0x1846, 'hoping you\'d find something"', 'hoping you\'d find something."', 1),
  dataFixT('Sacas, "control of Cademia"', 0x1846, 'control of Cademia"', 'control of Cademia."', 1),
  dataFixT('Sacas, "from Thersites"', 0x1846, 'prison from Thersites"', 'prison from Thersites."', 1),
  dataFixT('Sacas, "come back later"', 0x1846, 'Please come back later"', 'Please come back later."', 1),
  dataFixT('Metopes, "is current ruling house"', 0x1847, 'is current ruling house', 'is the current ruling house', 1),
  dataFixT('Metopes, "to some degree"', 0x1847, 'to some degree"', 'to some degree."', 1),
  dataFixT('Metopes, "is resolved"', 0x1847, 'plague is resolved"', 'plague is resolved."', 1),
  dataFixT('Metopes, "a Freemage the next step"', 0x1847, 'a Freemage the next step', 'a Freemage is the next step', 1),
  dataFixT('Metopes, "that was the initial symptoms"', 0x1847, 'for that was the initial symptoms', 'for those were the initial symptoms', 1),
  dataFixT('Metopes, "under the city"', 0x1847, 'spring under the city"', 'spring under the city."', 1),
  dataFixT('Metopes, "Farewell"', 0x1847, '"Farewell"', '"Farewell."', 1),
  dataFixT('Berossus, "anymore"', 0x1848, 'see if anymore can', 'see if any more can', 1),
  dataFixT('Berossus, "anymore"', 0x1848, 'learn anymore about', 'learn any more about', 1),
  dataFixT('Itanos, "make much of,"', 0x1849, 'make much of, but', 'make much of it, but', 1),
  dataFixT('Itanos, "she called"', 0x1849, "'true seeing' she called.", "'true seeing' she called it.", 1),
  dataFixT('Timon, "I was in a spring"', 0x184A, 'I was in a spring', 'It was in a spring', 1),
  dataFixT('Timon, "I am Timon"', 0x184A, 'I am Timon"', 'I am Timon."', 1),
  dataFixT('Timon, "green crystal"', 0x184A, 'glowing green @crystal"', 'glowing green @crystal."', 1),
  dataFixT('Timon, "Headwater"', 0x184A, "call '@Headwater'\"", "call '@Headwater'.\"", 1),
  dataFixT('Timon, "River Tirynth"', 0x184A, 'River Tirynth"', 'River Tirynth."', 1),
  dataFixT('Timon, "Swamp of Khalkis"', 0x184A, 'found in the @Swamp of Khalkis"', 'found in the @Swamp of Khalkis."', 1),
  dataFixT('Timon, "west of Kosha"', 0x184A, 'west of @Kosha"', 'west of @Kosha."', 1),
  // Myus's house is a factual error, apart (bryaxis-comana).
  dataFixT('Bryaxis, "was Myus"', 0x184C, 'sold was Myus', 'sold was to Myus', 1),
  dataFixT('Bryaxis, "give to"', 0x184C, 'going to give to his', 'going to give it to his', 1),
  // The community's list mends Alastor's, Anisa's and Charax's
  // "Execellent", and not Pheres's two.
  dataFixT('Pheres, "Execellent"', 0x184E, 'Execellent', 'Excellent', 2),
  dataFixT('Anisa, Machaon', 0x184D, 'Mage Machaon use to live', 'Mage Machaon used to live', 1),
  dataFixT('Anisa, "wit lead"', 0x184D, 'quick wit lead him', 'quick wit led him', 1),
  dataFixT('Anisa, "Mage-friend"', 0x184D, 'Mage-friend community', 'Mage-friendly community', 1),
  dataFixT('Anisa, "happened its"', 0x184D, 'what happened its citizens', 'what happened to its citizens', 1),
  dataFixT('Anisa, "when basic problem"', 0x184D, 'when basic problem', 'when the basic problem', 1),
  dataFixT('Anisa, "least as far"', 0x184D, 'third, least as far', 'third, at least as far', 1),
  dataFixT('Pheres, "You peaceful"', 0x184E, 'You peaceful', 'You see a peaceful', 1),
  dataFixT('Pheres, "if could you"', 0x184E, 'if could you do', 'if you could do', 1),
  dataFixT('Pheres, "effected area"', 0x184E, 'reharmonizing effected area', 'reharmonizing the affected area', 1),
  dataFixT('Pheres, "give the basics"', 0x184E, 'I can give the basics', 'I can give you the basics', 1),
  dataFixT('Charax, the kelp', 0x184F, '*Charax takes the kelp', '*Charax takes the kelp.', 1),
  dataFixT('Lindus, "council"', 0x1850, 'to him for council', 'to him for counsel', 1),
  dataFixT('Lindus, "a well guarded"', 0x1850, 'are a well guarded', 'are well guarded', 1),
  dataFixT('Lindus, "one of greatest"', 0x1850, 'one of greatest', 'one of our greatest', 1),
  dataFixT('Lindus, "Headmaster of the Magisterium"', 0x1850, 'Headmaster of the Magisterium"', 'Headmaster of the Magisterium."', 1),
  dataFixT('Lindus, "talk to is Timon"', 0x1850, 'talk to is @Timon"', 'talk to is @Timon."', 1),
  dataFixT('Selinus, "Book of Kingdom"', 0x1851, 'Book of Kingdom', 'Book of the Kingdom', 1),
  dataFixT('Selinus, "a copy on that"', 0x1851, 'a copy on that', 'a copy of that', 1),
  dataFixT('Selinus, "copies Neleneus\'"', 0x1851, 'copies Neleneus', 'copies of Neleneus', 1),
  dataFixT('Palaestra, "and the places"', 0x1852, 'and the places certain', 'and then places certain', 1),
  dataFixT('Tros, "that doesn\'t fit"', 0x1853, "that doesn't fit this pattern", "that don't fit this pattern", 1),
  dataFixT('Alcestris, "your were born"', 0x1855, 'before your were born', 'before you were born', 1),
  dataFixT('Helen, "forgettable meal"', 0x1858, 'serves you forgettable', 'serves you a forgettable', 1),
  dataFixT('Joppa, "very nice person"', 0x185B, 'and very nice person', 'and a very nice person', 1),
  // "lovely ma'am" goes on from the spaces before "May", so both have it.
  dataFixT('Eumelus, "kind sir  May"', 0x185D, '  May the @plague never catch you.', '.  May the @plague never catch you.', 1),
  dataFixT('Eumelus, "Hey You"', 0x185D, "'Hey You'\"", "'Hey You'.\"", 1),
  dataFixT('Eumelus, "from wine"', 0x185D, 'from @wine"', 'from @wine."', 1),
  dataFixT('Eumelus, "wasn\'t I"', 0x185D, "wasn't I\"", "wasn't I?\"", 1),
  dataFixT('Eumelus, "too sober"', 0x185D, 'too sober"', 'too sober."', 1),
  // The community's list makes "spasm" "spasms" and leaves the verb, from
  // a collection that has "wrack"; both here, which the list then finds
  // mended.
  dataFixT('Polydamas, "spasms wracks"', 0x185F, 'Coughing spasm wracks', 'Coughing spasms wrack', 1),
  dataFixT('Polydamas, "didn\'t it"', 0x185F, "dicey there, didn't it\"", "dicey there, didn't it?\"", 1),
  dataFixT('Aethon, "a friend of mine"', 0x1861, 'a friend of mine"', 'a friend of mine."', 1),
  dataFixT('Dryas, "Goodbye"', 0x1862, '"Goodbye"', '"Goodbye."', 1),
  dataFixT('the Gate Guard, "House Nicander"', 0x1864, 'House @Nicander"', 'House @Nicander."', 1),
  dataFixT('the Gate Guard, "bandit Eudoxus"', 0x1864, 'bandit @Eudoxus"', 'bandit @Eudoxus."', 1),
  dataFixT('the Gate Guard, "to Philinus"', 0x1864, 'take the body to Philinus"', 'take the body to Philinus."', 1),
  dataFixT('Thersites, "Whomever"', 0x1865, 'Whomever is behind', 'Whoever is behind', 1),
  dataFixT('Thersites, "Captain of the Guard"', 0x1865, 'the Captain of the Guard"', 'the Captain of the Guard."', 1),
  dataFixT('Thersites, "with Love"', 0x1865, "with Love'\"", "with Love'.\"", 1),
  dataFixT('Thersites, "than she did"', 0x1865, 'more than she did"', 'more than she did."', 1),
  dataFixT('Thersites, "my responsibility"', 0x1865, 'are my responsibility"', 'are my responsibility."', 1),
  dataFixT('Glaucus, "wine in Cythera"', 0x1866, '@wine in Cythera"', '@wine in Cythera."', 1),
  dataFixT('Borus, "faced man"', 0x1867, 'faced man', 'faced man.', 1),
  dataFixT('Briseis, "Southland Vineyard"', 0x1868, 'the Southland Vineyard"', 'the Southland Vineyard."', 1),
  dataFixT('Briseis, "house Comana"', 0x1868, 'since house Comana', 'since House Comana', 1),
  dataFixT('Demodocus, "laying around"', 0x186D, 'an old set laying around', 'an old set lying around', 1),
  dataFixT('Demodocus, "village of Odemia"', 0x186D, 'village of Odemia"', 'village of Odemia."', 1),
  dataFixT('Demodocus, "The metics"', 0x186D, '"The metics', '"The Metics', 1),
  dataFixT('Semele, "that lead to"', 0x1875, 'mountains that lead to', 'mountains that led to', 1),
  // The Seldane's word order stays as the game has it; their "less" for
  // "lest" is a misspelling.
  dataFixT('Sabinate, "less"', 0x1878, 'use it, less you', 'use it, lest you', 1),
  dataFixT('Sabinate, "less"', 0x1878, 'we did, less corruption', 'we did, lest corruption', 1),
  dataFixT('Unhayt, "We are Unhayt"', 0x187A, 'We are Unhayt"', 'We are Unhayt."', 1),
  dataFixT('Uset, "weighted"', 0x187C, 'been weighted and', 'been weighed and', 1),
  dataFixT('Uset, "We are Uset"', 0x187C, 'We are Uset"', 'We are Uset."', 1),
  dataFixT('Ignae, "the rest of the human"', 0x187D, 'rest of the human,', 'rest of the humans,', 1),
  dataFixT('Ignae, "equals 0"', 0x187D, 'equals 0"', 'equals 0."', 1),
  dataFixT('Ur-Sylph, "we lead"', 0x187F, 'Once we lead', 'Once we led', 1),
  dataFixT('Ur-Sylph, "the last great Sylph"', 0x187F, 'last great @Sylph"', 'last great @Sylph."', 1),
  // the spells and skills
  dataFixT('Death Strike, "harm of"', 0x1A06, 'harm of whatever', 'harm to whatever', 1),
  dataFixT('Detect Rune, "some sorts"', 0x1A14, 'a rune of some sorts', 'a rune of some sort', 1),
  dataFixT('Rune of Pain, "a rune"', 0x1A21, 'a rune that causes', 'a Rune that causes', 1),
  dataFixT('Fireball, "effecting"', 0x1A22, 'effecting all', 'affecting all', 1),
  dataFixT('Daylight, "long last"', 0x1A25, 'a long last light', 'a long-lasting light', 1),
  dataFixT('Mass Confusion, "to among"', 0x1A2C, 'confusion to among', 'confusion among', 1),
  dataFixT('Remove Mage Lock, "no no"', 0x1A30, 'is no no longer', 'is no longer', 1),
  ...[0x1AC2, 0x1AC3].map(r => dataFixT('training, "in basics"', r, 'trained in basics', 'trained in the basics', 1)),
  // Awareness: the aptitude's line goes on from just past this word, so
  // its replacement is of the same length ("This skill enables one to").
  dataFixT('Awareness, "This skill ability"', 0x1ACD, 'ability', 'enables', 1),
  dataFixT('Fishing, "less talking"', 0x1ACE, 'less talking"', 'less talking."', 1),
  dataFixT('Thievery, the closing quote', 0x1AD6, 'need it)."', 'need it).', 1),
  dataFixT('Attack, "ones"', 0x1AF7, 'within ones own', "within one's own", 1),
  // the rooms, Omen, the combat line
  dataFixT('a room, "scrolls, line"', 0x1B03, 'scrolls, line the walls', 'scrolls line the walls', 1),
  dataFixT('a room, "bails of flax"', 0x1B37, 'bails of flax', 'bales of flax', 1),
  dataFixT('a room, "in very small"', 0x1BAF, 'You are in very small', 'You are in a very small', 1),
  dataFixT('a room, "it\'s original"', 0x1BD2, "not it's original", 'not its original', 1),
  dataFixT('Tavara, "back be now"', 0x1C2D, 'back be now', 'back by now', 1),
  dataFixT('a room, "trapping of office"', 0x1C30, 'the trapping of office', 'the trappings of office', 1),
  dataFixT('Omen, "where you\'ve been"', 0x1CC3, "see where you've been\"", "see where you've been.\"", 1),
  dataFixT('combat, "wounded!--"', 0x3041, 'wounded!--', 'wounded! --', 1),
  // The keyword fix for "Jhaixus" (above) reached Ignae's alone.
  ...[0x187B, 0x187C].map(r => dataFixT('the keyword "jhai"', r, 'jhai', 'jhia', 1)),
  // Magpie's topic for Chrysothemis answers "chrs", which her name never
  // matches; Alaric's answers "chry".
  dataFixT('Magpie’s keyword "chrs"', 0x1803, 'chrs', 'chry', 1),
  // Four more compounds for the hyphens.
  ...[[0x104E, 'one sided', 'one-sided'], [0x1B0F, 'recent cave in', 'recent cave-in'], [0x1B5D, 'low ceilinged', 'low-ceilinged'], [0x1B7B, 'well kept', 'well-kept']]
    .map(([r, a, b]) => Object.assign(dataFixT('"' + a + '"', r, a, b, 1), { opt: 'text-hyphens' })),
  // The Sapphire Books, either way (DATA_FIX_CHOICES). "Book of Wisdom",
  // the second volume, and Selinus's keyword for it, "wisd", stay.
  ...[[0x021A, 'Books of Wisdom', 'Books of Knowledge', 22], [0x1849, 'Sapphire Books of Wisdom', 'Sapphire Books of Knowledge', 1], [0x1849, 'sapp,wisd', 'sapp,know', 1],
      [0x184D, 'Sapphire Books of Wisdom', 'Sapphire Books of Knowledge', 1], [0x1851, 'Book of @Sapphire Wisdom', 'Book of @Sapphire Knowledge', 1],
      [0x1851, 'Books of Sapphire Knowledge', 'Sapphire Books of Knowledge', 1], [0x1851, 'Sapphire books of Knowledge', 'Sapphire Books of Knowledge', 1]]
    .map(([r, a, b, n]) => Object.assign(dataFixT('"' + a + '"', r, a, b, n), { opt: 'text-sapphire-knowledge' })),
  ...[[0x184D, 'Sapphire Books of Knowledge'], [0x1851, 'Books of Sapphire Knowledge'], [0x1851, 'Sapphire books of Knowledge']]
    .map(([r, a]) => Object.assign(dataFixT('"' + a + '"', r, a, 'Sapphire Books of Wisdom', 1), { opt: 'text-sapphire-wisdom' })),
  /* Oxford commas, either way (DATA_FIX_CHOICES): every list of three or
     more found on the day with a comma before its last "and" or "or", and
     every list that has none there. A run of clauses ("Go out the exit,
     past Odemia, and continue") is not a list, and the books' lists stay
     as their writers have them. */
  ...[[0x1036, 'license, dealer-prep or options'], [0x1802, 'Hall and all humanity'], [0x1849, 'divination and some sort'], [0x184F, 'Time and Change'],
      [0x1B03, 'papers and scrolls'], [0x1B9A, 'office and storeroom'], [0x1BCA, 'metalwork and sweat']]
    .map(([r, a]) => Object.assign(dataFixT('"' + a + '"', r, a, a.replace(/ (and|or) /, ', $1 '), 1), { opt: 'text-oxford' })),
  ...[[0x0221, 'a settlement, and then'], [0x0817, '@popularity, and the like'], [0x10EA, 'spoil our plans, and destroy'], [0x1802, 'mild weather, and peace'],
      [0x181E, '@Catamarca, and unrest'], ...[0x1828, 0x1829, 0x182A, 0x182D, 0x182E, 0x1858].map(r => [r, 'bread, and meat']),
      [0x184A, '@Naxos, and @Darius'], [0x1851, 'Foundation, and the Kingdom'], [0x187D, '@South, and @West'], [0x1B39, 'dusty, and hot'], [0x1BD0, 'roasted meats, and other']]
    .map(([r, a]) => Object.assign(dataFixT('"' + a + '"', r, a, a.replace(', and ', ' and '), 1), { opt: 'text-no-oxford' })),
  // tab bytes
  Object.assign(dataFixT('Tavara’s tabs', 0x1CC3, '\t', '', 10), { mid: true }),
  Object.assign(dataFixT('a rumour’s tab', 0x0813, '\t', '', 1), { mid: true }),
];

/* The slips in what the game's people wrote, the books (0x021B, 0x021D),
   the notes and letter (0x0219) and the signs (0x0218): the fix
   "writings", off unless chosen, at the maintainer's word of 21 October
   2026, since a writer in the world could have made them. The first
   fourteen were in the text fix from 24 September 2026; the rest are from
   the reading of every line. The Golem Hunter's notes (semius-notes) are a
   puzzle's key, not a slip, and stay a separate fix. Legendary Beasts
   breaks off mid-word with a stray quotation mark, "playing in the waves
   at a gr\"": the quotation mark becomes "...", as several of the books
   already end, since what followed is not in the file (21 October 2026,
   the maintainer's choice). The entry is the longest in 0x021D, and two
   more characters are safe: the scroll window copies its text into a
   string that grows to fit and draws it on a canvas 32,000 pixels tall. */
const DATA_FIX_WRITINGS = [
  dataFixT('"City of Mistery"', 0x021D, 'City of Mistery', 'City of Mystery', 1),
  dataFixT('"diverisified"', 0x021D, 'diverisified', 'diversified', 1),
  dataFixT('"percieve"', 0x021D, 'percieve', 'perceive', 1),
  dataFixT('"wreack"', 0x021D, 'wreack', 'wreak', 1),
  dataFixT('"live live"', 0x021D, 'live live', 'live', 1),
  dataFixT('"A expedition"', 0x021D, 'A expedition', 'An expedition', 1),
  dataFixT('"it wasn\'t 174"', 0x021D, "it wasn't 174 when", "it wasn't until 174 when", 1),
  dataFixT('"truely"', 0x021D, 'can they truely be', 'can they truly be', 1),
  dataFixT('"travellers tale"', 0x021D, 'travellers tale', "traveller's tale", 1),
  dataFixT('Alaric’s Government, "is was"', 0x021B, 'But is was through this', 'But it was through this', 1),
  dataFixT('Alaric’s Government, "a the basis"', 0x021B, 'formed a the basis', 'formed the basis', 1),
  dataFixT('the letter, "Berrosus"', 0x0219, '--Berrosus', '--Berossus', 1),
  dataFixT('Tavara’s note, "once chance"', 0x0219, 'but once chance', 'but one chance', 1),
  dataFixT('the sign "Eight Degree Hall"', 0x0218, 'Eight Degree Hall', 'Eighth Degree Hall', 1),
  dataFixT('the treasure note, "4 paces south"', 0x0219, '4 paces south', '4 paces S', 1),
  dataFixT('The Artifact of Pnyx, "artifact to almost"', 0x021B, 'rendering this artifact to almost', 'rendering this artifact almost', 1),
  dataFixT('Basic Alchemical Potions, "Mages Friend"', 0x021B, 'Mages Friend', "Mage's Friend", 1),
  dataFixT('Basic Alchemical Potions, "Smiths Friend"', 0x021B, 'Smiths Friend', "Smith's Friend", 1),
  dataFixT('the Book of Understanding, a verb missing', 0x021B, 'be able to this very abstract', 'be able to apply this very abstract', 1),
  dataFixT('the Book of the Kingdom, "viewed at"', 0x021B, 'can be viewed at the final', 'can be viewed as the final', 1),
  dataFixT('Basis of Magic, "to becoming"', 0x021D, 'attempting to becoming', 'attempting to become', 1),
  dataFixT('Lost Cult of Scylla, "that is it"', 0x021D, 'save that is it in', 'save that it is in', 1),
  dataFixT('Lifecycle of Scylla, "barrels shaped"', 0x021D, 'barrels shaped with', 'barrel-shaped, with', 1),
  dataFixT('Common Beasts, "than that ratlizard"', 0x021D, 'than that ratlizard', 'than the ratlizard', 1),
  dataFixT('Legendary Beasts, "tail are"', 0x021D, 'or their tail are rumored', 'or their tail is rumored', 1),
  dataFixT('Legendary Beasts, the end', 0x021D, 'in the waves at a gr"', 'in the waves at a gr...', 1),
  dataFixT('Magickal Beasts, "pure theoretical"', 0x021D, 'is pure theoretical', 'is purely theoretical', 1),
  dataFixT('"existance"', 0x021D, 'existance', 'existence', 4),
  dataFixT('the prophecies, "Prophesy"', 0x021D, 'Prophesy of Neleneus', 'Prophecy of Neleneus', 3),
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
  // As Alaric's cook has "specialty" and the Lost Cult of Scylla "worshiped" (the maintainer, 20 October 2026).
  dataFixT('"speciality"', 0x184A, 'speciality', 'specialty', 1),
  dataFixT('"worshipping"', 0x187F, 'worshipping', 'worshiping', 1),
  dataFixT('"worshippers"', 0x1C62, 'worshippers', 'worshipers', 1),
  dataFixT('"worshipped"', 0x1C67, 'worshipped', 'worshiped', 1),
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
    ['plow', 'plough'], ['mold', 'mould'], ['sulfur', 'sulphur'], ['armor', 'armour'], ['specialty', 'speciality'], ['worshiped', 'worshipped']];
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
// An option's row may hold only with the text or only without it
// (`withText`), where the text's correction comes first in the line.
function dataFixTextEdits(chosen) {
  return DATA_FIX_TEXT.filter(e => (e.opt ? chosen.has(e.opt) : chosen.has('text')) && (e.withText === undefined || e.withText === chosen.has('text')))
    .map(e => { const c = Object.assign({}, e); delete c.withText; return c; });
}
/* An archetype's mind where the dialog's text and the table differ.
   Nothing is given: the table is found by the creation script's
   `load_far_word`, the text by its "Mind: n", and every row whose two
   figures differ is mended one way or the other, which in the shipped file
   is the one row. The text is an array of pointers to strings laid end to
   end, so a figure of another length moves every string after it and its
   pointer with it; the array comes back laid out afresh. */
function dataFixArchetypeMind(s, chosen) {
  const toText = chosen.has('beserker-text'), toTable = chosen.has('beserker-table');
  if (!toText && !toTable) return [];
  // The far word the script indexes by its argument, not the one it keeps a
  // flag in a few lines above.
  const ops = dataPatchListing(s, 0x1801).ops, far = ops.find((o, i) => /^load_far_word 0x[0-9A-F]+$/i.test(o.text) && ops[i + 1] && /^arg /.test(ops[i + 1].text));
  const w = far ? parseInt(far.text.split(' ')[1], 16) : 0, rid = w >>> 16;
  if (!rid) throw new Error('the archetypes’ table is not in the creation script');
  const table = s.bytesOf(rid), top = dvmArrayWords(table, u32be(table, w & 0xFFFF) & 0xFFFF), text = parseDelverTextArray(s.bytesOf(0x0205));
  if (!top || !text) throw new Error('the archetypes’ table or the dialog’s text is not there');
  const odd = [];
  top.forEach((p, i) => {
    const at = (p & 0xFFFF) + 2 + 8, row = dvmArrayWords(table, p & 0xFFFF), m = text[i] ? /Mind: (\d+)/.exec(text[i].str) : null;
    if (row && row.length >= 3 && m && +m[1] !== row[2]) odd.push({ i, at, table: row[2], printedNumber: +m[1], digits: text[i].offset + m.index + 6, len: m[1].length });
  });
  if (!odd.length) throw new Error('the dialog and the table already match on every archetype’s mind');
  if (toTable) return [{ what: 'an archetype’s mind, as the dialog shows', resid: rid, fn: b => {
    for (const o of odd) { b[o.at] = 0; b[o.at + 1] = 0; b[o.at + 2] = (o.printedNumber >> 8) & 0xFF; b[o.at + 3] = o.printedNumber & 0xFF; }
    return odd.map(o => 'row ' + o.i + ', ' + o.table + ' to ' + o.printedNumber).join('; ');
  } }];
  return [{ what: 'an archetype’s mind, as the table gives it', resid: 0x0205, fn: b => {
    let out = b;
    // Last first, so an earlier figure's place is still where it was read.
    for (const o of odd.slice().sort((x, y) => y.digits - x.digits)) {
      const now = Array.from(String(o.table), c => c.charCodeAt(0)), grown = now.length - o.len;
      const next = new Uint8Array(out.length + grown);
      next.set(out.subarray(0, o.digits)); next.set(now, o.digits); next.set(out.subarray(o.digits + o.len), o.digits + now.length);
      const count = u16be(next, 0) & 0x0FFF;
      for (let n = 0; n < count; n++) { const p = 2 + n * 4, off = u16be(next, p + 2); if (next[p] >= 0x80 && off > o.digits) { next[p + 2] = ((off + grown) >> 8) & 0xFF; next[p + 3] = (off + grown) & 0xFF; } }
      out = next;
    }
    return out;
  } }];
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

   This reads each pair, resolves the words around it to the game's
   wording, and looks for those words in the game's text as it stands with
   the collection's markup allowed between them -- the game's strings have
   quotes, the click marks (*) and the @ of a highlighted word, and the
   collection's have none of these. A pair found once, or the same number of times as the
   game has the phrase, is an edit; one found nowhere is tried with fewer
   words around it, then with the misspelt word alone when the game has it
   in exactly one place; what is still not found is reported and left. Found with the
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
  // over the span of both, each misspelt word replaced at its place.
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

/* BEHIND THE SCENES. Fixes to what the game stores and no player sees, asked
   for by the maintainer on 4 October 2026 as a separate section. The
   first is the map editor's names for the maps, STR# 135 of Cythera Data's
   resource fork, one per map from map 1 (loadEditorZoneNames): three are
   misspelt there, and the game's text has each right -- the sign
   (0x218) and the innkeepers (0x805, 0x813) say "North Shore Vineyard" and
   "Southland Vineyard", and map 31 beside it is "Inner Brotherhood Hall".
   A Magpie patch changes only the data fork, so these are written into a
   whole copy of the file, as the Spanish one is. Each edit gives the
   string as the file has it, numbered from 1, and the build stops if it
   finds anything else, so a file that has it right already, or another
   list in that place, is rejected rather than overwritten. */
const DATA_RSRC_FIXES = [
  { id: 'editor-map-names', group: 'hidden', title: 'The Map Editor’s Names',
    note: 'Three of the map editor’s names for the maps are misspelled. The signs and characters in the game have them right. The game never shows the editor’s names, so a player sees no change.',
    rsrc: [
      { type: 'STR#', id: 135, index: 18, was: 'North Short Vinyard', now: 'North Shore Vineyard' },
      { type: 'STR#', id: 135, index: 20, was: 'Southland Vinyard', now: 'Southland Vineyard' },
      { type: 'STR#', id: 135, index: 33, was: 'Inner Broutherhood Dungeon', now: 'Inner Brotherhood Dungeon' }
    ] }
];
// The resource fork with the chosen fixes applied: { rsrc, log }. Throws,
// naming the fix and the string, when a string is not what the fix expects.
function applyDataRsrcFixes(rsrc, ids) {
  if (!rsrc || !rsrc.length) throw new Error('This copy has no resource fork.');
  const spec = resourceForkSpec(openResourceFork(rsrc));
  const log = [];
  for (const fix of DATA_RSRC_FIXES.filter(f => ids.includes(f.id))) {
    for (const e of fix.rsrc) {
      const r = spec.resources.find(x => x.type === e.type && x.id === e.id);
      if (!r) throw new Error(fix.title + ': this file has no ' + e.type + ' ' + e.id + '.');
      const list = appStrList(r.data);
      const actual = list[e.index - 1] ? decodeMacRoman(list[e.index - 1]) : null;
      if (actual !== e.was) throw new Error(fix.title + ': ' + e.type + ' ' + e.id + ' string ' + e.index + ' is “' + actual + '”, not “' + e.was + '”.');
      list[e.index - 1] = encodeMacRoman(e.now);
      r.data = appStrListBytes(list);
      log.push(e.type + ' ' + e.id + ' string ' + e.index + ': ' + e.was + ' → ' + e.now);
    }
  }
  return { rsrc: log.length ? writeResourceFork(spec) : rsrc, log };
}
