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
import { pickFreeTileAround } from './sim/sauna.ts';
import type { Sauna } from './sim/sauna.ts';
import { EnemySpawner, type EnemySpawnerRuntimeModifiers } from './sim/EnemySpawner.ts';
import { recordEnemyScalingTelemetry } from './state/telemetry/enemyScaling.ts';
import { setupSaunaUI, type SaunaUIController } from './ui/sauna.tsx';
import type {
  SelectionItemSlot,
  SelectionStatusChip,
  UnitSelectionPayload
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
import {
  configureGameRuntime,
  getGameRuntime as getGameRuntimeImpl,
  setExternalSaunaUiController as setExternalSaunaUiControllerImpl,
  getGameStateInstance as getGameStateInstanceImpl,
  getSaunaInstance as getSaunaInstanceImpl,
  getActiveSaunaTierId as getActiveSaunaTierIdImpl,
  setActiveSaunaTier as setActiveSaunaTierImpl,
  getSaunaTierContextSnapshot as getSaunaTierContextSnapshotImpl,
  getRosterCapValue as getRosterCapValueImpl,
  getRosterCapLimit as getRosterCapLimitImpl,
  setRosterCapValue as setRosterCapValueImpl
} from './game/runtime/index.ts';
import { createHudCoordinator } from './game/runtime/hudCoordinator.ts';
import type { GameRuntimeContext } from './game/runtime/GameRuntime.ts';
import { GameController } from './game/GameController.ts';
import {
  createRosterService,
  type RosterPersonaBaseline,
  type RosterService
} from './game/runtime/rosterService.ts';
import {
  createRosterSyncService,
  cloneStatBlock
} from './game/roster/rosterSync.ts';
import {
  configureRosterOrchestrator,
  saunojas,
  saunojaPolicyBaselines,
  saunojaToUnit,
  unitToSaunoja,
  buildProgression,
  refreshRosterPanel,
  updateRosterDisplay
} from './game/orchestrators/roster.ts';
import { setupTopbar, type EnemyRampSummary, type TopbarControls } from './ui/topbar.ts';
import {
  setupActionBar,
  type ActionBarAbilityHandlers,
  type ActionBarController
} from './ui/action-bar/index.tsx';
import { isGamePaused, resetGamePause, setGamePaused } from './game/pause.ts';
import { playSafe } from './audio/sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from './sisu/burst.ts';
import type { GameEvent, RosterEntry } from './ui/rightPanel.tsx';
import { createTutorialController, type TutorialController } from './ui/tutorial/Tutorial.tsx';
import { draw as render } from './render/renderer.ts';
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
import {
  getEffectiveLootRolls,
  onLootUpgradeShopChange,
  shouldDropLoot,
  type LootUpgradeChangeEvent
} from './progression/lootUpgrades.ts';
import { applyEquipment } from './unit/calc.ts';
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
import { planNextNgPlusRun, saveNgPlusState, type NgPlusState } from './progression/ngplus.ts';
import {
  calculateArtocoinPayout,
  creditArtocoins,
  loadArtocoinBalance,
  onArtocoinChange,
  type ArtocoinChangeEvent
} from './progression/artocoin.ts';
import {
  onSaunaShopChange,
  purchaseSaunaTier,
  type PurchaseSaunaTierResult,
  type SaunaShopChangeEvent
} from './progression/saunaShop.ts';
import type { SaunaShopViewModel } from './ui/shop/SaunaShopPanel.tsx';
import type { PlayerSpawnTierHelpers } from './world/spawn/tier_helpers.ts';
import {
  equip as equipLoadout,
  unequip as unequipLoadout,
  loadoutItems,
  matchesSlot
} from './items/equip.ts';
import type { EquipmentSlotId, EquippedItem, EquipmentModifier } from './items/types.ts';
import {
  getSaunojaStorage,
  loadUnits as loadRosterFromStorage,
  saveUnits as persistRosterToStorage,
  SAUNOJA_STORAGE_KEY
} from './game/rosterStorage.ts';
import { loadSaunaSettings, saveSaunaSettings } from './game/saunaSettings.ts';
import { showEndScreen, type EndScreenController } from './ui/overlays/EndScreen.tsx';
import { isTutorialDone, setTutorialDone } from './save/local_flags.ts';
import { getLogHistory, logEvent, subscribeToLogs } from './ui/logging.ts';
import {
  addArtocoinSpend,
  getArtocoinBalance,
  getArtocoinsSpentThisRun,
  getPurchasedTierIds,
  setPurchasedLootUpgradeIds,
  notifySaunaShopSubscribers,
  reloadSaunaShopState,
  setArtocoinBalance,
  setPurchasedTierIds,
  subscribeToSaunaShop as subscribeToSaunaShopState
} from './game/saunaShopState.ts';
import { initializeClassicHud } from './game/setup/hud.ts';
import { type SaunaLifecycleResult, type SaunaTierChangeContext } from './game/setup/sauna.ts';
import {
  initializeRightPanel as createRightPanelBridge,
  type RightPanelBridge
} from './game/setup/rightPanel.ts';
import { seedEnemyStrongholds, STRONGHOLD_CONFIG } from './world/strongholds.ts';
import {
  pickStrongholdSpawnCoord,
  type StrongholdSpawnExclusionZone
} from './world/spawn/strongholdSpawn.ts';
import {
  applyNgPlusState as applyRuntimeNgPlusState,
  getActiveTierIdRef as getActiveTierIdAccessor,
  getActiveTierLimitRef as getActiveTierLimitAccessor,
  getEnemyRandom,
  getLootRandom,
  getNgPlusState,
  getResolveSpawnLimitRef as getResolveSpawnLimitAccessor,
  getSetActiveTierRef as getSetActiveTierAccessor,
  getSpawnTierQueue,
  getTierContextRef as getTierContextRefAccessor,
  getUpdateRosterCapRef as getUpdateRosterCapAccessor,
  initSaunaLifecycle,
  withLifecycleSync
} from './game/runtime/saunaLifecycleManager.ts';
import {
  disposeHudSignals,
  getHudElapsedMs as getHudElapsedMsSnapshot,
  notifyEnemyRamp,
  notifyHudElapsed,
  setHudElapsedMs as setHudElapsedMsSnapshot
} from './game/signals/hud.ts';
import {
  calculateKillExperience,
  isEliteUnit,
  XP_BOSS_KILL,
  XP_ELITE_KILL,
  XP_STANDARD_KILL
} from './game/experience.ts';

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

const XP_OBJECTIVE_COMPLETION = 200;
const MAX_LEVEL = getLevelForExperience(Number.MAX_SAFE_INTEGER);

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

function sanitizeObjectiveMetric(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

const BASE_ELITE_ODDS = 0.1;
const MIN_SPAWN_LIMIT = 3;
const BASE_ENEMY_DIFFICULTY = 1;

const getGameRuntime = getGameRuntimeImpl;

const hudCoordinator = createHudCoordinator({
  getRuntime: () => getGameRuntime(),
  eventBus,
  updateRosterDisplay: () => updateRosterDisplay(),
  refreshRosterPanel: (entries) => refreshRosterPanel(entries)
});
const hudEventHandlers = hudCoordinator.getEventHandlers();

function tryGetRuntimeInstance(): ReturnType<typeof getGameRuntime> | null {
  try {
    return getGameRuntime();
  } catch (error) {
    if (error instanceof Error && error.message.includes('not been configured')) {
      return null;
    }
    throw error;
  }
}

let currentNgPlusState: NgPlusState = getNgPlusState();
let enemyRandom: () => number = getEnemyRandom();
let lootRandom: () => number = getLootRandom();

function applyNgPlusState(next: NgPlusState): void {
  applyRuntimeNgPlusState(next);
  currentNgPlusState = getNgPlusState();
  enemyRandom = getEnemyRandom();
  lootRandom = getLootRandom();
}

function determineLootRollCount(randomSource: () => number): number {
  if (!shouldDropLoot(randomSource)) {
    return 0;
  }
  const rolls = Math.floor(getEffectiveLootRolls());
  return Math.max(1, rolls);
}

applyNgPlusState(currentNgPlusState);

let policyModifiers: PolicyModifierSummary = createPolicyModifierSummary();
setActivePolicyModifiers(policyModifiers);
const unitsById = new Map<string, Unit>();
let playerSpawnSequence = 0;
let rosterService: RosterService = createRosterService({
  roster: saunojas,
  loadRosterFromStorage: () => loadRosterFromStorage(),
  saveRosterToStorage: (entries) => persistRosterToStorage(entries),
  withBaseline: (saunoja, mutate) => withSaunojaBaseline(saunoja, mutate),
  getAttachedUnitFor: (attendant) => getAttachedUnitFor(attendant),
  resolveAppearanceId: () => resolveSaunojaAppearance(),
  generateTraits: () => generateTraits(),
  rollUpkeep: () => rollSaunojaUpkeep()
});

configureRosterOrchestrator({
  getUnitById: (id) => unitsById.get(id),
  getAttachedUnitFor: (attendant) => getAttachedUnitFor(attendant),
  getActiveRosterCount: () => getActiveRosterCount(),
  syncSelectionOverlay: () => syncSelectionOverlay()
});
const friendlyVisionUnitScratch: Unit[] = [];
const overlaySaunojasScratch: Saunoja[] = [];
let saunaLifecycle: SaunaLifecycleResult | null = null;
let sauna: Sauna;
let saunaInitialReveal: StrongholdSpawnExclusionZone | null = null;
let getTierContextRef: () => SaunaTierContext = getTierContextRefAccessor();
let getActiveTierIdRef: () => SaunaTierId = getActiveTierIdAccessor();
let getActiveTierLimitRef: () => number = getActiveTierLimitAccessor();
let updateRosterCapRef: (value: number, options?: { persist?: boolean }) => number =
  getUpdateRosterCapAccessor();
let resolveSpawnLimitRef: () => number = getResolveSpawnLimitAccessor();
let setActiveTierRef: (
  tierId: SaunaTierId,
  options?: { persist?: boolean; onTierChanged?: SaunaTierChangeContext }
) => boolean = getSetActiveTierAccessor();
let spawnTierQueue: PlayerSpawnTierHelpers = getSpawnTierQueue();

const IDLE_FRAME_LIMIT = 10;

export function invalidateFrame(): void {
  getGameRuntime().invalidateFrame();
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
  const resolvedBehavior =
    typeof attachedUnit?.getBehavior === 'function'
      ? attachedUnit.getBehavior()
      : attendant.behavior;

  return {
    id: attachedUnit?.id ?? attendant.id,
    name: attendant.name?.trim() || 'Saunoja',
    faction: attachedUnit?.faction ?? 'player',
    coord: { q: coordSource.q, r: coordSource.r },
    hp: hpValue,
    maxHp: maxHpValue,
    shield: shieldValue,
    behavior: resolvedBehavior,
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
    behavior: typeof unit.getBehavior === 'function' ? unit.getBehavior() : undefined,
    items: [],
    statuses: []
  } satisfies UnitSelectionPayload;
}

function syncSelectionOverlay(): void {
  const runtime = tryGetRuntimeInstance();
  if (!runtime) {
    return;
  }
  const unitFx = runtime.getUnitFx();
  if (!unitFx) {
    return;
  }

  let selectionPayload: UnitSelectionPayload | null = null;
  let selectedUnitId = rosterService.getSelectedUnitId();

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
        rosterService.setSelectedUnitId(null);
        selectedUnitId = null;
      }
    }
  }

  if (!selectionPayload) {
    const selectedSaunoja = getSelectedSaunoja();
    if (selectedSaunoja) {
      const attachedUnit = getAttachedUnitFor(selectedSaunoja);
      selectedUnitId = attachedUnit?.id ?? selectedSaunoja.id;
      rosterService.setSelectedUnitId(selectedUnitId);
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
    const unitMaxHealth = unit.getMaxHealth();
    if (unit.stats.health < unitMaxHealth) {
      unit.stats.health = unitMaxHealth;
    }
    if (attendant.hp < attendant.maxHp) {
      attendant.hp = attendant.maxHp;
    }
  }
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

export function saveUnits(): void {
  rosterService.saveUnits();
}

const rosterSync = createRosterSyncService({
  rosterService,
  saunojas,
  saunojaPolicyBaselines,
  unitToSaunoja,
  saunojaToUnit,
  ensureSaunojaPolicyBaseline,
  applySaunojaBehaviorPreference,
  updateBaseStatsFromUnit,
  onRosterChanged: () => {
    saveUnits();
    syncSelectionOverlay();
  },
  setSelectedCoord
});

export function loadUnits(): Saunoja[] {
  return rosterSync.loadUnits();
}

function claimSaunoja(unit: Unit) {
  return rosterSync.claimSaunoja(unit);
}
function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ay - by));
}

