import type { AxialCoord } from '../hex/HexUtils.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { Unit } from './Unit.ts';
import { playSafe } from '../audio/sfx.ts';
import { eventBus } from '../events/EventBus.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { normalizeLevel } from '../unit/level.ts';
import { tryGetUnitArchetype } from '../unit/archetypes.ts';
import type {
  UnitArchetypeDefinition,
  UnitArchetypeId,
  UnitBuildOptions
} from '../unit/types.ts';

export type UnitType = UnitArchetypeId;

export interface UnitSpawnOptions extends UnitBuildOptions {}

function instantiateArchetype(
  archetype: UnitArchetypeDefinition,
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: UnitSpawnOptions
): Unit {
  const level = normalizeLevel(options?.level);
  const stats = computeUnitStats(archetype, level);
  return new Unit(
    id,
    archetype.id,
    coord,
    faction,
    stats,
    archetype.priorityFactions,
    options?.behavior
  );
}

export function createUnit(
  type: UnitType,
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: UnitSpawnOptions
): Unit | null {
  const archetype = tryGetUnitArchetype(type);
  if (!archetype) {
    return null;
  }
  return instantiateArchetype(archetype, id, coord, faction, options);
}

export function spawnUnit(
  state: GameState,
  type: UnitType,
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: UnitSpawnOptions
): Unit | null {
  const archetype = tryGetUnitArchetype(type);
  if (!archetype) {
    return null;
  }

  const cost = archetype.cost;
  if (!state.canAfford(cost, Resource.SAUNA_BEER)) {
    playSafe('error');
    return null;
  }

  state.addResource(Resource.SAUNA_BEER, -cost);
  const unit = instantiateArchetype(archetype, id, coord, faction, options);
  playSafe('spawn');
  eventBus.emit('unitSpawned', { unit });
  return unit;
}

