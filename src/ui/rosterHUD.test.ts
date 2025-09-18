import { describe, expect, it, vi } from 'vitest';
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
          upkeep: 17
        }
      });

      const value = container.querySelector('.sauna-roster__value');
      expect(value?.textContent).toBe('5');
      expect(container.getAttribute('aria-label')).toBe('Saunoja roster: 5 active attendants');
      expect(container.getAttribute('title')).toBe('Saunoja roster • 5 active attendants');

      const card = container.querySelector<HTMLDivElement>('.saunoja-card');
      expect(card?.hidden).toBe(false);
      expect(card?.dataset.unitId).toBe('saunoja-7');

      const name = container.querySelector('.saunoja-card__name');
      expect(name?.textContent).toBe('Aurora Kallio');

      const traits = container.querySelector('.saunoja-card__traits');
      expect(traits?.textContent).toBe('Brave, Sage');
      expect(traits?.title).toBe('Brave, Sage');

      const upkeep = container.querySelector('.saunoja-card__upkeep');
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
        traits: [],
        stats: {
          health: 8,
          maxHealth: 10,
          attackDamage: 3,
          attackRange: 1,
          movementRange: 2
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
});