const units: Unit[] = [];
const unitVisionSnapshots = new Map<string, { coordKey: string; radius: number }>();

function syncSaunojaRosterWithUnits(): boolean {
  return rosterSync.syncRosterWithUnits(units);
}

const gameController = new GameController({
  eventBus,
  getGameRuntime: () => getGameRuntime(),
  invalidateFrame: () => invalidateFrame(),
  resetAutoFrame: () => resetAutoFrame(),
  notifyHudElapsed: () => notifyHudElapsed(getHudElapsedMsSnapshot()),
  notifyEnemyRamp: (summary) => notifyEnemyRamp(summary),
  setHudElapsedMs: (value) => setHudElapsedMsSnapshot(value),
  friendlyVisionUnitScratch,
  overlaySaunojasScratch,
  units,
  saunojas,
  saunojaToUnit,
  unitsById,
  getAttachedUnitFor: (attendant) => getAttachedUnitFor(attendant),
  getSauna: () => sauna ?? null,
  rosterService,
  render,
  getAssets,
  drawSaunojas,
  createHexMap: () => new HexMap(10, 10, 32),
  createAnimator: (invalidate) => new Animator(invalidate),
  createBattleManager: (map, animator) => new BattleManager(map, animator),
  createMapRenderer: (map) => new HexMapRenderer(map)
});

