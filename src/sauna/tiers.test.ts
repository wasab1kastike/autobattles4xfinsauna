import { describe, expect, it } from 'vitest';
import { getSaunaTier } from './tiers.ts';

describe('sauna tiers', () => {
  it('exposes tier-driven sauna vision ranges', () => {
    expect(getSaunaTier('ember-circuit').visionRange).toBe(4);
    expect(getSaunaTier('aurora-ward').visionRange).toBe(10);
    expect(getSaunaTier('mythic-conclave').visionRange).toBe(20);
  });
});
