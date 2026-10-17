/* ===========================================================================
   delv-artpack.js -- Cythera's pictures replaced from a pack of 32 by 32
   PNGs, by name (8 October 2026).

   The maintainer, shown the stick men of redrawDelverArt, asked whether a
   free pack in that spirit could stand in instead, and chose the Dungeon
   Crawl Stone Soup tiles: six thousand pictures at exactly Cythera's tile
   size, released CC0 by their artists
   (https://opengameart.org/content/dungeon-crawl-32x32-tiles). The page
   ships none of them. A visitor hands the pack's zip to Make a Scenario,
   as he hands it the game.

   Four pieces, bytes in and bytes out, no DOM:

   pngDecode(bytes)
     A PNG to RGBA, without a canvas, so that the Node harnesses read what
     a browser would: colour types 0, 2, 3, 4 and 6 at 1 to 16 bits, tRNS,
     the five filters and Adam7 interlace. The inflater is
     mac-vise.js's inflateRaw, past the two bytes of zlib header, as
     mac-zip.js uses it; no second DEFLATE decoder.

   readArtPack(zipBytes)
     Every 32 by 32 PNG of a zip, each with the words of its path: the
     file's name cut at underscores, hyphens and digits, and its folders.

   artPackChoose(pack, kind, name, n)
     The file for one of the game's names. The game's words are looked for
     among a file's words, a file's own name counting three times its
     folders; ART_PACK_WORDS says which of the pack's words a Cythera word
     may also be read as, and it is the one judgement in here, made by
     looking at what the plain match chose (the same standing as
     HERO_SPRITES in delv-graphics.js). A name nothing answers takes a file
     from its kind's own drawer by a hash of the name, so the same thing is
     always the same wrong picture: a person from the pack's player bodies,
     a beast from its animals, a thing from its items, ground from its
     floors, and ground a walker cannot cross from its walls.

   artPackIndexed(pack, file, opts)
     The file as 1,024 palette indices: see-through where the PNG is under
     half opaque, else the nearest of Cythera's colours, index 0 and the
     cycling ranges left out so that nothing redrawn flickers or vanishes.

   LOAD ORDER: after mac-vise.js, mac-zip.js and delv-graphics.js
   (badArtIndex's palette, badArtHash).
   =========================================================================== */

