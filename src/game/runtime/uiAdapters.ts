import type { GameState } from '../../core/GameState.ts';
import type { EquipmentSlotId } from '../../items/types.ts';
import type {
  EquipAttemptResult,
  InventoryState,
  InventoryComparisonContext
} from '../../inventory/state.ts';
import type { PurchaseSaunaTierResult } from '../../progression/saunaShop.ts';
import type {
  LootUpgradeId,
  PurchaseLootUpgradeResult
} from '../../progression/lootUpgrades.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaShopListener } from '../saunaShopState.ts';
import type { SaunaShopViewModel } from '../../ui/shop/SaunaShopPanel.tsx';
import type { SaunaTierId } from '../../sauna/tiers.ts';
import type { Saunoja, SaunojaItem } from '../../units/saunoja.ts';
import type { Unit } from '../../unit/index.ts';
import type { RosterService } from './rosterService.ts';
import type { SaunaUIController, SaunaUIOptions } from '../../ui/sauna.tsx';
import type { ActionBarAbilityHandlers, ActionBarController } from '../../ui/action-bar/index.tsx';
import type { TopbarControls } from '../../ui/topbar.ts';
import type { RightPanelBridge } from '../setup/rightPanel.ts';
import type { RosterEntry } from '../../ui/rightPanel.tsx';

import { setupActionBar } from '../../ui/action-bar/index.tsx';
import { setupTopbar } from '../../ui/topbar.ts';
import { setupInventoryHud } from '../../ui/inventoryHud.ts';
import { setupSaunaUI } from '../../ui/sauna.tsx';
import { initializeRightPanel } from '../setup/rightPanel.ts';

export type InventoryHudController = { destroy(): void };

export interface HudIconSet {
  readonly saunakunnia: string;
  readonly sisu: string;
  readonly saunaBeer: string;
  readonly artocoin: string;
}

export interface UiAdapterDependencies {
  readonly state: GameState;
  readonly overlayElement: HTMLElement;
  readonly icons: HudIconSet;
  readonly inventory: InventoryState;
  readonly getSelectedUnitId: () => string | null;
  readonly getComparisonContext: () => InventoryComparisonContext | null;
  readonly onEquipItem: (unitId: string, item: SaunojaItem) => EquipAttemptResult;
  readonly getSaunaShopViewModel: () => SaunaShopViewModel;
  readonly onPurchaseSaunaTier: (tierId: SaunaTierId) => PurchaseSaunaTierResult;
  readonly onPurchaseLootUpgrade: (upgradeId: LootUpgradeId) => PurchaseLootUpgradeResult;
  readonly subscribeToSaunaShop: (listener: SaunaShopListener) => () => void;
  readonly sauna: Sauna;
  readonly getSaunojas: () => Saunoja[];
  readonly getAttachedUnitFor: (attendant: Saunoja) => Unit | null;
  readonly focusSaunojaById: (unitId: string) => void;
  readonly equipSlotFromStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  readonly unequipSlotToStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  readonly rosterService: RosterService;
  readonly updateRosterDisplay: () => void;
  readonly getActiveTierLimit: () => number;
  readonly updateRosterCap: (value: number, options?: { persist?: boolean }) => number;
}

export interface HudUiAdapters {
  readonly createTopbarControls: () => TopbarControls;
  readonly createActionBarController: (
    abilities: ActionBarAbilityHandlers
  ) => ActionBarController;
  readonly createSaunaUiController: (
    sauna: Sauna,
    options: SaunaUIOptions
  ) => SaunaUIController;
  readonly createInventoryHudController: () => InventoryHudController;
  readonly createRightPanelBridge: (
    onRosterRendererReady: (renderer: (entries: RosterEntry[]) => void) => void
  ) => RightPanelBridge;
}

export function createUiAdapters(deps: UiAdapterDependencies): HudUiAdapters {
  const rosterPanelControls: { open: () => void; close: () => void } = {
    open: () => {},
    close: () => {}
  };

  const createTopbarControls = (): TopbarControls =>
    setupTopbar(deps.state, {
      saunakunnia: deps.icons.saunakunnia,
      sisu: deps.icons.sisu,
      saunaBeer: deps.icons.saunaBeer,
      artocoin: deps.icons.artocoin
    });

  const createActionBarController = (
    abilities: ActionBarAbilityHandlers
  ): ActionBarController => setupActionBar(deps.state, deps.overlayElement, abilities);

  const createSaunaUiController = (
    sauna: Sauna,
    options: SaunaUIOptions
  ): SaunaUIController => setupSaunaUI(sauna, options);

  const createInventoryHudController = (): InventoryHudController =>
    setupInventoryHud(deps.inventory, {
      getSelectedUnitId: deps.getSelectedUnitId,
      getComparisonContext: deps.getComparisonContext,
      onEquip: (unitId, item, _source) => deps.onEquipItem(unitId, item),
      getSaunaShopViewModel: deps.getSaunaShopViewModel,
      onPurchaseSaunaTier: deps.onPurchaseSaunaTier,
      onPurchaseLootUpgrade: deps.onPurchaseLootUpgrade,
      subscribeToSaunaShop: deps.subscribeToSaunaShop,
      onRequestRosterExpand: () => rosterPanelControls.open(),
      onRequestRosterCollapse: () => rosterPanelControls.close()
    });

  const createRightPanelBridge = (
    onRosterRendererReady: (renderer: (entries: RosterEntry[]) => void) => void
  ): RightPanelBridge => {
    const rightPanel = initializeRightPanel(
      {
        state: deps.state,
        sauna: deps.sauna,
        getSaunojas: deps.getSaunojas,
        getAttachedUnitFor: deps.getAttachedUnitFor,
        focusSaunojaById: deps.focusSaunojaById,
        equipSlotFromStash: deps.equipSlotFromStash,
        unequipSlotToStash: deps.unequipSlotToStash,
        rosterService: deps.rosterService,
        updateRosterDisplay: deps.updateRosterDisplay,
        getActiveTierLimit: deps.getActiveTierLimit,
        updateRosterCap: deps.updateRosterCap
      },
      onRosterRendererReady
    );

    rosterPanelControls.open = () => rightPanel.openRosterView();
    rosterPanelControls.close = () => rightPanel.closeRosterView();

    return rightPanel;
  };

  return {
    createTopbarControls,
    createActionBarController,
    createSaunaUiController,
    createInventoryHudController,
    createRightPanelBridge
  } satisfies HudUiAdapters;
}
