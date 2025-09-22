import type { AxialCoord, PixelCoord } from '../../hex/HexUtils.ts';

export interface UnitStatusBuff {
  id: string;
  remaining?: number | typeof Infinity;
  duration?: number | typeof Infinity;
  stacks?: number;
}

export interface UnitStatusPayload {
  id: string;
  world: PixelCoord;
  radius: number;
  hp: number;
  maxHp: number;
  shield?: number;
  faction: string;
  visible?: boolean;
  selected?: boolean;
  buffs?: readonly UnitStatusBuff[];
}

export interface SaunaStatusPayload {
  id: string;
  world: PixelCoord;
  radius: number;
  progress: number;
  countdown: number;
  label?: string;
  unitLabel?: string;
  visible?: boolean;
}

export interface SelectionItemSlot {
  id: string;
  name: string;
  icon?: string;
  rarity?: string;
  quantity?: number;
}

export interface SelectionStatusChip {
  id: string;
  label: string;
  remaining?: number | typeof Infinity;
  duration?: number | typeof Infinity;
  stacks?: number;
}

export interface UnitSelectionPayload {
  id: string;
  name: string;
  faction: string;
  coord: AxialCoord;
  hp: number;
  maxHp: number;
  shield?: number;
  items: readonly SelectionItemSlot[];
  statuses: readonly SelectionStatusChip[];
}
