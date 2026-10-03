/* What leaves the page as a file: the preferences file, the disk image, the zip, MIDI, GIF and PNG.

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
   last of these. File 13 of 14. */

/* ---- Cythera's preferences file -----------------------------------------
   The game keeps its settings in `Cythera Preferences`, in the System Folder's
   Preferences folder: a file with an empty data fork and three `'Pref'`
   resources in its resource fork. One of them, **130 "UI Prefs"**, is four
   bytes, and two bits in it are worth a visitor's while.

   **Bit 7 of the first byte is smooth movement, and the game has always had
   it.** Cythera implements quarter-tile sub-pixel movement in shipped code
   and gates it on this preference: every object's record carries a 2-bit x
   and y offset in byte 6, and the renderer tests this bit before applying it
   at all. Bit 1 asks for four sub-steps a tile rather than two. The whole of
   `0x9A` is what the game's own Preferences dialog writes for "Smoother
   Movement". With no stored preference the game picks a default by CPU class,
   and the 68040 default is `0x18` -- one 32-pixel jump a tile, the character
   teleporting from square to square. That is measured, not inferred: a
   filmstrip of five sampled positions, eight pixels apart.

   **Bit 0 of the fourth byte is the gate on cheat mode.** The map window
   keeps the last four keys in a rolling word, and typing `©gra` -- option-g,
   then g, r, a -- toggles the cheat flag *only* when that bit is set. Nothing
   in the game ever sets it: `TApPrefWindow::SaveSettings` writes bytes 0 and
   1 and no more, and all three CPU-class defaults have byte 3 clear. So a
   shipped copy cannot enter cheat mode however long you type at it, which is
   presumably how TCRF's "potential cheat mode" stayed potential. With the bit
   on, the keys are: option-j to jump to any level and square, option-s to
   conjure any object, option-w to walk through anything, option-t to pass a
   quarter of an hour, option-r for the regeneration Omen's ring grants,
   option-shift-x for vision of night. The full table was read out of
   `TMapWindow::KeyRoutine`.

   **This file has been put in front of the game.** The bytes were evidence
   first -- `18800001` in a stored preferences file was watched to print
   "Cheat mode activated." on 5 September 2026, and `0x9A` was measured the
   same week -- and on 9 September 2026 a file this page wrote was read by
   the game and the code typed: cheat mode activated. The page has said
   so since v1.35.0; the paragraph that stood here until v1.41.0 still called
   the file untried and asked for five minutes with a Mac.

   **The rest of the record is named** (v1.41.0, from the workbench's reading
   of `TApPrefWindow::AddContent`, `SaveSettings` and `TDelverApp::DefaultMenu`,
   and since v1.52.0 read out of the program as the page opens: see
   cytheraPrefsLayout and exePrefFields), and the Preferences tab offers every bit
   a dialog control writes. The frame-rate cap, which only the unreachable
   Preferences menu sets, is a four-bit field the first stored record leaves
   at 6, so the writer leaves it as it finds it; byte 1's bit 2 is read once
   and written by nothing, and stays clear.

   Two things are deliberately left out. There is no `CurScen` and no
   `CurPlayer`, the two other `'Pref'` resources a played copy has, so the
   start screen will say "No Player Selected" exactly as a fresh install does
   -- this file is a switch, not a saved session. Nothing is lost by leaving
   `CurScen` out in particular: the program writes it and never reads it
   back, which is the whole of that key.

   The Finder identity is **read rather than guessed**, which it was for an
   hour: fixing the StuffIt 5 folder walk made `Cythera Installed Folder with
   Preferences & License.sit` list its whole tree, and the real `Cythera
   Preferences` is in it -- type `pref`, creator `????`, an **empty data
   fork** and a 638-byte resource fork. All three are what this writes. The
   creator was `Delv` here, then four zero bytes on a misreading of the
   archive, and has been `????` since 23 September 2026: the archive's own
   catalogue says so, the disk image's says so, and
   `TPrefs::OpenPrefsResFile` hands `FSpCreateResFile` that very long, so it
   is what the game itself would have made. The fork inside the archive is no
   longer unread either -- it holds four resources, not three: `UI Prefs`
   `9A 80 00 00`, `Volume` -1, `Music` 8 and a `CurScen` alias, which is a
   real file to check this one against rather than only the executable's
   word. The workbench's `doc/preferences-file.md` is the whole of that file,
   key by key.

   And the file is offered on its own disk rather than added to
   the archive's export disk, because a third file on that volume pushes its
   catalog past one leaf node and raises a modal Finder alert that breaks the
   automated install -- see buildEditedDiskImage, where that was paid for. */
const PREFS_FILE_NAME = 'Cythera Preferences';
// '????', as the real file has and as the game's own FSpCreateResFile call
// passes: it belongs to no application, and the Finder shows it the generic
// document icon accordingly.
const PREFS_CREATOR = '????';
const PREFS_VOLUME_NAME = 'Cythera Prefs';
const PREFS_SCRIPT_NAME = 'Install Preferences';

/* THE RECORD AS THE TOOLS TAB WRITES IT, off the program: the first record
   the game stores when it has none (exePrefDefaults; the one for the lowest
   processor class) as the starting point, the gate's byte and bit
   (exeKeyRoutine), and for each switch the field the preferences dialog's
   control of that label writes, or for smooth movement the bits and values
   the Preferences menu's item of that name writes (exePrefFields). The
   labels are the game's own strings and are how a switch finds its field;
   the fields are read. With only `smooth` and `cheats` given the bytes are
   what they have been since the file was put in front of the game:
   9A 80 00 01, 18 80 00 00, 18 80 00 01, which the resource fork check
   holds the program's reading to. Null with no application open. */
const PREF_OPTIONS = [['liveDrag', 'Live Dragging'], ['manualContainers', 'Manually Place Containers'],
  ['motionFilters', 'Motion Filters'], ['walkAround', 'Walk around obstacles'], ['zoomRects', 'Use \'ZoomRects\'']];
const PREF_SMOOTH_ITEM = 'Smoother Movement';
/* The one question the game asks on its own, and the two bits that answer it.
   On a display deeper than eight bits TDelverApp::PostInitMac puts up a dialog
   -- "This game runs faster in 256 colors.  Would you like to automatically
   switch at startup?" -- and writes the answer into the record: the button
   into one bit, the checkbox that stops it asking again into another. Neither
   is the Preferences dialog's, which is why the record's own sheet had them
   down as dead until 23 September 2026. Both are found here the way every
   other switch is, by the text the program hands GetDialogItem, so the labels
   below are the dialog's own and nothing is typed in. This page turns both on:
   256 colours is what the game recommends in its own words, and a file written
   to change a setting should not then stop to ask a question. */
const PREF_STARTUP_ITEMS = ['Switch to 256 Colors', "Don't Ask Again"];
// The Preferences tab's switch for each, in the same order.
const PREF_STARTUP_IDS = ['prefSwitch256', 'prefDontAsk'];
// A frame-rate value the game's menu does not offer, named as the menu names
// its own: the field is ticks between frames, and a tick is a sixtieth of a
// second, so n ticks is 60/n frames a second; 0 is no wait at all.
const PREF_RAW_LABEL = n => n === 0 ? 'No limit' : 'Limit to ' + Math.round(60 / n) + ' FPS';
/* The ordinals' ranges, which are the one thing here the program does not
   state. Each is a plain long and the code clamps nothing, so the limit is
   what the Toolbox call at the end of the chain means by "full":
   TAudio::SetSoundVolume multiplies by 32 into the Sound Manager's 0-256,
   and GMSSetVolume multiplies by 8,192 into a Fixed, where 65,536 is unity
   gain -- so both scales top out at 8, and both are eighths. Volume also
   takes -1, which SetSoundVolume sends down a different branch that leaves
   the machine's own level alone; MENU 131 calls that one "System Volume".
   Ambient is a flag. `Backdrop` is deliberately absent: its values are read
   out of the program and the two files instead (cytheraBackdropOptions). */
/* WHAT THE FOUR SHIPPED RELEASES SAY, so that the file can be written
   with no application open. Every number here was read out of a program
   by the code above and printed, never typed: 1.0.1, 1.0.2, 1.0.3 and
   1.0.4 give byte-for-byte the same answer for all of it -- the same bit
   positions, the same menu items, the same ordinal defaults, the same two
   'ppat' ids -- so there is nothing for a version to disagree about and no
   reason to make a visitor open the game before the page will write a
   file. It is still only the fallback: with a program open the page reads
   that one, which is what keeps a patched or unknown build right.
   utilities/smoke_installer.mjs holds this to the program across all four
   releases, so it cannot drift without a check going red. The one
   exception is `buttons`, the multi-button mouse bit, which 1.0.1 does not
   have: it is 1.0.2's to 1.0.4's, and the check holds that apart. */
