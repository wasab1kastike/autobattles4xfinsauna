import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { BattleManager } from './battle/BattleManager.ts';
import { pixelToAxial } from './hex/HexUtils.ts';
import type { AxialCoord, PixelCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit/index.ts';
import type { UnitStats, UnitType } from './unit/index.ts';
import { eventBus } from './events';
import { createSauna, pickFreeTileAround } from './sim/sauna.ts';
import { EnemySpawner } from './sim/EnemySpawner.ts';
import { setupSaunaUI, type SaunaUIController } from './ui/sauna.tsx';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar, type TopbarControls } from './ui/topbar.ts';
import { playSafe } from './audio/sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from './sisu/burst.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from './ui/rightPanel.tsx';
import { createTutorialController, type TutorialController } from './ui/tutorial/Tutorial.tsx';
import { draw as render } from './render/renderer.ts';
import { createUnitFxManager, type UnitFxManager } from './render/unit_fx.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja, SaunojaItem, SaunojaStatBlock } from './units/saunoja.ts';
import { makeSaunoja, SAUNOJA_UPKEEP_MAX, SAUNOJA_UPKEEP_MIN } from './units/saunoja.ts';
import { drawSaunojas, preloadSaunojaIcon } from './units/renderSaunoja.ts';
import { SOLDIER_COST } from './units/Soldier.ts';
import { generateTraits } from './data/traits.ts';
import { advanceModifiers } from './mods/runtime.ts';
import { runEconomyTick } from './economy/tick.ts';
import { InventoryState } from './inventory/state.ts';
import type { InventoryComparisonContext } from './state/inventory.ts';
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
import type { ObjectiveResolution, ObjectiveTracker } from './progression/objectives.ts';
import {
  createNgPlusRng,
  ensureNgPlusRunState,
  getAiAggressionModifier,
  getEliteOdds,
  getUnlockSpawnLimit,
  getUpkeepMultiplier,
  loadNgPlusState,
  planNextNgPlusRun,
  saveNgPlusState,
  type NgPlusState
} from './progression/ngplus.ts';
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

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

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

let currentNgPlusState: NgPlusState = ensureNgPlusRunState(loadNgPlusState());
let ngPlusUpkeepMultiplier = 1;
let ngPlusEliteOdds = 0;
let ngPlusSpawnLimit = 1;
let enemyAggressionModifier = 1;
let enemyRandom: () => number = Math.random;
let lootRandom: () => number = Math.random;

function applyNgPlusState(next: NgPlusState): void {
  currentNgPlusState = ensureNgPlusRunState(next);
  ngPlusUpkeepMultiplier = getUpkeepMultiplier(currentNgPlusState);
  ngPlusEliteOdds = getEliteOdds(currentNgPlusState);
  ngPlusSpawnLimit = getUnlockSpawnLimit(currentNgPlusState);
  enemyAggressionModifier = getAiAggressionModifier(currentNgPlusState);
  enemyRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x01);
  lootRandom = createNgPlusRng(currentNgPlusState.runSeed, 0x02);
}

applyNgPlusState(currentNgPlusState);

let canvas: HTMLCanvasElement | null = null;
let saunojas: Saunoja[] = [];
const unitToSaunoja = new Map<string, Saunoja>();
const saunojaToUnit = new Map<string, string>();
const unitsById = new Map<string, Unit>();
let playerSpawnSequence = 0;
let selected: AxialCoord | null = null;
let log: (msg: string) => void = () => {};
let addEvent: (event: GameEvent) => void = () => {};
let disposeRightPanel: (() => void) | null = null;
let topbarControls: TopbarControls | null = null;
let saunaUiController: SaunaUIController | null = null;
let inventoryHudController: { destroy(): void } | null = null;
let rosterHud: RosterHudController | null = null;
let pendingRosterSummary: RosterHudSummary | null = null;
let pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
let pendingRosterEntries: RosterEntry[] | null = null;
let animationFrameId: number | null = null;
let running = false;
let unitFx: UnitFxManager | null = null;
let objectiveTracker: ObjectiveTracker | null = null;
let endScreen: EndScreenController | null = null;
let tutorial: TutorialController | null = null;

