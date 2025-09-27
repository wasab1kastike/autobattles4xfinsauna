import { GameState, Resource, type EnemyScalingSnapshot } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { BattleManager } from './battle/BattleManager.ts';
import { pixelToAxial } from './hex/HexUtils.ts';
import type { AxialCoord, PixelCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit/index.ts';
import type { UnitStats, UnitType } from './unit/index.ts';
import { resolveSaunojaAppearance } from './unit/appearance.ts';
import { eventBus, eventScheduler } from './events';
import {
  POLICY_EVENTS,
  listPolicies,
  type PolicyAppliedEvent,
  type PolicyRevokedEvent
} from './data/policies.ts';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from './events/types.ts';
import { createSauna, pickFreeTileAround } from './sim/sauna.ts';
import { EnemySpawner, type EnemySpawnerRuntimeModifiers } from './sim/EnemySpawner.ts';
import { recordEnemyScalingTelemetry } from './state/telemetry/enemyScaling.ts';
import { setupSaunaUI, type SaunaUIController } from './ui/sauna.tsx';
import type {
  SaunaStatusPayload,
  SelectionItemSlot,
  SelectionStatusChip,
  UnitSelectionPayload,
  UnitStatusPayload
} from './ui/fx/types.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  evaluateSaunaTier,
  getSaunaTier,
  listSaunaTiers,
  type SaunaTier,
  type SaunaTierContext,
  type SaunaTierId
} from './sauna/tiers.ts';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar, type EnemyRampSummary, type TopbarControls } from './ui/topbar.ts';
import {
  setupActionBar,
  type ActionBarAbilityHandlers,
  type ActionBarController
} from './ui/action-bar/index.tsx';
import { isGamePaused, resetGamePause, setGamePaused } from './game/pause.ts';
import { playSafe } from './audio/sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from './sisu/burst.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from './ui/rightPanel.tsx';
import { createTutorialController, type TutorialController } from './ui/tutorial/Tutorial.tsx';
import { draw as render, type VisionSource } from './render/renderer.ts';
import { createUnitCombatAnimator, type UnitCombatAnimator } from './render/combatAnimations.ts';
import { Animator } from './render/Animator.ts';
import { createUnitFxManager, type UnitFxManager } from './render/unit_fx.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja, SaunojaItem, SaunojaStatBlock } from './units/saunoja.ts';
import {
  makeSaunoja,
  rollSaunojaUpkeep,
  SAUNOJA_DEFAULT_UPKEEP,
  SAUNOJA_UPKEEP_MAX,
  SAUNOJA_UPKEEP_MIN
} from './units/saunoja.ts';
import { drawSaunojas } from './units/renderSaunoja.ts';
import { SOLDIER_COST } from './units/Soldier.ts';
import { generateTraits } from './data/traits.ts';
import { advanceModifiers } from './mods/runtime.ts';
import { runEconomyTick } from './economy/tick.ts';
import {
  combinePolicyModifiers,
  createPolicyModifierSummary,
  type PolicyModifierSummary
} from './policies/modifiers.ts';
import { setActivePolicyModifiers } from './policies/runtime.ts';
import { InventoryState } from './inventory/state.ts';
import type { InventoryComparisonContext } from './state/inventory.ts';
import type { UnitBehavior } from './unit/types.ts';
import type {
  EquipAttemptResult,
  InventoryComparison,
  InventoryItemSummary,
  InventoryStatDelta,
  InventoryStatId
} from './inventory/state.ts';
import { setupInventoryHud } from './ui/inventoryHud.ts';
import { rollLoot } from './loot/roll.ts';
import { tryGetUnitArchetype } from './unit/archetypes.ts';
import { computeUnitStats, applyEquipment } from './unit/calc.ts';
import { getAssets, uiIcons } from './game/assets.ts';
import { createObjectiveTracker } from './progression/objectives.ts';
import type { ObjectiveProgress, ObjectiveResolution, ObjectiveTracker } from './progression/objectives.ts';
import {
  getLevelProgress,
  getTotalStatAwards,
  getStatAwardsForLevel,
  getLevelForExperience,
  type StatAwards
} from './progression/experiencePlan.ts';
import {
  createNgPlusRng,
  ensureNgPlusRunState,
  loadNgPlusState,
  planNextNgPlusRun,
  saveNgPlusState,
  type NgPlusState
} from './progression/ngplus.ts';
import {
  calculateArtocoinPayout,
  creditArtocoins,
  loadArtocoinBalance,
  onArtocoinChange,
  type ArtocoinChangeEvent
} from './progression/artocoin.ts';
import {
  grantSaunaTier,
  onSaunaShopChange,
  purchaseSaunaTier,
  type PurchaseSaunaTierResult,
  type SaunaShopChangeEvent
} from './progression/saunaShop.ts';
import type { SaunaShopViewModel } from './ui/shop/SaunaShopPanel.tsx';
import { createPlayerSpawnTierQueue } from './world/spawn/tier_helpers.ts';
import {
  equip as equipLoadout,
  unequip as unequipLoadout,
  loadoutItems,
  matchesSlot,
  getSlotDefinition
} from './items/equip.ts';
import { EQUIPMENT_SLOT_IDS } from './items/types.ts';
import type { EquipmentSlotId, EquippedItem, EquipmentModifier } from './items/types.ts';
import {
  getSaunojaStorage,
  loadUnits as loadRosterFromStorage,
  saveUnits as persistRosterToStorage,
  SAUNOJA_STORAGE_KEY
} from './game/rosterStorage.ts';
import { loadSaunaSettings, saveSaunaSettings } from './game/saunaSettings.ts';
import {
  setupRosterHUD,
  type RosterCardViewModel,
  type RosterHudController,
  type RosterHudSummary
} from './ui/rosterHUD.ts';
import { showEndScreen, type EndScreenController } from './ui/overlays/EndScreen.tsx';
import { isTutorialDone, setTutorialDone } from './save/local_flags.ts';
import { getLogHistory, logEvent, subscribeToLogs } from './ui/logging.ts';
import {
  createUiV2RosterController,
  type UiV2RosterController
} from './uiV2/rosterController.ts';
import {
  createUiV2TopbarController,
  type UiV2TopbarController
} from './uiV2/topbarController.ts';
import {
  createUiV2InventoryController,
  type UiV2InventoryController
} from './uiV2/inventoryController.ts';
import { createUiV2LogController, type UiV2LogController } from './uiV2/logController.ts';
import { createUiV2SaunaController, type UiV2SaunaController } from './uiV2/saunaController.ts';
import {
  addArtocoinSpend,
  getArtocoinBalance,
  getArtocoinsSpentThisRun,
  getPurchasedTierIds,
  notifySaunaShopSubscribers,
  reloadSaunaShopState,
  setArtocoinBalance,
  setPurchasedTierIds,
  subscribeToSaunaShop as subscribeToSaunaShopState
} from './game/saunaShopState.ts';
import { initializeClassicHud, initializeModernHud } from './game/setup/hud.ts';

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

const XP_STANDARD_KILL = 6;
const XP_ELITE_KILL = 40;
const XP_BOSS_KILL = 250;
const XP_OBJECTIVE_COMPLETION = 200;
const MAX_LEVEL = getLevelForExperience(Number.MAX_SAFE_INTEGER);

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

function clampRosterCap(value: number, limit: number): number {
  const maxCap = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  if (!Number.isFinite(value)) {
    return maxCap;
  }
  const sanitized = Math.max(0, Math.floor(value));
  return Math.max(0, Math.min(maxCap, sanitized));
}

function sanitizeObjectiveMetric(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

const BASE_ELITE_ODDS = 0.1;
const MIN_SPAWN_LIMIT = 3;
const BASE_ENEMY_DIFFICULTY = 1;

let currentNgPlusState: NgPlusState = ensureNgPlusRunState(loadNgPlusState());
let enemyRandom: () => number = createNgPlusRng(currentNgPlusState.runSeed, 0x01);
let lootRandom: () => number = createNgPlusRng(currentNgPlusState.runSeed, 0x02);
let syncActiveTierWithUnlocks: ((options?: { persist?: boolean }) => void) | null = null;

function applyNgPlusState(next: NgPlusState): void {
  currentNgPlusState = ensureNgPlusRunState(next);
  enemyRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x01);
  lootRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x02);
  syncActiveTierWithUnlocks?.({ persist: true });
}

applyNgPlusState(currentNgPlusState);

let canvas: HTMLCanvasElement | null = null;
let saunojas: Saunoja[] = [];
type SaunojaPolicyBaseline = { base: SaunojaStatBlock; upkeep: number };
const saunojaPolicyBaselines = new WeakMap<Saunoja, SaunojaPolicyBaseline>();
let policyModifiers: PolicyModifierSummary = createPolicyModifierSummary();
setActivePolicyModifiers(policyModifiers);
const unitToSaunoja = new Map<string, Saunoja>();
const saunojaToUnit = new Map<string, string>();
const unitsById = new Map<string, Unit>();
let playerSpawnSequence = 0;
let selected: AxialCoord | null = null;
let selectedUnitId: string | null = null;
let addEvent: (event: GameEvent) => void = () => {};
let disposeRightPanel: (() => void) | null = null;
let topbarControls: TopbarControls | null = null;
let actionBarController: ActionBarController | null = null;
let saunaUiController: SaunaUIController | null = null;
let inventoryHudController: { destroy(): void } | null = null;
let rosterHud: RosterHudController | null = null;
let pendingRosterSummary: RosterHudSummary | null = null;
let pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
let pendingRosterEntries: RosterEntry[] | null = null;
let lastRosterSummary: RosterHudSummary | null = null;
let lastRosterEntries: RosterEntry[] = [];
const friendlyVisionUnitScratch: Unit[] = [];
const overlaySaunojasScratch: Saunoja[] = [];
const rosterSummaryListeners = new Set<(summary: RosterHudSummary) => void>();
const rosterEntriesListeners = new Set<(entries: RosterEntry[]) => void>();
let hudElapsedMs = 0;
const hudTimeListeners = new Set<(elapsedMs: number) => void>();
let lastEnemyRampSummary: EnemyRampSummary | null = null;
const enemyRampListeners = new Set<(
  summary: EnemyRampSummary | null
) => void>();
let uiV2RosterController: UiV2RosterController | null = null;
let uiV2TopbarController: UiV2TopbarController | null = null;
let uiV2InventoryController: UiV2InventoryController | null = null;
let uiV2LogController: UiV2LogController | null = null;
let uiV2SaunaController: UiV2SaunaController | null = null;

function notifyRosterSummary(summary: RosterHudSummary): void {
  lastRosterSummary = summary;
  for (const listener of rosterSummaryListeners) {
    try {
      listener(summary);
    } catch (error) {
      console.warn('Failed to notify roster summary listener', error);
    }
  }
}

function notifyRosterEntries(entries: RosterEntry[]): void {
  lastRosterEntries = entries;
  for (const listener of rosterEntriesListeners) {
    try {
      listener(entries);
    } catch (error) {
      console.warn('Failed to notify roster entries listener', error);
    }
  }
}

function notifyHudElapsed(): void {
  for (const listener of hudTimeListeners) {
    try {
      listener(hudElapsedMs);
    } catch (error) {
      console.warn('Failed to notify HUD time listener', error);
    }
  }
}

function notifyEnemyRamp(summary: EnemyRampSummary | null): void {
  lastEnemyRampSummary = summary;
  for (const listener of enemyRampListeners) {
    try {
      listener(summary);
    } catch (error) {
      console.warn('Failed to notify enemy ramp listener', error);
    }
  }
}

function disposeUiV2Controllers(): void {
  uiV2RosterController?.dispose();
  uiV2RosterController = null;
  uiV2TopbarController?.dispose();
  uiV2TopbarController = null;
  uiV2InventoryController?.dispose();
  uiV2InventoryController = null;
  uiV2LogController?.dispose();
  uiV2LogController = null;
  uiV2SaunaController?.dispose();
  uiV2SaunaController = null;
}
const IDLE_FRAME_LIMIT = 10;

let animationFrameId: number | null = null;
let running = false;
let unitFx: UnitFxManager | null = null;
let combatAnimations: UnitCombatAnimator | null = null;
let frameDirty = true;
let idleFrameCount = 0;
let gameLoopCallback: FrameRequestCallback | null = null;
let pauseListenerAttached = false;

export function invalidateFrame(): void {
  frameDirty = true;
  idleFrameCount = 0;
  scheduleGameLoop();
}

function scheduleGameLoop(): void {
  if (!running || !gameLoopCallback) {
    return;
  }
  if (animationFrameId !== null) {
    return;
  }
  animationFrameId = requestAnimationFrame(gameLoopCallback);
}

const onPauseChanged = () => {
  invalidateFrame();
};

function getSelectedSaunoja(): Saunoja | null {
  return saunojas.find((unit) => unit.selected) ?? null;
}

