import { describe, expect, it } from 'vitest';
import { BattleManager } from '../../src/battle/BattleManager.ts';
import { HexMap } from '../../src/hexmap.ts';
import { TerrainId } from '../../src/map/terrain.ts';
import { UNIT_MOVEMENT_STEP_SECONDS, Unit } from '../../src/units/Unit.ts';

function createSpeedster(): Unit {
  const unit = new Unit('speedster-1', 'soldier', { q: 0, r: 0 }, 'player', {
    health: 24,
    attackDamage: 6,
    attackRange: 1,
    movementRange: 2
  });
  unit.setMovementStepScalar(0.6);
  unit.setMomentumState({ pendingStrikes: 0, tilesMovedThisTick: 0, maxStacks: 1 });
  return unit;
}

function createEnemy(): Unit {
  return new Unit('enemy-1', 'soldier', { q: 3, r: 0 }, 'enemy', {
    health: 20,
    attackDamage: 4,
    attackRange: 1,
    movementRange: 0
  });
}

describe('BattleManager speedster momentum handling', () => {
  it('awards a follow-up dash or strike after a momentum move', () => {
    const map = new HexMap(8, 8, 32);
    const manager = new BattleManager(map);
    const speedster = createSpeedster();
    const enemy = createEnemy();
    [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 }
    ].forEach((coord) => {
      const tile = map.ensureTile(coord.q, coord.r);
      tile.terrain = TerrainId.Plains;
      tile.reveal();
    });
    speedster.setMovementCooldownSeconds(UNIT_MOVEMENT_STEP_SECONDS);

    manager.tick([speedster, enemy], UNIT_MOVEMENT_STEP_SECONDS);
    manager.tick([speedster, enemy], 0);

    expect(speedster.coord.q).toBe(2);
    expect(speedster.coord.r).toBe(0);
    expect(enemy.stats.health).toBeLessThan(20);
    const momentum = speedster.getMomentumState();
    expect(momentum).not.toBeNull();
    expect(momentum?.pendingStrikes).toBe(0);
    expect(momentum?.tilesMovedThisTick ?? 0).toBeGreaterThanOrEqual(2);
  });
});
