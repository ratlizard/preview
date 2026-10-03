/* The map viewport, clicking the map, containers, and the world map's towns and country.

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
   last of these. File 6 of 14. */

// --- Map viewport pan & zoom state -----------------------------------
const mapView = { scale: 1, x: 0, y: 0, dragging: false, lastX: 0, lastY: 0 };

function clampMapPan() {
  const viewport = document.getElementById('mapViewport');
  const canvas = document.getElementById('mapTerrainCanvas');
  if (!canvas) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const cw = canvas.width * mapView.scale, ch = canvas.height * mapView.scale;
  // Allow panning until the map edge reaches the viewport edge, plus a
  // little slack so small maps aren't glued to a corner.
  const minX = Math.min(0, vw - cw), maxX = Math.max(0, vw - cw);
  const minY = Math.min(0, vh - ch), maxY = Math.max(0, vh - ch);
  mapView.x = Math.max(minX, Math.min(maxX, mapView.x));
  mapView.y = Math.max(minY, Math.min(maxY, mapView.y));
  if (cw <= vw) mapView.x = (vw - cw) / 2;
  if (ch <= vh) mapView.y = (vh - ch) / 2;
}

function applyMapTransform() {
  const wrap = document.getElementById('mapCanvasWrap');
  wrap.style.transform = 'translate(' + mapView.x + 'px,' + mapView.y + 'px) scale(' + mapView.scale + ')';
  scheduleLensPaint();

  // Thin 1px detail -- the wavy streaks in the Expanse void tiles are only
  // ~37 pixels per tile -- is destroyed by nearest-neighbour when the map is
  // shown below 100%. Smooth only when downscaling; keep crisp pixels at or
  // above 1:1.
  const mc = document.getElementById('mapTerrainCanvas');
  if (mc) mc.style.imageRendering = (mapView.scale < 0.999) ? 'auto' : 'pixelated';
}

// One slider, two renderers.
function onMapZoomSlider() {
  if (window.ATLAS && window.CUR_SUBN === 'WORLD') atlasZoomFromSlider();
  else applyMapZoom(true);
}

function applyMapZoom(fromSlider) {
  const slider = document.getElementById('mapZoomSlider');
  const pct = parseInt(slider.value);
  document.getElementById('mapZoomLabel').textContent = pct + '%';
  const viewport = document.getElementById('mapViewport');
  const wrap = document.getElementById('mapCanvasWrap');
  const canvas = document.getElementById('mapTerrainCanvas');
  if (!canvas) return;
  // Keep the viewport's visual center fixed while the slider changes scale.
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  const oldScale = mapView.scale;
  const centerX = (vw/2 - mapView.x) / oldScale;
  const centerY = (vh/2 - mapView.y) / oldScale;
  mapView.scale = pct / 100;
  mapView.x = vw/2 - centerX * mapView.scale;
  mapView.y = vh/2 - centerY * mapView.scale;
  clampMapPan();
  applyMapTransform();
  updateMapArrows();
  rememberMapView();
}

/* ---------------------------------------------------------------------------
   Where you were on the map
   ---------------------------------------------------------------------------
   Following a link out of the map -- a prop type, a dossier, the script behind
   a door -- and pressing back re-rendered the map from scratch and fitted the
   whole thing to the viewport, so a reader who had zoomed in on one room in
   Cademia came back to the whole of Cademia. The pan and zoom are three
   numbers; they are remembered per map and restored instead of re-fitting.
   Nothing is persisted: this is the state of a session, not a preference.
--------------------------------------------------------------------------- */
window.MAP_VIEW_MEMORY = Object.create(null);
// The selected square is remembered separately from the pan and zoom, and
// deliberately so: clearMapInspector() runs while a NEW map is being opened,
// at a moment when CUR_MAP is already the new map but mapView still holds the
// previous one's transform. Folding the two together let that moment write the
// old map's scroll position into the new map's memory.
window.MAP_SEL_MEMORY = Object.create(null);
function rememberMapView() {
  const cm = window.CUR_MAP;
  if (!cm || !mapView.scale) return;
  window.MAP_VIEW_MEMORY[cm.resid] = { scale: mapView.scale, x: mapView.x, y: mapView.y };
}
// Put a remembered view back. Returns false if there is nothing to restore, or
// if the viewport has not been laid out yet -- the caller then fits as usual.
function restoreMapView(resid) {
  const v = window.MAP_VIEW_MEMORY[resid];
  const viewport = document.getElementById('mapViewport');
  const canvas = document.getElementById('mapTerrainCanvas');
  if (!v || !viewport || !canvas) return false;
  if (viewport.clientWidth < 40 || viewport.clientHeight < 40) return false;
  mapView.scale = v.scale; mapView.x = v.x; mapView.y = v.y;
  clampMapPan();
  const slider = document.getElementById('mapZoomSlider');
  const pct = Math.max(5, Math.min(+((slider && slider.max)) || 400, Math.round(mapView.scale * 100)));
  if (slider) slider.value = pct;
  const lab = document.getElementById('mapZoomLabel');
  if (lab) lab.textContent = pct + '%';
  applyMapTransform();
  updateMapArrows();
  // A restored selection brings its inspector card back with it -- a ring with
  // nothing under it would be a puzzle rather than a reminder.
  const sel = window.MAP_SEL_MEMORY[resid];
  if (sel) { try { inspectMapSquare(sel.tx, sel.ty); } catch (e) { quiet(e); } }
  return true;
}
// Called instead of fitMapToView when a map is opened: the same retry loop,
// but it prefers the remembered view when there is one.
function restoreOrFitMap(resid, _retry) {
  const viewport = document.getElementById('mapViewport');
  if (viewport && (viewport.clientWidth < 40 || viewport.clientHeight < 40) && (_retry || 0) < 20) {
    return setTimeout(() => restoreOrFitMap(resid, (_retry || 0) + 1), 50);
  }
  if (!restoreMapView(resid)) fitMapToView();
  window.MAP_SETTLED = resid;   // what showSquareOnMap waits for
}

function onMapFit() {
  if (window.ATLAS && window.CUR_SUBN === 'WORLD') {
    atlasFit(); atlasSyncZoomLabel(); paintAtlas();
  } else fitMapToView();
}

/* The pan and zoom that shows the whole of a canvas in a viewport.

   Split out of fitMapToView because the World tab's cross-fade has to paint
   the destination map at exactly the geometry the real view is about to
   adopt: the overlay is opaque at the moment the swap happens underneath it,
   so a fit computed even slightly differently would show as a jump when the
   overlay goes. Small maps fill the viewport too, rather than sitting in the
   middle as a postage stamp, which is where the 4x ceiling comes from. */
function fitViewFor(cw, ch, vw, vh) {
  const scale = Math.min(vw / cw, vh / ch, 4);
  const pct = Math.max(5, Math.min(400, Math.round(scale * 100)));
  const s = pct / 100;
  return { pct, scale: s, x: (vw - cw * s) / 2, y: (vh - ch * s) / 2 };
}

function fitMapToView(_retry) {
  const viewport = document.getElementById('mapViewport');
  const wrap = document.getElementById('mapCanvasWrap');
  const canvas = document.getElementById('mapTerrainCanvas');
  if (!canvas) return;
  const vw = viewport.clientWidth, vh = viewport.clientHeight;
  // The viewport has no measurable size until the map panel has actually been
  // laid out. Fitting against a zero-width box produced the 5% floor, which is
  // why maps opened tiny and pinned to the top-left corner.
  if ((vw < 40 || vh < 40) && (_retry || 0) < 20) {
    return setTimeout(() => fitMapToView((_retry || 0) + 1), 50);
  }
  const f = fitViewFor(canvas.width, canvas.height, vw, vh);
  document.getElementById('mapZoomSlider').value = f.pct;
  document.getElementById('mapZoomLabel').textContent = f.pct + '%';
  mapView.scale = f.scale; mapView.x = f.x; mapView.y = f.y;
  applyMapTransform();
  updateMapArrows();
  rememberMapView();
}

// Hide each hint once there is nothing further to pan to on that side.
function updateMapArrows() {
  const vp = document.getElementById('mapViewport');
  const canvas = document.getElementById('mapTerrainCanvas');
  if (!vp || !canvas) return;
  const w = canvas.width * mapView.scale, h = canvas.height * mapView.scale;
  const set = (id, hidden) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('atEdge', hidden);
  };
  set('mapArrowLeft',  mapView.x >= -0.5);
  set('mapArrowUp',    mapView.y >= -0.5);
  set('mapArrowRight', mapView.x + w <= vp.clientWidth + 0.5);
  set('mapArrowDown',  mapView.y + h <= vp.clientHeight + 0.5);
}

function panMapByArrow(dx, dy) {
  const viewport = document.getElementById('mapViewport');
  const step = Math.max(viewport.clientWidth, viewport.clientHeight) * 0.25;
  mapView.x -= dx * step;
  mapView.y -= dy * step;
  clampMapPan();
  applyMapTransform();
  updateMapArrows();
  rememberMapView();
}

