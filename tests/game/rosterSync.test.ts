import { describe, expect, it, vi } from 'vitest';
import { Unit } from '../../src/units/Unit.ts';
import type { UnitStats, UnitBehavior } from '../../src/unit/types.ts';
import type { Saunoja } from '../../src/units/saunoja.ts';
import {
  createRosterSyncService,
  cloneStatBlock,
  type RosterSyncService
} from '../../src/game/roster/rosterSync.ts';
import type {
  RosterPersonaBaseline,
  RosterService
} from '../../src/game/runtime/rosterService.ts';

interface RosterSyncHarness {
  service: RosterSyncService;
  rosterService: RosterService;
  saunojas: Saunoja[];
  saunojaPolicyBaselines: Map<Saunoja, RosterPersonaBaseline>;
  unitToSaunoja: Map<string, Saunoja>;
  saunojaToUnit: Map<string, string>;
  applyBehavior: ReturnType<typeof vi.fn>;
  updateBaseStatsFromUnit: ReturnType<typeof vi.fn>;
  onRosterChanged: ReturnType<typeof vi.fn>;
  setSelectedCoord: ReturnType<typeof vi.fn>;
}

function createHarness(options: { personaMissing?: boolean } = {}): RosterSyncHarness {
  const saunojas: Saunoja[] = [];
  const saunojaPolicyBaselines = new Map<Saunoja, RosterPersonaBaseline>();
  const unitToSaunoja = new Map<string, Saunoja>();
  const saunojaToUnit = new Map<string, string>();

  const ensureBaseline = vi.fn((saunoja: Saunoja) => {
    let baseline = saunojaPolicyBaselines.get(saunoja);
    if (!baseline) {
      baseline = { base: cloneStatBlock(saunoja.baseStats), upkeep: 1 } satisfies RosterPersonaBaseline;
      saunojaPolicyBaselines.set(saunoja, baseline);
    }
    return baseline;
  });

  const applyBehavior = vi.fn<[Saunoja, UnitBehavior, Unit], boolean>((saunoja, behavior) => {
    saunoja.behavior = behavior;
    return true;
  });

  const updateBaseStatsFromUnit = vi.fn<[Saunoja, Unit | null], void>((saunoja, unit) => {
    if (!unit) {
      return;
    }
    saunoja.baseStats = cloneStatBlock(saunoja.baseStats);
    saunoja.baseStats.health = Math.max(1, Math.round(unit.getMaxHealth()));
  });

  const onRosterChanged = vi.fn();
  const setSelectedCoord = vi.fn();

  const rosterService: RosterService = {
    loadUnits: vi.fn(() => saunojas),
    saveUnits: vi.fn(),
    isPersonaMissing: vi.fn(() => options.personaMissing ?? false),
    refreshPersona: vi.fn(),
    focusSaunoja: vi.fn(() => false),
    focusSaunojaById: vi.fn(() => false),
    deselectAllSaunojas: vi.fn(() => false),
    clearSaunojaSelection: vi.fn(() => false),
    setSelectedCoord: vi.fn(() => false),
    getSelectedCoord: vi.fn(() => null),
    getSelectedUnitId: vi.fn(() => null),
    setSelectedUnitId: vi.fn()
  } satisfies RosterService;

  const service = createRosterSyncService({
    rosterService,
    saunojas,
    saunojaPolicyBaselines,
    unitToSaunoja,
    saunojaToUnit,
    ensureSaunojaPolicyBaseline: ensureBaseline,
    applySaunojaBehaviorPreference: applyBehavior,
    updateBaseStatsFromUnit,
    onRosterChanged,
    setSelectedCoord
  });

  return {
    service,
    rosterService,
    saunojas,
    saunojaPolicyBaselines,
    unitToSaunoja,
    saunojaToUnit,
    applyBehavior,
    updateBaseStatsFromUnit,
    onRosterChanged,
    setSelectedCoord
  } satisfies RosterSyncHarness;
}

function createUnit(stats: UnitStats): Unit {
  return new Unit('unit-1', 'Soldier', { q: 0, r: 0 }, 'player', stats);
}

describe('rosterSync', () => {
  it('creates and attaches a new persona when no existing match is available', () => {
    const harness = createHarness({ personaMissing: true });
    const unit = createUnit({
      health: 6,
      attackDamage: 2,
      attackRange: 1,
      movementRange: 2
    } satisfies UnitStats);

    const result = harness.service.claimSaunoja(unit);

    expect(result.created).toBe(true);
    expect(result.attached).toBe(true);
    expect(harness.saunojas).toHaveLength(1);
    const persona = harness.saunojas[0];
    expect(harness.unitToSaunoja.get(unit.id)).toBe(persona);
    expect(harness.saunojaToUnit.get(persona.id)).toBe(unit.id);
    expect(harness.saunojaPolicyBaselines.get(persona)).toBeDefined();
    expect(harness.applyBehavior).toHaveBeenCalledWith(persona, persona.behavior, unit);
    expect(harness.updateBaseStatsFromUnit).toHaveBeenCalledWith(persona, unit);
    expect(harness.rosterService.refreshPersona).toHaveBeenCalledWith(persona);
  });

  it('updates persona stats and notifies dependents during synchronization', () => {
    const harness = createHarness({ personaMissing: false });
    const unit = createUnit({
      health: 8,
      attackDamage: 3,
      attackRange: 2,
      movementRange: 3
    } satisfies UnitStats);
    const { saunoja } = harness.service.claimSaunoja(unit);

    unit.updateStats({
      health: 12,
      attackDamage: 4,
      attackRange: 2,
      movementRange: 3
    } satisfies UnitStats);
    unit.stats.health = 7;
    unit.setShield(5);
    (unit as unknown as { lastHitAt?: number }).lastHitAt = 1234;
    unit.setCoord({ q: 2, r: -1 });

    saunoja.hp = 1;
    saunoja.maxHp = 1;
    saunoja.shield = 0;
    saunoja.coord = { q: 0, r: 0 };
    saunoja.selected = true;

    harness.onRosterChanged.mockClear();
    harness.setSelectedCoord.mockClear();

    const changed = harness.service.syncRosterWithUnits([unit]);

    expect(changed).toBe(true);
    expect(saunoja.hp).toBe(7);
    expect(saunoja.maxHp).toBe(unit.getMaxHealth());
    expect(saunoja.shield).toBe(5);
    expect(saunoja.lastHitAt).toBe(1234);
    expect(saunoja.coord).toEqual({ q: 2, r: -1 });
    expect(harness.setSelectedCoord).toHaveBeenCalledWith({ q: 2, r: -1 });
    expect(harness.onRosterChanged).toHaveBeenCalledTimes(1);
  });
});
