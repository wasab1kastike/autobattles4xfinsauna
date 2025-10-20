const DEFAULT_COOLDOWN_SECONDS = 180;

function sanitizeCooldown(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(1, numeric);
}

function sanitizeSeconds(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.max(0, numeric);
}

function sanitizeStrongholdId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export interface StrongholdSpawnerSnapshot {
  readonly elapsedSeconds: number;
  readonly cooldownSeconds: number;
  readonly cooldownRemaining: number;
  readonly queue: readonly string[];
}

export interface StrongholdSpawnerOptions {
  readonly cooldownSeconds?: number;
  readonly initialQueue?: readonly string[];
  readonly snapshot?: StrongholdSpawnerSnapshot | null;
}

export class StrongholdSpawner {
  private cooldownSeconds: number;
  private elapsedSeconds: number;
  private cooldownRemaining: number;
  private readonly queue: string[] = [];
  private readonly queuedIds = new Set<string>();

  constructor(options: StrongholdSpawnerOptions = {}) {
    const desiredCooldown = sanitizeCooldown(options.cooldownSeconds, DEFAULT_COOLDOWN_SECONDS);
    this.cooldownSeconds = desiredCooldown;
    this.elapsedSeconds = 0;
    this.cooldownRemaining = this.cooldownSeconds;

    if (options.snapshot) {
      this.restore(options.snapshot);
    }

    if (Array.isArray(options.initialQueue)) {
      this.queueStrongholds(options.initialQueue);
    }
  }

  update(dtSeconds: number): readonly string[] {
    if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
      return [];
    }

    this.elapsedSeconds += dtSeconds;
    this.cooldownRemaining -= dtSeconds;

    const activations: string[] = [];

    while (this.cooldownRemaining <= 0 && this.queue.length > 0) {
      const nextId = this.queue.shift();
      if (typeof nextId !== 'string') {
        this.cooldownRemaining = Math.max(this.cooldownRemaining, 0);
        break;
      }

      this.queuedIds.delete(nextId);
      activations.push(nextId);
      this.cooldownRemaining += this.cooldownSeconds;
    }

    if (this.queue.length === 0 && this.cooldownRemaining < 0) {
      this.cooldownRemaining = 0;
    }

    return activations;
  }

  queueStronghold(id: string): void {
    const sanitized = sanitizeStrongholdId(id);
    if (!sanitized || this.queuedIds.has(sanitized)) {
      return;
    }

    this.queue.push(sanitized);
    this.queuedIds.add(sanitized);
  }

  queueStrongholds(ids: readonly string[]): void {
    for (const id of ids) {
      this.queueStronghold(id);
    }
  }

  removeStronghold(id: string): void {
    const sanitized = sanitizeStrongholdId(id);
    if (!sanitized || !this.queuedIds.delete(sanitized)) {
      return;
    }

    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index] === sanitized) {
        this.queue.splice(index, 1);
      }
    }
  }

  peekQueue(): readonly string[] {
    return [...this.queue];
  }

  getElapsedSeconds(): number {
    return this.elapsedSeconds;
  }

  getCooldownRemaining(): number {
    return this.queue.length > 0 ? this.cooldownRemaining : Math.max(this.cooldownRemaining, 0);
  }

  getSnapshot(): StrongholdSpawnerSnapshot {
    return {
      elapsedSeconds: this.elapsedSeconds,
      cooldownSeconds: this.cooldownSeconds,
      cooldownRemaining: this.getCooldownRemaining(),
      queue: this.peekQueue()
    };
  }

  restore(snapshot: StrongholdSpawnerSnapshot | null | undefined): void {
    this.queue.length = 0;
    this.queuedIds.clear();

    if (!snapshot) {
      this.elapsedSeconds = 0;
      this.cooldownRemaining = this.cooldownSeconds;
      return;
    }

    this.cooldownSeconds = sanitizeCooldown(snapshot.cooldownSeconds, this.cooldownSeconds);
    this.elapsedSeconds = sanitizeSeconds(snapshot.elapsedSeconds, 0);
    const remaining = sanitizeSeconds(snapshot.cooldownRemaining, this.cooldownSeconds);
    this.cooldownRemaining = Math.min(remaining, this.cooldownSeconds);

    if (Array.isArray(snapshot.queue)) {
      this.queueStrongholds(snapshot.queue);
    }
  }
}
