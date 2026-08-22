import { useEffect, useState } from 'react';
import { canFullscreen, isIOS, isTouchDevice, toggleFullscreen } from '@/lib/mobile';
import { unlock } from '@/audio/sfx';

interface Props {
  onReady: () => void;
  onBack: () => void;
}

/**
 * ประตูก่อนเข้าเกม: "หมุนเครื่องเป็นแนวนอนก่อนนะ"
 *
 * หน้า login/เมนู เล่นแนวตั้งได้ปกติ แต่ตัวเกมต้องแนวนอนเท่านั้น
 * (ต้องเห็นกำแพงที่ไล่มาจากซ้ายและทางข้างหน้าพร้อมกัน)
 *
 * หน้านี้ยังทำหน้าที่สำคัญอีกอย่าง: เป็น "การแตะของผู้ใช้" ครั้งสุดท้ายก่อนเข้าเกม
 * จึงเป็นจังหวะที่ถูกต้องในการขอ fullscreen และปลดล็อกเสียง — ทั้งสองอย่าง
 * เบราว์เซอร์ยอมให้ทำได้เฉพาะใน event ที่ผู้ใช้แตะเองเท่านั้น
 */
export function RotateGateScreen({ onReady, onBack }: Props) {
  const [portrait, setPortrait] = useState(false);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    setTouch(isTouchDevice());

    const mq = window.matchMedia('(orientation: portrait)');
    const sync = () => setPortrait(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, []);

  const blocked = touch && portrait;

  function start() {
    unlock(); // ปลดล็อกเสียง (จำเป็นบน iOS)
    if (touch && canFullscreen() && !isIOS()) void toggleFullscreen();
    onReady();
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto p-5">
      <div className="animate-pop-in panel w-full max-w-md rounded-3xl p-7 text-center">
        <div
          className={`mb-4 text-6xl ${blocked ? 'animate-soft-pulse' : ''}`}
          style={
            blocked
              ? undefined
              : { display: 'inline-block', transform: 'rotate(90deg)', transition: 'transform .4s' }
          }
        >
          📱
        </div>

        {blocked ? (
          <>
            <h2 className="font-display mb-2 text-2xl font-bold text-dusk-100">
              หมุนเครื่องเป็นแนวนอนก่อนนะ
            </h2>
            <p className="mb-6 text-sm leading-relaxed text-white/60">
              DaraGame ต้องเล่นแนวนอน จะได้เห็นกำแพงลาวาที่ไล่มาจากทางซ้าย
              และเห็นทางข้างหน้าพร้อมกัน
            </p>
            <div className="mb-6 rounded-2xl bg-white/5 px-4 py-3 text-xs leading-relaxed text-white/50">
              ถ้าหมุนแล้วจอยังไม่เปลี่ยน ลองปิด “ล็อกการหมุนหน้าจอ”
              ในศูนย์ควบคุมของเครื่องก่อน
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display mb-2 text-2xl font-bold text-leaf-400">พร้อมแล้ว! 🦖</h2>
            <p className="mb-6 text-sm leading-relaxed text-white/60">
              {touch
                ? 'แตะปุ่มด้านล่างเพื่อเข้าโหมดเต็มจอแล้วเริ่มวิ่งได้เลย'
                : 'กดเริ่มได้เลย — ใช้ปุ่มลูกศรกับ Space ในการบังคับ'}
            </p>
          </>
        )}

        <button
          onClick={start}
          disabled={blocked}
          className="btn-primary w-full rounded-xl py-4 text-lg"
        >
          {blocked ? 'รอหมุนเครื่อง…' : '▶  เริ่มวิ่ง!'}
        </button>

        <button onClick={onBack} className="btn-ghost mt-3 w-full rounded-xl py-2.5 text-sm">
          ← กลับ
        </button>
      </div>
    </div>
  );
}
