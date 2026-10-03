/* Delver VM scripts, folded into something closer to source.
 * ===========================================================================
 *
 * js/delv-script.js renders the listing the rest of this project is built on:
 * one op a line, the offset in the gutter, indented by the expression tree. It
 * stays exactly as it is and nothing here changes it, because three things
 * depend on its text character for character -- `decoder snapshot` in the
 * suite hashes it, the search index is built from it so a line of dialogue can
 * be found, and the matchers in js/page-rules.js read rules out of it with
 * regular expressions over op text. A folded view is therefore a SECOND
 * renderer over the SAME decoder, not a change to the first.
 *
 * LOAD ORDER: after js/delv-script.js, whose dvmDisassemble, dvmExtents and
 * DVM_SYM this uses.
 *
 * WHAT FOLDING IS. The listing is already a tree -- dvmDisassemble gives each
 * op the number of expression frames it opens, and the 0x40 that closes one.
 * But inside a frame the stream is POSTFIX: `add` does not carry its operands,
 * it consumes the two values before it. So
 *
 *     call_resource CastSpell           CastSpell(Arg00.container, 6, 24)
 *         arg Arg00
 *         get_field container     -->
 *         byte 0x06
 *         byte 0x18
 *     end
 *
 * Note what that says and what it does not: `get_field` CONSUMES the Arg00
 * before it, so the call takes three arguments and not four. Read the other way
 * it would be four, and the fold would be asserting something about CastSpell
 * that the bytes do not say.
 *
 * needs both halves: the frame structure for the call, and a small stack
 * machine inside it for `get_field`, which turns the value before it into a
 * field access.
 *
 * WHICH OPS CONSUME VALUES IS THE ONE THING NOT WRITTEN DOWN ANYWHERE.
 * delvmod's ddasm emits postfix, so it never needs arity; its rdasm is a flat
 * one-mnemonic-one-byte assembler and carries none either. The wiki's RDASM
 * Opcodes page gives the semantics in words -- "Push an immediate signed byte
 * onto the evaluation stack", "The usual arithmetic operation", "length of
 * object on top of stack" -- which settles what each op MEANS without ever
 * stating a number. So DVM_POPS below is read off those descriptions, and it
 * is checked rather than trusted: utilities/fold_check.mjs folds every
 * function in the archive and fails unless
 *
 *   1. every expression frame reduces to exactly one value -- a wrong arity
 *      anywhere leaves a frame with two values or short of one, and
 *   2. re-expanding the folded tree gives back the identical op sequence.
 *
 * Together those say the fold is a faithful reorganisation of the decode and
 * not a second reading of it. (1) is the one that catches a wrong number.
 */

/* How many values an op consumes from the frame it sits in, for the ops that
   open no frame of their own. Everything absent from this map is a value: a
   literal, a local, an argument, a global, a loaded word. Read off the wiki's
   RDASM Opcodes table. */
const DVM_POPS = {
  0x46: 2,                                  // index: an array and a subscript
  0x4A: 2, 0x4B: 2, 0x4C: 2, 0x4D: 2, 0x4E: 2,          // add sub mul div mod
  0x4F: 2, 0x50: 2, 0x51: 2, 0x52: 2, 0x53: 2, 0x54: 2, // lt le gt ge ne eq
  0x55: 1,                                              // neg
  0x56: 2, 0x57: 2, 0x58: 2,                            // bitwise and or xor
  0x59: 1,                                              // bitwise_not
  0x5A: 2, 0x5B: 2,                                     // shifts
  0x5C: 2, 0x5D: 2,                                     // logical and or
  0x5E: 1, 0x5F: 1,                                     // not, len
  0x60: 1,                                  // has_member: of the object below
  0x61: 1,                                  // class_member: indexes it
  0x62: 1, 0x63: 1, 0x64: 1,                // get_field, cast, is_type
};

/* How each of those reads once folded. A binary entry is infix, a unary one is
   a prefix symbol unless it is spelt as a call. */
const DVM_INFIX = {
  0x4A: '+', 0x4B: '-', 0x4C: '*', 0x4D: '/', 0x4E: '%',
  0x4F: '<', 0x50: '<=', 0x51: '>', 0x52: '>=', 0x53: '!=', 0x54: '==',
  0x56: '&', 0x57: '|', 0x58: '^', 0x5A: '<<', 0x5B: '>>',
  // The VM's logical `and` and `or` consume two values already computed, so
  // both sides have run. They are spelt as words, not `&&` and `||`, because a
  // reader takes those to stop at the first side that settles it -- which is
  // what a merged condition (dvmMergeConditions) does, and these do not.
  0x5C: 'and', 0x5D: 'or',
};
const DVM_PREFIX = { 0x55: '-', 0x59: '~', 0x5E: '!' };

/* A symbol's name without the code the listing prints beside it: the raw
   listing says `get_field container (0xB)` so that the number is never hidden,
   and folded text says `.container`, the number being one tap away in the raw
   view. An operand with no name keeps whatever the listing gave it. */
function dvmPlainName(arg) {
  const m = /^(.*?)\s*\((0x[0-9A-Fa-f]+)\)\s*$/.exec(arg || '');
  return m ? m[1] : (arg || '');
}

/* The first token of an operand, dropping the `// note` the listing appends.
   `dvmAnnotateInt` writes those notes and they are worth reading, but they are
   sentences and belong in the raw view. */
function dvmBareOperand(arg) {
  const s = String(arg || '').split('  //')[0].trim();
  return s;
}

/* Every offset in this resource that the dispatch table names, and what it
 * names it. The table is at the offset the first word gives, and each entry is
 * six bytes: a dref as a big-endian long, then the key as a word. A dref with
 * the top bit set and this resource's id in bits 16..30 points at an object
 * here; 0x5000FFFF is the table's way of saying the slot is empty.
 *
 * This is what turns `function obj_0061(1 args, 0 locals)` into
 * `function Use(Arg00)`. delvmod's ddasm has named functions this way since it
 * was written and this page never did, which is the single largest difference
 * between the two listings for a reader.
 */
function dvmSlotNames(b, resid) {
  const names = new Map();
  if (!b || b.length < 4) return names;
  const head = b[0];
  // Only the dispatch-table shape has a table; a bare function or array does
  // not, and neither does subindex 3's named-script form.
  if (head === 0x81 || (head & 0xF0) === 0x90 || (head & 0xF0) === 0xA0) return names;
  const toff = u16be(b, 0);
  if (toff < 2 || toff + 2 > b.length) return names;
  const count = u16be(b, toff) & 0x0FFF;
  for (let i = 0, p = toff + 2; i < count && p + 6 <= b.length; i++, p += 6) {
    const value = u32be(b, p), key = u16be(b, p + 4);
    if (!(value & 0x80000000)) continue;
    if (((value & 0x7FFF0000) >>> 16) !== resid) continue;
    const off = value & 0xFFFF;
    if (off >= b.length) continue;
    const name = (DVM_SYM.method && DVM_SYM.method[String(key)]) ||
                 (DVM_SYM.field && DVM_SYM.field[String(key)]) ||
                 ('Slot' + key.toString(16).toUpperCase().padStart(4, '0'));
    // A slot already named keeps its first name: two keys can point at one
    // object (0x1A28 has two slots on 0x5000FFFF and the shipped archive has
    // objects shared between a method and a field), and the first is the one
    // the table lists.
    if (!names.has(off)) names.set(off, name);
  }
  return names;
}

/* ---- the tree -------------------------------------------------------------
 * One pass over the flat op list. An op that opens frames gets its children in
 * `groups`, one array per frame, in the order the frames close -- which is the
 * order they appear in the bytes. `close` keeps the closing op of each frame,
 * because `then -> 0x0094` and `cases ( ... )` carry the branch targets and an
 * `end` carries nothing.
 */
function dvmForest(ops) {
  const root = { groups: [[]], close: [], pending: 0, mn: '<root>' };
  const stack = [root.groups[0]];           // innermost open frame last
  const owners = [root];
  for (const [at, delta, mn, arg, expect, op] of ops) {
    const frame = stack[stack.length - 1];
    if (delta === -1) {
      // Close the innermost frame: it belongs to the owner beside it.
      const owner = owners[owners.length - 1];
      if (owner === root) continue;          // a stray 0x40; the raw view shows it
      owner.close.push({ at, mn, arg });
      owner.pending--;
      stack.pop(); owners.pop();
      if (owner.pending > 0) {
        // The same op opens another frame straight away -- set_field takes two,
        // set_index three -- so open the next one for it rather than returning
        // to its parent.
        owner.groups.push([]);
        stack.push(owner.groups[owner.groups.length - 1]);
        owners.push(owner);
      }
      continue;
    }
    const node = { at, mn, arg, op, expect, groups: [], close: [], pending: expect };
    frame.push(node);
    if (expect > 0) {
      node.groups.push([]);
      stack.push(node.groups[0]);
      owners.push(node);
    }
  }
  return root.groups[0];
}

/* ---- rendering a frame ----------------------------------------------------
 * The postfix half. Walk a frame's nodes, pushing values and applying the ops
 * that consume them; the result should be one value. `left` is what the frame
 * had left over, and the check reads it: anything but exactly one means the
 * arity table is wrong for something in here.
 */
function dvmReduceFrame(nodes, ctx) {
  const st = [];
  for (const n of nodes) {
    const pops = (n.expect > 0) ? 0 : (DVM_POPS[n.op] || 0);
    if (n.expect > 0) { st.push(dvmFoldCall(n, ctx)); continue; }
    if (!pops) { st.push(dvmFoldValue(n, ctx)); continue; }
    if (st.length < pops) { st.push(dvmFoldValue(n, ctx) + '/*under*/'); continue; }
    const args = st.splice(st.length - pops, pops);
    st.push(dvmFoldOperator(n, args, ctx));
  }
  return st;
}

function dvmFoldFrame(nodes, ctx) {
  const st = dvmReduceFrame(nodes, ctx);
  if (st.length === 1) return st[0];
  if (!st.length) return '';
  // More than one value left. The raw view is the honest thing to send a
  // reader to, so say so rather than joining them and pretending.
  return st.join(', ');
}

function dvmFoldValue(n, ctx) {
  const bare = dvmBareOperand(n.arg);
  if (ctx && ctx.say && n.mn === 'global') return dvmSayName(dvmPlainName(bare));
  if (ctx && ctx.say && ctx.subst && (n.mn === 'arg' || n.mn === 'local') && ctx.subst.has(bare)) return ctx.subst.get(bare);
  if (ctx && ctx.say && ctx.self && n.mn === 'arg' && bare === ctx.self) return 'it';
  if (ctx && ctx.say && ctx.target && n.mn === 'arg' && bare === ctx.target) return ctx.targetName || 'the target';
  switch (n.mn) {
    case 'local': case 'arg': return bare;
    case 'byte': case 'short': case 'word': {
      /* The raw listing's note after an operand: a signed reading where a
         byte or short is negative (`byte 0xFB  // -5`), then whatever
         dvmAnnotateInt knows the number to mean. The signed reading IS the
         value -- 0xFB as 251 reads every dark zone's light level backwards --
         so it replaces the number. The rest of the note is not carried: its
         names are tables typed into this page from the board and the wiki,
         and a name in these listings is one computed from the game's files
         (dvmFoldCallNotes). */
      const note = String(n.arg || '').split('  //')[1];
      const neg = note && /^\s*(-\d+)(?:,|$)/.exec(note);
      return neg ? neg[1] : dvmFoldNumber(bare);
    }
    case 'string': case 'string(implicit)': return bare;
    case 'global': return dvmPlainName(bare);
    case 'load_near_word': return 'word@' + bare;
    case 'load_far_word': return 'word@' + bare;
    case 'subroutine': return 'sub@' + bare;
    case 'data': return '<data ' + bare + '>';
    case 'index': return 'index';
    case 'exit': return 'exit';
    case '??': return '<' + bare + '>';
    default: return n.mn + (bare ? ' ' + bare : '');
  }
}

/* An operand as a number. The raw listing prints a byte and a short in hex and
   a word already decimal, which reads as two conventions in one line --
   `PlaySound(0x30, ...)` beside `MagicAuraEffect(..., 240)`. Decimal throughout
   here; the raw view keeps its own spelling, which is an open question of its
   own and not one this view has to wait for. A value that is not a plain number
   (a dref, an object reference, a name the word decoder resolved) is left
   exactly as the decoder wrote it. */
function dvmFoldNumber(bare) {
  const m = /^0x([0-9A-Fa-f]+)$/.exec(bare);
  if (m) return String(parseInt(m[1], 16));
  return bare;
}

function dvmFoldOperator(n, args, ctx) {
  if (ctx && ctx.say) return dvmSayOperator(n, args, ctx);
  const infix = DVM_INFIX[n.op];
  if (infix) return '(' + args[0] + ' ' + infix + ' ' + args[1] + ')';
  const prefix = DVM_PREFIX[n.op];
  if (prefix) return prefix + args[0];
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  switch (n.op) {
    case 0x46: return args[0] + '[' + args[1] + ']';           // index
    case 0x5F: return 'len(' + args[0] + ')';
    case 0x60: return args[0] + ' has ' + bare;                // has_member
    case 0x61: {                                               // class_member
      /* `class_member 0xKKWW` reads word WW of the class's member KK -- the
         member a `has` tests, by the same key -- so 0x2A03 is
         `.MeleeWeapon[3]`, which is how the page's own readers write it
         (weaponSkillOffLoop in js/page-rules.js). A key delvmod's method
         table does not name stays as the number. */
      const m = /^0x([0-9A-F]{2})([0-9A-F]{2})$/i.exec(bare);
      const k = m && String(parseInt(m[1], 16));
      const key = m && ((DVM_SYM.method && DVM_SYM.method[k]) || (DVM_SYM.field && DVM_SYM.field[k]));
      return args[0] + '.' + (key ? key + '[' + parseInt(m[2], 16) + ']' : bare);
    }
    case 0x62: return args[0] + '.' + bare;                    // get_field
    case 0x63: return bare + '(' + args[0] + ')';              // cast
    case 0x64: return args[0] + ' is ' + bare;                 // is_type
    default: return n.mn + '(' + args.join(', ') + ')';
  }
}

/* An op that opened frames. Most are calls or statements; the ones that take
   more than one frame spell out where each frame went. */
function dvmFoldCall(n, ctx) {
  if (ctx && ctx.say) return dvmSayCall(n, ctx);
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const g = n.groups.map(f => dvmFoldFrame(f, ctx));
  // `sys Name` arrives as one mnemonic with the name inside it.
  if (/^sys /.test(n.mn)) {
    const name = n.mn.slice(4), vals = dvmReduceFrame(n.groups[0] || [], ctx);
    dvmFoldCallNotes(name, vals, ctx);
    return name + '(' + vals.join(', ') + ')';
  }
  switch (n.mn) {
    case 'call_resource': case 'call_subroutine': {
      // A resource the raw listing leaves as its id may have a name the page
      // reads off its bytecode (dvmFoldResourceName); the call says it.
      const id = n.mn === 'call_resource' && /^0x([0-9A-F]+)$/i.exec(bare);
      return (id ? dvmFoldResourceName(parseInt(id[1], 16)) : bare) + '(' + dvmArgList(n.groups[0], ctx) + ')';
    }
    case 'call_index':
      /* `9C rr rr (i...) 40 (p...) 40` -- the wiki's table: calls the resource
         at r plus the index expression, with the second frame as its
         parameters. Two frames of different kinds, which is why the fold check
         classifies its groups separately. */
      return bare + '[' + (g[0] || '') + '](' + dvmArgList(n.groups[1], ctx) + ')';
    case 'method': {
      // The receiver is the first value in the frame and the rest are the
      // arguments, which is how `method Look / arg Arg00 / end` reads as
      // Arg00.Look().
      const vals = dvmReduceFrame(n.groups[0] || [], ctx);
      const recv = vals.length ? vals[0] : '';
      return (recv ? recv + '.' : '') + bare + '(' + vals.slice(1).join(', ') + ')';
    }
    case 'gui': return 'gui.' + bare + '(' + dvmArgList(n.groups[0], ctx) + ')';
    case 'gui_close': return 'gui.close(' + (g[0] || '') + ')';
    case 'ai_state': return 'ai_state(' + bare + (g[0] ? ', ' + g[0] : '') + ')';
    default: return n.mn + (bare ? ' ' + bare : '') + '(' + g.join(', ') + ')';
  }
}

