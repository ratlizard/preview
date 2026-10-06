/* The Mechanics sheet: its figures, the patches and compare tools, and the sheet itself.

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
   last of these. File 11 of 14. */

/* ---- the pictures on the Mechanics sheet ---------------------------------
   The sheet states each rule in prose and then, since 6 September 2026, draws
   it. The reason is the dice game: "your die outside the two black ones wins
   the distance to the nearer" is exact, complete, and tells nobody whether
   the game is worth playing. The 216 throws drawn as 216 coloured cells
   answer that at a glance, and every other rule here had the same gap between
   being stated and being understood -- how often a blow lands, what a shield
   is worth, why a lock of difficulty 19 is a lock of difficulty 0, how much
   of a spell's failure is the caster and how much the spell.

   Two rules govern what is drawn. **Nothing is invented**: every number in
   every figure is either read out of the open archive by the functions above,
   or computed from those numbers by js/delv-mechanics.js, which is checked
   against an independent simulation by utilities/mech_check.mjs. And **a
   figure must say something the table does not**; where it would only repeat
   a column, there is no figure. Weapons get bars because the ordering is the
   point, shops get a price distribution because the range is the point, and
   the skill table gets none.

   The chart builders are here rather than in js/ because they emit markup and
   the class names are the page's; the arithmetic they draw is in js/ because
   it is numbers and can be checked. That is the same line as everywhere else
   in this repository, drawn in the same place. */

const MECH_INK = {
  gold: 'rgb(249,248,111)', ink: '#d3c9a6', dim: '#7d745a',
  hit: '#9ec254', miss: '#8a7f63', parry: '#6ba8bf',
  win: '#9ec254', push: '#6e6952', lose: '#c0684f',
  cool: '#6ba8bf', warm: '#c0684f', leaf: '#9ec254', violet: '#b08fd0'
};
// Series colours, chosen by eye against the planks: the page's own gold
// first, then three that stay apart from it and from each other on a dark
// ground. Not the game's CLUT -- that palette is Cythera's artwork and
// reading a chart is not looking at the game.
const MECH_SERIES = [MECH_INK.gold, MECH_INK.cool, MECH_INK.warm, MECH_INK.leaf, MECH_INK.violet];

function mechFig(title, body, caption) {
  return '<figure class="mechFig">' + (title ? '<div class="mechFigTitle">' + svEsc(title) + '</div>' : '') +
    body + (caption ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>';
}
// Horizontal bars: a label, a track, a figure. `rows` are {label, value,
// colour, text, html}; the value sets the width and `text` overrides what is
// printed at the end of it.
function mechBars(rows, opts) {
  opts = opts || {};
  const max = opts.max || rows.reduce((m, r) => Math.max(m, Math.abs(r.value) || 0), 0) || 1;
  return '<div class="mechBars">' + rows.map(r =>
    '<span class="bLabel" title="' + svEsc(r.title || r.label) + '">' + (r.html || svEsc(r.label)) + '</span>' +
    '<span class="bTrack"><span class="bFill" style="left:0;width:' + (100 * Math.min(1, Math.abs(r.value || 0) / max)).toFixed(2) +
      '%;background:' + (r.colour || opts.colour || MECH_INK.gold) + '"></span></span>' +
    '<span class="bVal">' + svEsc(r.text !== undefined ? r.text : String(r.value)) + '</span>').join('') + '</div>';
}
// One bar cut into shares, with a key under it. The shares are drawn in the
// order given and the key prints each as a percentage.
function mechStackBar(parts) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return '<div class="mechStack">' + parts.map(p =>
      '<i style="width:' + (100 * Math.max(0, p.value) / total).toFixed(3) + '%;background:' + p.colour + '" title="' + svEsc(p.label) + '"></i>').join('') + '</div>' +
    '<div class="mechKeys">' + parts.map(p =>
      '<span><i style="background:' + p.colour + '"></i>' + svEsc(p.label) + ' <b>' + (100 * p.value / total).toFixed(1) + '%</b></span>').join('') + '</div>';
}
// Columns, for a distribution. A bin may carry a second value, drawn as a
// dashed rule across the column: that is how a sampled result is laid over
// the exact one without a second chart.
function mechColumns(bins, opts) {
  opts = opts || {};
  const max = opts.max || bins.reduce((m, b) => Math.max(m, b.value, b.mark === undefined ? 0 : b.mark), 0) || 1;
  return '<div class="mechCols" style="height:' + (opts.height || 96) + 'px">' + bins.map(b =>
      '<span class="cCol" title="' + svEsc(b.title || (b.label + ': ' + b.value)) + '">' +
      (b.mark === undefined ? '' : '<i class="cMark" style="bottom:' + (100 * b.mark / max).toFixed(2) + '%"></i>') +
      '<i class="cFill" style="height:' + (100 * b.value / max).toFixed(2) + '%;background:' + (b.colour || opts.colour || MECH_INK.gold) + '"></i></span>').join('') +
    '</div><div class="mechColLabels">' + bins.map(b => '<span>' + svEsc(b.label) + '</span>').join('') + '</div>';
}
/* A plot: the curves in an SVG stretched to the box, everything with words on
   it in HTML around and over it. `x` and `y` are {min, max, ticks, log};
   `series` are {points, colour, name, dash}; `marks` are {x, y, label, dot}
   placed over the plot in page coordinates. */
function mechPlot(spec) {
  const X = spec.x, Y = spec.y;
  const fx = X.log ? Math.log10 : (v => v), fy = Y.log ? Math.log10 : (v => v);
  const x0 = fx(X.min), x1 = fx(X.max), y0 = fy(Y.min), y1 = fy(Y.max);
  const sx = v => 100 * (fx(v) - x0) / ((x1 - x0) || 1);
  const sy = v => 100 - 100 * (fy(v) - y0) / ((y1 - y0) || 1);
  const grid = (Y.ticks || []).map(t => '<line x1="0" x2="100" y1="' + sy(t.v).toFixed(3) + '" y2="' + sy(t.v).toFixed(3) +
    '" stroke="rgba(155,136,80,.2)" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('');
  const lines = (spec.series || []).map(s => {
    const pts = s.points.map(p => sx(p[0]).toFixed(3) + ',' + sy(p[1]).toFixed(3)).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + (s.colour || MECH_INK.gold) + '" stroke-width="' + (s.width || 1.6) + '"' +
      (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }).join('');
  // A label at the very edge of the plot would be cut off, so a mark can say
  // which side of its point to sit on, and can be nudged down the page to get
  // out of the way of the one before it.
  const marks = (spec.marks || []).map(m => '<span class="pMark' + (m.side ? ' ' + m.side : '') + '" style="left:' + sx(m.x).toFixed(2) + '%;top:' + sy(m.y).toFixed(2) + '%' +
    (m.dy ? ';margin-top:' + m.dy + 'px' : '') + (m.colour ? ';color:' + m.colour : '') + '">' +
    (m.dot ? '<i class="pDot" style="background:' + (m.colour || MECH_INK.gold) + '"></i>' : '') +
    (m.label ? '<b>' + svEsc(m.label) + '</b>' : '') + '</span>').join('');
  const named = (spec.series || []).filter(s => s.name);
  return '<div class="mechPlot">' +
    '<div class="pY">' + (Y.ticks || []).map(t => '<span style="top:' + sy(t.v).toFixed(2) + '%">' + svEsc(t.label) + '</span>').join('') + '</div>' +
    '<div class="pArea" style="height:' + (spec.height || 150) + 'px"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      grid + lines + '</svg>' + marks + '</div>' +
    '<div class="pX">' + (X.ticks || []).map(t => '<span style="left:' + sx(t.v).toFixed(2) + '%">' + svEsc(t.label) + '</span>').join('') + '</div>' +
    '</div>' + (named.length ? '<div class="mechKeys">' + named.map(s =>
      '<span><i style="background:' + (s.colour || MECH_INK.gold) + '"></i>' + svEsc(s.name) + '</span>').join('') + '</div>' : '');
}
// A number line, for the things that are one number on a scale rather than a
// distribution: what a lesson costs, how long a status lasts, where karma
// starts. Labels alternate above and below so two close marks do not collide.
function mechNumberLine(spec) {
  const f = spec.log ? Math.log10 : (v => v);
  const a = f(spec.min), b = f(spec.max);
  const at = v => 100 * (f(Math.max(spec.min, Math.min(spec.max, v))) - a) / ((b - a) || 1);
  return '<div class="mechLine">' +
    '<div class="lRule"></div>' +
    (spec.bands || []).map(bd => '<div class="lBand" style="left:' + at(bd.from).toFixed(2) + '%;width:' +
      Math.max(0.4, at(bd.to) - at(bd.from)).toFixed(2) + '%;background:' + bd.colour + '" title="' + svEsc(bd.label || '') + '"></div>').join('') +
    (spec.marks || []).map((m, i) => '<div class="lTick" style="left:' + at(m.v).toFixed(2) + '%' + (m.colour ? ';background:' + m.colour : '') + '"></div>' +
      '<div class="lLab ' + (m.above || (i % 2 === 0 && !m.below) ? 'above' : 'below') + '" style="left:' + at(m.v).toFixed(2) + '%' +
      (m.colour ? ';color:' + m.colour : '') + '">' + svEsc(m.label) + '</div>').join('') +
    '</div>';
}

/* THE DICE GAME, ALL 216 THROWS AT ONCE. Six rows for the innkeeper's first
   die, six columns for the second, and inside each cell the six faces your
   own die could show, left to right. Red is a lost obol, grey a push, green
   a win and the brighter the more. Nothing is sampled and nothing is
   rounded: this is the whole game, and what it shows is that the winning
   cells are the ones where the innkeeper's two dice are close together --
   which is why the house loses. */
function mechNetColour(n) {
  return n < 0 ? '#8c4034' : n === 0 ? '#4a4636' : ['#5d7a3a', '#79a044', '#a3c455', '#cfe86b'][Math.min(3, n - 1)];
}
// A die, drawn: the face as pips on a rounded square. See the note by
// .mechDiceFaces for why these are not the Unicode die characters.
const MECH_PIPS = [[[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [2, 0], [0, 2], [2, 2]], [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];
function mechDieFace(n, size, ink) {
  const s = size || 14, face = ink || '#efeade';
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 12 12" role="img" aria-label="a die showing ' + (n + 1) + '">' +
    '<rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill="' + face + '" stroke="rgba(0,0,0,.55)"/>' +
    MECH_PIPS[n].map(q => '<circle cx="' + (3 + q[0] * 3) + '" cy="' + (3 + q[1] * 3) + '" r="1.15" fill="#2a2419"/>').join('') + '</svg>';
}
function mechDiceMatrix(cells) {
  const name = n => 'a ' + (n + 1);
  // The faces are whatever the script rolls; past six there are no pips
  // to draw, so a number stands in.
  const face = n => n < 6 ? mechDieFace(n, 13) : '<b>' + (n + 1) + '</b>';
  const as = [...new Set(cells.map(x => x.a))].sort((x, y) => x - y), cs = [...new Set(cells.map(x => x.c))].sort((x, y) => x - y);
  let h = '<div class="mechDice" style="grid-template-columns:auto repeat(' + cs.length + ', 1fr)"><span class="dSide"></span>' +
    cs.map(c => '<span class="dHead">' + face(c) + '</span>').join('');
  for (const a of as) {
    h += '<span class="dSide">' + face(a) + '</span>';
    for (const c of cs) {
      const cell = cells.find(x => x.a === a && x.c === c);
      h += '<span class="dCell">' + cell.row.map((n, b) =>
        '<i style="background:' + mechNetColour(n) + '" title="' + name(a) + ' and ' + name(c) + ' against your ' + (b + 1) + ': ' +
        (n > 0 ? '+' + n : n) + ' obol' + (Math.abs(n) === 1 ? '' : 's') + '"></i>').join('') + '</span>';
    }
  }
  return h + '</div>';
}

/* WHAT TO EDIT. Every number the game is played with is one byte of the
   inn's script, and diceGame() has their offsets; this lays them out with
   three edits worked through, each figure computed by mechDiceExact over
   the edited numbers rather than guessed. Edit Bytes on 0x812 takes the
   hex; Changes exports the archive that plays it. */
function mechDiceBytes(dice) {
  if (!dice || !dice.bytes || !dice.bytes.length) return '';
  const hex4 = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  const mean = o => { const v = mechDiceExact(Object.assign({}, dice.opts, o)).mean; return (v >= 0 ? '+' : '') + v.toFixed(3); };
  const pay = dice.bytes.find(b => /match pays/.test(b.what));
  const gate = dice.bytes.find(b => /Gambling skill/.test(b.what));
  const fix = dice.bytes.find(b => /roll matched/.test(b.what));
  const rows = dice.bytes.map(b => '<tr><td>' + svEsc(b.what) + '</td>' + srcCell(b.val, hex4(b.at)) + '<td class="num">' + svEsc(String(b.now)) + '</td></tr>').join('');
  const tries = [];
  if (pay) tries.push('Write <b>00</b> at ' + srcNum(pay.val, hex4(pay.at)) + ' and a match pays nothing: <b>' + mean({ matchPay: 0 }) + '</b> an obol a game without the skill, <b>' + mean({ matchPay: 0, gambling: true }) + '</b> with it.');
  if (pay) tries.push('Write <b>7F</b> there and a match pays 127: <b>' + mean({ matchPay: 127 }) + '</b> a game.');
  if (fix && fix.next !== null && gate && gate.next !== null && !dice.skillAlways)
    tries.push('Write <b>' + hex4(fix.next).slice(2) + '</b> at ' + srcNum(fix.val, hex4(fix.at)) + ' and the Gambling skill moves your die whatever the roll, so every game you play with the skill is a match: <b>' + mean({ skillAlways: true, gambling: true }) + '</b> a game. Write <b>' + hex4(gate.next).slice(2) + '</b> at ' + srcNum(gate.val, hex4(gate.at)) + ' as well, and you do not need the skill either.');
  return '<div class="mechSub">What to edit</div>' +
    '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>byte</th><th class="num">at, in 0x812</th><th class="num">now</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    (tries.length ? '<ul class="ruleList">' + tries.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '');
}

/* THE SIMULATOR. The exact enumeration says the player wins about three
   tenths of an obol a game; the simulator is there because that sentence
   persuades nobody who has just lost four in a row, and because watching the
   running average wander and then settle is the only honest way to show what
   an edge that small feels like. It plays the script's own arithmetic --
   mechDicePlay in js/delv-mechanics.js, the same function the exact
   enumeration is built from -- so the two cannot drift apart. */
let DICE_SIM = { gambling: false, tally: null, last: null };
function diceSimRoll(n) { return Math.floor(Math.random() * n); }
function diceSimSet(on) { DICE_SIM = { gambling: !!on, tally: null, last: null }; diceSimRefresh(); }
function diceSimReset() { DICE_SIM.tally = null; DICE_SIM.last = null; diceSimRefresh(); }
function diceSimPlay(n) {
  const opts = Object.assign({ gambling: DICE_SIM.gambling, track: 240 }, diceOpts());
  if (n === 1) {
    DICE_SIM.last = mechDicePlay(diceSimRoll, opts);
    if (!DICE_SIM.tally) DICE_SIM.tally = { games: 0, wins: 0, pushes: 0, losses: 0, net: 0, dist: new Map(), curve: [], mean: 0 };
    const t = DICE_SIM.tally, g = DICE_SIM.last;
    t.games++; t.net += g.net;
    if (g.net > 0) t.wins++; else if (g.net === 0) t.pushes++; else t.losses++;
    t.dist.set(g.net, (t.dist.get(g.net) || 0) + 1);
    t.mean = t.net / t.games;
    t.curve.push([t.games, t.mean]);
    if (t.curve.length > 240) t.curve = t.curve.filter((p, i) => i % 2 === 0 || i === t.curve.length - 1);
  } else {
    const run = mechDiceRun(diceSimRoll, n, opts);
    const t = DICE_SIM.tally;
    if (!t) DICE_SIM.tally = run;
    else {
      // Adding a run to what is already there: the curve is re-based so the
      // line stays one continuous history rather than starting again.
      const base = t.games;
      t.games += run.games; t.net += run.net; t.wins += run.wins; t.pushes += run.pushes; t.losses += run.losses;
      for (const [k, v] of run.dist) t.dist.set(k, (t.dist.get(k) || 0) + v);
      t.mean = t.net / t.games;
      t.curve = t.curve.concat(run.curve.map(p => [base + p[0], p[1]]));
      if (t.curve.length > 480) t.curve = t.curve.filter((p, i) => i % 2 === 0 || i === t.curve.length - 1);
    }
    DICE_SIM.last = null;
  }
  diceSimRefresh();
}
function diceSimRefresh() { const el = document.getElementById('diceSim'); if (el) el.innerHTML = diceSimHtml(); }
function diceSimHtml() {
  const exact = mechDiceExact(Object.assign({ gambling: DICE_SIM.gambling }, diceOpts()));
  const t = DICE_SIM.tally;
  const nets = [...new Set([-1, 0, 1, 2, 3, 4].concat([...exact.dist.keys()]))].sort((a, b) => a - b);
  const bins = nets.map(n => ({
    label: n > 0 ? '+' + n : String(n),
    value: 100 * (exact.dist.get(n) || 0),
    mark: t ? 100 * ((t.dist.get(n) || 0) / t.games) : undefined,
    colour: mechNetColour(n),
    title: (n > 0 ? '+' + n : n) + ' obols: ' + (100 * (exact.dist.get(n) || 0)).toFixed(1) + '% of throws' + (t ? ', ' + (100 * (t.dist.get(n) || 0) / t.games).toFixed(1) + '% played' : '')
  }));
  let out = '';
  if (DICE_SIM.last) {
    const g = DICE_SIM.last;
    out += '<div class="mechDiceFaces">' + mechDieFace(g.a, 34, '#3b362b') + mechDieFace(g.b, 34) + mechDieFace(g.c, 34, '#3b362b') + '</div>' +
      '<div class="mechVerdict">' + (g.helped ? '<b>Gambling</b> set your die to the innkeeper’s first. ' : '') +
      (g.net > 0 ? 'You win <b>' + g.net + '</b> obol' + (g.net === 1 ? '' : 's') + '.' : g.net === 0 ? 'A draw: your stake back.' : 'You lose <b>an obol</b>.') + '</div>';
  }
  out += mechFig('Where the obols go, exactly and as played',
    mechColumns(bins, { height: 84 }) +
    '<div class="mechKeys"><span><i style="background:' + MECH_INK.dim + '"></i>the columns are the exact chance of each result</span>' +
    (t ? '<span><i style="background:' + MECH_INK.gold + '"></i>the dashed rule is what your ' + t.games.toLocaleString() + ' games did</span>' : '') + '</div>',
    t ? 'After <b>' + t.games.toLocaleString() + '</b> games you are <b>' + (t.net > 0 ? '+' : '') + t.net.toLocaleString() +
        '</b> obols, <b>' + (t.mean >= 0 ? '+' : '') + t.mean.toFixed(3) + '</b> a game against the exact <b>' +
        (exact.mean >= 0 ? '+' : '') + exact.mean.toFixed(3) + '</b>.'
      : 'Nothing played yet. The exact figure is <b>' + (exact.mean >= 0 ? '+' : '') + exact.mean.toFixed(3) + '</b> obols a game.');
  if (t && t.curve.length > 2) {
    const ys = t.curve.map(p => p[1]);
    const lo = Math.min(-0.6, Math.min.apply(null, ys)), hi = Math.max(0.9, Math.max.apply(null, ys));
    out += mechFig('The running average, game by game', mechPlot({
      height: 110,
      x: { min: 1, max: t.games, ticks: [{ v: 1, label: '1' }, { v: t.games, label: t.games.toLocaleString() }] },
      // The zero tick is dropped when the exact figure sits almost on top of
      // it, which at three tenths of an obol on a range of one and a half it
      // very nearly does: two labels a few pixels apart read as one smudged
      // number and neither can be trusted.
      y: { min: lo, max: hi, ticks: [{ v: hi, label: hi.toFixed(1) }, { v: exact.mean, label: exact.mean.toFixed(2) }]
        .concat(Math.abs(exact.mean) / (hi - lo) > 0.09 ? [{ v: 0, label: '0' }] : [])
        .concat([{ v: lo, label: lo.toFixed(1) }]) },
      series: [
        { points: [[1, exact.mean], [t.games, exact.mean]], colour: 'rgba(249,248,111,.45)', dash: '3 3', name: 'the exact figure' },
        { points: t.curve, colour: MECH_INK.cool, name: 'your games so far' }
      ]
    }), 'An edge this small takes hundreds of games to show.');
  }
  return out;
}

/* COMBAT, WITH THE NUMBERS TURNED UP AND DOWN. The rule is six terms and two
   rolls, and no amount of restating it says what a shield is worth or how
   much of a fight is the weapon. So the terms are controls and the picture
   answers: the share of blows that miss, are parried and land; the margin's
   own distribution, which is the triangle two rolls always make, with the
   parry eating into it from the left; and how often each of the game's eight
   words for a blow would be printed.

   The weapon list is the archive's own -- gearTable(), the same rows the
   table under this shows -- so a modded archive tunes the sliders to its own
   weapons. It is rebuilt on every render of the sheet rather than memoised
   for the session, and cleared with everything else archive-keyed. */
function mechWeapons() {
  if (!DERIVED.MECH_WEAPONS) {
    try {
      DERIVED.MECH_WEAPONS = gearTable().filter(g => g.damage !== null && g.damage !== undefined && g.damage > 0)
        .sort((a, b) => b.damage - a.damage);
    } catch (e) { DERIVED.MECH_WEAPONS = []; }
  }
  return DERIVED.MECH_WEAPONS;
}
function mechShields() {
  try { return gearTable().filter(g => g.block !== null && g.block !== undefined).sort((a, b) => b.block - a.block); }
  catch (e) { return []; }
}
function combatSimParams() {
  const el = id => document.getElementById(id);
  const val = (id, dflt) => { const e = el(id); return e && e.value !== undefined && e.value !== '' ? Number(e.value) : dflt; };
  const ws = mechWeapons();
  const pt = val('cbWeapon', ws.length ? ws[0].pt : 0);
  const weapon = ws.find(w => w.pt === pt) || ws[0] || { name: 'a bare hand', damage: 3, skill: 'Barehand' };
  const shields = mechShields();
  const shieldOn = (() => { const e = el('cbShield'); return e ? !!e.checked : true; })();
  const shield = shields.length ? shields[0] : null;
  return {
    weapon, shield: shieldOn ? shield : null,
    attackerReflex: val('cbAtkRef', 20), defenderReflex: val('cbDefRef', 20), body: val('cbBody', 20),
    bodyForReflex: (() => { const e = el('cbBodyRef'); return e ? !!e.checked : false; })(),
    weaponSkill: val('cbSkill', 8), attackSkill: val('cbAtk', 4), defenceSkill: val('cbDef', 4),
    enchant: 0
  };
}
// Who fights with the body: how many units carry the bit 0xE88 tests, and
// whether the hero's does, the hero being character 1 and its unit the one
// whose prop type is the hero's. Nothing without the program, which is what
// says the bit is the unit's field 0x33.
function combatBodyUnitsText(bit) {
  const units = unitsWithTopFlag(bit);
  if (!units.length) return '';
  const all = parseMonsterStats().filter(m => m && !m.blank).length;
  let hero = null;
  try { const c = loadCharacterTable()[1]; hero = c ? parseMonsterStats().find(m => m && !m.blank && m.proptype === c.proptype) : null; } catch (e) { quiet(e, 'the hero’s unit'); }
  const ms = parseMonsterStats();
  const chips = units.map(m => { const k = ms.indexOf(m); return svLink(propDisplayName(m.proptype) || ('unit ' + k), 'showMonsterDetail(' + k + ')'); });
  return ' (' + countLink(String(units.length), 'The ' + units.length + ' units that fight with their body', chips) + ' of the ' + all + ' units' + (hero ? (units.includes(hero) ? ', the hero’s among them' : ', not the hero’s') : '') + ')';
}
// How many values the attack routine's body roll takes: Random(0, (body - 12)
// / 4 + 1), the 12, the 4 and the 1 read off 0xE90 and 0x3042, the division
// the script's, which drops the fraction. Nothing when any of them was not
// read, and then the figure is the weapon's alone and says nothing of body.
function combatBodyRoll(body, ar) {
  if (!ar || !ar.bodyRoll || !ar.scale || !ar.scale.div || !ar.bodyAddVal) return 0;
  return Math.trunc((body - ar.scale.sub) / ar.scale.div) + ar.bodyAddVal.v;
}
// `cb` is combatRules(): the rolls, the damage's added constant and the
// blow words, all read off the routines.
function combatSimHtml(p, cb) {
  let ar = null;
  try { ar = attackRules(); } catch (e) { quiet(e, 'the attack routine, for the body roll'); }
  const bodyRoll = combatBodyRoll(p.body, ar);
  const model = {
    // As shipped the resolver's weapon-skill term adds nothing to an armed
    // blow (combatRules().skillOffLoop), and every weapon here is armed.
    // A unit flagged so starts the margin from its body (cb.bodyForReflex).
    attackerReflex: p.bodyForReflex && cb.bodyForReflex ? p.body : p.attackerReflex, defenderReflex: p.defenderReflex, weaponSkill: cb.skillOffLoop ? 0 : p.weaponSkill,
    attackSkill: p.attackSkill, defenceSkill: p.defenceSkill, enchant: p.enchant || 0,
    damage: p.weapon.damage, shieldBlock: p.shield ? p.shield.block : null, shieldSkill: p.shield ? p.weaponSkill : 0,
    roll: cb.roll.v, rollDefender: cb.rollDefender.v, dmgAdd: cb.dmgAdd.v, bodyRoll
  };
  const words = cb.words, top = words.length ? Math.max.apply(null, words.map(w => w.below)) : null;
  const x = mechCombatExact(model, words, cb.last ? cb.last.word : '');
  const pairs = mechDistPairs(x.margin);
  const lo = pairs[0][0], hi = pairs[pairs.length - 1][0], peak = Math.max.apply(null, pairs.map(q => q[1]));
  // The bar and the number beside it are the same quantity -- the share of
  // ALL exchanges, not of the hits. They were not, for one afternoon, and a
  // bar twice the length of its own label is the sort of thing a reader
  // notices before the author does.
  const blows = x.words.filter(w => w.p > 0.0005).map((w, i) => ({
    label: w.word, value: 100 * w.p, text: (100 * w.p).toFixed(1) + '%',
    colour: MECH_SERIES[i % MECH_SERIES.length], title: w.word + (w.below ? ', under ' + w.below + ' points' : top !== null ? ', ' + top + ' points or more' : '')
  }));
  return mechFig('One exchange: ' + p.weapon.name + (p.shield ? ' against a ' + p.shield.name : ', unshielded'),
    mechStackBar([
      { label: 'lands', value: x.hit, colour: MECH_INK.hit },
      { label: 'parried', value: x.parry, colour: MECH_INK.parry },
      { label: 'misses', value: x.miss, colour: MECH_INK.miss }
    ]),
    'A blow that lands does <b>' + x.meanDamage.toFixed(1) + '</b> points on average, so an exchange is worth <b>' +
    (x.meanDamage * x.hit).toFixed(1) + '</b>.' +
    (bodyRoll > 1 ? ' A body of ' + p.body + ' adds a random number from 0 to ' + (bodyRoll - 1) + ' to the ' + p.weapon.name + '’s ' + p.weapon.damage + '.' : '') +
    (p.bodyForReflex && cb.bodyForReflex ? ' The margin starts from the body, ' + p.body + ', in place of reflex.' : '') +
    (cb.skillOffLoop ? ' Of the skills, only Shield changes the result.' : '')) +
  mechFig('The margin, and where it goes', mechPlot({
    height: 130,
    x: { min: lo, max: hi, ticks: [{ v: lo, label: String(lo) }, { v: 0, label: '0' }, { v: hi, label: '+' + hi }] },
    y: { min: 0, max: peak * 1.08, ticks: [{ v: peak, label: (100 * peak).toFixed(1) + '%' }, { v: 0, label: '0' }] },
    series: [{ points: pairs, colour: MECH_INK.gold, name: 'the margin' }],
    marks: [{ x: 0, y: peak * 1.02, label: 'nothing or less misses' }]
  }), 'Centered on <b>' + (x.constant > 0 ? '+' : '') + x.constant + '</b>.') +
  (blows.length ? mechFig('What the game would print', mechBars(blows),
    'The blows that land, as a share of all exchanges.') : '');
}
function combatSimUpdate() {
  const el = document.getElementById('combatOut');
  if (!el) return;
  let cb = null;
  try { cb = combatRules(); } catch (e) { cb = null; }
  if (!cb || !cb.roll || !cb.rollDefender || !cb.dmgAdd) return;
  el.innerHTML = combatSimHtml(combatSimParams(), cb);
  for (const id of ['cbSkill', 'cbAtkRef', 'cbDefRef', 'cbBody']) {
    const out = document.getElementById(id + 'V'), src = document.getElementById(id);
    if (out && src) out.textContent = src.value;
  }
}
function combatSimControls() {
  const ws = mechWeapons(), sh = mechShields();
  let cbRead = null;
  try { cbRead = combatRules(); } catch (e) { quiet(e, 'the combat rules, for the controls'); }
  const slider = (id, label, min, max, v) => '<label>' + svEsc(label) +
    ' <input type="range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + v + '" oninput="combatSimUpdate()"><b id="' + id + 'V">' + v + '</b></label>';
  return '<div class="mechCtl">' +
    (ws.length ? '<label>weapon <select id="cbWeapon" onchange="combatSimUpdate()">' +
      ws.map(w => '<option value="' + w.pt + '">' + svEsc(w.name) + ' (' + w.damage + ')</option>').join('') + '</select></label>' : '') +
    slider('cbSkill', 'your skill', 0, 15, 8) +
    slider('cbAtkRef', 'your reflex', 5, 40, 20) +
    slider('cbBody', 'your body', 5, 40, 20) +
    (cbRead && cbRead.bodyForReflex ? '<label><input type="checkbox" id="cbBodyRef" onchange="combatSimUpdate()"> body for reflex</label>' : '') +
    slider('cbDefRef', 'their reflex', 5, 40, 20) +
    (sh.length ? '<label><input type="checkbox" id="cbShield" checked onchange="combatSimUpdate()"> they carry a ' + svEsc(sh[0].name) + '</label>' : '') +
    '</div>';
}

/* The rest of the sheet's figures, one function each, all of the same shape:
   they are handed what the reader functions above have already read out of
   the archive and return markup. None of them reads a resource itself. */

// Weapons ordered by what they do, which the table's row order cannot show
// as quickly, with the armour and the shields beside them on their own
// scales -- three different quantities, so three groups rather than one.
// The classes that read their aspect, counted off the listings, for the
// Mechanics prop record section (aspectReaders).
function mechAspectReaders() {
  const ar = aspectReaders();
  const w = s => '<b>' + s + '</b>';
  const nm = pt => svLink(svEsc(propDisplayName(pt) || ('prop 0x' + pt.toString(16).toUpperCase())), 'showItemDetail(' + pt + ')');
  const reads = [...ar].filter(([, v]) => v.reads).map(([pt]) => pt), writesOnly = [...ar].filter(([, v]) => !v.reads && v.writes).map(([pt]) => pt);
  if (!ar.size) return 'no item class script is in this file.';
  let gearRead = [];
  try { gearRead = gearTable().filter(r => (ar.get(r.pt) || {}).reads).map(r => r.pt); } catch (e) { gearRead = []; }
  return w(countLink(String(reads.length), 'The ' + reads.length + ' item classes that read their aspect', reads.map(nm)) + ' of ' + ar.size) + ' item classes also read it; the rest only change picture and name. ' +
    (gearRead.length ? 'Of the weapons and armor, ' + gearRead.map(nm).join(', ') + ' read' + (gearRead.length === 1 ? 's' : '') + ' it.' : 'No weapon or piece of armor reads it.');
}
// One pair from the file that shows the two cases side by side: a weapon
// at an aspect that is a picture no class owns, and a food at an aspect
// its class reads a variant for. Empty when the archive lacks either.
function mechAspectContrast() {
  const w = s => '<b>' + s + '</b>';
  let weapon = null, food = null;
  try {
    const gear = new Set(gearTable().filter(r => r.melee).map(r => r.pt)), ar = aspectReaders();
    for (const o of orphanItemArt()) for (const r of o.reach) if (gear.has(r.pt) && !(ar.get(r.pt) || {}).reads && (!weapon || r.aspect < weapon.aspect)) weapon = { pt: r.pt, aspect: r.aspect, word: r.word, name: o.name };
    const g = weapon ? gearTable().find(r => r.pt === weapon.pt) : null;
    // HTML: each figure links to the record byte it was read from.
    if (weapon && g) weapon.numbers = [g.damage !== null ? 'damage ' + srcNum(g.src.damage, g.damage) : '', g.thrown ? 'thrown ' + srcNum(g.src.thrown, g.thrown[0]) + ' up to ' + srcNum(g.src.thrown, g.thrown[1]) + ' squares' : '', g.skill ? svEsc(g.skill) : ''].filter(Boolean).join(', ');
    const fs = foodRules().foods.filter(f => f.variants && f.variants.length > 1 && f.variants[1].name && f.variants[1].name !== f.variants[0].name);
    const f = fs.find(f => f.saysPer) || fs[0];
    if (f) food = { pt: f.pt, name: f.name, v0: f.variants[0], v1: f.variants[1], word: (1 << 10) | f.pt };
  } catch (e) { return ''; }
  if (!weapon || !food) return '';
  const own = propDisplayName(weapon.pt) || 'weapon';
  return 'So ' + w(propWordHex(weapon.word)) + ', ' + svLink(svEsc(own), 'propWordOpen(' + weapon.pt + ',' + weapon.aspect + ')') + ' at aspect ' + weapon.aspect + ', is a ' + w(svEsc(weapon.name)) + ' in picture and name and a ' + svEsc(own) + ' in every number' + (weapon.numbers ? ' (' + weapon.numbers + ')' : '') +
    ', while ' + w(propWordHex(food.word)) + ', ' + svLink(svEsc(food.name), 'propWordOpen(' + food.pt + ',1)') + ' at aspect 1, is a ' + w(svEsc(food.v1.name)) + ' that feeds ' + srcNum(food.v1.src, '+' + food.v1.plus) + (food.v1.says ? ' and says ' + srcNum(food.v1.saysSrc, '“' + food.v1.says + '”') : '') +
    ', against ' + srcNum(food.v0.src, '+' + food.v0.plus) + (food.v0.says && food.v0.says !== food.v1.says ? ' and ' + srcNum(food.v0.saysSrc, '“' + food.v0.says + '”') : '') + ' at aspect 0, because that class reads the aspect and the ' + svEsc(own) + '’s does not.';
}
function mechGearFigure(gear) {
  const hue = {};
  const skills = [...new Set(gear.map(g => g.skill).filter(Boolean))];
  skills.forEach((s, i) => { hue[s] = MECH_SERIES[i % MECH_SERIES.length]; });
  const arms = gear.filter(g => g.damage).sort((a, b) => b.damage - a.damage)
    .map(g => ({ label: g.name, value: g.damage, colour: hue[g.skill] || MECH_INK.dim, text: String(g.damage), title: g.name + ', ' + (g.skill || 'no skill') }));
  const armour = gear.filter(g => g.protection).sort((a, b) => b.protection - a.protection)
    .map(g => ({ label: g.name, value: g.protection, colour: MECH_INK.cool, text: String(g.protection) }));
  const shields = gear.filter(g => g.block).sort((a, b) => b.block - a.block)
    .map(g => ({ label: g.name, value: g.block, colour: MECH_INK.parry, text: String(g.block) }));
  if (!arms.length) return '';
  // Whether the resolver's skill term works, off the same reading as the
  // Combat section (combatRules().skillOffLoop): as shipped it does not.
  let offLoop = null;
  try { const cr = combatRules(); offLoop = cr && cr.skillOffLoop; } catch (e) { offLoop = null; }
  return mechFig(offLoop ? 'Damage, the most a blow can do' : 'Damage, the most a blow can do before the skill',
    mechBars(arms) + '<div class="mechKeys">' + skills.map(s => '<span><i style="background:' + hue[s] + '"></i>' + svEsc(s) + '</span>').join('') + '</div>',
    offLoop
      ? 'The color is the weapon’s skill, which ' + srcNum(offLoop[1] || offLoop[0], 'adds nothing') + '.'
      : 'The color is the weapon’s skill.') +
    (armour.length ? mechFig('Armor, in points of protection', mechBars(armour)) : '') +
    (shields.length ? mechFig('What each shield can block', mechBars(shields),
      'A shield does more against a weak attacker than a strong one.') : '');
}

// The levels double, so the only honest axis is a logarithmic one, and drawn
// that way the cap becomes visible: experience stops at 65,535 and the
// twelfth threshold is 102,400, so the eleventh level is the last one.
function mechExperienceFigure(rule) {
  if (!rule || !rule.base || !rule.cap) return '';
  const base = rule.base.v, cap = rule.cap.v;
  const levels = Array.from({ length: 12 }, (_, i) => i + 1);
  // The level passing threshold(n) reaches is n + 1; the first threshold
  // above the cap is the one that cannot be passed.
  let stuck = 1;
  while (stuck < 40 && mechLevelThreshold(stuck, base) <= cap) stuck++;
  const n = v => v.toLocaleString('en-US');
  const ord = k => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth'][k - 1] || ('level ' + k);
  return mechFig('What each level costs', mechPlot({
    height: 140,
    x: { min: 1, max: 12, ticks: [2, 4, 6, 8, 10, 12].map(l => ({ v: l, label: String(l) })) },
    y: { log: true, min: base, max: Math.max(cap, mechLevelThreshold(12, base)) * 2, ticks: [{ v: base, label: n(base) }, { v: base * 10, label: n(base * 10) }, { v: base * 100, label: n(base * 100) }, { v: base * 1000, label: n(base * 1000) }] },
    series: [
      { points: levels.map(l => [l, mechLevelThreshold(l, base)]), colour: MECH_INK.gold, name: 'the threshold to pass' },
      { points: [[1, cap], [12, cap]], colour: MECH_INK.warm, dash: '3 3', name: 'the cap, ' + n(cap) }
    ],
    marks: stuck <= 12 ? [{ x: stuck, y: mechLevelThreshold(stuck, base), dot: true, colour: MECH_INK.warm }] : []
  }), 'Each level costs as much as every level before it put together. The ' + ord(stuck) + ' is the last; it comes past ' + n(mechLevelThreshold(stuck - 1, base)) + ' and the next needs <b>' + n(mechLevelThreshold(stuck, base)) + '</b>, which experience cannot reach.');
}

// Karma is a line from nothing to a hundred with the player put on it at 55,
// and the only two things that move it far are killing the wrong thing and
// the helpers. The kill table is four numbers and reads as a picture.
function mechKarmaFigure(km) {
  if (!km.writes.length) return '';
  const start = km.writes.find(w => w.set !== undefined);
  const thresholds = km.reads.map(r => ({ n: parseInt(String(r.test).replace(/\D+/g, ''), 10), test: r.test }))
    .filter(t => !isNaN(t.n)).filter((t, i, a) => a.findIndex(x => x.n === t.n) === i);
  const marks = thresholds.map(t => ({ v: t.n, label: String(t.n), below: true, colour: MECH_INK.warm }));
  if (start) marks.push({ v: start.set, label: 'you start at ' + start.set, above: true });
  const kills = (km.byAlignment || []).map((v, i) => ({
    label: 'alignment ' + i, value: Math.abs(v), text: (v > 0 ? '+' : '') + v,
    colour: v > 0 ? MECH_INK.leaf : v < 0 ? MECH_INK.lose : MECH_INK.dim
  }));
  return mechFig('The scale, and where you stand on it',
    mechNumberLine({ min: 0, max: 100, marks, bands: thresholds.map(t => ({ from: 0, to: t.n, colour: 'rgba(192,104,79,.3)', label: t.test })) }),
    (function () {
      const low = km.reads.filter(r => r.below);
      if (!low.length) return '';
      const n = Math.max.apply(null, low.map(r => r.n)), who = low.filter(r => r.n === n).map(r => labelFor(r.resid) || ('0x' + r.resid.toString(16).toUpperCase()));
      return who.slice(0, -1).join(', ') + (who.length > 1 ? ' and ' : '') + who[who.length - 1] + ' refuse' + (who.length === 1 ? 's' : '') + ' below <b>' + srcNum(low.find(r => r.n === n).val, n) + '</b>.';
    })()) +
    (kills.length ? mechFig('What a kill is worth, by the victim’s alignment', mechBars(kills),
      '') : '');
}

/* One row a food, by the name the game gives it. The table was a row per
   class and aspect, under the class's name: the general foodstuff class is
   "flatbread", so a steak and a pomegranate sat under "flatbread" with an
   aspect number beside them, and a bar chart under it repeated the
   nutrition column (the maintainer, 3 October 2026, asked for the chart to
   go and the table to sort by nutrition instead). Where two foods share a
   name (two "meat", the class "flatbread" and its first variant) the
   create-a-prop word tells them apart, quietly. */
function mechFoodTable(fd) {
  const rows = [];
  for (const f of fd.foods) {
    if (f.variants) for (const v of f.variants) rows.push({ name: v.name || (f.name + ' ' + v.aspect), open: 'propWordOpen(' + f.pt + ',' + v.aspect + ')', word: (v.aspect << 10) | f.pt, plus: v.plus, src: v.src, says: v.says });
    else rows.push({ name: f.name, open: 'showPropTypeDetail(' + f.pt + ')', word: f.pt, plus: f.plus, src: f.val, says: '' });
  }
  if (!rows.length) return '';
  const seen = new Map();
  for (const r of rows) seen.set(r.name, (seen.get(r.name) || 0) + 1);
  rows.sort((a, b) => (b.plus === null) - (a.plus === null) || b.plus - a.plus || a.name.localeCompare(b.name));
  return mechTable([mechSortHead('food', 0), '#' + mechSortHead('nutrition', 1, 'desc'), 'what the eater says'], rows.map(r =>
    '<tr><td data-sort="' + svEsc(r.name) + '">' + svLink(r.name, r.open) + (seen.get(r.name) > 1 ? ' <span class="inspDim">' + propWordHex(r.word) + '</span>' : '') + '</td>' +
    (r.plus !== null ? srcCell(r.src, '+' + r.plus).replace('<td class="num">', '<td class="num" data-sort="' + r.plus + '">') : mechNum('an amount the script works out')) +
    '<td>' + (r.says ? srcSaid(r.src ? r.src.resid : null, r.says) : '') + '</td></tr>'));
}

/* A column heading that sorts its table on a click: the first click puts
   the largest number (or the last name) first unless `dir` says which way
   the table already runs, and each click after turns it round. A cell
   sorts by its data-sort, else by its text. Gold, being a thing to click. */
function mechSortHead(label, col, dir) {
  return '<button class="svLink sortHead"' + (dir ? ' data-dir="' + dir + '"' : '') + ' onclick="mechSortBy(this,' + col + ')">' + svEsc(label) +
    '<span class="sortMark" aria-hidden="true">' + (dir === 'desc' ? ' ▼' : dir === 'asc' ? ' ▲' : '') + '</span></button>';
}
function mechSortBy(btn, col) {
  const table = btn.closest('table'), body = table && table.tBodies[0];
  if (!body) return;
  const dir = btn.dataset.dir === 'desc' ? 'asc' : 'desc';
  table.querySelectorAll('button.sortHead').forEach(b => { delete b.dataset.dir; const m = b.querySelector('.sortMark'); if (m) m.textContent = ''; });
  btn.dataset.dir = dir;
  const mark = btn.querySelector('.sortMark'); if (mark) mark.textContent = dir === 'desc' ? ' ▼' : ' ▲';
  const key = tr => { const c = tr.cells[col]; return c ? (c.dataset.sort !== undefined ? c.dataset.sort : c.textContent.trim()) : ''; };
  const rows = [...body.rows];
  rows.sort((a, b) => {
    const x = key(a), y = key(b), nx = parseFloat(x), ny = parseFloat(y);
    const c = !isNaN(nx) && !isNaN(ny) ? nx - ny : isNaN(nx) !== isNaN(ny) ? (isNaN(nx) ? 1 : -1) * (dir === 'desc' ? -1 : 1) : x.localeCompare(y);
    return dir === 'desc' ? -c : c;
  });
  for (const r of rows) body.appendChild(r);
}

// A duration is a number of 4096ths of an hour, which is unreadable as
// stored. Drawn against the hour it is obvious which of these is a spell you
// walk away from and which lasts a moment.
function mechStatusFigure(st, unit) {
  const rows = [];
  for (const [name, list] of st.applies) {
    const durs = list.map(a => a.duration).filter(d => d !== null && d !== undefined);
    if (!durs.length) continue;
    rows.push({ label: name, value: Math.max.apply(null, durs) });
  }
  if (!rows.length) return '';
  rows.sort((a, b) => b.value - a.value);
  return mechFig(unit ? 'How long a status lasts, against the game hour' : 'How long a status lasts, in clock units',
    mechBars(rows.map(r => ({ label: r.label, value: r.value, colour: MECH_INK.violet,
      text: !unit ? String(r.value) : r.value >= unit ? (r.value / unit).toFixed(r.value % unit ? 1 : 0) + ' h' : Math.round(60 * r.value / unit) + ' min' })), { max: Math.max(unit || 0, rows[0].value) }),
    'The longest each status lasts. The chart leaves out random durations.');
}

// The clock's own arithmetic, over four days: the belly empties in a hundred
// hours and everything else follows from whether it is empty.
function mechHungerFigure(belly, clock) {
  if (belly === null || belly === undefined || !clock) return '';
  const hours = 120;
  const fed = mechHungerRun({ hours, level: 6, nutrition: belly, health: 20, fullHealth: 100, clock });
  const ring = mechHungerRun({ hours, level: 6, nutrition: belly, health: 20, fullHealth: 100, regenerating: true, clock });
  const empty = belly * mechPeriodMinutes(clock, clock.hungerIndex) / 60;
  const pt = r => r.series.map(s => [s.hour, s.health]);
  return mechFig('Five days without a meal, at level 6', mechPlot({
    height: 150,
    x: { min: 0, max: hours, ticks: [0, 24, 48, 72, 96, 120].map(h => ({ v: h, label: h ? h / 24 + 'd' : '0' })) },
    y: { min: 0, max: 100, ticks: [{ v: 100, label: '100' }, { v: 50, label: '50' }, { v: 0, label: '0' }] },
    series: [
      { points: fed.series.map(s => [s.hour, s.nutrition]), colour: MECH_INK.warm, name: 'nutrition' },
      { points: pt(fed), colour: MECH_INK.gold, name: 'health, healing' },
      { points: pt(ring), colour: MECH_INK.cool, name: 'health, with Omen’s ring' }
    ],
    marks: empty <= hours ? [{ x: empty, y: 8, label: 'the belly is empty', colour: MECH_INK.warm }] : []
  }), 'Health rises <b>' + mechHealRate(6, clock) + '</b> times an hour at this level and stops when nutrition reaches zero; the ring’s <b>' + mechRegenRate(clock) + '</b> an hour carries on regardless.');
}

// The staircase. A lock's difficulty is divided by twenty before it is used,
// so it moves in five steps and a difficulty of 19 is a difficulty of 0 --
// which no reading of the formula makes as plain as the picture does.
function mechLockFigure(lk) {
  if (!lk.rule || !lk.rule.formula || !lk.rule.lk) return '';
  const rules = lk.rule.lk;
  const xs = Array.from({ length: 52 }, (_, i) => i * 5);
  const series = [10, 20, 30].map((reflex, i) => ({
    name: 'reflex ' + reflex, colour: MECH_SERIES[i],
    points: xs.map(d => [d, 100 * mechLockChance(reflex, d, rules)])
  }));
  // One dot per distinct difficulty rather than one per class: eight of the
  // classes carry 15, and eight labels on one point is a smudge. The names
  // are joined, the labels alternate down the page so two nearby dots do not
  // collide, and a dot near the right edge hangs its label to the left.
  const byDiff = new Map();
  for (const c of (lk.classes || [])) {
    const d = c.words && c.words[0];
    if (d === undefined || d === null || d > 255) continue;
    if (!byDiff.has(d)) byDiff.set(d, []);
    byDiff.get(d).push(c.name);
  }
  const marks = [...byDiff.entries()].sort((a, b) => a[0] - b[0]).map(([d, names], i) => ({
    x: d, y: 100 * mechLockChance(20, d, rules), dot: true, colour: MECH_INK.ink,
    label: names.slice(0, 3).join(', ') + (names.length > 3 ? ' …' : '') + ' (' + d + ')',
    dy: 11 + (i % 2) * 13, side: d > 190 ? 'right' : 'left'
  }));
  return mechFig('The chance a pick opens it, by the lock’s difficulty', mechPlot({
    height: 150, series, marks,
    x: { min: 0, max: 255, ticks: [0, 60, 120, 180, 255].map(v => ({ v, label: String(v) })) },
    y: { min: 0, max: 100, ticks: [{ v: 100, label: '100%' }, { v: 50, label: '50%' }, { v: 0, label: '0' }] }
  }), 'The dots are each kind of lock, for a picker with reflex 20.');
}

// What a shop asks. The interesting thing is the range -- three orders of
// magnitude between a loaf and the bomb -- so the axis is logarithmic and
// the dearest few are named.
function mechShopFigure(sh) {
  const goods = [];
  for (const s of sh.shops) for (const g of s.goods) if (g.price > 0) goods.push({ name: g.name, price: g.price, who: s.who });
  if (goods.length < 4) return '';
  const buckets = [[1, 2], [3, 5], [6, 10], [11, 25], [26, 50], [51, 100], [101, 250], [251, 1000], [1001, 1e9]];
  const bins = buckets.map(b => ({
    label: b[0] >= 1000 ? '1k' : String(b[0]), value: goods.filter(g => g.price >= b[0] && g.price <= b[1]).length,
    colour: MECH_INK.gold, title: b[0] + ' to ' + b[1] + ' obols: ' + goods.filter(g => g.price >= b[0] && g.price <= b[1]).length + ' items'
  }));
  const dear = goods.slice().sort((a, b) => b.price - a.price).slice(0, 8)
    .map(g => ({ label: g.name, value: g.price, text: g.price + ' ob', colour: MECH_INK.warm }));
  return mechFig('What the shops ask, ' + goods.length + ' items in all', mechColumns(bins, { height: 80 }),
    'Items by price in obols.') +
    mechFig('The dearest things on any counter', mechBars(dear),
      'Prices before bargaining.');
}

// A lesson costs a point, a level earns a few, and mastery is fifteen
// lessons. Drawn against the levels, the question the sheet's numbers pose
// -- can you master anything? -- has a visible answer.
function mechTrainingFigure(tr) {
  if (!tr.points.perLevel || tr.points.atStart === null || tr.points.mastery === null) return '';
  const levels = Array.from({ length: 11 }, (_, i) => i + 1);
  const series = [1, 2, 3, 4].map((difficulty, i) => ({
    name: 'difficulty ' + difficulty, colour: MECH_SERIES[i],
    points: levels.map(l => [l, tr.points.atStart + (l - 1) * Math.max(0, tr.points.perLevel.v - difficulty)])
  }));
  const mastery = tr.points.mastery;
  return mechFig('Training points earned, against what mastery costs', mechPlot({
    height: 140, series,
    x: { min: 1, max: 11, ticks: levels.filter(l => l % 2).map(l => ({ v: l, label: String(l) })) },
    y: { min: 0, max: 60, ticks: [{ v: 60, label: '60' }, { v: 30, label: '30' }, { v: mastery, label: String(mastery) }, { v: 0, label: '0' }] },
    marks: [{ x: 6, y: mastery + 3, label: 'one skill mastered', colour: MECH_INK.ink }]
  }), 'At difficulty 4 a career to level 11 earns ' + (tr.points.atStart + 10 * Math.max(0, tr.points.perLevel.v - 4)) + ' points, ' + ((tr.points.atStart + 10 * Math.max(0, tr.points.perLevel.v - 4)) / mastery).toFixed(1) + ' skills’ worth.');
}

// The balloon itself, at the size the engine draws it, because the sheet
// says 128 by 32 and a rounded box with a tail and that is a picture rather
// than a fact. The geometry is from a trace of TBark in the executable.
function mechBalloonFigure(barks, bark) {
  if (!bark || !bark.ticks || !bark.width || !bark.height) return '';
  const W = bark.width.v, H = bark.height.v, secs = bark.ticks.v / 60;
  // A catalogue entry carries `words`, a list; the balloon shows one short line.
  const first = b => (b && b.words && b.words.length) ? b.words[0] : '';
  const line = (barks && barks.length ? first(barks.find(b => first(b) && first(b).length < 16) || barks[0]) : '');
  return mechFig('The balloon, at the size the program draws it',
    '<svg class="mechBalloon" width="' + (W * 2) + '" height="' + ((H + 6) * 2) + '" viewBox="0 0 ' + W + ' ' + (H + 6) + '" style="max-width:100%;height:auto" role="img" aria-label="a talk balloon">' +
    '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" rx="8" ry="8" fill="#efeade" stroke="#2a2419" stroke-width="1"/>' +
    '<path d="M' + (W / 2 - 8) + ' ' + (H - 0.5) + ' L' + (W / 2 - 4) + ' ' + (H + 5.5) + ' L' + (W / 2 + 4) + ' ' + (H - 0.5) + ' Z" fill="#efeade" stroke="#2a2419" stroke-width="1"/>' +
    '<text x="' + (W / 2) + '" y="' + (H * 0.62) + '" text-anchor="middle" font-size="11" fill="#2a2419" font-family="Georgia,serif">' + svEsc(String(line).slice(0, 22)) + '</text>' +
    '</svg>' +
    mechNumberLine({ min: 0, max: Math.ceil(secs * 1.5), marks: [{ v: 0, label: 'said', above: true }, { v: secs, label: 'gone, ' + bark.ticks.v + ' ticks', below: true }],
      bands: [{ from: 0, to: secs, colour: 'rgba(249,248,111,.28)', label: secs + ' seconds' }] }),
    srcNum(bark.width) + ' by ' + srcNum(bark.height) + ' with a tail, and the tick count plus <b>' + srcNum(bark.ticks) + '</b> for how long it stays, both read out of the program.');
}

// The bed table as a chart, with the 2012 measurements laid over it. This is
// the only figure on the sheet whose numbers can be checked against
// somebody's actual play, so the measurements are drawn as marks rather than
// mentioned in the caption.
function mechSleepFigure(sl, clock) {
  if (!sl || !sl.div || !clock) return '';
  const div = sl.div.v;
  const level = 6;
  const rows = [];
  if (sl.own !== null) rows.push({ name: 'your own bed', quality: sl.own });
  // The innkeeper by name, the way the table under this names them: a
  // character record has no name field, the name is the page's own lookup.
  for (const inn of sl.inns) if (inn.quality !== null) {
    let who = 'character ' + inn.who;
    try { who = characterName(inn.who) || who; } catch (e) { quiet(e); }
    rows.push({ name: who + '’s inn', quality: inn.quality });
  }
  rows.push({ name: 'the bare ground', quality: 0 });
  if (rows.length < 2) return '';
  const bars = rows.map(r => ({
    label: r.name, value: mechBedRate(level, r.quality, { div, clock }), colour: r.quality >= 4 ? MECH_INK.gold : r.quality ? MECH_INK.cool : MECH_INK.dim,
    text: mechBedRate(level, r.quality, { div, clock }) + ' /h', title: r.name + ', quality ' + r.quality
  }));
  const withRing = rows.map(r => ({
    label: r.name, value: mechBedRate(level, r.quality, { regenerating: true, div, clock }), colour: MECH_INK.violet,
    text: mechBedRate(level, r.quality, { regenerating: true, div, clock }) + ' /h'
  }));
  return mechFig('Health an hour asleep, at level 6',
    mechBars(bars, { max: Math.max.apply(null, withRing.map(w => w.value)) }) +
    '<div class="mechSub">and the same with Omen’s ring</div>' +
    mechBars(withRing, { max: Math.max.apply(null, withRing.map(w => w.value)) }),
    'The bed multiplies the usual ' + mechHealRate(level, clock) + ' an hour by <b>1 + quality/' + div + '</b>.');
}

// The clock, on one line and logarithmic, because the numbers it deals in
// run from one unit to four thousand and a linear axis would show a step and
// nothing else.
function mechClockFigure(sp, clk, costs) {
  if (!clk || !clk.model) return '';
  const unit = clk.unitsPerHour.v, m = clk.model;
  const cost = name => { const c = (costs || []).find(x => x.cost && x.routine.name.startsWith('TGameSys::' + name + '(')); return c ? c.cost.v : null; };
  const step = cost('MoveCommand'), take = cost('TakeCommand');
  const stepVal = step ? costs.find(x => x.cost && x.routine.name.startsWith('TGameSys::MoveCommand(')).cost : null;
  const spell = sp && sp.rule && sp.rule.timing ? sp.rule.timeBase.v + 5 * sp.rule.timeMult.v : null;
  const marks = [
    ...(step ? [{ v: step, label: 'a step', above: true }] : []),
    ...(take ? [{ v: take, label: 'taking', below: true }] : []),
    ...(spell ? [{ v: spell, label: 'a level 5 spell', above: true }] : []),
    { v: m.periods[m.poisonIndex], label: exeClockWords(m.periods[m.poisonIndex], unit) + ': poison, the ring', below: true },
    ...(clk.quarterShift ? [{ v: 1 << clk.quarterShift.v, label: exeClockWords(1 << clk.quarterShift.v, unit) + ': the light', above: true }] : []),
    { v: unit, label: 'an hour: hunger, the schedules', below: true }
  ];
  const most = Math.max.apply(null, (costs || []).filter(c => c.cost).map(c => c.cost.v).concat([spell || 1]));
  return mechFig('Everything the clock counts, in units of a ' + unit + 'th of an hour',
    mechNumberLine({ min: 1, max: unit, log: true, marks,
      bands: [{ from: 1, to: most, colour: 'rgba(249,248,111,.22)', label: 'what an action costs' }] }),
    step ? 'A step is <b>' + srcNum(stepVal, step) + '</b> unit' + (step === 1 ? '' : 's') + ', so an hour is ' + Math.round(unit / step).toLocaleString() + ' steps.' : '');
}

// How much of the archive's own code asks about each skill: the table names
// the scripts, this says which skills the game actually leans on.
function mechSkillsFigure(sk) {
  const rows = [];
  for (const [id, resids] of sk.by) {
    let name = 'skill 0x' + id.toString(16).toUpperCase();
    try { if (refExists(0x1A00 + id)) name = selfNameFor(0x1A00 + id) || name; } catch (e) { quiet(e); }
    rows.push({ label: name, value: resids.size, text: String(resids.size) });
  }
  if (rows.length < 2) return '';
  rows.sort((a, b) => b.value - a.value);
  return mechFig('How many scripts ask about each skill', mechBars(rows, { colour: MECH_INK.cool }),
    'Only the checks that name a skill directly' + (sk.generic ? '; <b>' + sk.generic + '</b> more are in shared scripts that check whichever skill their caller passes' : '') + '.');
}

/* ---- the community's patches, read against the open file -------------------
   Cythera's one add-on system is Magpie, and a Magpie patch is a Delver
   Archive holding only the resources it replaces. `mergeDelverPatch` has
   applied one since the browser player needed it; what was missing here is
   the part that comes first, which is saying what a patch IS before anyone
   decides to trust it. So this section reads a patch and shows what it would
   do to the file that is open: its description and its author, whether this
   file already carries it, and every resource it replaces with the shipped
   one drawn beside it.

   VERIFIED HERE MEANS "THIS IS WHAT IT DOES", NOT "WE VOUCH FOR IT". The page
   has no way to know whether a patch is safe and does not pretend to. What it
   can do is decode both sides with the readers it already has and put them
   next to each other, which is the only claim it makes.

   NOTHING IS WRITTEN. The report is built out of `describeDelverPatch`,
   which reads offsets and lengths and reaches Magpie's own verdicts; merging
   is a separate act, offered by the report's Apply button (patchesApply,
   below) and done in memory like every other edit here.

   THE TWO ARCHIVES PROBLEM DOES NOT ARISE: `delverArchiveSpec` takes bytes
   and `decodeResource` takes a resource's bytes, so a patch's tile sheet
   decodes without the open file ever being displaced. Since 18 September
   2026 that is true of every reader in js/delv-*.js, which take the archive
   as an argument; before that `getResourceBytes` read the open one out of a
   global, and this section was written around it. */

/* The open archive as a writer spec, which is what the patch readers compare
   against. 12 ms over the shipped file and 1,558 resources, so this is a
   cache for tidiness rather than for speed; resetDerivedCaches drops it with
   everything else keyed to the file that is open. */
function patchBaseSpec() {
  if (!DERIVED.PATCH_BASE_SPEC && ARCHIVE)
    DERIVED.PATCH_BASE_SPEC = delverArchiveSpec(ARCHIVE.bytes);
  return DERIVED.PATCH_BASE_SPEC;
}

/* A patch's bytes, however they got here. Split from the file control below
   so the whole path -- unwrap, parse, compare, draw -- can be driven from a
   harness with a patch built in memory, which is the only way any of this is
   checkable: the one real patch on this disk arrives inside a StuffIt archive
   the page cannot decompress, so a check that needed the real file would skip
   on most machines and prove nothing. */
function patchesOpenBytes(bytes, name) {
  const note = document.getElementById('patchNote');
  const say = (msg, bad) => { if (note) { note.textContent = msg; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  const base = patchBaseSpec();
  if (!base) { say('No game file is open to compare the patch with.', true); return false; }
  let got;
  try { got = extractDelverArchive(bytes); }
  catch (e) { say('The page could not open that file: ' + e.message, true); return false; }
  const patch = delverArchiveSpec(got.bytes);
  if (!patch) { say('That file is not a Delver Archive, so it is not a Magpie patch.', true); return false; }
  const report = describeDelverPatch(base, patch);
  report.fileName = name || '';
  report.via = got.via;
  window.PATCH_REPORT = report;
  // The archive's own bytes, not the wrapper's: mergeDelverPatch wants the
  // Delver archive, and what was dropped may have been a .hqx round a .sit.
  window.PATCH_BYTES = got.bytes;
  say('');
  renderPatchReport();
  return true;
}

/* A patch file chosen in the section. It arrives the way any file here does,
   so it can be a .hqx or a MacBinary wrapper as easily as a bare data fork,
   and extractDelverArchive is what already knows the order to try them in. */
function patchesOpenFile(file) {
  if (!file) return;
  file.arrayBuffer().then(buf => { const b = new Uint8Array(buf); noteMagpieFrom(b); patchesOpenBytes(b, file.name); }).catch(e => {
    const note = document.getElementById('patchNote');
    if (note) { note.textContent = 'The page could not read that file: ' + e.message; note.className = 'mechSub patchBad'; }
  });
}

function patchesForget() {
  window.PATCH_REPORT = null;
  window.PATCH_BYTES = null;
  renderPatchReport();
}

/* ---- applying a patch to the open file -------------------------------------
   The patches section described a patch and would not apply one, deliberately:
   until the descriptor's check value could be reproduced, a patch read or
   written here was a thing this page understood and Magpie did not, and
   offering to merge one invited a file nobody else would take.

   That held until 15 September 2026, when Magpie under Mac OS 9 installed a
   patch grimoire wrote. The remaining reason not to apply was gone, and
   the reason to apply had been there all along: the only way to see what a
   patch does was to install it and play to wherever the changed art is. The
   Pumpkin Patch redraws foliage and blades across twelve sheets, which is a
   long walk.

   IT IS THE EDIT PATH, NOT A NEW ONE. mergeDelverPatch produces the merged
   bytes and parseArchiveBytes re-enters with `via: 'edit'`, exactly as editing
   a resource does, so every derived table drops and every view -- the tile
   galleries, the map, the atlas -- redraws from the patched archive.
   PRISTINE_BYTES is left alone by that path, which is what lets the comparison
   section then show precisely what the patch changed.

   NOTHING IS WRITTEN. The merge is in memory, like every other edit here. */
function patchesApply() {
  const rep = window.PATCH_REPORT, bytes = window.PATCH_BYTES;
  const note = document.getElementById('patchNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (!rep || !bytes) { say('No patch is open.', true); return false; }
  if (!ARCHIVE) { say('No game file is open.', true); return false; }
  let merged;
  try { merged = mergeDelverPatch(ARCHIVE.bytes, bytes); }
  catch (e) { say('The page could not apply that patch: ' + e.message, true); return false; }
  const dirty = new Set(window.EDITED_RESIDS);
  for (const id of merged.replaced.concat(merged.added)) dirty.add(id);
  parseArchiveBytes(merged.bytes, window.ARCHIVE_SOURCE_NAME || 'archive',
                    { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  if (typeof refreshChangesBadge === 'function') refreshChangesBadge();
  const what = (rep.descriptor && rep.descriptor.description) || rep.fileName || 'that patch';
  setStatus(merged.replaced.length + ' resource(s) replaced' +
    (merged.added.length ? ' and ' + merged.added.length + ' added' : '') + ' by ' + what +
    '. This changes only the copy in this browser, and the galleries and maps now show it. ' +
    'To download the changed file, go to Data \u203a Cythera Data \u203a Changes.');
  return true;
}

/* One 32x32 tile out of a decoded sheet, as a canvas at 2x. A sheet is one
   tile wide and as many tiles tall as it holds, so a tile is a horizontal
   band of it and nothing has to be reshaped to cut one out. */
function patchTileCanvas(dec, t, subn) {
  const c = document.createElement('canvas');
  const img = new Uint8Array(32 * 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const gy = t * 32 + y;
    img[y * 32 + x] = (gy < dec.H && x < dec.W) ? (dec.image[gy * dec.W + x] || 0) : 0;
  }
  drawToCanvas(c, 32, 32, img, transparentIndexFor(subn));
  c.className = 'patchTile';
  return c;
}

/* Which tiles of a sheet the patch redraws. Null when the two sides do not
   decode to the same shape, which is a patch doing something this comparison
   cannot describe rather than a patch that is wrong. */
function patchSheetDiff(r) {
  let a, b;
  try { a = decodeResource(ARCHIVE, r.baseData, r.subn, r.resid); b = decodeResource(ARCHIVE, r.patchData, r.subn, r.resid); }
  catch (e) { return null; }
  if (!a || !b || a.W !== b.W || a.H !== b.H) return null;
  const tiles = Math.floor(a.H / 32);
  if (a.W !== 32 || tiles < 1) return null;
  const changed = [];
  for (let t = 0; t < tiles; t++) {
    let diff = false;
    for (let y = t * 32; y < (t + 1) * 32 && !diff; y++)
      for (let x = 0; x < a.W; x++) if (a.image[y * a.W + x] !== b.image[y * b.W + x]) { diff = true; break; }
    if (diff) changed.push(t);
  }
  return { base: a, patch: b, tiles, changed };
}

/* The report as elements rather than as a string, because the tile
   comparison is canvases and a canvas cannot be built out of innerHTML. */
function renderPatchReport() {
  const host = document.getElementById('patchReport');
  if (!host) return;
  host.innerHTML = '';
  const rep = window.PATCH_REPORT;
  if (!rep) return;
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  const d = rep.descriptor;
  const who = d && DELV_PATCH_AUTHORS[d.uuidText];

  host.appendChild(el('div', 'partsTitle', 'About this patch'));
  const facts = [];
  facts.push('<tr><td>file</td><td>' + svEsc(rep.fileName || '') +
             (rep.via && rep.via !== 'data fork' ? '<span class="mechSub"> read from its ' + svEsc(rep.via) + '</span>' : '') + '</td></tr>');
  if (who) facts.push('<tr><td>made by</td><td><b>' + svEsc(who.name) + '</b>' +
             (who.title ? '<span class="mechSub"> ' + svEsc(who.title) + '</span>' : '') + '</td></tr>');
  if (d && d.description) facts.push('<tr><td>description</td><td>' + svEsc(d.description) + '</td></tr>');
  if (d) {
    facts.push('<tr><td>identity</td><td class="patchMono">' + svEsc(d.uuidText) + '</td></tr>');
    facts.push('<tr><td>check value</td><td><span class="patchMono">' + svEsc(d.checkValue) + '</span>' +
      (d.checkValueValid ? '<span class="mechSub"> correct, so the patch is intact</span>'
                         : '<span class="patchBad"> wrong, so Magpie would not install this patch</span>') + '</td></tr>');
    facts.push('<tr><td>type</td><td>' + (d.typeLabel ? '<b>' + svEsc(d.typeLabel) + '</b>' : 'code ' + d.typeCode) +
      (d.typeOverwritten ? '<span class="mechSub"> Magpie gives this code to a patch that fails its check</span>'
       : d.typeLabel ? '<span class="mechSub"> as Magpie shows it</span>'
       : '<span class="mechSub"> Magpie shows no name for this code</span>') + '</td></tr>');
  }
  facts.push('<tr><td>scenario</td><td>' + svEsc(rep.scenarioTitle || '') + '</td></tr>');
  facts.push('<tr><td>format</td><td>' + svEsc(rep.format) +
    (rep.format === rep.baseFormat ? '' : '<span class="mechSub"> and this file is ' + svEsc(rep.baseFormat) + '</span>') + '</td></tr>');
  host.appendChild(el('div', '', mechTable(['', ''], facts, 'patchFacts')));
  if (!d) host.appendChild(el('p', 'mechSub',
    'This patch does not describe itself, so Magpie would not list it. What it changes is still shown below.'));
  if (who) host.appendChild(el('p', 'mechSub', 'The name is not in the file. It comes from ' + svEsc(who.source) + '.'));

  host.appendChild(el('div', 'partsTitle', 'Against the open file'));
  const verdicts = [];
  verdicts.push(rep.isInstalled
    ? 'This file <b>already lists this patch</b> as applied.'
    : rep.installedIds.length
      ? 'This file lists <b>' + rep.installedIds.length + '</b> applied patch' + (rep.installedIds.length === 1 ? '' : 'es') + ', and this is not one of them.'
      : 'This file lists no applied patches.');
  if (rep.usable) verdicts.push('Magpie would accept it for this file.');
  else for (const r of rep.reasons) verdicts.push('Magpie would refuse it: ' + svEsc(r) + '.');
  if (rep.willAdd.length) verdicts.push('<b>' + rep.willAdd.length + '</b> resource' + (rep.willAdd.length === 1 ? '' : 's') +
    ' the patch carries ' + (rep.willAdd.length === 1 ? 'is' : 'are') + ' not in this file, and the patch would add them.');
  if (rep.disagreed.length) verdicts.push('<b>' + rep.disagreed.length + '</b> the page would refuse, because one of the two has the resource encrypted and the other does not.');
  if (rep.unchanged.length) verdicts.push('<b>' + rep.unchanged.length + '</b> are already identical to what this file holds.');
  host.appendChild(el('ul', 'ruleList', verdicts.map(v => '<li>' + v + '</li>').join('')));

  const rows = rep.resources.map(r => '<tr>' +
    '<td>' + (r.inBase ? svChip(r.resid, labelFor(r.resid) || '') : '<span class="patchMono">' + propWordHex(r.resid) + '</span>') + '</td>' +
    mechNum(r.baseLength === null ? '' : r.baseLength) + mechNum(r.patchLength) +
    '<td class="mechSub">' + (!r.inBase ? 'added' : !r.encryptionAgrees ? 'encryption differs' :
      r.identical ? 'identical' : 'replaced') + '</td></tr>');
  host.appendChild(el('div', 'partsTitle', 'What it changes'));
  host.appendChild(el('div', '', mechTable(['resource', '#in this file', '#in the patch', ''], rows)));

  /* The part worth the whole section: the tiles themselves, shipped above
     patched. Only the tiles that differ are drawn. A sheet holds sixteen and
     the Pumpkin Patch redraws two or three of most of them, so drawing all
     192 would bury the answer in tiles nobody touched. */
  const sheets = rep.resources.filter(r => r.inBase && !r.identical && r.subn === 141)
    .map(r => ({ r, diff: patchSheetDiff(r) })).filter(x => x.diff && x.diff.changed.length);
  if (sheets.length) {
    const total = sheets.reduce((n, x) => n + x.diff.changed.length, 0);
    const of = sheets.reduce((n, x) => n + x.diff.tiles, 0);
    host.appendChild(el('div', 'partsTitle', 'What it redraws: ' + total + ' tiles of ' + of));
    host.appendChild(el('p', 'mechSub', 'The original tile is on the left of each pair, and the patch’s on the right.'));
    for (const { r, diff } of sheets) {
      const head = el('div', 'patchSheetHead');
      head.innerHTML = svChip(r.resid, labelFor(r.resid) || '') +
        '<span class="mechSub">' + diff.changed.length + ' of ' + diff.tiles + '</span>';
      host.appendChild(head);
      const strip = el('div', 'patchStrip');
      for (const t of diff.changed) {
        const pair = el('div', 'patchPair');
        pair.appendChild(patchTileCanvas(diff.base, t, r.subn));
        pair.appendChild(patchTileCanvas(diff.patch, t, r.subn));
        pair.appendChild(el('span', 'patchTileNo', String(t)));
        strip.appendChild(pair);
      }
      host.appendChild(strip);
    }
  }
  scriptDiffSection(host, el, rep.resources.filter(r => !r.identical && SCRIPT_SUBN.has(r.subn))
    .map(r => ({ resid: r.resid, a: r.baseData, b: r.patchData })), 'the open file', 'the patch', rep.scriptDiffs || (rep.scriptDiffs = new Map()));
  /* Applying is offered only when the merge would do something, and the lines
     above the button say what will move rather than leaving it to be found. */
  if (rep.usable && (rep.willReplace || rep.willAdd.length)) {
    const moves = [];
    if (rep.willReplace) moves.push('Replaces <b>' + rep.willReplace + '</b> resource' + (rep.willReplace === 1 ? '' : 's'));
    if (rep.willAdd.length) moves.push((moves.length ? 'adds' : 'Adds') + ' <b>' + rep.willAdd.length + '</b>');
    host.appendChild(el('div', 'partsTitle', 'Apply it'));
    host.appendChild(el('ul', 'ruleList',
      '<li>' + moves.join(' and ') +
      ' in the copy of the file in this browser. <b>Nothing goes to disk.</b></li>' +
      '<li>The galleries and maps then show the patch.</li>' +
      '<li>The page keeps the original file, so <b>Compare Two Files</b> can then show exactly what changed.</li>'));
    const bar = el('div', 'mechStats');
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = 'Apply to the open file';
    b.onclick = function () { if (patchesApply()) renderPatchReport(); };
    bar.appendChild(b);
    host.appendChild(bar);
  }
  host.appendChild(el('div', '', svLink('Forget this patch', 'patchesForget()')));
}

/* The scripts a patch or a comparison changes, each line by line
   (dvmScriptDiff in js/delv-fold.js). The sections said which scripts
   changed and by how many bytes; the maintainer asked for the exact
   difference (27 September 2026), and a fix patch is nearly all scripts.
   One fold a script, its counts on the fold and its lines drawn when it is
   first opened, since a patch of a hundred and sixty scripts drawn at once
   is a long page on a phone. `pairs` is [{ resid, a, b }], each side's
   plaintext or null; `memo` is a Map kept on the report, since the Tools
   tab draws the report again every time it is shown and the diffs of a
   hundred and sixty scripts were worked out again with it. */
function scriptDiffSection(host, el, pairs, aName, bName, memo) {
  if (!pairs.length) return;
  host.appendChild(el('div', 'partsTitle', 'The scripts, line by line: ' + pairs.length));
  host.appendChild(el('p', 'mechSub', 'The lines that differ, with two lines either side. ' +
    '− is ' + svEsc(aName) + ', + is ' + svEsc(bName) + ', with the words that differ underlined. ' +
    'Any text a script holds follows its code.'));
  for (const p of pairs) {
    let d = memo && memo.get(p.resid);
    if (d === undefined) {
      d = null;
      try { d = dvmScriptDiff(ARCHIVE, p.resid, p.a, p.b); } catch (e) { quiet(e, 'comparing script ' + propWordHex(p.resid)); }
      if (memo) memo.set(p.resid, d);
    }
    const det = document.createElement('details');
    det.className = 'sdScript';
    const counts = !d ? 'unreadable' :
      (d.removed || d.added ? '−' + d.removed + ' +' + d.added : '') +
      (d.textRemoved || d.textAdded ? (d.removed || d.added ? ', ' : '') + 'text −' + d.textRemoved + ' +' + d.textAdded : '') ||
      'no line differs';
    det.innerHTML = '<summary>' + svEsc(labelFor(p.resid) || propWordHex(p.resid)) + '<span class="sdCount">' + counts + '</span></summary>';
    let drawn = false;
    det.ontoggle = () => {
      if (!det.open || drawn) return;
      drawn = true;
      det.appendChild(el('div', 'sdBody', scriptDiffHTML(p, d)));
    };
    host.appendChild(det);
  }
}
function scriptDiffHTML(p, d) {
  const line = l => '<div class="sdLine ' + (l.k === '-' ? 'sdOld' : l.k === '+' ? 'sdNew' : 'sdSame') + '">' +
    '<span class="sdMark">' + (l.k === '-' ? '−' : l.k === '+' ? '+' : '') + '</span><span class="sdText">' +
    (l.parts ? l.parts.map(([t, c]) => c ? '<b>' + svEsc(t) + '</b>' : svEsc(t)).join('') : svEsc(l.text)) + '</span></div>';
  const hunks = hs => hs.map(h => '<div class="sdHunk">' + h.map(line).join('') + '</div>').join('');
  let h = '<div>' + (p.a || p.b ? svChip(p.resid, labelFor(p.resid) || '') : '') + '</div>';
  if (!d) return h + '<p class="mechSub">Could not read this script.</p>';
  h += hunks(d.hunks);
  if (d.text.length) h += '<div class="mechSub">Text in its data</div>' + hunks(d.text);
  if (!d.hunks.length && !d.text.length)
    h += '<p class="mechSub">No line of its listing and no text in its data differs, but the bytes do: ' +
      (p.a ? p.a.length : 0) + ' against ' + (p.b ? p.b.length : 0) + '.</p>';
  return h;
}

/* ---- a patch of your own: a sprite's body and colours -----------------------
   The patches section reads a patch; this one makes one, out of a handful of
   choices rather than out of edits. It is the smallest patch worth having --
   one resource, a sprite sheet -- and so the plainest demonstration of the
   whole route: choose, look, apply it to the copy in this browser, or take it
   away as a file Magpie installs.

   Three kinds of choice, in the order the section offers them:
   - for the hero and the heroine, a BODY: another sprite's frames worn on
     their sheet (heroWearFrames; which bodies qualify is heroBodies below);
   - for the hero and the heroine in their own body, the PARTS: hair, skin
     and clothes, from the hand-made table HERO_SPRITES;
   - for any sprite, COLOUR BY COLOUR: each region the art is painted in
     (heroShadeDef), replaced as a whole. Each row carries a frame with only
     that region in colour, since a list of palette indices means nothing
     until you see which pixels they are.
   The recolouring is all in js/delv-graphics.js, indices to indices; what is
   here is the choosing and the drawing.

   ALWAYS FROM THE FILE AS IT ARRIVED. The part table names this release's
   indices, so a sheet already recoloured would label nothing and a second
   recolour would compound the first. So the art is taken from PRISTINE_BYTES
   when the open file has one, which applying a patch leaves alone, and the
   choices are re-applied to the shipped art every time.

   ONLY A SPRITE'S OWN FRAMES. Sheets are shared -- the demon's eight frames
   are the first half of 0x8E5D and the golem's the second -- so a recolour
   touches the frames 0xF004 names for the chosen class and writes the rest
   of the sheet back as it was. Who else is drawn with those frames is said
   rather than assumed: every character record that wears the class. */
const HERO_SWATCHES = {
  hair: [['black', '#1a1410'], ['dark brown', '#3e2614'], ['brown', '#6b4221'], ['auburn', '#8a3418'],
         ['red', '#c4461c'], ['ginger', '#d8722a'], ['blond', '#d8b050'], ['flaxen', '#e8d8a0'],
         ['gray', '#8c8c8c'], ['white', '#ececec'], ['blue', '#2850c0'], ['green', '#2f8a3a'], ['violet', '#7a38a8']],
  skin: [['pale', '#f4d4bc'], ['fair', '#e6b48c'], ['tan', '#c98c5c'], ['brown', '#a0643a'],
         ['dark brown', '#74462a'], ['deep brown', '#4a2c1a'], ['green', '#6a9a50'], ['blue', '#6a8ac8']],
  clothes: [['black', '#1c1c1c'], ['white', '#e8e8e8'], ['gray', '#808080'], ['red', '#a01c1c'],
            ['orange', '#c86420'], ['yellow', '#d8b030'], ['green', '#2c7a30'], ['teal', '#1f7070'],
            ['blue', '#2448a8'], ['navy', '#20284a'], ['purple', '#6a2c8a'], ['brown', '#6a4424'], ['tan', '#b89868']],
  shade: [['black', '#1c1c1c'], ['white', '#e8e8e8'], ['gray', '#808080'], ['red', '#b01c1c'],
          ['orange', '#d06a20'], ['yellow', '#d4aa18'], ['green', '#2c8a30'], ['teal', '#1f7070'],
          ['blue', '#2448a8'], ['purple', '#6a2c8a'], ['pink', '#e070b0'], ['pale skin', '#f4d4bc'],
          ['tan', '#c98c5c'], ['dark skin', '#4a2c1a']],
};
function heroSwatchesFor(key) { return HERO_SWATCHES[key] || HERO_SWATCHES.clothes; }
function heroHexRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }

// The choices survive a redraw of the sheet, and are kept per figure, so
// going from the hero to the demon and back finds the hero as he was left.
window.HERO_SPRITE_STATE = window.HERO_SPRITE_STATE || { which: 'hero', choices: {} };
function heroState(key) {
  const c = window.HERO_SPRITE_STATE.choices;
  return c[key] || (c[key] = { parts: {}, shades: {}, body: null });
}

/* The file the art is taken from, as a writer spec, cached against the bytes
   object so a different file is noticed without a reset hook. */
function heroSourceSpec() {
  const bytes = window.PRISTINE_BYTES || (ARCHIVE ? ARCHIVE.bytes : null);
  if (!bytes) return null;
  const c = window.HERO_SOURCE_SPEC;
  if (c && c.bytes === bytes) return c.spec;
  let spec = null;
  try { spec = delverArchiveSpec(bytes); } catch (e) { spec = null; }
  window.HERO_SOURCE_SPEC = { bytes, spec, classes: null };
  return spec;
}

// A whole sheet of the source file, decoded, or null.
function heroSheetImage(sheet) {
  const spec = heroSourceSpec();
  const res = spec && spec.resources.find(r => r.resid === sheet);
  if (!res) return null;
  let dec = null;
  try { dec = decodeResource(ARCHIVE, res.data, 141, sheet); } catch (e) { dec = null; }
  return dec && dec.W === 32 && dec.H >= 32 ? Uint8Array.from(dec.image) : null;
}

/* Every sprite class the file names a character or a monster by
   (cheatSpriteClasses), with where its own frames are: the first run 0xF004
   gives its base tile's name, cut off at the end of the sheet. Names repeat
   (two men, three Seldane), so a repeated one carries its class number. */
function heroSpriteClasses() {
  heroSourceSpec();
  const c = window.HERO_SOURCE_SPEC;
  if (c && c.classes) return c.classes;
  const out = [];
  let list = [];
  try { list = cheatSpriteClasses(); } catch (e) { list = []; }
  let tiles = [];
  try { tiles = getPropTileList(); } catch (e) { tiles = []; }
  for (const k of list) {
    const base = tiles[k.pt];
    if (base === undefined || base === null) continue;
    let info = null, own = 0, multi = false;
    try {
      info = spriteFrameInfo(0, k.pt);
      const runs = frameRuns(base, info.present);
      if (runs[0] && runs[0].name === terrainNameFor(base)) own = runs[0].frames.length;
    } catch (e) { own = 0; }
    const start = base & 15;
    own = Math.min(own, 16 - start);
    if (!own) continue;
    try { for (let f = 0; f < own; f++) if (multiTilePieces(base + f, false)) multi = true; } catch (e) { quiet(e); }
    out.push({ pt: k.pt, name: k.name, kind: k.kind, base, sheet: 0x8E00 + (base >> 4), start, frames: own,
               multi, still: !!(info && info.isStatic) });
  }
  const seen = {};
  for (const k of out) seen[k.name] = (seen[k.name] || 0) + 1;
  for (const k of out) k.label = seen[k.name] > 1 ? k.name + ' (' + k.pt + ')' : k.name;
  if (c) c.classes = out;
  return out;
}

/* A portrait could be recoloured here too from 24 September 2026; the
   maintainer had it taken out on 3 October 2026, untested and not wanted.
   heroShadeDef and the families work on any indexed picture still. */

/* What the hero or the heroine can wear: a person's sixteen frames, which
   are laid out as theirs are, or a monster's eight or four, which
   heroWearFrames spreads over their poses. Not a sixteen-frame monster, not
   a sprite built of several tiles, and not a still one such as the corpse. */
function heroBodies(pt) {
  return heroSpriteClasses().filter(k => k.pt !== pt && !k.multi && !k.still &&
    (k.frames === 4 || k.frames === 8 || (k.frames === 16 && (k.kind === 'person' || k.pt === 32 || k.pt === 33))));
}

/* One figure, read: the sheet and frames it is drawn from, the art as it is
   about to be recoloured (its own or a worn body), the part map where there
   is one, the shade families, and who else is drawn with those frames. Null
   when the open file has no such sprite, which is what a saved game gives.
   `key` is 'hero' or 'heroine', or 'pt' and a class number for any other. */
function heroFigure(key) {
  const def = HERO_SPRITES.find(d => d.key === key) || null;
  const pt = def ? def.proptype : (/^pt\d+$/.test(key) ? parseInt(key.slice(2), 10) : null);
  if (pt === null) return null;
  const cls = heroSpriteClasses().find(k => k.pt === pt);
  if (!cls) return null;
  const sheetImage = heroSheetImage(cls.sheet);
  if (!sheetImage || sheetImage.length < (cls.start + cls.frames) * 1024) return null;
  const shipped = sheetImage.slice(cls.start * 1024, (cls.start + cls.frames) * 1024);
  const st = heroState(key);
  let body = null, image = shipped;
  if (def && cls.frames === 16 && st.body) {
    body = heroBodies(pt).find(k => k.pt === st.body) || null;
    const bodySheet = body && heroSheetImage(body.sheet);
    const worn = bodySheet && heroWearFrames(bodySheet.subarray(body.start * 1024, (body.start + body.frames) * 1024), body.frames / 4);
    if (worn) image = worn; else body = null;
  }
  const H = cls.frames * 32;
  const labels = def && !body ? heroPartMap(image, 32, H, def) : null;
  const shades = heroShadeDef(image);
  const shadeLabels = heroPartMap(image, 32, H, shades);
  let wearers = 0;
  try { for (const c of loadCharacterTable()) if (c && c.proptype === pt) wearers++; } catch (e) { quiet(e); }
  const others = heroSpriteClasses().filter(k => k.pt !== pt && k.sheet === cls.sheet &&
    k.start < cls.start + cls.frames && cls.start < k.start + k.frames);
  return { key, def: labels ? def : null, pt, cls, name: cls.label, sheet: cls.sheet, start: cls.start,
           frames: cls.frames, W: 32, H, sheetImage, shipped, image, body, labels, shades, shadeLabels,
           wearers, others, unknown: labels ? labels.unknown : 0 };
}

// The figure as chosen: the frames, and how many pixels differ from the
// shipped ones -- a worn body with no colour changed still differs.
function heroRecoloured(fig) {
  const st = heroState(fig.key);
  let out = Uint8Array.from(fig.image);
  if (fig.labels) {
    const choices = {};
    for (const k of Object.keys(st.parts)) if (st.parts[k]) choices[k] = heroHexRgb(st.parts[k].hex);
    out = heroRecolour(fig.image, fig.labels, heroRemapTables(fig.image, fig.labels, fig.def, choices));
  }
  /* Families given the same colour are recoloured as ONE part. Apart, each
     lands the colour on its own mean lightness, so a body drawn in two rows
     of red -- the demon's -- came out as two yellows in blotches. Together
     they share one mean and keep their shading against each other. */
  const byHex = new Map();
  fig.shades.parts.forEach(p => {
    const c = st.shades[p.key];
    if (!c) return;
    if (!byHex.has(c.hex)) byHex.set(c.hex, { key: c.hex, sure: [] });
    byHex.get(c.hex).sure.push(...p.sure);
  });
  if (byHex.size) {
    const merged = { parts: [...byHex.values()], shared: [] };
    const labels = heroPartMap(fig.image, fig.W, fig.H, merged);
    const sc = {};
    for (const hex of byHex.keys()) sc[hex] = heroHexRgb(hex);
    const tables = heroRemapTables(fig.image, labels, merged, sc);
    const shaded = heroRecolour(fig.image, labels, tables);
    for (let i = 0; i < out.length; i++) { const l = labels[i]; if (l >= 0 && tables[l]) out[i] = shaded[i]; }
  }
  let moved = 0;
  for (let i = 0; i < out.length; i++) if (out[i] !== fig.shipped[i]) moved++;
  return { image: out, moved };
}

// What the patch will call itself, which is what Magpie lists it by.
function heroDescription(fig) {
  const st = heroState(fig.key);
  const bits = [];
  if (fig.body) bits.push('as the ' + fig.body.label);
  if (fig.def) for (const p of fig.def.parts) if (st.parts[p.key]) bits.push(p.label + ' ' + st.parts[p.key].name);
  const n = fig.shades.parts.filter(p => st.shades[p.key]).length;
  if (n) bits.push(n + (n === 1 ? ' color' : ' colors') + ' changed');
  return 'The ' + fig.name + (bits.length ? ', ' + bits.join(', ') : ', as shipped');
}

/* The patch, written from the open file's spec with the one sheet replaced:
   the figure's frames recoloured, the rest of the sheet as the source has it.
   The open file rather than the source, because the descriptor has to be
   written for the file it will be applied to. Null when nothing differs. */
function heroSpritePatch() {
  const fig = heroFigure(window.HERO_SPRITE_STATE.which);
  const base = patchBaseSpec();
  if (!fig || !base) return null;
  const rec = heroRecoloured(fig);
  if (!rec.moved) return null;
  let resid, data, name;
  {
    const sheet = Uint8Array.from(fig.sheetImage);
    sheet.set(rec.image, fig.start * 1024);
    resid = fig.sheet;
    data = encodeDCGLiterals(sheet);
    name = fig.name.charAt(0).toUpperCase() + fig.name.slice(1) + ' Colors';
  }
  if (!base.resources.find(r => r.resid === resid)) return null;
  const spec = Object.assign({}, base, {
    resources: base.resources.map(r => r.resid === resid ? Object.assign({}, r, { data }) : r) });
  const d = document.getElementById('heroDesc');
  const w = writeDelverPatch(spec, [resid],
    { description: (d && d.value) || heroDescription(fig), typeCode: DELV_PATCH_EXPORT_TYPE });
  w.name = safeFileName(name);
  return w;
}

function heroSay(m, bad) {
  const note = document.getElementById('heroNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}

/* Apply goes through the patches section rather than beside it: the patch is
   handed to its reader and then to its Apply, which is the edit path every
   other change here takes. The report does not outlive that -- re-entering
   the archive drops it with every other derived table -- so "Read it as a
   patch" is the button for seeing what the patch is. */
function heroSpriteApply() {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The page could not write the patch: ' + e.message, true); return false; }
  if (!w) { heroSay('Choose something to apply first.', true); return false; }
  if (!patchesOpenBytes(w.bytes, w.name)) { heroSay('The page refused the patch.', true); return false; }
  const ok = patchesApply();
  if (ok) { renderPatchReport(); heroSay('Applied to the copy of the file in this browser. To download the changed file, go to Data › Cythera Data › Changes.'); }
  return ok;
}

function heroSpriteShowPatch() {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The page could not write the patch: ' + e.message, true); return false; }
  if (!w) { heroSay('Choose something to read first.', true); return false; }
  const ok = patchesOpenBytes(w.bytes, w.name);
  const host = document.getElementById('patchReport');
  if (ok && host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return ok;
}

function heroSpriteDownload(asMacBinary) {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The page could not write the patch: ' + e.message, true); return null; }
  if (!w) { heroSay('Choose something to write first.', true); return null; }
  if (asMacBinary) {
    const bin = writeMacBinary({ name: w.name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    dlBlob(new Blob([bin], { type: 'application/macbinary' }), w.name + '.bin');
  } else downloadBlob(w.bytes, w.name);
  heroSay(w.bytes.length.toLocaleString() + ' bytes, one resource, identity ' + w.uuidText +
    (w.checkValueValid ? ', and the check value verifies.' : ', and the check value does not verify.'), !w.checkValueValid);
  return w;
}

function heroSpritePick(key) {
  window.HERO_SPRITE_STATE.which = key;
  renderHeroSprite();
}

// A part of the hero or the heroine; hex null puts it back as drawn.
function heroSpriteChoose(part, name, hex) {
  heroState(window.HERO_SPRITE_STATE.which).parts[part] = hex ? { name, hex } : null;
  renderHeroSprite();
}

// A family of shades, keyed as heroShadeDef keys it.
function heroSpriteShade(family, name, hex) {
  heroState(window.HERO_SPRITE_STATE.which).shades[family] = hex ? { name, hex } : null;
  renderHeroSprite();
}

/* A different body forgets the colour-by-colour choices, because the
   families are the old body's: the demon's reds are not the hero's blues. */
function heroSpriteBody(pt) {
  const st = heroState(window.HERO_SPRITE_STATE.which);
  st.body = pt ? +pt : null;
  st.shades = {};
  renderHeroSprite();
}

function heroSpriteReset() {
  const c = window.HERO_SPRITE_STATE.choices;
  c[window.HERO_SPRITE_STATE.which] = { parts: {}, shades: {}, body: null };
  renderHeroSprite();
}

/* The frame a family shows best in, with every pixel outside the family
   put to a dark grey and the outline kept, so the row says what it covers. */
function heroShadeThumb(fig, pi) {
  const size = fig.W * 32;
  let best = 0, most = -1;
  const frames = fig.frames;
  for (let t = 0; t < frames; t++) {
    let n = 0;
    for (let i = t * size; i < (t + 1) * size; i++) if (fig.shadeLabels[i] === pi) n++;
    if (n > most) { most = n; best = t; }
  }
  const img = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    const v = fig.image[best * size + i];
    img[i] = !v || v === 0xFF || fig.shadeLabels[best * size + i] === pi ? v : 0x1C;
  }
  return patchTileCanvas({ image: img, W: 32, H: 32 }, 0, 141);
}
/* The controls, the frames and the buttons, redrawn whole on every choice.
   A sheet is 16 KB of pixels and the remap is a table lookup, so a redraw is
   well under a frame and nothing is worth keeping between them. */
function renderHeroSprite() {
  const host = document.getElementById('heroSprite');
  if (!host) return;
  host.innerHTML = '';
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  const st = window.HERO_SPRITE_STATE;
  const heroes = HERO_SPRITES.map(d => heroFigure(d.key)).filter(Boolean);
  const classes = heroSpriteClasses().filter(k => !HERO_SPRITES.some(d => d.proptype === k.pt));
  if (!heroes.length && !classes.length) {
    host.appendChild(el('p', 'mechSub', 'This file has no sprite sheet to recolor.'));
    return;
  }
  let fig = heroFigure(st.which);
  if (!fig) { fig = heroes[0] || heroFigure('pt' + classes[0].pt); st.which = fig.key; }
  const mine = heroState(fig.key);

  // Whose sprite: the hero and the heroine by their frame 0, anyone else
  // from the list.
  const pick = el('div', 'heroPicks');
  for (const f of heroes) {
    const b = el('button', 'heroPick' + (f.key === fig.key ? ' on' : ''));
    b.type = 'button';
    b.title = f.name + ', sprite class ' + f.pt;
    b.appendChild(patchTileCanvas({ image: f.shipped, W: 32, H: f.H }, 0, 141));
    b.appendChild(el('span', '', svEsc(f.name)));
    b.onclick = function () { heroSpritePick(f.key); };
    pick.appendChild(b);
  }
  if (classes.length) {
    const sel = document.createElement('select');
    sel.id = 'heroOther'; sel.className = 'heroSelect';
    sel.setAttribute('aria-label', 'another sprite');
    const none = document.createElement('option');
    none.value = ''; none.textContent = 'another sprite';
    sel.appendChild(none);
    for (const k of classes) {
      const o = document.createElement('option');
      o.value = String(k.pt); o.textContent = k.label;
      if (fig.key === 'pt' + k.pt) o.selected = true;
      sel.appendChild(o);
    }
    sel.onchange = function () { if (sel.value) heroSpritePick('pt' + sel.value); };
    pick.appendChild(sel);
  }
  host.appendChild(pick);

  const swatchRow = (label, lead, cur, list, choose) => {
    const row = el('div', 'heroPart');
    const name = el('span', 'heroPartName');
    if (lead) name.appendChild(lead);
    if (label) name.appendChild(el('span', '', svEsc(label)));
    row.appendChild(name);
    const sw = el('div', 'heroSwatches');
    const asIs = el('button', 'heroSwatch heroShipped' + (!cur ? ' on' : ''), 'as drawn');
    asIs.type = 'button';
    asIs.onclick = function () { choose(null, null); };
    sw.appendChild(asIs);
    for (const [nm, hex] of list) {
      const b = el('button', 'heroSwatch' + (cur && cur.hex === hex ? ' on' : ''));
      b.type = 'button';
      b.title = nm;
      b.setAttribute('aria-label', (label || 'color') + ' ' + nm);
      const chip = el('span', 'heroChip');
      chip.style.background = hex;
      b.appendChild(chip);
      b.onclick = function () { choose(nm, hex); };
      sw.appendChild(b);
    }
    const any = document.createElement('input');
    any.type = 'color'; any.className = 'heroAny'; any.title = 'any color';
    any.value = cur ? cur.hex : '#808080';
    any.onchange = function () { choose(any.value, any.value); };
    sw.appendChild(any);
    row.appendChild(sw);
    return row;
  };

  // The body, for the two who can wear one.
  if (HERO_SPRITES.some(d => d.key === fig.key)) {
    const bodies = heroBodies(fig.pt);
    if (bodies.length) {
      const row = el('div', 'heroPart');
      row.appendChild(el('span', 'heroPartName', 'body'));
      const sel = document.createElement('select');
      sel.id = 'heroBody'; sel.className = 'heroSelect';
      sel.setAttribute('aria-label', 'body');
      const own = document.createElement('option');
      own.value = ''; own.textContent = 'the ' + fig.cls.label + '’s own';
      sel.appendChild(own);
      for (const k of bodies) {
        const o = document.createElement('option');
        o.value = String(k.pt);
        o.textContent = k.label + (k.frames < 16 ? ', ' + k.frames + ' frames' : '');
        if (fig.body && fig.body.pt === k.pt) o.selected = true;
        sel.appendChild(o);
      }
      sel.onchange = function () { heroSpriteBody(sel.value); };
      row.appendChild(sel);
      host.appendChild(row);
    }
  }

  // The parts, where the hand-made table applies.
  if (fig.def) {
    const rows = el('div', 'heroParts');
    for (const p of fig.def.parts)
      rows.appendChild(swatchRow(p.label, null, mine.parts[p.key], heroSwatchesFor(p.key),
        (nm, hex) => heroSpriteChoose(p.key, nm, hex)));
    host.appendChild(rows);
  }

  // Colour by colour, for every figure.
  host.appendChild(el('div', 'partsTitle', 'Color by color'));
  const shadeRows = el('div', 'heroParts');
  fig.shades.parts.forEach((p, pi) => {
    const lead = heroShadeThumb(fig, pi);
    lead.className = 'heroThumb';
    lead.title = p.pixels.toLocaleString() + ' pixels';
    shadeRows.appendChild(swatchRow('', lead, mine.shades[p.key], HERO_SWATCHES.shade,
      (nm, hex) => heroSpriteShade(p.key, nm, hex)));
  });
  host.appendChild(shadeRows);

  // The frames: shipped on the left of each pair, chosen on the right.
  const rec = heroRecoloured(fig);
  const strip = el('div', 'patchStrip');
  {
    host.appendChild(el('div', 'partsTitle', 'The ' + svEsc(fig.name) + '’s ' + fig.frames + ' frames, from sheet ' + propWordHex(fig.sheet)));
    for (let t = 0; t < fig.frames; t++) {
      const pair = el('div', 'patchPair');
      pair.appendChild(patchTileCanvas({ image: fig.shipped, W: 32, H: fig.H }, t, 141));
      pair.appendChild(patchTileCanvas({ image: rec.image, W: 32, H: fig.H }, t, 141));
      pair.appendChild(el('span', 'patchTileNo', String(fig.start + t)));
      strip.appendChild(pair);
    }
  }
  host.appendChild(strip);
  const facts = [];
  if (fig.body) facts.push(fig.body.frames === 16
    ? 'The ' + svEsc(fig.body.label) + '’s frames have the same layout as the ' + svEsc(fig.name) + '’s, so the patch uses them as they are.'
    : 'The ' + svEsc(fig.body.label) + ' has ' + fig.body.frames / 4 + (fig.body.frames === 8 ? ' strides' : ' frame') +
      ' a facing where the ' + svEsc(fig.name) + ' has four poses, so ' +
      (fig.body.frames === 8 ? 'the first walking frame is used for standing and sitting too.' : 'that frame is used for all four.'));
  facts.push(fig.others.length
    ? svEsc(fig.others.map(k => k.label).join(', ')) + ' also ' + (fig.others.length === 1 ? 'draws' : 'draw') + ' from these frames and would change with them.'
    : fig.start || fig.frames < 16
      ? 'Only these ' + fig.frames + ' frames of the sheet change; the rest of it stays as it was.'
      : 'Nothing else in the file draws from this sheet.');
  if (fig.wearers > 1) facts.push('<b>' + fig.wearers + '</b> characters wear this sprite, and all of them change with it.');
  if (fig.unknown) facts.push('<b>' + fig.unknown + '</b> pixels are in colors the original art does not use, so they stay unchanged.');
  facts.push(rec.moved ? '<b>' + rec.moved.toLocaleString() + '</b> pixels change.' : 'Nothing chosen, so the frames stay unchanged.');
  host.appendChild(el('ul', 'ruleList', facts.map(f => '<li>' + f + '</li>').join('')));

  if (!rec.moved) return;
  const desc = document.createElement('input');
  desc.type = 'text'; desc.id = 'heroDesc'; desc.className = 'heroDesc';
  desc.maxLength = 255;
  desc.value = heroDescription(fig);
  desc.setAttribute('aria-label', 'what the patch calls itself');
  host.appendChild(el('div', 'partsTitle', 'What the patch calls itself'));
  host.appendChild(desc);
  const bar = el('div', 'mechStats');
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
  };
  btn('Apply to the open file', heroSpriteApply);
  btn('Read it as a patch', heroSpriteShowPatch);
  btn('Download the patch', function () { heroSpriteDownload(false); });
  btn('Download for a Mac', function () { heroSpriteDownload(true); });
  btn('Start again', heroSpriteReset);
  host.appendChild(bar);
}

/* ---- a gremlin of your own ----
   A gremlin is a script the game runs at three moments and no others: the
   party walking into a room (TGameSys::HeartBeat), a zone being entered, a
   save loading included (TGameViewer::ChangeZone), and a script sending a
   signal (TGameSys::SendSignal, then TGremlin::OnSignal). There are 256 of
   them, 0x1F00 plus the number, and the shipped game has none. A new game
   switches on every one whose script is in the file (ClearGremlins); a save
   keeps the states it was made with, so a gremlin added later is off in it
   until the save sheet switches it on.

   The maker writes one from a form -- when it acts, on what condition, and
   what it does -- as a listing in the page's own words. dvmAssemble turns
   that into the method and dvmWriteClass into a class the engine can look
   the method up in; it leaves the page as a patch, as the sprite does, and
   the merge adds a resource the file lacks. The listing can be edited
   before it is written, for anything the form does not offer.

   Every test and action the form writes was run in the fork before it was
   offered (the workbench's save-format.md, "What a gremlin can react to and
   do, tried"): a zone by object and by type, a quest flag set and clear, a
   signal, a line printed, a flag set, and switching itself off. A method's
   first argument is the gremlin itself and the second is the room, the zone
   or the signal, which is why every test reads Arg01; the first gremlin
   written by hand read Arg00 and could never have seen a room. */
window.GREMLIN_STATE = { num: null, when: 'room', which: '', flag: '', flagIs: 'set',
                         say: 'Something stirs.', setFlag: '', setTo: 'set', once: false, listing: null };

function gremlinNumbersIn(spec) {
  const out = new Set();
  if (spec) for (const r of spec.resources) if (r.resid >= 0x1F00 && r.resid <= 0x1FFF) out.add(r.resid - 0x1F00);
  return out;
}
// The number chosen, or the first the open file does not use.
function gremlinNumber() {
  const st = window.GREMLIN_STATE;
  if (st.num !== null) return st.num;
  const used = gremlinNumbersIn(patchBaseSpec());
  for (let n = 0; n < 256; n++) if (!used.has(n)) return n;
  return 0;
}
function gremlinInt(v, lo, hi, what) {
  const t = String(v).trim();
  if (!/^\d+$/.test(t)) throw new Error(what + ' is not a number');
  const n = parseInt(t, 10);
  if (n < lo || n > hi) throw new Error(what + ' runs from ' + lo + ' to ' + hi);
  return n;
}
/* The listing the form stands for. Each test is an if_not that jumps to the
   end when it fails, so the tests read in the order the form asks them. A
   flag's number is a word: a byte operand is signed, and `byte 250` reached
   the game as -6 and set flag 26 in the fork run of the first maker-built
   gremlin. */
function gremlinListingFromForm(st) {
  const L = ['subroutine 0x0200'];
  const skipUnless = test => L.push('if_not', ...test, 'then -> done');
  const which = String(st.which).trim();
  if (st.when === 'signal') skipUnless(['arg Arg01', 'short ' + gremlinInt(which, 1, 32767, 'The signal'), 'eq']);
  else {
    const type = st.when === 'room' ? 'Room' : 'Zone';
    if (which === '') skipUnless(['arg Arg01', 'is_type ' + type]);
    else skipUnless(['arg Arg01', 'word 0x' + gremlinInt(which, 0, 0xFFFF, 'The ' + st.when).toString(16) + '@Type.' + type, 'eq']);
  }
  if (String(st.flag).trim() !== '') {
    const f = gremlinInt(st.flag, 0, 255, 'The quest flag');
    skipUnless(st.flagIs === 'set' ? ['sys GetStateFlag', 'word ' + f, 'end'] : ['sys GetStateFlag', 'word ' + f, 'end', 'not']);
  }
  const say = String(st.say || '').trim();
  if (say) {
    // A line in a script is printed up to the first byte the interpreter
    // reads as an instruction, which is any byte from 0x80 up.
    if (!/^[\x20-\x7E]+$/.test(say)) throw new Error('The line takes plain letters, digits and punctuation only');
    if (/\s\/\//.test(say)) throw new Error('The line cannot contain " //", which the listing treats as the start of a comment');
    L.push('string(implicit) ' + JSON.stringify(say + '\n'));
  }
  if (String(st.setFlag).trim() !== '')
    L.push('sys SetStateFlag', 'word ' + gremlinInt(st.setFlag, 0, 255, 'The flag to set'), 'byte ' + (st.setTo === 'set' ? 1 : 0), 'end');
  if (st.once) L.push('set_field status_flags', 'arg Arg00', 'end', 'byte 1', 'end');
  L.push('done:', 'return', 'byte 0', 'end');
  return L.join('\n');
}
// Enter (20) for a room or a zone, GetMessage (21) for a signal.
function gremlinMethodKey(st) { return st.when === 'signal' ? 21 : 20; }
function gremlinClass() {
  const st = window.GREMLIN_STATE, n = gremlinNumber();
  const text = st.listing !== null ? st.listing : gremlinListingFromForm(st);
  return Object.assign(dvmWriteClass(0x1F00 + n, [{ key: gremlinMethodKey(st), text }]), { n, text });
}
function gremlinDescription(st, n) {
  const w = String(st.which).trim();
  return 'Gremlin ' + n + ', ' + (st.when === 'signal' ? 'on signal ' + w
    : 'when the party enters ' + (w === '' ? 'any ' + st.when : st.when + ' ' + w));
}
function gremlinPatch() {
  const base = patchBaseSpec();
  if (!base) return null;
  const c = gremlinClass(), resid = 0x1F00 + c.n;
  const spec = Object.assign({}, base, {
    resources: base.resources.filter(r => r.resid !== resid).concat([{ resid, data: c.bytes, encrypted: true }]) });
  const w = writeDelverPatch(spec, [resid], { description: gremlinDescription(window.GREMLIN_STATE, c.n), typeCode: DELV_PATCH_EXPORT_TYPE });
  w.name = safeFileName('Gremlin ' + c.n);
  w.gremlin = c.n;
  return w;
}
function gremlinSay(m, bad) {
  const note = document.getElementById('gremlinNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}
// Apply goes through the patches section, as the sprite's does.
function gremlinApply() {
  let w;
  try { w = gremlinPatch(); } catch (e) { gremlinSay('The page could not write the gremlin: ' + e.message, true); return false; }
  if (!w) { gremlinSay('No game file is open.', true); return false; }
  if (!patchesOpenBytes(w.bytes, w.name)) { gremlinSay('The page refused the patch.', true); return false; }
  const ok = patchesApply();
  if (ok) {
    window.GREMLIN_STATE.num = null;
    renderPatchReport();
    renderGremlinMaker();
    gremlinSay('Gremlin ' + w.gremlin + ' is in the copy of the file in this browser. To download the changed file, go to Data › Cythera Data › Changes.');
  }
  return ok;
}
function gremlinShowPatch() {
  let w;
  try { w = gremlinPatch(); } catch (e) { gremlinSay('The page could not write the gremlin: ' + e.message, true); return false; }
  if (!w) { gremlinSay('No game file is open.', true); return false; }
  const ok = patchesOpenBytes(w.bytes, w.name);
  const host = document.getElementById('patchReport');
  if (ok && host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return ok;
}
function gremlinDownload(asMacBinary) {
  let w;
  try { w = gremlinPatch(); } catch (e) { gremlinSay('The page could not write the gremlin: ' + e.message, true); return null; }
  if (!w) { gremlinSay('No game file is open.', true); return null; }
  if (asMacBinary) {
    const bin = writeMacBinary({ name: w.name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    dlBlob(new Blob([bin], { type: 'application/macbinary' }), w.name + '.bin');
  } else downloadBlob(w.bytes, w.name);
  gremlinSay(w.bytes.length.toLocaleString() + ' bytes, one resource, identity ' + w.uuidText + '.');
  return w;
}
// One field of the form, set from a control; the listing follows the form again.
function gremlinSet(key, value) {
  const st = window.GREMLIN_STATE;
  st[key] = value;
  st.listing = null;
  renderGremlinMaker();
}
function renderGremlinMaker() {
  const host = document.getElementById('gremlinMaker');
  if (!host) return;
  host.innerHTML = '';
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  const st = window.GREMLIN_STATE, base = patchBaseSpec();
  if (!base) { host.appendChild(el('p', 'mechSub', 'No game file is open.')); return; }
  if (base.playerName) {
    host.appendChild(el('p', 'mechSub', 'This is a saved game. Add a gremlin to Cythera Data, then switch it on from this save’s page.'));
    return;
  }
  const used = gremlinNumbersIn(base), n = gremlinNumber();
  const form = el('div', 'gremlinForm');
  const label = t => form.appendChild(el('span', '', t));
  const cell = (...kids) => { const d = el('div', ''); for (const k of kids) d.appendChild(k); form.appendChild(d); return d; };
  const text = (id, value, cls, placeholder, key) => {
    const i = document.createElement('input');
    i.type = 'text'; i.id = id; i.value = value; if (cls) i.className = cls; if (placeholder) i.placeholder = placeholder;
    i.onchange = function () { gremlinSet(key, i.value); };
    return i;
  };
  const choice = (id, options, value, key) => {
    const s = document.createElement('select');
    s.id = id;
    for (const [v, t] of options) { const o = document.createElement('option'); o.value = v; o.textContent = t; if (v === value) o.selected = true; s.appendChild(o); }
    s.onchange = function () { gremlinSet(key, s.value); };
    return s;
  };
  const num = document.createElement('input');
  num.type = 'text'; num.id = 'gremlinNum'; num.value = String(n);
  num.onchange = function () {
    const t = num.value.trim();
    gremlinSet('num', /^\d+$/.test(t) && +t <= 255 ? +t : null);
  };
  label('Gremlin');
  cell(num, el('span', 'mechSub', used.has(n) ? ' replaces this file’s gremlin with that number' : ' not used in this file'));
  label('When');
  const which = String(st.which).trim();
  let whichName = '';
  if (which !== '' && /^\d+$/.test(which)) {
    if (st.when === 'zone') whichName = zoneDisplayName(+which);
    else if (st.when === 'room') {
      const e = buildScriptTextIndex().find(x => x.resid === 0x1B00 + +which);
      const m = e && /"((?:[^"\\]|\\.)*)"/.exec(e.text);
      whichName = m ? m[1].replace(/\\n/g, ' ').slice(0, 60) : 'no room script of that number';
    }
  }
  cell(choice('gremlinWhen', [['room', 'the party enters a room (untested)'], ['zone', 'a zone is entered, or a save loads'], ['signal', 'a script sends a signal (untested)']], st.when, 'when'),
       text('gremlinWhich', st.which, 'gremlinNum', st.when === 'signal' ? 'number' : 'any', 'which'),
       el('span', 'mechSub', ' ' + (whichName ? svEsc(whichName)
         : st.when === 'room' ? 'the number on the room’s egg, or empty for any room'
         : st.when === 'zone' ? 'the zone’s map number, or empty for any zone'
         : 'use 256 or more, since lower numbers also reach the game’s bells and music locks')));
  label('Only if quest flag');
  cell(text('gremlinFlag', st.flag, 'gremlinNum', 'none', 'flag'),
       choice('gremlinFlagIs', [['set', 'is set'], ['clear', 'is clear']], st.flagIs, 'flagIs'));
  label('Print');
  cell(text('gremlinSayText', st.say, 'gremlinSay', 'nothing', 'say'));
  label('Quest flag');
  cell(text('gremlinSetFlag', st.setFlag, 'gremlinNum', 'none', 'setFlag'),
       choice('gremlinSetTo', [['set', 'set'], ['clear', 'clear']], st.setTo, 'setTo'));
  label('Then');
  const once = document.createElement('input');
  once.type = 'checkbox'; once.id = 'gremlinOnce'; once.checked = !!st.once;
  once.onchange = function () { gremlinSet('once', once.checked); };
  const onceLabel = el('label', 'mechSub');
  onceLabel.appendChild(once);
  onceLabel.appendChild(el('span', '', ' switch itself off, so it acts once'));
  cell(onceLabel);
  host.appendChild(form);

  // The listing: the form's, or the visitor's own once it is edited.
  let formText = null, formError = null;
  try { formText = gremlinListingFromForm(st); } catch (e) { formError = e.message; }
  host.appendChild(el('div', 'partsTitle', 'The script it writes'));
  const area = document.createElement('textarea');
  area.id = 'gremlinListing'; area.className = 'gremlinListing'; area.spellcheck = false;
  area.value = st.listing !== null ? st.listing : (formText || '');
  area.oninput = function () { st.listing = area.value; gremlinCheck(); };
  host.appendChild(area);
  const status = el('div', 'mechSub'); status.id = 'gremlinCheck';
  host.appendChild(status);
  if (st.listing !== null) {
    const back = el('div', 'mechSub', 'Your own listing is used. ' + svLink('Back to the form', 'gremlinSet(\'listing\', null)'));
    host.appendChild(back);
  }
  const bar = el('div', 'mechStats');
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
  };
  btn('Apply to the open file', gremlinApply);
  btn('Read it as a patch', gremlinShowPatch);
  btn('Download the patch', function () { gremlinDownload(false); });
  btn('Download for a Mac', function () { gremlinDownload(true); });
  host.appendChild(bar);
  host.appendChild(el('p', 'mechSub', 'A new game switches every gremlin on. In a save made before the patch, switch it on in the save’s page.'));
  gremlinCheck(formError);
}
// Whether the listing assembles, said under it as it is typed.
function gremlinCheck(formError) {
  const out = document.getElementById('gremlinCheck');
  if (!out) return;
  const st = window.GREMLIN_STATE;
  if (st.listing === null && formError) { out.textContent = formError + '.'; out.className = 'mechSub patchBad'; return; }
  try {
    const c = gremlinClass();
    out.textContent = c.bytes.length + ' bytes, ' + (DVM_SYM.method[gremlinMethodKey(st)] || 'method') + ' at ' + c.methods[0].at +
      ' and a table of ' + c.size + ' slots, as resource ' + propWordHex(0x1F00 + c.n) + '.';
    out.className = 'mechSub';
  } catch (e) { out.textContent = e.message + '.'; out.className = 'mechSub patchBad'; }
}

/* ---- the program's own fixes ----
   js/delv-appfixes.js says what each changes and js/delv-apppatch.js writes
   them; this is the section that chooses them and hands out the program.
   The program is the installer's (APP_DATA and APP_RSRC_RAW, both forks) or
   a copy the visitor chooses, which has to be in a container that carries
   both forks, since the fixes change the data fork and the cfrg in the
   resource fork together. A fix starts chosen once it has been played. */
// A design change (kind 'change') starts unchosen, as the karma patch is kept
// out of All Fixes: it is not a bug, and a visitor picks it on purpose. So
// does a fix nobody has seen working in the game (no `played`), at the
// maintainer's word of 2 October 2026, before the site was first posted:
// walk-to read right, assembled clean and hung the game the first time it
// was played, and a visitor who keeps the defaults should get only fixes a
// run has shown.
window.APPFIX_STATE = { off: new Set(APP_FIXES.filter(f => f.kind === 'change' || !f.played).map(f => f.id)), src: null };
function appFixSource() {
  const st = window.APPFIX_STATE;
  if (st.src) return st.src;
  if (window.APP_DATA && window.APP_RSRC_RAW) return { data: window.APP_DATA, rsrc: window.APP_RSRC_RAW, name: 'the installer', type: 'APPL', creator: 'Delv' };
  return null;
}
// A fix nobody has seen working in the game says so after its title. The
// maintainer's word of 30 September 2026, after walk-to, which read right
// and assembled clean, hung the game the first time it was played. The
// mark goes when a fix's entry gains `played` (js/delv-appfixes.js,
// js/delv-datafixes.js), written when a run has shown it.
function untestedMark(f) { return f.played ? '' : ' (untested)'; }
/* A fix built from someone else's published work carries their name
   (`by`): Fetch and fishing, from Bryce Schroeder's patched sources. The
   other four of his patch were written here from the causes, his sources
   for them never published (the maintainer, 3 October 2026). */
function dataFixMark(f) {
  if (!f.by) return untestedMark(f);
  return ' (' + f.by + '\u2019s fix' + (f.played ? '' : ', untested') + ')';
}
function appFixChosen() { return APP_FIXES.filter(f => !window.APPFIX_STATE.off.has(f.id)); }
function appFixSay(m, bad) {
  const note = document.getElementById('appFixNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}
function appFixToggle(id, on) {
  const off = window.APPFIX_STATE.off;
  if (on) off.delete(id); else off.add(id);
  renderAppFixMaker();
}
function appFixOpenFile(file) {
  if (!file) return;
  file.arrayBuffer().then(buf => {
    const c = sniffMacContainer(new Uint8Array(buf));
    if (!c || !c.data || !c.data.length || !c.rsrc || !c.rsrc.length) {
      appFixSay('That file does not contain both of the program\u2019s forks. Choose a copy in MacBinary or BinHex.', true);
      return;
    }
    window.APPFIX_STATE.src = { data: c.data, rsrc: c.rsrc, name: file.name, type: c.type || 'APPL', creator: c.creator || 'Delv' };
    renderAppFixMaker();
    if (document.getElementById('spanishMaker')) renderSpanishMaker();
    appFixSay('');
  }).catch(e => appFixSay('That file could not be read: ' + e.message, true));
}
// The program with the chosen fixes, or null with the reason said.
function appFixBuild() {
  const src = appFixSource();
  if (!src) { appFixSay('No program is open.', true); return null; }
  const chosen = appFixChosen();
  if (!chosen.length) { appFixSay('Nothing is chosen, so there is nothing to write.', true); return null; }
  try { return Object.assign(applyAppFixes(src, chosen), { src, chosen }); }
  catch (e) { appFixSay(e.message, true); return null; }
}
function appFixDownload(asDisk) {
  const r = appFixBuild();
  if (!r) return null;
  const name = 'Cythera';
  if (asDisk) {
    const image = writeHfsImage({ volumeName: 'Cythera Fixed', entries: [{ name, type: r.src.type, creator: r.src.creator, data: r.data, rsrc: r.rsrc }] });
    dlBlob(new Blob([image], { type: 'application/octet-stream' }), 'Cythera Fixed.dsk');
  } else {
    const bin = writeMacBinary({ name, type: r.src.type, creator: r.src.creator, data: r.data, rsrc: r.rsrc });
    dlBlob(new Blob([bin], { type: 'application/macbinary' }), 'Cythera (fixed).bin');
  }
  appFixSay(r.chosen.length + ' fixes written; the code is ' + r.grownBy + ' bytes longer.');
  return r;
}
// The words a fix writes, as the decoder reads them back.
function appFixListing(a) {
  return a.words.map(w => (w.at.toString(16).toUpperCase().padStart(5, '0')) + '  ' +
    (w.was === null ? '        ' : w.was.toString(16).toUpperCase().padStart(8, '0')) + '  ' +
    w.now.toString(16).toUpperCase().padStart(8, '0') + '  ' + (ppcTextAt(w.now, w.at) || '')).join('\n');
}
function renderAppFixMaker() {
  const host = document.getElementById('appFixMaker');
  if (!host) return;
  host.innerHTML = '';
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  const src = appFixSource(), st = window.APPFIX_STATE;
  host.appendChild(el('p', 'mechSub', src ? 'The program from ' + src.name + '.' : 'No program is open. Choose one, or open the installer.'));
  // A trial run, so each fix can show what it writes and a refusal shows before a download.
  let trial = null, why = '';
  if (src) { try { trial = applyAppFixes(src, APP_FIXES); } catch (e) { why = e.message; } }
  if (why) host.appendChild(el('p', 'mechSub patchBad', why));
  const kinds = [['fix', 'Bugs'], ['hook', 'Hooks'], ['text', 'Text'], ['menu', 'Menus'], ['change', 'Design changes']];
  const kindNotes = { change: 'These are not bug fixes; each changes how the game was designed to behave. None is chosen until you choose it.' };
  for (const [kind, heading] of kinds) {
    const list = APP_FIXES.filter(f => f.kind === kind);
    if (!list.length) continue;
    host.appendChild(el('div', 'partsTitle', heading));
    if (kindNotes[kind]) host.appendChild(el('p', 'mechSub', kindNotes[kind]));
    for (const f of list) {
      const row = el('div', 'appFixRow');
      const label = el('label', 'mechSub');
      const box = document.createElement('input');
      box.type = 'checkbox'; box.checked = !st.off.has(f.id);
      box.onchange = function () { appFixToggle(f.id, box.checked); };
      label.appendChild(box);
      label.appendChild(el('span', '', ' ' + f.title + untestedMark(f)));
      row.appendChild(label);
      const a = trial && trial.applied.find(x => x.id === f.id);
      if (a && a.words.length) {
        const d = el('details', 'appFixWords');
        d.appendChild(el('summary', 'mechSub', a.words.length + (a.words.length === 1 ? ' word' : ' words')));
        d.appendChild(el('pre', 'appFixListing', appFixListing(a)));
        row.appendChild(d);
      }
      host.appendChild(row);
    }
  }
  const bar = el('div', 'mechStats');
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
  };
  btn('Download for a Mac', function () { appFixDownload(false); });
  btn('Download as a disk image', function () { appFixDownload(true); });
  const inp = document.createElement('input');
  inp.type = 'file'; inp.id = 'appFixFile'; inp.accept = '*/*';
  inp.onchange = function () { appFixOpenFile(inp.files && inp.files[0]); };
  bar.appendChild(inp);
  host.appendChild(bar);
}

/* ---- Cythera Data in Spanish ----
   js/delv-translate.js writes a translation into both forks and
   js/delv-es.js is the Spanish, keyed by a hash of each English piece, so
   the English is read from the visitor's own file and none of it is in this
   repository. The table is half a megabyte and most visitors never want it,
   so it is not among the page's scripts: the first button that needs it
   adds it as a classic script, which a page opened from a USB stick can
   still load, and later ones find it there. A harness that has already run
   the table in the page's scope is taken at its word.

   The result is a whole file rather than a patch, since the conversation
   face with its new letters, the message pane's face and the buttons'
   labels are in the resource fork, which no patch reaches. It is built
   from the open file and its fork: a piece the file has changed has no
   entry and stays in English, and the note says how many. A copy without
   its resource fork is refused, since the accents would draw as boxes. */
// The Spanish table and the Geneva its strikes are made from, each added as
// a script element (a page opened from a USB stick can load those), the
// font first since the table's builder reads it.
function spanishScript(src, ready) {
  return new Promise((resolve, reject) => {
    if (ready()) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => ready() ? resolve() : reject(new Error(src + ' did not load'));
    s.onerror = () => reject(new Error(src + ' could not be fetched'));
    document.head.appendChild(s);
  });
}
function spanishTable() {
  if (window.DELV_TRANSLATION_ES && typeof GENEVA9_TTF !== 'undefined') return Promise.resolve(window.DELV_TRANSLATION_ES);
  if (!window.SPANISH_LOADING) window.SPANISH_LOADING = spanishScript('js/mac-geneva.js', () => typeof GENEVA9_TTF !== 'undefined')
    .then(() => spanishScript('js/delv-es.js', () => !!window.DELV_TRANSLATION_ES))
    .then(() => window.DELV_TRANSLATION_ES)
    .catch(e => { window.SPANISH_LOADING = null; throw new Error('The Spanish could not be loaded: ' + e.message); });
  return window.SPANISH_LOADING;
}
function spanishSay(m, bad) {
  const note = document.getElementById('spanishNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}
// The file in Spanish, or null with the reason said.
function spanishBuild(T, articles) {
  if (!ARCHIVE) { spanishSay('No game file is open.', true); return null; }
  const rsrc = window.CYTHERA_RSRC_RAW;
  if (!rsrc || !rsrc.length) { spanishSay('This copy is missing the font the accents need. Open the game in MacBinary or BinHex, or open the installer.', true); return null; }
  try { return translateCytheraData(ARCHIVE.bytes, rsrc, T, { articles: !!articles }); }
  catch (e) { spanishSay(e.message, true); return null; }
}
// The data file in Spanish as a file of the disk: the open file's Finder
// name and type, since the game looks for its data by name.
function spanishDataFile(r) {
  const f = window.ARCHIVE_FINDER || { name: DISK_ARCHIVE_NAME, type: 'DelS', creator: 'Delv' };
  const name = (f.name || DISK_ARCHIVE_NAME).replace(/\.(hqx|data|bin|dsk)$/i, '') || DISK_ARCHIVE_NAME;
  return { name, type: f.type || 'DelS', creator: f.creator || 'Delv', data: r.data, rsrc: r.rsrc };
}
function spanishDownload(asDisk) {
  spanishSay('Writing the file in Spanish.');
  return spanishTable().then(T => {
    const r = spanishBuild(T);
    if (!r) return null;
    const file = spanishDataFile(r);
    if (asDisk) dlBlob(new Blob([writeHfsImage({ volumeName: 'Cythera ES', entries: [file] })], { type: 'application/octet-stream' }), 'Cythera Data (es).dsk');
    else dlBlob(new Blob([writeMacBinary(file)], { type: 'application/macbinary' }), 'Cythera Data (es).bin');
    const left = r.report.missing.length;
    spanishSay(r.report.done + ' pieces of text in Spanish' + (left ? '; ' + left + ' that this file has changed are left in English.' : '.'), left > 0);
    return r;
  }).catch(e => { spanishSay(e.message, true); return null; });
}
/* The program in Spanish (translateProgram): its menus, dialogs and
   strings, from the program the fixes section has (the installer's, or one
   chosen there or here). It is the PowerPC program that changes; a 68K Mac
   keeps its English strings. `both` writes one disk image with the program
   and the data file, the way a Mac or Infinite Mac takes them. */
function spanishProgramDownload(both) {
  spanishSay('Writing the program in Spanish.');
  return spanishTable().then(T => {
    const src = appFixSource();
    if (!src) { spanishSay('No program is open. Open the installer, or choose the program in MacBinary or BinHex.', true); return null; }
    let p;
    try { p = translateProgram(src.data, src.rsrc, T); } catch (e) { spanishSay(e.message, true); return null; }
    const prog = { name: 'Cythera', type: src.type || 'APPL', creator: src.creator || 'Delv', data: p.data, rsrc: p.rsrc };
    if (both) {
      const r = spanishBuild(T, true);
      if (!r) return null;
      dlBlob(new Blob([writeHfsImage({ volumeName: 'Cythera ES', entries: [prog, spanishDataFile(r)] })], { type: 'application/octet-stream' }), 'Cythera (es).dsk');
    } else dlBlob(new Blob([writeMacBinary(prog)], { type: 'application/macbinary' }), 'Cythera (es).bin');
    const left = p.report.missing.length;
    spanishSay(p.report.done + ' pieces of the program in Spanish' + (left ? '; ' + left + ' that this program has changed are left in English.' : '.'), left > 0);
    return p;
  }).catch(e => { spanishSay(e.message, true); return null; });
}
/* Behind the Scenes (DATA_RSRC_FIXES): a fix a line, each ticked to start,
   and the corrected file for a Mac or as a disk image, written as the
   Spanish copy is. The ticks are kept for the session. */
window.BACKSTAGE_CHOSEN = window.BACKSTAGE_CHOSEN || new Set(DATA_RSRC_FIXES.map(f => f.id));
function backstageSay(m, bad) {
  const note = document.getElementById('backstageNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}
function backstageDownload(asDisk) {
  if (!ARCHIVE) { backstageSay('No game file is open.', true); return null; }
  const ids = [...window.BACKSTAGE_CHOSEN];
  if (!ids.length) { backstageSay('Choose a fix first.', true); return null; }
  let r;
  try { r = applyDataRsrcFixes(window.CYTHERA_RSRC_RAW, ids); } catch (e) { backstageSay(e.message, true); return null; }
  const file = spanishDataFile({ data: ARCHIVE.bytes, rsrc: r.rsrc });
  if (asDisk) dlBlob(new Blob([writeHfsImage({ volumeName: 'Cythera', entries: [file] })], { type: 'application/octet-stream' }), 'Cythera Data (fixed).dsk');
  else dlBlob(new Blob([writeMacBinary(file)], { type: 'application/macbinary' }), 'Cythera Data (fixed).bin');
  backstageSay(r.log.length + ' change' + (r.log.length === 1 ? '' : 's') + ' written.');
  return r;
}
function renderBackstageMaker() {
  const host = document.getElementById('backstageMaker');
  if (!host) return;
  host.innerHTML = '';
  for (const fix of DATA_RSRC_FIXES) {
    const row = document.createElement('label');
    row.className = 'mechSub';
    row.style.cssText = 'display:block;margin:6px 0';
    const box = document.createElement('input');
    box.type = 'checkbox'; box.checked = window.BACKSTAGE_CHOSEN.has(fix.id);
    box.onchange = () => { if (box.checked) window.BACKSTAGE_CHOSEN.add(fix.id); else window.BACKSTAGE_CHOSEN.delete(fix.id); };
    row.appendChild(box);
    const t = document.createElement('span');
    t.innerHTML = ' <b>' + svEsc(fix.title) + '</b>. ' + svEsc(fix.note) + ' ' +
      fix.rsrc.map(e => '“' + svEsc(e.was) + '” to “' + svEsc(e.now) + '”').join(', ') + '.';
    row.appendChild(t);
    host.appendChild(row);
  }
  const ok = ARCHIVE && window.CYTHERA_RSRC_RAW && window.CYTHERA_RSRC_RAW.length;
  if (!ok) { const p = document.createElement('p'); p.className = 'mechSub'; p.textContent = !ARCHIVE ? 'No game file is open.' : 'This copy has no resource fork. Open the game in MacBinary or BinHex, or open the installer.'; host.appendChild(p); return; }
  const d = document.createElement('div');
  d.className = 'mechStats';
  for (const [label, fn] of [['Download for a Mac', () => backstageDownload(false)], ['Download as a disk image', () => backstageDownload(true)]]) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label; b.onclick = fn;
    d.appendChild(b);
  }
  host.appendChild(d);
}
function renderSpanishMaker() {
  const host = document.getElementById('spanishMaker');
  if (!host) return;
  host.innerHTML = '';
  const line = (text) => { const p = document.createElement('p'); p.className = 'mechSub'; p.textContent = text; host.appendChild(p); };
  const bar = (buttons) => {
    const d = document.createElement('div');
    d.className = 'mechStats';
    for (const [label, fn] of buttons) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
      b.textContent = label;
      b.onclick = fn;
      d.appendChild(b);
    }
    host.appendChild(d);
    return d;
  };
  line(!ARCHIVE ? 'No game file is open.'
    : (window.CYTHERA_RSRC_RAW && window.CYTHERA_RSRC_RAW.length) ? 'Written from ' + (window.ARCHIVE_SOURCE_NAME || 'the open file') + ', both forks.'
    : 'This copy has no resource fork. Open the game in MacBinary or BinHex, or open the installer.');
  bar([['Download for a Mac', function () { spanishDownload(false); }], ['Download as a disk image', function () { spanishDownload(true); }]]);
  const src = appFixSource();
  line(src ? 'The program, written from ' + src.name + '. Its menus, dialogs and messages in Spanish, on a PowerPC Mac (untested).'
           : 'The program: open the installer, or choose the program in MacBinary or BinHex.');
  const d = bar([['Download the program for a Mac', function () { spanishProgramDownload(false); }], ['Download both as a disk image', function () { spanishProgramDownload(true); }]]);
  const inp = document.createElement('input');
  inp.type = 'file'; inp.id = 'spanishAppFile'; inp.accept = '*/*';
  inp.onchange = function () { appFixOpenFile(inp.files && inp.files[0]); };
  d.appendChild(inp);
}

/* ---- the scenario's fixes, as a patch ----
   js/delv-datafixes.js says what each changes and js/delv-datapatch.js
   applies them; this is the section that chooses them and hands out the
   patch (28 September 2026). What starts chosen is what has been played
   (DATAFIX_STATE, below). A list's own box chooses every fix in it,
   the text's options are chosen one by one under it and count only with
   it, and the spelling is one of three.

   The patch is built from the open file, on a button, since building every
   fix is a few hundred edits and a second or two on a phone; nothing is
   built as boxes are ticked. A file that is not the shipped scenario, or one
   that carries a fix already, is refused by the first edit that does not
   find what it expects, and the note names the fix. Apply and Read go
   through the patches section, as the sprite's and the gremlin's do. */
// A fix seen working in the game (its `played`) starts ticked and one not
// yet seen starts unticked, the maintainer's rule of 3 October 2026. The
// text's choices start on their first option, his preference, played or
// not, so that a patch of other fixes carries them (his word of 4 October
// 2026; from 3 October they started on "Don't standardize", and before
// that on the first option with every other fix unticked). An option
// counts without the text's own corrections (js/delv-datapatch.js). The
// design changes are not fixes and start unticked whether played or not.
window.DATAFIX_STATE = { on: new Set(DATA_FIXES.filter(f => f.played && !f.choice && f.group !== 'design').map(f => f.id)
  .concat(DATA_FIX_CHOICES.map(c => (DATA_FIXES.find(f => f.choice === c.id) || {}).id).filter(Boolean))), skip: new Set(), showText: false, textChanges: null };
function dataFixSay(m, bad) {
  const note = document.getElementById('dataFixNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}
function dataFixToggle(id, on) {
  const st = window.DATAFIX_STATE.on;
  if (on) st.add(id); else st.delete(id);
  renderDataFixMaker();
}
// A list's box: every fix in it and, for the text, every change and each
// choice's first option; unticked, none of them.
function dataFixGroup(group, on) {
  const st = window.DATAFIX_STATE;
  for (const f of DATA_FIXES) if (f.group === group && !f.choice) { if (on) st.on.add(f.id); else st.on.delete(f.id); }
  for (const c of DATA_FIX_CHOICES) {
    const opts = DATA_FIXES.filter(o => o.choice === c.id && o.group === group);
    if (!opts.length) continue;
    for (const o of opts) st.on.delete(o.id);
    if (on) st.on.add(opts[0].id);
  }
  st.skip.clear();
  renderDataFixMaker();
}
// How much of a list is chosen: a fix counts, a choice counts when one of
// its options is picked, and the text counts half with a change left out.
function dataFixGroupState(group) {
  const st = window.DATAFIX_STATE, items = [];
  for (const f of DATA_FIXES) if (f.group === group && !f.parent)
    items.push(!st.on.has(f.id) ? 0 : DATA_FIXES.some(o => o.parent === f.id) && st.skip.size ? 0.5 : 1);
  for (const c of DATA_FIX_CHOICES) if (DATA_FIXES.some(o => o.choice === c.id && o.group === group))
    items.push(DATA_FIXES.some(o => o.choice === c.id && st.on.has(o.id)) ? 1 : 0);
  const sum = items.reduce((a, b) => a + b, 0);
  return { all: items.length > 0 && sum === items.length, some: sum > 0 };
}
// One of a choice's options, or (null) none of them.
function dataFixChoose(choice, id) {
  const st = window.DATAFIX_STATE.on;
  for (const f of DATA_FIXES) if (f.choice === choice) st.delete(f.id);
  if (id) st.add(id);
  renderDataFixMaker();
}
function dataFixSpelling(id) { dataFixChoose('spelling', id); }
/* The rows of the text's changes. A row of the corrections themselves
   (the text's own part, or the community's list) is in the patch when the
   text is chosen and the row is not left out; a row of a choice's option,
   when it is not left out, since the option is chosen or the row would not
   be listed. Ticking a correction with the text unchosen chooses the text
   with every other correction left out. */
function dataFixRowBase(row) { return row.part === 'text' || row.part === 'community'; }
function dataFixRowOn(row) {
  const st = window.DATAFIX_STATE;
  return (!dataFixRowBase(row) || st.on.has('text')) && !st.skip.has(row.key);
}
function dataFixRowToggle(row, tick) {
  const st = window.DATAFIX_STATE, had = st.on.has('text');
  if (tick) {
    if (dataFixRowBase(row) && !had) {
      st.on.add('text');
      for (const x of dataFixTextRows().rows || []) if (dataFixRowBase(x)) st.skip.add(x.key);
    }
    st.skip.delete(row.key);
  } else st.skip.add(row.key);
  // Drawn again only when the text itself came in, which changes the count
  // and the buttons; otherwise the boxes that count the rows are set, and
  // the list stays where it is scrolled.
  if (st.on.has('text') !== had) { renderDataFixMaker(); return; }
  const all = document.querySelector('.dataFixAll');
  if (all) dataFixAllRowsState(all);
  for (const b of document.querySelectorAll('.dataFixGroupBox')) {
    const gs = dataFixGroupState(b.getAttribute('data-group'));
    b.checked = gs.all; b.indeterminate = gs.some && !gs.all;
  }
  const desc = document.getElementById('dataFixDesc');
  if (desc) desc.value = dataFixDescription(dataFixChosen());
}
// The list's own box: ticked when every row listed is in, part when some.
function dataFixAllRowsState(b) {
  const st = window.DATAFIX_STATE;
  const r = st.textChanges && st.textChanges.key === dataFixTextIds().join(',') && st.textChanges.arc === ARCHIVE ? st.textChanges : null;
  let all, some;
  if (r && r.rows) { const k = r.rows.filter(dataFixRowOn).length; all = k === r.rows.length; some = k > 0; }
  else { all = st.on.has('text') && !st.skip.size; some = st.on.has('text') || dataFixTextIds().length > 0; }
  b.checked = all; b.indeterminate = some && !all;
}
// Ticked: the text and every change listed. Unticked: none of the text,
// its choices set to "don't".
function dataFixAllRows(on) {
  const st = window.DATAFIX_STATE;
  if (on) st.on.add('text');
  else for (const f of DATA_FIXES) if (f.id === 'text' || f.parent === 'text') st.on.delete(f.id);
  st.skip.clear();
  renderDataFixMaker();
}
function dataFixClear() {
  window.DATAFIX_STATE.on = new Set();
  window.DATAFIX_STATE.skip = new Set();
  renderDataFixMaker();
  dataFixSay('');
}
// The fixes in effect: an option only with its fix.
function dataFixChosen() { return DATA_FIXES.filter(f => dataFixesChosen([...window.DATAFIX_STATE.on]).has(f.id)); }

// What the patch calls itself, which is what Magpie lists it by: how many
// from each list, and the text with its options. 255 characters at most.
function dataFixDescription(chosen) {
  const n = g => chosen.filter(f => f.group === g && !f.parent).length;
  const bits = [];
  const count = (g, what) => { const k = n(g); if (k) bits.push(k + ' ' + what); };
  count('talk', 'to conversations');
  count('quests', 'to quests');
  count('rules', 'to spells, skills and fighting');
  count('items', 'to items');
  count('world', 'to people and places');
  { const k = n('design'); if (k) bits.push(k + (k === 1 ? ' design change' : ' design changes')); }
  if (chosen.some(f => f.group === 'text')) {
    const opts = [];
    if (chosen.some(f => f.id === 'spelling-us')) opts.push('American spelling');
    if (chosen.some(f => f.id === 'spelling-uk')) opts.push('British spelling');
    const named = { 'text-two-taled': 'Two-Taled', 'text-two-tailed': 'Two-Tailed', 'text-land-king': 'Land King', 'text-landking': 'LandKing',
                    'text-areithous': 'Areithous', 'text-ariethous': 'Ariethous', 'text-hyphens': 'hyphens', 'text-no-hyphens': 'no hyphens' };
    for (const f of chosen) if (named[f.id]) opts.push(named[f.id]);
    const left = window.DATAFIX_STATE.skip.size;
    if (left) opts.push(left + ' left out');
    bits.push('the text' + (opts.length ? ' (' + opts.join(', ') + ')' : ''));
  }
  const last = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits.join('');
  let d = 'Fixes to Cythera chosen with Grimoire: ' + last + '.';
  if (d.length > 255) d = d.slice(0, 254).replace(/\s+\S*$/, '') + '…';
  return d;
}

/* The patch, built from the open file with the fixes chosen; null when none
   are, and an error naming the fix when one does not apply. */
function dataFixPatch() {
  if (!ARCHIVE || !ARCHIVE.bytes) throw new Error('No game file is open.');
  const chosen = dataFixChosen();
  if (!chosen.length) return null;
  const done = applyDataFixes(ARCHIVE.bytes, chosen.map(f => f.id), { skip: window.DATAFIX_STATE.skip });
  const d = document.getElementById('dataFixDesc');
  const w = writeDelverPatch(done.spec, done.changed,
    { description: ((d && d.value) || dataFixDescription(chosen)).slice(0, 255), typeCode: DELV_PATCH_EXPORT_TYPE });
  w.name = 'Cythera Fixes';
  w.fixes = chosen.length;
  return w;
}
// The patch or null, with the reason said.
function dataFixBuild(what) {
  let w;
  try { w = dataFixPatch(); }
  catch (e) {
    const base = patchBaseSpec();
    const patched = base && delverInstalledPatchIds(base).length;
    dataFixSay('The patch could not be written. ' + e.message + (patched ? ' This file already has patches applied, which may have made this change.' : ''), true);
    return null;
  }
  if (!w) dataFixSay('Nothing is chosen, so there is nothing to ' + what + '.', true);
  return w;
}
function dataFixApply() {
  const w = dataFixBuild('apply');
  if (!w) return false;
  if (!patchesOpenBytes(w.bytes, w.name)) { dataFixSay('The patch was not accepted.', true); return false; }
  const ok = patchesApply();
  if (ok) { renderPatchReport(); dataFixSay('Applied to the copy of the file in this browser. To download the changed file, go to Data › Cythera Data › Changes.'); }
  return ok;
}
function dataFixShowPatch() {
  const w = dataFixBuild('read');
  if (!w) return false;
  const ok = patchesOpenBytes(w.bytes, w.name);
  const host = document.getElementById('patchReport');
  if (ok && host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return ok;
}
function dataFixDownload(asMacBinary) {
  const w = dataFixBuild('write');
  if (!w) return null;
  if (asMacBinary) {
    const bin = writeMacBinary({ name: w.name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    dlBlob(new Blob([bin], { type: 'application/macbinary' }), w.name + '.bin');
  } else downloadBlob(w.bytes, w.name);
  dataFixSay(w.fixes + (w.fixes === 1 ? ' fix, ' : ' fixes, ') + w.resids.length + ' resources, ' + w.bytes.length.toLocaleString() + ' bytes, identity ' + w.uuidText +
    (w.checkValueValid ? ', and the check value verifies.' : ', and the check value does not verify.'), !w.checkValueValid);
  return w;
}

/* Every change the text makes, under its options, at the maintainer's word
   (28 September 2026): the text is chosen as one fix, and this is how to
   read what that one fix is. Worked out by applying the text to the open
   file with the options chosen (dataFixTextChanges), which is a second or
   so, so only once the list is opened, and again when an option changes
   while it is open; the rows are kept for the file and the options they
   were made for. The text's own box need not be ticked to read it. */
function dataFixTextIds() {
  return [...window.DATAFIX_STATE.on].filter(id => { const f = DATA_FIXES.find(x => x.id === id); return f && f.parent === 'text'; }).sort();
}
function dataFixTextRows() {
  const st = window.DATAFIX_STATE, ids = dataFixTextIds(), key = ids.join(',');
  if (!ARCHIVE || !ARCHIVE.bytes) return { why: 'No game file is open.' };
  if (st.textChanges && st.textChanges.key === key && st.textChanges.arc === ARCHIVE) return st.textChanges;
  let got;
  try { got = { rows: dataFixTextChanges(ARCHIVE.bytes, ids) }; }
  catch (e) { got = { why: 'The text could not be applied to this file. ' + e.message }; }
  st.textChanges = Object.assign(got, { key, arc: ARCHIVE });
  return st.textChanges;
}
function dataFixFillChanges(body) {
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  const r = dataFixTextRows();
  body.innerHTML = '';
  if (r.why) { body.appendChild(el('p', 'mechSub patchBad', r.why)); return; }
  const place = id => {
    let name = '';
    try { name = labelFor(id) || ''; } catch (e) { quiet(e, 'a name for a resource the text changes'); }
    return name || propWordHex(id);
  };
  // What the game's bytes say, shown so a tab and a word taken out are seen.
  const shown = t => t === '' ? 'nothing' : t.replace(/\t/g, ' (tab) ').replace(/\n/g, ' ');
  const heading = part => part === 'text' ? 'Misspellings and typos' : part === 'community' ? 'The community\u2019s list'
    : (DATA_FIXES.find(f => f.id === part) || { title: part }).title;
  const parts = [];
  for (const row of r.rows) if (parts.indexOf(row.part) < 0) parts.push(row.part);
  body.appendChild(el('p', 'mechSub', r.rows.length + ' changes. The words struck through are the game\u2019s, and the words after them are what the fix writes. Each place opens the script at the line that contains it. Untick a change to leave it out of the patch.'));
  /* The places of a row, each a link to its line: a resource's name for its
     first place and a number for each after it, since a word misspelt twice
     in one speech is two places in one script. A row of more than a dozen
     (a British stem, "ye" for "the") folds them away behind their count. */
  const links = row => {
    const wrap = el('span', 'dataFixPlace');
    const seen = new Map();
    // Separated by commas, since a resource's name can be several words.
    row.at.forEach((loc, i) => {
      const n = (seen.get(loc.resid) || 0) + 1;
      seen.set(loc.resid, n);
      const label = n === 1 ? place(loc.resid) : String(n);
      if (i) wrap.appendChild(document.createTextNode(', '));
      if (loc.at === null) { wrap.appendChild(el('span', '', label)); return; }
      const b = el('button', 'svLink srcNum', label);
      b.title = propWordHex(loc.resid) + ' at ' + propWordHex(loc.at);
      b.onclick = function () { jumpToScriptAt(loc.resid, loc.at); };
      wrap.appendChild(b);
    });
    if (row.at.length <= 12) return wrap;
    const d = el('details', 'dataFixMany');
    d.appendChild(el('summary', 'mechSub', row.at.length + ' places'));
    d.appendChild(wrap);
    return d;
  };
  for (const part of parts) {
    const list = r.rows.filter(x => x.part === part);
    body.appendChild(el('div', 'partsTitle', heading(part) + ' (' + list.length + ')'));
    for (const row of list) {
      const line = el('div', 'dataFixChange');
      /* Each row can be left out of the patch (the maintainer, 1 October
         2026). Ticked is the default; the state is kept by the row's key,
         its part and its words, so it survives the list being made again. */
      const keep = document.createElement('input');
      keep.type = 'checkbox'; keep.checked = dataFixRowOn(row);
      keep.setAttribute('aria-label', 'include this change');
      keep.onchange = function () { dataFixRowToggle(row, keep.checked); };
      line.appendChild(keep);
      const many = row.at.length > 12;
      if (!many) line.appendChild(links(row));
      line.appendChild(el('span', 'dataFixWas', shown(row.find)));
      line.appendChild(el('span', 'dataFixNow', shown(row.replace)));
      if (many) line.appendChild(links(row));
      body.appendChild(line);
    }
  }
}

function renderDataFixMaker() {
  const host = document.getElementById('dataFixMaker');
  if (!host) return;
  host.innerHTML = '';
  const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text !== undefined) d.textContent = text; return d; };
  const on = window.DATAFIX_STATE.on;
  const box = (checked, onchange, label, disabled, type, name) => {
    const l = el('label', 'mechSub');
    const b = document.createElement('input');
    b.type = type || 'checkbox'; b.checked = checked; b.disabled = !!disabled;
    if (name) b.name = name;
    b.onchange = function () { onchange(b.checked, b); };
    l.appendChild(b);
    l.appendChild(el('span', '', ' ' + label));
    return { l, b };
  };
  for (const g of DATA_FIX_GROUPS) {
    /* A fix with options (the text) is not a row of its own: its options
       are rows of buttons and its own corrections are its list of changes,
       which has a box for all of them (the maintainer, 1 October 2026). */
    const owner = DATA_FIXES.find(f => f.group === g.id && !f.parent && DATA_FIXES.some(o => o.parent === f.id));
    const list = DATA_FIXES.filter(f => f.group === g.id && !f.parent && f !== owner);
    if (!list.length && !owner) continue;
    const head = el('div', 'dataFixHead');
    const gs = dataFixGroupState(g.id);
    const gb = box(gs.all, function (c) { dataFixGroup(g.id, c); }, g.title);
    gb.b.indeterminate = gs.some && !gs.all;
    gb.b.className = 'dataFixGroupBox';
    gb.b.setAttribute('data-group', g.id);
    gb.l.className = 'partsTitle';
    head.appendChild(gb.l);
    host.appendChild(head);
    if (g.note) host.appendChild(el('div', 'mechSub', g.note));
    for (const f of list) {
      const row = el('div', 'appFixRow');
      row.appendChild(box(on.has(f.id), function (c) { dataFixToggle(f.id, c); }, f.title + dataFixMark(f)).l);
      host.appendChild(row);
    }
    if (!owner) continue;
    const sub = el('div', 'dataFixOptions');
    /* Each choice is a row of buttons, its options and "don't", so that one
       of the three is always picked and the choice is plain to see; the
       first option, the maintainer's preference, is picked when the page
       opens (DATAFIX_STATE). */
    for (const c of DATA_FIX_CHOICES) {
      const opts = DATA_FIXES.filter(o => o.parent === owner.id && o.choice === c.id);
      if (!opts.length) continue;
      const picked = opts.find(o => on.has(o.id));
      const r = el('div', 'dataFixChoice');
      r.appendChild(el('div', 'dataFixChoiceName', c.title + untestedMark(opts[0])));
      for (const o of opts.concat([null])) {
        const ob = box(o ? picked === o : !picked, function (v) { if (v) dataFixChoose(c.id, o ? o.id : null); },
          o ? o.short : 'Don\u2019t standardize', false, 'radio', 'dataFixChoice-' + c.id);
        r.appendChild(ob.l);
      }
      sub.appendChild(r);
    }
    const st = window.DATAFIX_STATE;
    const d = el('details', 'appFixWords');
    d.open = !!st.showText;
    const sum = el('summary', 'mechSub');
    const all = document.createElement('input');
    all.type = 'checkbox'; all.className = 'dataFixAll';
    all.setAttribute('aria-label', 'every change the text makes');
    dataFixAllRowsState(all);
    all.onchange = function () { dataFixAllRows(all.checked); };
    sum.appendChild(all);
    sum.appendChild(document.createTextNode(' Every change the text makes' + untestedMark(owner)));
    d.appendChild(sum);
    const body = el('div', 'dataFixChanges');
    d.appendChild(body);
    // Filled after the list is drawn open, so the page answers the click
    // before the second or so the text takes.
    const fill = () => { body.textContent = 'Reading the text\u2026'; setTimeout(function () { dataFixFillChanges(body); dataFixAllRowsState(all); }, 0); };
    d.ontoggle = function () { st.showText = d.open; if (d.open) fill(); };
    if (d.open) fill();
    sub.appendChild(d);
    host.appendChild(sub);
  }
  const chosen = dataFixChosen(), n = chosen.length;
  host.appendChild(el('p', 'mechSub', n ? n + (n === 1 ? ' fix chosen.' : ' fixes chosen.') : 'Nothing chosen.'));
  if (!n) return;
  const desc = document.createElement('input');
  desc.type = 'text'; desc.id = 'dataFixDesc'; desc.className = 'heroDesc';
  desc.maxLength = 255;
  desc.value = dataFixDescription(chosen);
  desc.setAttribute('aria-label', 'what the patch calls itself');
  host.appendChild(el('div', 'partsTitle', 'What the patch calls itself'));
  host.appendChild(desc);
  const bar = el('div', 'mechStats');
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
  };
  btn('Apply to the open file', dataFixApply);
  btn('Read it as a patch', dataFixShowPatch);
  btn('Download the patch', function () { dataFixDownload(false); });
  btn('Download for a Mac', function () { dataFixDownload(true); });
  btn('Choose none', dataFixClear);
  host.appendChild(bar);
}

/* ---- two archives against each other, and a patch out of the difference ----
   The patches section reads a patch someone else made. This is the other two
   directions: comparing any two archives, and writing a patch out of what
   differs.

   WHAT IT COMPARES, and both are the same engine. *Your edits*, which is the
   file as it arrived (`PRISTINE_BYTES`) against the file as it stands -- the
   page can edit resources and had no way to show what you had changed, let
   alone hand it to anyone. And *another file*, which is how two releases of
   the game are compared: the four installers all open here, so 1.0.1 against
   1.0.4 is two files and a button.

   THE ORDER IS OLD, NEW. Added and removed are named from the first file's
   point of view, so "added" means the second has it and the first does not.

   ON EXPORTING A PATCH, AND THIS HAS TO BE SAID PLAINLY. What comes out is a
   real Delver archive shaped like a Magpie patch: grimoire reads it, the
   patches section describes it, `mergeDelverPatch` applies it, and the
   browser player loads it as an add-on. Until the check value was recovered
   out of Magpie's own code it would NOT have installed in Magpie under
   Mac OS 9, because the descriptor's first eight bytes are that value and
   Magpie marks a descriptor that fails the check unusable. It carries the
   real value now, and Magpie installed a patch written here on 15 September
   2026; the panel under the button says so. */
window.COMPARE_REPORT = null;

function compareSpecOf(bytes) { return bytes ? delverArchiveSpec(bytes) : null; }

/* The file as it arrived. parseArchiveBytes keeps it under PRISTINE_BYTES for
   exactly this reason -- a patch describes the file the player already has,
   and one edit rebuilds the whole archive. */
function compareEdits() {
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  const pristine = window.PRISTINE_BYTES;
  if (!pristine || !ARCHIVE) { say('No file is open.', true); return false; }
  if (pristine === ARCHIVE.bytes) { say('You have not edited this file yet.', true); return false; }
  const a = compareSpecOf(pristine), b = compareSpecOf(ARCHIVE.bytes);
  if (!a || !b) { say('The page could not read that file as a Delver Archive.', true); return false; }
  window.COMPARE_REPORT = Object.assign(describeDelverDiff(a, b),
    { aName: 'as it arrived', bName: 'as it stands', bSpec: b, kind: 'edits' });
  say('');
  renderCompareReport();
  return true;
}

/* Another archive, opened the way any file here is opened, so an installer
   works as well as a bare data fork: extractDelverArchive walks BinHex,
   StuffIt and Installer VISE to find the Delver archive inside. That is what
   makes comparing two releases a matter of choosing two files. */
function compareOpenBytes(bytes, name) {
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (!ARCHIVE) { say('No file is open to compare against.', true); return false; }
  let got;
  try { got = extractDelverArchive(bytes); }
  catch (e) { say('The page could not open that file: ' + e.message, true); return false; }
  const other = compareSpecOf(got.bytes);
  if (!other) { say('That file is not a Delver Archive.', true); return false; }
  const mine = compareSpecOf(ARCHIVE.bytes);
  /* The file you opened is the OLDER side. Comparing a 1.0.1 installer
     against an open 1.0.4 should read as "what 1.0.4 changed", which is the
     way round a reader expects and the opposite of what naming the open file
     first would give. */
  window.COMPARE_REPORT = Object.assign(describeDelverDiff(other, mine),
    { aName: name || 'the other file', bName: window.ARCHIVE_SOURCE_NAME || 'the open file',
      bSpec: mine, kind: 'files', via: got.via });
  // A saved game compared is also held beside the open file for the map's
  // Save mark (drawMapMarks), which draws its records over the scenario's
  // list of the zone shown; a player name at 0x20 is what makes it a save.
  window.SAVE_BESIDE = got.info && got.info.player ? { name: name || 'the save', spec: other, player: got.info.player, quest: saveQuestState(other) } : null;
  compareApplications(bytes, name);
  say('');
  renderCompareReport();
  return true;
}

/* The application half, when both sides have one. The page's own application
   arrives through the installer route (`loadApplicationFork`), so this is
   only offered when a file has been opened that way; without it the section
   compares the scenario data and says nothing about the program. */
function compareApplications(bytes, name) {
  window.COMPARE_APP = null;
  if (!window.APP_DATA) return;
  const other = findApplicationIn(bytes);
  if (!other) return;
  const mine = { data: window.APP_DATA, rsrc: window.APP_RSRC_RAW || null };
  const d = describeApplicationDiff(other, mine);
  if (!d || (!d.routines && !d.fork)) return;
  window.COMPARE_APP = Object.assign(d, { aName: other.name || name || 'the other application',
                                          bName: 'the open application', via: other.via });
}

function compareForget() { window.COMPARE_REPORT = null; window.COMPARE_APP = null; window.SAVE_BESIDE = null; renderCompareReport(); if (window.MAP_MARKS && window.MAP_MARKS.save) drawMapMarks(); }

/* An application inside whatever file was chosen, with both its forks.

   A Cythera installer holds the data file AND the application, so opening one
   can answer two questions at once: what the scenario data changed, and what
   the program changed. This finds the second. Everything it looks in is
   something the page already opens -- an Installer VISE archive, a StuffIt
   archive, or a plain MacBinary-ish wrapper -- and it returns null rather
   than throwing when there is no application, because most files have none
   and that is not an error. */
function findApplicationIn(bytes) {
  const pick = list => list.find(e => e.type === 'APPL') || null;
  try {
    const inst = sniffViseInstaller(bytes);
    if (inst) {
      const e = pick(inst.archive.entries);
      if (e) { const g = viseExtract(inst.archive, e);
               return { name: e.name, data: g.data, rsrc: g.rsrc, via: inst.archive.versionName + ' installer' }; }
    }
  } catch (e) { /* not an installer */ }
  const fromSit = buf => {
    if (typeof looksLikeStuffIt !== 'function' || !looksLikeStuffIt(buf)) return null;
    let arc; try { arc = parseStuffItArchive(buf); } catch (e) { return null; }
    const e = pick(arc.entries.filter(x => !x.isFolder));
    if (!e) return null;
    try { return { name: e.name, data: stuffItFork(buf, e, 'data'), rsrc: stuffItFork(buf, e, 'rsrc'), via: arc.format + ' archive' }; }
    catch (err) { return null; }
  };
  const bare = fromSit(bytes);
  if (bare) return bare;
  try {
    const forks = sniffMacContainer(bytes);
    if (forks) {
      if ((forks.type || '').trim() === 'APPL')
        return { name: forks.name, data: forks.data, rsrc: forks.rsrc, via: forks.kind };
      for (const which of ['data', 'rsrc']) {
        const inner = forks[which] && forks[which].length ? fromSit(forks[which]) : null;
        if (inner) { inner.via += ' in ' + forks.kind; return inner; }
      }
    }
  } catch (e) { /* not a container */ }
  return null;
}

/* A whole resource drawn, for the kinds the page can decode as one image.
   Subindex 141 is not here: a tile sheet is 32 by 512 and drawing two of them
   side by side says nothing, so those go to the per-tile comparison the
   patches section already has. */
const COMPARE_IMAGE_SUBN = new Set([135, 137, 131, 142]);
function compareImageCanvas(data, subn, resid) {
  let d;
  try { d = decodeResource(ARCHIVE, data, subn, resid); } catch (e) { return null; }
  if (!d || !d.W || !d.H) return null;
  const c = document.createElement('canvas');
  drawToCanvas(c, d.W, d.H, d.image, transparentIndexFor(subn));
  c.className = 'patchTile';
  // A portrait is 64 square and a landscape 288 by 32, so one fixed size
  // would squash something. The width is capped and the height follows.
  c.style.width = Math.min(128, d.W * 2) + 'px';
  c.style.height = 'auto';
  return c;
}

/* The records that differ, where the two files' tables can be read as
   records rather than bytes (25 September 2026, the readable half of
   showing a save against the scenario): the character table (0xF009), a
   character at a time and a named field at a time, by the Saved Game
   form's names (CHAR_GROUPS) and the flags; and each zone's prop
   list (0x81xx) and the cast (0xF306), a record at a time by index --
   added, gone, or changed in its square, its type, its state or its
   holder. Names are the open file's. The drawing of a save's props over
   the scenario's map is the other half and is not here. */
function compareRecordsHTML(rep) {
  const parts = [];
  const num = v => '<td class="num">' + v + '</td>';
  const chars = rep.changed.find(c => c.resid === 0xF009);
  if (chars) {
    let A = [], B = [];
    try { A = parseDelverCharacterRecords(chars.a.data); B = parseDelverCharacterRecords(chars.b.data); } catch (e) { quiet(e, 'comparing the character tables'); }
    const rows = [];
    let people = 0;
    const n = Math.max(A.length, B.length);
    for (let i = 1; i < n && rows.length < 400; i++) {
      const a = A[i], b = B[i];
      if (!a || !b) { if (a || b) { people++; rows.push('<tr><td>' + characterChip(i) + '</td><td>' + (a ? 'only in ' + svEsc(rep.aName) : 'only in ' + svEsc(rep.bName)) + '</td><td></td><td></td></tr>'); } continue; }
      if (a.raw.every((v, k) => v === b.raw[k])) continue;
      people++;
      // Every byte is named since 25 September 2026: the form's groups
      // (CHAR_GROUPS) and the flags, by the same names.
      for (const g of CHAR_GROUPS) for (const it of g.items) {
        if (it.id === 'x' || it.id === 'y') continue;
        const va = charItemValue(a, it), vb = charItemValue(b, it);
        if (va === vb) continue;
        const say = (r, v) => it.id === 'zone' ? zoneDisplayName(v) : it.id === 'proptype' ? (propDisplayName(v) || String(v)) : it.base === 16 ? '0x' + v.toString(16).toUpperCase() : String(v);
        rows.push('<tr><td>' + characterChip(i) + '</td><td>' + svEsc(it.label) + '</td>' + num(svEsc(say(a, va))) + num(svEsc(say(b, vb))) + '</tr>');
      }
      if (a.x !== b.x || a.y !== b.y) { rows.push('<tr><td>' + characterChip(i) + '</td><td>square</td>' + num(a.x + ', ' + a.y) + num(b.x + ', ' + b.y) + '</tr>'); }
      for (let f = 0; f < 32; f++) {
        if (charFlagOn(a, f) === charFlagOn(b, f)) continue;
        const nm = appImage() ? charFlagName(f) : null;
        rows.push('<tr><td>' + characterChip(i) + '</td><td>flag ' + f + (nm ? ' ' + svEsc(nm.replace(/^Is/, '').replace(/([a-z])([A-Z])/g, '$1 $2')) : '') + '</td>' + num(charFlagOn(a, f) ? 'on' : 'off') + num(charFlagOn(b, f) ? 'on' : 'off') + '</tr>');
      }
    }
    if (rows.length) parts.push('<div class="partsTitle">Characters</div><p class="mechSub">' + people + ' character record' + (people === 1 ? '' : 's') + ' differ' + (people === 1 ? 's' : '') + ', field by field.</p>' +
      mechTable(['character', 'field', '#in ' + svEsc(rep.aName), '#in ' + svEsc(rep.bName)], rows));
  }
  const lists = rep.changed.filter(c => (c.resid >= 0x8100 && c.resid <= 0x81FF) || c.resid === 0xF306);
  if (lists.length) {
    const rows = [];
    for (const c of lists) {
      let A = [], B = [];
      try { A = parseDelverPropList(c.a.data); B = parseDelverPropList(c.b.data); } catch (e) { quiet(e, 'comparing a prop list'); continue; }
      const where = c.resid === 0xF306 ? 'the cast' : zoneDisplayName(c.resid & 0xFF);
      const name = r => propDisplayName(r.proptype) || ('prop ' + r.proptype);
      const same = (x, y) => x.x === y.x && x.y === y.y && x.proptype === y.proptype && x.aspect === y.aspect && x.flags === y.flags && x.d1 === y.d1 && x.d2 === y.d2 && x.container === y.container;
      /* Where a record is. Its x and y are a square only while it is on the
         floor; carried or inside another prop they are the holder's number
         (parseDelverPropList), and printing them as a square put a save's
         inventory "at 32, 1" and "at 1024, 1" (28 September 2026, the Save
         mark's fault in words). A container is another record of the same
         list, by index. */
      const place = (r, list) => r.flags === 0xFF ? 'deleted'
        : r.carriedBy !== null ? (r.equipped ? 'worn by ' : 'carried by ') + svEsc(characterName(r.carriedBy))
        : r.container !== null ? 'inside ' + (list[r.container] ? svEsc(name(list[r.container])) : 'record ' + r.container)
        : 'at ' + r.x + ', ' + r.y;
      const n = Math.max(A.length, B.length);
      let added = 0, gone = 0, changed = 0;
      const detail = [];
      for (let i = 0; i < n; i++) {
        const a = A[i], b = B[i];
        if (!a && b) { added++; if (detail.length < 12) detail.push(svEsc(name(b)) + ' ' + place(b, B) + ' only in ' + svEsc(rep.bName)); continue; }
        if (a && !b) { gone++; if (detail.length < 12) detail.push(svEsc(name(a)) + ' ' + place(a, A) + ' only in ' + svEsc(rep.aName)); continue; }
        if (same(a, b)) continue;
        changed++;
        const moved = a.x !== b.x || a.y !== b.y;
        if (detail.length < 12) detail.push(svEsc(name(a)) +
          (moved && a.onMap && b.onMap ? ' from ' + a.x + ', ' + a.y + ' to ' + b.x + ', ' + b.y : moved ? ' ' + place(a, A) + ', now ' + place(b, B) : ' ' + place(a, A)) +
          (a.proptype !== b.proptype ? ', now ' + svEsc(name(b)) : '') + (a.flags !== b.flags ? ', flags ' + propWordHex(a.flags, 2) + ' to ' + propWordHex(b.flags, 2) : '') +
          (a.d1 !== b.d1 || a.d2 !== b.d2 ? ', data ' + a.d1 + '/' + a.d2 + ' to ' + b.d1 + '/' + b.d2 : '') + (a.container !== b.container && !moved ? ', held by another' : ''));
      }
      if (!added && !gone && !changed) continue;
      rows.push('<tr><td>' + svChip(c.resid, where) + '</td>' + num(added || '') + num(gone || '') + num(changed || '') + '<td>' + detail.join('<br>') + (added + gone + changed > detail.length ? '<br>and ' + (added + gone + changed - detail.length) + ' more' : '') + '</td></tr>');
    }
    if (rows.length) parts.push('<div class="partsTitle">Zones</div><p class="mechSub">Each list, one record at a time by position: records the other file does not have, and records whose square, type, state or holder differs.</p>' +
      mechTable(['list', '#only in ' + svEsc(rep.bName), '#only in ' + svEsc(rep.aName), '#changed', 'which'], rows));
  }
  return parts.join('');
}

function renderCompareReport() {
  const host = document.getElementById('compareReport');
  if (!host) return;
  host.innerHTML = '';
  const rep = window.COMPARE_REPORT;
  if (!rep) return;
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };

  host.appendChild(el('div', 'partsTitle', svEsc(rep.aName) + ' against ' + svEsc(rep.bName)));
  if (rep.identical) {
    host.appendChild(el('p', 'mechLede', 'Every one of the ' + rep.aCount +
      ' resources is identical. The two files hold the same scenario data.'));
    host.appendChild(el('div', '', svLink('Forget this comparison', 'compareForget()')));
    return;
  }
  const bits = [];
  const real = rep.changed.filter(c => !c.unsetKeysOnly), unset = rep.changed.filter(c => c.unsetKeysOnly);
  if (real.length) bits.push('<b>' + real.length + '</b> changed');
  if (unset.length) bits.push('<b>' + unset.length + '</b> differ only in unset table keys');
  if (rep.added.length) bits.push('<b>' + rep.added.length + '</b> only in ' + svEsc(rep.bName));
  if (rep.removed.length) bits.push('<b>' + rep.removed.length + '</b> only in ' + svEsc(rep.aName));
  host.appendChild(el('p', 'mechLede', bits.join(', ') + ', and <b>' + rep.unchanged +
    '</b> identical, of ' + rep.aCount + '.'));
  if (rep.titleChanged) host.appendChild(el('p', 'mechSub', 'The two files name different scenarios, so their resource ids may not mean the same things.'));
  if (rep.formatChanged) host.appendChild(el('p', 'mechSub', 'The two files have different format versions.'));
  if (rep.encryptionChanged.length) host.appendChild(el('p', 'mechSub',
    rep.encryptionChanged.length + ' resource(s) are encrypted in one file and not in the other. Either way, the page compares the decrypted contents.'));

  host.appendChild(el('div', 'partsTitle', 'Where the differences are'));
  host.appendChild(el('div', '', mechTable(['what', '#changed', '#added', '#removed'],
    rep.groups.map(g => '<tr><td>' + svEsc(CATEGORY_NAMES[g.subn] || ('subindex ' + g.subn)) +
      '<span class="mechSub"> ' + propWordHex((g.subn + 1) * 0x100) + ' to ' + propWordHex((g.subn + 1) * 0x100 + 255) + '</span></td>' +
      mechNum(g.changed || '') + mechNum(g.added || '') + mechNum(g.removed || '') + '</tr>'))));

  const rows = real.slice(0, 400).map(c => '<tr>' +
    '<td>' + svChip(c.resid, labelFor(c.resid) || '') + '</td>' +
    mechNum(c.aLength) + mechNum(c.bLength) +
    mechNum((c.bLength - c.aLength > 0 ? '+' : '') + (c.bLength - c.aLength)) + '</tr>');
  if (rows.length) {
    host.appendChild(el('div', 'partsTitle', 'What changed'));
    host.appendChild(el('div', '', mechTable(['resource', '#in ' + svEsc(rep.aName), '#in ' + svEsc(rep.bName), '#difference'], rows)));
    if (real.length > rows.length)
      host.appendChild(el('p', 'mechSub', 'The first ' + rows.length + ' of ' + real.length + '.'));
  }
  // A script resource ends in its object table, and an entry with no value
  // has a key the compiler never set. Two builds differ there without
  // either having changed, so these are named and set apart rather than
  // listed as changes (delverUnsetKeysOnly).
  if (unset.length) {
    host.appendChild(el('div', 'partsTitle', 'Differ only in unset table keys'));
    host.appendChild(el('p', 'mechSub', unset.length + ' script resource' + (unset.length === 1 ? '' : 's') + ' differ only in unused table entries that the compiler left unset. Nothing in them changed.'));
    host.appendChild(el('div', '', unset.slice(0, 400).map(c => svChip(c.resid, labelFor(c.resid) || '')).join(' ')));
  }
  {
    let recs = '';
    try { recs = compareRecordsHTML(rep); } catch (e) { quiet(e, 'the records that differ'); recs = ''; }
    if (recs) host.appendChild(el('div', '', recs));
  }
  if (rep.added.length) {
    host.appendChild(el('div', 'partsTitle', 'Only in ' + svEsc(rep.bName)));
    host.appendChild(el('div', '', mechTable(['resource', '#bytes'],
      rep.added.map(a => '<tr><td>' + svChip(a.resid, labelFor(a.resid) || '') + '</td>' + mechNum(a.b.data.length) + '</tr>'))));
  }
  if (rep.removed.length) {
    host.appendChild(el('div', 'partsTitle', 'Only in ' + svEsc(rep.aName)));
    host.appendChild(el('div', '', mechTable(['resource', '#bytes'],
      rep.removed.map(a => '<tr><td><span class="patchMono">' + propWordHex(a.resid) + '</span></td>' + mechNum(a.a.data.length) + '</tr>'))));
  }

  // The pictures, where there are any. Tile sheets tile by tile, everything
  // else the page can decode as a whole image side by side.
  const sheets = rep.changed.filter(c => c.subn === 141)
    .map(c => ({ c, diff: patchSheetDiff({ resid: c.resid, subn: 141, baseData: c.a.data, patchData: c.b.data }) }))
    .filter(x => x.diff && x.diff.changed.length);
  const pics = rep.changed.filter(c => COMPARE_IMAGE_SUBN.has(c.subn)).slice(0, 40);
  if (sheets.length || pics.length) {
    host.appendChild(el('div', 'partsTitle', 'What it looks like'));
    host.appendChild(el('p', 'mechSub', svEsc(rep.aName) + ' on the left of each pair, ' + svEsc(rep.bName) + ' on the right.'));
  }
  for (const { c, diff } of sheets) {
    const head = el('div', 'patchSheetHead');
    head.innerHTML = svChip(c.resid, labelFor(c.resid) || '') + '<span class="mechSub">' + diff.changed.length + ' of ' + diff.tiles + ' tiles</span>';
    host.appendChild(head);
    const strip = el('div', 'patchStrip');
    for (const t of diff.changed) {
      const pair = el('div', 'patchPair');
      pair.appendChild(patchTileCanvas(diff.base, t, 141));
      pair.appendChild(patchTileCanvas(diff.patch, t, 141));
      pair.appendChild(el('span', 'patchTileNo', String(t)));
      strip.appendChild(pair);
    }
    host.appendChild(strip);
  }
  if (pics.length) {
    const strip = el('div', 'patchStrip');
    for (const c of pics) {
      const before = compareImageCanvas(c.a.data, c.subn, c.resid);
      const after = compareImageCanvas(c.b.data, c.subn, c.resid);
      if (!before || !after) continue;
      const pair = el('div', 'patchPair');
      pair.appendChild(before); pair.appendChild(after);
      pair.appendChild(el('span', 'patchTileNo', propWordHex(c.resid)));
      strip.appendChild(pair);
    }
    if (strip.children.length) host.appendChild(strip);
  }

  scriptDiffSection(host, el, real.filter(c => SCRIPT_SUBN.has(c.subn)).map(c => ({ resid: c.resid, a: c.a.data, b: c.b.data }))
    .concat(rep.added.filter(x => SCRIPT_SUBN.has((x.resid >> 8) - 1)).map(x => ({ resid: x.resid, a: null, b: x.b.data }))), rep.aName, rep.bName,
    rep.scriptDiffs || (rep.scriptDiffs = new Map()));

  /* The export. Only offered when the newer side is a file this page can take
     the resources OUT of, which is the open file -- a patch has to carry the
     bytes you want someone else to end up with, and for a comparison against
     a file you opened those live on the other side. */
  host.appendChild(el('div', 'partsTitle', 'Save the differences as a patch'));
  host.appendChild(el('ul', 'ruleList',
    '<li>The patch holds only what differs, and works in Magpie, on this page and in the browser player.</li>' +
    '<li>Its contents come from <b>' + svEsc(rep.bName) + '</b>, so applying it makes another file match that one.</li>' +
    /* Established by reading Magpie's imports: of 299 symbols it imports one
       Resource Manager call, GetResource, and none that writes -- no
       AddResource, ChangedResource, WriteResource or UpdateResFile, and no
       call that opens another file's resource fork at all. What it imports is
       the flat-file set, FSpOpenDF through FSWrite. So the format cannot carry
       a resource-fork change, and a swapped font is the case that would
       otherwise go missing without a word. */
    '<li>A patch cannot change the game\u2019s font, or anything else in the resource fork.</li>' +
    '<li>The second button saves it as <b>MacBinary</b>, so a Mac shows it with Magpie\u2019s icon. ' +
    'Use the plain file if you will copy it straight into a shared folder.</li>'));
  const form = el('div', 'mechStats');
  const desc = document.createElement('input');
  desc.type = 'text'; desc.id = 'patchDesc'; desc.placeholder = 'What this patch does';
  desc.setAttribute('maxlength', '255');
  form.appendChild(desc);
  const btn = document.createElement('button');
  btn.className = 'secondary';
  btn.style.cssText = 'width:auto;margin:0;padding:6px 12px';
  btn.textContent = 'Export ' + rep.changed.length + ' resource' + (rep.changed.length === 1 ? '' : 's') + ' as a patch';
  btn.onclick = () => compareExportPatch(false);
  form.appendChild(btn);
  const wrapped = document.createElement('button');
  wrapped.className = 'secondary';
  wrapped.style.cssText = 'width:auto;margin:0;padding:6px 12px';
  wrapped.textContent = 'Export as MacBinary';
  wrapped.onclick = () => compareExportPatch(true);
  form.appendChild(wrapped);
  host.appendChild(form);
  /* Where to get the thing that installs it. A patch file is no use on its
     own: Magpie is what merges one into a copy of the game, it is Glenn
     Andreas's application rather than ours, and the only copy on the web is
     in the Cythera Guides add-ons archive. It cannot be fetched into this
     page even as a convenience -- that host serves plain HTTP with no TLS at
     all, so a browser on this page blocks it as mixed content before CORS is
     reached -- so a link out is the whole of what can honestly be offered. */
  host.appendChild(el('div', 'mechSub',
    'To install a patch on a Mac you need <b>Magpie</b>: ' +
    '<a href="http://www.cytheraguides.com/archives/ambrosia_addons/cythera/Miscellaneous/614_MagpiePumpkinPatch.sit.hqx" ' +
    'target="_blank" rel="noopener">Magpie and the Pumpkin Patch</a>, from the Cythera Guides ' +
    'add-ons archive. Drop that file on this page to open the patch inside it here.'));
  renderCompareApp(host, el);
  host.appendChild(el('div', '', svLink('Forget this comparison', 'compareForget()')));
}

/* The application comparison, under the data one. Routines that moved are
   counted and not listed: between two builds of the same program almost every
   routine has moved, and none of it means anything. */
function renderCompareApp(host, el) {
  const app = window.COMPARE_APP;
  if (!app) return;
  host.appendChild(el('div', 'partsTitle', 'And the program'));
  const r = app.routines;
  if (r) {
    host.appendChild(el('p', 'mechLede',
      '<b>' + r.meaningful + '</b> routine' + (r.meaningful === 1 ? '' : 's') + ' differ of ' + r.aCount +
      ': <b>' + r.added.length + '</b> added, <b>' + r.gone.length + '</b> gone, <b>' + r.resized.length +
      '</b> compiled to a different length' +
      (r.compilerOnly ? ', of which <b>' + r.compilerOnly + '</b> differ only in how the compiler arranged the code, not in what it does' : '') +
      '. Another ' + r.moved + ' moved position without changing, as everything after the first difference does.'));
    const rows = [];
    for (const x of r.added) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">added</td>' + mechNum('') + mechNum(x.length) + mechNum('') + '<td></td></tr>');
    for (const x of r.gone) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">gone</td>' + mechNum(x.length) + mechNum('') + mechNum('') + '<td></td></tr>');
    /* What the compiler emitted differently, not just how much. A routine
       whose census moves by nothing but register copies is the code generator
       rather than an edit, and saying so is the difference between reading a
       release correctly and inventing a change that is not there. */
    const census = x => {
      const bits = (x.added || []).map(a => '+' + a.n + ' ' + a.op)
        .concat((x.removed || []).map(a => '-' + a.n + ' ' + a.op));
      if (x.compilerOnly) return '<span class="mechSub">the compiler: ' + svEsc(bits.join(', ') || 'reordered') + '</span>';
      return bits.length ? '<span class="patchMono">' + svEsc(bits.join(' ')) + '</span>' : '';
    };
    for (const x of r.resized) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">' +
      (x.compilerOnly ? 'recompiled' : 'changed') + '</td>' +
      mechNum(x.aLength) + mechNum(x.bLength) + mechNum((x.delta > 0 ? '+' : '') + x.delta) +
      '<td>' + census(x) + '</td></tr>');
    host.appendChild(el('div', '', mechTable(['routine', '', '#in ' + svEsc(app.aName), '#in ' + svEsc(app.bName), '#difference', 'what the compiler emitted'], rows)));
    if (!rows.length) host.appendChild(el('p', 'mechSub', 'Every routine has the same name and the same length in both.'));
  } else {
    host.appendChild(el('p', 'mechSub', 'Neither program names its routines, so the page could compare only the resource forks.'));
  }
  const f = app.fork;
  if (f) {
    host.appendChild(el('div', 'partsTitle', 'Its resource fork'));
    const rows = f.changed.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span>' +
      (x.name ? ' ' + svEsc(x.name) : '') + '</td>' + mechNum(x.aLength) + mechNum(x.bLength) + '</tr>')
      .concat(f.added.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span><span class="mechSub"> added</span></td>' + mechNum('') + mechNum(x.length) + '</tr>'))
      .concat(f.removed.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span><span class="mechSub"> gone</span></td>' + mechNum(x.length) + mechNum('') + '</tr>'));
    host.appendChild(el('p', 'mechLede', '<b>' + f.changed.length + '</b> changed, <b>' + f.added.length +
      '</b> added and <b>' + f.removed.length + '</b> gone, of ' + f.aCount + '.'));
    host.appendChild(el('div', '', mechTable(['resource', '#in ' + svEsc(app.aName), '#in ' + svEsc(app.bName)], rows)));
  }
}

/* MAGPIE'S SIGNATURE, WHICH IS WHAT TELLS A PATCH FROM A SAVED GAME. Both are
   type `DelP`: `I.M.Cheater`, `Tree`, `Zone` and `Rocky the Flying Chicken`
   are `DelP`/`Delv`, and the Pumpkin Patch is `DelP`/`Delp`. Cythera's bundle
   claims `DelP` and draws a saved game for it; Magpie's claims `DelP` too and
   draws its own patch icon, the framed tile with a corner cut away. So the
   creator is the whole of the difference, and a patch written with the game's
   creator would arrive on a Mac looking like somebody's saved game. */
const DELV_PATCH_CREATOR = 'Delp';
function compareExportPatch(asMacBinary) {
  const rep = window.COMPARE_REPORT;
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (!rep) return;
  const d = document.getElementById('patchDesc');
  try {
    /* TYPE 3, NOT 0, AND THE DIFFERENCE MATTERS. The byte at descriptor +26
       carries Magpie's type, and 0 is Bug Fix -- the one value the binary
       tests outright, in the branch that raises "Bug fixes are always
       installed, and can not be removed". Exporting as 0 would have produced
       patches nobody could uninstall, which was the first thing driving the
       real export path showed. 3 is what the one real add-on patch carries,
       and is removable. It is used because that is what a working patch has,
       not because anything here knows what 3 is called. */
    const w = writeDelverPatch(rep.bSpec, rep.changed.map(c => c.resid),
      { description: (d && d.value) || '', typeCode: DELV_PATCH_EXPORT_TYPE });
    /* The file is named for the archive, not for the side of the comparison.
       `bName` is "as it stands" when you are exporting your own edits, and
       "as it stands Patch" is not a file name anyone wants. */
    const base = (rep.kind === 'edits' ? (window.ARCHIVE_SOURCE_NAME || 'Cythera Data') : rep.bName) || 'Cythera';
    const name = safeFileName(base.replace(/\.[A-Za-z0-9]{1,4}$/, '') + ' Patch');
    /* Two shapes of the same patch. The bare data fork is the file itself and
       is what a shared folder wants; the MacBinary is the same bytes with a
       Finder identity around them, so a Mac that decodes it gets a file typed
       DelP with Magpie's creator -- which is what makes it a patch rather
       than a saved game to the Finder, and what puts Magpie's own icon on it.
       A patch has no resource fork, so the wrapper carries none. */
    if (asMacBinary) {
      const bin = writeMacBinary({ name: name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
      dlBlob(new Blob([bin], { type: 'application/macbinary' }), name + '.bin');
    } else {
      downloadBlob(w.bytes, name);
    }
    say(w.resids.length + ' resource(s) written, ' + w.bytes.length.toLocaleString() +
        ' bytes' + (asMacBinary ? ' in a MacBinary typed DelP/' + DELV_PATCH_CREATOR : '') +
        ', identity ' + w.uuidText +
        (w.checkValueValid ? ', check value ' + w.checkValue + ' and it verifies.' : ', and the check value does not verify.'));
  } catch (e) { say('The page could not write that patch: ' + e.message, true); }
}

function renderMechanicsSheet(value) {
  stopAllViewActivity();
  // The figures' weapon list is derived, so it is dropped here and rebuilt
  // with the sheet rather than kept for the session; resetDerivedCaches()
  // drops it too, for the archive that is swapped while it is not showing.
  DERIVED.MECH_WEAPONS = null;
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'mechView';
  // Short names for the shared builders, so the sections read as they did
  // when these were closures here.
  const table = mechTable, num = mechNum, stat = mechStat;
  const sections = [];
  // One section: an icon, a title, where it was read from, a line saying what
  // it is, the rule as short items, and the table or strip under it.
  /* A section is built but NOT placed here: the grouping loop below appends
     the ones whose tab is showing. It used to append on the spot and the loop
     re-appended, which moved the node rather than copying it, so the only
     change is that a section whose tab is not open now stays unplaced instead
     of being built into the page and then moved out of it. */
  const add = (id, title, icon, from, lede, rules, html, chips) => {
    const sec = mechSectionEl(id, title, icon, from, lede, rules, html, chips);
    sections.push({ id, title, el: sec });
  };
  const src = mechSrc;
  const chipOf = i => loadCharacterTable()[i] ? characterChip(i) : '';
  // The application's clock, off TGameViewer::DoTicks, for every section
  // that counts time; null with no application open, and then no section
  // states a figure of it.
  const clk = appImage() ? exeClockRules() : null;
  const model = clk && clk.model;
  const perHour = clk && clk.unitsPerHour ? clk.unitsPerHour.v : null;
  // A period of the program's table, in words, as a link to the table.
  const period = i => clk && clk.table && clk.table.v[i] !== undefined ? srcNum(clk.table, exeClockWords(clk.table.v[i], perHour)) : '';
  const noApp = MECH_NO_APP;
  const propChip = (pt, name, sub) => '<button class="relChip" onclick="showPropTypeDetail(' + pt + ')"><span class="relText"><span class="relMain">' + svEsc(name) + '</span>' + (sub ? '<span class="relSub">' + svEsc(sub) + '</span>' : '') + '</span></button>';

  // ---- the dice game ----
  const dice = diceGame();
  add('dice', 'The Dice Game', null, src('the game', 0x812),
    dice ? 'Played at the inns: three dice, the innkeeper’s two black and your one white, ' +
             (dice.faces.every(f => f === dice.faces[0]) ? 'each showing one to ' + srcNum(dice.vals.faces[0])
               : 'showing one to ' + srcNum(dice.vals.faces[0]) + ', ' + srcNum(dice.vals.faces[1]) + ' and ' + srcNum(dice.vals.faces[2]) + ': the innkeeper’s first, yours, the innkeeper’s second') + '.'
         : 'This file has no dice game.',
    dice ? [
      'The innkeeper throws one die and you throw yours. <b>Match it and you win ' + srcNum(dice.vals.matchPay) + ' obol' + (dice.matchPay === 1 ? '' : 'oi') + '.</b>',
      'Otherwise the innkeeper throws the second die. If yours is <b>outside</b> the two black dice, you win the difference to the nearer one; if it is <b>between</b> them, or equal to one, you lose ' +
        (dice.vals.lose ? srcNum(dice.vals.lose) + ' obol' + (dice.vals.lose.v === 1 ? '' : 'oi') : 'your stake') + '.',
      dice.vals.draw ? 'A win of ' + srcNum(dice.vals.draw) + ' is a draw, and the two play again.' : '',
      dice.vals.stake ? 'Your stake is ' + srcNum(dice.vals.stake) + ' obol' + (dice.vals.stake.v === 1 ? '' : 'oi') + ', so a win pays that much less than the innkeeper announces.' : '',
      dice.skillAlways ? '<b>Gambling</b> sets your die to the innkeeper’s first whenever they differed.' + (dice.skillFree ? ' This file has the skill check removed, so it happens without the skill.' : '')
        : dice.vals.skillFaces ? '<b>Gambling</b> gives your die a one in ' + srcNum(dice.vals.skillFaces) + ' chance of changing to the innkeeper’s first, when they differed.' + (dice.skillFree ? ' This file has the skill check removed, so it happens without the skill.' : '')
        : ''
    ].filter(Boolean) : [],
    dice ? '<div class="mechStats">' + stat(dice.wins, 'win') + stat(dice.pushes, 'draw') + stat(dice.losses, 'lose') + '<span class="mechStatNote">of ' + dice.total + ' throws</span>' +
           stat((dice.fair >= 0 ? '+' : '') + dice.fair.toFixed(3), 'obols a game, without the skill') + stat((dice.skilled >= 0 ? '+' : '') + dice.skilled.toFixed(3), 'with it') + '</div>' +
           (dice.explain ? '<blockquote class="mechQuote">' + srcNum(dice.explainVal, dice.explain.replace(/\*/g, ' ')) + '<footer>the innkeeper, in the same script</footer></blockquote>' : '') +
           mechFig('All ' + dice.total + ' throws: the innkeeper’s first die down the side, the second across, your own ' + dice.faces[1] + ' faces inside each cell',
             mechDiceMatrix(mechDiceExact(dice.opts).cells),
             'Red loses an obol, gray is a draw and green wins, brighter for more.') +
           '<div class="mechCtl">' +
             '<button onclick="diceSimPlay(1)">Throw</button>' +
             '<button onclick="diceSimPlay(1000)">1,000 games</button>' +
             '<button onclick="diceSimPlay(100000)">100,000</button>' +
             '<label><input type="checkbox" onchange="diceSimSet(this.checked)"> with <b>Gambling</b></label>' +
             '<button onclick="diceSimReset()">Reset</button>' +
           '</div><div id="diceSim">' + diceSimHtml() + '</div>' + mechDiceBytes(dice) : '',
    dice ? '<span class="partsTitle">In the file</span>' + src('The game', 0x812) + src('The dice', 0x1148) + src('Gambling', 0x1ACF) + [40, 41, 42].map(chipOf).join('') : '');

  // ---- combat ----
  const cb = combatRules(), ar = attackRules();
  const rollFrom = (what) => ar && ar.scale ? 'a random number from 0 to ' + what + ' less ' + srcNum(ar.scale.subVal) + ' over ' + srcNum(ar.scale.divVal) : '';
  const rollTo = v => v ? srcNum(v, v.v - 1) : '';
  add('combat', 'Combat', null, src('the attack', 0x3042) + src('a blow', 0xE88) + src('a missile', 0xE89) + src('the outcome', 0xE87),
    cb ? 'How a blow lands, misses or meets a parry, and how much damage it does.'
       : 'This file has no combat scripts.',
    cb ? [
      ar && ar.reach && ar.meleeFirst ? 'The attack picks the weapon first; the first thing wielded whose <b>reach</b> covers the distance is swung' +
        (ar.range && ar.beyondAdjacent ? '. If nothing reaches, and the target is not adjacent but is in sight, the first thing with a thrown figure is <b>thrown</b> as a missile' : '') + '.' +
        (ar.squared && ar.lessOne && ar.reachAt ? ' Something reaches when its ' + srcNum(ar.reachAt, 'reach') +
          (ar.rangeAt ? ', ' + (ar.launcherAt ? '' : 'or ') + 'its ' + srcNum(ar.rangeAt, 'thrown range') : '') + (ar.launcherAt ? ' or a launcher’s ' + srcNum(ar.launcherAt, 'range') : '') +
          ', squared, is at least the distance squared (across squared plus down squared) less ' + srcNum(ar.lessOneVal) + '.' : '') +
        (ar.squared && ar.lessOne ? ' Reach ' + srcNum(ar.lessOneVal, '1') + ' covers the eight squares around the attacker, and reach 2 covers two squares in a straight line or a knight’s move.' : '') : '',
      'The margin is the attacker’s <b>reflex</b>' + (cb.roll ? ' <b>plus a random number from 0 to ' + rollTo(cb.roll) + '</b>' : '') +
        (cb.skillOffLoop
          ? (cb.barehand ? ', plus Barehand when the attacker wields nothing' : '') + (cb.missileSkill ? ' (Missile for a launcher)' : '')
          : ', plus the weapon’s skill' + (cb.barehand ? ' (Barehand with none' : '') + (cb.missileSkill ? ', Missile for a launcher)' : ')')) +
        ', <b>less the defender’s reflex' + (cb.rollDefender ? ' plus a random number from 0 to ' + rollTo(cb.rollDefender) : '') + '</b>, plus Attack less Defense. ' +
        (cb.bodyForReflex ? 'Some attackers use their <b>' + srcNum(cb.bodyForReflex, 'body') + '</b> instead of their reflex' + combatBodyUnitsText(cb.bodyForReflex.v) + '.' : 'A monster’s flags can make it use its body in place of its reflex.'),
      cb.skillOffLoop ? '<b>A weapon’s skill adds nothing</b>, because of a bug; the script ' +
        srcNum(cb.skillOffLoop[0], 'reads it from the wrong place') + ' and always gets 0, so Sword, Axe and Mace make no difference to an armed blow.' : '',
      'The weapon’s enchantment' + (cb.skillOffLoop ? ' goes' : ' and skill go') + ' on the margin first. Then, <b>in this order</b>: a margin of nothing or less <b>misses</b>; ' +
        (cb.parry ? 'otherwise the shields get a chance; each blocking item the defender wears gives <b>a random number from 0 to its block figure plus the Shield skill</b>, the game adds these up, and the shields <b>parry</b> a margin below the total' : 'what is left lands') +
        '.',
      cb.dmgAdd ? 'A hit does <b>' + srcNum(cb.dmgAdd) + ' plus a random number below the damage figure, plus the enchantment</b>' + (cb.skillOffLoop ? '' : ', with the skill added to the figure first') + '. The defender’s resistance comes off afterward, so the game’s word for a blow can overstate it.' : '',
      ar && ar.bodyRoll && ar.scale ? 'The damage figure of a blow is the weapon’s plus ' + rollFrom('body') + (ar.reflexRoll ? '; a throw’s is its throw entry’s plus ' + rollFrom('reflex') : '') + '.' : '',
      ar && ar.lodges && ar.drops ? (wrongCarryFlags().some(w => w.resid === 0x3042)
        ? 'A thrown weapon that <b>hits or meets a parry</b> is lost, because of a bug; the game puts it inside the target without marking it as carried. One that misses lands on the target’s square.'
        : 'The target carries a thrown weapon that <b>hits or meets a parry</b>, and you find it there when the target dies. One that misses lands on the target’s square. Nothing else brings it back.') + (ar.ammoSpent ? ' A launcher uses up one piece of ammunition per shot.' : '') : '',
      cb.words.length ? 'The game describes a blow by how much damage it does: ' + cb.words.map(w => '<i>' + svEsc(w.word) + '</i> under ' + srcNum(w.val)).join(', ') + (cb.last ? ', and <i>' + svEsc(cb.last.word) + '</i> above.' : '.') : ''
    ].filter(Boolean) : [],
    cb && cb.roll && cb.rollDefender && cb.dmgAdd ? combatSimControls() + '<div id="combatOut">' + combatSimHtml(combatSimParams(), cb) + '</div>' : '', '');

  // ---- damage to things ----
  // Every class with a TakeDamage of its own, read off its script
  // (damageTakers), and the door and chest helpers they hand the blow to.
  {
    const dt = damageTakers();
    const rows = dt.rows, door = dt.door, chest = dt.chest;
    const nm = r => svLink(r.name, 'showItemDetail(' + r.pt + ')');
    const typed = rows.filter(r => r.types.length);
    const sig = r => r.types.map(t => t.mask.v + t.op + t.k.v).join(',');
    const oneTable = typed.length && typed.every(r => sig(r) === sig(typed[0]));
    // Which weapons each test catches (damageTypeCarriers): a type with
    // the bit that no earlier test took.
    const carriers = (steps, i) => damageTypeCarriers(t => !!(t & steps[i].mask.v) && !steps.slice(0, i).some(p => t & p.mask.v));
    const opWord = t => (t.op === 'mul' ? '× ' : '÷ ') + srcNum(t.k);
    const doors = rows.filter(r => r.rule === 'door'), chests = rows.filter(r => r.rule === 'chest');
    const listStrength = rs => rs.map(r => nm(r) + ' ' + srcNum(r.strength)).join(', ');
    const q = s => s ? ' (' + srcSaid([0xE49, 0xE4A], s) + ')' : '';
    add('damage', 'Damage to Things', null, src('a blow', 0xE87) + src('a door', 0xE49) + src('a chest', 0xE4A),
      rows.length ? countLink(rows.length + ' kinds of thing', 'The ' + rows.length + ' kinds of thing that take damage by separate rules', rows.map(nm)) + ', doors and chests among them, take damage by separate rules.'
                  : 'No item class in this file takes damage by a separate rule.',
      rows.length ? [
        oneTable ? typed.map(nm).join(', ') + ' take ' +
          typed[0].types.map((t, i, all) => '<b>' + opWord(t) + '</b> from ' + srcNum(t.mask, carriers(all, i) ? svEsc(carriers(all, i)) : 'type ' + t.mask.v)).join('; ') +
          '. Fire and other damage is unchanged.' : '',
        door && door.destroy && doors.length ? 'A locked door’s strength is its lock figure: ' + listStrength(doors) + '. A blow above <b>' + srcNum(door.destroy.factor) + ' times the strength</b> destroys it' + q(door.saysDestroyed) + '.' +
          (door.opens ? ' Below that, a blow greater than what is left of the strength ' + srcNum(door.opens, 'bashes it open') + q(door.saysOpened) : '') +
          (door.wear && door.step ? ', and one above what is left ÷ ' + srcNum(door.wear) + ' wears it down by ' + srcNum(door.step) + q(door.saysWorn) : '') + '.' +
          (door.magicOnlyDestroyed ? ' Only destroying a magically locked door gets past it.' : '') + ' A blow opens a closed, unlocked door, and does nothing to an open one.' : '',
        chest && chest.destroy && chests.length ? 'A chest’s strength: ' + listStrength(chests) + '. Whatever its state, a blow above <b>' + srcNum(chest.destroy.factor) + ' times the strength</b> destroys it' + (chest.spills ? ' and drops what it held' : '') + '.' +
          (chest.opens ? ' Locked, a blow above what is left ' + srcNum(chest.opens, 'opens it') + q(chest.saysOpened) : '') +
          (chest.wear && chest.step ? ', one above what is left ÷ ' + srcNum(chest.wear) + ' wears it down by ' + srcNum(chest.step) + q(chest.saysWorn) : '') +
          (chest.saysHeld ? ', and a smaller one says ' + srcSaid(0xE4A, chest.saysHeld) + (/[.!?]$/.test(chest.saysHeld) ? '' : '.') : '.') +
          ' Only destroying a magically locked chest gets past it; a blow opens a closed, unlocked chest.' : '',
        (door && door.setsOff) || (chest && chest.setsOff) ? 'Before a blow on a door or chest counts, anything inside it marked with flag ' + srcNum((door && door.setsOff) || chest.setsOff) + ' is used on the current character and removed.' : '',
        (function () {
          const bl = blastRules();
          if (!bl || !bl.centre) return '';
          return 'A <b>bomb</b> is the one thing that damages a square rather than a target; when its fuse runs out it hands <b>' + srcNum(bl.centre) + '</b> to everything on its square, <b>' + srcNum(bl.edge) + '</b> to the four beside it and <b>' + srcNum(bl.corner) + '</b> to the four corners' + (bl.type && damageTypeName(bl.type.v) ? ', as ' + srcNum(bl.type, damageTypeName(bl.type.v)) + ' damage' : '') + '. A locked door whose strength is below a fifth of that drops to a strength of 1.';
        })()
      ].filter(Boolean) : [],
      rows.length ? table(['thing', 'when struck', 'says'], rows.map(r => '<tr><td>' + propChip(r.pt, r.name) + '</td><td>' + damageRowWords(r) + ' ' + srcNum({ resid: r.resid, at: r.at }, 'script') + '</td><td>' +
        (r.says.filter(s => s !== r.spills)[0] ? srcSaid([r.resid, 0xE49, 0xE4A], r.says.filter(s => s !== r.spills)[0]) : '') + '</td></tr>')) : '', '');
  }

  // ---- weapons and armour ----
  const gear = gearTable();
  const kind = r => r.melee ? 0 : r.thrown ? 1 : r.ranged ? 2 : r.ammo ? 3 : r.armour ? 4 : 5;
  gear.sort((a, b) => kind(a) - kind(b) || ((b.damage || 0) - (a.damage || 0)) || ((b.protection || b.block || 0) - (a.protection || a.block || 0)) || a.name.localeCompare(b.name));
  add('gear', 'Weapons and Armor', null, src('the classes', 0x1000),
    gear.length ? 'The combat figures of ' + gear.length + ' weapons, launchers, ammunition and armor.' : 'No item in this file has combat figures.',
    gear.length ? [
      'A blow that lands does a random amount from 1 to the <b>damage</b> figure. <b>Reach</b> and a launcher’s <b>range</b> work as under Combat.',
      gear.some(r => r.thrownDamage !== null) ? 'A character throws a weapon with a <b>thrown</b> figure for that damage, up to that <b>range</b>, when nothing they wield reaches the target.' : '',
      'A launcher fires the arrows or stones of its <b>ammunition class</b>.',
      'Armor gives <b>protection</b> in points; a shield <b>blocks</b> a random amount from 0 to its figure plus the Shield skill.'
    ].filter(Boolean) : [],
    table(['item', '#weight', '#damage', '#reach', '#thrown', '#range', '#type', 'skill', '#ammo class', '#protection', '#block'],
      gear.map(r => {
        const cell = (v, s) => v === null || v === undefined ? '<td class="num"></td>' : srcCell(s, v);
        return '<tr><td>' + propChip(r.pt, r.name, ['melee', 'thrown', 'ranged', 'ammunition', 'armor', 'shield'][kind(r)]) + '</td>' +
          cell(r.weight, r.src.weight) + cell(r.damage, r.src.damage) + cell(r.reach, r.src.reach) + cell(r.thrownDamage, r.src.thrown) + cell(r.thrownRange, r.src.thrown) +
          cell(r.type, r.src.type) + '<td>' + svEsc(r.skill) + '</td>' + cell(r.ammoClass, r.src.ammoClass) + cell(r.protection, r.src.protection) + cell(r.block, r.src.block) + '</tr>';
      })) +
    mechGearFigure(gear), '');

  // ---- the prop word and the two data bytes ----
  // The icon is tile 0x208, the flail: the picture no class owns that the
  // create-a-prop cheat reaches with a mace at aspect 8, which is how the
  // word came to be looked at. In another archive it is whatever is there.
  const pw = propWordRules();
  const pwName = pt => propDisplayName(pt) || ('prop 0x' + pt.toString(16).toUpperCase());
  const pwBuild = gear.find(r => r.melee) || gear[0] || null;
  const pwEx = pw.examines.length ? pw.examines[0] : null;
  const pwByByte = k => ({ r: pw.readers.filter(x => x.ops.includes('get ' + k)), w: pw.readers.filter(x => x.ops.includes('set ' + k)) });
  add('propword', 'Prop Records: Type, Aspect, Data1 and Data2', null, src('the outcome', 0xE87) + (pwEx ? src('Examine', 0x1000 + pwEx.pt) : ''),
    'Everything placed in the world is a prop record: a number saying what it is, and two values, Data1 and Data2, whose meaning depends on the kind of thing.',
    [
      'The number is <b>the type plus 1,024 times the aspect</b>. The create-a-prop cheat asks for it, then Data1 in decimal, then Data2 in hex.' +
        (pwBuild ? ' Any item’s page builds one under Prop record: ' + svLink(pwBuild.name, 'showItemDetail(' + pwBuild.pt + ')') + '.' : ''),
      'Aspect <i>n</i> draws the base tile plus <i>n</i>, and the prop <b>takes that tile’s name</b>. ' + mechAspectReaders(),
      mechAspectContrast(),
      pw.ench && pw.ench.guarded && pw.ench.added ? '<b>Data1 on a melee weapon is its enchantment</b>, added to the damage of every blow' +
        (pw.ench.magic ? '. <b>Any enchantment makes a blow magical</b>, which gets past monsters that resist ordinary weapons' : '') + '. Arrows and other ammunition ignore it.' : '',
      pwEx && pwEx.hiVal && pwEx.loVal ? 'Examine reports it on ' + pw.examines.map(e => pwName(e.pt)).join(', ') + ': ' + srcSaid(0x1000 + pwEx.pt, pwEx.above2) + ' above ' + srcNum(pwEx.hiVal) + ', ' + srcSaid(0x1000 + pwEx.pt, pwEx.above0) + ' above ' + srcNum(pwEx.loVal) + '.' : '',
      pw.zoneReaders.length ? '<b>Data3</b> is both bytes read as one value; ' + countLink(pw.zoneReaders.length + ' passage classes', 'The ' + pw.zoneReaders.length + ' passage classes that pass Data3 to ChangeZone', pw.zoneReaders.map(pt => svLink(pwName(pt), 'showPropTypeDetail(' + pt + ')'))) + ' pass it to ChangeZone as the destination.' : '',
      pw.scripts ? '<b>' + countLink(pw.scripts + ' scripts', 'The ' + pw.scripts + ' scripts that read or write Data1, Data2 or Data3', resChips(pw.scriptIds)) + '</b> read or write the bytes, ' + countLink(String(pw.readers.length), 'The ' + pw.readers.length + ' class scripts that read or write Data1, Data2 or Data3', resChips(pw.readers.map(r => r.resid))) + ' of them class scripts. What each byte means depends on the class.' : 'No script in this file reads the bytes.'
    ].filter(Boolean),
    (pw.placed.length ? '<div class="mechSub">Placed with an enchantment</div>' +
      table(['item', 'where', '#aspect', '#Data1'], pw.placed.map(r => '<tr><td>' + svLink(pwName(r.pt), 'showItemDetail(' + r.pt + ')') + '</td><td>' +
        svLink(zoneNameFor(r.resid) || ('0x' + r.resid.toString(16).toUpperCase()), 'showItemOnMap(' + (r.resid - 0x100) + ',' + r.pt + ')') +
        (r.carriedBy !== null && loadCharacterTable()[r.carriedBy] ? ', carried by ' + svLink(characterName(r.carriedBy), 'showCharacterDetail(' + r.carriedBy + ')') : '') + '</td>' + num(r.aspect) + num(r.d1) + '</tr>'))
      : '<div class="mechSub">Placed with an enchantment</div><div class="sv-note" style="margin-top:0">No melee weapon in a prop list carries a Data1.</div>') +
    '<div class="mechSub">Which class scripts read them</div>' +
    table(['byte', 'read by', 'written by'], ['data1', 'data2', 'data3'].map(k => { const b = pwByByte(k); return b.r.length || b.w.length
      ? '<tr><td>' + k.replace('data', 'Data') + '</td><td>' + b.r.map(x => svLink(pwName(x.pt), 'jumpToResource(' + x.resid + ')')).join(', ') + '</td><td>' + b.w.map(x => svLink(pwName(x.pt), 'jumpToResource(' + x.resid + ')')).join(', ') + '</td></tr>' : ''; })), '');

  // The spells are on the Spells sheet now (spellsMechSection in
  // js/delv-sheets.js), above the spells themselves.

  // ---- what a use can be aimed at ----
  {
    const tg = targetRules();
    const walk = appImage() ? exeWalkStub() : null;
    const byWord = new Map();
    for (const t of tg) { if (!byWord.has(t.word)) byWord.set(t.word, []); byWord.get(t.word).push(t); }
    const reach = tg.filter(t => t.word & 0x8000);
    const nameLink = t => srcNum(t.val, t.name);
    add('target', 'What a Use Can Be Aimed At', null, '',
      tg.length ? 'What each of the ' + tg.length + ' spells and items that ask for a target can aim at.'
                : 'No script in this file asks for a target.',
      tg.length ? [
        '<b>' + reach.length + '</b> of these need a target on your square or next to it' + (walk ? '; one further away is ' + srcNum(walk.at, 'refused') : '') + '.'
      ].filter(Boolean) : [],
      table(['#word', 'wants', 'asked for by'], [...byWord.entries()].sort((a, b) => (b[0] & 0x8000) - (a[0] & 0x8000) || a[0] - b[0]).map(([w, list]) =>
        '<tr><td class="num">' + propWordHex(w) + '</td><td>' + targetWordWords(w).map(svEsc).join(', ') + '</td><td>' +
        list.map(nameLink).join(', ') + '</td></tr>')),
      '');
  }

  // What each skill is asked about is on the Skills sheet now
  // (skillsMechSection in js/delv-sheets.js), beside the skills.

  // ---- experience and levels ----
  const xp = experienceRules();
  add('experience', 'Experience and Levels', null, src('every award', 0xE8B) + src('a new level', 0xE86),
    xp.rule ? 'Fighting and the deeds listed below earn experience, and enough of it raises a character’s level and with it their full health.' : 'This file has no experience script.',
    xp.rule ? [
      'A character gains experience' + (xp.rule.cap ? ', <b>capped at ' + srcNum(xp.rule.cap, xp.rule.cap.v.toLocaleString('en-US')) + '</b>' : '') +
        (xp.rule.doubling && xp.rule.base ? ', and the level rises by one when it passes <b>' + srcNum(xp.rule.base) + ' × 2 to the power of the level less ' + srcNum(xp.rule.less, xp.rule.less ? xp.rule.less.v : '') + '</b>: above ' +
          [2, 3, 4, 5, 6].map(l => mechLevelThreshold(l - 1, xp.rule.base.v).toLocaleString('en-US') + (l === 2 ? ' for level 2' : l < 5 ? ' for ' + l : '')).join(', ') + ', doubling.' : '.'),
      xp.rule.healthReflexDiv && xp.rule.healthMul && xp.rule.healthDiv ? 'At each new level, full health becomes <b>body + reflex ÷ ' + srcNum(xp.rule.healthReflexDiv) + ' + level, plus Defense × ' + srcNum(xp.rule.healthMul) + ' × reflex ÷ ' + srcNum(xp.rule.healthDiv) + '</b>, and full magic <b>mind + Mana</b>.' : '',
      xp.rule.defenseStandIn && xp.rule.manaStandIn ? (function () {
        const d = xp.rule.defenseStandIn, m = xp.rule.manaStandIn;
        return 'A character ' + srcNum(d.call, 'without Defense') + ' counts it as nothing, ' + srcNum(d.half, 'half their level') + ', ' + srcNum(d.same, 'their level') + ' or ' + srcNum(d.dbl, 'twice their level') +
          ', by ' + srcNum(d.bits, 'two bits of their record') + '; one ' + srcNum(m.call, 'without Mana') + ' counts it ' + srcNum(m.bits, 'the same way') + '. Most of the people who join have neither skill, so this is how they grow. Full health is kept in one byte, so a total above 255 starts again from 0.';
      })() : '',
      xp.rule.gapAdd ? 'A blow earns its damage in experience, at most the victim’s lead in levels plus ' + srcNum(xp.rule.gapAdd) + (xp.rule.pastGap ? '; against a lower-level victim, ' + srcNum(xp.rule.pastGap) : '') + '.' : '',
      'The party’s members split an award to the party.'
    ].filter(Boolean) : [],
    (xp.rule ? mechExperienceFigure(xp.rule) : '') +
    (xp.awards.length ? '<div class="mechSub">Fixed awards: ' + xp.awards.length + '</div>' + table(['#points', 'what the game says', 'where'], xp.awards.map(a => '<tr>' + srcCell(a.val, a.amount) + '<td>' + (a.note ? svEsc(a.note) : '<span class="inspDim">no message</span>') + '</td><td>' + svChip(a.resid) + '</td></tr>')) : ''), '');

  // ---- karma ----
  const km = karmaRules();
  const start = km.writes.find(w => w.set !== undefined);
  add('karma', 'Karma', null, src('a kill', 0xE8D),
    km.writes.length ? 'A number the game raises and lowers as you play, and checks at certain points.' : 'No script in this file changes karma.',
    km.writes.length ? [
      start ? 'It starts at <b>' + srcNum(start.val, start.set) + '</b> when you make a character.' : '',
      km.byAlignment ? 'A kill changes it by the victim’s alignment: <b>' + srcNum(km.byAlignmentSrc, km.byAlignment.map(v => (v > 0 ? '+' : '') + v).join(', ')) + '</b> for alignments 0 to ' + (km.byAlignment.length - 1) + '.' : '',
      /* Who has which alignment, off the character table (byte 25 of each
         record, the byte the kill table indexes), so the sentence above can
         say what a kill of a townsperson does. The board recorded killing
         NPCs raising karma as a bug (topic 2023); this is why. No script
         writes the field, and the application writes it only when a
         character is made and when one joins the party. */
      km.byAlignment ? (() => {
        const by = new Map();
        loadCharacterTable().forEach((c, i) => {
          if (!c || !c.raw || c.raw.every(b => !b) || i === 0) return;
          if (!by.has(c.raw[25])) by.set(c.raw[25], []);
          by.get(c.raw[25]).push(i);
        });
        const zero = by.get(0) || [], delta0 = km.byAlignment[0];
        if (!zero.length || delta0 === undefined) return '';
        const others = [...by.keys()].filter(a => a !== 0).sort((a, b) => a - b)
          .map(a => by.get(a).map(i => chipOf(i) || svEsc(characterName(i))).join(' ') + ' ' + (by.get(a).length === 1 ? 'has' : 'have') + ' ' + a);
        return '<b>' + countLink(zero.length + ' characters', 'The ' + zero.length + ' characters with alignment 0', zero.map(i => chipOf(i) || svLink(characterName(i), 'showCharacterDetail(' + i + ')'))) + ' have alignment 0</b>, every townsperson among them' + (others.length ? ', while ' + others.join(' and ') : '') +
          ', so <b>killing a townsperson ' + (delta0 > 0 ? 'raises karma by ' + srcNum(km.byAlignmentSrc, delta0) : delta0 < 0 ? 'lowers karma by ' + srcNum(km.byAlignmentSrc, -delta0) : 'leaves karma unchanged') + '</b>.';
      })() : '',
      km.reads.length ? 'The scripts check it <b>' + km.reads.filter((r, i, a) => a.findIndex(x => x.test === r.test) === i).map(r => (r.below ? 'below ' : 'above ') + srcNum(r.val, r.n)).join('</b> and <b>') + '</b>.' : ''
    ].filter(Boolean) : [],
    mechKarmaFigure(km) +
    table(['#change', 'occasion', 'where'], km.writes.filter(w => w.set === undefined).map(w => '<tr>' + (w.change !== null && w.change !== undefined ? srcCell(w.val, (w.change > 0 ? '+' : '') + w.change) : num(w.why || '')) + '<td>' + svEsc(w.note || '') + '</td><td>' + svChip(w.resid) + '</td></tr>')
      .concat(km.reads.map(r => '<tr><td class="num">' + (r.below ? 'below ' : 'above ') + srcNum(r.val, r.n) + '</td><td>' + svEsc(r.note || '') + '</td><td>' + svChip(r.resid) + '</td></tr>'))), '');

  // ---- food and potions ----
  const fd = foodRules();
  add('potions', 'Potions', null, src('the potion', 0x101F),
    fd.potions.length ? 'What each color of potion does.' : 'This file has no potions.',
    [],
    (fd.potions.length ? table(['potion', 'does', 'effect'], fd.potions.map(p => '<tr><td>' + svEsc(p.name) + '</td><td>' + p.effects.map(x => srcNum(x.src, x.text)).join('; ') + (p.says ? ' <span class="inspDim">' + srcSaid(p.resid, p.says) + '</span>' : '') + '</td><td>' + svChip(p.resid) + '</td></tr>')) : ''), '');
  add('food', 'Food', null, '',
    fd.foods.length ? 'Eating fills a character up, and each food fills by a different amount.' : 'This file has no food.',
    /* The fall, its period and the ceiling are Hunger's readers, so each
       figure links to the instruction or line it was read from. */
    fd.foods.length && hungerNotes().ceiling !== null && model ? (function () {
      const hn = hungerNotes(), mins = mechPeriodMinutes(model, model.hungerIndex);
      return ['Nutrition falls by ' + srcNum(clk.fall) + ' every ' + period(model.hungerIndex).replace(/^(<button[^>]*>)(an |a )?/, '$1') +
        (clk.fall.v === 1 && mins === 60 ? ', so a food’s nutrition is the hours it lasts' : '') + '. A full stomach holds <b>' + srcNum(hn.ceilingVal) + '</b>, about ' +
        Math.round(hn.ceiling * mins / clk.fall.v / 60 / 24) + ' days.'];
    })() : [],
    mechFoodTable(fd), '');

  // ---- status effects ----
  const st = statusRules();
  const statusNames = new Set([...st.applies.keys(), ...st.cures.keys()]);
  add('status', 'Status Effects', null, '',
    st.applies.size ? 'What gives each status, for how long in clock units' + (perHour ? ' (' + srcNum(clk.unitsPerHour) + ' to the hour)' : '') + ', and what cures it.' : 'No script in this file applies a status.',
    (function () {
      const rules = [];
      let cures = [], grants = [];
      try { cures = chanceCures(); } catch (e) { cures = []; }
      try { grants = grantRules(); } catch (e) { grants = []; }
      for (const c of cures) rules.push('<b>' + svEsc(c.name) + '</b> cures ' + svEsc(c.flag || 'a status') + ' only ' + srcNum(c.is, 'one time in ' + (c.hi.v - c.lo.v)) + '.');
      if (grants.length) rules.push('Some worn items give a status: ' + grants.map(g => svLink(g.name, 'showItemDetail(' + g.pt + ')') + ' ' + srcNum(g.flag, g.flagName || ('flag ' + g.flag.v))).join(', ') + '.');
      return rules;
    })(),
    mechStatusFigure(st, perHour) + table(['status', 'applied by', 'cleared by'], [...statusNames].sort().map(nm => '<tr><td>' + svEsc(nm) + '</td><td>' +
      (st.applies.get(nm) || []).map(a => svChip(a.resid) + (a.duration !== null ? ' <span class="inspDim">for</span> ' + srcNum(a.durationVal, a.duration) : '')).join(' ') + '</td><td>' +
      [...(st.cures.get(nm) || [])].map(r => svChip(r)).join(' ') + '</td></tr>')) +
    (function () {
      let grants = [];
      try { grants = grantRules(); } catch (e) { grants = []; }
      return grants.length ? '<div class="mechSub">Items that give a status</div>' +
        table(['thing', 'status', 'given by', 'taken away by'], grants.map(g => '<tr><td>' + propChip(g.pt, g.name) + '</td><td>' + srcNum(g.flag, g.flagName || ('flag ' + g.flag.v)) + '</td><td>' + svEsc(g.method) + '</td><td>' + (g.clearedBy ? svEsc(g.clearedBy) : '<span class="inspDim">nothing in the class</span>') + '</td></tr>')) : '';
    })() + (function () {
      // The party bar's background colours (exePartyColours): one row a
      // state, in the order the program tests them, the first that holds
      // winning.
      let pc = null;
      try { pc = appImage() ? exePartyColours() : null; } catch (e) { quiet(e, 'reading the party bar\u2019s colours'); }
      if (!pc) return '';
      const sw = n => '<span class="stateSwatch" style="background:#' + (PALETTE[n] || '000000') + '"></span>';
      const rows = pc.rows.map(r => '<tr><td>' + sw(r.colour.v) + ' ' + srcNum(r.colour) + '</td><td>' +
        (r.hunger ? 'hungry: nutrition below ' + (pc.hungry ? srcNum(pc.hungry) : 'a threshold') : (dvmFlagName(r.flag.v) || 'flag') + ' ' + srcNum(r.flag, 'flag ' + r.flag.v)) + '</td></tr>');
      if (pc.plain) rows.push('<tr><td>' + sw(0) + ' ' + srcNum(pc.plain) + '</td><td>none of these</td></tr>');
      return '<div class="mechSub">The Party Bar</div><p>A party member\u2019s figure is drawn on a colour that shows their state. The first of these that holds is the one shown.</p>' +
        table(['colour', 'when'], rows);
    })(), '');

  // ---- hunger, and healing with it ----
  // The fall and the healing are the application's, TGameViewer::DoTicks,
  // read by exeClockRules when the application is open; the scripts' side,
  // the complaint and the ceiling, off the archive.
  const hg = hungerNotes();
  add('hunger', 'Hunger and Healing', null, '',
    'Each character’s nutrition' + (hg.ceiling !== null ? ' runs from 0 to ' + srcNum(hg.ceilingVal) + '. It' : '') + ' falls as time passes, and a fed character slowly heals.' + (model ? '' : ' ' + noApp),
    [
      model ? 'Nutrition falls by ' + srcNum(clk.fall) + ' every ' + period(model.hungerIndex).replace(/^(<button[^>]*>)(an |a )?/, '$1') + ' for every character on the map.' : '',
      (hg.complains !== null ? 'A character complains of hunger below <b>' + srcNum(hg.complainsVal) + '</b>.' : ''),
      (function () {
        let pc = null;
        try { pc = appImage() ? exePartyColours() : null; } catch (e) { quiet(e, 'reading the party bar\u2019s hunger colour'); }
        return pc && pc.hungry ? 'A party member with nutrition below ' + srcNum(pc.hungry) + ' is drawn on grey in the party bar.' : '';
      })(),
      (hg.ceiling !== null ? (function () {
        // An item class script is named for its prop type, a spell for itself.
        const names = hg.ceilingBy.map(r => svLink((r >= 0x1000 && r < 0x1200 ? propDisplayName(r - 0x1000) : labelFor(r)) || ('0x' + r.toString(16).toUpperCase()), 'jumpToResource(' + r + ')'));
        return names.slice(0, -1).join(', ') + (names.length > 1 ? ' and ' : '') + names[names.length - 1] + ' only fill nutrition up to <b>' + srcNum(hg.ceilingVal) + '</b>. Other food adds the amounts listed above.';
      })() : ''),
      model && clk.healthBytes && clk.magicBytes ? 'While nutrition is above ' + srcNum(clk.fedGate, '0') + ', <b>health and magic each rise by 1</b> at a rate set by level: ' +
        Array.from({ length: model.levelCap + 1 }, (_, i) => {
          const lo = i << model.levelShift, hi = ((i + 1) << model.levelShift) - 1;
          return 'every ' + period(i).replace(/^(<button[^>]*>)(an |a )?/, '$1') + (i === model.levelCap ? ' from level ' + lo + ' up' : lo === hi ? ' at level ' + lo : ' at levels ' + lo + ' and ' + hi);
        }).join(', ') + '. Both stop at full.' : '',
      model ? 'At 0 there is no healing, but hunger does no damage.' : ''
    ].filter(Boolean),
    '<div class="mechStats">' + (hg.ceiling !== null ? '<span class="mechStat"><b>' + srcNum(hg.ceilingVal) + '</b> nutrition at most</span>' : '') +
      (model ? '<span class="mechStat"><b>' + srcNum(clk.fall) + '</b> each time ' + period(model.hungerIndex) + ' passes</span>' : '') +
      (model && hg.ceiling !== null ? stat('about ' + Math.round(hg.ceiling * mechPeriodMinutes(model, model.hungerIndex) / 60 / 24) + ' days', 'from full to empty') : '') + '</div>' +
    mechHungerFigure(hg.ceiling, model), '');

  // ---- locks ----
  const lk = lockRules();
  add('locks', 'Locks and Lockpicks', null, src('a key or a pick', 0xE43) + src('the lockpick', 0x1109),
    lk.rule ? 'A lock opens to its own key, or to a lockpick in skilled hands.' : 'This file has no lock script.',
    lk.rule ? [
      lk.rule.keyFits ? 'A key fits when the lock’s number matches the key’s.' : '',
      lk.rule.formula ? (function () {
        const n = lk.rule.numbers, up = n.addend.v === n.per.v - 1;
        return 'A pick opens the lock when the picker’s <b>reflex plus a random number from 0 to ' + srcNum(n.pickRoll, n.pickRoll.v - 1) + '</b> is at least <b>' + srcNum(n.base) + ' plus another random number from 0 to ' + srcNum(n.lockRoll, n.lockRoll.v - 1) +
          ' plus ' + srcNum(n.step) + ' for every ' + srcNum(n.per) + ' of the lock’s difficulty' + (up ? ', rounded up' : ' after adding ' + srcNum(n.addend)) + '</b>' + (lk.rule.breaks ? ', and <b>breaks</b> otherwise.' : '.') +
          (up ? ' So a difficulty of 1 counts as much as a difficulty of ' + n.per.v + '.' : '');
      })() : '',
      lk.needsSkill ? 'The lockpick cannot be used at all without the <b>Lock Picking</b> skill.' : '',
      (function () {
        // Whose reflex and whose skill: both scripts name the player
        // character rather than whoever holds the pick, which is what makes
        // a companion's picking depend on the player's own reflex.
        const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
        const h = dvmScriptEntry(0xE43), it = dvmScriptEntry(0x1109);
        const pcReflex = h && /global PlayerCharacter[\s\S]{0,120}get_field reflex/.test(strip(h.text));
        const pcSkill = it && /sys GetSkill\s+global PlayerCharacter/.test(strip(it.text));
        return pcReflex || pcSkill ? 'The reflex rolled is <b>the player character’s</b>' + (pcSkill ? ', and the lockpick asks the player character for the skill' : '') + ', whoever is holding the pick.' : '';
      })(),
      'Each lock in the world has a difficulty.'
    ].filter(Boolean) : [], mechLockFigure(lk),
    lk.classes.length ? '<span class="partsTitle">Lock parameter</span>' + lk.classes.map(c => propChip(c.pt, c.name) + ' ' + srcNum(c.src, c.words.join(' '))).join(' ') : '');

  // ---- shops ----
  const sh = shopRules();
  add('shops', 'Shops', null, src('the counter', 0xEA5),
    sh.shops.length ? sh.shops.length + ' shops, what each sells, and at what price.' : 'No script in this file opens a shop.',
    sh.shops.length ? ['Each vendor bargains down from the listed price by four figures set for each, under terms' + (sh.haggling ? '; <b>Haggling</b> takes off a further random amount from 0 to ' + srcNum(sh.haggling, sh.haggling.v - 1) : '') + '.'] : [],
    mechShopFigure(sh) +
    table(['vendor', 'goods, at the listed price in obols', '#terms'], sh.shops.map(spn => '<tr><td>' + (spn.who !== null && loadCharacterTable()[spn.who] ? characterChip(spn.who) : svChip(spn.resid)) +
      (spn.title ? '<div class="inspDim">“' + svEsc(spn.title) + '”</div>' : '') + '</td><td>' +
      spn.goods.map(g => svEsc(g.name) + ' <span class="mechPrice">' + srcNum(g.src, g.price) + (g.count > 1 ? ' for ' + g.count : '') + '</span>').join(', ') + '</td>' + (spn.terms ? srcCell(spn.termsSrc, spn.terms.join(' ')) : num('')) + '</tr>')), '');

  // ---- training ----
  const tr = trainingRules();
  add('training', 'Training', null, src('a lesson', 0xEB1),
    tr.teachers.length ? tr.teachers.length + ' teachers, and the skills each one teaches.' : 'No script in this file teaches a skill.',
    tr.teachers.length ? [
      'A lesson raises the skill one level' + (tr.points.perLesson !== null ? ' and costs <b>' + srcNum(tr.points.perLessonVal) + ' training point' + (tr.points.perLesson === 1 ? '' : 's') + '</b>' : '') + '.',
      (tr.points.atStart !== null ? 'A new character starts with <b>' + srcNum(tr.points.atStartVal) + '</b>' : '') + (tr.points.perLevel ? (tr.points.atStart !== null ? ' and gains ' : 'A character gains ') + '<b>' + srcNum(tr.points.perLevel) + ' less the difficulty level</b> with each level' : '') + '.',
      tr.points.mastery !== null ? 'A character masters a skill at level <b>' + srcNum(tr.points.masteryVal) + '</b>; a teacher marked <i>to mastery</i> can teach beyond the first lessons.' : ''
    ].filter(Boolean) : [],
    mechTrainingFigure(tr) +
    table(['teacher', 'teaches'], tr.teachers.map(t => '<tr><td>' + (t.who !== null && loadCharacterTable()[t.who] ? characterChip(t.who) : svChip(t.resid)) + '</td><td>' +
      [...t.skills.entries()].sort((a, b) => a[0] - b[0]).map(([id, m]) => (refExists(0x1A00 + id) ? partChip(selfNameFor(0x1A00 + id) || ('skill 0x' + id.toString(16)), 0x1A00 + id) : 'skill 0x' + id.toString(16)) + (m ? ' <span class="inspDim">to mastery</span>' : '')).join(' ') + '</td></tr>')), '');

  // The talk balloons are on the Barks sheet now (balloonsMechSection
  // in js/delv-sheets.js), above the words themselves.

  // ---- sleep ----
  const sl = sleepRules();
  add('sleep', 'Sleeping', null, src('the bed', 0x100E) + src('the night', 0xE93),
    sl ? 'How much a night in each bed heals.' : 'This file has no beds, or no sleep script.',
    sl ? [
      sl.own !== null ? 'Your own bed in Land King Hall has quality <b>' + srcNum(sl.ownVal) + '</b>. An inn’s bed has the quality of the room you paid for, and cannot be used until you pay.' : '',
      sl.quarter && sl.hours ? 'The night passes <b>' + srcNum(sl.quarterVal) + ' clock units at a time</b>' + (perHour && sl.quarterVal.v * sl.hoursVal.v === perHour ? ', a ' + (sl.hoursVal.v === 4 ? 'quarter' : '1/' + sl.hoursVal.v) + ' of an hour' : '') + (sl.owner ? ', and if the bed’s owner turns up they throw you out (' + srcQuote(sl.owner) + ')' : '') + '.' : '',
      sl.half ? 'Above quality 0' + (sl.soundly ? ' (' + srcQuote(sl.soundly) + ')' : '') + ', the party also gets <b>what they healed overnight times the quality ÷ ' + srcNum(sl.div) + '</b>, in health and magic.' + (sl.own !== null ? ' <b>Quality ' + sl.own + ' is ' + (1 + sl.own / sl.div.v) + ' times the game’s rate.</b>' : '') : '',
      sl.toss ? 'Quality 0 is ' + srcQuote(sl.toss) + ', the usual rate only.' : '',
      sl.magicGuard || sl.magicCap ? 'Because of a bug the game caps the magic bonus at ' + srcNum(sl.magicGuard || sl.magicCap, 'full health') + ', so a character can wake with more magic than their maximum.' : ''
    ].filter(Boolean) : [],
    (sl ? mechSleepFigure(sl, model) : '') +
    (sl && sl.div && sl.inns.length ? table(['bed', 'where', '#quality', 'healing'], [(sl.own !== null ? '<tr><td>your own</td><td>Land King Hall</td>' + srcCell(sl.ownVal) + '<td>× ' + (1 + sl.own / sl.div.v) + '</td></tr>' : '')].concat(
      sl.inns.map(x => '<tr><td>' + (loadCharacterTable()[x.who] ? characterChip(x.who) : 'character ' + x.who) + '</td><td>' + svEsc((loadCharacterTable()[x.who] && zoneDisplayName(loadCharacterTable()[x.who].zone)) || '') + '</td>' + srcCell(x.qualitySrc, x.quality) + '<td>' + (x.quality !== null ? '× ' + (1 + x.quality / sl.div.v) : '') + '</td></tr>'))) : ''), '');

  // ---- the clock ----
  {
    const costs = appImage() ? exeActionCosts() : [];
    // What a cast spends in time, for the rule below. The spells card moved
    // to the Spells sheet on 13 September 2026 and took its `sp` with it,
    // but the clock still states the cost, so it reads the casting rule for
    // itself; spellRules walks the memoised script-text index.
    const sp = spellRules();
    // A routine's name in two halves, the method and its class; the
    // arguments only where the class has two of the method.
    const nameHalves = r => {
      const p = r.name.indexOf('('), base = p >= 0 ? r.name.slice(0, p) : r.name, cut = base.lastIndexOf('::');
      const method = cut >= 0 ? base.slice(cut + 2) : base;
      const twice = costs.filter(c => c.routine.name.startsWith(base + '(')).length > 1;
      return { method: method + (twice && p >= 0 ? r.name.slice(p) : ''), cls: cut >= 0 ? base.slice(0, cut) : '' };
    };
    const flagWords = (bit) => { const f = clk && clk.statusWord ? exeFlagOfStatusBit(bit, clk.statusWord.v) : null; return f ? ' (flag ' + srcNum(f) + (dvmFlagName(f.v) ? ', ' + svEsc(dvmFlagName(f.v)) : '') + ')' : ''; };
    add('clock', 'The Clock, Poison and Time', null, '',
      model ? 'The game counts time in units of <b>1/' + srcNum(clk.unitsPerHour) + ' of an hour</b>, and measures every duration in them.'
        : 'The game keeps one clock, and measures every duration in it. ' + noApp,
      model ? [
        'Things happen every ' + clk.table.v.map((u, i) => srcNum(clk.table, u) + ' <span class="inspDim">(' + exeClockWords(u, perHour) + ')</span>').join(', ') + '.',
        clk.poisonBit && clk.regenBit && clk.deathAt && clk.statusWord ? 'Every ' + period(model.poisonIndex).replace(/^(<button[^>]*>)(an |a )?/, '$1') + ', a <b>poisoned</b> character' + flagWords(clk.poisonBit) + ' loses ' + srcNum(clk.poisonStep) + ' health, and <b>dies</b> once health is ' + srcNum(clk.deathAt) + ' or less. A character with <b>regeneration</b>' + flagWords(clk.regenBit) + ' gains ' + srcNum(clk.regenStep) + '. One with both gets ' + srcNum(clk.coinToss, 'one or the other at random') + '.' : '',
        clk.lighting && clk.schedules && clk.quarterShift ? 'The light changes every ' + srcNum(clk.lighting, exeClockWords(1 << clk.quarterShift.v, perHour)) + ', and the schedules every ' + srcNum(clk.schedules, 'hour') + '.' : '',
        sp.rule && sp.rule.timing ? 'A spell takes ' + srcNum(sp.rule.timeBase) + ' plus ' + srcNum(sp.rule.timeMult) + ' times its level in clock units. Monsters move while that time passes.' : ''
      ].filter(Boolean) : [],
      (costs.length ? '<div class="mechSub">The time each command takes</div>' +
        table(['#units', 'spent by'], costs.slice().sort((a, b) => (a.cost ? a.cost.v : 1e9) - (b.cost ? b.cost.v : 1e9)).map(c => '<tr>' + (c.cost ? srcCell(c.cost) : srcCell(c.call, 'varies')) + '<td>' + svLink(nameHalves(c.routine).method, 'jumpToExeAt(' + c.call.exe + ')') + ' <span class="inspDim">' + svEsc(nameHalves(c.routine).cls) + '</span></td></tr>')) : '') +
      mechClockFigure(sp, clk, costs), '');
  }

  // ---- the ground ----
  {
    const tn = terrainRules();
    const swamp = tn && tn.swamp, lava = tn && tn.lava;
    const grantsOf = flag => { let g = []; try { g = grantRules().filter(x => x.flag && x.flag.v === flag); } catch (e) { g = []; } return g; };
    const wearers = flag => { const g = grantsOf(flag).map(x => svLink(x.name, 'showItemDetail(' + x.pt + ')')); return g.length > 1 ? g.slice(0, -1).join(', ') + ' or ' + g[g.length - 1] : g.join(''); };
    add('ground', 'Swamp and Lava', null, src('the ground', 0x301F),
      tn ? 'Swamp bites now and then; lava burns on every step.'
         : 'This file has no ground script.',
      tn ? [
        swamp ? 'On <b>' + srcNum(swamp.from, 'swamp') + '</b>, one step in ' + srcNum(swamp.chance ? swamp.chance.is : null, swamp.chance ? (swamp.chance.hi.v - swamp.chance.lo.v) : '') +
          ' brings ' + srcSaid(0x301F, swamp.says) + ', ' + (swamp.poisonName ? svEsc(swamp.poisonName) : 'a status') + ' and ' + srcNum(swamp.damage) + ' ' + srcNum(swamp.type, damageTypeName(swamp.type.v) || 'damage') + (damageTypeName(swamp.type.v) ? ' damage' : '') + '.' +
          (swamp.flag ? ' ' + (wearers(swamp.flag.v) ? 'Wearing ' + wearers(swamp.flag.v) + ' ' + srcNum(swamp.flag, 'stops the bites') : srcNum(swamp.flag, swamp.flagName || 'A flag') + ' stops the bites') + ', and so does a monster’s immunity.' : '') : '',
        lava ? 'On <b>' + srcNum(lava.code, 'lava') + '</b>, every step brings ' + srcSaid(0x301F, lava.says) + ' and <b>' + srcNum(lava.plus, rollWords([lava.roll.lo.v, lava.roll.hi.v]).replace('a random number from ', '') + ' plus ' + lava.plus.v) + '</b> ' + srcNum(lava.type, damageTypeName(lava.type.v) || 'damage') + (damageTypeName(lava.type.v) ? ' damage' : '') + '.' +
          (lava.flag ? ' ' + (wearers(lava.flag.v) ? 'Wearing ' + wearers(lava.flag.v) + ' ' + srcNum(lava.flag, 'protects') : srcNum(lava.flag, lava.flagName || 'A flag') + ' protects') + '.' : '') : '',
        'Armor does not reduce either.'
      ].filter(Boolean) : [], '', '');
  }

  // ---- light ----
  // The two halves of the lighting model, and the zone table read out of the
  // entry scripts rather than written here. The viewer-relative half is
  // stated but not tabulated: it has no value without a square to stand on,
  // and inspectMapSquare is where a square exists.
  {
    const rows = [];
    for (let n = 0; n < 256; n++) {
      const resid = 0x8000 + n;
      let ok = false; try { ok = refExists(resid); } catch (e) { ok = false; }
      if (!ok) continue;
      const lvl = zoneAmbientLevel(resid);
      if (lvl === null) continue;
      rows.push({ resid, name: zoneNameFor(resid) || editorZoneName(resid) || ('zone ' + n), lvl,
                  night: ambientBase(lvl, 0), noon: ambientBase(lvl, 12) });
    }
    rows.sort((a, b) => a.night - b.night || a.lvl - b.lvl || a.name.localeCompare(b.name));
    const fixed = rows.filter(r => r.lvl < 0).length;
    // The zone opens its map, the level its line in the entry script, and
    // the cap the one constant TViewer::AmbientLight loads (the maintainer,
    // 3 October 2026: the section linked nothing). The base columns are
    // worked from those two, so they are not links of their own.
    const at = DERIVED.ZONE_AMBIENT_AT || {};
    let cap = null;
    if (appImage()) try { const ao = exeOpsNamed('TViewer::AmbientLight'), ci = exeFind(ao, 0, ao.length, d => d.mn === 'li'); cap = ci >= 0 ? exeVal(ao[ci], ao[ci].d.imm) : null; } catch (e) { quiet(e); }
    const body = rows.map(r => '<tr><td>' + svLink(r.name, 'jumpToResource(' + r.resid + ')') + '</td>' + srcCell(at[r.resid] || null, r.lvl) +
      '<td class="num">' + r.night + '</td><td class="num">' + r.noon + '</td></tr>').join('');
    if (rows.length) add('light', 'Light', null, '',
      'How dark each place is, and how lights brighten it.' + (cap ? ' The level runs from 0, drawn black, to ' + srcNum(cap) + ', not darkened at all.' : ''),
      [
        countLink(String(fixed), 'The ' + fixed + ' zones equally dark at every hour', rows.filter(r => r.lvl < 0).map(r => svLink(r.name, 'jumpToResource(' + r.resid + ')'))) + ' of the ' + rows.length + ' zones, the indoor ones, are equally dark at every hour; the rest follow the daylight.',
        '<b>Every light within five tiles brightens the whole screen</b>, brighter and nearer ones more, and light passes through walls.',
        'The map’s lighting layer shows each zone’s level and each light. Select a square to see how dark it is from where you stand.'
      ],
      '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>zone</th><th>sets</th><th>base at night</th><th>base at noon</th></tr></thead><tbody>' +
      body + '</tbody></table></div>', '');
  }

  // ---- springs and fountains ----
  {
    const wt = springRules();
    const kindWords = k => {
      const bits = [];
      if (k.food) bits.push('nutrition ' + srcNum(k.food.plus, '+' + k.food.plus.v) + (k.food.below ? ' below ' + srcNum(k.food.below) : ''));
      if (k.heal) bits.push('health ' + srcNum(k.heal.lo, rollWords([k.heal.lo.v, k.heal.hi.v]).replace('a random number from ', '+')));
      if (k.hurt) bits.push(srcNum(k.hurt.plus, rollWords([k.hurt.lo.v, k.hurt.hi.v]).replace('a random number from ', '') + ' plus ' + k.hurt.plus.v) + ' damage');
      for (const s of k.sets) bits.push(srcNum(s.val, s.name || ('flag ' + s.val.v)));
      if (k.clears.length) bits.push('clears ' + k.clears.map(c => srcNum(c.val, c.name || ('flag ' + c.val.v))).join(', '));
      if (k.wish) bits.push('a wish' + (k.chance ? ', one drink in ' + srcNum(k.chance.is, k.chance.hi.v - k.chance.lo.v) : ''));
      return bits.join('; ');
    };
    const where = k => {
      const list = (wt && wt.placed.get(k)) || [];
      const byZone = new Map();
      for (const p of list) { const n = zoneNameFor(p.zone) || ('0x' + p.zone.toString(16).toUpperCase()); byZone.set(n, (byZone.get(n) || 0) + 1); }
      return [...byZone.entries()].map(([n, c]) => svEsc(n) + (c > 1 ? ' ×' + c : '')).join(', ');
    };
    add('springs', 'Springs and Fountains', null, src('the water', 0x1036),
      wt ? 'What each kind of water does when you drink it.'
         : 'This file has no fountains.',
      wt ? [
        wt.gate && wt.setter ? 'One kind changes during the game; it is brackish, sometimes poisonous, until you pick up ' +
          svLink(wt.setter.name, wt.setter.pt !== null ? 'showItemDetail(' + wt.setter.pt + ')' : 'jumpToResource(' + wt.setter.resid + ')') + ', and fresh, sometimes reviving, after that.' : '',
        'A drink affects the character who uses the fountain.'
      ].filter(Boolean) : [],
      wt ? table(['#kind', 'says', 'does', 'where it stands'], wt.kinds.map(k => '<tr>' + srcCell(k.val) + '<td>' + (k.says[0] ? srcSaid(0x1036, k.says[0]) : '') + '</td><td>' + kindWords(k) + '</td><td>' + where(k.kind) + '</td></tr>')) : '', '');
  }

  // ---- the combat AI ----
  {
    const app = window.APP_RSRC;
    const lists = [[9304, 'Tests'], [9305, 'Actions'], [9303, 'Modifiers'], [9307, 'Scenario tests'], [9308, 'Scenario actions'], [9320, 'Health states'], [502, 'Strategies']];
    const rows = [];
    if (app) for (const [id, what] of lists) { const l = forkStringList(app, id); if (l && l.length) rows.push('<tr><td>' + svEsc(what) + '</td><td>' + l.map(svEsc).join(', ') + '</td></tr>'); }
    const testIds = buildScriptTextIndex().filter(e => e.resid >= 0x901 && e.resid < 0x981).map(e => e.resid), actIds = buildScriptTextIndex().filter(e => e.resid >= 0x981 && e.resid < 0xA00).map(e => e.resid);
    const tests = testIds.length, acts = actIds.length;
    add('combatai', 'Combat AI', null, '',
      'Monsters fight by scripts written in a small set of words: tests about the battle, actions to take, and strategies that choose between them.',
      [
        (tests || acts) ? 'This file adds <b>' + countLink(tests + ' tests', 'The ' + tests + ' combat AI tests this file adds', resChips(testIds)) + '</b> and <b>' + countLink(acts + ' actions', 'The ' + acts + ' combat AI actions this file adds', resChips(actIds)) + '</b>.' : '',
        'The scripts and the guide to writing them, the AI Scripting Document, come with the game. Both are under Data › Combat AI when the installer is open.'
      ].filter(Boolean),
      rows.length ? table(['list', 'words'], rows) : '<div class="sv-note">' + (app ? 'None of the lists is in this resource fork.' : 'Open the game from its installer, under Settings, to read the vocabulary from the program.') + '</div>',
      /* Through Components first: the compiled scripts in subindex 3 and the
         scenario's tests and actions in 8 are what the engine runs, and the
         .ai text under Data is what they were compiled from. */
      '<span class="partsTitle">In the file</span>' +
        relChip({ js: "showCategory('3')", main: 'Combat scripts', sub: 'compiled', title: trailForResid(0x400) }) +
        relChip({ js: "showCategory('8')", main: 'Tests and actions', sub: 'from the scenario', title: trailForResid(0x900) }) +
        relChip({ js: "showCategory('AIRULES')", main: 'Combat AI', sub: 'the .ai files', title: 'Data › Combat AI' }));
  }

  // ---- the To Do list ----
  {
    const td = todoRules();
    const nameOf = rid => labelFor(rid) || propWordHex(rid);
    const slots = new Map();
    const slot = v => { if (!slots.has(v)) slots.set(v, { adds: [], dones: [] }); return slots.get(v); };
    for (const a of td.adds) slot(a.slot.v).adds.push(a);
    for (const d of td.dones) slot(d.slot.v).dones.push(d);
    const elsewhere = td.adds.filter(a => !a.state && a.line.v !== a.slot.v);
    const counted = td.adds.filter(a => a.state);
    const never = [...slots.keys()].filter(s => slots.get(s).adds.length && !slots.get(s).dones.length).sort((a, b) => a - b);
    const rows = [...slots.keys()].sort((a, b) => a - b).map(s => {
      const g = slots.get(s);
      const line = td.lines ? (td.lines.get(s) || '') : '';
      const who = g.adds.map(a => srcNum(a.slot, nameOf(a.resid)) +
        (a.state ? ' <span class="mechSub">(counted)</span>' : a.line.v !== s ? ' <span class="mechSub">as ' + a.line.v + '</span>' : '')).join(', ');
      const off = g.dones.map(d => srcNum(d.slot, nameOf(d.resid))).join(', ');
      return '<tr>' + num(s) + '<td>' + svEsc(line) + '</td><td>' + who + '</td><td>' + (off || '<span class="mechSub">never</span>') + '</td></tr>';
    });
    add('todo', 'The To Do List', null, td.textResid !== null ? src('the lines', td.textResid) : '',
      td.adds.length ? 'Every line of the To Do window, who adds it and who strikes it off. A script can strike a line off before you finish its task, or never.'
                     : 'No script in this file writes a To Do line.',
      td.adds.length ? [
        '<b>' + td.adds.length + ' lines added</b> and <b>' + td.dones.length + ' struck off</b>, over <b>' + slots.size + ' slots</b>.',
        elsewhere.length ? '<b>' + elsewhere.length + ' of them show a different line</b> from the slot’s: the same errand, in the words of whoever told you about it.' : '',
        counted.length ? 'Some lines count what you have found so far: ' + counted.map(a => srcNum(a.state, nameOf(a.resid))).join(', ') + '.' : '',
        never.length ? '<b>' + never.length + (never.length === 1 ? ' line is' : ' lines are') + ' never struck off</b> by any script: ' + never.map(s => srcNum(slots.get(s).adds[0].slot, td.lines && td.lines.get(s) ? '“' + td.lines.get(s) + '”' : 'slot ' + s)).join(', ') + '.' : ''
      ].filter(Boolean) : [],
      table(['#slot', 'line', 'added by', 'struck off by'], rows));
  }

  // ---- the character flags, and where they are set ----
  {
    const cf = characterFlagSites();
    const link = s => srcNum({ resid: s.resid, at: s.at }, labelFor(s.resid) || propWordHex(s.resid));
    const cell = (list, what) => {
      if (!list.length) return '<td></td>';
      const seen = new Map(); for (const s of list) if (!seen.has(s.resid)) seen.set(s.resid, s);
      const u = [...seen.values()];
      return '<td>' + u.slice(0, 4).map(link).join(', ') + (u.length > 4 ? ' and ' + countLink((u.length - 4) + ' more', 'The ' + u.length + ' scripts that ' + what, u.map(link)) : '') +
        (list.length > u.length ? ' <span class="mechSub" style="display:inline">(' + list.length + ' sites)</span>' : '') + '</td>';
    };
    const place = f => { const p = characterFlagPlace(f); return p ? srcNum(p.offset, (p.word ? 'halfword' : 'byte') + ' +' + p.offset.v) + ', bit ' + p.bit : ''; };
    const flags = new Set(cf.flags.map(f => f.flag));
    { const pn = programNames(); if (pn && pn.flags) for (const k of Object.keys(pn.flags)) flags.add(+k); }
    const rows = [...flags].sort((a, b) => a - b).map(f => {
      const s = cf.flags.find(x => x.flag === f) || { set: [], clear: [], test: [], effect: [] };
      return '<tr>' + num(f) + '<td>' + (dvmFlagName(f) ? svEsc(dvmFlagName(f)) : '') + '</td><td>' + place(f) + '</td>' +
        cell(s.set, 'set character flag ' + f) + cell(s.clear, 'clear character flag ' + f) + cell(s.test, 'test character flag ' + f) + cell(s.effect, 'give character flag ' + f + ' as a status') + '</tr>';
    });
    add('charflags', 'The Character Flags', null, src('set', 0xF00) + src('clear', 0xF01) + src('test', 0xF02),
      'The on/off flags each character carries, such as poison, sleep and fear, and the scripts that set, clear and check each one.',
      [
        '<b>' + cf.flags.length + ' flags</b> are used by the scripts. A named flag no script uses is one the program sets itself.',
        appImage() ? '' : MECH_NO_APP
      ].filter(Boolean),
      table(['#flag', 'name', 'in the record', 'set by', 'cleared by', 'tested by', 'as an effect'], rows));
  }

  // ---- ClassFlags, bit by bit, and the per-class cache ----
  {
    const cb = classFlagBits();
    const ic = appImage() ? exeIntfCache() : null;
    const readers = ic ? exeTocReaders(ic.cacheDisp.v) : [];
    const whoLink = w => svLink(propDisplayName(w.pt) || ('prop ' + w.pt), 'showPropTypeDetail(' + w.pt + ')');
    const who = (list, bit) => list.slice(0, 14).map(whoLink).join(', ') + (list.length > 14 ? ' and ' + countLink((list.length - 14) + ' more', 'The ' + list.length + ' classes that carry class flag ' + propWordHex(bit), list.map(whoLink)) : '');
    // The routines that test a cache bit, each linked at the instruction.
    const testedBy = bit => {
      const hits = [];
      for (const r of readers) for (const m of r.masks) if ((m.mask & bit) === bit && !hits.some(h => h.routine === r.routine)) hits.push({ routine: r.routine, at: m.at });
      return hits.length ? hits.map(h => srcNum({ exe: h.at }, h.routine)).join(', ') : '<span class="mechSub" style="display:inline">nothing reads this switch within twenty-four instructions of a load</span>';
    };
    const keyName = k => (DVM_SYM.method[String(k)] ? prettyLabel(DVM_SYM.method[String(k)]) : 'key ' + k);
    const rows = cb.bits.map(b => {
      const moved = ic && ic.bits.find(x => x.key === 39 && x.mask && x.mask.v === b.bit);
      return '<tr><td class="num">' + propWordHex(b.bit) + '</td>' + num(b.who.length) + '<td>' + who(b.who, b.bit) + '</td>' +
        (ic ? '<td>' + (moved ? srcNum(moved.cacheBit, propWordHex(moved.cacheBit.v)) : '<span class="mechSub" style="display:inline">not copied</span>') + '</td><td>' + (moved ? testedBy(moved.cacheBit.v) : '') + '</td>' : '') + '</tr>';
    });
    const hasRows = ic ? ic.has.map(h => '<tr><td>' + srcNum({ exe: h.keyOp.at }, keyName(h.key)) + '</td><td class="num">' + srcNum(h.cacheBit, propWordHex(h.cacheBit.v)) + '</td><td>' + testedBy(h.cacheBit.v) + '</td></tr>') : [];
    const stackRows = ic ? ic.bits.filter(x => x.key !== 39).map(x => '<tr><td>' + keyName(x.key) + (x.tag ? ', not a plain number' : ' bit ' + propWordHex(x.mask.v)) + '</td><td class="num">' + srcNum(x.cacheBit, propWordHex(x.cacheBit.v)) + '</td><td>' + testedBy(x.cacheBit.v) + '</td></tr>') : [];
    const seat = ic ? exeSeatRule() : null;
    const tableRows = ic ? ic.tables.map(t => { const rs = exeTocReaders(t.disp.v).filter((x, i, a) => a.findIndex(y => y.routine === x.routine) === i); return '<tr><td>' + srcNum({ exe: t.keyOp.at }, keyName(t.key)) + (t.plusOne ? ' plus one' : '') + '</td><td>' + (t.width === 1 ? 'one byte' : 'two bytes') + ' for each class, ' + srcNum(t.disp, 'at ' + t.disp.v + ' off the TOC') + '</td><td>' + (rs.length ? rs.map(r => srcNum({ exe: r.at }, r.routine)).join(', ') : '') +
      (t.key === 34 && seat ? '<br><span class="mechSub" style="display:inline">which seats a ' + srcNum(seat.facings, seat.facings.v + '-way') + ' sprite standing on it: a value of 0 uses the seat’s aspect as the direction faced, and ' + srcNum(seat.ownAspect, 'column three') + ' as the pose; 1 to 4 are frames ' + seat.fixed.map(f => srcNum(f, String(f.v))).join(', ') + ', north, east, south, west</span>' : '') +
      (t.key === 55 && seat ? '<br><span class="mechSub" style="display:inline">its first value is the number of directions the sprite can face; the seating check requires ' + srcNum(seat.facings, String(seat.facings.v)) + '</span>' : '') + '</td></tr>'; }) : [];
    add('classflags', 'Class Flags', null, '',
      'On/off switches on a kind of thing, such as a door, a key or a chair, that only the program reads. ' + countLink(cb.classes + ' classes', 'The ' + cb.classes + ' classes that carry class flags', cb.carriers.map(pt => svLink(propDisplayName(pt) || ('prop 0x' + pt.toString(16).toUpperCase()), (isInventoryItem(pt) ? 'showItemDetail(' : 'showPropTypeDetail(') + pt + ')'))) + ' carry them; an item’s page shows them under Class data.',
      [
        ic ? (() => {
          const bitRef = m => (ic.bits.find(x => x.key === 39 && x.mask && x.mask.v === m) || { cacheBit: null }).cacheBit;
          const say = (m, text) => { const b = bitRef(m); return b ? srcNum(b, propWordHex(m)) + ' ' + text : propWordHex(m) + ' ' + text; };
          return say(0x80, 'lets a character walk onto the square (the doors, the passthrough, the curtain).') + ' ' +
            say(0x08, 'means you cannot drop a thing (the key, the grimoire, the amulet).') + ' ' +
            say(0x200, 'puts a door back open or shut as the zone starts it, each time you enter; its lock stays as it is. The map’s door mark shows it.') + ' ' +
            /* Read on 6 October 2026, when the maintainer asked what the
               rest do. TGameViewer::DoTicks runs down byte 6 of each
               placed record of a class with the bit, by how often one of
               the clock's periods has passed, and sends the thing message
               260 at nothing; the lights use one period and the hourglass
               and the bomb a shorter one. TGameSys::SlideItemCommand sets
               a slid chair's aspect from the direction of the slide.
               TGameSys::DropCommand sends method 25 to a thing dropped
               more than a square away (dx*dx + dy*dy over 2), and the
               default method 25 (0x3019) deletes a thing whose class has
               0x10. 0x100 is not in the copy: DoTicks asks each placed
               thing's class for the word itself on the hour and sends
               message 257 to one that has it, which the lamp post
               answers by lighting or going out and the easel by changing
               its picture. */
            say(0x20, 'is a light that burns down as time passes (the torch, the lamp, the candle).') + ' ' +
            say(0x800, 'counts down the same way, faster (the hourglass, the bomb).') + ' ' +
            say(0x40, 'turns a thing to face the way you push it (the chair).') + ' ' +
            say(0x10, 'breaks a thing dropped more than a square away (the plate, the glass, the bell).') + ' ' +
            say(0x100, 'tells a thing each time the hour changes (the lamp post, which lights at night, and the easel).');
        })() : MECH_NO_APP,
        ic ? 'The last table below says how a chair seats a character, and the zone maps seat their people by it.' : ''
      ].filter(Boolean),
      '<div class="mechSub">The switches</div>' +
      table(ic ? ['#switch', '#classes', 'carried by', 'in the copy as', 'read by'] : ['#switch', '#classes', 'carried by'], rows) +
      (hasRows.length ? '<div class="mechSub">Entries a class has or has not</div>' + table(['entry', '#in the copy as', 'read by'], hasRows) : '') +
      (stackRows.length ? '<div class="mechSub">Other rows moved into the copy</div>' + table(['from', '#in the copy as', 'read by'], stackRows) : '') +
      (tableRows.length ? '<div class="mechSub">The four numbers kept beside it</div>' + table(['from', 'kept as', 'read by'], tableRows) : ''));
  }

  // ---- the syscalls, by the program's own names ----
  {
    const st = appImage() ? exeSyscallTable() : null;
    // How often each is called in this archive, by delvmod's name in the listings.
    const counts = new Map();
    for (const e of buildScriptTextIndex()) for (const m of e.text.matchAll(/^\s+[0-9A-F]+\s+sys (\S+)/gm)) counts.set(m[1], (counts.get(m[1]) || 0) + 1);
    const rows = st ? st.entries.filter(x => x.name || DVM_SYM.syscall[String(x.op)]).map(x => {
      const dv = DVM_SYM.syscall[String(x.op)] || '';
      const a = x.name ? x.name.replace(/^cb/i, '').toLowerCase() : '', b = dv.toLowerCase();
      const same = a && b && (a === b || a.startsWith(b) || b.startsWith(a));
      return '<tr><td class="num">' + propWordHex(x.op) + '</td><td>' + svEsc(dv) + '</td><td>' + (x.name ? pefChip(x.name) : '<span class="mechSub" style="display:inline">no routine</span>') +
        (x.name && dv && !same ? ' <span class="mechSub" style="display:inline">differs</span>' : '') + '</td>' + num(counts.get(dv) || 0) + '</tr>';
    }) : [];
    const differ = st ? st.entries.filter(x => { const dv = DVM_SYM.syscall[String(x.op)]; if (!x.name || !dv) return false; const a = x.name.replace(/^cb/i, '').toLowerCase(), b = dv.toLowerCase(); return !(a === b || a.startsWith(b) || b.startsWith(a)); }).length : 0;
    add('syscalls', 'Built-In Calls', null, '',
      st ? 'The calls a script makes to the program, by the names the program and the listings use.'
         : MECH_NO_APP,
      st ? [
        '<b>' + st.entries.filter(x => x.name).length + ' of the 96 slots</b> point to a named part of the program. ' + (differ ? '<b>' + differ + '</b> have a different name in the listings.' : 'Every name agrees with the listings’.'),
      ] : [],
      table(['#opcode', 'in the listings', 'the program’s routine', '#calls here'], rows));
  }

  // ---- what an egg does ----
  {
    const eg = eggKinds();
    // The dispatch table, read off DrawRoutine when the application is
    // open: each kind's handler address and what it calls, beside the words
    // this page gives the kind.
    const eh = appImage() ? exeEggHandlers() : null;
    const handlerCell = kind => {
      const h = eh && eh.handlers[kind];
      if (!h || h.at === null) return '<td></td>';
      if (h.nothing) return '<td>' + srcNum({ exe: h.at }, propWordHex(h.at)) + ' <span class="mechSub" style="display:inline">the loop’s end: nothing</span></td>';
      return '<td>' + srcNum({ exe: h.at }, propWordHex(h.at)) +
        (h.calls.length ? ' <span class="mechSub" style="display:inline">calls ' + h.calls.map(c => srcNum({ exe: c.at }, c.name)).join(', ') + '</span>' : '') + '</td>';
    };
    const rows = eg ? eg.kinds.map(k => {
      const nm = EGG_KIND_NAMES[k.kind];
      const args = [...k.args].sort((a, b) => a - b);
      return '<tr>' + num(k.kind) + '<td>' + svEsc(nm ? nm.what : 'not known here') + '</td>' +
        '<td>' + (nm && nm.arg ? svEsc(nm.arg) : '') + '</td>' + (eh ? handlerCell(k.kind) : '') + num(k.n) +
        '<td class="mechSub">' + svEsc(args.length > 6 ? args.slice(0, 6).join(', ') + ', …' : args.join(', ')) + '</td></tr>';
    }) : [];
    add('eggs', 'What an Egg Does', null, '',
      eg ? 'An egg is an invisible trigger over a rectangle of a zone’s map. Its kind decides what it does, with one number, its argument.'
         : 'No zone list in this file places an egg.',
      eg ? [
        '<b>' + eg.kinds.reduce((n, k) => n + k.n, 0) + ' eggs</b> across <b>' + eg.zones + ' zones</b>, of <b>' + eg.kinds.length + ' kinds</b>.',
        eg.rooms ? 'A room is a kind-8 egg, its argument the room number. <b>' + countLink(String(eg.rooms.named), 'The ' + eg.rooms.named + ' room scripts', resChips(eg.rooms.scripted)) + ' of the ' + eg.rooms.total + '</b> rooms have a script, 0x1B00 plus the number.' : '',
        'A kind-3 egg plays an <b>ambient sound</b>, sound 0x9100 plus its argument.',
        'A kind-0 egg hatches the records inside it. The chance is <b>Data2 plus one in a hundred</b>, and Data1 limits it to the day (0x10), the night (0x20) or once only (0x01).',
        '<b>A kind-0 egg’s argument says nothing about what hatches</b>: all thirteen of Odemia’s eggs have 0xE4, whether they hold a chicken, a goat or a guard.',
        'Records with flags 0x44 are roofs, not eggs, and there are <b>' + eg.roofs + '</b> of them here.'
      ].filter(Boolean) : [],
      (eh ? '' : '<div class="mechSub">' + MECH_NO_APP + '</div>') +
      table(eh ? ['#kind', 'what it does', 'argument', 'handler', '#here', 'arguments used'] : ['#kind', 'what it does', 'argument', '#here', 'arguments used'], rows) +
      // Which creatures, and not only that there are some. The inspector has
      // said this for one egg at a time since the reading was new; this is
      // the whole archive's, so a reader can see what the island hatches
      // without hunting for a ring to hover over.
      ((eg && eg.hatch && eg.hatch.length)
        ? '<div class="partsTitle">What they hatch</div>' +
          table(['creature', '#eggs', '#zones'], eg.hatch.map(h =>
            '<tr><td>' + (refExists(0x1000 + h.proptype)
              ? partChip(propDisplayName(h.proptype) || ('prop ' + h.proptype), 0x1000 + h.proptype)
              : svEsc(propDisplayName(h.proptype) || ('prop ' + h.proptype))) + '</td>' +
            num(h.n) + num(h.zones.size) + '</tr>')) +
          (eg.emptyEggs ? '<div class="mechSub">' + eg.emptyEggs +
            ' hatching egg' + (eg.emptyEggs === 1 ? '' : 's') + ' in the file hold' + (eg.emptyEggs === 1 ? 's' : '') + ' no record at all, and the file says nothing about what ' + (eg.emptyEggs === 1 ? 'it' : 'they') + ' would hatch.</div>' : '')
        : ''),
      '<span class="partsTitle">On the map</span>' + svLink('World', "showCategory('WORLD')"));
  }

  // The game's own writing is on the Writings sheet now
  // (libraryMechSection in js/delv-sheets.js), above the arrays it
  // tabulates. Loose ends still reads both of these; both memoise.
  const libAll = libraryRules();
  const todoAll = todoRules();

  // ---- loose ends ----
  {
    const le = looseEnds();
    const td2 = todoAll;
    const lib2 = libAll;
    const slots = new Map();
    for (const a of td2.adds) { if (!slots.has(a.slot.v)) slots.set(a.slot.v, { adds: [], dones: [] }); slots.get(a.slot.v).adds.push(a); }
    for (const d of td2.dones) { if (!slots.has(d.slot.v)) slots.set(d.slot.v, { adds: [], dones: [] }); slots.get(d.slot.v).dones.push(d); }
    const never = [...slots.keys()].filter(s => slots.get(s).adds.length && !slots.get(s).dones.length).sort((a, b) => a - b);
    const wrongLine = td2.adds.filter(a => !a.state && a.line.v !== a.slot.v);
    const rows = [];
    /* Every row says where it came from the same way, through one cell.
       Half of them used to state a plain name instead, because the reader
       kept only the resource for those and srcNum needs an instruction to
       ring; so the sheet looked as though grey rows were a lesser kind of
       finding, when the difference was only in what the reader had bothered
       to record. looseEnds carries a site for everything now, and nothing
       here knows which row it is building: the name falls back from the
       site's own, to the resource's label, to its hex id. */
    /* One chip per SCRIPT, not per place. A script that writes the same value
       three times printed its own name three times, which is noise rather
       than provenance (the maintainer, 12 September 2026): the reader wants
       to know which script, and the count of places is a detail the first
       link can carry. */
    const where = sites => {
      const byRes = new Map();
      for (const s of (sites || [])) {
        if (!byRes.has(s.resid)) byRes.set(s.resid, []);
        byRes.get(s.resid).push(s);
      }
      return [...byRes.values()].map(list => {
        const s = list[0];
        const name = s.name || labelFor(s.resid) || propWordHex(s.resid);
        return srcNum(s, name) + (list.length > 1 ? ' <span class="mechSub">in ' + list.length + ' places</span>' : '');
      }).join(', ');
    };
    const sitesOf = m => m ? [...m.values()] : [];
    for (const s of never) rows.push('<tr><td>a To Do line nothing strikes off</td><td>' +
      (td2.lines && td2.lines.get(s) ? svEsc(td2.lines.get(s)) : 'slot ' + s) + '</td><td>' +
      where(slots.get(s).adds.map(a => a.slot)) + '</td></tr>');
    for (const u of le.unreachable) rows.push('<tr><td>a test nothing can satisfy</td><td>quest value ' + u.state +
      ' is only ever set to ' + (u.assigned.join(', ') || 'nothing') + ', and this asks whether it is ' + u.want.v + '</td><td>' +
      where([u.want]) + '</td></tr>');
    for (const a of wrongLine) rows.push('<tr><td>a line that shows another line’s words</td><td>slot ' + a.slot.v +
      (td2.lines && td2.lines.get(a.slot.v) ? ' (' + svEsc(td2.lines.get(a.slot.v)) + ')' : '') + ' shows line ' + a.line.v +
      (td2.lines && td2.lines.get(a.line.v) ? ' (' + svEsc(td2.lines.get(a.line.v)) + ')' : '') + '</td><td>' +
      where([a.line]) + '</td></tr>');
    /* Say what the finding MEANS, not only what it is. "quest value 9" is a
       fact about the file; that setting it changes nothing is the finding,
       and it is what a reader is here for. */
    for (const k of le.writtenNeverRead) rows.push('<tr><td>written and never read</td><td>Quest value ' + k +
      ': a script sets it, but no script ever checks it, so setting it changes nothing.</td><td>' +
      where(sitesOf(le.writes.get(k))) + '</td></tr>');
    for (const k of le.readNeverWritten) rows.push('<tr><td>read and never written</td><td>Quest value ' + k +
      ': a script checks it, but no script ever sets it, so the check only ever finds 0.</td><td>' +
      where(sitesOf(le.reads.get(k))) + '</td></tr>');
    /* Flags, which the reader has collected since the card was new and the
       card never showed. Only the one direction: a flag no script sets,
       whether by SetStateFlag or by queueing task 165, is a test that never
       passes, since nothing else in the application writes the array. The
       other direction is not shown, because the application READS flags on
       its own account (EvalCondition, for the conditional eggs), so a flag
       no script tests is not thereby unread. */
    for (const k of le.flagReadNeverWritten) rows.push('<tr><td>read and never written</td><td>Quest flag ' + k +
      ': a script checks it, but no script sets it, directly or through a queued task, so the check never passes.</td><td>' +
      where(sitesOf(le.flagReads.get(k))) + '</td></tr>');
    const lineText = n => (td2.lines && td2.lines.get(n) ? ' (' + svEsc(td2.lines.get(n)) + ')' : '');
    for (const x of le.exactStrikes) rows.push('<tr><td>a line struck off only at an exact count</td><td>slot ' + x.slot.v + lineText(x.slot.v) +
      ' comes off the list only when quest value ' + x.state + ' is exactly ' + srcNum(x.n) +
      ', but the scripts count that value upward, so a visit that takes it past ' + x.n.v + ' never strikes the line.</td><td>' +
      where([x.slot]) + '</td></tr>');
    /* One line shown for two different errands. A line that is not its own
       slot's is usually the informant's wording of that slot's errand, and
       that is deliberate; but a line's words can only describe one errand,
       so the same line under two slots is wrong under one of them. That is
       Ake: she sends the hero to Halos about House Comana, slot 10, and
       shows line 114, the wording Demodocus shows for the iron mine. */
    const bySharedLine = new Map();
    for (const a of wrongLine) {
      if (!bySharedLine.has(a.line.v)) bySharedLine.set(a.line.v, []);
      bySharedLine.get(a.line.v).push(a);
    }
    const twoErrands = [...bySharedLine.values()].filter(list => new Set(list.map(a => a.slot.v)).size > 1);
    // The resolver's weapon-skill term, read in combatRules (`cb` above).
    const skillOff = cb && cb.skillOffLoop;
    if (skillOff) rows.push('<tr><td>a value read from the wrong thing</td><td>The script that settles a blow adds the weapon’s skill to the margin and to the damage figure, but reads it from a value that its check of the shields leaves at 0 instead of from the weapon, so Sword, Axe and Mace add nothing to an armed blow.</td><td>' +
      where(skillOff) + '</td></tr>');
    // Four readers of 17 September 2026's fourth batch (page-rules.js).
    for (const d of goesDarkStillLit().filter(x => x.light > 0)) rows.push('<tr><td>a light that stays on</td><td>The ' + svEsc(propDisplayName(d.pt) || ('prop ' + d.pt)) +
      ' says “' + svEsc(d.said.trim()) + '” and moves to aspect ' + srcNum(d.aspect) + ', whose tile still gives light of level ' + d.light + ', so it keeps giving light.</td><td>' +
      svLink('tile 0x' + d.tile.toString(16).toUpperCase(), 'showPropTypeDetail(' + d.pt + ')') + '</td></tr>');
    for (const c of scheduleCollisions()) rows.push('<tr><td>two people scheduled into one place</td><td>' + (chipOf(c.a) || svEsc(characterName(c.a))) + ' and ' + (chipOf(c.b) || svEsc(characterName(c.b))) +
      ' are both scheduled to (' + c.x + ', ' + c.y + ') on map ' + c.level + ' in the same mode from ' + c.from + ':00 to ' + c.to + ':00.</td><td>' + svLink('the schedules', "showCategory('SCHEDULES')") + '</td></tr>');
    for (const n of nameNeverKept()) rows.push('<tr><td>a name told and not kept</td><td>' + (chipOf(n.who) || svEsc(characterName(n.who))) +
      ' answers “name” but never sets their own character flag 7, which every other name topic sets, so they are still called by what they look like.</td><td>' + where([n]) + '</td></tr>');
    for (const a of askedOfNobody()) rows.push('<tr><td>answers written for someone never asked</td><td>' + a.items.length + ' item classes write an Ask About answer for ' + (chipOf(a.who) || svEsc(characterName(a.who))) +
      ', whose script never passes a question to the shared Ask About script, so none of these answers is ever given.</td><td>' + a.items.slice(0, 6).map(pt => svLink(svEsc(propDisplayName(pt) || ('prop ' + pt)), 'showItemDetail(' + pt + ')')).join(', ') + (a.items.length > 6 ? ' and ' + countLink((a.items.length - 6) + ' more', 'The ' + a.items.length + ' item classes with an answer for ' + characterName(a.who), a.items.map(pt => svLink(svEsc(propDisplayName(pt) || ('prop ' + pt)), 'showItemDetail(' + pt + ')'))) : '') + '</td></tr>');
    for (const r of answersThatRunOn()) rows.push('<tr><td>an answer that runs on</td><td>The answer to “' + svEsc(r.list) + '” has no instruction to stop after it, so ' +
      (r.then ? 'the answer to “' + svEsc(r.then.list) + '” further on follows for the same reply straight away, and replaces the first answer before you can read it.'
        : 'the conversation goes on checking the next keywords, and when none matches, the character’s “don’t understand” line follows it.') + '</td><td>' + where([r]) + '</td></tr>');
    // The last part of a spoken line, after its last click, as the balloon shows it.
    const lastPart = t => svEsc(t.split('*').filter(x => x.trim()).pop() || t);
    for (const r of linesReplacedAtOnce()) rows.push('<tr><td>a line replaced before you can read it</td><td>' +
      (r.oneString ? lastPart(r.line) + ' and ' + lastPart(r.next) + ' are back to back in one string, with no * between them to wait for a click, so the second replaces the first as soon as the game draws it.'
        : lastPart(r.line) + ' ends without a * to wait for a click, and the next line the script can come to, ' + lastPart(r.next) + (r.speaker ? ', said by someone the script has just named to speak,' : '') + ' replaces it as soon as the game draws it.') +
      '</td><td>' + where([r]) + '</td></tr>');
    for (const t of selfToldByGroup()) rows.push('<tr><td>a character told about by their own group</td><td>' + (chipOf(t.who) || svEsc(characterName(t.who))) +
      ' has no answer to “' + svEsc(t.key) + '”, so the question passes to a dialogue group their script uses, which answers as if about someone else: ' + svEsc(t.said) + '</td><td>' + where([t]) + '</td></tr>');
    {
      const bySkill = new Map();
      for (const u of containedUnseen()) { if (!bySkill.has(u.resid)) bySkill.set(u.resid, []); bySkill.get(u.resid).push(u); }
      for (const list of bySkill.values()) rows.push('<tr><td>a search that passes over what is inside things</td><td>' + where([list[0]]) +
        ' looks only at things lying loose, and ' + list.map(u => 'all ' + u.inside + ' ' + svEsc(propDisplayName(u.pt) || ('prop ' + u.pt)) + (u.inside === 1 ? ' is' : 's are') +
          ' inside ' + u.hosts.map(h => svEsc(propDisplayName(h) || ('prop ' + h))).join(' or ')).join(', and ') + ', so it never finds one.</td><td>' + where([list[0]]) + '</td></tr>');
    }
    for (const w of stateNoSaveKeeps()) rows.push('<tr><td>a value no saved game keeps</td><td>' + where(w.writers) + ' write' + (w.writers.length === 1 ? 's' : '') +
      ' word 0x' + w.offset.toString(16).toUpperCase() + ' of resource 0x' + w.resource.toString(16).toUpperCase().padStart(4, '0') + ', and ' + w.readers.length + ' place' + (w.readers.length === 1 ? ' reads' : 's read') +
      ' it back. It is written while the hero is created, before the game has a saved file, so a saved game does not keep it, and the value is whatever the last hero created wrote.</td><td>' + where(w.readers) + '</td></tr>');
    for (const d of deletedAcrossZoneChange()) {
      const item = svEsc(propDisplayName(d.pt) || ('prop ' + d.pt));
      rows.push('<tr><td>a delete after the zone has changed</td><td>Using a ' + item + ' of ' + where([{ resid: d.skill, at: d.skillAt }]) +
        ' casts a copy of the spell, which moves the party to another zone. Then the ' + item + '’s Use script deletes the copy and the ' + item + ' by their numbers, but those numbers now belong to things in the new zone, so it destroys two of those things and the ' + item + ' stays. One lies in ' +
        d.zones.map(z => svEsc(labelFor(0x8000 + z) || ('zone ' + z))).join(' and ') + '.</td><td>' + where([d]) + '</td></tr>');
    }
    for (const h of highlightsUnanswered()) rows.push('<tr><td>a highlighted word nobody answers</td><td>“' + svEsc(h.word) + '” is highlighted as a question in ' + where([h]) + ', and ' +
      (h.who.length === 1 ? (chipOf(h.who[0]) || svEsc(characterName(h.who[0]))) + ', who says it, has'
        : 'none of the ' + h.who.length + ' characters who can say it has') + ' an answer that matches it' +
      (h.who.length > 1 ? ': ' + h.who.slice(0, 8).map(n => chipOf(n) || svEsc(characterName(n))).join(', ') + (h.who.length > 8 ? ' and ' + countLink((h.who.length - 8) + ' more', 'The ' + h.who.length + ' characters who can say “' + h.word + '”', h.who.map(n => chipOf(n) || svLink(characterName(n), 'showCharacterDetail(' + n + ')'))) : '') : '') + '.</td><td>' + where([h]) + '</td></tr>');
    for (const r of refusalOnEveryCheck()) rows.push('<tr><td>a refusal said on every check</td><td>The ' + svEsc(propDisplayName(r.pt) || ('prop ' + r.pt)) +
      '’s answer to whether a thing can go inside it prints “' + svEsc(r.said.trim()) + '” before saying no, and the inventory window asks it each time it checks a drop, so the line repeats while you drag a thing over it.</td><td>' + where([r]) + '</td></tr>');
    for (const l of leaveNeverLeaves()) rows.push('<tr><td>a companion who agrees to leave and stays</td><td>' + (chipOf(l.who) || svEsc(characterName(l.who))) +
      ' can join the party and answers “leave”, and nothing in the script ever takes them out of it.</td><td>' + where([l]) + '</td></tr>');
    for (const t of tileReadWithSeenBit()) rows.push('<tr><td>a map tile read with its seen bit</td><td>' + where([t]) + ' compares the map’s tile at a square with ' + t.compared.join(' and ') +
      ' without removing the automap’s marker, bit 0x8000, which every square the player has seen carries, so the comparison never matches for a square the player can see.</td><td>' + where([t]) + '</td></tr>');
    for (const w of wrongCarryFlags()) rows.push('<tr><td>a thing given to a character with the wrong flags</td><td>' + where([w]) + ' sets a thing’s flags to ' + srcNum({ v: 9, resid: w.resid, at: w.at }, '9') +
      ' and its container to ' + svEsc(w.into.replace(/ \(0x[0-9A-F]+\)$/i, '')) + '. A carried thing has flag 0x10; 9 means inside another prop, so the thing ends up inside nothing and disappears.</td><td>' + where([w]) + '</td></tr>');
    for (const c of speechWithNoSpeaker()) rows.push('<tr><td>a conversation with no one to speak</td><td>' + where([c]) + ' opens a conversation and ' +
      (c.talk ? 'has the one it is used on talk' : 'has someone speak') + ' without naming a speaker. A conversation starts with no speaker, and the game draws quoted words where the speaker would be, so they appear above the window, out of sight.</td><td>' + where([c]) + '</td></tr>');
    // Character sprite frames that repeat another pose (spriteRepeats).
    for (const r of spriteRepeats()) rows.push('<tr><td>a sprite frame that repeats another pose</td><td>The ' + svEsc(propDisplayName(r.pt) || ('prop ' + r.pt)) + '’s ' + r.aName + ' frame and its ' + r.bName + ' frame ' +
      (r.pixels ? 'differ by ' + r.pixels + ' pixel' + (r.pixels === 1 ? '' : 's') : 'are identical') + ', whereas a sheet’s poses otherwise differ by hundreds of pixels.</td><td>' +
      svLink('tile 0x' + r.a.toString(16).toUpperCase(), 'showPropTypeDetail(' + r.pt + ')') + '</td></tr>');
    // A character asking whether they themselves are alive.
    for (const a of le.selfAlive) rows.push('<tr><td>a character asking if they are alive</td><td>' + (chipOf(a.who) || svEsc(characterName(a.who))) +
      ' checks whether ' + svEsc(characterName(a.who)) + ' is alive, which is always true while they are talking, so the other answer is never given.</td><td>' + where([a]) + '</td></tr>');
    // A local tested for truth and only ever set false.
    for (const l of le.localOnlyFalse) rows.push('<tr><td>a check of something that is always false</td><td>The script checks a local variable for true or false, but its function only ever sets it to false, so the code for the true case never runs.</td><td>' +
      where([l]) + '</td></tr>');
    // Answers an earlier answer in the same list takes first.
    for (const a of le.shadowed) rows.push('<tr><td>an answer an earlier one takes</td><td>“' + svEsc(a.list) +
      '” has an answer earlier in the same list, and the game uses the first match, so it never gives this answer.</td><td>' + where([a]) + '</td></tr>');
    // A quest value tested where the same-numbered flag is meant.
    for (const v of le.valueForFlag) rows.push('<tr><td>a value checked where the flag is meant</td><td>' + where([v]) + ' checks quest value ' + v.k +
      ' as true or false where its other checks use quest flag ' + v.k + '. Quest value ' + v.k + ' gets a starting value when it is 0 and nothing sets it back to 0, so the check always passes.</td><td>' +
      where([v]) + '</td></tr>');
    // Keywords behind a comma and a space, read in looseEnds.
    for (const k of le.spacedKeywords) rows.push('<tr><td>a keyword that needs a space typed first</td><td>“' + svEsc(k.list) + '”: ' +
      k.spaced.map(w => '“' + svEsc(w) + '”').join(' and ') + ' follow' + (k.spaced.length === 1 ? 's' : '') + ' a comma and a space, and the space stays part of the keyword, so it only matches an answer you type with a space in front.</td><td>' +
      where([k]) + '</td></tr>');
    // A quest value only a thing that does not exist sets, read in looseEnds.
    for (const d of le.dataCaseNoThing) rows.push('<tr><td>a thing nobody has</td><td>' + svEsc(propDisplayName(d.pt) || ('prop ' + d.pt)) +
      ' sets quest value ' + d.state + ' when its Data1 is ' + srcNum(d.v) + ', and no ' + svEsc(propDisplayName(d.pt) || 'such thing') +
      ' anywhere has that Data1, so quest value ' + d.state + ' never changes. The scripts that read it: ' + where(d.readers) + '.</td><td>' + where([d.v]) + '</td></tr>');
    // Character flags tested and never set, read in looseEnds.
    for (const f of le.charFlagNeverSet) rows.push('<tr><td>a character flag checked and never set</td><td>Flag ' + f.bit + ' of ' +
      (chipOf(f.character) || svEsc(characterName(f.character) || ('character ' + f.character))) +
      ': a script checks it, but nothing sets it, whether by a call, a shared script, a queued task or the character table, so the check never passes.</td><td>' +
      where(f.sites) + '</td></tr>');
    // The sleep helper's magic half, read in sleepRules.
    const slp = sleepRules();
    if (slp && slp.magicGuard && slp.magicCap) rows.push('<tr><td>a value read in place of another</td><td>Sleep adds the magic bonus while magic is below full health, and a total above full magic sets magic to full health, so a character whose full health is higher than their full magic wakes with more magic than their maximum.</td><td>' +
      where([slp.magicGuard, slp.magicCap]) + '</td></tr>');
    // The three "use a thing" task scripts, read in looseEnds (unusedCast).
    for (const u of le.unusedCast) rows.push('<tr><td>a task that does nothing</td><td>Task ' + u.task + ' converts its item to a prop, then sends ' + svEsc(u.method) +
      ' to the unconverted item instead. A queued task’s item arrives as a plain number rather than as the thing itself, and a number cannot respond, so the task never does anything.' +
      (u.queuedBy.length ? ' Queued by ' + where(u.queuedBy) + '.' : ' Nothing queues it.') + '</td><td>' + where([u]) + '</td></tr>');
    for (const list of twoErrands) rows.push('<tr><td>one line shown for two errands</td><td>line ' + list[0].line.v + lineText(list[0].line.v) +
      ' appears for ' + [...new Set(list.map(a => a.slot.v))].map(s => 'slot ' + s + lineText(s)).join(' and for ') +
      ', and its words can only describe one of them.</td><td>' +
      where(list.map(a => a.line)) + '</td></tr>');
    if (lib2) for (const d of lib2) for (const k of d.dangling)
      rows.push('<tr><td>a thing pointing at nothing</td><td>Data1 ' + k + ' of ' + propWordHex(d.resid) + ', which has no such passage</td><td>' +
        where(d.readers) + '</td></tr>');
  // ---- the palette and its ramps ----
  {
    const pr = appImage() ? exePaletteRamps() : null;
    const clut = window.CYTHERA_RSRC && typeof showMacRsrcDetail === 'function' ? svLink('clut 256', "showMacRsrcDetail('clut', 256)") : 'clut 256';
    const ours = PALETTE_CYCLES.map(([s, n]) => propWordHex(s) + ' to ' + propWordHex(s + n - 1)).join(', ');
    add('palette', 'The Palette and Its Ramps', null, '',
      'Every picture uses one table of 256 colors, ' + clut + '. Water, lava and magic seem to move because the game shifts a few runs of it one step on every tick.',
      [
        'This page cycles <b>' + ours + '</b>.',
        pr ? (pr.agrees ? 'The game cycles the same runs.' : '<b>The game cycles different runs</b>: ' +
             pr.ramps.map(r => propWordHex(r.start) + ' to ' + propWordHex(r.start + r.len - 1)).join(', ') + '.')
           : MECH_NO_APP
      ].filter(Boolean),
      '');
  }

    add('loose', 'Loose Ends', null, '',
      rows.length ? 'Mistakes in the scenario’s scripts, each linked to the line that causes it.'
                  : 'This file has nothing of this kind.',
      rows.length ? [
        never.length ? '<b>' + never.length + '</b> To Do lines go on the list and never come off.' : '',
        le.unreachable.length ? '<b>' + le.unreachable.length + '</b> check a value that nothing ever sets, so what they lead to can never happen.' : '',
        wrongLine.length ? '<b>' + wrongLine.length + '</b> lines show another line’s words, usually on purpose: the errand in the words of whoever told you.' : '',
        twoErrands.length ? '<b>' + twoErrands.length + '</b> of those ' + (twoErrands.length === 1 ? 'is' : 'are') + ' shown for two different errands, so for one of them it is wrong.' : '',
        le.exactStrikes.length ? '<b>' + le.exactStrikes.length + '</b> ' + (le.exactStrikes.length === 1 ? 'line is' : 'lines are') + ' struck off only at an exact count, which a visit can skip past.' : '',
        le.flagReadNeverWritten.length ? '<b>' + le.flagReadNeverWritten.length + '</b> quest ' + (le.flagReadNeverWritten.length === 1 ? 'flag is' : 'flags are') + ' checked and never set.' : '',
        skillOff ? 'The script that settles a blow reads the weapon’s skill from the wrong place, so no armed blow benefits from it.' : '',
        le.spacedKeywords.length ? '<b>' + le.spacedKeywords.length + '</b> keyword ' + (le.spacedKeywords.length === 1 ? 'list has' : 'lists have') + ' a space after a comma, so the keyword after it only matches if you type a space first.' : '',
        le.charFlagNeverSet.length ? '<b>' + le.charFlagNeverSet.length + '</b> character ' + (le.charFlagNeverSet.length === 1 ? 'flag is' : 'flags are') + ' checked and never set, so the lines that depend on them are either never said or said every time.' : '',
        le.unusedCast.length ? '<b>' + le.unusedCast.length + '</b> of the tasks you can give a character ' + (le.unusedCast.length === 1 ? 'does' : 'do') + ' nothing' + (le.unusedCast.some(u => u.queuedBy.some(q => q.resid === 0x1AD5)) ? ', and Lock Picking queues one of them, which is why a companion told to pick a lock never does.' : '.') : ''
      ].filter(Boolean) : [],
      table(['what', 'which', 'where'], rows));
  }

  // ---- the three ways a patch reaches the game ----
  /* Magpie writes a patch into Cythera Data; the program itself also loads
     patch archives named in a list beside it, and the player's User Custom
     Data after them (exePatchFiles, js/page-data.js). Both of the program's
     routes reach only what is read through its set of open files: the
     routines that read Cythera Data's own file, read 1 October 2026 and shown
     for tiles in the fork (cythera-workbench's doc/engine-patch-list.md). The
     section said so until the maintainer had that line cut the same day as
     confusing; it says only how a save keeps its own levels. The names and
     figures are the program's, with their instructions; without the program
     open the two routes are not described at all. */
  {
    const pf = exePatchFiles();
    const nm = x => x && x.name ? srcNum(x.id, x.name) : null;
    const patchName = nm(pf && pf.patch), customName = pf && pf.custom ? srcNum(pf.custom, pf.custom.v) : null;
    const rules = ['<b>Into Cythera Data.</b> Magpie, or Apply below, writes the patch into the game file. A patch can change anything this way.'];
    if (pf && patchName && pf.list && pf.count)
      rules.push('<b>' + patchName + '.</b> A file in the game’s folder listing up to ' + srcNum(pf.count) + ' patch files, which the game loads when it starts.');
    if (pf && customName)
      rules.push('<b>' + customName + '.</b> One patch file saved under this name. It replaces any combat AIs you imported.');
    add('patchkinds', 'Three Ways to Patch the Game', null, '',
      'A patch can go into the game file, or sit beside it in its folder.',
      pf ? rules : [rules[0]],
      (pf ? '' : '<ul class="ruleList"><li>' + MECH_NO_APP + '</li></ul>') +
        '<p class="mechSub">A saved game keeps a copy of each level it has visited, so a patch only changes levels that save has not been to.</p>',
      pf ? '<span class="partsTitle">In the program</span>' + pefChip('TDelverApp::PostInitMac') + pefChip('TDelverApp::OpenScenFile') + pefChip('LoadLevelProps') : '');
  }

  // ---- the community's patches ----
  {
    const base = patchBaseSpec();
    const applied = base ? delverInstalledPatchIds(base) : [];
    const named = applied.map(u => DELV_PATCH_AUTHORS[u]).filter(Boolean);
    add('patches', 'Compare Patches', null, '',
      'Magpie patches work by replacing specific resources in the original Cythera Data file. Open a patch here to see details and what resources it changes.',
      [],
      // The patches the open file records, said only when there are some
      // (the maintainer, 1 October 2026, who had the rest of the prose go).
      applied.length
        ? '<ul class="ruleList"><li>This file records <b>' + applied.length + '</b> patch' + (applied.length === 1 ? '' : 'es') + ' applied to it' +
          (named.length ? ', among them ' + named.map(n => '<b>' + svEsc(n.title) + '</b>, ' + svEsc(n.name)).join(' and ') : '') +
          '.<div class="patchMono mechSub">' + applied.map(u => svEsc(u)).join('<br>') + '</div></li></ul>'
        : '');
    /* The three controls are built as ELEMENTS and appended, where every
       other section's body is a string of markup. The difference is not
       taste: an id that only ever exists inside an innerHTML string is
       invisible to the checks, which seed what they know from the static
       markup and report an id the page asks for and never declares. The file
       control, the note and the report are the whole of what this section
       does, so they are the last things that should be unreachable from a
       harness. */
    const sec = sections[sections.length - 1].el;
    const wrap = document.createElement('div');
    wrap.className = 'mechStats';
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'patchFile'; input.accept = '*/*';
    wrap.appendChild(input);
    sec.appendChild(wrap);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'patchNote';
    sec.appendChild(note);
    const report = document.createElement('div');
    report.id = 'patchReport';
    sec.appendChild(report);
  }

  // ---- the scenario's fixes, as a patch ----
  {
    add('datafixes', 'Generate Bugfix Patches', null, '',
      'Over time, the community has uncovered a number of apparent bugs and typos that were never addressed by official version updates, and AI analysis has uncovered several more. ' +
      'Solutions for the below issues have been identified through AI-based tracing and testing in the game itself (though many solutions are still untested). ' +
      'Select as many of the fixes below as you\u2019d like, and this site can generate a Magpie-compatible patch file with those fixes. ' +
      'Note it\u2019s best to generate a single patch file with all changes; stacking multiple sometimes will not work. ' +
      '(If changes are too close to each other in code then a change made by a prior patch can be unintentionally reverted by a new patch.)',
      [], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'dataFixMaker';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'dataFixNote';
    sec.appendChild(note);
  }

  // ---- the hero's colours, as a patch ----
  {
    add('herosprite', 'Recolor a Sprite', null, '',
      'Pick a sprite and change its colors. You can also give the hero and the heroine another character’s body. ' +
      'This page writes a Magpie patch that replaces just that picture.',
      [
        'The hero and the heroine can wear any person, or any monster drawn in four or eight frames. A monster has fewer poses, so the patch reuses some of its frames.',
        'Each color keeps its shading. Where the art uses one shade for two things, both change.'
      ], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'heroSprite';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'heroNote';
    sec.appendChild(note);
  }

  // ---- a gremlin of your own ----
  {
    add('gremlins', 'Make a Gremlin', null, '',
      'A gremlin is a script the game runs at a moment you choose. Pick when it runs and what it does, and this page writes a Magpie patch that adds it.',
      [], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'gremlinMaker';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'gremlinNote';
    sec.appendChild(note);
  }

  // ---- the program's own fixes ----
  {
    add('appfixes', 'Generate a Fixed Program', null, '',
      'Choose fixes to the PowerPC version of Cythera 1.0.4, and this page writes out a fixed copy of the program.',
      [], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'appFixMaker';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'appFixNote';
    sec.appendChild(note);
  }

  // ---- the scenario in Spanish ----
  {
    add('spanish', 'Cythera in Spanish', null, '',
      'Cythera\u2019s text in Spanish: everything the characters say, the books and signs, the names of things, the To Do list, the spells, the skills and the credits. ' +
      'This page writes a Spanish copy of the open file, to put in place of Cythera Data in the game\u2019s folder.',
      [
        'It is a whole file rather than a patch, because the accented letters need changes a patch cannot make.',
        'It works on versions 1.0.3 and 1.0.4. Any text your file has changed stays in English.',
        'Characters answer keywords in Spanish or in English.',
        'You can translate the program too, from the installer or from the program itself: its menus, dialogs and messages. With both in Spanish, the names of things carry their article (\u201cuna espada\u201d, \u201cel rey\u201d).',
        'On a 68K Mac the program\u2019s menus and dialogs are in Spanish, and its messages stay in English.'
      ], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'spanishMaker';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'spanishNote';
    sec.appendChild(note);
  }

  // ---- behind the scenes ----
  {
    add('backstage', 'Behind the Scenes', null, '',
      'Fixes to what the game keeps and no player sees. Choose the fixes, then download a corrected copy of Cythera Data to put in place of the old one.',
      ['It is a whole file rather than a patch, because these fixes are in the part of the file a patch cannot change.'], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'backstageMaker';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'backstageNote';
    sec.appendChild(note);
  }

  // ---- comparing two archives ----
  {
    const edits = (window.EDITED_RESIDS && window.EDITED_RESIDS.size) || 0;
    add('compare', 'Compare Two Files', null, '',
      'See what differs between two game files: two releases of the game, a modded copy against a clean one, ' +
      'or this file against how it was before you edited it. You can save the differences as a patch.',
      [
        'The page treats the file you open here as the older one, and the file already open as the newer.',
        'All four installers open here. The data in <b>1.0.3</b> and <b>1.0.4</b> is the same, so everything Ambrosia changed after 1.0.1 is between those two.'
      ],
      '<ul class="ruleList"><li>' +
        (edits ? 'You have changed <b>' + edits + '</b> resource' + (edits === 1 ? '' : 's') + ' in this file.'
               : 'You have not edited this file, so there is nothing to compare it with.') +
      '</li></ul>');
    const sec2 = sections[sections.length - 1].el;
    const bar = document.createElement('div');
    bar.className = 'mechStats';
    if (edits) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
      b.textContent = 'Show what I have changed';
      b.onclick = compareEdits;
      bar.appendChild(b);
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'compareFile'; inp.accept = '*/*';
    bar.appendChild(inp);
    sec2.appendChild(bar);
    const n2 = document.createElement('div');
    n2.className = 'mechSub'; n2.id = 'compareNote';
    sec2.appendChild(n2);
    const r2 = document.createElement('div');
    r2.id = 'compareReport';
    sec2.appendChild(r2);
  }

  // ---- puzzles ----
  {
    const pz = puzzleRules();
    const bz = pz.braziers, bu = pz.buttons;
    // One accumulator per section now, where a single `html` held all five.
    let braziersHtml = '', buttonsHtml = '', riddlesHtml = '', bellsHtml = '', musicLocksHtml = '', signalsHtml = '';
    if (bz) braziersHtml += '<ul class="ruleList">' +
      '<li>Light them in order. A wrong one sends ' + srcNum(bz.state, 'the count') + ' back to the start.</li>' +
      (bz.last ? '<li>Lighting the last, number ' + srcNum(bz.last) + ', prints this line and makes the screen flicker:</li>' : '') +
      (bz.say ? '<li>' + srcSaid(0x113F, bz.say.replace(/\s+/g, ' ').trim()) + '</li>' : '') + '</ul>';
    // Which sides of a panel are lit. The aspect's low four bits are the
    // four sides, and the order is the file's: 8 right, 4 bottom, 2 left,
    // 1 top. Read off the records rather than stated here, in that the
    // numbers below are whatever the archive holds.
    const litSides = a => ['right', 'bottom', 'left', 'top']
      .filter((_, i) => a & (8 >> i)).join(', ') || 'none';
    const sq = r => r ? r.x + ', ' + r.y : '';
    if (bu) {
      if (bu.rooms && bu.rooms.length) buttonsHtml += '<div class="partsTitle">The pattern rooms</div>' +
        table(['#door', 'the two panels', 'lit to begin with', '#buttons', 'the door between them'],
          bu.rooms.map(rm => '<tr>' + num(rm.door) +
            '<td>' + rm.panels.map(p => sq(p)).join('  and  ') + '</td>' +
            '<td class="mechSub">' + rm.panels.map(p => litSides(p.aspect)).join('  |  ') + '</td>' +
            num(rm.buttons.length) + '<td>' + sq(rm.doorRec) + '</td></tr>'));
      const rows = bu.buttons.map((b, i) => '<tr>' + num(i + 1) + '<td>' + b.x + ', ' + b.y + '</td>' +
        '<td>' + sq(b.a.rec) + ' through table ' + b.a.table + '</td>' +
        '<td>' + sq(b.b.rec) + ' through table ' + b.b.table + '</td></tr>');
      buttonsHtml += '<div class="partsTitle">The buttons, and the two panels each one drives</div>' +
        table(['#no.', 'square', 'first panel', 'second panel'], rows);
      if (bu.arrays) buttonsHtml += '<div class="partsTitle">The tables they read through</div>' +
        table(['#table', 'aspect 0 to 15 becomes'], bu.arrays.map((a, i) =>
          '<tr>' + num(i) + '<td class="mechSub">' + a.join(', ') + (i === 0 && a.every((v, j) => v === j) ? '  (unchanged: this button moves nothing)' : '') + '</td></tr>'));
    }
    const ri = pz.riddles;
    if (ri && ri.buttons.length) {
      riddlesHtml += '<div class="partsTitle">The riddles, and the word each one takes</div>' +
        table(['#no.', 'what it says', 'the answer it takes', 'the door it opens'],
          ri.buttons.map(b => '<tr>' + num(b.which + 1) +
            '<td>' + (ri.text[b.which] ? svEsc(ri.text[b.which]).replace(/\n/g, '<br>') : '') + '</td>' +
            '<td>' + (ri.answers[b.which] ? ri.answers[b.which].split(',').map(w => '<b>' + svEsc(w) + '</b>').join(' or ') : '') + '</td>' +
            '<td>' + (b.door ? sq(b.door) : '') + '</td></tr>'));
      if (ri.lone.length) riddlesHtml += '<div class="partsTitle">The button on its own</div>' +
        table(['square', 'signals', 'the door it opens'], ri.lone.map(l =>
          '<tr><td>' + l.x + ', ' + l.y + '</td>' + num(l.signal) + '<td>' + (l.door ? sq(l.door) : '') + '</td></tr>'));
    }
    const tu = pz.tunes;
    if (tu && tu.bells) {
      const bl = tu.bells;
      bellsHtml += '<div class="partsTitle">The bells, and the orders they are rung in</div>' +
        '<ul class="ruleList"><li>' + srcNum(bl.base, 'Only the last four rings count') + ', so after a wrong ring just carry on.</li></ul>' +
        (bl.bells.length ? table(['#bell', 'square'], bl.bells.map(b =>
          '<tr>' + num(b.number) + '<td>' + b.x + ', ' + b.y + '</td></tr>')) : '') +
        table(['rung in this order', '#signals'], bl.orders.map(o =>
          '<tr><td>' + o.rings.join(', ') + '</td>' + srcCell(o.signal) + '</tr>'));
    }
    if (tu && tu.instruments.length) {
      musicLocksHtml += '<div class="partsTitle">The music locks</div>' +
        table(['instrument', 'can play', 'the tune it takes', '#signals', 'given by'],
          tu.instruments.map(it => '<tr><td>' + svChip(it.resid, it.what) + '</td>' +
            '<td class="mechSub">' + svEsc(it.lists.map(l => l.spelled).join('  and  ')) + '</td>' +
            '<td><b>' + svEsc(it.spelled) + '</b> ' + srcNum(it.tune, '(' + it.tune.v + ')') +
            (it.gate ? ' <span class="mechSub">only when its Data1 is ' + srcNum(it.gate) + '</span>' : '') + '</td>' +
            srcCell(it.signal) +
            '<td>' + (it.given.length ? it.given.map(c => svChip(c.resid, c.name || '')).join(' ') : '') + '</td></tr>'));
    }
    const sig = signalRules();
    signalsHtml += '<div class="partsTitle">What a signal reaches</div>' +
      (sig ? '<ul class="ruleList">' +
        '<li>A signal ' + srcNum(sig.method, 'goes') + ' to the zone and the room, then to ' + srcNum(sig.slots, 'every character') + ' in the zone and to the gremlins.</li>' +
        '<li>One <b>below ' + srcNum(sig.under) + '</b> also goes to each thing that listens for signals <b>whose Data1 is its number</b>' + (sig.mask ? ' (' + srcNum(sig.mask, 'not') + ' eggs, roofs or things inside others)' : '') + '. That is how a button opens one door and not another.</li>' +
        '</ul>'
        : '');
    /* One section per puzzle, the maintainer's ask of 14 September 2026.

       These were one card called Puzzles holding five headed blocks of a
       single string. The readings are untouched -- puzzleRules() still
       answers all of it in one go -- and only the placing changed: each
       block keeps the part of the string it always built, and takes the
       scripts it was actually read from as its own chips, where before one
       card carried every script between them.

       None of this is guesswork about what a puzzle wants: the sequences,
       the tables and the tunes are in the scripts, and the wiring is in the
       records placed on the map. What a signal opens is not in the archive,
       which is why the tunes name the signal and stop there. */
    if (bz) add('braziers', 'The Braziers', null, src('the braziers', 0x113F),
      'A row of braziers to light in the right order.',
      [], braziersHtml);
    if (bu) add('buttons', 'The Buttons and the Pattern Rooms', null, src('the buttons', 0x1104),
      'Five rooms, each with a pair of lit panels and a door that opens when the panels match.',
      (bu && bu.arrays) ? ['Each button turns two panels through one of <b>' + bu.arrays.length + ' fixed tables</b>.'] : [],
      buttonsHtml);
    if (ri && ri.buttons.length) add('riddles', 'The Riddles', null, src('the riddles', 0x1110),
      'Five riddles, each answered by typing a word.',
      [], riddlesHtml);
    /* The sections run in the order a player meets the puzzles, by the
       Hintbook's walkthrough (the maintainer, 3 October 2026): the buttons
       and then the riddles in Maayti, for the third part of the Crolna; the
       music locks, the panpipes' in House Comana after the fourth part (the
       lyre's, in the Cademia sewer, leads only to the Cloak of Herakles);
       the bells and the strange device in the Tyrant's Tomb and the mystic
       items' vaults, which the Hintbook leaves to the end; and the braziers
       last, which the Hintbook never mentions and the board's compendium
       calls a quirk that gives nothing (an Easter egg, the maintainer). The
       sections array is ordered by MECH_GROUPS, not by the calls here. The
       bells and the music locks were one section until then, which put the
       Tomb's bells before House Comana. */
    // The Magisterium's passwords and the levers (passwordRules, leverRules),
    // the puzzles the compendium has and the sheet had not (3 October 2026).
    const at = (zone, x, y, text) => svLink(text || ((zoneDisplayName(zone) || ('zone ' + zone)) + ' ' + x + ', ' + y), 'atlasOpenSquare(' + (0x8000 + zone) + ',' + x + ',' + y + ')');
    const pw = (function () { try { return passwordRules(); } catch (e) { quiet(e); return null; } })();
    if (pw && pw.words.length) {
      const said = pw.words.filter(w => w.word);
      add('passwords', 'The Magisterium Passwords', null, src('Selinus', 0x1851) + src('the door', 0x1114),
        said.length + ' doors in the Magisterium each ask for a password, which Librarian Selinus gives as you return the Sapphire Books.',
        [
          pw.every ? 'Selinus gives the next password for every ' + srcNum(pw.every, pw.every.v === 2 ? 'second' : pw.every.v + 'th') + ' book handed in.' : '',
          'A door listens for the first four letters, opens only to its own word, and only once Selinus has given that word.',
          (function () { const g = pw.words.find(w => w.n && w.n.v === 0); return g ? 'One more word, ' + srcNum({ v: 0, resid: 0x1114, at: g.at }, '“' + g.key + '”') + ', opens a door for the ' + svEsc(g.hall ? g.hall.v : 'room beyond') + ' with no condition, and no such door is placed.' : ''; })()
        ].filter(Boolean),
        table(['hall', 'password', 'given after', 'the door'], said.map(w => '<tr><td>' + (w.hall ? srcNum(w.hall, w.hall.v) : '') + '</td><td>' + srcNum(w.word, w.word.v) + '</td>' +
          '<td>' + (w.gate && pw.every ? srcNum(w.gate, (w.gate.v * pw.every.v) + ' books') : '') + '</td><td>' + w.doors.map(d => at(d.zone, d.x, d.y)).join(', ') + '</td></tr>')), '');
    }
    if (tu && tu.instruments.length) add('musiclocks', 'The Music Locks', null,
      tu.instruments.map(it => src(it.what, it.resid)).join(''),
      'The tune each lock needs, and the signal it sends.',
      [], musicLocksHtml);
    const lv = (function () { try { return leverRules(); } catch (e) { quiet(e); return null; } })();
    if (lv && lv.levers.length) {
      const zones = [...new Set(lv.levers.map(l => l.zone))];
      add('levers', 'The Levers', null, src('the lever', 0x10BB),
        'Every lever in the game and what it opens.',
        [
          'Pulling a lever sends its Data1 and then its Data2 as signals. A door or a wall in the same zone opens when its own Data1 is that signal.',
          'A lever whose signals reach nothing on the map may still be answered by its zone’s script.'
        ],
        zones.map(z => '<div class="partsTitle">' + svEsc(zoneDisplayName(z) || ('zone ' + z)) + '</div>' +
          table(['lever', '#signals', 'opens'], lv.levers.filter(l => l.zone === z).map(l => '<tr><td>' + at(l.zone, l.x, l.y, l.x + ', ' + l.y) + '</td>' +
            mechNum(l.signals.join(', ')) + '<td>' + (l.signals.length ? (l.reach.map(o => at(l.zone, o.x, o.y, (propDisplayName(o.pt) || 'prop ' + o.pt) + ' at ' + o.x + ', ' + o.y)).join(', ') || '<span class="inspDim">nothing on the map</span>') : '<span class="inspDim">sends nothing</span>') + '</td></tr>'))).join(''), '');
    }
    const mz = (function () { try { return teleportMazes(); } catch (e) { quiet(e); return []; } })();
    if (mz.length) add('mazes', 'The Teleporting Mazes', null, '',
      'Squares that move you elsewhere in the same zone, so the way through is found by stepping.',
      ['Each is an invisible trigger that sends you to a square of the zone; the map shows both ends.'],
      mz.map(m => '<div class="partsTitle">' + (m.titles.length ? m.titles.map(t => srcNum(t, t.v)).join(' or ') : svEsc(zoneDisplayName(m.zone) || ('zone ' + m.zone))) + ', ' + m.jumps.length + ' squares</div>' +
        table(['step on', 'and land on'], m.jumps.map(j => '<tr><td>' + at(m.zone, j.x, j.y, j.x + ', ' + j.y) + '</td><td>' + at(m.zone, j.to.x, j.to.y, j.to.x + ', ' + j.to.y) + '</td></tr>'))).join(''), '');
    if (tu && tu.bells) add('bells', 'The Bells', null, src('the bells', 0x10C1),
      (tu.bells.bells.length ? tu.bells.bells.length + ' bells' : 'Bells') + ', rung in the right order.',
      [], bellsHtml);
    // The strange device (thinkADotRules): its rule, the three patterns, the
    // doors they open and the fewest presses to each, all read off 0x1175.
    const td = (function () { try { return thinkADotRules(); } catch (e) { quiet(e); return null; } })();
    if (td) {
      const nm = propTypeName(0x175) || 'device';
      const lit = a => a.map((d, i) => d ? i : null).filter(i => i !== null);
      const at = (v, text) => srcNum({ v, resid: 0x1175, at: v }, text);
      const moves = t => t.v.map((to, i) => to === null ? null : i + ' to ' + to).filter(Boolean).join(', ');
      const off = td.lit.v.map((to, i) => to === null && td.dark.v[i] === null ? i : null).filter(i => i !== null);
      const side = ['left', 'middle', 'right'];
      const presses = ps => { const out = []; for (let i = 0; i < ps.length; ) { let j = i; while (j < ps.length && ps[j] === ps[i]) j++; out.push(side[ps[i]] + (j - i > 1 ? ' ' + (j - i) + ' times' : '')); i = j; } return out.join(', '); };
      const door = d => svLink((propTypeName(d.pt) || 'door') + ' in ' + (zoneDisplayName(d.zone) || ('zone ' + d.zone)), 'atlasOpenSquare(' + (0x8000 + d.zone) + ',' + d.x + ',' + d.y + ')', d.x + ', ' + d.y);
      add('thinkadot', 'The ' + nm, null, src('the ' + nm, 0x1175),
        'Eight dots and three buttons. A pattern of dots sends a signal, and the signal opens a door in the zone where you make the pattern.',
        [
          'The dots are in rows of three, two and three, and ' + srcNum({ v: 0, resid: 0x1175, at: td.startAt }, 'start') + ' with ' + lit(td.start).join(', ') + ' lit.' +
            (td.placed.length ? ' The ' + svEsc(nm) + ' is ' + td.placed.map(pl => pl.onMap ? 'in ' + svLink(zoneDisplayName(pl.zone) || ('zone ' + pl.zone), 'atlasOpenSquare(' + (0x8000 + pl.zone) + ',' + pl.x + ',' + pl.y + ')', pl.x + ', ' + pl.y) : 'inside something in ' + svEsc(zoneDisplayName(pl.zone) || ('zone ' + pl.zone))).join(', ') + '.' : ''),
          'A button drops a marble onto dot 0, 1 or 2. The marble flips the dot it lands on and rolls on; from a dot that is now lit it goes ' + at(td.lit.at, moves(td.lit)) + ', from a dot that is now dark ' + at(td.dark.at, moves(td.dark)) + ', and off the board from ' + off.join(', ') + '. The dots keep their state between uses.',
          ...td.patterns.map(p => (lit(p.v).length ? 'Dots ' + lit(p.v).join(', ') + ' lit' : 'Every dot dark').replace(/^Dots 0, 1, 2, 3, 4, 5, 6, 7 lit$/, 'Every dot lit') +
            ' sends signal ' + srcNum(p.sigAt) + (p.doors.length ? ', which opens the ' + p.doors.map(door).join(' and the ') : ', which nothing in the file answers') +
            (p.presses ? '. From the start: ' + presses(p.presses) + '.' : '. No sequence reaches it from the start.'))
        ], '');
    }
    add('signals', 'What a Signal Reaches', null, '',
      sig ? 'What a button, a bell or an instrument sends, and what receives it.'
          : 'The program sets the order a signal travels in. ' + MECH_NO_APP,
      [], signalsHtml);
  }

  // Who answers as whom is on the Dialogue sheet now (talkMechSection
  // in js/delv-sheets.js), above the conversations themselves.

  // ---- what the scripts lean on ----
  {
    const ln = leanRules();
    const topRows = ln ? ln.ranked.slice(0, 14).map(r =>
      '<tr><td>' + svChip(r.rid, '') + '</td>' + num(r.refs) +
      '<td class="mechSub">' + (r.calls === r.refs ? 'all of them calls'
        : r.calls ? r.calls + ' calls; the rest name it in an instruction'
        : 'named in an instruction, never called') + '</td></tr>') : [];
    const deadRows = ln ? ln.ranges.map(g => {
      const named = g.dead.filter(d => d.name);
      return '<tr><td>' + svEsc(g.label) + '<span class="mechSub"> ' + svEsc(g.what) + '</span></td>' +
        num(g.dead.length) + num(g.total) + '<td>' +
        (named.length ? named.map(d => svChip(d.rid, d.name)).join(' ') : '') +
        (g.dead.length > named.length ? '<span class="mechSub">' + (named.length ? ' and ' : '') +
          (g.dead.length - named.length) + ' unnamed</span>' : '') + '</td></tr>';
    }) : [];
    const busiest = ln && ln.ranked.length ? ln.ranked[0] : null;
    add('leans', 'What Calls What', null, '',
      ln ? 'Which parts of the file the scripts use, and which nothing uses.'
         : 'No file is open to read this from.',
      ln ? [
        '<b>' + ln.referencing + ' resources</b> use another and <b>' + ln.referenced + '</b> are used, over <b>' + ln.edges + ' uses</b> in all: ' +
          Object.keys(ln.kinds).map(k => '<b>' + ln.kinds[k] + '</b> ' + svEsc(k === 'call' ? 'by calling' : k === 'resource' ? 'by naming' : k === 'dref' ? 'by pointing inside' : k === 'table' ? 'by a table entry' : k)).join(', ') + '.',
        busiest ? 'The busiest is ' + svChip(busiest.rid, labelFor(busiest.rid) || '') + ', used <b>' + busiest.refs + '</b> times; most are used by nothing.' : '',
        'That is rarely a mistake; the program finds most things by number, such as an item’s script by its type.'
      ].filter(Boolean) : [],
      table(['resource', '#references', 'of which'], topRows) +
      (deadRows.length ? '<div class="partsTitle">No script in this file calls these</div>' +
        table(['range', '#uncalled', '#in range', 'which'], deadRows) : ''));
  }

  /* The sections in groups, in the maintainer's order (13 September 2026).
     Alphabetical was the old rule and it put the dice game first and the
     clock between karma and locks, which reads as a list of thirty things
     rather than as a subject.

     A group is a plain headed block, NOT a <details>. MECH_OPEN reopens a
     section by its own element id when a number was followed out of it, and
     a section reopened inside a shut group would be restored invisibly.

     A section's id never changes here. The mechLink call sites and the ids
     in SKILL_RULES name sections directly, and mechGo resolves
     `mech-<id>`, so grouping wraps sections and renames nothing. A section
     this table does not mention still appears, under Other, rather than
     vanishing from the sheet because a name was forgotten. */
  /* One group, or all of them when no tab was named.

     `value` is the category the tab was opened with; MECHANICS itself passes
     nothing and still draws the whole sheet, which the smoke's pins read. A
     deep link made before the split names MECHANICS and opens the first tab
     instead (parseDeepLink). Every section is built either way -- they are read
     off the scripts and the reading is the cost, not the placing -- so a tab
     shows its own and leaves the rest unplaced. */
  const only = value ? (value === MECH_TOOL_GROUP.value ? MECH_TOOL_GROUP : MECH_GROUP_BY_VALUE[value]) : null;
  const showing = only ? [only] : MECH_GROUPS;
  const seen = new Set();
  for (const { title, note, ids } of showing) {
    const mine = ids.map(id => sections.find(s => s.id === id)).filter(Boolean);
    if (!mine.length) continue;
    const h = document.createElement('div');
    h.className = 'propHead';
    h.innerHTML = '<span class="groupTitle">' + svEsc(title) + '</span>' +
                  (note ? '<span class="groupNote">' + svEsc(note) + '</span>' : '');
    box.appendChild(h);
    for (const sn of mine) {
      seen.add(sn.id);
      if (window.MECH_OPEN && window.MECH_OPEN.has(sn.el.id)) sn.el.open = true;
      box.appendChild(sn.el);
    }
    // A tab opened on its first section rather than on a column of closed
    // headings, unless the visitor has opened sections of their own.
    if (only && mine[0] && !(window.MECH_OPEN && window.MECH_OPEN.size)) mine[0].el.open = true;
  }
  /* A section no group names still has to be reachable rather than vanish.
     On the whole sheet it went under Other at the end; with a tab each there
     is no neutral tab to put it on, so it goes to the last one, Hackery,
     which is where unplaced machinery belongs anyway. The smoke requires
     this to be empty, so it is a net rather than a habit. */
  const lastGroup = MECH_GROUPS[MECH_GROUPS.length - 1];
  const orphans = sections.filter(s => !MECH_GROUPS.some(g => g.ids.indexOf(s.id) >= 0) && MECH_TOOL_GROUP.ids.indexOf(s.id) < 0);
  // What the smoke reads to fail on an unplaced section, rather than having
  // to infer it from the markup of whichever tab happened to catch it.
  window.MECH_UNPLACED = orphans.map(s => s.id);
  const rest = (!only || only === lastGroup) ? orphans.filter(s => !seen.has(s.id)) : [];
  if (rest.length) {
    const h = document.createElement('div');
    h.className = 'propHead';
    h.innerHTML = '<span class="groupTitle">Other</span>' +
                  '<span class="groupNote">Read from the scripts and not yet placed in a group.</span>';
    box.appendChild(h);
    for (const sn of rest.sort((a, b) => a.title.localeCompare(b.title))) {
      if (window.MECH_OPEN && window.MECH_OPEN.has(sn.el.id)) sn.el.open = true;
      box.appendChild(sn.el);
    }
  }
  // Open all and Close all, and nothing else over the sections: the
  // contents strip went on 9 September 2026.
  const all = document.createElement('div');
  all.className = 'foldAll';
  all.innerHTML = svLink('Open all', 'mechOpenAll(true)') + svLink('Close all', 'mechOpenAll(false)');
  box.insertBefore(all, box.firstChild);
  grid.appendChild(box);
  /* What this tab shows, not what was built. Every section is built whichever
     tab is open -- the reading is the cost, not the placing -- so
     sections.length would have every tab claiming all twenty-five while it
     displayed four. */
  out.textContent = only === MECH_TOOL_GROUP ? MECH_TOOL_GROUP.note :
    (seen.size + rest.length) + ' rules read from this file’s scripts' +
    (only ? ', under ' + only.title : '') + '. Each one says which script it comes from.';
  /* The patches section's file control and its report, wired after the
     sections are in the document. A patch already open is drawn again rather
     than forgotten, so leaving Hackery and coming back finds it where it was;
     resetDerivedCaches is what drops it, when the archive under it changes. */
  const pf = document.getElementById('patchFile');
  if (pf) {
    // The verifier reads "async () =>" as a call to a function named async,
    // so the read is a promise inside patchesOpenFile rather than an await.
    pf.onchange = function () { patchesOpenFile(pf.files && pf.files[0]); };
    renderPatchReport();
  }
  const cf = document.getElementById('compareFile');
  if (cf) {
    cf.onchange = function () {
      const file = cf.files && cf.files[0];
      if (!file) return;
      file.arrayBuffer().then(buf => compareOpenBytes(new Uint8Array(buf), file.name)).catch(e => {
        const note = document.getElementById('compareNote');
        if (note) { note.textContent = 'The page could not read that file: ' + e.message; note.className = 'mechSub patchBad'; }
      });
    };
    renderCompareReport();
  }
  // The hero's colours draw into their host once it is in the document.
  if (document.getElementById('heroSprite')) renderHeroSprite();
  if (document.getElementById('gremlinMaker')) renderGremlinMaker();
  if (document.getElementById('dataFixMaker')) renderDataFixMaker();
  if (document.getElementById('appFixMaker')) renderAppFixMaker();
  if (document.getElementById('spanishMaker')) renderSpanishMaker();
  if (document.getElementById('backstageMaker')) renderBackstageMaker();
}
// The cards open when a number on the sheet was followed into its script,
// so that back from the script finds them open again and setMode's scroll
// memory lands on the same place; a card that was shut would put the page
// somewhere else. Kept for the session, and only a followed number sets it.
window.MECH_OPEN = new Set();
/* Only the sections on the tab that is showing can be judged, so this merges
   rather than replaces. Replacing was right while the sheet was one page of
   everything; with a tab each it would throw away every other tab's folds the
   moment one tab was left, and a number followed out of Combat would come
   back to a shut card because Puzzles had been opened in between. */
function mechKeepPlace() {
  const grid = document.getElementById('sheetGrid');
  const all = grid && grid.querySelectorAll ? grid.querySelectorAll('details.mechSec') : [];
  const keep = new Set(window.MECH_OPEN || []);
  for (const d of all) { if (d.open) keep.add(d.id); else keep.delete(d.id); }
  window.MECH_OPEN = keep;
}
// Open a Mechanics section and scroll it into view; a plain anchor would
// rewrite the hash, which is the page's deep link.
function mechGo(id) {
  const el = document.getElementById('mech-' + id);
  if (!el) return;
  el.open = true;
  if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Every card on the sheet that is showing, open or shut at once.
function mechOpenAll(open) {
  const grid = document.getElementById('sheetGrid');
  const all = grid && grid.querySelectorAll ? grid.querySelectorAll('details.mechSec') : [];
  for (const d of all) d.open = !!open;
}

function renderPlaceholderSheet(note) {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  document.getElementById('output').textContent = note;
}
