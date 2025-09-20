import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnemySpawner } from './EnemySpawner.ts';
import type { Unit } from '../units/Unit.ts';
import { getAvantoMarauderStats } from '../units/AvantoMarauder.ts';
import * as enemySpawns from '../world/spawn/enemy_spawns.ts';
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
      random: makeRandomSource([0.6, 0.8, 0.6, 0.4, 0.9])
    });
    const raiders: FactionBundleDefinition = {
      id: 'raiding-party',
      label: 'Raiding Party',
      weight: 2,
      units: Object.freeze([{ unit: 'avanto-marauder', level: 1, quantity: 2 }]),
      items: Object.freeze([]),
      modifiers: Object.freeze([]),
      minRampTier: 0
    };
    const champion: FactionBundleDefinition = {
      id: 'frost-champion',
      label: 'Frost Champion',
      weight: 1,
      units: Object.freeze([{ unit: 'avanto-marauder', level: 2, quantity: 1 }]),
      items: Object.freeze([]),
      modifiers: Object.freeze([]),
      minRampTier: 0
    };
    const picks = [raiders, raiders, champion];
    const bundleSpy = vi
      .spyOn(enemySpawns, 'pickRampBundle')
      .mockImplementation(() => picks.shift() ?? champion);
    const units: Unit[] = [];
    let edgeCursor = 0;
    const added: Unit[] = [];

    const registerUnit = (unit: Unit) => {
      units.push(unit);
      added.push(unit);
    };
    const pickEdge = () => ({ q: edgeCursor++, r: 0 });

    spawner.update(25, units, registerUnit, pickEdge);
    expect(units).toHaveLength(0);

    spawner.update(1.5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);
    expect(added.map((unit) => unit.coord)).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);
    expect(units.every((unit) => unit.faction === 'enemy')).toBe(true);

    spawner.update(5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);

    spawner.update(23.5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(4);

    spawner.update(24, units, registerUnit, pickEdge);
    expect(units).toHaveLength(5);
    const lastUnit = units.at(-1);
    expect(lastUnit?.coord).toEqual({ q: 4, r: 0 });
    if (lastUnit) {
      const levelTwoStats = getAvantoMarauderStats(2);
      expect(lastUnit.stats.health).toBe(levelTwoStats.health);
    }
    bundleSpy.mockRestore();
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
    const bundleSpy = vi.spyOn(enemySpawns, 'pickRampBundle').mockReturnValue(fixedBundle);

    let previousCycles = 0;
    const cadenceHistory: number[] = [];
    const multiplierHistory: number[] = [];
    const tierHistory: number[] = [];
    const enemyStub = { faction: 'enemy', isDead: () => false } as unknown as Unit;

    const stepSeconds = 0.75;
    for (let iterations = 0; iterations < 600 && multiplierHistory.length < 25; iterations += 1) {
      units.length = 0;
      if (iterations % 2 === 0) {
        units.push(enemyStub);
      }
      spawner.update(stepSeconds, units, () => undefined, pickEdge);
      units.length = 0;
      const snapshot = spawner.getSnapshot();
      if (snapshot.spawnCycles > previousCycles) {
        cadenceHistory.push(snapshot.lastCadence);
        multiplierHistory.push(snapshot.difficultyMultiplier);
        tierHistory.push(snapshot.bundleTier);
        previousCycles = snapshot.spawnCycles;
      }
    }

    bundleSpy.mockRestore();

    expect(cadenceHistory.length).toBeGreaterThanOrEqual(10);
    expect(cadenceHistory[cadenceHistory.length - 1]).toBeLessThan(cadenceHistory[0]);
    expect(Math.min(...cadenceHistory.slice(1))).toBeLessThan(cadenceHistory[0]);
    expect(multiplierHistory[0]).toBeGreaterThan(0);
    expect(multiplierHistory[multiplierHistory.length - 1]).toBeGreaterThan(
      multiplierHistory[0]
    );
    expect(Math.max(...tierHistory)).toBeGreaterThan(0);
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
      difficultyMultiplier: 2,
      rampTier: 2
    });

    expect(result.spawned).toHaveLength(6);
    expect(added).toHaveLength(6);
    const levelFourStats = getAvantoMarauderStats(4);
    const levelSixStats = getAvantoMarauderStats(6);
    const spawnedHealth = added.map((unit) => unit.stats.health);
    expect(spawnedHealth.some((value) => value >= levelSixStats.health)).toBe(true);
    expect(spawnedHealth.every((value) => value >= levelFourStats.health)).toBe(true);
  });
});
