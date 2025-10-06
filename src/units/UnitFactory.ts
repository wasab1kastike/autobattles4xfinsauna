import type { AxialCoord } from '../hex/HexUtils.ts';
import { GameState, Resource } from '../core/GameState.ts';
import { Unit } from './Unit.ts';
import { playSafe } from '../audio/sfx.ts';
import { eventBus } from '../events/EventBus.ts';
import { computeUnitStats } from '../unit/calc.ts';
import { normalizeLevel } from '../unit/level.ts';
import { tryGetUnitArchetype } from '../unit/archetypes.ts';
import { resolveUnitAppearance } from '../unit/appearance.ts';
import type {
  UnitArchetypeDefinition,
  UnitArchetypeId,
  UnitBuildOptions
} from '../unit/types.ts';

export type UnitType = UnitArchetypeId;

export interface UnitSpawnOptions extends UnitBuildOptions {
  appearanceId?: string;
  random?: () => number;
  appearanceRandom?: () => number;
}

function resolveAppearanceSampler(options?: UnitSpawnOptions): (() => number) | undefined {
  if (!options) {
    return undefined;
  }
  if (typeof options.appearanceRandom === 'function') {
    return options.appearanceRandom;
  }
  if (typeof options.random === 'function') {
    return options.random;
  }
  return undefined;
}

function instantiateArchetype(
  archetype: UnitArchetypeDefinition,
  id: string,
  coord: AxialCoord,
  faction: string,
  options?: UnitSpawnOptions
): Unit {
  const level = normalizeLevel(options?.level);
  const stats = { ...computeUnitStats(archetype, level) };
  const appearanceSampler = resolveAppearanceSampler(options);
  const appearance = resolveUnitAppearance(
    archetype.id,
    options?.appearanceId,
    appearanceSampler
  );
  return new Unit(
    id,
    archetype.id,
    coord,
    faction,
    stats,
    archetype.priorityFactions,
    options?.behavior,
    appearance
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

