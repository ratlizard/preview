/* ===========================================================================
   delv-fineart.js -- every picture of a scenario drawn again, with care
   (9 October 2026).

   Make a Scenario could already redraw the game's art badly on purpose
   (redrawDelverArt in delv-graphics.js: stick men and blobs) or take it
   from a pack of somebody else's tiles (delv-artpack.js). The maintainer
   asked for the opposite of the badly-drawn set: the page's best attempt
   at a set of its own. This file is that attempt, and it plugs into
   redrawDelverArt as the art pack does, as its `from` argument.

   WHAT IS DRAWN FROM NOTHING, AND WHAT IS PAINTED OVER THE OLD LAYOUT.
   A tile set is two kinds of picture. Some stand alone: a person, a
   beast, a face, a square of grass. Others are pieces: a wall is a dozen
   tiles in the game's leaning projection that must meet edge to edge, a
   tree is four, a shoreline is thirty. A piece drawn from nothing does
   not join its neighbours, and nothing in the file says which pieces go
   together, so the two kinds are treated differently and this header
   says which is which rather than leaving it to be found out:

     people and beasts   from nothing (faFigure). Small upright figures,
                         shaded from the upper left and outlined, in the
                         four facings and the strides the frame's place
                         in its run asks for. The old tile gives two
                         things only: the colour of the clothes or the
                         hide, so that two kinds of villager stay two
                         kinds, and nothing else.
     portraits           from nothing (faPortrait): a face, hair,
                         shoulders and a backdrop. The old portrait gives
                         the colours of skin, hair, clothes and backdrop,
                         so a green-faced creature stays green.
     ground              from nothing, a material at a time (faSwatch):
                         grass, water, sand, earth, stone, snow, lava,
                         each a texture that repeats every 32 pixels so
                         that any two tiles meet. WHERE each material
                         lies in a tile that mixes them (a shore, a
                         path's edge, a mountain's foot) is read from the
                         old tile, pixel by pixel, and smoothed; that is
                         what makes the shore's thirty pieces still a
                         shoreline. Water and lava are laid in the
                         palette's cycling indices, so they still move.
     everything else     walls, roofs, furniture, things carried, the
                         interface's buttons, the icons and the full
                         pictures: painted over the old picture
                         (faPaint). The shapes stay where they were. The
                         old dithering is smoothed away, the tones are
                         cut to a few flat steps with shadows pushed
                         cool and lights warm, a dark line is put where
                         two surfaces meet, and a thing with see-through
                         round it gets a dark rim. It is a repainting
                         and not a new drawing, and it is here because
                         the alternative was pieces that do not join.

   COLOUR. Everything is worked in RGB and brought to the palette at the
   end by nearness (faIndex), over indices 0x10 to 0xDF: index 0 is
   see-through in a sheet, 0x01 to 0x0F are the sixteen system colours,
   which are harsher than anything in the ramps, and 0xE0 up are the
   cycling ranges, used on purpose where something should move and never
   by accident. No dithering: flat steps are the look.

   Bytes in, bytes out, no DOM; classic script, after delv-graphics.js
   (PALETTE, PALETTE_CYCLES, badArtHash). The page's side is
   scenarioFineArt in page-data.js, which supplies the names.
   =========================================================================== */
const FA_RGB = PALETTE.map(h => { const v = parseInt(h, 16); return [v >> 16, (v >> 8) & 255, v & 255]; });
const FA_LUT = new Int16Array(1 << 18).fill(-1);
function faIndex(r, g, b) {
  r = r < 0 ? 0 : r > 255 ? 255 : r | 0; g = g < 0 ? 0 : g > 255 ? 255 : g | 0; b = b < 0 ? 0 : b > 255 ? 255 : b | 0;
  const k = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
  let v = FA_LUT[k];
  if (v >= 0) return v;
  let err = Infinity;
  for (let i = 0x10; i < 0xE0; i++) {
    const c = FA_RGB[i], e = 3 * (c[0] - r) ** 2 + 4 * (c[1] - g) ** 2 + 2 * (c[2] - b) ** 2;
    if (e < err) { err = e; v = i; }
  }
  return (FA_LUT[k] = v);
}
// A colour k of the way to light (k > 0) or to shadow (k < 0). Lights go
// warm and shadows cool, which is most of what makes flat steps read as form.
function faTone(c, k) {
  if (k >= 0) return [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k * 0.9, c[2] + (255 - c[2]) * k * 0.55];
  return [c[0] * (1 + k * 0.92), c[1] * (1 + k), c[2] * (1 + k * 0.9) + 6 * -k];
}
// Math.hypot is several times slower than this in every engine tried, and the canvas calls it per sample.
const faHyp = (x, y) => Math.sqrt(x * x + y * y);
const faLum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
// Value noise that repeats every 32 pixels both ways; `cell` divides 32.
function faNoise(x, y, cell, seed) {
  const n = 32 / cell, gx = x / cell, gy = y / cell, x0 = Math.floor(gx), y0 = Math.floor(gy), fx = gx - x0, fy = gy - y0;
  const v = (i, j) => (badArtHash(((i % n) + n) % n + (((j % n) + n) % n) * 57 + seed * 131) & 1023) / 1023;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return (v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx) * (1 - sy) + (v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx) * sy;
}

/* ---- ground ---------------------------------------------------------------
   A swatch is one material over a whole tile: 1,024 colours, or a palette
   index where the material cycles (stored as a number in place of the
   colour). Made once and kept. Every swatch wraps at 32, so a tile cut
   from two of them along any line still meets its neighbours. */
