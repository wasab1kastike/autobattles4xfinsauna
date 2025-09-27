import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { resetAssetsForTest, setAssets } from '../../src/game/assets.ts';
import { resetGamePause, setGamePaused } from '../../src/game/pause.ts';
import type { LoadedAssets } from '../../src/loader.ts';

describe('game pause clock integration', () => {
  let originalRequestAnimationFrame: typeof globalThis.requestAnimationFrame | undefined;
  let originalCancelAnimationFrame: typeof globalThis.cancelAnimationFrame | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    originalRequestAnimationFrame = globalThis.requestAnimationFrame;
    originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
    const requestAnimationFrameMock = vi.fn(() => 1);
    const cancelAnimationFrameMock = vi.fn();
    globalThis.requestAnimationFrame = requestAnimationFrameMock as unknown as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = cancelAnimationFrameMock as unknown as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    resetAssetsForTest();
    resetGamePause();
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
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('halts clock ticks while paused and resumes on unpause', async () => {
    const assets: LoadedAssets = {
      images: {} as LoadedAssets['images'],
      sounds: {} as LoadedAssets['sounds'],
      atlases: { units: null }
    };
    const tickSpy = vi.spyOn(GameState.prototype, 'tick');
    const game = await import('../../src/game.ts');
    try {
      game.cleanup();
      setAssets(assets);
      await game.start();

      vi.advanceTimersByTime(1000);
      expect(tickSpy).toHaveBeenCalled();

      tickSpy.mockClear();
      setGamePaused(true);
      vi.advanceTimersByTime(5000);
      expect(tickSpy).not.toHaveBeenCalled();

      setGamePaused(false);
      vi.advanceTimersByTime(1000);
      expect(tickSpy).toHaveBeenCalled();
    } finally {
      resetGamePause();
      tickSpy.mockRestore();
      game.cleanup();
    }
  });
});
