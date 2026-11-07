/* delv-appfixes.js -- fixes to Cythera's application, as data.

   Every change this project makes to the program itself, one entry a
   change, in the form js/delv-apppatch.js applies and the Patches section
   and `utilities/app_patch.mjs` write out. This is the file to edit: add
   an entry, change a line, drop one, and the applier and its check
   (`utilities/app_patch_check.mjs`) do the rest. Nothing here is the
   program's bytes except the words each site expects to find, which is
   what makes a wrong application, or a wrong address, stop rather than
   patch.

   WHICH PROGRAM. Cythera 1.0.4's PowerPC slice: the PEF container in the
   data fork, which SheepShaver, a real PowerPC Mac and the fork's PowerPC
   route run. The 68K slice, in the resource fork's CODE resources, is not
   touched, so a 68K Mac, and the fork and the player on their default
   route, run none of the code changes. The resource edits (the menu bar,
   the two STR# strings) are read by both slices. The workbench's
   `doc/executable-fixes.md` has the reading behind each entry.

   AN ENTRY.
     id, title   a name that does not change, and one line of what it does
     kind        'fix' (a bug), 'hook' (a call into Cythera Data's scripts,
                 below), 'text' (a misspelling), 'menu', or 'change': not a
                 bug but a different choice of how the game behaves, like
                 the karma patch among the data fixes, so the Patches
                 section and app_patch.mjs leave it out unless it is chosen
     bug         the entry's title in the workbench's bugs.md, where there
                 is one
     needs       [ids]: fixes that must be chosen with this one, because it
                 calls code they change (walk-path and walk-to's
                 FindFirstStep); the applier stops without them
     script      a hook's method and what it is sent, for a script's
                 writer, shown under the fix; the title states what it lets a
                 script do (19 October 2026)
     played      where and how the fix was seen working in the game, the
                 unpatched program beside it showing the bug; with none the
                 Patches section marks the fix "(untested)". The maintainer
                 asked for the mark on 30 September 2026, after a fix that
                 read right and assembled clean hung the game when played.
     sites       [{ at, was: [words], asm: [lines] }]: a code address, the
                 words there now, and one line for each word that replaces
                 them
     cave        [lines]: new code, placed after the end of the code
                 section, which grows to hold it. `name:` on a line of its
                 own is a label; `@cave` in a site is the cave's first word
     data        [{ at, was, now }]: text in the data fork at a data-fork
                 offset; `now` no longer than `was`, the rest NUL
     rsrc        [{ type: 'STR#', id, index, was, now }]: `was` found once in
                 that string (numbered from 1) and replaced by `now`; or
                 [{ type, id, was: [bytes], now: [bytes] }] for a whole
                 resource

   A LINE is written as js/mac-ppc.js prints it (LLVM's spelling, registers
   as bare numbers), with `@0x...` for a code address, `@Name` for a
   routine by its mangled name and `@label` for a label in the entry's
   cave. `beq`, `bne` and the rest stand for the decoder's `bt` and `bf`.
   `;` begins a comment. js/mac-ppc-asm.js lists what else it accepts.

   HOOKS. A hook is a call from the program into the game's scripts,
   so that what happens at that point can be changed by a Magpie patch to
   Cythera Data rather than by another change to the program. Each calls
   `TInterp::DoInterp` with a method number no class table uses (241 up;
   the keys 241 to 251 appear in none) on an object, the way the program
   already calls OnDeath (29) on a dying creature. The object's class
   answers if it defines the method, and failing that the default method
   script, resource 0x3000 plus the number (0x30F1 for 241), which the
   shipped Cythera Data does not have; with no script added the
   interpreter answers None and the program goes on as it did. A character
   is the object 0x4040nnnn (type 0x40, nnnn its character entry), a thing
   0x4000nnnn. None, True and False are the interpreter's words, read
   from the globals `__sinit_THeap_cp` sets (0x5000FFFF, 0x50000001,
   0x50000000; None was written 0x5001FFFF here until 15 October 2026,
   a misreading of `lis 0x5001; addi -1`); a number is any word whose top
   four bits are 0.

   A CAVE IS FAR from the code it serves, more than the 32 KB a
   conditional branch reaches, so a site branches to it unconditionally
   and the test the site made moves into the cave, which leaves by `b`.
   The assembler rejects a branch that cannot reach.

   Each hook's cave makes a separate stack frame for the call, 64 bytes
   with the answer at 56, so no slot of the routine it sits in is
   borrowed, and puts back every register the code after it reads. */

const APP_FIXES_TARGET = {
  name: 'Cythera 1.0.4, PowerPC',
  // The layout the applier grows. Another release, or a copy patched
  // already, differs here or at a site's words, and is rejected.
  codeOffset: 0x3470, codeSize: 0xCD280, dataOffset: 0xD06F0,
};

