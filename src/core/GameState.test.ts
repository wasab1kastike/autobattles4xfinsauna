import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState, Resource } from './GameState';
import '../events';

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

    expect(loaded.getResource(Resource.GOLD)).toBe(6); // 1 saved + 5 offline ticks
  });

  it('applies policy modifiers via listeners', () => {
    const state = new GameState(1000);
    state.applyPolicy('eco', 0); // free for testing
    state.tick();
    expect(state.getResource(Resource.GOLD)).toBe(2); // base 1 + eco policy
  });
});
