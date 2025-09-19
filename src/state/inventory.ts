import type {
  InventoryCollection,
  InventoryItem,
  InventoryItemSummary,
  InventoryStatId
} from '../inventory/state.ts';
import { getItemDefinition, getSlotDefinition } from '../items/equip.ts';
import {
  EQUIPMENT_SLOT_IDS,
  type EquipmentSlotId,
  type EquippedItem,
  type EquipmentModifier
} from '../items/types.ts';
import type { SaunojaStatBlock } from '../units/saunoja.ts';
import { applyEquipment } from '../unit/calc.ts';

export type InventorySort = 'newest' | 'oldest' | 'rarity' | 'name';

export interface InventoryFilterState {
  readonly slots: ReadonlySet<string>;
  readonly rarities: ReadonlySet<string>;
  readonly tags: ReadonlySet<string>;
}

export interface FilterChip {
  readonly id: string;
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
}

export interface InventoryComparisonContext {
  readonly baseStats: SaunojaStatBlock;
  readonly loadout: readonly EquippedItem[];
  readonly currentStats?: SaunojaStatBlock;
}

export interface InventoryStatProjection {
  readonly stat: InventoryStatId;
  readonly delta: number;
  readonly current: number;
  readonly projected: number;
}

export interface InventoryComparisonPreview {
  readonly slot: EquipmentSlotId | null;
  readonly canEquip: boolean;
  readonly reason?: string;
  readonly equipped: InventoryItemSummary | null;
  readonly projected: InventoryItemSummary | null;
  readonly stats: readonly InventoryStatProjection[];
}

export interface InventoryItemMetadata {
  readonly slot: EquipmentSlotId | null;
  readonly slotLabel: string;
  readonly rarity: string;
  readonly rarityRank: number;
  readonly tags: readonly string[];
  readonly acquiredAt: number;
}

export interface InventoryListItemView {
  readonly item: InventoryItem;
  readonly index: number;
  readonly location: InventoryCollection;
  readonly metadata: InventoryItemMetadata;
  readonly comparison: InventoryComparisonPreview | null;
}

export interface InventoryCollectionSummary {
  readonly id: InventoryCollection;
  readonly label: string;
  readonly count: number;
  readonly active: boolean;
}

export interface InventoryFilterGroups {
  readonly slots: readonly FilterChip[];
  readonly rarities: readonly FilterChip[];
  readonly tags: readonly FilterChip[];
}

export interface InventoryPanelView {
  readonly collection: InventoryCollection;
  readonly collections: readonly InventoryCollectionSummary[];
  readonly filters: InventoryFilterGroups;
  readonly items: readonly InventoryListItemView[];
  readonly total: number;
  readonly filteredTotal: number;
  readonly search: string;
  readonly sort: InventorySort;
  readonly hasMore: boolean;
  readonly emptyMessage: string;
}

export interface InventorySelectorParams {
  readonly stash: readonly InventoryItem[];
  readonly inventory: readonly InventoryItem[];
  readonly filters: InventoryFilterState;
  readonly search: string;
  readonly sort: InventorySort;
  readonly page: number;
  readonly pageSize: number;
  readonly collection: InventoryCollection;
  readonly comparisonContext?: InventoryComparisonContext | null;
}

const COLLECTION_LABELS: Record<InventoryCollection, string> = {
  stash: 'Quartermaster Stash',
  inventory: 'Ready Inventory'
};

const EMPTY_MESSAGES: Record<InventoryCollection, string> = {
  stash: 'Your stash is empty. Conquer enemy elites to gather new equipment.',
  inventory: 'No gear staged. Move items into the ready inventory for quick equipping.'
};

const RARITY_ORDER: Record<string, number> = {
  mythic: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1
};

const STAT_KEYS: readonly InventoryStatId[] = [
  'health',
  'attackDamage',
  'attackRange',
  'movementRange',
  'defense',
  'shield'
];

