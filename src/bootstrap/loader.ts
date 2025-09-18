import type { AssetPaths, AssetLoadResult, LoadedAssets } from '../loader.ts';
import { loadResources } from '../lib/loadResources.ts';

export type LoaderStatusEvent =
  | { type: 'status'; phase: 'start' | 'progress'; message: string }
  | { type: 'ready'; assets: LoadedAssets; warnings: string[]; errors: string[] }
  | { type: 'warnings'; warnings: string[] }
  | { type: 'errors'; errors: string[] }
  | { type: 'fatal'; messages: string[] }
  | { type: 'failure'; error: unknown; message: string }
  | { type: 'cancelled' };

export interface BootstrapLoaderOptions {
  assetPaths: AssetPaths;
  loadAssets(paths: AssetPaths): Promise<AssetLoadResult>;
  preloadSaunojaIcon(): Promise<unknown>;
  setAssets(assets: LoadedAssets): void;
  startGame(): void;
  formatError?(reason: unknown): string;
  shouldAbort?(runToken: number): boolean;
}

type Listener = (event: LoaderStatusEvent) => void;

const DEFAULT_START_MESSAGE = 'Heating the sauna stones…';
const DEFAULT_PROGRESS_MESSAGE = 'Polishing sauna ambience…';

function defaultFormatError(reason: unknown): string {
  if (reason instanceof Error && reason.message) {
    return reason.message;
  }
  if (typeof reason === 'string' && reason.trim().length > 0) {
    return reason;
  }
  try {
    return JSON.stringify(reason);
  } catch {
    return String(reason);
  }
}

export function createBootstrapLoader(options: BootstrapLoaderOptions) {
  const listeners = new Set<Listener>();

  const emit = (event: LoaderStatusEvent) => {
    listeners.forEach((listener) => listener(event));
  };

  const formatError = options.formatError ?? defaultFormatError;

  const run = async (runToken: number): Promise<void> => {
    emit({ type: 'status', phase: 'start', message: DEFAULT_START_MESSAGE });

    try {
      const { resources, warnings, errors } = await loadResources({
        assets: {
          label: 'Core assets',
          load: async () => {
            const result = await options.loadAssets(options.assetPaths);
            return { value: result.assets, errors: result.failures };
          },
        },
        saunojaIcon: {
          label: 'Saunoja icon',
          load: async () => {
            try {
              await options.preloadSaunojaIcon();
              return { value: true };
            } catch (error) {
              return {
                value: false,
                warnings: [`Unable to preload Saunoja icon (${formatError(error)})`],
              };
            }
          },
        },
      });

      if (options.shouldAbort?.(runToken)) {
        emit({ type: 'cancelled' });
        return;
      }

      emit({ type: 'status', phase: 'progress', message: DEFAULT_PROGRESS_MESSAGE });

      const loadedAssets = resources.assets;
      if (!loadedAssets) {
        const fatalMessages = errors.length
          ? [...errors]
          : ['Critical assets were unavailable. Please refresh to try again.'];
        emit({ type: 'fatal', messages: fatalMessages });
        return;
      }

      if (errors.length) {
        emit({ type: 'errors', errors });
      }

      if (warnings.length) {
        emit({ type: 'warnings', warnings });
      }

      options.setAssets(loadedAssets);
      if (options.shouldAbort?.(runToken)) {
        emit({ type: 'cancelled' });
        return;
      }

      options.startGame();
      emit({ type: 'ready', assets: loadedAssets, warnings, errors });
    } catch (error) {
      if (options.shouldAbort?.(runToken)) {
        emit({ type: 'cancelled' });
        return;
      }
      emit({ type: 'failure', error, message: formatError(error) });
    }
  };

  const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return {
    run,
    subscribe,
  };
}
