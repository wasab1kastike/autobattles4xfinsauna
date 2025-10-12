import type { Unit } from '../units/Unit.ts';

interface SchedulerOptions {
  minBuckets?: number;
  maxBuckets?: number;
}

const DEFAULT_MIN_BUCKETS = 4;
const DEFAULT_MAX_BUCKETS = 8;

/**
 * Splits a collection of units into a fixed number of round-robin buckets and
 * rotates through them each tick to smooth the per-frame workload.
 */
export class RoundRobinScheduler {
  private buckets: Unit[][] = [];
  private bucketCount = 0;
  private currentBucket = 0;
  private readonly minBuckets: number;
  private readonly maxBuckets: number;

  constructor(options: SchedulerOptions = {}) {
    this.minBuckets = options.minBuckets ?? DEFAULT_MIN_BUCKETS;
    this.maxBuckets = options.maxBuckets ?? DEFAULT_MAX_BUCKETS;
  }

  reset(): void {
    this.buckets = [];
    this.bucketCount = 0;
    this.currentBucket = 0;
  }

  /**
   * Returns the next slice of units to process this tick. The returned array is
   * a snapshot of the bucket for the current tick and should be treated as
   * readonly by callers.
   */
  next(units: readonly Unit[]): readonly Unit[] {
    const totalUnits = units.length;
    if (totalUnits === 0) {
      this.reset();
      return [];
    }

    const bucketCount = this.computeBucketCount(totalUnits);
    if (bucketCount !== this.bucketCount) {
      this.bucketCount = bucketCount;
      this.currentBucket = this.currentBucket % Math.max(1, bucketCount);
    }

    this.rebuildBuckets(units);

    const bucket = this.buckets[this.currentBucket] ?? [];
    if (this.bucketCount > 0) {
      this.currentBucket = (this.currentBucket + 1) % this.bucketCount;
    }
    return bucket;
  }

  private rebuildBuckets(units: readonly Unit[]): void {
    const bucketCount = this.bucketCount;
    this.buckets = Array.from({ length: bucketCount }, () => []);

    const orderedUnits = [...units].sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 0; i < orderedUnits.length; i++) {
      const bucketIndex = i % bucketCount;
      this.buckets[bucketIndex].push(orderedUnits[i]);
    }
  }

  private computeBucketCount(totalUnits: number): number {
    if (totalUnits <= 0) {
      return 0;
    }

    const desired = Math.ceil(totalUnits / 12);
    let bucketCount = Math.max(this.minBuckets, desired);
    bucketCount = Math.min(this.maxBuckets, bucketCount);
    bucketCount = Math.min(bucketCount, totalUnits);
    bucketCount = Math.max(1, bucketCount);
    return bucketCount;
  }
}
