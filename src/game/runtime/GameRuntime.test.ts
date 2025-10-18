import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import type { GameRuntimeContext } from './GameRuntime.ts';
import type { RosterService } from './rosterService.ts';
import type { GameState } from '../../core/GameState.ts';
import type { HexMap } from '../../hexmap.ts';
import type { HexMapRenderer } from '../../render/HexMapRenderer.ts';
import type { InventoryState, EquipAttemptResult, InventoryComparisonContext } from '../../inventory/state.ts';
import type { Saunoja } from '../../units/saunoja.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaTierContext, SaunaTierId } from '../../sauna/tiers.ts';
import type { GameClock } from '../../core/GameClock.ts';
import type { Unit } from '../../unit/index.ts';
import type { RosterEntry } from '../../ui/rightPanel.tsx';

const unitFxResults: Array<{
  dispose: ReturnType<typeof vi.fn>;
  setBehaviorChangeHandler: ReturnType<typeof vi.fn>;
}> = [];
const hudResults: Array<ReturnType<typeof createHudResult>> = [];
const uiAdapterCalls: Array<{ deps: any; result: any }> = [];

const createHudResult = () => {
  const rosterHud = {
    destroy: vi.fn(),
    installRenderer: vi.fn(),
    renderRoster: vi.fn(),
    updateSummary: vi.fn(),
    connectPanelBridge: vi.fn(),
  };
  const saunaUiController = {
    dispose: vi.fn(),
    update: vi.fn(),
    handleDamage: vi.fn(),
    handleDestroyed: vi.fn(),
  };
  const topbarControls = {
    dispose: vi.fn(),
    update: vi.fn(),
  };
  const actionBarController = {
    destroy: vi.fn(),
  };
  const inventoryHudController = {
    destroy: vi.fn(),
  };
  const disposeRightPanel = vi.fn();
  const addEvent = vi.fn();
  const postSetup = vi.fn();
  const changeBehavior = vi.fn();

  return {
    rosterHud,
    pendingRosterRenderer: null,
    pendingRosterEntries: null,
    pendingRosterSummary: null,
    saunaUiController,
    topbarControls,
    actionBarController,
    inventoryHudController,
    disposeRightPanel,
    addEvent,
    postSetup,
    changeBehavior,
  };
};

const createUiAdaptersMock = vi.fn((deps: unknown) => {
  const result = {
    createTopbarControls: vi.fn(() => ({ dispose: vi.fn(), update: vi.fn() })),
    createActionBarController: vi.fn(() => ({ destroy: vi.fn() })),
    createSaunaUiController: vi.fn(() => ({ dispose: vi.fn(), update: vi.fn() })),
    createInventoryHudController: vi.fn(() => ({ destroy: vi.fn() })),
    createRightPanelBridge: vi.fn(() => ({
      addEvent: vi.fn(),
      dispose: vi.fn(),
      changeBehavior: vi.fn(),
      openView: vi.fn(),
      openPoliciesWindow: vi.fn(),
      closePoliciesWindow: vi.fn(),
      onPoliciesVisibilityChange: vi.fn(() => () => {}),
      openRosterView: vi.fn(),
      closeRosterView: vi.fn(),
      onRosterVisibilityChange: vi.fn(() => () => {}),
    })),
  };
  uiAdapterCalls.push({ deps, result });
  return result;
});

vi.mock('../../render/unit_fx.ts', () => ({
  createUnitFxManager: vi.fn(() => {
    const instance = {
      dispose: vi.fn(),
      setBehaviorChangeHandler: vi.fn(),
      step: vi.fn(),
      getShakeOffset: vi.fn(() => ({ x: 0, y: 0 })),
      getUnitAlpha: vi.fn(() => 1),
      beginStatusFrame: vi.fn(),
      pushUnitStatus: vi.fn(),
      pushSaunaStatus: vi.fn(),
      commitStatusFrame: vi.fn(),
      setSelection: vi.fn()
    };
    unitFxResults.push({
      dispose: instance.dispose,
      setBehaviorChangeHandler: instance.setBehaviorChangeHandler
    });
    return instance;
  })
}));

vi.mock('../../render/combatAnimations.ts', () => ({
  createUnitCombatAnimator: vi.fn(() => ({ dispose: vi.fn() })),
}));

