/**
 * โหมดออฟไลน์ — ใช้เมื่อยังไม่ได้ตั้งค่า Supabase
 *
 * คำถามอ่านจาก src/data/questions.local.json, คะแนนเก็บใน localStorage
 * มีไว้ 2 เหตุผล:
 *   1. `npm run dev` แล้วเล่นได้เลย ไม่ต้องรอตั้งฐานข้อมูลก่อน
 *   2. เป็นแผนสำรองตอนนำเสนอ ถ้า WiFi โรงเรียนล่ม เกมยังเล่นได้ (แค่ไม่บันทึกคะแนนขึ้นเซิร์ฟเวอร์)
 *
 * ⚠️ โหมดนี้ตรวจคำตอบฝั่ง client จึงโกงได้ง่าย — ห้ามใช้ตัดสินการแข่งขันจริง
 */
import raw from '@/data/questions.local.json';
import { BALANCE } from '@/config/balance';
import { randomSeed } from '@/game/systems/Rng';
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

interface RawQuestion {
  topic: string;
  role: QuestionKind;
  stage?: number;
  ord: number;
  difficulty: Difficulty;
  stem: string;
  choices: string[];
  answer: number;
  explanation: string;
}

const BANK: RawQuestion[] = (raw as { questions: RawQuestion[] }).questions;

const KEY_SESSION = 'daragame.local.session';
const KEY_SCORES = 'daragame.local.scores';

interface LocalScore {
  playerId: string;
  nickname: string;
  className: string | null;
  totalScore: number;
  distanceM: number;
  correctCount: number;
}

interface RunState {
  seed: number;
  startedAt: number;
  asked: Set<string>;
  answers: { points: number; isCorrect: boolean; combo: number }[];
}

const runs = new Map<string, RunState>();

function readScores(): LocalScore[] {
  try {
    return JSON.parse(localStorage.getItem(KEY_SCORES) ?? '[]') as LocalScore[];
  } catch {
    return [];
  }
}

/** id ของคำถามในโหมดออฟไลน์ = ตำแหน่งใน array (เสถียรพอสำหรับรอบการเล่นเดียว) */
const qid = (i: number) => `local-${i}`;
const qIndex = (id: string) => Number(id.replace('local-', ''));

function timeLimitFor(q: RawQuestion): number {
  if (q.role === 'revive') return BALANCE.quiz.reviveTimeLimitS;
  if (q.role === 'final') return BALANCE.quiz.finalTimeLimitS;
  return BALANCE.quiz.timeLimitS[q.difficulty];
}

