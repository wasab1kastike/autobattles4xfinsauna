/**
 * Simple game state tracking resources and policies.
 * Handles saving/loading via localStorage and offline progress.
 */
import { eventBus } from '../events/EventBus';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import { Farm, Barracks, type Building } from '../buildings/index.ts';
import { markRevealed } from '../camera/autoFrame.ts';
import { safeLoadJSON } from '../loader.ts';
import { PASSIVE_GENERATION, Resource } from './resources.ts';
import {
  getPolicyDefinition,
  POLICY_EVENTS,
  type PolicyAppliedEvent,
  type PolicyRejectedEvent,
  type PolicyRevokedEvent
} from '../data/policies.ts';
export { PASSIVE_GENERATION, Resource } from './resources.ts';
import {
  createNgPlusState,
  ensureNgPlusRunState,
  type NgPlusState
} from '../progression/ngplus.ts';
import {
  getStrongholdSnapshot,
  mergeStrongholdPersistence,
  type StrongholdPersistence,
  type StrongholdPersistenceEntry
} from '../world/strongholds.ts';

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function cloneStrongholdEntry(
  entry?: StrongholdPersistenceEntry | null
): StrongholdPersistenceEntry {
  if (!entry) {
    return {};
  }
  const snapshot: StrongholdPersistenceEntry = {
    captured: Boolean(entry.captured),
    seen: Boolean(entry.seen)
  };
  if (typeof entry.structureHealth === 'number' && Number.isFinite(entry.structureHealth)) {
    snapshot.structureHealth = Math.max(0, entry.structureHealth);
  }
  if (typeof entry.structureMaxHealth === 'number' && Number.isFinite(entry.structureMaxHealth)) {
    snapshot.structureMaxHealth = Math.max(1, entry.structureMaxHealth);
  }
  if (entry.structureDestroyed) {
    snapshot.structureDestroyed = true;
  }
  if (entry.boss) {
    const loot = Array.isArray(entry.boss.loot) ? [...entry.boss.loot] : undefined;
    snapshot.boss = {
      defeated: Boolean(entry.boss.defeated),
      ...(loot ? { loot } : {})
    } satisfies StrongholdPersistenceEntry['boss'];
  }
  return snapshot;
}

const BUILDING_FACTORIES: Record<string, () => Building> = {
  farm: () => new Farm(),
  barracks: () => new Barracks()
};

function createBuilding(type: string): Building | undefined {
  return BUILDING_FACTORIES[type]?.();
}

type SerializedPolicyStatus = {
  enabled?: boolean;
  unlocked?: boolean;
};

type SerializedPolicies = Record<string, SerializedPolicyStatus> | string[];

// Shape of the serialized game state stored in localStorage.
type SerializedStrongholds = StrongholdPersistence;

type SerializedState = {
  resources: Record<Resource, number>;
  lastSaved: number;
  buildings: Record<string, number>;
  buildingPlacements: Record<string, string>;
  policies: SerializedPolicies;
  passiveGeneration: Record<Resource, number>;
  nightWorkSpeedMultiplier: number;
  enemyScaling?: EnemyScalingMultipliers;
  ngPlus?: NgPlusState;
  strongholds?: SerializedStrongholds;
};

export interface EnemyScalingMultipliers {
  readonly aggression: number;
  readonly cadence: number;
  readonly strength: number;
}

export interface EnemyScalingSnapshot extends EnemyScalingMultipliers {
  readonly calmSecondsRemaining: number;
}

const DEFAULT_ENEMY_SCALING: EnemyScalingMultipliers = Object.freeze({
  aggression: 1,
  cadence: 1,
  strength: 1
});

interface PolicyStatus {
  enabled: boolean;
  unlocked: boolean;
}

