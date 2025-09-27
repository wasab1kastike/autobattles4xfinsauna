import { describe, expect, it, vi } from 'vitest';
import { initializeClassicHud, initializeModernHud } from './hud.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { RosterEntry } from '../../ui/rightPanel.tsx';
import type { RosterHudSummary } from '../../ui/rosterHUD.ts';
import type { SaunaUIOptions } from '../../ui/sauna.tsx';
import type { Resource } from '../../core/GameState.ts';
import type { EnemyRampSummary } from '../../ui/topbar.ts';

describe('initializeClassicHud', () => {
  it('installs roster renderers and refreshes classic HUD controllers', () => {
    const resourceBarEl = document.createElement('div');
    const rosterEntries: RosterEntry[] = [{} as RosterEntry];
    const rosterSummary = { total: 3 } as unknown as RosterHudSummary;
    const previousDispose = vi.fn();
    const installRenderer = vi.fn();
    const renderRoster = vi.fn();
    const updateSummary = vi.fn();
    const rosterHud = {
      installRenderer,
      renderRoster,
      updateSummary,
      setExpanded: vi.fn(),
      toggleExpanded: vi.fn(),
      destroy: vi.fn()
    };

    let capturedSaunaOptions: SaunaUIOptions | null = null;
    const saunaController = { update: vi.fn(), dispose: vi.fn() };
    const topbarControls = {
      update: vi.fn(),
      setEnemyRampSummary: vi.fn(),
      dispose: vi.fn()
    };
    const actionBarController = { destroy: vi.fn() };
    const inventoryController = { destroy: vi.fn() };
    const addEventSpy = vi.fn();
    const disposeRightPanel = vi.fn();
    const updateRosterDisplay = vi.fn();
    const startTutorialIfNeeded = vi.fn();
    const setActiveTier = vi.fn(() => true);

    const syncRoster = vi.fn();
    const panelRenderer = vi.fn();
    const createRightPanel = vi.fn((onReady: (renderer: (entries: RosterEntry[]) => void) => void) => {
      onReady(panelRenderer);
      return {
        addEvent: addEventSpy,
        dispose: disposeRightPanel
      };
    });

    const result = initializeClassicHud({
      resourceBarEl,
      rosterIcon: 'roster.svg',
      sauna: {} as Sauna,
      previousDisposeRightPanel: previousDispose,
      pendingRosterRenderer: null,
      pendingRosterEntries: rosterEntries,
      pendingRosterSummary: rosterSummary,
      setupRosterHUD: vi.fn(() => rosterHud),
      setupSaunaUi: vi.fn((_sauna, options) => {
        capturedSaunaOptions = options;
        return saunaController;
      }),
      getActiveTierId: () => 'ember-circuit',
      setActiveTier,
      getTierContext: () => null,
      setupTopbar: vi.fn(() => topbarControls),
      setupActionBar: vi.fn(() => actionBarController),
      actionBarAbilities: {},
      setupInventoryHud: vi.fn(() => inventoryController),
      createRightPanel,
      syncSaunojaRosterWithUnits: syncRoster,
      updateRosterDisplay,
      startTutorialIfNeeded
    });

    expect(previousDispose).toHaveBeenCalledTimes(1);
    expect(installRenderer).toHaveBeenCalledTimes(1);
    expect(renderRoster).toHaveBeenCalledWith(rosterEntries);
    expect(updateSummary).toHaveBeenCalledWith(rosterSummary);
    expect(result.pendingRosterEntries).toBeNull();
    expect(result.pendingRosterSummary).toBeNull();
    expect(typeof result.pendingRosterRenderer).toBe('function');
    expect(result.rosterHud).toBe(rosterHud);
    expect(result.saunaUiController).toBe(saunaController);
    expect(result.topbarControls).toBe(topbarControls);
    expect(result.actionBarController).toBe(actionBarController);
    expect(result.inventoryHudController).toBe(inventoryController);
    expect(result.disposeRightPanel).toBe(disposeRightPanel);
    expect(result.addEvent).toBe(addEventSpy);
    expect(result.uiV2RosterController).toBeNull();

    expect(result.pendingRosterRenderer).toBe(panelRenderer);
    expect(createRightPanel).toHaveBeenCalledTimes(1);
    expect(result.postSetup).toBeTypeOf('function');
    result.postSetup?.();
    expect(syncRoster).toHaveBeenCalledTimes(1);
    expect(updateRosterDisplay).toHaveBeenCalledTimes(1);
    expect(startTutorialIfNeeded).toHaveBeenCalledTimes(1);

    capturedSaunaOptions?.setActiveTierId?.('aurora-ward', { persist: true });
    expect(result.saunaUiController?.update).toHaveBeenCalled();
    expect(setActiveTier).toHaveBeenCalledWith('aurora-ward', { persist: true });
    expect(updateRosterDisplay).toHaveBeenCalledTimes(2);
  });
});

