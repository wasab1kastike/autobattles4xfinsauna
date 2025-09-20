import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors } from '../hex/HexUtils.ts';
import { Unit } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { Targeting } from '../ai/Targeting.ts';
import { RoundRobinScheduler } from '../ai/scheduler.ts';
import { PathCache } from '../ai/path_cache.ts';
import type { Sauna } from '../sim/sauna.ts';
import { damageSauna } from '../sim/sauna.ts';
import { eventBus } from '../events';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../events/types.ts';

export const MAX_ENEMIES = 30;

function coordKey(c: { q: number; r: number }): string {
  return `${c.q},${c.r}`;
}

/** Handles unit movement and combat each game tick. */
export class BattleManager {
  private readonly scheduler = new RoundRobinScheduler();
  private readonly pathCache = new PathCache();

  constructor(private readonly map: HexMap) {}

  private findExplorationGoal(
    unit: Unit,
    occupied: Set<string>
  ): AxialCoord | null {
    const start = unit.coord;
    const startTile = this.map.ensureTile(start.q, start.r);
    if (startTile.isFogged && unit.canTraverse(start, this.map, occupied)) {
      return start;
    }
    const visited = new Set<string>([coordKey(start)]);
    const queue: AxialCoord[] = [start];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighborCoords = getNeighbors(current);
      const neighborTiles = this.map.getNeighbors(current.q, current.r);

      for (let i = 0; i < neighborCoords.length; i++) {
        const coord = neighborCoords[i];
        const tile = neighborTiles[i];
        const key = coordKey(coord);

        if (visited.has(key)) {
          continue;
        }
        visited.add(key);

        if (!unit.canTraverse(coord, this.map, occupied)) {
          continue;
        }

        if (tile.isFogged) {
          return coord;
        }

        queue.push(coord);
      }
    }

    return null;
  }

  /** Process a single game tick for the provided units. */
  tick(units: Unit[], deltaSeconds: number, sauna?: Sauna): void {
    const totalUnits = units.length;
    const now = Date.now();

    this.pathCache.clearExpired(now);

    if (totalUnits === 0) {
      this.scheduler.reset();
      return;
    }

    for (const unit of units) {
      unit.addMovementTime(deltaSeconds);
    }

    const occupied = new Set<string>();
    const activeUnits: Unit[] = [];
    for (const u of units) {
      if (u.isDead()) {
        u.clearPathCache();
        this.pathCache.invalidateForUnit(u.id);
        continue;
      }
      this.pathCache.trackUnit(u);
      activeUnits.push(u);
      occupied.add(coordKey(u.coord));
    }

    if (activeUnits.length === 0) {
      this.scheduler.reset();
      return;
    }

    const scheduledUnits = this.scheduler.next(activeUnits);
    if (scheduledUnits.length === 0) {
      return;
    }

    for (const unit of scheduledUnits) {
      const originalKey = coordKey(unit.coord);
      occupied.delete(originalKey);

      if (unit.isDead()) {
        unit.clearPathCache();
        this.pathCache.invalidateForUnit(unit.id);
        continue;
      }

      const target = Targeting.selectTarget(unit, units);

      if (!target && sauna && !sauna.destroyed) {
        const attacked = this.tryAttackSauna(unit, sauna);
        if (attacked) {
          const currentKey = coordKey(unit.coord);
          occupied.add(currentKey);
          continue;
        }
      }

      if (!target) {
        let goal: AxialCoord | null = null;
        if (sauna && !sauna.destroyed) {
          goal = sauna.pos;
        }
        if (!goal) {
          goal = this.findExplorationGoal(unit, occupied);
        }
        if (goal) {
          const path = this.computeMovementPath(unit, goal, occupied, now);
          if (path.length > 1 && unit.stats.movementRange > 0) {
            const nextCoord = path[1];
            const stepKey = coordKey(nextCoord);
            if (!occupied.has(stepKey)) {
              if (!unit.canStep()) {
                occupied.add(originalKey);
                continue;
              }
              if (unit.consumeMovementCooldown()) {
                unit.coord = nextCoord;
                unit.advancePathCache(1);
                const currentKey = coordKey(unit.coord);
                if (currentKey === coordKey(goal)) {
                  unit.clearPathCache();
                }
                occupied.add(currentKey);
                continue;
              }
            } else {
              unit.clearPathCache();
            }
          } else {
            unit.clearPathCache();
          }
        } else {
          unit.clearPathCache();
        }
        const currentKey = coordKey(unit.coord);
        occupied.add(currentKey);
        if (sauna && !sauna.destroyed) {
          this.tryAttackSauna(unit, sauna);
        }
        continue;
      }

      if (target.isDead()) {
        unit.clearPathCache();
        occupied.add(originalKey);
        continue;
      }

      const targetKey = coordKey(target.coord);
      const path = this.pathCache.getPath(unit, target.coord, this.map, occupied, {
        now,
        targetId: target.id
      });
      if (path.length > 1 && unit.stats.movementRange > 0) {
        const nextCoord = path[1];
        const stepKey = coordKey(nextCoord);
        const steppingIntoTarget = stepKey === targetKey;
        if (!occupied.has(stepKey) || steppingIntoTarget) {
          if (unit.canStep() && unit.consumeMovementCooldown()) {
            unit.coord = nextCoord;
            unit.advancePathCache(1);
          }
        } else {
          unit.clearPathCache();
        }
      }

      const currentKey = coordKey(unit.coord);
      occupied.add(currentKey);

      const currentTargetKey = coordKey(target.coord);
      if (currentTargetKey !== targetKey) {
        unit.clearPathCache();
      }

      if (unit.distanceTo(target.coord) <= unit.stats.attackRange && !target.isDead()) {
        const resolution = unit.attack(target);
        if ((resolution?.lethal ?? false) || target.isDead()) {
          occupied.delete(currentTargetKey);
          unit.clearPathCache();
          this.pathCache.invalidateForUnit(target.id);
        }
      }
    }
  }

  private tryAttackSauna(unit: Unit, sauna: Sauna): boolean {
    if (unit.faction === 'player') {
      return false;
    }
    const range = unit.stats.attackRange;
    if (range <= 0) {
      return false;
    }
    if (unit.distanceTo(sauna.pos) > range) {
      return false;
    }
    const result = damageSauna(sauna, unit.stats.attackDamage);
    if (result.amount <= 0) {
      return false;
    }
    const damagePayload: SaunaDamagedPayload = {
      attackerId: unit.id,
      attackerFaction: unit.faction,
      amount: result.amount,
      remainingHealth: result.remainingHealth
    };
    eventBus.emit('saunaDamaged', damagePayload);
    if (result.destroyed) {
      const destroyedPayload: SaunaDestroyedPayload = {
        attackerId: unit.id,
        attackerFaction: unit.faction
      };
      eventBus.emit('saunaDestroyed', destroyedPayload);
    }
    return true;
  }

  private computeMovementPath(
    unit: Unit,
    destination: AxialCoord,
    occupied: Set<string>,
    now: number
  ): AxialCoord[] {
    const path = this.pathCache.getPath(unit, destination, this.map, occupied, { now });
    if (path.length < 2) {
      return [];
    }

    let endIndex = 0;
    const destinationKey = coordKey(destination);
    for (let i = 1; i < path.length; i++) {
      const key = coordKey(path[i]);
      if (occupied.has(key)) {
        if (key !== destinationKey) {
          unit.clearPathCache();
        }
        break;
      }
      endIndex = i;
    }

    if (endIndex === 0) {
      return [];
    }

    const steps = Math.min(unit.stats.movementRange, endIndex);
    return path.slice(0, steps + 1);
  }
}

