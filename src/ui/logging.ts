/*
 * Centralized combat log store and helpers for structured HUD events.
 */

export type LogEventType =
  | 'combat'
  | 'spawn'
  | 'loot'
  | 'progression'
  | 'ability'
  | 'resource'
  | 'policy'
  | 'event'
  | 'system';

export interface LogEventMetadata {
  [key: string]: unknown;
}

export interface LogEventPayload {
  type: LogEventType;
  message: string;
  metadata?: LogEventMetadata;
}

export interface LogEntry extends LogEventPayload {
  id: string;
  timestamp: number;
  occurrences: number;
}

export type LogChange =
  | { kind: 'append'; entry: LogEntry; index: number }
  | { kind: 'update'; entry: LogEntry; index: number }
  | { kind: 'remove'; entries: LogEntry[] };

export type LogListener = (change: LogChange) => void;

export interface LogPreferences {
  mutedTypes: LogEventType[];
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface LogStoreOptions {
  storage?: StorageLike | null;
  storageKey?: string;
  maxEntries?: number;
}

interface PersistedLogEntry {
  type: LogEventType;
  message: string;
  metadata?: LogEventMetadata;
  timestamp?: number;
  occurrences?: number;
}

const DEFAULT_MAX_ENTRIES = 150;
const LOG_HISTORY_STORAGE_KEY = 'autobattles:log-history:v2';
const LOG_PREFERENCES_STORAGE_KEY = 'autobattles:log-preferences:v1';

const defaultStorage: StorageLike | null =
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
    ? window.localStorage
    : null;

let sequence = 0;

const toId = (): string => {
  sequence += 1;
  return `${Date.now().toString(36)}-${sequence.toString(36)}`;
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  return [];
};

const normalizeMetadata = (metadata: LogEventMetadata | undefined): LogEventMetadata => {
  if (!metadata) {
    return {};
  }
  if (typeof metadata !== 'object') {
    return {};
  }
  return { ...metadata };
};

const extractUnitId = (metadata: LogEventMetadata | undefined): string | null => {
  if (!metadata) {
    return null;
  }
  if (typeof metadata.unitId === 'string' && metadata.unitId.trim().length > 0) {
    return metadata.unitId.trim();
  }
  const ids = toStringArray(metadata.unitIds);
  return ids.length > 0 ? ids[ids.length - 1] : null;
};

const mergeSpawnMetadata = (
  previous: LogEventMetadata,
  next: LogEventMetadata
): LogEventMetadata => {
  const previousIds = toStringArray(previous.unitIds ?? previous.unitId);
  const nextIds = toStringArray(next.unitIds ?? next.unitId);
  const mergedIds = Array.from(new Set([...previousIds, ...nextIds]));

  const previousNames = toStringArray(previous.unitNames ?? previous.unitName);
  const nextNames = toStringArray(next.unitNames ?? next.unitName);
  const mergedNames = Array.from(new Set([...previousNames, ...nextNames]));

  const steward = typeof next.steward === 'string' ? next.steward : previous.steward;

  const merged: LogEventMetadata = {
    ...previous,
    ...next,
    unitIds: mergedIds,
    unitNames: mergedNames
  };

  if (typeof steward === 'string') {
    merged.steward = steward;
  }

  if (mergedNames.length > 0) {
    merged.unitName = mergedNames[mergedNames.length - 1];
  }

  if (mergedIds.length > 0) {
    merged.unitId = mergedIds[mergedIds.length - 1];
  }

  return merged;
};

export class LogStore {
  private history: LogEntry[] = [];

  private readonly listeners = new Set<LogListener>();

  private readonly storage: StorageLike | null;

  private readonly storageKey: string;

  private readonly maxEntries: number;

  constructor(options: LogStoreOptions = {}) {
    this.storage = options.storage ?? defaultStorage;
    this.storageKey = options.storageKey ?? LOG_HISTORY_STORAGE_KEY;
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.hydrate();
  }

