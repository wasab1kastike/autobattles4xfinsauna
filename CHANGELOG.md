# Changelog

## Unreleased

- Polish battlefield unit rendering by cataloguing sprite metadata in
  `src/render/units/sprite_map.ts`, introducing snapped placement helpers and
  zoom utilities, wiring the renderer and Saunoja portraits through them, and
  covering the anchor math with new Vitest suites across zoom levels.
- Introduce a dedicated equipment system that maps item slots and stat
  modifiers through `src/items/`, threads equip/unequip guards into
  `src/game.ts`, refreshes roster storage plus calculations, polishes the
  roster panel UI with per-slot controls, and covers the flow with Vitest
  suites.
- Rebuild the inventory HUD with a responsive stash panel suite in
  `src/ui/stash/`, derived selectors from `src/state/inventory.ts`, expanded
  `InventoryState` transfer/equip events, comparison-driven quick actions,
  polished CSS modules, and Vitest coverage for selectors and the panel
  behaviour.
- Rebuild the GitHub Pages mirror from commit 8f618f4 so the hashed Vite
  bundle, published HTML, and build badge all advertise the latest deploy.
- Introduce a guided HUD tutorial with spotlight tooltips, keyboard navigation,
  and a persistent skip flag, wire it into bootstrap, and document the
  onboarding flow for contributors.


- Document the `docs/` mirror refresh workflow in the README deployment section,
  highlighting the `npm run build` + sync step and cross-linking to the
  contributing notes about the custom domain records.
- Encapsulate NG+ progression in `src/progression/ngplus.ts`, persist run seeds,
  levels, and unlock slots through `GameState`, wire the modifiers into economy
  upkeep, reinforcement slots, enemy aggression, and elite loot odds, and cover
  the new math with focused Vitest suites plus README documentation.
- Add a progression tracker in `src/progression/objectives.ts` to monitor strongholds,
  roster wipes, and upkeep debt, surface a glassmorphism NG+ end screen via
  `src/ui/overlays/EndScreen.tsx`, escalate enemy spawn cadence each prestige, and
  document the refreshed loop.
- Launch a battlefield feedback suite that emits glassy damage/heal floaters,
  eases fatal fades, and jostles the canvas on major hits via
  `src/ui/fx/Floater.tsx`, `src/render/unit_fx.ts`, and updated `game.ts`
  wiring, all while honoring reduced-motion preferences and documenting the
  new overlays
- Layer a Web Audio sauna-and-forest ambience loop with seamless crossfades,
  surface a top-bar ambience toggle and volume slider that persist
  `audio_enabled`, sync with the master mute, honor reduced-motion
  preferences, and document the new controls
- Introduce an `src/audio` suite with registry-driven SFX playback, hook combat
  hits, kills, and SISU bursts into the event bus so polished cues fire while
  honoring the shared mute toggle, and document the procedurally generated WAV
  payloads plus licensing for contributors
- Halt the main animation loop during teardown by tracking the active frame ID,
  cancelling it in `cleanup()`, guarding the callback against post-shutdown
  ticks, and covering the lifecycle with a Vitest regression so repeated
  restarts stay polished and leak-free
- Centralize terrain palette tokens into `src/render/palette.ts`, introduce
  zoom-aware outline helpers, render fog-of-war through cached Perlin masks
  with multi-stop gradients, and refresh the README feature callouts to
  document the upgraded battlefield sheen
- Remove the unused `src/counter.ts` helper now that the counter demo has
  shipped elsewhere, keeping the Vite starter remnants out of the bundle
- Remove the unused `src/typescript.svg` asset so no leftover Vite starter
  icons ship with the build
- Remove hashed bundles from `assets/`, add ignore rules to keep future Vite
  outputs confined to `docs/`, and rebuild to verify only the published mirror
  receives generated files
- Compute camera-visible chunk ranges to populate tiles on reveal, move terrain
  drawing into an event-driven chunk cache that reuses offscreen canvases, wire
  the renderer through the new utilities so terrain, fog, and building updates
  invalidate the right chunks, and cover the flow with chunk invalidation tests
