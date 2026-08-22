import Phaser from 'phaser';

/**
 * สร้างกราฟิกทั้งหมดด้วยโค้ด — ยังไม่มีไฟล์ภาพสักไฟล์
 *
 * ทำแบบนี้ในช่วงสัปดาห์ที่ 1-5 ตามแผน (docs/04-roadmap.md §3):
 * "ทำให้สนุกก่อน แล้วค่อยทำให้สวย" — ถ้าจูนเกมเพลย์แล้วพบว่าตัวละครต้องกระโดดสูงขึ้น
 * sprite ที่วาดไว้อาจต้องปรับสัดส่วนใหม่หมด เสียเวลาเปล่า
 *
 * พอถึงสัปดาห์ที่ 6 ให้เปลี่ยนเป็น texture atlas จริง: ลบไฟล์นี้ทิ้ง
 * แล้วโหลดใน PreloadScene ด้วย this.load.atlas() โดยใช้ "ชื่อ key เดิมทุกตัว"
 * ส่วนอื่นของเกมจะไม่ต้องแก้อะไรเลย
 */

const C = {
  body: 0x7cd88e,      // สีเขียวมิ้นท์พาสเทลน่ารัก
  bodyDark: 0x58b86d,  // เขียวเข้มตัดขอบ
  bodyDarker: 0x3fa055,// เขียวเงาลึก
  belly: 0xfff7d6,     // ท้องสีครีมอุ่นๆ
  blush: 0xff9ebb,     // แก้มชมพูระเรื่อ
  crest: 0xff9466,     // หนามหลังสีส้มคอรัลพาสเทล
  crestDark: 0xe07448,
  tooth: 0xfffcf0,
  eye: 0xffffff,
  pupil: 0x231633,
  sparkle: 0xffffff,

  rock: 0xaa9584,
  rockDark: 0x7a6555,
  fern: 0x6bd680,
  fernDark: 0x3e9e52,
  eggShell: 0xfff3db,
  eggSpot: 0xe6a86c,

  meteor: 0x544557,
  meteorHot: 0xff6b3d,
  meteorGlow: 0xffd166,

  gate: 0x8ab6f9,
  gateGlow: 0xc9a7f5,

  ember: 0xffb457,
  star: 0xfff3c4,
  cloud: 0xffe8d6,
  hill: 0x614475,
  gem: 0xffd700,
  gemGlow: 0xfff2a3,
};