const PREF_SHIPPED = {
  key: "UI Prefs",
  bytes: 4,
  base: 411041792,
  type: "Pref",
  gate: {"byte": 3, "bit": 0, "word": "©gra"},
  controls: [{"opt": "liveDrag", "label": "Live Dragging", "byte": 0, "bit": 0}, {"opt": "manualContainers", "label": "Manually Place Containers", "byte": 0, "bit": 6}, {"opt": "motionFilters", "label": "Motion Filters", "byte": 1, "bit": 3}, {"opt": "walkAround", "label": "Walk around obstacles", "byte": 1, "bit": 6}, {"opt": "zoomRects", "label": "Use 'ZoomRects'", "byte": 1, "bit": 7}],
  smooth: [{"byte": 0, "lo": 7, "hi": 7, "value": 1}, {"byte": 0, "lo": 1, "hi": 1, "value": 1}],
  smoothLabel: "Smoother Movement",
  startup: [{"byte": 1, "bit": 5, "text": "Switch to 256 Colors", "value": 1}, {"byte": 1, "bit": 4, "text": "Don't Ask Again", "value": 1}],
  choices: [{"opt": "c0_7_0_1", "options": [{"text": "Smoother Movement", "sets": [{"byte": 0, "lo": 7, "hi": 7, "value": 1}, {"byte": 0, "lo": 1, "hi": 1, "value": 1}]}, {"text": "Faster Movement", "sets": [{"byte": 0, "lo": 7, "hi": 7, "value": 1}, {"byte": 0, "lo": 1, "hi": 1, "value": 0}]}, {"text": "Fastest Movement", "sets": [{"byte": 0, "lo": 7, "hi": 7, "value": 0}, {"byte": 0, "lo": 1, "hi": 1, "value": 0}]}]}, {"opt": "c0_2", "options": [{"text": "Limit to 16 FPS", "sets": [{"byte": 0, "lo": 2, "hi": 5, "value": 4}]}, {"text": "Limit to 10 FPS", "sets": [{"byte": 0, "lo": 2, "hi": 5, "value": 6}]}, {"text": "Limit to 8 FPS", "sets": [{"byte": 0, "lo": 2, "hi": 5, "value": 8}]}]}],
  ordinals: [{"key": "Music", "index": 0, "code": 8, "shipped": 2}, {"key": "Ambient", "index": 0, "code": 1, "shipped": null}, {"key": "Volume", "index": 0, "code": 5, "shipped": 5}, {"key": "Backdrop", "index": 0, "code": 0, "shipped": null}],
  backdrop: {"limit": 2, "graphic": [36608, 36609], "ppat": [128, 129], "pixPat": 127},
  buttons: {"byte": 1, "bit": 2},
};
const PREF_ORDINAL_RANGE = { Volume: { min: -1, max: 8 }, Music: { min: 0, max: 8 }, Ambient: { min: 0, max: 1 } };
function cytheraPrefsLayout() {
  if (!appImage()) return cytheraShippedLayout();
  const kr = exeKeyRoutine(), fields = exePrefFields(), defaults = exePrefDefaults(), acc = exePrefsAccess();
  if (!kr || !kr.gate || !kr.gate.byte || !kr.gate.bit || !fields || !defaults || !acc) return null;
  const rec = exePrefKeys().find(e => e.kind === 'Prefs' && e.len && e.writers.some(w => acc.passes.some(p2 => p2.routine === w.routine)));
  const type = exePrefResourceType();
  if (!rec || !type) return null;
  const controls = [];
  for (const [opt, label] of PREF_OPTIONS) {
    const f = fields.find(x => x.lo === x.hi && x.writers.some(w => w.label && w.label.v === label && w.value === null));
    if (f) controls.push({ opt, label, byte: f.byte, bit: f.lo });
  }
  const smooth = [];
  for (const f of fields) for (const w of f.writers) if (w.item && w.item.texts.includes(PREF_SMOOTH_ITEM) && w.value && typeof w.value.v === 'number') smooth.push({ byte: f.byte, lo: f.lo, hi: f.hi, value: w.value.v });
  // The startup question's two bits, in the order its dialog asks them. A
  // checkbox's write takes its value from the control rather than from a
  // constant, so a bit with no value read is the ticked box, 1.
  const startup = [];
  for (const text of PREF_STARTUP_ITEMS)
    for (const f of fields) for (const w of f.writers)
      if (f.lo === f.hi && w.item && w.item.dialog && w.item.texts.length === 1 && w.item.texts[0] === text &&
          !startup.some(x => x.text === text))
        startup.push({ byte: f.byte, bit: f.lo, text, value: w.value && typeof w.value.v === 'number' ? w.value.v : 1 });
  /* The record's settings that are a CHOICE rather than a switch, gathered
     without being named. Every menu item that writes the record is a named
     value for some run of bits; group the items by the set of fields they
     write, and a group with three or more numeric options is a choice. That
     picks out exactly two on this build -- the three movement stops, which
     write two bits between them, and the three frame-rate caps, which write
     one four-bit field -- and leaves the on/off items to the checkboxes
     above. A build that added a fourth stop would grow the control. */
  const byText = new Map();
  for (const f of fields) for (const w of f.writers)
    if (w.item && w.item.menu && w.item.texts.length === 1 && w.value && typeof w.value.v === 'number') {
      const t = w.item.texts[0];
      if (!byText.has(t)) byText.set(t, []);
      byText.get(t).push({ byte: f.byte, lo: f.lo, hi: f.hi, value: w.value.v });
    }
  const groups = new Map();
  for (const [text, sets] of byText) {
    const k = sets.map(x => x.byte + ':' + x.lo + ':' + x.hi).sort().join(',');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push({ text, sets });
  }
  const choices = [...groups.values()].filter(g => g.length >= 3)
    .map(g => ({ opt: 'c' + g[0].sets.map(x => x.byte + '_' + x.lo).join('_'), options: g }));

  /* The other keys of the file: the four ordinals, each a long the program
     fetches with a fallback. The fallback in the code is not the whole
     default, because GetOrdinal searches the resource chain and the
     application's own fork ships two of these keys -- so the value a fresh
     install reads is the shipped resource when there is one, and the code's
     fallback otherwise. Both are carried; `dflt` is the one a visitor is
     actually changing away from. */
  const fork = window.APP_RSRC;
  const shipped = key => {
    try {
      const e = fork && (fork.resourcesByType[type.v] || []).find(x => x.name === key);
      const d = e ? fork.dataOf(type.v, e) : null;
      return d && d.length >= 4 ? ((d[0] << 24 | d[1] << 16 | d[2] << 8 | d[3]) | 0) : null;
    } catch (e) { return null; }
  };
  const ordinals = exePrefKeys().filter(e => e.kind === 'Ordinal' && e.index && e.dflt)
    .map(e => ({ key: e.key.v, index: e.index.v, code: e.dflt.v | 0, shipped: shipped(e.key.v), writers: e.writers.length }))
    .map(o => Object.assign(o, { dflt: o.shipped === null ? o.code : o.shipped }));
  /* The switch nothing in the game sets: the bit the event routine tests
     before asking which mouse button went down and adding a modifier key
     for buttons two to five (the workbench's cheats.md, *Bit 2 of byte 1*).
     Found as the one bit TDelverApp::MyGetEvent reads from the record. */
  const br = acc.reads.find(x => /^TDelverApp::MyGetEvent/.test(x.routine.name) && x.bits.v[0] === x.bits.v[1]);
  const buttons = br ? { byte: br.byte.v, bit: br.bits.v[0] } : null;
  return { key: rec.key.v, bytes: rec.len.v, base: defaults.words[0].v >>> 0, controls, smooth, smoothLabel: smooth.length ? PREF_SMOOTH_ITEM : null, buttons,
           startup, startupLabel: startup.length === PREF_STARTUP_ITEMS.length ? startup.map(x => x.text).join(', and ') : null,
           choices, ordinals, backdrop: cytheraBackdropOptions(), from: 'program',
           gate: { byte: kr.gate.byte.v, bit: kr.gate.bit.v, word: kr.gate.word.v }, type: type.v };
}

/* The same layout from PREF_SHIPPED, for a visitor with no game open. Every
   field has the shape the reading above produces, so everything downstream --
   the record writer, the ordinals, the Tools tab -- cannot tell the
   difference except by `from`, which the section says out loud. */
function cytheraShippedLayout() {
  const S = PREF_SHIPPED;
  if (!S) return null;
  return { key: S.key, bytes: S.bytes, base: S.base, type: S.type, gate: S.gate,
           controls: S.controls, smooth: S.smooth, smoothLabel: S.smoothLabel,
           startup: S.startup, startupLabel: S.startup.map(x => x.text).join(', and '), buttons: S.buttons,
           choices: S.choices,
           ordinals: S.ordinals.map(o => Object.assign({}, o, { dflt: o.shipped === null ? o.code : o.shipped, writers: 0 })),
           backdrop: cytheraBackdropList(S.backdrop.limit, S.backdrop.graphic[0], S.backdrop.pixPat, S.backdrop.ppat),
           from: 'shipped' };
}

/* What `Backdrop` can be set to, from the program's three numbers and the
   two files' contents. Below the limit the long is a general graphic, `base
   + n`; at or above it, and for every negative, it is a 'ppat' of
   `base - n`, and the application's fork says which of those exist -- so the
   list is short because the game ships two of each, not because two were
   chosen here. Null when the program is not open. */
function cytheraBackdropOptions() {
  const b = exeBackdropChoices();
  if (!b) return null;
  const fork = window.APP_RSRC;
  const pats = [];
  try { for (const e of (fork ? fork.resourcesByType['ppat'] || [] : [])) pats.push(e.id); } catch (e) { /* none */ }
  return cytheraBackdropList(b.limit.v, b.graphic.v, b.pixPat.v, pats.length ? pats : PREF_SHIPPED.backdrop.ppat);
}
// The list itself, from four numbers, whichever they came from. A graphic
// wears the name the rest of the page gives that resource, which answers
// differently with and without an archive open and is right either way; a
// pixel pattern has no name anywhere, so it wears its id.
function cytheraBackdropList(limit, graphicBase, pixPatBase, ppatIds) {
  const out = [];
  for (let n = 0; n < limit; n++) {
    const resid = graphicBase + n;
    let name = null;
    try { name = typeof labelFor === 'function' ? labelFor(resid) : null; } catch (e) { name = null; }
    out.push({ value: n, what: 'graphic', resid, label: name || ('graphic 0x' + resid.toString(16).toUpperCase()) });
  }
  for (const id of (ppatIds || []).slice().sort((x, y) => x - y)) {
    const n = pixPatBase - id;
    if (n >= 0 && n < limit) continue;          // the graphics' own range
    out.push({ value: n, what: 'ppat', resid: id, label: '\u2018ppat\u2019 ' + id });
  }
  return out.length ? out : null;
}
// The resource type the store files a key under: the four characters
// TPrefs::SavePrefs hands Get1NamedResource.
function exePrefResourceType() {
  const ops = exeOpsNamed('TPrefs::SavePrefs');
  const call = ops.findIndex(o => exeCalls(o, 'Get1NamedResource'));
  const hi = call >= 0 ? exeFindBack(ops, call, 8, d => d.mn === 'lis' && d.rd === 3) : -1;
  const lo = hi >= 0 ? exeFind(ops, hi + 1, 4, d => d.mn === 'addi' && d.ra === 3 && d.rd === 3) : -1;
  if (lo < 0) return null;
  const w = ((ops[hi].d.imm * 65536) + ops[lo].d.imm) >>> 0;
  return exeVal(ops[hi], String.fromCharCode(w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255));
}
function cytheraPrefsRecord(opts, layout) {
  const L = layout || cytheraPrefsLayout();
  if (!L) throw new Error('the page reads the preferences record from the program, which is not open');
  const o = opts || {};
  const b = new Uint8Array(L.bytes);
  for (let i = 0; i < Math.min(4, L.bytes); i++) b[i] = (L.base >>> (24 - 8 * i)) & 255;
  const put = (byte, lo, hi, v) => { const m = ((1 << (hi - lo + 1)) - 1) << lo; b[byte] = (b[byte] & ~m) | ((v << lo) & m); };
  for (const c of L.controls) if (o[c.opt] !== undefined) put(c.byte, c.bit, c.bit, o[c.opt] ? 1 : 0);
  if (o.smooth) for (const x of L.smooth) put(x.byte, x.lo, x.hi, x.value);
  // A choice is named by the game's own item text; every field that item
  // writes is written, so a stop spread over two bits lands whole.
  for (const c of L.choices) {
    const want = o[c.opt];
    const picked = want ? c.options.find(x => x.text === want) : null;
    if (picked) for (const x of picked.sets) put(x.byte, x.lo, x.hi, x.value);
    // A value the menu does not offer, for a choice that is one numeric
    // field (the frame-rate cap: every value from 0 up is a number of ticks
    // between frames, and the menu's three are only three of them).
    const f = !picked && typeof want === 'string' && /^raw:\d+$/.test(want) ? cytheraChoiceField(c) : null;
    if (f) put(f.byte, f.lo, f.hi, Math.min(parseInt(want.slice(4), 10), (1 << (f.hi - f.lo + 1)) - 1));
  }
  // The startup question's two bits together (switch256), or each on its
  // own by the dialog's text (startup), so that every pairing can be
  // written: the answer without the "don't ask", or "don't ask" with the
  // screen left as it is.
  if (o.switch256) for (const x of L.startup) put(x.byte, x.bit, x.bit, x.value);
  if (o.startup) for (const x of L.startup) if (o.startup[x.text] !== undefined) put(x.byte, x.bit, x.bit, o.startup[x.text] ? x.value : 0);
  if (o.cheats) put(L.gate.byte, L.gate.bit, L.gate.bit, 1);
  if (o.mouseButtons !== undefined && L.buttons) put(L.buttons.byte, L.buttons.bit, L.buttons.bit, o.mouseButtons ? 1 : 0);
  return b;
}
// The one field a choice writes, when every option writes the same single
// run of bits; null for a choice spread over several (the movement stops).
function cytheraChoiceField(c) {
  const f = c.options[0] && c.options[0].sets.length === 1 ? c.options[0].sets[0] : null;
  return f && c.options.every(x => x.sets.length === 1 && x.sets[0].byte === f.byte && x.sets[0].lo === f.lo && x.sets[0].hi === f.hi) && f.hi > f.lo
    ? { byte: f.byte, lo: f.lo, hi: f.hi } : null;
}
// One ordinal's resource: (index + 1) longs, the value at its index and the
// rest zero. Exactly that length, because GetOrdinal answers its caller's
// fallback for a resource that holds more longs than the index asks for.
function cytheraOrdinalRecord(value, index) {
  const b = new Uint8Array((index + 1) * 4), at = index * 4, v = value | 0;
  b[at] = (v >>> 24) & 255; b[at + 1] = (v >>> 16) & 255; b[at + 2] = (v >>> 8) & 255; b[at + 3] = v & 255;
  return b;
}
// The ordinals a set of options actually changes: a key left at the value a
// fresh install would read is not written at all, so the file says only what
// it means to say.
function cytheraOrdinalsFor(opts, L) {
  const o = opts || {};
  return (L.ordinals || []).filter(x => o[x.key] !== undefined && (o[x.key] | 0) !== x.dflt)
                           .map(x => ({ key: x.key, index: x.index, value: o[x.key] | 0 }));
}
/* The Preferences tab's two presets, as options cytheraPrefsRecord takes
   (the maintainer, 1 October 2026). DEFAULT is a new copy of the game: the
   record the program stores first, no answer to the 256-colour question so
   the game asks it, no cheat keys, no extra mouse buttons, and every ordinal
   where a fresh install reads it. OPTIMIZED is the settings of the Infinite
   Mac disk built for Mac OS 8.5 (the workbench's doc/infinite-mac-disk.md):
   Smoother Movement, 256 colours without asking and the cheat keys, the
   rest as DEFAULT. A setting is named by what the layout read, never by a
   bit typed here, so a patched build gets its own. */
