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

function zeroAwards(): StatAwards {
  return { vigor: 0, focus: 0, resolve: 0 } satisfies StatAwards;
}

function cloneAwards(awards: StatAwards): StatAwards {
  return { vigor: awards.vigor, focus: awards.focus, resolve: awards.resolve } satisfies StatAwards;
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

/** Returns the documented stat awards for the provided level. */
export function getStatAwardsForLevel(level: number): StatAwards {
  const maxLevel = EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1].level;
  const capped = Math.max(EXPERIENCE_LEVELS[0].level, Math.min(level, maxLevel));
  const match = EXPERIENCE_LEVELS.find((entry) => entry.level === capped);
  return match ? cloneAwards(match.statAwards) : zeroAwards();
}

/** Returns the cumulative stat bonuses granted up to and including the provided level. */
export function getTotalStatAwards(level: number): StatAwards {
  if (level <= EXPERIENCE_LEVELS[0].level) {
    return zeroAwards();
  }
  const maxLevel = EXPERIENCE_LEVELS[EXPERIENCE_LEVELS.length - 1].level;
  const capped = Math.min(level, maxLevel);
  const total = zeroAwards();
  for (const entry of EXPERIENCE_LEVELS) {
    if (entry.level > capped) {
      break;
    }
    if (entry.level === EXPERIENCE_LEVELS[0].level) {
      continue;
    }
    total.vigor += entry.statAwards.vigor;
    total.focus += entry.statAwards.focus;
    total.resolve += entry.statAwards.resolve;
  }
  return total;
}

/** Convenience wrapper returning just the level for a given XP total. */
export function getLevelForExperience(totalXp: number): number {
  return getLevelProgress(totalXp).level;
}
