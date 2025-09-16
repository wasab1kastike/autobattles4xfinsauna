import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cp, rm, stat, copyFile, writeFile } from 'node:fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const docsDir = path.join(repoRoot, 'docs');

async function ensureDistBuild() {
  try {
    const stats = await stat(distDir);
    if (!stats.isDirectory()) {
      throw new Error(`Expected ${distDir} to be a directory`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Production build output was not found. Run "vite build" before syncing docs.',
      );
    }
    throw error;
  }
}

async function refreshDocsFromDist() {
  await rm(docsDir, { recursive: true, force: true });
  await cp(distDir, docsDir, { recursive: true });
}

async function ensureSpaFallback() {
  const indexPath = path.join(docsDir, 'index.html');
  const fallbackPath = path.join(docsDir, '404.html');

  try {
    const stats = await stat(indexPath);
    if (!stats.isFile()) {
      throw new Error(`Expected ${indexPath} to be a file`);
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      throw new Error('Docs index was not generated, cannot create SPA fallback.');
    }
    throw error;
  }

  await copyFile(indexPath, fallbackPath);
}

async function removeLegacyRootFallback() {
  const rootFallbackPath = path.join(repoRoot, '404.html');
  await rm(rootFallbackPath, { force: true });
}

async function ensureNoJekyll() {
  const nojekyllPath = path.join(docsDir, '.nojekyll');
  await writeFile(nojekyllPath, '', { flag: 'w' });
}

async function main() {
  await ensureDistBuild();
  await refreshDocsFromDist();
  await ensureSpaFallback();
  await ensureNoJekyll();
  await removeLegacyRootFallback();
}

main().catch((error) => {
  console.error('[sync-docs] Failed to refresh GitHub Pages bundle:', error);
  process.exitCode = 1;
});
