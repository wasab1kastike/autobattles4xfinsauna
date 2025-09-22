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
  scale: { x: 1, y: 1 },
  nudge: { x: 0, y: -0.05 }
};

const AVANTO_MARAUDER_META: UnitSpriteMetadata = {
  nativeSize: { width: 176, height: 196 },
  anchor: { x: 0.5, y: 0.836 },
  scale: { x: 1.5553109292455225, y: 1.5 },
  nudge: { x: 0, y: -0.03 }
};

export const UNIT_SPRITE_MAP: Record<UnitSpriteId, UnitSpriteMetadata> = {
  default: DEFAULT_SPRITE,
  soldier: {
    nativeSize: { width: 160, height: 184 },
    anchor: { x: 0.5, y: 0.815 },
    scale: { x: 1.3806202089317139, y: 1.375 },
    nudge: { x: 0, y: -0.02 }
  },
  archer: {
    nativeSize: { width: 168, height: 188 },
    anchor: { x: 0.5, y: 0.81 },
    scale: { x: 1.4510532031494585, y: 1.40625 },
    nudge: { x: 0, y: -0.015 }
  },
  'avanto-marauder': AVANTO_MARAUDER_META,
  marauder: AVANTO_MARAUDER_META,
  raider: {
    nativeSize: { width: 176, height: 198 },
    anchor: { x: 0.5, y: 0.832 },
    scale: { x: 1.524, y: 1.47 },
    nudge: { x: 0, y: -0.028 }
  },
  'raider-captain': {
    nativeSize: { width: 184, height: 206 },
    anchor: { x: 0.5, y: 0.838 },
    scale: { x: 1.598, y: 1.556 },
    nudge: { x: 0, y: -0.034 }
  },
  'raider-shaman': {
    nativeSize: { width: 180, height: 212 },
    anchor: { x: 0.5, y: 0.842 },
    scale: { x: 1.548, y: 1.532 },
    nudge: { x: 0, y: -0.036 }
  },
  saunoja: {
    nativeSize: { width: 128, height: 128 },
    anchor: { x: 0.5, y: 0.66 },
    scale: { x: 1, y: 1 },
    nudge: { x: 0, y: -0.02 }
  },
  'saunoja-guardian': {
    nativeSize: { width: 160, height: 176 },
    anchor: { x: 0.5, y: 0.806 },
    scale: { x: 1.37776768783888, y: 1.3125 },
    nudge: { x: 0, y: -0.015 }
  },
  'saunoja-seer': {
    nativeSize: { width: 160, height: 176 },
    anchor: { x: 0.5, y: 0.806 },
    scale: { x: 1.37776768783888, y: 1.3125 },
    nudge: { x: 0, y: -0.015 }
  }
};

export function getUnitSpriteMetadata(type: string): UnitSpriteMetadata {
  const lookup = UNIT_SPRITE_MAP as Record<string, UnitSpriteMetadata>;
  return lookup[type] ?? DEFAULT_SPRITE;
}