/** วาดลงกราฟิกชั่วคราว แล้วอบเป็น texture */
function bake(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** ขนาดผืนผ้าใบของตัวละคร */
export const TREX_W = 74;
export const TREX_H = 58;

/** ฟันบนขากรรไกร */
function teeth(g: Phaser.GameObjects.Graphics, xs: number[], y: number, size = 4): void {
  g.fillStyle(C.tooth, 1);
  for (const x of xs) g.fillTriangle(x, y - 1, x + size, y - 1, x + size / 2, y + size);
}

/**
 * ไทรันโนซอรัส เร็กซ์ สไตล์ Chibi Kawaii น่ารักน่าเอ็นดู
 *   - ตาโตประกายวิ้ง 2 จุด
 *   - แก้มชมพูระเรื่อ
 *   - หนามสีส้มคอรัลทรงมน
 *   - ลำตัวอวบอ้วนกลมมนน่ารัก
 */
function trexBase(
  g: Phaser.GameObjects.Graphics,
  legs: [number, number],
  mouthOpen = 3,
): void {
  const [frontLeg, backLeg] = legs;

  /* ---- หาง: กลมมน น่ารัก ---- */
  g.fillStyle(C.bodyDark, 1);
  g.fillTriangle(0, 31, 26, 20, 26, 38);
  g.fillEllipse(22, 29, 20, 18);

  /* ---- หนามบนหาง ---- */
  g.fillStyle(C.crest, 1);
  g.fillTriangle(6, 21, 12, 16, 15, 23);
  g.fillTriangle(16, 18, 21, 12, 24, 20);

  /* ---- ขาหลัง (อยู่ด้านหลัง) ---- */
  g.fillStyle(C.bodyDarker, 1);
  g.fillEllipse(26, 36 - backLeg * 0.4, 20, 24); // ต้นขาอวบ
  g.fillRoundedRect(22, 43 - backLeg, 9, 13 + backLeg * 0.5, 4);
  g.fillRoundedRect(18, 51 - backLeg, 16, 6, 3); // เท้า
  g.fillStyle(C.tooth, 1);
  g.fillCircle(32, 53 - backLeg, 2.5); // เล็บเท้าจิ๋ว

  /* ---- ลำตัวอวบกลม ---- */
  g.fillStyle(C.body, 1);
  g.fillEllipse(36, 30, 42, 30);

  /* ---- ท้องสีครีม ---- */
  g.fillStyle(C.belly, 1);
  g.fillEllipse(38, 36, 28, 16);

  /* ---- หนามบนหลัง 3 อัน ---- */
  g.fillStyle(C.crest, 1);
  g.fillTriangle(26, 17, 31, 10, 35, 19);
  g.fillTriangle(34, 15, 39, 8, 43, 17);
  g.fillTriangle(42, 14, 47, 8, 50, 16);

  /* ---- คอและหัว ---- */
  g.fillStyle(C.body, 1);
  g.fillRoundedRect(44, 10, 16, 22, 8); // คอ
  g.fillRoundedRect(45, 4, 26, 20, 9); // กะโหลกกลมโต
  g.fillRoundedRect(57, 10, 16, 11, 4); // ปากบน

  // ฟันน่ารัก 2 ซี่
  teeth(g, [61, 67], 20, 3.5);

  // ปากด้านใน + ลิ้นสีชมพู
  g.fillStyle(0x8c3b52, 1);
  g.fillRoundedRect(56, 20, 16, mouthOpen + 1, 2);
  g.fillStyle(0xff7096, 1);
  g.fillCircle(62, 21 + mouthOpen * 0.5, 2.5);

  // ขากรรไกรล่าง
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(55, 20 + mouthOpen, 16, 7, 3.5);

  /* ---- แก้มชมพูพาสเทลน่ารัก (Kawaii Blush) ---- */
  g.fillStyle(C.blush, 0.85);
  g.fillCircle(54, 20, 4.5);

  /* ---- ดวงตาอนิเมะกลมโต (Kawaii Eyes) ---- */
  g.fillStyle(C.eye, 1);
  g.fillCircle(58, 11, 5.5); // ตาขาวใหญ่
  g.fillStyle(C.pupil, 1);
  g.fillCircle(59.5, 11, 3.5); // ตาดำใหญ่
  // ประกายวิ้งตา 2 จุด
  g.fillStyle(C.sparkle, 1);
  g.fillCircle(58.2, 9.5, 1.6);
  g.fillCircle(61, 12.2, 0.9);

  /* ---- รูจมูกจิ๋ว ---- */
  g.fillStyle(C.bodyDarker, 0.7);
  g.fillCircle(70, 13, 1.2);

  /* ---- แขนจิ๋วน่ารัก (Front Tiny Arm) ---- */
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(45, 28, 10, 6, 3);
  g.fillStyle(C.tooth, 1);
  g.fillCircle(54, 30, 2); // กรงเล็บจิ๋ว

  /* ---- ขาหน้า (สว่างกว่า) ---- */
  g.fillStyle(C.body, 1);
  g.fillEllipse(40, 37 - frontLeg * 0.4, 21, 25);
  g.fillRoundedRect(37, 44 - frontLeg, 10, 12 + frontLeg * 0.5, 4);
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(33, 51 - frontLeg, 17, 6, 3.5);
  g.fillStyle(C.tooth, 1);
  g.fillCircle(49, 53 - frontLeg, 2.5); // เล็บเท้า
}

export function createTextures(scene: Phaser.Scene): void {

  /* ---------------- ไทรันโนซอรัส เร็กซ์ ---------------- */
  bake(scene, 'dino_run_0', TREX_W, TREX_H, (g) => trexBase(g, [1, 7], 3));
  bake(scene, 'dino_run_1', TREX_W, TREX_H, (g) => trexBase(g, [7, 1], 2));

  // ตอนลอยกลางอากาศ: พับขาทั้งสองข้างขึ้น อ้าปากกว้าง
  bake(scene, 'dino_jump', TREX_W, TREX_H, (g) => trexBase(g, [9, 9], 6));

  // หมอบ: ก้มลำตัวลงต่ำ หางยกขึ้นถ่วง
  bake(scene, 'dino_duck', TREX_W + 6, 38, (g) => {
    g.fillStyle(C.bodyDark, 1);
    g.fillTriangle(0, 14, 26, 12, 24, 26);
    g.fillEllipse(26, 20, 18, 16);

    g.fillStyle(C.bodyDarker, 1);
    g.fillEllipse(28, 26, 20, 16);
    g.fillRoundedRect(21, 31, 16, 6, 3);

    g.fillStyle(C.body, 1);
    g.fillEllipse(38, 21, 44, 20);
    g.fillStyle(C.belly, 1);
    g.fillEllipse(40, 26, 30, 10);

    g.fillStyle(C.crest, 0.85);
    g.fillEllipse(32, 14, 9, 4);
    g.fillEllipse(43, 13, 9, 4);

    g.fillStyle(C.body, 1);
    g.fillRoundedRect(52, 6, 24, 14, 6);
    g.fillRoundedRect(63, 11, 15, 8, 3);
    teeth(g, [65, 70, 74], 19, 3.5);
    g.fillStyle(C.bodyDark, 1);
    g.fillRoundedRect(61, 20, 16, 6, 3);

    g.fillStyle(C.bodyDarker, 1);
    g.fillTriangle(57, 8, 68, 6, 68, 10);
    g.fillStyle(C.eye, 1);
    g.fillCircle(63, 12, 3.6);
    g.fillStyle(C.pupil, 1);
    g.fillCircle(64.3, 12, 1.9);

    g.fillStyle(C.crest, 1);
    g.fillRoundedRect(36, 31, 18, 6, 3);
  });

  /* ---------------- สิ่งกีดขวาง ---------------- */
  bake(scene, 'rock', 46, 36, (g) => {
    g.fillStyle(C.rockDark, 1);
    g.fillEllipse(23, 26, 44, 18);
    g.fillStyle(C.rock, 1);
    g.fillEllipse(22, 19, 40, 30);
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(15, 13, 14, 9);
  });

  bake(scene, 'fern', 42, 48, (g) => {
    g.fillStyle(C.fernDark, 1);
    g.fillRoundedRect(19, 24, 4, 24, 2);
    g.fillStyle(C.fern, 1);
    // ใบแผ่เป็นพัด
    const fronds: [number, number, number, number][] = [
      [21, 30, 1, 6],
      [21, 26, 4, 2],
      [21, 22, 6, 0],
      [21, 18, 4, -2],
      [21, 16, 0, -4],
    ];
    for (const [x, y, dx, dy] of fronds) {
      g.fillTriangle(x, y, x - 20 + dx * 2, y - 6 + dy, x - 18 + dx * 2, y + 5 + dy);
      g.fillTriangle(x, y, x + 20 - dx * 2, y - 6 + dy, x + 18 - dx * 2, y + 5 + dy);
    }
    g.fillStyle(C.fernDark, 0.5);
    g.fillEllipse(21, 22, 10, 12);
  });

  bake(scene, 'egg', 32, 40, (g) => {
    g.fillStyle(C.eggShell, 1);
    g.fillEllipse(16, 22, 28, 34);
    g.fillStyle(C.eggSpot, 0.75);
    g.fillCircle(11, 16, 3.2);
    g.fillCircle(21, 25, 2.6);
    g.fillCircle(15, 31, 2.1);
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(11, 12, 8, 11);
  });

  bake(scene, 'meteor', 38, 38, (g) => {
    g.fillStyle(C.meteorGlow, 0.35);
    g.fillCircle(19, 19, 18);
    g.fillStyle(C.meteorHot, 0.8);
    g.fillCircle(19, 19, 14);
    g.fillStyle(C.meteor, 1);
    g.fillCircle(19, 19, 11);
    g.fillStyle(0x000000, 0.25);
    g.fillCircle(15, 16, 3);
    g.fillCircle(23, 22, 2.2);
  });

  /* ---------------- Checkpoint คำถาม ---------------- */
  bake(scene, 'gate', 60, 132, (g) => {
    // ลำแสงตรงกลาง
    g.fillStyle(C.gateGlow, 0.18);
    g.fillRect(14, 0, 32, 132);
    // เสาสองข้าง
    g.fillStyle(C.gate, 0.95);
    g.fillRoundedRect(6, 4, 10, 124, 5);
    g.fillRoundedRect(44, 4, 10, 124, 5);
    // ดาวบนยอด
    g.fillStyle(C.star, 1);
    g.fillTriangle(30, 0, 24, 14, 36, 14);
    g.fillTriangle(30, 28, 24, 14, 36, 14);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(30, 14, 4);
  });

  /* ---------------- พาร์ติเคิล / ฉากหลัง ---------------- */
  bake(scene, 'ember', 12, 12, (g) => {
    g.fillStyle(C.ember, 0.35);
    g.fillCircle(6, 6, 6);
    g.fillStyle(C.ember, 1);
    g.fillCircle(6, 6, 3);
  });

  bake(scene, 'sparkle', 14, 14, (g) => {
    g.fillStyle(C.star, 1);
    g.fillTriangle(7, 0, 5, 7, 9, 7);
    g.fillTriangle(7, 14, 5, 7, 9, 7);
    g.fillTriangle(0, 7, 7, 5, 7, 9);
    g.fillTriangle(14, 7, 7, 5, 7, 9);
  });

  bake(scene, 'dust', 10, 10, (g) => {
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(5, 5, 5);
  });

  bake(scene, 'cloud', 140, 58, (g) => {
    g.fillStyle(C.cloud, 0.85);
    g.fillEllipse(45, 34, 62, 34);
    g.fillEllipse(82, 30, 68, 40);
    g.fillEllipse(112, 36, 48, 28);
  });

  bake(scene, 'hill', 460, 200, (g) => {
    g.fillStyle(C.hill, 1);
    g.fillEllipse(230, 150, 460, 260);
  });

  bake(scene, 'tree_far', 90, 150, (g) => {
    g.fillStyle(0x3d2b52, 1);
    g.fillRoundedRect(40, 60, 10, 90, 4);
    g.fillEllipse(45, 46, 84, 62);
    g.fillEllipse(24, 66, 44, 34);
    g.fillEllipse(66, 66, 44, 34);
  });

  /* ---------------- ไอเทมเก็บสะสมคะแนน ---------------- */
  bake(scene, 'star_gem', 32, 32, (g) => {
    g.fillStyle(C.gemGlow, 0.4);
    g.fillCircle(16, 16, 16);
    g.fillStyle(C.gem, 1);
    g.fillTriangle(16, 3, 12, 14, 20, 14);
    g.fillTriangle(16, 29, 12, 18, 20, 18);
    g.fillTriangle(3, 16, 14, 12, 14, 20);
    g.fillTriangle(29, 16, 18, 12, 18, 20);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(13, 11, 2.5);
  });

  /* ---------------- ของตกแต่งฉากด่าน ---------------- */
  bake(scene, 'flower', 24, 24, (g) => {
    g.fillStyle(0xff9ebb, 1);
    g.fillCircle(7, 12, 5);
    g.fillCircle(17, 12, 5);
    g.fillCircle(12, 7, 5);
    g.fillCircle(12, 17, 5);
    g.fillStyle(0xffe875, 1);
    g.fillCircle(12, 12, 4);
  });

  bake(scene, 'shroom', 24, 28, (g) => {
    g.fillStyle(0xfff7d6, 1);
    g.fillRoundedRect(9, 14, 6, 14, 3);
    g.fillStyle(0xff6b6b, 1);
    g.fillEllipse(12, 12, 22, 16);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(8, 9, 2.2);
    g.fillCircle(16, 8, 2.2);
    g.fillCircle(12, 13, 1.8);
  });

  bake(scene, 'fossil', 32, 24, (g) => {
    g.fillStyle(0xd9c2ad, 0.85);
    g.fillEllipse(16, 12, 28, 18);
    g.fillStyle(0x35224a, 0.6);
    g.fillCircle(10, 10, 3.5); // กระบอกตา
    g.fillCircle(20, 14, 2.5); // รูจมูก
  });

  bake(scene, 'crystal', 28, 34, (g) => {
    g.fillStyle(0x8ab6f9, 0.4);
    g.fillCircle(14, 17, 15);
    g.fillStyle(0x8ab6f9, 0.95);
    g.fillTriangle(14, 2, 7, 26, 21, 26);
    g.fillStyle(0xc9a7f5, 0.9);
    g.fillTriangle(7, 10, 2, 30, 14, 30);
    g.fillTriangle(21, 12, 14, 32, 26, 32);
    g.fillStyle(0xffffff, 0.7);
    g.fillTriangle(14, 2, 10, 16, 14, 20);
  });

  /* ---------------- กำแพงวันสิ้นโลก ---------------- */
  bake(scene, 'lava_edge', 24, 240, (g) => {
    // ไล่เฉดจากขอบ (สว่าง) เข้าไปในกำแพง (แดงเข้ม)
    const bands: [number, number, number][] = [
      [0, 0xffd166, 0.95],
      [6, 0xff9c41, 0.9],
      [12, 0xff6b3d, 0.85],
      [18, 0xe14a2b, 0.8],
    ];
    for (const [x, color, alpha] of bands) {
      g.fillStyle(color, alpha);
      g.fillRect(x, 0, 6, 240);
    }
  });
}

