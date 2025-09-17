import type { AxialCoord } from '../hex/HexUtils.ts';
import { getNeighbors } from '../hex/HexUtils.ts';
import { MAX_ENEMIES } from '../battle/BattleManager.ts';
import { AvantoMarauder } from '../units/AvantoMarauder.ts';
import type { Unit } from '../units/Unit.ts';
import type { HexMap } from '../hexmap.ts';
import { revealedHexes } from '../camera/autoFrame.ts';

export class EnemySpawner {
  private timer = 30; // seconds
  private interval = 30; // cadence

  constructor(private readonly map: HexMap) {}

  private coordKey(coord: AxialCoord): string {
    return `${coord.q},${coord.r}`;
  }

  private pickFrontierSpawn(units: Unit[]): AxialCoord | undefined {
    const occupied = new Set<string>();
    for (const unit of units) {
      if (!unit.isDead()) {
        occupied.add(this.coordKey(unit.coord));
      }
    }

    const candidates: AxialCoord[] = [];
    const seen = new Set<string>();

    for (const key of revealedHexes) {
      const [q, r] = key.split(',').map(Number);
      if (!Number.isFinite(q) || !Number.isFinite(r)) {
        continue;
      }
      const center = { q, r };
      for (const neighbor of getNeighbors(center)) {
        const neighborKey = this.coordKey(neighbor);
        if (revealedHexes.has(neighborKey) || occupied.has(neighborKey) || seen.has(neighborKey)) {
          continue;
        }
        seen.add(neighborKey);
        candidates.push(neighbor);
      }
    }

    if (candidates.length === 0) {
      return undefined;
    }

    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
  }

  update(
    dt: number,
    units: Unit[],
    addUnit: (unit: Unit) => void
  ): void {
    this.timer -= dt;
    if (this.timer > 0) {
      return;
    }

    const enemyCount = units.filter((unit) => unit.faction === 'enemy' && !unit.isDead()).length;
    if (enemyCount >= MAX_ENEMIES) {
      this.timer = 1;
      return;
    }

    const at = this.pickFrontierSpawn(units);
    if (!at) {
      this.timer = 0.5;
      return;
    }

    this.map.ensureTile(at.q, at.r);
    addUnit(new AvantoMarauder(`e${Date.now()}`, at, 'enemy'));

    this.interval = Math.max(10, this.interval * 0.95);
    this.timer = this.interval;
  }
}
