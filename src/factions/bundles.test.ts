import { describe, expect, it, vi } from 'vitest';
import {
  FACTION_IDS,
  getFaction,
  getFactionBundles,
  pickFactionBundle
} from './bundles.ts';

describe('faction bundles', () => {
  it('exposes loaded faction identities', () => {
    expect(FACTION_IDS).toContain('enemy');
    expect(getFaction('deepwood')?.name).toBe('Deepwood Wardens');
  });

  it('only selects bundles from the requested faction', () => {
    const bundle = pickFactionBundle('deepwood', () => 0);
    expect(bundle.id).toBe('warding-circle');
    expect(bundle.units.every((unit) => unit.unit !== 'avanto-marauder')).toBe(true);
  });

  it('respects bundle weights during selection', () => {
    const bundle = pickFactionBundle('enemy', () => 0.99);
    expect(bundle.id).toBe('frost-champion');
  });

  it('falls back to Math.random when a provided source is invalid', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValue(0.5);
    const bundles = getFactionBundles('enemy');
    expect(() => pickFactionBundle('enemy', () => Number.NaN)).not.toThrow();
    expect(randomSpy).toHaveBeenCalled();
    expect(bundles).not.toHaveLength(0);
    randomSpy.mockRestore();
  });
});
