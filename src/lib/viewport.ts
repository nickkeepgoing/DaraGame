/**
 * ความสูงจอที่เชื่อถือได้ — เขียนลง CSS variable `--app-h`
 *
 * ทำไมไม่ใช้ `100dvh` เฉยๆ:
 * เจอกับตาแล้วว่า `100dvh` ให้ค่า 720 px ทั้งที่ `window.innerHeight` เป็น 360
 * ผลคือทุกอย่างที่วางด้วย `bottom-*` หลุดไปอยู่ "ใต้จอ" — รวมถึงปุ่มกระโดด
 * ซึ่งแปลว่าเกมเล่นไม่ได้เลย และไม่มีอะไรฟ้องเพราะ layout ไม่ error
 *
 * `visualViewport.height` คือค่าที่ตรงที่สุดบนมือถือ เพราะมันหักแถบเบราว์เซอร์
 * และคีย์บอร์ดที่เด้งขึ้นมาให้แล้ว ส่วน innerHeight เป็นตัวสำรอง
 */

function apply(): void {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${Math.round(h)}px`);
}

/** เรียกครั้งเดียวตอนแอปเริ่ม — คืนฟังก์ชันยกเลิกไว้ใช้ตอน cleanup */
export function watchViewportHeight(): () => void {
  apply();

  const vv = window.visualViewport;
  vv?.addEventListener('resize', apply);
  window.addEventListener('resize', apply);
  // หมุนจอแล้วขนาดยังไม่นิ่งทันที ต้องวัดซ้ำอีกทีหลังเบราว์เซอร์จัดหน้าเสร็จ
  const onOrientation = () => {
    apply();
    window.setTimeout(apply, 250);
  };
  window.addEventListener('orientationchange', onOrientation);

  return () => {
    vv?.removeEventListener('resize', apply);
    window.removeEventListener('resize', apply);
    window.removeEventListener('orientationchange', onOrientation);
  };
}
