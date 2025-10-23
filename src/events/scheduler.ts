import { eventBus as globalEventBus, EventBus } from './EventBus.ts';
import { safeLoadJSON } from '../loader.ts';

export interface SchedulerChoice {
  id: string;
  label: string;
  description?: string;
  event?: string;
  payload?: unknown;
  accent?: 'primary' | 'ghost' | 'danger';
}

export interface SchedulerEventContent {
  id: string;
  headline: string;
  body: string;
  art?: string;
  typography?: 'serif' | 'sans' | 'mono' | string;
  animation?: 'aurora' | 'pulse' | 'tilt' | string;
  accentColor?: string;
  acknowledgeText?: string;
  choices?: SchedulerChoice[];
}

export interface ActiveSchedulerEvent extends SchedulerEventContent {
  triggeredAt: number;
}

export type SchedulerTrigger =
  | { type: 'time'; at?: number; in?: number }
  | { type: 'condition'; conditionId: string; params?: unknown };

export interface ScheduledEventSpec {
  content: SchedulerEventContent;
  trigger: SchedulerTrigger;
}

export interface SchedulerContext {
  [key: string]: unknown;
}

export interface SchedulerEvents {
  TRIGGERED: 'scheduler:eventTriggered';
  RESOLVED: 'scheduler:eventResolved';
}

export const SCHEDULER_EVENTS: SchedulerEvents = {
  TRIGGERED: 'scheduler:eventTriggered',
  RESOLVED: 'scheduler:eventResolved'
};

export interface SchedulerTriggeredPayload {
  event: ActiveSchedulerEvent;
}

export interface SchedulerResolvedPayload {
  eventId: string;
  choiceId: string | null;
  event: SchedulerEventContent;
}

type StoredTrigger =
  | { type: 'time'; at: number }
  | { type: 'condition'; conditionId: string; params?: unknown };

type StoredScheduledEvent = {
  content: SchedulerEventContent;
  trigger: StoredTrigger;
};

type StoredActiveEvent = {
  content: SchedulerEventContent;
  triggeredAt: number;
};

type StoredSchedulerState = {
  clock: number;
  queue: StoredScheduledEvent[];
  active: StoredActiveEvent[];
};

type ConditionEvaluator = (params: unknown, context: SchedulerContext) => boolean;

const conditionEvaluators = new Map<string, ConditionEvaluator>();

export function registerSchedulerCondition(id: string, evaluator: ConditionEvaluator): void {
  if (!id) {
    throw new Error('Scheduler condition id is required.');
  }
  conditionEvaluators.set(id, evaluator);
}

export interface EventSchedulerOptions {
  storageKey?: string;
  eventBus?: EventBus;
  storageProvider?: () => Storage | null;
}

export const DEFAULT_SCHEDULER_STORAGE_KEY = 'autobattles:event-scheduler';

function defaultStorageProvider(): Storage | null {
  const globalWithStorage = globalThis as typeof globalThis & { localStorage?: Storage };
  return globalWithStorage.localStorage ?? null;
}

