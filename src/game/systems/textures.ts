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
export const SAURO_W = 92;
export const SAURO_H = 84;
export const SAURO_DUCK_W = 100;
export const SAURO_DUCK_H = 52;

/**
 * ไดโนเสาร์คอยาวกินพืช (ซอโรพอด แนวบราคิโอซอรัส) สไตล์ชิบิน่ารัก
 *
 * จุดที่ทำให้ "อ่านออกว่าเป็นไดโนคอยาว" แม้ตัวเล็กบนจอมือถือ:
 *   1. คอยาวโค้งขึ้นเกินครึ่งความสูงตัว หัวเล็กจิ๋วอยู่ปลายคอ
 *   2. ลำตัวทรงถังใหญ่ ไม่มีเอว
 *   3. ขา 4 ข้างทรงเสาตรงๆ ไม่ใช่ขาพับแบบสัตว์กินเนื้อ
 *   4. หางยาวลากพื้นถ่วงน้ำหนักคอ
 *   5. ไม่มีฟันแหลม ปากมนๆ แทน — สื่อว่ากินพืช
 *
 * @param legs [ขาคู่หน้า, ขาคู่หลัง] ค่ายิ่งมากยิ่งยกขาสูง
 * @param neckLift ยกคอขึ้นกี่ px (ตอนกระโดดจะเงยคอขึ้น)
 */
function sauropodBase(
  g: Phaser.GameObjects.Graphics,
  legs: [number, number],
  neckLift = 0,
): void {
  const [frontLeg, backLeg] = legs;

  /* ---- หาง: ยาวเรียว ลากไปด้านหลัง ---- */
  g.fillStyle(C.bodyDark, 1);
  g.fillTriangle(0, 54, 30, 44, 30, 60);
  g.fillEllipse(26, 52, 22, 20);
  // ลายวงบนหาง
  g.fillStyle(C.crest, 0.6);
  g.fillEllipse(12, 51, 7, 4);
  g.fillEllipse(21, 50, 8, 5);

  /* ---- ขาคู่หลัง (อยู่ไกลกว่า จึงเข้มกว่า) ---- */
  g.fillStyle(C.bodyDarker, 1);
  g.fillRoundedRect(30, 58 - backLeg, 13, 26 + backLeg, 6);
  g.fillRoundedRect(52, 58 - frontLeg, 13, 26 + frontLeg, 6);

  /* ---- ลำตัวทรงถัง ---- */
  g.fillStyle(C.body, 1);
  g.fillEllipse(46, 50, 54, 38);

  /* ---- ท้องสีครีม ---- */
  g.fillStyle(C.belly, 1);
  g.fillEllipse(48, 59, 40, 20);

  /* ---- ลายจุดบนหลัง ---- */
  g.fillStyle(C.crest, 0.65);
  g.fillEllipse(34, 38, 10, 6);
  g.fillEllipse(46, 35, 11, 6);
  g.fillEllipse(58, 38, 9, 6);

  /* ---- ขาคู่หน้า (อยู่ใกล้กว่า จึงสว่างกว่า) ---- */
  g.fillStyle(C.body, 1);
  g.fillRoundedRect(36, 60 + backLeg * 0.5, 14, 24 - backLeg * 0.5, 6);
  g.fillRoundedRect(58, 60 + frontLeg * 0.5, 14, 24 - frontLeg * 0.5, 6);
  // กีบเท้า
  g.fillStyle(C.bodyDark, 1);
  g.fillRoundedRect(35, 79, 16, 5, 2.5);
  g.fillRoundedRect(57, 79, 16, 5, 2.5);

  /* ---- คอยาวโค้ง: วาดด้วยวงกลมไล่ขนาดจากโคนไปปลาย ---- */
  const neck: [number, number, number][] = [
    [62, 40, 11],
    [67, 33, 10],
    [71, 26, 9],
    [74, 19, 8.2],
    [77, 13, 7.6],
  ];
  g.fillStyle(C.body, 1);
  for (const [nx, ny, nr] of neck) g.fillCircle(nx, ny - neckLift, nr);

  /* ---- หัวเล็กปลายคอ ---- */
  const hx = 79;
  const hy = 8 - neckLift;
  g.fillStyle(C.body, 1);
  g.fillRoundedRect(hx - 9, hy - 6, 20, 14, 6); // กะโหลก
  g.fillRoundedRect(hx + 2, hy - 2, 12, 9, 4); // ปากมนๆ ไม่มีฟัน

  /* ---- หงอนเล็กบนหัว (บราคิโอซอรัสมีสันจมูกนูน) ---- */
  g.fillStyle(C.crest, 1);
  g.fillEllipse(hx - 1, hy - 7, 12, 6);

  /* ---- ตากลมโตน่ารัก ---- */
  g.fillStyle(C.eye, 1);
  g.fillCircle(hx + 2, hy, 4.4);
  g.fillStyle(C.pupil, 1);
  g.fillCircle(hx + 3.2, hy, 2.8);
  g.fillStyle(C.sparkle, 1);
  g.fillCircle(hx + 2, hy - 1.4, 1.3);
  g.fillCircle(hx + 4.4, hy + 1.2, 0.7);

  /* ---- แก้มชมพู ---- */
  g.fillStyle(C.blush, 0.8);
  g.fillCircle(hx - 4, hy + 3, 3);

  /* ---- รูจมูก ---- */
  g.fillStyle(C.bodyDarker, 0.7);
  g.fillCircle(hx + 12, hy + 1, 1.2);
}

