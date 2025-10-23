import { GAME_STATE_STORAGE_KEY } from '../core/GameState.ts';
import { DEFAULT_SCHEDULER_STORAGE_KEY } from '../events/scheduler.ts';
import { SAUNOJA_STORAGE_KEY } from '../game/rosterStorage.ts';
import { SAUNA_SETTINGS_STORAGE_KEY } from '../game/saunaSettings.ts';
import { INVENTORY_STORAGE_KEY } from '../inventory/state.ts';
import { ARTOCOIN_STORAGE_KEY } from '../progression/artocoin.ts';
import { LOOT_UPGRADES_STORAGE_KEY } from '../progression/lootUpgrades.ts';
import { NG_PLUS_STORAGE_KEY } from '../progression/ngplus.ts';
import { SAUNA_SHOP_STORAGE_KEY } from '../progression/saunaShop.ts';
import { LOCAL_FLAGS_STORAGE_KEY } from '../save/local_flags.ts';

export const STORAGE_RESET_SENTINEL_KEY = 'autobattles:storage-reset:v2024-12-fresh-start';
export const STORAGE_RESET_SENTINEL_VALUE = 'done';

export const PERSISTENCE_STORAGE_KEYS: readonly string[] = [
  GAME_STATE_STORAGE_KEY,
  SAUNOJA_STORAGE_KEY,
  SAUNA_SETTINGS_STORAGE_KEY,
  LOCAL_FLAGS_STORAGE_KEY,
  DEFAULT_SCHEDULER_STORAGE_KEY,
  INVENTORY_STORAGE_KEY,
  ARTOCOIN_STORAGE_KEY,
  NG_PLUS_STORAGE_KEY,
  SAUNA_SHOP_STORAGE_KEY,
  LOOT_UPGRADES_STORAGE_KEY
];

function resolveLocalStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch (error) {
    console.warn('Unable to access localStorage while resetting corrupted saves.', error);
    return null;
  }
}

function markReset(storage: Storage): void {
  try {
    storage.setItem(STORAGE_RESET_SENTINEL_KEY, STORAGE_RESET_SENTINEL_VALUE);
  } catch (error) {
    console.warn('Failed to persist storage reset sentinel.', error);
  }
}

function hasReset(storage: Storage): boolean {
  try {
    return storage.getItem(STORAGE_RESET_SENTINEL_KEY) === STORAGE_RESET_SENTINEL_VALUE;
  } catch (error) {
    console.warn('Failed to inspect storage reset sentinel.', error);
    return false;
  }
}

export interface ResetCorruptedSavesOptions {
  readonly storage?: Storage | null;
}

export interface ResetCorruptedSavesResult {
  readonly reset: boolean;
  readonly clearedKeys: readonly string[];
}

export function resetCorruptedSaves(
  options: ResetCorruptedSavesOptions = {}
): ResetCorruptedSavesResult {
  const storage = options.storage !== undefined ? options.storage : resolveLocalStorage();
  if (!storage) {
    return { reset: false, clearedKeys: [] };
  }

  if (hasReset(storage)) {
    return { reset: false, clearedKeys: [] };
  }

  const cleared: string[] = [];
  for (const key of PERSISTENCE_STORAGE_KEYS) {
    try {
      storage.removeItem(key);
      cleared.push(key);
    } catch (error) {
      console.warn('Failed to clear corrupted save entry.', { key, error });
    }
  }

  markReset(storage);
  return { reset: true, clearedKeys: cleared };
}
