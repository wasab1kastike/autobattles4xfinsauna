import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SAUNOJA_UPKEEP_MAX, SAUNOJA_UPKEEP_MIN } from './units/saunoja.ts';
import { NEG, POS } from './data/traits.ts';

const flushLogs = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const renderGameShell = () => {
  document.body.innerHTML = `
    <div id="game-container">
      <canvas id="game-canvas"></canvas>
      <div id="ui-overlay">
        <div id="resource-bar"></div>
      </div>
    </div>
  `;
};

async function initGame() {
  const { eventBus } = await import('./events');
  const game = await import('./game.ts');
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  const resourceBar = document.getElementById('resource-bar') as HTMLElement;
  const overlay = document.getElementById('ui-overlay') as HTMLElement;
  game.setupGame(canvas, resourceBar, overlay);
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
    const { eventBus, __getActiveRosterCountForTest } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const rosterValue = () =>
      document
        .querySelector<HTMLSpanElement>('#resource-bar .sauna-roster__value')
        ?.textContent ?? '';

    expect(__getActiveRosterCountForTest()).toBe(2);
    await flushLogs();
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

  it('marks fallen Saunojas as downed in the roster', async () => {
    const { eventBus, loadUnits, __syncSaunojaRosterForTest } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    __syncSaunojaRosterForTest();
    await flushLogs();

    const baselineDowned = new Set(
      loadUnits()
        .filter((unit) => unit.hp <= 0)
        .map((unit) => unit.id)
    );

    const ally = new Unit('steam-roster-test', 'soldier', { q: 4, r: -3 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: ally });
    await flushLogs();

    __syncSaunojaRosterForTest();
    await flushLogs();

    const lethalDamage = ally.getMaxHealth() * 2;
    ally.takeDamage(lethalDamage);
    await flushLogs();

    const updatedRoster = loadUnits();
    const downedIds = updatedRoster.filter((unit) => unit.hp <= 0).map((unit) => unit.id);
    const newDowned = downedIds.filter((id) => !baselineDowned.has(id));
    expect(newDowned.length).toBeGreaterThan(0);

    const personaId = newDowned[0]!;
    const storedPersona = updatedRoster.find((unit) => unit.id === personaId);
    expect(storedPersona?.hp).toBe(0);

    const rosterButton = document.querySelector<HTMLButtonElement>(
      `.panel-roster__item[data-unit-id="${personaId}"]`
    );
    expect(rosterButton).toBeTruthy();
    expect(rosterButton?.dataset.status).toBe('downed');
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

    ally.setCoord(target);
    const targetKey = `${target.q},${target.r}`;
    expect(existing.has(targetKey)).toBe(false);

    __syncSaunojaRosterForTest();

    const afterMove = loadUnits();
    const updatedCoords = afterMove.map((unit) => `${unit.coord.q},${unit.coord.r}`);

    expect(updatedCoords).toContain(targetKey);
  });

  it('re-renders the roster after rebuilding the right panel UI', async () => {
    const { __rebuildRightPanelForTest } = await initGame();

    const rosterRows = () =>
      Array.from(document.querySelectorAll<HTMLLIElement>('.panel-roster__row'));

    await flushLogs();
    expect(rosterRows().length).toBeGreaterThan(0);

    __rebuildRightPanelForTest();

    await flushLogs();
    expect(rosterRows().length).toBeGreaterThan(0);
  });
});

describe('rendering', () => {
  it('omits player units from the render pass when Saunoja overlays are active', async () => {
    const assetsModule = await import('./game/assets.ts');
    assetsModule.resetAssetsForTest();
    const fakeImage = document.createElement('img') as HTMLImageElement;
    assetsModule.setAssets({
      images: {
        placeholder: fakeImage,
        'unit-soldier': fakeImage
      }
    } as any);

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    const fakeCtx = {
      canvas: document.createElement('canvas') as HTMLCanvasElement,
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      scale: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    const ctxStub = vi.fn(function (this: HTMLCanvasElement) {
      fakeCtx.canvas = this;
      return fakeCtx;
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: ctxStub
    });

    const { eventBus, draw } = await initGame();
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    canvas.width = 640;
    canvas.height = 360;

    const renderModule = await import('./render/renderer.ts');
    const renderSpy = vi.spyOn(renderModule, 'draw').mockImplementation(() => {});

    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };

    const playerUnit = new Unit('render-player', 'soldier', { q: 0, r: 0 }, 'player', {
      ...baseStats
    });
    const enemyUnit = new Unit('render-enemy', 'soldier', { q: 1, r: 0 }, 'enemy', {
      ...baseStats
    });

    eventBus.emit('unitSpawned', { unit: playerUnit });
    eventBus.emit('unitSpawned', { unit: enemyUnit });

    try {
      renderSpy.mockClear();
      draw();

      expect(renderSpy).toHaveBeenCalledTimes(1);
      const [, , , unitsArg, , drawOptions] = renderSpy.mock.calls[0]!;
      expect(unitsArg.some((unit) => unit.faction === 'player')).toBe(false);
      expect(unitsArg.some((unit) => unit.id === enemyUnit.id)).toBe(true);
      expect(drawOptions?.saunojas?.units?.length ?? 0).toBeGreaterThan(0);
    } finally {
      renderSpy.mockRestore();
      assetsModule.resetAssetsForTest();
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        configurable: true,
        value: originalGetContext
      });
    }
  });
});

