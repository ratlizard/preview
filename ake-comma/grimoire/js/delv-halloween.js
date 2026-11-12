/* delv-halloween.js -- the Halloween mod, one of the Utility Mods
   (js/delv-datafixes.js, the entry 'halloween').

   It was a separate builder in the workbench (tools/sprites/halloween_mod.mjs)
   until 31 October 2026, when the maintainer asked for it on the Patches tab.
   The builder wrote one patch from fixed offsets in the shipped file; here
   every place in a script is found by its instructions, since the mods come
   after every other fix (DATA_FIX_STAGES) and the text fixes, Alaric's 201
   and the starting oboloi all change Alaric's talk first. The figures, the
   faces and the gray are worked out from the visitor's file as the builder
   worked them out from the shipped one, so the patched file is the
   builder's, byte for byte, when Halloween is the only fix chosen. That file
   was played on Mac OS 8.5 in SheepShaver.

   WHAT IT CHANGES.
   - The figures. A person's type (layout 4, a walker) has sixteen tiles,
     four facings of four steps, tile 4f + k. The skeleton (type 0x11F,
     layout 0) has eight, the same four facings of two, tile 2f + j, the
     first eight of sheet 0x8E70. Each person's tile 4f + k becomes the
     skeleton's 2f + (k mod 2). The people's sheets are 0x8E60..0x8E6F
     (guards to fighters) and 0x8E71..0x8E76 (the king to the workman);
     0x8E70 itself, the skeleton's and the undead's, stays as shipped.
   - The faces. Each person's portrait (0x87FF + n for a character of a
     person's type, and six of the hero's faces) becomes the maintainer's
     skull, HALLOWEEN_SKULL, cover-fitted into the hole of the frame it
     shares with other portraits (sharedPortraitFrames) and dithered as the
     ditherizer does. A portrait that shares no frame has the skull in the
     box 8,8 to 55,55 and the shipped pixels round it.
   - The opening scene, Alaric's talk 0x1802 on the first meeting. Alaric and
     Magpie say "Rattle, rattle, rattle." in place of each run of speech,
     the amulet speech becomes the amulet alone, and a branch after the
     greeting goes to the goodbye's first-meeting path, so no keyword prompt
     interrupts the scene. After Magpie's last line the speaker becomes
     character 206, Magpie's skull cracked in two, two pages of narration
     follow, and Magpie's health becomes 0: the game's death leaves a corpse
     from his unit, which is now the skeleton's heap of bones. Alaric's
     description reads "skeleton" for "gentleman", with one ending.
   - The opening slideshow is one slide, a new string at the end of the
     array 0x0240, and the creation script's RangeIterator stops after it.
   - The king's and the fool's type names are "kingly bones" and "foolish
     bones" (0xF004).
   - Land King Hall plays a waltz written for the mod (HALLOWEEN_WALTZ, made
     by the workbench's tools/sprites/halloween/spooky_tune.py) in place of
     its tune, 0x9001.
   - The interface sheets 0x8E18..0x8E1A and the sized pictures 0x8F20 to
     0x8F87 (but 0x8F31..0x8F33 and 0x8F39..0x8F7F) are gray, each color the
     palette's gray of the same brightness. The desktop, 0x8F00, is gray at a
     third of its brightness under two spiderwebs.
   The conversation colors are a change to the program, not to Cythera Data,
   and are a separate row of the same list ('halloween-colors',
   js/delv-appfixes.js).

   WITH "NO TIME TO WASTE". That mod leaves out Alaric's story and Magpie's
   tour, which are the scene this one rewrites, so with both chosen the
   scene is left to it and the rest of Halloween applies. */

