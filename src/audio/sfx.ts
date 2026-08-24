/**
 * เสียงทั้งหมดสังเคราะห์สดด้วย Web Audio — ไม่มีไฟล์เสียงให้โหลดเลย
 *
 * ทำแบบนี้เพราะ:
 *   • ไม่ต้องหาไฟล์เสียงที่ลิขสิทธิ์ถูกต้องตั้งแต่วันแรก (ดู docs/03-decisions.md ข้อ 6)
 *   • ไม่กินงบโหลด 4 MB ที่ตั้งไว้
 *   • เปลี่ยนเป็นไฟล์จริงทีหลังได้ โดยแก้แค่ไฟล์นี้ไฟล์เดียว
 *
 * ⚠️ iOS Safari: เล่นเสียงไม่ได้จนกว่าผู้ใช้จะแตะจอ → ต้องเรียก unlock() ใน event
 *    ที่เกิดจากการแตะจริงๆ ไม่งั้นเกมจะเงียบสนิทบน iPhone แล้วหาสาเหตุไม่เจอ
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function unlock(): void {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
  } else {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (Ctor) {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.28;
      master.connect(ctx.destination);
      if (ctx.state === 'suspended') void ctx.resume();
    }
  }

  // ปลดล็อก <audio> ของเพลงครูด้วยในจังหวะแตะเดียวกัน — iOS Safari ต้องมี
  // user gesture ตรงๆ ถึงจะเล่นได้ ถ้ารอให้ startMusic() เรียกทีหลัง (ตอนเข้า
  // ฉากเกม ซึ่งไม่ใช่ event จากการแตะแล้ว) จะโดนเบราว์เซอร์บล็อกเงียบๆ
  if (customAudio) {
    void customAudio
      .play()
      .then(() => {
        if (!musicPlaying) customAudio?.pause();
      })
      .catch(() => undefined);
  }
}

export function setMuted(value: boolean): void {
  muted = value;
  if (master && ctx) {
    master.gain.setTargetAtTime(value ? 0 : 0.28, ctx.currentTime, 0.05);
  }
  if (customAudio) customAudio.volume = value ? 0 : 0.35;
}

interface ToneOptions {
  freq: number;
  /** ความถี่ปลายทาง (ถ้าใส่ = เสียงกวาด) */
  toFreq?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone({ freq, toFreq, duration, type = 'square', gain = 0.5, delay = 0 }: ToneOptions): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime + delay;

  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (toFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(toFreq, 1), t0 + duration);

  // ADSR ย่อๆ — attack สั้นๆ กัน "ป๊อก" ตอนเริ่ม แล้ว decay ลงจนเงียบ
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(env);
  env.connect(master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(duration: number, gain = 0.35, filterHz = 900): void {
  if (!ctx || !master || muted) return;
  const t0 = ctx.currentTime;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterHz;

  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, t0);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(t0);
}

export const sfx = {
  jump: () => tone({ freq: 380, toFreq: 720, duration: 0.16, type: 'square', gain: 0.32 }),
  land: () => noise(0.08, 0.18, 500),
  hurt: () => {
    tone({ freq: 320, toFreq: 90, duration: 0.32, type: 'sawtooth', gain: 0.4 });
    noise(0.2, 0.25, 700);
  },
  correct: () => {
    // อาร์เพจจิโอขึ้น = "เก่งมาก"
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, duration: 0.16, type: 'triangle', gain: 0.3, delay: i * 0.07 }),
    );
  },
  wrong: () => {
    // ลงสองโน้ต แต่ไม่แหลมบาดหู — ตอบผิดไม่ควรรู้สึกถูกลงโทษ
    tone({ freq: 330, duration: 0.16, type: 'triangle', gain: 0.28 });
    tone({ freq: 247, duration: 0.26, type: 'triangle', gain: 0.28, delay: 0.13 });
  },
  checkpoint: () => tone({ freq: 880, toFreq: 1320, duration: 0.18, type: 'sine', gain: 0.26 }),
  tick: () => tone({ freq: 660, duration: 0.09, type: 'square', gain: 0.22 }),
  go: () => {
    tone({ freq: 523.25, duration: 0.14, type: 'square', gain: 0.32 });
    tone({ freq: 1046.5, duration: 0.28, type: 'square', gain: 0.3, delay: 0.1 });
  },
  death: () => {
    tone({ freq: 440, toFreq: 55, duration: 0.9, type: 'sawtooth', gain: 0.42 });
    noise(0.6, 0.3, 400);
  },
  warn: () => tone({ freq: 180, toFreq: 120, duration: 0.3, type: 'sawtooth', gain: 0.22 }),
};

