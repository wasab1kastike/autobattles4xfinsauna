import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleManager } from './BattleManager.ts';
import { Unit, UnitStats } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { eventBus } from '../events';
import { TerrainId } from '../map/terrain.ts';
import { getNeighbors } from '../hex/HexUtils.ts';
import { createSauna } from '../sim/sauna.ts';
import { Animator } from '../render/Animator.ts';

function seedTiles(map: HexMap, coords: { q: number; r: number }[]): void {
  for (const coord of coords) {
    map.ensureTile(coord.q, coord.r);
  }
}

function createUnit(
  id: string,
  coord: { q: number; r: number },
  faction: string,
  stats: UnitStats,
  priorityFactions: string[] = []
): Unit {
  return new Unit(id, 'test', coord, faction, { ...stats }, priorityFactions);
}

describe('BattleManager', () => {
  let originalRaf: typeof requestAnimationFrame | undefined;
  let originalCancel: typeof cancelAnimationFrame | undefined;

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    if (originalRaf) {
      globalThis.requestAnimationFrame = originalRaf;
    } else {
      delete (globalThis as any).requestAnimationFrame;
    }
    if (originalCancel) {
      globalThis.cancelAnimationFrame = originalCancel;
    } else {
      delete (globalThis as any).cancelAnimationFrame;
    }
  });

  it('moves units toward enemies and handles combat events', () => {
    const map = new HexMap(5, 5);
    seedTiles(map, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
    const attacker = createUnit('a', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 1
    });
    const defender = createUnit('b', { q: 2, r: 0 }, 'B', {
      health: 5,
      attackDamage: 1,
      attackRange: 1,
      movementRange: 0
    });

    const manager = new BattleManager(map);
    const units = [attacker, defender];

    const damageEvents: any[] = [];
    const deathEvents: any[] = [];
    const onDamage = (e: any) => damageEvents.push(e);
    const onDeath = (e: any) => deathEvents.push(e);
    eventBus.on('unitDamaged', onDamage);
    eventBus.on('unitDied', onDeath);

    manager.tick(units, 5);

    eventBus.off('unitDamaged', onDamage);
    eventBus.off('unitDied', onDeath);

    expect(attacker.coord).toEqual({ q: 1, r: 0 });
    expect(damageEvents).toHaveLength(1);
    expect(deathEvents).toHaveLength(1);
    expect(damageEvents[0]).toMatchObject({
      attackerId: 'a',
      targetId: 'b',
      amount: 5,
      remainingHealth: 0
    });
    expect(deathEvents[0]).toMatchObject({
      unitId: 'b',
      attackerId: 'a',
      unitFaction: 'B',
      attackerFaction: 'A'
    });
  });

  it('prioritizes targets based on faction when multiple enemies are in range', () => {
    const map = new HexMap(5, 5);
    seedTiles(map, [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 0, r: 1 },
    ]);
    const attacker = createUnit('a', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 0
    }, ['B']);
    const defenderB = createUnit('b', { q: 1, r: 0 }, 'B', {
      health: 5,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });
    const defenderC = createUnit('c', { q: 0, r: 1 }, 'C', {
      health: 5,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });

    const manager = new BattleManager(map);
    const units = [attacker, defenderB, defenderC];

    manager.tick(units, 5);

    expect(defenderB.stats.health).toBe(0);
    expect(defenderC.stats.health).toBe(5);
  });

  it('moves idle units toward fog when no enemies are available', () => {
    const map = new HexMap(5, 5);
    const origin = map.ensureTile(0, 0);
    origin.reveal();
    origin.terrain = TerrainId.Plains;
    const east = map.ensureTile(1, 0);
    east.setFogged(true);
    east.terrain = TerrainId.Plains;

    const unit = createUnit('scout', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 1
    });

    const manager = new BattleManager(map);
    manager.tick([unit], 5);

    expect(unit.coord).toEqual({ q: 1, r: 0 });
    expect((unit as any).cachedPath).toBeUndefined();
  });

  it('waits until five seconds accrue before allowing exploration movement', () => {
    const map = new HexMap(5, 5);
    const origin = map.ensureTile(0, 0);
    origin.reveal();
    origin.terrain = TerrainId.Plains;
    const east = map.ensureTile(1, 0);
    east.setFogged(true);
    east.terrain = TerrainId.Plains;

    const unit = createUnit('patient-scout', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 1
    });

    const manager = new BattleManager(map);

    manager.tick([unit], 2);
    expect(unit.coord).toEqual({ q: 0, r: 0 });

    manager.tick([unit], 2);
    expect(unit.coord).toEqual({ q: 0, r: 0 });

    manager.tick([unit], 1);
    expect(unit.coord).toEqual({ q: 1, r: 0 });
  });

  it('keeps idle units stationary when no reachable fog remains', () => {
    const map = new HexMap(5, 5);
    const origin = map.ensureTile(0, 0);
    origin.reveal();
    origin.terrain = TerrainId.Plains;

    for (const neighbor of getNeighbors({ q: 0, r: 0 })) {
      const tile = map.ensureTile(neighbor.q, neighbor.r);
      tile.terrain = TerrainId.Lake;
      tile.setFogged(false);
    }

    const unit = createUnit('blocked', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 1
    });

    const manager = new BattleManager(map);
    manager.tick([unit], 5);

    expect(unit.coord).toEqual({ q: 0, r: 0 });
    expect((unit as any).cachedPath).toBeUndefined();
  });

  it('allows enemy attacks to destroy the sauna and emits defeat events', () => {
    const map = new HexMap(3, 3);
    seedTiles(map, [{ q: 0, r: 0 }]);
    const attacker = createUnit('enemy-1', { q: 0, r: 0 }, 'enemy', {
      health: 10,
      attackDamage: 15,
      attackRange: 1,
      movementRange: 0
    });
    const sauna = createSauna({ q: 0, r: 0 }, undefined, { maxHealth: 10 });

    const manager = new BattleManager(map);

    const saunaDamageEvents: any[] = [];
    const saunaDestroyedEvents: any[] = [];
    const onSaunaDamaged = (payload: any) => saunaDamageEvents.push(payload);
    const onSaunaDestroyed = (payload: any) => saunaDestroyedEvents.push(payload);
    eventBus.on('saunaDamaged', onSaunaDamaged);
    eventBus.on('saunaDestroyed', onSaunaDestroyed);

    manager.tick([attacker], 1, sauna);

    eventBus.off('saunaDamaged', onSaunaDamaged);
    eventBus.off('saunaDestroyed', onSaunaDestroyed);

    expect(sauna.destroyed).toBe(true);
    expect(sauna.health).toBe(0);
    expect(saunaDamageEvents).toHaveLength(1);
    expect(saunaDamageEvents[0]).toMatchObject({
      attackerId: 'enemy-1',
      attackerFaction: 'enemy',
      amount: 10,
      remainingHealth: 0
    });
    expect(saunaDestroyedEvents).toHaveLength(1);
    expect(saunaDestroyedEvents[0]).toMatchObject({
      attackerId: 'enemy-1',
      attackerFaction: 'enemy'
    });
  });

  it('animates render coordinates when units step across tiles', () => {
    const harness = createRafHarness();
    const map = new HexMap(3, 3);
    const origin = map.ensureTile(0, 0);
    origin.reveal();
    origin.terrain = TerrainId.Plains;
    const east = map.ensureTile(1, 0);
    east.setFogged(true);
    east.terrain = TerrainId.Plains;

    const animatorCalls: number[] = [];
    const animator = new Animator(() => animatorCalls.push(1));
    const manager = new BattleManager(map, animator);
    const unit = createUnit('runner', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 1
    });

    manager.tick([unit], 5);

    expect(unit.coord).toEqual({ q: 1, r: 0 });
    expect(unit.renderCoord).toEqual({ q: 0, r: 0 });
    expect(harness.pending()).toBe(1);

    harness.advance(0);
    expect(harness.pending()).toBeGreaterThan(0);

    harness.advance(100);
    expect(unit.renderCoord.q).toBeCloseTo(0.5, 2);
    expect(unit.renderCoord.r).toBeCloseTo(0, 5);
    expect(animatorCalls.length).toBeGreaterThan(0);

    harness.advance(120);
    expect(unit.renderCoord.q).toBeCloseTo(1, 3);
    expect(unit.renderCoord.r).toBeCloseTo(0, 5);
    expect(harness.pending()).toBe(0);
  });
});

type FrameFn = (time: number) => void;

function createRafHarness(): { advance: (delta: number) => void; pending: () => number } {
  const callbacks: FrameFn[] = [];
  let now = 0;
  (globalThis as any).requestAnimationFrame = (cb: FrameFn) => {
    callbacks.push(cb);
    return callbacks.length;
  };
  (globalThis as any).cancelAnimationFrame = (id: number) => {
    const index = id - 1;
    if (index >= 0 && index < callbacks.length) {
      callbacks.splice(index, 1);
    }
  };
  return {
    advance(delta: number) {
      now += delta;
      const next = callbacks.shift();
      if (next) {
        next(now);
      }
    },
    pending() {
      return callbacks.length;
    }
  };
}

