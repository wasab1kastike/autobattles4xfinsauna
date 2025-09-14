import { Unit, UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

export const SOLDIER_STATS: UnitStats = {
  health: 20,
  attackDamage: 5,
  attackRange: 1,
  movementRange: 2
};

export const SOLDIER_COST = 50;

export class Soldier extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string) {
    super(id, coord, faction, { ...SOLDIER_STATS });
  }
}

