import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { BALANCE, STAGE_COUNT } from '@/config/balance';
import { emitBus, onBus } from '@/game/EventBus';
import { useGameStore } from '@/store/gameStore';
import { sfx } from '@/audio/sfx';
import type { AnswerResult, PublicQuestion, QuestionKind } from '@/types/game';

type Phase = 'idle' | 'loading' | 'asking' | 'revealing';

const DIFFICULTY_LABEL = {
  easy: { text: 'ง่าย', color: 'text-leaf-400', dot: 'bg-leaf-400' },
  medium: { text: 'ปานกลาง', color: 'text-dusk-200', dot: 'bg-dusk-300' },
  hard: { text: 'ยาก', color: 'text-lava-400', dot: 'bg-lava-500' },
} as const;

/** หน้าตาป๊อปอัปเปลี่ยนตามประเภทคำถาม เพื่อให้ผู้เล่นรู้ทันทีว่าเดิมพันคืออะไร */
const KIND_STYLE: Record<
  QuestionKind,
  { ring: string; badge: string; title: (stage: number) => string; sub: string }
> = {
  main: {
    ring: '',
    badge: 'bg-white/10 text-dusk-100',
    title: (stage) => `ด่าน ${stage} จาก ${STAGE_COUNT}`,
    sub: 'ตอบถูก = ได้คะแนน และดันกำแพงให้ถอยห่าง',
  },
  revive: {
    ring: 'ring-2 ring-lava-500/70',
    badge: 'bg-lava-600/30 text-lava-400',
    title: () => '💀 โอกาสสุดท้าย!',
    sub: 'ตอบถูกเพื่อฟื้นกลับไปที่จุดตรวจล่าสุด — ตอบผิดคือจบเกม',
  },
  final: {
    ring: 'ring-2 ring-dusk-300/70',
    badge: 'bg-dusk-300/25 text-dusk-100',
    title: () => '👑 คำถามสุดท้าย',
    sub: 'ตอบถูก = ชนะเกม! ตอบผิด กำแพงจะพุ่งเข้ามา แล้วเจอกันใหม่ที่จุดตรวจถัดไป',
  },
};