const ITEM_TAGS: Record<string, readonly string[]> = {
  'birch-sap-satchel': ['healing', 'support'],
  'steamed-bandages': ['restoration', 'shielding'],
  'aurora-distillate': ['damage', 'defense'],
  'stolen-sauna-tokens': ['mobility'],
  'midnight-bloodwine': ['healing', 'damage'],
  'sauna-incense': ['range', 'focus'],
  'glacier-brand': ['damage'],
  'emberglass-arrow': ['damage', 'range'],
  'aurora-lattice': ['damage', 'range'],
  'emberglass-shard': ['damage', 'mobility'],
  'windstep-totem': ['mobility', 'defense'],
  'searing-chant-censer': ['damage', 'shielding'],
  'cracked-ice-amulet': ['defense'],
  'myrsky-charm': ['range', 'defense'],
  'frostwyrm-signet': ['shielding'],
  'spirit-oak-charm': ['healing', 'defense']
};

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeSet(source: ReadonlySet<string>): Set<string> {
  const next = new Set<string>();
  for (const entry of source) {
    const normalized = normalizeToken(entry);
    if (normalized) {
      next.add(normalized);
    }
  }
  return next;
}

function summarizeInventoryItem(item: InventoryItem, quantity?: number): InventoryItemSummary {
  return {
    id: item.id,
    name: item.name,
    quantity: typeof quantity === 'number' ? quantity : item.quantity,
    rarity: item.rarity
  } satisfies InventoryItemSummary;
}

function summarizeEquippedItem(item: EquippedItem | null): InventoryItemSummary | null {
  if (!item) {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    rarity: item.rarity
  } satisfies InventoryItemSummary;
}

function resolveTags(itemId: string): readonly string[] {
  return ITEM_TAGS[itemId] ?? [];
}

function resolveRarity(value?: string | null): { key: string; label: string; rank: number } {
  const normalized = normalizeToken(value) || 'common';
  const label = normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return {
    key: normalized,
    label,
    rank: RARITY_ORDER[normalized] ?? 0
  };
}

function resolveMetadata(item: InventoryItem): InventoryItemMetadata {
  const definition = getItemDefinition(item.id);
  if (!definition) {
    const rarity = resolveRarity(item.rarity);
    return {
      slot: null,
      slotLabel: 'Unassigned',
      rarity: rarity.key,
      rarityRank: rarity.rank,
      tags: resolveTags(item.id),
      acquiredAt: item.acquiredAt
    } satisfies InventoryItemMetadata;
  }
  const slotDef = getSlotDefinition(definition.slot);
  const rarity = resolveRarity(item.rarity);
  return {
    slot: definition.slot,
    slotLabel: slotDef.label,
    rarity: rarity.key,
    rarityRank: rarity.rank,
    tags: resolveTags(item.id),
    acquiredAt: item.acquiredAt
  } satisfies InventoryItemMetadata;
}

function toEquippedItem(
  item: InventoryItem,
  slot: EquipmentSlotId,
  maxStacks: number,
  modifiers: EquipmentModifier | undefined,
  quantity: number
): EquippedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    rarity: item.rarity,
    quantity,
    slot,
    maxStacks,
    modifiers: modifiers ?? ({} as EquipmentModifier)
  } satisfies EquippedItem;
}

function resolveStatValue(stats: SaunojaStatBlock, key: InventoryStatId): number {
  const value = stats[key as keyof SaunojaStatBlock];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value as number);
  }
  return 0;
}

