-- =====================================================================
--  DaraGame — 02 Row Level Security
--  หลักการ: ตารางดิบ "ปิดหมด" → เข้าถึงผ่าน view (อ่าน) และ RPC (เขียน)
-- =====================================================================

alter table classes     enable row level security;
alter table players     enable row level security;
alter table topics      enable row level security;
alter table questions   enable row level security;
alter table choices     enable row level security;
alter table runs        enable row level security;
alter table run_answers enable row level security;

-- ---------------------------------------------------------------------
-- helper: player ปัจจุบันคือใคร / เป็นครูของห้องนี้ไหม
-- ---------------------------------------------------------------------
create or replace function current_player_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from players where auth_uid = auth.uid();
$$;

create or replace function is_teacher_of(p_class_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from classes
                 where id = p_class_id and teacher_id = auth.uid());
$$;

create or replace function my_class_id()
returns uuid language sql stable security definer set search_path = public as $$
  select class_id from players where auth_uid = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- classes
-- ---------------------------------------------------------------------
create policy classes_read_open on classes
  for select to anon, authenticated
  using (is_open or teacher_id = auth.uid());

create policy classes_teacher_manage on classes
  for all to authenticated
  using (teacher_id = auth.uid()) with check (teacher_id = auth.uid());

-- ---------------------------------------------------------------------
-- players — เห็นเพื่อนร่วมห้องได้ (ไว้โชว์ leaderboard) แต่แก้ได้เฉพาะตัวเอง
-- ---------------------------------------------------------------------
create policy players_read_classmates on players
  for select to authenticated
  using (class_id is not distinct from my_class_id()
         or auth_uid = auth.uid()
         or is_teacher_of(class_id));

create policy players_update_self on players
  for update to authenticated
  using (auth_uid = auth.uid()) with check (auth_uid = auth.uid());

-- insert เกิดผ่าน RPC join_class() เท่านั้น → ไม่มี insert policy โดยเจตนา

-- ---------------------------------------------------------------------
-- topics — อ่านได้ทุกคน
-- ---------------------------------------------------------------------
create policy topics_read on topics for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------
-- questions / choices — ⛔ ไม่มี policy ให้ anon/authenticated เลย
--   ทุกการเข้าถึงต้องผ่าน view public_questions หรือ RPC answer_question()
--   ครูจัดการผ่านสิทธิ์ของตัวเอง
-- ---------------------------------------------------------------------
create policy questions_teacher_manage on questions
  for all to authenticated
  using  (exists (select 1 from classes where teacher_id = auth.uid()))
  with check (exists (select 1 from classes where teacher_id = auth.uid()));

create policy choices_teacher_manage on choices
  for all to authenticated
  using  (exists (select 1 from classes where teacher_id = auth.uid()))
  with check (exists (select 1 from classes where teacher_id = auth.uid()));

-- ---------------------------------------------------------------------
-- runs — เขียนผ่าน RPC เท่านั้น, อ่านได้ในห้องตัวเอง
-- ---------------------------------------------------------------------
create policy runs_read on runs
  for select to authenticated
  using (player_id = current_player_id()
         or (status = 'finished' and class_id is not distinct from my_class_id())
         or is_teacher_of(class_id));

create policy runs_teacher_void on runs
  for update to authenticated
  using (is_teacher_of(class_id)) with check (is_teacher_of(class_id));

-- ---------------------------------------------------------------------
-- run_answers — เห็นของตัวเอง (หน้าสรุป "ข้อไหนพลาด") + ครูเห็นทั้งห้อง
-- ---------------------------------------------------------------------
create policy run_answers_read on run_answers
  for select to authenticated
  using (exists (select 1 from runs r
                 where r.id = run_answers.run_id
                   and (r.player_id = current_player_id() or is_teacher_of(r.class_id))));

-- =====================================================================
--  GRANTS — ปิดประตูหลัง
-- =====================================================================

-- ห้ามแตะตารางคำถามตรงๆ เด็ดขาด (แม้ RLS จะกันอยู่แล้ว ก็ปิดสองชั้น)
revoke all on questions, choices from anon, authenticated;

-- อ่านผ่าน view เท่านั้น (view รันด้วยสิทธิ์เจ้าของ → ข้าม RLS ของตารางฐานได้)
grant select on public_questions      to anon, authenticated;
grant select on leaderboard_alltime   to anon, authenticated;
grant select on leaderboard_weekly    to anon, authenticated;
grant select on player_progress       to authenticated;
grant select on question_stats        to authenticated;   -- หน้าครู

-- เขียนข้อมูลเกม: ผ่าน RPC เท่านั้น
revoke insert, update, delete on runs, run_answers, players from anon, authenticated;

-- =====================================================================
--  ⚠️ เช็กลิสต์ก่อน deploy จริง
--   [ ] เปิด Supabase Dashboard → Advisors → Security ต้องไม่มี warning สีแดง
--   [ ] ลองยิง REST ตรงๆ: curl .../rest/v1/choices?select=*  ต้องได้ 401/permission denied
--   [ ] ลองยิง .../rest/v1/public_questions  ต้องได้ข้อมูล และต้องไม่มีคำว่า is_correct
--   [ ] service_role key ต้องไม่อยู่ในโค้ดฝั่ง client (grep หา 'service_role' ใน src/)
-- =====================================================================
