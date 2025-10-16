import type { HexMap } from '../../hexmap.ts';
import { createSauna, type Sauna } from '../../sim/sauna.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  evaluateSaunaTier,
  getSaunaTier,
  listSaunaTiers,
  type SaunaTier,
  type SaunaTierContext,
  type SaunaTierId
} from '../../sauna/tiers.ts';
import { createPlayerSpawnTierQueue, type PlayerSpawnTierHelpers } from '../../world/spawn/tier_helpers.ts';
import {
  getArtocoinBalance,
  getPurchasedTierIds,
  setPurchasedTierIds
} from '../saunaShopState.ts';
import { loadSaunaSettings, saveSaunaSettings } from '../saunaSettings.ts';
import { grantSaunaTier } from '../../progression/saunaShop.ts';
import type { NgPlusState } from '../../progression/ngplus.ts';
import type { LogEventPayload } from '../../ui/logging.ts';
import type { StrongholdSpawnExclusionZone } from '../../world/spawn/strongholdSpawn.ts';

export interface SaunaLifecycleOptions {
  map: HexMap;
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
  updateRosterCap: (value: number, options?: { persist?: boolean }) => number;
  setActiveTier: (
    tierId: SaunaTierId,
    options?: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void }
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

export function createSaunaLifecycle(options: SaunaLifecycleOptions): SaunaLifecycleResult {
  const { map, ngPlusState, getActiveRosterCount, logEvent, minSpawnLimit, onVisionRangeChanged } = options;

  const saunaSettings = loadSaunaSettings();

  if (ngPlusState.unlockSlots >= 2) {
    setPurchasedTierIds(grantSaunaTier('aurora-ward'));
  }
  if (ngPlusState.ngPlusLevel >= 3) {
    setPurchasedTierIds(grantSaunaTier('mythic-conclave'));
  }
  if (
    saunaSettings.activeTierId !== DEFAULT_SAUNA_TIER_ID &&
    !getPurchasedTierIds().has(saunaSettings.activeTierId)
  ) {
    setPurchasedTierIds(grantSaunaTier(saunaSettings.activeTierId));
  }

  const resolveTierContext = (): SaunaTierContext => ({
    artocoinBalance: getArtocoinBalance(),
    ownedTierIds: getPurchasedTierIds()
  });

  let currentTierId: SaunaTierId = saunaSettings.activeTierId;
  const initialTierStatus = evaluateSaunaTier(getSaunaTier(currentTierId), resolveTierContext());
  if (!initialTierStatus.unlocked) {
    currentTierId = DEFAULT_SAUNA_TIER_ID;
  }
  const activeTier = getSaunaTier(currentTierId);

  const getActiveTierLimit = (): number => {
    const tier = getSaunaTier(currentTierId);
    const cap = Math.max(0, Math.floor(tier.rosterCap));
    return cap;
  };

  const initialRosterCap = clampRosterCap(saunaSettings.maxRosterSize, getActiveTierLimit());
  if (initialRosterCap !== saunaSettings.maxRosterSize || saunaSettings.activeTierId !== currentTierId) {
    saveSaunaSettings({
      maxRosterSize: initialRosterCap,
      activeTierId: currentTierId
    });
  }

  const sauna = createSauna(
    {
      q: Math.floor(map.width / 2),
      r: Math.floor(map.height / 2)
    },
    undefined,
    { maxRosterSize: initialRosterCap, tier: activeTier }
  );

  const sanitizeVisionRange = (value: number): number =>
    Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

  let lastNotifiedVisionRange = Number.NaN;

  const updateSaunaVisionFromTier = (tier: SaunaTier, options: { reveal?: boolean } = {}): void => {
    const resolved = sanitizeVisionRange(tier.visionRange);
    if (resolved !== sauna.visionRange) {
      sauna.visionRange = resolved;
    }
    if (options.reveal) {
      map.revealAround(sauna.pos, sauna.visionRange);
    }
    if (sauna.visionRange !== lastNotifiedVisionRange) {
      onVisionRangeChanged?.({ center: { ...sauna.pos }, radius: sauna.visionRange });
      lastNotifiedVisionRange = sauna.visionRange;
    }
  };

  updateSaunaVisionFromTier(activeTier);

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

  const persistSaunaSettings = (cap: number): void => {
    saveSaunaSettings({ maxRosterSize: cap, activeTierId: currentTierId });
    lastPersistedRosterCap = cap;
    lastPersistedTierId = currentTierId;
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
      if (tierChanged || sanitized !== lastPersistedRosterCap) {
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
    let highestUnlockedId = DEFAULT_SAUNA_TIER_ID;
    for (const tier of tiers) {
      const status = evaluateSaunaTier(tier, context);
      if (status.unlocked) {
        highestUnlockedId = tier.id;
      } else {
        break;
      }
    }

    const currentStatus = evaluateSaunaTier(getSaunaTier(currentTierId), context);
    const tierChanged = !currentStatus.unlocked || currentTierId !== highestUnlockedId;
    if (tierChanged) {
      const previousTierId = currentTierId;
      currentTierId = highestUnlockedId;
      const nextTier = getSaunaTier(currentTierId);
      updateSaunaVisionFromTier(nextTier, { reveal: true });
      spawnTierQueue.clearQueue?.('tier-change');
      updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
      options.onTierChanged?.({ previousTierId, nextTierId: currentTierId });
      return;
    }

    if (options.persist) {
      updateRosterCap(sauna.maxRosterSize, { persist: true });
    }
  };

  const setActiveTier = (
    tierId: SaunaTierId,
    options: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void } = {}
  ): boolean => {
    const tier = getSaunaTier(tierId);
    const status = evaluateSaunaTier(tier, getTierContext());
    if (!status.unlocked) {
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
    updateSaunaVisionFromTier(tier, { reveal: true });
    spawnTierQueue.clearQueue?.('tier-change');
    updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
    options.onTierChanged?.({ previousTierId, nextTierId: currentTierId });
    return true;
  };

  syncActiveTierWithUnlocks({ persist: true });

  return {
    sauna,
    getTierContext,
    getActiveTierId: () => currentTierId,
    getActiveTierLimit,
    updateRosterCap,
    setActiveTier,
    syncActiveTierWithUnlocks,
    resolveSpawnLimit,
    spawnTierQueue
  } satisfies SaunaLifecycleResult;
}
