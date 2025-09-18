import { TerrainId } from '../map/terrain.ts';

export type TerrainType = TerrainId;
export type BuildingType = 'city' | 'farm' | 'barracks' | 'mine' | null;

export type TileMutation = 'terrain' | 'building' | 'fog';
export type TileMutationListener = (mutation: TileMutation) => void;

/** Represents a single hex tile on the map. */
export class HexTile {
  private _terrain: TerrainType;
  private _building: BuildingType;
  private _isFogged: boolean;
  private readonly listeners = new Set<TileMutationListener>();

  constructor(
    terrain: TerrainType = TerrainId.Plains,
    building: BuildingType = null,
    isFogged: boolean = true
  ) {
    this._terrain = terrain;
    this._building = building;
    this._isFogged = isFogged;
  }

  get terrain(): TerrainType {
    return this._terrain;
  }

  set terrain(value: TerrainType) {
    if (this._terrain === value) {
      return;
    }
    this._terrain = value;
    this.notify('terrain');
  }

  get building(): BuildingType {
    return this._building;
  }

  set building(value: BuildingType) {
    if (this._building === value) {
      return;
    }
    this._building = value;
    this.notify('building');
  }

  get isFogged(): boolean {
    return this._isFogged;
  }

  set isFogged(value: boolean) {
    if (this._isFogged === value) {
      return;
    }
    this._isFogged = value;
    this.notify('fog');
  }

  /** Reveal the tile by removing fog. */
  reveal(): void {
    this.isFogged = false;
  }

  /** Place or replace a building on this tile. */
  placeBuilding(building: BuildingType): void {
    this.building = building;
  }

  /** Toggle fog of war state. */
  setFogged(value: boolean): void {
    this.isFogged = value;
  }

  addMutationListener(listener: TileMutationListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(mutation: TileMutation): void {
    for (const listener of this.listeners) {
      listener(mutation);
    }
  }
}
