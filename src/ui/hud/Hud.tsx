import { useEffect, useRef, useState } from 'react';
import { BALANCE, QUESTIONS_PER_STAGE, STAGE_COUNT } from '@/config/balance';
import { onBus } from '@/game/EventBus';
import { useGameStore } from '@/store/gameStore';

interface Props {
  onQuit: () => void;
}

/**
 * HUD ระหว่างเล่น
 *
 * หลักที่ยึด: จอมือถือแนวนอนสูงแค่ ~360 px และผู้เล่นมีเวลามองแค่เสี้ยววินาที
 *   • ทุกอย่างอยู่แถวเดียว สูงรวมไม่เกิน ~64 px
 *   • ใช้ไอคอนแทนข้อความทุกที่ที่ทำได้ (อ่านเร็วกว่าและกินที่น้อยกว่า)
 *   • ไม่โชว์ตัวเลขที่ผู้เล่นเอาไปทำอะไรไม่ได้ เช่น "580 px"
 *     ระยะห่างกำแพงบอกเป็น "สถานะ" (ปลอดภัย/ระวัง/อันตราย) + แถบสี เข้าใจได้ทันที
 */
export function Hud({ onQuit }: Props) {
  const hud = useGameStore((s) => s.hud);
  const setHud = useGameStore((s) => s.setHud);
  const quizScore = useGameStore((s) => s.quizScore);
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);

  // ⚠️ onBus คืนฟังก์ชัน unsubscribe มาให้ — ต้อง return ทุกครั้ง
  //    ถ้าลืม: เล่นใหม่ 3 รอบ = listener ซ้อน 3 ตัว
  useEffect(() => onBus('hud:update', setHud), [setHud]);

  const danger = Math.max(0, Math.min(1, 1 - hud.wallGapPx / BALANCE.wall.maxGapPx));
  const isBoss = hud.stage > STAGE_COUNT;

  const status = !hud.chaseStarted
    ? { text: 'ลาวายังไม่ออกวิ่ง', tone: 'text-white/50' }
    : danger > 0.82
      ? { text: 'อันตราย! วิ่งเร็วเข้า', tone: 'text-lava-400 animate-soft-pulse' }
      : danger > 0.6
        ? { text: 'ลาวาใกล้เข้ามาแล้ว', tone: 'text-dusk-200' }
        : { text: 'ยังห่างอยู่ ปลอดภัย', tone: 'text-leaf-400' };

  return (
    <>
      <div className="safe-inset pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="flex items-center justify-between gap-2">
          {/* ซ้าย: หัวใจ + สิทธิ์ฟื้น */}
          <div className="flex items-center gap-1 rounded-full bg-night-900/75 px-2.5 py-1.5 backdrop-blur-sm">
            {Array.from({ length: BALANCE.player.hearts }, (_, i) => (
              <span
                key={i}
                className={`text-base leading-none transition-all ${
                  i < hud.hearts ? '' : 'scale-90 opacity-25 grayscale'
                }`}
              >
                ❤️
              </span>
            ))}
            {hud.revivesLeft > 0 && (
              <span
                className="tabular ml-0.5 flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 text-[11px] leading-5 text-white/70"
                title={`ตายแล้วตอบคำถามถูก ฟื้นได้อีก ${hud.revivesLeft} ครั้ง`}
              >
                ✨{hud.revivesLeft}
              </span>
            )}
          </div>

          {/* กลาง: ด่าน + คะแนน + ระยะทาง */}
          <div className="flex items-center gap-2.5 rounded-full bg-night-900/75 px-3 py-1 backdrop-blur-sm">
            <span className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-semibold whitespace-nowrap ${
                  isBoss ? 'text-dusk-100' : 'text-dusk-200'
                }`}
              >
                {isBoss ? '👑 บอส' : `ด่าน ${hud.stage}/${STAGE_COUNT}`}
              </span>
              {!isBoss && (
                <span className="flex gap-0.5">
                  {Array.from({ length: QUESTIONS_PER_STAGE }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-3 rounded-full ${
                        i < hud.stageProgress ? 'bg-leaf-400' : 'bg-white/25'
                      }`}
                    />
                  ))}
                </span>
              )}
            </span>

            <span className="h-5 w-px bg-white/15" />
            <ScoreChip score={quizScore} />
            <span className="h-5 w-px bg-white/15" />
            <span className="tabular text-sm leading-none font-semibold text-dusk-100">
              {hud.distanceM}
              <span className="ml-0.5 text-[10px] font-normal text-white/45">ม.</span>
            </span>
          </div>

          {/* ขวา: ปุ่มระบบ — ทุกปุ่มอย่างน้อย 44x44 ตามมาตรฐาน touch target */}
          <div className="flex gap-1.5">
            <button
              onClick={toggleMute}
              className="btn-ghost pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-base"
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={onQuit}
              className="btn-ghost pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full text-base"
              aria-label="ออกจากเกม"
            >
              ✕
            </button>
          </div>
        </div>

        {/* แถบระยะห่างกำแพงลาวา — บอกเป็นสถานะ ไม่ใช่ตัวเลข px */}
        <div className="mx-auto mt-1.5 max-w-xs">
          <div className="relative h-2.5 overflow-hidden rounded-full bg-night-900/75">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-linear"
              style={{
                width: `${Math.max(danger * 100, 4)}%`,
                background:
                  danger > 0.82
                    ? 'linear-gradient(90deg,#e14a2b,#ff6b3d)'
                    : danger > 0.6
                      ? 'linear-gradient(90deg,#ff9c41,#ffc79a)'
                      : 'linear-gradient(90deg,#9bd17b,#ffc79a)',
              }}
            />
            {/* หัวลาวาไล่ตาม — เห็นแล้วรู้ทันทีว่าอะไรกำลังไล่มา */}
            <span
              className="absolute top-1/2 -translate-y-1/2 text-[11px] leading-none transition-[left] duration-150 ease-linear"
              style={{ left: `calc(${Math.max(danger * 100, 4)}% - 10px)` }}
            >
              🌋
            </span>
          </div>
          <div className={`mt-0.5 text-center text-[10px] leading-tight ${status.tone}`}>
            {status.text}
          </div>
        </div>
      </div>

      <StageBanner />
    </>
  );
}