function setupMapViewportInteraction() {
  const viewport = document.getElementById('mapViewport');
  if (viewport.dataset.wired) return;
  viewport.dataset.wired = '1';

  // Track every active pointer (finger/mouse) by id so we can detect a
  // second touch landing and switch from single-finger pan to two-finger
  // pinch-to-zoom, the standard mobile map-app gesture.
  const activePointers = new Map();
  let pinchStartDist = 0, pinchStartScale = 1, pinchStartMidX = 0, pinchStartMidY = 0;

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function midpoint(a, b) { return { x: (a.x+b.x)/2, y: (a.y+b.y)/2 }; }

  function zoomAroundPoint(newScale, vx, vy) {
    // vx,vy are in viewport-local pixel coordinates -- keep that point fixed
    // on screen while scale changes, exactly like native pinch-zoom apps.
    // Same ceiling as the slider: 4x of native art, however far below
    // native the base canvas happens to be (16x on the TS=8 world map).
    const zs = document.getElementById('mapZoomSlider');
    newScale = Math.max(0.05, Math.min(((+((zs && zs.max)) || 400) / 100), newScale));
    const contentX = (vx - mapView.x) / mapView.scale;
    const contentY = (vy - mapView.y) / mapView.scale;
    mapView.scale = newScale;
    mapView.x = vx - contentX * mapView.scale;
    mapView.y = vy - contentY * mapView.scale;
    clampMapPan();
    applyMapTransform();
    const slider = document.getElementById('mapZoomSlider');
    const pct = Math.round(mapView.scale * 100);
    slider.value = Math.max(5, Math.min(+slider.max || 400, pct));
    document.getElementById('mapZoomLabel').textContent = slider.value + '%';
    rememberMapView();
  }

  // A click has to be told apart from the end of a drag, or every pan would
  // open the inspector on whatever square the finger happened to stop over.
  let pressX = 0, pressY = 0, moved = 0;
  // Tap and press-and-hold are the hover on a touch screen -- see the
  // atlas's setupAtlasInteraction for the reasoning; the same two gestures.
  let holdTimer = null, peeking = false;
  const endHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };

  const onDown = (clientX, clientY) => {
    mapView.dragging = true;
    mapView.lastX = clientX; mapView.lastY = clientY;
    pressX = clientX; pressY = clientY; moved = 0;
  };
  const onMove = (clientX, clientY) => {
    if (!mapView.dragging) return;
    moved += Math.abs(clientX - mapView.lastX) + Math.abs(clientY - mapView.lastY);
    mapView.x += clientX - mapView.lastX;
    mapView.y += clientY - mapView.lastY;
    mapView.lastX = clientX; mapView.lastY = clientY;
    clampMapPan();
    applyMapTransform();
  };
  const onUp = () => { mapView.dragging = false; rememberMapView(); };

  viewport.addEventListener('pointerdown', e => {
    viewport.setPointerCapture(e.pointerId);
    const rect = viewport.getBoundingClientRect();
    activePointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (activePointers.size === 2) {
      mapView.dragging = false; // hand off from single-finger pan to pinch
      const pts = Array.from(activePointers.values());
      pinchStartDist = dist(pts[0], pts[1]);
      pinchStartScale = mapView.scale;
      const mid = midpoint(pts[0], pts[1]);
      pinchStartMidX = mid.x; pinchStartMidY = mid.y;
    } else if (activePointers.size === 1) {
      onDown(e.clientX, e.clientY);
      endHold(); peeking = false;
      // A new gesture puts the last card away, so a pan never leaves a stale
      // one behind and a second tap replaces the first.
      if (e.pointerType !== 'mouse') hideMapHover();
      if (e.pointerType !== 'mouse') {
        const cx = e.clientX, cy = e.clientY;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (activePointers.size !== 1 || moved >= 6) return;
          peeking = true;
          mapView.dragging = false;
          updateMapHover(cx, cy, true);
        }, 350);
      }
    }
    if (activePointers.size === 2) endHold();
  });
  viewport.addEventListener('pointermove', e => {
    // Hover is for a pointer that is resting, not one that is dragging, and
    // only where hovering is a thing the device does.
    if (e.pointerType === 'mouse' && !activePointers.size) updateMapHover(e.clientX, e.clientY);
    if (!activePointers.has(e.pointerId)) return;
    if (peeking) { updateMapHover(e.clientX, e.clientY, true); return; }
    const rect = viewport.getBoundingClientRect();
    activePointers.set(e.pointerId, { x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (moved >= 6) endHold();
    if (activePointers.size === 2) {
      const pts = Array.from(activePointers.values());
      const newDist = dist(pts[0], pts[1]);
      if (pinchStartDist > 0) {
        const ratio = newDist / pinchStartDist;
        zoomAroundPoint(pinchStartScale * ratio, pinchStartMidX, pinchStartMidY);
      }
    } else if (activePointers.size === 1) {
      onMove(e.clientX, e.clientY);
    }
  });
  const clearPointer = e => {
    const wasDragging = mapView.dragging;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) { pinchStartDist = 0; }
    if (activePointers.size === 0) onUp();
    endHold();
    // The card stays where the lift left it: it is clear of the finger now,
    // so there is something to read, and the next gesture puts it away.
    if (peeking) { if (!activePointers.size) peeking = false; return; }
    if (e.type === 'pointerup' && wasDragging && moved < 6) {
      const sq = mapSquareFromClient(e.clientX, e.clientY);
      if (sq) inspectMapSquare(sq.tx, sq.ty);
      // On a touch screen a tap IS the hover. There is no resting pointer to
      // ask with, and press-and-hold -- the gesture that used to be the only
      // way -- puts the card under the thumb that asked for it. Asked, so the
      // card speaks over bare ground as well.
      if (sq && e.pointerType !== 'mouse') updateMapHover(e.clientX, e.clientY, true);
    }
  };
  // A touch pointer leaves the element the moment it lifts, which would take
  // the tapped card with it. Only a mouse leaving means "stopped looking".
  viewport.addEventListener('pointerleave', e => { if (!e || e.pointerType === 'mouse') hideMapHover(); });
  viewport.addEventListener('pointerup', clearPointer);
  viewport.addEventListener('pointercancel', clearPointer);
  viewport.addEventListener('pointerleave', clearPointer);

  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const vx = e.clientX - rect.left, vy = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    zoomAroundPoint(mapView.scale * factor, vx, vy);
  }, { passive: false });
}

/* ---------------------------------------------------------------------------
   Clicking the map
   ---------------------------------------------------------------------------
   The map already knew, for every square, which prop record put something
   there and which scheduled character is standing on it -- and none of it was
   reachable. Clicking a square now names what is on it and links onward: the
   creature's dossier, the prop type's sprite sheet, the store behind a
   merchant's counter, the script a door runs.
--------------------------------------------------------------------------- */
function clearMapInspector() {
  if (window.MAP_SEL) setMapSelection(null);
  const el = document.getElementById('mapInspect');
  if (!el) return;
  // A hint rather than an empty box: nothing on screen otherwise suggests the
  // map answers questions when you click it.
  el.innerHTML = '<span class="inspDim">Click any square to see the props and people on it.</span>';
  el.style.display = 'block';
}

/* ---------------------------------------------------------------------------
   Who that is
   ---------------------------------------------------------------------------
   The map has known who is standing where since the schedules were read, and
   the only way to ask was to click a square and read the card underneath. On
   a map with sixty people on it that is sixty clicks to find one. A pointer
   resting on somebody now says who they are and what they are doing, and the
   click still opens the dossier.

   A touch screen has no resting pointer and a pointermove there is a drag,
   so the gesture is a tap -- which also opens the inspector below -- or a
   press and hold, which keeps the card with the moving finger. Either way
   the card is placed clear of the hand rather than under it: see
   placeHoverCard, which is where the whole of that difference lives.

   The square under the pointer is matched the way the inspector matches it --
   the record's own coordinate, not where the sprite is drawn, which can be
   the best part of a square up and to the left of it. Doing otherwise would
   name a different person from the one the click is about to open.
--------------------------------------------------------------------------- */
let hoverSquare = '';
function hideMapHover() {
  const el = document.getElementById('mapHover');
  if (el) { el.style.display = 'none'; hoverSquare = ''; }
}

function updateMapHover(clientX, clientY, asked) {
  const el = document.getElementById('mapHover');
  const vp = document.getElementById('mapViewport');
  const cm = window.CUR_MAP;
  if (!el || !vp || !cm) return;
  const sq = mapSquareFromClient(clientX, clientY);
  if (!sq) { hideMapHover(); return; }
  const key = cm.resid + ':' + sq.tx + ',' + sq.ty + (asked ? '!' : '');
  const rect = vp.getBoundingClientRect();
  const px = clientX - rect.left, py = clientY - rect.top;
  // Same square, so only the card moves: rebuilding it on every pixel of
  // pointer travel would re-decode a sprite several hundred times a second.
  // Only while it is up, though -- a tap on the square the pointer last
  // passed over would otherwise re-place a hidden card and show nothing.
  if (key === hoverSquare && el.style.display !== 'none') {
    placeHoverCard(el, vp, px, py, asked);
    return;
  }
  hoverSquare = key;
  // The words as markup and the sprite appended after it, with the canvas
  // ordered back in front by CSS. Built the other way round -- canvas first,
  // words in an appended element -- the card's own innerHTML said nothing,
  // which is a thing no harness could then check.
  const card = squareCard(cm.level, { result: { m: cm.m, props: cm.props } }, sq.tx, sq.ty, null, asked);
  if (!card) { el.style.display = 'none'; return; }
  el.innerHTML = card.html;
  if (card && card.person) appendFaceOrSprite(el, card.person);
  el.classList.toggle('hvPinned', !!asked);
  el.style.display = 'flex';
  placeHoverCard(el, vp, px, py, asked);
}

/* A tap that lands on a pinned card belongs to the card. Both cards are
   children of their viewport, so without this the viewport's own pointerdown
   runs too: on the World tab that calls hideAtlasHover() and begins a
   gesture, which would dismiss the card on the way to the link the reader was
   aiming at. Attached once, to each card, and only ever swallowing a pointer
   that is already inside a card the reader asked for. */
function guardHoverCardTaps() {
  for (const id of ['atlasHover', 'mapHover']) {
    const el = document.getElementById(id);
    if (!el || el._tapGuarded) continue;
    el._tapGuarded = true;
    for (const ev of ['pointerdown', 'pointerup', 'click']) {
      el.addEventListener(ev, e => { if (el.classList.contains('hvPinned')) e.stopPropagation(); });
    }
  }
}
try { guardHoverCardTaps(); } catch (e) { quiet(e); }

/* Where the card goes, for both panels.

   A mouse pointer is a few pixels wide and sits beside what it is over, so
   the card goes up and to the right of it and never off the edge of the
   panel. A finger is neither: it rests ON the square it is asking about and
   the hand behind it covers everything below, so a card fourteen pixels away
   is a card nobody can read -- which is what press-and-hold was giving, and
   what the maintainer reported on 8 September 2026. A touched card clears
   the point by a thumb's width upwards instead, and where there is no room
   above it goes to the foot of the panel rather than under the hand.

   `touch` is the page's `asked` flag: it is true exactly when a finger made
   the request, which is also when the card says more (see squareCard). */
const HOVER_TOUCH_CLEAR = 64;   // px above the finger: a thumb and its shadow
function placeHoverCard(el, vp, px, py, touch) {
  const w = el.offsetWidth || 150, h = el.offsetHeight || 40;
  if (touch) {
    // Above the finger by preference, and BELOW it when there is no room
    // there. It used to fall back to vp.clientHeight - h, which put the card
    // at the foot of the viewport with nothing to do with where the finger
    // was: touching near the top of the map produced a card at the bottom of
    // the screen, which reads as a bug rather than as a position (the
    // maintainer, 12 September 2026). The clamp stays, but only as a last
    // resort for a card that fits neither way.
    let y = py - h - HOVER_TOUCH_CLEAR;
    if (y < 4) y = py + HOVER_TOUCH_CLEAR;
    y = Math.max(4, Math.min(y, vp.clientHeight - h - 6));
    const x = Math.max(4, Math.min(px - w / 2, vp.clientWidth - w - 4));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    return;
  }
  let x = px + 14, y = py - h - 10;
  if (x + w > vp.clientWidth - 4) x = px - w - 14;
  if (x < 4) x = 4;
  if (y < 4) y = py + 18;
  y = Math.max(4, Math.min(y, vp.clientHeight - h - 6));
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
}

