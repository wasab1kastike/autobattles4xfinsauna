import { beforeEach, describe, expect, it, vi } from 'vitest';

const renderShell = () => {
  document.body.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="ui-overlay">
        <div class="hud-layout-root" data-hud-root>
          <div class="hud-region hud-top-row" data-hud-region="top"></div>
          <div class="hud-region hud-actions" data-hud-region="left"></div>
          <div class="hud-region hud-content" data-hud-region="content"></div>
          <div class="hud-region hud-right-column" data-hud-region="right">
            <div id="resource-bar"></div>
          </div>
          <div class="hud-region hud-bottom-row" data-hud-region="bottom"></div>
        </div>
      </div>
    </div>
  `;
};

const stubMatchMedia = () =>
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

beforeEach(() => {
  vi.resetModules();
  window.localStorage?.clear?.();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null)
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: stubMatchMedia()
  });
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
    const id = window.setTimeout(() => cb(performance.now()), 0);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number): void => {
    window.clearTimeout(id);
  };
  renderShell();
});

describe('main HUD lifecycle', () => {
  it('rebuilds topbar, inventory badge, and right panel after destroy/init cycle', async () => {
    const { init, destroy } = await import('./main.ts');

    init();
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="inventory-badge"]')).toHaveLength(1);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(1);

    destroy();
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(0);
    expect(document.querySelectorAll('[data-testid="inventory-badge"]')).toHaveLength(0);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(0);

    init();
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid="inventory-badge"]')).toHaveLength(1);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(1);
  });
});