const FA_SWATCH = {};
function faSwatch(mat) {
  if (FA_SWATCH[mat]) return FA_SWATCH[mat];
  const s = new Array(1024), at = (x, y) => (((y % 32) + 32) % 32) * 32 + (((x % 32) + 32) % 32);
  const fill = f => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) s[y * 32 + x] = f(x, y); };
  const dab = (n, seed, f) => { for (let k = 0; k < n; k++) { const h = badArtHash(seed * 977 + k); f(h % 32, (h >> 5) % 32, h >> 10); } };
  // Flagstones or scales: the nearest of a few scattered points owns a pixel, and the seam between two is dark.
  const cells = (n, seed) => { const pts = []; for (let k = 0; k < n; k++) { const h = badArtHash(seed * 31 + k * 7); pts.push([h % 32, (h >> 5) % 32, ((h >> 10) & 255) / 255]); }
    return (x, y) => { let a = 1e9, b = 1e9, own = 0; for (const p of pts) { let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); if (dx > 16) dx = 32 - dx; if (dy > 16) dy = 32 - dy; const d = dx * dx + dy * dy * 1.6; if (d < a) { b = a; a = d; own = p; } else if (d < b) b = d; } return { edge: Math.sqrt(b) - Math.sqrt(a), tone: own[2], dx: x - own[0], dy: y - own[1] }; }; };
  const band = (v, steps) => Math.round(v * steps) / steps;
  if (mat === 'grass') {
    const base = [52, 138, 34];
    fill((x, y) => faTone(base, band((faNoise(x, y, 16, 1) * 0.25 + faNoise(x, y, 8, 2) * 0.4 + faNoise(x, y, 4, 24) * 0.35 - 0.5) * 0.5, 8)));
    // Blades: a light stroke two or three pixels tall with a dark pixel at its foot.
    dab(46, 3, (x, y, h) => { const k = 0.16 + (h & 3) * 0.04, lean = h & 4 ? 1 : 0; s[at(x, y)] = faTone(base, k); s[at(x + lean, y - 1)] = faTone(base, k + 0.08); if (h & 8) s[at(x + lean, y - 2)] = faTone(base, k + 0.14); s[at(x + 1, y + 1)] = faTone(base, -0.3); });
  } else if (mat === 'water') {
    const base = [10, 70, 150];
    fill((x, y) => faTone(base, band((faNoise(x, y, 16, 4) - 0.5) * 0.5, 6)));
    // Crests: short streaks along slow waves, in the cycling blues, lit along their length so the cycle runs down them.
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const wave = y + 2.2 * Math.sin((x + 5 * Math.sin(y * Math.PI / 16)) * Math.PI / 8);
      if ((((Math.round(wave) % 16) + 16) % 16) === 0 && faNoise(x, y, 8, 5) > 0.5) s[y * 32 + x] = 0xE8 + ((x + (y >> 2)) & 7);
    }
  } else if (mat === 'sand') {
    const base = [226, 184, 124];
    fill((x, y) => faTone(base, band(0.07 * Math.sin((y * 3 + 6 * faNoise(x, y, 16, 6)) * Math.PI / 8) + (faNoise(x, y, 8, 7) - 0.5) * 0.18, 10)));
    dab(18, 8, (x, y, h) => { s[at(x, y)] = faTone(base, h & 1 ? -0.22 : 0.3); });
  } else if (mat === 'earth') {
    const base = [124, 62, 34];
    fill((x, y) => faTone(base, band((faNoise(x, y, 16, 9) * 0.5 + faNoise(x, y, 4, 10) * 0.5 - 0.5) * 0.5, 8)));
    dab(9, 11, (x, y, h) => { const c = h & 1 ? [150, 120, 96] : [86, 40, 24]; s[at(x, y)] = c; s[at(x + 1, y)] = c; s[at(x, y + 1)] = faTone(c, -0.3); s[at(x + 1, y + 1)] = faTone(c, -0.3); });
  } else if (mat === 'stone' || mat === 'rock') {
    const rock = mat === 'rock', base = rock ? [138, 132, 128] : [156, 156, 164], cell = cells(rock ? 7 : 9, rock ? 12 : 13);
    fill((x, y) => { const c = cell(x, y); if (c.edge < 1.1) return faTone(base, -0.45);
      // Each stone a tone of its own, lit on its upper left edge and dark on its lower right.
      return faTone(base, band((c.tone - 0.5) * 0.3 + (c.dx + c.dy < -5 ? 0.16 : c.dx + c.dy > 5 ? -0.16 : 0) + (faNoise(x, y, 4, 14) - 0.5) * 0.1, 8)); });
  } else if (mat === 'snow') {
    const base = [236, 240, 252];
    fill((x, y) => faTone(base, band(-0.22 * Math.max(0, faNoise(x, y, 16, 15) * 0.7 + faNoise(x, y, 8, 16) * 0.3 - 0.45), 12)));
  } else if (mat === 'lava') {
    const cell = cells(6, 17);
    fill((x, y) => { const c = cell(x, y); return c.edge < 2.4 ? 0xE0 + ((Math.round(c.edge * 2 + faNoise(x, y, 8, 18) * 5) + 8) & 7) : faTone([88, 28, 20], band((c.tone - 0.5) * 0.4 + (c.dx + c.dy < -4 ? 0.2 : 0), 6)); });
  } else if (mat === 'leaves') {
    const base = [30, 104, 30], cell = cells(10, 19);
    fill((x, y) => { const c = cell(x, y); return faTone(base, band((c.edge < 1.2 ? -0.42 : 0) + (c.dx + c.dy < -3 ? 0.22 : c.dx + c.dy > 4 ? -0.2 : 0) + (faNoise(x, y, 4, 20) - 0.5) * 0.16, 8)); });
  } else if (mat === 'purple') {
    fill((x, y) => faTone([124, 18, 140], band((faNoise(x, y, 16, 21) * 0.6 + faNoise(x, y, 8, 22) * 0.4 - 0.5) * 0.7, 6)));
  } else fill((x, y) => faTone([22, 16, 30], band((faNoise(x, y, 8, 23) - 0.5) * 0.3, 4)));   // dark
  return (FA_SWATCH[mat] = s);
}
// Which material an old pixel was. The one judgement in the ground: made by
// looking at the shores, paths and mountains in false colour.
function faMaterial(i) {
  if (i >= 0xE0) return i < 0xE8 ? 'lava' : i < 0xF0 ? 'water' : i < 0xF4 ? 'purple' : i < 0xF8 ? 'earth' : i < 0xFC ? 'grass' : 'dark';
  const [r, g, b] = FA_RGB[i], hi = Math.max(r, g, b), lo = Math.min(r, g, b);
  if (hi < 48) return 'dark';
  if (hi - lo < 34) return hi > 208 ? 'snow' : 'rock';
  if (b === hi && b - r > 24) return r > g + 40 ? 'purple' : hi - lo < 70 && hi > 150 ? 'snow' : 'water';
  if (g === hi && g - r > 12) return 'grass';
  if (r > b + 60 && b > g + 20) return 'purple';
  return hi > 170 && g > r * 0.62 ? 'sand' : 'earth';
}
/* A tile of ground: each pixel's material read from the old tile and
   smoothed (the commonest within two pixels, which is what removes the old
   dithering), then filled from that material's swatch. Along a seam the
   upper material casts a line: foam where water meets land, a dark lip
   where grass overhangs sand or earth. Rock, snow and earth also take the
   old tile's light and shade at a blur of three pixels, which is the only
   thing that says a mountain has a lit side. Null when the tile is not
   mostly ground, for the painter to take. */
const FA_MATS = ['grass', 'water', 'sand', 'earth', 'rock', 'snow', 'lava', 'leaves', 'purple', 'dark', 'stone'];
function faGroundTile(old, name) {
  const raw = new Int8Array(1024), mat = new Int8Array(1024);
  const forest = /tree|bush|shrub|scrub/.test(name), wet = /swamp/.test(name), paved = /cavern|floor/.test(name);
  for (let i = 0; i < 1024; i++) { let m = old[i] ? faMaterial(old[i]) : null; if (forest && (m === 'dark' || (m === 'grass' && faLum(FA_RGB[old[i]]) < 78))) m = 'leaves'; if (m === 'rock' && paved) m = 'stone'; raw[i] = m ? FA_MATS.indexOf(m) : -1; }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    if (raw[y * 32 + x] < 0) { mat[y * 32 + x] = -1; continue; }
    const n = new Uint8Array(FA_MATS.length);
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const X = Math.min(31, Math.max(0, x + i)), Y = Math.min(31, Math.max(0, y + j)), m = raw[Y * 32 + X]; if (m >= 0) n[m] += (i || j) ? 1 : 2; }
    let best = raw[y * 32 + x]; for (let m = 0; m < n.length; m++) if (n[m] > n[best]) best = m;
    mat[y * 32 + x] = best;
  }
  // The old tile's light at a blur of three pixels, against its material's mean.
  const lum = new Float32Array(1024), mean = new Float32Array(FA_MATS.length), count = new Float32Array(FA_MATS.length);
  for (let i = 0; i < 1024; i++) if (old[i]) { lum[i] = faLum(FA_RGB[old[i]]); mean[mat[i]] += lum[i]; count[mat[i]]++; }
  const blur = (x, y, m) => { let t = 0, n = 0; for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) { const X = x + i, Y = y + j; if (X < 0 || Y < 0 || X > 31 || Y > 31 || mat[Y * 32 + X] !== m) continue; t += lum[Y * 32 + X]; n++; } return n ? t / n : 0; };
  const out = new Uint8Array(1024), rank = { water: 0, lava: 0, dark: 0, sand: 1, earth: 2, stone: 2, rock: 3, snow: 4, grass: 5, leaves: 6, purple: 3 };
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const i = y * 32 + x, m = mat[i];
    if (m < 0) continue;
    const name = FA_MATS[m];
    let c = faSwatch(name)[i];
    // A seam: look at the four neighbours for another material.
    let other = null;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X > 31 || Y > 31) continue; const o = mat[Y * 32 + X]; if (o >= 0 && o !== m) other = FA_MATS[o]; }
    if (other) {
      if (name === 'water') c = wet ? faTone([10, 70, 150], -0.3) : [196, 228, 252];
      else if (typeof c !== 'number') c = faTone(c, rank[name] > rank[other] ? -0.38 : -0.12);
    }
    if (typeof c === 'number') { out[i] = c; continue; }
    if (name === 'rock' || name === 'snow' || name === 'earth' || name === 'stone') c = faTone(c, Math.max(-0.5, Math.min(0.4, Math.round((blur(x, y, m) - mean[m] / count[m]) / 255 * 9) / 6)));
    out[i] = faIndex(c[0], c[1], c[2]);
  }
  return out;
}

