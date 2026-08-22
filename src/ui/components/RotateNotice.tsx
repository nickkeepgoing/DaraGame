/**
 * เกมเป็นแนวนอน — ถ้าถือมือถือแนวตั้งจะเล่นไม่ได้เรื่อง
 * บอกให้หมุนเครื่องด้วย CSS ล้วน (ไม่ต้องเช็กด้วย JS ให้เปลืองเฟรม)
 */
export function RotateNotice() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 hidden max-[900px]:portrait:flex">
      <div className="pointer-events-auto flex h-full w-full flex-col items-center justify-center gap-4 bg-night-950 p-8 text-center">
        <div className="animate-soft-pulse text-6xl">📱↻</div>
        <p className="font-display text-xl font-semibold text-dusk-100">หมุนเครื่องเป็นแนวนอนด้วยนะ</p>
        <p className="text-sm text-white/55">DaraGame ออกแบบมาให้เล่นแนวนอน จะได้เห็นกำแพงที่ไล่มาชัดๆ</p>
      </div>
    </div>
  );
}
