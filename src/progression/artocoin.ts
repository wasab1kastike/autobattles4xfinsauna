import type { ObjectiveOutcome } from './objectives.ts';
import type { SaunaTierId } from '../sauna/tiers.ts';
import { NG_PLUS_STORAGE_KEY } from './ngplus.ts';

export const ARTOCOIN_STORAGE_KEY = 'progression:artocoinBalance';
const DEFAULT_ARTOCOIN_BALANCE = 0;

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
    nextUnlockLabel: 'Aurora Ward key engraving',
    unlockCost: 150,
    baselinePayout: 60,
    baselineDurationMinutes: 12.5,
    baselineKills: 150,
    baselineTiles: 85
  },
  'aurora-ward': {
    tierId: 'aurora-ward',
    nextUnlockLabel: 'Mythic Conclave rite',
    unlockCost: 210,
    baselinePayout: 84,
    baselineDurationMinutes: 12,
    baselineKills: 190,
    baselineTiles: 100
  },
  'mythic-conclave': {
    tierId: 'mythic-conclave',
    nextUnlockLabel: 'Prestige cache rotation',
    unlockCost: 275,
    baselinePayout: 110,
    baselineDurationMinutes: 11.5,
    baselineKills: 230,
    baselineTiles: 115
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

function sanitizeBalance(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return DEFAULT_ARTOCOIN_BALANCE;
  }
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(numeric));
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
    saveArtocoinBalance(migrated);
    return migrated;
  }
  return DEFAULT_ARTOCOIN_BALANCE;
}

export function saveArtocoinBalance(balance: number): void {
  const storage = storageOrNull();
  if (!storage) {
    return;
  }
  const sanitized = sanitizeBalance(balance);
  try {
    storage.setItem(ARTOCOIN_STORAGE_KEY, sanitized.toString());
  } catch (error) {
    console.warn('Failed to persist artocoin balance', error);
  }
}

export function resetArtocoinBalance(): void {
  const storage = storageOrNull();
  storage?.removeItem(ARTOCOIN_STORAGE_KEY);
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
  const lossPenalty = Math.max(0.4, 1 - Math.max(0, input.rosterLosses) * 0.22);
  const difficultyMultiplier = resolveDifficultyMultiplier(
    input.difficultyScalar,
    input.rampStageIndex
  );
  const artocoins = Math.round(
    baseline * performanceMultiplier * lossPenalty * difficultyMultiplier
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
  const lossFloor = Math.max(0.35, 1 - Math.max(0, input.rosterLosses) * 0.12);
  const artocoins = Math.round(Math.max(floorPayout, performanceShare) * lossFloor);
  return {
    artocoins,
    breakdown: {
      baseline,
      performanceMultiplier: performanceShare / baseline,
      lossPenalty: lossFloor,
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
