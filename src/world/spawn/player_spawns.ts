import type { AxialCoord } from '../../hex/HexUtils.ts';
import type { SaunaHeat } from '../../sauna/heat.ts';
import type { Unit } from '../../units/Unit.ts';
import { SAUNOJA_UPKEEP_MIN } from '../../units/saunoja.ts';
import type { PlayerSpawnTierHelpers } from './tier_helpers.ts';

const FALLBACK_UPKEEP_RESERVE = 1;

export interface PlayerSpawnOptions {
  /** Sauna heat tracker controlling spawn readiness. */
  heat: SaunaHeat;
  /** Beer remaining after upkeep drains this tick. */
  availableUpkeep: number;
  /** Callback to find a free coordinate for the next spawn. */
  pickSpawnTile: () => AxialCoord | null;
  /** Factory invoked once a coordinate has been chosen. */
  spawnUnit: (coord: AxialCoord) => Unit | null;
  /** Minimum upkeep buffer required before attempting another spawn. */
  minUpkeepReserve?: number;
  /** Hard cap on spawns processed in a single tick. */
  maxSpawns?: number;
  /** Active roster limit configured by the player and NG+ unlocks. */
  rosterCap?: number;
  /** Callback to read the number of active attendants on the field. */
  getRosterCount?: () => number;
  /** Helper managing tier-based spawn queues and alerts. */
  tierHelpers?: PlayerSpawnTierHelpers;
}

export interface PlayerSpawnResult {
  /** Number of units successfully spawned. */
  spawned: number;
  /** Spawn opportunities skipped because upkeep was exhausted. */
  blockedByUpkeep: number;
  /** Spawn attempts skipped because no valid tile was available. */
  blockedByPosition: number;
  /** Spawn attempts skipped because the roster cap was reached. */
  blockedByRoster: number;
  /** Spawn attempts that failed after acquiring a tile. */
  failedSpawns: number;
  /** Total heat vented because spawns were blocked. */
  ventedHeat: number;
  /** Remaining upkeep buffer after processing spawns. */
  remainingUpkeep: number;
}

function sanitize(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function processPlayerSpawns(options: PlayerSpawnOptions): PlayerSpawnResult {
  const {
    heat,
    pickSpawnTile,
    spawnUnit,
    maxSpawns,
    tierHelpers
  } = options;

  const reserveFallback = Math.max(FALLBACK_UPKEEP_RESERVE, SAUNOJA_UPKEEP_MIN);
  const minReserve = Math.max(0, sanitize(options.minUpkeepReserve ?? reserveFallback, reserveFallback));
  let available = Math.max(0, sanitize(options.availableUpkeep, 0));
  const spawnLimit = Math.max(
    0,
    Math.floor(sanitize(maxSpawns ?? Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY))
  );
  const rawRosterCap = sanitize(options.rosterCap ?? Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const rosterLimit = Number.isFinite(rawRosterCap)
    ? Math.max(0, Math.floor(rawRosterCap))
    : Number.POSITIVE_INFINITY;
  const getRosterCount = typeof options.getRosterCount === 'function' ? options.getRosterCount : () => 0;

  let processed = 0;
  let ventedHeat = 0;
  let spawned = 0;
  let blockedByUpkeep = 0;
  let blockedByPosition = 0;
  let blockedByRoster = 0;
  let failedSpawns = 0;

  while ((heat.hasTriggerReady() || tierHelpers?.hasQueuedSpawn()) && processed < spawnLimit) {
    processed += 1;

    const snapshot = tierHelpers?.getSnapshot() ?? null;
    const rosterCount = Math.max(0, Math.floor(sanitize(getRosterCount() ?? 0, 0)));
    if (rosterCount >= rosterLimit) {
      blockedByRoster += 1;
      let queued = false;
      if (snapshot && tierHelpers) {
        queued = tierHelpers.queueBlockedSpawn(snapshot, () => heat.consumeTrigger());
      }
      if (queued) {
        ventedHeat += heat.vent(0.15);
      } else {
        ventedHeat += heat.vent(0.35);
      }
      break;
    }

    let usedQueue = false;
    if (snapshot && tierHelpers) {
      if (tierHelpers.hasQueuedSpawn()) {
        usedQueue = tierHelpers.takeQueuedSpawn(snapshot);
      }
    }

    if (!usedQueue && !heat.hasTriggerReady()) {
      break;
    }

    if (available < minReserve) {
      blockedByUpkeep += 1;
      if (usedQueue && snapshot) {
        tierHelpers?.restoreQueuedSpawn(snapshot);
      }
      ventedHeat += heat.vent(0.5);
      break;
    }

    const coord = pickSpawnTile();
    if (!coord) {
      blockedByPosition += 1;
      if (usedQueue && snapshot) {
        tierHelpers?.restoreQueuedSpawn(snapshot);
      }
      ventedHeat += heat.vent(0.25);
      break;
    }

    const unit = spawnUnit(coord);
    if (!unit) {
      failedSpawns += 1;
      if (usedQueue && snapshot) {
        tierHelpers?.restoreQueuedSpawn(snapshot);
      }
      ventedHeat += heat.vent(0.25);
      break;
    }

    if (!usedQueue) {
      const consumed = heat.consumeTrigger();
      if (!consumed) {
        // Safety break to avoid infinite loops if the tracker rejects the trigger.
        failedSpawns += 1;
        break;
      }
    }

    spawned += 1;
    available = Math.max(0, available - minReserve);
    if (snapshot) {
      tierHelpers?.onSpawnResolved?.(snapshot, { usedQueue });
    }
  }

  return {
    spawned,
    blockedByUpkeep,
    blockedByPosition,
    blockedByRoster,
    failedSpawns,
    ventedHeat,
    remainingUpkeep: available
  };
}
