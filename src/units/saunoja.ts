import type { AxialCoord } from '../hex/HexUtils.ts';
import { generateSaunojaName } from '../data/names.ts';
import type { CombatHookMap, CombatKeywordRegistry } from '../combat/resolve.ts';
import { createLoadoutFromItems, loadoutToItems } from '../items/equip.ts';
import type { EquipmentMap } from '../items/types.ts';
import type { UnitBehavior } from '../unit/types.ts';
import { resolveSaunojaAppearance } from '../unit/appearance.ts';
import type { UnitAppearanceId } from '../unit/appearance.ts';

export type SaunojaClass = 'tank' | 'rogue' | 'wizard' | 'speedster';

export type SaunojaItemRarity =
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary'
  | 'mythic';

export interface SaunojaItem {
  /** Stable identifier for the equipped item. */
  readonly id: string;
  /** Readable label displayed in HUD tooltips. */
  readonly name: string;
  /** Optional flavorful description surfaced in tooltips. */
  readonly description?: string;
  /** Optional relative path to an illustrative icon. */
  readonly icon?: string;
  /** Optional combat animation key that decorates attack playback. */
  readonly attackAnimation?: string;
  /** Optional rarity tag used for HUD styling. */
  readonly rarity?: SaunojaItemRarity | string;
  /** Visible quantity badge when the item stacks. */
  readonly quantity: number;
}

export interface SaunojaModifier {
  /** Unique identifier mapping to runtime modifier registrations. */
  readonly id: string;
  /** Polished name surfaced to players. */
  readonly name: string;
  /** Optional descriptive copy for tooltips. */
  readonly description?: string;
  /** Seconds remaining before the modifier expires. */
  readonly remaining: number | typeof Infinity;
  /** Total duration in seconds or Infinity for persistent effects. */
  readonly duration: number | typeof Infinity;
  /** Timestamp when the modifier was applied, in milliseconds. */
  readonly appliedAt?: number;
  /** Optional stack count for multi-tier effects. */
  readonly stacks?: number;
  /** Optional source tag rendered in the tooltip. */
  readonly source?: string;
}

export interface SaunojaStatBlock {
  health: number;
  attackDamage: number;
  attackRange: number;
  movementRange: number;
  defense?: number;
  shield?: number;
  visionRange?: number;
}

export interface Saunoja {
  /** Unique identifier used to reference the unit. */
  id: string;
  /** Display name shown in UI panels and tooltips. */
  name: string;
  /** Chosen sprite appearance for battlefield and HUD rendering. */
  appearanceId: UnitAppearanceId;
  /** Axial hex coordinate locating the unit on the map. */
  coord: AxialCoord;
  /** Maximum hit points the unit can have. */
  maxHp: number;
  /** Current hit points remaining. */
  hp: number;
  /** Passive damage reduction applied before shields. */
  defense?: number;
  /** Temporary damage buffer that absorbs hits before health. */
  shield: number;
  /** Steam intensity from 0 (idle) to 1 (billowing). */
  steam: number;
  /** Preferred battlefield routine. */
  behavior: UnitBehavior;
  /** Collection of flavorful descriptors applied to the Saunoja. */
  traits: string[];
  /** Sauna beer upkeep required to keep the attendant active. */
  upkeep: number;
  /** Earned experience points. */
  xp: number;
  /** Timestamp in milliseconds of the most recent damage event. */
  lastHitAt: number;
  /** Whether the unit is currently selected in the UI. */
  selected: boolean;
  /** Loadout items currently equipped by the Saunoja. */
  items: SaunojaItem[];
  /** Base combat stats without equipment modifiers applied. */
  baseStats: SaunojaStatBlock;
  /** Effective combat stats including equipment modifiers. */
  effectiveStats: SaunojaStatBlock;
  /** Mapping of equipment slots to their current items. */
  equipment: EquipmentMap;
  /** Active modifiers applied to the Saunoja. */
  modifiers: SaunojaModifier[];
  /** Optional keyword-driven combat hooks. */
  combatKeywords?: CombatKeywordRegistry | null;
  /** Optional direct combat hook bindings. */
  combatHooks?: CombatHookMap | null;
  /** Optional promoted class that unlocks advanced perks. */
  klass?: SaunojaClass;
}

