import farm from '../assets/sprites/farm.svg';
import barracks from '../assets/sprites/barracks.svg';
import city from '../assets/sprites/city.svg';
import mine from '../assets/sprites/mine.svg';
import soldier from '../assets/sprites/soldier.svg';
import archer from '../assets/sprites/archer.svg';
import avantoMarauder from '../assets/sprites/avanto-marauder.svg';
import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { BattleManager } from './battle/BattleManager.ts';
import { pixelToAxial } from './hex/HexUtils.ts';
import type { AxialCoord, PixelCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit.ts';
import type { UnitType } from './unit.ts';
import { eventBus } from './events';
import type { AssetPaths, LoadedAssets } from './loader.ts';
import { createSauna } from './sim/sauna.ts';
import { EnemySpawner } from './sim/EnemySpawner.ts';
import { setupSaunaUI } from './ui/sauna.tsx';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { playSafe } from './sfx.ts';
import { useSisuBurst, torille, SISU_BURST_COST, TORILLE_COST } from './sim/sisu.ts';
import { generateSaunojaName } from './data/names.ts';
import { setupRightPanel, type GameEvent, type RosterEntry } from './ui/rightPanel.tsx';
import { draw as render } from './render/renderer.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja } from './units/saunoja.ts';
import { makeSaunoja, SAUNOJA_UPKEEP_MAX, SAUNOJA_UPKEEP_MIN } from './units/saunoja.ts';
import { drawSaunojas, preloadSaunojaIcon } from './units/renderSaunoja.ts';
import { SOLDIER_COST } from './units/Soldier.ts';
import { generateTraits } from './data/traits.ts';

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL;
const uiIcons = {
  saunaBeer: `${PUBLIC_ASSET_BASE}assets/ui/sauna-beer.svg`,
  saunojaRoster: `${PUBLIC_ASSET_BASE}assets/ui/saunoja-roster.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sisu: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`
};

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia',
  [Resource.SISU]: 'Sisu'
};

let canvas: HTMLCanvasElement | null = null;
let rosterBar: HTMLElement;
let rosterValue: HTMLSpanElement | null = null;
let rosterCard: HTMLDivElement | null = null;
let rosterCardName: HTMLHeadingElement | null = null;
let rosterCardTraits: HTMLParagraphElement | null = null;
let rosterCardUpkeep: HTMLParagraphElement | null = null;
let saunojas: Saunoja[] = [];
const unitToSaunoja = new Map<string, Saunoja>();
const saunojaToUnit = new Map<string, string>();
const assignedSaunojaNames = new Set<string>();
let selected: AxialCoord | null = null;
let log: (msg: string) => void = () => {};
let addEvent: (event: GameEvent) => void = () => {};
let updateRosterPanel: (roster: RosterEntry[]) => void = () => {};

const SAUNOJA_STORAGE_KEY = 'autobattles:saunojas';

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

function refreshSaunojaPersona(saunoja: Saunoja): void {
  saunoja.traits = generateTraits();
  saunoja.upkeep = rollSaunojaUpkeep();
  saunoja.xp = 0;
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function registerSaunojaName(name: string | undefined): void {
  if (!name) {
    return;
  }
  const key = normalizeNameKey(name);
  if (key.length === 0 || key === 'saunoja') {
    return;
  }
  assignedSaunojaNames.add(key);
}

function ensureSaunojaHasName(saunoja: Saunoja): boolean {
  const current = (saunoja.name ?? '').trim();
  if (current.length > 0 && current.toLowerCase() !== 'saunoja') {
    registerSaunojaName(current);
    return false;
  }

  let candidate = '';
  let key = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    candidate = generateSaunojaName();
    key = normalizeNameKey(candidate);
    if (key.length === 0 || key === 'saunoja') {
      continue;
    }
    if (!assignedSaunojaNames.has(key)) {
      break;
    }
    candidate = '';
    key = '';
  }

  if (!candidate || key.length === 0 || key === 'saunoja' || assignedSaunojaNames.has(key)) {
    candidate = `Saunoja ${assignedSaunojaNames.size + 1}`;
    key = normalizeNameKey(candidate);
  }

  saunoja.name = candidate;
  assignedSaunojaNames.add(key);
  return true;
}

