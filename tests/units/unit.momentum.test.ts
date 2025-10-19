import { describe, expect, it } from 'vitest';
import { UNIT_MOVEMENT_STEP_SECONDS, Unit } from '../../src/units/Unit.ts';

function createUnit(): Unit {
  return new Unit('test-unit', 'soldier', { q: 0, r: 0 }, 'player', {
    health: 12,
    attackDamage: 4,
    attackRange: 1,
    movementRange: 2
  });
}

describe('Unit momentum utilities', () => {
  it('applies movement step scalar to cooldown checks', () => {
    const unit = createUnit();
    unit.setMovementStepScalar(0.5);
    unit.addMovementTime(UNIT_MOVEMENT_STEP_SECONDS);
    expect(unit.canStep()).toBe(true);
    const consumed = unit.consumeMovementCooldown();
    expect(consumed).toBe(true);
    expect(unit.getMovementCooldownSeconds()).toBeCloseTo(2.5, 5);
  });

  it('normalizes and caps the stored momentum state', () => {
    const unit = createUnit();
    unit.setMomentumState({ pendingStrikes: 5, tilesMovedThisTick: -3, maxStacks: 2 });
    const momentum = unit.getMomentumState();
    expect(momentum).not.toBeNull();
    expect(momentum?.maxStacks).toBe(2);
    expect(momentum?.pendingStrikes).toBe(2);
    expect(momentum?.tilesMovedThisTick).toBe(0);
  });
});
