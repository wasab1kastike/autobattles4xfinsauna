import { darkenNeutral, lightenNeutral, getOutlineWidth } from './palette.ts';

type Permutation = readonly number[];

const BASE_PERMUTATION: Permutation = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
  140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
  247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
  57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
  74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
  60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
  65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
  200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3,
  64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82,
  85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183,
  170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167,
  43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178,
  185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
  191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214,
  31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4,
  150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
  195, 78, 66, 215, 61, 156, 180,
];

const PERMUTATION = new Array<number>(512);
for (let i = 0; i < 512; i++) {
  PERMUTATION[i] = BASE_PERMUTATION[i % 256];
}

const fogMaskCache = new Map<number, HTMLCanvasElement>();

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);
const grad = (hash: number, x: number, y: number): number => {
  switch (hash & 3) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
};

function perlin(x: number, y: number): number {
  const xi = Math.floor(x) & 255;
  const yi = Math.floor(y) & 255;
  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const topRight = PERMUTATION[PERMUTATION[xi + 1] + yi + 1];
  const topLeft = PERMUTATION[PERMUTATION[xi] + yi + 1];
  const bottomRight = PERMUTATION[PERMUTATION[xi + 1] + yi];
  const bottomLeft = PERMUTATION[PERMUTATION[xi] + yi];

  const u = fade(xf);
  const v = fade(yf);

  const x1 = lerp(grad(bottomLeft, xf, yf), grad(bottomRight, xf - 1, yf), u);
  const x2 = lerp(grad(topLeft, xf, yf - 1), grad(topRight, xf - 1, yf - 1), u);
  return lerp(x1, x2, v);
}

function octaveNoise(x: number, y: number, octaves = 4): number {
  let total = 0;
  let frequency = 1;
  let amplitude = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    total += perlin(x * frequency, y * frequency) * amplitude;
    maxValue += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return maxValue > 0 ? total / maxValue : 0;
}

function ensureFogMask(size: number): HTMLCanvasElement | null {
  const normalized = Math.max(32, Math.min(512, Math.round(size)));
  const key = normalized;
  const cached = fogMaskCache.get(key);
  if (cached) {
    return cached;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = normalized;
  canvas.height = normalized;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return null;
  }

  const image = ctx.createImageData(normalized, normalized);
  const scale = normalized / 48;
  let offset = 0;

  for (let y = 0; y < normalized; y++) {
    for (let x = 0; x < normalized; x++) {
      const noise = octaveNoise(x / scale, y / scale, 5);
      const normalizedNoise = Math.pow((noise + 1) / 2, 1.35);
      const alpha = Math.round(normalizedNoise * 255);
      image.data[offset] = 255;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = alpha;
      offset += 4;
    }
  }

  ctx.putImageData(image, 0, 0);
  fogMaskCache.set(key, canvas);
  return canvas;
}

function hexPath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function createFogGradient(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number
): CanvasGradient {
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.08, centerX, centerY, radius * 1.12);
  gradient.addColorStop(0, lightenNeutral(0.4, 0.35));
  gradient.addColorStop(0.35, lightenNeutral(0.2, 0.55));
  gradient.addColorStop(0.6, darkenNeutral(0.1, 0.78));
  gradient.addColorStop(0.82, darkenNeutral(0.2, 0.88));
  gradient.addColorStop(1, darkenNeutral(0.35, 0.95));
  return gradient;
}

export function drawFogHex(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  zoom: number
): void {
  if (radius <= 0) {
    return;
  }

  const mask = ensureFogMask(radius * 2.2);
  const cover = radius * 2.5;
  const drawX = centerX - cover / 2;
  const drawY = centerY - cover / 2;

  ctx.save();
  hexPath(ctx, centerX, centerY, radius);
  ctx.clip();

  const gradient = createFogGradient(ctx, centerX, centerY, radius);
  ctx.fillStyle = gradient;
  ctx.fillRect(drawX, drawY, cover, cover);

  if (mask) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.32;
    ctx.drawImage(mask, centerX - radius, centerY - radius, radius * 2, radius * 2);
    ctx.restore();
  }

  ctx.restore();

  ctx.save();
  hexPath(ctx, centerX, centerY, radius * 0.99);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = getOutlineWidth(radius, zoom, 'hover');
  ctx.strokeStyle = darkenNeutral(0.3, 0.88);
  ctx.shadowColor = darkenNeutral(0.45, 0.42);
  ctx.shadowBlur = Math.max(3, (radius * 0.45) / Math.max(zoom, 0.1));
  ctx.stroke();
  ctx.restore();
}
