import {
  createEmptyLoadout,
  EQUIPMENT_SLOT_IDS,
  type EquipmentItemDefinition,
  type EquipmentMap,
  type EquipmentModifier,
  type EquipmentSlotDefinition,
  type EquipmentSlotId,
  type EquippedItem
} from './types.ts';
import type { Saunoja, SaunojaItem } from '../units/saunoja.ts';

const RARITY_RANK: Record<string, number> = Object.freeze({
  mythic: 6,
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1
});

function normalizeRarity(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function getRarityRank(value?: string | null): number {
  const key = normalizeRarity(value);
  return RARITY_RANK[key] ?? 0;
}

function sumPositiveModifiers(modifiers: EquipmentModifier | undefined): number {
  if (!modifiers) {
    return 0;
  }
  let total = 0;
  for (const value of Object.values(modifiers)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      total += value;
    }
  }
  return total;
}

function resolveStackCount(quantity?: number): number {
  if (!Number.isFinite(quantity)) {
    return 1;
  }
  return Math.max(1, Math.round(quantity as number));
}

export function evaluateEquipmentPower(item: SaunojaItem | EquippedItem): number {
  const definition = getItemDefinition(item.id);
  if (!definition) {
    return 0;
  }
  const rarity = getRarityRank(item.rarity);
  const modifiers = 'modifiers' in item && item.modifiers
    ? item.modifiers
    : definition.modifiers ?? ({} as EquipmentModifier);
  const stacks = resolveStackCount(item.quantity);
  const modifierScore = sumPositiveModifiers(modifiers) * stacks;
  return rarity * 1000 + modifierScore;
}

const SLOT_DEFINITIONS: Record<EquipmentSlotId, EquipmentSlotDefinition> = Object.freeze({
  supply: Object.freeze({
    id: 'supply',
    label: 'Supply Satchel',
    description: 'Consumables and restorative provisions carried into battle.',
    maxStacks: 5
  }),
  weapon: Object.freeze({
    id: 'weapon',
    label: 'Primary Armament',
    description: 'The attendant\'s main weapon or ranged kit.',
    maxStacks: 1
  }),
  focus: Object.freeze({
    id: 'focus',
    label: 'Battle Focus',
    description: 'Tools that sharpen aim, steps, or battlefield intuition.',
    maxStacks: 1
  }),
  relic: Object.freeze({
    id: 'relic',
    label: 'Sauna Relic',
    description: 'Charms and relics that empower the attendant\'s resolve.',
    maxStacks: 1
  })
});

const ITEM_DEFINITIONS: Record<string, EquipmentItemDefinition> = Object.freeze({
  'birch-sap-satchel': Object.freeze({
    id: 'birch-sap-satchel',
    slot: 'supply',
    modifiers: { health: 3 },
    maxStacks: 3
  }),
  'steamed-bandages': Object.freeze({
    id: 'steamed-bandages',
    slot: 'supply',
    modifiers: { shield: 4 },
    maxStacks: 2
  }),
  'aurora-distillate': Object.freeze({
    id: 'aurora-distillate',
    slot: 'supply',
    modifiers: { attackDamage: 2, defense: 1 },
    maxStacks: 1
  }),
  'stolen-sauna-tokens': Object.freeze({
    id: 'stolen-sauna-tokens',
    slot: 'supply',
    modifiers: { movementRange: 0.5 },
    maxStacks: 5
  }),
  'midnight-bloodwine': Object.freeze({
    id: 'midnight-bloodwine',
    slot: 'supply',
    modifiers: { health: 6, attackDamage: 1 },
    maxStacks: 1
  }),
  'sauna-incense': Object.freeze({
    id: 'sauna-incense',
    slot: 'supply',
    modifiers: { attackRange: 1 },
    maxStacks: 2
  }),
  'glacier-brand': Object.freeze({
    id: 'glacier-brand',
    slot: 'weapon',
    modifiers: { attackDamage: 3 },
    maxStacks: 1
  }),
  'emberglass-arrow': Object.freeze({
    id: 'emberglass-arrow',
    slot: 'weapon',
    modifiers: { attackDamage: 1, attackRange: 2 },
    maxStacks: 1
  }),
  'aurora-lattice': Object.freeze({
    id: 'aurora-lattice',
    slot: 'focus',
    modifiers: { attackDamage: 2, attackRange: 1 },
    maxStacks: 1
  }),
  'emberglass-shard': Object.freeze({
    id: 'emberglass-shard',
    slot: 'focus',
    modifiers: { attackDamage: 1, movementRange: 1 },
    maxStacks: 1
  }),
  'windstep-totem': Object.freeze({
    id: 'windstep-totem',
    slot: 'focus',
    modifiers: { movementRange: 1, defense: 1 },
    maxStacks: 1
  }),
  'searing-chant-censer': Object.freeze({
    id: 'searing-chant-censer',
    slot: 'focus',
    modifiers: { attackDamage: 2, shield: 2 },
    maxStacks: 1
  }),
  'cracked-ice-amulet': Object.freeze({
    id: 'cracked-ice-amulet',
    slot: 'relic',
    modifiers: { defense: 2 },
    maxStacks: 1
  }),
  'myrsky-charm': Object.freeze({
    id: 'myrsky-charm',
    slot: 'relic',
    modifiers: { attackRange: 1, defense: 1 },
    maxStacks: 1
  }),
  'frostwyrm-signet': Object.freeze({
    id: 'frostwyrm-signet',
    slot: 'relic',
    modifiers: { shield: 5 },
    maxStacks: 1
  }),
  'spirit-oak-charm': Object.freeze({
    id: 'spirit-oak-charm',
    slot: 'relic',
    modifiers: { defense: 1, health: 2 },
    maxStacks: 1
  })
});