function buildSelectionPayload(attendant: Saunoja): UnitSelectionPayload {
  const attachedUnit = getAttachedUnitFor(attendant);
  const itemsSource = Array.isArray(attendant.items) ? attendant.items : [];
  const modifiersSource = Array.isArray(attendant.modifiers) ? attendant.modifiers : [];
  const items: SelectionItemSlot[] = itemsSource.map((item, index) => ({
    id: typeof item.id === 'string' && item.id.length > 0 ? item.id : `${attendant.id}-item-${index}`,
    name: item.name?.trim() || 'Artifact',
    icon: item.icon || undefined,
    rarity: item.rarity || undefined,
    quantity:
      Number.isFinite(item.quantity) && item.quantity > 1
        ? Math.max(1, Math.round(item.quantity))
        : undefined
  }));
  const statuses: SelectionStatusChip[] = modifiersSource.map((modifier, index) => ({
    id:
      typeof modifier.id === 'string' && modifier.id.length > 0
        ? modifier.id
        : `modifier-${index}`,
    label: modifier.name?.trim() || modifier.id || 'Status',
    remaining: Number.isFinite(modifier.remaining) ? Math.max(0, modifier.remaining) : Infinity,
    duration: Number.isFinite(modifier.duration) ? Math.max(0, modifier.duration) : Infinity,
    stacks:
      Number.isFinite(modifier.stacks) && (modifier.stacks as number) > 1
        ? Math.max(1, Math.round(modifier.stacks as number))
        : undefined
  }));

  const hpValue = Number.isFinite(attendant.hp) ? Math.max(0, attendant.hp) : 0;
  const maxHpValue = Number.isFinite(attendant.maxHp) ? Math.max(1, attendant.maxHp) : 1;
  const shieldValue = Number.isFinite(attendant.shield) ? Math.max(0, attendant.shield) : 0;
  const coordSource = attachedUnit?.coord ?? attendant.coord;

  return {
    id: attachedUnit?.id ?? attendant.id,
    name: attendant.name?.trim() || 'Saunoja',
    faction: attachedUnit?.faction ?? 'player',
    coord: { q: coordSource.q, r: coordSource.r },
    hp: hpValue,
    maxHp: maxHpValue,
    shield: shieldValue,
    items,
    statuses
  } satisfies UnitSelectionPayload;
}

function buildSelectionPayloadFromUnit(unit: Unit): UnitSelectionPayload {
  const hpValue = Number.isFinite(unit.stats.health) ? Math.max(0, unit.stats.health) : 0;
  const maxHpValue = Number.isFinite(unit.getMaxHealth()) ? Math.max(1, unit.getMaxHealth()) : 1;
  const shieldValue = Number.isFinite(unit.getShield()) ? Math.max(0, unit.getShield()) : 0;
  const attachedSaunoja = unitToSaunoja.get(unit.id) ?? null;
  const name = attachedSaunoja?.name?.trim() || describeUnit(unit, attachedSaunoja);
  const faction = typeof unit.faction === 'string' && unit.faction.trim().length > 0
    ? unit.faction
    : 'enemy';
  return {
    id: unit.id,
    name,
    faction,
    coord: { q: unit.coord.q, r: unit.coord.r },
    hp: hpValue,
    maxHp: maxHpValue,
    shield: shieldValue,
    items: [],
    statuses: []
  } satisfies UnitSelectionPayload;
}

function syncSelectionOverlay(): void {
  if (!unitFx) {
    return;
  }

  let selectionPayload: UnitSelectionPayload | null = null;

  if (selectedUnitId) {
    const attachedSaunoja = saunojas.find((unit) => {
      const attachedId = saunojaToUnit.get(unit.id) ?? unit.id;
      return attachedId === selectedUnitId;
    });

    if (attachedSaunoja) {
      selectionPayload = buildSelectionPayload(attachedSaunoja);
    } else {
      const unit = unitsById.get(selectedUnitId);
      if (unit) {
        selectionPayload = buildSelectionPayloadFromUnit(unit);
      } else {
        selectedUnitId = null;
      }
    }
  }

  if (!selectionPayload) {
    const selectedSaunoja = getSelectedSaunoja();
    if (selectedSaunoja) {
      const attachedUnit = getAttachedUnitFor(selectedSaunoja);
      selectedUnitId = attachedUnit?.id ?? selectedSaunoja.id;
      selectionPayload = buildSelectionPayload(selectedSaunoja);
    }
  }

  unitFx.setSelection(selectionPayload);
}

let objectiveTracker: ObjectiveTracker | null = null;
let endScreen: EndScreenController | null = null;
let tutorial: TutorialController | null = null;
let tutorialForcedPause = false;
let lastStrongholdsDestroyed = 0;

function getAttachedUnitFor(attendant: Saunoja): Unit | null {
  const attachedUnitId = saunojaToUnit.get(attendant.id);
  if (!attachedUnitId) {
    return null;
  }
  return unitsById.get(attachedUnitId) ?? null;
}

function applySaunojaBehaviorPreference(
  attendant: Saunoja,
  behavior: UnitBehavior,
  attachedUnit?: Unit | null
): boolean {
  const unit = attachedUnit ?? getAttachedUnitFor(attendant);
  const normalized = behavior;
  const changed = attendant.behavior !== normalized;
  attendant.behavior = normalized;
  if (unit) {
    unit.setBehavior(normalized);
  }
  return changed;
}

export function setSaunojaBehaviorPreference(unitId: string, behavior: UnitBehavior): boolean {
  const attendant = saunojas.find((unit) => unit.id === unitId);
  if (!attendant) {
    return false;
  }
  return applySaunojaBehaviorPreference(attendant, behavior);
}

function applyEffectiveStats(attendant: Saunoja, stats: SaunojaStatBlock): void {
  attendant.effectiveStats = { ...stats };
  attendant.maxHp = Math.max(1, Math.round(stats.health));
  attendant.hp = Math.min(attendant.maxHp, Math.max(0, Math.round(attendant.hp)));
  attendant.defense = typeof stats.defense === 'number' ? Math.max(0, stats.defense) : undefined;
  attendant.shield = typeof stats.shield === 'number' ? Math.max(0, stats.shield) : 0;

  const unit = getAttachedUnitFor(attendant);
  if (unit) {
    applySaunojaBehaviorPreference(attendant, attendant.behavior, unit);
    const nextStats: UnitStats = {
      health: attendant.effectiveStats.health,
      attackDamage: attendant.effectiveStats.attackDamage,
      attackRange: attendant.effectiveStats.attackRange,
      movementRange: attendant.effectiveStats.movementRange
    } satisfies UnitStats;
    if (typeof attendant.effectiveStats.defense === 'number') {
      nextStats.defense = attendant.effectiveStats.defense;
    }
    if (typeof attendant.effectiveStats.visionRange === 'number') {
      nextStats.visionRange = attendant.effectiveStats.visionRange;
    }
    unit.updateStats(nextStats);
    if (typeof attendant.effectiveStats.shield === 'number') {
      unit.setShield(attendant.effectiveStats.shield);
    } else if (attendant.shield <= 0) {
      unit.setShield(0);
    }
  }
}

function cloneStatBlock(stats: SaunojaStatBlock): SaunojaStatBlock {
  const clone: SaunojaStatBlock = {
    health: stats.health,
    attackDamage: stats.attackDamage,
    attackRange: stats.attackRange,
    movementRange: stats.movementRange
  } satisfies SaunojaStatBlock;
  if (typeof stats.defense === 'number') {
    clone.defense = stats.defense;
  }
  if (typeof stats.shield === 'number') {
    clone.shield = stats.shield;
  }
  if (typeof stats.visionRange === 'number') {
    clone.visionRange = stats.visionRange;
  }
  return clone;
}

function ensureSaunojaPolicyBaseline(attendant: Saunoja): SaunojaPolicyBaseline {
  let baseline = saunojaPolicyBaselines.get(attendant);
  if (!baseline) {
    const upkeep = Number.isFinite(attendant.upkeep) ? Math.max(0, attendant.upkeep) : SAUNOJA_DEFAULT_UPKEEP;
    baseline = { base: cloneStatBlock(attendant.baseStats), upkeep } satisfies SaunojaPolicyBaseline;
    saunojaPolicyBaselines.set(attendant, baseline);
  }
  return baseline;
}

function areStatBlocksEqual(a: SaunojaStatBlock, b: SaunojaStatBlock): boolean {
  return (
    Math.round(a.health) === Math.round(b.health) &&
    Math.round(a.attackDamage) === Math.round(b.attackDamage) &&
    Math.round(a.attackRange) === Math.round(b.attackRange) &&
    Math.round(a.movementRange) === Math.round(b.movementRange) &&
    Math.round(a.defense ?? 0) === Math.round(b.defense ?? 0) &&
    Math.round(a.shield ?? 0) === Math.round(b.shield ?? 0) &&
    Math.round(a.visionRange ?? 0) === Math.round(b.visionRange ?? 0)
  );
}

function applyPolicyModifiersToSaunoja(
  attendant: Saunoja,
  baseline: SaunojaPolicyBaseline,
  previousBase: SaunojaStatBlock,
  previousEffective: SaunojaStatBlock,
  previousUpkeep: number
): boolean {
  const multipliers = policyModifiers.statMultipliers;
  const base = baseline.base;
  const adjustedBase: SaunojaStatBlock = {
    health: Math.max(1, Math.round(base.health * multipliers.health)),
    attackDamage: Math.max(0, Math.round(base.attackDamage * multipliers.attackDamage)),
    attackRange: Math.max(0, Math.round(base.attackRange * multipliers.attackRange)),
    movementRange: Math.max(0, Math.round(base.movementRange * multipliers.movementRange))
  } satisfies SaunojaStatBlock;

  if (typeof base.defense === 'number') {
    adjustedBase.defense = Math.max(0, Math.round(base.defense * multipliers.defense));
  }
  if (typeof base.shield === 'number') {
    adjustedBase.shield = Math.max(0, Math.round(base.shield));
  }
  if (typeof base.visionRange === 'number') {
    adjustedBase.visionRange = Math.max(0, Math.round(base.visionRange));
  }

  const loadout = loadoutItems(attendant.equipment);
  const effective = applyEquipment(adjustedBase, loadout);

  attendant.baseStats = adjustedBase;
  applyEffectiveStats(attendant, effective);

  const upkeepBase = baseline.upkeep;
  const adjustedUpkeepRaw = (upkeepBase + policyModifiers.upkeepDelta) * policyModifiers.upkeepMultiplier;
  const nextUpkeep = Math.max(0, Math.round(adjustedUpkeepRaw));
  attendant.upkeep = nextUpkeep;

  const baseChanged = !areStatBlocksEqual(previousBase, adjustedBase);
  const effectiveChanged = !areStatBlocksEqual(previousEffective, effective);
  const upkeepChanged = Math.round(previousUpkeep) !== nextUpkeep;

  return baseChanged || effectiveChanged || upkeepChanged;
}

function refreshSaunojaPolicyAdjustments(attendant: Saunoja): boolean {
  const baseline = ensureSaunojaPolicyBaseline(attendant);
  const previousBase = cloneStatBlock(attendant.baseStats);
  const previousEffective = cloneStatBlock(attendant.effectiveStats);
  const previousUpkeep = Number.isFinite(attendant.upkeep) ? Math.round(attendant.upkeep) : 0;
  const changed = applyPolicyModifiersToSaunoja(attendant, baseline, previousBase, previousEffective, previousUpkeep);
  if (changed) {
    eventBus.emit('unit:stats:changed', { unitId: attendant.id, stats: attendant.effectiveStats });
  }
  return changed;
}

function refreshAllSaunojaPolicyAdjustments(): boolean {
  let changed = false;
  for (const attendant of saunojas) {
    if (refreshSaunojaPolicyAdjustments(attendant)) {
      changed = true;
    }
  }
  if (changed) {
    updateRosterDisplay();
    syncSelectionOverlay();
  }
  return changed;
}

function withSaunojaBaseline<T>(attendant: Saunoja, mutate: (baseline: SaunojaPolicyBaseline) => T): T {
  const baseline = ensureSaunojaPolicyBaseline(attendant);
  const result = mutate(baseline);
  refreshSaunojaPolicyAdjustments(attendant);
  return result;
}

function recomputeEffectiveStats(attendant: Saunoja, loadout?: readonly EquippedItem[]): SaunojaStatBlock {
  const resolvedLoadout = loadout ?? loadoutItems(attendant.equipment);
  const effective = applyEquipment(attendant.baseStats, resolvedLoadout);
  applyEffectiveStats(attendant, effective);
  return effective;
}

function buildProgression(attendant: Saunoja): RosterEntry['progression'] {
  const progress = getLevelProgress(attendant.xp);
  return {
    level: progress.level,
    xp: Math.max(0, Math.floor(attendant.xp)),
    xpIntoLevel: progress.xpIntoLevel,
    xpForNext: progress.xpForNext,
    progress: progress.progressToNext,
    statBonuses: getTotalStatAwards(progress.level)
  } satisfies RosterEntry['progression'];
}

type ExperienceSource = 'kill' | 'objective' | 'test';

type ExperienceContext = {
  source: ExperienceSource;
  label?: string;
  elite?: boolean;
  boss?: boolean;
};

type ExperienceGrantResult = {
  xpAwarded: number;
  totalXp: number;
  level: number;
  levelsGained: number;
  statBonuses: StatAwards;
};

