import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  computeLoudness,
  decodeBase64ToUint8Array,
  decodeWav,
  encodeWavToBase64,
  normaliseToTarget,
  type DecodedWav,
  type LoudnessStats
} from './loudnessUtils.ts';

interface CliOptions {
  readonly fix: boolean;
  readonly quiet: boolean;
}

interface CueReport {
  readonly name: string;
  readonly stats: LoudnessStats;
  readonly targetLufs: number;
  readonly tolerance: number;
  readonly peakHeadroom: number;
  readonly recommendedGain: number;
  readonly postStats: LoudnessStats | null;
}

interface AssetReport extends CueReport {
  readonly sourcePath: string;
}

interface EncodedEntry {
  readonly payload: string;
  readonly loudness?: {
    readonly lufs: number;
    readonly peakDb: number;
    readonly gain: number;
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const sfxDataPath = path.join(repoRoot, 'src', 'audio', 'sfxData.ts');

const DEFAULT_TARGET_LUFS = -16;
const DEFAULT_TOLERANCE = 1.5;
const DEFAULT_PEAK_HEADROOM = -1;

function parseArgs(argv: string[]): CliOptions {
  let fix = false;
  let quiet = false;
  for (const arg of argv) {
    if (arg === '--fix' || arg === '--write') {
      fix = true;
    } else if (arg === '--quiet' || arg === '-q') {
      quiet = true;
    }
  }
  return { fix, quiet };
}

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
  return value.toFixed(3);
}

async function loadSfxData(): Promise<{
  readonly targetLufs: number;
  readonly tolerance: number;
  readonly peakHeadroom: number;
  readonly payloads: Record<string, EncodedEntry>;
}> {
  const moduleUrl = pathToFileURL(sfxDataPath).href;
  const module = await import(moduleUrl);

  const targetLufs: number = module.TARGET_LUFS ?? DEFAULT_TARGET_LUFS;
  const tolerance: number = module.LOUDNESS_TOLERANCE ?? DEFAULT_TOLERANCE;
  const peakHeadroom: number = module.PEAK_HEADROOM_DB ?? DEFAULT_PEAK_HEADROOM;

  const payloadsRaw: Record<string, EncodedEntry> = module.SFX_PAYLOADS ?? module.SFX_PAYLOADS_RAW;
  const payloads: Record<string, EncodedEntry> = {};

  if (!payloadsRaw) {
    throw new Error('Unable to locate SFX payloads in src/audio/sfxData.ts');
  }

  for (const [key, entry] of Object.entries(payloadsRaw)) {
    if (entry && typeof entry === 'object' && 'variants' in entry) {
      throw new Error(
        'Procedural SFX palettes detected. Use `npx vite-node scripts/audio/measure_calming_sfx.ts` '
          + 'to inspect loudness metadata.'
      );
    }
    if (typeof entry === 'string') {
      payloads[key] = { payload: entry };
    } else {
      payloads[key] = entry;
    }
  }

  return {
    targetLufs,
    tolerance,
    peakHeadroom,
    payloads
  };
}

function analyseCue(
  name: string,
  payload: string,
  targetLufs: number,
  tolerance: number,
  peakHeadroom: number
): CueReport {
  const bytes = decodeBase64ToUint8Array(payload);
  const wav = decodeWav(bytes);
  const stats = computeLoudness(wav.channelData);
  const normalised = normaliseToTarget(wav, targetLufs, peakHeadroom);
  // We do not mutate here; the caller decides whether to persist.
  return {
    name,
    stats,
    targetLufs,
    tolerance,
    peakHeadroom,
    recommendedGain: normalised.appliedGain,
    postStats: normalised.postStats
  };
}

function cueWithinSpec(report: CueReport): boolean {
  const lufsOk = !Number.isFinite(report.stats.lufs)
    ? true
    : Math.abs(report.stats.lufs - report.targetLufs) <= report.tolerance;
  const peakOk = !Number.isFinite(report.stats.peakDb)
    ? true
    : report.stats.peakDb <= report.peakHeadroom;
  return lufsOk && peakOk;
}

async function scanPublicAssets(
  targetLufs: number,
  tolerance: number,
  peakHeadroom: number
): Promise<AssetReport[]> {
  const soundsDir = path.join(repoRoot, 'public', 'assets', 'sounds');
  const reports: AssetReport[] = [];
  let entries: fs.Dirent[];
  try {
    entries = await fs.readdir(soundsDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return reports;
    }
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.wav' && ext !== '.wave') {
      continue;
    }
    const filePath = path.join(soundsDir, entry.name);
    const bytes = new Uint8Array(await fs.readFile(filePath));
    let wav: DecodedWav;
    try {
      wav = decodeWav(bytes);
    } catch (err) {
      console.warn(`Skipping ${entry.name}: ${(err as Error).message}`);
      continue;
    }
    const stats = computeLoudness(wav.channelData);
    const recommendedGain = Number.isFinite(stats.lufs)
      ? Math.pow(10, (targetLufs - stats.lufs) / 20)
      : 1;
    reports.push({
      name: entry.name,
      sourcePath: path.relative(repoRoot, filePath),
      stats,
      targetLufs,
      tolerance,
      peakHeadroom,
      recommendedGain,
      postStats: null
    });
  }

