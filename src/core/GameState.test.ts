import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState, Resource } from './GameState';
import { eventBus } from '../events/EventBus';
import {
  POLICY_EVENTS,
  listPolicies,
  type PolicyAppliedEvent,
  type PolicyRejectedEvent,
  type PolicyRevokedEvent
} from '../data/policies.ts';
import { HexMap } from '../hexmap.ts';
import { Farm } from '../buildings/index.ts';
import '../events';
import { combinePolicyModifiers } from '../policies/modifiers.ts';

function ensureRevealed(map: HexMap, coord: { q: number; r: number }): void {
  const tile = map.ensureTile(coord.q, coord.r);
  tile.reveal();
}

describe('GameState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves to and loads from localStorage with offline progress', () => {
    const state = new GameState(1000);
    state.tick(); // +1 resource
    state.save();
    expect(localStorage.getItem('gameState')).not.toBeNull();

    // simulate 5 seconds offline
    vi.setSystemTime(5000);
    const loaded = new GameState(1000);
    loaded.load();

    expect(loaded.getResource(Resource.SAUNA_BEER)).toBe(6); // 1 saved + 5 offline ticks
  });

  it('logs a warning and continues when localStorage.setItem throws', () => {
    const state = new GameState(1000);
    vi.setSystemTime(1234);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
      throw new Error('kaboom');
    });

    expect(() => state.save()).not.toThrow();
    expect((state as any).lastSaved).toBe(1234);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledTimes(1);

    setItemSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('skips persistence when localStorage is unavailable', () => {
    const getSpy = vi.spyOn(globalThis, 'localStorage', 'get').mockReturnValue(undefined as any);

    const state = new GameState(1000);
    vi.setSystemTime(5678);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => state.save()).not.toThrow();
    expect((state as any).lastSaved).toBe(5678);
    expect(warnSpy).toHaveBeenCalledTimes(1);

    warnSpy.mockRestore();
    getSpy.mockRestore();
  });

  it('reports whether a saved game was restored', () => {
    const initialBeer = 200;
    const initialHonor = 3;
    const fresh = new GameState(1000);
    expect(fresh.load()).toBe(false);
    fresh.addResource(Resource.SAUNA_BEER, initialBeer);
    fresh.addResource(Resource.SAUNAKUNNIA, initialHonor);
    fresh.save();

    const loaded = new GameState(1000);
    const restored = loaded.load();
    expect(restored).toBe(true);

    if (!restored) {
      loaded.addResource(Resource.SAUNA_BEER, initialBeer);
      loaded.addResource(Resource.SAUNAKUNNIA, initialHonor);
    }

    expect(loaded.getResource(Resource.SAUNA_BEER)).toBe(initialBeer);
    expect(loaded.getResource(Resource.SAUNAKUNNIA)).toBe(initialHonor);
  });

  it('persists Saunakunnia alongside other resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 5);
    state.save();

    const serialized = localStorage.getItem('gameState');
    expect(serialized).not.toBeNull();
    const parsed = JSON.parse(serialized ?? '{}');
    expect(parsed.resources[Resource.SAUNAKUNNIA]).toBe(5);

    const loaded = new GameState(1000);
    loaded.load();
    expect(loaded.getResource(Resource.SAUNAKUNNIA)).toBe(5);
  });

  it('persists applied policies and derived modifiers when saving', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 100);
    state.addResource(Resource.SAUNA_BEER, 60);
    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.setPolicyEnabled('temperance', true)).toBe(true);

    state.save();

    const serialized = localStorage.getItem('gameState');
    expect(serialized).not.toBeNull();
    const parsed = JSON.parse(serialized ?? '{}');

    expect(parsed.policies.eco).toEqual({ enabled: true, unlocked: true });
    expect(parsed.policies['temperance']).toEqual({ enabled: true, unlocked: true });
    expect(parsed.passiveGeneration[Resource.SAUNA_BEER]).toBe(2);
    expect(parsed.nightWorkSpeedMultiplier).toBeCloseTo(1.05);
  });

  it('tracks enemy scaling multipliers and persists them', () => {
    const state = new GameState(1000);
    state.setEnemyScalingBase({ aggression: 1.4, cadence: 1.2 });
    state.applyEnemyScalingModifiers({ strength: 1.3 });
    const snapshot = state.getEnemyScalingSnapshot();
    expect(snapshot.aggression).toBeCloseTo(1.4);
    expect(snapshot.cadence).toBeCloseTo(1.2);
    expect(snapshot.strength).toBeCloseTo(1.3);
    state.save();
    const serialized = localStorage.getItem('gameState');
    expect(serialized).not.toBeNull();
    const parsed = JSON.parse(serialized ?? '{}');
    expect(parsed.enemyScaling.aggression).toBeCloseTo(1.4);
    expect(parsed.enemyScaling.cadence).toBeCloseTo(1.2);
    const loaded = new GameState(1000);
    loaded.load();
    const loadedSnapshot = loaded.getEnemyScalingSnapshot();
    expect(loadedSnapshot.strength).toBeCloseTo(1.3);
  });

  it('handles enemy calm timers over subsequent ticks', () => {
    const state = new GameState(1000);
    expect(state.requestEnemyCalm(5)).toBeCloseTo(5);
    let snapshot = state.getEnemyScalingSnapshot();
    expect(snapshot.calmSecondsRemaining).toBeCloseTo(5);
    state.advanceEnemyCalm(1.5);
    snapshot = state.getEnemyScalingSnapshot();
    expect(snapshot.calmSecondsRemaining).toBeCloseTo(3.5);
    state.clearEnemyCalm();
    snapshot = state.getEnemyScalingSnapshot();
    expect(snapshot.calmSecondsRemaining).toBe(0);
  });

  it('applies policy modifiers via listeners', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 15);
    expect(state.applyPolicy('eco')).toBe(true);
    state.tick();
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(2); // base 1 + eco mandate
  });

  it('spends Saunakunnia when applying policies by default', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 20);

    const applied = state.applyPolicy('eco');

    expect(applied).toBe(true);
    expect(state.getResource(Resource.SAUNAKUNNIA)).toBe(5);
  });

  it('toggles eligible policies and emits revoke events without double-charging', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 50);

    const appliedSpy = vi.fn<(payload: PolicyAppliedEvent) => void>();
    const revokedSpy = vi.fn<(payload: PolicyRevokedEvent) => void>();
    eventBus.on(POLICY_EVENTS.APPLIED, appliedSpy);
    eventBus.on(POLICY_EVENTS.REVOKED, revokedSpy);

    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.hasPolicy('eco')).toBe(true);
    expect(state.getResource(Resource.SAUNAKUNNIA)).toBe(35);
    expect(state.isPolicyUnlocked('eco')).toBe(true);
    expect(state.togglePolicy('eco')).toBe(true);
    expect(state.hasPolicy('eco')).toBe(false);
    expect(state.getResource(Resource.SAUNAKUNNIA)).toBe(35);
    expect(state.togglePolicy('eco')).toBe(true);
    expect(state.hasPolicy('eco')).toBe(true);
    expect(state.getResource(Resource.SAUNAKUNNIA)).toBe(35);

    eventBus.off(POLICY_EVENTS.APPLIED, appliedSpy);
    eventBus.off(POLICY_EVENTS.REVOKED, revokedSpy);

    expect(appliedSpy).toHaveBeenCalledTimes(2);
    expect(revokedSpy).toHaveBeenCalledTimes(1);
    expect(state.isPolicyUnlocked('eco')).toBe(true);
    expect((state as any).passiveGeneration[Resource.SAUNA_BEER]).toBe(2);
    state.setPolicyEnabled('eco', false);
    expect((state as any).passiveGeneration[Resource.SAUNA_BEER]).toBe(1);
  });

  it('persists disabled toggleable policies and restores unlocked status', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 50);
    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.setPolicyEnabled('eco', false)).toBe(true);
    state.save();

    const raw = localStorage.getItem('gameState');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.policies.eco).toEqual({ enabled: false, unlocked: true });

    const loaded = new GameState(1000);
    expect(loaded.load()).toBe(true);
    expect(loaded.hasPolicy('eco')).toBe(false);
    expect(loaded.isPolicyUnlocked('eco')).toBe(true);
    expect(loaded.getResource(Resource.SAUNAKUNNIA)).toBe(35);
    expect((loaded as any).passiveGeneration[Resource.SAUNA_BEER]).toBe(1);

    expect(loaded.setPolicyEnabled('eco', true)).toBe(true);
    expect(loaded.getResource(Resource.SAUNAKUNNIA)).toBe(35);
    expect(loaded.hasPolicy('eco')).toBe(true);
  });

  it('rejects policies when prerequisites are missing', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 100);

    const rejections: PolicyRejectedEvent[] = [];
    const listener = (payload: PolicyRejectedEvent): void => {
      rejections.push(payload);
    };

    eventBus.on(POLICY_EVENTS.REJECTED, listener);
    const applied = state.applyPolicy('temperance');
    eventBus.off(POLICY_EVENTS.REJECTED, listener);

    expect(applied).toBe(false);
    expect(rejections[0]?.reason).toBe('prerequisites-not-met');
    expect(rejections[0]?.missingPrerequisites?.length ?? 0).toBeGreaterThan(0);
  });

  it('applies policies once prerequisites are satisfied', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 80);
    state.addResource(Resource.SAUNA_BEER, 60);

    expect(state.applyPolicy('eco')).toBe(true);

    const appliedPolicies: string[] = [];
    const listener = ({ policy }: PolicyAppliedEvent): void => {
      appliedPolicies.push(policy.id);
    };
    eventBus.on(POLICY_EVENTS.APPLIED, listener);

    const appliedTemperance = state.applyPolicy('temperance');

    eventBus.off(POLICY_EVENTS.APPLIED, listener);

    expect(appliedTemperance).toBe(true);
    expect(appliedPolicies).toContain('temperance');
    expect(state.nightWorkSpeedMultiplier).toBeGreaterThan(1);
  });

  it('amplifies and restores steam debt protocol modifiers when toggled', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 200);
    state.addResource(Resource.SAUNA_BEER, 120);

    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.setPolicyEnabled('temperance', true)).toBe(true);
    expect(state.setPolicyEnabled('steam-diplomats', true)).toBe(true);

    const passiveBefore = (state as any).passiveGeneration[Resource.SAUNA_BEER];
    const snapshotBefore = state.getEnemyScalingSnapshot();

    expect(state.setPolicyEnabled('steam-debt-protocol', true)).toBe(true);

    const passiveAfterApply = (state as any).passiveGeneration[Resource.SAUNA_BEER];
    const snapshotAfterApply = state.getEnemyScalingSnapshot();

    expect(passiveAfterApply).toBeCloseTo(passiveBefore + 3);
    expect(snapshotAfterApply.aggression).toBeCloseTo(snapshotBefore.aggression * 1.25, 5);
    expect(snapshotAfterApply.cadence).toBeCloseTo(snapshotBefore.cadence * 1.15, 5);

    expect(state.setPolicyEnabled('steam-debt-protocol', false)).toBe(true);

    const passiveAfterRevoke = (state as any).passiveGeneration[Resource.SAUNA_BEER];
    const snapshotAfterRevoke = state.getEnemyScalingSnapshot();

    expect(passiveAfterRevoke).toBeCloseTo(passiveBefore, 5);
    expect(snapshotAfterRevoke.aggression).toBeCloseTo(snapshotBefore.aggression, 5);
    expect(snapshotAfterRevoke.cadence).toBeCloseTo(snapshotBefore.cadence, 5);
  });

  it('smoke tests policy modifier recalculation with steam debt protocol', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 200);
    state.addResource(Resource.SAUNA_BEER, 120);

    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.setPolicyEnabled('temperance', true)).toBe(true);
    expect(state.setPolicyEnabled('steam-diplomats', true)).toBe(true);
    expect(state.setPolicyEnabled('steam-debt-protocol', true)).toBe(true);

    const activePolicies = listPolicies().filter((definition) => state.hasPolicy(definition.id));
    const summary = combinePolicyModifiers(activePolicies);

    expect(summary.upkeepMultiplier).toBeCloseTo(1.12, 5);
    expect(summary.upkeepDelta).toBe(0);
  });

  it('rejects disabling policies that are not toggleable', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 80);
    state.addResource(Resource.SAUNA_BEER, 60);
    expect(state.setPolicyEnabled('eco', true)).toBe(true);
    expect(state.setPolicyEnabled('temperance', true)).toBe(true);

    const rejections: PolicyRejectedEvent[] = [];
    const listener = (payload: PolicyRejectedEvent): void => {
      rejections.push(payload);
    };

    eventBus.on(POLICY_EVENTS.REJECTED, listener);
    expect(state.setPolicyEnabled('temperance', false)).toBe(false);
    eventBus.off(POLICY_EVENTS.REJECTED, listener);

    expect(rejections.at(-1)?.reason).toBe('not-toggleable');
    expect(state.hasPolicy('temperance')).toBe(true);
  });

  it('constructs and upgrades buildings when affordable', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);

    const built = state.construct('hut', 60);
    const upgraded = state.upgrade('hut', 30);

    expect(built).toBe(true);
    expect(upgraded).toBe(true);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(10);
    expect((state as any).buildings['hut']).toBe(1);
    expect((state as any).buildings['upgrade:hut']).toBe(1);
  });

  it('fails to construct or upgrade without sufficient resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 5);

    const built = state.construct('hut', 10);
    const upgraded = state.upgrade('hut', 10);

    expect(built).toBe(false);
    expect(upgraded).toBe(false);
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(5);
    expect((state as any).buildings['hut']).toBeUndefined();
    expect((state as any).buildings['upgrade:hut']).toBeUndefined();
  });

  it('persists building placements across save/load', () => {
    const map1 = new HexMap(3, 3, 1);
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const coord = { q: 1, r: 1 };
    ensureRevealed(map1, coord);
    expect(state.placeBuilding(new Farm(), coord, map1)).toBe(true);
    state.save();

    const map2 = new HexMap(3, 3, 1);
    const loaded = new GameState(1000);
    loaded.load(map2);

    expect(map2.getTile(coord.q, coord.r)?.building).toBe('farm');
    expect(loaded.getBuildingAt(coord)?.type).toBe('farm');
  });

  it('restores building counts after save/load', () => {
    const map1 = new HexMap(3, 3, 1);
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const coord = { q: 0, r: 0 };
    ensureRevealed(map1, coord);
    expect(state.placeBuilding(new Farm(), coord, map1)).toBe(true);
    state.save();

    const map2 = new HexMap(3, 3, 1);
    const loaded = new GameState(1000);
    loaded.load(map2);

    expect((loaded as any).buildings['farm']).toBe(1);
    expect(map2.getTile(coord.q, coord.r)?.building).toBe('farm');
  });

  it("retains farm passive bonus after save/load", () => {
    const map1 = new HexMap(3, 3, 1);
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const coord = { q: 0, r: 0 };
    ensureRevealed(map1, coord);
    expect(state.placeBuilding(new Farm(), coord, map1)).toBe(true);
    state.save();

    const map2 = new HexMap(3, 3, 1);
    const loaded = new GameState(1000);
    loaded.load(map2);
    loaded.tick();

    expect(loaded.getResource(Resource.SAUNA_BEER)).toBe(52);
  });

  it('skips unknown building types when loading', () => {
    const serialized = {
      resources: { [Resource.SAUNA_BEER]: 0 },
      lastSaved: 0,
      buildings: { mystery: 1, farm: 2 },
      buildingPlacements: { '0,0': 'mystery', '1,1': 'farm' }
    };
    localStorage.setItem('gameState', JSON.stringify(serialized));

    const map = new HexMap(3, 3, 1);
    map.ensureTile(0, 0);
    const state = new GameState(1000);
    state.load(map);

    expect(state.getBuildingAt({ q: 0, r: 0 })).toBeUndefined();
    expect(map.getTile(0, 0)?.building).toBeNull();
    expect((state as any).buildings['mystery']).toBeUndefined();
    expect((state as any).buildings['farm']).toBe(2);
    expect(map.getTile(1, 1)?.building).toBe('farm');
  });

  it('restores policy effects and offline progress after save/load', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 80);
    state.addResource(Resource.SAUNA_BEER, 50);
    expect(state.applyPolicy('eco')).toBe(true);
    expect(state.applyPolicy('temperance')).toBe(true);
    expect(state.spendResource(50, Resource.SAUNA_BEER)).toBe(true);
    state.save();

    const spy = vi.fn<(payload: PolicyAppliedEvent) => void>();
    eventBus.on(POLICY_EVENTS.APPLIED, spy);

    vi.setSystemTime(5000);
    const loaded = new GameState(1000);
    expect(loaded.load()).toBe(true);

    eventBus.off(POLICY_EVENTS.APPLIED, spy);

    expect(spy.mock.calls.map((call) => call[0]?.policy.id)).toEqual([
      'eco',
      'temperance'
    ]);
    expect(loaded.hasPolicy('eco')).toBe(true);
    expect(loaded.hasPolicy('temperance')).toBe(true);
    expect(loaded.nightWorkSpeedMultiplier).toBeCloseTo(1.05);
    expect(loaded.getResource(Resource.SAUNA_BEER)).toBe(10);
  });

  it('persists NG+ metadata alongside resources', () => {
    const state = new GameState(1000);
    state.setNgPlusState({ runSeed: 37, ngPlusLevel: 2, unlockSlots: 3 });
    state.addResource(Resource.SAUNAKUNNIA, 4);
    state.save();

    const raw = localStorage.getItem('gameState');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.ngPlus).toEqual({
      runSeed: 37,
      ngPlusLevel: 2,
      unlockSlots: 3,
      enemyTuning: {
        aggressionMultiplier: 1,
        cadenceMultiplier: 1,
        strengthMultiplier: 1
      }
    });

    const loaded = new GameState(1000);
    expect(loaded.load()).toBe(true);
    const ngPlus = loaded.getNgPlusState();
    expect(ngPlus.ngPlusLevel).toBe(2);
    expect(ngPlus.unlockSlots).toBe(3);
    expect(ngPlus.runSeed).toBe(37);
  });

  it('retains NG+ metadata when offline ticks apply', () => {
    const state = new GameState(1000);
    state.setNgPlusState({ runSeed: 12, ngPlusLevel: 1, unlockSlots: 1 });
    state.modifyPassiveGeneration(Resource.SAUNA_BEER, 1);
    state.save();

    const stored = localStorage.getItem('gameState');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '{}');
    parsed.lastSaved = -5000;
    localStorage.setItem('gameState', JSON.stringify(parsed));

    vi.setSystemTime(5000);
    const loaded = new GameState(1000);
    expect(loaded.load()).toBe(true);
    const ngPlus = loaded.getNgPlusState();
    expect(ngPlus.ngPlusLevel).toBe(1);
    expect(ngPlus.unlockSlots).toBe(1);
    expect(ngPlus.runSeed).toBe(12);
  });
});