function pngDecode(bytes) {
  const u32 = o => ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
  if (bytes.length < 33 || u32(0) !== 0x89504E47 || u32(4) !== 0x0D0A1A0A) throw new Error('not a PNG');
  let W = 0, H = 0, depth = 0, type = 0, lace = 0, plte = null, trns = null;
  const idat = [];
  for (let p = 8; p + 12 <= bytes.length;) {
    const len = u32(p), tag = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]), body = bytes.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') { W = u32(p + 8); H = u32(p + 12); depth = body[8]; type = body[9]; lace = body[12]; }
    else if (tag === 'PLTE') plte = body;
    else if (tag === 'tRNS') trns = body;
    else if (tag === 'IDAT') idat.push(body);
    else if (tag === 'IEND') break;
    p += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  if (!W || !H || !channels || W > 4096 || H > 4096) throw new Error('a PNG of a kind this page does not read');
  let n = 0; for (const c of idat) n += c.length;
  const z = new Uint8Array(n); n = 0; for (const c of idat) { z.set(c, n); n += c.length; }
  const bpp = Math.max(1, (channels * depth) >> 3), rowBytes = w => Math.ceil(w * channels * depth / 8);
  // Adam7's seven passes, or the one pass of a picture that is not
  // interlaced: where each starts and how far apart its pixels lie. 73 of
  // the Dungeon Crawl tiles are interlaced, the doors among them.
  const passes = lace ? [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]] : [[0, 0, 1, 1]];
  const sizes = passes.map(([x0, y0, dx, dy]) => [Math.ceil((W - x0) / dx), Math.ceil((H - y0) / dy)]);
  const raw = inflateRaw(z.subarray(2), sizes.reduce((a, [w, h]) => a + (w > 0 && h > 0 ? (rowBytes(w) + 1) * h : 0), 0), 8);
  const rgba = new Uint8Array(W * H * 4);
  const wide = v => depth >= 8 ? v : Math.round(v * 255 / ((1 << depth) - 1));
  let at = 0;
  passes.forEach(([x0, y0, dx, dy], pi) => {
    const [pw, ph] = sizes[pi];
    if (pw <= 0 || ph <= 0) return;
    const stride = rowBytes(pw), cur = new Uint8Array(stride), prev = new Uint8Array(stride);
    // One sample of the row, most significant bits first; 16 bits by its high byte.
    const sample = k => depth === 8 ? cur[k] : depth === 16 ? cur[k * 2] : (cur[(k * depth) >> 3] >> (8 - depth - ((k * depth) & 7))) & ((1 << depth) - 1);
    for (let r = 0; r < ph; r++) {
      const f = raw[at], row = raw.subarray(at + 1, at + 1 + stride);
      at += stride + 1;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
        let v = row[i];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        cur[i] = v & 0xFF;
      }
      for (let px = 0; px < pw; px++) {
        const o = ((y0 + r * dy) * W + x0 + px * dx) * 4, k = px * channels;
        if (type === 3) { const i = sample(k); rgba[o] = plte[i * 3]; rgba[o + 1] = plte[i * 3 + 1]; rgba[o + 2] = plte[i * 3 + 2]; rgba[o + 3] = trns && i < trns.length ? trns[i] : 255; }
        else if (type === 0 || type === 4) { const g = sample(k); rgba[o] = rgba[o + 1] = rgba[o + 2] = wide(g); rgba[o + 3] = type === 4 ? wide(sample(k + 1)) : trns && trns.length >= 2 && ((trns[0] << 8) | trns[1]) === g ? 0 : 255; }
        else { rgba[o] = wide(sample(k)); rgba[o + 1] = wide(sample(k + 1)); rgba[o + 2] = wide(sample(k + 2)); rgba[o + 3] = type === 6 ? wide(sample(k + 3)) : 255; }
      }
      prev.set(cur);
    }
  });
  return { W, H, rgba };
}

function readArtPack(zipBytes) {
  const zip = parseZipArchive(zipBytes), files = [];
  for (const e of zip.entries || zip) {
    if (e.isFolder || !/\.png$/i.test(e.path) || /(^|\/)(__MACOSX|\._)/.test(e.path)) continue;
    const parts = e.path.toLowerCase().replace(/\.png$/, '').split('/'), base = parts.pop();
    files.push({ path: e.path, entry: e, folders: parts, dir: parts.slice(1).join('/'),
      words: base.split(/[^a-z]+/).filter(w => w && w !== 'new' && w !== 'old'), image: undefined });
  }
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return { files, zip: zipBytes, nearest: new Map(), chosen: new Map() };
}
// A file's pixels, decoded once; null when it is not 32 by 32 or does not read.
function artPackImage(pack, file) {
  if (file.image !== undefined) return file.image;
  let img = null;
  try { const d = pngDecode(zipFork(pack.zip, file.entry, 'data')); if (d.W === 32 && d.H === 32) img = d.rgba; } catch (e) { quiet(e, 'a picture of the art pack'); }
  return (file.image = img);
}

/* Which of the pack's words a Cythera word may also be read as. Left of
   the colon is the game's word as 0xF004 or a prop's name has it; right is
   what the Dungeon Crawl tiles call the nearest thing they have. A word
   with no line is looked for as itself, and as itself without a final s. */
