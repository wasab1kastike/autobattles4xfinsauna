import { createNgPlusRng, ensureNgPlusRunState, type NgPlusState } from '../../progression/ngplus.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaTierContext, SaunaTierId } from '../../sauna/tiers.ts';
import { DEFAULT_SAUNA_TIER_ID } from '../../sauna/tiers.ts';
import type { PlayerSpawnTierHelpers } from '../../world/spawn/tier_helpers.ts';
import { getArtocoinBalance, getPurchasedTierIds } from '../saunaShopState.ts';
import {
  createSaunaLifecycle,
  type SaunaLifecycleOptions,
  type SaunaLifecycleResult,
  type SaunaTierChangeContext
} from '../setup/sauna.ts';

export type LifecycleSyncOptions = {
  persist?: boolean;
  onTierChanged?: (context: SaunaTierChangeContext) => void;
};
export type LifecycleSync = (options?: LifecycleSyncOptions) => void;

interface NgPlusApplicationResult {
  state: NgPlusState;
  enemyRandom: () => number;
  lootRandom: () => number;
}

let lifecycle: SaunaLifecycleResult | null = null;
let tierContextRef: () => SaunaTierContext = () => ({
  artocoinBalance: getArtocoinBalance(),
  ownedTierIds: getPurchasedTierIds()
});
let activeTierIdRef: () => SaunaTierId = () => DEFAULT_SAUNA_TIER_ID;
let activeTierLimitRef: () => number = () => 0;
let updateRosterCapRef: (value: number, options?: { persist?: boolean }) => number = (value) => value;
let resolveSpawnLimitRef: () => number = () => 0;
let setActiveTierRef: (
  tierId: SaunaTierId,
  options?: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void }
) => boolean = () => false;
let spawnTierQueueRef: PlayerSpawnTierHelpers | null = null;
let syncLifecycle: LifecycleSync | null = null;

export function initSaunaLifecycle(options: SaunaLifecycleOptions): { sauna: Sauna; spawnTierQueue: PlayerSpawnTierHelpers } {
  lifecycle = createSaunaLifecycle(options);
  tierContextRef = lifecycle.getTierContext;
  activeTierIdRef = lifecycle.getActiveTierId;
  activeTierLimitRef = lifecycle.getActiveTierLimit;
  updateRosterCapRef = lifecycle.updateRosterCap;
  resolveSpawnLimitRef = lifecycle.resolveSpawnLimit;
  setActiveTierRef = lifecycle.setActiveTier;
  spawnTierQueueRef = lifecycle.spawnTierQueue;
  syncLifecycle = lifecycle.syncActiveTierWithUnlocks;
  return { sauna: lifecycle.sauna, spawnTierQueue: lifecycle.spawnTierQueue };
}

export function withLifecycleSync(factory: (sync: LifecycleSync) => LifecycleSync): LifecycleSync {
  if (!lifecycle) {
    throw new Error('Sauna lifecycle has not been initialized.');
  }
  syncLifecycle = factory((options) => lifecycle!.syncActiveTierWithUnlocks(options));
  return syncLifecycle;
}

export function applyNgPlusState(next: NgPlusState): NgPlusApplicationResult {
  const state = ensureNgPlusRunState(next);
  const enemyRandom = createNgPlusRng(state.runSeed, 0x01);
  const lootRandom = createNgPlusRng(state.runSeed, 0x02);
  syncLifecycle?.({ persist: true });
  return { state, enemyRandom, lootRandom } satisfies NgPlusApplicationResult;
}

export function getTierContextSnapshot(): SaunaTierContext {
  return tierContextRef();
}

export function getActiveTierId(): SaunaTierId {
  return activeTierIdRef();
}

export function getActiveTierLimit(): number {
  return activeTierLimitRef();
}

export function updateRosterCap(value: number, options?: { persist?: boolean }): number {
  return updateRosterCapRef(value, options);
}

export function resolveSpawnLimit(): number {
  return resolveSpawnLimitRef();
}

export function setActiveTier(
  tierId: SaunaTierId,
  options?: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void }
): boolean {
  return setActiveTierRef(tierId, options);
}

export function getSpawnTierQueue(): PlayerSpawnTierHelpers {
  if (!spawnTierQueueRef) {
    throw new Error('Sauna lifecycle has not been initialized.');
  }
  return spawnTierQueueRef;
}