- Smooth battlefield workload spikes by rotating unit updates through a
  round-robin scheduler, reuse cached paths with TTL-aware invalidation when
  obstacles remain unchanged, and document the optimization with fresh tests
  to keep combat responsive under heavy unit counts
- Wire a `npm run simulate` balance harness through `vite-node`, seed 20 deterministic
  maps for 150 ticks, export beer/upkeep/roster/death snapshots to `/tmp/balance.csv`,
  and document the workflow for contributors
- Add a post-build CI gate that runs the `check:demo` script so pull requests
  surface broken live demo links or titles while preserving offline-friendly
  warnings
- Refactor bootstrap wiring into dedicated input, HUD, and loader modules so the main entrypoint stays a light orchestrator with reusable UI hooks
- Extract polished roster storage and HUD modules, relocate asset configuration,
  and add smoke tests so serialization and summary UI updates remain stable
- Guard `safeLoadJSON` against missing `localStorage` implementations and cover
  the fallback with tests so storage-less environments no longer throw during
  asset loading helpers
- Add a disposable sauna command console setup that unregisters media-query and
  event bus listeners while removing the HUD panel during cleanup so repeated
  game initializations no longer leak toggles or listeners
- Expose a disposable controller from the HUD topbar so cleanup routines remove
  SISU burst and resource listeners before rebuilding the UI, preventing
  duplicated overlays during restarts
- Note in issue #245 that the `src/unit.ts` barrel must migrate to `src/unit/index.ts`
  (or be removed) and its consumers updated before adding the new `src/unit/`
  directory so the refactor avoids path collisions
- Amend issue #253 to migrate every SISU import (for example, `useSisuBurst` in
  `src/game.ts`) from `src/sim/sisu.ts` to the new `src/sisu/burst.ts` module and
  delete the legacy `src/sim/sisu.ts` once all callers move over so no orphaned
  implementation remains after the refactor
- Expand TypeScript and Vitest globs to cover a dedicated `tests/` tree so future
  issue tasks can land spec files outside `src/` without compiler friction
- Introduce faction loot tables with rarity-weighted rolls, stash new drops in a
  persistent inventory that auto-equips selected attendants when possible,
  surface polished HUD toasts and a quartermaster panel for stash management,
  and cover loot generation plus inventory persistence with Vitest suites
- Amplify SISU Burst with +50% attack, a one-charge shield, and temporary
  immortality tracked through the modifier runtime, emit polished HUD status
  messaging, and cover the surge with regression tests to ensure buffs expire
  on schedule
- Upgrade the command console roster to render shared Saunoja stats, live loadout
  icons, and modifier timers with polished styling, refresh the panel on
  inventory and modifier events, and cover the new HUD with Vitest DOM tests
- Track sauna heat with a dedicated tracker, drive the economy tick to drain
  upkeep and trigger heat-gated player spawns through a shared helper, and
  cover the flow with upkeep and reinforcement tests
- Catalog faction spawn bundles in JSON, expose weighted selection helpers, and
  drive enemy wave spawns through the bundle system with cadence and identity
  tests
- Introduce a shared combat resolver that applies the max(1, atk - def) formula,
  tracks shield absorption, fires keyword hooks for both sides, and routes
  modifier callbacks so Saunoja and battlefield units share consistent
  damage/kill events
- Return combat resolutions from battlefield attacks so BattleManager can react
  to lethal blows, and ensure zero-damage keyword kills still mark units dead
  while emitting the polished death events
- Add a modifier runtime that tracks timed effects, routes hook triggers, emits
  lifecycle events, and exposes helper APIs plus tests so timed buffs expire
  cleanly during the polished game loop
- Introduce a shared unit stat model with dedicated types, leveling curves, and
  calculators, replace archetype subclasses with data-driven definitions, route
  factories through the new adapters, and verify deterministic progression
  across soldiers, archers, and marauders
