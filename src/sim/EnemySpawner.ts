import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';
import { AvantoMarauder } from '../units/AvantoMarauder.ts';

export type SpawnTilePicker = (units: Unit[]) => AxialCoord | null;

export interface EnemySpawnerConfig {
  /** Heat generated per simulated second. */
  heatPerTick?: number;
  /** Initial heat threshold required to spawn a marauder. */
  initialThreshold?: number;
  /** Multiplier applied to the threshold after each spawn. */
  thresholdGrowth?: number;
}

const DEFAULT_HEAT_PER_TICK = 50 / 30;
const DEFAULT_INITIAL_THRESHOLD = 50;
const DEFAULT_THRESHOLD_GROWTH = 1.05;

/**
 * Drives periodic Avanto Marauder reinforcements using a heat-based timer.
 */
export class EnemySpawner {
  /** Accumulated heat towards the next reinforcement. */
  private heat = 0;
  /** Current heat requirement to deploy another marauder. */
  private spawnThreshold: number;
  /** Precomputed cooldown derived from the active threshold and heat gain. */
  spawnCooldown: number;
  /** Countdown (in seconds) until the next spawn fires, surfaced for HUD use. */
  timer: number;
  private readonly heatPerTick: number;
  private readonly thresholdGrowth: number;
  private spawnCounter = 0;

  constructor(
    private readonly pickSpawnTile: SpawnTilePicker,
    config: EnemySpawnerConfig = {}
  ) {
    this.heatPerTick = config.heatPerTick ?? DEFAULT_HEAT_PER_TICK;
    this.spawnThreshold = config.initialThreshold ?? DEFAULT_INITIAL_THRESHOLD;
    this.thresholdGrowth = config.thresholdGrowth ?? DEFAULT_THRESHOLD_GROWTH;
    this.spawnCooldown = this.spawnThreshold / this.heatPerTick;
    this.timer = this.spawnCooldown;
  }

  update(dt: number, units: Unit[], onSpawn: (unit: Unit) => void): void {
    if (dt <= 0) {
      return;
    }

    this.heat += this.heatPerTick * dt;
    this.spawnCooldown = this.spawnThreshold / this.heatPerTick;

    if (this.heat < this.spawnThreshold) {
      this.timer = Math.max((this.spawnThreshold - this.heat) / this.heatPerTick, 0);
      return;
    }

    while (this.heat >= this.spawnThreshold) {
      const spawnCoord = this.pickSpawnTile(units);
      if (!spawnCoord) {
        this.timer = 0;
        break;
      }

      const id = `avanto-marauder-${++this.spawnCounter}`;
      const unit = new AvantoMarauder(id, spawnCoord, 'enemy');
      onSpawn(unit);

      const previousThreshold = this.spawnThreshold;
      this.heat = Math.max(0, this.heat - previousThreshold);
      this.spawnThreshold = previousThreshold * this.thresholdGrowth;
      this.spawnCooldown = this.spawnThreshold / this.heatPerTick;
      this.timer = Math.max((this.spawnThreshold - this.heat) / this.heatPerTick, 0);
    }
  }
}