export interface SaunojaInit {
  id: string;
  name?: string;
  appearanceId?: unknown;
  appearanceRandom?: () => number;
  coord?: AxialCoord;
  maxHp?: number;
  hp?: number;
  defense?: number;
  shield?: number;
  steam?: number;
  behavior?: unknown;
  traits?: ReadonlyArray<unknown>;
  upkeep?: number;
  xp?: number;
  lastHitAt?: number;
  selected?: boolean;
  items?: ReadonlyArray<unknown>;
  baseStats?: unknown;
  effectiveStats?: unknown;
  equipment?: unknown;
  modifiers?: ReadonlyArray<unknown>;
  combatKeywords?: CombatKeywordRegistry | null;
  combatHooks?: CombatHookMap | null;
  klass?: unknown;
}

const DEFAULT_COORD: AxialCoord = { q: 0, r: 0 };
const DEFAULT_NAME = 'Saunoja';
const DEFAULT_MAX_HP = 18;
const DEFAULT_LAST_HIT_AT = 0;
export const SAUNOJA_UPKEEP_MIN = 1;
export const SAUNOJA_UPKEEP_MAX = 4;
export const SAUNOJA_DEFAULT_UPKEEP = 1;
const DEFAULT_BEHAVIOR: UnitBehavior = 'defend';

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1 - Number.EPSILON;
  }
  return value;
}

export function rollSaunojaUpkeep(random: () => number = Math.random): number {
  const rng = typeof random === 'function' ? random : Math.random;
  const lowerBound = Math.ceil(Math.min(SAUNOJA_UPKEEP_MIN, SAUNOJA_UPKEEP_MAX));
  const upperBound = Math.floor(Math.max(SAUNOJA_UPKEEP_MIN, SAUNOJA_UPKEEP_MAX));
  const span = Math.max(1, upperBound - lowerBound + 1);

  const rawSample = Number(rng());
  const sample = Number.isFinite(rawSample) ? rawSample : Math.random();
  const normalized = clamp01(sample);
  const index = Math.min(Math.floor(normalized * span), span - 1);

  return lowerBound + index;
}

const DEFAULT_STATS: SaunojaStatBlock = {
  health: DEFAULT_MAX_HP,
  attackDamage: 4,
  attackRange: 1,
  movementRange: 1,
  defense: 0,
  shield: 0
};

