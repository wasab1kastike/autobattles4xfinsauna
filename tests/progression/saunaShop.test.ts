import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalGlobalLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'localStorage'
);

const originalWindowLocalStorage = Object.getOwnPropertyDescriptor(
  globalThis.window ?? {},
  'localStorage'
);

function disableLocalStorage(): void {
  const throwUnavailable = () => {
    throw new Error('localStorage unavailable for test');
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: throwUnavailable
  });

  if (globalThis.window) {
    Object.defineProperty(globalThis.window, 'localStorage', {
      configurable: true,
      get: throwUnavailable
    });
  }
}

function restoreLocalStorage(): void {
  if (originalGlobalLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', originalGlobalLocalStorage);
  } else {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  }

  if (globalThis.window) {
    if (originalWindowLocalStorage) {
      Object.defineProperty(globalThis.window, 'localStorage', originalWindowLocalStorage);
    } else {
      delete (globalThis.window as { localStorage?: Storage }).localStorage;
    }
  }
}

describe('purchaseSaunaTier', () => {
  beforeEach(() => {
    vi.resetModules();
    disableLocalStorage();
  });

  afterEach(() => {
    restoreLocalStorage();
    vi.restoreAllMocks();
  });

  it('uses the supplied runtime balance when artocoin storage is unavailable', async () => {
    const artocoinModule = await import('../../src/progression/artocoin.ts');
    const spendSpy = vi.spyOn(artocoinModule, 'spendArtocoins');

    const { purchaseSaunaTier, getPurchasedSaunaTiers } = await import(
      '../../src/progression/saunaShop.ts'
    );
    const { getSaunaTier } = await import('../../src/sauna/tiers.ts');

    const tier = getSaunaTier('aurora-ward');
    expect(tier.spawnSpeedMultiplier).toBe(1);
    const runtimeBalance = 120;
    const expectedCost = Math.max(0, Math.floor(tier.unlock.cost));

    const result = purchaseSaunaTier(tier, {
      getCurrentBalance: () => runtimeBalance
    });

    expect(result.success).toBe(true);
    expect(result.balance).toBe(runtimeBalance - expectedCost);
    expect(result.reason).toBeUndefined();
    expect(result.shortfall).toBeUndefined();
    expect(spendSpy).not.toHaveBeenCalled();
    expect(getPurchasedSaunaTiers().has(tier.id)).toBe(true);
  });
});

