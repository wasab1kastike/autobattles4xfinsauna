import { describe, it, expect, vi } from 'vitest';
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
      lastHitAt: 1234,
      selected: true
    });
    coord.q = 9;
    expect(saunoja.name).toBe('Custom');
    expect(saunoja.maxHp).toBe(20);
    expect(saunoja.hp).toBe(20);
    expect(saunoja.steam).toBe(1);
    expect(saunoja.coord).toEqual({ q: 2, r: -1 });
    expect(saunoja.lastHitAt).toBe(1234);
    expect(saunoja.selected).toBe(true);
  });

  it('falls back to safe defaults for invalid data', () => {
    const saunoja = makeSaunoja({
      id: 's2',
      maxHp: 0,
      hp: -5,
      steam: -1,
      lastHitAt: Number.NaN
    });
    expect(saunoja.maxHp).toBe(1);
    expect(saunoja.hp).toBe(0);
    expect(saunoja.steam).toBe(0);
    expect(saunoja.name).toBe('Saunoja');
    expect(saunoja.lastHitAt).toBe(0);
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
});
