import { describe, expect, it } from 'vitest';

import { createUnit } from '../../src/units/UnitFactory.ts';

describe('UnitFactory boss flag propagation', () => {
  it('marks boss archetypes as bosses', () => {
    const unit = createUnit('aurora-warden', 'boss-unit', { q: 0, r: 0 }, 'enemy');
    expect(unit).toBeTruthy();
    expect(unit?.isBoss).toBe(true);
  });

  it('does not treat standard archetypes as bosses', () => {
    const unit = createUnit('soldier', 'soldier-unit', { q: 1, r: 1 }, 'player');
    expect(unit).toBeTruthy();
    expect(unit?.isBoss).toBe(false);
  });
});
