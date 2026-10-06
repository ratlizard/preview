/* mac-hfs.js -- write a classic HFS volume, forks and all.
   =========================================================================

   `writeHfsImage()` turns a tree of files into the bytes of a `.dsk` disk
   image that an emulated Mac will mount. It is the last step of the path this
   repository has been building towards from the other end: index.html can
   already open the archive, edit a resource and serialise the whole thing back
   out through `writeDelverArchive`, but what came out was a file on a modern
   computer, and the game that reads it lives inside an emulator. A disk image
   is the only container the mobile shell (now in ratlizard/alchemy)'s emulator will take.

   WHERE THE FORMAT CAME FROM

   This is the case CLAUDE.md's licensing note names explicitly: "copy freely
   where there is no oracle role (the rdasm assembler, StuffIt, HFS, Installer
   VISE -- infrastructure this tree lacks entirely)". The on-disk layout here
   -- every field offset in the master directory block, the catalog record
   shapes, the B-tree node descriptor and header record -- was read from
   `src/disk_image/hfs.rs` in benletchford/systemless (GPL-3.0-or-later), which
   is a *reader*, and from the synthetic-volume builder in its test module,
   which is the same knowledge written from the writing side. Nothing is
   claimed to be independent of it, and `utilities/hfs_check.mjs` therefore
   does not pretend systemless is an oracle for this file: it runs systemless's
   reader over what this writes as a round-trip, which is worth having, and the
   real check is that a real Mac OS mounts the result.

   WHAT IT WRITES

   The smallest thing that is a valid HFS volume and no smaller:

       sector 0-1    boot blocks, zero -- the volume is mountable, not bootable
       sector 2      the master directory block
       sector 3..    the volume bitmap, one bit per allocation block
       ...           the allocation blocks: extents overflow file, then the
                     catalog file, then every fork, each one contiguous
       last-1        the alternate master directory block
       last          reserved, zero

   Every fork is laid down in one piece, which is what keeps the extents
   overflow file empty: a fork only needs the overflow tree when it is in more
   than three pieces, and nothing here is ever in more than one. The overflow
   file still exists -- a header node with no records -- because the File
   Manager expects a tree there, not a hole.

   TWO THINGS THAT ARE FIXED AND NOT ARBITRARY

   **Node size is 512.** HFS B-tree nodes are always 512 bytes; the field is in
   the header record because HFS+ made it variable, not because HFS did. That
   is the constraint that forces the index-node code below to exist: three or
   four catalog records fill a node, so anything past a couple of files needs
   more than one leaf and therefore a level above them.

   **An index record is shaped exactly like a leaf record.** Its key is
   variable-length and its "data" is the four-byte number of the child node,
   beginning at the next even offset after the key -- which is to say at
   `align_even(1 + keyLengthByte)`, the same rule leaf records follow.

   That sentence cost three volumes and is the one piece of the format
   systemless's reader could not settle: it walks the leaf chain from bthFNode
   and never opens an index node at all. It was settled the way things get
   settled here, by building three volumes that differed only in this and
   mounting each one in a real Mac OS 7.6:

       key variable, pointer at align_even(1 + keyLen)   mounts
       key padded to 38, length byte 37, pointer at 38   mounts
       key padded to 38, length byte actual, pointer 38  "The disk ... cannot
                                                          be used, because it
                                                          cannot be found."

   So the File Manager is not reading a fixed-width key; it is doing what it
   does in a leaf, following the length byte to the data. Apple's own HFS
   writes the middle form -- a full-width key with the length byte to match --
   and this writes the first, which is the same rule and fits more index
   records in a node. If a future reader here ever has to walk an index node,
   that is what it must expect.

   THE DESKTOP-FILE ALERT IS NOT COSMETIC. KEEP THE CATALOG TO ONE LEAF.

   On a volume whose catalog needs more than one leaf node, Mac OS puts up this
   on mounting:

       An error occured while rebuilding the desktop file on the disk "...";
       comments from info windows were not preserved.

   Everything on the volume is there and readable -- the window lists it all,
   which is also what says the index nodes above are right -- so this was
   written down as cosmetic. It is not. **The alert is modal**: it holds the
   keyboard until someone presses OK, and the mobile shell (now in ratlizard/alchemy)'s Install drives the
   Finder by typing at it, so every keystroke goes into a dialog that ignores
   them and the install silently does nothing. That was found by running the
   thing end to end, and by nothing else: every test until then had used a
   two-file disk, which fits one leaf and raises no alert.

   So the line matters, and it is exactly one catalog leaf: with names this
   length, three files. index.html writes two -- the archive and the script
   -- and its Read Me was folded into the script's comments to stay under it.
   the mobile shell (now in ratlizard/alchemy) sends Return before anything else, which presses the alert's OK
   if one is up; both halves, because a larger export than the current one
   should still install.

   The cause underneath is that the emulator mounts a dropped disk image
   **read-only** -- the Finder draws a padlock in the window's header -- and a
   read-only volume with no Desktop DB is one the Finder cannot build one on.
   Volumes under about 2 MB escape it whatever their catalog looks like,
   because below that size the Finder keeps the older single "Desktop" file
   and takes a different path.

   Three fixes were tried against a real Mac OS 7.6 and none of them helps,
   so do not try them again: leaving free nodes in the catalog B-tree (kept
   anyway, see hfsBuildBTree), setting the software-lock bit in drAtrb, and
   writing a non-zero volume identifier into drFndrInfo. What would actually
   fix it is shipping a valid Desktop DB and Desktop DF on the volume, the way
   a pressed CD-ROM does -- that is a second B-tree format again, and it buys
   only the suppression of one alert.

   NAMES ARE FOLDED TO ASCII

   The catalog is a B*-tree, so the Mac finds a file by binary search and the
   order records are written in *is* the lookup. HFS orders names by the Roman
   script's uppercasing table, which this file does not have; for ASCII that
   table is just a-z to A-Z, which it does. So `hfsSafeName` replaces anything
   outside printable ASCII (and the ':' that HFS uses as its path separator)
   before the name is used, and the ordering below is then exactly right rather
   than approximately right. Everything this exports is named in ASCII anyway.

   Part of https://github.com/ratlizard/grimoire -- GPL-3.0-or-later.
   Depends on js/mac-bytes.js (encodeMacRoman).
*/

