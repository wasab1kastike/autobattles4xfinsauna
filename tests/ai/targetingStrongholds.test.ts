import { describe, expect, it } from 'vitest';

import { Targeting } from '../../src/ai/Targeting.ts';
import { Unit } from '../../src/units/Unit.ts';

const baseStats = {
  health: 100,
  attackDamage: 10,
  attackRange: 2,
  movementRange: 3
};

describe('Targeting stronghold structures', () => {
  it('ignores stronghold structures while other enemies remain', () => {
    const attacker = new Unit('attacker', 'soldier', { q: 0, r: 0 }, 'player', {
      ...baseStats
    });
    const raider = new Unit('raider-1', 'raider', { q: 1, r: 0 }, 'enemy', {
      ...baseStats
    });
    const stronghold = new Unit(
      'stronghold-1',
      'stronghold-structure',
      { q: 2, r: 0 },
      'enemy',
      {
        ...baseStats,
        attackDamage: 0
      }
    );

    const target = Targeting.selectTarget(attacker, [raider, stronghold]);

    expect(target).toBe(raider);

    raider.takeDamage(raider.getMaxHealth() + 1, attacker);

    const fallback = Targeting.selectTarget(attacker, [raider, stronghold]);

    expect(fallback).toBe(stronghold);
  });

  it('targets strongholds when other enemies are too far away', () => {
    const attacker = new Unit('attacker', 'soldier', { q: 0, r: 0 }, 'player', {
      ...baseStats
    });
    const distantRaider = new Unit('raider-2', 'raider', { q: 10, r: 0 }, 'enemy', {
      ...baseStats
    });
    const nearbyStronghold = new Unit(
      'stronghold-2',
      'stronghold-structure',
      { q: 2, r: 0 },
      'enemy',
      {
        ...baseStats,
        attackDamage: 0
      }
    );

    const target = Targeting.selectTarget(attacker, [distantRaider, nearbyStronghold]);

    expect(target).toBe(nearbyStronghold);
  });
});
