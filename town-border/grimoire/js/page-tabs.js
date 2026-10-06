/* Cross-references, the script view, concept search, the linked view and the tab tree.

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
   last of these. File 8 of 14. */

// --- Cross-references ------------------------------------------------------
// Knowing a resource's bytes is not the same as knowing what it is for. The
// other half of the answer is who loads it: a resource referenced from six
// item classes is a shared method, and a resource nothing references is dead
// weight left in the file. That question was previously unanswerable in this
// tool, so resources like 0x0301 sat as anonymous hex.
//
// Naive byte-scanning for a resource id does not work -- it drowns in false
// positives, because Delver bytecode is full of byte pairs that look like
// atoms. (Scanning the whole archive for 0x0301 this way turns up 50 "hits",
// every one of them a coincidence inside sound samples and portraits.) So
// references are read only from positions the container format says hold an
// atom: array elements, table values, and the operands of `word` (0x43) and
// `call_resource` (0x9F) inside disassembled code.
const XREF_SKIP_SUBN = new Set([127, 128, 131, 135, 137, 141, 142, 143, 144, 239]);

// Whole-archive index, built once and cached. Media subindexes are skipped:
// they are pixels and PCM, so any "atom" found in them is noise.
DERIVED.XREF_INDEX = null;
function buildXrefIndex() {
  if (DERIVED.XREF_INDEX) return DERIVED.XREF_INDEX;
  const outbound = {}, inbound = {};
  if (ARCHIVE) {
    for (let subn = 0; subn < 256; subn++) {
      const mi = ARCHIVE.index[subn];
      if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
      const count = subindexCount(ARCHIVE, subn);
      for (let ri = 0; ri < count; ri++) {
        const resid = ((subn + 1) << 8) | ri;
        let raw;
        try { raw = getResourceBytes(ARCHIVE, resid); } catch (e) { raw = null; }
        if (!raw || !raw.length) continue;
        let data;
        try { data = smartDecrypt(raw, resid).data; } catch (e) { continue; }
        let refs;
        try { refs = dvmOutboundRefs(data, resid); } catch (e) { refs = []; }
        // Collapse repeats: what matters is that A references B, and how many
        // times, not each byte offset.
        const seen = {};
        for (const r of refs) {
          const k = r.target + '|' + r.via;
          if (!seen[k]) seen[k] = { target: r.target, via: r.via, kind: r.kind, detail: r.detail, count: 0, first: r.off };
          seen[k].count++;
        }
        const list = Object.keys(seen).map(k => seen[k]);
        if (list.length) outbound[resid] = list;
        for (const e of list) {
          // `at` is where in `from` the first of them is, so Referenced by can
          // open that script ringed at the line rather than at its head.
          (inbound[e.target] = inbound[e.target] || []).push({ from: resid, via: e.via, kind: e.kind, detail: e.detail, count: e.count, at: e.first });
        }
      }
    }
  }
  return (DERIVED.XREF_INDEX = { outbound, inbound });
}

// --- Script view -----------------------------------------------------------
// A resource used to arrive as one undifferentiated wall of text: class header,
// cross-references, disassembly, extracted strings and a hex dump, all in the
// same <pre>. It was impossible to tell what had been read from the file, what
// had been inferred, and what any of it was for. Everything below exists to
// separate those: what this resource IS, how it was read, who uses it, and
// only then the code.
//
// Descriptions are the wiki's own words where it has any, and say so plainly
// where it does not. Guessing a purpose would be worse than admitting none.
const SUBINDEX_PURPOSE = {
  0:   ['Symbol table', 'One resource, 0x0101, holding names for numbered things. They are the developers’ names and do not always match the game as released, so they are a hint rather than the truth.'],
  1:   ['Data lists and the game’s writing', 'Lists of things: character names, and the global values the symbol table in subindex 0 names. It is also where Cythera’s in-game writing is: the bookshelf histories and bestiaries, the prophecies, the scrolls and letters, the signs, the gravestones and the ring inscriptions. Each passage is one entry in a list, and a thing in the world picks its entry with the number in its Data1. The Mechanics page covers them under The game’s own writing.'],
  2:   ['Global store', '0x301 holds four values that any script can read and write: the quality of each inn. 0x33F is four bytes that nothing uses.'],
  3:   ['AI combat scripts', 'Named behaviors: Attack Nearest, Defend, Beserk, Healer. The file stores each unencrypted, as a name followed by a body that is not script code like the rest of the file.'],
  4:   ['Archetypes', '0x501 is the nine characters a game can start as, in the order 0x203 names them (Explorer, Fighter, Swordsman, Beserker [sic], Mage, Wizard, Mystic, Storyteller, Rogue) and 0x204 describes them. Each holds body, reflex and mind, then the skills it starts with: the skill’s number plus 1,024 for each level of it, where a level of 0 means an aptitude for the skill rather than the skill itself. The dialog that creates a character reads it. 0x500 and 0x540 contain only zeros.'],
  7:   ['Group dialogue', 'Dialogue shared by a faction or a place rather than belonging to one character.'],
  8:   ['Combat AI tests and actions', 'The half of the combat AI’s vocabulary that lives in this file: six tests at 0x901 and thirteen actions at 0x981, in the order the program’s lists (STR# 9307 and 9308) name them, which this page shows when the game is open. The compiled AI rules that come with the game call them, and four dialogues call two of them directly.'],
  9:   ['Effect scripts', 'Effects of eating, and possibly of spells and potions.'],
  10:  ['Stub', 'One function, seven bytes long, that answers 0. Nothing in the file or the program asks for it.'],
  11:  ['Task helpers', 'Scripts that give a character something to do: the innkeeper’s service lines (0xC80), opening and closing doors (0xC81 to 0xC83), the tavern barks (0xC84, 0xC85), the blacksmith’s work (0xC86), and the spell-cast announcements (0xC4B, 0xC4C).'],
  12:  ['Party and inventory helpers', 'Scripts that go through what the party is carrying: what it holds and what that weighs, counting money (0xD04), the reaction to theft (0xD06), and coins spilling when a purse is too heavy (0xD09).'],
  13:  ['Rule helpers', 'The scripts the page reads the rules from: lock picking (0xE43), combat (0xE84 to 0xE89), experience and levels (0xE86, 0xE8B), spells (0xEA1), shops (0xEA5), training (0xEB1), damage (0xEB8).'],
  14:  ['Character helpers', 'Twenty-two scripts of one function each, every one acting on a single character: set, clear and test a flag (0xF00 to 0xF02, called from hundreds of lines of dialogue), behavior, health, poison, attributes, experience, level, karma, and two that make a character.'],
  15:  ['Item classes', 'What each kind of item is: what it is called, and what happens when you use it.'],
  16:  ['Object classes', 'Objects with data and scripts, and text in them that you can read.'],
  19:  ['Zone entry scripts', 'One for each map. It runs as you enter the zone, and holds the zone names the game shows.'],
  20:  ['Sub-zone scripts', 'For maps that hold several zones in one 0x80xx resource, where not all of it appears at once.'],
  23:  ['Character dialogue', 'What a named character says when you talk to them.'],
  24:  ['Monster classes', 'What each kind of monster is. The script that sets one up gets the monster and the thing that represents it, and entry 0x1D says what happens when it dies.'],
  25:  ['Skill & spell classes', 'Descriptions and scripts for spells, skills and actions. Usually several small functions: one gives the name, another the description.'],
  26:  ['Room scripts', 'One for each room, id 0x1B00 plus the room number: the description shown the first time you enter, and for some rooms an Enter that does more. A room is a rectangle marked on the map by an egg, which is a trigger with nothing to see.'],
  27:  ['Room scripts', 'Rooms 256 to 511 are here, in the same form as 0x1Bxx; the file has rooms 301 to 454.'],
  29:  ['Room scripts', 'Room 800, the one room numbered past 511; entering it changes zone.'],
  47:  ['Character actions', 'Scripts that seem to be for things done to a character, ToggleLock among them.'],
  127: ['Maps', 'The grid of tiles that makes up a map, with its size and its four exits, one to each point of the compass.'],
  128: ['Prop lists', 'One for each map: a 16-byte record placing every object, door and container on it.'],
  131: ['Landscapes', 'Backdrop artwork: 18 images the maps share.'],
  135: ['Portraits', 'Character portrait graphics.'],
  137: ['Graphics', 'One 32 by 16 icon for each skill and spell: icon n belongs to 0x1A00 plus n.'],
  141: ['Tile sheets', 'The terrain and object tiles that make up the maps.'],
  142: ['Graphics', 'Sprite and animation frames.'],
  143: ['Music', 'The music, as QuickTime Music tunes.'],
  144: ['Sounds', 'Sound effects.'],
  239: ['Data tables', 'Tile names, tile attributes, schedules, and lists of names that seem to label what the game keeps track of.']
};

function svEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Navigate to another resource by id, across subindexes, so a cross-reference
// is something you can follow rather than a number to write down.
function jumpToResource(resid) {
  // The Tombstone slab is filed under the tile sheets and shown with the
  // sized images; see onCategoryChangeImpl.
  const subn = resid === 0x8EFF ? 142 : Math.floor(resid / 0x100) - 1;
  const cat = document.getElementById('categorySelect');
  if (!cat) return false;
  window.LISTING_AT = null;   // a ring is jumpToScriptAt's, set after this returns
  let value = null;
  for (const o of cat.options) if (parseInt(o.value) === subn) { value = o.value; break; }
  if (value === null) return false;
  window.PENDING_SINGLE = resid;   // see the end of onCategoryChangeImpl
  try {
    if (!showCategory(value)) return false;
    if (!openResource(resid)) { renderContactSheet(); return false; }
  } finally { window.PENDING_SINGLE = null; }
  syncDeepLink();   // the one entry for this jump, now that the switch is silent
  window.scrollTo(0, 0);
  return true;
}

/* A link from one thing to a related thing, everywhere the site draws one.

   These used to be monospace chips with the hex id first -- "0x8801
   Portrait" -- which read as code rather than as a way to the thing. A
   relation chip reads the other way round: the icon of the tab the target
   lives under, then what it is called, then what it is, and the hex id as
   a quiet tail for the reader who wants it. The icon is the same game tile
   the tab bar draws, so a chip to a portrait wears the mirror and a chip to
   a map wears the town, and a reader learns where a click will land before
   making it. Data URLs, cached per tile, so a strip of thirty chips costs
   one small draw per distinct icon and not thirty canvases. */
