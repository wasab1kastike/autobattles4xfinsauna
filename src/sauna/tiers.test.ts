import { describe, expect, it } from 'vitest';
import { getSaunaTier, listSaunaTiers } from './tiers.ts';

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
});
