import type { UnitArchetypeId } from '../unit/types.ts';

export type RandomSource = () => number;

export interface FactionBundleUnitDefinition {
  readonly unit: UnitArchetypeId;
  readonly level: number;
  readonly quantity: number;
}

export interface FactionBundleDefinition {
  readonly id: string;
  readonly label: string;
  readonly weight: number;
  readonly units: readonly FactionBundleUnitDefinition[];
  readonly items: readonly string[];
  readonly modifiers: readonly string[];
  readonly minRampTier?: number;
}

export interface FactionDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly bundles: readonly FactionBundleDefinition[];
}

type JsonModule = { default: unknown } | unknown;

const factionModules = import.meta.glob('../content/factions/*.json', { eager: true }) as Record<
  string,
  JsonModule
>;

const factionRegistry = new Map<string, FactionDefinition>();

for (const [path, module] of Object.entries(factionModules)) {
  const data = extractDefaultExport(module);
  const faction = parseFactionDefinition(data, path);
  if (factionRegistry.has(faction.id)) {
    throw new Error(`Duplicate faction bundle id: ${faction.id}`);
  }
  factionRegistry.set(faction.id, faction);
}

function extractDefaultExport(module: JsonModule): unknown {
  if (typeof module === 'object' && module !== null && 'default' in module) {
    return (module as { default: unknown }).default;
  }
  return module;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Expected string at ${context}`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Expected non-empty string at ${context}`);
  }
  return trimmed;
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toStringArray(value: unknown, context: string): readonly string[] {
  if (value === undefined) {
    return Object.freeze([]);
  }
  if (!Array.isArray(value)) {
    throw new Error(`Expected array at ${context}`);
  }
  const items = value.map((entry, index) => {
    if (typeof entry !== 'string') {
      throw new Error(`Expected string at ${context}[${index}]`);
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      throw new Error(`Expected non-empty string at ${context}[${index}]`);
    }
    return trimmed;
  });
  return Object.freeze(items);
}

function sanitizePositiveNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Math.floor(sanitizePositiveNumber(value, fallback));
  return numeric > 0 ? numeric : fallback;
}

function parseUnitDefinition(
  value: unknown,
  context: string
): FactionBundleUnitDefinition {
  if (!isRecord(value)) {
    throw new Error(`Expected object at ${context}`);
  }
  const unit = toNonEmptyString(value.unit, `${context}.unit`) as UnitArchetypeId;
  const level = sanitizePositiveInteger(value.level, 1);
  const quantity = sanitizePositiveInteger(value.quantity, 1);
  return Object.freeze({ unit, level, quantity });
}

function toOptionalNonNegativeInteger(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }
  const truncated = Math.floor(numeric);
  return truncated >= 0 ? truncated : undefined;
}

function parseBundleDefinition(
  value: unknown,
  context: string,
  fallbackId: string
): FactionBundleDefinition {
  if (!isRecord(value)) {
    throw new Error(`Expected object at ${context}`);
  }
  const id = toOptionalString(value.id) ?? `${fallbackId}-bundle`;
  const label = toOptionalString(value.label) ?? id;
  const weight = sanitizePositiveNumber(value.weight, 1);
  const unitsValue = value.units;
  if (!Array.isArray(unitsValue) || unitsValue.length === 0) {
    throw new Error(`Expected non-empty units array at ${context}.units`);
  }
  const units = unitsValue.map((entry, index) =>
    parseUnitDefinition(entry, `${context}.units[${index}]`)
  );
  const items = toStringArray(value.items, `${context}.items`);
  const modifiers = toStringArray(value.modifiers, `${context}.modifiers`);
  const minRampTier = toOptionalNonNegativeInteger(value.minRampTier);
  return Object.freeze({
    id,
    label,
    weight,
    units: Object.freeze(units),
    items,
    modifiers,
    minRampTier
  });
}

function parseFactionDefinition(value: unknown, context: string): FactionDefinition {
  if (!isRecord(value)) {
    throw new Error(`Expected object at ${context}`);
  }
  const id = toNonEmptyString(value.id, `${context}.id`);
  const name = toNonEmptyString(value.name, `${context}.name`);
  const description = toOptionalString(value.description);
  if (!Array.isArray(value.bundles) || value.bundles.length === 0) {
    throw new Error(`Expected non-empty bundles array at ${context}.bundles`);
  }
  const bundles = value.bundles.map((entry, index) =>
    parseBundleDefinition(entry, `${context}.bundles[${index}]`, `${id}-${index}`)
  );
  return Object.freeze({
    id,
    name,
    description,
    bundles: Object.freeze(bundles)
  });
}

export const FACTION_IDS: readonly string[] = Object.freeze(Array.from(factionRegistry.keys()));

export function getFactions(): readonly FactionDefinition[] {
  return Object.freeze(Array.from(factionRegistry.values()));
}

export function getFaction(id: string): FactionDefinition | null {
  return factionRegistry.get(id) ?? null;
}

export function getFactionBundles(id: string): readonly FactionBundleDefinition[] {
  return getFaction(id)?.bundles ?? Object.freeze([]);
}

function normalizeRandom(random: RandomSource | undefined): RandomSource {
  if (typeof random === 'function') {
    return random;
  }
  return Math.random;
}

function normalizeRoll(random: RandomSource): number {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    return Math.random();
  }
  return value;
}

export function pickFactionBundle(
  id: string,
  randomSource?: RandomSource
): FactionBundleDefinition {
  const bundles = getFactionBundles(id);
  if (bundles.length === 0) {
    throw new Error(`No bundles found for faction: ${id}`);
  }
  const random = normalizeRandom(randomSource);
  const totalWeight = bundles.reduce((sum, bundle) => sum + bundle.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error(`Invalid bundle weights for faction: ${id}`);
  }
  const roll = normalizeRoll(random) * totalWeight;
  let cursor = 0;
  for (const bundle of bundles) {
    cursor += bundle.weight;
    if (roll < cursor) {
      return bundle;
    }
  }
  return bundles[bundles.length - 1];
}
