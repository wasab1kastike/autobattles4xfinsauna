import { hexDistance, type AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import type { TileMutation } from '../hex/HexTile.ts';
import type { UnitArchetypeId } from '../unit/types.ts';
import { createUnit } from '../units/UnitFactory.ts';
import type { Unit } from '../units/Unit.ts';
import { eventBus } from '../events/EventBus.ts';
import type { UnitDamagedPayload, UnitDiedPayload } from '../events/types.ts';
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

export type StrongholdStructureTier = 'outpost' | 'bastion' | 'citadel' | 'sanctum';

export interface StrongholdDefinition {
  readonly id: string;
  readonly label: string;
  readonly coord: AxialCoord;
  readonly guardTier: string;
  readonly lootTableId: string;
  readonly boss: StrongholdBossDefinition;
  readonly structureTier: StrongholdStructureTier;
  readonly structureMaxHealth?: number;
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
  readonly structureHealth?: number;
  readonly structureMaxHealth?: number;
  readonly structureDestroyed?: boolean;
  readonly boss?: StrongholdBossPersistence;
}

export type StrongholdPersistence = Record<string, StrongholdPersistenceEntry>;

export interface StrongholdMetadata extends StrongholdDefinition {
  captured: boolean;
  seen: boolean;
  structureHealth: number;
  structureMaxHealth: number;
  structureUnitId: string | null;
}

export interface StrongholdSeedOptions {
  readonly encounters?: StrongholdEncounterHooks;
  readonly registerUnit?: (unit: Unit) => void;
}

const STRONGHOLD_STRUCTURE_HEALTH: Record<StrongholdStructureTier, number> = Object.freeze({
  outpost: 240,
  bastion: 320,
  citadel: 380,
  sanctum: 440
});

function resolveStructureMaxHealth(spec: StrongholdDefinition): number {
  const base = STRONGHOLD_STRUCTURE_HEALTH[spec.structureTier] ?? STRONGHOLD_STRUCTURE_HEALTH.bastion;
  const override = Number(spec.structureMaxHealth);
  const chosen = Number.isFinite(override) && override > 0 ? (override as number) : base;
  return Math.max(1, Math.round(chosen));
}

function normalizeStructureMaxHealth(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return Math.max(1, Math.round(numeric));
  }
  return fallback;
}

function normalizeStructureHealth(value: unknown, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return max;
  }
  if (numeric <= 0) {
    return 0;
  }
  if (numeric >= max) {
    return max;
  }
  return numeric;
}

const registry = new Map<string, StrongholdMetadata>();
const structureUnits = new Map<string, Unit>();
const structureListeners = new Map<
  string,
  { damage: (payload: UnitDamagedPayload) => void; death: (payload: UnitDiedPayload) => void }
>();

function detachStructureListeners(strongholdId: string): void {
  const listeners = structureListeners.get(strongholdId);
  if (!listeners) {
    return;
  }
  eventBus.off<UnitDamagedPayload>('unitDamaged', listeners.damage);
  eventBus.off<UnitDiedPayload>('unitDied', listeners.death);
  structureListeners.delete(strongholdId);
}

function attachStructureListeners(
  metadata: StrongholdMetadata,
  unit: Unit,
  map: HexMap
): void {
  detachStructureListeners(metadata.id);
  let destroyed = false;
  const finalize = () => {
    if (destroyed) {
      return;
    }
    destroyed = true;
    detachStructureListeners(metadata.id);
    structureUnits.delete(metadata.id);
    metadata.structureHealth = 0;
    metadata.structureUnitId = null;
    metadata.seen = true;
    const tile = map.getTile(metadata.coord.q, metadata.coord.r);
    if (tile) {
      tile.placeBuilding(null);
      tile.setFogged(false);
    }
  };

  const onDamaged = (payload: UnitDamagedPayload) => {
    if (payload.targetId !== unit.id) {
      return;
    }
    const remaining = Number(payload.remainingHealth);
    if (!Number.isFinite(remaining)) {
      return;
    }
    metadata.structureHealth = Math.max(0, Math.min(metadata.structureMaxHealth, remaining));
  };

  const onDeath = (payload: UnitDiedPayload) => {
    if (payload.unitId === unit.id) {
      finalize();
    }
  };

  structureListeners.set(metadata.id, { damage: onDamaged, death: onDeath });
  eventBus.on<UnitDamagedPayload>('unitDamaged', onDamaged);
  eventBus.on<UnitDiedPayload>('unitDied', onDeath);
  unit.onDeath(finalize);
}

