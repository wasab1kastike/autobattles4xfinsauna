import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Resource } from '../../core/GameState.ts';
import type { ObjectiveResolution } from '../../progression/objectives.ts';
import { showEndScreen } from './EndScreen.tsx';

describe('showEndScreen', () => {
  let container: HTMLElement;
  let originalRaf: typeof globalThis.requestAnimationFrame | undefined;

  const baseResolution: ObjectiveResolution = {
    outcome: 'lose',
    cause: 'saunaDestroyed',
    timestamp: 42_000,
    durationMs: 180_000,
    summary: {
      strongholds: { total: 4, destroyed: 2, remaining: 2 },
      roster: { active: 0, totalDeaths: 7, wipeSince: null, wipeDurationMs: 0 },
      economy: {
        beer: 0,
        worstBeer: -35,
        bankruptSince: null,
        bankruptDurationMs: 0
      },
      sauna: { maxHealth: 1_000, health: 0, destroyed: true, destroyedAt: 41_500 },
      startedAt: 0
    },
    rewards: {
      resources: {
        [Resource.SAUNA_BEER]: { final: 250, delta: 50 },
        [Resource.SAUNAKUNNIA]: { final: 80, delta: 20 },
        [Resource.SISU]: { final: 15, delta: 5 }
      }
    }
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    originalRaf = globalThis.requestAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      cb(0);
      return 0;
    }) as typeof globalThis.requestAnimationFrame;
  });

  afterEach(() => {
    container.remove();
    const globalTarget = globalThis as {
      requestAnimationFrame?: typeof globalThis.requestAnimationFrame;
    };
    if (originalRaf) {
      globalTarget.requestAnimationFrame = originalRaf;
    } else {
      delete globalTarget.requestAnimationFrame;
    }
    vi.restoreAllMocks();
  });

  it('renders a polished defeat message when the sauna falls', () => {
    const controller = showEndScreen({
      container,
      resolution: baseResolution,
      currentNgPlusLevel: 2,
      onNewRun: vi.fn(),
      onDismiss: vi.fn()
    });

    const subtitle = container.querySelector('.end-screen__subtitle');
    expect(subtitle?.textContent).toBe(
      'The sauna collapsed under relentless assault—the sacred steamline has fallen silent.'
    );

    controller.destroy();
  });
});

