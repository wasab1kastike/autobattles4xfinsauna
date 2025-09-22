# Unit Visual Standards

The sauna roster and enemy archetypes now share a single **64×64 SVG canvas**
so every sprite anchors cleanly to its hex base. This document captures the
naming convention, scaling math, and tooling required to regenerate assets after
art updates.

## Canvas expectations

- **ViewBox:** every unit SVG must declare `viewBox="0 0 64 64"` (and optional
  `width="64" height="64"`) so the natural canvas stays square.
- **Baseline alignment:** artwork is scaled so the character’s feet land on the
  bottom edge of the 64×64 viewBox. The `translate` offsets in
  `assets/sprites/*.svg` keep allies and enemies horizontally centered.
- **Consistent padding:** allies and enemies use the same centering logic (see
  `manifest.json` below) to keep silhouettes balanced over the glowing base.
- **File naming:** continue the `unit-<archetype>.svg` pattern for anything
  consumed by `assetPaths.images`. Shared variants such as the marauder and
  avanto marauder re-use the same SVG file.

## Faction palette tokens

`drawUnitSprite` pipes faction lighting into the canvas base by reading CSS
custom properties from `src/style.css`. Keep these tokens current when art calls
for palette shifts so the renderer gradients stay in sync with HUD badges and
selection halos.

### Player palette (`--faction-player-*`)

| Token | Purpose | Default value |
| --- | --- | --- |
| `--faction-player-shell` | Core fill for the oval base | `rgba(30, 38, 58, 0.95)` |
| `--faction-player-mid` | Midtone transition inside the base gradient | `rgba(45, 60, 98, 0.94)` |
| `--faction-player-rim` | Outer rim stroke drawn in **screen** mode | `rgba(118, 214, 255, 0.7)` |
| `--faction-player-highlight` | Highlight wash for the top of the base | `rgba(190, 230, 255, 0.65)` |
| `--faction-player-ring` | Inner ring stroke layered above the rim | `rgba(86, 151, 255, 0.65)` |
| `--faction-player-motion-glow-rgb` | RGB triplet powering the animated glow | `124 215 255` |
| `--faction-player-accent-tint` | HUD hover/selection tint | `rgba(56, 189, 248, 0.85)` |
| `--faction-player-accent-halo` | Soft HUD halo for badges and tabs | `rgba(14, 165, 233, 0.35)` |

### Enemy palette (`--faction-enemy-*`)

| Token | Purpose | Default value |
| --- | --- | --- |
| `--faction-enemy-shell` | Core fill for the oval base | `rgba(46, 24, 32, 0.95)` |
| `--faction-enemy-mid` | Midtone transition inside the base gradient | `rgba(66, 36, 44, 0.95)` |
| `--faction-enemy-rim` | Outer rim stroke drawn in **screen** mode | `rgba(248, 140, 120, 0.7)` |
| `--faction-enemy-highlight` | Highlight wash for the top of the base | `rgba(250, 190, 170, 0.55)` |
| `--faction-enemy-ring` | Inner ring stroke layered above the rim | `rgba(255, 128, 96, 0.6)` |
| `--faction-enemy-motion-glow-rgb` | RGB triplet powering the animated glow | `255 140 110` |
| `--faction-enemy-accent-tint` | HUD hover/selection tint | `rgba(248, 113, 113, 0.85)` |
| `--faction-enemy-accent-halo` | Soft HUD halo for badges and tabs | `rgba(239, 68, 68, 0.35)` |

When new factions arrive, add matching `--faction-<name>-*` tokens alongside the
existing sets so both the HUD gradients and `UnitSprite` renderer can pick up
the palette from the same source of truth.

## Baseplate layering

`UnitSprite` expects three passes when it calls `drawBase`:

1. **Shell gradient:** An oval fill blends `highlight → mid → shell` so the base
   reads as polished glass. Keep artwork centered on this footprint to avoid
   floating silhouettes.
2. **Shadow pass:** The renderer switches to `multiply` mode and overlays a
   radial gradient that darkens the back half of the oval while injecting the
   motion glow color near the center. Avoid painting harsh shadows in the SVGs —
   let the shader drive depth.
3. **Highlight wash and rings:** Finally, `screen` mode sprays a soft highlight
   across the front arc, then two strokes (`rim` and `ring`) add the crisp rim
   light and thin inner outline. Preserve transparent pixels around the sprite
   so these strokes stay unobstructed.

Any sprite updates should remain agnostic of the base: keep characters on their
own layers and let the renderer’s gradients handle faction swaps, selection
intensity, and Sisu glow pulses.

## Visual polish guardrails

| Do | Don’t |
| --- | --- |
| <figure><img src="../assets/sprites/archer.svg" alt="Archer sprite with vector base" width="128" /><figcaption><strong>Do</strong> keep the oval baseplate, rim, and highlights as editable vector groups like the production `assets/sprites/archer.svg` export.</figcaption></figure> | <figure><img src="../assets/ui/sauna-beer.svg" alt="Sauna beer badge used as HUD icon" width="128" /><figcaption><strong>Don’t</strong> swap in flattened UI badges or raster silhouettes; the `docs/assets/ui/sauna-beer.svg` crest lacks the layered base `UnitSprite` expects.</figcaption></figure> |

Use existing sprite anatomy as a template when introducing new archetypes.
Baseplate geometry should remain untouched SVG shapes so combat lighting, motion
glow, and Sisu pulses keep their premium finish.

## Renderer metadata

`src/render/units/sprite_map.ts` is the source of truth for anchor, scale, and
nudge values. With the 64×64 canvas:

- `nativeSize` stays `{ width: 64, height: 64 }` for every archetype.
- `scale.y` preserves the intended on-screen height (matching the previous
  builds).
- `scale.x` should be `scale.y * (2 / Math.sqrt(3))` so the drawn sprite
  remains square relative to the hex rectangle.
- Anchors stay the same ratios as the legacy art; nudge values remain fractional
  offsets of the hex size to dial in the base contact point.

After touching sprite art, update the corresponding metadata entry and extend
`src/render/units/draw.test.ts` if a new archetype ships.

## Export helper & manifest

Run the automated helper whenever sprites change:

```bash
npm run export:sprites
```

This script scans `assets/sprites/*.svg`, verifies the 64×64 canvas, and writes
`assets/sprites/manifest.json` with the translation and scale data recovered
from each file. The manifest records the original source dimensions so future
re-exports can double-check parity with the historic art.

## Refresh checklist

1. Update the raw SVG in `assets/sprites/` (keep it vector-based, no raster
   embeds).
2. Run `npm run export:sprites` to regenerate `manifest.json`.
3. Adjust `UNIT_SPRITE_MAP` entries so `scale` and `nudge` still land the feet on
   the hex base.
4. Extend `src/render/units/draw.test.ts` if a new sprite type is introduced.
5. Re-run `npm run build` and `npm test` before committing.
