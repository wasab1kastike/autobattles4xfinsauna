# Contributing

Thank you for considering a contribution! Autobattles4xFinsauna ships a highly
visual build to a custom GitHub Pages domain, so small documentation details are
important for keeping the live experience in sync with the repository.

## Before you start

- Keep the README in parity with the current build. In particular, the "Live
  Build" section must include the canonical link to
  `https://artobest.com/?utm_source=chatgpt.com` so the automated `check:demo`
  script can verify the deployment. The CI pipeline now runs this guard after
  the production build, so broken URLs or titles will fail pull requests.
- Keep the `docs/` mirror aligned with the working tree. The `verify:docs`
  script inspects `docs/assets/index-*.js` for the embedded commit hash and
  fails fast if it doesn't match `git rev-parse --short HEAD`. The CI workflow
  now runs `npm test` immediately after the production build, so this guard
  executes on every push or pull request. Re-run `npm run build` and mirror the
  fresh `dist/` output into `docs/` whenever the guard reports stale assets.
- Preserve the custom domain configuration. `public/CNAME` (and the mirrored
  `docs/CNAME` for historic deployments) should continue to reference
  `artobest.com` unless the production URL officially changes.
- Record notable changes in [CHANGELOG.md](CHANGELOG.md) and add any UI-facing
  updates to the README feature summary.

## Validation checklist

Run the full workflow locally before pushing:

1. `npm test`
2. `npm run build`
3. `npm run check:demo`
4. `npm run simulate`

`npm test` now also runs `npm run verify:docs`, so local commits surface stale
`docs/` assets the same way the CI pipeline does. If the guard fails, run
`npm run build` and commit the refreshed mirror alongside your changes.

The test script already runs the live demo availability check; the dedicated
`check:demo` command is listed separately so you can mirror the post-build CI
gate when triaging demo link issues or re-running the check after network
failures. The balance sweep documents `/tmp/balance.csv` with deterministic
20-seed battle samples so regressions in upkeep or deaths remain easy to
compare over time.

## Opening a pull request

Once the checks pass, open a pull request summarizing the change and linking to
any relevant documentation or screenshots that showcase polished HUD updates.
