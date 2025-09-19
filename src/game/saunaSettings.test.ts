import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SAUNA_SETTINGS_STORAGE_KEY,
  loadSaunaSettings,
  saveSaunaSettings
} from './saunaSettings.ts';

describe('saunaSettings', () => {
  beforeEach(() => {
    window.localStorage?.clear?.();
  });

  it('returns the provided default when storage is empty', () => {
    const settings = loadSaunaSettings(4);
    expect(settings.maxRosterSize).toBe(4);
  });

  it('clamps stored values to the unlock ceiling', () => {
    window.localStorage?.setItem(SAUNA_SETTINGS_STORAGE_KEY, JSON.stringify({ maxRosterSize: 99 }));
    const settings = loadSaunaSettings(1);
    expect(settings.maxRosterSize).toBe(6);
  });

  it('persists sanitized roster caps', () => {
    saveSaunaSettings({ maxRosterSize: 7 });
    const raw = window.localStorage?.getItem(SAUNA_SETTINGS_STORAGE_KEY);
    expect(raw).toBeTypeOf('string');
    const parsed = raw ? JSON.parse(raw) : null;
    expect(parsed).toEqual({ maxRosterSize: 6 });
  });

  it('handles malformed payloads gracefully', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      window.localStorage?.setItem(SAUNA_SETTINGS_STORAGE_KEY, '{not json');
      const settings = loadSaunaSettings(3);
      expect(settings.maxRosterSize).toBe(3);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