const ART_PACK_WORDS = {
  hero: ['human'], heroine: ['human'], king: ['knight'], fool: ['halfling'], noblewoman: ['elf'], nobleman: ['elf'],
  guard: ['guard', 'soldier'], ruffian: ['orc'], man: ['human'], woman: ['human'], beggar: ['kobold'], child: ['halfling'],
  mage: ['wizard'], magess: ['sorcerer', 'wizard'], gator: ['alligator', 'crocodile'], seldane: ['naga'], asp: ['adder', 'snake'],
  bird: ['raven', 'bat'], goat: ['sheep', 'yak'], unicorn: ['horse', 'pegasus'], ratlizard: ['rat'], wolflizard: ['wolf', 'hound'], ooze: ['ooze', 'jelly'], fighter: ['warrior', 'fighter'],
  hunter: ['archer'], titan: ['titan', 'giant'], tentacle: ['tentacle', 'kraken'], sea: ['kraken'], jellyfish: ['jellyfish', 'jelly'],
  slug: ['slug', 'worm'], workman: ['dwarf'], chicken: ['raven'], polyp: ['fungus'], undead: ['zombie'], firespirit: ['fire', 'elemental'],
  sylph: ['fairy', 'pixie', 'spriggan'], lich: ['lich'], gecko: ['lizard', 'gila'], hydra: ['hydra'], corpse: ['corpse', 'bones'],
  earth: ['dirt'], scrub: ['grass'], crops: ['grass'], field: ['grass'], swamp: ['bog', 'swamp'], shore: ['sand'], embankment: ['dirt'],
  earthen: ['dirt'], pyramid: ['sandstone'], limestone: ['stone'], slate: ['slate', 'cobalt'], roof: ['slate', 'cobalt'], cavern: ['cave', 'rock'],
  mountain: ['rock', 'stone'], mountains: ['rock', 'stone'], snowcaps: ['ice'], abyss: ['abyss'], chaos: ['abyss'], carpet: ['carpet', 'rug'],
  window: ['glass', 'crystal'], steps: ['stairs', 'stair'], stairs: ['stairs', 'stair'], ladder: ['stairs', 'stair'], trapdoor: ['trapdoor', 'shaft'],
  puddle: ['shallow', 'water'], pool: ['water'], shrub: ['bush', 'plant'], bush: ['bush', 'plant'], door: ['door'], doorway: ['open', 'door'],
  portcullis: ['gate', 'grate'], obol: ['gold'], potion: ['potion'], meat: ['chunk', 'meat'], steak: ['chunk', 'meat'], kabobs: ['sausage', 'meat'],
  fowl: ['chunk'], flatbread: ['bread'], cuirass: ['leather', 'armour', 'armor'], breast: ['plate', 'armour', 'armor'], tunic: ['robe'],
  dress: ['robe'], kilt: ['robe'], skirt: ['robe'], pants: ['leg'], cape: ['cloak'], sandals: ['boots'], obsidian: ['stone'], rock: ['stone', 'rock'],
  boulder: ['boulder'], rockpile: ['stone', 'rubble'], rubble: ['rubble', 'stone'], tome: ['book'], grimoire: ['book'], paper: ['scroll'],
  map: ['scroll'], sack: ['bag'], pouch: ['bag'], lamp: ['lamp', 'lantern'], torch: ['torch'], candle: ['candle', 'lamp'], urn: ['urn', 'jar'],
  vat: ['urn', 'jar'], chest: ['chest'], coffer: ['chest'], crate: ['chest'], statue: ['statue'], bust: ['statue'], pillar: ['statue', 'pillar'],
  fountain: ['fountain'], well: ['fountain'], altar: ['altar'], tombstone: ['grave', 'tomb'], grave: ['grave', 'tomb'], portal: ['portal'],
  fire: ['fire', 'flame'], firepit: ['fire', 'flame'], campfire: ['fire', 'flame'], fireplace: ['fire', 'flame'], brazier: ['fire', 'flame'],
  hatchet: ['axe'], cleaver: ['axe'], flail: ['flail'], club: ['club'], staff: ['staff'], rod: ['rod'], bow: ['bow'], sling: ['sling'],
  buckler: ['buckler'], shield: ['shield'], helmet: ['helmet', 'helm'], gauntlets: ['gauntlet', 'glove'], ring: ['ring'], key: ['key'],
  diamond: ['gem', 'crystal'], ruby: ['gem', 'crystal'], crystal: ['crystal', 'orb'], web: ['web'], cobwebs: ['web'], mushroom: ['mushroom', 'fungus'],
  mushrooms: ['mushroom', 'fungus'], blood: ['blood'], slime: ['slime'], bones: ['bone', 'skeleton'], trap: ['trap'], spikes: ['spike', 'trap'],
  rune: ['rune', 'sigil'], bomb: ['orb'], pitchfork: ['trident'], scythe: ['scythe'], spear: ['spear'], dagger: ['dagger'], sword: ['sword'],
  mace: ['mace'], axe: ['axe'], arrow: ['arrow'], fish: ['fish'], cheese: ['cheese'], bread: ['bread'], grapes: ['grape'], sausage: ['sausage']
};
const ART_PACK_DRAWERS = {
  hero: [/^player\/base/], person: [/^monster/, /^player\/base/], beast: [/^monster/],
  thing: [/^item/, /^dungeon(?!\/(floor|wall|water))/, /^misc/, /^effect/], floor: [/^dungeon\/(floor|water)/], wall: [/^dungeon\/(wall|trees)/]
};
const ART_PACK_SPARE = { hero: /^player\/base/, person: /^player\/base/, beast: /^monster\/animals/, thing: /^item/, floor: /^dungeon\/floor/, wall: /^dungeon\/wall/ };
/* The file for a name: `kind` one of ART_PACK_DRAWERS' keys, `n` a number
   that picks among files that match equally (a tile's own, so that ground
   of one name is not one picture repeated). { file, matched }. */
