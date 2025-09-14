type SoundName = 'click' | 'spawn' | 'error' | 'sisu';

const AudioCtx =
  typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : undefined;
const ctx: AudioContext | null = AudioCtx ? new AudioCtx() : null;

const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
let muted = storage?.getItem('muted') === 'true';

const buffers: Partial<Record<SoundName, AudioBuffer>> = {};

if (ctx) {
  buffers.click = createTone([1000], [0.05]);
  buffers.spawn = createTone([300, 500], [0.1, 0.1]);
  buffers.error = createTone([200, 150], [0.15, 0.15]);
  buffers.sisu = createTone([400, 600, 800], [0.1, 0.1, 0.2]);
}

function createTone(freqs: number[], durations: number[]): AudioBuffer {
  const sampleRate = ctx!.sampleRate;
  const total = durations.reduce((a, b) => a + b, 0);
  const buffer = ctx!.createBuffer(1, Math.floor(sampleRate * total), sampleRate);
  const data = buffer.getChannelData(0);
  let offset = 0;
  for (let i = 0; i < freqs.length; i++) {
    const len = Math.floor(durations[i] * sampleRate);
    for (let j = 0; j < len; j++) {
      const t = j / len;
      const env = 1 - t; // simple linear fade-out
      data[offset + j] = Math.sin((2 * Math.PI * freqs[i] * j) / sampleRate) * env;
    }
    offset += len;
  }
  return buffer;
}

export function play(name: SoundName): void {
  if (muted || !ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  const buffer = buffers[name];
  if (!buffer) return;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

export function setMuted(value: boolean): void {
  muted = value;
  storage?.setItem('muted', value ? 'true' : 'false');
}

