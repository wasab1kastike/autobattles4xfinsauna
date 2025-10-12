import { describe, it, expect, vi } from 'vitest';
import { EventBus } from './EventBus';

describe('EventBus.off', () => {
  it('removes a specific listener', () => {
    const bus = new EventBus();
    const listener = vi.fn();
    const other = vi.fn();
    bus.on('test', listener);
    bus.on('test', other);

    bus.off('test', listener);
    bus.emit('test', 42);

    expect(listener).not.toHaveBeenCalled();
    expect(other).toHaveBeenCalledWith(42);
  });
});
