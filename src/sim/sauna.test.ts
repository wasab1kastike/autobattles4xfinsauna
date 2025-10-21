import { describe, expect, it } from 'vitest';
import { createSauna, DEFAULT_SAUNA_VISION_RANGE } from './sauna.ts';

describe('createSauna', () => {
  it('defaults to the constant sauna vision radius', () => {
    const sauna = createSauna({ q: 0, r: 0 });

    expect(DEFAULT_SAUNA_VISION_RANGE).toBe(4);
    expect(sauna.visionRange).toBe(DEFAULT_SAUNA_VISION_RANGE);
  });

  it('derives the spawn speed multiplier from the provided tier', () => {
    const sauna = createSauna({ q: 0, r: 0 }, { baseThreshold: 10, heatPerSecond: 2 }, {
      tier: { spawnSpeedMultiplier: 1.25 }
    });

    expect(sauna.spawnSpeedMultiplier).toBeCloseTo(1.25, 3);
    expect(sauna.heatPerTick).toBeCloseTo(2.5, 3);
    expect(sauna.playerSpawnCooldown).toBeCloseTo(5 / 1.25, 3);
  });

  it('allows explicit overrides for the spawn speed multiplier', () => {
    const sauna = createSauna({ q: 0, r: 0 }, { baseThreshold: 12, heatPerSecond: 3 }, {
      tier: { spawnSpeedMultiplier: 0.9 },
      spawnSpeedMultiplier: 1.5
    });

    expect(sauna.spawnSpeedMultiplier).toBeCloseTo(1.5, 3);
    expect(sauna.heatPerTick).toBeCloseTo(4.5, 3);
    expect(sauna.playerSpawnCooldown).toBeCloseTo(12 / 3 / 1.5, 3);
  });

  it('allows explicit overrides for the sauna vision range', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      visionRange: 7
    });

    expect(sauna.visionRange).toBe(7);
  });

  it('locks the sauna vision range to the base radius even when a tier is provided', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      tier: { spawnSpeedMultiplier: 1.1 }
    });

    expect(sauna.visionRange).toBe(DEFAULT_SAUNA_VISION_RANGE);
  });

  it('applies tier-provided healing aura metadata', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      tier: { spawnSpeedMultiplier: 1, healingAura: { radius: 4, regenPerSecond: 2 } }
    });

    expect(sauna.auraRadius).toBe(4);
    expect(sauna.regenPerSec).toBeCloseTo(2, 5);
  });

  it('falls back to legacy aura values when metadata is absent', () => {
    const sauna = createSauna({ q: 0, r: 0 });

    expect(sauna.auraRadius).toBe(2);
    expect(sauna.regenPerSec).toBeCloseTo(1, 5);
  });

  it('sanitizes invalid vision overrides for tests', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      visionRange: -3
    });

    expect(sauna.visionRange).toBe(0);
  });
});
