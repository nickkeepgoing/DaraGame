import { create } from 'zustand';
import { BALANCE } from '@/config/balance';
import type {
  AnsweredLog,
  FinishRunResult,
  HudState,
  Screen,
  Session,
} from '@/types/game';

interface GameStore {
  screen: Screen;
  session: Session | null;

  /** รอบการเล่นปัจจุบัน */
  runId: string | null;
  seed: number | null;

  hud: HudState;
  /** คะแนนควิซสะสมระหว่างเล่น (โชว์บน HUD — ตัวเลขจริงมาจากเซิร์ฟเวอร์ตอนจบ) */
  quizScore: number;
  /** บันทึกไว้โชว์หน้าสรุปว่าพลาดข้อไหน */
  answerLog: AnsweredLog[];

  result: FinishRunResult | null;
  muted: boolean;

  setScreen: (screen: Screen) => void;
  setSession: (session: Session | null) => void;
  beginRun: (runId: string, seed: number) => void;
  setHud: (hud: HudState) => void;
  addQuizScore: (points: number) => void;
  logAnswer: (entry: AnsweredLog) => void;
  setResult: (result: FinishRunResult | null) => void;
  toggleMute: () => void;
}

const emptyHud: HudState = {
  hearts: BALANCE.player.hearts,
  stage: 1,
  stageProgress: 0,
  revivesLeft: BALANCE.player.maxRevives,
  distanceM: 0,
  wallGapPx: BALANCE.wall.startGapPx,
  combo: 0,
  chaseStarted: false,
};

export const useGameStore = create<GameStore>((set) => ({
  screen: 'login',
  session: null,
  runId: null,
  seed: null,
  hud: emptyHud,
  quizScore: 0,
  answerLog: [],
  result: null,
  muted: false,

  setScreen: (screen) => set({ screen }),
  setSession: (session) => set({ session }),

  beginRun: (runId, seed) =>
    set({ runId, seed, hud: emptyHud, quizScore: 0, answerLog: [], result: null }),

  setHud: (hud) => set({ hud }),
  addQuizScore: (points) => set((s) => ({ quizScore: s.quizScore + points })),
  logAnswer: (entry) => set((s) => ({ answerLog: [...s.answerLog, entry] })),
  setResult: (result) => set({ result }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}));
