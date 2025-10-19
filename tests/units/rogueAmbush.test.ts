import { describe, expect, it } from 'vitest';
import { Unit } from '../../src/units/Unit.ts';

function createRogue(): Unit {
  const unit = new Unit(
    'rogue-1',
    'soldier',
    { q: 0, r: 0 },
    'player',
    {
      health: 100,
      attackDamage: 10,
      attackRange: 1,
      movementRange: 3
    }
  );
  unit.updateStats({
    health: unit.getMaxHealth(),
    attackDamage: unit.stats.attackDamage,
    attackRange: unit.stats.attackRange,
    movementRange: unit.stats.movementRange,
    damageDealtMultiplier: 1.25
  });
  unit.setRogueAmbush({ teleportRange: 5, burstMultiplier: 2 });
  return unit;
}

function createDummyTarget(): Unit {
  return new Unit(
    'target-1',
    'soldier',
    { q: 1, r: 0 },
    'enemy',
    {
      health: 100,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 0
    }
  );
}

describe('rogue combat modifiers', () => {
  it('applies the rogue attack multiplier to outgoing damage', () => {
    const rogue = createRogue();
    const target = createDummyTarget();

    const result = rogue.attack(target);

    expect(result?.damage).toBeCloseTo(12.5, 5);
    expect(target.stats.health).toBeCloseTo(87.5, 5);
  });

  it('doubles the first strike after a teleport before resetting the boost', () => {
    const rogue = createRogue();
    const target = createDummyTarget();

    rogue.markRogueAmbushTeleport();
    const first = rogue.attack(target);
    expect(first?.damage).toBeCloseTo(25, 5);
    expect(target.stats.health).toBeCloseTo(75, 5);
    expect(rogue.stats.damageDealtMultiplier).toBeCloseTo(1.25, 5);

    const second = rogue.attack(target);
    expect(second?.damage).toBeCloseTo(12.5, 5);
    expect(target.stats.health).toBeCloseTo(62.5, 5);
  });
});
