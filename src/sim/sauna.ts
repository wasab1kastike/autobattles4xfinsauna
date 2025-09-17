import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Unit } from '../units/Unit.ts';
import { AvantoMarauder } from '../units/AvantoMarauder.ts';

export interface Sauna {
  id: 'sauna';
  pos: AxialCoord;
  spawnCooldown: number;
  timer: number;
  auraRadius: number;
  regenPerSec: number;
  rallyToFront: boolean;
  update(dt: number, units: Unit[], addUnit: (u: Unit) => void): void;
}

export function createSauna(pos: AxialCoord): Sauna {
  return {
    id: 'sauna',
    pos,
    spawnCooldown: 30,
    timer: 30,
    auraRadius: 2,
    regenPerSec: 1,
    rallyToFront: false,
    update(dt: number, units: Unit[], addUnit: (u: Unit) => void): void {
      this.timer -= dt;
      if (this.timer > 0) return;

      const targets: AxialCoord[] = [];
      for (let dq = -2; dq <= 2; dq++) {
        const rMin = Math.max(-2, -dq - 2);
        const rMax = Math.min(2, -dq + 2);
        for (let dr = rMin; dr <= rMax; dr++) {
          const dist = Math.max(Math.abs(dq), Math.abs(dr), Math.abs(-dq - dr));
          if (dist === 0 || dist > 2) continue;
          const coord = { q: this.pos.q + dq, r: this.pos.r + dr };
          const occupied = units.some(
            (u) => !u.isDead() && u.coord.q === coord.q && u.coord.r === coord.r
          );
          if (!occupied) {
            targets.push(coord);
          }
        }
      }

      if (targets.length > 0) {
        const coord = targets[Math.floor(Math.random() * targets.length)];
        const id = `avantoMarauder${units.length + 1}`;
        const avantoMarauder = new AvantoMarauder(id, coord, 'enemy');
        addUnit(avantoMarauder);
      }
      this.timer = this.spawnCooldown;
    }
  };
}

