import { useEffect, useRef, useState } from 'react';
import { BALANCE, QUESTIONS_PER_STAGE, STAGE_COUNT } from '@/config/balance';
import { onBus } from '@/game/EventBus';
import { useGameStore } from '@/store/gameStore';

interface Props {
  onQuit: () => void;
}

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

  return (
    <>
      <div className="safe-inset pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="flex items-start justify-between gap-2">
          {/* หัวใจ + ด่าน */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl bg-night-900/70 px-3 py-1.5 backdrop-blur-sm">
              {Array.from({ length: BALANCE.player.hearts }, (_, i) => (
                <span
                  key={i}
                  className={`text-lg transition-opacity ${i < hud.hearts ? '' : 'opacity-25 grayscale'}`}
                >
                  ❤️
                </span>
              ))}
              {hud.revivesLeft > 0 && (
                <span
                  className="ml-1 text-[11px] text-white/45"
                  title="ตอบคำถามถูกตอนตายเพื่อฟื้นกลับมาเล่นต่อ"
                >
                  ฟื้นได้ {hud.revivesLeft}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 self-start rounded-2xl bg-night-900/70 px-3 py-1.5 backdrop-blur-sm">
              <span
                className={`text-xs font-semibold ${isBoss ? 'text-dusk-100' : 'text-dusk-200'}`}
              >
                {isBoss ? '👑 บอสสุดท้าย' : `ด่าน ${hud.stage}/${STAGE_COUNT}`}
              </span>
              {!isBoss && (
                <span className="flex gap-1">
                  {Array.from({ length: QUESTIONS_PER_STAGE }, (_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-4 rounded-full ${
                        i < hud.stageProgress ? 'bg-leaf-400' : 'bg-white/20'
                      }`}
                    />
                  ))}
                </span>
              )}
            </div>
          </div>

          {/* คะแนน + ระยะทาง */}
          <div className="flex items-center gap-4 rounded-2xl bg-night-900/70 px-4 py-1.5 backdrop-blur-sm">
            <Stat label="ระยะทาง" value={`${hud.distanceM} ม.`} />
            <div className="h-7 w-px bg-white/15" />
            <ScoreStat score={quizScore} />
          </div>

          <div className="flex gap-2">
            <button
              onClick={toggleMute}
              className="btn-ghost pointer-events-auto rounded-xl px-3 py-2 text-sm"
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={onQuit}
              className="btn-ghost pointer-events-auto rounded-xl px-3 py-2 text-sm"
            >
              ออก
            </button>
          </div>
        </div>

        {/* มาตรวัดระยะห่างกำแพง */}
        <div className="mx-auto mt-2 max-w-md">
          <div className="mb-1 flex items-center justify-between px-1 text-[11px]">
            <span className="text-lava-400">🌋 กำแพงลาวา</span>
            <span className={danger > 0.75 ? 'animate-soft-pulse text-lava-400' : 'text-white/45'}>
              {hud.chaseStarted ? `${hud.wallGapPx} px` : 'ยังไม่ออกวิ่ง'}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-night-900/70">
            <div
              className="h-full rounded-full transition-[width] duration-100 ease-linear"
              style={{
                width: `${danger * 100}%`,
                background:
                  danger > 0.75
                    ? 'linear-gradient(90deg,#ff9c41,#ff6b3d)'
                    : 'linear-gradient(90deg,#ffc79a,#ff9c41)',
              }}
            />
          </div>
        </div>
      </div>

      <StageBanner />
    </>
  );
}

/**
 * คะแนนคำถามพร้อมเอฟเฟกต์ตอนได้คะแนนเพิ่ม
 *
 * ตัวเลขที่เปลี่ยนเงียบๆ ผู้เล่นมองไม่เห็น เพราะสายตาจดจ่ออยู่กับตัวละคร
 * จึงต้องมีทั้ง (1) ตัวเลขเด้ง (2) ป้าย "+N" ลอยขึ้น เพื่อให้รู้ว่าได้คะแนนแล้วจริง
 */
function ScoreStat({ score }: { score: number }) {
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
    <div className="relative text-center">
      <div className="text-[10px] leading-tight text-white/45">คะแนนคำถาม</div>
      <div
        className={`tabular text-lg leading-tight font-semibold text-leaf-400 transition-transform duration-200 ${
          bump ? 'scale-150' : 'scale-100'
        }`}
      >
        {score}
      </div>
      {gain > 0 && (
        <div className="animate-score-pop tabular pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 text-sm font-bold text-leaf-400">
          +{gain}
        </div>
      )}
    </div>
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
      <div className="animate-pop-in rounded-3xl border border-dusk-200/40 bg-night-900/85 px-8 py-5 text-center backdrop-blur-sm">
        <div className="font-display text-3xl font-bold text-dusk-100">{banner.name}</div>
        <div className="mt-1 text-sm text-white/55">คำถามจะยากขึ้นแล้วนะ 🔥</div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] leading-tight text-white/45">{label}</div>
      <div
        className={`tabular text-lg leading-tight font-semibold ${accent ? 'text-leaf-400' : 'text-dusk-100'}`}
      >
        {value}
      </div>
    </div>
  );
}
