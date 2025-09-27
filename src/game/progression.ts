import type { Unit } from '../unit/index.ts';
import type { Saunoja, SaunojaStatBlock } from '../units/saunoja.ts';
import {
  getLevelForExperience,
  getLevelProgress,
  getStatAwardsForLevel,
  getTotalStatAwards,
  type StatAwards
} from '../progression/experiencePlan.ts';
import { tryGetUnitArchetype } from '../unit/archetypes.ts';
import { computeUnitStats } from '../unit/calc.ts';
import type { LogEventPayload } from '../ui/logging.ts';

export const XP_STANDARD_KILL = 6;
export const XP_ELITE_KILL = 40;
export const XP_BOSS_KILL = 250;
export const XP_OBJECTIVE_COMPLETION = 200;

const MAX_LEVEL = getLevelForExperience(Number.MAX_SAFE_INTEGER);

export type ExperienceSource = 'kill' | 'objective' | 'test';

export interface ExperienceContext {
  source: ExperienceSource;
  label?: string;
  elite?: boolean;
  boss?: boolean;
}

export interface ExperienceGrantResult {
  xpAwarded: number;
  totalXp: number;
  level: number;
  levelsGained: number;
  statBonuses: StatAwards;
}

export interface SaunojaPolicyBaselineSnapshot {
  base: SaunojaStatBlock;
  upkeep: number;
}

export interface ProgressionDependencies {
  getRoster(): readonly Saunoja[];
  getAttachedUnitFor(attendant: Saunoja): Unit | null;
  findSaunojaByUnit(unit: Unit): Saunoja | null;
  withSaunojaBaseline<T>(
    attendant: Saunoja,
    mutate: (baseline: SaunojaPolicyBaselineSnapshot) => T
  ): T;
  log(event: LogEventPayload): void;
}

const describeStatBonuses = (bonuses: StatAwards): string => {
  const parts: string[] = [];
  if (bonuses.vigor > 0) {
    parts.push(`+${bonuses.vigor} Vigor`);
  }
  if (bonuses.focus > 0) {
    parts.push(`+${bonuses.focus} Focus`);
  }
  if (bonuses.resolve > 0) {
    parts.push(`+${bonuses.resolve} Resolve`);
  }
  return parts.length > 0 ? parts.join(', ') : '+0 Vigor, +0 Focus, +0 Resolve';
};

export const isEliteUnit = (unit: Unit | null): boolean => {
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
};

