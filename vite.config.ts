import { execSync } from 'node:child_process';
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

// Vite configuration
export default defineConfig({
  root: 'src',
  // Ensure assets resolve correctly when hosted on GitHub Pages.
  base: '/',
  publicDir: '../public',
  plugins: [tailwindcss()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __COMMIT__: GIT_COMMIT,
  },
});