function cytheraPrefsPreset(name, layout) {
  const L = layout || cytheraPrefsLayout();
  if (!L) return null;
  const bit = (byte, b) => !!((L.base >>> (24 - 8 * byte)) & (1 << b));
  const field = (byte, lo, hi) => (((L.base >>> (24 - 8 * byte)) & 255) >> lo) & ((1 << (hi - lo + 1)) - 1);
  const o = { cheats: false, mouseButtons: false, startup: {} };
  for (const c of L.controls) o[c.opt] = bit(c.byte, c.bit);
  for (const x of L.startup || []) o.startup[x.text] = false;
  for (const c of L.choices) {
    const cur = c.options.find(op => op.sets.every(x => field(x.byte, x.lo, x.hi) === x.value));
    if (cur) o[c.opt] = cur.text;
  }
  for (const x of L.ordinals || []) o[x.key] = x.dflt;
  if (name === 'optimized') {
    const mv = L.choices.find(c => c.options.some(op => op.text === L.smoothLabel));
    if (mv) o[mv.opt] = L.smoothLabel;
    for (const x of L.startup || []) o.startup[x.text] = true;
    o.cheats = true;
  }
  return o;
}
// One line naming what a record asks for, for the status line and the script.
function prefsSummary(o) {
  const parts = [o.cheats ? 'the cheat keys allowed' : 'no cheat keys'];
  if (o.smooth) parts.unshift('smoother movement');
  if (o.switch256) parts.push('256 colors chosen at startup without asking');
  if (o.startup) for (const [t, v] of Object.entries(o.startup)) if (v) parts.push('\u201c' + t + '\u201d');
  const L = cytheraPrefsLayout();
  if (L) {
    for (const c of L.choices) if (o[c.opt] && c.options.some(x => x.text === o[c.opt])) parts.push('\u201c' + o[c.opt] + '\u201d');
    for (const c of L.choices) if (typeof o[c.opt] === 'string' && o[c.opt].startsWith('raw:')) parts.push(PREF_RAW_LABEL(parseInt(o[c.opt].slice(4), 10)));
    for (const x of cytheraOrdinalsFor(o, L)) parts.push(x.key + ' ' + x.value);
  }
  if (o.liveDrag) parts.push('live dragging');
  if (o.manualContainers) parts.push('containers placed by hand');
  if (o.motionFilters) parts.push('motion filters');
  if (o.walkAround) parts.push('walking around obstacles');
  if (o.zoomRects === false) parts.push('no zoom rectangles');
  if (o.mouseButtons) parts.push('extra mouse buttons as modifier keys');
  return parts.join(', ');
}
// The id is the file's own choice: the store finds a key by name and gives a
// new one whatever UniqueID answers, so 130 is only what this file uses.
function buildCytheraPreferences(opts) {
  const L = cytheraPrefsLayout();
  if (!L) throw new Error('the page reads the preferences record from the program, which is not open');
  const out = [{ type: L.type, id: 130, name: L.key, data: cytheraPrefsRecord(opts, L) }];
  let id = 131;
  for (const x of cytheraOrdinalsFor(opts, L))
    out.push({ type: L.type, id: id++, name: x.key, data: cytheraOrdinalRecord(x.value, x.index) });
  return writeResourceFork(out);
}
function prefsInstallScript(opts) {
  const o = opts || {};
  return [
    '-- ' + PREFS_SCRIPT_NAME,
    '-- Written by Grimoire, https://ratlizard.github.io/grimoire/',
    '--',
    '-- Puts "' + PREFS_FILE_NAME + '" into the System Folder’s Preferences',
    '-- folder, replacing whatever is there. Press Run, or Command-R.',
    '--',
    '-- It replaces the file, so you lose any settings already stored.',
    '-- Move the old one somewhere else first if you want to keep them.',
    '--',
    '-- Cheat keys allowed: ' + (o.cheats ? 'ON: type ' + ((cytheraPrefsLayout() || { gate: {} }).gate.word || 'the code') + ' in the map window' : 'off') + '.',
    '-- The file asks for ' + prefsSummary(o) + '.',
    '--',
    'tell application "Finder"',
    '\tset src to file "' + PREFS_FILE_NAME + '" of disk "' + PREFS_VOLUME_NAME + '"',
    '\ttry',
    '\t\tduplicate src to folder "Preferences" of system folder with replacing',
    '\t\tdisplay dialog "Put ' + PREFS_FILE_NAME + ' in the Preferences folder. ' +
      'Start Cythera." buttons {"OK"} default button 1',
    '\ton error',
    '\t\tdisplay dialog "This script could not write to the Preferences folder. Drag ' +
      PREFS_FILE_NAME + ' there by hand." buttons {"OK"} default button 1',
    '\tend try',
    'end tell',
    ''
  ].join('\r');   // classic Mac line endings, as buildInstallScript uses
}
// The two files on one volume, which is the most a catalog leaf holds.
function buildPrefsDiskImage(opts) {
  return writeHfsImage({
    volumeName: PREFS_VOLUME_NAME,
    entries: [
      { name: PREFS_FILE_NAME, type: 'pref', creator: PREFS_CREATOR,
        data: new Uint8Array(0), rsrc: buildCytheraPreferences(opts) },
      { name: PREFS_SCRIPT_NAME, type: 'TEXT', creator: 'ToyS',
        data: encodeMacRoman(prefsInstallScript(opts)), rsrc: new Uint8Array(0) }
    ]
  });
}
function prefsOptionsFromUI() {
  const on = id => { const e = document.getElementById(id); return e ? !!e.checked : undefined; };
  // An ordinal that is a flag is drawn as a switch (renderPrefsSheet), so a
  // checkbox answers 1 or 0 where a chooser answers its value.
  const pick = id => { const e = document.getElementById(id); if (!e) return undefined; if (e.type === 'checkbox') return e.checked ? '1' : '0'; return e.value !== '' ? e.value : undefined; };
  const o = { cheats: on('prefCheats'), mouseButtons: on('prefMouseButtons') };
  // The startup question's bits, one switch each, in the order the dialog
  // has them (PREF_STARTUP_IDS).
  const L0 = cytheraPrefsLayout();
  if (L0 && L0.startup) {
    o.startup = {};
    L0.startup.forEach((x, i) => { const v = PREF_STARTUP_IDS[i] ? on(PREF_STARTUP_IDS[i]) : undefined; if (v !== undefined) o.startup[x.text] = v; });
  }
  for (const [opt] of PREF_OPTIONS) o[opt] = on('pref' + opt[0].toUpperCase() + opt.slice(1));
  const L = cytheraPrefsLayout();
  if (L) {
    for (const c of L.choices) o[c.opt] = pick('pref_' + c.opt);
    for (const x of L.ordinals) { const v = pick('prefOrd_' + x.key.replace(/\W/g, '')); if (v !== undefined) o[x.key] = parseInt(v, 10); }
  }
  return o;
}
function downloadCytheraPrefs(kind) {
  const opts = prefsOptionsFromUI();
  const how = prefsSummary(opts);
  if (kind === 'dsk') {
    const image = buildPrefsDiskImage(opts);
    dlBlob(new Blob([image], { type: 'application/octet-stream' }), PREFS_VOLUME_NAME + '.dsk');
    setStatus('Wrote a ' + fmtBytes(image.length) + ' disk image with ' + how + '. Drop it on an ' +
      'emulated Mac; it mounts as “' + PREFS_VOLUME_NAME + '” and carries an ' +
      PREFS_SCRIPT_NAME + ' script.');
    return;
  }
  const bin = writeMacBinary({ name: PREFS_FILE_NAME, type: 'pref', creator: PREFS_CREATOR,
                               data: new Uint8Array(0), rsrc: buildCytheraPreferences(opts) });
  dlBlob(new Blob([bin], { type: 'application/octet-stream' }), PREFS_FILE_NAME + '.bin');
  setStatus('Wrote ' + PREFS_FILE_NAME + '.bin with ' + how + '. Decode it on a real Mac and put it ' +
    'in the System Folder’s Preferences folder.');
}

function buildInstallScript(archiveName, note) {
  return [
    '-- ' + DISK_SCRIPT_NAME,
    '-- Written by Grimoire, https://ratlizard.github.io/grimoire/',
    '--',
    '-- Finds the folder holding the Cythera application on any mounted disk,',
    '-- replaces the "' + archiveName + '" in it with the edited one on this',
    '-- disk, and starts the game. Press Run, or Command-R -- or press Install',
    '-- from the disk itself, so you need not select anything inside the Mac.',
    '--',
    '-- Keep a backup of the original first: the replacement cannot be undone.',
    '-- By hand instead: drag "' + archiveName + '" into the game\u2019s folder.',
    '--'].concat((note || []).map(line => '-- ' + line)).concat([
    '',
    'tell application "Finder"',
    '\tset src to file "' + archiveName + '" of disk "' + DISK_VOLUME_NAME + '"',
    '\tset done to false',
    '\trepeat with d in disks',
    '\t\trepeat with f in (every folder of d)',
    '\t\t\tif done is false then',
    '\t\t\t\ttry',
    '\t\t\t\t\tset theGame to file "Cythera" of f',
    '\t\t\t\t\tduplicate src to f with replacing',
    '\t\t\t\t\topen theGame',
    '\t\t\t\t\tset done to true',
    '\t\t\t\ton error',
    '\t\t\t\tend try',
    '\t\t\tend if',
    '\t\tend repeat',
    '\tend repeat',
    '\tif done is false then',
    '\t\tdisplay dialog "This script could not find a folder holding a Cythera application ' +
      'on any mounted disk." buttons {"OK"} default button 1',
    '\tend if',
    'end tell',
    '',
  ]).join('\r');   // classic Mac line endings, so Script Editor reads it as lines
}

/* An HFS disk image of the edited archive, which is the only shape the
   emulator will take.

   The .bin above is the right file to hand a real Mac, and the wrong one to
   hand the retired mobile shell: infinite-mac mounts disk images, and a MacBinary file
   dropped on it lands in the Downloads folder still wrapped, needing a
   StuffIt Expander round trip inside the emulated Mac before the game can see
   it. A .dsk mounts as a disk, with the archive on it as an ordinary file
   carrying both its forks and its Finder type -- drag it into the Cythera
   folder and the game reads the edit.

   The resource fork rides along because a Delver archive genuinely has one
   (the eSTM stamps and eBRS brushes, and the PICT the Finder shows), and
   because writeHfsImage keeps forks the whole point of using HFS at all.

   Mac OS may say it could not rebuild the desktop file on the disk. It is
   read-only, and that is what a read-only disk with no desktop database does;
   the header of js/mac-hfs.js has the detail. Dismiss it -- the files are
   there. */
/* Building the disk and doing something with it are two jobs, and there are
   two things to do with it now -- save it, or hand it to the retired mobile shell. They
   have to be the same bytes, so the build is here and the callers are thin. */
