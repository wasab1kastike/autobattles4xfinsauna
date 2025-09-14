import { describe, it, expect, vi } from 'vitest';
import { Unit, UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';

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

  it('removes unit from array on death', () => {
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

    const units = [defender];
    defender.onDeath(() => {
      const idx = units.indexOf(defender);
      if (idx !== -1) units.splice(idx, 1);
    });

    attacker.attack(defender);
    expect(defender.stats.health).toBe(0);
    expect(units).toHaveLength(0);
  });
});

describe('Unit movement', () => {
  it('moves around impassable terrain', () => {
    const map = new HexMap(3, 3);
    map.getTile(1, 0)!.terrain = 'water';
    const unit = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const path = unit.moveTowards({ q: 2, r: 0 }, map);
    expect(path).toEqual([
      { q: 0, r: 0 },
      { q: 0, r: 1 }
    ]);
    // Unit should not move yet; animator handles movement.
    expect(unit.coord).toEqual({ q: 0, r: 0 });
  });

  it('selects the nearest reachable enemy', () => {
    const map = new HexMap(3, 3);
    map.getTile(1, 0)!.terrain = 'water';
    const unit = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const enemy1 = createUnit('b', { q: 2, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const enemy2 = createUnit('c', { q: 0, r: 2 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const target = unit.seekNearestEnemy([enemy1, enemy2], map);
    expect(target).toBe(enemy2);
  });
});

