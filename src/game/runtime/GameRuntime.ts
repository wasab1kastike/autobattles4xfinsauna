import type { GameState } from '../../core/GameState.ts';
import type { HexMap } from '../../hexmap.ts';
import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';
import type { Unit } from '../../unit/index.ts';
import type { Saunoja, SaunojaItem } from '../../units/saunoja.ts';
import type { Sauna } from '../../sim/sauna.ts';
import type { EnemyRampSummary } from '../../ui/topbar.ts';
import type { SaunaUIController } from '../../ui/sauna.tsx';
import type { ActionBarAbilityHandlers, ActionBarController } from '../../ui/action-bar/index.tsx';
import type { RosterHudController, RosterHudSummary } from '../../ui/rosterHUD.ts';
import type { GameEvent, RosterEntry } from '../../ui/rightPanel.tsx';
import type { InventoryState, EquipAttemptResult, InventoryComparisonContext } from '../../inventory/state.ts';
import type { EquipmentSlotId } from '../../items/types.ts';
import type { SaunaShopViewModel } from '../../ui/shop/SaunaShopPanel.tsx';
import type { SaunaTierContext, SaunaTierId, SaunaTierChangeContext } from '../../sauna/tiers.ts';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../../events/types.ts';
import type { PolicyAppliedEvent, PolicyRevokedEvent } from '../../data/policies.ts';
import type { GameClock } from '../../core/GameClock.ts';
import type { HexMapRenderer } from '../../render/HexMapRenderer.ts';

import { createUnitFxManager, type UnitFxManager } from '../../render/unit_fx.ts';
import { createUnitCombatAnimator, type UnitCombatAnimator } from '../../render/combatAnimations.ts';
import { initializeClassicHud } from '../setup/hud.ts';
import { setupActionBar } from '../../ui/action-bar/index.tsx';
import { setupTopbar } from '../../ui/topbar.ts';
import { setupInventoryHud } from '../../ui/inventoryHud.ts';
import { setupRosterHUD } from '../../ui/rosterHUD.ts';
import { setupSaunaUI } from '../../ui/sauna.tsx';
import { getArtocoinBalance, subscribeToSaunaShop as subscribeToSaunaShopState } from '../saunaShopState.ts';
import { evaluateSaunaTier, getSaunaTier, listSaunaTiers } from '../../sauna/tiers.ts';
import { purchaseSaunaTier } from '../../progression/saunaShop.ts';
import { playSafe } from '../../audio/sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from '../../sisu/burst.ts';
import { logEvent } from '../../ui/logging.ts';
import { uiIcons } from '../assets.ts';
import { pixelToAxial } from '../../hex/HexUtils.ts';
import { eventBus } from '../../events';
import { POLICY_EVENTS } from '../../data/policies.ts';
import { getAssets } from '../../game/assets.ts';
import { resetGamePause } from '../pause.ts';
import { initializeRightPanel as createRightPanelBridge } from '../setup/rightPanel.ts';

