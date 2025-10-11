import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { resolveCombat } from './resolve.ts';
import type { CombatParticipant } from './resolve.ts';
import { makeKeyword } from '../keywords/index.ts';
import * as runtime from '../mods/runtime.ts';
import { applyPolicyUnitModifiers, createPolicyModifierSummary } from '../policies/modifiers.ts';
import { setActivePolicyModifiers } from '../policies/runtime.ts';
import { getPolicyDefinition } from '../data/policies.ts';

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  setActivePolicyModifiers(createPolicyModifierSummary());
});

describe('resolveCombat', () => {
  it('enforces a minimum of one damage even when defense exceeds attack', () => {
    const attacker: CombatParticipant = {
      id: 'attacker',
      faction: 'alpha',
      attack: 2,
      health: 10,
      maxHealth: 10,
      shield: 0
    };
    const defender: CombatParticipant = {
      id: 'defender',
      faction: 'beta',
      defense: 5,
      health: 15,
      maxHealth: 15,
      shield: 0
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(1);
    expect(result.hpDamage).toBe(1);
    expect(result.shieldDamage).toBe(0);
    expect(result.remainingHealth).toBe(14);
    expect(result.remainingShield).toBe(0);
    expect(result.lethal).toBe(false);
    expect(result.attackerHealing).toBe(0);
    expect(result.hit).toBe(true);
    expect(result.keywordEffects.attacker.tickHpDamage).toBe(0);
    expect(result.keywordEffects.defender.tickHpDamage).toBe(0);
  });

  it('routes damage through shields before health', () => {
    const attacker: CombatParticipant = {
      id: 'attacker',
      faction: 'alpha',
      attack: 6,
      health: 8,
      maxHealth: 8,
      shield: 0
    };
    const defender: CombatParticipant = {
      id: 'defender',
      faction: 'beta',
      defense: 1,
      health: 12,
      maxHealth: 12,
      shield: 4
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(5);
    expect(result.shieldDamage).toBe(4);
    expect(result.hpDamage).toBe(1);
    expect(result.remainingShield).toBe(0);
    expect(result.remainingHealth).toBe(11);
    expect(result.lethal).toBe(false);
    expect(result.attackerHealing).toBe(0);
    expect(result.hit).toBe(true);
    expect(result.keywordEffects.defender.tickShieldDamage).toBe(0);
  });

  it('invokes keyword, hook, and modifier callbacks for lethal blows', () => {
    const attackerHit = vi.fn();
    const attackerKill = vi.fn();
    const defenderHit = vi.fn();
    const defenderKill = vi.fn();
    const triggerSpy = vi.spyOn(runtime, 'triggerModifierHook');

    const attacker: CombatParticipant = {
      id: 'attacker',
      faction: 'alpha',
      attack: 9,
      health: 10,
      maxHealth: 10,
      shield: 0,
      keywords: [
        {
          onHit: attackerHit,
          onKill: attackerKill
        }
      ]
    };

    const defender: CombatParticipant = {
      id: 'defender',
      faction: 'beta',
      defense: 1,
      health: 4,
      maxHealth: 4,
      shield: 0,
      hooks: {
        onHit: defenderHit,
        onKill: defenderKill
      }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.lethal).toBe(true);
    expect(attackerHit).toHaveBeenCalledTimes(1);
    expect(attackerKill).toHaveBeenCalledTimes(1);
    expect(defenderHit).toHaveBeenCalledTimes(1);
    expect(defenderKill).toHaveBeenCalledTimes(1);
    expect(result.hit).toBe(true);

    const attackerPayload = attackerHit.mock.calls[0][0];
    expect(attackerPayload.source).toBe('attacker');
    expect(attackerPayload.lethal).toBe(true);
    expect(attackerPayload.defender.health).toBe(0);

    const defenderPayload = defenderHit.mock.calls[0][0];
    expect(defenderPayload.source).toBe('defender');
    expect(defenderPayload.shieldDamage + defenderPayload.hpDamage).toBe(result.damage);

    expect(triggerSpy).toHaveBeenCalledTimes(4);
    expect(triggerSpy).toHaveBeenNthCalledWith(
      1,
      'combat:onHit',
      expect.objectContaining({ source: 'defender' })
    );
    expect(triggerSpy).toHaveBeenNthCalledWith(
      2,
      'combat:onHit',
      expect.objectContaining({ source: 'attacker' })
    );
    expect(triggerSpy).toHaveBeenNthCalledWith(
      3,
      'combat:onKill',
      expect.objectContaining({ source: 'attacker' })
    );
    expect(triggerSpy).toHaveBeenNthCalledWith(
      4,
      'combat:onKill',
      expect.objectContaining({ source: 'defender' })
    );

    expect(result.attackerHealing).toBe(0);
    expect(result.keywordEffects.attacker.tickHpDamage).toBe(0);
    expect(result.keywordEffects.defender.tickHpDamage).toBe(0);
  });

  it('applies bleed damage-over-time before resolving the attack', () => {
    const bleed = makeKeyword('Bleed', 3);

    const attacker: CombatParticipant = {
      id: 'bleed-attacker',
      faction: 'alpha',
      attack: 6,
      health: 9,
      maxHealth: 9,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'bleed-defender',
      faction: 'beta',
      defense: 1,
      health: 10,
      maxHealth: 10,
      shield: 0,
      keywords: { bleed }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(5);
    expect(result.hpDamage).toBe(5);
    expect(result.keywordEffects.defender.tickHpDamage).toBe(3);
    expect(result.keywordEffects.defender.tickShieldDamage).toBe(0);
    expect(result.remainingHealth).toBe(2);
    expect(bleed.stacks).toBe(2);
    expect(result.lethal).toBe(false);
    expect(result.hit).toBe(true);
  });

  it('drops defenders with lethal bleed ticks before a strike resolves', () => {
    const bleed = makeKeyword('Bleed', 2, 5);

    const onHit = vi.fn();
    const onKill = vi.fn();

    const attacker: CombatParticipant = {
      id: 'bleed-executioner',
      faction: 'alpha',
      attack: 4,
      health: 12,
      maxHealth: 12,
      shield: 0,
      hooks: { onHit, onKill }
    };

    const defender: CombatParticipant = {
      id: 'bleed-victim',
      faction: 'beta',
      defense: 1,
      health: 7,
      maxHealth: 7,
      shield: 0,
      keywords: { bleed }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(0);
    expect(result.hpDamage).toBe(0);
    expect(result.lethal).toBe(true);
    expect(result.keywordEffects.defender.tickHpDamage).toBe(7);
    expect(result.keywordEffects.defender.tickShieldDamage).toBe(0);
   expect(bleed.stacks).toBe(1);
    expect(onHit).toHaveBeenCalledTimes(1);
    expect(onKill).toHaveBeenCalledTimes(1);
    expect(result.hit).toBe(true);
    expect(onKill.mock.calls[0][0].lethal).toBe(true);
  });

  it("respects Saunojas' Rage modifiers for damage and hit reliability", () => {
    const rage = getPolicyDefinition('saunojas-rage');
    expect(rage).toBeTruthy();

    const summary = createPolicyModifierSummary();
    applyPolicyUnitModifiers(summary, rage?.unitModifiers);
    setActivePolicyModifiers(summary);

    const attacker: CombatParticipant = {
      id: 'berserker',
      faction: 'player',
      attack: 10,
      health: 12,
      maxHealth: 12,
      shield: 0
    };

    const defenderBase: CombatParticipant = {
      id: 'target',
      faction: 'enemy',
      defense: 2,
      health: 30,
      maxHealth: 30,
      shield: 0
    };

    const guaranteedHit = resolveCombat({
      attacker,
      defender: { ...defenderBase },
      random: () => 0.49
    });

    expect(guaranteedHit.hit).toBe(true);
    expect(guaranteedHit.damage).toBe(18);

    const forcedMiss = resolveCombat({
      attacker,
      defender: { ...defenderBase },
      random: () => 0.51
    });

    expect(forcedMiss.hit).toBe(false);
    expect(forcedMiss.damage).toBe(0);
  });

  it('burn consumes shields before chipping health each tick', () => {
    const burn = makeKeyword('Burn', 4);

    const attacker: CombatParticipant = {
      id: 'burn-attacker',
      faction: 'alpha',
      attack: 6,
      health: 10,
      maxHealth: 10,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'burn-defender',
      faction: 'beta',
      defense: 0,
      health: 12,
      maxHealth: 12,
      shield: 3,
      keywords: { burn }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.keywordEffects.defender.tickShieldDamage).toBe(3);
    expect(result.keywordEffects.defender.tickHpDamage).toBe(1);
    expect(result.damage).toBe(6);
    expect(result.remainingHealth).toBe(5);
    expect(result.remainingShield).toBe(0);
    expect(burn.stacks).toBe(3);
    expect(result.hit).toBe(true);
  });

  it('reports combined shield total when barrier stacks remain after the hit', () => {
    const barrier = makeKeyword('Shield', 3);

    const attacker: CombatParticipant = {
      id: 'shield-attacker',
      faction: 'alpha',
      attack: 3,
      health: 10,
      maxHealth: 10,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'shield-defender',
      faction: 'beta',
      defense: 2,
      health: 10,
      maxHealth: 10,
      shield: 2,
      keywords: { barrier }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(1);
    expect(result.shieldDamage).toBe(1);
    expect(result.hpDamage).toBe(0);
    expect(result.keywordEffects.defender.shieldGranted).toBe(3);
    expect(result.keywordEffects.defender.shieldConsumed).toBe(0);
    expect(result.keywordEffects.defender.keywordShieldRemaining).toBe(3);
    const expectedRemaining =
      Math.max(0, defender.shield - result.shieldDamage) +
      result.keywordEffects.defender.keywordShieldRemaining;
    expect(result.remainingShield).toBe(expectedRemaining);
    expect(barrier.stacks).toBe(3);
    expect(result.hit).toBe(true);
  });

  it('combines keyword and base shields while tracking remaining barrier stacks', () => {
    const barrier = makeKeyword('Shield', 2, 4);

    const attacker: CombatParticipant = {
      id: 'barrier-attacker',
      faction: 'alpha',
      attack: 10,
      health: 10,
      maxHealth: 10,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'barrier-defender',
      faction: 'beta',
      defense: 0,
      health: 10,
      maxHealth: 10,
      shield: 3,
      keywords: { barrier }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(10);
    expect(result.shieldDamage).toBe(10);
    expect(result.hpDamage).toBe(0);
    expect(result.remainingShield).toBe(1);
    expect(result.keywordEffects.defender.shieldGranted).toBe(8);
    expect(result.keywordEffects.defender.shieldConsumed).toBe(7);
    expect(result.keywordEffects.defender.keywordShieldRemaining).toBe(1);
    expect(barrier.stacks).toBeCloseTo(0.25, 5);
    expect(result.hit).toBe(true);
  });

  it('heals attackers with lifesteal after health damage is applied', () => {
    const lifesteal = makeKeyword('Lifesteal', 1, 0.5);

    const attacker: CombatParticipant = {
      id: 'lifesteal-attacker',
      faction: 'alpha',
      attack: 6,
      health: 5,
      maxHealth: 10,
      shield: 0,
      keywords: { lifesteal }
    };

    const defender: CombatParticipant = {
      id: 'lifesteal-defender',
      faction: 'beta',
      defense: 1,
      health: 14,
      maxHealth: 14,
      shield: 0
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.hpDamage).toBe(5);
    expect(result.attackerHealing).toBeCloseTo(2.5, 5);
    expect(result.attackerRemainingHealth).toBeCloseTo(7.5, 5);
    expect(result.keywordEffects.attacker.lifesteal).toBeCloseTo(2.5, 5);
    expect(lifesteal.stacks).toBe(1);
    expect(result.hit).toBe(true);
  });

  it('caps lifesteal healing at the attacker maximum health', () => {
    const lifesteal = makeKeyword('Lifesteal', 2, 1);

    const attacker: CombatParticipant = {
      id: 'lifesteal-cap-attacker',
      faction: 'alpha',
      attack: 8,
      health: 9,
      maxHealth: 10,
      shield: 0,
      keywords: { lifesteal }
    };

    const defender: CombatParticipant = {
      id: 'lifesteal-cap-defender',
      faction: 'beta',
      defense: 2,
      health: 20,
      maxHealth: 20,
      shield: 0
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.hpDamage).toBe(6);
    expect(result.attackerHealing).toBe(1);
    expect(result.keywordEffects.attacker.lifesteal).toBe(1);
    expect(result.attackerRemainingHealth).toBe(10);
    expect(lifesteal.stacks).toBe(2);
    expect(result.hit).toBe(true);
  });

  it('applies policy damage and hit chance modifiers for player units', () => {
    const summary = createPolicyModifierSummary();
    summary.damageDealtMultiplier = 1.4;
    summary.damageTakenMultiplier = 0.5;
    summary.hitChanceBonus = -0.25;
    setActivePolicyModifiers(summary);

    const attacker: CombatParticipant = {
      id: 'policy-attacker',
      faction: 'player',
      attack: 10,
      health: 12,
      maxHealth: 12,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'policy-defender',
      faction: 'player',
      defense: 2,
      health: 14,
      maxHealth: 14,
      shield: 0
    };

    const result = resolveCombat({ attacker, defender, random: () => 0.1 });

    const effectiveAttack = (attacker.attack ?? 0) * summary.damageDealtMultiplier;
    const preDefense = Math.max(0, effectiveAttack - (defender.defense ?? 0));
    const scaledMinDamage = summary.damageTakenMultiplier;
    const expectedDamage = Math.max(scaledMinDamage, preDefense * summary.damageTakenMultiplier);

    expect(result.hit).toBe(true);
    expect(result.damage).toBeCloseTo(expectedDamage, 5);
    expect(result.hpDamage).toBeCloseTo(expectedDamage, 5);
    expect(result.remainingHealth).toBeCloseTo(Math.max(defender.health - expectedDamage, 0), 5);
    expect(result.lethal).toBe(false);
  });

  it('records misses when policy hit chance adjustments fail the roll', () => {
    const summary = createPolicyModifierSummary();
    summary.hitChanceBonus = -0.6;
    setActivePolicyModifiers(summary);

    const attacker: CombatParticipant = {
      id: 'policy-miss',
      faction: 'player',
      attack: 8,
      health: 10,
      maxHealth: 10,
      shield: 0
    };

    const defender: CombatParticipant = {
      id: 'policy-target',
      faction: 'enemy',
      defense: 1,
      health: 9,
      maxHealth: 9,
      shield: 0
    };

    const result = resolveCombat({ attacker, defender, random: () => 0.95 });

    expect(result.hit).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.hpDamage).toBe(0);
    expect(result.remainingHealth).toBe(9);
    expect(result.lethal).toBe(false);
  });
});
