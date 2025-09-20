import type { Unit } from '../units/Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';
import {
  evaluateEnemyRamp,
  getEnemyCadenceDecay,
  getEnemyMultiplierGrowth,
  type EnemyRampEvaluation
} from '../data/difficultyCurves.ts';
import { pickRampBundle, spawnEnemyBundle } from '../world/spawn/enemy_spawns.ts';

export interface EnemySpawnerOptions {
  readonly factionId?: string;
  readonly random?: () => number;
  readonly idFactory?: () => string;
  readonly difficulty?: number;
  readonly eliteOdds?: number;
}

export interface EnemySpawnerSnapshot {
  readonly runSeconds: number;
  readonly clears: number;
  readonly spawnCycles: number;
  readonly rampStageIndex: number;
  readonly rampStageId: string;
  readonly rampStageLabel: string;
  readonly bundleTier: number;
  readonly cadence: number;
  readonly lastCadence: number;
  readonly lastSpawnAt: number | null;
  readonly lastClearAt: number | null;
  readonly difficultyMultiplier: number;
}

const MAX_SPAWNS_PER_UPDATE = 6;

export class EnemySpawner {
  private timer: number;
  private interval: number;
  private spawnCycles: number;
  private readonly factionId: string;
  private readonly random: () => number;
  private readonly makeId: () => string;
  private readonly difficulty: number;
  private readonly eliteOdds: number;
  private readonly cadenceDecay: number;
  private readonly multiplierGrowth: number;
  private runSeconds = 0;
  private clearCount = 0;
  private boardEmpty = true;
  private lastClearAt: number | null = null;
  private lastSpawnAt: number | null = null;
  private lastCadence: number;
  private lastMultiplier: number;
  private rampEvaluation: EnemyRampEvaluation;
  private rampStageIndex: number;

  constructor(options: EnemySpawnerOptions = {}) {
    this.factionId = options.factionId ?? 'enemy';
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    const difficulty = Number.isFinite(options.difficulty) ? Number(options.difficulty) : 1;
    this.difficulty = Math.max(0.5, difficulty);
    const odds = typeof options.eliteOdds === 'number' ? options.eliteOdds : 0;
    this.eliteOdds = Math.max(0, Math.min(0.95, odds));
    this.cadenceDecay = getEnemyCadenceDecay(this.difficulty);
    this.multiplierGrowth = getEnemyMultiplierGrowth(this.difficulty);
    this.spawnCycles = 0;
    this.rampEvaluation = evaluateEnemyRamp(this.difficulty, {
      runSeconds: 0,
      clears: 0,
      spawnCycles: 0
    });
    this.rampStageIndex = this.rampEvaluation.stageIndex;
    this.interval = this.rampEvaluation.cadenceTarget;
    this.timer = this.interval;
    this.lastCadence = this.interval;
    this.lastMultiplier = this.rampEvaluation.multiplierBase;
    const fallbackIdFactory = (() => {
      let counter = 0;
      return () => `e${Date.now()}-${(counter += 1)}`;
    })();
    this.makeId = typeof options.idFactory === 'function' ? options.idFactory : fallbackIdFactory;
  }

  update(
    dt: number,
    units: Unit[],
    addUnit: (u: Unit) => void,
    pickEdge: () => AxialCoord | undefined
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    this.runSeconds += dt;
    this.resolveRampState();

    const enemyCount = this.countActiveEnemies(units);
    this.trackClears(enemyCount);

    this.timer -= dt;
    let spawnsThisTick = 0;
    while (this.timer <= 0 && spawnsThisTick < MAX_SPAWNS_PER_UPDATE) {
      const availableSlots = this.getAvailableSlots(units);
      if (availableSlots <= 0) {
        this.timer = Math.max(this.timer, 0.5);
        break;
      }

      const evaluation = this.resolveRampState();
      const bundle = pickRampBundle(this.factionId, evaluation.stage.bundleTier, this.random);
      const multiplier = this.computeMultiplier(evaluation);
      const result = spawnEnemyBundle({
        bundle,
        factionId: this.factionId,
        pickEdge,
        addUnit,
        makeId: this.makeId,
        availableSlots,
        eliteOdds: this.eliteOdds,
        random: this.random,
        difficultyMultiplier: multiplier,
        rampTier: evaluation.stage.bundleTier
      });

      if (result.spawned.length === 0) {
        this.timer = Math.max(this.timer, 0.5);
        break;
      }

      const spawnTimestamp = this.runSeconds + this.timer;
      this.lastCadence = this.lastSpawnAt === null ? this.interval : Math.max(0.01, spawnTimestamp - this.lastSpawnAt);
      this.lastSpawnAt = spawnTimestamp;
      this.lastMultiplier = multiplier;

      this.spawnCycles += 1;
      spawnsThisTick += 1;

      const nextEvaluation = this.resolveRampState();
      this.interval = this.computeNextInterval(nextEvaluation);
      this.timer += this.interval;
    }

    if (spawnsThisTick === MAX_SPAWNS_PER_UPDATE && this.timer <= 0) {
      this.timer = this.interval;
    }
  }

  getSnapshot(): EnemySpawnerSnapshot {
    const stage = this.rampEvaluation.stage;
    return {
      runSeconds: this.runSeconds,
      clears: this.clearCount,
      spawnCycles: this.spawnCycles,
      rampStageIndex: this.rampStageIndex,
      rampStageId: stage.id,
      rampStageLabel: stage.label,
      bundleTier: stage.bundleTier,
      cadence: this.interval,
      lastCadence: this.lastCadence,
      lastSpawnAt: this.lastSpawnAt,
      lastClearAt: this.lastClearAt,
      difficultyMultiplier: this.lastMultiplier
    } satisfies EnemySpawnerSnapshot;
  }

  private resolveRampState(): EnemyRampEvaluation {
    this.rampEvaluation = evaluateEnemyRamp(this.difficulty, {
      runSeconds: this.runSeconds,
      clears: this.clearCount,
      spawnCycles: this.spawnCycles
    });
    this.rampStageIndex = this.rampEvaluation.stageIndex;
    return this.rampEvaluation;
  }

  private computeNextInterval(evaluation: EnemyRampEvaluation): number {
    const baseTarget = evaluation.cadenceTarget;
    const pressure = 1 + Math.min(4, Math.pow(this.spawnCycles + 1, 0.6) * 0.018);
    const dynamicTarget = baseTarget / pressure;
    const decayed = this.interval * this.cadenceDecay;
    const tightened = Math.min(decayed, dynamicTarget);
    return Math.max(0.3, tightened);
  }

  private computeMultiplier(evaluation: EnemyRampEvaluation): number {
    const pressure = 1 + this.spawnCycles * this.multiplierGrowth;
    const stageBonus = 1 + evaluation.stageIndex * 0.15;
    const multiplier = evaluation.multiplierBase * pressure * stageBonus;
    return Math.min(16, Math.max(1, multiplier));
  }

  private countActiveEnemies(units: Unit[]): number {
    return units.filter((unit) => unit.faction === this.factionId && !unit.isDead()).length;
  }

  private getAvailableSlots(units: Unit[]): number {
    return MAX_ENEMIES - this.countActiveEnemies(units);
  }

  private trackClears(enemyCount: number): void {
    if (enemyCount <= 0) {
      if (!this.boardEmpty) {
        this.clearCount += 1;
        this.lastClearAt = this.runSeconds;
      }
      this.boardEmpty = true;
      return;
    }
    this.boardEmpty = false;
  }
}
