/**
 * โหมดต่อ Supabase จริง
 *
 * หลักการ: client ส่งได้แค่ "ข้อมูลดิบ" (ตอบข้อไหน / วิ่งไปกี่เมตร)
 *          คะแนนคำนวณที่เซิร์ฟเวอร์ทั้งหมด ผ่าน RPC ใน db/03_rpc.sql
 */
import { supabase, ensureAnonymousAuth } from '@/lib/supabase';
import { localApi } from './local';
import type {

  AnswerResult,
  Difficulty,
  FinishRunResult,
  LeaderboardRow,
  PublicQuestion,
  QuestionKind,
  QuestionRequest,
  Session,
  StartRunResult,
} from '@/types/game';

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'dev';

function client() {
  if (!supabase) throw new Error('ยังไม่ได้ตั้งค่า Supabase');
  return supabase;
}

/** แถวที่ view public_questions คืนมา */
interface QuestionRow {
  id: string;
  topic_slug: string;
  role: QuestionKind;
  stage: number | null;
  difficulty: Difficulty;
  stem: string;
  image_url: string | null;
  time_limit_s: number;
  choices: { id: string; content: string }[] | null;
}

interface PlayerRow {
  id: string;
  nickname: string;
  class_id: string | null;
}

function toQuestion(row: QuestionRow): PublicQuestion {
  return {
    id: row.id,
    topicSlug: row.topic_slug,
    kind: row.role,
    stage: row.stage,
    difficulty: row.difficulty,
    stem: row.stem,
    imageUrl: row.image_url,
    timeLimitS: row.time_limit_s,
    choices: row.choices ?? [],
  };
}

