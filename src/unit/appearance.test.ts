import { describe, expect, it } from 'vitest';
import {
  normalizeAppearanceId,
  resolveUnitAppearance,
  resolveSaunojaAppearance
} from './appearance.ts';

function makeSampler(sequence: number[]): () => number {
  const queue = [...sequence];
  return () => queue.shift() ?? 0;
}

describe('unit appearance helpers', () => {
  it('normalizes candidate identifiers', () => {
    expect(normalizeAppearanceId('  saunoja-seer  ')).toBe('saunoja-seer');
    expect(normalizeAppearanceId('unit-enemy-orc-1')).toBe('enemy-orc-1');
    expect(normalizeAppearanceId('unknown-variant')).toBeNull();
    expect(normalizeAppearanceId(42)).toBeNull();
  });

  it('samples appearance variants for units using the provided rng', () => {
    const sample = resolveUnitAppearance('soldier', undefined, makeSampler([0, 0.4, 0.9]));
    const followUp = resolveUnitAppearance('soldier', undefined, makeSampler([0.4]));
    const final = resolveUnitAppearance('soldier', undefined, makeSampler([0.9]));
    expect(sample).toBe('saunoja');
    expect(followUp).toBe('saunoja-guardian');
    expect(final).toBe('saunoja-seer');
  });

  it('prefers explicit variants when they match the archetype', () => {
    expect(resolveUnitAppearance('raider', 'enemy-orc-2')).toBe('enemy-orc-2');
    // Falls back to sampling when the provided variant is incompatible.
    const sampled = resolveUnitAppearance('raider', 'soldier', makeSampler([0.2]));
    expect(sampled).toBe('enemy-orc-1');
  });

  it('resolves saunoja appearances independently', () => {
    expect(resolveSaunojaAppearance('saunoja')).toBe('saunoja');
    expect(resolveSaunojaAppearance('archer', makeSampler([0]))).toBe('saunoja');
    expect(resolveSaunojaAppearance(undefined, makeSampler([0.75]))).toBe('saunoja-seer');
  });
});
