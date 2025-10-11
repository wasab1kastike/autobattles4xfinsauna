import { describe, it, expect } from 'vitest';
import { computeUnitStats } from './calc.ts';
import {
  SOLDIER_ARCHETYPE,
  ARCHER_ARCHETYPE,
  AVANTO_MARAUDER_ARCHETYPE
} from './archetypes.ts';
import { SOLDIER_STATS } from '../units/Soldier.ts';
import { ARCHER_STATS } from '../units/Archer.ts';
import { AVANTO_MARAUDER_STATS } from '../units/AvantoMarauder.ts';
import { combinePolicyModifiers } from '../policies/modifiers.ts';
import { getPolicyDefinition } from '../data/policies.ts';

describe('computeUnitStats', () => {
  it('returns base archetype stats at level 1', () => {
    expect(computeUnitStats(SOLDIER_ARCHETYPE, 1)).toEqual(SOLDIER_STATS);
    expect(computeUnitStats(ARCHER_ARCHETYPE, 1)).toEqual(ARCHER_STATS);
    expect(computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, 1)).toEqual(AVANTO_MARAUDER_STATS);
  });

  it('normalizes invalid levels to the base level', () => {
    expect(computeUnitStats(SOLDIER_ARCHETYPE, 0)).toEqual(SOLDIER_STATS);
    expect(computeUnitStats(SOLDIER_ARCHETYPE, -5)).toEqual(SOLDIER_STATS);
    expect(computeUnitStats(ARCHER_ARCHETYPE, 1.9)).toEqual(ARCHER_STATS);
  });

  it('scales soldier stats linearly', () => {
    expect(computeUnitStats(SOLDIER_ARCHETYPE, 3)).toEqual({
      health: 32,
      attackDamage: 7,
      attackRange: 1,
      movementRange: 1,
      visionRange: 3
    });
    expect(computeUnitStats(SOLDIER_ARCHETYPE, 5)).toEqual({
      health: 44,
      attackDamage: 9,
      attackRange: 1,
      movementRange: 1,
      visionRange: 3
    });
  });

  it('applies archer acceleration and diminishing returns curves', () => {
    expect(computeUnitStats(ARCHER_ARCHETYPE, 3)).toEqual({
      health: 23,
      attackDamage: 5,
      attackRange: 4,
      movementRange: 1,
      visionRange: 4
    });
    expect(computeUnitStats(ARCHER_ARCHETYPE, 5)).toEqual({
      health: 31,
      attackDamage: 7,
      attackRange: 5,
      movementRange: 1,
      visionRange: 4
    });
  });

  it('caps marauder movement while accelerating damage', () => {
    expect(computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, 3)).toEqual({
      health: 22,
      attackDamage: 6,
      attackRange: 1,
      movementRange: 2,
      visionRange: 3
    });
    expect(computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, 7)).toEqual({
      health: 42,
      attackDamage: 17,
      attackRange: 1,
      movementRange: 2,
      visionRange: 3
    });
  });

  it('combines combat policy modifiers for downstream stat scaling', () => {
    const battle = getPolicyDefinition('battle-rhythm');
    const rage = getPolicyDefinition('saunojas-rage');
    const glacial = getPolicyDefinition('glacial-gambit');
    const shieldwall = getPolicyDefinition('shieldwall-doctrine');
    const saunaSkin = getPolicyDefinition('sauna-skin');
    expect(battle).toBeTruthy();
    expect(rage).toBeTruthy();
    expect(glacial).toBeTruthy();
    expect(shieldwall).toBeTruthy();
    expect(saunaSkin).toBeTruthy();

    const summary = combinePolicyModifiers([battle!, rage!, glacial!, shieldwall!, saunaSkin!]);
    expect(summary.statMultipliers.attackDamage).toBeCloseTo(1.15, 5);
    expect(summary.statMultipliers.movementRange).toBeCloseTo(1.05, 5);
    expect(summary.statMultipliers.attackRange).toBeCloseTo(1.35, 5);
    expect(summary.statMultipliers.defense).toBeCloseTo(1.04, 5);
    expect(summary.hitChanceBonus).toBeCloseTo(-0.15, 5);
    expect(summary.damageTakenMultiplier).toBeCloseTo(0.6375, 5);
    expect(summary.damageDealtMultiplier).toBeCloseTo(2.2, 5);
    expect(summary.upkeepMultiplier).toBeCloseTo(5.313, 5);
    expect(summary.upkeepDelta).toBeCloseTo(1.5, 5);
  });
});
