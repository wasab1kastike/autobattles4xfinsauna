import { describe, expect, it } from 'vitest';
import { generateTraits, NEG, POS } from './traits.ts';

const makeDeterministicRandom = (sequence: number[]): (() => number) => {
  let index = 0;
  return () => {
    const value = sequence[index] ?? sequence[sequence.length - 1] ?? 0;
    index += 1;
    return value;
  };
};

describe('generateTraits', () => {
  it('returns a mix of positive and negative traits without duplicates', () => {
    const rng = makeDeterministicRandom([0.1, 0.6, 0.2, 0.8, 0.4]);
    const traits = generateTraits(rng);
    expect(traits.length).toBeGreaterThan(0);
    expect(traits.length).toBeLessThanOrEqual(3);
    const positives = traits.filter((trait) => POS.includes(trait as (typeof POS)[number]));
    const negatives = traits.filter((trait) => NEG.includes(trait as (typeof NEG)[number]));
    expect(positives.length).toBeGreaterThanOrEqual(1);
    expect(negatives.length).toBeGreaterThanOrEqual(1);
    expect(new Set(traits).size).toBe(traits.length);
  });

  it('falls back to Math.random when the provided source is invalid', () => {
    const traits = generateTraits(null as unknown as () => number);
    expect(Array.isArray(traits)).toBe(true);
    expect(traits.length).toBeGreaterThan(0);
  });
});
