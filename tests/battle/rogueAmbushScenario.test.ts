import { describe, expect, it } from 'vitest';
import { BattleManager } from '../../src/battle/BattleManager.ts';
import { HexMap } from '../../src/hexmap.ts';
import { Unit } from '../../src/units/Unit.ts';
import { eventBus } from '../../src/events';
import type { UnitTeleportedPayload } from '../../src/events/types.ts';

function createRogueUnit(): Unit {
  const unit = new Unit(
    'a-rogue',
    'soldier',
    { q: 0, r: 0 },
    'player',
    {
      health: 100,
      attackDamage: 10,
      attackRange: 1,
      movementRange: 3
    }
  );
  unit.setBehavior('attack');
  unit.updateStats({
    health: unit.getMaxHealth(),
    attackDamage: unit.stats.attackDamage,
    attackRange: unit.stats.attackRange,
    movementRange: unit.stats.movementRange,
    damageDealtMultiplier: 1.25
  });
  unit.setRogueAmbush({ teleportRange: 5, burstMultiplier: 2 });
  return unit;
}

function createTarget(): Unit {
  const enemy = new Unit(
    'b-foe',
    'soldier',
    { q: 3, r: 0 },
    'enemy',
    {
      health: 100,
      attackDamage: 5,
      attackRange: 1,
      movementRange: 0
    }
  );
  enemy.setBehavior('defend');
  enemy.updateStats({
    health: enemy.getMaxHealth(),
    attackDamage: enemy.stats.attackDamage,
    attackRange: enemy.stats.attackRange,
    movementRange: enemy.stats.movementRange
  });
  return enemy;
}

describe('BattleManager rogue ambush scenario', () => {
  it('teleports rogues into range and applies the burst damage once', () => {
    const map = new HexMap(8, 8, 32);
    const manager = new BattleManager(map);
    const rogue = createRogueUnit();
    const target = createTarget();
    const units = [rogue, target];

    const teleports: UnitTeleportedPayload[] = [];
    const listener = (payload: UnitTeleportedPayload) => {
      teleports.push(payload);
    };
    eventBus.on('unitTeleported', listener);

    try {
      manager.tick(units, 1);
      expect(teleports).toHaveLength(1);
      const [teleport] = teleports;
      expect(teleport.unitId).toBe(rogue.id);
      expect(teleport.from).toEqual({ q: 0, r: 0 });
      expect(rogue.distanceTo(target.coord)).toBe(1);
      expect(target.stats.health).toBeCloseTo(75, 5);
      expect(rogue.stats.damageDealtMultiplier).toBeCloseTo(1.25, 5);

      manager.tick(units, 1);
      manager.tick(units, 1);
      expect(target.stats.health).toBeCloseTo(62.5, 5);
    } finally {
      eventBus.off('unitTeleported', listener);
    }
  });
});
