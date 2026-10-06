/* mac-qtmusic.js -- QuickTime Musical Instruments, read; and a QTMA tune
   played through them.
   =========================================================================

   WHAT THE GAME SOUNDED LIKE. A QTMA tune holds notes and the instrument each
   part asks for, never a sound. QuickTime played it through QuickTime Musical
   Instruments, a set of 8-bit samples (Roland's "GM/GS Sound Set",
   copyright 1997) in an extension beside QuickTime. So the music as players
   heard it is these samples, and nothing General MIDI plays is it.

   WHICH SET. Two are on the disk, and they differ. QuickTime 2.5's (Mac OS
   7.6) has 61 instruments. QuickTime 3.0's and 4.0's have 235, and they are
   the same 235 byte for byte: the Mac 4.0 copy from the Mac OS 9.0 image
   matched every one inside the Windows 3.0 copy archive.org serves. Cythera
   (1999) came after QuickTime 3, so it is that set this plays. Where the page
   gets it is js/mac-installshield.js's header; how it is read is below.

   THE INSTRUMENTS ARE APPLE'S DOCUMENTED FORMAT, read from QuickTimeMusic.h
   (cythera-reference/apple-documentation/qtma/), not guessed. Each 'ssai'
   resource is a QuickTime atom container: a 12-byte header, then atoms of
   { u32 size, type, u32 id, u16 0, u16 child count, u32 0 } and a body. Its
   root 'sean' holds:
     'tone'  a ToneDescription: the name at +36, instrument and GM number at
             +68 and +72;
     'knbl'  an InstKnobList: count, flags, then { knob, value } pairs, the
             knobs kQTMSKnob* (0x02000000 + n): times in milliseconds,
             levels in 16.16 (65536 is full);
     'sinf'  one per key range, each holding an 'sdsc', an InstSampleDescRec:
             format ('raw ' is 8-bit offset binary), channels, sample size,
             rate 16.16, the sample's id, offset, length, loop type, loop
             start and end, and the key the sample sounds at with the low and
             high keys it covers;
     'smin'  one per sample, id the 'sdsc's sampleDataID, its 'sdat' the PCM.
   The resource id is the instrument number: 1 to 128 the General MIDI
   programs, bank * 128 + program the GS variations, 16384 + n the drum kits.

   WHICH INSTRUMENT A PART GETS. Cythera's tunes ask for GS numbers in banks
   80 and 81 (10455 is bank 81, program 87), which no set has, alongside the
   GM number. QuickTime fell back to the GM number, as far as can be told
   without a recording to compare; the kits (16385, the Standard Kit) are in
   the set as asked. `qtToneInstrument` is that rule.

   THE SYNTHESIS IS OURS, AND APPROXIMATE. QuickTime's software synthesizer
   is code in the QuickTime extension, unread; this plays the samples the way
   the knobs describe and no further. Read and used: each key range's sample
   and its own knobs over the instrument's, its transpose,
   root key, loop, rate; attack, decay to the sustain level, release; note
   velocity; the part's volume, pan, pitch bend and sustain pedal. Not used,
   and each a place it can differ from the original: the decay's key scaling,
   the volume and pitch LFOs and the mod wheel that deepens them, the
   velocity curve knobs, exclusion groups, reverb, polyphony limits, and the
   output rate and interpolation the Mac used. A drum kit's note plays its
   sample to the end whatever the note's length, as kits do in General MIDI;
   that too is a reading, not a fact. A recording of the game playing in the
   emulator is what this is to be held to.

   Classic script; the page's global scope. */

const QTMS_KNOB = { attack: 1, decay: 2, sustain: 3, release: 6, transpose: 0x12 };

/* The resource fork of a QuickTime extension. A Mac file's is its own; a
   Windows .qtx is a small PE image with the fork after its last section. */
