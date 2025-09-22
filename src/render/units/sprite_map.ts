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
  'avanto-marauder': {
    nativeSize: { width: 176, height: 196 },
    anchor: { x: 0.5, y: 0.836 },
    scale: { x: 1.5553109292455225, y: 1.5 },
    nudge: { x: 0, y: -0.03 }
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