const map = gameController.map;
const animator = gameController.animator;
const battleManager = gameController.battleManager;
const mapRenderer = gameController.mapRenderer;
const invalidateTerrainCache = gameController.getTerrainInvalidator();

const state = new GameState(1000);
const persistedStrongholds = state.peekPersistedStrongholds();
seedEnemyStrongholds(map, STRONGHOLD_CONFIG, persistedStrongholds, {
  encounters: {
    registerUnit,
    random: Math.random
  }
});

function coordKey(coord: AxialCoord): string {
  return `${coord.q},${coord.r}`;
}

function pickEdgeFallback(): AxialCoord | undefined {
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

function pickStrongholdSpawnTile(): AxialCoord | undefined {
  const strongholdCoord = pickStrongholdSpawnCoord({
    map,
    units,
    random: Math.random,
    excludeZones: saunaInitialReveal ? [saunaInitialReveal] : undefined
  });
  if (strongholdCoord) {
    return strongholdCoord;
  }
  return pickEdgeFallback();
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

function describeUnit(unit: Unit, attachedSaunoja?: Saunoja | null): string {
  if (unit.type === 'stronghold-structure') {
    return 'enemy stronghold';
  }
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
  const runtime = tryGetRuntimeInstance();
  if (runtime?.getCanvas()) {
    runtime.invalidateFrame();
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
saunaLifecycle = initSaunaLifecycle({
  map,
  ngPlusState: currentNgPlusState,
  getActiveRosterCount: () => getActiveRosterCount(),
  logEvent,
  minSpawnLimit: MIN_SPAWN_LIMIT
});
sauna = saunaLifecycle.sauna;
if (!saunaInitialReveal) {
  saunaInitialReveal = {
    center: { ...sauna.pos },
    radius: sauna.visionRange
  } satisfies StrongholdSpawnExclusionZone;
}
getTierContextRef = getTierContextRefAccessor();
getActiveTierIdRef = getActiveTierIdAccessor();
getActiveTierLimitRef = getActiveTierLimitAccessor();
updateRosterCapRef = getUpdateRosterCapAccessor();
resolveSpawnLimitRef = getResolveSpawnLimitAccessor();
setActiveTierRef = getSetActiveTierAccessor();
spawnTierQueue = getSpawnTierQueue();

const syncLifecycleWithUnlocks = withLifecycleSync(
  (
    sync: (options?: {
      persist?: boolean;
      onTierChanged?: (context: SaunaTierChangeContext) => void;
    }) => void
  ) => {
    return (
      options: { persist?: boolean; onTierChanged?: (context: SaunaTierChangeContext) => void } = {}
    ): void => {
      let tierChanged = false;
      sync({
        ...options,
        onTierChanged: (context) => {
          tierChanged = true;
          options.onTierChanged?.(context);
          getGameRuntime().getSaunaUiController()?.update?.();
          updateRosterDisplay();
        }
      });
      if (options.persist && !tierChanged) {
        updateRosterDisplay();
      }
    };
  }
);

syncLifecycleWithUnlocks({ persist: true });

function buildGameRuntimeContext(): GameRuntimeContext {
  return {
    state,
    units,
    getSaunojas: () => saunojas,
    getSauna: () => sauna,
    map,
    inventory,
    mapRenderer,
    getUnitById: (id) => unitsById.get(id),
    resetHudElapsed: () => {
      setHudElapsedMsSnapshot(0);
    },
    notifyHudElapsed: () => notifyHudElapsed(getHudElapsedMsSnapshot()),
    notifyEnemyRamp: (summary) => notifyEnemyRamp(summary),
    syncSelectionOverlay: () => syncSelectionOverlay(),
    updateRosterDisplay: () => updateRosterDisplay(),
    getSelectedInventoryContext: () => getSelectedInventoryContext(),
    equipItemToSaunoja: (unitId, item) => equipItemToSaunoja(unitId, item),
    equipSlotFromStash: (unitId, slot) => equipSlotFromStash(unitId, slot),
    unequipSlotToStash: (unitId, slot) => unequipSlotToStash(unitId, slot),
    getTierContext: () => getTierContextRef(),
    getActiveTierId: () => getActiveTierIdRef(),
    setActiveTier: (tierId, options) => setActiveTierRef(tierId, options),
    getActiveTierLimit: () => getActiveTierLimitRef(),
    updateRosterCap: (value, options) => updateRosterCapRef(value, options),
    syncSaunojaRosterWithUnits: () => syncSaunojaRosterWithUnits(),
    startTutorialIfNeeded: () => startTutorialIfNeeded(),
    disposeTutorial: () => disposeTutorial(),
    getAttachedUnitFor: (attendant) => getAttachedUnitFor(attendant),
    resetUnitVisionSnapshots: () => unitVisionSnapshots.clear(),
    resetObjectiveTracker: () => {
      objectiveTracker?.offProgress(handleObjectiveProgress);
      objectiveTracker?.dispose();
      objectiveTracker = null;
    },
    resetStrongholdCounter: () => {
      lastStrongholdsDestroyed = 0;
    },
    destroyEndScreen: () => {
      if (endScreen) {
        endScreen.destroy();
        endScreen = null;
      }
    },
    persistState: () => {
      try {
        state.save();
      } catch (error) {
        console.warn('Failed to persist game state during cleanup', error);
      }
    },
    persistUnits: () => {
      try {
        saveUnits();
      } catch (error) {
        console.warn('Failed to persist Saunoja roster during cleanup', error);
      }
    },
    getPolicyHandlers: () => ({
      onApplied: onPolicyApplied,
      onRevoked: onPolicyRevoked,
      onLifecycleChanged: onPolicyLifecycleChanged
    }),
    getUnitEventHandlers: () => ({
      onUnitDied,
      onUnitSpawned,
      onInventoryChanged: hudEventHandlers.onInventoryChanged,
      onModifierChanged: hudEventHandlers.onModifierChanged,
      onUnitStatsChanged: hudEventHandlers.onUnitStatsChanged,
      onSaunaDamaged: hudEventHandlers.onSaunaDamaged,
      onSaunaDestroyed: hudEventHandlers.onSaunaDestroyed
    }),
    getTerrainInvalidator: () => invalidateTerrainCache,
    getClock: () => clock,
    isGamePaused: () => isGamePaused(),
    onPauseChanged: () => onPauseChanged(),
    updateTopbarHud: (deltaMs) => hudCoordinator.updateTopbarHud(deltaMs),
    updateSaunaHud: () => hudCoordinator.updateSaunaHud(),
    refreshRosterPanel: (entries) => refreshRosterPanel(entries),
    draw: () => draw(),
    getIdleFrameLimit: () => IDLE_FRAME_LIMIT
  } satisfies GameRuntimeContext;
}

configureGameRuntime({
  createContext: () => buildGameRuntimeContext(),
  rosterService,
  state,
  map,
  inventory,
  getSauna: () => sauna,
  getTierContext: () => getTierContextRef(),
  getActiveTierId: () => getActiveTierIdRef(),
  getActiveTierLimit: () => getActiveTierLimitRef(),
  getRosterCap: () => sauna.maxRosterSize,
  updateRosterCap: (value, options) => updateRosterCapRef(value, options),
  setActiveTier: (tierId, options) => setActiveTierRef(tierId, options)
});

onSaunaShopChange((event: SaunaShopChangeEvent) => {
  if (event.type === 'purchase' && event.cost && event.spendResult?.success) {
    addArtocoinSpend(event.cost);
  }
  setPurchasedTierIds(event.purchased);
  notifySaunaShopSubscribers();
  syncLifecycleWithUnlocks({ persist: true });
});

onLootUpgradeShopChange((event: LootUpgradeChangeEvent) => {
  if (event.type === 'purchase' && event.cost && event.spendResult?.success) {
    addArtocoinSpend(event.cost);
  }
  setPurchasedLootUpgradeIds(event.purchased);
  notifySaunaShopSubscribers();
});

onArtocoinChange((change: ArtocoinChangeEvent) => {
  setArtocoinBalance(change.balance);
  notifySaunaShopSubscribers();
  syncLifecycleWithUnlocks({ persist: true });
});

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
  const rosterCap = updateRosterCapRef(sauna.maxRosterSize);
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
    maxSpawns: resolveSpawnLimitRef(),
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
  enemySpawner.update(dtSeconds, units, registerUnit, pickStrongholdSpawnTile, runtimeModifiers);
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
  const topbarControls = getGameRuntime().getTopbarControls();
  topbarControls?.setEnemyRampSummary(rampSummary);
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
  const runtime = getGameRuntime();
  if (runtime.isRunning()) {
    runtime.stopLoop();
  }
  clock.stop();
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
    tierId: getActiveTierIdRef(),
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
        tier: getActiveTierIdRef()
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
loadUnits();
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
  rosterService.refreshPersona(seeded);
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
  rosterService.setSelectedCoord(storedSelection.coord);
}

function setSelectedCoord(next: AxialCoord | null): boolean {
  const changed = rosterService.setSelectedCoord(next);
  if (changed) {
    syncSelectionOverlay();
  }
  return changed;
}

function deselectAllSaunojas(except?: Saunoja): boolean {
  return rosterService.deselectAllSaunojas(except);
}

function clearSaunojaSelection(): boolean {
  const changed = rosterService.clearSaunojaSelection();
  syncSelectionOverlay();
  return changed;
}

function focusSaunoja(target: Saunoja): boolean {
  const changed = rosterService.focusSaunoja(target);
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

export function setupGame(
  canvasEl: HTMLCanvasElement,
  resourceBarEl: HTMLElement,
  overlayEl: HTMLElement
): void {
  gameController.setupGame(canvasEl, resourceBarEl, overlayEl);
}

export function handleCanvasClick(world: PixelCoord): void {
  gameController.handleCanvasClick(world);
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
  gameController.draw();
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
  const isStrongholdStructure = fallen?.type === 'stronghold-structure';

  let xpUpdated = false;
  if (
    !isStrongholdStructure &&
    attackerFaction === 'player' &&
    unitFaction &&
    unitFaction !== 'player'
  ) {
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
    if (rosterService.getSelectedUnitId() === unitId) {
      rosterService.setSelectedUnitId(null);
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
  if (
    !isStrongholdStructure &&
    attackerFaction === 'player' &&
    unitFaction &&
    unitFaction !== 'player'
  ) {
    const treatAsElite = isEliteUnit(fallen ?? null) || lootRandom() < BASE_ELITE_ODDS;
    const lootRollCount = determineLootRollCount(lootRandom);
    if (lootRollCount > 0) {
      const lootResult = rollLoot({
        factionId: unitFaction,
        elite: treatAsElite,
        rolls: lootRollCount,
        random: lootRandom
      });
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
  }
  if (
    !isStrongholdStructure &&
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
  if (isStrongholdStructure) {
    logEvent({
      type: 'progression',
      message: 'Our siege engines topple an enemy stronghold.',
      metadata: {
        unit: label,
        context: 'stronghold-siege'
      }
    });
  } else {
    const side = unitFaction === 'player' ? 'our' : 'a rival';
    logEvent({
      type: 'combat',
      message: `The steam hushes as ${side} ${label} grows still.`,
      metadata: {
        side,
        unit: label
      }
    });
  }
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
  gameController.cleanup();
  hudCoordinator.dispose();
  disposeHudSignals();
}

export async function start(): Promise<void> {
  await gameController.start();
}

export { logEvent as log };
export {
  getRosterEntriesSnapshot,
  getRosterSummarySnapshot,
  subscribeRosterEntries,
  subscribeRosterSummary
} from './game/orchestrators/roster.ts';

export function __rebuildRightPanelForTest(): void {
  const runtime = getGameRuntime();
  runtime.getDisposeRightPanel()?.();
  const bridge = createRightPanelBridge(
    {
      state,
      sauna,
      getSaunojas: () => saunojas,
      getAttachedUnitFor: (attendant) => getAttachedUnitFor(attendant),
      focusSaunojaById,
      equipSlotFromStash,
      unequipSlotToStash,
      rosterService,
      updateRosterDisplay,
      getActiveTierLimit: () => getActiveTierLimitRef(),
      updateRosterCap: (value, opts) => updateRosterCapRef(value, opts)
    },
    (renderer) => hudCoordinator.installRosterRenderer(renderer)
  );
  runtime.setAddEvent(bridge.addEvent);
  runtime.setDisposeRightPanel(bridge.dispose);
  updateRosterDisplay();
}

export function __syncSaunojaRosterForTest(): boolean {
  return syncSaunojaRosterWithUnits();
}

export function __getActiveRosterCountForTest(): number {
  return getActiveRosterCount();
}

export function __getActiveTierIdForTest(): SaunaTierId {
  return getActiveTierIdRef();
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

export {
  subscribeHudTime,
  unsubscribeHudTime,
  getHudElapsedMs,
  subscribeEnemyRamp,
  unsubscribeEnemyRamp,
  getEnemyRampSummarySnapshot
} from './game/signals/hud.ts';

export {
  getGameRuntimeImpl as getGameRuntime,
  setExternalSaunaUiControllerImpl as setExternalSaunaUiController,
  getGameStateInstanceImpl as getGameStateInstance,
  getSaunaInstanceImpl as getSaunaInstance,
  getActiveSaunaTierIdImpl as getActiveSaunaTierId,
  setActiveSaunaTierImpl as setActiveSaunaTier,
  getSaunaTierContextSnapshotImpl as getSaunaTierContextSnapshot,
  getRosterCapValueImpl as getRosterCapValue,
  getRosterCapLimitImpl as getRosterCapLimit,
  setRosterCapValueImpl as setRosterCapValue
};

