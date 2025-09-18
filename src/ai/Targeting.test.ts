import { describe, it, expect } from 'vitest';
import { Targeting } from './Targeting.ts';
import { Unit } from '../units/Unit.ts';
import type { UnitStats } from '../unit/types.ts';

function createUnit(
  id: string,
  coord: { q: number; r: number },
  faction: string,
  stats: UnitStats,
  priorityFactions: string[] = []
): Unit {
  return new Unit(id, 'test', coord, faction, { ...stats }, priorityFactions);
}

describe('Targeting', () => {
  it('prefers enemies of priority faction within range', () => {
    const attacker = createUnit('a', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 1,
      attackRange: 1,
      movementRange: 0
    }, ['B']);
    const enemyB = createUnit('b', { q: 1, r: 0 }, 'B', {
      health: 5,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });
    const enemyC = createUnit('c', { q: 0, r: 1 }, 'C', {
      health: 1,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });
    const target = Targeting.selectTarget(attacker, [attacker, enemyB, enemyC]);
    expect(target?.id).toBe('b');
  });

  it('chooses lowest health enemy when no priority faction', () => {
    const attacker = createUnit('a', { q: 0, r: 0 }, 'A', {
      health: 10,
      attackDamage: 1,
      attackRange: 2,
      movementRange: 0
    });
    const enemy1 = createUnit('b', { q: 1, r: 0 }, 'B', {
      health: 5,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });
    const enemy2 = createUnit('c', { q: 2, r: 0 }, 'B', {
      health: 3,
      attackDamage: 0,
      attackRange: 0,
      movementRange: 0
    });
    const target = Targeting.selectTarget(attacker, [attacker, enemy1, enemy2]);
    expect(target?.id).toBe('c');
  });
});