/* ---- the painter ----------------------------------------------------------
   An old picture painted over: what a piece of a wall, a chair, a button
   or a full picture gets. Four steps. (1) The picture is smoothed twice
   with a filter that averages a pixel with those of its neighbours near
   it in colour, so dithering goes flat and an edge stays an edge. (2) The
   light of each pixel is cut to steps of a twelfth, colour is pushed a
   little past where it was, shadows are cooled and lights warmed. (3) A
   pixel on the dark side of a strong edge is darkened, which draws the
   line between two surfaces. (4) With `rim`, an opaque pixel beside a
   see-through one is drawn dark, which is the outline of a thing.
   See-through stays see-through and a cycling pixel stays as it is, so a
   fire still burns. */
function faPaint(img, W, H, rim) {
  const N = W * H, src = [new Float32Array(N), new Float32Array(N), new Float32Array(N)], live = new Uint8Array(N);
  for (let i = 0; i < N; i++) { const v = img[i]; if (!v || v >= 0xE0) continue; live[i] = 1; const c = FA_RGB[v]; src[0][i] = c[0]; src[1][i] = c[1]; src[2][i] = c[2]; }
  // The filter's two weights from tables: near in place (five by five), near in colour (by the squared distance over 64).
  const place = [], near = new Float32Array(3100);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) place.push(Math.exp(-(dx * dx + dy * dy) / 6));
  for (let k = 0; k < near.length; k++) near[k] = Math.exp(-k * 64 / 3000);
  let a = src;
  for (let pass = 0; pass < 2; pass++) {
    const b = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!live[i]) continue;
      let r = 0, g = 0, bl = 0, wt = 0;
      for (let dy = -2; dy <= 2; dy++) { const Y = y + dy; if (Y < 0 || Y >= H) continue;
        for (let dx = -2; dx <= 2; dx++) { const X = x + dx; if (X < 0 || X >= W) continue; const j = Y * W + X; if (!live[j]) continue;
          const e0 = a[0][j] - a[0][i], e1 = a[1][j] - a[1][i], e2 = a[2][j] - a[2][i], w = near[(e0 * e0 + e1 * e1 + e2 * e2) >> 6] * place[(dy + 2) * 5 + dx + 2];
          r += a[0][j] * w; g += a[1][j] * w; bl += a[2][j] * w; wt += w; } }
      b[0][i] = r / wt; b[1][i] = g / wt; b[2][i] = bl / wt;
    }
    a = b;
  }
  const lum = new Float32Array(N), out = new Uint8Array(N);
  for (let i = 0; i < N; i++) lum[i] = 0.3 * a[0][i] + 0.59 * a[1][i] + 0.11 * a[2][i];
  const at = (x, y, i) => (x < 0 || y < 0 || x >= W || y >= H || !live[y * W + x]) ? lum[i] : lum[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!live[i]) { out[i] = img[i]; continue; }
    const l = lum[i], step = Math.max(8, Math.round(l / 21) * 21), k = step / Math.max(l, 1);
    let c = [step + (a[0][i] * k - step) * 1.18, step + (a[1][i] * k - step) * 1.18, step + (a[2][i] * k - step) * 1.18];
    if (step < 96) { c[2] += (96 - step) * 0.22; c[0] -= (96 - step) * 0.08; } else if (step > 168) { c[0] += (step - 168) * 0.12; c[2] -= (step - 168) * 0.16; }
    const gx = at(x + 1, y, i) - at(x - 1, y, i), gy = at(x, y + 1, i) - at(x, y - 1, i), nb = (at(x + 1, y, i) + at(x - 1, y, i) + at(x, y + 1, i) + at(x, y - 1, i)) / 4;
    if (Math.abs(gx) + Math.abs(gy) > 62 && l < nb) c = [c[0] * 0.62, c[1] * 0.6, c[2] * 0.66];
    if (rim && ((x > 0 && !img[i - 1]) || (x < W - 1 && !img[i + 1]) || (y > 0 && !img[i - W]) || (y < H - 1 && !img[i + W]))) c = [c[0] * 0.3 + 6, c[1] * 0.28 + 4, c[2] * 0.34 + 10];
    out[i] = faIndex(c[0], c[1], c[2]);
  }
  return out;
}

/* ---- the whole set, as redrawDelverArt's `from` ---------------------------
   `name(id)` is the page's: what the file calls a tile. Ground is a name
   the first list below holds on a tile with no see-through pixels; a tile
   with some is ground only by the second list, since a shore or a snowcap
   laid over another tile is still ground and a tree standing on one is
   not. */
const FA_GROUND = /^(grass|earth|embankment|wet earth|shore|water|sand|swamp|scrub|shrub|field|ground|lava|puddle|pool|mountains?|snowcaps|bush|tree|dead tree|crops|abyss|farmlands|water pool)$/;
const FA_GROUND_OVER = /^(grass|shore|mountains?|snowcaps|water pool|farmlands)$/;
function fineArt(name) {
  const looks = {};
  return {
    tile(id, old, figure) {
      if (!old.some(v => v)) return null;
      if (figure) { const f = faFigure(old, figure, looks); if (f) return f; }
      const called = String(name(id) || '').toLowerCase();
      if (!figure && (old.includes(0) ? FA_GROUND_OVER : FA_GROUND).test(called)) return faGroundTile(old, called);
      return faPaint(old, 32, 32, old.includes(0));
    },
    portrait(resid, W, H, d) { return d && W === 64 && H === 64 ? faPortrait(d.image, resid) : null; },
    picture(subn, resid, d) {
      /* A picture that is one texture from edge to edge (the backdrop
         behind the windows is the case) has nothing for the painter to
         keep: smoothed, its grain comes out as blotches. It is told by
         its blocks of eight pixels all having much the same mean while
         its pixels differ, and is laid afresh as its mean colour with a
         quiet grain. */
      const { W, H, image } = d;
      if (W >= 64 && H >= 64 && !image.includes(0)) {
        let n = 0, sum = [0, 0, 0], sq = 0; const blocks = [];
        for (let by = 0; by + 8 <= H; by += 8) for (let bx = 0; bx + 8 <= W; bx += 8) { let l = 0; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = FA_RGB[image[(by + y) * W + bx + x]], v = faLum(c); l += v; sq += v * v; sum[0] += c[0]; sum[1] += c[1]; sum[2] += c[2]; n++; } blocks.push(l / 64); }
        const mean = (sum[0] * 0.3 + sum[1] * 0.59 + sum[2] * 0.11) / n, pixelVar = sq / n - mean * mean, blockVar = blocks.reduce((a, v) => a + (v - mean) ** 2, 0) / blocks.length;
        if (pixelVar > 40 && blockVar < pixelVar * 0.12) { const base = sum.map(v => v / n), out = new Uint8Array(W * H);
          for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = faTone(base, Math.round(((faNoise(x, y, 8, 30) * 0.5 + faNoise(x, y, 4, 31) * 0.5) - 0.5) * 0.36 * 8) / 8); out[y * W + x] = faIndex(c[0], c[1], c[2]); }
          return out; }
      }
      return faPaint(image, W, H, false);
    }
  };
}

