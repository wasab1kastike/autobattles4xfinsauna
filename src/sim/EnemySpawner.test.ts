import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnemySpawner } from './EnemySpawner.ts';
import type { Unit } from '../units/Unit.ts';
import * as enemySpawns from '../world/spawn/enemy_spawns.ts';
import type { FactionBundleDefinition } from '../factions/bundles.ts';
import { getUnitArchetype } from '../unit/archetypes.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';

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
      units: Object.freeze([
        { unit: 'raider', level: 1, quantity: 1 },
        { unit: 'raider-shaman', level: 1, quantity: 1 }
      ]),
      items: Object.freeze([]),
      modifiers: Object.freeze([]),
      minRampTier: 0
    };
    const champion: FactionBundleDefinition = {
      id: 'frost-champion',
      label: 'Frost Champion',
      weight: 1,
      units: Object.freeze([{ unit: 'raider-captain', level: 2, quantity: 1 }]),
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
    expect(new Set(units.map((unit) => unit.type))).toEqual(
      new Set(['raider', 'raider-shaman'])
    );

    spawner.update(5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);

    spawner.update(23.5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(4);

    spawner.update(24, units, registerUnit, pickEdge);
    expect(units).toHaveLength(5);
    const lastUnit = units.at(-1);
    expect(lastUnit?.coord).toEqual({ q: 4, r: 0 });
    if (lastUnit) {
      const levelTwoStats = computeUnitStats(getUnitArchetype('raider-captain'), 2);
      expect(lastUnit.stats.health).toBe(levelTwoStats.health);
      expect(lastUnit.type).toBe('raider-captain');
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
      units: Object.freeze([{ unit: 'raider', level: 2, quantity: 1 }]),
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
        { unit: 'raider', level: 1, quantity: 1 },
        { unit: 'raider-captain', level: 2, quantity: 1 }
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
    const raiderLevelFour = computeUnitStats(getUnitArchetype('raider'), 4);
    const captainLevelSix = computeUnitStats(getUnitArchetype('raider-captain'), 6);
    const raiders = added.filter((unit) => unit.type === 'raider');
    const captains = added.filter((unit) => unit.type === 'raider-captain');
    expect(raiders).not.toHaveLength(0);
    expect(captains).not.toHaveLength(0);
    expect(raiders.every((unit) => unit.stats.health >= raiderLevelFour.health)).toBe(true);
    expect(captains.some((unit) => unit.stats.health >= captainLevelSix.health)).toBe(true);
  });

  it('counts living faction enemies once per update and reuses the slot budget while spawning', () => {
    const spawner = new EnemySpawner({ factionId: 'enemy', random: () => 0.42 });
    const makeUnit = (faction: string, dead: boolean): Unit =>
      ({ faction, isDead: () => dead } as unknown as Unit);

    const livingEnemies = [
      makeUnit('enemy', false),
      makeUnit('enemy', false),
      makeUnit('enemy', false)
    ];
    const units: Unit[] = [
      ...livingEnemies,
      makeUnit('enemy', true),
      makeUnit('allies', false)
    ];

    const internals = spawner as unknown as { timer: number; interval: number };
    internals.timer = -0.6;
    internals.interval = 0.01;

    const added: Unit[] = [];
    const registerUnit = (unit: Unit) => {
      units.push(unit);
      added.push(unit);
    };
    const pickEdge = () => ({ q: 0, r: 0 });

    const bundle: FactionBundleDefinition = {
      id: 'slot-budget',
      label: 'Slot Budget',
      weight: 1,
      units: Object.freeze([]),
      items: Object.freeze([]),
      modifiers: Object.freeze([])
    };

    const slotHistory: number[] = [];
    const spawnCounts: number[] = [];

    const bundleSpy = vi.spyOn(enemySpawns, 'pickRampBundle').mockReturnValue(bundle);
    const spawnSpy = vi
      .spyOn(enemySpawns, 'spawnEnemyBundle')
      .mockImplementation((options) => {
        slotHistory.push(options.availableSlots);
        const spawnCount = Math.min(2, Math.max(0, options.availableSlots));
        spawnCounts.push(spawnCount);
        const spawned: Unit[] = [];
        for (let index = 0; index < spawnCount; index += 1) {
          const unit = makeUnit('enemy', false);
          options.addUnit(unit);
          spawned.push(unit);
        }
        return {
          spawned: Object.freeze(spawned),
          items: Object.freeze([]),
          modifiers: Object.freeze([])
        };
      });

    try {
      spawner.update(1, units, registerUnit, pickEdge);
    } finally {
      bundleSpy.mockRestore();
      spawnSpy.mockRestore();
    }

    expect(slotHistory.length).toBeGreaterThan(1);
    expect(slotHistory[0]).toBe(MAX_ENEMIES - livingEnemies.length);
    expect(added.length).toBe(spawnCounts.reduce((sum, value) => sum + value, 0));

    let expectedSlots = slotHistory[0];
    for (let index = 0; index < slotHistory.length; index += 1) {
      expect(slotHistory[index]).toBe(expectedSlots);
      expectedSlots = Math.max(0, expectedSlots - spawnCounts[index]);
    }
  });
});