function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ay - by));
}

const rosterCountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const rosterUpkeepFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

function getSaunojaStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalWithStorage.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadUnits(): Saunoja[] {
  const storage = getSaunojaStorage();
  if (!storage) {
    return [];
  }

  try {
    const raw = storage.getItem(SAUNOJA_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const restored: Saunoja[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const data = entry as Record<string, unknown>;
      const idValue = data.id;
      if (typeof idValue !== 'string' || idValue.length === 0) continue;

      const coordSource = data.coord as { q?: unknown; r?: unknown } | undefined;
      const coord =
        coordSource &&
        typeof coordSource === 'object' &&
        typeof coordSource.q === 'number' &&
        Number.isFinite(coordSource.q) &&
        typeof coordSource.r === 'number' &&
        Number.isFinite(coordSource.r)
          ? { q: coordSource.q, r: coordSource.r }
          : undefined;

      const traitsSource = data.traits;
      const traits = Array.isArray(traitsSource)
        ? traitsSource.filter((trait): trait is string => typeof trait === 'string')
        : undefined;

      const upkeepValue = typeof data.upkeep === 'number' ? data.upkeep : undefined;
      const xpValue = typeof data.xp === 'number' ? data.xp : undefined;

      restored.push(
        makeSaunoja({
          id: idValue,
          name: typeof data.name === 'string' ? data.name : undefined,
          coord,
          maxHp: typeof data.maxHp === 'number' ? data.maxHp : undefined,
          hp: typeof data.hp === 'number' ? data.hp : undefined,
          steam: typeof data.steam === 'number' ? data.steam : undefined,
          traits,
          upkeep: upkeepValue,
          xp: xpValue,
          selected: Boolean(data.selected)
        })
      );
    }

    return restored;
  } catch (error) {
    console.warn('Failed to load Saunoja units from storage', error);
    return [];
  }
}

export function saveUnits(): void {
  const storage = getSaunojaStorage();
  if (!storage) {
    return;
  }

  try {
    const payload = saunojas.map((unit) => ({
      id: unit.id,
      name: unit.name,
      coord: { q: unit.coord.q, r: unit.coord.r },
      maxHp: unit.maxHp,
      hp: unit.hp,
      steam: unit.steam,
      traits: [...unit.traits],
      upkeep: unit.upkeep,
      xp: unit.xp,
      selected: unit.selected
    }));
    storage.setItem(SAUNOJA_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist Saunoja units', error);
  }
}

export function setupGame(canvasEl: HTMLCanvasElement, resourceBarEl: HTMLElement): void {
  canvas = canvasEl;
  rosterBar = resourceBarEl;
  rosterBar.classList.add('sauna-roster');
  rosterBar.setAttribute('role', 'status');
  rosterBar.setAttribute('aria-live', 'polite');
  rosterBar.setAttribute('title', 'Active sauna battalion on the field');
  rosterBar.replaceChildren();

  const summary = document.createElement('div');
  summary.classList.add('sauna-roster__summary');

  const icon = document.createElement('img');
  icon.src = uiIcons.saunojaRoster;
  icon.alt = 'Saunoja roster crest';
  icon.decoding = 'async';
  icon.classList.add('sauna-roster__icon');

  const textContainer = document.createElement('div');
  textContainer.classList.add('sauna-roster__text');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = 'Saunoja Roster';
  labelSpan.classList.add('sauna-roster__label');

  rosterValue = document.createElement('span');
  rosterValue.textContent = '0';
  rosterValue.classList.add('sauna-roster__value');

  textContainer.append(labelSpan, rosterValue);
  summary.append(icon, textContainer);

  rosterCard = document.createElement('div');
  rosterCard.classList.add('saunoja-card');
  rosterCard.setAttribute('aria-live', 'polite');
  rosterCard.hidden = true;

  rosterCardName = document.createElement('h3');
  rosterCardName.classList.add('saunoja-card__name');
  rosterCardName.textContent = 'Saunoja';

  rosterCardTraits = document.createElement('p');
  rosterCardTraits.classList.add('saunoja-card__traits');

  rosterCardUpkeep = document.createElement('p');
  rosterCardUpkeep.classList.add('saunoja-card__upkeep');

  rosterCard.append(rosterCardName, rosterCardTraits, rosterCardUpkeep);
  rosterBar.append(summary, rosterCard);
  updateRosterDisplay();
}

export const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    'unit-soldier': soldier,
    'unit-archer': archer,
    'unit-avanto-marauder': avantoMarauder,
    'icon-sauna-beer': uiIcons.saunaBeer,
    'icon-saunoja-roster': uiIcons.saunojaRoster,
    'icon-resource': uiIcons.resource,
    'icon-sound': uiIcons.sound
  }
};
let assets: LoadedAssets | null = null;

