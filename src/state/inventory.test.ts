import { describe, expect, it } from 'vitest';
import {
  createDefaultFilterState,
  selectInventoryView,
  type InventoryComparisonContext
} from './inventory.ts';
import type { InventoryItem } from '../inventory/state.ts';

function createItem(id: string, name: string, acquiredAt: number, overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id,
    name,
    quantity: 1,
    acquiredAt,
    ...overrides
  } as InventoryItem;
}

describe('selectInventoryView', () => {
  it('filters items by slot, rarity, and tags', () => {
    const stash: InventoryItem[] = [
      createItem('glacier-brand', 'Glacier Brand', 1000, { rarity: 'rare' }),
      createItem('midnight-bloodwine', 'Midnight Bloodwine', 1200, { rarity: 'epic' })
    ];
    const filters = createDefaultFilterState();
    (filters.slots as Set<string>).add('weapon');
    (filters.rarities as Set<string>).add('rare');
    const view = selectInventoryView({
      stash,
      inventory: [],
      filters,
      search: '',
      sort: 'newest',
      page: 1,
      pageSize: 24,
      collection: 'stash',
      comparisonContext: null
    });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.item.id).toBe('glacier-brand');
  });

  it('searches items by name and description', () => {
    const stash: InventoryItem[] = [
      createItem('aurora-distillate', 'Aurora Distillate', 1000, {
        description: 'infuses defense'
      }),
      createItem('emberglass-arrow', 'Emberglass Arrow', 1100)
    ];
    const filters = createDefaultFilterState();
    const view = selectInventoryView({
      stash,
      inventory: [],
      filters,
      search: 'defense',
      sort: 'newest',
      page: 1,
      pageSize: 24,
      collection: 'stash',
      comparisonContext: null
    });
    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.item.id).toBe('aurora-distillate');
  });

  it('sorts items alphabetically', () => {
    const stash: InventoryItem[] = [
      createItem('midnight-bloodwine', 'Midnight Bloodwine', 1000),
      createItem('aurora-distillate', 'Aurora Distillate', 1200)
    ];
    const filters = createDefaultFilterState();
    const view = selectInventoryView({
      stash,
      inventory: [],
      filters,
      search: '',
      sort: 'name',
      page: 1,
      pageSize: 24,
      collection: 'stash',
      comparisonContext: null
    });
    expect(view.items.map((entry) => entry.item.name)).toEqual([
      'Aurora Distillate',
      'Midnight Bloodwine'
    ]);
  });

  it('paginates large result sets', () => {
    const stash: InventoryItem[] = [
      createItem('aurora-distillate', 'Aurora Distillate', 1000),
      createItem('midnight-bloodwine', 'Midnight Bloodwine', 900)
    ];
    const filters = createDefaultFilterState();
    const view = selectInventoryView({
      stash,
      inventory: [],
      filters,
      search: '',
      sort: 'newest',
      page: 1,
      pageSize: 1,
      collection: 'stash',
      comparisonContext: null
    });
    expect(view.items).toHaveLength(1);
    expect(view.hasMore).toBe(true);
  });

  it('produces comparison previews using loadout context', () => {
    const stash: InventoryItem[] = [
      createItem('glacier-brand', 'Glacier Brand', 1000, { rarity: 'rare' }),
      createItem('emberglass-arrow', 'Emberglass Arrow', 1100, { rarity: 'rare', quantity: 1 })
    ];
    const filters = createDefaultFilterState();
    const context: InventoryComparisonContext = {
      baseStats: {
        health: 10,
        attackDamage: 2,
        attackRange: 1,
        movementRange: 3
      },
      loadout: [
        {
          id: 'emberglass-arrow',
          name: 'Emberglass Arrow',
          description: 'Ignites targets on impact',
          icon: undefined,
          rarity: 'rare',
          quantity: 1,
          slot: 'weapon',
          maxStacks: 1,
          modifiers: { attackDamage: 1, attackRange: 1 }
        }
      ],
      currentStats: {
        health: 10,
        attackDamage: 3,
        attackRange: 2,
        movementRange: 3
      }
    };
    const view = selectInventoryView({
      stash,
      inventory: [],
      filters,
      search: '',
      sort: 'newest',
      page: 1,
      pageSize: 24,
      collection: 'stash',
      comparisonContext: context
    });
    const glacierPreview = view.items.find((entry) => entry.item.id === 'glacier-brand')?.comparison;
    expect(glacierPreview?.canEquip).toBe(false);
    expect(glacierPreview?.reason).toBe('slot-occupied');
    const emberPreview = view.items.find((entry) => entry.item.id === 'emberglass-arrow')?.comparison;
    expect(emberPreview?.canEquip).toBe(true);
    const attackDelta = emberPreview?.stats.find((stat) => stat.stat === 'attackDamage');
    expect(attackDelta?.delta).toBeGreaterThanOrEqual(0);
  });
});
