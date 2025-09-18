import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { LoadedAssets } from '../loader.ts';
import { TerrainId } from '../map/terrain.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import { TERRAIN } from './TerrainPalette.ts';
import type { HexPatternOptions } from '../map/hexPatterns.ts';
import { drawForest, drawHills, drawPlains, drawWater } from '../map/hexPatterns.ts';
import {
  chunkKeyFromAxial,
  chunkKeyFromCoord,
  type ChunkRange,
  enumerateChunks,
  HEX_CHUNK_SIZE,
} from '../map/hex/chunking.ts';
import type { ChunkKey, ChunkCoord } from '../map/hex/chunking.ts';
import type { TileChangeType } from '../hexmap.ts';
import { loadIcon } from './loadIcon.ts';

const TERRAIN_PATTERNS: Record<TerrainId, (options: HexPatternOptions) => void> = {
  [TerrainId.Plains]: drawPlains,
  [TerrainId.Forest]: drawForest,
  [TerrainId.Hills]: drawHills,
  [TerrainId.Lake]: drawWater,
};

interface ChunkCanvas {
  key: ChunkKey;
  canvas: HTMLCanvasElement;
  origin: PixelCoord;
  width: number;
  height: number;
}

function toRgb(color: string): [number, number, number] {
  const hex = color.replace('#', '');
  const value = Number.parseInt(hex, 16);
  const r = (value >> 16) & 0xff;
  const g = (value >> 8) & 0xff;
  const b = value & 0xff;
  return [r, g, b];
}

function mixColor(
  [r, g, b]: [number, number, number],
  [tr, tg, tb]: [number, number, number],
  amount: number
): string {
  const clamped = Math.min(1, Math.max(0, amount));
  const mix = (channel: number, target: number) => Math.round(channel + (target - channel) * clamped);
  return `rgb(${mix(r, tr)}, ${mix(g, tg)}, ${mix(b, tb)})`;
}

function withAlpha([r, g, b]: [number, number, number], alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
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

function strokeHex(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number
): void {
  hexPath(ctx, x, y, size);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, size * 0.05);
  ctx.strokeStyle = 'rgba(12, 18, 28, 0.55)';
  ctx.stroke();
  ctx.restore();
}

function drawTerrainAndBuilding(
  ctx: CanvasRenderingContext2D,
  tile: { terrain: TerrainId; building: string | null },
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const palette = TERRAIN[tile.terrain] ?? TERRAIN[TerrainId.Plains];
  const rgb = toRgb(palette.baseColor);
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  hexPath(ctx, centerX, centerY, radius);
  ctx.clip();

  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.05);
  gradient.addColorStop(0, mixColor(rgb, [255, 255, 255], 0.3));
  gradient.addColorStop(0.7, palette.baseColor);
  gradient.addColorStop(1, mixColor(rgb, [12, 18, 28], 0.4));

  ctx.fillStyle = gradient;
  ctx.shadowColor = withAlpha(rgb, 0.35);
  ctx.shadowBlur = radius * 0.9;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillRect(x - radius * 0.1, y - radius * 0.1, width + radius * 0.2, height + radius * 0.2);

  const patternOptions: HexPatternOptions = {
    ctx,
    x,
    y,
    width,
    height,
    radius,
    centerX,
    centerY,
    baseColor: palette.baseColor,
  };
  const drawPattern = TERRAIN_PATTERNS[tile.terrain] ?? drawPlains;
  drawPattern(patternOptions);

  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(centerX, centerY, radius * 0.85, centerX, centerY, radius * 1.18);
  rim.addColorStop(0, 'rgba(255, 255, 255, 0)');
  rim.addColorStop(1, withAlpha(rgb, 0.18));
  ctx.fillStyle = rim;
  ctx.fillRect(x - radius * 0.1, y - radius * 0.1, width + radius * 0.2, height + radius * 0.2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  const icon = loadIcon(palette.icon);
  if (icon) {
    const iconSize = Math.min(width, height) * 0.62;
    const iconX = centerX - iconSize / 2;
    const iconY = centerY - iconSize / 2;
    ctx.save();
    ctx.globalAlpha *= 0.92;
    ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
    ctx.restore();
  }

  if (tile.building) {
    const building = images[`building-${tile.building}`] ?? images['placeholder'];
    ctx.drawImage(building, x, y, width, height);
  }
}

function chunkBounds(chunk: ChunkCoord, map: HexMap): { qStart: number; qEnd: number; rStart: number; rEnd: number } {
  const qStart = Math.max(chunk.q * HEX_CHUNK_SIZE, map.minQ);
  const qEnd = Math.min(qStart + HEX_CHUNK_SIZE - 1, map.maxQ);
  const rStart = Math.max(chunk.r * HEX_CHUNK_SIZE, map.minR);
  const rEnd = Math.min(rStart + HEX_CHUNK_SIZE - 1, map.maxR);
  return { qStart, qEnd, rStart, rEnd };
}

