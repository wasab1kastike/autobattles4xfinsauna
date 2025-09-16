import { describe, it, expect } from 'vitest';
import { makeSaunoja } from './saunoja.ts';
import { applyDamage } from './combat.ts';

describe('makeSaunoja', () => {
  it('applies defaults and clamps mutable values', () => {
    const coord = { q: 2, r: -1 };
    const saunoja = makeSaunoja({
      id: 's1',
      name: 'Custom',
      coord,
      maxHp: 20,
      hp: 28,
      steam: 1.7,
      selected: true
    });
    coord.q = 9;
    expect(saunoja.name).toBe('Custom');
    expect(saunoja.maxHp).toBe(20);
    expect(saunoja.hp).toBe(20);
    expect(saunoja.steam).toBe(1);
    expect(saunoja.coord).toEqual({ q: 2, r: -1 });
    expect(saunoja.selected).toBe(true);
  });

  it('falls back to safe defaults for invalid data', () => {
    const saunoja = makeSaunoja({
      id: 's2',
      maxHp: 0,
      hp: -5,
      steam: -1
    });
    expect(saunoja.maxHp).toBe(1);
    expect(saunoja.hp).toBe(0);
    expect(saunoja.steam).toBe(0);
    expect(saunoja.name).toBe('Saunoja');
  });
});

describe('applyDamage', () => {
  it('reduces hit points and returns true when depleted', () => {
    const saunoja = makeSaunoja({ id: 's3', maxHp: 10 });
    expect(applyDamage(saunoja, 4)).toBe(false);
    expect(saunoja.hp).toBe(6);
    expect(applyDamage(saunoja, 10)).toBe(true);
    expect(saunoja.hp).toBe(0);
  });

  it('ignores non-positive or invalid damage values', () => {
    const saunoja = makeSaunoja({ id: 's4', maxHp: 5, hp: 3 });
    expect(applyDamage(saunoja, 0)).toBe(false);
    expect(saunoja.hp).toBe(3);
    expect(applyDamage(saunoja, Number.NaN)).toBe(false);
    expect(saunoja.hp).toBe(3);
  });
});