function describeStatBonuses(bonuses: StatAwards): string {
  const parts: string[] = [];
  if (bonuses.vigor > 0) {
    parts.push(`+${bonuses.vigor} Vigor`);
  }
  if (bonuses.focus > 0) {
    parts.push(`+${bonuses.focus} Focus`);
  }
  if (bonuses.resolve > 0) {
    parts.push(`+${bonuses.resolve} Resolve`);
  }
  return parts.length > 0 ? parts.join(', ') : '+0 Vigor, +0 Focus, +0 Resolve';
}

function grantSaunojaExperience(
  attendant: Saunoja,
  amount: number,
  context: ExperienceContext
): ExperienceGrantResult | null {
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  const before = getLevelProgress(attendant.xp);
  const nextXp = Math.max(0, Math.floor(attendant.xp + amount));
  if (nextXp === attendant.xp) {
    return null;
  }
  attendant.xp = nextXp;
  const after = getLevelProgress(attendant.xp);
  const levelsGained = Math.max(0, after.level - before.level);
  const statBonuses: StatAwards = { vigor: 0, focus: 0, resolve: 0 };
  let bonusHealth = 0;
  if (levelsGained > 0) {
    withSaunojaBaseline(attendant, (baseline) => {
      for (let level = before.level + 1; level <= after.level && level <= MAX_LEVEL; level++) {
        const award = getStatAwardsForLevel(level);
        statBonuses.vigor += award.vigor;
        statBonuses.focus += award.focus;
        statBonuses.resolve += award.resolve;

        const baseStats = baseline.base;
        const baseHealth = Number.isFinite(baseStats.health)
          ? baseStats.health
          : attendant.effectiveStats.health;
        baseStats.health = Math.max(1, Math.round(baseHealth + award.vigor));

        const baseAttack = Number.isFinite(baseStats.attackDamage)
          ? baseStats.attackDamage
          : attendant.effectiveStats.attackDamage;
        baseStats.attackDamage = Math.max(0, Math.round(baseAttack + award.focus));

        const currentDefense = Number.isFinite(baseStats.defense)
          ? baseStats.defense ?? 0
          : attendant.effectiveStats.defense ?? 0;
        const nextDefense = currentDefense + award.resolve;
        baseStats.defense = nextDefense > 0 ? nextDefense : undefined;
      }
    });
    bonusHealth = statBonuses.vigor;
  }

  if (bonusHealth > 0) {
    attendant.hp += bonusHealth;
  }

  const attachedUnit = getAttachedUnitFor(attendant);
  if (attachedUnit) {
    attachedUnit.setExperience(attendant.xp);
  }

  if (context.source === 'kill') {
    const slayerName = attendant.name?.trim() || 'Our champion';
    const foeLabel = context.label?.trim() || 'their foe';
    const flourish = context.boss ? ' Boss toppled!' : context.elite ? ' Elite threat routed!' : '';
    logEvent({
      type: 'combat',
      message: `${slayerName} earns ${amount} XP for defeating ${foeLabel}.${flourish}`,
      metadata: {
        slayer: slayerName,
        foe: foeLabel,
        xpAward: amount,
        boss: Boolean(context.boss),
        elite: Boolean(context.elite)
      }
    });
  }

  if (levelsGained > 0) {
    const summary = describeStatBonuses(statBonuses);
    const unitName = attendant.name?.trim() || 'Our champion';
    logEvent({
      type: 'progression',
      message: `${unitName} reaches Level ${after.level}! ${summary}.`,
      metadata: {
        unit: unitName,
        level: after.level,
        levelsGained,
        bonuses: statBonuses
      }
    });
  }

  return {
    xpAwarded: amount,
    totalXp: attendant.xp,
    level: after.level,
    levelsGained,
    statBonuses
  } satisfies ExperienceGrantResult;
}

function grantExperienceToUnit(
  unit: Unit | null,
  amount: number,
  context: ExperienceContext
): ExperienceGrantResult | null {
  if (!unit) {
    return null;
  }
  const attendant = unitToSaunoja.get(unit.id);
  if (!attendant) {
    return null;
  }
  return grantSaunojaExperience(attendant, amount, context);
}

function grantExperienceToRoster(amount: number, context: ExperienceContext): boolean {
  if (!Number.isFinite(amount) || amount <= 0) {
    return false;
  }
  let updated = false;
  for (const attendant of saunojas) {
    const result = grantSaunojaExperience(attendant, amount, context);
    if (result) {
      updated = true;
    }
  }
  return updated;
}

function calculateKillExperience(target: Unit | null): {
  xp: number;
  elite: boolean;
  boss: boolean;
} {
  if (!target) {
    return { xp: XP_STANDARD_KILL, elite: false, boss: false };
  }
  const typeLabel = target.type?.toLowerCase?.() ?? '';
  const boss = typeLabel.includes('boss');
  if (boss) {
    return { xp: XP_BOSS_KILL, elite: true, boss: true };
  }
  const elite = isEliteUnit(target);
  if (elite) {
    return { xp: XP_ELITE_KILL, elite: true, boss: false };
  }
  return { xp: XP_STANDARD_KILL, elite: false, boss: false };
}

const handleObjectiveProgress = (progress: ObjectiveProgress): void => {
  if (!progress) {
    return;
  }
  const destroyed = Math.max(0, Math.floor(progress.strongholds.destroyed));
  if (destroyed > lastStrongholdsDestroyed) {
    const delta = destroyed - lastStrongholdsDestroyed;
    const xpAward = XP_OBJECTIVE_COMPLETION * delta;
    if (grantExperienceToRoster(xpAward, { source: 'objective', label: 'stronghold' })) {
      saveUnits();
      updateRosterDisplay();
      logEvent({
        type: 'progression',
        message: `Strategists toast the captured stronghold — roster gains ${xpAward} XP.`,
        metadata: {
          source: 'stronghold',
          xpAward
        }
      });
    }
  }
  if (destroyed < lastStrongholdsDestroyed) {
    lastStrongholdsDestroyed = destroyed;
    return;
  }
  lastStrongholdsDestroyed = destroyed;
};

const INVENTORY_STAT_KEYS: readonly InventoryStatId[] = Object.freeze([
  'health',
  'attackDamage',
  'attackRange',
  'movementRange',
  'defense',
  'shield'
]);

function summarizeEquippedItem(item: EquippedItem | null | undefined): InventoryItemSummary | null {
  if (!item) {
    return null;
  }
  return {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    rarity: item.rarity
  } satisfies InventoryItemSummary;
}

function resolveStatValue(block: SaunojaStatBlock, key: InventoryStatId): number {
  const value = block[key as keyof SaunojaStatBlock];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value as number);
  }
  return 0;
}

function computeInventoryStatDeltas(
  before: SaunojaStatBlock,
  after: SaunojaStatBlock
): InventoryStatDelta[] {
  const deltas: InventoryStatDelta[] = [];
  for (const key of INVENTORY_STAT_KEYS) {
    const next = resolveStatValue(after, key);
    const prev = resolveStatValue(before, key);
    const delta = next - prev;
    if (delta !== 0) {
      deltas.push({ stat: key, delta });
    }
  }
  return deltas;
}

function updateBaseStatsFromUnit(attendant: Saunoja, unit: Unit | null): void {
  if (!unit) {
    refreshSaunojaPolicyAdjustments(attendant);
    return;
  }
  const hasEquipment = loadoutItems(attendant.equipment).length > 0;
  if (hasEquipment) {
    ensureSaunojaPolicyBaseline(attendant);
    refreshSaunojaPolicyAdjustments(attendant);
    return;
  }
  const base: SaunojaStatBlock = {
    health: Math.max(1, Math.round(unit.getMaxHealth())),
    attackDamage: Math.max(0, Math.round(unit.stats.attackDamage)),
    attackRange: Math.max(0, Math.round(unit.stats.attackRange)),
    movementRange: Math.max(0, Math.round(unit.stats.movementRange)),
    defense:
      typeof unit.stats.defense === 'number' && Number.isFinite(unit.stats.defense)
        ? Math.max(0, unit.stats.defense)
        : attendant.baseStats.defense,
    shield: attendant.baseStats.shield ?? 0,
    visionRange:
      typeof unit.stats.visionRange === 'number' && Number.isFinite(unit.stats.visionRange)
        ? Math.max(0, unit.stats.visionRange)
        : attendant.baseStats.visionRange
  } satisfies SaunojaStatBlock;
  const baseline = ensureSaunojaPolicyBaseline(attendant);
  baseline.base = cloneStatBlock(base);
  refreshSaunojaPolicyAdjustments(attendant);
}

function resumeTutorialPause(): void {
  if (!tutorialForcedPause) {
    return;
  }
  setGamePaused(false);
  tutorialForcedPause = false;
}

function disposeTutorial(): void {
  if (!tutorial) {
    resumeTutorialPause();
    return;
  }
  tutorial.destroy();
  tutorial = null;
  resumeTutorialPause();
}

function startTutorialIfNeeded(): void {
  if (isTutorialDone()) {
    disposeTutorial();
    return;
  }
  disposeTutorial();
  const wasPaused = isGamePaused();
  if (!wasPaused) {
    setGamePaused(true);
    tutorialForcedPause = true;
  } else {
    tutorialForcedPause = false;
  }
  tutorial = createTutorialController({
    onComplete: () => {
      setTutorialDone(true);
      resumeTutorialPause();
      disposeTutorial();
    },
    onSkip: () => {
      setTutorialDone(true);
      resumeTutorialPause();
      disposeTutorial();
    }
  });
  tutorial.start();
}

function installRosterRenderer(renderer: (entries: RosterEntry[]) => void): void {
  pendingRosterRenderer = renderer;
  if (!rosterHud) {
    return;
  }
  rosterHud.installRenderer(renderer);
  if (pendingRosterEntries) {
    rosterHud.renderRoster(pendingRosterEntries);
    pendingRosterEntries = null;
  }
}

export function loadUnits(): Saunoja[] {
  return loadRosterFromStorage();
}

export function saveUnits(): void {
  persistRosterToStorage(saunojas);
}

function isSaunojaPersonaMissing(saunoja: Saunoja): boolean {
  const traits = Array.isArray(saunoja.traits) ? saunoja.traits : [];
  const hasTraits = traits.length >= 3;
  const upkeepValid = Number.isFinite(saunoja.upkeep);
  const xpValid = Number.isFinite(saunoja.xp);
  const appearanceValid =
    typeof saunoja.appearanceId === 'string' && saunoja.appearanceId.trim().length > 0;
  return !hasTraits || !upkeepValid || !xpValid || !appearanceValid;
}

function refreshSaunojaPersona(saunoja: Saunoja): void {
  saunoja.traits = generateTraits();
  const nextUpkeep = rollSaunojaUpkeep();
  withSaunojaBaseline(saunoja, (baseline) => {
    baseline.upkeep = nextUpkeep;
  });
  saunoja.xp = 0;
  if (typeof saunoja.appearanceId !== 'string' || saunoja.appearanceId.trim().length === 0) {
    saunoja.appearanceId = resolveSaunojaAppearance();
  }
  const attached = getAttachedUnitFor(saunoja);
  attached?.setAppearanceId(saunoja.appearanceId);
}

function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ay - by));
}

export interface SetupGameOptions {
  hudVariant?: 'classic' | 'v2';
}

