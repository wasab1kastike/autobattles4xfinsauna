import { Buffer } from 'node:buffer';

export interface DecodedWav {
  readonly sampleRate: number;
  readonly channelData: Float32Array[];
  readonly bitsPerSample: number;
}

export interface LoudnessStats {
  readonly rms: number;
  readonly lufs: number;
  readonly peak: number;
  readonly peakDb: number;
}

type BiquadCoefficients = {
  readonly b0: number;
  readonly b1: number;
  readonly b2: number;
  readonly a1: number;
  readonly a2: number;
};

const ABSOLUTE_GATE_LUFS = -70;
const RELATIVE_GATE_OFFSET = 10;
const BLOCK_DURATION_SECONDS = 0.4;
const BLOCK_STEP_SECONDS = 0.1;

function designBiquad(
  numerator: readonly [number, number, number],
  denominator: readonly [number, number, number],
  sampleRate: number
): BiquadCoefficients {
  const k = 2 * sampleRate;
  const [b0, b1, b2] = numerator;
  const [a0, a1, a2] = denominator;

  const a0z = a0 * k * k + a1 * k + a2;
  const a1z = 2 * (a2 - a0 * k * k);
  const a2z = a0 * k * k - a1 * k + a2;

  const b0z = b0 * k * k + b1 * k + b2;
  const b1z = 2 * (b2 - b0 * k * k);
  const b2z = b0 * k * k - b1 * k + b2;

  if (a0z === 0) {
    throw new Error('Invalid biquad design: zero normalising coefficient');
  }

  return {
    b0: b0z / a0z,
    b1: b1z / a0z,
    b2: b2z / a0z,
    a1: a1z / a0z,
    a2: a2z / a0z
  };
}