describe('game lifecycle', () => {
  it('stops scheduling animation frames after cleanup', async () => {
    const assetsModule = await import('./game/assets.ts');
    assetsModule.resetAssetsForTest();
    const fakeImage = document.createElement('img') as HTMLImageElement;
    const fakeAudio = document.createElement('audio') as HTMLAudioElement;
    assetsModule.setAssets({
      images: {
        placeholder: fakeImage,
        'unit-soldier': fakeImage
      },
      sounds: { silent: fakeAudio }
    });

    const renderModule = await import('./units/renderSaunoja.ts');
    const preloadSpy = vi
      .spyOn(renderModule, 'preloadSaunojaIcon')
      .mockImplementation(async (onLoad?: (icon: HTMLImageElement) => void) => {
        const img = document.createElement('img') as HTMLImageElement;
        if (onLoad) {
          onLoad(img);
        }
        return img;
      });

    const { GameClock } = await import('./core/GameClock.ts');
    const tickSpy = vi.spyOn(GameClock.prototype, 'tick');

    const loopFrames: Array<{ id: number; cb: FrameRequestCallback }> = [];
    let nextFrameId = 1;
    const rafMock = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        const id = nextFrameId++;
        if (cb.name === 'gameLoop') {
          loopFrames.push({ id, cb });
        }
        return id;
      });

    const cancelledLoopIds = new Set<number>();
    const cancelMock = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id: number) => {
        cancelledLoopIds.add(id);
      });

    const { start, cleanup } = await initGame();
    let cleaned = false;

    try {
      await start();

      const firstLoop = loopFrames[0];
      expect(firstLoop).toBeDefined();

      firstLoop.cb(16);
      expect(tickSpy).toHaveBeenCalledTimes(1);

      const secondLoop = loopFrames[1];
      expect(secondLoop).toBeDefined();

      cleanup();
      cleaned = true;

      expect(cancelledLoopIds.has(secondLoop.id)).toBe(true);

      const scheduledCallsAfterCleanup = rafMock.mock.calls.length;
      secondLoop.cb(32);
      expect(rafMock.mock.calls.length).toBe(scheduledCallsAfterCleanup);
      expect(tickSpy).toHaveBeenCalledTimes(1);
      expect(loopFrames).toHaveLength(2);
    } finally {
      if (!cleaned) {
        cleanup();
      }
      rafMock.mockRestore();
      cancelMock.mockRestore();
      preloadSpy.mockRestore();
      tickSpy.mockRestore();
      assetsModule.resetAssetsForTest();
    }
  });
});

describe('saunoja persistence', () => {
  it('seeds the starter attendant with zero upkeep and keeps it persisted', async () => {
    const {
      __getAttachedUnitIdForTest,
      __getUnitUpkeepForTest,
      __syncSaunojaRosterForTest,
      loadUnits
    } = await initGame();

    __syncSaunojaRosterForTest();

    const roster = loadUnits();
    expect(roster).not.toHaveLength(0);

    const starter = roster.find((unit) => unit.id === 'saunoja-1');
    expect(starter).toBeDefined();
    expect(starter?.upkeep).toBe(0);

    const stored = window.localStorage?.getItem('autobattles:saunojas');
    expect(stored).toBeTypeOf('string');
    const parsed = JSON.parse(stored ?? '[]');
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0]?.upkeep).toBe(0);

    if (starter) {
      const attachedUnitId = __getAttachedUnitIdForTest(starter.id);
      expect(attachedUnitId).toBeTypeOf('string');
      if (attachedUnitId) {
        const { Unit } = await import('./units/Unit.ts');
        const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };
        const probe = new Unit(attachedUnitId, 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
        expect(__getUnitUpkeepForTest(probe)).toBe(0);
      }
    }
  });

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

  it('preserves stored Saunoja personas across reloads', async () => {
    const mockSpawnUnit = () =>
      vi.doMock('./unit/index.ts', async () => {
        const actual = await vi.importActual<typeof import('./unit/index.ts')>('./unit/index.ts');
        return {
          ...actual,
          spawnUnit: vi.fn(() => null)
        };
      });

    const storedPersona = {
      id: 'saunoja-legacy',
      name: 'Legacy Guardian',
      coord: { q: 2, r: -1 },
      maxHp: 18,
      hp: 18,
      steam: 0.2,
      traits: ['Steam Scholar', 'Sisu-Forged Veteran', 'Rust-Prone Gear'],
      upkeep: 7,
      xp: 42,
      selected: true
    };

    window.localStorage?.setItem('autobattles:saunojas', JSON.stringify([storedPersona]));

    mockSpawnUnit();

    try {
      const { eventBus, loadUnits } = await initGame();

      const firstRoster = loadUnits();
      const first = firstRoster.find((unit) => unit.id === storedPersona.id);
      expect(first).toBeDefined();
      expect(first?.traits).toEqual(storedPersona.traits);
      expect(first?.upkeep).toBe(storedPersona.upkeep);
      expect(first?.xp).toBe(storedPersona.xp);

      const { Unit } = await import('./units/Unit.ts');
      const baseStats = { health: 10, attackDamage: 1, attackRange: 1, movementRange: 1 };
      const ally = new Unit('legacy-ally', 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
      eventBus.emit('unitSpawned', { unit: ally });
      await flushLogs();

      const afterAttach = loadUnits();
      const attached = afterAttach.find((unit) => unit.id === storedPersona.id);
      expect(attached?.traits).toEqual(storedPersona.traits);
      expect(attached?.upkeep).toBe(storedPersona.upkeep);
      expect(attached?.xp).toBe(storedPersona.xp);

      vi.resetModules();
      renderGameShell();
      mockSpawnUnit();

      const { eventBus: rehydratedBus, loadUnits: loadUnitsAgain } = await initGame();
      const rehydratedRoster = loadUnitsAgain();
      const rehydrated = rehydratedRoster.find((unit) => unit.id === storedPersona.id);
      expect(rehydrated).toBeDefined();
      expect(rehydrated?.traits).toEqual(storedPersona.traits);
      expect(rehydrated?.upkeep).toBe(storedPersona.upkeep);
      expect(rehydrated?.xp).toBe(storedPersona.xp);

      const { Unit: UnitReloaded } = await import('./units/Unit.ts');
      const reloadAlly = new UnitReloaded('legacy-ally-2', 'soldier', { q: 1, r: 0 }, 'player', {
        ...baseStats
      });
      rehydratedBus.emit('unitSpawned', { unit: reloadAlly });
      await flushLogs();

      const finalRoster = loadUnitsAgain();
      const final = finalRoster.find((unit) => unit.id === storedPersona.id);
      expect(final?.traits).toEqual(storedPersona.traits);
      expect(final?.upkeep).toBe(storedPersona.upkeep);
      expect(final?.xp).toBe(storedPersona.xp);
    } finally {
      vi.doUnmock('./unit/index.ts');
    }
  });
});

