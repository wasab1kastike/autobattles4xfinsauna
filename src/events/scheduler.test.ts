import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventScheduler, SCHEDULER_EVENTS } from './scheduler.ts';
import { EventBus } from './EventBus.ts';

class MemoryStorage implements Storage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('EventScheduler', () => {
  let storage: MemoryStorage;
  let eventBus: EventBus;

  beforeEach(() => {
    storage = new MemoryStorage();
    eventBus = new EventBus();
    vi.stubGlobal('localStorage', storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('persists active events across reloads', () => {
    const scheduler = new EventScheduler({
      storageKey: 'test:scheduler',
      eventBus,
      storageProvider: () => storage
    });
    let activeCount = 0;
    scheduler.subscribe((events) => {
      activeCount = events.length;
    });
    scheduler.schedule({
      content: {
        id: 'alpha',
        headline: 'Aurora Looms',
        body: 'An ethereal shimmer dances above the sauna roofs.'
      },
      trigger: { type: 'time', in: 5 }
    });
    scheduler.tick(2);
    expect(activeCount).toBe(0);
    scheduler.tick(3);
    expect(activeCount).toBe(1);

    const restored = new EventScheduler({
      storageKey: 'test:scheduler',
      eventBus,
      storageProvider: () => storage
    });
    const restoredEvents = restored.getActiveEvents();
    expect(restoredEvents).toHaveLength(1);
    expect(restoredEvents[0]?.id).toBe('alpha');
    expect(restoredEvents[0]?.headline).toBe('Aurora Looms');
  });

  it('resolves choices only once and dispatches outcomes', () => {
    const scheduler = new EventScheduler({
      storageKey: 'test:scheduler-choices',
      eventBus,
      storageProvider: () => storage
    });
    const triggered = vi.fn();
    const resolved = vi.fn();
    const outcome = vi.fn();

    eventBus.on(SCHEDULER_EVENTS.TRIGGERED, triggered);
    eventBus.on(SCHEDULER_EVENTS.RESOLVED, resolved);
    eventBus.on('custom:reward', outcome);

    scheduler.publish({
      id: 'choice-event',
      headline: 'Steam Summit',
      body: 'Delegates await your decree.',
      choices: [
        {
          id: 'reward',
          label: 'Grant Boon',
          event: 'custom:reward',
          payload: { prestige: 5 }
        }
      ]
    });

    expect(triggered).toHaveBeenCalledTimes(1);
    const first = scheduler.resolve('choice-event', 'reward');
    const second = scheduler.resolve('choice-event', 'reward');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(resolved).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledTimes(1);
    expect(outcome).toHaveBeenCalledWith({
      eventId: 'choice-event',
      choiceId: 'reward',
      payload: { prestige: 5 },
      event: expect.objectContaining({ id: 'choice-event' })
    });
  });
});
