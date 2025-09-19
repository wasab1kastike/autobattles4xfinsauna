import { MAX_UNLOCK_SLOTS } from '../progression/ngplus.ts';

export interface SaunaSettings {
  maxRosterSize: number;
}

export const SAUNA_SETTINGS_STORAGE_KEY = 'autobattles:sauna-settings';

function getStorage(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
    return globalWithStorage.localStorage ?? null;
  } catch {
    return null;
  }
}

function sanitizeCap(value: unknown, fallback: number): number {
  const base = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const cap = Math.max(0, Math.floor(base));
  const maxUnlock = 1 + MAX_UNLOCK_SLOTS;
  return Math.max(0, Math.min(maxUnlock, cap));
}

export function loadSaunaSettings(defaultCap: number): SaunaSettings {
  const storage = getStorage();
  if (!storage) {
    return { maxRosterSize: sanitizeCap(defaultCap, defaultCap) };
  }

  try {
    const raw = storage.getItem(SAUNA_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { maxRosterSize: sanitizeCap(defaultCap, defaultCap) };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { maxRosterSize: sanitizeCap(defaultCap, defaultCap) };
    }
    const record = parsed as Record<string, unknown>;
    return { maxRosterSize: sanitizeCap(record.maxRosterSize, defaultCap) };
  } catch (error) {
    console.warn('Failed to load sauna settings from storage', error);
    return { maxRosterSize: sanitizeCap(defaultCap, defaultCap) };
  }
}

export function saveSaunaSettings(settings: SaunaSettings): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const payload: SaunaSettings = {
    maxRosterSize: sanitizeCap(settings.maxRosterSize, settings.maxRosterSize)
  };
  try {
    storage.setItem(SAUNA_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist sauna settings', error);
  }
}
