import { Unit } from './Unit.ts';
import type { UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

export const AVANTO_MARAUDER_STATS: UnitStats = {
  health: 12,
  attackDamage: 4,
  attackRange: 1,
  movementRange: 2
};

export class AvantoMarauder extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string) {
    super(id, coord, faction, { ...AVANTO_MARAUDER_STATS });
  }
}

