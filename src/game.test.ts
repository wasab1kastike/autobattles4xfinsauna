import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../assets/sprites/farm.svg', () => ({ default: 'farm.svg' }));
vi.mock('../assets/sprites/barracks.svg', () => ({ default: 'barracks.svg' }));
vi.mock('../assets/sprites/city.svg', () => ({ default: 'city.svg' }));
vi.mock('../assets/sprites/mine.svg', () => ({ default: 'mine.svg' }));
vi.mock('../assets/sprites/soldier.svg', () => ({ default: 'soldier.svg' }));
vi.mock('../assets/sprites/archer.svg', () => ({ default: 'archer.svg' }));
vi.mock('../assets/sprites/avanto-marauder.svg', () => ({ default: 'marauder.svg' }));

const flushLogs = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function initGame() {
  const { eventBus } = await import('./events');
  const game = await import('./game.ts');
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const resourceBar = document.getElementById('resource-bar') as HTMLElement;
  game.setupGame(canvas, resourceBar);
  return { eventBus, ...game };
}

beforeEach(() => {
  vi.resetModules();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null)
  });
  document.body.innerHTML = `
    <canvas id="game-canvas"></canvas>
    <div id="resource-bar"></div>
    <div id="ui-overlay"></div>
  `;
});

describe('game logging', () => {
  it('caps event log at 100 messages', async () => {
    const { log } = await initGame();

    for (let i = 1; i <= 150; i++) {
      log(`msg ${i}`);
    }

    await flushLogs();

    const eventLog = document.getElementById('event-log')!;
    expect(eventLog.childElementCount).toBe(100);
    expect(eventLog.firstChild?.textContent).toBe('msg 51');
  });

  it('tracks the active Saunoja roster as units rally and fall', async () => {
    const { eventBus } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const rosterValue = () =>
      document.querySelector<HTMLSpanElement>('.sauna-roster__value')?.textContent ?? '';

    expect(rosterValue()).toBe('1');

    const ally = new Unit('steam-ally', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();
    expect(rosterValue()).toBe('2');

    const foe = new Unit('steam-foe', { q: 1, r: 0 }, 'enemy', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: foe });
    await flushLogs();
    expect(rosterValue()).toBe('2');

    eventBus.emit('unitDied', {
      unitId: ally.id,
      unitFaction: 'player',
      attackerFaction: 'enemy'
    });
    await flushLogs();
    expect(rosterValue()).toBe('1');
  });

  it('records spawn and casualty events with sauna flavor', async () => {
    const { eventBus } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const ally = new Unit('steam-ally', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();

    const eventLog = document.getElementById('event-log')!;
    const allySpawn = eventLog.lastElementChild?.textContent ?? '';
    expect(allySpawn).toContain('Our');
    expect(allySpawn).toContain('emerges from the steam');
    expect(allySpawn).toContain(ally.id);

    const foe = new Unit('steam-foe', { q: 1, r: 0 }, 'enemy', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: foe });
    await flushLogs();

    const foeSpawn = eventLog.lastElementChild?.textContent ?? '';
    expect(foeSpawn).toContain('A rival');
    expect(foeSpawn).toContain(foe.id);

    eventBus.emit('unitDied', {
      unitId: foe.id,
      unitFaction: 'enemy',
      attackerFaction: 'player'
    });
    await flushLogs();

    const casualtyMessage = eventLog.lastElementChild?.textContent ?? '';
    expect(casualtyMessage).toContain('a rival');
    expect(casualtyMessage).toContain(foe.id);
  });

  it('updates Saunoja coordinates after allied movement', async () => {
    const game = await initGame();
    const { eventBus, syncSaunojasFromUnits, getSaunojaRoster } = game;
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 12, attackDamage: 1, attackRange: 1, movementRange: 2 };

    const ally = new Unit('steam-ally', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();

    const beforeMove = getSaunojaRoster().find((unit) => unit.id === ally.id);
    expect(beforeMove?.coord).toEqual({ q: 0, r: 0 });

    const saveSpy = vi.spyOn(game, 'saveUnits');

    ally.coord = { q: 1, r: -1 };
    const moved = syncSaunojasFromUnits();
    if (moved) {
      game.saveUnits();
    }

    expect(moved).toBe(true);
    const afterMove = getSaunojaRoster().find((unit) => unit.id === ally.id);
    expect(afterMove?.coord).toEqual({ q: 1, r: -1 });
    expect(saveSpy).toHaveBeenCalledTimes(1);

    saveSpy.mockClear();
    const unchanged = syncSaunojasFromUnits();
    if (unchanged) {
      game.saveUnits();
    }
    expect(unchanged).toBe(false);
    expect(saveSpy).not.toHaveBeenCalled();
    saveSpy.mockRestore();
  });
});
