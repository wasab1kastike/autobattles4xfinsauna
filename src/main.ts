import './style.css';
import { GameState } from './core/GameState.ts';
import { HexMap } from './hex/HexMap.ts';
import { pixelToAxial, axialToPixel, AxialCoord } from './hex/HexUtils.ts';
import { Unit } from './units/Unit.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const resourceBar = document.getElementById('resource-bar')!;
const buildFarmBtn = document.getElementById('build-farm') as HTMLButtonElement;
const upgradeFarmBtn = document.getElementById('upgrade-farm') as HTMLButtonElement;
const policyBtn = document.getElementById('policy-eco') as HTMLButtonElement;

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

function updateResources(): void {
  resourceBar.textContent = `Resources: ${state.resources}`;
}

setInterval(() => {
  state.tick();
  updateResources();
  state.save();
}, 1000);

buildFarmBtn.addEventListener('click', () => {
  if (state.construct('farm', 10)) {
    updateResources();
  }
});

upgradeFarmBtn.addEventListener('click', () => {
  if (state.upgrade('farm', 20)) {
    updateResources();
  }
});

policyBtn.addEventListener('click', () => {
  if (state.applyPolicy('eco', 15)) {
    updateResources();
  }
});

updateResources();
draw();
