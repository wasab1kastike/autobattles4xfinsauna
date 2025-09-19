import type { StatProgression, UnitArchetypeDefinition, UnitStats } from './types.ts';
import type { RoundingMode } from './types.ts';
import type { EquippedItem } from '../items/types.ts';
import type { SaunojaStatBlock } from '../units/saunoja.ts';
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

function resolveBaseNumber(value?: number): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

export function applyEquipment(
  base: SaunojaStatBlock,
  loadout: readonly EquippedItem[]
): SaunojaStatBlock {
  let health = base.health;
  let attackDamage = base.attackDamage;
  let attackRange = base.attackRange;
  let movementRange = base.movementRange;
  let defense = resolveBaseNumber(base.defense);
  let shield = resolveBaseNumber(base.shield);

  for (const item of loadout) {
    const stacks = Math.max(1, Math.round(item.quantity));
    const mods = item.modifiers;
    if (typeof mods.health === 'number') {
      health += mods.health * stacks;
    }
    if (typeof mods.attackDamage === 'number') {
      attackDamage += mods.attackDamage * stacks;
    }
    if (typeof mods.attackRange === 'number') {
      attackRange += mods.attackRange * stacks;
    }
    if (typeof mods.movementRange === 'number') {
      movementRange += mods.movementRange * stacks;
    }
    if (typeof mods.defense === 'number') {
      defense = (defense ?? 0) + mods.defense * stacks;
    }
    if (typeof mods.shield === 'number') {
      shield = (shield ?? 0) + mods.shield * stacks;
    }
  }

  const result: SaunojaStatBlock = {
    health: Math.max(1, Math.round(health)),
    attackDamage: Math.max(0, Math.round(attackDamage)),
    attackRange: Math.max(0, Math.round(attackRange)),
    movementRange: Math.max(0, Math.round(movementRange))
  } satisfies SaunojaStatBlock;

  if (defense !== undefined) {
    result.defense = Math.max(0, Math.round(defense));
  }
  if (shield !== undefined) {
    result.shield = Math.max(0, Math.round(shield));
  }
  if (typeof base.visionRange === 'number' && Number.isFinite(base.visionRange)) {
    result.visionRange = Math.max(0, Math.round(base.visionRange));
  }

  return result;
}

