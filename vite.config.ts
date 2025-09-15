import { defineConfig } from 'vite';

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
});
