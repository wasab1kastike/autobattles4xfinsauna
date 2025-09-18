import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../units/Unit.ts';
import { createUnit, type UnitSpawnOptions, type UnitType } from '../../units/UnitFactory.ts';
import type { FactionBundleDefinition } from '../../factions/bundles.ts';

export interface SpawnBundleOptions {
  readonly bundle: FactionBundleDefinition;
  readonly factionId: string;
  readonly pickEdge: () => AxialCoord | undefined;
  readonly addUnit: (unit: Unit) => void;
  readonly makeId?: () => string;
  readonly availableSlots: number;
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

  for (const spec of options.bundle.units) {
    const iterations = Math.min(spec.quantity, slots);
    const unitType = spec.unit as UnitType;
    const spawnOptions = buildSpawnOptions(spec.level);
    for (let index = 0; index < iterations; index += 1) {
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