function sanitizeMultiplier(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function sanitizeEnemyScaling(
  base: EnemyScalingMultipliers,
  overrides: Partial<EnemyScalingMultipliers>
): EnemyScalingMultipliers {
  return {
    aggression: sanitizeMultiplier(overrides.aggression ?? base.aggression, 0.1, 8, base.aggression),
    cadence: sanitizeMultiplier(overrides.cadence ?? base.cadence, 0.25, 6, base.cadence),
    strength: sanitizeMultiplier(overrides.strength ?? base.strength, 0.25, 12, base.strength)
  } satisfies EnemyScalingMultipliers;
}

export class GameState {
  private static readonly EMPTY_POLICY: PolicyStatus = Object.freeze({
    enabled: false,
    unlocked: false
  });

  /** Track the unlocked/enabled status for each policy. */
  private policies = new Map<string, PolicyStatus>();

  /** Current amounts of each resource. */
  resources: Record<Resource, number> = {
    [Resource.SAUNA_BEER]: 0,
    [Resource.SAUNAKUNNIA]: 0,
    [Resource.SISU]: 0
  };

  /** Passive generation applied each tick. */
  private passiveGeneration: Record<Resource, number> = {
    ...PASSIVE_GENERATION
  };

  private lastSaved = Date.now();

  /** Track constructed buildings by type. */
  private buildings: Record<string, number> = {};

  /** Mapping of tile coordinates to constructed building instances. */
  private buildingPlacements = new Map<string, Building>();

  /** Modifier for work speed during night, affected by policies. */
  nightWorkSpeedMultiplier = 1;

  /** Global enemy scaling multipliers contributed by policies and difficulty. */
  private enemyScaling: EnemyScalingMultipliers = { ...DEFAULT_ENEMY_SCALING };

  /** Remaining calm duration in seconds applied to enemy spawns. */
  private enemyCalmSecondsRemaining = 0;

  /** Prestige modifiers for the current run. */
  private ngPlus: NgPlusState = createNgPlusState();

  /** Snapshot of stronghold capture state for persistence fallbacks. */
  private strongholdStatuses = new Map<string, StrongholdPersistenceEntry>();

  constructor(
    private readonly tickInterval: number,
    private readonly storageKey = 'gameState'
  ) {}

  /** Increment resources by passive generation. */
  tick(): void {
    (Object.keys(this.passiveGeneration) as Resource[]).forEach((res) => {
      this.addResource(res, this.passiveGeneration[res]);
    });
  }

  save(): void {
    this.lastSaved = Date.now();
    const placements: Record<string, string> = {};
    this.buildingPlacements.forEach((b, k) => {
      placements[k] = b.type;
    });
    const serializedPolicies: Record<string, SerializedPolicyStatus> = {};
    this.policies.forEach((status, id) => {
      if (!status.unlocked && !status.enabled) {
        return;
      }
      serializedPolicies[id] = {
        enabled: status.enabled,
        unlocked: status.unlocked
      } satisfies SerializedPolicyStatus;
    });

    const strongholdSnapshot = getStrongholdSnapshot();
    if (Object.keys(strongholdSnapshot).length === 0 && this.strongholdStatuses.size > 0) {
      this.strongholdStatuses.forEach((status, id) => {
        strongholdSnapshot[id] = cloneStrongholdEntry(status);
      });
    }
    this.strongholdStatuses.clear();
    Object.entries(strongholdSnapshot).forEach(([id, entry]) => {
      this.strongholdStatuses.set(id, cloneStrongholdEntry(entry));
    });

    const serialized: SerializedState = {
      resources: this.resources,
      lastSaved: this.lastSaved,
      buildings: this.buildings,
      buildingPlacements: placements,
      policies: serializedPolicies,
      passiveGeneration: { ...this.passiveGeneration },
      nightWorkSpeedMultiplier: this.nightWorkSpeedMultiplier,
      enemyScaling: { ...this.enemyScaling },
      ngPlus: this.ngPlus,
      strongholds: strongholdSnapshot
    };
    const storage =
      typeof localStorage !== 'undefined' && localStorage ? localStorage : undefined;
    if (!storage) {
      console.warn('GameState.save: localStorage is unavailable, skipping persistence.');
      return;
    }

    try {
      storage.setItem(this.storageKey, JSON.stringify(serialized));
    } catch (error) {
      console.warn('GameState.save: Failed to persist state to localStorage.', error);
    }
  }

  load(map?: HexMap): boolean {
    const data = safeLoadJSON<Partial<SerializedState>>(this.storageKey);
    if (!data) {
      this.lastSaved = Date.now();
      return false;
    }
    this.resources = { ...this.resources, ...(data.resources ?? {}) };
    (Object.keys(this.resources) as Resource[]).forEach((res) => {
      if (!Number.isFinite(this.resources[res])) {
        this.resources[res] = 0;
      }
    });
    this.enemyScaling = sanitizeEnemyScaling(DEFAULT_ENEMY_SCALING, data.enemyScaling ?? {});
    this.enemyCalmSecondsRemaining = 0;
    const validBuildings: Record<string, number> = {};
    Object.entries(data.buildings ?? {}).forEach(([type, count]) => {
      if (BUILDING_FACTORIES[type]) {
        validBuildings[type] = count;
      }
    });
    this.buildings = validBuildings;
    this.buildingPlacements.clear();
    if (data.buildingPlacements) {
      Object.entries(data.buildingPlacements).forEach(([key, type]) => {
        const b = createBuilding(type);
        if (!b) return;
        this.buildingPlacements.set(key, b);
        const [q, r] = key.split(',').map(Number);
        if (map) {
          const tile = map.ensureTile(q, r);
          tile.placeBuilding(b.type);
          tile.reveal();
          markRevealed({ q, r }, map.hexSize);
        }
        eventBus.emit('buildingPlaced', { building: b, coord: { q, r }, state: this });
      });
    }
    this.lastSaved = data.lastSaved ?? Date.now();

    const savedNgPlus = data.ngPlus ? createNgPlusState(data.ngPlus) : this.ngPlus;
    this.ngPlus = ensureNgPlusRunState(savedNgPlus);

    const persistedStrongholds: StrongholdPersistence = {};
    Object.entries(data.strongholds ?? {}).forEach(([id, entry]) => {
      persistedStrongholds[id] = cloneStrongholdEntry(entry as StrongholdPersistenceEntry);
    });

    mergeStrongholdPersistence(map ?? null, persistedStrongholds);

    const mergedSnapshot = getStrongholdSnapshot();
    this.strongholdStatuses.clear();
    if (Object.keys(mergedSnapshot).length > 0) {
      Object.entries(mergedSnapshot).forEach(([id, entry]) => {
        this.strongholdStatuses.set(id, cloneStrongholdEntry(entry));
      });
    } else if (Object.keys(persistedStrongholds).length > 0) {
      Object.entries(persistedStrongholds).forEach(([id, entry]) => {
        this.strongholdStatuses.set(id, cloneStrongholdEntry(entry));
      });
    }

    // Reset derived policy state and repopulate applied policies from the save.
    this.policies = new Map();
    this.passiveGeneration = { ...PASSIVE_GENERATION };
    this.nightWorkSpeedMultiplier = 1;
    const rawPolicies = data.policies;
    if (Array.isArray(rawPolicies)) {
      rawPolicies
        .filter((policy): policy is string => typeof policy === 'string')
        .forEach((policyId) => {
          const definition = getPolicyDefinition(policyId);
          if (!definition) {
            return;
          }
          this.policies.set(definition.id, { enabled: true, unlocked: true });
          eventBus.emit(POLICY_EVENTS.APPLIED, { policy: definition, state: this });
        });
    } else if (rawPolicies && typeof rawPolicies === 'object') {
      Object.entries(rawPolicies as Record<string, SerializedPolicyStatus>).forEach(
        ([policyId, status]) => {
          if (!status || typeof status !== 'object') {
            return;
          }
          const definition = getPolicyDefinition(policyId);
          if (!definition) {
            return;
          }
          const enabled = Boolean(status.enabled);
          const unlocked = Boolean(status.unlocked ?? status.enabled);
          const normalized: PolicyStatus = {
            enabled,
            unlocked: unlocked || enabled
          };
          this.policies.set(definition.id, normalized);
          if (normalized.enabled) {
            eventBus.emit(POLICY_EVENTS.APPLIED, { policy: definition, state: this });
          }
        }
      );
    }

    if (data.passiveGeneration) {
      const sanitized: Record<Resource, number> = { ...PASSIVE_GENERATION };
      (Object.keys(PASSIVE_GENERATION) as Resource[]).forEach((res) => {
        const value = data.passiveGeneration?.[res];
        if (typeof value === 'number' && Number.isFinite(value)) {
          sanitized[res] = value;
        }
      });
      this.passiveGeneration = sanitized;
    }

    if (
      typeof data.nightWorkSpeedMultiplier === 'number' &&
      Number.isFinite(data.nightWorkSpeedMultiplier)
    ) {
      this.nightWorkSpeedMultiplier = data.nightWorkSpeedMultiplier;
    }

    const elapsed = Date.now() - this.lastSaved;
    const offlineTicks = Math.floor(elapsed / this.tickInterval);
    (Object.keys(this.passiveGeneration) as Resource[]).forEach((res) => {
      this.resources[res] += offlineTicks * this.passiveGeneration[res];
    });
    return true;
  }

  peekPersistedStrongholds(): StrongholdPersistence | null {
    const data = safeLoadJSON<Partial<SerializedState>>(this.storageKey);
    if (!data?.strongholds) {
      return null;
    }
    const snapshot: StrongholdPersistence = {};
    Object.entries(data.strongholds).forEach(([id, entry]) => {
      snapshot[id] = cloneStrongholdEntry(entry as StrongholdPersistenceEntry);
    });
    return snapshot;
  }

  /** Current amount of a resource. */
  getResource(res: Resource): number {
    return this.resources[res];
  }

  /** Determine if the player can afford a cost. */
  canAfford(cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    return this.resources[res] >= cost;
  }

  /** Attempt to spend a resource cost. Returns true if the transaction succeeds. */
  spendResource(cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    return this.spend(cost, res);
  }

  private spend(cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    if (!this.canAfford(cost, res)) {
      return false;
    }
    this.resources[res] -= cost;
    eventBus.emit('resourceChanged', {
      resource: res,
      amount: -cost,
      total: this.resources[res]
    });
    return true;
  }

  /** Add resources and emit change event. */
  addResource(res: Resource, amount: number): void {
    this.resources[res] += amount;
    eventBus.emit('resourceChanged', {
      resource: res,
      amount,
      total: this.resources[res]
    });
  }

  /** Modify passive generation for a resource. */
  modifyPassiveGeneration(res: Resource, delta: number): void {
    this.passiveGeneration[res] =
      (this.passiveGeneration[res] ?? 0) + delta;
  }

  /** Override the baseline enemy scaling multipliers. */
  setEnemyScalingBase(multipliers: Partial<EnemyScalingMultipliers>): EnemyScalingMultipliers {
    this.enemyScaling = sanitizeEnemyScaling(this.enemyScaling, multipliers);
    return { ...this.enemyScaling };
  }

  /** Multiply the current enemy scaling multipliers by the provided factors. */
  applyEnemyScalingModifiers(
    multipliers: Partial<EnemyScalingMultipliers>
  ): EnemyScalingMultipliers {
    const next: EnemyScalingMultipliers = {
      aggression: sanitizeMultiplier(
        this.enemyScaling.aggression * (multipliers.aggression ?? 1),
        0.1,
        8,
        this.enemyScaling.aggression
      ),
      cadence: sanitizeMultiplier(
        this.enemyScaling.cadence * (multipliers.cadence ?? 1),
        0.25,
        6,
        this.enemyScaling.cadence
      ),
      strength: sanitizeMultiplier(
        this.enemyScaling.strength * (multipliers.strength ?? 1),
        0.25,
        12,
        this.enemyScaling.strength
      )
    };
    this.enemyScaling = next;
    return { ...this.enemyScaling };
  }

  /** Snapshot the combined enemy scaling modifiers currently applied. */
  getEnemyScalingSnapshot(): EnemyScalingSnapshot {
    return {
      ...this.enemyScaling,
      calmSecondsRemaining: Math.max(0, this.enemyCalmSecondsRemaining)
    } satisfies EnemyScalingSnapshot;
  }

  /** Request an enemy calm period lasting at least the provided duration in seconds. */
  requestEnemyCalm(durationSeconds: number): number {
    const numeric = Number(durationSeconds);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return this.enemyCalmSecondsRemaining;
    }
    this.enemyCalmSecondsRemaining = Math.max(this.enemyCalmSecondsRemaining, numeric);
    return this.enemyCalmSecondsRemaining;
  }

  /** Advance any pending enemy calm timer by the supplied delta. */
  advanceEnemyCalm(dtSeconds: number): number {
    const numeric = Number(dtSeconds);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return this.enemyCalmSecondsRemaining;
    }
    this.enemyCalmSecondsRemaining = Math.max(0, this.enemyCalmSecondsRemaining - numeric);
    return this.enemyCalmSecondsRemaining;
  }

  /** Clear any pending calm period immediately. */
  clearEnemyCalm(): void {
    this.enemyCalmSecondsRemaining = 0;
  }

  /** Spend resources to construct a building of the given type. */
  construct(building: string, cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    if (!this.spend(cost, res)) {
      return false;
    }
    this.buildings[building] = (this.buildings[building] ?? 0) + 1;
    return true;
  }

  /**
   * Place a building instance on the given map coordinate if affordable and vacant.
   * Returns true on success.
   */
  placeBuilding(
    building: Building,
    coord: AxialCoord,
    map: HexMap,
    res: Resource = Resource.SAUNA_BEER
  ): boolean {
    const tile = map.getTile(coord.q, coord.r);
    if (!tile || tile.building) {
      return false;
    }
    if (!this.construct(building.type, building.cost, res)) {
      return false;
    }
    this.buildingPlacements.set(coordKey(coord), building);
    tile.placeBuilding(building.type);
    eventBus.emit('buildingPlaced', { building, coord, state: this });
    return true;
  }

  /** Retrieve a building instance at the given coordinate, if any. */
  getBuildingAt(coord: AxialCoord): Building | undefined {
    return this.buildingPlacements.get(coordKey(coord));
  }

  /**
   * Remove a building at the given coordinate if one exists.
   * Returns true if a building was removed.
   */
  removeBuilding(coord: AxialCoord, map: HexMap): boolean {
    const key = coordKey(coord);
    const building = this.buildingPlacements.get(key);
    if (!building) {
      return false;
    }
    this.buildingPlacements.delete(key);
    const tile = map.getTile(coord.q, coord.r);
    tile?.placeBuilding(null);
    if (this.buildings[building.type] !== undefined) {
      this.buildings[building.type] -= 1;
      if (this.buildings[building.type] <= 0) {
        delete this.buildings[building.type];
      }
    }
    eventBus.emit('buildingRemoved', { building, coord, state: this });
    return true;
  }

  /** Spend resources to upgrade a building. */
  upgrade(building: string, cost: number, res: Resource = Resource.SAUNA_BEER): boolean {
    return this.construct(`upgrade:${building}`, cost, res);
  }

  /** Spend resources to apply a policy. */
  applyPolicy(policyId: string): boolean {
    const definition = getPolicyDefinition(policyId);
    if (!definition) {
      const payload: PolicyRejectedEvent = {
        policyId,
        state: this,
        reason: 'unknown-policy'
      };
      eventBus.emit(POLICY_EVENTS.REJECTED, payload);
      return false;
    }

    if (this.hasPolicy(definition.id)) {
      const payload: PolicyRejectedEvent = {
        policyId: definition.id,
        policy: definition,
        state: this,
        reason: 'already-applied'
      };
      eventBus.emit(POLICY_EVENTS.REJECTED, payload);
      return false;
    }
    return this.setPolicyEnabled(definition.id, true);
  }

  /** Check if a policy has been applied. */
  hasPolicy(policy: string): boolean {
    return this.policies.get(policy)?.enabled === true;
  }

  /** Determine whether a policy has been unlocked at least once. */
  isPolicyUnlocked(policy: string): boolean {
    return this.policies.get(policy)?.unlocked === true;
  }

  /** Toggle a policy between its enabled and disabled states. */
  togglePolicy(policyId: string): boolean {
    const nextEnabled = !this.hasPolicy(policyId);
    return this.setPolicyEnabled(policyId, nextEnabled);
  }

  /** Enable or disable a policy, emitting lifecycle events as needed. */
  setPolicyEnabled(policyId: string, enabled: boolean): boolean {
    const definition = getPolicyDefinition(policyId);
    if (!definition) {
      const payload: PolicyRejectedEvent = {
        policyId,
        state: this,
        reason: 'unknown-policy'
      };
      eventBus.emit(POLICY_EVENTS.REJECTED, payload);
      return false;
    }

    const current = this.policies.get(definition.id) ?? GameState.EMPTY_POLICY;

    if (enabled) {
      if (current.enabled) {
        return true;
      }

      const missing = definition.prerequisites.filter(
        (requirement) => !requirement.isSatisfied(this)
      );
      if (missing.length > 0) {
        const payload: PolicyRejectedEvent = {
          policyId: definition.id,
          policy: definition,
          state: this,
          reason: 'prerequisites-not-met',
          missingPrerequisites: missing
        };
        eventBus.emit(POLICY_EVENTS.REJECTED, payload);
        return false;
      }

      if (!current.unlocked) {
        if (!this.spend(definition.cost, definition.resource)) {
          const payload: PolicyRejectedEvent = {
            policyId: definition.id,
            policy: definition,
            state: this,
            reason: 'insufficient-resources'
          };
          eventBus.emit(POLICY_EVENTS.REJECTED, payload);
          return false;
        }
      }

      this.policies.set(definition.id, { enabled: true, unlocked: true });
      const payload: PolicyAppliedEvent = { policy: definition, state: this };
      eventBus.emit(POLICY_EVENTS.APPLIED, payload);
      return true;
    }

    if (!current.unlocked) {
      const payload: PolicyRejectedEvent = {
        policyId: definition.id,
        policy: definition,
        state: this,
        reason: 'not-applied'
      };
      eventBus.emit(POLICY_EVENTS.REJECTED, payload);
      return false;
    }

    if (!definition.toggleable) {
      const payload: PolicyRejectedEvent = {
        policyId: definition.id,
        policy: definition,
        state: this,
        reason: 'not-toggleable'
      };
      eventBus.emit(POLICY_EVENTS.REJECTED, payload);
      return false;
    }

    if (!current.enabled) {
      return true;
    }

    this.policies.set(definition.id, { enabled: false, unlocked: true });
    const payload: PolicyRevokedEvent = { policy: definition, state: this };
    eventBus.emit(POLICY_EVENTS.REVOKED, payload);
    return true;
  }

  /** Retrieve the sanitized NG+ state for the current run. */
  getNgPlusState(): NgPlusState {
    return { ...this.ngPlus };
  }

  /**
   * Update the persisted NG+ state. The provided partial will be sanitized and
   * merged with the current value before storage.
   */
  setNgPlusState(next: Partial<NgPlusState>): NgPlusState {
    const merged = createNgPlusState({ ...this.ngPlus, ...next });
    this.ngPlus = ensureNgPlusRunState(merged);
    return this.ngPlus;
  }
}
