import type { SaunojaItemRarity } from '../units/saunoja.ts';
import type { RandomSource } from '../loot/roll.ts';
import {
  loadArtocoinBalance,
  saveArtocoinBalance,
  spendArtocoins,
  type SpendArtocoinResult
} from './artocoin.ts';

const LOOT_UPGRADES_STORAGE_KEY = 'progression:loot-upgrades';

export type LootUpgradeId =
  | 'unlock-uncommon'
  | 'unlock-rare'
  | 'unlock-epic'
  | 'unlock-legendary'
  | 'unlock-mythic'
  | 'lucky-incense'
  | 'fortune-still'
  | 'treasure-cache';

export interface LootUpgradeDefinition {
  readonly id: LootUpgradeId;
  readonly title: string;
  readonly tagline: string;
  readonly description: string;
  readonly category: 'rarity' | 'drop-rate';
  readonly cost: number;
  readonly badgeLabel: string;
  readonly badgeGradient: string;
  readonly effectSummary: string;
  readonly successBlurb: string;
  readonly dropChanceBonus?: number;
  readonly additionalRolls?: number;
  readonly unlocksRarity?: SaunojaItemRarity;
  readonly requires?: readonly LootUpgradeId[];
}

const LOOT_UPGRADE_DEFINITIONS: ReadonlyArray<LootUpgradeDefinition> = [
  {
    id: 'unlock-uncommon',
    title: 'Bronzed Curio Lockers',
    tagline: 'Authorize uncommon-tier recovery crates.',
    description:
      'Quartermasters emboss the lockers with bronze sigils, granting uncommon spoils a chance to surface in the field.',
    category: 'rarity',
    cost: 250,
    badgeLabel: 'Tier II',
    badgeGradient: 'linear-gradient(135deg,rgba(191,219,254,0.42),rgba(59,130,246,0.58))',
    effectSummary: 'Unlocks uncommon-tier loot drops.',
    successBlurb: 'Uncommon caches now circulate through battlefield recoveries.',
    unlocksRarity: 'uncommon'
  },
  {
    id: 'unlock-rare',
    title: 'Sapphire-etched Vaults',
    tagline: 'Grant access to rare supply matrices.',
    description:
      'Arcane vaults receive sapphire latticework, allowing rare armaments to be sanctioned for frontline requisitions.',
    category: 'rarity',
    cost: 600,
    badgeLabel: 'Tier III',
    badgeGradient: 'linear-gradient(135deg,rgba(196,181,253,0.5),rgba(129,140,248,0.62))',
    effectSummary: 'Unlocks rare-tier loot drops.',
    successBlurb: 'Rare caches now rotate into the salvage queue.',
    unlocksRarity: 'rare',
    requires: ['unlock-uncommon']
  },
  {
    id: 'unlock-epic',
    title: 'Auroral Relic Conservatory',
    tagline: 'Permit epic-grade reliquaries.',
    description:
      'Conservators align auroral prisms so that epic relics may safely enter the quartermaster circulation.',
    category: 'rarity',
    cost: 1100,
    badgeLabel: 'Tier IV',
    badgeGradient: 'linear-gradient(135deg,rgba(221,214,254,0.52),rgba(147,197,253,0.54))',
    effectSummary: 'Unlocks epic-tier loot drops.',
    successBlurb: 'Epic reliquaries are now eligible for frontline deployment.',
    unlocksRarity: 'epic',
    requires: ['unlock-rare']
  },
  {
    id: 'unlock-legendary',
    title: 'Gilded Chronicle Archive',
    tagline: 'Authorize legendary heirlooms.',
    description:
      'Archivists weave gilt inscriptions that certify legendary heirlooms for field dispersal.',
    category: 'rarity',
    cost: 1700,
    badgeLabel: 'Tier V',
    badgeGradient: 'linear-gradient(135deg,rgba(251,191,36,0.48),rgba(239,68,68,0.56))',
    effectSummary: 'Unlocks legendary-tier loot drops.',
    successBlurb: 'Legendary heirlooms can now surface from combat recoveries.',
    unlocksRarity: 'legendary',
    requires: ['unlock-epic']
  },
  {
    id: 'unlock-mythic',
    title: 'Mythweaver Reliquary Seal',
    tagline: 'Open the vault to mythic wonders.',
    description:
      'Master sealwrights complete the mythweaver sigil, enabling mythic artifacts to enter the drop rotation.',
    category: 'rarity',
    cost: 2400,
    badgeLabel: 'Tier VI',
    badgeGradient: 'linear-gradient(135deg,rgba(236,72,153,0.55),rgba(76,29,149,0.6))',
    effectSummary: 'Unlocks mythic-tier loot drops.',
    successBlurb: 'Mythic artifacts may now be recovered in the wild.',
    unlocksRarity: 'mythic',
    requires: ['unlock-legendary']
  },
  {
    id: 'lucky-incense',
    title: 'Lucky Incense Coils',
    tagline: 'Perfuse the sauna with fortune-laced vapors.',
    description:
      'Attendants tend incense braziers whose fragrant coils entice the spirits of chance to favor our scavengers.',
    category: 'drop-rate',
    cost: 780,
    badgeLabel: '+8% Flux',
    badgeGradient: 'linear-gradient(135deg,rgba(254,215,170,0.55),rgba(217,119,6,0.58))',
    effectSummary: '+8% loot drop chance.',
    successBlurb: 'Incense rituals elevate base loot drop odds by 8%.',
    dropChanceBonus: 0.08
  },
  {
    id: 'fortune-still',
    title: 'Fortune Condenser Still',
    tagline: 'Distill battlefield omens into tangible finds.',
    description:
      "A brass still condenses the battlefield's shimmer into lucky draughts, further tipping drops in our favor.",
    category: 'drop-rate',
    cost: 1280,
    badgeLabel: '+6% Flux',
    badgeGradient: 'linear-gradient(135deg,rgba(254,249,195,0.48),rgba(251,191,36,0.54))',
    effectSummary: '+6% additional drop chance.',
    successBlurb: 'Fortune condensers add another 6% to the loot drop rate.',
    dropChanceBonus: 0.06,
    requires: ['lucky-incense']
  },
  {
    id: 'treasure-cache',
    title: 'Vaulted Treasure Manifold',
    tagline: 'Engineer redundant cache locks for surplus spoils.',
    description:
      'Artificers install a vault manifold ensuring every drop unlocks an additional cache compartment.',
    category: 'drop-rate',
    cost: 1850,
    badgeLabel: '+1 Roll',
    badgeGradient: 'linear-gradient(135deg,rgba(253,224,71,0.52),rgba(249,115,22,0.6))',
    effectSummary: '+1 bonus loot roll per drop.',
    successBlurb: 'Every recovered cache now yields an extra roll.',
    additionalRolls: 1,
    requires: ['fortune-still']
  }
];