export function createTextures(scene: Phaser.Scene): void {

  /* ---------------- ซอโรพอด (ไดโนคอยาวกินพืช) ---------------- */
  bake(scene, 'dino_run_0', SAURO_W, SAURO_H, (g) => sauropodBase(g, [0, 6], 0));
  bake(scene, 'dino_run_1', SAURO_W, SAURO_H, (g) => sauropodBase(g, [6, 0], 1));

  // ลอยกลางอากาศ: ยกขาทั้งสี่ เงยคอขึ้น
  bake(scene, 'dino_jump', SAURO_W, SAURO_H, (g) => sauropodBase(g, [7, 7], 4));

  // หมอบ: ก้มคอลงเล็มหญ้า — ท่าธรรมชาติของสัตว์กินพืชคอยาวพอดี
  bake(scene, 'dino_duck', SAURO_DUCK_W, SAURO_DUCK_H, (g) => {
    // หาง
    g.fillStyle(C.bodyDark, 1);
    g.fillTriangle(0, 26, 28, 18, 28, 32);
    g.fillEllipse(26, 25, 20, 18);

    // ขา (สั้นลงเพราะหมอบ)
    g.fillStyle(C.bodyDarker, 1);
    g.fillRoundedRect(32, 34, 12, 18, 5);
    g.fillRoundedRect(54, 34, 12, 18, 5);

    // ลำตัว
    g.fillStyle(C.body, 1);
    g.fillEllipse(48, 30, 52, 32);
    g.fillStyle(C.belly, 1);
    g.fillEllipse(50, 38, 38, 16);
    g.fillStyle(C.crest, 0.65);
    g.fillEllipse(38, 20, 10, 5);
    g.fillEllipse(50, 18, 10, 5);

    g.fillStyle(C.body, 1);
    g.fillRoundedRect(38, 46, 14, 6, 3);
    g.fillRoundedRect(58, 46, 14, 6, 3);

    // คอทอดไปข้างหน้าเกือบขนานพื้น
    const neck: [number, number, number][] = [
      [66, 28, 10],
      [73, 29, 9],
      [80, 31, 8],
      [86, 34, 7.2],
    ];
    g.fillStyle(C.body, 1);
    for (const [nx, ny, nr] of neck) g.fillCircle(nx, ny, nr);

    // หัวก้มลงเล็มหญ้า
    g.fillStyle(C.body, 1);
    g.fillRoundedRect(83, 32, 17, 13, 6);
    g.fillRoundedRect(92, 38, 8, 8, 3);
    g.fillStyle(C.crest, 1);
    g.fillEllipse(88, 31, 11, 5);
    g.fillStyle(C.eye, 1);
    g.fillCircle(91, 37, 3.8);
    g.fillStyle(C.pupil, 1);
    g.fillCircle(92, 37.6, 2.4);
    g.fillStyle(C.sparkle, 1);
    g.fillCircle(90.6, 36, 1.1);
  });

  /* ---------------- สิ่งกีดขวาง ---------------- */
  // หินแหลมสูง — ต้องกดกระโดดค้างถึงจะข้ามพ้น แตะสั้นๆ ไม่พอ
  bake(scene, 'spike_rock', 44, 74, (g) => {
    g.fillStyle(C.rockDark, 1);
    g.fillTriangle(4, 74, 22, 2, 40, 74);
    g.fillStyle(C.rock, 1);
    g.fillTriangle(9, 74, 22, 10, 32, 74);
    g.fillStyle(0xffffff, 0.18);
    g.fillTriangle(13, 70, 22, 16, 24, 70);
    // รอยแตกบอกว่ามันคม
    g.fillStyle(C.rockDark, 0.8);
    g.fillTriangle(24, 46, 30, 34, 29, 50);
  });

  // เทอโรซอร์บินสวนระดับหัว — หมอบอย่างเดียวถึงรอด กระโดดยิ่งโดนเต็มๆ
  bake(scene, 'ptero', 76, 40, (g) => {
    // ปีกกางกว้าง
    g.fillStyle(0x9a6fb0, 1);
    g.fillTriangle(6, 6, 40, 20, 8, 30);
    g.fillTriangle(70, 6, 38, 20, 68, 30);
    g.fillStyle(0xb98bcf, 1);
    g.fillTriangle(14, 11, 38, 20, 15, 26);
    g.fillTriangle(62, 11, 40, 20, 61, 26);
    // ลำตัว
    g.fillStyle(0x7d5591, 1);
    g.fillEllipse(38, 20, 22, 15);
    // หัว + จะงอยยาว
    g.fillStyle(0x7d5591, 1);
    g.fillCircle(48, 16, 8);
    g.fillTriangle(54, 13, 74, 17, 54, 20);
    // หงอนท้ายทอย
    g.fillStyle(C.crest, 1);
    g.fillTriangle(44, 10, 34, 3, 48, 9);
    // ตา
    g.fillStyle(C.eye, 1);
    g.fillCircle(50, 14, 3);
    g.fillStyle(C.pupil, 1);
    g.fillCircle(51, 14, 1.7);
  });

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

  // ภูเขาซ้อนชั้น — ชั้นไกลจางกว่า ให้รู้สึกมีระยะลึก
  bake(scene, 'hill', 520, 210, (g) => {
    g.fillStyle(0x4a3163, 0.55);
    g.fillEllipse(90, 150, 320, 210);
    g.fillEllipse(430, 158, 300, 190);
    g.fillStyle(C.hill, 1);
    g.fillEllipse(255, 176, 420, 250);
    g.fillEllipse(20, 182, 240, 180);
    g.fillEllipse(500, 186, 260, 175);
    // สันเขารับแสงจากขอบฟ้า
    g.fillStyle(0x8a5f8f, 0.5);
    g.fillEllipse(255, 168, 400, 210);
    g.fillStyle(C.hill, 1);
    g.fillEllipse(255, 184, 400, 210);
  });

  /**
   * แนวพืชยุคดึกดำบรรพ์ — วาดเป็นแถบกว้าง 360 px ที่มีต้นไม้ 4 ทรงไม่ซ้ำกัน
   *
   * เดิมเป็นต้นไม้ทรงเดียวกว้าง 90 px พอเอาไป tile ซ้ำ ตาจะจับได้ทันที
   * ว่าเป็นภาพเดิมวนไปมา แถบกว้างที่มีหลายทรงทำให้จังหวะการซ้ำยาวขึ้น 4 เท่า
   * และเลือกพืชตามยุคไดโนเสาร์จริง: อะราวคาเรีย เฟิร์นต้น ปรง แปะก๊วย
   */
  bake(scene, 'tree_far', 360, 190, (g) => {
    const FAR = 0x3d2b52;
    const NEAR = 0x503868;
    const TIP = 0x6b4a7a;

    /* --- 1) อะราวคาเรีย (สนยุคจูราสสิก) ทรงสามเหลี่ยมซ้อนชั้น --- */
    g.fillStyle(FAR, 1);
    g.fillRoundedRect(44, 96, 9, 94, 4);
    for (let i = 0; i < 5; i++) {
      const y = 100 - i * 19;
      const w = 62 - i * 10;
      g.fillStyle(i % 2 ? NEAR : FAR, 1);
      g.fillTriangle(48.5, y - 26, 48.5 - w / 2, y, 48.5 + w / 2, y);
    }

    /* --- 2) เฟิร์นต้น: ลำต้นเรียว ใบแผ่เป็นร่มโค้ง ---
       เขียนพิกัดปลายใบตรงๆ แทนการคำนวณด้วย trig
       (สูตรเดิมคำนวณจุดที่สามของสามเหลี่ยมผิด ใบเลยแบนจนมองไม่ออกว่าเป็นใบ) */
    g.fillStyle(NEAR, 1);
    g.fillRoundedRect(122, 104, 9, 86, 4);

    const fronds: [number, number][] = [
      [80, 94], [88, 116], [102, 134],   // ซ้าย: ยาว -> สั้น
      [172, 94], [164, 116], [150, 134], // ขวา (สมมาตร)
      [112, 74], [140, 74],              // ใบชูขึ้นกลางยอด
    ];
    fronds.forEach(([tx, ty], i) => {
      g.fillStyle(i % 2 ? NEAR : TIP, 1);
      // ลิ่มจากยอดลำต้นไปหาปลายใบ ให้โคนใบหนากว่าปลาย
      g.fillTriangle(126, 104, tx, ty, 126, 124);
    });
    // ยอดกลางกลมๆ ปิดรอยต่อโคนใบ
    g.fillStyle(NEAR, 1);
    g.fillEllipse(126, 110, 26, 20);

    /* --- 3) ปรง (cycad) ทรงกลมเตี้ยแน่น --- */
    g.fillStyle(FAR, 1);
    g.fillRoundedRect(206, 140, 12, 50, 5);
    g.fillEllipse(212, 138, 78, 46);
    g.fillStyle(NEAR, 1);
    g.fillEllipse(212, 132, 58, 34);
    g.fillStyle(TIP, 0.7);
    g.fillEllipse(206, 128, 30, 18);

    /* --- 4) แปะก๊วยต้นสูง ทรงพุ่มโปร่ง --- */
    g.fillStyle(NEAR, 1);
    g.fillRoundedRect(300, 78, 10, 112, 4);
    g.fillEllipse(305, 66, 92, 68);
    g.fillStyle(FAR, 1);
    g.fillEllipse(281, 84, 52, 40);
    g.fillEllipse(329, 86, 48, 36);
    g.fillStyle(TIP, 0.55);
    g.fillEllipse(305, 52, 54, 30);

    /* --- พุ่มเฟิร์นเตี้ยแทรกช่องว่าง ทำให้ขอบล่างไม่ขาดเป็นท่อนๆ --- */
    g.fillStyle(FAR, 1);
    for (const x of [10, 82, 166, 252, 344]) {
      g.fillEllipse(x, 186, 62, 34);
    }
  });

  /**
   * พุ่มไม้ชั้นหน้า — วิ่งเร็วกว่าชั้นต้นไม้ ทำให้เห็นความลึกชัดขึ้น
   * สีอุ่นกว่าและเข้มกว่า เพราะอยู่ใกล้ผู้เล่น
   */
  bake(scene, 'bush_near', 300, 110, (g) => {
    const DARK = 0x2f2145;
    const MID = 0x3f2c5c;
    g.fillStyle(MID, 1);
    for (const [x, w, h] of [
      [30, 110, 78],
      [120, 90, 58],
      [205, 120, 86],
      [285, 80, 54],
    ] as [number, number, number][]) {
      g.fillEllipse(x, 96, w, h);
    }
    // ใบเฟิร์นแหลมโผล่ขึ้นมาจากพุ่ม
    g.fillStyle(DARK, 1);
    for (const [x, h] of [
      [22, 46],
      [58, 34],
      [128, 40],
      [198, 52],
      [240, 36],
      [292, 44],
    ] as [number, number][]) {
      g.fillTriangle(x, 96 - h, x - 9, 100, x + 9, 100);
    }
  });

  /* ---------------- กล่องปริศนา (กระโดดชนจากข้างล่างแบบมาริโอ) ---------------- */
  bake(scene, 'box', 46, 46, (g) => {
    // ตัวกล่องทอง + ขอบเข้ม + หมุดสี่มุม
    g.fillStyle(0xb5761f, 1);
    g.fillRoundedRect(0, 0, 46, 46, 6);
    g.fillStyle(0xf2b33d, 1);
    g.fillRoundedRect(3, 3, 40, 40, 5);
    g.fillStyle(0xffd98a, 0.85);
    g.fillRoundedRect(6, 5, 34, 12, 4);
    g.fillStyle(0x8a5610, 1);
    for (const [x, y] of [[7, 7], [36, 7], [7, 36], [36, 36]] as [number, number][]) {
      g.fillRect(x, y, 3, 3);
    }
    // เครื่องหมาย "?" ประกอบจากรูปทรงพื้นฐาน
    g.fillStyle(0x6b3c06, 1);
    g.fillRoundedRect(15, 12, 16, 7, 3.5); // หัวโค้งด้านบน
    g.fillRoundedRect(25, 15, 7, 11, 3.5); // ขาขวา
    g.fillRoundedRect(19, 22, 12, 6, 3); // ท่อนกลาง
    g.fillRoundedRect(20, 25, 6, 8, 3); // ก้าน
    g.fillCircle(23, 37, 3.4); // จุด
  });

  bake(scene, 'box_used', 46, 46, (g) => {
    g.fillStyle(0x5a4a52, 1);
    g.fillRoundedRect(0, 0, 46, 46, 6);
    g.fillStyle(0x7d6a72, 1);
    g.fillRoundedRect(3, 3, 40, 40, 5);
    g.fillStyle(0x5a4a52, 1);
    g.fillRect(3, 21, 40, 3);
    g.fillRect(21, 3, 3, 18);
    g.fillRect(13, 24, 3, 19);
    g.fillRect(31, 24, 3, 19);
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

