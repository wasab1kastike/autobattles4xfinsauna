import type { EnemySpawnerSnapshot } from '../../sim/EnemySpawner.ts';

export interface EnemyScalingTelemetryOptions {
  readonly wipeSince?: number | null;
  readonly wipeDurationMs?: number;
}

let lastStageIndex = -1;
let lastLoggedSpawnCycles = -1;
let lastLoggedClearAt: number | null = null;

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

  const payload = {
    stage: snapshot.rampStageLabel,
    stageIndex: snapshot.rampStageIndex,
    bundleTier: snapshot.bundleTier,
    cadenceSeconds: Number(snapshot.cadence.toFixed(2)),
    lastCadenceSeconds: Number(snapshot.lastCadence.toFixed(2)),
    multiplier: Number(snapshot.difficultyMultiplier.toFixed(2)),
    runSeconds: Math.round(snapshot.runSeconds),
    spawnCycles: snapshot.spawnCycles,
    clears: snapshot.clears,
    wipeSince: options.wipeSince ?? null,
    longestWipeMs: options.wipeDurationMs ?? 0
  };

  if (import.meta.env.PROD) {
    console.info('enemy-scaling', payload);
  } else {
    console.debug('Enemy scaling telemetry', payload);
  }
}

export function resetEnemyScalingTelemetry(): void {
  lastStageIndex = -1;
  lastLoggedSpawnCycles = -1;
  lastLoggedClearAt = null;
}
