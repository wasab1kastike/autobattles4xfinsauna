import { describe, expect, it, vi } from 'vitest';
import { createSaunaHeat } from '../../sauna/heat.ts';
import { processPlayerSpawns } from './player_spawns.ts';
import { createPlayerSpawnTierQueue } from './tier_helpers.ts';
import type { Unit } from '../../units/Unit.ts';
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

  it('queues reinforcements when the active tier is full and deploys them once space opens', () => {
    const heat = createSaunaHeat({ baseThreshold: 8, initialHeat: 8, heatPerSecond: 0 });
    const tier = {
      id: 'aurora-ward',
      name: 'Aurora Ward',
      rosterCap: 2,
      description: 'test tier',
      art: { badge: 'badge.svg' },
      unlock: { type: 'default', label: 'Always ready' }
    } as const;

    let rosterCount = 2;
    const tierHelpers = createPlayerSpawnTierQueue({
      getTier: () => tier,
      getRosterLimit: () => tier.rosterCap,
      getRosterCount: () => rosterCount,
      log: () => {},
      queueCapacity: 2
    });

    const units: Unit[] = [];

    const first = processPlayerSpawns({
      heat,
      availableUpkeep: 50,
      pickSpawnTile: () => ({ q: 0, r: 0 }),
      spawnUnit: (coord) => {
        const unit = new UnitClass(`queued-${units.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
        units.push(unit);
        rosterCount += 1;
        return unit;
      },
      minUpkeepReserve: 0,
      maxSpawns: 2,
      rosterCap: tier.rosterCap,
      getRosterCount: () => rosterCount,
      tierHelpers
    });

    expect(first.spawned).toBe(0);
    expect(first.blockedByRoster).toBe(1);
    expect(tierHelpers.hasQueuedSpawn()).toBe(true);

    rosterCount = 1;
    expect(heat.hasTriggerReady()).toBe(false);

    const second = processPlayerSpawns({
      heat,
      availableUpkeep: 50,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnUnit: (coord) => {
        const unit = new UnitClass(`queued-${units.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
        units.push(unit);
        rosterCount += 1;
        return unit;
      },
      minUpkeepReserve: 0,
      maxSpawns: 2,
      rosterCap: tier.rosterCap,
      getRosterCount: () => rosterCount,
      tierHelpers
    });

    expect(second.spawned).toBe(1);
    expect(tierHelpers.hasQueuedSpawn()).toBe(false);
    expect(rosterCount).toBe(2);
  });
});
