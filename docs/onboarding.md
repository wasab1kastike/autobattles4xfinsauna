# Onboarding Experience

The onboarding flow introduces the core HUD rhythms for new leaders through a guided tutorial. It automatically launches on fresh saves unless the local `tutorial_done` flag is set in `localStorage`.

## Flow overview

| Step | Anchor | Purpose |
| --- | --- | --- |
| Heat | `data-tutorial-target="heat"` on the sauna control | Highlights the sauna heat controls so players understand how reinforcements arrive. |
| Upkeep | `data-tutorial-target="upkeep"` on the roster HUD | Emphasises upkeep pressure and introduces the featured attendant card. |
| SISU | `data-tutorial-target="sisu"` on the SISU meter | Shows how grit accumulates and fuels abilities. |
| Combat | `data-tutorial-target="combat"` on the action tray | Demonstrates the burst and rally buttons that shape battles. |
| Victory | `data-tutorial-target="victory"` on the Saunakunnia badge | Frames long-term success through renown tracking. |

Each tooltip card is fully keyboard navigable (`←`, `→`, `Esc`, or the on-screen controls) and can be dismissed at any time.

## Skip and reset

Selecting **Skip tutorial** or finishing the final step marks the `tutorial_done` flag via `setTutorialDone(true)`, preventing future runs. Developers can call `resetTutorialProgress()` in the browser console (or clear local storage) to replay the sequence.

## Visual polish

The tooltip overlay uses blurred glass cards, accent lighting around anchors, and responsive positioning to maintain a premium presentation on both desktop and handheld layouts.
