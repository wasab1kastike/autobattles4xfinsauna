import { eventBus } from '../events/EventBus.ts';
import type { HexMap } from '../hexmap.ts';
import { rollLoot } from '../loot/roll.ts';
import { getLootTableById, type LootTable } from '../loot/tables.ts';
import { createUnit } from '../units/UnitFactory.ts';
import type { Unit } from '../units/Unit.ts';
import type {
  StrongholdBossPersistence,
  StrongholdMetadata,
  StrongholdPersistence,
  StrongholdPersistenceEntry
} from './strongholds.ts';

export interface StrongholdEncounterHooks {
  readonly registerUnit?: (unit: Unit) => void;
  readonly random?: () => number;
}

interface EncounterState {
  readonly metadata: StrongholdMetadata;
  readonly map: HexMap;
  readonly lootTable: LootTable | null;
  readonly lootRolls: number;
  readonly eliteLoot: boolean;
  readonly random: () => number;
  bossUnitId: string | null;
  defeated: boolean;
  loot: readonly string[];
}

const DEFAULT_LOOT_ROLLS = 3;
const encounters = new Map<string, EncounterState>();
const activeUnits = new Map<string, (payload: { unitId: string }) => void>();

function sanitizeRolls(requested?: number): number {
  if (!Number.isFinite(requested)) {
    return DEFAULT_LOOT_ROLLS;
  }
  const rounded = Math.floor(requested as number);
  if (rounded <= 0) {
    return DEFAULT_LOOT_ROLLS;
  }
  return Math.min(6, rounded);
}

function finalizeEncounter(state: EncounterState): void {
  if (state.defeated) {
    return;
  }
  state.defeated = true;
  state.bossUnitId = null;
  const tile = state.map.getTile(state.metadata.coord.q, state.metadata.coord.r);
  if (tile) {
    tile.placeBuilding(null);
    tile.setFogged(false);
  }
  if (state.lootTable) {
    const result = rollLoot({
      factionId: state.metadata.boss.faction,
      elite: state.eliteLoot,
      rolls: state.lootRolls,
      random: state.random,
      table: state.lootTable
    });
    state.loot = Object.freeze(result.rolls.map((entry) => entry.item.id));
  } else {
    state.loot = Object.freeze([]);
  }
}

export function resetStrongholdEncounters(): void {
  encounters.clear();
  for (const listener of activeUnits.values()) {
    eventBus.off('unitDied', listener);
  }
  activeUnits.clear();
}

export function seedStrongholdEncounter(
  map: HexMap,
  metadata: StrongholdMetadata,
  hooks?: StrongholdEncounterHooks,
  persisted?: StrongholdPersistenceEntry | null
): void {
  const boss = metadata.boss;
  const random = typeof hooks?.random === 'function' ? hooks.random : Math.random;
  const lootTable = metadata.lootTableId ? getLootTableById(metadata.lootTableId) : null;
  const initialLoot = Array.isArray(persisted?.boss?.loot)
    ? Object.freeze([...persisted!.boss!.loot])
    : Object.freeze([]);
  const defeated = Boolean(persisted?.boss?.defeated || metadata.captured);
  const state: EncounterState = {
    metadata,
    map,
    lootTable,
    lootRolls: sanitizeRolls(boss?.lootRolls),
    eliteLoot: Boolean(boss?.eliteLoot),
    random,
    bossUnitId: null,
    defeated,
    loot: initialLoot
  };
  encounters.set(metadata.id, state);
  if (!boss || defeated) {
    return;
  }

  const unitId = `stronghold-${metadata.id}-boss`;
  const unit = createUnit(boss.unit, unitId, metadata.coord, boss.faction, {
    level: boss.level,
    appearanceId: boss.appearanceId,
    behavior: 'defend',
    isBoss: true
  });
  if (!unit) {
    return;
  }

  state.bossUnitId = unit.id;
  const registerUnit = hooks?.registerUnit;
  registerUnit?.(unit);

  const onDeath = () => {
    finalizeEncounter(state);
    eventBus.off('unitDied', listener);
    activeUnits.delete(unit.id);
  };

  const listener = (payload: { unitId: string }) => {
    if (payload.unitId === unit.id) {
      onDeath();
    }
  };

  activeUnits.set(unit.id, listener);
  eventBus.on('unitDied', listener);
  unit.onDeath(onDeath);
}

export function getStrongholdEncounterSnapshot(): Record<string, StrongholdBossPersistence> {
  const snapshot: Record<string, StrongholdBossPersistence> = {};
  for (const [id, state] of encounters.entries()) {
    if (state.defeated || state.loot.length > 0) {
      snapshot[id] = {
        defeated: state.defeated,
        loot: [...state.loot]
      } satisfies StrongholdBossPersistence;
    }
  }
  return snapshot;
}

export function mergeStrongholdEncounterPersistence(
  persistence?: StrongholdPersistence
): void {
  if (!persistence) {
    return;
  }
  for (const [id, entry] of Object.entries(persistence)) {
    const state = encounters.get(id);
    if (!state) {
      continue;
    }
    const bossEntry = entry?.boss;
    if (bossEntry) {
      if (bossEntry.defeated) {
        state.defeated = true;
        state.bossUnitId = null;
      }
      if (Array.isArray(bossEntry.loot)) {
        state.loot = Object.freeze([...bossEntry.loot]);
      }
    }
  }
}
