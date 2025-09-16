import { defineConfig } from 'vite';
import { getShortCommitHash } from './build-info';

const GIT_COMMIT = JSON.stringify(getShortCommitHash());

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
    __COMMIT__: GIT_COMMIT,
  },
});
