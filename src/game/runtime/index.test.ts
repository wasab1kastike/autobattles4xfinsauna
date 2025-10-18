import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configureGameRuntime,
  getActiveSaunaTierId,
  getGameRuntime,
  getGameStateInstance,
  getRosterCapLimit,
  getRosterCapValue,
  getRosterService,
  getSaunaInstance,
  getSaunaTierContextSnapshot,
  setActiveSaunaTier,
  setRosterCapValue
} from './index.ts';
import type { GameRuntimeContext } from './GameRuntime.ts';
import type { GameState } from '../../core/GameState.ts';
import type { HexMap } from '../../hexmap.ts';
import type { InventoryState, EquipAttemptResult, InventoryComparisonContext } from '../../inventory/state.ts';
import type { HexMapRenderer } from '../../render/HexMapRenderer.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { SaunaTierContext, SaunaTierId, SaunaTierChangeContext } from '../../sauna/tiers.ts';
import type { RosterService } from './rosterService.ts';
import type { Unit } from '../../unit/index.ts';
import type { UnitBehavior } from '../../unit/types.ts';
import type { Saunoja, SaunojaItem } from '../../units/saunoja.ts';
import type { EquipmentSlotId } from '../../items/types.ts';
import type { EnemyRampSummary } from '../../ui/topbar.ts';
import type { RosterEntry } from '../../ui/rightPanel.tsx';
import type { PolicyAppliedEvent, PolicyRevokedEvent } from '../../data/policies.ts';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../../events/types.ts';
import type { GameClock } from '../../core/GameClock.ts';

const noop = () => {};

const createStubRosterService = (): RosterService => ({
  loadUnits: vi.fn(() => []),
  saveUnits: vi.fn(),
  isPersonaMissing: vi.fn(() => false),
  refreshPersona: vi.fn(),
  focusSaunoja: vi.fn(() => false),
  focusSaunojaById: vi.fn(() => false),
  deselectAllSaunojas: vi.fn(() => false),
  clearSaunojaSelection: vi.fn(() => false),
  setSelectedCoord: vi.fn(() => false),
  getSelectedCoord: vi.fn(() => null),
  getSelectedUnitId: vi.fn(() => null),
  setSelectedUnitId: vi.fn()
});

const createStubContext = (
  options: {
    state: GameState;
    map: HexMap;
    inventory: InventoryState;
    sauna: Sauna;
    tierContext: SaunaTierContext;
    activeTierId: SaunaTierId;
    updateRosterCap: (value: number, opts?: { persist?: boolean }) => number;
    setActiveTier: (
      tierId: SaunaTierId,
      opts?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
    ) => boolean;
  }
): GameRuntimeContext => ({
  state: options.state,
  units: [] as Unit[],
  getSaunojas: () => [] as Saunoja[],
  getSauna: () => options.sauna,
  map: options.map,
  inventory: options.inventory,
  mapRenderer: {} as HexMapRenderer,
  getUnitById: () => undefined,
  resetHudElapsed: noop,
  notifyHudElapsed: noop,
  notifyEnemyRamp: (_summary: EnemyRampSummary | null) => {},
  syncSelectionOverlay: noop,
  setBehaviorPreference: (_unitId: string, _behavior: UnitBehavior) => true,
  updateRosterDisplay: noop,
  promoteSaunoja: () => true,
  getSelectedInventoryContext: () => null as InventoryComparisonContext | null,
  equipItemToSaunoja: (_unitId: string, _item: SaunojaItem) => ({
    success: true
  }) as EquipAttemptResult,
  equipSlotFromStash: (_unitId: string, _slot: EquipmentSlotId) => false,
  unequipSlotToStash: (_unitId: string, _slot: EquipmentSlotId) => false,
  getTierContext: () => options.tierContext,
  getActiveTierId: () => options.activeTierId,
  setActiveTier: (tierId, opts) => options.setActiveTier(tierId, opts),
  getActiveTierLimit: () => 4,
  updateRosterCap: (value, opts) => options.updateRosterCap(value, opts),
  syncSaunojaRosterWithUnits: () => false,
  startTutorialIfNeeded: noop,
  disposeTutorial: noop,
  getAttachedUnitFor: (_attendant: Saunoja) => null,
  resetUnitVisionSnapshots: noop,
  resetObjectiveTracker: noop,
  resetStrongholdCounter: noop,
  destroyEndScreen: noop,
  persistState: noop,
  persistUnits: noop,
  getPolicyHandlers: () => ({
    onApplied: (_event: PolicyAppliedEvent) => {},
    onRevoked: (_event: PolicyRevokedEvent) => {},
    onLifecycleChanged: noop
  }),
  getUnitEventHandlers: () => ({
    onUnitDied: (_payload: {
      unitId: string;
      attackerId?: string;
      attackerFaction?: string;
      unitFaction: string;
    }) => {},
    onUnitSpawned: (_payload: { unit: Unit }) => {},
    onInventoryChanged: noop,
    onModifierChanged: noop,
    onUnitStatsChanged: noop,
    onSaunaDamaged: (_payload: SaunaDamagedPayload) => {},
    onSaunaDestroyed: (_payload: SaunaDestroyedPayload) => {}
  }),
  getTerrainInvalidator: () => noop,
  getClock: () => ({ now: () => 0 }) as GameClock,
  isGamePaused: () => false,
  onPauseChanged: noop,
  updateTopbarHud: (_deltaMs: number) => {},
  updateSaunaHud: noop,
  refreshRosterPanel: (_entries?: RosterEntry[]) => {},
  draw: noop,
  getIdleFrameLimit: () => 10
});

