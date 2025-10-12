import { beforeEach, describe, expect, it } from 'vitest';

import { GameState } from '../../src/core/GameState.ts';
import { HexMap } from '../../src/hexmap.ts';
import {
  createObjectiveTracker,
  type ObjectiveResolution,
  type ObjectiveTracker
} from '../../src/progression/objectives.ts';
import { eventBus } from '../../src/events/index.ts';

describe('ObjectiveTracker run counters', () => {
  let now = 0;
  let rosterCount = 1;
  const timeSource = () => now;

  beforeEach(() => {
    now = 0;
    rosterCount = 1;
  });

  function makeTracker(map?: HexMap): ObjectiveTracker {
    return createObjectiveTracker({
      state: new GameState(1000),
      map: map ?? new HexMap(3, 3),
      getRosterCount: () => rosterCount,
      timeSource
    });
  }

  it('tracks enemy kills and exploration per run and resets on new tracker', () => {
    const map = new HexMap(3, 3);
    const tracker = makeTracker(map);

    eventBus.emit('unitDied', { unitId: 'foe-1', unitFaction: 'enemy' });
    map.revealAround({ q: 0, r: 0 }, 0, { autoFrame: false });

    const progress = tracker.getProgress();
    expect(progress.enemyKills).toBe(1);
    expect(progress.exploration.revealedHexes).toBe(1);

    tracker.dispose();

    const freshTracker = makeTracker(new HexMap(3, 3));
    const freshProgress = freshTracker.getProgress();
    expect(freshProgress.enemyKills).toBe(0);
    expect(freshProgress.exploration.revealedHexes).toBe(0);
    freshTracker.dispose();
  });

  it('captures kill and exploration totals in resolution summary', async () => {
    const map = new HexMap(4, 4);
    const tracker = makeTracker(map);

    eventBus.emit('unitDied', { unitId: 'foe-1', unitFaction: 'enemy' });
    eventBus.emit('unitDied', { unitId: 'foe-2', unitFaction: 'enemy' });
    map.revealAround({ q: 0, r: 0 }, 1, { autoFrame: false });
    const expectedExploration = tracker.getProgress().exploration.revealedHexes;

    const resolutionPromise = new Promise<ObjectiveResolution>((resolve) => {
      tracker.onResolution(resolve);
    });

    eventBus.emit('saunaDestroyed', { attackerFaction: 'enemy' });

    const resolution = await resolutionPromise;
    expect(resolution.summary.enemyKills).toBe(2);
    expect(resolution.summary.exploration.revealedHexes).toBe(expectedExploration);
  });

  it('normalizes NaN roster counts and still triggers roster wipe defeat', async () => {
    rosterCount = Number.NaN;
    const tracker = createObjectiveTracker({
      state: new GameState(1000),
      map: new HexMap(2, 2),
      getRosterCount: () => rosterCount,
      timeSource,
      rosterWipeGraceMs: 0
    });

    const resolutionPromise = new Promise<ObjectiveResolution>((resolve) => {
      tracker.onResolution(resolve);
    });

    eventBus.emit('unitDied', { unitId: 'hero-1', unitFaction: 'player' });

    const progress = tracker.getProgress();
    expect(progress.roster.active).toBe(0);

    const resolution = await resolutionPromise;
    expect(resolution.cause).toBe('rosterWipe');

    tracker.dispose();
  });
});
