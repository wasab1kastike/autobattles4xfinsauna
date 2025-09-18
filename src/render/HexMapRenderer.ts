import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel, pixelToAxialUnrounded } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { HexPatternOptions } from '../map/hexPatterns.ts';
import { drawForest, drawHills, drawPlains, drawWater } from '../map/hexPatterns.ts';
import type { LoadedAssets } from '../loader.ts';
import { TerrainId } from '../map/terrain.ts';
import { TERRAIN } from './TerrainPalette.ts';
import { loadIcon } from './loadIcon.ts';
import { camera, type CameraState } from '../camera/autoFrame.ts';

const DEFAULT_HIGHLIGHT = 'rgba(56, 189, 248, 0.85)';
const DEFAULT_HIGHLIGHT_GLOW = 'rgba(56, 189, 248, 0.45)';

let highlightStroke: string | null = null;
let highlightGlow: string | null = null;

const CHUNK = 16; // hexes per side
type ChunkKey = string;

interface ChunkCanvas {
  canvas: HTMLCanvasElement;
  origin: PixelCoord; // position relative to the map origin
}

function chunkKey(q: number, r: number): ChunkKey {
  return `${Math.floor(q / CHUNK)},${Math.floor(r / CHUNK)}`;
}

function parseTileKey(key: string): { q: number; r: number } {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

const TERRAIN_PATTERNS: Record<TerrainId, (options: HexPatternOptions) => void> = {
  [TerrainId.Plains]: drawPlains,
  [TerrainId.Forest]: drawForest,
  [TerrainId.Hills]: drawHills,
  [TerrainId.Lake]: drawWater,
};

interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AxialBounds {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}

const VIEWPORT_MARGIN = 2;

function getDevicePixelRatio(): number {
  return typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
}

function getWorldViewportRect(cam: CameraState, canvas: HTMLCanvasElement): WorldRect {
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

function computeAxialBounds(rect: WorldRect, hexSize: number): AxialBounds {
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

function resolveVisibleBounds(
  ctx: CanvasRenderingContext2D,
  map: HexMap,
  hexSize: number
): AxialBounds | null {
  const canvasElement = (ctx.canvas ?? null) as HTMLCanvasElement | null;
  if (!canvasElement || typeof canvasElement.width !== 'number' || typeof canvasElement.height !== 'number') {
    return {
      qMin: map.minQ,
      qMax: map.maxQ,
      rMin: map.minR,
      rMax: map.maxR,
    };
  }
  if (canvasElement.width === 0 || canvasElement.height === 0) {
    return {
      qMin: map.minQ,
      qMax: map.maxQ,
      rMin: map.minR,
      rMax: map.maxR,
    };
  }

  return clampBoundsToMap(
    computeAxialBounds(getWorldViewportRect(camera, canvasElement), hexSize),
    map
  );
}

function getHighlightTokens(): { stroke: string; glow: string } {
  if (highlightStroke && highlightGlow) {
    return { stroke: highlightStroke, glow: highlightGlow };
  }

  if (typeof window !== 'undefined') {
    const styles = getComputedStyle(document.documentElement);
    const stroke = styles.getPropertyValue('--tile-highlight-ring').trim();
    const glow = styles.getPropertyValue('--tile-highlight-glow').trim();
    highlightStroke = stroke || DEFAULT_HIGHLIGHT;
    highlightGlow = glow || DEFAULT_HIGHLIGHT_GLOW;
  } else {
    highlightStroke = DEFAULT_HIGHLIGHT;
    highlightGlow = DEFAULT_HIGHLIGHT_GLOW;
  }

  return { stroke: highlightStroke, glow: highlightGlow };
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

export class HexMapRenderer {
  private cachedCanvasElement?: HTMLCanvasElement;
  private cachedCanvasOffset: PixelCoord = { x: 0, y: 0 };
  private cachedHexSize: number | null = null;
  private readonly chunkCanvases = new Map<ChunkKey, ChunkCanvas>();
  private readonly dirtyChunks = new Set<ChunkKey>();
  private readonly tileRenderState = new Map<string, string>();
  private cachedImages?: Record<string, HTMLImageElement>;

  constructor(private readonly mapRef: HexMap) {}

  get hexSize(): number {
    return this.mapRef.hexSize;
  }

  getOrigin(): PixelCoord {
    return axialToPixel({ q: this.mapRef.minQ, r: this.mapRef.minR }, this.hexSize);
  }

  get cachedCanvas(): HTMLCanvasElement | undefined {
    this.ensureChunkCache();
    return this.cachedCanvasElement;
  }

  get cachedOffset(): PixelCoord {
    return this.cachedCanvasOffset;
  }

  buildCache(images: LoadedAssets['images']): void {
    if (typeof document === 'undefined') {
      return;
    }

    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;
    const origin = this.getOrigin();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const [key] of this.mapRef.tiles) {
      const [q, r] = key.split(',').map(Number);
      const { x, y } = axialToPixel({ q, r }, this.hexSize);
      const drawX = x - origin.x - halfHexWidth;
      const drawY = y - origin.y - halfHexHeight;
      minX = Math.min(minX, drawX);
      minY = Math.min(minY, drawY);
      maxX = Math.max(maxX, drawX + hexWidth);
      maxY = Math.max(maxY, drawY + hexHeight);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      this.cachedCanvasElement = undefined;
      this.cachedCanvasOffset = { x: 0, y: 0 };
      return;
    }

    const cacheWidth = Math.max(1, Math.ceil(maxX - minX));
    const cacheHeight = Math.max(1, Math.ceil(maxY - minY));
    const canvas = document.createElement('canvas');
    canvas.width = cacheWidth;
    canvas.height = cacheHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available for cache rendering');
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cacheWidth, cacheHeight);

    this.cachedCanvasElement = canvas;
    this.cachedCanvasOffset = { x: minX, y: minY };
    this.cachedHexSize = this.hexSize;
    this.cachedImages = images;
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.tileRenderState.clear();
    this.ensureChunkCache(images);
  }

  invalidateCache(): void {
    this.cachedCanvasElement = undefined;
    this.cachedCanvasOffset = { x: 0, y: 0 };
    this.cachedHexSize = null;
    this.chunkCanvases.clear();
    this.dirtyChunks.clear();
    this.tileRenderState.clear();
    this.cachedImages = undefined;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    if (this.cachedCanvasElement && this.cachedHexSize !== this.hexSize) {
      this.invalidateCache();
    }
    this.cachedImages = images;
    if (this.cachedCanvasElement) {
      this.ensureChunkCache(images);
    }
    const origin = this.getOrigin();
    const bounds = resolveVisibleBounds(ctx, this.mapRef, this.hexSize);

    if (!this.cachedCanvasElement) {
      this.drawVisibleTiles(ctx, images, origin, bounds, selected);
      return;
    }

    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;

    if (bounds) {
      this.drawFogLayer(ctx, origin, bounds);
    }
    if (selected) {
      const { x, y } = axialToPixel(selected, this.hexSize);
      const drawX = x - origin.x - halfHexWidth;
      const drawY = y - origin.y - halfHexHeight;
      this.strokeHex(ctx, drawX + hexWidth / 2, drawY + hexHeight / 2, this.hexSize, true);
    }
  }

  drawToCanvas(
    canvas: HTMLCanvasElement,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }
    this.draw(ctx, images, selected);
  }

  private drawVisibleTiles(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    origin: PixelCoord,
    bounds: AxialBounds | null,
    selected?: AxialCoord
  ): void {
    if (!bounds) {
      return;
    }

    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;
    for (let r = bounds.rMin; r <= bounds.rMax; r++) {
      for (let q = bounds.qMin; q <= bounds.qMax; q++) {
        const tile = this.mapRef.getTile(q, r);
        if (!tile) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, this.hexSize);
        const drawX = x - origin.x - halfHexWidth;
        const drawY = y - origin.y - halfHexHeight;
        ctx.save();
        if (tile.isFogged) {
          ctx.globalAlpha = 0.4;
        }
        this.drawTerrainAndBuilding(ctx, tile, images, drawX, drawY, hexWidth, hexHeight);
        const isSelected = selected && q === selected.q && r === selected.r;
        this.strokeHex(
          ctx,
          drawX + hexWidth / 2,
          drawY + hexHeight / 2,
          this.hexSize,
          Boolean(isSelected)
        );
        ctx.restore();
      }
    }
  }

  private drawTerrainAndBuilding(
    ctx: CanvasRenderingContext2D,
    tile: { terrain: TerrainId; building: string | null },
    images: Record<string, HTMLImageElement>,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const palette = TERRAIN[tile.terrain] ?? TERRAIN[TerrainId.Plains];
    const rgb = toRgb(palette.baseColor);
    const radius = this.hexSize;
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    ctx.save();
    this.hexPath(ctx, centerX, centerY, radius);
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
        ctx.save();
        this.hexPath(ctx, centerX, centerY, radius);
        const fog = ctx.createRadialGradient(
          centerX,
          centerY,
          radius * 0.15,
          centerX,
          centerY,
          radius * 1.1
        );
        fog.addColorStop(0, 'rgba(24, 34, 48, 0.5)');
        fog.addColorStop(1, 'rgba(8, 12, 20, 0.82)');
        ctx.fillStyle = fog;
        ctx.fill();
        ctx.restore();
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
      ctx.shadowBlur = size * 0.65;
      ctx.lineWidth = Math.max(2, size * 0.08);
      ctx.strokeStyle = stroke;
      ctx.stroke();
    } else {
      ctx.lineWidth = Math.max(1, size * 0.05);
      ctx.strokeStyle = 'rgba(12, 18, 28, 0.55)';
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

  private ensureChunkCache(images?: Record<string, HTMLImageElement>): void {
    if (!this.cachedCanvasElement) {
      return;
    }
    if (images) {
      this.cachedImages = images;
    }
    this.refreshDirtyChunks();
    if (this.dirtyChunks.size === 0) {
      return;
    }

    const terrainCtx = this.cachedCanvasElement.getContext('2d');
    if (!terrainCtx) {
      throw new Error('Canvas 2D context not available for terrain cache');
    }

    terrainCtx.save();
    terrainCtx.setTransform(1, 0, 0, 1, 0, 0);

    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const assets = this.cachedImages!;
    for (const key of this.dirtyChunks) {
      const previous = this.chunkCanvases.get(key);
      const chunk = this.renderChunk(key, hexWidth, hexHeight, assets);
      if (!chunk) {
        if (previous) {
          const clearX = previous.origin.x - this.cachedCanvasOffset.x;
          const clearY = previous.origin.y - this.cachedCanvasOffset.y;
          terrainCtx.clearRect(clearX, clearY, previous.canvas.width, previous.canvas.height);
          this.chunkCanvases.delete(key);
        }
        continue;
      }

      this.chunkCanvases.set(key, chunk);
      const drawX = chunk.origin.x - this.cachedCanvasOffset.x;
      const drawY = chunk.origin.y - this.cachedCanvasOffset.y;
      terrainCtx.clearRect(drawX, drawY, chunk.canvas.width, chunk.canvas.height);
      terrainCtx.drawImage(chunk.canvas, drawX, drawY);
    }

    terrainCtx.restore();
    this.dirtyChunks.clear();
  }

  private refreshDirtyChunks(): void {
    for (const [key, tile] of this.mapRef.tiles) {
      const signature = tile.isFogged ? 'fogged' : `${tile.terrain}:${tile.building ?? ''}`;
      const previousSignature = this.tileRenderState.get(key);
      if (previousSignature !== signature) {
        this.tileRenderState.set(key, signature);
        const { q, r } = parseTileKey(key);
        this.dirtyChunks.add(chunkKey(q, r));
      }
    }

    for (const key of Array.from(this.tileRenderState.keys())) {
      if (!this.mapRef.tiles.has(key)) {
        this.tileRenderState.delete(key);
        const { q, r } = parseTileKey(key);
        this.dirtyChunks.add(chunkKey(q, r));
      }
    }
  }

  private renderChunk(
    key: ChunkKey,
    hexWidth: number,
    hexHeight: number,
    images: Record<string, HTMLImageElement>
  ): ChunkCanvas | null {
    const [chunkQ, chunkR] = key.split(',').map(Number);
    const qStart = chunkQ * CHUNK;
    const qEnd = qStart + CHUNK - 1;
    const rStart = chunkR * CHUNK;
    const rEnd = rStart + CHUNK - 1;
    const origin = this.getOrigin();
    const halfHexWidth = hexWidth / 2;
    const halfHexHeight = hexHeight / 2;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const tiles: Array<{ tile: { terrain: TerrainId; building: string | null }; x: number; y: number }>
      = [];

    for (let q = qStart; q <= qEnd; q++) {
      for (let r = rStart; r <= rEnd; r++) {
        const tile = this.mapRef.getTile(q, r);
        if (!tile || tile.isFogged) {
          continue;
        }

        const { x, y } = axialToPixel({ q, r }, this.hexSize);
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

    let canvas = this.chunkCanvases.get(key)?.canvas;
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
      this.drawTerrainAndBuilding(ctx, tile, images, drawX, drawY, hexWidth, hexHeight);
      this.strokeHex(ctx, drawX + hexWidth / 2, drawY + hexHeight / 2, this.hexSize, false);
      ctx.restore();
    }

    return {
      canvas,
      origin: { x: minX, y: minY },
    };
  }
}
