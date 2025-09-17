import { Unit } from './Unit.ts';
import type { UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

export const ARCHER_STATS: UnitStats = {
  health: 15,
  attackDamage: 3,
  attackRange: 3,
  movementRange: 2
};

export const ARCHER_COST = 75;

export class Archer extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string) {
    super(id, 'archer', coord, faction, { ...ARCHER_STATS });
  }
}

