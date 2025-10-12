import type { RolledLootItem } from '../loot/roll.ts';
import type { SaunojaItem } from '../units/saunoja.ts';
import type { EquipmentSlotId } from '../items/types.ts';

export type InventoryCollection = 'stash' | 'inventory';

export type InventoryLocation = InventoryCollection | 'equipped';

export type InventoryStatId =
  | 'health'
  | 'attackDamage'
  | 'attackRange'
  | 'movementRange'
  | 'defense'
  | 'shield';

export interface InventoryItemSummary {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly rarity?: string;
}

export interface InventoryStatDelta {
  readonly stat: InventoryStatId;
  readonly delta: number;
}

export interface InventoryComparison {
  readonly slot: EquipmentSlotId | null;
  readonly previous: InventoryItemSummary | null;
  readonly next: InventoryItemSummary | null;
  readonly deltas: readonly InventoryStatDelta[];
  readonly reason?: string;
}

export interface EquipAttemptResult {
  readonly success: boolean;
  readonly comparison?: InventoryComparison;
  readonly reason?: string;
}

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
      readonly location: InventoryLocation;
      readonly unitId?: string;
      readonly stashSize: number;
      readonly inventorySize: number;
    }
  | {
      readonly type: 'item-equipped';
      readonly item: InventoryItem;
      readonly unitId: string;
      readonly from: InventoryCollection;
      readonly stashSize: number;
      readonly inventorySize: number;
      readonly comparison?: InventoryComparison;
    }
  | {
      readonly type: 'item-unequipped';
      readonly item: InventoryItem;
      readonly unitId: string;
      readonly slot: EquipmentSlotId;
      readonly to: InventoryCollection;
      readonly stashSize: number;
      readonly inventorySize: number;
    }
  | {
      readonly type: 'item-discarded';
      readonly item: InventoryItem;
      readonly location: InventoryCollection;
      readonly stashSize: number;
      readonly inventorySize: number;
    }
  | {
      readonly type: 'item-moved';
      readonly item: InventoryItem;
      readonly from: InventoryCollection;
      readonly to: InventoryCollection;
      readonly stashSize: number;
      readonly inventorySize: number;
    }
  | {
      readonly type: 'stash-updated';
      readonly stash: readonly InventoryItem[];
    }
  | {
      readonly type: 'inventory-updated';
      readonly inventory: readonly InventoryItem[];
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
  readonly equip?: (unitId: string, item: InventoryItem) => boolean | EquipAttemptResult;
}

export interface InventoryReceipt {
  readonly item: InventoryItem;
  readonly equipped: boolean;
  readonly stashIndex?: number;
  readonly inventoryIndex?: number;
  readonly location: InventoryLocation;
}

