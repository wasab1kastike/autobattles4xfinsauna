import { describe, expect, it } from 'vitest';

import { Resource } from '../../core/GameState.ts';
import type { ObjectiveResolution } from '../../progression/objectives.ts';
import { showEndScreen } from './EndScreen.tsx';

function createResolution(): ObjectiveResolution {
  return {
    outcome: 'lose',
    cause: 'saunaDestroyed',
    timestamp: 42,
    durationMs: 123456,
    summary: {
      strongholds: { total: 3, destroyed: 1, remaining: 2 },
      roster: { active: 0, totalDeaths: 7, wipeSince: null, wipeDurationMs: 0 },
      economy: {
        beer: -15,
        worstBeer: -20,
        bankruptSince: null,
        bankruptDurationMs: 0
      },
      sauna: {
        maxHealth: 1000,
        health: 0,
        destroyed: true,
        destroyedAt: 41
      },
      startedAt: 0
    },
    rewards: {
      resources: {
        [Resource.SAUNA_BEER]: { final: 0, delta: -50 },
        [Resource.SAUNAKUNNIA]: { final: 10, delta: -5 },
        [Resource.SISU]: { final: 4, delta: 1 }
      }
    }
  };
}

describe('EndScreen', () => {
  it('describes the sauna destruction narrative', () => {
    const container = document.createElement('div');
    const resolution = createResolution();

    const controller = showEndScreen({
      container,
      resolution,
      currentNgPlusLevel: 0,
      onNewRun: () => {}
    });

    const subtitle = container.querySelector('.end-screen__subtitle');
    expect(subtitle?.textContent).toBe(
      'The sacred sauna collapses under the final assault, its steam forever stilled.'
    );

    controller.destroy();
  });
});
