// Procedurally generated combat cue definitions.
// These calming patches are rendered on demand rather than shipping binary
// payloads. Update the tables below and run
// `npx vite-node scripts/audio/measure_calming_sfx.ts` to inspect loudness
// metadata when making substantial changes.

export const TARGET_LUFS = -16;
export const LOUDNESS_TOLERANCE = 1.5;
export const PEAK_HEADROOM_DB = -1;

export type EncodedSfxName = 'attack' | 'death' | 'sisu';

export interface EnvelopeSpec {
  readonly attack: number;
  readonly decay: number;
  readonly sustain: number;
  readonly release: number;
  readonly sustainLevel: number;
}

export interface ToneLayerSpec {
  readonly type: 'sine';
  readonly ratio: number;
  readonly gain: number;
  readonly phase?: number;
  readonly vibrato?: {
    readonly speed: number;
    readonly depth: number;
  };
  readonly tremolo?: {
    readonly speed: number;
    readonly depth: number;
  };
}

export interface NoiseLayerSpec {
  readonly type: 'noise';
  readonly gain: number;
}

export type LayerSpec = ToneLayerSpec | NoiseLayerSpec;

export interface LoudnessMetadata {
  readonly lufs: number;
  readonly peakDb: number;
  readonly gain: number;
}

export interface ProceduralSfxVariant {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly duration: number;
  readonly baseFrequency: number;
  readonly envelope: EnvelopeSpec;
  readonly layers: readonly LayerSpec[];
  readonly seed: number;
  readonly loudness: LoudnessMetadata;
}

export interface ProceduralSfxCollection {
  readonly palette: string;
  readonly license: string;
  readonly variants: readonly ProceduralSfxVariant[];
}

const DEFAULT_SAMPLE_RATE = 48000;

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleEnvelope(envelope: EnvelopeSpec, duration: number, t: number): number {
  const { attack, decay, sustain, release, sustainLevel } = envelope;

  if (attack > 0 && t < attack) {
    return t / attack;
  }

  if (decay > 0 && t < attack + decay) {
    const decayT = (t - attack) / decay;
    return 1 - (1 - sustainLevel) * decayT;
  }

  if (t < duration - release) {
    return sustainLevel;
  }

  if (release > 0 && t < duration) {
    const releaseT = (t - (duration - release)) / release;
    return sustainLevel * (1 - releaseT);
  }

  return 0;
}

function sampleTone(layer: ToneLayerSpec, baseFrequency: number, t: number): number {
  const phase = layer.phase ?? 0;
  const vibrato = layer.vibrato;
  const tremolo = layer.tremolo;
  const vibratoFactor = vibrato ? 1 + vibrato.depth * Math.sin(2 * Math.PI * vibrato.speed * t) : 1;
  const amplitude = tremolo
    ? layer.gain * (1 - tremolo.depth + tremolo.depth * Math.sin(2 * Math.PI * tremolo.speed * t))
    : layer.gain;
  const freq = baseFrequency * layer.ratio * vibratoFactor;
  return amplitude * Math.sin(2 * Math.PI * freq * t + phase);
}

function sampleNoise(layer: NoiseLayerSpec, rng: () => number): number {
  return layer.gain * (rng() * 2 - 1);
}

export function renderVariantSamples(
  variant: ProceduralSfxVariant,
  sampleRate: number = DEFAULT_SAMPLE_RATE
): Float32Array {
  const length = Math.max(1, Math.floor(variant.duration * sampleRate));
  const data = new Float32Array(length);
  const rng = mulberry32(variant.seed);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    let value = 0;
    for (const layer of variant.layers) {
      if (layer.type === 'sine') {
        value += sampleTone(layer, variant.baseFrequency, t);
      } else {
        value += sampleNoise(layer, rng);
      }
    }
    const env = sampleEnvelope(variant.envelope, variant.duration, t);
    data[i] = value * env;
  }

  return data;
}

