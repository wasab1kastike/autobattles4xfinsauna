import type { Unit } from '../units/Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';
import { pickFactionBundle } from '../factions/bundles.ts';
import { spawnEnemyBundle } from '../world/spawn/enemy_spawns.ts';

export interface EnemySpawnerOptions {
  readonly factionId?: string;
  readonly random?: () => number;
  readonly idFactory?: () => string;
  readonly difficulty?: number;
  readonly eliteOdds?: number;
}

export class EnemySpawner {
  private timer: number;
  private interval: number;
  private spawnCycles: number;
  private readonly factionId: string;
  private readonly random: () => number;
  private readonly makeId: () => string;
  private readonly difficulty: number;
  private readonly eliteOdds: number;

  constructor(options: EnemySpawnerOptions = {}) {
    this.factionId = options.factionId ?? 'enemy';
    this.random = typeof options.random === 'function' ? options.random : Math.random;
    const difficulty = Number.isFinite(options.difficulty) ? Number(options.difficulty) : 1;
    this.difficulty = Math.max(0.5, difficulty);
    const odds = typeof options.eliteOdds === 'number' ? options.eliteOdds : 0;
    this.eliteOdds = Math.max(0, Math.min(0.95, odds));
    const initialCadence = Math.max(10, 30 / this.difficulty);
    this.interval = initialCadence;
    this.timer = initialCadence;
    this.spawnCycles = 0;
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
    this.timer -= dt;
    if (this.timer > 0) {
      return;
    }

    const enemyCount = units.filter((u) => u.faction === this.factionId && !u.isDead()).length;
    const availableSlots = MAX_ENEMIES - enemyCount;
    if (availableSlots > 0) {
      const bundle = pickFactionBundle(this.factionId, this.random);
      const rampMultiplier = this.computeRampFactor(this.spawnCycles);
      spawnEnemyBundle({
        bundle,
        factionId: this.factionId,
        pickEdge,
        addUnit,
        makeId: this.makeId,
        availableSlots,
        eliteOdds: this.eliteOdds,
        random: this.random,
        difficultyMultiplier: rampMultiplier
      });
      this.spawnCycles += 1;
    }

    const decay = Math.pow(0.95, this.difficulty);
    this.interval = Math.max(8, this.interval * decay); // escalate faster with higher difficulty
    const nextRamp = this.computeRampFactor(this.spawnCycles);
    const tightenedInterval = Math.max(2, this.interval / nextRamp);
    this.timer = tightenedInterval;
  }

  private computeRampFactor(cycles: number): number {
    if (cycles <= 0) {
      return 1;
    }
    const growth = 1 + cycles * 0.05 * Math.max(1, this.difficulty);
    return Math.max(1, growth);
  }
}
