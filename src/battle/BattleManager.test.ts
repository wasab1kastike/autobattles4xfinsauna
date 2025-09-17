import { describe, it, expect } from 'vitest';
import { BattleManager } from './BattleManager.ts';
import { Unit, UnitStats } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { eventBus } from '../events';

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

    manager.tick(units);

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

    manager.tick(units);

    expect(defenderB.stats.health).toBe(0);
    expect(defenderC.stats.health).toBe(5);
  });
});

