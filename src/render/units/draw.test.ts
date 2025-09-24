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

  it('exposes refreshed metadata for production sprites', () => {
    const expectations = [
      {
        type: 'soldier',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.815 },
        scale: { x: 1.58771324, y: 1.375 },
        nudge: { x: 0, y: -0.02 }
      },
      {
        type: 'archer',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.81 },
        scale: { x: 1.623797632, y: 1.40625 },
        nudge: { x: 0, y: -0.015 }
      },
      {
        type: 'avanto-marauder',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.836 },
        scale: { x: 1.732050808, y: 1.5 },
        nudge: { x: 0, y: -0.03 }
      },
      {
        type: 'raider',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.832 },
        scale: { x: 1.697409791, y: 1.47 },
        nudge: { x: 0, y: -0.028 }
      },
      {
        type: 'raider-captain',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.838 },
        scale: { x: 1.796714038, y: 1.556 },
        nudge: { x: 0, y: -0.034 }
      },
      {
        type: 'raider-shaman',
        nativeSize: { width: 64, height: 64 },
        anchor: { x: 0.5, y: 0.842 },
        scale: { x: 1.769001225, y: 1.532 },
        nudge: { x: 0, y: -0.036 }
      },
      {
        type: 'saunoja',
        nativeSize: { width: 1024, height: 1024 },
        anchor: { x: 0.5, y: 0.66 },
        scale: { x: 1.154700538, y: 1 },
        nudge: { x: 0, y: -0.02 }
      },
      {
        type: 'saunoja-guardian',
        nativeSize: { width: 1024, height: 1536 },
        anchor: { x: 0.5, y: 0.806 },
        scale: { x: 1.515544457, y: 1.3125 },
        nudge: { x: 0, y: -0.015 }
      },
      {
        type: 'saunoja-seer',
        nativeSize: { width: 1024, height: 1536 },
        anchor: { x: 0.5, y: 0.806 },
        scale: { x: 1.515544457, y: 1.3125 },
        nudge: { x: 0, y: -0.015 }
      }
    ] as const;

    const widthToHeightRatio = 2 / Math.sqrt(3);

    for (const { type, nativeSize, anchor, scale, nudge } of expectations) {
      const meta = getUnitSpriteMetadata(type);
      expect(meta.nativeSize).toEqual(nativeSize);
      expect(meta.anchor).toEqual(anchor);
      expect(meta.scale.x).toBeCloseTo(scale.x, 6);
      expect(meta.scale.y).toBeCloseTo(scale.y, 6);
      expect(meta.scale.x).toBeCloseTo(meta.scale.y * widthToHeightRatio, 6);
      expect(meta.nudge).toEqual(nudge);
    }
  });

  it('shares metadata between legacy marauder aliases', () => {
    const primary = getUnitSpriteMetadata('avanto-marauder');
    const legacy = getUnitSpriteMetadata('marauder');
    expect(legacy).toBe(primary);
  });
});
