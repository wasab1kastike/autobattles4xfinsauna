import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { createUnitFxManager } from '../../src/render/unit_fx.ts';
import type { UnitFxManager } from '../../src/render/unit_fx.ts';
import type { HexMapRenderer } from '../../src/render/HexMapRenderer.ts';
import { camera } from '../../src/camera/autoFrame.ts';
import type { UnitSelectionPayload } from '../../src/ui/fx/types.ts';

function createOverlayRoot(): { canvas: HTMLCanvasElement; overlay: HTMLElement } {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  Object.assign(canvas.style, {
    width: '800px',
    height: '600px',
    position: 'absolute',
    left: '0px',
    top: '0px'
  });
  canvas.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ''
  });

  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.width = '800px';
  overlay.style.height = '600px';
  overlay.getBoundingClientRect = () => ({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ''
  });

  document.body.appendChild(canvas);
  document.body.appendChild(overlay);
  return { canvas, overlay };
}

describe('SelectionMiniHud integration', () => {
  let manager: UnitFxManager;
  let canvas: HTMLCanvasElement;
  let overlay: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    ({ canvas, overlay } = createOverlayRoot());
    camera.x = 0;
    camera.y = 0;
    camera.zoom = 1;
    const mapRenderer = {
      hexSize: 48,
      getOrigin: () => ({ x: 0, y: 0 })
    } as unknown as HexMapRenderer;
    manager = createUnitFxManager({
      canvas,
      overlay,
      mapRenderer,
      getUnitById: () => undefined,
      requestDraw: () => {}
    });
  });

  afterEach(() => {
    manager?.dispose();
    document.body.innerHTML = '';
  });

  it('renders the mini HUD card with selection metadata', () => {
    const payload: UnitSelectionPayload = {
      id: 'attendant-1',
      name: 'Vellamo Vanguard',
      faction: 'player',
      coord: { q: 2, r: -1 },
      hp: 12,
      maxHp: 18,
      shield: 3,
      items: [
        { id: 'steam-saber', name: 'Steam Saber', icon: '/icons/saber.svg', rarity: 'epic', quantity: 1 },
        { id: 'glacial-ward', name: 'Glacial Ward', rarity: 'legendary', quantity: 1 },
        { id: 'polar-rune', name: 'Polar Rune', rarity: 'mythic', quantity: 2 }
      ],
      statuses: [
        { id: 'regen', label: 'Regen', remaining: 6, duration: 10 },
        { id: 'valor', label: 'Valor', remaining: Infinity, stacks: 3 }
      ]
    } satisfies UnitSelectionPayload;

    manager.setSelection(payload);
    manager.beginStatusFrame();
    manager.pushUnitStatus({
      id: 'attendant-1',
      world: { x: 160, y: 240 },
      radius: 24,
      hp: 12,
      maxHp: 18,
      shield: 3,
      faction: 'player'
    });
    manager.commitStatusFrame();
    manager.step(0);

    const card = overlay.querySelector('.ui-selection-mini-hud__card') as HTMLElement | null;
    expect(card).toBeTruthy();
    expect(card?.querySelector('.ui-selection-mini-hud__title')?.textContent).toBe(
      'Vellamo Vanguard'
    );

    const hpValue = card?.querySelector('.ui-selection-mini-hud__hp-value') as HTMLElement | null;
    expect(hpValue?.textContent).toContain('12 / 18');
    expect(hpValue?.textContent).toContain('+3');

    const items = card?.querySelectorAll('.ui-selection-mini-hud__item');
    expect(items?.length).toBe(3);

    const statuses = card?.querySelectorAll('.ui-selection-mini-hud__status');
    expect(statuses?.length).toBe(2);

    const entry = overlay.querySelector('.ui-selection-mini-hud') as HTMLElement | null;
    expect(entry?.dataset.visible).toBe('true');
  });

  it('hides the card when selection clears', () => {
    const payload: UnitSelectionPayload = {
      id: 'attendant-2',
      name: 'Aurora Sentinel',
      faction: 'player',
      coord: { q: 1, r: 1 },
      hp: 10,
      maxHp: 14,
      shield: 0,
      items: [],
      statuses: []
    } satisfies UnitSelectionPayload;

    manager.setSelection(payload);
    manager.beginStatusFrame();
    manager.pushUnitStatus({
      id: 'attendant-2',
      world: { x: 120, y: 200 },
      radius: 24,
      hp: 10,
      maxHp: 14,
      shield: 0,
      faction: 'player'
    });
    manager.commitStatusFrame();

    manager.setSelection(null);
    manager.beginStatusFrame();
    manager.commitStatusFrame();

    const entry = overlay.querySelector('.ui-selection-mini-hud') as HTMLElement | null;
    expect(entry?.dataset.visible).toBe('false');
  });
});
