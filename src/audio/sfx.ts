import {
  getChannelGainNode,
  getChannelState,
  initAudioContext,
  onMixerChange,
  setSfxMuted
} from './mixer.ts';
import { SFX_VARIANTS } from './sfxData.ts';

export type SfxName = 'click' | 'spawn' | 'error' | 'attack' | 'death' | 'sisu';

type Envelope = {
  readonly attack: number;
  readonly release: number;
};

type VariantDefinition = {
  readonly id: string;
  readonly label: string;
  readonly loader: (ctx: AudioContext) => Promise<AudioBuffer> | AudioBuffer;
  readonly gain?: number;
  readonly envelope?: Envelope;
};

type SoundDefinition = {
  readonly variants: readonly VariantDefinition[];
  readonly debounceMs?: number;
};

const SOUND_DEFINITIONS: Record<SfxName, SoundDefinition> = {
  click: {
    variants: [
      {
        id: 'ui-click-frost',
        label: 'Frosted UI tick',
        loader: (ctx) => createClick(ctx),
        gain: 0.9,
        envelope: { attack: 0.005, release: 0.1 }
      }
    ],
    debounceMs: 30
  },
  spawn: {
    variants: [
      {
        id: 'spawn-chime-glint',
        label: 'Glacial spawn chime',
        loader: (ctx) => createSpawn(ctx),
        gain: 0.85,
        envelope: { attack: 0.02, release: 0.3 }
      }
    ],
    debounceMs: 120
  },
  error: {
    variants: [
      {
        id: 'soft-error-hum',
        label: 'Soft error hum',
        loader: (ctx) => createError(ctx),
        gain: 0.8,
        envelope: { attack: 0.03, release: 0.35 }
      }
    ]
  },
  attack: {
    variants: createEncodedVariants('attack'),
    debounceMs: 70
  },
  death: {
    variants: createEncodedVariants('death'),
    debounceMs: 180
  },
  sisu: {
    variants: createEncodedVariants('sisu'),
    debounceMs: 800
  }
};

function createEncodedVariants(name: keyof typeof SFX_VARIANTS): readonly VariantDefinition[] {
  return SFX_VARIANTS[name].map((variant) => ({
    id: `${name}-${variant.id}`,
    label: variant.label,
    loader: (ctx: AudioContext) => decodeAsset(variant.payload, ctx),
    gain: variant.loudness.gain,
    envelope: variant.envelope
  }));
}

let audioCtx: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();
const pendingLoads = new Map<string, Promise<AudioBuffer>>();
const lastPlayed = new Map<SfxName, number>();
const variantRotation = new Map<SfxName, number>();

const muteListeners = new Set<(muted: boolean) => void>();

function getEffectiveMute(): boolean {
  const master = getChannelState('master');
  const sfx = getChannelState('sfx');
  return master.muted || sfx.muted;
}

function notifyMuteListeners(): void {
  const muted = getEffectiveMute();
  for (const listener of muteListeners) {
    listener(muted);
  }
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

function getNowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getVariantKey(name: SfxName, variant: VariantDefinition): string {
  return `${name}:${variant.id}`;
}

function getBuffer(name: SfxName, variant: VariantDefinition): Promise<AudioBuffer> {
  const key = getVariantKey(name, variant);
  const cached = buffers.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  const pending = pendingLoads.get(key);
  if (pending) {
    return pending;
  }

  const ctx = initAudioSafe();
  if (!ctx) {
    return Promise.reject(new Error('Audio context unavailable'));
  }

  const loadPromise = Promise.resolve(variant.loader(ctx))
    .then((buffer) => {
      buffers.set(key, buffer);
      pendingLoads.delete(key);
      return buffer;
    })
    .catch((err) => {
      pendingLoads.delete(key);
      throw err;
    });

  pendingLoads.set(key, loadPromise);
  return loadPromise;
}

function applyEnvelope(
  gainNode: GainNode,
  ctx: AudioContext,
  level: number,
  duration: number,
  envelope: Envelope
): void {
  const now = ctx.currentTime;
  const attack = Math.max(0, envelope.attack);
  const release = Math.max(0, envelope.release);
  const sustain = Math.max(0, duration - attack - release);

  gainNode.gain.cancelScheduledValues(now);

  if (attack > 0) {
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(level, now + attack);
  } else {
    gainNode.gain.setValueAtTime(level, now);
  }

  const sustainEnd = now + attack + sustain;
  gainNode.gain.setValueAtTime(level, sustainEnd);

  if (release > 0) {
    gainNode.gain.linearRampToValueAtTime(0, sustainEnd + release);
  } else {
    gainNode.gain.setValueAtTime(0, sustainEnd);
  }
}

export function playSafe(name: SfxName): void {
  if (isMuted()) {
    return;
  }

  const definition = SOUND_DEFINITIONS[name];
  if (!definition) {
    return;
  }

  const variants = definition.variants;
  if (!variants || variants.length === 0) {
    return;
  }

  const now = getNowMs();
  const debounceMs = definition.debounceMs ?? 0;
  const last = lastPlayed.get(name) ?? 0;
  if (debounceMs > 0 && now - last < debounceMs) {
    return;
  }
  lastPlayed.set(name, now);

  const rotationIndex = variantRotation.get(name) ?? 0;
  const variant = variants[rotationIndex % variants.length];
  variantRotation.set(name, (rotationIndex + 1) % variants.length);

  void getBuffer(name, variant)
    .then((buffer) => {
      if (isMuted()) {
        return;
      }
      const ctx = initAudioSafe();
      if (!ctx) {
        return;
      }
      const destination = getChannelGainNode('sfx');
      if (!destination) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const baseGain = typeof variant.gain === 'number' && variant.gain > 0 ? variant.gain : 1;
      const envelope = variant.envelope;
      if (envelope || baseGain !== 1) {
        const gainNode = ctx.createGain();
        if (envelope) {
          applyEnvelope(gainNode, ctx, baseGain, buffer.duration, envelope);
        } else {
          gainNode.gain.value = baseGain;
        }
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
  return getEffectiveMute();
}

export function setMuted(m: boolean): void {
  setSfxMuted(m);
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

let lastMute = getEffectiveMute();
onMixerChange((state) => {
  const muted = state.channels.master.muted || state.channels.sfx.muted;
  if (muted === lastMute) {
    return;
  }
  lastMute = muted;
  notifyMuteListeners();
});

function initAudioSafe(): AudioContext | null {
  if (audioCtx) {
    return audioCtx;
  }
  audioCtx = initAudioContext();
  return audioCtx;
}

initAudioSafe();

export { initAudioSafe };
