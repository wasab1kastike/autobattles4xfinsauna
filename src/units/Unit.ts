import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors, hexDistance } from '../hex/HexUtils.ts';
import { HexMap } from '../hexmap.ts';
import { TerrainId } from '../map/terrain.ts';
import { eventBus } from '../events';
import type { Sauna } from '../buildings/Sauna.ts';
import type { UnitBehavior, UnitStats } from '../unit/types.ts';
import { normalizeAppearanceId } from '../unit/appearance.ts';
import { PriorityQueue } from './PriorityQueue.ts';
import type {
  CombatParticipant,
  CombatHookMap,
  CombatKeywordRegistry,
  CombatResolution
} from '../combat/resolve.ts';
import type { KeywordEffectSummary } from '../keywords/index.ts';
import { resolveCombat } from '../combat/resolve.ts';
import { UNIT_ATTACK_IMPACT_MS, UNIT_ATTACK_TOTAL_MS } from '../combat/timing.ts';
import type { UnitAttackPayload } from '../events/types.ts';

export const UNIT_MOVEMENT_STEP_SECONDS = 5;

type Listener = () => void;

interface RogueAmbushState {
  teleportRange: number;
  burstMultiplier: number;
  firstStrikeReady: boolean;
}

function coordKey(c: AxialCoord): string {
  return `${c.q},${c.r}`;
}

function fromKey(key: string): AxialCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

function cloneCoord(coord: AxialCoord): AxialCoord {
  return { q: coord.q, r: coord.r };
}

function cloneKeywordEffects(summary: KeywordEffectSummary): KeywordEffectSummary {
  return {
    attacker: { ...summary.attacker },
    defender: { ...summary.defender }
  } satisfies KeywordEffectSummary;
}

