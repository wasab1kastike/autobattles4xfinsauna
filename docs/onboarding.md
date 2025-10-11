# Onboarding Experience

The onboarding flow introduces the polished HUD rhythms for new leaders through a guided tutorial. It automatically launches on fresh saves unless the local `tutorial_done` flag is set in `localStorage`.

## Flow overview

| Step | Anchor | Purpose |
| --- | --- | --- |
| Heat the Sauna | `data-tutorial-target="heat"` on the sauna control | Keep the sauna fires roaring. This control shows when the next warrior emerges from the steam. |
| Mind Your Upkeep | `data-tutorial-target="upkeep"` on the roster HUD | Every attendant draws upkeep. Track totals and see a featured roster member to balance your economy. |
| Stockpile SISU | `data-tutorial-target="sisu"` on the SISU meter | SISU fuels heroic bursts. Watch this meter to know when your grit reserves can power signature moves. |
| Read the Enemy Ramp | `data-tutorial-target="enemy-ramp"` on the top-bar badge | The badge shows current stage markers, multiplier spikes, and calm windows before the next enemy wave. |
| Command the Fight | `data-tutorial-target="combat"` on the action tray | Trigger a Sisu Burst to supercharge allied attacks or rally everyone home with a Torille call. |
| Claim Victory | `data-tutorial-target="victory"` on the Saunakunnia badge | Destroy every enemy stronghold to win the campaign. The badge tracks your march toward total conquest. |
| Avert Defeat | `data-tutorial-target="sauna-integrity"` on the Sauna Integrity meter | Defeat strikes if the sauna is razed, every attendant is downed for 8 seconds, or upkeep bankruptcy lingers for 12 seconds. Guard the meter and steady your roster. |

Each tooltip card is fully keyboard navigable (`←`, `→`, `Esc`, or the on-screen controls) and can be dismissed at any time.

With the combat anchor restored on the action tray, the **Command the Fight** spotlight now locks to the tray chrome instead of floating, immersing leaders in the premium rally controls during that beat of the tour.

The refreshed sauna HUD now anchors the opening step with the Sauna Integrity meter and animated progress bar introduced in `src/ui/sauna.tsx`. The Premium Tiers grid showcased later in the tutorial reinforces how leaders unlock expanded roster capacity, while updated SISU and combat cues echo their in-game meters and rally buttons.

Roster access now routes through the command console navigation instead of the retired top-left toggle button, keeping the tutorial steps aligned with the streamlined control surface leaders use in live runs. A dedicated close button now lives inside the roster view so desktop and mobile leaders can collapse the console without hunting for the dock toggle.

## Skip and reset

Selecting **Skip tutorial** or finishing the final step marks the `tutorial_done` flag via `setTutorialDone(true)`, preventing future runs. Developers can call `resetTutorialProgress()` in the browser console (or clear local storage) to replay the sequence.

## Visual polish

The tooltip overlay uses blurred glass cards, accent lighting around anchors, and responsive positioning to maintain a premium presentation on both desktop and handheld layouts. Those cards mirror the sauna HUD styling, complete with badge-forward Premium Tier options, realtime progress labels, and the destruction FX woven into the Sauna Integrity meter.
