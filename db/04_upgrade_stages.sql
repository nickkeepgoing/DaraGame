-- =====================================================================
--  DaraGame — 04 อัปเกรดฐานข้อมูลเดิมให้รองรับระบบด่าน + บอส + ฟื้น
--
--  ใช้เมื่อ: เคยรัน 01_schema.sql เวอร์ชันเก่าไปแล้ว และมีข้อมูลนักเรียน
--            อยู่ในฐานข้อมูลแล้ว จึงรัน 01 ใหม่ทั้งไฟล์ไม่ได้ (จะลบข้อมูลทิ้ง)
--
--  ไฟล์นี้ทำงานซ้ำได้ (idempotent) — รันกี่รอบก็ได้ ไม่พัง ไม่ลบข้อมูล
--
--  🔧 วิธีใช้:
--     1. Supabase Dashboard → SQL Editor → New query → วางไฟล์นี้ → Run
--     2. วาง db/03_rpc.sql ทั้งไฟล์ → Run   (ทุกฟังก์ชันเป็น create or replace)
--     3. npm run import:questions            (นำเข้าคำถาม 46 ข้อพร้อม role/stage)
--
--  อาการที่ไฟล์นี้แก้: ตอบคำถามแล้วไม่ได้คะแนน ไม่มีเฉลย
--  เพราะโค้ดเรียก next_question(run_id, kind, stage) แต่ฐานข้อมูลมีแต่
--  next_question(run_id, difficulty) ตัวเก่า
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. ชนิดข้อมูลใหม่: บทบาทของคำถาม
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'question_role') then
    create type question_role as enum ('main', 'revive', 'final');
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2. ทิ้งของเก่าที่ขวางอยู่
--    ต้องทิ้ง function ก่อน view เพราะ function คืนค่าเป็น setof view
--    และต้องทิ้ง view ก่อน alter table เพราะ view อ้างถึงตาราง
-- ---------------------------------------------------------------------
drop function if exists next_question(uuid, difficulty);
drop function if exists next_question(uuid, text, smallint);
drop view if exists public_questions;

-- ---------------------------------------------------------------------
-- 3. เพิ่มคอลัมน์ใหม่ให้ตาราง questions
-- ---------------------------------------------------------------------
alter table questions add column if not exists role  question_role not null default 'main';
alter table questions add column if not exists stage smallint;
alter table questions add column if not exists ord   smallint not null default 0;

-- คำถามเดิมที่มีอยู่แล้วยังไม่มีด่าน — เดาให้จากระดับความยาก
-- (ง่าย = ด่าน 1, กลาง = ด่าน 2, ยาก = ด่าน 3) ครูปรับทีหลังได้
update questions
   set stage = case difficulty
                 when 'easy'   then 1
                 when 'medium' then 2
                 else 3
               end
 where role = 'main' and stage is null;

-- ให้เลขลำดับกับข้อที่ยังไม่มี เพื่อไม่ให้ทุกข้อเป็น 0 เหมือนกันหมด
with numbered as (
  select id, row_number() over (partition by role, stage order by created_at) as rn
    from questions where ord = 0
)
update questions q set ord = n.rn from numbered n where n.id = q.id;

-- กติกา: คำถามประจำด่านต้องมีด่าน ส่วน revive/final ห้ามมี
alter table questions drop constraint if exists stage_matches_role;
alter table questions add  constraint stage_matches_role check (
  (role = 'main' and stage is not null) or (role <> 'main' and stage is null)
);
alter table questions drop constraint if exists questions_stage_check;
alter table questions add  constraint questions_stage_check check (stage is null or stage between 1 and 9);

drop index if exists questions_pick_idx;
create index questions_pick_idx on questions (role, stage, ord) where is_active;

-- ---------------------------------------------------------------------
-- 4. runs.end_reason ต้องรับค่า 'victory' (ชนะบอสสุดท้าย)
--
--    ไล่ทิ้ง check constraint เดิมทุกตัวที่พูดถึง end_reason แทนการเดาชื่อ
--    เพราะถ้าเดาชื่อผิด ตัวเก่าจะยังอยู่แล้วปฏิเสธค่า 'victory' ต่อไป
--    อาการคือ "ตอบบอสถูกแล้วเกมค้าง บันทึกคะแนนไม่ได้"
-- ---------------------------------------------------------------------
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'runs'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%end_reason%'
  loop
    execute format('alter table runs drop constraint %I', c.conname);
  end loop;
