import { buildUnitSpriteAtlas, type UnitSpriteAtlas } from './render/units/spriteAtlas.ts';

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

  const imagePromises = Object.entries(paths.images ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        images[key] = img;
        resolve();
      };
      img.onerror = () => {
        const msg = `Failed to load image: ${src}`;
        console.error(msg);
        failures.push(msg);
        resolve();
      };
      img.src = src;
    });
  });

  const soundPromises = Object.entries(paths.sounds ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve) => {
      const audio = new Audio();
      audio.oncanplaythrough = () => {
        sounds[key] = audio;
        resolve();
      };
      audio.onerror = () => {
        const msg = `Failed to load sound: ${src}`;
        console.error(msg);
        failures.push(msg);
        resolve();
      };
      audio.src = src;
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
