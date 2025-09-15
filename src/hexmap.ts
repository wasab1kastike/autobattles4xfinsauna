import type { AxialCoord } from './hex/HexUtils.ts';
import { axialToPixel, getNeighbors as axialNeighbors } from './hex/HexUtils.ts';
import { HexTile } from './hex/HexTile.ts';
import { TerrainId, terrainAt } from './map/terrain.ts';
import { getHexDimensions } from './hex/HexDimensions.ts';
import { markRevealed, autoFrame, tweenCamera } from './camera/autoFrame.ts';

/** Simple hex map composed of tiles in axial coordinates. */
export class HexMap {
  /** Map of serialized "q,r" keys to tiles. */
  readonly tiles = new Map<string, HexTile>();

  /** Current map bounds. */
  minQ: number;
  maxQ: number;
  minR: number;
  maxR: number;

  constructor(
    width = 10,
    height = 10,
    public readonly hexSize = 32,
    private readonly seed = 0
  ) {
    this.minQ = 0;
    this.minR = 0;
    this.maxQ = width - 1;
    this.maxR = height - 1;
    for (let r = this.minR; r <= this.maxR; r++) {
      for (let q = this.minQ; q <= this.maxQ; q++) {
        this.tiles.set(this.key(q, r), new HexTile(terrainAt(q, r, seed)));
      }
    }
  }

  /** Current width derived from tracked bounds. */
  get width(): number {
    return this.maxQ - this.minQ + 1;
  }

  /** Current height derived from tracked bounds. */
  get height(): number {
    return this.maxR - this.minR + 1;
  }

  private key(q: number, r: number): string {
    return `${q},${r}`;
  }

  /** Ensure a tile exists at the given coordinate, creating it if missing. */
  ensureTile(q: number, r: number): HexTile {
    const k = this.key(q, r);
    let tile = this.tiles.get(k);
    if (!tile) {
      tile = new HexTile(terrainAt(q, r, this.seed));
      this.tiles.set(k, tile);
      this.minQ = Math.min(this.minQ, q);
      this.maxQ = Math.max(this.maxQ, q);
      this.minR = Math.min(this.minR, r);
      this.maxR = Math.max(this.maxR, r);
      if (!tile.isFogged) {
        markRevealed({ q, r }, this.hexSize);
      }
    }
    return tile;
  }

  getTile(q: number, r: number): HexTile {
    return this.ensureTile(q, r);
  }

  forEachTile(cb: (tile: HexTile, coord: AxialCoord) => void): void {
    for (let r = this.minR; r <= this.maxR; r++) {
      for (let q = this.minQ; q <= this.maxQ; q++) {
        const tile = this.ensureTile(q, r);
        cb(tile, { q, r });
      }
    }
  }

  /** Retrieve neighbor tiles around the given coordinate, generating them on demand. */
  getNeighbors(q: number, r: number): HexTile[] {
    return axialNeighbors({ q, r }).map((c) => this.ensureTile(c.q, c.r));
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
        const coord = { q: center.q + dq, r: center.r + dr };
        const tile = this.ensureTile(coord.q, coord.r);
        tile.reveal();
        markRevealed(coord, this.hexSize);
      }
    }

    const viewport = typeof window !== 'undefined'
      ? { width: window.innerWidth, height: window.innerHeight }
      : { width: 0, height: 0 };
    const frame = autoFrame(viewport);
    tweenCamera(frame, 300);
  }

  /** Draw the map onto a canvas context. */
  draw(
    ctx: CanvasRenderingContext2D,
    images: Record<string, HTMLImageElement>,
    selected?: AxialCoord
  ): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const origin = axialToPixel({ q: this.minQ, r: this.minR }, this.hexSize);
    for (const [key, tile] of this.tiles) {
      const [q, r] = key.split(',').map(Number);
      const { x, y } = axialToPixel({ q, r }, this.hexSize);
      const drawX = x - origin.x;
      const drawY = y - origin.y;
      ctx.save();
      if (tile.isFogged) ctx.globalAlpha *= 0.4;

      this.drawTerrain(ctx, images, tile.terrain, drawX, drawY);

      if (tile.building) {
        const building = images[`building-${tile.building}`] ?? images['placeholder'];
        ctx.drawImage(building, drawX, drawY, hexWidth, hexHeight);
      }

      const isSelected =
        selected && q === selected.q && r === selected.r;
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
    images: Record<string, HTMLImageElement>,
    terrain: TerrainId,
    x: number,
    y: number
  ): void {
    const { width: hexWidth, height: hexHeight } = getHexDimensions(this.hexSize);
    const key = `terrain-${TerrainId[terrain].toLowerCase()}`;
    const img = images[key] ?? images['placeholder'];
    ctx.drawImage(img, x, y, hexWidth, hexHeight);
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