const HFS_SECTOR = 512;
const HFS_MDB_SECTOR = 2;
const HFS_SIGNATURE = 0x4244;          // 'BD'
const HFS_ROOT_PARENT_CNID = 1;
const HFS_ROOT_CNID = 2;
// HFS reserves the first sixteen catalog node IDs -- 3 is the extents overflow
// file and 4 the catalog itself -- so a real Mac starts drNxtCNID at 16.
const HFS_FIRST_USER_CNID = 16;
const HFS_NODE_SIZE = 512;
const HFS_CAT_KEY_LEN = 37;            // ckrResrv1 + ckrParID + Str31
const HFS_EXT_KEY_LEN = 7;
const HFS_MAC_EPOCH_OFFSET = 2082844800;   // seconds between 1904 and 1970

// Node kinds, as ndType. Leaf is -1 and stored as 0xFF.
const HFS_ND_INDEX = 0, HFS_ND_HEADER = 1, HFS_ND_LEAF = 0xFF;

// Empty nodes left at the end of every B-tree so the File Manager has
// somewhere to split into. See hfsBuildBTree for what happens without them.
const HFS_SPARE_NODES = 8;

function hfsMacTime(date) {
    return Math.floor((date || new Date()).getTime() / 1000) + HFS_MAC_EPOCH_OFFSET;
}

/* HFS has no path separator inside a name -- ':' is the separator -- and this
   file's key ordering is only exact for ASCII (see the header). A name that
   loses characters here is better than a volume whose catalog the Mac cannot
   search. */
function hfsSafeName(name, fallback) {
    let out = '';
    for (const ch of String(name === undefined || name === null ? '' : name)) {
        const c = ch.codePointAt(0);
        out += (c >= 0x20 && c < 0x7F && ch !== ':') ? ch : '_';
    }
    out = out.replace(/^\s+|\s+$/g, '').slice(0, 31);
    return out || (fallback || 'Untitled');
}

