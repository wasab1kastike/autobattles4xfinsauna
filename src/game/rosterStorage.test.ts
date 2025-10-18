import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSaunoja, SAUNOJA_UPKEEP_MAX } from '../units/saunoja.ts';
import {
  SAUNOJA_STORAGE_KEY,
  getSaunojaStorage,
  loadUnits,
  persistRosterSelection,
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
        behavior: 'explore',
        traits: ['Bold', 'Veteran'],
        upkeep: SAUNOJA_UPKEEP_MAX,
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
    const serialized = JSON.parse(stored ?? '[]');
    expect(serialized[0]?.behavior).toBe('explore');

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const [unit] = restored;
    expect(unit.id).toBe('saunoja-1');
    expect(unit.coord).toEqual({ q: 3, r: -1 });
    expect(unit.traits).toEqual(expect.arrayContaining(['Bold', 'Veteran']));
    expect(unit.upkeep).toBe(SAUNOJA_UPKEEP_MAX);
    expect(unit.behavior).toBe('explore');
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

  it('persists only the chosen attendant when preparing the next run', () => {
    const roster = [
      makeSaunoja({ id: 'saunoja-1', name: 'Aava', xp: 360, upkeep: 2 }),
      makeSaunoja({ id: 'saunoja-2', name: 'Kalle', xp: 120, upkeep: 1 })
    ];

    saveUnits(roster);
    persistRosterSelection(roster, 'saunoja-2');

    const stored = window.localStorage?.getItem(SAUNOJA_STORAGE_KEY);
    expect(stored).toBeTypeOf('string');
    const serialized = JSON.parse(stored ?? '[]');
    expect(serialized).toHaveLength(1);
    expect(serialized[0]?.id).toBe('saunoja-2');

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    expect(restored[0]?.id).toBe('saunoja-2');
    expect(restored[0]?.selected).toBe(true);
  });

  it('only retains explicitly selected loadout items when preparing the next run', () => {
    const roster = [
      makeSaunoja({
        id: 'saunoja-1',
        name: 'Aava',
        xp: 360,
        upkeep: 2,
        items: [
          {
            id: 'steamed-bandages',
            name: 'Steamed Bandages',
            description: 'Fresh wraps warmed in the sauna for rapid mending.',
            icon: '/assets/items/bandages.svg',
            rarity: 'uncommon',
            quantity: 2
          },
          {
            id: 'emberglass-arrow',
            name: 'Emberglass Arrow',
            description: 'Ignites targets on hit',
            icon: '/assets/items/emberglass.svg',
            rarity: 'rare',
            quantity: 1
          }
        ]
      })
    ];

    persistRosterSelection(roster, 'saunoja-1', {
      keepItems: [
        {
          ...roster[0].items[0]
        }
      ]
    });

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const [unit] = restored;
    expect(unit.items).toHaveLength(1);
    expect(unit.items[0]?.id).toBe('steamed-bandages');
    expect(unit.items[0]?.quantity).toBe(2);
  });

  it('limits carried loadout items to three unique selections', () => {
    const roster = [
      makeSaunoja({
        id: 'saunoja-1',
        name: 'Aava',
        xp: 540,
        upkeep: 3,
        items: [
          {
            id: 'steamed-bandages',
            name: 'Steamed Bandages',
            description: 'Fresh wraps warmed in the sauna for rapid mending.',
            icon: '/assets/items/bandages.svg',
            rarity: 'uncommon',
            quantity: 2
          },
          {
            id: 'emberglass-arrow',
            name: 'Emberglass Arrow',
            description: 'Ignites targets on hit',
            icon: '/assets/items/emberglass.svg',
            rarity: 'rare',
            quantity: 1
          },
          {
            id: 'windstep-totem',
            name: 'Windstep Totem',
            description: 'A carved charm that lightens the bearer\'s stride.',
            icon: '/assets/items/totem.svg',
            rarity: 'rare',
            quantity: 1
          },
          {
            id: 'spirit-oak-charm',
            name: 'Spirit Oak Charm',
            description: 'An heirloom talisman steeped in sauna lore.',
            icon: '/assets/items/charm.svg',
            rarity: 'epic',
            quantity: 1
          }
        ]
      })
    ];

    persistRosterSelection(roster, 'saunoja-1', {
      keepItems: roster[0].items.map((item) => ({ ...item }))
    });

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const [unit] = restored;
    expect(unit.items).toHaveLength(3);
    expect(unit.items.map((item) => item.id)).toEqual([
      'steamed-bandages',
      'emberglass-arrow',
      'windstep-totem'
    ]);
    expect(unit.equipment.relic).toBeNull();
  });

  it('retains the selected attendant loadout when keepItems mirrors the current gear', () => {
    const roster = [
      makeSaunoja({
        id: 'saunoja-1',
        name: 'Ilona',
        xp: 720,
        upkeep: 3,
        items: [
          {
            id: 'steamed-bandages',
            name: 'Steamed Bandages',
            description: 'Fresh wraps warmed in the sauna for rapid mending.',
            icon: '/assets/items/bandages.svg',
            rarity: 'uncommon',
            quantity: 2
          },
          {
            id: 'emberglass-arrow',
            name: 'Emberglass Arrow',
            description: 'Ignites targets on hit',
            icon: '/assets/items/emberglass.svg',
            rarity: 'rare',
            quantity: 1
          }
        ]
      })
    ];

    const keepItems = roster[0].items.map((item) => ({ ...item }));

    persistRosterSelection(roster, 'saunoja-1', {
      keepItems
    });

    const restored = loadUnits();
    expect(restored).toHaveLength(1);
    const [unit] = restored;
    expect(unit.items).toHaveLength(2);
    expect(unit.items.map((item) => item.id)).toEqual([
      'steamed-bandages',
      'emberglass-arrow'
    ]);
    expect(unit.items.map((item) => item.quantity)).toEqual([2, 1]);
    expect(unit.equipment.supply?.id).toBe('steamed-bandages');
    expect(unit.equipment.supply?.quantity).toBe(2);
    expect(unit.equipment.weapon?.id).toBe('emberglass-arrow');
    expect(unit.equipment.weapon?.quantity).toBe(1);
  });
});