// Viewport pixel -> map square, undoing translate(x,y) scale(s) on the wrapper.
function mapSquareFromClient(clientX, clientY) {
  const cm = window.CUR_MAP;
  const viewport = document.getElementById('mapViewport');
  if (!cm || !viewport) return null;
  const rect = viewport.getBoundingClientRect();
  const cx = (clientX - rect.left - mapView.x) / mapView.scale;
  const cy = (clientY - rect.top  - mapView.y) / mapView.scale;
  const tx = Math.floor(cx / cm.TS), ty = Math.floor(cy / cm.TS);
  if (tx < 0 || ty < 0 || tx >= cm.tilesW || ty >= cm.tilesH) return null;
  return { tx, ty };
}

function propInspectRows(p) {
  const r = p.rec;
  const rows = [];
  const name = propDisplayName(r.proptype);
  rows.push(['Prop type', '0x' + r.proptype.toString(16).toUpperCase() + (name ? ', ' + name : '')]);
  rows.push(['Aspect', r.aspect + (r.rotated ? ' (rotated)' : '')]);
  rows.push(['Tile', '0x' + p.tileId.toString(16).toUpperCase() +
                     (terrainNameFor(p.tileId) ? ', ' + terrainNameFor(p.tileId) : '')]);
  rows.push(['Flags', '0x' + r.flags.toString(16).padStart(2, '0').toUpperCase() +
                      (r.takeable ? ' (you can take it)' : '')]);
  // What the square is actually being asked about most of the time: how heavy
  // is that thing, and what does its class say about it. Both come out of the
  // prop type's own script resource, which was already parsed for the Items
  // gallery and never consulted here.
  const w = itemWeight(r.proptype);
  if (w !== null) rows.push(['Weight', w + (w === 1 ? ' unit' : ' units')]);
  const cls = parseItemClass(r.proptype);
  if (cls) for (const f of cls.data) {
    if (f.key === 0x24) continue;                      // weight, shown above
    const info = ITEM_FIELD_INFO[f.key];
    if (!info || !info.scalar) continue;
    rows.push([itemFieldLabel(f.key), itemFieldValue(f)]);
  }
  const lockable = classHasMember(r.proptype, 52);
  if (lockable && r.d1) {
    const haveKey = keysForLock(r.d1).length;
    rows.push(['Lock', 'id ' + r.d1 + (haveKey
      ? ', ' + haveKey + ' matching key' + (haveKey === 1 ? '' : 's') + ' in the world'
      : '; no key matches it, so the lockpick, magic or a script opens it')]);
  }
  if (r.proptype === KEY_PROPTYPE && r.d1)
    rows.push(['Opens', 'lock id ' + r.d1 + ', ' + locksForKey(r.d1).length + ' lock(s)']);
  // A portal's low data byte is a zoneport index into 0xF00C -- the same
  // table the map headers' four exit fields use. Established two ways:
  // archive-wide (every portal-typed prop with a nonzero d2, all 122 of
  // them, lands on a populated zoneport entry; none dangles) and from the
  // engine's own code (the ladder, hole, stairs, mineshaft and cave object
  // scripts each pass get_field data3 straight to sys ChangeZone). Bryce
  // recorded the same byte as "destination zone" on save-file portal
  // objects in 2007 (forum t1830); this is that finding, holding in the
  // scenario file. "steps" (131/250) is not in EXIT_PROPS because it is
  // usually decorative and would repaint the map marks, but nine steps
  // props do travel, so it joins here rather than there.
  // propTravelsTo widens this to the settlement icons on the world map, and
  // to an arch anywhere -- see the Gateways comment above worldGateways for
  // the evidence and for why the widening is scoped the way it is.
  const dest = propTravelsTo(r, window.CUR_MAP ? window.CUR_MAP.resid : 0);
  if (dest) rows.push(['Leads to', dest.name + ' (' + dest.x + ',' + dest.y + '), zoneport ' + r.d2]);
  if (r.d1 || r.d2) rows.push(['Data', r.d1 + ' / ' + r.d2 + '  (0x' + r.d3.toString(16).toUpperCase() + ')']);
  if (r.storeref) {
    const sym = typeof storeSymbol === 'function' ? storeSymbol(r.storeref) : null;
    rows.push(['Store ref', '0x' + r.storeref.toString(16).toUpperCase() + (sym ? ', ' + sym : '')]);
  }
  if (r.otherprop) rows.push(['Word 8-11', '0x' + r.otherprop.toString(16).toUpperCase()]);
  return rows;
}

/* ---------------------------------------------------------------------------
   Containers
   ---------------------------------------------------------------------------
   A prop record whose flags carry 0x08 is not on the floor: its location word
   is the index of the prop in the SAME list that holds it (see
   parseDelverPropList). So a chest's contents are already in the file, and
   until now the map simply did not draw them and the inspector did not
   mention them.

   The game shows an opened container as a "zoomrect": a picture of the
   inside of that kind of container with the contents laid on it. Those are
   subindex 142 graphics -- 0x8F09 is the crate, 0x8F0A the chest, 0x8F0E the
   drawer -- and the mapping from a container to its picture is by kind, since
   nothing in the archive links a prop type to a zoomrect.
--------------------------------------------------------------------------- */
// Since 19 September 2026 the class says which (classZoomrect): the helper
// call in its own script names the picture. A name list stood here; it
// agreed with the file on every class that has the call, and named
// pictures for jars, shelves and graves that no class opens.
function containerZoomrect(pt) {
  const z = classZoomrect(pt);
  return z ? z.resid : 0x8F0A;                    // a chest, for a class with no call
}

// The records this one holds, from the map's full prop list.
// The records this one holds. The prop list defaults to the open map's, which
// is what the inspector wants; the World tab passes a node's own, because it
// asks about a map it is looking at from outside rather than standing in.
function containerContents(rec, allProps) {
  const props = allProps || (window.CUR_MAP && window.CUR_MAP.allProps);
  if (!props) return [];
  return props.filter(o => o.container === rec.index && o.flags !== 0xFF && o.proptype);
}

// What a hover over one of a container's contents says: everything the item's
// own page would open with, in one tooltip -- weight, what its class script
// carries, and how many of it the shipped scenario places.
function containedItemSummary(rec) {
  const pt = rec.proptype;
  const bits = [];
  const nm = propDisplayName(pt);
  if (nm) bits.push(nm);
  bits.push('prop type 0x' + pt.toString(16).toUpperCase() + ', aspect ' + rec.aspect);
  const w = itemWeight(pt);
  if (w !== null) bits.push('weight ' + w + ' grain' + (w === 1 ? '' : 's'));
  try {
    const cls = parseItemClass(pt);
    if (cls) {
      for (const f of cls.data) {
        if (f.key === 0x24) continue;                       // weight, above
        const info = ITEM_FIELD_INFO[f.key];
        if (!info || !info.scalar) continue;
        bits.push(itemFieldLabel(f.key).toLowerCase() + ' ' + itemFieldValue(f));
      }
      if (cls.code.length) bits.push('responds to ' + cls.code.length + ' method' +
                                     (cls.code.length === 1 ? '' : 's'));
    }
  } catch (e) { quiet(e); }
  try {
    const idx = buildItemIndex()[pt];
    if (idx && idx.total) bits.push(idx.total + ' placed in the world');
  } catch (e) { quiet(e); }
  bits.push(isInventoryItem(pt) ? 'click for its item page' : 'click for its prop type');
  return bits.join(' · ');
}

// The zoomrect with the contents' sprites laid out across it, the way the game
// shows an opened container.
function buildContainerView(rec, contents) {
  const wrap = document.createElement('div');
  const box = document.createElement('div');
  box.className = 'zoomRect';
  const rid = containerZoomrect(rec.proptype);
  // The zoomrect is a frame with a hollow middle, so it goes on as a
  // background stretched to the card and the contents sit in the hollow.
  try {
    const raw = getResourceBytes(ARCHIVE, rid);
    if (raw) {
      const d = decodeResource(ARCHIVE, raw, 142);
      const back = document.createElement('canvas');
      drawToCanvas(back, d.W, d.H, d.image, null);
      box.style.backgroundImage = 'url(' + back.toDataURL('image/png') + ')';
      box.style.minHeight = Math.min(190, Math.round(d.H * 0.62)) + 'px';
    }
  } catch (e) { quiet(e); }
  const label = labelFor(rid) || '';
  const items = document.createElement('div');
  items.className = 'zrItems';
  const tiles = getPropTileList();
  for (const o of contents) {
    const chip = document.createElement('button');
    chip.className = 'zrItem';
    const base = tiles[o.proptype];
    if (base !== undefined) {
      const c = document.createElement('canvas');
      try { drawTileToCanvas(c, base + o.aspect, 32, o.rotated); } catch (e) { quiet(e); }
      // The letter a key wears, where the game draws it: centred under the
      // picture, outlined (itemLetter).
      const L = itemLetter(o);
      if (L) try {
        const g = c.getContext('2d');
        g.font = canvasFace(12); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
        g.lineWidth = 3; g.strokeStyle = '#000'; g.strokeText(L, 16, 31);
        g.fillStyle = '#fff'; g.fillText(L, 16, 31);
      } catch (e) { quiet(e); }
      c.style.cssText = 'width:32px;height:32px;image-rendering:pixelated';
      chip.appendChild(c);
    }
    const nm = document.createElement('span');
    // No weight here. A chest's contents are a picture of what is in the
    // chest; a number after every name turned that into a packing list, and
    // the number it printed was carry weight, which is a fact about the ITEM
    // and belongs on the item's own page. The details are one hover away and
    // that page is one click away instead.
    nm.textContent = (terrainNameFor((tiles[o.proptype] || 0) + o.aspect) ||
                      propDisplayName(o.proptype, base) || ('0x' + o.proptype.toString(16))) +
                     (itemLetter(o) ? ' ' + itemLetter(o) : '');
    chip.appendChild(nm);
    chip.title = containedItemSummary(o);
    const goesToItem = isInventoryItem(o.proptype);
    chip.onclick = (ev) => {
      ev.stopPropagation();
      if (goesToItem) showItemDetail(o.proptype); else showPropTypeDetail(o.proptype);
    };
    items.appendChild(chip);
  }
  box.appendChild(items);
  wrap.appendChild(box);
  const cap = document.createElement('div');
  cap.className = 'zrCap';
  const z = classZoomrect(rec.proptype);
  cap.innerHTML = contents.length + (contents.length === 1 ? ' thing inside' : ' things inside') +
                    (label ? ' \u00b7 shown in the game\u2019s ' + svEsc(label.toLowerCase()) : '') +
                    (z ? ', which ' + srcNum({ resid: z.classResid, at: z.at }, 'its class asks for') : '');
  wrap.appendChild(cap);
  return wrap;
}

