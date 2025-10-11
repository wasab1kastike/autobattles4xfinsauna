import type { SaunojaItem, SaunojaItemRarity } from '../units/saunoja.ts';
import {
  getLootTableForFaction,
  RARITY_WEIGHT_MULTIPLIER,
  type LootBlueprint,
  type LootQuantityRange,
  type LootTable
} from './tables.ts';

export type RandomSource = () => number;

export interface RolledLootItem {
  readonly entryId: string;
  readonly rarity: SaunojaItemRarity;
  readonly quantity: number;
  readonly item: SaunojaItem;
}

export interface LootRollOptions {
  readonly factionId: string;
  readonly elite?: boolean;
  readonly rolls: number;
  readonly random?: RandomSource;
  /**
   * Optional explicit table override. When provided the {@link factionId}
   * remains part of the result metadata while the supplied table is used for
   * every roll.
   */
  readonly table?: LootTable;
}

export interface LootRollResult {
  readonly factionId: string;
  readonly elite: boolean;
  readonly tableId: string;
  readonly tableLabel: string;
  readonly rolls: readonly RolledLootItem[];
}

function clampRollCount(requested: number): number {
  if (!Number.isFinite(requested)) {
    return 0;
  }
  const rounded = Math.floor(requested);
  if (rounded <= 0) {
    return 0;
  }
  return Math.min(10, rounded);
}

function resolveQuantity(
  quantity: LootBlueprint['quantity'],
  random: RandomSource
): number {
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    return Math.max(1, Math.round(quantity));
  }
  if (!quantity) {
    return 1;
  }
  const range = quantity as LootQuantityRange;
  const min = Math.max(1, Math.round(range.min));
  const max = Math.max(min, Math.round(range.max));
  const span = max - min + 1;
  const roll = Math.floor(Math.max(0, Math.min(0.999999, random())) * span);
  return min + roll;
}

function resolveWeight(entry: LootBlueprint): number {
  const rarityWeight = RARITY_WEIGHT_MULTIPLIER[entry.rarity] ?? 1;
  const baseWeight = typeof entry.weight === 'number' ? entry.weight : 1;
  return Math.max(0, baseWeight) * Math.max(0, rarityWeight);
}

function selectEntry(
  entries: readonly LootBlueprint[],
  random: RandomSource
): LootBlueprint | null {
  const weighted = entries
    .map((entry) => ({ entry, weight: resolveWeight(entry) }))
    .filter((candidate) => candidate.weight > 0);

  if (weighted.length === 0) {
    return null;
  }

  const total = weighted.reduce((sum, candidate) => sum + candidate.weight, 0);
  const roll = Math.max(0, Math.min(0.999999, random())) * total;
  let accum = 0;
  for (const candidate of weighted) {
    accum += candidate.weight;
    if (roll < accum) {
      return candidate.entry;
    }
  }
  return weighted[weighted.length - 1]?.entry ?? null;
}

function buildItem(entry: LootBlueprint, quantity: number): SaunojaItem {
  return {
    id: entry.id,
    name: entry.name,
    description: entry.description,
    icon: entry.icon,
    rarity: entry.rarity,
    quantity
  } satisfies SaunojaItem;
}

export function rollLoot(options: LootRollOptions): LootRollResult {
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const elite = Boolean(options.elite);
  const table = options.table ?? getLootTableForFaction(options.factionId, elite);
  const rollCount = clampRollCount(options.rolls);
  const rolls: RolledLootItem[] = [];

  if (rollCount <= 0 || table.entries.length === 0) {
    return {
      factionId: options.factionId,
      elite,
      tableId: table.id,
      tableLabel: table.label,
      rolls
    } satisfies LootRollResult;
  }

  for (let index = 0; index < rollCount; index += 1) {
    const entry = selectEntry(table.entries, random);
    if (!entry) {
      break;
    }
    const quantity = resolveQuantity(entry.quantity, random);
    rolls.push({
      entryId: entry.id,
      rarity: entry.rarity,
      quantity,
      item: buildItem(entry, quantity)
    });
  }

  return {
    factionId: options.factionId,
    elite,
    tableId: table.id,
    tableLabel: table.label,
    rolls
  } satisfies LootRollResult;
}
