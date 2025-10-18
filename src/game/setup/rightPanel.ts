import type { GameState } from '../../core/GameState.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { Saunoja, SaunojaClass } from '../../units/saunoja.ts';
import type { Unit } from '../../unit/index.ts';
import {
  setupRightPanel,
  type GameEvent,
  type RosterEntry,
  type RightPanelView
} from '../../ui/rightPanel.tsx';
import { setupHudNavigation, type HudNavigationView } from '../../ui/hudNavigation.tsx';
import { getHudOverlayElement } from '../../ui/layout.ts';
import type { EquipmentSlotId } from '../../items/types.ts';
import type { RosterService } from '../runtime/rosterService.ts';
import type { UnitBehavior } from '../../unit/types.ts';
import { setupPoliciesWindow } from '../../ui/policies/setupPoliciesWindow.ts';

export interface RightPanelDependencies {
  state: GameState;
  sauna: Sauna;
  getSaunojas: () => Saunoja[];
  getAttachedUnitFor: (attendant: Saunoja) => Unit | null;
  focusSaunojaById: (unitId: string) => void;
  equipSlotFromStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  unequipSlotToStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  rosterService: RosterService;
  updateRosterDisplay: () => void;
  getActiveTierLimit: () => number;
  updateRosterCap: (value: number, options?: { persist?: boolean }) => number;
  promoteSaunoja: (unitId: string, klass: SaunojaClass) => boolean;
}

export interface RightPanelBridge {
  addEvent: (event: GameEvent) => void;
  changeBehavior: (unitId: string, behavior: UnitBehavior) => void;
  promote: (unitId: string, klass: SaunojaClass) => void;
  openView: (view: RightPanelView) => void;
  openPoliciesWindow: (options?: { focus?: boolean }) => void;
  closePoliciesWindow: (options?: { restoreFocus?: boolean }) => void;
  onPoliciesVisibilityChange: (listener: (open: boolean) => void) => () => void;
  openRosterView: () => void;
  closeRosterView: () => void;
  onRosterVisibilityChange: (listener: (isOpen: boolean) => void) => () => void;
  dispose: () => void;
}

function handleBehaviorChange(
  deps: RightPanelDependencies,
  unitId: string,
  nextBehavior: UnitBehavior
): void {
  const attendant = deps.getSaunojas().find((unit) => unit.id === unitId);
  if (!attendant) {
    return;
  }
  if (attendant.behavior === nextBehavior) {
    return;
  }
  attendant.behavior = nextBehavior;
  const attachedUnit = deps.getAttachedUnitFor(attendant);
  attachedUnit?.setBehavior(nextBehavior);
  deps.rosterService.saveUnits();
  deps.updateRosterDisplay();
}

export function initializeRightPanel(
  deps: RightPanelDependencies,
  onRosterRendererReady: (renderer: (entries: RosterEntry[]) => void) => void
): RightPanelBridge {
  const rightPanel = setupRightPanel(deps.state, {
    onRosterSelect: deps.focusSaunojaById,
    onRosterRendererReady: (renderer) => {
      onRosterRendererReady(renderer);
    },
    onRosterEquipSlot: deps.equipSlotFromStash,
    onRosterUnequipSlot: deps.unequipSlotToStash,
    onRosterBehaviorChange: (unitId, nextBehavior) => {
      handleBehaviorChange(deps, unitId, nextBehavior);
    },
    onRosterPromote: (unitId, klass) => {
      const promoted = deps.promoteSaunoja(unitId, klass);
      if (promoted) {
        deps.updateRosterDisplay();
      }
    },
    getRosterCap: () => Math.max(0, Math.floor(deps.sauna.maxRosterSize)),
    getRosterCapLimit: () => deps.getActiveTierLimit(),
    updateMaxRosterSize: (value, opts) => {
      const next = deps.updateRosterCap(value, { persist: opts?.persist });
      if (opts?.persist) {
        deps.updateRosterDisplay();
      }
      return next;
    }
  });

  const overlay = getHudOverlayElement();
  const policiesWindow = setupPoliciesWindow(deps.state, { overlay });

  let lastConsoleView: RightPanelView = rightPanel.getActiveView();
  const policiesListeners = new Set<(open: boolean) => void>();

  const notifyPolicies = (open: boolean): void => {
    for (const listener of policiesListeners) {
      try {
        listener(open);
      } catch (error) {
        console.warn('Failed to notify policies visibility listener', error);
      }
    }
  };

  const navigation = setupHudNavigation(overlay, {
    initialView: 'roster',
    onNavigate: (view) => {
      if (view === 'policies') {
        if (policiesWindow.isOpen()) {
          policiesWindow.close();
        } else {
          policiesWindow.open();
        }
        return;
      }
      lastConsoleView = view;
      if (policiesWindow.isOpen()) {
        policiesWindow.close({ restoreFocus: false });
      }
      rightPanel.openView(view);
    }
  });

  const detachViewSync = rightPanel.onViewChange((view: RightPanelView) => {
    lastConsoleView = view;
    if (!policiesWindow.isOpen()) {
      navigation.setActive(view);
    }
  });

  const detachPoliciesSync = policiesWindow.onOpenChange((open) => {
    if (open) {
      navigation.setActive('policies');
    } else {
      navigation.setActive(lastConsoleView);
    }
    notifyPolicies(open);
  });

  navigation.setActive('roster');
  onRosterRendererReady(rightPanel.renderRoster);

  return {
    addEvent: rightPanel.addEvent,
    changeBehavior: (unitId, behavior) => handleBehaviorChange(deps, unitId, behavior),
    promote: (unitId, klass) => {
      const promoted = deps.promoteSaunoja(unitId, klass);
      if (promoted) {
        deps.updateRosterDisplay();
      }
    },
    openView: (view) => {
      lastConsoleView = view;
      if (policiesWindow.isOpen()) {
        policiesWindow.close({ restoreFocus: false });
      }
      rightPanel.openView(view);
      navigation.setActive(view);
    },
    openPoliciesWindow: (options) => {
      policiesWindow.open(options);
    },
    closePoliciesWindow: (options) => {
      policiesWindow.close(options);
    },
    onPoliciesVisibilityChange: (listener) => {
      policiesListeners.add(listener);
      try {
        listener(policiesWindow.isOpen());
      } catch (error) {
        console.warn('Failed to notify policies visibility listener', error);
      }
      return () => {
        policiesListeners.delete(listener);
      };
    },
    openRosterView: () => {
      lastConsoleView = 'roster';
      if (policiesWindow.isOpen()) {
        policiesWindow.close({ restoreFocus: false });
      }
      rightPanel.openRosterView();
      navigation.setActive('roster');
    },
    closeRosterView: () => {
      if (policiesWindow.isOpen()) {
        policiesWindow.close({ restoreFocus: false });
      }
      rightPanel.closeRosterView();
    },
    onRosterVisibilityChange: (listener) => rightPanel.onRosterVisibilityChange(listener),
    dispose: () => {
      detachViewSync();
      detachPoliciesSync();
      navigation.dispose();
      policiesWindow.destroy();
      policiesListeners.clear();
      rightPanel.dispose();
    }
  } satisfies RightPanelBridge;
}
