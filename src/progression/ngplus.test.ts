import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  DEFAULT_NGPLUS_STATE,
  createNgPlusState,
  ensureNgPlusRunState,
  getAiAggressionModifier,
  getEliteOdds,
  getUnlockSpawnLimit,
  getUpkeepMultiplier,
  loadNgPlusState,
  planNextNgPlusRun,
  saveNgPlusState
} from './ngplus.ts';

declare global {
  // eslint-disable-next-line no-var
  var window: Window | undefined;
}

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
  return storage;
}

describe('ngplus progression helpers', () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hydrates defaults with a generated run seed when storage is empty', () => {
    const random = () => 0.25;
    const state = loadNgPlusState(random);
    expect(state.ngPlusLevel).toBe(0);
    expect(state.unlockSlots).toBe(0);
    expect(state.runSeed).not.toBe(0);
  });

  it('persists sanitized NG+ state', () => {
    const storage = window?.localStorage as MemoryStorage;
    saveNgPlusState(createNgPlusState({ runSeed: 7, ngPlusLevel: 3, unlockSlots: 4 }));
    const raw = storage.getItem('progression:ngPlusState');
    expect(raw).toBeTruthy();
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed).toEqual({ runSeed: 7, ngPlusLevel: 3, unlockSlots: 4 });
    const restored = loadNgPlusState(() => 0.5);
    expect(restored.ngPlusLevel).toBe(3);
    expect(restored.unlockSlots).toBe(4);
    expect(restored.runSeed).toBe(7);
  });

  it('advances to the next NG+ run after a victory', () => {
    const base = ensureNgPlusRunState(createNgPlusState({ runSeed: 11, ngPlusLevel: 2, unlockSlots: 1 }));
    const next = planNextNgPlusRun(base, { outcome: 'win', random: () => 0.9 });
    expect(next.ngPlusLevel).toBe(3);
    expect(next.unlockSlots).toBe(2);
    expect(next.runSeed).not.toBe(base.runSeed);
  });

  it('computes modifier helpers from the current NG+ state', () => {
    const state = createNgPlusState({ runSeed: 19, ngPlusLevel: 4, unlockSlots: 3 });
    expect(getUpkeepMultiplier(state)).toBeCloseTo(1 + 4 * 0.12 + 3 * 0.02);
    expect(getEliteOdds(state)).toBeCloseTo(0.1 + 4 * 0.05 + 3 * 0.01);
    expect(getAiAggressionModifier(state)).toBeCloseTo(1 + 4 * 0.25);
    expect(getUnlockSpawnLimit(state)).toBe(1 + 3);
  });

  it('clamps unlock slots when advancing repeatedly', () => {
    let state = DEFAULT_NGPLUS_STATE;
    for (let index = 0; index < 10; index += 1) {
      state = planNextNgPlusRun(state, { outcome: 'win', random: () => 0.33 });
    }
    expect(state.unlockSlots).toBeLessThanOrEqual(5);
  });
});