  return reports;
}

function renderReport(report: CueReport): string {
  const deviation = Number.isFinite(report.stats.lufs)
    ? (report.stats.lufs - report.targetLufs).toFixed(2)
    : 'n/a';
  return `${report.name.padEnd(12)} LUFS=${formatDb(report.stats.lufs)}dB (Δ=${deviation}dB) peak=${formatDb(report.stats.peakDb)}dB gain=${formatGain(report.recommendedGain)}`;
}

function renderAssetReport(report: AssetReport): string {
  const base = renderReport(report);
  return `${base} [${report.sourcePath}]`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return 'Number.NEGATIVE_INFINITY';
  }
  return value.toFixed(6);
}

function buildSfxDataSource(
  entries: Array<{
    readonly name: string;
    readonly payload: string;
    readonly loudness: { readonly lufs: number; readonly peakDb: number; readonly gain: number };
  }>,
  targetLufs: number,
  tolerance: number,
  peakHeadroom: number
): string {
  const nameUnion = entries.map((entry) => `'${entry.name}'`).join(' | ');
  const payloadLines = entries
    .map((entry) => {
      return [
        `  ${entry.name}: {`,
        `    payload: '${entry.payload}',`,
        `    loudness: {`,
        `      lufs: ${formatNumber(entry.loudness.lufs)},`,
        `      peakDb: ${formatNumber(entry.loudness.peakDb)},`,
        `      gain: ${formatNumber(entry.loudness.gain)}`,
        '    }',
        '  }'
      ].join('\n');
    })
    .join(',\n');

  return `// Auto-generated combat cue payloads.\n// Run \`vite-node scripts/audio/loudness_check.ts --fix\` to regenerate.\nexport const TARGET_LUFS = ${targetLufs};\nexport const LOUDNESS_TOLERANCE = ${tolerance};\nexport const PEAK_HEADROOM_DB = ${peakHeadroom};\n\nexport type EncodedSfxName = ${nameUnion};\n\nexport interface EncodedSfx {\n  readonly payload: string;\n  readonly loudness: {\n    readonly lufs: number;\n    readonly peakDb: number;\n    readonly gain: number;\n  };\n}\n\nexport const SFX_PAYLOADS: Record<EncodedSfxName, EncodedSfx> = {\n${payloadLines}\n} as const;\n`;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { targetLufs, tolerance, peakHeadroom, payloads } = await loadSfxData();

  if (!options.quiet) {
    console.log(`Target loudness: ${targetLufs} LUFS (±${tolerance}dB), peak headroom ${peakHeadroom}dB`);
  }

  const cueReports: CueReport[] = [];
  const updatedEntries: Array<{
    readonly name: string;
    readonly payload: string;
    readonly loudness: { readonly lufs: number; readonly peakDb: number; readonly gain: number };
  }> = [];

  for (const [name, entry] of Object.entries(payloads)) {
    const payload = entry.payload;
    if (!payload) {
      console.warn(`Skipping ${name}: empty payload`);
      continue;
    }
    const report = analyseCue(name, payload, targetLufs, tolerance, peakHeadroom);
    cueReports.push(report);

    if (options.fix) {
      const bytes = decodeBase64ToUint8Array(payload);
      const wav = decodeWav(bytes);
      const normalised = normaliseToTarget(wav, targetLufs, peakHeadroom);
      const base64 = encodeWavToBase64(normalised.updated);
      updatedEntries.push({
        name,
        payload: base64,
        loudness: {
          lufs: normalised.postStats.lufs,
          peakDb: normalised.postStats.peakDb,
          gain: 1
        }
      });
    }
  }

  if (!options.quiet) {
    console.log('\nCombat cues:');
    for (const report of cueReports) {
      const withinSpec = cueWithinSpec(report);
      const status = withinSpec ? 'OK' : 'OUT OF RANGE';
      console.log(`${renderReport(report)} -> ${status}`);
    }
  }

  const assetReports = await scanPublicAssets(targetLufs, tolerance, peakHeadroom);
  if (assetReports.length > 0 && !options.quiet) {
    console.log('\nPublic assets:');
    for (const report of assetReports) {
      const withinSpec = cueWithinSpec(report);
      const status = withinSpec ? 'OK' : 'OUT OF RANGE';
      console.log(`${renderAssetReport(report)} -> ${status}`);
    }
  }

  const anyOutOfSpec = cueReports.some((report) => !cueWithinSpec(report)) || assetReports.some((report) => !cueWithinSpec(report));

  if (options.fix && updatedEntries.length > 0) {
    const sortedEntries = [...updatedEntries].sort((a, b) => a.name.localeCompare(b.name));
    const source = buildSfxDataSource(sortedEntries, targetLufs, tolerance, peakHeadroom);
    await fs.writeFile(sfxDataPath, `${source}`);
    if (!options.quiet) {
      console.log(`\nUpdated ${path.relative(repoRoot, sfxDataPath)} with normalised payloads.`);
    }
  }

  if (anyOutOfSpec) {
    process.exitCode = 1;
  }
}

await main();
