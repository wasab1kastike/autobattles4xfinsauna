import type { UnitArchetypeId } from '../../unit/types.ts';

export interface SpriteVector {
  readonly x: number;
  readonly y: number;
}

export interface SpriteSize {
  readonly width: number;
  readonly height: number;
}

export interface UnitSpriteMetadata {
  readonly nativeSize: SpriteSize;
  readonly anchor: SpriteVector;
  readonly scale: SpriteVector;
  readonly nudge: SpriteVector;
}

type UnitSpriteId = UnitArchetypeId | 'saunoja' | 'default';

const DEFAULT_SPRITE: UnitSpriteMetadata = {
  nativeSize: { width: 64, height: 64 },
  anchor: { x: 0.5, y: 0.92 },
  scale: { x: 1, y: 1 },
  nudge: { x: 0, y: -0.05 }
};

export const UNIT_SPRITE_MAP: Record<UnitSpriteId, UnitSpriteMetadata> = {
  default: DEFAULT_SPRITE,
  soldier: {
    nativeSize: { width: 128, height: 128 },
    anchor: { x: 0.5, y: 0.88 },
    scale: { x: 1.06, y: 1.18 },
    nudge: { x: 0, y: -0.1 }
  },
  archer: {
    nativeSize: { width: 128, height: 128 },
    anchor: { x: 0.5, y: 0.86 },
    scale: { x: 1.04, y: 1.16 },
    nudge: { x: 0, y: -0.08 }
  },
  'avanto-marauder': {
    nativeSize: { width: 128, height: 128 },
    anchor: { x: 0.5, y: 0.86 },
    scale: { x: 1.08, y: 1.12 },
    nudge: { x: 0, y: -0.12 }
  },
  saunoja: {
    nativeSize: { width: 128, height: 128 },
    anchor: { x: 0.5, y: 0.66 },
    scale: { x: 1, y: 1 },
    nudge: { x: 0, y: -0.02 }
  }
};

export function getUnitSpriteMetadata(type: string): UnitSpriteMetadata {
  const lookup = UNIT_SPRITE_MAP as Record<string, UnitSpriteMetadata>;
  return lookup[type] ?? DEFAULT_SPRITE;
}