/* ---- what a number stands for ----------------------------------------------
 * A statement's numbers that the game's own files name are said in a comment
 * at the end of its line: `ChangeZone(Arg00, 12)   // zoneport 12: Iron Mine`.
 * The number stays in the code, where it is what the bytes say.
 *
 * ONLY WHAT THE FILES SAY. The maintainer's rule of 22 September 2026: a name
 * here is computed from the game's data or code, never typed in. The page
 * carried hand-made tables beside the file's names -- the Ambrosia board's
 * status flag names, the wiki's sound labels and prop types, which went on
 * 23 September 2026 -- and still carries helper names an earlier session
 * wrote after reading their bytecode (DVM_SCRIPT_NAMES); none of them is
 * used for these listings. The first version of this, the same day, used
 * several, and was taken out. What is used:
 *   - a To Do line: AddQuest's text reference read in the array it points
 *     into, and CompleteQuest's slot read in the same array, which is the
 *     page's own convention for the slot a line is struck from (todoRules);
 *   - a sound, the number every sound call adds to 0x9100: its id, as a link,
 *     and a name only where the archive's own symbol table has one;
 *   - a zoneport: the zone the 0xF00C entry sends to, named by the title its
 *     own entry script sets (loadZoneports, zoneNameFor);
 *   - the prop type Create and New make: named by the file's name for its
 *     base tile (0xF004, terrainNameFor), not by the wiki's list.
 * delvmod's symbol tables -- the syscall, method and field names the whole
 * listing is spelt in -- are the one outside source kept, as they are
 * everywhere else on the site. `ctx.notes` collects the notes while a
 * statement folds; the renderer takes them when it prints the line. */
// A slot of opcode 0x82, as `local` and `arg` spell it: below 0x30 VarNN,
// 0x30 to 0x3F ArgNN (TInterp::DoInterpAt stores the second kind in the
// arguments at the slot less 0x30). Null for anything else.
function dvmSlotName(bare) {
  const slot = parseInt(bare, 16);
  if (!Number.isFinite(slot) || slot < 0 || slot >= 0x40) return null;
  return (slot < 0x30 ? 'Var' : 'Arg') + (slot < 0x30 ? slot : slot - 0x30).toString(16).toUpperCase().padStart(2, '0');
}
function dvmFoldNote(ctx, text) {
  if (ctx && ctx.notes && text && ctx.notes.indexOf(text) < 0) ctx.notes.push(text);
}
// Which argument of a sound call is the sound (SOUND_CALLS in the page says
// the same, and why ShootEffect's is its eighth).
const DVM_SOUND_ARG = { PlaySound: 0, UnknownD4: 0, PlayAmbientSound: 0, ShootEffect: 7 };
// Page readers of the file, called only where the page has them and the
// archive being rendered is the one they read.
function dvmFoldPage(ctx, f) {
  try { return (typeof ARCHIVE !== 'undefined' && ARCHIVE && ctx && ctx.arc === ARCHIVE) ? f() : null; }
  catch (e) { quiet(e); return null; }
}
function dvmFoldPropName(ctx, pt) {
  return dvmFoldPage(ctx, () => { const b = getPropTileList()[pt]; return b !== undefined && b !== null ? terrainNameFor(b) : null; });
}
function dvmFoldCallNotes(name, vals, ctx) {
  const si = DVM_SOUND_ARG[name];
  if (si !== undefined && /^\d+$/.test(vals[si] || '')) {
    const v = +vals[si], rid = 0x9100 + v;
    let sym = null;
    try { sym = resourceSymbol(rid); } catch (e) { quiet(e); }
    dvmFoldNote(ctx, 'sound ' + v + (sym ? ': ' + sym : '') + ' (0x' + rid.toString(16).toUpperCase() + ')');
  }
  if ((name === 'AddQuest' || name === 'CompleteQuest') && /^\d+$/.test(vals[0] || '') && ctx && ctx.arc) {
    const ref = name === 'AddQuest' && /^\((0x[0-9A-F]+)\[(\d+)\] \+ (\d+)\)$/i.exec(vals[1] || '');
    const resid = ref ? parseInt(ref[1], 16) : dvmTodoTextResid(ctx.arc);
    const line = ref ? +ref[2] + +ref[3] : +vals[0];
    const lines = resid !== null ? dvmFoldTextArray(ctx.arc, resid) : null;
    const text = lines && lines.get(line);
    if (text) dvmFoldNote(ctx, 'To Do ' + vals[0] + ': "' + text + '"');
  }
  if (name === 'ChangeZone' && /^\d+$/.test(vals[1] || '')) {
    const z = dvmFoldPage(ctx, () => loadZoneports()[+vals[1]]);
    const zn = z && z.map ? dvmFoldPage(ctx, () => zoneNameFor(z.map)) : null;
    if (zn) dvmFoldNote(ctx, 'zoneport ' + vals[1] + ': ' + zn);
  }
  const pti = name === 'Create' ? 1 : name === 'New' ? 4 : -1;
  if (pti >= 0 && /^\d+$/.test(vals[pti] || '')) {
    const v = +vals[pti], pt = name === 'Create' ? v & 0x3FF : v;
    const nm = pt > 0 && pt <= 0x3FF ? dvmFoldPropName(ctx, pt) : null;
    if (nm) dvmFoldNote(ctx, 'prop type ' + pt + (name === 'Create' && v >> 10 ? ', aspect ' + (v >> 10) : '') + ': ' + nm);
  }
}
// A text array's entries by their own index field, which is not their
// position beyond entry 37 of 0x021A (todoRules says the same).
function dvmFoldTextArray(arc, resid) {
  return derivedTable(arc, 'foldText' + resid, () => {
    try {
      const d = smartDecrypt(getResourceBytes(arc, resid), resid);
      return new Map(parseDelverTextArray(d.data).map(x => [x.index, x.str]));
    } catch (e) { quiet(e); return null; }
  });
}
/* The array CompleteQuest's slot is read in: whichever one the archive's own
   AddQuest calls point into. Found once per archive by walking every function
   for an AddQuest, which is the only place the file says it; a CompleteQuest
   carries no reference of its own. */
function dvmTodoTextResid(arc) {
  return derivedTable(arc, 'foldTodoResid', () => {
    for (let subn = 0; subn < 256; subn++) {
      const e = arc.index[subn];
      if (!e || !e[0]) continue;
      for (let k = 0; k < 256; k++) {
        const resid = (subn + 1) * 0x100 + k;
        let b;
        try { const raw = getResourceBytes(arc, resid); if (!raw || !raw.length) continue; b = smartDecrypt(raw, resid).data; }
        catch (err) { continue; }
        let objs; try { objs = dvmExtents(b, resid); } catch (err) { continue; }
        for (const [st, en, kind] of objs) {
          if (kind !== 'function') continue;
          let r; try { r = dvmDisassemble(b.subarray(st, Math.min(en, b.length)), 3); } catch (err) { continue; }
          for (let i = 0; i + 2 < r.ops.length; i++) {
            if (r.ops[i][2] !== 'sys AddQuest') continue;
            const m = /(0x[0-9A-F]+)\[\d+\]/i.exec(String(r.ops[i + 2][3]));
            if (m) return parseInt(m[1], 16);
          }
        }
      }
    }
    return null;
  });
}

/* A frame whose values are an argument list rather than one expression. */
function dvmArgList(nodes, ctx) {
  return dvmReduceFrame(nodes || [], ctx).join(', ');
}

/* What a resource is called in the folded listings, at a call to it and at the
   head of the function that is the whole of it. The raw listing's order --
   the archive's own symbol table, then delvmod's short list -- and then the
   AI's tests and actions by the application's own string lists (aiHookName),
   when the application is open, which the raw listing does not print. Not
   DVM_SCRIPT_NAMES: those helper names were written by a session reading
   the bytecode, not read out of a file (dvmFoldNote says why that matters). With none, the id as a call site spells it, `0x904`, so the
   head of 0x904's own listing reads `function 0x904(...)`, as its callers do.
   It was `function obj_0000(...)` until 22 September 2026: the object at
   offset 0 of a resource that is one function, named by nothing because the
   dispatch table that names the others is not there. */
function dvmFoldResourceName(rid) {
  let n = null;
  try {
    n = (typeof resourceSymbol === 'function' && resourceSymbol(rid)) ||
        (DVM_SYM.resource && DVM_SYM.resource[String(rid)]) ||
        (typeof aiHookName === 'function' && aiHookName(rid));
  } catch (e) { quiet(e); }
  // The AI's list writes each name with the argument kinds the rule
  // language takes, "UsingMeleeWeapon(@)"; a listing calls it with the
  // script's own arguments, so the name is printed without them.
  if (n) n = String(n).replace(/\(.*\)$/, '');
  return n || ('0x' + rid.toString(16).toUpperCase().padStart(2, '0'));
}

/* ---- statements -----------------------------------------------------------
 * The top level of a function body, and of any frame that holds statements
 * rather than one value. A statement keeps its offset, because the offset is
 * the join to Edit Bytes: js/page-rules.js maps a listed operand to its place
 * in the plaintext and the raw view shows it.
 */
function dvmFoldStatement(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const g = n.groups.map(f => dvmFoldFrame(f, ctx));
  const target = () => {
    const c = n.close.find(c => c.mn === 'then');
    const m = c && /->\s*(0x[0-9A-F]+)/i.exec(c.arg);
    return m ? m[1] : null;
  };
  switch (n.mn) {
    case 'return': return 'return' + (g[0] ? ' ' + g[0] : '');
    case 'print': return 'print(' + (g[0] || '') + ')';
    case 'if': { const t = target(); return 'if (' + g[0] + ')' + (t ? ' goto ' + ctx.label(t) : ''); }
    case 'if_not': { const t = target(); return 'if (!(' + g[0] + '))' + (t ? ' goto ' + ctx.label(t) : ''); }
    case 'branch': return 'goto ' + ctx.label(bare);
    case 'set_local': {
      /* The operand is a slot in the same numbering the `local` and `arg` ops
         use: below 0x30 a local, 0x30 to 0x3F an argument. Read in the
         interpreter on 23 September 2026: TInterp::DoInterpAt's case for
         opcode 0x82 evaluates the expression and, for an operand below 48,
         stores it in the frame's locals at that index, and for 48 to 63 in
         its arguments at the operand less 48 (the two arrays `local` and
         `arg` read). So `set_local 0x31` is `Arg01 = ...`. The raw listing
         keeps delvmod's spelling. */
      const lhs = dvmSlotName(bare);
      return (lhs || 'set_local ' + bare) + ' = ' + (g[0] || '');
    }
    case 'set_global': return dvmPlainName(bare) + ' = ' + (g[0] || '');
    case 'set_field': return (g[0] || '') + '.' + bare + ' = ' + (g[1] || '');
    case 'set_index': return (g[0] || '') + '[' + (g[1] || '') + '] = ' + (g[2] || '');
    case 'write_near_word': return 'word@' + bare + ' = ' + (g[0] || '');
    case 'write_far_word': return 'word@' + bare + ' = ' + (g[0] || '');
    case 'switch': {
      const c = n.close.find(c => c.mn === 'cases');
      const cases = c ? (c.arg.match(/0x[0-9A-F]+/gi) || []) : [];
      return 'switch (' + (g[0] || '') + ') -> ' + cases.map(t => ctx.label(t)).join(', ');
    }
    case 'exit': return 'exit';
    case 'string(implicit)': return 'print(' + dvmBareOperand(n.arg) + ')';
    case 'conversation_prompt': return 'ask ' + dvmBareOperand(n.arg);
    case 'conversation_response': return 'answer ' + dvmBareOperand(n.arg);
    default:
      if (n.expect > 0) return dvmFoldCall(n, ctx);
      return dvmFoldValue(n, ctx);
  }
}

/* ---- a whole resource ----------------------------------------------------- */

/* Which offsets anything jumps to, so a label can be put there. The raw view
   prints `then -> 0x0094` and leaves the reader to find 0x0094; a label at the
   destination is what makes a jump followable, and it is what delvmod's ddasm
   does. */
function dvmBranchTargets(ops) {
  const out = new Set();
  for (const [at, delta, mn, arg] of ops) {
    if (mn === 'then' || mn === 'branch' || mn === 'cases')
      for (const m of String(arg).matchAll(/0x[0-9A-F]+/gi)) out.add(parseInt(m[0], 16));
  }
  return out;
}

