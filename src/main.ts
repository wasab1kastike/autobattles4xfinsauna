import './style.css';
import { GameState, Resource } from './core/GameState.ts';
import { HexMap } from './hex/HexMap.ts';
import { pixelToAxial, axialToPixel, AxialCoord } from './hex/HexUtils.ts';
import { Unit } from './units/Unit.ts';
import { eventBus } from './events';
import { loadAssets, AssetPaths, LoadedAssets } from './loader.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const resourceBar = document.getElementById('resource-bar')!;
const eventLog = document.getElementById('event-log')!;
const buildFarmBtn = document.getElementById('build-farm') as HTMLButtonElement;
const upgradeFarmBtn = document.getElementById('upgrade-farm') as HTMLButtonElement;
const policyBtn = document.getElementById('policy-eco') as HTMLButtonElement;

const assetPaths: AssetPaths = {
  images: {
    placeholder:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQImWNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII='
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
state.load();

const units: Unit[] = [
  new Unit('u1', { q: 2, r: 2 }, 'player', {
    health: 10,
    attackDamage: 2,
    attackRange: 1,
    movementRange: 1
  })
];

let selected: AxialCoord | null = null;

function draw(): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  map.draw(ctx, selected ?? undefined);
  drawUnits(ctx);
}

function drawUnits(ctx: CanvasRenderingContext2D): void {
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, map.hexSize);
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(x + map.hexSize, y + map.hexSize, map.hexSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - map.hexSize;
  const y = e.clientY - rect.top - map.hexSize;
  selected = pixelToAxial(x, y, map.hexSize);
  draw();
});

function log(msg: string): void {
  const div = document.createElement('div');
  div.textContent = msg;
  eventLog.appendChild(div);
}

eventBus.on('resourceChanged', ({ resource, total, amount }) => {
  resourceBar.textContent = `Resources: ${total}`;
  const sign = amount > 0 ? '+' : '';
  log(`${resource}: ${sign}${amount}`);
});

eventBus.on('policyApplied', ({ policy }) => {
  log(`Policy applied: ${policy}`);
});

buildFarmBtn.addEventListener('click', () => {
  state.construct('farm', 10);
});

upgradeFarmBtn.addEventListener('click', () => {
  state.upgrade('farm', 20);
});

policyBtn.addEventListener('click', () => {
  state.applyPolicy('eco', 15);
});

async function start(): Promise<void> {
  assets = await loadAssets(assetPaths);
  resourceBar.textContent = `Resources: ${state.getResource(Resource.GOLD)}`;
  draw();
  setInterval(() => {
    state.tick();
    state.save();
  }, 1000);
}

start();
