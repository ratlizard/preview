/* The archive's names and labels, the sound decoder and the undither switch.

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
   last of these. File 1 of 14. */

/* THE PAGE'S OWN TABLES LIVE ON THE ARCHIVE. Everything the page derives
   from the open file -- the schedules, the character table, the barks, the
   item index, the zone names, the map's tile canvases and paths, forty-odd
   tables in all -- used to be `window.NAME` memos and module-level Maps,
   cleared by name in resetDerivedCaches() when another file opened. That
   list missed ten entries at once on 16 September 2026 and could miss more.
   Since 19 September they live on the archive object js/delv-archive.js
   returns, under its `derived` map, the way the delv tier's own tables do:
   `DERIVED.SCHEDULES` reads and writes the open archive's entry and is
   undefined with no file open, and a Map declared as derivedMap('name') is
   the open archive's Map, so opening another file leaves nothing behind
   and nothing needs listing. Both are defined here, in the first page file,
   because the Maps are declared at load time in the files that follow.
   ARCHIVE itself is declared here as well, and not in js/page-archive.js
   where it is assigned: a `let` cannot be reached until its declaration
   has run, and a table set to null at load by a file before that one --
   which the harnesses, running the scripts as one string, report as
   "cannot access ARCHIVE before initialization" -- has to find it already
   declared. What stays in resetDerivedCaches is state, not tables: where
   the visitor stands, what they edited, which fork is shown. */
let ARCHIVE = null;   // the open file, { bytes, index, derived } from openDelverArchive; null until one is open
const DERIVED = new Proxy({}, {
  get: (_, k) => ARCHIVE ? ARCHIVE.derived.get('page:' + k) : undefined,
  set: (_, k, v) => { if (ARCHIVE) ARCHIVE.derived.set('page:' + k, v); return true; },
  has: (_, k) => !!(ARCHIVE && ARCHIVE.derived.has('page:' + k)),
  deleteProperty: (_, k) => { if (ARCHIVE) ARCHIVE.derived.delete('page:' + k); return true; },
});
function derivedMap(name) {
  const none = new Map();   // with no file open: a Map that belongs to nothing
  const m = () => ARCHIVE ? derivedTable(ARCHIVE, 'page:' + name, () => new Map()) : none;
  return {
    get: k => m().get(k), set(k, v) { m().set(k, v); return this; }, has: k => m().has(k), delete: k => m().delete(k),
    clear: () => m().clear(), get size() { return m().size; }, keys: () => m().keys(), values: () => m().values(),
    entries: () => m().entries(), forEach: (f, t) => m().forEach(f, t), [Symbol.iterator]: () => m()[Symbol.iterator](),
  };
}

