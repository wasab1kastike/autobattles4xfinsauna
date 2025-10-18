import { axialToPixel, type AxialCoord, type PixelCoord } from '../hex/HexUtils.ts';
import { eventBus } from '../events/index.ts';
import type { Unit } from '../units/Unit.ts';
import type { UnitAttackPayload, UnitDamagedPayload } from '../events/types.ts';
import {
  UNIT_ATTACK_IMPACT_MS,
  UNIT_ATTACK_LUNGE_MS,
  UNIT_ATTACK_RECOVER_MS,
  UNIT_ATTACK_TOTAL_MS,
  UNIT_ATTACK_WINDUP_MS,
  UNIT_HIT_RECOIL_MS
} from '../combat/timing.ts';

const EPSILON = 1e-6;
const DEFAULT_DIRECTION: PixelCoord = { x: 0, y: -1 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const eased = 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  return eased > 1 ? 1 : eased;
}

function normalize(direction: PixelCoord | null | undefined): PixelCoord {
  if (!direction) {
    return { ...DEFAULT_DIRECTION };
  }
  const length = Math.hypot(direction.x, direction.y);
  if (!Number.isFinite(length) || length < EPSILON) {
    return { ...DEFAULT_DIRECTION };
  }
  return { x: direction.x / length, y: direction.y / length } satisfies PixelCoord;
}

function directionBetween(from: AxialCoord, to: AxialCoord): PixelCoord {
  const delta: AxialCoord = { q: to.q - from.q, r: to.r - from.r };
  const pixel = axialToPixel(delta, 1);
  return normalize(pixel);
}

function cloneCoord(coord: AxialCoord | null | undefined): AxialCoord | null {
  if (!coord) {
    return null;
  }
  return { q: coord.q, r: coord.r } satisfies AxialCoord;
}

type EasingFunction = (t: number) => number;

const linear: EasingFunction = (t: number) => t;

interface AttackProfileGlowConfig {
  lungePeak: number;
  lungeEase: EasingFunction;
  recoverPeak: number;
  recoverEase: EasingFunction;
}

interface AttackProfileConfig {
  windupPullback: number;
  windupEase: EasingFunction;
  lungeDistance: number;
  lungeEase: EasingFunction;
  recoverDistance: number;
  recoverEase: EasingFunction;
  glow: AttackProfileGlowConfig;
}

const ATTACK_PROFILE_CONFIGS: Record<string, AttackProfileConfig> = Object.freeze({
  default: {
    windupPullback: 0.16,
    windupEase: easeOutCubic,
    lungeDistance: 0.36,
    lungeEase: easeOutBack,
    recoverDistance: 0.18,
    recoverEase: easeOutCubic,
    glow: {
      lungePeak: 1,
      lungeEase: easeOutQuad,
      recoverPeak: 0.45,
      recoverEase: linear
    }
  },
  cleave: {
    windupPullback: 0.22,
    windupEase: easeOutCubic,
    lungeDistance: 0.48,
    lungeEase: easeOutBack,
    recoverDistance: 0.24,
    recoverEase: easeOutCubic,
    glow: {
      lungePeak: 1,
      lungeEase: easeOutCubic,
      recoverPeak: 0.6,
      recoverEase: easeOutQuad
    }
  },
  volley: {
    windupPullback: 0.1,
    windupEase: easeOutQuad,
    lungeDistance: 0.28,
    lungeEase: easeOutCubic,
    recoverDistance: 0.14,
    recoverEase: easeOutQuad,
    glow: {
      lungePeak: 0.6,
      lungeEase: easeOutQuad,
      recoverPeak: 0.3,
      recoverEase: easeOutCubic
    }
  }
});

function resolveAttackProfileConfig(profile: string | undefined | null): AttackProfileConfig {
  if (!profile) {
    return ATTACK_PROFILE_CONFIGS.default;
  }
  const key = profile.toLowerCase();
  return ATTACK_PROFILE_CONFIGS[key] ?? ATTACK_PROFILE_CONFIGS.default;
}

interface AttackState {
  start: number;
  impactAt: number;
  end: number;
  direction: PixelCoord;
  profile?: string;
}

interface HitState {
  start: number;
  end: number;
  direction: PixelCoord;
  intensity: number;
  shieldBoost: number;
  dotBoost: number;
  shieldGlow: number;
}

interface UnitState {
  attack?: AttackState;
  hit?: HitState;
}

export interface CombatAnimationSample {
  offset: PixelCoord;
  glow: number;
  flash: number;
}

export interface CombatAnimationSampler {
  getState(unitId: string): CombatAnimationSample | null;
}

export interface UnitCombatAnimator extends CombatAnimationSampler {
  step(now: number): void;
  dispose(): void;
}

