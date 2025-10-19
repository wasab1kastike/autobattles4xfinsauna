# Changelog

## Unreleased

- Promote wizards with the Arcane Nova specialization, delivering a 10%
  damage boost and 40% splash damage within a two-hex radius, with persistence
  across save/load, HUD copy, and new combat tests.

- Empower promoted tanks with a 50% damage-taken multiplier, battlefield taunt
  aura, polished HUD/tooltips, and accompanying combat/AI tests to ensure the
  mitigation persists through save/load cycles.

- Introduce rogue ambush perks that grant a 25% damage bonus, a pre-attack
  teleport toward nearby enemies, and a one-time first-strike burst backed by
  new combat and scenario tests.

- Refresh HUD navigation coverage so the Policies button drives the new
  dedicated sheet, add targeted specs for `setupPoliciesWindow`, and update the
  GitHub Pages guidance to highlight the relocated console experience.

- Fix NG+ carryover persistence so only the chosen loadout gear survives resets,
  clear any stale equipment from roster storage, and extend coverage to ensure
  the three-item storage cap remains enforced after a run restart.

- Let commanders secure up to three carryover items from squad loadouts or the
  shared stash via the end-of-run overlay, trimming the rest before the next
  NG+ reload and covering the inventory cap with automated tests.

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
