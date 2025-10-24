import {
  createNgPlusRng,
  ensureNgPlusRunState,
  loadNgPlusState,
  type NgPlusState
} from '../../progression/ngplus.ts';
import {
  createSaunaLifecycle,
  type SaunaLifecycleOptions,
  type SaunaLifecycleResult,
  type SaunaTierChangeContext
} from '../setup/sauna.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  type SaunaTierContext,
  type SaunaTierId
} from '../../sauna/tiers.ts';
import type { PlayerSpawnTierHelpers } from '../../world/spawn/tier_helpers.ts';

type LifecycleSyncOptions = {
  persist?: boolean;
  onTierChanged?: (context: SaunaTierChangeContext) => void;
};

type LifecycleSyncHook = (options?: LifecycleSyncOptions) => void;

const EMPTY_CONTEXT: SaunaTierContext = {
  artocoinBalance: 0,
  saunakunniaBalance: 0,
  unlockedTierIds: Object.freeze(new Set<SaunaTierId>()) as ReadonlySet<SaunaTierId>,
  ownedTierIds: Object.freeze(new Set<SaunaTierId>()) as ReadonlySet<SaunaTierId>
};

const EMPTY_SPAWN_QUEUE: PlayerSpawnTierHelpers = {
  getSnapshot: () => null,
  hasQueuedSpawn: () => false,
  takeQueuedSpawn: () => false,
  restoreQueuedSpawn: () => {
    /* noop */
  },
  queueBlockedSpawn: () => false,
  onSpawnResolved: () => {
    /* noop */
  },
  clearQueue: () => {
    /* noop */
  }
};

let currentNgPlusState: NgPlusState = ensureNgPlusRunState(loadNgPlusState());
let enemyRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x01);
let lootRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x02);

let lifecycle: SaunaLifecycleResult | null = null;
let tierContextRef: () => SaunaTierContext = () => EMPTY_CONTEXT;
let activeTierIdRef: () => SaunaTierId = () => DEFAULT_SAUNA_TIER_ID;
let activeTierLimitRef: () => number = () => 0;
let activeSpawnSpeedMultiplierRef: () => number = () => 1;
let updateRosterCapRef: (value: number, options?: { persist?: boolean }) => number = (value) => value;
let resolveSpawnLimitRef: () => number = () => 0;
let setActiveTierRef: (
  tierId: SaunaTierId,
  options?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
) => boolean = () => false;
let upgradeTierRef: (
  tierId: SaunaTierId,
  options?: { persist?: boolean; activate?: boolean; onTierChanged?: SaunaTierChangeContext }
) => boolean = () => false;
let spawnTierQueueRef: PlayerSpawnTierHelpers = EMPTY_SPAWN_QUEUE;
let lifecycleSync: LifecycleSyncHook | null = null;

export function getNgPlusState(): NgPlusState {
  return currentNgPlusState;
}

export function getEnemyRandom(): () => number {
  return enemyRandom;
}

export function getLootRandom(): () => number {
  return lootRandom;
}

export function applyNgPlusState(next: NgPlusState): void {
  currentNgPlusState = ensureNgPlusRunState(next);
  enemyRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x01);
  lootRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x02);
  lifecycleSync?.({ persist: true });
}

export function initSaunaLifecycle(options: SaunaLifecycleOptions): SaunaLifecycleResult {
  lifecycle = createSaunaLifecycle(options);
  tierContextRef = lifecycle.getTierContext;
  activeTierIdRef = lifecycle.getActiveTierId;
  activeTierLimitRef = lifecycle.getActiveTierLimit;
  activeSpawnSpeedMultiplierRef = lifecycle.getActiveSpawnSpeedMultiplier;
  updateRosterCapRef = lifecycle.updateRosterCap;
  resolveSpawnLimitRef = lifecycle.resolveSpawnLimit;
  setActiveTierRef = lifecycle.setActiveTier;
  upgradeTierRef = lifecycle.upgradeTier;
  spawnTierQueueRef = lifecycle.spawnTierQueue;
  return lifecycle;
}

export function withLifecycleSync(
  decorate: (sync: LifecycleSyncHook) => LifecycleSyncHook
): LifecycleSyncHook {
  const base: LifecycleSyncHook = (options) => {
    if (!lifecycle) {
      return;
    }
    lifecycle.syncActiveTierWithUnlocks(options);
  };
  const decorated = decorate(base);
  lifecycleSync = decorated;
  return decorated;
}

export function getTierContextRef(): () => SaunaTierContext {
  return tierContextRef;
}

export function getActiveTierIdRef(): () => SaunaTierId {
  return activeTierIdRef;
}

export function getActiveTierLimitRef(): () => number {
  return activeTierLimitRef;
}

export function getActiveSpawnSpeedMultiplierRef(): () => number {
  return activeSpawnSpeedMultiplierRef;
}

export function getUpdateRosterCapRef(): (value: number, options?: { persist?: boolean }) => number {
  return updateRosterCapRef;
}

export function getResolveSpawnLimitRef(): () => number {
  return resolveSpawnLimitRef;
}

export function getSetActiveTierRef(): (
  tierId: SaunaTierId,
  options?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
) => boolean {
  return setActiveTierRef;
}

export function getUpgradeTierRef(): (
  tierId: SaunaTierId,
  options?: { persist?: boolean; activate?: boolean; onTierChanged?: SaunaTierChangeContext }
) => boolean {
  return upgradeTierRef;
}

export function getSpawnTierQueue(): PlayerSpawnTierHelpers {
  return spawnTierQueueRef;
}
