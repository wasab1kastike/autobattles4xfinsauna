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

const HEX_WIDTH_TO_HEIGHT_RATIO = 2 / Math.sqrt(3);

function makeSpriteMeta(
  nativeWidth: number,
  nativeHeight: number,
  {
    anchorX = 0.5,
    anchorY,
    scaleY,
    nudgeX = 0,
    nudgeY = -0.02
  }: {
    anchorX?: number;
    anchorY: number;
    scaleY: number;
    nudgeX?: number;
    nudgeY?: number;
  }
): UnitSpriteMetadata {
  return {
    nativeSize: { width: nativeWidth, height: nativeHeight },
    anchor: { x: anchorX, y: anchorY },
    scale: { x: scaleY * HEX_WIDTH_TO_HEIGHT_RATIO, y: scaleY },
    nudge: { x: nudgeX, y: nudgeY }
  } satisfies UnitSpriteMetadata;
}

const DEFAULT_SPRITE: UnitSpriteMetadata = makeSpriteMeta(64, 64, {
  anchorY: 0.92,
  scaleY: 1,
  nudgeY: -0.05
});

const PLAYER_SQUARE_META = makeSpriteMeta(1024, 1024, {
  anchorY: 0.7,
  scaleY: 1.2,
  nudgeY: -0.018
});

const PLAYER_TALL_META = makeSpriteMeta(1024, 1536, {
  anchorY: 0.81,
  scaleY: 1.32,
  nudgeY: -0.016
});

const ENEMY_VANGUARD_META = makeSpriteMeta(1024, 1536, {
  anchorY: 0.835,
  scaleY: 1.38,
  nudgeY: -0.024
});

const ENEMY_WARLOCK_META = makeSpriteMeta(1024, 1536, {
  anchorY: 0.842,
  scaleY: 1.44,
  nudgeY: -0.028
});

export const UNIT_SPRITE_MAP: Record<UnitSpriteId, UnitSpriteMetadata> = {
  default: DEFAULT_SPRITE,
  soldier: PLAYER_TALL_META,
  archer: PLAYER_TALL_META,
  'avanto-marauder': ENEMY_VANGUARD_META,
  marauder: ENEMY_VANGUARD_META,
  raider: ENEMY_VANGUARD_META,
  'raider-captain': ENEMY_WARLOCK_META,
  'raider-shaman': ENEMY_WARLOCK_META,
  saunoja: PLAYER_SQUARE_META,
  'saunoja-guardian': PLAYER_TALL_META,
  'saunoja-seer': PLAYER_TALL_META
};

export function getUnitSpriteMetadata(type: string): UnitSpriteMetadata {
  const lookup = UNIT_SPRITE_MAP as Record<string, UnitSpriteMetadata>;
  return lookup[type] ?? DEFAULT_SPRITE;
}
