import { describe, expect, it, vi } from 'vitest';

describe('game clock persistence', () => {
  it(
    'skips saving state while reload is in progress',
    async () => {
      vi.resetModules();
      const reloadState = await import('../../src/game/runtime/reloadState.ts');
      reloadState.setReloadInProgress(false);

      const game = await import('../../src/game.ts');
      const state = game.getGameStateInstance();
      const saveSpy = vi.spyOn(state, 'save').mockImplementation(() => {});

      try {
        game.__runGameClockTickForTest(1000);
        expect(saveSpy).toHaveBeenCalledTimes(1);

        saveSpy.mockClear();
        reloadState.setReloadInProgress(true);

        game.__runGameClockTickForTest(1000);
        expect(saveSpy).not.toHaveBeenCalled();
      } finally {
        reloadState.setReloadInProgress(false);
        saveSpy.mockRestore();
      }
    },
    15000
  );
});
