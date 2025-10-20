import { afterEach, describe, expect, it } from 'vitest';
import { HexMap } from '../src/hexmap.ts';
import type { Unit } from '../src/units/Unit.ts';
import { spawnEnemyBundle } from '../src/world/spawn/enemy_spawns.ts';
import {
  getNeighbors,
  hexDistance as hexDistanceFromUtils,
  type AxialCoord
} from '../src/hex/HexUtils.ts';
import {
  activateStronghold,
  STRONGHOLD_CONFIG,
  listStrongholds,
  resetStrongholdRegistry,
  seedEnemyStrongholds
} from '../src/world/strongholds.ts';
import { pickStrongholdSpawnCoord } from '../src/world/spawn/strongholdSpawn.ts';
import { hexDistance as gameHexDistance } from '../src/game.ts';
import { MIN_SAUNA_STRONGHOLD_DISTANCE } from '../src/game/setup/sauna.ts';
import { StrongholdSpawner } from '../src/sim/StrongholdSpawner.ts';

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

  it('keeps configured strongholds outside the sauna exclusion radius', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const center = { q: Math.floor(map.width / 2), r: Math.floor(map.height / 2) };
    const exclusionRadius = MIN_SAUNA_STRONGHOLD_DISTANCE;

    const seededStrongholds = listStrongholds();
    expect(seededStrongholds).toHaveLength(STRONGHOLD_CONFIG.strongholds.length);

    for (const entry of seededStrongholds) {
      const distance = gameHexDistance(center, entry.coord);
      expect(distance).toBeGreaterThanOrEqual(exclusionRadius);
    }
  });

  it('spawns reinforcements from surviving strongholds', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);
    const survivingStrongholds = listStrongholds().filter((entry) => !entry.captured);
    expect(survivingStrongholds).not.toHaveLength(0);

    for (const entry of survivingStrongholds) {
      activateStronghold(entry.id, map);
    }

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

  it('avoids spawning inside exclusion zones', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const strongholds = listStrongholds();
    const protectedStronghold = strongholds.find((entry) => entry.id === 'aurora-watch');
    expect(protectedStronghold).toBeDefined();

    activateStronghold(protectedStronghold!.id, map);

    const excludeZone = {
      center: { q: 0, r: 0 },
      radius: 5
    } as const;

    for (const entry of strongholds) {
      if (entry !== protectedStronghold) {
        entry.captured = true;
      }
    }

    const result = pickStrongholdSpawnCoord({
      map,
      units: [],
      random: () => 0,
      excludeZones: [excludeZone]
    });

    expect(result).toBeUndefined();

    // Restore registry state for the follow-up check.
    resetStrongholdRegistry();
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const [reseededProtected] = listStrongholds().filter((entry) => entry.id === 'aurora-watch');
    expect(reseededProtected).toBeDefined();
    activateStronghold(reseededProtected!.id, map);

    const outsideResult = pickStrongholdSpawnCoord({
      map,
      units: [],
      random: () => 0,
      excludeZones: [excludeZone]
    });

    expect(outsideResult).toBeDefined();
    expect(hexDistanceFromUtils(outsideResult!, excludeZone.center)).toBeGreaterThan(
      excludeZone.radius
    );
  });

  it('respects expanded sauna vision radius', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    for (const entry of listStrongholds()) {
      activateStronghold(entry.id, map);
    }

    const exclusionZone = {
      center: { q: Math.floor(map.width / 2), r: Math.floor(map.height / 2) },
      radius: 50
    } as const;

    const coord = pickStrongholdSpawnCoord({
      map,
      units: [],
      random: () => 0.5,
      excludeZones: [exclusionZone]
    });

    expect(coord).toBeUndefined();
  });

  it('treats zero-radius exclusion zones as at least one tile', () => {
    const map = new HexMap(10, 10, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const strongholds = listStrongholds();
    const anchored = strongholds.find((entry) => entry.id === 'aurora-watch');
    expect(anchored).toBeDefined();

    activateStronghold(anchored!.id, map);

    for (const entry of strongholds) {
      if (entry !== anchored) {
        entry.captured = true;
      }
    }

    const zoneCenter = getNeighbors(anchored!.coord)[4]!;
    const result = pickStrongholdSpawnCoord({
      map,
      units: [],
      random: () => 0,
      excludeZones: [
        {
          center: zoneCenter,
          radius: 0
        }
      ]
    });

    expect(result).toBeDefined();
    expect(hexDistanceFromUtils(result!, zoneCenter)).toBeGreaterThan(1);
  });

  it('reinforces sequential bastions as the deployment timer advances', () => {
    const map = new HexMap(12, 12, 32);
    seedEnemyStrongholds(map, STRONGHOLD_CONFIG);

    const dormant = listStrongholds().filter((entry) => !entry.captured);
    expect(dormant).not.toHaveLength(0);
    expect(dormant.every((entry) => entry.deployed === false)).toBe(true);

    const spawner = new StrongholdSpawner({
      initialQueue: dormant.map((entry) => entry.id)
    });

    const recordSpawn = (): { coord: AxialCoord | undefined; anchor: string | undefined } => {
      const units: Unit[] = [];
      let chosenCoord: AxialCoord | undefined;
      const spawned = spawnEnemyBundle({
        bundle: {
          id: 'timed-stronghold',
          label: 'Timed Stronghold Bundle',
          weight: 1,
          units: Object.freeze([{ unit: 'raider', level: 1, quantity: 1 }]),
          items: Object.freeze([]),
          modifiers: Object.freeze([])
        },
        factionId: 'enemy',
        pickEdge: () => {
          const coord = pickStrongholdSpawnCoord({ map, units, random: () => 0 });
          if (!chosenCoord && coord) {
            chosenCoord = coord;
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

      const coord = chosenCoord;
      const anchor = coord
        ? listStrongholds().find((entry) =>
            !entry.captured && isNeighborOrSame(coord, entry.coord)
          )?.id
        : undefined;

      expect(spawned.spawned.length).toBeLessThanOrEqual(1);
      return { coord, anchor };
    };

    const advanceAndDeploy = (seconds: number): readonly string[] => {
      const activations = spawner.update(seconds);
      for (const id of activations) {
        activateStronghold(id, map);
      }
      return activations;
    };

    // First activation deploys the leading stronghold.
    let activations = advanceAndDeploy(180);
    expect(activations).toHaveLength(1);
    const firstId = activations[0]!;
    const firstSpawn = recordSpawn();
    expect(firstSpawn.coord).toBeDefined();
    expect(firstSpawn.anchor).toBe(firstId);

    // Simulate players capturing the deployed bastion.
    const firstTile = map.getTile(
      dormant.find((entry) => entry.id === firstId)!.coord.q,
      dormant.find((entry) => entry.id === firstId)!.coord.r
    );
    firstTile?.placeBuilding(null);
    const firstMetadata = listStrongholds().find((entry) => entry.id === firstId);
    expect(firstMetadata?.captured).toBe(true);

    // Next activation shifts reinforcements to a new bastion.
    activations = advanceAndDeploy(180);
    expect(activations).toHaveLength(1);
    const secondId = activations[0]!;
    expect(secondId).not.toBe(firstId);

    const secondSpawn = recordSpawn();
    expect(secondSpawn.coord).toBeDefined();
    expect(secondSpawn.anchor).toBe(secondId);

    const secondTile = map.getTile(
      dormant.find((entry) => entry.id === secondId)!.coord.q,
      dormant.find((entry) => entry.id === secondId)!.coord.r
    );
    secondTile?.placeBuilding(null);

    // Timer advances again to bring another stronghold online.
    activations = advanceAndDeploy(180);
    expect(activations.length).toBeGreaterThanOrEqual(0);
    const thirdId = activations[0];

    const thirdSpawn = recordSpawn();
    expect(thirdSpawn.coord).toBeDefined();
    if (thirdId) {
      expect(thirdSpawn.anchor).toBe(thirdId);
      const thirdTile = map.getTile(
        dormant.find((entry) => entry.id === thirdId)!.coord.q,
        dormant.find((entry) => entry.id === thirdId)!.coord.r
      );
      thirdTile?.placeBuilding(null);
    } else if (thirdSpawn.anchor) {
      expect([firstId, secondId]).not.toContain(thirdSpawn.anchor);
    }
  });
});