describe('runtime bootstrap', () => {
  const state = {} as GameState;
  const map = {} as HexMap;
  const inventory = {} as InventoryState;
  const sauna = {} as Sauna;
  const tierContext = {} as SaunaTierContext;
  const activeTier = 'starter' as SaunaTierId;
  let updateRosterCap: ReturnType<typeof vi.fn>;
  let setActiveTier: ReturnType<typeof vi.fn>;
  let createContext: ReturnType<typeof vi.fn>;
  let rosterService: RosterService;

  beforeEach(() => {
    updateRosterCap = vi.fn((value: number) => value);
    setActiveTier = vi.fn(() => true);
    rosterService = createStubRosterService();
    const context = createStubContext({
      state,
      map,
      inventory,
      sauna,
      tierContext,
      activeTierId: activeTier,
      updateRosterCap,
      setActiveTier
    });
    createContext = vi.fn(() => context);
    configureGameRuntime({
      createContext,
      rosterService,
      state,
      map,
      inventory,
      getSauna: () => sauna,
      getTierContext: () => tierContext,
      getActiveTierId: () => activeTier,
      getActiveTierLimit: () => 4,
      getRosterCap: () => 7,
      updateRosterCap,
      setActiveTier: (tierId, options) => setActiveTier(tierId, options)
    });
  });

  it('defers runtime creation until first access', () => {
    expect(createContext).not.toHaveBeenCalled();
    const runtime = getGameRuntime();
    expect(createContext).toHaveBeenCalledTimes(1);
    expect(getGameRuntime()).toBe(runtime);
    expect(createContext).toHaveBeenCalledTimes(1);
  });

  it('exposes snapshot helpers derived from bootstrap configuration', () => {
    expect(getGameStateInstance()).toBe(state);
    expect(getSaunaInstance()).toBe(sauna);
    expect(getActiveSaunaTierId()).toBe(activeTier);
    expect(getSaunaTierContextSnapshot()).toBe(tierContext);
    expect(getRosterService()).toBe(rosterService);
    expect(getRosterCapValue()).toBe(7);
    expect(getRosterCapLimit()).toBe(4);
    expect(setRosterCapValue(9)).toBe(9);
    expect(updateRosterCap).toHaveBeenCalledWith(9, {});
    expect(setActiveSaunaTier('next' as SaunaTierId, { persist: true })).toBe(true);
    expect(setActiveTier).toHaveBeenCalledWith('next', { persist: true });
  });
});
