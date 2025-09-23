import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors, hexDistance } from '../hex/HexUtils.ts';
import { Unit } from '../units/Unit.ts';
import { HexMap } from '../hexmap.ts';
import { Targeting } from '../ai/Targeting.ts';
import { RoundRobinScheduler } from '../ai/scheduler.ts';
import { PathCache } from '../ai/path_cache.ts';
import type { UnitBehavior } from '../unit/types.ts';
import { DEFEND_PERIMETER_RADIUS, resolveUnitBehavior } from './unitBehavior.ts';
import type { Sauna } from '../sim/sauna.ts';
import { damageSauna } from '../sim/sauna.ts';
import { eventBus } from '../events';
import type { SaunaDamagedPayload, SaunaDestroyedPayload } from '../events/types.ts';
import type { Animator } from '../render/Animator.ts';

export const MAX_ENEMIES = 30;

function coordKey(c: { q: number; r: number }): string {
  return `${c.q},${c.r}`;
}

/** Handles unit movement and combat each game tick. */
export class BattleManager {
  private readonly scheduler = new RoundRobinScheduler();
  private readonly pathCache = new PathCache();
  private readonly lastKnownCoords = new Map<string, AxialCoord>();
  private lastEnemySighting: { coord: AxialCoord; timestamp: number } | null = null;

  constructor(private readonly map: HexMap, private readonly animator?: Animator) {}

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

    const occupied = new Set<string>();
    const activeUnits: Unit[] = [];
    const livingUnitIds = new Set<string>();
    for (const unit of units) {
      unit.addMovementTime(deltaSeconds);
      if (unit.isDead()) {
        unit.clearPathCache();
        this.pathCache.invalidateForUnit(unit.id);
        this.animator?.clear(unit);
        this.lastKnownCoords.delete(unit.id);
        continue;
      }

      const previous = this.lastKnownCoords.get(unit.id);
      if (previous && hexDistance(previous, unit.coord) > 1) {
        this.animator?.clear(unit, { snap: true });
      }
      this.lastKnownCoords.set(unit.id, { q: unit.coord.q, r: unit.coord.r });

      if (unit.faction !== 'player') {
        this.lastEnemySighting = {
          coord: { q: unit.coord.q, r: unit.coord.r },
          timestamp: now
        };
      }

      this.pathCache.trackUnit(unit);
      activeUnits.push(unit);
      occupied.add(coordKey(unit.coord));
      livingUnitIds.add(unit.id);
    }

    for (const id of [...this.lastKnownCoords.keys()]) {
      if (!livingUnitIds.has(id)) {
        this.lastKnownCoords.delete(id);
      }
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
        this.animator?.clear(unit);
        continue;
      }

      const requestedBehavior = unit.getBehavior();
      const isPlayerUnit = unit.faction === 'player';
      let behavior: UnitBehavior = isPlayerUnit
        ? requestedBehavior
        : resolveUnitBehavior(unit);
      const hasActiveSauna = Boolean(sauna && !sauna.destroyed);
      if (behavior === 'defend' && !hasActiveSauna) {
        behavior = 'attack';
      }

      const acquireTarget = (
        predicate?: (enemy: Unit) => boolean
      ): Unit | null => this.findClosestEnemy(unit, units, predicate);

      let target: Unit | null = null;

      if (behavior === 'defend') {
        if (isPlayerUnit && hasActiveSauna) {
          target = acquireTarget((enemy) =>
            hexDistance(enemy.coord, sauna.pos) <= DEFEND_PERIMETER_RADIUS
          );
        } else {
          target = acquireTarget();
        }
      } else if (behavior === 'explore') {
        const visionRange = unit.getVisionRange();
        target = acquireTarget(
          (enemy) => unit.distanceTo(enemy.coord) <= visionRange
        );
      } else {
        target = acquireTarget();
      }

