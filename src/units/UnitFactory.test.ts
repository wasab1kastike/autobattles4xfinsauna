import { describe, it, expect } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { spawnUnit } from './UnitFactory.ts';
import { SOLDIER_STATS, SOLDIER_COST } from './Soldier.ts';
import { ARCHER_STATS, ARCHER_COST } from './Archer.ts';

const origin = { q: 0, r: 0 };

describe('UnitFactory', () => {
  it('spawns a soldier and deducts resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 100);
    const unit = spawnUnit(state, 'soldier', 's1', origin, 'player');
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(SOLDIER_STATS);
    expect(state.getResource(Resource.GOLD)).toBe(100 - SOLDIER_COST);
  });

  it('spawns an archer with correct stats', () => {
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 200);
    const unit = spawnUnit(state, 'archer', 'a1', origin, 'player');
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(ARCHER_STATS);
    expect(state.getResource(Resource.GOLD)).toBe(200 - ARCHER_COST);
  });

  it('fails when resources are insufficient', () => {
    const state = new GameState(1000);
    state.addResource(Resource.GOLD, 10);
    const unit = spawnUnit(state, 'soldier', 's1', origin, 'player');
    expect(unit).toBeNull();
    expect(state.getResource(Resource.GOLD)).toBe(10);
  });
});

