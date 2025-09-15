// Simple Web Audio based sound effects helper
// Generates a few short tones for UI feedback and gameplay events.

export type SfxName = 'click' | 'spawn' | 'error' | 'sisu';

let audioCtx: AudioContext | null = null;
const buffers: Partial<Record<SfxName, AudioBuffer>> = {};

function initAudioSafe(): AudioContext | null {
  if (audioCtx || typeof window === 'undefined') return audioCtx;
  const AC = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) {
    console.warn('Web Audio API not supported');
    return null;
  }
  try {
    audioCtx = new AC();
  } catch (err) {
    console.warn('Unable to create AudioContext', err);
    return null;
  }
  buffers.click = createClick();
  buffers.spawn = createSpawn();
  buffers.error = createError();
  buffers.sisu = createSisu();
  if (audioCtx.state === 'suspended') {
    const resume = () => {
      void audioCtx?.resume();
    };
    window.addEventListener('pointerdown', resume, { once: true });
  }
  return audioCtx;
}

function createBuffer(length: number, fill: (t: number) => number): AudioBuffer {
  const ctx = audioCtx!;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = fill(t);
  }
  return buffer;
}

function createClick(): AudioBuffer {
  const ctx = audioCtx!;
  return createBuffer(Math.floor(ctx.sampleRate * 0.05), (t) =>
    Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-40 * t)
  );
}

function createSpawn(): AudioBuffer {
  const ctx = audioCtx!;
  return createBuffer(Math.floor(ctx.sampleRate * 0.2), (t) =>
    (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 660 * t)) *
      0.5 *
      Math.exp(-6 * t)
  );
}

function createError(): AudioBuffer {
  const ctx = audioCtx!;
  return createBuffer(Math.floor(ctx.sampleRate * 0.3), (t) =>
    Math.sin(2 * Math.PI * 110 * t) * Math.exp(-8 * t)
  );
}

function createSisu(): AudioBuffer {
  const ctx = audioCtx!;
  return createBuffer(Math.floor(ctx.sampleRate * 0.5), (t) =>
    Math.sin(2 * Math.PI * 880 * t) * Math.exp(-2 * t)
  );
}

let muted = false;
if (typeof localStorage !== 'undefined') {
  muted = localStorage.getItem('sfx-muted') === 'true';
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('sfx-muted', m ? 'true' : 'false');
  }
}

export function playSafe(name: SfxName): void {
  if (muted) return;
  const ctx = initAudioSafe();
  if (!ctx) return;
  const buffer = buffers[name];
  if (!buffer) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (e.target instanceof HTMLButtonElement) {
      playSafe('click');
    }
  });
}

// Initialize when module loaded (if possible)
initAudioSafe();

export { initAudioSafe };
