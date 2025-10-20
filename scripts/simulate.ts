import fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { AxialCoord } from '../src/hex/HexUtils.ts';
import { HexMap } from '../src/hexmap.ts';
import { BattleManager } from '../src/battle/BattleManager.ts';
import { EnemySpawner } from '../src/sim/EnemySpawner.ts';
import { GameState, Resource } from '../src/core/GameState.ts';
import { createSauna } from '../src/sim/sauna.ts';
import { runEconomyTick } from '../src/economy/tick.ts';
import { spawnUnit } from '../src/units/UnitFactory.ts';
import type { Unit } from '../src/units/Unit.ts';
import { eventBus } from '../src/events/EventBus.ts';

interface SimulationRow {
  seed: number;
  tick: number;
  beer: number;
  upkeep: number;
  roster: number;
  deaths: number;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

function pickPlayerSpawnTile(
  center: AxialCoord,
  units: readonly Unit[],
  map: HexMap,
  random: () => number,
  radius = 2
): AxialCoord | null {
  const occupied = new Set<string>();
  for (const unit of units) {
    if (!unit.isDead()) {
      occupied.add(coordKey(unit.coord));
    }
  }

  const candidates: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      if (dq === 0 && dr === 0) {
        continue;
      }
      const coord = { q: center.q + dq, r: center.r + dr } satisfies AxialCoord;
      const key = coordKey(coord);
      if (occupied.has(key)) {
        continue;
      }
      map.ensureTile(coord.q, coord.r);
      candidates.push(coord);
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(random() * candidates.length);
  return candidates[index] ?? null;
}

function createEdgePicker(
  map: HexMap,
  random: () => number,
  units: () => readonly Unit[]
): () => AxialCoord | undefined {
  return () => {
    const occupied = new Set<string>();
    for (const unit of units()) {
      if (!unit.isDead()) {
        occupied.add(coordKey(unit.coord));
      }
    }

    const candidates: AxialCoord[] = [];
    const { minQ, maxQ, minR, maxR } = map;

    const addCandidate = (coord: AxialCoord): void => {
      const key = coordKey(coord);
      if (occupied.has(key)) {
        return;
      }
      map.ensureTile(coord.q, coord.r);
      candidates.push(coord);
    };

    for (let q = minQ; q <= maxQ; q++) {
      addCandidate({ q, r: minR });
      if (maxR !== minR) {
        addCandidate({ q, r: maxR });
      }
    }

    for (let r = minR + 1; r <= maxR - 1; r++) {
      addCandidate({ q: minQ, r });
      if (maxQ !== minQ) {
        addCandidate({ q: maxQ, r });
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    const index = Math.floor(random() * candidates.length);
    return candidates[index];
  };
}

function registerUnit(units: Unit[], unit: Unit | null): Unit | null {
  if (!unit) {
    return null;
  }
  units.push(unit);
  return unit;
}

function runSeededSimulation(seed: number): SimulationRow[] {
  const random = createSeededRandom(seed);
  const originalRandom = Math.random;
  Math.random = random;

  try {
    const map = new HexMap(10, 10, 32, seed);
    const battleManager = new BattleManager(map);
    const state = new GameState(1000);
    const sauna = createSauna({
      q: Math.floor(map.width / 2),
      r: Math.floor(map.height / 2)
    });
    map.ensureTile(sauna.pos.q, sauna.pos.r);

    const units: Unit[] = [];
    let nextPlayerId = 1;
    let nextEnemyId = 1;

    const enemySpawner = new EnemySpawner({
      random,
      idFactory: () => `e${seed}-${nextEnemyId++}`
    });

    const addEnemyUnit = (unit: Unit): void => {
      units.push(unit);
    };

    const pickEdge = createEdgePicker(map, random, () => units);

    const onUnitSpawned = ({ unit }: { unit: Unit }): void => {
      if (!units.includes(unit)) {
        units.push(unit);
      }
    };
    eventBus.on('unitSpawned', onUnitSpawned);

    state.addResource(Resource.SAUNA_BEER, 200);
    registerUnit(
      units,
      spawnUnit(state, 'soldier', `p${seed}-${nextPlayerId++}`, sauna.pos, 'player')
    );

    let totalDeaths = 0;
    const onUnitDied = (): void => {
      totalDeaths += 1;
    };
    eventBus.on('unitDied', onUnitDied);

    const rows: SimulationRow[] = [];

    for (let tick = 1; tick <= 150; tick++) {
      state.tick();

      const economy = runEconomyTick({
        dt: 1,
        state,
        sauna,
        heat: sauna.heatTracker,
        units,
        getUnitUpkeep: (unit) => (unit.faction === 'player' && !unit.isDead() ? 1 : 0),
        pickSpawnTile: () => pickPlayerSpawnTile(sauna.pos, units, map, random),
        spawnBaseUnit: (coord) =>
          registerUnit(
            units,
            spawnUnit(state, 'soldier', `p${seed}-${nextPlayerId++}`, coord, 'player')
          ),
        minUpkeepReserve: 1,
        maxSpawns: 1,
        spawnSpeedMultiplier: sauna.spawnSpeedMultiplier ?? 1,
        spawnHeatMultiplier: sauna.spawnSpeedMultiplier ?? 1
      });

      enemySpawner.update(1, units, addEnemyUnit, pickEdge);
      battleManager.tick(units, 1, sauna);

      const beer = state.getResource(Resource.SAUNA_BEER);
      const roster = units.filter((unit) => unit.faction === 'player' && !unit.isDead()).length;

      rows.push({
        seed,
        tick,
        beer: Number.isFinite(beer) ? beer : 0,
        upkeep: economy.upkeepDrain,
        roster,
        deaths: totalDeaths
      });
    }

    eventBus.off('unitDied', onUnitDied);
    eventBus.off('unitSpawned', onUnitSpawned);

    return rows;
  } finally {
    Math.random = originalRandom;
  }
}

async function main(): Promise<void> {
  const seeds = Array.from({ length: 20 }, (_, index) => index);
  const rows = seeds.flatMap((seed) => runSeededSimulation(seed));

  const header = 'seed,tick,beer,upkeep,roster,deaths';
  const lines = rows.map((row) =>
    [
      row.seed,
      row.tick,
      row.beer.toFixed(2),
      row.upkeep.toFixed(2),
      row.roster,
      row.deaths
    ].join(',')
  );
  const csv = [header, ...lines].join('\n');

  const balancePath = join(tmpdir(), 'balance.csv');
  await fs.writeFile(balancePath, csv, 'utf8');
  console.log(`Balance snapshot saved to ${balancePath}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
