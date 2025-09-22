import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Resource } from '../../src/core/GameState.ts';
import type { RosterHudSummary } from '../../src/ui/rosterHUD.ts';
import type { RosterEntry } from '../../src/ui/rightPanel.tsx';
import type { EnemyRampSummary } from '../../src/ui/topbar.ts';
import { eventBus } from '../../src/events';
import { logEvent, clearLogs, getLogHistory, subscribeToLogs } from '../../src/ui/logging.ts';
import type { LogEntry } from '../../src/ui/logging.ts';

type Harness = {
  emitRosterSummary(summary: RosterHudSummary): void;
  emitRosterEntries(entries: RosterEntry[]): void;
  emitHudTime(ms: number): void;
  emitEnemyRamp(summary: EnemyRampSummary | null): void;
  reset(): void;
};

vi.mock('../../src/game.ts', () => {
  const rosterListeners = new Set<(state: { summary: RosterHudSummary; entries: RosterEntry[] }) => void>();
  const topbarListeners = new Set<(
    snapshot: {
      resources: Record<Resource, { total: number; delta: number }>;
      artocoin: { total: number; delta: number };
      elapsedMs: number;
      ramp: EnemyRampSummary | null;
    }
  ) => void>();
  const logListeners = new Set<(entries: LogEntry[]) => void>();

  let currentSummary: RosterHudSummary = { count: 1, card: null };
  let currentEntries: RosterEntry[] = [];
  let currentTime = 0;
  let currentRamp: EnemyRampSummary | null = null;
  const resources: Record<Resource, { total: number; delta: number }> = {
    [Resource.SAUNA_BEER]: { total: 200, delta: 0 },
    [Resource.SAUNAKUNNIA]: { total: 3, delta: 0 },
    [Resource.SISU]: { total: 5, delta: 0 }
  };
  let artocoin = 0;
  let logEntries = getLogHistory();

  subscribeToLogs((change) => {
    if (change.kind === 'append') {
      logEntries = [...logEntries, change.entry];
    } else if (change.kind === 'update') {
      logEntries = logEntries.map((entry) => (entry.id === change.entry.id ? change.entry : entry));
    } else if (change.kind === 'remove') {
      const ids = new Set(change.entries.map((entry) => entry.id));
      logEntries = logEntries.filter((entry) => !ids.has(entry.id));
    }
    for (const listener of logListeners) {
      listener([...logEntries]);
    }
  });

  const topbarSnapshot = () => ({
    resources: {
      [Resource.SAUNA_BEER]: { ...resources[Resource.SAUNA_BEER] },
      [Resource.SAUNAKUNNIA]: { ...resources[Resource.SAUNAKUNNIA] },
      [Resource.SISU]: { ...resources[Resource.SISU] }
    },
    artocoin: { total: artocoin, delta: 0 },
    elapsedMs: currentTime,
    ramp: currentRamp
  });

  const notifyRoster = () => {
    const state = { summary: currentSummary, entries: [...currentEntries] } satisfies {
      summary: RosterHudSummary;
      entries: RosterEntry[];
    };
    for (const listener of rosterListeners) {
      listener(state);
    }
  };

  const notifyTopbar = () => {
    const snapshot = topbarSnapshot();
    for (const listener of topbarListeners) {
      listener(snapshot);
    }
  };

  eventBus.on('resourceChanged', (change: { resource: Resource; total: number; amount: number }) => {
    resources[change.resource] = { total: change.total, delta: change.amount };
    notifyTopbar();
  });

  const rosterController = {
    getSnapshot: () => ({ summary: currentSummary, entries: [...currentEntries] }),
    subscribe(listener: (state: { summary: RosterHudSummary; entries: RosterEntry[] }) => void) {
      rosterListeners.add(listener);
      listener({ summary: currentSummary, entries: [...currentEntries] });
      return () => rosterListeners.delete(listener);
    },
    dispose() {
      rosterListeners.clear();
    }
  } satisfies {
    getSnapshot: () => { summary: RosterHudSummary; entries: RosterEntry[] };
    subscribe(listener: (state: { summary: RosterHudSummary; entries: RosterEntry[] }) => void): () => void;
    dispose(): void;
  };

  const topbarController = {
    getSnapshot: topbarSnapshot,
    subscribe(listener: (snapshot: ReturnType<typeof topbarSnapshot>) => void) {
      topbarListeners.add(listener);
      listener(topbarSnapshot());
      return () => topbarListeners.delete(listener);
    },
    dispose() {
      topbarListeners.clear();
    }
  };

  const logController = {
    getSnapshot: () => [...logEntries],
    subscribe(listener: (entries: LogEntry[]) => void) {
      logListeners.add(listener);
      listener([...logEntries]);
      return () => logListeners.delete(listener);
    },
    dispose() {
      logListeners.clear();
    }
  };

  const saunaController = {
    mount(container: HTMLElement) {
      container.dataset.saunaMounted = 'true';
    },
    unmount(container: HTMLElement) {
      container.innerHTML = '';
      delete container.dataset.saunaMounted;
    },
    dispose() {}
  };

  const inventoryController = {
    getSnapshot: () => ({ saunaShop: { balance: artocoin, tiers: [] }, useUiV2: false }),
    subscribe: () => () => {},
    setUseUiV2: () => {},
    dispose: () => {}
  };

  const harness: Harness = {
    emitRosterSummary(summary) {
      currentSummary = summary;
      notifyRoster();
    },
    emitRosterEntries(entries) {
      currentEntries = [...entries];
      notifyRoster();
    },
    emitHudTime(ms) {
      currentTime = ms;
      notifyTopbar();
    },
    emitEnemyRamp(summary) {
      currentRamp = summary;
      notifyTopbar();
    },
    reset() {
      currentSummary = { count: 1, card: null };
      currentEntries = [];
      currentTime = 0;
      currentRamp = null;
      resources[Resource.SAUNA_BEER] = { total: 200, delta: 0 };
      resources[Resource.SAUNAKUNNIA] = { total: 3, delta: 0 };
      resources[Resource.SISU] = { total: 5, delta: 0 };
      artocoin = 0;
      logEntries = getLogHistory();
      notifyRoster();
      notifyTopbar();
      for (const listener of logListeners) {
        listener([...logEntries]);
      }
    }
  };

  return {
    getGameStateInstance: () => ({
      getResource: (resource: Resource) => resources[resource].total
    }),
    getRosterSummarySnapshot: () => currentSummary,
    getRosterEntriesSnapshot: () => [...currentEntries],
    getRosterCapValue: () => 6,
    getRosterCapLimit: () => 12,
    setRosterCapValue: (value: number) => value,
    getHudElapsedMs: () => currentTime,
    getEnemyRampSummarySnapshot: () => currentRamp,
    getUiV2TopbarController: () => topbarController,
    getUiV2RosterController: () => rosterController,
    getUiV2LogController: () => logController,
    getUiV2SaunaController: () => saunaController,
    getUiV2InventoryController: () => inventoryController,
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
