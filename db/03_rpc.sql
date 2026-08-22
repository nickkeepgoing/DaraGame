-- =====================================================================
--  DaraGame — 03 RPC (game logic ฝั่งเซิร์ฟเวอร์)
--
--  ⚠️ ค่าคะแนนในไฟล์นี้ต้องตรงกับ src/config/balance.ts เสมอ
--     เซิร์ฟเวอร์คือ "ความจริง" — ฝั่งเกมแสดงตัวเลขเพื่อ feedback ทันทีเท่านั้น
-- =====================================================================

-- ---------------------------------------------------------------------
-- join_class — เข้าห้องด้วยชื่อเล่น + รหัสห้อง (หลัง signInAnonymously)
-- ---------------------------------------------------------------------
create or replace function join_class(
  p_join_code text,
  p_nickname  text,
  p_pin       text default null
) returns players
language plpgsql security definer set search_path = public as $$
declare
  v_class   classes%rowtype;
  v_player  players%rowtype;
  v_nick    text := btrim(p_nickname);
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบก่อน (anonymous sign-in)' using errcode = '28000';
  end if;

  select * into v_class from classes
   where join_code = upper(btrim(p_join_code)) and is_open;
  if not found then
    raise exception 'ไม่พบรหัสห้องเรียนนี้ หรือห้องปิดรับแล้ว' using errcode = 'P0002';
  end if;

  -- เคยเข้ามาแล้ว (เครื่องเดิม) → อัปเดตแล้วจบ
  select * into v_player from players where auth_uid = auth.uid();
  if found then
    update players
       set class_id = v_class.id, nickname = v_nick, last_seen_at = now()
     where id = v_player.id
    returning * into v_player;
    return v_player;
  end if;

  -- ชื่อซ้ำในห้องนี้ไหม
  if exists (select 1 from players
              where class_id = v_class.id and lower(nickname) = lower(v_nick)) then
    raise exception 'ชื่อเล่นนี้มีคนใช้ในห้องแล้ว ลองชื่ออื่นดูนะ' using errcode = '23505';
  end if;

  insert into players (auth_uid, class_id, nickname, pin_hash)
  values (auth.uid(), v_class.id, v_nick,
          case when p_pin is null then null else crypt(p_pin, gen_salt('bf')) end)
  returning * into v_player;

  return v_player;
end $$;

-- ---------------------------------------------------------------------
-- start_run — เปิดรอบใหม่ + แจก seed ของด่าน
-- ---------------------------------------------------------------------
create or replace function start_run(p_client_version text default null)
returns table (run_id uuid, seed bigint)
language plpgsql security definer set search_path = public as $$
declare
  v_player players%rowtype;
  v_seed   bigint;
  v_run_id uuid;
begin
  select * into v_player from players where auth_uid = auth.uid();
  if not found then
    raise exception 'ยังไม่ได้เข้าห้องเรียน' using errcode = '28000';
  end if;

  -- กันสแปม: เริ่มรอบใหม่ถี่กว่า 3 วินาทีไม่ได้
  if exists (select 1 from runs
              where player_id = v_player.id and started_at > now() - interval '3 seconds') then
    raise exception 'เริ่มเกมถี่เกินไป รอสักครู่' using errcode = '54000';
  end if;

  -- รอบเก่าที่ค้างอยู่ (ปิดแท็บหนี) → ทิ้ง ไม่นับคะแนน
  update runs set status = 'void', ended_at = now()
   where player_id = v_player.id and status = 'playing';

  -- ครูตั้ง level_seed ไว้ = ทั้งห้องเจอด่านเดียวกัน (แข่งกันยุติธรรม)
  select coalesce(c.level_seed, (random() * 2147483647)::bigint)
    into v_seed
    from classes c where c.id = v_player.class_id;
  v_seed := coalesce(v_seed, (random() * 2147483647)::bigint);

  insert into runs (player_id, class_id, seed, client_version)
  values (v_player.id, v_player.class_id, v_seed, p_client_version)
  returning id into v_run_id;

  update players set last_seen_at = now() where id = v_player.id;

  return query select v_run_id, v_seed;
end $$;