export const CALMING_SFX: Record<EncodedSfxName, ProceduralSfxCollection> = {
  attack: {
    palette: 'Birch Mallet Chimes',
    license: 'CC0-1.0 (procedurally generated)',
    variants: [
      {
        id: 'attack-a',
        label: 'Gentle Birch Strike',
        description: 'Soft mallet transient with subtle shimmer.',
        duration: 0.9,
        baseFrequency: 220,
        envelope: { attack: 0.02, decay: 0.18, sustain: 0.55, release: 0.35, sustainLevel: 0.55 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.42, vibrato: { speed: 6, depth: 0.0015 } },
          { type: 'sine', ratio: 1.997, gain: 0.28, vibrato: { speed: 6, depth: 0.001 } },
          { type: 'sine', ratio: 2.97, gain: 0.18, vibrato: { speed: 7, depth: 0.001 } }
        ],
        seed: 421,
        loudness: { lufs: -14.775, peakDb: -2.134, gain: 0.8684 }
      },
      {
        id: 'attack-b',
        label: 'Rounded Pluck Echo',
        description: 'A slightly brighter chime tuned above the root.',
        duration: 0.9,
        baseFrequency: 232,
        envelope: { attack: 0.02, decay: 0.18, sustain: 0.55, release: 0.35, sustainLevel: 0.55 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.42, vibrato: { speed: 6, depth: 0.0015 } },
          { type: 'sine', ratio: 1.997, gain: 0.28, vibrato: { speed: 6, depth: 0.001 } },
          { type: 'sine', ratio: 2.97, gain: 0.18, vibrato: { speed: 7, depth: 0.001 } }
        ],
        seed: 947,
        loudness: { lufs: -14.758, peakDb: -2.101, gain: 0.8667 }
      },
      {
        id: 'attack-c',
        label: 'High Drift Pluck',
        description: 'Upper register tap with airy decay.',
        duration: 0.9,
        baseFrequency: 244,
        envelope: { attack: 0.02, decay: 0.18, sustain: 0.55, release: 0.35, sustainLevel: 0.55 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.42, vibrato: { speed: 6, depth: 0.0015 } },
          { type: 'sine', ratio: 1.997, gain: 0.28, vibrato: { speed: 6, depth: 0.001 } },
          { type: 'sine', ratio: 2.97, gain: 0.18, vibrato: { speed: 7, depth: 0.001 } }
        ],
        seed: 1337,
        loudness: { lufs: -14.731, peakDb: -2.076, gain: 0.8641 }
      }
    ]
  },
  death: {
    palette: 'Cedar Breath Clusters',
    license: 'CC0-1.0 (procedurally generated)',
    variants: [
      {
        id: 'death-a',
        label: 'Hollow Exhale',
        description: 'Low cedar drum pulse with airy noise tail.',
        duration: 1.15,
        baseFrequency: 150,
        envelope: { attack: 0.03, decay: 0.3, sustain: 0.45, release: 0.5, sustainLevel: 0.45 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.55, tremolo: { speed: 0.6, depth: 0.25 } },
          { type: 'sine', ratio: 0.5, gain: 0.33 },
          { type: 'sine', ratio: 0.25, gain: 0.25 },
          { type: 'noise', gain: 0.22 }
        ],
        seed: 615,
        loudness: { lufs: -14.365, peakDb: -0.218, gain: 0.8284 }
      },
      {
        id: 'death-b',
        label: 'Soft Ember Fall',
        description: 'Mid register thump with drifting undertone.',
        duration: 1.15,
        baseFrequency: 168,
        envelope: { attack: 0.03, decay: 0.3, sustain: 0.45, release: 0.5, sustainLevel: 0.45 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.55, tremolo: { speed: 0.6, depth: 0.25 } },
          { type: 'sine', ratio: 0.5, gain: 0.33 },
          { type: 'sine', ratio: 0.25, gain: 0.25 },
          { type: 'noise', gain: 0.22 }
        ],
        seed: 274,
        loudness: { lufs: -14.204, peakDb: -0.185, gain: 0.8132 }
      },
      {
        id: 'death-c',
        label: 'Warm Resolve',
        description: 'Higher pitch breathy release with gentle rumble.',
        duration: 1.15,
        baseFrequency: 184,
        envelope: { attack: 0.03, decay: 0.3, sustain: 0.45, release: 0.5, sustainLevel: 0.45 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.55, tremolo: { speed: 0.6, depth: 0.25 } },
          { type: 'sine', ratio: 0.5, gain: 0.33 },
          { type: 'sine', ratio: 0.25, gain: 0.25 },
          { type: 'noise', gain: 0.22 }
        ],
        seed: 978,
        loudness: { lufs: -14.079, peakDb: -0.160, gain: 0.8015 }
      }
    ]
  },
  sisu: {
    palette: 'Aurora Steam Pads',
    license: 'CC0-1.0 (procedurally generated)',
    variants: [
      {
        id: 'sisu-a',
        label: 'Rising Steam',
        description: 'Slow bloom of airy sine pads with hushed texture.',
        duration: 1.9,
        baseFrequency: 176,
        envelope: { attack: 0.4, decay: 0.45, sustain: 0.75, release: 0.7, sustainLevel: 0.75 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.38, tremolo: { speed: 0.45, depth: 0.15 } },
          { type: 'sine', ratio: 2.6, gain: 0.12 },
          { type: 'sine', ratio: 0.5, gain: 0.27 },
          { type: 'sine', ratio: 0.75, gain: 0.2, vibrato: { speed: 0.9, depth: 0.01 } },
          { type: 'noise', gain: 0.12 }
        ],
        seed: 1204,
        loudness: { lufs: -12.754, peakDb: -0.501, gain: 0.6882 }
      },
      {
        id: 'sisu-b',
        label: 'Glowing Drift',
        description: 'Warmer harmonic swell with chorus shimmer.',
        duration: 1.9,
        baseFrequency: 188,
        envelope: { attack: 0.4, decay: 0.45, sustain: 0.75, release: 0.7, sustainLevel: 0.75 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.38, tremolo: { speed: 0.45, depth: 0.15 } },
          { type: 'sine', ratio: 2.6, gain: 0.12 },
          { type: 'sine', ratio: 0.5, gain: 0.27 },
          { type: 'sine', ratio: 0.75, gain: 0.2, vibrato: { speed: 0.9, depth: 0.01 } },
          { type: 'noise', gain: 0.12 }
        ],
        seed: 1642,
        loudness: { lufs: -12.943, peakDb: -0.271, gain: 0.7033 }
      },
      {
        id: 'sisu-c',
        label: 'Morning Brilliance',
        description: 'Bright tonic swell with shimmering overtones.',
        duration: 1.9,
        baseFrequency: 200,
        envelope: { attack: 0.4, decay: 0.45, sustain: 0.75, release: 0.7, sustainLevel: 0.75 },
        layers: [
          { type: 'sine', ratio: 1, gain: 0.38, tremolo: { speed: 0.45, depth: 0.15 } },
          { type: 'sine', ratio: 2.6, gain: 0.12 },
          { type: 'sine', ratio: 0.5, gain: 0.27 },
          { type: 'sine', ratio: 0.75, gain: 0.2, vibrato: { speed: 0.9, depth: 0.01 } },
          { type: 'noise', gain: 0.12 }
        ],
        seed: 2019,
        loudness: { lufs: -12.888, peakDb: -0.235, gain: 0.6989 }
      }
    ]
  }
} as const;

export type EncodedSfx = ProceduralSfxCollection;
export const SFX_PAYLOADS = CALMING_SFX;
