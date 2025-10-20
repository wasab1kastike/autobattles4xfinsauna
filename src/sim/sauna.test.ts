import { describe, expect, it } from 'vitest';
import { createSauna, DEFAULT_SAUNA_VISION_RANGE } from './sauna.ts';

describe('createSauna', () => {
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

  it('defaults to the base sauna vision range even when a tier is provided', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      tier: { spawnSpeedMultiplier: 1.1 }
    });

    expect(sauna.visionRange).toBe(DEFAULT_SAUNA_VISION_RANGE);
  });

  it('sanitizes invalid vision overrides for tests', () => {
    const sauna = createSauna({ q: 0, r: 0 }, undefined, {
      visionRange: -3
    });

    expect(sauna.visionRange).toBe(0);
  });
});
