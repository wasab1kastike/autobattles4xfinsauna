import { Unit } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { Targeting } from '../ai/Targeting.ts';
import { getNeighbors } from '../hex/HexUtils.ts';
import { TerrainId } from '../map/terrain.ts';

export const MAX_ENEMIES = 30;

function coordKey(c: { q: number; r: number }): string {
  return `${c.q},${c.r}`;
}

/** Handles unit movement and combat each game tick. */
export class BattleManager {
  constructor(private readonly map: HexMap) {}

  /** Process a single game tick for the provided units. */
  tick(units: Unit[]): void {
    const occupied = new Set<string>();
    for (const u of units) {
      if (!u.isDead()) {
        occupied.add(coordKey(u.coord));
      }
    }

    for (const unit of units) {
      const key = coordKey(unit.coord);
      occupied.delete(key);
      if (unit.isDead()) {
        continue;
      }
      const target = Targeting.selectTarget(unit, units);
      if (!target) {
        occupied.add(key);
        continue;
      }
      if (unit.distanceTo(target.coord) > unit.stats.attackRange) {
        const path = unit.moveTowards(target.coord, this.map, occupied);
        if (path.length > 0) {
          unit.coord = path[path.length - 1];
        } else if (unit.distanceTo(target.coord) > unit.stats.attackRange) {
          for (const neighbor of getNeighbors(unit.coord)) {
            const neighborKey = coordKey(neighbor);
            if (occupied.has(neighborKey)) {
              continue;
            }
            const tile = this.map.getTile(neighbor.q, neighbor.r);
            if (tile.terrain === TerrainId.Lake) {
              continue;
            }
            unit.coord = neighbor;
            break;
          }
        }
      }
      if (unit.distanceTo(target.coord) <= unit.stats.attackRange && !target.isDead()) {
        unit.attack(target);
        if (target.isDead()) {
          occupied.delete(coordKey(target.coord));
        }
      }
      occupied.add(coordKey(unit.coord));
    }
  }
}