let currentMode = 'sheet';
let currentResid = null;
let lastSheetScrollY = 0;
let currentObjectUrl = null;
function prettyLabel(s) { return String(s).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2'); }

// Portraits are named by 0x0201 alone. A table of delvmod's character
// symbols stood behind the names switch until 23 September 2026, when the
// three entries left in it (UrSylph, which 0x0201 already says, and
// WishingFountain and DegreeHallDoor, where 0x0201 says Fountain and Door)
// went with the other names the files do not give (the maintainer's call).
// Landscape strips (subindex 131, 0x84nn) carry no built-in names since
// 22 September 2026: the community's list was guesses with question marks,
// and each strip's cell now says which zones and rooms set it
// (landscapeSetters), which is the file's own answer.
// Skill icon names used to be 49 hardcoded strings transcribed by hand -- and
// transcribed from buggy decoder output, which is why the list contained
// "DirectedNexus" and "Acertainment". They are read from the archive now:
// skill icon n is skill class 0x1A00|n, and a skill class names itself in its
// first string object. Hardcoding removed; nothing to keep in sync.
function skillNameForIcon(n) { return selfNameFor(0x1A00 | n); }
// Character names live in resource 0x0201 as a Delver string table:
//   u16 header  (high nibble 9, low 12 bits = slot count)
//   count x { u16 tag, u16 offset }   offsets point at NUL-terminated strings
// Reading them from the archive means a modified or translated Cythera
// labels itself correctly instead of inheriting our hardcoded list.
window.DERIVED_NAMES = null;
/* The last table any archive gave us, kept ACROSS a swap and deliberately not
   dropped by resetDerivedCaches. A saved game holds no 0x0201 at all -- it is
   a thin file: the character records, one zone's props, one portrait, the
   combat AI and the persistence store -- so a save opened on its own can only
   call its people "Character 12". A character index means the same person in
   every Cythera file, so the names from the scenario opened earlier in the
   session are the right answer and the Saved Game sheet says where they came
   from. This is two string tables carried over, not two archives open at
   once (see **The delv-* files are not a library**): nothing here decodes
   from the scenario, it only reads back words it already had. */
window.SCENARIO_NAMES = null;
window.SCENARIO_ZONE_NAMES = null;
function loadDerivedNames() {
  window.DERIVED_NAMES = null;
  try {
    const raw = getResourceBytes(ARCHIVE, 0x0201);
    if (!raw) return;
    const { data } = smartDecrypt(raw, 0x0201);
    const t = parseDelverStringTable(data);
    if (t && t.length > 16) window.SCENARIO_NAMES = window.DERIVED_NAMES = t;
  } catch (e) { /* fall back to the built-in table */ }
  // A scenario's full stomach is kept for a saved game opened after it.
  try { if (getResourceBytes(ARCHIVE, 0x0A00)) fullStomach(); } catch (e) { /* no potion scripts */ }
}
// The names the open file gives, or the last file that gave any. `borrowed`
// says which, so a sheet can admit it.
function nameTable() { return window.DERIVED_NAMES || window.SCENARIO_NAMES || null; }
function namesAreBorrowed() { return !window.DERIVED_NAMES && !!window.SCENARIO_NAMES; }
function derivedCharacterName(n) {
  const t = window.DERIVED_NAMES;
  if (!t) return null;
  const v = t[n + 1];
  if (!v) return null;
  const s = v.trim();
  if (!s || s === '???' || s === 'x') return null;
  return s;
}

// Dialogue resources are keyed by CHARACTER INDEX: 0x18nn is the conversation
// script for character nn. Verified against the archive rather than assumed --
// 0x1801 (index 1, Hero) is the talking-to-yourself joke, 0x184F is index 79
// Charax and opens "You see a nervous, unkempt, young man", 0x1861 is index 97
// Aethon and mentions lockpicks, 0x187F is index 127 UrSylph. Before this,
// every one of the 121 dialogue resources showed with no label at all.
function dialogueSpeakerFor(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  if (subn !== 23) return null;
  const nm = DVM_SYM.character[resid & 0xFF];
  return nm ? prettyLabel(nm) : null;
}

// Skill and spell classes name themselves: the first string object in the
// resource is the name the game shows, and the second is its description.
// Read out of the archive rather than guessed, but cached, since it costs a
// decode and a container walk per resource.
DERIVED.SELF_NAMES = null;
function selfNameFor(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  if (subn !== 25) return null;
  if (!DERIVED.SELF_NAMES) DERIVED.SELF_NAMES = {};
  if (resid in DERIVED.SELF_NAMES) return DERIVED.SELF_NAMES[resid];
  let name = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (raw) {
      const d = smartDecrypt(raw, resid).data;
      const strs = dvmStringObjects(ARCHIVE, d, resid);
      for (const e of strs) {
        let t = e.str.replace(/[\s\u0000-\u001f]+$/, '');
        if (t.length < 2 || t.length > 34) continue;
        if (/[.!?]$/.test(t) || t.split(/\s+/).length > 4) continue;
        // Known, unfixed decoder bug: an implicit string sometimes gains a
        // spurious leading capital ("DVision of the Night", "DMinor
        // Embrightenment"). Dropped HERE ONLY, for display, when a capital is
        // immediately followed by another capital starting a real word. This
        // is cosmetic and does not touch the decoder.
        t = t.replace(/^([A-Z])(?=[A-Z][a-z]{2})/, '');
        name = t;
        break;
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.SELF_NAMES[resid] = name);
}

function labelForResource(subn, n, resid) {
  if (subn === 23) return dialogueSpeakerFor(resid);
  if (subn === 25) return selfNameFor(resid);
  if (subn === 135) {
    const d = derivedCharacterName(n);
    if (d) return d;
  }
  if (subn === 137) { const sk = skillNameForIcon(n); if (sk) return sk; }
  return null;
}

/* The resource forks, read by kind rather than by type code.

   Cythera Data's fork holds 113 resources of 18 types and the program's
   339 of 52, and a flat gallery of type codes says nothing about what any of
   them is for. This table does: each kind names the four-letter types that
   make it up, says in a sentence what they are (from looking at every one of
   them, September 2026), and says where else on the site the kind is shown.
   Both fork galleries group by it, and the views in FORK_VIEWS below are the
   same renderer filtered to one or two kinds, which is how a screen or a
   font or a cursor gets a place under Components without a second decoder.
   A type in no kind falls under "Other". */
const RSRC_KINDS = [
  { id: 'screens', label: 'Screens', types: ['PICT'],
    note: 'Whole pictures: the title screen, the main menu and its parts, the DELVER stone, two night title scenes and the paper doll. The program adds the two Ambrosia logos.',
    view: 'SCREENS' },
  { id: 'fonts', label: 'Fonts', types: ['sfnt', 'NFNT', 'FOND', 'TxSt'],
    note: 'The game’s fonts: Argos A Nouveau, the Seldane script at two sizes, and the text styles that say which font each kind of text uses.',
    view: 'FONTS' },
  { id: 'strings', label: 'Strings', types: ['STR#', 'STR ', 'TEXT', 'styl'],
    note: 'Lists of text. In Cythera Data: the default conversation keywords, the credits and the editor’s lists. In the program: the equipment slots, combat buttons, strategies, help balloons and the combat AI vocabulary.',
    view: 'STRINGS' },
  { id: 'sounds', label: 'Sounds', types: ['snd '],
    note: 'Sounds from the program: get, use, look, talk and attack. The game’s other sounds and its music are under Audio.',
    view: 'APPSND' },
  { id: 'icons', label: 'Finder and command icons', types: ['ICN#', 'icl4', 'icl8', 'ics#', 'ics4', 'ics8', 'cicn', 'BNDL', 'FREF'],
    note: 'The Finder icons for the program, the data file, a saved game and a patch, and the command icons: move, take, look, talk and attack.',
    view: null },
  { id: 'cursors', label: 'Cursors', types: ['crsr', 'CURS', 'acur'],
    note: 'The pointer in every state: the walking directions, the hand, the eye, the speech bubble, the sword, the magnifier, the pointing finger and the spinning ball.',
    view: null },
  { id: 'menus', label: 'Menus', types: ['MENU', 'MBAR', 'xmnu', 'CMNU', 'mctb', 'MDEF'],
    note: 'Every menu the game can show, with its keyboard shortcuts, and the two menu bars.',
    view: null },
  { id: 'dialogs', label: 'Dialogs and windows', types: ['DLOG', 'DITL', 'ALRT', 'WIND', 'CNTL', 'dctb', 'actb', 'nrct', 'CDEF', 'WDEF', 'LDEF', 'ppat', 'pltt', 'clut'],
    note: 'The dialog boxes, alerts, windows and controls, with their colors, backdrop patterns and palettes.',
    view: null },
  { id: 'editor', label: 'Editor', types: ['eSTM', 'eBRS', 'MSta', 'FILT', 'LINF', 'DATA', 'PORT', 'RMAP', 'TMPL'],
    note: 'What the map editor kept in the data file: stamps and brushes (under Composites), three saved game states (MSta), its tile names, the color cycles and the ResEdit templates. The displacement filters (FILT) belong to the game and have their own cards. The game reads none of the rest, so these are guesses: MSta holds quest states (Plague Cured is quest value 2 at 10), DATA 260 is an earlier list of tile names, DATA 261 is the color-cycling ramps, and PORT 0 and 1 have no structure this page could find.',
    view: 'RSRC' },
  { id: 'engine', label: 'Engine', types: ['Lite', 'Page', 'TILE', 'Audt', 'Pref', 'MemU', 'Delv', 'vers', 'SIZE', 'cfrg', 'CODE'],
    note: 'What the program reads about itself: the light cones, the Delver engine’s help pages, the preference defaults, the version records and the program’s code. How much memory it asks for is in SIZE.',
    view: null }
];
const RSRC_KIND_OF = new Map();
for (const k of RSRC_KINDS) for (const t of k.types) RSRC_KIND_OF.set(t, k);
// A category value that is a fork gallery filtered to some kinds. `source`
// is which fork: the data file's, the program's, or both, one after the
// other. The application's fork is fetched on first use, as for APPRSRC.
const FORK_VIEWS = {
  SCREENS:   { source: 'both', kinds: ['screens'] },
  FONTS:     { source: 'both', kinds: ['fonts'] },
  STRINGS:   { source: 'both', kinds: ['strings'] },
  APPSND:    { source: 'app',  kinds: ['sounds'] },
  // The application's icons, cursors, menus and dialogs had views of their
  // own under an Interface tab until 10 September 2026; they are kinds in
  // the application's Resource Fork gallery, which showed them as well, so
  // the tab was the same thing twice.
};

const CATEGORY_NAMES = { 0:"Global Symbols & Scripts", 1:"Text & Names", 135:"Character Portraits", 137:"Skill & Spell Icons", 141:"Tile Graphics", 131:"Landscape Graphics", 142:"General Graphics", 144:"Sounds", 127:"Maps", 128:"Prop Lists", 239:"Game Data Tables",
  143:"Music (QTMA)", 2:"Global Store", 3:"AI Combat Scripts", 4:"Archetypes", 7:"Generic Group Dialogue", 8:"Combat AI Tests & Actions", 9:"Eating & Potion Effects", 10:"Stub Script", 14:"Character Helpers", 11:"Task Helpers", 12:"Party & Inventory Helpers", 13:"Rule Helpers", 15:"Object Interaction Text", 16:"Object Scripts", 19:"Zone Entry Scripts", 20:"Sub-zone Scripts", 23:"Character Dialogue", 24:"Monster Class Scripts", 25:"Skill & Spell Classes", 26:"Room Scripts A", 27:"Room Scripts B", 29:"Room Scripts C", 47:"Character Action Scripts"
};
/* Pictures, sounds and tile sheets carry no names in the files, and the
   typed labels they had -- the wiki's and the community's, behind the names
   switch -- went on 23 September 2026 at the maintainer's word, after they
   were checked (GRIMOIRE-NOTES.md, *The typed names, checked*): the gavel's
   sound was "Arrow Hits", the dice's "Fire (?)", and sheet 0 "Grass" where
   its tiles are grass, swamp, shrub, bush and water. What names them now is
   the game's own words: a tile sheet by 0xF004's names for its sixteen
   tiles, a picture by the names of the things whose scripts open it
   (buildScriptedWindows). A sound keeps its number; its page says what plays
   it. */
function tileSheetWords(n) {
  const seen = [];
  for (let i = 0; i < 16; i++) { const w = terrainNameFor(n * 16 + i); if (w && seen.indexOf(w) < 0) seen.push(w); }
  return seen.length ? seen.slice(0, 4).join(', ') + (seen.length > 4 ? ', \u2026' : '') : null;
}
function pictureWords(resid) {
  let users = null;
  try { users = buildScriptedWindows().byPicture.get(resid); } catch (e) { quiet(e); }
  if (!users || !users.size) return null;
  const seen = [];
  for (const r of [...users].sort((a, b) => a - b)) {
    const w = r >= 0x1000 && r < 0x1200 ? propTypeName(r - 0x1000) : null;
    if (w && seen.indexOf(w) < 0) seen.push(w);
  }
  return seen.length ? seen.slice(0, 3).join(', ') + (seen.length > 3 ? ', \u2026' : '') : null;
}

const RESHINTS = {
  0x0101:"Global Symbol List", 0x0201:"Character Names", 0x0203:"Character Class Names",
  0x0204:"Character Class Descriptions", 0x0205:"Character Class Stats", 0x0206:"Character Class Skills",
  0x0218:"Sign Text", 0x0219:"Scroll Text", 0x021A:"To Do Text", 0x021B:"Book Item Text",
  0x021D:"Bookshelf Text", 0x021F:"Ring Inscriptions", 0x0220:"Gravestone Inscriptions",
  0x0241:"Death Text", 0x0242:"Defeat Text", 0x0243:"Victory Text",
  // Nothing for 0x80xx/0x81xx/0x14xx belongs here: the zone loop below fills
  // all three ranges. Two stale entries used to sit at this spot, labelling
  // 0x8102 a landscape and 0x1402 a portrait. Both were wrong about their own
  // subindex -- 0x81xx is subindex 128 (prop lists) and 0x14xx is subindex 19
  // (zone-entry scripts), while landscapes are 0x84xx and portraits 0x88xx --
  // and both were overwritten a few lines later, so they were inert as well.
  0xF008:"Monster Statistics", 0xF000:"Prop-Tile Associations", 0xF004:"Tile Names",
  0xF002:"Tile Attributes", 0xF016:"Displacement Filter Table", 0xF013:"Composed Tiles", 0xF009:"Characters", 0xF00B:"Schedules",
  0xF00C:"Zoneports", 0xF010:"Faux Prop Information", 0xF011:"Prop-aspect X offsets",
  0xF012:"Prop-aspect Y offsets", 0xF015:"Persistence Store Symbols"
};
// Zone names are the map's entry script's (loadZoneNames) and the editor's
// list in the resource fork (loadEditorZoneNames). The community's
// descriptive names for eighteen maps stood here behind the names switch
// until 23 September 2026 and went with the other typed names; one of them,
// "Goat Farm", is the map the editor calls "Flax Farm".
// Distinguish a name we read out of the archive from one supplied by our own
// built-in tables, so a hardcoded guess is never mistaken for game data.
// Zone names are not a lookup table anywhere -- they are string literals
// inside each zone-entry script (subindex 19, 0x14xx), emitted by opcode 0x44
// (`pushc`) as a NUL-terminated C string. Map 0x80nn pairs with script
// 0x14nn, and the prop list 0x81nn with the same nn. This gives the game's own
// names ("Land King Hall", "Kosha Grotto", "Omen's Test") instead of the
// hand-annotated guesses we were shipping.
DERIVED.ZONE_NAMES = null;
/* A second set of names, the editor's, from the resource fork: STR# 135 in
   Cythera Data lists every zone in map order, one entry per map from map 1
   -- entry 0 is the world, map 1; map 0, the editor's blank "Map", has none.
   Where the entry script's string is the name the player is shown, this is
   the name the map was made under, and for the seventeen maps whose script
   says only "Ruins", "Tomb", "Temple", "Cove", "Caves", "Stronghold" it is
   the specific one: "Headwater Ruins", "Tyrant's Tomb", "Scylla Temple",
   "Crab Cove", "Eioneus Cave", "Tavara Fortress". Spellings are the
   file's -- "North Short Vinyard", "Inner Broutherhood Dungeon" [sic] --
   and stay so. The alignment was checked entry by entry against the script
   names (LKH / Land King Hall, Catamarca Springs / the underground under
   Catamarca, Cademia Sewers / Sewers, and so on down the list).

   The script name still leads where there is one; the editor's name is shown
   beside it when it differs. */
DERIVED.EDITOR_ZONE_NAMES = null;
function loadEditorZoneNames() {
  if (DERIVED.EDITOR_ZONE_NAMES) return DERIVED.EDITOR_ZONE_NAMES;
  const names = {};
  const list = forkStringList(window.CYTHERA_RSRC, 135);
  if (list) list.forEach((nm, i) => { if (nm) names[i + 1] = nm; });
  return (DERIVED.EDITOR_ZONE_NAMES = names);
}
// The combat AI's scripted tests and actions, named by the program's own
// lists: STR# 9307 has the six tests in the order of 0x901-0x906 and STR# 9308
// the thirteen actions in the order of 0x981-0x98D (workbench
// doc/save-format.md has the reading; the scripts match the names one for one
// -- 0x905 walks equipment for reach and ammunition, and the list calls it
// UsingRangedWeapon(@,#)). The entries are the file's, signature and all.
// Null without the application's fork, when the static table in
// js/delv-script.js is all a script gets.
DERIVED.AI_HOOK_NAMES = null;
function aiHookName(resid) {
  const t = resid >= 0x901 && resid <= 0x906 ? ['tests', 9307, resid - 0x901]
          : resid >= 0x981 && resid <= 0x98D ? ['actions', 9308, resid - 0x981] : null;
  if (!t || !window.APP_RSRC) return null;
  if (!DERIVED.AI_HOOK_NAMES) DERIVED.AI_HOOK_NAMES = { tests: forkStringList(window.APP_RSRC, 9307) || [], actions: forkStringList(window.APP_RSRC, 9308) || [] };
  return DERIVED.AI_HOOK_NAMES[t[0]][t[2]] || null;
}
function editorZoneName(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  if (subn !== 127 && subn !== 128 && subn !== 19) return null;
  return loadEditorZoneNames()[resid % 0x100] || null;
}
// " (Tyrant's Tomb in the editor's list)" after a map's label, when the
// editor named it something else; nothing when the two agree or there is
// no fork.
function editorNameSuffix(resid, shown) {
  const ez = editorZoneName(resid);
  if (!ez || (shown && shown.toLowerCase() === ez.toLowerCase())) return '';
  return ' (' + ez + ' in the editor’s list)';
}
// Zoneports (wiki: Zoneport page) are indices into 0xF00C. Each entry is
// 4 bytes: map ID (uint8) then an xy24 position. A map header's four exit
// fields are zoneport indices, so they resolve to a real destination.
// Validated against Selax's hand-made list: 07 -> Abandoned Farmhouse,
// 08 -> Cellar, 0B -> Catamarca, 02/05/06/0A -> the world map.
DERIVED.ZONEPORTS = null;
function loadZoneports() {
  if (DERIVED.ZONEPORTS) return DERIVED.ZONEPORTS;
  const out = [];
  try {
    const b = getResourceBytes(ARCHIVE, 0xF00C);
    if (b) for (let i = 0; i + 4 <= b.length; i += 4) {
      const xy = (b[i+1] << 16) | u16be(b, i+2);
      out.push({ map: 0x8000 | b[i], x: xy >> 12, y: xy & 0xFFF });
    }
  } catch (e) { quiet(e); }
  return (DERIVED.ZONEPORTS = out);
}
function zoneportInfo(idx) {
  const z = loadZoneports()[idx];
  if (!z || (!idx && !z.map)) return null;
  return { idx, resid: z.map, x: z.x, y: z.y,
           name: (labelFor(z.map) || ('0x' + z.map.toString(16).toUpperCase())) };
}

function loadZoneNames() {
  if (DERIVED.ZONE_NAMES) return DERIVED.ZONE_NAMES;
  const names = {};
  for (let n = 0; n < 0x100; n++) {
    const resid = 0x1400 | n;
    let raw;
    try { raw = getResourceBytes(ARCHIVE, resid); } catch (e) { raw = null; }
    if (!raw) continue;
    let data;
    try { data = smartDecrypt(raw, resid).data; } catch (e) { continue; }
    for (let i = 0; i < data.length - 2; i++) {
      if (data[i] !== 0x44) continue;
      let j = i + 1, str = '';
      while (j < data.length && data[j] >= 0x20 && data[j] < 0x7F && str.length < 40) {
        str += String.fromCharCode(data[j]); j++;
      }
      if (data[j] === 0x00 && str.length >= 2) { names[n] = str; break; }
    }
  }
  if (Object.keys(names).length) window.SCENARIO_ZONE_NAMES = names;
  return (DERIVED.ZONE_NAMES = names);
}
// The same borrowing for the zone names: a save's zone byte is the low byte
// of a map resource id, and the map itself is in the scenario rather than in
// the save, so without this every zone reads "zone 3 (unnamed)".
function zoneNameTable() {
  const own = loadZoneNames();
  return Object.keys(own).length ? own : (window.SCENARIO_ZONE_NAMES || own);
}
function zoneNameFor(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  if (subn !== 127 && subn !== 128) return null;
  return loadZoneNames()[resid % 0x100] || null;
}

function labelSource(resid) {
  const subn = Math.floor(resid / 0x100) - 1;
  const n = resid % 0x100;
  // Only claim 'data' where the name really was read out of the archive.
  // An earlier version also consulted terrainNameFor() here. Tile names are
  // not resource names: feeding a resource id to that table just lands on
  // whichever terrain run happens to cover the number, and reported every
  // label as archive data -- the opposite of what this flag is for.
  if (subn === 135 && derivedCharacterName(n)) return 'data';
  // A skill's own name string comes out of the resource itself, so it is data.
  // A dialogue speaker is matched from this tool's character table, so it is
  // not -- it stays flagged with the dagger.
  if (subn === 25 && selfNameFor(resid)) return 'data';
  if (zoneNameFor(resid)) return 'data';
  if (editorZoneName(resid)) return 'data';
  return labelFor(resid) ? 'builtin' : null;
}
function applyLabel(el, resid) {
  const txt = labelFor(resid);
  el.textContent = txt || 'none';
  el.classList.toggle('placeholder', !txt);
  // Still recorded in the tooltip -- just not in the colour of the text.
  if (txt && labelSource(resid) === 'builtin')
    el.title = 'Name supplied by this page, not found in the file';
  else if (txt && editorNameSuffix(resid, txt))
    el.title = editorNameSuffix(resid, txt).replace(/^ \(|\)$/g, '');
  else el.removeAttribute('title');
  return txt;
}

// Names arrive with junk on the front, and the junk turns out to be readable.
// The skill name that displays as "DVision of the Night" is really the bytes
// 8B 44 "Vision of the Night": 0x8B is `return`, and 0x44 is `pushc` -- which
// happens to be ASCII 'D'. The implicit-string decoder is starting two bytes
// early and the opcode is being rendered as a letter.
//
// So: strip any leading non-printable bytes, and if there were any, also strip
// a leading 'D' before a capital, because in that position it is the pushc
// opcode rather than a letter. Cosmetic and display-only -- the decoder is
// untouched and the Strings and Hex tabs still show the raw bytes.
function normalizeLabel(s) {
  if (typeof s !== 'string') return s;
  const hadControl = /^[^\x20-\x7E]/.test(s);
  let t = s.replace(/^[^\x20-\x7E]+/, '');
  if (hadControl) t = t.replace(/^D(?=[A-Z])/, '');
  return t.trim() || null;
}

function labelFor(resid) { return normalizeLabel(labelForUnnormalized(resid)); }

// Any resource mentioned by id in a detail sheet is one click from its own
// detail view: the id IS the link. The href doubles as the page's bare deep
// link (#8E88), so middle-click and copy-link behave.
function residLink(resid, text) {
  const hex = resid.toString(16).toUpperCase();
  return '<a class="ridLink" href="#' + hex + '" onclick="jumpToResource(' + resid +
    ');return false">' + (text || '0x' + hex) + '</a>';
}

// Names this tool supplies rather than reads. Since 23 September 2026 that is
// RESHINTS alone, the descriptions of the data tables; the wiki's and the
// community's labels for sounds, pictures, tile sheets, zones, portraits,
// prop types and dialogue groups went at the maintainer's word. They used to be indistinguishable from the file's own strings except
// for a dagger nobody reads. They were off by default until 6 September
// 2026 and are on by default since (the maintainer's call: one name per
// place); switched from the archive menu, and with them off the gallery
// shows only what the file actually says. Generic numbering ("Sound 12") is not an override and stays.
window.SHOW_BUILTIN_LABELS = true;   // on by default since 6 September 2026 (the maintainer's call)
try {
  const st = localStorage.getItem('cythera.builtinLabels');
  if (st !== null) window.SHOW_BUILTIN_LABELS = st === '1';
} catch (e) { quiet(e); }
/* The default for the switch follows where the file came from (10 September
   2026): a file the visitor supplied -- dropped, picked, or remembered from
   one of those -- starts with the names off, since it may not be the shipped
   game; the installer fetched for them starts with them on. A choice made
   with the checkbox is kept in localStorage and wins over either. */
window.ARCHIVE_OWN = false;
function applyNamesDefault(own) {
  window.ARCHIVE_OWN = !!own;
  let stored = null;
  try { stored = localStorage.getItem('cythera.builtinLabels'); } catch (e) { stored = null; }
  if (stored !== null) return;
  window.SHOW_BUILTIN_LABELS = !own;
  try { DERIVED.ATLAS_SCENE = null; belowScenes.clear(); } catch (e) { quiet(e); }
}
function setBuiltinLabels(on) {
  window.SHOW_BUILTIN_LABELS = !!on;
  try { localStorage.setItem('cythera.builtinLabels', on ? '1' : '0'); } catch (e) { quiet(e); }
  // The atlas names its places once, when the scene is built.
  try { DERIVED.ATLAS_SCENE = null; belowScenes.clear(); } catch (e) { quiet(e); }
  if (ARCHIVE) {
    try { onCategoryChange(); } catch (e) { quiet(e); }
  }
}

function labelForUnnormalized(resid) {
  const zn = zoneNameFor(resid);
  if (zn) return zn;
  // A map whose entry script names nothing still has the editor's name.
  const ez = editorZoneName(resid);
  if (ez) return ez;
  // The archive names many of its own resources; prefer that over our tables.
  // They are code identifiers -- "LKH_Guard", "Od_Trough1" -- so the
  // underscores become spaces for display. The symbol itself is untouched.
  try { const sy = resourceSymbol(resid); if (sy) return sy.replace(/_/g, ' '); } catch (e) { quiet(e); }
  // The AI vocabulary out of the application's lists, and the helpers read
  // off their bytecode (dvmScriptName in js/delv-script.js).
  try { const sn = dvmScriptName(resid); if (sn) return sn; } catch (e) { quiet(e); }
  const subn = Math.floor(resid / 0x100) - 1;
  const n = resid % 0x100;
  if (window.SHOW_BUILTIN_LABELS && RESHINTS[resid]) return RESHINTS[resid];
  const structural = labelForResource(subn, n, resid);
  if (structural) return structural;
  // 0x8EFF is IN the tile-sheet subindex but is not a tile sheet: it is the
  // sized 194x127 tombstone slab (see tileSheetIsSized). Say so where it is
  // listed, so nobody reads it as sixteen tiles.
  if (resid === 0x8EFF) return 'Tombstone Slab, a sized image, not a tile sheet';
  if (subn === 141) { const w = tileSheetWords(n); return 'Tile Sheet ' + n + (w ? ': ' + w : ''); }
  if (subn === 142) { const w = pictureWords(resid); return 'General Graphic ' + n + (w ? ': ' + w : ''); }
  if (subn === 144) return 'Sound ' + n;
  return null;
}

const SOUND_CATEGORIES = new Set([144]);

function decodeSound(resData) {
  let p = 0;
  const magic = fourcc(resData, 0); p += 4;
  if (magic !== 'asnd') throw new Error("Bad magic: expected 'asnd', got '" + magic + "'");
  const duration = u32be(resData, p); p+=4;
  const rate = u16be(resData, p); p+=2;
  const flags = u16be(resData, p); p+=2;
  const nsamples = Math.floor((resData.length - p)/2);
  const samples = new Int16Array(nsamples);
  // A word a sample, but only its low byte carries signal: measured over the
  // shipped sounds, the high byte is always 00 or FF and 99.6% of the values
  // are within -127..127. So the word is an 8-bit sample sign-extended, and
  // shifting it up by eight is the gain that makes it a 16-bit one.
  for (let i=0;i<nsamples;i++) {
    const v = i16be(resData, p); p+=2;
    samples[i] = v << 8;
  }
  return {rate: rate || 22050, samples};
}

// The shared writer in js/mac-media.js produces the bytes; this keeps the
// Blob shape the sound preview and the WAV download already expect.
function samplesToWavBlob(rate, samples) {
  return new Blob([wavFromInt16(samples, rate)], { type: 'audio/wav' });
}
const samplesToWav = (rate, samples) => wavFromInt16(samples, rate);

let currentWavBlob = null, currentSoundResid = null;

function drawWaveform(samples) {
  const canvas = document.getElementById('waveform'), ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, mid = h / 2;
  ctx.fillStyle = '#090806'; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#786c43'; ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
  ctx.strokeStyle = '#f9f86f'; ctx.beginPath();
  const step = Math.max(1, Math.ceil(samples.length / w));
  for (let x=0; x<w; x++) {
    let lo=32767, hi=-32768;
    for (let i=x*step; i<Math.min(samples.length,(x+1)*step); i++) { const v=samples[i]; if(v<lo)lo=v; if(v>hi)hi=v; }
    const y1 = mid - (hi / 32768) * (mid - 4), y2 = mid - (lo / 32768) * (mid - 4);
    ctx.moveTo(x,y1); ctx.lineTo(x,y2);
  }
  ctx.stroke();
}

function renderSound() {
  const out = document.getElementById('output');
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid, roff, rlen] = window.CUR_RESIDS[idx];
  try {
    const resData = ARCHIVE.bytes.slice(roff, roff+rlen);
    const {rate, samples} = decodeSound(resData);
    currentWavBlob = samplesToWavBlob(rate, samples);
    currentSoundResid = resid;
    drawWaveform(samples);
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    const url = currentObjectUrl = URL.createObjectURL(currentWavBlob);
    const audio = document.getElementById('audioPlayer');
    audio.src = url;
    document.getElementById('soundPreview').style.display = 'block';
    const lbl = labelFor(resid);
    const durSec = (samples.length/rate).toFixed(2);
    document.getElementById('soundLabel').textContent =
      '0x' + resid.toString(16).toUpperCase() + (lbl ? ' - ' + lbl : '') + '  |  ' + rate + ' Hz, ' + durSec + 's';
    updateUsagePanel(resid, window.CUR_SUBN);
    out.textContent = "Decoded sound 0x" + resid.toString(16).toUpperCase() + " (" + rate + " Hz, " + durSec + "s)";
  } catch(err) {
    document.getElementById('soundPreview').style.display = 'none';
    out.textContent = "Sound decode error: " + err.message;
  }
}

function downloadCurrentWAV() {
  if (!currentWavBlob) return;
  // dlBlob (js/mac-export.js) is the one save path both pages use: it attaches
  // the anchor before clicking it, which Firefox and iOS Safari require, and
  // revokes the object URL later rather than in the same tick, which cancels
  // the download in Firefox. This used to do neither.
  dlBlob(currentWavBlob, 'cythera_0x' + currentSoundResid.toString(16).toUpperCase() + '.wav');
}

// --- undither toggle --------------------------------------------------
// This used to hand the resource to a separate page over postMessage and
// sessionStorage. The tuning is settled, so the work happens here now and the
// hand-off is gone; cythera_graphics_undither.html is still where the settings
// can be explored, but nothing depends on it.
const UNDITHER_SUBN = new Set([131, 135, 137, 141, 142]);   // landscape, portrait, icon, tiles, sized

// The switch is global and lives under Tools. What a gallery or a single
// view offers is a PREVIEW the other way -- "preview undithered" while the
// switch is off, "preview dithered" while it is on -- which lasts until the
// category changes. One switch, one override, and the label always says
// which way the preview goes.
window.UNDITHER_PREVIEW = null;           // null = as the switch says; true/false = this view only
function unditherOn() {
  return window.UNDITHER_PREVIEW === null ? !!window.UNDITHER : !!window.UNDITHER_PREVIEW;
}
function setUndither(on) {
  window.UNDITHER = !!on;
  window.UNDITHER_PREVIEW = null;
  cancelUndither();                       // abandon anything still queued
  refreshUnditherControls();
  // Palette cycling redraws the canvas several times a second, which would
  // queue a fresh reconstruction on every frame. The two cannot both run.
  if (unditherOn() && typeof stopPaletteAnimation === 'function') stopPaletteAnimation();
  redrawCurrentView();
}
function setUnditherPreview(on) {
  window.UNDITHER_PREVIEW = on ? !window.UNDITHER : null;
  cancelUndither();
  refreshUnditherControls();
  try { updateGalleryTools(); } catch (e) { quiet(e); }
  if (unditherOn() && typeof stopPaletteAnimation === 'function') stopPaletteAnimation();
  redrawCurrentView();
}
function toggleUnditherPreview() { setUnditherPreview(window.UNDITHER_PREVIEW === null); }
function setUnditherScope(v) {
  window.UNDITHER_ALL = v === 'all';
  setUndither(v !== 'off');
}
function refreshUnditherControls() {
  try {
    const want = !window.UNDITHER ? 'off' : window.UNDITHER_ALL ? 'all' : 'portraits';
    for (const r of document.querySelectorAll('input[name="unditherScope"]')) r.checked = r.value === want;
  } catch (e) { quiet(e); }
}

// Called from both setMode and onCategoryChange: whichever of them runs last
// has the final say, and they set CUR_SUBN in different orders.
function updateUnditherBar() { refreshUnditherControls(); }

function redrawCurrentView() {
  if (currentMode === 'single') { if (typeof renderImage === 'function') renderImage(); }
  else if (typeof onCategoryChange === 'function') onCategoryChange();
}

function loadCompositionTable() {
  const data = getResourceBytes(ARCHIVE, 0xF013);
  if (!data) return [];
  const entries = [];
  let p = 0;
  while (p + 32 <= data.length) {
    const words = [];
    for (let i=0;i<16;i++) { words.push(u16be(data, p)); p+=2; }
    entries.push(words.map(parseCompositionWord));
  }
  return entries;
}

const tileSheetCache = {};
function getTileSheetImage(resid) {
  if (tileSheetCache[resid] !== undefined) return tileSheetCache[resid];
  const data = getResourceBytes(ARCHIVE, resid);
  if (!data) { tileSheetCache[resid] = null; return null; }
  try {
    const decoded = decodeResource(ARCHIVE, data, 141, resid);
    tileSheetCache[resid] = decoded;
    return decoded;
  } catch(e) { tileSheetCache[resid] = null; return null; }
}

function extractSubtile(sheetImg, tileInSheet, segment) {
  const {W,H,image} = sheetImg;
  const tileX = 0;
  const tileY = tileInSheet * 32;
  const subCol = Math.floor(segment / 4);
  const subRow = segment % 4;
  const sx = tileX + subCol*8;
  const sy = tileY + subRow*8;
  const out = new Uint8Array(64);
  for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
    const gx = sx+x, gy = sy+y;
    out[y*8+x] = (gx<W && gy<H) ? (image[gy*W+gx]||0) : 0;
  }
  return out;
}