function getAttachedUnitFor(attendant: Saunoja): Unit | null {
  const attachedUnitId = saunojaToUnit.get(attendant.id);
  if (!attachedUnitId) {
    return null;
  }
  return unitsById.get(attachedUnitId) ?? null;
}

function applyEffectiveStats(attendant: Saunoja, stats: SaunojaStatBlock): void {
  attendant.effectiveStats = { ...stats };
  attendant.maxHp = Math.max(1, Math.round(stats.health));
  attendant.hp = Math.min(attendant.maxHp, Math.max(0, Math.round(attendant.hp)));
  attendant.defense = typeof stats.defense === 'number' ? Math.max(0, stats.defense) : undefined;
  attendant.shield = typeof stats.shield === 'number' ? Math.max(0, stats.shield) : 0;

  const unit = getAttachedUnitFor(attendant);
  if (unit) {
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

function recomputeEffectiveStats(attendant: Saunoja, loadout?: readonly EquippedItem[]): SaunojaStatBlock {
  const resolvedLoadout = loadout ?? loadoutItems(attendant.equipment);
  const effective = applyEquipment(attendant.baseStats, resolvedLoadout);
  applyEffectiveStats(attendant, effective);
  return effective;
}

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
    return;
  }
  const hasEquipment = loadoutItems(attendant.equipment).length > 0;
  if (hasEquipment) {
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
  attendant.baseStats = base;
  recomputeEffectiveStats(attendant);
}

function disposeTutorial(): void {
  if (!tutorial) {
    return;
  }
  tutorial.destroy();
  tutorial = null;
}

function startTutorialIfNeeded(): void {
  if (isTutorialDone()) {
    disposeTutorial();
    return;
  }
  disposeTutorial();
  tutorial = createTutorialController({
    onComplete: () => {
      setTutorialDone(true);
      disposeTutorial();
    },
    onSkip: () => {
      setTutorialDone(true);
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

function rollSaunojaUpkeep(random: () => number = Math.random): number {
  if (typeof random !== 'function') {
    random = Math.random;
  }
  const min = Math.max(0, Math.floor(SAUNOJA_UPKEEP_MIN));
  const max = Math.max(min, Math.floor(SAUNOJA_UPKEEP_MAX));
  if (max === min) {
    return Math.max(SAUNOJA_UPKEEP_MIN, Math.min(SAUNOJA_UPKEEP_MAX, min));
  }
  const span = max - min + 1;
  const roll = Math.floor(random() * span) + min;
  return Math.max(SAUNOJA_UPKEEP_MIN, Math.min(SAUNOJA_UPKEEP_MAX, roll));
}

function isSaunojaPersonaMissing(saunoja: Saunoja): boolean {
  const traits = Array.isArray(saunoja.traits) ? saunoja.traits : [];
  const hasTraits = traits.length >= 3;
  const upkeepValid = Number.isFinite(saunoja.upkeep);
  const xpValid = Number.isFinite(saunoja.xp);
  return !hasTraits || !upkeepValid || !xpValid;
}

function refreshSaunojaPersona(saunoja: Saunoja): void {
  saunoja.traits = generateTraits();
  saunoja.upkeep = rollSaunojaUpkeep();
  saunoja.xp = 0;
}

function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ay - by));
}

export function setupGame(
  canvasEl: HTMLCanvasElement,
  resourceBarEl: HTMLElement,
  overlayEl: HTMLElement
): void {
  canvas = canvasEl;
  if (unitFx) {
    unitFx.dispose();
    unitFx = null;
  }
  unitFx = createUnitFxManager({
    canvas: canvasEl,
    overlay: overlayEl,
    mapRenderer,
    getUnitById: (id) => unitsById.get(id),
    requestDraw: () => {
      draw();
    }
  });
  if (rosterHud) {
    rosterHud.destroy();
  }
  rosterHud = setupRosterHUD(resourceBarEl, { rosterIcon: uiIcons.saunojaRoster });
  if (pendingRosterRenderer) {
    rosterHud.installRenderer(pendingRosterRenderer);
  }
  if (pendingRosterEntries) {
    rosterHud.renderRoster(pendingRosterEntries);
    pendingRosterEntries = null;
  }

  saunaUiController?.dispose();
  saunaUiController = setupSaunaUI(sauna, {
    getRosterCapLimit: () => ngPlusSpawnLimit,
    updateMaxRosterSize: (value, opts) => updateRosterCap(value, { persist: opts?.persist })
  });

  topbarControls?.dispose();
  topbarControls = setupTopbar(
    state,
    {
      saunakunnia: uiIcons.resource,
      sisu: uiIcons.sisu,
      saunaBeer: uiIcons.saunaBeer,
      sound: uiIcons.sound
    },
    {
      useSisuBurst: () => {
        const used = useSisuBurst(state, units);
        if (used) {
          playSafe('sisu');
          log(
            `Sisu bursts forth, spending ${SISU_BURST_COST} grit to steel our attendants.`
          );
        } else {
          playSafe('error');
        }
        return used;
      },
      torille: () => {
        const used = torille(state, units, sauna.pos, map);
        if (used) {
          log(
            `Torille! Our warriors regroup at the sauna to rally their spirits for ${TORILLE_COST} SISU.`
          );
        } else {
          playSafe('error');
        }
        return used;
      }
    }
  );

  inventoryHudController?.destroy();
  inventoryHudController = setupInventoryHud(inventory, {
    getSelectedUnitId: () => saunojas.find((unit) => unit.selected)?.id ?? null,
    getComparisonContext: () => getSelectedInventoryContext(),
    onEquip: (unitId, item, _source) => equipItemToSaunoja(unitId, item)
  });

  initializeRightPanel();
  syncSaunojaRosterWithUnits();
  updateRosterDisplay();
  startTutorialIfNeeded();
}

const map = new HexMap(10, 10, 32);
const battleManager = new BattleManager(map);
const mapRenderer = new HexMapRenderer(map);
const invalidateTerrainCache = (): void => {
  mapRenderer.invalidateCache();
  draw();
};
eventBus.on('buildingPlaced', invalidateTerrainCache);
eventBus.on('buildingRemoved', invalidateTerrainCache);
// Ensure all tiles start fogged
map.forEachTile((t) => t.setFogged(true));
resetAutoFrame();

const units: Unit[] = [];

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
  }

  const previousUnitId = saunojaToUnit.get(match.id);
  if (previousUnitId && previousUnitId !== unit.id) {
    unitToSaunoja.delete(previousUnitId);
  }

  unitToSaunoja.set(unit.id, match);
  saunojaToUnit.set(match.id, unit.id);

  updateBaseStatsFromUnit(match, unit);
  applyEffectiveStats(match, match.effectiveStats);

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
    draw();
  }
  if (unit.faction === 'player') {
    const steward = 'Our';
    log(`${steward} ${describeUnit(unit, persona)} emerges from the steam.`);
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

const onUnitStatsChanged = (): void => {
  updateRosterDisplay();
};

eventBus.on('unit:stats:changed', onUnitStatsChanged);

function resolveUnitUpkeep(unit: Unit): number {
  const attendant = unitToSaunoja.get(unit.id);
  if (!attendant) {
    return 0;
  }
  const upkeep = Number.isFinite(attendant.upkeep) ? attendant.upkeep : 0;
  return upkeep > 0 ? upkeep * ngPlusUpkeepMultiplier : 0;
}

const state = new GameState(1000);
const inventory = new InventoryState();
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
if (!restoredSave && currentNgPlusState.ngPlusLevel > 0) {
  const bonusBeer = Math.round(75 * currentNgPlusState.ngPlusLevel);
  if (bonusBeer > 0) {
    state.addResource(Resource.SAUNA_BEER, bonusBeer);
  }
}
const saunaSettings = loadSaunaSettings(ngPlusSpawnLimit);
const initialRosterCap = clampRosterCap(saunaSettings.maxRosterSize, ngPlusSpawnLimit);
if (initialRosterCap !== saunaSettings.maxRosterSize) {
  saveSaunaSettings({ maxRosterSize: initialRosterCap });
}
const sauna = createSauna(
  {
    q: Math.floor(map.width / 2),
    r: Math.floor(map.height / 2)
  },
  undefined,
  { maxRosterSize: initialRosterCap }
);

let lastPersistedRosterCap = initialRosterCap;

const updateRosterCap = (
  value: number,
  options: { persist?: boolean } = {}
): number => {
  const sanitized = clampRosterCap(value, ngPlusSpawnLimit);
  const changed = sanitized !== sauna.maxRosterSize;
  if (changed) {
    sauna.maxRosterSize = sanitized;
  }
  if (options.persist && sanitized !== lastPersistedRosterCap) {
    saveSaunaSettings({ maxRosterSize: sanitized });
    lastPersistedRosterCap = sanitized;
  }
  return sanitized;
};

const spawnPlayerReinforcement = (coord: AxialCoord): Unit | null => {
  playerSpawnSequence += 1;
  const id = `p${Date.now()}-${playerSpawnSequence}`;
  const unit = spawnUnit(state, 'soldier', id, coord, 'player');
  if (unit) {
    registerUnit(unit);
  }
  return unit ?? null;
};
const enemySpawner = new EnemySpawner({
  difficulty: enemyAggressionModifier,
  random: enemyRandom,
  eliteOdds: ngPlusEliteOdds
});
const clock = new GameClock(1000, (deltaMs) => {
  const dtSeconds = deltaMs / 1000;
  state.tick();
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
    maxSpawns: ngPlusSpawnLimit,
    rosterCap,
    getRosterCount: getActiveRosterCount
  });
  enemySpawner.update(dtSeconds, units, registerUnit, pickRandomEdgeFreeTile);
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

    map.revealAround(unit.coord, unit.getVisionRange(), { autoFrame: false });
  }
  draw();
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
  draw();
  const overlay = document.getElementById('ui-overlay');
  if (!overlay) {
    return;
  }
  if (endScreen) {
    endScreen.destroy();
    endScreen = null;
  }
  const completedNgPlusLevel = currentNgPlusState.ngPlusLevel;
  const nextRunNgPlusState = planNextNgPlusRun(currentNgPlusState, {
    outcome: resolution.outcome
  });
  saveNgPlusState(nextRunNgPlusState);
  state.setNgPlusState(nextRunNgPlusState);
  applyNgPlusState(nextRunNgPlusState);
  const controller = showEndScreen({
    container: overlay,
    resolution,
    currentNgPlusLevel: completedNgPlusLevel,
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
if (saunojas.length === 0) {
  const seeded = makeSaunoja({
    id: 'saunoja-1',
    coord: sauna.pos,
    selected: true,
    upkeep: 0
  });
  refreshSaunojaPersona(seeded);
  seeded.upkeep = 0;
  saunojas.push(seeded);
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
const hasActivePlayerUnit = units.some((unit) => unit.faction === 'player' && !unit.isDead());
if (!hasActivePlayerUnit) {
  if (!state.canAfford(SOLDIER_COST, Resource.SAUNA_BEER)) {
    state.addResource(Resource.SAUNA_BEER, SOLDIER_COST);
  }
  const fallbackId = `u${units.length + 1}`;
  const fallbackUnit = spawnUnit(state, 'soldier', fallbackId, sauna.pos, 'player');
  if (fallbackUnit) {
    registerUnit(fallbackUnit);
  }
}
map.revealAround(sauna.pos, 3);
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

function initializeRightPanel(): void {
  if (disposeRightPanel) {
    disposeRightPanel();
    disposeRightPanel = null;
  }
  const rightPanel = setupRightPanel(state, {
    onRosterSelect: focusSaunojaById,
    onRosterRendererReady: installRosterRenderer,
    onRosterEquipSlot: equipSlotFromStash,
    onRosterUnequipSlot: unequipSlotToStash
  });
  log = rightPanel.log;
  addEvent = rightPanel.addEvent;
  installRosterRenderer(rightPanel.renderRoster);
  disposeRightPanel = rightPanel.dispose;
}

function updateSaunaHud(): void {
  saunaUiController?.update();
}

function updateTopbarHud(deltaMs: number): void {
  topbarControls?.update(deltaMs);
}


function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player');
  if (unit) {
    registerUnit(unit);
  }
}

if (!restoredSave) {
  state.addResource(Resource.SAUNA_BEER, INITIAL_SAUNA_BEER);
  log(
    `Quartermaster stocks ${INITIAL_SAUNA_BEER} bottles of ${RESOURCE_LABELS[Resource.SAUNA_BEER]} to launch your campaign.`
  );
  state.addResource(Resource.SAUNAKUNNIA, INITIAL_SAUNAKUNNIA);
  log(
    `Sauna elders honor your leadership with ${INITIAL_SAUNAKUNNIA} ${RESOURCE_LABELS[Resource.SAUNAKUNNIA]} to celebrate your arrival.`
  );
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
  if (deselectAllSaunojas()) {
    changed = true;
  }
  if (setSelectedCoord(null)) {
    changed = true;
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
  draw();
}

export function handleCanvasClick(world: PixelCoord): void {
  const clicked = pixelToAxial(world.x, world.y, map.hexSize);
  const target = saunojas.find(
    (unit) => unit.coord.q === clicked.q && unit.coord.r === clicked.r
  );

  const selectionChanged = target ? focusSaunoja(target) : clearSaunojaSelection();

  if (!selectionChanged) {
    return;
  }

  saveUnits();
  updateRosterDisplay();
  draw();
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
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  const assets = getAssets();
  if (!ctx || !assets) return;
  if (unitFx) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    unitFx.step(now);
  }
  const shakeOffset = unitFx?.getShakeOffset() ?? { x: 0, y: 0 };
  const fxOptions = unitFx
    ? { getUnitAlpha: (unit: Unit) => unitFx!.getUnitAlpha(unit.id) }
    : undefined;
  const hasSaunojaOverlays = Array.isArray(saunojas) && saunojas.length > 0;
  const renderUnits = hasSaunojaOverlays
    ? units.filter((unit) => unit.faction !== 'player')
    : units;

  ctx.save();
  if (shakeOffset.x !== 0 || shakeOffset.y !== 0) {
    ctx.translate(shakeOffset.x, shakeOffset.y);
  }
  render(ctx, mapRenderer, assets.images, renderUnits, selected, {
    saunojas: {
      units: saunojas,
      draw: drawSaunojas
    },
    sauna,
    fx: fxOptions
  });
  ctx.restore();
}

const onPolicyApplied = ({ policy }) => {
  log(`Sauna council toasts a fresh keg for policy: ${policy}.`);
};
eventBus.on('policyApplied', onPolicyApplied);

const onUnitDied = ({
  unitId,
  attackerFaction,
  unitFaction
}: {
  unitId: string;
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

  if (idx !== -1) {
    units.splice(idx, 1);
    unitsById.delete(unitId);
    detachSaunoja(unitId);
    draw();
  }
  if (rosterUpdated) {
    saveUnits();
  }
  if (unitFaction === 'player') {
    updateRosterDisplay();
  }
  if (attackerFaction === 'player' && unitFaction && unitFaction !== 'player') {
    const treatAsElite = isEliteUnit(fallen ?? null) || lootRandom() < ngPlusEliteOdds;
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
          log(`Quartermaster fastens ${drop.item.name} to ${ownerName}.`);
        } else {
          log(`Quartermaster stores ${drop.item.name} recovered from ${label}.`);
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
    log('Our grit surges — +1 SISU earned for the vanquished foe.');
  }
  if (fallenCoord) {
    map.revealAround(fallenCoord, 1, { autoFrame: false });
  }
  const side = unitFaction === 'player' ? 'our' : 'a rival';
  log(`The steam hushes as ${side} ${label} grows still.`);
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
  running = false;
  objectiveTracker?.dispose();
  objectiveTracker = null;
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

  eventBus.off('policyApplied', onPolicyApplied);
  eventBus.off('unitDied', onUnitDied);
  eventBus.off('unitSpawned', onUnitSpawned);
  eventBus.off('inventoryChanged', onInventoryChanged);
  eventBus.off('modifierAdded', onModifierChanged);
  eventBus.off('modifierRemoved', onModifierChanged);
  eventBus.off('modifierExpired', onModifierChanged);
  eventBus.off('unit:stats:changed', onUnitStatsChanged);
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
  updateRosterDisplay();
  draw();
  try {
    await preloadSaunojaIcon(() => {
      draw();
    }).then(() => {
      draw();
    });
  } catch (error) {
    console.warn('Failed to preload Saunoja icon before starting the game', error);
  }
  let last = performance.now();
  function gameLoop(now: number) {
    if (!running) {
      return;
    }
    const delta = now - last;
    last = now;
    clock.tick(delta);
    updateSaunaHud();
    updateTopbarHud(delta);
    refreshRosterPanel();
    draw();
    if (!running) {
      return;
    }
    animationFrameId = requestAnimationFrame(gameLoop);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

export { log };

export function __rebuildRightPanelForTest(): void {
  initializeRightPanel();
  updateRosterDisplay();
}

export function __syncSaunojaRosterForTest(): boolean {
  return syncSaunojaRosterWithUnits();
}

export function __getActiveRosterCountForTest(): number {
  return getActiveRosterCount();
}

export function __getUnitUpkeepForTest(unit: Unit): number {
  return resolveUnitUpkeep(unit);
}

export function __getAttachedUnitIdForTest(attendantId: string): string | undefined {
  return saunojaToUnit.get(attendantId);
}

function getActiveRosterCount(): number {
  const seen = new Set<string>();
  for (const unit of units) {
    if (unit.faction === 'player' && !unit.isDead()) {
      seen.add(unit.id);
    }
  }
  for (const attendant of saunojas) {
    seen.add(attendant.id);
  }
  return seen.size;
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

    return {
      id: attendant.id,
      name: attendant.name,
      upkeep,
      status,
      selected: Boolean(attendant.selected),
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
    card = {
      id: featured.id,
      name: featured.name || 'Saunoja',
      traits: [...featured.traits],
      upkeep: Math.max(0, Math.round(featured.upkeep))
    } satisfies RosterCardViewModel;
  }
  return { count: total, card } satisfies RosterHudSummary;
}

function refreshRosterPanel(entries?: RosterEntry[]): void {
  const view = entries ?? buildRosterEntries();
  pendingRosterEntries = view;
  if (!rosterHud) {
    return;
  }
  rosterHud.renderRoster(view);
}

function updateRosterDisplay(): void {
  const summary = buildRosterSummary();
  if (rosterHud) {
    rosterHud.updateSummary(summary);
    pendingRosterSummary = null;
  } else {
    pendingRosterSummary = summary;
  }
  refreshRosterPanel();
}
