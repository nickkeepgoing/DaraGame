import { useState, type FormEvent } from 'react';
import { api } from '@/api';
import { useGameStore } from '@/store/gameStore';
import { unlock } from '@/audio/sfx';
import { TeacherPasswordModal } from '@/ui/components/TeacherPasswordModal';

interface Props {
  onDone: () => void;
}

export function LoginScreen({ onDone }: Props) {
  const setSession = useGameStore((s) => s.setSession);
  const setScreen = useGameStore((s) => s.setScreen);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // ไม่มีช่องรหัสห้องบนจอ — นักเรียนกรอกแค่ชื่อเล่น แล้วเข้า "ห้องรวม" อัตโนมัติ
  // (ดู join_class ใน db/03_rpc.sql: รหัสว่าง = ห้อง PUBLIC)
  //
  // ถ้าวันหนึ่งอยากแยกกระดานคะแนนรายห้อง ครูแจกเป็น "ลิงก์" แทนรหัส:
  //   https://เกม.vercel.app/?room=M4-1-EARTH
  // นักเรียนไม่ต้องพิมพ์อะไรเพิ่ม และหน้าจอไม่มีช่องให้งง
  const roomFromUrl =
    new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';

  const canSubmit = nickname.trim().length >= 2;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || busy) return;

    unlock(); // ปลดล็อกเสียงตั้งแต่การแตะครั้งแรกของผู้ใช้ (จำเป็นบน iOS Safari)
    setBusy(true);
    setError(null);
    try {
      const session = await api.login(nickname.trim(), roomFromUrl);
      setSession(session);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-3 sm:p-4">
      <div className="animate-pop-in panel w-full max-w-md rounded-3xl p-5 sm:p-7 max-h-[94vh] overflow-y-auto">
        <div className="mb-1 text-center text-3xl sm:text-5xl">🦕☄️</div>
        <h1 className="font-display mb-1 text-center text-2xl sm:text-3xl font-bold text-dusk-100">
          DaraGame
        </h1>
        <p className="mb-4 sm:mb-6 text-center text-xs sm:text-sm text-dusk-200/80">
          วิ่งหนีอุกกาบาตวันสิ้นโลก แล้วตอบคำถามดาราศาสตร์เก็บคะแนน
        </p>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs sm:text-sm font-medium text-dusk-100">ชื่อเล่น</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={16}
              autoComplete="off"
              placeholder="เช่น น้องไดโน"
              className="w-full rounded-xl border border-white/15 bg-night-900/70 px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base text-white outline-none placeholder:text-white/30 focus:border-dusk-300"
            />
          </label>

          {roomFromUrl && (
            <p className="rounded-xl bg-white/5 px-3 py-2 text-center text-[11px] sm:text-xs text-dusk-200">
              🏫 กำลังเข้าห้องเรียน <b className="tabular tracking-wider">{roomFromUrl}</b>{' '}
              (จากลิงก์ที่ครูแจก)
            </p>
          )}

          {error && (
            <p className="rounded-xl border border-lava-500/40 bg-lava-600/15 px-3 py-2 text-xs sm:text-sm text-dusk-100">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || busy}
            className="btn-primary w-full rounded-xl py-2.5 sm:py-3.5 text-base sm:text-lg font-bold"
          >
            {busy ? 'กำลังเข้าห้อง…' : 'เริ่มเล่น'}
          </button>
        </form>

        <div className="mt-4 sm:mt-6 border-t border-white/10 pt-3 sm:pt-4 text-center">
          <button
            type="button"
            onClick={() => setShowPasswordModal(true)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
          >
            <span>👨‍🏫 เข้าใช้งานระบบจัดการสำหรับครูผู้สอน (Teacher Portal)</span>
          </button>
        </div>

        <p className="mt-2 sm:mt-3 text-center text-[11px] sm:text-xs text-white/35">
          เก็บแค่ชื่อเล่นเท่านั้น ไม่เก็บชื่อจริงหรือข้อมูลส่วนตัวใดๆ
        </p>
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


