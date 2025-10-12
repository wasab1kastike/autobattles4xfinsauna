import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTutorialController } from '../../src/ui/tutorial/Tutorial.tsx';

function mockRect({
  top,
  left,
  width,
  height
}: {
  top: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    }
  } as DOMRect;
}

describe('tutorial enemy ramp spotlight', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-tutorial-target="heat"></div>
      <div data-tutorial-target="upkeep"></div>
      <div data-tutorial-target="sisu"></div>
      <div class="topbar">
        <div data-tutorial-target="enemy-ramp" class="topbar-badge"></div>
      </div>
    `;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('anchors the enemy ramp step to the top-bar badge without floating the card', () => {
    const controller = createTutorialController();
    controller.start();

    const card = document.querySelector<HTMLElement>('.tutorial-card');
    expect(card).toBeTruthy();
    if (!card) {
      throw new Error('Expected tutorial card to mount.');
    }

    Object.defineProperty(card, 'getBoundingClientRect', {
      configurable: true,
      value: () => mockRect({ top: 0, left: 0, width: 320, height: 200 })
    });

    const enemyRamp = document.querySelector<HTMLElement>('[data-tutorial-target="enemy-ramp"]');
    expect(enemyRamp).toBeTruthy();
    if (!enemyRamp) {
      throw new Error('Enemy ramp badge anchor missing in test DOM.');
    }

    Object.defineProperty(enemyRamp, 'getBoundingClientRect', {
      configurable: true,
      value: () => mockRect({ top: 24, left: 200, width: 180, height: 48 })
    });

    controller.next();
    controller.next();
    controller.next();

    const highlighted = document.querySelector('[data-tutorial-highlight="true"]');
    expect(highlighted).toBe(enemyRamp);
    expect(card.classList.contains('tutorial-card--floating')).toBe(false);
    expect(card.style.top).toMatch(/px$/);
    expect(card.style.left).toMatch(/px$/);

    controller.destroy();
  });
});
