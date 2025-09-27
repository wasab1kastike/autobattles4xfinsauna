import type { Sauna } from '../../sim/sauna.ts';
import type {
  ActionBarAbilityHandlers,
  ActionBarController
} from '../../ui/action-bar/index.tsx';
import type { GameEvent, RosterEntry } from '../../ui/rightPanel.tsx';
import type {
  RosterHudController,
  RosterHudSummary
} from '../../ui/rosterHUD.ts';
import type { SaunaUIController, SaunaUIOptions } from '../../ui/sauna.tsx';
import type { TopbarControls } from '../../ui/topbar.ts';
import type { Resource } from '../../core/GameState.ts';
import type { SaunaTierContext, SaunaTierId } from '../../sauna/tiers.ts';
import type { EnemyRampSummary } from '../../ui/topbar.ts';
import type { UiV2RosterController } from '../../uiV2/rosterController.ts';
import type { UiV2TopbarController } from '../../uiV2/topbarController.ts';
import type { UiV2InventoryController } from '../../uiV2/inventoryController.ts';
import type { UiV2LogController } from '../../uiV2/logController.ts';
import type { UiV2SaunaController } from '../../uiV2/saunaController.ts';

type InventoryHudController = { destroy(): void };

type RightPanelBridge = {
  addEvent: (event: GameEvent) => void;
  dispose: () => void;
};

type SaunaUiFactory = (sauna: Sauna, options: SaunaUIOptions) => SaunaUIController;

type TopbarFactory = () => TopbarControls;

type ActionBarFactory = (abilities: ActionBarAbilityHandlers) => ActionBarController;

type InventoryHudFactory = () => InventoryHudController;

type RightPanelFactory = (
  onRosterRendererReady: (renderer: (entries: RosterEntry[]) => void) => void
) => RightPanelBridge;

type UiV2RosterFactory = (options: {
  getSummary: () => RosterHudSummary | null;
  subscribeSummary: (listener: (summary: RosterHudSummary) => void) => () => void;
  getEntries: () => RosterEntry[];
  subscribeEntries: (listener: (entries: RosterEntry[]) => void) => () => void;
}) => UiV2RosterController;

type UiV2TopbarFactory = (options: {
  getResource: (resource: Resource) => number;
  subscribeResourceChange: (
    listener: (payload: { resource: Resource; total: number; amount: number }) => void
  ) => () => void;
  getArtocoinBalance: () => number;
  subscribeArtocoinChange: (listener: (total: number) => void) => () => void;
  getElapsedMs: () => number;
  subscribeHudTime: (listener: (elapsed: number) => void) => () => void;
  getEnemyRamp: () => EnemyRampSummary | null;
  subscribeEnemyRamp: (listener: (summary: EnemyRampSummary | null) => void) => () => void;
}) => UiV2TopbarController;

type UiV2InventoryFactory = (options: {
  buildSaunaShopViewModel: () => unknown;
  subscribeToSaunaShop: (listener: () => void) => () => void;
  getUseUiV2: () => boolean;
  setUseUiV2: (next: boolean) => void;
}) => UiV2InventoryController;

type UiV2LogFactory = (options: {
  getHistory: () => unknown[];
  subscribe: (listener: (history: unknown[]) => void) => () => void;
}) => UiV2LogController;

type UiV2SaunaFactory = (options: {
  getSauna: () => Sauna;
  setupSaunaUi: SaunaUiFactory;
  setExternalController: (controller: SaunaUIController | null) => void;
  getActiveTierId: () => SaunaTierId;
  setActiveTierId: (tierId: SaunaTierId, options?: { persist?: boolean }) => boolean;
  getTierContext: () => SaunaTierContext | null;
}) => UiV2SaunaController;

