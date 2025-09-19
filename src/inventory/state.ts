import type { RolledLootItem } from '../loot/roll.ts';
import type { SaunojaItem } from '../units/saunoja.ts';
import type { EquipmentSlotId } from '../items/types.ts';

export interface InventoryItem extends SaunojaItem {
  readonly acquiredAt: number;
  readonly sourceTableId?: string;
  readonly sourceEntryId?: string;
}

export type InventoryEvent =
  | {
      readonly type: 'item-acquired';
      readonly item: InventoryItem;
      readonly equipped: boolean;
      readonly unitId?: string;
      readonly stashSize: number;
    }
  | {
      readonly type: 'item-equipped';
      readonly item: InventoryItem;
      readonly unitId: string;
      readonly fromStash: boolean;
      readonly stashSize: number;
    }
  | {
      readonly type: 'item-unequipped';
      readonly item: InventoryItem;
      readonly unitId: string;
      readonly slot: EquipmentSlotId;
      readonly stashSize: number;
    }
  | {
      readonly type: 'item-discarded';
      readonly item: InventoryItem;
      readonly stashSize: number;
    }
  | {
      readonly type: 'stash-updated';
      readonly stash: readonly InventoryItem[];
    }
  | {
      readonly type: 'settings-updated';
      readonly autoEquip: boolean;
    };

export type InventoryListener = (event: InventoryEvent) => void;

export interface InventoryStateOptions {
  readonly storageKey?: string;
  readonly now?: () => number;
  readonly maxStashSize?: number;
  readonly autoEquip?: boolean;
}

export interface AcquisitionOptions {
  readonly unitId?: string;
  readonly autoEquip?: boolean;
  readonly sourceTableId?: string;
  readonly sourceEntryId?: string;
  readonly equip?: (unitId: string, item: SaunojaItem) => boolean;
}

export interface InventoryReceipt {
  readonly item: InventoryItem;
  readonly equipped: boolean;
  readonly stashIndex?: number;
}

type SerializedInventory = {
  readonly autoEquip?: boolean;
  readonly stash?: readonly (InventoryItem & { readonly acquiredAt: number })[];
};

function getStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalWithStorage.localStorage ?? null;
  } catch (error) {
    console.warn('Unable to access localStorage for inventory persistence', error);
    return null;
  }
}

