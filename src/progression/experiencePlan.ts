export interface StatAwards {
  vigor: number;
  focus: number;
  resolve: number;
}

export interface ExperienceLevel {
  /** The player-facing level reached when cumulative XP meets this entry. */
  level: number;
  /** XP required to advance from this level to the next. Null when the level is the cap. */
  xpToNext: number | null;
  /** Total XP required to begin this level (cumulative). */
  cumulativeXp: number;
  /** Stat bonuses granted on reaching this level. */
  statAwards: StatAwards;
}

export const EXPERIENCE_LEVELS: ExperienceLevel[] = [
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

export interface LevelProgress {
  level: number;
  xpIntoLevel: number;
  xpForNext: number | null;
  progressToNext: number;
  /** Stat awards granted when the current level was reached. */
  statAwards: StatAwards;
}

function clampXp(totalXp: number): number {
  if (Number.isNaN(totalXp) || !Number.isFinite(totalXp)) {
    return 0;
  }
  return Math.max(0, Math.floor(totalXp));
}

/**
 * Returns the level associated with the provided XP as well as progress toward the next level.
 * Aligns with docs/progression/experience.md so tests can guard against accidental drift.
 */
export function getLevelProgress(totalXp: number): LevelProgress {
  const safeXp = clampXp(totalXp);
  let currentLevel = EXPERIENCE_LEVELS[0];
  for (const level of EXPERIENCE_LEVELS) {
    if (safeXp >= level.cumulativeXp) {
      currentLevel = level;
    } else {
      break;
    }
  }

  const xpIntoLevel = safeXp - currentLevel.cumulativeXp;
  const xpForNext = currentLevel.xpToNext;
  const progressToNext = xpForNext ? Math.min(1, xpIntoLevel / xpForNext) : 1;

  return {
    level: currentLevel.level,
    xpIntoLevel,
    xpForNext,
    progressToNext,
    statAwards: currentLevel.statAwards,
  };
}

/** Total XP required to begin the requested level. Levels are clamped to the documented range. */
export function getExperienceForLevel(level: number): number {
  if (level <= EXPERIENCE_LEVELS[0].level) {
    return EXPERIENCE_LEVELS[0].cumulativeXp;
  }

  const cappedLevel = Math.min(level, EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1].level);
  const match = EXPERIENCE_LEVELS.find((entry) => entry.level === cappedLevel);
  return match ? match.cumulativeXp : EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1].cumulativeXp;
}