export function setupGame(
  canvasEl: HTMLCanvasElement,
  resourceBarEl: HTMLElement,
  overlayEl: HTMLElement,
  options: SetupGameOptions = {}
): void {
  const hudVariant = options.hudVariant ?? 'classic';
  const useClassicHud = hudVariant === 'classic';
  overlayEl.dataset.hudVariant = hudVariant;
  disposeUiV2Controllers();
  hudElapsedMs = 0;
  notifyHudElapsed();
  notifyEnemyRamp(null);
  lastRosterEntries = [];
  lastRosterSummary = null;
  canvas = canvasEl;
  if (unitFx) {
    unitFx.dispose();
    unitFx = null;
  }
  if (combatAnimations) {
    combatAnimations.dispose();
    combatAnimations = null;
  }
  unitFx = createUnitFxManager({
    canvas: canvasEl,
    overlay: overlayEl,
    mapRenderer,
    getUnitById: (id) => unitsById.get(id),
    requestDraw: invalidateFrame
  });
  combatAnimations = createUnitCombatAnimator({
    getUnitById: (id) => unitsById.get(id),
    requestDraw: invalidateFrame
  });
  syncSelectionOverlay();
  if (rosterHud) {
    rosterHud.destroy();
    rosterHud = null;
  }
  saunaUiController?.dispose();
  saunaUiController = null;
  topbarControls?.dispose();
  topbarControls = null;
  actionBarController?.destroy();
  actionBarController = null;

  const actionBarAbilities: ActionBarAbilityHandlers = {
    useSisuBurst: () => {
      const used = useSisuBurst(state, units);
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
      const used = torille(state, units, sauna.pos, map);
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
  inventoryHudController?.destroy();
  inventoryHudController = null;
  const buildSaunaShopViewModel = (): SaunaShopViewModel => {
    const context = resolveTierContext();
    return {
      balance: getArtocoinBalance(),
      tiers: listSaunaTiers().map((tier) => ({
        tier,
        status: evaluateSaunaTier(tier, context)
      }))
    } satisfies SaunaShopViewModel;
  };

  const hudResult = useClassicHud
    ? initializeClassicHud({
        resourceBarEl,
        rosterIcon: uiIcons.saunojaRoster,
        sauna,
        previousDisposeRightPanel: disposeRightPanel,
        pendingRosterRenderer,
        pendingRosterEntries,
        pendingRosterSummary,
        setupRosterHUD,
        setupSaunaUi: (saunaInstance, options) => setupSaunaUI(saunaInstance, options),
        getActiveTierId: () => currentTierId,
        setActiveTier: (tierId, options) => setActiveTier(tierId, options),
        getTierContext: () => getTierContext(),
        setupTopbar: () =>
          setupTopbar(state, {
            saunakunnia: uiIcons.resource,
            sisu: uiIcons.sisu,
            saunaBeer: uiIcons.saunaBeer,
            artocoin: uiIcons.artocoin
          }),
        setupActionBar: (abilities) => setupActionBar(state, overlayEl, abilities),
        actionBarAbilities,
        setupInventoryHud: () =>
          setupInventoryHud(inventory, {
            getSelectedUnitId: () => saunojas.find((unit) => unit.selected)?.id ?? null,
            getComparisonContext: () => getSelectedInventoryContext(),
            onEquip: (unitId, item, _source) => equipItemToSaunoja(unitId, item),
            getUseUiV2,
            onUseUiV2Change: setUseUiV2,
            getSaunaShopViewModel: () => buildSaunaShopViewModel(),
            onPurchaseSaunaTier: (tierId) =>
              purchaseSaunaTier(getSaunaTier(tierId), {
                getCurrentBalance: () => getArtocoinBalance()
              }),
            subscribeToSaunaShop: (listener) => subscribeToSaunaShopState(listener)
          }),
        createRightPanel: (onRendererReady) => initializeRightPanel(onRendererReady),
        syncSaunojaRosterWithUnits: () => syncSaunojaRosterWithUnits(),
        updateRosterDisplay: () => updateRosterDisplay(),
        startTutorialIfNeeded: () => startTutorialIfNeeded()
      })
    : initializeModernHud({
        previousDisposeRightPanel: disposeRightPanel,
        setupActionBar: (abilities) => setupActionBar(state, overlayEl, abilities),
        actionBarAbilities,
        createRosterController: (options) => createUiV2RosterController(options),
        rosterSummary: {
          getSummary: () => getRosterSummarySnapshot(),
          subscribeSummary: (listener) => subscribeRosterSummary(listener),
          getEntries: () => getRosterEntriesSnapshot(),
          subscribeEntries: (listener) => subscribeRosterEntries(listener)
        },
        createTopbarController: (options) => createUiV2TopbarController(options),
        topbar: {
          getResource: (resource) => state.getResource(resource),
          subscribeResourceChange: (listener) => {
            const handler = (
              payload: { resource: Resource; total: number; amount: number }
            ) => {
              listener(payload);
            };
            eventBus.on('resourceChanged', handler);
            return () => {
              eventBus.off('resourceChanged', handler);
            };
          },
          getArtocoinBalance: () => getArtocoinBalance(),
          subscribeArtocoinChange: (listener) => onArtocoinChange(listener),
          getElapsedMs: () => getHudElapsedMs(),
          subscribeHudTime: (listener) => subscribeHudTime(listener),
          getEnemyRamp: () => lastEnemyRampSummary,
          subscribeEnemyRamp: (listener) => subscribeEnemyRamp(listener)
        },
        createInventoryController: (options) => createUiV2InventoryController(options),
        inventory: {
          buildSaunaShopViewModel,
          subscribeToSaunaShop: (listener) => subscribeToSaunaShopState(listener),
          getUseUiV2,
          setUseUiV2
        },
        createLogController: (options) => createUiV2LogController(options),
        log: {
          getHistory: () => getLogHistory(),
          subscribe: (listener) => subscribeToLogs(listener)
        },
        createSaunaController: (options) => createUiV2SaunaController(options),
        sauna: {
          getSauna: () => sauna,
          setupSaunaUi: (saunaInstance, controllerOptions) =>
            setupSaunaUI(saunaInstance, controllerOptions),
          setExternalController: setExternalSaunaUiController,
          getActiveTierId: () => currentTierId,
          setActiveTierId: (tierId, opts) => setActiveTier(tierId, opts),
          getTierContext: () => getTierContext()
        }
      });

  rosterHud = hudResult.rosterHud;
  pendingRosterRenderer = hudResult.pendingRosterRenderer;
  pendingRosterEntries = hudResult.pendingRosterEntries;
  pendingRosterSummary = hudResult.pendingRosterSummary;
  saunaUiController = hudResult.saunaUiController;
  topbarControls = hudResult.topbarControls;
  actionBarController = hudResult.actionBarController;
  inventoryHudController = hudResult.inventoryHudController;
  disposeRightPanel = hudResult.disposeRightPanel;
  addEvent = hudResult.addEvent;
  uiV2RosterController = hudResult.uiV2RosterController;
  uiV2TopbarController = hudResult.uiV2TopbarController;
  uiV2InventoryController = hudResult.uiV2InventoryController;
  uiV2LogController = hudResult.uiV2LogController;
  uiV2SaunaController = hudResult.uiV2SaunaController;
  hudResult.postSetup?.();
}

const map = new HexMap(10, 10, 32);
const animator = new Animator(() => invalidateFrame());
const battleManager = new BattleManager(map, animator);
const mapRenderer = new HexMapRenderer(map);
const invalidateTerrainCache = (): void => {
  mapRenderer.invalidateCache();
  invalidateFrame();
};
eventBus.on('buildingPlaced', invalidateTerrainCache);
eventBus.on('buildingRemoved', invalidateTerrainCache);
// Ensure all tiles start fogged
map.forEachTile((t) => t.setFogged(true));
resetAutoFrame();

const units: Unit[] = [];
const unitVisionSnapshots = new Map<string, { coordKey: string; radius: number }>();

function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

function pickRandomEdgeFreeTile(): AxialCoord | undefined {
  const occupied = new Set<string>();
  for (const unit of units) {
    if (!unit.isDead()) {
      occupied.add(coordKey(unit.coord));
    }
  }

  const candidates: AxialCoord[] = [];
  const { minQ, maxQ, minR, maxR } = map;

  const addCandidate = (coord: AxialCoord): void => {
    const key = coordKey(coord);
    if (occupied.has(key)) {
      return;
    }
    map.ensureTile(coord.q, coord.r);
    candidates.push(coord);
  };

  for (let q = minQ; q <= maxQ; q++) {
    addCandidate({ q, r: minR });
    if (maxR !== minR) {
      addCandidate({ q, r: maxR });
    }
  }

  for (let r = minR + 1; r <= maxR - 1; r++) {
    addCandidate({ q: minQ, r });
    if (maxQ !== minQ) {
      addCandidate({ q: maxQ, r });
    }
  }

  if (candidates.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

type UnitSpawnedPayload = { unit: Unit };

function detachSaunoja(unitId: string): void {
  const saunoja = unitToSaunoja.get(unitId);
  if (!saunoja) {
    return;
  }
  saunojaPolicyBaselines.delete(saunoja);
  unitVisionSnapshots.delete(unitId);
  unitToSaunoja.delete(unitId);
  if (saunojaToUnit.get(saunoja.id) === unitId) {
    saunojaToUnit.delete(saunoja.id);
  }
}

function claimSaunoja(
  unit: Unit
): { saunoja: Saunoja; created: boolean; attached: boolean } {
  const existing = unitToSaunoja.get(unit.id);
  if (existing) {
    return { saunoja: existing, created: false, attached: false };
  }

  let match = saunojas.find((candidate) => candidate.id === unit.id);
  if (!match) {
    match = saunojas.find((candidate) => !saunojaToUnit.has(candidate.id));
  }

  let created = false;
  if (!match) {
    match = makeSaunoja({
      id: `saunoja-${saunojas.length + 1}`,
      coord: { q: unit.coord.q, r: unit.coord.r }
    });
    saunojas.push(match);
    created = true;
    saunojaPolicyBaselines.set(match, {
      base: cloneStatBlock(match.baseStats),
      upkeep: Number.isFinite(match.upkeep) ? Math.max(0, match.upkeep) : SAUNOJA_DEFAULT_UPKEEP
    });
  }

  const previousUnitId = saunojaToUnit.get(match.id);
  if (previousUnitId && previousUnitId !== unit.id) {
    unitToSaunoja.delete(previousUnitId);
  }

  unitToSaunoja.set(unit.id, match);
  saunojaToUnit.set(match.id, unit.id);

  ensureSaunojaPolicyBaseline(match);
  applySaunojaBehaviorPreference(match, match.behavior, unit);
  updateBaseStatsFromUnit(match, unit);
  unit.setExperience(match.xp);
  if (typeof match.appearanceId === 'string' && match.appearanceId.trim().length > 0) {
    unit.setAppearanceId(match.appearanceId);
  }

  const personaMissing = isSaunojaPersonaMissing(match);
  if (created || personaMissing) {
    refreshSaunojaPersona(match);
  }

  return { saunoja: match, created, attached: true };
}

function syncSaunojaRosterWithUnits(): boolean {
  let changed = false;

  for (const unit of units) {
    if (unit.faction !== 'player' || unit.isDead()) {
      continue;
    }

    const { saunoja, created, attached } = claimSaunoja(unit);
    if (created || attached) {
      changed = true;
    }

    const normalizedHp = Number.isFinite(unit.stats.health) ? Math.max(0, unit.stats.health) : 0;
    if (saunoja.hp !== normalizedHp) {
      saunoja.hp = normalizedHp;
      changed = true;
    }

    const normalizedMaxHp = Number.isFinite(unit.getMaxHealth()) ? Math.max(1, unit.getMaxHealth()) : 1;
    if (saunoja.maxHp !== normalizedMaxHp) {
      saunoja.maxHp = normalizedMaxHp;
      changed = true;
    }

    const shieldValue = unit.getShield();
    const normalizedShield = Number.isFinite(shieldValue) ? Math.max(0, shieldValue) : 0;
    if (saunoja.shield !== normalizedShield) {
      saunoja.shield = normalizedShield;
      changed = true;
    }

    const unitWithLastHit = unit as unknown as { lastHitAt?: number };
    const lastHitAt = unitWithLastHit?.lastHitAt;
    if (Number.isFinite(lastHitAt) && saunoja.lastHitAt !== lastHitAt) {
      saunoja.lastHitAt = lastHitAt as number;
      changed = true;
    }

    const { q, r } = unit.coord;
    if (saunoja.coord.q !== q || saunoja.coord.r !== r) {
      saunoja.coord = { q, r };
      changed = true;
      if (saunoja.selected) {
        setSelectedCoord(saunoja.coord);
      }
    }
  }

  if (changed) {
    saveUnits();
    syncSelectionOverlay();
  }

  return changed;
}

function describeUnit(unit: Unit, attachedSaunoja?: Saunoja | null): string {
  if (unit.faction === 'player') {
    const persona = attachedSaunoja ?? unitToSaunoja.get(unit.id) ?? null;
    const name = persona?.name?.trim();
    if (name) {
      return name;
    }
  }

  const ctorName = unit.constructor?.name ?? 'Unit';
  const spacedName = ctorName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `${spacedName} ${unit.id}`.trim();
}

function registerUnit(unit: Unit): void {
  if (unitsById.has(unit.id)) {
    return;
  }
  units.push(unit);
  unitsById.set(unit.id, unit);
  let persona: Saunoja | null = null;
  if (unit.faction === 'player') {
    const changed = syncSaunojaRosterWithUnits();
    if (!changed) {
      refreshRosterPanel();
    }
    persona = unitToSaunoja.get(unit.id) ?? null;
  }
  if (canvas) {
    invalidateFrame();
  }
  if (unit.faction === 'player') {
    const steward = 'Our';
    const unitName = describeUnit(unit, persona);
    logEvent({
      type: 'spawn',
      message: `${steward} ${unitName} emerges from the steam.`,
      metadata: {
        unitId: unit.id,
        unitName,
        steward
      }
    });
    updateRosterDisplay();
  }
}

const onUnitSpawned = ({ unit }: UnitSpawnedPayload): void => {
  registerUnit(unit);
};

eventBus.on('unitSpawned', onUnitSpawned);

const onInventoryChanged = (): void => {
  refreshRosterPanel();
};

const onModifierChanged = (): void => {
  refreshRosterPanel();
};

eventBus.on('inventoryChanged', onInventoryChanged);
eventBus.on('modifierAdded', onModifierChanged);
eventBus.on('modifierRemoved', onModifierChanged);
eventBus.on('modifierExpired', onModifierChanged);

const onSaunaDamaged = (payload: SaunaDamagedPayload): void => {
  saunaUiController?.handleDamage?.(payload);
};

const onSaunaDestroyed = (payload: SaunaDestroyedPayload): void => {
  saunaUiController?.handleDestroyed?.(payload);
};

eventBus.on('saunaDamaged', onSaunaDamaged);
eventBus.on('saunaDestroyed', onSaunaDestroyed);

const onUnitStatsChanged = (): void => {
  updateRosterDisplay();
};

eventBus.on('unit:stats:changed', onUnitStatsChanged);

const onPolicyLifecycleChanged = (): void => {
  recalculatePolicyModifiers();
};

eventBus.on(POLICY_EVENTS.APPLIED, onPolicyLifecycleChanged);
eventBus.on(POLICY_EVENTS.REVOKED, onPolicyLifecycleChanged);

function resolveUnitUpkeep(unit: Unit): number {
  const attendant = unitToSaunoja.get(unit.id);
  if (!attendant) {
    return 0;
  }
  const upkeep = Number.isFinite(attendant.upkeep) ? attendant.upkeep : 0;
  return Math.max(0, Math.round(upkeep));
}

const state = new GameState(1000);

function recalculatePolicyModifiers(): void {
  const activePolicies = listPolicies().filter((definition) => state.hasPolicy(definition.id));
  const summary = combinePolicyModifiers(activePolicies);
  policyModifiers = summary;
  setActivePolicyModifiers(summary);
  if (refreshAllSaunojaPolicyAdjustments()) {
    saveUnits();
  }
}

const inventory = new InventoryState();
reloadSaunaShopState();
const restoredSave = state.load(map);
if (restoredSave) {
  const hydratedNgPlus = state.getNgPlusState();
  applyNgPlusState(hydratedNgPlus);
  saveNgPlusState(hydratedNgPlus);
} else {
  const seededNgPlus = state.setNgPlusState(currentNgPlusState);
  applyNgPlusState(seededNgPlus);
  saveNgPlusState(seededNgPlus);
}
state.setEnemyScalingBase({
  aggression: 1,
  cadence: 1,
  strength: 1
});
const saunaSettings = loadSaunaSettings();

if (currentNgPlusState.unlockSlots >= 2) {
  setPurchasedTierIds(grantSaunaTier('aurora-ward'));
}
if (currentNgPlusState.ngPlusLevel >= 3) {
  setPurchasedTierIds(grantSaunaTier('mythic-conclave'));
}
if (
  saunaSettings.activeTierId !== DEFAULT_SAUNA_TIER_ID &&
  !getPurchasedTierIds().has(saunaSettings.activeTierId)
) {
  setPurchasedTierIds(grantSaunaTier(saunaSettings.activeTierId));
}
const resolveTierContext = (): SaunaTierContext => ({
  artocoinBalance: getArtocoinBalance(),
  ownedTierIds: getPurchasedTierIds()
});

let currentTierId: SaunaTierId = saunaSettings.activeTierId;
let useUiV2 = saunaSettings.useUiV2;
const initialTierStatus = evaluateSaunaTier(getSaunaTier(currentTierId), resolveTierContext());
if (!initialTierStatus.unlocked) {
  currentTierId = DEFAULT_SAUNA_TIER_ID;
}
const activeTier = getSaunaTier(currentTierId);

const getActiveTierLimit = (): number => {
  const tier = getSaunaTier(currentTierId);
  const cap = Math.max(0, Math.floor(tier.rosterCap));
  return cap;
};

const initialRosterCap = clampRosterCap(saunaSettings.maxRosterSize, getActiveTierLimit());
if (
  initialRosterCap !== saunaSettings.maxRosterSize ||
  saunaSettings.activeTierId !== currentTierId ||
  saunaSettings.useUiV2 !== useUiV2
) {
  saveSaunaSettings({
    maxRosterSize: initialRosterCap,
    activeTierId: currentTierId,
    useUiV2
  });
}
const sauna = createSauna(
  {
    q: Math.floor(map.width / 2),
    r: Math.floor(map.height / 2)
  },
  undefined,
  { maxRosterSize: initialRosterCap, tier: activeTier }
);

const sanitizeVisionRange = (value: number): number =>
  Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));

const updateSaunaVisionFromTier = (tier: SaunaTier, options: { reveal?: boolean } = {}): void => {
  const resolved = sanitizeVisionRange(tier.visionRange);
  if (resolved !== sauna.visionRange) {
    sauna.visionRange = resolved;
  }
  if (options.reveal) {
    map.revealAround(sauna.pos, sauna.visionRange);
  }
};

updateSaunaVisionFromTier(activeTier);

const resolveSpawnLimit = (): number => Math.max(MIN_SPAWN_LIMIT, sauna.maxRosterSize);

const getUseUiV2 = (): boolean => useUiV2;

const setUseUiV2 = (next: boolean): void => {
  const normalized = Boolean(next);
  if (useUiV2 === normalized) {
    return;
  }
  persistSaunaSettings(sauna.maxRosterSize, { useUiV2: normalized });
};

export const disableUiV2 = (): void => {
  setUseUiV2(false);
};

const spawnTierQueue = createPlayerSpawnTierQueue({
  getTier: () => getSaunaTier(currentTierId),
  getRosterLimit: () => getActiveTierLimit(),
  getRosterCount: () => getActiveRosterCount(),
  log: (event) => logEvent(event),
  queueCapacity: 3
});

let lastPersistedRosterCap = initialRosterCap;
let lastPersistedTierId = currentTierId;

const persistSaunaSettings = (cap: number, overrides?: { useUiV2?: boolean }): void => {
  if (typeof overrides?.useUiV2 === 'boolean') {
    useUiV2 = overrides.useUiV2;
  }
  saveSaunaSettings({ maxRosterSize: cap, activeTierId: currentTierId, useUiV2 });
  lastPersistedRosterCap = cap;
  lastPersistedTierId = currentTierId;
};


const getTierContext = (): SaunaTierContext => resolveTierContext();

const updateRosterCap = (
  value: number,
  options: { persist?: boolean } = {}
): number => {
  const limit = getActiveTierLimit();
  const sanitized = clampRosterCap(value, limit);
  const changed = sanitized !== sauna.maxRosterSize;
  if (changed) {
    sauna.maxRosterSize = sanitized;
  }
  if (options.persist) {
    const tierChanged = currentTierId !== lastPersistedTierId;
    if (tierChanged || sanitized !== lastPersistedRosterCap) {
      persistSaunaSettings(sanitized);
    }
  }
  return sanitized;
};

syncActiveTierWithUnlocks = (options: { persist?: boolean } = {}): void => {
  const context = getTierContext();
  const tiers = listSaunaTiers();
  let highestUnlockedId = DEFAULT_SAUNA_TIER_ID;
  for (const tier of tiers) {
    const status = evaluateSaunaTier(tier, context);
    if (status.unlocked) {
      highestUnlockedId = tier.id;
    } else {
      break;
    }
  }

  const currentStatus = evaluateSaunaTier(getSaunaTier(currentTierId), context);
  const tierChanged = !currentStatus.unlocked || currentTierId !== highestUnlockedId;
  if (tierChanged) {
    const previousTierId = currentTierId;
    currentTierId = highestUnlockedId;
    const nextTier = getSaunaTier(currentTierId);
    updateSaunaVisionFromTier(nextTier, { reveal: true });
    spawnTierQueue.clearQueue?.('tier-change');
    updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
    if (previousTierId !== currentTierId) {
      saunaUiController?.update?.();
    }
    updateRosterDisplay();
    return;
  }

  if (options.persist) {
    updateRosterCap(sauna.maxRosterSize, { persist: true });
    updateRosterDisplay();
  }
};

syncActiveTierWithUnlocks({ persist: true });

onSaunaShopChange((event: SaunaShopChangeEvent) => {
  if (event.type === 'purchase' && event.cost && event.spendResult?.success) {
    addArtocoinSpend(event.cost);
  }
  setPurchasedTierIds(event.purchased);
  notifySaunaShopSubscribers();
  syncActiveTierWithUnlocks({ persist: true });
  saunaUiController?.update?.();
});

onArtocoinChange((change: ArtocoinChangeEvent) => {
  setArtocoinBalance(change.balance);
  notifySaunaShopSubscribers();
  saunaUiController?.update?.();
});

const setActiveTier = (
  tierId: SaunaTierId,
  options: { persist?: boolean } = {}
): boolean => {
  const tier = getSaunaTier(tierId);
  const status = evaluateSaunaTier(tier, getTierContext());
  if (!status.unlocked) {
    return false;
  }
  if (tier.id === currentTierId) {
    if (options.persist && currentTierId !== lastPersistedTierId) {
      persistSaunaSettings(sauna.maxRosterSize);
    }
    return true;
  }
  currentTierId = tier.id;
  updateSaunaVisionFromTier(tier, { reveal: true });
  spawnTierQueue.clearQueue?.('tier-change');
  updateRosterCap(sauna.maxRosterSize, { persist: options.persist });
  return true;
};

const spawnPlayerReinforcement = (coord: AxialCoord): Unit | null => {
  playerSpawnSequence += 1;
  const id = `p${Date.now()}-${playerSpawnSequence}`;
  const unit = spawnUnit(state, 'soldier', id, coord, 'player', {
    appearanceRandom: () => Math.random()
  });
  if (unit) {
    registerUnit(unit);
  }
  return unit ?? null;
};
const enemySpawner = new EnemySpawner({
  difficulty: BASE_ENEMY_DIFFICULTY,
  random: enemyRandom,
  eliteOdds: BASE_ELITE_ODDS
});
const clock = new GameClock(1000, (deltaMs) => {
  const dtSeconds = deltaMs / 1000;
  state.tick();
  eventScheduler.tick(dtSeconds, { state });
  const rampModifiers: EnemyScalingSnapshot = state.getEnemyScalingSnapshot();
  const rosterCap = updateRosterCap(sauna.maxRosterSize);
  runEconomyTick({
    dt: dtSeconds,
    state,
    sauna,
    heat: sauna.heatTracker,
    units,
    getUnitUpkeep: resolveUnitUpkeep,
    pickSpawnTile: () => pickFreeTileAround(sauna.pos, units),
    spawnBaseUnit: spawnPlayerReinforcement,
    minUpkeepReserve: Math.max(1, SAUNOJA_UPKEEP_MIN),
    maxSpawns: resolveSpawnLimit(),
    rosterCap,
    getRosterCount: getActiveRosterCount,
    tierHelpers: spawnTierQueue
  });
  const runtimeModifiers: EnemySpawnerRuntimeModifiers = {
    aggressionMultiplier: rampModifiers.aggression,
    cadenceMultiplier: rampModifiers.cadence,
    strengthMultiplier: rampModifiers.strength,
    calmSecondsRemaining: rampModifiers.calmSecondsRemaining
  };
  enemySpawner.update(dtSeconds, units, registerUnit, pickRandomEdgeFreeTile, runtimeModifiers);
  state.advanceEnemyCalm(dtSeconds);
  const scalingSnapshot = enemySpawner.getSnapshot();
  const calmSecondsRemaining = Math.max(
    rampModifiers.calmSecondsRemaining,
    scalingSnapshot.calmSecondsRemaining
  );
  const rampSummary: EnemyRampSummary = {
    stage: scalingSnapshot.rampStageLabel,
    stageIndex: scalingSnapshot.rampStageIndex,
    bundleTier: scalingSnapshot.bundleTier,
    multiplier: scalingSnapshot.difficultyMultiplier,
    cadenceSeconds: scalingSnapshot.cadence,
    effectiveDifficulty: scalingSnapshot.effectiveDifficulty,
    aggressionMultiplier: scalingSnapshot.aggressionMultiplier,
    cadenceMultiplier: scalingSnapshot.cadenceMultiplier,
    strengthMultiplier: scalingSnapshot.strengthMultiplier,
    calmSecondsRemaining,
    spawnCycles: scalingSnapshot.spawnCycles
  } satisfies EnemyRampSummary;
  notifyEnemyRamp(rampSummary);
  if (topbarControls) {
    topbarControls.setEnemyRampSummary(rampSummary);
  }
  const rosterProgress = objectiveTracker?.getProgress().roster;
  recordEnemyScalingTelemetry(scalingSnapshot, {
    wipeSince: rosterProgress?.wipeSince ?? null,
    wipeDurationMs: rosterProgress?.wipeDurationMs ?? 0
  });
  battleManager.tick(units, dtSeconds, sauna);
  advanceModifiers(dtSeconds);
  if (syncSaunojaRosterWithUnits()) {
    updateRosterDisplay();
  }
  state.save();
  // Reveal around all active units before rendering so fog-of-war keeps pace with combat
  for (const unit of units) {
    if (unit.isDead() || unit.faction !== 'player') {
      continue;
    }

    const rawRadius = unit.getVisionRange();
    const radius = Number.isFinite(rawRadius) ? Math.max(0, Math.round(rawRadius)) : 0;
    const currentKey = coordKey(unit.coord);
    const snapshot = unitVisionSnapshots.get(unit.id);
    if (snapshot && snapshot.coordKey === currentKey && snapshot.radius === radius) {
      continue;
    }

    map.revealAround(unit.coord, radius, { autoFrame: false });
    unitVisionSnapshots.set(unit.id, { coordKey: currentKey, radius });
  }
  invalidateFrame();
});

const handleObjectiveResolution = (resolution: ObjectiveResolution): void => {
  if (running) {
    running = false;
  }
  clock.stop();
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  invalidateFrame();
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return;
  }
  if (endScreen) {
    endScreen.destroy();
    endScreen = null;
  }
  const snapshot = enemySpawner.getSnapshot();
  const payout = calculateArtocoinPayout(resolution.outcome, {
    tierId: currentTierId,
    runSeconds: Math.max(0, sanitizeObjectiveMetric(resolution.durationMs) / 1000),
    enemyKills: Math.max(0, sanitizeObjectiveMetric(resolution.summary.enemyKills)),
    tilesExplored: Math.max(
      0,
      sanitizeObjectiveMetric(resolution.summary.exploration.revealedHexes)
    ),
    rosterLosses: Math.max(0, sanitizeObjectiveMetric(resolution.summary.roster.totalDeaths)),
    difficultyScalar: snapshot.effectiveDifficulty,
    rampStageIndex: snapshot.rampStageIndex
  });
  if (payout.artocoins > 0) {
    const previousBalance = getArtocoinBalance();
    const nextBalance = creditArtocoins(payout.artocoins, {
      reason: 'payout',
      metadata: {
        outcome: resolution.outcome,
        tier: currentTierId
      },
      previousBalance
    });
    setArtocoinBalance(nextBalance);
  }
  const nextRunNgPlusState = planNextNgPlusRun(currentNgPlusState, {
    outcome: resolution.outcome
  });
  saveNgPlusState(nextRunNgPlusState);
  state.setNgPlusState(nextRunNgPlusState);
  applyNgPlusState(nextRunNgPlusState);
  const controller = showEndScreen({
    container: overlay,
    resolution,
    artocoinSummary: {
      balance: getArtocoinBalance(),
      earned: payout.artocoins,
      spent: getArtocoinsSpentThisRun()
    },
    resourceLabels: RESOURCE_LABELS,
    onNewRun: () => {
      if (import.meta.env.DEV) {
        console.debug('Advancing to NG+ run', {
          level: nextRunNgPlusState.ngPlusLevel,
          unlockSlots: nextRunNgPlusState.unlockSlots
        });
      }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage?.removeItem?.('gameState');
        }
      } catch (error) {
        console.warn('Failed to reset saved game state for NG+', error);
      }
      if (typeof window !== 'undefined' && typeof window.location?.reload === 'function') {
        window.setTimeout(() => window.location.reload(), 75);
      }
    },
    onDismiss: () => {
      if (endScreen) {
        endScreen.destroy();
        endScreen = null;
      }
    }
  });
  endScreen = controller;
};
saunojas = loadUnits();
for (const unit of saunojas) {
  const upkeep = Number.isFinite(unit.upkeep) ? Math.max(0, unit.upkeep) : SAUNOJA_DEFAULT_UPKEEP;
  saunojaPolicyBaselines.set(unit, { base: cloneStatBlock(unit.baseStats), upkeep });
}
if (saunojas.length === 0) {
  const seeded = makeSaunoja({
    id: 'saunoja-1',
    coord: sauna.pos,
    selected: true,
    upkeep: SAUNOJA_DEFAULT_UPKEEP
  });
  refreshSaunojaPersona(seeded);
  seeded.upkeep = SAUNOJA_DEFAULT_UPKEEP;
  saunojas.push(seeded);
  saunojaPolicyBaselines.set(seeded, {
    base: cloneStatBlock(seeded.baseStats),
    upkeep: SAUNOJA_DEFAULT_UPKEEP
  });
  saveUnits();
  if (import.meta.env.DEV) {
    const storage = getSaunojaStorage();
    const storedValue = storage?.getItem(SAUNOJA_STORAGE_KEY);
    console.debug('Seeded Saunoja storage with default attendant', {
      storageAvailable: Boolean(storage),
      storageKeyPresent: typeof storedValue === 'string'
    });
  }
} else {
  let foundSelected = false;
  let selectionDirty = false;
  for (const unit of saunojas) {
    if (!unit.selected) continue;
    if (!foundSelected) {
      foundSelected = true;
    } else {
      unit.selected = false;
      selectionDirty = true;
    }
  }
  if (selectionDirty) {
    saveUnits();
  }
}
recalculatePolicyModifiers();
const hasActivePlayerUnit = units.some((unit) => unit.faction === 'player' && !unit.isDead());
if (!hasActivePlayerUnit) {
  if (!state.canAfford(SOLDIER_COST, Resource.SAUNA_BEER)) {
    state.addResource(Resource.SAUNA_BEER, SOLDIER_COST);
  }
  const fallbackId = `u${units.length + 1}`;
  const fallbackUnit = spawnUnit(state, 'soldier', fallbackId, sauna.pos, 'player', {
    appearanceRandom: () => Math.random()
  });
  if (fallbackUnit) {
    registerUnit(fallbackUnit);
  }
}
map.revealAround(sauna.pos, sauna.visionRange);
if (import.meta.env.DEV) {
  console.debug('Saunoja roster restored', {
    count: saunojas.length,
    coordinates: saunojas.map((unit) => ({ q: unit.coord.q, r: unit.coord.r }))
  });
}
objectiveTracker = createObjectiveTracker({
  state,
  map,
  getRosterCount: getActiveRosterCount,
  sauna,
  rosterWipeGraceMs: 8000,
  bankruptcyGraceMs: 12000
});
lastStrongholdsDestroyed = objectiveTracker.getProgress().strongholds.destroyed;
objectiveTracker.onProgress(handleObjectiveProgress);
objectiveTracker.onResolution(handleObjectiveResolution);
function getSelectedInventoryContext(): InventoryComparisonContext | null {
  const selected = saunojas.find((unit) => unit.selected) ?? null;
  if (!selected) {
    return null;
  }
  return {
    baseStats: { ...selected.baseStats },
    loadout: loadoutItems(selected.equipment),
    currentStats: { ...selected.effectiveStats }
  } satisfies InventoryComparisonContext;
}

