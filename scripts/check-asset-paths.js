import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, '..', 'src');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}

const offending = [];
for (const file of walk(srcDir)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    if (/['"]\/assets\//.test(line)) {
      offending.push(`${relative(srcDir, file)}:${idx + 1}`);
    }
  });
}

if (offending.length) {
  console.error('✗ Found absolute /assets/ paths in the following files:');
  for (const entry of offending) {
    console.error(`  - ${entry}`);
  }
  process.exit(1);
} else {
  console.log('✓ No absolute /assets/ paths found.');
}
