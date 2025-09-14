// Simple Web Audio based sound effects helper
// Generates a few short tones for UI feedback and gameplay events.

export type SfxName = 'click' | 'spawn' | 'error' | 'sisu';

let audioCtx: AudioContext | null = null;
const buffers: Partial<Record<SfxName, AudioBuffer>> = {};

function init(): void {
  if (audioCtx || typeof window === 'undefined') return;
  const AC = (window.AudioContext || (window as any).webkitAudioContext);
  if (!AC) return;
  audioCtx = new AC();
  buffers.click = createClick();
  buffers.spawn = createSpawn();
  buffers.error = createError();
  buffers.sisu = createSisu();
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

export function play(name: SfxName): void {
  if (muted) return;
  if (!audioCtx) init();
  if (!audioCtx) return;
  const buffer = buffers[name];
  if (!buffer) return;
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (e) => {
    if (e.target instanceof HTMLButtonElement) {
      play('click');
    }
  });
}

// Initialize when module loaded (if possible)
init();
