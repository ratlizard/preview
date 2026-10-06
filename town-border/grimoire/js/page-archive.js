/* Opening an archive, the caches keyed to it, deep links and going back.

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
   last of these. File 4 of 14. */

/* ---------------------------------------------------------------------------
   Getting the archive open
   ---------------------------------------------------------------------------
   There used to be exactly one way in: fetch one hardcoded raw.githubusercontent
   URL. No network meant no app, and the file that ships beside this one --
   `sources/Cythera Data.hqx` -- could not be opened by hand either, because a
   BinHex file is ASCII and the ASCII went straight into parseArchiveBytes.

   Now anything that plausibly contains the archive is unwrapped first
   (extractDelverArchive), and there are four ways in, all ending in the same
   place:
     * whatever last worked, kept in IndexedDB   -> instant, and works offline
     * a relative path beside this HTML          -> when it is served, not file://
     * the GitHub copy, streamed with progress
     * a file picked or dropped: .hqx, MacBinary, AppleSingle/Double, or raw
   A file that is not the archive is now named as what it actually is rather
   than parsed into nonsense.
--------------------------------------------------------------------------- */

// Every derived table is keyed to the archive that is open, so loading a
// different (or modded) Cythera Data has to drop the lot. The list used to be
// written out inline in parseArchiveBytes and had drifted: nine caches were
// missing from it, including the tile bitmaps, the character table and the
// schedules -- so a second archive was drawn with the first one's sprites and
// populated with the first one's people. Anything memoised belongs here.
/* The page's open file, ARCHIVE, is declared at the top of js/page-labels.js
   beside the tables that hang off it, and assigned in parseArchiveBytes below
   and nowhere else. */

function resetDerivedCaches() {
  // The tables live on the archive now (DERIVED, js/page-labels.js) and
  // went with the old object; one of them is read as a list before anything
  // fills it, so it starts as one.
  DERIVED.ATLAS_BELOW = [];
  // The decoded-resource cache and the application's fork are both keyed to
  // the file that is open, so a different archive has to drop them too.
  if (typeof _rsrcArtifactCache !== 'undefined') _rsrcArtifactCache.clear();
  window.APP_RSRC = null;
  window.APP_RSRC_RAW = null;
  window.APP_DATA = null;
  window.APP_PEF = null;
  window.APP_RSRC_STATE = '';
  window.RSRC_SOURCE = 'data';
  window.MAP_VIEW_MEMORY = Object.create(null);
  window.MAP_SEL_MEMORY = Object.create(null);
  window.MAP_SEL = null;
  atlasNameCounts = null;
  atlasWaterCache = null;
  atlasTilesClear();
  atlasFolkCache.clear();
  _faceCache.clear();
  atlasTransforms.clear();
  belowScenes.clear();
  locatedCache.clear();
  surfaceCache.clear();
  window.PATCH_REPORT = null;
  window.PATCH_BYTES = null;
  window.COMPARE_REPORT = null;
  window.COMPARE_APP = null;
  window.SAVE_BESIDE = null;
  window.CUR_MAP = null;
  // Not a memoisation, but keyed to the open file all the same: which
  // resources this session has edited. applyResourceEdit carries it across
  // its own rebuild by hand; any other arrival here is a different archive
  // and the dirty list must not outlive the bytes it described.
  window.EDITED_RESIDS = new Set();
  /* The tables js/delv-*.js build from the archive -- the portrait corpus
     and the frame locks, the undithered images, the tile attributes, the
     resource symbols, the string objects -- are not here. They live on the
     archive object itself (derivedTable in js/delv-archive.js) and went with
     the old one the moment ARCHIVE was reassigned; this list is the page's
     own tables, and grows only when the page builds a new one. */
  // CYTHERA_RSRC is not reset here: it is set from the container by
  // parseArchiveBytes immediately after this runs, and clearing it afterwards
  // would throw the fork away every load.
  _propTileListCache = null; _propOffXCache = null;
  _propOffYCache = null; _compTableCache = null;
  for (const k of Object.keys(tileSheetCache)) delete tileSheetCache[k];
  _fauxPropCache = null;
  for (const k of Object.keys(_tileImageCache)) delete _tileImageCache[k];
  // Named and drawn from the archive too, and missed here until 16 September
  // 2026: an applied patch kept the shipped art on the relation chips and the
  // zone backdrops until a reload.
  _propTextShape.clear();
  _atlasTextW.clear();
}

// The one status line this page has: the small text under the nav bar, and the
// only place a load failure or a download's progress is reported.
//
// This function was accidentally deleted during the js/ extraction, because it
// sat between fmtBytes and u32be and the cut ran from one to the other. Nothing
// noticed for several sessions: every harness hands the archive straight to
// parseArchiveBytes or adoptArchive, so none of them ever ran the code that
// loads one, and setStatus is only reached while loading or when a load fails.
// In a browser it was fatal -- loadDefaultArchive calls it before each attempt,
// so every candidate URL "failed", and archiveLoadFailed then called it outside
// any try and threw. utilities/loader_test.mjs now drives that path.
function setStatus(msg, failed) {
  const ss = document.getElementById('sourceStatus');
  if (!ss) return;
  ss.textContent = msg;
  ss.classList.toggle('failed', !!failed);
}

// --- Remembering the archive between visits --------------------------------
// IndexedDB is refused on some file:// origins, so every call degrades to a
// no-op rather than blocking the load.
const ARCHIVE_DB = 'cythera-viewer', ARCHIVE_STORE = 'archive', ARCHIVE_KEY = 'current';
/* A second object store, 'handoff', is created alongside the archive's. It
   carried an exported disk to the mobile shell that is now retired to
   ratlizard/alchemy; the store stays declared so that a browser already at
   database version 2 upgrades cleanly, and nothing writes to it. */
const HANDOFF_STORE = 'handoff', HANDOFF_KEY = 'disk', ARCHIVE_DB_VERSION = 2;
function idbOpen() {
  return new Promise((resolve, reject) => {
    let req;
    try { req = indexedDB.open(ARCHIVE_DB, ARCHIVE_DB_VERSION); }
    catch (e) { reject(e); return; }
    // Version 1 had only the archive store, and a visitor who has been here
    // before is still on it. Creating each store only when it is absent means
    // an upgrade from either version arrives at the same shape.
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) db.createObjectStore(ARCHIVE_STORE);
      if (!db.objectStoreNames.contains(HANDOFF_STORE)) db.createObjectStore(HANDOFF_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB unavailable'));
    req.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}
function idbTx(mode, fn, store) {
  const name = store || ARCHIVE_STORE;
  return idbOpen().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const req = fn(tx.objectStore(name));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  }));
}
function archiveCacheGet() { return idbTx('readonly', s => s.get(ARCHIVE_KEY)); }
function archiveCachePut(rec) { return idbTx('readwrite', s => s.put(rec, ARCHIVE_KEY)); }
function archiveCacheClear() {
  return idbTx('readwrite', s => s.delete(ARCHIVE_KEY))
    .then(() => { setStatus('Remembered copy cleared. Reloading…'); location.reload(); })
    .catch(() => setStatus('There was nothing remembered to clear.'));
}

async function fetchWithProgress(url, label) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = +(res.headers.get('content-length') || 0);
  if (!res.body || !res.body.getReader) return new Uint8Array(await res.arrayBuffer());
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0, painted = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    const now = performance.now();
    if (now - painted > 120) {
      painted = now;
      setStatus(label + ', ' + fmtBytes(got) +
        (total ? ' of ' + fmtBytes(total) + ' (' + Math.round(got/total*100) + '%)' : ''));
    }
  }
  const out = new Uint8Array(got);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

