# Changelog

## Unreleased
- Resolve Saunoja icon path against the configured Vite base URL so attendants
  render correctly when the game is served from a subdirectory
- Convert canvas clicks to world-space selection toggles that persist Saunoja
  highlights, clear selection on empty hexes, and redraw the scene only when the
  active Saunoja set changes
- Persist Saunoja attendants across sessions via localStorage, spawn an initial
  guide when none exist, and pipe their selection-aware rendering through the
  main canvas renderer
- Render Saunoja units with a dedicated canvas helper that preloads the SVG
  icon, applies warm tint and highlight overlays, and layers steam and HP bars
  within clipped hex silhouettes
- Introduce Saunoja data helpers, sauna combat damage utilities, and polished
  canvas rendering helpers for HP, selection, and steam effects
- Add a polished monochrome Saunoja unit icon to `public/assets/units`
- Export shared hex rendering helpers (radius constant, `axialToPixel`, and
  a flat-topped `pathHex` canvas utility) via `src/hex/index.ts`
- Auto-initialize the game entry point outside of Vitest by invoking `init()`
  on module load so the map and resource bar render immediately
- Add a dedicated build step that emits `main.js` and `assets/game.css` at the
  repository root, refresh production HTML references, and clean up legacy
  hashed bundle artifacts
- Render hex tiles using a palette-driven gradient fill, cached SVG terrain icons,
  and highlight styling shared with the `.tile-highlight` class
- Introduce a glassmorphism-inspired HUD styling system with shared color tokens,
  tooltip affordances, and tile highlight treatments
- Establish a `main.ts` rendering entry point that drives canvas resizing,
  camera transforms, mouse wheel zoom, and touch gestures exposed via `index.html`
- Replace the root HTML shell with the new HUD layout, dedicated stylesheet, and SVG-powered icons
- Add high-contrast tile and UI SVG icon sets, integrate them into the top bar/resource display, and register the new asset paths in the loader
- Regenerate production bundle and update `index.html` to reference the latest hashed assets
- Safeguard unit rendering by bracketing canvas state changes with `save()`/`restore()`
- Move hex map rendering into a dedicated `HexMapRenderer` to separate presentation from tile management
- Share hex dimension calculations through a reusable helper used by map and unit rendering
- Refactor game initialization and rendering helpers into dedicated `ui` and `render` modules
- Include `404.html` in `docs/` and refresh build output
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
- Switch deployment workflow to Node.js 18

