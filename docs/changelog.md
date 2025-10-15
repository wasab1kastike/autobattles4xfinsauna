# Changelog

## Unreleased

- Guard stronghold encounter unit registration so early seeding no longer
  triggers the "Game runtime has not been configured" crash, letting the GitHub
  Pages build render again after deployment.

- Inject the active git commit into production builds so the published site and
  runtime freshness checks surface the exact deployed hash.

- Launch the Steam Debt Protocol economic edict, blending deluxe passive Sauna
  Beer bonds with reversible enemy aggression and cadence spikes plus a mild
  upkeep surge while the toggle is active.

- Rally enemy reinforcements from surviving strongholds, spawning squads on or
  adjacent to active bastions before falling back to edge entries, and cover the
  new routing with integration tests.

- Cloak newly seeded enemy strongholds in fog unless prior saves revealed them,
  keeping fresh campaigns mysterious and covering the regression with
  progression tests.

- Pin the Vite `base` configuration to `'/'` so GitHub Pages custom domains
  always serve root-relative assets without extra environment overrides.

- Restore the GitHub Pages deployment workflow so it installs, fetches, and
  checks out Git LFS assets before building, guaranteeing CI publishes complete
  game resources.
