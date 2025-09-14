import { AxialCoord, getNeighbors } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';
import { eventBus } from '../events';

export interface UnitStats {
  health: number;
  attackDamage: number;
  attackRange: number;
  movementRange: number;
}

type Listener = () => void;

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function fromKey(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function hexDistance(a: AxialCoord, b: AxialCoord): number {
  const ay = -a.q - a.r;
  const by = -b.q - b.r;
  return Math.max(
    Math.abs(a.q - b.q),
    Math.abs(a.r - b.r),
    Math.abs(ay - by)
  );
}

export class Unit {
  /** Whether the unit is still alive. */
  private alive = true;
  private listeners: { death?: Listener[] } = {};

  constructor(
    public readonly id: string,
    public coord: AxialCoord,
    public readonly faction: string,
    public readonly stats: UnitStats,
    public readonly priorityFactions: string[] = []
  ) {}

  onDeath(cb: Listener): void {
    (this.listeners.death ??= []).push(cb);
  }

  private emitDeath(): void {
    for (const cb of this.listeners.death ?? []) {
      cb();
    }
  }

  /** Check whether the unit has been killed. */
  isDead(): boolean {
    return !this.alive;
  }

  distanceTo(coord: AxialCoord): number {
    return hexDistance(this.coord, coord);
  }

  attack(target: Unit): void {
    if (this.distanceTo(target.coord) <= this.stats.attackRange) {
      target.takeDamage(this.stats.attackDamage, this);
    }
  }

  takeDamage(amount: number, attacker?: Unit): void {
    this.stats.health -= amount;
    eventBus.emit('unitDamaged', {
      attackerId: attacker?.id,
      targetId: this.id,
      amount,
      remainingHealth: this.stats.health
    });
    if (this.stats.health <= 0 && this.alive) {
      this.stats.health = 0;
      this.alive = false;
      eventBus.emit('unitDied', {
        unitId: this.id,
        attackerId: attacker?.id
      });
      this.emitDeath();
    }
  }

  /**
   * Calculate a path toward the target coordinate without moving immediately.
   *
   * The returned path includes the unit's current position as the first
   * element and at most {@link stats.movementRange} steps beyond it. This
   * allows an external animator to interpolate movement over multiple
   * animation frames.
   */
  moveTowards(target: AxialCoord, map: HexMap): AxialCoord[] {
    const path = this.findPath(target, map);
    if (path.length < 2) {
      return [];
    }
    const steps = Math.min(this.stats.movementRange, path.length - 1);
    return path.slice(0, steps + 1);
  }

  findPath(target: AxialCoord, map: HexMap): AxialCoord[] {
    const start = this.coord;
    const startKey = coordKey(start);
    const targetKey = coordKey(target);
    const queue: AxialCoord[] = [start];
    const cameFrom = new Map<string, string | null>();
    cameFrom.set(startKey, null);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentKey = coordKey(current);
      if (currentKey === targetKey) {
        break;
      }
      for (const neighbor of getNeighbors(current)) {
        if (!this.isPassable(neighbor, map)) {
          continue;
        }
        const nKey = coordKey(neighbor);
        if (cameFrom.has(nKey)) {
          continue;
        }
        queue.push(neighbor);
        cameFrom.set(nKey, currentKey);
      }
    }

    if (!cameFrom.has(targetKey)) {
      return [start];
    }

    const path: AxialCoord[] = [];
    let curr: string | null = targetKey;
    while (curr) {
      path.push(fromKey(curr));
      curr = cameFrom.get(curr) ?? null;
    }
    return path.reverse();
  }

  seekNearestEnemy(enemies: Unit[], map: HexMap): Unit | null {
    const enemyMap = new Map<string, Unit>();
    for (const enemy of enemies) {
      enemyMap.set(coordKey(enemy.coord), enemy);
    }
    const queue: AxialCoord[] = [this.coord];
    const visited = new Set<string>([coordKey(this.coord)]);
    while (queue.length > 0) {
      const current = queue.shift()!;
      const key = coordKey(current);
      const enemy = enemyMap.get(key);
      if (enemy) {
        return enemy;
      }
      for (const neighbor of getNeighbors(current)) {
        if (!this.isPassable(neighbor, map)) {
          continue;
        }
        const nKey = coordKey(neighbor);
        if (visited.has(nKey)) {
          continue;
        }
        visited.add(nKey);
        queue.push(neighbor);
      }
    }
    return null;
  }

  private isPassable(coord: AxialCoord, map: HexMap): boolean {
    const tile = map.getTile(coord.q, coord.r);
    if (!tile) {
      return false;
    }
    return tile.terrain !== 'water' && tile.terrain !== 'mountain';
  }
}

export { hexDistance };

