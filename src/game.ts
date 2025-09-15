import plains from '../assets/sprites/plains.svg';
import forest from '../assets/sprites/forest.svg';
import hills from '../assets/sprites/hills.svg';
import lake from '../assets/sprites/lake.svg';
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

const PUBLIC_ASSET_BASE = import.meta.env.BASE_URL;
const tileAssets = {
  forest: `${PUBLIC_ASSET_BASE}assets/tiles/forest.svg`,
  water: `${PUBLIC_ASSET_BASE}assets/tiles/water.svg`,
  mountain: `${PUBLIC_ASSET_BASE}assets/tiles/mountain.svg`,
  plains: `${PUBLIC_ASSET_BASE}assets/tiles/plains.svg`
};

const uiIcons = {
  gold: `${PUBLIC_ASSET_BASE}assets/ui/gold.svg`,
  resource: `${PUBLIC_ASSET_BASE}assets/ui/resource.svg`,
  sound: `${PUBLIC_ASSET_BASE}assets/ui/sound.svg`
};

let canvas: HTMLCanvasElement;
let resourceBar: HTMLElement;
let resourceValue: HTMLSpanElement | null = null;

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
  selected = pixelToAxial(x - map.hexSize, y - map.hexSize, map.hexSize);
  draw();
}

const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    'terrain-plains': plains,
    'terrain-forest': forest,
    'terrain-hills': hills,
    'terrain-lake': lake,
    'building-farm': farm,
    'building-barracks': barracks,
    'building-city': city,
    'building-mine': mine,
    'unit-soldier': soldier,
    'unit-archer': archer,
    'unit-raider': raider,
    'tile-forest': tileAssets.forest,
    'tile-water': tileAssets.water,
    'tile-mountain': tileAssets.mountain,
    'tile-plains': tileAssets.plains,
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

export function draw(): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !assets) return;
  render(ctx, mapRenderer, assets.images, units, selected);
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
