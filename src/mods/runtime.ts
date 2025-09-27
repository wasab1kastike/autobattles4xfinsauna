import type { EventBus } from '../events/EventBus.ts';
import { eventBus as globalEventBus } from '../events';

export type ModifierId = string;

export type ModifierRemovalReason = 'expired' | 'manual' | 'replaced';

export interface ModifierHookContext {
  readonly runtime: ModifierRuntime;
  readonly modifier: ActiveModifier;
}

export interface ModifierExpireContext extends ModifierHookContext {
  readonly reason: ModifierRemovalReason;
}

export type ModifierHook<Payload = unknown> = (
  payload: Payload,
  context: ModifierHookContext
) => void;

export interface ModifierDefinition {
  /** Unique identifier so systems can refresh or remove the modifier. */
  id: ModifierId;
  /** Duration of the modifier in seconds. Use `Infinity` for persistent effects. */
  duration: number;
  /** Optional lifecycle hook invoked as soon as the modifier is applied. */
  onApply?: (context: ModifierHookContext) => void;
  /** Optional lifecycle hook invoked when the modifier expires or is removed. */
  onExpire?: (context: ModifierExpireContext) => void;
  /** Optional bag for stateful metadata accessible from hook callbacks. */
  data?: Record<string, unknown>;
  /** Event-specific callbacks fired when the owning system triggers a hook. */
  hooks?: Record<string, ModifierHook>;
}

export interface ActiveModifier extends ModifierDefinition {
  /** Seconds left before the modifier expires. */
  remaining: number;
  /** Timestamp captured when the modifier was applied. */
  readonly appliedAt: number;
  /** Hook map is always populated with a sanitized record. */
  hooks: Record<string, ModifierHook>;
}

export interface ModifierRuntimeEvents {
  modifierAdded: { modifier: ActiveModifier };
  modifierRemoved: { modifier: ActiveModifier; reason: ModifierRemovalReason };
  modifierExpired: { modifier: ActiveModifier };
}

type ModifierRuntimeEvent = keyof ModifierRuntimeEvents;

type RuntimeListener<E extends ModifierRuntimeEvent> = (
  payload: ModifierRuntimeEvents[E]
) => void;

function getNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function sanitizeHooks(hooks: ModifierDefinition['hooks']): Record<string, ModifierHook> {
  const sanitized: Record<string, ModifierHook> = {};
  if (!hooks) {
    return sanitized;
  }
  for (const [event, hook] of Object.entries(hooks)) {
    if (typeof hook === 'function') {
      sanitized[event] = hook;
    }
  }
  return sanitized;
}

/**
 * Runtime registry for managing timed gameplay modifiers.
 * Systems can register temporary effects with hooks and advance them per frame.
 */
export class ModifierRuntime {
  private readonly modifiers = new Map<ModifierId, ActiveModifier>();
  private readonly hookIndex = new Map<string, Set<ModifierId>>();
  private readonly listeners = new Map<ModifierRuntimeEvent, Set<RuntimeListener<any>>>();

  constructor(private readonly emitter: EventBus | null = globalEventBus) {}

  /**
   * Apply a modifier. Any existing modifier with the same id is replaced.
   */
  add(definition: ModifierDefinition): ActiveModifier {
    if (typeof definition.id !== 'string' || definition.id.length === 0) {
      throw new Error('Modifier id must be a non-empty string');
    }
    if (typeof definition.duration !== 'number' || !Number.isFinite(definition.duration)) {
      if (definition.duration !== Infinity) {
        throw new Error('Modifier duration must be a positive number or Infinity');
      }
    }
    if (Number.isFinite(definition.duration) && definition.duration <= 0) {
      throw new Error('Modifier duration must be greater than zero');
    }

    const hooks = sanitizeHooks(definition.hooks);
    const appliedAt = getNow();

    if (this.modifiers.has(definition.id)) {
      this.remove(definition.id, 'replaced');
    }

    const active: ActiveModifier = {
      ...definition,
      hooks,
      remaining: definition.duration,
      appliedAt
    };

    this.modifiers.set(active.id, active);
    this.indexHooks(active);

    const context: ModifierHookContext = { runtime: this, modifier: active };
    try {
      definition.onApply?.(context);
    } catch (error) {
      this.modifiers.delete(active.id);
      this.unindexHooks(active);
      throw error;
    }

    this.emit('modifierAdded', { modifier: active });
    this.emitter?.emit('modifierAdded', { modifier: active });

    if (!Number.isFinite(active.remaining)) {
      return active;
    }

    if (active.remaining <= 0) {
      this.remove(active.id, 'expired');
    }

    return active;
  }

