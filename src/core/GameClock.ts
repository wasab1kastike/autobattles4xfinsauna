export type TickCallback = (deltaMs: number) => void;

/**
 * GameClock schedules fixed interval ticks and allows speed multipliers
 * to accelerate or decelerate the tick rate.
 */
export class GameClock {
  private timer: ReturnType<typeof setInterval> | null = null;
  private speed = 1;
  private lastTick = 0;

  constructor(private readonly baseInterval: number, private readonly onTick: TickCallback) {}

  /** Start ticking. */
  start(): void {
    this.stop();
    this.lastTick = Date.now();
    const interval = this.baseInterval / this.speed;
    this.timer = setInterval(() => {
      const now = Date.now();
      const delta = now - this.lastTick;
      this.lastTick = now;
      this.onTick(delta);
    }, interval);
  }

  /** Stop ticking. */
  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Set the speed multiplier and restart ticking if running. */
  setSpeed(multiplier: number): void {
    if (multiplier <= 0) {
      throw new Error('Speed multiplier must be positive');
    }
    this.speed = multiplier;
    if (this.timer !== null) {
      this.start();
    }
  }

  getSpeed(): number {
    return this.speed;
  }

  getBaseInterval(): number {
    return this.baseInterval;
  }
}
