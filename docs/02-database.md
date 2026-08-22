# 02 — Database Design

PostgreSQL (Supabase) — สคีมาจริงรันได้อยู่ที่ [`db/01_schema.sql`](../db/01_schema.sql), [`db/02_rls.sql`](../db/02_rls.sql), [`db/03_rpc.sql`](../db/03_rpc.sql)

---

## 1. ภาพรวมความสัมพันธ์

```
classes ──┬──< players ──< runs ──< run_answers >── questions ──< choices
          │                                            │
          └────────< runs (denormalized class_id)      └──> topics
```

**7 ตาราง เท่านั้น** — อย่าออกแบบเกินนี้ตอนเริ่ม

| ตาราง | เก็บอะไร | โตแค่ไหน |
|---|---|---|
| `classes` | ห้องเรียน + รหัสเข้าห้อง | หลักสิบ |
| `players` | นักเรียน (ชื่อเล่น + ห้อง) | หลักร้อย–พัน |
| `topics` | หมวดย่อยดาราศาสตร์ | 5–8 แถว fix |
| `questions` | คำถาม + **คำอธิบายเฉลย** | 100–300 |
| `choices` | ตัวเลือก (4 ต่อข้อ) | 400–1,200 |
| `runs` | 1 แถว = เล่น 1 รอบ | โตเร็วสุด (พัน–หมื่น) |
| `run_answers` | 1 แถว = ตอบ 1 ข้อ | โตเร็วสุด (หมื่น–แสน) |

> ขนาดระดับนี้ Postgres ตัวฟรีเอาอยู่สบายๆ ไม่ต้องคิดเรื่อง sharding/cache

---

## 2. การตัดสินใจสำคัญในสคีมา (แต่ละข้อแก้ปัญหาอะไร)

### 2.1 ชื่อเล่นซ้ำได้ แต่ซ้ำในห้องเดียวกันไม่ได้

```sql
create unique index players_class_nickname_uidx on players (class_id, lower(nickname));
```

แก้ปัญหา "ม.4/1 กับ ม.4/2 มี 'บอส' คนละคน" โดยไม่ต้องบังคับ nickname unique ทั้งระบบ (ซึ่งจะทำให้เด็กคนที่ 2 ต้องตั้งชื่อ `boss123`)
`lower()` กันเคส `Boss` / `boss` ถือเป็นคนเดียวกัน

### 2.2 ทุกคำถาม**ต้องมี**คำอธิบาย

```sql
explanation text not null
```

บังคับด้วย `not null` เลย เพราะนี่คือสิ่งที่แยก "เกมเพื่อการศึกษา" ออกจาก "เกมที่มีคำถามแปะ" (ข้อ 10 ใน GDD) ถ้าไม่บังคับที่ระดับ DB จะมีคนใส่ค่าว่างแน่นอน

### 2.3 บังคับให้มีคำตอบถูกข้อเดียว

```sql
create unique index choices_one_correct_uidx on choices (question_id) where is_correct;
```

Partial unique index — DB จะปฏิเสธถ้าใครเผลอ import คำถามที่ติ๊กถูก 2 ข้อหรือไม่ติ๊กเลย ดีกว่าไปเจอตอนเด็กกำลังเล่น

### 2.4 `seed` ใน `runs` — หัวใจของความยุติธรรม

```sql
seed bigint not null
```

ด่านถูกสร้างจาก **seeded PRNG** (`mulberry32`) ไม่ใช่ `Math.random()`

ได้ 3 อย่างพร้อมกัน:
1. **แข่งกันยุติธรรม** — ครูตั้ง seed ประจำวัน → ทั้งห้องเจอด่านเดียวกันเป๊ะ วัดฝีมือกันจริง
2. **ตรวจสอบย้อนหลังได้** — คะแนนน่าสงสัย เอา seed มา replay ดูได้
3. **บั๊กซ้ำได้** — "ตกหลุมตรงเมตรที่ 340" เอา seed ไปเปิดดูได้เลย ไม่ต้องเดา

