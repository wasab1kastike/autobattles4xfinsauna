import type { AxialCoord } from '../hex/HexUtils.ts';
import { Unit } from './Unit.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { AVANTO_MARAUDER_ARCHETYPE } from '../unit/archetypes.ts';
import type { UnitBuildOptions, UnitStats } from '../unit/types.ts';

export const AVANTO_MARAUDER_STATS: UnitStats = Object.freeze(
  computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, 1)
) as UnitStats;

export interface AvantoMarauderOptions extends UnitBuildOptions {}

export function createAvantoMarauder(
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: AvantoMarauderOptions
): Unit {
  const stats = computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, options?.level);
  return new Unit(
    id,
    AVANTO_MARAUDER_ARCHETYPE.id,
    coord,
    faction,
    stats,
    AVANTO_MARAUDER_ARCHETYPE.priorityFactions,
    options?.behavior
  );
}

export function getAvantoMarauderStats(level?: number): UnitStats {
  return computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, level);
}

export class AvantoMarauder extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string, options?: AvantoMarauderOptions) {
    const stats = computeUnitStats(AVANTO_MARAUDER_ARCHETYPE, options?.level);
    super(
      id,
      AVANTO_MARAUDER_ARCHETYPE.id,
      coord,
      faction,
      stats,
      AVANTO_MARAUDER_ARCHETYPE.priorityFactions,
      options?.behavior
    );
  }
}

