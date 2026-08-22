import Phaser from 'phaser';
import type {
  GameOverPayload,
  HudState,
  QuizAnsweredPayload,
  QuizOpenPayload,
  StageChangedPayload,
} from '@/types/game';

/**
 * สะพานเชื่อม React ↔ Phaser
 *
 * ⚠️ ทุกที่ที่ `.on()` ต้องมี `.off()` ตอน cleanup เสมอ
 *    ถ้าลืม: กดเล่นใหม่ 3 รอบ = listener ซ้อน 3 ตัว = คะแนนบวก 3 เท่า
 *    ใช้ helper `onBus()` ด้านล่างจะปลอดภัยกว่าเรียก .on() ตรงๆ
 */
export const EventBus = new Phaser.Events.EventEmitter();

export interface GameEvents {
  /** Phaser → React : โหลดเสร็จ พร้อมเริ่ม */
  'game:ready': () => void;
  /** React → Phaser : นับถอยหลังจบ ปล่อยตัว */
  'game:start': () => void;
  /** Phaser → React : อัปเดต HUD (throttle แล้ว ~10 ครั้ง/วิ) */
  'hud:update': (state: HudState) => void;
  /** Phaser → React : ถึง checkpoint เปิด popup คำถาม */
  'quiz:open': (payload: QuizOpenPayload) => void;
  /** React → Phaser : ตอบเสร็จแล้ว เดินเกมต่อ */
  'quiz:answered': (payload: QuizAnsweredPayload) => void;
  /** Phaser → React : ขึ้นด่านใหม่ (โชว์ป้าย 'ด่าน 2') */
  'stage:changed': (payload: StageChangedPayload) => void;
  /** Phaser → React : จบเกม */
  'game:over': (payload: GameOverPayload) => void;
  /** React → Phaser : สั่งจบเกมทันที (กดออกจากเกม) */
  'game:quit': () => void;
}

/**
 * subscribe แบบมี type + คืนฟังก์ชัน unsubscribe
 *
 * ```ts
 * useEffect(() => onBus('quiz:open', handleOpen), []);
 * ```
 */
export function onBus<K extends keyof GameEvents>(
  event: K,
  handler: GameEvents[K],
): () => void {
  EventBus.on(event, handler as (...args: unknown[]) => void);
  return () => {
    EventBus.off(event, handler as (...args: unknown[]) => void);
  };
}

export function emitBus<K extends keyof GameEvents>(
  event: K,
  ...args: Parameters<GameEvents[K]>
): void {
  EventBus.emit(event, ...args);
}
