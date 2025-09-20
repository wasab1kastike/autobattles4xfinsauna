import {
  getChannelGainNode,
  getChannelState,
  initAudioContext,
  onMixerChange,
  setSfxMuted
} from './mixer.ts';
import { SFX_PAYLOADS } from './sfxData.ts';

export type SfxName = 'click' | 'spawn' | 'error' | 'attack' | 'death' | 'sisu';

type DebounceConfig = {
  windowMs: number;
  maxWeight: number;
  weight?: number;
};

type DebounceEntry = {
  time: number;
  weight: number;
};

type SoundDefinition = {
  loader: (ctx: AudioContext) => Promise<AudioBuffer> | AudioBuffer;
  debounce?: DebounceConfig;
  polyphony?: number;
  gain?: number;
};

const SOUND_DEFINITIONS: Record<SfxName, SoundDefinition> = {
  click: {
    loader: (ctx) => createClick(ctx),
    debounce: {
      windowMs: 35,
      weight: 0.5,
      maxWeight: 1.5
    },
    polyphony: 6
  },
  spawn: {
    loader: (ctx) => createSpawn(ctx),
    debounce: {
      windowMs: 150,
      weight: 0.7,
      maxWeight: 1.4
    },
    polyphony: 3
  },
  error: {
    loader: (ctx) => createError(ctx),
    debounce: {
      windowMs: 220,
      weight: 1,
      maxWeight: 1
    },
    polyphony: 2
  },
  attack: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.attack.payload, ctx),
    debounce: {
      windowMs: 120,
      weight: 0.6,
      maxWeight: 1.2
    },
    polyphony: 3,
    gain: SFX_PAYLOADS.attack.loudness.gain
  },
  death: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.death.payload, ctx),
    debounce: {
      windowMs: 360,
      weight: 1,
      maxWeight: 1.5
    },
    polyphony: 3,
    gain: SFX_PAYLOADS.death.loudness.gain
  },
  sisu: {
    loader: (ctx) => decodeAsset(SFX_PAYLOADS.sisu.payload, ctx),
    debounce: {
      windowMs: 900,
      weight: 1,
      maxWeight: 1
    },
    polyphony: 1,
    gain: SFX_PAYLOADS.sisu.loudness.gain
  }
};

let audioCtx: AudioContext | null = null;
const buffers = new Map<SfxName, AudioBuffer>();
const pendingLoads = new Map<SfxName, Promise<AudioBuffer>>();
const playbackHistory = new Map<SfxName, DebounceEntry[]>();
const pendingPolyphony = new Map<SfxName, number>();
const activeSources = new Map<SfxName, Set<AudioBufferSourceNode>>();

type AttackLimiterState = {
  node: GainNode | null;
  destination: AudioNode | null;
  envelope: number;
  lastUpdate: number;
};

const attackLimiter: AttackLimiterState = {
  node: null,
  destination: null,
  envelope: 0,
  lastUpdate: 0
};

const SISU_DUCK = {
  attackSeconds: 0.04,
  releaseSeconds: 0.6,
  depth: 0.55,
  floor: 0.25
};

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

