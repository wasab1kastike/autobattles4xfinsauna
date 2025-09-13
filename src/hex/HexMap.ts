import { AxialCoord, axialToPixel } from './HexUtils.ts';
import { HexTile } from './HexTile.ts';

/** Simple hex map composed of tiles in axial coordinates. */
export class HexMap {
  readonly tiles: HexTile[][];

  constructor(
    public readonly width = 10,
    public readonly height = 10,
    public readonly hexSize = 32
  ) {
    this.tiles = [];
    for (let r = 0; r < height; r++) {
      const row: HexTile[] = [];
      for (let q = 0; q < width; q++) {
        row.push(new HexTile());
      }
      this.tiles.push(row);
    }
  }

  getTile(q: number, r: number): HexTile | undefined {
    return this.tiles[r]?.[q];
  }

  forEachTile(cb: (tile: HexTile, coord: AxialCoord) => void): void {
    for (let r = 0; r < this.height; r++) {
      for (let q = 0; q < this.width; q++) {
        cb(this.tiles[r][q], { q, r });
      }
    }
  }

  /** Draw the map onto a canvas context. */
  draw(ctx: CanvasRenderingContext2D): void {
    this.forEachTile((tile, coord) => {
      const { x, y } = axialToPixel(coord, this.hexSize);
      this.drawHex(ctx, x + this.hexSize, y + this.hexSize, this.hexSize, this.getFillColor(tile));
    });
  }

  /** Convenience method to draw directly to a canvas element. */
  drawToCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available');
    }
    this.draw(ctx);
  }

  private getFillColor(tile: HexTile): string {
    if (tile.isFogged) {
      return '#000000';
    }
    switch (tile.terrain) {
      case 'water':
        return '#1E90FF';
      case 'forest':
        return '#228B22';
      case 'mountain':
        return '#A9A9A9';
      default:
        return '#98FB98';
    }
  }

  private drawHex(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    fill: string
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
    ctx.fillStyle = fill;
    ctx.strokeStyle = '#000000';
    ctx.fill();
    ctx.stroke();
  }
}
