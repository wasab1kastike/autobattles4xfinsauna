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
    vi.mock('./sfx.ts', () => ({
      initAudioSafe: vi.fn(() => null),
      isMuted: vi.fn(() => false),
      onMuteChange: vi.fn(() => () => undefined),
    }));

    const ambience = await import('./ambience.ts');

    expect(ambience.isEnabled()).toBe(false);
    expect(ambience.getVolume()).toBeCloseTo(0.65, 5);
    expect(throwingStorage.getItem).toHaveBeenCalledTimes(2);
    expect(throwingStorage.getItem).toHaveBeenNthCalledWith(1, 'audio_enabled');
    expect(throwingStorage.getItem).toHaveBeenNthCalledWith(2, 'audio_volume');
  });
});
