import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { Farm, Barracks } from './index.ts';
import { HexMap } from '../hexmap.ts';
import * as UnitFactory from '../units/UnitFactory.ts';

// register event listeners
import '../events';

const coordFarm = { q: 0, r: 0 };
const coordBarracks = { q: 1, r: 0 };

const spawnUnitSpy = vi.spyOn(UnitFactory, 'spawnUnit');

describe('building effects', () => {
  beforeEach(() => {
    spawnUnitSpy.mockClear();
    localStorage.clear();
  });

  afterEach(() => {
    spawnUnitSpy.mockReset();
  });

  it('increases passive sauna beer when a farm is placed', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const map = new HexMap(3, 3, 1);
    expect(state.placeBuilding(new Farm(), coordFarm, map)).toBe(true);
    state.tick();
    // 100 start - 50 cost + (1 base + 1 farm) = 52
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(52);
  });

  it('spawns a unit when a barracks is placed', async () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 500);
    const map = new HexMap(3, 3, 1);
    expect(state.placeBuilding(new Barracks(), coordBarracks, map)).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(spawnUnitSpy).toHaveBeenCalledWith(
      state,
      'soldier',
      expect.any(String),
      coordBarracks,
      'player'
    );
  });

  it('removes passive sauna beer when a farm is removed', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const map = new HexMap(3, 3, 1);
    expect(state.placeBuilding(new Farm(), coordFarm, map)).toBe(true);
    state.tick();
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(52);
    expect(state.removeBuilding(coordFarm, map)).toBe(true);
    state.tick();
    // only base generation after removal
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(53);
    expect(state.getBuildingAt(coordFarm)).toBeUndefined();
  });
});
