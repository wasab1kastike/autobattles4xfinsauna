import { describe, it, expect, vi } from 'vitest';
import { GameClock } from './GameClock';

describe('GameClock', () => {
  it('ticks at adjusted intervals when speed changes', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const clock = new GameClock(1000, cb);

    try {
      clock.start();
      vi.advanceTimersByTime(1000);
      expect(cb).toHaveBeenCalledTimes(1);

      clock.setSpeed(2); // double speed -> half interval
      vi.advanceTimersByTime(500);
      expect(cb).toHaveBeenCalledTimes(2);
    } finally {
      clock.stop();
      vi.useRealTimers();
    }
  });

  it('fires at most once per base interval when driven by animation frames', () => {
    vi.useFakeTimers();
    const cb = vi.fn();
    const clock = new GameClock(100, cb);

    try {
      clock.start();
      clock.setIntervalEnabled(false);

      for (let i = 0; i < 5; i += 1) {
        clock.tick(20);
        vi.advanceTimersByTime(20);
      }

      expect(cb).toHaveBeenCalledTimes(1);

      clock.tick(100);
      expect(cb).toHaveBeenCalledTimes(2);
    } finally {
      clock.stop();
      vi.useRealTimers();
    }
  });
});
