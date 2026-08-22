import { useEffect, useState } from 'react';
import { api, isOffline } from '@/api';
import type { QuestionStat, StudentProgress, TeacherClass } from '@/types/game';


interface Props {
  onBack: () => void;
}

export function TeacherDashboardScreen({ onBack }: Props) {
  const [tab, setTab] = useState<'classes' | 'students' | 'analytics'>('classes');

  /* States */
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [questionStats, setQuestionStats] = useState<QuestionStat[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Form state: New class modal/form */
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newJoinCode, setNewJoinCode] = useState('');
  const [newSeed, setNewSeed] = useState<string>('');
  const [creating, setCreating] = useState(false);

  /* Form state: Seed edit modal */
  const [editingClass, setEditingClass] = useState<TeacherClass | null>(null);
  const [editSeed, setEditSeed] = useState<string>('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const clsList = await api.getTeacherClasses();
      setClasses(clsList);

      const stList = await api.getStudentProgress();
      setStudents(stList);

      const qStats = await api.getQuestionStats();
      setQuestionStats(qStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  function handleGenerateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'M4-';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewJoinCode(code);
  }

  async function handleCreateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!newClassName.trim() || !newJoinCode.trim()) return;

    setCreating(true);
    setError(null);
    try {
      const seedNum = newSeed.trim() ? Number(newSeed) : null;
      const created = await api.createClass(newClassName, newJoinCode, seedNum);
      setClasses((prev) => [created, ...prev]);
      setShowCreateModal(false);
      setNewClassName('');
      setNewJoinCode('');
      setNewSeed('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleOpen(cls: TeacherClass) {
    try {
      const updated = await api.updateClass(cls.id, !cls.isOpen, cls.levelSeed);
      setClasses((prev) => prev.map((c) => (c.id === cls.id ? updated : c)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSaveSeed(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass) return;

    setUpdating(true);
    setError(null);
    try {
      const seedNum = editSeed.trim() ? Number(editSeed) : null;
      const updated = await api.updateClass(editingClass.id, editingClass.isOpen, seedNum);
      setClasses((prev) => prev.map((c) => (c.id === editingClass.id ? updated : c)));
      setEditingClass(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUpdating(false);
    }
  }

  const filteredStudents =
    selectedClassId === 'all'
      ? students
      : students.filter((s) => s.classId === selectedClassId);

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-night-950 text-white overflow-hidden">
      {/* ---------- Header Bar ---------- */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-night-900/90 px-6 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <span className="text-3xl">👨‍🏫</span>
          <div>
            <h1 className="font-display text-xl font-bold text-amber-400">
              ระบบจัดการสำหรับครูผู้สอน (Teacher Portal)
            </h1>
            <p className="text-xs text-white/50">
              สร้างห้องเรียน สุ่มรหัสเข้าห้อง ตั้ง Seed ประจำวัน และดูวิเคราะห์สถิตินักเรียน
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              isOffline
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}
          >
            {isOffline ? 'โหมดทดสอบออฟไลน์' : 'ต่อฐานข้อมูล Supabase'}
          </span>
          <button
            onClick={onBack}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/20"
          >
            กลับหน้าเกม
          </button>
        </div>
      </header>

      {/* ---------- Error Alert ---------- */}
      {error && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-xl border border-lava-500/40 bg-lava-600/20 px-4 py-3 text-sm text-dusk-100">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* ---------- Main Content Area ---------- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar / Tabs */}
        <aside className="w-64 border-r border-white/10 bg-night-900/40 p-4 space-y-2">
          <button
            onClick={() => setTab('classes')}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-all ${
              tab === 'classes'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-xl">🏫</span>
            <span>จัดการห้องเรียน</span>
          </button>

          <button
            onClick={() => setTab('students')}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-all ${
              tab === 'students'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-xl">📊</span>
            <span>สถิตินักเรียน ({students.length})</span>
          </button>

          <button
            onClick={() => setTab('analytics')}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left font-medium transition-all ${
              tab === 'analytics'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
          >
            <span className="text-xl">🧠</span>
            <span>วิเคราะห์ข้อสอบ</span>
          </button>

          <div className="pt-6">
            <div className="rounded-2xl border border-white/10 bg-night-900/80 p-4 text-xs text-white/50 space-y-2">
              <p className="font-semibold text-white/80">💡 คำแนะนำสำหรับครู:</p>
              <p>• ครูเขียน <b>รหัสห้องเรียน (Join Code)</b> ขึ้นกระดานให้เด็กกรอกเข้าเล่น</p>
              <p>• หากต้องการแข่งระดับห้อง ให้ใส่ <b>Seed เดียวกัน</b> เด็กจะเจอด่านเหมือนกันเป๊ะ</p>
            </div>
          </div>
        </aside>

        {/* Tab Body */}
        <main className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex h-64 items-center justify-center text-white/50">
              กำลังโหลดข้อมูล...
            </div>
          ) : (
            <>
              {/* TAB 1: CLASSES */}
              {tab === 'classes' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white">ห้องเรียนทั้งหมด</h2>
                      <p className="text-sm text-white/60">
                        สร้างและควบคุมการเปิด/ปิดรับนักเรียน รวมถึงตั้งค่า Seed ประจำวัน
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        handleGenerateCode();
                        setShowCreateModal(true);
                      }}
                      className="btn-primary rounded-xl px-5 py-2.5 font-bold shadow-lg"
                    >
                      + สร้างห้องเรียนใหม่
                    </button>
                  </div>

                  {classes.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/20 p-12 text-center text-white/40">
                      ยังไม่มีห้องเรียน กดปุ่ม "+ สร้างห้องเรียนใหม่" เพื่อเริ่มต้น
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {classes.map((cls) => (
                        <div
                          key={cls.id}
                          className="panel relative flex flex-col justify-between rounded-2xl border border-white/15 bg-night-900/70 p-5 backdrop-blur-md shadow-xl transition-all hover:border-amber-400/40"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <h3 className="text-lg font-bold text-white">{cls.name}</h3>
                              <button
                                onClick={() => handleToggleOpen(cls)}
                                className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                  cls.isOpen
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                              >
                                {cls.isOpen ? '🟢 เปิดรับเข้าห้อง' : '🔴 ปิดรับเข้าห้อง'}
                              </button>
                            </div>

                            {/* JOIN CODE DISPLAY FOR BOARD */}
                            <div className="my-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center">
                              <span className="block text-xs uppercase tracking-wider text-amber-300/80 mb-1">
                                รหัสเข้าห้องเรียน (Join Code)
                              </span>
                              <span className="font-mono text-3xl font-extrabold tracking-widest text-amber-300">
                                {cls.joinCode}
                              </span>
                            </div>

                            <div className="space-y-2 text-sm text-white/70 mb-4">
                              <div className="flex justify-between">
                                <span>จำนวนนักเรียน:</span>
                                <span className="font-semibold text-white">
                                  {cls.studentCount ?? 0} คน
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Seed ของด่าน:</span>
                                <span className="font-mono text-amber-300">
                                  {cls.levelSeed !== null ? cls.levelSeed : 'สุ่มอัตโนมัติ (ไม่ fix)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                            <button
                              onClick={() => {
                                setEditingClass(cls);
                                setEditSeed(cls.levelSeed !== null ? String(cls.levelSeed) : '');
                              }}
                              className="text-xs text-amber-400 hover:underline font-medium"
                            >
                              ⚙️ ตั้งค่า Seed ด่านประจำวัน
                            </button>
                            <button
                              onClick={() => {
                                setSelectedClassId(cls.id);
                                setTab('students');
                              }}
                              className="text-xs text-white/70 hover:text-white underline font-medium"
                            >
                              ดูรายชื่อเด็ก ➔
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STUDENTS */}
              {tab === 'students' && (
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-white">สถิติและคะแนนนักเรียน</h2>
                      <p className="text-sm text-white/60">
                        ดูความก้าวหน้า รายชื่อนักเรียน และผลการเล่นแต่ละคน
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/60">เลือกห้องเรียน:</span>
                      <select
                        value={selectedClassId}
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="rounded-xl border border-white/20 bg-night-900 px-4 py-2 text-sm text-white outline-none focus:border-amber-400"
                      >
                        <option value="all">ทุกห้องเรียน ({students.length} คน)</option>
                        {classes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.joinCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/15 bg-night-900/70 backdrop-blur-md shadow-xl">
                    <table className="w-full text-left text-sm text-white">
                      <thead className="border-b border-white/10 bg-night-800/80 text-xs uppercase tracking-wider text-amber-300">
                        <tr>
                          <th className="px-6 py-4">#</th>
                          <th className="px-6 py-4">ชื่อเล่นนักเรียน</th>
                          <th className="px-6 py-4 text-center">เล่นไปแล้ว (รอบ)</th>
                          <th className="px-6 py-4 text-center">คะแนนสูงสุด</th>
                          <th className="px-6 py-4 text-center">ตอบถูก (%)</th>
                          <th className="px-6 py-4 text-center">ระยะทางไกลสุด (ม.)</th>
                          <th className="px-6 py-4 text-right">เล่นล่าสุด</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredStudents.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-white/40">
                              ไม่พบบันทึกข้อมูลนักเรียนในห้องนี้
                            </td>
                          </tr>
                        ) : (
                          filteredStudents.map((st, idx) => (
                            <tr key={st.playerId} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-4 font-mono text-white/40">{idx + 1}</td>
                              <td className="px-6 py-4 font-bold text-dusk-100 flex items-center gap-2">
                                <span>🦖</span> {st.nickname}
                              </td>
                              <td className="px-6 py-4 text-center font-mono text-white/80">
                                {st.runsPlayed}
                              </td>
                              <td className="px-6 py-4 text-center font-bold font-mono text-amber-300">
                                {st.bestScore.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold font-mono ${
                                    (st.pctCorrect ?? 0) >= 80
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : (st.pctCorrect ?? 0) >= 50
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300'
                                  }`}
                                >
                                  {st.pctCorrect !== null ? `${st.pctCorrect}%` : '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center font-mono text-white/80">
                                {st.bestDistanceM} ม.
                              </td>
                              <td className="px-6 py-4 text-right text-xs text-white/50">
                                {st.lastPlayedAt
                                  ? new Date(st.lastPlayedAt).toLocaleTimeString('th-TH', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: QUESTION ANALYTICS */}
              {tab === 'analytics' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-white">วิเคราะห์ผลสัมฤทธิ์ข้อสอบ</h2>
                    <p className="text-sm text-white/60">
                      แสดงรายการข้อสอบที่นักเรียนตอบ ข้อที่ % ตอบถูกต้องน้อย ครูสามารถนำมาทบทวนเพิ่มเติมในชั้นเรียนได้
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/15 bg-night-900/70 backdrop-blur-md shadow-xl">
                    <table className="w-full text-left text-sm text-white">
                      <thead className="border-b border-white/10 bg-night-800/80 text-xs uppercase tracking-wider text-amber-300">
                        <tr>
                          <th className="px-6 py-4">โจทย์คำถาม</th>
                          <th className="px-6 py-4">หมวดวิชา</th>
                          <th className="px-6 py-4 text-center">ระดับความยาก</th>
                          <th className="px-6 py-4 text-center">ตอบทั้งหมด (ครั้ง)</th>
                          <th className="px-6 py-4 text-center">ตอบถูก (%)</th>
                          <th className="px-6 py-4 text-right">เวลาตอบเฉลี่ย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {questionStats.map((q) => {
                          const isHardForStudents = (q.pctCorrect ?? 100) < 50;
                          return (
                            <tr
                              key={q.id}
                              className={`transition-colors ${
                                isHardForStudents ? 'bg-rose-500/10 hover:bg-rose-500/15' : 'hover:bg-white/5'
                              }`}
                            >
                              <td className="px-6 py-4 font-medium text-white max-w-md">
                                {isHardForStudents && (
                                  <span className="mr-2 inline-block rounded bg-rose-500/30 px-1.5 py-0.5 text-xs font-bold text-rose-300">
                                    ⚠️ เด็กตอบผิดเยอะ
                                  </span>
                                )}
                                {q.stem}
                              </td>
                              <td className="px-6 py-4 text-white/70 text-xs">{q.topic}</td>
                              <td className="px-6 py-4 text-center">
                                <span className="rounded px-2 py-0.5 text-xs uppercase font-mono font-semibold bg-white/10 text-white/80">
                                  {q.difficulty}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-center font-mono text-white/80">
                                {q.attempts}
                              </td>
                              <td className="px-6 py-4 text-center">
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold font-mono ${
                                    (q.pctCorrect ?? 0) >= 75
                                      ? 'bg-emerald-500/20 text-emerald-300'
                                      : (q.pctCorrect ?? 0) >= 50
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-rose-500/20 text-rose-300 font-bold'
                                  }`}
                                >
                                  {q.pctCorrect !== null ? `${q.pctCorrect}%` : '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-xs text-white/60">
                                {q.avgMs !== null ? `${(q.avgMs / 1000).toFixed(1)} วิ` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ---------- MODAL: CREATE CLASS ---------- */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-lg rounded-3xl p-7 border border-white/20 bg-night-900 shadow-2xl animate-pop-in">
            <h3 className="text-2xl font-bold text-amber-400 mb-2">สร้างห้องเรียนใหม่</h3>
            <p className="text-sm text-white/60 mb-6">
              ตั้งชื่อห้องเรียนและรับรหัส Join Code สำหรับให้นักเรียนเข้าร่วม
            </p>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-dusk-100">ชื่อห้องเรียน</span>
                <input
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="เช่น ม.4/1 ดาราศาสตร์และอวกาศ"
                  className="w-full rounded-xl border border-white/20 bg-night-950 px-4 py-3 text-white outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-dusk-100">รหัสเข้าห้อง (Join Code)</span>
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="text-xs text-amber-400 hover:underline"
                  >
                    🎲 สุ่มรหัสใหม่
                  </button>
                </div>
                <input
                  required
                  value={newJoinCode}
                  onChange={(e) => setNewJoinCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  placeholder="เช่น M4-1-ASTRO"
                  className="w-full rounded-xl border border-white/20 bg-night-950 px-4 py-3 font-mono tracking-widest text-amber-300 uppercase outline-none focus:border-amber-400"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-dusk-100">
                  Level Seed (Optional - ตั้งไว้เพื่อแข่งด่านเดียวกันทั้งห้อง)
                </span>
                <input
                  type="number"
                  value={newSeed}
                  onChange={(e) => setNewSeed(e.target.value)}
                  placeholder="เช่น 123456 (เว้นว่างได้)"
                  className="w-full rounded-xl border border-white/20 bg-night-950 px-4 py-3 text-white outline-none focus:border-amber-400"
                />
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="btn-primary rounded-xl px-6 py-2.5 font-bold"
                >
                  {creating ? 'กำลังสร้าง…' : 'ยืนยันสร้างห้อง'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- MODAL: EDIT SEED ---------- */}
      {editingClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="panel w-full max-w-md rounded-3xl p-7 border border-white/20 bg-night-900 shadow-2xl animate-pop-in">
            <h3 className="text-xl font-bold text-amber-400 mb-2">
              ตั้งค่า Seed ด่าน: {editingClass.name}
            </h3>
            <p className="text-xs text-white/60 mb-6">
              การกำหนด Seed จะทำให้นักเรียนทุกคนในห้องเจอตำแหน่งอุปสรรคและคำถามในด่านสลับเหมือนกันเป๊ะ
            </p>

            <form onSubmit={handleSaveSeed} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-dusk-100">Level Seed</span>
                <input
                  type="number"
                  value={editSeed}
                  onChange={(e) => setEditSeed(e.target.value)}
                  placeholder="เช่น 999888 (เว้นว่างเพื่อให้ด่านสุ่มใหม่ทุกรอบ)"
                  className="w-full rounded-xl border border-white/20 bg-night-950 px-4 py-3 text-white outline-none focus:border-amber-400"
                />
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingClass(null)}
                  className="rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/20"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="btn-primary rounded-xl px-6 py-2.5 font-bold"
                >
                  {updating ? 'กำลังบันทึก…' : 'บันทึก Seed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
