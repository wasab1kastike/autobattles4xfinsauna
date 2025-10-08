import type { GameState } from '../../core/GameState.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { Saunoja } from '../../units/saunoja.ts';
import type { Unit } from '../../unit/index.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from '../../ui/rightPanel.tsx';
import { setupHudNavigation, type HudNavigationView } from '../../ui/hudNavigation.tsx';
import type { EquipmentSlotId } from '../../items/types.ts';
import type { RosterService } from '../runtime/rosterService.ts';
import type { UnitBehavior } from '../../unit/types.ts';

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
}

export interface RightPanelBridge {
  addEvent: (event: GameEvent) => void;
  changeBehavior: (unitId: string, behavior: UnitBehavior) => void;
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

  const overlay = typeof document !== 'undefined' ? document.getElementById('ui-overlay') : null;
  const navigation = setupHudNavigation(overlay, {
    initialView: 'roster',
    onNavigate: (view) => {
      rightPanel.showView(view);
    }
  });
  const detachViewSync = rightPanel.onViewChange((view: HudNavigationView) => {
    navigation.setActive(view);
  });

  navigation.setActive('roster');
  onRosterRendererReady(rightPanel.renderRoster);

  return {
    addEvent: rightPanel.addEvent,
    changeBehavior: (unitId, behavior) => handleBehaviorChange(deps, unitId, behavior),
    dispose: () => {
      detachViewSync();
      navigation.dispose();
      rightPanel.dispose();
    }
  } satisfies RightPanelBridge;
}
