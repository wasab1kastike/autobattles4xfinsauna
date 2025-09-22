import { bench, beforeAll, afterAll, vi } from 'vitest';
import { drawUnits, type RendererAssets } from '../../src/render/renderer.ts';
import type { Unit } from '../../src/unit/index.ts';
import type { HexMapRenderer } from '../../src/render/HexMapRenderer.ts';
import type { PixelCoord } from '../../src/hex/HexUtils.ts';
import type { UnitSpriteRenderResult } from '../../src/render/units/UnitSprite.ts';
import * as UnitSpriteModule from '../../src/render/units/UnitSprite.ts';
import { camera } from '../../src/camera/autoFrame.ts';
import type { UnitSpriteAtlas, SpriteAtlasSlice } from '../../src/render/units/spriteAtlas.ts';

function createStubContext(): CanvasRenderingContext2D {
  return {
    canvas: { width: 512, height: 512 } as HTMLCanvasElement,
    save: () => {},
    restore: () => {},
    strokeRect: () => {},
    filter: 'none',
    shadowColor: 'rgba(0,0,0,0)',
    shadowBlur: 0,
    globalAlpha: 1
  } as unknown as CanvasRenderingContext2D;
}

function createStubAtlas(keys: string[]): UnitSpriteAtlas {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const slices: Record<string, SpriteAtlasSlice> = {};
  keys.forEach((key, index) => {
    const sx = index * 32;
    slices[key] = {
      id: key,
      sx,
      sy: 0,
      sw: 32,
      sh: 32,
      u0: sx / canvas.width,
      v0: 0,
      u1: (sx + 32) / canvas.width,
      v1: 32 / canvas.height
    } satisfies SpriteAtlasSlice;
  });
  return {
    canvas,
    width: canvas.width,
    height: canvas.height,
    padding: 2,
    slices
  } satisfies UnitSpriteAtlas;
}

function createUnit(id: string, type: string, faction: string, coord: { q: number; r: number }): Unit {
  return {
    id,
    type,
    faction,
    coord,
    stats: { health: 10 },
    isDead: () => false,
    getMaxHealth: () => 10,
    getVisionRange: () => 3,
    getShield: () => 0,
    combatKeywords: null
  } as unknown as Unit;
}

const mapRenderer = { hexSize: 32 } as unknown as HexMapRenderer;
const origin: PixelCoord = { x: 0, y: 0 };
const atlas = createStubAtlas(['unit-soldier', 'unit-marauder']);
const makeImage = () => document.createElement('img') as HTMLImageElement;

const assets: RendererAssets = {
  images: {
    'unit-soldier': makeImage(),
    'unit-marauder': makeImage(),
    placeholder: makeImage()
  },
  atlas
};

const units: Unit[] = Array.from({ length: 24 }, (_, index) =>
  createUnit(`unit-${index}`, index % 2 === 0 ? 'soldier' : 'marauder', index % 2 === 0 ? 'player' : 'enemy', {
    q: index % 6,
    r: Math.floor(index / 6)
  })
);

let drawUnitSpriteSpy: ReturnType<typeof vi.spyOn>;

beforeAll(() => {
  camera.x = 0;
  camera.y = 0;
  camera.zoom = 1;
  const stubResult: UnitSpriteRenderResult = {
    placement: {
      drawX: 0,
      drawY: 0,
      width: 32,
      height: 48,
      centerX: 16,
      centerY: 24,
      metadata: {
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.9 },
        scale: { x: 1, y: 1 },
        nudge: { x: 0, y: 0 }
      }
    },
    center: { x: 16, y: 24 },
    footprint: {
      centerX: 16,
      centerY: 32,
      radiusX: 12,
      radiusY: 6,
      top: 26,
      bottom: 38
    }
  };
  drawUnitSpriteSpy = vi.spyOn(UnitSpriteModule, 'drawUnitSprite').mockReturnValue(stubResult);
});

afterAll(() => {
  drawUnitSpriteSpy.mockRestore();
});

bench('drawUnits with sprite atlas', () => {
  const ctx = createStubContext();
  drawUnits(ctx, mapRenderer, assets, units, origin, undefined, units, null, null);
});
