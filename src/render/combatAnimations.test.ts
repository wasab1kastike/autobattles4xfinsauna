import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUnitCombatAnimator } from './combatAnimations.ts';
import { eventBus } from '../events/index.ts';
import { UNIT_ATTACK_IMPACT_MS, UNIT_ATTACK_TOTAL_MS, UNIT_HIT_RECOIL_MS } from '../combat/timing.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';

interface StubUnit {
  coord: AxialCoord;
  renderCoord: AxialCoord;
}

describe('createUnitCombatAnimator', () => {
  const units = new Map<string, StubUnit>();
  const requestDraw = vi.fn();
  const getUnitById = (id: string) => units.get(id) as unknown as StubUnit | undefined;
  let animator = createUnitCombatAnimator({ getUnitById, requestDraw });

  beforeEach(() => {
    requestDraw.mockClear();
    animator.dispose();
    animator = createUnitCombatAnimator({ getUnitById, requestDraw });
    units.clear();
    units.set('attacker', { coord: { q: 0, r: 0 }, renderCoord: { q: 0, r: 0 } });
    units.set('target', { coord: { q: 1, r: 0 }, renderCoord: { q: 1, r: 0 } });
  });

  afterEach(() => {
    animator.dispose();
    units.clear();
  });

  it('returns forward offsets and glow during the attack animation', () => {
    const start = 1_000;
    eventBus.emit('unitAttack', {
      attackerId: 'attacker',
      targetId: 'target',
      attackerCoord: { q: 0, r: 0 },
      targetCoord: { q: 1, r: 0 },
      timestamp: start,
      impactAt: start + UNIT_ATTACK_IMPACT_MS,
      recoverAt: start + UNIT_ATTACK_TOTAL_MS
    });

    animator.step(start + UNIT_ATTACK_IMPACT_MS - 40);
    const lungeSample = animator.getState('attacker');
    expect(lungeSample).not.toBeNull();
    expect(lungeSample!.offset.x).toBeGreaterThan(0);
    expect(lungeSample!.glow).toBeGreaterThan(0);
    expect(requestDraw).toHaveBeenCalled();
  });

  it('adapts easing and intensity based on the attack profile', () => {
    const cleaveStart = 4_000;
    eventBus.emit('unitAttack', {
      attackerId: 'attacker',
      targetId: 'target',
      attackerCoord: { q: 0, r: 0 },
      targetCoord: { q: 1, r: 0 },
      timestamp: cleaveStart,
      impactAt: cleaveStart + UNIT_ATTACK_IMPACT_MS,
      recoverAt: cleaveStart + UNIT_ATTACK_TOTAL_MS,
      attackProfile: 'CLEAVE'
    });

    animator.step(cleaveStart + UNIT_ATTACK_IMPACT_MS - 40);
    const cleaveSample = animator.getState('attacker');
    expect(cleaveSample).not.toBeNull();

    const secondStart = cleaveStart + 5_000;
    eventBus.emit('unitAttack', {
      attackerId: 'attacker',
      targetId: 'target',
      attackerCoord: { q: 0, r: 0 },
      targetCoord: { q: 1, r: 0 },
      timestamp: secondStart,
      impactAt: secondStart + UNIT_ATTACK_IMPACT_MS,
      recoverAt: secondStart + UNIT_ATTACK_TOTAL_MS,
      attackProfile: 'volley'
    });

    animator.step(secondStart + UNIT_ATTACK_IMPACT_MS - 40);
    const volleySample = animator.getState('attacker');
    expect(volleySample).not.toBeNull();

    expect(cleaveSample!.glow).toBeGreaterThan(volleySample!.glow);
    expect(cleaveSample!.offset.x).toBeGreaterThan(volleySample!.offset.x);
    expect(volleySample!.glow).toBeGreaterThan(0);
  });

  it('applies recoil and fades out after the hit animation completes', () => {
    const impactStart = 5_000 + UNIT_ATTACK_IMPACT_MS;
    eventBus.emit('unitDamaged', {
      attackerId: 'attacker',
      targetId: 'target',
      targetCoord: { q: 1, r: 0 },
      amount: 12,
      remainingHealth: 6,
      timestamp: impactStart
    });

    animator.step(impactStart + 40);
    const hitSample = animator.getState('target');
    expect(hitSample).not.toBeNull();
    expect(hitSample!.offset.x).toBeLessThan(0);
    expect(hitSample!.flash).toBeGreaterThan(0);

    animator.step(impactStart + UNIT_HIT_RECOIL_MS + 10);
    expect(animator.getState('target')).toBeNull();
  });
});
