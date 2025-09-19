import { initAudioSafe, isMuted, onMuteChange } from './sfx.ts';

type AmbienceLayer = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  stopTime: number;
};

export type AmbienceState = {
  enabled: boolean;
  playing: boolean;
  volume: number;
  globallyMuted: boolean;
};

const AMBIENCE_SOURCES = ['/assets/sounds/sauna-forest.ogg', '/assets/sounds/sauna-forest.mp3'];
const ENABLED_KEY = 'audio_enabled';
const VOLUME_KEY = 'audio_volume';

const listeners = new Set<(state: AmbienceState) => void>();
const layers = new Set<AmbienceLayer>();

let buffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer> | null = null;
let masterGain: GainNode | null = null;
let nextStartTimer: ReturnType<typeof setTimeout> | null = null;

function readStoredPreference(key: string): string | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn('Unable to read ambience preference', key, error);
    return null;
  }
}

const storedEnabled = readStoredPreference(ENABLED_KEY);
let enabled = storedEnabled === 'true';
let hasExplicitPreference = storedEnabled !== null;

const storedVolume = readStoredPreference(VOLUME_KEY);
let volume = clampNumber(storedVolume ? Number(storedVolume) : NaN, 0.65);

let playing = false;
let globallyMuted = isMuted();

const reduceMotionQuery =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
let prefersReducedMotion = reduceMotionQuery?.matches ?? false;

if (reduceMotionQuery) {
  const handleChange = (event: MediaQueryListEvent) => {
    prefersReducedMotion = event.matches;
  };
  if (typeof reduceMotionQuery.addEventListener === 'function') {
    reduceMotionQuery.addEventListener('change', handleChange);
  } else if (typeof reduceMotionQuery.addListener === 'function') {
    reduceMotionQuery.addListener(handleChange);
  }
}

if (typeof window !== 'undefined' && !hasExplicitPreference) {
  const grantDefaultAudio = () => {
    if (hasExplicitPreference) {
      return;
    }
    hasExplicitPreference = true;
    setEnabled(true);
    void play();
  };
  window.addEventListener('pointerdown', grantDefaultAudio, { once: true });
  window.addEventListener('keydown', grantDefaultAudio, { once: true });
}

onMuteChange((muted) => {
  globallyMuted = muted;
  if (muted) {
    stop();
  } else if (enabled) {
    void play();
  } else {
    updateMasterGainTarget(true);
  }
  notifyState();
});

function clampNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value < 0) {
    return 0;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function notifyState(): void {
  const state = getState();
  for (const listener of listeners) {
    listener(state);
  }
}

function saveEnabled(value: boolean): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(ENABLED_KEY, value ? 'true' : 'false');
  } catch (error) {
    console.warn('Unable to persist ambience preference', error);
  }
}

function saveVolume(value: number): void {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(VOLUME_KEY, value.toFixed(3));
  } catch (error) {
    console.warn('Unable to persist ambience volume', error);
  }
}

function ensureMasterGain(ctx: AudioContext): GainNode {
  if (masterGain) {
    return masterGain;
  }
  const node = ctx.createGain();
  node.gain.value = enabled && !globallyMuted ? volume : 0;
  node.connect(ctx.destination);
  masterGain = node;
  return node;
}

function updateMasterGainTarget(immediate = false): void {
  if (!masterGain) {
    return;
  }
  const ctx = masterGain.context;
  const target = enabled && !globallyMuted ? volume : 0;
  const now = ctx.currentTime;
  masterGain.gain.cancelScheduledValues(now);
  if (immediate) {
    masterGain.gain.setValueAtTime(target, now);
  } else {
    masterGain.gain.setTargetAtTime(target, now, 0.25);
  }
}

function computeFadeDuration(): number {
  return prefersReducedMotion ? 0.6 : 4.2;
}

function cancelNextStart(): void {
  if (nextStartTimer !== null) {
    clearTimeout(nextStartTimer);
    nextStartTimer = null;
  }
}

function cleanupLayer(layer: AmbienceLayer): void {
  try {
    layer.source.stop();
  } catch (error) {
    // ignore
  }
  layer.source.disconnect();
  layer.gain.disconnect();
  layers.delete(layer);
}

function teardownLayers(): void {
  for (const layer of [...layers]) {
    cleanupLayer(layer);
  }
}