function dvmFoldRender(arc, b, resid) {
  dvmContextResid = (typeof resid === 'number') ? resid : null;
  const objs = dvmExtents(b, resid);
  const slots = dvmSlotNames(b, resid);
  const lines = [];
  const hex4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  const str = seg => decodeMacRoman(seg.filter(c => c));
  let folded = 0, partial = 0;
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    const named = slots.get(st) || (st === 0 && kind === 'function' ? dvmFoldResourceName(resid) : null);
    const name = named || ('obj_' + hex4(st));
    if (kind === 'function') {
      const body = seg.subarray(3);
      const ph = dvmProseHead(body);
      if (ph && ph.bare) { lines.push('', name + ' = ' + JSON.stringify(str(ph.head))); folded++; continue; }
      const r = dvmDisassembleFolded(seg, st);
      /* A branch target is an offset into the RESOURCE, and an op's `at` is an
         offset into the function -- 0x0061 + 0x2F is the 0x0090 that `if_not`
         jumps to. The raw listing prints the relative one and leaves the reader
         to do that sum, which is why no label could be put anywhere. Everything
         below is absolute: the gutter, the labels and the object names then all
         mean the same thing, and it is the thing Edit Bytes shows. */
      const targets = dvmBranchTargets(r.ops);
      const ctx = { label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0'), arc, notes: [] };
      const args = [];
      for (let i = 0; i < seg[1]; i++) args.push('Arg' + i.toString(16).padStart(2, '0').toUpperCase());
      const locals = seg[2] ? '   // ' + seg[2] + ' local' + (seg[2] === 1 ? '' : 's') : '';
      lines.push('', 'function ' + name + '(' + args.join(', ') + ') {' + locals);
      const forest = dvmForest(r.ops);
      let over = 0;
      for (const n of forest) {
        const abs = st + n.at;
        if (targets.has(abs)) lines.push('  ' + ctx.label('0x' + hex4(abs)) + ':');
        ctx.notes = [];
        const text = dvmFoldStatement(n, ctx);
        if (/\/\*under\*\//.test(text)) over++;
        lines.push('    ' + hex4(abs) + '  ' + text + (ctx.notes.length ? '   // ' + ctx.notes.join('; ') : ''));
      }
      lines.push('}');
      if (r.bad) { lines.push('// ^ decoder desynced (' + r.bad + ' unrecognized bytes) - unreliable'); partial++; }
      else if (over) { lines.push('// ^ ' + over + ' statement(s) the fold could not balance; read them in the raw listing'); partial++; }
      else folded++;
    } else if (kind === 'array') {
      const v = dvmArrayContents(seg);
      lines.push('', name + ' = ' + (v ? '[' + v.join(', ') + ']' : '<array>'));
      folded++;
    } else if (kind === 'table') { lines.push('', name + ' = <table>'); folded++; }
    else if (dvmIsProse(seg) || dvmIsIdentifier(seg)) { lines.push('', name + ' = ' + JSON.stringify(str(seg))); folded++; }
    else { lines.push('', name + ' = <' + seg.length + ' bytes>'); partial++; }
  }
  const cls = dvmClassName(resid);
  const sym = resourceSymbol(resid);
  if (sym) lines.unshift('// name: ' + sym);
  lines.unshift('// ' + objs.length + ' objects: ' + folded + ' folded, ' + partial + ' not');
  if (cls) lines.unshift('// class: ' + cls + ' (resource 0x' + resid.toString(16).toUpperCase() + ')');
  return lines.join('\n');
}

/* ---- two versions of a script, line by line ----------------------------------
   The patches section and the comparison said which scripts a patch changes
   and by how many bytes, and nothing of what: the maintainer asked for the
   exact difference (27 September 2026), and nearly all of what the fix
   patches change is scripts, the dialogue among them.

   The two sides are read in the folded view, one statement a line, rather
   than the structured one: a conversation there is a loop a keyword deep,
   sixteen levels of indentation on a phone, where folded it is flat. A line
   is compared with its offsets masked -- the gutter, the labels, an answer's
   target, an unnamed object's name -- because one inserted instruction moves
   every offset after it, and unmasked every later line would differ. What is
   shown is each side's own line without its gutter.

   diffSequences is Myers's difference over two arrays, the common head and
   tail taken off first; it gives up past MAX_DIFF_EDITS and reports the rest
   as all removed and all added, which a rewritten script is anyway. Returns
   [op, i, j]: '=' a[i] is b[j], '-' a[i] only, '+' b[j] only. */
const MAX_DIFF_EDITS = 2000;
function diffSequences(a, b) {
  let s = 0;
  while (s < a.length && s < b.length && a[s] === b[s]) s++;
  let ea = a.length, eb = b.length;
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) { ea--; eb--; }
  const N = ea - s, M = eb - s, out = [];
  for (let k = 0; k < s; k++) out.push(['=', k, k]);
  const mid = [];
  // trace[d] holds v[k] for k in -(d+1)..d+1 as it stood before round d.
  const trace = [];
  let v = new Map([[1, 0]]), D = -1;
  if (N && M) {
    search: for (let d = 0; d <= Math.min(N + M, MAX_DIFF_EDITS); d++) {
      const snap = new Int32Array(2 * d + 3);
      for (let k = -(d + 1); k <= d + 1; k++) snap[k + d + 1] = v.has(k) ? v.get(k) : -1;
      trace.push(snap);
      for (let k = -d; k <= d; k += 2) {
        let x = (k === -d || (k !== d && v.get(k - 1) < v.get(k + 1))) ? v.get(k + 1) : v.get(k - 1) + 1;
        let y = x - k;
        while (x < N && y < M && a[s + x] === b[s + y]) { x++; y++; }
        v.set(k, x);
        if (x >= N && y >= M) { D = d; break search; }
      }
    }
  }
  if (!N) for (let j = 0; j < M; j++) mid.push(['+', -1, s + j]);
  else if (!M) for (let i = 0; i < N; i++) mid.push(['-', s + i, -1]);
  else if (D < 0) { for (let i = 0; i < N; i++) mid.push(['-', s + i, -1]); for (let j = 0; j < M; j++) mid.push(['+', -1, s + j]); }
  else {
    let x = N, y = M;
    for (let d = D; d > 0; d--) {
      const t = trace[d], at = k => t[k + d + 1], k = x - y;
      const down = k === -d || (k !== d && at(k - 1) < at(k + 1));
      const pk = down ? k + 1 : k - 1, px = at(pk), py = px - pk;
      while (x > px && y > py) { x--; y--; mid.push(['=', s + x, s + y]); }
      if (down) { y--; mid.push(['+', -1, s + y]); } else { x--; mid.push(['-', s + x, -1]); }
    }
    while (x > 0 && y > 0) { x--; y--; mid.push(['=', s + x, s + y]); }
    mid.reverse();
  }
  out.push(...mid);
  for (let k = 0; k < a.length - ea; k++) out.push(['=', ea + k, eb + k]);
  return out;
}

/* The script diff itself: the two folded renders compared a line at a time,
   in hunks with `context` unchanged lines round each change. Where a hunk
   takes out and puts in lines, they are paired in order and compared a word
   at a time, so a changed word in a long line of dialogue can be picked out
   (`parts`, [text, changed]). Either side may be null, for a script only one
   file has.

   The listing does not show everything a script holds: an array of names
   is `<array>` there, and a block of data inside a function is `<data <N
   bytes>>`. The text patches' first run had two changes with no line to
   show them, a character's name in gCharNames and "obolio" in a notice's
   data. So the text in those places is read as well -- every run of
   printable characters that reads as words, in the objects that are not
   functions and the data blocks of those that are -- and compared the same
   way, as `text`. The whole resource's text was tried first and gave
   hundreds of false changes: a string beside code carries the code's
   offsets as stray characters, and they move when the code does. */
