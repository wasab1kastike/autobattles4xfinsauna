import type { RandomSource } from '../loot/roll.ts';

const LOOT_UPGRADES_STORAGE_KEY = 'progression:loot-upgrades';

export type LootUpgradeId = 'lucky-incense' | 'treasure-cache';

export interface LootUpgradeDefinition {
  readonly id: LootUpgradeId;
  readonly dropChanceBonus?: number;
  readonly additionalRolls?: number;
}

const LOOT_UPGRADE_DEFINITIONS: ReadonlyArray<LootUpgradeDefinition> = [
  { id: 'lucky-incense', dropChanceBonus: 0.08 },
  { id: 'treasure-cache', additionalRolls: 1 }
];

const LOOT_UPGRADE_DEFINITIONS_BY_ID = new Map(
  LOOT_UPGRADE_DEFINITIONS.map((definition) => [definition.id, definition])
);

export const BASE_LOOT_DROP_CHANCE = 0.2;
const BASE_LOOT_ROLLS = 1;
const MAX_LOOT_ROLL_BONUS = 9;

interface LootUpgradeRecord {
  readonly version: 1;
  readonly upgrades: LootUpgradeId[];
}

interface LooseLootUpgradeRecord {
  readonly upgrades?: LootUpgradeId[];
}

type LootUpgradeStorage = LootUpgradeRecord | LooseLootUpgradeRecord | null;

function getStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & {
      localStorage?: Storage;
      window?: { localStorage?: Storage };
    };
    return globalWithStorage.localStorage ?? globalWithStorage.window?.localStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeUpgradeId(id: unknown): LootUpgradeId | null {
  if (typeof id !== 'string') {
    return null;
  }
  return (LOOT_UPGRADE_DEFINITIONS_BY_ID.has(id as LootUpgradeId)
    ? (id as LootUpgradeId)
    : null);
}

function sanitizeRecord(raw: LootUpgradeStorage): LootUpgradeRecord {
  if (!raw || typeof raw !== 'object') {
    return { version: 1, upgrades: [] } satisfies LootUpgradeRecord;
  }
  const rawUpgrades = Array.isArray(raw.upgrades) ? raw.upgrades : [];
  const sanitized = rawUpgrades
    .map((value) => sanitizeUpgradeId(value))
    .filter((value): value is LootUpgradeId => Boolean(value));
  const unique = Array.from(new Set(sanitized));
  return { version: 1, upgrades: unique } satisfies LootUpgradeRecord;
}

function loadRecord(): LootUpgradeRecord {
  const storage = getStorage();
  if (!storage) {
    return { version: 1, upgrades: [] } satisfies LootUpgradeRecord;
  }
  try {
    const raw = storage.getItem(LOOT_UPGRADES_STORAGE_KEY);
    if (!raw) {
      return { version: 1, upgrades: [] } satisfies LootUpgradeRecord;
    }
    const parsed = JSON.parse(raw) as LootUpgradeStorage;
    return sanitizeRecord(parsed);
  } catch (error) {
    console.warn('Failed to parse loot upgrade state', error);
    return { version: 1, upgrades: [] } satisfies LootUpgradeRecord;
  }
}

function persistRecord(record: LootUpgradeRecord): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(LOOT_UPGRADES_STORAGE_KEY, JSON.stringify(record));
  } catch (error) {
    console.warn('Failed to persist loot upgrade state', error);
  }
}

let purchasedUpgrades = new Set<LootUpgradeId>(loadRecord().upgrades);

function getDefinition(id: LootUpgradeId): LootUpgradeDefinition | undefined {
  return LOOT_UPGRADE_DEFINITIONS_BY_ID.get(id);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function sanitizeRollBonus(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return 0;
  }
  return Math.min(MAX_LOOT_ROLL_BONUS, rounded);
}

export function getLootUpgradeDefinitions(): readonly LootUpgradeDefinition[] {
  return LOOT_UPGRADE_DEFINITIONS;
}

export function getPurchasedLootUpgrades(): ReadonlySet<LootUpgradeId> {
  return new Set(purchasedUpgrades);
}

function updatePurchased(next: Iterable<LootUpgradeId>): void {
  purchasedUpgrades = new Set(next);
  persistRecord({ version: 1, upgrades: Array.from(purchasedUpgrades) });
}

export function grantLootUpgrade(id: LootUpgradeId): void {
  if (!getDefinition(id)) {
    return;
  }
  if (purchasedUpgrades.has(id)) {
    return;
  }
  const next = new Set(purchasedUpgrades);
  next.add(id);
  updatePurchased(next);
}

export function setPurchasedLootUpgrades(ids: Iterable<LootUpgradeId>): void {
  const sanitized = new Set<LootUpgradeId>();
  for (const id of ids) {
    if (getDefinition(id)) {
      sanitized.add(id);
    }
  }
  updatePurchased(sanitized);
}

export function getLootRollBonus(): number {
  let bonus = 0;
  for (const id of purchasedUpgrades) {
    const definition = getDefinition(id);
    if (!definition || !Number.isFinite(definition.additionalRolls)) {
      continue;
    }
    bonus += Math.max(0, Math.floor(definition.additionalRolls as number));
  }
  return sanitizeRollBonus(bonus);
}

export function getLootDropChance(): number {
  let bonus = 0;
  for (const id of purchasedUpgrades) {
    const definition = getDefinition(id);
    if (!definition || !Number.isFinite(definition.dropChanceBonus)) {
      continue;
    }
    bonus += Math.max(0, definition.dropChanceBonus as number);
  }
  return clamp01(BASE_LOOT_DROP_CHANCE + bonus);
}

export function shouldDropLoot(random: RandomSource = Math.random): boolean {
  const chance = getLootDropChance();
  if (chance <= 0) {
    return false;
  }
  if (chance >= 1) {
    return true;
  }
  let sample = 0;
  try {
    const value = random();
    sample = typeof value === 'number' ? value : 0;
  } catch (error) {
    console.warn('Loot upgrade RNG failure', error);
    sample = 1;
  }
  const clamped = Math.max(0, Math.min(0.999999, sample));
  return clamped < chance;
}

export function getEffectiveLootRolls(): number {
  const bonus = getLootRollBonus();
  const total = BASE_LOOT_ROLLS + bonus;
  if (total <= 0) {
    return 0;
  }
  return Math.min(BASE_LOOT_ROLLS + MAX_LOOT_ROLL_BONUS, total);
}
