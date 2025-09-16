import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import type { HexPatternOptions } from '../map/hexPatterns.ts';
import { drawForest, drawHills, drawPlains, drawWater } from '../map/hexPatterns.ts';
import { TerrainId } from '../map/terrain.ts';
import { TERRAIN } from './TerrainPalette.ts';
import { loadIcon } from './loadIcon.ts';

const DEFAULT_HIGHLIGHT = 'rgba(56, 189, 248, 0.85)';
const DEFAULT_HIGHLIGHT_GLOW = 'rgba(56, 189, 248, 0.45)';

let highlightStroke: string | null = null;
let highlightGlow: string | null = null;

const TERRAIN_PATTERNS: Record<TerrainId, (options: HexPatternOptions) => void> = {
  [TerrainId.Plains]: drawPlains,
  [TerrainId.Forest]: drawForest,
  [TerrainId.Hills]: drawHills,
  [TerrainId.Lake]: drawWater,
};

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
  constructor(private readonly mapRef: HexMap) {}

  get hexSize(): number {
    return this.mapRef.hexSize;
  }

  getOrigin(): PixelCoord {
    return axialToPixel({ q: this.mapRef.minQ, r: this.mapRef.minR }, this.hexSize);
  }

  draw(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const origin = this.getOrigin();
    for (const [key, tile] of this.mapRef.tiles) {
      const [q, r] = key.split(',').map(Number);
      const { x, y } = axialToPixel({ q, r }, this.hexSize);
      const drawX = x - origin.x;
      const drawY = y - origin.y;
      ctx.save();
      if (tile.isFogged) {
        ctx.globalAlpha = 0.4;
      }

      this.drawTerrain(ctx, tile.terrain, drawX, drawY, hexWidth, hexHeight);

      if (tile.building) {
        const building = images[`building-${tile.building}`] ?? images['placeholder'];
        ctx.drawImage(building, drawX, drawY, hexWidth, hexHeight);
      }

      const isSelected = selected && q === selected.q && r === selected.r;
      this.strokeHex(
        ctx,
        drawX + this.hexSize,
        drawY + this.hexSize,
        this.hexSize,
        Boolean(isSelected)
      );
      ctx.restore();
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

  private drawTerrain(
    ctx: CanvasRenderingContext2D,
    terrain: TerrainId,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const palette = TERRAIN[terrain] ?? TERRAIN[TerrainId.Plains];
    const rgb = toRgb(palette.baseColor);
    const radius = this.hexSize;
    const centerX = x + radius;
    const centerY = y + radius;

    ctx.save();
    this.hexPath(ctx, x + this.hexSize, y + this.hexSize, radius);
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
    const drawPattern = TERRAIN_PATTERNS[terrain] ?? drawPlains;
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
}
