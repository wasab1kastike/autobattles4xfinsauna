import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Resource } from '../../core/GameState.ts';
import type { ObjectiveResolution } from '../../progression/objectives.ts';
import { showEndScreen, type EndScreenRosterEntry } from './EndScreen.tsx';

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
      enemyKills: 0,
      exploration: { revealedHexes: 0 },
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

  const rosterTemplate: EndScreenRosterEntry[] = [
    {
      id: 'attendant-1',
      name: 'Aava the Bold',
      level: 5,
      xp: 420,
      upkeep: 2,
      hp: 14,
      maxHp: 22,
      traits: ['Bold', 'Resilient'],
      portraitUrl: '/assets/units/saunoja-01.png'
    },
    {
      id: 'attendant-2',
      name: 'Kalle the Steadfast',
      level: 3,
      xp: 180,
      upkeep: 1,
      hp: 0,
      maxHp: 20,
      traits: ['Guardian'],
      portraitUrl: '/assets/units/saunoja-02.png'
    }
  ];

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
      onNewRun: vi.fn(),
      onDismiss: vi.fn(),
      roster: rosterTemplate.map((entry) => ({ ...entry }))
    });

    const subtitle = container.querySelector('.end-screen__subtitle');
    expect(subtitle?.textContent).toBe(
      'The sauna collapsed under relentless assault—the sacred steamline has fallen silent.'
    );

    controller.destroy();
  });

  it('summarises artocoin earnings, spending, and balance', () => {
    const controller = showEndScreen({
      container,
      resolution: baseResolution,
      onNewRun: vi.fn(),
      artocoinSummary: { balance: 480, earned: 135, spent: 90 },
      roster: rosterTemplate.map((entry) => ({ ...entry }))
    });

    const ledgerValues = Array.from(
      container.querySelectorAll<HTMLElement>('.end-screen__artocoin-value')
    ).map((node) => ({ text: node.textContent, polarity: node.dataset.polarity }));

    expect(ledgerValues).toEqual([
      { text: '135', polarity: 'positive' },
      { text: '90', polarity: 'negative' },
      { text: '480', polarity: 'neutral' }
    ]);

    controller.destroy();
  });

  it('requires picking an attendant before a new run is available', () => {
    const onNewRun = vi.fn();
    const controller = showEndScreen({
      container,
      resolution: baseResolution,
      onNewRun,
      roster: rosterTemplate.map((entry) => ({ ...entry }))
    });

    const newRunButton = container.querySelector<HTMLButtonElement>('.end-screen__button--primary');
    expect(newRunButton?.disabled).toBe(true);

    const radios = Array.from(
      container.querySelectorAll<HTMLInputElement>('.end-screen__roster-radio')
    );
    expect(radios).toHaveLength(2);

    const firstRadio = radios[0];
    firstRadio.checked = true;
    firstRadio.dispatchEvent(new Event('change', { bubbles: true }));

    expect(newRunButton?.disabled).toBe(false);

    newRunButton?.click();
    expect(onNewRun).toHaveBeenCalledWith('attendant-1');

    const selectedCard = container.querySelector('.end-screen__roster-card.is-selected');
    expect(selectedCard?.getAttribute('data-unit-id')).toBe('attendant-1');

    controller.destroy();
  });
});

