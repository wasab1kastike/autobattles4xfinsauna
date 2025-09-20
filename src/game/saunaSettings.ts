import { MAX_UNLOCK_SLOTS } from '../progression/ngplus.ts';
import {
  DEFAULT_SAUNA_TIER_ID,
  getSaunaTier,
  type SaunaTierId
} from '../sauna/tiers.ts';

export interface SaunaSettings {
  maxRosterSize: number;
  activeTierId: SaunaTierId;
  useUiV2: boolean;
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

function sanitizeTierId(value: unknown): SaunaTierId {
  if (typeof value === 'string') {
    return getSaunaTier(value).id;
  }
  return DEFAULT_SAUNA_TIER_ID;
}

function sanitizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }
  return Math.max(0, Math.floor(limit));
}

function resolveEffectiveLimit(tierCap: number, defaultCap: number): number {
  const sanitizedTierCap = sanitizeLimit(tierCap);
  const sanitizedDefault = sanitizeLimit(defaultCap);
  const maxUnlock = 1 + MAX_UNLOCK_SLOTS;
  return Math.max(0, Math.min(maxUnlock, sanitizedTierCap, sanitizedDefault));
}

function sanitizeCap(value: unknown, fallback: number, limit: number): number {
  const safeLimit = resolveEffectiveLimit(limit, limit);
  const base = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const cap = Math.max(0, Math.floor(base));
  return Math.max(0, Math.min(safeLimit, cap));
}

function sanitizeUseUiV2(value: unknown): boolean {
  return value === true || value === 'true';
}

function sanitizeSettings(
  record: Partial<Record<keyof SaunaSettings, unknown>> | null,
  defaultCap: number
): SaunaSettings {
  const tierId = sanitizeTierId(record?.activeTierId);
  const tier = getSaunaTier(tierId);
  const limit = resolveEffectiveLimit(tier.rosterCap, defaultCap);
  return {
    activeTierId: tier.id,
    maxRosterSize: sanitizeCap(record?.maxRosterSize, limit, limit),
    useUiV2: sanitizeUseUiV2(record?.useUiV2)
  } satisfies SaunaSettings;
}

export function loadSaunaSettings(defaultCap = 1 + MAX_UNLOCK_SLOTS): SaunaSettings {
  const storage = getStorage();
  if (!storage) {
    return sanitizeSettings(null, defaultCap);
  }

  try {
    const raw = storage.getItem(SAUNA_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return sanitizeSettings(null, defaultCap);
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return sanitizeSettings(null, defaultCap);
    }
    const record = parsed as Record<string, unknown>;
    return sanitizeSettings(record, defaultCap);
  } catch (error) {
    console.warn('Failed to load sauna settings from storage', error);
    return sanitizeSettings(null, defaultCap);
  }
}

export function saveSaunaSettings(settings: SaunaSettings): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  const tier = getSaunaTier(settings.activeTierId);
  const tierLimit = resolveEffectiveLimit(tier.rosterCap, tier.rosterCap);
  const payload: SaunaSettings = {
    activeTierId: tier.id,
    maxRosterSize: sanitizeCap(settings.maxRosterSize, tierLimit, tierLimit),
    useUiV2: sanitizeUseUiV2(settings.useUiV2)
  } satisfies SaunaSettings;
  try {
    storage.setItem(SAUNA_SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist sauna settings', error);
  }
}
