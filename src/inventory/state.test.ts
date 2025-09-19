import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryState } from './state.ts';

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
    expect(equip).toHaveBeenCalledTimes(1);
    expect(inventory.getStashSize()).toBe(0);
  });

  it('adds items to stash when auto-equip is disabled', () => {
    const equip = vi.fn().mockReturnValue(true);
    const inventory = new InventoryState({ now: () => 600, autoEquip: false });
    const receipt = inventory.addItem(SAMPLE_ITEM, { unitId: 's1', equip });
    expect(receipt.equipped).toBe(false);
    expect(inventory.getStashSize()).toBe(1);
  });

  it('equips items from the stash and emits events', () => {
    const equip = vi.fn().mockReturnValue(true);
    const inventory = new InventoryState({ now: () => 700 });
    inventory.addItem(SAMPLE_ITEM, { autoEquip: false });

    const events: string[] = [];
    const stop = inventory.on((event) => {
      events.push(event.type);
    });

    const equipped = inventory.equipFromStash(0, 's1', equip);
    expect(equipped).toBe(true);
    expect(equip).toHaveBeenCalledWith('s1', expect.objectContaining({ id: 'emberglass-arrow' }));
    expect(inventory.getStashSize()).toBe(0);
    expect(events).toContain('item-equipped');
    expect(events).toContain('stash-updated');
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
    const events: string[] = [];
    const stop = inventory.on((event) => {
      events.push(event.type);
    });

    const success = inventory.unequipToStash('unit-1', 'weapon', unequip);
    expect(success).toBe(true);
    expect(unequip).toHaveBeenCalledWith('unit-1', 'weapon');
    expect(inventory.getStashSize()).toBe(1);
    expect(events).toContain('item-unequipped');
    stop();
  });
});
