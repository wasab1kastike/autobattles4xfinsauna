import { AxialCoord, axialToPixel } from '../hex/HexUtils.ts';

/**
 * Track revealed hexes and compute a camera frame that fits them
 * into a viewport. The revealed hexes are stored as "q,r" strings.
 */
export const revealedHexes = new Set<string>();

export interface ViewportSize {
  width: number;
  height: number;
}

export interface FrameResult {
  center: { x: number; y: number };
  zoom: number;
}

const PADDING = 96;
const HEX_SIZE = 32;
const HEX_WIDTH = HEX_SIZE * Math.sqrt(3);
const HEX_HEIGHT = HEX_SIZE * 2;

/** Register a revealed hex coordinate. */
export function addRevealedHex(coord: AxialCoord): void {
  revealedHexes.add(`${coord.q},${coord.r}`);
}

/**
 * Compute the center and zoom so all revealed tiles fit within the given
 * viewport size with padding. If no tiles are revealed, returns a default
 * frame at the origin with zoom 1.
 */
export function autoFrame(viewport: ViewportSize): FrameResult {
  if (revealedHexes.size === 0) {
    return { center: { x: 0, y: 0 }, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const key of revealedHexes) {
    const [qStr, rStr] = key.split(',');
    const q = Number(qStr);
    const r = Number(rStr);
    const { x, y } = axialToPixel({ q, r }, HEX_SIZE);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + HEX_WIDTH);
    maxY = Math.max(maxY, y + HEX_HEIGHT);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  const zoom = Math.min(
    viewport.width / (width + PADDING * 2),
    viewport.height / (height + PADDING * 2)
  );

  return { center, zoom };
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/** Global camera state */
export const camera: CameraState = { x: 0, y: 0, zoom: 1 };

/**
 * Tween the global camera state to the provided center/zoom over the
 * specified duration (default 300ms).
 */
export function tweenCamera(target: FrameResult, duration = 300): void {
  const start = { x: camera.x, y: camera.y, zoom: camera.zoom };
  const startTime = performance.now();

  function step(now: number): void {
    const t = Math.min((now - startTime) / duration, 1);
    camera.x = start.x + (target.center.x - start.x) * t;
    camera.y = start.y + (target.center.y - start.y) * t;
    camera.zoom = start.zoom + (target.zoom - start.zoom) * t;
    if (t < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

