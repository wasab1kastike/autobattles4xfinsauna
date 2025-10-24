import { describe, expect, it } from 'vitest';
import {
  evaluateSaunaTier,
  getSaunaTier,
  listSaunaTiers,
  type SaunaTierId
} from './tiers.ts';

describe('sauna tiers', () => {
  it('lists the current progression lineup from Ember Circuit through Celestial Reserve', () => {
    expect(listSaunaTiers().map((tier) => tier.id)).toEqual([
      'ember-circuit',
      'aurora-ward',
      'glacial-rhythm',
      'mythic-conclave',
      'solstice-cadence',
      'celestial-reserve'
    ]);
  });

  it('tracks spawn cadence progression across tiers', () => {
    const tiers = listSaunaTiers();
    const multipliers = tiers.map((tier) => tier.spawnSpeedMultiplier ?? 1);

    expect(multipliers).toEqual([1, 1, 1.15, 1.15, 1.3, 1.3]);
    expect(getSaunaTier('celestial-reserve').spawnSpeedMultiplier ?? 0).toBeCloseTo(1.3, 2);
  });

  it('alternates roster growth with cadence upgrades', () => {
    const tiers = listSaunaTiers();
    const caps = tiers.map((tier) => tier.rosterCap);
    expect(caps).toEqual([3, 4, 4, 5, 5, 6]);
  });

  it('marks every third hall with an extended healing aura', () => {
    const tiers = listSaunaTiers();
    const auraTiers = tiers.filter((tier) => tier.healingAura);

    expect(auraTiers.map((tier) => tier.id)).toEqual(['glacial-rhythm', 'celestial-reserve']);
    for (const tier of auraTiers) {
      expect(tier.healingAura).toEqual({ radius: 3, regenPerSecond: 1.5 });
    }
  });

  it('tracks unlocks separately from Saunakunnia upgrades', () => {
    const tier = getSaunaTier('aurora-ward');
    const locked = evaluateSaunaTier(tier, {
      artocoinBalance: 40,
      saunakunniaBalance: 10,
      unlockedTierIds: new Set<SaunaTierId>(['ember-circuit']),
      ownedTierIds: new Set<SaunaTierId>(['ember-circuit'])
    });

    expect(locked.unlocked).toBe(false);
    expect(locked.owned).toBe(false);
    expect(locked.unlock.requirementLabel).toContain('Need 30 more');
    expect(Math.round(locked.unlock.progress * 100)).toBe(57);
    expect(locked.requirementLabel).toBe(locked.unlock.requirementLabel);

    const unlocked = evaluateSaunaTier(tier, {
      artocoinBalance: 80,
      saunakunniaBalance: 60,
      unlockedTierIds: new Set<SaunaTierId>(['ember-circuit', 'aurora-ward']),
      ownedTierIds: new Set<SaunaTierId>(['ember-circuit'])
    });

    expect(unlocked.unlocked).toBe(true);
    expect(unlocked.owned).toBe(false);
    expect(unlocked.unlock.progress).toBe(1);
    expect(Math.round(unlocked.upgrade.progress * 100)).toBe(75);
    expect(unlocked.requirementLabel).toContain('80 Saunakunnia');

    const owned = evaluateSaunaTier(tier, {
      artocoinBalance: 120,
      saunakunniaBalance: 200,
      unlockedTierIds: new Set<SaunaTierId>(['ember-circuit', 'aurora-ward']),
      ownedTierIds: new Set<SaunaTierId>(['ember-circuit', 'aurora-ward'])
    });

    expect(owned.unlocked).toBe(true);
    expect(owned.owned).toBe(true);
    expect(owned.upgrade.progress).toBe(1);
    expect(owned.requirementLabel).toBe('Roster cap 4');
  });

  it('surfaces the healing aura perk when prestige is required', () => {
    const tier = getSaunaTier('glacial-rhythm');
    const status = evaluateSaunaTier(tier, {
      artocoinBalance: 150,
      saunakunniaBalance: 20,
      unlockedTierIds: new Set<SaunaTierId>(['ember-circuit', 'glacial-rhythm']),
      ownedTierIds: new Set<SaunaTierId>(['ember-circuit'])
    });

    expect(status.unlocked).toBe(true);
    expect(status.owned).toBe(false);
    expect(status.requirementLabel).toContain('Healing aura 3-hex (1.5 HP/s)');
    expect(status.upgrade.requirementLabel).toContain('Need 120 more');
  });
});
