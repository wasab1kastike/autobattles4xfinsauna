import { AxialCoord, axialToPixel, getNeighbors as axialNeighbors } from './hex/HexUtils.ts';
import { HexTile } from './hex/HexTile.ts';
import { TerrainId, generateTerrain } from './map/terrain.ts';

/** Simple hex map composed of tiles in axial coordinates. */
export class HexMap {
  readonly tiles: HexTile[][];

  constructor(
    public readonly width = 10,
    public readonly height = 10,
    public readonly hexSize = 32,
    seed = 0
  ) {
    this.tiles = [];
    const terrain = generateTerrain(width, height, seed);
    for (let r = 0; r < height; r++) {
      const row: HexTile[] = [];
      for (let q = 0; q < width; q++) {
        row.push(new HexTile(terrain[r][q]));
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

  /**
   * Reveal all tiles within the given radius around a central coordinate.
   *
   * The hex range iteration is based on axial coordinates. For each offset
   * within the radius we reveal the tile if it exists on the map. Tiles
   * outside the radius remain fogged.
   */
  revealAround(center: AxialCoord, radius: number): void {
    for (let dq = -radius; dq <= radius; dq++) {
      const rMin = Math.max(-radius, -dq - radius);
      const rMax = Math.min(radius, -dq + radius);
      for (let dr = rMin; dr <= rMax; dr++) {
        const tile = this.getTile(center.q + dq, center.r + dr);
        tile?.reveal();
      }
    }
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
      ctx.save();
      if (tile.isFogged) ctx.globalAlpha *= 0.4;

      this.drawTerrain(ctx, tile.terrain, x + this.hexSize, y + this.hexSize);

      if (tile.building) {
        const building = images[tile.building] ?? images['placeholder'];
        ctx.drawImage(building, x, y, hexWidth, hexHeight);
      }

      const isSelected =
        selected && coord.q === selected.q && coord.r === selected.r;
      this.strokeHex(
        ctx,
        x + this.hexSize,
        y + this.hexSize,
        this.hexSize,
        Boolean(isSelected)
      );
      ctx.restore();
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

  private drawTerrain(
    ctx: CanvasRenderingContext2D,
    terrain: TerrainId,
    x: number,
    y: number
  ): void {
    const size = this.hexSize;
    this.hexPath(ctx, x, y, size);
    if (terrain === TerrainId.Lake) {
      ctx.fillStyle = '#3399ff';
      ctx.fill();
      return;
    }

    ctx.fillStyle = '#c2d1a1';
    ctx.fill();
    ctx.save();
    ctx.clip();
    if (terrain === TerrainId.Forest) {
      ctx.strokeStyle = '#2e8b57';
      for (let i = -size; i <= size; i += 4) {
        ctx.beginPath();
        ctx.moveTo(x - size, y + i);
        ctx.lineTo(x + size, y + i);
        ctx.stroke();
      }
    } else if (terrain === TerrainId.Hills) {
      ctx.fillStyle = '#8b7765';
      for (let dx = -size; dx <= size; dx += 6) {
        for (let dy = -size; dy <= size; dy += 6) {
          ctx.beginPath();
          ctx.arc(x + dx, y + dy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
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
}
