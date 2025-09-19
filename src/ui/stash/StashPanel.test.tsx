import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createStashPanel } from './StashPanel.tsx';
import type { InventoryPanelView } from '../../state/inventory.ts';
import type { InventoryListItemView } from '../../state/inventory.ts';

const baseItem: InventoryListItemView = {
  item: {
    id: 'emberglass-arrow',
    name: 'Emberglass Arrow',
    quantity: 1,
    rarity: 'rare',
    acquiredAt: 1000
  },
  index: 0,
  location: 'stash',
  metadata: {
    slot: 'weapon',
    slotLabel: 'Primary Armament',
    rarity: 'rare',
    rarityRank: 3,
    tags: ['damage'],
    acquiredAt: 1000
  },
  comparison: {
    slot: 'weapon',
    canEquip: true,
    equipped: null,
    projected: {
      id: 'emberglass-arrow',
      name: 'Emberglass Arrow',
      quantity: 1,
      rarity: 'rare'
    },
    stats: [
      { stat: 'attackDamage', current: 3, projected: 4, delta: 1 },
      { stat: 'attackRange', current: 2, projected: 3, delta: 1 }
    ]
  }
};

function buildView(overrides: Partial<InventoryPanelView> = {}): InventoryPanelView {
  return {
    collection: 'stash',
    collections: [
      { id: 'stash', label: 'Quartermaster Stash', count: 1, active: true },
      { id: 'inventory', label: 'Ready Inventory', count: 0, active: false }
    ],
    filters: {
      slots: [{ id: 'weapon', label: 'Weapon', count: 1, active: false }],
      rarities: [{ id: 'rare', label: 'Rare', count: 1, active: false }],
      tags: [{ id: 'damage', label: 'Damage', count: 1, active: false }]
    },
    items: [baseItem],
    total: 1,
    filteredTotal: 1,
    search: '',
    sort: 'newest',
    hasMore: false,
    emptyMessage: 'Empty stash',
    ...overrides
  } satisfies InventoryPanelView;
}

describe('createStashPanel', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
    vi.useRealTimers();
  });

  it('renders items, filters, and actions', () => {
    const callbacks = {
      onClose: vi.fn(),
      onCollectionChange: vi.fn(),
      onFilterToggle: vi.fn(),
      onSearchChange: vi.fn(),
      onSortChange: vi.fn(),
      onLoadMore: vi.fn(),
      onItemEquip: vi.fn(),
      onItemTransfer: vi.fn(),
      onItemTrash: vi.fn()
    };
    const panel = createStashPanel(callbacks);
    container.appendChild(panel.element);

    const view = buildView();
    panel.render(view);

    expect(panel.element.querySelectorAll('ul li[role="listitem"]')).toHaveLength(1);
    expect(panel.element.textContent).toContain('Quartermaster Stash');

    const filterButton = panel.element.querySelector('button[class*="chip"]');
    expect(filterButton).not.toBeNull();
    filterButton?.dispatchEvent(new Event('click'));
    expect(callbacks.onFilterToggle).toHaveBeenCalledWith('slots', 'weapon');

    const searchInput = panel.element.querySelector('input[type="search"]');
    expect(searchInput).not.toBeNull();
    searchInput!.value = 'arrow';
    searchInput!.dispatchEvent(new Event('input'));
    expect(callbacks.onSearchChange).toHaveBeenCalledWith('arrow');

    const equipButton = panel.element.querySelector('button[class*="primary"]');
    expect(equipButton).not.toBeNull();
    equipButton?.dispatchEvent(new Event('click'));
    expect(callbacks.onItemEquip).toHaveBeenCalledTimes(1);

    const transferButton = panel.element.querySelectorAll('button[class*="action"]')[1];
    transferButton.dispatchEvent(new Event('click'));
    expect(callbacks.onItemTransfer).toHaveBeenCalledTimes(1);

    vi.useFakeTimers();
    const trashButton = panel.element.querySelector(`button[class*="danger"]`);
    trashButton?.dispatchEvent(new Event('click'));
    expect(callbacks.onItemTrash).not.toHaveBeenCalled();
    trashButton?.dispatchEvent(new Event('click'));
    expect(callbacks.onItemTrash).toHaveBeenCalledTimes(1);
  });

  it('toggles collection view and load more button', () => {
    const callbacks = {
      onClose: vi.fn(),
      onCollectionChange: vi.fn(),
      onFilterToggle: vi.fn(),
      onSearchChange: vi.fn(),
      onSortChange: vi.fn(),
      onLoadMore: vi.fn(),
      onItemEquip: vi.fn(),
      onItemTransfer: vi.fn(),
      onItemTrash: vi.fn()
    };
    const panel = createStashPanel(callbacks);
    container.appendChild(panel.element);

    const view = buildView({
      hasMore: true,
      collections: [
        { id: 'stash', label: 'Quartermaster Stash', count: 1, active: true },
        { id: 'inventory', label: 'Ready Inventory', count: 0, active: false }
      ]
    });
    panel.render(view);

    const loadMore = panel.element.querySelector('button[class*="loadMore"]');
    expect(loadMore).not.toBeNull();
    loadMore?.dispatchEvent(new Event('click'));
    expect(callbacks.onLoadMore).toHaveBeenCalledTimes(1);

    const readyButton = panel.element.querySelectorAll('button[data-active]')[1];
    readyButton.dispatchEvent(new Event('click'));
    expect(callbacks.onCollectionChange).toHaveBeenCalledWith('inventory');
  });
});
