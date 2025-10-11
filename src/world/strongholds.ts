import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import type { TileMutation } from '../hex/HexTile.ts';

export interface StrongholdDefinition {
  readonly id: string;
  readonly label: string;
  readonly coord: AxialCoord;
  readonly guardTier: string;
  readonly lootTableId: string;
}

export interface StrongholdConfig {
  readonly strongholds: readonly StrongholdDefinition[];
}

export interface StrongholdPersistenceEntry {
  readonly captured?: boolean;
}

export type StrongholdPersistence = Record<string, StrongholdPersistenceEntry>;

export interface StrongholdMetadata extends StrongholdDefinition {
  captured: boolean;
}

const registry = new Map<string, StrongholdMetadata>();

export const STRONGHOLD_CONFIG: StrongholdConfig = Object.freeze({
  strongholds: Object.freeze([
    Object.freeze({
      id: 'aurora-watch',
      label: 'Aurora Watch',
      coord: Object.freeze({ q: 2, r: 2 }),
      guardTier: 'raider-scouts',
      lootTableId: 'enemy-raiders'
    }),
    Object.freeze({
      id: 'glacier-bastion',
      label: 'Glacier Bastion',
      coord: Object.freeze({ q: 7, r: 3 }),
      guardTier: 'icebreaker-vanguard',
      lootTableId: 'enemy-champions'
    }),
    Object.freeze({
      id: 'spirit-thicket',
      label: 'Spirit Thicket',
      coord: Object.freeze({ q: 4, r: 7 }),
      guardTier: 'deepwood-wardens',
      lootTableId: 'deepwood-offerings'
    }),
    Object.freeze({
      id: 'ember-sanctum',
      label: 'Ember Sanctum',
      coord: Object.freeze({ q: 8, r: 6 }),
      guardTier: 'forgeborn-legion',
      lootTableId: 'enemy-raiders'
    })
  ])
});

function trackTileCapture(metadata: StrongholdMetadata, map: HexMap): void {
  const tile = map.getTile(metadata.coord.q, metadata.coord.r);
  if (!tile) {
    return;
  }
  tile.addMutationListener((mutation: TileMutation) => {
    if (mutation !== 'building') {
      return;
    }
    metadata.captured = tile.building !== 'city';
  });
}

export function resetStrongholdRegistry(): void {
  registry.clear();
}

export function seedEnemyStrongholds(
  map: HexMap,
  config: StrongholdConfig,
  persisted?: StrongholdPersistence | null
): void {
  registry.clear();
  for (const spec of config.strongholds) {
    const tile = map.ensureTile(spec.coord.q, spec.coord.r);
    const persistedEntry = persisted?.[spec.id];
    const captured = Boolean(persistedEntry?.captured);
    if (captured) {
      tile.placeBuilding(null);
    } else {
      tile.placeBuilding('city');
    }
    const metadata: StrongholdMetadata = {
      ...spec,
      captured
    };
    registry.set(spec.id, metadata);
    trackTileCapture(metadata, map);
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
    metadata.captured = captured;
    if (map) {
      const tile = map.ensureTile(metadata.coord.q, metadata.coord.r);
      tile.placeBuilding(captured ? null : 'city');
    }
  }
}

export function listStrongholds(): readonly StrongholdMetadata[] {
  return Array.from(registry.values());
}

export function getStrongholdSnapshot(): StrongholdPersistence {
  const snapshot: StrongholdPersistence = {};
  for (const metadata of registry.values()) {
    snapshot[metadata.id] = { captured: metadata.captured };
  }
  return snapshot;
}
