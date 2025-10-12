import { describe, expect, it } from 'vitest';
import { createInitialState, simulateBattle, stepBattle } from '../../src/game/simulation';

describe('battle simulation', () => {
  it('progresses ticks when stepping', () => {
    const state = createInitialState(1234);
    const next = stepBattle(state);
    expect(next.snapshot.tick).toBe(1);
    expect(next.snapshot.events.length).toBeGreaterThan(0);
  });

  it('declares a winner within a bounded number of ticks', () => {
    const snapshot = simulateBattle(4321, 400);
    expect(snapshot.winner).toBeDefined();
  });
});