export function QuizModal() {
  const runId = useGameStore((s) => s.runId);
  const addQuizScore = useGameStore((s) => s.addQuizScore);
  const logAnswer = useGameStore((s) => s.logAnswer);

  const [phase, setPhase] = useState<Phase>('idle');
  const [kind, setKind] = useState<QuestionKind>('main');
  const [stage, setStage] = useState(1);
  const [question, setQuestion] = useState<PublicQuestion | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const [failure, setFailure] = useState<string | null>(null);

  const askedAtRef = useRef(0);
  const questionRef = useRef<PublicQuestion | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const kindRef = useRef<QuestionKind>('main');
  const runIdRef = useRef<string | null>(null);

  phaseRef.current = phase;
  questionRef.current = question;
  kindRef.current = kind;

  /**
   * id ของรอบที่ใช้จริง
   *
   * ⚠️ ต้องเป็นค่าเดียวกันทั้งตอน "ขอคำถาม" และตอน "ส่งคำตอบ"
   *    เดิมสองที่ไม่ตรงกัน: ตอนขอคำถามยอมใช้ 'fallback-run' ถ้า runId ว่าง
   *    แต่ตอนส่งคำตอบดัน `if (!runId) return;` — ผลคือคำถามขึ้นมาให้ตอบได้
   *    แต่กดแล้วเงียบสนิท ไม่มีคะแนน ไม่มีเฉลย และไม่มีอะไรฟ้องเลยสักอย่าง
   */
  const activeRunId = runId || 'fallback-run';
  runIdRef.current = activeRunId;

  /** ปิด popup แล้วปล่อยให้เกมเดินต่อ */
  const close = useCallback((isCorrect: boolean, points = 0) => {
    setPhase('idle');
    setQuestion(null);
    setResult(null);
    setChosenId(null);
    setFailure(null);
    emitBus('quiz:answered', { isCorrect, kind: kindRef.current, points });
  }, []);

  const submit = useCallback(
    async (choiceId: string | null) => {
      const q = questionRef.current;
      if (!q || phaseRef.current !== 'asking') return;

      setChosenId(choiceId);
      setPhase('revealing');

      const timeMs = Math.max(0, Date.now() - askedAtRef.current);
      try {
        // ⚠️ เซิร์ฟเวอร์เป็นคนบอกว่าถูกหรือผิด ไม่ใช่ฝั่งนี้
        //    เฉลยไม่เคยถูกส่งมาก่อนตอบ (view public_questions ไม่มีคอลัมน์ is_correct)
        const res = await api.answerQuestion(runIdRef.current!, q.id, choiceId, timeMs);
        setResult(res);
        if (res.isCorrect) {
          addQuizScore(res.points);
          sfx.correct();
        } else {
          sfx.wrong();
        }

        logAnswer({
          stem: q.stem,
          chosen: q.choices.find((c) => c.id === choiceId)?.content ?? null,
          correct: q.choices.find((c) => c.id === res.correctChoiceId)?.content ?? '—',
          explanation: res.explanation,
          isCorrect: res.isCorrect,
        });

        // คำถามฟื้น/บอส เดิมพันสูง ให้เวลาอ่านเฉลยนานขึ้น
        const holdMs =
          kindRef.current === 'main' ? BALANCE.quiz.revealMs : BALANCE.quiz.revealMs + 1400;
        window.setTimeout(() => close(res.isCorrect, res.points), holdMs);
      } catch (err) {
        // ตรวจคำตอบไม่สำเร็จ (เน็ตหลุด / RPC บนเซิร์ฟเวอร์ไม่ตรงกับที่โค้ดเรียก)
        //
        // ⚠️ เดิมตรงนี้เรียก close(false) เงียบๆ — ป๊อปอัปหายวับ ไม่มีคะแนน ไม่มีเฉลย
        //    ผู้เล่นเห็นแค่ "กดแล้วไม่มีอะไรเกิดขึ้น" และเราก็ไม่รู้ว่าพังเพราะอะไร
        //    ความล้มเหลวที่เงียบคือความล้มเหลวที่แก้ไม่ได้ จึงต้องโชว์ให้เห็น
        const message = err instanceof Error ? err.message : String(err);
        console.error('[quiz] ตรวจคำตอบไม่สำเร็จ:', err);
        setFailure(message);
        sfx.wrong();
        window.setTimeout(() => close(false), 3200);
      }
    },
    [addQuizScore, logAnswer, close],
  );

  /* ---------- เปิดคำถามเมื่อถึง checkpoint หรือตอนตาย ---------- */
  useEffect(
    () =>
      onBus('quiz:open', (payload) => {
        setKind(payload.kind);
        kindRef.current = payload.kind;
        setStage(payload.stage);
        setPhase('loading');
        setResult(null);
        setChosenId(null);
        setFailure(null);

        void api
          .nextQuestion(runIdRef.current!, { kind: payload.kind, stage: payload.stage })
          .then((q) => {
            if (q) {
              setQuestion(q);
              setRemainingMs(q.timeLimitS * 1000);
              askedAtRef.current = Date.now();
              setPhase('asking');
            } else {
              // คลังคำถามหมวดนี้ว่าง — บอกให้รู้ ไม่ใช่ปิดเงียบๆ
              console.warn('[quiz] ไม่มีคำถามสำหรับ', payload);
              close(payload.kind === 'revive');
            }
          })
          .catch((err: unknown) => {
            console.error('[quiz] ดึงคำถามไม่สำเร็จ:', err);
            setFailure(err instanceof Error ? err.message : String(err));
            window.setTimeout(() => close(payload.kind === 'revive'), 3200);
          });
      }),
    [close],
  );


  /* ---------- จับเวลา ---------- */
  useEffect(() => {
    if (phase !== 'asking' || !question) return;

    const limitMs = question.timeLimitS * 1000;
    const timer = window.setInterval(() => {
      const left = limitMs - (Date.now() - askedAtRef.current);
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        window.clearInterval(timer);
        void submit(null); // หมดเวลา = เหมือนตอบผิด แต่ไม่เสียหัวใจ
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [phase, question, submit]);

  /* ---------- ตอบด้วยแป้น 1-4 ---------- */
  useEffect(() => {
    if (phase !== 'asking' || !question) return;
    const onKey = (e: KeyboardEvent) => {
      const index = Number(e.key) - 1;
      if (index >= 0 && index < question.choices.length) {
        void submit(question.choices[index].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, question, submit]);

  if (phase === 'idle') return null;

  const style = KIND_STYLE[kind];

  return (
    <div className="safe-inset absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-night-950/75 backdrop-blur-[2px]">
      <div
        className={`animate-pop-in panel quiz-panel w-full max-w-3xl rounded-3xl p-5 sm:p-7 ${style.ring}`}
      >
        {phase === 'loading' && !failure && (
          <p className="py-10 text-center text-dusk-200">กำลังเปิดคำถาม…</p>
        )}

        {/* ความล้มเหลวต้องมองเห็นได้ ไม่ใช่ปิดป๊อปอัปหนีเงียบๆ
            ไม่งั้นผู้เล่นเห็นแค่ "กดแล้วไม่มีอะไรเกิดขึ้น" แล้วเราก็ไล่บั๊กไม่ถูก */}
        {failure && (
          <div className="rounded-2xl border border-lava-500/50 bg-lava-600/15 p-4 text-center">
            <p className="font-display mb-1 font-semibold text-lava-400">
              ⚠️ ตรวจคำตอบไม่สำเร็จ
            </p>
            <p className="mb-2 text-sm text-white/75">
              ต่อกับเซิร์ฟเวอร์ไม่ได้ ข้อนี้เลยยังไม่ได้คะแนน — เกมจะไปต่อให้เอง
            </p>
            <p className="tabular text-[11px] break-words text-white/40">{failure}</p>
          </div>
        )}

        {question && phase !== 'loading' && !failure && (
          <>
            <QuizHeader
              question={question}
              kind={kind}
              stage={stage}
              remainingMs={remainingMs}
              frozen={phase === 'revealing'}
            />

            <h3 className="font-display quiz-stem mt-4 mb-5 text-xl leading-relaxed font-semibold text-white sm:text-2xl">
              {question.stem}
            </h3>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {question.choices.map((choice, i) => (
                <ChoiceButton
                  key={choice.id}
                  index={i}
                  label={choice.content}
                  disabled={phase === 'revealing'}
                  state={
                    !result
                      ? 'default'
                      : choice.id === result.correctChoiceId
                        ? 'correct'
                        : choice.id === chosenId
                          ? 'wrong'
                          : 'dim'
                  }
                  onClick={() => void submit(choice.id)}
                />
              ))}
            </div>

            {result && <Explanation result={result} kind={kind} timedOut={chosenId === null} />}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuizHeader({
  question,
  kind,
  stage,
  remainingMs,
  frozen,
}: {
  question: PublicQuestion;
  kind: QuestionKind;
  stage: number;
  remainingMs: number;
  frozen: boolean;
}) {
  const limitMs = question.timeLimitS * 1000;
  const ratio = frozen ? 0 : Math.max(0, Math.min(1, remainingMs / limitMs));
  const seconds = Math.ceil(remainingMs / 1000);
  const meta = DIFFICULTY_LABEL[question.difficulty];
  const style = KIND_STYLE[kind];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${style.badge}`}>
            {style.title(stage)}
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.color}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            ระดับ{meta.text}
          </span>
        </div>
        <span
          className={`tabular text-lg font-semibold ${
            ratio < 0.3 && !frozen ? 'text-lava-400' : 'text-white/70'
          }`}
        >
          ⏱ {frozen ? '—' : `${seconds} วิ`}
        </span>
      </div>

      <p className="mt-1 text-xs text-white/45">{style.sub}</p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-100 ease-linear"
          style={{
            width: `${ratio * 100}%`,
            background:
              ratio < 0.3
                ? 'linear-gradient(90deg,#ff6b3d,#e14a2b)'
                : 'linear-gradient(90deg,#9bd17b,#ffc79a)',
          }}
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  index,
  label,
  state,
  disabled,
  onClick,
}: {
  index: number;
  label: string;
  state: 'default' | 'correct' | 'wrong' | 'dim';
  disabled: boolean;
  onClick: () => void;
}) {
  // ⚠️ ห้ามสื่อ ถูก/ผิด ด้วยสีเขียว-แดงอย่างเดียว — ตาบอดสีแดง-เขียวพบราว 8% ในเด็กผู้ชาย
  //    จึงมีทั้งไอคอน ✓/✗ และเส้นขอบหนาเป็นสัญญาณสำรอง
  const style = {
    default: 'border-white/15 bg-white/5 hover:bg-white/12 text-white',
    correct: 'border-leaf-500 bg-leaf-600/25 text-white ring-2 ring-leaf-500',
    wrong: 'border-lava-500 bg-lava-600/25 text-white ring-2 ring-lava-500',
    dim: 'border-white/10 bg-white/5 text-white/40',
  }[state];

  const mark = state === 'correct' ? '✓' : state === 'wrong' ? '✗' : index + 1;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`quiz-choice flex min-h-[56px] items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors ${style}`}
    >
      <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-night-900/70 text-sm font-bold">
        {mark}
      </span>
      <span className="text-[15px] leading-relaxed">{label}</span>
    </button>
  );
}

function Explanation({
  result,
  kind,
  timedOut,
}: {
  result: AnswerResult;
  kind: QuestionKind;
  timedOut: boolean;
}) {
  const headline = result.isCorrect
    ? kind === 'revive'
      ? '❤️ ฟื้นแล้ว! กลับไปวิ่งต่อ'
      : kind === 'final'
        ? '👑 ชนะแล้ว! เอาชนะกำแพงได้สำเร็จ'
        : '✓ ถูกต้อง!'
    : timedOut
      ? '⏱ หมดเวลา'
      : '✗ ยังไม่ถูก';

  return (
    <div
      className={`animate-pop-in quiz-explain mt-4 rounded-2xl border p-4 ${
        result.isCorrect
          ? 'border-leaf-500/40 bg-leaf-600/12'
          : 'border-dusk-300/35 bg-dusk-400/10'
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="font-display font-semibold text-white">{headline}</span>
        {result.isCorrect && (
          <>
            <span className="tabular rounded-full bg-leaf-600/30 px-2.5 py-0.5 text-sm font-semibold text-leaf-400">
              +{result.points}
            </span>
            {result.speedBonus > 0 && (
              <span className="rounded-full bg-dusk-300/20 px-2.5 py-0.5 text-xs text-dusk-200">
                ⚡ ตอบไว +{result.speedBonus}
              </span>
            )}
            {result.combo >= 2 && (
              <span className="rounded-full bg-cosmic/20 px-2.5 py-0.5 text-xs text-cosmic">
                🔥 คอมโบ {result.combo}
              </span>
            )}
          </>
        )}
      </div>
      <p className="text-sm leading-relaxed text-white/80">{result.explanation}</p>
    </div>
  );
}
