import type { AxialCoord } from '../hex/HexUtils.ts';

export interface Saunoja {
  /** Unique identifier used to reference the unit. */
  id: string;
  /** Display name shown in UI panels and tooltips. */
  name: string;
  /** Axial hex coordinate locating the unit on the map. */
  coord: AxialCoord;
  /** Maximum hit points the unit can have. */
  maxHp: number;
  /** Current hit points remaining. */
  hp: number;
  /** Steam intensity from 0 (idle) to 1 (billowing). */
  steam: number;
  /** Whether the unit is currently selected in the UI. */
  selected: boolean;
}

export interface SaunojaInit {
  id: string;
  name?: string;
  coord?: AxialCoord;
  maxHp?: number;
  hp?: number;
  steam?: number;
  selected?: boolean;
}

const DEFAULT_COORD: AxialCoord = { q: 0, r: 0 };
const DEFAULT_NAME = 'Saunoja';
const DEFAULT_MAX_HP = 18;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Construct a Saunoja with defensive defaults while sanitising the provided
 * configuration so downstream combat helpers can rely on consistent data.
 */
export function makeSaunoja(init: SaunojaInit): Saunoja {
  const {
    id,
    name = DEFAULT_NAME,
    coord = DEFAULT_COORD,
    maxHp = DEFAULT_MAX_HP,
    hp = maxHp,
    steam = 0,
    selected = false
  } = init;

  const normalizedMaxHp = Number.isFinite(maxHp) ? Math.max(1, maxHp) : DEFAULT_MAX_HP;
  const normalizedHpSource = Number.isFinite(hp) ? hp : normalizedMaxHp;
  const clampedHp = clamp(normalizedHpSource, 0, normalizedMaxHp);
  const normalizedSteamSource = Number.isFinite(steam) ? steam : 0;
  const clampedSteam = clamp(normalizedSteamSource, 0, 1);

  return {
    id,
    name,
    coord: { q: coord.q, r: coord.r },
    maxHp: normalizedMaxHp,
    hp: clampedHp,
    steam: clampedSteam,
    selected
  };
}