type ClassicHudDependencies = {
  resourceBarEl: HTMLElement;
  rosterIcon: string;
  sauna: Sauna;
  previousDisposeRightPanel: (() => void) | null;
  pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null;
  pendingRosterEntries: RosterEntry[] | null;
  pendingRosterSummary: RosterHudSummary | null;
  setupRosterHUD: (resourceBar: HTMLElement, options: { rosterIcon: string }) => RosterHudController;
  setupSaunaUi: SaunaUiFactory;
  getActiveTierId: () => SaunaTierId;
  setActiveTier: (tierId: SaunaTierId, options?: { persist?: boolean }) => boolean;
  getTierContext: () => SaunaTierContext | null;
  setupTopbar: TopbarFactory;
  setupActionBar: ActionBarFactory;
  actionBarAbilities: ActionBarAbilityHandlers;
  setupInventoryHud: InventoryHudFactory;
  createRightPanel: RightPanelFactory;
  syncSaunojaRosterWithUnits: () => boolean;
  updateRosterDisplay: () => void;
  startTutorialIfNeeded: () => void;
};

type ModernHudDependencies = {
  previousDisposeRightPanel: (() => void) | null;
  setupActionBar: ActionBarFactory;
  actionBarAbilities: ActionBarAbilityHandlers;
  createRosterController: UiV2RosterFactory;
  rosterSummary: {
    getSummary: () => RosterHudSummary | null;
    subscribeSummary: (listener: (summary: RosterHudSummary) => void) => () => void;
    getEntries: () => RosterEntry[];
    subscribeEntries: (listener: (entries: RosterEntry[]) => void) => () => void;
  };
  createTopbarController: UiV2TopbarFactory;
  topbar: {
    getResource: (resource: Resource) => number;
    subscribeResourceChange: (
      listener: (payload: { resource: Resource; total: number; amount: number }) => void
    ) => () => void;
    getArtocoinBalance: () => number;
    subscribeArtocoinChange: (listener: (total: number) => void) => () => void;
    getElapsedMs: () => number;
    subscribeHudTime: (listener: (elapsed: number) => void) => () => void;
    getEnemyRamp: () => EnemyRampSummary | null;
    subscribeEnemyRamp: (listener: (summary: EnemyRampSummary | null) => void) => () => void;
  };
  createInventoryController: UiV2InventoryFactory;
  inventory: {
    buildSaunaShopViewModel: () => unknown;
    subscribeToSaunaShop: (listener: () => void) => () => void;
    getUseUiV2: () => boolean;
    setUseUiV2: (next: boolean) => void;
  };
  createLogController: UiV2LogFactory;
  log: {
    getHistory: () => unknown[];
    subscribe: (listener: (history: unknown[]) => void) => () => void;
  };
  createSaunaController: UiV2SaunaFactory;
  sauna: {
    getSauna: () => Sauna;
    setupSaunaUi: SaunaUiFactory;
    setExternalController: (controller: SaunaUIController | null) => void;
    getActiveTierId: () => SaunaTierId;
    setActiveTierId: (tierId: SaunaTierId, options?: { persist?: boolean }) => boolean;
    getTierContext: () => SaunaTierContext | null;
  };
};

export type HudInitializationResult = {
  rosterHud: RosterHudController | null;
  pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null;
  pendingRosterEntries: RosterEntry[] | null;
  pendingRosterSummary: RosterHudSummary | null;
  saunaUiController: SaunaUIController | null;
  topbarControls: TopbarControls | null;
  actionBarController: ActionBarController | null;
  inventoryHudController: InventoryHudController | null;
  disposeRightPanel: (() => void) | null;
  addEvent: (event: GameEvent) => void;
  uiV2RosterController: UiV2RosterController | null;
  uiV2TopbarController: UiV2TopbarController | null;
  uiV2InventoryController: UiV2InventoryController | null;
  uiV2LogController: UiV2LogController | null;
  uiV2SaunaController: UiV2SaunaController | null;
  postSetup?: () => void;
};

