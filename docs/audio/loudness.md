# Combat audio loudness

This project keeps all combat cues as tiny base64-encoded WAV payloads so that the
repository can remain asset-free. To stop loudness regressions we enforce a shared
loudness target across every generated buffer and expose a QA workflow that is easy
to run locally and in CI.

## Targets

- **Integrated loudness**: `-16 LUFS` with a tolerance of ±1.5 dB.
- **Peak headroom**: at least 1 dB of safety (`<= -1 dBFS`).
- **Runtime gain**: normalised cues ship at unity gain (`1.0`).

The values above mirror what `scripts/audio/loudness_check.ts` and the Vitest regression
expect. If you adjust the target LUFS or headroom, update the constants exported from
`src/audio/sfxData.ts` so that the script, runtime metadata and tests stay in sync.

## Workflow

1. **Inspect current cues**
   ```bash
   npx vite-node scripts/audio/loudness_check.ts
   ```
   The report prints the LUFS delta, peak level and the gain that would be required to hit the
   target. The command exits non-zero whenever a cue falls outside the configured window,
   making it suitable for CI or pre-commit hooks.

2. **Normalise payloads** (when the report flags a cue):
   ```bash
   npx vite-node scripts/audio/loudness_check.ts --fix
   ```
   The `--fix` switch rescales each combat cue, rewrites `src/audio/sfxData.ts` with the
   new base64 payloads, and refreshes the loudness metadata. Once the cues are normalised
   the stored runtime gain snaps back to `1`, so playback only needs the global output fader.

3. **Verify**
   ```bash
   npm test
   ```
   The `tests/audio/loudness.test.ts` regression decodes every cue, measures loudness, and
   fails when a payload drifts beyond the allowed window. This keeps the QA workflow wired
   into CI while offering fast local feedback.

4. **Rebuild**
   Always rerun `npm run build` before shipping changes to capture the updated build info.

## Tips

- The utility in `scripts/audio/loudnessUtils.ts` contains small, dependency-free helpers
  for decoding and analysing WAV payloads. Use it when adding new cues to avoid re-implementing
  low-level parsing.
- If you introduce authored files under `public/assets/sounds/`, place them in WAV format so
  the loudness script can inspect them without FFmpeg.
- Document any creative choices (e.g., a new LUFS target) in this file so future contributors
  understand the reasoning behind loudness decisions.