async function loadBuffer(ctx: AudioContext): Promise<AudioBuffer> {
  if (buffer) {
    return buffer;
  }
  if (!bufferPromise) {
    bufferPromise = (async () => {
      for (const url of AMBIENCE_SOURCES) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            continue;
          }
          const data = await response.arrayBuffer();
          return await ctx.decodeAudioData(data);
        } catch (error) {
          console.warn('Failed to fetch ambience source', url, error);
        }
      }
      throw new Error('No ambience sources available');
    })()
      .then((decoded) => {
        buffer = decoded;
        return decoded;
      })
      .catch((error) => {
        bufferPromise = null;
        throw error;
      });
  }
  return bufferPromise;
}

function scheduleNext(startTime: number, ctx: AudioContext): void {
  if (!playing) {
    return;
  }
  cancelNextStart();
  const delaySeconds = Math.max(0, startTime - ctx.currentTime - 0.05);
  nextStartTimer = setTimeout(() => {
    nextStartTimer = null;
    if (!playing) {
      return;
    }
    spawnLayer(startTime);
  }, delaySeconds * 1000);
}

function spawnLayer(startTime: number): void {
  const ctx = masterGain?.context ?? initAudioSafe();
  if (!ctx || !buffer) {
    return;
  }
  const gain = ctx.createGain();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = false;
  source.connect(gain);
  gain.connect(ensureMasterGain(ctx));

  const fade = Math.min(computeFadeDuration(), buffer.duration / 2);
  const effectiveFade = Number.isFinite(fade) && fade > 0 ? fade : 0.25;
  const startFade = Math.max(ctx.currentTime, startTime);
  gain.gain.setValueAtTime(0, startFade);
  gain.gain.linearRampToValueAtTime(1, startFade + effectiveFade);

  const stopTime = startTime + buffer.duration;
  const fadeOutStart = stopTime - effectiveFade;
  if (fadeOutStart > startFade) {
    gain.gain.setValueAtTime(1, fadeOutStart);
    gain.gain.linearRampToValueAtTime(0.001, stopTime + 0.1);
  } else {
    gain.gain.linearRampToValueAtTime(0.001, stopTime + 0.1);
  }

  const layer: AmbienceLayer = { source, gain, stopTime };
  layers.add(layer);
  source.addEventListener('ended', () => {
    cleanupLayer(layer);
  });

  try {
    source.start(startTime);
  } catch (error) {
    console.warn('Failed to start ambience layer', error);
    cleanupLayer(layer);
    return;
  }

  scheduleNext(stopTime - effectiveFade, ctx);
}

export async function play(): Promise<void> {
  if (playing || !enabled || globallyMuted) {
    updateMasterGainTarget();
    return;
  }
  const ctx = initAudioSafe();
  if (!ctx) {
    return;
  }
  ensureMasterGain(ctx);
  updateMasterGainTarget();

  try {
    const decoded = await loadBuffer(ctx);
    if (!enabled || globallyMuted) {
      return;
    }
    await ctx.resume().catch(() => undefined);
    playing = true;
    const startTime = Math.max(ctx.currentTime + 0.12, ctx.currentTime);
    spawnLayer(startTime);
    notifyState();
  } catch (error) {
    console.warn('Unable to start ambience', error);
  }
}

export function stop(): void {
  if (!playing && layers.size === 0) {
    updateMasterGainTarget(true);
    return;
  }
  playing = false;
  cancelNextStart();
  teardownLayers();
  updateMasterGainTarget(true);
  notifyState();
}

export function setEnabled(value: boolean): void {
  if (enabled === value && hasExplicitPreference) {
    return;
  }
  enabled = value;
  hasExplicitPreference = true;
  saveEnabled(value);
  if (!value) {
    stop();
  } else if (!globallyMuted) {
    void play();
  }
  notifyState();
}

export function isEnabled(): boolean {
  return enabled;
}

export function setVolume(value: number): void {
  const clamped = Math.max(0, Math.min(1, value));
  if (clamped === volume) {
    return;
  }
  volume = clamped;
  saveVolume(volume);
  updateMasterGainTarget();
  notifyState();
}

export function getVolume(): number {
  return volume;
}

export function getState(): AmbienceState {
  return { enabled, playing, volume, globallyMuted };
}

export function onStateChange(listener: (state: AmbienceState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Kick off playback if a preference was previously stored.
if (enabled && !globallyMuted) {
  void play();
}