### 2.5 `total_score` เป็น generated column

```sql
total_score integer generated always as (quiz_score + distance_score + bonus_score) stored
```

Postgres คำนวณเอง เขียนทับไม่ได้ → **ไม่มีทางที่ client จะยัดคะแนนเข้ามาตรงๆ** และไม่มีทางที่ 3 ช่องย่อยจะไม่ตรงกับยอดรวม

### 2.6 `class_id` ซ้ำใน `runs` (denormalize ตั้งใจ)

`runs.class_id` ก็ได้จาก `players.class_id` อยู่แล้ว แต่ก็อปมาเก็บด้วยเพราะ:
- Leaderboard ห้องเรียน query ตรงจาก index เดียว ไม่ต้อง join
- **เก็บประวัติถูกต้อง** — เด็กย้ายห้องกลางเทอม คะแนนเก่าต้องยังอยู่ห้องเก่า ไม่ใช่ย้ายตามไปด้วย

### 2.7 `status` ใน `runs` แทนการลบ

```sql
status text check (status in ('playing','finished','flagged','void'))
```

- `playing` — เริ่มแล้วยังไม่จบ (แถวค้างพวกนี้ = คนปิดแท็บหนี ไม่นับคะแนน)
- `finished` — จบปกติ นับเข้า leaderboard
- `flagged` — ระบบสงสัยว่าโกง (ดูข้อ 4) **ยังเห็นอยู่ ครูตัดสินเอง** ไม่ลบอัตโนมัติ
- `void` — ครูยืนยันว่าเป็นโมฆะ

---

## 3. Views — client ไม่แตะตารางดิบเลย

| View | ใช้ที่ไหน | จุดสำคัญ |
|---|---|---|
| `public_questions` | ตอนดึงคำถามมาแสดง | **ไม่มีคอลัมน์ `is_correct` และไม่มี `explanation`** |
| `leaderboard_alltime` | หน้า Leaderboard | `distinct on (player_id)` → 1 คน 1 แถว เอาคะแนนสูงสุด |
| `leaderboard_weekly` | กระดานรายสัปดาห์ | `date_trunc('week', ended_at)` |
| `question_stats` | หน้าครู | % ตอบถูก + เวลาเฉลี่ยต่อข้อ → รู้ว่าเด็กอ่อนเรื่องไหน |
| `player_progress` | หน้าสรุปนักเรียน | เล่นกี่รอบ, ถูกกี่ %, ข้อที่พลาดบ่อย |

**`public_questions` คือกำแพงกันโกงด่านแรก** — ถ้าส่ง `is_correct` ไปให้ client เด็กเปิด DevTools → Network แล้วเห็นเฉลยทุกข้อภายใน 10 วินาที และมันจะแพร่ทั้งห้องภายในคาบเดียว

---

## 4. Anti-cheat: 4 ชั้น (ทำตามลำดับ)

| ชั้น | ทำอะไร | กันได้แค่ไหน | ต้นทุน |
|---|---|---|---|
| 1. ไม่ส่งเฉลย | `public_questions` ไม่มี `is_correct` | กันคนดู Network tab | ~0 |
| 2. ตรวจที่เซิร์ฟเวอร์ | RPC `answer_question()` เป็นคนบอกว่าถูก/ผิด + ให้คะแนน | กันคนแก้ตัวแปร JS | ต่ำ |
| 3. คำนวณคะแนนใหม่ทั้งหมด | `finish_run()` `sum(points) from run_answers` ไม่เชื่อตัวเลขจาก client | กันคนยิง API ตรง | ต่ำ |
| 4. ตรวจความสมเหตุสมผล | ระยะทาง vs เวลาที่ใช้จริง, เวลาตอบต่อข้อ | กันบอท/สคริปต์ | ต่ำ |