let lastArchiveError = '';
// The default is the whole game, not the data file: the 1.0.4 installer, an
// Installer VISE application. One 6.8 MB download and every file the game
// shipped with is in the page -- Cythera Data with both forks, the
// application (so the Cythera › Resource Fork tab needs no second fetch),
// the Combat AI scripts and their rules document, the licence and the notes,
// the documentation and the screenshots -- listed under Data › Installer.
// js/mac-vise.js opens it and extractDelverArchive picks the 'DelS' file
// out; the extracted Cythera Data is byte-identical to the .hqx the page
// used to want (vise_check.mjs proves it on every run), so nothing
// downstream changed.
//
// The repository still carries no copy of the game -- Cythera is Ambrosia
// Software / Glenn Andreas's, and what is on disk lives under reference/,
// gitignored. These URLs are other people's hosting, tried in order:
//
//   1. archive.org's copy (tucows_205568_Cythera), a StuffIt 5 archive with
//      the installer's data fork stored uncompressed, which mac-stuffit.js
//      takes out. Through archive.org's /cors/ path, not /download/: the
//      same bytes, but that path answers with Access-Control-Allow-Origin
//      and the other does not. This is the one that works from
//      ratlizard.github.io today.
//   2. Bryce Schroeder's Cythera.bin, a MacBinary of the same installer.
//      As of 2 September 2026 his server sends no CORS header, so a browser
//      discards the response; it is kept for the day it does, and it is the
//      right file to download by hand and drop on the page.
//
// If both fail the page asks for the file, naming the first URL.
//   0. Before either: archive.org's "Cythera installers" item, one StuffIt 5
//      archive holding the 1.0.1, 1.0.2, 1.0.3 and 1.0.4 installers side by
//      side, every data fork stored. Four times the download (28 MB) and
//      every version of the game in one file: the page opens the newest and
//      Data › Installer switches between them.
const REMOTE_ARCHIVE_URLS = [
  'https://archive.org/cors/cythera-installers/Cythera%20installers.sit',
  'https://archive.org/cors/tucows_205568_Cythera/cythera.sit',
  'https://www.bryce.pw/Cythera.bin'
];
const DEFAULT_ARCHIVE_URL = REMOTE_ARCHIVE_URLS[0];
// Relative first: served from the repo the real thing is right there, and a
// local copy beats downloading the same bytes. Under file:// these all fail
// instantly (the browser refuses cross-file fetches) and the list costs
// nothing. The bare "Cythera Data" names stay last for anyone who has a data
// fork of their own lying beside the page; they open, minus the resource fork.
const LOCAL_ARCHIVE_CANDIDATES = [
  'reference/game/installers/Cythera installers (archive.org).sit',
  'Cythera.bin', 'reference/game/installers/Cythera.bin',
  'reference/game/installers/Cythera_1.0.4_Installer.sit',
  'Cythera Data.hqx', 'reference/game/Cythera Data.hqx', 'res/Cythera Data.hqx',
  'Cythera Data', 'reference/Cythera Data', 'res/Cythera Data'
];

// One stud in the top-left corner holds everything about the data file:
// where it came from, how to open another, how to forget the remembered copy,
// and whether this tool's own names are shown. Those used to be a status line
// at the top, a hairline link in the bottom-right corner and a link that only
// appeared when the archive happened to be cached.
function openArchiveMenu(on) {
  const menu = document.getElementById('archiveMenu');
  const btn = document.getElementById('archiveMenuBtn');
  if (!menu) return;
  menu.classList.toggle('open', !!on);
  if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
}
function toggleArchiveMenu() {
  const menu = document.getElementById('archiveMenu');
  const on = menu && !menu.classList.contains('open');
  closeTopPanels();
  openArchiveMenu(on);
}
/* Three panels hang under the top row -- Settings, Search, Credits -- and
   one is open at a time; a click anywhere else shuts it. */
function closeTopPanels() {
  openArchiveMenu(false);
  closeSearch();
  const c = document.getElementById('creditsMenu');
  if (c) c.classList.remove('open');
  const k = document.getElementById('creditsCaret');
  if (k) k.classList.remove('open');
}
function toggleCredits() {
  const c = document.getElementById('creditsMenu');
  if (!c) return;
  const on = !c.classList.contains('open');
  closeTopPanels();
  c.classList.toggle('open', on);
  /* The panel is as wide as the page allows and right-aligned, so on its own
     it reads as hanging off the right edge rather than off the word that
     opened it. The caret is put under the middle of that word, measured, so
     the word stays where it is and the panel points at it. */
  const k = document.getElementById('creditsCaret'), b = document.getElementById('creditsLink');
  if (k && b && on) {
    k.classList.add('open');
    const host = (k.offsetParent || document.documentElement).getBoundingClientRect();
    const word = b.getBoundingClientRect(), panel = c.getBoundingClientRect();
    k.style.left = Math.round(word.left + word.width / 2 - host.left - 6) + 'px';
    k.style.top  = Math.round(panel.top - host.top - 6) + 'px';
  }
}
function toggleSearch() {
  const w = document.getElementById('searchWrap');
  if (!w) return;
  const on = w.style.display === 'none';
  closeTopPanels();
  if (on) openSearch();
}
document.addEventListener('click', e => {
  const t = e.target;
  const inside = (id, btn) => {
    const el = document.getElementById(id);
    return (el && el.contains(t)) || (t.closest && t.closest(btn));
  };
  if (inside('archiveMenu', '#archiveMenuBtn') || inside('searchWrap', '#searchLink') || inside('creditsMenu', '#creditsLink')) return;
  closeTopPanels();
});

/* Open another of the Delver archives the same zip or StuffIt file holds,
   from the bytes kept when the file was opened; the Settings menu's chips
   call this. The same shape as switchInstaller. */
function switchContained(name) {
  const c = window.CONTAINED;
  if (!c || !c.raw || name === c.picked) return;
  setStatus('Opening ' + name + '…');
  if (!adoptArchive(c.raw, c.sourceName, { pick: name, store: true, url: c.url || undefined }))
    setStatus('The page could not open ' + name + ': ' + lastArchiveError, true);
}

