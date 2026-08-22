# 07 — คู่มือฝั่งมือถือ (iOS + Android)

> เกมนี้ออกแบบให้ **มือถือแนวนอนเป็นหลัก** ไม่ใช่ทำเดสก์ท็อปก่อนแล้วค่อยย่อ
> เหตุผล: ถ้านักเรียนเล่นบนมือถือตัวเองไม่ได้ ก็จะไม่มีใครเล่นนอกคาบเรียน
> แล้ว leaderboard ที่ไม่มีคนแข่งก็ตาย

หน้านี้รวมทุกอย่างที่ทำไปแล้วเพื่อรองรับมือถือ และ**ข้อจำกัดที่แก้ไม่ได้**ซึ่งต้องรู้ไว้

---

## 1. สิ่งที่ทำไปแล้ว

| เรื่อง | ทำอย่างไร | ไฟล์ |
|---|---|---|
| ปรับขนาดจอ | Phaser `Scale.FIT` + `CENTER_BOTH` บนผืนผ้าใบ 1280×720 คงที่ | [`PhaserGame.tsx`](../src/game/PhaserGame.tsx) |
| ปุ่มควบคุม | ปุ่มจริงมองเห็นชัด ◀ ▶ ▲ ▼ + Pointer Events + `setPointerCapture` | [`TouchControls.tsx`](../src/ui/components/TouchControls.tsx) |
| บังคับแนวนอน | หน้า "หมุนจอ" คั่นก่อนเข้าเกม + ป้ายเตือนระหว่างเล่น | [`RotateGateScreen.tsx`](../src/ui/screens/RotateGateScreen.tsx) |
| รอยบาก iPhone | `viewport-fit=cover` + คลาส `.safe-inset` ที่ใช้ `max(0.75rem, env(...))` | [`index.css`](../src/index.css) |
| ความสูงจอ | `height: 100dvh` แทน `100vh` | [`index.css`](../src/index.css) |
| กัน pull-to-refresh | `position: fixed` + `overscroll-behavior: none` บน `body` | [`index.css`](../src/index.css) |
| กัน double-tap zoom | `touch-action: manipulation` บนปุ่ม, `touch-action: none` บน canvas | [`index.css`](../src/index.css) |
| ปลดล็อกเสียง | เรียก `unlock()` จาก user gesture แรก + resume ตอนกลับเข้าแท็บ | [`sfx.ts`](../src/audio/sfx.ts), [`App.tsx`](../src/App.tsx) |
| กันจอดับ | Screen Wake Lock API ระหว่างเล่น + ขอใหม่เมื่อกลับเข้าแอป | [`mobile.ts`](../src/lib/mobile.ts) |
| เต็มจอ | Fullscreen API + ล็อกแนวนอน (Android) / แนะนำ Add to Home Screen (iOS) | [`FullscreenButton.tsx`](../src/ui/components/FullscreenButton.tsx) |
| ติดตั้งเป็นแอป | Web App Manifest `display: fullscreen`, `orientation: landscape` | [`manifest.webmanifest`](../public/manifest.webmanifest) |
| ป๊อปอัปคำถามจอเตี้ย | media query `max-height: 460px` บีบขนาดให้อยู่ในจอเดียว | [`index.css`](../src/index.css) |
| ปุ่มค้างเวลาสลับแอป | รีเซ็ต `touchInput` ตอน `visibilitychange` / `blur` | [`TouchControls.tsx`](../src/ui/components/TouchControls.tsx) |

---

## 2. ข้อจำกัดที่แก้ไม่ได้ (ต้องยอมรับและออกแบบรอบๆ มัน)

### 2.1 iPhone Safari ซ่อนแถบเบราว์เซอร์ไม่ได้

`requestFullscreen()` **ไม่ทำงานบน iPhone** (iPad ทำได้) เป็นข้อจำกัดของ Safari เอง ไม่ใช่บั๊ก

**ทางออกเดียวที่ได้ผล:** ให้ผู้เล่นกด **แชร์ → "เพิ่มไปยังหน้าจอโฮม"** แล้วเปิดจากไอคอนนั้น
จะได้เต็มจอจริงเพราะ meta `apple-mobile-web-app-capable` ทำงาน

เกมจึงตรวจว่าเป็น iPhone ที่ยังไม่ได้ติดตั้ง แล้วขึ้นคำแนะนำให้เอง (`IosHomeScreenHint`)

> 📌 **ถ้าจะใช้ในคาบเรียน** ให้ครูสอนนักเรียนติดตั้งลงหน้าโฮมพร้อมกันตอนต้นคาบ
> ใช้เวลา 30 วินาที แต่ประสบการณ์เล่นต่างกันมาก

### 2.2 iOS จะไม่เล่นเสียงจนกว่าผู้ใช้จะแตะจอ

AudioContext เริ่มต้นในสถานะ `suspended` และ **ปลุกได้จาก event ที่ผู้ใช้แตะจริงเท่านั้น**

