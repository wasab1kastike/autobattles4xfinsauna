import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';
import type { GameController } from '../GameController.ts';
import type { RosterService } from './rosterService.ts';
import type { Saunoja } from '../../units/saunoja.ts';

export interface GameInputHandlerDependencies {
  readonly rosterService: Pick<
    RosterService,
    'setSelectedCoord' | 'deselectAllSaunojas' | 'clearSaunojaSelection' | 'focusSaunoja' | 'focusSaunojaById'
  >;
  syncSelectionOverlay(): void;
  saveUnits(): void;
  updateRosterDisplay(): void;
  invalidateFrame(): void;
  getGameController(): Pick<GameController, 'setupGame' | 'handleCanvasClick'>;
}

export interface GameInputHandlers {
  setSelectedCoord(next: AxialCoord | null): boolean;
  deselectAllSaunojas(except?: Saunoja): boolean;
  clearSaunojaSelection(): boolean;
  focusSaunoja(target: Saunoja): boolean;
  focusSaunojaById(unitId: string): void;
  setupGame(
    canvasEl: HTMLCanvasElement,
    resourceBarEl: HTMLElement,
    overlayEl: HTMLElement
  ): void;
  handleCanvasClick(world: PixelCoord): void;
}

export function createInputHandlers(deps: GameInputHandlerDependencies): GameInputHandlers {
  const setSelectedCoord = (next: AxialCoord | null): boolean => {
    const changed = deps.rosterService.setSelectedCoord(next);
    if (changed) {
      deps.syncSelectionOverlay();
    }
    return changed;
  };

  const deselectAllSaunojas = (except?: Saunoja): boolean => {
    return deps.rosterService.deselectAllSaunojas(except);
  };

  const clearSaunojaSelection = (): boolean => {
    const changed = deps.rosterService.clearSaunojaSelection();
    deps.syncSelectionOverlay();
    return changed;
  };

  const focusSaunoja = (target: Saunoja): boolean => {
    const changed = deps.rosterService.focusSaunoja(target);
    if (changed) {
      deps.syncSelectionOverlay();
    }
    return changed;
  };

  const focusSaunojaById = (unitId: string): void => {
    const changed = deps.rosterService.focusSaunojaById(unitId);
    if (!changed) {
      return;
    }
    deps.syncSelectionOverlay();
    deps.saveUnits();
    deps.updateRosterDisplay();
    deps.invalidateFrame();
  };

  const setupGame = (
    canvasEl: HTMLCanvasElement,
    resourceBarEl: HTMLElement,
    overlayEl: HTMLElement
  ): void => {
    deps.getGameController().setupGame(canvasEl, resourceBarEl, overlayEl);
  };

  const handleCanvasClick = (world: PixelCoord): void => {
    deps.getGameController().handleCanvasClick(world);
  };

  return {
    setSelectedCoord,
    deselectAllSaunojas,
    clearSaunojaSelection,
    focusSaunoja,
    focusSaunojaById,
    setupGame,
    handleCanvasClick
  } satisfies GameInputHandlers;
}
