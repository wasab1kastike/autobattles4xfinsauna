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

The test script already runs the live demo availability check; the dedicated
`check:demo` command is listed separately so you can mirror the post-build CI
gate when triaging demo link issues or re-running the check after network
failures.

## Opening a pull request

Once the checks pass, open a pull request summarizing the change and linking to
any relevant documentation or screenshots that showcase polished HUD updates.
