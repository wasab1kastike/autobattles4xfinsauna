import './style.css';
import { GameState, Resource, PASSIVE_GENERATION } from './core/GameState.ts';
import { GameClock } from './core/GameClock.ts';
import { HexMap } from './hexmap.ts';
import { pixelToAxial, axialToPixel } from './hex/HexUtils.ts';
import type { AxialCoord } from './hex/HexUtils.ts';
import { Unit, spawnUnit, Soldier, Archer, Raider } from './unit.ts';
import type { UnitType } from './unit.ts';
import Animator from './render/Animator.ts';
import { eventBus } from './events';
import { loadAssets } from './loader.ts';
import type { AssetPaths, LoadedAssets } from './loader.ts';
import { Farm, Barracks } from './buildings/index.ts';
import { createSauna } from './sim/sauna.ts';
import { setupSaunaUI } from './ui/sauna.tsx';
import { raiderSVG } from './ui/sprites.ts';
import { resetAutoFrame } from './camera/autoFrame.ts';
import { setupTopbar } from './ui/topbar.ts';
import { sfx } from './sfx.ts';
import { serialize, deserialize, type SaveData } from './save.ts';
import type { Building } from './buildings/Building.ts';
import { activateSisuPulse, isSisuActive } from './sim/sisu.ts';
import { setupRightPanel } from './ui/rightPanel.tsx';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const resourceBar = document.getElementById('resource-bar')!;
const eventLog = document.getElementById('event-log');
const buildFarmBtn = document.getElementById('build-farm') as HTMLButtonElement | null;
const buildBarracksBtn = document.getElementById('build-barracks') as HTMLButtonElement | null;
const upgradeFarmBtn = document.getElementById('upgrade-farm') as HTMLButtonElement | null;
const policyBtn = document.getElementById('policy-eco') as HTMLButtonElement | null;

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
const units: Unit[] = [];
const sauna = createSauna({
  q: Math.floor(map.width / 2),
  r: Math.floor(map.height / 2)
});

const BUILDING_FACTORIES: Record<string, () => Building> = {
  farm: () => new Farm(),
  barracks: () => new Barracks()
};

function createBuilding(type: string): Building | undefined {
  return BUILDING_FACTORIES[type]?.();
}

function saveGame(): void {
  const data = serialize(state, map, units, sauna);
  localStorage.setItem('save', JSON.stringify(data));
}

function applySave(data: SaveData): void {
  state.resources = { ...data.resources };
  state.setPolicies(data.policies ?? []);
  state.time = data.time ?? 0;
  (state as any).passiveGeneration = { ...PASSIVE_GENERATION };
  for (const policy of state.getPolicies()) {
    eventBus.emit('policyApplied', { policy, state });
  }

  map.forEachTile((t) => {
    t.setFogged(true);
    t.placeBuilding(null);
  });
  for (const key of data.revealed) {
    const [q, r] = key.split(',').map(Number);
    map.getTile(q, r)?.setFogged(false);
  }

  const placements = (state as any).buildingPlacements as Map<string, Building>;
  placements.clear();
  (state as any).buildings = {};
  for (const [key, type] of Object.entries(data.buildings)) {
    const b = createBuilding(type);
    if (!b) continue;
    placements.set(key, b);
    (state as any).buildings[type] = ((state as any).buildings[type] ?? 0) + 1;
    const [q, r] = key.split(',').map(Number);
    map.getTile(q, r)?.placeBuilding(type as any);
    if (b instanceof Farm) {
      state.modifyPassiveGeneration(Resource.GOLD, b.foodPerTick);
    }
  }

  units.length = 0;
  for (const u of data.units) {
    let unit: Unit | null = null;
    switch (u.type) {
      case 'Soldier':
        unit = new Soldier(u.id, u.coord, u.faction);
        break;
      case 'Archer':
        unit = new Archer(u.id, u.coord, u.faction);
        break;
      case 'Raider':
        unit = new Raider(u.id, u.coord, u.faction);
        break;
    }
    if (unit) {
      unit.stats = { ...unit.stats, ...u.stats };
      units.push(unit);
    }
  }

  Object.assign(sauna, data.sauna);
  resourceBar.textContent = `Resources: ${state.getResource(Resource.GOLD)}`;
  updateSaunaUI();
  updateTopbar(0);
  draw();
  clock.setTime(state.time);
}

function loadGameFromStorage(): boolean {
  const raw = localStorage.getItem('save');
  if (!raw) return false;
  try {
    const data = deserialize(JSON.parse(raw));
    applySave(data);
    return true;
  } catch {
    return false;
  }
}

const VISION_RADIUS = 2;
const clock = new GameClock(
  1000,
  (delta) => {
    state.tick();
    for (const unit of units) {
      if (!unit.isDead() && unit.faction === 'player') {
        map.revealAround(unit.coord, VISION_RADIUS);
      }
    }
    draw();
  },
  () => saveGame()
);

const animator = new Animator(draw);
const updateSaunaUI = setupSaunaUI(sauna);
const updateTopbar = setupTopbar(state);

let log: (msg: string) => void;
if (document.getElementById('ui-overlay')) {
  ({ log } = setupRightPanel(state));
} else if (eventLog) {
  const MAX_LOG_MESSAGES = 100;
  log = (msg: string): void => {
    const div = document.createElement('div');
    div.textContent = msg;
    eventLog.appendChild(div);
    while (eventLog.childElementCount > MAX_LOG_MESSAGES) {
      eventLog.removeChild(eventLog.firstChild!);
    }
  };
} else {
  log = () => {};
}

eventBus.on('sisuPulse', () => activateSisuPulse(state, units));

function spawn(type: UnitType, coord: AxialCoord): void {
  const id = `u${units.length + 1}`;
  const unit = spawnUnit(state, type, id, coord, 'player');
  if (unit) {
    units.push(unit);
  }
}

const loaded = loadGameFromStorage();
if (!loaded) {
  map.revealAround(sauna.pos, 3);
  state.addResource(Resource.GOLD, 200);
  spawn('soldier', { q: 2, r: 2 });
}

eventBus.on('saveGame', saveGame);
eventBus.on('loadGame', () => {
  loadGameFromStorage();
});

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

if (buildFarmBtn) {
  buildFarmBtn.addEventListener('click', () => {
    if (!selected) return;
    if (state.placeBuilding(new Farm(), selected, map)) {
      log('Farm constructed');
      draw();
    }
  });
}

if (buildBarracksBtn) {
  buildBarracksBtn.addEventListener('click', () => {
    if (!selected) return;
    if (state.placeBuilding(new Barracks(), selected, map)) {
      log('Barracks constructed');
      draw();
    }
  });
}

if (upgradeFarmBtn) {
  upgradeFarmBtn.addEventListener('click', () => {
    state.upgrade('farm', 20);
  });
}

if (policyBtn) {
  policyBtn.addEventListener('click', () => {
    state.applyPolicy('eco', 15);
  });
}

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