function initializeRightPanel(
  onRosterRendererReady: (renderer: (entries: RosterEntry[]) => void) => void
): { addEvent: (event: GameEvent) => void; dispose: () => void } {
  const rightPanel = setupRightPanel(state, {
    onRosterSelect: focusSaunojaById,
    onRosterRendererReady: (renderer) => {
      onRosterRendererReady(renderer);
    },
    onRosterEquipSlot: equipSlotFromStash,
    onRosterUnequipSlot: unequipSlotToStash,
    onRosterBehaviorChange: (unitId, nextBehavior) => {
      const attendant = saunojas.find((unit) => unit.id === unitId);
      if (!attendant) {
        return;
      }
      if (attendant.behavior === nextBehavior) {
        return;
      }
      attendant.behavior = nextBehavior;
      const attachedUnit = getAttachedUnitFor(attendant);
      attachedUnit?.setBehavior(nextBehavior);
      saveUnits();
      updateRosterDisplay();
    },
    getRosterCap: () => Math.max(0, Math.floor(sauna.maxRosterSize)),
    getRosterCapLimit: () => getActiveTierLimit(),
    updateMaxRosterSize: (value, opts) => {
      const next = updateRosterCap(value, { persist: opts?.persist });
      if (opts?.persist) {
        updateRosterDisplay();
      }
      return next;
    }
  });
  onRosterRendererReady(rightPanel.renderRoster);
  return {
    addEvent: rightPanel.addEvent,
    dispose: rightPanel.dispose
  };
}

