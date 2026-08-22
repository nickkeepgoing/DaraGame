import { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { BALANCE } from '@/config/balance';
import { GameScene, VIEW_H, VIEW_W } from './scenes/GameScene';
import { resetTouchInput } from './input';

/** เปิด hitbox ด้วย ?debug=1 */
const DEBUG_PHYSICS =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');

interface Props {
  /** seed ของด่าน — เปลี่ยนค่า = สร้างเกมใหม่ทั้งอัน (เล่นรอบใหม่) */
  seed: number;
}

/**
 * ที่ยึด canvas ของ Phaser
 *
 * สร้าง Phaser.Game ใหม่ทุกครั้งที่ seed เปลี่ยน แทนการ restart scene
 * เพราะ "สร้างใหม่หมด" ไม่มีทางมี state ค้างจากรอบก่อน ซึ่งเป็นบั๊กที่หายากที่สุด
 * ต้นทุนแค่ ~200ms ต่อการเริ่มรอบใหม่ — คุ้มมาก
 */
export function PhaserGame({ seed }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parent = hostRef.current;
    if (!parent) return;

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: VIEW_W,
      height: VIEW_H,
      backgroundColor: '#1d1129',
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      // ตั้ง fps ให้ชัดเจน — แต่ตัวจริงที่กันเกมเร็วช้าไม่เท่ากันคือการคูณ delta
      // ในทุกการเคลื่อนที่ (ดู GameScene.update)
      fps: { target: 60, min: 30 },
      render: { antialias: true, powerPreference: 'high-performance' },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: BALANCE.player.gravity },
          debug: DEBUG_PHYSICS,
        },
      },
      callbacks: {
        preBoot: (g) => g.registry.set('seed', seed),
      },
      scene: [GameScene],
    });

    // ตอน dev เปิด console แล้วเรียก __game ได้เลย เช่น
    //   __game.scene.getScene('GameScene')   ดู state ปัจจุบัน
    //   __game.step(performance.now(), 16)   เดินเกมทีละเฟรมเพื่อไล่บั๊ก
    if (import.meta.env.DEV) {
      (window as unknown as { __game?: Phaser.Game }).__game = game;
    }

    return () => {
      resetTouchInput();

      // Phaser ประมวลผล destroy() ที่ "ปลายเฟรมถัดไป" ของ game loop ของมันเอง
      // ถ้าสั่ง destroy ก่อนที่เกมจะบูตเสร็จ (เกิดขึ้นทุกครั้งกับ React StrictMode ตอน dev
      // ที่จะ mount → unmount → mount ใหม่ทันที) คำสั่งนั้นจะไม่มีวันถูกประมวลผล
      // ผลคือมี Phaser.Game ค้างอยู่อีกตัว วน game loop ซ้อนกันสองอัน มี canvas สองใบ
      // แล้วเฟรมเรตตกครึ่งหนึ่งโดยไม่มีอะไรฟ้อง
      if (game.isBooted) game.destroy(true);
      else game.events.once(Phaser.Core.Events.READY, () => game.destroy(true));
    };
  }, [seed]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
