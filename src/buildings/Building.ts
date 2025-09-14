import type { BuildingType } from '../hex/HexTile.ts';

/** Basic building interface shared by all buildings. */
export interface Building {
  /** Unique string identifier for the building type. */
  readonly type: BuildingType;
  /** One-time gold cost to construct the building. */
  readonly cost: number;
}
