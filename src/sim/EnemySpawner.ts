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

function clampMultiplier(value: unknown, min: number, max: number, fallback = 1): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const sanitized = Math.max(min, Math.min(max, numeric));
  return sanitized;
}

export interface EnemySpawnerOptions {
  readonly factionId?: string;
  readonly random?: () => number;
  readonly idFactory?: () => string;
  readonly difficulty?: number;
  readonly eliteOdds?: number;
}

export interface EnemySpawnerRuntimeModifiers {
  readonly aggressionMultiplier?: number;
  readonly cadenceMultiplier?: number;
  readonly strengthMultiplier?: number;
  readonly pressureMultiplier?: number;
  readonly calmSecondsRemaining?: number | null;
  readonly cadenceFloor?: number;
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
  readonly effectiveDifficulty: number;
  readonly aggressionMultiplier: number;
  readonly cadenceMultiplier: number;
  readonly strengthMultiplier: number;
  readonly pressureMultiplier: number;
  readonly calmSecondsRemaining: number;
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
  private cadenceDecay: number;
  private multiplierGrowth: number;
  private runSeconds = 0;
  private clearCount = 0;
  private boardEmpty = true;
  private lastClearAt: number | null = null;
  private lastSpawnAt: number | null = null;
  private lastCadence: number;
  private lastMultiplier: number;
  private rampEvaluation: EnemyRampEvaluation;
  private rampStageIndex: number;
  private currentDifficulty: number;
  private cadenceScale = 1;
  private multiplierScale = 1;
  private pressureScale = 1;
  private calmUntil: number | null = null;
  private calmSecondsRemaining = 0;
  private cadenceFloor = 0.3;

  constructor(options: EnemySpawnerOptions = {}) {
    this.factionId = options.factionId ?? 'enemy';
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    const difficulty = Number.isFinite(options.difficulty) ? Number(options.difficulty) : 1;
    this.difficulty = Math.max(0.5, difficulty);
    const odds = typeof options.eliteOdds === 'number' ? options.eliteOdds : 0;
    this.eliteOdds = Math.max(0, Math.min(0.95, odds));
    this.currentDifficulty = this.difficulty;
    this.cadenceDecay = getEnemyCadenceDecay(this.currentDifficulty);
    this.multiplierGrowth = getEnemyMultiplierGrowth(this.currentDifficulty);
    this.spawnCycles = 0;
    this.rampEvaluation = evaluateEnemyRamp(this.currentDifficulty, {
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
    pickEdge: () => AxialCoord | undefined,
    runtimeModifiers: EnemySpawnerRuntimeModifiers = {}
  ): void {
    if (!Number.isFinite(dt) || dt <= 0) {
      return;
    }

    this.runSeconds += dt;
    this.applyRuntimeModifiers(runtimeModifiers);
    this.resolveRampState();

    const enemyCount = this.countActiveEnemies(units);
    this.trackClears(enemyCount);
    let availableSlots = Math.max(0, MAX_ENEMIES - enemyCount);

    if (this.calmUntil !== null && this.runSeconds < this.calmUntil) {
      const calmRemaining = this.calmUntil - this.runSeconds;
      this.calmSecondsRemaining = calmRemaining;
      this.timer = Math.max(this.timer, calmRemaining);
      return;
    }

    this.calmSecondsRemaining = Math.max(0, this.calmUntil !== null ? this.calmUntil - this.runSeconds : 0);
    this.timer -= dt;
    let spawnsThisTick = 0;
    while (this.timer <= 0 && spawnsThisTick < MAX_SPAWNS_PER_UPDATE) {
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
        appearanceRandom: () => Math.random(),
        difficultyMultiplier: multiplier,
        rampTier: evaluation.stage.bundleTier
      });

      const spawnedCount = result.spawned.length;

      if (spawnedCount === 0) {
        this.timer = Math.max(this.timer, 0.5);
        break;
      }

      availableSlots = Math.max(0, availableSlots - spawnedCount);

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
      difficultyMultiplier: this.lastMultiplier,
      effectiveDifficulty: this.currentDifficulty,
      aggressionMultiplier: this.currentDifficulty / this.difficulty,
      cadenceMultiplier: this.cadenceScale,
      strengthMultiplier: this.multiplierScale,
      pressureMultiplier: this.pressureScale,
      calmSecondsRemaining: this.calmSecondsRemaining
    } satisfies EnemySpawnerSnapshot;
  }

