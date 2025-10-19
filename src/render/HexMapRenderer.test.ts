import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HexMap } from '../hexmap.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';
import { camera } from '../camera/autoFrame.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { HEX_CHUNK_SIZE } from '../map/hex/chunking.ts';
import type { LoadedAssets } from '../loader.ts';
import type { ChunkCanvas } from './terrain_cache.ts';
import type { FogChunkCanvas } from './fog_cache.ts';

function createStubContext(width: number, height: number): CanvasRenderingContext2D {
  const canvas = { width, height } as HTMLCanvasElement;
  return {
    canvas,
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function stubRendererCaches(renderer: HexMapRenderer): void {
  const terrainCacheStub = {
    invalidate: vi.fn(),
    dispose: vi.fn(),
    getRenderableChunks: vi.fn(() => [] as ChunkCanvas[]),
  };

  const fogCacheStub = {
    invalidate: vi.fn(),
    dispose: vi.fn(),
    getRenderableChunks: vi.fn(() => [] as FogChunkCanvas[]),
  };

  Object.assign(renderer as unknown as { terrainCache: typeof terrainCacheStub; fogCache: typeof fogCacheStub }, {
    terrainCache: terrainCacheStub,
    fogCache: fogCacheStub,
  });
}

describe('HexMapRenderer chunk population tracking', () => {
  beforeEach(() => {
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
  });

  it('skips repopulating seen chunks while populating new ones once revealed', () => {
    const map = new HexMap(HEX_CHUNK_SIZE * 2, HEX_CHUNK_SIZE * 2);
    const renderer = new HexMapRenderer(map);
    stubRendererCaches(renderer);
    const ensureTileSpy = vi.spyOn(map, 'ensureTile');
    const ctx = createStubContext(128, 128);
    const images = {} as LoadedAssets['images'];

    renderer.draw(ctx, images);
    const initialCalls = ensureTileSpy.mock.calls.length;
    expect(initialCalls).toBe(HEX_CHUNK_SIZE * HEX_CHUNK_SIZE);

    renderer.draw(ctx, images);
    expect(ensureTileSpy).toHaveBeenCalledTimes(initialCalls);

    const { x, y } = axialToPixel({ q: HEX_CHUNK_SIZE, r: 0 }, map.hexSize);
    camera.x = x;
    camera.y = y;

    renderer.draw(ctx, images);
    const callsAfterReveal = ensureTileSpy.mock.calls.length;
    expect(callsAfterReveal).toBeGreaterThan(initialCalls);

    renderer.draw(ctx, images);
    expect(ensureTileSpy).toHaveBeenCalledTimes(callsAfterReveal);
  });
});