function qtxResourceFork(bytes) {
  if (bytes.length > 0x40 && bytes[0] === 0x4D && bytes[1] === 0x5A) {
    const le32 = o => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
    const pe = le32(0x3C);
    if (bytes[pe] !== 0x50 || bytes[pe + 1] !== 0x45) throw new Error('an MZ file with no PE header');
    const sections = bytes[pe + 6] | (bytes[pe + 7] << 8);
    const opt = bytes[pe + 20] | (bytes[pe + 21] << 8);
    let end = 0;
    for (let i = 0; i < sections; i++) {
      const s = pe + 24 + opt + 40 * i;
      end = Math.max(end, le32(s + 20) + le32(s + 16));
    }
    return bytes.subarray(end);
  }
  return bytes;
}

/* Every atom under [start, end), depth first, each { type, id, start, end, depth }
   with start and end the body's. */
function qtAtoms(bytes, start, end, depth, out) {
  out = out || [];
  depth = depth || 0;
  let o = start;
  while (o + 20 <= end) {
    const size = u32be(bytes, o);
    if (size < 20 || o + size > end) throw new Error('an atom of ' + size + ' bytes at ' + o + ' does not fit');
    const atom = { type: String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]),
                   id: u32be(bytes, o + 8), start: o + 20, end: o + size, depth };
    out.push(atom);
    if (u16be(bytes, o + 14)) qtAtoms(bytes, o + 20, o + size, depth + 1, out);
    o += size;
  }
  return out;
}

/* One 'ssai' resource, read. Its samples may be in another instrument's
   resource: of the 1,544 key ranges in the QuickTime 3 set, the GS
   variations' borrow the base instrument's samples (an 'iref' beside the
   'sdsc' names it), and sample ids are unique across the whole set, so
   `sampleOf(id)` looks one up wherever it is. A key range may carry a 'knbl'
   of its own, which overrides the instrument's: 535 of them carry a whole
   envelope, 319 a transpose (knob 0x12, semitones in 8.8). */
function qtAtomicInstrument(bytes, sampleOf) {
  const atoms = qtAtoms(bytes, 12, bytes.length);
  const s32 = o => u32be(bytes, o) | 0;
  const knobsIn = a => {
    const out = {}, n = u32be(bytes, a.start);
    for (let k = 0; k < n; k++) {
      const id = u32be(bytes, a.start + 8 + 8 * k);
      if ((id & 0xFF000000) === 0x02000000) out[id & 0xFFFF] = s32(a.start + 12 + 8 * k);
    }
    return out;
  };
  const inst = { name: '', number: 0, gm: 0, knobs: {}, regions: [] };
  let region = null;
  for (const a of atoms) {
    if (a.depth === 1 && a.type === 'tone') {
      inst.name = decodeMacRoman(bytes.subarray(a.start + 37, a.start + 37 + bytes[a.start + 36])).trim();
      inst.number = s32(a.start + 68); inst.gm = s32(a.start + 72);
    } else if (a.depth === 1 && a.type === 'knbl') {
      inst.knobs = knobsIn(a);
    } else if (a.depth === 1) {
      region = null;
    } else if (a.depth === 2 && a.type === 'sdsc') {
      const o = a.start;
      region = {
        format: String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]),
        channels: u16be(bytes, o + 4), bits: u16be(bytes, o + 6), rate: u32be(bytes, o + 8) / 65536,
        sampleId: u16be(bytes, o + 12), offset: s32(o + 14), length: s32(o + 18),
        loopType: s32(o + 22), loopStart: s32(o + 26), loopEnd: s32(o + 30),
        root: s32(o + 34), low: s32(o + 38), high: s32(o + 42), knobs: {} };
      inst.regions.push(region);
    } else if (a.depth === 2 && a.type === 'knbl' && region) {
      region.knobs = knobsIn(a);
    }
  }
  for (const r of inst.regions) {
    r.knobs = Object.assign({}, inst.knobs, r.knobs);
    const raw = sampleOf(r.sampleId);
    if (!raw) throw new Error('"' + inst.name + '" names sample ' + r.sampleId + ', which the set does not hold');
    if (r.channels !== 1 || !((r.format === 'raw ' && r.bits === 8) || (r.format === 'twos' && r.bits === 16)))
      throw new Error('"' + inst.name + '" has a ' + r.channels + '-channel ' + r.bits + '-bit \'' + r.format + '\' sample');
    const n = Math.max(0, Math.min(r.length, (raw.length - r.offset) / (r.bits / 8) | 0));
    const pcm = new Float32Array(n);
    if (r.bits === 8) for (let i = 0; i < n; i++) pcm[i] = (raw[r.offset + i] - 128) / 128;
    else for (let i = 0; i < n; i++) pcm[i] = ((raw[r.offset + 2 * i] << 24 >> 16) | raw[r.offset + 2 * i + 1]) / 32768;
    r.pcm = pcm;
  }
  return inst;
}

