import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HexMap } from '../../src/hexmap.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  listSaunaTiers,
  type SaunaTierId
} from '../../src/sauna/tiers.ts';
import type { NgPlusState } from '../../src/progression/ngplus.ts';
import { createSaunaLifecycle } from '../../src/game/setup/sauna.ts';
import { Unit } from '../../src/units/Unit.ts';

const {
  loadSaunaSettingsMock,
  saveSaunaSettingsMock,
  getArtocoinBalanceMock,
  getPurchasedTierIdsMock,
  setPurchasedTierIdsMock,
  grantSaunaTierMock
} = vi.hoisted(() => ({
  loadSaunaSettingsMock: vi.fn(),
  saveSaunaSettingsMock: vi.fn(),
  getArtocoinBalanceMock: vi.fn(),
  getPurchasedTierIdsMock: vi.fn<[], Set<SaunaTierId>>(),
  setPurchasedTierIdsMock: vi.fn<(ids: Set<SaunaTierId>) => void>(),
  grantSaunaTierMock: vi.fn<(tierId: SaunaTierId) => Set<SaunaTierId>>()
}));

vi.mock('../../src/game/saunaSettings.ts', () => ({
  loadSaunaSettings: loadSaunaSettingsMock,
  saveSaunaSettings: saveSaunaSettingsMock
}));

vi.mock('../../src/game/saunaShopState.ts', () => ({
  getArtocoinBalance: getArtocoinBalanceMock,
  getPurchasedTierIds: getPurchasedTierIdsMock,
  setPurchasedTierIds: setPurchasedTierIdsMock
}));

vi.mock('../../src/progression/saunaShop.ts', () => ({
  grantSaunaTier: grantSaunaTierMock
}));

const purchasedTierIds = new Set<SaunaTierId>();

const ngPlusState: NgPlusState = {
  runSeed: 1,
  ngPlusLevel: 0,
  unlockSlots: 0,
  enemyTuning: { aggressionMultiplier: 1, cadenceMultiplier: 1, strengthMultiplier: 1 }
};

const createLifecycle = () =>
  createSaunaLifecycle({
    map: new HexMap(10, 10, 32),
    ngPlusState,
    getActiveRosterCount: () => 0,
    logEvent: vi.fn(),
    minSpawnLimit: 3
  });

beforeEach(() => {
  purchasedTierIds.clear();
  purchasedTierIds.add(DEFAULT_SAUNA_TIER_ID);
  getPurchasedTierIdsMock.mockReset();
  getPurchasedTierIdsMock.mockImplementation(() => new Set(purchasedTierIds));
  getArtocoinBalanceMock.mockReset();
  getArtocoinBalanceMock.mockReturnValue(0);
  loadSaunaSettingsMock.mockReset();
  loadSaunaSettingsMock.mockReturnValue({
    maxRosterSize: 2,
    activeTierId: DEFAULT_SAUNA_TIER_ID
  });
  saveSaunaSettingsMock.mockReset();
  setPurchasedTierIdsMock.mockReset();
  setPurchasedTierIdsMock.mockImplementation((ids: Set<SaunaTierId>) => {
    purchasedTierIds.clear();
    for (const id of ids) {
      purchasedTierIds.add(id);
    }
  });
  grantSaunaTierMock.mockReset();
  grantSaunaTierMock.mockImplementation((tierId: SaunaTierId) => {
    purchasedTierIds.add(tierId);
    return new Set(purchasedTierIds);
  });
});

describe('createSaunaLifecycle', () => {
  it('persists roster cap when updateRosterCap runs with persist', () => {
    const lifecycle = createLifecycle();
    saveSaunaSettingsMock.mockClear();

    const limit = lifecycle.getActiveTierLimit();
    const next = lifecycle.updateRosterCap(limit + 5, { persist: true });

    expect(next).toBe(limit);
    expect(saveSaunaSettingsMock).toHaveBeenCalledTimes(1);
    expect(saveSaunaSettingsMock).toHaveBeenLastCalledWith({
      maxRosterSize: limit,
      activeTierId: lifecycle.getActiveTierId()
    });
  });

  it('clears the spawn queue when switching tiers', () => {
    const tiers = listSaunaTiers();
    expect(tiers.length).toBeGreaterThan(1);

    const lifecycle = createLifecycle();
    purchasedTierIds.add(tiers[1].id);
    const queue = lifecycle.spawnTierQueue;
    const snapshot = queue.getSnapshot();
    expect(snapshot).not.toBeNull();
    const queued = queue.queueBlockedSpawn(snapshot!, () => true);
    expect(queued).toBe(true);
    expect(queue.hasQueuedSpawn()).toBe(true);

    const changed = lifecycle.setActiveTier(tiers[1].id, { persist: true });
    expect(changed).toBe(true);
    expect(queue.hasQueuedSpawn()).toBe(false);
  });

  it('extends the healing aura to three hexes and restores allies at range', () => {
    const lifecycle = createLifecycle();
    const { sauna } = lifecycle;

    purchasedTierIds.add('aurora-ward');
    purchasedTierIds.add('glacial-rhythm');

    expect(sauna.auraRadius).toBe(2);
    expect(sauna.regenPerSec).toBeCloseTo(1, 5);

    const healer = new Unit(
      'healing-target',
      'soldier',
      { q: sauna.pos.q + 3, r: sauna.pos.r },
      'player',
      { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 }
    );

    healer.stats.health = 5;
    healer.update(1, sauna);
    expect(healer.stats.health).toBeCloseTo(5, 5);

    const promoted = lifecycle.setActiveTier('glacial-rhythm', { persist: true });
    expect(promoted).toBe(true);
    expect(sauna.auraRadius).toBe(3);
    expect(sauna.regenPerSec).toBeCloseTo(1.5, 5);

    healer.stats.health = 5;
    healer.update(1, sauna);
    expect(healer.stats.health).toBeCloseTo(6.5, 5);
  });
});
