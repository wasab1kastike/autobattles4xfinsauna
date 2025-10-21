import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';
import { createSaunaHeat, type SaunaHeat, type SaunaHeatInit } from '../sauna/heat.ts';
import {
  sanitizeHealingAuraRadius,
  sanitizeHealingAuraRegen,
  type SaunaTier
} from '../sauna/tiers.ts';

const DEFAULT_SAUNA_MAX_HEALTH = 500;
export const DEFAULT_SAUNA_VISION_RANGE = 4;
const DEFAULT_SAUNA_SPAWN_SPEED = 1;

function sanitizeSpawnSpeedMultiplier(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SAUNA_SPAWN_SPEED;
  }
  const multiplier = Number(value);
  return multiplier > 0 ? multiplier : DEFAULT_SAUNA_SPAWN_SPEED;
}

function sanitizeVisionRange(value: number | null | undefined): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_SAUNA_VISION_RANGE;
  }
  return Math.max(0, Math.floor(value ?? 0));
}

export function pickFreeTileAround(
  origin: AxialCoord,
  radiusOrUnits: number | Unit[],
  maybeUnits?: Unit[]
): AxialCoord | null {
  const radius = typeof radiusOrUnits === 'number' ? radiusOrUnits : 2;
  const units = (typeof radiusOrUnits === 'number' ? maybeUnits : radiusOrUnits) ?? [];
  const candidates: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
      if (dist === 0 || dist > radius) continue;
      const coord = { q: origin.q + dq, r: origin.r + dr };
      const occupied = units.some(
        (u) => !u.isDead() && u.coord.q === coord.q && u.coord.r === coord.r
      );
      if (!occupied) {
        candidates.push(coord);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

export interface Sauna {
  id: 'sauna';
  pos: AxialCoord;
  auraRadius: number;
  visionRange: number;
  regenPerSec: number;
  rallyToFront: boolean;
  /** Player-selected maximum number of active attendants allowed on the field. */
  maxRosterSize: number;
  maxHealth: number;
  health: number;
  destroyed: boolean;
  heat: number;
  heatPerTick: number;
  spawnSpeedMultiplier: number;
  playerSpawnThreshold: number;
  playerSpawnCooldown: number;
  playerSpawnTimer: number;
  /**
   * Accumulates elapsed seconds between upkeep drains so beer only ticks down
   * at the intended cadence.
   */
  beerUpkeepAccumulator: number;
  heatTracker: SaunaHeat;
}

export interface SaunaInitOptions {
  /** Initial roster cap to seed onto the sauna. */
  maxRosterSize?: number;
  /** Maximum structure health. Defaults to {@link DEFAULT_SAUNA_MAX_HEALTH}. */
  maxHealth?: number;
  /** Starting health for the structure. Defaults to the configured max health. */
  health?: number;
  /** Optional tier descriptor to seed sauna spawn speed and aura values. */
  tier?: Pick<SaunaTier, 'spawnSpeedMultiplier' | 'healingAura'> | null;
  /** Override the tier-driven spawn speed if needed for tests. */
  spawnSpeedMultiplier?: number;
  /** Override the default vision radius if needed for tests. */
  visionRange?: number;
  /** Override the default aura radius if needed for tests. */
  auraRadius?: number;
  /** Override the default regeneration rate if needed for tests. */
  regenPerSec?: number;
}

export function createSauna(
  pos: AxialCoord,
  heatConfig?: SaunaHeatInit,
  options: SaunaInitOptions = {}
): Sauna {
  const tracker = createSaunaHeat(heatConfig);
  const heatPerTick = tracker.getBuildRate();
  const cooldown = tracker.getCooldownSeconds();
  const timer = tracker.timeUntilNextTrigger();
  const initialRosterCap = Number.isFinite(options.maxRosterSize)
    ? Math.max(0, Math.floor(options.maxRosterSize ?? 0))
    : 0;
  const resolvedMaxHealth = Number.isFinite(options.maxHealth)
    ? Math.max(1, Math.floor(options.maxHealth ?? DEFAULT_SAUNA_MAX_HEALTH))
    : DEFAULT_SAUNA_MAX_HEALTH;
  const resolvedHealth = Number.isFinite(options.health)
    ? Math.max(0, Math.min(resolvedMaxHealth, Math.floor(options.health ?? resolvedMaxHealth)))
    : resolvedMaxHealth;
  const resolvedSpawnSpeed = sanitizeSpawnSpeedMultiplier(
    typeof options.spawnSpeedMultiplier === 'number'
      ? options.spawnSpeedMultiplier
      : options.tier?.spawnSpeedMultiplier
  );
  const resolvedVisionRange = sanitizeVisionRange(options.visionRange);
  const tierAura = options.tier?.healingAura;
  const resolvedAuraRadius = sanitizeHealingAuraRadius(
    typeof options.auraRadius === 'number' ? options.auraRadius : tierAura?.radius
  );
  const resolvedRegenPerSec = sanitizeHealingAuraRegen(
    typeof options.regenPerSec === 'number' ? options.regenPerSec : tierAura?.regenPerSecond
  );

  return {
    id: 'sauna',
    pos,
    auraRadius: resolvedAuraRadius,
    visionRange: resolvedVisionRange,
    regenPerSec: resolvedRegenPerSec,
    rallyToFront: false,
    maxRosterSize: initialRosterCap,
    maxHealth: resolvedMaxHealth,
    health: resolvedHealth,
    destroyed: resolvedHealth <= 0,
    heat: tracker.getHeat(),
    heatPerTick: heatPerTick * resolvedSpawnSpeed,
    spawnSpeedMultiplier: resolvedSpawnSpeed,
    playerSpawnThreshold: tracker.getThreshold(),
    playerSpawnCooldown: Number.isFinite(cooldown) ? cooldown / resolvedSpawnSpeed : 0,
    playerSpawnTimer: Number.isFinite(timer) ? timer / resolvedSpawnSpeed : 0,
    beerUpkeepAccumulator: 0,
    heatTracker: tracker
  };
}

export interface SaunaDamageResult {
  amount: number;
  remainingHealth: number;
  destroyed: boolean;
}

export function damageSauna(sauna: Sauna, rawAmount: number): SaunaDamageResult {
  if (!Number.isFinite(rawAmount) || rawAmount <= 0 || sauna.destroyed) {
    return { amount: 0, remainingHealth: Math.max(0, sauna.health), destroyed: sauna.destroyed };
  }
  const previousHealth = Math.max(0, sauna.health);
  const damage = Math.min(previousHealth, Math.max(0, Math.floor(rawAmount)));
  const nextHealth = Math.max(0, previousHealth - damage);
  sauna.health = nextHealth;
  if (nextHealth <= 0) {
    sauna.health = 0;
    sauna.destroyed = true;
  }
  return { amount: damage, remainingHealth: sauna.health, destroyed: sauna.destroyed };
}