function updateSaunaHud(): void {
  saunaUiController?.update();
}

function updateTopbarHud(deltaMs: number): void {
  if (Number.isFinite(deltaMs) && deltaMs > 0) {
    hudElapsedMs += deltaMs;
  }
  notifyHudElapsed();
  topbarControls?.update(deltaMs);
}


function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player', {
    appearanceRandom: () => Math.random()
  });
  if (unit) {
    registerUnit(unit);
  }
}

if (!restoredSave) {
  state.addResource(Resource.SAUNA_BEER, INITIAL_SAUNA_BEER);
  logEvent({
    type: 'resource',
    message: `Quartermaster stocks ${INITIAL_SAUNA_BEER} bottles of ${RESOURCE_LABELS[Resource.SAUNA_BEER]} to launch your campaign.`,
    metadata: {
      resource: Resource.SAUNA_BEER,
      amount: INITIAL_SAUNA_BEER,
      context: 'initial'
    }
  });
  state.addResource(Resource.SAUNAKUNNIA, INITIAL_SAUNAKUNNIA);
  logEvent({
    type: 'resource',
    message: `Sauna elders honor your leadership with ${INITIAL_SAUNAKUNNIA} ${RESOURCE_LABELS[Resource.SAUNAKUNNIA]} to celebrate your arrival.`,
    metadata: {
      resource: Resource.SAUNAKUNNIA,
      amount: INITIAL_SAUNAKUNNIA,
      context: 'initial'
    }
  });
}

const storedSelection = saunojas.find((unit) => unit.selected);
if (storedSelection) {
  selected = { q: storedSelection.coord.q, r: storedSelection.coord.r };
}

function coordsEqual(a: AxialCoord | null, b: AxialCoord | null): boolean {
  if (!a || !b) {
    return a === b;
  }
  return a.q === b.q && a.r === b.r;
}

function setSelectedCoord(next: AxialCoord | null): boolean {
  if (coordsEqual(selected, next)) {
    return false;
  }
  selected = next ? { q: next.q, r: next.r } : null;
  syncSelectionOverlay();
  return true;
}

function deselectAllSaunojas(except?: Saunoja): boolean {
  let changed = false;
  for (const unit of saunojas) {
    if (except && unit === except) {
      continue;
    }
    if (unit.selected) {
      unit.selected = false;
      changed = true;
    }
  }
  return changed;
}

function clearSaunojaSelection(): boolean {
  let changed = false;
  if (selectedUnitId !== null) {
    selectedUnitId = null;
    changed = true;
  }
  if (deselectAllSaunojas()) {
    changed = true;
  }
  if (setSelectedCoord(null)) {
    changed = true;
  }
  if (!changed) {
    syncSelectionOverlay();
  }
  return changed;
}

function isEliteUnit(unit: Unit | null): boolean {
  if (!unit) {
    return false;
  }
  const archetype = tryGetUnitArchetype(unit.type);
  if (!archetype) {
    return false;
  }
  const baseline = computeUnitStats(archetype, 1);
  const stats = unit.stats;
  return (
    stats.health > baseline.health ||
    stats.attackDamage > baseline.attackDamage ||
    stats.attackRange > baseline.attackRange ||
    stats.movementRange > baseline.movementRange
  );
}

function focusSaunoja(target: Saunoja): boolean {
  let changed = false;
  const previousUnitId = selectedUnitId;
  const attachedUnit = getAttachedUnitFor(target);
  selectedUnitId = attachedUnit?.id ?? target.id;
  if (!target.selected) {
    target.selected = true;
    changed = true;
  }
  if (deselectAllSaunojas(target)) {
    changed = true;
  }
  if (setSelectedCoord(target.coord)) {
    changed = true;
  }
  if (previousUnitId !== selectedUnitId) {
    changed = true;
  }
  syncSelectionOverlay();
  return changed;
}

function focusSaunojaById(unitId: string): void {
  const target = saunojas.find((unit) => unit.id === unitId);
  if (!target) {
    return;
  }
  if (!focusSaunoja(target)) {
    return;
  }
  saveUnits();
  updateRosterDisplay();
  invalidateFrame();
}

export function handleCanvasClick(world: PixelCoord): void {
  const clicked = pixelToAxial(world.x, world.y, map.hexSize);
  const target = saunojas.find(
    (unit) => unit.coord.q === clicked.q && unit.coord.r === clicked.r
  );
  if (target) {
    const selectionChanged = focusSaunoja(target);
    if (!selectionChanged) {
      return;
    }
    saveUnits();
    updateRosterDisplay();
    invalidateFrame();
    return;
  }

  const enemyTarget = units.find(
    (unit) =>
      unit.faction !== 'player' &&
      !unit.isDead() &&
      unit.coord.q === clicked.q &&
      unit.coord.r === clicked.r
  );

  if (enemyTarget) {
    const previousUnitId = selectedUnitId;
    const deselected = deselectAllSaunojas();
    const coordChanged = setSelectedCoord(enemyTarget.coord);
    selectedUnitId = enemyTarget.id;
    syncSelectionOverlay();
    if (deselected) {
      saveUnits();
      updateRosterDisplay();
    }
    if (previousUnitId !== selectedUnitId || coordChanged || deselected) {
      invalidateFrame();
    }
    return;
  }

  const selectionCleared = clearSaunojaSelection();

  if (!selectionCleared) {
    return;
  }

  saveUnits();
  updateRosterDisplay();
  invalidateFrame();
}

