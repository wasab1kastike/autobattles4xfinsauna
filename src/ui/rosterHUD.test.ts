import { describe, expect, it, vi } from 'vitest';
import { ensureHudLayout } from './layout.ts';
import type { RosterEntry } from './rightPanel.tsx';
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
      const hud = setupRosterHUD(container, { rosterIcon: '/icon.svg', summaryLabel: 'Sauna Guard' });

      hud.updateSummary({
        count: 5,
        card: {
          id: 'saunoja-7',
          name: 'Aurora Kallio',
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

      const xpRow = root?.querySelector('.saunoja-card__xp');
      expect(xpRow?.textContent).toContain('40 / 320');

      const callouts = root?.querySelector('.saunoja-card__callouts');
      expect(callouts?.textContent).toContain('+13 Vigor');
      expect(callouts?.textContent).toContain('+7 Focus');
      expect(callouts?.textContent).toContain('+5 Resolve');

      const behavior = root?.querySelector('.saunoja-card__behavior');
      expect(behavior?.textContent).toBe('Behavior: Attack');
      expect(behavior?.title).toBe('Behavior: Attack');

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

  it('expands and collapses when external events fire', () => {
    const overlay = document.createElement('div');
    overlay.id = 'ui-overlay';
    const rosterContainer = document.createElement('div');
    rosterContainer.id = 'resource-bar';
    overlay.appendChild(rosterContainer);
    document.body.appendChild(overlay);

    try {
      ensureHudLayout(overlay);
      const hud = setupRosterHUD(rosterContainer, { rosterIcon: '/icon.svg' });
      hud.updateSummary({
        count: 1,
        card: {
          id: 'saunoja-9',
          name: 'Watcher',
          traits: ['Brave'],
          upkeep: 12,
          behavior: 'defend',
          progression: {
            level: 2,
            xp: 200,
            xpIntoLevel: 20,
            xpForNext: 220,
            progress: 20 / 220,
            statBonuses: { vigor: 4, focus: 2, resolve: 1 },
          },
        },
      });

      rosterContainer.dispatchEvent(
        new CustomEvent('sauna-roster:expand', { bubbles: true })
      );

      const root = rosterContainer.querySelector('.sauna-roster');
      expect(root?.dataset.expanded).toBe('true');

      rosterContainer.dispatchEvent(
        new CustomEvent('sauna-roster:collapse', { bubbles: true })
      );
      expect(root?.dataset.expanded).toBe('false');

      hud.destroy();
    } finally {
      overlay.remove();
    }
  });
});
