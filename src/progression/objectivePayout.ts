import type { ObjectiveResolution } from './objectives.ts';

export function coerceObjectiveMetric(value: number | null | undefined): number {
  return Number.isFinite(value) ? (value as number) : 0;
}

export interface ObjectiveArtocoinMetrics {
  readonly runSeconds: number;
  readonly enemyKills: number;
  readonly tilesExplored: number;
  readonly rosterLosses: number;
}

export function extractObjectiveMetrics(resolution: ObjectiveResolution): ObjectiveArtocoinMetrics {
  return {
    runSeconds: coerceObjectiveMetric(resolution.durationMs) / 1000,
    enemyKills: coerceObjectiveMetric(resolution.summary.enemyKills),
    tilesExplored: coerceObjectiveMetric(resolution.summary.exploration.revealedHexes),
    rosterLosses: coerceObjectiveMetric(resolution.summary.roster.totalDeaths)
  } satisfies ObjectiveArtocoinMetrics;
}
