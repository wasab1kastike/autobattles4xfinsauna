import type { UnitArchetypeId } from './types.ts';

export type UnitAppearanceId =
  | UnitArchetypeId
  | 'saunoja'
  | 'saunoja-guardian'
  | 'saunoja-seer'
  | 'enemy-orc-1'
  | 'enemy-orc-2';

const SAUNOJA_APPEARANCES = ['saunoja', 'saunoja-guardian', 'saunoja-seer'] as const satisfies readonly UnitAppearanceId[];
const ORC_APPEARANCES = ['enemy-orc-1', 'enemy-orc-2'] as const satisfies readonly UnitAppearanceId[];

const APPEARANCE_ALIASES: Readonly<Record<string, UnitAppearanceId>> = Object.freeze({
  'saunoja-01': 'saunoja',
  'saunoja-1': 'saunoja',
  'saunoja-02': 'saunoja-guardian',
  'saunoja-2': 'saunoja-guardian',
  'saunoja-03': 'saunoja-seer',
  'saunoja-3': 'saunoja-seer',
  'enemy-orc-01': 'enemy-orc-1',
  'enemy-orc-02': 'enemy-orc-2'
});

const UNIT_APPEARANCE_VARIANTS: Readonly<Record<UnitArchetypeId, readonly UnitAppearanceId[]>> = Object.freeze({
  soldier: SAUNOJA_APPEARANCES,
  archer: SAUNOJA_APPEARANCES,
  'avanto-marauder': ORC_APPEARANCES,
  raider: ORC_APPEARANCES,
  'raider-captain': ORC_APPEARANCES,
  'raider-shaman': ORC_APPEARANCES
});

const VALID_APPEARANCE_IDS: ReadonlySet<UnitAppearanceId> = new Set<UnitAppearanceId>([
  ...new Set<UnitAppearanceId>([
    ...SAUNOJA_APPEARANCES,
    ...ORC_APPEARANCES,
    'soldier',
    'archer',
    'avanto-marauder',
    'raider',
    'raider-captain',
    'raider-shaman'
  ])
]);

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

function sampleVariant(
  variants: readonly UnitAppearanceId[] | undefined,
  random?: () => number,
  fallback: UnitAppearanceId
): UnitAppearanceId {
  if (!variants || variants.length === 0) {
    return fallback;
  }
  const rng = typeof random === 'function' ? random : Math.random;
  const rawSample = Number(rng());
  const normalized = clamp01(rawSample);
  const index = Math.min(Math.floor(normalized * variants.length), variants.length - 1);
  return variants[index] ?? fallback;
}

export function normalizeAppearanceId(candidate: unknown): UnitAppearanceId | null {
  if (typeof candidate !== 'string') {
    return null;
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.startsWith('unit-') ? trimmed.slice(5) : trimmed;
  const lower = normalized.toLowerCase();
  const canonical =
    (APPEARANCE_ALIASES[lower] as UnitAppearanceId | undefined) ?? (normalized as UnitAppearanceId);
  const sanitized = canonical.toLowerCase() as UnitAppearanceId;
  return VALID_APPEARANCE_IDS.has(sanitized)
    ? sanitized
    : null;
}

export function resolveUnitAppearance(
  type: UnitArchetypeId,
  candidate?: unknown,
  random?: () => number
): UnitAppearanceId {
  const normalizedCandidate = normalizeAppearanceId(candidate);
  if (normalizedCandidate) {
    const variants = UNIT_APPEARANCE_VARIANTS[type];
    if (!variants || variants.includes(normalizedCandidate)) {
      return normalizedCandidate;
    }
  }
  const variants = UNIT_APPEARANCE_VARIANTS[type];
  return sampleVariant(variants, random, type);
}

export function resolveSaunojaAppearance(
  candidate?: unknown,
  random?: () => number
): UnitAppearanceId {
  const normalizedCandidate = normalizeAppearanceId(candidate);
  if (normalizedCandidate && SAUNOJA_APPEARANCES.includes(normalizedCandidate)) {
    return normalizedCandidate;
  }
  return sampleVariant(SAUNOJA_APPEARANCES, random, 'saunoja-guardian');
}

export function getUnitAppearanceVariants(
  type: UnitArchetypeId
): readonly UnitAppearanceId[] | undefined {
  return UNIT_APPEARANCE_VARIANTS[type];
}
