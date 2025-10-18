import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameState, Resource } from '../../../src/core/GameState.ts';
import { setupPoliciesWindow } from '../../../src/ui/policies/setupPoliciesWindow.ts';

describe('setupPoliciesWindow', () => {
  let overlay: HTMLDivElement;
  let state: GameState;

  beforeEach(() => {
    document.body.innerHTML = '';
    overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);
    const portal = document.createElement('div');
    portal.id = 'hud-root';
    document.body.appendChild(portal);
    state = new GameState(1000);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens and closes the policies sheet with focus management', () => {
    vi.useFakeTimers();
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    const navTrigger = document.createElement('button');
    navTrigger.type = 'button';
    navTrigger.textContent = 'Policies';
    overlay.appendChild(navTrigger);
    navTrigger.focus();

    const controller = setupPoliciesWindow(state, { overlay });
    const openStates: boolean[] = [];
    const detach = controller.onOpenChange((open) => {
      openStates.push(open);
    });

    expect(controller.isOpen()).toBe(false);

    controller.open();

    const root = document.querySelector<HTMLElement>('[data-policies-window]');
    const sheet = root?.querySelector<HTMLElement>('.policies-window__sheet');
    const closeButton = sheet?.querySelector<HTMLButtonElement>('.policies-window__close');

    expect(root).not.toBeNull();
    expect(root?.hidden).toBe(false);
    expect(root?.classList.contains('policies-window--visible')).toBe(true);
    expect(root?.classList.contains('policies-window--open')).toBe(true);
    expect(root?.getAttribute('aria-hidden')).toBe('false');
    expect(sheet?.getAttribute('aria-hidden')).toBe('false');
    expect(overlay.getAttribute('aria-hidden')).toBe('true');
    expect(overlay.dataset.inert).toBe('true');
    expect(controller.isOpen()).toBe(true);
    expect(openStates).toEqual([true]);
    expect(document.activeElement).toBe(closeButton);

    controller.close();

    expect(controller.isOpen()).toBe(false);
    expect(openStates).toEqual([true, false]);
    expect(root?.classList.contains('policies-window--open')).toBe(false);
    expect(overlay.hasAttribute('data-inert')).toBe(false);
    expect(overlay.hasAttribute('aria-hidden')).toBe(false);

    vi.advanceTimersByTime(320);

    expect(root?.hidden).toBe(true);
    expect(root?.getAttribute('aria-hidden')).toBe('true');
    expect(document.activeElement).toBe(navTrigger);

    detach();
    controller.destroy();
    raf.mockRestore();
  });

  it('tears down the overlay when destroyed', () => {
    vi.useFakeTimers();
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    const controller = setupPoliciesWindow(state, { overlay });
    controller.open({ focus: false });

    expect(document.querySelector('[data-policies-window]')).not.toBeNull();

    controller.destroy();

    vi.runOnlyPendingTimers();

    expect(document.querySelector('[data-policies-window]')).toBeNull();
    expect(overlay.hasAttribute('data-inert')).toBe(false);
    expect(overlay.hasAttribute('aria-hidden')).toBe(false);

    raf.mockRestore();
  });

  it('toggles policy state through action buttons and badge updates', () => {
    const raf = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 0;
      });

    const controller = setupPoliciesWindow(state, { overlay });
    state.addResource(Resource.SAUNAKUNNIA, 100);

    controller.open({ focus: false });

    const root = document.querySelector<HTMLElement>('[data-policies-window]');
    expect(root).not.toBeNull();

    const firstCard = root?.querySelector<HTMLElement>('.policy-card');
    const action = firstCard?.querySelector<HTMLButtonElement>('.policy-card__action');
    const title = firstCard?.querySelector<HTMLElement>('.policy-card__title');

    expect(title?.textContent).toContain('Evergreen Eco Mandate');
    expect(action?.disabled).toBe(false);

    action?.click();

    expect(state.hasPolicy('eco')).toBe(true);
    expect(firstCard?.dataset.status).toBe('applied');
    expect(action?.textContent).toContain('Disable');

    action?.click();

    expect(state.hasPolicy('eco')).toBe(false);
    expect(state.isPolicyUnlocked('eco')).toBe(true);
    expect(firstCard?.dataset.status).toBe('disabled');
    expect(action?.textContent).toContain('Reinstate');

    controller.setBadge('Council alert');
    const badge = root?.querySelector<HTMLElement>('.policies-window__status');
    expect(badge?.dataset.visible).toBe('true');
    expect(badge?.textContent).toBe('Council alert');

    controller.setBadge(null);
    expect(badge?.dataset.visible).toBe('false');
    expect(badge?.textContent).toBe('');

    controller.destroy();
    raf.mockRestore();
  });
});
