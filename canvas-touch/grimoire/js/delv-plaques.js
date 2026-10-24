/* The start screen's buttons, carved again.

   The six words on the start screen's stone buttons (Onward, New Game, Open
   Game, Preferences, About, Quit) are not text. They are carved into
   pictures in Cythera Data's resource fork: PICT 132 is the whole screen,
   the six buttons on it with their words; PICT 139 to 144 are the six
   buttons alone, in the other lighting, which the program draws over 132 in
   the places START_PLAQUES gives; PICT 145 is Onward greyed. So swapping the
   game's font (swapGameFont) changes every word the game draws and leaves
   these alone. The maintainer's request of 22 October 2026 was for the font
   chosen in Grimoire to be carved into them in place of Ambrosia's
   lettering. The words appear nowhere in either file as text (the program's
   CNTL 129 to 131 are an older start dialog's "Onward!", "Load Player" and
   "New Player"), which is why they are in the table below.

   This file turns pixels into pixels and needs no canvas: plaqueLift lifts
   the carving off a button and plaqueCarve cuts a new word in, given the
   word's coverage, which the page draws in the chosen font (plaqueCover in
   js/page-fork.js, the only part that needs a browser).

   How the carving comes off. No two buttons share a speckle, so no button
   can lend another its blank stone, and a median across the six is no use
   either. The stone is fine speckle over smooth lighting, so the lighting
   is fitted, a straight line across each row through the stone of that row
   and two either side (plaqueLighting), and the speckle is the difference.
   Where the word was, the stone is the lighting plus speckle drawn at
   random from the same button's stone outside the word. Two first tries
   were wrong in ways worth not repeating: a polynomial over the whole
   plaque, carried from the margins into the middle, ran dark at the top of
   the word and light at the bottom; and trimming the speckle to small
   differences before drawing from it made the new stone twelve levels
   darker than the old, because the speckle leans bright and the trim cut
   the bright flecks. utilities/plaque_check.mjs fails if the fill's
   lightness strays from the stone around it.

   Where the word was is found by its shadows: pixels well below the
   lighting, in rows 7 to 23 only, since the four rivets sit in rows 4 and 5
   and 25 and 26, taken as the run of columns around the middle.

   How a word is cut: as Onward is, measured. The workbench's
   tools/plaques/ subtracts each button's lifted stone from the shipped
   button (the maintainer's idea, 22 October 2026: the Difference of the
   plain and the original rock), draws the file's Argos A Nouveau over the
   result, and fits by least squares where the word sits and how it is
   cut: the stroke's darkening, and the light and shade on its left and
   right sides and on its top and bottom (plaqueCarve's three parts), each
   part in each colour. The buttons on PICT 132 are lit otherwise than the
   pictures of them alone, so there are two cuts, START_PLAQUES.cut's
   `board` and `lit`. Onward is the button whose cut the maintainer judged
   best, round after round, and its two cuts serve every button. With a cut
   measured on each button, Preferences came out visibly out of step with
   the rest: its fit is the weakest, since its P is a character the file's
   Argos does not have and its word covers nearly all the stone. On top of
   the measured cut, the edge of the word's coverage is steepened a little,
   the lightening alone is made a quarter stronger, and a third of the
   stone's speckle comes out under a stroke: the maintainer chose those
   three by eye over fourteen rounds, and the rest of what was tried (a
   heavier or a lighter cut, smoother, sharper, thinner, cleaner walls,
   brighter light) is in the workbench's log under
   grimoire/start-buttons-0lv64i. The P is the one letter that cannot come
   back, in the file's face. */

