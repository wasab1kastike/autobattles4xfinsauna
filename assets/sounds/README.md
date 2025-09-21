# Sound Effects

Combat cues are authored procedurally and rendered on demand from the
`src/audio/sfxData.ts` definitions. The current calming palette consists of:

- **Birch Mallet Chimes** — a trio of gentle attack accents used for combat hits.
- **Cedar Breath Clusters** — soft loss cues that exhale instead of crunching.
- **Aurora Steam Pads** — luminous SISU bursts that bloom without piercing.

Each patch is synthesised at runtime via `src/audio/sfx.ts` and ships under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), enabling remixing
or replacement without attribution. When introducing external assets, document
licensing notes here and update the procedural tables accordingly so the mixer
continues to load the correct variants.

## Loudness QA

- **Target**: -16 LUFS ±1.5 dB with peaks at or below -1 dBFS.
- **Checker**: `npm run audio:lint` renders every procedural cue, applies the
  K-weighted loudness meter from `scripts/audio/loudnessUtils.ts`, and fails when
  a variant or metadata drifts outside the window.
- **Metadata refresh**: run `npx vite-node scripts/audio/measure_calming_sfx.ts`
  after tweaking synthesis parameters to capture the new raw LUFS, peak level and
  runtime gain that should be stored in `src/audio/sfxData.ts`.
