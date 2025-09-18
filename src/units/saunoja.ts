import type { AxialCoord } from '../hex/HexUtils.ts';
import { generateSaunojaName } from '../data/names.ts';
import type { CombatHookMap, CombatKeywordRegistry } from '../combat/resolve.ts';

export interface Saunoja {
  /** Unique identifier used to reference the unit. */
  id: string;
  /** Display name shown in UI panels and tooltips. */
  name: string;
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
  /** Optional keyword-driven combat hooks. */
  combatKeywords?: CombatKeywordRegistry | null;
  /** Optional direct combat hook bindings. */
  combatHooks?: CombatHookMap | null;
}

export interface SaunojaInit {
  id: string;
  name?: string;
  coord?: AxialCoord;
  maxHp?: number;
  hp?: number;
  defense?: number;
  shield?: number;
  steam?: number;
  traits?: ReadonlyArray<unknown>;
  upkeep?: number;
  xp?: number;
  lastHitAt?: number;
  selected?: boolean;
  combatKeywords?: CombatKeywordRegistry | null;
  combatHooks?: CombatHookMap | null;
}

const DEFAULT_COORD: AxialCoord = { q: 0, r: 0 };
const DEFAULT_NAME = 'Saunoja';
const DEFAULT_MAX_HP = 18;
const DEFAULT_LAST_HIT_AT = 0;
export const SAUNOJA_UPKEEP_MIN = 0;
export const SAUNOJA_UPKEEP_MAX = 10;
export const SAUNOJA_DEFAULT_UPKEEP = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
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
    traits = [],
    upkeep = SAUNOJA_DEFAULT_UPKEEP,
    xp = 0,
    lastHitAt = DEFAULT_LAST_HIT_AT,
    selected = false,
    combatKeywords = null,
    combatHooks = null
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

  const resolvedName = resolveSaunojaName(name);

  return {
    id,
    name: resolvedName,
    coord: { q: coord.q, r: coord.r },
    maxHp: normalizedMaxHp,
    hp: clampedHp,
    defense: clampedDefense,
    shield: clampedShield,
    steam: clampedSteam,
    traits: [...sanitizedTraits],
    upkeep: clampedUpkeep,
    xp: clampedXp,
    lastHitAt: clampedLastHitAt,
    selected,
    combatKeywords,
    combatHooks
  };
}
