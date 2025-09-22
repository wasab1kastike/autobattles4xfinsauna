import type { Unit } from '../../unit/index.ts';
import { getFactionPalette } from '../../theme/factionPalette.ts';
import type { SpritePlacement, SpritePlacementInput } from './draw.ts';
import { getSpritePlacement } from './draw.ts';
import { snapForZoom } from '../zoom.ts';

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
  readonly faction?: Unit['faction'];
  readonly motionStrength?: number;
  readonly cameraZoom?: number;
  readonly selection?: UnitSelectionState;
}

interface GradientLike {
  addColorStop(offset: number, color: string): void;
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
  palette: ReturnType<typeof resolveBasePalette>
): UnitSpriteFootprint {
  const radiusX = snapForZoom(hexSize * 0.78, zoom);
  const radiusY = snapForZoom(hexSize * 0.34, zoom);
  const bottomOffset = snapForZoom(Math.max(hexSize * 0.18, radiusY * 0.6), zoom);
  const bottomY = placement.drawY + placement.height;
  const centerX = placement.centerX;
  const centerY = bottomY - bottomOffset + radiusY * 0.2;

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
    () => ctx.createRadialGradient(centerX, centerY + radiusY * 0.4, radiusY * 0.35, centerX, centerY + radiusY * 0.4, radiusY * 1.4),
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
    () => ctx.createRadialGradient(centerX, centerY - radiusY * 0.65, radiusY * 0.1, centerX, centerY, radiusY * 1.25),
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

  return {
    centerX,
    centerY,
    radiusX,
    radiusY,
    top: centerY - radiusY,
    bottom: centerY + radiusY
  } satisfies UnitSpriteFootprint;
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
  const spritePlacement = getSpritePlacement(options.placement);
  const motionStrength = Math.max(0, Math.min(1, options.motionStrength ?? 0));
  const palette = resolveBasePalette(options.faction ?? unit.faction, options.selection, motionStrength);

  const footprint = drawBase(ctx, spritePlacement, options.placement.hexSize, zoom, palette);

  const sprite = options.sprite;
  if (sprite) {
    const previousFilter = ctx.filter;
    ctx.filter = previousFilter;
    ctx.drawImage(
      sprite,
      spritePlacement.drawX,
      spritePlacement.drawY,
      spritePlacement.width,
      spritePlacement.height
    );
  }

  return {
    placement: spritePlacement,
    center: { x: spritePlacement.centerX, y: spritePlacement.centerY },
    footprint
  } satisfies UnitSpriteRenderResult;
}