function inspectMapSquare(tx, ty) {
  const host = document.getElementById('mapInspect');
  const cm = window.CUR_MAP;
  if (!host || !cm) return;
  setMapSelection(tx, ty);
  const hits = (cm.props || []).filter(p => p.cells.some(c => c[0] === tx && c[1] === ty));
  const people = (typeof charactersOnLevel === 'function' ? charactersOnLevel(cm.level, window.MAP_TIME) : [])
    .filter(c => Math.round(c.x) === tx && Math.round(c.y) === ty);
  const tileId = cm.m ? mapTileAt(cm.m, tx, ty) : 0;
  const terrain = tileId ? (terrainNameFor(tileId) || compositeTileName(tileId)) : null;
  const exits = mapExitSquares(cm.resid).filter(e => e.x === tx && e.y === ty);
  const edges = mapExitEdges(cm.resid, cm.m).filter(e => e.cells.some(c => c[0] === tx && c[1] === ty));
  const faux = tileId ? getFauxProps().get(tileId) : null;
  const needsRope = ropeSquares(cm.resid).has(tx + ',' + ty);

  const parts = ['<div class="inspHead">Square ' + tx + ', ' + ty + ' <span class="inspDim">(' + gameSquare(tx, ty) + ')</span>' +
    (tileId ? ' &nbsp;·&nbsp; terrain tile 0x' + tileId.toString(16).toUpperCase() +
      (terrain ? ' <i>' + svEsc(terrain) + '</i>' : '') : '') +
    (tileId && !tilePassable(tileId) ? ' &nbsp;·&nbsp; <span class="inspDim">blocks movement</span>' : '') +
    '<button class="linkbtn inspClose" onclick="clearMapInspector()">close</button></div>'];

  /* The lighting layer draws only what is fixed to the map -- the zone's own
     level and each source's own cone. The level's BASE light value is not
     fixed to the map: it is one number for the whole level computed from an
     eleven-by-eleven window around wherever the player is standing, so a
     whole-map wash would be asserting something the engine never computes.
     Here there is a square to stand on, so here it can be said. */
  if (window.SHOW_LIGHTING && cm.m && cm.resid !== WORLD_MAP_RESID) {
    const zl = zoneAmbientLevel(cm.resid);
    const attr = getTileAttributes(ARCHIVE)[tileId] || 0, ownLvl = attr & 3;
    const { sum, n } = lightSumAt(cm.resid, cm.m, tx, ty);
    const hour = window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR;
    const withView = zl === null ? null : ambientBase(zl, hour, sum);
    const alone = zl === null ? null : ambientBase(zl, hour);
    const pair = [[10, 12], [14, 16], [18, 22]][ownLvl - 1];
    const tiles = v => (v / 8).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    parts.push('<div class="inspCard"><b>Light</b>' +
      (ownLvl ? '<div>A light source, level ' + ownLvl + ', ' +
        ((attr & 0x10000) ? 'flickering' : 'steady') + ' &nbsp;·&nbsp; its pool is ' +
        ((attr & 0x10000) ? tiles(pair[0]) + ' to ' + tiles(pair[1]) : tiles(pair[0])) +
        ' tiles across</div>' : '') +
      (withView === null
        ? '<div class="inspDim">this zone\u2019s entry script sets no light level</div>'
        : '<div>Standing here: the zone sets <b>' + zl + '</b>, and ' + n + ' source' +
          (n === 1 ? '' : 's') + ' in view are worth <b>' + sum + '</b>, so the level here is <b>' +
          withView + ' of 32</b>' +
          (withView === 32 ? ', nothing darkened' : withView === 0 ? ', solid black' : '') +
          (withView !== alone ? ' <span class="inspDim">(' + alone +
            ' of 32 with nothing in view)</span>' : '') + '</div>') +
      '<div class="inspDim">That is the base value for every square of the level, not just this ' +
      'one: anything bright in the eleven-by-eleven view lightens the whole map, and moving it out ' +
      'of view darkens the map again. The game also ignores light sources it treats as unseen, which ' +
      'the file does not record, so the page counts every source in view.</div></div>');
  }

  // A square inside a gateway's footprint says so first, and offers the
  // crossing. The prop cards below still name the icon and its zoneport; this
  // is the same journey with one click instead of three, and it is only ever
  // on the world map because that is the only place worldGateways looks.
  const gate = (cm.resid === WORLD_MAP_RESID) ? gatewayAtSquare(tx, ty) : null;
  if (gate) {
    parts.push('<div class="inspCard"><b>' + svEsc(gate.name) + '</b> ' +
      '<span class="inspDim">a way off the world map, ' + svEsc(gate.kind) +
      ', zoneport ' + gate.port + ', arriving at (' + gate.destX + ',' + gate.destY + ')</span>' +
      '<div class="inspActs"><button class="sv-chip" onclick="enterGatewayByPort(' + gate.port +
      ')">Enter ' + svEsc(gate.name) + '</button></div></div>');
  }

  /* A way an egg makes (mapEggWays): the hero standing in its rectangle is
     sent through its zoneport, so a secret passage, a tight passage or a
     mousehole drawn there is a way you can take. And a crack in a ravine
     is the ravine, not a way: the way down is the rope tied to the
     outcropping on its edge (ravineWayAt), which the crack points to. */
  for (const w of mapEggWays(cm.resid)) {
    const q = w.rect;
    if (tx < q.left || tx > q.right || ty < q.top || ty > q.bottom) continue;
    parts.push('<div class="inspCard"><b>' + svEsc(w.hidden ? 'A hidden way, ' + w.kind : w.kind === 'way' ? 'A way' : w.kind) + '</b> ' +
      '<span class="inspDim">to ' + svEsc(w.name) + ', by a trigger (an egg) covering ' + q.w + ' by ' + q.h +
      (w.egg.aspect === 1 ? ', zoneport ' + w.egg.proptype : ', a change of zone') + '</span>' +
      '<div class="inspActs"><button class="sv-chip" onclick="showSquareOnMap(' + w.dest.resid + ',' + w.dest.x + ',' + w.dest.y +
      ')">Go to ' + svEsc(w.name) + '</button></div></div>');
  }
  {
    const rv = ravineWayAt(cm.resid, tx, ty);
    if (rv) parts.push('<div class="inspCard"><b>A ravine</b> <span class="inspDim">the way down is the ' +
      svEsc(rv.kind) + ' at (' + rv.x + ',' + rv.y + '), with a rope tied to it, to ' + svEsc(rv.name) + '</span>' +
      '<div class="inspActs"><button class="sv-chip" onclick="showSquareOnMap(' + cm.resid + ',' + rv.x + ',' + rv.y + ')">The ' + svEsc(rv.kind) + '</button>' +
      '<button class="sv-chip" onclick="showSquareOnMap(' + rv.dest.resid + ',' + rv.dest.x + ',' + rv.dest.y + ')">Go to ' + svEsc(rv.name) + '</button></div></div>');
  }

  for (const e of exits) {
    parts.push('<div class="inspCard"><b>Zone exit</b> <span class="inspDim">zoneport 0x' +
      e.idx.toString(16).toUpperCase() + '</span><div class="inspDim">Another place leads to this ' +
      'square, and in play the same square is the way back out.</div></div>');
  }

  const SIDE_WORDS = { N: 'north', E: 'east', S: 'south', W: 'west' };
  for (const e of edges) {
    const z = zoneportInfo(e.idx);
    parts.push('<div class="inspCard"><b>Open ' + SIDE_WORDS[e.side] + ' edge</b> ' +
      '<span class="inspDim">map header exit, zoneport 0x' + e.idx.toString(16).toUpperCase() +
      (z ? ' to ' + svEsc(z.name) : '') + '</span><div class="inspDim">Not just this square: the whole ' +
      (e.side === 'N' || e.side === 'S' ? 'row' : 'column') + ' is a way out. Walking far enough ' +
      SIDE_WORDS[e.side] + ' at any ' + (e.side === 'N' || e.side === 'S' ? 'column' : 'row') +
      ' leaves the map here.</div></div>');
  }

  if (needsRope) {
    parts.push('<div class="inspCard"><b>Rope</b> <span class="inspDim">prop type 0x14B on this ' +
      'square</span><div class="inspDim">A rope hangs here, which is what makes the drop below ' +
      'passable. There are four in the whole scenario, all of them on ravines.</div></div>');
  }

  if (faux) {
    parts.push('<div class="inspCard"><b>' +
      svEsc(propDisplayName(faux.proptype) || ('0x' + faux.proptype.toString(16))) + '</b>' +
      ' <span class="inspDim">not a real prop: the terrain tile itself draws it (0xF010), ' +
      'not placed in the prop list</span><div class="inspActs">' +
      '<button class="sv-chip" onclick="showPropTypeDetail(' + faux.proptype + ')">Prop type</button>' +
      '</div></div>');
  }

  for (const c of people) {
    const face = characterFace(c.index);
    parts.push('<div class="inspCard person">' +
      (face && face.url ? '<img class="inspFace" src="' + face.url + '" alt="" width="64" height="64">' : '') +
      '<div><b>' + svEsc(c.name || ('Character ' + c.index)) + '</b>' +
      ' <span class="inspDim">' + (c.walking ? 'walking'
          : c.sitting ? ('sitting, facing ' + ['north','east','south','west'][(c.aspect >> 2) & 3] +
              ', ' + svEsc(c.seat ? c.seat.why : ''))
          : svEsc(String(c.mode || 'here'))) + '</span>' +
      (carriedByCharacter(c.index).length ? '<div class="inspDim">carries ' +
        carriedByCharacter(c.index).map(it => svEsc((propDisplayName(it.pt, (getPropTileList()[it.pt] || 0) + it.aspect) || 'prop type ' + it.pt) +
          (it.equipped ? ' (equipped)' : ''))).join(', ') + '</div>' : '') +
      '<div class="inspActs">' +
      '<button class="sv-chip" onclick="showCharacterDetail(' + c.index + ')">Dossier</button>' +
      // 0x8800 is character 1's portrait (the dossier and the gallery agree),
      // so this is index - 1; it used to open the next character's face.
      '<button class="sv-chip" onclick="jumpToResource(' + (0x8800 + c.index - 1) + ')">Portrait</button>' +
      '<button class="sv-chip" onclick="jumpToResource(' + (0x1800 + c.index) + ')">Dialogue</button>' +
      '</div></div></div>');
  }

  const boxes = [];
  for (const p of hits) {
    const rows = propInspectRows(p).map(([k, v]) =>
      '<dt>' + svEsc(k) + '</dt><dd>' + svEsc(v) + '</dd>').join('');
    const ways = [];
    if (isExitProp(p.rec.proptype, window.CUR_MAP ? window.CUR_MAP.resid : undefined)) ways.push('a way out of here, by its class');
    if (isConcealedProp(p.rec.proptype)) ways.push('concealed');
    if (isWallProp(p.rec.proptype) && !(((getTileAttributes(ARCHIVE)[p.tileId] || 0) >> 8) & 0x02))
      ways.push('a wall you can walk through');
    const acts = ['<button class="sv-chip" onclick="showPropTypeDetail(' + p.rec.proptype + ')">Prop type</button>'];
    if (isInventoryItem(p.rec.proptype))
      acts.push('<button class="sv-chip" onclick="showItemDetail(' + p.rec.proptype + ')">Item</button>');
    if (refExists(0x1000 + p.rec.proptype))
      acts.push('<button class="sv-chip" onclick="jumpToResource(' + (0x1000 + p.rec.proptype) + ')">Object script</button>');
    if (refExists(p.propResid))
      acts.push('<button class="sv-chip" onclick="jumpToResource(' + p.propResid + ')">Prop list</button>');
    acts.push('<button class="sv-chip" onclick="togglePropEdit(' + p.propResid + ',' + p.rec.index + ')">Edit</button>');
    // The lock/key cross-references: a locked thing offers its keys, a key
    // offers its locks, each chip a jump to the other end.
    if (p.rec.d1 && classHasMember(p.rec.proptype, 52))
      for (const k of keysForLock(p.rec.d1)) { const c = keyLocationChip(k); if (c) acts.push(c); }
    if (p.rec.proptype === KEY_PROPTYPE && p.rec.d1)
      for (const l of locksForKey(p.rec.d1).slice(0, 8)) acts.push(lockLocationChip(l));
    // A functional portal offers the trip: jump to the square its zoneport
    // lands on, the way the lock/key chips jump to the other end of a lock.
    {
      const dest = propTravelsTo(p.rec, window.CUR_MAP ? window.CUR_MAP.resid : 0);
      if (dest && refExists(dest.resid))
        acts.push('<button class="sv-chip" onclick="showSquareOnMap(' + dest.resid + ',' + dest.x + ',' + dest.y +
                  ')">Go to ' + svEsc(zoneNameFor(dest.resid) || dest.name) + '</button>');
    }
    const contents = containerContents(p.rec);
    const slot = contents.length ? ('insp-box-' + p.rec.index) : null;
    if (slot) boxes.push([slot, p.rec, contents]);
    parts.push('<div class="inspCard"><b>' +
      svEsc(recDisplayName(p.rec, p.tileId)) +
      '</b> <span class="inspDim">record ' + p.rec.index +
      (ways.length ? ' · ' + svEsc(ways.join(', ')) : '') + '</span>' +
      '<dl class="inspRows">' + rows + '</dl>' +
      (slot ? '<div id="' + slot + '"></div>' : '') +
      '<div class="inspActs">' + acts.join('') + '</div>' +
      '<div id="propEdit-' + p.rec.index + '" class="peForm" style="display:none"></div></div>');
  }

  if (!hits.length && !people.length && !exits.length && !edges.length && !faux && !needsRope)
    parts.push('<div class="inspDim">Nothing but terrain on this square.</div>');

  host.innerHTML = parts.join('');
  host.style.display = 'block';
  // The zoomrect is a canvas, so it is built and hung in place afterwards
  // rather than serialised into the string above.
  for (const [slot, rec, contents] of boxes) {
    const el = document.getElementById(slot);
    if (el) el.appendChild(buildContainerView(rec, contents));
  }
}

