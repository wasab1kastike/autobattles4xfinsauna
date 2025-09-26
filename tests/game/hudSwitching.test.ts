import { describe, expect, it, beforeEach, vi } from 'vitest';
import { eventBus } from '../../src/events/index.ts';
import { logEvent, subscribeToLogs, clearLogs } from '../../src/ui/logging.ts';
import { __TEST__ } from '../../src/game.ts';

describe('HUD switching lifecycle', () => {
  const helpers = __TEST__;
  if (!helpers) {
    throw new Error('HUD test helpers are unavailable');
  }

  beforeEach(() => {
    clearLogs();
    helpers.teardownHudEventListeners();
  });

  it('removes resourceChanged listeners when UI v2 is toggled off', () => {
    const handler = vi.fn();
    const baseline = helpers.getHudEventListenerCount('resourceChanged');
    expect(helpers.getTrackedHudListenerCount()).toBe(0);

    helpers.registerHudEventListener('resourceChanged', handler);

    expect(helpers.getTrackedHudListenerCount()).toBe(1);
    expect(helpers.getHudEventListenerCount('resourceChanged')).toBe(baseline + 1);

    eventBus.emit('resourceChanged', { resource: 'beer', total: 1, amount: 1 } as any);
    expect(handler).toHaveBeenCalledTimes(1);

    helpers.teardownHudEventListeners();

    expect(helpers.getHudEventListenerCount('resourceChanged')).toBe(baseline);
    expect(helpers.getTrackedHudListenerCount()).toBe(0);

    eventBus.emit('resourceChanged', { resource: 'beer', total: 2, amount: 1 } as any);
    expect(handler).toHaveBeenCalledTimes(1);

    helpers.registerHudEventListener('resourceChanged', handler);
    expect(helpers.getTrackedHudListenerCount()).toBe(1);
    expect(helpers.getHudEventListenerCount('resourceChanged')).toBe(baseline + 1);

    eventBus.emit('resourceChanged', { resource: 'beer', total: 3, amount: 1 } as any);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('does not duplicate log emissions after toggling UI controllers', () => {
    const received: string[] = [];

    const unsubscribe = subscribeToLogs((change) => {
      if (change.kind === 'append') {
        received.push(change.entry.message);
      }
    });

    logEvent({ type: 'system', message: 'alpha' });
    expect(received).toEqual(['alpha']);

    unsubscribe();

    const receivedAfterToggle: string[] = [];
    const unsubscribeSecond = subscribeToLogs((change) => {
      if (change.kind === 'append') {
        receivedAfterToggle.push(change.entry.message);
      }
    });

    logEvent({ type: 'system', message: 'beta' });
    expect(receivedAfterToggle).toEqual(['beta']);

    unsubscribeSecond();
  });
});
