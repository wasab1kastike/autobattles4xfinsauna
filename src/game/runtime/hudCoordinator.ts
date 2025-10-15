import type { EventBus } from '../../events/EventBus.ts';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../../events/types.ts';
import { getHudElapsedMs, incrementHudElapsedMs, notifyHudElapsed } from '../signals/hud.ts';
import type { RosterEntry } from '../../ui/rightPanel.tsx';
import type { GameRuntime } from './GameRuntime.ts';

export interface HudCoordinatorDependencies {
  getRuntime(): GameRuntime;
  eventBus: EventBus;
  updateRosterDisplay(): void;
  refreshRosterPanel(entries?: RosterEntry[]): void;
}

export interface HudEventHandlers {
  onInventoryChanged(): void;
  onModifierChanged(): void;
  onUnitStatsChanged(): void;
  onSaunaDamaged(payload: SaunaDamagedPayload): void;
  onSaunaDestroyed(payload: SaunaDestroyedPayload): void;
}

export interface HudCoordinator {
  installRosterRenderer(renderer: (entries: RosterEntry[]) => void): void;
  updateSaunaHud(): void;
  updateTopbarHud(deltaMs: number): void;
  getEventHandlers(): HudEventHandlers;
  dispose(): void;
}

export function createHudCoordinator({
  getRuntime,
  eventBus,
  updateRosterDisplay,
  refreshRosterPanel
}: HudCoordinatorDependencies): HudCoordinator {
  const handlers: HudEventHandlers = {
    onInventoryChanged: () => refreshRosterPanel(),
    onModifierChanged: () => refreshRosterPanel(),
    onUnitStatsChanged: () => updateRosterDisplay(),
    onSaunaDamaged: (payload) => {
      getRuntime().getSaunaUiController()?.handleDamage?.(payload);
    },
    onSaunaDestroyed: (payload) => {
      getRuntime().getSaunaUiController()?.handleDestroyed?.(payload);
    }
  };

  eventBus.on('inventoryChanged', handlers.onInventoryChanged);
  eventBus.on('modifierAdded', handlers.onModifierChanged);
  eventBus.on('modifierRemoved', handlers.onModifierChanged);
  eventBus.on('modifierExpired', handlers.onModifierChanged);
  eventBus.on('unit:stats:changed', handlers.onUnitStatsChanged);
  eventBus.on('saunaDamaged', handlers.onSaunaDamaged);
  eventBus.on('saunaDestroyed', handlers.onSaunaDestroyed);

  let disposed = false;

  return {
    installRosterRenderer: (renderer) => {
      const runtime = getRuntime();
      runtime.setPendingRosterRenderer(renderer);
      const rosterHud = runtime.getRosterHud();
      if (!rosterHud) {
        return;
      }
      rosterHud.installRenderer(renderer);
      const pendingEntries = runtime.getPendingRosterEntries();
      if (pendingEntries) {
        rosterHud.renderRoster(pendingEntries);
        runtime.setPendingRosterEntries(null);
      }
    },
    updateSaunaHud: () => {
      getRuntime().getSaunaUiController()?.update?.();
    },
    updateTopbarHud: (deltaMs: number) => {
      if (Number.isFinite(deltaMs) && deltaMs > 0) {
        incrementHudElapsedMs(deltaMs);
      }
      notifyHudElapsed(getHudElapsedMs());
      getRuntime().getTopbarControls()?.update(deltaMs);
    },
    getEventHandlers: () => handlers,
    dispose: () => {
      if (disposed) {
        return;
      }
      disposed = true;
      eventBus.off('inventoryChanged', handlers.onInventoryChanged);
      eventBus.off('modifierAdded', handlers.onModifierChanged);
      eventBus.off('modifierRemoved', handlers.onModifierChanged);
      eventBus.off('modifierExpired', handlers.onModifierChanged);
      eventBus.off('unit:stats:changed', handlers.onUnitStatsChanged);
      eventBus.off('saunaDamaged', handlers.onSaunaDamaged);
      eventBus.off('saunaDestroyed', handlers.onSaunaDestroyed);
    }
  } satisfies HudCoordinator;
}
