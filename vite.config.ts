import { defineConfig } from 'vite';

// Vite configuration
export default defineConfig({
  root: 'src',
  // Use the repository name as the base path so assets resolve correctly on
  // GitHub Pages deployments. Development runs off the same base to simplify
  // local testing.
  base: '/autobattles4xfinsauna/', // DO NOT CHANGE
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