describe('initializeModernHud', () => {
  it('creates modern HUD controllers and forwards subscriptions', () => {
    const previousDispose = vi.fn();
    const actionBarController = { destroy: vi.fn() };

    const rosterSummary = {
      getSummary: vi.fn(() => ({} as RosterHudSummary | null)),
      subscribeSummary: vi.fn(() => vi.fn()),
      getEntries: vi.fn(() => [] as RosterEntry[]),
      subscribeEntries: vi.fn(() => vi.fn())
    };

    const rosterController = { dispose: vi.fn(), getSnapshot: vi.fn(), subscribe: vi.fn() };
    const topbarController = { dispose: vi.fn() };
    const inventoryController = { dispose: vi.fn() };
    const logController = { dispose: vi.fn() };
    const saunaController = { dispose: vi.fn() };

    const createRosterController = vi.fn(() => rosterController);
    const createTopbarController = vi.fn(() => topbarController);
    const createInventoryController = vi.fn(() => inventoryController);
    const createLogController = vi.fn(() => logController);
    const createSaunaController = vi.fn(() => saunaController);

    const topbar = {
      getResource: vi.fn((_resource: Resource) => 1),
      subscribeResourceChange: vi.fn((listener: (payload: { resource: Resource; total: number; amount: number }) => void) => {
        listener({ resource: 0 as Resource, total: 0, amount: 0 });
        return vi.fn();
      }),
      getArtocoinBalance: vi.fn(() => 0),
      subscribeArtocoinChange: vi.fn(() => vi.fn()),
      getElapsedMs: vi.fn(() => 0),
      subscribeHudTime: vi.fn(() => vi.fn()),
      getEnemyRamp: vi.fn(() => null as EnemyRampSummary | null),
      subscribeEnemyRamp: vi.fn(() => vi.fn())
    };

    const setupActionBar = vi.fn(() => actionBarController);

    const modernResult = initializeModernHud({
      previousDisposeRightPanel: previousDispose,
      setupActionBar,
      actionBarAbilities: {},
      createRosterController,
      rosterSummary,
      createTopbarController,
      topbar,
      createInventoryController,
      inventory: {
        buildSaunaShopViewModel: vi.fn(() => ({})),
        subscribeToSaunaShop: vi.fn(() => vi.fn()),
        getUseUiV2: vi.fn(() => true),
        setUseUiV2: vi.fn()
      },
      createLogController,
      log: {
        getHistory: vi.fn(() => []),
        subscribe: vi.fn(() => vi.fn())
      },
      createSaunaController,
      sauna: {
        getSauna: vi.fn(() => ({} as Sauna)),
        setupSaunaUi: vi.fn(),
        setExternalController: vi.fn(),
        getActiveTierId: vi.fn(() => 'ember-circuit'),
        setActiveTierId: vi.fn(() => true),
        getTierContext: vi.fn(() => null)
      }
    });

    expect(previousDispose).toHaveBeenCalledTimes(1);
    expect(modernResult.actionBarController).toBe(actionBarController);
    expect(modernResult.uiV2RosterController).toBe(rosterController);
    expect(modernResult.uiV2TopbarController).toBe(topbarController);
    expect(modernResult.uiV2InventoryController).toBe(inventoryController);
    expect(modernResult.uiV2LogController).toBe(logController);
    expect(modernResult.uiV2SaunaController).toBe(saunaController);
    expect(modernResult.disposeRightPanel).toBeNull();
    expect(modernResult.addEvent).toBeTypeOf('function');
    expect(modernResult.pendingRosterRenderer).toBeNull();
    expect(modernResult.pendingRosterEntries).toBeNull();
    expect(modernResult.pendingRosterSummary).toBeNull();
    expect(modernResult.postSetup).toBeUndefined();
    expect(() => modernResult.addEvent({} as never)).not.toThrow();

    expect(createRosterController).toHaveBeenCalledTimes(1);
    expect(createTopbarController).toHaveBeenCalledTimes(1);
    expect(createInventoryController).toHaveBeenCalledTimes(1);
    expect(createLogController).toHaveBeenCalledTimes(1);
    expect(createSaunaController).toHaveBeenCalledTimes(1);
    expect(setupActionBar).toHaveBeenCalledTimes(1);
  });
});
