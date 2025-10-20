import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GameState } from '../../src/core/GameState.ts';
import { HexMap } from '../../src/hexmap.ts';
import { StrongholdSpawner } from '../../src/sim/StrongholdSpawner.ts';
import {
  activateStronghold,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds,
  STRONGHOLD_CONFIG
} from '../../src/world/strongholds.ts';
import { resetStrongholdEncounters } from '../../src/world/strongholdEncounters.ts';

interface MockStorage extends Storage {
  readonly data: Map<string, string>;
  dump(): Record<string, string>;
}

function createMockStorage(): MockStorage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null;
    },
    key(index: number) {
      const keys = Array.from(data.keys());
      return index >= 0 && index < keys.length ? keys[index] : null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
    dump() {
      return Object.fromEntries(data.entries());
    },
    data
  } as MockStorage;
}

describe('StrongholdSpawner integration', () => {
  let originalStorage: Storage | undefined;
  let storage: MockStorage;

  beforeEach(() => {
    resetStrongholdRegistry();
    resetStrongholdEncounters();
    storage = createMockStorage();
    originalStorage = globalThis.localStorage;
    // @ts-expect-error assign mock storage for integration test
    globalThis.localStorage = storage;
  });

  afterEach(() => {
    resetStrongholdRegistry();
    resetStrongholdEncounters();
    if (typeof originalStorage === 'undefined') {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    } else {
      globalThis.localStorage = originalStorage;
    }
  });

  it('activates dormant strongholds on interval and persists cooldown progress across reloads', () => {
    const map = new HexMap(12, 12);
    const state = new GameState(1000);
    const persistedStrongholds = state.peekPersistedStrongholds();
    const persistedSpawner = state.peekStrongholdSpawnerSnapshot();
    const registerUnit = vi.fn();
    const random = () => 0.42;

    seedEnemyStrongholds(map, STRONGHOLD_CONFIG, persistedStrongholds, {
      encounters: { registerUnit, random }
    });

    const spawner = new StrongholdSpawner({
      initialQueue: listStrongholds()
        .filter((entry) => !entry.captured && !entry.deployed)
        .map((entry) => entry.id),
      snapshot: persistedSpawner ?? undefined
    });

    const countDeployed = () => listStrongholds().filter((entry) => entry.deployed).length;

    const runTick = (seconds: number) => {
      const activations = spawner.update(seconds);
      for (const id of activations) {
        activateStronghold(id, map, {
          registerUnit,
          encounters: { registerUnit, random },
          persisted: persistedStrongholds?.[id] ?? null
        });
      }
      state.setStrongholdSpawnerSnapshot(spawner.getSnapshot());
    };

    expect(countDeployed()).toBe(0);
    runTick(179);
    expect(countDeployed()).toBe(0);
    expect(registerUnit).not.toHaveBeenCalled();

    runTick(1);
    expect(countDeployed()).toBe(1);
    expect(registerUnit).toHaveBeenCalledTimes(1);

    const firstStronghold = STRONGHOLD_CONFIG.strongholds[0];
    const firstTile = map.getTile(firstStronghold.coord.q, firstStronghold.coord.r);
    expect(firstTile?.building).toBe('city');
    expect(firstTile?.isFogged).toBe(true);

    runTick(180);
    expect(countDeployed()).toBe(2);
    expect(registerUnit).toHaveBeenCalledTimes(2);

    state.save();

    resetStrongholdRegistry();
    resetStrongholdEncounters();

    const reloadMap = new HexMap(12, 12);
    const reloadState = new GameState(1000);
    const rePersistedStrongholds = reloadState.peekPersistedStrongholds();
    const rePersistedSpawner = reloadState.peekStrongholdSpawnerSnapshot();
    const reloadRegisterUnit = vi.fn();

    seedEnemyStrongholds(reloadMap, STRONGHOLD_CONFIG, rePersistedStrongholds, {
      encounters: { registerUnit: reloadRegisterUnit, random }
    });
    expect(reloadRegisterUnit).toHaveBeenCalledTimes(countDeployed());
    reloadRegisterUnit.mockReset();

    const reloadSpawner = new StrongholdSpawner({
      initialQueue: listStrongholds()
        .filter((entry) => !entry.captured && !entry.deployed)
        .map((entry) => entry.id),
      snapshot: rePersistedSpawner ?? undefined
    });

    expect(countDeployed()).toBe(2);

    const runReloadTick = (seconds: number) => {
      const activations = reloadSpawner.update(seconds);
      for (const id of activations) {
        activateStronghold(id, reloadMap, {
          registerUnit: reloadRegisterUnit,
          encounters: { registerUnit: reloadRegisterUnit, random },
          persisted: rePersistedStrongholds?.[id] ?? null
        });
      }
      reloadState.setStrongholdSpawnerSnapshot(reloadSpawner.getSnapshot());
    };

    runReloadTick(179);
    expect(countDeployed()).toBe(2);
    expect(reloadRegisterUnit).not.toHaveBeenCalled();

    runReloadTick(1);
    expect(countDeployed()).toBe(3);
    expect(reloadRegisterUnit).toHaveBeenCalledTimes(1);

    reloadState.save();
  });
});
