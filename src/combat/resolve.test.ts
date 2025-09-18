import { describe, it, expect, vi, afterEach } from 'vitest';
import { resolveCombat } from './resolve.ts';
import type { CombatParticipant } from './resolve.ts';
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
  });
});