  private hydrate(): void {
    if (!this.storage) {
      return;
    }
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return;
      }
      const restored: LogEntry[] = [];
      for (const item of parsed) {
        if (!item || typeof item !== 'object') {
          continue;
        }
        const candidate = item as PersistedLogEntry & { id?: string };
        if (typeof candidate.type !== 'string' || typeof candidate.message !== 'string') {
          continue;
        }
        const entry: LogEntry = {
          id: typeof candidate.id === 'string' ? candidate.id : toId(),
          type: candidate.type as LogEventType,
          message: candidate.message,
          metadata: normalizeMetadata(candidate.metadata),
          timestamp:
            typeof candidate.timestamp === 'number' && Number.isFinite(candidate.timestamp)
              ? candidate.timestamp
              : Date.now(),
          occurrences:
            typeof candidate.occurrences === 'number' && candidate.occurrences > 0
              ? Math.floor(candidate.occurrences)
              : 1
        };
        restored.push(entry);
      }
      if (restored.length > 0) {
        if (restored.length > this.maxEntries) {
          this.history = restored.slice(-this.maxEntries);
        } else {
          this.history = restored;
        }
      }
    } catch {
      this.history = [];
    }
  }

  private persist(): void {
    if (!this.storage) {
      return;
    }
    try {
      const serialized = JSON.stringify(
        this.history.map((entry) => ({
          id: entry.id,
          type: entry.type,
          message: entry.message,
          metadata: entry.metadata,
          timestamp: entry.timestamp,
          occurrences: entry.occurrences
        }))
      );
      this.storage.setItem(this.storageKey, serialized);
    } catch {
      // Ignore storage failures.
    }
  }

  getHistory(): LogEntry[] {
    return this.history.map((entry) => ({
      ...entry,
      metadata: normalizeMetadata(entry.metadata)
    }));
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  clear(): void {
    if (this.history.length === 0) {
      return;
    }
    const removed = this.history.slice();
    this.history = [];
    this.persist();
    this.emitChange({ kind: 'remove', entries: removed });
  }

  emit(payload: LogEventPayload): LogEntry {
    const metadata = normalizeMetadata(payload.metadata);
    const entry: LogEntry = {
      id: toId(),
      type: payload.type,
      message: payload.message,
      metadata,
      timestamp: Date.now(),
      occurrences: 1
    };

    const aggregated = this.tryAggregate(entry);
    if (aggregated) {
      this.history[aggregated.index] = aggregated.entry;
      this.persist();
      this.emitChange({ kind: 'update', entry: aggregated.entry, index: aggregated.index });
      return aggregated.entry;
    }

    this.history.push(entry);
    const trimmed: LogEntry[] = [];
    while (this.history.length > this.maxEntries) {
      const removed = this.history.shift();
      if (removed) {
        trimmed.push(removed);
      }
    }
    this.persist();
    if (trimmed.length > 0) {
      this.emitChange({ kind: 'remove', entries: trimmed });
    }
    const index = this.history.length - 1;
    this.emitChange({ kind: 'append', entry, index });
    return entry;
  }

  private tryAggregate(entry: LogEntry): { entry: LogEntry; index: number } | null {
    if (entry.type !== 'spawn') {
      return null;
    }
    const unitId = extractUnitId(entry.metadata);
    if (!unitId) {
      return null;
    }
    if (this.history.length === 0) {
      return null;
    }
    const index = this.history.length - 1;
    const previous = this.history[index];
    if (previous.type !== 'spawn') {
      return null;
    }
    const merged: LogEntry = {
      ...previous,
      id: previous.id,
      message: entry.message,
      metadata: mergeSpawnMetadata(previous.metadata ?? {}, entry.metadata ?? {}),
      timestamp: entry.timestamp,
      occurrences: previous.occurrences + entry.occurrences
    };
    return { entry: merged, index };
  }

  private emitChange(change: LogChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.warn('Failed to handle log change', error);
      }
    }
  }
}

export const logStore = new LogStore();

export const logEvent = (payload: LogEventPayload): LogEntry => logStore.emit(payload);

export const subscribeToLogs = (listener: LogListener): (() => void) =>
  logStore.subscribe(listener);

export const getLogHistory = (): LogEntry[] => logStore.getHistory();

export const clearLogs = (): void => logStore.clear();

export const LOG_EVENT_META: Record<LogEventType, { label: string; accent: string }> = {
  combat: { label: 'Combat', accent: 'var(--color-accent-red)' },
  spawn: { label: 'Reinforcements', accent: 'var(--color-accent-green)' },
  loot: { label: 'Loot', accent: 'var(--color-accent-gold)' },
  progression: { label: 'Progression', accent: 'var(--color-accent-blue)' },
  ability: { label: 'Abilities', accent: 'var(--color-accent-purple)' },
  resource: { label: 'Economy', accent: 'var(--color-accent-cyan)' },
  policy: { label: 'Policies', accent: 'var(--color-accent-orange)' },
  event: { label: 'Events', accent: 'var(--color-accent-pink)' },
  system: { label: 'Systems', accent: 'var(--color-muted)' }
};

export const LOG_EVENT_ORDER: LogEventType[] = [
  'combat',
  'spawn',
  'loot',
  'progression',
  'ability',
  'resource',
  'policy',
  'event',
  'system'
];

const defaultPreferences: LogPreferences = { mutedTypes: [] };

export const readLogPreferences = (storage: StorageLike | null = defaultStorage): LogPreferences => {
  if (!storage) {
    return { ...defaultPreferences };
  }
  try {
    const raw = storage.getItem(LOG_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...defaultPreferences };
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...defaultPreferences };
    }
    const muted = Array.isArray(parsed.mutedTypes)
      ? parsed.mutedTypes.filter((value: unknown): value is LogEventType =>
          typeof value === 'string' && value in LOG_EVENT_META
        )
      : [];
    return { mutedTypes: Array.from(new Set(muted)) };
  } catch {
    return { ...defaultPreferences };
  }
};

export const writeLogPreferences = (
  preferences: LogPreferences,
  storage: StorageLike | null = defaultStorage
): void => {
  if (!storage) {
    return;
  }
  try {
    const muted = Array.isArray(preferences.mutedTypes)
      ? preferences.mutedTypes.filter((value): value is LogEventType => value in LOG_EVENT_META)
      : [];
    storage.setItem(
      LOG_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ mutedTypes: Array.from(new Set(muted)) })
    );
  } catch {
    // Ignore storage failures.
  }
};