export function setAssets(loaded: LoadedAssets): void {
  assets = loaded;
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

function pickRandomEdgeFreeTile(): AxialCoord | undefined {
  const occupied = new Set<string>();
  for (const unit of units) {
    if (!unit.isDead()) {
      occupied.add(`${unit.coord.q},${unit.coord.r}`);
    }
  }

  const candidates: AxialCoord[] = [];
  const seen = new Set<string>();
  const pushIfFree = (q: number, r: number) => {
    const key = `${q},${r}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    if (!occupied.has(key)) {
      candidates.push({ q, r });
    }
  };

  for (let q = map.minQ; q <= map.maxQ; q++) {
    pushIfFree(q, map.minR);
    pushIfFree(q, map.maxR);
  }

  for (let r = map.minR; r <= map.maxR; r++) {
    pushIfFree(map.minQ, r);
    pushIfFree(map.maxQ, r);
  }

  if (candidates.length === 0) {
    return undefined;
  }

  const index = Math.floor(Math.random() * candidates.length);
  const choice = candidates[index];
  map.ensureTile(choice.q, choice.r);
  return choice;
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
): { saunoja: Saunoja; created: boolean; attached: boolean; renamed: boolean } {
  const existing = unitToSaunoja.get(unit.id);
  if (existing) {
    const renamedExisting = ensureSaunojaHasName(existing);
    return { saunoja: existing, created: false, attached: false, renamed: renamedExisting };
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

  const renamed = ensureSaunojaHasName(match);
  refreshSaunojaPersona(match);

  return { saunoja: match, created, attached: true, renamed };
}

function syncSaunojaRosterWithUnits(): boolean {
  let changed = false;

  for (const unit of units) {
    if (unit.faction !== 'player' || unit.isDead()) {
      continue;
    }

    const { saunoja, created, attached, renamed } = claimSaunoja(unit);
    if (created || attached || renamed) {
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

function describeUnit(unit: Unit): string {
  const persona = unitToSaunoja.get(unit.id);
  if (persona?.name) {
    return persona.name;
  }
  const ctorName = unit.constructor?.name ?? 'Unit';
  const spacedName = ctorName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return `${spacedName} ${unit.id}`.trim();
}

function registerUnit(unit: Unit): void {
  if (units.some((existing) => existing.id === unit.id)) {
    return;
  }
  units.push(unit);
  if (unit.faction === 'player') {
    syncSaunojaRosterWithUnits();
  }
  if (canvas) {
    draw();
  }
  const steward = unit.faction === 'player' ? 'Our' : 'A rival';
  log(`${steward} ${describeUnit(unit)} emerges from the steam.`);
  if (unit.faction === 'player') {
    updateRosterDisplay();
  }
}

const onUnitSpawned = ({ unit }: UnitSpawnedPayload): void => {
  registerUnit(unit);
};

eventBus.on('unitSpawned', onUnitSpawned);

const state = new GameState(1000);
const restoredSave = state.load(map);
const clock = new GameClock(1000, (deltaMs) => {
  const dtSeconds = deltaMs / 1000;
  state.tick();
  sauna.update(dtSeconds, state, units, (unit) => {
    registerUnit(unit);
  });
  enemySpawner.update(dtSeconds, units, (unit) => {
    registerUnit(unit);
  }, pickRandomEdgeFreeTile);
  battleManager.tick(units);
  const rosterDirty = syncSaunojaRosterWithUnits();
  let upkeepDrain = 0;
  for (const unit of units) {
    if (unit.faction !== 'player' || unit.isDead()) {
      continue;
    }
    const attendant = unitToSaunoja.get(unit.id);
    if (!attendant) {
      continue;
    }
    const upkeep = Number.isFinite(attendant.upkeep) ? attendant.upkeep : 0;
    if (upkeep > 0) {
      upkeepDrain += upkeep;
    }
  }
  if (upkeepDrain > 0) {
    state.addResource(Resource.SAUNA_BEER, -upkeepDrain);
  }
  state.save();
  if (rosterDirty) {
    updateRosterDisplay();
  }
  // Reveal around all active units before rendering so fog-of-war keeps pace with combat
  for (const unit of units) {
    if (unit.isDead() || unit.faction !== 'player') {
      continue;
    }

    map.revealAround(unit.coord, unit.getVisionRange());
  }
  draw();
});
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
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
const enemySpawner = new EnemySpawner();
map.revealAround(sauna.pos, 3);
saunojas = loadUnits();
assignedSaunojaNames.clear();
let rosterRenamedOnLoad = false;
for (const unit of saunojas) {
  if (ensureSaunojaHasName(unit)) {
    rosterRenamedOnLoad = true;
  }
}
if (rosterRenamedOnLoad) {
  saveUnits();
}
if (saunojas.length === 0) {
  const seeded = makeSaunoja({
    id: 'saunoja-1',
    name: generateSaunojaName(),
    coord: sauna.pos,
    selected: true
  });
  ensureSaunojaHasName(seeded);
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
const updateTopbar = setupTopbar(
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
const rightPanel = setupRightPanel(state);
log = rightPanel.log;
addEvent = rightPanel.addEvent;
updateRosterPanel = rightPanel.setRoster;
updateRosterPanel(buildRosterEntries());


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

export function handleCanvasClick(world: PixelCoord): void {
  const clicked = pixelToAxial(world.x - map.hexSize, world.y - map.hexSize, map.hexSize);
  const target = saunojas.find(
    (unit) => unit.coord.q === clicked.q && unit.coord.r === clicked.r
  );

  let selectionChanged = false;

  if (!target) {
    if (deselectAllSaunojas()) {
      selectionChanged = true;
    }
    if (setSelectedCoord(null)) {
      selectionChanged = true;
    }
  } else {
    const toggledSelected = !target.selected;
    if (target.selected !== toggledSelected) {
      target.selected = toggledSelected;
      selectionChanged = true;
    }

    if (toggledSelected) {
      if (deselectAllSaunojas(target)) {
        selectionChanged = true;
      }
      if (setSelectedCoord(target.coord)) {
        selectionChanged = true;
      }
    } else {
      if (deselectAllSaunojas()) {
        selectionChanged = true;
      }
      if (setSelectedCoord(null)) {
        selectionChanged = true;
      }
    }
  }

  if (!selectionChanged) {
    return;
  }

  saveUnits();
  updateRosterDisplay();
  draw();
}

export function draw(): void {
  if (!canvas) {
    return;
  }
  const ctx = canvas.getContext('2d');
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
  if (idx !== -1) {
    units.splice(idx, 1);
    detachSaunoja(unitId);
    draw();
  }
  if (unitFaction === 'player') {
    updateRosterDisplay();
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
  const label = fallen ? describeUnit(fallen) : `unit ${unitId}`;
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
  eventBus.off('buildingPlaced', invalidateTerrainCache);
  eventBus.off('buildingRemoved', invalidateTerrainCache);
}

export async function start(): Promise<void> {
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
    draw();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

export { log };

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
    if (attendant.hp > 0) {
      seen.add(attendant.id);
    }
  }
  return seen.size;
}

function buildRosterEntries(): RosterEntry[] {
  const entries: RosterEntry[] = saunojas.map((unit) => {
    const attachedUnitId = saunojaToUnit.get(unit.id);
    const attachedUnit = attachedUnitId
      ? units.find((candidate) => candidate.id === attachedUnitId && !candidate.isDead())
      : undefined;
    const hp = Math.max(0, Math.round(unit.hp));
    const maxHp = Math.max(1, Math.round(unit.maxHp));
    const vitalityPercent = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
    const upkeep = Math.max(0, Math.round(unit.upkeep));
    const traits = (unit.traits ?? []).map((trait) => trait.trim()).filter((trait) => trait.length > 0);
    const active = Boolean(attachedUnit);
    const alive = hp > 0;
    let status: string;
    if (!alive) {
      status = 'Fallen — awaiting revival';
    } else if (active) {
      status = `On mission • Hex ${unit.coord.q},${unit.coord.r}`;
    } else {
      status = 'Resting by the sauna hearth';
    }

    return {
      id: unit.id,
      name: unit.name,
      status,
      hp,
      maxHp,
      vitalityPercent,
      upkeep,
      traits,
      selected: unit.selected,
      active
    };
  });

  entries.sort((a, b) => {
    if (a.selected !== b.selected) {
      return a.selected ? -1 : 1;
    }
    if (a.active !== b.active) {
      return a.active ? -1 : 1;
    }
    if ((a.hp > 0) !== (b.hp > 0)) {
      return a.hp > 0 ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'fi');
  });

  return entries;
}

function renderSaunojaCard(): void {
  if (!rosterCard || !rosterCardTraits || !rosterCardUpkeep) {
    return;
  }

  const preferred =
    saunojas.find((unit) => unit.selected) ??
    saunojas.find((unit) => unit.hp > 0) ??
    saunojas[0];

  if (!preferred) {
    rosterCard.hidden = true;
    return;
  }

  rosterCard.hidden = false;
  rosterCard.dataset.unitId = preferred.id;

  if (rosterCardName) {
    rosterCardName.textContent = preferred.name || 'Saunoja';
  }

  const traitList = preferred.traits?.filter((trait) => trait.length > 0) ?? [];
  const traitLabel =
    traitList.length > 0 ? traitList.join(', ') : 'No notable traits yet';
  rosterCardTraits.textContent = traitLabel;
  rosterCardTraits.title = traitLabel;

  const upkeepValue = Math.max(0, Math.round(preferred.upkeep));
  const upkeepLabel = `Upkeep: ${rosterUpkeepFormatter.format(upkeepValue)} Beer`;
  rosterCardUpkeep.textContent = upkeepLabel;
  rosterCardUpkeep.title = upkeepLabel;
}

function updateRosterDisplay(): void {
  const total = Math.max(0, Math.floor(getActiveRosterCount()));
  const formatted = rosterCountFormatter.format(total);
  if (rosterValue) {
    rosterValue.textContent = formatted;
  } else if (rosterBar) {
    rosterBar.textContent = `Saunoja roster: ${formatted}`;
  }
  if (rosterBar) {
    rosterBar.setAttribute('aria-label', `Saunoja roster: ${formatted} active attendants`);
    rosterBar.setAttribute('title', `Saunoja roster • ${formatted} active attendants`);
  }
  updateRosterPanel(buildRosterEntries());
  renderSaunojaCard();
}
