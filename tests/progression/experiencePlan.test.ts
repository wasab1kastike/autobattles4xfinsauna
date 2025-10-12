import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_LEVELS,
  getExperienceForLevel,
  getLevelProgress,
  type ExperienceLevel,
} from '../../src/progression/experiencePlan.ts';

describe('experience plan', () => {
  const documentedPlan: Pick<ExperienceLevel, 'level' | 'xpToNext' | 'cumulativeXp' | 'statAwards'>[] = [
    { level: 1, xpToNext: 180, cumulativeXp: 0, statAwards: { vigor: 0, focus: 0, resolve: 0 } },
    { level: 2, xpToNext: 220, cumulativeXp: 180, statAwards: { vigor: 5, focus: 2, resolve: 1 } },
    { level: 3, xpToNext: 260, cumulativeXp: 400, statAwards: { vigor: 4, focus: 3, resolve: 1 } },
    { level: 4, xpToNext: 320, cumulativeXp: 660, statAwards: { vigor: 4, focus: 2, resolve: 2 } },
    { level: 5, xpToNext: 380, cumulativeXp: 980, statAwards: { vigor: 6, focus: 3, resolve: 2 } },
    { level: 6, xpToNext: 460, cumulativeXp: 1360, statAwards: { vigor: 7, focus: 3, resolve: 3 } },
    { level: 7, xpToNext: 540, cumulativeXp: 1820, statAwards: { vigor: 6, focus: 4, resolve: 3 } },
    { level: 8, xpToNext: 640, cumulativeXp: 2360, statAwards: { vigor: 7, focus: 4, resolve: 4 } },
    { level: 9, xpToNext: 760, cumulativeXp: 3000, statAwards: { vigor: 8, focus: 5, resolve: 4 } },
    { level: 10, xpToNext: 900, cumulativeXp: 3760, statAwards: { vigor: 9, focus: 6, resolve: 5 } },
    { level: 11, xpToNext: 1060, cumulativeXp: 4660, statAwards: { vigor: 10, focus: 6, resolve: 6 } },
    { level: 12, xpToNext: null, cumulativeXp: 5720, statAwards: { vigor: 12, focus: 7, resolve: 6 } },
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
    expect(start.xpForNext).toBe(180);

    const beforeLevelUp = getLevelProgress(179);
    expect(beforeLevelUp.level).toBe(1);
    expect(beforeLevelUp.progressToNext).toBeCloseTo(179 / 180);

    const exactThreshold = getLevelProgress(660);
    expect(exactThreshold.level).toBe(4);
    expect(exactThreshold.xpIntoLevel).toBe(0);

    const deepRun = getLevelProgress(6000);
    expect(deepRun.level).toBe(12);
    expect(deepRun.xpForNext).toBeNull();
    expect(deepRun.progressToNext).toBe(1);
  });

  it('floors fractional XP and ignores invalid numbers', () => {
    const fractional = getLevelProgress(400.9);
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
    expect(getExperienceForLevel(5)).toBe(980);
    expect(getExperienceForLevel(12)).toBe(5720);
    expect(getExperienceForLevel(20)).toBe(5720);
    expect(getExperienceForLevel(0)).toBe(0);
  });
});
