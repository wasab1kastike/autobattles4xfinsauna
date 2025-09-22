import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

interface SpriteTransform {
  readonly translateX: number;
  readonly translateY: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

interface SpriteCanvasSize {
  readonly width: number;
  readonly height: number;
}

interface SpriteSourceSize {
  readonly width: number | null;
  readonly height: number | null;
}

interface SpriteManifestEntry {
  readonly id: string;
  readonly canvas: SpriteCanvasSize;
  readonly transform: SpriteTransform;
  readonly source: SpriteSourceSize;
}

function parseViewBox(content: string, id: string): SpriteCanvasSize {
  const match = content.match(/viewBox="\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*"/);
  if (!match) {
    throw new Error(`Sprite ${id} is missing a viewBox.`);
  }

  const [, minX, minY, width, height] = match;
  const parsedMinX = Number(minX);
  const parsedMinY = Number(minY);
  if (parsedMinX !== 0 || parsedMinY !== 0) {
    throw new Error(`Sprite ${id} uses a shifted viewBox (${parsedMinX}, ${parsedMinY}). Expected origin at 0,0.`);
  }

  return {
    width: Number(width),
    height: Number(height)
  };
}

function parseTransform(content: string): SpriteTransform {
  const defaultTransform: SpriteTransform = {
    translateX: 0,
    translateY: 0,
    scaleX: 1,
    scaleY: 1
  };

  const match = content.match(/<g[^>]*transform="([^"]+)"[^>]*>/);
  if (!match) {
    return defaultTransform;
  }

  const transform = match[1];
  const translateMatch = transform.match(/translate\(\s*([\d.-]+)\s*,\s*([\d.-]+)\s*\)/);
  const scaleMatch = transform.match(/scale\(\s*([\d.-]+)(?:\s*,\s*([\d.-]+))?\s*\)/);

  const translateX = translateMatch ? Number(translateMatch[1]) : 0;
  const translateY = translateMatch ? Number(translateMatch[2]) : 0;
  const scaleX = scaleMatch ? Number(scaleMatch[1]) : 1;
  const scaleY = scaleMatch ? Number(scaleMatch[2] ?? scaleMatch[1]) : 1;

  return { translateX, translateY, scaleX, scaleY };
}

function deriveSourceSize(canvas: SpriteCanvasSize, transform: SpriteTransform): SpriteSourceSize {
  const { width: canvasWidth, height: canvasHeight } = canvas;
  const { translateX, translateY, scaleX, scaleY } = transform;

  if (scaleX === 0 || scaleY === 0) {
    return { width: null, height: null };
  }

  const sourceWidth = (canvasWidth - translateX * 2) / scaleX;
  const sourceHeight = (canvasHeight - translateY * 2) / scaleY;

  return {
    width: Number.isFinite(sourceWidth) ? Number(sourceWidth.toFixed(3)) : null,
    height: Number.isFinite(sourceHeight) ? Number(sourceHeight.toFixed(3)) : null
  };
}

async function loadSprites(directory: string): Promise<SpriteManifestEntry[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const svgFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const manifestEntries: SpriteManifestEntry[] = [];
  for (const file of svgFiles) {
    const filePath = path.join(directory, file);
    const id = path.basename(file, '.svg');
    const content = await readFile(filePath, 'utf8');

    const canvas = parseViewBox(content, id);
    const transform = parseTransform(content);
    const source = deriveSourceSize(canvas, transform);

    manifestEntries.push({
      id,
      canvas,
      transform,
      source
    });
  }

  return manifestEntries;
}

async function writeManifest(manifestPath: string, entries: SpriteManifestEntry[]): Promise<void> {
  const manifest = {
    generatedAt: new Date().toISOString(),
    sprites: entries
  };

  const payload = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, payload, 'utf8');
}

async function main(): Promise<void> {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const root = path.resolve(scriptDir, '..');
  const spriteDir = path.join(root, 'assets', 'sprites');
  const manifestPath = path.join(spriteDir, 'manifest.json');

  try {
    const entries = await loadSprites(spriteDir);
    await writeManifest(manifestPath, entries);
    console.log(`Exported ${entries.length} sprite definitions to ${path.relative(root, manifestPath)}.`);
  } catch (error) {
    console.error('Failed to export sprite metadata:', error);
    process.exitCode = 1;
  }
}

void main();
