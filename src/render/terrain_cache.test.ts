import { describe, it, expect, vi } from 'vitest';
import { HexMap } from '../hexmap.ts';
import { TerrainCache } from './terrain_cache.ts';
import { ensureChunksPopulated } from '../map/hex/chunking.ts';
import { axialToPixel } from '../hex/HexUtils.ts';

function createStubContext(drawImage: ReturnType<typeof vi.fn>) {
  const gradient = { addColorStop: vi.fn() };
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    drawImage,
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
}

describe('TerrainCache', () => {
  it('re-renders chunks when tiles mutate', () => {
    const map = new HexMap(2, 2);
    const tile = map.ensureTile(0, 0);
    tile.reveal();
    tile.placeBuilding('farm');

    const offscreenDrawImage = vi.fn();
    const offscreenCtx = createStubContext(offscreenDrawImage);

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

    try {
      const cache = new TerrainCache(map);
      const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
      ensureChunksPopulated(map, range);
      const origin = axialToPixel({ q: map.minQ, r: map.minR }, map.hexSize);
      const images = {
        'building-farm': originalCreateElement.call(document, 'img') as HTMLImageElement,
        'building-barracks': originalCreateElement.call(document, 'img') as HTMLImageElement,
        placeholder: originalCreateElement.call(document, 'img') as HTMLImageElement,
      };

      cache.getRenderableChunks(range, map.hexSize, images, origin);
      const initialCalls = offscreenDrawImage.mock.calls.length;
      expect(initialCalls).toBeGreaterThan(0);

      offscreenDrawImage.mockClear();
      tile.placeBuilding('barracks');
      cache.getRenderableChunks(range, map.hexSize, images, origin);
      expect(offscreenDrawImage).toHaveBeenCalled();
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
