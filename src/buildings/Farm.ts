import type { BuildingType } from '../hex/HexTile.ts';
import type { Building } from './Building.ts';

/** Simple economic building that keeps sauna beer brewing. */
export class Farm implements Building {
  readonly type: BuildingType = 'farm';
  readonly cost = 50;
  /** Amount of sauna beer bottled each tick. */
  readonly beerPerTick = 1;
}
