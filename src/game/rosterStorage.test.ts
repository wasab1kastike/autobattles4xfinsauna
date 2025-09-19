import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSaunoja } from '../units/saunoja.ts';
import {
  SAUNOJA_STORAGE_KEY,
  getSaunojaStorage,
  loadUnits,
  saveUnits
} from './rosterStorage.ts';

describe('rosterStorage', () => {
  beforeEach(() => {
    window.localStorage?.clear?.();
  });

  it('exposes localStorage when available', () => {
    expect(getSaunojaStorage()).toBe(window.localStorage);
  });

  it('returns null when localStorage is unavailable', () => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: undefined
      });
      expect(getSaunojaStorage()).toBeNull();
    } finally {
      if (descriptor) {
        Object.defineProperty(globalThis, 'localStorage', descriptor);
      } else {
        delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
      }
    }
  });

  it('round-trips roster data through storage', () => {
    const roster = [
      makeSaunoja({
        id: 'saunoja-1',
        name: 'Vapauttaja',
        coord: { q: 3, r: -1 },
        traits: ['Bold', 'Veteran'],
        upkeep: 9,
        items: [
          {
            id: 'emberglass-arrow',
            name: 'Emberglass Arrow',
            description: 'Ignites targets on hit',
            icon: '/assets/items/emberglass.svg',
            rarity: 'rare',
            quantity: 1
          }
        ],
        modifiers: [
          {
            id: 'blessing',
            name: 'Sauna Blessing',
            description: 'Warm resolve lingering from the last infusion.',
            remaining: 42,
            duration: 60,
            appliedAt: 5,
            stacks: 2,
            source: 'sauna'
          }
        ]
      })
    ];

    saveUnits(roster);

    const stored = window.localStorage?.getItem(SAUNOJA_STORAGE_KEY);
    expect(stored).toBeTypeOf('string');

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const [unit] = restored;
    expect(unit.id).toBe('saunoja-1');
    expect(unit.coord).toEqual({ q: 3, r: -1 });
    expect(unit.traits).toEqual(expect.arrayContaining(['Bold', 'Veteran']));
    expect(unit.upkeep).toBe(9);
    expect(unit.items).toHaveLength(1);
    expect(unit.items[0]?.id).toBe('emberglass-arrow');
    expect(unit.modifiers).toHaveLength(1);
    expect(unit.baseStats.health).toBeGreaterThan(0);
    expect(unit.effectiveStats.health).toBeGreaterThan(0);
    expect(Object.keys(unit.equipment)).toEqual(
      expect.arrayContaining(['weapon', 'supply', 'focus', 'relic'])
    );
    expect(unit.equipment.weapon?.id).toBe('emberglass-arrow');
  });

  it('handles malformed storage payloads gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      window.localStorage?.setItem(SAUNOJA_STORAGE_KEY, '{not valid json');
      expect(loadUnits()).toEqual([]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