function adoptArchive(raw, sourceName, opts) {
  opts = opts || {};
  noteMagpieFrom(raw);
  let found;
  try { found = extractDelverArchive(raw, { pick: opts.pick }); }
  catch (err) { lastArchiveError = err.message; return false; }
  // The container carried both forks; the resource fork is the second one, and
  // it used to be decoded and then dropped on the floor.
  const rsrc = (opts.rsrc && opts.rsrc.length) ? opts.rsrc
             : (found.forks && found.forks.rsrc && found.forks.rsrc.length ? found.forks.rsrc : null);
  // The container also said what the file IS -- its Finder name, type and
  // creator. Kept so an edited archive can be re-wrapped as MacBinary with
  // the same identity it arrived under.
  const finder = found.forks
    ? { name: found.forks.name, type: found.forks.type, creator: found.forks.creator }
    : null;
  // An installer brought the whole game. Keep it (Data › Installer lists
  // every file and hands any of them back), open the application's resource
  // fork straight out of it rather than fetching Cythera.hqx later, and call
  // the archive by its own name: the exports are named after ARCHIVE_SOURCE_
  // NAME, and "Cythera.bin (edited)" would be the wrong file for a Mac.
  // `raw` is kept so that a file holding several installers can be opened
  // at another version without fetching again (switchInstaller).
  window.INSTALLER = found.installer
    ? Object.assign({ sourceName, raw, url: opts.url || null }, found.installer) : null;
  // A zip or a StuffIt archive holding several Delver archives: the others
  // are offered by name in the Settings menu (switchContained), and `raw`
  // is kept for that, as it is for an installer.
  window.CONTAINED = found.container
    ? Object.assign({ sourceName, raw, url: opts.url || null }, found.container) : null;
  if (found.installer) sourceName = found.forks.name || sourceName;
  // opts first, then what the unwrap found. The other way round, a remembered
  // installer -- stored with `rsrc: null` because the installer carries its
  // own fork -- had that null override the fork just taken out of it, so the
  // first visit had a resource fork and every return visit did not: Data ›
  // Data Fork said "no resource fork came with it" and the fork gallery was
  // empty, for the same bytes that had worked the day before.
  /* A MAGPIE PATCH IS A DELVER ARCHIVE AS MUCH AS THE SCENARIO IS, and one
     dropped here opened AS the archive: the galleries came up holding the
     handful of resources it replaces, the map had no maps in it, and the one
     section that can describe a patch and merge it never saw the file. There
     is no order in which that is what was meant -- a patch is read against
     the file whose resources it replaces -- so with a game already open it
     goes to that section instead. With none open it still opens on its own,
     which is the only way to look inside a patch before applying it. */
  if (ARCHIVE && delverArchivePatchPeek(found.bytes) &&
      patchesOpenBytes(found.bytes, (found.forks && found.forks.name) || sourceName)) {
    setStatus('That is a Magpie patch, not a game file, so the page compared it with the open file instead of replacing it. ' +
              'Data \u203a Patches says what it changes and can apply it.');
    return true;
  }
  applyNamesDefault(opts.cached ? opts.source === 'local file' : !opts.url);
  parseArchiveBytes(found.bytes, sourceName, Object.assign({}, opts, { via: found.via, rsrc, finder }));
  // After parseArchiveBytes, not before: resetDerivedCaches() drops the
  // application's fork along with everything else keyed to the old archive.
  if (found.installer) {
    const app = found.installer.archive.entries.find(e => e.type === 'APPL' && e.creator === 'Delv');
    if (app) {
      try { const both = viseExtract(found.installer.archive, app); window.APP_RSRC = openResourceFork(both.rsrc); window.APP_RSRC_RAW = both.rsrc; window.APP_DATA = both.data && both.data.length ? both.data : null; window.APP_PEF = null; window.APP_RSRC_STATE = ''; }
      catch (e) { window.APP_RSRC = null; window.APP_RSRC_RAW = null; window.APP_DATA = null; window.APP_PEF = null; window.APP_RSRC_STATE = 'The page could not open the program’s fork from the installer: ' + e.message; }
      if (window.CUR_SUBN === 'MACRSRC' && window.RSRC_SOURCE === 'app') renderMacRsrcSheet();
      // The dialogue box's constants are the program's, so it is drawn
      // again now that the application is here.
      try { installDialogueBox(); } catch (e) { quiet(e); }
      // The Data Fork tab unfades with the data fork, which is set just above
      // and after the sync parseArchiveBytes ran.
      syncInstallerTabs();
      try { syncTabsTo(document.getElementById('categorySelect').value); } catch (e) { quiet(e); }
    }
  }
  if (opts.store) {
    // The installer is remembered as it arrived, so that the next visit gets
    // every file back; anything else is remembered as its forks, as before.
    const rec = found.installer
      ? { name: window.INSTALLER.sourceName, bytes: raw, via: found.via, rsrc: null, pick: found.installer.picked }
      : found.container
      ? { name: sourceName, bytes: raw, via: found.via, rsrc: null, pick: found.container.picked }
      : { name: sourceName, bytes: found.bytes, via: found.via, rsrc: rsrc };
    archiveCachePut(Object.assign(rec, { source: opts.url || 'local file', savedAt: Date.now() })).catch(() => {});
  }
  return true;
}

function archiveLoadFailed(failures) {
  setStatus('No file loaded. Choose or drop the Cythera installer (.sit or .bin) or a "Cythera Data" file (.hqx is fine).', true);
  const mb = document.getElementById('archiveMenuBtn');
  if (mb) { mb.classList.add('urgent'); mb.textContent = 'Select Cythera Data file'; }
  openArchiveMenu(true);
  const out = document.getElementById('output');
  if (out) out.textContent = 'Tried, in order:\n  ' + failures.join('\n  ') +
    '\n\nThe installer is at ' + REMOTE_ARCHIVE_URLS.join(' and at ') +
      '. If this page could not fetch it, download it from there and drop it here.';
}

async function ingestArchiveFile(f) {
  if (!f) return;
  await loadingFileNote();
  setStatus('Reading ' + f.name + ' (' + fmtBytes(f.size) + ')…');
  let raw;
  try { raw = new Uint8Array(await f.arrayBuffer()); }
  catch (err) { archiveLoadFailed([f.name + ': ' + err.message]); return; }
  await new Promise(r => setTimeout(r, 0));   // let the status line paint first
  if (!adoptArchive(raw, f.name, { store: true })) archiveLoadFailed([f.name + ': ' + lastArchiveError]);
}

// The output line under the tabs says "Load the file to begin..." until a
// file is known; once one is on its way it says "Loading…" instead. It then
// gives the browser a frame to paint the word: parsing a file blocks the
// page for a second or more, and a note set on the same task as the parse
// is never seen. That is what happened to the remembered copy, which went
// from "Load the file to begin" straight to the title with the note set
// and never shown (the maintainer, 18 September 2026).
async function loadingFileNote() {
  const out = document.getElementById('output');
  if (out && /Load the archive to begin/.test(out.textContent || '')) out.textContent = 'Loading\u2026';
  // A frame and then a task, so the word is on screen before the parse
  // starts; or 20 ms, where nothing draws frames (the harness stub's
  // requestAnimationFrame never calls back, and a load that awaited it
  // never finished).
  await new Promise(r => {
    let done = false;
    const go = () => { if (!done) { done = true; r(); } };
    setTimeout(go, 20);
    try { requestAnimationFrame(() => setTimeout(go, 0)); } catch (e) { quiet(e); }
  });
}
function loadArchive() {
  ingestArchiveFile(document.getElementById('fileInput').files[0]);
}

