import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { ensureHudLayout, type HudBottomTabId } from '../../src/ui/layout.ts';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';

describe('HUD bottom tabs', () => {
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

  it('creates roster, stash, and policies panels with roster active by default', () => {
    const layout = ensureHudLayout(overlay);
    const { tabs } = layout;

    expect(tabs.panels.roster.dataset.hudTabPanel).toBe('roster');
    expect(tabs.panels.stash.dataset.hudTabPanel).toBe('stash');
    expect(tabs.panels.policies.dataset.hudTabPanel).toBe('policies');

    expect(tabs.panels.roster.hidden).toBe(false);
    expect(tabs.panels.stash.hidden).toBe(true);

    tabs.setActive('stash');

    expect(tabs.panels.stash.hidden).toBe(false);
    expect(tabs.panels.roster.hidden).toBe(true);
    expect(tabs.panels.policies.hidden).toBe(true);
  });

  it('sets badges and emits change notifications', () => {
    const { tabs } = ensureHudLayout(overlay);
    const stashTab = overlay.querySelector<HTMLButtonElement>('[data-hud-tab="stash"]');
    expect(stashTab).not.toBeNull();

    tabs.setBadge('stash', 12);
    expect(stashTab?.getAttribute('data-badge')).toBe('12');

    const received: HudBottomTabId[] = [];
    const unsubscribe = tabs.onChange((id) => {
      received.push(id);
    });

    tabs.setActive('policies');
    tabs.setActive('roster');

    unsubscribe();

    expect(received).toEqual(['policies', 'roster']);
  });

  it('renders policies inside the bottom tab without duplicating in the right panel', () => {
    const state = new GameState(1000);
    const controller = setupRightPanel(state);

    const policyPanel = overlay.querySelector<HTMLDivElement>('[data-hud-tab-panel="policies"]');
    expect(policyPanel).not.toBeNull();
    expect(policyPanel?.querySelector('.policy-card')).not.toBeNull();

    expect(overlay.querySelector('#right-panel-policies')).toBeNull();

    controller.dispose();
  });
});
