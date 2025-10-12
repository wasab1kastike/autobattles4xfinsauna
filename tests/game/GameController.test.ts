import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameController, type GameControllerDependencies } from '../../src/game/GameController.ts';
import { EventBus } from '../../src/events/EventBus.ts';
import type { GameRuntime } from '../../src/game/runtime/GameRuntime.ts';
import type { BattleManager } from '../../src/battle/BattleManager.ts';
import type { HexMap } from '../../src/hexmap.ts';
import type { Animator } from '../../src/render/Animator.ts';
import type { HexMapRenderer } from '../../src/render/HexMapRenderer.ts';
import type { RosterService } from '../../src/game/runtime/rosterService.ts';
import type { Saunoja } from '../../src/units/saunoja.ts';
import type { Unit } from '../../src/unit/index.ts';

interface ControllerSetup {
  controller: GameController;
  runtimeSpies: ReturnType<typeof buildRuntimeSpies>;
  eventBus: EventBus;
  invalidateFrame: ReturnType<typeof vi.fn>;
  resetAutoFrame: ReturnType<typeof vi.fn>;
  mapRendererInvalidate: ReturnType<typeof vi.fn>;
  deps: GameControllerDependencies;
}

function buildRuntimeSpies() {
  return {
    setupGame: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
    handleCanvasClick: vi.fn(),
    markFrameClean: vi.fn(),
    resetIdleFrameCount: vi.fn(),
    getCanvas: vi.fn(() => null),
    markFrameDirty: vi.fn(),
    getCombatAnimations: vi.fn(() => null),
    getUnitFx: vi.fn(() => null)
  };
}

function buildRosterService(): RosterService {
  return {
    getSelectedCoord: vi.fn(() => null),
    setSelectedCoord: vi.fn(),
    deselectAllSaunojas: vi.fn(),
    clearSaunojaSelection: vi.fn(),
    focusSaunoja: vi.fn(),
    setSaunojas: vi.fn(),
    saveUnits: vi.fn(),
    refreshPersona: vi.fn(),
    isPersonaMissing: vi.fn(),
    applySaunoja: vi.fn(),
    forEachSaunoja: vi.fn(),
    getSaunojas: vi.fn(() => [] as Saunoja[]),
    getSelected: vi.fn(() => null),
    getSelectedSaunojas: vi.fn(() => [] as Saunoja[]),
    getSelectedUnit: vi.fn(() => null),
    setRosterEntries: vi.fn(),
    loadUnits: vi.fn(),
    saveRoster: vi.fn(),
    rosterSize: 0
  } as unknown as RosterService;
}

function createController(overrides: Partial<GameControllerDependencies> = {}): ControllerSetup {
  const eventBus = new EventBus();
  const invalidateFrame = vi.fn();
  const resetAutoFrame = vi.fn();
  const runtimeSpies = buildRuntimeSpies();
  const runtime = runtimeSpies as unknown as GameRuntime;
  const mapRendererInvalidate = vi.fn();
  const mapRenderer = { invalidateCache: mapRendererInvalidate } as unknown as HexMapRenderer;
  const rosterService = buildRosterService();

  const deps: GameControllerDependencies = {
    eventBus,
    getGameRuntime: () => runtime,
    invalidateFrame,
    resetAutoFrame,
    notifyHudElapsed: vi.fn(),
    notifyEnemyRamp: vi.fn(),
    setHudElapsedMs: vi.fn(),
    friendlyVisionUnitScratch: [] as Unit[],
    overlaySaunojasScratch: [] as Saunoja[],
    units: [] as Unit[],
    saunojas: [] as Saunoja[],
    saunojaToUnit: new Map<string, string>(),
    unitsById: new Map<string, Unit>(),
    getAttachedUnitFor: () => null,
    getSauna: () => null,
    rosterService,
    render: vi.fn(),
    getAssets: vi.fn(() => null),
    drawSaunojas: vi.fn(),
    createHexMap: () => ({
      forEachTile: () => {}
    }) as unknown as HexMap,
    createAnimator: () => ({}) as Animator,
    createBattleManager: () => ({}) as BattleManager,
    createMapRenderer: () => mapRenderer
  } satisfies GameControllerDependencies;

  const merged = { ...deps, ...overrides };
  const controller = new GameController(merged);

  return {
    controller,
    runtimeSpies,
    eventBus,
    invalidateFrame,
    resetAutoFrame,
    mapRendererInvalidate,
    deps: merged
  };
}

describe('GameController', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('resets HUD state and delegates to runtime during setup', () => {
    const { controller, runtimeSpies, deps } = createController();
    const canvas = {} as HTMLCanvasElement;
    const resourceBar = {} as HTMLElement;
    const overlay = {} as HTMLElement;

    controller.setupGame(canvas, resourceBar, overlay);

    expect(deps.setHudElapsedMs).toHaveBeenCalledWith(0);
    expect(deps.notifyHudElapsed).toHaveBeenCalledTimes(1);
    expect(deps.notifyEnemyRamp).toHaveBeenCalledWith(null);
    expect(runtimeSpies.setupGame).toHaveBeenCalledWith(canvas, resourceBar, overlay);
  });

  it('awaits the runtime when starting', async () => {
    const { controller, runtimeSpies } = createController();

    await controller.start();

    expect(runtimeSpies.start).toHaveBeenCalledTimes(1);
  });

  it('cleans up the runtime and detaches terrain listeners', () => {
    const { controller, runtimeSpies, eventBus, mapRendererInvalidate, invalidateFrame } =
      createController();

    eventBus.emit('buildingPlaced', {});
    expect(mapRendererInvalidate).toHaveBeenCalledTimes(1);
    expect(invalidateFrame).toHaveBeenCalledTimes(1);

    controller.cleanup();

    expect(runtimeSpies.cleanup).toHaveBeenCalledTimes(1);

    mapRendererInvalidate.mockClear();
    invalidateFrame.mockClear();

    eventBus.emit('buildingPlaced', {});
    expect(mapRendererInvalidate).not.toHaveBeenCalled();
    expect(invalidateFrame).not.toHaveBeenCalled();
  });
});
