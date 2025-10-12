import { safeLoadJSON } from '../../loader.ts';

export interface StructuredTelemetryEntry {
  readonly event: string;
  readonly timestamp: number;
  readonly payload: Record<string, unknown>;
}

function storageOrNull(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch (error) {
    console.warn('Structured telemetry storage unavailable', error);
    return null;
  }
}

export function emitStructuredTelemetry(
  event: string,
  payload: Record<string, unknown>
): StructuredTelemetryEntry {
  const entry: StructuredTelemetryEntry = {
    event,
    timestamp: Date.now(),
    payload: { ...payload }
  };
  if (import.meta.env.PROD) {
    console.info(event, entry);
  } else {
    console.debug(`[telemetry] ${event}`, entry);
  }
  return entry;
}

export interface PersistOptions {
  readonly limit?: number;
}

export function persistStructuredTelemetry(
  storageKey: string,
  entry: StructuredTelemetryEntry,
  options: PersistOptions = {}
): void {
  const storage = storageOrNull();
  if (!storage) {
    return;
  }
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 16)) : 16;
  const existing = safeLoadJSON<StructuredTelemetryEntry[]>(storageKey) ?? [];
  const merged = [...existing, entry].slice(-limit);
  try {
    storage.setItem(storageKey, JSON.stringify(merged));
  } catch (error) {
    console.warn('Failed to persist structured telemetry', { storageKey, error });
  }
}
