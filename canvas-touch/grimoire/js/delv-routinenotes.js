/* ROUTINE_NOTES: what each routine of the program does, in plain words, by
   class, with the class's opening and each routine's text, keyed by the
   routine's entry (an offset into the code section, as everywhere on the
   site).

   Written by a script, the workbench's tools/fnpublish.py, from its
   doc/functions/, where every claim was read from the instructions twice and
   cites the instructions that show it. Change the words there, not here.
   The page shows a text on the routine's page above its listing, each
   address in it a link that rings the instruction in the visitor's copy of
   the program (renderAppPefSheet, routineNoteHTML). The smoke's routine
   notes block checks that every cited address lies in the routine its text
   is under. Text in backticks is a name or an address, *stars* a title, and
   a line starting "- " an item of a list. */
const ROUTINE_NOTES = {
 "TSegFile": {
  "opening": "One archive file, such as `Cythera Data` or a saved game, open for reading and\nwriting. The object has the file's reference number at `+0`, a byte at `+2`\nthat the object sets when the table of contents changes and clears when it\nwrites the table, a byte at `+3` that is 1 while the file accepts no saves, the\ntime the object opened the file at `+4` (`GetDateTime`, `0x079698`) and from\n`+8` the addresses of 256 pages of the table of contents, 0 for a page not in\nmemory.\n\nThe file starts with a header of 128 bytes. Page 0 of the table follows at\noffset 128, 2,048 bytes (`TSegFile::BlankFile`, `0x079B64` to `0x079B90`). A\npage has 256 entries of 8 bytes, a segment's offset in the file and its length.\nA resource's id picks page `id >> 8` and entry `id & 0xFF` of it\n(`TSegFile::LoadSegment`, `0x079F70` and `0x079F8C`). The file stores page n,\nfrom 1 to 255, as the segment with id n, so entry n of page 0 locates it\n(`TSegFile::LoadTOC`, `0x079C9C` to `0x079D0C`). Entry 0 of page 0 gives the\nplace of page 0 itself, offset 128, and resources from `0x0100` up are the\nfile's contents.",
  "routines": [
   {
    "name": "TSegFile::IsSegFile",
    "entry": 497116,
    "text": "Returns 1 when an open file is an archive, which is when the 4-byte word at\noffset 128, the first entry of page 0, is 128 (`0x079620`), and 0 otherwise."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497268,
    "text": "Opens an archive on a file already open. An empty file becomes a new archive\n(`BlankFile`, `0x0796D0`), and the byte at `+2` goes to 1. For any other file\nit reads the table into memory (`LoadTOC`, `0x0796E8`)."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497460,
    "text": "Makes a new archive at a file location, deleting any file there (`FSpDelete`,\n`0x079770`), creating it with the creator and type given (`FSpCreate`,\n`0x079778` to `0x079788`), opening its data fork for reading and writing\n(`FSpOpenDF`, `0x07979C`) and writing an empty archive (`BlankFile`)."
   },
   {
    "name": "TSegFile::~TSegFile",
    "entry": 497668,
    "text": "Writes the table when it has changed (`SaveTOC`, `0x079834`), closes the file\n(`FSClose`, `0x079840`), frees every page of the table and frees the object when\nthe flag is above 0."
   },
   {
    "name": "TSegFile::Lock",
    "entry": 497920,
    "text": "Sets the byte at `+3` to 1, after which a save throws."
   },
   {
    "name": "TSegFile::Unlock",
    "entry": 497968,
    "text": "Sets the byte at `+3` to 0."
   },
   {
    "name": "TSegFile::DeleteTOCPage",
    "entry": 498020,
    "text": "Frees a page of the table (`free`), unless it is 0."
   },
   {
    "name": "TSegFile::NewTOCPage",
    "entry": 498144,
    "text": "Allocates a page of the table, 2,048 bytes of zeros (`malloc`, `0x0799F4`), and\nthrows \"Could not allocate segfile TOC page\" when there is no memory."
   },
   {
    "name": "TSegFile::BlankFile",
    "entry": 498296,
    "text": "Empties the file (`SetEOF` of 0, `0x079A9C`) and writes a new archive, a header\nof 128 zeros (`0x079B00`) and page 0 of the table with only entry 0, which\ngives page 0's place, offset 128 and length 2,048 (`0x079B64` to `0x079B90`).\nIt returns the File Manager's error, or -108 when there is no memory for the\nheader."
   },
   {
    "name": "TSegFile::LoadTOC",
    "entry": 498656,
    "text": "Reads the table into memory, page 0 from offset 128 (`0x079C38`, `0x079C6C`) and\nthen each page whose entry in page 0 has a length (`0x079C9C` to `0x079D0C`).\nIt reads the entry's length of bytes into a page of 2,048 (`0x079CEC`), so a\nlength above 2,048 would run past the page. It returns the File Manager's\nerror, if any."
   },
   {
    "name": "TSegFile::SaveTOC",
    "entry": 499072,
    "text": "Writes the table. It saves each page from 1 to 255 that has an entry of nonzero\nlength as segment n (`SaveSegment`, `0x079E14`), and frees a page with none and\nclears its entry in page 0 (`0x079E48` to `0x079E90`). Then it writes page 0 at\noffset 128 (`0x079EE4`) and clears the byte at `+2`."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499532,
    "text": "Reads a whole segment into a buffer, the entry's length of bytes from its\noffset (`FSRead`, `0x079FE0`). The buffer has to be large enough, since nothing\nhere checks it. A resource with no page or a length of 0 gives -50\n(`0x07A008`)."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499796,
    "text": "Reads part of a segment, a length from an offset into it, into a buffer\n(`0x07A0B8` to `0x07A144`). A missing resource fills the buffer with zeros and\nreturns -43 (`0x07A164`, `0x07A17C`). When the length given is greater than the\nsegment's whole length, it zeros from the buffer's start plus the offset plus\nthe segment's length, for the length given less the segment's length, and\nreads the segment's whole length from the offset (`0x07A0F8` to `0x07A134`).\nWith an offset above 0 that zeroing runs past the buffer's end by the offset,\nand the read goes beyond the segment. When the length given is not greater\nthan the segment's, nothing checks that the offset plus the length stays\ninside the segment. No call in the shipped game meets either case. Every\ncaller but `LoadLevelMap` passes an offset of 0, and `LoadLevelMap`'s reads end\nat the segment's end in the shipped scenario, so only a map edited to be\nshorter than the length in its header would meet it."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 500188,
    "text": "Reads a whole segment into a new handle, from the application heap\n(`NewHandle`, `0x07A238`) or else temporary memory (`TempNewHandle`,\n`0x07A250`). It returns 0 for a missing resource, when there is no memory, or\nwhen the read fails."
   },
   {
    "name": "TSegFile::SetSegmentLen",
    "entry": 500528,
    "text": "Sets a segment's length, making its page when the page is missing. A segment\nthat grows moves to the end of the file, which grows by the new length\n(`GetEOF`, `SetEOF`, `0x07A3D4` to `0x07A434`), and its bytes stay behind,\nuncopied. One that shrinks stays where it is with the new length (`0x07A444` to\n`0x07A458`). Either change sets the byte at `+2`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 500912,
    "text": "Writes a whole segment. It throws \"Attempt to save segment to locked seg file\"\nwhile the byte at `+3` is 1 (`0x07A4D8` to `0x07A4F8`). A segment longer than\nits entry moves to the end of the file as `SetSegmentLen` moves it (`0x07A578`\nto `0x07A5E4`), one shorter stays where it is, and then the bytes go at the\nentry's offset (`0x07A624`, `0x07A650`). The space a moved segment had stays\nin the file until `Compact`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 501440,
    "text": "Writes part of a segment, from an offset into it, inside its present length.\nIt throws while the byte at `+3` is 1. It cuts a length running past the\nsegment's end to that end (`0x07A748` to `0x07A760`). For a missing resource or\na length of 0 or less it writes nothing and returns -50 (`0x07A7E4`)."
   },
   {
    "name": "TSegFile::ReadHeader",
    "entry": 501808,
    "text": "Reads the file's 128-byte header from offset 0 into a buffer (`0x07A85C`, `0x07A888`)."
   },
   {
    "name": "TSegFile::WriteHeader",
    "entry": 501996,
    "text": "Writes a buffer of 128 bytes as the file's header at offset 0 (`0x07A918`, `0x07A944`)."
   },
   {
    "name": "TSegFile::Compact",
    "entry": 502184,
    "text": "Rewrites the archive without the space that moved segments left behind. It\nfinds the file (`PBGetFCBInfoSync`, `0x07A9F0`) and makes a copy beside it,\nits name the file's with one of the characters of \"~123456789\" added, the\nfirst such name that no file has (`0x07AA5C` to `0x07AB08`), with creator 'SdEd'\n(`FSpCreate`, `0x07AAC0`). Into the copy it writes the header and every\nsegment from `0x0100` up (`TSegFileIterator`, `0x07AB50`, `SaveSegment` at\n`0x07ABAC`). Then it copies the resource fork (`0x07AC6C` to `0x07ADB8`),\nhalving the buffer until an allocation succeeds. It exchanges the two files\n(`FSpExchangeFiles`, `0x07ADDC`), reopens the original and reads its new table\n(`0x07AE64`, `0x07AE98`), and deletes the copy, which then has the old contents\n(`FSpDelete`, `0x07AED0`). A failure to reopen throws \"Compacting seg file -\ncan't re-open copy\", and a failure to read the table \"Compacting seg file -\ncan't re-load TOC\". When files already have all ten names, it returns -50."
   },
   {
    "name": "TSegFile::Verify",
    "entry": 503972,
    "text": "Checks an open file's archive structure and returns a message, or 0 when it\nfinds nothing wrong. It returns \"Not a segfile\" when the first entry is not 128\n(`IsSegFile`, `0x07B0E4`) and \"Could not read master TOC\" when a read of page 0\nfails. It checks that each entry of page 0 has a length from 0 to 2,048 (\"Bad\nsize of TOC segment\", `0x07B1E0` to `0x07B204`), lies after the header and\ninside the file (\"TOC page out of file\", `0x07B25C` to `0x07B298`) and overlaps\nno other (\"Overlap of TOC segments\", `0x07B328` to `0x07B360`). Then it reads\neach page, returning \"Could not read sub TOC\" when a read fails (`0x07B40C` to\n`0x07B420`), and checks its entries the same way, with the length up to the\nfile's length, returning \"Preposterous size of data segment\", \"data segment\nout of file\" or \"Overlap of data segments\" (`0x07B450` to `0x07B5F0`). It\nstores the id of the entry it finds wrong in the global at toc -29508\n(`0x07B208`, `0x07B494`)."
   },
   {
    "name": "TSegFile::Encrypt",
    "entry": 506416,
    "text": "Enciphers or deciphers bytes in place with a resource's id as the key, the\nsame operation either way. From the id it makes a multiplier, the id times 4,\nlow byte, plus 1 (`0x07BA38`, `0x07BA40`), an increment, the id shifted right 6,\nlow byte (`0x07BA58`), and a starting state, the id with its high byte\nexclusive-ored in (`0x07BA5C`). It steps the state once for each byte to skip,\nthe fourth argument (`0x07BA64` to `0x07BA74`), which every caller passes as 0.\nThen for each byte it steps the state to the increment plus the state times\nthe multiplier and exclusive-ors the byte with the state's low byte\n(`0x07BA7C` to `0x07BA94`)."
   },
   {
    "name": "TSegFile::Decrypt",
    "entry": 506592,
    "text": "Calls `Encrypt` with the same arguments (`0x07BB0C`)."
   },
   {
    "name": "TSegFile::StreamSegment",
    "entry": 507040,
    "text": "Returns a record for reading a segment as a stream, the file's reference\nnumber, the segment's start offset twice (the start and the position to read\nnext) and its end offset (`0x07BCD4` to `0x07BCF4`), with the three offsets 0\nfor a missing resource (`0x07BCFC` to `0x07BD1C`). It builds the record below\nthe stack pointer (`0x07BCD8`), so the caller copies it before its next\ncall."
   }
  ]
 },
 "TCache": {
  "opening": "The memory for copies of resources, one block of the application heap made\ninto a heap zone. The object has its table of virtual routines at `+0`,\nthe block at `+4`, the zone at `+8` and the block used most recently at `+12`,\nthe head of a ring of every block in the zone.\n\nEach block is a handle in the zone with a header of 20 bytes before the data.\nThe header has the address of the owner's pointer at `+0`, which the cache\nsets to the data's address and clears when it frees the block, the handle at\n`+4`, the next older and the next newer block at `+8` and `+12`, a lock count\nat `+16` and flags at `+18`. Bit 0 of the flags means the cache writes the\nblock back before freeing it (`TCache::Free`, `0x07C984`).",
  "routines": [
   {
    "name": "TCache::TCache",
    "entry": 509316,
    "text": "Makes a cache of a size given, allocating the memory (`NewPtr`, `0x07C5BC`) and\nmaking it a zone with 1,024 master pointers (`InitZone`, `0x07C608`,\n`0x07C610`). No memory throws (`0x07C5F4`)."
   },
   {
    "name": "TCache::Allocate",
    "entry": 509556,
    "text": "Allocates a block of a size given for an owner's pointer and returns the data's\naddress. When the zone is full (`NewHandle`, `0x07C6CC`) it frees the oldest\nblock whose lock count is 0 or less and tries again (`0x07C70C` to\n`0x07C770`). It returns 0 when the ring is empty and the allocation still\nfails (`0x07C6E8` to `0x07C6F0`). It throws when every block has a lock count\nabove 0 (`0x07C738`), and nothing reaches the second throw after that one\n(`0x07C750`). The new block goes at the head of the ring as the newest\n(`0x07C7EC` to `0x07C83C`). Then the cache sets every block's owner pointer to\nits data's address again, since a block can have moved (`0x07C840` to\n`0x07C880`)."
   },
   {
    "name": "TCache::GetMyHandle",
    "entry": 510172,
    "text": "Returns the handle of a block from its data's address, the word 16 bytes before it, or 0 for 0."
   },
   {
    "name": "TCache::WriteBlock",
    "entry": 510240,
    "text": "Does nothing. `Free` calls it, as the virtual routine at offset 8, for a block with bit 0 of its flags set."
   },
   {
    "name": "TCache::Free",
    "entry": 510288,
    "text": "Frees a block by its data's address. For a block with bit 0 of its flags set it\nfirst calls the virtual routine at offset 8 (`0x07C9A0`). The block leaves the\nring, the cache clears its owner's pointer (`0x07CA04`) and disposes of the\nhandle (`0x07CA0C`). With the third argument set, the cache then sets every\nother block's owner pointer to its data's address again (`0x07CA2C` to\n`0x07CA60`)."
   },
   {
    "name": "TCache::Lock",
    "entry": 510624,
    "text": "Adds 1 to a block's lock count and locks its handle (`HLock`, `0x07CAE0`), so that `Allocate` passes it over."
   },
   {
    "name": "TCache::Unlock",
    "entry": 510760,
    "text": "Subtracts 1 from a block's lock count and unlocks its handle when the count reaches 0 (`HUnlock`, `0x07CB7C`)."
   },
   {
    "name": "TCache::Touch",
    "entry": 510920,
    "text": "Moves a block to the head of the ring as the newest (`0x07CC00` to `0x07CC70`),\nso that the cache frees it last. When the ring is empty once the block is out,\nit calls `DebugStr` with \"Touching a block not in the cache\" (`0x07CC34`) and\nmakes the block the only one."
   }
  ]
 },
 "TCachedSegFiles": {
  "opening": "The archives open at once, merged into one table, with a cache of the\nresources read from them. The scenario's `Cythera Data` and the saved game are\ntwo of them. The object has the cache (`TCache`) at `+0`, up to 16 open\narchives (`TSegFile`) from `+4`, the newest first, and from `+68` the\naddresses of 256 pages of the merged table. A page has 256 entries of 8 bytes,\nthe address of the resource's copy in the cache (0 for none) and the\nresource's source archive, with the id picking the entry as in `TSegFile`.\n\nEvery save goes to the newest archive, at `+4` (`TCachedSegFiles::SaveSegment`,\n`0x07D75C`). The program reaches the one object through the global at toc\n-30396.",
  "routines": [
   {
    "name": "TCachedSegFiles::TCachedSegFiles",
    "entry": 511148,
    "text": "Makes the object for a cache given, with no archives and an empty table."
   },
   {
    "name": "TCachedSegFiles::AddFile",
    "entry": 511312,
    "text": "Adds an archive as the newest. The others move down one place, and a\nsixteenth falls off the list (`0x07CD78` to `0x07CD9C`). Then it points every\nresource from `0x0100` up that the archive has at the archive (`SetEntry`,\n`0x07CDDC`), so each resource's source is the newest archive that has it."
   },
   {
    "name": "TCachedSegFiles::NewTOCPage",
    "entry": 511568,
    "text": "Allocates a page of the merged table, 2,048 bytes of zeros (`malloc`, `0x07CE6C`), and throws when there is no memory."
   },
   {
    "name": "TCachedSegFiles::SetEntry",
    "entry": 511776,
    "text": "Points a resource at an archive, making its page when the page is missing.\nWhen the archive differs from the entry's, it frees the resource's copy in the\ncache (`TCache::Free`, `0x07CFAC`). When the archive matches, a copy in the\ncache stays as it is (`0x07CF88`)."
   },
   {
    "name": "TCachedSegFiles::GetSegment",
    "entry": 512012,
    "text": "Returns the address of a resource's copy in the cache, reading the resource in\nfirst when there is no copy. It makes a copy already there the newest\n(`TCache::Touch`, `0x07D05C`). Otherwise it allocates a block of the resource's\nlength (`TCache::Allocate`, `0x07D0D0`) and reads the resource into it as the\nfile has it (`TSegFile::LoadSegment`, `0x07D0E4`). It returns 0 for a\nresource no archive has."
   },
   {
    "name": "TCachedSegFiles::GetEncryptedSegment",
    "entry": 512328,
    "text": "Returns the address of a resource's deciphered copy in the cache. It does what\n`GetSegment` does and then deciphers the bytes it read (`TSegFile::Decrypt`,\n`0x07D238`). It returns a copy already in the cache as it is, so the copy has\ndeciphered bytes only when this routine, rather than `GetSegment`, read it in\nfirst."
   },
   {
    "name": "TCachedSegFiles::GetSegmentLength",
    "entry": 512676,
    "text": "Returns a resource's length in its source archive, or 0 for a resource no archive has."
   },
   {
    "name": "TCachedSegFiles::Exists",
    "entry": 512904,
    "text": "Returns 1 when a resource's source archive has an offset for it other than 0\n(`0x07D3FC`), and 0 otherwise."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513112,
    "text": "Copies a whole resource into a buffer. It moves a copy in the cache into the\nbuffer (`BlockMove`, `0x07D4FC`) and then reads the resource from its archive\ninto the same buffer (`TSegFile::LoadSegment`, `0x07D568`), so the buffer ends\nwith the bytes as the file has them."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513468,
    "text": "Copies part of a resource, from an offset, into a buffer, first from the\ncache (`BlockMove`, `0x07D624`) and then from its archive\n(`TSegFile::LoadSegment` at `0x07A054`, called at `0x07D64C`)."
   },
   {
    "name": "TCachedSegFiles::SetSegmentLen",
    "entry": 513696,
    "text": "Sets a resource's length in the newest archive (`TSegFile::SetSegmentLen`, `0x07D6D8`) and points the resource at that archive (`SetEntry`, `0x07D6EC`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 513856,
    "text": "Writes a whole resource to the newest archive (`TSegFile::SaveSegment`, `0x07D780`) and points the resource at it (`SetEntry`, `0x07D794`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 514024,
    "text": "Writes part of a resource to the newest archive (`TSegFile::SaveSegment` at `0x07A6C0`, called at `0x07D830`) and points the resource at it (`SetEntry`, `0x07D844`)."
   },
   {
    "name": "TCachedSegFiles::SaveEncryptedSegment",
    "entry": 514200,
    "text": "Writes a resource enciphered to the newest archive. It enciphers the bytes in\nplace (`TSegFile::Encrypt`, `0x07D8E0`), writes them (`0x07D8F8`), deciphers\nthem again (`0x07D910`) and points the resource at that archive (`SetEntry`,\n`0x07D924`)."
   },
   {
    "name": "TCachedSegFiles::RefindSegment",
    "entry": 514440,
    "text": "Looks again for the source archive of a resource. It frees the cached copy\nof entry 0 of the resource's page, not the resource's entry (the load\nat `0x07D9BC`, `TCache::Free` at `0x07D9D4`), and clears the resource's\narchive (`0x07D9F0`). Then it goes through the archives from the newest\n(`0x07D9FC` to `0x07DA94`) and points the resource at each one that has it,\nwithout stopping, so it ends at the oldest that has it. The resource's\ncopy in the cache stays."
   },
   {
    "name": "TCachedSegFiles::Flush",
    "entry": 514788,
    "text": "Writes the newest archive's table when it has changed (`TSegFile::SaveTOC`,\n`0x07DB1C`), and otherwise flushes the file (`PBFlushFileSync`,\n`0x07DB34`)."
   },
   {
    "name": "TCachedSegFiles::RemoveFile",
    "entry": 514948,
    "text": "Removes an archive from the list, moving the later ones up (`0x07DBAC` to\n`0x07DBFC`). For each resource whose source it was and that has a copy in the\ncache, it frees the copy and clears the source (`0x07DC40` to `0x07DC78`). A\nresource with no copy in the cache still points at the removed archive. Then\nit points every resource of every remaining archive at that archive, from the\noldest to the newest (`SetEntry`, `0x07DD0C`), which leaves each resource that\nanother archive has with the newest of those as its source."
   },
   {
    "name": "TCachedSegFiles::HomeSegFile",
    "entry": 515468,
    "text": "Returns a resource's source archive, or 0."
   }
  ]
 },
 "TInterp": {
  "opening": "The interpreter of the game's scripts, the byte code in `Cythera Data` that\ngrimoire's script view disassembles, with the mnemonics of its opcode table\n(`DVM_OPS` in `js/delv-script.js`). One object runs one script resource. It has\nthe arguments' base on the value stack at `+0`, the locals' base at `+4`, the\nscript's deciphered bytes at `+8` and the resource's id at `+12` (the\nconstructor, `0x0833C0`).\n\nValues are `VAddr` words, with their types in `VAddr`. The value stack is one\narray for all interpreters, its base in the global at toc -29440 and its depth\nin the halfword at toc -29444 (`data+0x72750`). True, False and None are the\nwords in the globals at toc -29844, -29712 and -30416. A pending exception is\nthe pointer in the global at toc -29436. While that pointer is not 0, both\nroutines that read opcodes return at their next opcode (`DoExpr`, `0x07DE4C`,\nand `DoInterpAt`, `0x080D78`), and the interpreter's destructor throws the\nexception (`0x083544`).\n\nThe interpreter evaluates expressions in one routine (`DoExpr`) and runs\nstatements in another (`DoInterpAt`). Expression opcodes 0x40 to 0x9F go\nthrough a jump table at toc +5236 (`0x07DE78`), and statement opcodes through a\nchain of compares (`0x080DD8`). A system call is opcode 0xA0 up, entry `opcode -\n0xA0` of a table of 96 routine pointers at toc +8176 (`0x0806D0`), from\n`RangeIter` (0xA0) to `cbDebugStr` (0xFE), each with its name in the program.",
  "routines": [
   {
    "name": "TInterp::DoExpr",
    "entry": 515580,
    "text": "Evaluates one expression, pushing its value onto the value stack. It reads\nopcodes from the program counter its second argument points at until the\nexpression ends (opcode 0x40, `0x07DE8C`). The opcodes do as follows.\n\n- Opcodes 0x00 to 0x2F push a local, from `+4` (`0x080620`), and 0x30 to 0x3F\n  push an argument, from `+0` (`0x08066C`).\n- The `byte`, `short` and `word` opcodes push a constant of 28 bits. For a\n  `word` of type 1 the routine adds the value stack's frame (`0x07DF84`).\n- The `string` and `data` opcodes push a far address to the bytes inline in\n  the script, and skip them (`0x07DFE8`, `0x07E07C`).\n- The `load_far_word` opcode reads the 4-byte word at a resource and an offset,\n  through `TCachedSegFiles::GetEncryptedSegment` (`0x07E170`, `lwzx` at\n  `0x07E1BC`), and throws \"Can't fetch global from segment\" when the segment is\n  missing. The `load_near_word` opcode reads a word of the current script\n  (`0x07E318`).\n- The `global` opcode pushes `GetGlobal` of its number (`0x07E2B0`).\n- The `index` opcode pushes `At` of an object and an index, or None when the\n  object is a number (`0x07E398`).\n- The `has_member` opcode pushes True when the object is a game object (type 4)\n  whose class answers the method, through `Dispatch` (`0x07E4B8`), and False\n  otherwise. The `class_member` opcode pushes what the class has under that\n  number.\n- The `get_field` opcode reads a game object's field through `GetField`\n  (`0x07E6EC`). The `cast` opcode turns a number into a reference to an object\n  of the type given, and converts another object through `Ctor` (`0x07E86C`).\n  The `is_type` opcode pushes True for a game object of that class.\n- The `add` and `sub` opcodes work on numbers, add a number to a game object's\n  id or a type-3 value's low 12 bits (`0x07F36C`, `0x07F3EC`), and push the\n  left value for any other pair. The `div` and `mod` opcodes give 0 when\n  dividing by 0 (`0x07F8E0`). The comparisons give True or False for two\n  numbers and push the left value for any other pair (`0x07FB1C`, `0x07FB84`).\n  The `eq` and `ne` opcodes compare through `IsEqual` (`0x07FF6C`).\n- The `gui` opcode with 0 converts a value. With a number n it evaluates its\n  arguments and makes a scripted window object through `CreateSysObj`\n  (`0x07EA7C`).\n- The `call_subroutine` opcode runs a routine of the same script (`DoInterpAt`,\n  `0x07EB54`), and the `call_resource` opcode a whole script in a new\n  `TInterp` (`0x07EBF4`). The `call_index` opcode runs the routine a value\n  points at, a script (type 6) or a far address into one.\n- The `method` opcode sends a method to the object that is its first\n  argument. A game object runs its class's script for the method, through\n  `Dispatch` (`0x07F084`), or the default script, resource `0x3000` plus the\n  method's number (`0x07F108`), when its class has none. A system object goes\n  to `DispatchSysObj` (`0x07F004`) and a heap object to `DispatchHeapObj`\n  (`0x07F1D8`). Any other value is the result itself (`0x07F254`).\n- Opcodes 0xA0 and up are the system calls (`0x0806E4`).\n\nAny other opcode throws \"Bad expr opcode\" (`0x080780`)."
   },
   {
    "name": "TInterp::IsTrue",
    "entry": 526692,
    "text": "Returns whether a value counts as true in a condition. True, a number other\nthan 0, a game object (type 4), a type-2 or type-3 value and a far address are\ntrue. False, None, 0 and every other type, a heap object (type 7) among them,\nare false (`0x080A08` to `0x080AA8`)."
   },
   {
    "name": "TInterp::IsEqual",
    "entry": 527068,
    "text": "Returns whether two values are equal. When both are strings (`IsString`) it\ncompares their text (`strcmp`, `0x080B3C`). Otherwise it compares the words."
   },
   {
    "name": "TInterp::DoInterpAt",
    "entry": 527512,
    "text": "Runs the statements of a script from an offset until a `return`, an `exit` or\na pending exception, and stores the result through its first argument. The\nstatements do as follows.\n\n- The `subroutine` statement opens a routine, reserving its locals on the\n  value stack (`0x080ED0`).\n- The `set_local` statement writes a local or an argument (`0x080F40`,\n  `0x080FA8`). The `write_near_word` statement writes a word of the script in\n  memory, and nothing saves it (`0x081178`). The `write_far_word` statement\n  writes the 4-byte word at a resource and an offset in the deciphered copy and\n  saves the resource enciphered to the most recently added archive\n  (`0x080FB0`, `stwx` at `0x081088`, `SaveEncryptedSegment` at `0x0810B0`). For\n  a missing resource it throws \"Can't set global in segment\" (`0x0810F4`).\n- The `set_index` statement stores through `AtPut` only for a number from 0\n  below the object's length (`0x081214` to `0x081278`), so it never makes a\n  list longer. The `set_field` statement writes a game object's field\n  (`SetField`, `0x08132C`) and the `set_global` statement a global\n  (`SetGlobal`, `0x081388`).\n- The `branch` statement jumps to an offset (`0x0813D8`). The `switch`\n  statement jumps through a table of offsets for a number from 0 below the\n  table's count, and past the table for any other value (`0x081434` to\n  `0x081498`).\n- The `if` statement jumps to its target when the condition is true. The\n  `if_not` statement runs what follows when the condition is true and jumps to\n  its target when it is false (`IsTrue`, `0x0818F0` and `0x081990`).\n- The `print` statement writes a value to the message pane, a number by \"%d\",\n  True, False and None as \"true\", \"false\" and \"None\", a game object by\n  `PrintObj`, and a global string or a string as its text, through\n  `HandleMapping` and `OutStr` (`0x081504` to `0x081750`). A byte below 0x80\n  in place of a statement starts text to print in the same way (`0x082368`).\n- The `return` statement stores its value as the result and ends the routine\n  (`0x0817C8`).\n- The `exit` statement calls the conversation object's virtual routines at\n  offsets 260 and 276, the second with the input's 64 bytes (`0x081A04` to\n  `0x081A28`), and puts \"bye\" in the input when it is still empty (`0x081A30`\n  to `0x081A44`). The `conversation_prompt` statement reads a prompt's text\n  (`0x081A5C`). For a prompt starting with `*` the player types a line into the\n  input through routine 276 (`0x081AA4`). Any other prompt goes to routine 280,\n  and the one character that routine returns becomes the input (`0x081AD4` to\n  `0x081B04`). The `conversation_response` statement jumps to its target when\n  the input starts with one of its comma-separated keywords, or the keyword is\n  `*` (the runtime's `strncmp`, called at `0x081BA4`). It skips no space after\n  a comma, so a keyword written after \", \" needs a space typed first. Parium's,\n  Crito's and Apis's lists, \"inn, pari\", \"inn, crit\" and \"inn, apis\", are such\n  lists.\n- The `ai_state` statement makes an exception of 16 bytes, with \"Raise\", the\n  state's number and a value, and sets it pending (`0x081C64` to `0x081CB8`).\n  The interpreter then returns at its next opcode, and its destructor throws\n  the exception. The `gui_close` statement releases a heap object or deletes a\n  system object (`0x08184C`, `0x0818AC`).\n- The calls run as in `DoExpr`, and the routine drops the result. A system\n  call as a statement works the same way (`0x0823EC`).\n\nAny other opcode throws \"Bad statement opcode\" (`0x082464`). When an\nexception passes through, the value stack goes back to the routine's frame and\nthe result is None (`0x0824F8` to `0x082580`)."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534104,
    "text": "Runs a method of an object with no arguments, pushing the object and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534260,
    "text": "Runs a method of an object with one argument, pushing both and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534472,
    "text": "Runs a method of an object with two arguments, pushing all three and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534724,
    "text": "Runs a method of an object with four arguments, pushing all five and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterpRoutine",
    "entry": 535052,
    "text": "Runs a whole script resource from its start with three arguments, in a new\n`TInterp` (`0x082AA0`, `DoInterpAt` at `0x082AC4`)."
   },
   {
    "name": "TInterp::DoInterp0",
    "entry": 535348,
    "text": "Runs a method of an object whose arguments are on the value stack, as the\n`method` opcode does, through a game object's class script, the default script\n`0x3000` plus the method (`0x082C4C`), `DispatchSysObj`, or `DispatchHeapObj`.\nIt also runs a far address as a routine at that offset (`0x082D7C`) and a\ntype-6 value as a whole script (`0x082E34`). Any other value gives None."
   },
   {
    "name": "TInterp::Dispatch",
    "entry": 536284,
    "text": "Looks up a method in a class's script. It deciphers the class script\n(`GetEncryptedSegment`, `0x082F04`), whose first halfword is the offset of its\ntable of methods, and returns 1 with the entry for the method (`At`,\n`0x082F40`) when it is not None, and 0 otherwise or when the class has no\nscript."
   },
   {
    "name": "TInterp::GetString",
    "entry": 536496,
    "text": "Copies text from a script into a buffer, up to a zero byte or a byte of 0x80 or\nabove, which is where the next opcode starts (`0x082FD4`), and returns the\naddress after it."
   },
   {
    "name": "TInterp::VAddrToPtr",
    "entry": 536604,
    "text": "Returns a pointer for a value, by its type through a jump table at toc +5620\n(`0x083080`). A far address points into its deciphered segment (`0x0830A4`). A\nframe reference points into the value stack (`0x0830C4`). An element of an\narray in a script resource points at that element. A global string comes from\n`GetGlobStr`. A game object gives its name (`SysObjToString`, or its method 2,\n`0x0831D8`). A heap string gives its characters. True, False and None give\n\"True\", \"False\" and \"None\" (`0x083258` to `0x0832A4`), where `print` writes\n\"true\" and \"false\". Any other value throws."
   },
   {
    "name": "TInterp::TInterp",
    "entry": 537532,
    "text": "Makes an interpreter for a script resource. It deciphers the script\n(`GetEncryptedSegment`, `0x083400`) and locks it in the cache while the object\nlives (`TCache::Lock`, `0x08341C`), sets the frame to the top of the value\nstack, and discards any pending exception (`0x083460` to `0x083484`)."
   },
   {
    "name": "TInterp::~TInterp",
    "entry": 537808,
    "text": "Unlocks the script (`TCache::Unlock`, `0x083508`). When an exception is\npending it throws it (`0x083544`), which is how a raise leaves the routine\nthat ran the script."
   },
   {
    "name": "TInterp::Len",
    "entry": 538028,
    "text": "Returns a value's length, 0 for a number, a heap object's length, a game\nobject's answer to method 3 (`0x083684`, `0x0836AC`), an array's count in a\nscript resource, or a string's `strlen`."
   },
   {
    "name": "TInterp::At",
    "entry": 538520,
    "text": "Returns the element at an index, through a game object's method 4\n(`0x083864`, `0x08388C`), a heap object's `At` (`0x0838E4`), or the byte of a\nstring or the element of an array in a script resource. A number or None gives\nNone."
   },
   {
    "name": "TInterp::AtPut",
    "entry": 539316,
    "text": "Stores a value at an index, through a heap object's `AtPut` (`0x083B48`), a\ngame object's method 5 (`0x083BD4`, `0x083C00`), or, for an array in a script\nresource, the word at the index in memory, with no check of the index against\nthe array's count (`0x083C58`). The `set_index` statement checks the length\nfirst. A number or None stays as it is."
   },
   {
    "name": "TInterp::HasProperty",
    "entry": 540472,
    "text": "Returns the entry a class's script has for a method or property, through `Dispatch`, or None."
   },
   {
    "name": "TInterp::GetProperty",
    "entry": 540648,
    "text": "Returns the element at an index of what a class's script has under a number (`Dispatch`, then `At`, `0x084048`), or None."
   },
   {
    "name": "TInterp::IsString",
    "entry": 605716,
    "text": "Returns the characters of a value that is a string, or 0. A far address or\ntype-3 value whose bytes are text, a heap string (`0x093F04`) and global\nstrings 1, 2 and 10 (`GetGlobStr`, `0x093F14` to `0x093F40`) are strings. It\nreturns 0 for numbers and every other value."
   }
  ]
 },
 "THeap": {
  "opening": "The store of the game's persistent objects, the lists, strings and tables that\nscripts make, which a save includes. The program makes one heap at startup,\nwith 4,096 references and 262,144 bytes (`CreateGlobals`), and the global at toc\n-30284 points at it. The object has the heap's memory at `+0`, a table of chunk\naddresses by reference number at `+4`, the number of references at `+8` (a\nshort) and the heap's size in bytes at `+12` (`THeap::InitHeap`, `0x0AB358` to\n`0x0AB380`). Beside it the heap allocates a second block once, 8,192 bytes at\nthe address in the global at toc -30428 (`0x0AB3D0`), 4,096 halfwords with the\nreference number of each thing's table (`PropItem::AllocateFrame`). A save has\nthe heap as resource `0xF307` and the second block as `0xF308` (`THeap::Save`,\n`0x0AB850` and `0x0AB880`).\n\nThe heap is a run of chunks, each an 8-byte header and its data. The header\nhas the data's size at `+0`, the reference number at `+4` and, in the byte at\n`+6`, a bit 0x80, a type in bits 0x70 (0 for a free chunk), a bit 0x08 that\nmeans the chunk has 4 bytes more than its size rounded up to 4\n(`THeap::DataChunkSize`, `0x0AC06C` to `0x0AC088`), a bit 0x04, and with the\nbyte at `+7` a 10-bit count (`THeap::Free`, `0x0AB4C0` to `0x0AB508`). A chunk's\ndata is its size rounded up to 4, plus the 4 bytes when bit 0x08 is 1, and the\nnext chunk follows it (`THeap::Next`). Nothing collects garbage\n(`THeap::PerformGC` is empty). An object goes when its count of references\nfalls to 0 (`THeapObj::DecRef`).",
  "routines": [
   {
    "name": "THeap::InitHeap",
    "entry": 701228,
    "text": "Makes an empty heap of a number of references and a size. It allocates the\nmemory and a cleared table (`NewPtrClear`, `0x0AB364`, `0x0AB378`) and makes the\nwhole heap one free chunk (`0x0AB3BC`). It allocates the 8,192-byte block the\nfirst time (`0x0AB3D0`). No memory throws \"Can't allocate persistant storage\nheap\" [sic] or \"Can't allocate unique object storage map\"."
   },
   {
    "name": "THeap::GetHeader",
    "entry": 701520,
    "text": "Returns the chunk of a reference number, from the table (`0x0AB454`, `0x0AB458`)."
   },
   {
    "name": "THeap::Free",
    "entry": 701576,
    "text": "Frees a chunk. It clears the chunk's entry in the table (`0x0AB4B8`), makes it a\nfree chunk of its whole size with its reference and count at 0 (`0x0AB4C0` to\n`0x0AB508`), and joins each free chunk that follows to it (`0x0AB51C` to\n`0x0AB554`). It releases none of the objects in the chunk's data."
   },
   {
    "name": "THeap::Allocate",
    "entry": 701860,
    "text": "Allocates a chunk of a size for a reference number and a type\n(`THeap::Allocate` at `0x0ABCF4`, called at `0x0AB5D0`), and enters it in the\ntable under the number (`0x0AB5E8`)."
   },
   {
    "name": "THeap::Resize",
    "entry": 702036,
    "text": "Changes a chunk's size and returns the chunk, which can be a new one. A size\nno larger than the chunk's present space stays in place. When at least 8 bytes\nremain over, they become a free chunk after it (`0x0AB694` to `0x0AB710`).\nOtherwise it sets bit 0x08 when 4 to 7 bytes remain over (`0x0AB718` to\n`0x0AB730`). It leaves a bit 0x08 already at 1 as it is when 0 to 3 remain\nover, so the chunk's space then counts 4 bytes more than it has, and the heap\nlooks for the next chunk 4 bytes too far on (`0x0AB720`, `DataChunkSize`).\nFound reading, not shown in a run. A larger size allocates a new chunk\n(`0x0AB748`), points the table at it, copies the data, the reference and the\nflags (`0x0AB768` to `0x0AB7CC`) and frees the old one (`0x0AB7D4`). It reads\nthe old chunk's address before the allocation and uses it after, and the\nallocation can move every chunk in use (`Allocate` at `0x0ABCF4`). After a move\nthe copy and the free act on whatever chunk then sits at the old address. A\ngrow reaches this only when no free run fits but the free space in total does.\nFound reading, not shown in a run."
   },
   {
    "name": "THeap::Save",
    "entry": 702496,
    "text": "Writes the heap to an archive as resource `0xF307` and the 8,192-byte block as\n`0xF308` (`TSegFile::SaveSegment`, `0x0AB850`, `0x0AB880`), then the table of\ncontents when it has changed, and otherwise flushes the file."
   },
   {
    "name": "THeap::Load",
    "entry": 702716,
    "text": "Reads the heap from an archive, looking into the archive's table of contents\nfor page `0xF3` directly (`+980` of the `TSegFile`, `0x0AB914`). When resource\n`0xF307` is there, it reads a stored heap shorter than this one and makes the\nrest one free chunk (`0x0AB96C` to `0x0AB9F0`), reads one of the same size\nwhole (`0x0ABA14`), and throws \"Reducing Heap Size Not Implemented\" for a longer\none (`0x0ABA34`), so a save from a larger heap fails to load. Then it rebuilds\nthe table (`RebuildTOC`, `0x0ABA40`). When `0xF308` is there it reads it into\nthe 8,192-byte block (`0x0ABA88`), whatever its length."
   },
   {
    "name": "THeap::NewRef",
    "entry": 703184,
    "text": "Returns the first reference number from 1 up whose table entry is empty, and\nthrows \"Out of persistant storage objects\" [sic] when every one is in use\n(`0x0ABAF0` to `0x0ABB38`)."
   },
   {
    "name": "THeap::SimpleAllocate",
    "entry": 703360,
    "text": "Looks for a free run of chunks big enough for a size, first fit from the\nstart. It joins free chunks next to each other as it goes (`0x0ABBD8` to\n`0x0ABBF4`), cuts the first run big enough to the size (`Resize`, `0x0ABC30`)\nand returns it. It adds the space of each run too small to the total through\nits third argument (`0x0ABC38` to `0x0ABC60`) and returns 0 when none fits."
   },
   {
    "name": "THeap::PerformGC",
    "entry": 703688,
    "text": "Does nothing (4 bytes, a return)."
   },
   {
    "name": "THeap::Allocate",
    "entry": 703732,
    "text": "Allocates a chunk of a size, first from the free space as it is\n(`SimpleAllocate`, `0x0ABD28`). When nothing fits and the free space in total\nis too small, it calls `PerformGC`, which does nothing, tries again and throws\n\"Out of persistant storage space\" [sic] (`0x0ABD90`). When the free space is\nenough but in pieces, it moves every chunk in use down to the start of the\nheap, pointing the table at each (`0x0ABD98` to `0x0ABE2C`), and cuts the\nchunk from the free space left at the end (`0x0ABE70` to `0x0ABF14`). It\nthrows when even that is too small (`0x0ABE68`)."
   },
   {
    "name": "THeap::RebuildTOC",
    "entry": 704340,
    "text": "Rebuilds the table of chunks by reference number from the heap's chunks. At\nthe first chunk that is larger than the heap, has a type above 3, or has a\nreference number above the count, it stops and makes a free chunk of the rest\nof the heap (`0x0ABF80` to `0x0ABFD8`). It enters each chunk in use with a\nreference number in the table (`0x0ABFE0` to `0x0AC004`). A reference number\nequal to the count passes the test (`0x0ABFA8`), and the table entry for it\nlands one past the table's end."
   },
   {
    "name": "THeap::DataChunkSize",
    "entry": 704612,
    "text": "Returns a chunk's space for data, its size rounded up to 4 plus 4 when bit 0x08 is 1 (`0x0AC06C` to `0x0AC088`)."
   },
   {
    "name": "THeap::Next",
    "entry": 704712,
    "text": "Returns the chunk after one, at the header plus 8 plus the data's space, or 0 at the heap's end (`0x0AC0F4` to `0x0AC10C`)."
   },
   {
    "name": "THeap::RecoverHeader",
    "entry": 704868,
    "text": "Returns the chunk's header from the address of its data, 8 bytes before (`0x0AC16C`)."
   }
  ]
 },
 "THeapList": {
  "opening": "A list in the persistent heap, the data of a chunk of type 1. It has the length\nat `+0`, the room at `+2` (both shorts) and from `+4` the items, one value word\neach (`THeapList::THeapList`, `0x0A9DFC`, `0x0A9E18`).",
  "routines": [
   {
    "name": "THeapList::Allocate",
    "entry": 695516,
    "text": "Allocates a list of a length for a reference number, a chunk of type 1 (`THeap::Allocate`, `0x0A9D14`), and makes the list in it."
   },
   {
    "name": "THeapList::CalcSize",
    "entry": 695676,
    "text": "Returns the bytes a list of a length needs, 4 plus 4 for each item, with room for at least 4 (`0x0A9D80` to `0x0A9D98`)."
   },
   {
    "name": "THeapList::THeapList",
    "entry": 695756,
    "text": "Makes a list of a length, storing the length at `+0` (`0x0A9DFC`), with room for\nthe length and at least 4 (`0x0A9E18`), every item None (`0x0A9E3C` to\n`0x0A9E60`)."
   },
   {
    "name": "THeapList::~THeapList",
    "entry": 695984,
    "text": "Releases every item (`VAddr::DecRef`, `0x0A9EE8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapList::Length",
    "entry": 696156,
    "text": "Returns the length."
   },
   {
    "name": "THeapList::GetItem",
    "entry": 696204,
    "text": "Returns the item at an index, or None for an index below 0 or not below the length (`0x0A9F8C` to `0x0A9FC4`)."
   },
   {
    "name": "THeapList::SetItem",
    "entry": 696308,
    "text": "Stores a value at an index from 0 below the length, counting a reference to it\nand releasing the old item (`0x0AA04C`, `0x0AA060`). An index outside does\nnothing, and so does the same value again."
   },
   {
    "name": "THeapList::Append",
    "entry": 696512,
    "text": "Adds a value at the end, counting a reference to it (`0x0AA140`). A full list\nfirst doubles its room and grows its chunk (`THeap::Resize`, `0x0AA0F4` to\n`0x0AA120`), which can move it, and then the value goes on the end of the list\nat its new place (`0x0AA134`)."
   }
  ]
 },
 "THeapDict": {
  "opening": "A table from numbers to values in the persistent heap, the data of a chunk of\ntype 2. It has the count at `+0`, the table's size at `+2` and from `+4` the\nentries, 8 bytes each, a key (a short) and a value. An empty entry has as its\nvalue `0x5000FFFE`, the word in the global at toc -29280 (`THeapDict::THeapDict`,\n`0x0AA3E0`), which the program's start-up code sets beside None (`0x5000FFFF`),\nTrue (`0x50000001`) and False (`0x50000000`) (`__sinit_THeap_cp`), so a table\ncan have None as a value. Nothing removes an entry. The sizes are primes from a\nlist at toc +11896, 3, 7, 13, 31, 61, 127, 251, 509, 1021, 2017, 4093, 5987,\n9551, 15683, 19609 and 31397 (`THeapDict::BestSize`, `0x0AA268`).",
  "routines": [
   {
    "name": "THeapDict::Allocate",
    "entry": 696744,
    "text": "Allocates a table for a number of entries and a reference number, a chunk of\ntype 2 (`THeap::Allocate`, `0x0AA1E8`), and makes the table in it at the size\n`BestSize` gives (`0x0AA1FC`)."
   },
   {
    "name": "THeapDict::BestSize",
    "entry": 696928,
    "text": "Returns the first size in the list above twice a number (`0x0AA280` to `0x0AA28C`), and throws \"HeapDict overflow\" past the last (`0x0AA2BC`)."
   },
   {
    "name": "THeapDict::CalcSize",
    "entry": 697096,
    "text": "Returns the bytes a table for a number of entries needs, 4 plus 8 for each entry of its size (`0x0AA31C` to `0x0AA330`)."
   },
   {
    "name": "THeapDict::THeapDict",
    "entry": 697196,
    "text": "Makes an empty table of a size, every entry with key 0 and the empty value (`0x0AA3C4` to `0x0AA3FC`)."
   },
   {
    "name": "THeapDict::~THeapDict",
    "entry": 697484,
    "text": "Releases every value that is not empty (`VAddr::DecRef`, `0x0AA4E8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapDict::lookup",
    "entry": 697696,
    "text": "Returns the entry for a key, or 0 when there is none. It starts at the key\nmodulo the size and steps by a second number from the key, the key times 3\nplus 1, repeated until it is not a multiple of the size, modulo the size\n(`0x0AA584` to `0x0AA5A4`), until it finds the key or an empty entry\n(`0x0AA5A8` to `0x0AA604`)."
   },
   {
    "name": "THeapDict::insert",
    "entry": 697912,
    "text": "Stores a value under a key, searching as `lookup` does. It writes the key and\nthe value into an empty entry and adds 1 to the count (`0x0AA6B4` to\n`0x0AA6C8`). In an entry with the key it releases the old value and stores the\nnew one (`0x0AA6E4`). It counts no reference to the value."
   },
   {
    "name": "THeapDict::resize",
    "entry": 698204,
    "text": "Makes a larger table and returns it. It allocates the new table under the same\nreference number (`0x0AA788`, `0x0AA78C`) for `BestSize` of `BestSize` of the\ncount, so the new size is the first above twice the first above twice the\ncount. It inserts every entry into the new table (`0x0AA79C` to `0x0AA7E4`)\nand frees the old chunk (`0x0AA7FC`)."
   },
   {
    "name": "THeapDict::GetItem",
    "entry": 698436,
    "text": "Returns the value under a key, or None (`0x0AA86C` to `0x0AA88C`)."
   },
   {
    "name": "THeapDict::SetItem",
    "entry": 698576,
    "text": "Stores a value under a key, counting a reference to it (`0x0AA8F8`). When the\ncount times 3 is at least the size times 2, it first makes the table larger\n(`resize`, `0x0AA918`) and stores the value in the new one."
   }
  ]
 },
 "THeapObj": {
  "opening": "A reference to an object in the persistent heap, a 2-byte reference number,\nwhich a value word of type 7 has in its low half. The object's type is the\nchunk's type, 1 a list (`THeapList`), 2 a table (`THeapDict`), 3 a string, the\ncharacters and a zero byte. Its count of references is the chunk header's\n10-bit count (`THeap`).",
  "routines": [
   {
    "name": "THeapObj::IncRef",
    "entry": 698760,
    "text": "Adds 1 to the object's count (`0x0AA9C0` to `0x0AA9CC`). The count is 10 bits,\nso 1,023 references and one more give 0."
   },
   {
    "name": "THeapObj::DecRef",
    "entry": 698892,
    "text": "Subtracts 1 from the object's count (`0x0AAAA0` to `0x0AAAB4`), or, when the count is\n1 or 0, frees the object (`0x0AAA44`), first releasing a list's items or a\ntable's values (`0x0AAA74`, `0x0AAA84`) and then the chunk (`THeap::Free`,\n`0x0AAA94`)."
   },
   {
    "name": "THeapObj::GetType",
    "entry": 699124,
    "text": "Returns the object's type (`0x0AAB2C`)."
   },
   {
    "name": "THeapObj::At",
    "entry": 699228,
    "text": "Returns the item at an index of a list (`THeapList::GetItem`, `0x0AABD8`), the\nvalue under a key of a table (`THeapDict::GetItem`, `0x0AABEC`), or a string's\nbyte at an index below the chunk's size as a number, read signed\n(`0x0AABF4` to `0x0AAC18`). The index can be the string's zero byte. Any\nother gives None."
   },
   {
    "name": "THeapObj::AtPut",
    "entry": 699520,
    "text": "Stores a value at an index of a list (`THeapList::SetItem`, `0x0AACF4`) or under\na key of a table (`THeapDict::SetItem`, `0x0AAD08`), or a number's low byte at\nan index of a string below the chunk's size (`0x0AAD10` to `0x0AAD44`), which\ncan be the zero byte at its end."
   },
   {
    "name": "THeapObj::Append",
    "entry": 699788,
    "text": "Adds a value at the end of a list (`THeapList::Append`, `0x0AADD8`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::Length",
    "entry": 699932,
    "text": "Returns a list's length (`0x0AAE7C`), a string's chunk size less 1\n(`0x0AAE84`), 32,767 for a table (`0x0AAE90`), and 0 for any other."
   },
   {
    "name": "THeapObj::THeapObj",
    "entry": 700120,
    "text": "Makes an object of a type, with a size or length and a reference number, a new\none (`THeap::NewRef`, `0x0AAF0C`) when the number given is 0. Their classes make\na list and a table (`0x0AAF48`, `0x0AAF58`). A string is a chunk of type 3 of\nthe size with a zero first byte (`0x0AAF70`, `0x0AAF7C`), and any other type an\nempty chunk (`0x0AAF94`). Its count starts at 0."
   },
   {
    "name": "THeapObj::GetString",
    "entry": 700392,
    "text": "Returns the address of the object's data, a string's characters (`0x0AB014`)."
   },
   {
    "name": "THeapObj::ResizeString",
    "entry": 700496,
    "text": "Changes a string's chunk to a size (`THeap::Resize`, `0x0AB0A4`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::DispatchHeapObj",
    "entry": 700652,
    "text": "Runs a method of a script on an object, the `method` opcode's route for a value\nof type 7. Method 3 gives the length (`0x0AB158`), 4 the item at an index\n(`0x0AB184`), and 5 stores a value at an index and gives the object\n(`0x0AB1A4`). Method 7 adds the arguments to a list (`0x0AB1E0` to\n`0x0AB20C`), or adds their text to a string after growing the string's chunk to\nthe total (`0x0AB21C` to `0x0AB2C4`), and gives the object. A table, other\nmethods and other types give None (`0x0AB2D4`)."
   }
  ]
 },
 "VAddr": {
  "opening": "A value of the script machine, a 32-bit word. Its top 4 bits are its type, read\nsigned, so a word with the top bit set is type -1, a far address, a resource\nnumber in bits 16 to 30 and an offset in the low 16 (`VAddr::VAddr`,\n`0x0077F8` to `0x007808`). Type 0 is a number of 28 bits. Type 5 is None, True\nand False, `0x5000FFFF`, `0x50000001` and `0x50000000`. Type 4 is a game object,\nwith bit 24 at 1 for a system object (`VAddr::DecRef`, `0x0A9B98`). Type 7 is a\nheap object, its reference number in the low 16 bits.",
  "routines": [
   {
    "name": "VAddr::VAddr",
    "entry": 30700,
    "text": "Makes a value from a type and two halves, the type in the top 4 bits and the halves in the rest (`0x007810` to `0x007820`), or a far address for type -1 (`0x0077F8` to `0x007808`)."
   },
   {
    "name": "VAddr::VAddr",
    "entry": 541068,
    "text": "Makes the value 0."
   },
   {
    "name": "VAddr::DecRef",
    "entry": 695116,
    "text": "Releases a value. It deletes a system object (`DeleteSysObj`, `0x0A9BB0`) and\nlowers a heap object's count of references by 1 (`THeapObj::DecRef`,\n`0x0A9BFC`). Other values stay as they are."
   },
   {
    "name": "VAddr::IncRef",
    "entry": 695360,
    "text": "Counts a reference to a heap object (`THeapObj::IncRef`, `0x0A9C98`). It counts no other value, system objects among them."
   }
  ]
 },
 "PropItem": {
  "opening": "A thing in the game's world. The one routine here gives it a table in the\npersistent heap.",
  "routines": [
   {
    "name": "PropItem::AllocateFrame",
    "entry": 31836,
    "text": "Returns the thing's table, the heap object at `+12` when it is a table\n(`0x007C8C` to `0x007C9C`). Otherwise it makes a new table (`THeapObj::THeapObj`,\n`0x007CB4`), counts a reference to it, stores it at `+12` and, when the thing\nhas a number at `+8`, enters the table's reference number in the 8,192-byte\nblock of `THeap` at twice that number (`0x007CDC` to `0x007CF0`)."
   }
  ]
 },
 "TSegLoad": {
  "opening": "A copy of one resource of an archive in memory allocated for it, the address\nat `+0`.",
  "routines": [
   {
    "name": "TSegLoad::TSegLoad",
    "entry": 505940,
    "text": "Reads a resource of an archive whole into new memory (`NewPtr`, `0x07B8C8`,\n`TSegFile::LoadSegment`, `0x07B8EC`), its length from the archive's table\ndirectly (`0x07B888` to `0x07B8B0`). A missing resource or no memory leaves the\naddress 0."
   },
   {
    "name": "TSegLoad::~TSegLoad",
    "entry": 506168,
    "text": "Frees the memory (`DisposePtr`, `0x07B964`) and the object when the flag is above 0."
   },
   {
    "name": "TSegLoad::Loaded",
    "entry": 506304,
    "text": "Returns 1 when the read succeeded, the address not 0 (`0x07B9C0` to `0x07B9D0`)."
   },
   {
    "name": "TSegLoad::opPc",
    "entry": 506368,
    "text": "Returns the address of the copy."
   }
  ]
 },
 "TSpinCursor": {
  "opening": "The animated cursor that shows while the game is busy, from an 'acur' resource.\nThe game makes the object on the stack around the work. The counts of nesting\nand the cursor's frames are globals, so a second object made while one spins\ndoes nothing (`TSpinCursor::TSpinCursor`, `0x00F860`).",
  "routines": [
   {
    "name": "TSpinCursor::TSpinCursor",
    "entry": 63516,
    "text": "Starts the animated cursor of an 'acur' id. When the last cursor had the same\nid, it uses its frames again (`0x00F884` to `0x00F8A8`). Otherwise it releases\nthe old frames (`ResetCursor`, `0x00F8AC`) and reads the 'acur' (`GetResource`,\n`0x00F8C8`), up to 16 frames (`0x00F918` to `0x00F92C`), each a color cursor\n(`GetCCursor`, `0x00F964`), or a black-and-white one (`GetCursor`, `0x00F9C8`)\nwhen the first color one is missing (`0x00F974` to `0x00F998`). A later frame\nthat is missing stays empty. Then it shows the first frame (`Spin`,\n`0x00FA80`). With no 'acur' it shows the watch cursor (`GetCursor` of 4,\n`0x00FA90`)."
   },
   {
    "name": "TSpinCursor::Spin",
    "entry": 64228,
    "text": "Shows the next frame when 10 ticks or more have passed since the last\n(`TickCount`, `0x00FB28` to `0x00FB44`), as a color cursor or a black-and-white\none (`0x00FBCC`, `0x00FBE8`), and only while a flag of the application object\nat `+30` is 1 (`0x00FB14` to `0x00FB24`). It shows the frame it is at and then\nmoves to the next, wrapping at the number of frames (`0x00FB64` to\n`0x00FBA0`)."
   },
   {
    "name": "TSpinCursor::~TSpinCursor",
    "entry": 64568,
    "text": "Ends a nesting. When the last one ends, the frames stay in memory, marked for\nrelease if the next cursor is a different one (`0x00FC84` to `0x00FC8C`)."
   },
   {
    "name": "TSpinCursor::ResetCursor",
    "entry": 64744,
    "text": "Releases every frame and the 'acur' (`DisposeHandle`, `0x00FD58`, `0x00FD88`)."
   }
  ]
 }
};
