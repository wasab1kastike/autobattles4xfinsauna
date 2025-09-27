import type { GameState } from '../../core/GameState.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { Saunoja } from '../../units/saunoja.ts';
import type { Unit } from '../../unit/index.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from '../../ui/rightPanel.tsx';
import type { EquipmentSlotId } from '../../items/types.ts';

export interface RightPanelDependencies {
  state: GameState;
  sauna: Sauna;
  getSaunojas: () => Saunoja[];
  getAttachedUnitFor: (attendant: Saunoja) => Unit | null;
  focusSaunojaById: (unitId: string) => void;
  equipSlotFromStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  unequipSlotToStash: (unitId: string, slot: EquipmentSlotId) => boolean;
  saveUnits: () => void;
  updateRosterDisplay: () => void;
  getActiveTierLimit: () => number;
  updateRosterCap: (value: number, options?: { persist?: boolean }) => number;
}

export interface RightPanelBridge {
  addEvent: (event: GameEvent) => void;
  dispose: () => void;
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
      deps.saveUnits();
      deps.updateRosterDisplay();
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

  onRosterRendererReady(rightPanel.renderRoster);

  return {
    addEvent: rightPanel.addEvent,
    dispose: rightPanel.dispose
  } satisfies RightPanelBridge;
}
