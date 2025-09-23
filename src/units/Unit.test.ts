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

describe('Unit behavior', () => {
  it('defaults to defend for player-controlled units', () => {
    const stats = { health: 12, attackDamage: 3, attackRange: 1, movementRange: 1 };
    const unit = new Unit('player-behavior', 'soldier', { ...BASE_COORD }, 'player', stats);
    expect(unit.getBehavior()).toBe('defend');
  });

  it('defaults to attack for non-player factions', () => {
    const stats = { health: 10, attackDamage: 4, attackRange: 1, movementRange: 1 };
    const foe = new Unit('enemy-behavior', 'soldier', { ...BASE_COORD }, 'enemy', stats);
    const neutral = new Unit('neutral-behavior', 'soldier', { ...BASE_COORD }, 'neutral', stats);
    expect(foe.getBehavior()).toBe('attack');
    expect(neutral.getBehavior()).toBe('attack');
  });

  it('supports overriding and mutating the behavior preference', () => {
    const stats = { health: 9, attackDamage: 2, attackRange: 1, movementRange: 1 };
    const explorer = new Unit(
      'explorer-behavior',
      'scout',
      { ...BASE_COORD },
      'player',
      stats,
      [],
      'explore'
    );
    expect(explorer.getBehavior()).toBe('explore');
    explorer.setBehavior('attack');
    expect(explorer.getBehavior()).toBe('attack');
  });
});

