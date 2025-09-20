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
