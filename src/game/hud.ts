import { eventBus } from '../events';
import type { EnemyRampSummary } from '../ui/topbar.ts';
import type { RosterHudSummary } from '../ui/rosterHUD.ts';
import type { RosterEntry } from '../ui/rightPanel.tsx';

export type RosterRenderer = (entries: RosterEntry[]) => void;

type RosterSummaryListener = (summary: RosterHudSummary) => void;
type RosterEntriesListener = (entries: RosterEntry[]) => void;
type HudTimeListener = (elapsedMs: number) => void;
type EnemyRampListener = (summary: EnemyRampSummary | null) => void;

type SnapshotProvider<T> = () => T;

const rosterSummaryListeners = new Set<RosterSummaryListener>();
const rosterEntriesListeners = new Set<RosterEntriesListener>();
const hudTimeListeners = new Set<HudTimeListener>();
const enemyRampListeners = new Set<EnemyRampListener>();
const hudEventUnsubscribers = new Set<() => void>();

let rosterSummaryProvider: SnapshotProvider<RosterHudSummary> | null = null;
let rosterEntriesProvider: SnapshotProvider<RosterEntry[]> | null = null;

let pendingRosterSummary: RosterHudSummary | null = null;
let pendingRosterEntries: RosterEntry[] | null = null;
let pendingRosterRenderer: RosterRenderer | null = null;
let lastRosterSummary: RosterHudSummary | null = null;
let lastRosterEntries: RosterEntry[] = [];
let hudElapsedMs = 0;
let lastEnemyRampSummary: EnemyRampSummary | null = null;

const DEFAULT_ROSTER_SUMMARY: RosterHudSummary = { count: 0, card: null };

const getFallbackEntries = (): RosterEntry[] => [];

export const configureHudSnapshotProviders = (options: {
  getRosterSummary: SnapshotProvider<RosterHudSummary>;
  getRosterEntries: SnapshotProvider<RosterEntry[]>;
}): void => {
  rosterSummaryProvider = options.getRosterSummary;
  rosterEntriesProvider = options.getRosterEntries;
};

export const setPendingRosterRenderer = (renderer: RosterRenderer | null): void => {
  pendingRosterRenderer = renderer;
};

export const getPendingRosterRenderer = (): RosterRenderer | null => pendingRosterRenderer;

export const setPendingRosterEntries = (entries: RosterEntry[] | null): void => {
  pendingRosterEntries = entries;
};

export const getPendingRosterEntries = (): RosterEntry[] | null => pendingRosterEntries;

export const clearPendingRosterEntries = (): void => {
  pendingRosterEntries = null;
};

export const setPendingRosterSummary = (summary: RosterHudSummary | null): void => {
  pendingRosterSummary = summary;
};

export const getPendingRosterSummary = (): RosterHudSummary | null => pendingRosterSummary;

export const clearPendingRosterSummary = (): void => {
  pendingRosterSummary = null;
};

export const getLastRosterSummary = (): RosterHudSummary | null => lastRosterSummary;

export const setLastRosterSummary = (summary: RosterHudSummary | null): void => {
  lastRosterSummary = summary;
};

export const getLastRosterEntries = (): RosterEntry[] => lastRosterEntries;

export const setLastRosterEntries = (entries: RosterEntry[]): void => {
  lastRosterEntries = entries;
};

export const getHudElapsedMs = (): number => hudElapsedMs;

export const resetHudElapsedMs = (): void => {
  hudElapsedMs = 0;
  notifyHudElapsed();
};

export const addHudElapsedMs = (deltaMs: number): void => {
  if (Number.isFinite(deltaMs) && deltaMs > 0) {
    hudElapsedMs += deltaMs;
  }
  notifyHudElapsed();
};

export const getEnemyRampSummarySnapshot = (): EnemyRampSummary | null => lastEnemyRampSummary;

export const resetEnemyRampSummary = (): void => {
  notifyEnemyRamp(null);
};

const safeNotify = <T>(listeners: Set<(value: T) => void>, value: T): void => {
  for (const listener of listeners) {
    try {
      listener(value);
    } catch (error) {
      console.warn('Failed to notify HUD listener', error);
    }
  }
};

export const notifyRosterSummary = (summary: RosterHudSummary): void => {
  lastRosterSummary = summary;
  safeNotify(rosterSummaryListeners, summary);
};