function equipItemToSaunoja(unitId: string, item: SaunojaItem): EquipAttemptResult {
  const attendant = saunojas.find((unit) => unit.id === unitId);
  if (!attendant) {
    return { success: false, reason: 'unit-missing' } satisfies EquipAttemptResult;
  }
  const beforeLoadout = loadoutItems(attendant.equipment);
  const beforeStats = applyEquipment(attendant.baseStats, beforeLoadout);
  const outcome = equipLoadout(attendant, item);
  if (!outcome.success) {
    return { success: false, reason: outcome.reason } satisfies EquipAttemptResult;
  }
  const effective = recomputeEffectiveStats(attendant, outcome.loadout);
  eventBus.emit('unit:stats:changed', { unitId: attendant.id, stats: effective });
  eventBus.emit('inventoryChanged', {});
  saveUnits();
  updateRosterDisplay();
  if (attendant.selected) {
    syncSelectionOverlay();
  }
  const previous = beforeLoadout.find((entry) => entry.slot === outcome.slot) ?? null;
  const comparison: InventoryComparison = {
    slot: outcome.slot,
    previous: summarizeEquippedItem(previous),
    next: summarizeEquippedItem(outcome.item ?? null),
    deltas: computeInventoryStatDeltas(beforeStats, effective)
  } satisfies InventoryComparison;
  return { success: true, comparison } satisfies EquipAttemptResult;
}

function unequipItemFromSaunoja(unitId: string, slot: EquipmentSlotId): SaunojaItem | null {
  const attendant = saunojas.find((unit) => unit.id === unitId);
  if (!attendant) {
    return null;
  }
  const outcome = unequipLoadout(attendant, slot);
  if (!outcome.success || !outcome.removed) {
    return null;
  }
  const effective = recomputeEffectiveStats(attendant, outcome.loadout);
  eventBus.emit('unit:stats:changed', { unitId: attendant.id, stats: effective });
  eventBus.emit('inventoryChanged', {});
  saveUnits();
  updateRosterDisplay();
  if (attendant.selected) {
    syncSelectionOverlay();
  }
  const { id, name, description, icon, rarity, quantity } = outcome.removed;
  return { id, name, description, icon, rarity, quantity } satisfies SaunojaItem;
}

function equipSlotFromStash(unitId: string, slot: EquipmentSlotId): boolean {
  const stash = inventory.getStash();
  const index = stash.findIndex((entry) => matchesSlot(entry.id, slot));
  if (index === -1) {
    return false;
  }
  return inventory.equipFromStash(index, unitId, equipItemToSaunoja);
}

function unequipSlotToStash(unitId: string, slot: EquipmentSlotId): boolean {
  return inventory.unequipToStash(unitId, slot, unequipItemFromSaunoja);
}

export function draw(): void {
  frameDirty = false;
  idleFrameCount = 0;
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  const assets = getAssets();
  if (!ctx || !assets) {
    frameDirty = true;
    return;
  }
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (combatAnimations) {
    combatAnimations.step(now);
  }
  if (unitFx) {
    unitFx.step(now);
  }
  const shakeOffset = unitFx?.getShakeOffset() ?? { x: 0, y: 0 };
  const fxOptions = unitFx
    ? {
        getUnitAlpha: (unit: Unit) => unitFx!.getUnitAlpha(unit.id),
        beginOverlayFrame: () => unitFx!.beginStatusFrame(),
        pushUnitStatus: (status: UnitStatusPayload) => unitFx!.pushUnitStatus(status),
        pushSaunaStatus: (status: SaunaStatusPayload | null) =>
          unitFx!.pushSaunaStatus(status),
        commitOverlayFrame: () => unitFx!.commitStatusFrame()
      }
    : undefined;
  const friendlyVisionSources = friendlyVisionUnitScratch;
  friendlyVisionSources.length = 0;
  for (const unit of units) {
    if (unit.faction === 'player' && !unit.isDead()) {
      friendlyVisionSources.push(unit);
    }
  }

  const overlaySaunojas = overlaySaunojasScratch;
  overlaySaunojas.length = 0;
  for (const attendant of saunojas) {
    const attachedId = saunojaToUnit.get(attendant.id);
    if (!attachedId) {
      continue;
    }
    const attachedUnit = unitsById.get(attachedId) ?? null;
    if (!attachedUnit || attachedUnit.isDead()) {
      overlaySaunojas.push(attendant);
    }
  }
  const saunaVision: VisionSource | null = sauna
    ? {
        coord: sauna.pos,
        range: sauna.visionRange
      }
    : null;

  ctx.save();
  if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
    ctx.translate(shakeOffset.x, shakeOffset.y);
  }
  const saunojaLayer =
    overlaySaunojas.length > 0
      ? {
          units: overlaySaunojas,
          draw: drawSaunojas,
          resolveRenderCoord: (attendant: Saunoja) => {
            const unit = getAttachedUnitFor(attendant);
            if (!unit) {
              return null;
            }
            return unit.renderCoord ?? unit.coord;
          },
          resolveSpriteId: (attendant: Saunoja) => {
            const unit = getAttachedUnitFor(attendant);
            if (unit) {
              return unit.getAppearanceId();
            }
            return typeof attendant.appearanceId === 'string'
              ? attendant.appearanceId
              : null;
          },
          fallbackSpriteId: 'saunoja-guardian'
        }
      : undefined;

  render(
    ctx,
    mapRenderer,
    { images: assets.images, atlas: assets.atlases.units },
    units,
    selected,
    {
      saunojas: saunojaLayer,
      sauna,
      saunaVision,
      fx: fxOptions,
      animations: combatAnimations,
      friendlyVisionSources
    }
  );
  friendlyVisionSources.length = 0;
  overlaySaunojas.length = 0;
  ctx.restore();
}

const onPolicyApplied = ({ policy }: PolicyAppliedEvent): void => {
  logEvent({
    type: 'policy',
    message: `Sauna council toasts a fresh keg for policy: ${policy.name}.`,
    metadata: {
      policy: policy.id,
      name: policy.name
    }
  });
};
eventBus.on(POLICY_EVENTS.APPLIED, onPolicyApplied);

const onPolicyRevoked = ({ policy }: PolicyRevokedEvent): void => {
  logEvent({
    type: 'policy',
    message: `Sauna council shelves policy: ${policy.name} until further notice.`,
    metadata: {
      policy: policy.id,
      name: policy.name,
      status: 'revoked'
    }
  });
};
eventBus.on(POLICY_EVENTS.REVOKED, onPolicyRevoked);