// The gate: shown until one of its buttons is pressed; resolves with which.
let landingGateResolve = null;
function landingGate() {
  // A harness that walks the load path has no one to click: it says its
  // answer in advance and the gate steps aside.
  if (window.LANDING_GATE_ANSWER) return Promise.resolve(window.LANDING_GATE_ANSWER);
  const g = document.getElementById('landingGate');
  if (!g) return Promise.resolve('download');
  g.style.display = 'flex';
  try { document.body.classList.add('gated'); } catch (e) { quiet(e); }
  return new Promise(res => { landingGateResolve = res; });
}
function landingGateAnswer(which) {
  const g = document.getElementById('landingGate');
  if (g) g.style.display = 'none';
  try { document.body.classList.remove('gated'); } catch (e) { quiet(e); }
  const r = landingGateResolve; landingGateResolve = null;
  if (r) r(which);
}
async function loadDefaultArchive() {
  const params = new URLSearchParams(location.search);
  const forced = params.get('src');

  if (!forced && params.get('cache') !== 'skip') {
    try {
      const rec = await archiveCacheGet();
      if (rec && rec.bytes && rec.bytes.length) {
        await loadingFileNote();
        const bytes = rec.bytes instanceof Uint8Array ? rec.bytes : new Uint8Array(rec.bytes);
        if (adoptArchive(bytes, rec.name || 'remembered archive',
                         { cached: true, savedAt: rec.savedAt, rsrc: rec.rsrc || null, pick: rec.pick, source: rec.source })) return;
      }
    } catch (e) { /* no IndexedDB here; carry on to the network */ }
  }

  // No remembered copy and no file of the visitor's: before the network,
  // the gate. It says what is about to be downloaded and how big it is,
  // and it cannot be passed without a click. Chosen by the maintainer on
  // 6 September 2026 over a banner that would have started the download
  // anyway. A copy served beside the page (LOCAL_ARCHIVE_CANDIDATES) is
  // not a download worth asking about, so the gate only stands when the
  // page would go to the network.
  const failures = [];
  const tryUrl = async u => {
    const remote = /^https?:/i.test(u);
    const label = remote ? 'Downloading the file' : 'Looking for ' + u;
    try {
      setStatus(label + '…');
      const raw = await fetchWithProgress(u, label);
      if (adoptArchive(raw, decodeURIComponent(u.replace(/^.*\//, '')) || u, { url: u, store: true })) return true;
      failures.push(u + ', ' + lastArchiveError);
    } catch (err) {
      failures.push(u + ', ' + err.message);
    }
    return false;
  };
  if (forced) { await loadingFileNote(); if (!(await tryUrl(forced))) archiveLoadFailed(failures); return; }
  for (const u of LOCAL_ARCHIVE_CANDIDATES) if (await tryUrl(u)) return;
  const gate = await landingGate();
  if (gate === 'own') { openArchiveMenu(true); setStatus('Choose or drop the Cythera installer (.sit or .bin) or a "Cythera Data" file.'); return; }
  await loadingFileNote();
  for (const u of REMOTE_ARCHIVE_URLS) if (await tryUrl(u)) return;
  archiveLoadFailed(failures);
}

// Drop a file anywhere on the page. Previously the only way in was the
// hairline "data file" link pinned to the bottom-right corner.
function installArchiveDropTarget() {
  // A touch screen has nothing to drag a file with, and on an iPhone a
  // finger held on the map started a drag of the canvas instead, which is
  // what the press-and-hold hover needed. So there is no drop target on a
  // device with no fine pointer, and a drag that starts inside either map
  // viewport is refused everywhere.
  for (const id of ['atlasViewport', 'mapViewport']) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('dragstart', e => e.preventDefault());
  }
  try { if (matchMedia('(hover: none) and (pointer: coarse)').matches) return; } catch (e) { quiet(e); }
  const kill = e => { e.preventDefault(); e.stopPropagation(); };
  window.addEventListener('dragover', e => { kill(e); document.body.classList.add('dropping'); });
  window.addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('dropping'); });
  window.addEventListener('drop', e => {
    kill(e);
    document.body.classList.remove('dropping');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) ingestArchiveFile(f);
  });
}

/* ---------------------------------------------------------------------------
   Deep links
   ---------------------------------------------------------------------------
   Every view was previously unaddressable: reload, and you were back at the
   first gallery with no way to say "look at 0x8D02" to anyone else. The URL
   now carries the category and, in detail view, the resource:

       …/index.html#c=135&r=8801  (Alaric's portrait)
       …/index.html#8801          (bare id, subindex inferred)
       …/index.html#c=CHARACTERS&d=char:3   (a dossier)
       …/index.html?src=<url>     (load a different archive)

   Restoring it only works if the archive comes back by itself, which is why
   this landed together with the IndexedDB copy above.
--------------------------------------------------------------------------- */
let _hashWrite = false;
let _lastHash = '';

function currentSelectedResid() {
  const sel = document.getElementById('residSelect');
  const list = window.CUR_RESIDS;
  if (!sel || !list || !list.length) return null;
  const i = parseInt(sel.value);
  return (Number.isFinite(i) && list[i]) ? list[i][0] : null;
}

// The three detail views that are not resource-backed -- a character dossier,
// a prop type, a monster row -- are addressable too, since they are the pages
// most worth sending to somebody.
const DETAIL_OPENERS = {
  char: i => showCharacterDetail(i),
  prop: i => showPropTypeDetail(i),
  monster: i => showMonsterDetail(i),
  item: i => showItemDetail(i),
  // The only detail view whose id is not a number.
  rsrc: v => { const [t, id] = String(v).split(':'); showRsrcDetail(t, Number(id)); },
  macrsrc: v => { const parts = String(v).split(':');
                  if (parts.length === 3) showMacRsrcDetail(parts[1], Number(parts[2]), parts[0]);
                  else showMacRsrcDetail(parts[0], Number(parts[1])); }
};
// The openers above whose id is a "TYPE:number" string rather than an index.
const STRING_DETAIL_IDS = new Set(['rsrc', 'macrsrc']);
function markDetailView(kind, id) {
  window.DETAIL_VIEW = { kind, id };
  syncDeepLink();
  // The gallery's furniture -- the filter box, the sort, the export -- is
  // for the gallery, and it stayed up over every detail view, so on a
  // phone the thing tapped began about 900px down. updateGalleryTools
  // reads DETAIL_VIEW and takes it down.
  try { updateGalleryTools(); } catch (e) { quiet(e); }
}

/* ---------------------------------------------------------------------------
   Two kinds of back
   ---------------------------------------------------------------------------
   Every gallery and detail view already had a back button, and all of them
   meant the same thing: up, to the gallery this page belongs to. None of them
   meant back, to the page you came from -- so following a cross-reference out
   of a dossier into a portrait and then pressing back landed you in the
   portrait gallery, which is not anywhere you had been.

   The deep link is already a complete description of a view, so the trail is
   just the hashes: what the browser's back button walks.
--------------------------------------------------------------------------- */
window.VIEW_TRAIL = [];
let _navBack = false;

/* The trail is kept for the browser's own back and forward (the hashchange
   listener pops and pushes it); the in-page "Back to <the last page>"
   button that used to draw it went on 20 September 2026, the maintainer's
   call: the tabs and each view's own "All <this>" go up, and the browser
   goes back. */

function syncDeepLink() {
  if (!ARCHIVE) return;
  // A view reached through a category switch (jumpToResource, openVia) is
  // one step, not two: the gallery the switch renders on the way is never
  // written into the history or the trail, so the back button returns to
  // the page the link was on rather than to a gallery nobody was shown
  // (the maintainer, 10 September 2026: World > Open Cademia in Zones >
  // back went through the Zones gallery).
  if (window.NAV_SUPPRESS || window.PENDING_SINGLE) return;
  const cat = document.getElementById('categorySelect');
  if (!cat || !cat.value) return;
  let h = '#c=' + encodeURIComponent(cat.value);
  const d = window.DETAIL_VIEW;
  if (d && DETAIL_OPENERS[d.kind]) h += '&d=' + d.kind + ':' + d.id;
  const r = currentMode === 'single' ? currentSelectedResid() : null;
  if (r != null) h += '&r=' + r.toString(16).toUpperCase();
  if (h === location.hash) return;
  // The view being left is the one to come back to -- every view, a gallery
  // included. Galleries used to be left out ("the gallery button already
  // goes there"), which is why going item -> Characters gallery -> a person
  // and pressing back landed on the item: the gallery had never been
  // recorded.
  if (!_navBack && location.hash) {
    if (window.VIEW_TRAIL[window.VIEW_TRAIL.length - 1] !== location.hash)
      window.VIEW_TRAIL.push(location.hash);
    if (window.VIEW_TRAIL.length > 40) window.VIEW_TRAIL.shift();
  }
  _hashWrite = true;
  // Every view gets a real HISTORY entry, so the browser's own back and
  // forward buttons walk the interface: popping an entry changes the hash,
  // the hashchange listener re-applies the deep link, and the guard flag
  // keeps this function's own writes from being mistaken for navigation.
  // The forward button re-applies the hash the same way.
  try {
    if (!_navBack && location.hash) history.pushState({ v: ++_histDepth }, '', h);
    else history.replaceState(history.state, '', h);
  } catch (e) { location.hash = h; }
  setTimeout(() => { _hashWrite = false; }, 0);
  _lastHash = location.hash;
}
let _histDepth = 0;