// The maintainer's skull, 64 by 64: a list of colors, six hex digits each,
// and one index into it a pixel, in base 64. HALLOWEEN_CRACKED is the same
// skull split by a jagged crack, the right part tilted 7 degrees and dropped
// 4 pixels, with chips of bone below (the workbench's make_cracked.py).
const HALLOWEEN_SKULL = {
  pal: '08080810000010101010101810140420202020202d24000028200c313145353535390000392d10410000410041414159454545490000493918515571553d1c5555555904005d00005d411c65656565658669080069492471492075757575759e7910007d00007d180082000082552d82593186552d8686868a140096653d9a9a9a9e10089e6139a2653daa2414aa754daaaaaab60000b6391cb66d45be794dbe8659c24d2dd2613dd2966dd77951e39671eb925deba67debb292ff5555',
  px: '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',
};
const HALLOWEEN_CRACKED = {
  pal: '08080810000010101010101810140420202020202d24000028141028200c313145353535390000392d10410000410041414159454545490000493918515571553d1c5555555904005d00005d411c65656565658669080069492471492075757575759e7910007d00007d180082000082552d82593186552d8686868a140096653d9a9a9a9e10089e6139a2653daa2414aa754daaaaaab60000b6391cb66d45be794dbe8659c24d2dd2613dd2966dd77951e39671e8c8b0eb925deba67debb292ff5555',
  px: 'AQEBAQEBAQEBAQEBAQEBAQECAgMFBgoWFhERCwoLCgsRCwoLCwYFAwMCAgIAAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAAECAgkFBgoWGhEQFhYaFhQWFhYWEBEQCwsGBQkCAgIAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgkFCwoKFBQQGhofHx8fHx8fGhoUFhYREQsGBQUDAgcBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQECAgkFCwoQEBQUGh8fHygoKB8fHx8bGhQWFhYRCwYGBQMCAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEHAgkFCwsLFBYUGx8fHygfHx8aGhoAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBBwEHAQEBAQEHAgkFCwsLChQUGx8fHx8fHx8aFBQUAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEAAQEBAQEAAAIFCwsLChEaGx8oHx8aGhoaFhYWFBQAAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEHAAIFBgsLCxEQGh8fHx8aGhoaFhYWFhobAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQIFCQsLEREQGh8fHx8fGhYWFhYWFhoaHx8AAQEBARsaFBYQAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQABAQEBAQcCCQkLERERGh8oKB8fGhYWFhYWGhoaGigfAAEBARobGxQUEBYRCgsGBgUCAQEBAQEBAQEBAQEBAQABAQEBAQEHCQUNCxERFh8fKB8fGhoaHxoaGhoaHx8fKAABAQEUGxsbFBYWEQoLBgYFAgABAQEBAQEBAQEBAQcBAQEBAQEBAgUNExERERofHygfGhoaHx8fHx8aHx8fHygoAAEBARsbGxsaFBYRCgYFCQIBAQEBAQEBAQEBAQEBAQEBAQEBBwIJDRUREREaHygfGhoaHx8fKCgfHx8fGh8oKAABAQEbGxsbGxQUFhEKBgUDAAEBAQEBAQEBAQEBAQEBAQEBBwcJCRUdERUWHx8oHxofHx8fKCgoMB8fHx8oKwABAQEBHx8gGxsUFBQQCwYFBQEAAQEBAQEBAQEBAQEB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',
};
// The waltz, a Standard MIDI File in base 64: D minor, 3/4 at 120, 60
// seconds, six voices (music box, pizzicato strings, church organ, choir,
// tubular bells, timpani), 499 notes, 4,590 bytes.
const HALLOWEEN_WALTZ = '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';

// The mod's lines, at the maintainer's wording of 30 October 2026. Speech is
// the text between double quotes, which TConversation::myprintstr sends to
// the speech box, and "*" is the game's page break. The narration of the
// collapse is two pages, since as one its second sentence ran to a third
// line, which the conversation window cut off.
const HALLOWEEN_LINES = {
  alaric: '"Rattle, rattle, rattle."*His bones rattle, rattlingly.*',
  magpie: '"Rattle, rattle, rattle."*',
  collapse: 'The foolish skeleton collapses in a heap on the floor.*Something tells you the mod author ran out of time before Halloween.*',
  slide: 'Ooooo it\'s Halloween and you\'re a spooky skeleton!',
};

