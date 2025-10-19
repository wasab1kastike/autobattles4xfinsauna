import { describe, it, expect } from 'vitest';

import { BattleManager } from '../../src/battle/BattleManager.ts';
import { HexMap } from '../../src/hexmap.ts';
import { Unit } from '../../src/units/Unit.ts';

const BASE_STATS = {
  health: 20,
  attackDamage: 4,
  attackRange: 1,
  movementRange: 1
};

describe('BattleManager taunt handling', () => {
  it('activates and clears taunt state based on nearby enemies', () => {
    const map = new HexMap();
    const manager = new BattleManager(map);

    const tank = new Unit('tank', 'soldier', { q: 0, r: 0 }, 'player', {
      ...BASE_STATS
    });
    tank.setTauntRadius(5);
    tank.setTauntActive(false);

    const foe = new Unit('foe', 'raider', { q: 3, r: 0 }, 'enemy', {
      ...BASE_STATS,
      health: 12
    });

    manager.tick([tank, foe], 1);
    expect(tank.isTaunting()).toBe(true);

    foe.setCoord({ q: 10, r: 0 });
    manager.tick([tank, foe], 1);
    expect(tank.isTaunting()).toBe(false);
  });
});
