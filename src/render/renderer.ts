import type { AxialCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import { getHexDimensions } from '../hex/HexDimensions.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit.ts';
import { isSisuActive } from '../sim/sisu.ts';
import { HexMapRenderer } from './HexMapRenderer.ts';

export function draw(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[],
  selected: AxialCoord | null
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
  mapRenderer.draw(ctx, assets, selected ?? undefined);
  drawUnits(ctx, mapRenderer, assets, units);
}

export function drawUnits(
  ctx: CanvasRenderingContext2D,
  mapRenderer: HexMapRenderer,
  assets: LoadedAssets['images'],
  units: Unit[]
): void {
  const { width: hexWidth, height: hexHeight } = getHexDimensions(mapRenderer.hexSize);
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, mapRenderer.hexSize);
    const img = assets[`unit-${unit.type}`] ?? assets['placeholder'];
    const maxHealth = unit.getMaxHealth();
    if (unit.stats.health / maxHealth < 0.5) {
      ctx.filter = 'saturate(0)';
    }
    ctx.drawImage(img, x, y, hexWidth, hexHeight);
    ctx.filter = 'none';
    if (isSisuActive() && unit.faction === 'player') {
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, hexWidth, hexHeight);
    }
  }
}