function dvmDiffHunks(A, B, keys, context, tokenKey) {
  const C = context === undefined ? 2 : context;
  const ops = diffSequences(keys ? A.map(keys) : A, keys ? B.map(keys) : B);
  const words = s => s.match(/[A-Za-z0-9_']+|\s+|[^A-Za-z0-9_'\s]/g) || [];
  const pairParts = (x, y) => {
    const wx = words(x), wy = words(y), px = [], py = [], tk = tokenKey || (t => t);
    const add = (list, text, ch) => { const last = list[list.length - 1]; if (last && last[1] === ch) last[0] += text; else list.push([text, ch]); };
    for (const [op, i, j] of diffSequences(wx.map(tk), wy.map(tk))) {
      if (op === '=') { add(px, wx[i], false); add(py, wy[j], false); }
      else if (op === '-') add(px, wx[i], true);
      else add(py, wy[j], true);
    }
    return [px, py];
  };
  const hunks = [];
  let removed = 0, added = 0;
  const changedAt = ops.map(o => o[0] !== '=');
  for (let p = 0; p < ops.length;) {
    if (!changedAt[p]) { p++; continue; }
    const from = Math.max(0, p - C);
    let end = p;
    // run on while the next change is within 2C unchanged lines
    for (let q = p; q < ops.length; q++) { if (changedAt[q]) end = q; else if (q - end > 2 * C) break; }
    const to = Math.min(ops.length, end + C + 1), lines = [];
    for (let q = from; q < to;) {
      if (!changedAt[q]) { lines.push({ k: '=', text: B[ops[q][2]] }); q++; continue; }
      const outs = [], ins = [];
      while (q < to && changedAt[q]) { if (ops[q][0] === '-') outs.push(A[ops[q][1]]); else ins.push(B[ops[q][2]]); q++; }
      removed += outs.length; added += ins.length;
      const n = Math.min(outs.length, ins.length), po = [], pi = [];
      for (let k = 0; k < n; k++) { const [x, y] = pairParts(outs[k], ins[k]); po.push(x); pi.push(y); }
      outs.forEach((t, k) => lines.push({ k: '-', text: t, parts: po[k] || null }));
      ins.forEach((t, k) => lines.push({ k: '+', text: t, parts: pi[k] || null }));
    }
    hunks.push(lines);
    p = to;
  }
  return { hunks, removed, added };
}
function dvmScriptText(d, resid) {
  const out = [];
  if (!d) return out;
  const words = bytes => {
    let run = [];
    const flush = () => {
      if (run.length >= 4) {
        // A table of strings keeps a byte of offset or length before each,
        // and it is printable as often as not ("vMaster Tros", "™Librarian
        // Selinus", "7Master Pheres"); it moves when an earlier entry grows.
        // One such first character is dropped: anything outside ASCII but
        // the typographic quotes and dashes, a closing quote, or a letter,
        // digit or mark before a capitalised word. Not an @, which marks a
        // keyword in the game's text, nor a quote or bracket; the
        // comparison looks past those (dvmScriptDiff).
        const t = decodeMacRoman(Uint8Array.from(run)).replace(/^(?:[^\x20-\x7E\u201C\u201D\u2018\u2019\u2026\u2013\u2014]|[\u201D\u2019](?=[A-Z])|[^\s"'\u201C\u2018(@](?=[A-Z][a-z]))/, '');
        const letters = (t.match(/[A-Za-z ]/g) || []).length;
        if (/[A-Za-z]{3}/.test(t) && letters >= t.length * 0.6) out.push(t);
      }
      run = [];
    };
    for (const c of bytes) { if (c >= 0x20 && c !== 0x7F) run.push(c); else flush(); }
    flush();
  };
  for (const [st, en, kind] of dvmExtents(d, resid)) {
    const seg = d.subarray(st, Math.min(en, d.length));
    if (!seg.length) continue;
    if (kind !== 'function') { if (!(dvmIsProse(seg) || dvmIsIdentifier(seg))) words(seg); continue; }
    for (const op of dvmDisassemble(seg, 3).ops) {
      if (op[2] !== 'data') continue;
      const at = op[0] + 1, sz = at + 2 <= seg.length ? u16be(seg, at) : 0;
      words(seg.subarray(at + 2, Math.min(seg.length, at + 2 + sz)));
    }
  }
  return out;
}
function dvmScriptDiff(arc, resid, aData, bData, context) {
  const read = d => d ? dvmFoldRender(arc, d, resid).split('\n') : [];
  const shown = l => l.replace(/^\s{4}[0-9A-F]{4}  /, '').replace(/^\s+/, '');
  const A = read(aData).map(shown), B = read(bData).map(shown);
  const key = l => l.replace(/\bL[0-9A-F]{4}\b/g, 'L').replace(/-> 0x[0-9A-F]{4}\b/g, '->').replace(/\bobj_[0-9A-F]{4}\b/g, 'obj');
  // Within a changed line a label or a target is not a change either.
  const code = dvmDiffHunks(A, B, key, context, t => /^(?:L|0x)[0-9A-F]{4}$/.test(t) ? t[0] : t);
  // The comparison looks past any one mark before a capital, a leading @
  // or quote or bracket that is shown but may be a table's offset byte.
  const tx = dvmDiffHunks(dvmScriptText(aData, resid), dvmScriptText(bData, resid), t => t.replace(/^[^A-Za-z0-9](?=["'\u201C]?[A-Z])/, ''), context);
  return { hunks: code.hunks, removed: code.removed, added: code.added,
           text: tx.hunks, textRemoved: tx.removed, textAdded: tx.added,
           aLines: A.length, bLines: B.length };
}

/* ---- the round trip ------------------------------------------------------
 * Re-emit the flat op sequence a tree came from. utilities/fold_check.mjs
 * compares this with dvmDisassemble's own output for every function in the
 * archive: equal means the tree lost nothing and invented nothing, which is
 * the half of the proof that the frame-balance count does not cover.
 */
function dvmExpandForest(forest) {
  const out = [];
  const walk = nodes => {
    for (const n of nodes) {
      out.push([n.at, n.expect ? 1 : 0, n.mn, n.arg]);
      for (let i = 0; i < n.groups.length; i++) {
        walk(n.groups[i]);
        const c = n.close[i];
        if (c) out.push([c.at, -1, c.mn, c.arg]);
      }
    }
  };
  walk(forest);
  return out;
}

/* ===========================================================================
 * Structure recovery: the jumps as blocks.
 * ===========================================================================
 *
 * The folded view above leaves control flow exactly as the bytes have it --
 * `if (!(C)) goto L0094` and a label at 0x0094 -- because every line of it is a
 * local reorganisation of ops that are there, and three assertions in
 * utilities/fold_check.mjs say so. This half is different in kind, and the
 * difference is the whole reason it is separate:
 *
 *   A MISREAD JUMP RENDERS A WRONG PROGRAM THAT LOOKS RIGHT.
 *
 * Nothing in the fold's assertions catches that. Every statement would still be
 * individually correct; only their nesting would lie, and a nesting that lies is
 * worse than a goto that does not, because a reader believes it.
 *
 * So the recovery is built around two rules.
 *
 * FIRST, IT REFUSES RATHER THAN GUESSES. Each pattern below is matched only
 * when the region it would build is closed -- nothing outside it jumps into its
 * middle, and nothing inside it leaves except to the one place control is meant
 * to continue. A jump that fits no pattern stays a `goto` with its label, which
 * is the honest rendering and is what the folded view already gives. A function
 * can come out wholly structured, partly, or not at all, and the header line
 * says which.
 *
 * SECOND, THE CONTROL-FLOW GRAPH HAS TO SURVIVE IT. Every statement has
 * successors that the flat listing fixes: a conditional goes to its target and
 * to the statement after it, a `branch` only to its target, a `return` nowhere.
 * Re-derive that edge set from the NESTING -- an `if (C) { A }` means the
 * condition reaches the first statement of A and also the statement after the
 * block, the last statement of A reaches the statement after the block, and a
 * `while` sends its body's end back to the condition -- and the two sets must be
 * identical. Equal edge sets mean the recovery moved the braces and nothing
 * else. `utilities/structure_check.mjs` does that for every function in the
 * archive and has a control that swaps a branch target to prove it can fail.
 *
 * That is the analogue of the fold's re-expansion, one level up, and it is the
 * only reason this half is shippable at all.
 */

/* ---- text split where a jump lands in it ------------------------------------
 * The disassembler reads direct text as delvmod does -- any byte below 0x80
 * on an empty expectation stack, until the first byte that is not -- and
 * delv_dasm_check.mjs holds it to that. But the compiler shares the tails of
 * strings: 0xE91 prints "You don't have enough money." on one path and
 * `"` + name + " doesn't have enough money." on the other, and both end by
 * printing `"*`, so the first path's `branch` lands two bytes from the end
 * of the second's text run. A label inside a run has no line, the goto
 * that names it stays a goto, and the block round it cannot close: 117
 * gotos on 24 September 2026, the largest class left once jumps to a
 * return were folded. So the fold tier -- the folded, structured and Read
 * views and their checks -- splits a text run at every jump target inside
 * it, into two runs of the same bytes, which is exact: direct text is
 * printed byte by byte and a run's boundary means nothing to the machine.
 * The raw listing keeps delvmod's one run, since that is what the oracle
 * reads. `segStart` is the function's offset in the resource, which is
 * what the targets count from.
 */
function dvmSplitTextAtTargets(ops, segStart) {
  const targets = new Set();
  for (const o of ops) {
    const mn = o[2], arg = String(o[3] || '');
    let list = null;
    if (mn === 'then' || mn === 'conversation_response') { const m = /-> (0x[0-9A-F]+)\s*$/i.exec(arg); list = m ? [m[1]] : null; }
    else if (mn === 'branch') { const m = /^(0x[0-9A-F]+)/i.exec(dvmBareOperand(arg)); list = m ? [m[1]] : null; }
    else if (mn === 'cases') list = arg.match(/0x[0-9A-F]+/gi) || [];
    if (list) for (const t of list) targets.add(parseInt(t, 16) - segStart);
  }
  if (!targets.size) return ops;
  const out = [];
  for (const o of ops) {
    if (o[2] !== 'string(implicit)') { out.push(o); continue; }
    const text = JSON.parse(o[3]), at = o[0], end = at + text.length;
    const cuts = [...targets].filter(t => t > at && t < end).sort((a, b) => a - b);
    if (!cuts.length) { out.push(o); continue; }
    let from = at;
    for (const t of cuts.concat([end])) {
      out.push([from, o[1], 'string(implicit)', JSON.stringify(text.slice(from - at, t - at)), o[4], o[5]]);
      from = t;
    }
  }
  return out;
}
// The disassembly the fold tier works from: dvmDisassemble's, with the text
// runs a jump lands in split there.
function dvmDisassembleFolded(seg, st) {
  const r = dvmDisassemble(seg, 3);
  return { ops: dvmSplitTextAtTargets(r.ops, st), bad: r.bad };
}

/* The top-level statements of a function, in address order, each with what the
   listing says its successors are. `abs` is the offset in the resource, which
   is the coordinate the branch targets use. */
function dvmStatementList(forest, segStart) {
  const out = [];
  for (const n of forest) {
    const abs = segStart + n.at;
    const targetOf = mn => {
      const c = n.close.find(c => c.mn === mn);
      const m = c && /0x[0-9A-F]+/i.exec(c.arg);
      return m ? parseInt(m[0], 16) : null;
    };
    let kind = 'plain', targets = [];
    if (n.mn === 'if' || n.mn === 'if_not') {
      const t = targetOf('then');
      if (t === null) kind = 'plain'; else { kind = 'cond'; targets = [t]; }
    } else if (n.mn === 'branch') {
      const m = /0x[0-9A-F]+/i.exec(dvmBareOperand(n.arg));
      if (m) { kind = 'jump'; targets = [parseInt(m[0], 16)]; }
    } else if (n.mn === 'switch') {
      const c = n.close.find(c => c.mn === 'cases');
      const list = c ? (c.arg.match(/0x[0-9A-F]+/gi) || []) : [];
      kind = 'switch'; targets = list.map(t => parseInt(t, 16));
    } else if (n.mn === 'return' || n.mn === 'exit') {
      kind = 'end';
    }
    out.push({ abs, node: n, kind, targets, negated: n.mn === 'if' });
  }
  return out;
}

/* The edge set the flat listing fixes. A `cond` and a `switch` fall through as
   well as branching; a `jump` does not; an `end` goes nowhere. An edge off the
   end of the function is dropped and counted, since there is nothing to point
   at -- compiler output does not do it, and a function that does is left
   unstructured rather than explained. */
function dvmFlatEdges(stmts) {
  const edges = new Set();
  let offEnd = 0;
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const next = (i + 1 < stmts.length) ? stmts[i + 1].abs : null;
    for (const t of s.targets) edges.add(s.abs + '>' + t);
    if (s.kind === 'end' || s.kind === 'jump') continue;
    if (next === null) { offEnd++; continue; }
    edges.add(s.abs + '>' + next);
  }
  return { edges, offEnd };
}

/* Is [lo, hi) a region a block can be built from? Two conditions, and refusing
 * when either fails is the whole of what keeps this half honest:
 *
 *   nothing outside the range jumps into its MIDDLE -- an entry past `lo` means
 *   the range is not a block, it is part of something larger, and
 *
 *   nothing inside leaves except to one of `allowed`, which is the place control
 *   is meant to continue -- a jump out to anywhere else means the same thing.
 *
 * A fallthrough into the middle is impossible, the statements being in address
 * order. This is a top-level function rather than a closure inside the recovery
 * so that utilities/structure_check.mjs can replace it with one that says yes to
 * everything: a recovery that cannot be caught claiming a region it has no right
 * to is not one anybody should trust.
 */
function dvmRegionClosed(stmts, index, lo, hi, allowed, sources) {
  if (hi <= lo) return false;
  /* `sources[j]` is every statement index that jumps to j, built once per
     function. Without it this walked the whole function for every candidate
     region, and the recovery did not finish on the archive at all. */
  for (let j = lo + 1; j < hi; j++) {
    const from = sources[j];
    if (!from) continue;
    for (const k of from) if (k < lo || k >= hi) return false;
  }
  const ok = new Set(allowed);
  for (let k = lo; k < hi; k++) {
    for (const t of stmts[k].targets) {
      if (ok.has(t)) continue;
      const j = index.get(t);
      if (j === undefined || j < lo || j >= hi) return false;
    }
  }
  return true;
}

/* ---- two tests, one condition --------------------------------------------
 * Two conditionals in a row that jump to the same place are one condition:
 *
 *     if_not A -> L0094               if (A && B) {
 *     if_not B -> L0094      -->          ...
 *     ...                             }
 *   L0094:
 *
 * which is what a compiler emits for `if (A && B)`, and also for
 * `if (A) { if (B) { ... } }`. The two are the same program, so the merged
 * spelling costs nothing when the nesting was already recoverable -- and where
 * it was not, it is the only spelling that is: `if (A && B) { .. } else { .. }`
 * shares its else between both tests, which nested ifs cannot say, and a loop
 * whose test is two tests (`while (A && B)`) otherwise keeps its second test as
 * a goto out of its own body. Measured on 22 September 2026: 212 such pairs,
 * every one of them two `if_not`s.
 *
 * Merged only when nothing else jumps to the second test. If something did, the
 * second test would be a place of its own that control can reach without the
 * first, and one condition cannot be entered halfway. On the shipped archive no
 * pair fails that, so the guard is never exercised here and nothing here
 * demonstrates it working; it is kept because a hand-edited archive can do
 * what Ambrosia's compiler did not.
 *
 * A pair of `if`s (jump when true) would merge the same way into
 * `if (A || B) goto L`; the archive has none, and a mixed pair is left alone
 * rather than spelt with a negation inside a conjunction.
 *
 * THE SPELLING. The VM also has `and` and `or` opcodes (0x5C, 0x5D; 245 uses
 * in the archive). They are not the same thing: an opcode consumes two values
 * already on the stack, so both sides were evaluated, where the jump pair never
 * evaluates B when A is false. So `&&` and `||` are kept for this, which is
 * what a reader of C-like text takes them to mean, and the opcodes are spelt
 * `and` and `or` (DVM_INFIX). They were both `&&` until 22 September 2026, and
 * only the brackets told them apart.
 *
 * utilities/structure_check.mjs tests each merged condition against the flat
 * listing for every truth assignment of its parts, reading the text the
 * listing prints; the edge check sees the pair as one node.
 */
function dvmMergeConditions(stmts) {
  const jumpedTo = new Set();
  for (const s of stmts) for (const t of s.targets) jumpedTo.add(t);
  const list = [], merged = new Map();
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const parts = [s];
    while (s.kind === 'cond' && s.targets.length === 1 && i + 1 < stmts.length) {
      const b = stmts[i + 1];
      if (b.kind !== 'cond' || b.targets.length !== 1 || b.targets[0] !== s.targets[0] ||
          b.negated !== s.negated || jumpedTo.has(b.abs)) break;
      parts.push(b);
      i++;
    }
    if (parts.length === 1) { list.push(s); continue; }
    for (const p of parts.slice(1)) merged.set(p.abs, s.abs);
    list.push({ abs: s.abs, node: s.node, kind: 'cond', targets: [s.targets[0]],
                negated: s.negated, parts });
  }
  return { list, merged };
}

/* ---- a jump to a return is that return -------------------------------------
 * The largest class of goto the first pass leaves (24 September 2026, the
 * census in the notes: about three in ten of every goto left, nearly all in
 * the conversations) is a plain `branch` to the function's shared `return`
 * or `exit`, each answer ending by jumping to it; and the next largest is the
 * if-block whose then-branch ends in that jump, which the region test cannot
 * close because the block leaves for the exit rather than its continuation.
 * A jump to a return IS that return: nothing runs between the jump and the
 * statement it lands on, and a return has no successor, so the jump can be
 * printed as the return's own text (`exit`, `return 0`, `return Var00`) and
 * treated as an end. Folding it closes the blocks around it too.
 *
 * Folded only where the first pass left it as a goto, so every block the
 * first pass built stands as it was: an if-else's `goto Lend` is still
 * absorbed into its braces even when Lend is a return, and a jump a loop
 * would print as `break` is folded first and prints as the return, which
 * says where control goes more directly than `break` does. The fold is
 * this function so that utilities/structure_check.mjs can replace it with
 * one that folds a jump onto a statement that is not a return: the check
 * reads the target off the ops for every folded statement, and that
 * control must fail it. `index` is the merged list's; `stmts` is the merged
 * list, and the result is its indices that hold such a jump. A jump to a
 * jump folded on an earlier pass counts, since that one is an end now, and
 * the recovery names the return at the end of the chain.
 */
function dvmEndJumps(stmts, index, left) {
  const out = [];
  for (const i of left) {
    const s = stmts[i];
    if (s.kind !== 'jump' || s.targets.length !== 1) continue;
    const j = index.get(s.targets[0]);
    if (j !== undefined && stmts[j].kind === 'end') out.push(i);
  }
  return out;
}

/* ---- the recovery --------------------------------------------------------
 * A recursive reduction over the statement list. `build(lo, hi, follow)` turns
 * statements [lo, hi) into a list of nodes, given that control continues at
 * `follow` when the range runs out. Every pattern checks that the region it
 * would claim is closed before claiming it.
 *
 * It runs over the list with its paired tests merged (above), and says which
 * statements were folded into another's condition in `merged`, because the
 * flat control-flow graph the check compares against has them as nodes of
 * their own.
 */
function dvmRecoverStructure(flat) {
  const { list: stmts, merged } = dvmMergeConditions(flat);
  const index = new Map();
  for (let i = 0; i < stmts.length; i++) index.set(stmts[i].abs, i);
  let sources = [];
  const findSources = () => {
    sources = [];
    for (let i = 0; i < stmts.length; i++) {
      for (const t of stmts[i].targets) {
        const j = index.get(t);
        if (j === undefined) continue;
        (sources[j] || (sources[j] = [])).push(i);
      }
    }
  };
  findSources();
  let gotos = 0, structured = 0;
  const ended = new Map();
  /* The unconditional jumps the structure swallows: an if-else's `goto Lend` at
     the end of its then-branch, and a loop's `goto Lhead` at the end of its
     body. Each exists only to reach a place the braces now say, so it is not
     rendered -- and utilities/structure_check.mjs has to be told, because the
     control-flow graph is legitimately one node shorter for each of them. A
     jump with one outgoing edge can be contracted out of a graph without
     changing what reaches what, which is why absorbing it is safe and why the
     check contracts rather than excuses. */
  const absorbed = new Set();

  const closed = (lo, hi, allowed) => dvmRegionClosed(stmts, index, lo, hi, allowed, sources);
  /* A jump may only be absorbed if nothing else jumps TO it. The check found
     this: 0x1804's function at +0x2 has `goto 0x57B` at 0x40F, and 0x57B is
     itself the `goto` closing a loop. Absorbing 0x57B left 0x40F pointing at a
     label that no longer existed -- a dangling `goto L057B` for a reader, and an
     edge to a node that is not in the tree for the graph. Refusing to absorb it
     keeps the label, which is the same rule as everywhere else here: when the
     structure cannot account for something, leave it as the bytes have it. */
  const absorbable = i => !sources[i] || sources[i].length === 0;
  /* Since 25 September 2026 a jump to the goto a block absorbs is allowed
     from INSIDE the block: the dice game's inner if-else ends its then-branch
     by jumping to the outer if-else's closing goto, and a loop body may jump
     to its own closing goto, which is a `continue`. The absorbed goto exists
     only to reach the place the braces say, so a jump to it is a jump to
     that place, and `retarget` says so on the node (`goes`), which is what
     the renderers, the loop exits and the labels then read. A jump to it
     from outside the block is still refused: that would enter the block at
     its end. */
  const absorbableFrom = (k, lo) => !sources[k] || sources[k].every(j => j >= lo && j < k);
  const retarget = (list, from, to) => {
    for (const nd of list) {
      if (nd.kind === 'stmt' && nd.stmt.targets.length === 1 && nd.stmt.targets[0] === from) nd.goes = to;
      for (const k of ['then', 'els', 'body']) if (nd[k]) retarget(nd[k], from, to);
    }
  };

  /* `loops` is every place the enclosing loops may be left for or gone
     round from -- a `break` or a `continue` -- which a block inside them may
     leave for as well as for its own continuation (25 September 2026: `if
     (c) break` was refused as a block that leaves for a third place, and
     printed as `if (!c) goto L; break; L:`). utilities/structure_check.mjs
     allows the same exits in its region test, through dvmBlocksOf. */
  function build(lo, hi, follow, loops) {
    loops = loops || [];
    const out = [];
    let i = lo;
    while (i < hi) {
      const s = stmts[i];
      const after = (i + 1 < stmts.length) ? stmts[i + 1].abs : follow;

      if (s.kind === 'cond' && s.targets.length === 1) {
        const tIdx = index.get(s.targets[0]);
        if (tIdx !== undefined) {

          // while (C) { body }:  Lhead: if_not C -> Lafter / body / goto Lhead
          if (tIdx > i + 1 && tIdx <= hi) {
            const last = stmts[tIdx - 1];
            if (last.kind === 'jump' && last.targets[0] === s.abs &&
                absorbableFrom(tIdx - 1, i + 1) &&
                closed(i + 1, tIdx - 1, [s.abs, s.targets[0], last.abs].concat(loops))) {
              const body = build(i + 1, tIdx - 1, s.abs, loops.concat([s.abs, s.targets[0]]));
              retarget(body, last.abs, s.abs);
              out.push({ kind: 'while', cond: s, body });
              absorbed.add(last.abs);
              structured += 2;
              i = tIdx; continue;
            }
          }

          // if (C) { then } else { else }:
          //   if_not C -> Lelse / then / goto Lend / Lelse: else / Lend:
          if (tIdx > i + 1 && tIdx <= hi) {
            const beforeElse = stmts[tIdx - 1];
            if (beforeElse.kind === 'jump') {
              const endIdx = index.get(beforeElse.targets[0]);
              // A then-branch that is only the goto is an if-else with an
              // empty then, which is `if (!C) { else }`: the renderers print
              // the condition in its taken sense over the else alone.
              const lend = beforeElse.targets[0], emptyThen = tIdx - 1 === i + 1;
              // An else that is empty -- the then-branch's closing goto lands
              // on the statement the test jumps to -- is a plain if whose last
              // statement is a jump to its own continuation, absorbed like an
              // if-else's (0xEAB's "around two hundred paces").
              if (endIdx !== undefined && endIdx === tIdx && tIdx - 1 > i + 1 &&
                  absorbableFrom(tIdx - 1, i + 1) &&
                  closed(i + 1, tIdx - 1, [lend, beforeElse.abs].concat(loops))) {
                const then = build(i + 1, tIdx - 1, lend, loops);
                retarget(then, beforeElse.abs, lend);
                out.push({ kind: 'if', cond: s, then });
                absorbed.add(beforeElse.abs);
                structured += 2;
                i = endIdx; continue;
              }
              if (endIdx !== undefined && endIdx >= tIdx && endIdx <= hi &&
                  absorbableFrom(tIdx - 1, i + 1) &&
                  (emptyThen || closed(i + 1, tIdx - 1, [lend, beforeElse.abs].concat(loops))) &&
                  closed(tIdx, endIdx, [lend].concat(loops))) {
                const then = emptyThen ? [] : build(i + 1, tIdx - 1, lend, loops);
                retarget(then, beforeElse.abs, lend);
                out.push({ kind: 'ifelse', cond: s, then, els: build(tIdx, endIdx, lend, loops) });
                absorbed.add(beforeElse.abs);
                structured += 2;
                i = endIdx; continue;
              }
            }
          }

          // if (C) { }: a test that jumps to the very next statement, which
          // the compiler emits for a body that came to nothing (0x1428's
          // GetMessage). The test is still run, so it is printed as an if
          // with nothing in it rather than dropped.
          if (tIdx === i + 1) {
            out.push({ kind: 'if', cond: s, then: [] });
            structured++;
            i = tIdx; continue;
          }
          // if (C) { then }:  if_not C -> Lafter / then / Lafter:
          if (tIdx > i + 1 && tIdx <= hi && closed(i + 1, tIdx, [s.targets[0]].concat(loops))) {
            out.push({ kind: 'if', cond: s, then: build(i + 1, tIdx, s.targets[0], loops) });
            structured++;
            i = tIdx; continue;
          }

          // do { body } while (C):  Lhead: body / if C -> Lhead
          if (tIdx < i && tIdx >= lo && closed(tIdx, i, [s.abs, s.targets[0]])) {
            /* The body is what has just been emitted for [tIdx, i). Take those
               nodes back off `out` rather than building them again: building
               twice is what made this not finish, and it also risked counting
               the same block twice. */
            const body = dvmTakeBack(out, stmts[tIdx].abs);
            if (body) {
              out.push({ kind: 'dowhile', cond: s, body });
              structured++;
              i = i + 1; continue;
            }
          }
        }
      }

      // loop { body }:  Lhead: body / goto Lhead, with no condition at all
      if (s.kind === 'jump' && s.targets.length === 1) {
        const tIdx = index.get(s.targets[0]);
        if (tIdx !== undefined && tIdx <= i && tIdx >= lo &&
            absorbableFrom(i, tIdx) && closed(tIdx, i + 1, [s.abs])) {
          const body = dvmTakeBack(out, stmts[tIdx].abs);
          if (body) {
            retarget(body, s.abs, s.targets[0]);
            out.push({ kind: 'loop', body });
            absorbed.add(s.abs);
            structured++;
            i = i + 1; continue;
          }
        }
      }

      if (s.targets.length) gotos++;
      out.push({ kind: 'stmt', stmt: s });
      i++;
    }
    return out;
  }

  let tree = build(0, stmts.length, null);
  /* Then the jumps to a return the pass left as gotos, folded (dvmEndJumps),
     and the pass run again over the list with them as ends: the blocks it
     built stand, since their jumps were absorbed rather than left, and the
     regions those gotos kept open can close now. Once is enough in
     principle -- no fold makes a new jump -- and the loop is bounded in
     case. */
  for (let pass = 0; pass < 3; pass++) {
    const left = [];
    (function collect(list) {
      for (const n of list) {
        if (n.kind === 'stmt' && n.stmt.kind === 'jump') left.push(index.get(n.stmt.abs));
        for (const k of ['then', 'els', 'body']) if (n[k]) collect(n[k]);
      }
    })(tree);
    const fold = dvmEndJumps(stmts, index, left);
    if (!fold.length) break;
    for (const i of fold) {
      // A jump to a jump already folded lands on the return that one goes
      // to: `ended` names the return, and the check follows the chain.
      const s = stmts[i], t = stmts[index.get(s.targets[0])], end = t.ended || t.abs;
      ended.set(s.abs, end);
      stmts[i] = { abs: s.abs, node: t.node, kind: 'end', targets: [], negated: false, ended: end, jump: s };
    }
    findSources();
    gotos = 0; structured = 0; absorbed.clear();
    tree = build(0, stmts.length, null);
  }
  return { tree, gotos, structured, absorbed, merged, ended };
}

/* Take the trailing nodes of `out` that start at or after `abs`, in order, for a
 * backward jump to claim as its body. Returns null when they do not line up with
 * a node boundary -- which means the loop's head is in the middle of a block
 * already built, and a region that cannot be taken cleanly is one to refuse.
 */
function dvmTakeBack(out, abs) {
  let i = out.length;
  while (i > 0) {
    const f = dvmFirstAbs(out[i - 1]);
    if (f === null || f < abs) break;
    i--;
  }
  if (i >= out.length) return null;                 // nothing to take
  if (dvmFirstAbs(out[i]) !== abs) return null;     // the head is not a boundary
  return out.splice(i, out.length - i);
}

/* The first statement offset a node reaches, which is what an edge into it
   points at. */
function dvmFirstAbs(node) {
  switch (node.kind) {
    case 'stmt': return node.stmt.abs;
    case 'if': case 'ifelse': case 'while': return node.cond.abs;
    case 'dowhile': case 'loop':
      return node.body.length ? dvmFirstAbs(node.body[0]) : null;
    default: return null;
  }
}

/* The edge set the NESTING implies. Compared with dvmFlatEdges over every
   function by utilities/structure_check.mjs; equal means the braces moved and
   nothing else did. */
function dvmStructureEdges(tree, follow) {
  const edges = new Set();
  const walk = (list, cont) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      switch (n.kind) {
        case 'stmt': {
          const s = n.stmt;
          for (const t of s.targets) edges.add(s.abs + '>' + (n.goes !== undefined ? n.goes : t));
          if (s.kind !== 'end' && s.kind !== 'jump' && after !== null)
            edges.add(s.abs + '>' + after);
          break;
        }
        case 'if': {
          const head = n.then.length ? dvmFirstAbs(n.then[0]) : after;
          if (head !== null) edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.then, after);
          break;
        }
        case 'ifelse': {
          const a = n.then.length ? dvmFirstAbs(n.then[0]) : after;
          const b = n.els.length ? dvmFirstAbs(n.els[0]) : after;
          if (a !== null) edges.add(n.cond.abs + '>' + a);
          if (b !== null) edges.add(n.cond.abs + '>' + b);
          walk(n.then, after); walk(n.els, after);
          break;
        }
        case 'while': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : n.cond.abs;
          edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.body, n.cond.abs);
          break;
        }
        case 'dowhile': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : n.cond.abs;
          edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.body, n.cond.abs);
          break;
        }
        case 'loop': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : null;
          walk(n.body, head);
          break;
        }
      }
    }
  };
  walk(tree, follow);
  return edges;
}