- Preserve stored Saunoja personas when reattaching to new sessions so reloads
  keep their earned traits, upkeep, and experience intact
- Expand the cached hex terrain canvas whenever exploration pushes map bounds
  beyond the last render rectangle so fog clearing immediately reveals freshly
  rendered tiles
- Reset the command console roster renderer whenever the panel rebuilds so the
  Saunoja list repopulates after DOM swaps, and lock the behavior with a
  regression test that rebuilds the UI shell
- Decouple frontier raiders into a dedicated edge spawner that honors the 30-unit
  cap while sauna heat now summons only allied reinforcements with escalating
  thresholds
- Refine battle log narration to greet arriving Saunojas by their roster names
  while skipping rival spawn callouts for a cleaner feed
- Collapse the sauna command console by default on sub-960px viewports,
  surface a HUD toggle, and slide the panel off-canvas so the map stays
  interactive on mobile
- Remember the sauna command console log between sessions with polished storage so the right panel rehydrates prior narration on reload
- Persist applied policy upgrades across saves, replaying their effects on load so eco beer production and temperance night shifts stay active after reloading
- Pace battle movement with per-unit cooldowns so units only step once every
  five seconds, aligning pathfinding, stats, and tests with the slower cadence
- Offset auto-framing calculations to subtract the right HUD occlusion, keeping
  newly revealed tiles centered within the unobscured canvas when the command
  console is open
- Elevate the right panel into a sauna command console with a dedicated roster
  tab that highlights attendant status, live health bars, polished trait
  summaries, and direct selection alongside the policies, events, and log panes
- Let unattended ticks send idle scouts toward the nearest fogged hex, caching
  partial paths yet clearing them once exploration goals are reached so units
  keep uncovering the battlefield without drifting aimlessly
- Generate flavorful Saunoja names when attendants join the roster so every HUD
  entry reads as a distinct warrior rather than a generic placeholder
- March enemy spawns along the fog frontier so marauders emerge just beyond
  revealed territory and keep battles focused on the explored sauna perimeter
- Generate hex tiles lazily upon reveal so the battlefield only materializes
  around explored territory and active frontiers
- Cull hex tile terrain and fog rendering to the active camera viewport so
  each frame iterates only the polished, on-screen hexes
- Keep rival armies cloaked until allied scouts enter their three-hex vision
  radius so fog-of-war respects live battlefield awareness and polished pacing
- Upgrade unit pathfinding to an A*-driven, cached system and stagger battle
  processing each tick so movement stays responsive even with crowded hexes
- Cache the static hex terrain layer on an offscreen canvas, refreshing it only
  when tiles mutate so the renderer blits a polished base map each frame while
  drawing fog, highlights, and units as overlays
- Chunk the cached terrain into 16-hex canvases, redrawing only newly revealed
  sections before compositing them onto the polished base map each frame
- Persist the latest game state and Saunoja roster during cleanup before
  detaching event hooks so storage restrictions cannot drop late-session
  progress
- Cap battlefield marauders at thirty concurrent enemies, route their arrivals
  through a dedicated edge spawner, and let sauna heat summon only allied troops
  with escalating thresholds so reinforcements stay balanced and readable
- Attach sprite identifiers to every unit instance and thread them through
  factories so the renderer can resolve polished SVG art without fallbacks
- Introduce SISU as a persistent resource, award it for battlefield victories, and
  surface polished HUD controls for the new burst and Torille! abilities that
  spend the grit to empower or regroup allied units
- Introduce randomized Saunoja trait rolls, daily beer upkeep drain, and a roster
  card readout so attendants surface their quirks and maintenance costs at a glance
- Let BattleManager nudge stalled units into adjacent free hexes when pathfinding
  cannot advance them yet keeps targets out of range
- Sync fog-of-war reveals with each combat tick by updating player vision and
  limiting enemy scouting before the renderer draws the battlefield
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
