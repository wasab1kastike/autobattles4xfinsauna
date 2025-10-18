import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildRosterEntries,
  buildRosterSummary,
  configureRosterOrchestrator,
  saunojas,
  saunojaToUnit,
  unitToSaunoja
} from './roster.ts';
import type { Unit } from '../../unit/index.ts';
import { makeSaunoja } from '../../units/saunoja.ts';

const makeStubUnit = (
  id: string,
  options: { health?: number; maxHealth?: number; shield?: number; dead?: boolean } = {}
): Unit => {
  const health = options.health ?? 10;
  const stats = {
    health,
    attackDamage: 3,
    attackRange: 1,
    movementRange: 2,
    defense: 0
  };
  return {
    id,
    stats,
    getMaxHealth: () => options.maxHealth ?? health,
    getShield: () => options.shield ?? 0,
    isDead: () => Boolean(options.dead)
  } as unknown as Unit;
};

describe('roster orchestrator', () => {
  const unitsById = new Map<string, Unit>();
  let activeRosterCount = 0;

  beforeEach(() => {
    saunojas.splice(0, saunojas.length);
    saunojaToUnit.clear();
    unitToSaunoja.clear();
    unitsById.clear();
    activeRosterCount = 0;

    configureRosterOrchestrator({
      getUnitById: (id) => unitsById.get(id),
      getAttachedUnitFor: (attendant) => {
        const attachedId = saunojaToUnit.get(attendant.id);
        return attachedId ? unitsById.get(attachedId) ?? null : null;
      },
      getActiveRosterCount: () => activeRosterCount,
      syncSelectionOverlay: () => {},
      promote: () => false
    });
  });

  it('sorts roster entries by status and name', () => {
    const engagedAlpha = makeSaunoja({ id: 'alpha', name: 'Alpha' });
    const engagedBravo = makeSaunoja({ id: 'bravo', name: 'Bravo' });
    const reserve = makeSaunoja({ id: 'reserve', name: 'Charlie' });
    const downed = makeSaunoja({ id: 'downed', name: 'Delta', hp: 0 });

    const alphaUnit = makeStubUnit('unit-alpha', { health: 12 });
    const bravoUnit = makeStubUnit('unit-bravo', { health: 8 });

    saunojas.push(reserve, downed, engagedBravo, engagedAlpha);
    saunojaToUnit.set(engagedAlpha.id, alphaUnit.id);
    saunojaToUnit.set(engagedBravo.id, bravoUnit.id);
    unitToSaunoja.set(alphaUnit.id, engagedAlpha);
    unitToSaunoja.set(bravoUnit.id, engagedBravo);
    unitsById.set(alphaUnit.id, alphaUnit);
    unitsById.set(bravoUnit.id, bravoUnit);

    const entries = buildRosterEntries();
    expect(entries.map((entry) => [entry.status, entry.name])).toEqual([
      ['engaged', 'Alpha'],
      ['engaged', 'Bravo'],
      ['reserve', 'Charlie'],
      ['downed', 'Delta']
    ]);
  });

  it('builds roster summary with the selected attendant and active count', () => {
    activeRosterCount = 7;

    const selected = makeSaunoja({ id: 'sel', name: 'Selena', behavior: 'attack', selected: true });
    selected.upkeep = 3.4;
    const reserve = makeSaunoja({ id: 'reserve', name: 'Rune' });
    const downed = makeSaunoja({ id: 'downed', name: 'Dormant', hp: 0 });

    saunojas.push(downed, reserve, selected);

    const summary = buildRosterSummary();
    expect(summary.count).toBe(7);
    expect(summary.card).not.toBeNull();
    expect(summary.card?.id).toBe(selected.id);
    expect(summary.card?.behavior).toBe('attack');
    expect(summary.card?.upkeep).toBe(3);
  });

  it('falls back to the first living Saunoja when none are selected', () => {
    activeRosterCount = 2;
    const downed = makeSaunoja({ id: 'downed', name: 'Dormant', hp: 0, selected: false });
    const living = makeSaunoja({ id: 'living', name: 'Lyra', selected: false });

    saunojas.push(downed, living);

    const summary = buildRosterSummary();
    expect(summary.count).toBe(2);
    expect(summary.card?.id).toBe('living');
  });
});
