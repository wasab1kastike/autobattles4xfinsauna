import { AxialCoord, getNeighbors } from './hex/HexUtils.ts';
import { HexMap } from './hexmap.ts';

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
  private listeners: { death?: Listener[] } = {};

  constructor(
    public readonly id: string,
    public coord: AxialCoord,
    public readonly faction: string,
    public readonly stats: UnitStats
  ) {}

  onDeath(cb: Listener): void {
    (this.listeners.death ??= []).push(cb);
  }

  private emitDeath(): void {
    for (const cb of this.listeners.death ?? []) {
      cb();
    }
  }

  isDead(): boolean {
    return this.stats.health <= 0;
  }

  distanceTo(coord: AxialCoord): number {
    return hexDistance(this.coord, coord);
  }

  attack(target: Unit): void {
    if (this.distanceTo(target.coord) <= this.stats.attackRange) {
      target.takeDamage(this.stats.attackDamage);
    }
  }

  takeDamage(amount: number): void {
    this.stats.health -= amount;
    if (this.stats.health <= 0) {
      this.stats.health = 0;
      this.emitDeath();
    }
  }

  moveTowards(target: AxialCoord, map: HexMap): void {
    const path = this.findPath(target, map);
    if (path.length < 2) {
      return;
    }
    const steps = Math.min(this.stats.movementRange, path.length - 1);
    this.coord = path[steps];
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

