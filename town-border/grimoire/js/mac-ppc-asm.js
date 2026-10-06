/* mac-ppc-asm.js -- PowerPC instructions, written.

   The other half of mac-ppc.js: a line of assembly in the spelling
   ppcDecode prints (LLVM's) becomes the 32-bit word. Nothing here knows
   Cythera exists; the application patch (js/delv-apppatch.js) is its first
   caller, which is why it exists at all.

   ppcAssemble(line, at, resolve) -> word (an unsigned 32-bit number)

   `at` is the code address the word will sit at, for the branches.
   `resolve(name)` answers a code address for `@name`, or undefined.

   WHAT IT WRITES. The forms a compiler of the period emitted and a patch to
   such code needs: the loads and stores (D form, the update forms, lmw and
   stmw, the indexed X forms), the immediate arithmetic and logic, the
   compares with or without a condition field, the rotates with every alias
   ppcDecode prints for them, the register arithmetic and logic (with the
   overflow and record forms), the shifts, extsb, extsh and cntlzw, the
   moves to and from lr, ctr and cr, and the branches. Floating point is not
   written: nothing a patch here needs uses it.

   THE SPELLING IS THE DECODER'S, so that the test of a written word is the
   decoder: `utilities/app_patch_check.mjs` takes every word of the
   application's code section the decoder reads, hands its printed text
   back here at its own address, and requires the same word -- every word
   inside a routine but 45 floating-point ones, and none written
   differently. The decoder is held to LLVM (ppc_check.mjs), so that is
   LLVM's reading written back. Every line of every fix is also handed to
   `llvm-mc` itself, which must write the same word, all but a branch's
   displacement, which LLVM leaves to a fixup and the check holds by
   decoding the word and comparing where it goes.
   Registers are bare numbers, as the decoder prints them (`r3` is accepted
   too). Beyond the decoder's spelling it takes a few conveniences, each
   turned into one of its forms:

     - a branch target written `@0x446B4` (a code address) or `@name` (what
       `resolve` answers: a routine, a label), besides the decoder's `.+n`;
     - `beq`, `bne`, `blt`, `bge`, `bgt`, `ble`, `bso`, `bns`, with an
       optional `crN,` first, for the decoder's `bt` and `bf` on the bit;
       and `beqlr`, `bnelr` and the rest for `bclr`;
     - `mr.`, `not.`, and the rotate aliases in either direction.

   A line it cannot write throws, naming the line: a patch that silently
   wrote a different instruction is the failure this file exists to rule
   out. */

function ppcAsmError(line, why) { return new Error('cannot assemble "' + line + '": ' + why); }

