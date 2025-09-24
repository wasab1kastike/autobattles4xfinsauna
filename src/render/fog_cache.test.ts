import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { HexMap } from '../hexmap.ts';
import { ensureChunksPopulated } from '../map/hex/chunking.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { FogCache } from './fog_cache.ts';

vi.mock('./fog.ts', () => ({
  drawFogHex: vi.fn(),
}));

const { drawFogHex } = await import('./fog.ts');
const drawFogHexMock = drawFogHex as unknown as ReturnType<typeof vi.fn>;

function createStubContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(),
    createRadialGradient: vi.fn(),
    globalAlpha: 1,
    filter: 'none',
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    lineWidth: 1,
    lineCap: 'round' as CanvasLineCap,
    lineJoin: 'round' as CanvasLineJoin,
    strokeStyle: '',
    fillStyle: '',
    shadowBlur: 0,
    shadowColor: '',
  } as unknown as CanvasRenderingContext2D;
}

describe('FogCache', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn> | null = null;

  beforeEach(() => {
    const originalCreateElement = document.createElement;
    createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string, options?: ElementCreationOptions) => {
        if (tagName === 'canvas') {
          const ctx = createStubContext();
          const canvas = {
            width: 0,
            height: 0,
            getContext: vi.fn(() => ctx),
          } as unknown as HTMLCanvasElement;
          return canvas;
        }
        return originalCreateElement.call(document, tagName, options);
      });
  });

  afterEach(() => {
    createElementSpy?.mockRestore();
    createElementSpy = null;
    drawFogHexMock.mockReset();
  });

  it('caches fog chunks and re-renders only when fog changes', () => {
    const map = new HexMap(2, 2);
    const cache = new FogCache(map);
    const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
    ensureChunksPopulated(map, range);
    const origin = axialToPixel({ q: map.minQ, r: map.minR }, map.hexSize);

    const zoom = 1;
    const tile = map.getTile(0, 0);
    expect(tile?.isFogged).toBe(true);

    const first = cache.getRenderableChunks(range, map.hexSize, zoom, origin);
    expect(first.length).toBeGreaterThan(0);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, zoom, origin);
    expect(drawFogHexMock).not.toHaveBeenCalled();

    tile?.reveal();
    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, zoom, origin);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    tile?.setFogged(true);
    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, zoom, origin);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    cache.dispose();
  });

  it('stores separate variants per zoom level', () => {
    const map = new HexMap(2, 2);
    const cache = new FogCache(map);
    const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
    ensureChunksPopulated(map, range);
    const origin = axialToPixel({ q: map.minQ, r: map.minR }, map.hexSize);

    cache.getRenderableChunks(range, map.hexSize, 1, origin);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1, origin);
    expect(drawFogHexMock).not.toHaveBeenCalled();

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1.5, origin);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1.5, origin);
    expect(drawFogHexMock).not.toHaveBeenCalled();

    cache.dispose();
  });
});

