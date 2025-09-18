import { Resource, type GameState } from '../core/GameState.ts';
import type { Unit } from '../units/Unit.ts';
import type { Sauna } from '../sim/sauna.ts';
import type { SaunaHeat } from '../sauna/heat.ts';
import { processPlayerSpawns, type PlayerSpawnResult } from '../world/spawn/player_spawns.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

function sanitize(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export type UnitUpkeepResolver = (unit: Unit) => number;

export interface EconomyTickOptions {
  /** Elapsed simulation time in seconds since the previous economy tick. */
  dt: number;
  state: GameState;
  sauna: Sauna;
  heat: SaunaHeat;
  units: readonly Unit[];
  getUnitUpkeep: UnitUpkeepResolver;
  pickSpawnTile: () => AxialCoord | null;
  spawnBaseUnit: (coord: AxialCoord) => Unit | null;
  minUpkeepReserve?: number;
  maxSpawns?: number;
}

export interface EconomyTickResult {
  addedHeat: number;
  cooledHeat: number;
  upkeepDrain: number;
  spawn: PlayerSpawnResult;
  beerRemaining: number;
  availableUpkeep: number;
}

export function runEconomyTick(options: EconomyTickOptions): EconomyTickResult {
  const dt = Math.max(0, sanitize(options.dt, 0));

  const { addedHeat, cooledHeat } = options.heat.advance(dt);

  let upkeepDrain = 0;
  for (const unit of options.units) {
    if (unit.isDead() || unit.faction !== 'player') {
      continue;
    }
    const upkeep = Math.max(0, sanitize(options.getUnitUpkeep(unit), 0));
    if (upkeep > 0) {
      upkeepDrain += upkeep;
    }
  }

  if (upkeepDrain > 0) {
    options.state.addResource(Resource.SAUNA_BEER, -upkeepDrain);
  }

  const availableUpkeep = options.state.getResource(Resource.SAUNA_BEER);

  const spawn = processPlayerSpawns({
    heat: options.heat,
    availableUpkeep,
    pickSpawnTile: options.pickSpawnTile,
    spawnUnit: options.spawnBaseUnit,
    minUpkeepReserve: options.minUpkeepReserve,
    maxSpawns: options.maxSpawns
  });

  const cooldown = options.heat.getCooldownSeconds();
  const timer = options.heat.timeUntilNextTrigger();

  options.sauna.heat = options.heat.getHeat();
  options.sauna.playerSpawnThreshold = options.heat.getThreshold();
  options.sauna.playerSpawnCooldown = Number.isFinite(cooldown) ? cooldown : 0;
  options.sauna.playerSpawnTimer = Number.isFinite(timer) ? timer : 0;
  options.sauna.heatPerTick = options.heat.getBuildRate();

  return {
    addedHeat,
    cooledHeat,
    upkeepDrain,
    spawn,
    beerRemaining: options.state.getResource(Resource.SAUNA_BEER),
    availableUpkeep: spawn.remainingUpkeep
  };
}
