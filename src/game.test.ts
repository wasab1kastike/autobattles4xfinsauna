import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAUNOJA_UPKEEP_MAX, SAUNOJA_UPKEEP_MIN } from './units/saunoja.ts';
import { NEG, POS } from './data/traits.ts';

const flushLogs = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const renderGameShell = () => {
  document.body.innerHTML = `
    <canvas id="game-canvas"></canvas>
    <div id="resource-bar"></div>
    <div id="ui-overlay"></div>
  `;
};

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
  window.localStorage?.clear?.();
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn(() => null)
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  });
  renderGameShell();
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

  it('persists event log history across reloads', async () => {
    const { log } = await initGame();

    const logMessages = () =>
      Array.from(document.getElementById('event-log')?.children ?? []).map(
        (child) => child.textContent ?? ''
      );

    await flushLogs();
    const baseline = logMessages();

    log('prelude 1');
    log('prelude 2');

    await flushLogs();

    const firstSessionLog = logMessages();
    expect(firstSessionLog.slice(-2)).toEqual(['prelude 1', 'prelude 2']);
    expect(firstSessionLog.length).toBe(baseline.length + 2);

    vi.resetModules();
    renderGameShell();

    const { log: logAgain } = await initGame();
    const rehydratedLog = logMessages();
    expect(rehydratedLog.slice(-2)).toEqual(['prelude 1', 'prelude 2']);

    logAgain('prelude 3');
    await flushLogs();

    const finalMessages = logMessages();
    const lastPrelude3 = finalMessages.lastIndexOf('prelude 3');
    expect(lastPrelude3).toBe(finalMessages.length - 1);
    expect(finalMessages.lastIndexOf('prelude 1')).toBeLessThan(lastPrelude3);
    expect(finalMessages.lastIndexOf('prelude 2')).toBeLessThan(lastPrelude3);
  });

  it('tracks the active Saunoja roster as units rally and fall', async () => {
    const { eventBus } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const rosterValue = () =>
      document.querySelector<HTMLSpanElement>('.sauna-roster__value')?.textContent ?? '';

    expect(rosterValue()).toBe('2');

    const ally = new Unit('steam-ally', 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();
    expect(rosterValue()).toBe('4');

    const foe = new Unit('steam-foe', 'soldier', { q: 1, r: 0 }, 'enemy', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: foe });
    await flushLogs();
    expect(rosterValue()).toBe('4');

    eventBus.emit('unitDied', {
      unitId: ally.id,
      unitFaction: 'player',
      attackerFaction: 'enemy'
    });
    await flushLogs();
    expect(rosterValue()).toBe('3');
  });

  it('records spawn and casualty events with sauna flavor', async () => {
    const { eventBus } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const namesModule = await import('./data/names.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const nameSpy = vi
      .spyOn(namesModule, 'generateSaunojaName')
      .mockReturnValue('Legacy "Frostward" Aalto');

    try {
      const ally = new Unit('steam-ally', 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
      eventBus.emit('unitSpawned', { unit: ally });
      await flushLogs();

      const eventLog = document.getElementById('event-log')!;
      const allySpawn = eventLog.lastElementChild?.textContent ?? '';
      expect(allySpawn).toContain('Our');
      expect(allySpawn).toContain('emerges from the steam');
      expect(allySpawn).toContain('Legacy "Frostward" Aalto');

      const foe = new Unit('steam-foe', 'soldier', { q: 1, r: 0 }, 'enemy', { ...baseStats });
      const beforeFoeSpawn = eventLog.childElementCount;
      eventBus.emit('unitSpawned', { unit: foe });
      await flushLogs();

      expect(eventLog.childElementCount).toBe(beforeFoeSpawn);
      expect(eventLog.lastElementChild?.textContent ?? '').toBe(allySpawn);

      eventBus.emit('unitDied', {
        unitId: foe.id,
        unitFaction: 'enemy',
        attackerFaction: 'player'
      });
      await flushLogs();

      const casualtyMessage = eventLog.lastElementChild?.textContent ?? '';
      expect(casualtyMessage).toContain('a rival');
      expect(casualtyMessage).toContain(foe.id);
    } finally {
      nameSpy.mockRestore();
    }
  });

  it('updates stored Saunoja coordinates when a friendly unit moves', async () => {
    const { eventBus, loadUnits, __syncSaunojaRosterForTest } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const ally = new Unit('steam-ally', 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();

    const beforeMove = loadUnits();
    const existing = new Set(beforeMove.map((unit) => `${unit.coord.q},${unit.coord.r}`));

    let target = { q: ally.coord.q + 5, r: ally.coord.r - 3 };
    while (existing.has(`${target.q},${target.r}`)) {
      target = { q: target.q + 1, r: target.r + 1 };
    }

    ally.coord = target;
    const targetKey = `${target.q},${target.r}`;
    expect(existing.has(targetKey)).toBe(false);

    __syncSaunojaRosterForTest();

    const afterMove = loadUnits();
    const updatedCoords = afterMove.map((unit) => `${unit.coord.q},${unit.coord.r}`);

    expect(updatedCoords).toContain(targetKey);
  });
});

describe('saunoja persistence', () => {
  it('normalizes and persists extended attendant fields', async () => {
    window.localStorage?.setItem(
      'autobattles:saunojas',
      JSON.stringify([
        {
          id: 'legacy-attendant',
          name: 'Legacy',
          coord: { q: 3, r: -2 },
          maxHp: 18,
          hp: 12,
          steam: 0.6,
          traits: ['Brave', '', 'Veteran'],
          upkeep: 99,
          xp: -4,
          selected: true
        }
      ])
    );

    const { loadUnits, saveUnits } = await initGame();

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const restoredTraits = restored[0].traits;
    const allowedTraits = new Set<string>([...POS, ...NEG]);
    expect(restoredTraits).toHaveLength(3);
    for (const trait of restoredTraits) {
      expect(typeof trait).toBe('string');
      expect(trait.length).toBeGreaterThan(0);
      expect(allowedTraits.has(trait)).toBe(true);
    }
    expect(new Set(restoredTraits).size).toBe(restoredTraits.length);
    expect(restored[0].upkeep).toBeGreaterThanOrEqual(SAUNOJA_UPKEEP_MIN);
    expect(restored[0].upkeep).toBeLessThanOrEqual(SAUNOJA_UPKEEP_MAX);
    expect(restored[0].xp).toBe(0);

    saveUnits();

    const serialized = window.localStorage?.getItem('autobattles:saunojas');
    expect(serialized).toBeTypeOf('string');
    const parsed = JSON.parse(serialized ?? '[]');
    expect(parsed).toHaveLength(1);
    const stored = parsed[0] ?? {};
    const storedTraits = Array.isArray(stored.traits) ? stored.traits : [];
    expect(storedTraits).toHaveLength(3);
    expect(new Set(storedTraits).size).toBe(storedTraits.length);
    for (const trait of storedTraits) {
      expect(typeof trait).toBe('string');
      expect(trait.length).toBeGreaterThan(0);
      expect(allowedTraits.has(trait)).toBe(true);
    }
    expect(stored.upkeep).toBeGreaterThanOrEqual(SAUNOJA_UPKEEP_MIN);
    expect(stored.upkeep).toBeLessThanOrEqual(SAUNOJA_UPKEEP_MAX);
    expect(stored.xp).toBe(0);
  });
});
