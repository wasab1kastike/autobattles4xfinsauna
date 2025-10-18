import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUiAdapters, type UiAdapterDependencies } from './uiAdapters.ts';
import type { GameState } from '../../core/GameState.ts';
import type { InventoryState, EquipAttemptResult, InventoryComparisonContext } from '../../inventory/state.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaShopViewModel } from '../../ui/shop/SaunaShopPanel.tsx';
import type { Saunoja, SaunojaItem } from '../../units/saunoja.ts';
import type { RosterService } from './rosterService.ts';

const {
  setupTopbarMock,
  setupActionBarMock,
  setupInventoryHudMock,
  setupSaunaUIMock,
  initializeRightPanelMock,
} = vi.hoisted(() => ({
  setupTopbarMock: vi.fn(() => ({ dispose: vi.fn(), update: vi.fn() })),
  setupActionBarMock: vi.fn(() => ({ destroy: vi.fn() })),
  setupInventoryHudMock: vi.fn(() => ({ destroy: vi.fn() })),
  setupSaunaUIMock: vi.fn(() => ({ dispose: vi.fn(), update: vi.fn() })),
  initializeRightPanelMock: vi.fn(() => ({
    addEvent: vi.fn(),
    changeBehavior: vi.fn(),
    openView: vi.fn(),
    openPoliciesWindow: vi.fn(),
    closePoliciesWindow: vi.fn(),
    onPoliciesVisibilityChange: vi.fn(() => () => {}),
    openRosterView: vi.fn(),
    closeRosterView: vi.fn(),
    onRosterVisibilityChange: vi.fn(() => () => {}),
    dispose: vi.fn()
  })),
}));

vi.mock('../../ui/topbar.ts', () => ({
  setupTopbar: setupTopbarMock,
}));

vi.mock('../../ui/action-bar/index.tsx', () => ({
  setupActionBar: setupActionBarMock,
}));

vi.mock('../../ui/inventoryHud.ts', () => ({
  setupInventoryHud: setupInventoryHudMock,
}));

vi.mock('../../ui/sauna.tsx', () => ({
  setupSaunaUI: setupSaunaUIMock,
}));

vi.mock('../setup/rightPanel.ts', () => ({
  initializeRightPanel: initializeRightPanelMock,
}));

describe('createUiAdapters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createDependencies = (): UiAdapterDependencies => {
    const rosterService = {
      focusSaunoja: vi.fn(),
      focusSaunojaById: vi.fn(),
      deselectAllSaunojas: vi.fn(),
      clearSaunojaSelection: vi.fn(),
      setSelectedCoord: vi.fn(),
      getSelectedCoord: vi.fn(() => null),
      getSelectedUnitId: vi.fn(() => null),
      setSelectedUnitId: vi.fn(),
      loadUnits: vi.fn(() => []),
      saveUnits: vi.fn(),
      isPersonaMissing: vi.fn(() => false),
      refreshPersona: vi.fn(),
    } as unknown as RosterService;

    return {
      state: {} as GameState,
      overlayElement: document.createElement('div'),
      icons: {
        saunakunnia: 'honor',
        sisu: 'sisu',
        saunaBeer: 'beer',
        artocoin: 'coin',
      },
      inventory: {} as InventoryState,
      getSelectedUnitId: vi.fn(() => 'saunoja-1'),
      getComparisonContext: vi.fn(() => null as InventoryComparisonContext | null),
      onEquipItem: vi.fn(() => ({ result: 'success' } as EquipAttemptResult)),
      getSaunaShopViewModel: vi.fn(() => ({ balance: 0, tiers: [] }) as SaunaShopViewModel),
      onPurchaseSaunaTier: vi.fn(() => ({ success: true })),
      subscribeToSaunaShop: vi.fn(() => vi.fn()),
      sauna: { pos: { q: 0, r: 0 } } as Sauna,
      getSaunojas: vi.fn(() => [] as Saunoja[]),
      getAttachedUnitFor: vi.fn(() => null),
      focusSaunojaById: vi.fn(),
      equipSlotFromStash: vi.fn(() => true),
      unequipSlotToStash: vi.fn(() => true),
      rosterService,
      updateRosterDisplay: vi.fn(),
      getActiveTierLimit: vi.fn(() => 6),
      updateRosterCap: vi.fn(() => 6),
    } satisfies UiAdapterDependencies;
  };

  it('produces polished topbar and action bar controllers', () => {
    const deps = createDependencies();
    const adapters = createUiAdapters(deps);

    const controls = adapters.createTopbarControls();
    expect(setupTopbarMock).toHaveBeenCalledWith(deps.state, {
      saunakunnia: 'honor',
      sisu: 'sisu',
      saunaBeer: 'beer',
      artocoin: 'coin',
    });
    expect(controls).toBe(setupTopbarMock.mock.results[0]?.value);

    const actionController = adapters.createActionBarController({
      useSisuBurst: vi.fn(),
      torille: vi.fn(),
    });
    expect(setupActionBarMock).toHaveBeenCalledWith(deps.state, deps.overlayElement, {
      useSisuBurst: expect.any(Function),
      torille: expect.any(Function),
    });
    expect(actionController).toBe(setupActionBarMock.mock.results[0]?.value);
  });

  it('wires inventory hud subscriptions to the sauna shop state', () => {
    const deps = createDependencies();
    const unsubscribe = vi.fn();
    deps.subscribeToSaunaShop = vi.fn(() => unsubscribe);

    const adapters = createUiAdapters(deps);
    adapters.createInventoryHudController();

    const [inventoryState, options] = setupInventoryHudMock.mock.calls[0];
    expect(inventoryState).toBe(deps.inventory);
    expect(options.getSelectedUnitId()).toBe('saunoja-1');

    const listener = vi.fn();
    const result = options.subscribeToSaunaShop(listener);
    expect(deps.subscribeToSaunaShop).toHaveBeenCalledWith(listener);
    expect(result).toBe(unsubscribe);

    const item = { id: 'item-1' } as unknown as SaunojaItem;
    options.onEquip('unit-1', item, 'stash');
    expect(deps.onEquipItem).toHaveBeenCalledWith('unit-1', item);

    expect(typeof options.onRequestRosterExpand).toBe('function');
    expect(typeof options.onRequestRosterCollapse).toBe('function');
    options.onRequestRosterExpand?.();
    options.onRequestRosterCollapse?.();
  });

  it('bridges the right panel with roster updates and polished limits', () => {
    const deps = createDependencies();
    const adapters = createUiAdapters(deps);
    adapters.createInventoryHudController();
    const [, inventoryOptions] = setupInventoryHudMock.mock.calls[0];
    const onRendererReady = vi.fn();

    const bridge = adapters.createRightPanelBridge(onRendererReady);

    expect(initializeRightPanelMock).toHaveBeenCalledTimes(1);
    const [config, callback] = initializeRightPanelMock.mock.calls[0];
    expect(config.rosterService).toBe(deps.rosterService);
    expect(config.updateRosterDisplay).toBe(deps.updateRosterDisplay);
    expect(config.getActiveTierLimit()).toBe(6);
    expect(config.updateRosterCap(8)).toBe(6);
    expect(callback).toBe(onRendererReady);
    expect(bridge).toBe(initializeRightPanelMock.mock.results[0]?.value);

    bridge.openRosterView.mockClear();
    bridge.closeRosterView.mockClear();

    inventoryOptions.onRequestRosterExpand?.();
    expect(bridge.openRosterView).toHaveBeenCalledTimes(1);

    inventoryOptions.onRequestRosterCollapse?.();
    expect(bridge.closeRosterView).toHaveBeenCalledTimes(1);
  });
});
