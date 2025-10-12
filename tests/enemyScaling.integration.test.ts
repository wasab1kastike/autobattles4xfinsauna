import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnemySpawner, type EnemySpawnerRuntimeModifiers } from '../src/sim/EnemySpawner.ts';
import type { Unit } from '../src/units/Unit.ts';
import type { FactionBundleDefinition } from '../src/factions/bundles.ts';
import * as enemySpawns from '../src/world/spawn/enemy_spawns.ts';

type EnemySpawnerSnapshot = ReturnType<EnemySpawner['getSnapshot']>;

function simulateRamp(
  modifiers: ((tick: number, spawner: EnemySpawner) => EnemySpawnerRuntimeModifiers | undefined) | undefined
): EnemySpawnerSnapshot {
  const spawner = new EnemySpawner({
    random: () => 0.5,
    eliteOdds: 0,
    difficulty: 1
  });
  const units: Unit[] = [];
  const registerUnit = (unit: Unit) => {
    units.push(unit);
  };
  const pickEdge = () => ({ q: 0, r: 0 });
  for (let tick = 0; tick < 60; tick += 1) {
    const modifier = modifiers?.(tick, spawner);
    spawner.update(1, units, registerUnit, pickEdge, modifier ?? {});
    units.length = 0;
  }
  return spawner.getSnapshot();
}

describe('enemy scaling integration', () => {
  const bundle: FactionBundleDefinition = {
    id: 'integration-test',
    label: 'Integration Test',
    weight: 1,
    units: Object.freeze([{ unit: 'raider', level: 1, quantity: 1 }]),
    items: Object.freeze([]),
    modifiers: Object.freeze([])
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('applies calm modifiers to reduce spawn pressure', () => {
    vi.spyOn(enemySpawns, 'pickRampBundle').mockReturnValue(bundle);
    const baseline = simulateRamp(undefined);
    const calm = simulateRamp((tick) => (tick === 0 ? { calmSecondsRemaining: 120 } : undefined));
    expect(calm.spawnCycles).toBeLessThan(baseline.spawnCycles);
    expect(calm.calmSecondsRemaining).toBeGreaterThan(0);
    expect(calm.cadence).toBeGreaterThanOrEqual(baseline.cadence);
  });

  it('boosts ramp difficulty when multipliers are supplied', () => {
    vi.spyOn(enemySpawns, 'pickRampBundle').mockReturnValue(bundle);
    const baseline = simulateRamp(undefined);
    const tuned = simulateRamp(() => ({
      aggressionMultiplier: 1.5,
      strengthMultiplier: 1.5,
      cadenceMultiplier: 1.2
    }));
    expect(tuned.effectiveDifficulty).toBeGreaterThan(baseline.effectiveDifficulty);
    expect(tuned.difficultyMultiplier).toBeGreaterThan(baseline.difficultyMultiplier);
    expect(tuned.cadenceMultiplier).toBeGreaterThan(1);
  });
});
