import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Animator } from './Animator.ts';
import { Unit } from '../units/Unit.ts';

function makeUnit(id = 'u1', start = { q: 0, r: 0 }): Unit {
  return new Unit(id, 'test', start, 'player', {
    health: 10,
    attackDamage: 1,
    attackRange: 1,
    movementRange: 1
  });
}

describe('Animator', () => {
  let originalRaf: typeof requestAnimationFrame | undefined;
  let originalCancel: typeof cancelAnimationFrame | undefined;

  beforeEach(() => {
    originalRaf = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    if (originalRaf) {
      globalThis.requestAnimationFrame = originalRaf;
    } else {
      delete (globalThis as any).requestAnimationFrame;
    }
    if (originalCancel) {
      globalThis.cancelAnimationFrame = originalCancel;
    } else {
      delete (globalThis as any).cancelAnimationFrame;
    }
  });

  it('eases render coordinates across tween segments', () => {
    const harness = createRafHarness();
    const redrawMarks: number[] = [];
    const animator = new Animator(() => redrawMarks.push(1));
    const unit = makeUnit();

    animator.enqueue(unit, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    expect(harness.pending()).toBe(1);
    expect(unit.renderCoord).toEqual({ q: 0, r: 0 });

    harness.advance(0);
    expect(harness.pending()).toBeGreaterThan(0);

    harness.advance(100);
    expect(unit.renderCoord.q).toBeCloseTo(0.5, 2);
    expect(unit.renderCoord.r).toBeCloseTo(0, 5);
    expect(redrawMarks.length).toBeGreaterThan(0);

    harness.advance(120);
    expect(unit.renderCoord.q).toBeCloseTo(1, 3);
    expect(unit.renderCoord.r).toBeCloseTo(0, 5);
    expect(harness.pending()).toBe(0);
  });

  it('queues additional steps smoothly when paths extend', () => {
    const harness = createRafHarness();
    const animator = new Animator(() => {});
    const unit = makeUnit();

    animator.enqueue(unit, [
      { q: 0, r: 0 },
      { q: 1, r: 0 }
    ]);

    harness.advance(0);
    expect(harness.pending()).toBeGreaterThan(0);

    harness.advance(100);
    animator.enqueue(unit, [
      { q: 1, r: 0 },
      { q: 2, r: 0 }
    ]);

    harness.advance(120);
    expect(unit.renderCoord.q).toBeCloseTo(1, 3);

    harness.advance(0);
    expect(harness.pending()).toBeGreaterThan(0);

    harness.advance(200);
    expect(unit.renderCoord.q).toBeCloseTo(2, 3);
    expect(harness.pending()).toBe(0);
  });
});

type FrameFn = (time: number) => void;

function createRafHarness(): { advance: (delta: number) => void; pending: () => number } {
  const callbacks: FrameFn[] = [];
  let now = 0;
  (globalThis as any).requestAnimationFrame = (cb: FrameFn) => {
    callbacks.push(cb);
    return callbacks.length;
  };
  (globalThis as any).cancelAnimationFrame = (id: number) => {
    const index = id - 1;
    if (index >= 0 && index < callbacks.length) {
      callbacks.splice(index, 1);
    }
  };
  return {
    advance(delta: number) {
      now += delta;
      const next = callbacks.shift();
      if (next) {
        next(now);
      }
    },
    pending() {
      return callbacks.length;
    }
  };
}
