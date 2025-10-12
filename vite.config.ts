import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { getShortCommitHash } from './build-info';

const commitHash = getShortCommitHash();

// https://vitejs.dev/config/
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base: '/', // custom domain at root
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __COMMIT__: JSON.stringify(commitHash),
  },
});
