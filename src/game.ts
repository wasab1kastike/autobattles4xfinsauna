import './style.css';
import { GameState, Resource } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { pixelToAxial, axialToPixel } from './hex/HexUtils.ts';
import type { AxialCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit } from './unit.ts';
import type { UnitType } from './unit.ts';
import Animator from './render/Animator.ts';
import { eventBus } from './events';
import { loadAssets } from './loader.ts';
import type { AssetPaths, LoadedAssets } from './loader.ts';
import { createSauna } from './sim/sauna.ts';
import { setupSaunaUI } from './ui/sauna.tsx';
import { raiderSVG } from './ui/sprites.ts';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { sfx } from './sfx.ts';
import { activateSisuPulse, isSisuActive } from './sim/sisu.ts';
import { setupRightPanel } from './ui/rightPanel.tsx';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const resourceBar = document.getElementById('resource-bar')!;

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
    click:
      'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAIlYAAESsAAACABAAZGF0YQAAAAA='
  }
};
let assets: LoadedAssets;

const map = new HexMap(10, 10, 32);
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

const animator = new Animator(draw);

const units: Unit[] = [];
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
});
map.revealAround(sauna.pos, 3);
const updateSaunaUI = setupSaunaUI(sauna);
const updateTopbar = setupTopbar(state);
const { log, addEvent } = setupRightPanel(state);
eventBus.on('sisuPulse', () => activateSisuPulse(state, units));

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
  const hexWidth = map.hexSize * Math.sqrt(3);
  const hexHeight = map.hexSize * 2;
  const size = Math.min(hexWidth, hexHeight);
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, map.hexSize);
    const img = document.createElementNS(
      'http://www.w3.org/2000/svg',
      'image'
    ) as unknown as SVGImageElement;
    img.setAttribute(
      'href',
      `data:image/svg+xml;utf8,${encodeURIComponent(raiderSVG(size))}`
    );
    const maxHealth = (unit as any).maxHealth ?? unit.stats.health;
    if (unit.stats.health / maxHealth < 0.5) {
      ctx.filter = 'saturate(0)';
    }
    ctx.drawImage(img, x, y, hexWidth, hexHeight);
    ctx.filter = 'none';
    if (isSisuActive() && unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, hexWidth, hexHeight);
    }
  }
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - map.hexSize;
  const y = e.clientY - rect.top - map.hexSize;
  selected = pixelToAxial(x, y, map.hexSize);
  const unit = units[0];
  if (unit) {
    const occupied = new Set<string>();
    for (const u of units) {
      if (u !== unit && !u.isDead()) {
        occupied.add(`${u.coord.q},${u.coord.r}`);
      }
    }
    const path = unit.moveTowards(selected, map, occupied);
    if (path.length > 0) {
      animator.animate(unit, path);
    }
  }
  draw();
});

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

const onUnitDied = ({ unitId }: { unitId: string }) => {
  const idx = units.findIndex((u) => u.id === unitId);
  if (idx !== -1) {
    units.splice(idx, 1);
    draw();
  }
};
eventBus.on('unitDied', onUnitDied);

window.addEventListener('beforeunload', () => {
  eventBus.off('resourceChanged', onResourceChanged);
  eventBus.off('policyApplied', onPolicyApplied);
  eventBus.off('unitDied', onUnitDied);
});

async function start(): Promise<void> {
  const { assets: loaded, failures } = await loadAssets(assetPaths);
  assets = loaded;
  Object.entries(assets.sounds).forEach(([name, audio]) => sfx.register(name, audio));
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

if (!import.meta.vitest) {
  start();
}

export { log };
