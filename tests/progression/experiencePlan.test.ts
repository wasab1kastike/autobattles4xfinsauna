import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_LEVELS,
  getExperienceForLevel,
  getLevelProgress,
  type ExperienceLevel,
} from '../../src/progression/experiencePlan.ts';

describe('experience plan', () => {
  const documentedPlan: Pick<ExperienceLevel, 'level' | 'xpToNext' | 'cumulativeXp' | 'statAwards'>[] = [
    { level: 1, xpToNext: 40, cumulativeXp: 0, statAwards: { vigor: 0, focus: 0, resolve: 0 } },
    { level: 2, xpToNext: 212, cumulativeXp: 40, statAwards: { vigor: 5, focus: 2, resolve: 1 } },
    { level: 3, xpToNext: 252, cumulativeXp: 252, statAwards: { vigor: 4, focus: 3, resolve: 1 } },
    { level: 4, xpToNext: 312, cumulativeXp: 504, statAwards: { vigor: 4, focus: 2, resolve: 2 } },
    { level: 5, xpToNext: 372, cumulativeXp: 816, statAwards: { vigor: 6, focus: 3, resolve: 2 } },
    { level: 6, xpToNext: 452, cumulativeXp: 1188, statAwards: { vigor: 7, focus: 3, resolve: 3 } },
    { level: 7, xpToNext: 532, cumulativeXp: 1640, statAwards: { vigor: 6, focus: 4, resolve: 3 } },
    { level: 8, xpToNext: 632, cumulativeXp: 2172, statAwards: { vigor: 7, focus: 4, resolve: 4 } },
    { level: 9, xpToNext: 752, cumulativeXp: 2804, statAwards: { vigor: 8, focus: 5, resolve: 4 } },
    { level: 10, xpToNext: 892, cumulativeXp: 3556, statAwards: { vigor: 9, focus: 6, resolve: 5 } },
    { level: 11, xpToNext: 1052, cumulativeXp: 4448, statAwards: { vigor: 10, focus: 6, resolve: 6 } },
    { level: 12, xpToNext: null, cumulativeXp: 5500, statAwards: { vigor: 12, focus: 7, resolve: 6 } },
  ];

  it('matches the documented curve exactly', () => {
    expect(EXPERIENCE_LEVELS).toHaveLength(documentedPlan.length);
    for (const [index, expectedLevel] of documentedPlan.entries()) {
      const actual = EXPERIENCE_LEVELS[index];
      expect(actual.level).toBe(expectedLevel.level);
      expect(actual.xpToNext).toBe(expectedLevel.xpToNext);
      expect(actual.cumulativeXp).toBe(expectedLevel.cumulativeXp);
      expect(actual.statAwards).toStrictEqual(expectedLevel.statAwards);
    }
  });

  it('calculates level progress across boundaries', () => {
    const start = getLevelProgress(0);
    expect(start.level).toBe(1);
    expect(start.progressToNext).toBe(0);
    expect(start.xpForNext).toBe(40);

    const beforeLevelUp = getLevelProgress(39);
    expect(beforeLevelUp.level).toBe(1);
    expect(beforeLevelUp.progressToNext).toBeCloseTo(39 / 40);

    const exactThreshold = getLevelProgress(504);
    expect(exactThreshold.level).toBe(4);
    expect(exactThreshold.xpIntoLevel).toBe(0);

    const deepRun = getLevelProgress(6000);
    expect(deepRun.level).toBe(12);
    expect(deepRun.xpForNext).toBeNull();
    expect(deepRun.progressToNext).toBe(1);
  });

  it('floors fractional XP and ignores invalid numbers', () => {
    const fractional = getLevelProgress(252.9);
    expect(fractional.level).toBe(3);
    expect(fractional.xpIntoLevel).toBe(0);

    const negative = getLevelProgress(-50);
    expect(negative.level).toBe(1);
    expect(negative.xpIntoLevel).toBe(0);

    const invalid = getLevelProgress(Number.NaN);
    expect(invalid.level).toBe(1);
    expect(invalid.xpIntoLevel).toBe(0);
  });

  it('maps level requests back to documented cumulative XP', () => {
    expect(getExperienceForLevel(1)).toBe(0);
    expect(getExperienceForLevel(5)).toBe(816);
    expect(getExperienceForLevel(12)).toBe(5500);
    expect(getExperienceForLevel(20)).toBe(5500);
    expect(getExperienceForLevel(0)).toBe(0);
  });
});
