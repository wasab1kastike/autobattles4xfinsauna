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
  getUnlockedTierIdsMock,
  setUnlockedTierIdsMock,
  setUpgradedTierIdsMock,
  notifySaunaShopSubscribersMock,
  grantSaunaTierMock,
  setUpgradedSaunaTiersMock
} = vi.hoisted(() => ({
  loadSaunaSettingsMock: vi.fn(),
  saveSaunaSettingsMock: vi.fn(),
  getArtocoinBalanceMock: vi.fn(),
  getUnlockedTierIdsMock: vi.fn<[], Set<SaunaTierId>>(),
  setUnlockedTierIdsMock: vi.fn<(ids: Set<SaunaTierId>) => void>(),
  setUpgradedTierIdsMock: vi.fn<(ids: Set<SaunaTierId>) => void>(),
  notifySaunaShopSubscribersMock: vi.fn(),
  grantSaunaTierMock: vi.fn<(tierId: SaunaTierId) => Set<SaunaTierId>>(),
  setUpgradedSaunaTiersMock: vi.fn<(ids: Set<SaunaTierId>) => Set<SaunaTierId>>()
}));

vi.mock('../../src/game/saunaSettings.ts', () => ({
  loadSaunaSettings: loadSaunaSettingsMock,
  saveSaunaSettings: saveSaunaSettingsMock
}));

vi.mock('../../src/game/saunaShopState.ts', () => ({
  getArtocoinBalance: getArtocoinBalanceMock,
  getUnlockedTierIds: getUnlockedTierIdsMock,
  setUnlockedTierIds: setUnlockedTierIdsMock,
  setUpgradedTierIds: setUpgradedTierIdsMock,
  notifySaunaShopSubscribers: notifySaunaShopSubscribersMock
}));

vi.mock('../../src/progression/saunaShop.ts', () => ({
  grantSaunaTier: grantSaunaTierMock,
  setUpgradedSaunaTiers: setUpgradedSaunaTiersMock
}));

const unlockedTierIds = new Set<SaunaTierId>();
const ownedTierIds = new Set<SaunaTierId>();

const ngPlusState: NgPlusState = {
  runSeed: 1,
  ngPlusLevel: 0,
  unlockSlots: 0,
  enemyTuning: { aggressionMultiplier: 1, cadenceMultiplier: 1, strengthMultiplier: 1 }
};

const createLifecycle = () =>
  createSaunaLifecycle({
    map: new HexMap(10, 10, 32),
    state: {
      spendResource: vi.fn(() => true),
      getResource: vi.fn(() => 0)
    } as unknown as import('../../src/core/GameState.ts').GameState,
    ngPlusState,
    getActiveRosterCount: () => 0,
    logEvent: vi.fn(),
    minSpawnLimit: 3
  });

beforeEach(() => {
  unlockedTierIds.clear();
  unlockedTierIds.add(DEFAULT_SAUNA_TIER_ID);
  ownedTierIds.clear();
  ownedTierIds.add(DEFAULT_SAUNA_TIER_ID);
  getUnlockedTierIdsMock.mockReset();
  getUnlockedTierIdsMock.mockImplementation(() => new Set(unlockedTierIds));
  setUpgradedTierIdsMock.mockReset();
  setUpgradedTierIdsMock.mockImplementation((ids: Set<SaunaTierId>) => {
    ownedTierIds.clear();
    for (const id of ids) {
      ownedTierIds.add(id);
    }
  });
  notifySaunaShopSubscribersMock.mockReset();
  getArtocoinBalanceMock.mockReset();
  getArtocoinBalanceMock.mockReturnValue(0);
  loadSaunaSettingsMock.mockReset();
  loadSaunaSettingsMock.mockReturnValue({
    maxRosterSize: 2,
    activeTierId: DEFAULT_SAUNA_TIER_ID,
    ownedTierIds: [DEFAULT_SAUNA_TIER_ID]
  });
  saveSaunaSettingsMock.mockReset();
  setUnlockedTierIdsMock.mockReset();
  setUnlockedTierIdsMock.mockImplementation((ids: Set<SaunaTierId>) => {
    unlockedTierIds.clear();
    for (const id of ids) {
      unlockedTierIds.add(id);
    }
  });
  grantSaunaTierMock.mockReset();
  grantSaunaTierMock.mockImplementation((tierId: SaunaTierId) => {
    unlockedTierIds.add(tierId);
    return new Set(unlockedTierIds);
  });
  setUpgradedSaunaTiersMock.mockReset();
  setUpgradedSaunaTiersMock.mockImplementation((ids: Set<SaunaTierId>) => ids);
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
      activeTierId: lifecycle.getActiveTierId(),
      ownedTierIds: Array.from(ownedTierIds)
    });
  });

  it('clears the spawn queue when switching tiers', () => {
    const tiers = listSaunaTiers();
    expect(tiers.length).toBeGreaterThan(1);

    unlockedTierIds.add(tiers[1].id);
    const lifecycle = createLifecycle();
    lifecycle.upgradeTier(tiers[1].id, { persist: true });
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
    unlockedTierIds.add('aurora-ward');
    unlockedTierIds.add('glacial-rhythm');
    const lifecycle = createLifecycle();
    const { sauna } = lifecycle;

    lifecycle.upgradeTier('aurora-ward', { persist: true });
    lifecycle.upgradeTier('glacial-rhythm', { persist: true });

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
