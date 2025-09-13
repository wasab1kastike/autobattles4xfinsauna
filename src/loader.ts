export type AssetPaths = {
  images?: Record<string, string>;
  sounds?: Record<string, string>;
};

export type LoadedAssets = {
  images: Record<string, HTMLImageElement>;
  sounds: Record<string, HTMLAudioElement>;
};

export async function loadAssets(paths: AssetPaths): Promise<LoadedAssets> {
  const images: Record<string, HTMLImageElement> = {};
  const imagePromises = Object.entries(paths.images ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        images[key] = img;
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    });
  });

  const sounds: Record<string, HTMLAudioElement> = {};
  const soundPromises = Object.entries(paths.sounds ?? {}).map(([key, src]) => {
    return new Promise<void>((resolve, reject) => {
      const audio = new Audio();
      audio.src = src;
      audio.oncanplaythrough = () => {
        sounds[key] = audio;
        resolve();
      };
      audio.onerror = () => reject(new Error(`Failed to load sound: ${src}`));
      audio.load();
    });
  });

  await Promise.all([...imagePromises, ...soundPromises]);
  return { images, sounds };
}