export const notifyRosterEntries = (entries: RosterEntry[]): void => {
  lastRosterEntries = entries;
  safeNotify(rosterEntriesListeners, entries);
};

export const notifyHudElapsed = (): void => {
  safeNotify(hudTimeListeners, hudElapsedMs);
};

export const notifyEnemyRamp = (summary: EnemyRampSummary | null): void => {
  lastEnemyRampSummary = summary;
  safeNotify(enemyRampListeners, summary);
};

const getRosterSummaryFromProvider = (): RosterHudSummary => {
  if (lastRosterSummary) {
    return lastRosterSummary;
  }
  if (pendingRosterSummary) {
    return pendingRosterSummary;
  }
  if (rosterSummaryProvider) {
    try {
      return rosterSummaryProvider();
    } catch (error) {
      console.warn('Failed to build roster summary snapshot', error);
    }
  }
  return DEFAULT_ROSTER_SUMMARY;
};

const getRosterEntriesFromProvider = (): RosterEntry[] => {
  if (lastRosterEntries.length > 0) {
    return lastRosterEntries;
  }
  if (pendingRosterEntries && pendingRosterEntries.length > 0) {
    return pendingRosterEntries;
  }
  if (rosterEntriesProvider) {
    try {
      return rosterEntriesProvider();
    } catch (error) {
      console.warn('Failed to build roster entries snapshot', error);
    }
  }
  return getFallbackEntries();
};

export const subscribeRosterSummary = (
  listener: RosterSummaryListener
): () => void => {
  rosterSummaryListeners.add(listener);
  try {
    listener(getRosterSummaryFromProvider());
  } catch (error) {
    console.warn('Failed to deliver roster summary snapshot', error);
  }
  return () => {
    rosterSummaryListeners.delete(listener);
  };
};

export const subscribeRosterEntries = (
  listener: RosterEntriesListener
): () => void => {
  rosterEntriesListeners.add(listener);
  try {
    listener(getRosterEntriesFromProvider());
  } catch (error) {
    console.warn('Failed to deliver roster entries snapshot', error);
  }
  return () => {
    rosterEntriesListeners.delete(listener);
  };
};

export const subscribeHudTime = (listener: HudTimeListener): () => void => {
  hudTimeListeners.add(listener);
  try {
    listener(hudElapsedMs);
  } catch (error) {
    console.warn('Failed to deliver HUD time snapshot', error);
  }
  return () => {
    hudTimeListeners.delete(listener);
  };
};

export const subscribeEnemyRamp = (
  listener: EnemyRampListener
): () => void => {
  enemyRampListeners.add(listener);
  try {
    listener(lastEnemyRampSummary);
  } catch (error) {
    console.warn('Failed to deliver enemy ramp snapshot', error);
  }
  return () => {
    enemyRampListeners.delete(listener);
  };
};

export const registerHudEventListener = <T>(
  event: string,
  handler: (payload: T) => void
): () => void => {
  eventBus.on(event, handler);
  let active = true;
  const unsubscribe = () => {
    if (!active) {
      return;
    }
    active = false;
    eventBus.off(event, handler);
    hudEventUnsubscribers.delete(unsubscribe);
  };
  hudEventUnsubscribers.add(unsubscribe);
  return unsubscribe;
};

export const teardownHudEventListeners = (): void => {
  for (const unsubscribe of Array.from(hudEventUnsubscribers)) {
    try {
      unsubscribe();
    } catch (error) {
      console.warn('Failed to remove HUD event listener', error);
    }
  }
  hudEventUnsubscribers.clear();
};

export const getHudEventListenerCount = (event: string): number => {
  const listenersMap: Map<string, unknown[]> | undefined =
    (eventBus as unknown as { listeners?: Map<string, unknown[]> }).listeners;
  if (!listenersMap) {
    return 0;
  }
  const listeners = listenersMap.get(event);
  return Array.isArray(listeners) ? listeners.length : 0;
};

export const getTrackedHudListenerCount = (): number => hudEventUnsubscribers.size;

export const resetHudTracking = (): void => {
  resetHudElapsedMs();
  notifyEnemyRamp(null);
  lastRosterEntries = [];
  lastRosterSummary = null;
};