function buildCompositeTile(entry) {
  const image = new Uint8Array(32*32);
  let missing = 0;
  for (let n=0;n<16;n++) {
    const {resid, tileInSheet, segment} = entry[n];
    const subCol = (n % 4)*8;
    const subRow = Math.floor(n / 4)*8;
    const sheetImg = getTileSheetImage(resid);
    if (!sheetImg) { missing++; continue; }
    const chunk = extractSubtile(sheetImg, tileInSheet, segment);
    for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
      image[(subRow+y)*32 + (subCol+x)] = chunk[y*8+x];
    }
  }
  return {W:32, H:32, image, missing};
}

// Terrain names live unencrypted in 0xF004 as repeated
// { u16 value, NUL-terminated name } records.
//
// RUN DIRECTION: the value is the index of the HIGHEST tile carrying that
// name -- the END of a run, not its start. The wiki's F004 page says so
// outright and its worked example proves it: in sheet 0x8E00 grass is tile 1,
// swamp is tiles 2-4 and a shrub is tile 5, which the table records as
// 0001 grass / 0004 swamp / 0005 shrub. So the name for an arbitrary tile is
// the nearest entry at or ABOVE it. This viewer previously searched downward,
// which shifted every terrain and composite-tile name onto the wrong run.
//
// Two further details the old parser got wrong regardless of direction:
//   * Entries with an EMPTY name are real run boundaries (0x00CE has no name,
//     0x00CF is "abyss"). Dropping them made tile 0xCE inherit "abyss".
//   * The table ends with a 0x7FFF catch-all and then 0x0000 padding, so it
//     must be read in file order and truncated where the values stop rising.
//     Sorting instead would move the trailing zeroes to the front.
//
// One more: the stored string is a NAME CODE, not a name. delvmod's
// store.namecode (and redelv, which shows the raw code and both derived forms
// in adjacent columns) reads a backslash as the point where the plural
// suffix begins -- "sling stone\s" is "sling stone" and "sling stones" -- and a
// slash inside that suffix as a choice of two endings, singular first, which
// is how an irregular plural is spelled out: "obol\s/oi" gives "obols" and
// "oboloi". Eight entries in 0xF004 use it, and this viewer was showing all
// eight raw, backslash and all.
DERIVED.TERRAIN_NAMES = null;
function delverNameCode(nameCode, plural) {
  const b = String(nameCode).indexOf('\\');
  if (b < 0) return nameCode;
  const stem = nameCode.slice(0, b), ending = nameCode.slice(b + 1);
  const slash = ending.indexOf('/');
  if (slash >= 0) return stem + (plural ? ending.slice(slash + 1) : ending.slice(0, slash));
  return plural ? stem + ending : stem;
}
function loadTerrainNames() {
  if (DERIVED.TERRAIN_NAMES) return DERIVED.TERRAIN_NAMES;
  const list = [];
  try {
    const raw = getResourceBytes(ARCHIVE, 0xF004);
    if (raw) {
      let i = 0, prev = -1;
      while (i + 3 <= raw.length) {
        const id = u16be(raw, i);
        i += 2;
        let end = i; while (end < raw.length && raw[end] !== 0) end++;
        const nm = decodeMacRoman(raw.subarray(i, end));
        i = end + 1;
        // Values ascend monotonically through the real table; the first one
        // that does not is the start of the trailing 0x0000 padding.
        if (id < prev) break;
        prev = id;
        // Six names carry a plural suffix after a backslash -- "arrow\s",
        // "unlit torch\es", "obol\s/oi" -- which is the game's own notation
        // for how to pluralise the word, not part of it. Dropped for display;
        // it is the only editing done to a name read out of the archive, and
        // without it those six read worse than the wiki's hand-written list
        // while the other 389 are identical to it.
        list.push([id, nm.replace(/\\[A-Za-z\/]*$/, '')]);
      }
    }
  } catch (e) { quiet(e); }
  DERIVED.TERRAIN_NAMES = list;
  return list;
}
function terrainNameFor(tileId, plural) {
  const list = loadTerrainNames();
  if (!list.length) return null;
  // First entry whose value is >= the tile: that run ends at or after it.
  for (const [id, nm] of list) {
    if (id >= tileId) return nm ? delverNameCode(nm, !!plural) : null;
  }
  // Past the last entry (including the 0x7FFF catch-all) nothing is named.
  return null;
}
// 0xF004 covers the composite range (0x1000-0x147F) directly, so the tile's
// own id names it. Entries are {resid,tileInSheet,segment} records, not tile
// ids, which is why naming them from a fragment produced nothing.
function compositeTileName(tileId) {
  return terrainNameFor(tileId);
}
function compositeSourceSummary(entry) {
  const counts = new Map();
  for (const f of (entry || [])) {
    if (!f || f.resid === undefined) continue;
    counts.set(f.resid, (counts.get(f.resid) || 0) + 1);
  }
  if (!counts.size) return '';
  const parts = [...counts.entries()].sort((a, b) => b[1] - a[1])
    .map(([r, c]) => (labelFor(r) || ('0x' + r.toString(16).toUpperCase())) + ' \u00d7' + c);
  return parts.join(', ');
}

