import type { EnemySpawnerSnapshot } from '../../sim/EnemySpawner.ts';
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
