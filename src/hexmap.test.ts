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
    tile.reveal();
    tile.placeBuilding('barracks');

    const offscreenGradient = { addColorStop: vi.fn() };
    const offscreenDrawImage = vi.fn();
    const offscreenCtx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      createRadialGradient: vi.fn(() => offscreenGradient),
      fillRect: vi.fn(),
      drawImage: offscreenDrawImage,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
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

    const originalCreateElement = document.createElement;
    const offscreenCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => offscreenCtx),
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'canvas') {
          offscreenCanvas.width = 0;
          offscreenCanvas.height = 0;
          return offscreenCanvas;
        }
        return originalCreateElement.call(document, tagName);
      });

    const gradient = { addColorStop: vi.fn() };
    const ctx = {
      canvas: { width: 800, height: 600 } as HTMLCanvasElement,
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

    const createImg = () => originalCreateElement.call(document, 'img') as HTMLImageElement;
    const images = {
      'building-barracks': createImg(),
      placeholder: createImg(),
    };

    const renderer = new HexMapRenderer(map);
    try {
      renderer.draw(ctx, images);

      expect(offscreenDrawImage).toHaveBeenCalledWith(
        images['building-barracks'],
        expect.any(Number),
        expect.any(Number),
        expect.any(Number),
        expect.any(Number)
      );
    } finally {
      createElementSpy.mockRestore();
    }
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
