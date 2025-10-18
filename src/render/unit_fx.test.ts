import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createUnitFxManager } from './unit_fx.ts';
import { eventBus } from '../events/index.ts';
import type { Unit } from '../units/Unit.ts';

const spawnMock = vi.fn();
const floaterDestroyMock = vi.fn();

vi.mock('../ui/fx/Floater.tsx', () => ({
  createFloaterLayer: vi.fn(() => ({
    spawn: spawnMock,
    destroy: floaterDestroyMock
  }))
}));

const statusRenderMock = vi.fn();
const statusDestroyMock = vi.fn();

vi.mock('../ui/fx/UnitStatusLayer.ts', () => ({
  createUnitStatusLayer: vi.fn(() => ({
    render: statusRenderMock,
    destroy: statusDestroyMock
  }))
}));

const miniHudMock = {
  setBehaviorInteractivity: vi.fn(),
  setSelection: vi.fn(),
  updateStatus: vi.fn(),
  refreshPosition: vi.fn(),
  destroy: vi.fn()
};

vi.mock('../ui/fx/SelectionMiniHud.ts', () => ({
  createSelectionMiniHud: vi.fn(() => miniHudMock)
}));

const keywordEffects = {
  attacker: {
    tickHpDamage: 0,
    tickShieldDamage: 0,
    shieldGranted: 3,
    shieldConsumed: 0,
    lifesteal: 2,
    keywordShieldRemaining: 3
  },
  defender: {
    tickHpDamage: 1.5,
    tickShieldDamage: 1,
    shieldGranted: 4,
    shieldConsumed: 3,
    lifesteal: 0,
    keywordShieldRemaining: 2
  }
};

describe('createUnitFxManager keyword effects', () => {
  beforeEach(() => {
    spawnMock.mockClear();
    floaterDestroyMock.mockClear();
    statusRenderMock.mockClear();
    statusDestroyMock.mockClear();
    miniHudMock.setBehaviorInteractivity.mockClear();
    miniHudMock.setSelection.mockClear();
    miniHudMock.updateStatus.mockClear();
    miniHudMock.refreshPosition.mockClear();
    miniHudMock.destroy.mockClear();
  });

  it('spawns floaters for keyword shield, tick, and lifesteal effects', () => {
    const canvas = document.createElement('canvas');
    const overlay = document.createElement('div');
    const rect = {
      width: 320,
      height: 180,
      left: 0,
      top: 0,
      right: 320,
      bottom: 180
    } as DOMRect;
    canvas.getBoundingClientRect = () => rect;
    overlay.getBoundingClientRect = () => rect;

    const units = new Map<string, Partial<Unit>>();
    units.set('target', {
      id: 'target',
      coord: { q: 1, r: 0 },
      renderCoord: { q: 1, r: 0 }
    } as Partial<Unit> as Unit);
    units.set('attacker', {
      id: 'attacker',
      coord: { q: 0, r: 0 },
      renderCoord: { q: 0, r: 0 }
    } as Partial<Unit> as Unit);

    const manager = createUnitFxManager({
      canvas,
      overlay,
      mapRenderer: { hexSize: 24 } as any,
      getUnitById: (id) => units.get(id) as Unit | undefined
    });

    eventBus.emit('unitDamaged', {
      attackerId: 'attacker',
      targetId: 'target',
      amount: 9,
      remainingHealth: 3,
      timestamp: 1_000,
      keywordEffects,
      attackerHealing: 2.4
    });

    expect(spawnMock).toHaveBeenCalled();
    const texts = spawnMock.mock.calls.map(([options]) => options?.text ?? '');
    expect(texts.some((text) => /^-9/.test(text))).toBe(true);
    expect(texts.some((text) => text.startsWith('✶-'))).toBe(true);
    expect(texts.some((text) => text.startsWith('🛡-'))).toBe(true);
    expect(texts.filter((text) => text.startsWith('🛡+')).length).toBeGreaterThanOrEqual(1);
    expect(texts.some((text) => text.startsWith('❤+'))).toBe(true);

    manager.dispose();
  });
});
