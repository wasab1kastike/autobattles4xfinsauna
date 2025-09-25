import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  InventoryState,
  type InventoryEvent,
  type InventoryComparison,
  type EquipAttemptResult
} from './state.ts';
import { rankEquipmentCandidates } from '../items/equip.ts';

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

  it('stores returned items when auto-equip replaces gear', () => {
    const inventory = new InventoryState({ now: () => 550 });
    const equip = vi.fn().mockReturnValue({
      success: true,
      returnedItem: { id: 'glacier-brand', name: 'Glacier Brand', quantity: 1 }
    } satisfies EquipAttemptResult);
    const receipt = inventory.addItem(SAMPLE_ITEM, { unitId: 's1', equip });
    expect(receipt.equipped).toBe(true);
    expect(inventory.getStashSize()).toBe(1);
    expect(inventory.getStash()[0]?.id).toBe('glacier-brand');
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

  it('returns replaced stash items to the stash', () => {
    const equip = vi.fn().mockReturnValue({
      success: true,
      returnedItem: { id: 'glacier-brand', name: 'Glacier Brand', quantity: 1 }
    } satisfies EquipAttemptResult);
    const inventory = new InventoryState({ now: () => 720 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });

    const equipped = inventory.equipFromStash(0, 's1', equip);
    expect(equipped).toBe(true);
    expect(inventory.getStashSize()).toBe(1);
    expect(inventory.getStash()[0]?.id).toBe('glacier-brand');
  });

  it('falls back to the next best stash upgrade when the top choice fails', () => {
    const inventory = new InventoryState({ now: () => 780 });
    inventory.addItem(
      { id: 'emberglass-arrow', name: 'Emberglass Arrow', quantity: 1, rarity: 'legendary' },
      { autoEquip: false }
    );
    inventory.addItem(
      { id: 'glacier-brand', name: 'Glacier Brand', quantity: 1, rarity: 'rare' },
      { autoEquip: false }
    );

    const order = rankEquipmentCandidates(inventory.getStash(), 'weapon');
    expect(order).toEqual([0, 1]);

    let equipped = false;
    const attempts: boolean[] = [];
    for (const index of order) {
      const result = inventory.equipFromStash(index, 's1', (_unit, entry) =>
        entry.id === 'emberglass-arrow'
          ? ({ success: false, reason: 'slot-occupied' } satisfies EquipAttemptResult)
          : ({ success: true } satisfies EquipAttemptResult)
      );
      attempts.push(result);
      if (result) {
        equipped = true;
        break;
      }
    }

    expect(attempts[0]).toBe(false);
    expect(equipped).toBe(true);
    const remaining = inventory.getStash();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).toBe('emberglass-arrow');
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

  it('returns replaced inventory items to the ready inventory', () => {
    const equip = vi.fn().mockReturnValue({
      success: true,
      returnedItem: { id: 'glacier-brand', name: 'Glacier Brand', quantity: 1 }
    } satisfies EquipAttemptResult);
    const inventory = new InventoryState({ now: () => 1220 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });
    inventory.moveToInventory(0);

    const equipped = inventory.equipFromInventory(0, 's1', equip);
    expect(equipped).toBe(true);
    expect(inventory.getInventory()).toHaveLength(1);
    expect(inventory.getInventory()[0]?.id).toBe('glacier-brand');
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
