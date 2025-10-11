import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEnemyScalingPanel } from '../EnemyScalingPanel.tsx';
import { selectEnemyScalingSummaries, type EnemyScalingSummaryEntry } from '../../../state/telemetry/enemyScaling.ts';

const STORAGE_KEY = 'telemetry:enemy-scaling:summaries';

describe('EnemyScalingPanel', () => {
  describe('rendering', () => {
    it('renders telemetry entries with stage details and metrics', () => {
      const container = document.createElement('div');
      const panel = createEnemyScalingPanel(container);
      const entries: EnemyScalingSummaryEntry[] = [
        {
          timestamp: Date.UTC(2024, 2, 3, 13, 24, 45),
          stageLabel: 'Ramp III',
          stageIndex: 2,
          multiplier: 1.5,
          peakMultiplier: 2.01,
          calmSeconds: 42.4,
          longestCalmMs: 58000,
          longestWipeMs: 135000,
          wipeSince: Date.UTC(2024, 2, 3, 13, 20, 0)
        }
      ];

      panel.render(entries);

      const stage = container.querySelector('.panel-scaling__stage');
      expect(stage?.textContent).toBe('Ramp III');

      const timestamp = container.querySelector('.panel-scaling__timestamp');
      expect(timestamp?.getAttribute('datetime')).toBe(new Date(entries[0].timestamp).toISOString());

      const multiplierValue = container.querySelector('.panel-scaling__metric-value');
      expect(multiplierValue?.textContent).toContain('×1.50');
      const multiplierDetail = multiplierValue?.querySelector('.panel-scaling__metric-detail');
      expect(multiplierDetail?.textContent).toContain('Peak ×2.01');

      const calmMetric = container.querySelectorAll('.panel-scaling__metric')[1];
      expect(calmMetric?.textContent).toContain('42s');
      expect(calmMetric?.textContent).toContain('Longest 58s');

      const wipeMetric = container.querySelectorAll('.panel-scaling__metric')[2];
      expect(wipeMetric?.textContent).toContain('2m 15s');
      expect(wipeMetric?.textContent).toContain('ago');
    });

    it('shows an empty state when no telemetry exists', () => {
      const container = document.createElement('div');
      const panel = createEnemyScalingPanel(container);

      panel.render([]);

      const status = container.querySelector('.panel-scaling__status');
      expect(status?.hidden).toBe(false);
      expect(status?.textContent).toContain('No enemy scaling telemetry');
    });
  });
});

describe('selectEnemyScalingSummaries', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    const storageMock = {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      }
    } as Storage;
    Object.defineProperty(storageMock, 'length', {
      get: () => store.size
    });
    vi.stubGlobal('localStorage', storageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores malformed entries while returning sanitized telemetry', () => {
    const validEntry = {
      event: 'enemy-scaling',
      timestamp: 1_710_000_000_000,
      payload: {
        stage: 'Ramp Alpha',
        stageIndex: 1,
        multiplier: 1.275,
        peakMultiplier: 1.52,
        calmSecondsRemaining: 9.5,
        longestCalmMs: 12000,
        longestWipeMs: 46000,
        wipeSince: 1_709_999_000_000
      }
    };
    const malformedEntries = [
      { event: 'enemy-scaling', timestamp: 'oops', payload: {} },
      { event: 'enemy-scaling', timestamp: 1_709_000_000_000, payload: { multiplier: 'NaN' } },
      { event: 'other', timestamp: 1_711_000_000_000, payload: { stage: 'Ignore' } }
    ];

    store.set(STORAGE_KEY, JSON.stringify([validEntry, ...malformedEntries]));

    const summaries = selectEnemyScalingSummaries();

    expect(summaries).toHaveLength(1);
    const summary = summaries[0];
    expect(summary.stageLabel).toBe('Ramp Alpha');
    expect(summary.stageIndex).toBe(1);
    expect(summary.multiplier).toBeCloseTo(1.27, 2);
    expect(summary.peakMultiplier).toBeCloseTo(1.52, 2);
    expect(summary.calmSeconds).toBeCloseTo(9.5, 3);
    expect(summary.longestCalmMs).toBe(12000);
    expect(summary.longestWipeMs).toBe(46000);
    expect(summary.wipeSince).toBe(1_709_999_000_000);
  });
});
