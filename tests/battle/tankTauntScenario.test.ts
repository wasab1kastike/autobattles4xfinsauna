import { describe, expect, it } from 'vitest';
import { BattleManager } from '../../src/battle/BattleManager.ts';
import { HexMap } from '../../src/hexmap.ts';
import { Unit } from '../../src/units/Unit.ts';

function createTank(): Unit {
  const unit = new Unit('tank', 'soldier', { q: 0, r: 0 }, 'player', {
    health: 30,
    attackDamage: 5,
    attackRange: 1,
    movementRange: 1
  });
  unit.setTauntAura(5);
  unit.setTauntActive(false);
  return unit;
}

function createEnemy(id: string, coord: { q: number; r: number }): Unit {
  return new Unit(id, 'soldier', coord, 'enemy', {
    health: 20,
    attackDamage: 4,
    attackRange: 1,
    movementRange: 1
  });
}

describe('BattleManager taunt handling', () => {
  it('activates taunt when an enemy enters the aura radius', () => {
    const map = new HexMap(8, 8, 32);
    const manager = new BattleManager(map);
    const tank = createTank();
    const enemy = createEnemy('foe', { q: 3, r: 0 });

    manager.tick([tank, enemy], 1);

    expect(tank.isTauntActive()).toBe(true);
  });
});
