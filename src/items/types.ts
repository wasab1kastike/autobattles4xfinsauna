import type { SaunojaItem } from '../units/saunoja.ts';

export type EquipmentSlotId = 'supply' | 'weapon' | 'focus' | 'relic';

export interface EquipmentSlotDefinition {
  readonly id: EquipmentSlotId;
  readonly label: string;
  readonly description: string;
  readonly maxStacks: number;
}

export interface EquipmentModifier {
  readonly health?: number;
  readonly attackDamage?: number;
  readonly attackRange?: number;
  readonly movementRange?: number;
  readonly defense?: number;
  readonly shield?: number;
}

export interface EquipmentItemDefinition {
  readonly id: string;
  readonly slot: EquipmentSlotId;
  /**
   * Optional combat animation key applied while this item is equipped.
   * Supported keys: 'cleave', 'lunge', 'volley'. Additional keys gracefully
   * fall back to default playback when unknown.
   */
  readonly attackAnimation?: string;
  readonly modifiers?: EquipmentModifier;
  readonly maxStacks?: number;
}

export interface EquippedItem extends SaunojaItem {
  readonly attackAnimation?: string;
  readonly slot: EquipmentSlotId;
  readonly maxStacks: number;
  readonly modifiers: EquipmentModifier;
}

export type EquipmentMap = Record<EquipmentSlotId, EquippedItem | null>;

export type EquipmentLoadout = Readonly<EquipmentMap>;

export const EQUIPMENT_SLOT_IDS: readonly EquipmentSlotId[] = Object.freeze([
  'supply',
  'weapon',
  'focus',
  'relic'
]);

export function createEmptyLoadout(): EquipmentMap {
  return {
    supply: null,
    weapon: null,
    focus: null,
    relic: null
  } satisfies EquipmentMap;
}
