import type { HexMap } from '../../hexmap.ts';
import type { GameState } from '../../core/GameState.ts';
import { Resource } from '../../core/GameState.ts';
import { createSauna, DEFAULT_SAUNA_VISION_RANGE, type Sauna } from '../../sim/sauna.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  evaluateSaunaTier,
  getSaunaTier,
  listSaunaTiers,
  sanitizeHealingAuraRadius,
  sanitizeHealingAuraRegen,
  type SaunaTier,
  type SaunaTierContext,
  type SaunaTierId
} from '../../sauna/tiers.ts';
import { createPlayerSpawnTierQueue, type PlayerSpawnTierHelpers } from '../../world/spawn/tier_helpers.ts';
import {
  getArtocoinBalance,
  getUnlockedTierIds,
  notifySaunaShopSubscribers,
  setUnlockedTierIds,
  setUpgradedTierIds
} from '../saunaShopState.ts';
import {
  SAUNA_SETTINGS_STORAGE_KEY,
  loadSaunaSettings,
  saveSaunaSettings
} from '../saunaSettings.ts';
import { grantSaunaTier, setUpgradedSaunaTiers } from '../../progression/saunaShop.ts';
import type { NgPlusState } from '../../progression/ngplus.ts';
import type { LogEventPayload } from '../../ui/logging.ts';
import type { StrongholdSpawnExclusionZone } from '../../world/spawn/strongholdSpawn.ts';

export interface SaunaLifecycleOptions {
  map: HexMap;
  state: GameState;
  ngPlusState: NgPlusState;
  getActiveRosterCount: () => number;
  logEvent: (event: LogEventPayload) => void;
  minSpawnLimit: number;
  onVisionRangeChanged?: (zone: StrongholdSpawnExclusionZone) => void;
}

export interface SaunaTierChangeContext {
  previousTierId: SaunaTierId;
  nextTierId: SaunaTierId;
}

export interface SaunaLifecycleResult {
  sauna: Sauna;
  getTierContext: () => SaunaTierContext;
  getActiveTierId: () => SaunaTierId;
  getActiveTierLimit: () => number;
  getActiveSpawnSpeedMultiplier: () => number;
  updateRosterCap: (value: number, options?: { persist?: boolean }) => number;
  setActiveTier: (
    tierId: SaunaTierId,
    options?: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void }
  ) => boolean;
  upgradeTier: (
    tierId: SaunaTierId,
    options?: {
      persist?: boolean;
      activate?: boolean;
      onTierChanged?: (context: SaunaTierChangeContext) => void;
    }
  ) => boolean;
  syncActiveTierWithUnlocks: (
    options?: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void }
  ) => void;
  resolveSpawnLimit: () => number;
  spawnTierQueue: PlayerSpawnTierHelpers;
}

export function clampRosterCap(value: number, limit: number): number {
  const maxCap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (!Number.isFinite(value)) {
    return maxCap;
  }
  const sanitized = Math.max(0, Math.floor(value));
  return Math.max(0, Math.min(maxCap, sanitized));
}

export const MIN_SAUNA_STRONGHOLD_DISTANCE = 6;

const sanitizeSpawnSpeedMultiplier = (value: number | null | undefined): number => {
  if (!Number.isFinite(value)) {
    return 1;
  }
  const multiplier = Number(value);
  return multiplier > 0 ? multiplier : 1;
};

const areSetsEqual = <T>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) {
    return false;
  }
  for (const entry of a) {
    if (!b.has(entry)) {
      return false;
    }
  }
  return true;
};

