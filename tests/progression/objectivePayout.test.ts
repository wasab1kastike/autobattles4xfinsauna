import { describe, expect, it } from 'vitest';

import { Resource } from '../../src/core/GameState.ts';
import { calculateArtocoinPayout } from '../../src/progression/artocoin.ts';
import { extractObjectiveMetrics } from '../../src/progression/objectivePayout.ts';
import type { ObjectiveResolution } from '../../src/progression/objectives.ts';

function makeResolutionWithMissingMetrics(): ObjectiveResolution {
  return {
    outcome: 'lose',
    cause: 'saunaDestroyed',
    timestamp: 0,
    durationMs: undefined as unknown as number,
    summary: {
      strongholds: { total: 3, destroyed: 1, remaining: 2 },
      roster: { active: 0, totalDeaths: 0, wipeSince: null, wipeDurationMs: 0 },
      economy: { beer: 0, worstBeer: 0, bankruptSince: null, bankruptDurationMs: 0 },
      sauna: { maxHealth: 100, health: 0, destroyed: true, destroyedAt: 0 },
      enemyKills: undefined as unknown as number,
      exploration: { revealedHexes: undefined as unknown as number },
      startedAt: 0
    },
    rewards: {
      resources: {
        [Resource.SAUNA_BEER]: { final: 0, delta: 0 },
        [Resource.SAUNAKUNNIA]: { final: 0, delta: 0 },
        [Resource.SISU]: { final: 0, delta: 0 }
      }
    }
  } satisfies ObjectiveResolution;
}

describe('objective payout sanitization', () => {
  it('falls back to the defeat floor when metrics are missing', () => {
    const resolution = makeResolutionWithMissingMetrics();
    const snapshot = { effectiveDifficulty: 1, rampStageIndex: 0 } as const;
    const metrics = extractObjectiveMetrics(resolution);
    const payout = calculateArtocoinPayout(resolution.outcome, {
      tierId: 'ember-circuit',
      runSeconds: Math.max(0, metrics.runSeconds),
      enemyKills: Math.max(0, metrics.enemyKills),
      tilesExplored: Math.max(0, metrics.tilesExplored),
      rosterLosses: Math.max(0, metrics.rosterLosses),
      difficultyScalar: snapshot.effectiveDifficulty,
      rampStageIndex: snapshot.rampStageIndex
    });
    expect(payout.artocoins).toBe(12);
    expect(Number.isNaN(payout.artocoins)).toBe(false);
  });
});
