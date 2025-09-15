import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export default defineConfig({
  root: path.resolve(repoRoot, 'src'),
  base: './',
  publicDir: path.resolve(repoRoot, 'public'),
  build: {
    outDir: path.resolve(repoRoot, 'standalone'),
    emptyOutDir: true,
    manifest: false,
    rollupOptions: {
      input: path.resolve(repoRoot, 'src/main.ts'),
      output: {
        entryFileNames: 'main.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'assets/game.css';
          }
          return 'assets/[name][extname]';
        },
      },
    },
  },
});
