import { GameRuntime, type GameRuntimeContext } from './GameRuntime.ts';
import type { GameState } from '../../core/GameState.ts';
import type { HexMap } from '../../hexmap.ts';
import type { InventoryState } from '../../inventory/state.ts';
import type { RosterService } from './rosterService.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaUIController } from '../../ui/sauna.tsx';
import type { SaunaTierContext, SaunaTierId, SaunaTierChangeContext } from '../../sauna/tiers.ts';

export interface GameRuntimeBootstrap {
  createContext(): GameRuntimeContext;
  rosterService: RosterService;
  state: GameState;
  map: HexMap;
  inventory: InventoryState;
  getSauna(): Sauna;
  getTierContext(): SaunaTierContext;
  getActiveTierId(): SaunaTierId;
  getActiveTierLimit(): number;
  getRosterCap(): number;
  updateRosterCap(value: number, options?: { persist?: boolean }): number;
  setActiveTier(
    tierId: SaunaTierId,
    options?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
  ): boolean;
}

let runtimeInstance: GameRuntime | null = null;
let bootstrap: GameRuntimeBootstrap | null = null;

export function configureGameRuntime(next: GameRuntimeBootstrap): void {
  bootstrap = next;
  runtimeInstance = null;
}

function requireBootstrap(): GameRuntimeBootstrap {
  if (!bootstrap) {
    throw new Error('Game runtime has not been configured.');
  }
  return bootstrap;
}

export function createGameRuntime(): GameRuntime {
  const config = requireBootstrap();
  return new GameRuntime(config.createContext(), config.rosterService);
}

export function getGameRuntime(): GameRuntime {
  if (!runtimeInstance) {
    runtimeInstance = createGameRuntime();
  }
  return runtimeInstance;
}

export function setExternalSaunaUiController(controller: SaunaUIController | null): void {
  getGameRuntime().setSaunaUiController(controller);
}

export function getGameStateInstance(): GameState {
  return requireBootstrap().state;
}

export function getHexMap(): HexMap {
  return requireBootstrap().map;
}

export function getInventoryState(): InventoryState {
  return requireBootstrap().inventory;
}

export function getSaunaInstance(): Sauna {
  return requireBootstrap().getSauna();
}

export function getSaunaTierContextSnapshot(): SaunaTierContext {
  return requireBootstrap().getTierContext();
}

export function getActiveSaunaTierId(): SaunaTierId {
  return requireBootstrap().getActiveTierId();
}

export function setActiveSaunaTier(
  tierId: SaunaTierId,
  options: { persist?: boolean } = {}
): boolean {
  return requireBootstrap().setActiveTier(tierId, options);
}

export function getRosterCapValue(): number {
  return requireBootstrap().getRosterCap();
}

export function getRosterCapLimit(): number {
  return requireBootstrap().getActiveTierLimit();
}

export function setRosterCapValue(
  value: number,
  options: { persist?: boolean } = {}
): number {
  return requireBootstrap().updateRosterCap(value, options);
}

export function getRosterService(): RosterService {
  return requireBootstrap().rosterService;
}
