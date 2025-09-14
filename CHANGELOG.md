# Changelog

## Unreleased
- Set HTML title to Autobattles4xFinsauna
- Add `.nojekyll` to bypass Jekyll on GitHub Pages
- Resolve sprite paths using `import.meta.env.BASE_URL` so builds work from repository subdirectory
- Restore `.nojekyll` automatically after production builds
- Build outputs to `dist/` and workflow publishes to `docs/`
- Add workflow to build and publish `docs/` on pushes to `main`
- Set explicit Vite base path for GitHub Pages
- Fix Vite base path to always `/autobattles4xfinsauna/`
- Add `verify-pages` CI workflow to validate Pages builds
- Publish `dist/` to `docs/` only after verification succeeds
- Remove legacy Pages deployment workflow
