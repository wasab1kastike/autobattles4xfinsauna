import { describe, it, expect, vi } from 'vitest';
import { HexMap } from '../hexmap.ts';
import { TerrainCache } from './terrain_cache.ts';
import { ensureChunksPopulated } from '../map/hex/chunking.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import { clearIconCache } from './loadIcon.ts';

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

  it('re-renders chunks when the map origin shifts after expanding bounds', () => {
    const map = new HexMap(2, 2);
    const tile = map.ensureTile(0, 0);
    tile.reveal();

    const drawImage = vi.fn();
    const ctx = createStubContext(drawImage);
    const originalCreateElement = document.createElement;
    const offscreenCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
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

      const initialChunks = cache.getRenderableChunks(range, map.hexSize, images, origin);
      expect(initialChunks).toHaveLength(1);
      const initialChunk = initialChunks.find((chunk) => chunk.key === '0,0');
      expect(initialChunk).toBeDefined();

      const { width: hexWidth } = getHexDimensions(map.hexSize);
      const centerPixel = axialToPixel({ q: 0, r: 0 }, map.hexSize);
      const expectedInitialX = centerPixel.x - origin.x - hexWidth / 2;
      expect(initialChunk!.origin.x).toBeCloseTo(expectedInitialX, 5);

      const newTile = map.ensureTile(-1, 0);
      newTile.reveal();
      const shiftedOrigin = axialToPixel({ q: map.minQ, r: map.minR }, map.hexSize);

      const rerenderedChunks = cache.getRenderableChunks(range, map.hexSize, images, shiftedOrigin);
      expect(rerenderedChunks).toHaveLength(1);
      const rerenderedChunk = rerenderedChunks.find((chunk) => chunk.key === '0,0');
      expect(rerenderedChunk).toBeDefined();
      expect(rerenderedChunk).not.toBe(initialChunk);

      const expectedShiftedX = centerPixel.x - shiftedOrigin.x - hexWidth / 2;
      expect(rerenderedChunk!.origin.x).toBeCloseTo(expectedShiftedX, 5);
      expect(rerenderedChunk!.origin.x).not.toBeCloseTo(initialChunk!.origin.x, 5);
    } finally {
      createElementSpy.mockRestore();
    }
  });

  it('marks affected chunks dirty once terrain icons finish loading', async () => {
    clearIconCache();
    const map = new HexMap(1, 1);
    const tile = map.ensureTile(0, 0);
    tile.reveal();

    const createdImages: FakeImage[] = [];
    const originalImage = global.Image;
    const FakeImageCtor = createFakeImageConstructor(createdImages);
    (globalThis as unknown as { Image: typeof Image }).Image = FakeImageCtor;

    const drawImage = vi.fn();
    const ctx = createStubContext(drawImage);
    const originalCreateElement = document.createElement;
    const offscreenCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ctx),
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

    let cache: TerrainCache | undefined;
    try {
      cache = new TerrainCache(map);
      const range = { qMin: 0, qMax: 0, rMin: 0, rMax: 0 };
      ensureChunksPopulated(map, range);
      const origin = axialToPixel({ q: map.minQ, r: map.minR }, map.hexSize);
      const images = {
        'building-farm': originalCreateElement.call(document, 'img') as HTMLImageElement,
        'building-barracks': originalCreateElement.call(document, 'img') as HTMLImageElement,
        placeholder: originalCreateElement.call(document, 'img') as HTMLImageElement,
      };

      const chunks = cache.getRenderableChunks(range, map.hexSize, images, origin);
      expect(chunks).toHaveLength(1);

      const chunkKey = chunks[0]!.key;
      expect(createdImages.length).toBeGreaterThan(0);
      expect((cache as unknown as { dirtyChunks: Set<string> }).dirtyChunks.has(chunkKey)).toBe(
        false
      );

      createdImages[0]!.triggerLoad();
      await Promise.resolve();
      await Promise.resolve();

      expect((cache as unknown as { dirtyChunks: Set<string> }).dirtyChunks.has(chunkKey)).toBe(
        true
      );

    } finally {
      cache?.dispose();
      createElementSpy.mockRestore();
      (globalThis as unknown as { Image: typeof Image }).Image = originalImage;
      clearIconCache();
    }
  });
});

type FakeImageListener = (event: Event) => void;

interface FakeImageHandler {
  listener: FakeImageListener;
  once: boolean;
}

class FakeImage {
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  decoding: ImageDecoding = 'auto';
  private srcValue = '';
  private readonly handlers: FakeImageHandler[] = [];
  private decodeResolver: (() => void) | null = null;
  private readonly decodePromise: Promise<void>;

  constructor(registry: FakeImage[]) {
    registry.push(this);
    this.decodePromise = new Promise((resolve) => {
      this.decodeResolver = resolve;
    });
  }

  get src(): string {
    return this.srcValue;
  }

  set src(value: string) {
    this.srcValue = value;
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    if (type !== 'load') {
      return;
    }

    const callback: FakeImageListener | undefined =
      typeof listener === 'function'
        ? listener
        : listener && 'handleEvent' in listener
          ? (event) => listener.handleEvent(event)
          : undefined;

    if (!callback) {
      return;
    }

    const once = typeof options === 'object' && options?.once === true;
    this.handlers.push({ listener: callback, once });
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type !== 'load') {
      return;
    }

    const callback: FakeImageListener | undefined =
      typeof listener === 'function'
        ? listener
        : listener && 'handleEvent' in listener
          ? (event) => listener.handleEvent(event)
          : undefined;

    if (!callback) {
      return;
    }

    const index = this.handlers.findIndex((entry) => entry.listener === callback);
    if (index >= 0) {
      this.handlers.splice(index, 1);
    }
  }

  decode(): Promise<void> {
    return this.decodePromise;
  }

  triggerLoad(): void {
    this.complete = true;
    this.naturalWidth = 64;
    this.naturalHeight = 64;

    const event = new Event('load');
    const handlers = [...this.handlers];
    for (const handler of handlers) {
      handler.listener.call(this, event);
    }
    const persistent = this.handlers.filter((h) => !h.once);
    this.handlers.length = 0;
    this.handlers.push(...persistent);

    this.decodeResolver?.();
    this.decodeResolver = null;
  }
}

function createFakeImageConstructor(registry: FakeImage[]): typeof Image {
  return class FakeImageConstructor extends FakeImage {
    constructor() {
      super(registry);
    }
  } as unknown as typeof Image;
}
