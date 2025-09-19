import type { ObjectiveOutcome } from './objectives.ts';

export interface NgPlusState {
  readonly runSeed: number;
  readonly ngPlusLevel: number;
  readonly unlockSlots: number;
}

const NG_PLUS_STORAGE_KEY = 'progression:ngPlusState';
const MAX_UNLOCK_SLOTS = 5;
const DEFAULT_RUN_SEED_FALLBACK = 0x6d2b79f5;

export const DEFAULT_NGPLUS_STATE: NgPlusState = Object.freeze({
  runSeed: 0,
  ngPlusLevel: 0,
  unlockSlots: 0
});

function storageOrNull(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage ?? null;
  } catch (error) {
    console.warn('Local storage unavailable for NG+ state', error);
    return null;
  }
}

function clampInteger(value: unknown, min: number, max: number): number {
  const numeric = Number.isFinite(value) ? (value as number) : Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  const floored = Math.trunc(numeric);
  return Math.min(max, Math.max(min, floored));
}

function sanitizeRunSeed(seed: unknown): number {
  const numeric = Number.isFinite(seed) ? (seed as number) : Number(seed);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  if (numeric === 0) {
    return 0;
  }
  return Math.trunc(Math.abs(numeric));
}

export function rollRunSeed(random: () => number = Math.random): number {
  let roll = random();
  if (!Number.isFinite(roll) || roll <= 0 || roll >= 1) {
    roll = Math.random();
  }
  // Reserve zero to signal an uninitialized run.
  const value = Math.floor(roll * 0xffffffff);
  return value === 0 ? DEFAULT_RUN_SEED_FALLBACK : value;
}

export function createNgPlusState(overrides: Partial<NgPlusState> = {}): NgPlusState {
  const base = DEFAULT_NGPLUS_STATE;
  const runSeed = sanitizeRunSeed(overrides.runSeed ?? base.runSeed);
  const ngPlusLevel = clampInteger(overrides.ngPlusLevel ?? base.ngPlusLevel, 0, Number.MAX_SAFE_INTEGER);
  const unlockSlots = clampInteger(overrides.unlockSlots ?? base.unlockSlots, 0, MAX_UNLOCK_SLOTS);
  return {
    runSeed,
    ngPlusLevel,
    unlockSlots
  } satisfies NgPlusState;
}

export function ensureNgPlusRunState(
  state: NgPlusState,
  random: () => number = Math.random
): NgPlusState {
  const sanitized = createNgPlusState(state);
  if (sanitized.runSeed !== 0) {
    return sanitized;
  }
  return createNgPlusState({
    ...sanitized,
    runSeed: rollRunSeed(random)
  });
}

export function loadNgPlusState(random: () => number = Math.random): NgPlusState {
  const storage = storageOrNull();
  if (!storage) {
    return ensureNgPlusRunState(DEFAULT_NGPLUS_STATE, random);
  }
  const raw = storage.getItem(NG_PLUS_STORAGE_KEY);
  if (!raw) {
    return ensureNgPlusRunState(DEFAULT_NGPLUS_STATE, random);
  }
  try {
    const parsed = JSON.parse(raw) as Partial<NgPlusState>;
    return ensureNgPlusRunState(createNgPlusState(parsed), random);
  } catch (error) {
    console.warn('Failed to parse NG+ state', error);
    return ensureNgPlusRunState(DEFAULT_NGPLUS_STATE, random);
  }
}

export function saveNgPlusState(state: NgPlusState): void {
  const storage = storageOrNull();
  if (!storage) {
    return;
  }
  const sanitized = createNgPlusState(state);
  storage.setItem(NG_PLUS_STORAGE_KEY, JSON.stringify(sanitized));
}

export function resetNgPlusState(): void {
  storageOrNull()?.removeItem(NG_PLUS_STORAGE_KEY);
}

export interface NgPlusProgressContext {
  readonly outcome: ObjectiveOutcome;
  readonly bonusUnlocks?: number;
  readonly random?: () => number;
}

export function planNextNgPlusRun(
  current: NgPlusState,
  context: NgPlusProgressContext
): NgPlusState {
  const sanitized = createNgPlusState(current);
  const random = typeof context.random === 'function' ? context.random : Math.random;
  let level = sanitized.ngPlusLevel;
  let unlockSlots = sanitized.unlockSlots;
  if (context.outcome === 'win') {
    level += 1;
    const unlockBonus = Math.max(0, Math.trunc(context.bonusUnlocks ?? 1));
    if (unlockBonus > 0) {
      unlockSlots = Math.min(MAX_UNLOCK_SLOTS, unlockSlots + unlockBonus);
    }
  }
  const nextSeed = rollRunSeed(random);
  return ensureNgPlusRunState(
    createNgPlusState({
      runSeed: nextSeed,
      ngPlusLevel: level,
      unlockSlots
    }),
    random
  );
}

export function getUpkeepMultiplier(state: NgPlusState): number {
  const level = Math.max(0, state.ngPlusLevel);
  const slotBonus = Math.max(0, state.unlockSlots) * 0.02;
  return Math.min(3, 1 + level * 0.12 + slotBonus);
}

export function getEliteOdds(state: NgPlusState): number {
  const level = Math.max(0, state.ngPlusLevel);
  const slotBonus = Math.max(0, state.unlockSlots) * 0.01;
  const odds = 0.1 + level * 0.05 + slotBonus;
  return Math.max(0, Math.min(0.85, odds));
}

export function getAiAggressionModifier(state: NgPlusState): number {
  const level = Math.max(0, state.ngPlusLevel);
  return Math.max(0.5, 1 + level * 0.25);
}

export function getUnlockSpawnLimit(state: NgPlusState): number {
  return 1 + Math.max(0, state.unlockSlots);
}

export function createNgPlusRng(seed: number, salt = 0): () => number {
  let state = sanitizeRunSeed(seed) ^ (salt | 0);
  if (state === 0) {
    state = DEFAULT_RUN_SEED_FALLBACK ^ (salt | 0);
  }
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

export { MAX_UNLOCK_SLOTS };
