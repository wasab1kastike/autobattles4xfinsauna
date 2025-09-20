import { SFX_PAYLOADS } from './sfxData.ts';

export type SfxName = 'click' | 'spawn' | 'error' | 'attack' | 'death' | 'sisu';

type SoundDefinition = {
  loader: (ctx: AudioContext) => Promise<AudioBuffer> | AudioBuffer;
  debounceMs?: number;
  gain?: number;
};

const SOUND_DEFINITIONS: Record<SfxName, SoundDefinition> = {
  click: {
    loader: (ctx) => createClick(ctx),
    debounceMs: 30
  },
  spawn: {
    loader: (ctx) => createSpawn(ctx),
    debounceMs: 120
  },
  error: {
    loader: (ctx) => createError(ctx)
  },
  attack: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.attack.payload, ctx),
    debounceMs: 70,
    gain: SFX_PAYLOADS.attack.loudness.gain
  },
  death: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.death.payload, ctx),
    debounceMs: 180,
    gain: SFX_PAYLOADS.death.loudness.gain
  },
  sisu: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.sisu.payload, ctx),
    debounceMs: 800,
    gain: SFX_PAYLOADS.sisu.loudness.gain
  }
};

let audioCtx: AudioContext | null = null;
let gainNode: GainNode | null = null;
const buffers = new Map<SfxName, AudioBuffer>();
const pendingLoads = new Map<SfxName, Promise<AudioBuffer>>();
const lastPlayed = new Map<SfxName, number>();

let muted = false;
if (typeof localStorage !== 'undefined') {
  muted = localStorage.getItem('sfx-muted') === 'true';
}

const muteListeners = new Set<(muted: boolean) => void>();

function notifyMuteListeners(): void {
  for (const listener of muteListeners) {
    listener(muted);
  }
}

function ensureGainNode(ctx: AudioContext): GainNode {
  if (gainNode) {
    return gainNode;
  }
  const node = ctx.createGain();
  node.gain.value = muted ? 0 : 1;
  node.connect(ctx.destination);
  gainNode = node;
  return node;
}

function createBuffer(
  ctx: AudioContext,
  durationSeconds: number,
  fill: (t: number) => number
): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * durationSeconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    data[i] = fill(t);
  }
  return buffer;
}

function createClick(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.05, (t) => Math.sin(2 * Math.PI * 1000 * t) * Math.exp(-40 * t));
}

function createSpawn(ctx: AudioContext): AudioBuffer {
  return createBuffer(
    ctx,
    0.2,
    (t) =>
      (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 660 * t)) * 0.5 * Math.exp(-6 * t)
  );
}

function createError(ctx: AudioContext): AudioBuffer {
  return createBuffer(ctx, 0.3, (t) => Math.sin(2 * Math.PI * 110 * t) * Math.exp(-8 * t));
}

function base64ToUint8Array(base64: string): Uint8Array {
  const globalAny = globalThis as typeof globalThis & {
    atob?: (data: string) => string;
    Buffer?: {
      from(data: string, encoding: string): { length: number; [index: number]: number } &
        ArrayBufferView;
    };
  };

  if (typeof globalAny.atob === 'function') {
    const binaryString = globalAny.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  if (globalAny.Buffer) {
    const nodeBuffer = globalAny.Buffer.from(base64, 'base64');
    const bytes = new Uint8Array(nodeBuffer.length);
    for (let i = 0; i < nodeBuffer.length; i++) {
      bytes[i] = nodeBuffer[i];
    }
    return bytes;
  }

  throw new Error('No base64 decoder available for sound payloads.');
}

async function decodeAsset(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const bytes = base64ToUint8Array(base64);
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return await ctx.decodeAudioData(arrayBuffer);
}

function initAudioSafe(): AudioContext | null {
  if (audioCtx || typeof window === 'undefined') {
    return audioCtx;
  }

  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    console.warn('Web Audio API not supported');
    return null;
  }

  try {
    audioCtx = new AC();
    ensureGainNode(audioCtx);
  } catch (err) {
    console.warn('Unable to create AudioContext', err);
    audioCtx = null;
    return null;
  }

  if (audioCtx.state === 'suspended') {
    const resume = () => {
      void audioCtx?.resume();
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  return audioCtx;
}

function getNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getBuffer(name: SfxName): Promise<AudioBuffer> {
  const cached = buffers.get(name);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingLoads.get(name);
  if (pending) {
    return pending;
  }

  const ctx = initAudioSafe();
  if (!ctx) {
    return Promise.reject(new Error('Audio context unavailable'));
  }

  const definition = SOUND_DEFINITIONS[name];
  if (!definition) {
    return Promise.reject(new Error(`No sound registered for ${name}`));
  }

  const loadPromise = Promise.resolve(definition.loader(ctx))
    .then((buffer) => {
      buffers.set(name, buffer);
      pendingLoads.delete(name);
      return buffer;
    })
    .catch((err) => {
      pendingLoads.delete(name);
      throw err;
    });

  pendingLoads.set(name, loadPromise);
  return loadPromise;
}

export function playSafe(name: SfxName): void {
  if (muted) {
    return;
  }

  const definition = SOUND_DEFINITIONS[name];
  if (!definition) {
    return;
  }

  const now = getNowMs();
  const debounceMs = definition.debounceMs ?? 0;
  const last = lastPlayed.get(name) ?? 0;
  if (debounceMs > 0 && now - last < debounceMs) {
    return;
  }
  lastPlayed.set(name, now);

  void getBuffer(name)
    .then((buffer) => {
      if (muted) {
        return;
      }
      const ctx = initAudioSafe();
      if (!ctx) {
        return;
      }
      const destination = ensureGainNode(ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const soundGain = definition.gain;
      if (typeof soundGain === 'number' && soundGain > 0 && soundGain !== 1) {
        const gainNode = ctx.createGain();
        gainNode.gain.value = soundGain;
        source.connect(gainNode);
        gainNode.connect(destination);
      } else {
        source.connect(destination);
      }
      try {
        source.start();
      } catch (err) {
        console.warn('Unable to start sound', err);
      }
    })
    .catch((err) => {
      if (err instanceof Error && err.message === 'Audio context unavailable') {
        return;
      }
      console.warn('Failed to play sound', name, err);
    });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (gainNode) {
    gainNode.gain.value = muted ? 0 : 1;
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('sfx-muted', muted ? 'true' : 'false');
  }
  notifyMuteListeners();
}

export function onMuteChange(listener: (m: boolean) => void): () => void {
  muteListeners.add(listener);
  return () => {
    muteListeners.delete(listener);
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    if (event.target instanceof HTMLButtonElement) {
      playSafe('click');
    }
  });
}

initAudioSafe();

export { initAudioSafe };