function applyBiquad(input: Float32Array | Float64Array, coeffs: BiquadCoefficients): Float64Array {
  const output = new Float64Array(input.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const { b0, b1, b2, a1, a2 } = coeffs;

  for (let i = 0; i < input.length; i++) {
    const x0 = input[i];
    const y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    output[i] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

function applyKWeighting(channel: Float32Array, sampleRate: number): Float64Array {
  if (Math.abs(sampleRate - 48000) < 1) {
    const preFilter: BiquadCoefficients = {
      b0: 1.53512485958697,
      b1: -2.69169618940638,
      b2: 1.19839281085285,
      a1: -1.69065929318241,
      a2: 0.73248077421585
    };
    const highPass: BiquadCoefficients = {
      b0: 1,
      b1: -2,
      b2: 1,
      a1: -1.99004745483398,
      a2: 0.99007225036621
    };
    const stage1 = applyBiquad(channel, preFilter);
    return applyBiquad(stage1, highPass);
  }

  const highShelfZero = 2 * Math.PI * 1681.974450955533;
  const highShelfPole = 2 * Math.PI * 38.13547087602444;

  const preFilter = designBiquad(
    [1, 2 * highShelfZero, highShelfZero * highShelfZero],
    [1, 2 * highShelfPole, highShelfPole * highShelfPole],
    sampleRate
  );

  const highPass = designBiquad([1, 0, 0], [1, 2 * highShelfPole, highShelfPole * highShelfPole], sampleRate);

  const stage1 = applyBiquad(channel, preFilter);
  return applyBiquad(stage1, highPass);
}

function lufsFromMeanSquare(meanSquare: number): number {
  if (meanSquare <= 0) {
    return Number.NEGATIVE_INFINITY;
  }
  return -0.691 + 10 * Math.log10(meanSquare);
}

function meanSquareFromBlock(
  channels: readonly Float64Array[],
  start: number,
  blockSize: number
): number {
  let sum = 0;
  for (const channel of channels) {
    for (let i = 0; i < blockSize; i++) {
      const sample = channel[start + i];
      sum += sample * sample;
    }
  }
  const divisor = blockSize * channels.length;
  return divisor > 0 ? sum / divisor : 0;
}

function readChunkId(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

export function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const buf = Buffer.from(base64, 'base64');
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

export function decodeWav(bytes: Uint8Array): DecodedWav {
  if (bytes.length < 44) {
    throw new Error('WAV payload too small to contain header');
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = readChunkId(view, 0);
  const wave = readChunkId(view, 8);
  if (riff !== 'RIFF' || wave !== 'WAVE') {
    throw new Error('Unsupported WAV payload (missing RIFF/WAVE header)');
  }

  let format: {
    audioFormat: number;
    numChannels: number;
    sampleRate: number;
    bitsPerSample: number;
    blockAlign: number;
    byteRate: number;
  } | null = null;
  let dataOffset = -1;
  let dataSize = 0;

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const chunkId = readChunkId(view, offset);
    const chunkSize = view.getUint32(offset + 4, true);
    const nextOffset = offset + 8 + chunkSize + (chunkSize % 2);

    if (chunkId === 'fmt ') {
      const fmtOffset = offset + 8;
      const audioFormat = view.getUint16(fmtOffset, true);
      const numChannels = view.getUint16(fmtOffset + 2, true);
      const sampleRate = view.getUint32(fmtOffset + 4, true);
      const byteRate = view.getUint32(fmtOffset + 8, true);
      const blockAlign = view.getUint16(fmtOffset + 12, true);
      const bitsPerSample = view.getUint16(fmtOffset + 14, true);
      format = {
        audioFormat,
        numChannels,
        sampleRate,
        bitsPerSample,
        blockAlign,
        byteRate
      };
    } else if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset = nextOffset;
  }

  if (!format) {
    throw new Error('WAV payload missing fmt chunk');
  }
  if (dataOffset === -1) {
    throw new Error('WAV payload missing data chunk');
  }
  if (format.audioFormat !== 1) {
    throw new Error(`Unsupported WAV encoding: format ${format.audioFormat}`);
  }
  if (format.bitsPerSample !== 16) {
    throw new Error(`Only 16-bit PCM WAV payloads are supported (found ${format.bitsPerSample})`);
  }

  const bytesPerSample = format.bitsPerSample / 8;
  const frameCount = dataSize / format.blockAlign;
  const channelData: Float32Array[] = Array.from({ length: format.numChannels }, () => new Float32Array(frameCount));
  const dataView = new DataView(bytes.buffer, bytes.byteOffset + dataOffset, dataSize);

  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < format.numChannels; channel++) {
      const sampleIndex = frame * format.blockAlign + channel * bytesPerSample;
      const sample = dataView.getInt16(sampleIndex, true);
      channelData[channel][frame] = sample / 32768;
    }
  }

  return {
    sampleRate: format.sampleRate,
    channelData,
    bitsPerSample: format.bitsPerSample
  };
}

export function encodeWav(data: DecodedWav): Uint8Array {
  if (data.bitsPerSample !== 16) {
    throw new Error('Only 16-bit PCM encoding is supported');
  }
  const numChannels = data.channelData.length;
  if (numChannels === 0) {
    throw new Error('Cannot encode WAV with zero channels');
  }
  const frameCount = data.channelData[0].length;
  for (const channel of data.channelData) {
    if (channel.length !== frameCount) {
      throw new Error('Channel length mismatch when encoding WAV');
    }
  }

  const bytesPerSample = data.bitsPerSample / 8;
  const blockAlign = bytesPerSample * numChannels;
  const byteRate = data.sampleRate * blockAlign;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  view.setUint8(0, 'R'.charCodeAt(0));
  view.setUint8(1, 'I'.charCodeAt(0));
  view.setUint8(2, 'F'.charCodeAt(0));
  view.setUint8(3, 'F'.charCodeAt(0));
  view.setUint32(4, 36 + dataSize, true);
  view.setUint8(8, 'W'.charCodeAt(0));
  view.setUint8(9, 'A'.charCodeAt(0));
  view.setUint8(10, 'V'.charCodeAt(0));
  view.setUint8(11, 'E'.charCodeAt(0));

  // fmt chunk
  view.setUint8(12, 'f'.charCodeAt(0));
  view.setUint8(13, 'm'.charCodeAt(0));
  view.setUint8(14, 't'.charCodeAt(0));
  view.setUint8(15, ' '.charCodeAt(0));
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, data.sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, data.bitsPerSample, true);

  // data chunk
  view.setUint8(36, 'd'.charCodeAt(0));
  view.setUint8(37, 'a'.charCodeAt(0));
  view.setUint8(38, 't'.charCodeAt(0));
  view.setUint8(39, 'a'.charCodeAt(0));
  view.setUint32(40, dataSize, true);

  const dataView = new DataView(buffer, 44);
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sampleIndex = frame * blockAlign + channel * bytesPerSample;
      const raw = Math.max(-1, Math.min(1, data.channelData[channel][frame]));
      const intSample = Math.round(raw * 32767);
      dataView.setInt16(sampleIndex, intSample, true);
    }
  }

  return new Uint8Array(buffer);
}

