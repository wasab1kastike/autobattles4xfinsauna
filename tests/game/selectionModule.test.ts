import { describe, expect, it, vi } from 'vitest';
import { syncSelectionOverlay } from '../../src/game/selection.ts';
import type { Unit } from '../../src/unit/index.ts';
import type { Saunoja } from '../../src/units/saunoja.ts';
import type { UnitFxManager } from '../../src/render/unit_fx.ts';

describe('game/selection module', () => {
  const createSaunoja = (): Saunoja => ({
    id: 's1',
    name: 'Saunoja',
    appearanceId: 'default' as any,
    coord: { q: 0, r: 0 },
    maxHp: 10,
    hp: 10,
    defense: 0,
    shield: 0,
    steam: 0,
    behavior: 'defend',
    traits: [],
    upkeep: 1,
    xp: 0,
    lastHitAt: 0,
    selected: true,
    items: [],
    baseStats: { health: 10, attackDamage: 5, attackRange: 1, movementRange: 1 },
    effectiveStats: { health: 10, attackDamage: 5, attackRange: 1, movementRange: 1 },
    equipment: {} as any,
    modifiers: [],
    combatKeywords: null,
    combatHooks: null
  });

  const createUnit = (): Unit => ({
    id: 'unit-1',
    type: 'soldier',
    coord: { q: 0, r: 0 },
    stats: { health: 10, attackDamage: 5, attackRange: 1, movementRange: 1 } as any,
    faction: 'player',
    isDead: () => false,
    getMaxHealth: () => 10,
    getShield: () => 0,
    setBehavior: vi.fn(),
    setExperience: vi.fn()
  } as unknown as Unit);

  const createUnitFx = () => ({
    step: () => {},
    getShakeOffset: () => ({ x: 0, y: 0 }),
    getUnitAlpha: () => 1,
    beginStatusFrame: () => {},
    pushUnitStatus: () => {},
    pushSaunaStatus: () => {},
    commitStatusFrame: () => {},
    setSelection: vi.fn(),
    dispose: () => {}
  } satisfies UnitFxManager & { setSelection: ReturnType<typeof vi.fn> });

  it('builds selection payloads for attached Saunoja', () => {
    const saunoja = createSaunoja();
    const unit = createUnit();
    const fx = createUnitFx();

    const nextSelected = syncSelectionOverlay({
      unitFx: fx,
      selectedUnitId: unit.id,
      getSelectedSaunoja: () => saunoja,
      getAttachedUnitFor: () => unit,
      findSaunojaByAttachedUnitId: () => saunoja,
      getUnitById: () => unit,
      describeUnit: () => 'Saunoja unit'
    });

    expect(nextSelected).toBe(unit.id);
    expect(fx.setSelection).toHaveBeenCalledTimes(1);
    expect(fx.setSelection).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: unit.id, name: 'Saunoja' })
    );
  });

  it('falls back to selected Saunoja when stored unit id is stale', () => {
    const saunoja = createSaunoja();
    const unit = createUnit();
    const fx = createUnitFx();

    const nextSelected = syncSelectionOverlay({
      unitFx: fx,
      selectedUnitId: 'missing',
      getSelectedSaunoja: () => saunoja,
      getAttachedUnitFor: () => unit,
      findSaunojaByAttachedUnitId: () => null,
      getUnitById: () => null,
      describeUnit: () => 'Saunoja unit'
    });

    expect(nextSelected).toBe(unit.id);
    expect(fx.setSelection).toHaveBeenCalledWith(
      expect.objectContaining({ id: unit.id, name: 'Saunoja' })
    );
  });

  it('supports enemy unit overlays when a Saunoja is not attached', () => {
    const fx = createUnitFx();
    const enemyUnit = ({
      id: 'enemy-1',
      type: 'raider',
      faction: 'enemy',
      coord: { q: 1, r: 1 },
      stats: { health: 8, attackDamage: 3, attackRange: 1, movementRange: 1 } as any,
      isDead: () => false,
      getMaxHealth: () => 8,
      getShield: () => 0
    } as unknown) as Unit;

    const nextSelected = syncSelectionOverlay({
      unitFx: fx,
      selectedUnitId: enemyUnit.id,
      getSelectedSaunoja: () => null,
      getAttachedUnitFor: () => null,
      findSaunojaByAttachedUnitId: () => null,
      getUnitById: () => enemyUnit,
      describeUnit: () => 'Enemy foe'
    });

    expect(nextSelected).toBe(enemyUnit.id);
    expect(fx.setSelection).toHaveBeenCalledWith(
      expect.objectContaining({ id: enemyUnit.id, faction: 'enemy' })
    );
  });
});
