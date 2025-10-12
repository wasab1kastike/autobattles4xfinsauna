import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAUNA_SETTINGS_STORAGE_KEY,
  loadSaunaSettings,
  saveSaunaSettings
} from './saunaSettings.ts';
import { DEFAULT_SAUNA_TIER_ID, SAUNA_TIERS } from '../sauna/tiers.ts';

describe('saunaSettings', () => {
  beforeEach(() => {
    window.localStorage?.clear?.();
  });

  it('returns the provided default when storage is empty', () => {
    const settings = loadSaunaSettings(4);
    expect(settings.maxRosterSize).toBe(3);
    expect(settings.activeTierId).toBe(DEFAULT_SAUNA_TIER_ID);
  });

  it('clamps stored values to the unlock ceiling', () => {
    window.localStorage?.setItem(
      SAUNA_SETTINGS_STORAGE_KEY,
      JSON.stringify({ maxRosterSize: 99, activeTierId: 'mythic-conclave' })
    );
    const settings = loadSaunaSettings(1);
    expect(settings.maxRosterSize).toBe(1);
    expect(settings.activeTierId).toBe('mythic-conclave');
  });

  it('persists sanitized roster caps', () => {
    saveSaunaSettings({ maxRosterSize: 7, activeTierId: 'mythic-conclave' });
    const raw = window.localStorage?.getItem(SAUNA_SETTINGS_STORAGE_KEY);
    expect(raw).toBeTypeOf('string');
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed).toEqual({ maxRosterSize: 6, activeTierId: 'mythic-conclave' });
  });

  it('handles malformed payloads gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      window.localStorage?.setItem(SAUNA_SETTINGS_STORAGE_KEY, '{not json');
      const settings = loadSaunaSettings(3);
      expect(settings.maxRosterSize).toBe(3);
      expect(settings.activeTierId).toBe(DEFAULT_SAUNA_TIER_ID);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('falls back to the default tier when an unknown id is stored', () => {
    window.localStorage?.setItem(
      SAUNA_SETTINGS_STORAGE_KEY,
      JSON.stringify({ maxRosterSize: 3, activeTierId: 'unknown-tier' })
    );
    const settings = loadSaunaSettings(4);
    expect(settings.activeTierId).toBe(DEFAULT_SAUNA_TIER_ID);
    expect(settings.maxRosterSize).toBe(3);
  });

  it('respects tier roster caps when loading', () => {
    const premium = SAUNA_TIERS.find((tier) => tier.id === 'aurora-ward');
    expect(premium).toBeDefined();
    window.localStorage?.setItem(
      SAUNA_SETTINGS_STORAGE_KEY,
      JSON.stringify({ maxRosterSize: 99, activeTierId: premium?.id })
    );
    const settings = loadSaunaSettings(10);
    expect(settings.maxRosterSize).toBe(premium?.rosterCap ?? 4);
  });
});
