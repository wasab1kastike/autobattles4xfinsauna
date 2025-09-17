import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('updates sauna beer HUD without logging resource changes', async () => {
    const { eventBus } = await initGame();

    eventBus.emit('resourceChanged', { resource: 'sauna-beer', total: 42, amount: 5 });
    await flushLogs();

    const resourceValue = document.querySelector<HTMLSpanElement>('.resource-value');
    expect(resourceValue?.textContent).toBe('42');

    const eventLog = document.getElementById('event-log')!;
    expect(eventLog.childElementCount).toBe(0);
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
});
