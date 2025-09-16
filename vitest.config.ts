import { defineConfig } from 'vitest/config';
import { getShortCommitHash } from './build-info';

const GIT_COMMIT = JSON.stringify(getShortCommitHash());

export default defineConfig({
  define: {
    __COMMIT__: GIT_COMMIT,
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
