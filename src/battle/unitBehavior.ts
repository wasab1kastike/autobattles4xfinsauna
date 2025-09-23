import type { UnitBehavior } from '../unit/types.ts';
import type { Unit } from '../units/Unit.ts';

export const DEFAULT_BEHAVIOR: UnitBehavior = 'explore';
export const DEFEND_PERIMETER_RADIUS = 3;

export function resolveUnitBehavior(unit: Unit): UnitBehavior {
  if (unit.faction !== 'player') {
    return 'attack';
  }
  return unit.getBehavior();
}