const LOOT_UPGRADE_DEFINITIONS_BY_ID = new Map(
  LOOT_UPGRADE_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getLootUpgradeDefinition(
  id: LootUpgradeId
): LootUpgradeDefinition | undefined {
  return LOOT_UPGRADE_DEFINITIONS_BY_ID.get(id);
}

export const BASE_LOOT_DROP_CHANCE = 0.2;
const BASE_LOOT_ROLLS = 1;
const MAX_LOOT_ROLL_BONUS = 9;

const ALL_RARITIES: readonly SaunojaItemRarity[] = Object.freeze([
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic'
] satisfies readonly SaunojaItemRarity[]);

const DEFAULT_UNLOCKED_RARITIES: ReadonlySet<SaunojaItemRarity> = Object.freeze(new Set([
  'common'
] satisfies readonly SaunojaItemRarity[]));

interface LootUpgradeRecordV2 {
  readonly version: 2;
  readonly upgrades: LootUpgradeId[];
  readonly unlockedRarities: SaunojaItemRarity[];
}

interface LootUpgradeRecordV1 {
  readonly version?: 1;
  readonly upgrades?: LootUpgradeId[];
  readonly unlockedRarities?: SaunojaItemRarity[];
}

type LootUpgradeRecord = LootUpgradeRecordV2;

type LootUpgradeStorage = LootUpgradeRecordV2 | LootUpgradeRecordV1 | null;

interface LootUpgradeState {
  readonly upgrades: Set<LootUpgradeId>;
  readonly unlockedRarities: Set<SaunojaItemRarity>;
}

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

const ALL_RARITIES_SET = new Set(ALL_RARITIES);

function sanitizeRarity(value: unknown): SaunojaItemRarity | null {
  if (typeof value !== 'string') {
    return null;
  }
  return ALL_RARITIES_SET.has(value as SaunojaItemRarity)
    ? (value as SaunojaItemRarity)
    : null;
}

function sanitizeRarityList(values: readonly unknown[] | undefined): SaunojaItemRarity[] {
  const sanitized = Array.isArray(values)
    ? values
        .map((value) => sanitizeRarity(value))
        .filter((value): value is SaunojaItemRarity => Boolean(value))
    : [];
  const merged = new Set<SaunojaItemRarity>(DEFAULT_UNLOCKED_RARITIES);
  for (const rarity of sanitized) {
    merged.add(rarity);
  }
  return Array.from(merged);
}

function sanitizeRecord(raw: LootUpgradeStorage): LootUpgradeRecord {
  if (!raw || typeof raw !== 'object') {
    return {
      version: 2,
      upgrades: [],
      unlockedRarities: Array.from(DEFAULT_UNLOCKED_RARITIES)
    } satisfies LootUpgradeRecord;
  }
  const rawUpgrades = Array.isArray(raw.upgrades) ? raw.upgrades : [];
  const sanitizedUpgrades = rawUpgrades
    .map((value) => sanitizeUpgradeId(value))
    .filter((value): value is LootUpgradeId => Boolean(value));
  const uniqueUpgrades = Array.from(new Set(sanitizedUpgrades));
  const sanitizedRarities = sanitizeRarityList((raw as LootUpgradeRecordV1).unlockedRarities);
  return {
    version: 2,
    upgrades: uniqueUpgrades,
    unlockedRarities: sanitizedRarities
  } satisfies LootUpgradeRecord;
}

function loadRecord(): LootUpgradeRecord {
  const storage = getStorage();
  if (!storage) {
    return {
      version: 2,
      upgrades: [],
      unlockedRarities: Array.from(DEFAULT_UNLOCKED_RARITIES)
    } satisfies LootUpgradeRecord;
  }
  try {
    const raw = storage.getItem(LOOT_UPGRADES_STORAGE_KEY);
    if (!raw) {
      return {
        version: 2,
        upgrades: [],
        unlockedRarities: Array.from(DEFAULT_UNLOCKED_RARITIES)
      } satisfies LootUpgradeRecord;
    }
    const parsed = JSON.parse(raw) as LootUpgradeStorage;
    return sanitizeRecord(parsed);
  } catch (error) {
    console.warn('Failed to parse loot upgrade state', error);
    return {
      version: 2,
      upgrades: [],
      unlockedRarities: Array.from(DEFAULT_UNLOCKED_RARITIES)
    } satisfies LootUpgradeRecord;
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

function sanitizeUpgradeSet(values: Iterable<LootUpgradeId>): Set<LootUpgradeId> {
  const sanitized = new Set<LootUpgradeId>();
  for (const id of values) {
    if (getLootUpgradeDefinition(id)) {
      sanitized.add(id);
    }
  }
  return sanitized;
}

function sanitizeRarityIterable(
  values: Iterable<SaunojaItemRarity>
): Set<SaunojaItemRarity> {
  const sanitized = new Set<SaunojaItemRarity>();
  for (const rarity of values) {
    if (ALL_RARITIES_SET.has(rarity)) {
      sanitized.add(rarity);
    }
  }
  return sanitized;
}

function computeUnlockedRarities(
  base: Iterable<SaunojaItemRarity>,
  upgrades: Iterable<LootUpgradeId>
): Set<SaunojaItemRarity> {
  const merged = new Set<SaunojaItemRarity>(DEFAULT_UNLOCKED_RARITIES);
  for (const rarity of base) {
    if (ALL_RARITIES_SET.has(rarity)) {
      merged.add(rarity);
    }
  }
  for (const id of upgrades) {
    const definition = getLootUpgradeDefinition(id);
    const rarity = definition?.unlocksRarity;
    if (rarity && ALL_RARITIES_SET.has(rarity)) {
      merged.add(rarity);
    }
  }
  return merged;
}

function assignLootUpgradeState({
  upgrades,
  baseRarities
}: {
  upgrades?: Iterable<LootUpgradeId>;
  baseRarities?: Iterable<SaunojaItemRarity>;
}): LootUpgradeState {
  const resolvedUpgrades = sanitizeUpgradeSet(upgrades ?? lootUpgradeState.upgrades);
  const resolvedBase = sanitizeRarityIterable(baseRarities ?? lootUpgradeState.unlockedRarities);
  const unlocked = computeUnlockedRarities(resolvedBase, resolvedUpgrades);
  const nextState = {
    upgrades: resolvedUpgrades,
    unlockedRarities: unlocked
  } satisfies LootUpgradeState;
  lootUpgradeState = nextState;
  persistRecord({
    version: 2,
    upgrades: Array.from(nextState.upgrades),
    unlockedRarities: Array.from(nextState.unlockedRarities)
  });
  return nextState;
}

function addLootUpgradeToState(id: LootUpgradeId): LootUpgradeState {
  const next = new Set(lootUpgradeState.upgrades);
  next.add(id);
  return assignLootUpgradeState({ upgrades: next });
}

let lootUpgradeState: LootUpgradeState = (() => {
  const record = loadRecord();
  const upgrades = sanitizeUpgradeSet(record.upgrades);
  const baseRarities = sanitizeRarityIterable(record.unlockedRarities);
  const unlocked = computeUnlockedRarities(baseRarities, upgrades);
  return {
    upgrades,
    unlockedRarities: unlocked
  } satisfies LootUpgradeState;
})();

export interface LootUpgradeChangeEvent {
  readonly type: 'purchase' | 'grant';
  readonly id: LootUpgradeId;
  readonly purchased: ReadonlySet<LootUpgradeId>;
  readonly unlockedRarities: ReadonlySet<SaunojaItemRarity>;
  readonly spendResult?: SpendArtocoinResult;
  readonly cost?: number;
}

type LootUpgradeListener = (event: LootUpgradeChangeEvent) => void;

const lootUpgradeListeners = new Set<LootUpgradeListener>();

function emitLootUpgradeChange(event: LootUpgradeChangeEvent): void {
  for (const listener of lootUpgradeListeners) {
    try {
      listener({
        ...event,
        purchased: new Set(event.purchased),
        unlockedRarities: new Set(event.unlockedRarities)
      });
    } catch (error) {
      console.warn('Loot upgrade listener failure', error);
    }
  }
}

export function onLootUpgradeShopChange(
  listener: LootUpgradeListener
): () => void {
  lootUpgradeListeners.add(listener);
  return () => lootUpgradeListeners.delete(listener);
}

export interface PurchaseLootUpgradeResult {
  readonly success: boolean;
  readonly balance: number;
  readonly purchased: ReadonlySet<LootUpgradeId>;
  readonly unlockedRarities: ReadonlySet<SaunojaItemRarity>;
  readonly cost?: number;
  readonly shortfall?: number;
  readonly reason?:
    | 'already-owned'
    | 'insufficient-funds'
    | 'unsupported'
    | 'prerequisite-missing';
}

export interface PurchaseLootUpgradeOptions {
  readonly getCurrentBalance?: () => number;
}

function sanitizeRuntimeBalance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
}

function readSuppliedBalance(getter?: () => number): number | undefined {
  if (typeof getter !== 'function') {
    return undefined;
  }
  try {
    return sanitizeRuntimeBalance(getter());
  } catch (error) {
    console.warn('Failed to read supplied artocoin balance for loot upgrade purchase', error);
    return undefined;
  }
}

export function purchaseLootUpgrade(
  id: LootUpgradeId,
  options: PurchaseLootUpgradeOptions = {}
): PurchaseLootUpgradeResult {
  const definition = getDefinition(id);
  const storedBalance = loadArtocoinBalance();
  const suppliedBalance = readSuppliedBalance(options.getCurrentBalance);
  const storageAvailable = Boolean(getStorage());
  const fallbackBalance = !storageAvailable ? suppliedBalance : undefined;
  const effectiveBalance =
    typeof fallbackBalance === 'number' ? fallbackBalance : storedBalance;

  if (!definition) {
    return {
      success: false,
      balance: effectiveBalance,
      purchased: getPurchasedLootUpgrades(),
      unlockedRarities: getUnlockedItemRarities(),
      reason: 'unsupported'
    } satisfies PurchaseLootUpgradeResult;
  }

  if (lootUpgradeState.upgrades.has(id)) {
    return {
      success: false,
      balance: effectiveBalance,
      purchased: getPurchasedLootUpgrades(),
      unlockedRarities: getUnlockedItemRarities(),
      reason: 'already-owned',
      cost: definition.cost
    } satisfies PurchaseLootUpgradeResult;
  }

  const requirements = Array.isArray(definition.requires)
    ? definition.requires
    : [];
  const missingRequirement = requirements.find(
    (requirement) => !lootUpgradeState.upgrades.has(requirement)
  );
  if (missingRequirement) {
    return {
      success: false,
      balance: effectiveBalance,
      purchased: getPurchasedLootUpgrades(),
      unlockedRarities: getUnlockedItemRarities(),
      reason: 'prerequisite-missing',
      cost: definition.cost
    } satisfies PurchaseLootUpgradeResult;
  }

  const cost = Math.max(0, Math.floor(definition.cost));
  const metadata = { upgradeId: id, type: 'loot-upgrade' } as const;
  let spendResult: SpendArtocoinResult;

  if (cost === 0) {
    spendResult = { success: true, balance: effectiveBalance } satisfies SpendArtocoinResult;
  } else if (typeof fallbackBalance === 'number') {
    if (fallbackBalance < cost) {
      return {
        success: false,
        balance: effectiveBalance,
        purchased: getPurchasedLootUpgrades(),
        unlockedRarities: getUnlockedItemRarities(),
        shortfall: cost - fallbackBalance,
        reason: 'insufficient-funds',
        cost
      } satisfies PurchaseLootUpgradeResult;
    }
    const nextBalance = fallbackBalance - cost;
    saveArtocoinBalance(nextBalance, {
      reason: 'purchase',
      metadata,
      previousBalance: fallbackBalance
    });
    spendResult = { success: true, balance: nextBalance } satisfies SpendArtocoinResult;
  } else {
    spendResult = spendArtocoins(cost, {
      reason: 'purchase',
      metadata
    });
    if (!spendResult.success) {
      return {
        success: false,
        balance: spendResult.balance,
        purchased: getPurchasedLootUpgrades(),
        unlockedRarities: getUnlockedItemRarities(),
        shortfall: spendResult.shortfall,
        reason: 'insufficient-funds',
        cost
      } satisfies PurchaseLootUpgradeResult;
    }
  }

  const nextState = addLootUpgradeToState(id);
  emitLootUpgradeChange({
    type: 'purchase',
    id,
    purchased: nextState.upgrades,
    unlockedRarities: nextState.unlockedRarities,
    spendResult,
    cost
  });

  return {
    success: true,
    balance: spendResult.balance,
    purchased: new Set(nextState.upgrades),
    unlockedRarities: new Set(nextState.unlockedRarities),
    cost
  } satisfies PurchaseLootUpgradeResult;
}

function getDefinition(id: LootUpgradeId): LootUpgradeDefinition | undefined {
  return getLootUpgradeDefinition(id);
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
  return new Set(lootUpgradeState.upgrades);
}

export function grantLootUpgrade(id: LootUpgradeId): void {
  const definition = getDefinition(id);
  if (!definition) {
    return;
  }
  if (lootUpgradeState.upgrades.has(id)) {
    return;
  }
  const nextState = addLootUpgradeToState(id);
  emitLootUpgradeChange({
    type: 'grant',
    id,
    purchased: nextState.upgrades,
    unlockedRarities: nextState.unlockedRarities,
    cost: 0
  });
}

export function setPurchasedLootUpgrades(ids: Iterable<LootUpgradeId>): void {
  assignLootUpgradeState({ upgrades: ids });
}

export function getUnlockedItemRarities(): ReadonlySet<SaunojaItemRarity> {
  return new Set(lootUpgradeState.unlockedRarities);
}

export function isItemRarityUnlocked(rarity: SaunojaItemRarity): boolean {
  return lootUpgradeState.unlockedRarities.has(rarity);
}

export function unlockItemRarity(rarity: SaunojaItemRarity): void {
  if (!ALL_RARITIES_SET.has(rarity)) {
    return;
  }
  if (lootUpgradeState.unlockedRarities.has(rarity)) {
    return;
  }
  assignLootUpgradeState({
    baseRarities: new Set([...lootUpgradeState.unlockedRarities, rarity])
  });
}

export function setUnlockedItemRarities(
  rarities: Iterable<SaunojaItemRarity>
): void {
  assignLootUpgradeState({ baseRarities: rarities });
}

export function getLootRollBonus(): number {
  let bonus = 0;
  for (const id of lootUpgradeState.upgrades) {
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
  for (const id of lootUpgradeState.upgrades) {
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