function parseDeepLink() {
  const h = location.hash.replace(/^#/, '');
  if (!h) return null;
  const q = {};
  for (const part of h.split('&')) {
    const i = part.indexOf('=');
    if (i > 0) q[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1));
  }
  if (!q.c && !q.r && /^(0x)?[0-9a-f]{3,4}$/i.test(h)) q.r = h.replace(/^0x/i, '');
  /* A link made before the Mechanics sheet became seven tabs names the whole
     sheet, and no tab stands for the whole sheet, so it drew everything with
     the tab row blank. It opens the first tab instead. This is done here, to
     the link, and not in showCategory: the smoke's pins read the whole-sheet
     render through showCategory('MECHANICS'), and that still draws it. */
  if (q.c === 'MECHANICS') q.c = MECH_GROUPS[0].value;
  return (q.c || q.r) ? q : null;
}

// Point the tabs, the chip row and the hidden <select> at one category.
// Everything used to go through the <select> alone, so a jump from a
// cross-reference left the nav highlighting whatever you were looking at
// before -- the UI said "Graphics" while the gallery showed dialogue.
// pickCategory does all three now, so this is only the "is it a category?"
// check in front of it.
function showCategory(v) {
  const sel = document.getElementById('categorySelect');
  if (!sel || !Array.from(sel.options).some(o => o.value === v)) return false;
  pickCategory(v);
  return true;
}

// `q` may be supplied by a caller that read the hash earlier. It has to be:
// parseArchiveBytes opens a default category on the way in, and doing that
// rewrites location.hash -- so by the time the archive is ready, the link the
// visitor actually arrived on is gone unless it was captured first.
function applyDeepLink(q) {
  q = q || parseDeepLink();
  if (!q) return false;
  if (q.d && q.c) {
    const [kind, ...rest] = q.d.split(':');
    const open = DETAIL_OPENERS[kind];
    // Two of the detail views have an id that is not a number: a stamp is
    // "eSTM:2558" and a Mac resource is "PICT:129" -- type and id both, so
    // everything after the first colon is the id. This used to test for 'rsrc'
    // by name, which silently handed the second one parseInt("PICT:129").
    const id = rest.join(':');
    if (open && showCategory(q.c)) { open(STRING_DETAIL_IDS.has(kind) ? id : parseInt(id, 10)); return true; }
  }
  if (q.c === 'WORLD' && showCategory('WORLD')) return true;
  if (q.r) {
    const resid = parseInt(q.r, 16);
    if (Number.isFinite(resid) && jumpToResource(resid)) return true;
  }
  return q.c ? showCategory(q.c) : false;
}

// Select a resource in the current category and open it. The four contact
// sheets each used to do this by hand, and each did it in the order
// setMode('single') -> set the <select> -> renderImage(), which decoded the
// PREVIOUS resource first and then threw it away.
function openResource(resid) {
  const list = window.CUR_RESIDS || [];
  const idx = list.findIndex(r => r[0] === resid);
  if (idx < 0) return false;
  document.getElementById('residSelect').value = idx;
  setMode('single');
  return true;
}