export interface GameRuntimeContext {
  readonly state: GameState;
  readonly units: Unit[];
  getSaunojas(): Saunoja[];
  getSauna(): Sauna;
  readonly map: HexMap;
  readonly inventory: InventoryState;
  readonly mapRenderer: HexMapRenderer;
  getUnitById(id: string): Unit | undefined;
  resetHudElapsed(): void;
  notifyHudElapsed(): void;
  notifyEnemyRamp(summary: EnemyRampSummary | null): void;
  syncSelectionOverlay(): void;
  focusSaunoja(target: Saunoja): boolean;
  focusSaunojaById(unitId: string): void;
  getSelectedUnitId(): string | null;
  setSelectedUnitId(next: string | null): void;
  setSelectedCoord(coord: AxialCoord | null): boolean;
  deselectAllSaunojas(except?: Saunoja): boolean;
  clearSaunojaSelection(): boolean;
  saveUnits(): void;
  updateRosterDisplay(): void;
  getSelectedInventoryContext(): InventoryComparisonContext | null;
  equipItemToSaunoja(unitId: string, item: SaunojaItem): EquipAttemptResult;
  equipSlotFromStash(unitId: string, slot: EquipmentSlotId): boolean;
  unequipSlotToStash(unitId: string, slot: EquipmentSlotId): boolean;
  getTierContext(): SaunaTierContext;
  getActiveTierId(): SaunaTierId;
  setActiveTier(
    tierId: SaunaTierId,
    options?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
  ): boolean;
  getActiveTierLimit(): number;
  updateRosterCap(value: number, options?: { persist?: boolean }): number;
  syncSaunojaRosterWithUnits(): boolean;
  startTutorialIfNeeded(): void;
  disposeTutorial(): void;
  getAttachedUnitFor(attendant: Saunoja): Unit | null;
  resetUnitVisionSnapshots(): void;
  resetObjectiveTracker(): void;
  resetStrongholdCounter(): void;
  destroyEndScreen(): void;
  persistState(): void;
  persistUnits(): void;
  getPolicyHandlers(): {
    onApplied: (event: PolicyAppliedEvent) => void;
    onRevoked: (event: PolicyRevokedEvent) => void;
    onLifecycleChanged: () => void;
  };
  getUnitEventHandlers(): {
    onUnitDied: (payload: {
      unitId: string;
      attackerId?: string;
      attackerFaction?: string;
      unitFaction: string;
    }) => void;
    onUnitSpawned: (payload: { unit: Unit }) => void;
    onInventoryChanged: () => void;
    onModifierChanged: () => void;
    onUnitStatsChanged: () => void;
    onSaunaDamaged: (payload: SaunaDamagedPayload) => void;
    onSaunaDestroyed: (payload: SaunaDestroyedPayload) => void;
  };
  getTerrainInvalidator(): () => void;
  getClock(): GameClock;
  isGamePaused(): boolean;
  onPauseChanged(): void;
  updateTopbarHud(deltaMs: number): void;
  updateSaunaHud(): void;
  refreshRosterPanel(entries?: RosterEntry[]): void;
  draw(): void;
  getIdleFrameLimit(): number;
}

export class GameRuntime {
  private readonly ctx: GameRuntimeContext;

  private canvas: HTMLCanvasElement | null = null;
  private unitFx: UnitFxManager | null = null;
  private combatAnimations: UnitCombatAnimator | null = null;
  private rosterHud: RosterHudController | null = null;
  private saunaUiController: SaunaUIController | null = null;
  private topbarControls: ReturnType<typeof setupTopbar> | null = null;
  private actionBarController: ActionBarController | null = null;
  private inventoryHudController: { destroy(): void } | null = null;
  private disposeRightPanel: (() => void) | null = null;
  private addEvent: (event: GameEvent) => void = () => {};
  private pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
  private pendingRosterEntries: RosterEntry[] | null = null;
  private pendingRosterSummary: RosterHudSummary | null = null;
  private lastRosterEntries: RosterEntry[] = [];
  private lastRosterSummary: RosterHudSummary | null = null;

  private animationFrameId: number | null = null;
  private running = false;
  private frameDirty = true;
  private idleFrameCount = 0;
  private gameLoopCallback: FrameRequestCallback | null = null;
  private pauseListenerAttached = false;

