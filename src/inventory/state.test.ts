import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InventoryState,
  type InventoryEvent,
  type InventoryComparison,
  type EquipAttemptResult
} from './state.ts';

const SAMPLE_ITEM = {
  id: 'emberglass-arrow',
  name: 'Emberglass Arrow',
  quantity: 2,
  rarity: 'rare' as const
};

beforeEach(() => {
  localStorage.clear();
});

describe('InventoryState', () => {
  it('persists stash items across sessions', () => {
    const inventory = new InventoryState({ now: () => 1000 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    const snapshot = inventory.getStash();
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].quantity).toBe(2);

    const reload = new InventoryState({ now: () => 2000 });
    expect(reload.getStash()).toHaveLength(1);
    expect(reload.getStash()[0].id).toBe('emberglass-arrow');
    expect(reload.isAutoEquipEnabled()).toBe(true);
  });

  it('auto-equips items when a handler succeeds', () => {
    const equip = vi.fn().mockReturnValue(true);
    const inventory = new InventoryState({ now: () => 500 });
    const receipt = inventory.addItem(SAMPLE_ITEM, { unitId: 's1', equip });
    expect(receipt.equipped).toBe(true);
    expect(receipt.location).toBe('equipped');
    expect(equip).toHaveBeenCalledTimes(1);
    expect(inventory.getStashSize()).toBe(0);
  });

  it('adds items to stash when auto-equip is disabled', () => {
    const equip = vi.fn().mockReturnValue(true);
    const inventory = new InventoryState({ now: () => 600, autoEquip: false });
    const receipt = inventory.addItem(SAMPLE_ITEM, { unitId: 's1', equip });
    expect(receipt.equipped).toBe(false);
    expect(receipt.location).toBe('stash');
    expect(inventory.getStashSize()).toBe(1);
  });

  it('equips items from the stash and emits events', () => {
    const equip = vi.fn().mockReturnValue(true);
    const inventory = new InventoryState({ now: () => 700 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });

    const events: InventoryEvent[] = [];
    const stop = inventory.on((event) => {
      events.push(event);
    });

    const equipped = inventory.equipFromStash(0, 's1', equip);
    expect(equipped).toBe(true);
    expect(equip).toHaveBeenCalledWith('s1', expect.objectContaining({ id: 'emberglass-arrow' }));
    expect(inventory.getStashSize()).toBe(0);
    expect(events.map((event) => event.type)).toContain('item-equipped');
    const equipEvent = events.find((event) => event.type === 'item-equipped');
    expect(equipEvent).toBeDefined();
    expect(equipEvent?.from).toBe('stash');
    expect(equipEvent?.comparison).toBeUndefined();
    stop();
  });

  it('discards items from the stash', () => {
    const inventory = new InventoryState({ now: () => 900 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    const removed = inventory.discardFromStash(0);
    expect(removed?.id).toBe('emberglass-arrow');
    expect(inventory.getStashSize()).toBe(0);
  });

  it('moves unequipped items back into the stash', () => {
    const inventory = new InventoryState({ now: () => 1000 });
    const unequip = vi
      .fn()
      .mockReturnValue({ id: 'glacier-brand', name: 'Glacier Brand', quantity: 1 });
    const events: InventoryEvent[] = [];
    const stop = inventory.on((event) => {
      events.push(event);
    });

    const success = inventory.unequipToStash('unit-1', 'weapon', unequip);
    expect(success).toBe(true);
    expect(unequip).toHaveBeenCalledWith('unit-1', 'weapon');
    expect(inventory.getStashSize()).toBe(1);
    const event = events.find((entry) => entry.type === 'item-unequipped');
    expect(event?.to).toBe('stash');
    stop();
  });

  it('still unequips items when the stash is already at capacity', () => {
    const inventory = new InventoryState({ now: () => 1500, maxStashSize: 1 });
    inventory.addItem(
      { id: 'old-relic', name: 'Old Relic', quantity: 1 },
      { autoEquip: false }
    );

    const unequip = vi
      .fn()
      .mockReturnValue({ id: 'fresh-find', name: 'Fresh Find', quantity: 1 });
    const events: InventoryEvent[] = [];
    const stop = inventory.on((event) => {
      events.push(event);
    });

    const success = inventory.unequipToStash('unit-7', 'weapon', unequip);
    expect(success).toBe(true);
    expect(unequip).toHaveBeenCalledWith('unit-7', 'weapon');
    expect(inventory.getStash()).toHaveLength(1);
    expect(inventory.getStash()[0].id).toBe('fresh-find');
    const event = events.find((entry) => entry.type === 'item-unequipped');
    expect(event?.to).toBe('stash');
    stop();
  });

  it('moves items between stash and ready inventory', () => {
    const inventory = new InventoryState({ now: () => 1100 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    const moved = inventory.moveToInventory(0);
    expect(moved?.id).toBe('emberglass-arrow');
    expect(inventory.getInventory()).toHaveLength(1);
    const restored = inventory.moveToStash(0);
    expect(restored?.id).toBe('emberglass-arrow');
    expect(inventory.getInventory()).toHaveLength(0);
    expect(inventory.getStash()).toHaveLength(1);
  });

  it('supports equipping from the ready inventory and emits comparison data', () => {
    const comparison: InventoryComparison = {
      slot: 'weapon',
      previous: null,
      next: { id: 'emberglass-arrow', name: 'Emberglass Arrow', quantity: 2, rarity: 'rare' },
      deltas: [{ stat: 'attackDamage', delta: 2 }]
    };
    const equipResult = { success: true, comparison } satisfies EquipAttemptResult;
    const equip = vi.fn().mockReturnValue(equipResult);
    const inventory = new InventoryState({ now: () => 1200 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    inventory.moveToInventory(0);

    const events: InventoryEvent[] = [];
    const stop = inventory.on((event) => events.push(event));

    const success = inventory.equipFromInventory(0, 's1', equip);
    expect(success).toBe(true);
    expect(inventory.getInventory()).toHaveLength(0);
    const equipEvent = events.find((event) => event.type === 'item-equipped');
    expect(equipEvent?.from).toBe('inventory');
    expect(equipEvent?.comparison).toEqual(comparison);
    stop();
  });

  it('discards items from the ready inventory', () => {
    const inventory = new InventoryState({ now: () => 1300 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    inventory.moveToInventory(0);
    const removed = inventory.discardFromInventory(0);
    expect(removed?.id).toBe('emberglass-arrow');
    expect(inventory.getInventory()).toHaveLength(0);
  });
});