function renderMapPreview() {
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid] = window.CUR_RESIDS[idx];
  document.getElementById('resourceNav').style.display = 'flex';
  document.getElementById('backToSheet').style.display = 'block';
  renderMapResource(resid);
}

/* One map, rendered into the map panel.

   Split out of renderMapPreview so the World tab can open the world map
   without going through a gallery and a resource dropdown at all. Everything
   below is about the map itself; the two lines that were about the gallery it
   had been reached from are the caller's business now, because the World tab
   has no gallery to go back to. The bytes come from getResourceBytes rather
   than from the (resid, offset, length) triple the dropdown carries, which is
   the same slice of the same ARCHIVE.bytes -- see js/delv-archive.js. */
function renderMapResource(resid) {
  const out = document.getElementById('output');
  try {
    // Through the World tab's cache when that is what is open, so a map is
    // rendered once rather than once for the transition and again for the
    // panel it lands in. Everywhere else this is an uncached render, exactly
    // as it was: caching all 42 maps for the gallery would be hundreds of
    // megabytes of backing store for maps nobody is going back to.
    const entry = mapRenderFor(resid, window.CUR_SUBN === 'WORLD');
    if (!entry) { out.textContent = 'No such map resource 0x' + resid.toString(16).toUpperCase(); return; }
    const mapData = entry.mapData, wasDecrypted = entry.wasDecrypted, usedFallback = entry.usedFallback;

    document.getElementById('mapPreview').style.display = 'block';
    /* The square's details stand beside the map on a wide screen. Set once
       here rather than toggled with the inspector, because
       clearMapInspector always shows it -- with the "click any square" hint
       where there is nothing selected -- so there is no empty-column state
       to guard against. A class and not an inline style: a check compares
       display, height and padding on this panel's elements across a visit to
       the World tab, and writing positions from script would trip it for a
       reason unrelated to what it guards. */
    document.getElementById('mapPreview').classList.add('hasInspect');
    document.getElementById('zoomControls').style.display = 'none';
    document.getElementById('singlePreview').style.display = 'none';
    document.getElementById('textPreview').style.display = 'none';
    const ac = document.getElementById('atlasCanvas');
    if (ac) { ac.style.display = 'none'; }
    const af = document.getElementById('atlasFolkCanvas');
    if (af) { af.style.display = 'none'; }

    const lbl = labelFor(resid);
    const result = entry.result;
    const wrap = document.getElementById('mapCanvasWrap');
    wrap.innerHTML = '';
    // The lens lives in the viewport, not the wrap, so it survives the wipe
    // above -- and would show the PREVIOUS map's window over this one until
    // its repaint lands. Hide it now; restoreOrFitMap's transform reschedules.
    hideDetailLens(true);
    if (!result) {
      document.getElementById('mapLabel').textContent =
        '0x' + resid.toString(16).toUpperCase() + (lbl ? ' - ' + lbl : '') + '  |  (not readable as a valid map)';
      out.textContent = "The page could not render map 0x" + resid.toString(16).toUpperCase() + ": its header is not valid (the decryption went wrong, or it is not a map).";
      currentResid = resid;
      return;
    }
    result.canvas.id = 'mapTerrainCanvas';
    wrap.appendChild(result.canvas);
    window.CUR_MAP = { resid, level: resid & 0xFF, TS: result.tileSize,
                       width: result.canvas.width, height: result.canvas.height,
                       canvas: result.canvas, m: result.m, animCells: result.animCells,
                       animReplay: result.animReplay,
                       backdrop: result.backdrop, backdropCells: result.backdropCells, backdropFrame: 0,
                       props: result.props, drawOps: result.drawOps, propResid: result.propResid,
                       allProps: result.allProps,
                       tilesW: result.width, tilesH: result.height, mapData,
                       roofSections: mapRoofSections(resid) };
    // Drop the previous map's selection without going through
    // setMapSelection, which would take this map's remembered one with it.
    window.MAP_SEL = null;
    // The slider's ceiling scales with how far the base tile size is below
    // native: 400% of a TS=32 map is 128 screen px per tile, so a TS=8 map
    // deserves 1600% to reach the same place -- and the detail lens renders
    // that at the real art, not an 8px blur.
    const zs = document.getElementById('mapZoomSlider');
    if (zs) zs.max = Math.round(400 * 32 / result.tileSize);
    clearMapInspector();
    startMapAnimation();
    toggleRoofs(window.MAP_ROOFS);   // draws the layer and updates the note
    refreshPathPicker();   // before the marks: the Path mark reads its choice
    drawMapMarks();
    buildCharacterLayer();
    setupMapViewportInteraction();
    requestAnimationFrame(() => restoreOrFitMap(resid));
    document.getElementById('mapLabel').textContent =
      '0x' + resid.toString(16).toUpperCase() + (lbl ? ' - ' + lbl : '') + editorNameSuffix(resid, lbl) +
      '  |  ' + result.width + 'x' + result.height + ' tiles' +
      '  |  ' + result.propCount + ' props drawn' +
      (window.CUR_MAP.roofSections.length
        ? '  |  ' + window.CUR_MAP.roofSections.length + ' roof sections' : '') +
      (wasDecrypted ? '  |  decrypted' : '') +
      (usedFallback ? '  |  (auto-decrypt guess corrected)' : '');
    const mp = document.getElementById('mapParts');
    if (mp) mp.innerHTML = linksFold(partsStrip('Made of', mapParts(resid, result.propResid)));
    out.textContent = "Rendered map 0x" + resid.toString(16).toUpperCase() +
      (lbl ? " (" + lbl + ")" : "") + " with " + result.propCount + " props";
    currentResid = resid;
  } catch(err) { out.textContent = "Map render error: " + err.message; }
}


/* ---------------------------------------------------------------------------
   The maps the World tab draws with
   ---------------------------------------------------------------------------
   Renders, thumbnails and the measurements that place them. The Atlas section
   below is what puts them on screen; this is what it puts there.

   The one fact everything here rests on, and it was measured before any of it
   was built: the world map does not contain the towns. It draws Cademia as a
   pictogram four squares across, and Cademia's own map is 128x128 squares.
   Sliding every zone map over the world grid at every offset, the best
   tile-for-tile agreement any of them reaches is 44%, and that is the 24x16
   Sitia bridge matching open water. So a town cannot be revealed by
   magnifying the world map, and it must not be pasted onto the world grid at
   1:1 either -- Cademia would cover a quarter of the continent. What relates
   the two is the pictogram's own size, which gatewayRatio measures.
--------------------------------------------------------------------------- */
let worldGateTimer = null;
const zoneMapCache = derivedMap('zoneMapCache');
const worldThumbs = derivedMap('worldThumbs');

/* Decrypt and render a map, and -- for the World tab -- keep it.

   The cache is the reason a crossing is quick. Without it a town was rendered
   TWICE on the way in, once into the overlay that fades up and once into the
   panel the overlay uncovers, and both of those happened inside the
   transition: Cademia is 128x128 squares with props on most of them, and the
   fade was covering that work rather than covering a change of place. Now the
   overlay and the panel are handed the same render; the preload that once
   did it before the reader reached the threshold went with the old World
   renderer, and its last functions on 25 September 2026.

   ZONE_CACHE_KEEP entries, most-recently-used last, and the world map itself
   is pinned: it is what the reader keeps coming back to, and it is also the
   bitmap the scenery behind a town is drawn from. Everything else is evicted
   oldest-first, because these are whole-map bitmaps -- renderMapVisual
   budgets to 6 megapixels, so one can be 24 MB -- and on iOS the budget is a
   cliff rather than a slope. */
