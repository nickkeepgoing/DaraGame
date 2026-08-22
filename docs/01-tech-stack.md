# 01 — Tech Stack & Architecture

## สรุปสั้น (ถ้าอ่านบรรทัดเดียว)

> **Phaser 3 (เกมเพลย์) + React/TypeScript (UI ภาษาไทย) + Vite + Supabase (Postgres) + Vercel**

---

## 1. Stack ที่เลือก และเหตุผล

| ชั้น | เลือกใช้ | ทำไม |
|---|---|---|
| Build tool | **Vite + TypeScript** | dev server เร็วมาก, HMR, build เป็น static ได้ตรงๆ. TS ช่วยกันบั๊กเวลาหลายคนทำพร้อมกัน |
| Game engine | **Phaser 3** (Arcade Physics) | ทำ 2D platformer ครบเครื่อง: sprite/animation/tilemap/collision/camera/sound/particle มีให้หมด, ทิวทอเรียลภาษาไทย-อังกฤษเยอะที่สุด. **ใช้ Arcade Physics พอ** ไม่ต้อง Matter.js (เกมนี้เป็น AABB ล้วน — เร็วกว่ามาก) |
| UI / เมนู | **React 18 + TypeScript** ครอบทับ canvas | หน้า Login, Popup คำถาม, Leaderboard, สรุปคะแนน เป็นฟอร์มและข้อความไทยล้วน → ทำใน DOM ง่ายและถูกกว่าวาดใน canvas มาก (ดูข้อ 4 เรื่องฟอนต์ไทย) |
| Styling | **Tailwind CSS** | เร็ว ไม่ต้องตั้งชื่อ class, ทำ responsive landscape ง่าย |
| State กลาง | **Zustand** (เล็กมาก) | เก็บ score/hearts/สถานะเกม ให้ React กับ Phaser อ่านร่วมกันโดยไม่ต้องยก Redux มา |
| Backend + DB | **Supabase** (PostgreSQL + Auth + RPC + Realtime) | leaderboard/สถิติครู เป็นงาน relational เต็มตัว → SQL ตัวเดียวจบ, มี Row Level Security, มี anonymous auth, มี Realtime สำหรับกระดานคะแนนสด |
| Hosting | **Vercel** (หรือ Netlify) | deploy จาก GitHub อัตโนมัติ, preview URL ต่อ PR, ฟรีพอสำหรับโปรเจกต์นี้ |
| Audio | **Phaser Sound Manager** (Web Audio) | ไม่ต้องลง Howler.js เพิ่ม — Phaser ห่อ Web Audio มาให้แล้ว มี audio sprite, volume, fade ครบ |
| Lint/format | ESLint + Prettier + `lint-staged` | กันโค้ดพังตอน merge |

### ทำไมไม่ใช่ Firebase?

Firebase/Firestore เร็วกว่าตอนเริ่ม แต่โปรเจกต์นี้มี requirement 3 อย่างที่ Firestore ทำได้ลำบาก:

1. **Leaderboard แยกตามห้อง + แยกรายสัปดาห์** → Firestore ต้องสร้าง composite index ทีละแบบ, Postgres เขียน `where class_id = ? and ended_at >= ?` จบ
2. **หน้าสถิติครู** ("ข้อไหนนักเรียนตอบผิดเยอะสุด") → เป็น `GROUP BY` ล้วน. Firestore ไม่มี aggregate query แบบนี้ ต้องเขียน Cloud Function มา pre-aggregate เอง
3. **ตรวจคำตอบฝั่งเซิร์ฟเวอร์** → Supabase ใช้ Postgres function (RPC) เขียน SQL 20 บรรทัดจบ ไม่ต้อง deploy Cloud Function แยก

> **ข้อควรรู้เรื่อง Supabase free tier:** โปรเจกต์ฟรีจะถูก **pause อัตโนมัติเมื่อไม่มี traffic ~7 วัน** ต้องเข้า dashboard กด restore เอง → ก่อนวันนำเสนอ/วันแข่ง **เข้าไปเช็กว่ามันตื่นอยู่** อย่าเพิ่งเชื่อว่าเปิดค้างไว้แล้วจะรอด

### ถ้าทีมไม่ถนัด React

ใช้ **vanilla TypeScript + HTML overlay** แทนได้เลย โครงเหมือนกันทุกอย่าง (Phaser วาดใน `<canvas>`, UI เป็น `<div>` ทับข้างบน) แค่เขียน DOM เองแทน JSX — เสียเวลาเพิ่มตอนทำ Popup คำถามกับ Leaderboard ประมาณ 1-2 วัน แต่ลด learning curve ไปเยอะ **ห้ามทำ UI ไทยทั้งหมดใน canvas** (เหตุผลข้อ 4)