  constructor(context: GameRuntimeContext) {
    this.ctx = context;
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  getUnitFx(): UnitFxManager | null {
    return this.unitFx;
  }

  getCombatAnimations(): UnitCombatAnimator | null {
    return this.combatAnimations;
  }

  getRosterHud(): RosterHudController | null {
    return this.rosterHud;
  }

  getSaunaUiController(): SaunaUIController | null {
    return this.saunaUiController;
  }

  setSaunaUiController(controller: SaunaUIController | null): void {
    this.saunaUiController = controller;
  }

  getTopbarControls(): ReturnType<typeof setupTopbar> | null {
    return this.topbarControls;
  }

  getActionBarController(): ActionBarController | null {
    return this.actionBarController;
  }

  getInventoryHudController(): { destroy(): void } | null {
    return this.inventoryHudController;
  }

  getPendingRosterRenderer(): ((entries: RosterEntry[]) => void) | null {
    return this.pendingRosterRenderer;
  }

  setPendingRosterRenderer(renderer: ((entries: RosterEntry[]) => void) | null): void {
    this.pendingRosterRenderer = renderer;
  }

  getPendingRosterEntries(): RosterEntry[] | null {
    return this.pendingRosterEntries;
  }

  setPendingRosterEntries(entries: RosterEntry[] | null): void {
    this.pendingRosterEntries = entries;
  }

  getPendingRosterSummary(): RosterHudSummary | null {
    return this.pendingRosterSummary;
  }

  setPendingRosterSummary(summary: RosterHudSummary | null): void {
    this.pendingRosterSummary = summary;
  }

  setLastRosterEntries(entries: RosterEntry[]): void {
    this.lastRosterEntries = entries;
  }

  getLastRosterEntries(): RosterEntry[] {
    return this.lastRosterEntries;
  }

  setLastRosterSummary(summary: RosterHudSummary | null): void {
    this.lastRosterSummary = summary;
  }

  getLastRosterSummary(): RosterHudSummary | null {
    return this.lastRosterSummary;
  }

  getAddEvent(): (event: GameEvent) => void {
    return this.addEvent;
  }

  getDisposeRightPanel(): (() => void) | null {
    return this.disposeRightPanel;
  }

  setAddEvent(handler: (event: GameEvent) => void): void {
    this.addEvent = handler;
  }

  setDisposeRightPanel(dispose: (() => void) | null): void {
    this.disposeRightPanel = dispose;
  }

  isRunning(): boolean {
    return this.running;
  }

  getFrameDirty(): boolean {
    return this.frameDirty;
  }

  markFrameClean(): void {
    this.frameDirty = false;
  }

  markFrameDirty(): void {
    this.frameDirty = true;
  }

  getIdleFrameCount(): number {
    return this.idleFrameCount;
  }

  resetIdleFrameCount(): void {
    this.idleFrameCount = 0;
  }

  incrementIdleFrameCount(): void {
    this.idleFrameCount += 1;
  }

  hasPauseListener(): boolean {
    return this.pauseListenerAttached;
  }

  setPauseListenerAttached(attached: boolean): void {
    this.pauseListenerAttached = attached;
  }

  invalidateFrame(): void {
    this.frameDirty = true;
    this.idleFrameCount = 0;
    this.scheduleGameLoop();
  }

  stopLoop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private scheduleGameLoop(): void {
    if (!this.running || !this.gameLoopCallback) {
      return;
    }
    if (this.animationFrameId !== null) {
      return;
    }
    this.animationFrameId = requestAnimationFrame(this.gameLoopCallback);
  }

  setupGame(canvasEl: HTMLCanvasElement, resourceBarEl: HTMLElement, overlayEl: HTMLElement): void {
    overlayEl.dataset.hudVariant = 'classic';
    this.ctx.resetHudElapsed();
    this.ctx.notifyHudElapsed();
    this.ctx.notifyEnemyRamp(null);
    this.lastRosterEntries = [];
    this.lastRosterSummary = null;
    this.canvas = canvasEl;

    if (this.unitFx) {
      this.unitFx.dispose();
      this.unitFx = null;
    }
    if (this.combatAnimations) {
      this.combatAnimations.dispose();
      this.combatAnimations = null;
    }

    this.unitFx = createUnitFxManager({
      canvas: canvasEl,
      overlay: overlayEl,
      mapRenderer: this.ctx.mapRenderer,
      getUnitById: (id) => this.ctx.getUnitById(id),
      requestDraw: () => this.invalidateFrame()
    });

    this.combatAnimations = createUnitCombatAnimator({
      getUnitById: (id) => this.ctx.getUnitById(id),
      requestDraw: () => this.invalidateFrame()
    });

    this.ctx.syncSelectionOverlay();

    this.rosterHud?.destroy();
    this.rosterHud = null;

    this.saunaUiController?.dispose();
    this.saunaUiController = null;

    this.topbarControls?.dispose();
    this.topbarControls = null;

    this.actionBarController?.destroy();
    this.actionBarController = null;

    this.inventoryHudController?.destroy();
    this.inventoryHudController = null;

    const actionBarAbilities: ActionBarAbilityHandlers = {
      useSisuBurst: () => {
        const used = useSisuBurst(this.ctx.state, this.ctx.units);
        if (used) {
          playSafe('sisu');
          logEvent({
            type: 'ability',
            message: `Sisu bursts forth, spending ${SISU_BURST_COST} grit to steel our attendants.`,
            metadata: {
              ability: 'sisu-burst',
              cost: SISU_BURST_COST
            }
          });
        } else {
          playSafe('error');
        }
        return used;
      },
      torille: () => {
        const used = torille(this.ctx.state, this.ctx.units, this.ctx.getSauna().pos, this.ctx.map);
        if (used) {
          logEvent({
            type: 'ability',
            message: `Torille! Our warriors regroup at the sauna to rally their spirits for ${TORILLE_COST} SISU.`,
            metadata: {
              ability: 'torille',
              cost: TORILLE_COST
            }
          });
        } else {
          playSafe('error');
        }
        return used;
      }
    } satisfies ActionBarAbilityHandlers;

    const buildSaunaShopViewModel = (): SaunaShopViewModel => {
      const context = this.ctx.getTierContext();
      return {
        balance: getArtocoinBalance(),
        tiers: listSaunaTiers().map((tier) => ({
          tier,
          status: evaluateSaunaTier(tier, context)
        }))
      } satisfies SaunaShopViewModel;
    };

    const hudResult = initializeClassicHud({
      resourceBarEl,
      rosterIcon: uiIcons.saunojaRoster,
      sauna: this.ctx.getSauna(),
      previousDisposeRightPanel: this.disposeRightPanel,
      pendingRosterRenderer: this.pendingRosterRenderer,
      pendingRosterEntries: this.pendingRosterEntries,
      pendingRosterSummary: this.pendingRosterSummary,
      setupRosterHUD,
      setupSaunaUi: (saunaInstance, options) => setupSaunaUI(saunaInstance, options),
      getActiveTierId: () => this.ctx.getActiveTierId(),
      setActiveTier: (tierId, options) => this.ctx.setActiveTier(tierId, options),
      getTierContext: () => this.ctx.getTierContext(),
      setupTopbar: () =>
        setupTopbar(this.ctx.state, {
          saunakunnia: uiIcons.resource,
          sisu: uiIcons.sisu,
          saunaBeer: uiIcons.saunaBeer,
          artocoin: uiIcons.artocoin
        }),
      setupActionBar: (abilities) => setupActionBar(this.ctx.state, overlayEl, abilities),
      actionBarAbilities,
      setupInventoryHud: () =>
        setupInventoryHud(this.ctx.inventory, {
          getSelectedUnitId: () =>
            this.ctx.getSaunojas().find((unit) => unit.selected)?.id ?? null,
          getComparisonContext: () => this.ctx.getSelectedInventoryContext(),
          onEquip: (unitId, item, _source) => this.ctx.equipItemToSaunoja(unitId, item),
          getSaunaShopViewModel: () => buildSaunaShopViewModel(),
          onPurchaseSaunaTier: (tierId) =>
            purchaseSaunaTier(getSaunaTier(tierId), {
              getCurrentBalance: () => getArtocoinBalance()
            }),
          subscribeToSaunaShop: (listener) => subscribeToSaunaShopState(listener)
        }),
      createRightPanel: (onRendererReady) =>
        createRightPanelBridge(
          {
            state: this.ctx.state,
            sauna: this.ctx.getSauna(),
            getSaunojas: () => this.ctx.getSaunojas(),
            getAttachedUnitFor: (attendant) => this.ctx.getAttachedUnitFor(attendant),
            focusSaunojaById: (id) => this.ctx.focusSaunojaById(id),
            equipSlotFromStash: (unitId, slot) => this.ctx.equipSlotFromStash(unitId, slot),
            unequipSlotToStash: (unitId, slot) => this.ctx.unequipSlotToStash(unitId, slot),
            saveUnits: () => this.ctx.saveUnits(),
            updateRosterDisplay: () => this.ctx.updateRosterDisplay(),
            getActiveTierLimit: () => this.ctx.getActiveTierLimit(),
            updateRosterCap: (value, opts) => this.ctx.updateRosterCap(value, opts)
          },
          onRendererReady
        ),
      syncSaunojaRosterWithUnits: () => this.ctx.syncSaunojaRosterWithUnits(),
      updateRosterDisplay: () => this.ctx.updateRosterDisplay(),
      startTutorialIfNeeded: () => this.ctx.startTutorialIfNeeded()
    });

    this.rosterHud = hudResult.rosterHud;
    this.pendingRosterRenderer = hudResult.pendingRosterRenderer;
    this.pendingRosterEntries = hudResult.pendingRosterEntries;
    this.pendingRosterSummary = hudResult.pendingRosterSummary;
    this.saunaUiController = hudResult.saunaUiController;
    this.topbarControls = hudResult.topbarControls;
    this.actionBarController = hudResult.actionBarController;
    this.inventoryHudController = hudResult.inventoryHudController;
    this.disposeRightPanel = hudResult.disposeRightPanel;
    this.addEvent = hudResult.addEvent;
    hudResult.postSetup?.();
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    const assets = getAssets();
    if (!assets) {
      console.error('Cannot start game without loaded assets.');
      return;
    }
    this.running = true;
    if (!this.pauseListenerAttached) {
      eventBus.on('game:pause-changed', this.ctx.onPauseChanged);
      this.pauseListenerAttached = true;
    }
    this.idleFrameCount = 0;
    this.ctx.updateRosterDisplay();
    this.invalidateFrame();
    this.ctx.draw();

    let last = performance.now();
    const loop: FrameRequestCallback = (now) => {
      this.animationFrameId = null;
      if (!this.running) {
        return;
      }
      const delta = now - last;
      last = now;
      const paused = this.ctx.isGamePaused();
      let shouldContinue = true;
      if (paused) {
        this.ctx.updateTopbarHud(0);
      } else {
        this.idleFrameCount = 0;
        this.ctx.getClock().tick(delta);
        this.ctx.updateSaunaHud();
        this.ctx.updateTopbarHud(delta);
        this.ctx.refreshRosterPanel();
      }
      if (this.frameDirty) {
        this.idleFrameCount = 0;
        this.ctx.draw();
      } else if (paused) {
        this.idleFrameCount += 1;
        if (this.idleFrameCount >= this.ctx.getIdleFrameLimit()) {
          shouldContinue = false;
        }
      } else {
        this.idleFrameCount = 0;
      }
      if (!this.running) {
        return;
      }
      if (shouldContinue) {
        this.scheduleGameLoop();
      }
    };
    this.gameLoopCallback = loop;
    this.scheduleGameLoop();
  }

  cleanup(): void {
    this.running = false;
    this.gameLoopCallback = null;
    this.idleFrameCount = 0;
    this.ctx.resetUnitVisionSnapshots();
    this.ctx.resetObjectiveTracker();
    this.ctx.resetStrongholdCounter();
    this.ctx.destroyEndScreen();
    resetGamePause();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.ctx.persistState();
    this.ctx.persistUnits();

    this.unitFx?.dispose();
    this.unitFx = null;

    this.combatAnimations?.dispose();
    this.combatAnimations = null;

    const policyHandlers = this.ctx.getPolicyHandlers();
    eventBus.off(POLICY_EVENTS.APPLIED, policyHandlers.onApplied);
    eventBus.off(POLICY_EVENTS.REVOKED, policyHandlers.onRevoked);
    eventBus.off(POLICY_EVENTS.APPLIED, policyHandlers.onLifecycleChanged);
    eventBus.off(POLICY_EVENTS.REVOKED, policyHandlers.onLifecycleChanged);

    if (this.pauseListenerAttached) {
      eventBus.off('game:pause-changed', this.ctx.onPauseChanged);
      this.pauseListenerAttached = false;
    }

    const unitHandlers = this.ctx.getUnitEventHandlers();
    eventBus.off('unitDied', unitHandlers.onUnitDied);
    eventBus.off('unitSpawned', unitHandlers.onUnitSpawned);
    eventBus.off('inventoryChanged', unitHandlers.onInventoryChanged);
    eventBus.off('modifierAdded', unitHandlers.onModifierChanged);
    eventBus.off('modifierRemoved', unitHandlers.onModifierChanged);
    eventBus.off('modifierExpired', unitHandlers.onModifierChanged);
    eventBus.off('unit:stats:changed', unitHandlers.onUnitStatsChanged);
    eventBus.off('saunaDamaged', unitHandlers.onSaunaDamaged);
    eventBus.off('saunaDestroyed', unitHandlers.onSaunaDestroyed);
    eventBus.off('buildingPlaced', this.ctx.getTerrainInvalidator());
    eventBus.off('buildingRemoved', this.ctx.getTerrainInvalidator());

    this.disposeRightPanel?.();
    this.disposeRightPanel = null;

    this.inventoryHudController?.destroy();
    this.inventoryHudController = null;

    this.saunaUiController?.dispose();
    this.saunaUiController = null;

    this.topbarControls?.dispose();
    this.topbarControls = null;

    this.actionBarController?.destroy();
    this.actionBarController = null;

    this.rosterHud?.destroy();
    this.rosterHud = null;

    this.pendingRosterEntries = null;
    this.pendingRosterSummary = null;
    this.pendingRosterRenderer = null;

    this.ctx.disposeTutorial();
  }

  handleCanvasClick(world: PixelCoord): void {
    const clicked = pixelToAxial(world.x, world.y, this.ctx.map.hexSize);
    const target = this.ctx.getSaunojas().find(
      (unit) => unit.coord.q === clicked.q && unit.coord.r === clicked.r
    );
    if (target) {
      const selectionChanged = this.ctx.focusSaunoja(target);
      if (!selectionChanged) {
        return;
      }
      this.ctx.saveUnits();
      this.ctx.updateRosterDisplay();
      this.invalidateFrame();
      return;
    }

    const enemyTarget = this.ctx.units.find(
      (unit) =>
        unit.faction !== 'player' &&
        !unit.isDead() &&
        unit.coord.q === clicked.q &&
        unit.coord.r === clicked.r
    );

    if (enemyTarget) {
      const previousUnitId = this.ctx.getSelectedUnitId();
      const deselected = this.ctx.deselectAllSaunojas();
      const coordChanged = this.ctx.setSelectedCoord(enemyTarget.coord);
      this.ctx.setSelectedUnitId(enemyTarget.id);
      this.ctx.syncSelectionOverlay();
      if (deselected) {
        this.ctx.saveUnits();
        this.ctx.updateRosterDisplay();
      }
      if (
        previousUnitId !== this.ctx.getSelectedUnitId() ||
        coordChanged ||
        deselected
      ) {
        this.invalidateFrame();
      }
      return;
    }

    const selectionCleared = this.ctx.clearSaunojaSelection();

    if (!selectionCleared) {
      return;
    }

    this.ctx.saveUnits();
    this.ctx.updateRosterDisplay();
    this.invalidateFrame();
  }
}