-- ---------------------------------------------------------------------
-- next_question — เซิร์ฟเวอร์เป็นคนเลือกคำถาม (client เลือกเองไม่ได้)
--   p_kind  : 'main' (คำถามประจำด่าน) | 'revive' (ตอนตาย) | 'final' (บอส)
--   p_stage : 1-3 เมื่อ p_kind = 'main'
--   ไม่ซ้ำข้อที่ตอบไปแล้วในรอบนี้ และเรียงตาม ord ตามที่ออกแบบด่านไว้
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

-- ---------------------------------------------------------------------
-- answer_question — ตรวจคำตอบ + ให้คะแนน (ฝั่งเซิร์ฟเวอร์เท่านั้น)
--   คืน: ถูก/ผิด, เฉลย, คำอธิบาย, คะแนนที่ได้, คอมโบปัจจุบัน
-- ---------------------------------------------------------------------
create or replace function answer_question(
  p_run_id      uuid,
  p_question_id uuid,
  p_choice_id   uuid,          -- null = หมดเวลา
  p_time_ms     integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  -- ===== ต้องตรงกับ balance.ts =====
  c_base       constant jsonb := '{"easy":15,"medium":30,"hard":60}';
  c_fast_full  constant int  := 10;   -- ตอบภายใน 40% ของเวลา
  c_fast_half  constant int  := 5;    -- ตอบภายใน 70% ของเวลา
  c_combo_step constant numeric := 0.25;
  c_combo_max  constant numeric := 2.0;
  -- =================================
  v_q          questions%rowtype;
  v_correct_id uuid;
  v_is_correct boolean;
  v_combo      int;
  v_mult       numeric;
  v_points     int := 0;
  v_bonus      int := 0;
  v_limit_ms   int;
begin
  if not exists (select 1 from runs r join players p on p.id = r.player_id
                  where r.id = p_run_id and p.auth_uid = auth.uid()
                    and r.status = 'playing') then
    raise exception 'ไม่พบรอบการเล่นนี้' using errcode = 'P0002';
  end if;

  select * into v_q from questions where id = p_question_id and is_active;
  if not found then
    raise exception 'ไม่พบคำถามนี้' using errcode = 'P0002';
  end if;

  select id into v_correct_id from choices
   where question_id = p_question_id and is_correct;

  v_is_correct := (p_choice_id is not null and p_choice_id = v_correct_id);
  v_limit_ms   := v_q.time_limit_s * 1000;

  -- คอมโบปัจจุบัน = จำนวนข้อที่ตอบถูกติดกันหลัง "ข้อผิดล่าสุด"
  select count(*) into v_combo
    from run_answers
   where run_id = p_run_id
     and answered_at > coalesce(
           (select max(answered_at) from run_answers
             where run_id = p_run_id and not is_correct), '-infinity'::timestamptz);

  if v_is_correct then
    v_combo := v_combo + 1;
    v_mult  := least(1 + c_combo_step * greatest(v_combo - 1, 0), c_combo_max);

    if    p_time_ms <= v_limit_ms * 0.40 then v_bonus := c_fast_full;
    elsif p_time_ms <= v_limit_ms * 0.70 then v_bonus := c_fast_half;
    end if;

    v_points := round((c_base ->> v_q.difficulty::text)::int * v_mult) + v_bonus;
  else
    v_combo  := 0;
    v_points := 0;   -- ตอบผิดไม่หักคะแนน ไม่หักหัวใจ (ดู docs/03-decisions.md)
  end if;

  insert into run_answers (run_id, question_id, choice_id, is_correct,
                           time_taken_ms, points, combo_at)
  values (p_run_id, p_question_id, p_choice_id, v_is_correct,
          greatest(p_time_ms, 0), v_points, v_combo)
  on conflict (run_id, question_id) do nothing;

  return jsonb_build_object(
    'is_correct',        v_is_correct,
    'correct_choice_id', v_correct_id,
    'explanation',       v_q.explanation,   -- ส่งหลังตอบแล้วเท่านั้น
    'points',            v_points,
    'speed_bonus',       v_bonus,
    'combo',             v_combo
  );
end $$;

-- ---------------------------------------------------------------------
-- finish_run — ปิดรอบ + คำนวณคะแนนใหม่ทั้งหมด + ตรวจความสมเหตุสมผล
--   client ส่งได้แค่ "ข้อมูลดิบ" ไม่มีสิทธิ์ส่งตัวเลขคะแนน
-- ---------------------------------------------------------------------
create or replace function finish_run(
  p_run_id      uuid,
  p_distance_m  integer,
  p_hearts_left smallint,
  p_end_reason  text
) returns runs
language plpgsql security definer set search_path = public as $$
declare
  -- ===== ต้องตรงกับ balance.ts =====
  c_pts_per_m    constant numeric := 0.5;
  c_heart_bonus  constant int     := 50;
  c_victory      constant int     := 300;   -- โบนัสตอบบอสสุดท้ายถูก
  c_max_speed_ms constant numeric := 4.2;    -- เมตร/วินาที (420 px/s ÷ 100 px ต่อเมตร)
  c_tolerance    constant numeric := 1.15;   -- เผื่อ lag/คลาดเคลื่อน 15%
  -- =================================
  v_run       runs%rowtype;
  v_elapsed_s numeric;
  v_max_dist  int;
  v_quiz      int;
  v_correct   int;
  v_wrong     int;
  v_combo     int;
  v_status    text := 'finished';
  v_flag      text;
begin
  select r.* into v_run from runs r join players p on p.id = r.player_id
   where r.id = p_run_id and p.auth_uid = auth.uid() and r.status = 'playing';
  if not found then
    raise exception 'ไม่พบรอบการเล่นนี้ หรือปิดไปแล้ว' using errcode = 'P0002';
  end if;

  v_elapsed_s := extract(epoch from (now() - v_run.started_at));

  -- คะแนนควิซ: บวกจากตารางจริง ไม่เชื่อตัวเลขจาก client
  select coalesce(sum(points), 0),
         count(*) filter (where is_correct),
         count(*) filter (where not is_correct),
         coalesce(max(combo_at), 0)
    into v_quiz, v_correct, v_wrong, v_combo
    from run_answers where run_id = p_run_id;

  -- ---- ตรวจความสมเหตุสมผล (flag ไม่ ban) ----
  v_max_dist := ceil(v_elapsed_s * c_max_speed_ms * c_tolerance);
  if p_distance_m > v_max_dist then
    v_status := 'flagged';
    v_flag   := format('ระยะทาง %s ม. เกินที่เป็นไปได้ใน %.1f วิ (สูงสุด %s ม.)',
                       p_distance_m, v_elapsed_s, v_max_dist);
  elsif (select count(*) from run_answers
          where run_id = p_run_id and time_taken_ms < 700) >= 3 then
    v_status := 'flagged';
    v_flag   := 'ตอบเร็วผิดปกติ (< 0.7 วิ) หลายข้อ';
  elsif v_elapsed_s < 5 and p_distance_m > 50 then
    v_status := 'flagged';
    v_flag   := 'จบรอบเร็วผิดปกติ';
  end if;

  update runs set
    ended_at       = now(),
    duration_ms    = (v_elapsed_s * 1000)::int,
    distance_m     = greatest(least(p_distance_m, v_max_dist), 0),
    hearts_left    = greatest(least(p_hearts_left, 5), 0),
    correct_count  = v_correct,
    wrong_count    = v_wrong,
    max_combo      = v_combo,
    quiz_score     = v_quiz,
    distance_score = floor(greatest(least(p_distance_m, v_max_dist), 0) * c_pts_per_m)::int,
    bonus_score    = greatest(least(p_hearts_left, 5), 0) * c_heart_bonus
                     + case when p_end_reason = 'victory' then c_victory else 0 end,
    end_reason     = p_end_reason,
    status         = v_status,
    flag_reason    = v_flag
  where id = p_run_id
  returning * into v_run;

  -- อัปเดตสถิติผู้เล่น (นับเฉพาะรอบที่ไม่โดน flag)
  if v_status = 'finished' then
    update players
       set best_score   = greatest(best_score, v_run.total_score),
           runs_count   = runs_count + 1,
           last_seen_at = now()
     where id = v_run.player_id;
  end if;

  return v_run;
end $$;

-- ---------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;

grant execute on function join_class(text, text, text)                 to authenticated;
grant execute on function start_run(text)                              to authenticated;
grant execute on function next_question(uuid, text, smallint)          to authenticated;
grant execute on function answer_question(uuid, uuid, uuid, integer)   to authenticated;
grant execute on function finish_run(uuid, integer, smallint, text)    to authenticated;