**ชั้น 4 ที่ทำจริงใน `finish_run()`:**

```
ระยะทางสูงสุดที่เป็นไปได้ = (วินาทีที่เล่นจริง) × (ความเร็ววิ่งสูงสุด) × 1.15
ถ้าเกิน → status = 'flagged'

ตอบเร็วกว่า 700ms หลายข้อติด → 'flagged'   (คนอ่านคำถามไทยไม่ทันหรอก)
เวลาที่ server จับ vs ที่ client แจ้ง ต่างเกิน 20% → 'flagged'
```

> **ปรัชญา: flag ไม่ ban** เกมห้องเรียน ระบบตัดสินเองแล้วเด็กเสียใจผิดๆ แย่กว่าปล่อยครูดู ให้หน้าครูมีแท็บ "รอบที่น่าสงสัย" แล้วครูกดโมฆะเอง
>
> และรับความจริงข้อนี้ไว้: **กันเด็กที่ตั้งใจโกงจริงๆ 100% ไม่ได้** ในเกมฝั่ง client — เป้าหมายคือทำให้โกงยากกว่าตั้งใจเรียนตอบเอง ซึ่ง 4 ชั้นนี้พอแล้ว

---

## 5. Row Level Security — สรุปเป็นภาษาคน

| ตาราง | anon (นักเรียน) | เจ้าของข้อมูล | ครู |
|---|---|---|---|
| `classes` | อ่านได้เฉพาะห้องที่เปิดรับ | – | จัดการห้องตัวเอง |
| `players` | อ่านชื่อ+avatar ของคนในห้องเดียวกัน | แก้ของตัวเองได้ (`auth_uid = auth.uid()`) | อ่านทั้งห้อง |
| `questions` / `choices` | ⛔ **เข้าตรงไม่ได้เลย** (revoke) เข้าผ่าน view/RPC เท่านั้น | – | จัดการได้ |
| `runs` | อ่านผ่าน leaderboard view | เขียนผ่าน RPC เท่านั้น | อ่านทั้งห้อง + ตั้ง void |
| `run_answers` | อ่านของตัวเอง (ไว้ดูหน้าสรุป "ข้อไหนพลาด") | เขียนผ่าน RPC | อ่านทั้งห้อง |

**เปิด RLS ทุกตารางตั้งแต่วันแรก** อย่าคิดว่า "ไว้ค่อยเปิดตอนใกล้ส่ง" — พอเปิดทีหลังจะพังพร้อมกันหมดแล้วไล่แก้ไม่ทัน

---

## 6. Login โดยไม่มี password แต่ยังปลอดภัย

```
เด็กพิมพ์: ชื่อเล่น + รหัสห้อง (เช่น M4-1-ASTRO)
      ↓
supabase.auth.signInAnonymously()   → ได้ JWT จริง เก็บใน localStorage
      ↓
RPC join_class(code, nickname)      → ผูก auth_uid เข้ากับแถวใน players
      ↓
เปิดเบราว์เซอร์เดิม = เป็นคนเดิมอัตโนมัติ ไม่ต้องล็อกอินซ้ำ
```

ได้ครบ 3 อย่าง:
- **friction เท่ากับศูนย์** — พิมพ์ 2 ช่อง กดเล่น
- **RLS ใช้งานได้จริง** — มี `auth.uid()` ให้อ้างอิง
- **สวมชื่อคนอื่นไม่ได้** — ชื่อเล่นถูกจองด้วย `auth_uid` แล้ว เครื่องอื่นเข้ามาใช้ชื่อซ้ำจะโดนปฏิเสธ

**PIN 4 หลัก (ไม่บังคับ):** ถ้าอยากให้เด็กสลับเครื่อง/ล้าง cache แล้วยังเอาชื่อคืนได้ ให้ตั้ง PIN ตอนสมัคร เก็บเป็น bcrypt hash (`pin_hash`) — ไม่ใช่ security จริงจัง แต่พอกัน "เพื่อนแกล้งเล่นแทนให้คะแนนตก"

