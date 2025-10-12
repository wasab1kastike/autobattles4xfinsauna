import { execSync } from 'node:child_process';

function normalizeCommit(input: string | undefined | null): string | null {
  const trimmed = input?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[0-9a-f]{7,40}$/i.test(trimmed)) {
    return trimmed.slice(0, 7).toLowerCase();
  }

  return null;
}

export function getShortCommitHash(): string {
  const fromEnv = normalizeCommit(process.env.SOURCE_COMMIT);
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const fromGit = execSync('git rev-parse --short HEAD')
      .toString()
      .trim();
    const normalized = normalizeCommit(fromGit);
    if (normalized) {
      return normalized;
    }
  } catch (error) {
    console.warn('Unable to resolve git commit hash:', error);
  }

  return 'unknown';
}
