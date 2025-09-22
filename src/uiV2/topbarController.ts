import { Resource } from '../core/GameState.ts';
import type { EnemyRampSummary } from '../ui/topbar.ts';
import type { ArtocoinChangeEvent } from '../progression/artocoin.ts';

export type UiV2ResourceState = Record<Resource, { total: number; delta: number }>;

export type UiV2ArtocoinState = { total: number; delta: number };

export type UiV2TopbarSnapshot = {
  resources: UiV2ResourceState;
  artocoin: UiV2ArtocoinState;
  elapsedMs: number;
  ramp: EnemyRampSummary | null;
};

export interface UiV2TopbarController {
  getSnapshot(): UiV2TopbarSnapshot;
  subscribe(listener: (snapshot: UiV2TopbarSnapshot) => void): () => void;
  dispose(): void;
}

export interface UiV2TopbarControllerOptions {
  getResource(resource: Resource): number;
  subscribeResourceChange(
    listener: (change: { resource: Resource; total: number; amount: number }) => void
  ): () => void;
  getArtocoinBalance(): number;
  subscribeArtocoinChange(listener: (event: ArtocoinChangeEvent) => void): () => void;
  getElapsedMs(): number;
  subscribeHudTime(listener: (elapsedMs: number) => void): () => void;
  getEnemyRamp(): EnemyRampSummary | null;
  subscribeEnemyRamp(listener: (summary: EnemyRampSummary | null) => void): () => void;
}

const DELTA_RESET_MS = 1200;

export function createUiV2TopbarController(
  options: UiV2TopbarControllerOptions
): UiV2TopbarController {
  const listeners = new Set<(snapshot: UiV2TopbarSnapshot) => void>();
  let elapsedMs = options.getElapsedMs();
  let ramp = options.getEnemyRamp();
  let artocoin: UiV2ArtocoinState = {
    total: options.getArtocoinBalance(),
    delta: 0
  };
  const resources: UiV2ResourceState = {
    [Resource.SAUNA_BEER]: { total: options.getResource(Resource.SAUNA_BEER), delta: 0 },
    [Resource.SAUNAKUNNIA]: { total: options.getResource(Resource.SAUNAKUNNIA), delta: 0 },
    [Resource.SISU]: { total: options.getResource(Resource.SISU), delta: 0 }
  };

  const resourceTimers = new Map<Resource, ReturnType<typeof setTimeout>>();
  let artocoinTimer: ReturnType<typeof setTimeout> | null = null;

  const snapshot = (): UiV2TopbarSnapshot => ({
    resources: {
      [Resource.SAUNA_BEER]: { ...resources[Resource.SAUNA_BEER] },
      [Resource.SAUNAKUNNIA]: { ...resources[Resource.SAUNAKUNNIA] },
      [Resource.SISU]: { ...resources[Resource.SISU] }
    },
    artocoin: { ...artocoin },
    elapsedMs,
    ramp
  });

  const emit = () => {
    const state = snapshot();
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.warn('Failed to notify UI v2 topbar listener', error);
      }
    }
  };

  const unsubscribeResources = options.subscribeResourceChange((change) => {
    resources[change.resource] = { total: change.total, delta: change.amount };
    const existing = resourceTimers.get(change.resource);
    if (existing) {
      clearTimeout(existing);
    }
    if (change.amount !== 0) {
      const timer = setTimeout(() => {
        resources[change.resource] = { total: resources[change.resource].total, delta: 0 };
        resourceTimers.delete(change.resource);
        emit();
      }, DELTA_RESET_MS);
      resourceTimers.set(change.resource, timer);
    }
    emit();
  });

  const unsubscribeArtocoin = options.subscribeArtocoinChange((event) => {
    artocoin = { total: event.balance, delta: event.delta };
    if (artocoinTimer) {
      clearTimeout(artocoinTimer);
      artocoinTimer = null;
    }
    if (event.delta !== 0) {
      artocoinTimer = setTimeout(() => {
        artocoin = { total: artocoin.total, delta: 0 };
        artocoinTimer = null;
        emit();
      }, DELTA_RESET_MS);
    }
    emit();
  });

  const unsubscribeHudTime = options.subscribeHudTime((ms) => {
    elapsedMs = ms;
    emit();
  });

  const unsubscribeRamp = options.subscribeEnemyRamp((summary) => {
    ramp = summary;
    emit();
  });

  return {
    getSnapshot: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(snapshot());
      } catch (error) {
        console.warn('Failed to deliver initial UI v2 topbar snapshot', error);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribeResources();
      unsubscribeArtocoin();
      unsubscribeHudTime();
      unsubscribeRamp();
      for (const timer of resourceTimers.values()) {
        clearTimeout(timer);
      }
      resourceTimers.clear();
      if (artocoinTimer) {
        clearTimeout(artocoinTimer);
        artocoinTimer = null;
      }
      listeners.clear();
    }
  } satisfies UiV2TopbarController;
}
