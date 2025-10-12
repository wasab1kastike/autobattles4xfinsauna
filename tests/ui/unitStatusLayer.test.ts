import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnitStatusLayer } from '../../src/ui/fx/UnitStatusLayer.ts';
import type { SaunaPerimeterAnchor, SaunaStatusPayload, UnitStatusPayload } from '../../src/ui/fx/types.ts';

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

    const ringRadius = 30;
    const ringThickness = 6;
    const anchors = Array.from({ length: 6 }, (_, index) => {
      const angle = -Math.PI / 2 + Math.PI / 6 + (Math.PI / 3) * index;
      return {
        angle,
        radius: ringRadius,
        world: {
          x: 320 + Math.cos(angle) * ringRadius,
          y: 180 + Math.sin(angle) * ringRadius
        }
      } satisfies SaunaPerimeterAnchor;
    });

    const sauna: SaunaStatusPayload = {
      id: 'sauna',
      world: { x: 320, y: 180 },
      radius: ringRadius + ringThickness,
      progress: 0.6,
      countdown: 5,
      label: 'Sauna ♨️',
      unitLabel: 'sec',
      geometry: {
        ringRadius,
        ringThickness,
        startAngle: -Math.PI / 2,
        badgeAngle: 0,
        badgeRadius: 48,
        markerRadius: 27,
        anchors
      }
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
    expect(saunaNode.style.getPropertyValue('--radius')).toBe('36px');
    expect(saunaNode.style.getPropertyValue('--ring-radius')).toBe('30px');
    expect(saunaNode.style.getPropertyValue('--ring-thickness')).toBe('6px');
    expect(saunaNode.style.getPropertyValue('--badge-angle')).toBe('0deg');
    expect(saunaNode.style.getPropertyValue('--badge-radius')).toBe('48px');
    expect(saunaNode.style.getPropertyValue('--marker-radius')).toBe('27px');
    expect(saunaNode.style.getPropertyValue('--progress')).toBe('0.6000');

    const badge = saunaNode.querySelector('.ui-unit-status__sauna-badge');
    expect(badge).toBeTruthy();
    const marker = saunaNode.querySelector('.ui-unit-status__sauna-marker');
    expect(marker).toBeTruthy();
    const countdownValue = saunaNode.querySelector('.ui-unit-status__sauna-countdown strong');
    expect(countdownValue?.textContent).toBe('5');
    const unitLabel = saunaNode.querySelector('.ui-unit-status__sauna-countdown span');
    expect(unitLabel?.textContent).toBe('sec');
    const label = saunaNode.querySelector('.ui-unit-status__sauna-label');
    expect(label?.textContent).toBe('Sauna ♨️');

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