function parseArchiveBytes(bytes, sourceName, meta) {
  meta = meta || {};
  /* The archive exactly as it arrived, before any edit rebuilt it. A patch
     describes byte positions in the file the player already has, and an edit
     relays the whole archive -- the rebuild of the shipped Cythera Data is
     12,542 bytes shorter -- so after one edit `ARCHIVE.bytes` no longer agrees
     with anyone's installed copy. Every patch is computed against this. */
  if (meta.via !== 'edit') window.PRISTINE_BYTES = bytes;
  // Kept for the edit path: a rebuild re-enters here and needs the name to
  // keep calling the file what the user called it, and the fork's raw bytes
  // to hand back as meta.rsrc -- CYTHERA_RSRC is the parsed fork and cannot
  // be re-opened from itself.
  window.ARCHIVE_SOURCE_NAME = sourceName;
  window.CYTHERA_RSRC_RAW = (meta.rsrc && meta.rsrc.length) ? meta.rsrc : null;
  // Kept so a font swap can be undone without re-opening the archive.
  if (meta.via !== 'edit') { window.ARCHIVE_ORIGINAL_RSRC = window.CYTHERA_RSRC_RAW; window.FONT_SWAP = null; }
  // The pstring at 0x20 is what delvmod calls `player_name`; the scenario
  // leaves it empty and every saved game in the community's add-ons carries
  // the name the file was saved under. It is what tells a saved game from
  // the scenario here, since nothing else in the header does.
  const savedAs = (bytes[0x20] >= 1 && bytes[0x20] <= 31) ? pstring(bytes, 0x20) : '';
  // meta.finder is absent on a rebuild (via:'edit'), a cached load and a bare
  // .data file. A rebuild keeps what the container said, since it is the same
  // file; a bare file gets the identity its header supports -- a saved game
  // is 'DelP' under its own name, anything else the type/creator the real
  // file ships with, which the refusal message in extractDelverArchive also
  // states. Deriving it on every bare open rather than only the first is
  // deliberate: a save dropped after Cythera Data must not be exported as
  // "Cythera Data", and the reverse held too.
  if (meta.finder) window.ARCHIVE_FINDER = meta.finder;
  else if (meta.via !== 'edit' || !window.ARCHIVE_FINDER)
    window.ARCHIVE_FINDER = savedAs ? { name: savedAs, type: 'DelP', creator: 'Delv' }
                                    : { name: 'Cythera Data', type: 'DelS', creator: 'Delv' };
  const out = document.getElementById('output');
  const arrivedOn = parseDeepLink();   // before anything can overwrite it
  /* And where the visitor is actually standing, read the same three ways
     syncDeepLink writes that hash. The hash is normally the same answer, but
     it is not always there to read: an origin that refuses
     history.replaceState leaves it empty (some file:// ones do, and the test
     stub is another), and an edit's rebuild must go back to the open view
     whether or not the URL happens to record it. */
  const standingOn = (function () {
    const cat = document.getElementById('categorySelect');
    if (!cat || !cat.value) return null;
    const q = { c: cat.value };
    const d = window.DETAIL_VIEW;
    if (d && DETAIL_OPENERS[d.kind]) q.d = d.kind + ':' + d.id;
    try { const r = currentMode === 'single' ? currentSelectedResid() : null;
          if (r != null) q.r = r.toString(16).toUpperCase(); } catch (e) { quiet(e); }
    return q;
  })();
  try {
    const title = pstring(bytes, 0);
    const arc = openDelverArchive(bytes);
    if (!arc) throw new Error('no master index; the (offset,length) pair at 0x80 does not describe one');
    // The file that was open stays open, whole, until the new one has parsed:
    // a failure above leaves the page on the archive it had. A save replacing
    // the scenario takes the scenario's words for its forms first, while the
    // scenario is still what every reader reads (keepScenarioSaveWords).
    if (savedAs && meta.via !== 'edit' && ARCHIVE && ARCHIVE.bytes && !(ARCHIVE.bytes[0x20] >= 1 && ARCHIVE.bytes[0x20] <= 31))
      keepScenarioSaveWords();
    ARCHIVE = arc;
    const masterIndex = arc.index;
    dvmSetResourceSymbols(loadResourceSymbols(arc));
    resetDerivedCaches();
    openCytheraResourceFork(meta.rsrc);
    installGameFont();
    try { installDialogueBox(); } catch (e) { quiet(e); }
    loadDerivedNames();
    installBackgroundTexture();
    try { drawBrand(); } catch (e) { quiet(e, 'the brand line'); }
    document.getElementById('pickerWrap').style.display = 'block';
    syncInstallerTabs();
    buildTabShell();
    document.getElementById('searchWrap').style.display = 'none';
    document.getElementById('searchPresets').innerHTML =
      Object.keys(SEARCH_PRESETS).map(k =>
        '<button class="sv-chip" onclick="searchPreset(\'' + k + '\')">' + k + '</button>').join('') +
      '<span class="partsTitle" style="flex-basis:100%;margin-top:6px">Or ask</span>' +
      ASK_EXAMPLES.map(q => '<button class="sv-chip" onclick="searchPreset(\'' + q.replace(/'/g, '\\\'') + '\')">' + svEsc(q) + '</button>').join('');
    document.getElementById('searchResults').innerHTML = '';
    document.getElementById('searchBox').value = '';
    const ss = document.getElementById('sourceStatus');
    ss.classList.remove('failed');
    ss.innerHTML = '';
    const populated = masterIndex.filter(m => m[0]).length;
    ss.appendChild(document.createTextNode(
      'Loaded: ' + sourceName + ', ' + fmtBytes(ARCHIVE.bytes.length) + ', ' +
      populated + ' subindexes' + (savedAs ? ', a saved game (“' + savedAs + '”)' : '') +
      (meta.via && meta.via !== 'data fork' ? ', unwrapped from ' + meta.via : '') +
      (window.CYTHERA_RSRC ? ', plus a ' + window.CYTHERA_RSRC.total() + '-resource fork' : '') +
      (window.INSTALLER ? ', with ' + (window.INSTALLER.archive.entries.length - 1) + ' other files under Data › Installer' +
        (window.INSTALLER.installers && window.INSTALLER.installers.length > 1
          ? ' (' + window.INSTALLER.installers.length + ' versions in the file)' : '') : '') +
      (window.CONTAINED ? ' (' + window.CONTAINED.entries.length + ' archives in the file)' : '') +
      (meta.cached ? ' (remembered from ' + new Date(meta.savedAt || Date.now()).toLocaleDateString() + ') ' : ' ')));
    // The other archives the same file holds, each a chip that opens it.
    {
      const row = document.getElementById('containedRow');
      if (row) row.innerHTML = '';
      if (row) row.style.display = window.CONTAINED ? '' : 'none';
      if (row && window.CONTAINED) {
        const label = document.createElement('span');
        label.className = 'amNote';
        label.textContent = 'This file holds ' + window.CONTAINED.entries.length + ' archives, the open one marked:';
        row.appendChild(label);
        for (const it of window.CONTAINED.entries) {
          const b = document.createElement('button');
          b.className = 'navChip' + (it.name === window.CONTAINED.picked ? ' active' : '');
          b.textContent = it.name + (it.player ? ' (' + it.player + ')' : '');
          b.title = it.path + ', ' + fmtBytes(it.len) + ', ' + it.title;
          b.onclick = () => switchContained(it.name);
          row.appendChild(b);
        }
      }
    }
    const fb = document.getElementById('forgetArchiveBtn');
    if (fb) fb.style.display = meta.cached ? '' : 'none';
    const btn = document.getElementById('archiveMenuBtn');
    if (btn) { btn.classList.remove('urgent'); btn.textContent = 'Settings'; }
    openArchiveMenu(false);
    const cbl = document.getElementById('chkBuiltinLabels');
    if (cbl) cbl.checked = !!window.SHOW_BUILTIN_LABELS;
    // Where a visit starts, when the link it arrived on does not say
    // otherwise -- applyDeepLink below overrides this whenever there is a
    // hash. Without the explicit pick this would open on whatever option
    // happens to come first in the hidden <select>, which is a detail of the
    // markup and not a decision. The world, when the file has one; a saved
    // game has no world map -- it holds only what play changed -- and the
    // atlas over it would be a zoom slider over nothing, so such a file
    // opens on the Data Fork sheet, which lists what it does hold and where
    // each part is shown.
    const hasWorld = !!getResourceBytes(ARCHIVE, WORLD_MAP_RESID);
    /* An EDIT's rebuild is the same file arriving again, and the visitor is
       standing somewhere in it -- mid-stroke on a map, usually. Opening the
       world first and letting applyDeepLink walk back from it was both wrong
       and expensive: `showCategory('WORLD')` builds the whole atlas scene,
       and every one of those was thrown away on the next line. With the map
       editor committing a stroke at a time that is the difference between an
       edit costing a moment and costing a second; in the UI smoke, where the
       stub draws everything the slow way, it was 27 seconds an edit.
       Where the hash -- or, when there is none, the open view itself --
       says where we are, go straight there. */
    const backTo = arrivedOn || (meta && meta.via === 'edit' ? standingOn : null);
    const restoring = !!(meta && meta.via === 'edit' && backTo && (backTo.c || backTo.r));
    /* A saved game opens on its own sheet. It has no world map, so the atlas
       over it would be a zoom slider over nothing, and the Data Fork sheet --
       where such a file landed until now -- lists six subindexes and says
       nothing about any of them. The Saved Game sheet reads the one that
       matters. */
    const landOn = hasWorld ? 'WORLD' : (savedAs && getResourceBytes(ARCHIVE, 0xF009) ? 'SAVEGAME' : 'DATAFORK');
    if (!restoring && !showCategory(landOn)) onCategoryChange();
    out.textContent = 'Title: ' + title + (savedAs ? ', saved game “' + savedAs + '”' : '') + ', ' + sourceName;
    // A link to the world -- or the World tab carried across a swap, which
    // is the same hash -- names nothing in a file that has no world.
    let landed = false;
    if (!(backTo && backTo.c === 'WORLD' && !hasWorld)) landed = applyDeepLink(backTo);
    // If the hash did not take us back after all, redraw where we already
    // are rather than leaving the previous archive's view on screen.
    if (restoring && !landed) onCategoryChange();
  } catch(err) { out.textContent = 'Archive error: ' + err.message; setStatus('The page could not load the archive: ' + err.message, true); }
}

