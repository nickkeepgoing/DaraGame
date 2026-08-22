/**
 * ตัวเลขปรับสมดุลทั้งหมดของเกม — อยู่ไฟล์นี้ไฟล์เดียว
 *
 * กฎ:
 *  1. ห้ามฮาร์ดโค้ดตัวเลขพวกนี้ในซีน/entity ใดๆ import จากที่นี่เสมอ
 *  2. ค่าในหมวด `score` ต้องตรงกับ db/03_rpc.sql เป๊ะ (เซิร์ฟเวอร์คือความจริง
 *     ฝั่งเกมแสดงตัวเลขเพื่อ feedback ทันทีเท่านั้น)
 *  3. หน่วยความเร็วเป็น "px ต่อวินาที" ไม่ใช่ต่อเฟรม — ทุกที่ที่ใช้ต้องคูณ delta
 *
 * ระยะทาง: 100 px = 1 เมตรในเกม
 */

export const PX_PER_METER = 100;

/** จำนวนด่าน (ด่าน 1-3 แล้วเจอบอสสุดท้าย) */
export const STAGE_COUNT = 3;
/** คำถามต่อด่าน */
export const QUESTIONS_PER_STAGE = 3;

export const BALANCE = {
  /** ผู้เล่น */
  player: {
    runSpeed: 260,          // px/s ความเร็ววิ่งปกติ
    maxSpeed: 420,          // px/s เพดาน — ใช้คำนวณ anti-cheat ฝั่ง server ด้วย (4.2 m/s)
    accel: 900,             // px/s² เร่งจนถึง runSpeed
    backStepSpeed: 140,     // px/s ถอยหลังได้นิดหน่อยเพื่อหลบ

    // ── กระโดด ────────────────────────────────────────────────
    // ค่าชุดเดิม (g=1800, v=-620) กระโดดได้ไกล 179 px ที่ความเร็ววิ่งปกติ
    // ซึ่ง "สั้นกว่า" หลุมกว้างสุด 200 px → ต้องกดเร่งตลอดเวลาถึงจะข้ามได้ ไม่ยุติธรรม
    // ชุดใหม่: แรงส่งมากขึ้น + แรงโน้มถ่วงเบาลงเล็กน้อย
    //   เวลาลอย = 2 × 740 / 1750 = 0.846 วิ
    //   สูงสุด   = 740² / (2 × 1750) = 156 px
    //   ไกล      = 220 px (ความเร็วปกติ) / 355 px (กดเร่ง)
    // → ข้ามหลุมกว้างสุด 180 px ได้สบายแม้ไม่กดเร่ง
    gravity: 1750,          // px/s²
    jumpVelocity: -740,     // px/s
    maxFallSpeed: 1250,     // px/s กันทะลุพื้น
    /** ปล่อยปุ่มเร็ว = กระโดดเตี้ย (ยิ่งค่าน้อยยิ่งตัดแรงเยอะ) */
    jumpCutMultiplier: 0.5,

    coyoteMs: 120,          // กระโดดได้อีก 120ms หลังตกขอบแล้ว  ← อย่าตัดทิ้ง
    jumpBufferMs: 140,      // กดกระโดดก่อนแตะพื้น 140ms ยังนับให้  ← อย่าตัดทิ้ง
    hearts: 3,
    invincibilityMs: 1200,  // i-frame หลังโดนชน (กระพริบตัวให้เห็นด้วย)
    /** ฟื้นได้กี่ครั้งต่อรอบ (ตอบคำถามฟื้นถูก) — มีคำถามฟื้น 2 ข้อ */
    maxRevives: 2,
    /** หัวใจที่ได้คืนตอนฟื้น */
    heartsOnRevive: 2,
  },

  /** กำแพงวันสิ้นโลก */
  wall: {
    startDelayMs: 10_000,   // เริ่มไล่หลังนับถอยหลังจบ
    // เกมนี้มีจุดจบ (9 คำถาม + บอส ≈ 450 ม. ≈ 3.5 นาที) กำแพงจึงต้องไล่ให้กดดัน
    // แต่ต้องยังวิ่งหนีทันถ้าผู้เล่นกดเร่งค้าง ไม่งั้นจะไปไม่ถึงบอสเลยสักคน
    //   กดเร่ง (420) - กำแพงเต็มสปีด (330) = +90 px/s  → หนีทัน
    //   วิ่งเฉยๆ (260) - 330                = -70 px/s  → ค่อยๆ โดนไล่ทัน
    startSpeed: 170,        // px/s
    accelPerSec: 1.4,       // px/s เพิ่มต่อวินาที (ถึงเพดานที่ ~115 วิ)
    maxSpeed: 330,
    startGapPx: 360,        // ระยะตามหลังตอนยังไม่ไล่ — ตั้งให้เห็นกำแพงติดขอบจอซ้ายพอดี
                            // (ผู้เล่นอยู่ที่ ~30% ของจอกว้าง 1280 = 384 px)
    maxGapPx: 1500,         // ห่างได้มากสุด — กันกำแพงหลุดหายไปจนไม่เหลือความกดดัน
    // ระหว่างตอบคำถาม ผู้เล่นหยุดนิ่ง กำแพงคืบเข้ามา ~330 px (10 วิ × 330 × 0.1)
    // ผลักถอย 340 จึงทำให้ "ตอบถูก" เป็นบวกสุทธิเล็กน้อย ส่วน "ตอบผิด" ติดลบเต็มๆ
    pushBackOnCorrect: 340, // px ตอบถูก = ผลักกำแพงถอย  ← รางวัลหลักของการตอบคำถาม
    speedUpOnWrong: 0.15,   // ตอบผิด = เร่ง 15%
    speedUpDurationMs: 5000,
    /** ตอบบอสสุดท้ายผิด = กำแพงพุ่งแรง (เร่งเป็นเท่าตัว) */
    finalWrongBoost: 1.0,
    finalWrongDurationMs: 8000,
    warnGapPx: 260,         // ใกล้กว่านี้ = เตือน (ขอบจอเรืองแสง + เสียง)
    quizSafeGapPx: 120,     // ระหว่างตอบคำถาม กำแพงเข้าใกล้กว่านี้ไม่ได้
                            // = ตอบคำถามแล้วตายคาป๊อปอัปไม่ได้ (ความยุติธรรม, GDD ข้อ 8.5)
    // ⚠️ ห้ามทำจอกะพริบถี่เกิน 3 ครั้ง/วินาที — ดู docs/03-decisions.md ส่วนที่ 2 ข้อ 8
  },

  /** ควิซ */
  quiz: {
    firstCheckpointM: 35,   // checkpoint แรกอยู่ไกลหน่อย ให้ผู้เล่นชินก่อน
    checkpointEveryM: 45,
    checkpointJitterM: 10,  // สุ่มด้วย seeded RNG ไม่ใช่ Math.random()
    wallSlowFactor: 0.1,    // ระหว่างตอบ กำแพงช้าลงเหลือ 10% (ไม่หยุดสนิท ให้ยังกดดัน)
    timeLimitS: { easy: 10, medium: 12, hard: 15 },
    /** คำถามฟื้นตอนตาย — ให้เวลาเยอะกว่าปกติ เพราะกำลังตกใจอยู่ */
    reviveTimeLimitS: 15,
    /** บอสสุดท้าย */
    finalTimeLimitS: 20,
    revealMs: 1800,         // โชว์เฉลย+คำอธิบายหลังตอบ
    // ตอบบอสผิด: ไม่มีค่าตั้งพิเศษ — จะเจอบอสอีกครั้งที่ checkpoint ถัดไปตามปกติ
  },

  /** คะแนน — ⚠️ ต้องตรงกับ db/03_rpc.sql */
  score: {
    // จูนแล้วให้คะแนนควิซคิดเป็น ~55% ของคะแนนรวม (ดู docs/03-decisions.md ส่วนที่ 2 ข้อ 3)
    // 🔧 ถ้า quiz_pct จาก playtest ยังต่ำกว่า 55% ให้ลดค่านี้เป็นอย่างแรก
    pointsPerMeter: 0.5,
    base: { easy: 15, medium: 30, hard: 60 },
    fastBonusFull: 10,      // ตอบภายใน 40% ของเวลาที่ให้
    fastBonusHalf: 5,       // ตอบภายใน 70%
    fastFullRatio: 0.40,
    fastHalfRatio: 0.70,
    comboStep: 0.25,        // คอมโบ 1→×1.00, 2→×1.25, 3→×1.50, 4→×1.75, 5+→×2.00
    comboMax: 2.0,
    heartBonus: 50,         // ต่อหัวใจที่เหลือตอนจบ
    victoryBonus: 300,      // ชนะบอสสุดท้าย
    // ตอบผิด: ไม่หักคะแนน ไม่หักหัวใจ — เจตนา ดู docs/03-decisions.md Q1
  },

  /** ฉาก — ผูกกับ "ด่าน" ไม่ใช่ระยะทาง เพื่อให้ตรงกับโครงคำถาม ด่าน 1-3 */
  level: {
    groundY: 600,
    stages: [
      // ด่าน 1 — รู้จัก Convergent
      { name: 'ด่าน 1 · รู้จักการชนกัน', spawnEveryM: 9, skyTop: 0x5b3f6e, skyBottom: 0xffb37b, pitChance: 0.3 },
      // ด่าน 2 — การมุดตัว
      { name: 'ด่าน 2 · เขตมุดตัว', spawnEveryM: 6.5, skyTop: 0x3a2350, skyBottom: 0xff8a5c, pitChance: 0.4 },
      // ด่าน 3 — ผลจากการชนกัน
      { name: 'ด่าน 3 · ผลจากการชนกัน', spawnEveryM: 5, skyTop: 0x1d1129, skyBottom: 0x7b3f6a, pitChance: 0.48 },
    ],
    /** เริ่มมีอุกกาบาตตกหลังผ่านระยะนี้ (ให้ผู้เล่นชินกับพื้นก่อน) */
    meteorStartM: 60,
    meteorEveryMs: { min: 1400, max: 2400 },
    minGapBetweenObstaclesM: 3, // กันสุ่มมาติดกันจนหลบไม่ได้ — ตรวจทุกครั้งที่ spawn
    // กว้างสุดต้องน้อยกว่าระยะกระโดดที่ความเร็วปกติ (220 px) ไม่งั้นบังคับให้ต้องกดเร่งเสมอ
    pitWidthPx: { min: 90, max: 180 },
  },

  /** UI */
  ui: {
    // GDD เขียนไว้ 10 วิ แต่การนั่งจ้องจอ 10 วินาทีก่อนได้เล่นน่าเบื่อมากบนเว็บ
    // จึงย้ายไปใช้ wall.startDelayMs = 10 วิ เป็น "ช่วงผ่อนผัน" แทน
    // (ปล่อยตัวเร็ว แต่กำแพงยังไม่ออกวิ่ง) ได้ความรู้สึกเดียวกันโดยไม่ต้องรอ
    countdownSeconds: 3,
    stageBannerMs: 2000,
  },

  /** งบประสิทธิภาพ */
  perf: {
    maxDeltaMs: 50,         // จำกัด delta กันเทเลพอร์ตตอนสลับแท็บกลับมา
    poolSize: { obstacle: 30, particle: 120, floatText: 12 },
    hudUpdateHz: 10,        // throttle event ไป React ไม่ต้องส่งทุกเฟรม
  },
};
// หมายเหตุ: ตั้งใจไม่ใส่ `as const`
// เพราะแผงจูนค่า (src/debug/tuning.ts) เขียนทับค่าพวกนี้ตอนรันเพื่อปรับสดๆ

/** ตัวคูณคอมโบ — ใช้ให้ตรงกับสูตรใน db/03_rpc.sql */
export function comboMultiplier(combo: number): number {
  const { comboStep, comboMax } = BALANCE.score;
  return Math.min(1 + comboStep * Math.max(combo - 1, 0), comboMax);
}

/** ความเร็วกำแพง ณ วินาทีที่ t (หลังเริ่มไล่แล้ว) */
export function wallSpeedAt(elapsedSec: number): number {
  const { startSpeed, accelPerSec, maxSpeed } = BALANCE.wall;
  return Math.min(startSpeed + accelPerSec * elapsedSec, maxSpeed);
}

/** ระยะกระโดดสูงสุดในแนวราบ ณ ความเร็วหนึ่ง — ใช้ตรวจว่าหลุมข้ามได้จริงไหม */
export function jumpDistanceAt(speedPxPerSec: number): number {
  const { jumpVelocity, gravity } = BALANCE.player;
  const airTimeSec = (2 * Math.abs(jumpVelocity)) / gravity;
  return speedPxPerSec * airTimeSec;
}
