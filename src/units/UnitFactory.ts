import type { AxialCoord } from '../hex/HexUtils.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { Unit } from './Unit.ts';
import { Soldier, SOLDIER_COST } from './Soldier.ts';
import { Archer, ARCHER_COST } from './Archer.ts';
import { playSafe } from '../sfx.ts';
import { eventBus } from '../events/EventBus.ts';

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
  if (!state.canAfford(cost, Resource.SAUNA_BEER)) {
    playSafe('error');
    return null;
  }
  state.addResource(Resource.SAUNA_BEER, -cost);
  let unit: Unit | null = null;
  switch (type) {
    case 'soldier':
      unit = new Soldier(id, coord, faction);
      break;
    case 'archer':
      unit = new Archer(id, coord, faction);
      break;
    default:
      unit = null;
  }
  if (unit) {
    playSafe('spawn');
    eventBus.emit('unitSpawned', { unit });
  }
  return unit;
}

