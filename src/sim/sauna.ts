import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';
import { createSaunaHeat, type SaunaHeat, type SaunaHeatInit } from '../sauna/heat.ts';

export interface SaunaUpkeepSegment {
  amount: number;
  duration: number;
}

export interface SaunaUpkeepTracker {
  elapsed: number;
  segments: SaunaUpkeepSegment[];
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
  regenPerSec: number;
  rallyToFront: boolean;
  heat: number;
  heatPerTick: number;
  playerSpawnThreshold: number;
  playerSpawnCooldown: number;
  playerSpawnTimer: number;
  heatTracker: SaunaHeat;
  beerUpkeep: SaunaUpkeepTracker;
}

export function createSauna(pos: AxialCoord, heatConfig?: SaunaHeatInit): Sauna {
  const tracker = createSaunaHeat(heatConfig);
  const heatPerTick = tracker.getBuildRate();
  const cooldown = tracker.getCooldownSeconds();
  const timer = tracker.timeUntilNextTrigger();

  return {
    id: 'sauna',
    pos,
    auraRadius: 2,
    regenPerSec: 1,
    rallyToFront: false,
    heat: tracker.getHeat(),
    heatPerTick,
    playerSpawnThreshold: tracker.getThreshold(),
    playerSpawnCooldown: Number.isFinite(cooldown) ? cooldown : 0,
    playerSpawnTimer: Number.isFinite(timer) ? timer : 0,
    heatTracker: tracker,
    beerUpkeep: {
      elapsed: 0,
      segments: []
    }
  };
}
