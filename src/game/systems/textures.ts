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
  body: 0x6fc47a,
  bodyDark: 0x46925c,
  bodyDarker: 0x35704a,
  belly: 0xe3f7cd,
  crest: 0xf6a96b,
  crestDark: 0xd9834a,
  tooth: 0xfffaf0,
  eye: 0xffffff,
  pupil: 0x2b1b3d,

  rock: 0xb8a08a,
  rockDark: 0x8c7460,
  fern: 0x6fbf73,
  fernDark: 0x3f8f5a,
  eggShell: 0xfff1d6,
  eggSpot: 0xd9a066,

  meteor: 0x5a4a52,
  meteorHot: 0xff6b3d,
  meteorGlow: 0xffd166,

  gate: 0x8ab6f9,
  gateGlow: 0xc9a7f5,

  ember: 0xffb457,
  star: 0xfff3c4,
  cloud: 0xffe3c4,
  hill: 0x6b4a7a,
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

/** ขนาดผืนผ้าใบของตัวละคร — T-Rex ตัวยาวกว่าเดิม จึงต้องกว้างขึ้น */
export const TREX_W = 74;
export const TREX_H = 58;

/** ฟันบนขากรรไกร */
function teeth(g: Phaser.GameObjects.Graphics, xs: number[], y: number, size = 4): void {
  g.fillStyle(C.tooth, 1);
  for (const x of xs) g.fillTriangle(x, y - 1, x + size, y - 1, x + size / 2, y + size);
}

/**
 * ไทรันโนซอรัส เร็กซ์ (หันขวา) — ท่าเดียวกันทุกเฟรม ต่างแค่ตำแหน่งขา
 *
 * จุดเด่นที่ทำให้ "อ่านออกว่าเป็น T-Rex" แม้ตัวเล็กบนจอมือถือ:
 *   1. หัวใหญ่เทอะทะเมื่อเทียบกับลำตัว + ขากรรไกรยาวมีฟัน
 *   2. แขนหน้าเล็กจิ๋วจนดูตลก
 *   3. ขาหลังใหญ่มาก + หางหนายื่นตรงไปข้างหลังเพื่อถ่วงสมดุล
 *   4. ลำตัวขนานพื้น (ไม่ใช่ตั้งตรงแบบก็อดซิลล่า) ตามที่บรรพชีวินวิทยาสมัยใหม่เชื่อ
 *
 * @param legs [ขาหน้า, ขาหลัง] — ค่ายิ่งมากยิ่งยกขาสูง
 * @param mouthOpen อ้าปากกว้างแค่ไหน (px)
 */
function trexBase(
  g: Phaser.GameObjects.Graphics,
  legs: [number, number],
  mouthOpen = 3,
): void {
  const [frontLeg, backLeg] = legs;

  /* ---- หาง: หนาโคน เรียวปลาย ยื่นตรงไปหลัง ---- */
  g.fillStyle(C.bodyDark, 1);
  g.fillTriangle(0, 30, 26, 22, 26, 38);
  g.fillEllipse(24, 30, 18, 18);

  /* ---- ขาหลัง (อยู่หลังลำตัว จึงเข้มกว่า) ---- */
  g.fillStyle(C.bodyDarker, 1);
  g.fillEllipse(26, 36 - backLeg * 0.4, 20, 24); // ต้นขาใหญ่
  g.fillRoundedRect(23, 44 - backLeg, 8, 12 + backLeg * 0.5, 4);
  g.fillRoundedRect(19, 52 - backLeg, 15, 6, 3); // เท้า

  /* ---- ลำตัว ---- */
  g.fillStyle(C.body, 1);
  g.fillEllipse(35, 30, 40, 28);

  /* ---- ท้องสีอ่อน ---- */
  g.fillStyle(C.belly, 1);
  g.fillEllipse(37, 37, 28, 14);

  /* ---- ลายบนหลัง ---- */
  g.fillStyle(C.crest, 0.85);
  g.fillEllipse(28, 20, 9, 5);
  g.fillEllipse(38, 18, 9, 5);
  g.fillEllipse(47, 19, 8, 5);

  /* ---- คอ ---- */
  g.fillStyle(C.body, 1);
  g.fillRoundedRect(45, 12, 14, 20, 7);

  /* ---- หัว: กะโหลกใหญ่ + ขากรรไกรยาว ---- */
  g.fillStyle(C.body, 1);
  g.fillRoundedRect(47, 6, 24, 17, 7); // กะโหลก
  g.fillRoundedRect(58, 12, 15, 9, 3); // ปากบน

  // ฟันบน
  teeth(g, [60, 65, 69], 21);

  // ในปาก
  g.fillStyle(0x7a3348, 1);
  g.fillRoundedRect(57, 21, 16, mouthOpen, 1.5);

  // ขากรรไกรล่าง
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(56, 21 + mouthOpen, 16, 7, 3);
  g.fillStyle(C.tooth, 1);
  g.fillTriangle(62, 22 + mouthOpen, 65, 22 + mouthOpen, 63.5, 18.5 + mouthOpen);

  /* ---- คิ้ว/สันเหนือตา ทำให้ดูดุแบบการ์ตูน ---- */
  g.fillStyle(C.bodyDarker, 1);
  g.fillTriangle(52, 9, 64, 7, 64, 11);

  /* ---- ตา ---- */
  g.fillStyle(C.eye, 1);
  g.fillCircle(58, 13, 4);
  g.fillStyle(C.pupil, 1);
  g.fillCircle(59.5, 13, 2.1);
  g.fillStyle(C.eye, 0.9);
  g.fillCircle(58.6, 12, 1);

  /* ---- รูจมูก ---- */
  g.fillStyle(C.bodyDarker, 1);
  g.fillCircle(70, 15, 1.2);

  /* ---- แขนจิ๋ว (เอกลักษณ์ของ T-Rex) ---- */
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(46, 29, 10, 5, 2.5);
  g.fillStyle(C.tooth, 1);
  g.fillTriangle(55, 29, 59, 30.5, 55, 32);
  g.fillTriangle(55, 32, 58, 33.5, 55, 34.5);

  /* ---- ขาหน้า (อยู่หน้าลำตัว จึงสว่างกว่า) ---- */
  g.fillStyle(C.body, 1);
  g.fillEllipse(40, 37 - frontLeg * 0.4, 21, 25); // ต้นขาใหญ่
  g.fillRoundedRect(38, 45 - frontLeg, 9, 11 + frontLeg * 0.5, 4);
  g.fillStyle(C.crest, 1);
  g.fillRoundedRect(33, 52 - frontLeg, 17, 6, 3); // เท้า
  g.fillStyle(C.tooth, 1);
  g.fillTriangle(50, 53 - frontLeg, 53, 55 - frontLeg, 50, 57 - frontLeg); // เล็บ
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
