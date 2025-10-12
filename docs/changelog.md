# Release log

## 1.0.1 · 2025-10-12

- Restored the published Vite bundle after a Git LFS pointer leak replaced the toolchain files on `main`.
- Rebuilt the package manifest and Tailwind tokens so the dashboard styling and metadata badge render correctly on GitHub Pages.
- Documented the npm scripts required to lint, test, and publish the site before pushing to `docs/`.

## 1.0.0 · 2025-10-12

- Recovered the playable build following the LFS clean-up and restored a complete Vite + React toolchain.
- Added deterministic combat simulation with autoplay controls, telemetry, and live combat logging.
- Injected semantic version and commit metadata into the UI so QA can confirm the running build at a glance.
- Refreshed the visual design using a neon-glass aesthetic aligned with the brand art direction.
- Documented the GitHub Pages publishing workflow.
