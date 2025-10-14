import { buildUnitSpriteAtlas, type UnitSpriteAtlas } from './render/units/spriteAtlas.ts';

const DEFAULT_BASE_URL = import.meta.env.BASE_URL ?? '/';
const ABSOLUTE_PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z+\-.]*:/;

export function resolveAssetUrl(src: string, base: string = DEFAULT_BASE_URL): string {
  if (!src) {
    return src;
  }

  if (ABSOLUTE_PROTOCOL_PATTERN.test(src) || src.startsWith('//') || src.startsWith('data:')) {
    return src;
  }

  if (!src.startsWith('/')) {
    if (base === './' && src.startsWith('./')) {
      return src;
    }

    return src;
  }

  if (base === '/' || base === '') {
    return src;
  }

  if (base === './') {
    const normalized = src.slice(1);
    return `./${normalized}`;
  }

  if (src.startsWith(base)) {
    return src;
  }

  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${trimmedBase}${src}`;
}

export type AssetPaths = {
  images?: Record<string, string>;
  sounds?: Record<string, string>;
};

export type LoadedAtlases = {
  units: UnitSpriteAtlas | null;
};

export type LoadedAssets = {
  images: Record<string, HTMLImageElement>;
  sounds: Record<string, HTMLAudioElement>;
  atlases: LoadedAtlases;
};

export type AssetLoadResult = {
  assets: LoadedAssets;
  failures: string[];
};

export async function loadAssets(paths: AssetPaths): Promise<AssetLoadResult> {
  const images: Record<string, HTMLImageElement> = {};
  const sounds: Record<string, HTMLAudioElement> = {};
  const failures: string[] = [];

  const getPlaceholderImage = (() => {
    let memoized: HTMLImageElement | null = null;
    return () => {
      if (memoized) {
        return memoized;
      }

      const placeholder = new Image();
      const placeholderSrc = paths.images?.placeholder;
      if (placeholderSrc) {
        placeholder.src = resolveAssetUrl(placeholderSrc);
      } else {
        placeholder.src =
          'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
      }

      memoized = placeholder;
      return memoized;
    };
  })();

  const imagePromises = Object.entries(paths.images ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve) => {
      const resolvedSrc = resolveAssetUrl(src);
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        resolve();
      };
      img.onerror = () => {
        const msg = `Failed to load image: ${resolvedSrc}`;
        console.error(msg);
        failures.push(msg);
        images[key] = getPlaceholderImage();
        resolve();
      };
      img.src = resolvedSrc;
    });
  });

  const soundPromises = Object.entries(paths.sounds ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve) => {
      const resolvedSrc = resolveAssetUrl(src);
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        sounds[key] = audio;
        resolve();
      };
      audio.onerror = () => {
        const msg = `Failed to load sound: ${resolvedSrc}`;
        console.error(msg);
        failures.push(msg);
        resolve();
      };
      audio.src = resolvedSrc;
      audio.load();
    });
  });

  await Promise.all([...imagePromises, ...soundPromises]);

  const unitAtlas = buildUnitSpriteAtlas(images);

  return {
    assets: {
      images,
      sounds,
      atlases: { units: unitAtlas }
    },
    failures
  } satisfies AssetLoadResult;
}

/**
 * Safely load and parse JSON from localStorage. If parsing fails, the
 * corrupted entry is removed and a warning is emitted. Returns undefined when
 * the key is absent or invalid.
 */
export function safeLoadJSON<T>(key: string): T | undefined {
  if (typeof globalThis.localStorage === 'undefined') {
    return undefined;
  }

  const raw = globalThis.localStorage.getItem(key);
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Failed to parse data for "${key}", clearing`, err);
    globalThis.localStorage.removeItem(key);
    return undefined;
  }
}
