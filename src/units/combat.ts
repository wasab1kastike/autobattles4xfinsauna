import type { Saunoja } from './saunoja.ts';

/**
 * Apply incoming damage to a Saunoja, mutating its hit points in-place.
 *
 * @param target The sauna enjoyer receiving damage.
 * @param amount The raw damage amount. Non-positive values are ignored.
 * @returns `true` when the Saunoja has zero hit points after the attack.
 */
export function applyDamage(target: Saunoja, amount: number): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return target.hp <= 0;
  }

  target.hp = Math.max(0, target.hp - amount);
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  target.lastHitAt = now;
  return target.hp === 0;
}
