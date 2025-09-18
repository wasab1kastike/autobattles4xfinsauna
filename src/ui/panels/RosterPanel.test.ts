import { describe, it, expect } from 'vitest';
import { createRosterPanel, type RosterEntry } from './RosterPanel.tsx';

function buildEntry(
  overrides: Partial<Omit<RosterEntry, 'stats' | 'items' | 'modifiers' | 'traits'>> & {
    stats?: Partial<RosterEntry['stats']>;
    items?: RosterEntry['items'];
    modifiers?: RosterEntry['modifiers'];
    traits?: readonly string[];
  } = {}
): RosterEntry {
  const baseStats: RosterEntry['stats'] = {
    health: 18,
    maxHealth: 30,
    attackDamage: 4,
    attackRange: 2,
    movementRange: 3,
    defense: 1,
    shield: undefined
  };

  const stats = { ...baseStats, ...overrides.stats } as RosterEntry['stats'];
  const items = overrides.items ? [...overrides.items] : ([] as RosterEntry['items']);
  const modifiers = overrides.modifiers
    ? [...overrides.modifiers]
    : ([] as RosterEntry['modifiers']);
  const traits = overrides.traits ? [...overrides.traits] : ['Resolute', 'Trailblazer'];

  return {
    id: 'roster-entry',
    name: 'Aava "Emberguard" Aalto',
    upkeep: 3,
    status: 'reserve',
    selected: false,
    traits,
    stats,
    items,
    modifiers,
    ...overrides
  } satisfies RosterEntry;
}

describe('createRosterPanel', () => {
  it('renders roster stats, items, and modifiers and updates when they change', () => {
    const container = document.createElement('div');
    const panel = createRosterPanel(container);

    const baseEntry = buildEntry();
    panel.render([baseEntry]);

    expect(container.dataset.count).toBe('1');
    const metaInitial = container.querySelector('.panel-roster__meta');
    expect(metaInitial?.textContent).toContain('HP 18/30');
    expect(metaInitial?.textContent).toContain('ATK 4');
    expect(metaInitial?.textContent).toContain('RNG 2');
    expect(metaInitial?.textContent).toContain('MOV 3');
    expect(metaInitial?.textContent).toContain('Upkeep 3 beer');
    expect(container.querySelector('.panel-roster__items')).toBeNull();
    expect(container.querySelector('.panel-roster__mods')).toBeNull();

    const updatedEntry = buildEntry({
      upkeep: 5,
      status: 'engaged',
      selected: true,
      stats: {
        health: 12,
        maxHealth: 30,
        attackDamage: 7,
        attackRange: 4,
        movementRange: 5,
        defense: 3,
        shield: 6
      },
      items: [
        {
          id: 'emberglass-arrow',
          name: 'Emberglass Arrow',
          description: 'Ignites targets on impact',
          icon: '/assets/items/emberglass.svg',
          rarity: 'rare',
          quantity: 2
        },
        {
          id: 'sauna-towel',
          name: 'Sauna Towel',
          description: 'Always ready for the steam room',
          quantity: 1
        }
      ],
      modifiers: [
        {
          id: 'barkskin-ritual',
          name: 'Barkskin Ritual',
          description: 'Gain +3 defense for a short time',
          duration: 18,
          remaining: 12,
          stacks: 2,
          source: 'Shamanic Rite'
        }
      ],
      traits: ['Resolute', 'Trailblazer', 'Vanguard']
    });

    panel.render([updatedEntry]);

    const button = container.querySelector<HTMLButtonElement>('.panel-roster__item');
    expect(button).not.toBeNull();
    expect(button?.classList.contains('is-selected')).toBe(true);
    expect(button?.dataset.status).toBe('engaged');

    const metaUpdated = container.querySelector('.panel-roster__meta');
    expect(metaUpdated?.textContent).toContain('HP 12/30');
    expect(metaUpdated?.textContent).toContain('Shield 6');
    expect(metaUpdated?.textContent).toContain('ATK 7');
    expect(metaUpdated?.textContent).toContain('RNG 4');
    expect(metaUpdated?.textContent).toContain('DEF 3');
    expect(metaUpdated?.textContent).toContain('MOV 5');
    expect(metaUpdated?.textContent).toContain('Upkeep 5 beer');

    const loadout = container.querySelector('.panel-roster__loadout');
    expect(loadout).not.toBeNull();

    const items = container.querySelectorAll<HTMLElement>('.item-icon');
    expect(items).toHaveLength(2);
    expect(items[0].dataset.itemId).toBe('emberglass-arrow');
    expect(items[0].dataset.rarity).toBe('rare');
    expect(items[0].querySelector('.item-icon__quantity')?.textContent).toBe('×2');
    expect(items[1].dataset.itemId).toBe('sauna-towel');
    expect(items[1].querySelector('.item-icon__quantity')).toBeNull();

    const modifiers = container.querySelectorAll<HTMLElement>('.mod-pill');
    expect(modifiers).toHaveLength(1);
    const modifier = modifiers[0];
    expect(modifier.dataset.modifierId).toBe('barkskin-ritual');
    expect(modifier.querySelector('.mod-pill__stacks')?.textContent).toBe('×2');
    expect(modifier.querySelector('.mod-pill__timer')?.textContent).toBe('12s');

    const ariaLabel = button?.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('attack range 4');
    expect(ariaLabel).toContain('upkeep 5 beer');
    expect(ariaLabel).toContain('2 equipped items');
    expect(ariaLabel).toContain('1 active modifier');
  });
});
