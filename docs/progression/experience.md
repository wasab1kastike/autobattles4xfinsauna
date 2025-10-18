# Experience & Level Progression Plan

## Goals for a 10–15 Minute Run
- Deliver a feeling of steady hero growth every ~60–90 seconds while keeping the run under 15 minutes.
- Ensure wave victories, elite takedowns, and map objectives all matter for leveling so players pursue multiple goals.
- Cap core progression at level 12, giving room for post-run meta rewards without overwhelming the UI mid-match.

A typical successful run should accrue **5,500–5,800 XP**, hitting level 12 around minute 12 with a comfortable buffer to finish any late-map objectives by minute 15.

## XP Sources
| Source | Frequency | XP | Notes |
| --- | --- | --- | --- |
| Standard enemy defeat | ~15 per minute | 6 XP | Calibrated so trash waves alone push ~540 XP over 10 minutes.
| Elite enemy defeat | 1–2 per wave starting wave 3 | 40 XP | Distinct audio/FX callouts reinforce the reward.
| Boss defeat | Once at wave 6 and wave 9 | 250 XP | Unlocks a mid-run reward choice and late-run stat infusion.
| Wave clear bonus | Every 90 seconds | 150 → 300 XP | Scales +30 XP per wave to celebrate pacing spikes.
| Objective completion (sauna tune-up, relic find, etc.) | 3 per run | 200 XP | Designed to pull players off the critical path briefly.
| Perfect wave (no structure damage) | Optional | 60 XP | Adds mastery for defensive play.

The mix yields ~300 XP/minute from combat, another 150–200 XP/minute from wave and objective bonuses, and situational bursts from bosses.

## Level Curve
The curve targets a smooth start, a motivating mid-run ramp, and a decisive finish without grind. XP to reach each level is cumulative.

| Level | XP to Next | Cumulative XP | Key Beat |
| --- | --- | --- | --- |
| 1 | 180 | 0 | Baseline kit.
| 2 | 220 | 180 | Introduce passive trait picker.
| 3 | 260 | 400 | Unlock minor sauna buff slot.
| 4 | 320 | 660 | First talent reroll.
| 5 | 380 | 980 | Equip slot upgrade cinematic.
| 6 | 460 | 1,360 | Mid-run toast + elite callout.
| 7 | 540 | 1,820 | Second sauna slot, announce late-wave elites.
| 8 | 640 | 2,360 | Stat spike preview bar animation.
| 9 | 760 | 3,000 | Boss intro overlay.
| 10 | 900 | 3,760 | Ultimate ability refresher.
| 11 | 1,060 | 4,660 | Final talent roll + audio sting.
| 12 | — | 5,720 | End-run mastery banner.

Players who fall slightly behind can recover with objectives or perfect waves; overachievers simply hit the stat cap earlier without breaking the run length.

## Stat Awards
Every level-up grants focused stat packages aligned with pacing beats. Totals sum to a roughly 55% power delta across the run.

| Level | Vigor (HP) | Focus (Ability Power) | Resolve (Defense) | Highlight |
| --- | --- | --- | --- | --- |
| 2 | +5 | +2 | +1 | Tooltip glow on HP bar.
| 3 | +4 | +3 | +1 | Ability cards pulse.
| 4 | +4 | +2 | +2 | Shield shimmer.
| 5 | +6 | +3 | +2 | Sauna animation.
| 6 | +7 | +3 | +3 | Elite defeat burst.
| 7 | +6 | +4 | +3 | Wave banner upgrade.
| 8 | +7 | +4 | +4 | Progress bar crest.
| 9 | +8 | +5 | +4 | Boss preview spotlight.
| 10 | +9 | +6 | +5 | Full-screen vignette.
| 11 | +10 | +6 | +6 | Audio choir swell.
| 12 | +12 | +7 | +6 | Mastery banner and stat summary.

## Saunoja Promotions
- Reaching level 12 unlocks a roster promotion that costs **150 Saunakunnia** and lets commanders specialize a Saunoja as a **Tank**, **Rogue**, **Wizard**, or **Speedster**.
- Promotions reset the attendant's XP to level 1, roll back cumulative stat awards, and then immediately reapply policy modifiers so the baseline feels familiar while opening new class perks.
- Battlefield units linked to the promoted Saunoja inherit the reset XP, keeping combat HUD readouts consistent without manual resyncs.

## UI & Feedback Beats
1. **Persistent XP Ribbon** – A high-contrast ribbon beneath the wave timer pulses as XP arrives. Chunked ticks (20 XP) ensure clarity during peak combat.
2. **Level-Up Overlay** – A 1.2-second freeze-frame with particle burst, presenting stat awards and the next unlock. Player regains control after dismissing or auto-timeout.
3. **Progress Forecast Tooltip** – Hovering the ribbon shows projected time to next level based on last 60 seconds of XP gain.
4. **Boss & Objective Callouts** – Boss defeat and objective completion re-use the level-up layout but in gold/teal palettes, reinforcing high-value XP events.
5. **End-Run Mastery Banner** – Upon reaching level 12 (or run end), a banner summarizes total XP sources, encouraging replay mastery.

These beats should be implemented with polished shaders, responsive sound design, and accessibility-compliant contrast ratios to satisfy our visual quality bar.