const VALID_BEHAVIORS: readonly UnitBehavior[] = ['defend', 'attack', 'explore'];
const VALID_SAUNOJA_CLASSES: readonly SaunojaClass[] = ['tank', 'rogue', 'wizard', 'speedster'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function resolveStatValue(source: unknown, fallback: number, min: number): number {
  const value = typeof source === 'number' && Number.isFinite(source) ? source : fallback;
  return Math.max(min, value);
}

function resolveOptionalStat(
  source: unknown,
  fallback?: number,
  min = 0
): number | undefined {
  if (typeof source === 'number' && Number.isFinite(source)) {
    return Math.max(min, source);
  }
  if (typeof fallback === 'number' && Number.isFinite(fallback)) {
    return Math.max(min, fallback);
  }
  return undefined;
}

function sanitizeSaunojaClass(source: unknown): SaunojaClass | undefined {
  if (typeof source !== 'string') {
    return undefined;
  }
  const normalized = source.trim().toLowerCase();
  return VALID_SAUNOJA_CLASSES.find((value) => value === normalized) ?? undefined;
}

function sanitizeStatBlock(source: unknown, fallback: SaunojaStatBlock): SaunojaStatBlock {
  if (!source || typeof source !== 'object') {
    return { ...fallback } satisfies SaunojaStatBlock;
  }
  const data = source as Record<string, unknown>;
  const health = resolveStatValue(data.health, fallback.health, 1);
  const attackDamage = resolveStatValue(data.attackDamage, fallback.attackDamage, 0);
  const attackRange = resolveStatValue(data.attackRange, fallback.attackRange, 0);
  const movementRange = resolveStatValue(data.movementRange, fallback.movementRange, 0);
  const defense = resolveOptionalStat(data.defense, fallback.defense, 0);
  const shield = resolveOptionalStat(data.shield, fallback.shield, 0);
  const visionRange = resolveOptionalStat(data.visionRange, fallback.visionRange, 0);
  return {
    health,
    attackDamage,
    attackRange,
    movementRange,
    defense,
    shield,
    visionRange
  } satisfies SaunojaStatBlock;
}

function sanitizeEquipment(source: unknown, fallbackItems: SaunojaItem[]): EquipmentMap {
  if (!source || typeof source !== 'object') {
    return createLoadoutFromItems(fallbackItems);
  }
  const entries = source as Record<string, unknown>;
  const items: SaunojaItem[] = [];
  for (const value of Object.values(entries)) {
    const item = sanitizeItem(value);
    if (item) {
      items.push(item);
    }
  }
  if (items.length === 0) {
    return createLoadoutFromItems(fallbackItems);
  }
  return createLoadoutFromItems(items);
}

function sanitizeBehavior(
  source: unknown,
  fallback: UnitBehavior = DEFAULT_BEHAVIOR
): UnitBehavior {
  if (typeof source === 'string') {
    const normalized = source.trim().toLowerCase();
    if ((VALID_BEHAVIORS as readonly string[]).includes(normalized)) {
      return normalized as UnitBehavior;
    }
  }
  return fallback;
}

function sanitizeItem(entry: unknown): SaunojaItem | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const data = entry as Record<string, unknown>;
  const idSource = typeof data.id === 'string' ? data.id.trim() : '';
  const nameSource = typeof data.name === 'string' ? data.name.trim() : '';
  if (!idSource || !nameSource) {
    return null;
  }
  const description = typeof data.description === 'string' ? data.description.trim() : undefined;
  const icon = typeof data.icon === 'string' ? data.icon.trim() : undefined;
  const attackAnimation =
    typeof data.attackAnimation === 'string' && data.attackAnimation.trim().length > 0
      ? data.attackAnimation.trim()
      : undefined;
  const rarity = typeof data.rarity === 'string' ? data.rarity.trim() : undefined;
  const quantitySource = typeof data.quantity === 'number' ? data.quantity : Number(data.quantity);
  const quantity = Number.isFinite(quantitySource) ? Math.max(1, Math.round(quantitySource as number)) : 1;
  return {
    id: idSource,
    name: nameSource,
    quantity,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    ...(attackAnimation ? { attackAnimation } : {}),
    ...(rarity ? { rarity } : {})
  } satisfies SaunojaItem;
}

function sanitizeItems(entries: ReadonlyArray<unknown> | undefined): SaunojaItem[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const sanitized: SaunojaItem[] = [];
  for (const entry of entries) {
    const item = sanitizeItem(entry);
    if (item) {
      sanitized.push(item);
    }
  }
  return sanitized;
}

function sanitizeModifier(entry: unknown): SaunojaModifier | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }
  const data = entry as Record<string, unknown>;
  const idSource = typeof data.id === 'string' ? data.id.trim() : '';
  const nameSource = typeof data.name === 'string' ? data.name.trim() : '';
  if (!idSource || !nameSource) {
    return null;
  }

  const durationSource = data.duration;
  let duration: number | typeof Infinity = Infinity;
  if (typeof durationSource === 'number' && Number.isFinite(durationSource)) {
    duration = Math.max(0, durationSource);
  } else if (durationSource !== Infinity) {
    duration = Infinity;
  }

  const remainingSource = data.remaining;
  let remaining: number | typeof Infinity = duration;
  if (typeof remainingSource === 'number' && Number.isFinite(remainingSource)) {
    remaining = Math.max(0, remainingSource);
  } else if (remainingSource === Infinity) {
    remaining = Infinity;
  }

  if (duration !== Infinity && remaining === Infinity) {
    remaining = duration;
  }

  const appliedAtSource = data.appliedAt;
  const appliedAt =
    typeof appliedAtSource === 'number' && Number.isFinite(appliedAtSource)
      ? Math.max(0, appliedAtSource)
      : undefined;

  const stacksSource = data.stacks;
  const stacks =
    typeof stacksSource === 'number' && Number.isFinite(stacksSource)
      ? Math.max(1, Math.round(stacksSource))
      : undefined;

  const description = typeof data.description === 'string' ? data.description.trim() : undefined;
  const source = typeof data.source === 'string' ? data.source.trim() : undefined;

  return {
    id: idSource,
    name: nameSource,
    description,
    duration,
    remaining,
    appliedAt,
    stacks,
    source
  } satisfies SaunojaModifier;
}

