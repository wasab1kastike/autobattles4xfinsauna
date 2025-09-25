import { HEX_R, pathHex } from '../hex/index.ts';
import type { AxialCoord } from '../hex/HexUtils.ts';
import type { Saunoja } from './saunoja.ts';
import { drawHitFlash, drawSteam } from './visualHelpers.ts';
import { getSpritePlacement } from '../render/units/draw.ts';
import type { UnitStatusBuff, UnitStatusPayload } from '../ui/fx/types.ts';

type SpriteResolver = (saunoja: Saunoja) => string | null | undefined;

const DEFAULT_SAUNOJA_SPRITE_ID = 'saunoja-02';

function normalizeSpriteId(candidate: string | null | undefined): string {
  if (typeof candidate !== 'string') {
    return DEFAULT_SAUNOJA_SPRITE_ID;
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return DEFAULT_SAUNOJA_SPRITE_ID;
  }
  return trimmed.replace(/^unit-/, '');
}

function resolveSpriteAsset(
  assets: Record<string, HTMLImageElement> | undefined,
  spriteId: string
): HTMLImageElement | null {
  if (!assets) {
    return null;
  }
  const assetKey = spriteId.startsWith('unit-') ? spriteId : `unit-${spriteId}`;
  const asset = assets[assetKey];
  return asset ?? null;
}

export interface DrawSaunojasOptions {
  assets?: Record<string, HTMLImageElement>;
  originX?: number;
  originY?: number;
  hexRadius?: number;
  zoom?: number;
  resolveRenderCoord?: (saunoja: Saunoja) => AxialCoord | null | undefined;
  resolveSpriteId?: SpriteResolver;
  fallbackSpriteId?: string;
  pushStatus?: (status: UnitStatusPayload) => void;
}

export function drawSaunojas(
  ctx: CanvasRenderingContext2D,
  saunojas: Saunoja[],
  {
    assets,
    originX = 0,
    originY = 0,
    hexRadius = HEX_R,
    zoom = 1,
    resolveRenderCoord,
    resolveSpriteId,
    fallbackSpriteId,
    pushStatus
  }: DrawSaunojasOptions = {}
): void {
  if (!ctx || !Array.isArray(saunojas) || saunojas.length === 0) {
    return;
  }

  if (!assets) {
    return;
  }

  const radius = Number.isFinite(hexRadius) && hexRadius > 0 ? hexRadius : HEX_R;
  const clipRadius = radius * 0.965;
  const fallback = normalizeSpriteId(fallbackSpriteId);
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
    const spriteId = normalizeSpriteId(resolveSpriteId?.(unit) ?? fallback);
    const sprite = resolveSpriteAsset(assets, spriteId);
    if (!sprite) {
      continue;
    }

    const placement = getSpritePlacement({
      coord,
      hexSize: radius,
      origin: { x: originX, y: originY },
      zoom,
      type: spriteId
    });
    const { centerX, centerY, drawX, drawY, width, height } = placement;

    ctx.save();
    pathHex(ctx, centerX, centerY, clipRadius);
    ctx.clip();

    ctx.save();
    ctx.filter = 'saturate(112%) contrast(108%) brightness(1.04)';
    ctx.drawImage(sprite, drawX, drawY, width, height);
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

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
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
