import type { ObjectiveOutcome } from './objectives.ts';
import type { SaunaTierId } from '../sauna/tiers.ts';
import { NG_PLUS_STORAGE_KEY } from './ngplus.ts';

export const ARTOCOIN_STORAGE_KEY = 'progression:artocoinBalance';
const DEFAULT_ARTOCOIN_BALANCE = 0;

export type ArtocoinChangeReason =
  | 'set'
  | 'payout'
  | 'purchase'
  | 'refund'
  | 'migration';

export interface ArtocoinChangeEvent {
  readonly balance: number;
  readonly delta: number;
  readonly reason: ArtocoinChangeReason;
  readonly metadata?: Record<string, unknown>;
}

type ArtocoinListener = (event: ArtocoinChangeEvent) => void;

const artocoinListeners = new Set<ArtocoinListener>();

interface ArtocoinTierTuning {
  readonly tierId: SaunaTierId;
  readonly nextUnlockLabel: string;
  readonly unlockCost: number;
  readonly baselinePayout: number;
  readonly baselineDurationMinutes: number;
  readonly baselineKills: number;
  readonly baselineTiles: number;
}

interface DifficultyModifier {
  readonly minScalar: number;
  readonly maxScalar?: number;
  readonly multiplier: number;
  readonly bonusPerStage?: number;
  readonly maxMultiplier?: number;
}

const TIER_TUNING: Record<SaunaTierId, ArtocoinTierTuning> = Object.freeze({
  'ember-circuit': {
    tierId: 'ember-circuit',
    nextUnlockLabel: 'Aurora Ward Gallery expansion',
    unlockCost: 70,
    baselinePayout: 60,
    baselineDurationMinutes: 12.5,
    baselineKills: 150,
    baselineTiles: 85
  },
  'aurora-ward': {
    tierId: 'aurora-ward',
    nextUnlockLabel: 'Glacial Rhythm Retreat tuning',
    unlockCost: 110,
    baselinePayout: 82,
    baselineDurationMinutes: 12,
    baselineKills: 185,
    baselineTiles: 98
  },
  'glacial-rhythm': {
    tierId: 'glacial-rhythm',
    nextUnlockLabel: 'Mythic Conclave Vault endowment',
    unlockCost: 160,
    baselinePayout: 96,
    baselineDurationMinutes: 11.6,
    baselineKills: 210,
    baselineTiles: 108
  },
  'mythic-conclave': {
    tierId: 'mythic-conclave',
    nextUnlockLabel: 'Solstice Cadence Atelier score',
    unlockCost: 210,
    baselinePayout: 118,
    baselineDurationMinutes: 11.2,
    baselineKills: 240,
    baselineTiles: 122
  },
  'solstice-cadence': {
    tierId: 'solstice-cadence',
    nextUnlockLabel: 'Celestial Reserve Sanctum coronation',
    unlockCost: 280,
    baselinePayout: 138,
    baselineDurationMinutes: 10.8,
    baselineKills: 270,
    baselineTiles: 135
  },
  'celestial-reserve': {
    tierId: 'celestial-reserve',
    nextUnlockLabel: 'Celestial Reserve Sanctum prestige rotation',
    unlockCost: 280,
    baselinePayout: 160,
    baselineDurationMinutes: 10.4,
    baselineKills: 305,
    baselineTiles: 150
  }
});

const DIFFICULTY_MODIFIERS: readonly DifficultyModifier[] = Object.freeze([
  { minScalar: 0, maxScalar: 0.95, multiplier: 0.85 },
  { minScalar: 0.95, maxScalar: 1.1, multiplier: 1 },
  { minScalar: 1.1, maxScalar: 1.3, multiplier: 1.18 },
  { minScalar: 1.3, maxScalar: 1.5, multiplier: 1.32 },
  { minScalar: 1.5, multiplier: 1.42, bonusPerStage: 0.03, maxMultiplier: 1.58 }
]);

function storageOrNull(): Storage | null {
  try {
    const globalWithStorage = globalThis as typeof globalThis & {
      localStorage?: Storage;
      window?: { localStorage?: Storage };
    };
    if (globalWithStorage.localStorage) {
      return globalWithStorage.localStorage;
    }
    if (globalWithStorage.window?.localStorage) {
      return globalWithStorage.window.localStorage;
    }
    return null;
  } catch (error) {
    console.warn('Local storage unavailable for artocoin progression', error);
    return null;
  }
}

function emitArtocoinChange(event: ArtocoinChangeEvent): void {
  for (const listener of artocoinListeners) {
    try {
      listener(event);
    } catch (error) {
      console.warn('Artocoin listener failure', error);
    }
  }
}

export function onArtocoinChange(listener: ArtocoinListener): () => void {
  artocoinListeners.add(listener);
  return () => {
    artocoinListeners.delete(listener);
  };
}

function sanitizeBalance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
}

export interface WriteArtocoinOptions {
  readonly reason?: ArtocoinChangeReason;
  readonly metadata?: Record<string, unknown>;
  readonly previousBalance?: number;
  readonly silent?: boolean;
}