export const localApi = {
  async login(nickname: string, className: string | null): Promise<Session> {
    const session: Session = {
      playerId: `local-${nickname.toLowerCase()}`,
      nickname,
      classId: null,
      className,
      offline: true,
    };
    localStorage.setItem(KEY_SESSION, JSON.stringify(session));
    return session;
  },

  restoreSession(): Session | null {
    try {
      const raw = localStorage.getItem(KEY_SESSION);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },

  async startRun(): Promise<StartRunResult> {
    const runId = `run-${Date.now()}`;
    runs.set(runId, { seed: randomSeed(), startedAt: Date.now(), asked: new Set(), answers: [] });
    return { runId, seed: runs.get(runId)!.seed };
  },

  async nextQuestion(runId: string, req: QuestionRequest): Promise<PublicQuestion | null> {
    const state = runs.get(runId);
    const matches = ({ q }: { q: RawQuestion }) =>
      q.role === req.kind && (req.kind !== 'main' || q.stage === req.stage);

    const indexed = BANK.map((q, i) => ({ q, i }));
    const fresh = indexed.filter((e) => matches(e) && !state?.asked.has(qid(e.i)));
    // ถามครบทุกข้อของหมวดนี้แล้ว -> ยอมถามซ้ำ ดีกว่าข้าม checkpoint ไปเฉยๆ
    const source = fresh.length ? fresh : indexed.filter(matches);
    if (!source.length) return null;

    // เรียงตาม ord เพื่อให้เจอคำถามในด่านตามลำดับที่ออกแบบไว้
    const { q, i } = source.sort((a, b) => a.q.ord - b.q.ord)[0];
    state?.asked.add(qid(i));

    return {
      id: qid(i),
      topicSlug: q.topic,
      kind: q.role,
      stage: q.stage ?? null,
      difficulty: q.difficulty,
      stem: q.stem,
      imageUrl: null,
      timeLimitS: timeLimitFor(q),
      choices: q.choices.map((content, ci) => ({ id: `${qid(i)}-${ci}`, content })),
    };
  },

  async answerQuestion(
    runId: string,
    questionId: string,
    choiceId: string | null,
    timeMs: number,
  ): Promise<AnswerResult> {
    const q = BANK[qIndex(questionId)];
    const correctChoiceId = `${questionId}-${q.answer}`;
    const isCorrect = choiceId === correctChoiceId;

    const state = runs.get(runId);
    let combo = 0;
    if (state) {
      for (let i = state.answers.length - 1; i >= 0; i--) {
        if (!state.answers[i].isCorrect) break;
        combo++;
      }
    }

    let points = 0;
    let speedBonus = 0;
    if (isCorrect) {
      combo += 1;
      const { base, comboStep, comboMax, fastBonusFull, fastBonusHalf, fastFullRatio, fastHalfRatio } =
        BALANCE.score;
      const limitMs = timeLimitFor(q) * 1000;
      if (timeMs <= limitMs * fastFullRatio) speedBonus = fastBonusFull;
      else if (timeMs <= limitMs * fastHalfRatio) speedBonus = fastBonusHalf;
      const mult = Math.min(1 + comboStep * Math.max(combo - 1, 0), comboMax);
      points = Math.round(base[q.difficulty] * mult) + speedBonus;
    } else {
      combo = 0;
    }

    state?.answers.push({ points, isCorrect, combo });

    return {
      isCorrect,
      correctChoiceId,
      explanation: q.explanation,
      points,
      speedBonus,
      combo,
    };
  },

  async finishRun(
    runId: string,
    distanceM: number,
    heartsLeft: number,
    endReason: string,
    session: Session | null,
  ): Promise<FinishRunResult> {
    const victory = endReason === 'victory';
    const state = runs.get(runId);
    const answers = state?.answers ?? [];
    const quizScore = answers.reduce((s, a) => s + a.points, 0);
    // ปัดลงให้เป็นจำนวนเต็ม — ต้องตรงกับ floor(...)::int ใน db/03_rpc.sql
    // ไม่งั้นโหมดออฟไลน์จะโชว์คะแนนมีทศนิยม (เช่น 239.5) ส่วนออนไลน์เป็นจำนวนเต็ม
    const distanceScore = Math.floor(
      Math.max(0, Math.round(distanceM)) * BALANCE.score.pointsPerMeter,
    );
    const bonusScore =
      heartsLeft * BALANCE.score.heartBonus + (victory ? BALANCE.score.victoryBonus : 0);

    const result: FinishRunResult = {
      victory,
      totalScore: quizScore + distanceScore + bonusScore,
      quizScore,
      distanceScore,
      bonusScore,
      distanceM: Math.round(distanceM),
      heartsLeft,
      correctCount: answers.filter((a) => a.isCorrect).length,
      wrongCount: answers.filter((a) => !a.isCorrect).length,
      maxCombo: answers.reduce((m, a) => Math.max(m, a.combo), 0),
      status: 'finished',
    };

    if (session) {
      const scores = readScores();
      scores.push({
        playerId: session.playerId,
        nickname: session.nickname,
        className: session.className,
        totalScore: result.totalScore,
        distanceM: result.distanceM,
        correctCount: result.correctCount,
      });
      localStorage.setItem(KEY_SCORES, JSON.stringify(scores.slice(-500)));
    }

    runs.delete(runId);
    return result;
  },

  async leaderboard(limit = 20): Promise<LeaderboardRow[]> {
    const best = new Map<string, LocalScore>();
    for (const s of readScores()) {
      const cur = best.get(s.playerId);
      if (!cur || s.totalScore > cur.totalScore) best.set(s.playerId, s);
    }
    return [...best.values()]
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, limit)
      .map((s, i) => ({ rank: i + 1, ...s }));
  },
};
