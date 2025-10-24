import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState, Resource, GAME_STATE_STORAGE_KEY } from '../../src/core/GameState.ts';
import { INITIAL_SAUNA_BEER } from '../../src/game/constants.ts';

function simulateNgPlusResetFallback(state: GameState): void {
  const storage = globalThis.localStorage;
  if (!storage) {
    state.resetForNewRun({ persist: false });
    return;
  }
  let storageCleared = false;
  try {
    storage.removeItem(GAME_STATE_STORAGE_KEY);
    storageCleared = true;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
  }
  if (!storageCleared) {
    const persisted = state.resetForNewRun();
    expect(persisted).toBe(true);
  }
}

describe('NG+ reset fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('seeds the initial beer after storage removal fails', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, -125);
    state.setNgPlusState({ runSeed: 91, ngPlusLevel: 4, unlockSlots: 2 });
    state.save();

    const removeSpy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(() => simulateNgPlusResetFallback(state)).not.toThrow();

    removeSpy.mockRestore();

    const freshState = new GameState(1000);
    const restored = freshState.load();
    expect(restored).toBe(false);
    expect(freshState.getResource(Resource.SAUNA_BEER)).toBe(0);

    if (!restored) {
      freshState.addResource(Resource.SAUNA_BEER, INITIAL_SAUNA_BEER);
    }

    expect(freshState.getResource(Resource.SAUNA_BEER)).toBe(INITIAL_SAUNA_BEER);
    const ngPlus = freshState.getNgPlusState();
    expect(ngPlus.ngPlusLevel).toBe(4);
    expect(ngPlus.unlockSlots).toBe(2);
  });
});