โค้ดเรียก `unlock()` ไว้ที่ปุ่ม "เริ่มเล่น" และ "เริ่มวิ่ง" แล้ว
⛔ **ห้ามย้ายไปเรียกใน `useEffect` ตอนโหลดหน้า** — จะใช้ไม่ได้ทันทีและหาสาเหตุยากมาก
(เกมจะเงียบสนิทเฉพาะบน iPhone ส่วนบนคอมของคนเขียนโค้ดเสียงดังปกติ)

### 2.3 ล็อกแนวจอได้เฉพาะ Android และต้องเข้า fullscreen ก่อน

`screen.orientation.lock('landscape')` ใช้ได้บน Android Chrome หลังเข้า fullscreen แล้วเท่านั้น
iOS ไม่รองรับเลย → จึงต้องมีป้าย "หมุนเครื่อง" เป็นทางสำรองเสมอ

### 2.4 Wake Lock ไม่มีบน iOS ต่ำกว่า 16.4

เครื่องเก่ากว่านั้นจอจะหรี่ตามการตั้งค่าเครื่อง — โค้ดจับ error ไว้แล้ว เกมไม่ล่ม

---

## 3. งบประสิทธิภาพสำหรับมือถือ

**เกณฑ์: 60fps บน Android ราคากลางอายุ 3 ปี** ไม่ใช่บนเครื่องของคนเขียนโค้ด

| รายการ | งบ | ตอนนี้ |
|---|---|---|
| ขนาดโหลดครั้งแรก (gzip) | ≤ 1 MB | **~475 KB** ✅ |
| ขนาดโหลดครั้งแรก (ดิบ) | ≤ 4 MB | ~1.9 MB ✅ |
| ไฟล์ภาพ | — | **0 ไฟล์** (วาดด้วยโค้ดทั้งหมด) ✅ |
| ไฟล์เสียง | — | **0 ไฟล์** (สังเคราะห์ด้วย Web Audio) ✅ |
| object pool | ตัวขวาง 30 / particle 120 | ตั้งไว้ใน `BALANCE.perf` ✅ |

**เทคนิคที่ใช้อยู่:**
- ผืนผ้าใบขนาดคงที่ 1280×720 แล้วให้ CSS สเกล → ไม่เรนเดอร์ตาม devicePixelRatio ของจอ 3x
  (บนจอมือถือความละเอียดสูง วิธีนี้ประหยัด GPU ได้มหาศาลโดยตาแทบไม่เห็นความต่างในเกม 2D)
- ตัวขวาง/อุกกาบาต/particle ใช้ object pool ทั้งหมด ไม่ `new` ระหว่างเล่น
- ส่ง event ไป React แค่ 10 ครั้ง/วินาที ไม่ใช่ทุกเฟรม (`BALANCE.perf.hudUpdateHz`)
- parallax แค่ 3 ชั้น

**ถ้าเจอเครื่องที่ยังช้า** ลองตามลำดับนี้ใน `src/config/balance.ts`:
1. ลด `perf.poolSize.particle` จาก 120 → 60
2. ลด `hudUpdateHz` จาก 10 → 6
3. ใน `PhaserGame.tsx` เปลี่ยน `render.antialias` เป็น `false`
4. ตัด parallax ชั้น `trees` ออกใน `GameScene.buildBackground()`

---

## 4. ทดสอบบนเครื่องจริง

```bash
npm run dev
```

เทอร์มินัลจะแสดง `Network: http://192.168.x.x:5173/` → เปิด URL นั้นบนมือถือในวง WiFi เดียวกัน
(`server.host = true` ตั้งไว้ใน `vite.config.ts` แล้ว)

**สิ่งที่ DevTools โหมดมือถือ *ไม่* จำลองให้ — ต้องทดสอบบนเครื่องจริงเท่านั้น:**
- ข้อจำกัดเสียงของ iOS
- ประสิทธิภาพจริงของ GPU มือถือ
- รอยบาก / home indicator
- แถบเบราว์เซอร์ที่ยุบ-ขยายตอนเลื่อน
- ความแม่นยำของนิ้วโป้งจริง (ปุ่มที่ดูใหญ่พอบนจอคอม มักเล็กเกินไปบนมือถือจริง)

เช็กลิสต์ทดสอบเครื่องจริงแบบเต็มอยู่ใน [06-deploy.md](06-deploy.md)

---

## 5. สิ่งที่ยังไม่ได้ทำ (ถ้ามีเวลาเหลือ)

- [ ] **Service Worker** ให้เล่นได้ตอนเน็ตหลุด (โครงโหมดออฟไลน์มีอยู่แล้ว เหลือแค่ cache ตัวไฟล์)
- [ ] **Haptic feedback** — `navigator.vibrate(30)` ตอนชนสิ่งกีดขวาง (Android เท่านั้น, iOS ไม่รองรับ)
- [ ] **ปุ่มควบคุมแบบปรับได้** — บางคนถนัดกระโดดด้วยมือซ้าย ควรให้สลับข้างได้
- [ ] **โหมดมือเดียว** — เล่นด้วยการแตะจุดเดียว (กระโดดอย่างเดียว) สำหรับคนที่ถือรถเมล์อยู่
- [ ] ทดสอบบน iPad แนวนอน (จอกว้างกว่า 4:3 — HUD อาจต้องปรับ)
