import { describe, expect, it, vi } from 'vitest';
import { createProgressionManager, XP_ELITE_KILL, XP_BOSS_KILL, XP_STANDARD_KILL } from '../../src/game/progression.ts';
import type { Saunoja } from '../../src/units/saunoja.ts';
import type { Unit } from '../../src/unit/index.ts';
import type { LogEventPayload } from '../../src/ui/logging.ts';

describe('game/progression module', () => {
  const createSaunoja = (): Saunoja => ({
    id: 's1',
    name: 'Saunoja',
    appearanceId: 'default' as any,
    coord: { q: 0, r: 0 },
    maxHp: 10,
    hp: 10,
    defense: 0,
    shield: 0,
    steam: 0,
    behavior: 'defend',
    traits: [],
    upkeep: 1,
    xp: 0,
    lastHitAt: 0,
    selected: false,
    items: [],
    baseStats: { health: 10, attackDamage: 5, attackRange: 1, movementRange: 1 },
    effectiveStats: { health: 10, attackDamage: 5, attackRange: 1, movementRange: 1 },
    equipment: {} as any,
    modifiers: [],
    combatKeywords: null,
    combatHooks: null
  });

  const createUnit = (overrides: Partial<Unit> = {}): Unit => ({
    id: 'unit-1',
    type: 'raider',
    coord: { q: 0, r: 0 },
    stats: { health: 16, attackDamage: 4, attackRange: 1, movementRange: 1 } as any,
    faction: 'enemy',
    isDead: () => false,
    getMaxHealth: () => 16,
    getShield: () => 0,
    setBehavior: () => {},
    setExperience: vi.fn(),
    ...overrides
  } as unknown as Unit);

  it('grants experience to a Saunoja and logs progression', () => {
    const attendant = createSaunoja();
    const setExperienceSpy = vi.fn();
    const attachedUnit = createUnit({ faction: 'player', setExperience: setExperienceSpy as unknown as Unit['setExperience'] });
    const logs: LogEventPayload[] = [];
    const baseline = { base: { ...attendant.baseStats }, upkeep: attendant.upkeep };

    const progression = createProgressionManager({
      getRoster: () => [attendant],
      getAttachedUnitFor: () => attachedUnit,
      findSaunojaByUnit: () => attendant,
      withSaunojaBaseline: (_unit, mutate) => mutate(baseline),
      log: (event) => logs.push(event)
    });

    const result = progression.grantSaunojaExperience(attendant, 15, {
      source: 'kill',
      label: 'raider'
    });

    expect(result).not.toBeNull();
    expect(result?.xpAwarded).toBe(15);
    expect(attendant.xp).toBe(15);
    expect(setExperienceSpy).toHaveBeenCalledWith(15);
    expect(logs.map((log) => log.type)).toContain('combat');
  });

  it('grants roster-wide experience', () => {
    const attendants = [createSaunoja(), createSaunoja()];
    const progression = createProgressionManager({
      getRoster: () => attendants,
      getAttachedUnitFor: () => null,
      findSaunojaByUnit: () => attendants[0],
      withSaunojaBaseline: (_unit, mutate) => mutate({ base: attendants[0].baseStats, upkeep: attendants[0].upkeep }),
      log: () => {}
    });

    const updated = progression.grantExperienceToRoster(5, { source: 'objective' });
    expect(updated).toBe(true);
    expect(attendants.every((unit) => unit.xp === 5)).toBe(true);
  });

  it('calculates kill experience for standard, elite, and boss units', () => {
    const progression = createProgressionManager({
      getRoster: () => [],
      getAttachedUnitFor: () => null,
      findSaunojaByUnit: () => null,
      withSaunojaBaseline: (_unit, mutate) => mutate({ base: { health: 0, attackDamage: 0, attackRange: 0, movementRange: 0 }, upkeep: 0 }),
      log: () => {}
    });

    const standard = progression.calculateKillExperience(createUnit());
    expect(standard.xp).toBe(XP_STANDARD_KILL);

    const eliteUnit = createUnit({
      stats: { health: 40, attackDamage: 12, attackRange: 2, movementRange: 2 } as any
    });
    const elite = progression.calculateKillExperience(eliteUnit);
    expect(elite.xp).toBe(XP_ELITE_KILL);
    expect(elite.elite).toBe(true);

    const bossUnit = createUnit({ type: 'boss-warrior' });
    const boss = progression.calculateKillExperience(bossUnit);
    expect(boss.xp).toBe(XP_BOSS_KILL);
    expect(boss.boss).toBe(true);
  });
});