// The comparison the Mac's FastRelString makes, for ASCII: uppercase, then
// byte order, then the shorter name first.
function hfsCompareNames(a, b) {
    const up = s => s.toUpperCase();
    const x = up(a), y = up(b);
    const n = Math.min(x.length, y.length);
    for (let i = 0; i < n; i++) {
        const d = x.charCodeAt(i) - y.charCodeAt(i);
        if (d) return d;
    }
    return x.length - y.length;
}

function hfsCompareKeys(a, b) {
    if (a.parent !== b.parent) return a.parent - b.parent;
    return hfsCompareNames(a.name, b.name);
}

// ---- little writers -------------------------------------------------------

function hfsPut16(bytes, at, v) { bytes[at] = (v >>> 8) & 0xFF; bytes[at + 1] = v & 0xFF; }
function hfsPut32(bytes, at, v) {
    bytes[at] = (v / 0x1000000) & 0xFF; bytes[at + 1] = (v >>> 16) & 0xFF;
    bytes[at + 2] = (v >>> 8) & 0xFF; bytes[at + 3] = v & 0xFF;
}
function hfsPutFourCC(bytes, at, s) {
    const b = encodeMacRoman(((s || '????') + '    ').slice(0, 4));
    for (let i = 0; i < 4; i++) bytes[at + i] = b[i] === undefined ? 0x20 : b[i];
}
// Str31/Str27: a length byte then the characters, in a field of a fixed width.
function hfsPutPString(bytes, at, s, width) {
    const b = encodeMacRoman(s);
    const n = Math.min(b.length, width - 1);
    bytes[at] = n;
    for (let i = 0; i < n; i++) bytes[at + 1 + i] = b[i];
}
const hfsEven = n => (n + 1) & ~1;

// ---- catalog records ------------------------------------------------------
/* Each record is [key][data], with the data starting at the next even offset
   after the key. The key is a length byte, a reserved byte, the parent's CNID
   and the name as a Str31 -- so ckrKeyLen counts everything after itself,
   which is 6 + the name's length. */

function hfsCatalogKeyBytes(parent, name) {
    const nameBytes = encodeMacRoman(name);
    const keyLen = 6 + nameBytes.length;
    const out = new Uint8Array(hfsEven(1 + keyLen));
    out[0] = keyLen;
    hfsPut32(out, 2, parent);
    out[6] = nameBytes.length;
    out.set(nameBytes, 7);
    return out;
}

function hfsRecord(parent, name, dataLen, fill) {
    const key = hfsCatalogKeyBytes(parent, name);
    const rec = new Uint8Array(key.length + dataLen);
    rec.set(key, 0);
    fill(rec.subarray(key.length));
    return { key: { parent: parent, name: name }, bytes: rec };
}

function hfsDirRecord(parent, name, cnid, valence, when) {
    return hfsRecord(parent, name, 70, d => {
        d[0] = 1;                          // cdrDirRec
        hfsPut16(d, 4, valence);           // dirVal
        hfsPut32(d, 6, cnid);              // dirDirID
        hfsPut32(d, 10, when);             // dirCrDat
        hfsPut32(d, 14, when);             // dirMdDat
    });
}

function hfsThreadRecord(cnid, parent, name, when) {
    // Keyed on the directory's own CNID with an empty name; it is what lets the
    // File Manager walk a CNID back up to a path.
    return hfsRecord(cnid, '', 46, d => {
        d[0] = 3;                          // cdrThdRec
        hfsPut32(d, 10, parent);           // thdParID
        hfsPutPString(d, 14, name, 32);    // thdCName
    });
}

function hfsFileRecord(parent, file, when) {
    return hfsRecord(parent, file.name, 102, d => {
        d[0] = 2;                          // cdrFilRec
        d[2] = 0;                          // filFlags -- not locked, no thread
        hfsPutFourCC(d, 4, file.type);     // filUsrWds.fdType
        hfsPutFourCC(d, 8, file.creator);  // filUsrWds.fdCreator
        hfsPut16(d, 12, file.finderFlags || 0);
        hfsPut32(d, 20, file.cnid);        // filFlNum
        hfsPut16(d, 24, file.dataStart);   // filStBlk
        hfsPut32(d, 26, file.data.length); // filLgLen
        hfsPut32(d, 30, file.dataPhysical);// filPyLen
        hfsPut16(d, 34, file.rsrcStart);   // filRStBlk
        hfsPut32(d, 36, file.rsrc.length); // filRLgLen
        hfsPut32(d, 40, file.rsrcPhysical);// filRPyLen
        hfsPut32(d, 44, when);             // filCrDat
        hfsPut32(d, 48, when);             // filMdDat
        // filExtRec / filRExtRec: one extent each, because every fork here is
        // laid down contiguously. That is what keeps the overflow tree empty.
        hfsPut16(d, 74, file.dataStart);
        hfsPut16(d, 76, file.dataBlocks);
        hfsPut16(d, 86, file.rsrcStart);
        hfsPut16(d, 88, file.rsrcBlocks);
    });
}

