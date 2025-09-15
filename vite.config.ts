import { defineConfig } from 'vite';

// Vite configuration
export default defineConfig({
  root: 'src',
  // Use an absolute base path so built assets resolve from the site root.
  // This ensures asset URLs remain correct in production deployments.
  base: '/autobattles4xfinsauna/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
