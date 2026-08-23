import { useState } from 'react';
import { isOffline } from '@/api';
import { useGameStore } from '@/store/gameStore';

const VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

/**
 * ป้ายสถานะมุมจอ — เห็นได้ตลอดทุกหน้าจอ รวมถึงตอนกำลังเล่น
 *
 * ทำไมต้องมี: เดิมแถบ "โหมดออฟไลน์" ถูกซ่อนตอน screen === 'playing'
 * เวลาผู้เล่นแจ้งปัญหาแล้วเราถามว่า "เห็นแถบออฟไลน์ไหม" เขาดูตอนกำลังเล่น
 * จึงตอบว่าไม่เห็น เราเลยสรุปผิดว่าต่อเซิร์ฟเวอร์อยู่ ทั้งที่จริงอาจเป็นออฟไลน์
 *
 * ป้ายนี้บอก 3 อย่างที่ต้องรู้เวลาไล่บั๊ก และรูปเดียวก็พอ:
 *   1. เวอร์ชันที่รันอยู่จริง  → รู้ว่าได้โค้ดใหม่แล้วหรือยัง (กันปัญหา cache)
 *   2. ONLINE / OFFLINE      → รู้ว่าคะแนนวิ่งผ่านเซิร์ฟเวอร์หรือเก็บในเครื่อง
 *   3. ข้อผิดพลาดล่าสุด       → รู้ว่าพังตรงไหน แตะเพื่อดูข้อความเต็ม
 */
export function StatusChip() {
  const lastError = useGameStore((s) => s.lastError);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pointer-events-none absolute bottom-1 left-1 z-40 flex max-w-[92vw] flex-col items-start gap-1">
      {lastError && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="pointer-events-auto max-w-full rounded-lg border border-lava-500/60 bg-lava-600/90 px-2 py-1 text-left text-[10px] leading-tight text-white"
        >
          <span className="font-semibold">⚠️ พบข้อผิดพลาด</span>{' '}
          <span className="opacity-80">{expanded ? '(แตะเพื่อย่อ)' : '(แตะเพื่อดู)'}</span>
          {expanded && <span className="mt-1 block break-words opacity-95">{lastError}</span>}
        </button>
      )}

      <span
        className={`rounded-full px-2 py-0.5 text-[10px] leading-none ${
          isOffline ? 'bg-dusk-400/85 text-night-900' : 'bg-night-900/70 text-white/45'
        }`}
      >
        v{VERSION} · {isOffline ? 'OFFLINE (คะแนนเก็บในเครื่อง)' : 'ONLINE'}
      </span>
    </div>
  );
}