// ---- the B-tree -----------------------------------------------------------

function hfsWriteNodeRecords(node, records, type, height, fLink, bLink) {
    node[8] = type;
    node[9] = height;
    hfsPut16(node, 10, records.length);
    hfsPut32(node, 0, fLink);
    hfsPut32(node, 4, bLink);
    let cursor = 14;
    for (let i = 0; i < records.length; i++) {
        node.set(records[i], cursor);
        hfsPut16(node, HFS_NODE_SIZE - (i + 1) * 2, cursor);
        cursor += records[i].length;
    }
    hfsPut16(node, HFS_NODE_SIZE - (records.length + 1) * 2, cursor);
}

// The most a node can hold: the descriptor at the front, and two bytes of
// offset table at the back for every record plus one for the free space.
function hfsNodeFits(usedBytes, recordCount, addLen) {
    return 14 + usedBytes + addLen + (recordCount + 2) * 2 <= HFS_NODE_SIZE;
}

function hfsPackNodes(records) {
    const nodes = [];
    let current = [], used = 0;
    for (const rec of records) {
        if (current.length && !hfsNodeFits(used, current.length, rec.bytes.length)) {
            nodes.push(current); current = []; used = 0;
        }
        if (!hfsNodeFits(used, current.length, rec.bytes.length))
            throw new Error('HFS: a catalog record does not fit in a 512-byte node');
        current.push(rec); used += rec.bytes.length;
    }
    if (current.length) nodes.push(current);
    return nodes;
}

/* An index record: the first key of the node it points at, then that node's
   number as the record's four bytes of data -- at the next even offset after
   the key, exactly as a leaf record's data is. See the header for the three
   volumes that established that. */
function hfsIndexRecord(key, nodeNumber) {
    const packed = hfsCatalogKeyBytes(key.parent, key.name);
    const rec = new Uint8Array(packed.length + 4);
    rec.set(packed, 0);
    hfsPut32(rec, packed.length, nodeNumber);
    return rec;
}

/* Build the whole tree file. `records` must already be in key order.
   Node 0 is the header; the leaves follow; index levels follow those; and
   `spare` empty nodes follow all of it.

   The spares are what a real formatter leaves: a tree with no free node
   cannot be split, and a tree that cannot be split cannot be inserted into.
   Nothing here inserts, so they are insurance rather than a fix -- see the
   note on the desktop-file alert at the end of the file header, where they
   were first (wrongly) blamed. Eight nodes is 4 KB. */
