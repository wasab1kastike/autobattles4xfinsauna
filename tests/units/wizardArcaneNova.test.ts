import { describe, expect, it } from 'vitest';
import { Unit } from '../../src/units/Unit.ts';

function createWizard(): Unit {
  const unit = new Unit(
    'wizard-1',
    'mage',
    { q: 0, r: 0 },
    'player',
    {
      health: 80,
      attackDamage: 10,
      attackRange: 2,
      movementRange: 2
    }
  );
  unit.setArcaneNova({ radius: 2, multiplier: 0.4 });
  return unit;
}

function createEnemy(id: string, coord: { q: number; r: number }): Unit {
  return new Unit(
    id,
    'raider',
    coord,
    'enemy',
    {
      health: 100,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 1
    }
  );
}

describe('wizard arcane nova', () => {
  it('sanitizes arcane nova state and exposes accessors', () => {
    const wizard = createWizard();

    expect(wizard.hasArcaneNova()).toBe(true);
    expect(wizard.getArcaneNovaRadius()).toBe(2);
    expect(wizard.getArcaneNovaMultiplier()).toBeCloseTo(0.4, 5);

    wizard.setArcaneNova({ radius: 0, multiplier: 0.5 });
    expect(wizard.hasArcaneNova()).toBe(false);
    expect(wizard.getArcaneNovaRadius()).toBe(0);

    wizard.setArcaneNova({ radius: 3.8, multiplier: 0.65 });
    expect(wizard.hasArcaneNova()).toBe(true);
    expect(wizard.getArcaneNovaRadius()).toBe(3);
    expect(wizard.getArcaneNovaMultiplier()).toBeCloseTo(0.65, 5);
  });

  it('fans out splash damage to nearby enemies using the configured multiplier', () => {
    const wizard = createWizard();
    const primary = createEnemy('target', { q: 1, r: 0 });
    const nearby = createEnemy('nearby', { q: 2, r: 0 });
    const distant = createEnemy('distant', { q: 4, r: 0 });

    wizard.stats.damageDealtMultiplier = 1.1;

    const units: Unit[] = [wizard, primary, nearby, distant];

    const resolution = wizard.attack(primary, { units });

    expect(resolution?.damage).toBeCloseTo(11, 5);
    expect(primary.stats.health).toBeCloseTo(89, 5);
    expect(nearby.stats.health).toBeCloseTo(95.6, 5);
    expect(distant.stats.health).toBeCloseTo(100, 5);
  });
});