function buildEditedDiskImage() {
  if (!ARCHIVE) return null;
  const f = window.ARCHIVE_FINDER || { name: DISK_ARCHIVE_NAME, type: 'DelS', creator: 'Delv' };
  const base = (window.ARCHIVE_SOURCE_NAME || f.name || DISK_ARCHIVE_NAME)
    .replace(/\.(hqx|data|bin|dsk)$/i, '');
  // The name on the disk is the name the copy lands under, so it has to be the
  // one the game looks for -- an archive that arrived as "Cythera Data.hqx"
  // must not be installed as "Cythera Data.hqx". The script is written with
  // the same name, so the two cannot drift.
  const archiveName = (f.name || DISK_ARCHIVE_NAME).replace(/\.(hqx|data|bin|dsk)$/i, '')
                      || DISK_ARCHIVE_NAME;
  const edited = (window.EDITED_RESIDS && window.EDITED_RESIDS.size) || 0;
  const rsrc = window.CYTHERA_RSRC_RAW || new Uint8Array(0);
  const forkWarning = missingForkWarning(rsrc);
  /* Everything a person needs to know goes in the script's own comments, and
     there is no Read Me file beside it. That is not tidiness, it is the fix
     for a bug only an end-to-end run found: a third file pushes the volume's
     catalog past one 512-byte leaf node, a volume with more than one leaf
     makes the Finder put up its "could not rebuild the desktop file" alert on
     every mount, and that alert is MODAL. It holds the keyboard, so
     the retired mobile shell's Install types its keystrokes into a dialog that ignores
     them and nothing happens at all. Two files fit in one leaf and no alert
     appears. the retired mobile shell dismisses one defensively as well, so a larger
     export than this still installs -- but the disk this page writes should
     not be raising it in the first place. */
  const note = [
    'Written ' + new Date().toISOString().slice(0, 10) + '. ' +
    (edited ? edited + ' resource(s) edited before making this disk.'
            : 'The file on this disk is unmodified.'),
  ];
  if (forkWarning) note.push('', 'WARNING: ' + forkWarning.replace(/“|”/g, '"'));
  let image;
  try {
    image = writeHfsImage({
      volumeName: DISK_VOLUME_NAME,
      entries: [
        { name: archiveName, type: f.type, creator: f.creator,
          data: ARCHIVE.bytes, rsrc: rsrc },
        // TEXT with creator ToyS is what makes the Finder open this in Script
        // Editor. See the comment above buildInstallScript.
        { name: DISK_SCRIPT_NAME, type: 'TEXT', creator: 'ToyS',
          data: encodeMacRoman(buildInstallScript(archiveName, note)) },
      ],
    });
  } catch (err) {
    setStatus('The page could not build the disk image: ' + (err && err.message ? err.message : err), true);
    return null;
  }
  return { image: image, fileName: safeFileName(base + ' (edited)') + '.dsk',
           forkWarning: forkWarning };
}

/* The same archive as a zip infinite-mac already knows how to unpack.

   Its `uploadsFromFile` checks two conventions before anything else, and the
   first is its own: a .zip with `.rsrc/` and `.finf/` directories AT THE ROOT
   -- Basilisk II's ExtFS layout. The data fork is the plain entry, the
   resource fork is the same name under `.rsrc/`, and `.finf/` carries 32 bytes
   of Finder info. Both forks and the file's type and creator survive, which a
   bare data fork cannot manage and which is the whole reason the disk image
   exists.

   Why bother when the disk image works: size. Measured on the real forks,
   6.86 MB of data deflates to 3.62 MB, against 7.9 MB as a disk image -- less
   than half, which on a phone is the difference between fine and annoying. It
   also keeps the HFS writer, and its modal desktop-file alert, off this path
   entirely.

   What it does NOT do is arrive somewhere the Finder can reach in one step:
   the contents land in The Outside World, under Downloads, in a folder named
   after the zip. That is why the installer for this route is typed rather than
   opened -- the retired mobile shell's script searches for the folder instead of
   navigating to it. */
function finderInfoBytes(type, creator) {
  // FInfo is 16 bytes -- type, creator, flags, location, folder -- and FXInfo
  // is another 16, which the Finder is happy to receive as zeroes.
  const b = new Uint8Array(32);
  const put4 = (at, s4) => { for (let i = 0; i < 4; i++) b[at + i] = (s4 || '    ').charCodeAt(i) & 0xFF; };
  put4(0, type); put4(4, creator);
  return b;
}

async function buildForkZip() {
  if (!ARCHIVE) return null;
  const f = window.ARCHIVE_FINDER || { name: DISK_ARCHIVE_NAME, type: 'DelS', creator: 'Delv' };
  const archiveName = (f.name || DISK_ARCHIVE_NAME).replace(/\.(hqx|data|bin|dsk|zip)$/i, '')
                      || DISK_ARCHIVE_NAME;
  const rsrc = window.CYTHERA_RSRC_RAW || new Uint8Array(0);
  const entries = [
    { name: archiveName, bytes: ARCHIVE.bytes },
    { name: '.rsrc/' + archiveName, bytes: rsrc },
    { name: '.finf/' + archiveName, bytes: finderInfoBytes(f.type, f.creator) },
  ];
  return { blob: await buildZipDeflated(entries), archiveName: archiveName,
           forkWarning: missingForkWarning(rsrc) };
}

/* buildZip in js/mac-export.js is store-only and says why: the galleries it
   was written for hold PNGs and WAVs, which barely compress. A Delver archive
   is the opposite -- it halves -- so this one deflates where the browser can,
   and falls back to the stored zip where it cannot. JSZip, which is what
   reads this on the other side, takes either. */
async function buildZipDeflated(entries) {
  if (typeof CompressionStream === 'undefined') return buildZip(entries);
  try {
    const out = [];
    for (const e of entries) {
      const cs = new CompressionStream('deflate-raw');
      const deflated = new Uint8Array(await new Response(
        new Blob([e.bytes]).stream().pipeThrough(cs)).arrayBuffer());
      out.push({ name: e.name, bytes: e.bytes, deflated: deflated });
    }
    return buildZip(out);
  } catch (err) {
    return buildZip(entries);
  }
}

async function downloadEditedForkZip() {
  const built = await buildForkZip();
  if (!built) return;
  dlBlob(built.blob, ZIP_FOLDER_NAME + '.zip');
  const size = fmtBytes(built.blob.size);
  if (built.forkWarning) {
    setStatus('Wrote a ' + size + ' zip, but ' + built.forkWarning, true);
    return;
  }
  setStatus('Wrote a ' + size + ' zip with both forks, less than half the size of the disk ' +
    'image. Emulators that unpack the Basilisk II layout, including infinitemac.org, accept it as an upload.');
}

function downloadEditedDiskImage() {
  const built = buildEditedDiskImage();
  if (!built) return;
  dlBlob(new Blob([built.image], { type: 'application/octet-stream' }), built.fileName);
  if (built.forkWarning) {
    setStatus('Wrote a ' + fmtBytes(built.image.length) + ' disk image, but ' + built.forkWarning, true);
    return;
  }
  setStatus('Wrote a ' + fmtBytes(built.image.length) + ' disk image. Drop it on an emulated Mac: ' +
    'it mounts as \u201c' + DISK_VOLUME_NAME + '\u201d and contains an Install and Play script that replaces the ' +
    'file in the game\u2019s folder and starts Cythera.');
}

// General MIDI program names (1-128), used to label decoded QTMA parts.
const GM_NAMES = ("Acoustic Grand Piano,Bright Acoustic Piano,Electric Grand Piano,Honky-tonk Piano,"+
"Electric Piano 1,Electric Piano 2,Harpsichord,Clavi,Celesta,Glockenspiel,Music Box,Vibraphone,"+
"Marimba,Xylophone,Tubular Bells,Dulcimer,Drawbar Organ,Percussive Organ,Rock Organ,Church Organ,"+
"Reed Organ,Accordion,Harmonica,Tango Accordion,Acoustic Guitar (nylon),Acoustic Guitar (steel),"+
"Electric Guitar (jazz),Electric Guitar (clean),Electric Guitar (muted),Overdriven Guitar,"+
"Distortion Guitar,Guitar harmonics,Acoustic Bass,Electric Bass (finger),Electric Bass (pick),"+
"Fretless Bass,Slap Bass 1,Slap Bass 2,Synth Bass 1,Synth Bass 2,Violin,Viola,Cello,Contrabass,"+
"Tremolo Strings,Pizzicato Strings,Orchestral Harp,Timpani,String Ensemble 1,String Ensemble 2,"+
"SynthStrings 1,SynthStrings 2,Choir Aahs,Voice Oohs,Synth Voice,Orchestra Hit,Trumpet,Trombone,"+
"Tuba,Muted Trumpet,French Horn,Brass Section,SynthBrass 1,SynthBrass 2,Soprano Sax,Alto Sax,"+
"Tenor Sax,Baritone Sax,Oboe,English Horn,Bassoon,Clarinet,Piccolo,Flute,Recorder,Pan Flute,"+
"Blown Bottle,Shakuhachi,Whistle,Ocarina,Lead 1 (square),Lead 2 (sawtooth),Lead 3 (calliope),"+
"Lead 4 (chiff),Lead 5 (charang),Lead 6 (voice),Lead 7 (fifths),Lead 8 (bass + lead),"+
"Pad 1 (new age),Pad 2 (warm),Pad 3 (polysynth),Pad 4 (choir),Pad 5 (bowed),Pad 6 (metallic),"+
"Pad 7 (halo),Pad 8 (sweep),FX 1 (rain),FX 2 (soundtrack),FX 3 (crystal),FX 4 (atmosphere),"+
"FX 5 (brightness),FX 6 (goblins),FX 7 (echoes),FX 8 (sci-fi),Sitar,Banjo,Shamisen,Koto,Kalimba,"+
"Bag pipe,Fiddle,Shanai,Tinkle Bell,Agogo,Steel Drums,Woodblock,Taiko Drum,Melodic Tom,"+
"Synth Drum,Reverse Cymbal,Guitar Fret Noise,Breath Noise,Seashore,Bird Tweet,Telephone Ring,"+
"Helicopter,Applause,Gunshot").split(",");

/* ============================================================
   QTMA (QuickTime Music Architecture) -> Standard MIDI File
   Bit-field layout taken verbatim from Apple's QuickTimeMusic.h
   (Universal Interfaces 3.3.1). Durations are in milliseconds;
   pitch maps directly to MIDI key numbers.
   ============================================================ */
const QTMA = {
  RestEventType:0, NoteEventType:1, ControlEventType:2, MarkerEventType:3,
  XNoteEventType:0x9, XControlEventType:0xA, GeneralEventType:0xF,
  EventLengthFieldPos:30, EventLengthFieldWidth:2,
  EventTypeFieldPos:29, EventTypeFieldWidth:3,
  XEventTypeFieldPos:28, XEventTypeFieldWidth:4,
  EventPartFieldPos:24, EventPartFieldWidth:5,
  XEventPartFieldPos:16, XEventPartFieldWidth:12,
  RestDurPos:0, RestDurWidth:24,
  NotePitchPos:18, NotePitchWidth:6, NotePitchOffset:32,
  NoteVolPos:11, NoteVolWidth:7,
  NoteDurPos:0, NoteDurWidth:11,
  XNotePitchPos:0, XNotePitchWidth:16,
  XNoteDurPos:0, XNoteDurWidth:22,
  XNoteVolPos:22, XNoteVolWidth:7,
  CtlControllerPos:16, CtlControllerWidth:8,
  CtlValuePos:0, CtlValueWidth:16,
  MarkerSubtypePos:16, MarkerSubtypeWidth:8,
  MarkerValuePos:0, MarkerValueWidth:16,
  GeneralSubtypePos:16, GeneralSubtypeWidth:14,
  GeneralLengthPos:0, GeneralLengthWidth:16,
  GeneralEventNoteRequest:1,
  MarkerEventEnd:0,
  EndMarkerValue:0x60000000
};
// QTMA controller numbers are NOT MIDI CC numbers.
const QTC = { ModWheel:1, Breath:2, Foot:4, Volume:7, Balance:8, Pan:10,
  Expression:11, PitchBend:32, AfterTouch:33, PartTranspose:40,
  TuneTranspose:41, Sustain:64, Portamento:65, Sostenuto:66, SoftPedal:67,
  Reverb:91, Tremolo:92 };

