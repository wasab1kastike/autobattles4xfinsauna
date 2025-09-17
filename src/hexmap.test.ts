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

  it('creates tiles lazily as they are requested', () => {
    const map = new HexMap(3, 3);
    expect(map.getTile(0, 0)).toBeUndefined();
    const created = map.ensureTile(0, 0);
    expect(created).toBeInstanceOf(HexTile);
    expect(map.getTile(0, 0)).toBe(created);
    let count = 0;
    map.forEachTile(() => count++);
    expect(count).toBe(1);
  });

  it('returns neighboring tiles', () => {
    const map = new HexMap(3, 3);
    map.ensureTile(1, 1);
    const neighbors = map.getNeighbors(1, 1);
    expect(neighbors).toHaveLength(6);
    neighbors.forEach((tile) => expect(tile).toBeInstanceOf(HexTile));
  });

  it('draws a barracks image when tile has a barracks building', () => {
    const map = new HexMap(1, 1);
    const tile = map.ensureTile(0, 0);
    tile.placeBuilding('barracks');
    // stub canvas context
    const gradient = { addColorStop: vi.fn() };
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
      fillRect: vi.fn(),
      createRadialGradient: vi.fn(() => gradient),
      globalAlpha: 1,
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      lineJoin: 'round' as CanvasLineJoin,
      lineCap: 'round' as CanvasLineCap,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    } as unknown as CanvasRenderingContext2D;
    const createImg = () => document.createElement('img') as HTMLImageElement;
    const images = {
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
    map.ensureTile(0, 0);
    const tile = map.ensureTile(2, -1);
    expect(tile).toBeInstanceOf(HexTile);
    let count = 0;
    map.forEachTile(() => count++);
    expect(map.width).toBe(3);
    expect(map.height).toBe(2);
    expect(count).toBe(2);
  });
});