export const remoteApi = {
  async login(nickname: string, joinCode: string): Promise<Session> {
    await ensureAnonymousAuth();

    const { data, error } = await client().rpc('join_class', {
      p_join_code: joinCode,
      p_nickname: nickname,
    });
    if (error) throw new Error(error.message);

    const player = data as PlayerRow;
    const { data: cls } = await client()
      .from('classes')
      .select('name')
      .eq('id', player.class_id ?? '')
      .maybeSingle();

    return {
      playerId: player.id,
      nickname: player.nickname,
      classId: player.class_id,
      className: (cls as { name: string } | null)?.name ?? null,
      offline: false,
    };
  },

  /** เปิดเบราว์เซอร์เดิม = เป็นคนเดิมอัตโนมัติ ไม่ต้องล็อกอินซ้ำ */
  async restoreSession(): Promise<Session | null> {
    const { data: sess } = await client().auth.getSession();
    if (!sess.session) return null;

    const { data, error } = await client()
      .from('players')
      .select('id, nickname, class_id, classes(name)')
      .eq('auth_uid', sess.session.user.id)
      .maybeSingle();
    if (error || !data) return null;

    const row = data as unknown as PlayerRow & { classes: { name: string } | null };
    return {
      playerId: row.id,
      nickname: row.nickname,
      classId: row.class_id,
      className: row.classes?.name ?? null,
      offline: false,
    };
  },

  async startRun(): Promise<StartRunResult> {
    const { data, error } = await client().rpc('start_run', { p_client_version: APP_VERSION });
    if (error) throw new Error(error.message);

    const row = (Array.isArray(data) ? data[0] : data) as { run_id: string; seed: number };
    return { runId: row.run_id, seed: Number(row.seed) };
  },

  async nextQuestion(runId: string, req: QuestionRequest): Promise<PublicQuestion | null> {
    try {
      const { data, error } = await client().rpc('next_question', {
        p_run_id: runId,
        p_kind: req.kind,
        p_stage: req.kind === 'main' ? req.stage : null,
      });
      if (!error && data && (data as QuestionRow[]).length > 0) {
        return toQuestion((data as QuestionRow[])[0]);
      }
    } catch {
      /* Fallback if Supabase database has no imported questions or RPC error */
    }
    return localApi.nextQuestion(runId, req);
  },


  async answerQuestion(
    runId: string,
    questionId: string,
    choiceId: string | null,
    timeMs: number,
  ): Promise<AnswerResult> {
    const { data, error } = await client().rpc('answer_question', {
      p_run_id: runId,
      p_question_id: questionId,
      p_choice_id: choiceId,
      p_time_ms: Math.round(timeMs),
    });
    if (error) throw new Error(error.message);

    const r = data as {
      is_correct: boolean;
      correct_choice_id: string;
      explanation: string;
      points: number;
      speed_bonus: number;
      combo: number;
    };
    return {
      isCorrect: r.is_correct,
      correctChoiceId: r.correct_choice_id,
      explanation: r.explanation,
      points: r.points,
      speedBonus: r.speed_bonus,
      combo: r.combo,
    };
  },

  async finishRun(
    runId: string,
    distanceM: number,
    heartsLeft: number,
    endReason: string,
  ): Promise<FinishRunResult> {
    const { data, error } = await client().rpc('finish_run', {
      p_run_id: runId,
      p_distance_m: Math.max(0, Math.round(distanceM)),
      p_hearts_left: heartsLeft,
      p_end_reason: endReason,
    });
    if (error) throw new Error(error.message);

    const r = (Array.isArray(data) ? data[0] : data) as {
      total_score: number;
      quiz_score: number;
      distance_score: number;
      bonus_score: number;
      distance_m: number;
      hearts_left: number;
      correct_count: number;
      wrong_count: number;
      max_combo: number;
      status: 'finished' | 'flagged';
      end_reason: string;
    };

    return {
      victory: r.end_reason === 'victory',
      totalScore: r.total_score,
      quizScore: r.quiz_score,
      distanceScore: r.distance_score,
      bonusScore: r.bonus_score,
      distanceM: r.distance_m,
      heartsLeft: r.hearts_left,
      correctCount: r.correct_count,
      wrongCount: r.wrong_count,
      maxCombo: r.max_combo,
      status: r.status,
    };
  },

  async leaderboard(limit = 20, classId?: string | null): Promise<LeaderboardRow[]> {
    let query = client()
      .from('leaderboard_alltime')
      .select('player_id, nickname, class_name, total_score, distance_m, correct_count')
      .order('total_score', { ascending: false })
      .limit(limit);

    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as {
      player_id: string;
      nickname: string;
      class_name: string | null;
      total_score: number;
      distance_m: number;
      correct_count: number;
    }[]).map((r, i) => ({
      rank: i + 1,
      playerId: r.player_id,
      nickname: r.nickname,
      className: r.class_name,
      totalScore: r.total_score,
      distanceM: r.distance_m,
      correctCount: r.correct_count,
    }));
  },

  /* ---------------- Teacher Operations (Supabase Mode) ---------------- */
  async getTeacherClasses(): Promise<import('@/types/game').TeacherClass[]> {
    const { data, error } = await client()
      .from('classes')
      .select('id, join_code, name, is_open, level_seed, created_at, players(count)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      joinCode: row.join_code,
      name: row.name,
      isOpen: row.is_open,
      levelSeed: row.level_seed ? Number(row.level_seed) : null,
      createdAt: row.created_at,
      studentCount: row.players?.[0]?.count ?? 0,
    }));
  },

  async createClass(
    name: string,
    joinCode: string,
    levelSeed?: number | null,
  ): Promise<import('@/types/game').TeacherClass> {
    const { data, error } = await client().rpc('teacher_create_class', {
      p_name: name,
      p_join_code: joinCode,
      p_level_seed: levelSeed ?? null,
    });
    if (error) throw new Error(error.message);

    const row = data as any;
    return {
      id: row.id,
      joinCode: row.join_code,
      name: row.name,
      isOpen: row.is_open,
      levelSeed: row.level_seed ? Number(row.level_seed) : null,
      createdAt: row.created_at,
    };
  },

  async updateClass(
    classId: string,
    isOpen: boolean,
    levelSeed?: number | null,
  ): Promise<import('@/types/game').TeacherClass> {
    const { data, error } = await client().rpc('teacher_update_class', {
      p_class_id: classId,
      p_is_open: isOpen,
      p_level_seed: levelSeed ?? null,
    });
    if (error) throw new Error(error.message);

    const row = data as any;
    return {
      id: row.id,
      joinCode: row.join_code,
      name: row.name,
      isOpen: row.is_open,
      levelSeed: row.level_seed ? Number(row.level_seed) : null,
      createdAt: row.created_at,
    };
  },

  async getStudentProgress(classId?: string | null): Promise<import('@/types/game').StudentProgress[]> {
    let query = client().from('player_progress').select('*');
    if (classId) query = query.eq('class_id', classId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      playerId: row.player_id,
      nickname: row.nickname,
      classId: row.class_id,
      runsPlayed: Number(row.runs_played ?? 0),
      bestScore: Number(row.best_score ?? 0),
      totalCorrect: Number(row.total_correct ?? 0),
      totalWrong: Number(row.total_wrong ?? 0),
      pctCorrect: row.pct_correct !== null ? Number(row.pct_correct) : null,
      bestDistanceM: Number(row.best_distance_m ?? 0),
      lastPlayedAt: row.last_played_at,
    }));
  },

  async getQuestionStats(): Promise<import('@/types/game').QuestionStat[]> {
    const { data, error } = await client()
      .from('question_stats')
      .select('*')
      .order('pct_correct', { ascending: true, nullsFirst: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      stem: row.stem,
      difficulty: row.difficulty,
      topic: row.topic,
      attempts: Number(row.attempts ?? 0),
      correctCount: Number(row.correct_count ?? 0),
      pctCorrect: row.pct_correct !== null ? Number(row.pct_correct) : null,
      avgMs: row.avg_ms !== null ? Number(row.avg_ms) : null,
    }));
  },
};

