import type { BuildingType } from '../hex/HexTile.ts';
import type { Building } from './Building.ts';

/** Simple economic building that increases food production. */
export class Farm implements Building {
  readonly type: BuildingType = 'farm';
  readonly cost = 50;
  /** Amount of food generated each tick. */
  readonly foodPerTick = 1;
}
