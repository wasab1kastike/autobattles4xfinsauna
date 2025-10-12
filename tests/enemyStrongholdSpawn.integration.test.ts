import { afterEach, describe, expect, it } from 'vitest';
import { HexMap } from '../src/hexmap.ts';
import type { Unit } from '../src/units/Unit.ts';
import { spawnEnemyBundle } from '../src/world/spawn/enemy_spawns.ts';
import { getNeighbors, type AxialCoord } from '../src/hex/HexUtils.ts';
import {
  STRONGHOLD_CONFIG,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds
} from '../src/world/strongholds.ts';
import { pickStrongholdSpawnCoord } from '../src/world/spawn/strongholdSpawn.ts';

function isNeighborOrSame(target: AxialCoord, origin: AxialCoord): boolean {
  if (target.q === origin.q && target.r === origin.r) {
    return true;
  }
  return getNeighbors(origin).some((neighbor) => neighbor.q === target.q && neighbor.r === target.r);
}

describe('enemy stronghold spawn integration', () => {
  afterEach(() => {
    resetStrongholdRegistry();
  });

  it('spawns reinforcements from surviving strongholds', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const survivingStrongholds = listStrongholds().filter((entry) => !entry.captured);
    expect(survivingStrongholds).not.toHaveLength(0);

    const units: Unit[] = [];
    const spawnCoords: AxialCoord[] = [];

    const result = spawnEnemyBundle({
      bundle: {
        id: 'test-stronghold',
        label: 'Test Stronghold Bundle',
        weight: 1,
        units: Object.freeze([{ unit: 'raider', level: 1, quantity: 1 }]),
        items: Object.freeze([]),
        modifiers: Object.freeze([])
      },
      factionId: 'enemy',
      pickEdge: () => {
        const coord = pickStrongholdSpawnCoord({ map, units, random: () => 0 });
        if (coord) {
          spawnCoords.push(coord);
        }
        return coord;
      },
      addUnit: (unit: Unit) => {
        units.push(unit);
      },
      availableSlots: 3,
      eliteOdds: 0,
      random: () => 0.5,
      appearanceRandom: () => 0.5,
      difficultyMultiplier: 1,
      rampTier: 0
    });

    expect(result.spawned).toHaveLength(1);
    expect(units).toHaveLength(1);
    expect(spawnCoords).toHaveLength(1);

    const spawnedCoord = spawnCoords[0];
    const anchoredStronghold = survivingStrongholds.find((entry) =>
      isNeighborOrSame(spawnedCoord, entry.coord)
    );

    expect(anchoredStronghold).toBeDefined();
    expect(isNeighborOrSame(units[0].coord, anchoredStronghold!.coord)).toBe(true);
  });
});