function hfsBuildBTree(records, keyLen, spare) {
    const leafGroups = hfsPackNodes(records);
    const levels = [];
    // Level 0: the leaves, numbered from 1.
    let firstNumber = 1;
    levels.push(leafGroups.map((group, i) => ({
        number: firstNumber + i,
        firstKey: group.length ? group[0].key : { parent: 0, name: '' },
        records: group.map(r => r.bytes),
        type: HFS_ND_LEAF,
    })));
    // Index levels, until one of them has a single node.
    while (levels[levels.length - 1].length > 1) {
        const below = levels[levels.length - 1];
        firstNumber += below.length;
        const asRecords = below.map(n => ({
            key: n.firstKey,
            bytes: hfsIndexRecord(n.firstKey, n.number),
        }));
        const groups = hfsPackNodes(asRecords);
        levels.push(groups.map((group, i) => ({
            number: firstNumber + i,
            firstKey: group[0].key,
            records: group.map(r => r.bytes),
            type: HFS_ND_INDEX,
        })));
    }

    const allNodes = [].concat(...levels);
    const usedNodes = 1 + allNodes.length;
    const freeNodes = Math.max(0, spare || 0);
    const nodeCount = usedNodes + freeNodes;
    if (nodeCount > 2048)
        throw new Error('HFS: B-tree needs map nodes (more than 2048 nodes)');

    const bytes = new Uint8Array(nodeCount * HFS_NODE_SIZE);
    for (let level = 0; level < levels.length; level++) {
        const row = levels[level];
        for (let i = 0; i < row.length; i++) {
            const n = row[i];
            const node = bytes.subarray(n.number * HFS_NODE_SIZE, (n.number + 1) * HFS_NODE_SIZE);
            hfsWriteNodeRecords(node, n.records, n.type, level + 1,
                i + 1 < row.length ? row[i + 1].number : 0,
                i > 0 ? row[i - 1].number : 0);
        }
    }

    // The header node: header record, 128 reserved bytes, then a bitmap of
    // which nodes exist.
    const header = bytes.subarray(0, HFS_NODE_SIZE);
    const mapStart = 14 + 106 + 128;
    const tableStart = HFS_NODE_SIZE - 4 * 2;
    const mapLen = tableStart - mapStart;
    header[8] = HFS_ND_HEADER;
    header[9] = 0;
    hfsPut16(header, 10, 3);
    hfsPut16(header, HFS_NODE_SIZE - 2, 14);
    hfsPut16(header, HFS_NODE_SIZE - 4, 14 + 106);
    hfsPut16(header, HFS_NODE_SIZE - 6, mapStart);
    hfsPut16(header, HFS_NODE_SIZE - 8, tableStart);

    const leaves = levels[0];
    const root = levels[levels.length - 1][0];
    const h = 14;
    hfsPut16(bytes, h + 0, records.length ? levels.length : 0);   // bthDepth
    hfsPut32(bytes, h + 2, records.length ? root.number : 0);     // bthRoot
    hfsPut32(bytes, h + 6, records.length);                       // bthNRecs
    hfsPut32(bytes, h + 10, records.length ? leaves[0].number : 0);
    hfsPut32(bytes, h + 14, records.length ? leaves[leaves.length - 1].number : 0);
    hfsPut16(bytes, h + 18, HFS_NODE_SIZE);
    hfsPut16(bytes, h + 20, keyLen);
    hfsPut32(bytes, h + 22, nodeCount);                           // bthNNodes
    hfsPut32(bytes, h + 26, freeNodes);                           // bthFree
    // Only the nodes that exist are marked used; the spares are left clear so
    // the File Manager can take one when it has to split a leaf.
    for (let i = 0; i < usedNodes; i++)
        header[mapStart + (i >> 3)] |= 0x80 >> (i & 7);
    if (nodeCount > mapLen * 8) throw new Error('HFS: B-tree bitmap overflow');

    return bytes;
}

// An extents overflow file with nothing in it: one header node, no leaves, and
// room to grow if the Finder's own files end up fragmented.
function hfsEmptyExtentsFile() {
    return hfsBuildBTree([], HFS_EXT_KEY_LEN, HFS_SPARE_NODES);
}

// ---- the volume ----------------------------------------------------------

/* entries: an array of
       {name, type, creator, data, rsrc, finderFlags}   -- a file
       {name, children: [...]}                          -- a folder
   Options: volumeName, sizeBytes (a floor; the volume grows to fit),
   created (a Date). Returns the image bytes. */
