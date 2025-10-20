import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnemySpawner } from '../src/sim/EnemySpawner.ts';
import { STRONGHOLD_PRESSURE_FACTOR } from '../src/game.ts';
import {
  evaluateEnemyRamp,
  type EnemyRampEvaluation
} from '../src/data/difficultyCurves.ts';
import { HexMap } from '../src/hexmap.ts';
import type { Unit } from '../src/units/Unit.ts';
import type { FactionBundleDefinition } from '../src/factions/bundles.ts';
import {
  countActiveStrongholds,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds,
  STRONGHOLD_CONFIG
} from '../src/world/strongholds.ts';
import * as enemySpawns from '../src/world/spawn/enemy_spawns.ts';

type SpawnerInternals = EnemySpawner & {
  pressureScale: number;
  multiplierScale: number;
  spawnCycles: number;
  interval: number;
  cadenceDecay: number;
  cadenceScale: number;
  computeNextInterval(evaluation: EnemyRampEvaluation): number;
  computeMultiplier(evaluation: EnemyRampEvaluation): number;
};

const MOCK_BUNDLE: FactionBundleDefinition = Object.freeze({
  id: 'pressure-test-bundle',
  label: 'Pressure Test Bundle',
  weight: 1,
  units: Object.freeze([{ unit: 'raider', level: 1, quantity: 1 }]),
  items: Object.freeze([]),
  modifiers: Object.freeze([])
});

describe('EnemySpawner pressure scaling', () => {
  beforeEach(() => {
    resetStrongholdRegistry();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetStrongholdRegistry();
  });

  it('tightens cadence as the pressure multiplier grows', () => {
    const spawner = new EnemySpawner({ difficulty: 1, random: () => 0.5 });
    const internal = spawner as unknown as SpawnerInternals;

    internal.spawnCycles = 12;
    internal.interval = 18;
    internal.cadenceDecay = 0.95;
    internal.cadenceScale = 1;

    const evaluation = evaluateEnemyRamp(1, {
      runSeconds: 480,
      clears: 6,
      spawnCycles: internal.spawnCycles
    });

    internal.pressureScale = 1;
    const baselineCadence = internal.computeNextInterval(evaluation);

    internal.interval = 18;
    internal.pressureScale = 1 + 4 * STRONGHOLD_PRESSURE_FACTOR;
    const fortifiedCadence = internal.computeNextInterval(evaluation);

    expect(fortifiedCadence).toBeLessThan(baselineCadence);
  });

  it('amplifies spawn multiplier when pressure grows', () => {
    const spawner = new EnemySpawner({ difficulty: 1, random: () => 0.5 });
    const internal = spawner as unknown as SpawnerInternals;

    internal.spawnCycles = 16;
    internal.multiplierScale = 1;
    internal.pressureScale = 1;

    const evaluation = evaluateEnemyRamp(1, {
      runSeconds: 720,
      clears: 8,
      spawnCycles: internal.spawnCycles
    });

    const baselineMultiplier = internal.computeMultiplier(evaluation);

    internal.pressureScale = 1 + 5 * STRONGHOLD_PRESSURE_FACTOR;
    const fortifiedMultiplier = internal.computeMultiplier(evaluation);

    expect(fortifiedMultiplier).toBeGreaterThan(baselineMultiplier);
  });

  it('returns the applied pressure multiplier to baseline after strongholds collapse', () => {
    vi.spyOn(enemySpawns, 'pickRampBundle').mockReturnValue(MOCK_BUNDLE);
    vi.spyOn(enemySpawns, 'spawnEnemyBundle').mockImplementation((options) => {
      const unit = {
        faction: options.factionId,
        isDead: () => true
      } as unknown as Unit;
      options.addUnit(unit);
      return {
        spawned: Object.freeze([unit]),
        items: Object.freeze([]),
        modifiers: Object.freeze([])
      };
    });

    const map = new HexMap(12, 12, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const strongholds = listStrongholds();
    expect(strongholds.length).toBeGreaterThan(0);

    const spawner = new EnemySpawner({ difficulty: 1, random: () => 0.5, eliteOdds: 0 });
    const units: Unit[] = [];
    const registerUnit = (unit: Unit) => {
      units.push(unit);
    };
    const pickEdge = () => ({ q: 0, r: 0 });

    const runForSeconds = (seconds: number) => {
      for (let tick = 0; tick < seconds; tick += 1) {
        spawner.update(1, units, registerUnit, pickEdge, {
          pressureMultiplier: 1 + countActiveStrongholds() * STRONGHOLD_PRESSURE_FACTOR
        });
        units.length = 0;
      }
    };

    runForSeconds(180);
    const fortified = spawner.getSnapshot();
    expect(fortified.pressureMultiplier).toBeGreaterThan(1);

    for (const entry of strongholds) {
      entry.captured = true;
      entry.structureHealth = 0;
    }
    expect(countActiveStrongholds()).toBe(0);

    runForSeconds(120);
    const collapsed = spawner.getSnapshot();

    expect(collapsed.pressureMultiplier).toBeCloseTo(1, 5);
    expect(collapsed.pressureMultiplier).toBeLessThan(fortified.pressureMultiplier);
  });
});
