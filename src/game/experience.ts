import { computeUnitStats } from '../unit/calc.ts';
import { tryGetUnitArchetype } from '../unit/archetypes.ts';
import type { Unit } from '../units/Unit.ts';

export const XP_STANDARD_KILL = 6;
export const XP_ELITE_KILL = 40;
export const XP_BOSS_KILL = 250;

export function isEliteUnit(unit: Unit | null): boolean {
  if (!unit) {
    return false;
  }
  const archetype = tryGetUnitArchetype(unit.type);
  if (!archetype) {
    return false;
  }
  const baseline = computeUnitStats(archetype, 1);
  const stats = unit.stats;
  return (
    stats.health > baseline.health ||
    stats.attackDamage > baseline.attackDamage ||
    stats.attackRange > baseline.attackRange ||
    stats.movementRange > baseline.movementRange
  );
}

export function calculateKillExperience(target: Unit | null): {
  xp: number;
  elite: boolean;
  boss: boolean;
} {
  if (!target) {
    return { xp: XP_STANDARD_KILL, elite: false, boss: false };
  }
  if (target.isBoss) {
    return { xp: XP_BOSS_KILL, elite: true, boss: true };
  }
  const elite = isEliteUnit(target);
  if (elite) {
    return { xp: XP_ELITE_KILL, elite: true, boss: false };
  }
  return { xp: XP_STANDARD_KILL, elite: false, boss: false };
}
