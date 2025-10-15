import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import {
  chunkKeyFromAxial,
  chunkKeyFromCoord,
  enumerateChunks,
  HEX_CHUNK_SIZE,
  type ChunkCoord,
  type ChunkKey,
  type ChunkRange,
} from '../map/hex/chunking.ts';
import { drawFogHex } from './fog.ts';

export interface FogChunkCanvas {
  readonly key: ChunkKey;
  readonly canvas: HTMLCanvasElement;
  readonly origin: PixelCoord;
  readonly width: number;
  readonly height: number;
}

function chunkBounds(
  chunk: ChunkCoord,
  map: HexMap
): { qStart: number; qEnd: number; rStart: number; rEnd: number } {
  const qStart = Math.max(chunk.q * HEX_CHUNK_SIZE, map.minQ);
  const qEnd = Math.min(qStart + HEX_CHUNK_SIZE - 1, map.maxQ);
  const rStart = Math.max(chunk.r * HEX_CHUNK_SIZE, map.minR);
  const rEnd = Math.min(rStart + HEX_CHUNK_SIZE - 1, map.maxR);
  return { qStart, qEnd, rStart, rEnd };
}

function zoomKey(zoom: number): string {
  if (!Number.isFinite(zoom) || zoom <= 0) {
    return '1.000';
  }
  return zoom.toFixed(3);
}

export class FogCache {
  private readonly chunkCanvases = new Map<ChunkKey, Map<string, FogChunkCanvas>>();
  private readonly dirtyChunks = new Set<ChunkKey>();
  private readonly unsubscribe: () => void;
  private lastOrigin?: PixelCoord;

  constructor(private readonly map: HexMap) {
    this.unsubscribe = map.addTileChangeListener((coord, tile, change) => {
      if (change === 'fog' || change === 'created') {
        this.markTileDirty(coord.q, coord.r);
      } else if (change === 'terrain' || change === 'building') {
        // No fog change, skip invalidation.
        if (tile.isFogged) {
          this.markTileDirty(coord.q, coord.r);
        }
      }
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.lastOrigin = undefined;
  }

  invalidate(): void {
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.lastOrigin = undefined;
  }

  markTileDirty(q: number, r: number): void {
    this.dirtyChunks.add(chunkKeyFromAxial(q, r));
  }

  getRenderableChunks(
    range: ChunkRange,
    hexSize: number,
    zoom: number,
    origin: PixelCoord
  ): FogChunkCanvas[] {
    if (
      !this.lastOrigin ||
      this.lastOrigin.x !== origin.x ||
      this.lastOrigin.y !== origin.y
    ) {
      for (const key of this.chunkCanvases.keys()) {
        this.dirtyChunks.add(key);
      }
      this.lastOrigin = { ...origin };
    }
    const chunks: FogChunkCanvas[] = [];
    const { width: hexWidth, height: hexHeight } = getHexDimensions(hexSize);
    const keyForZoom = zoomKey(zoom);

    for (const chunkCoord of enumerateChunks(range)) {
      const key = chunkKeyFromCoord(chunkCoord);
      const chunk = this.ensureChunk(
        key,
        chunkCoord,
        hexSize,
        hexWidth,
        hexHeight,
        zoom,
        keyForZoom,
        origin
      );
      if (chunk) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  private ensureChunk(
    key: ChunkKey,
    chunkCoord: ChunkCoord,
    hexSize: number,
    hexWidth: number,
    hexHeight: number,
    zoom: number,
    zoomKeyValue: string,
    origin: PixelCoord
  ): FogChunkCanvas | null {
    let zoomVariants = this.chunkCanvases.get(key);
    const isDirty = this.dirtyChunks.has(key);
    if (!zoomVariants || isDirty) {
      zoomVariants = new Map();
      this.chunkCanvases.set(key, zoomVariants);
      this.dirtyChunks.delete(key);
    }

    const existing = zoomVariants.get(zoomKeyValue);
    if (existing && !isDirty) {
      return existing;
    }

    const reuse = isDirty ? undefined : existing;
    const rendered = this.renderChunk(
      key,
      chunkCoord,
      hexSize,
      hexWidth,
      hexHeight,
      zoom,
      origin,
      reuse ?? null
    );

    if (!rendered) {
      zoomVariants.delete(zoomKeyValue);
      if (zoomVariants.size === 0) {
        this.chunkCanvases.delete(key);
      }
      return null;
    }

    zoomVariants.set(zoomKeyValue, rendered);
    return rendered;
  }

  private renderChunk(
    key: ChunkKey,
    chunkCoord: ChunkCoord,
    hexSize: number,
    hexWidth: number,
    hexHeight: number,
    zoom: number,
    origin: PixelCoord,
    existing: FogChunkCanvas | null
  ): FogChunkCanvas | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const { qStart, qEnd, rStart, rEnd } = chunkBounds(chunkCoord, this.map);
    if (qStart > qEnd || rStart > rEnd) {
      return null;
    }

    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const fogTiles: Array<{ centerX: number; centerY: number }> = [];

    for (let q = qStart; q <= qEnd; q++) {
      for (let r = rStart; r <= rEnd; r++) {
        const tile = this.map.getTile(q, r);
        if (!tile || !tile.isFogged) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, hexSize);
        const drawX = x - origin.x - halfHexWidth;
        const drawY = y - origin.y - halfHexHeight;
        const centerX = drawX + hexWidth / 2;
        const centerY = drawY + hexHeight / 2;

        minX = Math.min(minX, drawX);
        minY = Math.min(minY, drawY);
        maxX = Math.max(maxX, drawX + hexWidth);
        maxY = Math.max(maxY, drawY + hexHeight);

        fogTiles.push({ centerX, centerY });
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    const width = Math.max(1, Math.ceil(maxX - minX));
    const height = Math.max(1, Math.ceil(maxY - minY));

    let canvas = existing?.canvas ?? null;
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available for fog rendering');
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const tile of fogTiles) {
      const centerX = tile.centerX - minX;
      const centerY = tile.centerY - minY;
      drawFogHex(ctx, centerX, centerY, hexSize, zoom);
    }

    return {
      key,
      canvas,
      origin: { x: minX, y: minY },
      width,
      height,
    } satisfies FogChunkCanvas;
  }
}

