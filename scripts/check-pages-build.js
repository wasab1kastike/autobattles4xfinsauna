#!/usr/bin/env node
import { execSync } from 'node:child_process';

const LIVE_URL = process.env.SAUNA_PAGES_URL?.trim() || 'https://artobest.com/';

function fail(message) {
  console.error(`\n[verify:pages-build] ${message}\n`);
  process.exitCode = 1;
}

function getHeadCommit() {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim()
      .toLowerCase();
  } catch (error) {
    fail('Unable to resolve HEAD commit. Run this script inside a git checkout.');
    if (process.env.DEBUG) {
      console.error(error);
    }
    return null;
  }
}

function isNetworkFailure(error) {
  const err = error instanceof Error ? error : new Error(String(error));
  const cause = err.cause && typeof err.cause === 'object' ? err.cause : null;
  const networkCodes = new Set(['ENOTFOUND', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ETIMEDOUT', 'ENETUNREACH']);
  const message = err.message?.toLowerCase?.() ?? '';
  const fetchFailed = message.includes('fetch failed');
  const causeCode = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
  const causeErrno = cause && typeof cause === 'object' && 'errno' in cause ? cause.errno : undefined;
  const codeIsNetwork =
    (typeof causeCode === 'string' && networkCodes.has(causeCode)) ||
    (typeof causeErrno === 'string' && networkCodes.has(causeErrno));

  return { isNetwork: fetchFailed || codeIsNetwork, causeCode, causeErrno, causeSyscall: cause?.syscall };
}

function appendCacheBust(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}cb=${Date.now()}`;
}

async function fetchText(url) {
  const response = await fetch(appendCacheBust(url), {
    method: 'GET',
    headers: {
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    },
  });

  if (!response.ok) {
    fail(`Request to ${url} returned HTTP ${response.status}.`);
    return null;
  }

  return await response.text();
}

const headCommit = getHeadCommit();
if (!headCommit) {
  process.exit(process.exitCode ?? 1);
}

try {
  const html = await fetchText(LIVE_URL);
  if (!html) {
    process.exit(process.exitCode ?? 1);
  }

  const scriptMatch = html.match(/<script[^>]+src="([^"]*index-[^"]+\.js)"/i);
  if (!scriptMatch) {
    fail('Unable to locate the main bundle reference in the live HTML. The deployed site may be stale.');
    process.exit(process.exitCode ?? 1);
  }

  const scriptUrl = new URL(scriptMatch[1], LIVE_URL).toString();
  const bundleSource = await fetchText(scriptUrl);
  if (!bundleSource) {
    process.exit(process.exitCode ?? 1);
  }

  const commitMatch = bundleSource.match(/"([0-9a-f]{7})"\.trim\(\)/i);
  if (!commitMatch) {
    fail('Unable to locate the embedded commit hash in the live bundle.');
    process.exit(process.exitCode ?? 1);
  }

  const liveCommit = commitMatch[1].toLowerCase();
  if (liveCommit !== headCommit) {
    fail(`Live bundle commit ${liveCommit} does not match HEAD ${headCommit}. Redeploy GitHub Pages.`);
    process.exit(process.exitCode ?? 1);
  }

  console.log(
    `GitHub Pages build is current (commit ${liveCommit}).`
  );
} catch (error) {
  const { isNetwork, causeCode, causeErrno, causeSyscall } = isNetworkFailure(error);
  if (isNetwork) {
    console.warn('Warning: Unable to verify GitHub Pages build because the network request failed.');
    if (causeCode || causeErrno) {
      console.warn(`Network failure details: code=${causeCode ?? 'n/a'}, errno=${causeErrno ?? 'n/a'}.`);
    }
    if (causeSyscall) {
      console.warn(`Network failure syscall: ${causeSyscall}`);
    }
    process.exit(0);
  }

  fail(`Unexpected error while verifying GitHub Pages build: ${error}`);
  if (error && typeof error === 'object') {
    console.error(error);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
