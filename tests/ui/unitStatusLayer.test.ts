import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnitStatusLayer } from '../../src/ui/fx/UnitStatusLayer.ts';
import type { SaunaStatusPayload, UnitStatusPayload } from '../../src/ui/fx/types.ts';

function createOverlay(): HTMLElement {
  const overlay = document.createElement('div');
  overlay.id = 'ui-overlay';
  overlay.style.position = 'relative';
  overlay.style.width = '800px';
  overlay.style.height = '600px';
  document.body.appendChild(overlay);
  return overlay;
}

describe('createUnitStatusLayer', () => {
  let overlay: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    overlay = createOverlay();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('mounts entries and reflects projected positions', () => {
    const layer = createUnitStatusLayer({
      root: overlay,
      project: (point) => point,
      getZoom: () => 1
    });

    const units: UnitStatusPayload[] = [
      {
        id: 'alpha',
        world: { x: 120, y: 240 },
        radius: 24,
        hp: 6,
        maxHp: 10,
        shield: 3,
        faction: 'player',
        selected: true,
        buffs: [
          { id: 'regen', remaining: 4, duration: 8 },
          { id: 'fury', remaining: Infinity, duration: Infinity, stacks: 3 }
        ]
      }
    ];

    const sauna: SaunaStatusPayload = {
      id: 'sauna',
      world: { x: 320, y: 180 },
      radius: 30,
      progress: 0.6,
      countdown: 5,
      label: 'Sauna ♨️'
    };

    layer.render({ units, sauna });

    const unitNode = overlay.querySelector('.ui-unit-status') as HTMLElement;
    expect(unitNode).toBeTruthy();
    expect(unitNode.dataset.unitId).toBe('alpha');
    expect(unitNode.style.transform).toContain('120px');
    expect(unitNode.style.getPropertyValue('--radius')).toBe('24px');
    expect(unitNode.classList.contains('is-selected')).toBe(true);

    const pips = unitNode.querySelectorAll('.ui-unit-status__pip');
    expect(pips).toHaveLength(2);
    expect((pips[1] as HTMLElement).dataset.infinite).toBe('true');
    expect((pips[1].querySelector('span') as HTMLElement).textContent).toBe('3');

    const saunaNode = overlay.querySelector('.ui-unit-status__sauna') as HTMLElement;
    expect(saunaNode).toBeTruthy();
    expect(saunaNode.style.transform).toContain('320px');
    expect(saunaNode.style.getPropertyValue('--radius')).toBe('30px');

    layer.render({ units: [], sauna: null });
    expect(overlay.querySelector('.ui-unit-status')).toBeNull();
    expect(overlay.querySelector('.ui-unit-status__sauna')).toBeNull();

    layer.destroy();
  });

  it('cleans up DOM nodes when destroyed', () => {
    const layer = createUnitStatusLayer({
      root: overlay,
      project: (point) => point,
      getZoom: () => 1
    });

    expect(overlay.querySelector('.ui-unit-status-layer')).toBeTruthy();
    layer.destroy();
    expect(overlay.querySelector('.ui-unit-status-layer')).toBeNull();
  });
});
