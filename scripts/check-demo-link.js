#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

const demoUrl = 'https://wasab1kastike.github.io/autobattles4xfinsauna/?utm_source=chatgpt.com';

// Verify README contains the expected demo URL
const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
if (!readme.includes(demoUrl)) {
  console.error('README does not contain the expected demo link.');
  process.exit(1);
}

// Ensure the URL responds with HTTP 200
try {
  const res = await fetch(demoUrl, { method: 'HEAD' });
  if (!res.ok) {
    console.error(`Demo link returned status ${res.status}.`);
    process.exit(1);
  }
  console.log('Demo link is reachable.');
} catch (err) {
  console.error('Failed to fetch demo link:', err.message);
  process.exit(1);
}
