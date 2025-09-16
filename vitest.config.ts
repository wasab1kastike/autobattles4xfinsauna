import { defineConfig } from 'vitest/config';
import { getShortCommitHash } from './build-info';

const buildCommit = getShortCommitHash();

export default defineConfig({
  define: {
    __BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
