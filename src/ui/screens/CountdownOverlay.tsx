import { useEffect, useState } from 'react';
import { BALANCE } from '@/config/balance';
import { emitBus } from '@/game/EventBus';
import { sfx } from '@/audio/sfx';

interface Props {
  onDone: () => void;
}

/**
 * นับถอยหลังก่อนปล่อยตัว
 *
 * GDD เขียนไว้ 10 วินาที แต่การนั่งจ้องจอ 10 วิก่อนได้เล่นน่าเบื่อมากบนเว็บ
 * จึงนับสั้นๆ แล้วย้าย "ช่วงผ่อนผัน 10 วิ" ไปเป็นตอนที่กำแพงยังไม่ออกวิ่งแทน
 * (BALANCE.wall.startDelayMs) — ได้ความรู้สึกเดียวกันโดยผู้เล่นได้ลงมือทันที
 */
export function CountdownOverlay({ onDone }: Props) {
  const [count, setCount] = useState(BALANCE.ui.countdownSeconds);

  useEffect(() => {
    // นับด้วยตัวแปรธรรมดา ไม่ใช่ setCount(c => ...)
    // เพราะ side effect (เสียง / emit / เปลี่ยนหน้าจอ) ห้ามอยู่ในฟังก์ชัน updater ของ setState
    // React จะเตือน "Cannot update a component while rendering a different component"
    let remaining = BALANCE.ui.countdownSeconds;

    const timer = window.setInterval(() => {
      remaining -= 1;

      if (remaining > 0) {
        setCount(remaining);
        sfx.tick();
        return;
      }

      window.clearInterval(timer);
      setCount(0);
      sfx.go();
      emitBus('game:start');
      onDone();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [onDone]);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-night-950/45">
      <div
        key={count}
        className="font-display animate-pop-in tabular text-[8rem] leading-none font-bold text-dusk-100 drop-shadow-[0_6px_0_rgba(225,74,43,0.6)]"
      >
        {count > 0 ? count : 'ไป!'}
      </div>
      <p className="mt-4 text-dusk-200">กำแพงลาวาจะเริ่มไล่ในอีก 10 วินาที</p>
    </div>
  );
}
