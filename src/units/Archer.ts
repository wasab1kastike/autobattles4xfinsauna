import type { AxialCoord } from '../hex/HexUtils.ts';
import { Unit } from './Unit.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { ARCHER_ARCHETYPE } from '../unit/archetypes.ts';
import type { UnitBuildOptions, UnitStats } from '../unit/types.ts';

export const ARCHER_COST = ARCHER_ARCHETYPE.cost;

export const ARCHER_STATS: UnitStats = Object.freeze(
  computeUnitStats(ARCHER_ARCHETYPE, 1)
) as UnitStats;

export interface ArcherOptions extends UnitBuildOptions {}

export function createArcher(
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: ArcherOptions
): Unit {
  const stats = computeUnitStats(ARCHER_ARCHETYPE, options?.level);
  return new Unit(id, ARCHER_ARCHETYPE.id, coord, faction, stats, ARCHER_ARCHETYPE.priorityFactions);
}

export function getArcherStats(level?: number): UnitStats {
  return computeUnitStats(ARCHER_ARCHETYPE, level);
}

export class Archer extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string, options?: ArcherOptions) {
    const stats = computeUnitStats(ARCHER_ARCHETYPE, options?.level);
    super(id, ARCHER_ARCHETYPE.id, coord, faction, stats, ARCHER_ARCHETYPE.priorityFactions);
  }
}

