import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { ensureHudLayout } from '../../src/ui/layout.ts';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';

describe('HUD layout structure', () => {
  let overlay: HTMLDivElement;
  let resourceBar: HTMLDivElement;

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
    resourceBar = document.createElement('div');
    resourceBar.id = 'resource-bar';
    overlay.appendChild(resourceBar);
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
    vi.restoreAllMocks();
  });

  it('positions the roster crest inside the right column', () => {
    const layout = ensureHudLayout(overlay);
    expect(layout.regions.right.contains(resourceBar)).toBe(true);
    expect(layout.dock.actions.dataset.hudCommandDockSection).toBe('actions');
    expect(overlay.querySelector('[data-hud-bottom-tabs]')).toBeNull();
  });

  it('renders policies inside the command console tab', () => {
    const state = new GameState(1000);
    const controller = setupRightPanel(state);

    const policyPanel = overlay.querySelector<HTMLDivElement>('#right-panel-policies');
    expect(policyPanel).not.toBeNull();
    expect(policyPanel?.querySelector('.policy-card')).not.toBeNull();

    expect(overlay.querySelector('[data-hud-bottom-tabs]')).toBeNull();

    controller.dispose();
  });
});
