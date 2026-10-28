/* delv-appfixes68k.js -- the 68K half of the program's fixes, as data.

   WRITTEN BY A SCRIPT: the workbench's tools/app68k/export_js.py, from the
   tables its fix68k.py checks and build68k.py builds. Change the fixes there
   and write this file again; an edit here alone would make the page's program
   and the workbench's differ, which utilities/app_patch_check.mjs rejects.

   The 68K program is the resource fork's CODE resources. A fix is any of:
   - inPlace: bytes at an offset of a CODE resource (the offset counts the
     resource's header, as the workbench's listings do), `was` checked
     before `now` is written;
   - caves: new code. The site's bytes (`was`) become a bra.l to the cave and
     nops; the cave goes at CODE 1's end, rounded up to four, or for any other
     segment where its relocation table begins, which moves up by the cave's
     length (the long at 8 of the segment). Caves are laid out in the order
     here. A cave is parts: 'hex' bytes, ':name' a label, 'bXX name' a short
     branch whose opcode byte is XX, 'bra.l 0x..' and 'bsr.l 0x..' a long one
     to an offset in the segment, 'pcrel 0x.. k' a long holding that offset
     less its place plus k. `bodies` has one per choice of the fixes that
     share the site, keyed by their names joined with '+' in this order;
   - values: a relocated long given another value (seg 0 is CODE 0's header,
     the size of the A5 world above A5, which is the largest any chosen fix
     needs);
   - data0: bytes of DATA 0, the compressed A5 world, at an offset.
   The comment after a bytes part is capstone's reading of it (its branches
   shown from the part's start). The fixes' reasons are js/delv-appfixes.js's
   for the PowerPC half and the workbench's fix68k.py for this one. */

