import { beforeEach, describe, expect, it } from 'vitest';
import {
  disposeHudSignals,
  getHudElapsedMs,
  notifyEnemyRamp,
  notifyHudElapsed,
  setHudElapsedMs,
  subscribeEnemyRamp,
  subscribeHudTime,
  unsubscribeEnemyRamp,
  unsubscribeHudTime
} from '../../../src/game/signals/hud.ts';
import type { EnemyRampSummary } from '../../../src/ui/topbar.ts';

function buildEnemyRampSummary(overrides: Partial<EnemyRampSummary> = {}): EnemyRampSummary {
  return {
    stage: 'Rally',
    stageIndex: 1,
    bundleTier: 0,
    multiplier: 1,
    cadenceSeconds: 30,
    effectiveDifficulty: 1,
    aggressionMultiplier: 1,
    cadenceMultiplier: 1,
    strengthMultiplier: 1,
    calmSecondsRemaining: 0,
    spawnCycles: 0,
    ...overrides
  };
}

describe('HUD signals', () => {
  beforeEach(() => {
    disposeHudSignals();
    setHudElapsedMs(0);
    notifyHudElapsed(getHudElapsedMs());
    notifyEnemyRamp(null);
  });

  it('delivers HUD time updates and respects unsubscribe', () => {
    const received: number[] = [];
    const listener = (value: number) => received.push(value);

    const unsubscribe = subscribeHudTime(listener);
    expect(received).toEqual([0]);

    setHudElapsedMs(500);
    notifyHudElapsed(getHudElapsedMs());
    expect(received).toEqual([0, 500]);

    unsubscribeHudTime(listener);
    unsubscribe();

    setHudElapsedMs(900);
    notifyHudElapsed(getHudElapsedMs());
    expect(received).toEqual([0, 500]);
  });

  it('clears HUD time listeners on dispose but retains the latest snapshot', () => {
    const calls: number[] = [];
    subscribeHudTime((value) => calls.push(value));

    setHudElapsedMs(250);
    notifyHudElapsed(getHudElapsedMs());
    expect(calls).toEqual([0, 250]);

    disposeHudSignals();

    setHudElapsedMs(400);
    notifyHudElapsed(getHudElapsedMs());
    expect(calls).toEqual([0, 250]);

    const second: number[] = [];
    const unsubscribe = subscribeHudTime((value) => second.push(value));
    expect(second).toEqual([400]);

    setHudElapsedMs(800);
    notifyHudElapsed(getHudElapsedMs());
    expect(second).toEqual([400, 800]);

    unsubscribe();
  });

  it('notifies enemy ramp subscribers and honors unsubscribe and dispose', () => {
    const updates: Array<EnemyRampSummary | null> = [];
    const listener = (summary: EnemyRampSummary | null) => updates.push(summary);
    const unsubscribe = subscribeEnemyRamp(listener);

    expect(updates).toEqual([null]);

    const summary = buildEnemyRampSummary({ stage: 'Siege', stageIndex: 2 });
    notifyEnemyRamp(summary);
    expect(updates).toEqual([null, summary]);

    unsubscribeEnemyRamp(listener);
    unsubscribe();

    const nextSummary = buildEnemyRampSummary({ stage: 'Assault', stageIndex: 3 });
    notifyEnemyRamp(nextSummary);
    expect(updates).toEqual([null, summary]);

    const postDispose: Array<EnemyRampSummary | null> = [];
    disposeHudSignals();
    notifyEnemyRamp(nextSummary);
    expect(updates).toEqual([null, summary]);

    const unsubscribeSecond = subscribeEnemyRamp((value) => postDispose.push(value));
    expect(postDispose).toEqual([nextSummary]);

    notifyEnemyRamp(summary);
    expect(postDispose).toEqual([nextSummary, summary]);

    unsubscribeSecond();
  });
});