vi.mock('../setup/hud.ts', () => ({
  initializeClassicHud: vi.fn(() => {
    const result = createHudResult();
    hudResults.push(result);
    return result;
  }),
}));

const resetGamePauseMock = vi.fn();
vi.mock('../pause.ts', () => ({
  resetGamePause: resetGamePauseMock,
}));

const eventBusOnMock = vi.fn();
const eventBusOffMock = vi.fn();
vi.mock('../../events', () => ({
  eventBus: {
    on: eventBusOnMock,
    off: eventBusOffMock,
  },
}));

const getArtocoinBalanceMock = vi.fn(() => 42);
const subscribeToSaunaShopMock = vi.fn(() => vi.fn());
vi.mock('../saunaShopState.ts', () => ({
  getArtocoinBalance: getArtocoinBalanceMock,
  subscribeToSaunaShop: subscribeToSaunaShopMock,
}));

const evaluateSaunaTierMock = vi.fn(() => 'available');
const listSaunaTiersMock = vi.fn(() => [{ id: 'tier-1' }, { id: 'tier-2' }]);
const getSaunaTierMock = vi.fn((tierId: SaunaTierId) => ({ id: tierId }));
vi.mock('../../sauna/tiers.ts', () => ({
  evaluateSaunaTier: evaluateSaunaTierMock,
  listSaunaTiers: listSaunaTiersMock,
  getSaunaTier: getSaunaTierMock,
}));

const purchaseSaunaTierMock = vi.fn(() => ({ success: true }));
vi.mock('../../progression/saunaShop.ts', () => ({
  purchaseSaunaTier: purchaseSaunaTierMock,
}));

vi.mock('../../audio/sfx.ts', () => ({
  playSafe: vi.fn(),
}));

const useSisuBurstMock = vi.fn(() => true);
const torilleMock = vi.fn(() => true);
vi.mock('../../sisu/burst.ts', () => ({
  useSisuBurst: useSisuBurstMock,
  torille: torilleMock,
  SISU_BURST_COST: 5,
  TORILLE_COST: 8,
}));

vi.mock('../../ui/logging.ts', () => ({
  logEvent: vi.fn(),
}));

vi.mock('./uiAdapters.ts', () => ({
  createUiAdapters: createUiAdaptersMock,
}));

vi.mock('../../ui/rosterHUD.ts', () => ({
  setupRosterHUD: vi.fn(() => ({
    destroy: vi.fn(),
    installRenderer: vi.fn(),
    renderRoster: vi.fn(),
    updateSummary: vi.fn(),
  })),
}));

const getAssetsMock = vi.fn(() => ({ images: {}, sounds: {}, atlases: { units: null } }));
vi.mock('../../game/assets.ts', () => ({
  getAssets: getAssetsMock,
  uiIcons: {
    resource: 'resource-icon',
    sisu: 'sisu-icon',
    saunaBeer: 'beer-icon',
    artocoin: 'coin-icon',
    saunojaRoster: 'roster-icon',
  },
}));

const policyEvents = { APPLIED: 'policy:applied', REVOKED: 'policy:revoked' } as const;
vi.mock('../../data/policies.ts', () => ({
  POLICY_EVENTS: policyEvents,
}));

const { GameRuntime } = await import('./GameRuntime.ts');

