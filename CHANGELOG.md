# Changelog

## Unreleased

### Major Changes
- Force a fresh December 2024 save reset keyed off `autobattles:storage-reset:v2024-12-fresh-start` so corrupted slots clear once on load while rosters, NG+ progress, inventories, shops, and unlocks rebuild on a stable foundation.
- Empowered Glacial Rhythm and Celestial Reserve with tri-hex sauna healing auras, updating lifecycle logic, UI copy, and tests to surface the 1.5 HP/s passive restoration.
- Extended sauna tiers through the Celestial Reserve, standardizing vision radius, spawn multipliers, and NG+ unlock behavior across every hall.
- Empowered rogues with a permanent attack boost, an ambush teleport, and a first-strike damage surge covered by new combat and scenario tests.
- Launched the Hypersteam Levy Ultimatum prestige doctrine, doubling Sauna Beer production while escalating enemy aggression, cadence, and strength.
- Introduced the Glacial Gambit precision doctrine with extended range, stacked hit bonuses, brittle defensive penalties, and refreshed combat coverage.
- Deployed the Steam Debt Protocol economic edict, delivering a toggleable bond surge with accompanying documentation and regression protection.
- Reforged enemy stronghold pacing so fresh bastions surface every three minutes and pour extra reinforcements onto the map until commanders dismantle them.
- Rebuilt the policies console as a dedicated responsive HUD sheet, refreshed navigation to surface roster/events controls, and restored polished promotion choosers.
- Preserved NG+ carryover loadouts through a refined end-of-run overlay that trims unselected gear, persists survivors, and locks in inventory regression coverage.
- Restructured the runtime shell so the game canvas and HUD mount in dedicated containers, aligning the GitHub Pages bundle and bootstrap behavior.

### Minor Changes
main
- Guarded end-of-run persistence while a reload is in progress so New Game+ sessions respawn with fresh sauna beer reserves instead of carrying prior debt forward.
- Elevated the quartermaster inventory and atelier shop toggles above the combat action tray so the command console presents
  stash and upgrade controls before the ability bar.
- Nested the combat action bar beneath the roster and policy navigation so the command tray follows the primary HUD buttons.
- Optimized the enemy spawner to reuse a single living-enemy count per tick, tightened slot tracking, and extended tests to
  lock in the new counting behavior.
- Elevated the combat action bar into the top HUD tray, refreshing layout anchors, styling, and UI tests to match the new
  glassmorphic mount.
- Repositioned the combat action bar into a bottom-left command dock, refreshing HUD anchors, luxe gradients, and regression
  coverage so the tray hugs the lower viewport edge across devices.
- Integrated the persistence-aware stronghold spawner into the main game loop so dormant fortresses awaken on schedule, preserved cooldown progress across reloads, and validated the flow with long-horizon integration tests.
- Recorded stronghold deployment state and spawn cooldown in saves, restoring timers for new sessions while preserving legacy compatibility through dedicated serialization tests.
- Routed enemy pressure scaling through surviving strongholds so cadence slows once bastions fall, surges while multiple forts endure, and remains protected by renewed integration coverage.
- Added focused enemy spawner pressure tests that exercise cadence and spawn strength calculations under varying stronghold counts and confirm the multiplier resets once bastions collapse.
- Polished the roster identity layout so hero names and class badges wrap elegantly on small screens, tightening flex safeguards to prevent horizontal overflow in the HUD.
- Amplified boss encounters with larger battlefield sprites and a radiant ground aura so they immediately stand out during clashes.
- Aligned the onboarding tutorial documentation with the live HUD anchors, policy copy, and pause handling so the GitHub Pages mirror reflects the current guided experience.
