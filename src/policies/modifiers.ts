import type { PolicyDefinition } from '../data/policies.ts';
import type { PolicyStatKey, PolicyUnitModifiers } from './types.ts';

export interface PolicyModifierSummary {
  statMultipliers: Record<PolicyStatKey, number>;
  hitChanceBonus: number;
  damageTakenMultiplier: number;
  damageDealtMultiplier: number;
  upkeepMultiplier: number;
  upkeepDelta: number;
}

const STAT_KEYS: readonly PolicyStatKey[] = Object.freeze([
  'health',
  'attackDamage',
  'attackRange',
  'movementRange',
  'defense'
]);

function sanitizeMultiplier(value: unknown, fallback: number, min = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(min, numeric);
}

function sanitizeAdditive(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

export function createPolicyModifierSummary(): PolicyModifierSummary {
  const baseMultiplier = 1;
  return {
    statMultipliers: {
      health: baseMultiplier,
      attackDamage: baseMultiplier,
      attackRange: baseMultiplier,
      movementRange: baseMultiplier,
      defense: baseMultiplier
    },
    hitChanceBonus: 0,
    damageTakenMultiplier: 1,
    damageDealtMultiplier: 1,
    upkeepMultiplier: 1,
    upkeepDelta: 0
  } satisfies PolicyModifierSummary;
}

export function applyPolicyUnitModifiers(
  summary: PolicyModifierSummary,
  modifiers: PolicyUnitModifiers | undefined
): PolicyModifierSummary {
  if (!modifiers) {
    return summary;
  }

  if (modifiers.statMultipliers) {
    for (const key of STAT_KEYS) {
      const factor = modifiers.statMultipliers[key];
      if (factor === undefined) {
        continue;
      }
      const sanitized = sanitizeMultiplier(factor, summary.statMultipliers[key]);
      summary.statMultipliers[key] = summary.statMultipliers[key] * sanitized;
    }
  }

  if (modifiers.hitChanceBonus !== undefined) {
    const sanitized = sanitizeAdditive(modifiers.hitChanceBonus);
    summary.hitChanceBonus += sanitized;
  }

  if (modifiers.damageTakenMultiplier !== undefined) {
    const sanitized = sanitizeMultiplier(modifiers.damageTakenMultiplier, 1);
    summary.damageTakenMultiplier *= sanitized;
  }

  if (modifiers.damageDealtMultiplier !== undefined) {
    const sanitized = sanitizeMultiplier(modifiers.damageDealtMultiplier, 1);
    summary.damageDealtMultiplier *= sanitized;
  }

  if (modifiers.upkeepMultiplier !== undefined) {
    const sanitized = sanitizeMultiplier(modifiers.upkeepMultiplier, 1);
    summary.upkeepMultiplier *= sanitized;
  }

  if (modifiers.upkeepDelta !== undefined) {
    const sanitized = sanitizeAdditive(modifiers.upkeepDelta);
    summary.upkeepDelta += sanitized;
  }

  return summary;
}

export function combinePolicyModifiers(
  policies: Iterable<PolicyDefinition>
): PolicyModifierSummary {
  const summary = createPolicyModifierSummary();
  for (const policy of policies) {
    applyPolicyUnitModifiers(summary, policy.unitModifiers);
  }
  return summary;
}

export function clonePolicyModifierSummary(
  summary: PolicyModifierSummary
): PolicyModifierSummary {
  return {
    statMultipliers: {
      health: summary.statMultipliers.health,
      attackDamage: summary.statMultipliers.attackDamage,
      attackRange: summary.statMultipliers.attackRange,
      movementRange: summary.statMultipliers.movementRange,
      defense: summary.statMultipliers.defense
    },
    hitChanceBonus: summary.hitChanceBonus,
    damageTakenMultiplier: summary.damageTakenMultiplier,
    damageDealtMultiplier: summary.damageDealtMultiplier,
    upkeepMultiplier: summary.upkeepMultiplier,
    upkeepDelta: summary.upkeepDelta
  } satisfies PolicyModifierSummary;
}

export { STAT_KEYS as POLICY_STAT_KEYS };
