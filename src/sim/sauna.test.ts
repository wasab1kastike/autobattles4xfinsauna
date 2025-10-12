import { describe, expect, it } from 'vitest';
import { createSauna } from './sauna.ts';

describe('createSauna', () => {
  it('derives the sauna vision range from the provided tier', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      tier: { visionRange: 11.8 }
    });

    expect(sauna.visionRange).toBe(11);
  });

  it('allows explicit overrides for the sauna vision range', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      tier: { visionRange: 4 },
      visionRange: 7
    });

    expect(sauna.visionRange).toBe(7);
  });
});
