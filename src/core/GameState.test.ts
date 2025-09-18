import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState, Resource } from './GameState';
import { eventBus } from '../events/EventBus';
import { HexMap } from '../hexmap.ts';
import { Farm } from '../buildings/index.ts';
import '../events';

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
    (state as any).policies.add('eco');
    (state as any).policies.add('temperance');
    state.modifyPassiveGeneration(Resource.SAUNA_BEER, 1);
    state.nightWorkSpeedMultiplier = 1.05;

    state.save();

    const serialized = localStorage.getItem('gameState');
    expect(serialized).not.toBeNull();
    const parsed = JSON.parse(serialized ?? '{}');

    expect(parsed.policies).toContain('eco');
    expect(parsed.policies).toContain('temperance');
    expect(parsed.passiveGeneration[Resource.SAUNA_BEER]).toBe(2);
    expect(parsed.nightWorkSpeedMultiplier).toBeCloseTo(1.05);
  });

  it('applies policy modifiers via listeners', () => {
    const state = new GameState(1000);
    state.applyPolicy('eco', 0); // free for testing
    state.tick();
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(2); // base 1 + eco policy
  });

  it('spends Saunakunnia when applying policies by default', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNAKUNNIA, 10);

    const applied = state.applyPolicy('grand-reveal', 4);

    expect(applied).toBe(true);
    expect(state.getResource(Resource.SAUNAKUNNIA)).toBe(6);
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
    (state as any).policies.add('eco');
    (state as any).policies.add('temperance');
    state.modifyPassiveGeneration(Resource.SAUNA_BEER, 1);
    state.nightWorkSpeedMultiplier = 1.05;
    state.save();

    const spy = vi.fn();
    eventBus.on('policyApplied', spy);

    vi.setSystemTime(5000);
    const loaded = new GameState(1000);
    expect(loaded.load()).toBe(true);

    eventBus.off('policyApplied', spy);

    expect(spy.mock.calls.map((call) => call[0]?.policy)).toEqual([
      'eco',
      'temperance'
    ]);
    expect(loaded.hasPolicy('eco')).toBe(true);
    expect(loaded.hasPolicy('temperance')).toBe(true);
    expect(loaded.nightWorkSpeedMultiplier).toBeCloseTo(1.05);
    expect(loaded.getResource(Resource.SAUNA_BEER)).toBe(10);
  });
});
