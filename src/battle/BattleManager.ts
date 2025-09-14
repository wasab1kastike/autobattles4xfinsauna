import { Unit } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';

/** Handles unit movement and combat each game tick. */
export class BattleManager {
  constructor(private readonly map: HexMap) {}

  /** Process a single game tick for the provided units. */
  tick(units: Unit[]): void {
    for (const unit of units) {
      if (unit.isDead()) continue;
      const enemies = units.filter(
        (u) => u.faction !== unit.faction && !u.isDead()
      );
      if (enemies.length === 0) continue;
      const target = unit.seekNearestEnemy(enemies, this.map);
      if (!target) continue;
      if (unit.distanceTo(target.coord) > unit.stats.attackRange) {
        unit.moveTowards(target.coord, this.map);
      }
      if (unit.distanceTo(target.coord) <= unit.stats.attackRange && !target.isDead()) {
        unit.attack(target);
      }
    }
  }
}

