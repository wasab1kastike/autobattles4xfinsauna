# Onboarding Experience

The onboarding flow introduces the polished HUD rhythms for new leaders through a guided tutorial. It automatically launches on fresh saves unless the local `tutorial_done` flag is set in `localStorage`.

## Flow overview

| Step | Anchor | Purpose |
| --- | --- | --- |
| Heat the Sauna | `data-tutorial-target="heat"` on the sauna control | Keep the sauna fires roaring. This control shows when the next warrior emerges from the steam. |
| Mind Your Upkeep | `data-tutorial-target="upkeep"` on the roster HUD | Every attendant draws upkeep. Track totals and see a featured roster member to balance your economy. |
| Stockpile SISU | `data-tutorial-target="sisu"` on the SISU meter | SISU fuels heroic bursts. Watch this meter to know when your grit reserves can power signature moves. |
| Command the Fight | `data-tutorial-target="combat"` on the action tray | Trigger a Sisu Burst to supercharge allied attacks or rally everyone home with a Torille call. |
| Claim Victory | `data-tutorial-target="victory"` on the Saunakunnia badge | Saunakunnia measures renown. Push it ever higher to unlock triumphs and close the campaign in glory. |

Each tooltip card is fully keyboard navigable (`←`, `→`, `Esc`, or the on-screen controls) and can be dismissed at any time.

The refreshed sauna HUD now anchors the opening step with the Sauna Integrity meter and animated progress bar introduced in `src/ui/sauna.tsx`. The Premium Tiers grid showcased later in the tutorial reinforces how leaders unlock expanded roster capacity, while updated SISU and combat cues echo their in-game meters and rally buttons.

## Skip and reset

Selecting **Skip tutorial** or finishing the final step marks the `tutorial_done` flag via `setTutorialDone(true)`, preventing future runs. Developers can call `resetTutorialProgress()` in the browser console (or clear local storage) to replay the sequence.

## Visual polish

The tooltip overlay uses blurred glass cards, accent lighting around anchors, and responsive positioning to maintain a premium presentation on both desktop and handheld layouts. Those cards mirror the sauna HUD styling, complete with badge-forward Premium Tier options, realtime progress labels, and the destruction FX woven into the Sauna Integrity meter.
