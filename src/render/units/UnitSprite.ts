import type { Unit } from '../../unit/index.ts';
import { getFactionPalette } from '../../theme/factionPalette.ts';
import type { SpritePlacement, SpritePlacementInput } from './draw.ts';
import { getSpritePlacement } from './draw.ts';
import { snapForZoom } from '../zoom.ts';
import type { PixelCoord } from '../../hex/HexUtils.ts';
import type { SpriteAtlasSlice } from './spriteAtlas.ts';

export interface UnitSpriteFootprint {
  readonly centerX: number;
  readonly centerY: number;
  readonly radiusX: number;
  readonly radiusY: number;
  readonly top: number;
  readonly bottom: number;
}

export interface UnitSpriteRenderResult {
  readonly placement: SpritePlacement;
  readonly center: { x: number; y: number };
  readonly footprint: UnitSpriteFootprint;
}

export interface UnitSelectionState {
  readonly isSelected?: boolean;
  readonly isPrimary?: boolean;
}

export interface DrawUnitSpriteOptions {
  readonly placement: SpritePlacementInput;
  readonly sprite: CanvasImageSource | null | undefined;
  readonly atlas?: CanvasImageSource | null;
  readonly slice?: SpriteAtlasSlice | null;
  readonly renderSprite?: boolean;
  readonly precomputedPlacement?: SpritePlacement | null;
  readonly faction?: Unit['faction'];
  readonly motionStrength?: number;
  readonly cameraZoom?: number;
  readonly selection?: UnitSelectionState;
  readonly anchorHint?: PixelCoord | null;
  readonly offset?: PixelCoord | null;
  readonly drawBase?: boolean;
}

interface GradientLike {
  addColorStop(offset: number, color: string): void;
}

type AnyRenderingContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

interface CachedBaseCanvas {
  readonly canvas: CanvasImageSource;
  readonly width: number;
  readonly height: number;
}

const baseCanvasCache = new Map<string, CachedBaseCanvas>();

const BOSS_SPRITE_SCALE = 1.18;
const BOSS_BASE_HEX_SCALE = 1.08;
const BOSS_AURA_RADIUS_SCALE_X = 1.45;
const BOSS_AURA_RADIUS_SCALE_Y = 1.62;

function createOffscreenCanvas(
  width: number,
  height: number
): { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: AnyRenderingContext2D } | null {
  if (width <= 0 || height <= 0) {
    return null;
  }

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      return { canvas, ctx };
    }
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  return { canvas, ctx };
}

function createGradientSafe(
  create: () => CanvasGradient | null,
  fallbackColor: string
): [CanvasGradient | null, string] {
  try {
    const gradient = create();
    if (gradient) {
      return [gradient, ''];
    }
  } catch (error) {
    console.warn('Failed to create canvas gradient', error);
  }
  return [null, fallbackColor];
}

function clonePlacement(placement: SpritePlacement): SpritePlacement {
  return {
    drawX: placement.drawX,
    drawY: placement.drawY,
    width: placement.width,
    height: placement.height,
    centerX: placement.centerX,
    centerY: placement.centerY,
    metadata: placement.metadata
  } satisfies SpritePlacement;
}

function applyStops(gradient: GradientLike | null, stops: Array<[number, string]>): void {
  if (!gradient) {
    return;
  }
  for (const [offset, color] of stops) {
    try {
      gradient.addColorStop(offset, color);
    } catch (error) {
      console.warn('Failed to add gradient stop', { offset, color, error });
    }
  }
}

function resolveBasePalette(
  faction: string | undefined,
  selection: UnitSelectionState | undefined,
  motionStrength: number
): {
  shell: string;
  mid: string;
  rim: string;
  highlight: string;
  ring: string;
  motionGlow: string;
} {
  const normalizedMotion = Math.min(1, Math.max(0, motionStrength));
  const glowOpacity = 0.12 + normalizedMotion * 0.38;
  const normalizedFaction = faction?.toLowerCase?.();
  const neutralPalette = {
    shell: 'rgba(36, 36, 42, 0.9)',
    mid: 'rgba(56, 56, 68, 0.92)',
    rim: 'rgba(198, 198, 210, 0.55)',
    highlight: 'rgba(220, 220, 238, 0.4)',
    ring: 'rgba(140, 140, 160, 0.5)',
    motionGlow: `rgba(210, 210, 230, ${glowOpacity.toFixed(3)})`
  } as const;

  const palette = normalizedFaction === 'player'
    ? getFactionPalette('player', glowOpacity)
    : normalizedFaction === 'enemy'
      ? getFactionPalette('enemy', glowOpacity)
      : neutralPalette;

  if (selection?.isSelected) {
    const emphasis = selection.isPrimary ? 0.95 : 0.7;
    return {
      shell: palette.shell,
      mid: palette.mid,
      rim: `rgba(255, 255, 255, ${(0.35 + emphasis * 0.25).toFixed(3)})`,
      highlight: `rgba(255, 255, 255, ${(0.25 + emphasis * 0.35).toFixed(3)})`,
      ring: `rgba(255, 255, 255, ${(0.4 + emphasis * 0.35).toFixed(3)})`,
      motionGlow: palette.motionGlow
    };
  }

  return palette;
}

