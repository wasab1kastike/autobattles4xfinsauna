import type { EnemyRampSummary } from '../../ui/topbar.ts';

export type SignalListener<T> = (value: T) => void;

export interface ObservableSignal<T> {
  subscribe(listener: SignalListener<T>, options?: { emitCurrent?: boolean }): () => void;
  unsubscribe(listener: SignalListener<T>): void;
  set(value: T): void;
  notify(value: T): void;
  getSnapshot(): T;
  dispose(): void;
}

function createObservableSignal<T>(initialValue: T, options: { label: string }): ObservableSignal<T> {
  let current = initialValue;
  const listeners = new Set<SignalListener<T>>();
  const { label } = options;

  function subscribe(
    listener: SignalListener<T>,
    { emitCurrent = true }: { emitCurrent?: boolean } = {}
  ): () => void {
    listeners.add(listener);

    if (emitCurrent) {
      try {
        listener(current);
      } catch (error) {
        console.warn(`Failed to deliver ${label} snapshot`, error);
      }
    }

    return () => {
      unsubscribe(listener);
    };
  }

  function unsubscribe(listener: SignalListener<T>): void {
    listeners.delete(listener);
  }

  function set(value: T): void {
    current = value;
  }

  function notify(value: T): void {
    current = value;
    for (const listener of listeners) {
      try {
        listener(current);
      } catch (error) {
        console.warn(`Failed to deliver ${label} update`, error);
      }
    }
  }

  function getSnapshot(): T {
    return current;
  }

  function dispose(): void {
    listeners.clear();
  }

  return {
    subscribe,
    unsubscribe,
    set,
    notify,
    getSnapshot,
    dispose
  } satisfies ObservableSignal<T>;
}

const hudTimeSignal = createObservableSignal<number>(0, { label: 'HUD time' });
let hudElapsedMs = 0;

export function setHudElapsedMs(value: number): void {
  hudElapsedMs = value;
  hudTimeSignal.set(value);
}

export function incrementHudElapsedMs(deltaMs: number): number {
  hudElapsedMs += deltaMs;
  hudTimeSignal.set(hudElapsedMs);
  return hudElapsedMs;
}

export function getHudElapsedMs(): number {
  return hudElapsedMs;
}

export function notifyHudElapsed(value: number): void {
  hudElapsedMs = value;
  hudTimeSignal.notify(value);
}

export function subscribeHudTime(
  listener: SignalListener<number>,
  options?: { emitCurrent?: boolean }
): () => void {
  return hudTimeSignal.subscribe(listener, options);
}

export function unsubscribeHudTime(listener: SignalListener<number>): void {
  hudTimeSignal.unsubscribe(listener);
}

const enemyRampSignal = createObservableSignal<EnemyRampSummary | null>(null, {
  label: 'enemy ramp'
});
let enemyRampSnapshot: EnemyRampSummary | null = null;

export function notifyEnemyRamp(summary: EnemyRampSummary | null): void {
  enemyRampSnapshot = summary;
  enemyRampSignal.notify(summary);
}

export function getEnemyRampSummarySnapshot(): EnemyRampSummary | null {
  return enemyRampSnapshot;
}

export function subscribeEnemyRamp(
  listener: SignalListener<EnemyRampSummary | null>,
  options?: { emitCurrent?: boolean }
): () => void {
  return enemyRampSignal.subscribe(listener, options);
}

export function unsubscribeEnemyRamp(listener: SignalListener<EnemyRampSummary | null>): void {
  enemyRampSignal.unsubscribe(listener);
}

export function disposeHudSignals(): void {
  hudTimeSignal.dispose();
  enemyRampSignal.dispose();
}
