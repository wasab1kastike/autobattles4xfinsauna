import type { Unit } from '../units/Unit.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';
import { createUnit } from '../units/UnitFactory.ts';

export class EnemySpawner {
  private timer = 30; // seconds
  private interval = 30; // cadence

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

    const enemyCount = units.filter((u) => u.faction === 'enemy' && !u.isDead()).length;
    if (enemyCount < MAX_ENEMIES) {
      const at = pickEdge();
      if (at) {
        const unit = createUnit('avanto-marauder', `e${Date.now()}`, at, 'enemy');
        if (unit) {
          addUnit(unit);
        }
      }
    }

    this.interval = Math.max(10, this.interval * 0.95); // escalate slowly
    this.timer = this.interval;
  }
}
