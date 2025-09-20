import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnemySpawner } from './EnemySpawner.ts';
import type { Unit } from '../units/Unit.ts';
import { getAvantoMarauderStats } from '../units/AvantoMarauder.ts';
import * as enemySpawns from '../world/spawn/enemy_spawns.ts';
import * as factionBundles from '../factions/bundles.ts';
import type { FactionBundleDefinition } from '../factions/bundles.ts';

function makeRandomSource(values: number[]): () => number {
  const queue = [...values];
  return () => queue.shift() ?? 0;
}

describe('EnemySpawner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns bundles according to cadence and faction identity', () => {
    const spawner = new EnemySpawner({
      factionId: 'enemy',
      eliteOdds: 0.5,
      random: makeRandomSource([0.6, 0.8, 0.6, 0.4, 0.1])
    });
    const units: Unit[] = [];
    const edges = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ];
    const added: Unit[] = [];

    const registerUnit = (unit: Unit) => {
      units.push(unit);
      added.push(unit);
    };
    const pickEdge = () => edges.shift();

    spawner.update(29, units, registerUnit, pickEdge);
    expect(units).toHaveLength(0);

    spawner.update(1, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);
    expect(added.map((unit) => unit.coord)).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);
    expect(units.every((unit) => unit.faction === 'enemy')).toBe(true);

    spawner.update(5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);

    spawner.update(23.5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(3);
    const lastUnit = units.at(-1);
    expect(lastUnit?.coord).toEqual({ q: 2, r: 0 });
    if (lastUnit) {
      const levelTwoStats = getAvantoMarauderStats(2);
      expect(lastUnit.stats.health).toBe(levelTwoStats.health);
    }
  });

  it('ramps spawn cadence and requests progressively higher tiers', () => {
    const spawner = new EnemySpawner({
      factionId: 'enemy',
      difficulty: 1.5,
      eliteOdds: 0,
      random: () => 0.99
    });
    const units: Unit[] = [];
    let edgeCursor = 0;
    const pickEdge = () => ({ q: edgeCursor++, r: 0 });

    const fixedBundle: FactionBundleDefinition = {
      id: 'enemy-ramp-test',
      label: 'Enemy Ramp Test',
      weight: 1,
      units: Object.freeze([{ unit: 'avanto-marauder', level: 2, quantity: 1 }]),
      items: Object.freeze([]),
      modifiers: Object.freeze([])
    };
    const bundleSpy = vi.spyOn(factionBundles, 'pickFactionBundle').mockReturnValue(fixedBundle);

    const actualSpawn = enemySpawns.spawnEnemyBundle;
    const spawnTimes: number[] = [];
    const multipliers: number[] = [];
    const capturedSpawns: Unit[][] = [];

    let elapsed = 0;
    const spawnSpy = vi
      .spyOn(enemySpawns, 'spawnEnemyBundle')
      .mockImplementation((options) => {
        multipliers.push(options.difficultyMultiplier ?? 1);
        spawnTimes.push(elapsed);
        const result = actualSpawn(options);
        capturedSpawns.push([...result.spawned]);
        return result;
      });

    const targetSpawns = 15;
    for (let iterations = 0; iterations < 500 && spawnTimes.length < targetSpawns; iterations += 1) {
      elapsed += 1;
      spawner.update(1, units, () => undefined, pickEdge);
    }

    spawnSpy.mockRestore();
    bundleSpy.mockRestore();

    expect(spawnTimes.length).toBeGreaterThanOrEqual(targetSpawns);
    const intervals = spawnTimes.map((time, index) =>
      index === 0 ? time : time - spawnTimes[index - 1]
    );
    expect(intervals[intervals.length - 1]).toBeLessThan(8);
    expect(Math.min(...intervals.slice(1))).toBeLessThan(intervals[1]);
    expect(multipliers[0]).toBe(1);
    expect(multipliers[multipliers.length - 1]).toBeGreaterThan(multipliers[0]);

    const lastSpawn = capturedSpawns.at(-1) ?? [];
    for (const unit of lastSpawn) {
      const baseStats = getAvantoMarauderStats(2);
      expect(unit.stats.health).toBeGreaterThan(baseStats.health);
    }
  });

  it('scales spawn bundles with the provided difficulty multiplier', () => {
    const bundle: FactionBundleDefinition = {
      id: 'test-bundle',
      label: 'Test Bundle',
      weight: 1,
      units: [
        { unit: 'avanto-marauder', level: 1, quantity: 1 },
        { unit: 'avanto-marauder', level: 2, quantity: 1 }
      ],
      items: Object.freeze([]),
      modifiers: Object.freeze([])
    };
    const added: Unit[] = [];
    let idCounter = 0;
    const result = enemySpawns.spawnEnemyBundle({
      bundle,
      factionId: 'enemy',
      pickEdge: () => ({ q: 0, r: 0 }),
      addUnit: (unit: Unit) => {
        added.push(unit);
      },
      makeId: () => `test-${idCounter++}`,
      availableSlots: 6,
      eliteOdds: 0,
      random: () => 0.9,
      difficultyMultiplier: 2
    });

    expect(result.spawned).toHaveLength(4);
    expect(added).toHaveLength(4);
    const levelTwoStats = getAvantoMarauderStats(2);
    const levelFourStats = getAvantoMarauderStats(4);
    const spawnedHealth = added.map((unit) => unit.stats.health);
    expect(spawnedHealth.some((value) => value >= levelFourStats.health)).toBe(true);
    expect(spawnedHealth.every((value) => value >= levelTwoStats.health)).toBe(true);
  });
});
