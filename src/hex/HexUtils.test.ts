import {
  axialToPixel,
  pixelToAxial,
  pixelToAxialUnrounded,
  getNeighbors,
  getNeighbor,
  hexRound,
} from './HexUtils.ts';
import { describe, it, expect } from 'vitest';

describe('HexUtils', () => {
  it('converts axial to pixel and back', () => {
    const size = 10;
    const coord = { q: 2, r: -3 };
    const pixel = axialToPixel(coord, size);
    const back = pixelToAxial(pixel.x, pixel.y, size);
    expect(back).toEqual(coord);
  });

  it('returns fractional axial coordinates without rounding', () => {
    const size = 10;
    const coord = pixelToAxialUnrounded(18, 12, size);
    expect(coord.q).toBeCloseTo(0.6392, 4);
    expect(coord.r).toBeCloseTo(0.8, 4);
  });

  it('provides neighbor lookups', () => {
    const origin = { q: 0, r: 0 };
    const neighbors = getNeighbors(origin);
    expect(neighbors).toHaveLength(6);
    expect(neighbors).toContainEqual({ q: 1, r: 0 });
    const dir = getNeighbor(origin, 2);
    expect(dir).toEqual(neighbors[2]);
  });

  it('rounds fractional coordinates', () => {
    const rounded = hexRound({ q: 1.2, r: -0.7 });
    expect(rounded).toEqual({ q: 1, r: -1 });
  });
});
