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
        nativeSize: { width: 160, height: 184 },
        anchor: { x: 0.5, y: 0.815 },
        scale: { x: 1.3806202089317139, y: 1.375 },
        nudge: { x: 0, y: -0.02 }
      },
      {
        type: 'archer',
        nativeSize: { width: 168, height: 188 },
        anchor: { x: 0.5, y: 0.81 },
        scale: { x: 1.4510532031494585, y: 1.40625 },
        nudge: { x: 0, y: -0.015 }
      },
      {
        type: 'avanto-marauder',
        nativeSize: { width: 176, height: 196 },
        anchor: { x: 0.5, y: 0.836 },
        scale: { x: 1.5553109292455225, y: 1.5 },
        nudge: { x: 0, y: -0.03 }
      },
      {
        type: 'saunoja-guardian',
        nativeSize: { width: 160, height: 176 },
        anchor: { x: 0.5, y: 0.806 },
        scale: { x: 1.37776768783888, y: 1.3125 },
        nudge: { x: 0, y: -0.015 }
      },
      {
        type: 'saunoja-seer',
        nativeSize: { width: 160, height: 176 },
        anchor: { x: 0.5, y: 0.806 },
        scale: { x: 1.37776768783888, y: 1.3125 },
        nudge: { x: 0, y: -0.015 }
      }
    ] as const;

    for (const { type, nativeSize, anchor, scale, nudge } of expectations) {
      const meta = getUnitSpriteMetadata(type);
      expect(meta.nativeSize).toEqual(nativeSize);
      expect(meta.anchor).toEqual(anchor);
      expect(meta.scale.x).toBeCloseTo(scale.x, 6);
      expect(meta.scale.y).toBeCloseTo(scale.y, 6);
      expect(meta.nudge).toEqual(nudge);
    }
  });
});