/**
 * คะแนนคำถามพร้อมเอฟเฟกต์ตอนได้เพิ่ม
 *
 * ตัวเลขที่เปลี่ยนเงียบๆ ผู้เล่นมองไม่เห็น เพราะสายตาจดจ่ออยู่กับตัวละคร
 * จึงต้องมีทั้งตัวเลขเด้งและป้าย "+N" ลอยขึ้น
 */
function ScoreChip({ score }: { score: number }) {
  const [gain, setGain] = useState(0);
  const [bump, setBump] = useState(false);
  const prevRef = useRef(score);

  useEffect(() => {
    const diff = score - prevRef.current;
    prevRef.current = score;
    if (diff <= 0) return;

    setGain(diff);
    setBump(true);
    const t1 = window.setTimeout(() => setBump(false), 450);
    const t2 = window.setTimeout(() => setGain(0), 1300);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [score]);

  return (
    <span className="relative flex items-center gap-1">
      <span className="text-[13px] leading-none">⭐</span>
      <span
        className={`tabular text-sm leading-none font-bold text-leaf-400 transition-transform duration-200 ${
          bump ? 'scale-[1.45]' : 'scale-100'
        }`}
      >
        {score}
      </span>
      {gain > 0 && (
        <span className="animate-score-pop tabular pointer-events-none absolute -top-1 left-1/2 text-xs font-bold text-leaf-400">
          +{gain}
        </span>
      )}
    </span>
  );
}

/** ป้ายใหญ่กลางจอตอนขึ้นด่านใหม่ */
function StageBanner() {
  const [banner, setBanner] = useState<{ stage: number; name: string } | null>(null);

  useEffect(
    () =>
      onBus('stage:changed', (payload) => {
        setBanner(payload);
        window.setTimeout(() => setBanner(null), BALANCE.ui.stageBannerMs);
      }),
    [],
  );

  if (!banner) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="animate-pop-in rounded-2xl border border-dusk-200/40 bg-night-900/90 px-6 py-3 text-center backdrop-blur-sm">
        <div className="font-display text-xl font-bold text-dusk-100 sm:text-3xl">
          {banner.name}
        </div>
        <div className="mt-0.5 text-xs text-white/60">คำถามจะยากขึ้นแล้วนะ 🔥</div>
      </div>
    </div>
  );
}
