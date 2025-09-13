export type TerrainType = 'plain' | 'water' | 'forest' | 'mountain';
export type BuildingType = 'city' | 'farm' | 'mine' | null;

/** Represents a single hex tile on the map. */
export class HexTile {
  constructor(
    public terrain: TerrainType = 'plain',
    public building: BuildingType = null,
    public isFogged: boolean = true
  ) {}

  /** Reveal the tile by removing fog. */
  reveal(): void {
    this.isFogged = false;
  }
}
