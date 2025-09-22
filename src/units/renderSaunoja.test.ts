import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const OriginalImage = globalThis.Image;

class MockImage {
  static lastInstance: MockImage | null = null;
  static created: MockImage[] = [];
  onload: ((event?: unknown) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  decoding = '';
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  private _src = '';

  constructor() {
    MockImage.lastInstance = this;
    MockImage.created.push(this);
  }

  get src(): string {
    return this._src;
  }

  set src(value: string) {
    this._src = value;
  }

  triggerLoad(width = 128, height = 128) {
    this.naturalWidth = width;
    this.naturalHeight = height;
    this.complete = true;
    const event = typeof Event === 'function' ? new Event('load') : undefined;
    this.onload?.(event);
  }

  triggerError(event?: unknown) {
    this.complete = false;
    const errorEvent =
      event || (typeof Event === 'function' ? new Event('error') : { type: 'error' });
    this.onerror?.(errorEvent);
  }

  static reset(): void {
    MockImage.lastInstance = null;
    MockImage.created = [];
  }
}

function createMockContext() {
  const gradient = { addColorStop: vi.fn() } as unknown as CanvasGradient;
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    stroke: vi.fn(),
    bezierCurveTo: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    filter: 'none',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over'
  } as unknown as CanvasRenderingContext2D;
  return { ctx, gradient };
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('BASE_URL', '/test-base/');
  MockImage.reset();
  // @ts-ignore - override Image constructor for tests
  globalThis.Image = MockImage as any;
});

afterEach(() => {
  vi.unstubAllEnvs();
  if (OriginalImage) {
    // @ts-ignore - restore original constructor
    globalThis.Image = OriginalImage;
  } else {
    // @ts-ignore - remove shim when no original existed
    delete globalThis.Image;
  }
});

describe('preloadSaunojaIcon', () => {
  it('creates the image once and resolves after load', async () => {
    const { preloadSaunojaIcon } = await import('./renderSaunoja.ts');
    const promise1 = preloadSaunojaIcon();
    const promise2 = preloadSaunojaIcon();
    expect(promise2).toBe(promise1);

    const instance = MockImage.lastInstance;
    expect(instance).toBeTruthy();
    instance?.triggerLoad(200, 200);

    const icon = await promise1;
    expect(icon).toBe(instance);
    expect(icon.src).toBe('/test-base/assets/units/saunoja.svg');
    expect(icon.decoding).toBe('async');

    const promise3 = preloadSaunojaIcon();
    expect(await promise3).toBe(icon);
  });

  it('invokes the provided onLoad callback when the icon becomes available', async () => {
    const { preloadSaunojaIcon } = await import('./renderSaunoja.ts');
    const onLoad = vi.fn();
    const promise = preloadSaunojaIcon(onLoad);

    const instance = MockImage.lastInstance;
    expect(instance).toBeTruthy();
    instance?.triggerLoad(192, 192);

    const icon = await promise;
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(onLoad).toHaveBeenCalledWith(icon);

    const cachedCallback = vi.fn();
    await preloadSaunojaIcon(cachedCallback);
    expect(cachedCallback).toHaveBeenCalledTimes(1);
    expect(cachedCallback).toHaveBeenCalledWith(icon);
  });

  it('warns when the icon fails to load', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { preloadSaunojaIcon } = await import('./renderSaunoja.ts');
    const promise = preloadSaunojaIcon();

    const instance = MockImage.lastInstance;
    expect(instance).toBeTruthy();
    instance?.triggerError();

    await expect(promise).rejects.toThrow('Failed to load saunoja icon');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toContain('Failed to load saunoja icon');
    warnSpy.mockRestore();
  });
});

