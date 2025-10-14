import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import type { TileMutation } from '../hex/HexTile.ts';
import type { UnitArchetypeId } from '../unit/types.ts';
import {
  getStrongholdEncounterSnapshot,
  mergeStrongholdEncounterPersistence,
  resetStrongholdEncounters,
  seedStrongholdEncounter,
  spawnStrongholdBoss,
  type StrongholdEncounterHooks
} from './strongholdEncounters.ts';

export interface StrongholdBossDefinition {
  readonly unit: UnitArchetypeId;
  readonly level: number;
  readonly faction: string;
  readonly appearanceId?: string;
  readonly lootRolls?: number;
  readonly eliteLoot?: boolean;
}

export interface StrongholdDefinition {
  readonly id: string;
  readonly label: string;
  readonly coord: AxialCoord;
  readonly guardTier: string;
  readonly lootTableId: string;
  readonly boss: StrongholdBossDefinition;
}

export interface StrongholdConfig {
  readonly strongholds: readonly StrongholdDefinition[];
}

export interface StrongholdBossPersistence {
  readonly spawned?: boolean;
  readonly defeated?: boolean;
  readonly loot?: readonly string[];
}

export interface StrongholdPersistenceEntry {
  readonly captured?: boolean;
  readonly seen?: boolean;
  readonly boss?: StrongholdBossPersistence;
}

export type StrongholdPersistence = Record<string, StrongholdPersistenceEntry>;

export interface StrongholdMetadata extends StrongholdDefinition {
  captured: boolean;
  seen: boolean;
}

export interface StrongholdSeedOptions {
  readonly encounters?: StrongholdEncounterHooks;
}

const registry = new Map<string, StrongholdMetadata>();

export const STRONGHOLD_CONFIG: StrongholdConfig = Object.freeze({
  strongholds: Object.freeze([
    Object.freeze({
      id: 'aurora-watch',
      label: 'Aurora Watch',
      coord: Object.freeze({ q: 2, r: 2 }),
      guardTier: 'raider-scouts',
      lootTableId: 'enemy-raiders',
      boss: Object.freeze({
        unit: 'aurora-warden',
        level: 6,
        faction: 'enemy',
        lootRolls: 3
      })
    }),
    Object.freeze({
      id: 'glacier-bastion',
      label: 'Glacier Bastion',
      coord: Object.freeze({ q: 7, r: 3 }),
      guardTier: 'icebreaker-vanguard',
      lootTableId: 'enemy-champions',
      boss: Object.freeze({
        unit: 'glacier-sentinel',
        level: 7,
        faction: 'enemy',
        lootRolls: 4,
        eliteLoot: true
      })
    }),
    Object.freeze({
      id: 'spirit-thicket',
      label: 'Spirit Thicket',
      coord: Object.freeze({ q: 4, r: 7 }),
      guardTier: 'deepwood-wardens',
      lootTableId: 'deepwood-offerings',
      boss: Object.freeze({
        unit: 'spirit-keeper',
        level: 7,
        faction: 'enemy',
        lootRolls: 3,
        eliteLoot: true
      })
    }),
    Object.freeze({
      id: 'ember-sanctum',
      label: 'Ember Sanctum',
      coord: Object.freeze({ q: 8, r: 6 }),
      guardTier: 'forgeborn-legion',
      lootTableId: 'enemy-raiders',
      boss: Object.freeze({
        unit: 'ember-highlord',
        level: 8,
        faction: 'enemy',
        lootRolls: 4
      })
    })
  ])
});

function trackTileCapture(metadata: StrongholdMetadata, map: HexMap): void {
  const tile = map.getTile(metadata.coord.q, metadata.coord.r);
  if (!tile) {
    return;
  }
  tile.addMutationListener((mutation: TileMutation) => {
    if (mutation === 'building') {
      const wasCaptured = metadata.captured;
      metadata.captured = tile.building !== 'city';
      if (metadata.captured) {
        metadata.seen = true;
        if (!wasCaptured) {
          spawnStrongholdBoss(metadata.id);
        }
      }
      return;
    }
    if (mutation === 'fog' && !tile.isFogged) {
      metadata.seen = true;
    }
  });
}

export function resetStrongholdRegistry(): void {
  registry.clear();
  resetStrongholdEncounters();
}

export function seedEnemyStrongholds(
  map: HexMap,
  config: StrongholdConfig,
  persisted?: StrongholdPersistence | null,
  options?: StrongholdSeedOptions
): void {
  registry.clear();
  resetStrongholdEncounters();
  for (const spec of config.strongholds) {
    const tile = map.ensureTile(spec.coord.q, spec.coord.r);
    const persistedEntry = persisted?.[spec.id];
    const captured = Boolean(persistedEntry?.captured);
    const previouslySeen = Boolean(persistedEntry?.seen);
    if (captured) {
      tile.placeBuilding(null);
    } else {
      tile.placeBuilding('city');
      if (previouslySeen) {
        tile.setFogged(false);
      } else {
        tile.setFogged(true);
      }
    }
    const metadata: StrongholdMetadata = {
      ...spec,
      captured,
      seen: captured || previouslySeen || !tile.isFogged
    };
    registry.set(spec.id, metadata);
    trackTileCapture(metadata, map);
    seedStrongholdEncounter(map, metadata, options?.encounters, persistedEntry ?? null);
  }
}

export function mergeStrongholdPersistence(
  map: HexMap | null,
  persistence?: StrongholdPersistence
): void {
  if (registry.size === 0) {
    return;
  }
  const snapshot = persistence ?? {};
  for (const metadata of registry.values()) {
    const persistedEntry = snapshot[metadata.id];
    const captured = Boolean(persistedEntry?.captured);
    const previouslySeen = Boolean(persistedEntry?.seen);
    metadata.captured = captured;
    metadata.seen = metadata.seen || captured || previouslySeen;
    if (map) {
      const tile = map.ensureTile(metadata.coord.q, metadata.coord.r);
      tile.placeBuilding(captured ? null : 'city');
      if (!captured) {
        if (previouslySeen) {
          tile.setFogged(false);
        } else {
          tile.setFogged(true);
        }
      }
    }
  }
  mergeStrongholdEncounterPersistence(snapshot);
}

export function listStrongholds(): readonly StrongholdMetadata[] {
  return Array.from(registry.values());
}

export function getStrongholdSnapshot(): StrongholdPersistence {
  const snapshot: StrongholdPersistence = {};
  const encounterSnapshot = getStrongholdEncounterSnapshot();
  for (const metadata of registry.values()) {
    const encounter = encounterSnapshot[metadata.id];
    snapshot[metadata.id] = {
      captured: metadata.captured,
      seen: metadata.seen,
      ...(encounter ? { boss: encounter } : {})
    };
  }
  return snapshot;
}