type SerializedInventory = {
  readonly autoEquip?: boolean;
  readonly stash?: readonly (InventoryItem & { readonly acquiredAt: number })[];
  readonly inventory?: readonly (InventoryItem & { readonly acquiredAt: number })[];
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
  private inventory: InventoryItem[] = [];

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

    if (Array.isArray(data.inventory)) {
      const restoredInventory: InventoryItem[] = [];
      for (const entry of data.inventory) {
        if (!entry || typeof entry !== 'object') {
          continue;
        }
        const { id, name, quantity } = entry as InventoryItem;
        if (typeof id !== 'string' || typeof name !== 'string') {
          continue;
        }
        const timestamp = Number.isFinite(entry.acquiredAt)
          ? (entry.acquiredAt as number)
          : this.now();
        restoredInventory.push(
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
      this.inventory = restoredInventory;
    }
  }

  private persist(): void {
    if (!this.storage) {
      return;
    }
    const payload: SerializedInventory = {
      autoEquip: this.autoEquip,
      stash: this.stash.map((item) => ({ ...item })),
      inventory: this.inventory.map((item) => ({ ...item }))
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

  private normalizeEquipResult(result: boolean | EquipAttemptResult): EquipAttemptResult {
    if (typeof result === 'boolean') {
      return { success: result } satisfies EquipAttemptResult;
    }
    if (!result || typeof result !== 'object') {
      return { success: false } satisfies EquipAttemptResult;
    }
    return {
      success: Boolean(result.success),
      comparison: result.comparison,
      reason: result.reason
    } satisfies EquipAttemptResult;
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

  getInventory(): readonly InventoryItem[] {
    return this.inventory.map((item) => ({ ...item }));
  }

  getInventorySize(): number {
    return this.inventory.length;
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
    let equipOutcome: EquipAttemptResult = { success: false };

    if (preferEquip && options.unitId && typeof options.equip === 'function') {
      try {
        equipOutcome = this.normalizeEquipResult(options.equip(options.unitId, entry));
      } catch (error) {
        console.warn('Failed to auto-equip inventory item', { item: entry, error });
        equipOutcome = { success: false } satisfies EquipAttemptResult;
      }
      if (equipOutcome.success) {
        this.persist();
        this.emit({
          type: 'item-acquired',
          item: entry,
          equipped: true,
          location: 'equipped',
          unitId: options.unitId,
          stashSize: this.stash.length,
          inventorySize: this.inventory.length
        });
        return {
          item: entry,
          equipped: true,
          location: 'equipped'
        } satisfies InventoryReceipt;
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
      location: 'stash',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
    });
    return {
      item: entry,
      equipped: false,
      location: 'stash',
      stashIndex: this.stash.length - 1
    } satisfies InventoryReceipt;
  }

  equipFromStash(
    index: number,
    unitId: string,
    equip: (unitId: string, item: InventoryItem) => boolean | EquipAttemptResult
  ): boolean {
    if (index < 0 || index >= this.stash.length) {
      return false;
    }
    const target = this.stash[index];
    let outcome: EquipAttemptResult = { success: false };
    try {
      outcome = this.normalizeEquipResult(equip(unitId, target));
    } catch (error) {
      console.warn('Failed to equip stash item', { item: target, error });
      outcome = { success: false } satisfies EquipAttemptResult;
    }
    if (!outcome.success) {
      return false;
    }
    const [removed] = this.stash.splice(index, 1);
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({
      type: 'item-equipped',
      item: removed,
      unitId,
      from: 'stash',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length,
      comparison: outcome.comparison
    });
    return true;
  }

  equipFromInventory(
    index: number,
    unitId: string,
    equip: (unitId: string, item: InventoryItem) => boolean | EquipAttemptResult
  ): boolean {
    if (index < 0 || index >= this.inventory.length) {
      return false;
    }
    const target = this.inventory[index];
    let outcome: EquipAttemptResult = { success: false };
    try {
      outcome = this.normalizeEquipResult(equip(unitId, target));
    } catch (error) {
      console.warn('Failed to equip inventory item', { item: target, error });
      outcome = { success: false } satisfies EquipAttemptResult;
    }
    if (!outcome.success) {
      return false;
    }
    const [removed] = this.inventory.splice(index, 1);
    this.persist();
    this.emit({ type: 'inventory-updated', inventory: this.getInventory() });
    this.emit({
      type: 'item-equipped',
      item: removed,
      unitId,
      from: 'inventory',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length,
      comparison: outcome.comparison
    });
    return true;
  }

  moveToInventory(index: number): InventoryItem | null {
    if (index < 0 || index >= this.stash.length) {
      return null;
    }
    const [moved] = this.stash.splice(index, 1);
    this.inventory.push(moved);
    this.persist();
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({ type: 'inventory-updated', inventory: this.getInventory() });
    this.emit({
      type: 'item-moved',
      item: moved,
      from: 'stash',
      to: 'inventory',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
    });
    return moved;
  }

  moveToStash(index: number): InventoryItem | null {
    if (this.stash.length >= this.maxStashSize) {
      return null;
    }
    if (index < 0 || index >= this.inventory.length) {
      return null;
    }
    const [moved] = this.inventory.splice(index, 1);
    this.stash.push(moved);
    if (this.stash.length > this.maxStashSize) {
      this.stash.splice(0, this.stash.length - this.maxStashSize);
    }
    this.persist();
    this.emit({ type: 'inventory-updated', inventory: this.getInventory() });
    this.emit({ type: 'stash-updated', stash: this.getStash() });
    this.emit({
      type: 'item-moved',
      item: moved,
      from: 'inventory',
      to: 'stash',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
    });
    return moved;
  }

  discardFromInventory(index: number): InventoryItem | null {
    if (index < 0 || index >= this.inventory.length) {
      return null;
    }
    const [removed] = this.inventory.splice(index, 1);
    this.persist();
    this.emit({ type: 'inventory-updated', inventory: this.getInventory() });
    this.emit({
      type: 'item-discarded',
      item: removed,
      location: 'inventory',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
    });
    return removed;
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
      to: 'stash',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
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
    this.emit({
      type: 'item-discarded',
      item: removed,
      location: 'stash',
      stashSize: this.stash.length,
      inventorySize: this.inventory.length
    });
    return removed;
  }
}
