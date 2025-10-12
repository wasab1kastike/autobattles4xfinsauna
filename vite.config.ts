import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { getShortCommitHash } from './build-info';

const commitHash = getShortCommitHash();

function isAbsoluteUrl(candidate: string): boolean {
  try {
    const parsed = new URL(candidate);
    return Boolean(parsed.protocol && parsed.host);
  } catch (error) {
    return false;
  }
}

function ensureTrailingSlash(input: string): string {
  return input.endsWith('/') ? input : `${input}/`;
}

function normalizeBasePath(candidate: string | undefined | null): string | null {
  const trimmed = candidate?.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed === '.' || trimmed === './') {
    return './';
  }

  if (trimmed.startsWith('./')) {
    return ensureTrailingSlash(trimmed);
  }

  if (isAbsoluteUrl(trimmed)) {
    return ensureTrailingSlash(trimmed);
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed.replace(/^\/+/, '')}`;
  const collapsed = normalized.replace(/\/{2,}/g, '/');
  return ensureTrailingSlash(collapsed);
}

function resolveRepositoryBase(repo: string | undefined | null): string | null {
  const trimmed = repo?.trim();
  if (!trimmed) {
    return null;
  }

  const parts = trimmed.split('/');
  const slug = parts.pop();
  if (!slug) {
    return null;
  }

  return normalizeBasePath(slug);
}

function resolveBasePath(): string {
  const explicit =
    normalizeBasePath(process.env.PUBLIC_BASE_PATH) ||
    normalizeBasePath(process.env.BASE_PATH) ||
    normalizeBasePath(process.env.VITE_BASE_PATH) ||
    normalizeBasePath(process.env.VITE_BASE);

  if (explicit) {
    return explicit;
  }

  const fromRepo = resolveRepositoryBase(process.env.GITHUB_REPOSITORY);
  if (fromRepo) {
    return fromRepo;
  }

  return '/';
}

const base = resolveBasePath();

// https://vitejs.dev/config/
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  base,
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __COMMIT__: JSON.stringify(commitHash),
  },
});