function qEXT(val, pos, width){ return (val >>> pos) & ((width>=32)?0xFFFFFFFF:((1<<width)-1)); }
function qEventType(x){
  const t = qEXT(x, QTMA.EventTypeFieldPos, QTMA.EventTypeFieldWidth);
  return (t>3) ? qEXT(x, QTMA.XEventTypeFieldPos, QTMA.XEventTypeFieldWidth) : t;
}
function qEventLenLongs(words, i){
  const x = words[i];
  const ext = qEXT(x, QTMA.EventLengthFieldPos, QTMA.EventLengthFieldWidth);
  if (ext !== 3) return (ext === 2) ? 2 : 1;
  return qEXT(x, QTMA.GeneralLengthPos, QTMA.GeneralLengthWidth);
}
function qExtractGmFromNoteReq(bytes){
  // NoteRequest = NoteRequestInfo(8) + ToneDescription(76);
  // gmNumber is the last long of ToneDescription.
  if (bytes.length < 8+76) return null;
  const o = 8+72;
  const gm = u32be(bytes, o);
  return (gm>=0 && gm<=128) ? gm : null;
}
function qParseTune(words){
  const events = [], noteRequests = {};
  let t = 0, i = 0;
  const n = words.length;
  let guard = 0;
  while (i < n && guard++ < 500000) {
    const x = words[i];
    if (x === QTMA.EndMarkerValue) break;
    const ln = qEventLenLongs(words, i);
    if (ln <= 0 || i + ln > n) break;
    const et = qEventType(x);
    if (et === QTMA.RestEventType) {
      t += qEXT(x, QTMA.RestDurPos, QTMA.RestDurWidth);
    } else if (et === QTMA.NoteEventType) {
      events.push({t, k:'note',
        part: qEXT(x, QTMA.EventPartFieldPos, QTMA.EventPartFieldWidth),
        pitch: qEXT(x, QTMA.NotePitchPos, QTMA.NotePitchWidth) + QTMA.NotePitchOffset,
        vol: qEXT(x, QTMA.NoteVolPos, QTMA.NoteVolWidth),
        dur: qEXT(x, QTMA.NoteDurPos, QTMA.NoteDurWidth)});
    } else if (et === QTMA.XNoteEventType) {
      const w1 = words[i], w2 = words[i+1];
      events.push({t, k:'note',
        part: qEXT(w1, QTMA.XEventPartFieldPos, QTMA.XEventPartFieldWidth),
        pitch: qEXT(w1, QTMA.XNotePitchPos, QTMA.XNotePitchWidth),
        vol: qEXT(w2, QTMA.XNoteVolPos, QTMA.XNoteVolWidth),
        dur: qEXT(w2, QTMA.XNoteDurPos, QTMA.XNoteDurWidth)});
    } else if (et === QTMA.ControlEventType) {
      events.push({t, k:'ctl',
        part: qEXT(x, QTMA.EventPartFieldPos, QTMA.EventPartFieldWidth),
        ctl: qEXT(x, QTMA.CtlControllerPos, QTMA.CtlControllerWidth),
        val: qEXT(x, QTMA.CtlValuePos, QTMA.CtlValueWidth)});
    } else if (et === QTMA.MarkerEventType) {
      const sub = qEXT(x, QTMA.MarkerSubtypePos, QTMA.MarkerSubtypeWidth);
      const val = qEXT(x, QTMA.MarkerValuePos, QTMA.MarkerValueWidth);
      if (sub === QTMA.MarkerEventEnd && val === 0) break;
    } else if (et === QTMA.GeneralEventType) {
      const w1 = words[i], wlast = words[i+ln-1];
      const part = qEXT(w1, QTMA.XEventPartFieldPos, QTMA.XEventPartFieldWidth);
      const sub = qEXT(wlast, QTMA.GeneralSubtypePos, QTMA.GeneralSubtypeWidth);
      if (sub === QTMA.GeneralEventNoteRequest && ln >= 4) {
        const nb = new Uint8Array((ln-2)*4);
        for (let k=0;k<ln-2;k++){
          const w = words[i+1+k];
          nb[k*4]=(w>>>24)&0xFF; nb[k*4+1]=(w>>>16)&0xFF;
          nb[k*4+2]=(w>>>8)&0xFF; nb[k*4+3]=w&0xFF;
        }
        const gm = qExtractGmFromNoteReq(nb);
        if (gm !== null) noteRequests[part] = gm;
      }
    }
    i += ln;
  }
  return {events, noteRequests};
}
function qVlq(n){
  if (n === 0) return [0];
  const out = [];
  while (n) { out.push(n & 0x7F); n = Math.floor(n/128); }
  out.reverse();
  for (let i=0;i<out.length-1;i++) out[i] |= 0x80;
  return out;
}
function qBuildMidi(events, noteRequests, ticksPerBeat, tempoUs){
  ticksPerBeat = ticksPerBeat || 480;
  tempoUs = tempoUs || 500000;
  const msToTicks = ticksPerBeat / (tempoUs/1000);
  const partSet = new Set();
  events.forEach(e => { if (e.k==='note'||e.k==='ctl') partSet.add(e.part); });
  Object.keys(noteRequests).forEach(p => partSet.add(+p));
  const parts = [...partSet].sort((a,b)=>a-b);
  const chanOf = {};
  let nextCh = 0;
  parts.forEach(p => {
    while (nextCh === 9) nextCh++;      // keep ch10 free for real drums
    if (nextCh > 15) nextCh = 15;
    chanOf[p] = nextCh++;
  });
  const abs = [];
  Object.keys(noteRequests).sort((a,b)=>a-b).forEach(p => {
    const ch = chanOf[p]; if (ch === undefined) return;
    const gm = noteRequests[p];
    const prog = Math.max(0, Math.min(127, gm >= 1 ? gm-1 : 0));
    abs.push([0,0,[0xC0|ch, prog]]);
  });
  events.forEach(e => {
    const ch = chanOf[e.part] || 0;
    const tick = Math.round(e.t * msToTicks);
    if (e.k === 'note') {
      if (e.pitch < 0 || e.pitch > 127) return;
      const v = Math.max(1, Math.min(127, e.vol));
      const off = Math.round((e.t + Math.max(e.dur,1)) * msToTicks);
      abs.push([tick,1,[0x90|ch, e.pitch, v]]);
      abs.push([off,0,[0x80|ch, e.pitch, 0]]);
    } else if (e.k === 'ctl') {
      const sval = e.val >= 0x8000 ? e.val - 0x10000 : e.val;  // signed 16-bit
      const fixed = sval / 256;                                 // 8.8 fixed point
      let msg = null;
      if (e.ctl===QTC.PitchBend || e.ctl===QTC.PartTranspose || e.ctl===QTC.TuneTranspose) {
        let bend = Math.round(8192 + (fixed/2)*8192);
        bend = Math.max(0, Math.min(16383, bend));
        msg = [0xE0|ch, bend & 0x7F, (bend>>7) & 0x7F];
      } else if (e.ctl === QTC.AfterTouch) {
        msg = [0xD0|ch, Math.max(0, Math.min(127, Math.round(fixed)))];
      } else if (e.ctl === QTC.Pan) {
        // header: 0 = "default"; 1..n = position in output 1..n (incl fractions)
        const v = (e.val === 0) ? 64 : Math.max(0, Math.min(127, Math.round((fixed-1)*127)));
        msg = [0xB0|ch, 10, v];
      } else if ([QTC.Volume,QTC.Expression,QTC.ModWheel,QTC.Reverb,QTC.Tremolo,QTC.Breath,QTC.Foot].includes(e.ctl)) {
        msg = [0xB0|ch, e.ctl, Math.max(0, Math.min(127, Math.round(fixed)))];
      } else if ([QTC.Sustain,QTC.Portamento,QTC.Sostenuto,QTC.SoftPedal].includes(e.ctl)) {
        msg = [0xB0|ch, e.ctl, sval > 0 ? 127 : 0];
      }
      // levers / part+tune volume are dropped rather than emitted as bogus CCs
      if (msg) abs.push([tick,0,msg]);
    }
  });
  abs.sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
  const track = [];
  track.push(0x00,0xFF,0x51,0x03,(tempoUs>>16)&0xFF,(tempoUs>>8)&0xFF,tempoUs&0xFF);
  let last = 0;
  abs.forEach(([tick,,data]) => {
    qVlq(Math.max(0, tick-last)).forEach(b=>track.push(b));
    data.forEach(b=>track.push(b));
    last = tick;
  });
  track.push(0x00,0xFF,0x2F,0x00);
  const out = [];
  'MThd'.split('').forEach(c=>out.push(c.charCodeAt(0)));
  out.push(0,0,0,6, 0,0, 0,1, (ticksPerBeat>>8)&0xFF, ticksPerBeat&0xFF);
  'MTrk'.split('').forEach(c=>out.push(c.charCodeAt(0)));
  const L = track.length;
  out.push((L>>>24)&0xFF,(L>>>16)&0xFF,(L>>>8)&0xFF,L&0xFF);
  track.forEach(b=>out.push(b));
  return {midi:new Uint8Array(out), chanOf};
}
function qtmaToMidi(data){
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data.length < 8) throw new Error('Resource too short to be a QTMA tune.');
  const musiLen = dv.getUint32(0);
  const atom = fourcc(data, 4);
  if (atom !== 'musi')
    throw new Error("Not a QTMA 'musi' atom (found '" + atom + "').");
  const toWords = (start, end) => {
    let len = end - start; len -= len % 4;
    const w = new Array(len/4);
    for (let k=0;k<len/4;k++) w[k] = dv.getUint32(start + k*4);
    return w;
  };
  // Tune header holds the NoteRequest general events (per-part instruments).
  const hdr = qParseTune(toWords(8, musiLen));
  const seq = qParseTune(toWords(musiLen, data.length));
  const noteRequests = Object.assign({}, hdr.noteRequests, seq.noteRequests);
  const built = qBuildMidi(seq.events, noteRequests);
  const notes = seq.events.filter(e=>e.k==='note');
  const totalMs = seq.events.length ? Math.max(...seq.events.map(e=>e.t)) : 0;
  return {midi:built.midi, chanOf:built.chanOf, noteRequests,
          noteCount:notes.length, eventCount:seq.events.length, durationSec:totalMs/1000};
}
function downloadCurrentMidi(){
  try {
    const info = qtmaToMidi(window.CUR_RAW_BYTES);
    dlBlob(new Blob([info.midi], {type:'audio/midi'}),
           'cythera_0x' + currentResid.toString(16).toUpperCase() + '.mid');
  } catch(e) {
    // An alert() is a modal interruption for something the page can simply
    // say; every other failure in this file reports through #output.
    document.getElementById('output').textContent = 'MIDI conversion failed: ' + e.message;
  }
}

/* ---------------------------------------------------------------------------
   Where is this art used?
   ---------------------------------------------------------------------------
   Every reference in this archive points one way: a map names the tiles it
   draws, a prop type names its sprite sheet, a composite tile names its
   fragments. Looking at a sheet of artwork and asking "and where does this
   appear?" meant reading 42 maps by hand. This inverts the three tables that
   answer it. It is built on demand rather than at load, because it decrypts
   and walks every map, which is the most expensive scan in the file.
--------------------------------------------------------------------------- */
const sheetResidForTile = t => 0x8E00 + ((t >> 4) & 0xFF);