/* ------------------------------------------------------------------ */
/* เพลงพื้นหลัง — เข้มขึ้นเมื่อกำแพงใกล้ (dynamic music ตาม GDD ข้อ 7)   */
/*                                                                      */
/* ครูตั้งลิงก์ไฟล์เพลงของห้องได้ผ่านหน้าครู (classes.music_url) —      */
/* ถ้ามี ให้เล่นไฟล์นั้นวนแทนเพลงสังเคราะห์ทั้งชุด (ไม่เล่นซ้อนกัน)      */
/* เพราะเพลงสังเคราะห์มีไว้เป็นค่าเริ่มต้นตอนยังไม่มีไฟล์เสียงเท่านั้น    */
/* (ดู docs/03-decisions.md ข้อ 6) — ตอบโจทย์เดียวกันคือ "มีเพลงเล่น"    */
/* ------------------------------------------------------------------ */

let musicTimer: number | null = null;
let step = 0;
let intensity = 0;
let musicPlaying = false;

let customAudio: HTMLAudioElement | null = null;

/** ครูตั้ง/เปลี่ยนลิงก์เพลงประจำห้อง — เรียกได้ทุกเมื่อ (เช่นตอนรู้ session) */
export function setCustomMusicUrl(url: string | null): void {
  const next = url?.trim() || null;

  if (customAudio) {
    customAudio.pause();
    customAudio.src = '';
    customAudio = null;
  }

  if (next) {
    const el = new Audio(next);
    el.loop = true;
    el.volume = muted ? 0 : 0.35;
    el.preload = 'auto';
    // ลิงก์เพี้ยน/โดน CORS/เซิร์ฟเวอร์เพลงล่ม — แค่เงียบ ไม่ทำเกมพัง
    el.addEventListener('error', () => {
      if (customAudio === el) customAudio = null;
    });
    customAudio = el;
  }

  // ถ้าเพลงกำลังเล่นอยู่ตอนสลับ ให้สลับแหล่งเสียงทันทีโดยไม่ต้องรอ start/stop ใหม่
  if (musicPlaying) {
    stopSynth();
    if (customAudio) void customAudio.play().catch(() => undefined);
    else startSynth();
  }
}

const BASS = [55, 55, 73.42, 65.41];
const LEAD = [220, 261.63, 329.63, 261.63, 293.66, 349.23, 293.66, 261.63];

function startSynth(): void {
  if (musicTimer !== null || !ctx) return;
  step = 0;
  const tick = () => {
    if (!ctx || muted) return;
    // เบสทุกจังหวะ
    tone({ freq: BASS[step % BASS.length], duration: 0.22, type: 'triangle', gain: 0.16 });
    // เมโลดี้เพิ่มเข้ามาเมื่อกำแพงเริ่มกดดัน
    if (intensity > 0.25) {
      tone({
        freq: LEAD[step % LEAD.length],
        duration: 0.14,
        type: 'sine',
        gain: 0.06 + intensity * 0.09,
        delay: 0.11,
      });
    }
    // ใกล้ตายแล้ว — เพิ่มจังหวะเร่ง
    if (intensity > 0.7) {
      tone({ freq: BASS[step % BASS.length] * 2, duration: 0.08, type: 'square', gain: 0.07, delay: 0.16 });
    }
    step++;
  };
  musicTimer = window.setInterval(tick, 300);
  tick();
}

function stopSynth(): void {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

export function startMusic(): void {
  musicPlaying = true;
  if (customAudio) {
    void customAudio.play().catch(() => undefined);
    return;
  }
  startSynth();
}

export function stopMusic(): void {
  musicPlaying = false;
  if (customAudio) {
    customAudio.pause();
    customAudio.currentTime = 0;
  }
  stopSynth();
  intensity = 0;
}

/** 0 = กำแพงยังไกล, 1 = จ่อหลังแล้ว — เพลงของครูไม่มีเลเยอร์ตามความเข้ม เล่นเฉยๆ */
export function setMusicIntensity(value: number): void {
  intensity = Math.min(Math.max(value, 0), 1);
}
