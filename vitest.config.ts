import { defineConfig } from 'vitest/config';
import { getShortCommitHash } from './build-info';

const gitCommit = getShortCommitHash();

export default defineConfig({
  define: {
    __COMMIT__: JSON.stringify(gitCommit),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
  },
});
