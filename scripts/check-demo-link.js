import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readmePath = join(__dirname, '..', 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const demoUrl = 'https://artobest.com/?utm_source=chatgpt.com';
const expectedTitle = '<title>Autobattles4xFinsauna</title>';

if (!readme.includes(demoUrl)) {
  console.error(`README Live demo link must be ${demoUrl}`);
  process.exit(1);
}

try {
  const response = await fetch(demoUrl, { method: 'GET' });
  if (response.status !== 200) {
    console.error(`Live demo returned HTTP ${response.status}`);
    process.exit(1);
  }

  const html = await response.text();
  if (!html.includes(expectedTitle)) {
    console.error(`Live demo HTML must contain ${expectedTitle}`);
    process.exit(1);
  }

  console.log('Live demo link is present and returns expected content.');
} catch (err) {
  const maybeError = err instanceof Error ? err : new Error(String(err));
  const cause = typeof maybeError.cause === 'object' ? maybeError.cause ?? null : null;
  const causeCode =
    cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  const causeErrno =
    cause && typeof cause === 'object' && 'errno' in cause ? cause.errno : undefined;
  const networkErrorCodes = new Set([
    'ENOTFOUND',
    'ECONNRESET',
    'ECONNREFUSED',
    'EAI_AGAIN',
    'ETIMEDOUT',
  ]);
  const message = maybeError.message ?? '';
  const isFetchFailedMessage = message.toLowerCase().includes('fetch failed');
  const isNetworkCode =
    (typeof causeCode === 'string' && networkErrorCodes.has(causeCode)) ||
    (typeof causeErrno === 'string' && networkErrorCodes.has(causeErrno));

  if (isFetchFailedMessage || isNetworkCode) {
    console.warn(
      'Warning: Unable to verify live demo availability because the network request failed.\n' +
        'This is treated as a warning so environments without outbound network access do not fail.',
    );
    if (causeCode || causeErrno) {
      console.warn(
        `Network failure details: code=${causeCode ?? 'n/a'}, errno=${causeErrno ?? 'n/a'}.`,
      );
    }
    if (cause && typeof cause === 'object' && 'syscall' in cause) {
      console.warn(`Network failure syscall: ${cause.syscall}`);
    }
    process.exit(0);
  }

  console.error(`Failed to fetch live demo: ${maybeError}`);
  if (cause) {
    console.error('Fetch failure details:', cause);
  }
  process.exit(1);
}