export class TerrainCache {
  private readonly chunkCanvases = new Map<ChunkKey, ChunkCanvas>();
  private readonly dirtyChunks = new Set<ChunkKey>();
  private cachedImages?: Record<string, HTMLImageElement>;
  private readonly unsubscribe: () => void;

  constructor(private readonly map: HexMap) {
    this.unsubscribe = map.addTileChangeListener((coord, _tile, change) => {
      this.onTileChange(coord, change);
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.cachedImages = undefined;
  }

  invalidate(): void {
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.cachedImages = undefined;
  }

  markChunkDirty(key: ChunkKey): void {
    this.dirtyChunks.add(key);
  }

  markTileDirty(q: number, r: number): void {
    this.dirtyChunks.add(chunkKeyFromAxial(q, r));
  }

  getRenderableChunks(
    range: ChunkRange,
    hexSize: number,
    images: LoadedAssets['images'],
    origin: PixelCoord
  ): ChunkCanvas[] {
    this.refreshAssets(images);
    const renderable: ChunkCanvas[] = [];
    const { width: hexWidth, height: hexHeight } = getHexDimensions(hexSize);

    for (const chunkCoord of enumerateChunks(range)) {
      const key = chunkKeyFromCoord(chunkCoord);
      const chunkCanvas = this.ensureChunk(key, chunkCoord, hexSize, hexWidth, hexHeight, images, origin);
      if (chunkCanvas) {
        renderable.push(chunkCanvas);
      }
    }

    return renderable;
  }

  private refreshAssets(images: LoadedAssets['images']): void {
    if (this.cachedImages === images) {
      return;
    }

    this.cachedImages = images;
    for (const key of this.chunkCanvases.keys()) {
      this.dirtyChunks.add(key);
    }
  }

  private onTileChange(coord: { q: number; r: number }, change: TileChangeType): void {
    if (change === 'created' || change === 'terrain' || change === 'building' || change === 'fog') {
      this.markTileDirty(coord.q, coord.r);
    }
  }

  private ensureChunk(
    key: ChunkKey,
    chunkCoord: ChunkCoord,
    hexSize: number,
    hexWidth: number,
    hexHeight: number,
    images: LoadedAssets['images'],
    origin: PixelCoord
  ): ChunkCanvas | null {
    const existing = this.chunkCanvases.get(key);
    if (!existing || this.dirtyChunks.has(key)) {
      const updated = this.renderChunk(key, chunkCoord, hexSize, hexWidth, hexHeight, images, origin, existing);
      this.dirtyChunks.delete(key);
      if (!updated) {
        this.chunkCanvases.delete(key);
        return null;
      }
      this.chunkCanvases.set(key, updated);
      return updated;
    }

    return existing;
  }

  private renderChunk(
    key: ChunkKey,
    chunkCoord: ChunkCoord,
    hexSize: number,
    hexWidth: number,
    hexHeight: number,
    images: LoadedAssets['images'],
    origin: PixelCoord,
    existing?: ChunkCanvas
  ): ChunkCanvas | null {
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
    const tiles: Array<{ tile: { terrain: TerrainId; building: string | null }; x: number; y: number }> = [];

    for (let q = qStart; q <= qEnd; q++) {
      for (let r = rStart; r <= rEnd; r++) {
        const tile = this.map.getTile(q, r);
        if (!tile || tile.isFogged) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, hexSize);
        const drawX = x - origin.x - halfHexWidth;
        const drawY = y - origin.y - halfHexHeight;
        minX = Math.min(minX, drawX);
        minY = Math.min(minY, drawY);
        maxX = Math.max(maxX, drawX + hexWidth);
        maxY = Math.max(maxY, drawY + hexHeight);
        tiles.push({ tile, x: drawX, y: drawY });
      }
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    const width = Math.max(1, Math.ceil(maxX - minX));
    const height = Math.max(1, Math.ceil(maxY - minY));

    let canvas = existing?.canvas;
    if (!canvas || canvas.width !== width || canvas.height !== height) {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available for chunk rendering');
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);

    for (const { tile, x, y } of tiles) {
      const drawX = x - minX;
      const drawY = y - minY;
      ctx.save();
      drawTerrainAndBuilding(ctx, tile, images, drawX, drawY, hexWidth, hexHeight, hexSize);
      strokeHex(ctx, drawX + hexWidth / 2, drawY + hexHeight / 2, hexSize);
      ctx.restore();
    }

    return {
      key,
      canvas,
      origin: { x: minX, y: minY },
      width,
      height,
    };
  }
}

export type { ChunkCanvas };
