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
  private readonly emptyChunksByZoom = new Map<string, Set<ChunkKey>>();
  private readonly unsubscribe: () => void;
  private lastBounds?: { minQ: number; maxQ: number; minR: number; maxR: number };
  private lastZoomKey?: string;

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
    this.lastBounds = undefined;
  }

  invalidate(): void {
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.lastBounds = undefined;
    this.emptyChunksByZoom.clear();
    this.lastZoomKey = undefined;
  }

  markTileDirty(q: number, r: number): void {
    const key = chunkKeyFromAxial(q, r);
    this.dirtyChunks.add(key);
    this.clearChunkEmptyState(key);
  }

  private markAllChunksDirty(): void {
    for (const key of this.chunkCanvases.keys()) {
      this.dirtyChunks.add(key);
      this.clearChunkEmptyState(key);
    }
  }

  getRenderableChunks(range: ChunkRange, hexSize: number, zoom: number): FogChunkCanvas[] {
    const currentBounds = {
      minQ: this.map.minQ,
      maxQ: this.map.maxQ,
      minR: this.map.minR,
      maxR: this.map.maxR,
    };

    if (
      !this.lastBounds ||
      this.lastBounds.minQ !== currentBounds.minQ ||
      this.lastBounds.maxQ !== currentBounds.maxQ ||
      this.lastBounds.minR !== currentBounds.minR ||
      this.lastBounds.maxR !== currentBounds.maxR
    ) {
      this.markAllChunksDirty();
      this.lastBounds = { ...currentBounds };
    }

    const chunks: FogChunkCanvas[] = [];
    const { width: hexWidth, height: hexHeight } = getHexDimensions(hexSize);
    const keyForZoom = zoomKey(zoom);

    if (this.lastZoomKey && this.lastZoomKey !== keyForZoom) {
      this.emptyChunksByZoom.delete(this.lastZoomKey);
    }
    this.lastZoomKey = keyForZoom;

    for (const chunkCoord of enumerateChunks(range)) {
      const key = chunkKeyFromCoord(chunkCoord);
      const chunk = this.ensureChunk(
        key,
        chunkCoord,
        hexSize,
        hexWidth,
        hexHeight,
        zoom,
        keyForZoom
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
    zoomKeyValue: string
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

    if (!isDirty && this.isChunkEmpty(key, zoomKeyValue)) {
      return null;
    }

    const reuse = isDirty ? undefined : existing;
    const rendered = this.renderChunk(
      key,
      chunkCoord,
      hexSize,
      hexWidth,
      hexHeight,
      zoom,
      zoomKeyValue,
      reuse ?? null
    );

    if (!rendered) {
      zoomVariants.delete(zoomKeyValue);
      if (zoomVariants.size === 0) {
        this.chunkCanvases.delete(key);
      }
      return null;
    }

    this.clearChunkEmptyState(key, zoomKeyValue);
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
    zoomKeyValue: string,
    existing: FogChunkCanvas | null
  ): FogChunkCanvas | null {
    if (typeof document === 'undefined') {
      return null;
    }

    const { qStart, qEnd, rStart, rEnd } = chunkBounds(chunkCoord, this.map);
    if (qStart > qEnd || rStart > rEnd) {
      this.markChunkEmpty(key, zoomKeyValue);
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
        const drawX = x - halfHexWidth;
        const drawY = y - halfHexHeight;
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
      this.markChunkEmpty(key, zoomKeyValue);
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

  private markChunkEmpty(key: ChunkKey, zoomKeyValue: string): void {
    let emptySet = this.emptyChunksByZoom.get(zoomKeyValue);
    if (!emptySet) {
      emptySet = new Set();
      this.emptyChunksByZoom.set(zoomKeyValue, emptySet);
    }
    emptySet.add(key);
  }

  private clearChunkEmptyState(key: ChunkKey, zoomKeyValue?: string): void {
    if (zoomKeyValue) {
      const emptySet = this.emptyChunksByZoom.get(zoomKeyValue);
      if (emptySet) {
        emptySet.delete(key);
        if (emptySet.size === 0) {
          this.emptyChunksByZoom.delete(zoomKeyValue);
        }
      }
      return;
    }

    for (const [zoomKeyValueExisting, emptySet] of this.emptyChunksByZoom) {
      if (emptySet.delete(key) && emptySet.size === 0) {
        this.emptyChunksByZoom.delete(zoomKeyValueExisting);
      }
    }
  }

  private isChunkEmpty(key: ChunkKey, zoomKeyValue: string): boolean {
    const emptySet = this.emptyChunksByZoom.get(zoomKeyValue);
    return emptySet?.has(key) ?? false;
  }
}

