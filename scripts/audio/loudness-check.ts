import { promises as fs, type Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CALMING_SFX,
  LOUDNESS_TOLERANCE,
  PEAK_HEADROOM_DB,
  TARGET_LUFS,
  renderVariantSamples
} from '../../src/audio/sfxData.ts';
import { computeLoudness, decodeWav, type LoudnessStats } from './loudnessUtils.ts';

type ReportKind = 'procedural' | 'asset';

type Report = {
  readonly kind: ReportKind;
  readonly id: string;
  readonly label: string;
  readonly gain: number;
  readonly raw: LoudnessStats;
  readonly scaled: LoudnessStats;
  readonly recommendedGain: number;
  readonly issues: readonly string[];
  readonly sourcePath?: string;
};

const SAMPLE_RATE = 48000;
const GAIN_EPSILON = 0.01;
const METADATA_EPSILON = 0.1;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function formatDb(value: number): string {
  if (!Number.isFinite(value)) {
    return '-∞';
  }
  return value.toFixed(2);
}

function formatGain(value: number): string {
  if (!Number.isFinite(value)) {
    return 'n/a';
  }
  return value.toFixed(4);
}

function formatLufs(value: number): string {
  if (!Number.isFinite(value)) {
    return '-∞';
  }
  return value.toFixed(2);
}

function applyGain(samples: Float32Array, gain: number): Float32Array {
  const scaled = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    scaled[i] = samples[i] * gain;
  }
  return scaled;
}

function loudnessIssues(stats: LoudnessStats, gain: number): string[] {
  const issues: string[] = [];
  if (Number.isFinite(stats.lufs)) {
    const deviation = Math.abs(stats.lufs - TARGET_LUFS);
    if (deviation > LOUDNESS_TOLERANCE) {
      issues.push(`Integrated loudness ${stats.lufs.toFixed(2)} LUFS exceeds ±${LOUDNESS_TOLERANCE.toFixed(1)} dB window.`);
    }
  }
  if (Number.isFinite(stats.peakDb) && stats.peakDb > PEAK_HEADROOM_DB + 1e-4) {
    issues.push(`True peak ${stats.peakDb.toFixed(2)} dBFS exceeds allowed headroom (${PEAK_HEADROOM_DB.toFixed(2)} dBFS).`);
  }
  if (!Number.isFinite(stats.lufs) && gain !== 0) {
    issues.push('Unable to measure LUFS for this cue.');
  }
  return issues;
}

function recommendedGainFor(stats: LoudnessStats): number {
  if (!Number.isFinite(stats.lufs)) {
    return 1;
  }
  const targetGain = Math.pow(10, (TARGET_LUFS - stats.lufs) / 20);
  if (Number.isFinite(stats.peakDb) && stats.peak > 0) {
    const peakLimit = Math.pow(10, (PEAK_HEADROOM_DB - stats.peakDb) / 20);
    return Math.min(targetGain, peakLimit);
  }
  return targetGain;
}

function createProceduralReport(name: string, variantId: string, variant: (typeof CALMING_SFX)[keyof typeof CALMING_SFX]['variants'][number]): Report {
  const samples = renderVariantSamples(variant, SAMPLE_RATE);
  const raw = computeLoudness([samples], SAMPLE_RATE);
  const gain = variant.loudness?.gain ?? 1;
  const scaledSamples = applyGain(samples, gain);
  const scaled = computeLoudness([scaledSamples], SAMPLE_RATE);
  const recommendedGain = recommendedGainFor(raw);

  const issues: string[] = [];
  const loudnessDelta = Math.abs((variant.loudness?.lufs ?? raw.lufs) - raw.lufs);
  const peakDelta = Math.abs((variant.loudness?.peakDb ?? raw.peakDb) - raw.peakDb);
  if (loudnessDelta > METADATA_EPSILON) {
    issues.push(`Metadata LUFS (${formatLufs(variant.loudness?.lufs ?? Number.NaN)}) diverges from measured value (${formatLufs(raw.lufs)}).`);
  }
  if (peakDelta > METADATA_EPSILON) {
    issues.push(`Metadata peak (${formatDb(variant.loudness?.peakDb ?? Number.NaN)} dBFS) diverges from measured value (${formatDb(raw.peakDb)} dBFS).`);
  }

  const toleranceIssues = loudnessIssues(scaled, gain);
  issues.push(...toleranceIssues);

  if (Math.abs(gain - recommendedGain) > GAIN_EPSILON) {
    issues.push(`Runtime gain ${gain.toFixed(3)} differs from recommended ${recommendedGain.toFixed(3)}.`);
  }

  return {
    kind: 'procedural',
    id: `${name}/${variantId}`,
    label: variant.label,
    gain,
    raw,
    scaled,
    recommendedGain,
    issues
  };
}

async function scanProcedural(): Promise<Report[]> {
  const reports: Report[] = [];
  for (const [name, collection] of Object.entries(CALMING_SFX)) {
    for (const variant of collection.variants) {
      reports.push(createProceduralReport(name, variant.id, variant));
    }
  }
  return reports;
}

async function scanAuthoredAssets(): Promise<Report[]> {
  const reports: Report[] = [];
  const soundsDir = path.join(repoRoot, 'public', 'assets', 'sounds');
  let entries: Dirent[];
  try {
    entries = await fs.readdir(soundsDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return reports;
    }
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.wav')) {
      continue;
    }
    const filePath = path.join(soundsDir, entry.name);
    const bytes = await fs.readFile(filePath);
    const wav = decodeWav(bytes);
    const raw = computeLoudness(wav.channelData, wav.sampleRate);
    const gain = 1;
    const recommendedGain = recommendedGainFor(raw);
    const issues = loudnessIssues(raw, gain);
    if (Math.abs(recommendedGain - 1) > GAIN_EPSILON) {
      issues.push(`Consider applying ${recommendedGain.toFixed(3)} gain to reach the target.`);
    }
    reports.push({
      kind: 'asset',
      id: entry.name,
      label: entry.name,
      gain,
      raw,
      scaled: raw,
      recommendedGain,
      issues,
      sourcePath: filePath
    });
  }

  return reports;
}

function logReport(report: Report): void {
  const prefix = report.kind === 'procedural' ? 'proc' : 'asset';
  const base = `${prefix} ${report.id}`;
  const lufsPart = `raw=${formatLufs(report.raw.lufs)} LUFS → scaled=${formatLufs(report.scaled.lufs)} LUFS`;
  const peakPart = `peak=${formatDb(report.scaled.peakDb)} dBFS`;
  const gainPart = `gain=${formatGain(report.gain)} (recommended ${formatGain(report.recommendedGain)})`;
  console.log(`${base.padEnd(28)} ${lufsPart.padEnd(38)} ${peakPart.padEnd(24)} ${gainPart}`);
  if (report.issues.length > 0) {
    for (const issue of report.issues) {
      console.log(`   ⚠ ${issue}`);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet') || args.includes('-q');

  const reports = [...(await scanProcedural()), ...(await scanAuthoredAssets())];
  let hadIssues = false;
  if (!quiet) {
    console.log(`Target loudness ${TARGET_LUFS} LUFS ±${LOUDNESS_TOLERANCE} dB, peak ≤ ${PEAK_HEADROOM_DB} dBFS`);
  }

  for (const report of reports) {
    if (!quiet || report.issues.length > 0) {
      logReport(report);
    }
    if (report.issues.length > 0) {
      hadIssues = true;
    }
  }

  if (hadIssues) {
    console.error('\nAudio loudness QA failed. See warnings above.');
    process.exitCode = 1;
  }
}

await main();