const ZONE_CACHE_KEEP = IS_IOS_WEBKIT ? 2 : 4;

/* A render, but only if it is free. The World tab paints from a pointer and
   from an animation frame, and a full map render is the expensive thing in
   this file: ZONE_CACHE_KEEP is two on iOS and four elsewhere, so a handful
   of large nodes on screen at once evict each other and re-render every
   frame, which is what the judder is, both times it has been reported.

   So while the view is moving, a caller that can do without takes the cached
   entry or nothing. Everything that uses this already has a way to draw
   without a render (the miniature, no people, no rings), and the sharp paint
   arrives on settle by itself: setTouching(false) schedules one and the
   animation's done() calls one. Callers that must have the real thing, the
   hover card and the inspector, keep calling mapRenderFor directly. */
function mapRenderIfCheap(resid) {
  if (zoneMapCache.has(resid)) return mapRenderFor(resid, true);
  if (!atlasInMotion()) atlasRenderStep(resid);
  return null;
}
/* A render the World tab wants and has not got is made a slice at a time
   (25 September 2026). Until then this asked for it in one piece whenever
   the view was still, and for a big zone that one piece was the jerk: the
   miniature was on screen, the gesture ended, and the next frame waited on
   Cademia's whole render. Now the miniature stays while
   renderMapVisualSteps runs a few milliseconds a frame, and the render
   takes over when it is done. Nothing is started or advanced while the
   view is moving, which is the guard of 12 September kept: a gesture's
   frames are the gesture's. One zone at a time, the latest asked for;
   a zone asked for again while it is under way keeps its progress. Made on
   the page's open file under the Walls setting it started with, and thrown
   away if either changed before it finished. */
const ATLAS_RENDER_SLICE_MS = 6;
window.ATLAS_RENDER_JOB = null;
function atlasRenderStep(resid) {
  const j = window.ATLAS_RENDER_JOB;
  if (j && j.resid === resid) return;
  window.ATLAS_RENDER_JOB = { resid, arc: ARCHIVE, walls: !!window.MAP_WALLS, gen: null, mapData: null, wasDecrypted: false, usedFallback: false };
  if (!j) requestAnimationFrame(atlasRenderTick);
}
/* The largest place on the surface, rendered before it is asked for
   (29 September 2026). Cademia is 128 squares a side and every other town
   64 or less, so its render is four times theirs, and made a slice at a
   time only once the view had come to rest on it, it was the one wait the
   maintainer still saw: a tap on Cademia from the world flew in and then
   sat on the miniature while the render was made. So once the miniatures
   are made and the view is still, the largest place's render is made in
   the background, a slice at a time like any other, and kept. Only while
   no place on screen is using its render: the cache is full from the
   scene's own building, which renders every town to learn its size, so
   the prefetch evicts, and evicting a render on screen would have it made
   again, the two taking turns for ever. What it evicts is a render nobody
   is looking at. */
// Whether a place on screen, other than the world, draws from its render:
// big enough for it (drawAtlasNode's 448 px), for its people, or for tiles.
function atlasRendersInUse() {
  return (window.ATLAS_DRAWN || []).some(d => d.node.depth &&
    (d.r.w >= 448 || d.ppt >= window.ATLAS_TUNE.peopleAt || atlasTileTS(d.node, d.ppt)));
}
function atlasPrefetchRender() {
  if (window.CUR_SUBN !== 'WORLD' || window.ATLAS_RENDER_JOB || atlasRendersInUse()) return;
  const sc = DERIVED.ATLAS_SCENE;
  if (!sc) return;
  let best = null;
  for (const n of sc.nodes) if (n.depth && (!best || n.w * n.h > best.w * best.h)) best = n;
  if (!best || zoneMapCache.has(best.resid)) return;
  atlasWhenStill(() => {
    if (window.CUR_SUBN === 'WORLD' && !window.ATLAS_RENDER_JOB && !zoneMapCache.has(best.resid) &&
        !atlasRendersInUse()) atlasRenderStep(best.resid);
  }, 2000);
}
function atlasRenderTick() {
  const j = window.ATLAS_RENDER_JOB;
  if (!j) return;
  if (j.arc !== ARCHIVE || j.walls !== !!window.MAP_WALLS || zoneMapCache.has(j.resid)) { window.ATLAS_RENDER_JOB = null; return; }
  if (atlasInMotion()) { requestAnimationFrame(atlasRenderTick); return; }
  const t0 = performance.now();
  try {
    if (!j.gen) {
      // renderMapUncached's reading of the map, the fallback included.
      const raw = getResourceBytes(ARCHIVE, j.resid);
      if (!raw) { window.ATLAS_RENDER_JOB = null; return; }
      let { data, wasDecrypted } = smartDecrypt(raw, j.resid);
      let usedFallback = false;
      if (!parseDelverMap(data)) {
        const alt = wasDecrypted ? raw : decryptResource(raw, j.resid);
        if (parseDelverMap(alt)) { data = alt; wasDecrypted = !wasDecrypted; usedFallback = true; }
      }
      Object.assign(j, { mapData: data, wasDecrypted, usedFallback, gen: renderMapVisualSteps(j.resid, data) });
    }
    let r = j.gen.next();
    while (!r.done && performance.now() - t0 < ATLAS_RENDER_SLICE_MS) r = j.gen.next();
    if (r.done) {
      window.ATLAS_RENDER_JOB = null;
      if (r.value) zoneCachePut(j.resid, { resid: j.resid, result: r.value, mapData: j.mapData, wasDecrypted: j.wasDecrypted, usedFallback: j.usedFallback });
      if (typeof paintAtlas === 'function') paintAtlas();
      // Another zone may have been asked for by that paint.
      if (window.ATLAS_RENDER_JOB) requestAnimationFrame(atlasRenderTick);
      else atlasPrefetchRender();
      return;
    }
  } catch (e) { quiet(e, 'a render a slice at a time, 0x' + j.resid.toString(16)); window.ATLAS_RENDER_JOB = null; return; }
  requestAnimationFrame(atlasRenderTick);
}
/* A square as the game prints it: X and Y in lower-case hex. The cheats'
   Look prints "Location %x,%x,%x" and the jump asks "Jump from [%x,%x,%x]"
   (TGameSys::LookCommand), so a square the site calls 62, 57 is 3e, 39 to
   the game. Both count from the top left; only the base differs (the
   maintainer kept landing somewhere else, 23 September 2026). */
function gameSquare(tx, ty) { return 'hex ' + tx.toString(16) + ', ' + ty.toString(16); }
function mapRenderFor(resid, cache) {
  if (zoneMapCache.has(resid)) {
    const hit = zoneMapCache.get(resid);
    zoneMapCache.delete(resid); zoneMapCache.set(resid, hit);   // most recent last
    return hit;
  }
  const entry = renderMapUncached(resid);
  if (cache && entry && entry.result) zoneCachePut(resid, entry);
  return entry;
}
// Keep a render, making room the way the cache always has: oldest first,
// never the world's.
function zoneCachePut(resid, entry) {
  for (const k of zoneMapCache.keys()) {
    if (zoneMapCache.size < ZONE_CACHE_KEEP) break;
    if (k !== WORLD_MAP_RESID) zoneMapCache.delete(k);
  }
  zoneMapCache.set(resid, entry);
}

/* A render nobody else holds a reference to.

   The town miniature (gone since 25 September 2026) painted roofs straight
   onto the canvas it was about to shrink, which is only safe on a canvas of
   its own: handed a cached entry it would have roofed the copy the panel puts
   on screen, permanently and only for the towns whose miniature had happened
   to be built. Kept for whatever draws on a render next. */
function renderMapUncached(resid) {
  let entry = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (!raw) return null;
    // Maps are structured binary data, not text -- the printable-ASCII /
    // entropy heuristic in smartDecrypt() was designed for narrative text and
    // is unreliable here. Try its pick first, but fall back to the other
    // version if the header does not parse as a plausible map;
    // parseDelverMap()'s own bounds checks make this safe either way.
    let { data, wasDecrypted } = smartDecrypt(raw, resid);
    let usedFallback = false;
    if (!parseDelverMap(data)) {
      const alt = wasDecrypted ? raw : decryptResource(raw, resid);
      if (parseDelverMap(alt)) { data = alt; wasDecrypted = !wasDecrypted; usedFallback = true; }
    }
    entry = { resid, result: renderMapVisual(resid, data), mapData: data, wasDecrypted, usedFallback };
  } catch (e) { return null; }
  return entry;
}

/* Drop a cached render. The walls toggle re-renders the panel's terrain and
   swaps the canvas out from under it (rerenderMapTerrain), so a kept entry
   would hand the next visit a detached canvas drawn under the other setting. */
function forgetZoneRender(resid) { zoneMapCache.delete(resid); }

/* ---------------------------------------------------------------------------
   The towns, on the world map
   ---------------------------------------------------------------------------
   The world map draws Cademia as a four-square pictogram. What it stands for
   is a 128x128 map of streets and houses, and the tab's whole business is the
   join between the two -- so the pictogram is replaced, above the zoom at
   which anything could be made out, by the town itself scaled into the same
   four squares. The reader then sees a town where a town is, at every size
   from a smudge on the coast to its own streets, and the crossing stops being
   a substitution of one picture for another.

   Two sizes of each, and both roofed and bare, which is what makes the
   approach continuous rather than one blurry step. A town is drawn from the
   smallest level that is at least as big as it is on screen, so it sharpens
   as the view comes in instead of being one 192-pixel picture magnified
   towards the crossing; and the roofs lift on the way in (ROOF_LIFT) by
   cross-fading the bare level over the roofed one, so by the time the view
   crosses, the roofs are already coming off and updateRoofFade carries on
   from where this left it. A town seen from far off is roofs; a town you are
   walking into is not.

   Only open-edged destinations get one. A cave's inside is not what is at
   that spot on the world map, and painting it there would say it was.

   Level 1 is built for every town on idle; level 2 only for the one the view
   is beside, because it is nine times the pixels. Both come from a single
   render, which is then thrown away: the bare variants are taken off the
   clean canvas, the roofs are painted on, and the roofed variants are taken
   off the same canvas afterwards. All 24 destinations at FULL size measures
   275 MB, which is why they are not all kept unless the reader asks for it
   all of them as thumbnails is a few megabytes,
   which is why these are.
--------------------------------------------------------------------------- */
const THUMB_LEVELS = [192, 448];

/* Screen pixels per world square over which the roofs come off a town while
   the view is still outside it, so that a town opens with its roofs already
   coming off rather than as a change of subject. */
const ROOF_LIFT = [18, 44];

function thumbKey(resid, size, roofed) { return resid + ':' + size + ':' + (roofed ? 'r' : 'b'); }

