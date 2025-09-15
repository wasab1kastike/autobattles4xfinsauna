import { defineConfig } from 'vite';

// Vite configuration
export default defineConfig({
  root: 'src',
  // Use a relative base path so built assets resolve no matter where the site
  // is hosted. This allows GitHub Pages and local previews to load assets
  // correctly without needing the repository name in the URL.
  base: './',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
