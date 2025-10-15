import { afterEach, describe, expect, it, vi } from 'vitest';

class StubGainNode {
  public readonly gain = {
    value: 1,
    cancelScheduledValues: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    setValueAtTime: vi.fn()
  };
  public readonly context: StubAudioContext;

  constructor(context: StubAudioContext) {
    this.context = context;
  }

  connect = vi.fn();
  disconnect = vi.fn();
}

class StubBufferSourceNode {
  public buffer: AudioBuffer | null = null;
  public loop = false;
  public readonly context: StubAudioContext;

  constructor(context: StubAudioContext) {
    this.context = context;
  }

  connect = vi.fn();
  disconnect = vi.fn();
  addEventListener = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class StubAudioContext {
  public currentTime = 0;
  public readonly destination = {};

  createGain(): StubGainNode {
    return new StubGainNode(this);
  }

  createBufferSource(): StubBufferSourceNode {
    return new StubBufferSourceNode(this);
  }

  async decodeAudioData(): Promise<AudioBuffer> {
    return { duration: 8 } as unknown as AudioBuffer;
  }

  async resume(): Promise<void> {
    // no-op
  }
}

describe('ambience asset resolution', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('fetches ambience sources with the deployment base', async () => {
    vi.resetModules();
    vi.useFakeTimers();

    const originalBase = import.meta.env.BASE_URL;
    import.meta.env.BASE_URL = '/custom-base/';

    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    })) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    const mixerState = {
      channels: {
        master: { volume: 0.9, muted: false, effectiveVolume: 0.9 },
        music: { volume: 0.65, muted: false, effectiveVolume: 0.65 },
        sfx: { volume: 1, muted: false, effectiveVolume: 1 }
      },
      contextState: 'suspended' as const
    };

    const stubContext = new StubAudioContext();
    vi.doMock('../../src/audio/mixer.ts', () => ({
      getChannelGainNode: vi.fn(() => null),
      getMixerState: vi.fn(() => mixerState),
      initAudioContext: vi.fn(() => stubContext as unknown as AudioContext),
      onMixerChange: vi.fn(() => () => {}),
      setMusicVolume: vi.fn()
    }));

    try {
      const ambience = await import('../../src/audio/ambience.ts');
      ambience.setEnabled(true);
      await ambience.play();

      expect(fetchMock).toHaveBeenCalled();
      const firstUrl = fetchMock.mock.calls[0]?.[0];
      expect(firstUrl).toBe('/custom-base/assets/sounds/sauna-forest.ogg');
      ambience.stop();
    } finally {
      import.meta.env.BASE_URL = originalBase;
      vi.doUnmock('../../src/audio/mixer.ts');
      vi.resetModules();
      globalThis.fetch = originalFetch;
    }
  });
});
