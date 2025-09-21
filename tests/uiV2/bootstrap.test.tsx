import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Resource } from '../../src/core/GameState.ts';
import type { RosterHudSummary } from '../../src/ui/rosterHUD.ts';
import type { RosterEntry } from '../../src/ui/rightPanel.tsx';
import type { EnemyRampSummary } from '../../src/ui/topbar.ts';
import { eventBus } from '../../src/events';
import { logEvent, clearLogs } from '../../src/ui/logging.ts';

type Harness = {
  emitRosterSummary(summary: RosterHudSummary): void;
  emitRosterEntries(entries: RosterEntry[]): void;
  emitHudTime(ms: number): void;
  emitEnemyRamp(summary: EnemyRampSummary | null): void;
  reset(): void;
};

vi.mock('../../src/game.ts', () => {
  const rosterSummaryListeners = new Set<(summary: RosterHudSummary) => void>();
  const rosterEntriesListeners = new Set<(entries: RosterEntry[]) => void>();
  const hudTimeListeners = new Set<(ms: number) => void>();
  const enemyRampListeners = new Set<(summary: EnemyRampSummary | null) => void>();

  let currentSummary: RosterHudSummary = { count: 1, card: null };
  let currentEntries: RosterEntry[] = [];
  let currentTime = 0;
  let currentRamp: EnemyRampSummary | null = null;

  const harness: Harness = {
    emitRosterSummary(summary) {
      currentSummary = summary;
      for (const listener of rosterSummaryListeners) {
        listener(summary);
      }
    },
    emitRosterEntries(entries) {
      currentEntries = entries;
      for (const listener of rosterEntriesListeners) {
        listener(entries);
      }
    },
    emitHudTime(ms) {
      currentTime = ms;
      for (const listener of hudTimeListeners) {
        listener(ms);
      }
    },
    emitEnemyRamp(summary) {
      currentRamp = summary;
      for (const listener of enemyRampListeners) {
        listener(summary);
      }
    },
    reset() {
      rosterSummaryListeners.clear();
      rosterEntriesListeners.clear();
      hudTimeListeners.clear();
      enemyRampListeners.clear();
      currentSummary = { count: 1, card: null };
      currentEntries = [];
      currentTime = 0;
      currentRamp = null;
    }
  };

  return {
    getGameStateInstance: () => ({
      getResource: (resource: Resource) => {
        switch (resource) {
          case Resource.SAUNA_BEER:
            return 200;
          case Resource.SAUNAKUNNIA:
            return 3;
          case Resource.SISU:
            return 5;
          default:
            return 0;
        }
      }
    }),
    subscribeRosterSummary: (listener: (summary: RosterHudSummary) => void) => {
      rosterSummaryListeners.add(listener);
      listener(currentSummary);
      return () => {
        rosterSummaryListeners.delete(listener);
      };
    },
    subscribeRosterEntries: (listener: (entries: RosterEntry[]) => void) => {
      rosterEntriesListeners.add(listener);
      listener([...currentEntries]);
      return () => {
        rosterEntriesListeners.delete(listener);
      };
    },
    subscribeHudTime: (listener: (ms: number) => void) => {
      hudTimeListeners.add(listener);
      listener(currentTime);
      return () => {
        hudTimeListeners.delete(listener);
      };
    },
    subscribeEnemyRamp: (listener: (summary: EnemyRampSummary | null) => void) => {
      enemyRampListeners.add(listener);
      listener(currentRamp);
      return () => {
        enemyRampListeners.delete(listener);
      };
    },
    getHudElapsedMs: () => currentTime,
    getRosterSummarySnapshot: () => currentSummary,
    getRosterEntriesSnapshot: () => [...currentEntries],
    getEnemyRampSummarySnapshot: () => currentRamp,
    getSaunaInstance: () => ({}),
    setExternalSaunaUiController: () => {},
    getActiveSaunaTierId: () => 'tier-1',
    setActiveSaunaTier: () => true,
    getSaunaTierContextSnapshot: () => ({}),
    getRosterCapValue: () => 6,
    getRosterCapLimit: () => 12,
    setRosterCapValue: (value: number) => value,
    __uiV2Test: harness
  };
});

vi.mock('../../src/ui/rosterHUD.ts', () => ({
  setupRosterHUD: (element: HTMLElement) => {
    const counter = document.createElement('div');
    counter.dataset.testid = 'roster-summary-count';
    element.appendChild(counter);
    return {
      updateSummary(summary: RosterHudSummary) {
        counter.textContent = `Roster Count: ${summary.count}`;
      },
      installRenderer: () => {},
      renderRoster(entries: RosterEntry[]) {
        element.dataset.rosterEntries = String(entries.length);
      },
      destroy: () => {}
    };
  }
}));