/* ---- a canvas for drawing from nothing ------------------------------------
   Shapes are drawn at S times the picture's size and averaged down, which
   is what makes a curve's edge fall on the right pixels. A shape is a
   distance function (negative inside); its shading comes from the same
   function, as if the shape were a cushion `depth` pixels thick lit from
   the upper left, cut to four flat tones. A base that is a number is a
   palette index laid flat, for the cycling colours. px() sets one finished
   pixel, for an eye. done(rim) returns the indices, with a dark line round
   the whole drawing where rim is set. */
function faCanvas(W, H, S) {
  const w = W * S, h = H * S, col = new Float32Array(w * h * 3), cov = new Uint8Array(w * h), fixed = new Uint8Array(w * h), pokes = [], c = {};
  c.shape = (x0, y0, x1, y1, sdf, base, depth, flat) => {
    const X0 = Math.max(0, Math.floor(x0 * S)), X1 = Math.min(w - 1, Math.ceil(x1 * S)), Y0 = Math.max(0, Math.floor(y0 * S)), Y1 = Math.min(h - 1, Math.ceil(y1 * S));
    for (let Y = Y0; Y <= Y1; Y++) for (let X = X0; X <= X1; X++) {
      const x = (X + 0.5) / S, y = (Y + 0.5) / S, d = sdf(x, y);
      if (d > 0) continue;
      const i = Y * w + X;
      cov[i] = 1;
      if (typeof base === 'number') { fixed[i] = base; continue; }
      fixed[i] = 0;
      let k = 0;
      if (!flat) {
        const gx = sdf(x + 0.3, y) - d, gy = sdf(x, y + 0.3) - d, gl = faHyp(gx, gy) || 1, l = (gx * -0.6 + gy * -0.8) / gl * Math.max(0, Math.min(1, 1 + d / depth));
        k = l > 0.42 ? 0.3 : l > -0.12 ? 0 : l > -0.5 ? -0.26 : -0.46;
      }
      const t = k ? faTone(base, k) : base;
      col[i * 3] = t[0]; col[i * 3 + 1] = t[1]; col[i * 3 + 2] = t[2];
    }
  };
  c.ell = (cx, cy, rx, ry, base, flat) => c.shape(cx - rx, cy - ry, cx + rx, cy + ry, (x, y) => (faHyp((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry), base, Math.min(rx, ry), flat);
  c.cap = (ax, ay, bx, by, ra, rb, base, flat) => { const vx = bx - ax, vy = by - ay, vv = vx * vx + vy * vy || 1, r = Math.max(ra, rb);
    c.shape(Math.min(ax, bx) - r, Math.min(ay, by) - r, Math.max(ax, bx) + r, Math.max(ay, by) + r, (x, y) => { const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / vv)); return faHyp(x - ax - vx * t, y - ay - vy * t) - (ra + (rb - ra) * t); }, base, r, flat); };
  // A convex polygon, its corners in either order.
  c.poly = (pts, base, depth, flat) => { let area = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; area += p[0] * q[1] - q[0] * p[1]; }
    const sg = area > 0 ? 1 : -1, edges = pts.map((p, i) => { const q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dy = q[1] - p[1], l = faHyp(dx, dy) || 1; return [p[0], p[1], dy / l * sg, -dx / l * sg]; });
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    c.shape(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (x, y) => { let d = -1e9; for (const e of edges) { const v = (x - e[0]) * e[2] + (y - e[1]) * e[3]; if (v > d) d = v; } return d; }, base, depth || 3, flat); };
  c.px = (x, y, base) => pokes.push([Math.round(x), Math.round(y), base]);
  c.done = (rim, under) => {
    const out = under || new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let n = 0, r = 0, g = 0, b = 0, fx = 0, nf = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const q = (y * S + j) * w + x * S + i; if (!cov[q]) continue; n++; if (fixed[q]) { fx = fixed[q]; nf++; } else { r += col[q * 3]; g += col[q * 3 + 1]; b += col[q * 3 + 2]; } }
      if (n * 2 < S * S) continue;
      out[y * W + x] = nf * 2 > n ? fx : nf === n ? fx : faIndex(r / (n - nf), g / (n - nf), b / (n - nf));
    }
    for (const [x, y, base] of pokes) if (x >= 0 && y >= 0 && x < W && y < H) out[y * W + x] = typeof base === 'number' ? base : faIndex(base[0], base[1], base[2]);
    if (rim) { const line = faIndex(26, 18, 34), was = out.slice();
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!was[y * W + x] && ((x > 0 && was[y * W + x - 1]) || (x < W - 1 && was[y * W + x + 1]) || (y > 0 && was[y * W + x - W]) || (y < H - 1 && was[y * W + x + W]))) out[y * W + x] = line; }
    return out;
  };
  return c;
}

/* ---- people and beasts ----------------------------------------------------
   What the old tile gives a figure: the colour it had most of that is not
   skin and not outline (its clothes or its hide) and the one after it.
   The first frame met of a run settles it for the run, so a walk does not
   change colour between strides. */
function faLook(old) {
  const rows = Array.from({ length: 16 }, () => [0, 0, 0, 0]);
  let skin = 0, all = 0;
  for (let i = 0; i < old.length; i++) { const v = old[i]; if (!v || v >= 0xE0) continue; const c = FA_RGB[v]; if (faLum(c) < 20) continue; all++;
    if ((v >> 4) === 0xA || ((v >> 4) === 0xB && (v & 15) < 6)) { skin++; continue; }
    const r = rows[v >> 4]; r[0]++; r[1] += c[0]; r[2] += c[1]; r[3] += c[2]; }
  // Colour counts for more than grey, so a robe's red is chosen over its pale trim.
  const worth = r => { if (!r[0]) return 0; const hi = Math.max(r[1], r[2], r[3]), lo = Math.min(r[1], r[2], r[3]); return r[0] * (0.45 + (hi - lo) / Math.max(hi, 1)); };
  rows.sort((a, b) => worth(b) - worth(a));
  const mean = r => { const c = [r[1] / r[0], r[2] / r[0], r[3] / r[0]], l = faLum(c); return l < 84 ? c.map(v => v * 84 / Math.max(l, 1) * 0.8 + 16) : c; };
  const main = rows[0][0] ? mean(rows[0]) : [150, 150, 156];
  return { main, second: rows[1][0] > all * 0.08 ? mean(rows[1]) : faTone(main, -0.32), skin: skin > all * 0.04 };
}
const FA_SKINS = [[244, 196, 160], [232, 172, 128], [204, 140, 96], [156, 100, 64]];
const FA_HAIRS = [[84, 52, 28], [44, 34, 34], [216, 172, 76], [156, 64, 28], [120, 84, 44], [188, 188, 196]];
const FA_STEEL = [176, 184, 200], FA_GOLD = [244, 196, 40], FA_BONE = [232, 228, 204], FA_WOOD = [136, 88, 48], FA_INK = [30, 22, 36];
/* What each of the game's people wears, by the name its prop has. The one
   judgement among the figures, and made from the names alone: nothing
   here was read off a sprite. A name not listed is dressed as "man". */
