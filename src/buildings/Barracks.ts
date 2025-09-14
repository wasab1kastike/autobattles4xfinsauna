import type { BuildingType } from '../hex/HexTile.ts';
import type { Building } from './Building.ts';

/** Military building capable of training units. */
export class Barracks implements Building {
  readonly type: BuildingType = 'barracks';
  readonly cost = 100;
  /** Number of units that can be trained simultaneously. */
  readonly trainingCapacity = 1;
}
