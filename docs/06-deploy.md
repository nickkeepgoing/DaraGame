# 06 — วิธี Deploy

เกมนี้ build ออกมาเป็น **ไฟล์ static ล้วน** (HTML/JS/CSS) ไม่มีเซิร์ฟเวอร์ของตัวเอง
ทุกอย่างที่ต้องใช้เซิร์ฟเวอร์อยู่ที่ Supabase หมดแล้ว → โฮสต์ที่ไหนก็ได้ ฟรีทั้งนั้น

---

## เส้นทางที่แนะนำ: Vercel (ใช้เวลา ~5 นาที)

### 1. push ขึ้น GitHub

```bash
git init && git add . && git commit -m "feat: DaraGame MVP" && git branch -M main
```

```bash
git remote add origin https://github.com/nickkeepgoing/DaraGame.git && git push -u origin main
```

> ก่อน push เช็กว่า `.env` และ `.env.local` **ไม่ติดไปด้วย** (อยู่ใน `.gitignore` แล้ว):
> ```bash
> git ls-files | grep -E "^\.env" && echo "❌ หลุด! git rm --cached" || echo "✅ ปลอดภัย"
> ```

### 2. เชื่อม Vercel

1. [vercel.com](https://vercel.com) → **Sign in with GitHub** → **Add New… → Project**
2. เลือก repo `DaraGame` → Vercel ตรวจเจอ Vite เอง ไม่ต้องตั้งค่าอะไร
   - Framework Preset: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. กาง **Environment Variables** แล้วใส่ 3 ตัว (ทั้ง Production, Preview, Development):

| Key | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
| `VITE_APP_VERSION` | `1.0.0` |

> ⛔ **ห้ามใส่ `SUPABASE_SERVICE_ROLE_KEY` ที่นี่** ไม่ว่ากรณีใด
> สคริปต์นำเข้าคำถามรันจากเครื่องเราเท่านั้น ไม่ต้องใช้ key นั้นบน Vercel

4. **Deploy** → ได้ URL เช่น `https://daragame.vercel.app`

ทุกครั้งที่ `git push` ขึ้น `main` = deploy ใหม่อัตโนมัติ และทุก PR จะได้ preview URL ของตัวเอง

### 3. ตั้งค่า Supabase ให้รู้จัก URL ใหม่

**Supabase Dashboard → Authentication → URL Configuration**
- **Site URL**: `https://daragame.vercel.app`
- **Redirect URLs**: เพิ่ม `https://daragame.vercel.app/**`

(ยังไม่จำเป็นตอนนี้เพราะใช้ anonymous auth แต่จะจำเป็นทันทีที่เพิ่ม Google Sign-in ให้ครู)

---

## ทางเลือกอื่น

<details>
<summary><b>Netlify</b></summary>

```bash
npx netlify-cli deploy --build --prod
```

หรือเชื่อม GitHub ผ่านเว็บ: Build command `npm run build`, Publish directory `dist`
ตั้ง environment variables ที่ **Site settings → Environment variables**
</details>

<details>
<summary><b>Cloudflare Pages</b></summary>

Build command `npm run build`, Build output `dist`
เร็วที่สุดสำหรับผู้ใช้ในไทย เพราะมี edge อยู่ในกรุงเทพฯ
</details>

<details>
<summary><b>GitHub Pages</b> (ฟรีที่สุด แต่ตั้งค่ายุ่งกว่า)</summary>

ต้องแก้ `vite.config.ts` เพิ่ม `base: '/DaraGame/'` เพราะเว็บจะอยู่ใต้ path ย่อย
และต้องแก้ path ใน `index.html` (`/manifest.webmanifest` → `/DaraGame/manifest.webmanifest`)
**แนะนำให้ใช้ Vercel แทน** ประหยัดเวลาไปหลายชั่วโมง
</details>

---

## ทดสอบบนมือถือจริงก่อน deploy

เกมนี้เล่นบนมือถือเป็นหลัก — **ต้องทดสอบบนเครื่องจริง อย่าเชื่อ DevTools อย่างเดียว**
โหมดจำลองมือถือใน Chrome ไม่จำลอง: ประสิทธิภาพจริง, ข้อจำกัดเสียงของ iOS, รอยบาก, หรือแถบเบราว์เซอร์ที่ยุบ-ขยาย

### เปิดจากมือถือในวง WiFi เดียวกัน

`vite.config.ts` ตั้ง `server.host = true` ไว้แล้ว รัน:

```bash
npm run dev
```

เทอร์มินัลจะแสดง `Network: http://192.168.x.x:5173/` — เปิด URL นั้นบนมือถือได้เลย

> Windows Firewall อาจบล็อกครั้งแรก ให้กด **Allow access** เมื่อมีป๊อปอัปขึ้น

### ถ้าอยู่คนละเครือข่าย

```bash
npx localtunnel --port 5173
```

---

## เช็กลิสต์ก่อนใช้จริงในห้องเรียน

### บนเครื่องจริง — iPhone (Safari)

- [ ] เปิดเว็บแล้ว **ถือแนวตั้ง** → ต้องขึ้นข้อความ "หมุนเครื่องเป็นแนวนอน"
- [ ] หมุนเป็นแนวนอน → เกมเต็มจอ ไม่มีส่วนไหนโดนรอยบากบัง
- [ ] **มีเสียง** หลังแตะปุ่มแรก (ถ้าเงียบ = `unlock()` ไม่ถูกเรียกจาก user gesture)
- [ ] แตะครึ่งจอขวา = กระโดด, ครึ่งจอซ้าย = หมอบ
- [ ] เลื่อนนิ้วออกนอกโซนขณะกดค้าง แล้วปล่อย → ตัวละครต้อง**ไม่**กระโดดค้าง
- [ ] ป๊อปอัปคำถามอยู่ในจอเดียว ไม่ต้องเลื่อน กดตัวเลือกได้ครบทั้ง 4 ข้อ
- [ ] "เพิ่มไปยังหน้าจอโฮม" แล้วเปิดจากไอคอน → เต็มจอ ไม่มีแถบ Safari
- [ ] เล่นค้างไว้ 2 นาทีโดยไม่ยกนิ้ว → **จอต้องไม่ดับ** (wake lock)

### บนเครื่องจริง — Android (Chrome)

- [ ] ปุ่ม ⛶ เต็มจอทำงาน และล็อกเป็นแนวนอน
- [ ] เฟรมเรตลื่นบนเครื่องราคากลาง (ไม่ใช่แค่เรือธง)
- [ ] กดปุ่ม Back ของระบบแล้วกลับเข้ามา → เกมไม่ค้าง เสียงกลับมา
- [ ] มีสายเข้าระหว่างเล่น แล้วกลับมา → ตัวละครไม่วิ่งค้างไปทางเดียว

### บนคอม

- [ ] Chrome / Edge / Firefox เล่นได้ครบ
- [ ] เล่น 5 รอบติดโดยไม่รีเฟรช → DevTools → Memory ไม่ไต่ขึ้นเรื่อยๆ
- [ ] กด "เล่นอีกรอบ" 3 รอบ → คะแนนไม่บวกซ้ำ, มี `<canvas>` แค่ใบเดียวเสมอ
- [ ] สลับแท็บไป 30 วินาทีแล้วกลับมา → ตัวละครไม่ทะลุพื้น

### ความปลอดภัย

- [ ] `grep -rn "service_role" src/` ไม่เจออะไร
- [ ] `curl .../rest/v1/choices?select=*` ถูกปฏิเสธ
- [ ] Supabase → Advisors → Security ไม่มี warning สีแดง
- [ ] แก้ตัวแปรคะแนนใน DevTools แล้วส่ง → คะแนนใน DB ต้องไม่เปลี่ยน

### วันนำเสนอ

- [ ] เข้า Supabase Dashboard เช็กว่าโปรเจกต์**ไม่ถูก pause** (ฟรีทีเออร์หลับหลังไม่มี traffic 7 วัน)
- [ ] เปิดเว็บเล่นจริง 1 รอบเช้าวันนั้น
- [ ] ทดสอบบน **WiFi ของโรงเรียน** ไม่ใช่เน็ตบ้าน
- [ ] **อัดวิดีโอหน้าจอสำรองไว้** เผื่อเน็ตล่มกลางการนำเสนอ
- [ ] เตรียมรหัสห้องเขียนใส่สไลด์/กระดานให้ชัด

---

## ปัญหาที่เจอบ่อยหลัง deploy

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| ขึ้น "โหมดออฟไลน์" บนเว็บที่ deploy แล้ว | ลืมใส่ env vars ใน Vercel | ใส่แล้ว **redeploy** — env vars ถูกฝังตอน build ไม่ใช่ตอนรัน |
| แก้ env vars แล้วยังไม่เปลี่ยน | Vite ฝังค่าตอน build | Deployments → ปุ่ม ⋯ → **Redeploy** |
| หน้าขาวเปล่า | JS error | เปิด DevTools → Console ดู error จริง |
| ฟอนต์ไทยเพี้ยน สระลอย | Google Fonts โหลดไม่ขึ้น | เช็ก Network ว่า `fonts.googleapis.com` โหลดผ่าน (บางเครือข่ายโรงเรียนบล็อก) → ถ้าโดนบล็อก ให้ self-host ฟอนต์ไว้ใน `public/fonts/` |
| เกมช้าบนมือถือ | เครื่องเก่า / มีแท็บอื่นเปิดเยอะ | ปิดแท็บอื่น, ลองลด particle ใน `BALANCE.perf.poolSize` |
| iPhone เงียบสนิท | `unlock()` ไม่ได้ถูกเรียกจาก user gesture | ต้องแตะปุ่มก่อนเสมอ — ห้ามพยายามเล่นเสียงตอน `useEffect` ที่โหลดหน้า |
| คะแนนไม่ขึ้น leaderboard | RLS หรือ RPC ไม่ผ่าน | DevTools → Network ดู response ของ `finish_run` |

---

## สรุปคำสั่งที่ใช้บ่อย

```bash
npm run dev
```

```bash
npm run build && npm run preview
```

```bash
npm run typecheck
```

```bash
npm run import:questions -- --dry
```

```bash
npm run icons
```
