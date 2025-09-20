import { describe, expect, it } from 'vitest';
import {
  LOUDNESS_TOLERANCE,
  PEAK_HEADROOM_DB,
  SFX_VARIANTS,
  TARGET_LUFS
} from '../../src/audio/sfxData.ts';
import {
  computeLoudness,
  decodeBase64ToUint8Array,
  decodeWav
} from '../../scripts/audio/loudnessUtils.ts';

const LOUDNESS_EPSILON = 0.05;
const PEAK_EPSILON = 0.1;

describe('combat cue loudness', () => {
  for (const [name, variants] of Object.entries(SFX_VARIANTS)) {
    for (const variant of variants) {
      it(`${name} / ${variant.id} meets loudness target`, () => {
        const bytes = decodeBase64ToUint8Array(variant.payload);
        const wav = decodeWav(bytes);
        const stats = computeLoudness(wav.channelData);

        if (Number.isFinite(stats.lufs)) {
          const deviation = Math.abs(stats.lufs - TARGET_LUFS);
          expect(deviation).toBeLessThanOrEqual(LOUDNESS_TOLERANCE + LOUDNESS_EPSILON);
        }

        if (Number.isFinite(stats.peakDb)) {
          expect(stats.peakDb).toBeLessThanOrEqual(PEAK_HEADROOM_DB + PEAK_EPSILON);
        }

        expect(variant.loudness.gain).toBeCloseTo(1, 5);
        expect(variant.loudness.lufs).toBeCloseTo(stats.lufs, 3);
        expect(variant.loudness.peakDb).toBeCloseTo(stats.peakDb, 3);
      });
    }
  }
});