/* A set of instruments from a resource fork: { ids, has(n), get(n) }.
   Instruments are read the first time one is asked for; the samples' index
   is built across every instrument the first time any is. */
function qtInstrumentLibrary(forkBytes) {
  const fork = openResourceFork(forkBytes);
  const entries = fork.resourcesByType['ssai'] || [];
  if (!entries.length) throw new Error('no instruments (\'ssai\' resources) in this file');
  const byId = new Map(entries.map(e => [e.id, e]));
  const read = new Map();
  let samples = null;
  const sampleOf = id => {
    if (!samples) {
      samples = new Map();
      for (const e of entries) {
        const d = fork.dataOf('ssai', e);
        let smin = null;
        for (const a of qtAtoms(d, 12, d.length)) {
          if (a.depth === 1) smin = a.type === 'smin' ? a.id : null;
          else if (a.depth === 2 && a.type === 'sdat' && smin !== null) samples.set(smin, d.subarray(a.start, a.end));
        }
      }
    }
    return samples.get(id);
  };
  return {
    forkBytes,
    ids: [...byId.keys()].sort((a, b) => a - b),
    has: n => byId.has(n),
    get(n) {
      if (!read.has(n)) read.set(n, byId.has(n) ? qtAtomicInstrument(fork.dataOf('ssai', byId.get(n)), sampleOf) : null);
      return read.get(n);
    }
  };
}

/* The instruments from whatever the visitor or archive.org handed over:
   QuickTime 3's Windows installer (QUICKTIM.EXE), its data.z, the .qtx, or a
   Mac file's resource fork. */
function qtInstrumentsFromFile(bytes) {
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
    const dataZ = qtInstallerDataZ(bytes);
    if (dataZ) return qtInstrumentsFromFile(dataZ);
    return qtInstrumentLibrary(qtxResourceFork(bytes));
  }
  if (looksLikeInstallShield3(bytes)) {
    const arc = parseInstallShield3(bytes);
    const e = arc.entries.find(x => /QuickTimeMusicalInstruments\.qtx$/i.test(x.path));
    if (!e) throw new Error('this installer does not hold QuickTimeMusicalInstruments.qtx');
    return qtInstrumentLibrary(qtxResourceFork(installShield3File(bytes, e)));
  }
  return qtInstrumentLibrary(bytes);
}

/* QUICKTIM.EXE is a self-extracting zip whose central directory does not
   agree with where its entries are (7-Zip says the same), so the one entry
   is taken from its local header, which carries the sizes, and held to its
   CRC-32. Returns null for an .exe that holds no data.z. */
function qtInstallerDataZ(exe) {
  const le16 = o => exe[o] | (exe[o + 1] << 8);
  const le32 = o => (exe[o] | (exe[o + 1] << 8) | (exe[o + 2] << 16) | (exe[o + 3] << 24)) >>> 0;
  for (let h = 0; h + 30 < exe.length; h++) {
    if (exe[h] !== 0x50 || exe[h + 1] !== 0x4B || exe[h + 2] !== 3 || exe[h + 3] !== 4) continue;
    const nameLen = le16(h + 26);
    const name = String.fromCharCode(...exe.subarray(h + 30, h + 30 + nameLen));
    if (!/(^|[\\/])data\.z$/i.test(name)) continue;
    const method = le16(h + 8), crc = le32(h + 14), packed = le32(h + 18), len = le32(h + 22);
    const start = h + 30 + nameLen + le16(h + 28);
    let out;
    if (method === 0) out = exe.slice(start, start + len);
    else if (method === 8) out = inflateRaw(exe.subarray(start, start + packed), len, 8);
    else throw new Error('data.z is packed with zip method ' + method);
    if (crc32(out) !== crc) throw new Error('data.z fails its CRC-32');
    return out;
  }
  return null;
}