export function createSaunaLifecycle(options: SaunaLifecycleOptions): SaunaLifecycleResult {
  const {
    map,
    state,
    ngPlusState,
    getActiveRosterCount,
    logEvent,
    minSpawnLimit,
    onVisionRangeChanged
  } = options;

  if (!state) {
    throw new Error('createSaunaLifecycle requires a GameState instance.');
  }

  const gameState = state;

  const saunaSettings = loadSaunaSettings();
  const storage = (() => {
    try {
      const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
      return globalWithStorage.localStorage ?? null;
    } catch {
      return null;
    }
  })();
  let shouldPersistOwnedMigration = false;
  if (storage) {
    try {
      const existing = storage.getItem(SAUNA_SETTINGS_STORAGE_KEY);
      if (!existing) {
        shouldPersistOwnedMigration = true;
      } else {
        const parsed = JSON.parse(existing) as Record<string, unknown> | null;
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.ownedTierIds)) {
          shouldPersistOwnedMigration = true;
        }
      }
    } catch {
      shouldPersistOwnedMigration = true;
    }
  }

  let unlockedTierIds = new Set<SaunaTierId>(getUnlockedTierIds());

  const autoGrantRules: readonly { tierId: SaunaTierId; condition: boolean }[] = [
    { tierId: 'aurora-ward', condition: ngPlusState.unlockSlots >= 2 },
    { tierId: 'glacial-rhythm', condition: ngPlusState.ngPlusLevel >= 2 },
    { tierId: 'mythic-conclave', condition: ngPlusState.ngPlusLevel >= 3 },
    { tierId: 'solstice-cadence', condition: ngPlusState.ngPlusLevel >= 4 },
    { tierId: 'celestial-reserve', condition: ngPlusState.ngPlusLevel >= 5 }
  ];
  for (const { tierId, condition } of autoGrantRules) {
    if (condition && !unlockedTierIds.has(tierId)) {
      unlockedTierIds = new Set(grantSaunaTier(tierId));
      setUnlockedTierIds(unlockedTierIds);
    }
  }
  if (
    saunaSettings.activeTierId !== DEFAULT_SAUNA_TIER_ID &&
    !unlockedTierIds.has(saunaSettings.activeTierId)
  ) {
    unlockedTierIds = new Set(grantSaunaTier(saunaSettings.activeTierId));
    setUnlockedTierIds(unlockedTierIds);
  }

  const getSaunakunniaBalance = (): number => {
    const getter = (gameState as Partial<GameState>).getResource;
    if (typeof getter !== 'function') {
      return 0;
    }
    return Math.max(0, Math.floor(getter.call(gameState, Resource.SAUNAKUNNIA)));
  };

  const ownedTierIds = new Set<SaunaTierId>(
    saunaSettings.ownedTierIds.map((id) => getSaunaTier(id).id)
  );
  ownedTierIds.add(DEFAULT_SAUNA_TIER_ID);
  setUpgradedTierIds(ownedTierIds);
  setUpgradedSaunaTiers(ownedTierIds);

  const resolveTierContext = (): SaunaTierContext => ({
    artocoinBalance: getArtocoinBalance(),
    saunakunniaBalance: getSaunakunniaBalance(),
    unlockedTierIds: getUnlockedTierIds(),
    ownedTierIds
  });

  let currentTierId: SaunaTierId = saunaSettings.activeTierId;
  let initialTierStatus = evaluateSaunaTier(
    getSaunaTier(currentTierId),
    resolveTierContext()
  );
  if (!initialTierStatus.unlocked || !initialTierStatus.owned) {
    currentTierId = DEFAULT_SAUNA_TIER_ID;
    initialTierStatus = evaluateSaunaTier(getSaunaTier(currentTierId), resolveTierContext());
  }
  const activeTier = getSaunaTier(currentTierId);

  const getActiveTierLimit = (): number => {
    const tier = getSaunaTier(currentTierId);
    const cap = Math.max(0, Math.floor(tier.rosterCap));
    return cap;
  };

  const initialRosterCap = clampRosterCap(saunaSettings.maxRosterSize, getActiveTierLimit());
  if (
    shouldPersistOwnedMigration ||
    initialRosterCap !== saunaSettings.maxRosterSize ||
    saunaSettings.activeTierId !== currentTierId ||
    !areSetsEqual(ownedTierIds, new Set(saunaSettings.ownedTierIds))
  ) {
    saveSaunaSettings({
      maxRosterSize: initialRosterCap,
      activeTierId: currentTierId,
      ownedTierIds: Array.from(ownedTierIds)
    });
    shouldPersistOwnedMigration = false;
  }

  const sauna = createSauna(
    {
      q: Math.floor(map.width / 2),
      r: Math.floor(map.height / 2)
    },
    undefined,
    { maxRosterSize: initialRosterCap, tier: activeTier }
  );

  let currentSpawnSpeedMultiplier = 1;
  let hasRevealedVisionRadius = false;
  let lastNotifiedVisionRange = Number.NaN;

  const applyActiveTierEffects = (tier: SaunaTier, options: { reveal?: boolean } = {}): void => {
    currentSpawnSpeedMultiplier = sanitizeSpawnSpeedMultiplier(tier.spawnSpeedMultiplier ?? 1);
    sauna.spawnSpeedMultiplier = currentSpawnSpeedMultiplier;
    sauna.auraRadius = sanitizeHealingAuraRadius(tier.healingAura?.radius);
    sauna.regenPerSec = sanitizeHealingAuraRegen(tier.healingAura?.regenPerSecond);
    sauna.visionRange = DEFAULT_SAUNA_VISION_RANGE;

    if (options.reveal && !hasRevealedVisionRadius) {
      map.revealAround(sauna.pos, DEFAULT_SAUNA_VISION_RANGE);
      hasRevealedVisionRadius = true;
    }

    if (lastNotifiedVisionRange !== DEFAULT_SAUNA_VISION_RANGE) {
      onVisionRangeChanged?.({
        center: { ...sauna.pos },
        radius: DEFAULT_SAUNA_VISION_RANGE
      });
      lastNotifiedVisionRange = DEFAULT_SAUNA_VISION_RANGE;
    }
  };

  applyActiveTierEffects(activeTier, { reveal: true });

  const resolveSpawnLimit = (): number => Math.max(minSpawnLimit, sauna.maxRosterSize);

  const spawnTierQueue = createPlayerSpawnTierQueue({
    getTier: () => getSaunaTier(currentTierId),
    getRosterLimit: () => getActiveTierLimit(),
    getRosterCount: () => getActiveRosterCount(),
    log: (event) => logEvent(event),
    queueCapacity: 3
  });

  let lastPersistedRosterCap = initialRosterCap;
  let lastPersistedTierId = currentTierId;
  let lastPersistedOwnedIds = new Set<SaunaTierId>(ownedTierIds);

  const persistSaunaSettings = (cap: number): void => {
    saveSaunaSettings({
      maxRosterSize: cap,
      activeTierId: currentTierId,
      ownedTierIds: Array.from(ownedTierIds)
    });
    lastPersistedRosterCap = cap;
    lastPersistedTierId = currentTierId;
    lastPersistedOwnedIds = new Set(ownedTierIds);
    shouldPersistOwnedMigration = false;
  };

  const getTierContext = (): SaunaTierContext => resolveTierContext();

  const updateRosterCap = (
    value: number,
    options: { persist?: boolean } = {}
  ): number => {
    const limit = getActiveTierLimit();
    const sanitized = clampRosterCap(value, limit);
    const changed = sanitized !== sauna.maxRosterSize;
    if (changed) {
      sauna.maxRosterSize = sanitized;
    }
    if (options.persist) {
      const tierChanged = currentTierId !== lastPersistedTierId;
      const ownedChanged = !areSetsEqual(ownedTierIds, lastPersistedOwnedIds);
      if (shouldPersistOwnedMigration || tierChanged || sanitized !== lastPersistedRosterCap || ownedChanged) {
        persistSaunaSettings(sanitized);
      }
    }
    return sanitized;
  };

  const syncActiveTierWithUnlocks = (
    options: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void } = {}
  ): void => {
    const context = getTierContext();
    const tiers = listSaunaTiers();
    const currentStatus = evaluateSaunaTier(getSaunaTier(currentTierId), context);

    if (currentStatus.unlocked && currentStatus.owned) {
      if (options.persist) {
        updateRosterCap(sauna.maxRosterSize, { persist: true });
      }
      return;
    }

    let fallbackTierId = DEFAULT_SAUNA_TIER_ID;
    for (const tier of tiers) {
      const status = evaluateSaunaTier(tier, context);
      if (status.unlocked && status.owned) {
        fallbackTierId = tier.id;
      }
    }

    if (fallbackTierId !== currentTierId) {
      const previousTierId = currentTierId;
      currentTierId = fallbackTierId;
      const nextTier = getSaunaTier(currentTierId);
      applyActiveTierEffects(nextTier, { reveal: true });
      spawnTierQueue.clearQueue?.('tier-change');
      updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
      options.onTierChanged?.({ previousTierId, nextTierId: currentTierId });
    } else if (options.persist) {
      updateRosterCap(sauna.maxRosterSize, { persist: true });
    }
  };

  const setActiveTier = (
    tierId: SaunaTierId,
    options: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void } = {}
  ): boolean => {
    const tier = getSaunaTier(tierId);
    const status = evaluateSaunaTier(tier, getTierContext());
    if (!status.unlocked || !status.owned) {
      return false;
    }
    if (tier.id === currentTierId) {
      if (options.persist && currentTierId !== lastPersistedTierId) {
        persistSaunaSettings(sauna.maxRosterSize);
      }
      return true;
    }
    const previousTierId = currentTierId;
    currentTierId = tier.id;
    applyActiveTierEffects(tier, { reveal: true });
    spawnTierQueue.clearQueue?.('tier-change');
    updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
    options.onTierChanged?.({ previousTierId, nextTierId: currentTierId });
    return true;
  };

  const upgradeTier = (
    tierId: SaunaTierId,
    options: {
      persist?: boolean;
      activate?: boolean;
      onTierChanged?: (context: SaunaTierChangeContext) => void;
    } = {}
  ): boolean => {
    const tier = getSaunaTier(tierId);
    const status = evaluateSaunaTier(tier, getTierContext());
    if (!status.unlocked) {
      return false;
    }
    if (status.owned) {
      if (options.activate) {
        return setActiveTier(tier.id, options);
      }
      if (options.persist) {
        persistSaunaSettings(sauna.maxRosterSize);
      }
      return true;
    }

    const cost = Math.max(0, Math.floor(status.upgrade.cost ?? 0));
    if (cost > 0 && !gameState.spendResource(cost, Resource.SAUNAKUNNIA)) {
      return false;
    }

    ownedTierIds.add(tier.id);
    setUpgradedTierIds(ownedTierIds);
    setUpgradedSaunaTiers(ownedTierIds);
    notifySaunaShopSubscribers();

    logEvent({
      type: 'progression',
      message: `${tier.name} upgraded with ${cost} Saunakunnia.`,
      metadata: {
        event: 'sauna-tier-upgrade',
        tierId: tier.id,
        saunakunniaCost: cost
      }
    });

    if (options.persist) {
      persistSaunaSettings(sauna.maxRosterSize);
    }

    if (options.activate) {
      return setActiveTier(tier.id, options);
    }

    return true;
  };

  syncActiveTierWithUnlocks({ persist: true });

  return {
    sauna,
    getTierContext,
    getActiveTierId: () => currentTierId,
    getActiveTierLimit,
    getActiveSpawnSpeedMultiplier: () => currentSpawnSpeedMultiplier,
    updateRosterCap,
    setActiveTier,
    upgradeTier,
    syncActiveTierWithUnlocks,
    resolveSpawnLimit,
    spawnTierQueue
  } satisfies SaunaLifecycleResult;
}
