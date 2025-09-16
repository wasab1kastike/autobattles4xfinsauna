import type { Sauna } from '../sim/sauna.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel, DIRECTIONS } from '../hex/HexUtils.ts';

interface SaunaPalette {
  accent: string;
  accentSoft: string;
  warm: string;
  surface: string;
  border: string;
  text: string;
}

const FALLBACK_PALETTE: SaunaPalette = {
  accent: '#38bdf8',
  accentSoft: 'rgba(56, 189, 248, 0.2)',
  warm: '#fbbf24',
  surface: 'rgba(15, 23, 42, 0.92)',
  border: 'rgba(148, 163, 184, 0.34)',
  text: '#e2e8f0'
};

let cachedPalette: SaunaPalette | null = null;

function resolveToken(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function getPalette(): SaunaPalette {
  if (cachedPalette) {
    return cachedPalette;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    cachedPalette = FALLBACK_PALETTE;
    return cachedPalette;
  }

  try {
    const styles = getComputedStyle(document.documentElement);
    cachedPalette = {
      accent: resolveToken(styles.getPropertyValue('--color-accent'), FALLBACK_PALETTE.accent),
      accentSoft: resolveToken(
        styles.getPropertyValue('--color-accent-soft'),
        FALLBACK_PALETTE.accentSoft
      ),
      warm: resolveToken(styles.getPropertyValue('--color-warning'), FALLBACK_PALETTE.warm),
      surface: resolveToken(
        styles.getPropertyValue('--color-surface-strong'),
        FALLBACK_PALETTE.surface
      ),
      border: resolveToken(styles.getPropertyValue('--hud-border-strong'), FALLBACK_PALETTE.border),
      text: resolveToken(styles.getPropertyValue('--color-foreground'), FALLBACK_PALETTE.text)
    };
    return cachedPalette;
  } catch (error) {
    console.warn('Failed to read sauna palette tokens from computed styles', error);
    cachedPalette = FALLBACK_PALETTE;
    return cachedPalette;
  }
}

interface DrawSaunaOverlayOptions {
  origin: PixelCoord;
  hexSize: number;
  timestamp?: number;
}

function computeAuraRadiusPx(sauna: Sauna, hexSize: number): number {
  const radius = Math.max(0, sauna.auraRadius);
  const base = axialToPixel(sauna.pos, hexSize);
  const baseCenterX = base.x + hexSize;
  const baseCenterY = base.y + hexSize;
  let maxDistance = hexSize;

  if (radius <= 0) {
    return hexSize * 1.6;
  }

  for (const dir of DIRECTIONS) {
    const target = axialToPixel(
      {
        q: sauna.pos.q + dir.q * radius,
        r: sauna.pos.r + dir.r * radius
      },
      hexSize
    );
    const targetCenterX = target.x + hexSize;
    const targetCenterY = target.y + hexSize;
    const distance = Math.hypot(targetCenterX - baseCenterX, targetCenterY - baseCenterY);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  }

  return maxDistance + hexSize * 0.65;
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const clamped = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  ctx.moveTo(x + clamped, y);
  ctx.lineTo(x + width - clamped, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + clamped);
  ctx.lineTo(x + width, y + height - clamped);
  ctx.quadraticCurveTo(x + width, y + height, x + width - clamped, y + height);
  ctx.lineTo(x + clamped, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - clamped);
  ctx.lineTo(x, y + clamped);
  ctx.quadraticCurveTo(x, y, x + clamped, y);
  ctx.closePath();
}

export function drawSaunaOverlay(
  ctx: CanvasRenderingContext2D,
  sauna: Sauna | null | undefined,
  { origin, hexSize, timestamp }: DrawSaunaOverlayOptions
): void {
  if (!sauna) {
    return;
  }

  const palette = getPalette();
  const now = Number.isFinite(timestamp)
    ? (timestamp as number)
    : typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();
  const pulse = 0.5 + 0.5 * Math.sin(now * 0.0035);
  const base = axialToPixel(sauna.pos, hexSize);
  const centerX = base.x - origin.x + hexSize;
  const centerY = base.y - origin.y + hexSize;
  const auraRadius = computeAuraRadiusPx(sauna, hexSize);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glowOuter = auraRadius + hexSize * (0.4 + pulse * 0.3);
  const glowInner = Math.max(hexSize * 0.6, auraRadius * 0.58);
  const glowGradient = ctx.createRadialGradient(
    centerX,
    centerY,
    glowInner,
    centerX,
    centerY,
    glowOuter
  );
  glowGradient.addColorStop(0, palette.accentSoft);
  glowGradient.addColorStop(0.55, `rgba(56, 189, 248, ${0.18 + pulse * 0.12})`);
  glowGradient.addColorStop(1, 'rgba(2, 6, 23, 0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, glowOuter, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineWidth = Math.max(hexSize * 0.28, 6);
  ctx.strokeStyle = `rgba(56, 189, 248, ${(0.35 + pulse * 0.2).toFixed(3)})`;
  ctx.shadowColor = `rgba(56, 189, 248, ${0.45 + pulse * 0.1})`;
  ctx.shadowBlur = hexSize * (0.9 + pulse * 0.45);
  ctx.beginPath();
  ctx.arc(centerX, centerY, auraRadius + hexSize * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const gaugeRadius = hexSize * 0.9;
  ctx.save();
  ctx.beginPath();
  ctx.arc(centerX, centerY, gaugeRadius, 0, Math.PI * 2);
  ctx.fillStyle = palette.surface;
  ctx.globalAlpha *= 0.96;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, hexSize * 0.06);
  ctx.strokeStyle = palette.border;
  ctx.shadowColor = 'rgba(8, 25, 53, 0.6)';
  ctx.shadowBlur = hexSize * 0.45;
  ctx.stroke();
  ctx.restore();

  const trackRadius = gaugeRadius * 0.78;
  const trackWidth = Math.max(hexSize * 0.22, 5);

  ctx.save();
  ctx.lineWidth = trackWidth;
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.24)';
  ctx.beginPath();
  ctx.arc(centerX, centerY, trackRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const cooldown = sauna.spawnCooldown > 0 ? sauna.spawnCooldown : 1;
  const remainingRatio = Math.min(1, Math.max(0, sauna.timer / cooldown));
  const progress = 1 - remainingRatio;
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2 * progress;

  if (progress > 0) {
    ctx.save();
    ctx.lineWidth = trackWidth;
    ctx.lineCap = 'round';
    const arcGradient = ctx.createLinearGradient(
      centerX,
      centerY - trackRadius,
      centerX,
      centerY + trackRadius
    );
    arcGradient.addColorStop(0, palette.accent);
    arcGradient.addColorStop(1, palette.warm);
    ctx.strokeStyle = arcGradient;
    ctx.shadowColor = `rgba(56, 189, 248, ${0.42 + pulse * 0.18})`;
    ctx.shadowBlur = hexSize * (0.65 + pulse * 0.35);
    ctx.beginPath();
    ctx.arc(centerX, centerY, trackRadius, startAngle, endAngle, false);
    ctx.stroke();
    ctx.restore();
  }

  const secondsRemaining = Math.max(0, sauna.timer);
  const countdown = Math.ceil(secondsRemaining);

  ctx.save();
  ctx.font = `600 ${Math.max(12, hexSize * 0.9)}px "Inter", "Manrope", "Segoe UI", sans-serif`;
  ctx.fillStyle = palette.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(2, 6, 23, 0.6)';
  ctx.shadowBlur = hexSize * 0.35;
  ctx.fillText(String(countdown), centerX, centerY);
  ctx.restore();

  ctx.save();
  ctx.font = `500 ${Math.max(10, hexSize * 0.36)}px "Inter", "Manrope", "Segoe UI", sans-serif`;
  ctx.fillStyle = 'rgba(148, 163, 184, 0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('sec', centerX, centerY + trackRadius * 0.45);
  ctx.restore();

  const label = 'Sauna \u2668\ufe0f';
  const labelFontSize = Math.max(12, hexSize * 0.58);
  ctx.save();
  ctx.font = `600 ${labelFontSize}px "Inter", "Manrope", "Segoe UI", sans-serif`;
  const metrics = ctx.measureText(label);
  const paddingX = hexSize * 0.58;
  const paddingY = hexSize * 0.32;
  const badgeWidth = metrics.width + paddingX * 2;
  const badgeHeight = labelFontSize + paddingY * 2;
  const badgeX = centerX - badgeWidth / 2;
  const badgeY = centerY - auraRadius - badgeHeight - hexSize * 0.35;
  const cornerRadius = badgeHeight / 2;

  ctx.beginPath();
  roundedRectPath(ctx, badgeX, badgeY, badgeWidth, badgeHeight, cornerRadius);
  const badgeGradient = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeHeight);
  badgeGradient.addColorStop(0, 'rgba(15, 23, 42, 0.94)');
  badgeGradient.addColorStop(0.55, 'rgba(15, 23, 42, 0.86)');
  badgeGradient.addColorStop(1, 'rgba(30, 41, 59, 0.9)');
  ctx.fillStyle = badgeGradient;
  ctx.shadowColor = 'rgba(8, 25, 53, 0.6)';
  ctx.shadowBlur = hexSize * 0.4;
  ctx.fill();

  ctx.lineWidth = Math.max(1.5, hexSize * 0.06);
  const badgeStroke = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeWidth, badgeY);
  badgeStroke.addColorStop(0, `${palette.accent}`);
  badgeStroke.addColorStop(1, `${palette.warm}`);
  ctx.strokeStyle = badgeStroke;
  ctx.stroke();

  ctx.fillStyle = palette.text;
  ctx.shadowColor = 'rgba(8, 25, 53, 0.65)';
  ctx.shadowBlur = hexSize * 0.3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, centerX, badgeY + badgeHeight / 2 + labelFontSize * 0.05);
  ctx.restore();
}