/* The built part of a map: where the town actually is, inside the field of
   rock or grass the map is padded out with.

   Cademia's map is 128x128 squares and its town is 107 of them; the Farm's
   is 32x32 and its farm is 26 by 11. Drawing the whole map into a pictogram's
   footprint therefore drew mostly empty ground and put the town, small, in
   the middle of it. The bounding box of the props is what a settlement is:
   walls, doors, furniture, crops. Trimmed to the 2nd and 98th percentile on
   each axis, so one lamp-post out on the moor does not double the box. */
const contentBoxes = derivedMap('contentBoxes');
function contentBox(resid) {
  if (contentBoxes.has(resid)) return contentBoxes.get(resid);
  let box = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid + 0x100);
    const recs = raw ? parseDelverPropList(smartDecrypt(raw, resid + 0x100).data)
      .filter(r => r.onMap && r.flags !== 0xFF && !(r.flags & 0x58) &&
                   r.flags !== 0x42 && r.flags !== 0x44) : [];
    if (recs.length >= 8) {
      const xs = recs.map(r => r.x).sort((a, b) => a - b);
      const ys = recs.map(r => r.y).sort((a, b) => a - b);
      const q = (a, p) => a[Math.min(a.length - 1, Math.max(0, Math.round((a.length - 1) * p)))];
      box = { x0: q(xs, 0.02), y0: q(ys, 0.02), x1: q(xs, 0.98), y1: q(ys, 0.98) };
    }
  } catch (e) { quiet(e); }
  contentBoxes.set(resid, box);
  return box;
}

/* How many squares of a region map one square of the world map stands for.

   Not a guess and not a constant: it is measured off the archive. The
   gateways whose pictogram covers more than one square are the ones whose
   icon says something about size -- Cademia is four `small city` props
   deliberately placed in a 4x4 block, and its town is 107 squares across, so
   the world map is drawn at about one square to twenty-seven. Catamarca says
   27, Kosha 22, Pnyx 21, Odemia 24. The median of all of them is the ratio,
   so a modded archive gets its own answer.

   Used to size every miniature, including the ones whose footprint is a
   single square: a `large city` prop is a symbol rather than a measurement,
   so the Farm and the Encampment should not come out the same size when one
   is 26 squares of content and the other is 35. */
function worldSquareRatio() {
  if (DERIVED._WORLD_RATIO) return DERIVED._WORLD_RATIO;
  const rs = [];
  for (const gw of worldGateways()) {
    if (gw.sealed) continue;
    const fw = gw.x1 - gw.x0 + 1, fh = gw.y1 - gw.y0 + 1;
    if (fw < 2 || fh < 2) continue;                 // see gatewayRatio: one axis is the sprite
    const b = contentBox(gw.destResid);
    if (!b) continue;
    rs.push((b.x1 - b.x0 + 1) / fw);
    rs.push((b.y1 - b.y0 + 1) / fh);
  }
  rs.sort((a, b) => a - b);
  const median = rs.length ? rs[rs.length >> 1] : 24;
  return (DERIVED._WORLD_RATIO = Math.max(4, Math.min(64, median)));
}

/* The ratio for one place.

   Where its own pictogram covers more than one square, that pictogram is the
   answer and the median is not: the world map is stating how big this place
   is, and a place should land on its own icon rather than on the average of
   everyone else's. Cademia is four `small city` props in a 4x4 block over 107
   squares of town, so its ratio is about 27 while the median of every place
   is 21 -- and using 21 drew Cademia half again as wide as the thing it was
   standing on.

   A one-square icon is a symbol rather than a measurement -- a single `large
   city` prop stands for the Farm and for the Encampment alike, which are 26
   and 35 squares of content -- so those fall back to the measured median and
   come out at their real relative sizes. */
function gatewayRatio(gw) {
  const fw = gw.x1 - gw.x0 + 1, fh = gw.y1 - gw.y0 + 1;
  const b = contentBox(gw.destResid);
  /* Both axes, and that is the whole of the rule.

     A block of props placed two or four squares each way -- Cademia, Kosha,
     Catamarca -- is somebody saying how big the place is. A single sprite
     that happens to be two tiles tall is not: a cave mouth is drawn 1x2
     because that is the shape of the picture of a cave mouth, and reading it
     as "this cave system is two world squares" gave the same Underground
     three different sizes depending on which of its three mouths was asked.
     One axis is the sprite; two axes is a decision. */
  if (b && fw >= 2 && fh >= 2) {
    const r = ((b.x1 - b.x0 + 1) / fw + (b.y1 - b.y0 + 1) / fh) / 2;
    if (r > 2) return r;
  }
  return worldSquareRatio();
}

/* Build every variant of one town from a single render.

   The feather is two destination-in passes, a horizontal ramp and then a
   vertical one, so the alphas multiply into a rectangular vignette. A hard
   edge would put a framed picture on the world map; the ramp lets the town's
   own outskirts run into the country the world map draws around it, which at
   Cademia is the same red rock on both sides.

   Never through mapRenderFor: the roofs below are painted onto this canvas,
   and a cached entry is the one the panel puts on screen. */
function buildThumbsFor(gw, sizes) {
  if (!gw || gw.sealed) return;
  const need = sizes.filter(sz => !worldThumbs.has(thumbKey(gw.destResid, sz, true)));
  if (!need.length) return;
  try {
    const e = renderMapUncached(gw.destResid);
    if (!e || !e.result) return;
    const src = e.result.canvas;
    const TS = e.result.tileSize;
    // The crop: the built part, with a margin so the outskirts are not cut
    // off hard, clamped to the map.
    const b = contentBox(gw.destResid);
    const mw = e.result.width, mh = e.result.height;
    let cx0 = 0, cy0 = 0, cx1 = mw - 1, cy1 = mh - 1;
    if (b) {
      const pad = Math.max(2, Math.round(Math.max(b.x1 - b.x0, b.y1 - b.y0) * 0.08));
      cx0 = Math.max(0, b.x0 - pad); cy0 = Math.max(0, b.y0 - pad);
      cx1 = Math.min(mw - 1, b.x1 + pad); cy1 = Math.min(mh - 1, b.y1 + pad);
    }
    const sx = cx0 * TS, sy = cy0 * TS;
    const sw = (cx1 - cx0 + 1) * TS, sh = (cy1 - cy0 + 1) * TS;
    const shrink = (sz) => {
      const k = sz / Math.max(sw, sh);
      const w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const tc = c.getContext('2d');
      if (!tc) return null;
      tc.imageSmoothingEnabled = true;
      tc.drawImage(src, sx, sy, sw, sh, 0, 0, w, h);
      tc.globalCompositeOperation = 'destination-in';
      const ramp = (g0) => { g0.addColorStop(0, 'rgba(0,0,0,0)'); g0.addColorStop(0.22, 'rgba(0,0,0,1)');
                             g0.addColorStop(0.78, 'rgba(0,0,0,1)'); g0.addColorStop(1, 'rgba(0,0,0,0)'); return g0; };
      tc.fillStyle = ramp(tc.createLinearGradient(0, 0, w, 0));
      tc.fillRect(0, 0, w, h);
      tc.fillStyle = ramp(tc.createLinearGradient(0, 0, 0, h));
      tc.fillRect(0, 0, w, h);
      tc.globalCompositeOperation = 'source-over';
      // The crop is carried with the picture: it is what sizes the miniature
      // on the world map, and what lets the crossing land the real map
      // exactly where the miniature was.
      return { canvas: c, x0: cx0, y0: cy0, x1: cx1, y1: cy1, TS };
    };
    // Bare first, off the clean canvas; then the roofs go on and the same
    // sizes are taken again. One render, every variant.
    for (const sz of need) worldThumbs.set(thumbKey(gw.destResid, sz, false), shrink(sz));
    const rc = src.getContext('2d');
    if (rc) paintRoofsInto(rc, e.result.tileSize, e.result.m, mapRoofSections(gw.destResid));
    for (const sz of need) worldThumbs.set(thumbKey(gw.destResid, sz, true), shrink(sz));
  } catch (err) { quiet(err); }
}

/* Draw a town into a rectangle, from the best level it has.

   The smallest level at least as wide as the rectangle, so a town sharpens as
   the view comes in rather than being magnified; the biggest it has when it
   has nothing big enough yet. `roofT` is how much roof is left: the bare
   level goes down first and the roofed one over it at that strength, which is
   an ordinary cross-fade because the roofed picture is the bare one with
   roofs added. */
function drawTown(ctx, gw, rect, alpha, roofT) {
  let lvl = null;
  for (const sz of THUMB_LEVELS) {
    const t = worldThumbs.get(thumbKey(gw.destResid, sz, true));
    if (!t) continue;
    lvl = sz;
    if (t.canvas.width >= rect.w) break;
  }
  if (lvl === null) return false;
  const roofed = worldThumbs.get(thumbKey(gw.destResid, lvl, true));
  const bare = worldThumbs.get(thumbKey(gw.destResid, lvl, false));
  ctx.imageSmoothingEnabled = true;
  if (bare && roofT < 0.98) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(bare.canvas, rect.x, rect.y, rect.w, rect.h);
    if (roofT > 0.02) {
      ctx.globalAlpha = alpha * roofT;
      ctx.drawImage(roofed.canvas, rect.x, rect.y, rect.w, rect.h);
    }
  } else {
    ctx.globalAlpha = alpha;
    ctx.drawImage(roofed.canvas, rect.x, rect.y, rect.w, rect.h);
  }
  ctx.globalAlpha = 1;
  return true;
}

/* Build the miniatures a few at a time, while nothing else is happening.

   One town per idle slice: each one is a whole map rendered and thrown away,
   and a loop over 19 of them would be a visible stall on the first zoom. They
   arrive over a second or two of an ordinary visit, and the world map
   repaints as each lands.

   Only while the World tab is showing. The queue went on after the reader
   left it, and on a phone each town is a whole map render on the main
   thread: profiled at a sixth of desktop speed, the sprites gallery opened
   a few seconds after the page spent more time building towns behind it
   than drawing itself (the maintainer, 27 September 2026: "takes longer
   than needed to load"). Off World a slice stops the queue, and
   renderAtlasView starts it again on the way back. */
let thumbQueue = null;
function buildWorldThumbs() {
  if (thumbQueue) return;
  const todo = worldGateways().filter(g => !g.sealed &&
    !worldThumbs.has(thumbKey(g.destResid, THUMB_LEVELS[0], true)));
  if (!todo.length) { atlasPrefetchRender(); return; }
  const step = () => {
    thumbQueue = null;
    if (window.CUR_SUBN !== 'WORLD') return;
    const gw = todo.shift();
    if (!gw) return;
    buildThumbsFor(gw, [THUMB_LEVELS[0]]);
    if (window.CUR_SUBN === 'WORLD') paintAtlas();
    if (todo.length) buildWorldThumbs(); else atlasPrefetchRender();
  };
  thumbQueue = 1;
  atlasWhenStill(step, 2000);
}