function buildTileSheetUsage() {
  if (DERIVED.TILE_USAGE) return DERIVED.TILE_USAGE;
  const idx = {};
  const bucket = r => idx[r] || (idx[r] = { maps: [], props: [], composites: [] });

  for (let n = 0; n < subindexCount(ARCHIVE, 127); n++) {
    const mapResid = 0x8000 + n;
    const raw = getResourceBytes(ARCHIVE, mapResid);
    if (!raw) continue;
    let data = smartDecrypt(raw, mapResid).data;
    let m = parseDelverMap(data);
    if (!m) {
      // Same fallback renderMapPreview uses: the entropy heuristic is not
      // reliable on structured map data, so try the other reading.
      const alt = decryptResource(raw, mapResid);
      const m2 = parseDelverMap(alt);
      if (m2) { data = alt; m = m2; }
    }
    if (!m) continue;
    const seen = new Set();
    for (let i = 0; i < m.width * m.height; i++) {
      const o = m.mapDataOffset + i*2;
      const t = u16be(data, o);
      if (t && t < 0x1000) seen.add(sheetResidForTile(t));
    }
    for (const s of seen) bucket(s).maps.push(mapResid);
  }

  const tiles = getPropTileList();
  for (let pt = 0; pt < tiles.length; pt++) {
    const base = tiles[pt];
    if (!base) continue;
    bucket(sheetResidForTile(base)).props.push(pt);
  }

  const comp = getCompositionTableCached();
  for (let i = 0; i < comp.length; i++) {
    const seen = new Set();
    for (const f of comp[i] || []) if (f && f.resid !== undefined) seen.add(f.resid);
    for (const s of seen) bucket(s).composites.push(0x1000 + i);
  }
  return (DERIVED.TILE_USAGE = idx);
}

function usageChips(list, render, limit) {
  const shown = list.slice(0, limit).map(render).join('');
  return shown + (list.length > limit ? '<span class="inspDim"> +' + (list.length - limit) + ' more</span>' : '');
}

function renderArtUsage(resid) {
  const u = buildTileSheetUsage()[resid];
  if (!u || (!u.maps.length && !u.props.length && !u.composites.length))
    return '<span class="inspDim">Nothing in the file draws from this sheet; ' +
           'nothing may use it, or the program may use it rather than data.</span>';
  const rows = [];
  if (u.maps.length) rows.push('<dt>Maps</dt><dd>' + usageChips(u.maps,
    r => svChip(r), 24) + '</dd>');
  if (u.props.length) rows.push('<dt>Prop types</dt><dd>' + usageChips(u.props,
    pt => '<button class="sv-chip" onclick="showPropTypeDetail(' + pt + ')">' +
          svEsc(propDisplayName(pt) || ('0x' + pt.toString(16).toUpperCase())) + '</button>', 24) + '</dd>');
  if (u.composites.length) rows.push('<dt>Composite tiles</dt><dd><span class="inspDim">' +
    u.composites.length + ' stitched tile' + (u.composites.length === 1 ? '' : 's') +
    ' use fragments from this sheet</span></dd>');
  return '<dl class="inspRows">' + rows.join('') + '</dl>';
}

function showArtUsage(resid) {
  const el = document.getElementById('artUsage');
  if (!el) return;
  el.innerHTML = '<span class="inspDim">Reading every map&hellip;</span>';
  // Yield so that note paints before the scan blocks the thread.
  setTimeout(() => { el.innerHTML = linksFold(renderArtUsage(resid)); }, 0);
}

// The same panel for every open resource. Tile sheets keep their map/prop
// census; everything else gets what renderUsage knows -- who wears a
// portrait, who speaks a dialogue, which zone an entry script runs for, which
// scripts play a sound, and what references the resource at all.
/* A landscape strip as the status window shows it, over the sky of a time
   of a day (exeSkyRules, skyScene): outdoors the sky's pattern, the sun and
   the moons, then the strip copied over it with its blank pixels
   transparent; where every script names the strip with no sky, the black
   fill and the strip copied solid (TStatusWindow::ChangeOutdoor). The fore
   and back colours are QuickDraw's; on an 8-bit screen QuickDraw draws the
   nearest entry of the colour table, which is what is drawn here. The sky
   is drawn the strip's own width: if the status window is wider, the game's
   sky goes on past its ends. */
