import { defineConfig } from 'vite';
import pkg from './package.json' assert { type: 'json' };

export default defineConfig(({ command }) => ({
  base: command === 'build' && pkg.homepage
    ? new URL(pkg.homepage).pathname
    : '/',
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
}));
