/**
 * สร้างไอคอน PWA (public/icon-192.png, icon-512.png) ด้วยโค้ดล้วน
 *
 *   node tools/make-icons.mjs
 *
 * ไม่ต้องลง sharp/canvas — เขียนพิกเซลเองแล้วเข้ารหัส PNG ด้วย zlib
 * เป็นไอคอนชั่วคราวสำหรับช่วง prototype: พอถึงสัปดาห์ที่ 6 ให้ฝ่ายอาร์ต
 * วาดไอคอนจริงมาทับไฟล์เดิมได้เลย (ชื่อไฟล์เดิม ไม่ต้องแก้โค้ด)
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const BG = [29, 17, 41]; // night-950
const LAVA = [255, 107, 61];
const GLOW = [255, 209, 102];
const DINO = [127, 214, 138];
const CREST = [246, 169, 107];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = rgb(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ไดโนวิ่งหนีลูกไฟ — อ่านออกแม้ย่อเหลือ 48px */
function draw(size) {
  const s = size / 100; // ทำงานบนพิกัด 100x100 แล้วสเกล
  const disc = (x, y, cx, cy, r) => (x / s - cx) ** 2 + (y / s - cy) ** 2 <= r * r;

  return (x, y) => {
    // ไดโนวาดก่อน (อยู่หน้า) แล้วค่อยลูกไฟ (อยู่หลัง)
    if (disc(x, y, 79, 33, 2)) return BG; // ตาดำ
    if (disc(x, y, 78.5, 33, 4)) return [255, 255, 255]; // ตาขาว
    if (disc(x, y, 70, 24, 7)) return CREST; // หงอน
    if (disc(x, y, 76, 35, 12)) return DINO; // หัว
    if (disc(x, y, 62, 55, 18)) return DINO; // ลำตัว
    if (disc(x, y, 55, 76, 7) || disc(x, y, 69, 76, 7)) return DINO; // ขา

    // ลูกไฟไล่มาจากซ้าย — แกนสว่างข้างใน ต้องเช็กก่อนวงเรืองแสงข้างนอก
    if (disc(x, y, 27, 58, 15)) return GLOW;
    if (disc(x, y, 29, 60, 24)) return LAVA;

    return BG;
  };
}

mkdirSync('public', { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icon-${size}.png`, png(size, size, draw(size)));
  console.log(`✅ public/icon-${size}.png`);
}
