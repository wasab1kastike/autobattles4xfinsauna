import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addHudElapsedMs,
  clearPendingRosterEntries,
  clearPendingRosterSummary,
  configureHudSnapshotProviders,
  notifyRosterEntries,
  notifyRosterSummary,
  registerHudEventListener,
  resetHudTracking,
  setPendingRosterEntries,
  setPendingRosterRenderer,
  setPendingRosterSummary,
  subscribeHudTime,
  subscribeRosterEntries,
  subscribeRosterSummary,
  teardownHudEventListeners,
  getTrackedHudListenerCount
} from '../../src/game/hud.ts';
import type { RosterHudSummary } from '../../src/ui/rosterHUD.ts';

const sampleSummary: RosterHudSummary = { count: 1, card: null };
const sampleEntries = [
  {
    id: 's1',
    name: 'Test',
    upkeep: 1,
    status: 'reserve' as const,
    selected: false,
    behavior: 'defend',
    traits: [],
    stats: {
      health: 10,
      maxHealth: 10,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 1
    },
    baseStats: {
      health: 10,
      maxHealth: 10,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 1
    },
    progression: {
      level: 1,
      xp: 0,
      xpIntoLevel: 0,
      xpForNext: 10,
      progress: 0,
      statBonuses: { vigor: 0, focus: 0, resolve: 0 }
    },
    equipment: [],
    items: [],
    modifiers: []
  }
];

describe('game/hud module', () => {
  beforeEach(() => {
    resetHudTracking();
    clearPendingRosterEntries();
    clearPendingRosterSummary();
    setPendingRosterRenderer(null);
    teardownHudEventListeners();
    configureHudSnapshotProviders({
      getRosterSummary: () => ({ ...sampleSummary }),
      getRosterEntries: () => [...sampleEntries]
    });
  });

  it('delivers pending roster data to new subscribers and updates on notify', () => {
    setPendingRosterSummary(sampleSummary);
    setPendingRosterEntries(sampleEntries);

    const receivedSummaries: RosterHudSummary[] = [];
    const receivedEntries: typeof sampleEntries[] = [];

    const unsubscribeSummary = subscribeRosterSummary((summary) => {
      receivedSummaries.push(summary);
    });
    const unsubscribeEntries = subscribeRosterEntries((entries) => {
      receivedEntries.push(entries);
    });

    expect(receivedSummaries).toEqual([sampleSummary]);
    expect(receivedEntries).toEqual([sampleEntries]);

    const nextSummary: RosterHudSummary = { count: 2, card: null };
    const nextEntries = [...sampleEntries, { ...sampleEntries[0], id: 's2', name: 'Another' }];

    notifyRosterSummary(nextSummary);
    notifyRosterEntries(nextEntries);

    expect(receivedSummaries).toEqual([sampleSummary, nextSummary]);
    expect(receivedEntries).toEqual([sampleEntries, nextEntries]);

    unsubscribeSummary();
    unsubscribeEntries();

    notifyRosterSummary({ count: 3, card: null });
    notifyRosterEntries([]);

    expect(receivedSummaries).toEqual([sampleSummary, nextSummary]);
    expect(receivedEntries).toEqual([sampleEntries, nextEntries]);
  });

  it('tracks hud time listeners when elapsed time advances', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeHudTime(listener);

    addHudElapsedMs(250);

    expect(listener).toHaveBeenCalledWith(250);

    unsubscribe();
  });

  it('tracks registered HUD event listeners and cleans them up', () => {
    expect(getTrackedHudListenerCount()).toBe(0);
    const handler = vi.fn();
    const unsubscribe = registerHudEventListener('test:event', handler);
    expect(getTrackedHudListenerCount()).toBe(1);

    unsubscribe();
    expect(getTrackedHudListenerCount()).toBe(0);

    registerHudEventListener('test:event', handler);
    expect(getTrackedHudListenerCount()).toBe(1);
    teardownHudEventListeners();
    expect(getTrackedHudListenerCount()).toBe(0);
  });
});
