import type { AxialCoord } from '../hex/HexUtils.ts';
import { Unit } from './Unit.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { SOLDIER_ARCHETYPE } from '../unit/archetypes.ts';
import type { UnitBuildOptions, UnitStats } from '../unit/types.ts';

export const SOLDIER_COST = SOLDIER_ARCHETYPE.cost;

export const SOLDIER_STATS: UnitStats = Object.freeze(
  computeUnitStats(SOLDIER_ARCHETYPE, 1)
) as UnitStats;

export interface SoldierOptions extends UnitBuildOptions {}

export function createSoldier(
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: SoldierOptions
): Unit {
  const stats = computeUnitStats(SOLDIER_ARCHETYPE, options?.level);
  return new Unit(id, SOLDIER_ARCHETYPE.id, coord, faction, stats, SOLDIER_ARCHETYPE.priorityFactions);
}

export function getSoldierStats(level?: number): UnitStats {
  return computeUnitStats(SOLDIER_ARCHETYPE, level);
}

export class Soldier extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string, options?: SoldierOptions) {
    const stats = computeUnitStats(SOLDIER_ARCHETYPE, options?.level);
    super(id, SOLDIER_ARCHETYPE.id, coord, faction, stats, SOLDIER_ARCHETYPE.priorityFactions);
  }
}

