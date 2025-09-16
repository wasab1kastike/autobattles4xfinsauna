import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';

const OriginalImage = globalThis.Image;

class MockImage {
  static lastInstance: MockImage | null = null;
  static created: MockImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
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
    this.onload?.();
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
  MockImage.reset();
  // @ts-ignore - override Image constructor for tests
  globalThis.Image = MockImage as any;
});

afterEach(() => {
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
    expect(icon.src).toBe('/assets/units/saunoja.svg');
    expect(icon.decoding).toBe('async');

    const promise3 = preloadSaunojaIcon();
    expect(await promise3).toBe(icon);
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

    const drawHPSpy = vi.spyOn(helpers, 'drawHP');
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
        selected: false
      },
      {
        id: 'north',
        name: 'North',
        coord: { q: 0, r: -1 },
        maxHp: 14,
        hp: 8,
        steam: 0.1,
        selected: false
      },
      {
        id: 'center',
        name: 'Center',
        coord: { q: 1, r: 0 },
        maxHp: 16,
        hp: 5,
        steam: 0.4,
        selected: true
      }
    ];

    drawSaunojas(ctx, units, { hexRadius: 30 });

    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(3);

    const clipRadius = 30 * 0.98;
    const clipCalls = pathSpy.mock.calls.filter(([, , , radius]) => Math.abs(radius - clipRadius) < 0.001);
    expect(clipCalls).toHaveLength(3);

    const hpOrder = drawHPSpy.mock.calls.map(([, options]) => options.hp);
    expect(hpOrder).toEqual([8, 5, 12]);

    const steamOrder = drawSteamSpy.mock.calls.map(([, options]) => options.intensity);
    expect(steamOrder).toEqual([0.1, 0.4, 0.8]);
  });
});