const _relIconURLs = derivedMap('_relIconURLs');
function relIconURL(spec) {
  const key = spec && spec.tile !== undefined ? 't' + spec.tile : spec && spec.icon !== undefined ? 'p' + spec.icon : '';
  if (!key) return '';
  if (_relIconURLs.has(key)) return _relIconURLs.get(key);
  let url = '';
  try { const c = navIconCanvas(spec, 16); url = c.width ? c.toDataURL('image/png') : ''; } catch (e) { url = ''; }
  _relIconURLs.set(key, url);
  return url;
}
function relChip(o) {
  const hex = o.resid !== undefined ? '0x' + o.resid.toString(16).toUpperCase().padStart(4, '0') : '';
  const onclick = o.js || ('jumpToResource(' + o.resid + ')');
  // A chip shows the thing's own picture when the caller has one (a sprite, a
  // face); the icon of the tab it leads to went on 2 October 2026, at the
  // maintainer's word, as one more picture beside every link that said nothing.
  const icon = o.icon || '';
  return '<button class="relChip" onclick="' + onclick + '"' +
    (o.title ? ' title="' + svEsc(o.title) + '"' : '') + '>' +
    (icon ? '<img class="relIcon' + (o.face ? ' relFace' : '') + '" src="' + icon + '" alt="" width="16" height="16">' : '') +
    '<span class="relText"><span class="relMain">' + svEsc(o.main) + '</span>' +
    (o.sub ? '<span class="relSub">' + svEsc(o.sub) + '</span>' : '') + '</span>' +
    (hex && o.main !== hex ? '<span class="relHex">' + hex + '</span>' : '') +
    (o.note ? '<span class="relNote">' + svEsc(o.note) + '</span>' : '') +
    '</button>';
}

// What a resource is, in a word or two, for the second line of a chip:
// "portrait", "zone script", "tile sheet". The gallery names are plural
// and long; these are the same things said the way a caption says them.
const RESOURCE_KIND = { 0: 'symbols', 1: 'text', 2: 'store', 3: 'combat AI', 4: 'archetype table',
  7: 'group dialogue', 8: 'AI hook', 9: 'effect', 10: 'stub', 11: 'helper', 12: 'helper', 13: 'helper',
  14: 'helper', 15: 'object text', 16: 'object script', 19: 'zone script', 20: 'sub-zone script',
  23: 'dialogue', 24: 'monster class', 25: 'skill', 26: 'room script', 27: 'room script',
  29: 'room script', 47: 'action script', 127: 'map', 128: 'prop list', 131: 'landscape',
  135: 'portrait', 137: 'skill icon', 141: 'tile sheet', 142: 'graphic', 143: 'music', 144: 'sound',
  239: 'table' };
function resourceKindName(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  return RESOURCE_KIND[subn] || (CATEGORY_NAMES[subn] ? CATEGORY_NAMES[subn].toLowerCase() : '');
}
// A resource named by what it is called, with what it is under that.
// `js` replaces the plain jump, for a chip that should land somewhere in the
// resource rather than at its head (renderUsage's Referenced by).
function svChip(resid, note, js) {
  const lbl = labelFor(resid);
  let what = '';
  try { what = refDescription(resid) || ''; } catch (e) { what = ''; }
  const hex = '0x' + resid.toString(16).toUpperCase().padStart(4, '0');
  const kind = resourceKindName(resid);
  const main = lbl || (what && what !== hex ? what : hex);
  return relChip({ resid, main, sub: kind && kind !== main.toLowerCase() ? kind : '', note, title: trailForResid(resid), js });
}

/* The head of a script's page: what it is, in two lines above the one row of
   views, and what it is joined to, in #scriptRefs below the code.

   Until 22 September 2026 this was a five-part essay -- the id large, the
   subindex's purpose, a grid of facts, "How this was read" in five steps and
   "How to read the decoded view" -- and none of it was ever on a screen:
   the stylesheet said `#scriptView { display:none }` and this function set
   the inline display to '', which hands the element back to that rule. The
   stub-driven checks saw it built, since the stub reads no stylesheet. The
   purpose line repeated the gallery's own caption just above it, the steps
   described the loader rather than this resource, and the legend named
   mnemonics (push_byte, call_method) the listing does not print; so what
   came back is the part that says something about this one resource. */
function buildScriptView(o) {
  const host = document.getElementById('scriptView');
  if (!host) return;
  const { resid, subn, byteLength, readNote, resData } = o;
  const purpose = SUBINDEX_PURPOSE[subn];
  const lbl = labelFor(resid);
  const hex = '0x' + resid.toString(16).toUpperCase().padStart(4, '0');
  let shape = '';
  try { shape = dvmShapeSummary(resData, resid); } catch (e) { quiet(e); }
  let h = '<div class="sv-head"><span class="sv-id">' + hex + '</span>' +
          (lbl ? ' <span class="sv-lbl">' + svEsc(lbl) + '</span>' : '') +
          '<div class="sv-kind">' + [purpose ? purpose[0] : 'subindex ' + subn, shape,
            byteLength + ' bytes', readNote].filter(Boolean).map(svEsc).join(' · ') + '</div></div>';

  host.innerHTML = h;
  host.style.display = '';
  /* What the script belongs to and what names it -- the page-wide usage
     panel's rows, "Script of", "Rules on", "Referenced by" -- and what it
     names, all below the code rather than above it (the maintainer, 23
     September 2026): the code is what the page is for, and a helper named by
     a hundred scripts pushed it a screen down on a phone. updateUsagePanel
     leaves #artUsage empty for a script so the rows are not said twice. */
  const refs = document.getElementById('scriptRefs');
  if (!refs) return;
  let outs = [];
  try { outs = buildXrefIndex().outbound[resid] || []; } catch (e) { quiet(e); }
  const shown = outs.slice(0, 24);
  h = '';
  try { h = renderUsage(resid, subn); } catch (e) { quiet(e); }
  if (outs.length)
    // partsStrip escapes its note, so the "more" that opens the whole list
    // goes in as the last element of the strip.
    h += partsStrip('Names', shown.map(e => svChip(e.target, e.kind)).concat(outs.length > shown.length
      ? ['<span class="partsNote">and ' + countLink((outs.length - shown.length) + ' more', 'The ' + outs.length + ' things 0x' + resid.toString(16).toUpperCase() + ' names', outs.map(e => svChip(e.target, e.kind))) + '</span>'] : []));
  refs.innerHTML = linksFold(h);
  refs.style.display = '';
}

// --- Concept search --------------------------------------------------------
// Cross-references answer "who loads resource X", which is the right question
// only when one resource actually names another. It is not how Cythera links
// most behaviour together. Checked against this archive: all eight eating and
// potion effect scripts in subindex 9 have ZERO inbound references -- nothing
// anywhere holds their ids. Yet 0x0A06 plainly runs an effect ("You feel
// cooler.") and calls StatusEffect. The engine reaches these by method
// dispatch, not by id.
//
// So the link between an effect and the objects it belongs to is SEMANTIC, not
// structural: shared syscalls (StatusEffect), shared methods (TakeDamage,
// ResistDamage, Eat), shared fields (health), and shared words in the text the
// player sees. Searching the decoded scripts for that shared vocabulary is
// what answers questions of the form "under what circumstances can one take
// fire damage" -- the answer is the set of resources that talk about fire and
// about damage, which is something no reference graph will tell you.
DERIVED.SCRIPT_TEXT = null;

function buildScriptTextIndex() {
  if (DERIVED.SCRIPT_TEXT) return DERIVED.SCRIPT_TEXT;
  const map = [];
  if (ARCHIVE) {
    for (let subn = 0; subn < 256; subn++) {
      const mi = ARCHIVE.index[subn];
      if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
      const count = subindexCount(ARCHIVE, subn);
      for (let ri = 0; ri < count; ri++) {
        const resid = ((subn + 1) << 8) | ri;
        let raw;
        try { raw = getResourceBytes(ARCHIVE, resid); } catch (e) { raw = null; }
        if (!raw || !raw.length) continue;
        let text = '';
        try {
          const d = smartDecrypt(raw, resid).data;
          text = dvmRender(ARCHIVE, d, resid) || '';
        } catch (e) { continue; }
        if (text) map.push({ resid, subn, text });
      }
    }
  }
  return (DERIVED.SCRIPT_TEXT = map);
}

// A few starting points, because the useful queries are rarely one word and
// nobody should have to already know the engine's vocabulary to ask.
const SEARCH_PRESETS = {
  'Fire':     'fire|burn|flame|lava|scorch',
  'Poison':   'poison|venom|toxic|sick',
  'Damage':   'TakeDamage|ResistDamage|damage|wound|hurt',
  'Healing':  'heal|cure|restore|bandage|potion',
  'Status':   'StatusEffect|paralys|sleep|blind|confus',
  'Locks':    'Lockable|UseLock|PickLock|locked|key',
  'Eating':   'eat|food|hungry|nutrition|drink'
};

function searchPreset(name) {
  const box = document.getElementById('searchBox');
  box.value = SEARCH_PRESETS[name] || name;
  runSearch();
}

let _searchTimer = null;
function queueSearch() {
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(runSearch, 220);
}

