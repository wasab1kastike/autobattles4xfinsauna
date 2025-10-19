import { describe, expect, it } from 'vitest';
import { Targeting } from '../../src/ai/Targeting.ts';
import { Unit } from '../../src/units/Unit.ts';

function createUnit(
  id: string,
  faction: string,
  coord: { q: number; r: number }
): Unit {
  return new Unit(id, 'soldier', coord, faction, {
    health: 100,
    attackDamage: 10,
    attackRange: 1,
    movementRange: 1
  });
}

describe('Targeting taunt prioritisation', () => {
  it('prefers taunting opponents within the aura radius', () => {
    const tank = createUnit('tank', 'player', { q: 0, r: 0 });
    tank.setTauntAura(5);
    tank.setTauntActive(true);

    const ally = createUnit('ally', 'player', { q: 1, r: 0 });
    const enemy = createUnit('foe', 'enemy', { q: 2, r: 0 });

    const target = Targeting.selectTarget(enemy, [tank, ally]);
    expect(target?.id).toBe('tank');
  });

  it('ignores taunt when the attacker is outside the aura radius', () => {
    const tank = createUnit('tank', 'player', { q: 0, r: 0 });
    tank.setTauntAura(1);
    tank.setTauntActive(true);

    const ally = createUnit('ally', 'player', { q: 1, r: 0 });
    const enemy = createUnit('foe', 'enemy', { q: 4, r: 0 });

    const target = Targeting.selectTarget(enemy, [tank, ally]);
    expect(target?.id).toBe('ally');
  });
});
