import { defineConfig } from 'vite';
import pkg from './package.json' assert { type: 'json' };
const { name: repoName } = pkg;

export default defineConfig(({ command }) => ({
  root: 'src',
  // Use the repository name as the base path for production builds so that
  // assets resolve correctly on GitHub Pages deployments. In development we
  // keep the base at '/' to match the local dev server.
  base: command === 'build' ? `/${repoName}/` : '/',
  publicDir: '../public',
  build: {
    outDir: '../docs',
    emptyOutDir: true,
  },
}));