      if (!target && sauna && !sauna.destroyed) {
        const attacked = this.tryAttackSauna(unit, sauna);
        if (attacked) {
          const currentKey = coordKey(unit.coord);
          occupied.add(currentKey);
          continue;
        }
      }

      if (!target) {
        if (this.lastEnemySighting && now - this.lastEnemySighting.timestamp > 60000) {
          this.lastEnemySighting = null;
        }

        let goal: AxialCoord | null = null;
        let handledIdle = false;

        if (isPlayerUnit) {
          if (behavior === 'defend') {
            handledIdle = true;
            if (hasActiveSauna) {
              const distance = hexDistance(unit.coord, sauna.pos);
              if (distance > DEFEND_PERIMETER_RADIUS) {
                goal = sauna.pos;
              }
            }
          } else if (behavior === 'attack') {
            handledIdle = true;
            if (this.lastEnemySighting) {
              goal = { ...this.lastEnemySighting.coord };
            } else {
              const reference = hasActiveSauna ? sauna.pos : unit.coord;
              goal = this.getBoardEdgeGoal(reference, unit.coord);
            }
          }
        }

        if (!handledIdle) {
          if (sauna && !sauna.destroyed) {
            goal = sauna.pos;
          }
          if (!goal) {
            goal = this.findExplorationGoal(unit, occupied);
          }
        }

        if (goal && coordKey(goal) === originalKey) {
          goal = null;
        }

        if (goal) {
          this.map.ensureTile(goal.q, goal.r);
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
                const previous = { q: unit.coord.q, r: unit.coord.r };
                if (this.animator) {
                  unit.setCoord(nextCoord, { snapRender: false });
                  this.animator.enqueue(unit, [previous, nextCoord]);
                } else {
                  unit.setCoord(nextCoord);
                }
                unit.advancePathCache(1);
                const currentKey = coordKey(unit.coord);
                if (currentKey === coordKey(goal)) {
                  unit.clearPathCache();
                }
                occupied.add(currentKey);
                this.lastKnownCoords.set(unit.id, { q: unit.coord.q, r: unit.coord.r });
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
            const previous = { q: unit.coord.q, r: unit.coord.r };
            if (this.animator) {
              unit.setCoord(nextCoord, { snapRender: false });
              this.animator.enqueue(unit, [previous, nextCoord]);
            } else {
              unit.setCoord(nextCoord);
            }
            unit.advancePathCache(1);
          }
        } else {
          unit.clearPathCache();
        }
      }

      const currentKey = coordKey(unit.coord);
      occupied.add(currentKey);
      this.lastKnownCoords.set(unit.id, { q: unit.coord.q, r: unit.coord.r });

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
          this.animator?.clear(target);
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

  private findClosestEnemy(
    unit: Unit,
    units: Unit[],
    predicate?: (enemy: Unit) => boolean
  ): Unit | null {
    return Targeting.selectTarget(unit, units, predicate);
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

  private getBoardEdgeGoal(reference: AxialCoord, unitCoord: AxialCoord): AxialCoord {
    const clampQ = (q: number) => Math.min(this.map.maxQ, Math.max(this.map.minQ, q));
    const clampR = (r: number) => Math.min(this.map.maxR, Math.max(this.map.minR, r));
    const deltaQ = unitCoord.q - reference.q;
    const deltaR = unitCoord.r - reference.r;

    const qTarget = deltaQ >= 0 ? this.map.maxQ : this.map.minQ;
    const rTarget = deltaR >= 0 ? this.map.maxR : this.map.minR;

    const candidates: AxialCoord[] = [
      { q: qTarget, r: clampR(unitCoord.r) },
      { q: clampQ(unitCoord.q), r: rTarget },
      { q: qTarget, r: rTarget }
    ];

    let best = candidates[0];
    let bestDistance = -Infinity;
    for (const candidate of candidates) {
      const distance = hexDistance(unitCoord, candidate);
      if (distance > bestDistance) {
        bestDistance = distance;
        best = candidate;
      }
    }

    return { q: best.q, r: best.r };
  }
}

