import { describe, it, expect } from 'vitest';
import { getSpritePlacement, getSpriteCenter } from './draw.ts';
import { getUnitSpriteMetadata } from './sprite_map.ts';
import { axialToPixel, type AxialCoord, type PixelCoord } from '../../hex/HexUtils.ts';
import { getHexDimensions } from '../../hex/HexDimensions.ts';
import { snapForZoom } from '../zoom.ts';

const TEST_COORD: AxialCoord = { q: 2, r: -1 };
const TEST_ORIGIN: PixelCoord = { x: 14.25, y: -6.5 };
const HEX_SIZE = 32;

function resolveRawCenter(metaType: string): PixelCoord {
  const meta = getUnitSpriteMetadata(metaType);
  const axial = axialToPixel(TEST_COORD, HEX_SIZE);
  return {
    x: axial.x - TEST_ORIGIN.x + meta.nudge.x * HEX_SIZE,
    y: axial.y - TEST_ORIGIN.y + meta.nudge.y * HEX_SIZE
  };
}

describe('unit sprite placement', () => {
  it.each([0.75, 1, 1.5])('snaps soldier placement at zoom %s', (zoom) => {
    const meta = getUnitSpriteMetadata('soldier');
    const rawCenter = resolveRawCenter('soldier');
    const { width: hexWidth, height: hexHeight } = getHexDimensions(HEX_SIZE);
    const rawWidth = hexWidth * meta.scale.x;
    const rawHeight = hexHeight * meta.scale.y;

    const placement = getSpritePlacement({
      coord: TEST_COORD,
      hexSize: HEX_SIZE,
      origin: TEST_ORIGIN,
      zoom,
      type: 'soldier'
    });
    const center = getSpriteCenter({
      coord: TEST_COORD,
      hexSize: HEX_SIZE,
      origin: TEST_ORIGIN,
      zoom,
      type: 'soldier'
    });

    expect(placement.metadata).toBe(meta);
    expect(placement.width * zoom).toBeCloseTo(Math.round(rawWidth * zoom));
    expect(placement.height * zoom).toBeCloseTo(Math.round(rawHeight * zoom));
    expect(placement.drawX * zoom).toBeCloseTo(
      Math.round((rawCenter.x - rawWidth * meta.anchor.x) * zoom)
    );
    expect(placement.drawY * zoom).toBeCloseTo(
      Math.round((rawCenter.y - rawHeight * meta.anchor.y) * zoom)
    );

    const recomputedCenterX = placement.drawX + placement.width * meta.anchor.x;
    const recomputedCenterY = placement.drawY + placement.height * meta.anchor.y;
    expect(placement.centerX).toBeCloseTo(recomputedCenterX);
    expect(placement.centerY).toBeCloseTo(recomputedCenterY);

    const tolerance = 1 / zoom + 1e-6;
    expect(Math.abs(placement.centerX - rawCenter.x)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(placement.centerY - rawCenter.y)).toBeLessThanOrEqual(tolerance);

    expect(center.x).toBeCloseTo(snapForZoom(rawCenter.x, zoom));
    expect(center.y).toBeCloseTo(snapForZoom(rawCenter.y, zoom));
  });

  it('applies scale metadata for avanto-marauder', () => {
    const zoom = 1;
    const meta = getUnitSpriteMetadata('avanto-marauder');
    const { width: hexWidth, height: hexHeight } = getHexDimensions(HEX_SIZE);
    const rawWidth = hexWidth * meta.scale.x;
    const rawHeight = hexHeight * meta.scale.y;

    const placement = getSpritePlacement({
      coord: TEST_COORD,
      hexSize: HEX_SIZE,
      origin: TEST_ORIGIN,
      zoom,
      type: 'avanto-marauder'
    });

    expect(placement.width).toBeCloseTo(snapForZoom(rawWidth, zoom));
    expect(placement.height).toBeCloseTo(snapForZoom(rawHeight, zoom));
    expect(placement.metadata).toBe(meta);
  });

  it('exposes refreshed metadata for soldier and archer sprites', () => {
    const soldier = getUnitSpriteMetadata('soldier');
    expect(soldier.nativeSize).toEqual({ width: 128, height: 128 });
    expect(soldier.anchor).toEqual({ x: 0.5, y: 0.88 });
    expect(soldier.scale).toEqual({ x: 1.06, y: 1.18 });
    expect(soldier.nudge).toEqual({ x: 0, y: -0.1 });

    const archer = getUnitSpriteMetadata('archer');
    expect(archer.nativeSize).toEqual({ width: 128, height: 128 });
    expect(archer.anchor).toEqual({ x: 0.5, y: 0.86 });
    expect(archer.scale).toEqual({ x: 1.04, y: 1.16 });
    expect(archer.nudge).toEqual({ x: 0, y: -0.08 });
  });
});
