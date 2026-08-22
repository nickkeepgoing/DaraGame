import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { touchInput, resetTouchInput } from '@/game/input';
import { isTouchDevice } from '@/lib/mobile';

type Key = keyof typeof touchInput;

/**
 * ปุ่มควบคุมบนหน้าจอ — ปุ่มจริง มองเห็นชัด ไม่ใช่โซนแตะที่มองไม่เห็น
 *
 *   ซ้ายล่าง : ◀ ▶  เดินถอย / เร่ง
 *   ขวาล่าง : กระโดด (ใหญ่สุด เพราะใช้บ่อยที่สุด) + หมอบ
 *
 * รายละเอียดที่ทำให้ใช้งานได้จริงบนมือถือ:
 *   • ปุ่มใหญ่ 76-104 px — ใหญ่กว่ามาตรฐาน touch target 48 px เพราะต้องกดขณะตื่นเต้น
 *   • ใช้ Pointer Events → กดหลายปุ่มพร้อมกันได้ (วิ่ง + กระโดด)
 *   • setPointerCapture → เลื่อนนิ้วออกนอกปุ่มแล้วปล่อย ยังได้รับ pointerup
 *     ถ้าไม่ทำ ตัวละครจะ "กระโดดค้าง" ตลอดกาล
 *   • เงาดำใต้ปุ่ม ทำให้เห็นปุ่มชัดแม้ฉากหลังสว่าง
 */
export function TouchControls() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const forced = new URLSearchParams(window.location.search).has('buttons');
    setVisible(forced || isTouchDevice());
    return resetTouchInput;
  }, []);

  // กันปุ่มค้างเวลาสลับแอปกลางคัน (เช่น มีสายเข้า)
  useEffect(() => {
    const clear = () => resetTouchInput();
    document.addEventListener('visibilitychange', clear);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('visibilitychange', clear);
      window.removeEventListener('blur', clear);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="safe-inset pointer-events-none absolute inset-0 z-10 select-none">
      {/* ซ้าย: เดิน */}
      <div className="absolute bottom-3 left-3 flex items-end gap-3">
        <PadButton keys={['left']} size={76} label="ถอย" glyph="◀" />
        <PadButton keys={['right']} size={76} label="เร่ง" glyph="▶" />
      </div>

      {/* ขวา: กระโดด / หมอบ */}
      <div className="absolute right-3 bottom-3 flex items-end gap-3">
        <PadButton keys={['duck']} size={76} label="หมอบ" glyph="▼" tone="cool" />
        <PadButton keys={['jump']} size={104} label="กระโดด" glyph="▲" tone="hot" />
      </div>
    </div>
  );
}

function PadButton({
  keys,
  size,
  label,
  glyph,
  tone = 'neutral',
}: {
  keys: Key[];
  size: number;
  label: string;
  glyph: string;
  tone?: 'neutral' | 'hot' | 'cool';
}) {
  const [held, setHeld] = useState(false);

  const set = (down: boolean) => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (down) e.currentTarget.setPointerCapture(e.pointerId);
    else if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);

    for (const k of keys) touchInput[k] = down;
    setHeld(down);
  };

  const palette = {
    neutral: 'from-night-700/90 to-night-900/90 border-white/25 text-white',
    hot: 'from-dusk-300/95 to-lava-500/95 border-dusk-100/60 text-night-900',
    cool: 'from-sky-star/85 to-cosmic/85 border-white/40 text-night-900',
  }[tone];

  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: size, height: size }}
      className={`pointer-events-auto flex touch-none flex-col items-center justify-center rounded-full border-2 bg-gradient-to-b shadow-[0_6px_18px_-4px_rgba(0,0,0,0.7)] backdrop-blur-sm transition-transform duration-75 ${palette} ${
        held ? 'scale-90 brightness-125' : ''
      }`}
    >
      <span style={{ fontSize: size * 0.3 }} className="leading-none font-bold">
        {glyph}
      </span>
      <span style={{ fontSize: Math.max(11, size * 0.15) }} className="mt-0.5 font-semibold">
        {label}
      </span>
    </button>
  );
}