function drawBase(
  ctx: CanvasRenderingContext2D,
  placement: SpritePlacement,
  hexSize: number,
  zoom: number,
  palette: ReturnType<typeof resolveBasePalette>,
  renderBase: boolean
): UnitSpriteFootprint {
  const radiusX = snapForZoom(hexSize * 0.78, zoom);
  const radiusY = snapForZoom(hexSize * 0.34, zoom);
  const bottomOffset = snapForZoom(Math.max(hexSize * 0.18, radiusY * 0.6), zoom);
  const bottomY = placement.drawY + placement.height;
  const centerX = placement.centerX;
  const centerY = bottomY - bottomOffset + radiusY * 0.2;

  const footprint = {
    centerX,
    centerY,
    radiusX,
    radiusY,
    top: centerY - radiusY,
    bottom: centerY + radiusY
  } satisfies UnitSpriteFootprint;

  if (!renderBase) {
    return footprint;
  }

  const cachedBase = getCachedBaseCanvas(radiusX, radiusY, zoom, palette);
  if (cachedBase) {
    const drawX = centerX - cachedBase.width / 2;
    const drawY = centerY - cachedBase.height / 2;
    ctx.drawImage(cachedBase.canvas, drawX, drawY, cachedBase.width, cachedBase.height);
    return footprint;
  }

  paintUnitBase(ctx, centerX, centerY, radiusX, radiusY, zoom, palette);

  return footprint;
}

function paintUnitBase(
  ctx: AnyRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  zoom: number,
  palette: ReturnType<typeof resolveBasePalette>
): void {
  ctx.save();
  ctx.filter = 'none';

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);

  const [shellGradient, shellFallback] = createGradientSafe(
    () => ctx.createLinearGradient(centerX, centerY - radiusY, centerX, centerY + radiusY),
    palette.shell
  );
  applyStops(shellGradient, [
    [0, palette.highlight],
    [0.55, palette.mid],
    [1, palette.shell]
  ]);
  ctx.fillStyle = shellGradient ?? shellFallback;
  ctx.fill();

  ctx.globalCompositeOperation = 'multiply';
  const [shadowGradient, shadowFallback] = createGradientSafe(
    () =>
      ctx.createRadialGradient(
        centerX,
        centerY + radiusY * 0.4,
        radiusY * 0.35,
        centerX,
        centerY + radiusY * 0.4,
        radiusY * 1.4
      ),
    'rgba(24, 26, 32, 0.55)'
  );
  applyStops(shadowGradient, [
    [0, palette.motionGlow],
    [0.45, 'rgba(22, 26, 36, 0.7)'],
    [1, 'rgba(18, 22, 30, 0)']
  ]);
  ctx.fillStyle = shadowGradient ?? shadowFallback;
  ctx.fill();

  ctx.globalCompositeOperation = 'screen';
  const [highlightGradient, highlightFallback] = createGradientSafe(
    () =>
      ctx.createRadialGradient(
        centerX,
        centerY - radiusY * 0.65,
        radiusY * 0.1,
        centerX,
        centerY,
        radiusY * 1.25
      ),
    palette.highlight
  );
  applyStops(highlightGradient, [
    [0, palette.highlight],
    [0.6, 'rgba(255, 255, 255, 0.14)'],
    [1, 'rgba(255, 255, 255, 0)']
  ]);
  ctx.fillStyle = highlightGradient ?? highlightFallback;
  ctx.fill();

  ctx.restore();

  ctx.save();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX * 0.99, radiusY * 0.95, 0, 0, Math.PI * 2);
  ctx.strokeStyle = palette.rim;
  ctx.lineWidth = snapForZoom(Math.max(2.4, zoom * 1.8), zoom);
  ctx.shadowColor = palette.highlight;
  ctx.shadowBlur = snapForZoom(Math.max(6, zoom * 3.2), zoom);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.filter = 'none';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX * 0.94, radiusY * 0.9, 0, 0, Math.PI * 2);
  ctx.strokeStyle = palette.ring;
  ctx.lineWidth = snapForZoom(Math.max(1.6, zoom * 1.15), zoom);
  ctx.stroke();
  ctx.restore();
}

function formatCacheNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toFixed(3);
}

function getBaseCacheKey(
  radiusX: number,
  radiusY: number,
  zoom: number,
  palette: ReturnType<typeof resolveBasePalette>
): string {
  return [
    formatCacheNumber(radiusX),
    formatCacheNumber(radiusY),
    formatCacheNumber(zoom),
    palette.shell,
    palette.mid,
    palette.rim,
    palette.highlight,
    palette.ring,
    palette.motionGlow
  ].join('|');
}

function getCachedBaseCanvas(
  radiusX: number,
  radiusY: number,
  zoom: number,
  palette: ReturnType<typeof resolveBasePalette>
): CachedBaseCanvas | null {
  const key = getBaseCacheKey(radiusX, radiusY, zoom, palette);
  const cached = baseCanvasCache.get(key);
  if (cached) {
    return cached;
  }

  const rimLineWidth = snapForZoom(Math.max(2.4, zoom * 1.8), zoom);
  const rimShadowBlur = snapForZoom(Math.max(6, zoom * 3.2), zoom);
  const ringLineWidth = snapForZoom(Math.max(1.6, zoom * 1.15), zoom);
  const margin = Math.ceil(rimShadowBlur + Math.max(rimLineWidth, ringLineWidth) + 6);
  const width = Math.max(1, Math.ceil(radiusX * 2 + margin * 2));
  const height = Math.max(1, Math.ceil(radiusY * 2 + margin * 2));

  const offscreen = createOffscreenCanvas(width, height);
  if (!offscreen) {
    return null;
  }

  const { canvas, ctx } = offscreen;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const centerX = width / 2;
  const centerY = height / 2;
  paintUnitBase(ctx, centerX, centerY, radiusX, radiusY, zoom, palette);

  const entry: CachedBaseCanvas = { canvas, width, height };
  baseCanvasCache.set(key, entry);
  return entry;
}

function applyBossSpriteScale(placement: SpritePlacement): void {
  const anchor = placement.metadata.anchor;
  const bottom = placement.drawY + placement.height;
  const scaledWidth = placement.width * BOSS_SPRITE_SCALE;
  const scaledHeight = placement.height * BOSS_SPRITE_SCALE;
  const centerX = placement.centerX;

  placement.width = scaledWidth;
  placement.height = scaledHeight;
  placement.drawX = centerX - scaledWidth * anchor.x;
  placement.drawY = bottom - scaledHeight;
  placement.centerX = centerX;
  placement.centerY = placement.drawY + scaledHeight * anchor.y;
}

function resolveBossAuraPalette(
  faction: string | undefined,
  motionStrength: number
): {
  core: string;
  inner: string;
  halo: string;
  outer: string;
  ring: string;
  shadow: string;
} {
  const normalizedFaction = faction?.toLowerCase?.() ?? '';
  const clampedMotion = Math.min(1, Math.max(0, motionStrength));
  const emphasis = 0.62 + clampedMotion * 0.34;

  if (normalizedFaction === 'player') {
    return {
      core: `rgba(255, 246, 224, ${(0.72 + emphasis * 0.18).toFixed(3)})`,
      inner: `rgba(255, 210, 140, ${(0.46 + emphasis * 0.26).toFixed(3)})`,
      halo: `rgba(255, 176, 90, ${(0.22 + emphasis * 0.22).toFixed(3)})`,
      outer: 'rgba(255, 176, 90, 0)',
      ring: `rgba(255, 240, 210, ${(0.38 + emphasis * 0.28).toFixed(3)})`,
      shadow: `rgba(255, 188, 120, ${(0.55 + emphasis * 0.25).toFixed(3)})`
    } as const;
  }

  return {
    core: `rgba(226, 240, 255, ${(0.68 + emphasis * 0.18).toFixed(3)})`,
    inner: `rgba(156, 198, 255, ${(0.44 + emphasis * 0.26).toFixed(3)})`,
    halo: `rgba(66, 110, 255, ${(0.20 + emphasis * 0.22).toFixed(3)})`,
    outer: 'rgba(66, 110, 255, 0)',
    ring: `rgba(216, 232, 255, ${(0.36 + emphasis * 0.26).toFixed(3)})`,
    shadow: `rgba(110, 164, 255, ${(0.48 + emphasis * 0.25).toFixed(3)})`
  } as const;
}

