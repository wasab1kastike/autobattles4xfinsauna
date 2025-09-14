import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';

interface Animation {
  unit: Unit;
  path: AxialCoord[];
  startTime: number;
  duration: number; // total duration in ms
  onComplete?: () => void;
}

/**
 * Simple animator that interpolates unit movement along a path
 * using `requestAnimationFrame` and triggers redraws.
 */
export class Animator {
  private animations: Animation[] = [];

  constructor(private readonly redraw: () => void) {}

  /**
   * Animate a unit along the provided path. The path must include
   * the unit's current coordinate as the first element.
   */
  animate(unit: Unit, path: AxialCoord[], durationPerHex = 250, onComplete?: () => void): void {
    if (path.length < 2) return;
    const duration = durationPerHex * (path.length - 1);
    this.animations.push({
      unit,
      path,
      startTime: performance.now(),
      duration,
      onComplete
    });
    if (this.animations.length === 1) {
      requestAnimationFrame(this.step);
    }
  }

  private step = (time: number): void => {
    if (this.animations.length === 0) return;
    let needsRedraw = false;
    this.animations = this.animations.filter((anim) => {
      const elapsed = time - anim.startTime;
      const totalSegments = anim.path.length - 1;
      const t = Math.min(elapsed / anim.duration, 1);
      const progress = t * totalSegments;
      const index = Math.floor(progress);
      const segT = progress - index;
      const from = anim.path[index];
      const to = anim.path[index + 1] ?? from;
      anim.unit.coord = {
        q: from.q + (to.q - from.q) * segT,
        r: from.r + (to.r - from.r) * segT
      };
      needsRedraw = true;
      if (t >= 1) {
        anim.unit.coord = anim.path[anim.path.length - 1];
        anim.onComplete?.();
        return false;
      }
      return true;
    });
    if (needsRedraw) {
      this.redraw();
    }
    if (this.animations.length > 0) {
      requestAnimationFrame(this.step);
    }
  };
}

export default Animator;