const onUnitDied = ({
  unitId,
  attackerId,
  attackerFaction,
  unitFaction
}: {
  unitId: string;
  attackerId?: string;
  attackerFaction?: string;
  unitFaction: string;
}) => {
  const idx = units.findIndex((u) => u.id === unitId);
  const fallen = idx !== -1 ? units[idx] : null;
  const fallenCoord = fallen ? { q: fallen.coord.q, r: fallen.coord.r } : null;
  const persona = unitFaction === 'player' ? unitToSaunoja.get(unitId) ?? null : null;
  let rosterUpdated = false;
  if (unitFaction === 'player') {
    const rosterEntry =
      persona ??
      saunojas.find((attendant) => saunojaToUnit.get(attendant.id) === unitId || attendant.id === unitId) ??
      null;
    if (rosterEntry) {
      if (rosterEntry.hp !== 0) {
        rosterEntry.hp = 0;
        rosterUpdated = true;
      }
      if (rosterEntry.shield !== 0) {
        rosterEntry.shield = 0;
        rosterUpdated = true;
      }
    }
  }
  const label = fallen ? describeUnit(fallen, persona) : `unit ${unitId}`;

  let xpUpdated = false;
  if (attackerFaction === 'player' && unitFaction && unitFaction !== 'player') {
    const attackerUnit = attackerId ? unitsById.get(attackerId) ?? null : null;
    const { xp: xpReward, elite, boss } = calculateKillExperience(fallen);
    if (xpReward > 0) {
      const result = grantExperienceToUnit(attackerUnit, xpReward, {
        source: 'kill',
        label,
        elite,
        boss
      });
      if (result) {
        xpUpdated = true;
      }
    }
  }

  if (idx !== -1) {
    if (fallen) {
      animator.clear(fallen, { snap: true });
    }
    units.splice(idx, 1);
    unitsById.delete(unitId);
    detachSaunoja(unitId);
    if (selectedUnitId === unitId) {
      selectedUnitId = null;
      syncSelectionOverlay();
    }
    invalidateFrame();
  }
  if (rosterUpdated || xpUpdated) {
    saveUnits();
  }
  if (unitFaction === 'player' || xpUpdated) {
    updateRosterDisplay();
  }
  if (attackerFaction === 'player' && unitFaction && unitFaction !== 'player') {
    const treatAsElite = isEliteUnit(fallen ?? null) || lootRandom() < BASE_ELITE_ODDS;
    const lootResult = rollLoot({ factionId: unitFaction, elite: treatAsElite });
    if (lootResult.rolls.length > 0) {
      const selectedAttendant = saunojas.find((unit) => unit.selected) ?? null;
      for (const drop of lootResult.rolls) {
        const receipt = inventory.addLoot(drop, {
          unitId: selectedAttendant?.id,
          sourceTableId: lootResult.tableId,
          equip: equipItemToSaunoja
        });
        if (receipt.equipped) {
          const ownerName = selectedAttendant?.name ?? 'our champion';
          logEvent({
            type: 'loot',
            message: `Quartermaster fastens ${drop.item.name} to ${ownerName}.`,
            metadata: {
              item: drop.item.name,
              equipped: true,
              owner: ownerName,
              source: label
            }
          });
        } else {
          logEvent({
            type: 'loot',
            message: `Quartermaster stores ${drop.item.name} recovered from ${label}.`,
            metadata: {
              item: drop.item.name,
              equipped: false,
              source: label
            }
          });
        }
      }
    }
  }
  if (
    attackerFaction === 'player' &&
    unitFaction &&
    unitFaction !== 'player'
  ) {
    state.addResource(Resource.SAUNAKUNNIA, SAUNAKUNNIA_VICTORY_BONUS);
    state.addResource(Resource.SISU, 1);
    logEvent({
      type: 'resource',
      message: 'Our grit surges — +1 SISU earned for the vanquished foe.',
      metadata: {
        resource: Resource.SISU,
        amount: 1,
        context: 'victory'
      }
    });
  }
  if (fallenCoord) {
    map.revealAround(fallenCoord, 1, { autoFrame: false });
  }
  const side = unitFaction === 'player' ? 'our' : 'a rival';
  logEvent({
    type: 'combat',
    message: `The steam hushes as ${side} ${label} grows still.`,
    metadata: {
      side,
      unit: label
    }
  });
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
  running = false;
  gameLoopCallback = null;
  idleFrameCount = 0;
  unitVisionSnapshots.clear();
  objectiveTracker?.offProgress(handleObjectiveProgress);
  objectiveTracker?.dispose();
  objectiveTracker = null;
  lastStrongholdsDestroyed = 0;
  resetGamePause();
  if (endScreen) {
    endScreen.destroy();
    endScreen = null;
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  try {
    state.save();
  } catch (error) {
    console.warn('Failed to persist game state during cleanup', error);
  }

  try {
    saveUnits();
  } catch (error) {
    console.warn('Failed to persist Saunoja roster during cleanup', error);
  }

  if (unitFx) {
    unitFx.dispose();
    unitFx = null;
  }
  if (combatAnimations) {
    combatAnimations.dispose();
    combatAnimations = null;
  }

  eventBus.off(POLICY_EVENTS.APPLIED, onPolicyApplied);
  eventBus.off(POLICY_EVENTS.REVOKED, onPolicyRevoked);
  eventBus.off(POLICY_EVENTS.APPLIED, onPolicyLifecycleChanged);
  eventBus.off(POLICY_EVENTS.REVOKED, onPolicyLifecycleChanged);
  if (pauseListenerAttached) {
    eventBus.off('game:pause-changed', onPauseChanged);
    pauseListenerAttached = false;
  }
  eventBus.off('unitDied', onUnitDied);
  eventBus.off('unitSpawned', onUnitSpawned);
  eventBus.off('inventoryChanged', onInventoryChanged);
  eventBus.off('modifierAdded', onModifierChanged);
  eventBus.off('modifierRemoved', onModifierChanged);
  eventBus.off('modifierExpired', onModifierChanged);
  eventBus.off('unit:stats:changed', onUnitStatsChanged);
  eventBus.off('saunaDamaged', onSaunaDamaged);
  eventBus.off('saunaDestroyed', onSaunaDestroyed);
  eventBus.off('buildingPlaced', invalidateTerrainCache);
  eventBus.off('buildingRemoved', invalidateTerrainCache);
  if (disposeRightPanel) {
    disposeRightPanel();
    disposeRightPanel = null;
  }
  if (inventoryHudController) {
    inventoryHudController.destroy();
    inventoryHudController = null;
  }
  if (saunaUiController) {
    saunaUiController.dispose();
    saunaUiController = null;
  }
  if (topbarControls) {
    topbarControls.dispose();
    topbarControls = null;
  }
  if (actionBarController) {
    actionBarController.destroy();
    actionBarController = null;
  }
  if (rosterHud) {
    rosterHud.destroy();
    rosterHud = null;
  }
  pendingRosterEntries = null;
  pendingRosterSummary = null;
  pendingRosterRenderer = null;
  disposeTutorial();
}

export async function start(): Promise<void> {
  if (running) {
    return;
  }
  const assets = getAssets();
  if (!assets) {
    console.error('Cannot start game without loaded assets.');
    return;
  }
  running = true;
  if (!pauseListenerAttached) {
    eventBus.on('game:pause-changed', onPauseChanged);
    pauseListenerAttached = true;
  }
  idleFrameCount = 0;
  updateRosterDisplay();
  invalidateFrame();
  draw();
  let last = performance.now();
  function gameLoop(now: number) {
    animationFrameId = null;
    if (!running) {
      return;
    }
    const delta = now - last;
    last = now;
    const paused = isGamePaused();
    let shouldContinue = true;
    if (paused) {
      updateTopbarHud(0);
    } else {
      idleFrameCount = 0;
      clock.tick(delta);
      updateSaunaHud();
      updateTopbarHud(delta);
      refreshRosterPanel();
    }
    if (frameDirty) {
      idleFrameCount = 0;
      draw();
    } else if (paused) {
      idleFrameCount += 1;
      if (idleFrameCount >= IDLE_FRAME_LIMIT) {
        shouldContinue = false;
      }
    } else {
      idleFrameCount = 0;
    }
    if (!running) {
      return;
    }
    if (shouldContinue) {
      scheduleGameLoop();
    }
  }
  gameLoopCallback = gameLoop;
  scheduleGameLoop();
}

export { logEvent as log };

export function __rebuildRightPanelForTest(): void {
  disposeRightPanel?.();
  const bridge = initializeRightPanel((renderer) => installRosterRenderer(renderer));
  addEvent = bridge.addEvent;
  disposeRightPanel = bridge.dispose;
  updateRosterDisplay();
}

export function __syncSaunojaRosterForTest(): boolean {
  return syncSaunojaRosterWithUnits();
}

export function __getActiveRosterCountForTest(): number {
  return getActiveRosterCount();
}

export function __getActiveTierIdForTest(): SaunaTierId {
  return currentTierId;
}

export function __getUnitUpkeepForTest(unit: Unit): number {
  return resolveUnitUpkeep(unit);
}

export function __getAttachedUnitIdForTest(attendantId: string): string | undefined {
  return saunojaToUnit.get(attendantId);
}

export function __grantExperienceForTest(unitId: string, amount: number): void {
  const unit = unitsById.get(unitId) ?? null;
  if (!unit) {
    return;
  }
  const result = grantExperienceToUnit(unit, amount, { source: 'test', label: 'test' });
  if (result) {
    saveUnits();
    updateRosterDisplay();
  }
}

export function __grantRosterExperienceForTest(amount: number): void {
  if (grantExperienceToRoster(amount, { source: 'test', label: 'test' })) {
    saveUnits();
    updateRosterDisplay();
  }
}

function getActiveRosterCount(): number {
  let count = 0;
  for (const unit of units) {
    if (unit.faction === 'player' && !unit.isDead()) {
      count += 1;
    }
  }
  return count;
}

function buildRosterEntries(): RosterEntry[] {
  const statusRank: Record<RosterEntry['status'], number> = {
    engaged: 0,
    reserve: 1,
    downed: 2
  };

  const entries = saunojas.map((attendant) => {
    const attachedUnitId = saunojaToUnit.get(attendant.id);
    const unit = attachedUnitId ? unitsById.get(attachedUnitId) : undefined;
    const unitAlive = unit ? !unit.isDead() && unit.stats.health > 0 : false;

    const effectiveStats = attendant.effectiveStats;
    const baseStats = attendant.baseStats;
    const currentHealth = unit
      ? Math.round(Math.max(0, unit.stats.health))
      : Math.round(Math.max(0, attendant.hp));
    const maxHealth = unit
      ? Math.round(Math.max(1, unit.getMaxHealth()))
      : Math.round(Math.max(1, effectiveStats.health));
    const attackDamage = unit
      ? Math.round(Math.max(0, unit.stats.attackDamage))
      : Math.round(Math.max(0, effectiveStats.attackDamage));
    const attackRange = unit
      ? Math.round(Math.max(0, unit.stats.attackRange))
      : Math.round(Math.max(0, effectiveStats.attackRange));
    const movementRange = unit
      ? Math.round(Math.max(0, unit.stats.movementRange))
      : Math.round(Math.max(0, effectiveStats.movementRange));
    const defenseSource = unit?.stats.defense ?? effectiveStats.defense ?? 0;
    const defense = Math.round(Math.max(0, defenseSource));
    const shieldSource = unit ? unit.getShield() : effectiveStats.shield ?? attendant.shield;
    const shield = Math.round(Math.max(0, shieldSource));
    const upkeep = Math.max(0, Math.round(attendant.upkeep));
    const status: RosterEntry['status'] =
      currentHealth <= 0 ? 'downed' : unitAlive ? 'engaged' : 'reserve';

    const progression = buildProgression(attendant);

    const items = attendant.items.map((item) => ({ ...item }));
    const modifiers = attendant.modifiers.map((modifier) => ({ ...modifier }));

    const equipmentSlots = EQUIPMENT_SLOT_IDS.map((slotId) => {
      const slotDefinition = getSlotDefinition(slotId);
      const equipped = attendant.equipment[slotId];
      const rosterItem = equipped
        ? {
            id: equipped.id,
            name: equipped.name,
            description: equipped.description,
            icon: equipped.icon,
            rarity: equipped.rarity,
            quantity: equipped.quantity,
            slot: slotId
          }
        : null;
      const aggregated = equipped ? scaleModifiers(equipped.modifiers, equipped.quantity) : null;
      return {
        id: slotId,
        label: slotDefinition.label,
        description: slotDefinition.description,
        maxStacks: slotDefinition.maxStacks,
        item: rosterItem,
        modifiers: aggregated
      };
    });

    const rosterBase: RosterStats = {
      health: Math.round(Math.max(0, baseStats.health)),
      maxHealth: Math.round(Math.max(1, baseStats.health)),
      attackDamage: Math.round(Math.max(0, baseStats.attackDamage)),
      attackRange: Math.round(Math.max(0, baseStats.attackRange)),
      movementRange: Math.round(Math.max(0, baseStats.movementRange)),
      defense:
        typeof baseStats.defense === 'number' && baseStats.defense > 0
          ? Math.round(baseStats.defense)
          : undefined,
      shield:
        typeof baseStats.shield === 'number' && baseStats.shield > 0
          ? Math.round(baseStats.shield)
          : undefined
    } satisfies RosterStats;

    const behavior: UnitBehavior = attendant.behavior ?? 'defend';

    return {
      id: attendant.id,
      name: attendant.name,
      upkeep,
      status,
      selected: Boolean(attendant.selected),
      behavior,
      traits: [...attendant.traits],
      stats: {
        health: currentHealth,
        maxHealth,
        attackDamage,
        attackRange,
        movementRange,
        defense: defense > 0 ? defense : undefined,
        shield: shield > 0 ? shield : undefined
      },
      baseStats: rosterBase,
      progression,
      equipment: equipmentSlots,
      items,
      modifiers
    } satisfies RosterEntry;
  });

  entries.sort((a, b) => {
    const statusDelta = statusRank[a.status] - statusRank[b.status];
    if (statusDelta !== 0) {
      return statusDelta;
    }
    return a.name.localeCompare(b.name, 'en');
  });

  return entries;
}

function pickFeaturedSaunoja(): Saunoja | null {
  if (saunojas.length === 0) {
    return null;
  }
  return (
    saunojas.find((unit) => unit.selected) ??
    saunojas.find((unit) => unit.hp > 0) ??
    saunojas[0]
  );
}

function scaleModifiers(modifiers: EquipmentModifier, quantity: number): EquipmentModifier {
  const stacks = Math.max(1, Math.round(quantity));
  const scaled: EquipmentModifier = {};
  if (typeof modifiers.health === 'number') {
    scaled.health = modifiers.health * stacks;
  }
  if (typeof modifiers.attackDamage === 'number') {
    scaled.attackDamage = modifiers.attackDamage * stacks;
  }
  if (typeof modifiers.attackRange === 'number') {
    scaled.attackRange = modifiers.attackRange * stacks;
  }
  if (typeof modifiers.movementRange === 'number') {
    scaled.movementRange = modifiers.movementRange * stacks;
  }
  if (typeof modifiers.defense === 'number') {
    scaled.defense = modifiers.defense * stacks;
  }
  if (typeof modifiers.shield === 'number') {
    scaled.shield = modifiers.shield * stacks;
  }
  return scaled;
}

function buildRosterSummary(): RosterHudSummary {
  const total = getActiveRosterCount();
  const featured = pickFeaturedSaunoja();
  let card: RosterCardViewModel | null = null;
  if (featured) {
    const behavior: UnitBehavior = featured.behavior ?? 'defend';
    card = {
      id: featured.id,
      name: featured.name || 'Saunoja',
      traits: [...featured.traits],
      upkeep: Math.max(0, Math.round(featured.upkeep)),
      progression: buildProgression(featured),
      behavior
    } satisfies RosterCardViewModel;
  }
  return { count: total, card } satisfies RosterHudSummary;
}

function refreshRosterPanel(entries?: RosterEntry[]): void {
  const view = entries ?? buildRosterEntries();
  pendingRosterEntries = view;
  notifyRosterEntries(view);
  syncSelectionOverlay();
  if (!rosterHud) {
    return;
  }
  rosterHud.renderRoster(view);
}

function updateRosterDisplay(): void {
  const summary = buildRosterSummary();
  notifyRosterSummary(summary);
  if (rosterHud) {
    rosterHud.updateSummary(summary);
    pendingRosterSummary = null;
  } else {
    pendingRosterSummary = summary;
  }
  refreshRosterPanel();
  syncSelectionOverlay();
}

export function getRosterSummarySnapshot(): RosterHudSummary {
  if (lastRosterSummary) {
    return lastRosterSummary;
  }
  if (pendingRosterSummary) {
    return pendingRosterSummary;
  }
  return buildRosterSummary();
}

export function getRosterEntriesSnapshot(): RosterEntry[] {
  if (lastRosterEntries.length > 0) {
    return lastRosterEntries;
  }
  if (pendingRosterEntries && pendingRosterEntries.length > 0) {
    return pendingRosterEntries;
  }
  return buildRosterEntries();
}

export function subscribeRosterSummary(
  listener: (summary: RosterHudSummary) => void
): () => void {
  rosterSummaryListeners.add(listener);
  try {
    listener(getRosterSummarySnapshot());
  } catch (error) {
    console.warn('Failed to deliver roster summary snapshot', error);
  }
  return () => {
    rosterSummaryListeners.delete(listener);
  };
}

export function subscribeRosterEntries(
  listener: (entries: RosterEntry[]) => void
): () => void {
  rosterEntriesListeners.add(listener);
  try {
    listener(getRosterEntriesSnapshot());
  } catch (error) {
    console.warn('Failed to deliver roster entries snapshot', error);
  }
  return () => {
    rosterEntriesListeners.delete(listener);
  };
}

export function subscribeHudTime(
  listener: (elapsedMs: number) => void
): () => void {
  hudTimeListeners.add(listener);
  try {
    listener(hudElapsedMs);
  } catch (error) {
    console.warn('Failed to deliver HUD time snapshot', error);
  }
  return () => {
    hudTimeListeners.delete(listener);
  };
}

export function getHudElapsedMs(): number {
  return hudElapsedMs;
}

export function subscribeEnemyRamp(
  listener: (summary: EnemyRampSummary | null) => void
): () => void {
  enemyRampListeners.add(listener);
  try {
    listener(lastEnemyRampSummary);
  } catch (error) {
    console.warn('Failed to deliver enemy ramp snapshot', error);
  }
  return () => {
    enemyRampListeners.delete(listener);
  };
}

export function getEnemyRampSummarySnapshot(): EnemyRampSummary | null {
  return lastEnemyRampSummary;
}

export function getGameStateInstance(): GameState {
  return state;
}

export function setExternalSaunaUiController(controller: SaunaUIController | null): void {
  saunaUiController = controller;
}

export function getSaunaInstance(): Sauna {
  return sauna;
}

export function getActiveSaunaTierId(): SaunaTierId {
  return currentTierId;
}

export function setActiveSaunaTier(
  tierId: SaunaTierId,
  options: { persist?: boolean } = {}
): boolean {
  return setActiveTier(tierId, options);
}

export function getSaunaTierContextSnapshot(): SaunaTierContext {
  return getTierContext();
}

export function getRosterCapValue(): number {
  return sauna.maxRosterSize;
}

export function getRosterCapLimit(): number {
  return getActiveTierLimit();
}

export function setRosterCapValue(
  value: number,
  options: { persist?: boolean } = {}
): number {
  return updateRosterCap(value, options);
}

export function getUiV2RosterController(): UiV2RosterController | null {
  return uiV2RosterController;
}

export function getUiV2TopbarController(): UiV2TopbarController | null {
  return uiV2TopbarController;
}

export function getUiV2InventoryController(): UiV2InventoryController | null {
  return uiV2InventoryController;
}

export function getUiV2LogController(): UiV2LogController | null {
  return uiV2LogController;
}

export function getUiV2SaunaController(): UiV2SaunaController | null {
  return uiV2SaunaController;
}
