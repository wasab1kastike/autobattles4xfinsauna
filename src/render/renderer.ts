import type { AxialCoord, PixelCoord } from '../hex/HexUtils.ts';
import { hexDistance } from '../hex/HexUtils.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit/index.ts';
import { isSisuBurstActive } from '../sisu/burst.ts';
import type { Sauna } from '../sim/sauna.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';
import { camera } from '../camera/autoFrame.ts';
import type { Saunoja } from '../units/saunoja.ts';
import type { DrawSaunojasOptions } from '../units/renderSaunoja.ts';
import { drawSaunaOverlay } from './saunaOverlay.ts';
import { getSpritePlacement } from './units/draw.ts';

type DrawSaunojaFn = (
  ctx: CanvasRenderingContext2D,
  units: Saunoja[],
  options?: DrawSaunojasOptions
) => void;

export interface FxLayerOptions {
  getUnitAlpha?: (unit: Unit) => number;
}

export interface DrawOptions {
  saunojas?: {
    units: Saunoja[];
    draw: DrawSaunojaFn;
  };
  sauna?: Sauna | null;
  fx?: FxLayerOptions;
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

  mapRenderer.draw(ctx, assets, selected ?? undefined);
  const saunojaLayer = options?.saunojas;
  if (saunojaLayer && Array.isArray(saunojaLayer.units) && saunojaLayer.units.length > 0) {
    saunojaLayer.draw(ctx, saunojaLayer.units, {
      originX: origin.x,
      originY: origin.y,
      hexRadius: mapRenderer.hexSize,
      zoom: camera.zoom
    });
  }
  drawUnits(ctx, mapRenderer, assets, units, origin, options?.fx);
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
  origin: PixelCoord,
  fx?: FxLayerOptions
): void {
  const friendlyVisionSources = units
    .filter((unit) => unit.faction === 'player' && !unit.isDead())
    .map((unit) => ({ coord: unit.coord, range: unit.getVisionRange() }));
  for (const unit of units) {
    if (unit.isDead()) {
      continue;
    }
    if (
      unit.faction === 'enemy' &&
      !friendlyVisionSources.some(
        ({ coord, range }) => hexDistance(coord, unit.coord) <= range
      )
    ) {
      continue;
    }
    const img = assets[`unit-${unit.type}`] ?? assets['placeholder'];
    const maxHealth = unit.getMaxHealth();
    ctx.save();
    const alpha = fx?.getUnitAlpha?.(unit);
    if (typeof alpha === 'number') {
      const clamped = Math.min(1, Math.max(0, alpha));
      if (clamped <= 0) {
        ctx.restore();
        continue;
      }
      ctx.globalAlpha *= clamped;
    }
    if (unit.stats.health / maxHealth < 0.5) {
      ctx.filter = 'saturate(0)';
    }
    const placement = getSpritePlacement({
      coord: unit.coord,
      hexSize: mapRenderer.hexSize,
      origin,
      zoom: camera.zoom,
      type: unit.type
    });
    ctx.drawImage(img, placement.drawX, placement.drawY, placement.width, placement.height);
    if (isSisuBurstActive() && unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(placement.drawX, placement.drawY, placement.width, placement.height);
    }
    ctx.restore();
  }
}