export const STRONGHOLD_CONFIG: StrongholdConfig = Object.freeze({
  strongholds: Object.freeze([
    Object.freeze({
      id: 'aurora-watch',
      label: 'Aurora Watch',
      coord: Object.freeze({ q: 1, r: 1 }),
      guardTier: 'raider-scouts',
      lootTableId: 'enemy-raiders',
      structureTier: 'outpost',
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
      coord: Object.freeze({ q: 4, r: 0 }),
      guardTier: 'icebreaker-vanguard',
      lootTableId: 'enemy-champions',
      structureTier: 'bastion',
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
      coord: Object.freeze({ q: 8, r: 8 }),
      guardTier: 'deepwood-wardens',
      lootTableId: 'deepwood-offerings',
      structureTier: 'citadel',
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
      coord: Object.freeze({ q: 9, r: 9 }),
      guardTier: 'forgeborn-legion',
      lootTableId: 'enemy-raiders',
      structureTier: 'sanctum',
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
        metadata.structureHealth = 0;
        metadata.structureUnitId = null;
        detachStructureListeners(metadata.id);
        structureUnits.delete(metadata.id);
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
  for (const strongholdId of Array.from(structureListeners.keys())) {
    detachStructureListeners(strongholdId);
  }
  structureUnits.clear();
  registry.clear();
  resetStrongholdEncounters();
}

export function seedEnemyStrongholds(
  map: HexMap,
  config: StrongholdConfig,
  persisted?: StrongholdPersistence | null,
  options?: StrongholdSeedOptions
): void {
  for (const strongholdId of Array.from(structureListeners.keys())) {
    detachStructureListeners(strongholdId);
  }
  structureUnits.clear();
  registry.clear();
  resetStrongholdEncounters();
  const registerUnit = options?.registerUnit ?? options?.encounters?.registerUnit;
  const encounterHooks: StrongholdEncounterHooks | undefined = options?.encounters
    ? { ...options.encounters }
    : undefined;
  if (registerUnit && encounterHooks && !encounterHooks.registerUnit) {
    encounterHooks.registerUnit = registerUnit;
  }
  const seededStrongholds: StrongholdMetadata[] = [];
  let hasVisibleStronghold = false;

  for (const spec of config.strongholds) {
    const tile = map.ensureTile(spec.coord.q, spec.coord.r);
    const persistedEntry = persisted?.[spec.id];
    const baseMaxHealth = resolveStructureMaxHealth(spec);
    const persistedMaxHealth = normalizeStructureMaxHealth(
      persistedEntry?.structureMaxHealth,
      baseMaxHealth
    );
    const structureWasDestroyed = Boolean(
      persistedEntry?.structureDestroyed ||
        (typeof persistedEntry?.structureHealth === 'number' &&
          Number.isFinite(persistedEntry?.structureHealth) &&
          (persistedEntry?.structureHealth as number) <= 0)
    );
    const captured = Boolean(persistedEntry?.captured || structureWasDestroyed);
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
    const structureHealth = captured
      ? 0
      : normalizeStructureHealth(persistedEntry?.structureHealth, persistedMaxHealth);
    const metadata: StrongholdMetadata = {
      ...spec,
      captured,
      seen: captured || previouslySeen || !tile.isFogged,
      structureHealth,
      structureMaxHealth: persistedMaxHealth,
      structureUnitId: null
    };
    registry.set(spec.id, metadata);
    seededStrongholds.push(metadata);
    if (!metadata.captured && metadata.seen) {
      hasVisibleStronghold = true;
    }
    if (!captured) {
      const structureUnit = createUnit(
        'stronghold-structure',
        `stronghold-${spec.id}-structure`,
        spec.coord,
        'enemy',
        { behavior: 'defend' }
      );
      if (structureUnit) {
        structureUnit.updateStats({
          ...structureUnit.stats,
          health: metadata.structureMaxHealth
        });
        structureUnit.stats.health = metadata.structureHealth;
        metadata.structureHealth = structureUnit.stats.health;
        metadata.structureUnitId = structureUnit.id;
        structureUnits.set(spec.id, structureUnit);
        attachStructureListeners(metadata, structureUnit, map);
        registerUnit?.(structureUnit);
      }
    } else {
      detachStructureListeners(spec.id);
      structureUnits.delete(spec.id);
      metadata.structureHealth = 0;
      metadata.structureUnitId = null;
    }
    trackTileCapture(metadata, map);
    seedStrongholdEncounter(map, metadata, encounterHooks, persistedEntry ?? null);
  }

  if (!hasVisibleStronghold) {
    const center: AxialCoord = {
      q: Math.floor((map.minQ + map.maxQ) / 2),
      r: Math.floor((map.minR + map.maxR) / 2)
    };
    let chosen: StrongholdMetadata | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const metadata of seededStrongholds) {
      if (metadata.captured) {
        continue;
      }
      const distance = hexDistance(center, metadata.coord);
      if (!Number.isFinite(distance)) {
        continue;
      }
      if (!chosen || distance < bestDistance) {
        chosen = metadata;
        bestDistance = distance;
      }
    }
    if (chosen) {
      const tile = map.ensureTile(chosen.coord.q, chosen.coord.r);
      tile.reveal();
      chosen.seen = true;
    }
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
    const structureDestroyed = Boolean(
      persistedEntry?.structureDestroyed ||
        (typeof persistedEntry?.structureHealth === 'number' &&
          Number.isFinite(persistedEntry?.structureHealth) &&
          (persistedEntry?.structureHealth as number) <= 0)
    );
    const captured = Boolean(metadata.captured || persistedEntry?.captured || structureDestroyed);
    const previouslySeen = Boolean(persistedEntry?.seen);
    metadata.captured = captured;
    metadata.seen = metadata.seen || captured || previouslySeen;
    metadata.structureMaxHealth = normalizeStructureMaxHealth(
      persistedEntry?.structureMaxHealth,
      metadata.structureMaxHealth
    );
    if (captured) {
      metadata.structureHealth = 0;
      metadata.structureUnitId = null;
      detachStructureListeners(metadata.id);
      structureUnits.delete(metadata.id);
    } else if (typeof persistedEntry?.structureHealth === 'number') {
      metadata.structureHealth = normalizeStructureHealth(
        persistedEntry.structureHealth,
        metadata.structureMaxHealth
      );
      const structureUnit = structureUnits.get(metadata.id);
      if (structureUnit) {
        structureUnit.updateStats({
          ...structureUnit.stats,
          health: metadata.structureMaxHealth
        });
        structureUnit.stats.health = metadata.structureHealth;
        metadata.structureUnitId = structureUnit.id;
      }
    }
    if (map) {
      const tile = map.ensureTile(metadata.coord.q, metadata.coord.r);
      tile.placeBuilding(captured ? null : 'city');
      if (!captured) {
        if (previouslySeen) {
          tile.setFogged(false);
        } else {
          tile.setFogged(true);
        }
      } else {
        tile.setFogged(false);
      }
    }
    if (!captured) {
      const activeUnit = structureUnits.get(metadata.id);
      if (activeUnit) {
        metadata.structureUnitId = activeUnit.id;
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
    const destroyed = metadata.captured || metadata.structureHealth <= 0;
    snapshot[metadata.id] = {
      captured: metadata.captured,
      seen: metadata.seen,
      structureHealth: metadata.structureHealth,
      structureMaxHealth: metadata.structureMaxHealth,
      ...(destroyed ? { structureDestroyed: true } : {}),
      ...(encounter ? { boss: encounter } : {})
    };
  }
  return snapshot;
}
