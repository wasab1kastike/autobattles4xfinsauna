// Simple sound effect generator using the Web Audio API.
// Generates small tone buffers on load and exposes play() and setMuted().

export type SfxName = 'click' | 'spawn' | 'error' | 'sisu';

const AudioCtor =
  typeof window !== 'undefined'
    ? window.AudioContext || (window as any).webkitAudioContext
    : undefined;

let ctx: AudioContext | null = null;
let buffers: Partial<Record<SfxName, AudioBuffer>> = {};

if (AudioCtor) {
  ctx = new AudioCtor();

  function createBuffer(durations: number[], freqs: number[]): AudioBuffer {
    const total = durations.reduce((a, b) => a + b, 0);
    const sampleRate = ctx!.sampleRate;
    const buffer = ctx!.createBuffer(1, Math.floor(sampleRate * total), sampleRate);
    const data = buffer.getChannelData(0);
    let offset = 0;
    for (let i = 0; i < freqs.length; i++) {
      const freq = freqs[i];
      const dur = durations[i];
      const len = Math.floor(sampleRate * dur);
      for (let j = 0; j < len; j++) {
        const t = j / sampleRate;
        const env = 1 - j / len; // simple decay envelope
        data[offset + j] = Math.sin(2 * Math.PI * freq * t) * env;
      }
      offset += len;
    }
    return buffer;
  }

  buffers = {
    click: createBuffer([0.05], [700]),
    spawn: createBuffer([0.08, 0.08], [400, 800]),
    error: createBuffer([0.2], [150]),
    sisu: createBuffer([0.1, 0.1, 0.2], [300, 600, 900])
  };
}

let muted = false;
try {
  muted = localStorage.getItem('sfx-muted') === 'true';
} catch {
  muted = false;
}

export function setMuted(m: boolean): void {
  muted = m;
  try {
    localStorage.setItem('sfx-muted', String(m));
  } catch {}
}

export function play(name: SfxName): void {
  if (muted || !ctx) return;
  const buffer = buffers[name];
  if (!buffer) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}