/* The bigger level, for the one town the view is beside. Nine times the
   pixels of the first, so it is not built for the other eighteen. */
let levelQueue = null;

/* The "Keep every place" preload and the "Full resolution" canvas were
   offered here from 9 to 10 September 2026 and removed at the maintainer's
   word once the ordinary cache and the mip levels made the world smooth and
   sharp without them (NOTES.md, v1.48.0). */

/* Render the place the reader is about to walk into, before they walk into
   it, while nothing else is happening.

   Only ever the gateway currently ringed -- so this fires when the view is
   already zoomed in beside one, not while panning across the whole world --
   and only one at a time. requestIdleCallback where there is one, because
   this is a whole map render and it must never land in the middle of a drag;
   a plain timer where there is not. */
let zonePrefetching = 0;
/* The world map rings its gateways; a town shows the world around it and
   watches for the reader zooming back out of it. One settle, because they are
   two halves of one continuous view rather than two screens. */
/* Zooming out of anywhere goes back up a level.

   This is what keeps the tab from feeling like a set of rooms: the way in is
   a zoom, so the way out is the same gesture reversed, and the button below
   the map is a convenience rather than the only exit. It applies to a cave
   and a cellar as much as to a town -- an underground reached down a stair
   from Cademia zooms back out into Cademia, not into the world, because up a
   level is where you came from rather than where the tab started.

   The threshold is a fraction of the map's own fit, so it is the same gesture
   on a 16-square house and on Cademia: zoom out until the map is comfortably
   smaller than the panel and you have left it. */
const WORLD_LEAVE_FACTOR = 0.62;

/* Where you were before this place, and how you got here.

   One trail was enough while everything was entered from the world map. It
   is not enough for a cellar under a farmhouse or a sewer under Cademia:
   "back" from there is the room above, not the world, and with a single trail
   there was no way to say so -- zooming out of an underground did nothing at
   all, which is how it was reported. */
// What the way back is called, for the button that offers it.
// The button under the map. Same landing as zooming out, so the two ways up
// agree about where they put you.
/* Which gateway the view is on, and how close it is to crossing.

   Only one at a time, and it is the one nearest the middle: two rings at once
   says nothing about which one zooming further would open. */
/* What the World tab draws over the world map: the towns themselves in place
   of their pictograms, a name on every way off the map, and a ring on the one
   the view is about to cross into.

   The map underneath is never altered. Everything here is one overlay canvas
   in screen space, so the world map is still the world map -- which is the
   point of doing this as a transition rather than as a magnification.

   The miniatures fade in over THUMB_FADE, because below that a town scaled
   into four squares is a smudge and the game's own pictogram, which was drawn
   to be read at that size, is the better picture. Above it the town is the
   better picture, and it is the same town the crossing lands on. */
/* Screen pixels per world square over which the game's own pictogram gives
   way to the town itself.

   Later than it was. The pictogram used to be handed over at 10 because
   below that it was mush -- but that was the budgeted base being magnified
   without the lens, not the pictogram. Now that lensActive engages on
   magnification rather than on an absolute size, the world map is sharp from
   about 6 px a square on a phone, and the sprite Ambrosia drew is worth
   looking at for a while before the miniature takes it over. That is the
   stage the ladder was missing: coarse whole world, then the sharp world map
   with its own icons, then the town, then the town's streets. */
const THUMB_FADE = [22, 34];      // screen px per world square: none, then full

/* Keep what is painted registered with the map while the view moves.

   The overlay is repainted on the settle, but the map itself moves
   continuously under a CSS transform -- so between the two the miniatures and
   the names sat still in screen space while the ground slid out from under
   them, then snapped back. That is the drift, and it is the same problem the
   detail lens has: the pixels were painted for gateView and belong under
   mapView, which is an ordinary similarity, and a similarity is exactly what
   a CSS transform is. A pan is a pure translate, so a pan is now exact. */
let gateView = { x: 0, y: 0, scale: 0 };
/* The world's own bitmap, for the scenery around a town.

   This is the render the world map itself was drawn from -- pinned in
   zoneMapCache, so the scenery costs no second copy of a 2048x2048 canvas. A
   deep link that opens straight into a town never drew one, and mapRenderFor
   makes it on demand and then pins it like any other. */
// The gateway a town was entered by, when it was one.
/* ---------------------------------------------------------------------------
   The country around a town, painted properly
   ---------------------------------------------------------------------------
   The scenery used to be the world map's own base canvas, magnified. On a
   desktop that is TS=8 stretched three or four times; on a phone it is TS=4,
   and it looked like a photograph of a lawn taken through a window. The
   world map's own art is 32 pixels a tile and none of it was being used.

   So the surround is its own plate now: SURROUND_PLATE_SQUARES of world
   around the gateway, painted through the detail lens's own region painter at
   SURROUND_PLATE_TS, once, and kept. It is drawn over the old blurred base
   rather than instead of it, so anything past the plate's edge still has
   ground under it rather than a hole.

   Its size is the same trade every canvas here makes: big enough that a town
   zoomed out to the point of leaving still sits inside it, small enough that
   two of them are not a problem on a phone. */
const SURROUND_PLATE_SQUARES = 72;
const SURROUND_PLATE_TS = IS_IOS_WEBKIT ? 12 : 16;

/* Where the world sits behind a town, in screen pixels.

   The town's canvas occupies (view.x, view.y, cw*scale, ch*scale). The
   gateway's own footprint centre is pinned to the middle of that rectangle,
   and one world square is drawn SURROUND_SPAN-th of the town's width -- so
   the two move as one scene under a pan or a zoom, and the coast that was
   beside the icon is still beside the town. */
/* Paint the world behind a town.

   Upsampled, and left at its own brightness. It was dimmed at first, on the
   theory that scenery should recede -- but the country beside a town is the
   whole reason for drawing it, and a wash over it read as a modal backdrop:
   the town looked like a dialog over the world rather than a place in it. The
   softness of the upsample is enough to keep it from being read square by
   square. */
// Is the map currently sitting inside the world rather than in a panel?
/* Carry the scenery with the map between repaints.

   This is the one layer over the map that was not slid, and it is the one
   that could least afford not to be. Everything on it is placed as
   `origin + worldSquare x pitch`, and the origin is pinned to the gateway --
   Cademia's is 171 squares from the corner of the world -- so a pitch one
   zoom step stale moves the picture by 171 times that error. Panning was
   survivable; zooming threw the country a few hundred pixels to the left and
   snapped it back on the settle, which is exactly how it was reported.

   The map's own transform is the correct one, and the algebra says so: a
   surround point sits at S'(w) = r*S(w) + (x' - r*x), which is a translate
   and a scale about the element's own origin -- the same shape as slideLens,
   with no margin to account for. */
let surroundView = { x: 0, y: 0, scale: 0 };
/* Soften the rectangle a zone map ends on, so it runs into the country drawn
   around it.

   The tiles at a region's edge are the ordinary ones -- open water, grass,
   rock -- and they are broadly the same tiles the world map has at that spot,
   because they are the same ground described twice. A hard rectangular cut
   between the two therefore announces a boundary that the pixels either side
   of it do not actually have. A ramp over the outermost few per cent of the
   map lets one become the other.

   A mask on the wrap rather than on the canvas, so the layers over it --
   characters, roofs, marks -- are cut back with it and nothing hangs over the
   edge on its own. The detail lens is a sibling of the wrap and is not
   masked, which is why this is a percentage and not a pixel count: by the
   zoom at which the lens engages the edge is well off screen. */
/* Cross-fade the map panel to another map.

   The destination is painted into the overlay at the geometry the real view
   is about to adopt, the overlay is faded up over the live map, and the panel
   is swapped underneath while the overlay is opaque. finishWorldFade is the
   second half, on a timer -- and is reachable by name so a harness can run
   the transition to its end without waiting on wall-clock time. */
/* The second half of the transition: swap the panel, then uncover it.

   Every step here happens before the overlay goes, and that ordering is the
   hideWorldGate leaves the cover alone; restoreOrFitMap is called outright
   rather than waited for, because renderMapResource schedules it on an
   animation frame and a frame is long enough to show the panel mid-landing;
   and the scenery is painted before the last line rather than on the next
   settle. Uncovering even one of those early is a flash of grey between two
   views that are meant to be one place. */
// The gazetteer's rows and the inspector's card both come here by port, so
// neither has to carry a gateway object through an inline handler.
/* The gateway chip on a world square, from the map panel's own inspector.

   The panel is Entities > Regions now, so this opens the destination there --
   which is what every other chip in that inspector does. The atlas has its
   own way in, and it is the map itself. */
function enterGatewayByPort(port) {
  const gw = worldGateways().find(g => g.port === port);
  if (gw) showSquareOnMap(gw.destResid, gw.destX, gw.destY);
}

/* The `-> Cademia` chip on a square, wherever the square is.

   Inside the World tab the destination opens in the same panel, so the tab
   does not change under the reader; anywhere else this is exactly the
   showSquareOnMap it replaced, which switches to Entities > Regions and opens
   the map there. */
/* One map, opened inside the World tab.

   `quiet` is for a deep link being applied: the hash is already what it
   should be, and writing it again would push a second history entry for the
   page the reader just navigated to.
/* The one strip the atlas shows, and only where it is needed.

   On the surface there is nothing to say: you are looking at the world, the
   places are named on it, and a summary bar would be a line of prose where a
   line of map could be. Inside somewhere the archive does not locate, there
   is exactly one thing to say -- how you got in, and the way back -- because
   that is the part the ground cannot show you. */
function renderAtlasBar() {
  const bar = document.getElementById('atlasBar');
  if (!bar) return;
  // No world map, no world: a saved game holds only what play changed, and
  // the panel would otherwise be a zoom slider over nothing.
  if (!atlasScene()) {
    bar.style.display = '';
    bar.innerHTML = '<span class="wbNote">This file has no world map (resource 0x' +
      WORLD_MAP_RESID.toString(16).toUpperCase() + '), so there is no world to draw. ' +
      'A saved game contains only what has changed in play. Data \u203a Data Fork lists what it contains.</span>';
    return;
  }
  const below = atlasBelowTop();
  if (!below) { bar.style.display = 'none'; bar.innerHTML = ''; return; }
  bar.style.display = '';
  bar.innerHTML = '<button class="crumbBtn" onclick="atlasRiseOut()">Up to ' +
    svEsc(below.fromName) + '</button>' +
    '<span class="wbWhere">' + svEsc(below.name) + '</span>' +
    '<span class="wbNote">Through the ' + svEsc(below.kind) + ' at (' + below.at.x + ',' + below.at.y + ') in ' + svEsc(below.fromName) + '.</span>';
}