  /**
   * Determine if a modifier is active.
   */
  has(id: ModifierId): boolean {
    return this.modifiers.has(id);
  }

  /**
   * Retrieve a shallow copy of all active modifiers.
   */
  list(): ActiveModifier[] {
    return Array.from(this.modifiers.values()).map((modifier) => ({
      ...modifier,
      hooks: { ...modifier.hooks }
    }));
  }

  /**
   * Manually remove a modifier. Returns true if the modifier existed.
   */
  remove(id: ModifierId, reason: ModifierRemovalReason = 'manual'): boolean {
    const modifier = this.modifiers.get(id);
    if (!modifier) {
      return false;
    }

    this.modifiers.delete(id);
    this.unindexHooks(modifier);

    const context: ModifierExpireContext = { runtime: this, modifier, reason };
    modifier.onExpire?.(context);

    if (reason === 'expired') {
      this.emit('modifierExpired', { modifier });
      this.emitter?.emit('modifierExpired', { modifier });
    }

    this.emit('modifierRemoved', { modifier, reason });
    this.emitter?.emit('modifierRemoved', { modifier, reason });

    return true;
  }

  /**
   * Advance timers by the supplied delta in seconds.
   */
  advance(deltaSeconds: number): void {
    if (typeof deltaSeconds !== 'number' || deltaSeconds <= 0) {
      return;
    }

    const expired: ModifierId[] = [];
    for (const modifier of this.modifiers.values()) {
      if (!Number.isFinite(modifier.remaining)) {
        continue;
      }
      modifier.remaining = Math.max(0, modifier.remaining - deltaSeconds);
      if (modifier.remaining <= 0) {
        expired.push(modifier.id);
      }
    }

    for (const id of expired) {
      this.remove(id, 'expired');
    }
  }

  /**
   * Trigger a hook event for active modifiers.
   */
  trigger(event: string, payload?: unknown): void {
    const bound = this.hookIndex.get(event);
    if (!bound || bound.size === 0) {
      return;
    }

    const targets = Array.from(bound);
    for (const id of targets) {
      const modifier = this.modifiers.get(id);
      if (!modifier) {
        bound.delete(id);
        continue;
      }
      const hook = modifier.hooks[event];
      if (!hook) {
        bound.delete(id);
        continue;
      }
      hook(payload, { runtime: this, modifier });
    }
  }

  /**
   * Remove all modifiers.
   */
  clear(): void {
    const ids = Array.from(this.modifiers.keys());
    for (const id of ids) {
      this.remove(id, 'manual');
    }
  }

  on<E extends ModifierRuntimeEvent>(event: E, listener: RuntimeListener<E>): void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener as RuntimeListener<any>);
    this.listeners.set(event, listeners);
  }

  off<E extends ModifierRuntimeEvent>(event: E, listener: RuntimeListener<E>): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }
    listeners.delete(listener as RuntimeListener<any>);
    if (listeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  private emit<E extends ModifierRuntimeEvent>(event: E, payload: ModifierRuntimeEvents[E]): void {
    const listeners = this.listeners.get(event);
    if (!listeners || listeners.size === 0) {
      return;
    }
    for (const listener of Array.from(listeners)) {
      (listener as RuntimeListener<E>)(payload);
    }
  }

  private indexHooks(modifier: ActiveModifier): void {
    for (const event of Object.keys(modifier.hooks)) {
      const set = this.hookIndex.get(event) ?? new Set<ModifierId>();
      set.add(modifier.id);
      this.hookIndex.set(event, set);
    }
  }

  private unindexHooks(modifier: ActiveModifier): void {
    for (const event of Object.keys(modifier.hooks)) {
      const set = this.hookIndex.get(event);
      if (!set) {
        continue;
      }
      set.delete(modifier.id);
      if (set.size === 0) {
        this.hookIndex.delete(event);
      }
    }
  }
}

export const modifierRuntime = new ModifierRuntime();

export const addModifier = (definition: ModifierDefinition): ActiveModifier =>
  modifierRuntime.add(definition);

export const removeModifier = (
  id: ModifierId,
  reason: ModifierRemovalReason = 'manual'
): boolean => modifierRuntime.remove(id, reason);

export const advanceModifiers = (deltaSeconds: number): void => {
  modifierRuntime.advance(deltaSeconds);
};

export const triggerModifierHook = (event: string, payload?: unknown): void => {
  modifierRuntime.trigger(event, payload);
};