export function getSlotDefinition(slotId: EquipmentSlotId): EquipmentSlotDefinition {
  const definition = SLOT_DEFINITIONS[slotId];
  if (!definition) {
    throw new Error(`Unknown equipment slot: ${slotId}`);
  }
  return definition;
}

export function getItemDefinition(itemId: string): EquipmentItemDefinition | undefined {
  return ITEM_DEFINITIONS[itemId];
}

function normalizeQuantity(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.round(value as number));
}

function cloneItem(item: SaunojaItem, quantity: number): SaunojaItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    icon: item.icon,
    rarity: item.rarity,
    quantity
  } satisfies SaunojaItem;
}

function toEquippedItem(
  source: SaunojaItem,
  slot: EquipmentSlotId,
  definition: EquipmentItemDefinition,
  quantity: number
): EquippedItem {
  const slotDef = getSlotDefinition(slot);
  const limit = Math.max(1, Math.floor(definition.maxStacks ?? slotDef.maxStacks));
  const resolvedQuantity = Math.min(limit, quantity);
  const modifiers = definition.modifiers ?? ({} as EquipmentModifier);
  return {
    ...cloneItem(source, resolvedQuantity),
    slot,
    maxStacks: limit,
    modifiers
  } satisfies EquippedItem;
}

function ensureEquipment(unit: Saunoja): EquipmentMap {
  if (!unit.equipment) {
    unit.equipment = createEmptyLoadout();
  }
  for (const slot of EQUIPMENT_SLOT_IDS) {
    unit.equipment[slot] ??= null;
  }
  return unit.equipment;
}

export function loadoutItems(equipment: EquipmentMap): EquippedItem[] {
  const slots: EquippedItem[] = [];
  for (const slot of EQUIPMENT_SLOT_IDS) {
    const item = equipment[slot];
    if (item) {
      slots.push({ ...item });
    }
  }
  return slots;
}

export function loadoutToItems(equipment: EquipmentMap): SaunojaItem[] {
  return loadoutItems(equipment).map((item) => cloneItem(item, item.quantity));
}

export function createLoadoutFromItems(items: readonly SaunojaItem[]): EquipmentMap {
  const loadout = createEmptyLoadout();
  for (const item of items) {
    const definition = getItemDefinition(item.id);
    if (!definition) {
      continue;
    }
    const quantity = normalizeQuantity(item.quantity);
    const current = loadout[definition.slot];
    if (current && current.id !== item.id) {
      continue;
    }
    const nextQuantity = (current?.quantity ?? 0) + quantity;
    const equipped = toEquippedItem(item, definition.slot, definition, nextQuantity);
    loadout[definition.slot] = equipped;
  }
  return loadout;
}