window.SKY_DAY = 0;
window.SKY_QUARTER = null;
function nearestPaletteIndex(rgb) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < PAL_RGB.length; i++) {
    const c = PAL_RGB[i], d = (c[0] - rgb[0]) ** 2 + (c[1] - rgb[1]) ** 2 + (c[2] - rgb[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function paintStripSky(cv, resid, sky, rules, day, quarter) {
  const W = 288, H = 32;
  const idx = new Uint8Array(W * H);
  const fg = nearestPaletteIndex([0, 0, 0]);
  if (sky && rules) {
    const scene = skyScene(rules, day, quarter);
    const rows = QD_PATTERNS[scene.pattern.name];
    const bg = nearestPaletteIndex(QD_OLD_COLOURS[rules.back.v] || [255, 255, 255]);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * W + x] = (rows[y & 7] >> (7 - (x & 7))) & 1 ? fg : bg;
    for (const b of scene.bodies) {
      const img = resolveTileImage(b.tile);
      if (!img) continue;
      for (let ty = 0; ty < 32; ty++) for (let tx = 0; tx < 32; tx++) {
        const x = b.x + tx, y = b.y + ty, v = img[ty * 32 + tx];
        if (v && x >= 0 && y >= 0 && x < W && y < H) idx[y * W + x] = v;
      }
    }
  } else idx.fill(fg);
  let strip = null;
  try { const raw = getResourceBytes(ARCHIVE, resid); if (raw) strip = decodeResource(ARCHIVE, raw, 131, resid); } catch (e) { quiet(e); }
  if (strip && strip.image) for (let y = 0; y < Math.min(H, strip.H); y++) for (let x = 0; x < Math.min(W, strip.W); x++) {
    const v = strip.image[y * strip.W + x];
    if (v || !sky) idx[y * W + x] = v;
  }
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  const im = g.createImageData(W, H);
  for (let i = 0; i < W * H; i++) { const c = PAL_RGB[idx[i]] || [0, 0, 0]; im.data[i * 4] = c[0]; im.data[i * 4 + 1] = c[1]; im.data[i * 4 + 2] = c[2]; im.data[i * 4 + 3] = 255; }
  g.putImageData(im, 0, 0);
}
function buildStripSky(resid) {
  let setters = [];
  try { setters = landscapeZones(resid); } catch (e) { quiet(e); }
  const sky = !setters.length || setters.some(st => st.sky);
  const rules = sky ? exeSkyRules() : null;
  const wrap = document.createElement('div');
  wrap.id = 'stripSky';
  const cv = document.createElement('canvas');
  cv.style.cssText = 'display:block;width:576px;max-width:100%;image-rendering:pixelated;margin:6px 0';
  wrap.appendChild(cv);
  if (sky && !rules) {
    const note = document.createElement('div');
    note.className = 'sv-note';
    note.textContent = 'Open the program to see this strip against the sky at each hour.';
    wrap.appendChild(note);
    paintStripSky(cv, resid, false, null, 0, 0);
    return wrap;
  }
  if (!sky) { paintStripSky(cv, resid, false, null, 0, 0); return wrap; }
  if (window.SKY_QUARTER === null) window.SKY_QUARTER = Math.round((window.MAP_HOUR || 0) * (rules.quarters.v / 24));
  const row = document.createElement('div');
  row.className = 'zoomrow';
  const time = document.createElement('input');
  time.type = 'range'; time.min = '0'; time.max = String(rules.quarters.v - 1); time.value = String(window.SKY_QUARTER);
  time.setAttribute('aria-label', 'Time');
  const lbl = document.createElement('span');
  const day = document.createElement('input');
  day.type = 'number'; day.min = '0'; day.value = String(window.SKY_DAY); day.style.width = '5em';
  day.setAttribute('aria-label', 'Day');
  const per = rules.quarters.v / 24;
  const draw = () => {
    window.SKY_QUARTER = +time.value; window.SKY_DAY = Math.max(0, Math.floor(+day.value || 0));
    const h = Math.floor(window.SKY_QUARTER / per), m = Math.round((window.SKY_QUARTER % per) * 60 / per);
    lbl.textContent = h + ':' + String(m).padStart(2, '0');
    paintStripSky(cv, resid, true, rules, window.SKY_DAY, window.SKY_QUARTER);
  };
  time.addEventListener('input', draw);
  day.addEventListener('input', draw);
  const dl = document.createElement('span'); dl.textContent = 'Day';
  row.appendChild(time); row.appendChild(lbl); row.appendChild(dl); row.appendChild(day);
  wrap.appendChild(row);
  const say = document.createElement('div');
  say.className = 'sv-note';
  const hh = v => Math.floor(v.v / (1 << rules.hourUnit.v)) + ':00';
  say.innerHTML = 'Sunrise ' + srcNum(rules.sunrise, hh(rules.sunrise)) + ', sunset ' + srcNum(rules.sunset, hh(rules.sunset)) + '.';
  wrap.appendChild(say);
  draw();
  return wrap;
}

function updateUsagePanel(resid, subn) {
  const el = document.getElementById('artUsage');
  if (!el) return;
  if (subn === 141) {
    el.style.display = 'block';
    // The panel renders itself: a button that says "click me to find out" was
    // an extra step in front of information that takes ~40ms to build once
    // and is memoised after. First visit shows the building note for one beat.
    if (DERIVED.TILE_USAGE) el.innerHTML = linksFold(renderArtUsage(resid));
    else showArtUsage(resid);
    return;
  }
  let html = '';
  // A script's rows are drawn under its code instead, by buildScriptView.
  if (!SCRIPT_SUBN.has(subn)) try { html = linksFold(renderUsage(resid, subn)); } catch (e) { html = ''; }
  el.innerHTML = html;
  let skyEl = null;
  if (subn === 131) try { skyEl = buildStripSky(resid); } catch (e) { quiet(e, 'the strip over the sky'); }
  if (skyEl) el.insertBefore(skyEl, el.firstChild);
  el.style.display = html || skyEl ? 'block' : 'none';
}

function renderImage() {
  // Stop any cycle left running for the previous resource.
  if (typeof stopPaletteAnimation === 'function') stopPaletteAnimation();
  const subn = window.CUR_SUBN;
  const isText = (subn === 0 || subn === 1 || subn === 128 || subn === 239 || (!CANONICAL_SIZE[subn] && !HAS_HEADER[subn] && !UNCOMPRESSED[subn] && !SOUND_CATEGORIES.has(subn)));
  
  if (SOUND_CATEGORIES.has(subn)) { renderSound(); return; }
  if (subn === 127) { renderMapPreview(); return; }
  if (isText) { renderText(); return; }

  const out = document.getElementById('output');
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid, roff, rlen] = window.CUR_RESIDS[idx];
  try {
    const resData = ARCHIVE.bytes.slice(roff, roff+rlen);
    let {W,H,image} = decodeResource(ARCHIVE, resData, subn, resid);
    if (subn === 141) ({W,H,image} = reshapeTileSheet(W,H,image, window.SHEET_SHAPE || 'grid'));
    const canvas = document.getElementById('canvas');
    document.getElementById('singlePreview').style.display = 'block';
    document.getElementById('zoomControls').style.display = 'block';
    document.getElementById('resourceNav').style.display = 'flex';
    document.getElementById('backToSheet').style.display = 'block';
    refreshUnditherControls();
    drawToCanvas(canvas, W, H, image, transparentIndexFor(subn));
    if (subn === 141) drawSheetGridlines(canvas, W, H, window.SHEET_SHAPE || 'grid');
    if (subn === 141) {
      canvas.style.cursor = 'pointer';
      canvas.title = 'Click a tile to see it on its own';
      canvas.onclick = ev => tileSheetClick(ev, resid);
    } else { canvas.style.cursor = ''; canvas.title = ''; canvas.onclick = null; }
    startPaletteAnimation(canvas, W, H, image, transparentIndexFor(subn));
    // A tile sheet opens fitted to its viewport and cannot be taken past
    // that (the maintainer, 9 September 2026); everything else keeps the
    // old guess. The viewport frames itself gold when it crops (applyZoom).
    const zs = document.getElementById('zoomSlider');
    let z;
    if (subn === 141) {
      const vp = document.getElementById('canvasViewport');
      const fit = (vp && vp.clientWidth > 40 && vp.clientHeight > 40) ? Math.floor(Math.min(vp.clientWidth / W, vp.clientHeight / H)) : autoZoom(W, H);
      z = Math.max(1, Math.min(16, fit));
      zs.max = z;
    } else { zs.max = 16; z = autoZoom(W, H); }
    zs.value = z;
    applyZoom();
    currentResid = resid;
    updateUsagePanel(resid, subn);
    const lbl = labelFor(resid);
    out.textContent = "Rendered resource 0x" + resid.toString(16).toUpperCase() +
      (lbl ? " (" + lbl + ")" : "") + " - " + W + "x" + H + " (zoom " + z + "x)";
  } catch(err) { out.textContent = "Decode error: " + err.message; }
}

// The indexed-PNG writer, the zlib stream and the metadata stripper are in
// js/mac-media.js -- the retired resource fork browser wrote PNGs too, and
// used to do it with canvas.toBlob(), which loses the palette.

/* ---------------------------------------------------------------------------
   GIF, with Cythera's own palette.

   A GIF is the one common format that keeps an indexed palette and can hold
   frames, which is what the game's pictures are: 256 colours, and motion by
   cycling the palette or by turning a sprite. encodeGIF writes GIF89a with a
   global colour table from the first frame and a local one on any frame whose
   palette differs (that is how palette cycling comes out: eight frames of the
   same pixels under eight rotated palettes), a Netscape loop block, and a
   graphic-control extension per frame for the delay and the transparent slot.
   The LZW is the plain variable-code-size encoder the format asks for.
--------------------------------------------------------------------------- */
function gifLZW(indexed, minCodeSize) {
  const clearCode = 1 << minCodeSize, endCode = clearCode + 1;
  let codeSize = minCodeSize + 1, next = endCode + 1;
  let dict = new Map();
  const out = [];
  let acc = 0, nbits = 0;
  const emit = code => {
    acc |= code << nbits; nbits += codeSize;
    while (nbits >= 8) { out.push(acc & 0xFF); acc >>>= 8; nbits -= 8; }
  };
  emit(clearCode);
  let prefix = -1;
  for (let i = 0; i < indexed.length; i++) {
    const k = indexed[i];
    if (prefix < 0) { prefix = k; continue; }
    const key = prefix * 256 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clearCode); dict = new Map(); codeSize = minCodeSize + 1; next = endCode + 1;
    }
    prefix = k;
  }
  if (prefix >= 0) emit(prefix);
  emit(endCode);
  if (nbits > 0) out.push(acc & 0xFF);
  return out;
}
function encodeGIF(W, H, frames, opts) {
  const o = opts || {};
  if (!frames || !frames.length) throw new Error('a GIF needs at least one frame');
  if (!(W > 0 && H > 0)) throw new Error('a GIF needs a size');
  const delay = Math.max(2, Math.round((o.delayMs || 100) / 10));
  const tr = (o.transparentIndex === undefined) ? null : o.transparentIndex;
  const bytes = [];
  const u16 = v => { bytes.push(v & 0xFF, (v >> 8) & 0xFF); };
  const table = pal => { for (let i = 0; i < 256; i++) { const c = pal[i] || [0, 0, 0]; bytes.push(c[0] & 0xFF, c[1] & 0xFF, c[2] & 0xFF); } };
  for (const ch of 'GIF89a') bytes.push(ch.charCodeAt(0));
  u16(W); u16(H);
  bytes.push(0xF7);          // global table, 8 bits, 256 entries
  bytes.push(0, 0);
  const gpal = frames[0].palette;
  table(gpal);
  if (frames.length > 1) {
    bytes.push(0x21, 0xFF, 0x0B);
    for (const ch of 'NETSCAPE2.0') bytes.push(ch.charCodeAt(0));
    bytes.push(3, 1, 0, 0, 0);
  }
  for (const f of frames) {
    bytes.push(0x21, 0xF9, 0x04, (frames.length > 1 ? 0x08 : 0) | (tr !== null ? 1 : 0));   // dispose to background; transparency
    u16(delay); bytes.push(tr !== null ? tr : 0, 0);
    bytes.push(0x2C); u16(0); u16(0); u16(W); u16(H);
    const local = f.palette !== gpal && f.palette.some((c, i) => !gpal[i] || c[0] !== gpal[i][0] || c[1] !== gpal[i][1] || c[2] !== gpal[i][2]);
    bytes.push(local ? 0x87 : 0);
    if (local) table(f.palette);
    bytes.push(8);
    const data = gifLZW(f.indexed, 8);
    for (let i = 0; i < data.length; i += 255) { const n = Math.min(255, data.length - i); bytes.push(n); for (let j = 0; j < n; j++) bytes.push(data[i + j]); }
    bytes.push(0);
  }
  bytes.push(0x3B);
  return new Uint8Array(bytes);
}
// A canvas painted in palette colours, back to indices: an exact match on
// the colour, index 0 (white, the transparent slot) only for see-through
// pixels, and the nearest palette colour for anything a filter moved.
let _palLookup = null;
function canvasToIndexed(canvas) {
  if (!_palLookup) { _palLookup = new Map(); for (let i = 255; i >= 1; i--) { const c = PAL_RGB[i]; _palLookup.set((c[0] << 16) | (c[1] << 8) | c[2], i); } }
  const W = canvas.width, H = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  const out = new Uint8Array(W * H);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    if (d[p + 3] < 128) { out[i] = 0; continue; }
    const k = (d[p] << 16) | (d[p + 1] << 8) | d[p + 2];
    let v = _palLookup.get(k);
    if (v === undefined) {
      let best = 1, bd = Infinity;
      for (let j = 1; j < 256; j++) { const c = PAL_RGB[j]; const dd = (c[0] - d[p]) ** 2 + (c[1] - d[p + 1]) ** 2 + (c[2] - d[p + 2]) ** 2; if (dd < bd) { bd = dd; best = j; } }
      v = best; _palLookup.set(k, v);
    }
    out[i] = v;
  }
  return { W, H, indexed: out };
}
function downloadGIF(W, H, frames, delayMs, filename) {
  const gif = encodeGIF(W, H, frames, { delayMs, transparentIndex: 0 });
  dlBlob(new Blob([gif], { type: 'image/gif' }), filename);
}
// The single view: the picture as it is, or -- where it is a tile sheet the
// game cycles and the animation setting allows -- eight frames of it.
function downloadCurrentGIF() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const name = currentResid ? ('cythera_0x' + currentResid.toString(16).toUpperCase() + '.gif') : 'cythera_image.gif';
  const meta = canvas.__cythIndexed;
  let W, H, image;
  if (meta && meta.image && meta.W > 0) { W = meta.W; H = meta.H; image = meta.image; }
  else { const c = canvasToIndexed(canvas); W = c.W; H = c.H; image = c.indexed; }
  const cycles = window.PALETTE_ANIM && PALETTE_CYCLE_SUBN.has(window.CUR_SUBN) && imageUsesAnimatedColors(image);
  const frames = cycles ? Array.from({ length: 8 }, (_, f) => ({ indexed: image, palette: cycledPalette(f) })) : [{ indexed: image, palette: PAL_RGB }];
  downloadGIF(W, H, frames, 140, name);
}
// A prop's frames, in turn: one canvas per frame at the art's own size.
// opts.delayMs sets the pace -- 700 for a strip of variants, 180 for a walk
// cycle, which is four poses of one facing -- and opts.name the file.
function downloadPropGIF(base, frames, opts) {
  const o = opts || {};
  const cvs = frames.map(f => { const spr = drawPropSprite(base + f, 32); return spr && spr.canvas; }).filter(Boolean);
  if (!cvs.length) return;
  const W = Math.max(...cvs.map(c => c.width)), H = Math.max(...cvs.map(c => c.height));
  const out = cvs.map(c => {
    if (c.width === W && c.height === H) return canvasToIndexed(c);
    const pad = document.createElement('canvas'); pad.width = W; pad.height = H;
    pad.getContext('2d').drawImage(c, 0, H - c.height);
    return canvasToIndexed(pad);
  }).map(x => ({ indexed: x.indexed, palette: PAL_RGB }));
  downloadGIF(W, H, out, o.delayMs || 700, o.name || ('cythera_tile_0x' + base.toString(16).toUpperCase() + '.gif'));
}

/* ---------------------------------------------------------------------------
   A map at the native 32 px a square, on a phone.

   iOS tears the tab down for a canvas the size of the world map (8192 square,
   67 million pixels), so the file used to be the screen's reduced bitmap
   there. The map is now rendered a row of squares at a time into a canvas one
   square tall, and each strip's pixels are fed to a deflate stream as they
   come, so no bitmap of the whole map ever exists: the PNG is written
   truecolour, filter None, and only the compressed bytes are held. The
   terrain, the roofs, the characters and the marks go in; the lighting layer
   does not, since its painter works on the whole map at once.
--------------------------------------------------------------------------- */
async function downloadMapPNGStreamed(cm, TS, name) {
  const W = cm.tilesW, H = cm.tilesH;
  const pw = W * TS;
  const strip = document.createElement('canvas');
  strip.width = pw; strip.height = TS;
  const sc = strip.getContext('2d', { willReadFrequently: true });
  if (!sc) throw new Error('no strip canvas');
  const cs = (typeof CompressionStream !== 'undefined') ? new CompressionStream('deflate') : null;
  if (!cs) throw new Error('no CompressionStream');
  const writer = cs.writable.getWriter();
  const collected = [];
  const readAll = async function () { const rd = cs.readable.getReader(); for (;;) { const { done, value } = await rd.read(); if (done) break; collected.push(value); } };
  const reading = readAll();
  const row = new Uint8Array(1 + pw * 3);
  for (let y = 0; y < H; y++) {
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.fillStyle = '#333'; sc.fillRect(0, 0, pw, TS);
    sc.setTransform(1, 0, 0, 1, 0, -y * TS);
    try { paintMapBaseRegion(sc, TS, 0, y, W - 1, y, cm, 0); } catch (e) { quiet(e); }
    try { if (window.SHOW_ROOFS) drawRoofLayer(sc, TS); } catch (e) { quiet(e); }
    try { if (window.SHOW_CHARACTERS) drawCharacterLayer(sc, TS); } catch (e) { quiet(e); }
    try { drawMapMarks(sc, TS); } catch (e) { quiet(e); }
    const d = sc.getImageData(0, 0, pw, TS).data;
    for (let yy = 0; yy < TS; yy++) {
      row[0] = 0;
      for (let x = 0, p = yy * pw * 4, q = 1; x < pw; x++, p += 4, q += 3) { row[q] = d[p]; row[q + 1] = d[p + 1]; row[q + 2] = d[p + 2]; }
      await writer.ready; writer.write(row.slice());
    }
    if ((y & 15) === 0) { setStatus('Writing the map at full size… ' + Math.round(100 * y / H) + '%'); await new Promise(r => setTimeout(r, 0)); }
  }
  await writer.close();
  await reading;
  let total = 0; for (const c of collected) total += c.length;
  const idat = new Uint8Array(total); let o = 0; for (const c of collected) { idat.set(c, o); o += c.length; }
  const ihdr = new Uint8Array(13); const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, pw); dv.setUint32(4, H * TS); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', new Uint8Array(0))];
  let n = 0; for (const q of parts) n += q.length;
  const out = new Uint8Array(n); o = 0; for (const q of parts) { out.set(q, o); o += q.length; }
  setStatus('Map written at ' + pw + '×' + (H * TS) + '.');
  dlBlob(new Blob([out], { type: 'image/png' }), name);
}