describe('drawSaunojas', () => {
  it('skips drawing when the icon is not ready', async () => {
    const { drawSaunojas } = await import('./renderSaunoja.ts');
    const { ctx } = createMockContext();
    const units = [
      {
        id: 'unit-1',
        name: 'Uno',
        coord: { q: 0, r: 0 },
        maxHp: 10,
        hp: 6,
        steam: 0.3,
        selected: false
      }
    ];

    drawSaunojas(ctx, units, { hexRadius: 32 });
    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(0);
  });

  it('sorts units by axial row and applies overlays', async () => {
    const { preloadSaunojaIcon, drawSaunojas } = await import('./renderSaunoja.ts');
    const helpers = await import('./visualHelpers.ts');
    const hex = await import('../hex/index.ts');

    const drawSteamSpy = vi.spyOn(helpers, 'drawSteam');
    const pathSpy = vi.spyOn(hex, 'pathHex');

    const promise = preloadSaunojaIcon();
    MockImage.lastInstance?.triggerLoad(256, 256);
    await promise;

    const { ctx } = createMockContext();
    const units = [
      {
        id: 'south',
        name: 'South',
        coord: { q: -1, r: 2 },
        maxHp: 18,
        hp: 12,
        steam: 0.8,
        selected: false,
        shield: 0,
        modifiers: []
      },
      {
        id: 'north',
        name: 'North',
        coord: { q: 0, r: -1 },
        maxHp: 14,
        hp: 8,
        steam: 0.1,
        selected: false,
        shield: 1,
        modifiers: []
      },
      {
        id: 'center',
        name: 'Center',
        coord: { q: 1, r: 0 },
        maxHp: 16,
        hp: 5,
        steam: 0.4,
        selected: true,
        shield: 2,
        modifiers: [
          {
            id: 'haste',
            name: 'Haste',
            remaining: 6,
            duration: 10,
            stacks: 2
          }
        ]
      }
    ];

    const pushStatus = vi.fn();
    drawSaunojas(ctx, units, { hexRadius: 30, pushStatus });

    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(3);

    const clipRadius = 30 * 0.965;
    const clipCalls = pathSpy.mock.calls.filter(([, , , radius]) => Math.abs(radius - clipRadius) < 0.001);
    expect(clipCalls).toHaveLength(3);

    const statusOrder = pushStatus.mock.calls.map(([payload]) => payload.id);
    expect(statusOrder).toEqual(['north', 'center', 'south']);

    const firstStatus = pushStatus.mock.calls[0][0];
    expect(firstStatus.radius).toBeCloseTo(30 * 0.42);
    expect(firstStatus.buffs?.length ?? 0).toBe(0);

    const centerStatus = pushStatus.mock.calls[1][0];
    expect(centerStatus.selected).toBe(true);
    expect(centerStatus.buffs?.[0]?.id).toBe('haste');

    const steamOrder = drawSteamSpy.mock.calls.map(([, options]) => options.intensity);
    expect(steamOrder).toEqual([0.1, 0.4, 0.8]);

    const { snapForZoom } = await import('../render/zoom.ts');
    const { getSpriteCenter } = await import('../render/units/draw.ts');

    const iconSize = 256;
    const expectedScale = Math.min((clipRadius * 1.85) / iconSize, (clipRadius * 2.4) / iconSize);
    const expectedSize = snapForZoom(iconSize * expectedScale, 1);

    const sorted = [...units].sort((a, b) => {
      if (a.coord.r !== b.coord.r) {
        return a.coord.r - b.coord.r;
      }
      if (a.coord.q !== b.coord.q) {
        return a.coord.q - b.coord.q;
      }
      return a.id.localeCompare(b.id);
    });

    const drawCalls = (ctx.drawImage as unknown as Mock).mock.calls;
    sorted.forEach((unit, index) => {
      const [, imageX, imageY, drawWidth, drawHeight] = drawCalls[index];
      expect(drawWidth).toBe(expectedSize);
      expect(drawHeight).toBe(expectedSize);
      const center = getSpriteCenter({
        coord: unit.coord,
        hexSize: 30,
        origin: { x: 0, y: 0 },
        zoom: 1,
        type: 'saunoja'
      });
      const expectedX = snapForZoom(center.x - expectedSize / 2, 1);
      const expectedY = snapForZoom(center.y - expectedSize * 0.78, 1);
      expect(imageX).toBe(expectedX);
      expect(imageY).toBe(expectedY);
    });
  });

  it('uses resolved render coordinates when provided', async () => {
    const { preloadSaunojaIcon, drawSaunojas } = await import('./renderSaunoja.ts');
    const unitDrawModule = await import('../render/units/draw.ts');

    const getSpriteCenterSpy = vi
      .spyOn(unitDrawModule, 'getSpriteCenter')
      .mockImplementation(({ coord }) => ({ x: coord.q * 10, y: coord.r * 10 }));

    const iconPromise = preloadSaunojaIcon();
    MockImage.lastInstance?.triggerLoad(256, 256);
    await iconPromise;

    const { ctx } = createMockContext();
    const units = [
      {
        id: 'drifting',
        name: 'Drifting',
        coord: { q: 0, r: 0 },
        maxHp: 12,
        hp: 9,
        steam: 0.5,
        selected: false
      },
      {
        id: 'anchored',
        name: 'Anchored',
        coord: { q: 2, r: 1 },
        maxHp: 10,
        hp: 7,
        steam: 0.2,
        selected: false
      }
    ];

    const resolveRenderCoord = vi.fn((unit: (typeof units)[number]) =>
      unit.id === 'drifting' ? { q: 5, r: -4 } : undefined
    );

    drawSaunojas(ctx, units as any, { hexRadius: 28, resolveRenderCoord });

    expect(resolveRenderCoord).toHaveBeenCalledTimes(2);
    expect(
      getSpriteCenterSpy.mock.calls.some(([options]) => options.coord.q === 5 && options.coord.r === -4)
    ).toBe(true);
    expect(
      getSpriteCenterSpy.mock.calls.some(([options]) => options.coord.q === 2 && options.coord.r === 1)
    ).toBe(true);

    getSpriteCenterSpy.mockRestore();
  });
});
