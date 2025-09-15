import { defineConfig } from 'vite';

// Vite configuration
export default defineConfig({
  root: 'src',
  // Use a relative base path so built assets resolve correctly no matter where
  // the site is served from. Development runs off the same base to simplify
  // local testing.
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
