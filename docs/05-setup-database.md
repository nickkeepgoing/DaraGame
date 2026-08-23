# 05 — วิธีติดตั้งฐานข้อมูล (Supabase)

> **ยังไม่ต้องทำก็เล่นได้** — ถ้ายังไม่ตั้งค่า Supabase เกมจะรันใน **โหมดออฟไลน์** อัตโนมัติ
> (คำถามจาก `src/data/questions.local.json`, คะแนนเก็บใน localStorage)
> `npm install && npm run dev` แล้วเล่นได้เลยตั้งแต่นาทีแรก
>
> ทำขั้นตอนในเอกสารนี้เมื่อต้องการ **leaderboard ที่แชร์กันได้จริง** ระหว่างนักเรียนทั้งห้อง

**เวลาที่ใช้: ~20 นาที** · ไม่ต้องใช้บัตรเครดิต

---

## ขั้นที่ 1 — สร้างโปรเจกต์ Supabase

1. เข้า [supabase.com](https://supabase.com) → **Sign in with GitHub**
2. **New project**
   - Name: `daragame`
   - Database Password: **กดสุ่มแล้วเก็บใส่ที่ปลอดภัย** (จะใช้ตอนต่อ `psql`)
   - Region: **Southeast Asia (Singapore)** ← ใกล้ไทยที่สุด ทำให้ latency ต่ำ
   - Plan: Free
3. รอ ~2 นาที

> ⚠️ **โปรเจกต์ฟรีจะถูก pause อัตโนมัติเมื่อไม่มี traffic ประมาณ 7 วัน**
> ก่อนวันสอน/วันนำเสนอ ให้เข้า dashboard เช็กว่ามันตื่นอยู่ และเปิดเว็บเล่น 1 รอบ

---

## ขั้นที่ 2 — รันสคีมา

**Dashboard → SQL Editor → New query** แล้ววาง**ทีละไฟล์ตามลำดับ** กด **Run**:

| ลำดับ | ไฟล์ | สร้างอะไร |
|---|---|---|
| 1 | [`db/01_schema.sql`](../db/01_schema.sql) | 7 ตาราง + index + view + หมวดคำถาม 6 หมวด |
| 2 | [`db/02_rls.sql`](../db/02_rls.sql) | Row Level Security + สิทธิ์การเข้าถึง |
| 3 | [`db/03_rpc.sql`](../db/03_rpc.sql) | ฟังก์ชันเกม (เข้าห้อง / เริ่มรอบ / ตรวจคำตอบ / ปิดรอบ) |

**ห้ามสลับลำดับ** — ไฟล์ 2 กับ 3 อ้างถึงตารางที่ไฟล์ 1 สร้าง

> ### ⚠️ เคยรันสคีมาเวอร์ชันเก่าไปแล้ว และมีข้อมูลนักเรียนอยู่?
>
> **อย่ารัน `01_schema.sql` ซ้ำ** — มันจะสร้างตารางใหม่ทับของเดิม คะแนนหายหมด
> ให้ใช้ [`db/04_upgrade_stages.sql`](../db/04_upgrade_stages.sql) แทน ซึ่งเพิ่มเฉพาะ
> ส่วนที่ขาด (คอลัมน์ `role`/`stage`/`ord`, ค่า `victory`, view และฟังก์ชันตัวใหม่)
> โดยไม่แตะข้อมูลเดิม รันซ้ำกี่รอบก็ได้
>
> ```
> 1. วาง db/04_upgrade_stages.sql → Run
> 2. วาง db/03_rpc.sql → Run
> 3. npm run import:questions
> ```

<details>
<summary>ถ้าอยากใช้ Supabase CLI แทนการ copy-paste</summary>

```bash
npx supabase link --project-ref YOUR-PROJECT-REF
```

```bash
npx supabase db push --file db/01_schema.sql && npx supabase db push --file db/02_rls.sql && npx supabase db push --file db/03_rpc.sql
```

หรือถ้ามี `psql` อยู่แล้ว (คัดลอก connection string จาก Dashboard → Connect):

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/01_schema.sql -f db/02_rls.sql -f db/03_rpc.sql
```
</details>

**ตรวจว่าสำเร็จ:** Dashboard → **Table Editor** ต้องเห็น 7 ตาราง และตาราง `topics` มี 6 แถว

---

## ขั้นที่ 3 — เปิด Anonymous sign-in

**นี่คือขั้นที่คนลืมบ่อยที่สุด** ถ้าไม่เปิด จะล็อกอินไม่ผ่านและขึ้น error ตอนกด "เริ่มเล่น"

**Dashboard → Authentication → Sign In / Providers → เปิด "Allow anonymous sign-ins"**

ทำไมต้องใช้: นักเรียนกรอกแค่ชื่อเล่น แต่ระบบยังต้องมี JWT จริงไว้ให้ RLS อ้างอิง
Anonymous sign-in ให้ตรงนี้พอดี — ไม่มี friction แต่ยังปลอดภัย (ดู [02-database.md §6](02-database.md))

---

## ขั้นที่ 4 — คัดลอก API keys

**Dashboard → Project Settings → API Keys**

สร้างไฟล์ `.env.local` ที่ราก repo:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_APP_VERSION=0.1.0
```

> ✅ **anon key เปิดเผยได้ ปลอดภัย** — ถูกออกแบบมาให้อยู่ใน client และถูกคุมด้วย RLS
> ⛔ **`service_role` key ห้ามขึ้นต้นด้วย `VITE_` เด็ดขาด** Vite จะ bundle ตัวแปร `VITE_*` ทุกตัว
> เข้าไฟล์ JS ที่ทุกคนเปิดอ่านได้ ใครได้ key นี้ไปคือแก้คะแนนใครก็ได้ ลบตารางได้หมด

รีสตาร์ท dev server แล้วแถบ "โหมดออฟไลน์" ที่มุมล่างจะหายไป = ต่อสำเร็จ

---

## ขั้นที่ 5 — สร้างห้องเรียน

**SQL Editor** รันคำสั่งนี้ (แก้ชื่อกับรหัสตามจริง):

```sql
insert into classes (join_code, name) values
  ('M4-1-EARTH', 'ม.4/1 โลก ดาราศาสตร์ และอวกาศ'),
  ('M4-2-EARTH', 'ม.4/2 โลก ดาราศาสตร์ และอวกาศ');
```

`join_code` คือรหัสที่ครูเขียนบนกระดานให้นักเรียนกรอก — ต้องเป็น **ตัวพิมพ์ใหญ่ ตัวเลข และขีดกลาง** เท่านั้น

> 📌 **ไม่บังคับต้องสร้างห้อง** — `db/01_schema.sql` สร้างห้อง `PUBLIC` ("ห้องรวม") ไว้ให้แล้ว
> นักเรียนที่กรอกแค่ชื่อเล่นโดยไม่ใส่รหัส จะเข้าห้องรวมอัตโนมัติและเล่นได้ทันที
> สร้างห้องแยกเฉพาะตอนที่อยากได้ **กระดานคะแนนแยกรายห้อง** เท่านั้น

**อยากให้ทั้งห้องเจอด่านเดียวกันเป๊ะ (แข่งกันยุติธรรม):**

```sql
update classes set level_seed = 20260822 where join_code = 'M4-1-EARTH';
```

ตั้งเลขใหม่ทุกครั้งที่จะแข่งรอบใหม่ (ใช้วันที่เป็นตัวเลขก็ได้) — ถ้าปล่อย `null` แต่ละคนจะได้ด่านสุ่มของตัวเอง

---

## ขั้นที่ 6 — นำเข้าคลังคำถาม

ต้องใช้ **service role key** เพราะสคริปต์ต้องข้าม RLS เพื่อเขียนตารางคำถาม
สร้างไฟล์ `.env` (**คนละไฟล์กับ `.env.local`** และ **ไม่มี prefix `VITE_`**):

```
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
```

ทั้ง `.env` และ `.env.local` อยู่ใน `.gitignore` แล้ว — **อย่า commit เด็ดขาด**

**ตรวจก่อนว่าไฟล์คำถามถูกต้อง (ไม่เขียนลง DB):**

```bash
npm run import:questions -- --dry
```

**นำเข้าจริง:**

```bash
npm run import:questions
```

**นำเข้าจาก CSV ที่ครูกรอกใน Google Sheet:**

```bash
npm run import:questions -- questions.csv
```

### รูปแบบ Google Sheet ที่ให้ครูกรอก

| topic | role | stage | ord | difficulty | stem | choice_a | choice_b | choice_c | choice_d | answer | explanation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| plate_tectonics | main | 1 | 1 | easy | การเคลื่อนที่ของแผ่นเปลือกโลกเข้าหากันเรียกว่าอะไร? | Divergent | Convergent | Transform | Rotation | b | แนวรอยต่อมี 3 แบบ … |
| plate_tectonics | revive |  | 10 | easy | ถ้าแผ่นเปลือกโลก 2 แผ่นเคลื่อนที่เข้าหากัน เรียกว่าเขตอะไร? | เขตแยกตัว | เขตชนกัน | เขตเลื่อนผ่าน | เขตหยุดนิ่ง | b | ภาษาไทยเรียกว่า … |
| plate_tectonics | final |  | 12 | hard | แผ่นมหาสมุทรเคลื่อนที่เข้าหาแผ่นทวีป … | แผ่นมหาสมุทรมุดลงใต้แผ่นทวีป | … | … | … | a | หลักการเดียวกับของหนักจมน้ำ … |

- `topic` ต้องเป็นหนึ่งใน: `plate_tectonics` · `solar_system` · `stars` · `black_holes` · `galaxies` · `sky_events`
- `role` — `main` (คำถามประจำด่าน) / `revive` (คำถามตอนตาย) / `final` (บอสสุดท้าย) · เว้นว่าง = `main`
- `stage` — **1-3 เมื่อ role=main เท่านั้น** ส่วน revive/final ต้องเว้นว่าง
- `ord` — ลำดับที่อยากให้เจอในด่านนั้น
- `difficulty` ต้องเป็น `easy` / `medium` / `hard`
- `answer` ต้องเป็น `a` / `b` / `c` / `d`
- `explanation` **ห้ามว่าง** — สคริปต์จะไม่ยอมนำเข้า (คำอธิบายคือหัวใจของเกมการศึกษา)

> **โครงที่เกมคาดหวัง:** ด่านละ `QUESTIONS_PER_STAGE` ข้อ (ตอนนี้ = 3) × 3 ด่าน + คำถามฟื้นอย่างน้อย 1 ข้อ + บอส 1 ข้อ
> ถ้าขาด `role=final` ผู้เล่นจะชนะเกมไม่ได้เลย — สคริปต์นำเข้าจะเตือนให้

สคริปต์เป็น **upsert** — รันซ้ำได้ไม่เกิดคำถามซ้ำ ข้อที่มีอยู่แล้วจะถูกอัปเดตแทน

---

## ขั้นที่ 7 — ตรวจความปลอดภัยก่อนเปิดใช้จริง

### 7.1 คำถามต้องเข้าตรงไม่ได้

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/choices?select=*" -H "apikey: $VITE_SUPABASE_ANON_KEY" | head -c 300
```

ต้องได้ error เรื่องสิทธิ์ **ไม่ใช่ข้อมูล** ถ้าเห็นข้อมูลออกมาแปลว่า `db/02_rls.sql` ยังไม่ได้รัน

### 7.2 view คำถามต้องไม่มีเฉลย

```bash
curl -s "$VITE_SUPABASE_URL/rest/v1/public_questions?select=*&limit=1" -H "apikey: $VITE_SUPABASE_ANON_KEY"
```

ต้องได้คำถามกลับมา และ **ต้องไม่มีคำว่า `is_correct` อยู่ในผลลัพธ์**

### 7.3 service_role key ต้องไม่อยู่ในโค้ด client

```bash
grep -rn "service_role" src/ && echo "❌ พบ! ต้องเอาออก" || echo "✅ ไม่พบ ผ่าน"
```

### 7.4 Advisors

**Dashboard → Advisors → Security** ต้องไม่มี warning สีแดง

---

## แก้ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| `Anonymous sign-ins are disabled` | ลืมขั้นที่ 3 | เปิด Anonymous sign-ins ใน Authentication |
| `ไม่พบรหัสห้องเรียนนี้` | ยังไม่สร้างห้อง หรือพิมพ์รหัสไม่ตรง | ทำขั้นที่ 5 · รหัสเป็นตัวพิมพ์ใหญ่เสมอ |
| ยังขึ้น "โหมดออฟไลน์" | `.env.local` ผิดชื่อ/ผิดที่ หรือยังไม่รีสตาร์ท | ไฟล์ต้องชื่อ `.env.local` อยู่ที่ราก repo แล้ว restart `npm run dev` |
| `permission denied for table questions` | ปกติ! ตั้งใจให้เข้าตรงไม่ได้ | ต้องเข้าผ่าน RPC `next_question()` ไม่ใช่ query ตารางตรงๆ |
| **ตอบคำถามแล้วไม่ได้คะแนน ไม่มีเฉลย** | ฐานข้อมูลยังเป็นเวอร์ชันเก่า โค้ดเรียก `next_question(run_id, kind, stage)` แต่ DB มีแต่ `next_question(run_id, difficulty)` | รัน [`db/04_upgrade_stages.sql`](../db/04_upgrade_stages.sql) แล้วตามด้วย `db/03_rpc.sql` |
| ตอบบอสถูกแล้วบันทึกคะแนนไม่ได้ | `runs.end_reason` ยังไม่รับค่า `'victory'` | เหมือนข้างบน — `04_upgrade_stages.sql` แก้ให้ |
| ป๊อปอัปคำถามขึ้นแล้วปิดทันที | ไม่มีคำถามของ role/stage นั้นในคลัง | นำเข้าให้ครบทั้ง 3 ด่าน + revive + final (ขั้นที่ 6) |
| เล่นถึงท้ายเกมแล้วไม่มีบอส | ไม่มีคำถาม `role=final` | เพิ่มคำถามบอสอย่างน้อย 1 ข้อ |
| ตายแล้วจบเลย ไม่มีคำถามฟื้น | ไม่มีคำถาม `role=revive` | เพิ่มคำถามฟื้นอย่างน้อย 1 ข้อ |
| `function join_class does not exist` | ยังไม่ได้รัน `03_rpc.sql` | รันไฟล์ที่ 3 |
| ทุกอย่างช้ามาก / timeout | โปรเจกต์ถูก pause | เข้า Dashboard กด Restore แล้วรอ 1-2 นาที |

---

## Query ที่ครูใช้บ่อย

```sql
-- อันดับในห้อง
select nickname, total_score, distance_m, correct_count
from leaderboard_alltime
where class_id = (select id from classes where join_code = 'M4-1-EARTH')
order by total_score desc limit 10;
```

```sql
-- 10 ข้อที่นักเรียนพลาดเยอะที่สุด = เรื่องที่ต้องสอนซ้ำ
select stem, difficulty, attempts, pct_correct
from question_stats where attempts >= 5 order by pct_correct asc limit 10;
```

```sql
-- รอบที่ระบบสงสัยว่าผิดปกติ (ครูตัดสินเอง ระบบไม่ตัดสินให้)
select p.nickname, r.total_score, r.distance_m, r.flag_reason, r.ended_at
from runs r join players p on p.id = r.player_id
where r.status = 'flagged' order by r.ended_at desc;
```

```sql
-- ยกเลิกรอบที่ครูตรวจแล้วว่าโกงจริง
update runs set status = 'void' where id = 'PASTE-RUN-ID-HERE';
```

```sql
-- ตรวจสมดุลเกม: คะแนนควิซควรเป็น 55-65% ของคะแนนรวม
select round(avg(quiz_score + bonus_score) * 100.0 / nullif(avg(total_score), 0), 1) as quiz_pct,
       round(avg(total_score))   as avg_score,
       round(avg(distance_m))    as avg_distance_m,
       round(avg(duration_ms)/1000.0, 1) as avg_seconds,
       count(*)                  as runs
from runs where status = 'finished';
```

> ถ้า `quiz_pct` ต่ำกว่า 55% แปลว่าเด็กจะเริ่มมองว่า "ตอบคำถามไม่คุ้ม" แล้วข้าม checkpoint
> แก้โดยลด `score.pointsPerMeter` ใน [`src/config/balance.ts`](../src/config/balance.ts)
> **และแก้ `c_pts_per_m` ใน [`db/03_rpc.sql`](../db/03_rpc.sql) ให้ตรงกันด้วยเสมอ**
