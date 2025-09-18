import { describe, it, expect } from 'vitest';
import { Unit } from './Unit.ts';
import { makeKeyword } from '../keywords/index.ts';

const BASE_COORD = { q: 0, r: 0 } as const;

function makeUnit(
  id: string,
  statsOverrides: Partial<Pick<Unit['stats'], 'health' | 'attackDamage' | 'defense'>> = {}
): Unit {
  const stats = {
    health: statsOverrides.health ?? 10,
    attackDamage: statsOverrides.attackDamage ?? 4,
    attackRange: 1,
    movementRange: 1,
    visionRange: 3,
    defense: statsOverrides.defense
  };
  return new Unit(id, 'soldier', { ...BASE_COORD }, 'alpha', stats);
}

describe('Unit combat keywords', () => {
  it('applies lifesteal healing to the attacking unit', () => {
    const attacker = makeUnit('attacker', { health: 10, attackDamage: 4 });
    attacker.stats.health = 6;
    attacker.combatKeywords = { drain: makeKeyword('Lifesteal', 1, 0.5) };

    const defender = makeUnit('defender', { health: 14 });

    const resolution = defender.takeDamage(undefined, attacker);

    expect(resolution).not.toBeNull();
    expect(resolution?.attackerRemainingHealth).toBeCloseTo(8, 5);
    expect(attacker.stats.health).toBeCloseTo(8, 5);
    expect(defender.stats.health).toBe(10);
  });
});

