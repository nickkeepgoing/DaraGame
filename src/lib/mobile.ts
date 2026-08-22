/**
 * ตัวช่วยสำหรับการเล่นบนมือถือ (iOS Safari + Android Chrome)
 *
 * เกมนี้เล่นบนมือถือเป็นหลัก — ทุกฟังก์ชันในไฟล์นี้จึงต้อง "พังอย่างสุภาพ"
 * บนเบราว์เซอร์ที่ไม่รองรับ ห้าม throw ให้เกมล่ม
 */

export const isIOS = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ รายงานตัวเป็น Mac — แยกด้วยการมีทัชสกรีน
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: none) and (pointer: coarse)').matches;

/**
 * Fullscreen API
 *
 * ⚠️ iPhone Safari ไม่รองรับ requestFullscreen เลย (iPad รองรับ)
 *    ทางเดียวที่จะซ่อนแถบ Safari บน iPhone คือให้ผู้เล่น "เพิ่มไปยังหน้าจอโฮม"
 *    ซึ่งจะทำงานร่วมกับ meta apple-mobile-web-app-capable ใน index.html
 */
export const canFullscreen = (): boolean =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled ||
    Boolean((document as unknown as { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled));

export function isFullscreen(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.fullscreenElement ??
      (document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement,
  );
}

export async function toggleFullscreen(): Promise<void> {
  try {
    if (isFullscreen()) {
      await document.exitFullscreen?.();
      return;
    }
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();

    // Android รองรับล็อกแนวจอหลังเข้า fullscreen เท่านั้น
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation?.lock?.('landscape').catch(() => undefined);
  } catch {
    // ผู้ใช้ปฏิเสธ หรือเบราว์เซอร์ไม่รองรับ — ไม่ใช่เรื่องคอขาดบาดตาย
  }
}

/**
 * กันหน้าจอดับระหว่างเล่น
 *
 * มือถือจะหรี่จอเมื่อไม่มีการแตะสัก 30 วินาที ซึ่งเกิดขึ้นได้จริงตอนผู้เล่น
 * แค่กดค้างวิ่งอย่างเดียวโดยไม่ยกนิ้ว
 * (Safari รองรับตั้งแต่ iOS 16.4, Chrome Android รองรับ)
 */
let wakeLock: WakeLockSentinel | null = null;

export async function requestWakeLock(): Promise<void> {
  try {
    if (!('wakeLock' in navigator)) return;
    wakeLock = await navigator.wakeLock.request('screen');
  } catch {
    /* ไม่รองรับ หรือถูกปฏิเสธ */
  }
}

export function releaseWakeLock(): void {
  void wakeLock?.release().catch(() => undefined);
  wakeLock = null;
}

/** ระบบจะปล่อย wake lock เองเมื่อสลับแท็บ — ต้องขอใหม่ตอนกลับมา */
export function watchWakeLock(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && wakeLock === null) void requestWakeLock();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => document.removeEventListener('visibilitychange', onVisible);
}
