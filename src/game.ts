import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { BattleManager } from './battle/BattleManager.ts';
import { pixelToAxial } from './hex/HexUtils.ts';
import type { AxialCoord, PixelCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit.ts';
import type { UnitType } from './unit.ts';
import { eventBus } from './events';
import { createSauna, pickFreeTileAround } from './sim/sauna.ts';
import { EnemySpawner } from './sim/EnemySpawner.ts';
import { setupSaunaUI } from './ui/sauna.tsx';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { playSafe } from './sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from './sim/sisu.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from './ui/rightPanel.tsx';
import { draw as render } from './render/renderer.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja, SaunojaItem } from './units/saunoja.ts';
import { makeSaunoja, SAUNOJA_UPKEEP_MAX, SAUNOJA_UPKEEP_MIN } from './units/saunoja.ts';
import { drawSaunojas, preloadSaunojaIcon } from './units/renderSaunoja.ts';
import { SOLDIER_COST } from './units/Soldier.ts';
import { generateTraits } from './data/traits.ts';
import { advanceModifiers } from './mods/runtime.ts';
import { runEconomyTick } from './economy/tick.ts';
import { InventoryState } from './inventory/state.ts';
import { setupInventoryHud } from './ui/inventoryHud.ts';
import { rollLoot } from './loot/roll.ts';
import { tryGetUnitArchetype } from './unit/archetypes.ts';
import { computeUnitStats } from './unit/calc.ts';
import { getAssets, uiIcons } from './game/assets.ts';
import {
  getSaunojaStorage,
  loadUnits as loadRosterFromStorage,
  saveUnits as persistRosterToStorage,
  SAUNOJA_STORAGE_KEY
} from './game/rosterStorage.ts';
import {
  setupRosterHUD,
  type RosterCardViewModel,
  type RosterHudController,
  type RosterHudSummary
} from './ui/rosterHUD.ts';

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

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
let rosterHud: RosterHudController | null = null;
let pendingRosterSummary: RosterHudSummary | null = null;
let pendingRosterRenderer: ((entries: RosterEntry[]) => void) | null = null;
let pendingRosterEntries: RosterEntry[] | null = null;

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
  const hasTraits = traits.length > 0;
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

export function setupGame(canvasEl: HTMLCanvasElement, resourceBarEl: HTMLElement): void {
  canvas = canvasEl;
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
  updateRosterDisplay();
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

function resolveUnitUpkeep(unit: Unit): number {
  const attendant = unitToSaunoja.get(unit.id);
  if (!attendant) {
    return 0;
  }
  const upkeep = Number.isFinite(attendant.upkeep) ? attendant.upkeep : 0;
  return upkeep > 0 ? upkeep : 0;
}

const state = new GameState(1000);
const inventory = new InventoryState();
const restoredSave = state.load(map);
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
});

const spawnPlayerReinforcement = (coord: AxialCoord): Unit | null => {
  playerSpawnSequence += 1;
  const id = `p${Date.now()}-${playerSpawnSequence}`;
  const unit = spawnUnit(state, 'soldier', id, coord, 'player');
  if (unit) {
    registerUnit(unit);
  }
  return unit ?? null;
};
const enemySpawner = new EnemySpawner();
const clock = new GameClock(1000, (deltaMs) => {
  const dtSeconds = deltaMs / 1000;
  state.tick();
  runEconomyTick({
    dt: dtSeconds,
    state,
    sauna,
    heat: sauna.heatTracker,
    units,
    getUnitUpkeep: resolveUnitUpkeep,
    pickSpawnTile: () => pickFreeTileAround(sauna.pos, units),
    spawnBaseUnit: spawnPlayerReinforcement,
    minUpkeepReserve: Math.max(1, SAUNOJA_UPKEEP_MIN)
  });
  enemySpawner.update(dtSeconds, units, registerUnit, pickRandomEdgeFreeTile);
  battleManager.tick(units, dtSeconds);
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

    map.revealAround(unit.coord, unit.getVisionRange());
  }
  draw();
});
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
saunojas = loadUnits();
if (saunojas.length === 0) {
  const seeded = makeSaunoja({
    id: 'saunoja-1',
    coord: sauna.pos,
    selected: true
  });
  refreshSaunojaPersona(seeded);
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
if (import.meta.env.DEV) {
  console.debug('Saunoja roster restored', {
    count: saunojas.length,
    coordinates: saunojas.map((unit) => ({ q: unit.coord.q, r: unit.coord.r }))
  });
}
const updateSaunaUI = setupSaunaUI(sauna);
const { update: updateTopbar, dispose: disposeTopbar } = setupTopbar(
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
        log(`Torille! Our warriors regroup at the sauna to rally their spirits for ${TORILLE_COST} SISU.`);
      } else {
        playSafe('error');
      }
      return used;
    }
  }
);
const inventoryHud = setupInventoryHud(inventory, {
  getSelectedUnitId: () => saunojas.find((unit) => unit.selected)?.id ?? null,
  onEquip: (unitId, item) => equipItemToSaunoja(unitId, item)
});
function initializeRightPanel(): void {
  if (disposeRightPanel) {
    disposeRightPanel();
    disposeRightPanel = null;
  }
  const rightPanel = setupRightPanel(state, {
    onRosterSelect: focusSaunojaById,
    onRosterRendererReady: installRosterRenderer
  });
  log = rightPanel.log;
  addEvent = rightPanel.addEvent;
  installRosterRenderer(rightPanel.renderRoster);
  disposeRightPanel = rightPanel.dispose;
}

