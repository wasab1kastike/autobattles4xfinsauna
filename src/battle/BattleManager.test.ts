import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BattleManager } from './BattleManager.ts';
import { DEFEND_PERIMETER_RADIUS } from './unitBehavior.ts';
import { Unit, UnitStats } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { eventBus } from '../events';
import { TerrainId } from '../map/terrain.ts';
import { getNeighbors, hexDistance } from '../hex/HexUtils.ts';
import { createSauna } from '../sim/sauna.ts';
import { Animator } from '../render/Animator.ts';
import type { UnitBehavior } from '../unit/types.ts';

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
  priorityFactions: string[] = [],
  behavior?: UnitBehavior
): Unit {
  return new Unit(id, 'test', coord, faction, { ...stats }, priorityFactions, behavior);
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

    const attackEvents: any[] = [];
    const damageEvents: any[] = [];
    const deathEvents: any[] = [];
    const onAttack = (e: any) => attackEvents.push(e);
    const onDamage = (e: any) => damageEvents.push(e);
    const onDeath = (e: any) => deathEvents.push(e);
    eventBus.on('unitAttack', onAttack);
    eventBus.on('unitDamaged', onDamage);
    eventBus.on('unitDied', onDeath);

    manager.tick(units, 5);

    eventBus.off('unitAttack', onAttack);
    eventBus.off('unitDamaged', onDamage);
    eventBus.off('unitDied', onDeath);

    expect(attackEvents).toHaveLength(1);
    expect(attackEvents[0]).toMatchObject({
      attackerId: 'a',
      targetId: 'b'
    });
    expect(attackEvents[0].impactAt).toBeGreaterThan(attackEvents[0].timestamp);
    expect(attackEvents[0].recoverAt).toBeGreaterThan(attackEvents[0].impactAt);
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
    }, [], 'explore');

    const manager = new BattleManager(map);
    manager.tick([unit], 5);

    expect(unit.coord).toEqual({ q: 1, r: 0 });
    expect((unit as any).cachedPath).toBeUndefined();
  });

  it('keeps explorers scouting when distant enemies are out of sight', () => {
    const map = new HexMap(8, 3);
    const explored = map.ensureTile(0, 0);
    explored.reveal();
    explored.terrain = TerrainId.Plains;
    const frontier = map.ensureTile(1, 0);
    frontier.setFogged(true);
    frontier.terrain = TerrainId.Plains;
    const far = map.ensureTile(5, 0);
    far.setFogged(false);
    far.terrain = TerrainId.Plains;

    const scout = createUnit(
      'distant-scout',
      { q: 0, r: 0 },
      'player',
      {
        health: 6,
        attackDamage: 0,
        attackRange: 0,
        movementRange: 1,
        visionRange: 2
      },
      [],
      'explore'
    );
    const raider = createUnit('remote-raider', { q: 5, r: 0 }, 'enemy', {
      health: 12,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });

    const manager = new BattleManager(map);
    manager.tick([scout, raider], 5);

    expect(scout.coord).toEqual({ q: 1, r: 0 });
    expect(raider.coord).toEqual({ q: 5, r: 0 });
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
    }, [], 'explore');

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
    }, [], 'explore');

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

  it('keeps defending units within the sauna perimeter', () => {
    const map = new HexMap(8, 3);
    const path: { q: number; r: number }[] = [];
    for (let q = -1; q <= DEFEND_PERIMETER_RADIUS + 2; q++) {
      path.push({ q, r: 0 });
    }
    seedTiles(map, path);
    for (const coord of path) {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.setFogged(false);
    }

    const sauna = createSauna({ q: 0, r: 0 });
    const guardian = createUnit(
      'guardian',
      { q: DEFEND_PERIMETER_RADIUS + 2, r: 0 },
      'player',
      {
        health: 12,
        attackDamage: 0,
        attackRange: 0,
        movementRange: 1
      },
      [],
      'defend'
    );

    const manager = new BattleManager(map);

    manager.tick([guardian], 5, sauna);
    expect(hexDistance(guardian.coord, sauna.pos)).toBe(DEFEND_PERIMETER_RADIUS + 1);

    manager.tick([guardian], 5, sauna);
    expect(hexDistance(guardian.coord, sauna.pos)).toBeLessThanOrEqual(DEFEND_PERIMETER_RADIUS);

    manager.tick([guardian], 5, sauna);
    expect(guardian.coord).toEqual({ q: DEFEND_PERIMETER_RADIUS, r: 0 });
  });

  it('only allows defenders to pursue enemies that breach the perimeter', () => {
    const map = new HexMap(12, 3);
    const line: { q: number; r: number }[] = [];
    for (let q = -2; q <= DEFEND_PERIMETER_RADIUS + 4; q++) {
      line.push({ q, r: 0 });
    }
    seedTiles(map, line);
    for (const coord of line) {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.setFogged(false);
    }

    const sauna = createSauna({ q: 0, r: 0 });
    const guardian = createUnit(
      'guardian-perimeter',
      { q: DEFEND_PERIMETER_RADIUS, r: 0 },
      'player',
      {
        health: 12,
        attackDamage: 2,
        attackRange: 1,
        movementRange: 1
      },
      [],
      'defend'
    );
    const raider = createUnit(
      'perimeter-raider',
      { q: DEFEND_PERIMETER_RADIUS + 3, r: 0 },
      'enemy',
      {
        health: 6,
        attackDamage: 1,
        attackRange: 1,
        movementRange: 0
      }
    );

    const manager = new BattleManager(map);

    manager.tick([guardian, raider], 5, sauna);
    expect(guardian.coord).toEqual({ q: DEFEND_PERIMETER_RADIUS, r: 0 });

    raider.setCoord({ q: DEFEND_PERIMETER_RADIUS - 1, r: 0 });
    manager.tick([guardian, raider], 5, sauna);
    expect(hexDistance(guardian.coord, sauna.pos)).toBeLessThanOrEqual(DEFEND_PERIMETER_RADIUS);
    expect(hexDistance(guardian.coord, raider.coord)).toBeLessThanOrEqual(1);
  });

  it('drives attackers toward the latest recorded enemy position', () => {
    const map = new HexMap(8, 3);
    const corridor: { q: number; r: number }[] = [];
    for (let q = 0; q <= 4; q++) {
      corridor.push({ q, r: 0 });
    }
    seedTiles(map, corridor);
    for (const coord of corridor) {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.setFogged(false);
    }

    const striker = createUnit(
      'striker',
      { q: 0, r: 0 },
      'player',
      {
        health: 10,
        attackDamage: 2,
        attackRange: 1,
        movementRange: 1
      },
      [],
      'attack'
    );
    const raider = createUnit(
      'raider',
      { q: 4, r: 0 },
      'enemy',
      {
        health: 6,
        attackDamage: 0,
        attackRange: 0,
        movementRange: 0
      }
    );

    const manager = new BattleManager(map);

    manager.tick([striker, raider], 5);
    manager.tick([striker, raider], 5);
    expect(striker.coord).toEqual({ q: 1, r: 0 });

    manager.tick([striker], 5);
    expect(striker.coord).toEqual({ q: 2, r: 0 });
  });

  it('continues guiding attackers to their last sighted foe when enemies vanish', () => {
    const map = new HexMap(8, 3);
    const lane: { q: number; r: number }[] = [];
    for (let q = 0; q <= 5; q++) {
      lane.push({ q, r: 0 });
    }
    seedTiles(map, lane);
    for (const coord of lane) {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.setFogged(false);
    }

    const striker = createUnit(
      'persistent-striker',
      { q: 0, r: 0 },
      'player',
      {
        health: 10,
        attackDamage: 2,
        attackRange: 1,
        movementRange: 1
      },
      [],
      'attack'
    );
    const raider = createUnit('vanishing-raider', { q: 4, r: 0 }, 'enemy', {
      health: 6,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });

    const manager = new BattleManager(map);

    manager.tick([striker, raider], 5);
    expect(striker.coord).toEqual({ q: 1, r: 0 });

    manager.tick([striker], 5);
    expect(striker.coord).toEqual({ q: 2, r: 0 });

    manager.tick([striker], 5);
    expect(striker.coord).toEqual({ q: 3, r: 0 });
  });

  it('guides attackers toward the board edge when no sightings exist', () => {
    const map = new HexMap(6, 3);
    const corridor: { q: number; r: number }[] = [];
    for (let q = 0; q <= 5; q++) {
      for (let r = 0; r <= 2; r++) {
        corridor.push({ q, r });
      }
    }
    seedTiles(map, corridor);
    for (const coord of corridor) {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.setFogged(false);
    }

    const striker = createUnit(
      'edge-runner',
      { q: 0, r: 0 },
      'player',
      {
        health: 10,
        attackDamage: 2,
        attackRange: 1,
        movementRange: 1
      },
      [],
      'attack'
    );

    const manager = new BattleManager(map);

    manager.tick([striker], 5);
    expect(striker.coord).toEqual({ q: 1, r: 0 });

    manager.tick([striker], 5);
    expect(striker.coord).toEqual({ q: 2, r: 0 });
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