const APP_FIXES = [
  // ---- In place ------------------------------------------------------------
  { id: 'option-p', kind: 'fix', title: 'Option-p prints the prop record and stops, without toggling regeneration',
    played: 'fork, PowerPC, 30 September 2026: the saved record still has regeneration off',
    bug: 'option-p also toggles regeneration',
    sites: [{ at: 0x4448C, was: [0x60000000], asm: ['b @0x446B4            ; the exit the other cases take'] }] },

  { id: 'drag-northwest', kind: 'fix', title: 'A one-square drag to the north-west slides the thing, as the other seven directions do',
    played: 'fork, PowerPC, 30 September 2026: the paper slides north-west',
    bug: 'A one-square drag to the north-west does nothing',
    sites: [{ at: 0x28838, was: [0x41820064], asm: ['beq @0x28858          ; cursor 22 slides too'] }] },

  { id: 'theft-moved', kind: 'fix', title: 'The theft check catches the hero taking someone else’s stuff after moving it along the ground',
    bug: 'Moving an item before taking it avoids the theft check',
    sites: [
      { at: 0x54FFC, was: [0x540007FF], asm: ['andi. 0, 0, 17        ; free if it was free, or carried'] },
      { at: 0x54258, was: [0x28000000, 0x41820010, 0x881E0000, 0x28000008, 0x40820094],
        asm: ['andi. 0, 0, 223       ; the moved bit aside', 'beq @0x5426C', 'cmplwi 0, 8', 'bne @0x542FC', 'nop'] }] },

  { id: 'weight-contents', kind: 'fix', title: 'The scale and the shops weigh only the item, not the contents of an unrelated character or thing',
    bug: 'The scale gives wrong weights',
    sites: [{ at: 0x958A4, was: [0x4BFC01B5], asm: ['li 3, 0               ; was bl GetCurInvEncumb'] }] },

  // In SaveLevelProps, which writes a zone's list on leaving it and at a
  // save: the records after the 256 characters, up to the last in use,
  // the party's things taken out first on leaving. For a zone with
  // nothing in it, which is Tavara's island without the fortress
  // (zone 37) and no other, that is length 0, and to a segment file a
  // segment of length 0 is one that is not there: TSegFileIterator steps
  // over it, so SaveToFile never copies it into the player's file, and
  // the player's file retains the list it had. A save made on the island
  // puts the carried things in that list; after a save anywhere else the
  // island's list is read from the player's file again, and going back
  // loads the old things beside the ones in hand. Here a list that would
  // be empty is written as one free slot (flags 0xFF, what the routine's
  // own trimming loop treats as unused), 16 bytes, which is copied like
  // any other and replaces what was there.
  { id: 'empty-zone-save', kind: 'fix', title: 'Saving at the clearing of the hidden fortress no longer doubles everything in the hero’s inventory',
    bug: 'Saving and reverting around Tavara\u2019s ring duplicates everything carried',
    played: 'Mac OS 8.5, 11 October 2026, the program with the fix alone and with every fix beside the stock one, the hero given stairs to the fortress and to Land King Hall: a save on the island without the fortress, the hall and a save, the island again, and the save then has 36 carried records on the stock program, the hero\u2019s six things twice, and 18 with the fix alone and with every fix. The board\u2019s route on foot (the island and a save, the ring on, the Stronghold, the ring off and a save, Revert To Saved, out by the west edge and onto the fortress\u2019s square): 34 carried on the stock program, 17 with the fix alone. Fork, PowerPC, 12 October 2026: after the save in the hall the stock program\u2019s save still holds the island\u2019s list with the 18 carried records and the fixed ones\u2019 do not; the step back to the island did not land there, so the doubled count is not shown in the fork. Mac OS 8.5, 12 October 2026, ten rounds of the island, a save, the hall, a save: the stock program stops on the tenth return with "Sorry - there has been a fatal error:Out of space for new props!", 288 carried records after four rounds; the program with the fix alone ends the ten with 18',
    sites: [{ at: 0x6EF8, was: [0x54062036], asm: ['bl @cave               ; was slwi 6, 0, 4: the length, 16 a record'] }],
    cave: ['slwi 6, 0, 4', 'cmpwi 6, 0', 'bnelr', 'li 0, 255             ; the first slot after the characters, marked free',
           'stb 0, 0(5)', 'li 6, 16', 'blr'] },

  { id: 'books-window', kind: 'fix', title: 'Taking a thing out redraws the window of whatever held it',
    played: 'fork, PowerPC, 30 September 2026: a book handed to Selinus from an open pouch leaves its window',
    bug: 'The hero can hand in Sapphire Books in a container again and again',
    sites: [{ at: 0x95344,
      was: [0x7FE3FB78, 0x4BFC0435, 0x60000000, 0x7C630734, 0x7FC00734, 0x7C001800, 0x41800028, 0x7FE3FB78, 0x4BFC0419, 0x60000000, 0x38030000, 0x387D0000,
            0x7FC0F050, 0x4BF72615, 0x60000000, 0x48000024, 0x7FE3FB78, 0x4BFC03F5, 0x60000000, 0x7C9E1850, 0x387F0000, 0x4BFC0275, 0x60000000, 0x3BC00000],
      asm: ['mr 3, 29', 'bl @GetPropParent__Fs', 'sth 3, 56(1)          ; the holder, in a free word of the frame',
            'mr 3, 31', 'bl @GetItemCount__FP8PropItem', 'extsh 28, 3',
            'cmpw 30, 28', 'blt @0x95374',
            'sub 30, 30, 28', 'mr 3, 29', 'bl @DeleteProp__Fs', 'b @0x95384',
            'sub 4, 28, 30', 'mr 3, 31', 'bl @SetItemCount__FP8PropItems', 'li 30, 0',
            'lha 3, 56(1)', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss', 'b @0x953A4',
            'nop', 'nop', 'nop', 'nop'] }] },

  // In cbsetpropowner, TakeItem's handler. It moves the thing whose top
  // holder is the giver (r27) to the receiver (r29) and redraws those two
  // windows, not the container the thing sat in, so an open chest kept
  // drawing a ring handed to Thersites. The holder it leaves is the low
  // halfword of the record's first word, as GetPropParent reads it for
  // every contained state; it is read before the record is rewritten and
  // its window marked first, which is only an invalidation, so the order
  // does not matter. The nop after each call goes (the calls are local, so
  // nothing is restored there) and the reload of the first word is the
  // register already holding it, which makes room for the one call more.
  { id: 'take-window', kind: 'fix', title: 'Moving a thing redraws the window of whatever held it',
    bug: 'A ring handed to Thersites still drawn in an open chest',
    sites: [{ at: 0x94B0C,
      was: [0x80DF0000, 0x7FA40734, 0x807F0000, 0x38000010, 0x54C5021E, 0x7CA42378, 0x5083023E, 0x907F0000, 0x7F63DB78, 0x38800002, 0x981F0000,
            0x4BF9CFF5, 0x60000000, 0x387D0000, 0x38800002, 0x4BF9CFE5, 0x60000000],
      asm: ['lha 3, 2(31)          ; the holder it leaves: a container, or the giver',
            'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss',
            'lwz 6, 0(31)', 'extsh 4, 29', 'li 0, 16', 'rlwinm 5, 6, 0, 8, 15', 'or 4, 5, 4', 'rlwimi 6, 4, 0, 8, 31', 'stw 6, 0(31)', 'stb 0, 0(31)',
            'mr 3, 27              ; the giver, as before', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss',
            'addi 3, 29, 0         ; the receiver, as before', 'li 4, 2', 'bl @Invalidate__16TInventoryWindowFss'] }] },

  // In TActiveMonster::DoMove, behaviour 113, which the destructor gives to
  // every character whose combat target has gone. All three branches (a
  // party member back to following, anyone else to their post or their
  // schedule) end in one tail that sets nutrition to 30 and the timing
  // byte to 32, so a companion was fed whenever its target died or the
  // party left an area mid-fight, and one fed past 30 was cut back. The
  // tail's two middle words swap places, so the timing store has a separate
  // entry, and the party member's branch is taken; the others, and
  // behaviour 146, which enters the tail at its start, are unchanged.
  { id: 'target-hunger', kind: 'fix', title: 'A companion whose target is gone goes back to following, and the game leaves its hunger alone instead of setting it to 30',
    played: 'fork, PowerPC, 30 September 2026: two companions saved at behavior 113 follow again with their food as it was',
    bug: 'Followers\' hunger and poison clear on their own',
    sites: [
      { at: 0x4C464, was: [0x48000058], asm: ['b @0x4C4C8            ; a party member: past the nutrition'] },
      { at: 0x4C4C4, was: [0x38800020, 0x98A6001B], asm: ['stb 5, 27(6)          ; nutrition 30, for the others', 'li 4, 32              ; the party member joins here'] }] },

  // In TCharacterWindow::MouseRoutine. A click below v 272 is on the tab
  // strip, and the pane chosen is h / 73 (the multiply by 0xE070381D and
  // shift by 6 before 0x2F17C), with no test: the window (WIND 132) is 220
  // wide, so h 0 to 218 give the three panes, 0 to 2, and the last column,
  // h 219, gives 3. ChangePane hides every pane's controls, draws nothing
  // for 3, and DrawTabsPart draws no tab for it, so the window goes blank
  // until another tab is clicked: Two Jacks's one pixel at "the upper right
  // (triangle thing) of the bottom right", the Strategy tab's slanted end.
  // The pane is held to 2 now, the tab drawn under that column. The words
  // replaced are the rounding of the division for a negative h, which a
  // click in the window cannot give, and a copy through 152(1), read
  // nowhere else.
  // In TStatusWindow::DrawCharStatus. A living member's figure in the party
  // bar is the tile of the type in their record's appearance word plus
  // element 1 of property 55 of the character, read by GetProperty at
  // 0x34134; a type whose class has no property 55 hands back None
  // (0x5000FFFF), which the shift pair here, a 28-bit sign extension, made
  // -1: the tile before the type's sheet. So Aeneas, the corpse type, was
  // drawn as the golem's last frame, and Omen, type 0, as the 1,024 bytes
  // before the first tile (a shared spreadsheet's "staticy-mist"). A
  // number has its top four bits 0, so its word shifted right 23 is 0 and
  // `slw` leaves it be; None, True and False shift to 160, whose low six
  // bits are 32, and `slw` by 32 or more gives 0: the first frame of the
  // sheet, Aeneas's corpse, and for type 0 the blank tile "Nothing". r0 is
  // free: the clrlwi. before sets cr0 for the branch at 0x34170, and both
  // ways from it write r0 before reading it (workbench GRIMOIRE-NOTES,
  // grimoire/roster-art-fnlojp).
  { id: 'roster-pose', kind: 'fix', title: 'The game draws a party member whose type has no figure frame at its first frame, or blank, instead of the tile before its sheet',
    played: 'fork, PowerPC, 3 October 2026: Aeneas and Omen forced into the party, Aeneas drawn as his corpse and Omen blank, against a golem and static unpatched',
    sites: [{ at: 0x34160, was: [0x54632036, 0x7C632670, 0x7C630734],
      asm: ['srwi 0, 3, 23          ; 0 for a number, 160 for None, True or False', 'slw 3, 3, 0           ; the frame, or 0 when the shift is 32 or more', 'extsh 3, 3'] }] },

  { id: 'tab-pane', kind: 'fix', title: 'A click on the last pixel of a character window’s tabs opens the right-hand tab, instead of blanking the window',
    played: 'fork, PowerPC, 30 September 2026: the last pixel opens Abilities',
    bug: 'Clicking one pixel blanks the status window',
    sites: [{ at: 0x2F17C, was: [0x54030FFE, 0x7C001A14, 0x7C000734, 0xB0010098, 0x7FE3FB78, 0xA8810098],
      asm: ['mr 4, 0               ; the pane, h / 73', 'cmpwi 4, 2', 'ble @0x2F18C', 'li 4, 2               ; h 219, past the third', 'mr 3, 31', 'nop'] }] },

  { id: 'sleep-hidden', kind: 'fix', title: 'A character the game has not yet drawn, moving to a post on the party’s level while time passes quickly, waits there as an egg instead of hiding',
    bug: 'NPCs vanish while the player sleeps',
    sites: [{ at: 0x65F8, was: [0x281C0000, 0x41820018, 0x7F83E378, 0x819C0048, 0x818C0014, 0x480BEADD, 0x80410014, 0x380000FF, 0x981E0000],
      asm: ['li 0, 255', 'clrlwi. 3, 24, 24     ; the post on the party’s level?', 'beq @0x6608', 'li 0, 66', 'stb 0, 0(30)', 'b @0x661C', 'nop', 'nop', 'nop'] }] },

  // In CueCharacters, which a new game and every change of zone run: of the
  // 256 characters, a living one in the zone has its map record drawn (0x42,
  // with its square, look and type) and a living one elsewhere hidden
  // (0xFF). A dead one is passed over and its record left as it was. A
  // character killed in play had it hidden by TActiveMonster::Die (the 0xFF
  // at 0x46CE8). For one never alive, Peirithous (96) and the empty records
  // from 130 up, it is the blank record a new game starts with, flags 0 at
  // (0,0) with type 0: a body in the north-west corner of every zone, named
  // "Nothing" by the blank tile. The dead are hidden now as the living
  // elsewhere are. Record 0 is dead and so was always passed over, and the
  // loop starts at 1 so that it still is (its first byte is a 0x1C another
  // routine writes). No script clears the alive bit. A save has the records
  // it was written with until the party next changes zone.
  { id: 'corner-body', kind: 'fix', title: 'The dead body named “Nothing” is no longer in the north-west corner of every town',
    played: 'fork, PowerPC and 68K, 19 October 2026, alone and with every fix: the world seed, the hero at (200,59) and the right arrow into Odemia, saved; all 127 dead characters’ map records hidden (0xFF), against blank (0) at (0,0) unpatched, and no other record different. From each save, the hero put at (1,1) and a Look at (0,0) (PowerPC): “Look - you see grass.”, against “Look - you see Nothing.” and a character window “Nothing”, Status Dead, Peirithous’s portrait, unpatched',
    bug: '“Nothing”, a dead body in the north-west corner of every town',
    sites: [
      { at: 0x805C, was: [0x3BE00000], asm: ['li 31, 1              ; from character 1'] },
      { at: 0x8088, was: [0x418200C8], asm: ['beq @0x813C           ; dead: hidden'] }] },

  { id: 'gamepad-keys', kind: 'fix', title: 'A gamepad’s Use, Attack, Look and Talk buttons each send a separate key',
    sites: [
      { at: 0xACB70, was: [0x3800004C], asm: ['li 0, 85              ; Use: U'] },
      { at: 0xACBA0, was: [0x38000055], asm: ['li 0, 65              ; Attack: A'] },
      { at: 0xACBD0, was: [0x38000054], asm: ['li 0, 76              ; Look: L'] },
      { at: 0xACC00, was: [0x38000041], asm: ['li 0, 84              ; Talk: T'] }] },

  // The multi-button mouse switch (UI Prefs byte 1 bit 2, which nothing in
  // the game sets; the workbench's cheats.md, *Bit 2 of byte 1*): with it on,
  // TDelverApp::MyGetEvent tests which button went down and adds a modifier
  // to the click, Command for button 2, Control for 3, Option for 4, Shift
  // for 5. A two-button mouse's right button is button 2, and SheepShaver
  // sends a right-click as the second button and a middle click as the third
  // (its SDL front end, ADBMouseDown(1) and (2)), so as shipped a right-click
  // is a Command-click, which nothing in the game answers, and the contextual
  // menu is on the middle button. The two constants swapped put Control, the
  // contextual menu at once, on button 2. Does nothing unless the switch is
  // on in the preferences file (grimoire's Preferences tab, Extra mouse
  // buttons), and nothing where the emulator passes one button only, as
  // Infinite Mac's SheepShaver does; whether Mac OS's mouse driver hands
  // the game a second button at all is untried.
  { id: 'right-click', kind: 'fix', title: 'With Extra mouse buttons on, a right-click opens the contextual menu, as Control-click does, and the middle button clicks with Command',
    sites: [
      { at: 0x12D20, was: [0x60000100], asm: ['ori 0, 0, 4096        ; button 2: Control, the contextual menu'] },
      { at: 0x12D34, was: [0x60001000], asm: ['ori 0, 0, 256         ; button 3: Command'] }] },

  // A menu a script shows (TPickMode, the "Where Is" lists above all) draws
  // its rows 4 pixels apart: DrawTheList offsets each row by the tallest
  // item's height at 28 of the mode plus 4. The code that makes the scroll
  // bar (0x3F9DC on, before its NewControl) counts the rows that fit by the
  // height alone, the box's bottom minus its top of 20 over 20 pixels, so it
  // needs 11 rows to fit where 9 are drawn and sets the bar's maximum two
  // short: the last two entries of any list longer than the box are never
  // shown. That is the board's "the last two" missing from Land King Hall's,
  // Odemia's and Pnyx's lists, Catamarca's 9 of 10, and Cademia's 18 (its 22
  // cut to 20 by menu-items' limit, then two). The count is the height plus
  // 4 now; the top, a constant 20 stored at 72(1), is subtracted as one, so
  // the word that loaded it puts the height into r4, free until
  // NewControl's arguments set it. MouseRoutine divides by the same bare
  // height for a page (0x402C8), so a click in the track moved 10 rows of 9;
  // the plus 4 goes in there too, in place of an extsh of the quotient that
  // a row count cannot need, since the halfword store uses the low half.
  { id: 'menu-scroll', kind: 'fix', title: 'Long lists of dialogue choices (like Where Is\u2026) now scroll to the last entry instead of stopping two short',
    played: 'fork, PowerPC, 30 September 2026: Pnyx’s list reaches Kosha, Cademia’s its last; a page’s length read, not seen',
    bug: '"Where Is" lists stop short',
    sites: [
      { at: 0x3F9DC, was: [0xA81F001C, 0xA8810048, 0xA8630004, 0x833F0014, 0x7C641850],
        asm: ['lha 4, 28(31)         ; a row’s height', 'addi 0, 4, 4          ; and the gap DrawTheList leaves', 'lha 3, 4(3)',
              'lwz 25, 20(31)', 'addi 3, 3, -20        ; minus the top, 20'] },
      { at: 0x402C8, was: [0xA87D001C, 0x7C852050, 0x7C641BD6, 0x7C630734],
        asm: ['lha 3, 28(29)', 'sub 4, 4, 5', 'addi 3, 3, 4          ; the gap', 'divw 3, 4, 3          ; a page'] }] },

  // TCachedSegFiles::RefindSegment, which CompileAIFile calls after it writes
  // an imported combat AI into User Custom Data, freed the cached copy of
  // entry 0 of the segment's page instead of the segment's, and kept the last
  // archive it found the segment in, the oldest, so the scenario's default for
  // user slots 1 to 7 came back. The first site finds the entry before the
  // free; the second stops at the first archive found, the newest, as AddFile
  // orders them (the workbench's bugs.md, Found reading the program's archive
  // code).
  { id: 'ai-import', kind: 'fix', title: 'A combat AI imported in the user behavior editor is used at once, instead of after the game starts again, and replaces the old copy in memory',
    bug: 'A combat AI imported into user slots 1 to 7 is not used until the game is started again, and a recompiled AI can keep its old copy',
    sites: [
      { at: 0x7D9BC,
        was: [0x801B0000, 0x28000000, 0x41820020, 0x807C0000, 0x38A00001, 0x809B0000, 0x4BFFEF7D, 0x60000000,
              0x38000000, 0x901B0000, 0x57C01D78, 0x7F7B0214, 0x38000000, 0x901B0004],
        asm: ['rlwinm 0, 30, 3, 21, 28 ; the entry of this segment', 'add 27, 27, 0', 'lwz 0, 0(27)', 'cmplwi 0, 0',
              'beq @0x7D9EC', 'lwz 3, 0(28)', 'li 5, 1', 'lwz 4, 0(27)', 'bl @0x7C950            ; TCache::Free',
              'nop', 'li 0, 0', 'stw 0, 0(27)', 'li 0, 0', 'stw 0, 4(27)          ; no archive yet'] },
      { at: 0x7DA74,
        was: [0x7FE00734, 0x5403103A, 0x38030004, 0x7C1C002E, 0x901B0004],
        asm: ['slwi 3, 31, 2', 'addi 3, 3, 4', 'lwzx 0, 28, 3', 'stw 0, 4(27)', 'b @0x7DA98            ; the first found, the newest'] }] },

  // SCombatAIEntry::CompileLine built the digits of a weight after `#` in
  // byte 0 of the entry, so the value wrapped at 256: #300 compiled as 44
  // and #356 as 100, and only what was left over 100 gave "Weight higher
  // than 100%" (the workbench's bugs.md, Found reading the combat AI's
  // compiler; seen on Mac OS 8.5). The loop's store is a call to a cave.
  // When the sum, still a full word in r0, passes 100, the cave stores 101
  // instead, every later digit leaves 101 there, and the test after the
  // loop gives the error. The routine saved its return address on entry,
  // so the bl is free.
  { id: 'ai-weight', kind: 'fix', title: 'A combat AI file with a weight over 100 gives an error when imported, instead of compiling with the weight wrapped around (300 as 44)',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, a file with #300 imported in the user behavior editor gave “Weight higher than 100%”, where the stock program compiled it as 44',
    bug: 'An imported combat AI weight over 255 wraps round instead of giving an error',
    sites: [{ at: 0xAE4BC, was: [0x981F0000], asm: ['bl @cave              ; was stb 0, 0(31): the weight so far'] }],
    cave: ['cmplwi 0, 100', 'ble @ok', 'li 0, 101             ; over 100, and stays over', 'ok:', 'stb 0, 0(31)', 'blr'] },

  // SCombatAIEntry::CompileLine counted the modifiers of a chain such as
  // enemy.ByStrongest.ByRange.Pick and gave "Maximum number of modifiers
  // exceeded" at the fourth, though a compiled line has four bytes for
  // them, 4 to 7, the evaluator (CalculateObject) applies four and
  // DecompileObject reads four (bugs.md, as above). The modifier goes into
  // byte 3 plus the count, so a fourth fills byte 7. The test is for a fifth.
  { id: 'ai-mods', kind: 'fix', title: 'A combat AI file may chain four modifiers, as a compiled rule has room for, instead of three',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, a file with enemy.ByStrongest.ByRange.ByDamage.Pick imported in the user behavior editor compiled, and the rule the game wrote has all four modifiers, where the stock program gave “Maximum number of modifiers exceeded”. With status-wrap, a fifth modifier still gave that error',
    bug: 'An imported combat AI file with four modifiers in a chain gives "Maximum number of modifiers exceeded"',
    sites: [{ at: 0xAE72C, was: [0x2C000004], asm: ['cmpwi 0, 5            ; was cmpwi 0, 4, so a fifth modifier is the error'] }] },

  // SCombatAIEntry::CalculateObject's Random and Pick steps choose the
  // highest of a target's mark plus a roll of 0 to 63 or 0 to 15, but cut
  // the running best in r23 to a byte, both where it is stored and where
  // it is compared. A target still marked 255 (next to the creature after
  // ByRange, unhurt after a health ordering) plus any roll above 0 wrapped
  // to a small number, so every later target beat it and the choice was
  // the last one in the monster list (bugs.md, Found by grimoire only).
  // At each of the four sites the full sum, at most 255 + 63, stays in the
  // register, and the signed compare after it already handles that range.
  { id: 'ai-pick', kind: 'fix', title: 'A creature or companion whose combat AI picks among several equally good targets picks one at random, instead of always the last in the list',
    played: 'Mac OS 8.5, PowerPC, 29 October 2026, a ruffian at Attack Nearest hatched beside RULEZ TRADEMARK, Hector and Timon. The stock program swung at Timon in all five runs, once each, and the ruffian then walked off. With the fix it swung at RULEZ TRADEMARK first in five runs and at Hector in one, swung again every turn and turned from one to the other within a run',
    bug: 'A creature or companion choosing among several adjacent or unhurt targets picks the same one each time, by list order',
    sites: [
      { at: 0xAF630, was: [0x56E0063E], asm: ['mr 0, 23              ; was clrlwi 0, 23, 24, the best so far for Random'] },
      { at: 0xAF65C, was: [0x5477063E], asm: ['mr 23, 3              ; was clrlwi 23, 3, 24'] },
      { at: 0xAF6CC, was: [0x56E6063E], asm: ['mr 6, 23              ; was clrlwi 6, 23, 24, the best so far for Pick'] },
      { at: 0xAF6F8, was: [0x54B7063E], asm: ['mr 23, 5              ; was clrlwi 23, 5, 24'] }] },

  // GetToken copied a word of an AI file's line into its caller's buffer
  // with no bound. CompileLine's buffer at 77(1) has 67 bytes before the
  // registers it saved and CompileHeader's at 56(1) 64, so a long word ran
  // over the frame: one of 200 letters in an imported file stopped the Mac
  // with the letters in the program counter (bugs.md, as above). GetToken
  // is a leaf with its return address in the link register, so both sites
  // branch, not call. The first sets r7, free in the routine, to the 64th
  // byte of the buffer. The second moves the copy's pointer on only while
  // it is below r7, so a longer word is cut to 63 characters, the line
  // goes on after it, and the 0 the routine ends with is the 64th byte.
  { id: 'ai-token', kind: 'fix', title: 'A very long word in an imported combat AI file is cut short, instead of crashing the Mac',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, with status-wrap, a file with a word of 200 letters gave “Unknown action” and the game went on, where the stock program stopped the Mac. A file whose first word, in place of NAME, has 200 letters gave “Expecting Script NAME”, where the stock program stopped the Mac the same way',
    bug: 'A very long word in an imported combat AI file crashes the Mac',
    sites: [{ at: 0xADE38, was: [0x38000000], asm: ['b @cave               ; was li 0, 0'] },
            { at: 0xADF54, was: [0x38840001], asm: ['b @next               ; was addi 4, 4, 1'] }],
    cave: ['addi 7, 4, 63         ; the last byte a word may use', 'li 0, 0', 'b @0xADE3C',
           'next:', 'cmplw 4, 7', 'bge @full', 'addi 4, 4, 1', 'full:', 'b @0xADF58'] },

  // TTextOut::SpewText wraps a status message onto new rows with
  // StyledLineBreak. Its textOffset was 1 only on the pass that continues
  // the last row, and 0 on every fresh row. Inside Macintosh gives a
  // nonzero offset as the mark of a line's first run, the case in which a
  // word wider than the line is broken at a character. With 0 such a word
  // broke at offset 0, so the routine added an empty row and tried the
  // same word again, without end: a word of 60 letters in an imported AI
  // file's error line blanked the status pane and stopped the game on
  // Mac OS 8.5, stock and patched alike (bugs.md, Found reading the combat
  // AI's compiler). The offset is 1 on every pass, so a word too wide for
  // a fresh row is split at the last character that fits.
  { id: 'status-wrap', kind: 'fix', title: 'A word too wide for the status pane is split across lines, instead of stopping the game',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, an imported AI file’s error line with a word of 60 letters showed split over two rows, where the stock program blanked the pane and stopped answering',
    bug: 'A status message with a word wider than the pane stops the game',
    sites: [{ at: 0x39964, was: [0x38000000], asm: ['li 0, 1               ; textOffset: the first run on a row'] }] },

  // TInteraction::GetResponse lays the conversation's topics out in rows and
  // cuts the list at the first row that would pass the bottom of the area.
  // The cut comes after the move to that row, so the typing field, which
  // follows the last topic, was placed on the row that does not fit; a
  // field too wide for the last row went to a new row with no test either.
  // Twenty topics filled three rows and put the field on a fourth, under
  // them and against the description below (Mac OS 8.5, 28 October 2026,
  // with fifteen topics added to Alaric's description). Now a field whose
  // row passes the bottom, or that would wrap to such a row, goes where the
  // last topic was and that topic is left out, until the field fits. The
  // routine already leaves out the topics of a row that does not fit.
  // r28 and r24 are the field's left and top, r27 the count of topics, and
  // 126(1) the area (top, left, bottom, right).
  { id: 'conv-field', kind: 'fix', title: 'The conversation’s typing field stays inside the conversation, instead of going under a full list of topics',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, with fifteen topics added to Alaric’s description the field showed on the third row in place of the last two topics, and “job” typed into it had his answer, where the stock program put the field on a fourth row under the area. Alaric’s shipped conversation showed as in the stock program',
    bug: 'With a long list of topics, the typing field is drawn below the conversation area',
    sites: [{ at: 0x3EF2C, was: [0x7EA30734], asm: ['b @cave               ; was extsh 3, 21'] }],
    cave: ['check:', 'add 3, 24, 22         ; the field’s row', 'lha 4, 130(1)', 'cmpw 3, 4', 'bgt @drop',
           'add 3, 28, 21', 'addi 3, 3, 128', 'lha 4, 132(1)', 'cmpw 3, 4', 'ble @done',
           'add 3, 24, 22         ; a new row', 'add 3, 3, 22', 'lha 4, 130(1)', 'cmpw 3, 4', 'ble @wrap',
           'drop:', 'cmpwi 27, 0', 'ble @done',
           'addi 27, 27, -1       ; the last topic left out', 'slwi 3, 27, 3', 'addi 3, 3, 142',
           'lhax 24, 1, 3', 'addi 3, 3, 2', 'lhax 28, 1, 3', 'b @check',
           'wrap:', 'lha 28, 128(1)', 'add 24, 24, 22', 'done:', 'b @0x3EF54'] },

  // TGameViewer::MagicMap, the overload the automap draws with, paints a
  // thing on the map over the squares its picture spans. It sets one extent
  // from the tile flag 0x80, two squares wide, and another from 0x40, two
  // tall, and swaps them for a turned thing. The column loop reads the first
  // at 120(1), and the row loop read the same one, so a wide thing painted a
  // 2-by-2 block and a tall one a single square. The row loop reads the
  // second, at 118(1).
  { id: 'automap-span', kind: 'fix', title: 'Things two squares wide or tall show on the automap in their true shape',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, with two things beside the hero given pictures two squares wide and two squares tall, the automap showed them as 2 by 1 and 1 by 2, where the stock program showed a 2-by-2 block and a single square',
    bug: 'On the automap a thing two squares wide shows as a 2-by-2 block, and one two squares tall as one square',
    sites: [{ at: 0x61084, was: [0xA8010078], asm: ['lha 0, 118(1)         ; was lha 0, 120(1): the rows’ extent'] }] },

  // TTextOut::More puts the "more" button 5 pixels past the end of the last
  // row's text and stops its right edge at the pane's right edge minus 2,
  // cutting it to 32 pixels when there is more room. Nothing tests for a row
  // whose text comes within 37 pixels of the edge, so the button narrows to
  // a sliver, and past the edge its width is negative and it is not drawn at
  // all. The right edge becomes the lesser of left plus 32 and the pane's
  // edge, and the left edge then comes 32 to the left of it, so the button is
  // always 32 wide and against the edge, over the end of the text, when the
  // row is full. 72(1) is the button's rectangle (top, left, bottom, right),
  // and r0 is the pane's edge minus 2.
  { id: 'more-button', kind: 'fix', title: 'The status pane’s "more" button is always full width, instead of narrowing to nothing after a full row',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, with the map’s description cut into twenty pieces that move the row’s end toward the edge a few pixels at a pause, the button stayed 32 pixels wide against the edge and a click on it went on, where the stock program narrowed it to a sliver and then drew none, and the same click did nothing. Pauses with room to spare showed the same pixels in both',
    bug: 'After a row of text that reaches the status pane’s right edge, the "more" button is a sliver or is not drawn at all',
    sites: [{ at: 0x39B8C, was: [0xB001004E, 0xA801004E, 0xA8840002, 0x7C040050, 0x2C000020, 0x40810010, 0xA881004A, 0x38040020, 0xB001004E],
      asm: ['lha 4, 74(1)          ; was sth 0, 78(1): the left edge', 'addi 4, 4, 32', 'cmpw 0, 4', 'ble @0x39BA0',
            'mr 0, 4               ; at most 32 wide', 'sth 0, 78(1)', 'li 4, 32', 'sub 4, 0, 4', 'sth 4, 74(1)          ; and 32 wide'] }] },

  // TCachedSegFiles::RemoveFile skipped an entry of the removed archive that
  // had no cached copy, so opening another saved game during play left it on
  // the freed archive. The branch goes to the clearing instead of past it.
  { id: 'open-during-play', kind: 'fix', title: 'Opening another saved game during play clears every reference to the game it closes, so nothing is read from memory it freed',
    bug: 'Opening another saved game during play leaves the archive table on freed memory',
    sites: [{ at: 0x7DC54, was: [0x41820028], asm: ['beq @0x7DC6C          ; no cached copy: clear the entry all the same'] }] },

  // GetGlobStr, global string 1, the part of the day the scripts' greetings
  // print after "Good ": "night" before 4 and from 22, "morning" before 12,
  // and then "afternoon" below 6, which no hour of 12 to 21 is, so every
  // greeting from noon to ten at night has "evening". The 6 becomes 18 (the
  // workbench's bugs.md, Found reading the program's script callbacks).
  { id: 'afternoon', kind: 'fix', title: 'People say "Good afternoon" from noon to six, instead of "Good evening" all afternoon',
    bug: '"Good afternoon" is never printed',
    played: 'fork, PowerPC and 68K, 24 October 2026, from the pinned save, with sixteen option-t presses to 13:00, a jump to the square south of Laodice in zone 13 and Talk. The stock program has "Good evening, citizen." and the fix alone and every fix "Good afternoon, citizen." At 19:00 the stock program and the fix alone both have "Good evening, citizen." Not played on Mac OS',
    sites: [{ at: 0x93D70, was: [0x2C1F0006], asm: ['cmpwi 31, 18          ; was 6'] }] },

  // GMSIdle, run at every idle, calls GMSTune::Idle to learn whether the spot
  // tune has ended, and then resumes the ambient tune in either case, on the
  // one tune player. So a spot tune is cut off at the next idle, and the
  // ambient tune starts again from where it paused at every idle after (a
  // stutter). No shipped script plays a spot tune (script call 0xD5,
  // cbPlayMusic), so a player meets it only in a mod. With the fix the routine
  // returns while the spot plays, and the ambient tune resumes once the spot
  // has ended (the workbench's bugs.md, Found reading the program's music and
  // list code).
  { id: 'spot-tune', kind: 'fix', title: 'A tune a script plays once, over the zone’s music, plays to its end before the zone’s music comes back',
    bug: 'A spot tune may be cut off by the ambient tune at the next idle',
    played: 'fork, PowerPC and 68K, 24 October 2026, with Cythera Data changed so that zone 13’s entry script plays its tune as a spot tune (script call 0xD5 for 0xD6), and a jump into zone 13 from the pinned save, with the tune trace on. On the stock program the ambient tune is queued over the spot tune one tick after it starts and again at every idle (100,615 times in the 68K run). With the fix alone and with every fix the spot tune plays through, and on PowerPC the ambient tune comes back two ticks after the spot tune’s 159 seconds end. Not played on Mac OS',
    sites: [{ at: 0x1ACC8, was: [0x41820018], asm: ['beq @0x1AD0C          ; the spot still playing, so the ambient tune stays paused'] }] },

  // ---- New code ---------------------------------------------------------------
  { id: 'containers-weight', kind: 'fix', title: 'A thing put in a container someone carries counts against that carrier’s weight too',
    played: 'fork, 68K, 22 October 2026, alone: the hero’s Body set to 1 by an edit, a sack in the pack opened by a double-click and a flatbread dragged from the floor into it; with the fix "There isn’t room." and the bread stays on the floor, against the bread put in the sack unpatched; with the hero’s Body as it was, the fix lets the bread in. The PowerPC half was not played, nor Mac OS',
    bug: 'Containers let the hero carry any weight',
    sites: [{ at: 0x5423C, was: [0x40810018], asm: ['b @cave               ; was ble 0x54254'] }],
    cave: [
      'bgt @fail              ; over the container’s limit',
      'lha 3, 180(1)', 'subf 0, 3, 0          ; the thing and its contents', 'sth 0, 184(1)',
      'mr 3, 28              ; the destination', 'bl @GetPropUltimateParent__Fs', 'extsh. 3, 3', 'beq @ok                ; a character, or held by nobody',
      'cmpwi 3, 256', 'bge @ok                ; held by a thing', 'sth 3, 186(1)',
      'mr 3, 29              ; the thing', 'bl @GetPropUltimateParent__Fs', 'extsh 3, 3', 'lha 4, 186(1)', 'cmpw 3, 4', 'beq @ok                ; already theirs',
      'lha 3, 186(1)', 'bl @GetCurInvEncumb__Fs', 'extsh 3, 3', 'lha 0, 184(1)', 'add 0, 0, 3', 'sth 0, 184(1)',
      'lha 3, 186(1)', 'bl @GetMaxInvEncumb__Fs', 'extsh 3, 3', 'lha 0, 184(1)', 'cmpw 0, 3', 'bgt @fail',
      'ok:', 'b @0x54254', 'fail:', 'b @0x54240             ; the existing rejection'] },

  // In TActiveMonster::~TActiveMonster. A creature that leaves a corpse has
  // its number set to 0 by Die, so that the destructor retains its record as
  // the corpse, and the destructor then called RemoveAllAbility with that
  // 0, which removes every timed effect filed under character 0: the light
  // spells file theirs there, so killing such a creature put the party's
  // light out. Character 0 is nobody, so nothing of a creature's is
  // filed under it; the call is skipped for 0 and made as before otherwise.
  { id: 'corpse-light', kind: 'fix', title: 'Killing a creature that leaves a corpse no longer ends Embrightenment or Daylight',
    played: 'fork, PowerPC, 30 September 2026: a chicken killed with the light on, which the unpatched game put out',
    bug: 'Killing certain creatures ends Embrightenment and Daylight',
    sites: [{ at: 0x464EC, was: [0xA87D0008], asm: ['b @cave               ; was lha 3, 8(29)'] }],
    cave: ['lha 3, 8(29)', 'cmpwi 3, 0', 'beq @skip              ; a corpse’s creature: none under 0',
           'bl @RemoveAllAbility__8TSpellFXFs', 'skip:', 'b @0x464F8'] },

  // TGameSys::WalkToLocation was shipped empty (li 3, 0; blr). Its six
  // callers are TDroppableWindow::MouseRoutine's, on the branch that handles
  // a command chosen from the Commands popup (a click held, or a
  // control-click): a Look, Attack, Use or Take on something out of reach
  // calls it to bring the current character there and acts only if it
  // answers true, and a click on the ground far off calls it and ignores
  // the answer. So a touch spell aimed at someone not beside the caster,
  // and every command clicked on something distant, did nothing. It has
  // one step now and answers false, the game's one click, one turn: each
  // click brings the character a square nearer, and once in reach the
  // command acts as it always did. A touch spell is the exception, played
  // on 30 September 2026: its magic is spent when it is cast, before the
  // target is chosen, and the rejection cancels it, so a click on someone out
  // of reach now steps once and prints [Cancel], where the shipped program
  // printed [Cancel] without the step; the spell is cast again to go on.
  // With the data fix spell-cost-after-target the cancelled cast costs no
  // magic. A held click chasing the target was considered and set aside
  // (the maintainer, 4 October 2026): a held click on a thing already opens
  // the Commands popup (GetGesture's verdict 3), and one click, one step
  // stays.
  // The step is the one the path finder gives: TPathFinder::FindPath from
  // the character at TOC -30356 (whom MoveCommand moves) with no monster,
  // as MouseRoutine calls it, then FindFirstStep for the first square,
  // turned into MoveCommand's direction through the table MouseRoutine
  // turns a click's offset into a cursor with (TOC -3258, five by five,
  // index (dy + 2) * 5 + dx + 2: the ring about the centre is the
  // directions 0 to 7, north clockwise, the centre 9). FindPath answers
  // 32767 when the target is more than 15 squares off or nothing nearer
  // was found, and that answer makes no step.
  // FINDFIRSTSTEP NEVER RETURNED, and the first design, played on 30
  // September 2026, hung the game on the first such click. It walks back
  // from the square FindPath reached to the start, which FindPath marks
  // with the byte -1 (li 4, -1; stb 4, 15(26)), and stops when the byte it
  // reads with lbz and extsb equals 255 (cmpwi 0, 255 at 0x5A9AC): a
  // sign-extended byte never does, so on the start square it walks on for
  // ever. The compare is made against -1. Its one shipped caller, a branch
  // of TActiveMonster::DoMove (0x4CD08), would have hung the same way; the
  // corrected word mends that branch too.
  // THE HOTKEYS. A command armed by its key (U, G, A, T, L; TOC -29912)
  // goes down MouseRoutine's other branch, where Use (0x272CC) and Take
  // (0x27348) out of reach go straight to the branch's end at 0x27378 and
  // no WalkToLocation is called. Each now makes the step there when the
  // click was on a thing (312(1)), to the square the click named (318(1),
  // 316(1), which the branch passes to the Attack of a square), and ends
  // as before, which disarms the command: press the key again to go on.
  { id: 'walk-to', kind: 'fix', title: 'A command clicked on something out of reach makes the hero step toward it, instead of doing nothing, and so does a touch spell, which the game still cancels',
    played: 'fork, PowerPC, 30 September 2026: Use from the popup and by U, Take by G; Paralyze on a student two squares off steps once and cancels, as the unpatched game cancels without the step',
    bug: 'Touch spells only work on someone next to the caster',
    sites: [{ at: 0x50E5C, was: [0x38600000], asm: ['b @cave               ; was li 3, 0 (and blr)'] },
            { at: 0x5A9AC, was: [0x2C0000FF], asm: ['cmpwi 0, -1           ; the start square, as FindPath marks it'] },
            { at: 0x272CC, was: [0x418200AC], asm: ['b @useKey             ; was beq 0x27378'] },
            { at: 0x27348, was: [0x41820030], asm: ['b @takeKey            ; was beq 0x27378'] }],
    cave: ['mflr 0', 'stw 0, 8(1)', 'stwu 1, -80(1)', 'stw 31, 76(1)', 'mr 31, 3              ; the game',
           'mr 7, 4', 'mr 8, 5                ; where to',
           'lwz 3, -30356(2)', 'lha 3, 0(3)           ; the character in control', 'slwi 3, 3, 4',
           'lwz 6, -30268(2)', 'lwz 6, 0(6)', 'add 6, 6, 3           ; its map record',
           'lwz 5, 0(6)', 'rlwinm 5, 5, 8, 0, 12', 'srawi 5, 5, 20        ; x',
           'lha 6, 2(6)', 'rlwinm 6, 6, 20, 0, 12', 'srawi 6, 6, 20        ; y',
           'li 4, 0', 'lwz 3, -30412(2)      ; the path finder',
           'bl @FindPath__11TPathFinderFP14TActiveMonsterssss',
           'extsh 3, 3', 'cmpwi 3, 32767', 'beq @none',
           'lwz 3, -30412(2)', 'addi 4, 1, 56', 'addi 5, 1, 58', 'bl @FindFirstStep__11TPathFinderFRsRs',
           'lha 4, 56(1)', 'lha 5, 58(1)', 'addi 5, 5, 2', 'mulli 5, 5, 5', 'add 4, 4, 5', 'addi 4, 4, 2', 'slwi 4, 4, 1',
           'addi 3, 2, -3258', 'lhax 4, 3, 4          ; the direction', 'cmpwi 4, 7', 'bgt @none',
           'mr 3, 31', 'bl @MoveCommand__8TGameSysFQ28TGameSys10EDirection',
           'none:', 'li 3, 0', 'lwz 31, 76(1)', 'addi 1, 1, 80', 'lwz 0, 8(1)', 'mtlr 0', 'blr',
           'useKey:', 'beq @keyWalk          ; out of reach', 'b @0x272D0',
           'takeKey:', 'beq @keyWalk', 'b @0x2734C',
           'keyWalk:', 'lha 4, 312(1)', 'cmpwi 4, 0', 'beq @keyDone          ; not on a thing',
           'lwz 3, 0(21)', 'lha 4, 318(1)', 'lha 5, 316(1)', 'li 6, 0',
           'bl @WalkToLocation__8TGameSysFssUc',
           'keyDone:', 'b @0x27378'] },

  // With walk-to, a click on a thing out of reach moves the hero one
  // square. walk-path is the other choice, made for the Board's player
  // (ratlizard.github.io's board-native), where a game piece set down on
  // the map presses a command's key and then a single click under the
  // piece. The map stays centered on the hero, so after one step the piece
  // no longer sits over its target, and a second click would name another
  // square. With walk-path, a command armed by its key and clicked on a
  // thing walks the hero there, a turn a step, and then the command acts:
  // - Use (3) and Take (5), when the branch found the thing out of reach
  //   (308(1) is 0), walk until the hero stands beside it, then continue
  //   with 308(1) set, so UseCommand or TakeCommand acts as in the shipped
  //   game. For a thing already in the hero's pack, Take goes to the branch
  //   unchanged, which prints its line.
  // - Talk (2), on a character (TActiveMonster::GetCharacter), walks until
  //   the hero stands beside them, then the talk opens. The shipped game
  //   talks at any distance in sight. A shopkeeper behind a counter, whom no
  //   path reaches, is talked to from the nearest square the path finder
  //   finds.
  // - Attack (1) on a thing attacks first, as the shipped game does, so a
  //   missile weapon or a spell still acts from where the hero stands.
  //   AttackCommand(s) calls the attack script (DoInterp, method 28). When
  //   the answer is not a number and the target is a character, it prints
  //   "It is too far away to attack" (0x55408) and returns without a turn.
  //   In the shipped program it returns nothing: r3 is whatever its last
  //   call left there. Here it returns 1 after that line and 0 otherwise,
  //   and on 1 the hero walks and attacks again. No caller of it reads r3.
  // The walk is XDirection's keyboard step, repeated: SyncTaskMaster, then
  // MoveCommand in the direction walk-to's step finds (FindPath, then
  // FindFirstStep through the cursor table at TOC -3258), then MoveAll,
  // which moves everyone else and draws. It stops beside the target, when
  // FindPath finds nothing nearer (32767), when a step leaves the hero on
  // the same square, when the mouse button is down (ISButton, as the held
  // walk of MouseRoutine reads it, so a tap stops the walk), or after 40
  // steps. FindPath looks no further than 15 squares from the view's
  // center, which ends a long walk before the count does. A fight does not
  // stop it: MoveAll lets every creature act each step, as walking by the
  // keys does, and a tap stops the walk.
  // It needs walk-to's word at 0x5A9AC, without which FindFirstStep never
  // returns, so the applier requires walk-to beside it (needs). With both,
  // walk-to's step at 0x272CC and 0x27348 still runs when the walk ends
  // short of the thing; that step goes nowhere the walk could not reach.
  { id: 'walk-path', kind: 'change', title: 'A command chosen by its key and clicked on something out of reach walks the hero there one step a turn and then acts, instead of taking one step a click',
    needs: ['walk-to'],
    sites: [{ at: 0x2722C, was: [0x80A28B28], asm: ['b @cave               ; was lwz 5, -29912(2)'] },
            { at: 0x55418, was: [0x48000014], asm: ['b @tooFar             ; was b 0x5542C'] },
            { at: 0x5542C, was: [0x800100A8], asm: ['b @attackEnd          ; was lwz 0, 168(1)'] }],
    cave: ['lha 6, 312(1)', 'cmpwi 6, 0', 'beq @back             ; not on a thing, the shipped path',
           'lwz 5, -29912(2)', 'lha 5, 0(5)           ; the command armed',
           'cmpwi 5, 1', 'beq @attack', 'cmpwi 5, 2', 'beq @talk', 'cmpwi 5, 3', 'beq @use', 'cmpwi 5, 5', 'beq @take',
           'b @back',
           'take:', 'lha 3, 312(1)', 'bl @GetPropParent__Fs', 'extsh 3, 3', 'lha 4, 0(22)', 'cmpw 3, 4',
           'beq @back             ; in the hero’s pack already',
           'use:', 'lwz 7, 308(1)', 'cmpwi 7, 0', 'bne @back             ; in reach, the shipped path',
           'lha 3, 318(1)', 'lha 4, 316(1)', 'lwz 5, 4(29)', 'li 6, 0', 'bl @approach',
           'cmpwi 3, 1', 'bne @back             ; no walk ended beside it',
           'li 7, 1', 'stw 7, 308(1)         ; in reach now', 'b @back',
           'talk:', 'lha 3, 312(1)', 'bl @GetCharacter__14TActiveMonsterFs', 'cmpwi 3, 0', 'beq @back',
           'lha 3, 318(1)', 'lha 4, 316(1)', 'lwz 5, 4(29)', 'lha 6, 312(1)', 'bl @approach', 'b @back',
           'attack:', 'lwz 3, 0(21)', 'lha 4, 312(1)', 'bl @AttackCommand__8TGameSysFs',
           'cmpwi 3, 1', 'bne @done              ; attacked, or failed for another reason',
           'lha 3, 318(1)', 'lha 4, 316(1)', 'lwz 5, 4(29)', 'lha 6, 312(1)', 'bl @approach',
           'cmpwi 3, 0', 'beq @done',
           'lwz 3, 0(21)', 'lha 4, 312(1)', 'bl @AttackCommand__8TGameSysFs',
           'done:', 'b @0x27378',
           'back:', 'lwz 5, -29912(2)', 'b @0x27230',
           'tooFar:', 'li 3, 1', 'lwz 0, 168(1)', 'b @0x55430',
           'attackEnd:', 'li 3, 0', 'lwz 0, 168(1)', 'b @0x55430',
           // approach(x, y, port, follow) walks the character in control
           // toward the square and returns 0 if they end away from it, 1 if
           // they walked beside it, 2 if they stood beside it already. With
           // follow a thing's number (Talk and Attack pass the character's),
           // the square is read again from that thing's map record each
           // step, since a person moves while the hero walks. It sets the
           // port back to the window's before it returns.
           'approach:', 'mflr 0', 'stw 0, 8(1)', 'stwu 1, -96(1)', 'stmw 26, 72(1)',
           'mr 30, 3', 'mr 31, 4                ; the target', 'stw 5, 64(1)          ; the window’s port',
           'mr 29, 6                ; the character to follow, or 0', 'li 28, 40              ; steps at most',
           'step:', 'cmpwi 29, 0', 'beq @fixed', 'mr 3, 29', 'bl @squareOf', 'mr 30, 3', 'mr 31, 4',
           'fixed:', 'bl @here', 'mr 26, 3', 'mr 27, 4',
           'subf 5, 30, 3', 'srawi 6, 5, 31', 'xor 5, 5, 6', 'subf 5, 6, 5', 'cmpwi 5, 1', 'bgt @far',
           'subf 5, 31, 4', 'srawi 6, 5, 31', 'xor 5, 5, 6', 'subf 5, 6, 5', 'cmpwi 5, 1', 'bgt @far',
           'li 3, 1', 'cmpwi 28, 40', 'bne @out', 'li 3, 2', 'b @out',
           'far:', 'cmpwi 28, 0', 'beq @stop', 'addi 28, 28, -1',
           'bl @ISButton__Fv', 'clrlwi. 3, 3, 24', 'bne @stop             ; a tap',
           'lwz 3, -30412(2)', 'li 4, 0', 'mr 5, 26', 'mr 6, 27', 'mr 7, 30', 'mr 8, 31',
           'bl @FindPath__11TPathFinderFP14TActiveMonsterssss',
           'extsh 3, 3', 'cmpwi 3, 32767', 'beq @stop',
           'lwz 3, -30412(2)', 'addi 4, 1, 56', 'addi 5, 1, 58', 'bl @FindFirstStep__11TPathFinderFRsRs',
           'lha 4, 56(1)', 'lha 5, 58(1)', 'addi 5, 5, 2', 'mulli 5, 5, 5', 'add 4, 4, 5', 'addi 4, 4, 2', 'slwi 4, 4, 1',
           'addi 3, 2, -3258', 'lhax 4, 3, 4          ; the direction', 'cmplwi 4, 7', 'bgt @stop',
           'sth 4, 60(1)',
           'bl @SyncTaskMaster__11TTaskMasterFv',
           'lwz 3, -30128(2)', 'lwz 3, 0(3)', 'lha 4, 60(1)', 'bl @MoveCommand__8TGameSysFQ28TGameSys10EDirection',
           'bl @MoveAll__14TActiveMonsterFv',
           'bl @here', 'cmpw 3, 26', 'bne @step', 'cmpw 4, 27', 'bne @step',
           'stop:', 'li 3, 0',
           'out:', 'mr 26, 3', 'lwz 3, 64(1)', 'bl @0xC2118           ; SetPort', 'lwz 2, 20(1)', 'mr 3, 26',
           'lmw 26, 72(1)', 'addi 1, 1, 96', 'lwz 0, 8(1)', 'mtlr 0', 'blr',
           // here: the square of the character in control, read as walk-to
           // reads it; squareOf: the square of the thing numbered r3, from
           // the same table (0x271C4 reads a thing's record there too)
           'here:', 'lwz 3, -30356(2)', 'lha 3, 0(3)',
           'squareOf:', 'slwi 3, 3, 4',
           'lwz 6, -30268(2)', 'lwz 6, 0(6)', 'add 6, 6, 3',
           'lwz 3, 0(6)', 'rlwinm 3, 3, 8, 0, 12', 'srawi 3, 3, 20',
           'lha 4, 2(6)', 'rlwinm 4, 4, 20, 0, 12', 'srawi 4, 4, 20', 'blr'] },

  // TJournalList::AppendEntry adds one List Manager row a wrapped line and
  // sets 12 bytes of cell data in it, and the List Manager stores its cell
  // data at 16-bit offsets: "The List Manager cannot maintain lists that
  // occupy more than 32 KB of memory" (More Macintosh Toolbox, page 405 of
  // the PDF), so past about 2,730 rows LSetCell fails and the new lines draw
  // as blank rows, 453's "lots of big empty spaces". Both of AppendEntry's
  // LAddRow calls go through a cave now that, with 2,688 rows or more, first
  // deletes the list's top entry, its header row and every text row under it
  // (the rows whose cell has 255 in its second byte), and moves the row about
  // to be added, and the caller's copy of it at 92(1) (172 from the cave's
  // frame), up by as many. Until 28 October 2026 it deleted one row, which
  // could leave text rows with no header above them, and a click on one made
  // TJournal::MouseRoutine walk up past row 0 looking for its header. A
  // cell's data is at its offset in cellArray (86 of the list, a halfword a
  // cell, the top bit the selection) into the cells handle (80); the count
  // stops at the last row. The cave's arguments go at 56 and up, above the
  // parameter area, since a callee may store its arguments there. The
  // journal file has every entry; only the window
  // shows the newest 2,688 lines. The call replaced was a glue call, after
  // which AppendEntry reloads its TOC from 20(1); for the first LAddRow
  // nothing has stored it there yet, so the cave does, as a glue stub would.
  // Packing a row into fewer bytes was the other design, and only moves the
  // limit.
  { id: 'journal-rows', kind: 'fix', title: 'In a long journal every row in the window is readable and the oldest entries leave it, instead of the oldest rows showing the wrong day, speaker and no text',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, with a save given 1,500 journal notes, about 3,000 rows, the window began at note 157 and every row read right to note 1,500, and a note taken then showed at the end, where the stock program drew its top rows with "Day 0", the cave as the speaker and no text, and its later rows right',
    bug: 'The journal breaks when it gets too long',
    sites: [
      { at: 0x78684, was: [0x4804A4B5], asm: ['bl @cave              ; was bl LAddRow, the entry’s header'] },
      { at: 0x78784, was: [0x4804A3B5], asm: ['bl @cave              ; was bl LAddRow, a line of its text'] }],
    cave: ['stw 2, 20(1)          ; where the caller reloads its TOC from', 'mflr 0', 'stw 0, 8(1)', 'stwu 1, -80(1)',
           'stw 3, 56(1)', 'stw 4, 60(1)', 'stw 5, 64(1)',
           'lwz 6, 0(5)', 'lha 7, 76(6)          ; the rows, dataBounds.bottom', 'cmpwi 7, 2688', 'blt @add',
           'li 8, 1               ; the header row',
           'count:', 'cmpw 8, 7', 'bge @del              ; the last row',
           'slwi 9, 8, 1', 'addi 9, 9, 86', 'lhzx 9, 6, 9          ; the cell’s offset, cellArray', 'andi. 9, 9, 32767',
           'lwz 10, 80(6)', 'lwz 10, 0(10)', 'add 10, 10, 9', 'lbz 10, 1(10)', 'cmpwi 10, 255         ; a text row', 'bne @del',
           'addi 8, 8, 1', 'b @count',
           'del:', 'stw 8, 68(1)', 'mr 3, 8', 'li 4, 0', 'lwz 5, 64(1)', 'bl @0xC2B20            ; LDelRow(n, 0, list): the oldest entry', 'lwz 2, 20(1)',
           'lwz 8, 68(1)', 'lwz 4, 60(1)', 'subf 4, 8, 4', 'stw 4, 60(1)',
           'lha 7, 172(1)         ; the caller’s row', 'subf 7, 8, 7', 'sth 7, 172(1)',
           'add:', 'lwz 3, 56(1)', 'lwz 4, 60(1)', 'lwz 5, 64(1)', 'bl @0xC2B38            ; LAddRow', 'lwz 2, 20(1)',
           'addi 1, 1, 80', 'lwz 0, 8(1)', 'mtlr 0', 'blr'] },

  // TInventoryWindow::CanUseBackingStore makes an 8-bit GWorld the size of
  // the window at +20 the first time a bag or character window draws, and
  // nothing frees it: ~TInventoryWindow and TWindow::~TWindow never call
  // DisposeGWorld, and closing a window deletes the object, so every opening
  // leaks one. On Mac OS 8.5 with the game's 13 MB partition the hero's
  // window opened and closed about 95 times brought "Sorry - out of memory"
  // (bugs.md, 28 October 2026). The destructor's test of this at 0x310E0
  // can never be true there, since the routine has already used this, so
  // its two words call a cave that disposes of the GWorld at +20, when there
  // is one, and clears the field. The cave runs before the TWindow
  // destructor, which reads r0 and r3 again; DisposeGWorld is called at its
  // glue, and the TOC is reloaded from the cave's frame after it.
  { id: 'window-leak', kind: 'fix', title: 'A closed bag or character window frees its drawing buffer, instead of a hundred openings running the game out of memory',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, the hero’s window opened and closed 150 times with no alert, where the stock program ran out of memory near the 95th',
    bug: 'Opening and closing bag or character windows about a hundred times runs the game out of memory',
    sites: [{ at: 0x310E0, was: [0x281E0000, 0x4182001C], asm: ['bl @cave              ; was cmplwi 30, 0, which is never 0 here', 'nop                   ; was bt 2, 0x31100'] }],
    cave: ['mflr 0', 'stw 0, 8(1)', 'stwu 1, -64(1)',
           'lwz 3, 20(30)         ; the backing-store GWorld', 'cmplwi 3, 0', 'beq @none',
           'bl @0xC2F70            ; DisposeGWorld', 'lwz 2, 20(1)', 'li 0, 0', 'stw 0, 20(30)',
           'none:', 'addi 1, 1, 64', 'lwz 0, 8(1)', 'mtlr 0', 'blr'] },

  // Both TActiveMonster constructors store ObjToMonst's answer as the new
  // creature's unit (4 of the object) and nothing checks it; for a prop
  // type with no entry in 0xF008 the answer is null, and the creature's
  // stats, flags, alignment and, at its death, its corpse word are then
  // read from low memory. The scenario gives the two types that happened
  // units ("Cythera Community Fixes", sleeping-units); this is the
  // program's guard, for a scenario without that fix or a type added
  // later: a null unit is the table's first record (TOC -30376, the base
  // ObjToMonst walks), the hero's. ObjToMonst itself still answers null,
  // since HatchEgg and the scripts' Ctor read that as "no unit".
  // A sleeper's unit. The default EveryTurn (0x3020) puts a character
  // in bed into type 264, "person sleeping", in its map record and in the
  // word at 4 of its character record (field 0x24), and leaves the word at
  // 20 (field 0x25) as it was, to put back on waking. A creature is given
  // its unit once, when it is built, from its map record's type, so one
  // built while asleep was given 264's, which the shipped table does not
  // have (the scenario fix sleeping-units gives 264 a copy of the man's,
  // the one unit a table can give every sleeper). Both places a sleeper is
  // built have the real type. A named character (below 256) is built by
  // HatchEgg through the short constructor, and its record's word at 20
  // has its type. A creature from an egg is rebuilt from a saved game
  // by the stream constructor, which has just read its template's number
  // (144 of its frame; the template is the egg's record of what it hatches,
  // and the constructor sets it as the creature's template three words
  // later), and the template's type is the real one; a named character
  // rebuilt from a save has no template (144 of the frame is under 256)
  // and is the number at 8 of the creature, below 256, whose record's word
  // at 20 is read as above. That case was missed at first: played on 30
  // September 2026, Lindus saved asleep in Pnyx and loaded went through the
  // template test to type 264's lookup and died without a body on both
  // programs, while a hatched guard saved asleep was mended. Where the map record
  // has 264, each call of ObjToMonst now requests that type instead, so the
  // sleeper has its corpse, alignment and unit flags (a guard's 0x40,
  // which the swamp reads as immunity to poison). A creature newly hatched
  // was never affected: HatchEgg builds it on a record of the template's
  // type, and the swap comes later. The stream constructor restores the
  // character record, stats and all, from the save, so a sleeper's stats
  // never came from the unit on that path.
  { id: 'sleeper-unit', kind: 'fix', title: 'A character made while asleep has the right unit, so they leave their body, not a man’s or a random thing',
    played: 'fork, PowerPC, 30 September 2026: a sleeping guard and Lindus asleep, loaded from saves and killed, leave their bodies, where the unpatched game left none',
    bug: 'NPCs killed in one hit or asleep turn into other objects',
    sites: [
      { at: 0x44C00, was: [0x4BFFFE61], asm: ['bl @named             ; was bl ObjToMonst'] },
      { at: 0x46090, was: [0x4BFFE9D1], asm: ['bl @loaded            ; was bl ObjToMonst'] }],
    cave: ['named:', 'cmpwi 3, 264', 'bne @lookup', 'extsh 4, 26            ; the character', 'cmpwi 4, 256', 'bge @lookup',
           'lwz 5, -30352(2)', 'slwi 4, 4, 5', 'add 5, 5, 4', 'lhz 3, 20(5)          ; field 0x25, which sleep leaves alone', 'clrlwi 3, 3, 22',
           'lookup:', 'b @ObjToMonst__Fs',
           'loaded:', 'cmpwi 3, 264', 'bne @lookup', 'lha 5, 144(31)         ; the template, read from the save', 'cmpwi 5, 256', 'blt @own',
           'lwz 6, 0(22)', 'slwi 5, 5, 4', 'add 5, 6, 5', 'lhz 3, 4(5)', 'clrlwi 3, 3, 22        ; the template’s type', 'b @ObjToMonst__Fs',
           'own:', 'lha 4, 8(28)           ; no template: the creature’s number', 'cmpwi 4, 256', 'bge @lookup',
           'lwz 5, -30352(2)', 'slwi 4, 4, 5', 'add 5, 5, 4', 'lhz 3, 20(5)          ; a named character’s type', 'clrlwi 3, 3, 22', 'b @ObjToMonst__Fs'] },

  // After both ObjToMonst calls a creature is built from, HatchEgg's
  // (0x44C00) and the stream constructor's (0x46090): a type with no unit
  // answered null and nothing checked, so the creature's stats, side and
  // corpse were read from low memory. In the shipped data that is 264 (the
  // sleeper, which sleeper-unit names properly where it can) and 229, the
  // Odemia night guard's type. A null is now given a unit: for 229 the
  // guard's, found by its key 46 the way ObjToMonst walks the table (16
  // bytes a unit from the base at TOC -30376, the key at 12, a key of 0
  // ending it), and for anything else, or a table without 46, the first
  // unit. Until 30 September 2026 every type took the first, which is the
  // hero's: played that day, the night guards hatched with the hero's
  // stats, the party's side (alignment 2) and the hero's corpse, and the
  // maintainer asked for the guard's. The type is read again from the
  // creature's record in the level's list (r26 and 0(25) at the first
  // site, 8(28) and 0(22) at the second, as the code before each call
  // reads it), in r0 and r12, since r4 is live after the first site. Not
  // with addi on r0: an addi whose source is register 0 adds to the
  // constant 0, which the first build of this did and so read record 0,
  // the night guards keeping the hero's unit until a trace showed r12 at
  // 0x3FF; add and a displacement load take r0 as the register it is.
  { id: 'unit-guard', kind: 'fix', title: 'A creature whose type has no unit gets one (the night guard gets a guard’s), instead of reading its stats and corpse from nowhere',
    played: 'fork, PowerPC, 30 September 2026: Odemia’s night guards hatch with a guard’s stats and side and leave a guard’s body, where they had 1 health and left none',
    bug: 'NPCs killed in one hit or asleep turn into other objects',
    sites: [
      { at: 0x44C08, was: [0x907E0004], asm: ['b @made               ; was stw 3, 4(30)'] },
      { at: 0x46094, was: [0x907C0004], asm: ['b @loaded             ; was stw 3, 4(28)'] }],
    cave: ['made:', 'cmplwi 3, 0', 'bne @made1',
           'extsh 0, 26', 'slwi 0, 0, 4', 'lwz 12, 0(25)', 'add 12, 12, 0', 'lhz 12, 4(12)', 'clrlwi 12, 12, 22     ; the type requested',
           'lwz 3, -30376(2)', 'lwz 3, 0(3)            ; the first unit', 'cmpwi 12, 229', 'bne @made1',
           'made2:', 'lha 0, 12(3)', 'cmpwi 0, 0', 'beq @made3', 'cmpwi 0, 46', 'beq @made1          ; the guard’s', 'addi 3, 3, 16', 'b @made2',
           'made3:', 'lwz 3, -30376(2)', 'lwz 3, 0(3)',
           'made1:', 'stw 3, 4(30)', 'b @0x44C0C',
           'loaded:', 'cmplwi 3, 0', 'bne @loaded1',
           'lha 0, 8(28)', 'slwi 0, 0, 4', 'lwz 12, 0(22)', 'add 12, 12, 0', 'lhz 12, 4(12)', 'clrlwi 12, 12, 22',
           'lwz 3, -30376(2)', 'lwz 3, 0(3)', 'cmpwi 12, 229', 'bne @loaded1',
           'loaded2:', 'lha 0, 12(3)', 'cmpwi 0, 0', 'beq @loaded3', 'cmpwi 0, 46', 'beq @loaded1', 'addi 3, 3, 16', 'b @loaded2',
           'loaded3:', 'lwz 3, -30376(2)', 'lwz 3, 0(3)',
           'loaded1:', 'stw 3, 4(28)', 'b @0x46098'] },

  // cbPickItem, the syscall behind ShowMenu (the "Where Is" lists, and every
  // menu a script shows), fills one static array of twenty 12-byte item
  // drawers, whose address is the TOC slot at -25704, built once through
  // the runtime's array constructor (0xBE3E4, with 12 and 20) behind the
  // guard byte at TOC -25700, and it stops at the twentieth item
  // (cmpwi 0, 20 at 0x96924): Cademia's has 23, of which 22 can show
  // (Pnyx's two, upstairs and down, hold 16 and 15). The menu itself
  // (TPickMode) draws from the vector it is handed until its box is full
  // and scrolls, with no separate count (how many rows its scroll bar
  // needs to fit is menu-scroll's, above). Now the first call allocates
  // 64 drawers (operator new, 0xBE7C8, as the routine's vector does),
  // puts the address in the TOC slot, where every later call reads it, and
  // in r24, and builds them; the guard byte records the capacity (it only had
  // to be nonzero) and the loop's test reads it. If the allocation fails, the
  // program builds the shipped array of 20 unchanged. r25 is free until
  // 0x96AAC sets it.
  { id: 'menu-items', kind: 'fix', title: 'Long lists of dialogue choices (like Where Is\u2026) now show up to 64 entries instead of stopping at 20',
    played: 'fork, PowerPC, 30 September 2026: Antenor offers Cademia’s 21, with menu-scroll',
    bug: '"Where Is" lists stop short',
    sites: [
      { at: 0x968A4, was: [0x80828D9C], asm: ['b @init               ; was lwz 4, -29284(2)'] },
      { at: 0x96924, was: [0x2C000014], asm: ['b @cap                ; was cmpwi 0, 20'] }],
    cave: ['init:', 'li 3, 768              ; 64 drawers of 12 bytes', 'bl @0xBE7C8', 'li 25, 20', 'cmplwi 3, 0', 'beq @build              ; no memory: the shipped array',
           'mr 24, 3', 'stw 3, -25704(2)      ; where every later call finds it', 'li 25, 64',
           'build:', 'lwz 4, -29284(2)', 'mr 3, 24', 'li 5, 0', 'li 6, 12', 'mr 7, 25', 'bl @0xBE3E4',
           'lwz 3, -25700(2)', 'stb 25, 0(3)          ; built, and how many', 'b @0x968CC',
           'cap:', 'lwz 3, -25700(2)', 'lbz 3, 0(3)', 'cmpw 0, 3', 'b @0x96928'] },

  // The neighbourhood (THood) is the list of prop records the game ticks
  // and draws: the whole zone while it has fewer than 1,536 records, and
  // past that a window round the party. It is one static object, a flag
  // byte, three halfwords and 2,048 halfword entries, reached only through
  // the TOC slot at -30392, and AddToHood and ResetHood each throw "Too
  // many objects in the neighborhood." once it has 2,048, which ends the
  // game. Things carried stand on the party's square, so they are always in
  // the window, and a trader's stock of flax bought a bale at a time (flax
  // does not stack) reached it [Theo Nean Donly@t373]. The prop table
  // itself has room for 16,384 records (NewProp throws there), so that is the
  // size given now: the static initialiser requests from NewPtrClear a
  // neighbourhood of 16,384 entries, puts its address in the TOC slot,
  // where every reader loads it from at each use, and marks it in the
  // constructor's unused byte at 1; the two tests read the mark. If the
  // memory is not there the shipped object is built and kept, 2,048 and
  // all. Allocated at startup, before any reader, so the address never
  // changes under a routine holding it in a register. The viewer's
  // list of what to draw stops at 4,096 without a throw (SetStage), so a
  // square piled past that draws some of its things and not others.
  { id: 'hood-size', kind: 'fix', title: 'The list of things near the party has room for every thing in the game, instead of stopping at 2,048',
    played: 'fork, PowerPC, 30 September 2026: 4,000 half disks saved',
    bug: 'Buying about 17,000 oboloi of flax quits the game',
    sites: [
      { at: 0x6CB20, was: [0x4BFFFB1D], asm: ['b @init               ; was bl THood::THood'] },
      { at: 0x6C9E0, was: [0x2C000800], asm: ['b @add                ; was cmpwi 0, 2048'] },
      { at: 0x6C930, was: [0x2C000800], asm: ['b @reset              ; was cmpwi 0, 2048'] }],
    cave: ['init:', 'lis 3, 0', 'ori 3, 3, 32776        ; 8 bytes and 16,384 entries', 'bl @0xC3060            ; NewPtrClear', 'lwz 2, 20(1)',
           'cmplwi 3, 0', 'beq @shipped', 'stw 3, -30392(2)      ; where every reader finds it', 'li 0, 1', 'stb 0, 1(3)            ; the mark',
           'shipped:', 'lwz 3, -30392(2)', 'bl @0x6C63C            ; THood::THood', 'b @0x6CB24',
           'add:', 'mr 3, 31', 'bl @limit', 'b @0x6C9E4',
           'reset:', 'mr 3, 30', 'bl @limit', 'b @0x6C934',
           'limit:', 'lbz 3, 1(3)            ; r0 the count, r3 the neighborhood, free at both', 'cmplwi 3, 0', 'li 3, 2048', 'beq @cmp', 'li 3, 16384',
           'cmp:', 'cmpw 0, 3', 'blr     ; both routines saved LR on entry'] },

  { id: 'widget-renumber', kind: 'fix', title: 'A scripted window’s buttons follow their owner to its new number on a zone change',
    bug: 'The hero has to reopen the strange device after changing zones',
    sites: [{ at: 0x87B94, was: [0x4E800020], asm: ['b @cave               ; was a bare blr'] }],
    cave: ['lwz 6, 4(3)           ; the owner copy', 'clrlwi 7, 6, 16', 'cmpw 7, 4             ; the old number', 'bnelr',
           'rlwimi 6, 5, 0, 16, 31 ; the new one', 'stw 6, 4(3)', 'blr'] },

  { id: 'music-revert', kind: 'fix', title: 'The music comes back after a revert, an Open or a Save As',
    bug: 'Music stops after a revert, and MIDI gets corrupted in long play',
    sites: [
      { at: 0x1AB84, was: [0x38000001], asm: ['b @keep               ; was li 0, 1'] },
      { at: 0x1ABA4, was: [0x41820094], asm: ['b @same               ; was beq 0x1AC38'] }],
    cave: ['keep:', 'lbz 26, 0(3)          ; playing before this call?', 'li 0, 1', 'b @0x1AB88',
           'same:', 'bne @make              ; another tune: as before', 'cmpwi 26, 0', 'beq @make              ; stopped: make it again and play',
           'b @0x1AC38            ; the same tune, playing: as before', 'make:', 'b @0x1ABA8'] },

  // The tune a zone starts is cache data, a relocatable block, and
  // GMSPlayAmbient is handed a pointer into it and locks it last: after it
  // has unlocked the old tune's data, stopped the old tune through three
  // QuickTime calls, freed its object and allocated the new one. Any of
  // those can move an unlocked block, and then the new tune is queued from
  // where its data was, memory the heap goes on to reuse while QuickTime
  // plays from it. TAudio::PlayMusic, the one caller, leaves the data locked
  // across the call instead: the lock is counted, so GMSPlayAmbient's
  // lock and every path through it, music-revert's too, are unchanged.
  // Read, not reproduced (no moved block was forced): the board's "wrong instruments, distorted timing"
  // after long play fits it and nothing here shows it is the cause.
  { id: 'music-lock', kind: 'fix', title: 'The game holds the music a zone starts in place before it lets the old tune go, so it never plays music from memory that has moved',
    bug: 'Music stops after a revert, and MIDI gets corrupted in long play',
    sites: [{ at: 0x1BBE4, was: [0x4BFFEF75], asm: ['b @hold               ; was bl GMSPlayAmbient'] }],
    cave: ['hold:', 'lwz 3, -30396(2)      ; the cache, as GMSPlayAmbient finds it', 'lwz 3, 0(3)', 'lwz 3, 0(3)', 'mr 4, 31              ; the tune\'s data',
           'bl @0x7CAA0            ; TCache::Lock', 'mr 3, 31', 'bl @0x1AB58            ; GMSPlayAmbient',
           'lwz 3, -30396(2)', 'lwz 3, 0(3)', 'lwz 3, 0(3)', 'mr 4, 31', 'bl @0x7CB28            ; TCache::Unlock', 'b @0x1BBE8'] },

  // TViewer::SetStage empties the creature grid and fills it again from the
  // neighborhood on every turn and redraw. Its two stores (0x65A18, four cells
  // of the finer grid, and 0x65B40, the square) write over the cell's old
  // value, so the creature later in the list ends up in the square. The first
  // form of this fix changed only SetMonstStage, the store of a single step,
  // which the next SetStage undid; on 68K it was played three times and never
  // showed (cross-check of 28 October 2026). The two SetStage stores now pass
  // over a cell with the player's creature in it.
  { id: 'hero-square', kind: 'fix', title: 'The hero stays in its square of the creature grid when a follower stands on it, so a press there picks up the hero',
    played: 'Mac OS 8.5, PowerPC, 28 October 2026, from RULEZ TRADEMARK with Hector set to wait and the hero walked onto his square, Look there gave “you see RULEZ TRADEMARK” and a press dragged east walked the hero, where the stock program gave “you see Hector” and the drag moved nobody. With the hero elsewhere both gave Hector',
    bug: 'The player cannot drag the hero onto a follower\'s square',
    sites: [
      { at: 0x6B14C, was: [0x40820008], asm: ['b @one                ; was bne 0x6B154'] },
      { at: 0x6B020, was: [0x40820010], asm: ['b @four               ; was bne 0x6B030'] },
      { at: 0x65A18, was: [0x7FBC1B2E], asm: ['b @stage4             ; was sthx 29, 28, 3'] },
      { at: 0x65B40, was: [0xB3A40000], asm: ['b @stage1             ; was sth 29, 0(4)'] }],
    cave: ['one:', 'beq @take1             ; empty: as before', 'lwz 5, -30356(2)      ; the player', 'lha 5, 0(5)', 'cmpw 4, 5', 'bne @done1',
           'take1:', 'sth 4, 0(23)', 'done1:', 'b @0x6B154',
           'four:', 'beq @take4', 'lwz 5, -30356(2)', 'lha 5, 0(5)', 'cmpw 4, 5', 'bne @done4',
           'take4:', 'extsh 0, 31', 'slwi 0, 0, 1', 'sthx 4, 30, 0', 'done4:', 'b @0x6B030',
           'stage4:', 'add 4, 28, 3          ; the cell', 'lha 0, 0(4)', 'lwz 3, -30356(2)      ; the player', 'lha 3, 0(3)', 'cmpw 0, 3',
           'beq @kept4            ; the player\'s: left as it is', 'sth 29, 0(4)', 'kept4:', 'b @0x65A1C',
           'stage1:', 'lha 0, 0(4)', 'lwz 3, -30356(2)', 'lha 3, 0(3)', 'cmpw 0, 3', 'beq @kept1', 'sth 29, 0(4)', 'kept1:', 'b @0x65B44'] },

  { id: 'spell-glow', kind: 'fix', title: 'The game draws a creature’s spell glow on the creature, not on an unrelated thing that shares its number',
    bug: 'A lich\'s spell glow and lightning come out of a chair',
    sites: [{ at: 0x99750, was: [0x7C640734], asm: ['b @cave               ; was extsh 4, 3'] }],
    cave: ['extsh 4, 3', 'rlwinm 3, 3, 16, 24, 31 ; the reference\'s type', 'cmpwi 3, 64', 'bne @as', 'cmpwi 4, 256', 'bge @creature',
           'as:', 'b @0x99754            ; a thing, or a character: its number is its record',
           'creature:', 'stw 0, 56(1)', 'stw 4, 60(1)', 'lwz 3, -30352(2)      ; the character table', 'slwi 4, 4, 5', 'add 3, 3, 4',
           'bl @GetCharacter__14TActiveMonsterFP9CharEntry', 'lwz 4, 60(1)', 'cmplwi 3, 0', 'beq @back',
           'lwz 4, 16(3)          ; its map record', 'lwz 5, -30268(2)', 'lwz 5, 0(5)           ; the prop table', 'sub 4, 4, 5', 'srawi 4, 4, 4',
           'back:', 'lwz 0, 56(1)', 'lwz 5, -30408(2)', 'li 6, 1', 'b @0x99754'] },

  // In TConversation::ShowPortrait. The name is in the frame at 56(1); r28 is
  // the portrait's GWorld, the current port, whose txSize is the halfword at
  // 74; r23 is dead once the routine has set its port, and stores the size to
  // put back. The imports are called at their glue: TextWidth 0xC2AC0,
  // TextSize 0xC35B8, CharExtra 0xC3630; 0xB6CE8 is strlen. The limit is 90
  // pixels: a name centred on x 64 then ends by 110 with its outline, short
  // of the clears from 111 (name-clear) and 112 (speech-clear). It was 104
  // until 21 October 2026, which reached 116 and lost its end to both, and
  // to the shipped clears.
  { id: 'name-fit', kind: 'fix', title: 'A long name under a conversation portrait shrinks until it fits, instead of squeezing until its letters overlap',
    bug: 'A long name under a conversation portrait squeezes until its letters overlap',
    sites: [
      { at: 0x3DE90, was: [0x38800054, 0x4BFFDAA1], asm: ['b @fit                ; was li 4, 84', 'nop                   ; was bl FitText'] },
      { at: 0x3DF68, was: [0x38600000, 0x480856C5, 0x80410014], asm: ['b @restore            ; was li 3, 0', 'nop                   ; was bl CharExtra', 'nop                   ; was lwz 2, 20(1)'] }],
    cave: ['fit:', 'lha 23, 74(28)        ; the size, to put back after',
           'measure:', 'addi 3, 1, 56', 'bl @0xB6CE8', 'mr 5, 3', 'addi 3, 1, 56', 'li 4, 0', 'bl @0xC2AC0', 'lwz 2, 20(1)',
           'extsh 3, 3', 'cmpwi 3, 90', 'ble @fits               ; ends by x 110, clear of every clear and the speech',
           'lha 3, 74(28)', 'cmpwi 3, 9', 'ble @squeeze', 'addi 3, 3, -1', 'bl @0xC35B8', 'lwz 2, 20(1)', 'b @measure',
           'squeeze:', 'addi 3, 1, 56', 'li 4, 90', 'bl @FitText__FPCcs    ; at 9 points and still too wide: the shipped squeeze',
           'fits:', 'b @0x3DE98',
           'restore:', 'li 3, 0', 'bl @0xC3630', 'lwz 2, 20(1)', 'mr 3, 23', 'bl @0xC35B8', 'lwz 2, 20(1)', 'b @0x3DF74'] },

  // In TConversation::WriteJournal, the click that writes a line of the
  // conversation to the journal. A spoken line (this+82, NUL put at its
  // length, 1106(30)) goes to TJournal::SaidToJournal with its speaker, and
  // the description under it (this+1108, its length at 2132(30)) to
  // AddToJournal; both hand the text to MakeEntry, which writes it to the
  // journal's pages as it is. In a conversation "@" marks the next word to
  // be drawn highlighted (TTextContext's constructor tests for it, as
  // TTextOut::LDEFDraw does in the message pane), and TJournalList::LDEFDraw
  // has no such test, so the "@" is still in a journaled line: "the famous
  // bard @Demodocus", Bryaxis's line in the 2013 MyshPlays video (workbench
  // doc/mysh-2013-video.md). Each call goes through the cave now, which
  // copies the text into a frame of the cave without the "@"s (1,040 bytes;
  // either text is at most 1,024 before its NUL) and makes the same call on
  // the copy. The conversation's text is not changed, so it still draws
  // highlighted, and a note the player types (MakeNote) is not touched.
  { id: 'journal-at', kind: 'fix', title: 'A line written to the journal no longer shows the “@” that highlights a word in conversation',
    bug: 'The journal shows the “@” that marks a highlighted word',
    sites: [
      { at: 0x3C7E0, was: [0x4803CC61], asm: ['bl @spoken            ; was bl SaidToJournal'] },
      { at: 0x3C800, was: [0x4803CBE1], asm: ['bl @plain             ; was bl AddToJournal'] }],
    cave: ['spoken:', 'mflr 0', 'stw 0, 8(1)', 'stwu 1, -1104(1)', 'addi 6, 1, 64', 'bl @strip             ; r4, the text, to 64(1)',
           'addi 4, 1, 64', 'bl @SaidToJournal__8TJournalFsPc', 'lwz 0, 1112(1)', 'addi 1, 1, 1104', 'mtlr 0', 'blr',
           'plain:', 'mflr 0', 'stw 0, 8(1)', 'stwu 1, -1104(1)', 'mr 4, 3', 'addi 6, 1, 64', 'bl @strip',
           'addi 3, 1, 64', 'bl @AddToJournal__8TJournalFPc', 'lwz 0, 1112(1)', 'addi 1, 1, 1104', 'mtlr 0', 'blr',
           'strip:', 'lbz 7, 0(4)', 'addi 4, 4, 1', 'cmpwi 7, 64            ; "@"', 'beq @strip', 'stb 7, 0(6)', 'addi 6, 6, 1',
           'cmpwi 7, 0', 'bne @strip', 'blr'] },

  // In TConversation::ShowTalking. The speech is cleared by copying the
  // background over one rectangle, SetRect(103, 12, 488, 276) offset 12
  // across, and the same rectangle, copied to 2136(31) with its bottom set
  // to 80, is the box the text is laid out in from its left edge at 115.
  // Argos's P, R, j, Y and g draw up to a twelfth of an em left of the pen,
  // 1.9 pixels for P in the speech's 22 points (TxSt 134), so a line that
  // began with one left that sliver of ink outside the next clear (seen in
  // the Spanish on 29 September 2026; the English does it too). The clear
  // now starts three pixels further left, at 112, a pixel to spare. The
  // names under the portraits lie inside the same rectangle: fitted to 84
  // pixels about x 64 they end by 107 with their outline, and at the 90
  // pixels the name-fit fix allows, by 110, so neither is reached. (The
  // fix allowed 104 until 21 October 2026, which this clear and the
  // shipped one from 115 both cut.) The copy to 2136(31) is written as the
  // constants it always
  // was (top 12, left 115, bottom 80, right 500) in the same eight words,
  // so the text stays in place; r3 and r4 are the OffsetRect arguments
  // that follow, and r5 and r6 were only the copy's.
  { id: 'speech-clear', kind: 'fix', title: 'The conversation box clears the ink a line’s first letter draws left of the text',
    bug: 'A sliver of a letter stays at the start of a line in the conversation box',
    sites: [
      { at: 0x3D56C, was: [0x38800067], asm: ['li 4, 100             ; was 103: the clear from 112, once offset'] },
      { at: 0x3D5C8, was: [0x80C1004C, 0x38000050, 0x80A10050, 0x387F0858, 0x38800000, 0x90DF0858, 0x90BF085C, 0xB01F085C],
        asm: ['lis 0, 12              ; top 12', 'ori 0, 0, 115          ; left 115, where the text has always begun', 'stw 0, 2136(31)',
              'lis 0, 80              ; bottom 80', 'ori 0, 0, 500          ; right 500', 'stw 0, 2140(31)',
              'addi 3, 31, 2136       ; OffsetRect(2136(31), 0, ...), as before', 'li 4, 0'] }] },

  // In TConversation::GetWorkRect and ShowTalking. ShowPortrait clears the
  // band under a portrait from x 12 to 116 before it draws a name there, so
  // that is the name's column. The conversation's work area, where a menu,
  // a count or a field is laid out while it is open, is the window from
  // x 104 (GetWorkRect, which TInteraction::GetWorkRect reaches through the
  // vtable), and ShowTalking, with no speech to show (1106(31) zero), copies
  // the background over (103, 0, 536, 276) with no offset, which crosses
  // every name's band. A name wider than about 78 pixels lost its end there
  // until the conversation was drawn again: the hero's "Bellerophon" read
  // "Bellerophor" from a training menu or a line of narration on (the 2019
  // livestream, the 2025 StormThalion video, and the 68K fork from the
  // kit's cp1-intro-done, Hadrian's training). A menu's items begin at 105,
  // so the clear cannot just start further right and leave the work area
  // where it was: the work area's left edge moves to 113 and the clear to
  // 111, three pixels short of it for the ink a swash letter draws left of
  // the pen, as speech-clear leaves. A name fitted to 84 pixels ends by 107
  // with its outline, and one of name-fit's 90 by 110.
  { id: 'name-clear', kind: 'fix', title: 'A long name under a conversation portrait stays whole when a menu or a line of narration appears, instead of being cut short',
    bug: 'The end of a long name under a conversation portrait is cut off when a menu or a line of narration appears',
    sites: [
      { at: 0x3C988, was: [0x38000068], asm: ['li 0, 113             ; was 104: the work area\'s left edge'] },
      { at: 0x3D714, was: [0x38800067], asm: ['li 4, 111             ; was 103: the clear with no speech, from 111'] }] },

  // ---- Hooks ----------------------------------------------------------------
  { id: 'hook-take', kind: 'hook', method: 241, title: 'Scripts can refuse a thing being moved somewhere, or let it in without weighing it',
    script: 'Method 241, sent to where a thing is going, with the thing, before the game weighs it: False refuses the move, True lets it in unweighed',
    sites: [{ at: 0x541EC, was: [0x5740063F], asm: ['b @cave               ; was clrlwi. 0, 26, 24'] }],
    cave: [
      'extsh. 5, 28', 'ble @none             ; nowhere to call', 'stwu 1, -64(1)', 'cmpwi 5, 256', 'bge @prop', 'oris 5, 5, 16448      ; a character, 0x4040', 'b @thing',
      'prop:', 'oris 5, 5, 16384      ; a thing, 0x4000', 'thing:', 'extsh 6, 29', 'oris 6, 6, 16384',
      'addi 3, 1, 56', 'li 4, 241', 'bl @DoInterp__7TInterpFs5VAddr5VAddr',
      'lwz 0, 56(1)', 'addi 1, 1, 64',
      'lwz 3, -30416(2)', 'lwz 3, 0(3)', 'cmpw 0, 3', 'beq @none              ; None: as before',
      'lwz 3, -29712(2)', 'lwz 3, 0(3)', 'cmpw 0, 3', 'bne @taken',
      'b @0x54578            ; False: rejected',
      'taken:', 'b @0x54254            ; anything else: taken, unweighed',
      'none:', 'clrlwi. 0, 26, 24', 'b @0x541F0'] },

  { id: 'hook-corpse', kind: 'hook', method: 242, title: 'Scripts can choose the corpse a creature or character leaves, or leave none',
    script: 'Method 242, sent to the one dying: a number returned is its corpse’s type and aspect word, 0 for none',
    sites: [{ at: 0x46B70, was: [0x807F0004], asm: ['b @cave               ; was lwz 3, 4(31)'] }],
    cave: [
      'lhz 5, 80(1)          ; its character entry, as Die stores it', 'stwu 1, -64(1)', 'oris 5, 5, 16448',
      'addi 3, 1, 56', 'li 4, 242', 'bl @DoInterp__7TInterpFs5VAddr', 'lwz 0, 56(1)', 'addi 1, 1, 64',
      'lwz 3, 4(31)          ; the unit, as NewProp is handed it', 'srwi. 4, 0, 28', 'beq @number', 'b @0x46B74            ; not a number: the unit’s default',
      'number:', 'sth 0, 130(1)', 'b @0x46B7C'] },

  { id: 'hook-load', kind: 'hook', method: 243, title: 'Scripts can act each time the player begins, opens or reverts to a game',
    script: 'Method 243, sent to the hero',
    played: 'fork, PowerPC, 28 September 2026: a 0x30F3 script set a flag',
    sites: [{ at: 0x14654, was: [0x80010068], asm: ['b @cave               ; was lwz 0, 104(1)'] }],
    cave: [
      'stwu 1, -64(1)', 'stw 3, 60(1)          ; OpenPlayerFile returns what BeginPlay leaves',
      'lwz 5, -30356(2)', 'lha 5, 0(5)', 'oris 5, 5, 16448',
      'addi 3, 1, 56', 'li 4, 243', 'bl @DoInterp__7TInterpFs5VAddr',
      'lwz 3, 60(1)', 'addi 1, 1, 64', 'lwz 0, 104(1)', 'b @0x14658'] },

  // ---- Text and menus -------------------------------------------------------------
  { id: 'text-wieldable', kind: 'text', title: '"weildable" [sic] reads "wieldable"',
    played: 'fork, PowerPC, 30 September 2026: the drag verdict',
    data: [{ at: 0xC953C, was: '(Not weildable)', now: '(Not wieldable)' }] },
  { id: 'text-yourself', kind: 'text', title: '"your self" [sic] reads "yourself"',
    played: 'fork, PowerPC, 30 September 2026: Attack on the hero',
    data: [{ at: 0xC9FF8, was: 'It isn\'t worth killing your self over...\n', now: 'It isn\'t worth killing yourself over...\n' }] },
  { id: 'text-monitor', kind: 'text', title: '"currently monitor" [sic] reads "monitor currently"',
    data: [{ at: 0xC8901, was: 'No suitable currently monitor available', now: 'No suitable monitor currently available' }] },
  { id: 'text-compatible', kind: 'text', title: '"not compatible this scenario" [sic] reads "not compatible with scenario"',
    data: [{ at: 0xC8B9D, was: 'This patch is not compatible this scenario', now: 'This patch is not compatible with scenario' },
           { at: 0xC8C57, was: 'This player is not compatible this scenario', now: 'This player is not compatible with scenario' }] },
  { id: 'text-berserk', kind: 'text', title: 'The strategy "Beserk" [sic] reads "Berserk"',
    played: 'fork, PowerPC, 30 September 2026: a companion’s Strategy tab',
    bug: '"Beserker" [sic] and "Beserk" [sic]',
    rsrc: [{ type: 'STR#', id: 502, index: 4, was: 'Beserk', now: 'Berserk' }] },
  { id: 'text-celestial', kind: 'text', title: '"celstial" [sic] reads "celestial" in the landscape strip’s balloon help',
    rsrc: [{ type: 'STR#', id: 503, index: 5, was: 'celstial', now: 'celestial' }] },
  { id: 'menus', kind: 'menu', title: 'The Audio and Preferences menus in the menu bar, and with them the frame-rate limit',
    played: 'fork, PowerPC, 30 September 2026: both menus, a choice saved',
    bug: 'Hidden menus',
    rsrc: [{ type: 'MBAR', id: 128, was: [0x00, 0x02, 0x00, 0x80, 0x00, 0x81], now: [0x00, 0x04, 0x00, 0x80, 0x00, 0x81, 0x00, 0x83, 0x00, 0x88] }] },

  // ---- Design changes ------------------------------------------------------
  // Not bugs: each makes the game behave otherwise than it was made to, the
  // maintainer's call to offer, and is off unless chosen.

  // Entering a level tidies it (1 October 2026), and these two turn the
  // tidying's halves off, each alone or both. THE SHIPPED RULE:
  // LoadLevelProps, given a level's list from a save or a patch and its
  // third argument set (TGameViewer::GoToLocation, entering a level in play,
  // and TDelverApp::NewModel, a new game), streams Cythera Data's list
  // beside it. A record flagged 0x20, made or moved in play (a corpse, what
  // an egg hatched, a thing dropped or slid that is not of a carried class),
  // is overwritten whole by the scenario's record at that index when that is
  // a thing of the same type on the map; a door of the six ClassFlags 0x200
  // classes whose aspect differs from the scenario's has its method 0 run,
  // which restores the scenario's aspect. Then ChainFreeProps, with the same
  // argument, DELETES every record still flagged 0x20 (flags 0xFF, its
  // storage released by THeapObj::DecRef). So a level entered is set back
  // (doors, things the level began with) and cleared (everything else play
  // left there). cythera-workbench's doc/executable-fixes.md has the
  // reading and the runs.
  //
  // WHY THE FIRST DOES NOT SIMPLY SKIP THE STREAM. Skipping it leaves the
  // moved things flagged, and ChainFreeProps then deletes them: a chair slid
  // a square vanished on entering the level in the run that tried it. So
  // where the scenario would overwrite a flagged record, the first clears
  // its 0x20 instead, which leaves it where it is and no longer play's to
  // clear; and it never goes down the door path, branching to the Seek that
  // stays in step with the stream. The second branches past ChainFreeProps's
  // deletion, so what is still flagged stays, flag and all.
  { id: 'level-keep-place', kind: 'change', title: 'Entering a level leaves its doors, and the things it began with that moved in play, as the hero left them, instead of setting them back',
    played: 'fork, PowerPC, 1 October 2026: jumping into Land King Hall, a door left open stays open and a slid chair stays where it was; a rock made in play is still removed, as on the stock program, which also shuts the door and puts the chair back',
    sites: [
      { at: 0x7588, was: [0x80610060, 0x80010064, 0x907F0000, 0x901F0004, 0x80610068, 0x8001006C, 0x907F0008, 0x901F000C],
        asm: ['lbz 3, 0(31)', 'andi. 3, 3, 223       ; clear the moved-in-play flag instead of the copy', 'stb 3, 0(31)',
              'nop', 'nop', 'nop', 'nop', 'nop'] },
      { at: 0x75B4, was: [0x408200D4], asm: ['b @0x7688             ; never the door path: skip its record in the stream'] }] },
  { id: 'level-keep-made', kind: 'change', title: 'Entering a level leaves in place what play made or left there, corpses among them, instead of removing what the level did not begin with',
    played: 'fork, PowerPC, 1 October 2026: jumping into Land King Hall, a rock made in play stays where the stock program removes it; the patched program sets the door and the slid chair back, as the stock one does',
    sites: [{ at: 0x788C, was: [0x41820038], asm: ['b @0x78C4             ; never delete what play made or moved'] }] },
  // A thing the story needs can be lost by setting it down. TGameSys::
  // DropCommand and SlideItemCommand both end by flagging the thing 0x20,
  // made or moved in play, unless its class's cached flags have 0x08
  // (ClassFlags 8: the glowing crystals, keys, the strange staff, the
  // panpipes, the grimoire, the amulet, the map). A thing flagged 0x20 is
  // overwritten by the scenario's record or deleted when its level is
  // entered again (LoadLevelProps, ChainFreeProps, above), and in Cademia
  // deleted by THood::ResetHood once the hero is more than 32 squares from
  // it. So kelp dropped on a beach, or a Sapphire Book set down to free a
  // hand, is gone the next time the hero comes back, and the scripts that
  // need it (Charax, Selinus) then never complete. Here the two routines'
  // test of the class flag goes to a cave, which also passes over the mark
  // for the things below, as for a key. They can be dropped, slid, stored
  // and picked up again as before, and nothing tidies them away.
  //
  // WHICH THINGS. Each is a thing a script looks for with WhoHasItem or
  // removes with RemoveItem or TakeItem, by type, picture and Data1 as
  // cbwhohas matches them (Data1 0 there is any): the Sapphire Books (book,
  // picture 0, Data1 11 to 20, Selinus 0x1851) and Charax's book (Data1 5,
  // 0x184F); deep-sea kelp (270) and the eartheart mushroom (271), any
  // (0x184F); Eudoxus's note (paper, picture 0, Data1 1, Halos 0x183E);
  // Periphas's flour (bag of flour, Data1 1, made by 0x1841, removed by
  // 0x182A); the net for Stentor (fishing net, Data1 1, made by 0x1849,
  // removed by 0x186C); the half-disks (232, any, made by Sabinate and
  // Magpie, set on the void bridge's pedestals); Thersites's ring (ring,
  // picture 2, Data1 4, 0x1865); and the ring that gives its wearer
  // ability 28 (Data2 28), which Tavara's stronghold tests on entry
  // (0x1424, 0x1001). And a person's body: a corpse (78 or 283) whose
  // Data1 is not 0. Data1 is the character's number (TActiveMonster::Die
  // writes it below 256, and 0 for the creatures above). The amulet and
  // Resurrection raise that character (0x10F4, 0x1A2F): Ariadne, whose body
  // goes to Philinus (0x1832), and Jhiaxus, without whom Magpie never
  // gives the second half-disk (0x1803). A body is made with flags 0x01, so
  // it is safe where it fell; only a drop after picking it up marks it.
  // Left out: eggs, which there are dozens of, and Omen's ring (Data1 3),
  // which changes a line of his and nothing else (0x1CC3).
  //
  // A CONTAINER with a quest thing anywhere inside it, a sack in a sack
  // included, counts as a quest thing too. A
  // thing inside another has flags 8 to 11 and its container's index in
  // the low half of its first word (GetPropParent reads it so), and is
  // never marked itself, so a sack cleared away with the level took the
  // kelp in it out of reach. The test walks the level's records from 256,
  // the first that is not a character's, up to the count at TOC -30276,
  // and for each quest thing inside something follows its containers up
  // while they are inside something too, as far as the thing dropped.
  //
  // The cave's test is a separate routine, called with the record in r3,
  // and answers with cr0 not equal for a quest thing. It changes r0 and r3
  // to r12. Both routines write r0 and r3 to r6 again before reading them,
  // and read none of r7 to r12 before their next call (AddToHood,
  // FindSurface), read 3 November 2026. The link register goes to r12
  // while the test calls the type test, and both routines saved theirs on
  // entry, since both make calls.
  { id: 'quest-items-kept', kind: 'change', title: 'A quest item or a person’s body that the hero drops stays where the hero left it, instead of being cleared away with the level',
    played: 'fork, PowerPC, 1 and 3 November 2026, alone and with every fix. Kelp dragged from the inventory to the floor of Omen’s Test, or slid a square west, is still there after a jump to Land King Hall and back, where the stock program removes it. A paper slid the same way goes back to its place on both programs. Aethon’s body slid a square in Omen’s Test is still there after the same jumps, and the amulet raises him from it (played alone). Kelp slid a square in Cademia is still there after a walk of 40 squares north and back, where the stock program deletes it. A sack with kelp in it, dragged from the inventory to the floor of Omen’s Test, is still there with the kelp in it after the jumps, where the stock program and this fix without its container test remove the sack and leave the kelp inside a freed record',
    sites: [
      { at: 0x5502C, was: [0x40820010], asm: ['b @cave               ; was bne 0x5503C, DropCommand’s class flag'] },
      { at: 0x5308C, was: [0x40820010], asm: ['b @slide              ; was bne 0x5309C, SlideItemCommand’s class flag'] }],
    cave: ['bne @drop0             ; class flag 8, no mark',
           'mr 3, 30', 'bl @quest', 'bne @drop0             ; a quest thing, no mark',
           'lbz 0, 0(30)', 'ori 0, 0, 32', 'stb 0, 0(30)',
           'drop0:', 'b @0x5503C',
           'slide:', 'bne @slide0', 'mr 3, 27', 'bl @quest', 'bne @slide0',
           'lbz 0, 0(27)', 'ori 0, 0, 32', 'stb 0, 0(27)',
           'slide0:', 'b @0x5309C',
           'quest:', 'mflr 12', 'mr 11, 3                ; the thing dropped',
           'bl @kind', 'bne @found              ; a quest thing itself',
           'lwz 6, -30268(2)', 'lwz 6, 0(6)             ; the level’s records',
           'lwz 7, -30276(2)', 'lha 7, 0(7)             ; how many',
           'li 9, 256', 'addi 8, 6, 4096         ; record 256',
           'scan:', 'cmpw 9, 7', 'bge @none',
           'lbz 0, 0(8)', 'andi. 0, 0, 220', 'cmpwi 0, 8', 'bne @next              ; not inside anything',
           'mr 3, 8', 'bl @kind', 'beq @next              ; not a quest thing',
           'mr 10, 8',
           'up:', 'lhz 0, 2(10)            ; its container', 'slwi 0, 0, 4', 'add 10, 6, 0',
           'cmpw 10, 11', 'beq @found              ; inside the thing dropped',
           'lbz 0, 0(10)', 'andi. 0, 0, 220', 'cmpwi 0, 8', 'beq @up                 ; that container is inside another',
           'next:', 'addi 8, 8, 16', 'addi 9, 9, 1', 'b @scan',
           'none:', 'mtlr 12', 'li 0, 0', 'cmpwi 0, 0', 'blr',
           'found:', 'mtlr 12', 'li 0, 1', 'cmpwi 0, 0', 'blr',
           'kind:', 'lhz 4, 4(3)            ; the picture and the type',
           'andi. 5, 4, 1023        ; the type',
           'rlwinm 4, 4, 0, 17, 31  ; the picture and the type, the rotation aside',
           'lbz 0, 6(3)             ; Data1',
           'cmpwi 5, 270', 'beq @yes              ; deep-sea kelp',
           'cmpwi 5, 271', 'beq @yes              ; the eartheart mushroom',
           'cmpwi 5, 232', 'beq @yes              ; a half-disk',
           'cmpwi 5, 78', 'beq @body',
           'cmpwi 5, 283', 'beq @body',
           'cmpwi 4, 26', 'beq @book',
           'cmpwi 4, 134', 'beq @one              ; Eudoxus’s note',
           'cmpwi 4, 166', 'beq @one              ; Periphas’s flour',
           'cmpwi 4, 214', 'beq @one              ; the net for Stentor',
           'cmpwi 5, 307', 'bne @no',
           'cmpwi 4, 2355', 'bne @ring', 'cmpwi 0, 4', 'beq @yes              ; Thersites’s ring',
           'ring:', 'lbz 0, 7(3)             ; Data2, the ability the ring gives', 'cmpwi 0, 28', 'beq @yes              ; the stronghold’s ring', 'b @no',
           'body:', 'cmpwi 0, 0', 'bne @yes              ; a person’s body', 'b @no',
           'book:', 'cmpwi 0, 5', 'beq @yes              ; Charax’s book', 'cmpwi 0, 11', 'blt @no',
           'cmpwi 0, 20', 'ble @yes              ; a Sapphire Book', 'b @no',
           'one:', 'cmpwi 0, 1', 'beq @yes',
           'no:', 'li 0, 0', 'cmpwi 0, 0', 'blr',
           'yes:', 'li 0, 1', 'cmpwi 0, 0', 'blr'] },
  // What a character wore at death is worn again when they are raised.
  // TActiveMonster::Die moves every thing in a character's inventory (kind
  // 16), worn (24) or inside them (9) into the corpse as kind 9, so the
  // corpse has no record of what was worn, and Resurrection (0x1A2F) and the
  // Land King Amulet (0x10F4) give everything back with flags 16, in the
  // inventory. Death runs no UnWear script either, so what a Wear script
  // did stays done: the belt's Body +5 (0x1154), the gator boots' flags 31
  // and 23 (0x1135), the ring's ability in its Data2 (0x1133). A raised
  // character had such a thing in the inventory with its effect still on
  // them, and wearing it again ran Wear a second time (Body +10). Worn
  // again, the thing matches its effect, as before the death; Wear is not
  // run again.
  //
  // THE MARK. Byte 1 of a thing in an inventory or inside something is not
  // part of its holder: holders are read from the low 16 bits
  // (GetPropParent) or the low 12 (WieldCommand's scan), and the byte
  // retains what the thing's x left there (saves have 0 to 3 and 0x42).
  // Die, as it moves a thing into the corpse, writes 255 there for a worn
  // thing and 0 for the rest. SetField's write of a thing's flags (field
  // 0), when a script writes 16 to a thing inside something (kind 9) whose
  // byte 1 is 255, writes 24 and clears the byte. Both raise scripts write
  // the container first and the flags second. SetField's write of the
  // container (field 11) ORs the value's low 24 bits into the old byte 1,
  // and a character's value has its class, 0x40, there, so the mark stays
  // 255 and the 0 of a thing not worn becomes 0x40 (played: the kelp beside
  // the worn belt). A script's x of a thing inside something
  // reads its outermost container's square, so the scripts cannot read the
  // mark themselves. TakeCommand writes the new holder into the low 16 bits
  // at both its writes (a character, a container), and with this fix it
  // clears byte 1 there as well, so a thing taken out of the corpse and
  // put back is in the inventory when the person is raised. WieldCommand,
  // DropCommand and SlideItemCommand write all 24 bits already.
  //
  // REGISTERS. At 0x46C98 Die has 9 in r0 and the prop table in r3; r4 and
  // r0 are loaded again before they are read, and cr0 is set again before
  // it is tested. At 0x92EB4 SetField has the value in r0 and ForceReset's
  // argument in r3; r5 is free, and the call that follows ends r5 and cr0
  // anyway.
  { id: 'worn-at-death', kind: 'fix', title: 'A character raised by Resurrection or the Land King Amulet wears again what they wore when they died, instead of having it in the inventory',
    played: 'fork, PowerPC, 3 November 2026, alone and with every fix. Aethon, wearing a belt and with kelp in his inventory, killed by the hero and raised with the Land King Amulet, wears the belt again and has the kelp in his inventory, where the stock program puts both in his inventory. The belt in his body has byte 1 at 255 and the kelp 0. The belt taken out of the body into the hero’s inventory has byte 1 at 0. Taken out and put back into the body, it is in Aethon’s inventory after the raise, not worn',
    sites: [
      { at: 0x46C98, was: [0x981C0000], asm: ['b @death               ; was stb 0, 0(28), the kind made 9'] },
      { at: 0x54410, was: [0x5405021E], asm: ['li 5, 0                ; was rlwinm 5, 0, 0, 8, 15, byte 1 left as it was'] },
      { at: 0x54438, was: [0x5405021E], asm: ['li 5, 0                ; was rlwinm 5, 0, 0, 8, 15, byte 1 left as it was'] },
      { at: 0x92EB4, was: [0x981E0000], asm: ['b @flags               ; was stb 0, 0(30), a thing’s flags'] }],
    cave: ['death:', 'lbz 4, 0(28)            ; the kind before: 16 inventory, 24 worn, 9 inside',
           'stb 0, 0(28)            ; kind 9, inside the corpse',
           'li 0, 0', 'cmpwi 4, 24', 'bne @mark', 'li 0, 255',
           'mark:', 'stb 0, 1(28)            ; 255 for a worn thing, 0 for the rest',
           'b @0x46C9C',
           'flags:', 'cmpwi 0, 16', 'bne @plain             ; not to the inventory',
           'lbz 5, 0(30)', 'cmpwi 5, 9', 'bne @plain             ; not inside something',
           'lbz 5, 1(30)', 'cmpwi 5, 255', 'bne @plain             ; not worn at death',
           'li 0, 24                ; worn', 'li 5, 0', 'stb 5, 1(30)            ; the mark cleared',
           'plain:', 'stb 0, 0(30)', 'b @0x92EB8'] },
  // Whether a character was in the party when they died, written on the
  // corpse for the Resurrection fix (the data fix resurrection), which puts
  // a companion back in the party. TActiveMonster::Die clears the party
  // bit, byte 8's 0x40, and rebuilds the party (0x46B38 to 0x46B68) before
  // it makes the corpse, so nothing after the death had the membership, and
  // the data fix had read a party behavior at death, 1 to 13, which the
  // hero's attacks also give a joiner outside the party (8 for Aethon). Die
  // writes the corpse's Data2, byte 7, as 0 (0x46BE8); here it is 2 for a
  // character in the party and 1 for one outside it, and the data fix reads
  // 0 as a corpse made without this fix. No script reads a corpse's Data2
  // (the classes of types 78 and 283 have no method that does).
  //
  // THE SLOT. Die's frame word at 100(1) is written once, at 0x46B54 on the
  // party branch, read at once and never again, so the answer stays there
  // across the two calls between (RebuildParty, NewProp). 0x46B3C, which
  // every character below 256 passes, writes 1 there; the party branch
  // writes 2 after its clear. r0 is loaded again after each site before it
  // is read (0x46B44, the call at 0x46B68, 0x46BEC).
  { id: 'party-at-death', kind: 'fix', title: 'A character’s corpse records whether they were in the party when they died, which the Resurrection fix reads to put a companion back in the party',
    played: 'fork, PowerPC, 3 November 2026, alone and with every fix, with the Resurrection fix. Aethon killed by the hero outside the party leaves a body with Data2 1, and the Land King Amulet raises him outside the party. Aethon in the party, poisoned to death, leaves a body with Data2 2, and the amulet raises him into the party',
    sites: [
      { at: 0x46B3C, was: [0x90010068], asm: ['b @start               ; was stw 0, 104(1)'] },
      { at: 0x46B64, was: [0x98030008], asm: ['b @left                ; was stb 0, 8(3), the party bit cleared'] },
      { at: 0x46BE8, was: [0x98170007], asm: ['b @corpse              ; was stb 0, 7(23), the corpse’s Data2 made 0'] }],
    cave: ['start:', 'stw 0, 104(1)', 'li 0, 1', 'stw 0, 100(1)           ; outside the party, until the branch below', 'b @0x46B40',
           'left:', 'stb 0, 8(3)', 'li 0, 2', 'stw 0, 100(1)           ; in the party', 'b @0x46B68',
           'corpse:', 'lwz 0, 100(1)', 'stb 0, 7(23)            ; Data2, 1 or 2', 'b @0x46BEC'] },
  // A start of play costs fifteen ticks. TDelverApp::BeginPlay, which a new
  // game, Open and a revert all come through, ends by handing 15 to
  // TGameSys::HeartBeat: the hero is busy for fifteen ticks, the clock goes
  // on fifteen units, and every creature and person moves through them
  // before a key is taken. So a save opened is not the moment it was saved:
  // a ruffian three squares off is beside the hero, a shopkeeper has
  // stepped from his post, and each reload moves the clock on again. The
  // call stays, since HeartBeat is also what runs MoveAll once and leaves
  // the turn with the player; it is handed 0. Read and measured 9 October
  // 2026 (the workbench's log, under grimoire/fixable-bugs-1adxav): the
  // hero's timing byte is 15 in a save written as the game opens and the
  // clock is fifteen on in one written a moment later. A choice and not a
  // fix: the cost is a constant the program was given.
  // WHAT ELSE IT REACHES (the maintainer's question). BeginPlay has one
  // caller, OpenPlayerFile, which calls it for the start board (RunStart,
  // which a new game goes through), Open and a revert, and not for Save As.
  // Nothing in play comes through it: a change of zone, a sleep, a death and
  // every command hand HeartBeat their costs elsewhere. A new game opens
  // on the king's welcome with it as without (the two frames are the same).
  { id: 'load-cost', kind: 'change', title: 'Starting or opening a game costs no time, so a game opens on the moment it was saved, instead of fifteen ticks later with everyone moved',
    played: 'fork, PowerPC, 9 October 2026: a save of Cademia opened and saved again has the same clock, where the unpatched program writes it fifteen units on; a new game opens on the king\u2019s welcome as before',
    sites: [{ at: 0x14634, was: [0x3880000F], asm: ['li 4, 0                ; nothing for HeartBeat to spend'] }] },
  // The difficulty level, as the game was made to have it. Alaric's
  // keywords (0x1802) set the script global DifficultyLevel, 17, to 0 for
  // "very easy", 1 "easy", 2 "norm", 3 "hard" and 4 "very hard", and the
  // hero's creation (0x1801) sets 2. Two things read a difficulty. The
  // level-up script (0xE86) gives 6 minus the global in training points.
  // TActiveMonster's constructor, for a creature made from a map's list or
  // an egg (prop 256 and up; named characters keep their stats), draws a
  // percentage from a band named by the short at TOC +8562, the third short
  // of a save's Char block (10 to 49, 25 to 99, 50 to 149, 100 to 199,
  // 150 to 299) and makes the creature's body, reflex, mind and health that
  // percentage of its type's, and its level from those, scaled again.
  //
  // THE SHIPPED FAULT. SetGlobal stores 12 (karma, into the short at
  // TOC +8560, beside the difficulty's) and 14 (the languages) and drops
  // every other number, and GetGlobal's jump table sends 17 to its default,
  // None. So the keywords change nothing, a level-up gives 6 minus None,
  // which is 6, the very easy figure (seen on the 2019 livestream: 6 a
  // level twice), and the short stays at the 2 every save begins with, so
  // creatures are always made at 50 to 149. The workbench's bugs.md has
  // the reading.
  //
  // THE CHANGE. SetGlobal stores 17, held to 0 to 4, into the short at
  // TOC +8562, and GetGlobal answers 17 from it, so both readers see the
  // one value, and SaveToFile writes the short into a save. Normal is then
  // 4 training points a level, not the 6 every game has given, which is
  // why this is a design change and not a fix.
  //
  // WHEN IT CAN BE SET. The five keywords are in 0x1802's one list with
  // "job" and "bye", with no condition, and each branch goes back to the
  // list, so the level can be set in any talk with Alaric, any number of
  // times. AddConversationKeyword is never called for them, so they are
  // typed. Every save read has 2 in the short, so the change works on a
  // game already under way, at normal. A creature's stats are bytes of its
  // record, made once, so a new level reaches creatures made after it.
  //
  // THE CAP. Each scaled stat is stored as a byte with the low eight bits
  // of the product, so at 150 to 299 a type's 100 health can come out as
  // 300 and be stored as 44, and the level, scaled twice, passes 255 for
  // the larger types at hard and very hard. Each of the six stores is
  // capped at 255 first; the test for 0 after it is untouched. Byte 31,
  // where the percentage goes, is written and read by nothing else in the
  // program, and the change leaves its store as shipped.
  //
  // SetGlobal is a leaf with no frame; its global's number is in r0 and
  // the value in its caller's slot at 28(1), and the cave uses r0 alone.
  // GetGlobal's number is in r0 and its answer goes through r31. The
  // constructor saved its return address on entry, so the bl at each store
  // is free, and each store's cave changes nothing but the stored
  // register, which the code after it reads from the record again.
  { id: 'difficulty', kind: 'change', name: 'Hardly Normal', title: 'Telling Alaric “very easy”, “easy”, “normal”, “hard” or “very hard” sets the training points a level brings and how strong new creatures are, instead of being forgotten',
    bug: 'The difficulty level is never stored',
    note: 'The player can type the word to Alaric in any conversation with him, as often as they like. He does not list the words as topics. Until the player gives him one, the level is normal, and a game saved before the patch is at normal too. A new level applies to later level-ups and to creatures made after the change. Creatures already made keep their stats.',
    played: 'fork, PowerPC, 1 November 2026, a new game on a Cythera Data that raises the hero a level after each of Alaric’s five answers, each keyword typed and the game saved. The unpatched program gave 6 training points for “very hard” and left the save’s difficulty at 2. The patched one gave 6, 5, 4, 3 and 2 for very easy to very hard and saved 0 to 4. A played save set to very hard and opened outside Land King Hall made the same creatures on both programs, and one drawn at 214%, whose level came to 259, was stored as 3 by the unpatched program and as 255 by the patched one',
    sites: [
      { at: 0x93A84, was: [0x40800058], asm: ['b @set                ; was bge 0x93ADC, every global from 15 dropped'] },
      { at: 0x9379C, was: [0x28000013], asm: ['b @get                ; was cmplwi 0, 19, the jump table’s bound'] },
      ...[[0x44E18, 0x98030009, 'body'], [0x44E68, 0x9803000A, 'reflex'], [0x44EB8, 0x9803000B, 'mind'],
          [0x44F08, 0x9803000E, 'health'], [0x44FF8, 0x98640013, 'base'], [0x45020, 0x98030013, 'level']]
        .map(([at, was, l]) => ({ at, was: [was], asm: ['bl @' + l + '              ; the store, capped at 255'] }))],
    cave: ['set:', 'blt @set14             ; 14, the languages, as shipped', 'cmpwi 0, 17', 'bne @setout',
           'lwz 0, 28(1)', 'slwi 0, 0, 4', 'srawi 0, 0, 4         ; the number, as karma reads it',
           'cmpwi 0, 0', 'bge @setlow', 'li 0, 0', 'setlow:', 'cmpwi 0, 4', 'ble @sethigh', 'li 0, 4', 'sethigh:',
           'sth 0, 8562(2)        ; the short beside karma’s', 'setout:', 'b @0x93ADC', 'set14:', 'b @0x93AC4',
           'get:', 'cmpwi 0, 17', 'bne @getjt', 'lha 0, 8562(2)', 'clrlwi 0, 0, 4        ; a number',
           'stw 0, 0(31)', 'b @0x93A28', 'getjt:', 'cmplwi 0, 19', 'bgt @getnone', 'b @0x937A4', 'getnone:', 'b @0x93A20',
           ...[['body', 0, 9, 3], ['reflex', 0, 10, 3], ['mind', 0, 11, 3], ['health', 0, 14, 3], ['base', 3, 19, 4], ['level', 0, 19, 3]]
             .flatMap(([l, r, off, base]) => [l + ':', 'cmplwi ' + r + ', 255', 'ble @' + l + 'st', 'li ' + r + ', 255',
                                              l + 'st:', 'stb ' + r + ', ' + off + '(' + base + ')', 'blr'])] },
  /* The Halloween mod's conversation colors (the Utility Mods' 'halloween',
     js/delv-halloween.js, is the rest of it): a black tint in place of the
     blue, orange text in place of the yellow, and white keywords in place
     of the cyan. The workbench's tools/sprites/halloween/halloween_app.mjs
     made them first, on 29 October 2026.

     The tint. A conversation, question or prompt window shows the game
     behind it under a 50% pattern painted in color 1 of the game's palette,
     clut 256, which is (0, 0, 168). TInteraction::MyCopyBitsBevel and
     TInteraction::MyCopyBits each read that color's red and green as a word
     at 18 into the table and its blue as a half-word at 22, for
     RGBForeColor. Entry n's color starts at 10 + 8n, so 2050 and 2054 read
     entry 255, black.

     The text. TConversation::ShowTalking (speech), TConversation::ShowMessage
     (narration) and the TSimpleInteraction constructor pass
     TTextContext::Draw a text color of 69, QuickDraw's yellow, and a keyword
     color of 273, cyan. The answer choices and the entry marker
     (TInteraction::GetResponse, TConvResponseMode) and the pick list
     (TPickMode::DrawRoutine) pass 69 to TTextContext::DrawTextOutlined. In
     DrawTextOutlined a color below 0 is entry -n of the palette, and
     TStyleRun::Draw reaches DrawTextOutlined for every text color but
     black. So -228 is entry 228, (252, 124, 0), the palette's closest to
     orange. The keyword color becomes 30, QuickDraw's white. The red of a
     choice under the mouse (205) and the names under the portraits (30)
     stay as shipped. PowerPC only: the 68K program has no counterpart here.

     Seen on Mac OS 8.5 in SheepShaver: the black tint and the orange speech
     and narration of Alaric's opening. The keywords and the answer choices
     were not on screen in that run. */
  { id: 'halloween-colors', kind: 'change', name: 'Halloween colors',
    title: 'A conversation darkens the game behind it in black, with orange text and white keywords, instead of blue, yellow and cyan',
    played: 'in part, SheepShaver, Mac OS 8.5, 29 October 2026, the black tint and the orange speech and narration in Alaric’s opening. The white keywords and the orange answer choices were not on screen',
    sites: [
      { at: 0x3A428, was: [0x80040012], asm: ['lwz 0, 2050(4)        ; was 18(4): entry 255, not 1'] },
      { at: 0x3A430, was: [0xA0040016], asm: ['lhz 0, 2054(4)        ; was 22(4)'] },
      { at: 0x3A738, was: [0x80040012], asm: ['lwz 0, 2050(4)        ; was 18(4): entry 255, not 1'] },
      { at: 0x3A740, was: [0xA0040016], asm: ['lhz 0, 2054(4)        ; was 22(4)'] },
      // ShowTalking, ShowMessage, TSimpleInteraction: the text, then the keywords.
      ...[0x3D6C0, 0x3D954, 0x41004].map(at => ({ at, was: [0x39000045], asm: ['li 8, -228             ; was li 8, 69'] })),
      ...[0x3D6C4, 0x3D97C, 0x41008].map(at => ({ at, was: [0x39200111], asm: ['li 9, 30               ; was li 9, 273'] })),
      // TConvResponseMode::DrawRoutine and MouseRoutine, GetResponse, TPickMode::DrawRoutine.
      ...[0x3E21C, 0x3E2C8, 0x3E4F0, 0x3E5AC, 0x3EF8C, 0x3F0DC, 0x3F174, 0x3FE64].map(at => ({ at, was: [0x38E00045], asm: ['li 7, -228             ; was li 7, 69'] })),
    ] },
];