export const createProgressionManager = (deps: ProgressionDependencies) => {
  const buildProgression = (attendant: Saunoja): {
    level: number;
    xp: number;
    xpIntoLevel: number;
    xpForNext: number;
    progress: number;
    statBonuses: StatAwards;
  } => {
    const progress = getLevelProgress(attendant.xp);
    return {
      level: progress.level,
      xp: Math.max(0, Math.floor(attendant.xp)),
      xpIntoLevel: progress.xpIntoLevel,
      xpForNext: progress.xpForNext,
      progress: progress.progressToNext,
      statBonuses: getTotalStatAwards(progress.level)
    } as const;
  };

  const grantSaunojaExperience = (
    attendant: Saunoja,
    amount: number,
    context: ExperienceContext
  ): ExperienceGrantResult | null => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return null;
    }
    const before = getLevelProgress(attendant.xp);
    const nextXp = Math.max(0, Math.floor(attendant.xp + amount));
    if (nextXp === attendant.xp) {
      return null;
    }
    attendant.xp = nextXp;
    const after = getLevelProgress(attendant.xp);
    const levelsGained = Math.max(0, after.level - before.level);
    const statBonuses: StatAwards = { vigor: 0, focus: 0, resolve: 0 };
    let bonusHealth = 0;
    if (levelsGained > 0) {
      deps.withSaunojaBaseline(attendant, (baseline) => {
        for (let level = before.level + 1; level <= after.level && level <= MAX_LEVEL; level++) {
          const award = getStatAwardsForLevel(level);
          statBonuses.vigor += award.vigor;
          statBonuses.focus += award.focus;
          statBonuses.resolve += award.resolve;

          const baseStats = baseline.base;
          const baseHealth = Number.isFinite(baseStats.health)
            ? baseStats.health
            : attendant.effectiveStats.health;
          baseStats.health = Math.max(1, Math.round(baseHealth + award.vigor));

          const baseAttack = Number.isFinite(baseStats.attackDamage)
            ? baseStats.attackDamage
            : attendant.effectiveStats.attackDamage;
          baseStats.attackDamage = Math.max(0, Math.round(baseAttack + award.focus));

          const currentDefense = Number.isFinite(baseStats.defense)
            ? baseStats.defense ?? 0
            : attendant.effectiveStats.defense ?? 0;
          const nextDefense = currentDefense + award.resolve;
          baseStats.defense = nextDefense > 0 ? nextDefense : undefined;
        }
        return null;
      });
      bonusHealth = statBonuses.vigor;
    }

    if (bonusHealth > 0) {
      attendant.hp += bonusHealth;
    }

    const attachedUnit = deps.getAttachedUnitFor(attendant);
    attachedUnit?.setExperience(attendant.xp);

    if (context.source === 'kill') {
      const slayerName = attendant.name?.trim() || 'Our champion';
      const foeLabel = context.label?.trim() || 'their foe';
      const flourish = context.boss ? ' Boss toppled!' : context.elite ? ' Elite threat routed!' : '';
      deps.log({
        type: 'combat',
        message: `${slayerName} earns ${amount} XP for defeating ${foeLabel}.${flourish}`,
        metadata: {
          slayer: slayerName,
          foe: foeLabel,
          xpAward: amount,
          boss: Boolean(context.boss),
          elite: Boolean(context.elite)
        }
      });
    }

    if (levelsGained > 0) {
      const summary = describeStatBonuses(statBonuses);
      const unitName = attendant.name?.trim() || 'Our champion';
      deps.log({
        type: 'progression',
        message: `${unitName} reaches Level ${after.level}! ${summary}.`,
        metadata: {
          unit: unitName,
          level: after.level,
          levelsGained,
          bonuses: statBonuses
        }
      });
    }

    return {
      xpAwarded: amount,
      totalXp: attendant.xp,
      level: after.level,
      levelsGained,
      statBonuses
    } satisfies ExperienceGrantResult;
  };

  const grantExperienceToUnit = (
    unit: Unit | null,
    amount: number,
    context: ExperienceContext
  ): ExperienceGrantResult | null => {
    if (!unit) {
      return null;
    }
    const attendant = deps.findSaunojaByUnit(unit);
    if (!attendant) {
      return null;
    }
    return grantSaunojaExperience(attendant, amount, context);
  };

  const grantExperienceToRoster = (
    amount: number,
    context: ExperienceContext
  ): boolean => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return false;
    }
    let updated = false;
    for (const attendant of deps.getRoster()) {
      const result = grantSaunojaExperience(attendant, amount, context);
      if (result) {
        updated = true;
      }
    }
    return updated;
  };

  const calculateKillExperience = (
    target: Unit | null
  ): { xp: number; elite: boolean; boss: boolean } => {
    if (!target) {
      return { xp: XP_STANDARD_KILL, elite: false, boss: false };
    }
    const typeLabel = target.type?.toLowerCase?.() ?? '';
    const boss = typeLabel.includes('boss');
    if (boss) {
      return { xp: XP_BOSS_KILL, elite: true, boss: true };
    }
    const elite = isEliteUnit(target);
    if (elite) {
      return { xp: XP_ELITE_KILL, elite: true, boss: false };
    }
    return { xp: XP_STANDARD_KILL, elite: false, boss: false };
  };

  return {
    buildProgression,
    grantSaunojaExperience,
    grantExperienceToUnit,
    grantExperienceToRoster,
    calculateKillExperience
  };
};
