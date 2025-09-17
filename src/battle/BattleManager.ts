import { Unit } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { Targeting } from '../ai/Targeting.ts';

export const MAX_ENEMIES = 30;

function coordKey(c: { q: number; r: number }): string {
  return `${c.q},${c.r}`;
}

/** Handles unit movement and combat each game tick. */
export class BattleManager {
  private nextUnitIndex = 0;

  constructor(private readonly map: HexMap) {}

  /** Process a single game tick for the provided units. */
  tick(units: Unit[]): void {
    const totalUnits = units.length;
    if (totalUnits === 0) {
      this.nextUnitIndex = 0;
      return;
    }

    const occupied = new Set<string>();
    for (const u of units) {
      if (!u.isDead()) {
        occupied.add(coordKey(u.coord));
      }
    }

    if (this.nextUnitIndex >= totalUnits) {
      this.nextUnitIndex = 0;
    }

    const chunkSize = Math.max(1, Math.ceil(totalUnits / 2));
    for (let processed = 0; processed < chunkSize && processed < totalUnits; processed++) {
      const index = (this.nextUnitIndex + processed) % totalUnits;
      const unit = units[index];
      const originalKey = coordKey(unit.coord);
      occupied.delete(originalKey);

      if (unit.isDead()) {
        unit.clearPathCache();
        continue;
      }

      const target = Targeting.selectTarget(unit, units);
      if (!target || target.isDead()) {
        unit.clearPathCache();
        occupied.add(coordKey(unit.coord));
        continue;
      }

      const targetKey = coordKey(target.coord);
      const path = unit.getPathTo(target.coord, this.map, occupied);
      let destinationIndex = 0;
      let blocked = false;
      if (path.length > 1 && unit.stats.movementRange > 0) {
        const maxSteps = unit.stats.movementRange;
        for (let i = 1; i < path.length && i <= maxSteps; i++) {
          const stepKey = coordKey(path[i]);
          if (occupied.has(stepKey) && stepKey !== targetKey) {
            blocked = true;
            unit.clearPathCache();
            break;
          }
          destinationIndex = i;
          if (stepKey === targetKey) {
            break;
          }
        }
      }

      if (destinationIndex > 0) {
        unit.coord = path[destinationIndex];
        unit.advancePathCache(destinationIndex);
      } else if (blocked) {
        unit.clearPathCache();
      }

      const currentKey = coordKey(unit.coord);
      occupied.add(currentKey);

      const currentTargetKey = coordKey(target.coord);
      if (currentTargetKey !== targetKey) {
        unit.clearPathCache();
      }

      if (unit.distanceTo(target.coord) <= unit.stats.attackRange && !target.isDead()) {
        unit.attack(target);
        if (target.isDead()) {
          occupied.delete(currentTargetKey);
          unit.clearPathCache();
        }
      }
    }

    this.nextUnitIndex = (this.nextUnitIndex + chunkSize) % totalUnits;
  }
}