export function encodeWavToBase64(data: DecodedWav): string {
  const bytes = encodeWav(data);
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
}

export function computeLoudness(channels: Float32Array[], sampleRate = 48000): LoudnessStats {
  if (channels.length === 0) {
    return { rms: 0, lufs: Number.NEGATIVE_INFINITY, peak: 0, peakDb: Number.NEGATIVE_INFINITY };
  }

  let peak = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i];
      sumSquares += value * value;
      sampleCount++;
      const abs = Math.abs(value);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;

  const filtered = channels.map((channel) => applyKWeighting(channel, sampleRate));
  const blockSize = Math.max(1, Math.round(sampleRate * BLOCK_DURATION_SECONDS));
  const stepSize = Math.max(1, Math.round(sampleRate * BLOCK_STEP_SECONDS));
  const length = filtered[0].length;
  const blockSquares: number[] = [];

  for (let start = 0; start + blockSize <= length; start += stepSize) {
    blockSquares.push(meanSquareFromBlock(filtered, start, blockSize));
  }

  if (blockSquares.length === 0) {
    const fallbackMean = meanSquareFromBlock(filtered, 0, length);
    const fallbackLufs = lufsFromMeanSquare(fallbackMean);
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;
    return { rms, lufs: fallbackLufs, peak, peakDb };
  }

  const aboveAbsolute = blockSquares.filter((ms) => lufsFromMeanSquare(ms) >= ABSOLUTE_GATE_LUFS);
  if (aboveAbsolute.length === 0) {
    const peakDb = peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;
    return { rms, lufs: Number.NEGATIVE_INFINITY, peak, peakDb };
  }

  const initialMean = aboveAbsolute.reduce((acc, ms) => acc + ms, 0) / aboveAbsolute.length;
  const initialLufs = lufsFromMeanSquare(initialMean);
  const relativeThreshold = initialLufs - RELATIVE_GATE_OFFSET;

  let gatedSquares = blockSquares.filter((ms) => {
    const lufs = lufsFromMeanSquare(ms);
    return lufs >= ABSOLUTE_GATE_LUFS && lufs >= relativeThreshold;
  });

  if (gatedSquares.length === 0) {
    gatedSquares = aboveAbsolute;
  }

  const gatedMean = gatedSquares.reduce((acc, ms) => acc + ms, 0) / gatedSquares.length;
  const lufs = lufsFromMeanSquare(gatedMean);
  const peakDb = peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;

  return { rms, lufs, peak, peakDb };
}

export function applyGain(data: DecodedWav, gain: number): DecodedWav {
  const channelData = data.channelData.map((channel) => {
    const clone = new Float32Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      clone[i] = channel[i] * gain;
    }
    return clone;
  });
  return {
    sampleRate: data.sampleRate,
    channelData,
    bitsPerSample: data.bitsPerSample
  };
}

export function normaliseToTarget(
  data: DecodedWav,
  targetLufs: number,
  peakHeadroomDb: number
): {
  readonly updated: DecodedWav;
  readonly appliedGain: number;
  readonly stats: LoudnessStats;
  readonly postStats: LoudnessStats;
} {
  const stats = computeLoudness(data.channelData, data.sampleRate);
  if (!Number.isFinite(stats.lufs)) {
    return {
      updated: data,
      appliedGain: 1,
      stats,
      postStats: stats
    };
  }

  const gainForTarget = Math.pow(10, (targetLufs - stats.lufs) / 20);
  const peakGainLimit = stats.peak > 0
    ? Math.pow(10, (peakHeadroomDb - stats.peakDb) / 20)
    : gainForTarget;
  const appliedGain = Math.min(gainForTarget, peakGainLimit);
  const updated = applyGain(data, appliedGain);
  const postStats = computeLoudness(updated.channelData, data.sampleRate);
  return { updated, appliedGain, stats, postStats };
}
