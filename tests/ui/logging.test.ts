import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogStore, logEvent, clearLogs, readLogPreferences } from '../../src/ui/logging.ts';
import type { LogChange } from '../../src/ui/logging.ts';
import { setupRightPanel } from '../../src/ui/rightPanel.tsx';
import { GameState } from '../../src/core/GameState.ts';

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const renderShell = () => {
  document.body.innerHTML = `
    <div id="ui-overlay">
      <div class="hud-layout-root" data-hud-root>
        <div class="hud-region hud-top-row" data-hud-region="top">
          <div class="hud-anchor hud-anchor--top-left" data-hud-anchor="top-left-cluster">
            <div id="resource-bar"></div>
          </div>
          <div class="hud-anchor hud-anchor--top-right" data-hud-anchor="top-right-cluster"></div>
        </div>
        <div class="hud-region hud-actions" data-hud-region="left"></div>
        <div class="hud-region hud-content" data-hud-region="content"></div>
        <div class="hud-region hud-right-column" data-hud-region="right"></div>
        <div class="hud-region hud-bottom-row" data-hud-region="bottom">
          <div class="hud-anchor hud-anchor--command-dock" data-hud-anchor="command-dock"></div>
        </div>
      </div>
    </div>
  `;
};

describe('LogStore aggregation', () => {
  it('collapses consecutive spawn entries while tracking names', () => {
    const store = new LogStore({ storage: null, maxEntries: 10 });
    const changes: LogChange[] = [];
    store.subscribe((change) => changes.push(change));

    const first = store.emit({
      type: 'spawn',
      message: 'Our A emerges from the steam.',
      metadata: { unitId: 'a1', unitName: 'Saunoja A' }
    });
    const second = store.emit({
      type: 'spawn',
      message: 'Our B emerges from the steam.',
      metadata: { unitId: 'b2', unitName: 'Saunoja B' }
    });

    expect(first.id).toBe(second.id);
    const history = store.getHistory();
    expect(history).toHaveLength(1);
    const [entry] = history;
    expect(entry.occurrences).toBe(2);
    const names = Array.isArray(entry.metadata?.unitNames) ? entry.metadata?.unitNames : [];
    expect(names).toEqual(expect.arrayContaining(['Saunoja A', 'Saunoja B']));
    expect(changes.some((change) => change.kind === 'update')).toBe(true);
  });
});

describe('right panel log filters', () => {
  beforeEach(() => {
    clearLogs();
    window.localStorage?.clear?.();
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
    renderShell();
  });

  it('toggles log type visibility and persists preferences', async () => {
    const state = new GameState(1000);
    const controller = setupRightPanel(state);

    logEvent({ type: 'combat', message: 'First clash' });
    logEvent({ type: 'loot', message: 'Recovered gear' });

    await settle();

    const logPanel = document.querySelector<HTMLElement>('#right-panel-log');
    expect(logPanel).toBeTruthy();
    expect(logPanel?.classList.contains('panel-log--collapsed')).toBe(false);

    const collapseToggle = document.querySelector<HTMLButtonElement>('.panel-log__toggle');
    expect(collapseToggle?.getAttribute('aria-expanded')).toBe('true');

    const combatEntry = document.querySelector<HTMLElement>(
      '#event-log .panel-log-entry[data-log-type="combat"]'
    );
    const lootEntry = document.querySelector<HTMLElement>(
      '#event-log .panel-log-entry[data-log-type="loot"]'
    );

    expect(combatEntry).toBeTruthy();
    expect(lootEntry).toBeTruthy();
    expect(combatEntry?.hidden).toBe(false);
    expect(lootEntry?.hidden).toBe(false);

    collapseToggle?.click();

    await settle();

    const logBody = document.querySelector<HTMLElement>('#panel-log-body');
    expect(logPanel?.classList.contains('panel-log--collapsed')).toBe(true);
    expect(logBody?.hidden).toBe(true);
    expect(collapseToggle?.getAttribute('aria-expanded')).toBe('false');

    const combatFilter = document.querySelector<HTMLButtonElement>(
      '.log-chip[data-log-filter="combat"]'
    );
    expect(combatFilter).toBeTruthy();
    combatFilter?.click();

    await settle();

    expect(combatEntry?.hidden).toBe(true);
    expect(lootEntry?.hidden).toBe(false);

    const prefs = readLogPreferences();
    expect(prefs.mutedTypes).toContain('combat');
    expect(prefs.isCollapsed).toBe(true);

    controller.dispose();

    renderShell();
    const controllerAgain = setupRightPanel(state);
    await settle();

    const restoredLogPanel = document.querySelector<HTMLElement>('#right-panel-log');
    expect(restoredLogPanel?.classList.contains('panel-log--collapsed')).toBe(true);

    const combatFilterAgain = document.querySelector<HTMLButtonElement>(
      '.log-chip[data-log-filter="combat"]'
    );
    expect(combatFilterAgain?.classList.contains('is-muted')).toBe(true);

    controllerAgain.dispose();
  });
});
