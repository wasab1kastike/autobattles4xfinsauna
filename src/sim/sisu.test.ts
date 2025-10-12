import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameState, Resource } from '../core/GameState.ts';
import { useSisuBurst, endSisuBurst, isSisuBurstActive } from '../sisu/burst.ts';
import { modifierRuntime } from '../mods/runtime.ts';
import { Unit } from '../units/Unit.ts';
import type { UnitStats } from '../unit/types.ts';
import { eventBus } from '../events';

const BASE_COORD = { q: 0, r: 0 } as const;

function createStats(overrides: Partial<UnitStats> = {}): UnitStats {
  return {
    health: 20,
    attackDamage: 4,
    attackRange: 1,
    movementRange: 2,
    defense: 0,
    ...overrides
  };
}

function createUnit(id: string, faction: string, stats?: Partial<UnitStats>): Unit {
  return new Unit(id, 'soldier', { ...BASE_COORD }, faction, createStats(stats));
}

describe('useSisuBurst', () => {
  let state: GameState;
  let now = 0;
  const durationMs = 10_000;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    state = new GameState(1000);
    state.addResource(Resource.SISU, 20);
  });

  afterEach(() => {
    endSisuBurst();
    modifierRuntime.clear();
    vi.runAllTimers();
    vi.clearAllTimers();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('applies attack, shield, and immortality buffs via modifiers', () => {
    const ally = createUnit('ally', 'player');
    const result = useSisuBurst(state, [ally]);

    expect(result).toBe(true);
    expect(isSisuBurstActive()).toBe(true);
    expect(ally.stats.attackDamage).toBe(Math.round(4 * 1.5));
    expect(ally.stats.movementRange).toBe(Math.max(1, Math.round(2 * 1.5)));
    expect(ally.getShield()).toBe(1);
    expect(ally.isImmortal()).toBe(true);
    expect(state.getResource(Resource.SISU)).toBe(15);
  });

  it('prevents lethal damage while the burst is active', () => {
    const ally = createUnit('immortal-ally', 'player');
    const foe = createUnit('attacker', 'enemy', { attackDamage: 12 });

    useSisuBurst(state, [ally]);
    const result = ally.takeDamage(ally.getMaxHealth() + 5, foe);

    expect(result).not.toBeNull();
    expect(result?.lethal).toBe(false);
    expect(ally.isDead()).toBe(false);
    expect(ally.stats.health).toBe(1);
    expect(ally.isImmortal()).toBe(true);
  });

  it('expires on schedule and removes temporary buffs', () => {
    const ally = createUnit('timed-ally', 'player');
    const baseAttack = ally.stats.attackDamage;
    const baseMovement = ally.stats.movementRange;

    useSisuBurst(state, [ally]);
    now += durationMs;
    vi.advanceTimersByTime(durationMs);

    expect(isSisuBurstActive()).toBe(false);
    expect(ally.stats.attackDamage).toBe(baseAttack);
    expect(ally.stats.movementRange).toBe(baseMovement);
    expect(ally.isImmortal()).toBe(false);
    expect(ally.getShield()).toBe(0);
  });

  it('preserves external buffs applied during the burst when it expires', () => {
    const ally = createUnit('buffed-ally', 'player');
    const baseAttack = ally.stats.attackDamage;
    const baseMovement = ally.stats.movementRange;
    const statsChangedListener = vi.fn();
    eventBus.on('unit:stats:changed', statsChangedListener);

    try {
      useSisuBurst(state, [ally]);
      const burstAttack = ally.stats.attackDamage;
      const burstMovement = ally.stats.movementRange;

      const externalAttackBonus = 3;
      const externalMovementBonus = 2;
      ally.stats.attackDamage += externalAttackBonus;
      ally.stats.movementRange += externalMovementBonus;

      expect(ally.stats.attackDamage).toBe(burstAttack + externalAttackBonus);
      expect(ally.stats.movementRange).toBe(burstMovement + externalMovementBonus);

      now += durationMs;
      vi.advanceTimersByTime(durationMs);

      expect(isSisuBurstActive()).toBe(false);
      expect(ally.stats.attackDamage).toBe(baseAttack + externalAttackBonus);
      expect(ally.stats.movementRange).toBe(baseMovement + externalMovementBonus);
      expect(statsChangedListener).toHaveBeenCalledWith(
        expect.objectContaining({ unitId: ally.id })
      );
    } finally {
      eventBus.off('unit:stats:changed', statsChangedListener);
    }
  });
});