describe('experience progression', () => {
  it('awards kill experience and applies level bonuses', async () => {
    const {
      eventBus,
      loadUnits,
      __grantExperienceForTest,
      __getAttachedUnitIdForTest
    } = await initGame();
    const { Unit } = await import('./units/Unit.ts');
    const baseStats = { health: 18, attackDamage: 4, attackRange: 1, movementRange: 1 };

    const attacker = new Unit('xp-ally', 'soldier', { q: 0, r: 0 }, 'player', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: attacker });

    const foe = new Unit('xp-foe', 'soldier', { q: 1, r: 0 }, 'enemy', { ...baseStats });
    eventBus.emit('unitSpawned', { unit: foe });

    eventBus.emit('unitDied', {
      unitId: foe.id,
      attackerId: attacker.id,
      attackerFaction: 'player',
      unitFaction: 'enemy'
    });

    await flushLogs();

    const rosterAfterKill = loadUnits();
    const killerPersona = rosterAfterKill.find(
      (unit) => __getAttachedUnitIdForTest(unit.id) === attacker.id
    );
    expect(killerPersona).toBeDefined();
    const baseHealthBefore = killerPersona?.baseStats.health ?? 0;
    const baseAttackBefore = killerPersona?.baseStats.attackDamage ?? 0;
    const baseDefenseBefore = killerPersona?.baseStats.defense ?? 0;
    expect(killerPersona?.xp).toBe(6);

    __grantExperienceForTest(attacker.id, 200);

    const rosterAfterLevel = loadUnits();
    const leveledPersona = rosterAfterLevel.find(
      (unit) => __getAttachedUnitIdForTest(unit.id) === attacker.id
    );
    expect(leveledPersona).toBeDefined();
    expect(leveledPersona?.xp).toBe(206);
    expect(leveledPersona?.baseStats.health).toBe(baseHealthBefore + 5);
    expect(leveledPersona?.baseStats.attackDamage).toBe(baseAttackBefore + 2);
    expect(leveledPersona?.baseStats.defense).toBe((baseDefenseBefore ?? 0) + 1);
    expect(leveledPersona?.maxHp).toBe(baseHealthBefore + 5);
  });

  it('applies roster-wide objective experience and persists it', async () => {
    const { loadUnits, __grantRosterExperienceForTest } = await initGame();

    const rosterBefore = loadUnits();
    const xpBefore = rosterBefore.map((unit) => unit.xp);

    __grantRosterExperienceForTest(200);

    const rosterAfter = loadUnits();
    rosterAfter.forEach((unit, index) => {
      expect(unit.xp).toBe((xpBefore[index] ?? 0) + 200);
    });

    vi.resetModules();
    renderGameShell();
    const { loadUnits: loadUnitsAgain } = await initGame();
    const rosterRehydrated = loadUnitsAgain();
    rosterRehydrated.forEach((unit, index) => {
      expect(unit.xp).toBe((xpBefore[index] ?? 0) + 200);
    });
  });
});