function getPolyphonyLimit(definition: SoundDefinition): number {
  const limit = definition.polyphony;
  if (!Number.isFinite(limit) || !limit || limit <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return limit;
}

function pruneDebounceHistory(name: SfxName, cutoff: number): DebounceEntry[] {
  const history = playbackHistory.get(name);
  if (!history || history.length === 0) {
    return [];
  }
  const pruned: DebounceEntry[] = [];
  for (const entry of history) {
    if (entry.time >= cutoff) {
      pruned.push(entry);
    }
  }
  playbackHistory.set(name, pruned);
  return pruned;
}

type DebounceEvaluation = { blocked: true } | { blocked: false; weight: number };

function evaluateDebounce(
  name: SfxName,
  definition: SoundDefinition,
  now: number
): DebounceEvaluation {
  const config = definition.debounce;
  if (!config) {
    return { blocked: false, weight: 0 };
  }
  const weight = config.weight ?? 1;
  const windowMs = config.windowMs;
  const cutoff = now - windowMs;
  const recent = pruneDebounceHistory(name, cutoff);
  let total = 0;
  for (const entry of recent) {
    total += entry.weight;
  }
  if (total + weight > config.maxWeight) {
    return { blocked: true };
  }
  return { blocked: false, weight };
}

function recordDebounce(name: SfxName, time: number, weight: number): void {
  if (weight <= 0) {
    return;
  }
  const history = playbackHistory.get(name) ?? [];
  history.push({ time, weight });
  playbackHistory.set(name, history);
}

function incrementPending(name: SfxName): void {
  const next = (pendingPolyphony.get(name) ?? 0) + 1;
  pendingPolyphony.set(name, next);
}

function decrementPending(name: SfxName): void {
  const current = pendingPolyphony.get(name) ?? 0;
  if (current <= 1) {
    pendingPolyphony.delete(name);
    return;
  }
  pendingPolyphony.set(name, current - 1);
}

function isPolyphonyBlocked(name: SfxName, limit: number): boolean {
  if (!Number.isFinite(limit)) {
    return false;
  }
  const active = activeSources.get(name)?.size ?? 0;
  const pending = pendingPolyphony.get(name) ?? 0;
  return active + pending >= limit;
}

function registerActiveSource(name: SfxName, source: AudioBufferSourceNode): () => void {
  let set = activeSources.get(name);
  if (!set) {
    set = new Set<AudioBufferSourceNode>();
    activeSources.set(name, set);
  }
  set.add(source);
  let released = false;
  const release = () => {
    if (released) {
      return;
    }
    released = true;
    const currentSet = activeSources.get(name);
    currentSet?.delete(source);
    if (currentSet && currentSet.size === 0) {
      activeSources.delete(name);
    }
  };
  if (typeof source.addEventListener === 'function') {
    source.addEventListener(
      'ended',
      () => {
        release();
      },
      { once: true }
    );
  } else {
    const previous = source.onended;
    source.onended = () => {
      try {
        previous?.call(source);
      } finally {
        release();
      }
    };
  }
  return release;
}

function ensureAttackLimiter(ctx: AudioContext, destination: AudioNode): GainNode {
  const node = attackLimiter.node;
  if (!node || node.context !== ctx) {
    attackLimiter.node?.disconnect();
    const limiter = ctx.createGain();
    limiter.gain.value = 1;
    limiter.connect(destination);
    attackLimiter.node = limiter;
    attackLimiter.destination = destination;
    attackLimiter.envelope = 0;
    attackLimiter.lastUpdate = ctx.currentTime;
    return limiter;
  }
  if (attackLimiter.destination !== destination) {
    node.disconnect();
    node.connect(destination);
    attackLimiter.destination = destination;
  }
  return node;
}

function driveAttackLimiter(ctx: AudioContext): void {
  const node = attackLimiter.node;
  if (!node) {
    return;
  }
  const now = ctx.currentTime;
  const releaseSeconds = 0.6;
  const impact = 0.55;
  const elapsed = Math.max(0, now - attackLimiter.lastUpdate);
  const decay = Math.exp(-elapsed / releaseSeconds);
  attackLimiter.envelope *= decay;
  attackLimiter.envelope = Math.min(1, attackLimiter.envelope + impact);
  attackLimiter.lastUpdate = now;

  const depth = 0.5;
  const floor = 0.35;
  const targetGain = Math.max(floor, 1 - attackLimiter.envelope * depth);
  const attackSeconds = 0.02;

  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(node.gain.value, now);
  node.gain.linearRampToValueAtTime(targetGain, now + attackSeconds);
  node.gain.setTargetAtTime(1, now + attackSeconds, releaseSeconds);
}

function applySisuDucking(ctx: AudioContext): void {
  const music = getChannelGainNode('music');
  if (!music) {
    return;
  }
  const masterState = getChannelState('master');
  const musicState = getChannelState('music');
  if (masterState.muted || musicState.muted) {
    return;
  }
  const baseVolume = musicState.volume;
  if (baseVolume <= 0) {
    return;
  }
  const now = ctx.currentTime;
  const currentValue = music.gain.value;
  const dipTarget = baseVolume * (1 - SISU_DUCK.depth);
  const floorValue = baseVolume * SISU_DUCK.floor;
  const target = Math.min(currentValue, Math.max(dipTarget, floorValue));

  music.gain.cancelScheduledValues(now);
  music.gain.setValueAtTime(currentValue, now);
  music.gain.linearRampToValueAtTime(target, now + SISU_DUCK.attackSeconds);
  music.gain.setTargetAtTime(baseVolume, now + SISU_DUCK.attackSeconds, SISU_DUCK.releaseSeconds);
}

export function playSafe(name: SfxName): void {
  if (isMuted()) {
    return;
  }

  const definition = SOUND_DEFINITIONS[name];
  if (!definition) {
    return;
  }

  const now = getNowMs();
  const debounceResult = evaluateDebounce(name, definition, now);
  if (debounceResult.blocked) {
    return;
  }

  const polyphonyLimit = getPolyphonyLimit(definition);
  if (isPolyphonyBlocked(name, polyphonyLimit)) {
    return;
  }

  incrementPending(name);
  let pendingCleared = false;
  const clearPending = () => {
    if (!pendingCleared) {
      decrementPending(name);
      pendingCleared = true;
    }
  };

  void getBuffer(name)
    .then((buffer) => {
      clearPending();
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
      const limit = getPolyphonyLimit(definition);
      if (isPolyphonyBlocked(name, limit)) {
        return;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const soundGain = definition.gain;
      let tail: AudioNode = source;
      if (typeof soundGain === 'number' && soundGain > 0 && soundGain !== 1) {
        const gainNode = ctx.createGain();
        gainNode.gain.value = soundGain;
        source.connect(gainNode);
        tail = gainNode;
      }
      const connectTarget = name === 'attack' ? ensureAttackLimiter(ctx, destination) : destination;
      tail.connect(connectTarget);
      const release = registerActiveSource(name, source);
      try {
        source.start();
        if (name === 'attack') {
          driveAttackLimiter(ctx);
        }
        if (name === 'sisu') {
          applySisuDucking(ctx);
        }
        const startTime = getNowMs();
        if (!debounceResult.blocked && debounceResult.weight > 0) {
          recordDebounce(name, startTime, debounceResult.weight);
        }
      } catch (err) {
        console.warn('Unable to start sound', err);
        release();
      }
    })
    .catch((err) => {
      clearPending();
      if (err instanceof Error && err.message === 'Audio context unavailable') {
        return;
      }
      console.warn('Failed to play sound', name, err);
    })
    .finally(() => {
      clearPending();
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

export function resetSfxForTests(): void {
  buffers.clear();
  pendingLoads.clear();
  playbackHistory.clear();
  pendingPolyphony.clear();
  activeSources.clear();
  attackLimiter.node?.disconnect();
  attackLimiter.node = null;
  attackLimiter.destination = null;
  attackLimiter.envelope = 0;
  attackLimiter.lastUpdate = 0;
  muteListeners.clear();
  audioCtx = null;
  lastMute = getEffectiveMute();
}

initAudioSafe();

export { initAudioSafe };