// Drill-down: show the assembled tile large, plus every source fragment.
function showCompositeDetail(tileId, entry, builtCanvas) {
  const out = document.getElementById('output');
  const grid = document.getElementById('sheetGrid');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All composite tiles';
  back.onclick = () => renderCompositeSheet();
  grid.appendChild(back);

  const head = document.createElement('div');
  head.style.cssText = 'width:100%;text-align:center;margin:10px 0';
  const big = document.createElement('canvas');
  try {
    const { W, H, image } = buildCompositeTile(entry);
    drawToCanvas(big, W, H, image);
    const sc = Math.min(256 / W, 256 / H, 8);
    big.style.cssText = 'width:' + (W*sc) + 'px;height:' + (H*sc) + 'px;image-rendering:pixelated;border:1px solid #9b8850';
  } catch (e) { quiet(e); }
  head.appendChild(big);
  const cap = document.createElement('div');
  cap.style.cssText = 'color:#fff;margin-top:6px';
  const nm = compositeTileName(tileId);
  cap.textContent = 'Tile 0x' + tileId.toString(16).toUpperCase() + (nm ? ', ' + nm : '') +
    '\n' + compositeSourceSummary(entry);
  cap.style.whiteSpace = 'pre-line';
  head.appendChild(cap);
  grid.appendChild(head);

  let present = 0;
  entry.forEach((frag, i) => {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const c = document.createElement('canvas');
    c.style.cssText = 'width:64px;height:64px;image-rendering:pixelated;background:#12100c;border:1px solid #4a432f';
    try {
      if (frag && frag.resid !== undefined) {
        const sheetImg = getTileSheetImage(frag.resid);
        if (sheetImg) {
          const chunk = extractSubtile(sheetImg, frag.tileInSheet, frag.segment);
          drawToCanvas(c, 8, 8, chunk);
          present++;
        }
      }
    } catch (e) { quiet(e); }
    cell.appendChild(c);
    const l = document.createElement('div');
    l.className = 'lbl';
    const ok = frag && frag.resid !== undefined && getTileSheetImage(frag.resid);
    l.textContent = ok ? (labelFor(frag.resid) || ('sheet 0x' + frag.resid.toString(16).toUpperCase()))
                       : 'missing';
    if (!ok) l.classList.add('placeholder');
    cell.appendChild(l);
    const r = document.createElement('div');
    r.className = 'resid';
    r.textContent = 'frag ' + (i + 1) + '/' + entry.length;
    cell.appendChild(r);
    grid.appendChild(cell);
  });
  out.textContent = 'Composite tile 0x' + tileId.toString(16).toUpperCase() + ': ' +
    present + ' of ' + entry.length + ' source fragments present.';
}

