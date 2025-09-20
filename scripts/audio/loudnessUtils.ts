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

export function computeLoudness(channels: Float32Array[]): LoudnessStats {
  let sumSquares = 0;
  let count = 0;
  let peak = 0;

  for (const channel of channels) {
    for (let i = 0; i < channel.length; i++) {
      const value = channel[i];
      sumSquares += value * value;
      count++;
      const abs = Math.abs(value);
      if (abs > peak) {
        peak = abs;
      }
    }
  }

  const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
  const lufs = rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;
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
  const stats = computeLoudness(data.channelData);
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
  const postStats = computeLoudness(updated.channelData);
  return { updated, appliedGain, stats, postStats };
}