export interface EquipOutcome {
  readonly success: boolean;
  readonly slot: EquipmentSlotId;
  readonly loadout: readonly EquippedItem[];
  readonly item: EquippedItem | null;
  readonly removed?: EquippedItem | null;
  readonly reason?: string;
}

export interface EquipOptions {
  readonly allowDowngrade?: boolean;
}

export interface UnequipOutcome {
  readonly success: boolean;
  readonly slot: EquipmentSlotId;
  readonly loadout: readonly EquippedItem[];
  readonly removed: EquippedItem | null;
  readonly reason?: string;
}

export function equip(unit: Saunoja, item: SaunojaItem, options: EquipOptions = {}): EquipOutcome {
  const definition = getItemDefinition(item.id);
  if (!definition) {
    return {
      success: false,
      slot: 'supply',
      loadout: loadoutItems(ensureEquipment(unit)),
      item: null,
      reason: 'unknown-item'
    } satisfies EquipOutcome;
  }

  const equipment = ensureEquipment(unit);
  const slot = definition.slot;
  const slotDef = getSlotDefinition(slot);
  const incomingQuantity = normalizeQuantity(item.quantity);
  const limit = Math.max(1, Math.floor(definition.maxStacks ?? slotDef.maxStacks));
  const existing = equipment[slot];

  if (existing && existing.id !== item.id) {
    const incomingStacks = Math.min(limit, incomingQuantity);
    const incomingPreview: SaunojaItem = {
      id: item.id,
      name: item.name,
      description: item.description,
      icon: item.icon,
      rarity: item.rarity,
      quantity: incomingStacks
    } satisfies SaunojaItem;
    const incomingPower = evaluateEquipmentPower(incomingPreview);
    const existingPower = evaluateEquipmentPower(existing);
    const shouldReplace = options.allowDowngrade === true || incomingPower > existingPower;
    if (!shouldReplace) {
      return {
        success: false,
        slot,
        loadout: loadoutItems(equipment),
        item: existing,
        reason: 'slot-occupied'
      } satisfies EquipOutcome;
    }

    const equipped = toEquippedItem(item, slot, definition, incomingStacks);
    equipment[slot] = equipped;
    unit.items = loadoutToItems(equipment);
    return {
      success: true,
      slot,
      loadout: loadoutItems(equipment),
      item: equipped,
      removed: existing
    } satisfies EquipOutcome;
  }

  const nextQuantity = Math.min(limit, (existing?.quantity ?? 0) + incomingQuantity);
  if ((existing?.quantity ?? 0) + incomingQuantity > limit) {
    return {
      success: false,
      slot,
      loadout: loadoutItems(equipment),
      item: existing,
      reason: 'stack-limit'
    } satisfies EquipOutcome;
  }

  const equipped = toEquippedItem(item, slot, definition, nextQuantity);
  equipment[slot] = equipped;
  unit.items = loadoutToItems(equipment);
  return {
    success: true,
    slot,
    loadout: loadoutItems(equipment),
    item: equipped
  } satisfies EquipOutcome;
}

export function unequip(unit: Saunoja, slot: EquipmentSlotId): UnequipOutcome {
  const equipment = ensureEquipment(unit);
  const existing = equipment[slot];
  if (!existing) {
    return {
      success: false,
      slot,
      loadout: loadoutItems(equipment),
      removed: null,
      reason: 'empty-slot'
    } satisfies UnequipOutcome;
  }
  equipment[slot] = null;
  unit.items = loadoutToItems(equipment);
  return {
    success: true,
    slot,
    loadout: loadoutItems(equipment),
    removed: existing
  } satisfies UnequipOutcome;
}

export function matchesSlot(itemId: string, slot: EquipmentSlotId): boolean {
  const definition = getItemDefinition(itemId);
  return definition?.slot === slot;
}

type RankedCandidate = { index: number; score: number };

function byDescendingScore(a: RankedCandidate, b: RankedCandidate): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  return a.index - b.index;
}

export function rankEquipmentCandidates(
  items: readonly SaunojaItem[],
  slot: EquipmentSlotId
): readonly number[] {
  const ranked: RankedCandidate[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!matchesSlot(item.id, slot)) {
      continue;
    }
    ranked.push({
      index,
      score: evaluateEquipmentPower(item)
    });
  }
  ranked.sort(byDescendingScore);
  return ranked.map((entry) => entry.index);
}
