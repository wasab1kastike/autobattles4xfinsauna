import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors, axialToPixel } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';
import { TerrainId } from '../map/terrain.ts';
import { eventBus } from '../events';
import type { Sauna } from '../buildings/Sauna.ts';

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
  private maxHealth: number;
  private healMarkerElapsed = 0;

  constructor(
    public readonly id: string,
    public coord: AxialCoord,
    public readonly faction: string,
    public readonly stats: UnitStats,
    public readonly priorityFactions: string[] = []
  ) {
    this.maxHealth = stats.health;
  }

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

  /** Return the unit's maximum health. */
  getMaxHealth(): number {
    return this.maxHealth;
  }

  distanceTo(coord: AxialCoord): number {
    return hexDistance(this.coord, coord);
  }

  attack(target: Unit): void {
    if (this.distanceTo(target.coord) <= this.stats.attackRange) {
      target.takeDamage(this.stats.attackDamage, this);
    }
  }

  update(dt: number, sauna?: Sauna): void {
    if (this.isDead() || !sauna) {
      return;
    }
    if (hexDistance(this.coord, sauna.pos) <= sauna.auraRadius) {
      const before = this.stats.health;
      this.stats.health = Math.min(
        this.stats.health + sauna.regenPerSec * dt,
        this.maxHealth
      );
      if (this.stats.health > before) {
        this.healMarkerElapsed += dt;
        if (this.healMarkerElapsed >= 1) {
          this.healMarkerElapsed = 0;
          this.spawnHealMarker();
        }
      }
    } else {
      this.healMarkerElapsed = 0;
    }
  }

  private spawnHealMarker(): void {
    if (typeof document === 'undefined') return;
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const { x, y } = axialToPixel(this.coord, 32);
    const marker = document.createElement('div');
    marker.textContent = '+';
    marker.className = 'heal-marker';
    marker.style.position = 'absolute';
    const rect = canvas.getBoundingClientRect();
    marker.style.left = `${rect.left + x}px`;
    marker.style.top = `${rect.top + y}px`;
    marker.style.pointerEvents = 'none';
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 1000);
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
  moveTowards(
    target: AxialCoord,
    map: HexMap,
    occupied: Set<string>
  ): AxialCoord[] {
    const path = this.findPath(target, map, occupied);
    if (path.length < 2) {
      return [];
    }
    // Stop before the first occupied tile in the path
    let endIndex = 0;
    for (let i = 1; i < path.length; i++) {
      const key = coordKey(path[i]);
      if (occupied.has(key)) {
        break;
      }
      endIndex = i;
    }
    if (endIndex === 0) {
      return [];
    }
    const steps = Math.min(this.stats.movementRange, endIndex);
    return path.slice(0, steps + 1);
  }

  findPath(
    target: AxialCoord,
    map: HexMap,
    occupied: Set<string>
  ): AxialCoord[] {
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
        const nKey = coordKey(neighbor);
        if (nKey !== targetKey && !this.isPassable(neighbor, map, occupied)) {
          continue;
        }
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

  seekNearestEnemy(
    enemies: Unit[],
    map: HexMap,
    occupied: Set<string>
  ): Unit | null {
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
        const nKey = coordKey(neighbor);
        const enemyAtNeighbor = enemyMap.get(nKey);
        if (enemyAtNeighbor) {
          return enemyAtNeighbor;
        }
        if (!this.isPassable(neighbor, map, occupied)) {
          continue;
        }
        if (visited.has(nKey)) {
          continue;
        }
        visited.add(nKey);
        queue.push(neighbor);
      }
    }
    return null;
  }

  private isPassable(
    coord: AxialCoord,
    map: HexMap,
    occupied?: Set<string>
  ): boolean {
    const tile = map.getTile(coord.q, coord.r);
    if (!tile) {
      return false;
    }
    if (occupied && occupied.has(coordKey(coord))) {
      return false;
    }
    return tile.terrain !== TerrainId.Lake;
  }
}

export { hexDistance };

