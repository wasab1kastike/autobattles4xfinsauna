import { describe, expect, it, vi, beforeEach } from 'vitest';
import { drawUnits } from './renderer.ts';
import type { Unit } from '../unit/index.ts';
import type { HexMapRenderer } from './HexMapRenderer.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import type { Sauna } from '../sim/sauna.ts';
import type { DrawUnitSpriteOptions, UnitSpriteRenderResult } from './units/UnitSprite.ts';
import { camera } from '../camera/autoFrame.ts';

const isSisuBurstActive = vi.fn(() => false);
vi.mock('../sisu/burst.ts', () => ({
  isSisuBurstActive: () => isSisuBurstActive()
}));

type DrawUnitSpriteMock = (
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  options: DrawUnitSpriteOptions
) => UnitSpriteRenderResult;

const drawUnitSpriteMock = vi.hoisted(() => ({
  fn: vi.fn<DrawUnitSpriteMock>()
}));

vi.mock('./units/UnitSprite.ts', async () => {
  const actual = await vi.importActual<typeof import('./units/UnitSprite.ts')>(
    './units/UnitSprite.ts'
  );
  return {
    ...actual,
    drawUnitSprite: drawUnitSpriteMock.fn
  } satisfies typeof actual;
});

function createMockContext(): CanvasRenderingContext2D {
  const canvas = {
    width: 256,
    height: 256
  } as HTMLCanvasElement;
  const ctx = {
    canvas,
    save: vi.fn(),
    restore: vi.fn(),
    strokeRect: vi.fn(),
    filter: '',
    globalAlpha: 1,
    strokeStyle: '',
    lineWidth: 1
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function createStubUnit(
  id: string,
  faction: string,
  coord: { q: number; r: number },
  type: string,
  visionRange = 3
): Unit {
  return {
    id,
    faction,
    coord,
    type,
    stats: {
      health: 10,
      attackDamage: 1,
      attackRange: 1,
      movementRange: 1
    },
    isDead: () => false,
    getMaxHealth: () => 10,
    getVisionRange: () => visionRange
  } as unknown as Unit;
}

describe('drawUnits', () => {
  beforeEach(() => {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    isSisuBurstActive.mockReturnValue(false);
    drawUnitSpriteMock.fn.mockReset();
    drawUnitSpriteMock.fn.mockReturnValue({
      placement: {
        drawX: 12,
        drawY: 24,
        width: 48,
        height: 64,
        centerX: 12 + 48 * 0.5,
        centerY: 24 + 64 * 0.5,
        metadata: {
          nativeSize: { width: 64, height: 64 },
          anchor: { x: 0.5, y: 0.9 },
          scale: { x: 1, y: 1 },
          nudge: { x: 0, y: 0 }
        }
      },
      center: { x: 36, y: 56 },
      footprint: {
        centerX: 36,
        centerY: 78,
        radiusX: 24,
        radiusY: 12,
        top: 66,
        bottom: 90
      }
    });
  });

  it('renders enemies within friendly vision when Saunoja overlay hides player sprites', () => {
    const friendly = createStubUnit('friendly', 'player', { q: 0, r: 0 }, 'soldier');
    const enemy = createStubUnit('enemy', 'enemy', { q: 1, r: 0 }, 'marauder');
    const mapRenderer = { hexSize: 32 } as unknown as HexMapRenderer;
    const origin: PixelCoord = { x: 0, y: 0 };
    const ctx = createMockContext();
    const makeImage = () => document.createElement('img') as HTMLImageElement;
    const assets = {
      'unit-soldier': makeImage(),
      'unit-marauder': makeImage(),
      placeholder: makeImage()
    };

    drawUnits(ctx, mapRenderer, assets, [enemy], origin, undefined, [friendly], null, null);

    expect(drawUnitSpriteMock.fn).toHaveBeenCalledTimes(1);
    const call = drawUnitSpriteMock.fn.mock.calls[0];
    expect(call[1]).toBe(enemy);
    expect(call[2]).toMatchObject({
      faction: 'enemy',
      placement: {
        coord: enemy.coord,
        hexSize: 32,
        origin,
        zoom: 1,
        type: 'marauder'
      }
    });
  });

  it('renders enemies overlapping the sauna when only sauna vision is supplied', () => {
    const enemy = createStubUnit('enemy', 'enemy', { q: 0, r: 0 }, 'marauder');
    const sauna = {
      pos: enemy.coord,
      auraRadius: 0,
      visionRange: 2
    } as unknown as Sauna;
    const mapRenderer = { hexSize: 32 } as unknown as HexMapRenderer;
    const origin: PixelCoord = { x: 0, y: 0 };
    const ctx = createMockContext();
    const makeImage = () => document.createElement('img') as HTMLImageElement;
    const assets = {
      'unit-marauder': makeImage(),
      placeholder: makeImage()
    };

    drawUnits(ctx, mapRenderer, assets, [enemy], origin, undefined, [], sauna, null);

    expect(drawUnitSpriteMock.fn).toHaveBeenCalledTimes(1);
    const [, , opts] = drawUnitSpriteMock.fn.mock.calls[0];
    expect(opts.placement.coord).toEqual(enemy.coord);
    expect(opts.selection?.isSelected).toBe(false);
  });

  it('passes selection flags and exposes placement for Sisu burst outlines', () => {
    const player = createStubUnit('player', 'player', { q: 0, r: 0 }, 'soldier');
    (player as { selected?: boolean }).selected = true;
    const mapRenderer = { hexSize: 32 } as unknown as HexMapRenderer;
    const origin: PixelCoord = { x: 0, y: 0 };
    const ctx = createMockContext();
    const makeImage = () => document.createElement('img') as HTMLImageElement;
    const assets = {
      'unit-soldier': makeImage(),
      placeholder: makeImage()
    };

    isSisuBurstActive.mockReturnValue(true);
    drawUnitSpriteMock.fn.mockReturnValue({
      placement: {
        drawX: 10,
        drawY: 20,
        width: 30,
        height: 40,
        centerX: 25,
        centerY: 38,
        metadata: {
          nativeSize: { width: 64, height: 64 },
          anchor: { x: 0.5, y: 0.9 },
          scale: { x: 1, y: 1 },
          nudge: { x: 0, y: 0 }
        }
      },
      center: { x: 25, y: 38 },
      footprint: {
        centerX: 25,
        centerY: 52,
        radiusX: 20,
        radiusY: 10,
        top: 42,
        bottom: 62
      }
    });

    drawUnits(ctx, mapRenderer, assets, [player], origin, undefined, [player], null, player.coord);

    const [, , opts] = drawUnitSpriteMock.fn.mock.calls[0];
    expect(opts.selection).toEqual({ isSelected: true, isPrimary: true });
    expect(ctx.strokeRect).toHaveBeenCalledWith(10, 20, 30, 40);
  });
});
