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

type UnitSpriteId =
  | UnitArchetypeId
  | 'marauder'
  | 'raider'
  | 'raider-captain'
  | 'raider-shaman'
  | 'saunoja'
  | 'saunoja-guardian'
  | 'saunoja-seer'
  | 'default';

const DEFAULT_SPRITE: UnitSpriteMetadata = {
  nativeSize: { width: 64, height: 64 },
  anchor: { x: 0.5, y: 0.92 },
  scale: { x: 1.154700538, y: 1 },
  nudge: { x: 0, y: -0.05 }
};

const AVANTO_MARAUDER_META: UnitSpriteMetadata = {
  nativeSize: { width: 64, height: 64 },
  anchor: { x: 0.5, y: 0.836 },
  scale: { x: 1.732050808, y: 1.5 },
  nudge: { x: 0, y: -0.03 }
};

export const UNIT_SPRITE_MAP: Record<UnitSpriteId, UnitSpriteMetadata> = {
  default: DEFAULT_SPRITE,
  soldier: {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.815 },
    scale: { x: 1.58771324, y: 1.375 },
    nudge: { x: 0, y: -0.02 }
  },
  archer: {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.81 },
    scale: { x: 1.623797632, y: 1.40625 },
    nudge: { x: 0, y: -0.015 }
  },
  'avanto-marauder': AVANTO_MARAUDER_META,
  marauder: AVANTO_MARAUDER_META,
  raider: {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.832 },
    scale: { x: 1.697409791, y: 1.47 },
    nudge: { x: 0, y: -0.028 }
  },
  'raider-captain': {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.838 },
    scale: { x: 1.796714038, y: 1.556 },
    nudge: { x: 0, y: -0.034 }
  },
  'raider-shaman': {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.842 },
    scale: { x: 1.769001225, y: 1.532 },
    nudge: { x: 0, y: -0.036 }
  },
  saunoja: {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.66 },
    scale: { x: 1.154700538, y: 1 },
    nudge: { x: 0, y: -0.02 }
  },
  'saunoja-guardian': {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.806 },
    scale: { x: 1.515544457, y: 1.3125 },
    nudge: { x: 0, y: -0.015 }
  },
  'saunoja-seer': {
    nativeSize: { width: 64, height: 64 },
    anchor: { x: 0.5, y: 0.806 },
    scale: { x: 1.515544457, y: 1.3125 },
    nudge: { x: 0, y: -0.015 }
  }
};

export function getUnitSpriteMetadata(type: string): UnitSpriteMetadata {
  const lookup = UNIT_SPRITE_MAP as Record<string, UnitSpriteMetadata>;
  return lookup[type] ?? DEFAULT_SPRITE;
}