function onCategoryChangeImpl() {
  stopAllViewActivity();
  window.UNDITHER_PREVIEW = null;         // a preview is for one view
  window.DETAIL_VIEW = null;
  const out = document.getElementById('output');
  const rawval = document.getElementById('categorySelect').value;
  // Keyed on the value being opened: CUR_SUBN is still the one being left.
  if (rawval !== 'WORLD') leaveAtlas();
  // Changing category always drops back to the gallery -- previously a
  // category change while a detail view was open just re-rendered a
  // different resource inside that same detail view instead of returning.
  currentMode = 'sheet';
  // A detail view that wanted one wide column set the grid to block; a
  // change of category comes here without passing setMode, so the grid
  // was staying one cell a row for every gallery after (9 September 2026).
  clearSheetGridLayout();
  // Dropping back to the gallery was not enough: the previously selected
  // resource's panels stayed on screen underneath, so a new category looked
  // like it still had the old resource open. Clear them all up front, for
  // every branch below.
  for (const id of ['singlePreview','zoomControls','soundPreview','textPreview',
                    'mapPreview','resourceNav','scriptView','scriptRefs','viewTabs','artUsage']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  const svEl = document.getElementById('scriptView');
  if (svEl) svEl.innerHTML = '';
  currentResid = null;
  window.CUR_RAW_BYTES = null;
  if (rawval === 'CHARACTERS') {
    window.CUR_SUBN = 'CHARACTERS';
    document.getElementById('residSelect').innerHTML = '';
    setMode('sheet');
    return;
  }
  if (rawval === 'PROPS' || rawval === 'SCENERY' || rawval === 'ITEMS' || rawval === 'RSRC') {
    window.CUR_SUBN = rawval;
    document.getElementById('residSelect').innerHTML = '';
    setMode('sheet');
    return;
  }
  // The two resource forks are two tabs and one gallery: which fork it shows
  // is RSRC_SOURCE, which the tab sets. The application's fork is fetched on
  // first use; loadApplicationFork re-renders the sheet when it arrives.
  if (rawval === 'MACRSRC' || rawval === 'APPRSRC') {
    window.RSRC_SOURCE = rawval === 'APPRSRC' ? 'app' : 'data';
    window.CUR_SUBN = 'MACRSRC';
    document.getElementById('residSelect').innerHTML = '';
    if (rawval === 'APPRSRC' && !window.APP_RSRC) loadApplicationFork();
    setMode('sheet');
    return;
  }
  // The fork galleries filtered to a kind (FORK_VIEWS): the same renderer.
  if (FORK_VIEWS[rawval]) {
    window.RSRC_SOURCE = FORK_VIEWS[rawval].source === 'app' ? 'app' : 'data';
    window.CUR_SUBN = rawval;
    window.CUR_RESIDS = [];
    document.getElementById('residSelect').innerHTML = '';
    if (FORK_VIEWS[rawval].source !== 'data' && !window.APP_RSRC) loadApplicationFork();
    setMode('sheet');
    return;
  }
  // The Rules tab draws the combat vocabulary out of the application's fork
  // even without the installer; fetch the fork if it is not here yet.
  if (rawval === 'AIRULES' && !window.INSTALLER && !window.APP_RSRC) loadApplicationFork();
  // The Data tab's own views: not subindexes, no resources to list.
  if (rawval === 'DATAFORK' || rawval === 'CHANGES' || rawval === 'TOOLS' || rawval === 'INSTALLER' || rawval === 'MECHANICS' || rawval === 'BARKS' || rawval === 'SKILLS' || rawval === 'SPELLS' || rawval === 'SCHEDULES' ||
      rawval === 'SAVEGAME' || rawval === 'PREFS' || rawval === 'PATCHES' || rawval === 'CHEATS' || rawval === 'RECORDS' || MECH_GROUP_BY_VALUE[rawval] ||
      rawval === 'WORLD' || PLACEHOLDER_TABS[rawval]) {
    window.CUR_SUBN = rawval;
    window.CUR_RESIDS = [];
    document.getElementById('residSelect').innerHTML = '';
    setMode('sheet');
    return;
  }
  if (rawval === 'MONSTERS') {
    window.CUR_SUBN = 'MONSTERS';
    document.getElementById('residSelect').innerHTML = '';
    setMode('sheet');
    return;
  }
  if (rawval === 'COMPOSITE') {
    window.CUR_SUBN = 'COMPOSITE';
    document.getElementById('residSelect').innerHTML = '';
    setMode('sheet');
    return;
  }
  const subn = parseInt(rawval);
  const r = new BinReader(ARCHIVE.bytes);
  const [subOff, subLen] = ARCHIVE.index[subn] || [0,0];
  const select = document.getElementById('residSelect');
  select.innerHTML = '';
  if (!subOff) { out.textContent = "This subindex (" + subn + ") has no indexed resources in this file."; window.CUR_RESIDS=[]; return; }
  r.seek(subOff);
  const size = Math.floor(subLen/8);
  const resids = [];
  const addEntry = (resid, roff, rlen) => {
    resids.push([resid, roff, rlen]);
    const lbl = labelFor(resid);
    const opt = document.createElement('option');
    opt.value = resids.length-1;
    opt.textContent = "0x" + resid.toString(16).toUpperCase() + (lbl ? " - " + lbl : "") + " (" + rlen + " bytes)";
    select.appendChild(opt);
  };
  for (let n=0; n<size; n++) {
    const roff = r.u32(); const rlen = r.u32();
    // 0x8EFF sits in the tile-sheet subindex and is not a tile sheet: it is
    // the Tombstone slab, a 194x127 sized image (see js/delv-graphics.js).
    // It is listed with the sized images instead, where it decodes as one.
    if (roff && !(subn === 141 && n === 0xFF)) addEntry((subn+1)*0x100 + n, roff, rlen);
  }
  if (subn === 142) {
    const [so, sl] = ARCHIVE.index[141] || [0, 0];
    if (so && Math.floor(sl / 8) > 0xFF) {
      r.seek(so + 0xFF * 8);
      const roff = r.u32(), rlen = r.u32();
      if (roff) addEntry(0x8EFF, roff, rlen);
    }
  }
  window.CUR_RESIDS = resids;
  window.CUR_SUBN = subn;
  out.textContent = "Found " + resids.length + " resources in " + (CATEGORY_NAMES[subn] || 'Unknown Category') + " (subindex " + subn + ").";
  // The four words every conversation answers are not in any script: they
  // are STR# 128 in the resource fork, and the game supplies them.
  if (subn === 23) {
    const kw = forkStringList(window.CYTHERA_RSRC, 128);
    if (kw && kw.length) out.textContent += ' Every conversation also answers ' +
      kw.map(w => '“' + w + '”').join(', ') + ', the default keywords, string list 128 in the resource fork.';
  }
  document.getElementById('singlePreview').style.display = 'none';
  document.getElementById('zoomControls').style.display = 'none';
  document.getElementById('soundPreview').style.display = 'none';
  document.getElementById('textPreview').style.display = 'none';
  document.getElementById('mapPreview').style.display = 'none';
  if (resids.length) select.selectedIndex = 0;
  /* A gallery nobody is going to look at. jumpToResource switches category and
     then opens one resource, and setMode('single') empties #sheetGrid on the
     very next line -- so the contact sheet built here is thrown away entire.
     In a browser that mostly costs the cells rather than the art, since the
     IntersectionObserver that decodes each tile does not deliver before the
     grid is cleared; in the test stub, whose observer fires at once by
     design, it is the whole gallery decoded and discarded, and on Regions --
     42 maps -- that was nineteen seconds every time an edit rebuilt the
     archive under an open map. The flag is cleared by jumpToResource itself,
     which draws the sheet after all if the resource turns out not to be
     there. */
  if (window.PENDING_SINGLE == null) renderContactSheet();
  updateUnditherBar();
}

// Someone who has asked their system for less motion should not be handed a
// page where a dozen sprites walk on the spot and the lava cycles. Every
// animation here still has its own toggle; this only changes what they start
// as, and drawing is unaffected -- a still frame is drawn either way.
const PREFERS_REDUCED_MOTION = (() => {
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; }
  catch (e) { return false; }
})();
/* One animation setting for the page, since 6 September 2026 (the
   maintainer: one global option, not a checkbox on every panel).
     all      -- the maps' and the atlas's palette cycling, the tile sheets',
                 and the galleries' walking and turning sprites
     graphics -- everything but the maps
     tiles    -- the tile sheets' palette cycling alone
     off      -- nothing moves
   The three flags below are what the rest of the page reads; they are set
   from the mode and nowhere else. */
window.ANIM_MODE = PREFERS_REDUCED_MOTION ? 'off' : 'all';
try { const v = localStorage.getItem('cythera.animMode'); if (v) window.ANIM_MODE = v; } catch (e) { quiet(e); }
window.PALETTE_ANIM = window.ANIM_MODE !== 'off';
window.SPRITE_ANIM = window.ANIM_MODE === 'all' || window.ANIM_MODE === 'graphics';
function setAnimMode(mode) {
  window.ANIM_MODE = mode;
  try { localStorage.setItem('cythera.animMode', mode); } catch (e) { quiet(e); }
  window.PALETTE_ANIM = mode !== 'off';
  window.MAP_ANIM = mode === 'all';
  window.SPRITE_ANIM = mode === 'all' || mode === 'graphics';
  if (!window.PALETTE_ANIM) stopPaletteAnimation();
  if (!window.SPRITE_ANIM) stopSpriteAnimations();
  try { if (typeof onCategoryChange === 'function' && ARCHIVE) onCategoryChange(); } catch (e) { quiet(e); }
}
window.UNDITHER = false;

