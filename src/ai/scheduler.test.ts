import { describe, expect, it } from 'vitest';
import type { Unit } from '../units/Unit.ts';
import { RoundRobinScheduler } from './scheduler.ts';

function createUnit(id: string): Unit {
  return {
    id,
    type: 'test',
    coord: { q: 0, r: 0 },
    faction: 'none',
    stats: {
      health: 1,
      attackDamage: 0,
      attackRange: 1,
      defense: 0,
      movementRange: 1
    }
  } as unknown as Unit;
}

describe('RoundRobinScheduler', () => {
  it('returns empty buckets for empty unit lists', () => {
    const scheduler = new RoundRobinScheduler();
    expect(scheduler.next([])).toEqual([]);
    expect(scheduler.next([])).toEqual([]);
  });

  it('never creates more buckets than units when unit count is small', () => {
    const scheduler = new RoundRobinScheduler();
    const units = [createUnit('a'), createUnit('b'), createUnit('c')];

    const processed = [scheduler.next(units), scheduler.next(units), scheduler.next(units)];
    const flattened = processed.flat();

    expect(flattened.length).toBe(units.length);
    expect(new Set(flattened).size).toBe(units.length);
  });

  it('distributes units evenly across buckets', () => {
    const scheduler = new RoundRobinScheduler();
    const units = Array.from({ length: 24 }, (_, index) => createUnit(`u${index}`));

    const buckets = [scheduler.next(units), scheduler.next(units), scheduler.next(units)];

    const sizes = buckets.map((bucket) => bucket.length);
    const max = Math.max(...sizes);
    const min = Math.min(...sizes);

    expect(max - min).toBeLessThanOrEqual(1);
  });

  it('rotates buckets to provide carry-over scheduling', () => {
    const scheduler = new RoundRobinScheduler();
    const units = Array.from({ length: 8 }, (_, index) => createUnit(`unit-${index}`));

    const batches = [
      scheduler.next(units),
      scheduler.next(units),
      scheduler.next(units),
      scheduler.next(units)
    ];

    expect(batches[0]).not.toEqual(batches[1]);
    expect(batches[1]).not.toEqual(batches[2]);
    expect(new Set(batches.flat()).size).toBe(units.length);
  });
});
