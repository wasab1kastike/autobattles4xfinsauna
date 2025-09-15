import { describe, it, expect, vi } from 'vitest';
import { HexMap } from './hexmap.ts';
import { HexTile } from './hex/HexTile.ts';
import { getHexDimensions } from './hex/HexDimensions.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';

describe('HexMap', () => {
  it('derives sprite dimensions for a given hex size', () => {
    const size = 32;
    const { width, height } = getHexDimensions(size);
    expect(width).toBeCloseTo(size * Math.sqrt(3));
    expect(height).toBe(size * 2);
  });

  it('generates a grid of tiles', () => {
    const map = new HexMap(3, 3);
    let count = 0;
    map.forEachTile(() => count++);
    expect(count).toBe(9);
    expect(map.getTile(0, 0)).toBeInstanceOf(HexTile);
  });

  it('returns neighboring tiles', () => {
    const map = new HexMap(3, 3);
    const neighbors = map.getNeighbors(1, 1);
    expect(neighbors).toHaveLength(6);
    neighbors.forEach((tile) => expect(tile).toBeInstanceOf(HexTile));
  });

  it('draws a barracks image when tile has a barracks building', () => {
    const map = new HexMap(1, 1);
    const tile = map.getTile(0, 0)!;
    tile.placeBuilding('barracks');
    // stub canvas context
    const ctx = {
      drawImage: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      arc: vi.fn(),
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
    } as unknown as CanvasRenderingContext2D;
    const createImg = () => document.createElement('img') as HTMLImageElement;
    const images = {
      'terrain-plains': createImg(),
      'building-barracks': createImg(),
      placeholder: createImg(),
    };
    const renderer = new HexMapRenderer(map);
    renderer.draw(ctx, images);
    expect(ctx.drawImage).toHaveBeenCalledWith(
      images['building-barracks'],
      expect.any(Number),
      expect.any(Number),
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('expands bounds when accessing tiles outside initial area', () => {
    const map = new HexMap(1, 1);
    const tile = map.getTile(2, -1);
    expect(tile).toBeInstanceOf(HexTile);
    let count = 0;
    map.forEachTile(() => count++);
    expect(map.width).toBe(3);
    expect(map.height).toBe(2);
    expect(count).toBe(6);
  });
});
