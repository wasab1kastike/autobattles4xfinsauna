import { describe, expect, it } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { createSauna } from '../sim/sauna.ts';
import { runEconomyTick } from './tick.ts';
import type { Unit } from '../units/Unit.ts';
import { Unit as UnitClass } from '../units/Unit.ts';
import { getSoldierStats } from '../units/Soldier.ts';

function makeUnit(id: string, faction: string): Unit {
  const stats = getSoldierStats();
  return new UnitClass(id, 'soldier', { q: 0, r: 0 }, faction, stats);
}

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
      minUpkeepReserve: 1
    });

    expect(spawned).toHaveLength(1);
    expect(sauna.heatTracker.getHeat()).toBeLessThan(sauna.playerSpawnThreshold);
    expect(sauna.playerSpawnTimer).toBeGreaterThan(0);
  });

  it('accumulates upkeep and drains it every five seconds', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 20, heatPerSecond: 0, initialHeat: 0 }
    );
    const units: Unit[] = [makeUnit('u1', 'player'), makeUnit('u2', 'player'), makeUnit('e1', 'enemy')];
    const upkeep = new Map(
      units.map((unit, index) => {
        if (unit.faction !== 'player') {
          return [unit.id, 0];
        }
        return [unit.id, index + 2];
      })
    );

    const tick = (dt: number) =>
      runEconomyTick({
        dt,
        state,
        sauna,
        heat: sauna.heatTracker,
        units,
        getUnitUpkeep: (unit) => upkeep.get(unit.id) ?? 0,
        pickSpawnTile: () => null,
        spawnBaseUnit: () => null,
        minUpkeepReserve: 1
      });

    for (let i = 0; i < 4; i++) {
      const result = tick(1);
      expect(result.upkeepDrain).toBe(0);
      expect(state.getResource(Resource.SAUNA_BEER)).toBe(100);
    }

    const fifth = tick(1);
    expect(fifth.upkeepDrain).toBe(25);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(75);

    const sixth = tick(1);
    expect(sixth.upkeepDrain).toBe(0);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(75);
  });

  it('supports large dt values by draining once per five-second chunk', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 200);
    const sauna = createSauna(
      { q: 0, r: 0 },
      { baseThreshold: 20, heatPerSecond: 0, initialHeat: 0 }
    );
    const units: Unit[] = [makeUnit('u1', 'player'), makeUnit('u2', 'player')];
    const upkeep = new Map(
      units.map((unit, index) => [unit.id, index + 2])
    );

    const first = runEconomyTick({
      dt: 6,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: (unit) => upkeep.get(unit.id) ?? 0,
      pickSpawnTile: () => null,
      spawnBaseUnit: () => null,
      minUpkeepReserve: 1
    });

    expect(first.upkeepDrain).toBe(25);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(175);
    expect(sauna.beerUpkeep.elapsed).toBeCloseTo(1, 6);

    const second = runEconomyTick({
      dt: 4,
      state,
      sauna,
      heat: sauna.heatTracker,
      units,
      getUnitUpkeep: (unit) => upkeep.get(unit.id) ?? 0,
      pickSpawnTile: () => null,
      spawnBaseUnit: () => null,
      minUpkeepReserve: 1
    });

    expect(second.upkeepDrain).toBe(25);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(150);
  });
});
