import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { LoadedAssets } from '../loader.ts';
import { camera } from '../camera/autoFrame.ts';
import {
  computeVisibleBounds,
  chunkRangeFromBounds,
  ensureChunksPopulated,
  type AxialBounds,
} from '../map/hex/chunking.ts';
import { TerrainCache, type ChunkCanvas } from './terrain_cache.ts';
import {
  getHighlightTokens,
  getOutlineWidth,
  lightenNeutral,
  darkenNeutral,
} from './palette.ts';
import { drawFogHex } from './fog.ts';

export class HexMapRenderer {
  private readonly terrainCache: TerrainCache;
  private cachedHexSize: number;

  constructor(private readonly mapRef: HexMap) {
    this.terrainCache = new TerrainCache(mapRef);
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
  }

  dispose(): void {
    this.terrainCache.dispose();
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
    ensureChunksPopulated(this.mapRef, chunkRange);

    const origin = this.getOrigin();
    const chunks = this.terrainCache.getRenderableChunks(chunkRange, this.hexSize, images, origin);
    this.drawChunks(ctx, chunks);
    this.drawFogLayer(ctx, origin, bounds);

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
    }
  }

  private drawChunks(ctx: CanvasRenderingContext2D, chunks: ChunkCanvas[]): void {
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

  private drawFogLayer(
    ctx: CanvasRenderingContext2D,
    origin: PixelCoord,
    bounds: AxialBounds
  ): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
      for (let q = bounds.qMin; q <= bounds.qMax; q++) {
        const tile = this.mapRef.getTile(q, r);
        if (!tile || !tile.isFogged) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, this.hexSize);
        const drawX = x - origin.x - halfHexWidth;
        const drawY = y - origin.y - halfHexHeight;
        const radius = this.hexSize;
        const centerX = drawX + hexWidth / 2;
        const centerY = drawY + hexHeight / 2;
        drawFogHex(ctx, centerX, centerY, radius, camera.zoom);
      }
    }
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