function safeLoad<T>(storage: Storage, key: string): T | undefined {
  const raw = storage.getItem(key);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse persisted inventory for "${key}", clearing.`, error);
    storage.removeItem(key);
    return undefined;
  }
}

function sanitizeItem(
  source: SaunojaItem,
  acquiredAt: number,
  context?: { tableId?: string; entryId?: string }
): InventoryItem {
  const baseQuantity = Number.isFinite(source.quantity) ? (source.quantity as number) : 1;
  const quantity = Math.max(1, Math.round(baseQuantity));
  const rarity = typeof source.rarity === 'string' ? source.rarity.trim() : undefined;
  const icon = typeof source.icon === 'string' ? source.icon : undefined;
  const description = typeof source.description === 'string' ? source.description : undefined;
  return {
    id: source.id,
    name: source.name,
    description,
    icon,
    rarity,
    quantity,
    acquiredAt,
    sourceTableId: context?.tableId,
    sourceEntryId: context?.entryId
  } satisfies InventoryItem;
}

export class InventoryState {
  private readonly listeners = new Set<InventoryListener>();
  private readonly storageKey: string;
  private readonly now: () => number;
  private readonly maxStashSize: number;
  private readonly storage: Storage | null;

  private autoEquip: boolean;
  private stash: InventoryItem[] = [];

  constructor(options: InventoryStateOptions = {}) {
    this.storageKey = options.storageKey ?? 'autobattles:inventory';
    this.now = typeof options.now === 'function' ? options.now : () => Date.now();
    this.maxStashSize = Math.max(1, Math.floor(options.maxStashSize ?? 24));
    this.storage = getStorage();
    this.autoEquip = options.autoEquip ?? true;
    this.load();
  }

  private load(): void {
    if (!this.storage) {
      return;
    }
    const data = safeLoad<SerializedInventory>(this.storage, this.storageKey);
    if (!data) {
      return;
    }
    if (typeof data.autoEquip === 'boolean') {
      this.autoEquip = data.autoEquip;
    }
    if (Array.isArray(data.stash)) {
      const restored: InventoryItem[] = [];
      for (const entry of data.stash) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const { id, name, quantity } = entry as InventoryItem;
        if (typeof id !== 'string' || typeof name !== 'string') {
          continue;
        }
        const timestamp = Number.isFinite(entry.acquiredAt) ? (entry.acquiredAt as number) : this.now();
        restored.push(
          sanitizeItem(
            {
              id,
              name,
              description: entry.description,
              icon: entry.icon,
              rarity: entry.rarity,
              quantity
            },
            timestamp,
            { tableId: entry.sourceTableId, entryId: entry.sourceEntryId }
          )
        );
      }
      this.stash = restored.slice(0, this.maxStashSize);
    }
  }

  private persist(): void {
    if (!this.storage) {
      return;
    }
    const payload: SerializedInventory = {
      autoEquip: this.autoEquip,
      stash: this.stash.map((item) => ({ ...item }))
    };
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(payload));
    } catch (error) {
      console.warn('Failed to persist inventory state', error);
    }
  }

  private emit(event: InventoryEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  on(listener: InventoryListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isAutoEquipEnabled(): boolean {
    return this.autoEquip;
  }

  setAutoEquip(enabled: boolean): void {
    if (this.autoEquip === enabled) {
      return;
    }
    this.autoEquip = enabled;
    this.persist();
    this.emit({ type: 'settings-updated', autoEquip: this.autoEquip });
  }

  getStash(): readonly InventoryItem[] {
    return this.stash.map((item) => ({ ...item }));
  }

  getStashSize(): number {
    return this.stash.length;
  }

  addLoot(drop: RolledLootItem, options: AcquisitionOptions = {}): InventoryReceipt {
    return this.addItem({ ...drop.item }, {
      ...options,
      sourceTableId: options.sourceTableId,
      sourceEntryId: options.sourceEntryId ?? drop.entryId
    });
  }

  addItem(item: SaunojaItem, options: AcquisitionOptions = {}): InventoryReceipt {
    const timestamp = Math.max(0, Math.round(this.now()));
    const entry = sanitizeItem(item, timestamp, {
      tableId: options.sourceTableId,
      entryId: options.sourceEntryId
    });
    const preferEquip = options.autoEquip ?? this.autoEquip;
    let equipped = false;

    if (preferEquip && options.unitId && typeof options.equip === 'function') {
      try {
        equipped = options.equip(options.unitId, entry);
      } catch (error) {
        console.warn('Failed to auto-equip inventory item', { item: entry, error });
      }
      if (equipped) {
        this.emit({
          type: 'item-acquired',
          item: entry,
          equipped: true,
          unitId: options.unitId,
          stashSize: this.stash.length
        });
        this.persist();
        return { item: entry, equipped: true } satisfies InventoryReceipt;
      }
    }

    this.stash.push(entry);
    if (this.stash.length > this.maxStashSize) {
      const overflow = this.stash.splice(0, this.stash.length - this.maxStashSize);
      if (overflow.length > 0) {
        console.warn('Inventory stash full, trimming oldest items', overflow);
      }
    }
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({
      type: 'item-acquired',
      item: entry,
      equipped: false,
      unitId: options.unitId,
      stashSize: this.stash.length
    });
    return { item: entry, equipped: false, stashIndex: this.stash.length - 1 } satisfies InventoryReceipt;
  }

  equipFromStash(index: number, unitId: string, equip: (unitId: string, item: SaunojaItem) => boolean): boolean {
    if (index < 0 || index >= this.stash.length) {
      return false;
    }
    const target = this.stash[index];
    let equipped = false;
    try {
      equipped = equip(unitId, target);
    } catch (error) {
      console.warn('Failed to equip stash item', { item: target, error });
      equipped = false;
    }
    if (!equipped) {
      return false;
    }
    const [removed] = this.stash.splice(index, 1);
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({
      type: 'item-equipped',
      item: removed,
      unitId,
      fromStash: true,
      stashSize: this.stash.length
    });
    return true;
  }

  unequipToStash(
    unitId: string,
    slot: EquipmentSlotId,
    unequip: (unitId: string, slot: EquipmentSlotId) => SaunojaItem | null | undefined
  ): boolean {
    if (this.stash.length >= this.maxStashSize) {
      return false;
    }
    let removed: SaunojaItem | null = null;
    try {
      const result = unequip(unitId, slot);
      removed = result ?? null;
    } catch (error) {
      console.warn('Failed to unequip item', { unitId, slot, error });
      removed = null;
    }
    if (!removed) {
      return false;
    }
    const timestamp = Math.max(0, Math.round(this.now()));
    const entry = sanitizeItem(removed, timestamp);
    this.stash.push(entry);
    if (this.stash.length > this.maxStashSize) {
      this.stash.splice(0, this.stash.length - this.maxStashSize);
    }
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({
      type: 'item-unequipped',
      item: entry,
      unitId,
      slot,
      stashSize: this.stash.length
    });
    return true;
  }

  discardFromStash(index: number): InventoryItem | null {
    if (index < 0 || index >= this.stash.length) {
      return null;
    }
    const [removed] = this.stash.splice(index, 1);
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({ type: 'item-discarded', item: removed, stashSize: this.stash.length });
    return removed;
  }
}
