import type { LevelCurve } from './types.ts';

export function normalizeLevel(level?: number): number {
  if (!Number.isFinite(level ?? NaN)) {
    return 1;
  }
  const normalized = Math.floor(level as number);
  return Math.max(1, normalized);
}

export function levelIndex(level?: number): number {
  return Math.max(0, normalizeLevel(level) - 1);
}

export function curveProgress(level: number, curve: LevelCurve = 'linear'): number {
  const index = levelIndex(level);
  switch (curve) {
    case 'accelerating':
      return (index * (index + 1)) / 2;
    case 'diminishing':
      return index === 0 ? 0 : Math.log2(index + 1);
    case 'linear':
    default:
      return index;
  }
}
