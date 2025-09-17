import type { AxialCoord } from '../hex/HexUtils.ts';
import type { GameState } from '../core/GameState.ts';
import type { Unit } from '../units/Unit.ts';
import { spawnUnit } from '../units/UnitFactory.ts';
import { SOLDIER_COST } from '../units/Soldier.ts';

let saunaSpawnCounter = 0;

export function pickFreeTileAround(
  origin: AxialCoord,
  radius: number,
  units: Unit[]
): AxialCoord | null {
  const candidates: AxialCoord[] = [];
  for (let dq = -radius; dq <= radius; dq++) {
    const rMin = Math.max(-radius, -dq - radius);
    const rMax = Math.min(radius, -dq + radius);
    for (let dr = rMin; dr <= rMax; dr++) {
      const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
      if (dist === 0 || dist > radius) continue;
      const coord = { q: origin.q + dq, r: origin.r + dr };
      const occupied = units.some(
        (u) => !u.isDead() && u.coord.q === coord.q && u.coord.r === coord.r
      );
      if (!occupied) {
        candidates.push(coord);
      }
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

export interface Sauna {
  id: 'sauna';
  pos: AxialCoord;
  auraRadius: number;
  regenPerSec: number;
  rallyToFront: boolean;
  heat: number;
  heatPerTick: number;
  playerSpawnThreshold: number;
  playerSpawnCooldown: number;
  playerSpawnTimer: number;
  update(
    dt: number,
    state: GameState,
    units: Unit[],
    addUnit: (u: Unit) => void
  ): void;
}

export function createSauna(pos: AxialCoord): Sauna {
  return {
    id: 'sauna',
    pos,
    auraRadius: 2,
    regenPerSec: 1,
    rallyToFront: false,
    heat: 0,
    heatPerTick: 50 / 30,
    playerSpawnThreshold: 50,
    playerSpawnCooldown: 30,
    playerSpawnTimer: 30,
    update(
      dt: number,
      state: GameState,
      units: Unit[],
      addUnit: (u: Unit) => void
    ): void {
      this.heat += this.heatPerTick * dt;
      this.playerSpawnCooldown =
        this.playerSpawnThreshold / this.heatPerTick;

      if (this.heat < this.playerSpawnThreshold) {
        this.playerSpawnTimer = Math.max(
          (this.playerSpawnThreshold - this.heat) / this.heatPerTick,
          0
        );
        return;
      }

      const searchRadius = Math.max(1, Math.round(this.auraRadius));
      while (this.heat >= this.playerSpawnThreshold) {
        const spawnCoord = pickFreeTileAround(this.pos, searchRadius, units);
        if (!spawnCoord) {
          this.playerSpawnTimer = 0;
          break;
        }

        if (!state.canAfford(SOLDIER_COST)) {
          break;
        }

        const previousThreshold = this.playerSpawnThreshold;
        const id = `sauna-soldier-${++saunaSpawnCounter}`;
        const unit = spawnUnit(state, 'soldier', id, spawnCoord, 'player');
        if (!unit) {
          break;
        }

        addUnit(unit);
        this.heat = Math.max(0, this.heat - previousThreshold);
        this.playerSpawnThreshold = previousThreshold * 1.05;
        this.playerSpawnCooldown =
          this.playerSpawnThreshold / this.heatPerTick;
      }

      this.playerSpawnTimer = Math.max(
        (this.playerSpawnThreshold - this.heat) / this.heatPerTick,
        0
      );
    }
  };
}