// Everything known about a character in one place: portrait, map sprite,
// stats and home from 0xF009, name from 0x0201, and the full day's schedule
// from 0xF00B.
// Zone 0 is the null map ("Nowhere"), and its zone script's first string
// literal is the generic word "Map" -- which is why unplaced characters such
// as the generic guards were all labelled "Map". Fall back through the zone
// names, then our resource labels, and say plainly when a character simply
// isn't placed.
function zoneDisplayName(zone) {
  if (!zone) return 'not placed in a zone';
  const zn = zoneNameTable()[zone];
  if (zn && zn !== 'Map') return zn;
  const lbl = labelFor(0x8000 | zone);
  if (lbl && lbl !== 'Map') return lbl;
  return 'zone ' + zone + ' (unnamed)';
}

function characterDossier(i) {
  const c = loadCharacterTable()[i];
  if (!c) return null;
  const sched = scheduleDay(i).filter(e => e.mode !== 0);
  const zones = loadZoneNames();
  return {
    index: i, name: characterName(i), rec: c,
    notScheduled: (sched[0] && sched[0].why) || null,
    tile: (getPropTileList()[c.proptype] || 0) + c.aspect,
    homeZone: zoneDisplayName(c.zone),
    schedule: sched.map(e => ({ hour: e.hour, mode: e.mode,
      where: zoneDisplayName(e.level), x: e.x, y: e.y, at: e.at }))
  };
}

