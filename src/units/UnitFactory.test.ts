import { describe, it, expect } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { createUnit, spawnUnit } from './UnitFactory.ts';
import { SOLDIER_STATS, SOLDIER_COST, getSoldierStats } from './Soldier.ts';
import { ARCHER_STATS, ARCHER_COST } from './Archer.ts';
import { getAvantoMarauderStats } from './AvantoMarauder.ts';
import { eventBus } from '../events/EventBus.ts';

const origin = { q: 0, r: 0 };

describe('UnitFactory', () => {
  it('spawns a soldier and deducts resources', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const unit = spawnUnit(state, 'soldier', 's1', origin, 'player');
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(SOLDIER_STATS);
    expect(unit!.type).toBe('soldier');
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(100 - SOLDIER_COST);
  });

  it('spawns an archer with correct stats', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 200);
    const unit = spawnUnit(state, 'archer', 'a1', origin, 'player');
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(ARCHER_STATS);
    expect(unit!.type).toBe('archer');
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(200 - ARCHER_COST);
  });

  it('fails when resources are insufficient', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 10);
    const unit = spawnUnit(state, 'soldier', 's1', origin, 'player');
    expect(unit).toBeNull();
    expect(state.getResource(Resource.SAUNA_BEER)).toBe(10);
  });

  it('emits a unitSpawned event when creation succeeds', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const received: string[] = [];
    const listener = ({ unit }: { unit: { id: string } }) => {
      received.push(unit.id);
    };
    eventBus.on('unitSpawned', listener);
    let unit: ReturnType<typeof spawnUnit> | null = null;
    try {
      unit = spawnUnit(state, 'soldier', 's1', origin, 'player');
    } finally {
      eventBus.off('unitSpawned', listener);
    }
    expect(unit).not.toBeNull();
    expect(received).toEqual(['s1']);
  });

  it('creates leveled stats deterministically', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 500);
    const unit = spawnUnit(state, 'soldier', 's2', origin, 'player', { level: 4 });
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(getSoldierStats(4));
  });

  it('creates archetype instances without spending resources', () => {
    const unit = createUnit('avanto-marauder', 'enemy1', origin, 'enemy', { level: 3 });
    expect(unit).not.toBeNull();
    expect(unit!.stats).toEqual(getAvantoMarauderStats(3));
  });
});