const START_PLAQUES = {
  board: 132,
  W: 151, H: 31,
  // Each button's picture, the word carved in it, and where the program
  // draws it over the board: the top left of the picture in PICT 132, where
  // 139 to 144 sit over the board's buttons to the pixel (plaque_check.mjs
  // finds each there). 145, Onward greyed, is Onward's button.
  buttons: [
    { id: 139, word: 'Onward', x: 167, y: 102 },
    { id: 140, word: 'New Game', x: 167, y: 179 },
    { id: 141, word: 'Open Game', x: 167, y: 255 },
    { id: 142, word: 'Preferences', x: 431, y: 102 },
    { id: 143, word: 'About', x: 431, y: 179 },
    { id: 144, word: 'Quit', x: 431, y: 255 },
    { id: 145, word: 'Onward', x: 167, y: 102, grayed: true }
  ],
  // The stone, a long hexagon inside the bronze frame; the same in all seven.
  outline: [[20, 1], [131, 1], [147, 15], [131, 29], [20, 29], [4, 15]],
  rows: [7, 23],       // where a word can be; the rivets are above and below
  room: 110,           // the straight part of the stone, which a word must fit
  // Where a word goes on a button the search found none on.
  ink: { x0: 40, y0: 9, x1: 110, y1: 21 },
  /* Onward's cut, in each lighting, as the workbench's tools/plaques/fit.py
     and variants.py measure it on the shipped file (the header has how).
     `place`: the word's ascenders `ink_h` pixels tall, `track` pixels
     between letters beyond the face's spacing, each stroke `bold` pixels
     wider, and the ink's middle `dx` and its top `dy` pixels from the old
     word's shadows' box. `weights`: the stroke, across and down
     (plaqueCarve), as a share of the stone's lightness. `balance`: each
     part's weight in red, green and blue over its weight in lightness, a
     row a colour and a column a part. `bright`, `smooth` and the edge's
     steepening (`edge`, coverage from edge[0] ramping over edge[1]) are the
     maintainer's choices by eye. */
  cut: {
    lit: {
      place: { ink_h: 15.5, track: 0.5, bold: 1, dx: 1.5, dy: -0.5 },
      weights: [-0.381, 0.395, -0.365],
      balance: [[1.133, 0.942, 0.984], [0.992, 0.986, 1.005], [0.694, 1.225, 1.017]]
    },
    board: {
      place: { ink_h: 16, track: 0, bold: 0.5, dx: 0, dy: -1 },
      weights: [-0.506, -0.301, 0.281],
      balance: [[1.07, 0.928, 0.937], [0.997, 0.986, 0.955], [0.831, 1.259, 1.4]]
    },
    bright: 1.25,
    smooth: 0.3,
    edge: [0.1, 0.8]
  }
};

// The stone: a pixel is in it when its centre is inside the outline.
function plaqueStone(W, H) {
  const P = START_PLAQUES.outline, m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) m[y * W + x] = 1;
  }
  return m;
}
function plaqueErode(m, W, H, n) {
  let a = m;
  for (let k = 0; k < n; k++) {
    const b = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      b[i] = a[i] & a[i - 1] & a[i + 1] & a[i - W] & a[i + W];
    }
    a = b;
  }
  return a;
}
const plaqueLum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
/* The lighting, three numbers a pixel: for each row, a straight line across
   it fitted by least squares through the `use` pixels of that row and the
   two either side. A row with too few is given the nearest row's line.

   The buttons are lit in a U, some ten levels lighter at the ends than in
   the middle, and the middle is under the word, where no stone can be
   measured. A line runs over the dip, so the fill under a short word comes
   out up to six levels lighter than the stone beside it (plaque_check.mjs
   allows that and no more). Two ways round it were worse to look at: a
   parabola across each row bent too far where only the ends of a long
   word's rows are stone, fifteen levels out under Preferences; and a row
   term plus a column term, the columns measured above and below the word,
   took them from the bevel along the stone's edge, which is lit otherwise,
   and gave the fill a colour cast and visible edges. */
function plaqueLighting(rgba, use, W, H) {
  const out = new Float32Array(W * H * 3), fitted = new Array(H).fill(false);
  for (let y = 0; y < H; y++) {
    let n = 0, sx = 0, sxx = 0; const sv = [0, 0, 0], sxv = [0, 0, 0];
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++)
      for (let x = 0; x < W; x++) {
        const i = yy * W + x;
        if (!use[i]) continue;
        n++; sx += x; sxx += x * x;
        for (let c = 0; c < 3; c++) { sv[c] += rgba[i * 4 + c]; sxv[c] += x * rgba[i * 4 + c]; }
      }
    const det = n * sxx - sx * sx;
    if (n < 8 || !det) continue;
    for (let c = 0; c < 3; c++) {
      const b = (n * sxv[c] - sx * sv[c]) / det, a = (sv[c] - b * sx) / n;
      for (let x = 0; x < W; x++) out[(y * W + x) * 3 + c] = a + b * x;
    }
    fitted[y] = true;
  }
  for (let y = 0; y < H; y++) {
    if (fitted[y]) continue;
    let d = 1, from = -1;
    while (from < 0 && d < H) { if (y - d >= 0 && fitted[y - d]) from = y - d; else if (y + d < H && fitted[y + d]) from = y + d; d++; }
    if (from >= 0) out.copyWithin(y * W * 3, from * W * 3, (from + 1) * W * 3);
  }
  return out;
}
// A small seeded generator, so a button carved twice comes out the same.
function plaqueRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* A button with its word lifted off: {rgba, light, stone, ink}, where `ink`
   is the box the old word's shadows filled ({x0, y0, x1, y1}, inclusive),
   or null when there was none, and then the button comes back as it was. */
