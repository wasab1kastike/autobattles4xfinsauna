import { Unit } from '../units/Unit.ts';

/** Target selection logic for units. */
export class Targeting {
  /**
   * Select an enemy target for a unit based on faction priorities, range and distance.
   */
  static selectTarget(
    unit: Unit,
    units: Unit[],
    predicate?: (enemy: Unit) => boolean
  ): Unit | null {
    let enemies = units.filter(
      (u) => u.faction !== unit.faction && !u.isDead()
    );
    if (predicate) {
      enemies = enemies.filter(predicate);
    }
    if (enemies.length === 0) {
      return null;
    }

    const nonStructureEnemies = enemies.filter(
      (enemy) => enemy.type !== 'stronghold-structure'
    );
    if (nonStructureEnemies.length > 0) {
      enemies = nonStructureEnemies;
    }

    if (unit.priorityFactions.length > 0) {
      const preferred = enemies.filter((e) =>
        unit.priorityFactions.includes(e.faction)
      );
      if (preferred.length > 0) {
        enemies = preferred;
      }
    }

    const inRange = enemies.filter(
      (e) => unit.distanceTo(e.coord) <= unit.stats.attackRange
    );
    if (inRange.length > 0) {
      inRange.sort((a, b) => {
        const healthDiff = a.stats.health - b.stats.health;
        if (healthDiff !== 0) {
          return healthDiff;
        }
        return unit.distanceTo(a.coord) - unit.distanceTo(b.coord);
      });
      return inRange[0];
    }

    enemies.sort(
      (a, b) => unit.distanceTo(a.coord) - unit.distanceTo(b.coord)
    );
    return enemies[0] ?? null;
  }
}

export default Targeting;