function writeHfsImage(options) {
    const opts = options || {};
    const when = hfsMacTime(opts.created);
    const volumeName = hfsSafeName(opts.volumeName, 'Untitled').slice(0, 27);

    // Walk the tree once, numbering everything and collecting the forks.
    let nextCnid = HFS_FIRST_USER_CNID;
    const files = [], dirs = [];
    const seen = new Map();          // parent CNID -> names already used
    function uniqueName(parent, wanted) {
        if (!seen.has(parent)) seen.set(parent, new Set());
        const used = seen.get(parent);
        let name = wanted, n = 2;
        // Case-insensitively unique, because that is how HFS sees it.
        while (used.has(name.toUpperCase())) {
            const tail = ' ' + (n++);
            name = wanted.slice(0, 31 - tail.length) + tail;
        }
        used.add(name.toUpperCase());
        return name;
    }
    function walk(entries, parentCnid) {
        let valence = 0;
        for (const entry of entries || []) {
            const name = uniqueName(parentCnid, hfsSafeName(entry.name, 'Untitled'));
            valence++;
            if (entry.children) {
                const cnid = nextCnid++;
                const dir = { cnid: cnid, parent: parentCnid, name: name, valence: 0 };
                dirs.push(dir);
                dir.valence = walk(entry.children, cnid);
            } else {
                files.push({
                    cnid: nextCnid++, parent: parentCnid, name: name,
                    type: entry.type || '????', creator: entry.creator || '????',
                    finderFlags: entry.finderFlags || 0,
                    data: entry.data || new Uint8Array(0),
                    rsrc: entry.rsrc || new Uint8Array(0),
                });
            }
        }
        return valence;
    }
    const rootValence = walk(opts.entries, HFS_ROOT_CNID);

    const extentsFile = hfsEmptyExtentsFile();

    /* The catalog cannot be built until the forks have addresses, and the
       forks cannot be placed until the catalog's size is known, because the
       catalog is itself allocated out of the same blocks. So: build a catalog
       with placeholder extents to learn its size, lay everything out, then
       build it again for real. The second build is the same shape as the
       first, so the size cannot change under it. */
    function buildCatalog() {
        const records = [
            hfsDirRecord(HFS_ROOT_PARENT_CNID, volumeName, HFS_ROOT_CNID, rootValence, when),
            hfsThreadRecord(HFS_ROOT_CNID, HFS_ROOT_PARENT_CNID, volumeName, when),
        ];
        for (const dir of dirs) {
            records.push(hfsDirRecord(dir.parent, dir.name, dir.cnid, dir.valence, when));
            records.push(hfsThreadRecord(dir.cnid, dir.parent, dir.name, when));
        }
        for (const file of files) records.push(hfsFileRecord(file.parent, file, when));
        records.sort((a, b) => hfsCompareKeys(a.key, b.key));
        return hfsBuildBTree(records, HFS_CAT_KEY_LEN, HFS_SPARE_NODES);
    }
    for (const f of files) {
        f.dataStart = 0; f.dataBlocks = 0; f.dataPhysical = 0;
        f.rsrcStart = 0; f.rsrcBlocks = 0; f.rsrcPhysical = 0;
    }
    const catalogSize = buildCatalog().length;

    // Allocation block size: the smallest power-of-two multiple of 512 that
    // keeps the block count inside the 16 bits drNmAlBlks has.
    let contentBytes = extentsFile.length + catalogSize;
    for (const f of files) contentBytes += f.data.length + f.rsrc.length;
    /* Free space is not optional. The Finder builds an invisible Desktop
       database on every volume it mounts, and on a volume with nothing spare
       it puts up "An error occured while rebuilding the desktop file on the
       disk ...; comments from info windows were not preserved" -- which is
       alarming, appears every single time the image is mounted, and has
       nothing to do with the files. A megabyte is more than the desktop file
       needs and costs nothing: the slack is zeroes, and both the browser and
       the emulator's own transport compress it away. */
    const slack = Math.max(1024 * 1024, Math.ceil(contentBytes * 0.05));
    const floor = Math.max(opts.sizeBytes || 0, contentBytes + slack);
    let alBlkSize = HFS_SECTOR;
    const blocksNeeded = size => Math.ceil(size / alBlkSize);
    while (blocksNeeded(floor) + files.length * 2 + 8 > 65535) alBlkSize *= 2;

    const upBlocks = n => Math.ceil(n / alBlkSize);
    let blockCount = upBlocks(extentsFile.length) + upBlocks(catalogSize);
    for (const f of files) blockCount += upBlocks(f.data.length) + upBlocks(f.rsrc.length);
    blockCount = Math.max(blockCount + upBlocks(floor - contentBytes), blockCount + 1);
    if (blockCount > 65535) blockCount = 65535;

    const bitmapSectors = Math.ceil(Math.ceil(blockCount / 8) / HFS_SECTOR);
    const alBlSt = 3 + bitmapSectors;
    const sectorsPerBlock = alBlkSize / HFS_SECTOR;
    const totalSectors = alBlSt + blockCount * sectorsPerBlock + 2;
    const image = new Uint8Array(totalSectors * HFS_SECTOR);

    // Lay the allocated things down in order and remember where each went.
    let nextBlock = 0;
    const place = bytes => {
        const start = nextBlock;
        const blocks = upBlocks(bytes.length);
        image.set(bytes, (alBlSt + start * sectorsPerBlock) * HFS_SECTOR);
        nextBlock += blocks;
        return { start: start, blocks: blocks, physical: blocks * alBlkSize };
    };
    const extentsAt = place(extentsFile);
    const catalogAt = { start: nextBlock, blocks: upBlocks(catalogSize) };
    nextBlock += catalogAt.blocks;                      // reserved; written below
    for (const f of files) {
        const d = place(f.data);
        f.dataStart = d.start; f.dataBlocks = d.blocks;
        f.dataPhysical = f.data.length ? d.physical : 0;
        if (!f.data.length) { f.dataStart = 0; f.dataBlocks = 0; }
        const r = place(f.rsrc);
        f.rsrcStart = r.start; f.rsrcBlocks = r.blocks;
        f.rsrcPhysical = f.rsrc.length ? r.physical : 0;
        if (!f.rsrc.length) { f.rsrcStart = 0; f.rsrcBlocks = 0; }
    }
    const catalog = buildCatalog();
    if (catalog.length !== catalogSize)
        throw new Error('HFS: the catalog changed size between the two builds');
    image.set(catalog, (alBlSt + catalogAt.start * sectorsPerBlock) * HFS_SECTOR);
    const usedBlocks = nextBlock;

    // The bitmap: one bit per allocation block, most significant bit first.
    for (let i = 0; i < usedBlocks; i++)
        image[3 * HFS_SECTOR + (i >> 3)] |= 0x80 >> (i & 7);

    const mdb = new Uint8Array(162);
    hfsPut16(mdb, 0, HFS_SIGNATURE);
    hfsPut32(mdb, 2, when);                           // drCrDate
    hfsPut32(mdb, 6, when);                           // drLsMod
    hfsPut16(mdb, 10, 0x0100);                        // drAtrb: unmounted cleanly
    hfsPut16(mdb, 12, rootValence - dirs.filter(d => d.parent === HFS_ROOT_CNID).length);
    hfsPut16(mdb, 14, 3);                             // drVBMSt
    hfsPut16(mdb, 16, usedBlocks);                    // drAllocPtr
    hfsPut16(mdb, 18, blockCount);                    // drNmAlBlks
    hfsPut32(mdb, 20, alBlkSize);                     // drAlBlkSiz
    hfsPut32(mdb, 24, alBlkSize * 4);                 // drClpSiz
    hfsPut16(mdb, 28, alBlSt);                        // drAlBlSt
    hfsPut32(mdb, 30, nextCnid);                      // drNxtCNID
    hfsPut16(mdb, 34, blockCount - usedBlocks);       // drFreeBks
    hfsPutPString(mdb, 36, volumeName, 28);           // drVN
    hfsPut32(mdb, 74, extentsFile.length);            // drXTClpSiz
    hfsPut32(mdb, 78, catalog.length);                // drCTClpSiz
    hfsPut16(mdb, 82, dirs.filter(d => d.parent === HFS_ROOT_CNID).length);
    hfsPut32(mdb, 84, files.length);                  // drFilCnt
    hfsPut32(mdb, 88, dirs.length);                   // drDirCnt
    hfsPut32(mdb, 130, extentsFile.length);           // drXTFlSize
    hfsPut16(mdb, 134, extentsAt.start);
    hfsPut16(mdb, 136, extentsAt.blocks);
    hfsPut32(mdb, 146, catalog.length);               // drCTFlSize
    hfsPut16(mdb, 150, catalogAt.start);
    hfsPut16(mdb, 152, catalogAt.blocks);

    image.set(mdb, HFS_MDB_SECTOR * HFS_SECTOR);
    // The alternate MDB, which is where Disk First Aid and every disk utility
    // since looks when the real one will not parse.
    image.set(mdb, (totalSectors - 2) * HFS_SECTOR);
    return image;
}
