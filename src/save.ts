import type { HexMap } from './hexmap.ts';
import type { GameState, Resource } from './core/GameState.ts';
import type { Unit } from './unit.ts';
import type { Sauna } from './sim/sauna.ts';
import type { AxialCoord } from './hex/HexUtils.ts';
import type { UnitStats } from './units/Unit.ts';

export interface UnitData {
  id: string;
  type: string;
  coord: AxialCoord;
  faction: string;
  stats: UnitStats;
}

export interface SaveData {
  version: 1;
  time: number;
  revealed: string[];
  resources: Record<Resource, number>;
  buildings: Record<string, string>;
  policies: string[];
  units: UnitData[];
  sauna: Omit<Sauna, 'update' | 'id'> & { id: 'sauna' };
}

const DEFAULT_SAVE: SaveData = {
  version: 1,
  time: 0,
  revealed: [],
  resources: {} as Record<Resource, number>,
  buildings: {},
  policies: [],
  units: [],
  sauna: {
    id: 'sauna',
    pos: { q: 0, r: 0 },
    spawnCooldown: 30,
    timer: 30,
    auraRadius: 2,
    regenPerSec: 1,
    rallyToFront: false
  }
};

export function serialize(
  state: GameState,
  map: HexMap,
  units: Unit[],
  sauna: Sauna
): SaveData {
  const revealed: string[] = [];
  map.forEachTile((tile, coord) => {
    if (!tile.isFogged) revealed.push(`${coord.q},${coord.r}`);
  });

  const buildings: Record<string, string> = {};
  map.forEachTile((tile, coord) => {
    if (tile.building) buildings[`${coord.q},${coord.r}`] = tile.building;
  });

  const unitData: UnitData[] = units.map((u) => ({
    id: u.id,
    type: (u.constructor as any).name,
    coord: u.coord,
    faction: u.faction,
    stats: { ...u.stats }
  }));

  return {
    version: 1,
    time: state.time,
    revealed,
    resources: { ...state.resources },
    buildings,
    policies: state.getPolicies(),
    units: unitData,
    sauna: {
      id: 'sauna',
      pos: { ...sauna.pos },
      spawnCooldown: sauna.spawnCooldown,
      timer: sauna.timer,
      auraRadius: sauna.auraRadius,
      regenPerSec: sauna.regenPerSec,
      rallyToFront: sauna.rallyToFront
    }
  };
}

export function deserialize(raw: any): SaveData {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) {
    return { ...DEFAULT_SAVE };
  }
  const data = raw as Partial<SaveData>;
  return {
    version: 1,
    time: typeof data.time === 'number' ? data.time : DEFAULT_SAVE.time,
    revealed: Array.isArray(data.revealed) ? data.revealed : [],
    resources: {
      ...DEFAULT_SAVE.resources,
      ...(data.resources as Record<Resource, number> | undefined)
    },
    buildings: { ...(data.buildings ?? {}) },
    policies: Array.isArray(data.policies) ? data.policies : [],
    units: Array.isArray(data.units)
      ? data.units.map((u: any) => ({
          id: String(u.id ?? ''),
          type: String(u.type ?? ''),
          coord: { q: Number(u.coord?.q ?? 0), r: Number(u.coord?.r ?? 0) },
          faction: String(u.faction ?? 'player'),
          stats: {
            health: Number(u.stats?.health ?? 0),
            attackDamage: Number(u.stats?.attackDamage ?? 0),
            attackRange: Number(u.stats?.attackRange ?? 0),
            movementRange: Number(u.stats?.movementRange ?? 0)
          }
        }))
      : [],
    sauna: {
      id: 'sauna',
      pos: {
        q: Number(data.sauna?.pos?.q ?? 0),
        r: Number(data.sauna?.pos?.r ?? 0)
      },
      spawnCooldown:
        typeof data.sauna?.spawnCooldown === 'number'
          ? data.sauna.spawnCooldown
          : DEFAULT_SAVE.sauna.spawnCooldown,
      timer:
        typeof data.sauna?.timer === 'number'
          ? data.sauna.timer
          : DEFAULT_SAVE.sauna.timer,
      auraRadius:
        typeof data.sauna?.auraRadius === 'number'
          ? data.sauna.auraRadius
          : DEFAULT_SAVE.sauna.auraRadius,
      regenPerSec:
        typeof data.sauna?.regenPerSec === 'number'
          ? data.sauna.regenPerSec
          : DEFAULT_SAVE.sauna.regenPerSec,
      rallyToFront: Boolean(
        (data.sauna as any)?.rallyToFront ?? DEFAULT_SAVE.sauna.rallyToFront
      )
    }
  };
}