// Cycle a small canvas through a sprite sheet's 16 frames at a jittered rate
// so a page of characters doesn't pulse in lockstep.
const spriteTimers = [];
function stopSpriteAnimations() {
  while (spriteTimers.length) clearInterval(spriteTimers.pop());
}
// Not every character has a full 4x4 sheet. Count frames that actually carry
// pixels so the UI can say so rather than showing blanks.
const spriteCountCache = derivedMap('spriteCountCache');
// How many frames a character actually owns is set by the prop->tile table:
// a proptype's sprite block runs from its base tile up to the next proptype's
// base tile. Most characters get a full 16 (4 facings x 4 poses) and their
// base is 16-aligned -- Alaric starts at 0x710. Some do not: Ignae starts at
// 0x7D8 and Ur-Sylph at 0x89C, so they own only the tail of a block. And a
// proptype of 0 is the null prop, which is why Omen has no sprite at all.
// A sprite block runs from its base tile to the end of that 16-tile SHEET.
// Nothing subtler than that, and the subtler version was wrong: bounding the
// block at the next proptype's base gave Ignae 4 frames, because proptype
// 0x128 also has a base at 0x7DC, inside Ignae's range. Ignae is the second
// half of sheet 0x7D and owns all eight of 0x7D8-0x7DF, which is exactly what
// "16 minus the offset into the sheet" gives. Ur-Sylph at 0x89C gets 4, Alaric
// at 0x710 gets 16.
/* A prop's frames run from its base tile to the next prop type's base in
   the same 16-tile sheet, or to the sheet's end: the prop-tile table
   (0xF000) is the file's own boundary. It ran to the sheet's end alone until
   20 September 2026, so the gecko's page showed the sylph's four frames
   after its own (the maintainer's report); the two share a sheet, the
   gecko at 0x898 and the sylph at 0x89C. */
