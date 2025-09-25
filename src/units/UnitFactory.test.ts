import { describe, it, expect, vi } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { createUnit, spawnUnit } from './UnitFactory.ts';
import { SOLDIER_STATS, SOLDIER_COST, getSoldierStats } from './Soldier.ts';
import { ARCHER_STATS, ARCHER_COST } from './Archer.ts';
import { getAvantoMarauderStats } from './AvantoMarauder.ts';
import { eventBus } from '../events/EventBus.ts';
import type { Unit } from './Unit.ts';

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

  it('samples saunoja appearances using the provided RNG', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const unit = spawnUnit(state, 'soldier', 's-appearance', origin, 'player', {
      appearanceRandom: () => 0.4
    }) as Unit;
    expect(unit.getAppearanceId()).toBe('saunoja-02');
    const alternate = spawnUnit(state, 'soldier', 's-appearance-2', origin, 'player', {
      appearanceRandom: () => 0.9
    }) as Unit;
    expect(alternate.getAppearanceId()).toBe('saunoja-03');
  });

  it('falls back to the generic RNG when appearanceRandom is absent', () => {
    const state = new GameState(1000);
    state.addResource(Resource.SAUNA_BEER, 100);
    const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.12);
    try {
      const unit = spawnUnit(state, 'soldier', 's-random', origin, 'player');
      expect(unit).not.toBeNull();
      expect(unit!.getAppearanceId()).toBe('saunoja-01');
    } finally {
      mathRandomSpy.mockRestore();
    }
  });

  it('reuses the deterministic RNG when only random is provided', () => {
    const samples: string[] = [];
    let cursor = 0;
    const deterministic = () => {
      const sequence = [0.1, 0.85, 0.6, 0.3];
      const value = sequence[cursor % sequence.length];
      cursor += 1;
      return value;
    };

    for (let index = 0; index < 3; index += 1) {
      const unit = createUnit('raider', `enemy-${index}`, origin, 'enemy', {
        random: deterministic
      }) as Unit;
      samples.push(unit.getAppearanceId());
    }

    expect(samples).toEqual(['enemy-orc-1', 'enemy-orc-2', 'enemy-orc-2']);
  });
});