function buildComparison(
  record: InternalRecord,
  context: InventoryComparisonContext
): InventoryComparisonPreview {
  const definition = getItemDefinition(record.item.id);
  if (!definition) {
    return {
      slot: null,
      canEquip: false,
      reason: 'unknown-item',
      equipped: null,
      projected: summarizeInventoryItem(record.item),
      stats: []
    } satisfies InventoryComparisonPreview;
  }

  const slot = definition.slot;
  const slotDef = getSlotDefinition(slot);
  const existing = context.loadout.find((entry) => entry.slot === slot) ?? null;
  const incomingQuantity = Math.max(1, Math.round(record.item.quantity));
  const maxStacks = Math.max(1, Math.floor(definition.maxStacks ?? slotDef.maxStacks));
  const totalQuantity = (existing?.quantity ?? 0) + incomingQuantity;
  const overflow = totalQuantity > maxStacks;

  if (existing && existing.id !== record.item.id) {
    return {
      slot,
      canEquip: false,
      reason: 'slot-occupied',
      equipped: summarizeEquippedItem(existing),
      projected: summarizeInventoryItem(record.item),
      stats: []
    } satisfies InventoryComparisonPreview;
  }

  if (overflow && (!existing || existing.id !== record.item.id)) {
    return {
      slot,
      canEquip: false,
      reason: 'stack-limit',
      equipped: summarizeEquippedItem(existing),
      projected: summarizeInventoryItem(
        record.item,
        Math.min(maxStacks, totalQuantity)
      ),
      stats: []
    } satisfies InventoryComparisonPreview;
  }

  const nextQuantity = Math.min(maxStacks, totalQuantity);
  const nextLoadout: EquippedItem[] = [];
  for (const entry of context.loadout) {
    if (entry.slot === slot) {
      continue;
    }
    nextLoadout.push({ ...entry });
  }
  const projected =
    existing && existing.id === record.item.id
      ? { ...existing, quantity: nextQuantity }
      : toEquippedItem(record.item, slot, maxStacks, definition.modifiers, nextQuantity);
  nextLoadout.push(projected);

  const currentStats = context.currentStats ?? applyEquipment(context.baseStats, context.loadout);
  const projectedStats = applyEquipment(context.baseStats, nextLoadout);

  const stats: InventoryStatProjection[] = STAT_KEYS.map((key) => {
    const current = resolveStatValue(currentStats, key);
    const projectedValue = resolveStatValue(projectedStats, key);
    return {
      stat: key,
      current,
      projected: projectedValue,
      delta: projectedValue - current
    } satisfies InventoryStatProjection;
  });

  return {
    slot,
    canEquip: true,
    equipped: summarizeEquippedItem(existing),
    projected: summarizeEquippedItem(projected),
    stats
  } satisfies InventoryComparisonPreview;
}

interface InternalRecord {
  readonly item: InventoryItem;
  readonly index: number;
  readonly location: InventoryCollection;
  readonly metadata: InventoryItemMetadata;
}

function buildRecords(
  items: readonly InventoryItem[],
  location: InventoryCollection
): InternalRecord[] {
  return items.map((item, index) => ({
    item,
    index,
    location,
    metadata: resolveMetadata(item)
  }));
}

function buildFilterChips(
  records: readonly InternalRecord[],
  filters: InventoryFilterState
): InventoryFilterGroups {
  const slotCounts = new Map<string, { label: string; count: number }>();
  const rarityCounts = new Map<string, { label: string; count: number; rank: number }>();
  const tagCounts = new Map<string, { label: string; count: number }>();

  for (const record of records) {
    const { metadata } = record;
    if (metadata.slot) {
      const key = metadata.slot;
      const current = slotCounts.get(key);
      if (current) {
        current.count += 1;
      } else {
        slotCounts.set(key, { label: metadata.slotLabel, count: 1 });
      }
    }
    const rarityLabel = metadata.rarity;
    const rarityDisplay = rarityLabel.charAt(0).toUpperCase() + rarityLabel.slice(1);
    const rarityCurrent = rarityCounts.get(rarityLabel);
    if (rarityCurrent) {
      rarityCurrent.count += 1;
    } else {
      rarityCounts.set(rarityLabel, {
        label: rarityDisplay,
        count: 1,
        rank: metadata.rarityRank
      });
    }

    for (const tag of metadata.tags) {
      const normalized = normalizeToken(tag);
      if (!normalized) {
        continue;
      }
      const display = tag
        .split(/[-_]/g)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(' ');
      const tagEntry = tagCounts.get(normalized);
      if (tagEntry) {
        tagEntry.count += 1;
      } else {
        tagCounts.set(normalized, { label: display, count: 1 });
      }
    }
  }

  const slotFilter = Array.from(slotCounts.entries())
    .sort((a, b) => {
      const orderA = EQUIPMENT_SLOT_IDS.indexOf(a[0] as EquipmentSlotId);
      const orderB = EQUIPMENT_SLOT_IDS.indexOf(b[0] as EquipmentSlotId);
      return orderA - orderB;
    })
    .map(([id, data]) => ({
      id,
      label: data.label,
      count: data.count,
      active: filters.slots.has(normalizeToken(id))
    } satisfies FilterChip));

  const rarityFilter = Array.from(rarityCounts.entries())
    .sort((a, b) => (b[1].rank ?? 0) - (a[1].rank ?? 0))
    .map(([id, data]) => ({
      id,
      label: data.label,
      count: data.count,
      active: filters.rarities.has(normalizeToken(id))
    } satisfies FilterChip));

  const tagFilter = Array.from(tagCounts.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([id, data]) => ({
      id,
      label: data.label,
      count: data.count,
      active: filters.tags.has(normalizeToken(id))
    } satisfies FilterChip));

  return {
    slots: slotFilter,
    rarities: rarityFilter,
    tags: tagFilter
  } satisfies InventoryFilterGroups;
}

