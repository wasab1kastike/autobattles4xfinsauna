import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveCombat } from './resolve.ts';
import type { CombatParticipant } from './resolve.ts';
import { makeKeyword } from '../keywords/index.ts';
import * as runtime from '../mods/runtime.ts';

afterEach(() => {
  vi.restoreAllMocks();
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
    expect(onKill.mock.calls[0][0].lethal).toBe(true);
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
  });

  it('grants and consumes keyword shield stacks before applying damage', () => {
    const barrier = makeKeyword('Shield', 3);

    const attacker: CombatParticipant = {
      id: 'shield-attacker',
      faction: 'alpha',
      attack: 4,
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
      shield: 0,
      keywords: { barrier }
    };

    const result = resolveCombat({ attacker, defender });

    expect(result.damage).toBe(2);
    expect(result.hpDamage).toBe(0);
    expect(result.keywordEffects.defender.shieldGranted).toBe(3);
    expect(result.keywordEffects.defender.shieldConsumed).toBe(2);
    expect(result.keywordEffects.defender.keywordShieldRemaining).toBe(1);
    expect(result.remainingShield).toBe(0);
    expect(barrier.stacks).toBe(1);
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
    expect(result.remainingShield).toBe(0);
    expect(result.keywordEffects.defender.shieldGranted).toBe(8);
    expect(result.keywordEffects.defender.shieldConsumed).toBe(7);
    expect(result.keywordEffects.defender.keywordShieldRemaining).toBe(1);
    expect(barrier.stacks).toBeCloseTo(0.25, 5);
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
  });
});
