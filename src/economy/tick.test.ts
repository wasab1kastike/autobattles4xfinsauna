import { describe, expect, it, afterEach } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { createSauna } from '../sim/sauna.ts';
import { runEconomyTick } from './tick.ts';
import { createPlayerSpawnTierQueue } from '../world/spawn/tier_helpers.ts';
import type { Unit } from '../units/Unit.ts';
import { Unit as UnitClass } from '../units/Unit.ts';
import { getSoldierStats } from '../units/Soldier.ts';
import { combinePolicyModifiers, createPolicyModifierSummary } from '../policies/modifiers.ts';
import { getActivePolicyModifiers, setActivePolicyModifiers } from '../policies/runtime.ts';
import { getPolicyDefinition } from '../data/policies.ts';

function makeUnit(id: string, faction: string): Unit {
  const stats = getSoldierStats();
  return new UnitClass(id, 'soldier', { q: 0, r: 0 }, faction, stats);
}

afterEach(() => {
  setActivePolicyModifiers(createPolicyModifierSummary());
});

describe('runEconomyTick', () => {
  it('spawns a reinforcement when heat crosses the threshold and upkeep remains', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 200);
    const sauna = createSauna(
      { q: 0, r: 0 },
      {
        baseThreshold: 5,
        heatPerSecond: 4,
        thresholdGrowth: 0.05,
        initialHeat: 3
      }
    );
    const units: Unit[] = [];
    const spawned: Unit[] = [];

    runEconomyTick({
      dt: 0.5,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnBaseUnit: (coord) => {
        const unit = new UnitClass(`test-${spawned.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
        units.push(unit);
        spawned.push(unit);
        return unit;
      },
      minUpkeepReserve: 1,
      spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
      spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
    });

    expect(spawned).toHaveLength(1);
    expect(sauna.heatTracker.getHeat()).toBeLessThan(sauna.playerSpawnThreshold);
    expect(sauna.playerSpawnTimer).toBeGreaterThan(0);
  });

  it('applies policy upkeep modifiers when draining resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 5, heatPerSecond: 0, initialHeat: 0 }
    );
    const unit = makeUnit('u-policy', 'player');
    const units: Unit[] = [unit];

    const evaluateUpkeep = (): number => {
      const modifiers = getActivePolicyModifiers();
      return Math.max(
        0,
        Math.round((4 + modifiers.upkeepDelta) * modifiers.upkeepMultiplier)
      );
    };

    const runDrain = () =>
      runEconomyTick({
        dt: 5,
        state,
        sauna,
        heat: sauna.heatTracker,
        units,
        getUnitUpkeep: () => evaluateUpkeep(),
        pickSpawnTile: () => null,
        spawnBaseUnit: () => null,
        minUpkeepReserve: 0,
        spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
        spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
      });

    setActivePolicyModifiers(createPolicyModifierSummary());
    const baseline = runDrain();
    expect(baseline.upkeepDrain).toBe(4);

    const shieldwall = getPolicyDefinition('shieldwall-doctrine');
    const saunaSkin = getPolicyDefinition('sauna-skin');
    expect(shieldwall).toBeTruthy();
    expect(saunaSkin).toBeTruthy();

    const summary = combinePolicyModifiers([shieldwall!, saunaSkin!]);
    expect(summary.upkeepMultiplier).toBeCloseTo(3, 5);
    expect(summary.upkeepDelta).toBeCloseTo(1.5, 5);

    setActivePolicyModifiers(summary);

    const active = getActivePolicyModifiers();
    expect(active.upkeepMultiplier).toBeCloseTo(3, 5);
    expect(active.upkeepDelta).toBeCloseTo(1.5, 5);

    const modified = runDrain();
    const expectedDrain = evaluateUpkeep();
    expect(expectedDrain).toBe(modified.upkeepDrain);
    expect(expectedDrain).toBe(17);
  });

  it('drains upkeep from active player units on the five-second cadence', () => {
    const createContext = () => {
      const state = new GameState(1000);
      state.addResource(Resource.SAUNA_BEER, 100);
      const sauna = createSauna(
        { q: 0, r: 0 },
        { baseThreshold: 20, heatPerSecond: 0, initialHeat: 0 }
      );
      const units: Unit[] = [
        makeUnit('u1', 'player'),
        makeUnit('u2', 'player'),
        makeUnit('e1', 'enemy')
      ];
      const upkeep = new Map(
        units.map((unit, index) => {
          if (unit.faction !== 'player') {
            return [unit.id, 0];
          }
          return [unit.id, index + 2];
        })
      );

      const runTick = (dt: number) =>
        runEconomyTick({
          dt,
          state,
          sauna,
          heat: sauna.heatTracker,
          units,
          getUnitUpkeep: (unit) => upkeep.get(unit.id) ?? 0,
          pickSpawnTile: () => null,
          spawnBaseUnit: () => null,
          minUpkeepReserve: 1,
          spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
          spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
        });

      return { state, sauna, runTick };
    };

    const primary = createContext();

    for (let i = 0; i < 4; i++) {
      const result = primary.runTick(1);
      expect(result.upkeepDrain).toBe(0);
      expect(primary.state.getResource(Resource.SAUNA_BEER)).toBe(100);
    }

    const fifth = primary.runTick(1);
    expect(fifth.upkeepDrain).toBe(5);
    expect(primary.state.getResource(Resource.SAUNA_BEER)).toBe(95);

    const partial = primary.runTick(0.5);
    expect(partial.upkeepDrain).toBe(0);
    expect(primary.state.getResource(Resource.SAUNA_BEER)).toBe(95);

    const long = primary.runTick(5);
    expect(long.upkeepDrain).toBe(5);
    expect(primary.state.getResource(Resource.SAUNA_BEER)).toBe(90);

    const immediate = createContext();
    const bigStep = immediate.runTick(6);
    expect(bigStep.upkeepDrain).toBe(5);
    expect(immediate.state.getResource(Resource.SAUNA_BEER)).toBe(95);

    expect(long.spawn.spawned).toBe(0);
    expect(long.spawn.blockedByRoster).toBe(0);
  });

  it('honours roster caps and resumes spawning when the limit increases', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 200);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 6, heatPerSecond: 0, initialHeat: 6 },
      { maxRosterSize: 0 }
    );
    const units: Unit[] = [];
    const spawned: Unit[] = [];
    const rosterCount = () => units.filter((unit) => unit.faction === 'player' && !unit.isDead()).length;
    const spawnUnitAt = (coord: { q: number; r: number }): Unit | null => {
      const unit = new UnitClass(`test-${spawned.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
      units.push(unit);
      spawned.push(unit);
      return unit;
    };

    const first = runEconomyTick({
      dt: 0,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnBaseUnit: spawnUnitAt,
      minUpkeepReserve: 0,
      maxSpawns: 3,
      rosterCap: 0,
      getRosterCount: rosterCount,
      spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
      spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
    });

    expect(first.spawn.spawned).toBe(0);
    expect(first.spawn.blockedByRoster).toBe(1);
    expect(sauna.heatTracker.getHeat()).toBeLessThan(sauna.playerSpawnThreshold);

    sauna.heatTracker.setHeat(sauna.playerSpawnThreshold);

    const second = runEconomyTick({
      dt: 0,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnBaseUnit: spawnUnitAt,
      minUpkeepReserve: 0,
      maxSpawns: 3,
      rosterCap: 2,
      getRosterCount: rosterCount,
      spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
      spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
    });

    expect(second.spawn.spawned).toBe(1);
    expect(second.spawn.blockedByRoster).toBe(0);
    expect(spawned).toHaveLength(1);
  });

  it('queues spawns while the tier is saturated and redeploys once space opens', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 120);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 6, heatPerSecond: 0, initialHeat: 6 },
      { maxRosterSize: 1 }
    );
    const units: Unit[] = [];
    let rosterCount = 1;
    const tier = {
      id: 'aurora-ward',
      name: 'Modern Wooden Sauna',
      rosterCap: 2,
      description: 'test tier',
      art: { badge: 'badge.svg' },
      spawnSpeedMultiplier: 1,
      unlock: { type: 'default', label: 'Always ready' }
    } as const;

    const tierHelpers = createPlayerSpawnTierQueue({
      getTier: () => tier,
      getRosterLimit: () => 1,
      getRosterCount: () => rosterCount,
      log: () => {},
      queueCapacity: 2
    });

    const first = runEconomyTick({
      dt: 0,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => ({ q: 0, r: 0 }),
      spawnBaseUnit: (coord) => {
        const unit = new UnitClass(`queue-${units.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
        units.push(unit);
        rosterCount += 1;
        return unit;
      },
      minUpkeepReserve: 0,
      maxSpawns: 2,
      rosterCap: 1,
      getRosterCount: () => rosterCount,
      tierHelpers,
      spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
      spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
    });

    expect(first.spawn.spawned).toBe(0);
    expect(first.spawn.blockedByRoster).toBe(1);
    expect(tierHelpers.hasQueuedSpawn()).toBe(true);
    expect(sauna.heatTracker.hasTriggerReady()).toBe(false);

    rosterCount = 0;

    const second = runEconomyTick({
      dt: 0,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => ({ q: 1, r: 0 }),
      spawnBaseUnit: (coord) => {
        const unit = new UnitClass(`queue-${units.length + 1}`, 'soldier', coord, 'player', getSoldierStats());
        units.push(unit);
        rosterCount += 1;
        return unit;
      },
      minUpkeepReserve: 0,
      maxSpawns: 2,
      rosterCap: 1,
      getRosterCount: () => rosterCount,
      tierHelpers,
      spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
      spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
    });

    expect(second.spawn.spawned).toBe(1);
    expect(tierHelpers.hasQueuedSpawn()).toBe(false);
    expect(units).toHaveLength(1);
  });

  it('accelerates spawn preparation when a cadence bonus is supplied', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 20, heatPerSecond: 4, initialHeat: 0 }
    );

    const result = runEconomyTick({
      dt: 1,
      state,
      sauna,
      heat: sauna.heatTracker,
      units: [],
      getUnitUpkeep: () => 0,
      pickSpawnTile: () => null,
      spawnBaseUnit: () => null,
      spawnSpeedMultiplier: 1.5,
      spawnHeatMultiplier: 1.5
    });

    expect(result.addedHeat).toBeGreaterThan(0);
    expect(sauna.spawnSpeedMultiplier).toBeCloseTo(1.5, 5);
    expect(sauna.heatPerTick).toBeCloseTo(6, 5);
    expect(sauna.playerSpawnCooldown).toBeCloseTo(20 / 4 / 1.5, 5);
  });
});
