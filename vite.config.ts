import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { getShortCommitHash } from './build-info';

const commitHash = getShortCommitHash();
const ROOT_DIR = dirname(fileURLToPath(import.meta.url));
const PUBLIC_CNAME_PATH = join(ROOT_DIR, 'public', 'CNAME');

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

type HomepageResolution = {
  base: string | null;
  absolute: boolean;
};

function resolveHomepageBase(): HomepageResolution {
  try {
    const packageJsonPath = join(ROOT_DIR, 'package.json');
    const raw = readFileSync(packageJsonPath, 'utf8');
    const parsed = JSON.parse(raw) as { homepage?: unknown };
    const homepage = typeof parsed.homepage === 'string' ? parsed.homepage.trim() : null;

    if (!homepage) {
      return { base: null, absolute: false };
    }

    if (isAbsoluteUrl(homepage)) {
      try {
        const url = new URL(homepage);
        const path = ensureTrailingSlash(url.pathname || '/');
        return { base: path, absolute: true };
      } catch (error) {
        console.warn('Failed to parse homepage URL, defaulting base path to root.', error);
        return { base: '/', absolute: true };
      }
    }

    return { base: normalizeBasePath(homepage), absolute: false };
  } catch (error) {
    console.warn('Unable to read package homepage for base path resolution.', error);
    return { base: null, absolute: false };
  }
}

function hasCustomDomainIndicator(): boolean {
  return existsSync(PUBLIC_CNAME_PATH);
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

  const homepage = resolveHomepageBase();

  if (homepage.base) {
    return homepage.base;
  }

  if (homepage.absolute || hasCustomDomainIndicator()) {
    return '/';
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
