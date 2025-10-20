# Changelog

## Unreleased

### Major Changes
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
- Corrected roster panel visibility events so HUD listeners receive the actual open state and added coverage ensuring the roster display initializes expanded when the view is already active.
- Integrated the persistence-aware stronghold spawner into the main game loop so dormant fortresses awaken on schedule, preserved cooldown progress across reloads, and validated the flow with long-horizon integration tests.
- Recorded stronghold deployment state and spawn cooldown in saves, restoring timers for new sessions while preserving legacy compatibility through dedicated serialization tests.
- Routed enemy pressure scaling through surviving strongholds so cadence slows once bastions fall, surges while multiple forts endure, and remains protected by renewed integration coverage.
- Added focused enemy spawner pressure tests that exercise cadence and spawn strength calculations under varying stronghold counts and confirm the multiplier resets once bastions collapse.
