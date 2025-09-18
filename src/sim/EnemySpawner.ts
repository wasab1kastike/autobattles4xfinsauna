import type { Unit } from '../units/Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';
import { pickFactionBundle } from '../factions/bundles.ts';
import { spawnEnemyBundle } from '../world/spawn/enemy_spawns.ts';

export interface EnemySpawnerOptions {
  readonly factionId?: string;
  readonly random?: () => number;
  readonly idFactory?: () => string;
}

export class EnemySpawner {
  private timer = 30; // seconds
  private interval = 30; // cadence
  private readonly factionId: string;
  private readonly random: () => number;
  private readonly makeId: () => string;

  constructor(options: EnemySpawnerOptions = {}) {
    this.factionId = options.factionId ?? 'enemy';
    this.random = typeof options.random === 'function' ? options.random : Math.random;
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
      spawnEnemyBundle({
        bundle,
        factionId: this.factionId,
        pickEdge,
        addUnit,
        makeId: this.makeId,
        availableSlots
      });
    }

    this.interval = Math.max(10, this.interval * 0.95); // escalate slowly
    this.timer = this.interval;
  }
}
