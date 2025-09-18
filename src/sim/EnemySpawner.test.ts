import { describe, expect, it } from 'vitest';
import { EnemySpawner } from './EnemySpawner.ts';
import type { Unit } from '../units/Unit.ts';
import { getAvantoMarauderStats } from '../units/AvantoMarauder.ts';

function makeRandomSource(values: number[]): () => number {
  const queue = [...values];
  return () => queue.shift() ?? 0;
}

describe('EnemySpawner', () => {
  it('spawns bundles according to cadence and faction identity', () => {
    const spawner = new EnemySpawner({
      factionId: 'enemy',
      random: makeRandomSource([0.6, 0.95])
    });
    const units: Unit[] = [];
    const edges = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ];
    const added: Unit[] = [];

    const registerUnit = (unit: Unit) => {
      units.push(unit);
      added.push(unit);
    };
    const pickEdge = () => edges.shift();

    spawner.update(29, units, registerUnit, pickEdge);
    expect(units).toHaveLength(0);

    spawner.update(1, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);
    expect(added.map((unit) => unit.coord)).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);
    expect(units.every((unit) => unit.faction === 'enemy')).toBe(true);

    spawner.update(5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(2);

    spawner.update(23.5, units, registerUnit, pickEdge);
    expect(units).toHaveLength(3);
    const lastUnit = units.at(-1);
    expect(lastUnit?.coord).toEqual({ q: 2, r: 0 });
    if (lastUnit) {
      const levelTwoStats = getAvantoMarauderStats(2);
      expect(lastUnit.stats.health).toBe(levelTwoStats.health);
    }
  });
});
