import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { getSpritePlacement } from '../render/units/draw.ts';

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

function createSpriteStub(): HTMLImageElement {
  return {
    width: 64,
    height: 64,
    naturalWidth: 64,
    naturalHeight: 64
  } as unknown as HTMLImageElement;
}

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('drawSaunojas', () => {
  it('skips drawing when the sprite assets are unavailable', async () => {
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
        shield: 0,
        selected: false,
        modifiers: [],
        lastHitAt: 0
      }
    ];

    drawSaunojas(ctx, units as any, { hexRadius: 32 });
    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(0);
  });

  it('does not render attendants when the resolved sprite is missing', async () => {
    const { drawSaunojas } = await import('./renderSaunoja.ts');
    const { ctx } = createMockContext();
    const assets = { placeholder: createSpriteStub() };
    const units = [
      {
        id: 'solo',
        name: 'Solo',
        coord: { q: 1, r: 1 },
        maxHp: 8,
        hp: 4,
        steam: 0.2,
        shield: 0,
        selected: false,
        modifiers: [],
        lastHitAt: 0
      }
    ];

    drawSaunojas(ctx, units as any, {
      assets,
      hexRadius: 28,
      resolveSpriteId: () => 'soldier'
    });

    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(0);
  });

  it('renders attendants using resolved sprite ids, overlays, and status pushes', async () => {
    const { drawSaunojas } = await import('./renderSaunoja.ts');
    const helpers = await import('./visualHelpers.ts');
    const hex = await import('../hex/index.ts');

    const drawSteamSpy = vi.spyOn(helpers, 'drawSteam');
    const pathSpy = vi.spyOn(hex, 'pathHex');

    const { ctx } = createMockContext();

    const guardianSprite = createSpriteStub();
    const archerSprite = createSpriteStub();
    const soldierSprite = createSpriteStub();

    const assets = {
      placeholder: createSpriteStub(),
      'unit-saunoja-guardian': guardianSprite,
      'unit-archer': archerSprite,
      'unit-soldier': soldierSprite
    } satisfies Record<string, HTMLImageElement>;

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
        modifiers: [],
        lastHitAt: 0
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
        modifiers: [],
        lastHitAt: 0
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
        ],
        lastHitAt: 0
      }
    ];

    const pushStatus = vi.fn();
    const spriteChoices = new Map<string, string>();
    const resolveSpriteId = vi.fn((unit: (typeof units)[number]) => {
      if (unit.id === 'south') {
        spriteChoices.set(unit.id, 'archer');
        return 'archer';
      }
      if (unit.id === 'center') {
        spriteChoices.set(unit.id, 'soldier');
        return 'soldier';
      }
      spriteChoices.set(unit.id, '');
      return '';
    });

    drawSaunojas(ctx, units as any, {
      assets,
      hexRadius: 30,
      resolveSpriteId,
      pushStatus
    });

    expect(resolveSpriteId).toHaveBeenCalledTimes(3);
    expect((ctx.drawImage as unknown as Mock).mock.calls).toHaveLength(3);

    const radius = 30;
    const clipRadius = radius * 0.965;
    const clipCalls = pathSpy.mock.calls.filter(([, , , r]) => Math.abs(r - clipRadius) < 0.001);
    expect(clipCalls).toHaveLength(3);

    const statusOrder = pushStatus.mock.calls.map(([payload]) => payload.id);
    expect(statusOrder).toEqual(['north', 'center', 'south']);

    const firstStatus = pushStatus.mock.calls[0][0];
    expect(firstStatus.radius).toBeCloseTo(radius * 0.42);
    expect(firstStatus.buffs?.length ?? 0).toBe(0);

    const centerStatus = pushStatus.mock.calls[1][0];
    expect(centerStatus.selected).toBe(true);
    expect(centerStatus.buffs?.[0]?.id).toBe('haste');

    const steamOrder = drawSteamSpy.mock.calls.map(([, options]) => options.intensity);
    expect(steamOrder).toEqual([0.1, 0.4, 0.8]);

    const sorted = [...units]
      .map((unit) => ({ unit, coord: unit.coord }))
      .sort((a, b) => {
        if (a.coord.r !== b.coord.r) {
          return a.coord.r - b.coord.r;
        }
        if (a.coord.q !== b.coord.q) {
          return a.coord.q - b.coord.q;
        }
        return a.unit.id.localeCompare(b.unit.id);
      });

    const drawCalls = (ctx.drawImage as unknown as Mock).mock.calls;
    sorted.forEach(({ unit, coord }, index) => {
      const spriteId = spriteChoices.get(unit.id)?.trim() ? spriteChoices.get(unit.id)!.trim() : 'saunoja-guardian';
      const placement = getSpritePlacement({
        coord,
        hexSize: radius,
        origin: { x: 0, y: 0 },
        zoom: 1,
        type: spriteId
      });
      const expectedAssetKey = `unit-${spriteId}` as const;
      const [image, drawX, drawY, drawWidth, drawHeight] = drawCalls[index];
      expect(image).toBe(assets[expectedAssetKey]);
      expect(drawX).toBe(placement.drawX);
      expect(drawY).toBe(placement.drawY);
      expect(drawWidth).toBe(placement.width);
      expect(drawHeight).toBe(placement.height);
    });
  });

  it('uses resolved render coordinates when provided', async () => {
    const { drawSaunojas } = await import('./renderSaunoja.ts');

    const assets = {
      placeholder: createSpriteStub(),
      'unit-saunoja-guardian': createSpriteStub()
    } satisfies Record<string, HTMLImageElement>;

    const { ctx } = createMockContext();
    const units = [
      {
        id: 'drifting',
        name: 'Drifting',
        coord: { q: 0, r: 0 },
        maxHp: 12,
        hp: 9,
        steam: 0.5,
        selected: false,
        shield: 0,
        modifiers: [],
        lastHitAt: 0
      },
      {
        id: 'anchored',
        name: 'Anchored',
        coord: { q: 2, r: 1 },
        maxHp: 10,
        hp: 7,
        steam: 0.2,
        selected: false,
        shield: 0,
        modifiers: [],
        lastHitAt: 0
      }
    ];

    const resolveRenderCoord = vi.fn((unit: (typeof units)[number]) =>
      unit.id === 'drifting' ? { q: 5, r: -4 } : undefined
    );

    drawSaunojas(ctx, units as any, {
      assets,
      hexRadius: 28,
      resolveRenderCoord
    });

    expect(resolveRenderCoord).toHaveBeenCalledTimes(2);

    const drawCalls = (ctx.drawImage as unknown as Mock).mock.calls;
    const placementA = getSpritePlacement({
      coord: { q: 5, r: -4 },
      hexSize: 28,
      origin: { x: 0, y: 0 },
      zoom: 1,
      type: 'saunoja-guardian'
    });
    const placementB = getSpritePlacement({
      coord: units[1]!.coord,
      hexSize: 28,
      origin: { x: 0, y: 0 },
      zoom: 1,
      type: 'saunoja-guardian'
    });

    expect(drawCalls[0][1]).toBe(placementA.drawX);
    expect(drawCalls[0][2]).toBe(placementA.drawY);
    expect(drawCalls[1][1]).toBe(placementB.drawX);
    expect(drawCalls[1][2]).toBe(placementB.drawY);
  });
});
