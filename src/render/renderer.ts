import type { AxialCoord } from '../hex/HexUtils.ts';
import { axialToPixel } from '../hex/HexUtils.ts';
import type { HexMap } from '../hexmap.ts';
import type { LoadedAssets } from '../loader.ts';
import type { Unit } from '../unit.ts';
import { isSisuActive } from '../sim/sisu.ts';

export function draw(
  ctx: CanvasRenderingContext2D,
  map: HexMap,
  assets: LoadedAssets['images'],
  units: Unit[],
  selected: AxialCoord | null
): void {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, ctx.canvas.width / dpr, ctx.canvas.height / dpr);
  map.draw(ctx, assets, selected ?? undefined);
  drawUnits(ctx, map, assets, units);
}

export function drawUnits(
  ctx: CanvasRenderingContext2D,
  map: HexMap,
  assets: LoadedAssets['images'],
  units: Unit[]
): void {
  const hexWidth = map.hexSize * Math.sqrt(3);
  const hexHeight = map.hexSize * 2;
  for (const unit of units) {
    const { x, y } = axialToPixel(unit.coord, map.hexSize);
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
