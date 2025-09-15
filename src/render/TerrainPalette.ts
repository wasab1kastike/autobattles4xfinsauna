import { TerrainId } from '../map/terrain.ts';
import plainsIcon from '../../assets/tiles/plains.svg';
import forestIcon from '../../assets/tiles/forest.svg';
import hillsIcon from '../../assets/tiles/mountain.svg';
import lakeIcon from '../../assets/tiles/water.svg';

export type TerrainVisual = {
  /** Base color used to paint the underlying hex. */
  baseColor: string;
  /** Path to the vector icon that represents the terrain. */
  icon: string;
};

export const TERRAIN: Record<TerrainId, TerrainVisual> = {
  [TerrainId.Plains]: {
    baseColor: '#d8b869',
    icon: plainsIcon,
  },
  [TerrainId.Forest]: {
    baseColor: '#237a55',
    icon: forestIcon,
  },
  [TerrainId.Hills]: {
    baseColor: '#b57c57',
    icon: hillsIcon,
  },
  [TerrainId.Lake]: {
    baseColor: '#3185d5',
    icon: lakeIcon,
  },
};
