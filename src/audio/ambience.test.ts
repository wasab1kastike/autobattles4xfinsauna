import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ambience storage resilience', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('falls back to defaults when persisted preferences are unavailable', async () => {
    vi.resetModules();
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('storage disabled');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      get length() {
        return 0;
      },
    };

    vi.stubGlobal('localStorage', throwingStorage as unknown as Storage);
    vi.mock('./mixer.ts', () => ({
      getMixerState: () => ({
        channels: {
          master: { volume: 0.9, muted: false, effectiveVolume: 0.9 },
          music: { volume: 0.65, muted: false, effectiveVolume: 0.585 },
          sfx: { volume: 1, muted: false, effectiveVolume: 0.9 }
        },
        contextState: 'uninitialized'
      }),
      initAudioContext: vi.fn(() => null),
      getChannelGainNode: vi.fn(() => null),
      onMixerChange: vi.fn(() => () => undefined),
      setMusicVolume: vi.fn()
    }));

    const ambience = await import('./ambience.ts');

    expect(ambience.isEnabled()).toBe(false);
    expect(ambience.getVolume()).toBeCloseTo(0.65, 5);
    expect(throwingStorage.getItem).toHaveBeenCalledTimes(1);
    expect(throwingStorage.getItem).toHaveBeenNthCalledWith(1, 'audio_enabled');
  });
});