---

## 7. Workflow คลังคำถาม (สำคัญกว่าที่คิด)

**อย่าให้ครู/คนเขียนคำถามต้องแตะโค้ดหรือ SQL**

```
Google Sheet  →  ดาวน์โหลด CSV  →  npm run import:questions  →  Supabase
```

หัวตาราง Google Sheet:

| topic | difficulty | stem | choice_a | choice_b | choice_c | choice_d | answer | explanation |
|---|---|---|---|---|---|---|---|---|
| solar_system | easy | ดาวเคราะห์ดวงใดอยู่ใกล้ดวงอาทิตย์ที่สุด | พุธ | ศุกร์ | โลก | อังคาร | a | ดาวพุธอยู่ห่างดวงอาทิตย์เฉลี่ย 58 ล้าน กม. ... |

สคริปต์ `tools/import-questions.ts` ควร:
- validate ก่อนเขียน DB: `answer` ต้องเป็น a-d, `explanation` ห้ามว่าง, `stem` ห้ามซ้ำ
- **upsert ไม่ใช่ insert** (รันซ้ำได้ไม่เกิดคำถามซ้ำ)
- รายงานท้ายว่า "เพิ่มใหม่ 12 / อัปเดต 3 / ข้าม 2 (ผิดรูปแบบ บรรทัด 14, 27)"

> **นี่คืองานที่ทีมประเมินเวลาผิดเสมอ** เขียนคำถามดาราศาสตร์ 100 ข้อ พร้อมคำอธิบายที่ถูกต้องและอ่านรู้เรื่องสำหรับเด็ก **ใช้เวลา 15-25 ชั่วโมง** ไม่ใช่ "เย็นวันเดียว" → เริ่มสัปดาห์ที่ 1 ทำคู่ขนานไปกับโค้ด อย่ารอให้เกมเสร็จก่อน

---

## 8. ตัวอย่าง query ที่จะใช้จริง

```sql
-- Top 20 ทั้งระบบ
select * from leaderboard_alltime order by total_score desc limit 20;

-- Top 10 เฉพาะห้อง
select * from leaderboard_alltime where class_id = $1 order by total_score desc limit 10;

-- กระดานสัปดาห์นี้
select * from leaderboard_weekly
where week_start = date_trunc('week', now()) order by total_score desc limit 10;

-- หน้าครู: 10 ข้อที่เด็กพลาดเยอะสุด (ตอบไปแล้วอย่างน้อย 5 ครั้ง)
select stem, difficulty, attempts, pct_correct
from question_stats where attempts >= 5 order by pct_correct asc limit 10;

-- หน้าสรุปท้ายเกม: ข้อที่ตอบผิดในรอบนี้ + เฉลย + คำอธิบาย
select q.stem, q.explanation, c.content as correct_answer
from run_answers a
join questions q on q.id = a.question_id
join choices  c on c.question_id = q.id and c.is_correct
where a.run_id = $1 and not a.is_correct;
```

---

## 9. Realtime leaderboard (ถ้าอยากได้)

Supabase Realtime subscribe การ `insert` บน `runs` ได้ตรงๆ:

```ts
supabase.channel('lb')
  .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'runs', filter: `class_id=eq.${classId}` },
      () => refetchLeaderboard())
  .subscribe();
```

ทำให้ตอนแข่งในห้อง อันดับขยับสดๆ บนจอโปรเจกเตอร์ — เป็น feature ที่ทำง่ายมาก (~1 ชม.) แต่สร้างบรรยากาศได้เยอะสุดในเกมนี้ **แนะนำให้ทำ**

> อย่า subscribe ทั้งตาราง `runs` โดยไม่ filter — ห้องอื่นเล่นก็โดน refetch ด้วย เปลืองโควตาฟรี
