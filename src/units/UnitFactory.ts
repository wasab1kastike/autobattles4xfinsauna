import type { AxialCoord } from '../hex/HexUtils.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { Unit } from './Unit.ts';
import { Soldier, SOLDIER_COST } from './Soldier.ts';
import { Archer, ARCHER_COST } from './Archer.ts';

export type UnitType = 'soldier' | 'archer';

const UNIT_COST: Record<UnitType, number> = {
  soldier: SOLDIER_COST,
  archer: ARCHER_COST
};

export function spawnUnit(
  state: GameState,
  type: UnitType,
  id: string,
  coord: AxialCoord,
  faction: string
): Unit | null {
  const cost = UNIT_COST[type];
  if (!state.canAfford(cost, Resource.GOLD)) {
    return null;
  }
  state.addResource(Resource.GOLD, -cost);
  switch (type) {
    case 'soldier':
      return new Soldier(id, coord, faction);
    case 'archer':
      return new Archer(id, coord, faction);
    default:
      return null;
  }
}

