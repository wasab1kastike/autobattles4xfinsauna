import { afterEach, describe, expect, it, vi } from 'vitest';

class FakeAudioParam {
  value: number;

  constructor(value: number) {
    this.value = value;
  }

  setValueAtTime(value: number): void {
    this.value = value;
  }
}

class FakeGainNode {
  readonly context: FakeAudioContext;
  readonly gain: FakeAudioParam;
  readonly connections: unknown[] = [];

  constructor(context: FakeAudioContext, initial: number) {
    this.context = context;
    this.gain = new FakeAudioParam(initial);
  }

  connect(node: unknown): void {
    this.connections.push(node);
  }

  disconnect(): void {
    this.connections.length = 0;
  }
}

class FakeAudioContext {
  readonly destination = { id: 'destination' };
  readonly currentTime = 0;
  readonly sampleRate = 48000;
  state: AudioContextState = 'running';

  createGain(): FakeGainNode {
    return new FakeGainNode(this, 1);
  }

  async resume(): Promise<void> {
    this.state = 'running';
  }
}

describe('audio mixer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('restores persisted channel settings from localStorage', async () => {
    const storage = {
      getItem: vi.fn((key: string) => {
        switch (key) {
          case 'audio.mixer.master.volume':
            return '0.42';
          case 'audio.mixer.music.volume':
            return '0.58';
          case 'audio.mixer.sfx.muted':
            return 'true';
          default:
            return null;
        }
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      get length() {
        return 0;
      }
    } satisfies Partial<Storage>;

    vi.stubGlobal('localStorage', storage as Storage);

    const mixer = await import('./mixer.ts');
    const state = mixer.getMixerState();

    expect(state.channels.master.volume).toBeCloseTo(0.42, 5);
    expect(state.channels.music.volume).toBeCloseTo(0.58, 5);
    expect(state.channels.sfx.muted).toBe(true);
    expect(storage.getItem).toHaveBeenCalledWith('audio.mixer.master.volume');
    expect(storage.getItem).toHaveBeenCalledWith('audio.mixer.music.volume');
    expect(storage.getItem).toHaveBeenCalledWith('audio.mixer.sfx.muted');

    mixer.resetMixerForTests();
  });

  it('routes channel gain nodes through the master bus', async () => {
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      get length() {
        return 0;
      }
    } satisfies Partial<Storage>;
    vi.stubGlobal('localStorage', storage as Storage);

    vi.stubGlobal(
      'window',
      {
        AudioContext: FakeAudioContext,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      } as unknown as typeof window
    );

    const mixer = await import('./mixer.ts');

    const ctx = mixer.initAudioContext();
    expect(ctx).toBeInstanceOf(FakeAudioContext);

    const master = mixer.getChannelGainNode('master') as FakeGainNode;
    const music = mixer.getChannelGainNode('music') as FakeGainNode;
    const sfx = mixer.getChannelGainNode('sfx') as FakeGainNode;

    expect(master).toBeInstanceOf(FakeGainNode);
    expect(music).toBeInstanceOf(FakeGainNode);
    expect(sfx).toBeInstanceOf(FakeGainNode);

    expect(master.connections).toContain((ctx as FakeAudioContext).destination);
    expect(music.connections).toContain(master);
    expect(sfx.connections).toContain(master);

    mixer.setMasterMuted(true);
    expect(master.gain.value).toBe(0);

    mixer.setMasterMuted(false);
    mixer.setMusicVolume(0.37);
    mixer.setSfxMuted(true);

    expect(music.gain.value).toBeCloseTo(0.37, 5);
    expect(sfx.gain.value).toBe(0);

    mixer.resetMixerForTests();
  });
});
