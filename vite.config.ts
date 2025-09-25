import { execSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

let GIT_COMMIT = JSON.stringify('unknown');

try {
  const commit = execSync('git rev-parse --short HEAD', {
    stdio: ['ignore', 'pipe', 'ignore'],
  })
    .toString()
    .trim();

  if (commit) {
    GIT_COMMIT = JSON.stringify(commit);
  }
} catch (error) {
  console.warn('Unable to resolve git commit hash:', error);
}

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
