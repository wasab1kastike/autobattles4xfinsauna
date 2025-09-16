import { defineConfig } from 'vite';
import { getShortCommitHash } from './build-info';

const buildCommit = getShortCommitHash();

// Vite configuration
export default defineConfig({
  root: 'src',
  // Ensure assets resolve correctly when hosted on GitHub Pages.
  base: '/autobattles4xfinsauna/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
});
