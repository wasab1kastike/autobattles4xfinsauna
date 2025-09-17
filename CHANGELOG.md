# Changelog

## Unreleased
- Guarantee the battlefield opens with a steadfast sauna guard by auto-spawning a
  player soldier when no active attendants remain, preventing targetless combat
- Channel sauna heat into rallying allied soldiers, surface player-facing spawn
  thresholds, and reuse the HUD countdown for the friendly reinforcements
- Retitle the Saunakunnia badge and narration copy to drop the honor suffix while
  keeping accessibility labels polished and concise
- Shorten the Saunakunnia policy cost label so the right panel references the
  prestige track without the redundant "Honors" suffix
- Ship the Saunoja roster crest within `docs/assets/ui/` so the published site
  serves the polished icon bundle without 404 regressions
- Detect restored save files before granting starting resource windfalls so reloads resume progress without duplicate rewards
- Mirror the Saunoja roster crest into `public/assets/ui/` so the HUD loads the
  polished icon without 404 warnings
- Regenerate the GitHub Pages bundle so Steam Diplomats boost sauna beer
  generation instead of slipping passive Saunakunnia into the hosted build
- Extend Saunoja attendants with trait, upkeep, and experience tracking while
  normalizing stored data and persisting the new fields across sessions
- Replace the Saunoja roster badge with a dedicated warrior crest and preload
  the SVG so the HUD reflects the new insignia instantly
- Redirect policy investments to Saunakunnia honors, refresh Steam Diplomat
  rewards, and remove passive Saunakunnia trickles so prestige is only earned
  through deliberate play
- Sync stored Saunoja roster coordinates with live friendly unit movement so HUD
  overlays track attendants as they reposition across the battlefield
- Retire the sauna aura's passive Saunakunnia trickle so idling near the steam no
  longer grants honor automatically
- Replace the sauna spawn timer with heat-driven thresholds that escalate after
  each Avanto Marauder emerges from the steam
- Regenerate the production asset mirrors with the sauna beer build so hashed
  bundles, HUD styling, and SVG art reference the updated resource palette
- Ensure sauna-spawned Avanto Marauders join the enemy faction so they march on
  player attendants without hesitation
- Rebrand the Raider unit into the Avanto Marauder with refreshed stats exports,
  spawn identifiers, sauna simulation logs, and sprite mappings
- Deploy Avanto Marauders from the enemy sauna so they leave the spa and
  challenge the player's attendants
- Hide inactive right-panel sections by honoring the `[hidden]` attribute so
  tab switches only render the active pane
- Polish sauna beer HUD terminology with bottle provisioning logs, refined badge
  narration, and updated policy copy
- Rebuild the HUD roster widget with a Saunoja battalion counter, live unit
  lifecycle updates, refreshed sauna styling, and updated tests
- Rebrand the HUD gold economy into sauna beer with new resource enums,
  UI strings, polished bottle iconography, and refreshed tests
- Focus the event log on sauna-flavored narratives by muting resource gain spam,
  echoing right-panel events, and celebrating unit arrivals and farewells
- Replace every terrain, building, and unit sprite with high-fidelity SVG art
  tailored to the Autobattles4xFinsauna palette and HUD glow treatments
- Drive the BattleManager each fixed tick, funnel spawned player/enemy units
  into the shared roster, and refresh the loop so pathfinding and combat resolve
  automatically during play
- Introduce the Saunakunnia prestige track with dedicated HUD formatting, sauna aura
  and victory generation hooks, policy costs, and refreshed log copy
- Regenerate the GitHub Pages `docs/` mirror from the current production build
  so the custom domain serves the polished SPA entry point and fallback
- Update CI asset verification to expect root-relative `/assets/` URLs and confirm hashed bundles exist before publishing
- Paint a pulsing sauna aura overlay with a countdown badge and seat the sauna
  controls beneath the left HUD actions for aligned interaction
- Normalize icon loader paths against `import.meta.env.BASE_URL` so nested
  deployments fetch HUD imagery without 404s
- Layer polished stroke patterns onto every terrain hex and dim fog-of-war tiles
  to 40% opacity for clearer, more atmospheric map readability
- Wait for the DOM to finish parsing before bootstrapping the canvas so the
  artobest.com deployment reliably mounts the game shell on every visit
- Mount the sauna toggle and dropdown directly to the polished top bar so the
  controls align with other HUD actions
- Refresh README and contributor documentation to describe the current HUD
  feature set and reiterate the artobest.com GitHub Pages deployment
- Update the custom domain configuration and documentation to serve the live
  build from https://artobest.com/ after the DNS cutover
- Confirm Vite's root-level base path configuration and regenerate the
  production build to deliver `/assets/`-prefixed bundles for the GitHub Pages
  workflow
- Point the documented live demo links and npm `homepage` metadata to
  https://artobest.com/ so references match the production site
- Relocate `CNAME` from `docs/` to `public/` so production builds retain the
  custom domain via Vite's static asset pipeline
- Set Vite `base` to `/` so production builds resolve polished assets from the
  site root without relying on a subdirectory deployment
- Recompose the HUD layout so the build menu and sauna controls live beside a
  fixed-width right panel, eliminating overlap and polishing the top-row
  alignment
- Add development-only Saunoja diagnostics that confirm storage seeding and log
  restored attendant coordinates after loading
- Simplify GitHub Pages deployment by publishing the raw `dist/` output with the
  official Pages actions, removing the repository-managed `docs/` mirror, and
  introducing a polished SPA-friendly 404 fallback in `public/404.html`
- Resolve the current git commit via `git rev-parse --short HEAD`, expose it as
  a shared `__COMMIT__` define, and use it for build-aware tooling and tests
- Refresh the HUD build badge with a glowing commit chip that surfaces the
  resolved hash (or a dev indicator) alongside improved accessibility metadata
- Regenerate GitHub Pages artifacts by running the latest production build,
  syncing hashed bundles into `docs/`, duplicating the SPA fallback, and
  reaffirming the `.nojekyll` guard file
- Introduce a unified resource bootstrapper that surfaces a polished HUD loader,
  aggregates asset warnings, and presents graceful recovery banners when
  initialization fails
- Copy production build output to `docs/` via an `npm postbuild` script that
  mirrors GitHub Pages fallbacks using standard shell utilities
- Stretch the canvas container to the full viewport, adopt dynamic viewport
  sizing, disable default touch gestures, and enforce 44px minimum hit targets
  for buttons and shared `.btn` styles
- Extend the viewport meta tag for full-bleed mobile layouts and surface the
  short git commit hash in a polished HUD footer
- Copy `docs/index.html` to `docs/404.html` during the build step and remove the
  legacy root-level `404.html`
- Sync GitHub Pages output directly from `dist/`, generating a SPA-friendly
  `404.html` and removing legacy root-level bundles
- Treat the live demo availability check as a warning when outbound network
  access is blocked so offline CI runs can succeed
- Track Saunoja damage timestamps and render a clipped radial hit flash when a
  unit is struck for more immediate feedback
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

