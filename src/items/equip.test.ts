import { describe, expect, it } from 'vitest';
import { makeSaunoja } from '../units/saunoja.ts';
import type { SaunojaItem } from '../units/saunoja.ts';
import { equip, unequip, matchesSlot, loadoutItems } from './equip.ts';

describe('items/equip', () => {
  const weapon: SaunojaItem = {
    id: 'glacier-brand',
    name: 'Glacier Brand',
    quantity: 1
  };

  const alternateWeapon: SaunojaItem = {
    id: 'emberglass-arrow',
    name: 'Emberglass Arrow',
    quantity: 1
  };

  const supply: SaunojaItem = {
    id: 'birch-sap-satchel',
    name: 'Birch Sap Satchel',
    quantity: 2
  };

  it('equips items into their designated slots', () => {
    const unit = makeSaunoja({ id: 's1' });
    const outcome = equip(unit, weapon);
    expect(outcome.success).toBe(true);
    expect(outcome.slot).toBe('weapon');
    expect(unit.equipment.weapon?.id).toBe('glacier-brand');
    expect(matchesSlot('glacier-brand', 'weapon')).toBe(true);
    expect(unit.items).toHaveLength(1);
  });

  it('rejects conflicting equipment occupying the same slot', () => {
    const unit = makeSaunoja({ id: 's2' });
    expect(equip(unit, weapon).success).toBe(true);
    const outcome = equip(unit, alternateWeapon);
    expect(outcome.success).toBe(false);
    expect(outcome.reason).toBe('slot-occupied');
    expect(unit.equipment.weapon?.id).toBe('glacier-brand');
  });

  it('enforces stack limits when combining quantities', () => {
    const unit = makeSaunoja({ id: 's3' });
    expect(equip(unit, supply).success).toBe(true);
    const overflow = equip(unit, { ...supply });
    expect(overflow.success).toBe(false);
    expect(overflow.reason).toBe('stack-limit');
    const loadout = loadoutItems(unit.equipment);
    expect(loadout).toHaveLength(1);
    expect(loadout[0]?.quantity).toBe(2);
  });

  it('returns unequipped items to empty the slot', () => {
    const unit = makeSaunoja({ id: 's4' });
    expect(equip(unit, weapon).success).toBe(true);
    const outcome = unequip(unit, 'weapon');
    expect(outcome.success).toBe(true);
    expect(outcome.removed?.id).toBe('glacier-brand');
    expect(unit.equipment.weapon).toBeNull();
    expect(unit.items).toHaveLength(0);
  });
});