function halloweenBase64(t) {
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = t.replace(/=+$/, ''), out = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let bits = 0, n = 0, k = 0;
  for (let i = 0; i < clean.length; i++) {
    bits = ((bits << 6) | A.indexOf(clean[i])) & 0xFFFF; n += 6;
    if (n >= 8) { n -= 8; out[k++] = (bits >> n) & 255; }
  }
  return out;
}
// A picture above as 4096 colors, [r, g, b] each.
function halloweenPicture(p) {
  const pal = [];
  for (let i = 0; i < p.pal.length; i += 6) pal.push([0, 2, 4].map(k => parseInt(p.pal.slice(i + k, i + k + 2), 16)));
  return Array.from(halloweenBase64(p.px), v => pal[v]);
}
function halloweenEncode(image, w, h, what) {
  const same = body => { const back = decompressDCG(body, w, h); return back.length === image.length && back.every((v, i) => v === image[i]); };
  let body = encodeDCGRuns(image);
  if (!same(body)) body = encodeDCGLiterals(image);
  if (!same(body)) throw new Error(what + ' does not decode back');
  return body;
}

/* A portrait with the picture `pic` (halloweenPicture) in it, as 4096
   indices. A portrait of a family that shares a frame has the frame's
   pixels round the hole the family leaves (ditherFrameMask in
   js/page-galleries.js reads the same); any other has the box 8,8 to 55,55
   cut out of its shipped pixels. The picture is fitted to the box, cropped
   rather than letterboxed, and dithered with the ditherizer's settings. */
function halloweenFace(arc, fams, resid, pic) {
  let frame, hole, box;
  const fam = fams.find(g => g.members.includes(resid));
  if (fam) {
    frame = fam.image; hole = new Uint8Array(4096);
    let x0 = 64, y0 = 64, x1 = -1, y1 = -1;
    for (let i = 0; i < 4096; i++) if (!fam.frame[i]) { hole[i] = 1; const x = i % 64, y = (i - x) / 64; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    box = { x0, y0, x1, y1 };
  } else {
    frame = decodeResource(arc, getResourceBytes(arc, resid), 135, resid).image;
    box = { x0: 8, y0: 8, x1: 55, y1: 55 };
    hole = new Uint8Array(4096);
    for (let y = 8; y <= 55; y++) for (let x = 8; x <= 55; x++) hole[y * 64 + x] = 1;
  }
  const S = 64, bw = box.x1 - box.x0 + 1, bh = box.y1 - box.y0 + 1, k = Math.max(bw / S, bh / S), cw = bw / k, ch = bh / k, cx = (S - cw) / 2, cy = (S - ch) / 2;
  const rgba = new Uint8ClampedArray(4096 * 4);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const sx = Math.min(S - 1, Math.floor(cx + (x + 0.5) * cw / bw)), sy = Math.min(S - 1, Math.floor(cy + (y + 0.5) * ch / bh));
    const c = pic[sy * S + sx], d = ((box.y0 + y) * 64 + box.x0 + x) * 4;
    rgba[d] = c[0]; rgba[d + 1] = c[1]; rgba[d + 2] = c[2]; rgba[d + 3] = 255;
  }
  const ind = ditherToCytheraPalette(rgba, 64, 64, { checker: 0.6, allowAnimated: false, tones: null });
  const img = new Uint8Array(4096);
  for (let i = 0; i < 4096; i++) img[i] = hole[i] ? ind[i] : frame[i];
  return img;
}

// The palette's grays below 0xE0 (the entries above cycle), index 0 left
// out, and the nearest of them to a color's brightness times `scale`.
function halloweenGrays() {
  const rgb = h => [0, 2, 4].map(k => parseInt(h.slice(k, k + 2), 16));
  const grays = [];
  PALETTE.forEach((h, i) => { const [r, g, b] = rgb(h); if (i > 0 && i < 0xE0 && r === g && g === b && !grays.some(x => x[1] === r)) grays.push([i, r]); });
  const of = (v, scale) => {
    const [r, g, b] = rgb(PALETTE[v]), y = (0.299 * r + 0.587 * g + 0.114 * b) * scale;
    let best = grays[0];
    for (const x of grays) if (Math.abs(x[1] - y) < Math.abs(best[1] - y)) best = x;
    return best[0];
  };
  return { of, index: level => grays.find(x => x[1] === level)[0] };
}
// A sized picture's header: its width and height, read as decodeResource does.
function halloweenSized(b) {
  const h = b.slice(0, 4);
  return { head: h, w: (bitsOf(h, 14, 0) << 2) + (bitsOf(h, 2, 14) ? 4 : 0), h: (bitsOf(h, 15, 16) << 1) + bitsOf(h, 1, 31) };
}
function halloweenWithHead(head, body) { const out = new Uint8Array(4 + body.length); out.set(head); out.set(body, 4); return out; }