export function initializeClassicHud(deps: ClassicHudDependencies): HudInitializationResult {
  deps.previousDisposeRightPanel?.();

  const rosterHud = deps.setupRosterHUD(deps.resourceBarEl, { rosterIcon: deps.rosterIcon });

  let pendingRosterEntries = deps.pendingRosterEntries;
  let pendingRosterRenderer = deps.pendingRosterRenderer;
  let pendingRosterSummary = deps.pendingRosterSummary;

  if (pendingRosterRenderer) {
    rosterHud.installRenderer(pendingRosterRenderer);
  }

  if (pendingRosterEntries) {
    rosterHud.renderRoster(pendingRosterEntries);
    pendingRosterEntries = null;
  }

  if (pendingRosterSummary) {
    rosterHud.updateSummary(pendingRosterSummary);
    pendingRosterSummary = null;
  }

  const saunaUiController = deps.setupSaunaUi(deps.sauna, {
    getActiveTierId: deps.getActiveTierId,
    setActiveTierId: (tierId, options) => {
      const unlocked = deps.setActiveTier(tierId, options);
      if (unlocked) {
        saunaUiController.update();
        deps.updateRosterDisplay();
      }
      return unlocked;
    },
    getTierContext: deps.getTierContext
  });

  const topbarControls = deps.setupTopbar();
  const actionBarController = deps.setupActionBar(deps.actionBarAbilities);
  const inventoryHudController = deps.setupInventoryHud();

  const handleRosterRendererReady = (renderer: (entries: RosterEntry[]) => void): void => {
    pendingRosterRenderer = renderer;
    rosterHud.installRenderer(renderer);
    if (pendingRosterEntries) {
      rosterHud.renderRoster(pendingRosterEntries);
      pendingRosterEntries = null;
    }
  };

  const rightPanel = deps.createRightPanel(handleRosterRendererReady);

  const postSetup = (): void => {
    deps.syncSaunojaRosterWithUnits();
    deps.updateRosterDisplay();
    deps.startTutorialIfNeeded();
  };

  return {
    rosterHud,
    pendingRosterRenderer,
    pendingRosterEntries,
    pendingRosterSummary,
    saunaUiController,
    topbarControls,
    actionBarController,
    inventoryHudController,
    disposeRightPanel: rightPanel.dispose,
    addEvent: rightPanel.addEvent,
    uiV2RosterController: null,
    uiV2TopbarController: null,
    uiV2InventoryController: null,
    uiV2LogController: null,
    uiV2SaunaController: null,
    postSetup
  };
}

export function initializeModernHud(deps: ModernHudDependencies): HudInitializationResult {
  deps.previousDisposeRightPanel?.();

  const actionBarController = deps.setupActionBar(deps.actionBarAbilities);

  const uiV2RosterController = deps.createRosterController({
    getSummary: deps.rosterSummary.getSummary,
    subscribeSummary: deps.rosterSummary.subscribeSummary,
    getEntries: deps.rosterSummary.getEntries,
    subscribeEntries: deps.rosterSummary.subscribeEntries
  });

  const uiV2TopbarController = deps.createTopbarController({
    getResource: deps.topbar.getResource,
    subscribeResourceChange: deps.topbar.subscribeResourceChange,
    getArtocoinBalance: deps.topbar.getArtocoinBalance,
    subscribeArtocoinChange: deps.topbar.subscribeArtocoinChange,
    getElapsedMs: deps.topbar.getElapsedMs,
    subscribeHudTime: deps.topbar.subscribeHudTime,
    getEnemyRamp: deps.topbar.getEnemyRamp,
    subscribeEnemyRamp: deps.topbar.subscribeEnemyRamp
  });

  const uiV2InventoryController = deps.createInventoryController({
    buildSaunaShopViewModel: deps.inventory.buildSaunaShopViewModel,
    subscribeToSaunaShop: deps.inventory.subscribeToSaunaShop,
    getUseUiV2: deps.inventory.getUseUiV2,
    setUseUiV2: deps.inventory.setUseUiV2
  });

  const uiV2LogController = deps.createLogController({
    getHistory: deps.log.getHistory,
    subscribe: deps.log.subscribe
  });

  const uiV2SaunaController = deps.createSaunaController({
    getSauna: deps.sauna.getSauna,
    setupSaunaUi: deps.sauna.setupSaunaUi,
    setExternalController: deps.sauna.setExternalController,
    getActiveTierId: deps.sauna.getActiveTierId,
    setActiveTierId: deps.sauna.setActiveTierId,
    getTierContext: deps.sauna.getTierContext
  });

  return {
    rosterHud: null,
    pendingRosterRenderer: null,
    pendingRosterEntries: null,
    pendingRosterSummary: null,
    saunaUiController: null,
    topbarControls: null,
    actionBarController,
    inventoryHudController: null,
    disposeRightPanel: null,
    addEvent: () => {},
    uiV2RosterController,
    uiV2TopbarController,
    uiV2InventoryController,
    uiV2LogController,
    uiV2SaunaController,
    postSetup: undefined
  };
}
