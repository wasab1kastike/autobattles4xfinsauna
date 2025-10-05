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
    postSetup
  };
}
