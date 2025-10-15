import type { CameraState } from '../../camera/autoFrame.ts';
import type { HexMap } from '../../hexmap.ts';
import { pixelToAxialUnrounded } from '../../hex/HexUtils.ts';

export const HEX_CHUNK_SIZE = 16;
export const CHUNK_POPULATION_RADIUS = 4;
export const ENABLE_CHUNK_POPULATION = false;

export interface AxialBounds {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}

export interface ChunkRange {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}

export interface ChunkCoord {
  q: number;
  r: number;
}

export type ChunkKey = string;

const VIEWPORT_MARGIN = 2;

function getDevicePixelRatio(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

function clampBoundsToMap(bounds: AxialBounds, map: HexMap): AxialBounds | null {
  const qMin = Math.max(bounds.qMin, map.minQ);
  const qMax = Math.min(bounds.qMax, map.maxQ);
  const rMin = Math.max(bounds.rMin, map.minR);
  const rMax = Math.min(bounds.rMax, map.maxR);

  if (qMin > qMax || rMin > rMax) {
    return null;
  }

  return { qMin, qMax, rMin, rMax };
}

function computeViewportRect(
  cam: CameraState,
  canvas: HTMLCanvasElement
): { x: number; y: number; width: number; height: number } {
  const dpr = getDevicePixelRatio();
  const width = canvas.width / (dpr * cam.zoom);
  const height = canvas.height / (dpr * cam.zoom);
  return {
    x: cam.x - width / 2,
    y: cam.y - height / 2,
    width,
    height,
  };
}

function computeAxialBounds(
  rect: { x: number; y: number; width: number; height: number },
  hexSize: number
): AxialBounds {
  const corners = [
    pixelToAxialUnrounded(rect.x, rect.y, hexSize),
    pixelToAxialUnrounded(rect.x + rect.width, rect.y, hexSize),
    pixelToAxialUnrounded(rect.x, rect.y + rect.height, hexSize),
    pixelToAxialUnrounded(rect.x + rect.width, rect.y + rect.height, hexSize),
  ];

  let qMin = Infinity;
  let qMax = -Infinity;
  let rMin = Infinity;
  let rMax = -Infinity;

  for (const corner of corners) {
    qMin = Math.min(qMin, corner.q);
    qMax = Math.max(qMax, corner.q);
    rMin = Math.min(rMin, corner.r);
    rMax = Math.max(rMax, corner.r);
  }

  return {
    qMin: Math.floor(qMin) - VIEWPORT_MARGIN,
    qMax: Math.ceil(qMax) + VIEWPORT_MARGIN,
    rMin: Math.floor(rMin) - VIEWPORT_MARGIN,
    rMax: Math.ceil(rMax) + VIEWPORT_MARGIN,
  };
}

export function computeVisibleBounds(
  map: HexMap,
  cam: CameraState,
  canvas: HTMLCanvasElement | null,
  hexSize: number
): AxialBounds | null {
  if (!canvas || typeof canvas.width !== 'number' || typeof canvas.height !== 'number') {
    return {
      qMin: map.minQ,
      qMax: map.maxQ,
      rMin: map.minR,
      rMax: map.maxR,
    };
  }

  if (canvas.width === 0 || canvas.height === 0) {
    return {
      qMin: map.minQ,
      qMax: map.maxQ,
      rMin: map.minR,
      rMax: map.maxR,
    };
  }

  const rect = computeViewportRect(cam, canvas);
  return clampBoundsToMap(computeAxialBounds(rect, hexSize), map);
}

function toChunkIndex(value: number): number {
  return Math.floor(value / HEX_CHUNK_SIZE);
}

export function chunkKeyFromCoord(coord: ChunkCoord): ChunkKey {
  return `${coord.q},${coord.r}`;
}

export function chunkKeyFromAxial(q: number, r: number): ChunkKey {
  return chunkKeyFromCoord({ q: toChunkIndex(q), r: toChunkIndex(r) });
}

export function chunkCoordFromKey(key: ChunkKey): ChunkCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function chunkCoordFromAxial(q: number, r: number): ChunkCoord {
  return { q: toChunkIndex(q), r: toChunkIndex(r) };
}

export function chunkRangeFromBounds(bounds: AxialBounds): ChunkRange {
  return {
    qMin: toChunkIndex(bounds.qMin),
    qMax: toChunkIndex(bounds.qMax),
    rMin: toChunkIndex(bounds.rMin),
    rMax: toChunkIndex(bounds.rMax),
  };
}

export function enumerateChunks(range: ChunkRange): ChunkCoord[] {
  const chunks: ChunkCoord[] = [];
  for (let r = range.rMin; r <= range.rMax; r++) {
    for (let q = range.qMin; q <= range.qMax; q++) {
      chunks.push({ q, r });
    }
  }
  return chunks;
}

export function ensureChunkPopulated(map: HexMap, chunk: ChunkCoord): void {
  const qStart = chunk.q * HEX_CHUNK_SIZE;
  const rStart = chunk.r * HEX_CHUNK_SIZE;
  const qEnd = qStart + HEX_CHUNK_SIZE - 1;
  const rEnd = rStart + HEX_CHUNK_SIZE - 1;

  const clampedQStart = Math.max(qStart, map.minQ);
  const clampedQEnd = Math.min(qEnd, map.maxQ);
  const clampedRStart = Math.max(rStart, map.minR);
  const clampedREnd = Math.min(rEnd, map.maxR);

  if (clampedQStart > clampedQEnd || clampedRStart > clampedREnd) {
    return;
  }

  for (let r = clampedRStart; r <= clampedREnd; r++) {
    for (let q = clampedQStart; q <= clampedQEnd; q++) {
      map.ensureTile(q, r);
    }
  }
}

export function ensureChunksPopulated(map: HexMap, range: ChunkRange): void {
  for (const chunk of enumerateChunks(range)) {
    ensureChunkPopulated(map, chunk);
  }
}

export function populateChunk(
  map: HexMap,
  center: ChunkCoord,
  radius = CHUNK_POPULATION_RADIUS
): void {
  if (!ENABLE_CHUNK_POPULATION) {
    return;
  }

  const normalizedRadius = Number.isFinite(radius) ? Math.max(0, Math.floor(radius)) : 0;
  const range: ChunkRange = {
    qMin: center.q - normalizedRadius,
    qMax: center.q + normalizedRadius,
    rMin: center.r - normalizedRadius,
    rMax: center.r + normalizedRadius,
  };

  ensureChunksPopulated(map, range);
}
