import type { SpriteSize } from './sprite_map.ts';

export interface SpriteAtlasSlice {
  readonly id: string;
  readonly sx: number;
  readonly sy: number;
  readonly sw: number;
  readonly sh: number;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export interface UnitSpriteAtlas {
  readonly canvas: HTMLCanvasElement | OffscreenCanvas;
  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly slices: Record<string, SpriteAtlasSlice>;
}

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

type AtlasSource = CanvasImageSource | null | undefined;

type SourceSize = SpriteSize & { area: number };

type SourceEntry = {
  key: string;
  source: CanvasImageSource;
  size: SourceSize;
};

function resolveSourceSize(source: CanvasImageSource): SourceSize | null {
  const candidate = source as Partial<{
    width: number;
    height: number;
    naturalWidth: number;
    naturalHeight: number;
  }>;
  const width = typeof candidate.naturalWidth === 'number' && candidate.naturalWidth > 0
    ? candidate.naturalWidth
    : typeof candidate.width === 'number'
      ? candidate.width
      : 0;
  const height = typeof candidate.naturalHeight === 'number' && candidate.naturalHeight > 0
    ? candidate.naturalHeight
    : typeof candidate.height === 'number'
      ? candidate.height
      : 0;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }
  return {
    width,
    height,
    area: width * height
  } satisfies SourceSize;
}

function nextPowerOfTwo(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }
  const exponent = Math.ceil(Math.log2(value));
  return 2 ** Math.max(0, exponent);
}

function createAtlasCanvas(width: number, height: number): HTMLCanvasElement | OffscreenCanvas | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  return null;
}

function getContext(canvas: HTMLCanvasElement | OffscreenCanvas): Canvas2DContext | null {
  if (typeof (canvas as { getContext?: unknown }).getContext !== 'function') {
    return null;
  }
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext('2d');
  if (!ctx || typeof ctx !== 'object') {
    return null;
  }
  return ctx as Canvas2DContext;
}

export interface BuildUnitSpriteAtlasOptions {
  readonly padding?: number;
}

export function buildUnitSpriteAtlas(
  sources: Record<string, AtlasSource>,
  options?: BuildUnitSpriteAtlasOptions
): UnitSpriteAtlas | null {
  const entries: SourceEntry[] = [];
  for (const [key, candidate] of Object.entries(sources)) {
    if (!candidate || !key.startsWith('unit-')) {
      continue;
    }
    const size = resolveSourceSize(candidate);
    if (!size) {
      continue;
    }
    entries.push({ key, source: candidate, size });
  }

  if (entries.length === 0) {
    return null;
  }

  const padding = Math.max(0, Math.floor(options?.padding ?? 2));
  entries.sort((a, b) => b.size.height - a.size.height || b.size.width - a.size.width);
  const totalArea = entries.reduce((sum, entry) => sum + entry.size.area, 0);
  const widest = entries.reduce((max, entry) => Math.max(max, entry.size.width), 0);
  const targetRowWidth = Math.max(widest + padding * 2, Math.ceil(Math.sqrt(totalArea)));

  let cursorX = padding;
  let cursorY = padding;
  let rowHeight = 0;
  let maxX = 0;

  interface PlacementRecord {
    entry: SourceEntry;
    sx: number;
    sy: number;
  }

  const placements: PlacementRecord[] = [];

  for (const entry of entries) {
    if (cursorX + entry.size.width + padding > targetRowWidth && rowHeight > 0) {
      cursorY += rowHeight + padding;
      cursorX = padding;
      rowHeight = 0;
    }
    placements.push({ entry, sx: cursorX, sy: cursorY });
    cursorX += entry.size.width + padding;
    rowHeight = Math.max(rowHeight, entry.size.height);
    maxX = Math.max(maxX, cursorX);
  }

  const rawWidth = Math.max(maxX, cursorX) + padding;
  const rawHeight = cursorY + rowHeight + padding;
  const width = nextPowerOfTwo(Math.ceil(rawWidth));
  const height = nextPowerOfTwo(Math.ceil(rawHeight));
  const canvas = createAtlasCanvas(width, height);
  if (!canvas) {
    return null;
  }
  if ('width' in canvas) {
    canvas.width = width;
  }
  if ('height' in canvas) {
    canvas.height = height;
  }
  const ctx = getContext(canvas);
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    if ('imageSmoothingEnabled' in ctx) {
      ctx.imageSmoothingEnabled = true;
    }
    if ('imageSmoothingQuality' in ctx) {
      try {
        (ctx as CanvasRenderingContext2D).imageSmoothingQuality = 'high';
      } catch {
        // Ignore environments that do not support imageSmoothingQuality.
      }
    }
  }

  const slices: Record<string, SpriteAtlasSlice> = {};
  for (const placement of placements) {
    const { entry, sx, sy } = placement;
    if (ctx) {
      try {
        ctx.drawImage(entry.source, sx, sy, entry.size.width, entry.size.height);
      } catch (error) {
        console.warn('Failed to draw sprite into atlas', { key: entry.key, error });
      }
    }
    slices[entry.key] = {
      id: entry.key,
      sx,
      sy,
      sw: entry.size.width,
      sh: entry.size.height,
      u0: sx / width,
      v0: sy / height,
      u1: (sx + entry.size.width) / width,
      v1: (sy + entry.size.height) / height
    } satisfies SpriteAtlasSlice;
  }

  return {
    canvas,
    width,
    height,
    padding,
    slices
  } satisfies UnitSpriteAtlas;
}

export function getAtlasSlice(
  atlas: UnitSpriteAtlas | null | undefined,
  key: string
): SpriteAtlasSlice | null {
  if (!atlas) {
    return null;
  }
  return atlas.slices[key] ?? null;
}
