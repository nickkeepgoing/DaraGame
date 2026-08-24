-- =====================================================================
--  DaraGame — 01 Schema (PostgreSQL / Supabase)
--  รัน:  supabase db reset   หรือ  paste ลง SQL Editor
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgcrypto with schema public;

-- ---------------------------------------------------------------------
-- 1. ห้องเรียน
-- ---------------------------------------------------------------------
create table classes (
  id          uuid primary key default gen_random_uuid(),
  join_code   text        not null unique,          -- 'M4-1-ASTRO'
  name        text        not null,                 -- 'ม.4/1 โลก ดาราศาสตร์ฯ'
  teacher_id  uuid        references auth.users(id) on delete set null,
  is_open     boolean     not null default true,    -- ปิดรับเข้าห้องได้
  level_seed  bigint,                               -- ตั้งไว้ = ทั้งห้องเจอด่านเดียวกัน
  -- ครูใส่ลิงก์ไฟล์เพลง (mp3/ogg ที่โหลดตรงได้ ไม่ใช่หน้า YouTube) ให้เล่นแทน
  -- เพลงสังเคราะห์ในเกม — null = ใช้เพลงสังเคราะห์ปกติ (ดู src/audio/sfx.ts)
  music_url   text,
  created_at  timestamptz not null default now(),
  constraint join_code_fmt check (join_code ~ '^[A-Z0-9-]{4,20}$'),
  constraint music_url_fmt check (music_url is null or music_url ~ '^https?://'),
  constraint music_url_len check (music_url is null or char_length(music_url) <= 2048)
);

-- ---------------------------------------------------------------------
-- 2. ผู้เล่น (นักเรียน)
-- ---------------------------------------------------------------------
create table players (
  id           uuid primary key default gen_random_uuid(),
  auth_uid     uuid unique references auth.users(id) on delete cascade,
  class_id     uuid references classes(id) on delete set null,
  nickname     text not null,
  pin_hash     text,                                -- bcrypt ของ PIN 4 หลัก (optional)
  avatar_id    text not null default 'tero_green',
  best_score   integer not null default 0,          -- cache ไว้โชว์เร็ว
  runs_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint nickname_len check (char_length(btrim(nickname)) between 2 and 16)
);

-- ชื่อเล่นห้ามซ้ำ "ภายในห้องเดียวกัน"
create unique index players_class_nickname_uidx
  on players (class_id, lower(nickname)) where class_id is not null;
-- คนที่ยังไม่เข้าห้อง ห้ามซ้ำกันเอง
create unique index players_noclass_nickname_uidx
  on players (lower(nickname)) where class_id is null;

-- ---------------------------------------------------------------------
-- 3. คลังคำถาม
-- ---------------------------------------------------------------------
create table topics (
  id      smallint generated always as identity primary key,
  slug    text not null unique,       -- solar_system | stars | black_holes | galaxies | sky_events
  name_th text not null,
  ord     smallint not null default 0
);

create type difficulty as enum ('easy', 'medium', 'hard');

-- บทบาทของคำถามในเกม
--   main   = คำถามประจำจุดตรวจในด่าน 1-3
--   revive = คำถามตอนตาย ตอบถูกได้ฟื้นกลับมาเล่นต่อ
--   final  = บอสสุดท้าย ตอบถูก = ชนะเกม
create type question_role as enum ('main', 'revive', 'final');

create table questions (
  id           uuid primary key default gen_random_uuid(),
  topic_id     smallint not null references topics(id),
  role         question_role not null default 'main',
  stage        smallint check (stage between 1 and 9),
  ord          smallint not null default 0,   -- ลำดับที่ต้องการให้เจอในด่าน
  difficulty   difficulty not null,
  stem         text not null,
  image_url    text,
  explanation  text not null,                       -- บังคับ! โชว์หลังตอบ = คุณค่าทางการศึกษา
  time_limit_s smallint not null default 12 check (time_limit_s between 5 and 30),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  constraint stem_len check (char_length(btrim(stem)) >= 5),
  constraint expl_len check (char_length(btrim(explanation)) >= 10),
  -- คำถามประจำด่านต้องระบุด่าน ส่วน revive/final ห้ามระบุ
  constraint stage_matches_role check (
    (role = 'main' and stage is not null) or (role <> 'main' and stage is null)
  )
);
create index questions_pick_idx on questions (role, stage, ord) where is_active;
create unique index questions_stem_uidx on questions (md5(btrim(stem)));  -- กันคำถามซ้ำตอน import

create table choices (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  content     text not null,
  is_correct  boolean not null default false,
  ord         smallint not null check (ord between 0 and 5)
);
create index choices_q_idx on choices (question_id);
create unique index choices_ord_uidx on choices (question_id, ord);
-- คำตอบถูกได้ไม่เกิน 1 ข้อต่อคำถาม (ส่วน "ต้องมีอย่างน้อย 1" ให้ import script ตรวจ)
create unique index choices_one_correct_uidx on choices (question_id) where is_correct;

-- ---------------------------------------------------------------------
-- 4. รอบการเล่น
-- ---------------------------------------------------------------------
create table runs (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  class_id       uuid references classes(id),        -- denormalize: ล็อกห้อง ณ ตอนเล่น
  seed           bigint not null,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  duration_ms    integer,
  distance_m     integer  not null default 0 check (distance_m >= 0),
  hearts_left    smallint not null default 0 check (hearts_left between 0 and 5),
  correct_count  smallint not null default 0,
  wrong_count    smallint not null default 0,
  max_combo      smallint not null default 0,
  quiz_score     integer  not null default 0,
  distance_score integer  not null default 0,
  bonus_score    integer  not null default 0,
  total_score    integer generated always as
                   (quiz_score + distance_score + bonus_score) stored,
  end_reason     text check (end_reason in ('wall', 'hearts', 'quit', 'timeout', 'victory')),
  status         text not null default 'playing'
                   check (status in ('playing', 'finished', 'flagged', 'void')),
  flag_reason    text,
  client_version text
);

