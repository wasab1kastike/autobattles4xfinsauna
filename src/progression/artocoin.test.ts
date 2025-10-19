import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  ARTOCOIN_STORAGE_KEY,
  calculateArtocoinPayout,
  loadArtocoinBalance,
  onArtocoinChange,
  resetArtocoinBalance,
  saveArtocoinBalance
} from './artocoin.ts';
import { NG_PLUS_STORAGE_KEY } from './ngplus.ts';

class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  const mockWindow = { localStorage: storage } as unknown as Window & typeof globalThis;
  vi.stubGlobal('window', mockWindow);
  vi.stubGlobal('localStorage', storage);
  return storage;
}

describe('artocoin progression helpers', () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns zero when no artocoin balance is stored', () => {
    expect(loadArtocoinBalance()).toBe(0);
  });

  it('persists sanitized artocoin balances', () => {
    saveArtocoinBalance(187.6);
    const stored = window.localStorage?.getItem?.(ARTOCOIN_STORAGE_KEY);
    expect(stored).toBe('187');
    expect(loadArtocoinBalance()).toBe(187);
  });

  it('migrates legacy artocoins from the NG+ save slot', () => {
    const storage = window.localStorage as MemoryStorage;
    storage.setItem(
      NG_PLUS_STORAGE_KEY,
      JSON.stringify({ runSeed: 5, ngPlusLevel: 2, artocoins: 42 })
    );
    resetArtocoinBalance();
    const balance = loadArtocoinBalance();
    expect(balance).toBe(42);
    const migratedRaw = storage.getItem(NG_PLUS_STORAGE_KEY);
    expect(migratedRaw).toBeTruthy();
    const migrated = migratedRaw ? JSON.parse(migratedRaw) : null;
    expect(migrated?.artocoins).toBeUndefined();
    expect(storage.getItem(ARTOCOIN_STORAGE_KEY)).toBe('42');
  });

  it('awards the baseline payout for an average win', () => {
    const result = calculateArtocoinPayout('win', {
      tierId: 'ember-circuit',
      runSeconds: 12.5 * 60,
      enemyKills: 150,
      tilesExplored: 85,
      rosterLosses: 0,
      difficultyScalar: 1,
      rampStageIndex: 0
    });
    expect(result.artocoins).toBe(60);
    expect(result.breakdown.lossPenalty).toBe(1);
  });

  it('caps performance multipliers for exceptional clears', () => {
    const result = calculateArtocoinPayout('win', {
      tierId: 'mythic-conclave',
      runSeconds: 7.5 * 60,
      enemyKills: 400,
      tilesExplored: 250,
      rosterLosses: 0,
      difficultyScalar: 1.45,
      rampStageIndex: 3
    });
    expect(result.artocoins).toBeGreaterThanOrEqual(150);
    expect(result.breakdown.performanceMultiplier).toBeLessThanOrEqual(1.45);
  });

  it('respects the defeat payout floor when progress is limited', () => {
    const result = calculateArtocoinPayout('lose', {
      tierId: 'aurora-ward',
      runSeconds: 2 * 60,
      enemyKills: 15,
      tilesExplored: 10,
      rosterLosses: 3,
      difficultyScalar: 1,
      rampStageIndex: 1
    });
    expect(result.artocoins).toBe(16);
    expect(result.breakdown.lossPenalty).toBe(1);
  });

  it('adds Endless Onslaught bonuses based on completed ramp stages', () => {
    const result = calculateArtocoinPayout('win', {
      tierId: 'aurora-ward',
      runSeconds: 13 * 60,
      enemyKills: 210,
      tilesExplored: 120,
      rosterLosses: 1,
      difficultyScalar: 1.6,
      rampStageIndex: 6
    });
    expect(result.breakdown.difficultyMultiplier).toBeCloseTo(1.48, 2);
    expect(result.artocoins).toBeGreaterThan(100);
  });

  it('notifies artocoin listeners when the balance resets to zero', () => {
    saveArtocoinBalance(37);

    const listener = vi.fn();
    const unsubscribe = onArtocoinChange(listener);

    resetArtocoinBalance();
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]?.[0];
    expect(event?.balance).toBe(0);
    expect(event?.delta).toBe(-37);
    expect(event?.reason).toBe('set');
  });
});
