import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HUD_OVERLAY_COLLAPSED_CLASS } from './ui/layout.ts';

vi.mock('./events', async () => {
  const actual = await vi.importActual<typeof import('./events')>('./events');
  return {
    ...actual,
    eventBus: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  };
});

const renderShell = () => {
  document.body.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="ui-overlay">
        <div class="hud-layout-root" data-hud-root>
          <div class="hud-region hud-top-row" data-hud-region="top">
            <div class="hud-anchor hud-anchor--top-left" data-hud-anchor="top-left-cluster">
              <div id="resource-bar"></div>
            </div>
            <div class="hud-anchor hud-anchor--top-right" data-hud-anchor="top-right-cluster"></div>
          </div>
          <div class="hud-region hud-actions" data-hud-region="left"></div>
          <div class="hud-region hud-content" data-hud-region="content"></div>
          <div class="hud-region hud-right-column" data-hud-region="right"></div>
          <div class="hud-region hud-bottom-row" data-hud-region="bottom">
            <div class="hud-anchor hud-anchor--command-dock" data-hud-anchor="command-dock"></div>
          </div>
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

beforeEach(async () => {
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
  const { setAssets } = await import('./game/assets.ts');
  setAssets({ images: {}, sounds: {}, atlases: { units: null } });
});

describe('main HUD lifecycle', () => {
  it('rebuilds topbar, inventory badge, and right panel after destroy/init cycle', async () => {
    const { getGameOrchestrator } = await import('./main.ts');
    const orchestrator = getGameOrchestrator();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const resourceBar = document.getElementById('resource-bar') as HTMLElement;
    const overlay = document.getElementById('ui-overlay') as HTMLElement;

    orchestrator.setup(canvas, resourceBar, overlay);
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(1);
    expect(document.querySelectorAll('[data-ui="inventory-toggle"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-ui="roster-toggle"]')).toHaveLength(1);
    expect(document.querySelectorAll('#inventory-stash-panel')).toHaveLength(1);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(1);
    expect(document.querySelectorAll('[data-hud-navigation]')).toHaveLength(1);
    const navToolbar = document.querySelector('[data-hud-navigation]');
    expect(navToolbar?.classList.contains('hud-nav-toolbar')).toBe(true);
    expect(navToolbar?.querySelectorAll('[data-hud-nav-item]')).toHaveLength(3);
    expect(overlay.classList.contains('roster-hud-open')).toBe(false);

    orchestrator.cleanup();
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(0);
    expect(document.querySelectorAll('[data-ui="inventory-toggle"]')).toHaveLength(0);
    expect(document.querySelectorAll('[data-ui="roster-toggle"]')).toHaveLength(0);
    expect(document.querySelectorAll('#inventory-stash-panel')).toHaveLength(0);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(0);
    expect(document.querySelectorAll('[data-hud-navigation]')).toHaveLength(0);

    orchestrator.setup(canvas, resourceBar, overlay);
    await Promise.resolve();

    expect(document.querySelectorAll('#topbar')).toHaveLength(1);
    expect(document.querySelectorAll('[data-ui="inventory-toggle"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-ui="roster-toggle"]')).toHaveLength(1);
    expect(document.querySelectorAll('#inventory-stash-panel')).toHaveLength(1);
    expect(document.querySelectorAll('#right-panel')).toHaveLength(1);
    expect(document.querySelectorAll('[data-hud-navigation]')).toHaveLength(1);
    const rebuiltToolbar = document.querySelector('[data-hud-navigation]');
    expect(rebuiltToolbar?.classList.contains('hud-nav-toolbar')).toBe(true);
    expect(rebuiltToolbar?.querySelectorAll('[data-hud-nav-item]')).toHaveLength(3);
  });

  it('ignores the legacy HUD v2 flag and renders the classic HUD', async () => {
    const { DEFAULT_SAUNA_TIER_ID } = await import('./sauna/tiers.ts');
    const { SAUNA_SETTINGS_STORAGE_KEY } = await import('./game/saunaSettings.ts');

    window.localStorage.setItem(
      SAUNA_SETTINGS_STORAGE_KEY,
      JSON.stringify({ maxRosterSize: 6, activeTierId: DEFAULT_SAUNA_TIER_ID, useUiV2: true })
    );

    const { getGameOrchestrator } = await import('./main.ts');
    const orchestrator = getGameOrchestrator();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const resourceBar = document.getElementById('resource-bar') as HTMLElement;
    const overlay = document.getElementById('ui-overlay') as HTMLElement;

    orchestrator.setup(canvas, resourceBar, overlay);
    await Promise.resolve();

    expect(overlay.dataset.hudVariant).toBe('classic');
    const returnControl = document.querySelector('[data-testid="return-to-classic-hud"]');
    expect(returnControl).toBeNull();
    expect(overlay.dataset.hudVariant).toBe('classic');
    expect(document.querySelector('[data-testid="return-to-classic-hud"]')).toBeNull();
    expect(document.querySelector('#topbar')).not.toBeNull();
    expect(document.querySelector('[data-ui="inventory-toggle"]')).not.toBeNull();
    expect(document.querySelector('#inventory-stash-panel')).not.toBeNull();
    expect(document.querySelector('#right-panel')).not.toBeNull();
    const nav = document.querySelector('[data-hud-navigation]');
    expect(nav).not.toBeNull();
    expect(nav?.classList.contains('hud-nav-toolbar')).toBe(true);

    orchestrator.cleanup();
    await Promise.resolve();
  });

  it('supports collapsing and expanding the command console on desktop viewports', async () => {
    const { getGameOrchestrator } = await import('./main.ts');
    const orchestrator = getGameOrchestrator();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    const resourceBar = document.getElementById('resource-bar') as HTMLElement;
    const overlay = document.getElementById('ui-overlay') as HTMLElement;

    orchestrator.setup(canvas, resourceBar, overlay);
    await Promise.resolve();

    const panel = document.getElementById('right-panel');
    const toggle = document.getElementById('right-panel-toggle');
    expect(toggle).not.toBeNull();
    expect(toggle?.hidden).toBe(false);
    expect(panel?.classList.contains('right-panel--collapsed')).toBe(false);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(false);

    toggle?.click();
    await Promise.resolve();

    expect(panel?.classList.contains('right-panel--collapsed')).toBe(true);
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(true);

    toggle?.click();
    await Promise.resolve();

    expect(panel?.classList.contains('right-panel--collapsed')).toBe(false);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(false);

    orchestrator.cleanup();
    await Promise.resolve();
  });
});
