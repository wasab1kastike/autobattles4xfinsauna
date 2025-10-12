export type MixerChannel = 'master' | 'music' | 'sfx';

export interface MixerChannelState {
  volume: number;
  muted: boolean;
  effectiveVolume: number;
}

export interface MixerState {
  channels: Record<MixerChannel, MixerChannelState>;
  contextState: AudioContextState | 'uninitialized';
}

interface ChannelConfig {
  defaultVolume: number;
  volumeKey: string;
  muteKey: string;
}

const CHANNEL_CONFIG: Record<MixerChannel, ChannelConfig> = {
  master: {
    defaultVolume: 0.9,
    volumeKey: 'audio.mixer.master.volume',
    muteKey: 'audio.mixer.master.muted'
  },
  music: {
    defaultVolume: 0.65,
    volumeKey: 'audio.mixer.music.volume',
    muteKey: 'audio.mixer.music.muted'
  },
  sfx: {
    defaultVolume: 1,
    volumeKey: 'audio.mixer.sfx.volume',
    muteKey: 'audio.mixer.sfx.muted'
  }
};

const channelState: Record<MixerChannel, { volume: number; muted: boolean }> = {
  master: { volume: CHANNEL_CONFIG.master.defaultVolume, muted: false },
  music: { volume: CHANNEL_CONFIG.music.defaultVolume, muted: false },
  sfx: { volume: CHANNEL_CONFIG.sfx.defaultVolume, muted: false }
};

const channelNodes: Partial<Record<MixerChannel, GainNode>> = {};
let audioCtx: AudioContext | null = null;
let resumeListenersAttached = false;

const listeners = new Set<(state: MixerState) => void>();

function clampVolume(value: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function getStorage(): Storage | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    return localStorage;
  } catch (error) {
    console.warn('Audio mixer storage unavailable', error);
    return null;
  }
}

function readStoredVolume(channel: MixerChannel): number | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(CHANNEL_CONFIG[channel].volumeKey);
    if (raw === null) {
      return null;
    }
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return clampVolume(parsed, CHANNEL_CONFIG[channel].defaultVolume);
  } catch (error) {
    console.warn('Failed to restore volume setting', channel, error);
    return null;
  }
}

function readStoredMute(channel: MixerChannel): boolean | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(CHANNEL_CONFIG[channel].muteKey);
    if (raw === null) {
      return null;
    }
    return raw === 'true';
  } catch (error) {
    console.warn('Failed to restore mute setting', channel, error);
    return null;
  }
}

for (const channel of Object.keys(CHANNEL_CONFIG) as MixerChannel[]) {
  const storedVolume = readStoredVolume(channel);
  const storedMute = readStoredMute(channel);
  if (storedVolume !== null) {
    channelState[channel].volume = clampVolume(
      storedVolume,
      CHANNEL_CONFIG[channel].defaultVolume
    );
  }
  if (storedMute !== null) {
    channelState[channel].muted = storedMute;
  }
}

function persistVolume(channel: MixerChannel): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      CHANNEL_CONFIG[channel].volumeKey,
      channelState[channel].volume.toFixed(3)
    );
  } catch (error) {
    console.warn('Failed to persist volume setting', channel, error);
  }
}

function persistMute(channel: MixerChannel): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(
      CHANNEL_CONFIG[channel].muteKey,
      channelState[channel].muted ? 'true' : 'false'
    );
  } catch (error) {
    console.warn('Failed to persist mute setting', channel, error);
  }
}

function ensureResumeListeners(): void {
  if (typeof window === 'undefined' || !audioCtx || resumeListenersAttached) {
    return;
  }
  const resume = () => {
    void audioCtx?.resume().catch(() => undefined);
  };
  window.addEventListener('pointerdown', resume, { once: true });
  window.addEventListener('keydown', resume, { once: true });
  resumeListenersAttached = true;
}

function applyChannelState(channel: MixerChannel): void {
  const node = channelNodes[channel];
  if (!node) {
    return;
  }
  const { volume, muted } = channelState[channel];
  const target = muted ? 0 : volume;
  node.gain.value = target;
}

function ensureNodes(ctx: AudioContext): void {
  if (!channelNodes.master) {
    const master = ctx.createGain();
    master.gain.value = channelState.master.muted ? 0 : channelState.master.volume;
    master.connect(ctx.destination);
    channelNodes.master = master;
  }
  if (!channelNodes.music) {
    const music = ctx.createGain();
    music.gain.value = channelState.music.muted ? 0 : channelState.music.volume;
    music.connect(channelNodes.master!);
    channelNodes.music = music;
  }
  if (!channelNodes.sfx) {
    const sfx = ctx.createGain();
    sfx.gain.value = channelState.sfx.muted ? 0 : channelState.sfx.volume;
    sfx.connect(channelNodes.master!);
    channelNodes.sfx = sfx;
  }
}