/* A conditional's expression, in the polarity the reader needs.
 * `if_not C -> T` jumps when C is false, so the statements it falls through to
 * run when C is TRUE -- which is the `if (C)` a reader wants. `if C -> T` is the
 * other way round, and its fallthrough block is `if (!(C))`. A backward jump
 * wants the opposite of both, since a loop repeats when the jump IS taken.
 *
 * A merged condition (dvmMergeConditions) joins its parts: two `if_not`s fall
 * through when both hold, so `A && B`, and jump when that fails; two `if`s jump
 * when either holds, so `A || B`. `ctx.leaf`, when given, spells a part --
 * utilities/structure_check.mjs names each one `c0`, `c1`, ... and evaluates the
 * result, which is how the joined text is held to the flat listing.
 */
function dvmCondJoined(s, ctx) {
  const leaf = p => (ctx && ctx.leaf) ? ctx.leaf(p) : dvmFoldFrame(p.node.groups[0] || [], ctx);
  if (!s.parts) return leaf(s);
  return s.parts.map(p => dvmCondOperand(leaf(p))).join(s.negated ? ' || ' : ' && ');
}
function dvmCondFallthrough(s, ctx) {
  const e = dvmCondJoined(s, ctx);
  return s.negated ? '!(' + e + ')' : e;
}
function dvmCondTaken(s, ctx) {
  const e = dvmCondJoined(s, ctx);
  return s.negated ? e : '!(' + e + ')';
}
/* A part of a joined condition, bracketed when it has a space outside every
   bracket: `Arg01 has MeleeWeapon && Var00` reads either way, and
   `(Arg01 has MeleeWeapon) && Var00` reads one. A call, a comparison (the fold
   brackets every infix operator) and a negation are already one piece. */
function dvmCondOperand(e) {
  let depth = 0;
  for (const c of e) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ' ' && depth === 0) return '(' + e + ')';
  }
  return e;
}

/* ---- for-each, break and continue ------------------------------------------
 * The engine's iterators are one syscall called three ways, and the compiler
 * lays a loop over one out the same way every time:
 *
 *     Var01 = EquipmentIterator(&Var1, 0, Arg01)      the first item
 *     while (!(EquipmentIterator(&Var1, 1))) {         not yet finished
 *         ...
 *         Var01 = EquipmentIterator(&Var1, 2)          the next item
 *     }
 *
 * which is `for Var01 in EquipmentIterator(Arg01) { ... }`. 152 loops in the
 * archive, measured on 22 September 2026, and every one recovers as a `while`
 * with its start just before it and its step last in its body -- so this is a
 * way of printing a recovered `while`, not a new pattern for the recovery, and
 * the tree the structure check compares is the same tree either way.
 *
 * The state word (`&Var1`) is not printed on the `for` line: it is the
 * iterator's bookkeeping, it names the slot one early (the handoff's item on
 * iterator storage), and the raw and folded listings still show it. The
 * iterator keeps its name as the listing gives it rather than losing the
 * `Iterator`, so it can be searched for.
 *
 * The step moves to the loop's closing brace, which carries its offset in the
 * gutter so that a ring on the step lands on the brace rather than on the
 * statement before it; the `for` line carries the start's, and the test,
 * between the two, rings the `for` line.
 *
 * What makes it safe to print, beyond the three calls agreeing on the name,
 * the state word and the loop variable:
 *
 *   nothing jumps to the TEST except the loop's own back edge, which the
 *   recovery absorbed -- in a `for` there is nowhere to jump that runs the test
 *   without the step, and
 *
 *   every goto to the STEP can be printed without a label: a `continue` of
 *   this loop, or a `break` out of a loop nested in it whose exit is the step.
 *   Four jumps in three functions (0xEA3, 0xEB7, 0x1827) are the second kind,
 *   an inner loop left for the outer one's step, and read as the `break` they
 *   are. A goto to the step that is neither would leave the loop a `while`;
 *   the archive has none.
 *
 * `continue` and `break` are printed for every kind of loop, and only for a
 * jump whose innermost enclosing loop is the one it continues or leaves -- the
 * loop a reader would take it to mean. A jump from an inner loop to an outer
 * one's step or exit stays a goto. utilities/structure_check.mjs reads each
 * `break` and `continue` in the printed text, finds its loop by the braces as
 * a reader would, and holds the flat statement's target to that loop's step or
 * exit.
 */

/* The three calls, read off the ops rather than the text. Returns what the
   `for` line needs, or null. `prev` is the node before the `while`. */
function dvmForEach(prev, w, ctxIn) {
  // Its own notes, since this folds before anything is printed; the `for`
  // line takes them when it is.
  const ctx = Object.assign({}, ctxIn, { notes: [] });
  if (!prev || prev.kind !== 'stmt' || w.kind !== 'while' || !w.body.length) return null;
  const last = w.body[w.body.length - 1];
  if (last.kind !== 'stmt' || last.stmt.parts || w.cond.parts || w.cond.node.mn !== 'if') return null;
  // `Var = Name(args)` with Name an iterator syscall; the values its frame
  // folds to, which are exactly the arguments the folded listing prints.
  const call = n => {
    const g = n.groups[0] || [];
    if (g.length !== 1 || !/^sys \w*Iterator$/.test(g[0].mn) || g[0].expect !== 1) return null;
    return { name: g[0].mn.slice(4), vals: dvmReduceFrame(g[0].groups[0] || [], ctx) };
  };
  const setOf = n => (n.mn === 'set_local' && /^0x[0-9A-F]+$/i.test(dvmBareOperand(n.arg)) &&
                      parseInt(dvmBareOperand(n.arg), 16) < 0x30) ? dvmBareOperand(n.arg) : null;
  const slot = setOf(prev.stmt.node);
  if (slot === null || setOf(last.stmt.node) !== slot) return null;
  const start = call(prev.stmt.node), test = w.cond.node.groups[0] && w.cond.node.groups[0].length === 1 &&
    /^sys /.test(w.cond.node.groups[0][0].mn) ? { name: w.cond.node.groups[0][0].mn.slice(4),
    vals: dvmReduceFrame(w.cond.node.groups[0][0].groups[0] || [], ctx) } : null, step = call(last.stmt.node);
  if (!start || !test || !step || start.name !== test.name || step.name !== start.name) return null;
  const state = start.vals[0];
  if (!/^&Var\w+$/.test(state || '') || start.vals[1] !== '0') return null;
  if (test.vals.length !== 2 || test.vals[0] !== state || test.vals[1] !== '1') return null;
  if (step.vals.length !== 2 || step.vals[0] !== state || step.vals[1] !== '2') return null;
  return { start: prev.stmt, step: last.stmt, name: start.name, args: start.vals.slice(2), notes: ctx.notes,
           variable: 'Var' + parseInt(slot, 16).toString(16).toUpperCase().padStart(2, '0') };
}

/* Which `while`s print as `for`, and which jumps print as `break` or
   `continue`. `fors` maps a while node to its dvmForEach reading; `exits` maps a
   statement object to the word it prints instead of `goto`. */
function dvmLoopExits(tree, ctx) {
  const fors = new Map();
  let exits = new Map();
  const jumps = [];
  (function collect(list) {
    for (const n of list) {
      if (n.kind === 'stmt' && n.stmt.targets.length) jumps.push(n.stmt);
      for (const k of ['then', 'els', 'body']) if (n[k]) collect(n[k]);
    }
  })(tree);
  (function findFors(list) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.kind === 'while') {
        const f = dvmForEach(list[i - 1], n, ctx);
        if (f && !jumps.some(s => s.targets.includes(n.cond.abs))) fors.set(n, f);
      }
      for (const k of ['then', 'els', 'body']) if (n[k]) findFors(n[k]);
    }
  })(tree);
  // Where each loop continues and where it is left.
  const mark = (list, cont) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      let at = null;
      if (n.kind === 'while') at = { cont: fors.has(n) ? fors.get(n).step.abs : n.cond.abs, exit: n.cond.targets[0] };
      else if (n.kind === 'dowhile') at = { cont: n.cond.abs, exit: after };
      else if (n.kind === 'loop') at = { cont: n.body.length ? dvmFirstAbs(n.body[0]) : null, exit: after };
      if (at) {
        (function direct(l) {
          for (const x of l) {
            if (x.kind === 'stmt' && x.stmt.targets.length === 1 && (x.stmt.kind === 'jump' || x.stmt.kind === 'cond')) {
              const t = x.goes !== undefined ? x.goes : x.stmt.targets[0];
              if (t === at.exit && at.exit !== null) exits.set(x.stmt, 'break');
              else if (t === at.cont && at.cont !== null) exits.set(x.stmt, 'continue');
            }
            // A nested loop's statements belong to it, not to this one.
            if (x.kind === 'if' || x.kind === 'ifelse') { direct(x.then); if (x.els) direct(x.els); }
          }
        })(n.body);
      }
      const inner = n.kind === 'while' || n.kind === 'dowhile' ? n.cond.abs
                  : n.kind === 'loop' ? (n.body.length ? dvmFirstAbs(n.body[0]) : null) : after;
      for (const k of ['then', 'els', 'body']) if (n[k]) mark(n[k], inner);
    }
  };
  /* A `for` stands only if every jump to its step is printed as a `continue`
     of it or a `break` out of a loop nested in it that ends on the step; a
     jump left as a goto would need a label on the step, which has no line of
     its own. Dropping one `for` changes where that loop continues, so mark
     again until nothing is dropped. */
  for (;;) {
    exits = new Map();
    mark(tree, null);
    let dropped = false;
    for (const [w, f] of fors)
      if (jumps.some(s => s.targets.includes(f.step.abs) && !exits.has(s))) { fors.delete(w); dropped = true; }
    if (!dropped) break;
  }
  return { fors, exits };
}

/* Which offsets a goto still points at once the structure is recovered, so a
   label is printed only where one is needed. A jump printed as `break` or
   `continue` needs none. */
function dvmRemainingLabels(tree, exits) {
  const out = new Set();
  const walk = list => {
    for (const n of list) {
      if (n.kind === 'stmt' && !(exits && exits.has(n.stmt))) { for (const t of n.stmt.targets) out.add(n.goes !== undefined ? n.goes : t); }
      for (const k of ['then', 'els', 'body']) if (n[k]) walk(n[k]);
    }
  };
  walk(tree);
  return out;
}

/* The listing, from the recovered tree. `loops` is dvmLoopExits' reading.
 *
 * A label goes on the line of whatever node begins at its offset. Until
 * 22 September 2026 only a plain statement took one, so a goto into the head
 * of an `if` or a `while` named a label that was printed nowhere -- 94 of
 * them across the archive. (Another 116 aim inside a run of text, where no
 * statement starts, and have no line a label could go on; that is the
 * disassembler's question.) A `do` and a `loop` have no line of their own at
 * their first offset, so theirs is left to the first node of the body, which
 * does.
 *
 * Every closing brace sits under the keyword it closes. It sat two columns
 * left of it until the `for` loop's brace needed the step's offset in the
 * gutter, and a brace with a gutter cannot be further left than the text.
 */
