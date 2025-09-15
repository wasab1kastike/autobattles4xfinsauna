import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadAssets, AssetPaths, safeLoadJSON } from './loader.ts';

describe('loadAssets', () => {
  const OriginalImage = globalThis.Image;
  const OriginalAudio = globalThis.Audio;

  beforeEach(() => {
    class MockImage {
      onload: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
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
      images: { good: 'ok-image' },
      sounds: { good: 'ok-sound' }
    };

    const result = await loadAssets(paths);
    expect(result.assets.images).toHaveProperty('good');
    expect(result.assets.sounds).toHaveProperty('good');
    expect(result.failures).toHaveLength(0);
  });

  it('continues when some assets fail', async () => {
    const paths: AssetPaths = {
      images: { good: 'ok-image', bad: 'fail-image' },
      sounds: { good: 'ok-sound', bad: 'fail-sound' }
    };

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await loadAssets(paths);

    expect(result.assets.images).toHaveProperty('good');
    expect(result.assets.images).not.toHaveProperty('bad');
    expect(result.assets.sounds).toHaveProperty('good');
    expect(result.assets.sounds).not.toHaveProperty('bad');

    expect(result.failures).toContain('Failed to load image: fail-image');
    expect(result.failures).toContain('Failed to load sound: fail-sound');
    expect(result.failures).toHaveLength(2);
    expect(errorSpy).toHaveBeenCalledTimes(2);
    errorSpy.mockRestore();
  });
});

describe('safeLoadJSON', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('parses valid JSON', () => {
    localStorage.setItem('test', '{"a":1}');
    expect(safeLoadJSON<{ a: number }>('test')).toEqual({ a: 1 });
  });

  it('clears invalid JSON and warns', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem('test', '{oops');
    expect(safeLoadJSON('test')).toBeUndefined();
    expect(localStorage.getItem('test')).toBeNull();
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });
});

