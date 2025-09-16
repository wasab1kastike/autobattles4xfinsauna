import { execSync } from 'node:child_process';

export function getShortCommitHash(): string {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch (error) {
    console.warn('Unable to resolve git commit hash:', error);
    return 'unknown';
  }
}
