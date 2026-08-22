import { useState, type FormEvent } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function getTeacherPassword(): string {
  return localStorage.getItem('daragame.teacher.password') || 'dara1234';
}

export function setTeacherPassword(pwd: string): void {
  localStorage.setItem('daragame.teacher.password', pwd);
}

export function TeacherPasswordModal({ isOpen, onClose, onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const current = getTeacherPassword();
    if (password.trim() === current) {
      setError(null);
      setPassword('');
      onSuccess();
    } else {
      setError('รหัสผ่านไม่ถูกต้อง โปรดลองอีกครั้ง');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="animate-pop-in panel w-full max-w-sm rounded-3xl p-6 border border-amber-400/30 bg-night-900 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="text-center mb-4">
          <span className="text-4xl">🔐</span>
          <h2 className="font-display text-xl font-bold text-amber-400 mt-2">
            เข้าใช้งานสำหรับครูผู้สอน
          </h2>
          <p className="text-xs text-white/60 mt-1">
            โปรดกรอกรหัสผ่านเพื่อเข้าสู่ระบบจัดการห้องเรียน
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-dusk-100">รหัสผ่าน (Password)</span>
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="กรอกรหัสผ่านครู..."
              className="w-full rounded-xl border border-white/20 bg-night-950 px-4 py-2.5 text-white outline-none focus:border-amber-400"
            />
          </label>


          {error && (
            <p className="rounded-xl border border-lava-500/40 bg-lava-600/20 px-3 py-2 text-xs text-dusk-100">
              ⚠️ {error}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPassword('');
                onClose();
              }}
              className="flex-1 rounded-xl border border-white/20 bg-white/10 py-2.5 text-sm font-medium text-white hover:bg-white/20"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="btn-primary flex-1 rounded-xl py-2.5 text-sm font-bold shadow-lg"
            >
              ยืนยัน
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
