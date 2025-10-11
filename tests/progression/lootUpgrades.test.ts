import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

function createStorageMock(): Storage {
  const state = new Map<string, string>();
  return {
    get length() {
      return state.size;
    },
    clear: () => state.clear(),
    getItem: (key) => (state.has(key) ? state.get(key) ?? null : null),
    key: (index) => Array.from(state.keys())[index] ?? null,
    removeItem: (key) => {
      state.delete(key);
    },
    setItem: (key, value) => {
      state.set(key, String(value));
    }
  } satisfies Storage;
}

describe('lootUpgrades progression', () => {
  beforeEach(() => {
    vi.resetModules();
    const storage = createStorageMock();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
    } else {
      delete (globalThis as { localStorage?: Storage }).localStorage;
    }
    vi.restoreAllMocks();
  });

  it('persists granted upgrades across reloads', async () => {
    const module = await import('../../src/progression/lootUpgrades.ts');
    module.grantLootUpgrade('lucky-incense');

    expect(module.getPurchasedLootUpgrades().has('lucky-incense')).toBe(true);

    vi.resetModules();
    const reloaded = await import('../../src/progression/lootUpgrades.ts');
    expect(reloaded.getPurchasedLootUpgrades().has('lucky-incense')).toBe(true);
  });

  it('stacks drop chance and roll modifiers from purchased upgrades', async () => {
    const module = await import('../../src/progression/lootUpgrades.ts');
    module.setPurchasedLootUpgrades(['lucky-incense', 'treasure-cache']);

    expect(module.getLootDropChance()).toBeCloseTo(module.BASE_LOOT_DROP_CHANCE + 0.08, 5);
    expect(module.getLootRollBonus()).toBe(1);
    expect(module.getEffectiveLootRolls()).toBe(2);
  });

  it('gates loot drops using the configured RNG source', async () => {
    const module = await import('../../src/progression/lootUpgrades.ts');
    module.setPurchasedLootUpgrades([]);

    expect(module.shouldDropLoot(() => 0.95)).toBe(false);
    expect(module.shouldDropLoot(() => 0.01)).toBe(true);
  });
});
