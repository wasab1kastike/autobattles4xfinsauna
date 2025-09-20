import { describe, expect, it } from 'vitest';
import {
  CALMING_SFX,
  LOUDNESS_TOLERANCE,
  PEAK_HEADROOM_DB,
  TARGET_LUFS,
  renderVariantSamples
} from '../../src/audio/sfxData.ts';
import { computeLoudness } from '../../scripts/audio/loudnessUtils.ts';

const LOUDNESS_EPSILON = 0.05;
const PEAK_EPSILON = 0.1;

const TEST_SAMPLE_RATE = 48000;

describe('combat cue loudness', () => {
  for (const [name, collection] of Object.entries(CALMING_SFX)) {
    for (const variant of collection.variants) {
      it(`${name}/${variant.id} meets loudness target`, () => {
        const samples = renderVariantSamples(variant, TEST_SAMPLE_RATE);
        const rawStats = computeLoudness([samples]);
        const gain = variant.loudness.gain ?? 1;
        const scaled = new Float32Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
          scaled[i] = samples[i] * gain;
        }
        const scaledStats = computeLoudness([scaled]);

        if (Number.isFinite(scaledStats.lufs)) {
          const deviation = Math.abs(scaledStats.lufs - TARGET_LUFS);
          expect(deviation).toBeLessThanOrEqual(LOUDNESS_TOLERANCE + LOUDNESS_EPSILON);
        }

        if (Number.isFinite(scaledStats.peakDb)) {
          expect(scaledStats.peakDb).toBeLessThanOrEqual(PEAK_HEADROOM_DB + PEAK_EPSILON);
        }

        expect(variant.loudness.lufs).toBeCloseTo(rawStats.lufs, 3);
        expect(variant.loudness.peakDb).toBeCloseTo(rawStats.peakDb, 3);
      });
    }
  }
});
