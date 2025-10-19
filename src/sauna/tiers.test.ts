import { describe, expect, it } from 'vitest';
import { getSaunaTier, listSaunaTiers } from './tiers.ts';

describe('sauna tiers', () => {
  it('tracks spawn cadence progression across tiers', () => {
    expect(getSaunaTier('ember-circuit').spawnSpeedMultiplier ?? 1).toBe(1);
    expect(getSaunaTier('glacial-rhythm').spawnSpeedMultiplier ?? 0).toBeCloseTo(1.15, 2);
    expect(getSaunaTier('solstice-cadence').spawnSpeedMultiplier ?? 0).toBeCloseTo(1.3, 2);
  });

  it('alternates roster growth with cadence upgrades', () => {
    const tiers = listSaunaTiers();
    const caps = tiers.map((tier) => tier.rosterCap);
    expect(caps).toEqual([3, 4, 4, 5, 5, 6]);
  });
});
