# Onboarding Experience

The onboarding flow introduces the polished HUD rhythms for new leaders through a guided tutorial. It automatically launches on fresh saves unless the local `tutorial_done` flag is set in `localStorage`.

## Flow overview

| Step | Anchor | Purpose |
| --- | --- | --- |
| Heat the Sauna | `data-tutorial-target="heat"` on the sauna control | Keep the sauna fires roaring. This control shows when the next warrior emerges from the steam. |
| Mind Your Upkeep | `data-tutorial-target="upkeep"` on the roster HUD | Every attendant draws upkeep. Track totals and see a featured roster member to balance your economy. |
| Stockpile SISU | `data-tutorial-target="sisu"` on the SISU meter | SISU fuels heroic bursts. Watch this meter to know when your grit reserves can power signature moves. |
| Read the Enemy Ramp | `data-tutorial-target="enemy-ramp"` on the top-bar badge | The badge shows the current stage, upcoming multiplier surges, and calm lulls before the next pressure wave. |
| Command the Fight | `data-tutorial-target="combat"` on the action tray | Trigger a Sisu Burst to supercharge allied attacks or rally everyone home with a Torille call. |
| Claim Victory | `data-tutorial-target="victory"` on the Saunakunnia badge | Destroy every enemy stronghold to win the campaign. The Saunakunnia badge tracks your march toward total conquest. |
| Avert Defeat | `data-tutorial-target="sauna-integrity"` on the Sauna Integrity meter | Defeat strikes if the sauna is razed, every attendant is downed for 8 seconds, or upkeep bankruptcy lingers for 12 seconds. Guard the integrity meter and keep your roster on its feet. |

The copy above mirrors the canonical `defaultSteps` payload in
`src/ui/tutorial/Tutorial.tsx`, so any future tweaks only need to land in one
place before we regenerate the docs.

## Runtime behavior

- Launching the tutorial pauses the simulation if it was running. The
  controller keeps the pause engaged until the player finishes or skips the
  tour, then resumes normal flow once `disposeTutorial()` tears down the
  overlay. This matches the guard logic inside `startTutorialIfNeeded()` in
  `src/game.ts` and keeps combat from progressing beneath a tooltip spotlight.
- `setTutorialDone(true)` fires on both **Finish** and **Skip tutorial**, making
  the onboarding strictly one-time unless a developer explicitly calls
  `resetTutorialProgress()` (or clears local storage) to wipe the
  `tutorial_done` flag defined in `src/save/local_flags.ts`.
- A fresh controller validates that at least one step exists before mounting
  the overlay, preventing empty runs from ever toggling the highlight state.

Each tooltip card is fully keyboard navigable (`←`, `→`, `Esc`, or the on-screen controls) and can be dismissed at any time.

## Economic edict callouts

- **Evergreen Eco Mandate** highlights the toggleable +1 passive Sauna Beer brew
  that the upkeep spotlight references, matching the reversible effect in
  `POLICY_EVENTS.APPLIED` and `.REVOKED` handlers.
- **Aurora Temperance Treaty** showcases the 5% night-shift speed bump so leaders
  see how the overnight economy sustains itself once the roster tab is front and
  center.
- **Steam Diplomats Accord** reinforces the +2 Sauna Beer import unlocked by the
  gilded trade routes, setting up the Saunakunnia badge to underline how faster
  stockpiles accelerate victory.
- **Steam Debt Protocol** caps the sequence with a luxe toggle card that spells
  out the reversible +3 Sauna Beer surge, the 12% upkeep premium, and the enemy
  aggression/cadence spike the policy injects when toggled on.

With the combat anchor restored on the action tray, the **Command the Fight** spotlight now locks to the tray chrome instead of floating, immersing leaders in the premium rally controls during that beat of the tour.

The refreshed sauna HUD now anchors the opening step with the Sauna Integrity meter and animated progress bar introduced in `src/ui/sauna.tsx`. The Premium Tiers grid showcased later in the tutorial reinforces how leaders unlock expanded roster capacity **and faster spawn cadence**, while updated SISU and combat cues echo their in-game meters and rally buttons.

## HUD touchpoints

- `src/ui/sauna.tsx` tags both the sauna toggle and the integrity meter with
  `data-tutorial-target` attributes, so the first and final beats of the tour
  hug the glass sauna card and its destruction FX.
- `src/ui/topbar.ts` wires the SISU, Saunakunnia, and enemy ramp badges as
  anchors, surfacing the live stage callouts alongside the artocoin and time
  chips that frame the cadence story introduced in the tutorial copy.
- `src/ui/action-bar/index.tsx` binds the command tray container to the
  `combat` target so the spotlight hugs the premium rally controls instead of
  floating over the board.
- `src/ui/rosterHUD.ts` keeps the upkeep highlight latched to the roster panel
  so the economic briefing travels with the responsive bottom-tab console.

Roster access now routes through the command console navigation instead of the retired top-left toggle button, keeping the tutorial steps aligned with the streamlined control surface leaders use in live runs. A dedicated close button now lives inside the roster view so desktop and mobile leaders can collapse the console without hunting for the dock toggle.

## Skip and reset

Selecting **Skip tutorial** or finishing the final step marks the `tutorial_done` flag via `setTutorialDone(true)`, preventing future runs. Developers can call `resetTutorialProgress()` in the browser console (or clear local storage) to replay the sequence. Because the overlay reuses the in-game pause controls, skipping or completing the tour automatically restores the previous pause state before resuming combat ticks.

## Visual polish

The tooltip overlay uses blurred glass cards, accent lighting around anchors, and responsive positioning to maintain a premium presentation on both desktop and handheld layouts. Those cards mirror the sauna HUD styling, complete with badge-forward Premium Tier options, realtime progress labels, and the destruction FX woven into the Sauna Integrity meter.

The overlay leans on `ResizeObserver`, scroll listeners, and card focus helpers to keep the spotlight perfectly aligned, even when the HUD resizes mid-step. Keyboard support mirrors controller prompts in the UI: `←` and `→` advance the tour, and `Esc` matches the close button.

The onboarding overlay now mirrors the in-game HUD breakpoint at 959px, switching to the mobile console slide-over when viewports dip below that width so the roster and command dock stay fully visible during the tour.
