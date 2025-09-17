import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { autoFrame, markRevealed, resetAutoFrame } from './autoFrame.ts';

describe('autoFrame', () => {
  beforeEach(() => {
    resetAutoFrame();
  });

  afterEach(() => {
    resetAutoFrame();
  });

  it('reduces zoom and shifts the center when the right HUD column occludes the view', () => {
    markRevealed({ q: 0, r: 0 }, 32);
    markRevealed({ q: 1, r: 0 }, 32);

    const viewport = { width: 600, height: 2000 };
    const baseFrame = autoFrame(viewport);

    const safeRight = 200;
    const occludedFrame = autoFrame({ ...viewport, safeRight });

    expect(occludedFrame.zoom).toBeLessThan(baseFrame.zoom);

    const expectedShift = safeRight / (2 * occludedFrame.zoom);
    expect(occludedFrame.center.x).toBeCloseTo(baseFrame.center.x - expectedShift, 5);
    expect(occludedFrame.center.y).toBeCloseTo(baseFrame.center.y, 5);
  });
});