  private resolveRampState(): EnemyRampEvaluation {
    this.rampEvaluation = evaluateEnemyRamp(this.currentDifficulty, {
      runSeconds: this.runSeconds,
      clears: this.clearCount,
      spawnCycles: this.spawnCycles
    });
    this.rampStageIndex = this.rampEvaluation.stageIndex;
    return this.rampEvaluation;
  }

  private applyRuntimeModifiers(modifiers: EnemySpawnerRuntimeModifiers): void {
    const aggressionMultiplier = clampMultiplier(modifiers.aggressionMultiplier, 0.25, 6, 1);
    const cadenceMultiplier = clampMultiplier(modifiers.cadenceMultiplier, 0.1, 10, 1);
    const strengthMultiplier = clampMultiplier(modifiers.strengthMultiplier, 0.1, 12, 1);
    const pressureMultiplier = clampMultiplier(modifiers.pressureMultiplier, 0.1, 10, 1);
    const cadenceFloor = Number.isFinite(modifiers.cadenceFloor)
      ? Math.max(0.1, modifiers.cadenceFloor as number)
      : this.cadenceFloor;

    const nextDifficulty = Math.max(0.25, this.difficulty * aggressionMultiplier);
    if (nextDifficulty !== this.currentDifficulty) {
      this.currentDifficulty = nextDifficulty;
      this.cadenceDecay = getEnemyCadenceDecay(this.currentDifficulty);
      this.multiplierGrowth = getEnemyMultiplierGrowth(this.currentDifficulty);
      this.resolveRampState();
    }

    this.cadenceScale = cadenceMultiplier;
    this.multiplierScale = strengthMultiplier;
    this.pressureScale = pressureMultiplier;
    this.cadenceFloor = cadenceFloor;

    if (Object.prototype.hasOwnProperty.call(modifiers, 'calmSecondsRemaining')) {
      const calm = modifiers.calmSecondsRemaining;
      if (calm === null) {
        this.calmUntil = null;
      } else if (typeof calm === 'number' && Number.isFinite(calm) && calm > 0) {
        this.calmUntil = this.runSeconds + calm;
      } else if (typeof calm === 'number' && calm <= 0) {
        this.calmUntil = null;
      }
    }

    this.calmSecondsRemaining = Math.max(
      0,
      this.calmUntil !== null ? this.calmUntil - this.runSeconds : 0
    );
  }

  private computeNextInterval(evaluation: EnemyRampEvaluation): number {
    const baseTarget = evaluation.cadenceTarget * this.cadenceScale;
    const pressureMagnitude = Math.pow(this.spawnCycles + 1, 0.6) * 0.018 * this.pressureScale;
    const pressure = 1 + Math.min(4, pressureMagnitude);
    const dynamicTarget = baseTarget / pressure;
    const decayed = this.interval * this.cadenceDecay;
    const tightened = Math.min(decayed, dynamicTarget);
    return Math.max(this.cadenceFloor, tightened);
  }

  private computeMultiplier(evaluation: EnemyRampEvaluation): number {
    const pressure = 1 + this.spawnCycles * this.multiplierGrowth * this.pressureScale;
    const stageBonus = 1 + evaluation.stageIndex * 0.15;
    const multiplier = evaluation.multiplierBase * pressure * stageBonus * this.multiplierScale;
    return Math.min(16, Math.max(1, multiplier));
  }

  private countActiveEnemies(units: Unit[]): number {
    let count = 0;
    for (const unit of units) {
      if (unit.faction === this.factionId && !unit.isDead()) {
        count += 1;
      }
    }
    return count;
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
