import { describe, it, expect } from 'vitest';
import { createRosterPanel, type RosterEntry } from './RosterPanel.tsx';

function buildEntry(
  overrides: Partial<
    Omit<
      RosterEntry,
      'stats' | 'baseStats' | 'equipment' | 'items' | 'modifiers' | 'traits' | 'progression'
    >
  > & {
    stats?: Partial<RosterEntry['stats']>;
    baseStats?: Partial<RosterEntry['baseStats']>;
    equipment?: RosterEntry['equipment'];
    items?: RosterEntry['items'];
    modifiers?: RosterEntry['modifiers'];
    traits?: readonly string[];
    progression?: RosterEntry['progression'];
  } = {}
): RosterEntry {
  const baseStatsDefault: RosterEntry['stats'] = {
    health: 18,
    maxHealth: 24,
    attackDamage: 3,
    attackRange: 1,
    movementRange: 3,
    defense: 0,
    shield: 0
  };
  const statsDefault: RosterEntry['stats'] = {
    health: 18,
    maxHealth: 30,
    attackDamage: 4,
    attackRange: 2,
    movementRange: 3,
    defense: 1,
    shield: undefined
  };

  const stats = { ...statsDefault, ...overrides.stats } as RosterEntry['stats'];
  const baseStats = {
    ...baseStatsDefault,
    ...overrides.baseStats
  } as RosterEntry['baseStats'];
  const defaultEquipment: RosterEntry['equipment'] = [
    {
      id: 'weapon',
      label: 'Primary Armament',
      description: 'Main weapon slot',
      maxStacks: 1,
      item: null,
      modifiers: null
    },
    {
      id: 'supply',
      label: 'Supply Satchel',
      description: 'Consumable provisions',
      maxStacks: 3,
      item: null,
      modifiers: null
    }
  ];
  const equipment = overrides.equipment ? [...overrides.equipment] : defaultEquipment;
  const items = overrides.items ? [...overrides.items] : ([] as RosterEntry['items']);
  const modifiers = overrides.modifiers
    ? [...overrides.modifiers]
    : ([] as RosterEntry['modifiers']);
  const traits = overrides.traits ? [...overrides.traits] : ['Resolute', 'Trailblazer'];
  const progression =
    overrides.progression ??
    ({
      level: 3,
      xp: 420,
      xpIntoLevel: 20,
      xpForNext: 260,
      progress: 20 / 260,
      statBonuses: { vigor: 9, focus: 5, resolve: 3 }
    } satisfies RosterEntry['progression']);

  return {
    id: 'roster-entry',
    name: 'Aava "Emberguard" Aalto',
    upkeep: 3,
    status: 'reserve',
    selected: false,
    traits,
    stats,
    baseStats,
    progression,
    equipment,
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
    expect(metaInitial?.textContent).toContain('HP 18/30 (+6)');
    expect(metaInitial?.textContent).toContain('ATK 4 (+1)');
    expect(metaInitial?.textContent).toContain('RNG 2 (+1)');
    expect(metaInitial?.textContent).toContain('MOV 3');
    expect(metaInitial?.textContent).toContain('Upkeep 3 beer');
    expect(container.querySelectorAll('.panel-roster__slot')).toHaveLength(2);
    expect(container.querySelector('.panel-roster__mods')).toBeNull();

    const levelBadgeInitial = container.querySelector('.panel-roster__level-value');
    expect(levelBadgeInitial?.textContent).toBe('3');
    const xpRowInitial = container.querySelector('.panel-roster__xp');
    expect(xpRowInitial?.textContent).toContain('20 / 260');
    const calloutsInitial = container.querySelector('.panel-roster__callouts');
    expect(calloutsInitial?.textContent).toContain('+9 Vigor');
    expect(calloutsInitial?.textContent).toContain('+5 Focus');
    expect(calloutsInitial?.textContent).toContain('+3 Resolve');

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
      baseStats: {
        health: 18,
        maxHealth: 24,
        attackDamage: 3,
        attackRange: 1,
        movementRange: 3,
        defense: 0,
        shield: 0
      },
      equipment: [
        {
          id: 'weapon',
          label: 'Primary Armament',
          description: 'Main weapon slot',
          maxStacks: 1,
          item: {
            id: 'emberglass-arrow',
            slot: 'weapon',
            name: 'Emberglass Arrow',
            description: 'Ignites targets on impact',
            icon: '/assets/items/emberglass.svg',
            rarity: 'rare',
            quantity: 2
          },
          modifiers: { attackDamage: 2, attackRange: 1 }
        },
        {
          id: 'supply',
          label: 'Supply Satchel',
          description: 'Consumable provisions',
          maxStacks: 3,
          item: {
            id: 'sauna-towel',
            slot: 'supply',
            name: 'Sauna Towel',
            description: 'Always ready for the steam room',
            quantity: 1
          },
          modifiers: { health: 3 }
        }
      ],
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
      traits: ['Resolute', 'Trailblazer', 'Vanguard'],
      progression: {
        level: 5,
        xp: 1000,
        xpIntoLevel: 20,
        xpForNext: 380,
        progress: 20 / 380,
        statBonuses: { vigor: 19, focus: 10, resolve: 6 }
      }
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

    const levelBadgeUpdated = container.querySelector('.panel-roster__level-value');
    expect(levelBadgeUpdated?.textContent).toBe('5');
    const xpRowUpdated = container.querySelector('.panel-roster__xp');
    expect(xpRowUpdated?.textContent).toContain('20 / 380');
    const calloutsUpdated = container.querySelector('.panel-roster__callouts');
    expect(calloutsUpdated?.textContent).toContain('+19 Vigor');
    expect(calloutsUpdated?.textContent).toContain('+10 Focus');
    expect(calloutsUpdated?.textContent).toContain('+6 Resolve');

    const slotSummaries = Array.from(
      container.querySelectorAll<HTMLSpanElement>('.panel-roster__slot-summary')
    ).map((node) => node.textContent?.trim());
    expect(slotSummaries).toContain('Emberglass Arrow');
    expect(slotSummaries).toContain('Sauna Towel');

    const items = container.querySelectorAll<HTMLElement>('.panel-roster__slot-icons .item-icon');
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

    const slotModifiers = Array.from(
      container.querySelectorAll<HTMLSpanElement>('.panel-roster__slot-modifiers')
    ).map((el) => el.textContent ?? '');
    expect(slotModifiers.some((text) => text.includes('ATK +2'))).toBe(true);
    expect(slotModifiers.some((text) => text.includes('HP +3'))).toBe(true);

    const ariaLabel = button?.getAttribute('aria-label') ?? '';
    expect(ariaLabel).toContain('attack range 4');
    expect(ariaLabel).toContain('upkeep 5 beer');
    expect(ariaLabel).toContain('2 equipped items');
    expect(ariaLabel).toContain('1 active modifier');
  });

  it('renders roster cap controls and routes updates through callbacks', () => {
    const container = document.createElement('div');
    let currentCap = 2;
    const updates: Array<{ value: number; persist?: boolean }> = [];
    const panel = createRosterPanel(container, {
      getRosterCap: () => currentCap,
      getRosterCapLimit: () => 5,
      updateMaxRosterSize: (value, opts) => {
        updates.push({ value, persist: opts?.persist });
        currentCap = value;
        return value;
      }
    });

    panel.render([]);

    const slider = container.querySelector<HTMLInputElement>('.panel-roster__cap-slider');
    const numberInput = container.querySelector<HTMLInputElement>('.panel-roster__cap-number');
    const valueLabel = container.querySelector<HTMLSpanElement>('.panel-roster__cap-value');
    const emptyMessage = container.querySelector('.panel-roster__empty');

    expect(slider).not.toBeNull();
    expect(numberInput).not.toBeNull();
    expect(valueLabel?.textContent).toBe('2');
    expect(slider?.value).toBe('2');
    expect(slider?.max).toBe('5');
    expect(numberInput?.max).toBe('5');
    expect(emptyMessage).not.toBeNull();

    if (!slider || !numberInput || !valueLabel) {
      throw new Error('Roster cap controls did not render');
    }

    slider.value = '8';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toEqual({ value: 5, persist: false });
    expect(valueLabel.textContent).toBe('5');

    slider.dispatchEvent(new Event('change', { bubbles: true }));
    expect(updates).toHaveLength(2);
    expect(updates[1]).toEqual({ value: 5, persist: true });

    numberInput.value = '-3';
    numberInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(updates).toHaveLength(3);
    expect(updates[2]).toEqual({ value: 0, persist: true });
    expect(valueLabel.textContent).toBe('Paused');
    expect(valueLabel.dataset.state).toBe('paused');
  });
});
