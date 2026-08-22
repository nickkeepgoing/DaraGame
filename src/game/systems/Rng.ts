/**
 * เครื่องสุ่มแบบมี seed
 *
 * ⛔ ห้ามใช้ Math.random() ในการสร้างด่านเด็ดขาด
 *    ถ้าใช้ ทุกคนจะเจอด่านคนละแบบ → เทียบคะแนนกันไม่ได้ → leaderboard ไร้ความหมาย
 *    (ดู docs/02-database.md §2.4)
 *
 * ครูตั้ง classes.level_seed ประจำวัน → ทั้งห้องเจอด่านเดียวกันเป๊ะ = แข่งกันจริง
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // บังคับให้เป็น uint32 ที่ไม่ใช่ 0
    this.state = (Math.abs(Math.floor(seed)) % 4294967295) + 1;
  }

  /** [0, 1) — mulberry32 */
  next(): number {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** จำนวนเต็ม [min, max] */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** true ด้วยความน่าจะเป็น p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }

  /** เลือกตามน้ำหนัก เช่น weighted({easy: 0.5, medium: 0.3, hard: 0.2}) */
  weighted<K extends string>(weights: Record<K, number>): K {
    const keys = Object.keys(weights) as K[];
    const total = keys.reduce((sum, k) => sum + weights[k], 0);
    let roll = this.next() * total;
    for (const k of keys) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return keys[keys.length - 1];
  }
}

/** seed สุ่มสำหรับโหมดออฟไลน์ / เวลาไม่มี seed จากเซิร์ฟเวอร์ */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}