/* ---------------------------------------------------------------------------
   Asking a question, answered from the tables the page already holds.

   The search finds text. A question is not a text search: "who teaches axe"
   is not a hunt for the word "axe", it is the training table filtered by
   skill, and the answer is a row rather than a list of hits. Nine shapes are
   recognised, each naming a table this page already builds on the spot and
   which column the question fixes. Anything that fits none of them falls
   through to the ordinary search, which is also where a recognised question
   goes if its subject is not in the file.

   No model is involved and none is needed: every one of these is a filter.
   The same shapes are what a model would have to be handed anyway, so this
   is the retrieval half built first and on its own.
--------------------------------------------------------------------------- */
const ASK_SHAPES = [
  { id: 'teaches', re: /^(?:who|where can i|where do i)\s+(?:can\s+)?(?:teach(?:es)?|learn|train(?:s|ed)?(?:\s+in)?)\s+(?:me\s+)?(.+?)\??$/i,
    what: 'who teaches a skill' },
  { id: 'sells',   re: /^(?:who\s+sells|where (?:can i (?:buy|get)|do i buy))\s+(?:an?\s+|the\s+)?(.+?)\??$/i,
    what: 'who sells a thing' },
  { id: 'cost',    re: /^(?:how much (?:is|does .* cost|for)|what does)\s+(?:an?\s+|the\s+)?(.+?)(?:\s+cost)?\??$/i,
    what: 'what a thing costs' },
  { id: 'does',    re: /^what does\s+(?:the\s+)?(.+?)\s+do\??$/i, what: 'what a spell or skill does' },
  { id: 'cures',   re: /^(?:what|how do i)\s+(?:cures?|cure|fix(?:es)?)\s+(.+?)\??$/i, what: 'what clears a status' },
  { id: 'says',    re: /^who says\s+["“']?(.+?)["”']?\??$/i, what: 'who says a line' },
  { id: 'resists', re: /^what (?:is|are)\s+(?:the\s+|an?\s+)?(.+?)\s+(?:immune to|resistant to|proof against)\??$/i,
    what: 'what a monster resists' },
  { id: 'where',   re: /^where (?:is|are|can i find)\s+(?:the\s+|an?\s+)?(.+?)\??$/i, what: 'where a thing or a person is' },
  { id: 'who',     re: /^who (?:is|was)\s+(?:the\s+)?(.+?)\??$/i, what: 'who somebody is' }
];
// One example a shape, shown under the search box so the shapes can be found.
const ASK_EXAMPLES = ['who teaches axe', 'who sells bread', 'how much is a sword', 'what does Fireball do',
  'what cures poison', 'who says Welcome', 'what is a ghost immune to', 'where is Alaric', 'who is Omen'];
function askNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function askRow(k, v) { return '<tr><td class="skillKey">' + k + '</td><td>' + v + '</td></tr>'; }
function askCard(title, note, rows, chips) {
  return '<section class="mechSec askCard"><div class="mechHead"><h3>' + svEsc(title) + '</h3></div>' +
    (note ? '<p class="mechLede">' + note + '</p>' : '') +
    (rows && rows.length ? '<div class="mechBody tableScroll"><table class="vocabTable barkTable mechTable"><tbody>' + rows.join('') + '</tbody></table></div>' : '') +
    (chips ? '<div class="partsStrip">' + chips + '</div>' : '') + '</section>';
}
function askCharacterChip(who, fallback) {
  try { if (who !== null && who !== undefined && loadCharacterTable()[who]) return characterChip(who); } catch (e) { quiet(e); }
  return fallback || '';
}
/* One question. Returns HTML, or null when the shape was not recognised or
   its subject is not in this archive -- in both cases the caller falls back
   to searching the text, which is the honest thing to do with a question
   this cannot answer. */
function answerQuestion(q) {
  // Several shapes can match one sentence -- "what does fireball do" reads as
  // both the price question and the what-does-it-do one -- so each is tried
  // in turn and the first that finds its subject in the file answers.
  for (const sh of ASK_SHAPES) {
    const hit = sh.re.exec(q.trim());
    if (!hit) continue;
    const out = askOneShape(sh, hit);
    if (out) return out;
  }
  return null;
}
function askOneShape(shape, hit) {
  const m = { sh: shape, hit };
  // Articles are not part of the name: "a lich", "the sword".
  const subject = askNorm(m.hit[1]).replace(/^(?:an?|the|some)\s+/, '');
  if (!subject) return null;
  const like = name => { const n = askNorm(name); return !!n && (n === subject || n.includes(subject) || subject.includes(n)); };
  try {
    if (m.sh.id === 'teaches') {
      const skills = skillCatalogue().filter(x => like(x.name) && x.kind !== 'command');
      if (!skills.length) return null;
      return skills.map(x => askCard('Who teaches ' + x.name,
        x.teachers.length ? 'Every script that teaches it.' : 'Nobody in this file teaches it.',
        x.teachers.map(t => askRow(t.mastery ? 'to mastery' : 'teaches',
          askCharacterChip(t.who, svChip(t.resid)))),
        partChip(x.name, x.resid))).join('');
    }
    if (m.sh.id === 'sells' || m.sh.id === 'cost') {
      const rows = [];
      for (const sp of shopRules().shops)
        for (const g of sp.goods)
          if (like(g.name)) rows.push(askRow(g.price + ' obols' + (g.count > 1 ? ' for ' + g.count : ''),
            askCharacterChip(sp.who, svChip(sp.resid)) + (sp.title ? ' <span class="inspDim">“' + svEsc(sp.title) + '”</span>' : '')));
      if (!rows.length) return null;
      return askCard(m.sh.id === 'cost' ? 'What ' + m.hit[1].trim() + ' costs' : 'Who sells ' + m.hit[1].trim(),
        'The listed price, before the vendor bargains.',
        rows, mechLink('shops', 'Mechanics › Shops'));
    }
    if (m.sh.id === 'does') {
      const sp = spellRules().spells.find(x => like(x.name));
      if (sp) {
        const fx = spellEffects().get(sp.resid);
        const rows = [askRow('level', String(sp.level)), askRow('costs', sp.cost + ' magic')];
        if (fx) {
          for (const d of fx.damage) rows.push(askRow('damage', '<b>' + (amountWords(d.amount) || 'an amount the script works out') + '</b> ' + (d.type !== null ? damageTypeName(d.type) : '') + ' to ' + d.who));
          for (const h of fx.heals) rows.push(askRow('heals', '<b>' + svEsc(h.text) + '</b>'));
        }
        return askCard(sp.name, svEsc(dvmDescriptionOf(sp.resid) || ''), rows, partChip(sp.name, sp.resid) + tabLink('SPELLS', 'Spells'));
      }
      const sk = skillCatalogue().find(x => like(x.name));
      if (sk) return askCard(sk.name, svEsc(sk.description || ''),
        [askRow('taught by', sk.teachers.map(t => askCharacterChip(t.who, svChip(t.resid))).join(' ') || '<span class="inspDim">nobody in this file</span>')]
          .concat(sk.askedBy.length ? [askRow('asked about by', sk.askedBy.map(r => svChip(r)).join(' '))] : [])
          .concat(sk.weapons.length ? [askRow('swung with it', sk.weapons.map(w => svEsc(w.name)).join(', '))] : []),
        partChip(sk.name, sk.resid));
      return null;
    }
    if (m.sh.id === 'cures') {
      const st = statusRules();
      const name = [...st.cures.keys()].find(like);
      if (!name) return null;
      const by = [...(st.cures.get(name) || [])];
      return askCard('What clears ' + name,
        'Every script that takes it off.',
        by.map(r => askRow(selfNameFor(r) || ('0x' + r.toString(16).toUpperCase()), svChip(r))),
        mechLink('status', 'Mechanics › Status Effects'));
    }
    if (m.sh.id === 'says') {
      const hits = buildBarkCatalogue().filter(b => b.words.concat(b.then || []).some(w => askNorm(w).includes(subject)));
      if (!hits.length) return null;
      return askCard('Who says “' + m.hit[1].trim() + '”', 'From the balloon lines in the scripts.',
        hits.slice(0, 12).map(b => askRow(b.words.filter(w => askNorm(w).includes(subject)).map(w => '“' + svEsc(w) + '”').join(', '),
          askCharacterChip(b.who, '<span class="inspDim">anyone, </span>' + svChip(b.resid)))),
        '<button class="navChip" onclick="showCategory(\'BARKS\')">Text › Barks</button>');
    }
    if (m.sh.id === 'resists') {
      const N = propNameTable();
      const ms = parseMonsterStats().filter(r => r.proptype && like(N[r.proptype] || ''));
      if (!ms.length) return null;
      return askCard('What ' + m.hit[1].trim() + ' resists', 'From the monster record’s flags, as the default resistance script reads them.',
        ms.slice(0, 6).map(r => askRow(N[r.proptype] || ('class ' + r.proptype),
          svEsc(monsterFlagsText(r.flags)) + ' <span class="inspDim">· armor ' + r.armor + ', ' + r.hp + ' health</span>')),
        mechLink('combat', 'Mechanics › Combat'));
    }
    if (m.sh.id === 'where' || m.sh.id === 'who') {
      const tab = loadCharacterTable();
      const idx = [];
      for (let i = 1; i < tab.length; i++) if (tab[i] && like(characterName(i))) idx.push(i);
      if (idx.length) return askCard(m.sh.id === 'who' ? 'Who ' + m.hit[1].trim() + ' is' : 'Where ' + m.hit[1].trim() + ' is',
        'From the character table.',
        idx.slice(0, 6).map(i => askRow(characterName(i),
          askCharacterChip(i, '') + ' <span class="inspDim">' + svEsc(zoneDisplayName(tab[i].zone)) + ' (' + tab[i].x + ',' + tab[i].y + '), level ' + tab[i].level + '</span>')), '');
      if (m.sh.id === 'where') {
        // A thing: the item classes with that name, and the maps they lie on.
        const N = propNameTable();
        const pts = Object.keys(N).map(Number).filter(pt => like(N[pt]));
        if (!pts.length) return null;
        const rows = [];
        for (const pt of pts.slice(0, 3)) {
          const where = [];
          for (let n = 0; n < 0x100 && where.length < 6; n++) {
            const mr = 0x8000 + n;
            let recs = null;
            try { const raw = getResourceBytes(ARCHIVE, mr + 0x100); if (raw) recs = parseDelverPropList(smartDecrypt(raw, mr + 0x100).data); } catch (e) { quiet(e); }
            if (!recs) continue;
            const hit = recs.find(r => r.proptype === pt && r.onMap && r.flags !== 0xFF && r.flags !== 0x42 && r.flags !== 0x44);
            if (hit) where.push('<button class="sv-chip" onclick="showSquareOnMap(' + mr + ',' + hit.x + ',' + hit.y + ')">' + svEsc(atlasMapName(mr)) + ' (' + hit.x + ',' + hit.y + ')</button>');
          }
          rows.push(askRow(N[pt], where.join(' ') || '<span class="inspDim">not lying anywhere; carried, or made by a script</span>'));
        }
        return askCard('Where ' + m.hit[1].trim() + ' is', 'The first few places one is lying on the ground.', rows, '');
      }
      return null;
    }
  } catch (e) { return null; }
  return null;
}
// The text search, when a question was answered but the reader wanted the
// hits after all.
function askSearchAnyway() { window.ASK_SKIP = true; runSearch(); window.ASK_SKIP = false; }
function runSearch() {
  const q = document.getElementById('searchBox').value.trim();
  const host = document.getElementById('searchResults');
  if (!host) return;
  if (q.length < 2) { host.innerHTML = ''; return; }
  // A 0x-prefixed id jumps straight to that resource. The prefix is required
  // on purpose: bare hex would swallow real searches, since "add" is both a
  // valid hex number and an opcode you would plausibly look for, as are
  // "dead", "beef", "face" and "ace".
  const hx = q.match(/^0x([0-9a-f]{1,4})$/i);
  if (hx) {
    const rid = parseInt(hx[1], 16);
    let exists = false;
    try { const r = getResourceBytes(ARCHIVE, rid); exists = !!(r && r.length); } catch (e) { quiet(e); }
    if (exists) {
      host.innerHTML = '<div class="sv-note">Opening resource 0x' +
        rid.toString(16).toUpperCase().padStart(4, '0') + '\u2026</div>';
      jumpToResource(rid);
      return;
    }
    host.innerHTML = '<div class="sv-warn">No resource 0x' +
      rid.toString(16).toUpperCase().padStart(4, '0') + ' in this file.</div>';
    return;
  }
  // A question first: nine shapes that name a table rather than a word to
  // look for. Anything else, and anything whose subject is not in the file,
  // falls through to searching the text.
  let answer = null;
  try { answer = window.ASK_SKIP ? null : answerQuestion(q); } catch (e) { answer = null; }
  if (answer) {
    host.innerHTML = '<div class="mechView askAnswer">' + answer +
      '<div class="sv-note">Read out of this file. ' +
      '<button class="linkbtn" onclick="askSearchAnyway()">Search the text for “' + svEsc(q) + '” instead</button></div></div>';
    return;
  }
  host.innerHTML = '<div class="sv-note">Decoding every script&hellip;</div>';
  // Yield once so the "decoding" note actually paints before the first,
  // slowest search blocks the thread building the index.
  setTimeout(() => {
    let re;
    // A query containing | or [ is taken as a pattern; anything else is
    // treated literally, so searching for "0x1A" or "()" does what you meant.
    try {
      re = /[|\[]/.test(q) ? new RegExp(q, 'i')
                           : new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    } catch (e) { host.innerHTML = '<div class="sv-warn">Not a valid pattern.</div>'; return; }
    const index = buildScriptTextIndex();
    // Names first: a prop type, a character, a zone, a tile or a resource
    // called what was typed. "desk" used to return six scripts and never the
    // desk, because only script text was searched.
    let things = '';
    try { things = namedThingsMatching(re); } catch (e) { things = ''; }
    const hits = [];
    for (const entry of index) {
      // Each hit keeps the offset of its line, read the way listingLineFor
      // reads the raw listing -- the object's base from its header, the line's
      // own from its gutter -- so the hit can open the script ringed there.
      const lines = entry.text.split('\n');
      const matched = [];
      let base = -1;
      for (const ln of lines) {
        const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(ln);
        if (h) base = parseInt(h[1], 16);
        const g = base >= 0 && /^  ([0-9A-F]{4})  /.exec(ln);
        // The index keeps delvmod's names and the listing shows the
        // program's (dvmShowSyscalls), so a line is found by either and
        // printed as it is shown.
        const shown = dvmShowSyscalls(ln, true);
        if (re.test(ln) || re.test(shown)) {
          matched.push({ text: shown.trim(), at: g ? base + parseInt(g[1], 16) : null });
          if (matched.length >= 3) break;
        }
      }
      if (matched.length) hits.push({ resid: entry.resid, subn: entry.subn, matched, count: matched.length });
    }
    if (!hits.length) {
      host.innerHTML = things + '<div class="sv-note">No script mentions that. Searched ' +
                       index.length + ' decoded resources.</div>';
      return;
    }
    let h = things + '<div class="sv-note">' + hits.length + ' of ' + index.length +
            ' decoded resources match.</div>';
    for (const hit of hits.slice(0, 60)) {
      const purpose = SUBINDEX_PURPOSE[hit.subn];
      h += '<div class="sr-item">' + svChip(hit.resid, purpose ? purpose[0] : '') +
           '<div class="sr-lines">' +
           hit.matched.map(m => {
             const l = svEsc(m.text.length > 160 ? m.text.slice(0, 160) + '\u2026' : m.text);
             return m.at === null ? '<div>' + l + '</div>'
               : '<div><a class="srLine" onclick="jumpToScriptAt(' + hit.resid + ',' + m.at + ')">' + l + '</a></div>';
           }).join('') +
           '</div></div>';
    }
    if (hits.length > 60) h += '<div class="sv-note">' + (hits.length - 60) + ' more not shown.</div>';
    host.innerHTML = h;
  }, 20);
}

// Everything with a name, matched against the search: prop types (the
// items and units among them), characters, zones, terrain tiles and the
// resources this tool labels. Rendered as chips ahead of the script hits.
function namedThingsMatching(re) {
  const groups = [];
  const cap = 24;
  const props = [];
  const tiles = getPropTileList();
  for (let pt = 1; pt < tiles.length && props.length < cap; pt++) {
    const nm = propDisplayName(pt);
    if (nm && re.test(nm)) props.push(actionChip(nm, (isInventoryItem(pt) ? 'showCategory(\'ITEMS\');showItemDetail(' : 'showCategory(\'PROPS\');showPropTypeDetail(') + pt + ')', 'prop type 0x' + pt.toString(16).toUpperCase()));
  }
  if (props.length) groups.push(['Prop types', props]);
  const chars = [];
  const table = loadCharacterTable();
  for (let i = 1; i < table.length && chars.length < cap; i++) {
    const nm = characterName(i);
    if (nm && re.test(nm)) chars.push(characterChip(i));
  }
  if (chars.length) groups.push(['Characters', chars]);
  const zones = [];
  for (let z = 0; z < 256 && zones.length < cap; z++) {
    if (!refExists(0x8000 + z)) continue;
    const nm = zoneDisplayName(z);
    if (nm && re.test(nm)) zones.push(partChip(nm, 0x8000 + z));
  }
  if (zones.length) groups.push(['Zones', zones]);
  const tl = [];
  const seenTile = new Set();
  for (let t = 0; t < 0x1000 && tl.length < cap; t++) {
    const nm = terrainNameFor(t);
    if (!nm || seenTile.has(nm) || !re.test(nm)) continue;
    seenTile.add(nm);
    tl.push(actionChip(nm, 'showSpriteZoom(' + t + ', ' + JSON.stringify(nm) + ')', 'tile 0x' + t.toString(16).toUpperCase()));
  }
  if (tl.length) groups.push(['Tiles', tl]);
  if (!groups.length) return '';
  return groups.map(([t, c]) => partsStrip(t, c)).join('') + '<div style="height:8px"></div>';
}

// --- Linked view -----------------------------------------------------------
// The disassembly is honest but unreadable as a description of behaviour:
// `call_resource 0x1806` tells you an address, not that the script is starting
// Hector's conversation. Every piece needed to say so is already loaded --
// labels, the character table, the cross-reference index -- it was just never
// joined up at the point where a reference is printed.
//
// This does NOT rewrite the code or invent structure. It annotates references
// that resolve to something real, and leaves everything it cannot prove
// exactly as the raw view shows it. Numeric constants stay numeric constants:
// a byte pushed before `sys PlaySound` is usually computed at runtime, so
// guessing a sound name for it would be fiction.
window.LAST_DECODED = null;

function refDescription(rid) {
  const subn = Math.floor(rid / 0x100) - 1;
  const lbl = labelFor(rid);
  const purpose = SUBINDEX_PURPOSE[subn];
  if (subn === 23 && lbl) return lbl + '\u2019s dialogue';
  if (subn === 25 && lbl) return 'the ' + lbl + ' spell';
  if (subn === 144 && lbl) return 'the ' + lbl + ' sound';
  if (subn === 127 || subn === 19) return lbl ? 'the ' + lbl + ' zone' : 'a zone';
  if (lbl) return lbl;
  // Unnamed library routines are the most-called things in the archive, and
  // how heavily they are shared says more than any name would.
  try {
    const ins = (buildXrefIndex().inbound[rid] || []).length;
    if (ins > 3) return (purpose ? purpose[0].toLowerCase() : 'routine') +
                        ', shared by ' + ins + ' resources';
  } catch (e) { quiet(e); }
  return purpose ? purpose[0].toLowerCase() : null;
}

function refExists(rid) {
  try { const r = getResourceBytes(ARCHIVE, rid); return !!(r && r.length); } catch (e) { return false; }
}

function refLink(rid) {
  const hex = '0x' + rid.toString(16).toUpperCase().padStart(4, '0');
  if (!refExists(rid)) return '<span class="refdead">' + hex + ' (no such resource)</span>';
  const d = refDescription(rid);
  return '<a class="reflink" onclick="jumpToResource(' + rid + ')">' + hex + '</a>' +
         (d ? '<span class="refnote"> \u2192 ' + svEsc(d) + '</span>' : '');
}

// Only hex in positions the disassembler guarantees is a resource reference is
// touched. Bare 0x#### elsewhere is a jump target or a byte offset, and those
// collide with real resource ids (a jump to 0x0301 is not resource 0x0301).
//
// The folded and structured listings spell a call as `CastSpell(...)` or
// `0x904(...)` -- the name or the id, never both -- so for those the names are
// learned from the raw listing of the same resource, where every call is
// `call_resource Name (0xNNNN)`, and only a name this resource is seen to call
// is linked. A bare `0xNNN(` is always a resource call in those two views:
// nothing else in them is printed as hex followed by a bracket.
function renderLinked(text, resid, raw) {
  let h = svEsc(text);
  if (raw) {
    const ids = new Map();
    for (const m of raw.matchAll(/\bcall_(?:resource|index) ([A-Za-z_]\w*) \(0x([0-9A-Fa-f]{1,4})\)/g))
      ids.set(m[1], parseInt(m[2], 16));
    // A call the raw listing leaves as an id and the folded one names
    // (dvmFoldResourceName), and the function that is the whole resource,
    // which is not a link to where the reader already is.
    for (const m of raw.matchAll(/\bcall_resource 0x([0-9A-Fa-f]{1,4})\b/g)) {
      const rid = parseInt(m[1], 16), nm = dvmFoldResourceName(rid);
      if (/^[A-Za-z_]\w*$/.test(nm)) ids.set(nm, rid);
    }
    ids.delete(dvmFoldResourceName(resid));
    h = h.replace(/(^|[^\w.])([A-Za-z_]\w*)(?=[\[(])/gm, (m, pre, nm) =>
      ids.has(nm) && refExists(ids.get(nm))
        ? pre + '<a class="reflink" title="' + svEsc(refTitle(ids.get(nm))) + '" onclick="jumpToResource(' + ids.get(nm) + ')">' + nm + '</a>'
        : m);
    h = h.replace(/(^|[^\w.])0x([0-9A-Fa-f]{3,4})(?=[\[(])/gm, (m, pre, hx) => {
      const rid = parseInt(hx, 16);
      return rid !== resid && refExists(rid)
        ? pre + '<a class="reflink" title="' + svEsc(refTitle(rid)) + '" onclick="jumpToResource(' + rid + ')">0x' + hx + '</a>'
        : m;
    });
    // A sound a line's comment names (dvmFoldNote) is a link to the sound.
    h = h.replace(/(sound \d+(?:: [^;<]*?)? \()0x(9[01][0-9A-F]{2})\)/g, (m, pre, hx) => {
      const rid = parseInt(hx, 16);
      return refExists(rid) ? pre + '<a class="reflink" onclick="jumpToResource(' + rid + ')">0x' + hx + '</a>)' : m;
    });
    return h;
  }
  h = h.replace(/\bcall_resource ([A-Za-z_]\w*) \(0x([0-9A-Fa-f]{1,4})\)/g,
    (m, nm, hx) => 'call_resource <b class="refname">' + nm + '</b> (' + refLink(parseInt(hx, 16)) + ')');
  h = h.replace(/\bcall_resource 0x([0-9A-Fa-f]{1,4})/g,
    (m, hx) => 'call_resource ' + refLink(parseInt(hx, 16)));
  h = h.replace(/\bref 0x([0-9A-Fa-f]{4}):0x([0-9A-Fa-f]{4})/g, (m, r, off) => {
    const rid = parseInt(r, 16);
    // Most refs point back into the same resource. Linking those to where you
    // already are, and captioning them with this resource's own category, was
    // pure noise -- they read as an offset instead.
    if (rid === resid) return '<span class="refself">+0x' + off + ' (here)</span>';
    return 'ref ' + refLink(rid) + ':0x' + off;
  });
  h = h.replace(/\bResource 0x([0-9A-Fa-f]{4})/g,
    (m, hx) => 'Resource ' + refLink(parseInt(hx, 16)));
  return h;
}
// What a link in the folded views says on hover, since those have no room
// for the note the raw listing prints after one.
function refTitle(rid) {
  const hex = '0x' + rid.toString(16).toUpperCase().padStart(4, '0');
  const d = refDescription(rid);
  return d ? hex + ', ' + d : hex;
}

/* Which of a script's views is showing: its words ('text'), its code
   ('code', in whichever listing SCRIPT_FOLD says) or its bytes ('hex').

   It holds from one script to the next until the reader changes it, which is
   the maintainer's rule of 23 September 2026: before that every resource
   chose afresh, so reading the Hex of one AI action and pressing Next showed
   the code of the next. There are two memories, not one, because a script
   under Text is read for its words and under Functions for its code
   (scriptPaneFor): a tap of Hex among the Functions is not a reason for a
   conversation to open on its bytes. A script with no words shows its code
   when Text is remembered, and the memory stays Text for the next one. */
window.SCRIPT_PANE_FOR = { code: 'code', text: 'text' };
window.SCRIPT_PANE = 'code';
function setScriptPane(p) {
  window.SCRIPT_PANE = p;
  const cat = document.getElementById('categorySelect');
  window.SCRIPT_PANE_FOR[scriptPaneFor(cat ? cat.value : '')] = p;
  paintDecodedPane();
}

function paintDecodedPane() {
  const pane = document.getElementById('textContent');
  const d = window.LAST_DECODED;
  /* A script has one row of views, `#listingSwitch`, directly above whichever
     is showing. Until 22 September 2026 it had three: the Decoded / Strings /
     Hex bar, a Linked / Raw code switch and the Raw / Folded / Structured
     switch -- and on the many scripts that open on their words, all three
     stood over no pane at all, the listing hidden behind a separate button.
     Linking is always on now, since it only annotates, and a script's
     readable strings are its Text; so the row is words, code three ways,
     bytes. Everything else keeps the tab bar. */
  const ls = document.getElementById('listingSwitch');
  const tabs = document.getElementById('viewTabs');
  const dlg = document.getElementById('dlgWrap');
  if (!pane || !d) return;
  if (!d.isScript) {
    if (ls) ls.style.display = 'none';
    pane.classList.remove('scriptCode');
    pane.textContent = d.text;
    return;
  }
  const hasText = !!(dlg && dlg.innerHTML);
  let which = window.SCRIPT_PANE;
  if (which === 'read') {
    // The Read view: the functions said as sentences (dvmReadRender), worked
    // out when first asked for and kept with the decode.
    if (d.read === undefined) { try { d.read = d.resData ? dvmReadRender(ARCHIVE, d.resData, d.resid) : null; } catch (e) { quiet(e, 'the Read view'); d.read = null; } }
    if (!d.read || !d.read.length) which = 'code';
  }
  if (which === 'text' && !hasText) which = 'code';
  const mode = window.SCRIPT_FOLD || 'raw';
  if (ls) ls.style.display = '';
  if (tabs) tabs.style.display = 'none';
  for (const [id, on] of [['listText', which === 'text'], ['listRaw', which === 'code' && mode === 'raw'],
                          ['listStructured', which === 'code' && mode !== 'raw'], ['listHex', which === 'hex'], ['listRead', which === 'read']]) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('active', on);
  }
  const t = document.getElementById('listText');
  if (t) t.style.display = hasText ? '' : 'none';
  if (dlg) dlg.style.display = which === 'text' ? '' : 'none';
  pane.style.display = which === 'code' || which === 'read' ? '' : 'none';
  const strs = document.getElementById('paneStrings');
  if (strs) strs.style.display = 'none';
  const hexPane = document.getElementById('paneHex');
  if (hexPane) hexPane.style.display = which === 'hex' ? '' : 'none';
  if (which === 'read') {
    pane.classList.remove('scriptCode');
    pane.classList.add('scriptRead');
    pane.innerHTML = readViewHtml(d.read);
    return;
  }
  pane.classList.remove('scriptRead');
  pane.classList.add('scriptCode');
  // A line ringed by jumpToScriptAt.
  const at = window.LISTING_AT && window.LISTING_AT.resid === d.resid ? window.LISTING_AT.at : null;
  const body = listingJumps(renderLinked(dvmShowSyscalls(d.text, mode === 'raw'), d.resid, mode === 'raw' ? null : d.raw), mode === 'raw',
                            mode === 'structured' ? d.exits : null);
  pane.innerHTML = at === null ? body : listingRing(body, d.text, at);
}

/* The Read view's HTML: each function's name and arguments, then its
   sentences as nested lists, each with the offset its statement has in the
   listings' gutter, so a "go to L0042" can be found and any line checked
   against the code. A prose object is said as what it holds. */
function readViewHtml(fns) {
  const hex4 = v => v.toString(16).toUpperCase().padStart(4, '0');
  // A prompt as the player types it and as the game stores it, as the
  // conversation view says it (convIntendedFor).
  const prompt = kw => kw === '*' ? 'When asked about anything else:' : 'When asked about ' + String(kw).split(',').map(k => {
    const w = typeof convIntendedFor === 'function' ? convIntendedFor(k) : [];
    return (w[0] || k).toUpperCase() + ' (' + k + ')';
  }).join(', ') + ':';
  const list = cl => '<ul class="readList">' + cl.map(c => '<li>' + (c.at !== null && c.at !== undefined ? '<span class="readAt">' + hex4(c.at) + '</span>' : '') +
    svEsc(c.prompt !== undefined ? prompt(c.prompt) : c.text.charAt(0).toUpperCase() + c.text.slice(1)) + (c.kids ? list(c.kids) : '') + '</li>').join('') + '</ul>';
  return fns.map(f => {
    if (f.prose !== undefined) return '<div class="readFn"><div class="readHead">' + svEsc(f.name) + '</div><div class="readProse">' + svEsc(f.prose) + '</div></div>';
    const head = '<div class="readHead">' + svEsc(f.name) + '(' + (f.args || []).join(', ') + ')</div>';
    if (f.answers && !f.clauses) return '<div class="readFn">' + head + '<div class="readProse">Answers ' + f.answers + ' prompt' + (f.answers === 1 ? '' : 's') +
      '; the Text view lays them out.</div></div>';
    const sum = f.summary ? '<div class="readSum">' + svEsc(f.summary.charAt(0).toUpperCase() + f.summary.slice(1)) + '.</div>' : '';
    return '<div class="readFn">' + head + sum + (f.bad ? '<div class="readProse">The page could not decode part of this; the Raw view shows it.</div>' : '') + list(f.clauses || []) + '</div>';
  }).join('');
}

/* A branch in a listing is a link to where it goes. In the structured and
   folded listings a target is a label, `goto L0042` or a switch's
   `-> L0015, L0019`, and the label's own line (`L0042:`) is left alone; in the
   raw one it is `then -> 0x0094`. Both are offsets into the resource, which is
   what the ring counts in (listingLineFor), so a tap rings the statement at
   the target and scrolls to it without leaving the page.

   A `break` or `continue` in the structured listing names no label, so where
   it goes comes from the renderer (`exits`, by the offset in its gutter) and
   the word itself is the link: a break rings the statement after its loop, a
   continue the place the loop goes round. */
function listingJumps(html, raw, exits) {
  const go = hx => '<a class="reflink" onclick="ringListingAt(' + parseInt(hx, 16) + ')">';
  if (raw) return html.replace(/(then -&gt; )0x([0-9A-F]{4})\b/g, (m, pre, hx) => pre + go(hx) + '0x' + hx + '</a>');
  html = html.replace(/\bL([0-9A-F]{4})\b(?!:)/g, (m, hx) => go(hx) + m + '</a>');
  if (exits && exits.size)
    html = html.replace(/^(    ([0-9A-F]{4}) .*?)\b(break|continue)$/gm, (m, pre, hx, word) => {
      const t = exits.get(parseInt(hx, 16));
      return t === undefined ? m : pre + go(t.toString(16)) + word + '</a>';
    });
  return html;
}
function ringListingAt(at) {
  const d = window.LAST_DECODED;
  if (!d) return;
  window.LISTING_AT = { resid: d.resid, at };
  paintDecodedPane();
  const hit = document.getElementById('listingHit');
  if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
}

/* ---- The tab tree ------------------------------------------------------
   Three levels, and the split at the top is the one that matters: Entities
   is what the game assembles -- a character, a creature, a place, a rule --
   and Components is what the archive stores to assemble them from -- text,
   pictures, sound, code. Data is the files themselves, fork by fork, and
   where an edit leaves the page. The old bar mixed the two kinds in one row
   ("Characters" beside "Graphics"), so a portrait and the person wearing it
   were siblings; here the person is a tab under Entities and the portrait a
   gallery under Components > Graphics, and a detail view can point from one
   to the other.

   A leaf names the galleries it holds by the <select>'s own values, which
   stays the single source of truth for what is open; the tabs only choose.
   A leaf with several galleries shows them as a chip row under the tabs. The
   values every gallery had before are all still here, so no deep link broke.

   `wip` fades a tab whose join to the rest is not traced yet -- nothing maps
   a sound to where it plays, nothing reads the PEF or the Combat AI files.
   They stay in the tree because the shape is worth seeing whole, and a faded
   tab still opens: Music and SFX are the raw galleries they always were.

   Icons are game tiles, one per tab, chosen by looking at the tiles rather
   than by their names (the "palette" is planks; the "statue" is a blob). The
   two fork pairs share the half disk on purpose -- 0x237 is the left half,
   0x238 the right -- because a fork is half of a file and the archive draws
   exactly that. Frame n of sheet 0x8Exx is tile ((0x8Exx & 0xFF) << 4) | n.

   Since 14 September 2026 a tab may also name the icon of the FILE it shows,
   which outranks its tile once the application is open: `finder` is a Finder
   type out of the application's bundle, `crsr` a colour cursor in its
   resource fork. The half-disk pair above still stands for Cythera Data's two
   forks; the application's two wear crsr 257 and 259, the maintainer's pick. */
const TAB_TREE = [
  // World is a leaf at the top level, like Tools: it is not a folder of
  // galleries but one view, the 256x256 world map with every way off it
  // live. It stands first because it is where a visit starts -- see the
  // World tab section for what it does and why it is not a gallery.
  { id: 'world', label: 'World', tile: 0x267, values: ['WORLD'] },   // the map of Cythera, the second of the two map tiles (the maintainer's pick, 9 September 2026)
  // The top row's three folders open when selected: chest, crate and book
  // each have a closed and an open frame, and `tileOpen` is the second.
  { id: 'entities', label: 'Scenario', tile: 0x285, tileOpen: 0x284, children: [      // the large chest. Scenario is Delver's own word for the game's content, the SCEN the editor writes; the label was Entities, then Game, on 9 September 2026
      /* The order is the maintainer's, 20 September 2026: the places first,
         then who is in them, then what is in them -- units, the things
         carried, every prop type, and the placed scenery assembled. */
      { id: 'regions',    label: 'Zones',      tile: 0x120, values: ['127'] },         // the encampment, the maintainer's pick, 9 September 2026
      { id: 'characters', label: 'Characters', tile: 0x719, values: ['CHARACTERS'] },  // the king, standing, facing the reader
      { id: 'units',      label: 'Units',      tile: 0x7D4, values: ['MONSTERS'] },    // the small polyp (sheet 0x8E7D)
      { id: 'items',      label: 'Items',      tile: 0x225, values: ['ITEMS'] },       // the LandKing amulet
      // Scenery is what is placed and is neither a unit nor carried, and the
      // composites are the same thing assembled: the editor's stamps and
      // brushes, and the composition table's pieces of terrain. They were
      // under Components > Graphics until 20 September 2026.
      { id: 'scenery',    label: 'Scenery',    tile: 0x321, values: ['SCENERY', 'COMPOSITE', 'RSRC'] },   // the rug (prop 15) at aspect 1, the maintainer's pick, 20 September 2026; it was the fountain (0x386), which Props wears now
      { id: 'skills',     label: 'Skills',     tile: 0x2D1, values: ['SKILLS'] },   // the rolling pin, the maintainer's pick, 17 September 2026; it was a distiller (0x3DB)
      { id: 'spells',     label: 'Spells',     tile: 0x888, values: ['SPELLS'] },   // a staff (prop 343), the maintainer's pick
      /* Mechanics is not a table: the rules the code implies, read out of the
         scripts on the spot (renderMechanicsSheet).

         It was one sheet of twenty-five folding sections under six headings
         until 14 September 2026, when the maintainer asked for a tab each and
         gave the order. The headings were already MECH_GROUPS, so a group
         became a tab rather than a new idea: the group carries the tab's
         value and tile beside its title, and renderMechanicsSheet shows one
         group at a time. Nothing about a section changed -- the ids are the
         link targets and are untouched, which is what lets mechLink keep
         working by looking up which tab a section is now on. */
      { id: 'mechanics',  label: 'Mechanics',  tile: 0x82F, children: [   // dice
          { id: 'mechprogress', label: 'Progress',     tile: 0x240, values: ['MECH_PROGRESS'] },   // the blue book, the maintainer's pick, 16 September 2026; it was a ladder (0x380)
          { id: 'mechstatus',   label: 'Status',       tile: 0x3CE, values: ['MECH_STATUS'] },     // a sundial, the maintainer's pick, 16 September 2026; it was the purple potion (0x22C)
          { id: 'mechinteract', label: 'Interactions', tile: 0x29D, values: ['MECH_INTERACT'] },   // a lockpick, the maintainer's pick, 16 September 2026; it was a trapdoor (0x3A0)
          { id: 'mechpuzzles',  label: 'Puzzles',      tile: 0x266, values: ['MECH_PUZZLES'] },    // the strange device, the maintainer's pick, 16 September 2026; it was a button (0x4FA)
          { id: 'mechcombat',   label: 'Combat',       tile: 0x21E, values: ['MECH_COMBAT'] },     // a full helmet, the maintainer's pick, 16 September 2026; it was an axe (0x203)
          { id: 'mecheconomy',  label: 'Economy',      tile: 0x82E, values: ['MECH_ECONOMY'] } ] },// a scale
      /* Hackery is the machinery under the scenario rather than a rule of
         play: how a record is laid out, what a use can be aimed at, what an
         egg does, what calls what, and the places the file does not add up.
         It was the seventh group on the Mechanics sheet.

         Cheats is its second value rather than a tab of its own (it was under
         Data > Cythera (App) until 14 September 2026). A leaf may carry
         several values and syncTabsTo draws a chip for each, which is how
         Misc holds three galleries -- so the tab is one tab with one icon,
         as asked, and the #c=CHEATS deep link still lands. */
      { id: 'hackery', label: 'Hackery', tile: 0x207, values: ['HACKERY', 'CHEATS'] } ] },   // the hatchet, the picture no class owns, the maintainer's pick, 16 September 2026; it was the strange device (0x266), which Puzzles wears now
  { id: 'components', label: 'Components', tile: 0x301, tileOpen: 0x300, children: [  // the crate
      { id: 'text', label: 'Text', tile: 0x4D5, children: [                                   // graffiti, the maintainer's pick, 16 September 2026; it was the tombstone's second frame (0x3AE)
          { id: 'labels',   label: 'Labels',   tile: 0x4B0, values: ['STRINGS'] },                          // a poster; the forks' string lists
          // The dialogue box's own frame tile, which is what the program's
          // FrameBox draws round every bordered window -- so the tab wears the
          // thing a conversation is actually presented in, rather than a
          // picture of somebody talking (the maintainer, 13 September 2026;
          // it was the beggar 0x66B, and the fountain 0x389 before that).
          { id: 'dialogue', label: 'Dialogue', tile: 0x19D, values: ['23', '7'] },
          // Writings is the game's OWN writing, which is subindex 1: the
          // bookshelf histories and bestiaries, the prophecies, the scrolls
          // and letters, the signs, the gravestones and the ring
          // inscriptions, each an array a prop indexes with its Data1. It
          // held the room scripts until 13 September 2026, which was simply
          // the wrong content under the right name (the maintainer); those
          // are scripts and have gone to Functions > Places beside the zone
          // entry scripts.
          { id: 'writings', label: 'Writings', tile: 0x260, values: ['1'] },                               // the maintainer's pick, 22 September 2026; it was the scroll (0x263)
          // The faces the text is set in: Argos A Nouveau and the Seldane
          // script, out of the resource fork, and the styles that assign them.
          { id: 'fonts',    label: 'Fonts',    tile: 0x264, values: ['FONTS'] },                              // the inkwell, the maintainer's pick, 27 September 2026; it was 0x180
          // The short lines a character says over their head, read out of
          // every script that sets one (buildBarkCatalogue).
          { id: 'barks',    label: 'Barks',    tile: 0x185, values: ['BARKS'] } ] },                          // the maintainer's pick, 8 September; it was the bell (0x488)
      // A schedule is something a character is MADE OF -- where they are at
      // each hour -- rather than a thing in the scenario of its own, so it
      // belongs here beside the other components a dossier chips into
      // (the maintainer, 13 September 2026). It was under Scenario.
      { id: 'schedules', label: 'Schedules', tile: 0x803, values: ['SCHEDULES'] },                           // the hourglass
      /* The tables a scenario is assembled from -- a unit's statistics, a
         character's record, the prop-tile table, every zone's prop list --
         are components in the same way a sprite sheet or a script is: the
         thing that holds the fact, where the fork is the file that holds
         the bytes. A figure on a Scenario page lands here on its own
         record and the record links on to the fork (the maintainer,
         20 September 2026). */
      { id: 'records', label: 'Records', tile: 0x265, values: ['RECORDS'] },                                 // the magic map, the maintainer's pick, 27 September 2026; it was the tome (0x227)
      { id: 'graphics', label: 'Graphics', tile: 0x861, children: [                           // the easel, with its painting
          { id: 'portraits',  label: 'Portraits',  tile: 0x33F, values: ['135'] },                      // the mirror
          { id: 'landscapes', label: 'Landscapes', tile: 0x890, values: ['131'] },                      // the landscape painting
          // Sprites by prop type are the same tiles viewed by what wears them:
          // the components of what Scenario > Scenery shows whole, which is
          // why they are here and not there (the maintainer, 20 September
          // 2026, after a day with a Props tab of its own).
          { id: 'tilesets',   label: 'Tilesets',   tile: 0x0D5, values: ['141', 'PROPS'] },    // the quartered blue floor
          // Misc is the archive's general graphics and, since 8 September
          // 2026, the whole screens in the resource fork beside them (the
          // title, the main menu and its parts, the DELVER stone, the paper
          // doll), which had a tab of their own until then.
          // 137 is the icons a skill or a spell wears, one 32x16 per class in
          // subindex 25. It was the one gallery in the archive that no tab
          // claimed (13 September 2026), so a chip pointing at a skill's icon
          // opened a gallery with no tab lit. It sits here rather than in a
          // leaf of its own because naming and tiling a new tab is the
          // maintainer's call; an Icons leaf beside Portraits is the
          // alternative if this reads wrongly.
          { id: 'misc',       label: 'Misc',       tile: 0x2F1, values: ['142', '137', 'SCREENS'] } ] },  // the urn, second frame
      { id: 'audio', label: 'Audio', tile: 0x215, children: [                                 // the strange rod
          { id: 'music', label: 'Music', tile: 0x2BD, values: ['143'] },                                // a lute
          { id: 'sfx',   label: 'SFX',   tile: 0x1B2, values: ['144', 'APPSND'] } ] },                  // the explosion, sheet 0x8E1B; the application's own sounds beside the file's
      { id: 'functions', label: 'Functions', tile: 0x3CB, children: [                         // a lever: pull it and something happens (prop 187)
          { id: 'actors',  label: 'Actions', tile: 0x572, values: ['47', '24', '3', '8', '25'] },   // the skill and spell classes (25) are here too, so a link to one has a tab                  // the fighter mid-swing: something that acts (prop 116)
          { id: 'objects', label: 'Objects', tile: 0x28B, values: ['16', '15'] },                             // a key: a thing that is used (prop 66)
          // The zone entry scripts, the sub-zone scripts, and the room
          // scripts that used to sit under Writings: 0x1Bxx and 0x1Cxx are
          // rooms 1 to 511 and 0x1Exx is room 800, all of them a place's own
          // script, which is what this tab is for.
          { id: 'places',  label: 'Places',  tile: 0x4A0, values: ['19', '20', '26', '27', '29'] },   // a signpost
          { id: 'effects', label: 'Effects', tile: 0x183, values: ['9'] },                              // the distiller's flasks: eating and potion effects (prop 233)
          { id: 'shared',  label: 'Shared',  tile: 0x3B8, values: ['0', '14', '2', '10', '11', '12', '13'] } ] } ] },// the well, the maintainer's pick, 9 September 2026
  // Data opens on Cythera Data (`last`), whatever comes first in the row:
  // the installer is first because it is where the rest came from, not the
  // thing most visits are for.
  { id: 'data', label: 'Data', tile: 0x262, tileOpen: 0x263, last: 'cytheradata', children: [   // paper, and paper written on when open: the maintainer's pick, 16 September 2026; it was the red book (0x242, 0x243)
      /* The Data tabs wear the icons of the files themselves where the file
         has one (the maintainer, 14 September 2026). `finder` is the Finder
         type whose icon the application's bundle carries, `crsr` a colour
         cursor id in its resource fork; the tile beside each stays as the
         fallback, because the row is drawn long before any application is
         open and most visits never open one.

         Two took their icons from the installer instead, on 16 September
         2026, because the Delver bundle has nothing for either: the Combat AI
         files are TEXT, which the bundle gives no icon at all -- the smoke
         pins that -- and the installer is a container rather than a Delver
         file type. Neither is a dead end once the installer is the thing
         asked: it is a Macintosh application with a VIS3 bundle of its own,
         and the folders inside it carry their own `Icon\r` files. */
      // The VISE mark, out of the installer's own bundle; the DELVER stone,
      // the engine's badge, is what stands there before a file is open.
      { id: 'installer', label: 'Installer', tile: 0x80F, installed: 'vise', values: ['INSTALLER'] },
      { id: 'cytheradata', label: 'Cythera Data', tile: 0x282, finder: 'DelS', children: [    // a sack
          // The tables as tables: the master index, the prop lists, the
          // 0xF0xx game data (monster stats among them) and the creation stats.
          { id: 'datafork', label: 'Data Fork',     tile: 0x237, values: ['DATAFORK', '128', '239', '4'] },
          { id: 'rsrcfork', label: 'Resource Fork', tile: 0x238, values: ['MACRSRC'] },
          { id: 'changes',  label: 'Changes',       tile: 0x2EE, values: ['CHANGES'] } ] },   // blacksmith's hammer
      { id: 'cythera', label: 'Cythera (App)', tile: 0x231, finder: 'APPL', children: [       // the lit torch
          { id: 'apppef',  label: 'Data Fork',     tile: 0x237, crsr: 257, wip: true, values: ['APPPEF'] },
          // The same fork read as what it is for: the menus, the dialogs and
          // windows, the cursors that are the game's verbs, the icons. The tab
          // that was Interface until 10 September 2026 is this one.
          //
          // Cheats was a third tab here until 14 September 2026 and is a value
          // of Hackery now, at the maintainer's word. It had to be removed
          // rather than merely added there: TAB_LEAF_FOR keeps the FIRST leaf
          // to claim a value, so leaving both would have bound CHEATS to
          // whichever came first in the tree and lit the wrong branch.
          { id: 'apprsrc', label: 'Resource Fork', tile: 0x238, crsr: 259, values: ['APPRSRC'] } ] },
      // The sheet of paper was chosen from 0xF004's name table rather than by
      // looking at a sheet of candidates, which is how every other icon here
      // was picked -- so it was the one to check on a screen. With the
      // application open the tab wears the Finder's own icon for a saved game
      // instead, and the tile is only what stands in before that.
      { id: 'savegame', label: 'Saved Game', tile: 0x263, finder: 'DelP', values: ['SAVEGAME'] },
      // The game's settings file, a tab of its own since 27 September 2026
      // (it was a section of Tools). Its type is `pref`, and the bundle has
      // no icon for that: the Finder drew its generic preferences icon out of
      // the System. It wore the scratch file's `Temp` icon for an hour, and
      // wears tile 0x1AC now, four round grey knobs, the maintainer's pick
      // (0xF004 names it "pyramid").
      { id: 'prefs', label: 'Preferences', tile: 0x1AC, values: ['PREFS'] },
      // Patches, a tab of their own since 27 September 2026 (they were
      // sections of Tools). A Magpie patch is a DelP file with Magpie's
      // creator, so Cythera's bundle has no icon for one: the icon is
      // Magpie's, its bundle's FREF for DelP, the Delver document frame with
      // a square patched into its corner. The tab wears it when the file open
      // is a patch rather than Cythera Data (openFileIsPatch), the
      // maintainer's rule, and the fishing pole otherwise (0x29A, the
      // maintainer's pick; it was the cloth). It is not ours to ship,
      // so it is there once a Magpie archive has been opened on this device
      // (magpieIcon, which remembers it).
      { id: 'patches', label: 'Patches', tile: 0x29A, magpie: 'DelP', values: ['PATCHES'] },
      // The folder's own icon, a folder with an axe across it, drawn in 1999
      // for these files and no others; the rolling pin stands in before a
      // file is open.
      { id: 'combatai', label: 'Combat AI', tile: 0x2D1, installed: 'CombatAI', wip: true, children: [
          { id: 'aiscripts', label: 'Scripts', tile: 0x8FC, wip: true, values: ['AISCRIPTS'] },  // the seven arrows, the maintainer's pick, 16 September 2026
          { id: 'airules',   label: 'Rules',   tile: 0x811, wip: true, values: ['AIRULES'] } ] } ] },  // the hay target
  // Not part of the archive: the page's own switches and its sister pages.
  { id: 'tools', label: 'Tools', tile: 0x2A9, tileOpen: 0x2AD, values: ['TOOLS'] }       // a wheelbarrow, another frame of it when selected: the maintainer's pick, 16 September 2026; it was the anvil (0x2E0)
];

// What the faded tabs with nothing behind them say when opened.
const PLACEHOLDER_TABS = {
  APPPEF: 'The program’s data fork is the PowerPC executable, a PEF container: its sections, ' +
    'this shows the shared libraries it uses and the routines it names once the program is open. ' +
    'The 68K CODE resources are in its resource fork, listed under Resource Fork.',
  AISCRIPTS: 'The Combat AI scripts come with the game as separate .ai text files, not inside ' +
    'the file. The game runs the compiled ' +
    'versions: subindex 3, AI Combat Scripts, under Components › Functions › Actions.',
  AIRULES: 'The rules for writing those scripts, the AI Scripting Document, ' +
    'come with the game as a separate text file, not inside the file.',
};

// Added to a placeholder when the file it describes would have come with the
// installer and the page was opened from something smaller.
const NO_INSTALLER_HINT = ' Open the game from its installer (Cythera.bin, under Settings) to see it here.';

// The Combat AI tabs are faded until the files they show are actually in the
// page, which is whenever the archive came in through the installer.
function syncInstallerTabs() {
  const on = !!window.INSTALLER;
  for (const id of ['combatai', 'aiscripts', 'airules']) {
    const n = TAB_BY_ID.get(id);
    // Rules has half its content -- the vocabulary -- in the application's
    // fork, so it is unfaded as soon as that fork is here from anywhere.
    if (n) n.wip = !(on || (id === 'airules' && window.APP_RSRC));
  }
  // The application's data fork is read (renderAppPefSheet) once it is here,
  // from the installer or with the fork.
  const pef = TAB_BY_ID.get('apppef');
  if (pef) pef.wip = !window.APP_DATA;
  // A bare Cythera Data file fills the rest of the site; what needs the
  // installer or the application's fork is faded until one is here.
  const inst = TAB_BY_ID.get('installer');
  if (inst) inst.wip = !on;
  /* `cheats` left this list on 14 September 2026 with the tab itself. It is a
     value of Hackery now, and Hackery must NOT fade: its other five sections
     are read off the archive and stand up with no application open, where the
     Cheats view's figures are the program's. Fading the tab would grey out
     five readings that work. The id is simply gone, rather than repointed. */
  for (const id of ['apprsrc', 'interface']) { const n = TAB_BY_ID.get(id); if (n) n.wip = !window.APP_RSRC; }
}

// Every node learns its parent and depth, and every category value learns
// which leaf holds it. A value in two leaves would make the tabs ambiguous,
// so the first wins and the tree is written not to do that.
const TAB_BY_ID = new Map();
const TAB_LEAF_FOR = new Map();
(function indexTabTree(nodes, parent) {
  for (const n of nodes) {
    n.parent = parent;
    n.depth = parent ? parent.depth + 1 : 1;
    TAB_BY_ID.set(n.id, n);
    if (n.children) indexTabTree(n.children, n);
    else for (const v of (n.values || [])) if (!TAB_LEAF_FOR.has(v)) TAB_LEAF_FOR.set(v, n);
  }
})(TAB_TREE, null);

// "Components › Text › Labels" -- where a category lives, for the
// Data Fork table and for status text.
function tabTrail(node) {
  const parts = [];
  for (let n = node; n; n = n.parent) parts.unshift(n.label);
  return parts.join(' › ');
}

// `spec` is either {tile} -- an exact tile id -- or {icon} -- a prop type,
// whose fullest early frame is used.
/* The application's own art for a tab: the Finder icon its bundle gives a file
   type, or a colour cursor out of its resource fork. Null until the
   application is open, which is most of the time -- the tab row is drawn at
   startup and the fork arrives later, if at all -- so every caller falls back
   to the game tile named beside it. loadApplicationFork calls syncTabsTo once
   APP_RSRC is set, and that is what redraws the row with the real icons.

   Both go through rsrcArtifacts rather than the decoders directly, so a tab
   icon and the same resource in the fork gallery can never disagree. */
function navIconFromFork(spec) {
  if (!spec || typeof spec !== 'object') return null;
  // The installer's own icons come from the installer, which is open before
  // the application's fork is and sometimes instead of it.
  if (spec.installed) { try { const a = installerIcon(spec.installed); if (a) return a; } catch (e) { quiet(e); } }
  // Magpie's, remembered from a Magpie archive opened here, with or without
  // the application, and only while the file open is a patch.
  if (spec.magpie && openFileIsPatch()) { try { const a = magpieIcon(spec.magpie); if (a) return a; } catch (e) { quiet(e); } }
  if (!window.APP_RSRC) return null;
  try {
    if (spec.finder) return finderIconFor(spec.finder);
    if (spec.crsr !== undefined) {
      const fork = window.APP_RSRC;
      const e = (fork.resourcesByType['crsr'] || []).find(x => x.id === spec.crsr);
      if (!e) return null;
      const pic = rsrcArtifacts(fork, 'crsr', e).find(a => a.canvas && a.canvas.width);
      return pic ? pic.canvas : null;
    }
  } catch (e) { quiet(e); }
  return null;
}

function navIconCanvas(spec, px) {
  const c = document.createElement('canvas');
  try {
    const art = navIconFromFork(spec);
    if (art && art.width) {
      c.width = art.width; c.height = art.height;
      const g = c.getContext('2d');
      if (g) g.drawImage(art, 0, 0);
      c.style.cssText = 'width:' + px + 'px;height:' + px + 'px;image-rendering:pixelated;display:block;margin:0 auto';
      return c;
    }
    let tile = null;
    if (typeof spec === 'object' && spec && spec.tile !== undefined) tile = spec.tile;
    else {
      const proptype = (typeof spec === 'object' && spec) ? spec.icon : spec;
      const base = getPropTileList()[proptype];
      if (base === undefined) return c;
      // Pick the frame with the most artwork in it, so an icon is never a blank
      // or half-drawn pose.
      const info = spriteFrameInfo(0, proptype);
      let best = info.present[0] || 0, bestN = -1;
      for (const f of info.present.slice(0, 4)) {
        let n = 0;
        try { const img = resolveTileImage(base + f); if (img) for (const v of img) if (v) n++; } catch (e) { quiet(e); }
        if (n > bestN) { bestN = n; best = f; }
      }
      tile = base + best;
    }
    if (tile !== null) drawTileToCanvas(c, tile, 32);
  } catch (e) { quiet(e); }
  c.style.cssText = 'width:' + px + 'px;height:' + px + 'px;image-rendering:pixelated;display:block;margin:0 auto';
  return c;
}

function optionLabel(v) {
  const sel = document.getElementById('categorySelect');
  for (const o of sel.options) if (o.value === v) return o.textContent;
  return v;
}

function renderTabRow(row, nodes, selectedId) {
  if (!row) return;
  row.innerHTML = '';
  // The fade at the right edge while the row has more past it; see
  // scrollHintWatch. Measured once the tabs are in, at the foot.
  const watched = () => { try { scrollHintWatch(row); } catch (e) { quiet(e); } };
  for (const n of nodes) {
    const b = document.createElement('button');
    b.className = 'ftab' + (n.id === selectedId ? ' sel' : '') + (n.wip ? ' wip' : '');
    b.id = 'tab_' + n.id;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', n.id === selectedId ? 'true' : 'false');
    if (n.wip) b.title = 'Not yet linked to the rest; shows the raw view where there is one';
    // The whole icon spec, not just the tile: a Data tab may name the file
    // type or the cursor its picture comes from, with the tile as the
    // fallback for before the application is open.
    b.appendChild(navIconCanvas({ tile: (n.id === selectedId && n.tileOpen) ? n.tileOpen : n.tile, finder: n.finder, crsr: n.crsr, installed: n.installed, magpie: n.magpie }, 18));
    const t = document.createElement('span');
    t.textContent = n.label;
    b.appendChild(t);
    if (n.id === 'changes') {
      const k = document.createElement('span');
      k.className = 'tabBadge';
      k.id = 'changesBadge';
      b.appendChild(k);
    }
    // The release that is open, on the Installer tab, so it is never a
    // question which of several the page is showing.
    if (n.id === 'installer' && installerVersion()) {
      const k = document.createElement('span');
      k.className = 'tabBadge';
      k.id = 'installerVersionBadge';
      k.textContent = installerVersion();
      b.appendChild(k);
    }
    b.onclick = () => selectTab(n.id);
    row.appendChild(b);
  }
  watched();
}

// "1.0.4", from the name of the installer that is open; '' without one.
function installerVersion() {
  const inst = window.INSTALLER;
  const name = inst && (inst.picked || (inst.container && inst.container.name)) || '';
  const m = /\d+(?:\.\d+)+/.exec(name);
  return m ? m[0] : '';
}

// The count on the Changes tab, when that row is showing.
function refreshChangesBadge() {
  const k = document.getElementById('changesBadge');
  if (!k) return;
  const n = (window.EDITED_RESIDS && window.EDITED_RESIDS.size) || 0;
  k.textContent = n ? String(n) : '';
  k.style.display = n ? '' : 'none';
}

function buildTabShell() {
  const shell = document.getElementById('tabShell');
  if (!shell) return;
  syncTabsTo(document.getElementById('categorySelect').value);
}

// Draw the rows and the chip row for the leaf that holds `v`, without
// changing what is open. pickCategory is this plus the change; parseArchiveBytes
// is this alone, because it renders the gallery itself a moment later and the
// gallery is the expensive part.
function syncTabsTo(v) {
  const shell = document.getElementById('tabShell');
  if (!shell) return;
  const leaf = TAB_LEAF_FOR.get(v);
  const path = [];
  for (let n = leaf; n; n = n.parent) path.unshift(n);
  // Each branch remembers the tab it was on, so coming back to Components
  // lands where you left it rather than on Text every time.
  for (let i = 0; i + 1 < path.length; i++) path[i].last = path[i + 1].id;
  if (leaf) leaf.lastValue = v;
  shell.setAttribute('data-depth', String(path.length));
  renderTabRow(document.getElementById('tabRow1'), TAB_TREE, path[0] && path[0].id);
  renderTabRow(document.getElementById('tabRow2'), (path[0] && path[0].children) || [], path[1] && path[1].id);
  renderTabRow(document.getElementById('tabRow3'), (path[1] && path[1].children) || [], path[2] && path[2].id);
  refreshChangesBadge();
  const sel = document.getElementById('categorySelect');
  const have = new Set(Array.from(sel.options).map(o => o.value));
  const vals = leaf ? leaf.values.filter(x => have.has(x)) : [];
  const sub = document.getElementById('navSub');
  if (sub) {
    /* A chip says the section's name and, smaller, its id range; the whole
       label is its title. "Character Action Scripts (0x30xx)" put five chips
       one to a line on a phone; the word Scripts says nothing where every
       section is scripts, and the range is for the reader who wants it
       (the maintainer, 23 September 2026). */
    const chipLabel = x => {
      const full = optionLabel(x);
      const m = /^(.*?)\s*\((0x[0-9A-Fa-f]+x*)\)\s*$/.exec(full);
      const name = (m ? m[1] : full).replace(/\s+Scripts?$/, '') || full;
      return svEsc(name) + (m ? '<span class="navHex">' + svEsc(m[2]) + '</span>' : '');
    };
    sub.innerHTML = vals.length > 1 ? vals.map(x =>
      '<button class="navChip' + (x === v ? ' active' : '') + '" data-v="' + x +
      '" title="' + svEsc(optionLabel(x)) + '" onclick="pickCategory(\'' + x + '\')">' + chipLabel(x) + '</button>').join('') : '';
  }
  // One line under the sections saying what the open one holds.
  const note = document.getElementById('navSubNote');
  if (note) {
    const purpose = vals.length > 1 && SUBINDEX_PURPOSE[+v] ? SUBINDEX_PURPOSE[+v][1] : '';
    note.textContent = purpose ? purpose.replace(/\s*--\s*/g, ', ') : '';
    note.style.display = purpose ? '' : 'none';
  }
}

// A tab was clicked. A branch opens on the tab it was last on, or its first;
// a leaf opens on the gallery it was last on, or its first.
function selectTab(id) {
  let node = TAB_BY_ID.get(id);
  if (!node) return;
  while (node.children) node = (node.last && TAB_BY_ID.get(node.last)) || node.children[0];
  const sel = document.getElementById('categorySelect');
  const have = new Set(Array.from(sel.options).map(o => o.value));
  const vals = node.values.filter(x => have.has(x));
  const v = vals.indexOf(node.lastValue) >= 0 ? node.lastValue : vals[0];
  if (v !== undefined) pickCategory(v);
}

function pickCategory(v) {
  const sel = document.getElementById('categorySelect');
  sel.value = v;
  syncTabsTo(v);
  const searchWrap = document.getElementById('searchWrap');
  if (searchWrap) searchWrap.style.display = 'none';
  onCategoryChange();
}

// The script search is not a tab -- it looks across every gallery -- so it
// opens over whatever is showing and closes back to it.
function openSearch() {
  const w = document.getElementById('searchWrap');
  if (!w) return;
  w.style.display = 'block';
  const box = document.getElementById('searchBox');
  if (box) box.focus();
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
/* A count in a sentence that opens the things it counted, when no search
   query finds exactly them ("127 characters have alignment 0"). The caller
   hands over the chips, one per thing; the link opens the search panel on
   that list, titled with the sentence's own words. Kept by title and size,
   so a sheet drawn again reuses its entry rather than adding one. */
window.COUNT_LISTS = window.COUNT_LISTS || [];
function countLink(label, title, chips) {
  if (!chips || !chips.length) return svEsc(label);
  let id = COUNT_LISTS.findIndex(c => c.title === title && c.chips.length === chips.length);
  if (id < 0) id = COUNT_LISTS.push({ title, chips }) - 1;
  else COUNT_LISTS[id].chips = chips;
  return svLink(label, 'showCountList(' + id + ')');
}
// One chip per resource, named as the rest of the site names it.
function resChips(resids) {
  return [...resids].sort((a, b) => a - b).map(r => relChip({ resid: r, main: labelFor(r) || selfNameFor(r) || ('0x' + r.toString(16).toUpperCase()), title: trailForResid(r) }));
}
function showCountList(id) {
  const c = COUNT_LISTS[id];
  if (!c) return;
  setTimeout(() => {
    closeTopPanels();
    openSearch();
    const box = document.getElementById('searchBox');
    if (box) box.value = '';
    const host = document.getElementById('searchResults');
    if (host) host.innerHTML = '<div class="sv-note">' + svEsc(c.title) + '</div><div class="partsStrip">' + c.chips.join('') + '</div>';
    try { window.scrollTo(0, 0); } catch (e) { quiet(e); }
  }, 0);
}
function closeSearch() {
  const w = document.getElementById('searchWrap');
  if (w) w.style.display = 'none';
}