const FA_KITS = {
  man: {}, woman: { long: 1, robe: 1 }, child: { sc: 0.78 }, beggar: { hat: 'hood' }, fighter: { hat: 'helm', sword: 1 }, fool: { hat: 'jester' },
  guard: { hat: 'helm', spear: 1 }, hunter: { hat: 'cap' }, king: { hat: 'crown', robe: 1, beard: 1 }, lich: { skull: 1, robe: 1, hat: 'crown' },
  mage: { robe: 1, hat: 'wizard', beard: 1 }, magess: { robe: 1, hat: 'wizard', long: 1 }, nobleman: { hat: 'cap' }, noblewoman: { robe: 1, long: 1 },
  ruffian: { hat: 'bandana' }, workman: { hat: 'cap' }, seldane: { robe: 1, bald: 1, hide: 1 }, skeleton: { skull: 1, thin: 1 }, undead: { bald: 1, skin: [150, 168, 140] },
  ghost: { robe: 1, bald: 1, skin: [224, 232, 252], pale: 1 }, golem: { bald: 1, wide: 1, hide: 1 }, demon: { hat: 'horns', bald: 1, skin: [200, 48, 32] },
  corpse: { lying: 1 }, harpy: { wings: 1, long: 1 }, sylph: { wings: 1, long: 1, sc: 0.85 }, hero: {}, heroine: { long: 1 }
};
const FA_BEASTS = {
  wolflizard: ['quad', { len: 12, r: 3.4, leg: 6, snout: 3.6, tail: 7, spikes: 1 }], ratlizard: ['quad', { len: 8, r: 2.6, leg: 3, snout: 2.4, tail: 7, low: 1 }],
  gator: ['quad', { len: 13, r: 2.8, leg: 2.5, snout: 5, tail: 7, low: 1, thick: 1 }], gecko: ['quad', { len: 7, r: 2, leg: 2, snout: 1.6, tail: 5, low: 1 }],
  unicorn: ['quad', { len: 12, r: 4, leg: 9, snout: 3, tail: 5, horn: 1, mane: 1 }], goat: ['quad', { len: 9, r: 3.4, leg: 6, snout: 2, tail: 1.5, horns: 1 }],
  asp: ['serpent', { r: 1.7, len: 11, wave: 3 }], 'giant slug': ['serpent', { r: 3.6, len: 8, wave: 1, stalks: 1 }], 'sea monster': ['serpent', { r: 3.4, len: 11, wave: 2.4 }], tentacle: ['serpent', { r: 2.6, len: 11, wave: 3, blind: 1 }],
  ooze: ['blob', {}], 'land jellyfish': ['blob', { jelly: 1 }], polyp: ['blob', { stalk: 1 }], firespirit: ['blob', { fire: 1 }], crab: ['crab', {}], bird: ['bird', {}], chicken: ['bird', { comb: 1 }]
};
function faFigure(old, figure, looks) {
  const name = String(figure.name || '').toLowerCase(), beast = FA_BEASTS[name];
  if (!beast && !FA_KITS[name] && figure.kind === 'beast') return null;
  const kit = FA_KITS[name] || FA_KITS.man, key = kit.lying ? figure.base + ':' + figure.frame : figure.base;
  const look = looks[key] || (looks[key] = faLook(old)), h = badArtHash(kit.lying ? figure.base * 16 + figure.frame : figure.base);
  // The frame's place in its run: a quarter of the run to a facing, north, east, south, west; within it the stride.
  const per = Math.max(1, name === 'gator' ? 2 : Math.round((figure.of || 4) / 4)), facing = kit.lying ? 2 : Math.floor(figure.frame / per) & 3, at = figure.frame % per;
  const sw = per >= 4 ? [0, 1, 0, -1][at & 3] : per >= 2 ? [0, 1][at & 1] : 0;
  const c = faCanvas(32, 32, 3), flip = facing === 3 || (kit.lying && (h & 1)), sc = kit.sc || 1;
  const T = (x, y) => { if (flip) x = 32 - x; x = 16 + (x - 16) * sc; y = 30 + (y - 30) * sc; return kit.lying ? [y - 1, 23 + (x - 16)] : [x, y]; };
  const E = (cx, cy, rx, ry, base, flat) => { const p = T(cx, cy); if (kit.lying) c.ell(p[0], p[1], ry * sc, rx * sc, base, flat); else c.ell(p[0], p[1], rx * sc, ry * sc, base, flat); };
  const C = (ax, ay, bx, by, ra, rb, base, flat) => { const p = T(ax, ay), q = T(bx, by); c.cap(p[0], p[1], q[0], q[1], ra * sc, rb * sc, base, flat); };
  const P = (pts, base, depth) => c.poly(pts.map(p => T(p[0], p[1])), base, depth);
  const X = (x, y, base) => { const p = T(x + 0.5, y + 0.5); c.px(Math.floor(p[0]), Math.floor(p[1]), base); };
  if (beast) faBeast(beast[0], beast[1], { E, C, P, X }, look, facing, sw, at);
  else faPerson(kit, { E, C, P, X }, look, h, facing === 0 ? 'back' : facing === 2 ? 'front' : 'side', sw, figure.kind === 'hero');
  return c.done(true);
}
function faPerson(k, d, look, h, view, sw, hero) {
  const { E, C, P, X } = d;
  let skin = k.skin || (k.skull ? FA_BONE : k.hide ? look.second : FA_SKINS[h % 3 + ((h >>> 4) & 1)]), hair = FA_HAIRS[(h >>> 6) % FA_HAIRS.length];
  let top = k.skull && k.thin ? FA_BONE : k.pale ? [200, 212, 244] : look.main, low = k.robe ? faTone(top, -0.1) : k.thin ? FA_BONE : look.second;
  if (hero) { top = k.long ? [164, 44, 60] : [40, 92, 180]; low = k.long ? [96, 68, 44] : [84, 84, 96]; hair = k.long ? [156, 64, 28] : [84, 52, 28]; skin = FA_SKINS[1]; }
  const shoe = k.thin ? FA_BONE : [76, 48, 32], bald = k.bald || k.skull, hood = k.hat === 'hood';
  if (hood) hair = faTone(top, -0.14);
  const tw = k.thin ? 2.3 : k.wide ? 5.2 : k.robe || k.long ? 3.8 : 4.2, lr = k.thin ? 1 : 1.9, ar = k.thin ? 0.9 : 1.6, wd = k.wide ? 1 : 0;
  const side = view === 'side', back = view === 'back', hx = side ? 16.6 : 16;
  if (k.wings) for (const s of [-1, 1]) { C(16 + s * 3, 16, 16 + s * 11, 9 - sw, 2.4, 1, [224, 216, 232]); C(16 + s * 3, 17, 16 + s * 10, 17 + sw, 2.2, 0.8, [196, 188, 212]); }
  if (k.spear) { C(side ? 21 : 24.4, 2.5, side ? 21 : 24.4, 29.5, 0.6, 0.6, FA_WOOD, true); X(side ? 20 : 24, 1, FA_STEEL); X(side ? 20 : 24, 2, FA_STEEL); X(side ? 20 : 24, 0, FA_STEEL); }
  if (k.long && !back) C(side ? 14 : 16, 9, side ? 13.4 : 16, 17, side ? 3.2 : 5.3, side ? 2.4 : 4.7, hair);
  if (side) {
    const f = sw * 2.6;
    if (k.robe) { P([[12.6, 19], [19.4, 19], [20.8, 29.4], [11.2, 29.4]], low, 4); if (!k.pale) E(16.6 + f * 0.5, 29.6, 2.1, 1.1, shoe); }
    else { C(16, 22, 16 - f, 28.3, lr, lr - 0.2, faTone(low, -0.2)); E(16.6 - f, 29.3, lr + 0.4, 1.3, faTone(shoe, -0.2)); C(16, 22, 16 + f, 28.3, lr, lr - 0.2, low); E(16.6 + f, 29.3, lr + 0.4, 1.3, shoe); }
    C(16, 16.2, 16, 21.2, tw - 0.7, tw - 1, top);
    C(16, 16.4, 16 - sw * 2.2, 21.2, ar, ar - 0.2, faTone(top, -0.12)); E(16 - sw * 2.2, 22.3, ar - 0.2, ar - 0.2, skin);
    if (k.sword) C(16 - sw * 2.2, 22, 16 - sw * 2.2 + 6, 15, 0.7, 0.4, FA_STEEL, true);
    if (!bald) E(15.4, 8.8, 5.5, 5.5, hair);
    E(bald ? 16.4 : 17.2, 10 - (bald ? 0.6 : 0), bald ? 4.9 : 4.1, bald ? 5 : 4.4, skin);
    if (k.beard) E(19.2, 13.4, 2.4, 2.4, hair);
    X(19, 9, FA_INK); X(19, 10, FA_INK);
    if (k.skull) { X(18, 9, FA_INK); X(18, 10, FA_INK); X(19, 13, FA_INK); X(20, 13, FA_INK); }
  } else {
    if (k.robe) { P([[11.6, 19], [20.4, 19], [22.4, 29.4], [9.6, 29.4]], low, 4); if (!k.pale) { E(13.6 + sw * 0.7, 29.7, 1.9, 1.1, shoe); E(18.4 + sw * 0.7, 29.7, 1.9, 1.1, shoe); } }
    else for (const s of [-1, 1]) { C(16 + s * 2.3, 22, 16 + s * 2.3, 28 + s * sw, lr, lr - 0.2, low); E(16 + s * 2.3, 29.2 + s * sw, lr + 0.3, 1.3, shoe); }
    C(16, 16.2, 16, 21.2, tw, tw - 0.4, top);
    if (!k.robe && !k.thin) C(12.4, 21.6, 19.6, 21.6, 0.7, 0.7, faTone(low, -0.35), true);
    if (k.thin) for (const y of [16, 18, 20]) for (let x = 14; x <= 17; x++) X(x, y, FA_INK);
    for (const s of [-1, 1]) { C(16 + s * (tw + 0.4 + wd), 16.2, 16 + s * (tw + 1.2 + wd), 21 - s * sw * 1.3, ar, ar - 0.2, top); E(16 + s * (tw + 1.3 + wd), 22.2 - s * sw * 1.3, ar - 0.2, ar - 0.2, skin); }
    if (k.sword) C(16 + tw + 1.3, 22, 16 + tw + 4.6, 12.5, 0.7, 0.4, FA_STEEL, true);
    if (!bald) E(16, 8.8, 5.6, 5.5, hair);
    if (back && k.long) C(16, 9, 16, 17.5, 5.3, 4.6, hair);
    if (!back || bald) E(16, bald ? 9.3 : 10, bald ? 5 : 4.5, bald ? 5.1 : 4.5, skin);
    if (!back) {
      if (!bald && !hood) E(16, 6, 4.5, 1.9, hair);
      if (k.beard) E(16, 13.5, 3.3, 2.5, hair);
      X(14, 10, FA_INK); X(17, 10, FA_INK); X(14, 11, FA_INK); X(17, 11, FA_INK);
      if (k.skull) { X(13, 10, FA_INK); X(13, 11, FA_INK); X(18, 10, FA_INK); X(18, 11, FA_INK); for (let x = 14; x <= 17; x++) X(x, 13, FA_INK); }
      else if (!k.beard) { X(15, 13, faTone(skin, -0.4)); X(16, 13, faTone(skin, -0.4)); }
    }
  }
  if (k.hat === 'helm') { E(hx, 7.2, 5.9, 4.7, FA_STEEL); C(hx - 5.4, 8.8, hx + 5.4, 8.8, 0.6, 0.6, faTone(FA_STEEL, -0.4), true); if (view === 'front') { X(15, 9, faTone(FA_STEEL, -0.2)); X(16, 9, faTone(FA_STEEL, -0.2)); X(15, 10, FA_STEEL); X(16, 10, FA_STEEL); } }
  else if (k.hat === 'crown') { C(hx - 4.2, 4.8, hx + 4.2, 4.8, 1.3, 1.3, FA_GOLD); for (const o of [-4, 0, 4]) { X(hx + o - 0.5, 2, FA_GOLD); X(hx + o - 0.5, 3, FA_GOLD); } X(hx - 0.5, 4, [220, 30, 30]); }
  else if (k.hat === 'wizard') { const hat = faTone(look.main, -0.28); P([[hx, -2], [hx + 5.4, 6.4], [hx - 5.4, 6.4]], hat, 3); E(hx, 6.5, 7.4, 1.7, hat); X(hx - 0.5, 3, FA_GOLD); }
  else if (k.hat === 'cap') E(hx, 5.4, 5.3, 2.9, faTone(look.second, -0.1));
  else if (k.hat === 'bandana') { C(hx - 4.8, 6.2, hx + 4.8, 6.2, 1.4, 1.4, [196, 40, 36]); if (side || back) C(hx - 5, 6.4, hx - 7.6, 9, 0.9, 0.5, [196, 40, 36]); }
  else if (k.hat === 'jester') { C(hx - 2, 5.2, hx - 8, 2.6, 2.3, 0.9, [204, 44, 44]); C(hx + 2, 5.2, hx + 8, 2.6, 2.3, 0.9, [52, 92, 200]); X(hx - 9, 2, FA_GOLD); X(hx + 8, 2, FA_GOLD); }
  else if (k.hat === 'horns') for (const s of [-1, 1]) C(hx + s * 3.6, 5.4, hx + s * 6.2, 1.4, 1.2, 0.3, FA_BONE);
}
function faBeast(plan, q, d, look, facing, sw, at) {
  const { E, C, P, X } = d, hide = look.main, dark = faTone(hide, -0.22), side = facing === 1 || facing === 3, dir = facing === 0 ? -1 : 1;
  if (plan === 'quad') {
    const r = q.r, tr = q.thick ? r * 0.7 : 1.1;
    if (side) {
      const by = 29.5 - q.leg - r * 0.8, x0 = 15 - q.len / 2, x1 = 15 + q.len / 2, hx = x1 + r * 0.7, hy = q.low ? by + 0.3 : by - r * 0.7;
      C(x0 - r * 0.5, by - 0.3, x0 - r * 0.5 - q.tail, by - (q.low ? -1.2 : 3) + sw, tr, 0.4, hide);
      [[x0 + 2.6, -1], [x1 - 0.2, 1]].forEach(([x, s]) => C(x, by + r * 0.4, x - s * sw * 1.8 - 0.6, 29.2, 1.3, 0.8, dark));
      C(x0, by, x1, by, r, r * 0.92, hide);
      [[x0 + 0.4, 1], [x1 - 2.6, -1]].forEach(([x, s]) => { C(x, by + r * 0.4, x - s * sw * 1.8 - 0.6, 29.2, 1.4, 0.8, hide); });
      if (q.spikes) for (let k = 0; k < 5; k++) C(x0 + 0.6 + k * (q.len / 4.4), by - r + 0.4, x0 - 0.4 + k * (q.len / 4.4), by - r - 1.9, 0.7, 0.2, dark);
      if (!q.low) C(x1 - 0.5, by - r * 0.3, hx - 0.5, hy, r * 0.7, r * 0.6, hide);
      if (q.mane) C(x1 - 1.6, by - r * 0.9, hx - 1.6, hy - r * 0.5, 1.5, 1.2, [236, 232, 240]);
      E(hx, hy, r * 0.82, r * 0.72, hide); C(hx + 1, hy + 0.5, hx + 1 + q.snout, hy + 0.9, r * 0.5, r * 0.36, hide);
      if (!q.low) C(hx - 1, hy - r * 0.55, hx - 1.8, hy - r * 1.15, 0.9, 0.3, dark);
      if (q.horn) C(hx + 1.2, hy - r * 0.6, hx + 4.4, hy - r * 0.6 - 5, 0.8, 0.2, FA_GOLD);
      if (q.horns) C(hx - 0.4, hy - r * 0.6, hx - 3, hy - r * 0.6 - 3.4, 0.8, 0.2, FA_BONE);
      X(hx + 0.6, hy - 1, FA_INK);
    } else {
      const L = q.len * 0.5, cy = 17 - dir * 2, hy = cy + dir * (L + r * 0.5), draw = [
        () => C(16, cy - dir * L, 16 + sw, cy - dir * (L + q.tail * 0.8), tr, 0.4, hide),
        () => { for (const s of [-1, 1]) for (const e of [-1, 1]) E(16 + s * (r + 0.7), cy + e * L * 0.7 + s * e * sw, 1.6, q.low ? 1.4 : 1.9, dark); },
        () => C(16, cy - L, 16, cy + L, r, r, hide),
        () => { E(16, hy, r * 0.82, r * 0.8, hide); E(16, hy + dir * r * 0.75, r * 0.46, r * 0.4 + q.snout * 0.25, hide);
          if (q.horn) C(16, hy + dir * r, 16, hy + dir * r - 4.5, 0.8, 0.2, FA_GOLD);
          if (q.horns) for (const s of [-1, 1]) C(16 + s * 1.5, hy - 1.5, 16 + s * 3.4, hy - 4, 0.8, 0.2, FA_BONE);
          if (dir > 0) { X(14, hy - 0.5, FA_INK); X(17, hy - 0.5, FA_INK); } }];
      (dir > 0 ? [0, 1, 2, 3] : [1, 3, 2, 0]).forEach(i => draw[i]());
    }
  } else if (plan === 'serpent') {
    const v = side ? [1, 0] : [0, dir], p = [-v[1], v[0]], ph = sw * 1.6 + (at & 1) * 0.6, pts = [];
    for (let k = 0; k <= 8; k++) { const t = k / 4 - 1, a = q.wave * Math.sin(t * 4.2 + ph) * (1 - Math.max(0, t) * 0.7); pts.push([16 + v[0] * t * q.len + p[0] * a, 17 + v[1] * t * q.len + p[1] * a]); }
    for (let k = 0; k < 8; k++) C(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], q.r * (0.35 + 0.65 * k / 8), q.r * (0.35 + 0.65 * (k + 1) / 8), k & 1 ? hide : faTone(hide, -0.14));
    const hd = pts[8];
    E(hd[0] + v[0], hd[1] + v[1], q.r * (side ? 1.5 : 1.2), q.r * (side ? 1.2 : 1.5), hide);
    if (q.stalks) for (const s of [-1, 1]) { C(hd[0] + v[0] * 2 + p[0] * s * 1.5, hd[1] + v[1] * 2 + p[1] * s * 1.5, hd[0] + v[0] * 2 + p[0] * s * 2.6 + (side ? 0 : 0), hd[1] + v[1] * 2 + p[1] * s * 2.6 - 3, 0.6, 0.6, hide); }
    if (!q.blind && (side || dir > 0)) { X(hd[0] + v[0] * 1.5 - 0.5 + p[0], hd[1] + v[1] * 1.2 - 1 + (side ? 0 : 0), FA_INK); if (!side) X(hd[0] - 2 + 0.5, hd[1] + v[1] * 1.2 - 1, FA_INK); }
  } else if (plan === 'blob') {
    if (q.fire) { E(16, 21, 6.4 - sw, 8, 0xE1); P([[16 + sw * 2, 3], [20.5, 16], [11.5, 16]], 0xE1, 3); E(16, 23, 3.8, 5.4, 0xE5); E(16, 25, 2, 3, 0xE7); X(14, 20, FA_INK); X(17, 20, FA_INK); }
    else if (q.jelly) { for (let k = 0; k < 4; k++) C(11 + k * 3.3, 15, 11 + k * 3.3 + (k & 1 ? sw : -sw) * 1.5, 27 - (k & 1) * 2, 0.9, 0.5, dark); E(16, 13, 7.4, 5.8, hide); E(13, 10.6, 2, 1.1, faTone(hide, 0.5), true); }
    else if (q.stalk) { C(16, 29, 16 + sw, 18, 2.6, 2, dark); E(16 + sw, 13, 6.4, 5.2, hide); E(16 + sw, 12, 2.6, 1.6, faTone(hide, -0.6), true); }
    else { E(16, 23.5, 9.5 + sw * 1.2, 5.6 - sw * 0.7, hide); E(15, 20.5, 5.5 + sw * 0.5, 3.6, hide); E(12, 20, 2.2, 1.1, faTone(hide, 0.55), true); X(15, 22, FA_INK); X(19, 22, FA_INK); }
  } else if (plan === 'crab') {
    for (const s of [-1, 1]) { for (let k = 0; k < 3; k++) C(16 + s * 5, 21 + k * 1.6, 16 + s * (10 + (k & 1) + ((at + k) & 1)), 24 + k * 2.2, 0.8, 0.5, dark); C(16 + s * 5, 18, 16 + s * 9, 14, 1.2, 1, dark); E(16 + s * 9.5, 12.5 - ((at & 1) ^ (s > 0 ? 1 : 0)), 2.8, 2.4, hide); X(16 + s * 9.5 - 0.5, 10 - ((at & 1) ^ (s > 0 ? 1 : 0)), FA_INK); }
    E(16, 20, 7.2, 4.6, hide); E(13.4, 18, 2.4, 1.2, faTone(hide, 0.4), true);
    for (const s of [-1, 1]) { X(16 + s * 2 - 0.5, 14, FA_INK); X(16 + s * 2 - 0.5, 15, dark); }
  } else if (plan === 'bird') {
    const body = q.comb ? [240, 236, 228] : hide, beak = [240, 150, 30];
    if (side) { C(11.5, 18.5, 7.6, 16.6, 1.3, 0.5, faTone(body, -0.2)); E(15, 18.5, 4.8, 3.6, body); E(14, 18 - sw * 1.6, 3.6, 2.2, faTone(body, -0.18)); E(19.6, 14.6, 2.7, 2.6, body); X(22, 15, beak); X(23, 15, beak); X(20, 14, FA_INK); if (q.comb) { X(19, 11, [210, 30, 30]); X(20, 11, [210, 30, 30]); X(20, 12, [210, 30, 30]); } X(14, 22, beak); X(14, 23, beak); X(16, 22, beak); X(16, 23, beak); }
    else { for (const s of [-1, 1]) C(16 + s * 3, 16.5, 16 + s * (8.5 - sw), 14 + sw * 3, 1.9, 0.8, faTone(body, -0.18)); const hy = 17 + dir * 4.6; if (dir < 0) E(16, hy, 2.6, 2.6, body); E(16, 17.5, 3.9, 4.6, body); if (dir > 0) { E(16, hy, 2.7, 2.7, body); X(15, hy + 1, beak); X(16, hy + 1, beak); X(14, hy - 1, FA_INK); X(17, hy - 1, FA_INK); } if (q.comb) { X(15, hy - 4, [210, 30, 30]); X(16, hy - 4, [210, 30, 30]); } }
  }
}

