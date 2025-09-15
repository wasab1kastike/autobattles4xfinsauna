import { defineConfig } from 'vite';

// Vite configuration
export default defineConfig({
  root: 'src',
  // Use a relative base path so assets resolve correctly regardless of hosting
  // directory. Development runs off the same base to simplify local testing.
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
