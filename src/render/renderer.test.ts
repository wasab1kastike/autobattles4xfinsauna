import { describe, expect, it, vi, beforeEach } from 'vitest';
import { drawUnits } from './renderer.ts';
import type { Unit } from '../unit/index.ts';
import type { HexMapRenderer } from './HexMapRenderer.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import type { Sauna } from '../sim/sauna.ts';
import { camera } from '../camera/autoFrame.ts';

vi.mock('../sisu/burst.ts', () => ({
  isSisuBurstActive: () => false
}));

function createMockContext(): CanvasRenderingContext2D {
  const canvas = {
    width: 256,
    height: 256
  } as HTMLCanvasElement;
  const ctx = {
    canvas,
    save: vi.fn(),
    restore: vi.fn(),
    drawImage: vi.fn(),
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

    drawUnits(ctx, mapRenderer, assets, [enemy], origin, undefined, [friendly]);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      assets['unit-marauder'],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('renders enemies overlapping the sauna when only sauna vision is supplied', () => {
    const enemy = createStubUnit('enemy', 'enemy', { q: 0, r: 0 }, 'marauder');
    const sauna = {
      pos: enemy.coord,
      auraRadius: 2
    } as unknown as Sauna;
    const mapRenderer = { hexSize: 32 } as unknown as HexMapRenderer;
    const origin: PixelCoord = { x: 0, y: 0 };
    const ctx = createMockContext();
    const makeImage = () => document.createElement('img') as HTMLImageElement;
    const assets = {
      'unit-marauder': makeImage(),
      placeholder: makeImage()
    };

    drawUnits(ctx, mapRenderer, assets, [enemy], origin, undefined, [], sauna);

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      assets['unit-marauder'],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });
});
