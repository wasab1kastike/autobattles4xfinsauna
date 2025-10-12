import type { SaunaTier } from '../../sauna/tiers.ts';
import type { LogEventPayload } from '../../ui/logging.ts';

function clampCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

export interface PlayerSpawnTierSnapshot {
  tierId: string;
  tierName: string;
  rosterLimit: number;
  rosterCount: number;
  queued: number;
}

export interface PlayerSpawnTierHelpers {
  getSnapshot(): PlayerSpawnTierSnapshot | null;
  hasQueuedSpawn(): boolean;
  takeQueuedSpawn(snapshot: PlayerSpawnTierSnapshot): boolean;
  restoreQueuedSpawn(snapshot: PlayerSpawnTierSnapshot): void;
  queueBlockedSpawn(
    snapshot: PlayerSpawnTierSnapshot,
    consumeTrigger: () => boolean
  ): boolean;
  onSpawnResolved?(
    snapshot: PlayerSpawnTierSnapshot,
    context: { usedQueue: boolean }
  ): void;
  clearQueue?(reason?: 'tier-change' | 'reset'): void;
}

export interface PlayerSpawnTierQueueOptions {
  getTier(): SaunaTier;
  getRosterLimit(): number;
  getRosterCount(): number;
  log?: (event: LogEventPayload) => void;
  queueCapacity?: number;
}

function formatQueueStatus(queue: number, capacity: number): string {
  if (capacity <= 0) {
    return '';
  }
  return `${queue}/${capacity}`;
}

export function createPlayerSpawnTierQueue(
  options: PlayerSpawnTierQueueOptions
): PlayerSpawnTierHelpers {
  let queued = 0;
  const capacity = Math.max(0, clampCount(options.queueCapacity ?? 2));

  const emitLog = (message: string, metadata?: Record<string, unknown>): void => {
    if (message && typeof options.log === 'function') {
      options.log({
        type: 'system',
        message,
        metadata: {
          context: 'spawn-queue',
          ...metadata
        }
      });
    }
  };

  const buildSnapshot = (): PlayerSpawnTierSnapshot | null => {
    const tier = options.getTier();
    if (!tier) {
      return null;
    }
    const rosterLimit = clampCount(options.getRosterLimit());
    const rosterCount = clampCount(options.getRosterCount());
    return {
      tierId: tier.id,
      tierName: tier.name,
      rosterLimit,
      rosterCount,
      queued
    } satisfies PlayerSpawnTierSnapshot;
  };

  const helpers: PlayerSpawnTierHelpers = {
    getSnapshot: () => buildSnapshot(),
    hasQueuedSpawn: () => queued > 0,
    takeQueuedSpawn: (snapshot) => {
      if (queued <= 0) {
        return false;
      }
      queued -= 1;
      if (queued <= 0) {
        emitLog(`The benches of ${snapshot.tierName} exhale — queued attendants take the field.`, {
          tierId: snapshot.tierId,
          tierName: snapshot.tierName,
          queue: queued,
          capacity
        });
      } else {
        emitLog(
          `${snapshot.tierName} deploys a queued attendant. ` +
            `Relief teams remaining: ${formatQueueStatus(queued, capacity)}.`,
          {
            tierId: snapshot.tierId,
            tierName: snapshot.tierName,
            queue: queued,
            capacity
          }
        );
      }
      return true;
    },
    restoreQueuedSpawn: (snapshot) => {
      if (capacity > 0 && queued >= capacity) {
        return;
      }
      queued += 1;
      if (capacity > 0) {
        queued = Math.min(queued, capacity);
      }
      emitLog(
        `${snapshot.tierName} keeps the relief attendant on standby ` +
          `(${formatQueueStatus(queued, capacity)} ready).`,
        {
          tierId: snapshot.tierId,
          tierName: snapshot.tierName,
          queue: queued,
          capacity
        }
      );
    },
    queueBlockedSpawn: (snapshot, consumeTrigger) => {
      if (capacity > 0 && queued >= capacity) {
        emitLog(
          `${snapshot.tierName} cannot hold more relief attendants — clear a slot to vent the pressure.`,
          {
            tierId: snapshot.tierId,
            tierName: snapshot.tierName,
            queue: queued,
            capacity
          }
        );
        return false;
      }
      const consumed = consumeTrigger();
      if (!consumed) {
        return false;
      }
      queued += 1;
      if (capacity > 0) {
        queued = Math.min(queued, capacity);
      }
      emitLog(
        `${snapshot.tierName} queues a ready attendant in the wings ` +
          `(${formatQueueStatus(queued, capacity)} poised).`,
        {
          tierId: snapshot.tierId,
          tierName: snapshot.tierName,
          queue: queued,
          capacity
        }
      );
      return true;
    },
    onSpawnResolved: (snapshot, context) => {
      if (context.usedQueue) {
        if (queued > 0) {
          emitLog(
            `${snapshot.tierName} still has relief attendants waiting ` +
              `(${formatQueueStatus(queued, capacity)}).`,
            {
              tierId: snapshot.tierId,
              tierName: snapshot.tierName,
              queue: queued,
              capacity
            }
          );
        } else {
          emitLog(`${snapshot.tierName} has cleared the relief queue.`, {
            tierId: snapshot.tierId,
            tierName: snapshot.tierName,
            queue: queued,
            capacity
          });
        }
      }
    },
    clearQueue: (reason) => {
      if (queued <= 0) {
        return;
      }
      queued = 0;
        if (reason === 'tier-change') {
          const tier = options.getTier();
          if (tier) {
            emitLog(`${tier.name} ushers its queued attendants into the new hall.`, {
              tierId: tier.id,
              tierName: tier.name,
              queue: queued,
              capacity
            });
          }
        }
    }
  } satisfies PlayerSpawnTierHelpers;

  return helpers;
}
