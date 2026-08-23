import { useEffect, useState } from 'react';
import { BALANCE, QUESTIONS_PER_STAGE, STAGE_COUNT } from '@/config/balance';
import { useGameStore } from '@/store/gameStore';
import { isTouchDevice } from '@/lib/mobile';
import { FullscreenButton, IosHomeScreenHint } from '@/ui/components/FullscreenButton';

interface Props {
  busy: boolean;
  error: string | null;
  nickname: string;
  onStart: () => void;
  onLeaderboard: () => void;
}

/**
 * หน้าก่อนเริ่มเล่น
 *
 * เดิมหน้านี้ยาวจนล้นจอมือถือแนวนอน (สูง ~360 px) ต้องเลื่อนถึงจะเจอปุ่มเริ่ม
 * และโชว์ปุ่มคีย์บอร์ดให้คนเล่นมือถือดูด้วย ซึ่งไม่มีประโยชน์
 *
 * เขียนใหม่โดยยึด 2 ข้อ:
 *   1. ต้องจบในจอเดียว ไม่ต้องเลื่อน — เด็กไม่อ่านอะไรที่ต้องเลื่อนอยู่แล้ว
 *   2. แสดงเฉพาะวิธีบังคับของ "อุปกรณ์ที่กำลังใช้อยู่" ไม่ใช่ทั้งสองแบบ
 */
export function HowToPlayScreen({ busy, error, nickname, onStart, onLeaderboard }: Props) {
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setScreen = useGameStore((s) => s.setScreen);
  const [touch, setTouch] = useState(false);

  useEffect(() => setTouch(isTouchDevice()), []);

  const controls = touch
    ? [
        { key: '▲', label: 'กระโดด', hint: 'กดค้างยิ่งนานยิ่งสูง' },
        { key: '▼', label: 'หมอบ', hint: 'ลอดใต้ตัวที่บินมา' },
        { key: '▶', label: 'เร่ง', hint: 'กดค้างไว้เพื่อหนีลาวา' },
      ]
    : [
        { key: 'Space', label: 'กระโดด', hint: 'กดค้างยิ่งนานยิ่งสูง' },
        { key: '↓', label: 'หมอบ', hint: 'ลอดใต้ตัวที่บินมา' },
        { key: '→', label: 'เร่ง', hint: 'กดค้างไว้เพื่อหนีลาวา' },
      ];

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-3">
      <div className="animate-pop-in panel w-full max-w-2xl rounded-3xl p-4 sm:p-6">
        {/* หัวเรื่อง + ปุ่มระบบ */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-bold text-dusk-100 sm:text-2xl">
              พร้อมแล้วนะ {nickname} 🦕
            </h2>
            <p className="truncate text-[11px] text-dusk-200/70 sm:text-sm">
              วิ่งหนีลาวา ตอบคำถามให้ครบ {STAGE_COUNT} ด่าน แล้วไปเจอบอสสุดท้าย
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <FullscreenButton />
            <button
              onClick={toggleMute}
              className="btn-ghost flex h-11 w-11 items-center justify-center rounded-xl text-base"
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        {/* วิธีบังคับ — แสดงเฉพาะของอุปกรณ์ที่ใช้อยู่ */}
        <div className="mb-3 grid grid-cols-3 gap-2">
          {controls.map((c) => (
            <div key={c.label} className="rounded-2xl bg-white/5 px-2 py-2 text-center">
              <div className="font-display mb-0.5 text-base leading-none font-bold text-dusk-100 sm:text-xl">
                {c.key}
              </div>
              <div className="text-xs font-semibold text-white/90">{c.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/45">{c.hint}</div>
            </div>
          ))}
        </div>

        {/* กติกาสำคัญ — เหลือเฉพาะที่เปลี่ยนวิธีเล่นจริงๆ */}
        <div className="mb-3 space-y-1.5 rounded-2xl bg-white/5 p-3 text-[11px] leading-relaxed text-white/75 sm:text-xs">
          <p>
            <b className="text-dusk-100">❤️ {BALANCE.player.hearts} หัวใจ</b> — ชนของเสีย 1 ดวง
            หมดแล้วยัง <b className="text-dusk-100">ฟื้นได้ {BALANCE.player.maxRevives} ครั้ง</b>{' '}
            ถ้าตอบคำถามฟื้นถูก
          </p>
          <p>
            <b className="text-leaf-400">⭐ ตอบถูกได้คะแนน + ดันลาวาถอยห่าง</b> · ตอบผิดไม่เสียหัวใจ
            แค่ลาวาเร่งขึ้นครู่หนึ่ง แล้วเราจะเฉลยให้
          </p>
          <p>
            <b className="text-dusk-100">
              🗺️ ด่านละ {QUESTIONS_PER_STAGE} ข้อ
            </b>{' '}
            ครบ {STAGE_COUNT} ด่านแล้วเจอ{' '}
            <b className="text-dusk-100">👑 บอสสุดท้าย — ตอบถูก = ชนะ</b>
          </p>
        </div>

        {error && (
          <p className="mb-2 rounded-xl border border-lava-500/40 bg-lava-600/15 px-3 py-2 text-xs text-dusk-100">
            {error}
          </p>
        )}

        {/* ปุ่มหลักเด่นสุด ปุ่มรองเล็กลง — ไม่ให้ผู้เล่นลังเลว่าต้องกดอันไหน */}
        <div className="flex gap-2">
          <button
            onClick={onStart}
            disabled={busy}
            className="btn-primary flex-1 rounded-2xl py-3 text-base font-bold sm:py-4 sm:text-lg"
          >
            {busy ? 'กำลังเตรียมด่าน…' : '▶  เริ่มวิ่ง'}
          </button>
          <button
            onClick={onLeaderboard}
            className="btn-ghost flex h-auto min-w-[52px] items-center justify-center rounded-2xl px-3 text-lg"
            aria-label="กระดานคะแนน"
          >
            🏆
          </button>
          <button
            onClick={() => setScreen('teacher')}
            className="btn-ghost flex h-auto min-w-[52px] items-center justify-center rounded-2xl px-3 text-lg"
            aria-label="สำหรับครูผู้สอน"
          >
            👨‍🏫
          </button>
        </div>

        <IosHomeScreenHint />
      </div>
    </div>
  );
}
