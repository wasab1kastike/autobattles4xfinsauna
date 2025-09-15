import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readdir, rm, cp, copyFile, writeFile } from 'node:fs/promises';
import rootConfig from './vite.root.config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const standaloneDir = path.resolve(repoRoot, 'standalone');
const assetsDir = path.resolve(repoRoot, 'assets');

async function ensureBuild() {
  await build({
    configFile: false,
    ...rootConfig,
  });
}

async function copyBundle() {
  const mainSrc = path.join(standaloneDir, 'main.js');
  const mainDest = path.join(repoRoot, 'main.js');
  await mkdir(path.dirname(mainDest), { recursive: true });
  await copyFile(mainSrc, mainDest);

  await mkdir(assetsDir, { recursive: true });

  const topLevelAssets = [
    { name: 'game.css', destName: 'game.css' },
    { name: 'UnitFactory.js', destName: 'UnitFactory.js' },
  ];

  for (const { name, destName } of topLevelAssets) {
    const src = path.join(standaloneDir, 'assets', name);
    const dest = path.join(assetsDir, destName);
    await copyFile(src, dest);
  }

  const staticDirs = ['sounds', 'sprites', 'tiles', 'ui'];
  for (const dir of staticDirs) {
    const srcDir = path.join(standaloneDir, 'assets', dir);
    const destDir = path.join(assetsDir, dir);
    await rm(destDir, { recursive: true, force: true });
    await cp(srcDir, destDir, { recursive: true });
  }

  await removeObsoleteTopLevelAssets(new Set(topLevelAssets.map(({ destName }) => destName)));
}

async function removeObsoleteTopLevelAssets(allowed) {
  const entries = await readdir(assetsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const shouldKeep = allowed.has(entry.name);
    const isAssetFile = entry.name.endsWith('.js') || entry.name.endsWith('.css');
    if (isAssetFile && !shouldKeep) {
      await rm(path.join(assetsDir, entry.name), { force: true });
    }
  }
}

async function cleanStandalone() {
  await rm(standaloneDir, { recursive: true, force: true });
}

async function main() {
  await ensureBuild();
  await copyBundle();
  await cleanStandalone();
}

main().catch(async (error) => {
  console.error('[build-root-bundle] Failed to prepare root bundle:', error);
  try {
    const logPath = path.join(repoRoot, 'standalone-build-error.log');
    await writeFile(logPath, String(error?.stack ?? error));
  } catch (writeError) {
    console.error('[build-root-bundle] Unable to persist error details:', writeError);
  }
  process.exitCode = 1;
});