create index runs_leaderboard_idx on runs (class_id, total_score desc)
  where status = 'finished';
create index runs_global_idx      on runs (total_score desc)
  where status = 'finished';
create index runs_weekly_idx      on runs (ended_at desc)
  where status = 'finished';
create index runs_player_idx      on runs (player_id, started_at desc);

-- ---------------------------------------------------------------------
-- 5. คำตอบรายข้อ
-- ---------------------------------------------------------------------
create table run_answers (
  id            bigint generated always as identity primary key,
  run_id        uuid not null references runs(id) on delete cascade,
  question_id   uuid not null references questions(id),
  choice_id     uuid references choices(id),        -- null = หมดเวลา
  is_correct    boolean not null,
  time_taken_ms integer not null check (time_taken_ms >= 0),
  points        integer not null default 0,
  combo_at      smallint not null default 0,
  answered_at   timestamptz not null default now(),
  unique (run_id, question_id)                      -- ตอบซ้ำข้อเดิมในรอบเดียวไม่ได้
);
create index run_answers_q_idx   on run_answers (question_id);
create index run_answers_run_idx on run_answers (run_id);

-- =====================================================================
--  VIEWS
-- =====================================================================

-- คำถามเวอร์ชันที่ client เห็นได้ — ไม่มี is_correct, ไม่มี explanation
create view public_questions as
select q.id,
       q.topic_id,
       t.slug as topic_slug,
       q.role,
       q.stage,
       q.ord,
       q.difficulty,
       q.stem,
       q.image_url,
       q.time_limit_s,
       (select jsonb_agg(jsonb_build_object('id', c.id, 'content', c.content)
                         order by c.ord)
          from choices c where c.question_id = q.id) as choices
from questions q
join topics t on t.id = q.topic_id
where q.is_active;

-- อันดับตลอดกาล: 1 คน 1 แถว (คะแนนสูงสุดของตัวเอง)
create view leaderboard_alltime as
select distinct on (r.player_id)
       r.player_id,
       p.nickname,
       p.avatar_id,
       r.class_id,
       c.name as class_name,
       r.total_score,
       r.distance_m,
       r.correct_count,
       r.max_combo,
       r.ended_at
from runs r
join players p on p.id = r.player_id
left join classes c on c.id = r.class_id
where r.status = 'finished'
order by r.player_id, r.total_score desc, r.ended_at asc;

-- อันดับรายสัปดาห์
create view leaderboard_weekly as
select distinct on (date_trunc('week', r.ended_at), r.player_id)
       date_trunc('week', r.ended_at) as week_start,
       r.player_id,
       p.nickname,
       p.avatar_id,
       r.class_id,
       r.total_score,
       r.distance_m,
       r.correct_count
from runs r
join players p on p.id = r.player_id
where r.status = 'finished' and r.ended_at is not null
order by date_trunc('week', r.ended_at), r.player_id, r.total_score desc;

-- สถิติรายข้อ (หน้าครู) — ข้อไหนเด็กพลาดเยอะ = ต้องสอนซ้ำ
create view question_stats as
select q.id,
       q.stem,
       q.difficulty,
       t.name_th as topic,
       count(a.id)                                          as attempts,
       count(a.id) filter (where a.is_correct)              as correct_count,
       round(100.0 * count(a.id) filter (where a.is_correct)
             / nullif(count(a.id), 0), 1)                   as pct_correct,
       round(avg(a.time_taken_ms))                          as avg_ms
from questions q
join topics t on t.id = q.topic_id
left join run_answers a on a.question_id = q.id
group by q.id, q.stem, q.difficulty, t.name_th;

-- ความก้าวหน้ารายคน (หน้าครู / หน้าสรุปนักเรียน)
create view player_progress as
select p.id as player_id,
       p.nickname,
       p.class_id,
       count(distinct r.id)                                  as runs_played,
       max(r.total_score)                                    as best_score,
       coalesce(sum(r.correct_count), 0)                     as total_correct,
       coalesce(sum(r.wrong_count), 0)                       as total_wrong,
       round(100.0 * coalesce(sum(r.correct_count), 0)
             / nullif(sum(r.correct_count) + sum(r.wrong_count), 0), 1) as pct_correct,
       max(r.distance_m)                                     as best_distance_m,
       max(r.ended_at)                                       as last_played_at
from players p
left join runs r on r.player_id = p.id and r.status = 'finished'
group by p.id, p.nickname, p.class_id;

-- ---------------------------------------------------------------------
-- ข้อมูลตั้งต้น: หมวดย่อยดาราศาสตร์
-- ---------------------------------------------------------------------
-- ห้องรวม: สำหรับนักเรียนที่เข้ามาเล่นโดยไม่มีรหัสห้องจากครู
insert into classes (join_code, name) values
  ('PUBLIC', 'ห้องรวม (ไม่ระบุห้องเรียน)');

insert into topics (slug, name_th, ord) values
  ('plate_tectonics', 'การชนกันของแผ่นเปลือกโลก', 0),
  ('solar_system', 'ระบบสุริยะ',            1),
  ('stars',        'ดาวฤกษ์',               2),
  ('black_holes',  'หลุมดำ',                3),
  ('galaxies',     'กาแล็กซีและเอกภพ',      4),
  ('sky_events',   'ปรากฏการณ์ท้องฟ้า',     5);
