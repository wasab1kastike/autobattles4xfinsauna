import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState } from '../../src/core/GameState.ts';
import { setupHudNavigation } from '../../src/ui/hudNavigation.tsx';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';
import { setupPoliciesWindow } from '../../src/ui/policies/setupPoliciesWindow.ts';
import { useIsMobile } from '../../src/ui/hooks/useIsMobile.ts';
import { HUD_OVERLAY_COLLAPSED_CLASS } from '../../src/ui/layout.ts';

describe('HUD navigation', () => {
  let overlay: HTMLDivElement;

  const navToolbarActiveValue = (): string | null =>
    overlay.querySelector<HTMLElement>('[data-hud-navigation]')?.dataset.activeView ?? null;

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

    const navToolbar = overlay.querySelector('[data-hud-navigation]');
    expect(navToolbar).not.toBeNull();
    expect(navToolbar?.classList.contains('hud-nav-toolbar')).toBe(true);
    expect(navToolbar?.parentElement?.dataset.hudAnchor).toBe('top-left-cluster');

    const buttons = navToolbar?.querySelectorAll<HTMLButtonElement>('[data-hud-nav-item]');
    expect(buttons).toHaveLength(3);

    const iconBadges = navToolbar?.querySelectorAll('.hud-nav-toolbar__badge img');
    expect(iconBadges).toHaveLength(3);

    const srLabels = navToolbar?.querySelectorAll('.sr-only');
    expect(srLabels).toHaveLength(3);

    const policiesButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="policies"]');
    expect(policiesButton?.dataset.active).toBe('true');
    expect(policiesButton?.getAttribute('aria-pressed')).toBe('true');

    const eventsButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="events"]');
    eventsButton?.click();

    expect(navigate).toHaveBeenCalledWith('events');
    expect(eventsButton?.getAttribute('aria-pressed')).toBe('true');

    nav.dispose();
  });

  it('supports arrow-key focus management with roving activation', () => {
    const navigate = vi.fn();
    const nav = setupHudNavigation(overlay, { onNavigate: navigate });

    const rosterButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="roster"]');
    const policiesButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="policies"]');
    const eventsButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="events"]');

    expect(rosterButton?.tabIndex).toBe(0);
    expect(policiesButton?.tabIndex).toBe(-1);
    expect(eventsButton?.tabIndex).toBe(-1);

    rosterButton?.focus();
    expect(document.activeElement).toBe(rosterButton);

    rosterButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith('policies');
    expect(document.activeElement).toBe(policiesButton);
    expect(policiesButton?.getAttribute('aria-pressed')).toBe('true');
    expect(policiesButton?.tabIndex).toBe(0);
    expect(rosterButton?.tabIndex).toBe(-1);

    policiesButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(navigate).toHaveBeenLastCalledWith('events');
    expect(document.activeElement).toBe(eventsButton);
    expect(eventsButton?.tabIndex).toBe(0);

    eventsButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(navigate).toHaveBeenLastCalledWith('policies');
    expect(document.activeElement).toBe(policiesButton);

    policiesButton?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(navigate).toHaveBeenLastCalledWith('roster');
    expect(document.activeElement).toBe(rosterButton);

    nav.dispose();
  });

  it('coordinates the right panel console with the dedicated policies window', () => {
    const state = new GameState(1000);
    const panelController = setupRightPanel(state);
    const policiesWindow = setupPoliciesWindow(state, { overlay });

    const nav = setupHudNavigation(overlay, {
      onNavigate: (view) => {
        if (view === 'policies') {
          if (policiesWindow.isOpen()) {
            policiesWindow.close();
          } else {
            policiesWindow.open();
          }
          return;
        }
        policiesWindow.close({ restoreFocus: false });
        panelController.showView(view);
      }
    });

    const detachView = panelController.onViewChange((view) => {
      if (!policiesWindow.isOpen()) {
        nav.setActive(view);
      }
    });
    const detachPolicies = policiesWindow.onOpenChange((open) => {
      nav.setActive(open ? 'policies' : panelController.getActiveView());
    });

    const rosterView = overlay.querySelector<HTMLElement>('#right-panel-roster');
    const eventsView = overlay.querySelector<HTMLElement>('#right-panel-events');
    const policiesRoot = document.querySelector<HTMLElement>('[data-policies-window]');

    expect(rosterView?.dataset.active).toBe('true');
    expect(eventsView?.dataset.active).toBe('false');
    expect(policiesRoot?.classList.contains('policies-window--open')).toBe(false);

    const policiesButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="policies"]');
    expect(policiesButton).not.toBeNull();

    policiesButton?.click();

    expect(policiesWindow.isOpen()).toBe(true);
    expect(rosterView?.dataset.active).toBe('true');
    expect(navToolbarActiveValue()).toBe('policies');

    policiesWindow.close();

    expect(policiesWindow.isOpen()).toBe(false);
    expect(navToolbarActiveValue()).toBe('roster');

    panelController.showView('events');

    expect(eventsView?.dataset.active).toBe('true');
    expect(navToolbarActiveValue()).toBe('events');

    detachPolicies();
    detachView();
    nav.dispose();
    policiesWindow.destroy();
    panelController.dispose();
  });

  it('keeps the right panel collapsed on narrow layouts until navigation expands it', () => {
    const matchMediaMock = vi.fn((query: string) => {
      const isNarrow = query.includes('960');
      const isMobile = query.includes('959');
      const mediaQuery: MediaQueryList = {
        matches: isNarrow ? true : isMobile ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false)
      } as unknown as MediaQueryList;
      return mediaQuery;
    });
    window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia;

    const state = new GameState(1000);
    const controller = setupRightPanel(state);
    const panel = overlay.querySelector<HTMLDivElement>('#right-panel');

    expect(panel?.classList.contains('right-panel--collapsed')).toBe(true);
    expect(panel?.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(true);

    const nav = setupHudNavigation(overlay, { initialView: 'events', onNavigate: controller.openView });
    controller.showView('events');

    const rosterButton = overlay.querySelector<HTMLButtonElement>('[data-hud-nav-item="roster"]');
    expect(rosterButton).not.toBeNull();

    rosterButton?.click();

    expect(panel?.classList.contains('right-panel--collapsed')).toBe(false);
    expect(panel?.getAttribute('aria-hidden')).toBe('false');
    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(false);

    nav.dispose();
    controller.dispose();
  });

  it('opens the console in mobile mode for mid-width viewports without overflowing the overlay', () => {
    const matchMediaMock = vi.fn((query: string) => {
      const normalized = query.replace(/\s+/g, '');
      const matchesMidViewport =
        normalized.includes('(max-width:959px)') || normalized.includes('(max-width:960px)');
      const mediaQuery: MediaQueryList = {
        matches: matchesMidViewport,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false)
      } as unknown as MediaQueryList;
      return mediaQuery;
    });
    window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia;

    const resetHandle = useIsMobile({ immediate: true });
    resetHandle.dispose();
    const mobileHandle = useIsMobile({ immediate: true });

    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    const state = new GameState(1000);
    const controller = setupRightPanel(state);
    setupHudNavigation(overlay, { onNavigate: controller.openView });

    controller.openRosterView();

    expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(false);

    const slide = overlay.querySelector<HTMLDivElement>('.right-panel-slide');
    expect(slide).not.toBeNull();
    expect(slide?.classList.contains('right-panel-slide--open')).toBe(true);
    expect(slide?.getAttribute('aria-hidden')).toBe('false');
    const panel = overlay.querySelector<HTMLDivElement>('#right-panel');
    expect(panel && slide?.contains(panel)).toBe(true);
    expect(document.body.classList.contains('is-mobile-panel-open')).toBe(true);

    raf.mockRestore();
    controller.dispose();
    mobileHandle.dispose();
  });
});