describe('GameRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unitFxResults.length = 0;
    hudResults.length = 0;
    uiAdapterCalls.length = 0;
    vi.useFakeTimers();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: vi.fn(() => null),
    });
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      const id = window.setTimeout(() => cb(performance.now()), 0);
      return id;
    };
    globalThis.cancelAnimationFrame = (id: number): void => {
      window.clearTimeout(id);
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createRosterService = (): RosterService => ({
    loadUnits: vi.fn(() => []),
    saveUnits: vi.fn(),
    isPersonaMissing: vi.fn(() => false),
    refreshPersona: vi.fn(),
    focusSaunoja: vi.fn(() => true),
    focusSaunojaById: vi.fn(() => true),
    deselectAllSaunojas: vi.fn(() => false),
    clearSaunojaSelection: vi.fn(() => false),
    setSelectedCoord: vi.fn(() => false),
    getSelectedCoord: vi.fn(() => null),
    getSelectedUnitId: vi.fn(() => null),
    setSelectedUnitId: vi.fn(),
  });

  const createContext = (runtimeRef: () => GameRuntime): GameRuntimeContext => {
    const policyHandlers = {
      onApplied: vi.fn(),
      onRevoked: vi.fn(),
      onLifecycleChanged: vi.fn(),
    };
    const unitHandlers = {
      onUnitDied: vi.fn(),
      onUnitSpawned: vi.fn(),
      onInventoryChanged: vi.fn(),
      onModifierChanged: vi.fn(),
      onUnitStatsChanged: vi.fn(),
      onSaunaDamaged: vi.fn(),
      onSaunaDestroyed: vi.fn(),
    };
    const terrainInvalidator = vi.fn();
    const clockTick = vi.fn();

    const context: GameRuntimeContext = {
      state: {} as GameState,
      units: [] as Unit[],
      getSaunojas: () => [] as Saunoja[],
      getSauna: () => ({ pos: { q: 0, r: 0 } }) as Sauna,
      map: { hexSize: 2 } as unknown as HexMap,
      inventory: {} as InventoryState,
      mapRenderer: {} as HexMapRenderer,
      getUnitById: vi.fn(() => undefined),
      resetHudElapsed: vi.fn(),
      notifyHudElapsed: vi.fn(),
      notifyEnemyRamp: vi.fn(),
      syncSelectionOverlay: vi.fn(),
      setBehaviorPreference: vi.fn(() => true),
      updateRosterDisplay: vi.fn(),
      getSelectedInventoryContext: vi.fn(() => null as InventoryComparisonContext | null),
      equipItemToSaunoja: vi.fn(() => ({ result: 'ok' } as EquipAttemptResult)),
      equipSlotFromStash: vi.fn(() => true),
      unequipSlotToStash: vi.fn(() => true),
      getTierContext: vi.fn(() => ({}) as SaunaTierContext),
      getActiveTierId: vi.fn(() => 'tier-1' as SaunaTierId),
      setActiveTier: vi.fn(() => true),
      getActiveTierLimit: vi.fn(() => 6),
      updateRosterCap: vi.fn(() => 6),
      syncSaunojaRosterWithUnits: vi.fn(() => true),
      startTutorialIfNeeded: vi.fn(),
      disposeTutorial: vi.fn(),
      getAttachedUnitFor: vi.fn(() => null as Unit | null),
      resetUnitVisionSnapshots: vi.fn(),
      resetObjectiveTracker: vi.fn(),
      resetStrongholdCounter: vi.fn(),
      destroyEndScreen: vi.fn(),
      persistState: vi.fn(),
      persistUnits: vi.fn(),
      getPolicyHandlers: vi.fn(() => policyHandlers),
      getUnitEventHandlers: vi.fn(() => unitHandlers),
      getTerrainInvalidator: vi.fn(() => terrainInvalidator),
      getClock: vi.fn(() => ({ tick: clockTick } as unknown as GameClock)),
      isGamePaused: vi.fn(() => true),
      onPauseChanged: vi.fn(),
      updateTopbarHud: vi.fn(),
      updateSaunaHud: vi.fn(),
      refreshRosterPanel: vi.fn((entries?: RosterEntry[]) => entries),
      draw: vi.fn(() => runtimeRef().markFrameClean()),
      getIdleFrameLimit: vi.fn(() => 2),
    } satisfies GameRuntimeContext;

    return context;
  };

  it('rebuilds HUD controllers and keeps the overlay polished on setup', () => {
    let runtime!: GameRuntime;
    const context = createContext(() => runtime);
    const rosterService = createRosterService();
    runtime = new GameRuntime(context, rosterService);

    const canvas = document.createElement('canvas');
    const resourceBar = document.createElement('div');
    const overlay = document.createElement('div');

    runtime.setupGame(canvas, resourceBar, overlay);

    expect(overlay.dataset.hudVariant).toBe('classic');
    expect(context.resetHudElapsed).toHaveBeenCalledTimes(1);
    expect(context.notifyHudElapsed).toHaveBeenCalledTimes(1);
    expect(context.notifyEnemyRamp).toHaveBeenCalledWith(null);
    expect(hudResults[0]?.postSetup).toHaveBeenCalled();
    expect(uiAdapterCalls[0]?.deps.overlayElement).toBe(overlay);

    runtime.setupGame(canvas, resourceBar, overlay);

    const firstHud = hudResults[0];
    expect(firstHud?.rosterHud.destroy).toHaveBeenCalled();
    expect(firstHud?.saunaUiController.dispose).toHaveBeenCalled();
    expect(firstHud?.topbarControls.dispose).toHaveBeenCalled();
    expect(firstHud?.actionBarController.destroy).toHaveBeenCalled();
    expect(firstHud?.inventoryHudController.destroy).toHaveBeenCalled();

    const firstUnitFx = unitFxResults[0];
    expect(firstUnitFx.dispose).toHaveBeenCalled();
    expect(unitFxResults[1]).toBeDefined();
  });

  it('bridges behavior changes from the mini HUD to the right panel', () => {
    let runtime!: GameRuntime;
    const context = createContext(() => runtime);
    const rosterService = createRosterService();
    runtime = new GameRuntime(context, rosterService);

    const canvas = document.createElement('canvas');
    const resourceBar = document.createElement('div');
    const overlay = document.createElement('div');

    runtime.setupGame(canvas, resourceBar, overlay);

    const latestUnitFx = unitFxResults.at(-1);
    expect(latestUnitFx?.setBehaviorChangeHandler).toHaveBeenCalled();
    const behaviorHandlerCalls = latestUnitFx?.setBehaviorChangeHandler.mock.calls ?? [];
    const initialBehaviorFn = behaviorHandlerCalls[0]?.[0];
    expect(typeof initialBehaviorFn).toBe('function');
    const behaviorFn = behaviorHandlerCalls[1]?.[0];
    expect(typeof behaviorFn).toBe('function');

    const latestHud = hudResults.at(-1);
    context.syncSelectionOverlay.mockClear();
    latestHud?.changeBehavior.mockClear();

    behaviorFn?.('saunoja-1', 'attack');
    expect(context.setBehaviorPreference).toHaveBeenCalledWith('saunoja-1', 'attack');
    expect(latestHud?.changeBehavior).toHaveBeenCalledWith('saunoja-1', 'attack');
    expect(context.syncSelectionOverlay).toHaveBeenCalledTimes(1);
    expect(rosterService.saveUnits).toHaveBeenCalledTimes(1);
    expect(context.updateRosterDisplay).toHaveBeenCalled();

    runtime.getDisposeRightPanel()?.();
    const finalCall = latestUnitFx?.setBehaviorChangeHandler.mock.calls.at(-1);
    expect(typeof finalCall?.[0]).toBe('function');
  });

  it('attaches pause listeners once and cleans up event bus subscriptions on cleanup', async () => {
    let runtime!: GameRuntime;
    const context = createContext(() => runtime);
    runtime = new GameRuntime(context, createRosterService());

    const canvas = document.createElement('canvas');
    const resourceBar = document.createElement('div');
    const overlay = document.createElement('div');
    runtime.setupGame(canvas, resourceBar, overlay);

    await runtime.start();
    await vi.runOnlyPendingTimersAsync();

    expect(eventBusOnMock).toHaveBeenCalledWith('game:pause-changed', context.onPauseChanged);

    await runtime.start();
    await vi.runOnlyPendingTimersAsync();
    expect(eventBusOnMock).toHaveBeenCalledTimes(1);

    runtime.cleanup();

    expect(resetGamePauseMock).toHaveBeenCalled();
    expect(context.persistState).toHaveBeenCalled();
    expect(context.persistUnits).toHaveBeenCalled();
    expect(eventBusOffMock).toHaveBeenCalledWith('game:pause-changed', context.onPauseChanged);
    expect(eventBusOffMock).toHaveBeenCalledWith(policyEvents.APPLIED, expect.any(Function));
    expect(eventBusOffMock).toHaveBeenCalledWith(policyEvents.REVOKED, expect.any(Function));
    expect(context.disposeTutorial).toHaveBeenCalled();

    const latestHud = hudResults.at(-1);
    expect(latestHud?.disposeRightPanel).toHaveBeenCalled();
    expect(latestHud?.inventoryHudController.destroy).toHaveBeenCalled();
    expect(latestHud?.saunaUiController.dispose).toHaveBeenCalled();
    expect(latestHud?.topbarControls.dispose).toHaveBeenCalled();
    expect(latestHud?.actionBarController.destroy).toHaveBeenCalled();
  });
});
