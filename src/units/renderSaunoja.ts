import { HEX_R, pathHex } from '../hex/index.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Saunoja } from './saunoja.ts';
import { drawHitFlash, drawSteam } from './visualHelpers.ts';
import { getSpriteCenter } from '../render/units/draw.ts';
import { snapForZoom } from '../render/zoom.ts';
import type { UnitStatusBuff, UnitStatusPayload } from '../ui/fx/types.ts';

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
  zoom?: number;
  resolveRenderCoord?: (saunoja: Saunoja) => AxialCoord | null | undefined;
  pushStatus?: (status: UnitStatusPayload) => void;
}

export function drawSaunojas(
  ctx: CanvasRenderingContext2D,
  saunojas: Saunoja[],
  {
    originX = 0,
    originY = 0,
    hexRadius = HEX_R,
    zoom = 1,
    resolveRenderCoord,
    pushStatus
  }: DrawSaunojasOptions = {}
): void {
  if (!ctx || !Array.isArray(saunojas) || saunojas.length === 0) {
    return;
  }

  const icon = isImageReady(saunojaIcon) ? saunojaIcon : null;
  if (!icon) {
    return;
  }

  const radius = Number.isFinite(hexRadius) && hexRadius > 0 ? hexRadius : HEX_R;
  const clipRadius = radius * 0.965;
  const renderable = saunojas
    .map((unit) => {
      const candidate = resolveRenderCoord?.(unit);
      const validCandidate =
        candidate &&
        typeof candidate === 'object' &&
        Number.isFinite(candidate.q) &&
        Number.isFinite(candidate.r);
      const coord: AxialCoord = validCandidate
        ? { q: candidate.q, r: candidate.r }
        : unit.coord;
      return { unit, coord };
    })
    .sort((a, b) => {
      if (a.coord.r !== b.coord.r) {
        return a.coord.r - b.coord.r;
      }
      if (a.coord.q !== b.coord.q) {
        return a.coord.q - b.coord.q;
      }
      return a.unit.id.localeCompare(b.unit.id);
    });

  for (const { unit, coord } of renderable) {
    const { x: centerX, y: centerY } = getSpriteCenter({
      coord,
      hexSize: radius,
      origin: { x: originX, y: originY },
      zoom,
      type: 'saunoja'
    });

    ctx.save();
    pathHex(ctx, centerX, centerY, clipRadius);
    ctx.clip();

    const iconWidth = icon.naturalWidth || 1;
    const iconHeight = icon.naturalHeight || 1;
    const widthBudget = clipRadius * 1.85;
    const heightBudget = clipRadius * 2.4;
    const iconScale = Math.min(widthBudget / iconWidth, heightBudget / iconHeight);
    const drawWidth = snapForZoom(iconWidth * iconScale, zoom);
    const drawHeight = snapForZoom(iconHeight * iconScale, zoom);
    const imageX = snapForZoom(centerX - drawWidth / 2, zoom);
    const imageY = snapForZoom(centerY - drawHeight * 0.78, zoom);

    ctx.save();
    ctx.filter = 'saturate(112%) contrast(108%) brightness(1.04)';
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
    shadow.addColorStop(0, 'rgba(22, 30, 50, 0.58)');
    shadow.addColorStop(1, 'rgba(22, 30, 50, 0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    const tint = ctx.createLinearGradient(centerX, centerY - clipRadius, centerX, centerY + clipRadius);
    tint.addColorStop(0, 'rgba(233, 224, 255, 0.28)');
    tint.addColorStop(0.52, 'rgba(196, 148, 255, 0.26)');
    tint.addColorStop(1, 'rgba(94, 75, 168, 0.35)');
    ctx.fillStyle = tint;
    ctx.fillRect(centerX - clipRadius, centerY - clipRadius, clipRadius * 2, clipRadius * 2);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.68;
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

    if (pushStatus) {
      const hpRadius = radius * 0.42;
      const hpCenterY = centerY + radius * 0.34;
      const worldX = centerX + originX;
      const worldY = hpCenterY + originY;
      const rawBuffs = Array.isArray(unit.modifiers) ? unit.modifiers : [];
      const buffs: UnitStatusBuff[] = rawBuffs.map((mod) => ({
        id: mod.id,
        remaining: Number.isFinite(mod.remaining) ? mod.remaining : Infinity,
        duration: Number.isFinite(mod.duration) ? mod.duration : Infinity,
        stacks: typeof mod.stacks === 'number' && Number.isFinite(mod.stacks) ? mod.stacks : undefined
      }));
      pushStatus({
        id: unit.id,
        world: { x: worldX, y: worldY },
        radius: hpRadius,
        hp: unit.hp,
        maxHp: unit.maxHp,
        shield: Number.isFinite(unit.shield) ? unit.shield : 0,
        faction: 'player',
        selected: Boolean(unit.selected),
        buffs
      });
    }
  }
}