end $$;

alter table runs add constraint runs_end_reason_check
  check (end_reason in ('wall', 'hearts', 'quit', 'timeout', 'victory'));

-- ---------------------------------------------------------------------
-- 5. สร้าง view คำถามสาธารณะใหม่ (เพิ่ม role / stage / ord)
--    ⚠️ ยังต้องไม่มี is_correct และ explanation เหมือนเดิม
-- ---------------------------------------------------------------------
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

-- การสร้าง view ใหม่ทำให้สิทธิ์เดิมหายไป ต้องให้ใหม่ทุกครั้ง
grant select on public_questions to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5.1 สร้าง next_question ตัวใหม่ทันทีในไฟล์นี้เลย
--
--     ⚠️ ข้อ 2 ทิ้งตัวเก่าไปแล้ว ถ้าไฟล์นี้ไม่สร้างตัวใหม่ให้ แล้วใครลืมรัน
--        03_rpc.sql ต่อ เกมจะพังหนักกว่าเดิม (จากเดิมมีฟังก์ชันผิดเวอร์ชัน
--        กลายเป็นไม่มีฟังก์ชันเลย) ไฟล์อัปเกรดต้องพึ่งพาตัวเองได้
--
--     ตัวนี้เหมือนกับใน 03_rpc.sql ทุกประการ — รันทับกันได้ไม่มีปัญหา
-- ---------------------------------------------------------------------
create or replace function next_question(
  p_run_id uuid,
  p_kind   text default 'main',
  p_stage  smallint default null
) returns setof public_questions
language plpgsql security definer set search_path = public as $$
declare
  v_role question_role := p_kind::question_role;
begin
  if not exists (select 1 from runs r join players p on p.id = r.player_id
                  where r.id = p_run_id and p.auth_uid = auth.uid()
                    and r.status = 'playing') then
    raise exception 'ไม่พบรอบการเล่นนี้' using errcode = 'P0002';
  end if;

  -- ข้อที่ยังไม่เคยถามในรอบนี้ก่อน
  return query
    select pq.* from public_questions pq
     where pq.role = v_role
       and (v_role <> 'main' or pq.stage = p_stage)
       and pq.id not in (select question_id from run_answers where run_id = p_run_id)
     order by pq.ord, random()
     limit 1;

  if found then return; end if;

  -- ถามครบทุกข้อของหมวดนี้แล้ว -> ยอมถามซ้ำ ดีกว่าข้าม checkpoint ไปเฉยๆ
  return query
    select pq.* from public_questions pq
     where pq.role = v_role
       and (v_role <> 'main' or pq.stage = p_stage)
     order by random()
     limit 1;
end $$;

revoke execute on function next_question(uuid, text, smallint) from public, anon;
grant  execute on function next_question(uuid, text, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- 6. ห้องรวม + หมวดใหม่ (ใส่ซ้ำไม่พัง)
-- ---------------------------------------------------------------------
insert into classes (join_code, name)
values ('PUBLIC', 'ห้องรวม (ไม่ระบุห้องเรียน)')
on conflict (join_code) do nothing;

insert into topics (slug, name_th, ord)
values ('plate_tectonics', 'การชนกันของแผ่นเปลือกโลก', 0)
on conflict (slug) do nothing;

commit;

-- =====================================================================
--  ✅ ตรวจว่าสำเร็จ — รันทีละคำสั่ง ผลลัพธ์ควรเป็นตามที่เขียนไว้
-- =====================================================================

-- ต้องเห็น role / stage / ord
-- select column_name from information_schema.columns
--  where table_name = 'questions' and column_name in ('role','stage','ord');

-- ต้องได้ 1 แถว หน้าตาเป็น next_question(uuid, text, smallint)
-- select pg_get_function_identity_arguments(oid) as args
--   from pg_proc where proname = 'next_question';

-- ต้องมีคำว่า role กับ stage และต้อง "ไม่มี" is_correct
-- select column_name from information_schema.columns where table_name = 'public_questions';
