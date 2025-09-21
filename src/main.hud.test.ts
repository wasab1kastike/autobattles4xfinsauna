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

  it('restores the classic HUD and persists the flag when the V2 exit control is used', async () => {
    const { DEFAULT_SAUNA_TIER_ID } = await import('./sauna/tiers.ts');
    const { SAUNA_SETTINGS_STORAGE_KEY } = await import('./game/saunaSettings.ts');

    window.localStorage.setItem(
      SAUNA_SETTINGS_STORAGE_KEY,
      JSON.stringify({ maxRosterSize: 6, activeTierId: DEFAULT_SAUNA_TIER_ID, useUiV2: true })
    );

    const { init, destroy } = await import('./main.ts');

    init();
    await Promise.resolve();

    const overlay = document.getElementById('ui-overlay');
    expect(overlay?.dataset.hudVariant).toBe('v2');

    const returnControl = document.querySelector<HTMLButtonElement>('[data-testid="return-to-classic-hud"]');
    expect(returnControl).toBeTruthy();

    returnControl?.click();
    await Promise.resolve();

    const saved = window.localStorage.getItem(SAUNA_SETTINGS_STORAGE_KEY);
    expect(saved).toBeTruthy();
    const parsed = saved ? (JSON.parse(saved) as { useUiV2?: boolean }) : null;
    expect(parsed?.useUiV2).toBe(false);

    expect(overlay?.dataset.hudVariant).toBe('classic');
    expect(document.querySelector('[data-testid="return-to-classic-hud"]')).toBeNull();
    expect(document.querySelector('#topbar')).not.toBeNull();
    expect(document.querySelector('[data-testid="inventory-badge"]')).not.toBeNull();
    expect(document.querySelector('#right-panel')).not.toBeNull();

    destroy();
    await Promise.resolve();
  });
});
