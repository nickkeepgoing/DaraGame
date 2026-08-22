import { useEffect, useState } from 'react';
import { TUNABLES, exportTuningJson, readTuning, writeTuning } from '@/debug/tuning';

/**
 * แผงจูนค่าแบบสด — กด ` หรือ ~ เพื่อเปิด/ปิด
 *
 * ค่าที่ปรับมีผลทันทีในเฟรมถัดไป ยกเว้น "แรงโน้มถ่วง" ที่ Arcade อ่านตอนสร้าง world
 * จึงมีผลรอบถัดไป
 *
 * ถูกตัดออกจาก production build อัตโนมัติ (App.tsx เรียกใช้ใต้ import.meta.env.DEV)
 */
export function DebugPanel() {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '`' || e.key === '~') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!open) {
    return (
      <div className="pointer-events-none absolute bottom-2 right-3 z-40 text-[10px] text-white/25">
        กด ` เพื่อเปิดแผงจูนค่า
      </div>
    );
  }

  return (
    <div className="absolute bottom-3 right-3 z-40 max-h-[80vh] w-80 overflow-y-auto rounded-2xl border border-white/15 bg-night-950/95 p-4 text-xs backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display font-semibold text-dusk-100">🎛 แผงจูนค่า</span>
        <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white">
          ✕
        </button>
      </div>

      <div className="space-y-3">
        {TUNABLES.map((t) => {
          const value = readTuning(t);
          return (
            <label key={`${t.section}.${t.key}`} className="block">
              <span className="mb-1 flex items-center justify-between text-white/65">
                <span>{t.label}</span>
                <span className="tabular text-dusk-200">{value}</span>
              </span>
              <input
                type="range"
                min={t.min}
                max={t.max}
                step={t.step}
                value={value}
                onChange={(e) => {
                  writeTuning(t, Number(e.target.value));
                  force((n) => n + 1);
                }}
                className="w-full accent-[#ff8a5c]"
              />
            </label>
          );
        })}
      </div>

      <button
        onClick={() => {
          void navigator.clipboard.writeText(exportTuningJson());
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        }}
        className="btn-ghost mt-4 w-full rounded-lg py-2"
      >
        {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกค่าเป็น JSON'}
      </button>
      <p className="mt-2 leading-relaxed text-white/35">
        เอาไปแปะทับใน <code>src/config/balance.ts</code> ได้เลย
        <br />
        แรงโน้มถ่วงมีผลรอบถัดไป
      </p>
    </div>
  );
}
