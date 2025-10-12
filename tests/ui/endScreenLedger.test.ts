import { afterEach, describe, expect, it } from 'vitest';

import { Resource } from '../../src/core/GameState.ts';
import { calculateArtocoinPayout } from '../../src/progression/artocoin.ts';
import type { ObjectiveResolution } from '../../src/progression/objectives.ts';
import { showEndScreen } from '../../src/ui/overlays/EndScreen.tsx';

function makeResolution(): ObjectiveResolution {
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

function sanitizeMetric(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

describe('EndScreen artocoin ledger', () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
  });

  it('shows the defeat floor payout when metrics are undefined', () => {
    container = document.createElement('div');
    document.body.append(container);

    const resolution = makeResolution();
    const snapshot = { effectiveDifficulty: 1, rampStageIndex: 0 } as const;
    const payout = calculateArtocoinPayout(resolution.outcome, {
      tierId: 'ember-circuit',
      runSeconds: Math.max(0, sanitizeMetric(resolution.durationMs) / 1000),
      enemyKills: Math.max(0, sanitizeMetric(resolution.summary.enemyKills)),
      tilesExplored: Math.max(
        0,
        sanitizeMetric(resolution.summary.exploration.revealedHexes)
      ),
      rosterLosses: Math.max(0, sanitizeMetric(resolution.summary.roster.totalDeaths)),
      difficultyScalar: snapshot.effectiveDifficulty,
      rampStageIndex: snapshot.rampStageIndex
    });

    const controller = showEndScreen({
      container,
      resolution,
      artocoinSummary: {
        balance: payout.artocoins,
        earned: payout.artocoins,
        spent: 0
      },
      onNewRun: () => {}
    });

    const labels = Array.from(container.querySelectorAll('.end-screen__artocoin-label'));
    const values = Array.from(container.querySelectorAll('.end-screen__artocoin-value'));
    const earnedIndex = labels.findIndex((label) => label.textContent === 'Earned');
    expect(earnedIndex).toBeGreaterThanOrEqual(0);
    expect(values[earnedIndex]?.textContent).toBe('12');
    expect(values[earnedIndex]?.textContent).not.toBe('0');

    controller.destroy();
  });
});
