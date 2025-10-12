# Combat audio loudness

This project renders combat cues procedurally from the definitions in
`src/audio/sfxData.ts`. The buffers are synthesised on demand at runtime so the
repository can stay asset-light while still guaranteeing consistent loudness.
To prevent regressions we enforce a shared loudness target across every variant
and expose a QA workflow that runs locally and in CI.

## Targets

- **Integrated loudness**: `-16 LUFS` with a tolerance of ±1.5 dB.
- **Peak headroom**: at least 1 dB of safety (`<= -1 dBFS`).
- **Runtime gain**: metadata stores the gain required to hit the target.

The values above mirror what `scripts/audio/loudness-check.ts` and the Vitest regression
expect. If you adjust the target LUFS or headroom, update the constants exported from
`src/audio/sfxData.ts` so that the checker, runtime metadata and tests stay in sync.

## Workflow

1. **Inspect current cues**
   ```bash
   npm run audio:lint
   # or: npx vite-node scripts/audio/loudness-check.ts
   ```
   The report prints the LUFS delta, peak level and the gain required to hit the
   target. The command exits non-zero whenever a cue falls outside the configured window
   or the stored metadata drifts from the measurement, making it suitable for CI.

2. **Measure variants when editing synthesis parameters**
   ```bash
   npx vite-node scripts/audio/measure_calming_sfx.ts
   ```
   This helper renders every procedural cue, applies the LUFS meter and prints the
   raw loudness, peak level and suggested gain. Use the output to update
   `src/audio/sfxData.ts` so the runtime metadata mirrors the measured values.

3. **Verify**
   ```bash
   npm test
   ```
   The `tests/audio/loudness.test.ts` regression renders every cue, applies the same
   LUFS meter and fails whenever the scaled variants drift outside the allowed window.
   This keeps the QA workflow wired into CI while offering fast local feedback.

4. **Rebuild**
   Always rerun `npm run build` before shipping changes to capture the updated build info.

## Tips

- The utility in `scripts/audio/loudnessUtils.ts` contains dependency-free helpers for
  decoding and analysing WAV payloads alongside the K-weighted LUFS meter used by
  both QA scripts and the tests.
- The checker also scans any authored files under `public/assets/sounds/` so you can mix
  in sampled content while keeping loudness consistent. Prefer WAV uploads so the tooling
  can read them without external dependencies.
- Document any creative choices (e.g., a new LUFS target or updated window) in this file so
  future contributors understand the reasoning behind loudness decisions.
