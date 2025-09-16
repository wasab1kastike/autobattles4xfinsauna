import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { drawHP, drawSelectionRing, drawSteam } from './visualHelpers.ts';
import * as hex from '../hex/index.ts';

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
    stroke: vi.fn(),
    fillRect: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    bezierCurveTo: vi.fn(),
    setLineDash: vi.fn(),
    lineWidth: 0,
    strokeStyle: '',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    globalCompositeOperation: 'source-over',
    lineCap: 'butt'
  } as unknown as CanvasRenderingContext2D;
  return { ctx, gradient };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('drawHP', () => {
  it('fills remaining health proportionally to the ratio', () => {
    const { ctx } = createMockContext();
    const pathSpy = vi.spyOn(hex, 'pathHex');
    drawHP(ctx, { centerX: 10, centerY: 20, hp: 5, maxHp: 10, radius: 10 });
    expect(pathSpy).toHaveBeenCalledTimes(3);
    const fillRectMock = ctx.fillRect as unknown as Mock;
    expect(fillRectMock.mock.calls).toHaveLength(1);
    const [x, y, width, height] = fillRectMock.mock.calls[0];
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(20);
    expect(width).toBeCloseTo(20);
    expect(height).toBeCloseTo(10);
  });

  it('skips the fill when no health remains', () => {
    const { ctx } = createMockContext();
    const pathSpy = vi.spyOn(hex, 'pathHex');
    drawHP(ctx, { centerX: 0, centerY: 0, hp: -2, maxHp: 10, radius: 8 });
    const fillRectMock = ctx.fillRect as unknown as Mock;
    expect(fillRectMock.mock.calls).toHaveLength(0);
    expect(pathSpy).toHaveBeenCalledTimes(2);
  });
});

describe('drawSelectionRing', () => {
  it('draws an outer glow and inner dashed ring using hex paths', () => {
    const { ctx } = createMockContext();
    const pathSpy = vi.spyOn(hex, 'pathHex');
    drawSelectionRing(ctx, { centerX: 4, centerY: -6 });
    expect(pathSpy).toHaveBeenCalledTimes(2);
    const firstCall = pathSpy.mock.calls[0];
    const secondCall = pathSpy.mock.calls[1];
    expect(firstCall[1]).toBe(4);
    expect(firstCall[2]).toBe(-6);
    expect(firstCall[3]).toBeCloseTo(hex.HEX_R);
    expect(secondCall[3]).toBeCloseTo(hex.HEX_R * 0.74);
    const strokeMock = ctx.stroke as unknown as Mock;
    expect(strokeMock.mock.calls.length).toBe(2);
    const dashMock = ctx.setLineDash as unknown as Mock;
    expect(dashMock.mock.calls.length).toBeGreaterThan(0);
    expect(dashMock.mock.calls[0][0][0]).toBeGreaterThan(0);
  });
});

describe('drawSteam', () => {
  it('respects zero intensity by avoiding any drawing work', () => {
    const { ctx } = createMockContext();
    const pathSpy = vi.spyOn(hex, 'pathHex');
    drawSteam(ctx, { centerX: 0, centerY: 0, intensity: 0 });
    expect(pathSpy).not.toHaveBeenCalled();
    const fillRectMock = ctx.fillRect as unknown as Mock;
    expect(fillRectMock.mock.calls).toHaveLength(0);
    const bezierMock = ctx.bezierCurveTo as unknown as Mock;
    expect(bezierMock.mock.calls).toHaveLength(0);
  });

  it('clips to a hex silhouette and adds swirling strokes', () => {
    const { ctx } = createMockContext();
    const pathSpy = vi.spyOn(hex, 'pathHex');
    drawSteam(ctx, { centerX: 2, centerY: 3, intensity: 0.6, radius: 9 });
    expect(pathSpy).toHaveBeenCalledTimes(1);
    const clipMock = ctx.clip as unknown as Mock;
    expect(clipMock.mock.calls.length).toBeGreaterThan(0);
    const fillRectMock = ctx.fillRect as unknown as Mock;
    expect(fillRectMock.mock.calls).toHaveLength(1);
    const bezierMock = ctx.bezierCurveTo as unknown as Mock;
    expect(bezierMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
