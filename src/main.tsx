import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

/**
 * ⚠️ ตั้งใจไม่ใช้ <React.StrictMode>
 *
 * StrictMode ตอน dev จะ mount → unmount → mount ซ้ำทันทีเพื่อจับ cleanup ที่หายไป
 * แต่ Phaser ประมวลผล game.destroy() ที่ "ปลายเฟรมถัดไปของ game loop ตัวเอง"
 * ถ้าสั่ง destroy ตอนที่ loop ยังไม่เริ่มหมุน คำสั่งนั้นจะค้างเป็น pending ตลอดกาล
 * ผลคือมี Phaser.Game ค้างอยู่สองตัว วน loop ซ้อนกัน มี <canvas> สองใบ
 * แล้วเฟรมเรตตกครึ่งหนึ่งตั้งแต่ dev โดยไม่มีอะไรฟ้อง
 *
 * แลกกับการเสียเครื่องมือจับ cleanup ที่ขาดไป จึงต้องระวังเองแทน:
 * ทุก useEffect ที่ subscribe ต้อง return unsubscribe เสมอ
 * (ใช้ onBus() จาก EventBus.ts ซึ่งบังคับให้คืนฟังก์ชัน unsubscribe อยู่แล้ว)
 */
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