function normalizeHealthStat(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, value);
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
  private experience = 0;
  private behavior: UnitBehavior;
  private appearanceId: string;
  private attackProfile: string | null = null;
  private rogueAmbush: RogueAmbushState | null = null;
  private tauntAuraRadius = 0;
  private tauntActive = false;

  public stats: UnitStats;
  public combatHooks: CombatHookMap | null = null;
  public combatKeywords: CombatKeywordRegistry | null = null;

  public coord: AxialCoord;
  public renderCoord: AxialCoord;

  constructor(
    public readonly id: string,
    public readonly type: string,
    coord: AxialCoord,
    public readonly faction: string,
    stats: UnitStats,
    public readonly priorityFactions: string[] = [],
    behavior?: UnitBehavior,
    appearanceId?: string,
    public readonly isBoss = false
  ) {
    this.coord = cloneCoord(coord);
    this.renderCoord = cloneCoord(coord);
    this.stats = { ...stats };
    this.maxHealth = normalizeHealthStat(this.stats.health);
    this.stats.health = this.maxHealth;
    if (
      typeof this.stats.damageDealtMultiplier !== 'number' ||
      !Number.isFinite(this.stats.damageDealtMultiplier)
    ) {
      delete this.stats.damageDealtMultiplier;
    }
    if (
      typeof this.stats.damageTakenMultiplier !== 'number' ||
      !Number.isFinite(this.stats.damageTakenMultiplier)
    ) {
      delete this.stats.damageTakenMultiplier;
    }
    this.behavior = behavior ?? (faction === 'player' ? 'defend' : 'attack');
    this.appearanceId = this.sanitizeAppearanceId(appearanceId);
  }

  setCoord(coord: AxialCoord, options?: { snapRender?: boolean }): void {
    this.coord = cloneCoord(coord);
    if (options?.snapRender ?? true) {
      this.renderCoord = cloneCoord(coord);
    }
  }

  setRenderCoord(coord: AxialCoord): void {
    this.renderCoord = cloneCoord(coord);
  }

  snapRenderToCoord(coord: AxialCoord = this.coord): void {
    this.renderCoord = cloneCoord(coord);
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

  getBehavior(): UnitBehavior {
    return this.behavior;
  }

  setBehavior(behavior: UnitBehavior): void {
    this.behavior = behavior;
  }

  getAppearanceId(): string {
    return this.appearanceId;
  }

  setAppearanceId(appearanceId?: string | null): void {
    this.appearanceId = this.sanitizeAppearanceId(appearanceId ?? undefined);
  }

  getAttackProfile(): string | null {
    return this.attackProfile;
  }

  setAttackProfile(profile?: string | null): void {
    if (typeof profile === 'string') {
      const normalized = profile.trim();
      this.attackProfile = normalized.length > 0 ? normalized : null;
      return;
    }
    this.attackProfile = null;
  }

  hasRogueAmbush(): boolean {
    return this.rogueAmbush !== null;
  }

  getRogueAmbushRange(): number {
    return this.rogueAmbush?.teleportRange ?? 0;
  }

  setRogueAmbush(options?: { teleportRange: number; burstMultiplier: number }): void {
    if (!options) {
      this.rogueAmbush = null;
      return;
    }
    const normalizedRange = Number.isFinite(options.teleportRange)
      ? Math.max(1, Math.floor(options.teleportRange))
      : 0;
    if (normalizedRange <= 0) {
      this.rogueAmbush = null;
      return;
    }
    const normalizedBurst = Number.isFinite(options.burstMultiplier)
      ? Math.max(1, options.burstMultiplier)
      : 1;
    const firstStrikeReady = this.rogueAmbush?.firstStrikeReady ?? false;
    this.rogueAmbush = {
      teleportRange: normalizedRange,
      burstMultiplier: normalizedBurst,
      firstStrikeReady
    } satisfies RogueAmbushState;
  }

  markRogueAmbushTeleport(): void {
    if (this.rogueAmbush) {
      this.rogueAmbush.firstStrikeReady = true;
    }
  }

  hasTauntAura(): boolean {
    return this.tauntAuraRadius > 0;
  }

  getTauntAuraRadius(): number {
    return this.tauntAuraRadius;
  }

  setTauntAura(radius?: number | null): void {
    const normalized = Number.isFinite(radius)
      ? Math.max(0, Math.floor(radius as number))
      : 0;
    this.tauntAuraRadius = normalized;
    if (normalized <= 0) {
      this.setTauntActive(false);
    }
  }

  isTauntActive(): boolean {
    return this.tauntActive;
  }

  setTauntActive(active: boolean): void {
    const next = this.tauntAuraRadius > 0 && Boolean(active);
    if (this.tauntActive === next) {
      return;
    }
    this.tauntActive = next;
    eventBus.emit('unit:tauntChanged', {
      unitId: this.id,
      active: this.tauntActive,
      radius: this.tauntAuraRadius
    });
  }

  private sanitizeAppearanceId(candidate?: string): string {
    const normalized = normalizeAppearanceId(candidate);
    if (normalized) {
      return normalized;
    }
    return this.type;
  }

  attack(target: Unit): CombatResolution | null {
    if (this.distanceTo(target.coord) > this.stats.attackRange) {
      return null;
    }

    const originalMultiplier = this.stats.damageDealtMultiplier;
    let boosted = false;
    if (this.rogueAmbush?.firstStrikeReady) {
      const baseMultiplier = Number.isFinite(originalMultiplier)
        ? (originalMultiplier as number)
        : 1;
      const burst = baseMultiplier * this.rogueAmbush.burstMultiplier;
      this.stats.damageDealtMultiplier = burst;
      this.rogueAmbush.firstStrikeReady = false;
      boosted = true;
    }

    const now =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    const attackerCoord = { q: this.coord.q, r: this.coord.r };
    const targetCoord = { q: target.coord.q, r: target.coord.r };
    const impactAt = now + UNIT_ATTACK_IMPACT_MS;
    const recoverAt = now + UNIT_ATTACK_TOTAL_MS;
    const attackProfile = this.getAttackProfile() ?? undefined;
    const payload: UnitAttackPayload = {
      attackerId: this.id,
      targetId: target.id,
      attackerCoord,
      targetCoord,
      timestamp: now,
      impactAt,
      recoverAt,
      attackProfile
    };
    eventBus.emit('unitAttack', payload);
    try {
      const resolution = target.takeDamage(this.stats.attackDamage, this, { impactAt });
      return resolution;
    } finally {
      if (boosted) {
        if (originalMultiplier === undefined) {
          delete this.stats.damageDealtMultiplier;
        } else {
          this.stats.damageDealtMultiplier = originalMultiplier;
        }
      }
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

  takeDamage(
    amount?: number,
    attacker?: Unit,
    options?: { impactAt?: number }
  ): CombatResolution | null {
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
      const eventTimestamp = options?.impactAt ??
        (typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now());
      const keywordEffects = cloneKeywordEffects(finalResult.keywordEffects);
      const attackerHealing = Math.max(0, finalResult.attackerHealing);
      eventBus.emit('unitDamaged', {
        attackerId: attacker?.id,
        targetId: this.id,
        targetCoord: { q: this.coord.q, r: this.coord.r },
        amount: finalResult.damage,
        remainingHealth: this.stats.health,
        timestamp: eventTimestamp,
        keywordEffects,
        ...(attackerHealing > 0 ? { attackerHealing } : {})
      });
    }

    if (finalResult.lethal && this.alive) {
      this.stats.health = 0;
      this.alive = false;
      this.snapRenderToCoord();
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

  updateStats(stats: UnitStats): void {
    this.stats.attackDamage = stats.attackDamage;
    this.stats.attackRange = stats.attackRange;
    this.stats.movementRange = stats.movementRange;
    if (typeof stats.defense === 'number' && Number.isFinite(stats.defense)) {
      this.stats.defense = stats.defense;
    } else {
      delete this.stats.defense;
    }
    if (typeof stats.visionRange === 'number' && Number.isFinite(stats.visionRange)) {
      this.stats.visionRange = stats.visionRange;
    }
    if (
      typeof stats.damageDealtMultiplier === 'number' &&
      Number.isFinite(stats.damageDealtMultiplier)
    ) {
      this.stats.damageDealtMultiplier = stats.damageDealtMultiplier;
    } else {
      delete this.stats.damageDealtMultiplier;
    }
    if (
      typeof stats.damageTakenMultiplier === 'number' &&
      Number.isFinite(stats.damageTakenMultiplier)
    ) {
      this.stats.damageTakenMultiplier = stats.damageTakenMultiplier;
    } else if (stats.damageTakenMultiplier === 0) {
      this.stats.damageTakenMultiplier = 0;
    } else {
      delete this.stats.damageTakenMultiplier;
    }
    const newMax = Math.max(1, Math.round(stats.health));
    this.maxHealth = newMax;
    this.stats.health = Math.min(newMax, Math.max(0, this.stats.health));
  }

  isImmortal(): boolean {
    return this.immortal;
  }

  setImmortal(value: boolean): void {
    this.immortal = Boolean(value);
  }

  getExperience(): number {
    return this.experience;
  }

  setExperience(value: number): void {
    const normalized = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
    if (normalized === this.experience) {
      return;
    }
    this.experience = normalized;
    eventBus.emit('unit:xpChanged', { unitId: this.id, xp: this.experience });
  }

  addExperience(delta: number): number {
    if (!Number.isFinite(delta) || delta === 0) {
      return this.experience;
    }
    const next = Math.max(0, Math.floor(this.experience + delta));
    this.setExperience(next);
    return this.experience;
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
      keywords: this.combatKeywords,
      damageDealtMultiplier: this.stats.damageDealtMultiplier,
      damageTakenMultiplier: this.stats.damageTakenMultiplier
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
    const cameFrom = new Map<string, string | null>([[startKey, null]]);
    const gScore = new Map<string, number>([[startKey, 0]]);
    const startFScore = hexDistance(start, target);
    const fScore = new Map<string, number>([[startKey, startFScore]]);
    const open = new PriorityQueue<string>();
    const inOpen = new Map<string, number>();
    open.push(startKey, startFScore);
    inOpen.set(startKey, startFScore);

    while (!open.isEmpty()) {
      const currentEntry = open.pop();
      if (!currentEntry) {
        break;
      }
      const { value: currentKey, priority } = currentEntry;
      const trackedPriority = inOpen.get(currentKey);
      if (trackedPriority === undefined || trackedPriority !== priority) {
        continue;
      }
      inOpen.delete(currentKey);
      if (currentKey === targetKey) {
        break;
      }
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
          const neighborFScore = tentativeG + hexDistance(neighbor, target);
          fScore.set(neighborKey, neighborFScore);
          open.push(neighborKey, neighborFScore);
          inOpen.set(neighborKey, neighborFScore);
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
