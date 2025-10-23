import { describe, expect, it, beforeEach } from 'vitest';
import {
  PERSISTENCE_STORAGE_KEYS,
  STORAGE_RESET_SENTINEL_KEY,
  STORAGE_RESET_SENTINEL_VALUE,
  resetCorruptedSaves
} from './resetCorruptedSaves.ts';

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
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

describe('resetCorruptedSaves', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('clears persisted game data and records the sentinel', () => {
    for (const key of PERSISTENCE_STORAGE_KEYS) {
      storage.setItem(key, 'stale');
    }

    const result = resetCorruptedSaves({ storage });

    expect(result.reset).toBe(true);
    expect(result.clearedKeys).toEqual(PERSISTENCE_STORAGE_KEYS);

    for (const key of PERSISTENCE_STORAGE_KEYS) {
      expect(storage.getItem(key)).toBeNull();
    }
    expect(storage.getItem(STORAGE_RESET_SENTINEL_KEY)).toBe(STORAGE_RESET_SENTINEL_VALUE);
  });

  it('skips subsequent resets once the sentinel is present', () => {
    storage.setItem(STORAGE_RESET_SENTINEL_KEY, STORAGE_RESET_SENTINEL_VALUE);
    storage.setItem(PERSISTENCE_STORAGE_KEYS[0] ?? 'fallback', 'active');

    const result = resetCorruptedSaves({ storage });

    expect(result.reset).toBe(false);
    expect(result.clearedKeys).toEqual([]);
    expect(storage.getItem(PERSISTENCE_STORAGE_KEYS[0] ?? 'fallback')).toBe('active');
  });

  it('gracefully no-ops when local storage is unavailable', () => {
    const result = resetCorruptedSaves({ storage: null });
    expect(result.reset).toBe(false);
    expect(result.clearedKeys).toEqual([]);
  });
});
