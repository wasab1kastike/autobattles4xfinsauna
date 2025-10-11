import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GameState } from '../../src/core/GameState.ts';
import { HexMap } from '../../src/hexmap.ts';
import { createObjectiveTracker } from '../../src/progression/objectives.ts';
import {
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds,
  STRONGHOLD_CONFIG
} from '../../src/world/strongholds.ts';

function makeTracker(map: HexMap): ReturnType<typeof createObjectiveTracker> {
  return createObjectiveTracker({
    state: new GameState(1000),
    map,
    getRosterCount: () => 0
  });
}

describe('enemy strongholds integration', () => {
  beforeEach(() => {
    resetStrongholdRegistry();
  });

  afterEach(() => {
    resetStrongholdRegistry();
  });

  it('reports seeded totals for a fresh session', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const tracker = makeTracker(map);

    const progress = tracker.getProgress();
    const expectedTotal = STRONGHOLD_CONFIG.strongholds.length;

    expect(progress.strongholds.total).toBe(expectedTotal);
    expect(progress.strongholds.remaining).toBe(expectedTotal);
    expect(progress.strongholds.destroyed).toBe(0);

    tracker.dispose();
  });

  it('cloaks uncaptured strongholds in fog on seed', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    for (const stronghold of STRONGHOLD_CONFIG.strongholds) {
      const tile = map.getTile(stronghold.coord.q, stronghold.coord.r);
      expect(tile).toBeDefined();
      expect(tile?.building).toBe('city');
      expect(tile?.isFogged).toBe(true);
    }
  });

  it('decrements remaining strongholds when a city falls', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const tracker = makeTracker(map);

    const [firstStronghold] = listStrongholds();
    expect(firstStronghold).toBeDefined();
    const tile = map.getTile(firstStronghold.coord.q, firstStronghold.coord.r);
    expect(tile?.building).toBe('city');

    tile?.placeBuilding(null);

    const progress = tracker.getProgress();
    const expectedRemaining = STRONGHOLD_CONFIG.strongholds.length - 1;

    expect(progress.strongholds.remaining).toBe(expectedRemaining);
    expect(progress.strongholds.destroyed).toBe(1);

    tracker.dispose();
  });
});
