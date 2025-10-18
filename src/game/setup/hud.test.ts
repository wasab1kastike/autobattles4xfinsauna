import { describe, expect, it, vi } from 'vitest';
import { initializeClassicHud } from './hud.ts';
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
    const connectPanelBridge = vi.fn();
    const rosterHud = {
      installRenderer,
      renderRoster,
      updateSummary,
      setExpanded: vi.fn(),
      toggleExpanded: vi.fn(),
      connectPanelBridge,
      destroy: vi.fn()
    };
    const setupRosterHUD = vi.fn(() => rosterHud);

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
    const changeBehavior = vi.fn();
    const createRightPanel = vi.fn((onReady: (renderer: (entries: RosterEntry[]) => void) => void) => {
      onReady(panelRenderer);
      return {
        addEvent: addEventSpy,
        changeBehavior,
        promote: vi.fn(),
        openView: vi.fn(),
        openRosterView: vi.fn(),
        closeRosterView: vi.fn(),
        onRosterVisibilityChange: vi.fn(() => () => {}),
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
      setupRosterHUD,
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
    expect(result.addEvent).toBe(addEventSpy);

    expect(result.pendingRosterRenderer).toBe(panelRenderer);
    expect(createRightPanel).toHaveBeenCalledTimes(1);
    const hudOptions = setupRosterHUD.mock.calls[0]?.[1];
    expect(typeof hudOptions?.onBehaviorChange).toBe('function');
    hudOptions?.onBehaviorChange?.('alpha', 'attack');
    expect(changeBehavior).toHaveBeenCalledWith('alpha', 'attack');

    const promoteHandler = createRightPanel.mock.results[0]?.value.promote as
      | ((unitId: string, klass: string) => void)
      | undefined;
    expect(typeof hudOptions?.onPromote).toBe('function');
    hudOptions?.onPromote?.('alpha', 'wizard');
    expect(promoteHandler).toHaveBeenCalledWith('alpha', 'wizard');

    changeBehavior.mockClear();
    expect(typeof result.changeBehavior).toBe('function');
    result.changeBehavior?.('alpha', 'attack');
    expect(changeBehavior).toHaveBeenCalledWith('alpha', 'attack');
    changeBehavior.mockClear();
    expect(result.disposeRightPanel).toBeTypeOf('function');
    result.disposeRightPanel?.();
    expect(disposeRightPanel).toHaveBeenCalledTimes(1);
    hudOptions?.onBehaviorChange?.('alpha', 'defend');
    expect(changeBehavior).not.toHaveBeenCalled();

    expect(result.postSetup).toBeTypeOf('function');
    result.postSetup?.();
    expect(syncRoster).toHaveBeenCalledTimes(1);
    expect(updateRosterDisplay).toHaveBeenCalledTimes(1);
    expect(startTutorialIfNeeded).toHaveBeenCalledTimes(1);

    expect(connectPanelBridge).toHaveBeenCalledTimes(1);
    const bridgeArg = connectPanelBridge.mock.calls[0]?.[0];
    const createdPanel = createRightPanel.mock.results[0]?.value;
    expect(bridgeArg).toBeTruthy();
    bridgeArg?.openRosterView();
    bridgeArg?.closeRosterView();
    expect(createdPanel.openRosterView).toHaveBeenCalledTimes(1);
    expect(createdPanel.closeRosterView).toHaveBeenCalledTimes(1);

    capturedSaunaOptions?.setActiveTierId?.('aurora-ward', { persist: true });
    expect(result.saunaUiController?.update).toHaveBeenCalled();
    expect(setActiveTier).toHaveBeenCalledWith('aurora-ward', { persist: true });
    expect(updateRosterDisplay).toHaveBeenCalledTimes(2);
  });
});

