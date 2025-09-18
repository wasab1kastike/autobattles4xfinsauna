import type { StatProgression, UnitArchetypeDefinition, UnitStats } from './types.ts';
import type { RoundingMode } from './types.ts';
import { curveProgress, normalizeLevel } from './level.ts';

function applyRounding(value: number, mode: RoundingMode = 'round'): number {
  switch (mode) {
    case 'floor':
      return Math.floor(value);
    case 'ceil':
      return Math.ceil(value);
    case 'none':
      return value;
    case 'round':
    default:
      return Math.round(value);
  }
}

function clamp(value: number, min?: number, max?: number): number {
  let result = value;
  if (Number.isFinite(min)) {
    result = Math.max(result, min as number);
  }
  if (Number.isFinite(max)) {
    result = Math.min(result, max as number);
  }
  return result;
}

export function evaluateProgression(progression: StatProgression, level?: number): number {
  const resolvedLevel = normalizeLevel(level);
  const curve = progression.curve ?? 'linear';
  const progress = curveProgress(resolvedLevel, curve);
  const value = progression.base + progression.growth * progress;
  const bounded = clamp(value, progression.min, progression.max);
  return applyRounding(bounded, progression.round ?? 'round');
}

export function computeUnitStats(definition: UnitArchetypeDefinition, level?: number): UnitStats {
  const resolvedLevel = normalizeLevel(level);
  const stats = definition.stats;
  const base: UnitStats = {
    health: evaluateProgression(stats.health, resolvedLevel),
    attackDamage: evaluateProgression(stats.attackDamage, resolvedLevel),
    attackRange: evaluateProgression(stats.attackRange, resolvedLevel),
    movementRange: evaluateProgression(stats.movementRange, resolvedLevel)
  };
  if (stats.visionRange) {
    base.visionRange = evaluateProgression(stats.visionRange, resolvedLevel);
  }
  return base;
}