// ===================== end Undither =====================================

function drawToCanvas(canvas, W, H, image, transparentIndex, palette) {
  canvas.width=W; canvas.height=H;
  // Keep the palette indices alongside the rendered pixels so PNG export can
  // write a real indexed PNG with this exact CLUT, instead of handing a
  // downstream tool RGBA and making it re-derive the palette from residuals.
  // Refreshed on every draw, so a palette-cycled frame exports the palette it
  // is actually showing.
  canvas.__cythIndexed = {
    W, H, image,
    transparentIndex: (transparentIndex === undefined) ? null : transparentIndex,
    palette: palette || PAL_RGB
  };
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,W,H);
  const imgData = ctx.createImageData(W,H);
  const t = (transparentIndex === undefined || transparentIndex === null) ? -1 : transparentIndex;
  const P = palette || PAL_RGB;
  for (let i=0;i<W*H;i++) {
    const v = image[i];
    if (v === t) { imgData.data[i*4+3]=0; continue; }
    const c = P[v] || [0,0,0];
    imgData.data[i*4]=c[0]; imgData.data[i*4+1]=c[1]; imgData.data[i*4+2]=c[2]; imgData.data[i*4+3]=255;
  }
  ctx.putImageData(imgData,0,0);

  // Undithering runs off the back of the ordinary draw rather than replacing
  // it: the plain image appears immediately and is refined a moment later.
  // A gallery can hold a couple of hundred resources and each one costs tens
  // of milliseconds, so doing them all inline would lock the page for several
  // seconds before anything appeared at all.
  // Portraits only, since 9 September 2026: the reconstruction was tuned on
  // them and they are what it is for; the tiles, icons and landscapes
  // stay the pixels.
  if (unditherOn() && W*H > 0 && (window.UNDITHER_ALL || String(window.CUR_SUBN) === '135' || window.UNDITHER_PREVIEW !== null)) queueUndither(canvas, W, H, image, t, P);
}

// One at a time, yielding between, so the page stays responsive while a whole
// gallery is reprocessed. Superseded jobs are dropped: switching category or
// turning the option off bumps the generation and everything older is
// abandoned rather than drawn onto canvases nobody is looking at any more.
let unditherQueue = [], unditherRunning = false, unditherGen = 0;
function queueUndither(canvas, W, H, image, transparentIndex, palette) {
  unditherQueue.push({canvas, W, H, image, transparentIndex, palette, gen: unditherGen});
  if (!unditherRunning) { unditherRunning = true; setTimeout(pumpUndither, 0); }
}
function cancelUndither() { unditherGen++; unditherQueue.length = 0; }
function pumpUndither() {
  const started = performance.now();
  while (unditherQueue.length) {
    const job = unditherQueue.shift();
    if (job.gen !== unditherGen) continue;          // stale
    if (!job.canvas.isConnected) continue;          // cell already replaced
    try {
      const key = job.W + 'x' + job.H + ':' + hashIndices(job.image) +
                  ':' + job.transparentIndex;
      const img = unditherIndexed(ARCHIVE, job.W, job.H, job.image, job.transparentIndex,
                                  job.palette, key);
      if (job.gen !== unditherGen) continue;
      const c = job.canvas;
      c.width = img.width; c.height = img.height;
      c.getContext('2d').putImageData(img, 0, 0);
      // The indexed sidecar no longer describes what is on the canvas, and a
      // truecolour reconstruction has no palette to write, so PNG export must
      // fall back to RGBA rather than emit a palette that is no longer true.
      c.__cythIndexed = null;
    } catch (err) { /* leave the plain draw in place */ }
    if (performance.now() - started > 24) break;    // yield, keep the UI alive
  }
  if (unditherQueue.length) setTimeout(pumpUndither, 0);
  else unditherRunning = false;
}
function applyZoom() {
  const canvas = document.getElementById('canvas');
  const vp = document.getElementById('canvasViewport');
  const z = parseInt(document.getElementById('zoomSlider').value);
  document.getElementById('zoomLabel').textContent = z + 'x';
  // Keep whatever was in the middle of the viewport in the middle after the
  // zoom, and let the viewport crop. The canvas used to grow the document,
  // which pushed the slider itself down the page mid-drag.
  const prevW = canvas.offsetWidth || 1, prevH = canvas.offsetHeight || 1;
  const cx = (vp.scrollLeft + vp.clientWidth / 2) / prevW;
  const cy = (vp.scrollTop + vp.clientHeight / 2) / prevH;
  const w = canvas.width * z, h = canvas.height * z;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  vp.scrollLeft = Math.max(0, cx * w - vp.clientWidth / 2);
  vp.scrollTop  = Math.max(0, cy * h - vp.clientHeight / 2);
  // A gold frame says the picture runs past the edges.
  if (vp.classList) vp.classList.toggle('cropped', vp.clientWidth > 40 && (w > vp.clientWidth + 1 || h > vp.clientHeight + 1));
}

function navigateResource(delta) {
  const sel = document.getElementById('residSelect'), count = window.CUR_RESIDS?.length || 0;
  if (!count) return;
  sel.value = (parseInt(sel.value) + delta + count) % count;
  renderImage();
  syncDeepLink();
}

/* What one view leaves on the grid that the next must not inherit: a detail
   view's display:block, and the code galleries' one-column scriptList and
   the landscapes' wide cells, which renderContactSheet sets for itself and
   no other renderer cleared. Leaving Functions for Characters drew one
   character a row (the maintainer, 1 October 2026), the same symptom the
   display fix of 9 September cured for detail views. */
function clearSheetGridLayout() {
  const grid = document.getElementById('sheetGrid');
  if (!grid) return;
  grid.style.display = '';
  grid.classList.remove('scriptList', 'landscapeGrid');
}

function returnToSheet() {
  setMode('sheet');
  requestAnimationFrame(() => window.scrollTo(0, lastSheetScrollY));
}

function autoZoom(W, H) {
  const longEdge = Math.max(W,H);
  let z = Math.round(320 / longEdge);
  if (z < 1) z = 1;
  if (z > 16) z = 16;
  return z;
}


// 0xF015 is {u16 key, NUL-terminated symbol} pairs -- the names given to the
// handful of props that use the persistence store (bellows, troughs, shutters
// and candlesticks, twelve in the whole game). The key is a prop record's
// StoreRef, so this turns a bare 0x0007 into "Od_Trough1".
DERIVED.STORE_SYMBOLS = null;
function loadStoreSymbols() {
  if (DERIVED.STORE_SYMBOLS) return DERIVED.STORE_SYMBOLS;
  const names = {};
  try {
    const raw = getResourceBytes(ARCHIVE, 0xF015);
    if (raw) {
      let i = 0;
      while (i + 3 <= raw.length) {
        const key = u16be(raw, i);
        i += 2;
        let end = i; while (end < raw.length && raw[end] !== 0) end++;
        const nm = decodeMacRoman(raw.subarray(i, end));
        i = end + 1;
        if (nm) names[key] = nm;
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.STORE_SYMBOLS = names);
}
function storeSymbol(key) { return key ? (loadStoreSymbols()[key] || null) : null; }