function downloadCurrentPNG() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const name = currentResid ? ('cythera_0x' + currentResid.toString(16).toUpperCase() + '.png') : 'cythera_image.png';
  triggerPNGDownload(canvas, name);
}

// iOS Safari (and some other mobile browsers) will silently no-op a
// synthetic <a download> click, or just navigate to the data: URI in the
// current tab, unless the anchor is actually attached to the document
// when .click() fires. Also prefer a blob: URL over a raw data: URI --
// Safari's download handling of blob URLs is far more reliable, especially
// for larger images like full world maps.
//
// Two paths out of here. If the canvas still carries its palette indices
// (drawToCanvas stashes them), the image is
// written as an indexed PNG with Cythera's CLUT in a PLTE chunk and nothing
// else attached. Otherwise -- a composited map, say -- fall back to
// canvas.toBlob() and strip the metadata the browser added.
function triggerPNGDownload(canvas, filename) {
  // The blob paths go through dlBlob (js/mac-export.js), which is where the
  // attach-then-click and the delayed revoke now live. Only the data: URI
  // fallback -- a canvas with no toBlob at all -- still builds its own anchor,
  // because there is no blob to hand over.
  const dataUri = (href) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = href;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };
  const send = (bytes) => dlBlob(new Blob([bytes], { type: 'image/png' }), filename);
  const fallback = () => {
    if (!canvas.toBlob) { dataUri(canvas.toDataURL('image/png')); return; }
    canvas.toBlob((blob) => {
      if (!blob) { dataUri(canvas.toDataURL('image/png')); return; }
      blob.arrayBuffer()
        .then((buf) => send(stripPngMetadata(new Uint8Array(buf))))
        .catch(() => dlBlob(blob, filename));
    }, 'image/png');
  };
  const meta = canvas && canvas.__cythIndexed;
  if (meta && meta.image && meta.W > 0 && meta.H > 0) {
    encodeIndexedPNG(meta.W, meta.H, meta.image, meta.palette, meta.transparentIndex)
      .then(send)
      .catch(fallback);
  } else {
    fallback();
  }
}

// Was building its own anchor with a data: URI and never attaching it, which
// is exactly the combination iOS silently drops. Route it through the same
// path as everything else so grid saves are indexed PNGs too.
function downloadCanvasAsPNG(canvas, resid) {
  triggerPNGDownload(canvas, 'cythera_0x' + resid.toString(16).toUpperCase() + '.png');
}

// Decode enough of a text/data resource to identify it at a glance.
// A run of readable bytes that is worth showing a reader. Symbol names,
// opcode soup and single words with no vowels are not: they fill the tile with
// something that looks like text and says nothing.
function snippetWorth(run) {
  const t = run.trim();
  if (t.length < 6) return 0;
  // Mac Roman decoding (js/mac-bytes.js) turns the archive's high bytes into
  // real accented letters and curly punctuation, so the letter test has to
  // count them -- otherwise every line of Cythera's own prose that happens to
  // carry an accent scores as though it were half punctuation.
  const letters = (t.match(/[A-Za-z\u00C0-\u024F]/g) || []).length;
  if (letters / t.length < 0.6) return 0;
  const words = t.split(/\s+/).filter(w => w.length > 1);
  let score = letters;
  if (words.length >= 3) score *= 3;               // reads as a sentence
  else if (words.length === 2) score *= 1.5;
  if (/[.!?]/.test(t)) score *= 1.4;               // punctuated prose
  if (/^[A-Z][a-z]/.test(t)) score *= 1.2;
  if (/^[a-z_][A-Za-z0-9_]*$/.test(t)) score *= 0.2;   // an identifier
  if (/_/.test(t)) score *= 0.5;
  return score;
}

/* A script's row in a Functions gallery says its class and what its code
   calls: { cls: 'AITest', calls: ['GetSkill', 'Monster', 'ArrayIterator'] }.
   The dispatch table's names were tried first and are the same on every
   script of a class ("Look, Examine, Use" across all 87 skills), so they do
   not tell one row from the next; what a script calls does. Read off the
   folded listing, which names the calls, in the order the code first makes
   them. A cast (`Character(Arg01)`) is spelt like a call there and is
   counted as one. */
const OUTLINE_NOT_CALLS = new Set(['if', 'while', 'switch', 'return', 'print', 'function', 'not', 'len']);
function scriptOutline(resid, roff, rlen) {
  const raw = ARCHIVE.bytes.slice(roff, roff + rlen);
  const { data } = smartDecrypt(raw, resid);
  const cls = dvmClassName(resid) || '';
  // A named script's body is not bytecode, and folding it invents calls;
  // renderText refuses to disassemble one for the same reason.
  if (dvmNamedScript(data)) return { cls, calls: [] };
  const text = dvmFoldRender(ARCHIVE, data, resid) || '';
  const calls = [];
  for (const line of text.split('\n')) {
    if (!/^    [0-9A-F]{4}  /.test(line)) continue;
    // The code, not the comment a line may end in (dvmFoldNote).
    for (const m of line.split('   // ')[0].slice(10).matchAll(/(?:^|[^\w.])([A-Za-z_]\w*|0x[0-9A-Fa-f]{3,4})(?=\()/g))
      if (!OUTLINE_NOT_CALLS.has(m[1]) && calls.indexOf(dvmSyscallShown(m[1])) < 0) calls.push(dvmSyscallShown(m[1]));
  }
  return { cls, calls };
}

function sheetTextSnippet(resid, roff, rlen, limit) {
  limit = limit || 150;
  // A string object picks up the odd opcode byte at either end -- the same
  // off-by-two the skill names hit (see normalizeLabel). At the front it shows
  // as a stray '@' or 'P' before the quotation mark; at the back, now that the
  // bytes decode as Mac Roman rather than vanishing into C1 controls, it shows
  // as a lone accented capital after the final stop ("...proud demeanor.*Ç").
  // Both are dropped only in those exact positions, and only for display: the
  // Strings and Hex tabs still show the raw bytes. The back one came from
  // dvmStringObjects reading a string to its NUL, past the return's opcode;
  // since v1.194.1 it stops where dvmProseHead does, no string in the shipped
  // archive ends in such a byte, and the rule is kept for a modded one.
  const tidy = t => t.replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ')
                     .replace(/^[\x40-\x50](?=["'*\u2018\u201c])/, '')
                     .replace(/^@(?=[A-Za-z])/, '')
                     .replace(/([.!?*"'\u201d])[\u0080-\u00FF]$/, '$1')
                     .replace(/\*$/, '')
                     .trim();
  // Cut on a word boundary. A snippet used to stop wherever the character
  // count ran out, which in a 150-character box meant most tiles ended in the
  // middle of a word.
  const clip = t => {
    if (t.length <= limit) return t;
    const cut = t.slice(0, limit);
    const sp = cut.lastIndexOf(' ');
    return (sp > limit * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\u2014-]+$/, '') + '\u2026';
  };
  try {
    const raw = ARCHIVE.bytes.slice(roff, roff + Math.min(rlen, 4096));
    const { data } = smartDecrypt(raw, resid);
    // Third algorithm for the same job, and it disagreed with the other two:
    // this one collected printable runs and then sorted them BY LENGTH, so a
    // gallery tile showed a resource's text in an order it does not appear in.
    // Container strings first, in file order, same as everywhere else.
    const owned = dvmStringObjects(ARCHIVE, data, resid);
    if (owned.length) {
      const joined = tidy(owned.map(e => e.str).join(' \u00b7 '));
      if (joined) return clip(joined);
    }
    // These resources are structured records with text embedded partway in,
    // so dumping from byte 0 just shows packed binary. Collect the readable
    // runs and show those instead.
    const runs = [];
    let cur = '';
    for (let i = 0; i < data.length; i++) {
      const b = data[i];
      if (b >= 32 && b < 127) cur += String.fromCharCode(b);
      else { if (cur.length >= 4) runs.push(cur); cur = ''; }
    }
    if (cur.length >= 4) runs.push(cur);
    if (!runs.length) return '(binary, ' + rlen + ' bytes)';
    // The old rule was "the six longest runs, longest first", which put the
    // resource's text in an order it does not appear in and led with whatever
    // symbol name happened to be longest. Score every run for how much it
    // reads like something a person wrote, keep the ones that clear the bar,
    // and show them IN FILE ORDER.
    const scored = runs.map((r, i) => ({ r, i, s: snippetWorth(r) }));
    const best = scored.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6);
    if (!best.length) {
      const longest = runs.slice().sort((a, b) => b.length - a.length)[0];
      const t = tidy(longest);
      return t.length >= 6 ? clip(t) : '(binary, ' + rlen + ' bytes)';
    }
    best.sort((a, b) => a.i - b.i);
    return clip(tidy(best.map(x => x.r).join(' \u00b7 '))) || '(binary, ' + rlen + ' bytes)';
  } catch (e) { return '(' + rlen + ' bytes)'; }
}

function attachMapThumb(canvas, resid) {
  // One shared observer for the whole grid; this used to create its own per
  // tile, so a 42-map gallery held 42 of them.
  lazyTile(canvas, () => {
    {
      try {
        const raw = getResourceBytes(ARCHIVE, resid);
        if (!raw) return;
        const { data } = smartDecrypt(raw, resid);
        const result = renderMapVisual(resid, data);
        if (!result) return;
        const src = result.canvas;
        const scale = Math.min(84 / src.width, 110 / src.height);
        canvas.width = Math.max(1, Math.round(src.width * scale));
        canvas.height = Math.max(1, Math.round(src.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
        src.width = src.height = 0;   // release the big backing store
      } catch (e) { /* leave the tile blank */ }
    }
  });
}

// Paint resource 0x8F00 to an offscreen canvas and hand the result to CSS as
// a data: URL. The wallpaper then comes from the same file as everything else
// on screen rather than from a copy checked into the repo.
function installBackgroundTexture() {
  try {
    // A saved game has no tiles, nor has a patch; the wallpaper already on
    // the page stays. Until 28 September 2026 the missing resource went on
    // to decodeResource, and every save opened on its own left a quiet
    // failure under Tools.
    const raw = getResourceBytes(ARCHIVE, 0x8F00);
    if (!raw) return;
    const r = decodeResource(ARCHIVE, raw, 142);
    if (!r || !r.W) return;
    const c = document.createElement('canvas');
    drawToCanvas(c, r.W, r.H, r.image, null);
    const url = c.toDataURL('image/png');
    document.body.style.backgroundImage =
      'linear-gradient(rgba(14,10,6,.62),rgba(20,15,9,.62)), url(' + url + ')';
    document.body.style.backgroundRepeat = 'repeat';
    document.body.style.backgroundSize = 'auto, ' + (r.W * 2) + 'px';
  } catch (e) { quiet(e); }
}

function refreshLabelLegend() {
  const el = document.getElementById('labelLegend');
  // The legend for the "wiki" tag. It used to explain a dagger and was itself
  // hidden by a `display:none !important` in the stylesheet, so the dagger had
  // no explanation anywhere on the page -- which is the whole reason to be rid
  // of it. Only a name actually being shown needs explaining: the dashed
  // "name hidden" tag explains itself and carries its own tooltip, and the
  // sound gallery no longer needs a clause of its own, because with
  // tool-supplied names off it prints "Sound 12", which is generic numbering
  // rather than a claim about what the sound is.
  // Inside the gallery only: the legend carries a .guessTag of its own as
  // its example, so a document-wide query found it and the legend, once
  // shown, never went away -- it sat above the Tools tab and the Changes tab.
  const tagged = !!document.querySelector('#sheetGrid .guessTag');
  if (el) el.style.display = tagged ? 'block' : 'none';
}