function qtToneInstrument(lib, tone) {
  if (!tone) return null;
  if (lib.has(tone.instrument)) return lib.get(tone.instrument);
  if (tone.instrument >= 16384 && lib.has(16385)) return lib.get(16385);
  if (tone.gm >= 1 && tone.gm <= 128 && lib.has(tone.gm)) return lib.get(tone.gm);
  return null;
}

/* Play a tune's events (qParseTune's: times and lengths in 1/unitsPerSecond)
   through the instruments. Returns { left, right, rate, missing }: two
   Float32Arrays scaled so the loudest sample is just under full, and the
   parts whose instrument the set does not have. */
function qtmaRender(events, tones, lib, opts) {
  opts = opts || {};
  const rate = opts.rate || 44100, ups = opts.unitsPerSecond || 600;
  const tail = 2;   // seconds after the last note for releases to ring out
  const lastUnit = events.reduce((m, e) => Math.max(m, e.t + (e.dur || 0)), 0);
  const frames = Math.ceil((lastUnit / ups + tail) * rate);
  const left = new Float32Array(frames), right = new Float32Array(frames);

  const parts = {};
  const missing = [];
  const partOf = p => {
    if (!parts[p]) {
      const inst = qtToneInstrument(lib, tones[p]);
      if (!inst && tones[p]) missing.push(p);
      parts[p] = { inst, volume: 1, pan: 0.5, bend: 0, sustain: false, held: [] };
    }
    return parts[p];
  };

  // Controllers and notes in time order; a note's voice is rendered whole
  // when it starts, reading the part's controllers as they change under it.
  const ctlTimeline = {};
  for (const e of events) if (e.k === 'ctl') (ctlTimeline[e.part] = ctlTimeline[e.part] || []).push(e);
  const fixed = v => (v >= 0x8000 ? v - 0x10000 : v) / 256;
  const stateAt = (p, t) => {
    const s = { volume: 1, pan: 0.5, bend: 0, sustainOffAfter: null };
    let sustainOn = false, susStart = null;
    for (const e of ctlTimeline[p] || []) {
      if (e.t > t) {
        if (sustainOn && e.ctl === 64 && fixed(e.val) <= 0) { s.sustainOffAfter = e.t; break; }
        continue;
      }
      const v = fixed(e.val);
      if (e.ctl === 7) s.volume = Math.max(0, Math.min(127, v)) / 127;
      else if (e.ctl === 10) s.pan = e.val === 0 ? 0.5 : Math.max(0, Math.min(1, v - 1));
      else if (e.ctl === 32) s.bend = v;
      else if (e.ctl === 64) sustainOn = v > 0;
    }
    s.sustainOn = sustainOn;
    return s;
  };
  // Pitch bend changes during a note are followed; the rest are taken at its start.
  const bendSteps = (p, t0, t1) => (ctlTimeline[p] || []).filter(e => e.ctl === 32 && e.t > t0 && e.t < t1);

  const dbToGain = db => Math.pow(10, db / 20);
  const FLOOR_DB = -72;
  for (const e of events) {
    if (e.k !== 'note' || e.vol === 0) continue;
    const part = partOf(e.part);
    const inst = part.inst;
    if (!inst) continue;
    const region = inst.regions.find(r => e.pitch >= r.low && e.pitch <= r.high)
      || inst.regions.reduce((b, r) => (!b || Math.abs(r.root - e.pitch) < Math.abs(b.root - e.pitch) ? r : b), null);
    if (!region || !region.pcm.length) continue;
    const st = stateAt(e.part, e.t);
    const kit = inst.number >= 16384;
    let offUnit = e.t + Math.max(e.dur, 1);
    if (st.sustainOn) offUnit = Math.max(offUnit, st.sustainOffAfter == null ? lastUnit : st.sustainOffAfter);

    const k = region.knobs;
    const transpose = (k[QTMS_KNOB.transpose] || 0) / 256;
    const attack = (k[QTMS_KNOB.attack] || 0) / 1000 * rate;
    const decay = (k[QTMS_KNOB.decay] || 0) / 1000 * rate;
    const susLevel = k[QTMS_KNOB.sustain] === undefined ? 1 : k[QTMS_KNOB.sustain] / 65536;
    const susDb = susLevel > 0 ? Math.max(FLOOR_DB, 20 * Math.log10(susLevel)) : FLOOR_DB;
    const release = Math.max(1, (k[QTMS_KNOB.release] || 0) / 1000 * rate);
    const looped = region.loopEnd > region.loopStart;

    const gain = (e.vol / 127) * st.volume;
    const pl = Math.cos(st.pan * Math.PI / 2), pr = Math.sin(st.pan * Math.PI / 2);
    const f0 = Math.round(e.t / ups * rate);
    const offFrame = kit ? Infinity : Math.round(offUnit / ups * rate) - f0;
    const steps = bendSteps(e.part, e.t, offUnit).map(c => [Math.round(c.t / ups * rate) - f0, fixed(c.val)]);
    let bend = st.bend, nextStep = 0;
    const stepFor = b => region.rate / rate * Math.pow(2, (e.pitch - region.root + transpose + b) / 12);
    let step = stepFor(bend);

    const pcm = region.pcm, loopLen = region.loopEnd - region.loopStart + 1;
    // The envelope: attack, then a fall in decibels to the sustain level,
    // then from note-off a fall from wherever it was to silence. Each fall is
    // a constant ratio per frame, so it is a multiplication, not a power.
    const decayMul = decay > 0 ? dbToGain(susDb / decay) : 1;
    const relMul = dbToGain(FLOOR_DB / release);
    const held = susLevel > 0 ? susLevel : (decay > 0 ? 0 : 1);
    let pos = 0, env = 0, releasing = false, relLeft = 0;
    for (let i = 0; f0 + i < frames; i++) {
      if (nextStep < steps.length && i >= steps[nextStep][0]) { bend = steps[nextStep++][1]; step = stepFor(bend); }
      if (i >= offFrame) {
        if (!releasing) { releasing = true; relLeft = Math.ceil(release); }
        if (relLeft-- <= 0) break;
        env *= relMul;
      } else if (i < attack) env = i / attack;
      else if (i < attack + decay) env = i < attack + 1 ? 1 : env * decayMul;
      else env = held;
      if (env <= 0 && i >= attack) break;
      let ip = pos | 0;
      if (looped && ip > region.loopEnd) { pos -= loopLen * Math.floor((pos - region.loopStart) / loopLen); ip = pos | 0; }
      if (ip >= pcm.length - 1) { if (!looped) break; }
      const frac = pos - ip;
      const a = pcm[ip], b = ip + 1 < pcm.length ? pcm[ip + 1] : a;
      const s = (a + (b - a) * frac) * env * gain;
      left[f0 + i] += s * pl; right[f0 + i] += s * pr;
      pos += step;
    }
  }

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak > 0) { const g = 0.95 / peak; for (let i = 0; i < frames; i++) { left[i] *= g; right[i] *= g; } }
  return { left, right, rate, missing };
}

/* 16-bit stereo WAV bytes from qtmaRender's result. */
function qtmaWav(r) {
  const n = r.left.length;
  const { buffer } = wavHeader(n * 4, r.rate, 16, 2);
  // Little-endian samples straight into the buffer: a DataView call per
  // sample took longer than rendering the tune.
  const pcm = new Int16Array(buffer, 44, n * 2);
  for (let i = 0; i < n; i++) {
    pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(r.left[i] * 32767)));
    pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r.right[i] * 32767)));
  }
  return new Uint8Array(buffer);
}
