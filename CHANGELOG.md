# Changelog

## Unreleased
- Set Vite `base` to `/autobattles4xfinsauna/` and regenerate `docs/` build output
- Set Vite `base` to `/` for root-based asset paths
- Regenerate docs with latest build output and hashed assets
- Import sprite URLs directly and drop `asset()` helper
- Include custom 404 page for GitHub Pages
- Fail Pages build when bare `assets/` URLs are detected in `dist/index.html`
- Use relative asset paths in root index and rebuild bundles
- Set Vite `base` to `./` and rebuild docs with relative asset paths
- Provide noscript fallback linking to documentation when JavaScript is disabled
- Serve game directly from repository root and drop `docs/` redirect
- Refresh documentation with latest build output
- Clear corrupted game state from localStorage and warn when load fails
- Load game state via `safeLoadJSON` and ignore unknown building types
- Filter out invalid building types when restoring building counts
- Rebuild docs with relative asset paths so GitHub Pages loads CSS and JS correctly
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
- Redirect project root to `docs/` so GitHub Pages serves the game
- Improve mobile scaling by resizing canvas to viewport and device pixel ratio
- Improve high-DPI rendering by scaling canvas to `devicePixelRatio`
- Add responsive layout and media queries for mobile UI components
- Add `getMaxHealth` method to `Unit` and use it in game rendering
- Gracefully fall back when Web Audio API is unavailable and resume audio on first interaction
- Display a styled error overlay when asset loading fails
- Defer game initialization until DOMContentLoaded via exported `init()`
- Add workflow to deploy docs from `dist/` on pushes to `main`

