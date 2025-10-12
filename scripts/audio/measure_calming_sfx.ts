import { CALMING_SFX, TARGET_LUFS, renderVariantSamples } from '../../src/audio/sfxData.ts';
import { computeLoudness } from './loudnessUtils.ts';

const SAMPLE_RATE = 48000;

for (const [name, collection] of Object.entries(CALMING_SFX)) {
  for (const variant of collection.variants) {
    const samples = renderVariantSamples(variant, SAMPLE_RATE);
    const stats = computeLoudness([samples], SAMPLE_RATE);
    const gain = Number.isFinite(stats.lufs)
      ? Math.pow(10, (TARGET_LUFS - stats.lufs) / 20)
      : 1;
    console.log(
      `${name}/${variant.id}`,
      `lufs=${stats.lufs.toFixed(3)}`,
      `peak=${stats.peakDb.toFixed(3)}`,
      `gain=${gain.toFixed(4)}`
    );
  }
}