const APP_FIXES_68K = {
  inPlace: [
    { fix: 'option-p', seg: 5, at: 0xC398, was: '7210c08156c044001d40ff4d1d6eff4dffef4a2effef6716', now: '0c4300a86600018e0240001067204e714e714e714e714e71' },  // cmpi.w #$a8, d3; bne.w $c52c; andi.w #$10, d0; beq.b $c3c6; nop; nop; nop; nop; nop
    { fix: 'option-x', seg: 5, at: 0xBEF2, was: '70001030081a02800000008056c044001d40ff7f1d6eff7ffff34a2efff367104878001f', now: '223c00033c743235180048c12001eb884841323c001f2f0108300007081a67144e714e71' },  // move.l #$33c74, d1; move.w (a5, d1.l), d1; ext.l d1; move.l d1, d0; lsl.l #$5, d0; swap d1; move.w #$1f, d1; move.l d1, -(a7); btst.b #$7, $1a(a0, d0.l); beq.b $bf26; nop; nop
    { fix: 'drag-northwest', seg: 5, at: 0x76D8, was: '673c', now: '6702' },  // beq.b $76dc
    { fix: 'theft-moved', seg: 4, at: 0x8C40, was: '4a1267080c12000866000088', now: '1012020000d76600008a4e71' },  // move.b (a2), d0; andi.b #$d7, d0; bne.w $8cd2; nop
    { fix: 'theft-moved', seg: 4, at: 0x994A, was: '7201', now: '7211' },  // moveq #$11, d1
    { fix: 'weight-contents', seg: 3, at: 0x92FE, was: '4eb900019ea848c0', now: '600400019ea87000' },  // bra.b $9304; ori.b #$a8, d1; moveq #$0, d0
    { fix: 'sleep-hidden', seg: 1, at: 0x3858, was: '200c67102f0c20572268', now: '4a04671016bc0042600e' },  // tst.b d4; beq.b $386c; move.b #$42, (a3); bra.b $3870
    { fix: 'load-cost', seg: 1, at: 0xEC36, was: '3f3c000f', now: '3f3c0000' },  // move.w #$0, -(a7)
    { fix: 'level-keep-made', seg: 1, at: 0x47F8, was: '6726', now: '6026' },  // bra.b $4820
    { fix: 'level-keep-place', seg: 1, at: 0x4564, was: '41eefff043d222d822d822d822d8', now: '021200df4e714e714e714e714e71' },  // andi.b #$df, (a2); nop; nop; nop; nop; nop
    { fix: 'level-keep-place', seg: 1, at: 0x4578, was: '660000d0', now: '600000d0' },  // bra.w $464a
    { fix: 'tab-pane', seg: 5, at: 0x3D52, was: '302e000e48c04c7c0800000000493d40ff923f2eff92', now: '7000302e000e81fc00490c4000026f0270023f004e71' },  // moveq #$0, d0; move.w $e(a6), d0; divs.w #$49, d0; cmpi.w #$2, d0; ble.b $3d64; moveq #$2, d0; move.w d0, -(a7); nop
    { fix: 'target-hunger', seg: 7, at: 0x6692, was: '6046', now: '604e' },  // bra.b $66e2
    { fix: 'roster-pose', seg: 5, at: 0x15682, was: 'e988e8802d40ff6a2d6eff6aff66', now: 'e9c01009e3a82d40ff6a2d40ff66' },  // bfextu d0{0:9}, d1; lsl.l d1, d0; move.l d0, -$96(a6); move.l d0, -$9a(a6)
    { fix: 'menu-scroll', seg: 5, at: 0x118EE, was: '3028001c48c0', now: '7004d068001c' },  // moveq #$4, d0; add.w $1c(a0), d0
    { fix: 'menu-scroll', seg: 5, at: 0x1202A, was: '302a001c48c0', now: '7004d06a001c' },  // moveq #$4, d0; add.w $1c(a2), d0
    { fix: 'corpse-light', seg: 7, at: 0x1586, was: '26132043102800087240c081660c', now: '20530828000600086610302b0008' },  // movea.l (a3), a0; btst.b #$6, $8(a0); bne.b $15a0; move.w $8(a3), d0
    { fix: 'corpse-light', seg: 7, at: 0x1594, was: '3f2b0008', now: '670a3f00' },  // beq.b $15a0; move.w d0, -(a7)
    { fix: 'hood-size', seg: 6, at: 0xC0A6, was: '0c6b08000006', now: '0c6b40000006' },  // cmpi.w #$4000, $6(a3)
    { fix: 'hood-size', seg: 6, at: 0xC11A, was: '0c6a08000006', now: '0c6a40000006' },  // cmpi.w #$4000, $6(a2)
    { fix: 'walk-to', seg: 4, at: 0xA376, was: '0c80000000ff', now: '0c80ffffffff' },  // cmpi.l #$ffffffff, d0
    { fix: 'right-click', seg: 1, at: 0xD7D4, was: '006a0100000e', now: '006a1000000e' },  // ori.w #$1000, $e(a2)
    { fix: 'right-click', seg: 1, at: 0xD7DE, was: '006a1000000e', now: '006a0100000e' },  // ori.w #$100, $e(a2)
    { fix: 'speech-clear', seg: 5, at: 0xFC9C, was: '2f3c000c0067', now: '2f3c000c0064' },  // move.l #$c0064, -(a7)
    { fix: 'speech-clear', seg: 5, at: 0xFCE2, was: '256efff80858256efffc085c357c0050085c', now: '257c000c00730858257c005001f4085c4e71' },  // move.l #$c0073, $858(a2); move.l #$5001f4, $85c(a2); nop
    { fix: 'name-clear', seg: 5, at: 0xF56C, was: '357c00680002', now: '357c00710002' },  // move.w #$71, $2(a2)
    { fix: 'name-clear', seg: 5, at: 0xFE0A, was: '48780067', now: '4878006f' },  // pea.l $6f.w
    { fix: 'menu-items', seg: 3, at: 0xA0B2, was: '48780014', now: '48780040' },  // pea.l $40.w
    { fix: 'menu-items', seg: 3, at: 0xA132, was: '0c430014', now: '0c430040' },  // cmpi.w #$40, d3
    { fix: 'corner-body', seg: 1, at: 0x4E02, was: '7400', now: '7401' },  // moveq #$1, d2
    { fix: 'corner-body', seg: 1, at: 0x4E1C, was: '670000b6', now: '670000a4' },  // beq.w $4ec2
    { fix: 'ai-import', seg: 1, at: 0x1E3BC, was: '4a9467141f3c00012f142f1261fffffff59642944fef000a30040280000000ffe788d9c042ac0004', now: '30040280000000ffe788d9c04a9467141f3c00012f142f1261fffffff58a42944fef000a42ac0004' },  // move.w d4, d0; andi.l #$ff, d0; lsl.l #$3, d0; adda.l d0, a4; tst.l (a4); beq.b $1e3e0; move.b #$1, -(a7); move.l (a4), -(a7); move.l (a2), -(a7); bsr.l $1d960; clr.l (a4); lea.l $a(a7), a7; clr.l $4(a4)
    { fix: 'ai-import', seg: 1, at: 0x1E416, was: '7000600270014a006706297234040004', now: '600e4e71297234040004600c4e714e71' },  // bra.b $1e426; nop; move.l $4(a2, d3.w), $4(a4); bra.b $1e42e; nop; nop
    { fix: 'open-during-play', seg: 1, at: 0x1E52E, was: '4a926718', now: '42aa0004' },  // clr.l $4(a2)
    { fix: 'afternoon', seg: 3, at: 0x7DE0, was: '7006', now: '7012' },  // moveq #$12, d0
    { fix: 'spot-tune', seg: 1, at: 0x6A56, was: '6718', now: '6746' },  // beq.b $6a9e
  ],
  caves: [
    { fixes: ['walk-to'], seg: 5, site: 0x663A, was: '4aaeff486700008e', bodies: {
      'walk-to': [
        '4aaeff48',                                  // tst.l -$b8(a6)
        'b67 walk',
        'bra.l 0x6642',
        ':walk',
        '4a6effda',                                  // tst.w -$26(a6)
        'b67 done',
        '4a2eff2f',                                  // tst.b -$d1(a6)
        'b67 done',
        '42273f2eff303f2eff32223c0001dc1c2f3518004ead13d84fef000a', // clr.b -(a7); move.w -$d0(a6), -(a7); move.w -$ce(a6), -(a7); move.l #$1dc1c, d1; move.l (a5, d1.l), -(a7); jsr $13d8(a5); lea.l $a(a7), a7
        ':done',
        'bra.l 0x66ce',
      ],
    } },
    { fixes: ['walk-to'], seg: 5, site: 0x669A, was: '4aaeff48672e', bodies: {
      'walk-to': [
        '4aaeff48',                                  // tst.l -$b8(a6)
        'b67 walk',
        'bra.l 0x66a0',
        ':walk',
        '4a6effda',                                  // tst.w -$26(a6)
        'b67 done',
        '4a2eff2f',                                  // tst.b -$d1(a6)
        'b67 done',
        '42273f2eff303f2eff32223c0001dc1c2f3518004ead13d84fef000a', // clr.b -(a7); move.w -$d0(a6), -(a7); move.w -$ce(a6), -(a7); move.l #$1dc1c, d1; move.l (a5, d1.l), -(a7); jsr $13d8(a5); lea.l $a(a7), a7
        ':done',
        'bra.l 0x66ce',
      ],
    } },
    { fixes: ['walk-to'], seg: 4, site: 0x5D54, was: '4e56fffc2f0a2f037000261f245f4e5e4e75', bodies: {
      'walk-to': [
        '4e56fffc48e71800',                          // link.w a6, #$fffc; movem.l d3-d4, -(a7)
        '223c00033c743035180048c0e988',              // move.l #$33c74, d1; move.w (a5, d1.l), d0; ext.l d0; lsl.l #$4, d0
        '223c00041d5820751800d1c0',                  // move.l #$41d58, d1; movea.l (a5, d1.l), a0; adda.l d0, a0
        'ebd0320cebe8410c0002',                      // bfexts (a0){8:12}, d3; bfexts $2(a0){4:12}, d4
        '3f2e000e3f2e000c3f043f0342a7',              // move.w $e(a6), -(a7); move.w $c(a6), -(a7); move.w d4, -(a7); move.w d3, -(a7); clr.l -(a7)
        '203c0001d38c487508004ead14b84fef0010',      // move.l #$1d38c, d0; pea.l (a5, d0.l); jsr $14b8(a5); lea.l $10(a7), a7
        '0c407fff',                                  // cmpi.w #$7fff, d0
        'b67 none',
        '486efffe486efffc203c0001d38c487508004ead14b04fef000c', // pea.l -$2(a6); pea.l -$4(a6); move.l #$1d38c, d0; pea.l (a5, d0.l); jsr $14b0(a5); lea.l $c(a7), a7
        '302efffe48c05480c1fc0005d06efffc5440d04048c0068000005d3030350800', // move.w -$2(a6), d0; ext.l d0; addq.l #$2, d0; muls.w #$5, d0; add.w -$4(a6), d0; addq.w #$2, d0; add.w d0, d0; ext.l d0; addi.l #$5d30, d0; move.w (a5, d0.l), d0
        '0c400007',                                  // cmpi.w #$7, d0
        'b62 none',
        '48c02f00223c0001dc1c2f3518004ead13d0504f',  // ext.l d0; move.l d0, -(a7); move.l #$1dc1c, d1; move.l (a5, d1.l), -(a7); jsr $13d0(a5); addq.w #$8, a7
        ':none',
        '70004cdf00184e5e4e75',                      // moveq #$0, d0; movem.l (a7)+, d3-d4; unlk a6; rts
      ],
    } },
    { fixes: ['name-fit'], seg: 5, site: 0x103AE, was: '3f3c0054486efef461ffffffe7be', bodies: {
      'name-fit': [
        '205520503868004a',                          // movea.l (a5), a0; movea.l (a0), a0; movea.w $4a(a0), a4
        ':measure',
        '41eefef470ff',                              // lea.l -$10c(a6), a0; moveq #$ff, d0
        ':len',
        '52804a18',                                  // addq.l #$1, d0; tst.b (a0)+
        'b66 len',
        '554f486efef442673f00a886301f',              // subq.w #$2, a7; pea.l -$10c(a6); clr.w -(a7); move.w d0, -(a7); dc.w $a886; move.w (a7)+, d0
        '0c40005a',                                  // cmpi.w #$5a, d0
        'b6f fits',
        '205520503028004a0c400009',                  // movea.l (a5), a0; movea.l (a0), a0; move.w $4a(a0), d0; cmpi.w #$9, d0
        'b6f squeeze',
        '53403f00a88a',                              // subq.w #$1, d0; move.w d0, -(a7); dc.w $a88a
        'b60 measure',
        ':squeeze',
        '3f3c005a486efef4',                          // move.w #$5a, -(a7); pea.l -$10c(a6)
        'bsr.l 0xeb76',
        'bra.l 0x103bc',
        ':fits',
        '3f3c005a486efef4',                          // move.w #$5a, -(a7); pea.l -$10c(a6)
        'bra.l 0x103bc',
      ],
    } },
    { fixes: ['name-fit'], seg: 5, site: 0x10474, was: '42a7aa233f3cffff', bodies: {
      'name-fit': [
        '42a7aa233f0ca88a3f3cffff',                  // clr.l -(a7); dc.w $aa23; move.w a4, -(a7); dc.w $a88a; move.w #$ffff, -(a7)
        'bra.l 0x1047c',
      ],
    } },
    { fixes: ['journal-rows'], seg: 5, site: 0x19AE6, was: '206a000420503d68004cffec', bodies: {
      'journal-rows': [
        '206a00042050',                              // movea.l $4(a2), a0; movea.l (a0), a0
        '0c680a80004c',                              // cmpi.w #$a80, $4c(a0)
        'b6d add',
        '3f3c000142672f2a00043f3c0024a9e7',          // move.w #$1, -(a7); clr.w -(a7); move.l $4(a2), -(a7); move.w #$24, -(a7); dc.w $a9e7
        '206a00042050',                              // movea.l $4(a2), a0; movea.l (a0), a0
        ':add',
        '3d68004cffec',                              // move.w $4c(a0), -$14(a6)
        'bra.l 0x19af0',
      ],
    } },
    { fixes: ['journal-rows'], seg: 5, site: 0x19BB6, was: '206a000420503d68004cffec', bodies: {
      'journal-rows': [
        '206a00042050',                              // movea.l $4(a2), a0; movea.l (a0), a0
        '0c680a80004c',                              // cmpi.w #$a80, $4c(a0)
        'b6d add',
        '3f3c000142672f2a00043f3c0024a9e7',          // move.w #$1, -(a7); clr.w -(a7); move.l $4(a2), -(a7); move.w #$24, -(a7); dc.w $a9e7
        '206a00042050',                              // movea.l $4(a2), a0; movea.l (a0), a0
        ':add',
        '3d68004cffec',                              // move.w $4c(a0), -$14(a6)
        'bra.l 0x19bc0',
      ],
    } },
    { fixes: ['hook-load'], seg: 1, site: 0xEC52, was: '4fef00264cdf1cf8', bodies: {
      'hook-load': [
        '2f00598f223c00033c743235180002810000ffff0081404000002f013f3c00f3486f00064ead14d84fef000e201f4fef00264cdf1cf84e5e4e75', // move.l d0, -(a7); subq.l #$4, a7; move.l #$33c74, d1; move.w (a5, d1.l), d1; andi.l #$ffff, d1; ori.l #$40400000, d1; move.l d1, -(a7); move.w #$f3, -(a7); pea.l $6(a7); jsr $14d8(a5); lea.l $e(a7), a7; move.l (a7)+, d0; lea.l $26(a7), a7; movem.l (a7)+, d3-d7/a2-a4; unlk a6; rts
      ],
    } },
    { fixes: ['widget-renumber'], seg: 3, site: 0x10BC6, was: '4e5600004e5e4e75', bodies: {
      'widget-renumber': [
        '4e560000206e0008302e000cb06800066606316e000e00064e5e4e75', // link.w a6, #$0; movea.l $8(a6), a0; move.w $c(a6), d0; cmp.w $6(a0), d0; bne.b $18; move.w $e(a6), $6(a0); unlk a6; rts
      ],
    } },
    { fixes: ['music-revert'], seg: 1, site: 0x693E, was: '48e71f38262e0008', bodies: {
      'music-revert': [
        '48e71f38262e0008223c00025cde1c351800',      // movem.l d3-d7/a2-a4, -(a7); move.l $8(a6), d3; move.l #$25cde, d1; move.b (a5, d1.l), d6
        'bra.l 0x6946',
      ],
    } },
    { fixes: ['music-revert'], seg: 1, site: 0x696E, was: 'b6aefffc67000098', bodies: {
      'music-revert': [
        'b6aefffc',                                  // cmp.l -$4(a6), d3
        'b66 make',
        '4a06',                                      // tst.b d6
        'b67 make',
        'bra.l 0x6a0c',
        ':make',
        'bra.l 0x6976',
      ],
    } },
    { fixes: ['music-lock'], seg: 1, site: 0x745C, was: '2f0b61fffffff4da584f', bodies: {
      'music-lock': [
        '223c00032200207518002f0b2f10',              // move.l #$32200, d1; movea.l (a5, d1.l), a0; move.l a3, -(a7); move.l (a0), -(a7)
        'bsr.l 0x1da28',
        '504f',                                      // addq.w #$8, a7
        '2f0b',                                      // move.l a3, -(a7)
        'bsr.l 0x693a',
        '584f',                                      // addq.w #$4, a7
        '223c00032200207518002f0b2f10',              // move.l #$32200, d1; movea.l (a5, d1.l), a0; move.l a3, -(a7); move.l (a0), -(a7)
        'bsr.l 0x1da6e',
        '504f',                                      // addq.w #$8, a7
        'bra.l 0x7466',
      ],
    } },
    { fixes: ['spell-glow'], seg: 3, site: 0xC6CA, was: '382c00021f3c0001', bodies: {
      'spell-glow': [
        '382c0002',                                  // move.w $2(a4), d4
        '0c2c00400001',                              // cmpi.b #$40, $1(a4)
        'b66 as',
        '0c440100',                                  // cmpi.w #$100, d4
        'b6d as',
        '70003004eb88068000042560d08d2f00',          // moveq #$0, d0; move.w d4, d0; lsl.l #$5, d0; addi.l #$42560, d0; add.l a5, d0; move.l d0, -(a7)
        '4ead01c0584f2008',                          // jsr $1c0(a5); addq.w #$4, a7; move.l a0, d0
        'b67 as',
        '20680010223c00041d5891f518002008e8803800',  // movea.l $10(a0), a0; move.l #$41d58, d1; suba.l (a5, d1.l), a0; move.l a0, d0; asr.l #$4, d0; move.w d0, d4
        ':as',
        '1f3c0001',                                  // move.b #$1, -(a7)
        'bra.l 0xc6d2',
      ],
    } },
    { fixes: ['hero-square'], seg: 6, site: 0xB32E, was: '4a713200660433843200', bodies: {
      'hero-square': [
        '4a713200',                                  // tst.w (a1, d3.w * 2)
        'b67 store',
        '223c00033c74b8751800',                      // move.l #$33c74, d1; cmp.w (a5, d1.l), d4
        'b66 back',
        ':store',
        '33843200',                                  // move.w d4, (a1, d3.w * 2)
        ':back',
        'bra.l 0xb338',
      ],
    } },
    { fixes: ['hero-square'], seg: 6, site: 0xB44C, was: '4a506606206efff03084', bodies: {
      'hero-square': [
        '4a50',                                      // tst.w (a0)
        'b67 store',
        '223c00033c74b8751800',                      // move.l #$33c74, d1; cmp.w (a5, d1.l), d4
        'b66 back',
        ':store',
        '206efff03084',                              // movea.l -$10(a6), a0; move.w d4, (a0)
        ':back',
        'bra.l 0xb456',
      ],
    } },
    { fixes: ['containers-weight'], seg: 4, site: 0x8C20, was: 'b2aeff64504f6f18', bodies: {
      'containers-weight': [
        'b2aeff64504f',                              // cmp.l -$9c(a6), d1; addq.w #$8, a7
        'b6f go',
        'bra.l 0x8c28',
        ':go',
        '2f00',                                      // move.l d0, -(a7)
        '203c',                                      // move.l #$aaaaaaaa, d0
        'pcrel 0x8b94 6',
        '203b0800048000019d9e2640',                  // move.l $2(pc,d0.l), d0; subi.l #$19d9e, d0; movea.l d0, a3
        '3f05',                                      // move.w d5, -(a7)
        '204bd1fc0001a1404e90',                      // movea.l a3, a0; adda.l #$1a140, a0; jsr (a0)
        '544f4a40',                                  // addq.w #$2, a7; tst.w d0
        'b67 ok4',
        '0c400100',                                  // cmpi.w #$100, d0
        'b6c ok4',
        '3f003f04',                                  // move.w d0, -(a7); move.w d4, -(a7)
        '204bd1fc0001a1404e90',                      // movea.l a3, a0; adda.l #$1a140, a0; jsr (a0)
        '544fb057',                                  // addq.w #$2, a7; cmp.w (a7), d0
        'b67 ok6',
        '3f17',                                      // move.w (a7), -(a7)
        '204bd1fc00019ea84e90',                      // movea.l a3, a0; adda.l #$19ea8, a0; jsr (a0)
        '544f48c0d0af00022f400002',                  // addq.w #$2, a7; ext.l d0; add.l $2(a7), d0; move.l d0, $2(a7)
        '3f17',                                      // move.w (a7), -(a7)
        '204bd1fc00019d9e4e90',                      // movea.l a3, a0; adda.l #$19d9e, a0; jsr (a0)
        '544f48c0b0af0002',                          // addq.w #$2, a7; ext.l d0; cmp.l $2(a7), d0
        'b6d fail6',
        ':ok6',
        '5c4f',                                      // addq.w #$6, a7
        'bra.l 0x8c40',
        ':fail6',
        '5c4f',                                      // addq.w #$6, a7
        'bra.l 0x8c28',
        ':ok4',
        '588f',                                      // addq.l #$4, a7
        'bra.l 0x8c40',
      ],
    } },
    { fixes: ['books-window'], seg: 3, site: 0x8E8A, was: '3a000c450100544f6d027a00ba476644', bodies: {
      'books-window': [
        '3a000c450100544f',                          // move.w d0, d5; cmpi.w #$100, d5; addq.w #$2, a7
        'b6d own',
        '7a00',                                      // moveq #$0, d5
        ':own',
        'ba47',                                      // cmp.w d7, d5
        'b66 out',
        '203c',                                      // move.l #$aaaaaaaa, d0
        'pcrel 0x8e9e 6',
        '203b0800',                                  // move.l $2(pc,d0.l), d0
        '048000019c602640',                          // subi.l #$19c60, d0; movea.l d0, a3
        '3f04',                                      // move.w d4, -(a7)
        '204bd1fc0001a06a4e90',                      // movea.l a3, a0; adda.l #$1a06a, a0; jsr (a0)
        '544f3a00',                                  // addq.w #$2, a7; move.w d0, d5
        '2f0a',                                      // move.l a2, -(a7)
        '204bd1fc00019c604e90',                      // movea.l a3, a0; adda.l #$19c60, a0; jsr (a0)
        '584fb640',                                  // addq.w #$4, a7; cmp.w d0, d3
        'b6d part',
        '96403f04',                                  // sub.w d0, d3; move.w d4, -(a7)
        '204bd1fc000048a84e90',                      // movea.l a3, a0; adda.l #$48a8, a0; jsr (a0)
        '544f',                                      // addq.w #$2, a7
        'b60 mark',
        ':part',
        '90433f002f0a',                              // sub.w d3, d0; move.w d0, -(a7); move.l a2, -(a7)
        '204bd1fc00019b5a4e90',                      // movea.l a3, a0; adda.l #$19b5a, a0; jsr (a0)
        '5c4f7600',                                  // addq.w #$6, a7; moveq #$0, d3
        ':mark',
        '3f3c00023f054ead0640584f',                  // move.w #$2, -(a7); move.w d5, -(a7); jsr $640(a5); addq.w #$4, a7
        ':out',
        'bra.l 0x8ede',
      ],
    } },
    { fixes: ['take-window'], seg: 3, site: 0x87FC, was: '3044e9d20218028000ff000022088081efd2021814bc0010', bodies: {
      'take-window': [
        '3f3c00023f2a00024ead0640584f3044e9d20218028000ff000022088081efd2021814bc0010', // move.w #$2, -(a7); move.w $2(a2), -(a7); jsr $640(a5); addq.w #$4, a7; movea.w d4, a0; bfextu (a2){8:24}, d0; andi.l #$ff0000, d0; move.l a0, d1; or.l d1, d0; bfins d0, (a2){8:24}; move.b #$10, (a2)
        'bra.l 0x8814',
      ],
    } },
    { fixes: ['hook-take'], seg: 4, site: 0x8BDC, was: '4a2effff665e', bodies: {
      'hook-take': [
        '3205',                                      // move.w d5, d1
        'b6f none',
        '02810000ffff0c450100',                      // andi.l #$ffff, d1; cmpi.w #$100, d5
        'b6c prop',
        '008140400000',                              // ori.l #$40400000, d1
        'b60 thing',
        ':prop',
        '008140000000',                              // ori.l #$40000000, d1
        ':thing',
        '300402800000ffff008040000000',              // move.w d4, d0; andi.l #$ffff, d0; ori.l #$40000000, d0
        '598f2f002f013f3c00f1486f000a',              // subq.l #$4, a7; move.l d0, -(a7); move.l d1, -(a7); move.w #$f1, -(a7); pea.l $a(a7)
        '4ead14e04fef000e201f',                      // jsr $14e0(a5); lea.l $e(a7), a7; move.l (a7)+, d0
        '0c805000ffff',                              // cmpi.l #$5000ffff, d0
        'b67 none',
        '0c8050000000',                              // cmpi.l #$50000000, d0
        'b66 taken',
        'bra.l 0x8f52',
        ':taken',
        'bra.l 0x8c40',
        ':none',
        '4a2effff',                                  // tst.b -$1(a6)
        'b66 taken',
        'bra.l 0x8be2',
      ],
    } },
    { fixes: ['hook-corpse'], seg: 7, site: 0x1AC0, was: '206a00043d68000effa2', bodies: {
      'hook-corpse': [
        '322eff7602810000ffff008140400000',          // move.w -$8a(a6), d1; andi.l #$ffff, d1; ori.l #$40400000, d1
        '598f2f013f3c00f2486f0006',                  // subq.l #$4, a7; move.l d1, -(a7); move.w #$f2, -(a7); pea.l $6(a7)
        '4ead14d84fef000a201f',                      // jsr $14d8(a5); lea.l $a(a7), a7; move.l (a7)+, d0
        '220048410241f000',                          // move.l d0, d1; swap d1; andi.w #$f000, d1
        'b66 own',
        '3d40ffa2',                                  // move.w d0, -$5e(a6)
        'bra.l 0x1aca',
        ':own',
        '206a00043d68000effa2',                      // movea.l $4(a2), a0; move.w $e(a0), -$5e(a6)
        'bra.l 0x1aca',
      ],
    } },
    { fixes: ['empty-zone-save'], seg: 1, site: 0x401E, was: '0680ffffff00', bodies: {
      'empty-zone-save': [
        '0680ffffff006612223c00041d5820751800117c00ff10007001', // addi.l #$ffffff00, d0; bne.b $1a; move.l #$41d58, d1; movea.l (a5, d1.l), a0; move.b #$ff, $1000(a0); moveq #$1, d0
        'bra.l 0x4024',
      ],
    } },
    { fixes: ['sleeper-unit', 'unit-guard'], seg: 7, site: 0x124, was: '3f0161fffffffee4226e000823480004', bodies: {
      'sleeper-unit': [
        '0c410108',                                  // cmpi.w #$108, d1
        'b66 lookup',
        '0c450100',                                  // cmpi.w #$100, d5
        'b6c lookup',
        '3005',                                      // move.w d5, d0
        '48c0eb8806800004256032350814024103ff',      // ext.l d0; lsl.l #$5, d0; addi.l #$42560, d0; move.w $14(a5, d0.l), d1; andi.w #$3ff, d1
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x134',
      ],
      'unit-guard': [
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        '2008',                                      // move.l a0, d0
        'b66 store',
        '203c000321fc20750800',                      // move.l #$321fc, d0; movea.l (a5, d0.l), a0
        '0c5700e5',                                  // cmpi.w #$e5, (a7)
        'b66 store',
        '2248',                                      // movea.l a0, a1
        ':loop',
        '4a68000c',                                  // tst.w $c(a0)
        'b67 nf',
        '0c68002e000c',                              // cmpi.w #$2e, $c(a0)
        'b67 store',
        '41e80010',                                  // lea.l $10(a0), a0
        'b60 loop',
        ':nf',
        '2049',                                      // movea.l a1, a0
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x134',
      ],
      'sleeper-unit+unit-guard': [
        '0c410108',                                  // cmpi.w #$108, d1
        'b66 lookup',
        '0c450100',                                  // cmpi.w #$100, d5
        'b6c lookup',
        '3005',                                      // move.w d5, d0
        '48c0eb8806800004256032350814024103ff',      // ext.l d0; lsl.l #$5, d0; addi.l #$42560, d0; move.w $14(a5, d0.l), d1; andi.w #$3ff, d1
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        '2008',                                      // move.l a0, d0
        'b66 store',
        '203c000321fc20750800',                      // move.l #$321fc, d0; movea.l (a5, d0.l), a0
        '0c5700e5',                                  // cmpi.w #$e5, (a7)
        'b66 store',
        '2248',                                      // movea.l a0, a1
        ':loop',
        '4a68000c',                                  // tst.w $c(a0)
        'b67 nf',
        '0c68002e000c',                              // cmpi.w #$2e, $c(a0)
        'b67 store',
        '41e80010',                                  // lea.l $10(a0), a0
        'b60 loop',
        ':nf',
        '2049',                                      // movea.l a1, a0
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x134',
      ],
    } },
    { fixes: ['sleeper-unit', 'unit-guard'], seg: 7, site: 0x1242, was: '3f0161ffffffedc6226e000823480004', bodies: {
      'sleeper-unit': [
        '0c410108',                                  // cmpi.w #$108, d1
        'b66 lookup',
        '302effc6',                                  // move.w -$3a(a6), d0
        '0c400100',                                  // cmpi.w #$100, d0
        'b6d own',
        '48c0e988243c00041d582075280032300804024103ff', // ext.l d0; lsl.l #$4, d0; move.l #$41d58, d2; movea.l (a5, d2.l), a0; move.w $4(a0, d0.l), d1; andi.w #$3ff, d1
        'b60 lookup',
        ':own',
        '206e0008302800080c400100',                  // movea.l $8(a6), a0; move.w $8(a0), d0; cmpi.w #$100, d0
        'b6c lookup',
        '48c0eb8806800004256032350814024103ff',      // ext.l d0; lsl.l #$5, d0; addi.l #$42560, d0; move.w $14(a5, d0.l), d1; andi.w #$3ff, d1
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x1252',
      ],
      'unit-guard': [
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        '2008',                                      // move.l a0, d0
        'b66 store',
        '203c000321fc20750800',                      // move.l #$321fc, d0; movea.l (a5, d0.l), a0
        '0c5700e5',                                  // cmpi.w #$e5, (a7)
        'b66 store',
        '2248',                                      // movea.l a0, a1
        ':loop',
        '4a68000c',                                  // tst.w $c(a0)
        'b67 nf',
        '0c68002e000c',                              // cmpi.w #$2e, $c(a0)
        'b67 store',
        '41e80010',                                  // lea.l $10(a0), a0
        'b60 loop',
        ':nf',
        '2049',                                      // movea.l a1, a0
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x1252',
      ],
      'sleeper-unit+unit-guard': [
        '0c410108',                                  // cmpi.w #$108, d1
        'b66 lookup',
        '302effc6',                                  // move.w -$3a(a6), d0
        '0c400100',                                  // cmpi.w #$100, d0
        'b6d own',
        '48c0e988243c00041d582075280032300804024103ff', // ext.l d0; lsl.l #$4, d0; move.l #$41d58, d2; movea.l (a5, d2.l), a0; move.w $4(a0, d0.l), d1; andi.w #$3ff, d1
        'b60 lookup',
        ':own',
        '206e0008302800080c400100',                  // movea.l $8(a6), a0; move.w $8(a0), d0; cmpi.w #$100, d0
        'b6c lookup',
        '48c0eb8806800004256032350814024103ff',      // ext.l d0; lsl.l #$5, d0; addi.l #$42560, d0; move.w $14(a5, d0.l), d1; andi.w #$3ff, d1
        ':lookup',
        '3f01',                                      // move.w d1, -(a7)
        'bsr.l 0xc',
        '2008',                                      // move.l a0, d0
        'b66 store',
        '203c000321fc20750800',                      // move.l #$321fc, d0; movea.l (a5, d0.l), a0
        '0c5700e5',                                  // cmpi.w #$e5, (a7)
        'b66 store',
        '2248',                                      // movea.l a0, a1
        ':loop',
        '4a68000c',                                  // tst.w $c(a0)
        'b67 nf',
        '0c68002e000c',                              // cmpi.w #$2e, $c(a0)
        'b67 store',
        '41e80010',                                  // lea.l $10(a0), a0
        'b60 loop',
        ':nf',
        '2049',                                      // movea.l a1, a0
        ':store',
        '226e000823480004',                          // movea.l $8(a6), a1; move.l a0, $4(a1)
        'bra.l 0x1252',
      ],
    } },
  ],
  values: [
    { fix: 'hood-size', seg: 1, off: 0x336C, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 1, off: 0x3ACC, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 1, off: 0x4740, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 1, off: 0x493E, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 1, off: 0x4A2A, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 3, off: 0x6EC6, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 3, off: 0x6F14, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 3, off: 0x6F5E, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 3, off: 0x756A, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 3, off: 0x75B8, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 4, off: 0x753A, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 4, off: 0x9468, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 4, off: 0x9998, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0xBF2, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0x11BE, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0x5304, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0x6AC8, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0x6E08, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0xC1D2, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 7, off: 0x1C2C, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 7, off: 0x1D1E, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 7, off: 0x1F6C, was: 0x1045E, now: 0x7ADA0 },
    { fix: 'hood-size', seg: 6, off: 0x7F30, was: 0x10464, now: 0x7ADA6 },
    { fix: 'hood-size', seg: 0, off: 0x0, was: 0x7ADA0, now: 0x82DA8 },
    { fix: 'menu-items', seg: 3, off: 0xA0C4, was: 0x22690, now: 0x82DA8 },
    { fix: 'menu-items', seg: 3, off: 0xA174, was: 0x22690, now: 0x82DA8 },
    { fix: 'menu-items', seg: 3, off: 0xA184, was: 0x22690, now: 0x82DA8 },
    { fix: 'menu-items', seg: 3, off: 0xA194, was: 0x22690, now: 0x82DA8 },
    { fix: 'menu-items', seg: 0, off: 0x0, was: 0x7ADA0, now: 0x830A8 },
  ],
  data0: [
    { fix: 'text-wieldable', at: 0x4CE9, was: '6569', now: '6965' },
    { fix: 'text-yourself', at: 0x5087, was: '91696e6720796f75722073656c66206f766572212e960a00', now: '90696e6720796f757273656c66206f766572212e800a4194' },
    { fix: 'text-compatible', at: 0x98EE, was: '74686973', now: '77697468' },
    { fix: 'text-compatible', at: 0x9A11, was: '74686973', now: '77697468' },
  ],
  played: ['afternoon', 'containers-weight', 'corner-body', 'corpse-light', 'drag-northwest', 'empty-zone-save', 'hood-size', 'hook-corpse', 'hook-load', 'hook-take', 'level-keep-made', 'level-keep-place', 'load-cost', 'menu-items', 'music-revert', 'name-clear', 'option-p', 'option-x', 'roster-pose', 'sleeper-unit', 'spell-glow', 'spot-tune', 'tab-pane', 'target-hunger', 'text-wieldable', 'text-yourself', 'theft-moved', 'unit-guard', 'walk-to', 'weight-contents', 'widget-renumber'],
  built: {
    'afternoon': 'a5c5a679bca703b9537ce76a8ffbb979f6def95dd955ecb76af74594888c2234',
    'ai-import': '0b6af25daf450d9a49038b07ee53254d29167f84921499a36828340d7f224743',
    'books-window': '207b3c02cdf3210a790655b10b292f6af82a2758492771c8b8e1a0d9abc58840',
    'containers-weight': '75a358199feb783bfbc9dc5bfc27a3a330321f6bd0bacb341f4e03f13790c5db',
    'corner-body': '4e6ea0577d046781bffd182dcdfa86ceaa54b5fb1864f7e08eced6cd2b9ec632',
    'corpse-light': 'eabb1d64b7d89e012b003bcf6905312d674f8c067367ffc68a71382ef6be204a',
    'drag-northwest': '240a4b91522a1322be41d61876e36cedfd74373fc29e436b55cf066a2bccee0d',
    'empty-zone-save': '5bb5c4a4b682cff534b3b09d333a20b3ae05b3ec32349dadd83de576bc5b65de',
    'hero-square': 'f33d96b0e59630eccc9ff67dc97a867fec8e861902fb42537174da8f0a22c827',
    'hood-size': '66f222eaf2f68f53d964f4f1a5ab5d18cb03d0f3abaf3704b28e957c81deb716',
    'hook-corpse': '80f6aa5d699c7cc96c1df9b109b3f855143f25d04a55cdeee5bd045c6bbba87e',
    'hook-load': '92bd330546b438b44acdaca5238d0d1101aebd5fcc1bc7f1cd3a136cacf8d0c8',
    'hook-take': '9b327973c69ee28340851b599c55cfa3f783b169a8b1ceea6d7dd4b4df8f08c0',
    'journal-rows': 'e89f900e0ff7a62472aad58d5d752648e0a933265bf62447927131392703db58',
    'level-keep-made': 'a1f289733b4867ab97bd255cfe35388e3001f4c15c248dfeaff4fb4cb2551780',
    'level-keep-place': 'ce22ba42197752bcdc59b9f9846b71f6fa3416716a74b83f2d4c0ffb93da3ac8',
    'load-cost': '3acf3f77d0c6c10de93e8c14f2fdbbbde9ecd7f39fd1a8e8846d0bf9cc2c64aa',
    'menu-items': 'f73a679d7a2eec07a20fe3b5cf2619e3c4f926f673148b00d459bc8a7075e9f6',
    'menu-scroll': '829f52f2fd98bded93a73cc37a16405eedb4efc9c3e9f176d4bbc3b839a221dc',
    'music-lock': '0be1695d786e5c8c2c855aa96421daabb83b59326ae52e03522d8a148e63ffe9',
    'music-revert': '50c306a8f80643d5467290ea5dbbba4a3e362e072cbaffaa144572ae54cbf5a4',
    'name-clear': 'b1d85aad5ad95485b577f08c7e4273371af7b7ff120e0756553d1b2fe0395c42',
    'name-fit': '4cb48e5fb56b289e879d5dcf7a6e1de0c7f246a7ee28174b02f8fa584b0ebc7f',
    'open-during-play': '03047304dc2e787313bd27b1a24fef3e08377f3d9eda0b6bddacca54274fd65f',
    'option-p': '6917f679a8d9fac518babc87c16ab4112df7965b8313222a302109dc376e6225',
    'option-x': 'bed7d91fc213c424f96f8c4a8bdff56831792e71698f8099595ed428d7c65215',
    'right-click': '0ea255ae9bbd6a6245a40cadc2c088d99adb7a6bf4a9abdbe2e985296a2994a6',
    'roster-pose': '1fd70d8d33466cceba59699538e7db789064f06c903d55d1fefdf4c5b502fc0a',
    'sleep-hidden': 'b69b37f742be25cc87c88d5981117fee40767a995763fdd8e5c83eb27ff5b7d1',
    'sleeper-unit': '2e0eb0000a1f94533d056a050d7e72bf6863eb1fd8d2b17a90b04c9bcc871dd6',
    'speech-clear': 'a7b91ddb66d51c5d86f21da10870af5878909ef0da2d0f97b7916bece17b285b',
    'spell-glow': '65733e09cc4bc606b1fbe63aef755b7851da0c05978df73a04a41117315b40d3',
    'spot-tune': 'f4282e54cf9fed23384f888e205776324efba377f6c45d50c367dc7ef9340670',
    'tab-pane': '9c637c959a023318fbb2db00a6ae03a47c03aed66b7e3e28bad2289b39b73bb5',
    'take-window': '829d15a468584f4714bc3c92dda3d476cf20e0be34db4308bdd81ce8db75d3b9',
    'target-hunger': 'b6e0d502d9d61a44191634e73650cee8e140533210d5f9545baf7da233bc6422',
    'text-compatible': '3020070938a03b5a1a27a1ede5f10e502ebb432094815d4ceab36cae1cf442d2',
    'text-wieldable': '579d9ca81882a262dc38d724223ceb38e485b7083bf0182a1a4853ec4773a0ac',
    'text-yourself': 'ab89d20033b11f69c8b3dcaaafc30726301254d008ae0701903cec35b4fd1723',
    'theft-moved': '593eab943081b9864837a36c0e0e1bae343201b0363ae18cd05518209bb0edcd',
    'unit-guard': 'ecc540d620169f849537804e578b8f033f9360602590be9239714494db727fb6',
    'walk-to': 'e9dc95c294c067c41f836ef643962132e0d58e15fa366234b273f7189b25db2c',
    'weight-contents': 'ecb4aef1c7573c069295d4682ffe855ffbea0b5d637661cc1d875619c14dbb20',
    'widget-renumber': '883f64529f1ca5ba83c2f2542c879e1d3ade86c8de6bb60bac16d328bb35e7d6',
    '': '4b6c9fa5d5638020331b449f940fcabfc8c7c194a4c3bfebd541631a6985a828',   // every fix
  },
};
