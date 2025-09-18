import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModifierRuntime, type ModifierDefinition } from './runtime.ts';

describe('ModifierRuntime', () => {
  let runtime: ModifierRuntime;

  beforeEach(() => {
    runtime = new ModifierRuntime(null);
  });

  it('fires modifier hooks when triggered', () => {
    const hook = vi.fn();
    const definition: ModifierDefinition = {
      id: 'berserk',
      duration: 10,
      hooks: {
        attack: hook
      }
    };

    const modifier = runtime.add(definition);

    const payload = { damage: 42 };
    runtime.trigger('attack', payload);

    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith(payload, {
      runtime,
      modifier
    });

    runtime.remove('berserk');
    runtime.trigger('attack', payload);
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('expires modifiers after their duration and emits lifecycle events', () => {
    const expire = vi.fn();
    const expiredListener = vi.fn();
    const removedListener = vi.fn();

    runtime.on('modifierExpired', expiredListener);
    runtime.on('modifierRemoved', removedListener);

    runtime.add({
      id: 'steam-shield',
      duration: 1,
      onExpire: expire
    });

    runtime.advance(0.4);
    expect(runtime.has('steam-shield')).toBe(true);

    runtime.advance(0.7);
    expect(runtime.has('steam-shield')).toBe(false);
    expect(expire).toHaveBeenCalledTimes(1);

    expect(expiredListener).toHaveBeenCalledTimes(1);
    const expiredPayload = expiredListener.mock.calls[0][0];
    expect(expiredPayload.modifier.id).toBe('steam-shield');

    expect(removedListener).toHaveBeenCalledTimes(1);
    const removedPayload = removedListener.mock.calls[0][0];
    expect(removedPayload.modifier.id).toBe('steam-shield');
    expect(removedPayload.reason).toBe<'expired'>('expired');
  });
});