function plaqueLift(rgba, W, H, seed) {
  const stone = plaqueStone(W, H), inner = plaqueErode(stone, W, H, 3);
  let light = plaqueLighting(rgba, inner, W, H);
  const res = i => plaqueLum(rgba[i * 4] - light[i * 3], rgba[i * 4 + 1] - light[i * 3 + 1], rgba[i * 4 + 2] - light[i * 3 + 2]);
  const [r0, r1] = START_PLAQUES.rows;
  const on = new Uint8Array(W);
  for (let y = r0; y <= r1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (inner[i] && res(i) < -32) on[x] = 1; }
  // The run of columns around the middle, with gaps of up to twelve.
  const any = (a, b) => { for (let x = Math.max(0, a); x < Math.min(W, b); x++) if (on[x]) return true; return false; };
  let x0 = W >> 1, x1 = W >> 1;
  while (x0 > 0 && any(x0 - 12, x0)) x0--;
  while (x1 < W - 1 && any(x1 + 1, x1 + 13)) x1++;
  while (x0 < x1 && !on[x0]) x0++;
  while (x1 > x0 && !on[x1]) x1--;
  const out = new Uint8ClampedArray(rgba);
  if (!on[x0]) return { rgba: out, light, stone, ink: null };
  let y0 = -1, y1 = -1;
  for (let y = r0; y <= r1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    if (inner[i] && res(i) < -32) { if (y0 < 0) y0 = y; y1 = y; break; }
  }
  const ink = { x0, y0, x1, y1 };
  const inBox = (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2;
  // The lighting again, from stone with no letters in it.
  const clean = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inner[y * W + x] && !inBox(x, y)) clean[y * W + x] = 1;
  light = plaqueLighting(rgba, clean, W, H);
  // The speckle, from that stone, the rivets left out.
  const pool = [];
  for (let i = 0; i < W * H; i++) if (clean[i]) {
    const d = [0, 1, 2].map(c => rgba[i * 4 + c] - light[i * 3 + c]);
    if (Math.abs(plaqueLum(d[0], d[1], d[2])) < 80) pool.push(d);
  }
  const edge = plaqueErode(stone, W, H, 2), rnd = plaqueRandom(seed || 1);
  if (pool.length) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!edge[i] || !inBox(x, y)) continue;
    const d = pool[Math.floor(rnd() * pool.length)];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = light[i * 3 + c] + d[c];
  }
  return { rgba: out, light, stone, ink };
}
/* A word cut into a lifted button. `cover` is the word's coverage, W*H
   numbers from 0 to 1, drawn where the word should go; `lighting` is
   'board' for a button on PICT 132 and 'lit' for a picture of one alone,
   and picks the cut in START_PLAQUES.cut. */
function plaqueCarve(lifted, cover, W, H, lighting) {
  const { rgba, light, stone } = lifted, out = new Uint8ClampedArray(rgba);
  const cut = START_PLAQUES.cut, own = cut[lighting] || cut.lit;
  const [e0, e1] = cut.edge;
  const M = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0
    : Math.min(1, Math.max(0, (cover[y * W + x] * stone[y * W + x] - e0) / e1));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // The three parts: the stroke itself, the coverage to the left less the
    // coverage to the right (a stroke's left side against its right), and
    // above less below.
    const f = [M(x, y), M(x - 1, y) - M(x + 1, y), M(x, y - 1) - M(x, y + 1)];
    if (!f[0] && !f[1] && !f[2]) continue;
    const i = y * W + x;
    for (let c = 0; c < 3; c++) {
      let r = 0;
      for (let p = 0; p < 3; p++) r += f[p] * own.weights[p] * own.balance[c][p];
      if (r > 0) r *= cut.bright;
      // The stone's lighting moved by the cut, and its speckle darkened with
      // the cut but never lightened by it, a share of it taken out under
      // the stroke.
      const l = light[i * 3 + c], speck = (rgba[i * 4 + c] - l) * (1 - cut.smooth * f[0]);
      out[i * 4 + c] = l * (1 + r) + speck * (1 + Math.min(r, 0));
    }
  }
  return out;
}
// A W by H piece of a picture `PW` wide, and one put back.
function plaqueCrop(rgba, PW, x, y, W, H) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let r = 0; r < H; r++) out.set(rgba.subarray(((y + r) * PW + x) * 4, ((y + r) * PW + x + W) * 4), r * W * 4);
  return out;
}
function plaquePaste(rgba, PW, piece, x, y, W, H) {
  for (let r = 0; r < H; r++) rgba.set(piece.subarray(r * W * 4, (r + 1) * W * 4), ((y + r) * PW + x) * 4);
}
