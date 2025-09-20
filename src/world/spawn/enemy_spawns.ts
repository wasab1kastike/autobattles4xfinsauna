import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../units/Unit.ts';
import { createUnit, type UnitSpawnOptions, type UnitType } from '../../units/UnitFactory.ts';
import {
  getFactionBundles,
  type FactionBundleDefinition,
  type RandomSource
} from '../../factions/bundles.ts';

export interface SpawnBundleOptions {
  readonly bundle: FactionBundleDefinition;
  readonly factionId: string;
  readonly pickEdge: () => AxialCoord | undefined;
  readonly addUnit: (unit: Unit) => void;
  readonly makeId?: () => string;
  readonly availableSlots: number;
  readonly eliteOdds?: number;
  readonly random?: () => number;
  readonly difficultyMultiplier?: number;
  readonly rampTier?: number;
}

export interface SpawnBundleResult {
  readonly spawned: readonly Unit[];
  readonly items: readonly string[];
  readonly modifiers: readonly string[];
}

function defaultIdFactory(): string {
  return `e${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function buildSpawnOptions(level: number): UnitSpawnOptions {
  return { level } satisfies UnitSpawnOptions;
}

export function pickRampBundle(
  factionId: string,
  rampTier: number,
  randomSource?: RandomSource
): FactionBundleDefinition {
  const bundles = getFactionBundles(factionId);
  if (bundles.length === 0) {
    throw new Error(`No bundles registered for faction: ${factionId}`);
  }
  const normalizedTier = Math.max(0, Math.floor(Number.isFinite(rampTier) ? rampTier : 0));
  const eligible = bundles.filter((bundle) => {
    const minTier = typeof bundle.minRampTier === 'number' ? bundle.minRampTier : 0;
    return minTier <= normalizedTier;
  });
  const candidates = eligible.length > 0 ? eligible : bundles;
  const random = typeof randomSource === 'function' ? randomSource : Math.random;
  const totalWeight = candidates.reduce((sum, bundle) => sum + bundle.weight, 0);
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
    throw new Error(`Invalid bundle weights for faction: ${factionId}`);
  }
  const roll = random() * totalWeight;
  let cursor = 0;
  for (const bundle of candidates) {
    cursor += bundle.weight;
    if (roll < cursor) {
      return bundle;
    }
  }
  return candidates[candidates.length - 1];
}

export function spawnEnemyBundle(options: SpawnBundleOptions): SpawnBundleResult {
  let slots = Math.max(0, Math.floor(options.availableSlots));
  const spawned: Unit[] = [];
  if (slots <= 0) {
    return {
      spawned: Object.freeze(spawned),
      items: options.bundle.items,
      modifiers: options.bundle.modifiers
    };
  }

  const makeId = options.makeId ?? defaultIdFactory;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const eliteOdds = Math.max(
    0,
    Math.min(0.95, typeof options.eliteOdds === 'number' ? options.eliteOdds : 0)
  );
  const difficultyMultiplier = Math.max(
    1,
    Number.isFinite(options.difficultyMultiplier)
      ? (options.difficultyMultiplier as number)
      : 1
  );
  const rampTier = Math.max(
    0,
    Math.floor(Number.isFinite(options.rampTier) ? (options.rampTier as number) : 0)
  );
  const tierQuantityScale = 1 + rampTier * 0.25;
  const tierLevelBonus = Math.floor(rampTier / 2);

  for (const spec of options.bundle.units) {
    const scaledQuantity = Math.max(
      1,
      Math.round(spec.quantity * difficultyMultiplier * tierQuantityScale)
    );
    const iterations = Math.min(scaledQuantity, slots);
    const unitType = spec.unit as UnitType;
    const scaledLevel = Math.max(
      1,
      Math.round((spec.level + tierLevelBonus) * difficultyMultiplier)
    );
    for (let index = 0; index < iterations; index += 1) {
      const levelBoost = random() < eliteOdds ? 1 : 0;
      const spawnLevel = Math.max(1, scaledLevel + levelBoost);
      const spawnOptions = buildSpawnOptions(spawnLevel);
      const coord = options.pickEdge();
      if (!coord) {
        return {
          spawned: Object.freeze(spawned),
          items: options.bundle.items,
          modifiers: options.bundle.modifiers
        };
      }
      const unit = createUnit(unitType, makeId(), coord, options.factionId, spawnOptions);
      if (!unit) {
        continue;
      }
      options.addUnit(unit);
      spawned.push(unit);
      slots -= 1;
      if (slots <= 0) {
        return {
          spawned: Object.freeze(spawned),
          items: options.bundle.items,
          modifiers: options.bundle.modifiers
        };
      }
    }
  }

  return {
    spawned: Object.freeze(spawned),
    items: options.bundle.items,
    modifiers: options.bundle.modifiers
  };
}
