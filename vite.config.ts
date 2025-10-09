import { execSync } from 'node:child_process';
import { extname, posix } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

let resolvedCommit: string | null = null;

const sourceCommit = process.env.SOURCE_COMMIT?.trim();
if (sourceCommit && /^[0-9a-f]{7,40}$/i.test(sourceCommit)) {
  resolvedCommit = sourceCommit.slice(0, 7).toLowerCase();
}

if (!resolvedCommit) {
  try {
    const commit = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();

    if (commit) {
      resolvedCommit = commit;
    }
  } catch (error) {
    console.warn('Unable to resolve git commit hash:', error);
  }
}

const GIT_COMMIT = JSON.stringify(resolvedCommit ?? 'unknown');

const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.GITHUB_ACTIONS;

const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);

const rawBasePath =
  process.env.PUBLIC_BASE_PATH ??
  process.env.BASE_PATH ??
  process.env.VITE_BASE_PATH ??
  process.env.VITE_BASE ??
  '';

const normalizeBase = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '/';
  }

  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
};

const deploymentBase = normalizeBase(rawBasePath);

// Vite configuration
export default defineConfig({
  root: 'src',
  // Resolve the base path dynamically so root-domain deployments default to '/'.
  base: isLocalDev ? '/' : deploymentBase,
  publicDir: '../public',
  plugins: [tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const extension = extname(assetInfo.name ?? '').toLowerCase();

          if (RASTER_EXTENSIONS.has(extension)) {
            const originalDir = assetInfo.name ? posix.dirname(assetInfo.name) : '';
            const normalizedDir = originalDir && originalDir !== '.' ? `${originalDir}/` : '';
            return `assets/${normalizedDir}[name][extname]`;
          }

          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  define: {
    __COMMIT__: GIT_COMMIT,
  },
});