function extractLegacyArtocoins(record: Record<string, unknown> | null): number {
  if (!record) {
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  const raw = record.artocoins ?? record.artocoinBalance;
  const balance = sanitizeBalance(raw);
  if ('artocoins' in record) {
    delete record.artocoins;
  }
  if ('artocoinBalance' in record) {
    delete record.artocoinBalance;
  }
  return balance;
}

function migrateLegacyBalance(storage: Storage): number {
  const raw = storage.getItem(NG_PLUS_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_ARTOCOIN_BALANCE;
    }
    const record = parsed as Record<string, unknown>;
    const balance = extractLegacyArtocoins(record);
    try {
      storage.setItem(NG_PLUS_STORAGE_KEY, JSON.stringify(record));
    } catch (error) {
      console.warn('Failed to persist migrated NG+ state without artocoins', error);
    }
    return balance;
  } catch (error) {
    console.warn('Failed to parse legacy NG+ state during artocoin migration', error);
    return DEFAULT_ARTOCOIN_BALANCE;
  }
}

export function loadArtocoinBalance(): number {
  const storage = storageOrNull();
  if (!storage) {
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  const raw = storage.getItem(ARTOCOIN_STORAGE_KEY);
  if (raw !== null) {
    const parsed = sanitizeBalance(raw);
    if (parsed !== DEFAULT_ARTOCOIN_BALANCE) {
      return parsed;
    }
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  const migrated = migrateLegacyBalance(storage);
  if (migrated !== DEFAULT_ARTOCOIN_BALANCE) {
    saveArtocoinBalance(migrated, {
      reason: 'migration',
      previousBalance: DEFAULT_ARTOCOIN_BALANCE
    });
    return migrated;
  }
  return DEFAULT_ARTOCOIN_BALANCE;
}

export function saveArtocoinBalance(
  balance: number,
  options: WriteArtocoinOptions = {}
): void {
  const storage = storageOrNull();
  const sanitized = sanitizeBalance(balance);

  let previous =
    typeof options.previousBalance === 'number'
      ? sanitizeBalance(options.previousBalance)
      : DEFAULT_ARTOCOIN_BALANCE;

  if (storage) {
    if (typeof options.previousBalance !== 'number') {
      try {
        const rawPrevious = storage.getItem(ARTOCOIN_STORAGE_KEY);
        if (rawPrevious !== null) {
          previous = sanitizeBalance(rawPrevious);
        }
      } catch (error) {
        console.warn('Failed to read previous artocoin balance', error);
      }
    }

    try {
      storage.setItem(ARTOCOIN_STORAGE_KEY, sanitized.toString());
    } catch (error) {
      console.warn('Failed to persist artocoin balance', error);
    }
  }

  if (!options.silent) {
    const delta = sanitized - previous;
    emitArtocoinChange({
      balance: sanitized,
      delta,
      reason: options.reason ?? 'set',
      metadata: options.metadata
    });
  }
}

export function resetArtocoinBalance(): void {
  const storage = storageOrNull();
  let previous = DEFAULT_ARTOCOIN_BALANCE;

  if (storage) {
    try {
      const rawPrevious = storage.getItem(ARTOCOIN_STORAGE_KEY);
      if (rawPrevious !== null) {
        previous = sanitizeBalance(rawPrevious);
      }
    } catch (error) {
      console.warn('Failed to read previous artocoin balance before reset', error);
    }

    try {
      storage.removeItem(ARTOCOIN_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear artocoin balance during reset', error);
    }
  } else {
    previous = loadArtocoinBalance();
  }

  emitArtocoinChange({
    balance: DEFAULT_ARTOCOIN_BALANCE,
    delta: DEFAULT_ARTOCOIN_BALANCE - previous,
    reason: 'set'
  });
}

export interface SpendArtocoinResult {
  readonly success: boolean;
  readonly balance: number;
  readonly shortfall?: number;
}

export function creditArtocoins(
  amount: number,
  options: WriteArtocoinOptions = {}
): number {
  const credit = Math.max(0, Math.floor(Number.isFinite(amount) ? amount : 0));
  if (credit === 0) {
    return loadArtocoinBalance();
  }
  const previous = loadArtocoinBalance();
  const next = Math.min(Number.MAX_SAFE_INTEGER, previous + credit);
  saveArtocoinBalance(next, {
    ...options,
    previousBalance: previous,
    reason: options.reason ?? 'payout'
  });
  return next;
}

export function spendArtocoins(
  cost: number,
  options: WriteArtocoinOptions = {}
): SpendArtocoinResult {
  const price = Math.max(0, Math.floor(Number.isFinite(cost) ? cost : 0));
  const previous = loadArtocoinBalance();
  if (price === 0) {
    return { success: true, balance: previous } satisfies SpendArtocoinResult;
  }
  if (previous < price) {
    return {
      success: false,
      balance: previous,
      shortfall: price - previous
    } satisfies SpendArtocoinResult;
  }
  const next = previous - price;
  saveArtocoinBalance(next, {
    ...options,
    previousBalance: previous,
    reason: options.reason ?? 'purchase'
  });
  return { success: true, balance: next } satisfies SpendArtocoinResult;
}

function clamp(min: number, max: number, value: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  if (min === max) {
    return min;
  }
  if (min > max) {
    return min;
  }
  const clamped = Math.max(min, Math.min(max, value));
  return Number.isNaN(clamped) ? min : clamped;
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function resolveDifficultyMultiplier(difficultyScalar: number, rampStageIndex: number): number {
  const scalar = Number.isFinite(difficultyScalar) ? difficultyScalar : 1;
  const stageIndex = Number.isFinite(rampStageIndex) ? Math.max(0, Math.floor(rampStageIndex)) : 0;
  for (const modifier of DIFFICULTY_MODIFIERS) {
    const withinUpper =
      typeof modifier.maxScalar === 'number' ? scalar < modifier.maxScalar : true;
    if (scalar >= modifier.minScalar && withinUpper) {
      if (modifier.bonusPerStage && modifier.maxMultiplier) {
        const extraStages = Math.max(0, stageIndex - 4);
        const bonus = extraStages * modifier.bonusPerStage;
        const boosted = modifier.multiplier + bonus;
        return Math.min(modifier.maxMultiplier, boosted);
      }
      return modifier.multiplier;
    }
  }
  return DIFFICULTY_MODIFIERS[DIFFICULTY_MODIFIERS.length - 1]?.multiplier ?? 1;
}

export interface ArtocoinPayoutInputs {
  readonly tierId: SaunaTierId;
  readonly runSeconds: number;
  readonly enemyKills: number;
  readonly tilesExplored: number;
  readonly rosterLosses: number;
  readonly difficultyScalar: number;
  readonly rampStageIndex: number;
}

export interface ArtocoinPayoutBreakdown {
  readonly baseline: number;
  readonly performanceMultiplier: number;
  readonly lossPenalty: number;
  readonly difficultyMultiplier: number;
}

export interface ArtocoinPayoutResult {
  readonly artocoins: number;
  readonly breakdown: ArtocoinPayoutBreakdown;
}

function resolveTierTuning(tierId: SaunaTierId): ArtocoinTierTuning {
  return TIER_TUNING[tierId] ?? TIER_TUNING['ember-circuit'];
}

function calculateWinPayout(input: ArtocoinPayoutInputs): ArtocoinPayoutResult {
  const tuning = resolveTierTuning(input.tierId);
  const baseline = tuning.baselinePayout;
  const tempoMinutes = Number.isFinite(input.runSeconds) ? input.runSeconds / 60 : 0;
  const tempoTarget = tuning.baselineDurationMinutes;
  const tempoFactor = clamp(
    0.75,
    1.2,
    1 + ((tempoTarget - tempoMinutes) / tempoTarget) * 0.35
  );
  const killFactor = clamp(0.6, 1.45, input.enemyKills / tuning.baselineKills);
  const exploreFactor = clamp(0.7, 1.25, input.tilesExplored / tuning.baselineTiles);
  const performanceMultiplier = tempoFactor * 0.3 + killFactor * 0.45 + exploreFactor * 0.25;
  const lossPenalty = 1;
  const difficultyMultiplier = resolveDifficultyMultiplier(
    input.difficultyScalar,
    input.rampStageIndex
  );
  const artocoins = Math.round(
    baseline * performanceMultiplier * difficultyMultiplier
  );
  return {
    artocoins,
    breakdown: {
      baseline,
      performanceMultiplier,
      lossPenalty,
      difficultyMultiplier
    }
  } satisfies ArtocoinPayoutResult;
}

function calculateDefeatPayout(input: ArtocoinPayoutInputs): ArtocoinPayoutResult {
  const tuning = resolveTierTuning(input.tierId);
  const baseline = tuning.baselinePayout;
  const difficultyMultiplier = resolveDifficultyMultiplier(
    input.difficultyScalar,
    input.rampStageIndex
  );
  const floorPayout = baseline * 0.2 * difficultyMultiplier;
  const tempoProgress = input.runSeconds / (tuning.baselineDurationMinutes * 60);
  const killProgress = input.enemyKills / tuning.baselineKills;
  const progress = clamp01(0.5 * tempoProgress + 0.5 * killProgress);
  const performanceShare = baseline * 0.45 * progress * difficultyMultiplier;
  const lossPenalty = 1;
  const artocoins = Math.round(Math.max(floorPayout, performanceShare));
  return {
    artocoins,
    breakdown: {
      baseline,
      performanceMultiplier: performanceShare / baseline,
      lossPenalty,
      difficultyMultiplier
    }
  } satisfies ArtocoinPayoutResult;
}

export function calculateArtocoinPayout(
  outcome: ObjectiveOutcome,
  input: ArtocoinPayoutInputs
): ArtocoinPayoutResult {
  if (outcome === 'win') {
    return calculateWinPayout(input);
  }
  return calculateDefeatPayout(input);
}

export type { ArtocoinTierTuning };
