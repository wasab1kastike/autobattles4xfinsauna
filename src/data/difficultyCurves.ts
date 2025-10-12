function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

export interface EnemyRampMetrics {
  readonly runSeconds: number;
  readonly clears: number;
  readonly spawnCycles: number;
}

export interface EnemyRampStageDefinition {
  readonly id: string;
  readonly label: string;
  readonly minRunSeconds: number;
  readonly minClears: number;
  readonly cadence: number;
  readonly multiplier: number;
  readonly bundleTier: number;
}

export interface EnemyRampEvaluation {
  readonly stage: EnemyRampStageDefinition;
  readonly stageIndex: number;
  readonly cadenceTarget: number;
  readonly multiplierBase: number;
}

const ENEMY_RAMP_STAGES: readonly EnemyRampStageDefinition[] = Object.freeze([
  {
    id: 'skirmish',
    label: 'Skirmish Patrols',
    minRunSeconds: 0,
    minClears: 0,
    cadence: 26,
    multiplier: 1,
    bundleTier: 0
  },
  {
    id: 'raids',
    label: 'Raid Pressure',
    minRunSeconds: 90,
    minClears: 2,
    cadence: 19,
    multiplier: 1.35,
    bundleTier: 1
  },
  {
    id: 'siege',
    label: 'Siege Lines',
    minRunSeconds: 210,
    minClears: 5,
    cadence: 13,
    multiplier: 1.8,
    bundleTier: 2
  },
  {
    id: 'onslaught',
    label: 'Winter Onslaught',
    minRunSeconds: 360,
    minClears: 9,
    cadence: 8.5,
    multiplier: 2.45,
    bundleTier: 3
  },
  {
    id: 'maelstrom',
    label: 'Glacier Maelstrom',
    minRunSeconds: 540,
    minClears: 14,
    cadence: 6.2,
    multiplier: 3.25,
    bundleTier: 4
  }
]);

function cadenceScaleForDifficulty(difficulty: number): number {
  if (difficulty >= 1) {
    const normalized = difficulty - 1;
    return 1 / (1 + normalized * 0.45);
  }
  const deficit = 1 - difficulty;
  return 1 + deficit * 0.35;
}

function multiplierScaleForDifficulty(difficulty: number): number {
  if (difficulty >= 1) {
    const normalized = difficulty - 1;
    return 1 + normalized * 0.85;
  }
  const deficit = 1 - difficulty;
  return clamp(1 - deficit * 0.4, 0.45, 1);
}

function sanitizeMetrics(metrics: EnemyRampMetrics): EnemyRampMetrics {
  return {
    runSeconds: Math.max(0, Number.isFinite(metrics.runSeconds) ? metrics.runSeconds : 0),
    clears: Math.max(0, Number.isFinite(metrics.clears) ? metrics.clears : 0),
    spawnCycles: Math.max(0, Number.isFinite(metrics.spawnCycles) ? metrics.spawnCycles : 0)
  } satisfies EnemyRampMetrics;
}

export function evaluateEnemyRamp(
  difficulty: number,
  metrics: EnemyRampMetrics
): EnemyRampEvaluation {
  const sanitized = sanitizeMetrics(metrics);
  let stageIndex = 0;
  for (let index = 0; index < ENEMY_RAMP_STAGES.length; index += 1) {
    const stage = ENEMY_RAMP_STAGES[index];
    if (sanitized.runSeconds < stage.minRunSeconds || sanitized.clears < stage.minClears) {
      break;
    }
    stageIndex = index;
  }
  const stage = ENEMY_RAMP_STAGES[stageIndex];
  const cadenceScale = cadenceScaleForDifficulty(difficulty);
  const multiplierScale = multiplierScaleForDifficulty(difficulty);
  const cadenceTarget = Math.max(0.75, stage.cadence * cadenceScale);
  const multiplierBase = stage.multiplier * multiplierScale;
  return { stage, stageIndex, cadenceTarget, multiplierBase } satisfies EnemyRampEvaluation;
}

export function getEnemyCadenceDecay(difficulty: number): number {
  if (difficulty >= 1) {
    const normalized = Math.min(3, difficulty - 1);
    return clamp(0.93 - normalized * 0.035, 0.82, 0.93);
  }
  const deficit = Math.min(1, 1 - difficulty);
  return clamp(0.93 + deficit * 0.03, 0.9, 0.97);
}

export function getEnemyMultiplierGrowth(difficulty: number): number {
  if (difficulty >= 1) {
    const normalized = Math.min(3, difficulty - 1);
    return 0.024 + normalized * 0.012;
  }
  const deficit = Math.min(1, 1 - difficulty);
  return Math.max(0.012, 0.024 - deficit * 0.01);
}

export function getEnemyRampStages(): readonly EnemyRampStageDefinition[] {
  return ENEMY_RAMP_STAGES;
}
