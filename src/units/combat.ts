import type { CombatParticipant } from '../combat/resolve.ts';
import { resolveCombat } from '../combat/resolve.ts';
import type { Saunoja } from './saunoja.ts';

/**
 * Apply incoming damage to a Saunoja, mutating its hit points in-place.
 *
 * @param target The sauna enjoyer receiving damage.
 * @param amount The raw damage amount. Non-positive values are ignored.
 * @returns `true` when the Saunoja has zero hit points after the attack.
 */
export function applyDamage(
  target: Saunoja,
  amount: number,
  attacker?: CombatParticipant | null
): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return target.hp <= 0;
  }

  const result = resolveCombat({
    attacker: attacker ?? null,
    defender: {
      id: target.id,
      faction: undefined,
      defense: target.defense,
      health: target.hp,
      maxHealth: target.maxHp,
      shield: target.shield ?? 0,
      hooks: target.combatHooks ?? null,
      keywords: target.combatKeywords ?? null,
      damageTakenMultiplier: target.damageTakenMultiplier
    },
    baseDamage: amount
  });

  target.hp = result.remainingHealth;
  target.shield = result.remainingShield;

  if (result.damage > 0) {
    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    target.lastHitAt = now;
  }

  return result.lethal;
}
