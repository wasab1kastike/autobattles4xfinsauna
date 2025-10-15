import type { AxialCoord } from './hex/HexUtils.ts';
import { getNeighbors as axialNeighbors } from './hex/HexUtils.ts';
import { HexTile, type TileMutation } from './hex/HexTile.ts';
import { terrainAt } from './map/terrain.ts';
import { markRevealed, autoFrame, queueCameraTween } from './camera/autoFrame.ts';

export type TileChangeType = TileMutation | 'created';
export type TileChangeListener = (coord: AxialCoord, tile: HexTile, change: TileChangeType) => void;

/** Simple hex map composed of tiles in axial coordinates. */
export class HexMap {
  /** Map of serialized "q,r" keys to tiles. */
  readonly tiles = new Map<string, HexTile>();
  private readonly tileSubscriptions = new Map<string, () => void>();
  private readonly changeListeners = new Set<TileChangeListener>();

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

  addTileChangeListener(listener: TileChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => this.changeListeners.delete(listener);
  }

  private notifyTileChange(coord: AxialCoord, tile: HexTile, change: TileChangeType): void {
    for (const listener of this.changeListeners) {
      listener(coord, tile, change);
    }
  }

  private attachTileListener(key: string, tile: HexTile, coord: AxialCoord): void {
    const unsubscribe = tile.addMutationListener((mutation) => {
      this.notifyTileChange(coord, tile, mutation);
    });
    this.tileSubscriptions.set(key, unsubscribe);
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
      this.attachTileListener(k, tile, { q, r });
      this.notifyTileChange({ q, r }, tile, 'created');
      if (!tile.isFogged) {
        markRevealed({ q, r }, this.hexSize);
      }
    }
    return tile;
  }

  getTile(q: number, r: number): HexTile | undefined {
    return this.tiles.get(this.key(q, r));
  }

  forEachTile(cb: (tile: HexTile, coord: AxialCoord) => void): void {
    for (const [key, tile] of this.tiles) {
      const [q, r] = key.split(',').map(Number);
      cb(tile, { q, r });
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
  revealAround(
    center: AxialCoord,
    radius: number,
    options: { autoFrame?: boolean } = {}
  ): void {
    const { autoFrame: shouldAutoFrame = true } = options;
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

    if (!shouldAutoFrame) {
      return;
    }

    const viewport = typeof window !== 'undefined'
      ? (() => {
          const width = Math.max(window.innerWidth, 0);
          const height = Math.max(window.innerHeight, 0);
          let occlusion = 0;
          if (typeof document !== 'undefined') {
            const rightPanel = document.getElementById('right-panel');
            if (rightPanel) {
              const panelRect = rightPanel.getBoundingClientRect();
              if (panelRect.width > 0) {
                const overlay = rightPanel.closest<HTMLElement>('#ui-overlay');
                if (overlay) {
                  const overlayRect = overlay.getBoundingClientRect();
                  const overlayStyles = window.getComputedStyle(overlay);
                  const paddingRight = Number.parseFloat(overlayStyles.paddingRight || '0');
                  const occlusionFromRects = overlayRect.right - panelRect.left;
                  const occlusionWithPadding = panelRect.width + (Number.isFinite(paddingRight) ? paddingRight : 0);
                  occlusion = Math.max(0, Math.max(occlusionFromRects, occlusionWithPadding));
                } else {
                  occlusion = Math.max(0, panelRect.width);
                }
              }
            }
          }
          const safeRight = Math.min(Math.max(occlusion, 0), width);
          return { width, height, safeRight };
        })()
      : { width: 0, height: 0, safeRight: 0 };
    const frame = autoFrame(viewport);
    queueCameraTween(frame, 300);
  }

}