function matchesFilters(record: InternalRecord, filters: InventoryFilterState): boolean {
  if (filters.slots.size > 0) {
    const slotKey = record.metadata.slot ? normalizeToken(record.metadata.slot) : '';
    if (!slotKey || !filters.slots.has(slotKey)) {
      return false;
    }
  }
  if (filters.rarities.size > 0) {
    if (!filters.rarities.has(record.metadata.rarity)) {
      return false;
    }
  }
  if (filters.tags.size > 0) {
    const tags = record.metadata.tags.map((tag) => normalizeToken(tag));
    const hasMatch = tags.some((tag) => filters.tags.has(tag));
    if (!hasMatch) {
      return false;
    }
  }
  return true;
}

function matchesSearch(record: InternalRecord, query: string): boolean {
  if (!query) {
    return true;
  }
  const haystack = [
    record.item.name,
    record.item.description ?? '',
    record.metadata.tags.join(' ')
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function sortRecords(records: InternalRecord[], sort: InventorySort): void {
  switch (sort) {
    case 'oldest':
      records.sort((a, b) => a.metadata.acquiredAt - b.metadata.acquiredAt);
      break;
    case 'rarity':
      records.sort((a, b) => {
        if (b.metadata.rarityRank !== a.metadata.rarityRank) {
          return b.metadata.rarityRank - a.metadata.rarityRank;
        }
        return b.metadata.acquiredAt - a.metadata.acquiredAt;
      });
      break;
    case 'name':
      records.sort((a, b) => a.item.name.localeCompare(b.item.name));
      break;
    case 'newest':
    default:
      records.sort((a, b) => b.metadata.acquiredAt - a.metadata.acquiredAt);
      break;
  }
}

export function selectInventoryView(params: InventorySelectorParams): InventoryPanelView {
  const filters: InventoryFilterState = {
    slots: normalizeSet(params.filters.slots ?? new Set<string>()),
    rarities: normalizeSet(params.filters.rarities ?? new Set<string>()),
    tags: normalizeSet(params.filters.tags ?? new Set<string>())
  };

  const searchQuery = normalizeToken(params.search);
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.floor(params.pageSize || 24));
  const collection: InventoryCollection = params.collection ?? 'stash';

  const stashRecords = buildRecords(params.stash, 'stash');
  const inventoryRecords = buildRecords(params.inventory, 'inventory');
  const allRecords = [...stashRecords, ...inventoryRecords];

  const filterGroups = buildFilterChips(allRecords, filters);

  const sourceRecords = collection === 'stash' ? stashRecords : inventoryRecords;
  const filtered = sourceRecords.filter(
    (record) => matchesFilters(record, filters) && matchesSearch(record, searchQuery)
  );
  const sorted = [...filtered];
  sortRecords(sorted, params.sort ?? 'newest');

  const visibleCount = Math.min(sorted.length, page * pageSize);
  const visibleRecords = sorted.slice(0, visibleCount);
  const hasMore = sorted.length > visibleCount;

  const context = params.comparisonContext ?? null;
  const items: InventoryListItemView[] = visibleRecords.map((record) => ({
    item: record.item,
    index: record.index,
    location: record.location,
    metadata: record.metadata,
    comparison: context ? buildComparison(record, context) : null
  }));

  const collections: InventoryCollectionSummary[] = (['stash', 'inventory'] as const).map((key) => ({
    id: key,
    label: COLLECTION_LABELS[key],
    count: key === 'stash' ? params.stash.length : params.inventory.length,
    active: key === collection
  }));

  return {
    collection,
    collections,
    filters: filterGroups,
    items,
    total: sourceRecords.length,
    filteredTotal: sorted.length,
    search: params.search,
    sort: params.sort ?? 'newest',
    hasMore,
    emptyMessage: EMPTY_MESSAGES[collection]
  } satisfies InventoryPanelView;
}

export function createDefaultFilterState(): InventoryFilterState {
  return {
    slots: new Set<string>(),
    rarities: new Set<string>(),
    tags: new Set<string>()
  } satisfies InventoryFilterState;
}