function dvmRenderStructured(tree, ctx, labels, indent, lines, loops) {
  const pad = '    '.repeat(indent);
  const hex4 = v => v.toString(16).toUpperCase().padStart(4, '0');
  // A line takes the notes its text gathered as it folded (dvmFoldNote).
  const line = (at, text) => {
    const notes = ctx.notes ? ctx.notes.splice(0) : [];
    lines.push('    ' + (at === null ? '    ' : hex4(at)) + pad + '  ' + text + (notes.length ? '   // ' + notes.join('; ') : ''));
  };
  const label = at => { if (at !== null && labels.has(at)) lines.push('  ' + ctx.label('0x' + hex4(at)) + ':'); };
  const fors = loops ? loops.fors : new Map(), exits = loops ? loops.exits : new Map();
  const skip = new Set();
  for (const f of fors.values()) skip.add(f.start);
  for (const n of tree) {
    if (n.kind === 'stmt' && skip.has(n.stmt)) continue;
    const f = n.kind === 'while' ? fors.get(n) : null;
    if (f) label(f.start.abs);
    else if (n.kind !== 'dowhile' && n.kind !== 'loop') label(dvmFirstAbs(n));
    switch (n.kind) {
      case 'stmt': {
        const s = n.stmt, word = exits.get(s);
        const go = word || (s.targets.length === 1 ? 'goto ' + ctx.label('0x' + hex4(n.goes !== undefined ? n.goes : s.targets[0])) : null);
        if (s.kind === 'cond' && go && (word || s.parts)) line(s.abs, 'if (' + dvmCondTaken(s, ctx) + ') ' + go);
        else if (s.kind === 'jump' && (word || n.goes !== undefined)) line(s.abs, word || go);
        else line(s.abs, dvmFoldStatement(s.node, ctx));
        break;
      }
      case 'if':
        line(n.cond.abs, 'if (' + dvmCondFallthrough(n.cond, ctx) + ') {');
        dvmRenderStructured(n.then, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
      case 'ifelse':
        if (!n.then.length) {
          line(n.cond.abs, 'if (' + dvmCondTaken(n.cond, ctx) + ') {');
          dvmRenderStructured(n.els, ctx, labels, indent + 1, lines, loops);
          line(null, '}');
          break;
        }
        line(n.cond.abs, 'if (' + dvmCondFallthrough(n.cond, ctx) + ') {');
        dvmRenderStructured(n.then, ctx, labels, indent + 1, lines, loops);
        line(null, '} else {');
        dvmRenderStructured(n.els, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
      case 'while':
        if (f) {
          if (ctx.notes) for (const t of f.notes || []) dvmFoldNote(ctx, t);
          line(f.start.abs, 'for ' + f.variable + ' in ' + f.name + '(' + f.args.join(', ') + ') {');
          dvmRenderStructured(n.body.slice(0, -1), ctx, labels, indent + 1, lines, loops);
          line(f.step.abs, '}');
        } else {
          line(n.cond.abs, 'while (' + dvmCondFallthrough(n.cond, ctx) + ') {');
          dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
          line(null, '}');
        }
        break;
      case 'dowhile':
        line(null, 'do {');
        dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
        line(n.cond.abs, '} while (' + dvmCondTaken(n.cond, ctx) + ')');
        break;
      case 'loop':
        line(null, 'loop {');
        dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
    }
  }
}

/* The third state of the script view's toggle. Same decode and same fold as
   dvmFoldRender; the difference is that the jumps become blocks where a block
   can be proven, and stay gotos where one cannot. The header line says how many
   of each, because a reader is entitled to know whether they are looking at
   recovered structure or at the same gotos with extra indentation. */
function dvmStructureRender(arc, b, resid, out) {
  dvmContextResid = (typeof resid === 'number') ? resid : null;
  const objs = dvmExtents(b, resid);
  const slots = dvmSlotNames(b, resid);
  const lines = [];
  const hex4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  const str = seg => decodeMacRoman(seg.filter(c => c));
  let whole = 0, partial = 0, plain = 0;
  /* Where each `break` and `continue` goes, by the offset in its gutter, for a
     caller that makes them links (`out.exits`, read by listingJumps). The text
     cannot say it: the words carry no label, which is the point of them. A
     target that is a jump the braces absorbed is followed to where that jump
     goes, since the absorbed jump has no line of its own to ring. */
  const exitsAt = new Map();
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    const name = slots.get(st) || (st === 0 && kind === 'function' ? dvmFoldResourceName(resid) : null) || ('obj_' + hex4(st));
    if (kind !== 'function') {
      if (kind === 'array') {
        const v = dvmArrayContents(seg);
        lines.push('', name + ' = ' + (v ? '[' + v.join(', ') + ']' : '<array>'));
      } else if (kind === 'table') lines.push('', name + ' = <table>');
      else if (dvmIsProse(seg) || dvmIsIdentifier(seg)) lines.push('', name + ' = ' + JSON.stringify(str(seg)));
      else lines.push('', name + ' = <' + seg.length + ' bytes>');
      continue;
    }
    const ph = dvmProseHead(seg.subarray(3));
    if (ph && ph.bare) { lines.push('', name + ' = ' + JSON.stringify(str(ph.head))); continue; }
    const r = dvmDisassembleFolded(seg, st);
    const ctx = { label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0'), arc, notes: [] };
    const args = [];
    for (let i = 0; i < seg[1]; i++) args.push('Arg' + i.toString(16).padStart(2, '0').toUpperCase());
    const locals = seg[2] ? '   // ' + seg[2] + ' local' + (seg[2] === 1 ? '' : 's') : '';
    lines.push('', 'function ' + name + '(' + args.join(', ') + ') {' + locals);
    const forest = dvmForest(r.ops);
    const stmts = dvmStatementList(forest, st);
    const rec = dvmRecoverStructure(stmts);
    const loops = dvmLoopExits(rec.tree, ctx);
    const labels = dvmRemainingLabels(rec.tree, loops.exits);
    dvmRenderStructured(rec.tree, ctx, labels, 0, lines, loops);
    lines.push('}');
    const jumpOf = new Map(stmts.filter(s => rec.absorbed.has(s.abs)).map(s => [s.abs, s.targets[0]]));
    for (const s of loops.exits.keys()) {
      let t = s.targets[0];
      for (let k = 0; jumpOf.has(t) && k < 8; k++) t = jumpOf.get(t);
      exitsAt.set(s.abs, t);
    }
    // A jump printed as `break` or `continue` is structure, not a goto.
    const left = rec.gotos - loops.exits.size;
    if (r.bad) lines.push('// ^ decoder desynced (' + r.bad + ' unrecognized bytes) - unreliable');
    else if (!stmts.some(s => s.targets.length)) plain++;
    else if (left) { lines.push('// ^ ' + left + ' jump(s) fit no block and stay as goto'); partial++; }
    else whole++;
  }
  const cls = dvmClassName(resid);
  const sym = resourceSymbol(resid);
  if (sym) lines.unshift('// name: ' + sym);
  if (out) out.exits = exitsAt;
  lines.unshift('// ' + whole + ' function(s) fully structured, ' + partial +
                ' with jumps left over, ' + plain + ' with no jumps at all');
  if (cls) lines.unshift('// class: ' + cls + ' (resource 0x' + resid.toString(16).toUpperCase() + ')');
  return lines.join('\n');
}

/* Every block in a recovered tree, with the statement control reaches when the
 * block ends. utilities/structure_check.mjs walks these to re-derive, from the
 * tree alone, that each is a region with one way in and one way out -- the
 * property dvmRegionClosed enforces while building, and which has to be checked
 * from the outside or the check is only asking the recovery whether it agrees
 * with itself.
 */
function dvmBlocksOf(tree, follow) {
  const out = [];
  // `loops`: the enclosing loops' exits, which any block inside them may
  // be left for (a break, a continue) as well as for its own continuation.
  const walk = (list, cont, loops) => {
    loops = loops || [];
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      /* `exits` is every place a block may legitimately be left for. An if or
         else block has one: the statement after it. A LOOP body has two, and the
         second is a break -- a jump straight out to the statement after the loop,
         which real code here does (20 while bodies in the archive) and which is
         rendered as the `goto` it is. Two named exits is still a region; a jump
         to a third place is not, and that is what the check is for. */
      switch (n.kind) {
        case 'if':
          out.push({ kind: 'if', body: n.then, exits: [after].concat(loops) });
          walk(n.then, after, loops);
          break;
        case 'ifelse':
          out.push({ kind: 'if', body: n.then, exits: [after].concat(loops) });
          out.push({ kind: 'else', body: n.els, exits: [after].concat(loops) });
          walk(n.then, after, loops); walk(n.els, after, loops);
          break;
        case 'while':
          out.push({ kind: 'while', body: n.body, exits: [n.cond.abs, after].concat(loops) });
          walk(n.body, n.cond.abs, loops.concat([n.cond.abs, after]));
          break;
        case 'dowhile':
          out.push({ kind: 'do', body: n.body, exits: [n.cond.abs, after].concat(loops) });
          walk(n.body, n.cond.abs, loops.concat([n.cond.abs, after]));
          break;
        case 'loop': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : null;
          out.push({ kind: 'loop', body: n.body, exits: [head, after].concat(loops) });
          walk(n.body, head, loops.concat([head, after]));
          break;
        }
      }
    }
  };
  walk(tree, follow, []);
  return out;
}

/* ---- the code read as sentences ---------------------------------------------
 * The maintainer's "functions read in full" (23 September 2026): each part of
 * a function as a plain sentence, derived from the code wherever it can be.
 * This walks the same recovered tree the structured listing prints
 * (dvmRecoverStructure, dvmLoopExits) and says each statement in words, with
 * the conditions as clauses and the blocks nested under them.
 *
 * NO VOCABULARY IS TYPED IN. A call's words are its own name taken apart --
 * PlaySound is "play sound", ClearFlag "clear flag", a field talk_balloon
 * "talk balloon" -- so what a sentence says a call does is exactly what the
 * name says and no more; the names are delvmod's symbols, the one outside
 * source the listings already use, and the file-derived notes the fold makes
 * (a sound's id, a zoneport's zone, a To Do line, a prop type's name) come
 * along in brackets. The only words this adds are the language's own: if,
 * otherwise, for each, repeat, set, print, return, and the comparisons.
 * Unknowns stay numbers, as in the listings: a flag with no name in the
 * program is its number.
 *
 * A conversation's function is its answers, which the Text view lays out
 * whole; here it is one line that says how many it answers.
 *
 * The say switch is `ctx.say`: dvmFoldValue, dvmFoldOperator and dvmFoldCall
 * hand over to the functions below when it is set, so a value is read
 * through the same walk as the listing and cannot disagree with it about
 * what is inside what. utilities/read_check.mjs holds every call and
 * condition of every function to its sentences.
 */
function dvmSayName(name) {
  return String(name || '').replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ').map(w => /^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase()).join(' ').trim();
}
const DVM_SAY_INFIX = { '==': 'is', '!=': 'is not', '<': 'is less than', '>': 'is more than',
  '<=': 'is at most', '>=': 'is at least', 'and': 'and', 'or': 'or' };
