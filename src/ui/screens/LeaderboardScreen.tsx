import { useEffect, useState, type ReactNode } from 'react';
import { api, isOffline } from '@/api';
import { useGameStore } from '@/store/gameStore';
import type { LeaderboardRow } from '@/types/game';

interface Props {
  onBack: () => void;
}

type Scope = 'all' | 'class';

export function LeaderboardScreen({ onBack }: Props) {
  const session = useGameStore((s) => s.session);
  const [scope, setScope] = useState<Scope>(session?.classId ? 'class' : 'all');
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);

    void api
      .leaderboard(20, scope === 'class' ? session?.classId : null)
      .then((data) => !cancelled && setRows(data))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));

    return () => {
      cancelled = true;
    };
  }, [scope, session?.classId]);

  return (
    <div className="absolute inset-0 z-30 flex items-start justify-center overflow-y-auto bg-night-950/85 p-4">
      <div className="animate-pop-in panel my-auto w-full max-w-2xl rounded-3xl p-6 sm:p-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-dusk-100">🏆 กระดานคะแนน</h2>
          <button onClick={onBack} className="btn-ghost rounded-xl px-4 py-2 text-sm">
            ← กลับ
          </button>
        </div>

        {!isOffline && session?.classId && (
          <div className="mb-4 flex gap-2">
            <Tab active={scope === 'class'} onClick={() => setScope('class')}>
              ห้องของฉัน{session.className ? ` · ${session.className}` : ''}
            </Tab>
            <Tab active={scope === 'all'} onClick={() => setScope('all')}>
              ทั้งหมด
            </Tab>
          </div>
        )}

        {error && (
          <p className="rounded-xl border border-lava-500/40 bg-lava-600/15 px-4 py-3 text-sm text-dusk-100">
            {error}
          </p>
        )}

        {!rows && !error && <p className="py-10 text-center text-dusk-200">กำลังโหลด…</p>}

        {rows?.length === 0 && (
          <p className="py-10 text-center text-white/50">
            ยังไม่มีใครทำคะแนนไว้เลย — เป็นคนแรกสิ! 🦕
          </p>
        )}

        {rows && rows.length > 0 && (
          <ol className="space-y-1.5">
            {rows.map((row) => {
              const isMe = row.playerId === session?.playerId;
              return (
                <li
                  key={row.playerId}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 ${
                    isMe ? 'bg-dusk-300/20 ring-1 ring-dusk-300/50' : 'bg-white/5'
                  }`}
                >
                  <span className="tabular w-9 shrink-0 text-center text-lg font-bold text-dusk-200">
                    {row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">
                      {row.nickname}
                      {isMe && <span className="ml-2 text-xs text-dusk-200">(คุณ)</span>}
                    </span>
                    <span className="block text-xs text-white/40">
                      {row.distanceM} ม. · ตอบถูก {row.correctCount} ข้อ
                      {row.className && scope === 'all' ? ` · ${row.className}` : ''}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-lg font-semibold text-leaf-400">
                    {row.totalScore.toLocaleString('th-TH')}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-4 py-2 text-sm transition-colors ${
        active ? 'bg-dusk-300/25 text-dusk-100' : 'bg-white/5 text-white/55 hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
