import { Resource, type GameState } from '../core/GameState.ts';
import type { Unit } from '../units/Unit.ts';
import type { Sauna } from '../sim/sauna.ts';
import type { SaunaHeat } from '../sauna/heat.ts';
import {
  processPlayerSpawns,
  type PlayerSpawnResult
} from '../world/spawn/player_spawns.ts';
import type { PlayerSpawnTierHelpers } from '../world/spawn/tier_helpers.ts';
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
  rosterCap?: number;
  getRosterCount?: () => number;
  tierHelpers?: PlayerSpawnTierHelpers;
  spawnSpeedMultiplier?: number;
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

  const heatRate = options.heat.getBuildRate();
  const rawSpeed = sanitize(options.spawnSpeedMultiplier ?? 1, 1);
  const spawnSpeedMultiplier = rawSpeed > 0 ? rawSpeed : 1;

  const bonusHeat = dt > 0 ? heatRate * dt * Math.max(0, spawnSpeedMultiplier - 1) : 0;
  const { addedHeat, cooledHeat } = options.heat.advance(dt, { bonusHeat });

  let upkeepPerCycle = 0;
  for (const unit of options.units) {
    if (unit.isDead() || unit.faction !== 'player') {
      continue;
    }
    const upkeep = Math.max(0, sanitize(options.getUnitUpkeep(unit), 0));
    if (upkeep > 0) {
      upkeepPerCycle += upkeep;
    }
  }

  const upkeepIntervalSeconds = 5;
  const previousAccumulator = Math.max(0, sanitize(options.sauna.beerUpkeepAccumulator, 0));
  let accumulator = previousAccumulator;
  let upkeepDrain = 0;

  if (upkeepPerCycle > 0) {
    accumulator += dt;
    if (accumulator >= upkeepIntervalSeconds) {
      const ticks = Math.floor(accumulator / upkeepIntervalSeconds);
      upkeepDrain = upkeepPerCycle * ticks;
      accumulator -= ticks * upkeepIntervalSeconds;
    }
  } else {
    accumulator = 0;
  }

  options.sauna.beerUpkeepAccumulator = accumulator;

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
    maxSpawns: options.maxSpawns,
    rosterCap: options.rosterCap,
    getRosterCount: options.getRosterCount,
    tierHelpers: options.tierHelpers
  });

  const cooldown = options.heat.getCooldownSeconds();
  const timer = options.heat.timeUntilNextTrigger();

  options.sauna.heat = options.heat.getHeat();
  options.sauna.playerSpawnThreshold = options.heat.getThreshold();
  options.sauna.playerSpawnCooldown = Number.isFinite(cooldown)
    ? cooldown / spawnSpeedMultiplier
    : 0;
  options.sauna.playerSpawnTimer = Number.isFinite(timer) ? timer / spawnSpeedMultiplier : 0;
  options.sauna.heatPerTick = heatRate * spawnSpeedMultiplier;
  options.sauna.spawnSpeedMultiplier = spawnSpeedMultiplier;

  return {
    addedHeat,
    cooledHeat,
    upkeepDrain,
    spawn,
    beerRemaining: options.state.getResource(Resource.SAUNA_BEER),
    availableUpkeep: spawn.remainingUpkeep
  };
}
