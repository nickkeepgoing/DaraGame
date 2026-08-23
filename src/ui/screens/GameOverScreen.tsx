import type { ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';

interface Props {
  onPlayAgain: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
}

export function GameOverScreen({ onPlayAgain, onLeaderboard, onMenu }: Props) {
  const result = useGameStore((s) => s.result);
  const answerLog = useGameStore((s) => s.answerLog);
  const missed = answerLog.filter((a) => !a.isCorrect);
  const won = result?.victory === true;

  return (
    <div className="safe-inset absolute inset-0 z-30 flex items-center justify-center bg-night-950/85 backdrop-blur-sm">
      <div
        className={`animate-pop-in panel flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl ${
          won ? 'ring-2 ring-leaf-500/60' : ''
        }`}
      >
        {/* ส่วนเนื้อหาเลื่อนได้ — สรุปคะแนนกับข้อที่พลาดอาจยาวเกินจอมือถือ */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-7">
        <div className="mb-1 text-center text-5xl">{won ? '👑' : '☄️'}</div>
        <h2
          className={`font-display mb-1 text-center text-3xl font-bold ${
            won ? 'text-leaf-400' : 'text-dusk-100'
          }`}
        >
          {won ? 'ชนะแล้ว!' : 'จบรอบแล้ว!'}
        </h2>
        <p className="mb-6 text-center text-sm text-white/55">
          {won
            ? 'ตอบคำถามสุดท้ายถูก หนีกำแพงลาวาได้สำเร็จ 🦖'
            : 'กำแพงลาวาไล่ทันแล้ว — ลองใหม่อีกรอบนะ'}
        </p>

        {result ? (
          <>
            <div className="mb-6 text-center">
              <div className="text-sm text-white/50">คะแนนรวม</div>
              <div className="font-display tabular text-6xl leading-tight font-bold text-dusk-100">
                {result.totalScore.toLocaleString('th-TH')}
              </div>
              {result.status === 'flagged' && (
                <p className="mx-auto mt-3 max-w-md rounded-xl border border-dusk-300/40 bg-dusk-400/10 px-4 py-2 text-xs text-dusk-100">
                  รอบนี้ถูกทำเครื่องหมายไว้ให้ครูตรวจสอบ เพราะตัวเลขดูผิดปกติ
                  ยังไม่ถูกตัดสินว่าโกงนะ
                </p>
              )}
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="คะแนนคำถาม" value={result.quizScore} accent />
              <Tile label="คะแนนระยะทาง" value={result.distanceScore} />
              <Tile label={won ? 'โบนัสหัวใจ + ชนะ' : 'โบนัสหัวใจ'} value={result.bonusScore} />
              <Tile label="ระยะทาง" value={`${result.distanceM} ม.`} />
            </div>

            <div className="mb-6 flex flex-wrap justify-center gap-2 text-sm">
              <Chip>✓ ตอบถูก {result.correctCount} ข้อ</Chip>
              <Chip>✗ ตอบผิด {result.wrongCount} ข้อ</Chip>
              {result.maxCombo >= 2 && <Chip>🔥 คอมโบสูงสุด {result.maxCombo}</Chip>}
              <Chip>❤️ เหลือ {result.heartsLeft} ดวง</Chip>
            </div>
          </>
        ) : (
          <p className="mb-6 text-center text-dusk-200">กำลังบันทึกคะแนน…</p>
        )}

        {/* จุดที่ทำให้เป็น "เกมการศึกษา" ไม่ใช่แค่เกมที่มีคำถามแปะ */}
        {missed.length > 0 && (
          <div className="mb-6">
            <h3 className="font-display mb-2.5 text-lg font-semibold text-dusk-100">
              📖 ทบทวนข้อที่พลาด
            </h3>
            <div className="space-y-2.5">
              {missed.map((a, i) => (
                <div key={i} className="rounded-2xl bg-white/5 p-4">
                  <p className="mb-1.5 text-sm font-medium text-white">{a.stem}</p>
                  <p className="mb-1 text-sm text-leaf-400">คำตอบที่ถูก: {a.correct}</p>
                  {a.chosen && <p className="mb-1.5 text-xs text-white/40">คุณตอบ: {a.chosen}</p>}
                  <p className="text-xs leading-relaxed text-white/65">{a.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        </div>

        {/* แถบปุ่มติดล่างเสมอ
            เดิมปุ่มพวกนี้อยู่ท้ายเนื้อหา พอจอมือถือเตี้ยมันเลยหลุดออกนอกจอ
            ผู้เล่นจบเกมแล้วกด "เล่นอีกรอบ" ไม่ได้เลยถ้าไม่รู้ว่าต้องเลื่อน */}
        <div className="flex shrink-0 gap-2 border-t border-white/10 bg-night-900/60 p-3">
          <button
            onClick={onPlayAgain}
            className="btn-primary flex-1 rounded-xl py-3 text-base font-bold"
          >
            ↻ เล่นอีกรอบ
          </button>
          <button
            onClick={onLeaderboard}
            className="btn-ghost flex min-w-[52px] items-center justify-center rounded-xl px-3 text-lg"
            aria-label="กระดานคะแนน"
          >
            🏆
          </button>
          <button
            onClick={onMenu}
            className="btn-ghost flex min-w-[52px] items-center justify-center rounded-xl px-3 text-lg"
            aria-label="เมนูหลัก"
          >
            🏠
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 text-center">
      <div className="text-[11px] text-white/45">{label}</div>
      <div
        className={`tabular text-xl font-semibold ${accent ? 'text-leaf-400' : 'text-dusk-100'}`}
      >
        {value}
      </div>
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/8 px-3 py-1 text-white/75">{children}</span>;
}
