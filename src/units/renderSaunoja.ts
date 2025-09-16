import { axialToPixel, HEX_R, pathHex } from '../hex/index.ts';
import type { Saunoja } from './saunoja.ts';
import { drawHP, drawHitFlash, drawSteam } from './visualHelpers.ts';

function resolveSaunojaIconPath(): string {
  const baseUrl = import.meta.env.BASE_URL ?? '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const assetPath = 'assets/units/saunoja.svg';
  return `${normalizedBase}${assetPath.replace(/^\/+/, '')}`;
}

const SAUNOJA_ICON_PATH = resolveSaunojaIconPath();

let saunojaIcon: HTMLImageElement | null = null;
let saunojaIconPromise: Promise<HTMLImageElement> | null = null;

function isImageReady(image: HTMLImageElement | null): image is HTMLImageElement {
  return Boolean(image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
}

function notifyLoaded(
  icon: HTMLImageElement,
  onLoad?: (icon: HTMLImageElement) => void
): HTMLImageElement {
  if (!onLoad) {
    return icon;
  }

  try {
    onLoad(icon);
  } catch (error) {
    console.error('Saunoja icon onLoad callback failed', error);
  }

  return icon;
}

export function preloadSaunojaIcon(onLoad?: (icon: HTMLImageElement) => void): Promise<HTMLImageElement> {
  const withCallback = (promise: Promise<HTMLImageElement>) =>
    onLoad ? promise.then((icon) => notifyLoaded(icon, onLoad)) : promise;

  if (isImageReady(saunojaIcon)) {
    return withCallback(Promise.resolve(saunojaIcon));
  }

  if (saunojaIconPromise) {
    return withCallback(saunojaIconPromise);
  }

  if (typeof Image === 'undefined') {
    return Promise.reject(new Error('Image constructor is not available in this environment.'));
  }

  const img = new Image();
  img.decoding = 'async';
  saunojaIcon = img;

  saunojaIconPromise = new Promise((resolve, reject) => {
    const cleanup = () => {
      img.onload = null;
      img.onerror = null;
    };

    const finalize = () => {
      cleanup();
      resolve(img);
    };

    img.onload = finalize;
    img.onerror = (event) => {
      cleanup();
      saunojaIcon = null;
      saunojaIconPromise = null;
      const error = new Error(`Failed to load saunoja icon from ${SAUNOJA_ICON_PATH}`);
      console.warn(error.message, event);
      reject(error);
    };

    img.src = SAUNOJA_ICON_PATH;

    if (isImageReady(img)) {
      finalize();
    }
  });

  return withCallback(saunojaIconPromise);
}

export interface DrawSaunojasOptions {
  originX?: number;
  originY?: number;
  hexRadius?: number;
}

export function drawSaunojas(
  ctx: CanvasRenderingContext2D,
  saunojas: Saunoja[],
  { originX = 0, originY = 0, hexRadius = HEX_R }: DrawSaunojasOptions = {}
): void {
  if (!ctx || !Array.isArray(saunojas) || saunojas.length === 0) {
    return;
  }

  const icon = isImageReady(saunojaIcon) ? saunojaIcon : null;
  if (!icon) {
    return;
  }

  const radius = Number.isFinite(hexRadius) && hexRadius > 0 ? hexRadius : HEX_R;
  const clipRadius = radius * 0.98;
  const renderable = [...saunojas].sort((a, b) => {
    if (a.coord.r !== b.coord.r) {
      return a.coord.r - b.coord.r;
    }
    if (a.coord.q !== b.coord.q) {
      return a.coord.q - b.coord.q;
    }
    return a.id.localeCompare(b.id);
  });

  for (const unit of renderable) {
    const { x, y } = axialToPixel(unit.coord, radius);
    const drawX = x - originX;
    const drawY = y - originY;
    const centerX = drawX + radius;
    const centerY = drawY + radius;

    ctx.save();
    pathHex(ctx, centerX, centerY, clipRadius);
    ctx.clip();

    const baseScale = (radius * 2.15) / Math.max(icon.naturalWidth, icon.naturalHeight || 1);
    const drawWidth = icon.naturalWidth * baseScale;
    const drawHeight = icon.naturalHeight * baseScale;
    const imageX = centerX - drawWidth / 2;
    const imageY = centerY - drawHeight * 0.72;

    ctx.save();
    ctx.filter = 'grayscale(100%) contrast(112%)';
    ctx.globalAlpha *= 0.96;
    ctx.drawImage(icon, imageX, imageY, drawWidth, drawHeight);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const shadow = ctx.createRadialGradient(
      centerX,
      centerY + clipRadius * 0.38,
      clipRadius * 0.2,
      centerX,
      centerY + clipRadius * 0.38,
      clipRadius * 1.05
    );
    shadow.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
    shadow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const tint = ctx.createLinearGradient(centerX, centerY - clipRadius, centerX, centerY + clipRadius);
    tint.addColorStop(0, 'rgba(255, 232, 210, 0.18)');
    tint.addColorStop(0.52, 'rgba(255, 183, 124, 0.32)');
    tint.addColorStop(1, 'rgba(212, 97, 54, 0.5)');
    ctx.fillStyle = tint;
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.75;
    const highlight = ctx.createRadialGradient(
      centerX,
      centerY - clipRadius * 0.68,
      clipRadius * 0.1,
      centerX,
      centerY,
      clipRadius * 1.12
    );
    highlight.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    highlight.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = highlight;
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.restore();

    const now = performance.now();
    const elapsed = now - unit.lastHitAt;
    const FLASH_MS = 120;
    if (elapsed < FLASH_MS) {
      const progress = 1 - elapsed / FLASH_MS;
      drawHitFlash(ctx, { centerX, centerY, radius: clipRadius, progress });
    }

    ctx.restore();

    drawSteam(ctx, {
      centerX,
      centerY: centerY - radius * 0.18,
      radius: radius * 0.94,
      intensity: unit.steam
    });

    const hpRadius = radius * 0.42;
    const hpCenterY = centerY + radius * 0.34;
    drawHP(ctx, {
      centerX,
      centerY: hpCenterY,
      hp: unit.hp,
      maxHp: unit.maxHp,
      radius: hpRadius
    });
  }
}