function ppcAssemble(line, at, resolve) {
  const src = String(line).replace(/;.*$/, '').trim();
  if (!src) throw ppcAsmError(line, 'empty');
  const m = /^([a-z][a-z.+-]*)\s*(.*)$/i.exec(src);
  if (!m) throw ppcAsmError(line, 'no mnemonic');
  const mn = m[1].toLowerCase();
  const ops = m[2].trim() ? m[2].split(',').map(s => s.trim()) : [];
  const num = (s) => {
    const t = String(s).trim();
    if (!/^-?(0x[0-9a-f]+|\d+)$/i.test(t)) throw ppcAsmError(line, 'not a number: ' + t);
    return t[0] === '-' ? -parseInt(t.slice(1)) : parseInt(t);
  };
  const reg = (s) => {
    const t = String(s).trim().replace(/^r/i, '');
    const v = num(t);
    if (v < 0 || v > 31) throw ppcAsmError(line, 'register out of range: ' + s);
    return v;
  };
  const crfield = (s) => { const t = String(s).trim().replace(/^cr/i, ''); const v = num(t); if (v < 0 || v > 7) throw ppcAsmError(line, 'condition field: ' + s); return v; };
  const s16 = (v) => { if (v < -32768 || v > 32767) throw ppcAsmError(line, 'signed immediate out of range: ' + v); return v & 0xFFFF; };
  const u16 = (v) => { if (v < 0 || v > 0xFFFF) throw ppcAsmError(line, 'unsigned immediate out of range: ' + v); return v; };
  const u5 = (v) => { if (v < 0 || v > 31) throw ppcAsmError(line, 'field out of range: ' + v); return v; };
  const need = (n) => { if (ops.length !== n) throw ppcAsmError(line, 'wants ' + n + ' operands'); };
  const target = (s) => {
    const t = String(s).trim();
    let r;
    if ((r = /^\.([+-])(\d+|0x[0-9a-f]+)$/i.exec(t))) return (r[1] === '-' ? -1 : 1) * parseInt(r[2]);
    if ((r = /^@(0x[0-9a-f]+)$/i.exec(t))) return parseInt(r[1]) - at;
    if ((r = /^@(.+)$/.exec(t))) {
      const a = resolve ? resolve(r[1]) : undefined;
      if (a === undefined || a === null) throw ppcAsmError(line, 'unknown target ' + r[1]);
      return a - at;
    }
    throw ppcAsmError(line, 'a branch target is .+n, @0xADDR or @name: ' + t);
  };
  const mem = (s) => {
    const r = /^(-?(?:0x[0-9a-f]+|\d+))\((r?\d+)\)$/i.exec(String(s).trim());
    if (!r) throw ppcAsmError(line, 'not d(ra): ' + s);
    return [num(r[1]), reg(r[2])];
  };
  const W = (v) => v >>> 0;
  const D = (op, rt, ra, imm16) => W((op << 26) | (rt << 21) | (ra << 16) | imm16);
  const X = (rt, ra, rb, xo, rc) => W((31 << 26) | (rt << 21) | (ra << 16) | (rb << 11) | (xo << 1) | (rc ? 1 : 0));
  const XO = (rd, ra, rb, xo9, oe, rc) => W((31 << 26) | (rd << 21) | (ra << 16) | (rb << 11) | ((oe ? 1 : 0) << 10) | (xo9 << 1) | (rc ? 1 : 0));
  const M = (op, rs, ra, sh, mb, me, rc) => W((op << 26) | (rs << 21) | (ra << 16) | (u5(sh) << 11) | (u5(mb) << 6) | (u5(me) << 1) | (rc ? 1 : 0));
  const dot = mn.endsWith('.') && mn !== 'andi.' && mn !== 'andis.' && mn !== 'addic.';
  const base = dot ? mn.slice(0, -1) : mn;

  // D form: loads and stores.
  const DMEM = { lwz: 32, lwzu: 33, lbz: 34, lbzu: 35, stw: 36, stwu: 37, stb: 38, stbu: 39, lhz: 40, lhzu: 41,
                 lha: 42, lhau: 43, sth: 44, sthu: 45, lmw: 46, stmw: 47 };
  if (DMEM[mn] !== undefined) { need(2); const [d, ra] = mem(ops[1]); return D(DMEM[mn], reg(ops[0]), ra, s16(d)); }
  // D form: immediate arithmetic.
  const DIMM = { mulli: 7, subfic: 8, addic: 12, 'addic.': 13, addi: 14, addis: 15 };
  if (DIMM[mn] !== undefined) { need(3); return D(DIMM[mn], reg(ops[0]), reg(ops[1]), s16(num(ops[2]))); }
  if (mn === 'li') { need(2); return D(14, reg(ops[0]), 0, s16(num(ops[1]))); }
  if (mn === 'lis') { need(2); return D(15, reg(ops[0]), 0, s16(num(ops[1]))); }
  // D form: logical immediates, rA first as the decoder prints them.
  const DLOG = { ori: 24, oris: 25, xori: 26, xoris: 27, 'andi.': 28, 'andis.': 29 };
  if (DLOG[mn] !== undefined) { need(3); return D(DLOG[mn], reg(ops[1]), reg(ops[0]), u16(num(ops[2]))); }
  if (mn === 'nop') { need(0); return 0x60000000; }
  // Compares.
  if (mn === 'cmpwi' || mn === 'cmplwi' || mn === 'cmpw' || mn === 'cmplw') {
    if (ops.length !== 2 && ops.length !== 3) throw ppcAsmError(line, 'wants 2 or 3 operands');
    const crf = ops.length === 3 ? crfield(ops[0]) : 0, a = reg(ops[ops.length - 2]), last = ops[ops.length - 1];
    if (mn === 'cmpwi') return D(11, crf << 2, a, s16(num(last)));
    if (mn === 'cmplwi') return D(10, crf << 2, a, u16(num(last)));
    return X(crf << 2, a, reg(last), mn === 'cmpw' ? 0 : 32, false);
  }
  // Rotates and their aliases.
  if (base === 'rlwinm' || base === 'rlwimi') { need(5); return M(base === 'rlwinm' ? 21 : 20, reg(ops[1]), reg(ops[0]), num(ops[2]), num(ops[3]), num(ops[4]), dot); }
  if (base === 'rlwnm') { need(5); return W((23 << 26) | (reg(ops[1]) << 21) | (reg(ops[0]) << 16) | (reg(ops[2]) << 11) | (u5(num(ops[3])) << 6) | (u5(num(ops[4])) << 1) | (dot ? 1 : 0)); }
  if (base === 'rotlw') { need(3); return W((23 << 26) | (reg(ops[1]) << 21) | (reg(ops[0]) << 16) | (reg(ops[2]) << 11) | (31 << 1) | (dot ? 1 : 0)); }
  if (base === 'slwi') { need(3); const n = num(ops[2]); if (n < 0 || n > 31) throw ppcAsmError(line, 'shift'); return M(21, reg(ops[1]), reg(ops[0]), n, 0, 31 - n, dot); }
  if (base === 'srwi') { need(3); const n = num(ops[2]); if (n < 1 || n > 31) throw ppcAsmError(line, 'shift'); return M(21, reg(ops[1]), reg(ops[0]), 32 - n, n, 31, dot); }
  if (base === 'rotlwi') { need(3); return M(21, reg(ops[1]), reg(ops[0]), num(ops[2]), 0, 31, dot); }
  if (base === 'clrlwi') { need(3); return M(21, reg(ops[1]), reg(ops[0]), 0, num(ops[2]), 31, dot); }
  // Register arithmetic: rD, rA, rB (sub and subc turned round, as the decoder prints them).
  const OVF = base.endsWith('o') && ['addo', 'subfo', 'addco', 'subfco', 'addeo', 'subfeo', 'mullwo', 'divwo', 'divwuo', 'nego', 'addzeo', 'subfzeo', 'addmeo', 'subfmeo'].includes(base);
  const arith = OVF ? base.slice(0, -1) : base;
  const XO3 = { subfc: 8, addc: 10, mulhwu: 11, subf: 40, mulhw: 75, subfe: 136, adde: 138, mullw: 235, add: 266, divwu: 459, divw: 491 };
  if (XO3[arith] !== undefined) { need(3); return XO(reg(ops[0]), reg(ops[1]), reg(ops[2]), XO3[arith], OVF, dot); }
  if (arith === 'sub' || arith === 'subc') { need(3); return XO(reg(ops[0]), reg(ops[2]), reg(ops[1]), arith === 'sub' ? 40 : 8, false, dot); }
  const XO2 = { neg: 104, subfze: 200, addze: 202, subfme: 232, addme: 234 };
  if (XO2[arith] !== undefined) { need(2); return XO(reg(ops[0]), reg(ops[1]), 0, XO2[arith], OVF, dot); }
  // Register logic and shifts: rA, rS, rB as the decoder prints them.
  const XL = { and: 28, andc: 60, nor: 124, eqv: 284, xor: 316, orc: 412, or: 444, slw: 24, srw: 536, sraw: 792 };
  if (XL[base] !== undefined) { need(3); return X(reg(ops[1]), reg(ops[0]), reg(ops[2]), XL[base], dot); }
  if (base === 'mr') { need(2); const s = reg(ops[1]); return X(s, reg(ops[0]), s, 444, dot); }
  if (base === 'not') { need(2); const s = reg(ops[1]); return X(s, reg(ops[0]), s, 124, dot); }
  if (base === 'srawi') { need(3); return X(reg(ops[1]), reg(ops[0]), u5(num(ops[2])), 824, dot); }
  const X2 = { cntlzw: 26, extsh: 922, extsb: 954 };
  if (X2[base] !== undefined) { need(2); return X(reg(ops[1]), reg(ops[0]), 0, X2[base], dot); }
  // Indexed loads and stores: rT, rA, rB.
  const XIDX = { lwzx: 23, lwzux: 55, lbzx: 87, lbzux: 119, stwx: 151, stwux: 183, stbx: 215, stbux: 247,
                 lhzx: 279, lhzux: 311, lhax: 343, lhaux: 375, sthx: 407, sthux: 439 };
  if (XIDX[mn] !== undefined) { need(3); return X(reg(ops[0]), reg(ops[1]), reg(ops[2]), XIDX[mn], false); }
  // Moves to and from the special registers.
  const SPR = { lr: 8, ctr: 9, xer: 1 };
  const sprField = (n) => ((n & 31) << 5) | (n >>> 5);
  if (/^mf(lr|ctr|xer)$/.test(mn)) { need(1); return W((31 << 26) | (reg(ops[0]) << 21) | (sprField(SPR[mn.slice(2)]) << 11) | (339 << 1)); }
  if (/^mt(lr|ctr|xer)$/.test(mn)) { need(1); return W((31 << 26) | (reg(ops[0]) << 21) | (sprField(SPR[mn.slice(2)]) << 11) | (467 << 1)); }
  if (mn === 'mfcr') { need(1); return X(reg(ops[0]), 0, 0, 19, false); }
  if (mn === 'mtcr') { need(1); return W((31 << 26) | (reg(ops[0]) << 21) | (0xFF << 12) | (144 << 1)); }
  if (mn === 'mtcrf') { need(2); return W((31 << 26) | (reg(ops[1]) << 21) | ((num(ops[0]) & 0xFF) << 12) | (144 << 1)); }
  // Condition register logic.
  const CR = { crnor: 33, crandc: 129, crxor: 193, crnand: 225, crand: 257, creqv: 289, crorc: 417, cror: 449 };
  if (CR[mn] !== undefined) { need(3); return W((19 << 26) | (u5(num(ops[0])) << 21) | (u5(num(ops[1])) << 16) | (u5(num(ops[2])) << 11) | (CR[mn] << 1)); }
  if (mn === 'crclr') { need(1); const v = u5(num(ops[0])); return W((19 << 26) | (v << 21) | (v << 16) | (v << 11) | (193 << 1)); }
  if (mn === 'crset') { need(1); const v = u5(num(ops[0])); return W((19 << 26) | (v << 21) | (v << 16) | (v << 11) | (289 << 1)); }
  if (mn === 'crmove') { need(2); const d = u5(num(ops[0])), s = u5(num(ops[1])); return W((19 << 26) | (d << 21) | (s << 16) | (s << 11) | (449 << 1)); }
  if (mn === 'crnot') { need(2); const d = u5(num(ops[0])), s = u5(num(ops[1])); return W((19 << 26) | (d << 21) | (s << 16) | (s << 11) | (33 << 1)); }
  // Branches.
  if (mn === 'b' || mn === 'bl') {
    need(1); const d = target(ops[0]);
    if (d & 3 || d < -0x2000000 || d >= 0x2000000) throw ppcAsmError(line, 'displacement out of range');
    return W((18 << 26) | (d & 0x03FFFFFC) | (mn === 'bl' ? 1 : 0));
  }
  const bcw = (bo, bi, tgt, lk) => {
    const d = target(tgt);
    if (d & 3 || d < -0x8000 || d >= 0x8000) throw ppcAsmError(line, 'conditional displacement out of range');
    return W((16 << 26) | (bo << 21) | (bi << 16) | (d & 0xFFFC) | (lk ? 1 : 0));
  };
  // The decoder's bt and bf (with its hints), bdnz and bdz, and bc itself.
  let r;
  if ((r = /^(bt|bf)(l?)([+-]?)$/.exec(mn))) {
    need(2); const hint = r[3] === '-' ? 2 : r[3] === '+' ? 3 : 0;
    return bcw((r[1] === 'bt' ? 12 : 4) | hint, u5(num(ops[0])), ops[1], r[2] === 'l');
  }
  if ((r = /^(bdnz|bdz)(l?)([+-]?)$/.exec(mn))) {
    need(1); const hint = r[3] === '-' ? 8 : r[3] === '+' ? 9 : 0;
    return bcw((r[1] === 'bdnz' ? 16 : 18) | hint, 0, ops[0], r[2] === 'l');
  }
  if ((r = /^bc(l?)$/.exec(mn))) { need(3); return bcw(u5(num(ops[0])), u5(num(ops[1])), ops[2], r[1] === 'l'); }
  // The aliases on one condition bit: (bit in the field, branch when set).
  const COND = { lt: [0, true], ge: [0, false], gt: [1, true], le: [1, false], eq: [2, true], ne: [2, false], so: [3, true], ns: [3, false] };
  if ((r = /^b(lt|ge|gt|le|eq|ne|so|ns)(l?)$/.exec(mn))) {
    const [bit, set] = COND[r[1]];
    if (ops.length !== 1 && ops.length !== 2) throw ppcAsmError(line, 'wants a target, or crN and a target');
    const crf = ops.length === 2 ? crfield(ops[0]) : 0;
    return bcw(set ? 12 : 4, crf * 4 + bit, ops[ops.length - 1], r[2] === 'l');
  }
  // To the link and count registers.
  if (mn === 'blr') { need(0); return 0x4E800020; }
  if (mn === 'blrl') { need(0); return 0x4E800021; }
  if (mn === 'bctr') { need(0); return 0x4E800420; }
  if (mn === 'bctrl') { need(0); return 0x4E800421; }
  if ((r = /^bc(lr|ctr)(l?)$/.exec(mn))) { need(2); return W((19 << 26) | (u5(num(ops[0])) << 21) | (u5(num(ops[1])) << 16) | ((r[1] === 'lr' ? 16 : 528) << 1) | (r[2] ? 1 : 0)); }
  if ((r = /^b(lt|ge|gt|le|eq|ne|so|ns)(lr|ctr)(l?)$/.exec(mn))) {
    const [bit, set] = COND[r[1]];
    if (ops.length > 1) throw ppcAsmError(line, 'wants at most crN');
    const crf = ops.length === 1 ? crfield(ops[0]) : 0;
    return W((19 << 26) | ((set ? 12 : 4) << 21) | ((crf * 4 + bit) << 16) | ((r[2] === 'lr' ? 16 : 528) << 1) | (r[3] ? 1 : 0));
  }
  throw ppcAsmError(line, 'not a form this writes');
}

/* The decoder's text for a word, with a relative branch target written as
   the code address it reaches: what a line of a fix is compared with. */
function ppcTextAt(word, at) {
  const d = ppcDecode(word);
  if (!d) return null;
  if (d.branch && !d.indirect && !d.aa && typeof d.disp === 'number') {
    const args = d.args.slice(0, -1).concat('@0x' + ((at + d.disp) >>> 0).toString(16).toUpperCase());
    return d.mn + ' ' + args.join(', ');
  }
  return d.text;
}