function spriteBlockSize(proptype) {
  const tiles = getPropTileList();
  const base = tiles[proptype];
  if (base === undefined || !proptype) return 0;
  let end = (base | 0x0F) + 1;
  // The arms of an octopus-kind unit run over two sheets: the program draws
  // arms times aspectStep frames of the arm class (exeOctoRule, 32 for the
  // hydra's), so an arm class's block is that long, still stopped at the
  // next prop type's base (25 September 2026; the hydra's own page showed
  // sixteen of its thirty-two until then).
  const arms = typeof unitArmsFrames === 'function' ? unitArmsFrames(proptype) : 0;
  if (arms > end - base) end = base + arms;
  for (let pt = 0; pt < tiles.length; pt++) {
    const b = tiles[pt];
    if (b !== undefined && pt !== proptype && b > base && b < end) end = b;
  }
  return end - base;
}
// Prop types that are scenery wearing a character record rather than someone
// who walks. There is exactly one among Cythera's characters -- Aeneas is
// proptype 0x04E, which 0xF004 names "corpse" by its base tile, and his four
// frames are decay stages, not a walk cycle. Which types are scenery has to
// be a table: content-based detection was tried first and does not work -- a
// corpse block's frame-to-frame difference (0.45) is indistinguishable from
// Hector's walk sheet (0.40). The word shown is the file's (propTypeName);
// the table carried "corpse" as well until 11 September 2026.
const STATIC_PROPTYPES = new Set([0x04E]);

// The sprite sheet is 4 rows of 4: one row per facing, and within a row three
// walk frames plus a fourth standing/sitting pose. Row 0 faces north (the only
// row the old code ever drew, which is why every character stared away from
// you); rows then run clockwise N, E, S, W. Evidence for the row structure:
// comparing rows pixelwise, rows 0 and 2 are each other's closest match and so
// are rows 1 and 3, exactly the opposite-facing pairing this layout predicts.
const SPR_N = 0, SPR_E = 1, SPR_S = 2, SPR_W = 3;
const WALK_CYCLE = [0, 1, 2, 1];   // 1-2-3-2, not 1-2-3-4: column 4 is the
                                   // standing/sitting pose and is not part of
                                   // the stride.
const SPR_REST = 3;

