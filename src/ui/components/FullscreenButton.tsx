import { useEffect, useState } from 'react';
import { canFullscreen, isFullscreen, isIOS, toggleFullscreen } from '@/lib/mobile';

/**
 * ปุ่มเต็มจอ
 *
 * Android Chrome: เข้า fullscreen ได้ + ล็อกแนวนอนได้ → ซ่อนแถบเบราว์เซอร์สนิท
 * iPhone Safari : ไม่รองรับ Fullscreen API เลย → ซ่อนปุ่ม แล้วบอกวิธี
 *                 "เพิ่มไปยังหน้าจอโฮม" แทน (ได้ผลเหมือนกันและถาวรกว่า)
 */
export function FullscreenButton() {
  const [full, setFull] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(canFullscreen() && !isIOS());
    const sync = () => setFull(isFullscreen());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  if (!supported) return null;

  return (
    <button
      onClick={() => void toggleFullscreen()}
      className="btn-ghost shrink-0 rounded-xl px-3 py-2 text-sm"
      aria-label={full ? 'ออกจากโหมดเต็มจอ' : 'เล่นเต็มจอ'}
    >
      {full ? '🗗' : '⛶'}
    </button>
  );
}

/** คำแนะนำสำหรับ iPhone ที่ซ่อนแถบ Safari ด้วยวิธีอื่นไม่ได้ */
export function IosHomeScreenHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setShow(isIOS() && !standalone);
  }, []);

  if (!show) return null;

  return (
    <p className="mt-3 rounded-xl bg-white/5 px-4 py-2.5 text-center text-xs leading-relaxed text-white/55">
      เล่นบน iPhone ให้เต็มจอ: กดปุ่ม <span className="text-white/80">แชร์</span>{' '}
      (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) ในแถบล่างของ Safari → “เพิ่มไปยังหน้าจอโฮม”
      แล้วเปิดเกมจากไอคอนนั้น จะไม่มีแถบเบราว์เซอร์มาบังจออีก
    </p>
  );
}
