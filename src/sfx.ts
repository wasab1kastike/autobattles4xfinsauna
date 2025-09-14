export type SfxName = 'click' | 'spawn' | 'error' | 'sisu';

const AudioCtx =
  typeof window !== 'undefined'
    ? (window.AudioContext || (window as any).webkitAudioContext)
    : undefined;
const ctx: AudioContext | null = AudioCtx ? new AudioCtx() : null;

const buffers = new Map<SfxName, AudioBuffer>();
if (ctx) {
  buffers.set('click', createClickBuffer());
  buffers.set('spawn', createToneBuffer(440, 0.25));
  buffers.set('error', createToneBuffer(150, 0.3));
  buffers.set('sisu', createToneBuffer(880, 0.5));
}

let muted =
  typeof localStorage !== 'undefined' && localStorage.getItem('muted') === 'true';

function setMuted(value: boolean): void {
  muted = value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('muted', String(value));
  }
}

function play(name: SfxName): void {
  if (muted || !ctx) return;
  const buffer = buffers.get(name);
  if (!buffer) return;
  if (ctx.state === 'suspended') void ctx.resume();
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  src.start();
}

function createToneBuffer(freq: number, duration: number): AudioBuffer {
  const length = Math.floor(ctx!.sampleRate * duration);
  const buffer = ctx!.createBuffer(1, length, ctx!.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx!.sampleRate;
    data[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-3 * t / duration);
  }
  return buffer;
}

function createClickBuffer(): AudioBuffer {
  const duration = 0.05;
  const length = Math.floor(ctx!.sampleRate * duration);
  const buffer = ctx!.createBuffer(1, length, ctx!.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }
  return buffer;
}

export const sfx = { play, setMuted };
