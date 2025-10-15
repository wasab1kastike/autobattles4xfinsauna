# autobattles4xfinsauna

Autobattles4xFinsauna is a polished autobattler/4X prototype that pairs a
dynamic hex-map canvas with a glassmorphism-inspired HUD. The project is built
with Vite and TypeScript and focuses on responsive, touch-friendly interactions
with cinematic UI flourishes.

## Live Build

- Experience the latest build at https://artobest.com/?utm_source=chatgpt.com
- The GitHub Pages workflow publishes to the custom domain at
  [https://artobest.com/](https://artobest.com/), so any documentation or
  tooling should reference that URL.
- The shipped client double-checks the deployed commit on load and issues a
  cache-busting reload if a fresher bundle is live, keeping the experience
  locked to the newest release without manual hard refreshes.

## Feature Highlights

- **Saunoja attendants** persist between sessions, can be selected directly on
  the board, and glow with warm highlights when active.
- **SISU pulses** live in the top bar, letting you trigger timed combat bursts
  while monitoring the countdown badge.
- **Glass HUD overlays** (resource bar, build badge, and right-panel cards)
  are layered over the canvas with high-end gradients, blur, and accessible
  aria labels.
- **Steamforge Atelier shop** lives beside the stash badge so you can commission
  new sauna tiers mid-run with artocoins earned on the frontline.
- **Scripted enemy strongholds** seed the 10×10 campaign map via
  `src/world/strongholds.ts`, pairing guard tiers with bespoke loot caches so
  conquest objectives have handcrafted stakes from the first tick.
- **Artocoin ledger end screen** tallies liberated strongholds, roster attrition,
  resources, and artocoin earnings/spend so the next commission is always within reach.
- **NG+ scaling** now seeds each run, escalates upkeep and enemy aggression with
  every prestige level, and unlocks additional reinforcement slots for polished
  late-game pacing.
- **Immersive ambience** crossfades a sauna-and-forest soundscape through Web
  Audio, with top-bar controls that remember volume, honor the mute toggle, and
  respect reduced-motion preferences.
- **Hand-painted tactical sprites** render terrain, structures, and units with
  crisp vector art that scales cleanly across every zoom level.
- **Combat feedback floaters** pop luxe damage and heal numbers over units,
  mix canvas shakes with casualty fades, and respect reduced-motion
  preferences for mobile players.
- **Perlin-sculpted fog-of-war** renders with cached noise masks and multi-stop
  gradients so frontier edges stay crisp at every zoom level.
- **Sauna operations** expose a toggleable control card to manage rally
  behavior and visualize spawn progress.
- **Policies, events, and logs** occupy a dedicated right-hand column with tab
  controls for quick context switching and a running activity feed.
- **Build identity chip** surfaces the deployed commit hash (or development
  mode indicator) so the running build can be verified at a glance.
- **Responsive input** supports mouse, trackpad, and touch gestures with
  smooth zooming, panning, and viewport scaling.

## Gameplay Flow

1. **Select attendants** by tapping or clicking the highlighted Saunoja tokens;
   selections persist across reloads.
2. **Manage resources** through the top-bar badges—resource changes animate,
   and the timer badge keeps the current session readable.
3. **Trigger SISU** to launch a temporary combat surge and watch the countdown
   indicator pulse while the ability is active.
4. **Dial the ambience** from the top-bar controls—toggle the sauna forest loop
   or adjust the volume slider, and the preference will persist across future
   sessions.
5. **Adjust sauna tactics** from the sauna card: expand the card from the top
   bar to toggle the rally option and monitor spawn progress.
6. **Review events and policies** from the right panel. Apply policies when you
   have the gold, acknowledge events to clear the queue, and scan the log for a
   curated history of recent actions.
7. **Break the siege** to trigger the end screen—inspect stronghold progress,
   harvest your rewards, and launch straight into the next NG+ run.

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- `npm`

### Installation

```bash
npm install
```

### Common Scripts

- `npm run dev` – start a development server with hot reloading.
- `npm run build` – compile TypeScript and emit the production bundle to
  `dist/`.
- `npm run preview` – serve the production bundle locally.
- These scripts mirror Vite's defaults so every local or CI build can rely on
  `npm run build` producing a fresh `dist/` directory without additional
  configuration.
- `npm run audio:lint` – render every procedural cue and authored WAV to verify
  LUFS and peak compliance.
- `npm test` – run the loudness QA, Vitest suite, live demo availability check,
  and documentation verification.
- `npm run check:demo` – verify the README demo link resolves the Pages build
  and still advertises `<title>Autobattles4xFinsauna</title>`.
- `npm run simulate` – execute the deterministic balance sweep described below
  and write `/tmp/balance.csv` with 20 seeded battle snapshots.

### Design Documentation

- [Unit visual standards](docs/design/unit-visuals.md) – 64×64 sprite canvas
  requirements, metadata math, and the export helper workflow.
- [Sauna artocoin formula](docs/design/sauna-artocoin-formula.md) – the ledger
  balancing model for artocoin generation and spend.

### Build Output

Running `npm run build` produces the Vite output in `dist/`. The custom domain
is preserved automatically because `public/CNAME` is copied into the build
output alongside the SPA-friendly `404.html` fallback. After every rebuild
(especially when updating stronghold layouts or other map-driven assets), sync
the generated bundle back into `docs/` so the GitHub Pages mirror reflects the
latest commit.

### Base Path Configuration

The production bundle derives its base URL from the first populated environment
variable in this list: `PUBLIC_BASE_PATH`, `BASE_PATH`, `VITE_BASE_PATH`, or
`VITE_BASE`. When no override is provided, GitHub Actions automatically
supplies `GITHUB_REPOSITORY`, allowing the build to fall back to a repo-prefixed
base such as `/autobattles4xfinsauna/`. Local builds that need to mimic a GitHub
Pages deployment can export the repository slug before running `npm run build`:

```bash
export GITHUB_REPOSITORY=artohcodes/autobattles4xfinsauna
npm run build
```

Providing `PUBLIC_BASE_PATH=./` preserves fully relative output for static host
previews while keeping hashed assets reachable.

## Deployment

Pushing to `main` runs a GitHub Actions workflow that builds the app and
publishes the contents of `dist/` directly to GitHub Pages. The workflow uploads
the artifact and releases it without committing generated files back to the
repository, keeping the default branch clean.

The repository still tracks a `docs/` mirror so historic GitHub Pages snapshots
and the custom domain records stay versioned. When you cut a release (or any
change that should be reflected on the live site), run `npm run build` locally
and copy the resulting `dist/` output into `docs/` before committing (for
example, `rsync -a dist/ docs/`). That manual refresh keeps the checked-in
mirror aligned with the action-managed deployment and preserves the
`docs/CNAME` expectations documented in
[CONTRIBUTING.md](CONTRIBUTING.md#before-you-start). Continuous integration now
runs `npm test` immediately after the production build, so stale mirrors that
still advertise an older commit hash will fail pull requests until the docs
bundle is refreshed.

## Testing

```bash
npm test
```

This command executes the loudness QA (`npm run audio:lint`) before running the
Vitest suite and auxiliary documentation checks.

## Balance Simulation

```bash
npm run simulate
```

The simulation script runs via `vite-node` so Vite-specific modules (such as
`import.meta.glob`-powered faction bundles) execute unchanged. Each run seeds 20
maps and advances 150 ticks per seed while tracking sauna beer, upkeep drain,
active roster size, and total deaths. The aggregated samples are exported to
`/tmp/balance.csv` for further analysis or dashboarding.

## Contributing

Contributions are welcome! Fork the repository, make your changes, and open a
pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the expectations around
documentation, changelog entries, and domain checks.

## Changelog

Key updates are catalogued in [CHANGELOG.md](CHANGELOG.md).

## Combat Feedback System

The battlefield now routes combat events through a dedicated FX manager:

- `src/ui/fx/Floater.tsx` mounts an overlay layer that spawns glassy number
  badges above units. Each floater accepts color and directional parameters, so
  damage bursts can blaze crimson while heals surge in sauna-green hues.
- `src/render/unit_fx.ts` subscribes to the `unitDamaged`, `unitHealed`, and
  `unitDied` events. It projects unit coordinates into screen space, queues
  screen shakes, and eases casualty fades without stalling the main loop. The
  helper automatically tempers intensity on coarse pointers and honors
  `prefers-reduced-motion` so handheld devices degrade gracefully.
- `src/game.ts` wires the manager into the primary draw routine, translating
  shake offsets at 60fps while feeding per-unit alpha overrides into the canvas
  renderer.

These layers keep frontline skirmishes legible with premium polish while
respecting accessibility settings.

