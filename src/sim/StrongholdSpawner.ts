const DEFAULT_COOLDOWN_SECONDS = 180;

function sanitizeCooldownSeconds(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_COOLDOWN_SECONDS;
  }
  return Math.max(1, numeric);
}

function sanitizeNonNegative(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }
  return numeric;
}

function sanitizeStrongholdId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface StrongholdSpawnerSnapshot {
  readonly cooldownSeconds: number;
  readonly elapsedSeconds: number;
  readonly timeUntilNextActivation: number;
  readonly queue: readonly string[];
}

export interface StrongholdSpawnerOptions {
  readonly cooldownSeconds?: number;
  readonly inactiveStrongholds?: readonly string[];
  readonly snapshot?: StrongholdSpawnerSnapshot | null | undefined;
}

export class StrongholdSpawner {
  private cooldownSeconds: number;
  private elapsedSeconds = 0;
  private timeUntilNextActivation: number;
  private queue: string[] = [];

  constructor(options: StrongholdSpawnerOptions = {}) {
    this.cooldownSeconds = sanitizeCooldownSeconds(options.cooldownSeconds);
    this.timeUntilNextActivation = this.cooldownSeconds;
    if (Array.isArray(options.inactiveStrongholds)) {
      this.queueInactiveStrongholds(options.inactiveStrongholds);
    }
    if (options.snapshot) {
      this.restore(options.snapshot);
    }
  }

  update(dtSeconds: number): string[] {
    const delta = Number(dtSeconds);
    if (!Number.isFinite(delta) || delta < 0) {
      return [];
    }

    if (delta > 0) {
      this.elapsedSeconds += delta;
      this.timeUntilNextActivation -= delta;
    }

    const activated: string[] = [];
    while (this.queue.length > 0 && this.timeUntilNextActivation <= 0) {
      const next = this.queue.shift();
      if (typeof next === 'string') {
        activated.push(next);
      }
      this.timeUntilNextActivation += this.cooldownSeconds;
    }

    if (this.queue.length === 0 && this.timeUntilNextActivation < 0) {
      this.timeUntilNextActivation = 0;
    }

    return activated;
  }

  queueInactiveStronghold(strongholdId: string): void {
    const sanitized = sanitizeStrongholdId(strongholdId);
    if (!sanitized) {
      return;
    }
    this.queue.push(sanitized);
  }

  queueInactiveStrongholds(strongholdIds: readonly string[]): void {
    for (const strongholdId of strongholdIds) {
      this.queueInactiveStronghold(strongholdId);
    }
  }

  getQueue(): readonly string[] {
    return [...this.queue];
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  getTimeUntilNextActivation(): number {
    return this.timeUntilNextActivation;
  }

  getSnapshot(): StrongholdSpawnerSnapshot {
    return {
      cooldownSeconds: this.cooldownSeconds,
      elapsedSeconds: this.elapsedSeconds,
      timeUntilNextActivation: this.timeUntilNextActivation,
      queue: [...this.queue]
    };
  }

  restore(snapshot: StrongholdSpawnerSnapshot | null | undefined): void {
    if (!snapshot) {
      return;
    }

    const restoredCooldown = sanitizeCooldownSeconds(snapshot.cooldownSeconds);
    this.cooldownSeconds = restoredCooldown;

    this.elapsedSeconds = sanitizeNonNegative(snapshot.elapsedSeconds);

    const remaining = sanitizeNonNegative(snapshot.timeUntilNextActivation);
    this.timeUntilNextActivation = Math.min(remaining, this.cooldownSeconds);

    const restoredQueue: string[] = [];
    if (Array.isArray(snapshot.queue)) {
      for (const strongholdId of snapshot.queue) {
        const sanitized = sanitizeStrongholdId(strongholdId);
        if (sanitized) {
          restoredQueue.push(sanitized);
        }
      }
    }
    this.queue = restoredQueue;
  }
}
