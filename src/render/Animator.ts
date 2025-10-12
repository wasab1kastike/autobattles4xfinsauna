import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';

const SEGMENT_DURATION_MS = 200;
const EPSILON = 1e-3;

interface SegmentState {
  from: AxialCoord;
  to: AxialCoord;
  start: number;
}

interface AnimationTrack {
  unit: Unit;
  queue: AxialCoord[];
  current?: SegmentState;
}

function clone(coord: AxialCoord): AxialCoord {
  return { q: coord.q, r: coord.r };
}

function coordsEqual(a: AxialCoord | undefined, b: AxialCoord | undefined): boolean {
  if (!a || !b) {
    return false;
  }
  return Math.abs(a.q - b.q) < EPSILON && Math.abs(a.r - b.r) < EPSILON;
}

/**
 * Animator responsible for tweening unit render coordinates with smooth eased
 * transitions while requesting redraws only when active animations are
 * running.
 */
export class Animator {
  private readonly tracks = new Map<string, AnimationTrack>();
  private rafId: number | null = null;

  constructor(private readonly redraw: () => void) {}

  enqueue(unit: Unit, path: readonly AxialCoord[]): void {
    const normalized = this.normalizePath(path);
    if (normalized.length < 2) {
      this.clear(unit, { snap: true });
      return;
    }

    const start = normalized[0];
    let track = this.tracks.get(unit.id);

    if (!track) {
      track = { unit, queue: [] } satisfies AnimationTrack;
      this.tracks.set(unit.id, track);
      if (!coordsEqual(unit.renderCoord, start)) {
        unit.setRenderCoord(start);
      }
    } else if (track.current) {
      if (!coordsEqual(track.current.to, start)) {
        track = this.resetTrack(unit, start);
      }
    } else if (!coordsEqual(unit.renderCoord, start)) {
      // The unit has likely been teleported while idle; snap before starting.
      track = this.resetTrack(unit, start);
    }

    for (let i = 1; i < normalized.length; i++) {
      track.queue.push(clone(normalized[i]));
    }

    this.ensureRunning();
  }

  clear(unit: Unit, options?: { snap?: boolean }): void {
    if (!this.tracks.delete(unit.id)) {
      if (options?.snap) {
        unit.snapRenderToCoord();
        this.redraw();
      }
      return;
    }

    if (options?.snap ?? true) {
      unit.snapRenderToCoord();
      this.redraw();
    }

    if (this.tracks.size === 0 && this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }
  }

  clearAll(): void {
    for (const track of this.tracks.values()) {
      track.unit.snapRenderToCoord();
    }
    this.tracks.clear();
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
    this.redraw();
  }

  private resetTrack(unit: Unit, start: AxialCoord): AnimationTrack {
    this.clear(unit, { snap: false });
    const fresh: AnimationTrack = { unit, queue: [] };
    this.tracks.set(unit.id, fresh);
    unit.setRenderCoord(start);
    return fresh;
  }

  private ensureRunning(): void {
    if (this.rafId !== null || this.tracks.size === 0) {
      return;
    }
    this.rafId = requestAnimationFrame(this.step);
  }

  private normalizePath(path: readonly AxialCoord[]): AxialCoord[] {
    const normalized: AxialCoord[] = [];
    for (const coord of path) {
      const cloned = clone(coord);
      if (normalized.length === 0 || !coordsEqual(normalized[normalized.length - 1], cloned)) {
        normalized.push(cloned);
      }
    }
    return normalized;
  }

  private ease(t: number): number {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  private step = (time: number): void => {
    this.rafId = null;
    if (this.tracks.size === 0) {
      return;
    }

    let needsRedraw = false;

    for (const [id, track] of this.tracks) {
      if (!track.current) {
        const nextTarget = track.queue.shift();
        if (!nextTarget) {
          this.tracks.delete(id);
          continue;
        }
        track.current = {
          from: clone(track.unit.renderCoord ?? track.unit.coord),
          to: nextTarget,
          start: time
        } satisfies SegmentState;
      }

      const current = track.current;
      if (!current) {
        continue;
      }

      const elapsed = time - current.start;
      const rawProgress = elapsed / SEGMENT_DURATION_MS;
      const clamped = Math.min(1, Math.max(0, rawProgress));
      const eased = this.ease(clamped);
      const q = current.from.q + (current.to.q - current.from.q) * eased;
      const r = current.from.r + (current.to.r - current.from.r) * eased;
      track.unit.setRenderCoord({ q, r });
      needsRedraw = true;

      if (clamped >= 1) {
        track.unit.setRenderCoord(current.to);
        track.current = undefined;
        if (track.queue.length === 0) {
          this.tracks.delete(id);
        }
      }
    }

    if (needsRedraw) {
      this.redraw();
    }

    if (this.tracks.size > 0) {
      this.rafId = requestAnimationFrame(this.step);
    }
  };
}

export default Animator;