---

## 2. สถาปัตยกรรมภาพรวม

```
┌──────────────────── Browser (Vercel static) ─────────────────────┐
│                                                                   │
│  React (DOM layer)              ⇅ EventBus ⇅       Phaser 3       │
│  ─────────────────                                ───────────    │
│  • LoginScreen                                     • BootScene    │
│  • HowToPlayScreen                                 • PreloadScene │
│  • CountdownOverlay                                • GameScene    │
│  • HUD (หัวใจ/คะแนน/ระยะห่างกำแพง)                    - Player     │
│  • QuizModal   ← ข้อความไทยทั้งหมดอยู่ชั้นนี้           - Wall       │
│  • GameOverScreen                                    - Spawner    │
│  • LeaderboardScreen                                 - LevelGen   │
│                                                                   │
└───────────────────────────┬───────────────────────────────────────┘
                            │  supabase-js (HTTPS + JWT)
                            ▼
┌──────────────────── Supabase ────────────────────────────────────┐
│  Auth (anonymous sign-in)  →  ทุก request มี JWT ใช้กับ RLS ได้     │
│  PostgreSQL + Row Level Security                                  │
│  RPC (security definer) : join_class / start_run /                │
│                           answer_question / finish_run            │
│  Views : public_questions, leaderboard_*, question_stats          │
└───────────────────────────────────────────────────────────────────┘
```

### กฎเหล็กของสถาปัตยกรรมนี้ (เขียนไว้กันหลงทาง)

1. **Phaser ไม่ยุ่งกับ Supabase เลย** เกมส่ง event ออกมา → React เป็นคนคุยกับ backend → ส่งผลกลับเข้าเกม (เทสต์ง่าย, เกมรันออฟไลน์ได้)
2. **ข้อความภาษาไทยทุกตัวอยู่ใน DOM** ไม่มีใน canvas (ยกเว้นตัวเลขคะแนนลอย/effect ที่เป็นเลขอารบิก)
3. **คะแนนสุดท้ายคำนวณที่เซิร์ฟเวอร์เสมอ** client ส่งได้แค่ "ข้อมูลดิบ" (ตอบข้อไหน, วิ่งไปกี่เมตร) ไม่ใช่ตัวเลขคะแนน

---

## 3. สะพานเชื่อม React ↔ Phaser (EventBus)

ใช้ `Phaser.Events.EventEmitter` ตัวเดียวเป็น singleton — ทั้งสองฝั่ง import ไฟล์เดียวกัน

```ts
// src/game/EventBus.ts
import Phaser from 'phaser';
export const EventBus = new Phaser.Events.EventEmitter();
```

**สัญญา event ที่ต้องมี (ตกลงกันไว้ก่อนเริ่มโค้ด):**

| Event | ทิศทาง | payload | ความหมาย |
|---|---|---|---|
| `game:ready` | Phaser → React | – | โหลด asset เสร็จ พร้อมเริ่ม |
| `game:start` | React → Phaser | `{ seed }` | นับถอยหลังจบ เริ่มวิ่ง |
| `hud:update` | Phaser → React | `{ hearts, distanceM, wallGapPx, combo }` | อัปเดต HUD (throttle เหลือ ~10 ครั้ง/วิ พอ) |
| `quiz:open` | Phaser → React | `{ questionId, difficulty, timeLimitS }` | ถึง checkpoint → เปิด popup |
| `quiz:answered` | React → Phaser | `{ isCorrect, difficulty }` | ตอบเสร็จแล้ว → เกมเดินต่อ + ผลักกำแพง |
| `game:over` | Phaser → React | `{ distanceM, heartsLeft, endReason, durationMs }` | ตาย → React ยิง `finish_run` |
| `game:restart` | React → Phaser | – | กดเล่นใหม่ |

> **หลุมพรางที่เจอบ่อย:** ลืม `EventBus.off(...)` ตอน React component unmount → กดเล่นใหม่ 3 รอบแล้ว listener ซ้อนกัน 3 ตัว คะแนนบวกเป็น 3 เท่า **ทุก `useEffect` ที่ `.on()` ต้องมี cleanup `.off()`**

---

## 4. เรื่องฟอนต์ไทย (สำคัญ อ่านก่อนเลือกวิธีวาดข้อความ)

ภาษาไทยมี **สระบน สระล่าง และวรรณยุกต์ซ้อนกันได้ถึง 3 ชั้น** (เช่น `เปื้อน`, `ก็`) การ render ต้องผ่าน text shaping engine ของเบราว์เซอร์

