# Sound Effects

Short combat cues now live in `src/audio/sfxData.ts` as base64-encoded PCM WAV
payloads that the `src/audio/sfx.ts` registry decodes at runtime. The attack,
death, and SISU bursts were procedurally generated for this project and are
released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) so
they can be remixed or replaced freely.

To swap in higher fidelity recordings, drop new WAV/OGG files alongside this
README and update the registry loaders. Keep contributions under a permissive
license and note attribution details here when external assets are introduced.
