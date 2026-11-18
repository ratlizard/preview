/* The zone view's furniture: what the map draws over itself, and the
   controls that choose it.

   WHY THIS FILE EXISTS. index.html had grown to some 24,000 lines with every
   sheet, every gallery and every overlay inside it, and the maintainer's
   instruction (13 September 2026) was to stop adding to it. The rule in
   CLAUDE.md draws its line at the DOM -- bytes-to-bytes in js/,
   bytes-to-screen in the page -- and that rule exists to keep the decoders
   checkable against delvmod, not to keep the page one file. A mark that
   arranges what a reader has already read is not a decoder.

   THE TIER. js/mac-*.js have nothing of Cythera; js/delv-archive|graphics|
   script|mechanics.js cover the formats but not the page; js/delv-sheets.js
   covers the sheets. This covers the map view. It is a classic script -- no
   module, no import -- because these pages have to work from a file://
   origin, and it may call functions the inline script declares: classic
   scripts share one global scope and nothing here runs at load time.

   WHAT BELONGS HERE. Something that draws onto the map layers from figures
   already read, and the small state a control needs. The readers it calls
   (loadSchedules, findPath, buildPropBlockers, characterName) stay in the
   page beside everything else that reads the archive. */

/* ---- The Path mark: one character's day -----------------------------------

   Whose day the mark follows: a character index into loadSchedules(), or
   null when nobody on the open map keeps a schedule. */
window.MAP_PATH_CHARACTER = null;

function setMapPathCharacter(i) {
  const v = (i === '' || i === null || i === undefined) ? null : +i;
  window.MAP_PATH_CHARACTER = Number.isFinite(v) ? v : null;
  drawMapMarks();
}

/* Who this map can offer: everyone the schedule table posts on this level at
   any hour of the day, by name. Rebuilt when a map opens, because MAP_MARKS
   persists across maps and the picker must not be left naming somebody who
   is somewhere else entirely; if the person it named is not here, it falls
   to the first who is. */
function refreshPathPicker() {
  const sel = document.getElementById('pathWho');
  const cm = window.CUR_MAP;
  if (!sel || !cm) return;
  const scheds = loadSchedules();
  const here = [];
  for (let i = 0; i < scheds.length; i++) {
    if (scheduleDay(i).some(e => e.mode !== 0 && e.level === cm.level)) here.push({ i, name: characterName(i) });
  }
  here.sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = here.length
    ? here.map(p => '<option value="' + p.i + '">' + svEsc(p.name) + '</option>').join('')
    : '<option value="">nobody keeps a schedule here</option>';
  if (!here.some(p => p.i === window.MAP_PATH_CHARACTER)) window.MAP_PATH_CHARACTER = here.length ? here[0].i : null;
  sel.value = window.MAP_PATH_CHARACTER === null ? '' : String(window.MAP_PATH_CHARACTER);
  sel.disabled = !here.length;
}

/* One character's day, as the line they walk. Draws into whichever context
   drawMapMarks is filling -- the mark layer, the detail lens, or the PNG
   export -- and answers with what it drew, for the legend.

   A schedule is posts, not a route: an hour and a square, and nothing in
   between. What fills the gap is the engine's mover -- walkingPosition
   spends the first stretch of each interval walking the A* route to the next
   post -- so the honest drawing is those routes end to end, which is findPath
   over consecutive posts, with a dot and the hour at each post.

   It is the WHOLE day and does not follow the clock. drawMapMarks is not
   called from the animation loop, and setMapHour redraws the character and
   lighting layers only, so an "at this hour" marker put here would be stale
   the moment the slider moved. Where they are now is already drawn: it is
   the inhabitant standing on the map.

   Only posts on THIS level are joined. A character whose day crosses zones
   leaves the map and comes back, and a line drawn across that gap would
   claim a walk through places this map does not contain. */