function drawBossAura(
  ctx: CanvasRenderingContext2D,
  footprint: UnitSpriteFootprint,
  zoom: number,
  palette: ReturnType<typeof resolveBasePalette>,
  faction: string | undefined,
  motionStrength: number
): void {
  const auraPalette = resolveBossAuraPalette(faction, motionStrength);
  const radiusX = snapForZoom(Math.max(footprint.radiusX * BOSS_AURA_RADIUS_SCALE_X, 1), zoom);
  const radiusY = snapForZoom(Math.max(footprint.radiusY * BOSS_AURA_RADIUS_SCALE_Y, 1), zoom);

  ctx.save();
  ctx.translate(footprint.centerX, footprint.centerY);
  ctx.scale(radiusX, radiusY);
  const [gradient, fallback] = createGradientSafe(
    () => ctx.createRadialGradient(0, 0, 0, 0, 0, 1),
    auraPalette.inner
  );
  applyStops(gradient, [
    [0, auraPalette.core],
    [0.42, auraPalette.inner],
    [0.84, auraPalette.halo],
    [1, auraPalette.outer]
  ]);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.88;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fillStyle = gradient ?? fallback;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'screen';
  ctx.shadowColor = auraPalette.shadow;
  ctx.shadowBlur = snapForZoom(Math.max(10, zoom * 4.5), zoom);
  ctx.lineWidth = snapForZoom(Math.max(2.4, zoom * 1.6), zoom);
  ctx.strokeStyle = auraPalette.ring;
  ctx.beginPath();
  ctx.ellipse(
    footprint.centerX,
    footprint.centerY,
    radiusX * 0.78,
    radiusY * 0.72,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
}

export function drawUnitSprite(
  ctx: CanvasRenderingContext2D,
  unit: Unit,
  options: DrawUnitSpriteOptions
): UnitSpriteRenderResult {
  if (!ctx || !unit || !options || !options.placement) {
    throw new Error('drawUnitSprite requires a valid context, unit, and placement data.');
  }

  const zoom = Number.isFinite(options.cameraZoom) && (options.cameraZoom as number) > 0
    ? (options.cameraZoom as number)
    : options.placement.zoom;
  const basePlacement = options.precomputedPlacement
    ? clonePlacement(options.precomputedPlacement)
    : getSpritePlacement(options.placement);
  const motionStrength = Math.max(0, Math.min(1, options.motionStrength ?? 0));
  const palette = resolveBasePalette(options.faction ?? unit.faction, options.selection, motionStrength);

  const anchorHint = options.anchorHint;
  const offset = options.offset;
  const nextPlacement: SpritePlacement = {
    ...basePlacement
  };

  const isBossUnit = Boolean(unit.isBoss);

  if (isBossUnit) {
    applyBossSpriteScale(nextPlacement);
  }

  if (anchorHint) {
    const deltaX = anchorHint.x - nextPlacement.centerX;
    const deltaY = anchorHint.y - nextPlacement.centerY;
    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      nextPlacement.drawX += deltaX;
      nextPlacement.drawY += deltaY;
      nextPlacement.centerX += deltaX;
      nextPlacement.centerY += deltaY;
    }
  }

  if (offset) {
    const deltaX = offset.x;
    const deltaY = offset.y;
    if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
      nextPlacement.drawX += deltaX;
      nextPlacement.drawY += deltaY;
      nextPlacement.centerX += deltaX;
      nextPlacement.centerY += deltaY;
    }
  }

  const shouldDrawBase = options.drawBase ?? true;
  const baseHexSize = options.placement.hexSize;
  const effectiveHexSize = isBossUnit ? baseHexSize * BOSS_BASE_HEX_SCALE : baseHexSize;
  const footprint = drawBase(
    ctx,
    nextPlacement,
    effectiveHexSize,
    zoom,
    palette,
    shouldDrawBase
  );

  if (isBossUnit) {
    drawBossAura(ctx, footprint, zoom, palette, options.faction ?? unit.faction, motionStrength);
  }

  const shouldRenderSprite = options.renderSprite !== false;
  const atlas = options.atlas ?? null;
  const slice = options.slice ?? null;
  const sprite = options.sprite;
  if (shouldRenderSprite) {
    if (atlas && slice) {
      ctx.drawImage(
        atlas,
        slice.sx,
        slice.sy,
        slice.sw,
        slice.sh,
        nextPlacement.drawX,
        nextPlacement.drawY,
        nextPlacement.width,
        nextPlacement.height
      );
    } else if (sprite) {
      ctx.drawImage(
        sprite,
        nextPlacement.drawX,
        nextPlacement.drawY,
        nextPlacement.width,
        nextPlacement.height
      );
    }
  }

  return {
    placement: nextPlacement,
    center: { x: nextPlacement.centerX, y: nextPlacement.centerY },
    footprint
  } satisfies UnitSpriteRenderResult;
}
