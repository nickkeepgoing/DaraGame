/**
 * สถานะปุ่มบนหน้าจอ (มือถือ/แท็บเล็ต)
 *
 * React เขียน → Phaser อ่านทุกเฟรม
 * ใช้ object ธรรมดาแทนการยิง event เพราะปุ่มค้างไว้ = ต้องอ่านสถานะทุกเฟรมอยู่แล้ว
 * ถ้ายิง event จะได้ event ท่วมจอโดยไม่จำเป็น
 */
export const touchInput = {
  left: false,
  right: false,
  jump: false,
  duck: false,
};

export function resetTouchInput(): void {
  touchInput.left = false;
  touchInput.right = false;
  touchInput.jump = false;
  touchInput.duck = false;
}
