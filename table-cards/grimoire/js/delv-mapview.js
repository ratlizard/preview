/* The zone view's own furniture: what the map draws over itself, and the
   controls that choose it.

   WHY THIS FILE EXISTS. index.html had grown to some 24,000 lines with every
   sheet, every gallery and every overlay inside it, and the maintainer's
   instruction (13 September 2026) was to stop adding to it. The rule in
   CLAUDE.md draws its line at the DOM -- bytes-to-bytes in js/,
   bytes-to-screen in the page -- and that rule exists to keep the decoders
   checkable against delvmod, not to keep the page one file. A mark that
   arranges what a reader has already read is not a decoder.

   THE TIER. js/mac-*.js know nothing of Cythera; js/delv-archive|graphics|
   script|mechanics.js know the formats but not the page; js/delv-sheets.js
   knows the sheets. This knows the map view. It is a classic script -- no
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
window.MAP_PATH_WHO = null;

function setMapPathWho(i) {
  const v = (i === '' || i === null || i === undefined) ? null : +i;
  window.MAP_PATH_WHO = Number.isFinite(v) ? v : null;
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
  if (!here.some(p => p.i === window.MAP_PATH_WHO)) window.MAP_PATH_WHO = here.length ? here[0].i : null;
  sel.value = window.MAP_PATH_WHO === null ? '' : String(window.MAP_PATH_WHO);
  sel.disabled = !here.length;
}

/* One character's day, as the line they walk. Draws into whichever context
   drawMapMarks is filling -- the mark layer, the detail lens, or the PNG
   export -- and answers with what it drew, for the legend.

   A schedule is posts, not a route: an hour and a square, and nothing in
   between. What fills the gap is the engine's own mover -- walkingPosition
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
function drawSchedulePath(ctx, TS, cm, colour) {
  const scheds = loadSchedules();
  const who = window.MAP_PATH_WHO;
  const mine = (who !== null && who !== undefined && scheds[who]) ? scheduleDay(who) : [];
  const here = mine.filter(e => e.mode !== 0 && e.level === cm.level).sort((a, b) => a.hour - b.hour);
  if (!here.length) return { stops: 0, name: '' };

  const hourAmPm = h => h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
  const m = cm.m;
  // findPath reads the blockers of whichever map was built last, and its
  // cache is keyed on that, so this has to run before any route is asked
  // for -- exactly as walkingPosition does it.
  if (m) { try { buildPropBlockers(cm.resid, m); } catch (e) { quiet(e); } }

  /* A leg is walked at an hour, and its colour says which.

     One colour for the whole day could not be read: a day doubles back on
     itself -- out to the shop and home again is the same corridor twice --
     and two identical strokes on the same squares are one stroke to look at,
     so the line said where she goes and never when (reported 13 September
     2026, "her path is unclear ... maybe we could make it hue-based").

     The hue runs once round the wheel over 24 hours, so the colour IS the
     clock: midnight red, morning yellow-green, afternoon cyan, evening blue.
     A leg is coloured by the hour it LEAVES, because that is the hour the
     reader sees on the dot it starts from.

     Where two legs share squares the later one would still hide the earlier,
     so each leg is drawn on its own rail: a fixed perpendicular offset by
     leg number, a fraction of a square, which turns a corridor walked twice
     into two parallel strands instead of one. */
  const legs = [];
  if (here.length > 1) {
    for (let i = 0; i < here.length; i++) {
      const a = here[i], b = here[(i + 1) % here.length];
      let leg = null;
      if (m) { try { leg = findPath(m, a.x, a.y, b.x, b.y, keysCarriedBy(who)); } catch (e) { leg = null; } }
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

  // A dot on every post, and the hour beside it where the tiles are big
  // enough to read one. One font for all of them, the World tab's lesson.
  ctx.save();
  ctx.font = canvasFace(Math.max(9, Math.min(13, Math.round(TS / 2.4))));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  /* A post wears the colour of the line that ARRIVES at it, not the one that
     leaves. A leg is coloured by the hour it sets out, so the line reaching
     post j is leg j-1: colouring the dot by its own hour would put a dot of
     one colour at the end of a line of another, which is the confusion this
     was meant to clear up (the maintainer, 13 September 2026). A day with a
     single post has no arriving leg and keeps the mark's own colour. */
  const ingress = j => (here.length > 1
    ? 'hsl(' + Math.round((here[(j - 1 + here.length) % here.length].hour % 24) * 15) + ' 85% 62%)'
    : colour);
  for (let j = 0; j < here.length; j++) {
    const e = here[j];
    const hue = ingress(j);
    // Whole pixels. A dot or a label box on a fractional coordinate is drawn
    // across two device pixels and reads as a smudge at close zoom, which is
    // the one part of this the canvas will actually let us fix -- text
    // antialiasing itself has no switch.
    const cx = Math.round(e.x * TS + TS / 2), cy = Math.round(e.y * TS + TS / 2);
    ctx.fillStyle = hue;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, Math.round(TS / 5)), 0, Math.PI * 2);
    ctx.fill();
    if (TS < 14) continue;
    const label = hourAmPm(e.hour);
    const tw = atlasTextWidth(ctx, label);
    const bx = cx + Math.round(TS / 4), by = cy - 12;
    ctx.fillStyle = 'rgba(8,7,5,.72)';
    ctx.fillRect(bx, by, tw + 8, 15);
    ctx.fillStyle = hue;
    ctx.fillText(label, bx + 4, cy);
  }
  ctx.restore();

  return { stops: here.length, name: characterName(who) };
}
