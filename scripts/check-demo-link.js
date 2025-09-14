import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const readmePath = join(__dirname, '..', 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const expected = 'https://wasab1kastike.github.io/autobattles4xfinsauna/?utm_source=chatgpt.com';

if (!readme.includes(expected)) {
  console.error(`README Live demo link must be ${expected}`);
  process.exit(1);
}
