import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GameState, Resource } from '../../src/core/GameState.ts';
import { HexMap } from '../../src/hexmap.ts';
import {
  STRONGHOLD_CONFIG,
  getStrongholdSnapshot,
  mergeStrongholdPersistence,
  resetStrongholdRegistry,
  seedEnemyStrongholds
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

describe('GameState stronghold persistence', () => {
  let originalStorage: Storage | undefined;
  let storage: MockStorage;

  beforeEach(() => {
    resetStrongholdRegistry();
    resetStrongholdEncounters();
    storage = createMockStorage();
    originalStorage = globalThis.localStorage;
    // @ts-expect-error allow assigning mock storage for tests
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

  it('treats legacy stronghold saves as deployed with no cooldown', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const legacySave = {
      resources: {
        [Resource.SAUNA_BEER]: 0,
        [Resource.SAUNAKUNNIA]: 0,
        [Resource.SISU]: 0
      },
      lastSaved: Date.now(),
      buildings: {},
      buildingPlacements: {},
      policies: {},
      passiveGeneration: {
        [Resource.SAUNA_BEER]: 0,
        [Resource.SAUNAKUNNIA]: 0,
        [Resource.SISU]: 0
      },
      nightWorkSpeedMultiplier: 1,
      strongholds: {
        'aurora-watch': {
          captured: false,
          seen: true,
          structureHealth: 200,
          structureMaxHealth: 240
        }
      }
    } satisfies Record<string, unknown>;

    storage.setItem('gameState', JSON.stringify(legacySave));

    const state = new GameState(1000);
    const loaded = state.load(map);
    expect(loaded).toBe(true);

    const snapshot = getStrongholdSnapshot();
    const entry = snapshot['aurora-watch'];
    expect(entry).toBeDefined();
    expect(entry?.deployed).toBe(true);
    expect(entry?.spawnCooldownRemaining).toBe(0);
  });

  it('persists deployment and cooldown for new saves', () => {
    const map = new HexMap(10, 10);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    mergeStrongholdPersistence(map, {
      'aurora-watch': {
        deployed: false,
        spawnCooldownRemaining: 42
      }
    });

    const state = new GameState(1000);
    state.save();

    const raw = storage.getItem('gameState');
    expect(raw).toBeTypeOf('string');
    const parsed = JSON.parse(raw!);
    const persistedEntry = parsed?.strongholds?.['aurora-watch'];
    expect(persistedEntry?.deployed).toBe(false);
    expect(persistedEntry?.spawnCooldownRemaining).toBe(42);

    resetStrongholdRegistry();
    resetStrongholdEncounters();

    const reloadState = new GameState(1000);
    const reloadMap = new HexMap(10, 10);
    const persistedStrongholds = reloadState.peekPersistedStrongholds();
    seedEnemyStrongholds(reloadMap, STRONGHOLD_CONFIG, persistedStrongholds);
    const reloaded = reloadState.load(reloadMap);
    expect(reloaded).toBe(true);

    const snapshot = getStrongholdSnapshot();
    const entry = snapshot['aurora-watch'];
    expect(entry?.deployed).toBe(false);
    expect(entry?.spawnCooldownRemaining).toBe(42);
  });
});
