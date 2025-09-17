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
import { setupSaunaUI } from './ui/sauna.tsx';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { playSafe } from './sfx.ts';
import { activateSisuPulse } from './sim/sisu.ts';
import { setupRightPanel } from './ui/rightPanel.tsx';
import { draw as render } from './render/renderer.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja } from './units/saunoja.ts';
import { makeSaunoja } from './units/saunoja.ts';
import { drawSaunojas, preloadSaunojaIcon } from './units/renderSaunoja.ts';

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL;
const uiIcons = {
  saunaBeer: `${PUBLIC_ASSET_BASE}assets/ui/sauna-beer.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`
};

const INITIAL_SAUNA_BEER = 200;
const INITIAL_SAUNAKUNNIA = 3;
const SAUNAKUNNIA_AURA_INTERVAL = 2000;
const SAUNAKUNNIA_AURA_GAIN = 1;
const SAUNAKUNNIA_VICTORY_BONUS = 2;

const RESOURCE_LABELS: Record<Resource, string> = {
  [Resource.SAUNA_BEER]: 'Sauna Beer',
  [Resource.SAUNAKUNNIA]: 'Saunakunnia'
};

let canvas: HTMLCanvasElement | null = null;
let rosterBar: HTMLElement;
let rosterValue: HTMLSpanElement | null = null;
let saunojas: Saunoja[] = [];
const saunojaByUnitId = new Map<string, Saunoja>();

const SAUNOJA_STORAGE_KEY = 'autobattles:saunojas';

function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(ay - by));
}

const rosterCountFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

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

      restored.push(
        makeSaunoja({
          id: idValue,
          name: typeof data.name === 'string' ? data.name : undefined,
          coord,
          maxHp: typeof data.maxHp === 'number' ? data.maxHp : undefined,
          hp: typeof data.hp === 'number' ? data.hp : undefined,
          steam: typeof data.steam === 'number' ? data.steam : undefined,
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

  const icon = document.createElement('img');
  icon.src = uiIcons.saunaBeer;
  icon.alt = 'Saunoja roster crest';
  icon.decoding = 'async';
  icon.classList.add('sauna-roster__icon');

  const textContainer = document.createElement('span');
  textContainer.classList.add('sauna-roster__text');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = 'Saunoja Roster';
  labelSpan.classList.add('sauna-roster__label');

  rosterValue = document.createElement('span');
  rosterValue.textContent = '0';
  rosterValue.classList.add('sauna-roster__value');

  textContainer.append(labelSpan, rosterValue);
  rosterBar.append(icon, textContainer);
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
// Ensure all tiles start fogged
map.forEachTile((t) => t.setFogged(true));
resetAutoFrame();

const units: Unit[] = [];

function trackSaunojaForUnit(unit: Unit): Saunoja | null {
  if (unit.faction !== 'player') {
    return null;
  }

  const existing = saunojaByUnitId.get(unit.id);
  let attendant = existing ?? saunojas.find((candidate) => candidate.id === unit.id) ?? null;
  if (!attendant) {
    attendant = makeSaunoja({
      id: unit.id,
      coord: { q: unit.coord.q, r: unit.coord.r },
      maxHp: unit.getMaxHealth(),
      hp: unit.stats.health
    });
    saunojas.push(attendant);
    saveUnits();
  } else {
    attendant.maxHp = unit.getMaxHealth();
    attendant.hp = Math.max(0, Math.min(attendant.maxHp, unit.stats.health));
  }

  saunojaByUnitId.set(unit.id, attendant);
  return attendant;
}

export function syncSaunojasFromUnits(): boolean {
  let updated = false;

  for (const unit of units) {
    if (unit.faction !== 'player' || unit.isDead()) {
      continue;
    }

    const attendant = trackSaunojaForUnit(unit);
    if (!attendant) {
      continue;
    }

    const { q, r } = unit.coord;
    if (attendant.coord.q !== q || attendant.coord.r !== r) {
      attendant.coord = { q, r };
      updated = true;
    }
  }

  return updated;
}

export function getSaunojaRoster(): Saunoja[] {
  return saunojas.map((unit) => ({
    ...unit,
    coord: { q: unit.coord.q, r: unit.coord.r }
  }));
}

type UnitSpawnedPayload = { unit: Unit };

function describeUnit(unit: Unit): string {
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
    trackSaunojaForUnit(unit);
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
state.load(map);
const VISION_RADIUS = 2;
const clock = new GameClock(1000, () => {
  state.tick();
  battleManager.tick(units);
  const saunojaPositionsChanged = syncSaunojasFromUnits();
  if (saunojaPositionsChanged) {
    saveUnits();
  }
  state.save();
  // Reveal around all friendly units each tick
  for (const unit of units) {
    if (!unit.isDead() && unit.faction === 'player') {
      map.revealAround(unit.coord, VISION_RADIUS);
    }
  }
  draw();
});
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
});
map.revealAround(sauna.pos, 3);
saunojas = loadUnits();
for (const attendant of saunojas) {
  saunojaByUnitId.set(attendant.id, attendant);
}
if (saunojas.length === 0) {
  saunojas.push(
    makeSaunoja({
      id: 'saunoja-1',
      coord: sauna.pos,
      selected: true
    })
  );
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
const updateTopbar = setupTopbar(state, {
  saunakunnia: uiIcons.resource,
  sisu: uiIcons.resource,
  saunaBeer: uiIcons.saunaBeer,
  sound: uiIcons.sound
});
const { log, addEvent } = setupRightPanel(state);
let saunaAuraTimer = 0;
eventBus.on('sisuPulse', () => activateSisuPulse(state, units));
eventBus.on('sisuPulseStart', () => playSafe('sisu'));

function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player');
  if (unit) {
    registerUnit(unit);
  }
}

function handleSaunaAura(deltaMs: number): void {
  if (deltaMs <= 0) {
    return;
  }

  const auraRadius = sauna.auraRadius;
  const saunaPos = sauna.pos;

  const saunojaInAura = saunojas.some((unit) => hexDistance(unit.coord, saunaPos) <= auraRadius);
  const unitInAura = units.some(
    (unit) =>
      unit.faction === 'player' &&
      !unit.isDead() &&
      unit.distanceTo(saunaPos) <= auraRadius
  );

  if (!saunojaInAura && !unitInAura) {
    saunaAuraTimer = 0;
    return;
  }

  saunaAuraTimer += deltaMs;
  if (saunaAuraTimer < SAUNAKUNNIA_AURA_INTERVAL) {
    return;
  }

  const pulses = Math.floor(saunaAuraTimer / SAUNAKUNNIA_AURA_INTERVAL);
  saunaAuraTimer -= pulses * SAUNAKUNNIA_AURA_INTERVAL;
  const honorGain = pulses * SAUNAKUNNIA_AURA_GAIN;
  if (honorGain <= 0) {
    return;
  }

  state.addResource(Resource.SAUNAKUNNIA, honorGain);
}

state.addResource(Resource.SAUNA_BEER, INITIAL_SAUNA_BEER);
log(
  `Quartermaster stocks ${INITIAL_SAUNA_BEER} bottles of ${RESOURCE_LABELS[Resource.SAUNA_BEER]} to launch your campaign.`
);
state.addResource(Resource.SAUNAKUNNIA, INITIAL_SAUNAKUNNIA);
log(
  `Sauna elders honor your leadership with ${INITIAL_SAUNAKUNNIA} ${RESOURCE_LABELS[Resource.SAUNAKUNNIA]} to celebrate your arrival.`
);

let selected: AxialCoord | null = null;
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
  if (idx !== -1) {
    units.splice(idx, 1);
    draw();
  }
  if (
    attackerFaction === 'player' &&
    unitFaction &&
    unitFaction !== 'player'
  ) {
    state.addResource(Resource.SAUNAKUNNIA, SAUNAKUNNIA_VICTORY_BONUS);
  }
  const side = unitFaction === 'player' ? 'our' : 'a rival';
  const label = fallen ? describeUnit(fallen) : `unit ${unitId}`;
  log(`The steam hushes as ${side} ${label} grows still.`);
  if (unitFaction === 'player') {
    saunojaByUnitId.delete(unitId);
    const attendant = saunojas.find((unit) => unit.id === unitId);
    if (attendant) {
      attendant.hp = 0;
      attendant.steam = 0;
    }
    updateRosterDisplay();
  }
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
  eventBus.off('policyApplied', onPolicyApplied);
  eventBus.off('unitDied', onUnitDied);
  eventBus.off('unitSpawned', onUnitSpawned);
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
    sauna.update(delta / 1000, units, (u) => {
      registerUnit(u);
    });
    updateSaunaUI();
    updateTopbar(delta);
    handleSaunaAura(delta);
    draw();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

export { log };

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
}
