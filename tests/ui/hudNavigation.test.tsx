import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { setupHudNavigation } from '../../src/ui/hudNavigation.tsx';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';

describe('HUD navigation', () => {
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
        dispatchEvent: vi.fn()
      }))
    });
    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
  });

  afterEach(() => {
    overlay.remove();
    vi.restoreAllMocks();
  });

  it('renders premium navigation controls and emits events', () => {
    const navigate = vi.fn();
    const nav = setupHudNavigation(overlay, { initialView: 'policies', onNavigate: navigate });

    const navCard = overlay.querySelector('[data-hud-navigation]');
    expect(navCard).not.toBeNull();

    const buttons = overlay.querySelectorAll<HTMLButtonElement>('[data-hud-nav-item]');
    expect(buttons).toHaveLength(3);

    const policiesButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="policies"]');
    expect(policiesButton?.dataset.active).toBe('true');

    const eventsButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="events"]');
    eventsButton?.click();

    expect(navigate).toHaveBeenCalledWith('events');

    nav.dispose();
  });

  it('coordinates with the right panel view controller', () => {
    const state = new GameState(1000);
    const controller = setupRightPanel(state);
    const nav = setupHudNavigation(overlay, { onNavigate: controller.showView });
    const detach = controller.onViewChange((view) => nav.setActive(view));

    const panel = overlay.querySelector('#right-panel');
    expect(panel?.querySelector('.panel-tabs')).toBeNull();

    const rosterView = overlay.querySelector<HTMLElement>('#right-panel-roster');
    const policiesView = overlay.querySelector<HTMLElement>('#right-panel-policies');
    const eventsView = overlay.querySelector<HTMLElement>('#right-panel-events');

    expect(rosterView?.dataset.active).toBe('true');
    expect(policiesView?.dataset.active).toBe('false');
    expect(eventsView?.dataset.active).toBe('false');

    const policiesButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="policies"]');
    policiesButton?.click();

    expect(policiesView?.dataset.active).toBe('true');
    expect(rosterView?.dataset.active).toBe('false');

    controller.showView('events');

    expect(eventsView?.dataset.active).toBe('true');
    const eventsButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="events"]');
    expect(eventsButton?.dataset.active).toBe('true');

    detach();
    nav.dispose();
    controller.dispose();
  });
});

