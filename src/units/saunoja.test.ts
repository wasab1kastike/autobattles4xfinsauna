import { describe, it, expect, vi } from 'vitest';
import { makeSaunoja, SAUNOJA_DEFAULT_UPKEEP, SAUNOJA_UPKEEP_MAX } from './saunoja.ts';
import { applyDamage } from './combat.ts';

const SAUNOJA_APPEARANCES = new Set(['saunoja', 'saunoja-guardian', 'saunoja-seer']);

describe('makeSaunoja', () => {
  it('applies defaults and clamps mutable values', () => {
    const coord = { q: 2, r: -1 };
    const traits = ['Stoic', 'Swift'];
    const saunoja = makeSaunoja({
      id: 's1',
      name: 'Custom',
      coord,
      maxHp: 20,
      hp: 28,
      steam: 1.7,
      traits,
      upkeep: 4.5,
      xp: 27,
      lastHitAt: 1234,
      selected: true
    });
    coord.q = 9;
    traits.push('Mutable');
    expect(saunoja.name).toBe('Custom');
    expect(saunoja.maxHp).toBe(20);
    expect(saunoja.hp).toBe(20);
    expect(saunoja.shield).toBe(0);
    expect(saunoja.steam).toBe(1);
    expect(saunoja.coord).toEqual({ q: 2, r: -1 });
    expect(saunoja.lastHitAt).toBe(1234);
    expect(saunoja.selected).toBe(true);
    expect(saunoja.behavior).toBe('defend');
    expect(saunoja.traits).toEqual(['Stoic', 'Swift']);
    expect(saunoja.upkeep).toBe(SAUNOJA_UPKEEP_MAX);
    expect(saunoja.xp).toBe(27);
    expect(saunoja.baseStats.health).toBe(20);
    expect(saunoja.effectiveStats.health).toBe(20);
    expect(saunoja.equipment.weapon).toBeNull();
    expect(SAUNOJA_APPEARANCES.has(saunoja.appearanceId)).toBe(true);
    expect(saunoja.damageTakenMultiplier).toBeUndefined();
    expect(saunoja.tauntActive).toBe(false);
  });

  it('falls back to safe defaults for invalid data', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValue(0);
    const rawTraits = ['Brash', '  ', 42 as unknown as string, '  Focused  '];
    const saunoja = makeSaunoja({
      id: 's2',
      maxHp: 0,
      hp: -5,
      steam: -1,
      traits: rawTraits,
      upkeep: Number.NaN,
      xp: -5,
      lastHitAt: Number.NaN
    });
    expect(saunoja.maxHp).toBe(1);
    expect(saunoja.hp).toBe(0);
    expect(saunoja.shield).toBe(0);
    expect(saunoja.steam).toBe(0);
    expect(saunoja.name).toBe('Aino "Emberguard" Aalto');
    expect(saunoja.lastHitAt).toBe(0);
    expect(saunoja.traits).toEqual(['Brash', 'Focused']);
    expect(saunoja.upkeep).toBe(SAUNOJA_DEFAULT_UPKEEP);
    expect(saunoja.xp).toBe(0);
    expect(saunoja.behavior).toBe('defend');
    expect(saunoja.baseStats.health).toBe(1);
    expect(saunoja.equipment.weapon).toBeNull();
    expect(saunoja.appearanceId).toBe('saunoja');
    expect(saunoja.damageTakenMultiplier).toBeUndefined();
    expect(saunoja.tauntActive).toBe(false);
    randomSpy.mockRestore();
  });

  it('clamps upkeep and xp to supported bounds', () => {
    const saunoja = makeSaunoja({
      id: 's3',
      upkeep: 99,
      xp: Number.NaN
    });

    expect(saunoja.upkeep).toBe(SAUNOJA_UPKEEP_MAX);
    expect(saunoja.xp).toBe(0);
    expect(SAUNOJA_APPEARANCES.has(saunoja.appearanceId)).toBe(true);
    expect(saunoja.tauntActive).toBe(false);
  });

  it('sanitises mitigation and taunt state inputs', () => {
    const tank = makeSaunoja({
      id: 'tank',
      damageTakenMultiplier: 0.45,
      tauntActive: true
    });
    expect(tank.damageTakenMultiplier).toBeCloseTo(0.45, 5);
    expect(tank.tauntActive).toBe(true);

    const invalid = makeSaunoja({
      id: 'invalid',
      damageTakenMultiplier: 'nope' as unknown as number,
      tauntActive: 'maybe' as unknown as boolean
    });
    expect(invalid.damageTakenMultiplier).toBeUndefined();
    expect(invalid.tauntActive).toBe(false);
  });

  it('generates a flavorful name when none is provided', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.2)
      .mockReturnValueOnce(0.8);
    const saunoja = makeSaunoja({ id: 's5', name: '   ' });
    expect(saunoja.name).toBe('Noora "Steamcaller" Tuomi');
    expect(SAUNOJA_APPEARANCES.has(saunoja.appearanceId)).toBe(true);
    randomSpy.mockRestore();
  });

  it('sanitises loadout items and active modifiers', () => {
    const loadout = [
      {
        id: ' emberglass-arrow ',
        name: '  Emberglass Arrow ',
        description: 'Ignites targets on hit',
        icon: '/assets/items/emberglass.svg',
        rarity: 'rare',
        quantity: 2.6
      },
      {
        id: '',
        name: 'Missing id'
      },
      42 as unknown as { id: string; name: string }
    ];

    const modifiers = [
      {
        id: 'barkskin-ritual',
        name: 'Barkskin Ritual',
        description: 'Gain +3 defense for a short time',
        duration: 19.9,
        remaining: 7.3,
        stacks: 0,
        appliedAt: -50
      },
      {
        id: 'eternal-steam',
        name: 'Eternal Steam',
        duration: Infinity,
        remaining: Infinity,
        source: 'Sauna Core'
      },
      {
        id: '',
        name: 'Unnamed'
      }
    ];

    const saunoja = makeSaunoja({ id: 'loadout-test', items: loadout, modifiers });

    expect(saunoja.items).toEqual([
      {
        id: 'emberglass-arrow',
        name: 'Emberglass Arrow',
        description: 'Ignites targets on hit',
        icon: '/assets/items/emberglass.svg',
        rarity: 'rare',
        quantity: 1
      }
    ]);
    expect(saunoja.equipment.weapon?.id).toBe('emberglass-arrow');
    expect(saunoja.modifiers).toEqual([
      {
        id: 'barkskin-ritual',
        name: 'Barkskin Ritual',
        description: 'Gain +3 defense for a short time',
        duration: 19.9,
        remaining: 7.3,
        stacks: 1,
        appliedAt: 0
      },
      {
        id: 'eternal-steam',
        name: 'Eternal Steam',
        description: undefined,
        duration: Infinity,
        remaining: Infinity,
        source: 'Sauna Core'
      }
    ]);
  });
});

