import { Unit, UnitStats } from './Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

export const RAIDER_STATS: UnitStats = {
  health: 12,
  attackDamage: 4,
  attackRange: 1,
  movementRange: 2
};

export class Raider extends Unit {
  constructor(id: string, coord: AxialCoord, faction: string) {
    super(id, coord, faction, { ...RAIDER_STATS });
  }
}

