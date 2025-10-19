import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { LoadedAssets } from '../loader.ts';
import { TerrainId } from '../map/terrain.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import {
  TERRAIN,
  NEUTRAL_BASE_RGB,
  hexToRgb,
  mixRgb,
  rgbString,
  rgbaString,
  lightenNeutral,
  getOutlineWidth,
  type TerrainVisual,
} from './palette.ts';
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
import { loadIcon, onIconLoaded } from './loadIcon.ts';

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
  ctx.lineWidth = getOutlineWidth(size, 1, 'terrain');
  ctx.strokeStyle = lightenNeutral(0.16, 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawTerrainAndBuilding(
  ctx: CanvasRenderingContext2D,
  tile: { terrain: TerrainId; building: string | null },
  palette: TerrainVisual,
  images: Record<string, HTMLImageElement>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const rgb = hexToRgb(palette.baseColor);
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  ctx.save();
  hexPath(ctx, centerX, centerY, radius);
  ctx.clip();

  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.05);
  gradient.addColorStop(0, rgbString(mixRgb(rgb, [255, 255, 255] as const, 0.3)));
  gradient.addColorStop(0.7, palette.baseColor);
  gradient.addColorStop(1, rgbString(mixRgb(rgb, NEUTRAL_BASE_RGB, 0.4)));

  ctx.fillStyle = gradient;
  ctx.shadowColor = rgbaString(rgb, 0.35);
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
  rim.addColorStop(1, rgbaString(rgb, 0.18));
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
  private readonly emptyChunks = new Set<ChunkKey>();
  private cachedImages?: Record<string, HTMLImageElement>;
  private readonly iconChunks = new Map<string, Set<ChunkKey>>();
  private readonly chunkIcons = new Map<ChunkKey, Set<string>>();
  private readonly iconSubscriptions = new Map<string, () => void>();
  private readonly readyIconPaths = new Set<string>();
  private readonly unsubscribe: () => void;
  private lastBounds?: { minQ: number; maxQ: number; minR: number; maxR: number };

  constructor(private readonly map: HexMap) {
    this.unsubscribe = map.addTileChangeListener((coord, _tile, change) => {
      this.onTileChange(coord, change);
    });
  }

  dispose(): void {
    this.unsubscribe();
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.emptyChunks.clear();
    this.cachedImages = undefined;
    this.clearIconTracking();
    this.lastBounds = undefined;
  }

  invalidate(): void {
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.emptyChunks.clear();
    this.cachedImages = undefined;
    this.clearIconTracking();
    this.lastBounds = undefined;
  }

  markChunkDirty(key: ChunkKey): void {
    this.dirtyChunks.add(key);
    this.emptyChunks.delete(key);
  }

  markTileDirty(q: number, r: number): void {
    this.markChunkDirty(chunkKeyFromAxial(q, r));
  }

  private markAllChunksDirty(): void {
    for (const key of this.chunkCanvases.keys()) {
      this.markChunkDirty(key);
    }
  }

  getRenderableChunks(
    range: ChunkRange,
    hexSize: number,
    images: LoadedAssets['images']
  ): ChunkCanvas[] {
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

    this.refreshAssets(images);
    const renderable: ChunkCanvas[] = [];
    const { width: hexWidth, height: hexHeight } = getHexDimensions(hexSize);

    for (const chunkCoord of enumerateChunks(range)) {
      const key = chunkKeyFromCoord(chunkCoord);
      const chunkCanvas = this.ensureChunk(key, chunkCoord, hexSize, hexWidth, hexHeight, images);
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
    this.markAllChunksDirty();
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
    images: LoadedAssets['images']
  ): ChunkCanvas | null {
    const existing = this.chunkCanvases.get(key);
    if (!this.dirtyChunks.has(key) && this.emptyChunks.has(key)) {
      return null;
    }
    if (!existing || this.dirtyChunks.has(key)) {
      const updated = this.renderChunk(key, chunkCoord, hexSize, hexWidth, hexHeight, images, existing);
      this.dirtyChunks.delete(key);
      if (!updated) {
        this.emptyChunks.add(key);
        this.chunkCanvases.delete(key);
        this.trackChunkIcons(key, new Set());
        return null;
      }
      this.emptyChunks.delete(key);
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
    const chunkIconPaths = new Set<string>();
    const tiles: Array<{
      tile: { terrain: TerrainId; building: string | null };
      palette: TerrainVisual;
      x: number;
      y: number;
    }> = [];

    for (let q = qStart; q <= qEnd; q++) {
      for (let r = rStart; r <= rEnd; r++) {
        const tile = this.map.getTile(q, r);
        if (!tile || tile.isFogged) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, hexSize);
        const drawX = x - halfHexWidth;
        const drawY = y - halfHexHeight;
        minX = Math.min(minX, drawX);
        minY = Math.min(minY, drawY);
        maxX = Math.max(maxX, drawX + hexWidth);
        maxY = Math.max(maxY, drawY + hexHeight);
        const palette = TERRAIN[tile.terrain] ?? TERRAIN[TerrainId.Plains];
        chunkIconPaths.add(palette.icon);
        tiles.push({ tile, palette, x: drawX, y: drawY });
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

    for (const { tile, palette, x, y } of tiles) {
      const drawX = x - minX;
      const drawY = y - minY;
      ctx.save();
      drawTerrainAndBuilding(ctx, tile, palette, images, drawX, drawY, hexWidth, hexHeight, hexSize);
      strokeHex(ctx, drawX + hexWidth / 2, drawY + hexHeight / 2, hexSize);
      ctx.restore();
    }

    this.trackChunkIcons(key, chunkIconPaths);

    return {
      key,
      canvas,
      origin: { x: minX, y: minY },
      width,
      height,
    };
  }

  private trackChunkIcons(key: ChunkKey, icons: Set<string>): void {
    const previousIcons = this.chunkIcons.get(key);
    if (previousIcons) {
      for (const icon of previousIcons) {
        const chunks = this.iconChunks.get(icon);
        if (chunks) {
          chunks.delete(key);
          if (chunks.size === 0) {
            this.iconChunks.delete(icon);
            this.unsubscribeFromIcon(icon);
          }
        }
      }
    }

    if (icons.size === 0) {
      this.chunkIcons.delete(key);
      return;
    }

    const trackedIcons = new Set(icons);
    this.chunkIcons.set(key, trackedIcons);

    for (const icon of trackedIcons) {
      let chunks = this.iconChunks.get(icon);
      if (!chunks) {
        chunks = new Set();
        this.iconChunks.set(icon, chunks);
      }
      chunks.add(key);
      this.ensureIconSubscription(icon);
    }
  }

  private markChunksForIcon(path: string): void {
    const chunks = this.iconChunks.get(path);
    if (!chunks || chunks.size === 0) {
      return;
    }

    for (const chunkKey of chunks) {
      this.markChunkDirty(chunkKey);
    }
  }

  private ensureIconSubscription(path: string): void {
    const icon = loadIcon(path);
    if (icon) {
      if (!this.readyIconPaths.has(path)) {
        this.readyIconPaths.add(path);
        this.markChunksForIcon(path);
      }
      return;
    }

    this.readyIconPaths.delete(path);

    if (this.iconSubscriptions.has(path)) {
      return;
    }

    const unsubscribe = onIconLoaded(path, () => {
      if (!this.readyIconPaths.has(path)) {
        this.readyIconPaths.add(path);
        this.markChunksForIcon(path);
      }
      this.unsubscribeFromIcon(path);
    });

    this.iconSubscriptions.set(path, unsubscribe);
  }

  private unsubscribeFromIcon(path: string): void {
    const unsubscribe = this.iconSubscriptions.get(path);
    if (!unsubscribe) {
      return;
    }
    unsubscribe();
    this.iconSubscriptions.delete(path);
  }

  private clearIconTracking(): void {
    for (const unsubscribe of this.iconSubscriptions.values()) {
      unsubscribe();
    }
    this.iconSubscriptions.clear();
    this.iconChunks.clear();
    this.chunkIcons.clear();
    this.readyIconPaths.clear();
  }
}

export type { ChunkCanvas };