vi.mock('../../src/ui/panels/RosterPanel.tsx', () => ({
  createRosterPanel: (container: HTMLElement) => ({
    render(entries: RosterEntry[]) {
      container.textContent = `Panel roster: ${entries.length}`;
    }
  })
}));

vi.mock('../../src/ui/sauna.tsx', () => ({
  setupSaunaUI: () => ({
    update: () => {},
    dispose: () => {}
  })
}));

vi.mock('../../src/game/assets.ts', () => ({
  uiIcons: { saunojaRoster: '/icon.svg' }
}));

import { UiV2App } from '../../src/uiV2/UiV2App.tsx';
import { bootstrapUiV2 } from '../../src/uiV2/bootstrap.tsx';
import type { UiV2Handle } from '../../src/uiV2/bootstrap.tsx';

const getHarness = async (): Promise<Harness> => {
  const module = await import('../../src/game.ts');
  return (module as unknown as { __uiV2Test: Harness }).__uiV2Test;
};

describe('UiV2 shell', () => {
  beforeEach(async () => {
    (await getHarness()).reset();
    clearLogs();
    const overlay = document.getElementById('ui-overlay');
    if (overlay) {
      overlay.remove();
    }
  });

  it('renders resources, roster, and logs with live updates', async () => {
    const resourceBar = document.createElement('div');
    resourceBar.id = 'resource-bar';
    document.body.appendChild(resourceBar);

    render(<UiV2App resourceBar={resourceBar} onReturnToClassic={vi.fn()} />);

    expect(screen.queryByText('Sauna Command Uplink')).not.toBeNull();
    const sisuCard = screen.getByText('Sisu').closest('article');
    expect(sisuCard).not.toBeNull();
    expect(sisuCard?.textContent ?? '').toContain('5');

    await act(async () => {
      eventBus.emit('resourceChanged', { resource: Resource.SISU, total: 7, amount: 2 });
    });
    await waitFor(() => expect(sisuCard?.textContent ?? '').toContain('7'));

    const gameHarness = await getHarness();
    await act(async () => {
      gameHarness.emitRosterSummary({ count: 4, card: null });
    });
    await waitFor(() => {
      const summary = screen.getByTestId('roster-summary-count');
      expect(summary.textContent ?? '').toContain('Roster Count: 4');
    });

    await act(async () => {
      gameHarness.emitRosterEntries([
        {
          id: 'unit-1',
          name: 'Test Saunoja',
          upkeep: 1,
          status: 'reserve',
          selected: false,
          traits: [],
          stats: {
            health: 10,
            maxHealth: 10,
            attackDamage: 5,
            attackRange: 1,
            movementRange: 3
          },
          baseStats: {
            health: 10,
            maxHealth: 10,
            attackDamage: 5,
            attackRange: 1,
            movementRange: 3
          },
          progression: {
            level: 1,
            xp: 0,
            xpIntoLevel: 0,
            xpForNext: 10,
            progress: 0,
            statBonuses: { vigor: 0, focus: 0, resolve: 0 }
          },
          equipment: [],
          items: [],
          modifiers: []
        }
      ]);
    });
    await waitFor(() =>
      expect(screen.queryByText('Panel roster: 1')).not.toBeNull()
    );

    await act(async () => {
      logEvent({ type: 'combat', message: 'Steam rising' });
    });
    await waitFor(() => expect(screen.queryByText('Steam rising')).not.toBeNull());
  });

  it('mounts via bootstrap and restores resource bar on destroy', async () => {
    document.body.innerHTML = `
      <div id="ui-overlay"></div>
    `;
    const overlay = document.getElementById('ui-overlay') as HTMLElement;
    const resourceBar = document.createElement('div');
    resourceBar.id = 'resource-bar';
    overlay.appendChild(resourceBar);

    let handle: UiV2Handle;
    await act(async () => {
      handle = bootstrapUiV2({
        overlay,
        resourceBar,
        canvas: document.createElement('canvas'),
        onReturnToClassic: vi.fn()
      });
    });

    await waitFor(() => expect(resourceBar.classList.contains('ui-v2-resource-bar')).toBe(true));

    await act(async () => {
      handle.destroy();
    });

    expect(resourceBar.parentElement).toBe(overlay);
    expect(resourceBar.classList.contains('ui-v2-resource-bar')).toBe(false);
  });
});
