import { useState, type ReactNode } from 'react';
import { BALANCE, QUESTIONS_PER_STAGE, STAGE_COUNT } from '@/config/balance';
import { useGameStore } from '@/store/gameStore';
import { FullscreenButton, IosHomeScreenHint } from '@/ui/components/FullscreenButton';
import { TeacherPasswordModal } from '@/ui/components/TeacherPasswordModal';

interface Props {
  busy: boolean;
  error: string | null;
  nickname: string;
  onStart: () => void;
  onLeaderboard: () => void;
}

const CONTROLS = [
  { keys: '← →  /  A D', label: 'วิ่ง — กดขวาค้างไว้เพื่อเร่ง กดซ้ายเพื่อถอย' },
  { keys: '↑  /  W  /  Space', label: 'กระโดดข้ามสิ่งกีดขวางและหลุมลาวา' },
  { keys: '↓  /  S', label: 'หมอบหลบของที่บินต่ำ' },
];

export function HowToPlayScreen({ busy, error, nickname, onStart, onLeaderboard }: Props) {
  const muted = useGameStore((s) => s.muted);
  const toggleMute = useGameStore((s) => s.toggleMute);
  const setScreen = useGameStore((s) => s.setScreen);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div className="animate-pop-in panel w-full max-w-2xl rounded-3xl p-4 sm:p-7 max-h-[94vh] overflow-y-auto">
        <div className="mb-3 sm:mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-dusk-100">
              พร้อมแล้วนะ {nickname} 🦕
            </h2>
            <p className="text-xs sm:text-sm text-dusk-200/75">
              กำแพงลาวาจากอุกกาบาตกำลังไล่มาจากทางซ้าย — วิ่งไปให้ไกลที่สุด
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <FullscreenButton />
            <button
              onClick={toggleMute}
              className="btn-ghost rounded-xl px-3 py-2 text-sm"
              aria-label={muted ? 'เปิดเสียง' : 'ปิดเสียง'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>
        </div>

        <div className="mb-3 sm:mb-5 space-y-2">
          {CONTROLS.map((c) => (
            <div
              key={c.keys}
              className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl bg-white/5 px-3 py-2 sm:px-4 sm:py-2.5 text-xs sm:text-sm"
            >
              <kbd className="tabular shrink-0 rounded-lg bg-night-900 px-2.5 py-0.5 sm:px-3 sm:py-1 font-mono text-xs sm:text-sm text-dusk-200">
                {c.keys}
              </kbd>
              <span className="text-white/85">{c.label}</span>
            </div>
          ))}
          <p className="px-1 text-[11px] sm:text-xs text-white/40">
            เล่นบนมือถือ: มีปุ่ม <b className="text-white/70">◀ ▶</b> อยู่มุมซ้ายล่าง และปุ่ม{' '}
            <b className="text-white/70">▲ กระโดด</b> / <b className="text-white/70">▼ หมอบ</b>{' '}
            อยู่มุมขวาล่าง กดพร้อมกันได้
          </p>
        </div>

        <div className="mb-4 sm:mb-6 grid gap-2.5 sm:gap-3 grid-cols-2 lg:grid-cols-4">
          <Rule icon="❤️" title={`มี ${BALANCE.player.hearts} หัวใจ`}>
            ชนสิ่งกีดขวางเสีย 1 ดวง หมดเมื่อไหร่ถึงคราวเสี่ยง
          </Rule>
          <Rule icon="🗺️" title={`${STAGE_COUNT} ด่าน ด่านละ ${QUESTIONS_PER_STAGE} ข้อ`}>
            ผ่านครบทุกด่านแล้วจะเจอคำถามบอสสุดท้าย
          </Rule>
          <Rule icon="💀" title="ตายแล้วฟื้นได้">
            ตอบคำถามฟื้นถูก = กลับไปที่จุดตรวจล่าสุด (ฟื้นได้ {BALANCE.player.maxRevives} ครั้ง)
          </Rule>
          <Rule icon="👑" title="ตอบบอสถูก = ชนะ">
            เอาชนะกำแพงลาวาได้ พร้อมโบนัส {BALANCE.score.victoryBonus} คะแนน
          </Rule>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-lava-500/40 bg-lava-600/15 px-4 py-2.5 text-xs sm:text-sm text-dusk-100">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
          <button
            onClick={onStart}
            disabled={busy}
            className="btn-primary flex-1 rounded-xl py-2.5 sm:py-3.5 text-base sm:text-lg font-bold"
          >
            {busy ? 'กำลังเตรียมด่าน…' : '▶  เริ่มวิ่ง'}
          </button>
          <button onClick={onLeaderboard} className="btn-ghost rounded-xl px-5 py-2.5 sm:py-3.5 text-sm sm:text-base">
            🏆 กระดานคะแนน
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="btn-ghost rounded-xl px-4 py-2.5 sm:py-3.5 text-amber-400 hover:text-amber-300 text-sm sm:text-base"
            title="หน้าจัดการสำหรับครู"
          >
            👨‍🏫 ครู
          </button>
        </div>

        <IosHomeScreenHint />
      </div>

      <TeacherPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={() => {
          setShowPasswordModal(false);
          setScreen('teacher');
        }}
      />
    </div>
  );
}

function Rule({

  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="mb-1 text-2xl">{icon}</div>
      <div className="text-sm font-semibold text-dusk-100">{title}</div>
      <div className="text-xs text-white/55">{children}</div>
    </div>
  );
}
