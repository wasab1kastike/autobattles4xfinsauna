import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readmePath = join(__dirname, '..', 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const demoUrl =
  'https://wasab1kastike.github.io/autobattles4xfinsauna/?utm_source=chatgpt.com';
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
  console.error(`Failed to fetch live demo: ${err}`);
  process.exit(1);
}
