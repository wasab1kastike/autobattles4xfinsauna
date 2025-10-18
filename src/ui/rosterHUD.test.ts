import { describe, expect, it, vi } from 'vitest';
import { GameState } from '../core/GameState.ts';
import { ensureHudLayout, HUD_OVERLAY_COLLAPSED_CLASS, ROSTER_HUD_OPEN_CLASS } from './layout.ts';
import type { RosterEntry } from './rightPanel.tsx';
import { setupRightPanel } from './rightPanel.tsx';
import { setupRosterHUD } from './rosterHUD.ts';

describe('rosterHUD', () => {
  const makeContainer = () => {
    const el = document.createElement('div');
    el.id = 'resource-bar-test';
    document.body.appendChild(el);
    return el;
  };

  const destroyContainer = (el: HTMLElement) => {
    el.remove();
  };

  it('updates the roster summary and card visuals', () => {
    const container = makeContainer();
    try {
      const hud = setupRosterHUD(container, {
        rosterIcon: '/icon.svg',
        summaryLabel: 'Sauna Guard'
      });

      hud.updateSummary({
        count: 5,
        card: {
          id: 'saunoja-7',
          name: 'Aurora Kallio',
          klass: 'Storm Herald',
          traits: ['Brave', 'Sage'],
          upkeep: 17,
          behavior: 'attack',
          progression: {
            level: 4,
            xp: 700,
            xpIntoLevel: 40,
            xpForNext: 320,
            progress: 40 / 320,
            statBonuses: { vigor: 13, focus: 7, resolve: 5 }
          }
        }
      });

      const root = container.querySelector('.sauna-roster');
      expect(root).not.toBeNull();

      const toggle = root?.querySelector<HTMLButtonElement>('.sauna-roster__toggle');
      expect(toggle?.disabled).toBe(false);
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');

      const details = root?.querySelector<HTMLElement>('.sauna-roster__details');
      expect(details?.hidden).toBe(true);

      const value = root?.querySelector('.sauna-roster__value');
      expect(value?.textContent).toBe('5');
      expect(root?.getAttribute('aria-label')).toBe('Saunoja roster: 5 active attendants');
      expect(root?.getAttribute('title')).toBe('Saunoja roster • 5 active attendants');

      toggle?.click();

      expect(root?.dataset.expanded).toBe('true');
      expect(toggle?.getAttribute('aria-expanded')).toBe('true');
      expect(details?.hidden).toBe(false);

      const card = root?.querySelector<HTMLDivElement>('.saunoja-card');
      expect(card?.hidden).toBe(false);
      expect(card?.dataset.unitId).toBe('saunoja-7');

      const name = root?.querySelector('.saunoja-card__name');
      expect(name?.textContent).toBe('Aurora Kallio');

      const levelBadge = root?.querySelector('.saunoja-card__level-value');
      expect(levelBadge?.textContent).toBe('4');

      const klass = root?.querySelector('.saunoja-card__class');
      expect(klass?.textContent).toBe('Storm Herald');
      expect(klass?.title).toBe('Storm Herald');

      const xpRow = root?.querySelector('.saunoja-card__xp');
      expect(xpRow?.textContent).toContain('40 / 320');

      const callouts = root?.querySelector('.saunoja-card__callouts');
      expect(callouts?.textContent).toContain('+13 Vigor');
      expect(callouts?.textContent).toContain('+7 Focus');
      expect(callouts?.textContent).toContain('+5 Resolve');

      const behaviorValue = root?.querySelector('.saunoja-card__behavior-value');
      expect(behaviorValue?.textContent).toBe('Attack');
      expect(behaviorValue?.title).toBe('Behavior: Attack');

      const behaviorGroup = root?.querySelector('.saunoja-card__behavior-options');
      expect(behaviorGroup?.getAttribute('aria-disabled')).toBe('true');
      const activeBehavior = behaviorGroup?.querySelector<HTMLButtonElement>(
        '.saunoja-card__behavior-option.is-active'
      );
      expect(activeBehavior?.dataset.behavior).toBe('attack');
      expect(activeBehavior?.disabled).toBe(true);

      const traits = root?.querySelector('.saunoja-card__traits');
      expect(traits?.textContent).toBe('Brave, Sage');
      expect(traits?.title).toBe('Brave, Sage');

      const upkeep = root?.querySelector('.saunoja-card__upkeep');
      expect(upkeep?.textContent).toBe('Upkeep: 17 Beer');
      expect(upkeep?.title).toBe('Upkeep: 17 Beer');
    } finally {
      destroyContainer(container);
    }
  });

  it('hides the card when no featured Saunoja is provided', () => {
    const container = makeContainer();
    try {
      const hud = setupRosterHUD(container, { rosterIcon: '/icon.svg' });
      hud.updateSummary({ count: 0, card: null });
      const card = container.querySelector<HTMLDivElement>('.saunoja-card');
      expect(card?.hidden).toBe(true);
      const toggle = container.querySelector<HTMLButtonElement>('.sauna-roster__toggle');
      expect(toggle?.disabled).toBe(true);
      expect(toggle?.getAttribute('aria-expanded')).toBe('false');
      const details = container.querySelector<HTMLElement>('.sauna-roster__details');
      expect(details?.hidden).toBe(true);
    } finally {
      destroyContainer(container);
    }
  });

  it('deduplicates roster renders based on signature changes', () => {
    const container = makeContainer();
    try {
      const hud = setupRosterHUD(container, { rosterIcon: '/icon.svg' });
      const renderer = vi.fn();
      hud.installRenderer(renderer);

      const baseEntry: RosterEntry = {
        id: 'saunoja-1',
        name: 'Watcher',
        klass: 'Warden',
        upkeep: 12,
        status: 'reserve',
        selected: false,
        behavior: 'defend',
        traits: [],
        stats: {
          health: 8,
          maxHealth: 10,
          attackDamage: 3,
          attackRange: 1,
          movementRange: 2
        },
        progression: {
          level: 2,
          xp: 200,
          xpIntoLevel: 20,
          xpForNext: 220,
          progress: 20 / 220,
          statBonuses: { vigor: 5, focus: 2, resolve: 1 }
        },
        items: [],
        modifiers: []
      };

      hud.renderRoster([baseEntry]);
      hud.renderRoster([baseEntry]);
      expect(renderer).toHaveBeenCalledTimes(1);

      const promoted = { ...baseEntry, name: 'Watcher Prime' } satisfies RosterEntry;
      hud.renderRoster([promoted]);
      expect(renderer).toHaveBeenCalledTimes(2);
    } finally {
      destroyContainer(container);
    }
  });

  it('activates the roster tab when expand events fire', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    try {
      const layout = ensureHudLayout(overlay);
      const rosterContainer = layout.tabs.panels.roster;
      const hud = setupRosterHUD(rosterContainer, {
        rosterIcon: '/icon.svg'
      });

      const listeners = new Set<(open: boolean) => void>();
      const bridge = {
        openRosterView: vi.fn(() => {
          for (const listener of listeners) {
            listener(true);
          }
        }),
        closeRosterView: vi.fn(() => {
          for (const listener of listeners) {
            listener(false);
          }
        }),
        onRosterVisibilityChange: vi.fn((listener: (open: boolean) => void) => {
          listeners.add(listener);
          listener(false);
          return () => {
            listeners.delete(listener);
          };
        })
      };

      hud.connectPanelBridge(bridge);

      bridge.openRosterView();

      expect(layout.tabs.getActive()).toBe('roster');
      expect(overlay.classList.contains(ROSTER_HUD_OPEN_CLASS)).toBe(true);

      bridge.closeRosterView();

      expect(overlay.classList.contains(ROSTER_HUD_OPEN_CLASS)).toBe(false);

      hud.destroy();
    } finally {
      overlay.remove();
    }
  });

  it('keeps the roster overlay closed by default and follows bridge visibility changes', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    try {
      const layout = ensureHudLayout(overlay);
      const rosterContainer = layout.tabs.panels.roster;
      const hud = setupRosterHUD(rosterContainer, {
        rosterIcon: '/icon.svg'
      });

      let rosterListener: ((open: boolean) => void) | null = null;
      const detach = vi.fn();
      const bridge = {
        openRosterView: vi.fn(),
        closeRosterView: vi.fn(),
        onRosterVisibilityChange: vi.fn((listener: (open: boolean) => void) => {
          rosterListener = listener;
          listener(false);
          return detach;
        })
      };

      hud.connectPanelBridge(bridge);

      expect(overlay.classList.contains('roster-hud-open')).toBe(false);
      expect(rosterContainer.hidden).toBe(true);

      rosterListener?.(true);

      expect(overlay.classList.contains('roster-hud-open')).toBe(true);
      expect(rosterContainer.hidden).toBe(false);

      rosterListener?.(false);

      expect(overlay.classList.contains('roster-hud-open')).toBe(false);
      expect(rosterContainer.hidden).toBe(true);
      expect(detach).not.toHaveBeenCalled();

      hud.destroy();
    } finally {
      overlay.remove();
    }
  });

  it('opens and closes the roster overlay when programmatic events fire', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    try {
      const layout = ensureHudLayout(overlay);
      const rosterContainer = layout.tabs.panels.roster;
      const hud = setupRosterHUD(rosterContainer, {
        rosterIcon: '/icon.svg'
      });

      let rosterVisibility: ((open: boolean) => void) | null = null;
      const bridge = {
        openRosterView: vi.fn(() => {
          rosterVisibility?.(true);
        }),
        closeRosterView: vi.fn(() => {
          rosterVisibility?.(false);
        }),
        onRosterVisibilityChange: vi.fn((listener: (open: boolean) => void) => {
          rosterVisibility = listener;
          listener(false);
          return () => {
            if (rosterVisibility === listener) {
              rosterVisibility = null;
            }
          };
        })
      };

      hud.connectPanelBridge(bridge);

      expect(overlay.classList.contains('roster-hud-open')).toBe(false);

      rosterVisibility?.(true);

      expect(overlay.classList.contains('roster-hud-open')).toBe(true);

      rosterVisibility?.(false);

      expect(overlay.classList.contains('roster-hud-open')).toBe(false);

      hud.destroy();
    } finally {
      overlay.remove();
    }
  });

  it('collapses the roster overlay when the right panel close control is clicked', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    document.body.appendChild(overlay);

    const originalMatchMedia = window.matchMedia;
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

    let hud: ReturnType<typeof setupRosterHUD> | null = null;
    let controller: ReturnType<typeof setupRightPanel> | null = null;

    try {
      const layout = ensureHudLayout(overlay);
      const rosterHudContainer = document.createElement('div');
      rosterHudContainer.id = 'roster-hud-spec';
      layout.anchors.topLeftCluster.appendChild(rosterHudContainer);

      hud = setupRosterHUD(rosterHudContainer, { rosterIcon: '/icon.svg' });
      const state = new GameState(1000);
      controller = setupRightPanel(state);

      hud.connectPanelBridge(controller);
      controller.openRosterView();

      const closeButton = overlay.querySelector<HTMLButtonElement>('[data-panel-action="close-roster"]');
      expect(closeButton).not.toBeNull();
      expect(closeButton?.getAttribute('aria-label')).toBe('Close roster command console');
      expect(closeButton?.dataset.panelOpen).toBe('true');

      expect(overlay.classList.contains(ROSTER_HUD_OPEN_CLASS)).toBe(true);
      expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(false);

      closeButton?.click();

      expect(overlay.classList.contains(ROSTER_HUD_OPEN_CLASS)).toBe(false);
      expect(overlay.classList.contains(HUD_OVERLAY_COLLAPSED_CLASS)).toBe(true);

    } finally {
      controller?.dispose();
      hud?.destroy();
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
      overlay.remove();
    }
  });

  it('notifies behavior changes when the behavior buttons are clicked', () => {
    const container = makeContainer();
    const onBehaviorChange = vi.fn();

    try {
      const hud = setupRosterHUD(container, {
        rosterIcon: '/icon.svg',
        onBehaviorChange
      });

      hud.updateSummary({
        count: 1,
        card: {
          id: 'saunoja-9',
          name: 'Veikko',
          klass: 'Pathfinder',
          traits: [],
          upkeep: 12,
          behavior: 'defend',
          progression: {
            level: 3,
            xp: 300,
            xpIntoLevel: 20,
            xpForNext: 200,
            progress: 20 / 200,
            statBonuses: { vigor: 0, focus: 0, resolve: 0 }
          }
        }
      });

      const rosterRoot = container.querySelector('.sauna-roster');
      const toggle = rosterRoot?.querySelector<HTMLButtonElement>('.sauna-roster__toggle');
      toggle?.click();

      const behaviorGroup = rosterRoot?.querySelector('.saunoja-card__behavior-options');
      expect(behaviorGroup?.getAttribute('aria-disabled')).toBe('false');
      const attackButton = behaviorGroup?.querySelector<HTMLButtonElement>(
        ".saunoja-card__behavior-option[data-behavior='attack']"
      );
      expect(attackButton?.disabled).toBe(false);
      attackButton?.click();

      expect(onBehaviorChange).toHaveBeenCalledWith('saunoja-9', 'attack');
    } finally {
      destroyContainer(container);
    }
  });
});
