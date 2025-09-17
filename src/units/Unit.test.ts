import { describe, it, expect, vi } from 'vitest';
import { Unit, UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';
import { TerrainId } from '../map/terrain.ts';
import { eventBus } from '../events';
import { Sauna } from '../buildings/Sauna.ts';

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function createUnit(id: string, coord: AxialCoord, stats: UnitStats): Unit {
  return new Unit(id, 'test', coord, 'faction', { ...stats });
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

  it('no longer appears in active collection after death', () => {
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
    const onDied = ({ unitId }: { unitId: string }) => {
      const idx = units.findIndex((u) => u.id === unitId);
      if (idx !== -1) units.splice(idx, 1);
    };
    eventBus.on('unitDied', onDied);

    attacker.attack(defender);
    expect(units).toHaveLength(0);

    eventBus.off('unitDied', onDied);
  });
});

describe('Unit movement', () => {
  it('moves around impassable terrain', () => {
    const map = new HexMap(3, 3);
    map.getTile(1, 0)!.terrain = TerrainId.Lake;
    const unit = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const path = unit.moveTowards({ q: 2, r: 0 }, map, new Set());
    expect(path).toEqual([
      { q: 0, r: 0 },
      { q: 0, r: 1 }
    ]);
    // Unit should not move yet; animator handles movement.
    expect(unit.coord).toEqual({ q: 0, r: 0 });
  });

  it('selects the nearest reachable enemy', () => {
    const map = new HexMap(3, 3);
    map.getTile(1, 0)!.terrain = TerrainId.Lake;
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
    const occupied = new Set<string>();
    const target = unit.seekNearestEnemy([enemy1, enemy2], map, occupied);
    expect(target).toBe(enemy2);
  });

  it('does not move into occupied tiles', () => {
    const map = new HexMap(3, 3);
    const unit = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const blocker = createUnit('b', { q: 1, r: 0 }, {
      health: 10,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 1
    });
    const occupied = new Set<string>([coordKey(blocker.coord)]);
    const path = unit.moveTowards(blocker.coord, map, occupied);
    expect(path).toEqual([]);
    expect(unit.coord).toEqual({ q: 0, r: 0 });
  });
});

describe('Unit sauna regeneration', () => {
  it('regenerates health near sauna and spawns markers once per second', () => {
    const unit = createUnit('a', { q: 0, r: 0 }, {
      health: 10,
      attackDamage: 0,
      attackRange: 1,
      movementRange: 1
    });
    unit.takeDamage(5);
    const sauna = new Sauna({ q: 0, r: 0 }, 1, 2);
    const canvas = document.createElement('canvas');
    canvas.id = 'game-canvas';
    document.body.appendChild(canvas);

    unit.update(0.5, sauna);
    expect(unit.stats.health).toBeCloseTo(6);
    expect(document.querySelectorAll('.heal-marker')).toHaveLength(0);

    unit.update(0.5, sauna);
    expect(unit.stats.health).toBeCloseTo(7);
    expect(document.querySelectorAll('.heal-marker')).toHaveLength(1);

    unit.update(10, sauna);
    expect(unit.stats.health).toBe(10);

    document.body.innerHTML = '';
  });
});

