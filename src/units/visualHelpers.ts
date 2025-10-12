import { HEX_R, pathHex } from '../hex/index.ts';

export interface HPDrawOptions {
  centerX: number;
  centerY: number;
  hp: number;
  maxHp: number;
  radius?: number;
}

export interface SelectionRingOptions {
  centerX: number;
  centerY: number;
  radius?: number;
}

export interface SteamOptions {
  centerX: number;
  centerY: number;
  radius?: number;
  intensity?: number;
}

export interface HitFlashOptions {
  centerX: number;
  centerY: number;
  radius?: number;
  progress?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function drawHP(
  ctx: CanvasRenderingContext2D,
  { centerX, centerY, hp, maxHp, radius = HEX_R * 0.55 }: HPDrawOptions
): void {
  const safeMax = Number.isFinite(maxHp) ? Math.max(1, maxHp) : 1;
  const safeHp = Number.isFinite(hp) ? hp : safeMax;
  const ratio = clamp(safeHp / safeMax, 0, 1);

  ctx.save();
  pathHex(ctx, centerX, centerY, radius);
  ctx.fillStyle = 'rgba(7, 11, 18, 0.72)';
  ctx.fill();
  ctx.restore();

  if (ratio > 0) {
    ctx.save();
    pathHex(ctx, centerX, centerY, radius);
    ctx.clip();
    const gradient = ctx.createLinearGradient(centerX, centerY + radius, centerX, centerY - radius);
    gradient.addColorStop(0, 'rgba(46, 160, 98, 0.35)');
    gradient.addColorStop(1, 'rgba(218, 255, 239, 0.95)');
    ctx.fillStyle = gradient;
    const height = radius * 2 * ratio;
    const top = centerY + radius - height;
    ctx.fillRect(centerX - radius, top, radius * 2, height);
    ctx.restore();
  }

  ctx.save();
  pathHex(ctx, centerX, centerY, radius);
  ctx.lineWidth = Math.max(1, radius * 0.12);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.stroke();
  ctx.restore();
}

export function drawHitFlash(
  ctx: CanvasRenderingContext2D,
  { centerX, centerY, radius = HEX_R, progress = 0 }: HitFlashOptions
): void {
  const clampedProgress = clamp(progress, 0, 1);
  if (clampedProgress <= 0) {
    return;
  }

  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : HEX_R;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = clampedProgress;
  const gradient = ctx.createRadialGradient(
    centerX,
    centerY,
    Math.max(1, safeRadius * 0.1),
    centerX,
    centerY,
    safeRadius
  );
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.68)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(centerX, centerY, safeRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawSelectionRing(
  ctx: CanvasRenderingContext2D,
  { centerX, centerY, radius = HEX_R }: SelectionRingOptions
): void {
  ctx.save();
  const outerRadius = radius;
  pathHex(ctx, centerX, centerY, outerRadius);
  const gradient = ctx.createLinearGradient(centerX, centerY - outerRadius, centerX, centerY + outerRadius);
  gradient.addColorStop(0, 'rgba(127, 220, 255, 0.95)');
  gradient.addColorStop(1, 'rgba(42, 122, 255, 0.65)');
  ctx.strokeStyle = gradient;
  ctx.lineWidth = Math.max(2, outerRadius * 0.12);
  ctx.shadowColor = 'rgba(80, 200, 255, 0.65)';
  ctx.shadowBlur = outerRadius * 0.75;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  const innerRadius = outerRadius * 0.74;
  pathHex(ctx, centerX, centerY, innerRadius);
  ctx.setLineDash([innerRadius * 0.8, innerRadius * 0.4]);
  ctx.lineWidth = Math.max(1, outerRadius * 0.05);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.stroke();
  ctx.restore();
}

export function drawSteam(
  ctx: CanvasRenderingContext2D,
  { centerX, centerY, radius = HEX_R * 0.85, intensity = 1 }: SteamOptions
): void {
  const clampedIntensity = clamp(intensity, 0, 1);
  if (clampedIntensity <= 0) {
    return;
  }

  ctx.save();
  pathHex(ctx, centerX, centerY, radius);
  ctx.clip();
  const gradient = ctx.createLinearGradient(centerX, centerY + radius, centerX, centerY - radius);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
  gradient.addColorStop(0.55, `rgba(255, 255, 255, ${0.12 * clampedIntensity})`);
  gradient.addColorStop(1, `rgba(255, 255, 255, ${0.35 * clampedIntensity})`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = gradient;
  ctx.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.25 * clampedIntensity})`;
  ctx.lineWidth = Math.max(1, radius * 0.08);
  const swirlRadius = radius * 0.75;
  const swirlSpacing = radius * 0.35;
  for (let i = 0; i < 3; i++) {
    const offsetY = centerY - radius * 0.5 + i * swirlSpacing;
    ctx.beginPath();
    ctx.moveTo(centerX - swirlRadius, offsetY);
    ctx.bezierCurveTo(
      centerX - swirlRadius * 0.4,
      offsetY - radius * 0.4,
      centerX + swirlRadius * 0.4,
      offsetY + radius * 0.2,
      centerX + swirlRadius,
      offsetY - radius * 0.45
    );
    ctx.stroke();
  }
  ctx.restore();
}