function dvmSayOperator(n, args, ctx) {
  const infix = DVM_INFIX[n.op];
  if (infix) {
    /* A bit test reads as the bit: `X & 64` is "X has bit 6", `X & (1 << n)`
       "X has bit n" -- the numbering SetCharacterFlag and the other setters
       use -- and such a test compared with 0 is the test itself. */
    if (infix === '&') {
      const m = /^\(1 << (\w+)\)$/.exec(args[1]), v = /^\d+$/.test(args[1]) ? +args[1] : 0;
      // A bit of the bit flags the program names is said with its word.
      const bw = b => /bit flags$/.test(args[0]) && dvmBitFlagName(+b) ? ' (' + dvmBitFlagName(+b) + ')' : '';
      if (m) { dvmSayBitNote(ctx, args[0], m[1]); return args[0] + ' has bit ' + m[1] + bw(m[1]); }
      const k = /^~\(1 << (\w+)\)$/.exec(args[1]);
      if (k) return args[0] + ' without bit ' + k[1];
      if (v && (v & (v - 1)) === 0) { dvmSayBitNote(ctx, args[0], String(Math.log2(v))); return args[0] + ' has bit ' + Math.log2(v) + bw(Math.log2(v)); }
    }
    if (infix === '|') { const m = /^\(1 << (\w+)\)$/.exec(args[1]); if (m) return args[0] + ' with bit ' + m[1]; }
    if ((infix === '!=' || infix === '==') && args[1] === '0' && / has bit \w+(?: \(\w+\))?$/.test(args[0]))
      return infix === '!=' ? args[0] : args[0].replace(/ has bit /, ' has not got bit ');
    const w = DVM_SAY_INFIX[infix];
    const rhs = (infix === '==' || infix === '!=') && /\bbehavior$/.test(args[0]) ? dvmSayBehaviour('behavior', args[1], ctx) : args[1];
    return w ? args[0] + ' ' + w + ' ' + rhs : '(' + args[0] + ' ' + infix + ' ' + args[1] + ')';
  }
  const prefix = DVM_PREFIX[n.op];
  if (prefix === '!') return 'not ' + dvmSayGroup(args[0]);
  if (prefix) return prefix + args[0];
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  switch (n.op) {
    case 0x46: return args[0] + '[' + args[1] + ']';
    case 0x5F: return 'the length of ' + args[0];
    case 0x60: return args[0] + ' has ' + dvmSayName(bare);
    case 0x61: {
      const m = /^0x([0-9A-F]{2})([0-9A-F]{2})$/i.exec(bare);
      const k = m && String(parseInt(m[1], 16));
      const key = m && ((DVM_SYM.method && DVM_SYM.method[k]) || (DVM_SYM.field && DVM_SYM.field[k]));
      return dvmSayOwner(args[0]) + (key ? dvmSayName(key) + ' ' + parseInt(m[2], 16) : bare);
    }
    case 0x62: return dvmSayOwner(args[0]) + dvmSayName(bare);
    case 0x63: {
      // A character by its number, named from the character table.
      if (/^\d+$/.test(args[0]) && /^Character$/i.test(bare)) {
        const nm = dvmFoldPage(ctx, () => characterName(+args[0]));
        if (nm) return nm + ' (' + args[0] + ')';
      }
      return args[0] + ' as ' + dvmSayName(bare);
    }
    case 0x64: return args[0] + ' is ' + dvmSayName(bare);
    default: return dvmSayName(n.mn) + ' ' + args.join(', ');
  }
}
// Whose: "its" for the receiver, "X's" for anything else.
function dvmSayOwner(x) {
  // A cast changes what the engine checks, not whose field it is.
  const y = String(x).replace(/ as [a-z ]+$/, '');
  return y === 'it' ? 'its ' : /^\w+$|^the (target|signal|wearer)$|^[A-Z][\w' -]* \(\d+\)$/.test(y) ? y + '’s ' : '(' + y + ')’s ';
}
/* A helper that is only a few settings of its own locals and one return --
   `Var00 = Character(Arg00); return (Var00.bit_flags & 64)` -- is said by
   what it returns, with the caller's arguments put in: "its bit flags has
   bit 6" in place of "run 0xF13 it". The helper's name or id follows in
   brackets, so nothing is hidden. Anything with a jump, a call of its own
   that has effects, or a second return that is not the dead `return 0`
   after the first is left as a call. */
function dvmInlineHelper(arc, rid) {
  const all = derivedTable(arc, 'inlineHelpers', () => new Map());
  if (all.has(rid)) return all.get(rid);
  let out = null;
  try {
    const raw = getResourceBytes(arc, rid);
    const b = raw && smartDecrypt(raw, rid).data;
    const objs = b ? dvmExtents(b, rid) : [];
    const fns = objs.filter(o => o[2] === 'function');
    if (fns.length === 1 && fns[0][0] === 0 && !dvmNamedScript(b)) {
      const [st, en] = fns[0];
      const seg = b.subarray(st, en);
      const stmts = dvmStatementList(dvmForest(dvmDisassembleFolded(seg, st).ops), st);
      const sets = [];
      let ret = null, ok = true;
      for (const s of stmts) {
        const n = s.node;
        if (ret) { if (!(n.mn === 'return')) ok = false; break; }
        if (s.targets.length || s.kind === 'cond') { ok = false; break; }
        const slot = n.mn === 'set_local' ? parseInt(dvmBareOperand(n.arg), 16) : NaN;
        if (Number.isFinite(slot) && slot < 0x30) { sets.push(['Var' + slot.toString(16).toUpperCase().padStart(2, '0'), n]); continue; }
        if (n.mn === 'return' && n.groups[0] && n.groups[0].length) { ret = n; continue; }
        // One setting of a field, then the dead `return 0`: an effect helper.
        if (n.mn === 'set_field' && !sets.eff) { sets.eff = n; continue; }
        ok = false; break;
      }
      const effects = JSON.stringify(stmts.map(s => s.node.mn)).match(/"sys |"method"|"call_/);
      const eff = sets.eff || null;
      if (ok && ret && !effects && !/"sys |"call_|"method"/.test(JSON.stringify(ret.groups, (k, v) => k === 'op' ? undefined : v)))
        out = eff ? { args: seg[1], sets, eff } : { args: seg[1], sets, ret };
    }
  } catch (e) { out = null; }
  all.set(rid, out);
  return out;
}
/* Where a character's bit is set, said beside a test of it: every "set
   bit n of X's F" and "clear bit n of X's F" the Read view says anywhere in
   the archive, for a named character (a number the table names) or for
   "it" in a character's own conversation script, which is that character.
   The table is built from the sayer's own sentences, so a test and the
   settings it names are in the same words by construction. */
function dvmSayBitNote(ctx, owner, bit) {
  if (!ctx || !ctx.say || !ctx.arc || ctx.noBitNotes || !/^\d+$/.test(bit)) return;
  const who = dvmSayWhose(ctx, owner);
  if (!who) return;
  const table = derivedTable(ctx.arc, 'bitSetters', () => {
    const m = new Map();
    for (let subn = 0; subn < 256; subn++) {
      if (!ctx.arc.index[subn] || !ctx.arc.index[subn][0] || (typeof SCRIPT_SUBN !== 'undefined' && !SCRIPT_SUBN.has(subn))) continue;
      const count = subindexCount(ctx.arc, subn);
      for (let i = 0; i < count; i++) {
        const resid = ((subn + 1) << 8) | i;
        let fns;
        try { const raw = getResourceBytes(ctx.arc, resid); if (!raw || !raw.length) continue; fns = dvmReadRender(ctx.arc, smartDecrypt(raw, resid).data, resid, { noBitNotes: true }); } catch (e) { continue; }
        const c2 = { arc: ctx.arc, resid };
        (function walk(cl, asked) {
          for (const c of cl || []) {
            const mm = /^(set|clear) bit (\d+) of (.+?)(?:’s | )(bit flags|[a-z ]+)$/.exec(c.text.replace(/ \([^()]*\)$/, ''));
            if (mm) {
              const w = dvmSayWhose(c2, mm[3] === 'its' ? 'it' : mm[3]);
              if (w) {
                const key = w.index + ':' + mm[4] + ':' + mm[2];
                if (!m.has(key)) m.set(key, []);
                const row = m.get(key);
                if (!row.some(x => x.resid === resid && x.how === mm[1] && x.asked === asked)) row.push({ resid, how: mm[1], asked });
              }
            }
            walk(c.kids, c.prompt !== undefined ? c.prompt : asked);
          }
        })((fns || []).flatMap(f => f.clauses || []), null);
      }
    }
    return m;
  });
  const field = /(?:’s |^its )(.+)$/.exec(owner);
  const row = field && table.get(who.index + ':' + field[1] + ':' + bit);
  if (!row || !row.length) return;
  // A conversation by whose it is, and the prompt the setting answers.
  const name = x => { const nm = (x.resid >> 8) === 0x18 ? dvmFoldPage(ctx, () => characterName(x.resid - 0x1800)) : null;
    return (nm ? dvmSayPossessive(nm) + ' conversation' : dvmFoldResourceName(x.resid)) + (x.asked && x.asked !== '*' ? ', asked about ' + x.asked.split(',').map(k => {
      const w = dvmFoldPage(ctx, () => typeof convIntendedFor === 'function' ? convIntendedFor(k) : null);
      return (w && w[0] ? w[0] : k).toUpperCase();
    }).join(' or ') : ''); };
  const set = row.filter(x => x.how === 'set').map(name), clr = row.filter(x => x.how === 'clear').map(name);
  // Who does it first, then what they do (the maintainer, 2 October 2026:
  // no passive voice on the site).
  const many = (list, verb) => list.slice(0, 3).join('; ') + (list.length > 3 ? ' and ' + (list.length - 3) + ' more' : '') + ' ' + verb + (list.length === 1 ? 's' : '');
  dvmFoldNote(ctx, (set.length ? many(set, 'set') : 'nothing sets') + ' bit ' + bit + ' of ' + dvmSayPossessive(who.name) + ' ' + field[1] +
    (clr.length ? '; ' + many(clr, 'clear') + ' it' : ''));
}
function dvmSayPossessive(nm) { return nm + (/s$/.test(nm) ? '’' : '’s'); }
// Which character a phrase is: "Name (n)'s ..." by its number, "it" or
// "its ..." in a character's own conversation script by the script's.
function dvmSayWhose(ctx, owner) {
  const m = /\((\d+)\)(?:’s .*)?$/.exec(owner);
  if (m) { const nm = dvmFoldPage(ctx, () => characterName(+m[1])); return nm ? { index: +m[1], name: nm } : null; }
  if ((owner === 'it' || /^its /.test(owner)) && ctx.resid && (ctx.resid >> 8) === 0x18) {
    const nm = dvmFoldPage(ctx, () => characterName(ctx.resid - 0x1800));
    return nm ? { index: ctx.resid - 0x1800, name: nm } : null;
  }
  return null;
}
/* Where a game state is set, said beside a read of it: every SetState and
   SetStateFlag call with numbers for both arguments, in every script, by
   the resource that makes it. The state's meaning is in no file; where it
   changes is, and that is what a reader follows. */
function dvmSayStateNote(ctx, name, k) {
  const table = derivedTable(ctx.arc, 'stateSetters', () => {
    const m = new Map();
    for (let subn = 0; subn < 256; subn++) {
      if (!ctx.arc.index[subn] || !ctx.arc.index[subn][0] || (typeof SCRIPT_SUBN !== 'undefined' && !SCRIPT_SUBN.has(subn))) continue;
      const count = subindexCount(ctx.arc, subn);
      for (let i = 0; i < count; i++) {
        const resid = ((subn + 1) << 8) | i;
        let b;
        try { const raw = getResourceBytes(ctx.arc, resid); if (!raw || !raw.length) continue; b = smartDecrypt(raw, resid).data; } catch (e) { continue; }
        let objs;
        try { objs = dvmExtents(b, resid); } catch (e) { continue; }
        for (const [st, en, kind] of objs) {
          if (kind !== 'function') continue;
          let forest;
          try { forest = dvmForest(dvmDisassembleFolded(b.subarray(st, en), st).ops); } catch (e) { continue; }
          const c = { label: t => t, notes: [] };
          (function walk(list) {
            for (const n of list) {
              if (n.mn === 'sys SetState' || n.mn === 'sys SetStateFlag') {
                const v = dvmReduceFrame(n.groups[0] || [], c);
                if (/^\d+$/.test(v[0] || '') && /^\d+$/.test(v[1] || '')) {
                  const key = n.mn.slice(4) + ':' + v[0];
                  if (!m.has(key)) m.set(key, []);
                  const row = m.get(key), val = +v[1];
                  if (!row.some(x => x.v === val && x.resid === resid)) row.push({ v: val, resid });
                }
              }
              for (const g of n.groups || []) walk(g);
            }
          })(forest);
        }
      }
    }
    return m;
  });
  const row = table.get((name === 'GetState' ? 'SetState' : 'SetStateFlag') + ':' + k);
  if (!row || !row.length) return;
  const byV = new Map();
  // A character's conversation by whose it is; anything else by its name or id.
  const who = rid => {
    const nm = (rid >> 8) === 0x18 ? dvmFoldPage(ctx, () => characterName(rid - 0x1800)) : null;
    return nm ? dvmSayPossessive(nm) + ' conversation' : dvmFoldResourceName(rid);
  };
  for (const x of row) { if (!byV.has(x.v)) byV.set(x.v, []); byV.get(x.v).push(who(x.resid)); }
  const what = (name === 'GetState' ? 'state ' : 'state flag ') + k;
  dvmFoldNote(ctx, [...byV].sort((a, b) => a[0] - b[0]).map(([v, who], i) => who.slice(0, 3).join(', ') + (who.length > 3 ? ' and ' + (who.length - 3) + ' more' : '') +
    (who.length === 1 ? ' sets ' : ' set ') + (i ? 'it' : what) + ' to ' + v).join('; '));
}
/* A behaviour number said with the word the game's own text gives it. The
   game names some behaviours where it describes a person: a script that
   tests `X.behavior == N` and at once prints a word (the Look helper,
   0x3007: 144 "working", 145 "sleeping", 147 "eating", 148 "farming", 146
   "sitting") and one that tests a range and prints (134 to 137 "standing
   still"). Those pairs are read out of every script by that shape
   (dvmBehaviourWords), so the word is the game's and nothing is typed. */
function dvmSayBehaviour(field, value, ctx) {
  if (field !== 'behavior' || !/^\d+$/.test(value) || !ctx || !ctx.arc) return value;
  const w = dvmBehaviourWords(ctx.arc).get(+value);
  return w ? value + ' (' + w + ')' : value;
}
function dvmBehaviourWords(arc) {
  return derivedTable(arc, 'behaviourWords', () => {
    const out = new Map();
    const word = t => { const m = /^print\("([a-z][a-z ]*)"\)$/.exec(t); return m ? m[1] : null; };
    for (let subn = 0; subn < 256; subn++) {
      if (!arc.index[subn] || !arc.index[subn][0] || (typeof SCRIPT_SUBN !== 'undefined' && !SCRIPT_SUBN.has(subn))) continue;
      const count = subindexCount(arc, subn);
      for (let i = 0; i < count; i++) {
        const resid = ((subn + 1) << 8) | i;
        let b;
        try { const raw = getResourceBytes(arc, resid); if (!raw || !raw.length) continue; b = smartDecrypt(raw, resid).data; } catch (e) { continue; }
        let objs;
        try { objs = dvmExtents(b, resid); } catch (e) { continue; }
        for (const [st, en, kind] of objs) {
          if (kind !== 'function') continue;
          let stmts;
          try { const seg = b.subarray(st, en); stmts = dvmStatementList(dvmForest(dvmDisassembleFolded(seg, st).ops), st); } catch (e) { continue; }
          const ctx = { label: t => t, notes: [] };
          for (let k = 0; k + 1 < stmts.length; k++) {
            const s = stmts[k];
            // `if_not ... goto`: the statement after it runs when the test holds.
            if (s.kind !== 'cond' || s.parts || s.node.mn !== 'if_not') continue;
            // A negated test that jumps past the print when it fails: the
            // print is what follows when it holds, which is the test itself.
            const c = dvmCondJoined(s, ctx), w = word(dvmFoldStatement(stmts[k + 1].node, ctx));
            if (!w) continue;
            let m = /^\(\w+\.behavior == (\d+)\)$/.exec(c);
            if (m) { if (!out.has(+m[1])) out.set(+m[1], w); continue; }
            m = /^\(*\((\d+) <= \w+\.behavior\) and \(\w+\.behavior <= (\d+)\)\)*$/.exec(c);
            if (m) for (let v = +m[1]; v <= +m[2]; v++) if (!out.has(v)) out.set(v, w);
          }
        }
      }
    }
    return out;
  });
}
// A phrase that needs no brackets when it follows "not".
function dvmSayGroup(e) { return / (is|and|or|has) /.test(e) ? '(' + e + ')' : e; }
function dvmSayCall(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const vals = f => dvmReduceFrame(f || [], ctx);
  const withArgs = (verb, a) => verb + (a.length ? ' ' + a.join(', ') : '');
  if (/^sys /.test(n.mn)) {
    const name = n.mn.slice(4), v = vals(n.groups[0]);
    dvmFoldCallNotes(name, v, ctx);
    if ((name === 'GetState' || name === 'GetStateFlag') && /^\d+$/.test(v[0] || '') && ctx.arc) dvmSayStateNote(ctx, name, +v[0]);
    // A character given by number to a syscall that takes one (the program
    // says which: exeSyscallCharacterArgs), named from the character table.
    const chars = dvmFoldPage(ctx, () => typeof exeSyscallCharacterArgs === 'function' ? exeSyscallCharacterArgs() : null);
    const which = chars && chars.get(n.op);
    if (which) for (const k of which) if (/^\d+$/.test(v[k] || '')) {
      const nm = dvmFoldPage(ctx, () => characterName(+v[k]));
      if (nm) v[k] = nm + ' (' + v[k] + ')';
    }
    // The program's name for it (dvmSyscallShown). cbHeartBeat's says least
    // of what it does, so the handler's effect is said with it: it adds its
    // argument to the countdown the current character's turn waits out
    // (byte 18, TActiveMonster::DoTick).
    if (name === 'UseTime' && /^\d+$/.test(v[0] || '')) dvmFoldNote(ctx, 'the current character spends ' + v[0] + ' ticks');
    return withArgs(dvmSayName(dvmSyscallShown(name)), v);
  }
  switch (n.mn) {
    case 'call_resource': case 'call_subroutine': {
      const id = n.mn === 'call_resource' && /^0x([0-9A-F]+)$/i.exec(bare);
      // A named helper's operand carries its name; its id is in the raw operand.
      const rawId = n.mn === 'call_resource' && /0x([0-9A-F]{3,4})\b/i.exec(String(n.arg || ''));
      const rid = id ? parseInt(id[1], 16) : rawId ? parseInt(rawId[1], 16) : null;
      const inl = rid !== null && ctx.arc ? dvmInlineHelper(ctx.arc, rid) : null;
      // An effect helper is said by its effect only where it is a statement.
      if (inl && (!inl.eff || ctx.asStatement)) {
        const a = vals(n.groups[0]);
        if (a.length === inl.args) {
          const subst = new Map();
          a.forEach((v, k) => subst.set('Arg' + k.toString(16).toUpperCase().padStart(2, '0'), v));
          const c2 = Object.assign({}, ctx, { subst, self: null, target: null, notes: [] });
          for (const [slot, node] of inl.sets) subst.set(slot, dvmFoldFrame(node.groups[0] || [], c2));
          const said = inl.eff ? dvmSayStatement(inl.eff, Object.assign(c2, { asStatement: false })) : dvmFoldFrame(inl.ret.groups[0] || [], c2);
          for (const t of c2.notes) dvmFoldNote(ctx, t);
          dvmFoldNote(ctx, dvmFoldResourceName(rid));
          return said;
        }
      }
      const nm = id ? dvmFoldResourceName(parseInt(id[1], 16)) : bare;
      return withArgs(/^0x/i.test(nm) ? 'run ' + nm : dvmSayName(nm), vals(n.groups[0]));
    }
    case 'call_index': return withArgs('run ' + bare + '[' + dvmFoldFrame(n.groups[0] || [], ctx) + ']', vals(n.groups[1]));
    case 'method': {
      // The receiver's, as a field is: "its look", "Arg01's talk".
      const v = vals(n.groups[0]);
      return withArgs((v.length ? dvmSayOwner(v[0]) : '') + dvmSayName(bare), v.slice(1));
    }
    case 'gui': return withArgs('window ' + dvmSayName(bare), vals(n.groups[0]));
    case 'gui_close': return 'close window ' + dvmFoldFrame(n.groups[0] || [], ctx);
    case 'ai_state': return 'AI state ' + bare + (n.groups[0] ? ', ' + dvmFoldFrame(n.groups[0], ctx) : '');
    default: return withArgs(dvmSayName(n.mn) + (bare ? ' ' + bare : ''), n.groups.map(f => dvmFoldFrame(f, ctx)));
  }
}
function dvmSayStatement(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const g = n.groups.map(f => dvmFoldFrame(f, ctx));
  switch (n.mn) {
    case 'return': return g[0] ? 'return ' + g[0] : 'return';
    case 'print': return 'print ' + (g[0] || '');
    case 'string(implicit)': return 'print ' + dvmBareOperand(n.arg);
    case 'set_local': {
      let lhs = dvmSlotName(bare) || 'local ' + bare;
      if (lhs === ctx.self) lhs = 'it'; else if (lhs === ctx.target) lhs = ctx.targetName || 'the target';
      return 'set ' + lhs + ' to ' + (g[0] || '');
    }
    case 'set_global': return 'set ' + dvmSayName(bare) + ' to ' + (g[0] || '');
    case 'set_field': {
      const lhs = dvmSayOwner(g[0] || '') + dvmSayName(bare), v = g[1] || '';
      // Setting a field to itself with a bit more or less is setting or clearing the bit.
      const on = v.startsWith(lhs + ' with bit ') ? v.slice(lhs.length + 10) : null;
      const off = v.startsWith(lhs + ' without bit ') ? v.slice(lhs.length + 13) : null;
      if (on && /^\w+$/.test(on)) return 'set bit ' + on + ' of ' + lhs;
      if (off && /^\w+$/.test(off)) return 'clear bit ' + off + ' of ' + lhs;
      return 'set ' + lhs + ' to ' + dvmSayBehaviour(bare, v, ctx);
    }
    case 'set_index': return 'set ' + (g[0] || '') + '[' + (g[1] || '') + '] to ' + (g[2] || '');
    case 'write_near_word': case 'write_far_word': return 'set word@' + bare + ' to ' + (g[0] || '');
    case 'exit': return 'stop';
    case 'conversation_prompt': return 'ask ' + dvmBareOperand(n.arg);
    case 'conversation_response': return 'answer ' + dvmBareOperand(n.arg);
    default:
      if (n.expect > 0) {
        const was = ctx.asStatement;
        ctx.asStatement = true;
        try { return dvmSayCall(n, ctx); } finally { ctx.asStatement = was; }
      }
      return dvmFoldValue(n, ctx);
  }
}
function dvmSayCond(s, ctx, taken) {
  const leaf = p => dvmFoldFrame(p.node.groups[0] || [], ctx);
  const j = s.parts ? s.parts.map(p => dvmSayGroup(leaf(p))).join(s.negated ? ' or ' : ' and ') : leaf(s);
  const positive = taken ? s.negated : !s.negated;
  if (positive) return j;
  // Not of a not is the thing itself.
  if (!s.parts && /^not /.test(j)) { const r = j.slice(4); return /^\(.*\)$/.test(r) && dvmSayGroup(r.slice(1, -1)) === r ? r.slice(1, -1) : r; }
  const m = !s.parts && /^(.+) is (?!not |less |more |at )(.+)$/.exec(j);
  if (m && !/ (and|or) /.test(j)) return m[1] + ' is not ' + m[2];
  const n = !s.parts && /^(.+) is not (.+)$/.exec(j);
  if (n && !/ (and|or) /.test(j)) return n[1] + ' is ' + n[2];
  return 'not ' + dvmSayGroup(j);
}
/* What a statement does, for the summary: the verb it is said with, or the
   value it returns. The verb is the call's name taken apart, as in the
   sentence; a setting is "set" and what it sets. */
function dvmSayMeta(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  if (n.mn === 'return') return { returns: n.groups[0] ? dvmFoldFrame(n.groups[0], ctx) : '' };
  if (/^sys /.test(n.mn)) return { verb: dvmSayName(dvmSyscallShown(n.mn.slice(4))) };
  if (n.mn === 'method') return { verb: dvmSayName(bare) };
  if (n.mn === 'call_resource') { const id = /^0x([0-9A-F]+)$/i.exec(bare); const nm = id ? dvmFoldResourceName(parseInt(id[1], 16)) : bare; return { verb: /^0x/i.test(nm) ? 'run ' + nm : dvmSayName(nm) }; }
  if (n.mn === 'set_field') return { verb: 'set ' + dvmSayName(bare) };
  if (n.mn === 'set_local' || n.mn === 'set_global' || n.mn === 'set_index') return { verb: 'set values' };
  return {};
}
/* A function in one line: what it does, in the order it first does each,
   what it can return, and how many tests decide which. */
function dvmSaySummary(clauses) {
  const does = [], rets = [];
  let tests = 0;
  (function walk(cl) {
    for (const c of cl) {
      if (c.test) tests++;
      if (c.verb && does.indexOf(c.verb) < 0) does.push(c.verb);
      if (c.returns !== undefined && rets.indexOf(c.returns) < 0) rets.push(c.returns);
      if (c.kids) walk(c.kids);
    }
  })(clauses);
  const parts = [];
  if (does.length) parts.push(does.join(', '));
  if (rets.length) parts.push('returns ' + rets.map(r => r === '' ? 'nothing' : r).join(' or '));
  if (tests) parts.push(tests + (tests === 1 ? ' test decides' : ' tests decide') + ' which');
  return parts.join('; ');
}
/* The tree as clauses: { text, kids } with the blocks as kids. `notes` a
   clause gathered while it folded are said after it in brackets. */
function dvmSayTree(tree, ctx, loops) {
  const out = [];
  const fors = loops.fors, exits = loops.exits;
  const skip = new Set();
  for (const f of fors.values()) skip.add(f.start);
  const push = (text, kids, at, meta) => {
    const notes = ctx.notes.splice(0);
    out.push(Object.assign({ text: text + (notes.length ? ' (' + notes.join('; ') + ')' : ''), kids: kids || null, at: at === undefined ? null : at }, meta || {}));
  };
  let prints = null, printAt = null;
  const flush = () => { if (prints) { push('print ' + prints.join(', '), null, printAt, { verb: 'print' }); prints = null; } };
  // A heading takes the notes its condition gathered before its block is said.
  const head = text => { const nt = ctx.notes.splice(0); return text + (nt.length ? ' (' + nt.join('; ') + ')' : ''); };
  for (const n of tree) {
    if (n.kind === 'stmt' && skip.has(n.stmt)) continue;
    if (n.kind === 'stmt' && n.stmt.kind !== 'cond' && !exits.has(n.stmt)) {
      const node = n.stmt.node;
      if (node.mn === 'print' || node.mn === 'string(implicit)') {
        const v = node.mn === 'print' ? dvmFoldFrame(node.groups[0] || [], ctx) : dvmBareOperand(node.arg);
        if (!prints) printAt = n.stmt.abs;
        (prints = prints || []).push(v);
        continue;
      }
    }
    flush();
    switch (n.kind) {
      case 'stmt': {
        const s = n.stmt, word = exits.get(s);
        const go = word === 'break' ? 'stop the loop' : word === 'continue' ? 'go round again'
          : (s.targets.length === 1 ? 'go to ' + ctx.label('0x' + (n.goes !== undefined ? n.goes : s.targets[0]).toString(16).toUpperCase().padStart(4, '0')) : null);
        if (s.kind === 'cond' && go) push('if ' + dvmSayCond(s, ctx, true) + ', ' + go, null, s.abs, { test: true });
        else if (s.kind === 'jump' && go) push(go, null, s.abs);
        else push(dvmSayStatement(s.node, ctx), null, s.abs, dvmSayMeta(s.node, ctx));
        break;
      }
      case 'if': { const t = head('if ' + dvmSayCond(n.cond, ctx, false) + ':'); push(t, dvmSayTree(n.then, ctx, loops), n.cond.abs, { test: true }); break; }
      case 'ifelse': {
        if (!n.then.length) { const t = head('if ' + dvmSayCond(n.cond, ctx, true) + ':'); push(t, dvmSayTree(n.els, ctx, loops), n.cond.abs, { test: true }); break; }
        const t = head('if ' + dvmSayCond(n.cond, ctx, false) + ':');
        push(t, dvmSayTree(n.then, ctx, loops), n.cond.abs, { test: true });
        push('otherwise:', dvmSayTree(n.els, ctx, loops));
        break;
      }
      case 'while': {
        const f = fors.get(n);
        if (f) {
          for (const t of f.notes || []) dvmFoldNote(ctx, t);
          const t = head('for each ' + f.variable + ' in ' + dvmSayName(dvmSyscallShown(f.name)) + (f.args.length ? ' of ' + f.args.join(', ') : '') + ':');
          push(t, dvmSayTree(n.body.slice(0, -1), ctx, loops), f.start.abs, { verb: 'go through ' + dvmSayName(dvmSyscallShown(f.name)) });
        } else {
          const t = head('while ' + dvmSayCond(n.cond, ctx, false) + ':');
          push(t, dvmSayTree(n.body, ctx, loops), n.cond.abs, { test: true });
        }
        break;
      }
      case 'dowhile': {
        const kids = dvmSayTree(n.body, ctx, loops);
        push('repeat, and go round again while ' + dvmSayCond(n.cond, ctx, true) + ':', kids, dvmFirstAbs(n), { test: true });
        break;
      }
      case 'loop': push('repeat:', dvmSayTree(n.body, ctx, loops), dvmFirstAbs(n)); break;
    }
  }
  flush();
  return out;
}
/* A conversation, said. A character's Talk is a loop: it opens with the
   lines the window starts on, then an `exit` that waits for a word, then a
   chain of `answer "kw" -> target` guards -- each "if the word typed is not
   this, go on at target" -- whose bodies end by jumping back to the `exit`.
   So an answer is its guard and the statements up to its target, and a
   guard inside that stretch is a follow-up prompt of its own. Each stretch
   between guards goes through the same recovery and sayer as any code; the
   jump back to the wait is not said, since every answer makes it. */
function dvmSayConversation(stmts, ctx) {
  const wait = stmts.find(s => s.node && s.node.mn === 'exit');
  const loopAt = wait ? wait.abs : null;
  const guard = s => s.node && s.node.mn === 'conversation_response';
  const guardTo = s => { const m = /->\s*0x([0-9A-F]+)/i.exec(dvmBareOperand(s.node.arg)); return m ? parseInt(m[1], 16) : null; };
  const guardKw = s => { const m = /^"([^"]*)"/.exec(dvmBareOperand(s.node.arg)); return m ? m[1] : dvmBareOperand(s.node.arg); };
  const sayRun = run => {
    const back = new Set(run.filter(s => s.kind === 'jump' && s.targets.length === 1 && s.targets[0] === loopAt).map(s => s.abs));
    const body = run.filter(s => s !== wait);
    if (!body.length) return [];
    const rec = dvmRecoverStructure(body);
    const loops = dvmLoopExits(rec.tree, ctx);
    ctx.notes.length = 0;
    const drop = cl => cl.filter(c => !(c.at !== null && back.has(c.at) && /^go to /.test(c.text))).map(c => c.kids ? Object.assign(c, { kids: drop(c.kids) }) : c);
    return drop(dvmSayTree(rec.tree, ctx, loops));
  };
  const build = list => {
    const out = [];
    let run = [];
    const flush = () => { if (run.length) { out.push(...sayRun(run)); run = []; } };
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!guard(s)) { run.push(s); continue; }
      flush();
      const to = guardTo(s);
      const inner = [];
      while (i + 1 < list.length && to !== null && list[i + 1].abs < to) inner.push(list[++i]);
      const kw = guardKw(s);
      out.push({ text: kw === '*' ? 'when asked about anything else:' : 'when asked about "' + kw + '":', kids: build(inner), at: s.abs, prompt: kw, test: true });
    }
    flush();
    return out;
  };
  return build(stmts);
}
/* Every function of a resource, said. The same extents, names and recovery as
   dvmStructureRender; a prose object is said as what it holds. */
