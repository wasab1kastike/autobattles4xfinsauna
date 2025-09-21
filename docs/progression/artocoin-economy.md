# Artocoin Payout Targets

Premium rewards for sauna defense runs now flow through a single, data-backed
artocoin target. The formula below turns run duration, enemy eliminations,
exploration, and difficulty into a payout that feels generous on a clean win
while keeping unlock pacing near two to three runs per sauna tier.

## Baseline Win Expectations

| Active Sauna Tier | Next Unlock Target | Unlock Cost (Artocoins) | Baseline Run Duration (min) | Baseline Enemy Kills | Baseline Tiles Explored | Baseline Roster Losses | Baseline Payout (Artocoins) | Runs to Unlock (Avg) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ember Circuit | Aurora Ward key engraving | 150 | 12.5 | 150 | 85 | 1 | 60 | 2.5 |
| Aurora Ward | Mythic Conclave rite | 210 | 12.0 | 190 | 100 | 1 | 84 | 2.5 |
| Mythic Conclave | Prestige cache rotation | 275 | 11.5 | 230 | 115 | 1 | 110 | 2.5 |

The baselines establish the "average win" reference used in the payout formula.
Players who exceed the targets accelerate their unlock cadence, while slower or
costly victories still award enough artocoins to feel forward momentum.

## Step-by-Step Payout Formula

1. **Resolve the base payout for the active tier.** Pull the `baselinePayout`
   from the table above for the player's current sauna tier. (`60`, `84`, or
   `110` artocoins.)
2. **Normalize the inputs.** With run duration reported in seconds:
   - `tempoTargetMinutes` is the tier baseline duration.
   - `tempoFactor = clamp(0.75, 1.20, 1 + ((tempoTargetMinutes - runSeconds / 60) / tempoTargetMinutes) * 0.35)`
   - `killFactor = clamp(0.60, 1.45, enemyKills / tierKillBaseline)`
   - `exploreFactor = clamp(0.70, 1.25, tilesExplored / tierTileBaseline)`
3. **Blend the performance multipliers.**
   - `performanceMultiplier = tempoFactor * 0.30 + killFactor * 0.45 + exploreFactor * 0.25`
4. **Combine the pieces.**
   - `rawPayout = baselinePayout * performanceMultiplier`
5. **Apply the difficulty modifier (see below) and round.**
   - `finalPayout = round(rawPayout * difficultyModifier)` (standard banker's rounding to the nearest whole artocoin.)

Loss penalties have been removed. The post-run breakdown continues to surface
`lossPenalty = 1` to make the change explicit in the UI.

The clamps keep extreme values from running away while still celebrating high
execution. A perfect, fast Mythic Conclave clear tops out near ~160 artocoins,
while a scrappy Ember Circuit hold that lost two attendants still clears ~40.

## Difficulty Modifiers

Difficulty speaks to the same scalar used by the enemy ramp. Mirror that value
inside the payout pipeline using the following table.

| Difficulty Label | Internal Difficulty Scalar | Artocoin Multiplier | Notes |
| --- | --- | --- | --- |
| Relaxed Heat | 0.85 | 0.85× | Training mode pacing with reduced rewards. |
| Standard Steam | 1.0 | 1.00× | Baseline balance reference. |
| Veteran Sauna | 1.2 | 1.18× | Mirrors the +18% enemy multiplier curve. |
| Mythic Heat | 1.4 | 1.32× | Aligns with late-game siege pressure. |
| Endless Onslaught | ≥1.6 | 1.42× + 0.03× per full ramp stage cleared past Maelstrom (cap 1.58×). |

Difficulty multipliers always apply after performance calculations to keep
rewards proportional to the heightened risk.

## Failure Payouts

Defeat runs still deliver progress while reflecting performance:

1. Compute the tier base payout and difficulty multiplier as with a win.
2. Establish a **floor payout** equal to `baselinePayout * 0.20 * difficultyModifier`.
3. Build a **progress ratio**: `progress = clamp01(0.5 * (runSeconds / (tempoTargetMinutes * 60)) + 0.5 * (enemyKills / tierKillBaseline))`.
4. Calculate the **performance share**: `performanceShare = baselinePayout * 0.45 * progress * difficultyModifier`.
5. Final defeat payout is `round(max(floorPayout, performanceShare))`.

The result is that an early wipe still awards roughly 15–20% of a clear, while a
boss defeat with solid stats might pay out 45–55% despite the loss. Loss
penalties no longer reduce the payout, keeping the focus on tempo and combat
progress.

## Steamforge Atelier

Artocoins now flow into the Steamforge Atelier—an in-run shop pinned beside the
inventory stash. Each tier upgrade advertises its commission cost and unlocks
instantly once purchased, letting players convert a streak of victories into new
roster capacity without chasing legacy NG+ milestones. The top bar exposes the
treasury through a dedicated artocoin badge that mirrors the resource animation
language (delta ticks, accessible announcements) used for beer, sisu, and
saunakunnia.

Run summaries close with an "Artocoin ledger" panel that breaks down how many
coins were earned, spent, and banked during the session. The ledger uses the
same gradient styling and positive/negative color cues as the badge so players
can reconcile their purchases at a glance before diving back into a fresh run.

## Worked Examples

- **Average Ember Circuit win** – 12.6 minute run, 152 kills, 86 tiles, one
  roster loss on Standard Steam: `tempoFactor ≈ 0.99`, `killFactor ≈ 1.01`,
  `exploreFactor ≈ 1.01`, `performanceMultiplier ≈ 1.00`, `lossPenalty = 1.00`,
  payout `≈ 60 artocoins`.
- **Fast Mythic Conclave win** – 10.8 minute run, 250 kills, 128 tiles, zero
  losses on Mythic Heat: `tempoFactor ≈ 1.06`, `killFactor ≈ 1.09`,
  `exploreFactor ≈ 1.11`, `performanceMultiplier ≈ 1.08`, `lossPenalty = 1.00`,
  payout `≈ 110 * 1.08 * 1.32 ≈ 157 artocoins`.
- **Aurora Ward defeat** – 9.5 minute wipe before the boss, 140 kills, 72 tiles,
  two losses on Veteran Sauna: floor `≈ 20`, progress `≈ 0.76`, performance
  share `≈ 34`, `lossPenalty = 1.00`, payout `≈ 34 artocoins`.

These targets keep meta progression brisk without trivialising high-heat clears
or punishing experimentation.
