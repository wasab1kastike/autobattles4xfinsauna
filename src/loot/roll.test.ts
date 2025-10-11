import { describe, expect, it, vi } from 'vitest';
import { rollLoot } from './roll.ts';
import type { LootTable } from './tables.ts';

function sequenceRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1] ?? 0;
    index += 1;
    return value;
  };
}

describe('rollLoot', () => {
  it('falls back to base loot table when faction is unknown', () => {
    const result = rollLoot({ factionId: 'unknown-faction', rolls: 1, random: () => 0.01 });
    expect(result.tableId).toBe('general-salvage');
    expect(result.rolls.length).toBe(1);
    expect(result.rolls[0].item.name).toBeDefined();
  });

  it('returns an empty result when roll count is zero', () => {
    const table: LootTable = {
      id: 'test-zero',
      label: 'Zero Table',
      entries: [
        { id: 'any', name: 'Any Item', rarity: 'common', quantity: 1, weight: 1 }
      ]
    };

    const random = vi.fn(() => 0.5);
    const result = rollLoot({ factionId: 'enemy', table, random, rolls: 0 });

    expect(result.rolls).toHaveLength(0);
    expect(random).not.toHaveBeenCalled();
  });

  it('weights entries by rarity before rolling', () => {
    const table: LootTable = {
      id: 'test-table',
      label: 'Test Table',
      entries: [
        { id: 'common', name: 'Common Trinket', rarity: 'common', quantity: 1, weight: 1 },
        { id: 'legendary', name: 'Legendary Relic', rarity: 'legendary', quantity: 1, weight: 1 }
      ]
    };

    const weightedRare = rollLoot({
      factionId: 'enemy',
      table,
      // A high roll that would select the second entry if rarity weighting did
      // not reduce the legendary odds.
      random: sequenceRandom([0.9]),
      rolls: 1
    });

    expect(weightedRare.rolls[0].entryId).toBe('common');

    const guaranteedLegendary = rollLoot({
      factionId: 'enemy',
      table,
      random: sequenceRandom([0.99]),
      rolls: 1
    });
    expect(guaranteedLegendary.rolls[0].entryId).toBe('legendary');
  });

  it('respects quantity ranges when producing loot', () => {
    const table: LootTable = {
      id: 'quantity-table',
      label: 'Quantity Table',
      entries: [
        { id: 'bundle', name: 'Bundle', rarity: 'uncommon', quantity: { min: 2, max: 4 }, weight: 1 }
      ]
    };

    const roll = rollLoot({
      factionId: 'enemy',
      table,
      random: sequenceRandom([0.4, 0.8]),
      rolls: 2
    });

    expect(roll.rolls).toHaveLength(2);
    expect(roll.rolls[0].quantity).toBeGreaterThanOrEqual(2);
    expect(roll.rolls[0].quantity).toBeLessThanOrEqual(4);
  });
});
