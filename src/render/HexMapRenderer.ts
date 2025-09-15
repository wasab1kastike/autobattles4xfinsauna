import type { AxialCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { HexMap } from '../hexmap.ts';
import { TerrainId } from '../map/terrain.ts';

export class HexMapRenderer {
  constructor(private readonly mapRef: HexMap) {}

  get hexSize(): number {
    return this.mapRef.hexSize;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const origin = axialToPixel({ q: this.mapRef.minQ, r: this.mapRef.minR }, this.hexSize);
    for (const [key, tile] of this.mapRef.tiles) {
      const [q, r] = key.split(',').map(Number);
      const { x, y } = axialToPixel({ q, r }, this.hexSize);
      const drawX = x - origin.x;
      const drawY = y - origin.y;
      ctx.save();
      if (tile.isFogged) ctx.globalAlpha *= 0.4;

      this.drawTerrain(ctx, images, tile.terrain, drawX, drawY, hexWidth, hexHeight);

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
    images: Record<string, HTMLImageElement>,
    terrain: TerrainId,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    const key = `terrain-${TerrainId[terrain].toLowerCase()}`;
    const img = images[key] ?? images['placeholder'];
    ctx.drawImage(img, x, y, width, height);
  }

  private strokeHex(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    selected = false
  ): void {
    this.hexPath(ctx, x, y, size);
    ctx.strokeStyle = selected ? '#ff0000' : '#000000';
    ctx.stroke();
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
