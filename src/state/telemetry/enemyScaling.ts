import type { EnemySpawnerSnapshot } from '../../sim/EnemySpawner.ts';
import { safeLoadJSON } from '../../loader.ts';
import {
  emitStructuredTelemetry,
  persistStructuredTelemetry,
  type StructuredTelemetryEntry
} from './structured.ts';

export interface EnemyScalingTelemetryOptions {
  readonly wipeSince?: number | null;
  readonly wipeDurationMs?: number;
}

let lastStageIndex = -1;
let lastLoggedSpawnCycles = -1;
let lastLoggedClearAt: number | null = null;
let peakMultiplier = 0;
let longestCalmMs = 0;

const ENEMY_SCALING_SUMMARY_KEY = 'telemetry:enemy-scaling:summaries';

export interface EnemyScalingSummaryEntry {
  readonly timestamp: number;
  readonly stageLabel: string;
  readonly stageIndex: number;
  readonly multiplier: number;
  readonly peakMultiplier: number;
  readonly calmSeconds: number;
  readonly longestCalmMs: number;
  readonly longestWipeMs: number;
  readonly wipeSince: number | null;
}

function coerceFiniteNumber(value: unknown, fallback: number): number {
  const coerced = typeof value === 'string' && value.trim() !== '' ? Number(value) : (value as number);
  if (typeof coerced !== 'number' || !Number.isFinite(coerced)) {
    return fallback;
  }
  return coerced;
}

function sanitizeStageLabel(payload: Record<string, unknown>, stageIndex: number): string {
  const rawStage = payload.stage;
  if (typeof rawStage === 'string') {
    const trimmed = rawStage.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (stageIndex >= 0) {
    return `Stage ${stageIndex + 1}`;
  }
  return 'Unknown stage';
}

function sanitizeStageIndex(payload: Record<string, unknown>): number {
  const raw = Number((payload as Record<string, unknown>).stageIndex);
  if (!Number.isFinite(raw)) {
    return -1;
  }
  return Number.isInteger(raw) ? raw : Math.trunc(raw);
}

export function selectEnemyScalingSummaries(): EnemyScalingSummaryEntry[] {
  const rawEntries = safeLoadJSON<StructuredTelemetryEntry[]>(ENEMY_SCALING_SUMMARY_KEY);
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    return [];
  }

  const summaries: EnemyScalingSummaryEntry[] = [];
  for (const entry of rawEntries) {
    if (!entry || entry.event !== 'enemy-scaling') {
      continue;
    }
    const timestamp = coerceFiniteNumber(entry.timestamp, Number.NaN);
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      continue;
    }
    const payload = (entry.payload ?? {}) as Record<string, unknown>;
    const stageIndex = sanitizeStageIndex(payload);

    const rawMultiplier = Number(payload.multiplier);
    if (!Number.isFinite(rawMultiplier)) {
      continue;
    }
    const multiplier = Math.max(0, Number(rawMultiplier.toFixed(2)));

    const rawPeak = Number(payload.peakMultiplier);
    const peakMultiplier = Number.isFinite(rawPeak)
      ? Math.max(multiplier, Number(rawPeak.toFixed(2)))
      : multiplier;

    const calmSource = Number(payload.calmSecondsRemaining);
    const calmSeconds = Number.isFinite(calmSource) ? Math.max(0, Number(calmSource.toFixed(3))) : 0;

    const longestCalmSource = Number(payload.longestCalmMs);
    const longestCalmMs = Number.isFinite(longestCalmSource)
      ? Math.max(0, Math.round(longestCalmSource))
      : Math.max(0, Math.round(calmSeconds * 1000));

    const longestWipeSource = Number(payload.longestWipeMs);
    const longestWipeMs = Number.isFinite(longestWipeSource)
      ? Math.max(0, Math.round(longestWipeSource))
      : 0;

    const wipeSinceNumeric = Number(payload.wipeSince);
    const wipeSince =
      Number.isFinite(wipeSinceNumeric) && wipeSinceNumeric > 0 ? Math.trunc(wipeSinceNumeric) : null;

    const summary: EnemyScalingSummaryEntry = {
      timestamp: Math.trunc(timestamp),
      stageLabel: sanitizeStageLabel(payload, stageIndex),
      stageIndex: stageIndex >= 0 ? stageIndex : -1,
      multiplier,
      peakMultiplier,
      calmSeconds,
      longestCalmMs,
      longestWipeMs,
      wipeSince
    };
    summaries.push(summary);
  }

  summaries.sort((a, b) => b.timestamp - a.timestamp);
  return summaries;
}

export function recordEnemyScalingTelemetry(
  snapshot: EnemySpawnerSnapshot,
  options: EnemyScalingTelemetryOptions = {}
): void {
  const stageChanged = snapshot.rampStageIndex !== lastStageIndex;
  const spawnAdvanced = snapshot.spawnCycles >= lastLoggedSpawnCycles + 10;
  const clearChanged = snapshot.lastClearAt !== null && snapshot.lastClearAt !== lastLoggedClearAt;

  if (!stageChanged && !spawnAdvanced && !clearChanged) {
    return;
  }

  lastStageIndex = snapshot.rampStageIndex;
  lastLoggedSpawnCycles = snapshot.spawnCycles;
  lastLoggedClearAt = snapshot.lastClearAt ?? lastLoggedClearAt;

  peakMultiplier = Math.max(peakMultiplier, snapshot.difficultyMultiplier);
  const calmMs = Math.max(0, Math.round(snapshot.calmSecondsRemaining * 1000));
  if (calmMs > longestCalmMs) {
    longestCalmMs = calmMs;
  }

  const payload = {
    stage: snapshot.rampStageLabel,
    stageIndex: snapshot.rampStageIndex,
    bundleTier: snapshot.bundleTier,
    cadenceSeconds: Number(snapshot.cadence.toFixed(2)),
    lastCadenceSeconds: Number(snapshot.lastCadence.toFixed(2)),
    multiplier: Number(snapshot.difficultyMultiplier.toFixed(2)),
    effectiveDifficulty: Number(snapshot.effectiveDifficulty.toFixed(2)),
    aggressionMultiplier: Number(snapshot.aggressionMultiplier.toFixed(2)),
    cadenceMultiplier: Number(snapshot.cadenceMultiplier.toFixed(2)),
    strengthMultiplier: Number(snapshot.strengthMultiplier.toFixed(2)),
    pressureMultiplier: Number(snapshot.pressureMultiplier.toFixed(2)),
    calmSecondsRemaining: Number(snapshot.calmSecondsRemaining.toFixed(2)),
    runSeconds: Math.round(snapshot.runSeconds),
    spawnCycles: snapshot.spawnCycles,
    clears: snapshot.clears,
    wipeSince: options.wipeSince ?? null,
    longestWipeMs: options.wipeDurationMs ?? 0,
    peakMultiplier: Number(peakMultiplier.toFixed(2)),
    longestCalmMs
  };

  const entry: StructuredTelemetryEntry = emitStructuredTelemetry('enemy-scaling', payload);
  persistStructuredTelemetry(ENEMY_SCALING_SUMMARY_KEY, entry, { limit: 24 });
}

export function resetEnemyScalingTelemetry(): void {
  lastStageIndex = -1;
  lastLoggedSpawnCycles = -1;
  lastLoggedClearAt = null;
  peakMultiplier = 0;
  longestCalmMs = 0;
}
