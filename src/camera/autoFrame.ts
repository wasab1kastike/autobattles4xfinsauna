import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { lerp } from '../lib/tween.ts';

/** Set of revealed hex coordinates serialized as "q,r" strings. */
const revealedHexes = new Set<string>();
let currentHexSize = 32;

function key(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

/** Track a hex as revealed and update the current hex size. */
export function markRevealed(coord: AxialCoord, hexSize: number): void {
  currentHexSize = hexSize;
  revealedHexes.add(key(coord));
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface CameraFrame {
  center: PixelCoord;
  zoom: number;
}

/**
 * Compute the axis-aligned bounding box of all revealed hex tiles and return
 * a camera center and zoom that fits them within the given viewport while
 * leaving 96px padding on all sides.
 */
export function autoFrame(viewport: ViewportSize): CameraFrame {
  if (revealedHexes.size === 0) {
    return { center: { x: 0, y: 0 }, zoom: 1 };
  }

  const hexWidth = currentHexSize * Math.sqrt(3);
  const hexHeight = currentHexSize * 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const h of revealedHexes) {
    const [q, r] = h.split(',').map(Number);
    const { x, y } = axialToPixel({ q, r }, currentHexSize);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + hexWidth);
    maxY = Math.max(maxY, y + hexHeight);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const padding = 96;
  const center = { x: minX + width / 2, y: minY + height / 2 };
  const zoomX = viewport.width / (width + padding * 2);
  const zoomY = viewport.height / (height + padding * 2);
  const zoom = Math.min(zoomX, zoomY);
  return { center, zoom };
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/** Simple camera state manipulated by tweenCamera. */
export const camera: CameraState = { x: 0, y: 0, zoom: 1 };

/**
 * Tween the global camera state toward the target frame over the given
 * duration (default 300ms).
 */
export function tweenCamera(target: CameraFrame, duration = 300): void {
  const startX = camera.x;
  const startY = camera.y;
  const startZoom = camera.zoom;
  const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

  const step = (now: number) => {
    const t = Math.min((now - startTime) / duration, 1);
    camera.x = lerp(startX, target.center.x, t);
    camera.y = lerp(startY, target.center.y, t);
    camera.zoom = lerp(startZoom, target.zoom, t);
    if (t < 1) {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(step);
      } else {
        setTimeout(() => step(typeof performance !== 'undefined' ? performance.now() : Date.now()), 16);
      }
    }
  };

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(step);
  } else {
    setTimeout(() => step(typeof performance !== 'undefined' ? performance.now() : Date.now()), 0);
  }
}

/** Clear all tracked revealed tiles. Useful when starting a new game. */
export function resetAutoFrame(): void {
  revealedHexes.clear();
}

export { revealedHexes };