initializeRightPanel();
updateRosterDisplay();


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

function equipItemToSaunoja(unitId: string, item: SaunojaItem): boolean {
  const attendant = saunojas.find((unit) => unit.id === unitId);
  if (!attendant) {
    return false;
  }
  const quantity = Math.max(1, Math.round(item.quantity ?? 1));
  const existing = attendant.items.find((entry) => entry.id === item.id);
  if (existing) {
    existing.quantity = Math.max(1, existing.quantity + quantity);
  } else {
    attendant.items.push({
      id: item.id,
      name: item.name,
      description: item.description,
      icon: item.icon,
      rarity: item.rarity,
      quantity
    });
  }
  eventBus.emit('inventoryChanged', {});
  saveUnits();
  refreshRosterPanel();
  return true;
}

export function draw(): void {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
  const assets = getAssets();
  if (!ctx || !assets) return;
  render(ctx, mapRenderer, assets.images, units, selected, {
    saunojas: {
      units: saunojas,
      draw: drawSaunojas
    },
    sauna
  });
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
    const lootResult = rollLoot({ factionId: unitFaction, elite: isEliteUnit(fallen ?? null) });
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
    map.revealAround(fallenCoord, 1);
  }
  const side = unitFaction === 'player' ? 'our' : 'a rival';
  log(`The steam hushes as ${side} ${label} grows still.`);
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
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

  eventBus.off('policyApplied', onPolicyApplied);
  eventBus.off('unitDied', onUnitDied);
  eventBus.off('unitSpawned', onUnitSpawned);
  eventBus.off('inventoryChanged', onInventoryChanged);
  eventBus.off('modifierAdded', onModifierChanged);
  eventBus.off('modifierRemoved', onModifierChanged);
  eventBus.off('modifierExpired', onModifierChanged);
  eventBus.off('buildingPlaced', invalidateTerrainCache);
  eventBus.off('buildingRemoved', invalidateTerrainCache);
  if (disposeRightPanel) {
    disposeRightPanel();
    disposeRightPanel = null;
  }
  inventoryHud.destroy();
  disposeTopbar();
  if (rosterHud) {
    rosterHud.destroy();
    rosterHud = null;
  }
  pendingRosterEntries = null;
  pendingRosterSummary = null;
  pendingRosterRenderer = null;
}

export async function start(): Promise<void> {
  const assets = getAssets();
  if (!assets) {
    console.error('Cannot start game without loaded assets.');
    return;
  }
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
    const delta = now - last;
    last = now;
    clock.tick(delta);
    updateSaunaUI();
    updateTopbar(delta);
    refreshRosterPanel();
    draw();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

export { log };

export function __rebuildRightPanelForTest(): void {
  initializeRightPanel();
  updateRosterDisplay();
}

export function __syncSaunojaRosterForTest(): boolean {
  return syncSaunojaRosterWithUnits();
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

    const currentHealth = unit
      ? Math.round(Math.max(0, unit.stats.health))
      : Math.round(Math.max(0, attendant.hp));
    const maxHealth = unit
      ? Math.round(Math.max(1, unit.getMaxHealth()))
      : Math.round(Math.max(1, attendant.maxHp));
    const attackDamage = unit ? Math.round(Math.max(0, unit.stats.attackDamage)) : 0;
    const attackRange = unit ? Math.round(Math.max(0, unit.stats.attackRange)) : 0;
    const movementRange = unit ? Math.round(Math.max(0, unit.stats.movementRange)) : 0;
    const defenseSource = unit?.stats.defense ?? attendant.defense ?? 0;
    const defense = Math.round(Math.max(0, defenseSource));
    const shieldSource = unit ? unit.getShield() : attendant.shield;
    const shield = Math.round(Math.max(0, shieldSource));
    const upkeep = Math.max(0, Math.round(attendant.upkeep));
    const status: RosterEntry['status'] =
      currentHealth <= 0 ? 'downed' : unitAlive ? 'engaged' : 'reserve';

    const items = attendant.items.map((item) => ({ ...item }));
    const modifiers = attendant.modifiers.map((modifier) => ({ ...modifier }));

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
