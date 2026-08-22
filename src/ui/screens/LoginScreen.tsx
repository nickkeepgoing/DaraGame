import { useState, type FormEvent } from 'react';
import { api, isOffline } from '@/api';
import { useGameStore } from '@/store/gameStore';
import { unlock } from '@/audio/sfx';

interface Props {
  onDone: () => void;
}

/**
 * เข้าเล่นด้วย "ชื่อเล่น + รหัสห้อง" — ไม่มี password
 *
 * เบื้องหลังคือ supabase.auth.signInAnonymously() ทำให้ได้ JWT จริงไว้ใช้กับ RLS
 * และชื่อเล่นถูกจองด้วยตัวตนของเครื่องนั้น คนอื่นสวมชื่อไม่ได้
 * (เหตุผลเต็มอยู่ใน docs/03-decisions.md Q2)
 */
export function LoginScreen({ onDone }: Props) {
  const setSession = useGameStore((s) => s.setSession);
  const setScreen = useGameStore((s) => s.setScreen);
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = nickname.trim().length >= 2 && (isOffline || joinCode.trim().length >= 4);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    unlock(); // ปลดล็อกเสียงตั้งแต่การแตะครั้งแรกของผู้ใช้ (จำเป็นบน iOS Safari)
    setBusy(true);
    setError(null);
    try {
      const session = await api.login(nickname.trim(), joinCode.trim().toUpperCase());
      setSession(session);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="animate-pop-in panel w-full max-w-md rounded-3xl p-7">
        <div className="mb-1 text-center text-5xl">🦕☄️</div>
        <h1 className="font-display mb-1 text-center text-3xl font-bold text-dusk-100">
          DaraGame
        </h1>
        <p className="mb-6 text-center text-sm text-dusk-200/80">
          วิ่งหนีอุกกาบาตวันสิ้นโลก แล้วตอบคำถามดาราศาสตร์เก็บคะแนน
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dusk-100">ชื่อเล่น</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              autoComplete="off"
              placeholder="เช่น น้องไดโน"
              className="w-full rounded-xl border border-white/15 bg-night-900/70 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-dusk-300"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-dusk-100">
              รหัสห้องเรียน
              {isOffline && <span className="ml-1 text-white/40">(ไม่บังคับ)</span>}
            </span>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={20}
              autoComplete="off"
              placeholder="เช่น M4-1-ASTRO"
              className="tabular w-full rounded-xl border border-white/15 bg-night-900/70 px-4 py-3 tracking-wider text-white outline-none placeholder:text-white/30 placeholder:tracking-normal focus:border-dusk-300"
            />
            <span className="mt-1.5 block text-xs text-white/40">
              {isOffline ? 'ใส่ชื่อกลุ่มไว้ดูเล่นก็ได้' : 'ครูจะเขียนรหัสห้องไว้ให้บนกระดาน'}
            </span>
          </label>

          {error && (
            <p className="rounded-xl border border-lava-500/40 bg-lava-600/15 px-4 py-2.5 text-sm text-dusk-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="btn-primary w-full rounded-xl py-3.5 text-lg"
          >
            {busy ? 'กำลังเข้าห้อง…' : 'เริ่มเล่น'}
          </button>
        </form>

        <div className="mt-6 border-t border-white/10 pt-4 text-center">
          <button
            type="button"
            onClick={() => setScreen('teacher')}
            className="inline-flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>👨‍🏫 เข้าใช้งานระบบจัดการสำหรับครูผู้สอน (Teacher Portal)</span>
          </button>
        </div>

        <p className="mt-3 text-center text-xs text-white/35">
          เก็บแค่ชื่อเล่นเท่านั้น ไม่เก็บชื่อจริงหรือข้อมูลส่วนตัวใดๆ
        </p>
      </div>
    </div>
  );
}

