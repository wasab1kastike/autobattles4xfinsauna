import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  root: 'src',
  // Use the repository name as the base path for production builds so assets
  // resolve correctly on GitHub Pages deployments. In development we keep the
  // base at '/' to match the local dev server.
  base: command === 'build' ? '/autobattles4xfinsauna/' : '/',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
}));
