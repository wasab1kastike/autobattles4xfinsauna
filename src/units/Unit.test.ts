import { describe, it, expect, vi } from 'vitest';
import { Unit, UnitStats } from '../unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

function createUnit(id: string, coord: AxialCoord, stats: UnitStats): Unit {
  return new Unit(id, coord, 'faction', { ...stats });
}

describe('Unit combat', () => {
  it('deals damage within range', () => {
    const attacker = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 3,
      attackRange: 1,
      movementRange: 1
    });
    const defender = createUnit('b', { q: 1, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    attacker.attack(defender);
    expect(defender.stats.health).toBe(7);
  });

  it('does not deal damage when out of range', () => {
    const attacker = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 3,
      attackRange: 1,
      movementRange: 1
    });
    const defender = createUnit('b', { q: 2, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    attacker.attack(defender);
    expect(defender.stats.health).toBe(10);
  });

  it('emits death event when health reaches zero', () => {
    const attacker = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 1
    });
    const defender = createUnit('b', { q: 1, r: 0 }, {
      health: 4,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const onDeath = vi.fn();
    defender.onDeath(onDeath);
    attacker.attack(defender);
    expect(defender.stats.health).toBe(0);
    expect(onDeath).toHaveBeenCalledTimes(1);
  });
});

