/** ชนิดข้อมูลที่ใช้ร่วมกันระหว่าง React, Phaser และ API layer */

export type Difficulty = 'easy' | 'medium' | 'hard';

export type EndReason = 'wall' | 'hearts' | 'quit' | 'timeout' | 'victory';

/** บทบาทของคำถามในเกม */
export type QuestionKind =
  /** คำถามประจำ checkpoint ในด่าน 1-3 */
  | 'main'
  /** คำถามตอนตาย — ตอบถูกได้ฟื้นกลับมาเล่นต่อ */
  | 'revive'
  /** บอสสุดท้าย — ตอบถูก = ชนะเกม */
  | 'final';

export type Screen =
  | 'login'
  | 'howto'
  | 'rotate'
  | 'countdown'
  | 'playing'
  | 'gameover'
  | 'leaderboard'
  | 'teacher';

export interface TeacherClass {
  id: string;
  joinCode: string;
  name: string;
  isOpen: boolean;
  levelSeed: number | null;
  /** ลิงก์ไฟล์เพลงพื้นหลัง (mp3/ogg โหลดตรงได้) ที่ครูตั้งให้ห้องนี้ — null = ใช้เพลงสังเคราะห์เดิม */
  musicUrl: string | null;
  createdAt: string;
  studentCount?: number;
}

export interface StudentProgress {
  playerId: string;
  nickname: string;
  classId: string | null;
  runsPlayed: number;
  bestScore: number;
  totalCorrect: number;
  totalWrong: number;
  pctCorrect: number | null;
  bestDistanceM: number;
  lastPlayedAt: string | null;
}

export interface QuestionStat {
  id: string;
  stem: string;
  difficulty: Difficulty;
  topic: string;
  attempts: number;
  correctCount: number;
  pctCorrect: number | null;
  avgMs: number | null;
}


/** ผู้เล่นที่ล็อกอินอยู่ */
export interface Session {
  playerId: string;
  nickname: string;
  classId: string | null;
  className: string | null;
  /** เพลงพื้นหลังที่ครูตั้งให้ห้องนี้ — null = ใช้เพลงสังเคราะห์เดิมของเกม */
  musicUrl: string | null;
  /** true = เล่นแบบไม่ต่อ backend (คะแนนเก็บใน localStorage เท่านั้น) */
  offline: boolean;
}

export interface Choice {
  id: string;
  content: string;
}

/** คำถามเวอร์ชันที่ client เห็นได้ — ไม่มีเฉลย ไม่มีคำอธิบาย */
export interface PublicQuestion {
  id: string;
  topicSlug: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  stage: number | null;
  stem: string;
  imageUrl: string | null;
  timeLimitS: number;
  choices: Choice[];
}

/** ผลการตรวจคำตอบ — มาจากเซิร์ฟเวอร์เท่านั้น */
export interface AnswerResult {
  isCorrect: boolean;
  correctChoiceId: string;
  explanation: string;
  points: number;
  speedBonus: number;
  combo: number;
}

/** สิ่งที่ client ขอเวลาต้องการคำถามถัดไป */
export interface QuestionRequest {
  kind: QuestionKind;
  /** 1-3 เมื่อ kind === 'main' (ไม่ใช้เมื่อเป็น revive/final) */
  stage: number;
}

export interface StartRunResult {
  runId: string;
  seed: number;
}

export interface FinishRunResult {
  totalScore: number;
  victory: boolean;
  quizScore: number;
  distanceScore: number;
  bonusScore: number;
  distanceM: number;
  heartsLeft: number;
  correctCount: number;
  wrongCount: number;
  maxCombo: number;
  status: 'finished' | 'flagged';
}

export interface LeaderboardRow {
  rank: number;
  playerId: string;
  nickname: string;
  className: string | null;
  totalScore: number;
  distanceM: number;
  correctCount: number;
}

/** บันทึกไว้โชว์หน้าสรุป "ข้อไหนพลาด" — เก็บฝั่ง client เพื่อไม่ต้อง query เพิ่ม */
export interface AnsweredLog {
  stem: string;
  chosen: string | null;
  correct: string;
  explanation: string;
  isCorrect: boolean;
}

/* ------------------------------------------------------------------ */
/* Event payloads — สัญญาระหว่าง React กับ Phaser (docs/01-tech-stack.md §3) */
/* ------------------------------------------------------------------ */

export interface HudState {
  hearts: number;
  stage: number;
  /** ตอบคำถามในด่านนี้ไปแล้วกี่ข้อ */
  stageProgress: number;
  /** เหลือสิทธิ์ฟื้นกี่ครั้ง */
  revivesLeft: number;
  distanceM: number;
  /** ระยะห่างจากกำแพงเป็น px (ยิ่งน้อยยิ่งอันตราย) */
  wallGapPx: number;
  combo: number;
  chaseStarted: boolean;
}

export interface QuizOpenPayload {
  kind: QuestionKind;
  /** 1-3 เมื่อ kind === 'main' */
  stage: number;
}

export interface QuizAnsweredPayload {
  isCorrect: boolean;
  kind: QuestionKind;
  /** คะแนนที่ได้จากข้อนี้ (0 ถ้าตอบผิด) — เกมเอาไปโชว์เป็นตัวเลขลอยขึ้น */
  points: number;
}

export interface StageChangedPayload {
  stage: number;
  name: string;
}

export interface GameOverPayload {
  distanceM: number;
  heartsLeft: number;
  durationMs: number;
  endReason: EndReason;
}