function sanitizeModifiers(entries: ReadonlyArray<unknown> | undefined): SaunojaModifier[] {
  if (!entries || entries.length === 0) {
    return [];
  }
  const sanitized: SaunojaModifier[] = [];
  for (const entry of entries) {
    const modifier = sanitizeModifier(entry);
    if (modifier) {
      sanitized.push(modifier);
    }
  }
  return sanitized;
}

/**
 * Construct a Saunoja with defensive defaults while sanitising the provided
 * configuration so downstream combat helpers can rely on consistent data.
 */
function resolveSaunojaName(source: unknown): string {
  if (typeof source === 'string') {
    const trimmed = source.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  try {
    return generateSaunojaName();
  } catch (error) {
    console.warn('Falling back to default Saunoja name', error);
    return DEFAULT_NAME;
  }
}

export function makeSaunoja(init: SaunojaInit): Saunoja {
  const {
    id,
    name,
    coord = DEFAULT_COORD,
    maxHp = DEFAULT_MAX_HP,
    hp = maxHp,
    steam = 0,
    defense,
    shield = 0,
    behavior: behaviorInput,
    traits = [],
    upkeep = SAUNOJA_DEFAULT_UPKEEP,
    xp = 0,
    lastHitAt = DEFAULT_LAST_HIT_AT,
    selected = false,
    items,
    modifiers,
    combatKeywords = null,
    combatHooks = null,
    appearanceId,
    appearanceRandom,
    klass
  } = init;

  const normalizedMaxHp = Number.isFinite(maxHp) ? Math.max(1, maxHp) : DEFAULT_MAX_HP;
  const normalizedHpSource = Number.isFinite(hp) ? hp : normalizedMaxHp;
  const clampedHp = clamp(normalizedHpSource, 0, normalizedMaxHp);
  const normalizedSteamSource = Number.isFinite(steam) ? steam : 0;
  const clampedSteam = clamp(normalizedSteamSource, 0, 1);
  const normalizedTraitsSource = Array.isArray(traits) ? traits : [];
  const sanitizedTraits = normalizedTraitsSource
    .filter((trait): trait is string => typeof trait === 'string')
    .map((trait) => trait.trim())
    .filter((trait) => trait.length > 0);
  const normalizedUpkeepSource = Number.isFinite(upkeep)
    ? upkeep
    : SAUNOJA_DEFAULT_UPKEEP;
  const clampedUpkeep = clamp(normalizedUpkeepSource, SAUNOJA_UPKEEP_MIN, SAUNOJA_UPKEEP_MAX);
  const normalizedXpSource = Number.isFinite(xp) ? xp : 0;
  const clampedXp = Math.max(0, normalizedXpSource);
  const normalizedLastHitSource = Number.isFinite(lastHitAt) ? lastHitAt : DEFAULT_LAST_HIT_AT;
  const clampedLastHitAt = Math.max(0, normalizedLastHitSource);
  const normalizedShieldSource = Number.isFinite(shield) ? shield : 0;
  const clampedShield = Math.max(0, normalizedShieldSource);
  const normalizedDefenseSource = Number.isFinite(defense) ? (defense as number) : undefined;
  const clampedDefense =
    normalizedDefenseSource !== undefined ? Math.max(0, normalizedDefenseSource) : undefined;
  const sanitizedItems = sanitizeItems(items);
  const sanitizedModifiers = sanitizeModifiers(modifiers);
  const resolvedBehavior = sanitizeBehavior(behaviorInput);

  const equipment = sanitizeEquipment(init.equipment, sanitizedItems);
  const normalizedItemsRaw = loadoutToItems(equipment);
  const sanitizedById = new Map(sanitizedItems.map((item) => [item.id, item]));
  const normalizedItems = normalizedItemsRaw.map((item) => {
    const source = sanitizedById.get(item.id);
    const description = source?.description ?? item.description;
    const icon = source?.icon ?? item.icon;
    const rarity = source?.rarity ?? item.rarity;
    const attackAnimation = source
      ? source.attackAnimation
      : item.attackAnimation;
    return {
      id: item.id,
      name: source?.name ?? item.name,
      quantity: item.quantity,
      ...(description ? { description } : {}),
      ...(icon ? { icon } : {}),
      ...(rarity ? { rarity } : {}),
      ...(attackAnimation ? { attackAnimation } : {})
    } satisfies SaunojaItem;
  });

  const baseFallback: SaunojaStatBlock = {
    ...DEFAULT_STATS,
    health: normalizedMaxHp,
    defense: clampedDefense ?? DEFAULT_STATS.defense,
    shield: DEFAULT_STATS.shield
  } satisfies SaunojaStatBlock;
  const baseStats = sanitizeStatBlock(init.baseStats, baseFallback);

  const effectiveFallback: SaunojaStatBlock = {
    ...baseStats,
    health: normalizedMaxHp,
    defense: clampedDefense ?? baseStats.defense,
    shield: clampedShield
  } satisfies SaunojaStatBlock;
  const effectiveStats = sanitizeStatBlock(init.effectiveStats, effectiveFallback);

  const resolvedMaxHp = Math.max(1, effectiveStats.health);
  const resolvedHp = clamp(clampedHp, 0, resolvedMaxHp);
  const resolvedDefense =
    typeof effectiveStats.defense === 'number'
      ? Math.max(0, effectiveStats.defense)
      : clampedDefense ?? undefined;
  const resolvedShield =
    typeof effectiveStats.shield === 'number'
      ? Math.max(0, effectiveStats.shield)
      : clampedShield;

  const resolvedBase: SaunojaStatBlock = {
    ...baseStats,
    health: Math.max(1, baseStats.health),
    defense:
      typeof baseStats.defense === 'number'
        ? Math.max(0, baseStats.defense)
        : clampedDefense ?? undefined,
    shield:
      typeof baseStats.shield === 'number' ? Math.max(0, baseStats.shield) : DEFAULT_STATS.shield
  } satisfies SaunojaStatBlock;

  const resolvedEffective: SaunojaStatBlock = {
    ...effectiveStats,
    health: resolvedMaxHp,
    defense: resolvedDefense,
    shield: resolvedShield
  } satisfies SaunojaStatBlock;

  const resolvedName = resolveSaunojaName(name);
  const appearanceSampler =
    typeof appearanceRandom === 'function' ? appearanceRandom : undefined;
  const resolvedAppearance = resolveSaunojaAppearance(appearanceId, appearanceSampler);
  const resolvedClass = sanitizeSaunojaClass(klass);

  return {
    id,
    name: resolvedName,
    appearanceId: resolvedAppearance,
    coord: { q: coord.q, r: coord.r },
    maxHp: resolvedMaxHp,
    hp: resolvedHp,
    defense: resolvedDefense,
    shield: resolvedShield,
    steam: clampedSteam,
    behavior: resolvedBehavior,
    traits: [...sanitizedTraits],
    upkeep: clampedUpkeep,
    xp: clampedXp,
    lastHitAt: clampedLastHitAt,
    selected,
    items: normalizedItems,
    baseStats: resolvedBase,
    effectiveStats: resolvedEffective,
    equipment,
    modifiers: sanitizedModifiers,
    combatKeywords,
    combatHooks,
    ...(resolvedClass ? { klass: resolvedClass } : {})
  };
}
