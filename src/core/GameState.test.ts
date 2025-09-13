import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState } from './GameState';

describe('GameState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves to and loads from localStorage with offline progress', () => {
    const state = new GameState(1000);
    state.tick(); // +1 resource
    state.save();
    expect(localStorage.getItem('gameState')).not.toBeNull();

    // simulate 5 seconds offline
    vi.setSystemTime(5000);
    const loaded = new GameState(1000);
    loaded.load();

    expect(loaded.resources).toBe(6); // 1 saved + 5 offline ticks
  });
});
