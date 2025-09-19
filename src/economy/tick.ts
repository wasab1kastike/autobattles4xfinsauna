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

  const secondsPerUpkeepTick = 5;

  let perSecondUpkeep = 0;
  for (const unit of options.units) {
    if (unit.isDead() || unit.faction !== 'player') {
      continue;
    }
    const upkeep = Math.max(0, sanitize(options.getUnitUpkeep(unit), 0));
    if (upkeep > 0) {
      perSecondUpkeep += upkeep;
    }
  }

  if (!options.sauna.beerUpkeep) {
    options.sauna.beerUpkeep = { elapsed: 0, segments: [] };
  }

  const upkeepTracker = options.sauna.beerUpkeep;
  const segments = Array.isArray(upkeepTracker.segments) ? upkeepTracker.segments : [];
  if (!Array.isArray(upkeepTracker.segments)) {
    upkeepTracker.segments = segments;
  }

  const epsilon = 1e-6;
  const sanitizedElapsed = Math.max(0, sanitize(upkeepTracker.elapsed, 0));
  let elapsed = sanitizedElapsed + dt;

  if (dt > 0 && perSecondUpkeep > 0) {
    segments.push({ amount: perSecondUpkeep, duration: dt });
  }

  let upkeepDrain = 0;
  while (elapsed >= secondsPerUpkeepTick) {
    let remaining = secondsPerUpkeepTick;
    let drainedThisInterval = 0;

    while (remaining > epsilon && segments.length > 0) {
      const segment = segments[0];
      const amount = Math.max(0, sanitize(segment.amount, 0));
      const duration = Math.max(0, sanitize(segment.duration, 0));
      if (duration <= epsilon || amount <= 0) {
        segments.shift();
        continue;
      }

      const consumed = Math.min(duration, remaining);
      drainedThisInterval += amount * consumed;
      segment.duration = duration - consumed;
      segment.amount = amount;
      remaining -= consumed;

      if (segment.duration <= epsilon) {
        segments.shift();
      }
    }

    upkeepDrain += drainedThisInterval;
    elapsed -= secondsPerUpkeepTick;

    if (segments.length === 0) {
      elapsed = elapsed % secondsPerUpkeepTick;
      break;
    }
  }

  upkeepTracker.elapsed = elapsed;

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
