import { AxialCoord, axialToPixel, getNeighbors as axialNeighbors } from './hex/HexUtils.ts';
import { HexTile } from './hex/HexTile.ts';

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

  /** Retrieve existing neighbor tiles around the given coordinate. */
  getNeighbors(q: number, r: number): HexTile[] {
    return axialNeighbors({ q, r })
      .map((c) => this.getTile(c.q, c.r))
      .filter((t): t is HexTile => Boolean(t));
  }

  /** Draw the map onto a canvas context. */
  draw(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    const hexWidth = this.hexSize * Math.sqrt(3);
    const hexHeight = this.hexSize * 2;
    this.forEachTile((tile, coord) => {
      const { x, y } = axialToPixel(coord, this.hexSize);
      const terrainKey = tile.terrain === 'water' ? 'water' : 'grass';
      const terrain = images[terrainKey] ?? images['placeholder'];
      ctx.drawImage(terrain, x, y, hexWidth, hexHeight);
      if (tile.building) {
        const building = images[tile.building] ?? images['placeholder'];
        ctx.drawImage(building, x, y, hexWidth, hexHeight);
      }
      const isSelected = selected && coord.q === selected.q && coord.r === selected.r;
      this.drawHex(
        ctx,
        x + this.hexSize,
        y + this.hexSize,
        this.hexSize,
        'rgba(0,0,0,0)',
        Boolean(isSelected)
      );
    });
  }

  /** Convenience method to draw directly to a canvas element. */
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

  private drawHex(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    fill: string,
    selected = false
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
    ctx.strokeStyle = selected ? '#ff0000' : '#000000';
    ctx.fill();
    ctx.stroke();
  }
}
