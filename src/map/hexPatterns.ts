export interface HexPatternOptions {
  ctx: CanvasRenderingContext2D;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  centerX: number;
  centerY: number;
  baseColor: string;
}

type RGB = [number, number, number];

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function hexToRgb(color: string): RGB {
  let hex = color.trim();
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  if (hex.length === 3) {
    const r = Number.parseInt(hex[0] + hex[0], 16);
    const g = Number.parseInt(hex[1] + hex[1], 16);
    const b = Number.parseInt(hex[2] + hex[2], 16);
    return [r, g, b];
  }

  if (hex.length === 6) {
    const value = Number.parseInt(hex, 16);
    const r = (value >> 16) & 0xff;
    const g = (value >> 8) & 0xff;
    const b = value & 0xff;
    return [r, g, b];
  }

  return [0, 0, 0];
}

function mixColor(base: RGB, target: RGB, amount: number): RGB {
  const t = clamp01(amount);
  const mix = (channel: number, targetChannel: number) =>
    Math.round(channel + (targetChannel - channel) * t);
  return [mix(base[0], target[0]), mix(base[1], target[1]), mix(base[2], target[2])];
}

function withAlpha([r, g, b]: RGB, alpha: number): string {
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function tinted(base: RGB, target: RGB, amount: number, alpha: number): string {
  return withAlpha(mixColor(base, target, amount), alpha);
}

export function drawForest(options: HexPatternOptions): void {
  const { ctx, x, y, width, height, radius, baseColor } = options;
  const baseRgb = hexToRgb(baseColor);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const canopyStroke = tinted(baseRgb, [255, 255, 255], 0.35, 0.24);
  ctx.strokeStyle = canopyStroke;
  ctx.lineWidth = Math.max(1, radius * 0.06);

  const bandCount = 3;
  const segments = 6;
  const left = x + width * 0.12;
  const right = x + width * 0.88;

  for (let band = 0; band < bandCount; band++) {
    const progress = band / Math.max(1, bandCount - 1);
    const offsetY = y + height * 0.28 + progress * height * 0.32;
    const amplitude = radius * (0.18 - progress * 0.05);
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = left + (right - left) * t;
      const wave = Math.sin(t * Math.PI * 1.6 + band * 0.8) * amplitude;
      const py = offsetY - Math.abs(wave) * 0.55;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  const groveStroke = tinted(baseRgb, [18, 54, 32], 0.4, 0.2);
  ctx.strokeStyle = groveStroke;
  ctx.lineWidth = Math.max(0.75, radius * 0.035);

  const clusterCount = 5;
  const clusterRadius = radius * 0.22;
  for (let i = 0; i < clusterCount; i++) {
    const px = x + width * (0.2 + (i / Math.max(1, clusterCount - 1)) * 0.6);
    const py = y + height * 0.55 - Math.cos(i * 0.9) * radius * 0.08;

    ctx.beginPath();
    ctx.arc(px, py, clusterRadius, Math.PI * 0.2, Math.PI * 0.85);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px + clusterRadius * 0.35, py - clusterRadius * 0.1, clusterRadius * 0.55, Math.PI * 0.15, Math.PI * 0.95);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawHills(options: HexPatternOptions): void {
  const { ctx, centerX, centerY, radius, baseColor } = options;
  const baseRgb = hexToRgb(baseColor);

  ctx.save();
  ctx.lineCap = 'round';

  const ridgeStroke = tinted(baseRgb, [255, 235, 214], 0.45, 0.22);
  ctx.strokeStyle = ridgeStroke;
  ctx.lineWidth = Math.max(1, radius * 0.05);

  const ridgeCount = 4;
  for (let i = 0; i < ridgeCount; i++) {
    const progress = i / Math.max(1, ridgeCount - 1);
    const rx = radius * (1.25 - progress * 0.45);
    const ry = radius * (0.72 - progress * 0.18);
    const offsetY = centerY + radius * 0.18 * (progress - 0.5);
    ctx.beginPath();
    ctx.ellipse(centerX, offsetY, rx, ry, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
  }

  const contourStroke = tinted(baseRgb, [60, 36, 20], 0.35, 0.18);
  ctx.strokeStyle = contourStroke;
  ctx.lineWidth = Math.max(0.85, radius * 0.032);
  ctx.setLineDash([radius * 0.22, radius * 0.18]);

  const contourCount = 3;
  for (let i = 0; i < contourCount; i++) {
    const arcRadius = radius * (0.75 - i * 0.1);
    const offsetY = centerY + radius * 0.28 + i * radius * 0.08;
    ctx.beginPath();
    ctx.arc(centerX + radius * 0.08, offsetY, arcRadius, Math.PI * 0.28, Math.PI * 0.76);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.restore();
}

export function drawWater(options: HexPatternOptions): void {
  const { ctx, x, y, width, height, radius, baseColor } = options;
  const baseRgb = hexToRgb(baseColor);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const crestStroke = tinted(baseRgb, [255, 255, 255], 0.55, 0.28);
  ctx.strokeStyle = crestStroke;
  ctx.lineWidth = Math.max(1, radius * 0.045);

  const waveCount = 4;
  const waveSegments = 7;
  const left = x + width * 0.12;
  const right = x + width * 0.88;
  const amplitude = radius * 0.16;

  for (let i = 0; i < waveCount; i++) {
    const verticalProgress = i / Math.max(1, waveCount - 1);
    const baseY = y + height * 0.3 + verticalProgress * height * 0.4;
    ctx.beginPath();
    for (let s = 0; s <= waveSegments; s++) {
      const t = s / waveSegments;
      const px = left + (right - left) * t;
      const wave = Math.sin(t * Math.PI * 2 + i * 0.6) * amplitude * (0.75 - verticalProgress * 0.2);
      const py = baseY + wave;
      if (s === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  const troughStroke = tinted(baseRgb, [12, 52, 94], 0.4, 0.2);
  ctx.strokeStyle = troughStroke;
  ctx.lineWidth = Math.max(0.8, radius * 0.03);

  const rippleCount = 3;
  for (let i = 0; i < rippleCount; i++) {
    const progress = i / Math.max(1, rippleCount - 1);
    const baseY = y + height * 0.35 + progress * height * 0.35;
    ctx.beginPath();
    for (let s = 0; s <= waveSegments; s++) {
      const t = s / waveSegments;
      const px = left + (right - left) * t;
      const wave = Math.sin(t * Math.PI * 2 + i) * amplitude * 0.35;
      const py = baseY + wave;
      if (s === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

export function drawPlains(options: HexPatternOptions): void {
  const { ctx, x, y, width, height, radius, baseColor } = options;
  const baseRgb = hexToRgb(baseColor);

  ctx.save();
  ctx.lineCap = 'round';

  const highlightStroke = tinted(baseRgb, [255, 255, 255], 0.42, 0.18);
  ctx.strokeStyle = highlightStroke;
  ctx.lineWidth = Math.max(0.85, radius * 0.03);

  const spacing = radius * 0.55;
  for (let i = -1; i <= 2; i++) {
    const offset = spacing * i;
    ctx.beginPath();
    ctx.moveTo(x + offset, y + height * 0.25);
    ctx.lineTo(x + offset + width * 0.75, y + height * 0.85);
    ctx.stroke();
  }

  const accentStroke = tinted(baseRgb, [112, 82, 32], 0.3, 0.16);
  ctx.strokeStyle = accentStroke;
  ctx.lineWidth = Math.max(0.7, radius * 0.025);
  ctx.setLineDash([radius * 0.24, radius * 0.34]);

  const diagSpacing = radius * 0.48;
  for (let i = 0; i < 3; i++) {
    const offset = diagSpacing * i;
    ctx.beginPath();
    ctx.moveTo(x + width * 0.18 + offset, y + height * 0.78);
    ctx.lineTo(x + width * 0.7 + offset, y + height * 0.38);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.restore();
}
