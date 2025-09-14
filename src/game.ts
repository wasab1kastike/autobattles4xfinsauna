import './style.css';
import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { pixelToAxial, axialToPixel, AxialCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit, UnitType } from './unit.ts';
import Animator from './render/Animator.ts';
import { eventBus } from './events';
import { loadAssets, AssetPaths, LoadedAssets } from './loader.ts';
import { Farm, Barracks } from './buildings/index.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const resourceBar = document.getElementById('resource-bar')!;
const eventLog = document.getElementById('event-log')!;
const buildFarmBtn = document.getElementById('build-farm') as HTMLButtonElement;
const buildBarracksBtn = document.getElementById('build-barracks') as HTMLButtonElement;
const upgradeFarmBtn = document.getElementById('upgrade-farm') as HTMLButtonElement;
const policyBtn = document.getElementById('policy-eco') as HTMLButtonElement;

const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=',
    grass:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGNU6lb6z0ABYKJE86gBowaMGjCYDAAAlL8B7iuXN0wAAAAASUVORK5CYII=',
    water:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGOUm/D/PwMFgIkSzaMGjBowasBgMgAAGD4CzKXqJDYAAAAASUVORK5CYII=',
    'unit-soldier':
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGPcpKT0n4ECwESJ5lEDRg0YNWAwGQAAM4ACFQNjXqgAAAAASUVORK5CYII=',
    farm:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHUlEQVR4nGO8tVThPwMFgIkSzaMGjBowasBgMgAA4QYCvtGd17wAAAAASUVORK5CYII='
  },
  sounds: {
    // Minimal silent WAV
    placeholder:
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='
  }
};
let assets: LoadedAssets;

const map = new HexMap(10, 10, 32);
// Reveal all tiles for simplicity
map.forEachTile((t) => t.setFogged(false));

const state = new GameState(1000);
state.load(map);
const clock = new GameClock(1000, () => {
  state.tick();
  state.save();
  draw();
});

const animator = new Animator(draw);

const units: Unit[] = [];

function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player');
  if (unit) {
    units.push(unit);
  }
}

state.addResource(Resource.GOLD, 200);
spawn('soldier', { q: 2, r: 2 });

let selected: AxialCoord | null = null;

function draw(): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || !assets) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  map.draw(ctx, assets.images, selected ?? undefined);
  drawUnits(ctx);
}

function drawUnits(ctx: CanvasRenderingContext2D): void {
  const sprite = assets.images['unit-soldier'];
  const hexWidth = map.hexSize * Math.sqrt(3);
  const hexHeight = map.hexSize * 2;
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, map.hexSize);
    ctx.drawImage(sprite, x, y, hexWidth, hexHeight);
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - map.hexSize;
  const y = e.clientY - rect.top - map.hexSize;
  selected = pixelToAxial(x, y, map.hexSize);
  const unit = units[0];
  if (unit) {
    const path = unit.moveTowards(selected, map);
    if (path.length > 0) {
      animator.animate(unit, path);
    }
  }
  draw();
});

function log(msg: string): void {
  const div = document.createElement('div');
  div.textContent = msg;
  eventLog.appendChild(div);
}

const onResourceChanged = ({ resource, total, amount }) => {
  resourceBar.textContent = `Resources: ${total}`;
  const sign = amount > 0 ? '+' : '';
  log(`${resource}: ${sign}${amount}`);
};
eventBus.on('resourceChanged', onResourceChanged);

const onPolicyApplied = ({ policy }) => {
  log(`Policy applied: ${policy}`);
};
eventBus.on('policyApplied', onPolicyApplied);

window.addEventListener('beforeunload', () => {
  eventBus.off('resourceChanged', onResourceChanged);
  eventBus.off('policyApplied', onPolicyApplied);
});

buildFarmBtn.addEventListener('click', () => {
  if (!selected) return;
  if (state.placeBuilding(new Farm(), selected, map)) {
    log('Farm constructed');
    draw();
  }
});

buildBarracksBtn.addEventListener('click', () => {
  if (!selected) return;
  if (state.placeBuilding(new Barracks(), selected, map)) {
    log('Barracks constructed');
    draw();
  }
});

upgradeFarmBtn.addEventListener('click', () => {
  state.upgrade('farm', 20);
});

policyBtn.addEventListener('click', () => {
  state.applyPolicy('eco', 15);
});

async function start(): Promise<void> {
  const { assets: loaded, failures } = await loadAssets(assetPaths);
  assets = loaded;
  if (failures.length) {
    console.warn('Failed to load assets', failures);
  }
  resourceBar.textContent = `Resources: ${state.getResource(Resource.GOLD)}`;
  draw();
  let last = performance.now();
  function gameLoop(now: number) {
    const delta = now - last;
    last = now;
    clock.tick(delta);
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

start();
