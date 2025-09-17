import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit.ts';
import { isSisuBurstActive } from '../sim/sisu.ts';
import type { Sauna } from '../sim/sauna.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';
import { camera } from '../camera/autoFrame.ts';
import type { Saunoja } from '../units/saunoja.ts';
import type { DrawSaunojasOptions } from '../units/renderSaunoja.ts';
import { drawSaunaOverlay } from './saunaOverlay.ts';

type DrawSaunojaFn = (
  ctx: CanvasRenderingContext2D,
  units: Saunoja[],
  options?: DrawSaunojasOptions
) => void;

export interface DrawOptions {
  saunojas?: {
    units: Saunoja[];
    draw: DrawSaunojaFn;
  };
  sauna?: Sauna | null;
}

export function draw(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[],
  selected: AxialCoord | null,
  options?: DrawOptions
): void {
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  const viewportWidth = canvasWidth / dpr;
  const viewportHeight = canvasHeight / dpr;

  ctx.scale(dpr, dpr);
  ctx.translate(viewportWidth / 2, viewportHeight / 2);
  ctx.scale(camera.zoom, camera.zoom);

  const origin = mapRenderer.getOrigin();
  ctx.translate(-(camera.x - origin.x), -(camera.y - origin.y));

  if (!mapRenderer.cachedCanvas) {
    mapRenderer.buildCache(assets);
  }
  const cachedTerrain = mapRenderer.cachedCanvas;
  if (cachedTerrain) {
    const offset = mapRenderer.cachedOffset;
    ctx.drawImage(cachedTerrain, -origin.x - offset.x, -origin.y - offset.y);
  }

  mapRenderer.draw(ctx, assets, selected ?? undefined);
  const saunojaLayer = options?.saunojas;
  if (saunojaLayer && Array.isArray(saunojaLayer.units) && saunojaLayer.units.length > 0) {
    saunojaLayer.draw(ctx, saunojaLayer.units, {
      originX: origin.x,
      originY: origin.y,
      hexRadius: mapRenderer.hexSize
    });
  }
  drawUnits(ctx, mapRenderer, assets, units, origin);
  if (options?.sauna) {
    drawSaunaOverlay(ctx, options.sauna, {
      origin,
      hexSize: mapRenderer.hexSize
    });
  }
  ctx.restore();
}

export function drawUnits(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[],
  origin: PixelCoord
): void {
  const { width: hexWidth, height: hexHeight } = getHexDimensions(mapRenderer.hexSize);
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, mapRenderer.hexSize);
    const drawX = x - origin.x;
    const drawY = y - origin.y;
    const img = assets[`unit-${unit.type}`] ?? assets['placeholder'];
    const maxHealth = unit.getMaxHealth();
    ctx.save();
    if (unit.stats.health / maxHealth < 0.5) {
      ctx.filter = 'saturate(0)';
    }
    ctx.drawImage(img, drawX, drawY, hexWidth, hexHeight);
    if (isSisuBurstActive() && unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX, drawY, hexWidth, hexHeight);
    }
    ctx.restore();
  }
}
