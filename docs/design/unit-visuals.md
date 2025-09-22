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
