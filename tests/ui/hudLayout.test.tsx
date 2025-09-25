import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { ensureHudLayout } from '../../src/ui/layout.ts';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';

describe('HUD layout panels', () => {
  let overlay: HTMLDivElement;

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
    vi.restoreAllMocks();
  });

  it('removes legacy bottom tab chrome when ensuring the layout', () => {
    const legacyRoot = document.createElement('div');
    legacyRoot.dataset.hudRoot = 'true';
    const bottomRegion = document.createElement('div');
    bottomRegion.dataset.hudRegion = 'bottom';
    const commandDock = document.createElement('div');
    commandDock.dataset.hudAnchor = 'command-dock';
    const oldTabs = document.createElement('div');
    oldTabs.dataset.hudBottomTabs = 'true';
    commandDock.appendChild(oldTabs);
    bottomRegion.appendChild(commandDock);
    legacyRoot.appendChild(bottomRegion);
    overlay.appendChild(legacyRoot);

    const layout = ensureHudLayout(overlay);
    const residual = layout.anchors.commandDock.querySelector('[data-hud-bottom-tabs]');

    expect(residual).toBeNull();
  });

  it('mounts policies inside the right panel policies tab', () => {
    const state = new GameState(1000);
    const controller = setupRightPanel(state);

    const policiesTab = overlay.querySelector<HTMLDivElement>('#right-panel-policies');
    expect(policiesTab).not.toBeNull();
    expect(policiesTab?.querySelector('.policy-card')).not.toBeNull();

    expect(overlay.querySelector('[data-hud-bottom-tabs]')).toBeNull();

    controller.dispose();
  });
});

