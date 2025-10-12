# Autobattles for X Finsauna · Build 1.0.0

Welcome to the refreshed launch dashboard. This GitHub Pages entrypoint mirrors the production layout shipped with build
1.0.0.

## Highlights

- Premium hero area with transparent glass panels and responsive layout.
- Real-time telemetry modules for tick tracking, vitality ratios, and victory state.
- Launch checklist instantly confirms rendering capability, timing precision, and battle synchronisation.
- Build metadata badge always reflects the semantic version and the short commit hash baked into the build.

## Keeping this page current

After running `npm run build`, publish the contents of the generated `dist` directory into `docs/`. The Vite build is
self-contained and ready for GitHub Pages hosting. Double-check that no Git LFS pointer stubs are committed—`package.json`,
`package-lock.json`, `index.html`, and `vite.config.ts` must contain real source so Pages can hydrate the SPA.

For additional release notes see [docs/changelog.md](./changelog.md).
