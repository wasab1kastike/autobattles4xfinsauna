import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { LoadedAssets } from '../loader.ts';
import { camera } from '../camera/autoFrame.ts';
import {
  computeVisibleBounds,
  chunkRangeFromBounds,
  chunkKeyFromCoord,
  ensureChunkPopulated,
  type ChunkKey,
  type ChunkRange,
} from '../map/hex/chunking.ts';
import { TerrainCache, type ChunkCanvas } from './terrain_cache.ts';
import { FogCache, type FogChunkCanvas } from './fog_cache.ts';
import {
  getHighlightTokens,
  getOutlineWidth,
  lightenNeutral,
  darkenNeutral,
} from './palette.ts';

export class HexMapRenderer {
  private readonly terrainCache: TerrainCache;
  private readonly fogCache: FogCache;
  private cachedHexSize: number;
  private readonly populatedChunkKeys = new Set<ChunkKey>();
  private lastTrackedBounds: { minQ: number; maxQ: number; minR: number; maxR: number } | null = null;
  private lastOrigin: PixelCoord | null = null;

  constructor(private readonly mapRef: HexMap) {
    this.terrainCache = new TerrainCache(mapRef);
    this.fogCache = new FogCache(mapRef);
    this.cachedHexSize = mapRef.hexSize;
  }

  get hexSize(): number {
    return this.mapRef.hexSize;
  }

  getOrigin(): PixelCoord {
    return axialToPixel({ q: this.mapRef.minQ, r: this.mapRef.minR }, this.hexSize);
  }

  invalidateCache(): void {
    this.terrainCache.invalidate();
    this.fogCache.invalidate();
    this.clearChunkTracking();
  }

  dispose(): void {
    this.terrainCache.dispose();
    this.fogCache.dispose();
  }

  draw(
    ctx: CanvasRenderingContext2D,
    images: LoadedAssets['images'],
    selected?: AxialCoord
  ): void {
    this.ensureHexSize();
    const canvasElement = (ctx.canvas ?? null) as HTMLCanvasElement | null;
    const bounds = computeVisibleBounds(this.mapRef, camera, canvasElement, this.hexSize);
    if (!bounds) {
      return;
    }

    const chunkRange = chunkRangeFromBounds(bounds);
    const origin = this.getOrigin();
    this.syncChunkTracking(origin);
    this.populateVisibleChunks(chunkRange);
    const chunks = this.terrainCache.getRenderableChunks(chunkRange, this.hexSize, images, origin);
    this.drawChunks(ctx, chunks);
    const fogChunks = this.fogCache.getRenderableChunks(chunkRange, this.hexSize, camera.zoom, origin);
    this.drawFogChunks(ctx, fogChunks);

    if (selected) {
      this.drawSelection(ctx, origin, selected);
    }
  }

  drawToCanvas(
    canvas: HTMLCanvasElement,
    images: LoadedAssets['images'],
    selected?: AxialCoord
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }
    this.draw(ctx, images, selected);
  }

  private ensureHexSize(): void {
    if (this.cachedHexSize !== this.hexSize) {
      this.cachedHexSize = this.hexSize;
      this.terrainCache.invalidate();
      this.fogCache.invalidate();
      this.clearChunkTracking();
    }
  }

  private populateVisibleChunks(range: ChunkRange): void {
    for (let r = range.rMin; r <= range.rMax; r++) {
      for (let q = range.qMin; q <= range.qMax; q++) {
        const chunkCoord = { q, r };
        const key = chunkKeyFromCoord(chunkCoord);
        if (this.populatedChunkKeys.has(key)) {
          continue;
        }
        ensureChunkPopulated(this.mapRef, chunkCoord);
        this.populatedChunkKeys.add(key);
      }
    }
  }

  private syncChunkTracking(origin: PixelCoord): void {
    const currentBounds = {
      minQ: this.mapRef.minQ,
      maxQ: this.mapRef.maxQ,
      minR: this.mapRef.minR,
      maxR: this.mapRef.maxR,
    };

    const boundsChanged =
      !this.lastTrackedBounds ||
      this.lastTrackedBounds.minQ !== currentBounds.minQ ||
      this.lastTrackedBounds.maxQ !== currentBounds.maxQ ||
      this.lastTrackedBounds.minR !== currentBounds.minR ||
      this.lastTrackedBounds.maxR !== currentBounds.maxR;

    const originChanged =
      !this.lastOrigin || this.lastOrigin.x !== origin.x || this.lastOrigin.y !== origin.y;

    if (boundsChanged || originChanged) {
      this.populatedChunkKeys.clear();
    }

    this.lastTrackedBounds = { ...currentBounds };
    this.lastOrigin = { ...origin };
  }

  private clearChunkTracking(): void {
    this.populatedChunkKeys.clear();
    this.lastTrackedBounds = null;
    this.lastOrigin = null;
  }

  private drawChunks(ctx: CanvasRenderingContext2D, chunks: ChunkCanvas[]): void {
    if (chunks.length === 0) {
      return;
    }

    for (const chunk of chunks) {
      ctx.drawImage(chunk.canvas, chunk.origin.x, chunk.origin.y);
    }
  }

  private drawFogChunks(ctx: CanvasRenderingContext2D, chunks: FogChunkCanvas[]): void {
    if (chunks.length === 0) {
      return;
    }

    for (const chunk of chunks) {
      ctx.drawImage(chunk.canvas, chunk.origin.x, chunk.origin.y);
    }
  }

  private drawSelection(ctx: CanvasRenderingContext2D, origin: PixelCoord, coord: AxialCoord): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const { x, y } = axialToPixel(coord, this.hexSize);
    const drawX = x - origin.x - hexWidth / 2;
    const drawY = y - origin.y - hexHeight / 2;
    this.strokeHex(ctx, drawX + hexWidth / 2, drawY + hexHeight / 2, this.hexSize, true);
  }

  private strokeHex(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    selected = false
  ): void {
    const { stroke, glow } = getHighlightTokens();
    this.hexPath(ctx, x, y, size);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (selected) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = Math.max(6, (size * 0.65) / Math.max(camera.zoom, 0.1));
      ctx.lineWidth = getOutlineWidth(size, camera.zoom, 'selection');
      ctx.strokeStyle = stroke;
      ctx.stroke();
    } else {
      ctx.lineWidth = getOutlineWidth(size, camera.zoom, 'hover');
      ctx.shadowColor = lightenNeutral(0.1, 0.45);
      ctx.shadowBlur = Math.max(2, (size * 0.4) / Math.max(camera.zoom, 0.1));
      ctx.strokeStyle = darkenNeutral(0.1, 0.72);
      ctx.stroke();
    }
    ctx.restore();
  }

  private hexPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number
  ): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 180) * (60 * i - 30);
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }
}