/* Which of the Patches tab's lists (DATA_FIX_GROUPS, js/delv-datafixes.js)
   each fix is shown in, by what it does in play, since the program's fixes
   and Cythera Data's became one list (the maintainer, 16 October 2026).
   A hook, a text fix, the menus and a design change go by their kind; a
   fix of kind `fix` is named in APP_FIX_GROUP. The smoke fails on a fix
   that resolves to no list. */
const APP_FIX_KIND_GROUP = { hook: 'hidden', text: 'text', menu: 'interface', change: 'design' };
const APP_FIX_GROUP = {
  'option-p': 'interface', 'drag-northwest': 'interface', 'books-window': 'interface',
  'take-window': 'interface', 'roster-pose': 'interface', 'tab-pane': 'interface', 'gamepad-keys': 'interface',
  'right-click': 'interface', 'walk-to': 'interface', 'walk-path': 'interface', 'journal-rows': 'interface', 'window-leak': 'interface', 'status-wrap': 'interface', 'widget-renumber': 'interface',
  'music-revert': 'interface', 'music-lock': 'interface', 'hero-square': 'interface', 'open-during-play': 'interface', 'spot-tune': 'interface',
  'theft-moved': 'items', 'weight-contents': 'items', 'empty-zone-save': 'items', 'containers-weight': 'items',
  'target-hunger': 'world', 'sleep-hidden': 'world', 'corner-body': 'world', 'sleeper-unit': 'world', 'unit-guard': 'world', 'hood-size': 'world',
  'corpse-light': 'rules', 'worn-at-death': 'rules', 'party-at-death': 'hidden','spell-glow': 'rules', 'ai-import': 'rules', 'ai-weight': 'rules', 'ai-token': 'rules', 'ai-mods': 'rules', 'ai-pick': 'rules', 'conv-field': 'interface', 'automap-span': 'interface', 'more-button': 'interface',
  'menu-scroll': 'talk', 'menu-items': 'talk', 'afternoon': 'talk', 'name-fit': 'talk', 'journal-at': 'talk', 'speech-clear': 'talk', 'name-clear': 'talk',
  'halloween-colors': 'mods',
};
function appFixGroup(f) { return APP_FIX_GROUP[f.id] || APP_FIX_KIND_GROUP[f.kind] || null; }
