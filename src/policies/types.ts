export type PolicyStatKey = 'health' | 'attackDamage' | 'attackRange' | 'movementRange' | 'defense';

export interface PolicyUnitModifiers {
  readonly statMultipliers?: Partial<Record<PolicyStatKey, number>>;
  readonly hitChanceBonus?: number;
  readonly damageTakenMultiplier?: number;
  readonly damageDealtMultiplier?: number;
  readonly upkeepMultiplier?: number;
  readonly upkeepDelta?: number;
}