function artPackChoose(pack, kind, name, n) {
  const key = kind + '\n' + name;
  let hit = pack.chosen.get(key);
  if (!hit) {
    const want = [];
    for (const w of String(name || '').toLowerCase().split(/[^a-z]+/).filter(Boolean))
      want.push([w, w.replace(/s$/, '')].concat(ART_PACK_WORDS[w] || []));
    const drawers = ART_PACK_DRAWERS[kind];
    let best = 0, top = [];
    for (const f of pack.files) {
      if (!drawers.some(re => re.test(f.dir))) continue;
      let score = 0;
      for (const alts of want) {
        if (alts.some(a => f.words.includes(a))) score += 3;
        else if (alts.some(a => f.folders.includes(a))) score += 1;
      }
      if (score < 3) continue;
      score -= 0.25 * f.words.length;
      if (score > best + 1e-9) { best = score; top = [f]; } else if (Math.abs(score - best) < 1e-9) top.push(f);
    }
    hit = top.length ? { files: top, matched: true } : { files: pack.files.filter(f => ART_PACK_SPARE[kind].test(f.dir)), matched: false };
    pack.chosen.set(key, hit);
  }
  if (!hit.files.length) return null;
  // A name the pack answers takes its files in turn; one it does not takes
  // one file by the name alone, so the stand-in is at least always the same.
  const i = hit.matched ? (n >>> 0) % hit.files.length : badArtHash([...String(name)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)) % hit.files.length;
  return { file: hit.files[i], matched: hit.matched };
}
/* The file as indices. opts.solid fills what is see-through with the
   picture's commonest colour (ground has no gaps); opts.flip mirrors it;
   opts.drop moves it down a pixel, for the second frame of a step. */
function artPackIndexed(pack, file, opts) {
  const rgba = artPackImage(pack, file);
  if (!rgba) return null;
  opts = opts || {};
  const out = new Uint8Array(1024), count = new Uint16Array(256);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const sy = y - (opts.drop ? 1 : 0), sx = opts.flip ? 31 - x : x;
    if (sy < 0) continue;
    const o = (sy * 32 + sx) * 4;
    if (rgba[o + 3] < 128) continue;
    const rgb = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
    let v = pack.nearest.get(rgb);
    if (v === undefined) { v = badArtIndex(rgba[o], rgba[o + 1], rgba[o + 2]); pack.nearest.set(rgb, v); }
    out[y * 32 + x] = v; count[v]++;
  }
  if (opts.solid) { let m = 1; for (let i = 1; i < 256; i++) if (count[i] > count[m]) m = i; for (let i = 0; i < 1024; i++) if (!out[i]) out[i] = m; }
  return out;
}