export function initAudioContext(): AudioContext | null {
  if (audioCtx || typeof window === 'undefined') {
    return audioCtx;
  }
  const AC =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) {
    console.warn('Web Audio API not supported');
    return null;
  }
  try {
    audioCtx = new AC();
    ensureNodes(audioCtx);
    ensureResumeListeners();
  } catch (error) {
    console.warn('Unable to create AudioContext', error);
    audioCtx = null;
    return null;
  }
  if (audioCtx.state === 'suspended') {
    resumeListenersAttached = false;
    ensureResumeListeners();
  }
  return audioCtx;
}

function getAudioContextOrInit(): AudioContext | null {
  return audioCtx ?? initAudioContext();
}

function computeEffectiveVolume(channel: MixerChannel): number {
  const master = channelState.master;
  if (channel === 'master') {
    return master.muted ? 0 : master.volume;
  }
  const state = channelState[channel];
  if (state.muted || master.muted) {
    return 0;
  }
  return state.volume * master.volume;
}

export function getChannelGainNode(channel: MixerChannel): GainNode | null {
  const ctx = getAudioContextOrInit();
  if (!ctx) {
    return null;
  }
  ensureNodes(ctx);
  const node = channelNodes[channel];
  if (!node) {
    return null;
  }
  applyChannelState(channel);
  return node;
}

export function getMixerState(): MixerState {
  const snapshot: MixerState = {
    channels: {
      master: {
        volume: channelState.master.volume,
        muted: channelState.master.muted,
        effectiveVolume: computeEffectiveVolume('master')
      },
      music: {
        volume: channelState.music.volume,
        muted: channelState.music.muted,
        effectiveVolume: computeEffectiveVolume('music')
      },
      sfx: {
        volume: channelState.sfx.volume,
        muted: channelState.sfx.muted,
        effectiveVolume: computeEffectiveVolume('sfx')
      }
    },
    contextState: audioCtx?.state ?? 'uninitialized'
  };
  return snapshot;
}

function notify(): void {
  const snapshot = getMixerState();
  for (const listener of listeners) {
    listener(snapshot);
  }
}

export function onMixerChange(listener: (state: MixerState) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setChannelVolumeInternal(channel: MixerChannel, value: number): void {
  const clamped = clampVolume(value, CHANNEL_CONFIG[channel].defaultVolume);
  if (channelState[channel].volume === clamped) {
    return;
  }
  channelState[channel].volume = clamped;
  persistVolume(channel);
  applyChannelState(channel);
  notify();
}

function setChannelMutedInternal(channel: MixerChannel, muted: boolean): void {
  if (channelState[channel].muted === muted) {
    return;
  }
  channelState[channel].muted = muted;
  persistMute(channel);
  applyChannelState(channel);
  notify();
}

export function setMasterVolume(value: number): void {
  setChannelVolumeInternal('master', value);
}

export function setMusicVolume(value: number): void {
  setChannelVolumeInternal('music', value);
}

export function setSfxVolume(value: number): void {
  setChannelVolumeInternal('sfx', value);
}

export function setMasterMuted(muted: boolean): void {
  setChannelMutedInternal('master', muted);
}

export function setMusicMuted(muted: boolean): void {
  setChannelMutedInternal('music', muted);
}

export function setSfxMuted(muted: boolean): void {
  setChannelMutedInternal('sfx', muted);
}

export function getChannelState(channel: MixerChannel): MixerChannelState {
  const snapshot = getMixerState();
  return snapshot.channels[channel];
}

export function getAudioContext(): AudioContext | null {
  return getAudioContextOrInit();
}

export function resetMixerForTests(): void {
  channelNodes.master?.disconnect();
  channelNodes.music?.disconnect();
  channelNodes.sfx?.disconnect();
  channelNodes.master = undefined;
  channelNodes.music = undefined;
  channelNodes.sfx = undefined;
  audioCtx = null;
  resumeListenersAttached = false;
  listeners.clear();
  for (const channel of Object.keys(CHANNEL_CONFIG) as MixerChannel[]) {
    channelState[channel] = {
      volume: CHANNEL_CONFIG[channel].defaultVolume,
      muted: false
    };
  }
}
