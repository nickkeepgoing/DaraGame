-- =====================================================================
--  DaraGame — 05 เพิ่มระบบ "ครูตั้งเพลงพื้นหลังของห้อง"
--
--  ใช้เมื่อ: เคยรัน 01_schema.sql + 03_rpc.sql (หรือ 04_upgrade_stages.sql)
--            ไปแล้ว และมีข้อมูลอยู่แล้ว จึงรัน 01 ใหม่ทั้งไฟล์ไม่ได้
--
--  ไฟล์นี้ทำงานซ้ำได้ (idempotent) — รันกี่รอบก็ได้ ไม่พัง ไม่ลบข้อมูล
--  พึ่งพาตัวเองได้ครบ ไม่ต้องรัน 03_rpc.sql ต่อ (แต่รันซ้ำได้ ไม่มีปัญหา)
--
--  🔧 วิธีใช้: Supabase Dashboard → SQL Editor → New query → วางไฟล์นี้ → Run
--
--  สิ่งที่เพิ่ม: คอลัมน์ classes.music_url (ลิงก์ไฟล์เพลง mp3/ogg ที่โหลดตรงได้)
--  ครูตั้งค่าได้ที่หน้า "จัดการห้องเรียน" → ⚙️ ตั้งค่าห้องเรียน
--  null = ใช้เพลงสังเคราะห์เดิมของเกม (ดู src/audio/sfx.ts)
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. คอลัมน์ใหม่บนตาราง classes
-- ---------------------------------------------------------------------
alter table classes add column if not exists music_url text;

alter table classes drop constraint if exists music_url_fmt;
alter table classes add  constraint music_url_fmt check (music_url is null or music_url ~ '^https?://');

alter table classes drop constraint if exists music_url_len;
alter table classes add  constraint music_url_len check (music_url is null or char_length(music_url) <= 2048);

-- ---------------------------------------------------------------------
-- 2. teacher_create_class / teacher_update_class — เพิ่ม p_music_url
--    ต้อง drop ก่อนเสมอ เพราะจำนวนอาร์กิวเมนต์เปลี่ยน (create or replace
--    แทนที่ฟังก์ชันเดิมไม่ได้ถ้า argument list ไม่ตรงกันเป๊ะ)
-- ---------------------------------------------------------------------
drop function if exists teacher_create_class(text, text, bigint);

create or replace function teacher_create_class(
  p_name       text,
  p_join_code  text,
  p_level_seed bigint default null,
  p_music_url  text default null
) returns classes
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_code  text := upper(btrim(p_join_code));
  v_music text := nullif(btrim(coalesce(p_music_url, '')), '');
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '28000';
  end if;

  if exists (select 1 from classes where join_code = v_code) then
    raise exception 'รหัสห้องเรียนนี้ถูกใช้งานแล้ว โปรดใช้รหัสอื่น' using errcode = '23505';
  end if;

  if v_music is not null and v_music !~ '^https?://' then
    raise exception 'ลิงก์เพลงต้องขึ้นต้นด้วย http:// หรือ https://' using errcode = '22000';
  end if;

  insert into classes (name, join_code, teacher_id, level_seed, is_open, music_url)
  values (btrim(p_name), v_code, auth.uid(), p_level_seed, true, v_music)
  returning * into v_class;

  return v_class;
end $$;

drop function if exists teacher_update_class(uuid, boolean, bigint);

create or replace function teacher_update_class(
  p_class_id   uuid,
  p_is_open    boolean,
  p_level_seed bigint default null,
  p_music_url  text default null
) returns classes
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_class classes%rowtype;
  v_music text := nullif(btrim(coalesce(p_music_url, '')), '');
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน' using errcode = '28000';
  end if;

  if v_music is not null and v_music !~ '^https?://' then
    raise exception 'ลิงก์เพลงต้องขึ้นต้นด้วย http:// หรือ https://' using errcode = '22000';
  end if;

  update classes
     set is_open    = p_is_open,
         level_seed = p_level_seed,
         music_url  = v_music
   where id = p_class_id and teacher_id = auth.uid()
  returning * into v_class;

  if not found then
    raise exception 'ไม่พบห้องเรียนนี้ หรือไม่มีสิทธิ์แก้ไข' using errcode = 'P0002';
  end if;

  return v_class;
end $$;

revoke execute on function teacher_create_class(text, text, bigint, text) from public, anon;
revoke execute on function teacher_update_class(uuid, boolean, bigint, text) from public, anon;
grant  execute on function teacher_create_class(text, text, bigint, text) to authenticated;
grant  execute on function teacher_update_class(uuid, boolean, bigint, text) to authenticated;

commit;

-- =====================================================================
--  ✅ ตรวจว่าสำเร็จ
-- =====================================================================
-- select column_name from information_schema.columns
--  where table_name = 'classes' and column_name = 'music_url';
--
-- select pg_get_function_identity_arguments(oid) as args
--   from pg_proc where proname = 'teacher_update_class';