/* ---- portraits ------------------------------------------------------------
   The old portraits are photographs of faces in ornamental frames, with
   see-through corners. A new one is a drawn face, shoulders and backdrop
   in a plain bevelled frame. From the old picture come four colours and
   nothing else: the skin (the middle of the picture, brought up to a
   daylight brightness, so a statue stays grey and a skull yellow), the
   hair (the band above the face, when it differs from the skin), the
   frame (the outer five pixels) and so the backdrop. The resource's
   number chooses the rest: the width of the face, the hair's cut, a
   beard or none, the eyes' colour, the brows' tilt and the mouth's turn.
   A portrait whose middle is see-through is a frame with nobody in it and
   goes to the painter. */
function faPortrait(old, resid) {
  if (!old[32 * 64 + 32] || !old[24 * 64 + 28]) return faPaint(old, 64, 64, true);
  const mean = (x0, y0, x1, y1, keep) => { let r = 0, g = 0, b = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const v = old[y * 64 + x]; if (!v || v >= 0xE0) continue; const c = FA_RGB[v]; if (keep && !keep(c, x, y)) continue; r += c[0]; g += c[1]; b += c[2]; n++; } return n ? [r / n, g / n, b / n] : null; };
  const lift = (c, to) => { const l = Math.max(faLum(c), 1); return c.map(v => Math.min(255, v * to / l)); };
  const h = badArtHash(resid), bit = (n, of) => (h >>> n) % of;
  const mid = mean(22, 22, 42, 44) || [200, 150, 110], midL = faLum(mid);
  let skin = lift(mean(22, 22, 42, 44, c => faLum(c) >= midL) || mid, 176);
  if (Math.max(...skin) - Math.min(...skin) > 12 && skin[0] > skin[2]) skin = [skin[0], Math.min(skin[1], skin[0] * 0.82), Math.min(skin[2], skin[0] * 0.66)];
  const top = mean(20, 9, 44, 17), far = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  const hair = top && far(lift(top, 176), skin) > 70 && faLum(top) > 30 ? top : FA_HAIRS[bit(3, FA_HAIRS.length)];
  const frame = lift(mean(0, 0, 64, 64, (c, x, y) => (x < 5 || y < 5 || x > 58 || y > 58) && faLum(c) > 60) || [170, 170, 176], 170);
  const back = [[52, 60, 104], [40, 84, 80], [92, 48, 60], [72, 60, 100], [84, 72, 48], [40, 72, 112]][bit(26, 6)];
  const cloth = [[150, 40, 40], [40, 80, 150], [60, 120, 60], [120, 90, 50], [110, 60, 130], [170, 170, 176], [200, 160, 60]][bit(6, 7)];
  const c = faCanvas(64, 64, 3), ink = faTone(skin, -0.62), fw = 13.4 + bit(9, 3) * 0.8, cut = bit(11, 5), beard = bit(14, 6), longHair = cut === 3 || cut === 4, bald = cut === 2;
  const rr = (cx, cy, hw, hh, r) => (x, y) => { const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r; return Math.min(Math.max(qx, qy), 0) + faHyp(Math.max(qx, 0), Math.max(qy, 0)) - r; };
  const inner = rr(32, 32, 27, 27, 5), outer = rr(32, 32, 31.5, 31.5, 8);
  c.shape(4, 4, 60, 60, inner, back, 40, true);
  c.ell(32, 30, 23, 21, faTone(back, 0.16), true);
  // Behind the head: long hair, then the shoulders and the neck.
  if (!bald) c.ell(32, 25, fw + 3.4, 17, hair);
  if (longHair) c.cap(32, 28, 32, 52, fw + 4, fw + 1.5 + (cut === 4 ? 3 : 0), hair);
  c.ell(32, 68, 27, 15, cloth); c.ell(32, 55.5, 8.5, 3.4, faTone(cloth, -0.3), true);
  c.cap(32, 44, 32, 54, 6.4, 6.8, faTone(skin, -0.2));
  // The head, with a dark line behind it for a contour, ears, then the jaw.
  c.ell(32, 31.5, fw + 0.9, 18.4, ink, true);
  for (const s of [-1, 1]) c.ell(32 + s * (fw + 0.6), 33, 2.6, 4.2, faTone(skin, -0.14));
  c.ell(32, 31, fw, 17.4, skin); c.ell(32, 37, fw - 2.2, 13.2, skin, true);
  if (beard >= 4) { c.ell(32, 43.5, fw - 1.6, 9.4, hair); c.ell(32, 38, fw - 4.2, 5, skin, true); }
  // Hair over the brow, by the cut.
  if (!bald) {
    if (cut === 0) c.ell(32, 17.2, fw - 0.4, 6.6, hair);
    else if (cut === 1) { c.ell(26, 18.4, 8.4, 6.6, hair); c.ell(39, 17.6, 7.4, 5.4, hair); }
    else { c.ell(32, 16.4, fw - 0.6, 5.2, hair); for (const s of [-1, 1]) c.cap(32 + s * (fw - 0.6), 18, 32 + s * (fw + 0.4), 34, 2.6, 2, hair); }
    for (const s of [-1, 1]) c.cap(32 + s * (fw - 0.4), 20, 32 + s * (fw - 0.2), 29, 1.8, 1, hair);
  }
  // Brows, eyes, nose, mouth.
  const ex = 6.2 + bit(17, 2) * 0.5, tilt = (bit(19, 3) - 1) * 0.9, brow = bald || faLum(hair) > 150 ? faTone(skin, -0.5) : faTone(hair, -0.2), iris = [[70, 44, 24], [50, 100, 170], [60, 130, 70], [100, 100, 110]][bit(21, 4)];
  for (const s of [-1, 1]) {
    c.cap(32 + s * (ex + 3.2), 25.6 + tilt * 0.2, 32 + s * (ex - 2.6), 26 - tilt, 1, 0.8, brow, true);
    c.ell(32 + s * ex, 30.6, 3.3, 2.2, [246, 244, 236], true);
    c.ell(32 + s * ex + 0.4, 30.6, 1.9, 2.2, iris, true);
    c.cap(32 + s * ex - 3.2, 28.9, 32 + s * ex + 3.2, 28.9, 0.55, 0.55, ink, true);
    c.px(32 + s * ex, 30, FA_INK); c.px(32 + s * ex, 31, FA_INK); c.px(32 + s * ex - 1, 29, [255, 255, 255]);
  }
  c.cap(33.4, 30, 34.2, 37.4, 0.9, 1.1, faTone(skin, -0.2), true); c.cap(30, 38.8, 34.2, 38.8, 0.8, 0.8, faTone(skin, -0.34), true); c.ell(31.2, 36.4, 1.3, 1.6, faTone(skin, 0.3), true);
  const turn = (bit(23, 3) - 1) * 1.1, lip = [skin[0] * 0.82, skin[1] * 0.5, skin[2] * 0.5];
  if (beard === 3 || beard === 5) c.cap(27, 41.2, 37, 41.2, 1.5, 1.5, hair);
  c.cap(27.4, 43.4 - turn, 32, 43.6, 0.8, 1, lip, true); c.cap(32, 43.6, 36.6, 43.4 - turn, 1, 0.8, lip, true);
  c.cap(29.6, 45.4, 34.4, 45.4, 0.6, 0.6, faTone(skin, beard >= 4 ? -0.5 : 0.16), true);
  // The frame, over everything, with a stone at its head.
  c.shape(0, 0, 64, 64, (x, y) => Math.max(outer(x, y), -inner(x, y)), frame, 2.4);
  c.ell(32, 2.8, 4.4, 2.3, cloth);
  return c.done(false);
}
