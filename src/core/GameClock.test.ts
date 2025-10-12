import { describe, it, expect, vi } from 'vitest';
import { GameClock } from './GameClock';

describe('GameClock', () => {
  it('ticks at adjusted intervals when speed changes', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const clock = new GameClock(1000, cb);

    clock.start();
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);

    clock.setSpeed(2); // double speed -> half interval
    vi.advanceTimersByTime(500);
    expect(cb).toHaveBeenCalledTimes(2);

    clock.stop();
    vi.useRealTimers();
  });
});
