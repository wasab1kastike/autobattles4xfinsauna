import type { Sauna } from '../sim/sauna.ts';
import type { PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel, DIRECTIONS } from '../hex/HexUtils.ts';
import type { SaunaStatusPayload } from '../ui/fx/types.ts';

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
  pushStatus?: (status: SaunaStatusPayload | null) => void;
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

export function drawSaunaOverlay(
  ctx: CanvasRenderingContext2D,
  sauna: Sauna | null | undefined,
  { origin, hexSize, timestamp, pushStatus }: DrawSaunaOverlayOptions
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
  const worldCenterX = centerX + origin.x;
  const worldCenterY = centerY + origin.y;
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


  if (pushStatus) {
    const gaugeRadius = hexSize * 0.9;
    const trackRadius = gaugeRadius * 0.78;
    const cooldown = sauna.playerSpawnCooldown > 0 ? sauna.playerSpawnCooldown : 1;
    const remainingSeconds = Math.max(0, Math.min(cooldown, sauna.playerSpawnTimer));
    const progress = cooldown <= 0 ? 1 : 1 - Math.min(1, remainingSeconds / cooldown);
    pushStatus({
      id: sauna.id,
      world: { x: worldCenterX, y: worldCenterY },
      radius: trackRadius,
      progress,
      countdown: remainingSeconds,
      label: 'Sauna \u2668\ufe0f',
      unitLabel: 'sec',
      visible: !sauna.destroyed
    });
  }
}
