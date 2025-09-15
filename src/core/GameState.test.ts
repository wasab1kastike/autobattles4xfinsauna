import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameState, Resource } from './GameState';
import { HexMap } from '../hexmap.ts';
import { Farm } from '../buildings/index.ts';
import '../events';

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

    expect(loaded.getResource(Resource.GOLD)).toBe(6); // 1 saved + 5 offline ticks
  });

  it('applies policy modifiers via listeners', () => {
    const state = new GameState(1000);
    state.applyPolicy('eco', 0); // free for testing
    state.tick();
    expect(state.getResource(Resource.GOLD)).toBe(2); // base 1 + eco policy
  });

  it('constructs and upgrades buildings when affordable', () => {
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 100);

    const built = state.construct('hut', 60);
    const upgraded = state.upgrade('hut', 30);

    expect(built).toBe(true);
    expect(upgraded).toBe(true);
    expect(state.getResource(Resource.GOLD)).toBe(10);
    expect((state as any).buildings['hut']).toBe(1);
    expect((state as any).buildings['upgrade:hut']).toBe(1);
  });

  it('fails to construct or upgrade without sufficient resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 5);

    const built = state.construct('hut', 10);
    const upgraded = state.upgrade('hut', 10);

    expect(built).toBe(false);
    expect(upgraded).toBe(false);
    expect(state.getResource(Resource.GOLD)).toBe(5);
    expect((state as any).buildings['hut']).toBeUndefined();
    expect((state as any).buildings['upgrade:hut']).toBeUndefined();
  });

  it('persists building placements across save/load', () => {
    const map1 = new HexMap(3, 3, 1);
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 100);
    const coord = { q: 1, r: 1 };
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
    state.addResource(Resource.GOLD, 100);
    const coord = { q: 0, r: 0 };
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
    state.addResource(Resource.GOLD, 100);
    const coord = { q: 0, r: 0 };
    expect(state.placeBuilding(new Farm(), coord, map1)).toBe(true);
    state.save();

    const map2 = new HexMap(3, 3, 1);
    const loaded = new GameState(1000);
    loaded.load(map2);
    loaded.tick();

    expect(loaded.getResource(Resource.GOLD)).toBe(52);
  });

  it('skips unknown building types when loading', () => {
    const serialized = {
      resources: { [Resource.GOLD]: 0 },
      lastSaved: 0,
      buildings: { mystery: 1 },
      buildingPlacements: { '0,0': 'mystery' }
    };
    localStorage.setItem('gameState', JSON.stringify(serialized));

    const map = new HexMap(3, 3, 1);
    const state = new GameState(1000);
    state.load(map);

    expect(state.getBuildingAt({ q: 0, r: 0 })).toBeUndefined();
    expect(map.getTile(0, 0)?.building).toBeNull();
  });
});
