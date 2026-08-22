/**
 * แผงจูนค่าแบบสด (กด ~ หรือเปิดด้วย ?debug=1)
 *
 * ทำไมต้องมีตั้งแต่สัปดาห์แรก (docs/03-decisions.md ส่วนที่ 2 ข้อ 10):
 * เกมแนวนี้ "ความรู้สึกตอนเล่น" คือทั้งหมด และจูนได้ด้วยการลองเท่านั้น
 * ถ้าต้องแก้โค้ด → รอ build → เล่นใหม่ ทุกครั้งที่ขยับตัวเลข จะจูนได้ 10 ครั้ง/วัน
 * ถ้ามีสไลเดอร์ จูนได้ 200 ครั้ง/วัน
 *
 * ค่าถูกเขียนกลับเข้า BALANCE ตรงๆ ทำให้ทุกที่ที่อ่านค่าเห็นผลทันทีในเฟรมถัดไป
 * (BALANCE เป็น `as const` แค่ระดับ type — ตอนรันมันคือ object ธรรมดา)
 * แผงนี้ถูกตัดออกจาก production build อัตโนมัติด้วย import.meta.env.PROD
 */
import { BALANCE } from '@/config/balance';

export interface Tunable {
  section: 'player' | 'wall' | 'quiz' | 'score';
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const TUNABLES: Tunable[] = [
  { section: 'player', key: 'runSpeed', label: 'ความเร็ววิ่ง', min: 120, max: 480, step: 10 },
  { section: 'player', key: 'maxSpeed', label: 'ความเร็วสูงสุด', min: 200, max: 700, step: 10 },
  { section: 'player', key: 'jumpVelocity', label: 'แรงกระโดด', min: -1100, max: -320, step: 10 },
  { section: 'player', key: 'gravity', label: 'แรงโน้มถ่วง', min: 800, max: 3200, step: 50 },
  { section: 'player', key: 'coyoteMs', label: 'coyote time (ms)', min: 0, max: 260, step: 10 },
  { section: 'player', key: 'jumpBufferMs', label: 'jump buffer (ms)', min: 0, max: 300, step: 10 },

  { section: 'wall', key: 'startSpeed', label: 'ความเร็วกำแพงเริ่มต้น', min: 60, max: 400, step: 10 },
  { section: 'wall', key: 'accelPerSec', label: 'กำแพงเร่ง (px/s ต่อวิ)', min: 0, max: 12, step: 0.2 },
  { section: 'wall', key: 'maxSpeed', label: 'ความเร็วกำแพงสูงสุด', min: 150, max: 800, step: 10 },
  { section: 'wall', key: 'pushBackOnCorrect', label: 'ตอบถูก ผลักกำแพง (px)', min: 0, max: 900, step: 20 },

  { section: 'quiz', key: 'checkpointEveryM', label: 'ระยะห่าง checkpoint (ม.)', min: 15, max: 140, step: 5 },
  { section: 'quiz', key: 'wallSlowFactor', label: 'กำแพงช้าลงตอนตอบ (เท่า)', min: 0, max: 1, step: 0.05 },

  { section: 'score', key: 'pointsPerMeter', label: 'คะแนนต่อเมตร', min: 0, max: 3, step: 0.1 },
];

type Mutable = Record<string, Record<string, number>>;

export function readTuning(t: Tunable): number {
  return (BALANCE as unknown as Mutable)[t.section][t.key];
}

export function writeTuning(t: Tunable, value: number): void {
  (BALANCE as unknown as Mutable)[t.section][t.key] = value;
}

/** คัดลอกไปแปะทับ src/config/balance.ts ได้เลย */
export function exportTuningJson(): string {
  const out: Record<string, Record<string, number>> = {};
  for (const t of TUNABLES) {
    out[t.section] ??= {};
    out[t.section][t.key] = readTuning(t);
  }
  return JSON.stringify(out, null, 2);
}
