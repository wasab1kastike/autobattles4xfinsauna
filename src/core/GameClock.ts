export type TickCallback = (deltaMs: number) => void;

/**
 * GameClock schedules fixed interval ticks and allows speed multipliers
 * to accelerate or decelerate the tick rate.
 */
export class GameClock {
  private timer: ReturnType<typeof setInterval> | null = null;
  private speed = 1;
  private lastTick = 0;
  private accumulator = 0;
  private running = false;
  private intervalEnabled = true;

  constructor(private readonly baseInterval: number, private readonly onTick: TickCallback) {}

  /** Start ticking. */
  start(): void {
    this.stop();
    this.running = true;
    this.accumulator = 0;
    this.lastTick = Date.now();
    this.setupTimer();
  }

  /** Stop ticking. */
  stop(): void {
    this.running = false;
    this.clearTimer();
  }

  /** Set the speed multiplier and restart ticking if running. */
  setSpeed(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Speed multiplier must be positive');
    }
    this.speed = multiplier;
    if (this.running && this.intervalEnabled) {
      this.setupTimer();
    }
  }

  getSpeed(): number {
    return this.speed;
  }

  getBaseInterval(): number {
    return this.baseInterval;
  }

  /**
   * Advance the clock manually by `deltaMs` time. This can be called from an
   * animation frame loop to keep ticks in sync with rendering.
   */
  tick(deltaMs: number): void {
    if (this.timer !== null) {
      return;
    }
    this.accumulator += deltaMs * this.speed;
    while (this.accumulator >= this.baseInterval) {
      this.accumulator -= this.baseInterval;
      this.onTick(this.baseInterval);
    }
  }

  /**
   * Enable or disable the internal interval driver. When disabled, the clock
   * can still be advanced via {@link tick}.
   */
  setIntervalEnabled(enabled: boolean): void {
    if (this.intervalEnabled === enabled) {
      return;
    }
    this.intervalEnabled = enabled;
    if (!enabled) {
      this.clearTimer();
      return;
    }
    if (this.running) {
      this.lastTick = Date.now();
      this.setupTimer();
    }
  }

  private setupTimer(): void {
    this.clearTimer();
    if (!this.running || !this.intervalEnabled) {
      return;
    }
    const interval = this.baseInterval / this.speed;
    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this.onTick(delta);
    }, interval);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
