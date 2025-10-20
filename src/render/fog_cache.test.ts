import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { HexMap } from '../hexmap.ts';
import { ensureChunksPopulated, HEX_CHUNK_SIZE } from '../map/hex/chunking.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
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
    const zoom = 1;
    const tile = map.getTile(0, 0);
    expect(tile?.isFogged).toBe(true);

    const first = cache.getRenderableChunks(range, map.hexSize, zoom);
    expect(first.length).toBeGreaterThan(0);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    const chunk = first.find((entry) => entry.key === '0,0');
    expect(chunk).toBeDefined();
    if (chunk) {
      const { width: hexWidth, height: hexHeight } = getHexDimensions(map.hexSize);
      const center = axialToPixel({ q: 0, r: 0 }, map.hexSize);
      expect(chunk.origin.x).toBeCloseTo(center.x - hexWidth / 2, 5);
      expect(chunk.origin.y).toBeCloseTo(center.y - hexHeight / 2, 5);
    }

    drawFogHexMock.mockClear();
    const cached = cache.getRenderableChunks(range, map.hexSize, zoom);
    expect(drawFogHexMock).not.toHaveBeenCalled();
    expect(cached.find((entry) => entry.key === '0,0')).toBe(chunk);

    tile?.reveal();
    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, zoom);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    tile?.setFogged(true);
    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, zoom);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    cache.dispose();
  });

  it('stores separate variants per zoom level', () => {
    const map = new HexMap(2, 2);
    const cache = new FogCache(map);
    const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
    ensureChunksPopulated(map, range);
    cache.getRenderableChunks(range, map.hexSize, 1);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1);
    expect(drawFogHexMock).not.toHaveBeenCalled();

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1.5);
    expect(drawFogHexMock.mock.calls.length).toBeGreaterThan(0);

    drawFogHexMock.mockClear();
    cache.getRenderableChunks(range, map.hexSize, 1.5);
    expect(drawFogHexMock).not.toHaveBeenCalled();

    cache.dispose();
  });

  it('caches empty fog chunks until invalidated', () => {
    const map = new HexMap(HEX_CHUNK_SIZE, HEX_CHUNK_SIZE);
    const cache = new FogCache(map);
    const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
    ensureChunksPopulated(map, range);

    for (let q = 0; q < HEX_CHUNK_SIZE; q++) {
      for (let r = 0; r < HEX_CHUNK_SIZE; r++) {
        map.ensureTile(q, r).reveal();
      }
    }

    const cacheWithRender = cache as unknown as { renderChunk: FogCache['renderChunk'] };
    const renderSpy = vi.spyOn(cacheWithRender, 'renderChunk');

    const zoom = 1;

    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    cache.markTileDirty(0, 0);
    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(2);

    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(2);

    cache.invalidate();
    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(3);

    expect(cache.getRenderableChunks(range, map.hexSize, 1.5)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(4);

    expect(cache.getRenderableChunks(range, map.hexSize, zoom)).toHaveLength(0);
    expect(renderSpy).toHaveBeenCalledTimes(5);

    cache.dispose();
    renderSpy.mockRestore();
  });
});

