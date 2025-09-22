import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawUnitSprite } from './UnitSprite.ts';
import { getSpritePlacement } from './draw.ts';
import type { DrawUnitSpriteOptions } from './UnitSprite.ts';
import type { Unit } from '../../unit/index.ts';
import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';

function createStubContext(): CanvasRenderingContext2D {
  const gradientFactory = () => ({
    addColorStop: vi.fn()
  }) as unknown as CanvasGradient;
  const ctx = {
    canvas: { width: 256, height: 256 } as HTMLCanvasElement,
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => gradientFactory()),
    createRadialGradient: vi.fn(() => gradientFactory())
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

function createUnit(type: string, faction: string, coord: AxialCoord): Unit {
  return {
    id: `${type}-${coord.q}-${coord.r}`,
    type,
    faction,
    coord,
    renderCoord: coord
  } as unknown as Unit;
}

describe('drawUnitSprite', () => {
  let ctx: CanvasRenderingContext2D;
  let origin: PixelCoord;
  let coord: AxialCoord;
  let unit: Unit;
  let sprite: HTMLImageElement;

  beforeEach(() => {
    ctx = createStubContext();
    origin = { x: 12, y: -4 };
    coord = { q: 1, r: -2 };
    unit = createUnit('soldier', 'player', coord);
    sprite = document.createElement('img');
    Object.defineProperty(sprite, 'naturalWidth', { value: 32 });
    Object.defineProperty(sprite, 'naturalHeight', { value: 32 });
  });

  it('reuses sprite placement metadata and returns center coordinates', () => {
    const placementOptions: DrawUnitSpriteOptions['placement'] = {
      coord,
      hexSize: 32,
      origin,
      zoom: 1,
      type: unit.type
    };
    const expectedPlacement = getSpritePlacement(placementOptions);

    const result = drawUnitSprite(ctx, unit, {
      placement: placementOptions,
      sprite,
      faction: unit.faction,
      cameraZoom: 1,
      motionStrength: 0.25,
      selection: { isSelected: true, isPrimary: true }
    });

    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      expectedPlacement.drawX,
      expectedPlacement.drawY,
      expectedPlacement.width,
      expectedPlacement.height
    );
    expect(result.placement).toEqual(expectedPlacement);
    expect(result.center).toEqual({ x: expectedPlacement.centerX, y: expectedPlacement.centerY });
    expect(result.footprint.centerY).toBeGreaterThan(expectedPlacement.centerY);
    expect(result.footprint.radiusX).toBeGreaterThan(0);
    expect(ctx.strokeStyle).toMatch(/255/);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('skips sprite rendering when no image is provided', () => {
    const placementOptions: DrawUnitSpriteOptions['placement'] = {
      coord,
      hexSize: 28,
      origin,
      zoom: 0.9,
      type: unit.type
    };

    const result = drawUnitSprite(ctx, unit, {
      placement: placementOptions,
      sprite: null,
      faction: 'enemy',
      cameraZoom: 0.9,
      motionStrength: 0.6,
      selection: { isSelected: false }
    });

    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(result.placement).toEqual(getSpritePlacement(placementOptions));
    expect(result.footprint.radiusY).toBeGreaterThan(0);
  });
});