interface AnimatorOptions {
  getUnitById: (id: string) => Unit | undefined;
  requestDraw?: () => void;
}

function resolveDirection(
  attackerCoord: AxialCoord | null,
  targetCoord: AxialCoord | null
): PixelCoord {
  if (attackerCoord && targetCoord) {
    return directionBetween(attackerCoord, targetCoord);
  }
  return { ...DEFAULT_DIRECTION };
}

function resolveUnitCoord(unit: Unit | undefined | null): AxialCoord | null {
  if (!unit) {
    return null;
  }
  const source = unit.renderCoord ?? unit.coord;
  if (!source) {
    return null;
  }
  return { q: source.q, r: source.r } satisfies AxialCoord;
}

function impactDistance(intensity: number): number {
  return 0.28 + intensity * 0.14;
}

export function createUnitCombatAnimator(options: AnimatorOptions): UnitCombatAnimator {
  const { getUnitById, requestDraw } = options;
  const states = new Map<string, UnitState>();
  let lastSample = 0;

  const scheduleDraw = () => {
    try {
      requestDraw?.();
    } catch (error) {
      console.warn('Failed to request redraw for combat animation', error);
    }
  };

  const onAttack = (payload: UnitAttackPayload) => {
    if (!payload || !payload.attackerId) {
      return;
    }
    const normalizedProfile =
      typeof payload.attackProfile === 'string'
        ? payload.attackProfile.trim().toLowerCase() || undefined
        : undefined;
    const attackerCoord = cloneCoord(payload.attackerCoord) ?? resolveUnitCoord(getUnitById(payload.attackerId));
    const targetCoord = cloneCoord(payload.targetCoord) ?? resolveUnitCoord(getUnitById(payload.targetId));
    const direction = resolveDirection(attackerCoord, targetCoord);
    const start = payload.timestamp;
    const impactAt = Number.isFinite(payload.impactAt)
      ? payload.impactAt
      : start + UNIT_ATTACK_IMPACT_MS;
    const end = Number.isFinite(payload.recoverAt)
      ? payload.recoverAt
      : start + UNIT_ATTACK_TOTAL_MS;

    const entry = states.get(payload.attackerId) ?? {};
    entry.attack = { start, impactAt, end, direction, profile: normalizedProfile } satisfies AttackState;
    states.set(payload.attackerId, entry);
    scheduleDraw();
  };

  const onDamaged = (payload: UnitDamagedPayload) => {
    if (!payload || !payload.targetId || payload.amount <= 0) {
      return;
    }
    const attackerUnit = payload.attackerId ? getUnitById(payload.attackerId) ?? null : null;
    const targetUnit = getUnitById(payload.targetId) ?? null;
    const attackerCoord = cloneCoord(resolveUnitCoord(attackerUnit));
    const targetCoord = cloneCoord(payload.targetCoord) ?? resolveUnitCoord(targetUnit);
    const direction = resolveDirection(attackerCoord, targetCoord);
    const defenderEffects = payload.keywordEffects?.defender;
    const shieldAbsorb = defenderEffects
      ? Math.max(
          0,
          (defenderEffects.shieldConsumed ?? 0) + (defenderEffects.tickShieldDamage ?? 0)
        )
      : 0;
    const dotDamage = defenderEffects ? Math.max(0, defenderEffects.tickHpDamage ?? 0) : 0;
    const shieldGranted = defenderEffects ? Math.max(0, defenderEffects.shieldGranted ?? 0) : 0;

    const start = Number.isFinite(payload.timestamp) ? (payload.timestamp as number) : lastSample;
    const end = start + UNIT_HIT_RECOIL_MS;
    const normalizedAmount = Math.max(0, Math.min(40, payload.amount + shieldAbsorb * 0.5 + dotDamage * 0.4));
    const intensity = normalizedAmount / 40;
    const shieldBoost = Math.min(1, shieldAbsorb / 12);
    const dotBoost = Math.min(1, dotDamage / 12);
    const shieldGlow = Math.min(1, shieldGranted / 12);

    const entry = states.get(payload.targetId) ?? {};
    entry.hit = { start, end, direction, intensity, shieldBoost, dotBoost, shieldGlow } satisfies HitState;
    states.set(payload.targetId, entry);
    scheduleDraw();
  };

  eventBus.on<UnitAttackPayload>('unitAttack', onAttack);
  eventBus.on<UnitDamagedPayload>('unitDamaged', onDamaged);

  const sampleAttack = (state: AttackState, now: number) => {
    const duration = state.end - state.start;
    if (duration <= 0) {
      return { offset: { x: 0, y: 0 }, glow: 0 };
    }
    const elapsed = clamp(now - state.start, 0, duration);
    const toImpact = state.impactAt - state.start;
    const lungeDuration = Math.max(UNIT_ATTACK_LUNGE_MS, toImpact - UNIT_ATTACK_WINDUP_MS);
    const recoverDuration = Math.max(UNIT_ATTACK_RECOVER_MS, state.end - state.impactAt);
    const direction = state.direction;
    const config = resolveAttackProfileConfig(state.profile);

    let offset: PixelCoord = { x: 0, y: 0 };
    let glow = 0;

    if (elapsed <= UNIT_ATTACK_WINDUP_MS) {
      const progress = clamp(elapsed / UNIT_ATTACK_WINDUP_MS, 0, 1);
      const pullBack = config.windupEase(progress) * config.windupPullback;
      offset = { x: -direction.x * pullBack, y: -direction.y * pullBack };
    } else if (elapsed <= toImpact) {
      const progress = clamp((elapsed - UNIT_ATTACK_WINDUP_MS) / lungeDuration, 0, 1);
      const surge = config.lungeEase(progress) * config.lungeDistance;
      offset = { x: direction.x * surge, y: direction.y * surge };
      glow = Math.max(glow, config.glow.lungePeak * config.glow.lungeEase(progress));
    } else {
      const progress = clamp((elapsed - toImpact) / recoverDuration, 0, 1);
      const settle = (1 - config.recoverEase(progress)) * config.recoverDistance;
      offset = { x: direction.x * settle, y: direction.y * settle };
      glow = Math.max(glow, config.glow.recoverPeak * (1 - config.glow.recoverEase(progress)));
    }

    return { offset, glow };
  };

  const sampleHit = (state: HitState, now: number) => {
    const duration = state.end - state.start;
    if (duration <= 0) {
      return { offset: { x: 0, y: 0 }, flash: 0, glow: 0 };
    }
    const elapsed = clamp(now - state.start, 0, duration);
    const progress = clamp(elapsed / duration, 0, 1);
    const recoilStrength = easeOutCubic(1 - progress) * impactDistance(state.intensity);
    const offset = {
      x: -state.direction.x * recoilStrength,
      y: -state.direction.y * recoilStrength
    } satisfies PixelCoord;
    let flashStrength = Math.max(0, 0.35 + state.intensity * 0.55);
    if (state.shieldBoost > 0) {
      flashStrength += 0.25 + state.shieldBoost * 0.7;
    }
    if (state.dotBoost > 0) {
      flashStrength += 0.18 + state.dotBoost * 0.6;
    }
    const flash = Math.max(0, flashStrength) * (1 - progress);

    let glow = 0;
    if (state.shieldGlow > 0) {
      glow = Math.max(glow, (0.24 + state.shieldGlow * 0.5) * (1 - progress));
    }
    if (state.shieldBoost > 0) {
      glow = Math.max(glow, state.shieldBoost * 0.45 * (1 - progress));
    }

    return { offset, flash, glow };
  };

  const getState = (unitId: string): CombatAnimationSample | null => {
    const state = states.get(unitId);
    if (!state) {
      return null;
    }
    const now = lastSample ||
      (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now());

    let offset: PixelCoord = { x: 0, y: 0 };
    let glow = 0;
    let flash = 0;

    if (state.attack) {
      const contribution = sampleAttack(state.attack, now);
      offset = {
        x: offset.x + contribution.offset.x,
        y: offset.y + contribution.offset.y
      } satisfies PixelCoord;
      glow = Math.max(glow, contribution.glow);
    }

    if (state.hit) {
      const contribution = sampleHit(state.hit, now);
      offset = {
        x: offset.x + contribution.offset.x,
        y: offset.y + contribution.offset.y
      } satisfies PixelCoord;
      flash = Math.max(flash, contribution.flash);
      glow = Math.max(glow, contribution.glow);
    }

    if (Math.abs(offset.x) < EPSILON && Math.abs(offset.y) < EPSILON && glow <= EPSILON && flash <= EPSILON) {
      return null;
    }

    return { offset, glow, flash } satisfies CombatAnimationSample;
  };

  const step = (now: number) => {
    lastSample = now;
    for (const [unitId, state] of states) {
      let active = false;
      if (state.attack) {
        if (now >= state.attack.end) {
          delete state.attack;
        } else {
          active = true;
        }
      }
      if (state.hit) {
        if (now >= state.hit.end) {
          delete state.hit;
        } else {
          active = true;
        }
      }
      if (!active) {
        states.delete(unitId);
      }
    }
    if (states.size > 0) {
      scheduleDraw();
    }
  };

  const dispose = () => {
    eventBus.off<UnitAttackPayload>('unitAttack', onAttack);
    eventBus.off<UnitDamagedPayload>('unitDamaged', onDamaged);
    states.clear();
  };

  return {
    step,
    dispose,
    getState
  } satisfies UnitCombatAnimator;
}
