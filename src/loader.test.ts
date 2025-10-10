import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAssets, AssetPaths, safeLoadJSON, resolveAssetUrl } from './loader.ts';

describe('loadAssets', () => {
  const OriginalImage = globalThis.Image;
  const OriginalAudio = globalThis.Audio;

  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      width = 32;
      height = 32;
      naturalWidth = 32;
      naturalHeight = 32;
      set src(value: string) {
        setTimeout(() => {
          if (value.includes('fail')) {
            this.onerror && this.onerror(new Event('error'));
          } else {
            this.onload && this.onload();
          }
        }, 0);
      }
    }

    class MockAudio {
      src = '';
      oncanplaythrough: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      load() {
        const current = this.src;
        setTimeout(() => {
          if (current.includes('fail')) {
            this.onerror && this.onerror(new Event('error'));
          } else {
            this.oncanplaythrough && this.oncanplaythrough();
          }
        }, 0);
      }
    }

    // @ts-ignore - override globals for testing
    globalThis.Image = MockImage as any;
    // @ts-ignore - override globals for testing
    globalThis.Audio = MockAudio as any;
  });

  afterEach(() => {
    // @ts-ignore - restore original globals
    globalThis.Image = OriginalImage;
    // @ts-ignore - restore original globals
    globalThis.Audio = OriginalAudio;
  });

  it('loads all assets successfully', async () => {
    const paths: AssetPaths = {
      images: { 'unit-soldier': 'ok-image', placeholder: 'ok-placeholder' },
      sounds: { good: 'ok-sound' }
    };

    const result = await loadAssets(paths);
    expect(result.assets.images).toHaveProperty('unit-soldier');
    expect(result.assets.sounds).toHaveProperty('good');
    expect(result.failures).toHaveLength(0);
    expect(result.assets.atlases.units).not.toBeNull();
    expect(result.assets.atlases.units?.slices['unit-soldier']).toBeDefined();
  });

  it('continues when some assets fail', async () => {
    const paths: AssetPaths = {
      images: { 'unit-soldier': 'ok-image', bad: 'fail-image' },
      sounds: { good: 'ok-sound', bad: 'fail-sound' }
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await loadAssets(paths);

    expect(result.assets.images).toHaveProperty('unit-soldier');
    expect(result.assets.images).not.toHaveProperty('bad');
    expect(result.assets.sounds).toHaveProperty('good');
    expect(result.assets.sounds).not.toHaveProperty('bad');

    expect(result.failures).toContain('Failed to load image: fail-image');
    expect(result.failures).toContain('Failed to load sound: fail-sound');
    expect(result.failures).toHaveLength(2);
    const failedCalls = errorSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' && message.startsWith('Failed to load')
    );
    expect(failedCalls).toHaveLength(2);
    expect(result.assets.atlases.units).not.toBeNull();
    expect(result.assets.atlases.units?.slices['unit-soldier']).toBeDefined();
    errorSpy.mockRestore();
  });
});

describe('resolveAssetUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveAssetUrl('https://example.com/image.png', '/app/')).toBe('https://example.com/image.png');
  });

  it('returns data URIs unchanged', () => {
    const dataUri = 'data:image/png;base64,AAA=';
    expect(resolveAssetUrl(dataUri, '/app/')).toBe(dataUri);
  });

  it('prefers the original path when base is root', () => {
    expect(resolveAssetUrl('/assets/foo.png', '/')).toBe('/assets/foo.png');
  });

  it('prefixes the base path for nested deployments', () => {
    expect(resolveAssetUrl('/assets/foo.png', '/autobattles4xfinsauna/')).toBe('/autobattles4xfinsauna/assets/foo.png');
  });

  it('handles bases without trailing slash', () => {
    expect(resolveAssetUrl('/assets/foo.png', '/autobattles4xfinsauna')).toBe('/autobattles4xfinsauna/assets/foo.png');
  });

  it('prepends the repository base for GitHub Pages deployments', () => {
    expect(resolveAssetUrl('/assets/logo.png', '/autobattles4xfinsauna/')).toBe(
      '/autobattles4xfinsauna/assets/logo.png'
    );
  });

  it('normalizes relative base deployments', () => {
    expect(resolveAssetUrl('/assets/foo.png', './')).toBe('./assets/foo.png');
  });

  it('ignores relative inputs that do not start with a slash', () => {
    expect(resolveAssetUrl('assets/foo.png', '/autobattles4xfinsauna/')).toBe('assets/foo.png');
  });
});

describe('safeLoadJSON', () => {
  const originalLocalStorage: Storage | undefined = globalThis.localStorage;

  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Reflect.set(globalThis, 'localStorage', originalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });

  it('parses valid JSON', () => {
    const storage = globalThis.localStorage;
    expect(storage).toBeDefined();
    storage!.setItem('test', '{"a":1}');
    expect(safeLoadJSON<{ a: number }>('test')).toEqual({ a: 1 });
  });

  it('clears invalid JSON and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const storage = globalThis.localStorage;
    expect(storage).toBeDefined();
    storage!.setItem('test', '{oops');
    expect(safeLoadJSON('test')).toBeUndefined();
    expect(storage!.getItem('test')).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('returns undefined when localStorage is unavailable', () => {
    const original = globalThis.localStorage;
    Reflect.set(globalThis, 'localStorage', undefined);

    expect(safeLoadJSON('missing')).toBeUndefined();

    if (original) {
      Reflect.set(globalThis, 'localStorage', original);
    } else {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
});

