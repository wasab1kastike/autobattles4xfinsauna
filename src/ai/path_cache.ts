import type { AxialCoord } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import type { Unit } from '../units/Unit.ts';

function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

interface CacheEntry {
  path: AxialCoord[];
  expiresAt: number;
  targetId?: string;
}

interface PathOptions {
  now?: number;
  targetId?: string;
}

const DEFAULT_TTL_MS = 500;

/**
 * Provides a short-lived cache around {@link Unit.getPathTo} that incorporates
 * the unit's position, target position, and current obstacles. Cached paths are
 * automatically invalidated when the target moves or when the TTL expires.
 */
export class PathCache {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly targetIndex = new Map<string, Set<string>>();
  private readonly targetPositions = new Map<string, string>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  clearExpired(now = Date.now()): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        if (entry.targetId) {
          const keys = this.targetIndex.get(entry.targetId);
          keys?.delete(key);
          if (keys && keys.size === 0) {
            this.targetIndex.delete(entry.targetId);
          }
        }
      }
    }
  }

  trackUnit(unit: Unit): void {
    this.invalidateIfTargetMoved(unit.id, coordKey(unit.coord));
  }

  invalidateForUnit(unitId: string): void {
    const keys = this.targetIndex.get(unitId);
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      this.targetIndex.delete(unitId);
    }
    this.targetPositions.delete(unitId);
  }

  getPath(
    unit: Unit,
    target: AxialCoord,
    map: HexMap,
    occupied: Set<string>,
    options: PathOptions = {}
  ): AxialCoord[] {
    const now = options.now ?? Date.now();
    const targetId = options.targetId;
    const destinationKey = coordKey(target);

    if (targetId) {
      this.invalidateIfTargetMoved(targetId, destinationKey);
    }

    const obstaclesHash = this.hashObstacles(occupied);
    const cacheKey = this.createCacheKey(coordKey(unit.coord), destinationKey, obstaclesHash);
    const entry = this.cache.get(cacheKey);
    if (entry && entry.expiresAt > now) {
      return entry.path;
    }

    unit.clearPathCache();
    const path = unit.getPathTo(target, map, occupied);

    this.cache.set(cacheKey, {
      path,
      expiresAt: now + this.ttlMs,
      targetId
    });

    if (targetId) {
      let keys = this.targetIndex.get(targetId);
      if (!keys) {
        keys = new Set<string>();
        this.targetIndex.set(targetId, keys);
      }
      keys.add(cacheKey);
      this.targetPositions.set(targetId, destinationKey);
    }

    return path;
  }

  private invalidateIfTargetMoved(targetId: string, destinationKey: string): void {
    const lastPosition = this.targetPositions.get(targetId);
    if (!lastPosition) {
      this.targetPositions.set(targetId, destinationKey);
      return;
    }

    if (lastPosition === destinationKey) {
      return;
    }

    const keys = this.targetIndex.get(targetId);
    if (keys) {
      for (const key of keys) {
        this.cache.delete(key);
      }
      keys.clear();
    }

    this.targetPositions.set(targetId, destinationKey);
  }

  private hashObstacles(occupied: Set<string>): string {
    if (occupied.size === 0) {
      return 'empty';
    }
    const sorted = Array.from(occupied).sort();
    return sorted.join('|');
  }

  private createCacheKey(fromKey: string, toKey: string, obstaclesHash: string): string {
    return `${fromKey}->${toKey}|${obstaclesHash}`;
  }
}