- ✅ **DOM (`<div>`, `<p>`, `<button>`)** — เบราว์เซอร์จัดวางให้ถูกต้อง 100%
- ⚠️ **Phaser `Text` object** (ใช้ Canvas 2D `fillText`) — ใช้ได้ เบราว์เซอร์ shape ให้ แต่วัดความกว้าง/ตัดบรรทัดเองมั่วบ่อย
- ❌ **Phaser `BitmapText`** — **ห้ามใช้กับภาษาไทยเด็ดขาด** มันวาดทีละ glyph จากตาราง ไม่มี shaping → สระ/วรรณยุกต์จะหลุดออกมาลอยข้างตัวอักษร

**ที่ต้องทำ:**
- ฟอนต์: `Noto Sans Thai` หรือ `IBM Plex Sans Thai` (อ่านง่าย) / `Kanit` (เกมมิ่งกว่า) — โหลดจาก Google Fonts และ **preload ด้วย `<link rel="preload">`** ไม่งั้นข้อความจะกระพริบตอนเปิด popup คำถาม
- `line-height: 1.6` ขึ้นไปเสมอ ไม่งั้นวรรณยุกต์บรรทัดบนจะชนสระล่างบรรทัดล่าง
- ปุ่มตัวเลือกคำตอบ: `min-height` แทน `height` ตายตัว เพราะคำถามไทยยาวไม่เท่ากัน

---

## 5. โครงสร้างโฟลเดอร์

```
Daragame/
├─ public/
│  └─ assets/
│     ├─ sprites/      dino.png + dino.json (texture atlas)
│     ├─ bg/           parallax layers 3-4 ชั้น
│     ├─ audio/        bgm.webm, sfx.webm + sfx.json (audio sprite)
│     └─ ui/
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                     router ระหว่างหน้าจอ
│  ├─ ui/                         ← React ทั้งหมด (ข้อความไทยอยู่นี่)
│  │  ├─ screens/  Login | HowToPlay | Countdown | GameOver | Leaderboard
│  │  ├─ hud/      Hearts.tsx  ScoreBar.tsx  WallMeter.tsx
│  │  └─ quiz/     QuizModal.tsx  ChoiceButton.tsx  ExplanationCard.tsx
│  ├─ game/                       ← Phaser ทั้งหมด (ไม่มี fetch ในนี้)
│  │  ├─ PhaserGame.tsx           mount/unmount canvas
│  │  ├─ EventBus.ts
│  │  ├─ scenes/    Boot | Preload | Game
│  │  ├─ entities/  Player | DoomWall | Obstacle | Checkpoint | Pickup
│  │  └─ systems/   LevelGen | Spawner | Rng | ObjectPool
│  ├─ config/
│  │  └─ balance.ts               ← ตัวเลขปรับสมดุลทั้งหมดอยู่ไฟล์เดียว
│  ├─ api/         auth.ts  runs.ts  quiz.ts  leaderboard.ts
│  ├─ lib/         supabase.ts
│  ├─ store/       gameStore.ts   (zustand)
│  └─ types/       database.types.ts  (generate จาก supabase CLI)
├─ db/             01_schema.sql  02_rls.sql  03_rpc.sql
├─ docs/           01-tech-stack.md ... 04-roadmap.md, GDD.md
├─ tools/          import-questions.ts  (CSV → DB)
└─ .env.example
```

**กฎ:** ตัวเลขปรับสมดุลทุกตัว (ความเร็วกำแพง, แรงกระโดด, ระยะ checkpoint, คะแนน) **ต้องอยู่ใน `src/config/balance.ts` ไฟล์เดียว** ห้ามฮาร์ดโค้ดกระจายในซีน — ไม่งั้นตอน playtest จะจูนไม่ทัน

---

## 6. คำสั่งตั้งโปรเจกต์

```bash
npm create vite@latest . -- --template react-ts
```

```bash
npm i phaser @supabase/supabase-js zustand && npm i -D tailwindcss @tailwindcss/vite eslint prettier
```

`.env.local` (Vercel ตั้งใน dashboard):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

> ⚠️ **`anon key` เปิดเผยได้ ปลอดภัย** — มันถูกออกแบบมาให้อยู่ใน client และถูกคุมด้วย RLS
> ⛔ **`service_role key` ห้ามอยู่ใน `src/` หรือ `.env` ที่ขึ้นต้นด้วย `VITE_` เด็ดขาด** — Vite จะ bundle ทุกตัวแปรที่ขึ้นต้นด้วย `VITE_` เข้าไฟล์ JS ที่ทุกคนเปิดอ่านได้ ใครได้ key นี้ไปคือแก้คะแนนใครก็ได้ ลบตารางได้หมด นี่คือความผิดพลาดอันดับ 1 ของโปรเจกต์นักศึกษาที่ใช้ Supabase
