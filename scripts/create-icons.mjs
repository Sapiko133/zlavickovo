import { deflateSync } from "zlib";
import { writeFileSync } from "fs";

// CRC32 lookup table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

// "Z" letter as 7-column × 7-row bitmap
const Z_ROWS = [
  [1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 1, 0],
  [0, 0, 0, 1, 1, 0, 0],
  [0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
];

function createPNG(size) {
  const margin = Math.round(size * 0.22);
  const zW = size - margin * 2;
  const zH = size - margin * 2;
  const cols = Z_ROWS[0].length;
  const rows = Z_ROWS.length;

  function isZ(px, py) {
    const gx = Math.floor(((px - margin) * cols) / zW);
    const gy = Math.floor(((py - margin) * rows) / zH);
    if (gx < 0 || gx >= cols || gy < 0 || gy >= rows) return false;
    return Z_ROWS[gy][gx] === 1;
  }

  // Build raw scanlines: 1 filter byte + 3 RGB bytes per pixel
  const raw = Buffer.alloc(size * (1 + size * 3));
  let pos = 0;
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      if (isZ(x, y)) {
        raw[pos++] = 255; raw[pos++] = 255; raw[pos++] = 255; // white
      } else {
        raw[pos++] = 124; raw[pos++] = 58;  raw[pos++] = 237; // #7C3AED
      }
    }
  }

  const compressed = deflateSync(raw, { level: 6 });

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB
  // bytes 10-12: compression=0, filter=0, interlace=0 (default 0)

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdrData),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

writeFileSync("./public/icon-192.png", createPNG(192));
writeFileSync("./public/icon-512.png", createPNG(512));
console.log("✓ public/icon-192.png");
console.log("✓ public/icon-512.png");
