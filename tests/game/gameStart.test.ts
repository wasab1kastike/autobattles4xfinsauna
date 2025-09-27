import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameClock } from '../../src/core/GameClock.ts';
import { resetAssetsForTest, setAssets } from '../../src/game/assets.ts';
import type { LoadedAssets } from '../../src/loader.ts';

describe('game start', () => {
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
  let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame | undefined;

  beforeEach(() => {
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const requestAnimationFrameMock = vi.fn((callback: FrameRequestCallback) => {
      // Do not invoke the callback to avoid recursively scheduling frames during tests.
      return 1;
    });
    const cancelAnimationFrameMock = vi.fn();
    globalThis.requestAnimationFrame = requestAnimationFrameMock as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = cancelAnimationFrameMock as unknown as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    resetAssetsForTest();
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      delete (globalThis as { requestAnimationFrame?: typeof globalThis.requestAnimationFrame }).requestAnimationFrame;
    }
    if (originalCancelAnimationFrame) {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      delete (globalThis as { cancelAnimationFrame?: typeof globalThis.cancelAnimationFrame }).cancelAnimationFrame;
    }
    vi.restoreAllMocks();
  });

  it('starts the game clock when the game starts', async () => {
    const assets: LoadedAssets = {
      images: {} as LoadedAssets['images'],
      sounds: {} as LoadedAssets['sounds'],
      atlases: { units: null }
    };
    const clockStartSpy = vi.spyOn(GameClock.prototype, 'start');
    const game = await import('../../src/game.ts');

    try {
      game.cleanup();
      setAssets(assets);
      await game.start();
      expect(clockStartSpy).toHaveBeenCalled();
    } finally {
      clockStartSpy.mockRestore();
      game.cleanup();
    }
  });
});