/* Two spiderwebs on an N by N tile, 2 on a spoke, 1 on a ring, 0 elsewhere,
   drawn with wraparound so the tile meets itself at every edge: one of 14
   spokes at the middle and one of 10 at the corner, each ring between two
   spokes sagging toward the hub. The jitter comes from a fixed seed, so
   every build draws the same webs. */
function halloweenSpiderwebs(N) {
  const m = new Uint8Array(N * N);
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const put = (x, y, v) => { const i = ((Math.round(y) % N) + N) % N * N + ((Math.round(x) % N) + N) % N; if (m[i] < v) m[i] = v; };
  const line = (x0, y0, x1, y1, v) => { const n = Math.ceil(2 * Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1; for (let k = 0; k <= n; k++) put(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n, v); };
  const web = (cx, cy, R, spokes, rings) => {
    const ang = [], len = [];
    for (let i = 0; i < spokes; i++) { ang.push(2 * Math.PI * i / spokes + (rnd() - 0.5) * 0.3); len.push(R * (0.85 + 0.15 * rnd())); }
    ang.forEach((a, i) => line(cx, cy, cx + Math.cos(a) * len[i], cy + Math.sin(a) * len[i], 2));
    for (let k = 1; k <= rings; k++) {
      const r = R * 0.9 * k / rings;
      for (let i = 0; i < spokes; i++) {
        const a = ang[i], b = ang[(i + 1) % spokes] + (i + 1 === spokes ? 2 * Math.PI : 0), mid = (a + b) / 2, sag = r * 0.86;
        line(cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(mid) * sag, cy + Math.sin(mid) * sag, 1);
        line(cx + Math.cos(mid) * sag, cy + Math.sin(mid) * sag, cx + Math.cos(b) * r, cy + Math.sin(b) * r, 1);
      }
    }
  };
  web(N / 2, N / 2, N * 0.44, 14, 8);
  web(0, 0, N * 0.31, 10, 6);
  return m;
}

/* The opening scene's edits to Alaric's talk, 0x1802, each place found by
   its instructions in the file as the mods' stage finds it. A run of speech
   is cut from its first string to the instruction that ends it, which in
   the shipped file is the AddQuest after the greeting, the BeginCutscene
   after the amulet speech and each of Magpie's first two lines, and the
   call to 0xF15 (Omen's egg) after his last. With `descriptionOnly` the
   scene is left as it is and only Alaric's description changes. */
function halloweenScene(s, descriptionOnly) {
  const R = 0x1802, ops = dataPatchListing(s, R).ops;
  const said = t => 'string(implicit) ' + JSON.stringify(t);
  const find = (what, test, from) => {
    const i = ops.findIndex(o => o.at >= (from || 0) && test(o.text));
    if (i < 0) throw new Error('the opening scene: ' + what + ' is not in 0x1802');
    return i;
  };
  const str = (what, words, from) => find(what, t => t.startsWith('string(implicit) "' + words), from);
  const until = (i, kind) => find(kind + ' after ' + ops[i].text.slice(17, 40), t => t.startsWith(kind), ops[i].at + 1);
  const cut = (what, i, j, code) => ({ what, resid: R, at: ops[i].at, to: ops[j].at, expect: { [ops[i].at]: ops[i].text.slice(0, 40), [ops[j].at]: ops[j].text }, code });
  const edits = [];
  // Alaric's description: "gentleman" becomes "skeleton", and the three
  // endings by the story's state become one.
  const look = said(', with no look of any kind because he doesn\'t have eyeballs.');
  for (const [what, words] of [['his look of desperation', ', but with a look of desperation'], ['his look of satisfaction', ', with a look of satisfaction'], ['his look of relief', ', with a look of relief']]) {
    const i = str(what, words);
    edits.push({ what, resid: R, at: ops[i].at, replaceOp: true, expect: { [ops[i].at]: ops[i].text.slice(0, 40) }, code: look });
  }
  const gent = str('his description', 'Before you stands an older, dignified');
  edits.push({ what: 'Alaric is a skeleton', resid: R, at: ops[gent].at, replaceOp: true, expect: { [ops[gent].at]: ops[gent].text.slice(0, 40) }, code: said('Before you stands an older, dignified skeleton') });
  if (descriptionOnly) return edits;
  // The greeting, his story and the start of the keywords.
  const ah = str('the greeting', '\\"Ah - good'), quest = until(ah, 'sys AddQuest');
  edits.push(cut('Alaric rattles', ah, quest, said(HALLOWEEN_LINES.alaric)));
  const help = until(quest, 'sys AddConversationKeyword');
  // The goodbye's first-meeting path: the if_not after the "bye" response.
  const bye = find('the goodbye', t => t.startsWith('conversation_response "bye"'));
  if (!ops[bye + 1].text.startsWith('if_not')) throw new Error('the opening scene: the goodbye has ' + ops[bye + 1].text + ', not if_not');
  edits.push({ what: 'the scene goes on to the amulet', resid: R, at: ops[help].at, shiftAt: true, expect: { [ops[help].at]: 'sys AddConversationKeyword' }, code: 'branch 0x' + ops[bye + 1].at.toString(16).toUpperCase() });
  const amulet = str('the amulet speech', '\\"Here, take this amulet');
  edits.push(cut('the amulet alone', amulet, until(amulet, 'sys BeginCutscene'), ['sys Create', 'short 0x0001', 'short 0x00F4', 'byte 0x0A', 'byte 0x00', 'end'].join('\n')));
  const follow = str('Magpie’s first line', '\\"Follow Magpie');
  edits.push(cut('Magpie rattles', follow, until(follow, 'sys BeginCutscene'), said(HALLOWEEN_LINES.magpie)));
  const points = str('Magpie’s second line', 'Magpie points to the end');
  edits.push(cut('Magpie rattles again', points, until(points, 'sys BeginCutscene'), said(HALLOWEEN_LINES.magpie)));
  // After his last line character 206 speaks, the cracked face; the
  // narration of the collapse; and his health becomes 0, which runs the
  // death a blow gives (CharEntry::DeathRites, TActiveMonster::Die).
  const quarters = str('Magpie’s last line', '\\"These are quarters');
  edits.push(cut('Magpie collapses', quarters, until(quarters, 'call_resource 0xF15'), [said(HALLOWEEN_LINES.magpie), 'sys TalkParticipant', 'short 0x00CE', 'byte 0x00', 'end',
    said(HALLOWEEN_LINES.collapse), 'set_field health (0x1C)', 'word Character.Magpie', 'end', 'byte 0x00', 'end'].join('\n')));
  return edits;
}

/* The plan of the mod, for the stage "mods". ctx.chosen, the set of fixes
   chosen, shows whether "No time to waste" has the scene. */
function halloweenPlan(s, ctx) {
  const arc = s.arc, edits = [], dataEdits = [];
  edits.push(...halloweenScene(s, !!(ctx && ctx.chosen && ctx.chosen.has('skip-intro'))));
  // The slideshow: the top of RangeIterator(0, 8), exclusive, becomes 1.
  const slide = dataPatchPlace(s, 'the slideshow', 0x1801, ['sys SpecialView', 'byte 0x04', 'end', 'set_local 0x01', 'sys RangeIterator', 'word &Var1', 'byte 0x00', 'byte 0x00', 'byte 0x08']);
  edits.push({ what: 'one slide', resid: 0x1801, at: slide.at(8), replaceOp: true, expect: slide.expect, code: 'byte 0x01' });
  dataEdits.push({ what: 'the slide’s text', resid: 0x0240, fn: b => {
    if (b[0] !== 0x90 || b[1] !== 8 || b[2] !== 0x82 || b[3] !== 0x40) throw new Error('0x0240 is not the array of the slides’ texts');
    const t = HALLOWEEN_LINES.slide, out = new Uint8Array(b.length + t.length + 1);
    out.set(b);
    for (let i = 0; i < t.length; i++) out[b.length + i] = t.charCodeAt(i);
    out[4] = b.length >> 8; out[5] = b.length & 255;
    return out;
  } });
  // The figures.
  const sheet = decompressDCG(s.bytesOf(0x8E70), 32, 512);
  const skel = [0, 1, 2, 3, 4, 5, 6, 7].map(j => sheet.slice(j * 1024, (j + 1) * 1024));
  const sheets = [];
  for (let r = 0x8E60; r <= 0x8E6F; r++) sheets.push(r);
  for (let r = 0x8E71; r <= 0x8E76; r++) sheets.push(r);
  for (const resid of sheets) dataEdits.push({ what: 'skeletons on sheet 0x' + resid.toString(16), resid, fn: b => {
    const image = decompressDCG(b, 32, 512);
    for (let k = 0; k < 16; k++) image.set(skel[2 * (k >> 2) + (k & 1)], k * 1024);
    return halloweenEncode(image, 32, 512, 'sheet 0x' + resid.toString(16));
  } });
  // The faces. A character of a person's type, by the low ten bits of the
  // word at 4 of its record in 0xF009, with a portrait in the file.
  const HUMAN = new Set([0x20, 0x21, 0x22, 0x23, 0x2C, 0x2D, 0x2E, 0x2F, 0x30, 0x31, 0x32, 0x4F, 0x50, 0x51, 0x52, 0x53, 0x55, 0x56, 0x57, 0x74, 0x75, 0xD3]);
  const chars = getResourceBytes(arc, 0xF009), faces = [];
  for (let n = 2; n < 256; n++) {
    const p = n * 32, type = ((chars[p + 4] << 8) | chars[p + 5]) & 0x3FF;
    if (HUMAN.has(type) && getResourceBytes(arc, 0x87FF + n)) faces.push(0x87FF + n);
  }
  faces.push(0x88EF, 0x88F0, 0x88F1, 0x88F5, 0x88F6, 0x88F7);
  const fams = sharedPortraitFrames(arc), skull = halloweenPicture(HALLOWEEN_SKULL);
  for (const resid of faces) dataEdits.push({ what: 'a skull for portrait 0x' + resid.toString(16), resid, fn: () => halloweenEncode(halloweenFace(arc, fams, resid, skull), 64, 64, 'portrait 0x' + resid.toString(16)) });
  // Magpie's cracked face, set in his frame (0x8802), as the portrait of
  // character 206, whose record is empty in the shipped file and which no
  // script names.
  dataEdits.push({ what: 'Magpie’s cracked face, portrait 0x88cd', resid: 0x88CD, fn: () => halloweenEncode(halloweenFace(arc, fams, 0x8802, halloweenPicture(HALLOWEEN_CRACKED)), 64, 64, 'portrait 0x88cd') });
  // Character 206 becomes a fool (type 35, the halfwords at 4 and 20), so
  // GetCharacterName gives "foolish bones" for it. A new game clears the
  // record of a dead character, and an empty record counts as dead (the
  // name came out "Nothing"), so it is alive as Magpie is: bit 0 of byte 7,
  // and 20 in bytes 9 to 11. Its zone stays 0 and its square 0,0, with no
  // map record.
  dataEdits.push({ what: 'character 206 is a second foolish bones', resid: 0xF009, fn: b => {
    const p = 206 * 32;
    if (b.slice(p, p + 32).some(v => v)) throw new Error('character 206 is not empty');
    b[p + 5] = 35; b[p + 21] = 35; b[p + 7] = 1; b[p + 9] = b[p + 10] = b[p + 11] = 20;
    return 'character 206 has type 35 and is alive';
  } });
  // The type names, 0xF004: runs of a u16 last tile and a name ending in a
  // zero byte. The run ending at 1823 (the king, Alaric's type) and the one
  // ending at 1839 (the fool, Magpie's) are renamed and the table laid out
  // again.
  dataEdits.push({ what: 'the king and the fool renamed', resid: 0xF004, fn: b => {
    const names = { 1823: ['king', 'kingly bones'], 1839: ['fool', 'foolish bones'] }, out = [];
    let i = 0, prev = -1, n = 0;
    while (i + 3 <= b.length) {
      const id = (b[i] << 8) | b[i + 1];
      if (id < prev) break;
      prev = id;
      let e = i + 2;
      while (e < b.length && b[e]) e++;
      let name = Array.from(b.slice(i + 2, e));
      const r = names[id];
      if (r) {
        if (String.fromCharCode(...name) !== r[0]) throw new Error('the name ending at tile ' + id + ' is ' + String.fromCharCode(...name) + ', not ' + r[0]);
        name = Array.from(r[1], c => c.charCodeAt(0)); n++;
      }
      out.push(b[i], b[i + 1], ...name, 0);
      i = e + 1;
    }
    if (n !== 2) throw new Error(n + ' of the two names found');
    return Uint8Array.from([...out, ...b.slice(i)]);
  } });
  // Magpie's corpse. The units, 0xF008, are 16 bytes each, keyed by a
  // creature's type in the word at 12, and the word at 14 is the corpse Die
  // makes, aspect << 10 | type. The fool's (type 35) is 0x051B, a body in
  // clothes; it becomes the skeleton's (type 287) 0x0D1A, the heap of
  // bones. The amulet and Resurrection raise only a corpse of type 0x4E or
  // 0x11B, so these bones raise nobody.
  dataEdits.push({ what: 'the fool leaves the skeleton’s bones', resid: 0xF008, fn: b => {
    const word = (i, o) => (b[i * 16 + o] << 8) | b[i * 16 + o + 1];
    let fool = -1, skeleton = -1;
    for (let i = 0; i * 16 + 16 <= b.length && word(i, 12); i++) { if (word(i, 12) === 35) fool = i; if (word(i, 12) === 287) skeleton = i; }
    if (fool < 0 || word(fool, 14) !== 0x051B) throw new Error('the fool’s unit does not leave 0x051B');
    if (skeleton < 0 || word(skeleton, 14) !== 0x0D1A) throw new Error('the skeleton’s unit does not leave 0x0D1A');
    b[fool * 16 + 14] = 0x0D; b[fool * 16 + 15] = 0x1A;
    return 'unit ' + fool + ' (the fool) leaves 0x0D1A';
  } });
  // Land King Hall's tune. Its entry script 0x1403 plays tune 1, and no
  // other script does, so the tune's resource is replaced in place, with
  // the shipped tune as midiToQtma's model for the synthesizer's fields.
  dataEdits.push({ what: 'Land King Hall plays the waltz', resid: 0x9001, fn: b => midiToQtma(halloweenBase64(HALLOWEEN_WALTZ), { like: b, unitsPerSecond: QTMA_UNITS_PER_SECOND }).data });
  // The interface in gray, and the desktop.
  const gray = halloweenGrays();
  for (let resid = 0x8E18; resid <= 0x8E1A; resid++) dataEdits.push({ what: 'the interface sheet 0x' + resid.toString(16) + ' in gray', resid, fn: b =>
    halloweenEncode(decompressDCG(b, 32, 512).map(v => v === 0 ? 0 : gray.of(v, 1)), 32, 512, 'sheet 0x' + resid.toString(16)) });
  const pictures = [];
  for (let r = 0x8F20; r <= 0x8F30; r++) pictures.push(r);
  for (let r = 0x8F34; r <= 0x8F38; r++) pictures.push(r);
  for (let r = 0x8F80; r <= 0x8F87; r++) pictures.push(r);
  for (const resid of pictures) dataEdits.push({ what: 'the interface picture 0x' + resid.toString(16) + ' in gray', resid, fn: b => {
    const z = halloweenSized(b), image = decompressDCG(b.slice(4), z.w, z.h).map(v => v === 0 ? 0 : gray.of(v, 1));
    return halloweenWithHead(z.head, halloweenEncode(image, z.w, z.h, 'picture 0x' + resid.toString(16)));
  } });
  dataEdits.push({ what: 'the desktop, dark gray with spiderwebs', resid: 0x8F00, fn: b => {
    const z = halloweenSized(b);
    if (z.w !== 128 || z.h !== 128) throw new Error('the desktop picture is ' + z.w + ' by ' + z.h + ', not 128 by 128');
    const web = halloweenSpiderwebs(128), ring = gray.index(0x98), spoke = gray.index(0xC8);
    const image = decompressDCG(b.slice(4), 128, 128).map((v, i) => web[i] === 2 ? spoke : web[i] === 1 ? ring : gray.of(v, 1 / 3));
    return halloweenWithHead(z.head, halloweenEncode(image, 128, 128, 'the desktop'));
  } });
  return { edits, dataEdits };
}
