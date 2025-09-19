import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors, hexDistance } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';
import { TerrainId } from '../map/terrain.ts';
import { eventBus } from '../events';
import type { Sauna } from '../buildings/Sauna.ts';
import type { UnitStats } from '../unit/types.ts';
import type {
  CombatParticipant,
  CombatHookMap,
  CombatKeywordRegistry,
  CombatResolution
} from '../combat/resolve.ts';
import { resolveCombat } from '../combat/resolve.ts';

export const UNIT_MOVEMENT_STEP_SECONDS = 5;

type Listener = () => void;

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function fromKey(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export class Unit {
  /** Whether the unit is still alive. */
  private alive = true;
  private listeners: { death?: Listener[] } = {};
  private maxHealth: number;
  private healMarkerElapsed = 0;
  private healAmountBuffer = 0;
  private cachedTargetKey?: string;
  private cachedStartKey?: string;
  private cachedPath?: AxialCoord[];
  private movementCooldownSeconds = 0;
  private shield = 0;
  private immortal = false;

  public combatHooks: CombatHookMap | null = null;
  public combatKeywords: CombatKeywordRegistry | null = null;

  constructor(
    public readonly id: string,
    public readonly type: string,
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

  /** Return how far this unit can see other actors on the battlefield. */
  getVisionRange(): number {
    const { visionRange } = this.stats;
    return Number.isFinite(visionRange) ? (visionRange as number) : 3;
  }

  attack(target: Unit): CombatResolution | null {
    if (this.distanceTo(target.coord) > this.stats.attackRange) {
      return null;
    }

    return target.takeDamage(this.stats.attackDamage, this);
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
        const healed = this.stats.health - before;
        this.healMarkerElapsed += dt;
        this.healAmountBuffer += healed;
        const needsFlush = this.healMarkerElapsed >= 0.9 || this.healAmountBuffer >= 2;
        if (needsFlush) {
          this.flushHealEvent();
        }
      }
    } else {
      if (this.healAmountBuffer > 0) {
        this.flushHealEvent();
      }
      this.healMarkerElapsed = 0;
      this.healAmountBuffer = 0;
    }
  }

  private flushHealEvent(): void {
    if (this.healAmountBuffer <= 0) {
      this.healMarkerElapsed = 0;
      return;
    }
    const amount = Math.round(this.healAmountBuffer * 10) / 10;
    if (amount > 0) {
      eventBus.emit('unitHealed', {
        unitId: this.id,
        amount,
        remainingHealth: this.stats.health
      });
    }
    this.healAmountBuffer = 0;
    this.healMarkerElapsed = 0;
  }

  takeDamage(amount?: number, attacker?: Unit): CombatResolution | null {
    const hasDirectAmount = Number.isFinite(amount);
    if (hasDirectAmount && (amount as number) <= 0) {
      return null;
    }
    if (!hasDirectAmount && !attacker) {
      return null;
    }

    const attackerParticipant = attacker ? attacker.toCombatParticipant() : null;
    const defenderParticipant = this.toCombatParticipant();
    const result = resolveCombat({
      attacker: attackerParticipant,
      defender: defenderParticipant,
      baseDamage: hasDirectAmount ? (amount as number) : undefined
    });

    this.stats.health = result.remainingHealth;
    this.shield = result.remainingShield;

    let finalResult = result;

    if (result.lethal && this.alive && this.immortal) {
      this.stats.health = Math.max(1, this.stats.health);
      finalResult = {
        ...result,
        lethal: false,
        remainingHealth: this.stats.health,
        remainingShield: this.shield
      };
    }

    if (attacker && result.attackerRemainingHealth !== undefined) {
      const healed = Math.min(attacker.getMaxHealth(), Math.max(0, result.attackerRemainingHealth));
      attacker.stats.health = healed;
    }

    if (attacker && result.attackerRemainingShield !== undefined) {
      attacker.setShield(result.attackerRemainingShield);
    }

    if (finalResult.damage > 0) {
      eventBus.emit('unitDamaged', {
        attackerId: attacker?.id,
        targetId: this.id,
        amount: finalResult.damage,
        remainingHealth: this.stats.health
      });
    }

    if (finalResult.lethal && this.alive) {
      this.stats.health = 0;
      this.alive = false;
      eventBus.emit('unitDied', {
        unitId: this.id,
        attackerId: attacker?.id,
        unitFaction: this.faction,
        attackerFaction: attacker?.faction
      });
      this.emitDeath();
    }

    return finalResult;
  }

  getShield(): number {
    return this.shield;
  }

  setShield(value: number): void {
    if (!Number.isFinite(value) || value <= 0) {
      this.shield = 0;
      return;
    }
    this.shield = value;
  }

  isImmortal(): boolean {
    return this.immortal;
  }

  setImmortal(value: boolean): void {
    this.immortal = Boolean(value);
  }

  private toCombatParticipant(): CombatParticipant {
    return {
      id: this.id,
      faction: this.faction,
      attack: this.stats.attackDamage,
      defense: this.stats.defense,
      health: this.stats.health,
      maxHealth: this.maxHealth,
      shield: this.shield,
      hooks: this.combatHooks,
      keywords: this.combatKeywords
    };
  }

  addMovementTime(delta: number): void {
    if (!Number.isFinite(delta) || delta <= 0) {
      return;
    }
    this.movementCooldownSeconds += delta;
  }

  canStep(stepCost = UNIT_MOVEMENT_STEP_SECONDS): boolean {
    return this.movementCooldownSeconds >= stepCost;
  }

  consumeMovementCooldown(stepCost = UNIT_MOVEMENT_STEP_SECONDS): boolean {
    if (!this.canStep(stepCost)) {
      return false;
    }
    this.movementCooldownSeconds -= stepCost;
    return true;
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
    const path = this.getPathTo(target, map, occupied);
    if (path.length < 2) {
      return [];
    }
    // Stop before the first occupied tile in the path
    let endIndex = 0;
    const targetKey = coordKey(target);
    for (let i = 1; i < path.length; i++) {
      const key = coordKey(path[i]);
      if (occupied.has(key)) {
        if (key !== targetKey) {
          this.clearPathCache();
        }
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

  getPathTo(
    target: AxialCoord,
    map: HexMap,
    occupied: Set<string>
  ): AxialCoord[] {
    const startKey = coordKey(this.coord);
    const targetKey = coordKey(target);
    if (
      !this.cachedPath ||
      this.cachedTargetKey !== targetKey ||
      this.cachedStartKey !== startKey
    ) {
      this.cachedPath = this.findPath(target, map, occupied);
      this.cachedTargetKey = targetKey;
      this.cachedStartKey = startKey;
    }
    return this.cachedPath!;
  }

  advancePathCache(toIndex: number): void {
    if (!this.cachedPath || toIndex <= 0) {
      return;
    }
    this.cachedPath = this.cachedPath.slice(toIndex);
    if (this.cachedPath.length > 0) {
      this.cachedStartKey = coordKey(this.cachedPath[0]);
    } else {
      this.cachedPath = undefined;
      this.cachedStartKey = undefined;
      this.cachedTargetKey = undefined;
    }
  }

  clearPathCache(): void {
    this.cachedPath = undefined;
    this.cachedStartKey = undefined;
    this.cachedTargetKey = undefined;
  }

  findPath(
    target: AxialCoord,
    map: HexMap,
    occupied: Set<string>
  ): AxialCoord[] {
    const start = this.coord;
    const startKey = coordKey(start);
    const targetKey = coordKey(target);
    const open = new Set<string>([startKey]);
    const cameFrom = new Map<string, string | null>([[startKey, null]]);
    const gScore = new Map<string, number>([[startKey, 0]]);
    const fScore = new Map<string, number>([[startKey, hexDistance(start, target)]]);

    while (open.size > 0) {
      let currentKey: string | null = null;
      let bestF = Infinity;
      for (const key of open) {
        const value = fScore.get(key) ?? Infinity;
        if (value < bestF) {
          bestF = value;
          currentKey = key;
        }
      }
      if (currentKey === null) {
        break;
      }
      if (currentKey === targetKey) {
        break;
      }
      open.delete(currentKey);
      const current = fromKey(currentKey);
      const currentG = gScore.get(currentKey) ?? Infinity;
      for (const neighbor of getNeighbors(current)) {
        const neighborKey = coordKey(neighbor);
        if (neighborKey !== targetKey && !this.isPassable(neighbor, map, occupied)) {
          continue;
        }
        const tentativeG = currentG + 1;
        if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
          cameFrom.set(neighborKey, currentKey);
          gScore.set(neighborKey, tentativeG);
          fScore.set(neighborKey, tentativeG + hexDistance(neighbor, target));
          open.add(neighborKey);
        }
      }
    }

    if (!cameFrom.has(targetKey)) {
      return [start];
    }

    const path: AxialCoord[] = [];
    let current: string | null = targetKey;
    while (current) {
      path.push(fromKey(current));
      current = cameFrom.get(current) ?? null;
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

  canTraverse(
    coord: AxialCoord,
    map: HexMap,
    occupied?: Set<string>
  ): boolean {
    return this.isPassable(coord, map, occupied);
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
