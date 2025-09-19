import { describe, expect, it, vi } from 'vitest';
import { createSaunaHeat } from '../../sauna/heat.ts';
import { processPlayerSpawns } from './player_spawns.ts';
import { Unit as UnitClass } from '../../units/Unit.ts';
import { getSoldierStats } from '../../units/Soldier.ts';

describe('processPlayerSpawns', () => {
  it('vents heat and blocks spawns when the roster cap is zero', () => {
    const heat = createSaunaHeat({ baseThreshold: 10, initialHeat: 10, heatPerSecond: 0 });
    const spawnUnit = vi.fn(() => new UnitClass('u-blocked', 'soldier', { q: 0, r: 0 }, 'player', getSoldierStats()));

    const result = processPlayerSpawns({
      heat,
      availableUpkeep: 50,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnUnit,
      minUpkeepReserve: 0,
      maxSpawns: 2,
      rosterCap: 0,
      getRosterCount: () => 0
    });

    expect(result.spawned).toBe(0);
    expect(result.blockedByRoster).toBe(1);
    expect(result.ventedHeat).toBeGreaterThan(0);
    expect(heat.getHeat()).toBeLessThan(heat.getThreshold());
    expect(spawnUnit).not.toHaveBeenCalled();
  });

  it('spawns once the roster cap allows new attendants', () => {
    const heat = createSaunaHeat({ baseThreshold: 6, initialHeat: 6, heatPerSecond: 0 });
    let rosterCount = 0;

    const result = processPlayerSpawns({
      heat,
      availableUpkeep: 50,
      pickSpawnTile: () => ({ q: 2, r: -1 }),
      spawnUnit: (coord) => {
        rosterCount += 1;
        return new UnitClass(`u-${rosterCount}`, 'soldier', coord, 'player', getSoldierStats());
      },
      minUpkeepReserve: 0,
      maxSpawns: 3,
      rosterCap: 2,
      getRosterCount: () => rosterCount
    });

    expect(result.spawned).toBe(1);
    expect(result.blockedByRoster).toBe(0);
    expect(heat.hasTriggerReady()).toBe(false);
    expect(rosterCount).toBe(1);
  });
});
