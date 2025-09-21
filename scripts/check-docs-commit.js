#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const currentDir = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(currentDir, '..');
const docsAssetsDir = join(projectRoot, 'docs', 'assets');

function fail(message) {
  console.error(`\n[verify:docs] ${message}\n`);
  process.exitCode = 1;
}

function getCurrentCommit() {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim();
  } catch (error) {
    fail('Unable to resolve the current git commit. Ensure this script runs inside a git checkout.');
    if (process.env.DEBUG) {
      console.error(error);
    }
    return 'unknown';
  }
}

function collectDocsBundles() {
  try {
    return readdirSync(docsAssetsDir)
      .filter((name) => /^index-.*\.js$/.test(name))
      .map((name) => join(docsAssetsDir, name));
  } catch (error) {
    fail('Unable to read docs/assets. Run `npm run build` to regenerate the published mirror.');
    if (process.env.DEBUG) {
      console.error(error);
    }
    return [];
  }
}

function extractCommitFromBundle(bundlePath) {
  const source = readFileSync(bundlePath, 'utf8');
  const commitFromBuildBadge = source.match(/\[data-build-commit][^]*?const\s+\w+\s*=\s*"([^"]+)"\.trim\(\)/);
  if (commitFromBuildBadge) {
    return commitFromBuildBadge[1];
  }
  const fallback = source.match(/"([0-9a-f]{7})"/);
  if (fallback) {
    return fallback[1];
  }
  return null;
}

const bundles = collectDocsBundles();
if (bundles.length === 0) {
  fail('No docs/assets/index-*.js bundle found. Run `npm run build` to refresh docs/.');
}

let docsCommit = null;
for (const bundle of bundles) {
  docsCommit = extractCommitFromBundle(bundle);
  if (docsCommit) {
    break;
  }
}

if (!docsCommit) {
  fail('Unable to locate the embedded commit hash in the docs bundle. Run `npm run build` to refresh docs/.');
}

const currentCommit = getCurrentCommit();
if (currentCommit === 'unknown') {
  // We already emitted a failure message when falling back, so bail early.
  process.exit(process.exitCode ?? 1);
}

const acceptableCommits = new Set([currentCommit]);
for (const depth of [1, 2, 3]) {
  try {
    const parentRef = depth === 1 ? 'HEAD^' : `HEAD~${depth}`;
    const parentCommit = execSync(`git rev-parse --short ${parentRef}`, {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .toString()
      .trim();
    if (parentCommit) {
      acceptableCommits.add(parentCommit);
    }
  } catch (error) {
    if (process.env.DEBUG) {
      console.warn(`Unable to resolve ${depth === 1 ? 'first' : 'second'} parent when verifying docs commit.`, error);
    }
    break;
  }
}

if (docsCommit && !acceptableCommits.has(docsCommit)) {
  const expected = Array.from(acceptableCommits).join(' or ');
  fail(`Docs bundle commit ${docsCommit} does not match HEAD ${expected}. Run \`npm run build\` to refresh docs/.`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
