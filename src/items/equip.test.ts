import { describe, expect, it } from 'vitest';
import { makeSaunoja } from '../units/saunoja.ts';
import type { SaunojaItem } from '../units/saunoja.ts';
import { equip, unequip, matchesSlot, loadoutItems, rankEquipmentCandidates } from './equip.ts';

describe('items/equip', () => {
  const weapon: SaunojaItem = {
    id: 'glacier-brand',
    name: 'Glacier Brand',
    quantity: 1,
    rarity: 'rare'
  };

  const alternateWeapon: SaunojaItem = {
    id: 'emberglass-arrow',
    name: 'Emberglass Arrow',
    quantity: 1,
    rarity: 'rare'
  };

  const legendaryWeapon: SaunojaItem = {
    id: 'emberglass-arrow',
    name: 'Emberglass Arrow',
    quantity: 1,
    rarity: 'legendary'
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

  it('rejects conflicting equipment occupying the same slot when not an upgrade', () => {
    const unit = makeSaunoja({ id: 's2' });
    expect(equip(unit, weapon).success).toBe(true);
    const outcome = equip(unit, alternateWeapon);
    expect(outcome.success).toBe(false);
    expect(outcome.reason).toBe('slot-occupied');
    expect(unit.equipment.weapon?.id).toBe('glacier-brand');
  });

  it('replaces equipped items when the incoming gear is higher tier', () => {
    const unit = makeSaunoja({ id: 's5' });
    expect(equip(unit, weapon).success).toBe(true);
    const outcome = equip(unit, legendaryWeapon);
    expect(outcome.success).toBe(true);
    expect(outcome.removed?.id).toBe('glacier-brand');
    expect(unit.equipment.weapon?.id).toBe('emberglass-arrow');
  });

  it('ranks stash candidates by slot and power', () => {
    const ranked = rankEquipmentCandidates(
      [
        { ...legendaryWeapon },
        { ...weapon },
        { ...supply }
      ],
      'weapon'
    );
    expect(ranked).toEqual([0, 1]);
    expect(rankEquipmentCandidates([{ ...supply }], 'weapon')).toHaveLength(0);
  });

  it('allows downgrading when explicitly permitted', () => {
    const unit = makeSaunoja({ id: 's6' });
    expect(equip(unit, legendaryWeapon).success).toBe(true);
    const downgrade = equip(unit, weapon, { allowDowngrade: true });
    expect(downgrade.success).toBe(true);
    expect(downgrade.removed?.id).toBe('emberglass-arrow');
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
