import farm from '../assets/sprites/farm.svg';
import barracks from '../assets/sprites/barracks.svg';
import city from '../assets/sprites/city.svg';
import mine from '../assets/sprites/mine.svg';
import soldier from '../assets/sprites/soldier.svg';
import archer from '../assets/sprites/archer.svg';
import raider from '../assets/sprites/raider.svg';
import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { pixelToAxial } from './hex/HexUtils.ts';
import type { AxialCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit.ts';
import type { UnitType } from './unit.ts';
import { eventBus } from './events';
import { loadAssets } from './loader.ts';
import type { AssetPaths, LoadedAssets } from './loader.ts';
import { createSauna } from './sim/sauna.ts';
import { setupSaunaUI } from './ui/sauna.tsx';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { playSafe } from './sfx.ts';
import { activateSisuPulse } from './sim/sisu.ts';
import { setupRightPanel } from './ui/rightPanel.tsx';
import { showError } from './ui/overlay.ts';
import { draw as render } from './render/renderer.ts';
import { HexMapRenderer } from './render/HexMapRenderer.ts';
import type { Saunoja } from './units/saunoja.ts';
import { makeSaunoja } from './units/saunoja.ts';
import { preloadSaunojaIcon, drawSaunojas } from './units/renderSaunoja.ts';

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL;
const uiIcons = {
  gold: `${PUBLIC_ASSET_BASE}assets/ui/gold.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`
};

let canvas: HTMLCanvasElement;
let resourceBar: HTMLElement;
let resourceValue: HTMLSpanElement | null = null;
let saunojas: Saunoja[] = [];

const SAUNOJA_STORAGE_KEY = 'autobattles:saunojas';

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
  resourceBar = resourceBarEl;
  resourceBar.classList.add('resource-bar');
  resourceBar.setAttribute('role', 'status');
  resourceBar.setAttribute('aria-live', 'polite');
  resourceBar.replaceChildren();

  const icon = document.createElement('img');
  icon.src = uiIcons.resource;
  icon.alt = 'Resources';
  icon.decoding = 'async';
  icon.classList.add('resource-icon');

  const labelSpan = document.createElement('span');
  labelSpan.textContent = 'Resources';
  labelSpan.classList.add('resource-label');

  resourceValue = document.createElement('span');
  resourceValue.textContent = '0';
  resourceValue.classList.add('resource-value');

  resourceBar.append(icon, labelSpan, resourceValue);
  updateResourceDisplay(state.getResource(Resource.GOLD));
}

export function handleCanvasClick(x: number, y: number): void {
  const clicked = pixelToAxial(x - map.hexSize, y - map.hexSize, map.hexSize);
  selected = clicked;

  let selectionChanged = false;
  for (const unit of saunojas) {
    const isSelected = unit.coord.q === clicked.q && unit.coord.r === clicked.r;
    if (unit.selected !== isSelected) {
      unit.selected = isSelected;
      selectionChanged = true;
    }
  }

  if (selectionChanged) {
    saveUnits();
  }

  draw();
}

const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    'unit-soldier': soldier,
    'unit-archer': archer,
    'unit-raider': raider,
    'icon-gold': uiIcons.gold,
    'icon-resource': uiIcons.resource,
    'icon-sound': uiIcons.sound
  }
};
let assets: LoadedAssets;

const map = new HexMap(10, 10, 32);
const mapRenderer = new HexMapRenderer(map);
// Ensure all tiles start fogged
map.forEachTile((t) => t.setFogged(true));
resetAutoFrame();

const state = new GameState(1000);
state.load(map);
const VISION_RADIUS = 2;
const clock = new GameClock(1000, () => {
  state.tick();
  state.save();
  // Reveal around all friendly units each tick
  for (const unit of units) {
    if (!unit.isDead() && unit.faction === 'player') {
      map.revealAround(unit.coord, VISION_RADIUS);
    }
  }
  draw();
});


const units: Unit[] = [];
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
});
map.revealAround(sauna.pos, 3);
saunojas = loadUnits();
if (saunojas.length === 0) {
  saunojas.push(
    makeSaunoja({
      id: 'saunoja-1',
      coord: sauna.pos,
      selected: true
    })
  );
  saveUnits();
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
const updateSaunaUI = setupSaunaUI(sauna);
const updateTopbar = setupTopbar(state, {
  saunakunnia: uiIcons.resource,
  sisu: uiIcons.resource,
  gold: uiIcons.gold,
  sound: uiIcons.sound
});
const { log, addEvent } = setupRightPanel(state);
eventBus.on('sisuPulse', () => activateSisuPulse(state, units));
eventBus.on('sisuPulseStart', () => playSafe('sisu'));

function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player');
  if (unit) {
    units.push(unit);
  }
}

state.addResource(Resource.GOLD, 200);

let selected: AxialCoord | null = null;
const storedSelection = saunojas.find((unit) => unit.selected);
if (storedSelection) {
  selected = { q: storedSelection.coord.q, r: storedSelection.coord.r };
}

export function draw(): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !assets) return;
  render(ctx, mapRenderer, assets.images, units, selected, {
    saunojas: {
      units: saunojas,
      draw: drawSaunojas
    }
  });
}

const onResourceChanged = ({ resource, total, amount }) => {
  updateResourceDisplay(total);
  const sign = amount > 0 ? '+' : '';
  log(`${resource}: ${sign}${amount}`);
};
eventBus.on('resourceChanged', onResourceChanged);

const onPolicyApplied = ({ policy }) => {
  log(`Policy applied: ${policy}`);
};
eventBus.on('policyApplied', onPolicyApplied);

const onUnitDied = ({ unitId }: { unitId: string }) => {
  const idx = units.findIndex((u) => u.id === unitId);
  if (idx !== -1) {
    units.splice(idx, 1);
    draw();
  }
};
eventBus.on('unitDied', onUnitDied);

export function cleanup(): void {
  eventBus.off('resourceChanged', onResourceChanged);
  eventBus.off('policyApplied', onPolicyApplied);
  eventBus.off('unitDied', onUnitDied);
}

export async function start(): Promise<void> {
  preloadSaunojaIcon().catch((error) => {
    console.warn('Unable to preload Saunoja icon', error);
  });
  const { assets: loaded, failures } = await loadAssets(assetPaths);
  assets = loaded;
  if (failures.length) {
    console.warn('Failed to load assets', failures);
    showError(failures);
  }
  updateResourceDisplay(state.getResource(Resource.GOLD));
  draw();
  let last = performance.now();
  function gameLoop(now: number) {
    const delta = now - last;
    last = now;
    clock.tick(delta);
    sauna.update(delta / 1000, units, (u) => {
      units.push(u);
      draw();
    });
    updateSaunaUI();
    updateTopbar(delta);
    draw();
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

export { log };

function updateResourceDisplay(total: number): void {
  if (resourceValue) {
    resourceValue.textContent = String(total);
  } else if (resourceBar) {
    resourceBar.textContent = `Resources: ${total}`;
  }
}