function drawSchedulePath(ctx, TS, cm, color, where) {
  const scheds = loadSchedules();
  const character = window.MAP_PATH_CHARACTER;
  const daySchedule = (character !== null && character !== undefined && scheds[character]) ? scheduleDay(character) : [];
  const here = daySchedule.filter(e => e.mode !== 0 && e.level === cm.level).sort((a, b) => a.hour - b.hour);
  if (!here.length) return { stops: 0, name: '' };

  const hourAmPm = h => h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
  const m = cm.m;
  // findPath reads the blockers of whichever map was built last, and its
  // cache is keyed on that, so this has to run before any route is requested
  // for -- exactly as walkingPosition does it.
  if (m) { try { buildPropBlockers(cm.resid, m); } catch (e) { quiet(e); } }

  /* A leg is walked at an hour, and its colour shows which.

     One colour for the whole day could not be read: a day doubles back on
     itself -- out to the shop and home again is the same corridor twice --
     and two identical strokes on the same squares are one stroke to look at,
     so the line showed where she goes and never when (reported 13 September
     2026, "her path is unclear ... maybe we could make it hue-based").

     The hue runs once around the wheel over 24 hours, so the colour IS the
     clock: midnight red, morning yellow-green, afternoon cyan, evening blue.
     A leg is coloured by the hour it LEAVES, because that is the hour the
     reader sees on the dot it starts from.

     Where two legs share squares the later one would still hide the earlier,
     so each leg is drawn on a separate rail: a fixed perpendicular offset by
     leg number, a fraction of a square, which turns a corridor walked twice
     into two parallel strands instead of one. */
  const legs = [];
  if (here.length > 1) {
    for (let i = 0; i < here.length; i++) {
      const a = here[i], b = here[(i + 1) % here.length];
      let leg = null;
      if (m) { try { leg = findPath(m, a.x, a.y, b.x, b.y, keysCarriedBy(character)); } catch (e) { leg = null; } }
      legs.push({ pts: leg && leg.length ? leg : [[a.x, a.y], [b.x, b.y]], hour: a.hour, i });
    }
  }
  /* A rail is a distance on SCREEN, not a fraction of a square.

     It was TS * 0.13, which is four pixels on a map drawn at its native 32
     and under ONE pixel at the zoom a whole zone is read at -- against a
     stroke 1.5px wide. Two strands an eighth of a stroke apart are one
     strand, which is why the rails "don't appear to be separated" (reported
     13 September 2026, with the colours working, because those do not depend
     on the geometry).

     1.7 stroke widths is the least that reads as two lines rather than a
     thick one. The spread is capped at two rails either side and cycles,
     because a day of seven legs at three rails each would wander a whole
     square off the corridor it is meant to be tracing -- and a path that
     leaves the floor it walks on is worse than one that overlaps. */
  const lw = Math.max(1.5, TS / 10);
  const rail = Math.max(lw * 1.7, TS * 0.13);
  const RAILS = [0, 1, -1, 2, -2];
  ctx.save();
  ctx.lineWidth = lw;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.globalAlpha = 0.9;
  for (const leg of legs) {
    // Spread about zero: 0, +1, -1, +2, -2 ... so a day of a few legs stays
    // centred on the squares actually walked rather than drifting off them.
    const k = RAILS[leg.i % RAILS.length];
    ctx.strokeStyle = 'hsl(' + Math.round((leg.hour % 24) * 15) + ' 85% 62%)';
    ctx.beginPath();
    for (let i = 0; i < leg.pts.length; i++) {
      // The offset is perpendicular to the step being taken, so it hugs the
      // route rather than sliding the whole leg sideways.
      const p = leg.pts[i], q = leg.pts[Math.min(leg.pts.length - 1, i + 1)];
      const dx = q[0] - p[0], dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * rail * k, oy = (dx / len) * rail * k;
      const px = p[0] * TS + TS / 2 + ox, py = p[1] * TS + TS / 2 + oy;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  ctx.restore();

  /* A dot on every post, and the hours beside it.

     The hours were drawn into the mark layer, which the zoom magnifies: a
     few pixels high zoomed out on a phone, soft between 100% and 150% where
     the layer (capped in size, layerGeom) is stretched and the lens is not
     yet painting, and starting inside the post's square under the
     selection box's corners (the maintainer, 9 November 2026). Two posts on
     one square drew two labels on one spot, the later hiding the earlier
     (Thuria's 5 pm over her other hour). So on screen the hours are page
     text over the map (setPathLabels), one label a square with each hour
     in the color of its post, placed past the square's right edge from
     the zoom and moved with it (placePathLabels, from applyMapTransform):
     sharp at every zoom and 13 pixels high on any screen. The picture the
     download makes has no page over it, so there the label is drawn into
     it, at 13 pixels to a 32-pixel square. `where` is 'screen', 'lens' or
     'export'. The dot stays in the canvas, at 4 screen pixels or more, and
     drawMapMarks is run again when a zoom settles, at the new size. */
  const spt = cm.TS * (typeof mapView !== 'undefined' && mapView.scale ? mapView.scale : 1);
  const k = where === 'export' ? TS / 32 : TS / spt;
  ctx.save();
  ctx.font = canvasFace(Math.max(1, Math.round(13 * k)));
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  /* A post wears the colour of the line that ENDS at it, not the one that
     leaves. A leg is coloured by the hour it sets out, so the line reaching
     post j is leg j-1: colouring the dot by its hour would put a dot of
     one colour at the end of a line of another, which is the confusion this
     was meant to clear up (the maintainer, 13 September 2026). A day with a
     single post has no incoming leg and retains the mark's colour. */
  const ingress = j => (here.length > 1
    ? 'hsl(' + Math.round((here[(j - 1 + here.length) % here.length].hour % 24) * 15) + ' 85% 62%)'
    : color);
  // The posts by square, each square's hours in the order of the day.
  const squares = new Map();
  for (let j = 0; j < here.length; j++) {
    const e = here[j], key = e.x + ',' + e.y;
    if (!squares.has(key)) squares.set(key, { x: e.x, y: e.y, parts: [] });
    squares.get(key).parts.push({ text: hourAmPm(e.hour), hue: ingress(j) });
  }
  for (let j = 0; j < here.length; j++) {
    const e = here[j];
    // Whole pixels. A dot on a fractional coordinate is drawn across two
    // device pixels and reads as a smudge at close zoom.
    const cx = Math.round(e.x * TS + TS / 2), cy = Math.round(e.y * TS + TS / 2);
    ctx.fillStyle = ingress(j);
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(4 * k, TS / 5), 0, Math.PI * 2);
    ctx.fill();
  }
  if (where === 'export') {
    for (const s of squares.values()) {
      const cy = Math.round(s.y * TS + TS / 2), pad = Math.round(4 * k), h = Math.round(18 * k);
      const sep = ', ', sw = atlasTextWidth(ctx, sep);
      const tw = s.parts.reduce((a, p, i) => a + atlasTextWidth(ctx, p.text) + (i ? sw : 0), 0);
      let bx = Math.round((s.x + 1) * TS + 3 * k);
      ctx.fillStyle = 'rgba(8,7,5,.78)';
      ctx.fillRect(bx, Math.round(cy - h / 2), tw + 2 * pad, h);
      bx += pad;
      s.parts.forEach((p, i) => {
        if (i) { ctx.fillStyle = '#f0ede4'; ctx.fillText(sep, bx, cy); bx += sw; }
        ctx.fillStyle = p.hue; ctx.fillText(p.text, bx, cy); bx += atlasTextWidth(ctx, p.text);
      });
    }
  } else if (where === 'screen') setPathLabels([...squares.values()], cm);
  ctx.restore();

  return { stops: here.length, name: characterName(character) };
}
/* The path's hours as page text over the map (drawSchedulePath has why):
   one span a square in #pathLabels, a layer of the viewport above the
   lens, and placed from the zoom by placePathLabels. An empty list clears
   them. */
function setPathLabels(squares, cm) {
  const vp = document.getElementById('mapViewport');
  if (!vp) return;
  let box = document.getElementById('pathLabels');
  if (!box) {
    box = document.createElement('div');
    box.id = 'pathLabels';
    Object.assign(box.style, { position: 'absolute', left: '0', top: '0', right: '0', bottom: '0', pointerEvents: 'none', zIndex: '6', overflow: 'hidden' });
    vp.appendChild(box);
  }
  box.innerHTML = '';
  window.PATH_LABELS = squares.length ? { cm, squares } : null;
  for (const s of squares) {
    const el = document.createElement('span');
    Object.assign(el.style, { position: 'absolute', transform: 'translateY(-50%)', whiteSpace: 'nowrap', padding: '1px 4px', background: 'rgba(8,7,5,.78)', font: canvasFace(13) });
    el.innerHTML = s.parts.map(p => '<span style="color:' + p.hue + '">' + svEsc(p.text) + '</span>').join('<span style="color:#f0ede4">, </span>');
    box.appendChild(el);
  }
  placePathLabels();
}
// Each label just past the right edge of its square, where the zoom and
// the pan put that square now.
function placePathLabels() {
  const L = window.PATH_LABELS, box = document.getElementById('pathLabels');
  if (!L || !box || typeof mapView === 'undefined') return;
  const spt = L.cm.TS * mapView.scale;
  [...box.children].forEach((el, i) => {
    const s = L.squares[i];
    if (!s) return;
    el.style.left = Math.round(mapView.x + (s.x + 1) * spt + 3) + 'px';
    el.style.top = Math.round(mapView.y + (s.y + 0.5) * spt) + 'px';
  });
}