describe('applyDamage', () => {
  it('reduces hit points and returns true when depleted', () => {
    const saunoja = makeSaunoja({ id: 's3', maxHp: 10 });
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValueOnce(100).mockReturnValueOnce(200);

    expect(applyDamage(saunoja, 4)).toBe(false);
    expect(saunoja.hp).toBe(6);
    expect(saunoja.lastHitAt).toBe(100);

    expect(applyDamage(saunoja, 10)).toBe(true);
    expect(saunoja.hp).toBe(0);
    expect(saunoja.lastHitAt).toBe(200);

    nowSpy.mockRestore();
  });

  it('ignores non-positive or invalid damage values', () => {
    const saunoja = makeSaunoja({ id: 's4', maxHp: 5, hp: 3 });
    saunoja.lastHitAt = 250;
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(999);

    expect(applyDamage(saunoja, 0)).toBe(false);
    expect(saunoja.hp).toBe(3);
    expect(applyDamage(saunoja, Number.NaN)).toBe(false);
    expect(saunoja.hp).toBe(3);
    expect(saunoja.lastHitAt).toBe(250);
    expect(nowSpy).not.toHaveBeenCalled();

    nowSpy.mockRestore();
  });

  it('applies damageTakenMultiplier when present', () => {
    const saunoja = makeSaunoja({ id: 'mitigator', maxHp: 20, damageTakenMultiplier: 0.5 });
    saunoja.hp = 20;
    const nowSpy = vi.spyOn(performance, 'now');
    nowSpy.mockReturnValue(321);

    expect(applyDamage(saunoja, 10)).toBe(false);
    expect(saunoja.hp).toBe(15);
    expect(saunoja.lastHitAt).toBe(321);

    nowSpy.mockRestore();
  });
});
