import { useCallback, useEffect, useState } from 'react';
import { api, isOffline } from '@/api';
import { onBus, emitBus } from '@/game/EventBus';
import { PhaserGame } from '@/game/PhaserGame';
import { useGameStore } from '@/store/gameStore';
import { setMuted, stopMusic, unlock } from '@/audio/sfx';
import { releaseWakeLock, requestWakeLock, watchWakeLock } from '@/lib/mobile';

import { LoginScreen } from '@/ui/screens/LoginScreen';
import { HowToPlayScreen } from '@/ui/screens/HowToPlayScreen';
import { CountdownOverlay } from '@/ui/screens/CountdownOverlay';
import { GameOverScreen } from '@/ui/screens/GameOverScreen';
import { LeaderboardScreen } from '@/ui/screens/LeaderboardScreen';
import { RotateGateScreen } from '@/ui/screens/RotateGateScreen';
import { Hud } from '@/ui/hud/Hud';
import { QuizModal } from '@/ui/quiz/QuizModal';
import { TouchControls } from '@/ui/components/TouchControls';
import { RotateNotice } from '@/ui/components/RotateNotice';
import { DebugPanel } from '@/ui/DebugPanel';

const SHOWS_CANVAS = new Set(['countdown', 'playing', 'gameover']);

export default function App() {
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const session = useGameStore((s) => s.session);
  const setSession = useGameStore((s) => s.setSession);
  const runId = useGameStore((s) => s.runId);
  const seed = useGameStore((s) => s.seed);
  const beginRun = useGameStore((s) => s.beginRun);
  const setResult = useGameStore((s) => s.setResult);
  const muted = useGameStore((s) => s.muted);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* --------- จำผู้เล่นเดิมไว้ ไม่ต้องล็อกอินซ้ำ --------- */
  useEffect(() => {
    let cancelled = false;
    void api
      .restoreSession()
      .then((s) => {
        if (!cancelled && s) {
          setSession(s);
          setScreen('howto');
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setSession, setScreen]);

  useEffect(() => setMuted(muted), [muted]);

  /* --------- มือถือ: กันจอดับระหว่างเล่น --------- */
  useEffect(() => {
    if (screen !== 'playing') {
      releaseWakeLock();
      return;
    }
    void requestWakeLock();
    const stopWatching = watchWakeLock();
    return () => {
      stopWatching();
      releaseWakeLock();
    };
  }, [screen]);

  /* --------- มือถือ: ปลุก AudioContext ตอนสลับกลับมาที่แท็บ ---------
     iOS/Android จะ suspend AudioContext เมื่อแอปถูกพักไว้เบื้องหลัง
     ถ้าไม่ resume เกมจะกลับมาแบบเงียบสนิทจนกว่าจะรีโหลด */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') unlock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  /* --------- จบเกม: ส่งข้อมูลดิบให้เซิร์ฟเวอร์คิดคะแนน --------- */
  useEffect(
    () =>
      onBus('game:over', (payload) => {
        const currentRunId = useGameStore.getState().runId;
        if (!currentRunId) return;

        void api
          .finishRun(
            currentRunId,
            payload.distanceM,
            payload.heartsLeft,
            payload.endReason,
            useGameStore.getState().session,
          )
          .then(setResult)
          .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setScreen('gameover'));
      }),
    [setResult, setScreen],
  );

  /* --------- เริ่มรอบใหม่ --------- */
  const startRun = useCallback(async () => {
    unlock(); // ต้องเรียกจาก event ที่ผู้ใช้แตะจริงๆ ไม่งั้น iOS Safari จะเงียบสนิท
    setBusy(true);
    setError(null);
    try {
      const { runId: id, seed: s } = await api.startRun();
      beginRun(id, s);
      setScreen('countdown');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [beginRun, setScreen]);

  const quitToMenu = useCallback(() => {
    stopMusic();
    setScreen('howto');
  }, [setScreen]);

  // callback พวกนี้ต้อง stable — ถ้าสร้างใหม่ทุก render, useEffect ของ CountdownOverlay
  // จะถูก re-run แล้วนับถอยหลังเริ่มใหม่ไม่รู้จบ
  const goPlaying = useCallback(() => setScreen('playing'), [setScreen]);
  // เข้าเกมครั้งแรกต้องผ่านหน้า "หมุนจอเป็นแนวนอน" ก่อน
  const goRotateGate = useCallback(() => setScreen('rotate'), [setScreen]);
  const goLeaderboard = useCallback(() => setScreen('leaderboard'), [setScreen]);
  const goHowto = useCallback(() => setScreen('howto'), [setScreen]);
  const playAgain = useCallback(() => void startRun(), [startRun]);
  const quitRun = useCallback(() => emitBus('game:quit'), []);

  const showCanvas = SHOWS_CANVAS.has(screen) && seed !== null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-night-950">
      {/* ---------- ชั้นเกม ---------- */}
      {showCanvas && <PhaserGame key={runId ?? 'run'} seed={seed} />}

      {/* ---------- ชั้น UI (ข้อความไทยทั้งหมดอยู่ชั้นนี้) ---------- */}
      {screen === 'playing' && (
        <>
          <Hud onQuit={quitRun} />
          <TouchControls />
          <QuizModal />
        </>
      )}

      {screen === 'countdown' && <CountdownOverlay onDone={goPlaying} />}

      {screen === 'rotate' && <RotateGateScreen onReady={playAgain} onBack={goHowto} />}

      {screen === 'login' && <LoginScreen onDone={goHowto} />}

      {screen === 'howto' && (
        <HowToPlayScreen
          busy={busy}
          error={error}
          nickname={session?.nickname ?? ''}
          onStart={goRotateGate}
          onLeaderboard={goLeaderboard}
        />
      )}

      {screen === 'gameover' && (
        <GameOverScreen
          onPlayAgain={playAgain}
          onLeaderboard={goLeaderboard}
          onMenu={quitToMenu}
        />
      )}

      {screen === 'leaderboard' && <LeaderboardScreen onBack={quitToMenu} />}

      {(screen === 'playing' || screen === 'countdown') && <RotateNotice />}
      {import.meta.env.DEV && <DebugPanel />}

      {isOffline && screen !== 'playing' && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-night-800/80 px-4 py-1 text-xs text-dusk-200">
          โหมดออฟไลน์ — คะแนนเก็บในเครื่องนี้เท่านั้น (ยังไม่ได้ตั้งค่า Supabase)
        </div>
      )}
    </div>
  );
}
