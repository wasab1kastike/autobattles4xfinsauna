# Design Note: Artocoin Payout Pipeline

## Goals
- Convert battle telemetry (run duration, kill count, tiles explored, roster
  losses for analytics, difficulty scalar, tier) into a deterministic artocoin
  award.
- Keep tier unlock pacing near a one-to-one-and-a-half win cadence while letting high-skill clears
  accelerate rewards and defeats still contribute.
- Provide explicit clamps and constants so engineering can implement without
  additional balancing passes.

## Data Model
```ts
interface ArtocoinTierTuning {
  tierId: SaunaTierId;
  nextUnlockLabel: string;
  unlockCost: number; // Artocoins required for the next milestone.
  baselinePayout: number; // Artocoins for an average win.
  baselineDurationMinutes: number;
  baselineKills: number;
  baselineTiles: number;
}
```

Populate the table with:

| tierId | nextUnlockLabel | unlockCost | baselinePayout | baselineDurationMinutes | baselineKills | baselineTiles |
| --- | --- | --- | --- | --- | --- | --- |
| `ember-circuit` | "Modern Wooden Sauna commission" | `60` | `60` | `12.5` | `150` | `85` |
| `aurora-ward` | "Futuristic Fission Sauna ignition" | `130` | `84` | `12.0` | `190` | `100` |
| `mythic-conclave` | "Futuristic Fission Sauna prestige rotation" | `130` | `110` | `11.5` | `230` | `115` |

Difficulty modifiers mirror the existing difficulty scalar exposed by the enemy
ramp system.

```ts
interface DifficultyModifier {
  minScalar: number; // inclusive lower bound from the game difficulty value
  maxScalar?: number; // optional exclusive upper bound
  multiplier: number;
  bonusPerStage?: number; // Endless bonus per ramp stage beyond maelstrom
  maxMultiplier?: number; // cap when bonusPerStage is applied
}
```

Use the following table:

| Range | multiplier | Notes |
| --- | --- | --- |
| `[0, 0.95)` | `0.85` | Relaxed Heat training. |
| `[0.95, 1.1)` | `1.0` | Standard Steam reference. |
| `[1.1, 1.3)` | `1.18` | Veteran Sauna. |
| `[1.3, 1.5)` | `1.32` | Mythic Heat. |
| `[1.5, ∞)` | `1.42` base, `bonusPerStage = 0.03`, `maxMultiplier = 1.58` | Endless Onslaught; add 0.03 per ramp stage completed past Maelstrom. |

The ramp stage index is available from `evaluateEnemyRamp` and should be passed
into the payout function to apply the Endless bonus.

## Win Payout Algorithm
```ts
interface PayoutInputs {
  tierId: SaunaTierId;
  runSeconds: number;
  enemyKills: number;
  tilesExplored: number;
  rosterLosses: number;
  difficultyScalar: number;
  rampStageIndex: number; // needed for Endless bonus
}

interface PayoutResult {
  artocoins: number;
  breakdown: {
    baseline: number;
    performanceMultiplier: number;
    lossPenalty: number;
    difficultyMultiplier: number;
  };
}

function calculateWinPayout(input: PayoutInputs): PayoutResult {
  const tuning = tierTuning[input.tierId];
  const baseline = tuning.baselinePayout;
  const tempoTarget = tuning.baselineDurationMinutes;
  const killsTarget = tuning.baselineKills;
  const tileTarget = tuning.baselineTiles;

  const tempoMinutes = input.runSeconds / 60;
  const tempoFactor = clamp(
    0.75,
    1.2,
    1 + ((tempoTarget - tempoMinutes) / tempoTarget) * 0.35
  );
  const killFactor = clamp(0.6, 1.45, input.enemyKills / killsTarget);
  const exploreFactor = clamp(0.7, 1.25, input.tilesExplored / tileTarget);

  const performanceMultiplier =
    tempoFactor * 0.3 + killFactor * 0.45 + exploreFactor * 0.25;

  const lossPenalty = 1;

  const difficultyMultiplier = resolveDifficultyMultiplier(
    input.difficultyScalar,
    input.rampStageIndex
  );

  const artocoins = Math.round(
    baseline * performanceMultiplier * difficultyMultiplier
  );

  return {
    artocoins,
    breakdown: { baseline, performanceMultiplier, lossPenalty, difficultyMultiplier }
  };
}
```

`clamp` is the usual `min/max` helper. Implement `resolveDifficultyMultiplier`
using the tables above and add the Endless bonus when
`input.difficultyScalar >= 1.5` and the evaluated ramp stage index exceeds the
Maelstrom stage (index ≥ 4). Each full stage beyond Maelstrom adds `0.03`, capped
at `maxMultiplier`.

Loss penalties were removed; keep the `lossPenalty` field in the breakdown set to
`1` so the UI copy signals the updated rules without additional conditionals.

## Defeat Payout Algorithm
```ts
function calculateDefeatPayout(input: PayoutInputs): PayoutResult {
  const tuning = tierTuning[input.tierId];
  const baseline = tuning.baselinePayout;
  const difficultyMultiplier = resolveDifficultyMultiplier(
    input.difficultyScalar,
    input.rampStageIndex
  );

  const floorPayout = baseline * 0.2 * difficultyMultiplier;
  const tempoProgress = input.runSeconds / (tuning.baselineDurationMinutes * 60);
  const killProgress = input.enemyKills / tuning.baselineKills;
  const progress = clamp01(0.5 * tempoProgress + 0.5 * killProgress);
  const performanceShare = baseline * 0.45 * progress * difficultyMultiplier;
  const lossPenalty = 1;
  const artocoins = Math.round(Math.max(floorPayout, performanceShare));

  return {
    artocoins,
    breakdown: {
      baseline,
      performanceMultiplier: performanceShare / baseline,
      lossPenalty,
      difficultyMultiplier
    }
  };
}
```

Call the defeat branch whenever the run terminates without clearing the final
objective.

## Telemetry & UI Hooks
- Surface the breakdown in the post-run UI so players see tempo / kill /
  exploration influences and difficulty bonuses.
- Log the breakdown to analytics for balancing.
- Store the tier tuning and difficulty tables in a shared config module so both
  the economy calculator and UI share constants.
- Add regression tests covering:
  - Baseline win (should return exactly the baseline payout).
  - Perfect run cap (ensure clamps cap at expected ceilings).
  - Loss breakdown reporting `lossPenalty = 1` for both wins and defeats.
  - Endless Onslaught stage bonus accumulation and cap.
  - Defeat payout floor when progress is minimal.

## Open Questions
- If additional sauna tiers ship, extend `ArtocoinTierTuning` with new entries
  and adjust the unlock pacing targets; no formula changes required.
- Should we surface roster loss counts elsewhere in the UI now that payouts no
  longer penalize defeats?