function dvmReadRender(arc, b, resid, opts) {
  const extra = Object.assign({ resid }, opts || {});
  dvmContextResid = (typeof resid === 'number') ? resid : null;
  const objs = dvmExtents(b, resid);
  const slots = dvmSlotNames(b, resid);
  const hex4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  const str = seg => decodeMacRoman(seg.filter(c => c));
  const out = [];
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    const name = slots.get(st) || (st === 0 && kind === 'function' ? dvmFoldResourceName(resid) : null) || ('obj_' + hex4(st));
    if (kind !== 'function') {
      if (kind !== 'array' && kind !== 'table' && (dvmIsProse(seg) || dvmIsIdentifier(seg))) out.push({ at: st, name, prose: str(seg) });
      continue;
    }
    const ph = dvmProseHead(seg.subarray(3));
    if (ph && ph.bare) { out.push({ at: st, name, prose: str(ph.head) }); continue; }
    const r = dvmDisassembleFolded(seg, st);
    const args = [];
    for (let i = 0; i < seg[1]; i++) args.push('Arg' + i.toString(16).padStart(2, '0').toUpperCase());
    const answers = r.ops.filter(o => o[2] === 'conversation_response').length;
    if (answers) {
      const self = slots.has(st) && args.length ? 'Arg00' : null;
      const ctx = Object.assign({ label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0'), arc, notes: [], say: true, self }, extra);
      let clauses = null;
      try { clauses = dvmSayConversation(dvmStatementList(dvmForest(r.ops), st), ctx); } catch (e) { clauses = null; }
      out.push({ at: st, name, args: self ? ['it'].concat(args.slice(1)) : args, answers, clauses,
                 summary: clauses ? 'answers ' + answers + ' prompt' + (answers === 1 ? '' : 's') : '', self: !!self, bad: r.bad || 0, ops: r.ops });
      continue;
    }
    /* A method is reached through its class's table, and the engine calls it
       with the object it belongs to first: TInterp::DoInterp pushes its
       first address as the first argument and DoInterp0 finds the method
       by that address's class. So in a method Arg00 is "it". A resource
       that is one function is a helper, called with whatever it is given. */
    const self = slots.has(st) && args.length ? 'Arg00' : null;
    /* A method's second argument is named where the engine's own calls say
       what it is, and nowhere else. Method 10, UseOn: TGameSys::UseOnCommand
       (thing, target) calls DoInterp(10, thing, 0x40000000 | target), the
       second a prop the player chose -- "the target". Method 21, GetMessage:
       every caller is a signal's sender -- TGameSys::SendSignal passes the
       signal it was given, TGameViewer::DoTicks, TSpellFX::PassTime and
       RemoveAllAbility pass 32 and 64, TGremlin::OnSignal passes its own --
       so it is "the signal". Methods 13 and 14, Wear and UnWear:
       TGameSys::WieldCommand passes the item and then the character wielding
       it -- "the wearer". Read off a scan of every call into TInterp::DoInterp
       by method number on 25 September 2026 (the notes, *The engine's names
       for a method's second argument*). HasSkill's, Learn's, PutInside's and
       the rest are whatever each engine call passes and are not named. */
    const ARG2 = { 10: 'the target', 21: 'the signal', 13: 'the wearer', 14: 'the wearer' };
    const methodNo = Object.keys(ARG2).find(k => DVM_SYM.method[k] === name);
    const target = self && methodNo !== undefined && args.length > 1 ? 'Arg01' : null;
    const ctx = Object.assign({ label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0'), arc, notes: [], say: true, self, target, targetName: target ? ARG2[methodNo] : null }, extra);
    const stmts = dvmStatementList(dvmForest(r.ops), st);
    const rec = dvmRecoverStructure(stmts);
    const loops = dvmLoopExits(rec.tree, ctx);
    ctx.notes.length = 0;
    const clauses = dvmSayTree(rec.tree, ctx, loops);
    /* The compiler ends every function with `return 0`, reached or not
       (the maintainer asked how Look could return twice: it cannot). A bare
       return straight after another at the top, with nothing jumping to it,
       is never run, so it is not said and not counted in what the function
       returns. */
    {
      const jumped = new Set();
      for (const s of stmts) for (const t of s.targets) jumped.add(t);
      for (let i = 1; i < clauses.length; i++) {
        const c = clauses[i], prev = clauses[i - 1];
        if (prev.returns !== undefined && !prev.kids && c.returns !== undefined && !c.kids && !jumped.has(c.at)) { clauses.splice(i, 1); i--; }
      }
    }
    const said = args.map((a, k) => a === self ? 'it' : a === target ? ctx.targetName : a);
    out.push({ at: st, name, args: said, clauses, summary: dvmSaySummary(clauses),
               self: !!self, bad: r.bad || 0, tree: rec.tree, ops: r.ops });
  }
  return out;
}

