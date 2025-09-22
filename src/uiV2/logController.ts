import type { LogChange, LogEntry } from '../ui/logging.ts';

export interface UiV2LogController {
  getSnapshot(): LogEntry[];
  subscribe(listener: (entries: LogEntry[]) => void): () => void;
  dispose(): void;
}

export interface UiV2LogControllerOptions {
  getHistory(): LogEntry[];
  subscribe(listener: (change: LogChange) => void): () => void;
}

function applyLogChange(previous: LogEntry[], change: LogChange): LogEntry[] {
  if (change.kind === 'append') {
    return [...previous, change.entry];
  }
  if (change.kind === 'update') {
    return previous.map((entry) => (entry.id === change.entry.id ? change.entry : entry));
  }
  if (change.kind === 'remove') {
    const ids = new Set(change.entries.map((entry) => entry.id));
    return previous.filter((entry) => !ids.has(entry.id));
  }
  return previous;
}

export function createUiV2LogController(options: UiV2LogControllerOptions): UiV2LogController {
  let entries = [...options.getHistory()];
  const listeners = new Set<(entries: LogEntry[]) => void>();

  const emit = () => {
    const snapshot = [...entries];
    for (const listener of listeners) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Failed to notify UI v2 log listener', error);
      }
    }
  };

  const unsubscribe = options.subscribe((change) => {
    entries = applyLogChange(entries, change);
    emit();
  });

  return {
    getSnapshot() {
      return [...entries];
    },
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener([...entries]);
      } catch (error) {
        console.warn('Failed to deliver initial UI v2 log snapshot', error);
      }
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      unsubscribe();
      listeners.clear();
    }
  } satisfies UiV2LogController;
}