function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function randomId(prefix: string): string {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (cryptoApi?.randomUUID) {
    return cryptoApi.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeChoice(choice: SchedulerChoice): SchedulerChoice {
  const sanitized: SchedulerChoice = {
    id: String(choice.id ?? ''),
    label: String(choice.label ?? ''),
    description: choice.description ? String(choice.description) : undefined,
    event: choice.event ? String(choice.event) : undefined,
    payload: choice.payload,
    accent: choice.accent ?? undefined
  };
  if (!sanitized.id) {
    sanitized.id = randomId('choice');
  }
  if (!sanitized.label) {
    sanitized.label = 'Choose';
  }
  return sanitized;
}

function sanitizeEventContent(content: SchedulerEventContent): SchedulerEventContent {
  const sanitized: SchedulerEventContent = {
    id: String(content.id ?? ''),
    headline: String(content.headline ?? ''),
    body: String(content.body ?? ''),
    art: content.art ? String(content.art) : undefined,
    typography: content.typography,
    animation: content.animation,
    accentColor: content.accentColor ? String(content.accentColor) : undefined,
    acknowledgeText: content.acknowledgeText ? String(content.acknowledgeText) : undefined,
    choices: Array.isArray(content.choices)
      ? content.choices.map((choice) => sanitizeChoice(choice))
      : undefined
  };
  if (!sanitized.id) {
    sanitized.id = randomId('event');
  }
  return sanitized;
}

function sanitizeScheduledEvent(event: StoredScheduledEvent): StoredScheduledEvent {
  return {
    content: sanitizeEventContent(event.content),
    trigger:
      event.trigger.type === 'time'
        ? { type: 'time', at: Number.isFinite(event.trigger.at) ? event.trigger.at : 0 }
        : {
            type: 'condition',
            conditionId: String(event.trigger.conditionId),
            params: event.trigger.params
          }
  } satisfies StoredScheduledEvent;
}

function sanitizeActiveEvent(event: StoredActiveEvent): StoredActiveEvent {
  return {
    content: sanitizeEventContent(event.content),
    triggeredAt: Number.isFinite(event.triggeredAt) ? event.triggeredAt : 0
  } satisfies StoredActiveEvent;
}

const DEFAULT_STATE: StoredSchedulerState = Object.freeze({
  clock: 0,
  queue: [],
  active: []
});

export class EventScheduler {
  private readonly storageKey: string;
  private readonly eventBus: EventBus;
  private readonly getStorage: () => Storage | null;
  private state: StoredSchedulerState = deepClone(DEFAULT_STATE);
  private subscribers = new Set<(events: ActiveSchedulerEvent[]) => void>();

  constructor(options: EventSchedulerOptions = {}) {
    this.storageKey = options.storageKey ?? DEFAULT_SCHEDULER_STORAGE_KEY;
    this.eventBus = options.eventBus ?? globalEventBus;
    this.getStorage = options.storageProvider ?? defaultStorageProvider;
    this.load();
  }

  subscribe(listener: (events: ActiveSchedulerEvent[]) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getActiveEvents());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  getActiveEvents(): ActiveSchedulerEvent[] {
    return this.state.active.map((event) => ({
      ...deepClone(event.content),
      triggeredAt: event.triggeredAt
    }));
  }

  schedule(spec: ScheduledEventSpec): boolean {
    const event = sanitizeEventContent(spec.content);
    if (!event.headline || !event.body) {
      return false;
    }
    if (this.containsEvent(event.id)) {
      return false;
    }

    const storedTrigger: StoredTrigger =
      spec.trigger.type === 'condition'
        ? {
            type: 'condition',
            conditionId: String(spec.trigger.conditionId),
            params: spec.trigger.params
          }
        : {
            type: 'time',
            at: this.resolveTriggerTime(spec.trigger)
          };

    this.state.queue.push({ content: event, trigger: storedTrigger });
    this.sortQueue();
    this.save();
    return true;
  }

  publish(event: SchedulerEventContent): void {
    const sanitized = sanitizeEventContent(event);
    if (this.containsEvent(sanitized.id)) {
      return;
    }
    this.state.queue = this.state.queue.filter((queued) => queued.content.id !== sanitized.id);
    this.activateEvent({ content: sanitized, triggeredAt: this.state.clock });
  }

  tick(deltaSeconds: number, context: SchedulerContext = {}): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) {
      return;
    }
    this.state.clock += deltaSeconds;
    const ready: StoredScheduledEvent[] = [];
    const remaining: StoredScheduledEvent[] = [];
    for (const scheduled of this.state.queue) {
      if (this.shouldTrigger(scheduled.trigger, context)) {
        ready.push(scheduled);
      } else {
        remaining.push(scheduled);
      }
    }
    this.state.queue = remaining;
    for (const scheduled of ready) {
      this.activateEvent({
        content: scheduled.content,
        triggeredAt: this.state.clock
      });
    }
    this.save();
  }

  resolve(eventId: string, choiceId?: string | null): boolean {
    const idx = this.state.active.findIndex((event) => event.content.id === eventId);
    if (idx === -1) {
      return false;
    }
    const active = this.state.active[idx];
    const choice = this.pickChoice(active.content, choiceId);
    const resolvedChoiceId = choice ? choice.id : null;
    this.state.active.splice(idx, 1);
    this.save();
    this.notify();
    this.eventBus.emit(SCHEDULER_EVENTS.RESOLVED, {
      eventId,
      choiceId: resolvedChoiceId,
      event: active.content
    } satisfies SchedulerResolvedPayload);
    if (choice?.event) {
      this.eventBus.emit(choice.event, {
        eventId,
        choiceId: resolvedChoiceId,
        payload: choice.payload,
        event: active.content
      });
    }
    return true;
  }

  reset(): void {
    this.state = deepClone(DEFAULT_STATE);
    this.save();
    this.notify();
  }

  private activateEvent(event: StoredActiveEvent): void {
    const sanitized = sanitizeActiveEvent(event);
    this.state.active.push(sanitized);
    this.save();
    this.notify();
    this.eventBus.emit(SCHEDULER_EVENTS.TRIGGERED, {
      event: {
        ...deepClone(sanitized.content),
        triggeredAt: sanitized.triggeredAt
      }
    } satisfies SchedulerTriggeredPayload);
  }

  private pickChoice(content: SchedulerEventContent, choiceId?: string | null): SchedulerChoice | undefined {
    const choices = content.choices ?? [];
    if (choices.length === 0) {
      return undefined;
    }
    if (choiceId) {
      const found = choices.find((choice) => choice.id === choiceId);
      if (found) {
        return found;
      }
    }
    return choices[0];
  }

  private shouldTrigger(trigger: StoredTrigger, context: SchedulerContext): boolean {
    if (trigger.type === 'time') {
      return this.state.clock >= trigger.at;
    }
    const evaluator = conditionEvaluators.get(trigger.conditionId);
    if (!evaluator) {
      return false;
    }
    try {
      return Boolean(evaluator(trigger.params, context));
    } catch (error) {
      console.warn('Scheduler condition evaluation failed', trigger.conditionId, error);
      return false;
    }
  }

  private resolveTriggerTime(trigger: { at?: number; in?: number }): number {
    if (Number.isFinite(trigger.at)) {
      return Number(trigger.at);
    }
    const offset = Number.isFinite(trigger.in) ? Number(trigger.in) : 0;
    return Math.max(0, this.state.clock + offset);
  }

  private sortQueue(): void {
    this.state.queue.sort((a, b) => {
      const aAt = a.trigger.type === 'time' ? a.trigger.at : Number.POSITIVE_INFINITY;
      const bAt = b.trigger.type === 'time' ? b.trigger.at : Number.POSITIVE_INFINITY;
      return aAt - bAt;
    });
  }

  private containsEvent(id: string): boolean {
    return (
      this.state.active.some((event) => event.content.id === id) ||
      this.state.queue.some((event) => event.content.id === id)
    );
  }

  private notify(): void {
    const snapshot = this.getActiveEvents();
    for (const listener of this.subscribers) {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn('Scheduler subscriber failed', error);
      }
    }
  }

  private load(): void {
    const stored = safeLoadJSON<Partial<StoredSchedulerState>>(this.storageKey);
    if (!stored) {
      this.state = deepClone(DEFAULT_STATE);
      return;
    }
    const clock = Number(stored.clock);
    this.state = {
      clock: Number.isFinite(clock) ? clock : 0,
      queue: Array.isArray(stored.queue)
        ? stored.queue.map((event) => sanitizeScheduledEvent(event))
        : [],
      active: Array.isArray(stored.active)
        ? stored.active.map((event) => sanitizeActiveEvent(event))
        : []
    } satisfies StoredSchedulerState;
  }

  private save(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(
        this.storageKey,
        JSON.stringify({
          clock: this.state.clock,
          queue: this.state.queue,
          active: this.state.active
        } satisfies StoredSchedulerState)
      );
    } catch (error) {
      console.warn('Scheduler persistence failed', error);
    }
  }
}

export const eventScheduler = new EventScheduler();