// The frame to show a character in when nothing else decides it: standing,
// facing south, which is facing the reader. Frame 0 -- the first frame that
// happens to carry pixels -- is the north row's first stride, so every
// gallery of characters used to be a gallery of the backs of their heads.
// Falls back through the south row's stride frames and then to whatever the
// sheet has, for the short blocks that do not own four facings.
function restingFrame(info) {
  if (!info || !info.present || !info.present.length) return 0;
  const has = f => info.present.indexOf(f) >= 0;
  for (const f of [SPR_S * 4 + SPR_REST, SPR_S * 4 + 1, SPR_S * 4, SPR_REST])
    if (has(f)) return f;
  return info.present[0];
}

function spriteFrameInfo(baseTile, proptype) {
  const key = 'p' + (proptype || 0);
  if (spriteCountCache.has(key)) return spriteCountCache.get(key);
  const tiles = getPropTileList();
  // The prop-tile table's entry IS the sheet base. Rounding it down to a
  // 16-tile boundary was wrong twice: Ignae's base 0x7D8 became 0x7D0 and
  // Ur-Sylph's 0x89C became 0x890, so both drew the tail of the previous
  // character's sheet -- the right number of frames, the wrong creature.
  const base = (proptype && tiles[proptype] !== undefined) ? tiles[proptype] : 0;
  const slots = spriteBlockSize(proptype);
  const fill = (f) => {
    try {
      const img = resolveTileImage(base + f);
      if (!img) return 0;
      let n = 0; for (let i = 0; i < img.length; i++) if (img[i]) n++;
      return n;
    } catch (e) { return 0; }
  };
  // The sheet bound is authoritative. Content is only consulted to drop frames
  // that are entirely empty, so a short block does not report phantom poses.
  const present = [];
  let real = 0;
  for (let f = 0; f < slots; f++) {
    if (fill(f) > 0) { present.push(f); real = f + 1; }
  }
  const info = { base, slots: real || slots, present, count: present.length,
                 rows: Math.max(1, Math.floor((real || slots) / 4)),
                 isStatic: STATIC_PROPTYPES.has(proptype),
                 staticKind: STATIC_PROPTYPES.has(proptype) ? propTypeName(proptype) : null,
                 complete: present.length === 16,
                 none: !proptype || present.length === 0 };
  spriteCountCache.set(key, info);
  return info;
}

// Walk a character around the outside of their own portrait, facing the way
// they are going. Position along the perimeter decides the facing, which is
// what makes it read as walking rather than as a sprite cycling in place.
//
// Pace comes from the character's own record. Reflex sets stride speed --
// Cythera's stats run to about 20, so reflex 20 moves at roughly twice the
// rate of reflex 6 -- and Body sets how willing they are to stop and rest,
// with heavier characters pausing more often. Nothing here is invented data:
// both fields are read straight out of F009.
// `opts`, where given, fixes the direction and where on the loop the walker
// starts, as a fraction of it: the hero's cell has two walkers, the hero and
// the heroine, half a loop apart and going the same way, so they never meet.
function animateSpriteTile(host, info, rec, opts) {
  if (!info || info.none) return null;
  const SIZE = 26;                       // 32px tile, shown small enough to
                                         // read as a figure beside a portrait
  const c = document.createElement('canvas');
  c.className = 'walker';
  c.style.cssText = 'position:absolute;width:' + SIZE + 'px;height:' + SIZE + 'px;' +
                    'image-rendering:pixelated;pointer-events:none;z-index:3';
  host.appendChild(c);

  // Scenery wearing a character record does not walk. Aeneas is a corpse, and
  // WHICH corpse is his stored aspect -- frame 1 of sheet 0x5E, not frame 0.
  const staticFrame = (rec && rec.aspect) || 0;
  if (info.isStatic || info.present.length < 2 || !window.SPRITE_ANIM) {
    c.style.left = 'calc(100% - ' + Math.round(SIZE * 0.55) + 'px)';
    c.style.top  = 'calc(100% - ' + Math.round(SIZE * 0.55) + 'px)';
    const f = info.present.indexOf(staticFrame) >= 0 ? staticFrame : restingFrame(info);
    try { drawTileToCanvas(c, info.base + f, 32); } catch (e) { quiet(e); }
    return c;
  }

  // Constant speed, constant direction, no pausing and no sitting. The earlier
  // version flipped direction at random and dropped into the fourth column to
  // rest, which read as twitching rather than walking.
  // Half a sprite-width per move, twice as often: the sprite still steps
  // rather than slides, and changes walk frame at every step, but a step is
  // now half the figure's width and the gait cycles twice per width -- it
  // read as lurching a whole body-length at a time before. Reflex sets how
  // long each step takes.
  const reflex = Math.max(4, Math.min(24, (rec && rec.reflex) || 12));
  const stepMs = Math.round((620 - reflex * 16) * 0.7);  // ~160ms fast, ~390ms slow
  const rows = Math.max(1, Math.floor(info.present.length / 4));

  let W = 0, H = 0, per = 0, steps = 0, k = 0, sw = 0, sh = 0;
  const dir = opts && opts.dir ? opts.dir : (Math.random() < 0.5 ? 1 : -1);
  const measure = () => {
    W = host.clientWidth || 76;
    H = host.clientHeight || 76;
    per = 2 * (W + H);
    // A whole number of steps along EACH side, so every corner is a step the
    // sprite lands on. One count for the whole loop let a step straddle a
    // corner, and the sprite cut across it diagonally.
    sw = Math.max(2, Math.round(W / (SIZE / 2)));
    sh = Math.max(2, Math.round(H / (SIZE / 2)));
    steps = 2 * (sw + sh);
    if (!k) k = opts && opts.phase !== undefined ? Math.round(opts.phase * steps) : Math.floor(Math.random() * steps);
  };

  // Where step n sits on the perimeter. Position and facing are worked out
  // separately from this, which is the whole point: the facing used to be read
  // off whichever SIDE the current position landed on, so a step that arrived
  // exactly at a corner was already assigned to the next side and the sprite
  // turned a step before it started walking that way. Facing now comes from
  // the move that just happened -- previous position to this one -- so they
  // turn as they set off down the new side, not as they reach the end of the
  // old one.
  const posAt = (n) => {
    let t = ((n % steps) + steps) % steps;
    if (t < sw)  return [t / sw * W, 0];
    t -= sw;
    if (t < sh)  return [W, t / sh * H];
    t -= sh;
    if (t < sw)  return [W - t / sw * W, H];
    t -= sw;
    return [0, H - t / sh * H];
  };

  const place = () => {
    if (!per || !steps) return;
    const [x, y] = posAt(k);
    const [px, py] = posAt(k - dir);
    const dx = x - px, dy = y - py;
    let row = SPR_S;
    if (Math.abs(dx) > Math.abs(dy)) row = dx > 0 ? SPR_E : SPR_W;
    else if (dy !== 0) row = dy > 0 ? SPR_S : SPR_N;
    row = row % rows;
    const col = WALK_CYCLE[((k % WALK_CYCLE.length) + WALK_CYCLE.length) % WALK_CYCLE.length];
    let f = row * 4 + col;
    if (info.present.indexOf(f) < 0) f = restingFrame(info);
    try { drawTileToCanvas(c, info.base + f, 32); } catch (e) { quiet(e); }
    c.style.left = Math.round(x - SIZE / 2) + 'px';
    c.style.top  = Math.round(y - SIZE / 2) + 'px';
  };

  const tick = () => {
    if (!host.isConnected) return;
    if (!per || !host.clientWidth) measure();
    k += dir;
    place();
  };
  measure();
  place();
  spriteTimers.push(setInterval(tick, stepMs));
  return c;
}
