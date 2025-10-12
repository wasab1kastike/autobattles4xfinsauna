import { camera } from './autoFrame.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import { invalidateFrame } from '../game.ts';

export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 3.5;

function screenToWorldWith(
  canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  zoom: number,
  center: PixelCoord
): PixelCoord {
  const rect = canvas.getBoundingClientRect();
  const offsetX = screenX - rect.left;
  const offsetY = screenY - rect.top;
  const halfWidth = rect.width / 2;
  const halfHeight = rect.height / 2;
  return {
    x: center.x + (offsetX - halfWidth) / zoom,
    y: center.y + (offsetY - halfHeight) / zoom,
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function screenToWorld(
  canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  zoom = camera.zoom,
  center: PixelCoord = camera
): PixelCoord {
  return screenToWorldWith(canvas, screenX, screenY, zoom, center);
}

export function applyZoomAtPoint(
  canvas: HTMLCanvasElement,
  screenX: number,
  screenY: number,
  targetZoom: number
): void {
  const clamped = clampZoom(targetZoom);
  if (clamped === camera.zoom) return;

  const currentCenter = { x: camera.x, y: camera.y };
  const before = screenToWorldWith(canvas, screenX, screenY, camera.zoom, currentCenter);
  const after = screenToWorldWith(canvas, screenX, screenY, clamped, currentCenter);

  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  camera.zoom = clamped;
  invalidateFrame();
}

export function panCameraByScreenDelta(dx: number, dy: number): void {
  if (dx === 0 && dy === 0) return;
  camera.x -= dx / camera.zoom;
  camera.y -= dy / camera.zoom;
  invalidateFrame();
}

export function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement): void {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(window.innerWidth, 1);
  const height = Math.max(window.innerHeight, 1);

  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  invalidateFrame();
}

export { camera };
