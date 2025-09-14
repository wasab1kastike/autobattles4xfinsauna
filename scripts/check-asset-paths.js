import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

const red = '\x1b[31m';
const green = '\x1b[32m';
const reset = '\x1b[0m';

function scanDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(scanDir(fullPath));
    } else {
      const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (
          line.includes("'/assets/") ||
          line.includes('"/assets/') ||
          line.includes('`/assets/')
        ) {
          results.push(`${fullPath}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
  return results;
}

const matches = scanDir(srcDir);

if (matches.length > 0) {
  console.error(`${red}Found forbidden /assets/ URLs:${reset}`);
  for (const m of matches) {
    console.error(`  ${m}`);
  }
  process.exit(1);
}

console.log(`${green}No forbidden /assets/ URLs found.${reset}`);
