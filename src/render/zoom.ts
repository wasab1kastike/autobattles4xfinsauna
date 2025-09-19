const MIN_ZOOM = 0.01;

export function getSafeZoom(zoom: number): number {
  if (!Number.isFinite(zoom) || zoom <= MIN_ZOOM) {
    return 1;
  }
  return zoom;
}

export function scaleForZoom(value: number, zoom: number): number {
  return value / getSafeZoom(zoom);
}

export function snapForZoom(value: number, zoom: number): number {
  const safeZoom = getSafeZoom(zoom);
  return Math.round(value * safeZoom) / safeZoom;
}
