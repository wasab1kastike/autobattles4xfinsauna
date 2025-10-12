import { beforeEach, describe, expect, it, vi } from 'vitest';
import { drawUnitSprite } from './UnitSprite.ts';
import { getSpritePlacement } from './draw.ts';
import type { DrawUnitSpriteOptions } from './UnitSprite.ts';
import type { Unit } from '../../unit/index.ts';
import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';
import { resetFactionPaletteCacheForTest } from '../../theme/factionPalette.ts';

type GradientStub = {
  readonly type: 'linear' | 'radial';
  readonly stops: Array<[number, string]>;
  addColorStop(offset: number, color: string): void;
};

function createStubContext(): CanvasRenderingContext2D & {
  readonly __gradients: GradientStub[];
  readonly __strokes: string[];
} {
  const gradients: GradientStub[] = [];
  const strokes: string[] = [];

  const makeGradient = (type: 'linear' | 'radial') => {
    const gradient: GradientStub = {
      type,
      stops: [],
      addColorStop: vi.fn((offset: number, color: string) => {
        gradient.stops.push([offset, color]);
      })
    };
    gradients.push(gradient);
    return gradient as unknown as CanvasGradient;
  };

  const ctx = {
    canvas: { width: 256, height: 256 } as HTMLCanvasElement,
    filter: 'none',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    strokeStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    lineWidth: 1,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(() => {
      strokes.push((ctx as CanvasRenderingContext2D & { strokeStyle: string }).strokeStyle as string);
    }),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => makeGradient('linear')),
    createRadialGradient: vi.fn(() => makeGradient('radial'))
  } as unknown as CanvasRenderingContext2D & { __gradients: GradientStub[]; __strokes: string[] };

  (ctx as { __gradients: GradientStub[] }).__gradients = gradients;
  (ctx as { __strokes: string[] }).__strokes = strokes;

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
    resetFactionPaletteCacheForTest();
    document.documentElement.removeAttribute('style');
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
    expect((ctx as { __strokes: string[] }).__strokes).toHaveLength(2);
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

  it('allows anchoring and offsetting sprite placement without redrawing the base', () => {
    const placementOptions: DrawUnitSpriteOptions['placement'] = {
      coord,
      hexSize: 32,
      origin,
      zoom: 1,
      type: unit.type
    };
    const basePlacement = getSpritePlacement(placementOptions);
    const anchorHint = { x: basePlacement.centerX + 8, y: basePlacement.centerY - 4 } satisfies PixelCoord;
    const offset = { x: -6, y: 10 } satisfies PixelCoord;

    const result = drawUnitSprite(ctx, unit, {
      placement: placementOptions,
      sprite,
      faction: unit.faction,
      cameraZoom: 1,
      motionStrength: 0.2,
      selection: { isSelected: false },
      anchorHint,
      offset,
      drawBase: false
    });

    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(result.placement.drawX).toBeCloseTo(
      basePlacement.drawX + (anchorHint.x - basePlacement.centerX) + offset.x
    );
    expect(result.placement.drawY).toBeCloseTo(
      basePlacement.drawY + (anchorHint.y - basePlacement.centerY) + offset.y
    );
    expect(result.center.x).toBeCloseTo(anchorHint.x + offset.x);
    expect(result.center.y).toBeCloseTo(anchorHint.y + offset.y);
    expect(result.footprint.centerY).toBeGreaterThan(result.center.y);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      sprite,
      result.placement.drawX,
      result.placement.drawY,
      result.placement.width,
      result.placement.height
    );
  });

  it('reads faction palette tokens from CSS variables for player and enemy sprites', () => {
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--faction-player-shell', 'rgba(10, 20, 30, 0.9)');
    rootStyle.setProperty('--faction-player-mid', 'rgba(30, 40, 50, 0.9)');
    rootStyle.setProperty('--faction-player-rim', 'rgba(50, 60, 70, 0.8)');
    rootStyle.setProperty('--faction-player-highlight', 'rgba(70, 80, 90, 0.7)');
    rootStyle.setProperty('--faction-player-ring', 'rgba(90, 100, 110, 0.6)');
    rootStyle.setProperty('--faction-player-motion-glow-rgb', '12 34 56');
    rootStyle.setProperty('--faction-enemy-rim', 'rgba(200, 110, 100, 0.74)');
    rootStyle.setProperty('--faction-enemy-ring', 'rgba(210, 120, 110, 0.58)');
    rootStyle.setProperty('--faction-enemy-highlight', 'rgba(220, 140, 130, 0.5)');
    rootStyle.setProperty('--faction-enemy-motion-glow-rgb', '90 45 30');
    resetFactionPaletteCacheForTest();

    const playerCtx = createStubContext();
    drawUnitSprite(playerCtx, unit, {
      placement: { coord, hexSize: 32, origin, zoom: 1, type: unit.type },
      sprite,
      faction: 'player',
      cameraZoom: 1,
      motionStrength: 0.5,
      selection: { isSelected: false }
    });
    const playerGradients = (playerCtx as { __gradients: GradientStub[] }).__gradients;
    const playerColors = playerGradients.flatMap((gradient) => gradient.stops.map(([, color]) => color));
    expect(playerColors).toContain('rgba(70, 80, 90, 0.7)');
    expect(playerColors).toContain('rgba(12, 34, 56, 0.310)');
    const playerStrokes = (playerCtx as { __strokes: string[] }).__strokes;
    expect(playerStrokes[0]).toBe('rgba(50, 60, 70, 0.8)');
    expect(playerStrokes[1]).toBe('rgba(90, 100, 110, 0.6)');

    const enemyCtx = createStubContext();
    const enemyUnit = createUnit('soldier', 'enemy', coord);
    drawUnitSprite(enemyCtx, enemyUnit, {
      placement: { coord, hexSize: 32, origin, zoom: 1, type: enemyUnit.type },
      sprite,
      faction: 'enemy',
      cameraZoom: 1,
      motionStrength: 0.5,
      selection: { isSelected: false }
    });
    const enemyGradients = (enemyCtx as { __gradients: GradientStub[] }).__gradients;
    const enemyColors = enemyGradients.flatMap((gradient) => gradient.stops.map(([, color]) => color));
    expect(enemyColors).toContain('rgba(220, 140, 130, 0.5)');
    expect(enemyColors).toContain('rgba(90, 45, 30, 0.310)');
    const enemyStrokes = (enemyCtx as { __strokes: string[] }).__strokes;
    expect(enemyStrokes[0]).toBe('rgba(200, 110, 100, 0.74)');
    expect(enemyStrokes[1]).toBe('rgba(210, 120, 110, 0.58)');
  });

  it('brightens rims and rings for selected units regardless of faction', () => {
    const enemyCtx = createStubContext();
    const enemyUnit = createUnit('soldier', 'enemy', coord);
    drawUnitSprite(enemyCtx, enemyUnit, {
      placement: { coord, hexSize: 32, origin, zoom: 1, type: enemyUnit.type },
      sprite,
      faction: 'enemy',
      cameraZoom: 1,
      motionStrength: 0.1,
      selection: { isSelected: true, isPrimary: false }
    });
    const enemyStrokes = (enemyCtx as { __strokes: string[] }).__strokes;
    expect(enemyStrokes[0]).toBe('rgba(255, 255, 255, 0.525)');
    expect(enemyStrokes[1]).toBe('rgba(255, 255, 255, 0.645)');
  });
});
